# GridWatch: Test Suite Catalog (T01 - T27)

Complete specification of all 27 automated tests verified by `pytest` and executable via the live **Test Lab** at `/api/tests/run`.

| Test ID | Test Name & Description | Inputs | Expected Output | Rubric & Syllabus Bullet |
|---|---|---|---|---|
| **T01** | Valid Meter ID Verification | `GRIDB042R`, `GRIDA001R`, `GRIDC999B` | DFA & Regex both accept (verdict `True`) | BCS503: DFA & Regex twin construction |
| **T02** | Invalid Meter ID Rejections | `gridB042R`, `GRIDB042X`, `GRID042R`, `GRIDB042R\n`, non-ASCII digit `०` | DFA & Regex both reject (verdict `False`) | BCS503: Strict transition failure & ASCII guards |
| **T03** | Reading Syntax Boundaries | `00432.57kWh` (valid), `00432.5kWh` (1 dec), `00432,57kWh` (comma), `00432.57kwh` (bad case) | Valid accepted; invalid rejected with exact failure position | BCS503: Reading DFA 11-step validation |
| **T04** | 10,000 Mutation Twin Agreement | 10,000 seeded pseudo-random mutations of IDs, readings & event codes | 100% consensus between DFA and Python regex twins | BCS503: Automated property & mutation testing |
| **T05** | Diagnostic Rejection Messages | `GRIDB042X` (pos 8), `00432,57kWh` (pos 5), incomplete `GRIDB04` | Rejection string formats: `Position X: expected ..., got ...` | BCS503: Informative state machine diagnostics |
| **T06** | 5 Categories Base Priorities | `TM` (P2), `OT` (P1), `HA` (P3), `CM` (P3), consumption $> 200\text{ kWh}$ (P4) | Correct category and mapped base priority | BCS503: 5-category classification mapping |
| **T07** | Conflicting Anomaly Patterns | `event_code='TM'` with consumption $> 200\text{ kWh}$ | Category is Tampering; matched patterns stored; base P2 | BCS503: Fixed precedence rule resolution |
| **T08** | Non-Anomaly Report Handling | `event_code='NONE'` with consumption $\le 200\text{ kWh}$ | Rejected with `NO_ANOMALY`; stored in DB; not dispatched | BCS503: Rejection storage without dispatch |
| **T09** | Decreased Reading Guard | `previous='00200.00kWh'`, `current='00150.00kWh'` | Rejected with `READING_DECREASED` | BCS503: Integer hundredths rollover sanity check |
| **T10** | Consumption Threshold Boundary | $\Delta = 200.00\text{ kWh}$ vs $\Delta = 200.01\text{ kWh}$ | $200.00$ rejected as NO_ANOMALY; $200.01$ accepted Overconsumption | BCS503: Overconsumption boundary conditions |
| **T11** | Payload Verbatim Auditability | Original JSON payload with reporter details | Stored verbatim in `reports.original_payload_json` | Assignment: Full payload auditability |
| **T12** | Routing Key Extraction Assertion | Attempting to dispatch a rejected report record | Python `AssertionError` raised; key extracted ONLY from accepted reports | Assignment: Intake-to-network boundary assertion |
| **T13** | Unknown Zone to Correction Queue | Meter ID `GRIDK123R` (Zone K not in A-E) | Status `Pending`, queue `CORRECTION`; fix-zone dispatches to JP | BCS502: Virtual CENTRAL fallback & re-routing |
| **T14** | Local Crew Allocation Order | First report for Zone A (Banashankari) | Assigned lowest-numbered technician `BSK1`; log recorded | BCS502: Deterministic crew allocation |
| **T15** | Shortest-Path Overflow Lending | Fill BSK to capacity (6 reports); submit 7th | 7th report overflows to nearest neighbor JP (cost 10 min) | BCS502: Dijkstra shortest-path overflow |
| **T16** | Lending Reserve Rule & Waiver | JP has 1 eligible crew member remaining | Non-P1 cannot borrow from JP; P1 waives reserve and borrows | BCS502: Crew lending reserve policy |
| **T17** | Waiting Queue Multi-Level Ordering | All grids full; submit P4, P1, P2 reports; free 1 crew | Freed crew dequeues P1 report first, then P2, then P4 | BCS502: Multi-level priority waiting queue |
| **T18** | Emergency P1 Priority Override | Active `Assigned` P4 case; incoming P1 arrives | P4 case preempted back to queue; crew redirected to P1 | BCS502: Critical report priority override |
| **T19** | In-Progress Preemption Guard | Active `In Progress` case; incoming P1 arrives | In-progress work is NEVER preempted; P1 queues at front | BCS502: Work-in-progress safety guard |
| **T20** | Handler Unavailable Failover | Assigned employee marked `OFF_DUTY` | Backup reassignment finds next eligible employee or queues | BCS502: Handler unavailable failover protocol |
| **T21** | Batch Concurrency & Idempotency | Batch of 10 simultaneous reports + multi-threaded hammering | Deterministic order, zero duplicate crew assignments | Assignment: Atomic SQLite transactions & locks |
| **T22** | Priority Escalation & De-escalation | Escalate report to P1, then de-escalate to P4 | Priority history logged; de-escalation does not unassign | Assignment: Dynamic priority adjustment |
| **T23** | 4-Status Lifecycle State Machine | Illegal jump: `Pending -> Resolved` | Transition rejected with HTTP 409 Conflict error | Assignment: 4-state lifecycle enforcement |
| **T24** | Remote Job Travel & Return Transit | Remote job resolved away from home substation | Crew state becomes `RETURNING`, travels home, ineligible until arrival | BCS502: Travel simulation & return transit |
| **T25** | Dynamic Topology Graph Changes | Deleting edges to isolate Whitefield (WFD) | Routing table recalculates; disconnected graph warning triggered | BCS502: Dynamic graph reconfiguration |
| **T26** | SQLite Persistence Across Reconnect | Create reports, close connection, re-open | All reports, assignments, and audit history persist intact | Assignment: Persistent SQLite storage |
| **T27** | End-to-End Workflow Verification | Complete submission to resolution walkthrough | Validated, classified, routed, assigned, travelled, worked, resolved, meter updated | Complete Assignment Integration |
