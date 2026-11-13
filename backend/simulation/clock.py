"""Simulation Clock and Autonomous Event Processor (BCS502/BCS503).

Owns the simulation clock in simulated minutes.
Handles:
- Travel time simulation (employee arriving on site)
- Auto mode: work starts 1 minute after arrival, runs for category duration + deterministic jitter
- Resolution of jobs: updating meter reading and triggering RETURNING travel
- Employee journey home and becoming IDLE
- Triggering waiting queue draining when capacity / employees free up
"""

import json
import logging
import threading
import time
from typing import Any, Dict, List, Optional
from ..db.store import get_connection, get_global_lock
from ..dispatch.engine import (
    calculate_job_duration,
    drain_waiting_queue,
    record_routing_log,
    update_report_status,
)
from ..classifier.rules import parse_reading_hundredths

logger = logging.getLogger("gridwatch.simulation.clock")

_ticker_thread: Optional[threading.Thread] = None
_ticker_stop_event = threading.Event()


def get_sim_state_dict(conn) -> Dict[str, Any]:
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sim_state WHERE id = 1")
    row = cursor.fetchone()
    if not row:
        return {"clock_minutes": 540, "speed": 1.0, "is_running": 0, "mode": "auto"}
    return dict(row)


def advance_sim_clock(minutes: int = 1) -> Dict[str, Any]:
    """Advances simulation clock by `minutes` and processes all time-triggered

    events.
    """
    if minutes <= 0:
        minutes = 1

    events_triggered = []

    with get_global_lock():
        conn = get_connection()
        try:
            cursor = conn.cursor()
            state = get_sim_state_dict(conn)
            current_clock = state["clock_minutes"]
            target_clock = current_clock + minutes
            mode = state["mode"]

            # Advance minute-by-minute to strictly handle chronological order
            for step_time in range(current_clock + 1, target_clock + 1):
                cursor.execute("UPDATE sim_state SET clock_minutes = ? WHERE id = 1", (step_time,))

                # 1. Check RETURNING employees who arrive back home
                cursor.execute(
                    """SELECT a.*, e.code as emp_code, e.home_grid as emp_home
                       FROM assignments a
                       JOIN employees e ON a.employee_code = e.code
                       WHERE e.state = 'RETURNING' AND a.returned_time IS NOT NULL 
                             AND a.returned_time <= ?""",
                    (step_time,)
                )
                returning_done = [dict(r) for r in cursor.fetchall()]
                for ret in returning_done:
                    emp_code = ret["emp_code"]
                    home = ret["emp_home"]
                    cursor.execute(
                        """UPDATE employees 
                           SET state = 'IDLE', location = ?, current_report_id = NULL 
                           WHERE code = ? AND state = 'RETURNING'""",
                        (home, emp_code)
                    )
                    record_routing_log(
                        conn, ret["report_id"], "EMPLOYEE_RETURNED", None, None, home, emp_code,
                        None, f"Employee {emp_code} completed return journey to home grid {home}", step_time
                    )
                    events_triggered.append(f"Employee {emp_code} arrived back at {home}")
                    drain_waiting_queue(conn)

                if mode == "auto":
                    # 2. Check active assignments where employee arrived
                    cursor.execute(
                        """SELECT a.*, r.category, r.sequence, r.status, r.current_reading, r.meter_id, e.location as emp_loc
                           FROM assignments a
                           JOIN reports r ON a.report_id = r.id
                           JOIN employees e ON a.employee_code = e.code
                           WHERE a.active_flag = 1"""
                    )
                    active_assignments = [dict(r) for r in cursor.fetchall()]

                    for assign in active_assignments:
                        assign_id = assign["id"]
                        rep_id = assign["report_id"]
                        emp_code = assign["employee_code"]
                        rep_status = assign["status"]
                        arr_time = assign["arrived_time"]
                        start_time = assign["started_time"]
                        fin_time = assign["finished_time"]

                        # A. Employee Arrival
                        if arr_time is not None and step_time >= arr_time and start_time is None:
                            duration = calculate_job_duration(assign["category"], assign["sequence"])
                            planned_start = arr_time + 1
                            planned_finish = planned_start + duration
                            cursor.execute(
                                """UPDATE assignments 
                                   SET started_time = ?, finished_time = ? 
                                   WHERE id = ?""",
                                (planned_start, planned_finish, assign_id)
                            )
                            cursor.execute("UPDATE employees SET location = ? WHERE code = ?", (assign["source_grid"], emp_code))
                            start_time = planned_start
                            fin_time = planned_finish

                        # B. Work Starts (1 min after arrival)
                        if start_time is not None and step_time >= start_time and rep_status == "Assigned":
                            update_report_status(conn, rep_id, "In Progress", "Work started automatically on site")
                            cursor.execute("UPDATE employees SET state = 'WORKING' WHERE code = ?", (emp_code,))
                            events_triggered.append(f"Work started on report {rep_id} by {emp_code}")
                            rep_status = "In Progress"

                        # C. Work Completes / Resolves
                        if fin_time is not None and step_time >= fin_time and rep_status == "In Progress":
                            # Resolve report
                            update_report_status(conn, rep_id, "Resolved", "Auto work duration elapsed; job resolved")
                            events_triggered.append(f"Report {rep_id} resolved by {emp_code}")

                            # Update meter's last reading with report's current reading
                            try:
                                hundredths = parse_reading_hundredths(assign["current_reading"])
                                cursor.execute(
                                    "UPDATE meters SET last_reading_hundredths = ? WHERE meter_id = ?",
                                    (hundredths, assign["meter_id"])
                                )
                            except Exception as e:
                                logger.error("Failed to update meter reading: %s", e)

                            # Finish assignment
                            is_remote = (assign["home_grid"] != assign["source_grid"])
                            if is_remote:
                                return_cost = assign["route_cost"]
                                ret_time = step_time + return_cost
                                cursor.execute(
                                    """UPDATE assignments 
                                       SET active_flag = 0, end_reason = 'RESOLVED', returned_time = ? 
                                       WHERE id = ?""",
                                    (ret_time, assign_id)
                                )
                                cursor.execute(
                                    """UPDATE employees 
                                       SET state = 'RETURNING', current_report_id = NULL 
                                       WHERE code = ?""",
                                    (emp_code,)
                                )
                                record_routing_log(
                                    conn, rep_id, "RETURNING", None, assign["source_grid"], assign["home_grid"],
                                    emp_code, None, f"Job resolved. Employee {emp_code} returning to {assign['home_grid']} (ETA: {return_cost}m)", step_time
                                )
                            else:
                                cursor.execute(
                                    """UPDATE assignments 
                                       SET active_flag = 0, end_reason = 'RESOLVED', returned_time = ? 
                                       WHERE id = ?""",
                                    (step_time, assign_id)
                                )
                                cursor.execute(
                                    """UPDATE employees 
                                       SET state = 'IDLE', location = ?, current_report_id = NULL 
                                       WHERE code = ?""",
                                    (assign["home_grid"], emp_code)
                                )
                                # Local employee is now IDLE; drain waiting queue!
                                drain_waiting_queue(conn)

            conn.commit()
            return {
                "previous_clock": current_clock,
                "current_clock": target_clock,
                "minutes_advanced": minutes,
                "events": events_triggered
            }
        finally:
            conn.close()


def _background_ticker_loop():
    """Background ticker loop for running simulation in real time."""
    logger.info("Background simulation ticker started.")
    while not _ticker_stop_event.is_set():
        with get_global_lock():
            conn = get_connection()
            try:
                state = get_sim_state_dict(conn)
                is_running = state["is_running"]
                speed = max(0.1, float(state["speed"]))
            finally:
                conn.close()

        if is_running:
            advance_sim_clock(1)

        # Sleep interval: 1 simulated minute per (1.0 / speed) real seconds
        sleep_interval = 1.0 / speed
        _ticker_stop_event.wait(timeout=max(0.05, sleep_interval))


def start_ticker_thread():
    global _ticker_thread
    if _ticker_thread is None or not _ticker_thread.is_alive():
        _ticker_stop_event.clear()
        _ticker_thread = threading.Thread(target=_background_ticker_loop, daemon=True)
        _ticker_thread.start()


def stop_ticker_thread():
    _ticker_stop_event.set()
