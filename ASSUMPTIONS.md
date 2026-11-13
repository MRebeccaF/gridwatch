# GridWatch: Architectural Assumptions & Engineering Decisions

This document records every assumption, ambiguity resolution, and design decision implemented in **GridWatch**, combining **BCS503 (Automata Theory and Computability)** and **BCS502 (Computer Networks)** for Assignment P9. These decisions are also mirrored directly inside the application on the **Briefing Stage** under *Gaps and Decisions*.

---

### 1. Architecture: React + Flask + SQLite vs MERN
- **Statement Text:** The prompt mentions MERN in Q8, but Flask and SQLite in Q10.
- **The Gap:** Direct contradiction between two conflicting application stacks (Node/Express/MongoDB vs Python/Flask/SQLite).
- **Our Decision:** Resolved strictly in favor of **React + Vite + Flask + SQLite**. Python is the natural language for Automata Theory (BCS503) string simulation and graph theory algorithms. SQLite provides ACID-compliant single-file persistence with atomic transactions (`BEGIN IMMEDIATE`) and zero deployment friction.
- **Why:** Q10 is more specific and technical than the general mention in Q8.

---

### 2. Meter ID Letter Range & Substation Mapping
- **Statement Text:** Meter ID format is `^GRID[A-Z][0-9]{3}[RYB]$`. Section 4 defines grid sections keyed by letters A through E.
- **The Gap:** The regular grammar permits any uppercase letter from `A` to `Z`, but Bangalore only has five defined BESCOM sections (`A`=BSK, `B`=JP, `C`=HSR, `D`=KOR, `E`=WFD).
- **Our Decision:** Letters `F` to `Z` are **syntactically valid** meter IDs and pass Part A intake validation. During Part B network routing, unknown letters trigger `UNKNOWN_ZONE` routing and are automatically placed into the virtual **CENTRAL Correction Queue** (status `Pending`, queue `CORRECTION`). Operators can manually map the unknown zone letter to an active station depot and re-dispatch.

---

### 3. Consumption Calculation: Integer Hundredths of kWh
- **Statement Text:** Cumulative readings formatted as `^[0-9]{5}[.][0-9]{2}kWh$`.
- **The Gap:** Standard IEEE 754 floating-point operations introduce subtle representation errors (e.g. `0.1 + 0.2 != 0.3`) which can cause erratic billing increments and threshold boundary failures.
- **Our Decision:** All readings are parsed and handled strictly as **integer hundredths of kWh** (e.g. `00432.57kWh` becomes integer `43257`). All calculations, storage, and threshold comparisons are pure integer arithmetic, completely avoiding floating-point precision hazards.

---

### 4. Classification Hierarchy & Deterministic Precedence
- **Statement Text:** Anomaly reports must be classified into exactly five categories: *Tampering*, *Outage*, *Hardware*, *Communication*, *Overconsumption*.
- **The Gap:** A single submission can trigger multiple fault conditions simultaneously (e.g., event code `TM` and consumption exceeding 200.00 kWh).
- **Our Decision:** All matched patterns are recorded in the database. Category tie-breaking is governed by a strictly documented precedence hierarchy:
  $$\text{Tampering} > \text{Outage} > \text{Hardware} > \text{Communication} > \text{Overconsumption}$$
  The report’s base priority is chosen as the **most urgent base priority among ALL matched patterns** (e.g. Tampering $P2$ + Outage $P1 \rightarrow$ Tampering category, but Base Priority $P1$).

---

### 5. Exclusion of Underconsumption
- **Statement Text:** College examiners mandate *exactly five categories*.
- **The Gap:** Underconsumption is occasionally discussed in smart grid utility monitoring, but was not included among the five required categories.
- **Our Decision:** Underconsumption is not a category. If a report has `current_reading < previous_reading`, it is rejected with rejection code `READING_DECREASED` ("Possible rollover or typing error") and stored in the database for auditing without dispatch.

---

### 6. Emergency P1 Override & Preemption Boundaries
- **Statement Text:** P1 reports may preempt other cases if no crew is available to lend.
- **The Gap:** Preempting an employee who is already actively repairing live electrical switchgear on site (`In Progress`) presents a severe physical hazard and unrealistic utility workflow.
- **Our Decision:** P1 override can preempt **only cases with status `Assigned` where the employee has NOT started work** (`started_time IS NULL`). `In Progress` work is **NEVER preempted**. The victim case is chosen by: (1) lowest priority (P4 first, then P3, then P2), (2) shortest travel cost to the emergency site, (3) newest submission time. The victim case safely returns to the waiting queue (`Pending`, queue `WAITING`), and the employee is redirected.

---

### 7. Network Distance: Shortest Path Travel Weight (Minutes)
- **Statement Text:** Dispatch to the nearest grid section on overflow.
- **The Gap:** "Nearest" could mean geographic Euclidean distance or travel time along road/network edges.
- **Our Decision:** "Nearest" is defined as the minimum travel cost in minutes computed dynamically via Dijkstra's all-pairs shortest paths algorithm over the undirected weighted graph:
  - BSK ↔ JP: 10 min
  - JP ↔ HSR: 20 min
  - HSR ↔ KOR: 10 min
  - BSK ↔ KOR: 25 min
  - KOR ↔ WFD: 35 min
  - HSR ↔ WFD: 40 min

---

### 8. Crew Concurrency & Capacity Limits
- **Statement Text:** "Maximum of 6 open cases per crew."
- **The Gap:** Ambiguity between whether a station is a crew, or whether individual employees are crew members.
- **Our Decision:** Each of the 5 stations has **6 dedicated technicians** (`BSK1` to `BSK6`, `JP1` to `JP6`, etc., totaling 30 employees). Each employee handles at most 1 case at a time. Each station has a configurable capacity ceiling (default 6, maximum 6). Eligible employees must be `IDLE`, located at their home substation, not marked `OFF_DUTY`, and their home grid committed count must be strictly less than its capacity.

---

### 9. GRID Prefix as a Strict Literal
- **Statement Text:** Meter ID begins with `GRID`.
- **The Gap:** Case sensitivity and non-ASCII characters.
- **Our Decision:** Treated as a literal 4-character uppercase ASCII sequence. Lowercase `grid` or Unicode characters are strictly rejected with exact character position and symbol expectation diagnostics.

---

### 10. Handling of Non-Anomaly Routine Inspections
- **Statement Text:** Field inspectors submit periodic readings.
- **The Gap:** How to treat a report where event code is `NONE` and consumption is within normal limits ($\le 200.00\text{ kWh}$).
- **Our Decision:** Non-anomaly reports are rejected with code `NO_ANOMALY` and saved in the SQLite `reports` table with validation status `REJECTED`. They are never dispatched to technician queues, maintaining a pristine audit log for billing reconciliation.
