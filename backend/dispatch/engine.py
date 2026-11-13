"""Dispatch Engine and Queue Management (BCS502).

Implements deterministic routing table lookup, local assignment, overflow lending,
P1 preemption override, queue ordering, and lifecycle enforcement with atomic
database transactions.
"""

import json
import logging
from typing import Any, Dict, List, Optional, Tuple
from ..db.store import get_connection, get_global_lock
from ..routing.table import build_routing_model

logger = logging.getLogger("gridwatch.dispatch.engine")

VALID_TRANSITIONS = {
    ("Pending", "Assigned"),
    ("Assigned", "In Progress"),
    ("In Progress", "Resolved"),
    ("Assigned", "Pending"),
    ("In Progress", "Pending"),
}


def get_current_sim_time(conn) -> int:
    cursor = conn.cursor()
    cursor.execute("SELECT clock_minutes FROM sim_state WHERE id = 1")
    row = cursor.fetchone()
    return row["clock_minutes"] if row else 540


def get_sim_mode(conn) -> str:
    cursor = conn.cursor()
    cursor.execute("SELECT mode FROM sim_state WHERE id = 1")
    row = cursor.fetchone()
    return row["mode"] if row else "auto"


def get_active_graph(conn):
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM zones ORDER BY key")
    zones = [dict(r) for r in cursor.fetchall()]
    cursor.execute("SELECT * FROM edges")
    edges = [dict(r) for r in cursor.fetchall()]
    return build_routing_model(zones, edges)


def get_eligible_employees_for_station(conn, station_code: str) -> List[Dict[str, Any]]:
    """Returns list of employees eligible for new assignment at station_code.

    Eligible:
    - home_grid == station_code
    - location == station_code
    - state == 'IDLE'
    - available_flag == 1
    - current_report_id IS NULL
    - station committed count < station capacity
    """
    cursor = conn.cursor()
    # Check station capacity
    cursor.execute("SELECT capacity FROM zones WHERE station_code = ?", (station_code,))
    zone_row = cursor.fetchone()
    if not zone_row:
        return []
    capacity = zone_row["capacity"]

    # Committed count: count of employees of this home_grid who are NOT (state == 'IDLE' and current_report_id IS NULL)
    cursor.execute(
        """SELECT COUNT(*) as committed FROM employees 
           WHERE home_grid = ? AND (state != 'IDLE' OR current_report_id IS NOT NULL)""",
        (station_code,)
    )
    committed = cursor.fetchone()["committed"]

    if committed >= capacity:
        return []

    # Get eligible employees ordered by code (e.g. BSK1 < BSK2)
    cursor.execute(
        """SELECT * FROM employees 
           WHERE home_grid = ? AND location = ? AND state = 'IDLE' 
                 AND available_flag = 1 AND current_report_id IS NULL
           ORDER BY code ASC""",
        (station_code, station_code)
    )
    return [dict(r) for r in cursor.fetchall()]


def record_status_history(conn, report_id: str, old_status: Optional[str], new_status: str, reason: str, sim_time: int):
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO status_history (report_id, time, old_status, new_status, reason)
           VALUES (?, ?, ?, ?, ?)""",
        (report_id, sim_time, old_status, new_status, reason)
    )


def record_routing_log(
    conn,
    report_id: str,
    decision: str,
    priority: Optional[str],
    from_grid: Optional[str],
    to_grid: Optional[str],
    employee_code: Optional[str],
    route: Optional[str],
    reason_text: str,
    sim_time: int
):
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO routing_log (time, report_id, decision, priority, from_grid, to_grid, employee_code, route, reason_text)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (sim_time, report_id, decision, priority, from_grid, to_grid, employee_code, route, reason_text)
    )


def update_report_status(
    conn,
    report_id: str,
    new_status: str,
    reason: str,
    queue_type: Optional[str] = None
) -> Tuple[bool, Optional[str]]:
    """Enforces allowed status transitions.

    Returns (success, error_message).
    """
    cursor = conn.cursor()
    cursor.execute("SELECT status FROM reports WHERE id = ?", (report_id,))
    row = cursor.fetchone()
    if not row:
        return False, f"Report {report_id} not found"

    old_status = row["status"]
    if old_status == new_status:
        return True, None

    transition = (old_status, new_status)
    if transition not in VALID_TRANSITIONS:
        msg = f"Invalid status transition from '{old_status}' to '{new_status}' (allowed: {VALID_TRANSITIONS})"
        logger.warning(msg)
        return False, msg

    sim_time = get_current_sim_time(conn)
    cursor.execute(
        "UPDATE reports SET status = ?, queue_type = ? WHERE id = ?",
        (new_status, queue_type, report_id)
    )
    record_status_history(conn, report_id, old_status, new_status, reason, sim_time)
    return True, None


def calculate_job_duration(category: str, sequence: int) -> int:
    """Calculates deterministic job duration in minutes:

    Base duration + deterministic jitter derived from sequence number.
    """
    base = {
        "Tampering": 45,
        "Outage": 30,
        "Hardware": 40,
        "Communication": 25,
        "Overconsumption": 20
    }.get(category, 30)

    jitter = ((sequence * 7) % 11) - 5  # -5 to +5 minutes deterministic jitter
    duration = base + jitter
    return max(5, duration)


def dispatch_report(conn, report_id: str) -> Dict[str, Any]:
    """Dispatches a single accepted report using deterministic rules.

    Must be called within an active transaction and lock.
    """
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM reports WHERE id = ?", (report_id,))
    report = cursor.fetchone()
    if not report:
        raise ValueError(f"Report {report_id} not found")

    assert report["validation_status"] == "VALID", f"Routing key can only be extracted from an ACCEPTED report! Got: {report['validation_status']}"

    meter_id = report["meter_id"]
    # If zone_letter was explicitly fixed/set in report record, prioritize it, else extract from meter_id[4]
    zone_letter = report["zone_letter"] if report["zone_letter"] else meter_id[4]
    priority = report["priority"]
    sequence = report["sequence"]
    category = report["category"]
    sim_time = get_current_sim_time(conn)

    # 1. Look up zone in zones table
    cursor.execute("SELECT * FROM zones WHERE key = ?", (zone_letter,))
    zone_row = cursor.fetchone()

    # Step 2: Unknown zone -> virtual CENTRAL Correction Queue
    if not zone_row:
        cursor.execute(
            """UPDATE reports SET status = 'Pending', queue_type = 'CORRECTION', 
                      zone_letter = ?, source_grid = NULL 
               WHERE id = ?""",
            (zone_letter, report_id)
        )
        record_routing_log(
            conn, report_id, "CORRECTION_QUEUE", priority, None, None, None, None,
            f"Unknown zone letter '{zone_letter}': placed in virtual CENTRAL Correction Queue", sim_time
        )
        return {"decision": "CORRECTION_QUEUE", "zone": zone_letter, "queue": "CORRECTION"}

    home_station = zone_row["station_code"]
    cursor.execute("UPDATE reports SET zone_letter = ?, source_grid = ? WHERE id = ?", (zone_letter, home_station, report_id))

    graph = get_active_graph(conn)
    all_pairs = graph.compute_all_pairs_routing_table()["routing_table"]

    # Step 3: Check local eligible employees at home_station
    local_eligible = get_eligible_employees_for_station(conn, home_station)
    if local_eligible:
        assigned_emp = local_eligible[0]
        emp_code = assigned_emp["code"]
        route = [home_station]
        route_cost = 0

        # Create assignment
        cursor.execute(
            """INSERT INTO assignments (report_id, employee_code, home_grid, source_grid, route_json, route_cost, assigned_time, arrived_time, started_time, finished_time, returned_time, active_flag, end_reason)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL)""",
            (report_id, emp_code, home_station, home_station, json.dumps(route), route_cost, sim_time, sim_time, None, None, None)
        )
        assignment_id = cursor.lastrowid

        # Update employee state to TRAVELLING (or IDLE waiting to start)
        cursor.execute(
            """UPDATE employees SET state = 'TRAVELLING', current_report_id = ? 
               WHERE code = ?""",
            (report_id, emp_code)
        )

        # Update report status to Assigned
        update_report_status(conn, report_id, "Assigned", "Local employee assigned", queue_type=None)
        cursor.execute("UPDATE reports SET current_assignment_id = ? WHERE id = ?", (assignment_id, report_id))

        record_routing_log(
            conn, report_id, "LOCAL", priority, home_station, home_station, emp_code,
            json.dumps(route), f"Assigned local employee {emp_code} to report {report_id}", sim_time
        )
        return {"decision": "LOCAL", "employee": emp_code, "station": home_station, "route_cost": 0}

    # Step 4: Overflow lending
    # List other grids sorted by shortest path cost from home_station (ties alphabetical by station code)
    cursor.execute("SELECT station_code FROM zones WHERE station_code != ? ORDER BY station_code", (home_station,))
    other_stations = [r["station_code"] for r in cursor.fetchall()]

    def sort_key(st):
        info = all_pairs.get(st, {}).get(home_station, {})
        cost = info.get("cost") if info.get("reachable") else float("inf")
        hops = info.get("hops", float("inf"))
        return (cost, hops, st)

    sorted_other_stations = sorted(other_stations, key=sort_key)

    chosen_lender = None
    lender_employee = None
    lender_route = None
    lender_cost = 0

    for candidate_station in sorted_other_stations:
        route_info = all_pairs.get(candidate_station, {}).get(home_station)
        if not route_info or not route_info.get("reachable"):
            continue

        eligible = get_eligible_employees_for_station(conn, candidate_station)
        if not eligible:
            continue

        # Lending rule:
        # Check if lender has waiting P1 or P2 reports of its own
        cursor.execute(
            """SELECT COUNT(*) as count FROM reports 
               WHERE source_grid = ? AND status = 'Pending' AND queue_type = 'WAITING' 
                     AND priority IN ('P1', 'P2')""",
            (candidate_station,)
        )
        lender_waiting_high = cursor.fetchone()["count"]
        if lender_waiting_high > 0:
            continue

        # Lending reserve rule: after lending, lender keeps at least 1 eligible employee
        # For P1 reports, the keep-1 reserve is WAIVED!
        if priority == "P1":
            if len(eligible) >= 1:
                chosen_lender = candidate_station
                lender_employee = eligible[0]
                lender_route = route_info["path"]
                lender_cost = route_info["cost"]
                break
        else:
            if len(eligible) >= 2:
                chosen_lender = candidate_station
                lender_employee = eligible[0]
                lender_route = route_info["path"]
                lender_cost = route_info["cost"]
                break

    if chosen_lender and lender_employee:
        emp_code = lender_employee["code"]
        arrived_time = sim_time + lender_cost

        cursor.execute(
            """INSERT INTO assignments (report_id, employee_code, home_grid, source_grid, route_json, route_cost, assigned_time, arrived_time, started_time, finished_time, returned_time, active_flag, end_reason)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL)""",
            (report_id, emp_code, chosen_lender, home_station, json.dumps(lender_route), lender_cost, sim_time, arrived_time, None, None, None)
        )
        assignment_id = cursor.lastrowid

        cursor.execute(
            """UPDATE employees SET state = 'TRAVELLING', current_report_id = ? 
               WHERE code = ?""",
            (report_id, emp_code)
        )

        update_report_status(conn, report_id, "Assigned", f"Overflow employee {emp_code} lent from {chosen_lender}", queue_type=None)
        cursor.execute("UPDATE reports SET current_assignment_id = ? WHERE id = ?", (assignment_id, report_id))

        record_routing_log(
            conn, report_id, "OVERFLOW", priority, chosen_lender, home_station, emp_code,
            json.dumps(lender_route), f"Overflow: {chosen_lender} lent {emp_code} to {home_station} (travel time: {lender_cost}m)", sim_time
        )
        return {"decision": "OVERFLOW", "employee": emp_code, "from": chosen_lender, "to": home_station, "cost": lender_cost}

    # Step 5: Priority Override (P1 only)
    if priority == "P1":
        # Find cases with status 'Assigned' whose employee has not started work (started_time IS NULL) and priority < P1
        cursor.execute(
            """SELECT r.id as report_id, r.priority, r.submitted_time, a.id as assignment_id, 
                      a.employee_code, a.home_grid, e.location, e.state
               FROM reports r
               JOIN assignments a ON r.id = a.report_id AND a.active_flag = 1
               JOIN employees e ON a.employee_code = e.code
               WHERE r.status = 'Assigned' AND a.started_time IS NULL AND r.priority IN ('P2', 'P3', 'P4')"""
        )
        candidates = [dict(r) for r in cursor.fetchall()]

        if candidates:
            # Sort candidates:
            # 1. lowest priority (P4 first, then P3, then P2)
            # 2. shortest travel cost from candidate employee location to H
            # 3. newest (highest submitted_time)
            priority_rank = {"P4": 4, "P3": 3, "P2": 2}

            def victim_sort_key(c):
                p_rank = -priority_rank.get(c["priority"], 0)  # negative so P4 (-4) comes before P2 (-2)
                emp_loc = c["location"]
                cost = float("inf")
                if emp_loc in all_pairs and home_station in all_pairs[emp_loc]:
                    cost = all_pairs[emp_loc][home_station]["cost"] or float("inf")
                sub_time = -c["submitted_time"]  # newest first
                return (p_rank, cost, sub_time)

            candidates.sort(key=victim_sort_key)
            victim = candidates[0]

            victim_report_id = victim["report_id"]
            victim_emp_code = victim["employee_code"]
            victim_home_grid = victim["home_grid"]

            # Cancel victim's active assignment
            cursor.execute(
                """UPDATE assignments SET active_flag = 0, end_reason = 'PREEMPTED' 
                   WHERE id = ?""",
                (victim["assignment_id"],)
            )

            # Move victim back to Pending in WAITING queue
            update_report_status(conn, victim_report_id, "Pending", "Preempted by P1 override", queue_type="WAITING")
            cursor.execute("UPDATE reports SET current_assignment_id = NULL WHERE id = ?", (victim_report_id,))

            record_routing_log(
                conn, victim_report_id, "OVERRIDE_PREEMPT", victim["priority"], None, None, victim_emp_code, None,
                f"Preempted by P1 report {report_id}; employee {victim_emp_code} redirected", sim_time
            )

            # Redirect employee to new P1 report
            emp_loc = victim["location"]
            redirect_route = all_pairs.get(emp_loc, {}).get(home_station, {}).get("path", [emp_loc, home_station])
            redirect_cost = all_pairs.get(emp_loc, {}).get(home_station, {}).get("cost", 0)
            arrived_time = sim_time + redirect_cost

            cursor.execute(
                """INSERT INTO assignments (report_id, employee_code, home_grid, source_grid, route_json, route_cost, assigned_time, arrived_time, started_time, finished_time, returned_time, active_flag, end_reason)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL)""",
                (report_id, victim_emp_code, victim_home_grid, home_station, json.dumps(redirect_route), redirect_cost, sim_time, arrived_time, None, None, None)
            )
            new_assign_id = cursor.lastrowid

            cursor.execute(
                """UPDATE employees SET state = 'TRAVELLING', current_report_id = ? 
                   WHERE code = ?""",
                (report_id, victim_emp_code)
            )

            update_report_status(conn, report_id, "Assigned", f"Assigned via P1 preemption of {victim_report_id}", queue_type=None)
            cursor.execute("UPDATE reports SET current_assignment_id = ? WHERE id = ?", (new_assign_id, report_id))

            record_routing_log(
                conn, report_id, "OVERRIDE_PREEMPT", priority, emp_loc, home_station, victim_emp_code,
                json.dumps(redirect_route), f"P1 Override Preemption: seized employee {victim_emp_code} from report {victim_report_id}", sim_time
            )
            return {"decision": "OVERRIDE_PREEMPT", "employee": victim_emp_code, "preempted_report": victim_report_id}

    # Step 6: Queue in waiting queue
    cursor.execute(
        """UPDATE reports SET status = 'Pending', queue_type = 'WAITING' 
           WHERE id = ?""",
        (report_id,)
    )
    record_routing_log(
        conn, report_id, "QUEUED", priority, None, home_station, None, None,
        f"No eligible employees or lenders available; queued in waiting queue", sim_time
    )
    return {"decision": "QUEUED", "queue": "WAITING"}


def drain_waiting_queue(conn) -> List[Dict[str, Any]]:
    """Drains the waiting queue in deterministic priority order:

    Priority (P1, P2, P3, P4), then submission time, then sequence number.
    """
    cursor = conn.cursor()
    cursor.execute(
        """SELECT id, priority, submitted_time, sequence 
           FROM reports 
           WHERE status = 'Pending' AND queue_type = 'WAITING'"""
    )
    rows = cursor.fetchall()
    if not rows:
        return []

    p_rank = {"P1": 1, "P2": 2, "P3": 3, "P4": 4}
    waiting_reports = sorted(
        [dict(r) for r in rows],
        key=lambda r: (p_rank.get(r["priority"], 99), r["submitted_time"], r["sequence"])
    )

    results = []
    for r in waiting_reports:
        # Check if report is still pending (might have been dispatched in loop)
        cursor.execute("SELECT status, queue_type FROM reports WHERE id = ?", (r["id"],))
        curr = cursor.fetchone()
        if not curr or curr["status"] != "Pending" or curr["queue_type"] != "WAITING":
            continue

        res = dispatch_report(conn, r["id"])
        if res["decision"] not in ("QUEUED", "CORRECTION_QUEUE"):
            sim_time = get_current_sim_time(conn)
            record_routing_log(
                conn, r["id"], "DEQUEUED", r["priority"], None, None, None, None,
                f"Dequeued and assigned via {res['decision']}", sim_time
            )
            results.append({"report_id": r["id"], "result": res})

    return results


def handle_employee_off_duty(conn, emp_code: str) -> Dict[str, Any]:
    """Handles an assigned or in-progress employee being set OFF_DUTY.

    - If Assigned: re-enters dispatch with BACKUP_REASSIGN
    - If In Progress: returns to Pending waiting queue
    """
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM employees WHERE code = ?", (emp_code,))
    emp = cursor.fetchone()
    if not emp:
        return {"error": f"Employee {emp_code} not found"}

    active_report_id = emp["current_report_id"]
    sim_time = get_current_sim_time(conn)

    cursor.execute("UPDATE employees SET available_flag = 0, state = 'OFF_DUTY', current_report_id = NULL WHERE code = ?", (emp_code,))

    if not active_report_id:
        return {"status": "Employee set off duty, no active case"}

    cursor.execute(
        "UPDATE assignments SET active_flag = 0, end_reason = 'HANDLER_UNAVAILABLE' WHERE employee_code = ? AND active_flag = 1",
        (emp_code,)
    )

    cursor.execute("SELECT * FROM reports WHERE id = ?", (active_report_id,))
    report = cursor.fetchone()
    if not report:
        return {"status": "Employee set off duty"}

    old_status = report["status"]
    if old_status == "In Progress":
        update_report_status(conn, active_report_id, "Pending", "Assigned employee went OFF_DUTY while In Progress", queue_type="WAITING")
        cursor.execute("UPDATE reports SET current_assignment_id = NULL WHERE id = ?", (active_report_id,))
        record_routing_log(
            conn, active_report_id, "BACKUP_REASSIGN", report["priority"], None, None, None, None,
            f"Employee {emp_code} went OFF_DUTY during In Progress; case returned to waiting queue", sim_time
        )
        drain_waiting_queue(conn)
        return {"status": "Case returned to Pending waiting queue", "report_id": active_report_id}
    else:  # Assigned
        cursor.execute("UPDATE reports SET current_assignment_id = NULL WHERE id = ?", (active_report_id,))
        update_report_status(conn, active_report_id, "Pending", "Assigned employee went OFF_DUTY; seeking backup", queue_type="WAITING")
        res = dispatch_report(conn, active_report_id)
        record_routing_log(
            conn, active_report_id, "BACKUP_REASSIGN", report["priority"], None, None, None, None,
            f"Employee {emp_code} went OFF_DUTY; backup dispatch resulted in {res['decision']}", sim_time
        )
        return {"status": "Backup reassignment attempted", "report_id": active_report_id, "result": res}
