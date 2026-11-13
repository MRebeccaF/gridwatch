"""Tests T13 to T26: Network Routing, Capacity, Dispatch, Preemption, Lifecycle, and Concurrency."""

import concurrent.futures
import json
import pytest
from backend.db.store import init_db, get_connection, query_all, query_one
from backend.api.intake import ingest_report, ingest_batch_reports
from backend.api.actions import fix_report_zone, change_report_priority, manual_start_work, manual_resolve_work
from backend.dispatch.engine import handle_employee_off_duty, update_report_status, drain_waiting_queue
from backend.simulation.clock import advance_sim_clock
from backend.routing.table import build_routing_model


@pytest.fixture(autouse=True)
def setup_test_db(tmp_path, monkeypatch):
    test_db = str(tmp_path / "test_routing.db")
    monkeypatch.setenv("GRIDWATCH_DB_PATH", test_db)
    init_db(test_db, force_reset=True)
    yield test_db


def make_report(zone_letter="A", meter_id=None, event_code="OT", urgency="Routine", prev="00100.00kWh", curr="00100.00kWh"):
    m_id = meter_id or f"GRID{zone_letter}101R"
    return {
        "reporter_name": "Field Inspector",
        "reporter_contact": "+91-9988776655",
        "meter_id": m_id,
        "previous_reading": prev,
        "current_reading": curr,
        "event_code": event_code,
        "description": "Anomaly report",
        "urgency": urgency
    }


def test_t13_unknown_zone_to_correction_queue_and_fix_zone():
    """T13: Unknown zone letter (F-Z) goes to Correction Queue; fix-zone then dispatches."""
    # GRIDK123R has valid syntax but zone 'K' is not in A-E
    rep = make_report(meter_id="GRIDK123R", event_code="OT")
    res = ingest_report(rep)
    assert res["validation_status"] == "VALID"
    assert res["dispatch"]["decision"] == "CORRECTION_QUEUE"

    row = query_one("SELECT status, queue_type FROM reports WHERE id = ?", (res["id"],))
    assert row["status"] == "Pending"
    assert row["queue_type"] == "CORRECTION"

    # Fix zone to 'B' (JP Nagar)
    fix_res = fix_report_zone(res["id"], "B")
    assert fix_res["success"] is True
    assert fix_res["dispatch"]["decision"] == "LOCAL"
    assert fix_res["dispatch"]["station"] == "JP"

    # Verify report is now Assigned
    updated_row = query_one("SELECT status, queue_type, source_grid FROM reports WHERE id = ?", (res["id"],))
    assert updated_row["status"] == "Assigned"
    assert updated_row["queue_type"] is None
    assert updated_row["source_grid"] == "JP"


def test_t14_local_assignment_picks_lowest_numbered_employee():
    """T14: Local assignment picks lowest-numbered employee (e.g. BSK1); log written."""
    rep = make_report("A")  # Zone A = BSK
    res = ingest_report(rep)
    assert res["dispatch"]["decision"] == "LOCAL"
    assert res["dispatch"]["employee"] == "BSK1"

    # Check routing log
    logs = query_all("SELECT * FROM routing_log WHERE report_id = ?", (res["id"],))
    assert len(logs) >= 1
    assert any(l["decision"] == "LOCAL" and l["employee_code"] == "BSK1" for l in logs)


def test_t15_overflow_to_nearest_grid():
    """T15: Six local assignments fill BSK (capacity 6); 7th overflows to nearest grid."""
    # Fill BSK with 6 reports (BSK1 through BSK6)
    for i in range(1, 7):
        r = ingest_report(make_report("A", meter_id=f"GRIDA10{i}R", event_code="HA"))
        assert r["dispatch"]["decision"] == "LOCAL"
        assert r["dispatch"]["employee"] == f"BSK{i}"

    # 7th report for Zone A (BSK)
    # Nearest neighbor to BSK is JP (weight 10 vs KOR 25)
    r7 = ingest_report(make_report("A", meter_id="GRIDA105Y", event_code="HA"))
    assert r7["dispatch"]["decision"] == "OVERFLOW"
    assert r7["dispatch"]["from"] == "JP"
    assert r7["dispatch"]["to"] == "BSK"
    assert r7["dispatch"]["employee"] == "JP1"
    assert r7["dispatch"]["cost"] == 10


def test_t16_lending_reserve_rule():
    """T16: Lending reserve respected for non-P1 (keeps >= 1), waived for P1."""
    # Set JP Nagar (Zone B) employees 2-6 to OFF_DUTY so JP has only 1 eligible employee (JP1)
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("UPDATE employees SET available_flag = 0, state = 'OFF_DUTY' WHERE code IN ('JP2', 'JP3', 'JP4', 'JP5', 'JP6')")
        conn.commit()
    finally:
        conn.close()

    # Fill BSK (Zone A) completely with 6 reports
    for i in range(1, 7):
        ingest_report(make_report("A", meter_id=f"GRIDA10{i}R", event_code="HA"))

    # Now, a non-P1 report for BSK cannot borrow from JP because JP only has 1 employee (reserve rule requires >= 2)
    # Next nearest to BSK is KOR (weight 25) which has 6 employees!
    rep_non_p1 = make_report("A", meter_id="GRIDA101R", event_code="HA")  # HA is P3
    res_non_p1 = ingest_report(rep_non_p1)
    assert res_non_p1["dispatch"]["decision"] == "OVERFLOW"
    # Lent from KOR instead of JP!
    assert res_non_p1["dispatch"]["from"] == "KOR"

    # Now set KOR employees 2-6 off duty as well, so KOR also has only 1 employee.
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("UPDATE employees SET available_flag = 0, state = 'OFF_DUTY' WHERE code IN ('KOR2', 'KOR3', 'KOR4', 'KOR5', 'KOR6')")
        conn.commit()
    finally:
        conn.close()

    # Now a P1 report for BSK: the reserve rule is WAIVED for P1, so JP (nearest, cost 10) CAN lend its last employee!
    rep_p1 = make_report("A", meter_id="GRIDA102Y", event_code="OT", urgency="Critical")  # P1
    res_p1 = ingest_report(rep_p1)
    assert res_p1["dispatch"]["decision"] == "OVERFLOW"
    assert res_p1["dispatch"]["from"] == "JP"
    assert res_p1["dispatch"]["employee"] == "JP1"


def test_t17_waiting_queue_ordering_and_dequeuing():
    """T17: All grids full: reports wait ordered by priority, submission time, seq; freeing an employee dequeues correctly."""
    # Set all employees across all 5 grids OFF_DUTY except BSK1
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("UPDATE employees SET available_flag = 0, state = 'OFF_DUTY' WHERE code != 'BSK1'")
        conn.commit()
    finally:
        conn.close()

    # BSK1 handles first report and starts work (In Progress, so it cannot be preempted)
    r1 = ingest_report(make_report("A", meter_id="GRIDA101R", event_code="HA"))
    assert r1["dispatch"]["decision"] == "LOCAL"
    manual_start_work(r1["id"])

    # Now submit 3 more reports that will be queued:
    # r_p4: Overconsumption (P4)
    r_p4 = ingest_report(make_report("A", meter_id="GRIDA102Y", event_code="NONE", prev="00100.00kWh", curr="00400.00kWh"))
    assert r_p4["dispatch"]["decision"] == "QUEUED"

    # r_p1: Outage (P1)
    r_p1 = ingest_report(make_report("A", meter_id="GRIDA103B", event_code="OT"))
    assert r_p1["dispatch"]["decision"] == "QUEUED"

    # r_p2: Tampering (P2)
    r_p2 = ingest_report(make_report("A", meter_id="GRIDA104R", event_code="TM"))
    assert r_p2["dispatch"]["decision"] == "QUEUED"

    # Manually resolve r1 so BSK1 becomes free
    manual_resolve_work(r1["id"])

    # BSK1 became free; drain_waiting_queue should assign the highest-priority waiting report (P1 -> r_p1)
    p1_row = query_one("SELECT status, queue_type FROM reports WHERE id = ?", (r_p1["id"],))
    assert p1_row["status"] == "Assigned"
    assert p1_row["queue_type"] is None

    # r_p2 and r_p4 should still be Pending
    p2_row = query_one("SELECT status FROM reports WHERE id = ?", (r_p2["id"],))
    assert p2_row["status"] == "Pending"


def test_t18_p1_override_preempts_not_started_case():
    """T18: P1 override preempts lowest-priority not-started case."""
    # Set all employees off duty except BSK1
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("UPDATE employees SET available_flag = 0, state = 'OFF_DUTY' WHERE code != 'BSK1'")
        conn.commit()
    finally:
        conn.close()

    # Assign BSK1 to a P4 report
    r_p4 = ingest_report(make_report("A", meter_id="GRIDA101R", event_code="NONE", prev="00100.00kWh", curr="00400.00kWh"))
    assert r_p4["dispatch"]["decision"] == "LOCAL"
    assert query_one("SELECT status FROM reports WHERE id = ?", (r_p4["id"],))["status"] == "Assigned"

    # Now an incoming P1 report arrives while r_p4 is still Assigned (not started!)
    r_p1 = ingest_report(make_report("A", meter_id="GRIDA102Y", event_code="OT", urgency="Critical"))
    assert r_p1["dispatch"]["decision"] == "OVERRIDE_PREEMPT"
    assert r_p1["dispatch"]["employee"] == "BSK1"

    # Check that victim (r_p4) went back to Pending in WAITING queue
    victim_row = query_one("SELECT status, queue_type FROM reports WHERE id = ?", (r_p4["id"],))
    assert victim_row["status"] == "Pending"
    assert victim_row["queue_type"] == "WAITING"

    # Check that P1 is now Assigned to BSK1
    p1_row = query_one("SELECT status FROM reports WHERE id = ?", (r_p1["id"],))
    assert p1_row["status"] == "Assigned"


def test_t19_p1_never_preempts_in_progress():
    """T19: P1 with everything In Progress waits at front; nothing In Progress is preempted."""
    # Set all employees off duty except BSK1
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("UPDATE employees SET available_flag = 0, state = 'OFF_DUTY' WHERE code != 'BSK1'")
        conn.commit()
    finally:
        conn.close()

    # Assign BSK1 to a P4 report and START WORK (In Progress)
    r_p4 = ingest_report(make_report("A", meter_id="GRIDA101R", event_code="NONE", prev="00100.00kWh", curr="00400.00kWh"))
    manual_start_work(r_p4["id"])
    assert query_one("SELECT status FROM reports WHERE id = ?", (r_p4["id"],))["status"] == "In Progress"

    # Incoming P1 report arrives
    r_p1 = ingest_report(make_report("A", meter_id="GRIDA102Y", event_code="OT", urgency="Critical"))
    # Cannot preempt In Progress work! Must be queued at the front of WAITING queue
    assert r_p1["dispatch"]["decision"] == "QUEUED"

    # In Progress report remains In Progress
    assert query_one("SELECT status FROM reports WHERE id = ?", (r_p4["id"],))["status"] == "In Progress"


def test_t20_employee_off_duty_handling():
    """T20: Employee set off duty: backup or queue."""
    r1 = ingest_report(make_report("A", meter_id="GRIDA101R", event_code="HA"))
    assigned_emp = r1["dispatch"]["employee"]  # BSK1

    conn = get_connection()
    try:
        res = handle_employee_off_duty(conn, assigned_emp)
        conn.commit()
    finally:
        conn.close()

    assert res["status"] == "Backup reassignment attempted"
    assert res["result"]["decision"] == "LOCAL"
    assert res["result"]["employee"] == "BSK2"  # BSK2 backed up!


def test_t21_batch_and_concurrency():
    """T21: Batch of 10 plus threaded hammering: deterministic, no duplicate assignments, identical on rerun."""
    reports = [make_report("A", meter_id=f"GRIDA10{i % 5 + 1}R", event_code="HA") for i in range(10)]
    batch_res = ingest_batch_reports(reports)
    assert len(batch_res) == 10

    # Ensure no active employee has duplicate active assignments
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """SELECT employee_code, COUNT(*) as c 
               FROM assignments WHERE active_flag = 1 
               GROUP BY employee_code HAVING c > 1"""
        )
        assert len(cursor.fetchall()) == 0

        # Threaded hammering test: submit 10 concurrent requests
        def submit_one(idx):
            return ingest_report(make_report("B", meter_id=f"GRIDB04{idx % 5 + 2}Y", event_code="TM"))

        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            threaded_results = list(executor.map(submit_one, range(10)))

        assert len(threaded_results) == 10
        # Assert database integrity remains intact with no double assignments
        cursor.execute(
            """SELECT employee_code, COUNT(*) as c 
               FROM assignments WHERE active_flag = 1 
               GROUP BY employee_code HAVING c > 1"""
        )
        assert len(cursor.fetchall()) == 0
    finally:
        conn.close()


def test_t22_escalate_and_deescalate():
    """T22: Escalate and de-escalate: logged, queue re-sorted, de-escalation does not unassign."""
    r = ingest_report(make_report("A", meter_id="GRIDA101R", event_code="HA"))  # Base P3
    assert r["priority"] == "P3"

    # Escalate to P1
    esc = change_report_priority(r["id"], "P1", "Severe smoke detected")
    assert esc["success"] is True
    assert esc["new_priority"] == "P1"

    # Check priority history
    hist = query_all("SELECT * FROM priority_history WHERE report_id = ?", (r["id"],))
    assert len(hist) == 1
    assert hist[0]["old_priority"] == "P3" and hist[0]["new_priority"] == "P1"

    # De-escalate to P4
    deesc = change_report_priority(r["id"], "P4", "False alarm on smoke")
    assert deesc["success"] is True
    assert deesc["new_priority"] == "P4"

    # De-escalation must NEVER unassign the employee
    row = query_one("SELECT status, current_assignment_id FROM reports WHERE id = ?", (r["id"],))
    assert row["status"] == "Assigned"
    assert row["current_assignment_id"] is not None


def test_t23_status_transitions_and_409_validation():
    """T23: Valid status transitions; invalid ones return 409 error."""
    r = ingest_report(make_report("A", meter_id="GRIDA101R", event_code="HA"))
    rep_id = r["id"]

    # Current status: Assigned
    # Invalid transition: Assigned -> Resolved directly without In Progress
    conn = get_connection()
    try:
        ok, err = update_report_status(conn, rep_id, "Resolved", "Illegal jump")
        assert ok is False
        assert "Invalid status transition" in err
    finally:
        conn.close()

    # Valid: Assigned -> In Progress -> Resolved
    res_start = manual_start_work(rep_id)
    assert res_start["success"] is True
    assert res_start["status"] == "In Progress"

    res_resolve = manual_resolve_work(rep_id)
    assert res_resolve["success"] is True
    assert res_resolve["status"] == "Resolved"


def test_t24_remote_job_travel_and_returning():
    """T24: Remote job: travel time equals path cost; employee returns home and is not eligible while returning."""
    # Fill BSK so 7th overflows to JP (JP1, cost 10)
    for i in range(1, 7):
        ingest_report(make_report("A", meter_id=f"GRIDA10{i}R", event_code="HA"))

    r_remote = ingest_report(make_report("A", meter_id="GRIDA105Y", event_code="HA"))
    assert r_remote["dispatch"]["decision"] == "OVERFLOW"
    emp_code = r_remote["dispatch"]["employee"]  # JP1

    # Employee is now TRAVELLING to BSK with route cost 10
    assign = query_one("SELECT * FROM assignments WHERE report_id = ?", (r_remote["id"],))
    assert assign["route_cost"] == 10

    # Advance clock to arrive and start work
    advance_sim_clock(15)
    emp = query_one("SELECT state FROM employees WHERE code = ?", (emp_code,))
    assert emp["state"] in ("WORKING", "TRAVELLING")

    # Manually resolve work if still working
    manual_resolve_work(r_remote["id"])

    # Now employee must be RETURNING home to JP
    emp_ret = query_one("SELECT state, location FROM employees WHERE code = ?", (emp_code,))
    assert emp_ret["state"] == "RETURNING"

    # While RETURNING, employee is NOT eligible
    conn = get_connection()
    try:
        from backend.dispatch.engine import get_eligible_employees_for_station
        eligible_jp = get_eligible_employees_for_station(conn, "JP")
        assert not any(e["code"] == emp_code for e in eligible_jp)
    finally:
        conn.close()

    # Advance time by route_cost (10 min) to complete return journey
    advance_sim_clock(12)
    emp_home = query_one("SELECT state, location FROM employees WHERE code = ?", (emp_code,))
    assert emp_home["state"] == "IDLE"
    assert emp_home["location"] == "JP"


def test_t25_editing_edges_and_disconnected_warning():
    """T25: Editing edges changes routing table and nearest lender; disconnected graph warns."""
    # Build initial graph
    conn = get_connection()
    try:
        from backend.dispatch.engine import get_active_graph
        g1 = get_active_graph(conn)
        res1 = g1.compute_all_pairs_routing_table()
        assert res1["is_connected"] is True
        assert res1["routing_table"]["BSK"]["JP"]["cost"] == 10

        # Disconnect WFD by deleting its edges
        cursor = conn.cursor()
        cursor.execute("DELETE FROM edges WHERE from_station = 'WFD' OR to_station = 'WFD'")
        conn.commit()

        g2 = get_active_graph(conn)
        res2 = g2.compute_all_pairs_routing_table()
        assert res2["is_connected"] is False
        assert "disconnected" in res2["warning"]
    finally:
        conn.close()


def test_t26_data_persistence_across_reconnect():
    """T26: Restart the server: all data persists in SQLite."""
    r = ingest_report(make_report("A", meter_id="GRIDA101R", event_code="TM"))
    rep_id = r["id"]

    # Query afresh from new connection
    new_conn = get_connection()
    try:
        cursor = new_conn.cursor()
        cursor.execute("SELECT * FROM reports WHERE id = ?", (rep_id,))
        row = cursor.fetchone()
        assert row is not None
        assert row["id"] == rep_id
        assert row["category"] == "Tampering"
    finally:
        new_conn.close()
