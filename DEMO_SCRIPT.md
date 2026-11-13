# GridWatch: One-Page Presentation & Demo Day Script

Use this structured script to present **GridWatch** to examiners, evaluators, and teachers.

---

### Phase 1: Introduction (1 Minute)
1. **Welcome & Context:**
   > *"Good morning. GridWatch is a supervisory smart meter anomaly reporter that combines BCS503 Automata Theory and BCS502 Computer Networks into a unified, deterministic utility simulator."*
2. **Open the Briefing Page:**
   - Point out the **DFA Lab**.
   - Show the **Regex Twin Consensus Badge** (`AGREE (100%)`).
   - Click the preset `GRIDB042R (Valid)`: watch the 9-state sequence walk to the green accepting state.
   - Click `GRIDB042X (Bad Phase)`: show the red failure banner at position 8 (`expected phase [R, Y, B], got 'X'`) and transition to the explicit `DEAD` state.
   - Point out the **Gaps and Decisions** cards resolving MERN vs Flask, floating point rounding, and preemption safety.

---

### Phase 2: Network Topology & Shortest Paths (1 Minute)
1. **Navigate to "Map Builder":**
   - Point to the 5 BESCOM substation nodes: *Banashankari (BSK)*, *JP Nagar (JP)*, *HSR Layout (HSR)*, *Koramangala (KOR)*, and *Whitefield (WFD)*.
   - Drag an edge to demonstrate dynamic graph interaction.
   - Click an edge (e.g., BSK ↔ JP) to view travel time weight (10 min).
   - Point out the adjacent **Dijkstra Shortest Paths Routing Table** updating automatically.

---

### Phase 3: Intake, Classification & Precedence (1.5 Minutes)
1. **Navigate to "Report Desk":**
   - Click the preset button **"Critical Outage (P1)"**:
     - Note the live telemetry preview showing detected category `Outage`, base priority `P1`, and zone `B`.
   - Click **"Submit Report to Grid"**:
     - Point out the 4-stage packet animation (`VALIDATE → CLASSIFY → ROUTE → ASSIGN`).
     - Note the unique generated Work Code: `WC-YYYYMMDD-NNNN`.
   - Now click the preset **"Unknown Zone (GRIDK)"**:
     - Submit: notice it passes syntactic DFA validation, but lands safely in the **Virtual CENTRAL Correction Queue**.

---

### Phase 4: Dispatch Floor & Automated Preemption (1.5 Minutes)
1. **Navigate to "Dispatch Floor":**
   - Point out the **Substation Load Rings** (0/6 to 6/6) pulsing as capacity fills.
   - Show the **Waiting Queue** and the **Correction Queue**.
   - Click **"Fix Zone"** on the unknown `GRIDK` report: map it to `Zone B (JP Depot)` and watch it immediately assign to technician `JP1`!
2. **Trigger Scenario: P1 Priority Override:**
   - From the persistent top bar, open the **Scenarios** dropdown and click **"P1 Priority Override"**:
     - Explain: *"An emergency hospital feeder blackout arrived when all local crews were occupied on routine work. GridWatch preempted the not-started P4 case, returned it to the waiting queue, and redirected the technician immediately."*

---

### Phase 5: Crew Desk, Tracker & Live Test Lab (1 Minute)
1. **Navigate to "Crew Desk":**
   - Select station `BSK` or `JP`.
   - Show the 6 technicians (`BSK1` to `BSK6`), toggle availability, and click **"Start Work"** / **"Resolve"** to advance the case.
2. **Navigate to "Test Lab":**
   - Click **"Run Complete Suite (T01 - T27)"**:
   - Watch all 27 automated tests execute in under 300 ms, showing 27 green passes mapped directly to the syllabus rubric questions Q1 to Q13!
   - Conclude: *"Thank you. We are now open for any questions or exploratory test inputs."*
