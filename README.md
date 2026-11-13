# GridWatch: Smart Meter Anomaly Reporter
**Master Project (P9) · Combining BCS503 (Automata Theory) & BCS502 (Computer Networks)**

![GridWatch Control Room](https://img.shields.io/badge/System-GridWatch%20Supervisory%20Console-06b6d4?style=for-the-badge)
![Status](https://img.shields.io/badge/Tests-27%2F27%20Passing-10b981?style=for-the-badge)
![Stack](https://img.shields.io/badge/Stack-React%20%7C%20Flask%20%7C%20SQLite-f59e0b?style=for-the-badge)

GridWatch is a full-stack supervisory simulator designed for utility grid control rooms. Field inspectors submit smart meter anomalies; the system validates them using formal Deterministic Finite Automata (DFA) and equivalent regular expressions, classifies them into five distinct anomaly categories, routes them across a dynamic 5-substation network topology using Dijkstra shortest paths, and manages crew assignments across a strict 4-state lifecycle.

---

## 🚀 Quickstart Guide (Local Run)

You can run GridWatch locally with just Python 3.10+ and Node 18+:

### 1. Clone & Enter Project Directory
```bash
cd /Users/rishi/.gemini/antigravity/scratch/gridwatch
```

### 2. Set Up Python Virtual Environment
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. Build React Frontend
```bash
cd frontend
npm install
npm run build
cd ..
```

### 4. Start Flask Server (Single Deployable)
```bash
python -m backend.app
```
Open **[http://localhost:5001](http://localhost:5001)** in your browser! The Flask application automatically serves the built React frontend, seeds the SQLite database, and starts the background simulation ticker.

---

## 🧪 Running the Verification Test Suite

GridWatch includes 27 comprehensive automated tests covering all syllabus rubric points:

### Run from Command Line
```bash
PYTHONPATH=. ./venv/bin/pytest backend/tests/ -v
```
All 27 tests (T01 through T27) will execute and pass in under 0.3 seconds.

### Run in In-Browser Test Lab
1. Open the web interface at `http://localhost:5001`.
2. Click on the **Test Lab** tab (or toggle *Free Roam* in the top bar).
3. Click **"Run Complete Suite (T01 - T27)"**.
4. View live execution results with descriptions, timing, and mapped syllabus questions.

---

## 🚢 Deployment (Docker & Cloud)

GridWatch is packaged as a single deployable Docker container that runs on any cloud host (e.g. Render, Railway, Fly.io, or AWS).

### Build & Run Docker Image
```bash
docker build -t gridwatch .
docker run -p 5001:5001 -e PORT=5001 -v $(pwd)/data:/app/data gridwatch
```

### Free Host Backup Strategy
Free cloud hosts (such as Render or Railway free tiers) can reset temporary disks on idle sleep. GridWatch includes two safeguards:
1. **Automatic Self-Seeding:** If the SQLite database is wiped or empty, the server automatically recreates the schema, 5 substations, 30 technicians, and 25 seed meters on startup.
2. **Reset Endpoint:** You can restore the clean default state at any time by clicking the **Reset** button in the top bar or sending `POST /api/sim/reset`.

---

## 🏛️ System Architecture

```
gridwatch/
├── backend/
│   ├── automata/          # BCS503: DFA definitions, generic simulator & regex twins
│   ├── classifier/        # BCS503: 5 categories, priority mapping & tie-breaking
│   ├── routing/           # BCS502: Graph topology, Dijkstra all-pairs shortest paths
│   ├── dispatch/          # BCS502: Capacity, overflow lending, P1 preemption override
│   ├── simulation/        # Clock, speed controls (0.5x-20x) & deterministic timing
│   ├── db/                # SQLite schema, store manager, atomic transactions & seed data
│   ├── api/               # REST API endpoints, SSE stream & scenario runner
│   ├── tests/             # Tests T01 through T27
│   └── app.py             # Single deployable server & frontend static file server
├── frontend/
│   ├── src/
│   │   ├── components/    # Header, persistent sim bar, live event ticker, legend modal
│   │   ├── context/       # AppContext global state, SSE subscriber & polling fallback
│   │   ├── stages/        # 8 stages: Briefing, Map, Report, Dispatch, Crew, Tracker, Analytics, Test Lab
│   │   ├── App.jsx
│   │   └── index.css      # Control room utility dark theme & technical styling
│   └── vite.config.js
├── Dockerfile             # Multi-stage production container
├── ASSUMPTIONS.md         # Documented architectural decisions & gap resolutions
├── TEST_CASES.md          # Complete catalog of tests T01 - T27
├── DEMO_SCRIPT.md         # 1-page presenter script for live teacher demonstrations
└── requirements.txt
```

---

## 📋 Syllabus Rubric Mapping (BCS503 / BCS502)

| Question | Topic | Demonstrated In | Automated Tests |
|---|---|---|---|
| **Q1** | DFA formal definition, 5-tuple, state diagram & transitions | Briefing (DFA Lab) | T01, T02, T03, T05 |
| **Q2** | Equivalent regular expressions & comparison engine | Briefing (DFA Lab) | T01, T04 |
| **Q3** | Failure diagnostics: exact position & expected symbol set | Briefing (DFA Lab) | T05 |
| **Q4** | Database schema, SQLite persistence & atomic transactions | Crew Desk & Tracker | T11, T21, T26 |
| **Q5** | Five categories classification & fixed priority tie-breaking rule | Report Desk & Briefing | T06, T07, T10 |
| **Q6** | Base priority mapping (P1-P4) & Urgency level adjustment | Report Desk & Crew Desk | T06, T11, T22 |
| **Q7** | Network topology graph, station nodes & weighted transit edges | Map Builder & Dispatch Floor | T15, T24, T25 |
| **Q8** | Dijkstra all-pairs shortest path calculation & explicit routing table | Map Builder & Dispatch Floor | T15, T25 |
| **Q9** | Dispatch algorithm: Local crew allocation & capacity limits | Dispatch Floor & Crew Desk | T14, T15 |
| **Q10** | Overflow lending rule with reserve constraint & P1 waiver | Dispatch Floor | T15, T16 |
| **Q11** | Priority override: Preemption of low-priority not-started jobs | Dispatch Floor | T18, T19 |
| **Q12** | 4-status lifecycle state machine (Pending, Assigned, In Progress, Resolved) | Tracker & Crew Desk | T23, T27 |
| **Q13** | Simulation clock, automated travel/work durations & scenario suite | Persistent Sim Bar & Test Lab | T21, T24, T27 |
