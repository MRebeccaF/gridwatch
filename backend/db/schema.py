"""SQLite Schema definition for GridWatch."""

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS zones (
    key TEXT PRIMARY KEY,
    station_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    depot TEXT NOT NULL,
    authority TEXT NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 6,
    map_x REAL NOT NULL,
    map_y REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS edges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_station TEXT NOT NULL,
    to_station TEXT NOT NULL,
    weight INTEGER NOT NULL,
    UNIQUE(from_station, to_station)
);

CREATE TABLE IF NOT EXISTS employees (
    code TEXT PRIMARY KEY,
    home_grid TEXT NOT NULL,
    location TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'IDLE',
    available_flag INTEGER NOT NULL DEFAULT 1,
    current_report_id TEXT
);

CREATE TABLE IF NOT EXISTS meters (
    meter_id TEXT PRIMARY KEY,
    zone_letter TEXT NOT NULL,
    phase TEXT NOT NULL,
    last_reading_hundredths INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    sequence INTEGER NOT NULL,
    original_payload_json TEXT NOT NULL,
    reporter_name TEXT NOT NULL,
    reporter_contact TEXT NOT NULL,
    meter_id TEXT NOT NULL,
    previous_reading TEXT NOT NULL,
    current_reading TEXT NOT NULL,
    event_code TEXT NOT NULL,
    description TEXT,
    urgency TEXT NOT NULL,
    submitted_time INTEGER NOT NULL,
    validation_status TEXT NOT NULL,
    rejection_code TEXT,
    rejection_message TEXT,
    dfa_verdict INTEGER,
    regex_verdict INTEGER,
    category TEXT,
    matched_patterns_json TEXT,
    base_priority TEXT,
    priority TEXT,
    status TEXT,
    queue_type TEXT,
    zone_letter TEXT,
    source_grid TEXT,
    current_assignment_id INTEGER
);

CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id TEXT NOT NULL,
    employee_code TEXT NOT NULL,
    home_grid TEXT NOT NULL,
    source_grid TEXT NOT NULL,
    route_json TEXT NOT NULL,
    route_cost INTEGER NOT NULL,
    assigned_time INTEGER NOT NULL,
    arrived_time INTEGER,
    started_time INTEGER,
    finished_time INTEGER,
    returned_time INTEGER,
    active_flag INTEGER NOT NULL DEFAULT 1,
    end_reason TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_active_report_assignment 
ON assignments(report_id) WHERE active_flag = 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_active_employee_assignment 
ON assignments(employee_code) WHERE active_flag = 1;

CREATE TABLE IF NOT EXISTS routing_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    time INTEGER NOT NULL,
    report_id TEXT NOT NULL,
    decision TEXT NOT NULL,
    priority TEXT,
    from_grid TEXT,
    to_grid TEXT,
    employee_code TEXT,
    route TEXT,
    reason_text TEXT
);

CREATE TABLE IF NOT EXISTS status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id TEXT NOT NULL,
    time INTEGER NOT NULL,
    old_status TEXT,
    new_status TEXT NOT NULL,
    reason TEXT
);

CREATE TABLE IF NOT EXISTS priority_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id TEXT NOT NULL,
    time INTEGER NOT NULL,
    old_priority TEXT,
    new_priority TEXT NOT NULL,
    reason TEXT
);

CREATE TABLE IF NOT EXISTS sim_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    clock_minutes INTEGER NOT NULL DEFAULT 540, -- 09:00 = 540 minutes from midnight
    speed REAL NOT NULL DEFAULT 1.0,
    is_running INTEGER NOT NULL DEFAULT 0,
    mode TEXT NOT NULL DEFAULT 'auto'
);
"""
