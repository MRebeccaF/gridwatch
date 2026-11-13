"""Database store and connection manager for GridWatch."""

import os
import sqlite3
import threading
from typing import Any, Dict, List, Optional
from .schema import SCHEMA_SQL
from .seed import seed_database

DEFAULT_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "gridwatch.db")
DB_PATH = os.environ.get("GRIDWATCH_DB_PATH", DEFAULT_DB_PATH)

_lock = threading.RLock()


def get_db_path() -> str:
    return os.environ.get("GRIDWATCH_DB_PATH", DEFAULT_DB_PATH)


def get_connection(db_path: Optional[str] = None) -> sqlite3.Connection:
    """Creates a connection with Row factory and foreign keys enabled."""
    path = db_path or get_db_path()
    conn = sqlite3.connect(path, check_same_thread=False, timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db(db_path: Optional[str] = None, force_reset: bool = False) -> None:
    """Initializes the SQLite database with schema and seeds if empty."""
    with _lock:
        conn = get_connection(db_path)
        try:
            conn.executescript(SCHEMA_SQL)
            seed_database(conn, force_reset=force_reset)
        finally:
            conn.close()


def query_all(query: str, args: tuple = (), db_path: Optional[str] = None) -> List[Dict[str, Any]]:
    """Runs a query and returns a list of dictionaries."""
    conn = get_connection(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute(query, args)
        rows = cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def query_one(query: str, args: tuple = (), db_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Runs a query and returns a single dictionary or None."""
    conn = get_connection(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute(query, args)
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def execute_commit(query: str, args: tuple = (), db_path: Optional[str] = None) -> int:
    """Executes a query, commits, and returns the lastrowid."""
    with _lock:
        conn = get_connection(db_path)
        try:
            cursor = conn.cursor()
            cursor.execute(query, args)
            conn.commit()
            return cursor.lastrowid
        finally:
            conn.close()


def get_global_lock() -> threading.RLock:
    return _lock
