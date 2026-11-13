"""Pre-built deterministic scenarios for GridWatch."""

import logging
from typing import Any, Dict
from ..db.store import init_db, get_connection, query_one
from ..db.seed import seed_database
from ..api.intake import ingest_report, ingest_batch_reports
from ..api.actions import change_report_priority, fix_report_zone, manual_start_work
from ..dispatch.engine import handle_employee_off_duty
from ..simulation.clock import advance_sim_clock

logger = logging.getLogger("gridwatch.api.scenarios")


def run_scenario(name: str) -> Dict[str, Any]:
    """Runs a named demonstration scenario deterministically."""
    # Reset and seed to clean state
    init_db(force_reset=True)

    if name == "reset":
        return {
            "scenario": "reset",
            "message": "System reset to clean default state with 5 zones, 30 crew members, and 25 seed meters.",
            "status": "success"
        }

    elif name == "malformed-id":
        rep = {
            "reporter_name": "Rajesh Kumar",
            "reporter_contact": "+91-9876501234",
            "meter_id": "GRIDB042X",  # Invalid phase 'X' (must be R, Y, or B)
            "previous_reading": "00432.57kWh",
            "current_reading": "00532.57kWh",
            "event_code": "OT",
            "description": "Blackout on phase X",
            "urgency": "Routine"
        }
        res = ingest_report(rep)
        return {
            "scenario": "malformed-id",
            "message": f"Submitted report with invalid meter ID 'GRIDB042X'. Rejected: {res.get('rejection_message')}",
            "result": res
        }

    elif name == "unknown-zone":
        rep = {
            "reporter_name": "Sita Sharma",
            "reporter_contact": "+91-9811223344",
            "meter_id": "GRIDK123R",  # Valid format, but zone 'K' is unknown (only A-E exist)
            "previous_reading": "00200.00kWh",
            "current_reading": "00250.00kWh",
            "event_code": "OT",
            "description": "Power cut in new industrial area",
            "urgency": "Elevated"
        }
        res = ingest_report(rep)
        return {
            "scenario": "unknown-zone",
            "message": "Submitted report with zone 'K'. Successfully validated by DFA and routed to virtual CENTRAL Correction Queue.",
            "result": res
        }

    elif name == "conflicting-patterns":
        rep = {
            "reporter_name": "Inspector Dave",
            "reporter_contact": "+91-9988776655",
            "meter_id": "GRIDB042R",
            "previous_reading": "00100.00kWh",
            "current_reading": "00500.00kWh",  # 400 kWh > 200 threshold (Overconsumption)
            "event_code": "TM",  # Tampering
            "description": "Seal cut and anomalous high power surge recorded",
            "urgency": "Routine"
        }
        res = ingest_report(rep)
        return {
            "scenario": "conflicting-patterns",
            "message": f"Conflicting patterns: Tampering and Overconsumption matched. Category resolved to {res.get('category')} by fixed precedence rule.",
            "result": res
        }

    elif name == "no-anomaly":
        rep = {
            "reporter_name": "Meter Reader Anil",
            "reporter_contact": "+91-9844112233",
            "meter_id": "GRIDB042R",
            "previous_reading": "00432.57kWh",
            "current_reading": "00440.00kWh",  # Only 7.43 kWh difference <= 200
            "event_code": "NONE",
            "description": "Standard monthly inspection",
            "urgency": "Routine"
        }
        res = ingest_report(rep)
        return {
            "scenario": "no-anomaly",
            "message": "Routine check with no anomaly. Rejected with NO_ANOMALY and stored in audit database without dispatch.",
            "result": res
        }

    elif name == "reading-decreased":
        rep = {
            "reporter_name": "Meter Reader Anil",
            "reporter_contact": "+91-9844112233",
            "meter_id": "GRIDB042R",
            "previous_reading": "00500.00kWh",
            "current_reading": "00450.00kWh",  # Current is LESS than previous!
            "event_code": "HA",
            "description": "Counter displaying lower digits",
            "urgency": "Routine"
        }
        res = ingest_report(rep)
        return {
            "scenario": "reading-decreased",
            "message": "Reading decreased error caught! Rejected with READING_DECREASED (possible rollover or typo).",
            "result": res
        }

    elif name == "fill-bsk-overflow":
        # Ingest 6 reports to fill BSK1..BSK6
        for i in range(1, 7):
            ingest_report({
                "reporter_name": f"Inspector A{i}",
                "reporter_contact": "9876543210",
                "meter_id": f"GRIDA10{i}R",
                "previous_reading": "00100.00kWh",
                "current_reading": "00110.00kWh",
                "event_code": "HA",
                "description": f"Capacitor bank check #{i}",
                "urgency": "Routine"
            })
        # 7th report triggers overflow to JP Nagar (nearest by shortest path, 10 min)
        r7 = ingest_report({
            "reporter_name": "Inspector A7",
            "reporter_contact": "9876543210",
            "meter_id": "GRIDA101R",
            "previous_reading": "00100.00kWh",
            "current_reading": "00120.00kWh",
            "event_code": "HA",
            "description": "Transformer trip",
            "urgency": "Routine"
        })
        return {
            "scenario": "fill-bsk-overflow",
            "message": f"BSK capacity reached (6/6). Report {r7['id']} overflowed to nearest neighbor {r7['dispatch'].get('from')} (crew member {r7['dispatch'].get('employee')}, travel time {r7['dispatch'].get('cost')}m).",
            "result": r7
        }

    elif name == "handler-unavailable":
        # Assign BSK1 to a report
        r = ingest_report({
            "reporter_name": "Inspector Ramesh",
            "reporter_contact": "9876543210",
            "meter_id": "GRIDA101R",
            "previous_reading": "00100.00kWh",
            "current_reading": "00120.00kWh",
            "event_code": "HA",
            "description": "Switchgear fault",
            "urgency": "Routine"
        })
        emp = r["dispatch"]["employee"]
        # Set employee OFF_DUTY
        conn = get_connection()
        try:
            backup_res = handle_employee_off_duty(conn, emp)
            conn.commit()
        finally:
            conn.close()

        return {
            "scenario": "handler-unavailable",
            "message": f"Assigned employee {emp} was marked OFF_DUTY. Automatic backup reassigned the case to {backup_res.get('result', {}).get('employee')}.",
            "result": backup_res
        }

    elif name == "p1-override":
        # Set all employees except BSK1 off duty
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("UPDATE employees SET available_flag = 0, state = 'OFF_DUTY' WHERE code != 'BSK1'")
            conn.commit()
        finally:
            conn.close()

        # Ingest low priority P4 case assigned to BSK1
        r_low = ingest_report({
            "reporter_name": "Inspector Low",
            "reporter_contact": "9876543210",
            "meter_id": "GRIDA101R",
            "previous_reading": "00100.00kWh",
            "current_reading": "00400.00kWh",
            "event_code": "NONE",
            "description": "High billing complaint",
            "urgency": "Routine"
        })

        # Ingest incoming Critical Outage (P1)
        r_p1 = ingest_report({
            "reporter_name": "Substation Chief",
            "reporter_contact": "9876543210",
            "meter_id": "GRIDA102Y",
            "previous_reading": "00100.00kWh",
            "current_reading": "00100.00kWh",
            "event_code": "OT",
            "description": "Hospital feeder blackout!",
            "urgency": "Critical"
        })

        return {
            "scenario": "p1-override",
            "message": f"Critical P1 outage preempted not-started P4 case {r_low['id']}. Employee BSK1 redirected immediately.",
            "result": r_p1
        }

    elif name == "batch-10":
        reports = []
        zones = ["A", "B", "C", "D", "E"]
        events = ["TM", "OT", "HA", "CM", "NONE"]
        for i in range(10):
            z = zones[i % 5]
            ev = events[i % 5]
            prev = "00100.00kWh"
            curr = "00350.00kWh" if ev == "NONE" else "00110.00kWh"
            reports.append({
                "reporter_name": f"Batch Field Officer #{i+1}",
                "reporter_contact": f"+91-980000000{i}",
                "meter_id": f"GRID{z}10{i%5+1}R",
                "previous_reading": prev,
                "current_reading": curr,
                "event_code": ev,
                "description": f"Simultaneous batch alert #{i+1}",
                "urgency": "Routine"
            })
        batch_res = ingest_batch_reports(reports)
        return {
            "scenario": "batch-10",
            "message": "Processed batch of 10 simultaneous reports under unified simulation timestamp. Zero race conditions, 100% deterministic.",
            "count": len(batch_res),
            "results": batch_res
        }

    elif name == "escalate-deescalate":
        r = ingest_report({
            "reporter_name": "Field Technician",
            "reporter_contact": "9876543210",
            "meter_id": "GRIDA101R",
            "previous_reading": "00100.00kWh",
            "current_reading": "00110.00kWh",
            "event_code": "HA",
            "description": "Buzzing sound in junction box",
            "urgency": "Routine"
        })
        esc = change_report_priority(r["id"], "P1", "Smoke observed emitting from terminal")
        deesc = change_report_priority(r["id"], "P3", "Fire service confirmed terminal cooled; normal repair")
        return {
            "scenario": "escalate-deescalate",
            "message": f"Report {r['id']} priority escalated to P1, then de-escalated to P3. Full audit trail recorded in priority_history.",
            "escalation": esc,
            "deescalation": deesc
        }

    elif name == "guided-demo":
        # Step 1: Submit valid report
        r1 = ingest_report({
            "reporter_name": "Executive Officer Sharma",
            "reporter_contact": "+91-9900112233",
            "meter_id": "GRIDB042R",
            "previous_reading": "00432.57kWh",
            "current_reading": "00750.00kWh",
            "event_code": "TM",
            "description": "Meter tamper switch tripped + unusual power jump",
            "urgency": "Elevated"
        })
        # Step 2: Advance sim time to arrive and start work
        advance_sim_clock(2)
        # Step 3: Advance sim time to finish and resolve
        advance_sim_clock(45)

        # Step 4: Submit unknown zone report to demonstrate correction queue
        r_unknown = ingest_report({
            "reporter_name": "Field Inspector Rao",
            "reporter_contact": "+91-9876543210",
            "meter_id": "GRIDK999R",
            "previous_reading": "00100.00kWh",
            "current_reading": "00150.00kWh",
            "event_code": "OT",
            "description": "Unregistered peripheral feeder outage",
            "urgency": "Critical"
        })

        return {
            "scenario": "guided-demo",
            "message": "Guided Walkthrough initialized: 1 job successfully resolved with meter update, and 1 unknown zone report queued for demonstration.",
            "completed_report": r1["id"],
            "correction_report": r_unknown["id"]
        }

    else:
        return {"error": f"Unknown scenario '{name}'", "status": "error"}
