"""Flask API Routes and SSE streaming endpoint for GridWatch."""

import csv
import io
import json
import logging
import os
import threading
import time
from flask import Blueprint, Response, jsonify, request, stream_with_context
from ..automata.definitions import get_all_automata_metadata
from ..automata.compare import compare_meter_id, compare_reading, compare_event_code
from ..classifier.rules import parse_reading_hundredths
from ..db.store import get_connection, get_global_lock, query_all, query_one, init_db
from ..dispatch.engine import (
    get_active_graph,
    get_current_sim_time,
    get_sim_mode,
    handle_employee_off_duty,
    drain_waiting_queue,
)
from ..simulation.clock import advance_sim_clock, get_sim_state_dict
from .intake import validate_report_payload, ingest_report, ingest_batch_reports
from .actions import (
    fix_report_zone,
    change_report_priority,
    manual_start_work,
    manual_resolve_work,
)
from .scenarios import run_scenario
from .test_runner import run_all_tests_live

logger = logging.getLogger("gridwatch.api.routes")
api_bp = Blueprint("api", __name__)

# -------------------------------------------------------------
# 0. Tab Heartbeat & Auto-Shutdown Watchdog
# -------------------------------------------------------------
_last_heartbeat = 0
_has_connected = False
_watchdog_started = False


def _watchdog_loop():
    global _last_heartbeat, _has_connected
    while True:
        time.sleep(1.0)
        if _has_connected:
            elapsed = time.time() - _last_heartbeat
            if elapsed > 4.0:
                print("\n[GridWatch] Browser tab closed. Shutting down server automatically...")
                os._exit(0)


def start_heartbeat_watchdog():
    global _watchdog_started
    if not _watchdog_started:
        _watchdog_started = True
        t = threading.Thread(target=_watchdog_loop, daemon=True)
        t.start()


@api_bp.route("/heartbeat", methods=["POST"])
def client_heartbeat():
    global _last_heartbeat, _has_connected
    _last_heartbeat = time.time()
    _has_connected = True
    start_heartbeat_watchdog()
    return jsonify({"status": "alive"})


@api_bp.route("/shutdown", methods=["POST"])
def manual_shutdown():
    def kill_soon():
        time.sleep(0.5)
        print("\n[GridWatch] Shutdown received. Exiting...")
        os._exit(0)
    threading.Thread(target=kill_soon, daemon=True).start()
    return jsonify({"status": "shutting down"})


# -------------------------------------------------------------
# 1. Automata and Validation
# -------------------------------------------------------------
@api_bp.route("/automata", methods=["GET"])
def get_automata():
    """Returns definitions, states, transitions and regex twins for all DFAs."""
    return jsonify(get_all_automata_metadata())


@api_bp.route("/automata/simulate", methods=["POST"])
def simulate_automaton():
    """Authoritative Python DFA simulation and regex comparison."""
    data = request.get_json(silent=True) or {}
    automaton_type = data.get("type", "meter_id")
    input_str = data.get("input", "")

    if automaton_type == "reading":
        return jsonify(compare_reading(input_str))
    elif automaton_type == "event_code":
        return jsonify(compare_event_code(input_str))
    else:
        return jsonify(compare_meter_id(input_str))


@api_bp.route("/validate", methods=["POST"])
def validate_input():
    """Performs live character-by-character validation with DFA traces without persisting."""
    data = request.get_json(silent=True) or {}
    threshold_setting = query_one("SELECT value FROM settings WHERE key = 'consumption_threshold'")
    val = float(threshold_setting["value"]) if threshold_setting else 200.00
    res = validate_report_payload(data, int(round(val * 100)))
    return jsonify(res)


# -------------------------------------------------------------
# 2. Reports Intake & Management
# -------------------------------------------------------------
@api_bp.route("/reports", methods=["POST"])
def create_report():
    data = request.get_json(silent=True) or {}
    res = ingest_report(data)
    status_code = 201 if res.get("validation_status") == "VALID" else 422
    return jsonify(res), status_code


@api_bp.route("/reports/batch", methods=["POST"])
def create_reports_batch():
    data = request.get_json(silent=True) or []
    if not isinstance(data, list):
        return jsonify({"error": "Payload must be a JSON array of reports"}), 400
    res = ingest_batch_reports(data)
    return jsonify(res), 200


@api_bp.route("/reports", methods=["GET"])
def list_reports():
    status_filter = request.args.get("status")
    category_filter = request.args.get("category")
    priority_filter = request.args.get("priority")
    zone_filter = request.args.get("zone")
    queue_filter = request.args.get("queue")

    query = "SELECT * FROM reports WHERE 1=1"
    params = []

    if status_filter:
        query += " AND status = ?"
        params.append(status_filter)
    if category_filter:
        query += " AND category = ?"
        params.append(category_filter)
    if priority_filter:
        query += " AND priority = ?"
        params.append(priority_filter)
    if zone_filter:
        query += " AND (zone_letter = ? OR source_grid = ?)"
        params.extend([zone_filter, zone_filter])
    if queue_filter:
        query += " AND queue_type = ?"
        params.append(queue_filter)

    query += " ORDER BY sequence DESC"
    reports = query_all(query, tuple(params))
    return jsonify(reports)


@api_bp.route("/reports/<report_id>", methods=["GET"])
def get_report_detail(report_id):
    rep = query_one("SELECT * FROM reports WHERE id = ?", (report_id,))
    if not rep:
        return jsonify({"error": "Report not found"}), 404

    assignment = query_one("SELECT * FROM assignments WHERE report_id = ? AND active_flag = 1", (report_id,))
    history = query_all("SELECT * FROM status_history WHERE report_id = ? ORDER BY time ASC", (report_id,))
    priorities = query_all("SELECT * FROM priority_history WHERE report_id = ? ORDER BY time ASC", (report_id,))
    logs = query_all("SELECT * FROM routing_log WHERE report_id = ? ORDER BY time ASC", (report_id,))

    return jsonify({
        "report": rep,
        "current_assignment": assignment,
        "status_history": history,
        "priority_history": priorities,
        "routing_log": logs
    })


@api_bp.route("/reports/<report_id>/priority", methods=["POST"])
def update_priority(report_id):
    data = request.get_json(silent=True) or {}
    new_priority = data.get("priority")
    reason = data.get("reason", "Operator priority modification")
    res = change_report_priority(report_id, new_priority, reason)
    status_code = res.get("status_code", 200)
    return jsonify(res), status_code


@api_bp.route("/reports/<report_id>/start", methods=["POST"])
def start_work_route(report_id):
    res = manual_start_work(report_id)
    return jsonify(res), res.get("status_code", 200)


@api_bp.route("/reports/<report_id>/resolve", methods=["POST"])
def resolve_work_route(report_id):
    res = manual_resolve_work(report_id)
    return jsonify(res), res.get("status_code", 200)


@api_bp.route("/reports/<report_id>/fix-zone", methods=["POST"])
def fix_zone_route(report_id):
    data = request.get_json(silent=True) or {}
    zone_key = data.get("zone_key") or data.get("zone")
    reason = data.get("reason", "Operator manual zone correction")
    res = fix_report_zone(report_id, zone_key, reason)
    return jsonify(res), res.get("status_code", 200)


# -------------------------------------------------------------
# 3. Network, Routing Table & Grids
# -------------------------------------------------------------
@api_bp.route("/zones", methods=["GET"])
def get_zones():
    zones = query_all("SELECT * FROM zones ORDER BY key ASC")
    return jsonify(zones)


@api_bp.route("/zones", methods=["PUT"])
def update_zones():
    data = request.get_json(silent=True) or []
    with get_global_lock():
        conn = get_connection()
        try:
            cursor = conn.cursor()
            for z in data:
                cursor.execute(
                    """UPDATE zones SET station_code = ?, name = ?, depot = ?, authority = ?, capacity = ?, map_x = ?, map_y = ? 
                       WHERE key = ?""",
                    (z.get("station_code"), z.get("name"), z.get("depot"), z.get("authority"), z.get("capacity", 6), z.get("map_x"), z.get("map_y"), z.get("key"))
                )
            conn.commit()
            return jsonify({"status": "success", "message": "Zones updated"})
        finally:
            conn.close()


@api_bp.route("/grids/<letter>", methods=["PATCH"])
def patch_grid_capacity(letter):
    data = request.get_json(silent=True) or {}
    new_capacity = data.get("capacity")
    if new_capacity is None or not (0 <= int(new_capacity) <= 6):
        return jsonify({"error": "Capacity must be an integer between 0 and 6"}), 400

    with get_global_lock():
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("UPDATE zones SET capacity = ? WHERE key = ? OR station_code = ?", (int(new_capacity), letter, letter))
            drain_waiting_queue(conn)
            conn.commit()
            return jsonify({"status": "success", "zone": letter, "capacity": int(new_capacity)})
        finally:
            conn.close()


@api_bp.route("/edges", methods=["GET"])
def get_edges():
    edges = query_all("SELECT * FROM edges")
    return jsonify(edges)


@api_bp.route("/edges", methods=["PUT"])
def update_edges():
    data = request.get_json(silent=True) or []
    with get_global_lock():
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM edges")
            for e in data:
                cursor.execute(
                    "INSERT INTO edges (from_station, to_station, weight) VALUES (?, ?, ?)",
                    (e["from_station"], e["to_station"], int(e["weight"]))
                )
            conn.commit()
            return jsonify({"status": "success", "message": "Edges updated successfully"})
        finally:
            conn.close()


@api_bp.route("/routing-table", methods=["GET"])
def get_routing_table():
    conn = get_connection()
    try:
        g = get_active_graph(conn)
        res = g.compute_all_pairs_routing_table()
        return jsonify(res)
    finally:
        conn.close()


# -------------------------------------------------------------
# 4. Employees & Crews
# -------------------------------------------------------------
@api_bp.route("/employees", methods=["GET"])
def get_employees():
    employees = query_all("SELECT * FROM employees ORDER BY home_grid ASC, code ASC")
    return jsonify(employees)


@api_bp.route("/employees/<code>", methods=["PATCH"])
def patch_employee(code):
    data = request.get_json(silent=True) or {}
    available = data.get("available_flag")
    new_state = data.get("state")

    with get_global_lock():
        conn = get_connection()
        try:
            cursor = conn.cursor()
            if available == 0 or new_state == "OFF_DUTY":
                res = handle_employee_off_duty(conn, code)
                conn.commit()
                return jsonify(res)
            else:
                cursor.execute(
                    "UPDATE employees SET available_flag = 1, state = 'IDLE' WHERE code = ?",
                    (code,)
                )
                drain_waiting_queue(conn)
                conn.commit()
                return jsonify({"status": "success", "employee": code, "state": "IDLE"})
        finally:
            conn.close()


# -------------------------------------------------------------
# 5. Simulation Controls
# -------------------------------------------------------------
@api_bp.route("/sim/play", methods=["POST"])
def sim_play():
    with get_global_lock():
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("UPDATE sim_state SET is_running = 1 WHERE id = 1")
            conn.commit()
            return jsonify({"status": "success", "is_running": 1})
        finally:
            conn.close()


@api_bp.route("/sim/pause", methods=["POST"])
def sim_pause():
    with get_global_lock():
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("UPDATE sim_state SET is_running = 0 WHERE id = 1")
            conn.commit()
            return jsonify({"status": "success", "is_running": 0})
        finally:
            conn.close()


@api_bp.route("/sim/speed", methods=["POST"])
def sim_speed():
    data = request.get_json(silent=True) or {}
    speed = float(data.get("speed", 1.0))
    speed = max(0.5, min(20.0, speed))
    with get_global_lock():
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("UPDATE sim_state SET speed = ? WHERE id = 1", (speed,))
            conn.commit()
            return jsonify({"status": "success", "speed": speed})
        finally:
            conn.close()


@api_bp.route("/sim/advance", methods=["POST"])
def sim_advance():
    data = request.get_json(silent=True) or {}
    minutes = int(data.get("minutes", 1))
    res = advance_sim_clock(minutes)
    return jsonify(res)


@api_bp.route("/sim/reset", methods=["POST"])
def sim_reset():
    res = run_scenario("reset")
    return jsonify(res)


@api_bp.route("/scenarios/<name>", methods=["POST"])
def trigger_scenario(name):
    res = run_scenario(name)
    return jsonify(res)


# -------------------------------------------------------------
# 6. Full State Snapshot & SSE Stream
# -------------------------------------------------------------
def build_full_state_snapshot():
    conn = get_connection()
    try:
        cursor = conn.cursor()
        sim = get_sim_state_dict(conn)

        cursor.execute("SELECT * FROM zones ORDER BY key ASC")
        zones = [dict(r) for r in cursor.fetchall()]

        cursor.execute("SELECT * FROM edges")
        edges = [dict(r) for r in cursor.fetchall()]

        cursor.execute("SELECT * FROM employees ORDER BY home_grid ASC, code ASC")
        employees = [dict(r) for r in cursor.fetchall()]

        cursor.execute("SELECT * FROM reports ORDER BY sequence DESC LIMIT 100")
        reports = [dict(r) for r in cursor.fetchall()]

        cursor.execute("SELECT * FROM assignments WHERE active_flag = 1")
        active_assignments = [dict(r) for r in cursor.fetchall()]

        cursor.execute("SELECT * FROM routing_log ORDER BY id DESC LIMIT 50")
        recent_logs = [dict(r) for r in cursor.fetchall()]

        # Status counts
        cursor = conn.cursor()
        cursor.execute("SELECT status, COUNT(*) as c FROM reports WHERE validation_status = 'VALID' GROUP BY status")
        status_counts = {r["status"]: r["c"] for r in cursor.fetchall()}

        # Waiting vs correction
        cursor.execute("SELECT queue_type, COUNT(*) as c FROM reports WHERE status = 'Pending' GROUP BY queue_type")
        queue_counts = {r["queue_type"]: r["c"] for r in cursor.fetchall()}

        # Category counts
        cursor.execute("SELECT category, COUNT(*) as c FROM reports WHERE validation_status = 'VALID' GROUP BY category")
        category_counts = {r["category"]: r["c"] for r in cursor.fetchall()}

        # Priority counts
        cursor.execute("SELECT priority, COUNT(*) as c FROM reports WHERE validation_status = 'VALID' GROUP BY priority")
        priority_counts = {r["priority"]: r["c"] for r in cursor.fetchall()}

        # Zone loads
        cursor.execute("SELECT source_grid, COUNT(*) as c FROM reports WHERE status IN ('Assigned', 'In Progress') GROUP BY source_grid")
        zone_loads = {r["source_grid"]: r["c"] for r in cursor.fetchall() if r["source_grid"]}

        # Settings
        cursor.execute("SELECT key, value FROM settings")
        settings = {r["key"]: r["value"] for r in cursor.fetchall()}

        return {
            "sim_state": sim,
            "zones": zones,
            "edges": edges,
            "employees": employees,
            "reports": reports,
            "active_assignments": active_assignments,
            "recent_logs": recent_logs,
            "settings": settings,
            "metrics": {
                "total_reports": len(reports),
                "status_counts": status_counts,
                "queue_counts": queue_counts,
                "category_counts": category_counts,
                "priority_counts": priority_counts,
                "zone_loads": zone_loads
            }
        }
    finally:
        conn.close()


@api_bp.route("/state", methods=["GET"])
def get_state():
    return jsonify(build_full_state_snapshot())


@api_bp.route("/stream", methods=["GET"])
def event_stream():
    """Server-Sent Events (SSE) live push stream."""
    def generate():
        while True:
            try:
                state = build_full_state_snapshot()
                data_str = json.dumps(state)
                yield f"data: {data_str}\n\n"
            except Exception as e:
                logger.error("SSE stream error: %s", e)
            time.sleep(1.0)

    return Response(stream_with_context(generate()), mimetype="text/event-stream")


# -------------------------------------------------------------
# 7. Analytics & Logs with CSV Export
# -------------------------------------------------------------
@api_bp.route("/analytics", methods=["GET"])
def get_analytics():
    conn = get_connection()
    try:
        cursor = conn.cursor()
        # Zone distribution
        cursor.execute("SELECT zone_letter, source_grid, COUNT(*) as total FROM reports WHERE validation_status = 'VALID' GROUP BY zone_letter, source_grid")
        by_zone = [dict(r) for r in cursor.fetchall()]

        # Category distribution
        cursor.execute("SELECT category, COUNT(*) as total FROM reports WHERE validation_status = 'VALID' GROUP BY category")
        by_cat = [dict(r) for r in cursor.fetchall()]

        # Priority distribution
        cursor.execute("SELECT priority, COUNT(*) as total FROM reports WHERE validation_status = 'VALID' GROUP BY priority")
        by_priority = [dict(r) for r in cursor.fetchall()]

        # Decisions breakdown
        cursor.execute("SELECT decision, COUNT(*) as total FROM routing_log GROUP BY decision")
        decisions = [dict(r) for r in cursor.fetchall()]

        # Rejection breakdown
        cursor.execute("SELECT rejection_code, COUNT(*) as total FROM reports WHERE validation_status = 'REJECTED' GROUP BY rejection_code")
        rejections = [dict(r) for r in cursor.fetchall()]

        return jsonify({
            "by_zone": by_zone,
            "by_category": by_cat,
            "by_priority": by_priority,
            "decisions": decisions,
            "rejections": rejections
        })
    finally:
        conn.close()


@api_bp.route("/logs", methods=["GET"])
def get_logs():
    export_format = request.args.get("format", "json").lower()
    logs = query_all("SELECT * FROM routing_log ORDER BY id DESC LIMIT 500")

    if export_format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["ID", "Sim Time (min)", "Report ID", "Decision", "Priority", "From Grid", "To Grid", "Employee", "Route", "Reason"])
        for l in logs:
            writer.writerow([
                l["id"], l["time"], l["report_id"], l["decision"], l["priority"],
                l["from_grid"], l["to_grid"], l["employee_code"], l["route"], l["reason_text"]
            ])
        csv_data = output.getvalue()
        return Response(
            csv_data,
            mimetype="text/csv",
            headers={"Content-Disposition": "attachment;filename=gridwatch_routing_logs.csv"}
        )

    return jsonify(logs)


# -------------------------------------------------------------
# 8. Test Lab Runner
# -------------------------------------------------------------
@api_bp.route("/tests/run", methods=["GET"])
def run_tests_route():
    report = run_all_tests_live()
    return jsonify(report)


# -------------------------------------------------------------
# 9. Settings
# -------------------------------------------------------------
@api_bp.route("/settings", methods=["GET"])
def get_settings():
    settings = query_all("SELECT * FROM settings")
    return jsonify({s["key"]: s["value"] for s in settings})


@api_bp.route("/settings", methods=["PUT"])
def update_settings():
    data = request.get_json(silent=True) or {}
    with get_global_lock():
        conn = get_connection()
        try:
            cursor = conn.cursor()
            for k, v in data.items():
                cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (str(k), str(v)))
            conn.commit()
            return jsonify({"status": "success", "message": "Settings updated"})
        finally:
            conn.close()
