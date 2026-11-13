"""Operator and Workflow Actions for GridWatch."""

import json
import logging
from typing import Any, Dict, Optional
from ..db.store import get_connection, get_global_lock, query_one
from ..dispatch.engine import (
    dispatch_report,
    drain_waiting_queue,
    update_report_status,
    handle_employee_off_duty,
    record_routing_log,
    get_current_sim_time,
)
from ..classifier.rules import parse_reading_hundredths

logger = logging.getLogger("gridwatch.api.actions")


def fix_report_zone(report_id: str, mapped_zone_key: str, reason: str = "Operator manual zone correction") -> Dict[str, Any]:
    """Maps an unknown zone report in the Correction Queue to a valid zone and re-

    dispatches.
    """
    with get_global_lock():
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM reports WHERE id = ?", (report_id,))
            report = cursor.fetchone()
            if not report:
                return {"error": f"Report {report_id} not found", "status_code": 404}

            if report["queue_type"] != "CORRECTION":
                return {"error": f"Report {report_id} is not in the Correction Queue", "status_code": 400}

            cursor.execute("SELECT * FROM zones WHERE key = ? OR station_code = ?", (mapped_zone_key, mapped_zone_key))
            zone_row = cursor.fetchone()
            if not zone_row:
                return {"error": f"Target zone '{mapped_zone_key}' does not exist", "status_code": 400}

            valid_key = zone_row["key"]
            station = zone_row["station_code"]
            old_meter_id = report["meter_id"]
            new_meter_id = old_meter_id[:4] + valid_key + old_meter_id[5:] if len(old_meter_id) == 9 else old_meter_id

            cursor.execute(
                """UPDATE reports 
                   SET meter_id = ?, zone_letter = ?, source_grid = ?, queue_type = 'WAITING' 
                   WHERE id = ?""",
                (new_meter_id, valid_key, station, report_id)
            )

            sim_time = get_current_sim_time(conn)
            record_routing_log(
                conn, report_id, "ZONE_CORRECTED", report["priority"], None, station, None, None,
                f"Zone corrected from '{report['zone_letter']}' to '{valid_key}' ({station}): {reason}", sim_time
            )

            # Re-dispatch report
            res = dispatch_report(conn, report_id)
            conn.commit()
            return {"success": True, "report_id": report_id, "dispatch": res}
        finally:
            conn.close()


def change_report_priority(report_id: str, new_priority: str, reason: str) -> Dict[str, Any]:
    """Escalates or de-escalates priority for an unresolved report.

    - Escalation re-sorts waiting queue and can trigger P1 override
    - De-escalation re-sorts waiting queue and never removes an assigned employee
    """
    if new_priority not in ("P1", "P2", "P3", "P4"):
        return {"error": f"Invalid priority '{new_priority}' (must be P1, P2, P3, or P4)", "status_code": 400}

    with get_global_lock():
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM reports WHERE id = ?", (report_id,))
            report = cursor.fetchone()
            if not report:
                return {"error": f"Report {report_id} not found", "status_code": 404}

            if report["status"] == "Resolved":
                return {"error": "Cannot change priority of a resolved report", "status_code": 400}

            old_priority = report["priority"]
            sim_time = get_current_sim_time(conn)

            cursor.execute("UPDATE reports SET priority = ? WHERE id = ?", (new_priority, report_id))
            cursor.execute(
                """INSERT INTO priority_history (report_id, time, old_priority, new_priority, reason)
                   VALUES (?, ?, ?, ?, ?)""",
                (report_id, sim_time, old_priority, new_priority, reason)
            )

            p_order = {"P1": 1, "P2": 2, "P3": 3, "P4": 4}
            decision_type = "PRIORITY_ESCALATED" if p_order[new_priority] < p_order[old_priority] else "PRIORITY_DEESCALATED"
            record_routing_log(
                conn, report_id, decision_type, new_priority, None, report["source_grid"], None, None,
                f"Priority changed from {old_priority} to {new_priority}: {reason}", sim_time
            )

            # If report is still in waiting queue, re-drain queue (or trigger P1 override if now P1)
            if report["status"] == "Pending" and report["queue_type"] == "WAITING":
                res = dispatch_report(conn, report_id)
                drain_waiting_queue(conn)
            else:
                drain_waiting_queue(conn)

            conn.commit()
            return {"success": True, "report_id": report_id, "old_priority": old_priority, "new_priority": new_priority}
        finally:
            conn.close()


def manual_start_work(report_id: str) -> Dict[str, Any]:
    """Operator manual action: start work on an Assigned report."""
    with get_global_lock():
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM reports WHERE id = ?", (report_id,))
            report = cursor.fetchone()
            if not report:
                return {"error": "Report not found", "status_code": 404}

            if report["status"] != "Assigned":
                return {"error": f"Report status must be 'Assigned' to start work, got '{report['status']}'", "status_code": 409}

            sim_time = get_current_sim_time(conn)
            cursor.execute(
                "SELECT * FROM assignments WHERE report_id = ? AND active_flag = 1",
                (report_id,)
            )
            assignment = cursor.fetchone()
            if not assignment:
                return {"error": "No active assignment found for report", "status_code": 404}

            ok, err = update_report_status(conn, report_id, "In Progress", "Work started manually by operator")
            if not ok:
                return {"error": err, "status_code": 409}

            cursor.execute("UPDATE assignments SET started_time = ? WHERE id = ?", (sim_time, assignment["id"]))
            cursor.execute("UPDATE employees SET state = 'WORKING' WHERE code = ?", (assignment["employee_code"],))

            conn.commit()
            return {"success": True, "report_id": report_id, "status": "In Progress"}
        finally:
            conn.close()


def manual_resolve_work(report_id: str) -> Dict[str, Any]:
    """Operator manual action: resolve an In Progress report."""
    with get_global_lock():
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM reports WHERE id = ?", (report_id,))
            report = cursor.fetchone()
            if not report:
                return {"error": "Report not found", "status_code": 404}

            if report["status"] != "In Progress":
                return {"error": f"Report status must be 'In Progress' to resolve, got '{report['status']}'", "status_code": 409}

            sim_time = get_current_sim_time(conn)
            cursor.execute(
                "SELECT * FROM assignments WHERE report_id = ? AND active_flag = 1",
                (report_id,)
            )
            assignment = cursor.fetchone()
            if not assignment:
                return {"error": "No active assignment found for report", "status_code": 404}

            ok, err = update_report_status(conn, report_id, "Resolved", "Work resolved manually by operator")
            if not ok:
                return {"error": err, "status_code": 409}

            # Update meter last reading
            try:
                hundredths = parse_reading_hundredths(report["current_reading"])
                cursor.execute(
                    "UPDATE meters SET last_reading_hundredths = ? WHERE meter_id = ?",
                    (hundredths, report["meter_id"])
                )
            except Exception as e:
                logger.error("Failed to update meter reading on manual resolve: %s", e)

            # Finish assignment
            emp_code = assignment["employee_code"]
            is_remote = (assignment["home_grid"] != assignment["source_grid"])
            if is_remote:
                return_cost = assignment["route_cost"]
                ret_time = sim_time + return_cost
                cursor.execute(
                    """UPDATE assignments 
                       SET active_flag = 0, end_reason = 'RESOLVED', finished_time = ?, returned_time = ? 
                       WHERE id = ?""",
                    (sim_time, ret_time, assignment["id"])
                )
                cursor.execute(
                    """UPDATE employees 
                       SET state = 'RETURNING', current_report_id = NULL 
                       WHERE code = ?""",
                    (emp_code,)
                )
                record_routing_log(
                    conn, report_id, "RETURNING", None, assignment["source_grid"], assignment["home_grid"],
                    emp_code, None, f"Resolved manually. Employee {emp_code} returning to {assignment['home_grid']}", sim_time
                )
            else:
                cursor.execute(
                    """UPDATE assignments 
                       SET active_flag = 0, end_reason = 'RESOLVED', finished_time = ?, returned_time = ? 
                       WHERE id = ?""",
                    (sim_time, sim_time, assignment["id"])
                )
                cursor.execute(
                    """UPDATE employees 
                       SET state = 'IDLE', location = ?, current_report_id = NULL 
                       WHERE code = ?""",
                    (assignment["home_grid"], emp_code)
                )
                drain_waiting_queue(conn)

            conn.commit()
            return {"success": True, "report_id": report_id, "status": "Resolved"}
        finally:
            conn.close()
