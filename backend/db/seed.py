"""Database Seeder for GridWatch."""

import sqlite3
from typing import List
from ..routing.table import DEFAULT_ZONES, DEFAULT_EDGES

DEFAULT_SETTINGS = {
    "consumption_threshold": "200.00",
    "default_capacity": "6",
    "lending_reserve": "1",
    "auto_mode": "true",
    "duration_tampering": "45",
    "duration_outage": "30",
    "duration_hardware": "40",
    "duration_communication": "25",
    "duration_overconsumption": "20",
}

# Seed meters: 5 meters per zone letter A through E
SEED_METERS = [
    # Zone A (BSK)
    ("GRIDA101R", "A", "R", 12550),
    ("GRIDA102Y", "A", "Y", 24320),
    ("GRIDA103B", "A", "B", 56000),
    ("GRIDA104R", "A", "R", 8940),
    ("GRIDA105Y", "A", "Y", 43250),
    # Zone B (JP)
    ("GRIDB042R", "B", "R", 43257),
    ("GRIDB043Y", "B", "Y", 12000),
    ("GRIDB044B", "B", "B", 31450),
    ("GRIDB045R", "B", "R", 7890),
    ("GRIDB046Y", "B", "Y", 95000),
    # Zone C (HSR)
    ("GRIDC201R", "C", "R", 15400),
    ("GRIDC202Y", "C", "Y", 28900),
    ("GRIDC203B", "C", "B", 67120),
    ("GRIDC204R", "C", "R", 82340),
    ("GRIDC205B", "C", "B", 3900),
    # Zone D (KOR)
    ("GRIDD301R", "D", "R", 23000),
    ("GRIDD302Y", "D", "Y", 45600),
    ("GRIDD303B", "D", "B", 18750),
    ("GRIDD304R", "D", "R", 61200),
    ("GRIDD305Y", "D", "Y", 99100),
    # Zone E (WFD)
    ("GRIDE401R", "E", "R", 34500),
    ("GRIDE402Y", "E", "Y", 51200),
    ("GRIDE403B", "E", "B", 78900),
    ("GRIDE404R", "E", "R", 12300),
    ("GRIDE405B", "E", "B", 87400),
]


def seed_database(conn: sqlite3.Connection, force_reset: bool = False) -> None:
    """Seeds the database with initial settings, zones, edges, employees, and

    meters.
    """
    cursor = conn.cursor()

    if force_reset:
        cursor.execute("DELETE FROM assignments")
        cursor.execute("DELETE FROM reports")
        cursor.execute("DELETE FROM routing_log")
        cursor.execute("DELETE FROM status_history")
        cursor.execute("DELETE FROM priority_history")
        cursor.execute("DELETE FROM employees")
        cursor.execute("DELETE FROM edges")
        cursor.execute("DELETE FROM zones")
        cursor.execute("DELETE FROM meters")
        cursor.execute("DELETE FROM settings")
        cursor.execute("DELETE FROM sim_state")

    # Check if already seeded
    cursor.execute("SELECT COUNT(*) FROM zones")
    if cursor.fetchone()[0] > 0 and not force_reset:
        return

    # Seed Settings
    for k, v in DEFAULT_SETTINGS.items():
        cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (k, v))

    # Seed Zones
    for z in DEFAULT_ZONES:
        cursor.execute(
            """INSERT OR REPLACE INTO zones (key, station_code, name, depot, authority, capacity, map_x, map_y)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (z["key"], z["station_code"], z["name"], z["depot"], z["authority"], z["capacity"], z["map_x"], z["map_y"])
        )

    # Seed Edges
    for e in DEFAULT_EDGES:
        cursor.execute(
            """INSERT OR REPLACE INTO edges (from_station, to_station, weight)
               VALUES (?, ?, ?)""",
            (e["from_station"], e["to_station"], e["weight"])
        )

    # Seed Employees (6 per station, total 30)
    for z in DEFAULT_ZONES:
        code_prefix = z["station_code"]
        for i in range(1, 7):
            emp_code = f"{code_prefix}{i}"
            cursor.execute(
                """INSERT OR REPLACE INTO employees (code, home_grid, location, state, available_flag, current_report_id)
                   VALUES (?, ?, ?, 'IDLE', 1, NULL)""",
                (emp_code, code_prefix, code_prefix)
            )

    # Seed Meters
    for m in SEED_METERS:
        cursor.execute(
            """INSERT OR REPLACE INTO meters (meter_id, zone_letter, phase, last_reading_hundredths)
               VALUES (?, ?, ?, ?)""",
            m
        )

    # Seed Sim State
    cursor.execute(
        """INSERT OR REPLACE INTO sim_state (id, clock_minutes, speed, is_running, mode)
           VALUES (1, 540, 1.0, 0, 'auto')"""
    )

    conn.commit()
