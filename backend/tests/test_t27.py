"""Test T27: Full End-to-End Workflow Verification."""

import pytest
from backend.db.store import init_db, get_connection, query_one, query_all
from backend.api.intake import ingest_report
from backend.simulation.clock import advance_sim_clock


@pytest.fixture(autouse=True)
def setup_test_db(tmp_path, monkeypatch):
    test_db = str(tmp_path / "test_t27.db")
    monkeypatch.setenv("GRIDWATCH_DB_PATH", test_db)
    init_db(test_db, force_reset=True)
    yield test_db


def test_t27_end_to_end_workflow():
    """T27: Complete end-to-end lifecycle:

    submission -> validation -> classification -> routing -> assignment -> travel -> in progress -> resolve -> meter updated -> employee returns home.
    """
    payload = {
        "reporter_name": "Supervisor Raman",
        "reporter_contact": "+91-9123456789",
        "meter_id": "GRIDB042R",
        "previous_reading": "00432.57kWh",
        "current_reading": "00750.00kWh",  # 317.43 kWh > 200.00 kWh threshold
        "event_code": "TM",  # Tampering + Overconsumption -> Category Tampering, Base P2
        "description": "Meter enclosure breached, high consumption recorded",
        "urgency": "Elevated"  # P2 elevated to P1!
    }

    # 1. Submission & Intake
    res = ingest_report(payload)
    assert res["validation_status"] == "VALID"
    report_id = res["id"]
    assert res["category"] == "Tampering"
    assert res["base_priority"] == "P2"
    assert res["priority"] == "P1"
    assert res["dispatch"]["decision"] == "LOCAL"
    emp_code = res["dispatch"]["employee"]
    assert emp_code == "JP1"

    # Verify initial status is Assigned
    rep = query_one("SELECT * FROM reports WHERE id = ?", (report_id,))
    assert rep["status"] == "Assigned"

    # Verify assignment record
    assign = query_one("SELECT * FROM assignments WHERE report_id = ?", (report_id,))
    assert assign is not None
    assert assign["employee_code"] == "JP1"
    assert assign["active_flag"] == 1

    # 2. Advance clock: travel (local so cost = 0) + 1 min to start work
    advance_sim_clock(2)
    rep_started = query_one("SELECT status FROM reports WHERE id = ?", (report_id,))
    assert rep_started["status"] == "In Progress"

    emp_working = query_one("SELECT state FROM employees WHERE code = 'JP1'")
    assert emp_working["state"] == "WORKING"

    # 3. Advance clock to complete auto job duration (Tampering is ~45 mins)
    advance_sim_clock(50)
    rep_resolved = query_one("SELECT status FROM reports WHERE id = ?", (report_id,))
    assert rep_resolved["status"] == "Resolved"

    # 4. Verify meter reading was updated to current reading (75000 hundredths)
    meter = query_one("SELECT last_reading_hundredths FROM meters WHERE meter_id = 'GRIDB042R'")
    assert meter["last_reading_hundredths"] == 75000

    # 5. Verify employee returned to IDLE (since home_grid == source_grid == JP)
    emp_idle = query_one("SELECT state, current_report_id FROM employees WHERE code = 'JP1'")
    assert emp_idle["state"] == "IDLE"
    assert emp_idle["current_report_id"] is None

    # 6. Verify audit history exists
    statuses = query_all("SELECT * FROM status_history WHERE report_id = ? ORDER BY time", (report_id,))
    status_flow = [s["new_status"] for s in statuses]
    assert "Assigned" in status_flow
    assert "In Progress" in status_flow
    assert "Resolved" in status_flow

    logs = query_all("SELECT * FROM routing_log WHERE report_id = ?", (report_id,))
    assert len(logs) >= 1
