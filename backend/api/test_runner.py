"""Test Lab Execution Engine for /api/tests/run.

Executes test suite T01-T27 programmatically and returns detailed pass/fail
verdicts, execution durations, descriptions, and mapped syllabus rubric bullets.
"""

import time
import traceback
from typing import Any, Dict, List

# Metadata catalog for all 27 tests
TEST_CATALOG = [
    {
        "id": "T01",
        "description": "Valid meter ID GRIDB042R accepted by DFA and regex",
        "rubric": "BCS503: DFA & Regex twin construction",
        "module": "backend.tests.test_t01_t05",
        "func": "test_t01_valid_meter_id"
    },
    {
        "id": "T02",
        "description": "Invalid meter IDs (lowercase, missing letter, short, long, bad phase, empty, trailing newline, non-ASCII digit) rejected by both",
        "rubric": "BCS503: Strict DFA transition failure & non-ASCII rejection",
        "module": "backend.tests.test_t01_t05",
        "func": "test_t02_invalid_meter_ids"
    },
    {
        "id": "T03",
        "description": "Reading valid and invalid cases (digit counts, comma, wrong unit case, missing unit)",
        "rubric": "BCS503: Reading DFA 11-step validation",
        "module": "backend.tests.test_t01_t05",
        "func": "test_t03_reading_valid_and_invalid"
    },
    {
        "id": "T04",
        "description": "DFA and regex agree on 10,000 generated and mutated strings",
        "rubric": "BCS503: Automated property & mutation testing",
        "module": "backend.tests.test_t01_t05",
        "func": "test_t04_dfa_regex_agree_10000_mutations"
    },
    {
        "id": "T05",
        "description": "Rejection messages: exact position and expected symbols returned",
        "rubric": "BCS503: Informative state-machine rejection diagnostics",
        "module": "backend.tests.test_t01_t05",
        "func": "test_t05_rejection_messages"
    },
    {
        "id": "T06",
        "description": "Each of the five categories classified correctly with base priority",
        "rubric": "BCS503: 5-category classification & base priority mapping",
        "module": "backend.tests.test_t06_t12",
        "func": "test_t06_five_categories_base_priority"
    },
    {
        "id": "T07",
        "description": "Conflicting patterns: Tampering chosen, priority is most urgent matched, patterns stored",
        "rubric": "BCS503: Fixed precedence rule resolution",
        "module": "backend.tests.test_t06_t12",
        "func": "test_t07_conflicting_patterns_priority_rule"
    },
    {
        "id": "T08",
        "description": "No anomaly rejected and stored, never dispatched",
        "rubric": "BCS503: Rejection storage without workflow dispatch",
        "module": "backend.tests.test_t06_t12",
        "func": "test_t08_no_anomaly_rejected_never_dispatched"
    },
    {
        "id": "T09",
        "description": "Current below previous rejected (READING_DECREASED)",
        "rubric": "BCS503: Integer hundredths reading rollover sanity check",
        "module": "backend.tests.test_t06_t12",
        "func": "test_t09_current_below_previous_rejected"
    },
    {
        "id": "T10",
        "description": "Threshold boundary 200.00 vs 200.01, and a changed setting",
        "rubric": "BCS503: Overconsumption boundary conditions",
        "module": "backend.tests.test_t06_t12",
        "func": "test_t10_threshold_boundary"
    },
    {
        "id": "T11",
        "description": "Original payload stored verbatim with outcome and category",
        "rubric": "Assignment: Full payload persistence & auditability",
        "module": "backend.tests.test_t06_t12",
        "func": "test_t11_original_payload_stored_verbatim"
    },
    {
        "id": "T12",
        "description": "Routing key extracted only from accepted reports",
        "rubric": "Assignment: Intake-to-network boundary assertion",
        "module": "backend.tests.test_t06_t12",
        "func": "test_t12_routing_key_only_from_accepted_reports"
    },
    {
        "id": "T13",
        "description": "Unknown zone letter (F-Z) to Correction Queue; fix-zone then dispatches",
        "rubric": "BCS502: Virtual CENTRAL fallback & re-routing",
        "module": "backend.tests.test_t13_t26",
        "func": "test_t13_unknown_zone_to_correction_queue_and_fix_zone"
    },
    {
        "id": "T14",
        "description": "Local assignment picks lowest-numbered employee; log written",
        "rubric": "BCS502: Deterministic crew allocation & routing log",
        "module": "backend.tests.test_t13_t26",
        "func": "test_t14_local_assignment_picks_lowest_numbered_employee"
    },
    {
        "id": "T15",
        "description": "Six local assignments; seventh overflows to nearest grid by shortest path",
        "rubric": "BCS502: Dijkstra shortest-path overflow dispatch",
        "module": "backend.tests.test_t13_t26",
        "func": "test_t15_overflow_to_nearest_grid"
    },
    {
        "id": "T16",
        "description": "Lending reserve respected for non-P1, waived for P1",
        "rubric": "BCS502: Crew lending reserve policy",
        "module": "backend.tests.test_t13_t26",
        "func": "test_t16_lending_reserve_rule"
    },
    {
        "id": "T17",
        "description": "All grids full: waiting queue ordering; freeing employee dequeues correct report",
        "rubric": "BCS502: Multi-level priority waiting queue draining",
        "module": "backend.tests.test_t13_t26",
        "func": "test_t17_waiting_queue_ordering_and_dequeuing"
    },
    {
        "id": "T18",
        "description": "P1 override preempts lowest-priority not-started case",
        "rubric": "BCS502: Critical report priority override & redirection",
        "module": "backend.tests.test_t13_t26",
        "func": "test_t18_p1_override_preempts_not_started_case"
    },
    {
        "id": "T19",
        "description": "P1 with everything In Progress waits at front; nothing In Progress is preempted",
        "rubric": "BCS502: Work-in-progress preemption safety guard",
        "module": "backend.tests.test_t13_t26",
        "func": "test_t19_p1_never_preempts_in_progress"
    },
    {
        "id": "T20",
        "description": "Employee set off duty: backup or queue",
        "rubric": "BCS502: Handler unavailable failover protocol",
        "module": "backend.tests.test_t13_t26",
        "func": "test_t20_employee_off_duty_handling"
    },
    {
        "id": "T21",
        "description": "Batch of 10 plus threaded hammering: deterministic, no duplicate assignments",
        "rubric": "Assignment: Process concurrency & atomic database locking",
        "module": "backend.tests.test_t13_t26",
        "func": "test_t21_batch_and_concurrency"
    },
    {
        "id": "T22",
        "description": "Escalate and de-escalate: logged, queue re-sorted, de-escalation does not unassign",
        "rubric": "Assignment: Dynamic priority adjustment & history tracking",
        "module": "backend.tests.test_t13_t26",
        "func": "test_t22_escalate_and_deescalate"
    },
    {
        "id": "T23",
        "description": "Valid status transitions; invalid ones return 409",
        "rubric": "Assignment: 4-state lifecycle state machine enforcement",
        "module": "backend.tests.test_t13_t26",
        "func": "test_t23_status_transitions_and_409_validation"
    },
    {
        "id": "T24",
        "description": "Remote job: travel time equals path cost; employee returns home and is not eligible while returning",
        "rubric": "BCS502: Edge weight travel simulation & return transit",
        "module": "backend.tests.test_t13_t26",
        "func": "test_t24_remote_job_travel_and_returning"
    },
    {
        "id": "T25",
        "description": "Editing edges changes routing table and nearest lender; disconnected graph warns",
        "rubric": "BCS502: Dynamic graph reconfiguration & connectivity check",
        "module": "backend.tests.test_t13_t26",
        "func": "test_t25_editing_edges_and_disconnected_warning"
    },
    {
        "id": "T26",
        "description": "Restart the server: all data persists in SQLite",
        "rubric": "Assignment: Persistent SQLite storage",
        "module": "backend.tests.test_t13_t26",
        "func": "test_t26_data_persistence_across_reconnect"
    },
    {
        "id": "T27",
        "description": "End-to-end full workflow: submission to resolution",
        "rubric": "Complete Assignment Integration: Automata + Network Dispatch",
        "module": "backend.tests.test_t27",
        "func": "test_t27_end_to_end_workflow"
    }
]


def run_all_tests_live() -> Dict[str, Any]:
    """Runs all 27 tests and returns structured report."""
    results = []
    total_passed = 0
    total_failed = 0
    start_total_time = time.time()

    import importlib
    from ..db.store import init_db

    for test_meta in TEST_CATALOG:
        t0 = time.time()
        try:
            init_db(force_reset=True)
            mod = importlib.import_module(test_meta["module"])
            test_func = getattr(mod, test_meta["func"])
            test_func()
            duration_ms = round((time.time() - t0) * 1000, 2)
            results.append({
                "id": test_meta["id"],
                "description": test_meta["description"],
                "rubric": test_meta["rubric"],
                "status": "PASS",
                "duration_ms": duration_ms,
                "error": None
            })
            total_passed += 1
        except Exception as e:
            duration_ms = round((time.time() - t0) * 1000, 2)
            results.append({
                "id": test_meta["id"],
                "description": test_meta["description"],
                "rubric": test_meta["rubric"],
                "status": "FAIL",
                "duration_ms": duration_ms,
                "error": str(e)
            })
            total_failed += 1

    # Restore clean database state after test run
    init_db(force_reset=True)

    total_duration_ms = round((time.time() - start_total_time) * 1000, 2)
    return {
        "total": len(TEST_CATALOG),
        "passed": total_passed,
        "failed": total_failed,
        "duration_ms": total_duration_ms,
        "results": results
    }
