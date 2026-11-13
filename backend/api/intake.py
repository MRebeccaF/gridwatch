"""Report Intake, Validation and Ingestion Pipeline (BCS503/BCS502).

Implements strict 5-step intake order:
1. Completeness check (INCOMPLETE)
2. DFA and Regex validation for meter ID, readings, and event code
3. Integer hundredths reading comparison (READING_DECREASED)
4. Anomaly pattern matching and category resolution (NO_ANOMALY)
5. Priority calculation and deterministic dispatch
"""

import json
import logging
from typing import Any, Dict, List, Optional, Tuple
from ..automata.definitions import (
    meter_id_dfa,
    reading_dfa,
    event_code_dfa,
    REGEX_METER_ID,
    REGEX_READING,
    REGEX_EVENT_CODE,
)
from ..classifier.rules import (
    classify_report,
    parse_reading_hundredths,
    format_hundredths_reading,
)
from ..db.store import get_connection, get_global_lock
from ..dispatch.engine import dispatch_report, get_current_sim_time

logger = logging.getLogger("gridwatch.api.intake")


def validate_report_payload(payload: Dict[str, Any], threshold_hundredths: int = 20000) -> Dict[str, Any]:
    """Pure validation function for POST /api/validate or intake.

    Performs complete validation without saving to database.
    """
    # 1. Completeness check
    required_fields = ["reporter_name", "reporter_contact", "meter_id", "previous_reading", "current_reading", "event_code"]
    missing = [f for f in required_fields if not payload.get(f) or not str(payload.get(f)).strip()]
    if missing:
        return {
            "is_valid": False,
            "rejection_code": "INCOMPLETE",
            "rejection_message": f"Missing required fields: {', '.join(missing)}",
            "missing_fields": missing,
        }

    meter_id = str(payload.get("meter_id", "")).strip()
    prev_reading = str(payload.get("previous_reading", "")).strip()
    curr_reading = str(payload.get("current_reading", "")).strip()
    event_code = str(payload.get("event_code", "")).strip()
    urgency = str(payload.get("urgency", "Routine")).strip()
    if urgency not in ("Routine", "Elevated", "Critical"):
        urgency = "Routine"

    # 2. DFA and Regex twin validations
    # Meter ID
    dfa_meter = meter_id_dfa.simulate(meter_id)
    regex_meter = bool(REGEX_METER_ID.fullmatch(meter_id))
    if not dfa_meter["accepted"] or not regex_meter:
        return {
            "is_valid": False,
            "rejection_code": "MALFORMED_METER_ID",
            "rejection_message": dfa_meter["error_message"] or f"Meter ID {meter_id!r} failed syntax validation",
            "dfa_trace": dfa_meter["trace"],
            "failure_index": dfa_meter["failure_index"],
            "expected_symbols": dfa_meter["expected_symbols"],
        }

    # Previous Reading
    dfa_prev = reading_dfa.simulate(prev_reading)
    regex_prev = bool(REGEX_READING.fullmatch(prev_reading))
    if not dfa_prev["accepted"] or not regex_prev:
        return {
            "is_valid": False,
            "rejection_code": "MALFORMED_READING",
            "rejection_message": f"Previous reading: {dfa_prev['error_message'] or 'Syntax error'}",
            "dfa_trace": dfa_prev["trace"],
            "failure_index": dfa_prev["failure_index"],
        }

    # Current Reading
    dfa_curr = reading_dfa.simulate(curr_reading)
    regex_curr = bool(REGEX_READING.fullmatch(curr_reading))
    if not dfa_curr["accepted"] or not regex_curr:
        return {
            "is_valid": False,
            "rejection_code": "MALFORMED_READING",
            "rejection_message": f"Current reading: {dfa_curr['error_message'] or 'Syntax error'}",
            "dfa_trace": dfa_curr["trace"],
            "failure_index": dfa_curr["failure_index"],
        }

    # Event Code
    dfa_event = event_code_dfa.simulate(event_code)
    regex_event = bool(REGEX_EVENT_CODE.fullmatch(event_code))
    if not dfa_event["accepted"] or not regex_event:
        return {
            "is_valid": False,
            "rejection_code": "UNSUPPORTED_EVENT_CODE",
            "rejection_message": f"Event code '{event_code}' is unsupported (allowed: TM, OT, HA, CM, NONE)",
            "dfa_trace": dfa_event["trace"],
            "failure_index": dfa_event["failure_index"],
        }

    # 3. Readings check in integer hundredths
    prev_val = parse_reading_hundredths(prev_reading)
    curr_val = parse_reading_hundredths(curr_reading)
    if curr_val < prev_val:
        return {
            "is_valid": False,
            "rejection_code": "READING_DECREASED",
            "rejection_message": f"Possible rollover or typing error: current reading ({curr_reading}) is less than previous ({prev_reading})",
            "previous_hundredths": prev_val,
            "current_hundredths": curr_val,
        }

    # 4. Classification & Pattern matching
    category, matched_patterns, decision_rule, base_priority, final_priority = classify_report(
        event_code=event_code,
        previous_reading_hundredths=prev_val,
        current_reading_hundredths=curr_val,
        threshold_hundredths=threshold_hundredths,
        urgency=urgency,
    )

    if not category:
        return {
            "is_valid": False,
            "rejection_code": "NO_ANOMALY",
            "rejection_message": "No anomaly detected: event code is NONE and consumption does not exceed threshold",
            "consumption_kwh": (curr_val - prev_val) / 100.0,
        }

    consumption_hundredths = curr_val - prev_val
    return {
        "is_valid": True,
        "category": category,
        "matched_patterns": matched_patterns,
        "decision_rule": decision_rule,
        "base_priority": base_priority,
        "priority": final_priority,
        "urgency": urgency,
        "consumption_hundredths": consumption_hundredths,
        "consumption_kwh": consumption_hundredths / 100.0,
        "meter_id": meter_id,
        "zone_letter": meter_id[4],
        "dfa_verdict": 1,
        "regex_verdict": 1,
    }


def get_next_sequence_and_id(conn) -> Tuple[int, str]:
    cursor = conn.cursor()
    cursor.execute("SELECT MAX(sequence) as max_seq FROM reports")
    row = cursor.fetchone()
    seq = (row["max_seq"] or 0) + 1
    # ID format WC-YYYYMMDD-NNNN (sim date 20261113)
    report_id = f"WC-20261113-{seq:04d}"
    return seq, report_id


def ingest_report(payload: Dict[str, Any], sim_time_override: Optional[int] = None) -> Dict[str, Any]:
    """Ingests a report: validates, persists in SQLite, and if valid, dispatches.

    Thread-safe and atomic with process-wide lock.
    """
    with get_global_lock():
        conn = get_connection()
        try:
            cursor = conn.cursor()
            # Fetch consumption threshold
            cursor.execute("SELECT value FROM settings WHERE key = 'consumption_threshold'")
            setting_row = cursor.fetchone()
            threshold_val = float(setting_row["value"]) if setting_row else 200.00
            threshold_hundredths = int(round(threshold_val * 100))

            validation = validate_report_payload(payload, threshold_hundredths)
            sim_time = sim_time_override if sim_time_override is not None else get_current_sim_time(conn)
            seq, report_id = get_next_sequence_and_id(conn)

            raw_payload_json = json.dumps(payload)
            reporter_name = str(payload.get("reporter_name", "")).strip()
            reporter_contact = str(payload.get("reporter_contact", "")).strip()
            meter_id = str(payload.get("meter_id", "")).strip()
            prev_reading = str(payload.get("previous_reading", "")).strip()
            curr_reading = str(payload.get("current_reading", "")).strip()
            event_code = str(payload.get("event_code", "")).strip()
            description = str(payload.get("description", "")).strip()
            urgency = str(payload.get("urgency", "Routine")).strip()

            if not validation["is_valid"]:
                # Save rejected report in database
                rejection_code = validation["rejection_code"]
                rejection_message = validation["rejection_message"]
                cursor.execute(
                    """INSERT INTO reports (
                        id, sequence, original_payload_json, reporter_name, reporter_contact,
                        meter_id, previous_reading, current_reading, event_code, description,
                        urgency, submitted_time, validation_status, rejection_code, rejection_message,
                        dfa_verdict, regex_verdict, category, matched_patterns_json,
                        base_priority, priority, status, queue_type, zone_letter, source_grid, current_assignment_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'REJECTED', ?, ?, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)""",
                    (
                        report_id, seq, raw_payload_json, reporter_name, reporter_contact,
                        meter_id, prev_reading, curr_reading, event_code, description,
                        urgency, sim_time, rejection_code, rejection_message
                    )
                )
                conn.commit()
                return {
                    "id": report_id,
                    "sequence": seq,
                    "validation_status": "REJECTED",
                    "rejection_code": rejection_code,
                    "rejection_message": rejection_message,
                    "validation": validation
                }

            # Valid report
            category = validation["category"]
            matched_patterns = validation["matched_patterns"]
            base_priority = validation["base_priority"]
            priority = validation["priority"]
            zone_letter = validation["zone_letter"]

            cursor.execute(
                """INSERT INTO reports (
                    id, sequence, original_payload_json, reporter_name, reporter_contact,
                    meter_id, previous_reading, current_reading, event_code, description,
                    urgency, submitted_time, validation_status, rejection_code, rejection_message,
                    dfa_verdict, regex_verdict, category, matched_patterns_json,
                    base_priority, priority, status, queue_type, zone_letter, source_grid, current_assignment_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'VALID', NULL, NULL, 1, 1, ?, ?, ?, ?, 'Pending', 'WAITING', ?, NULL, NULL)""",
                (
                    report_id, seq, raw_payload_json, reporter_name, reporter_contact,
                    meter_id, prev_reading, curr_reading, event_code, description,
                    urgency, sim_time, category, json.dumps(matched_patterns),
                    base_priority, priority, zone_letter
                )
            )

            # Dispatch deterministic algorithm
            dispatch_res = dispatch_report(conn, report_id)
            conn.commit()

            return {
                "id": report_id,
                "sequence": seq,
                "validation_status": "VALID",
                "category": category,
                "matched_patterns": matched_patterns,
                "base_priority": base_priority,
                "priority": priority,
                "zone_letter": zone_letter,
                "dispatch": dispatch_res
            }
        finally:
            conn.close()


def ingest_batch_reports(reports: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Ingests a batch of reports sharing the same simulation timestamp.

    Validates and numbers in arrival order, then dispatches in queue order.
    """
    with get_global_lock():
        conn = get_connection()
        try:
            sim_time = get_current_sim_time(conn)
        finally:
            conn.close()

    results = []
    for item in reports:
        res = ingest_report(item, sim_time_override=sim_time)
        results.append(res)
    return results
