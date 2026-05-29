import sqlite3
import json
import os
import re
from contextvars import ContextVar
from datetime import datetime
from pathlib import Path
from typing import Optional

DB_PATH = Path(__file__).parent.parent / "classifications.db"
AUTH_DB_PATH = Path(os.environ.get("SEASCAN_AUTH_DB", str(DB_PATH.parent / "auth.db")))
USER_DB_ROOT = Path(os.environ.get("SEASCAN_USER_DB_DIR", str(DB_PATH.parent / "user_dbs")))
AUTH_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
USER_DB_ROOT.mkdir(parents=True, exist_ok=True)

ACTIVE_DATA_DB = ContextVar("ACTIVE_DATA_DB", default=None)


def get_data_db_path() -> Path:
    override = ACTIVE_DATA_DB.get()
    return Path(override) if override else DB_PATH


def set_active_data_db_path(path: Path | str) -> None:
    ACTIVE_DATA_DB.set(Path(path))


def clear_active_data_db_path() -> None:
    ACTIVE_DATA_DB.set(None)


def _sanitize_username(username: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]", "_", username.strip())


def get_user_db_path(username: str) -> Path:
    safe_name = _sanitize_username(username)
    return USER_DB_ROOT / f"{safe_name}.db"


def set_active_user_db(username: str) -> Path:
    path = get_user_db_path(username)
    set_active_data_db_path(path)
    init_db()
    return path


def _ensure_table_columns(conn: sqlite3.Connection, table: str, columns: dict[str, str]) -> None:
    """Ensure required columns exist on a table, adding missing ones."""
    cursor = conn.cursor()
    cursor.execute(f"PRAGMA table_info({table})")
    existing = {row[1] for row in cursor.fetchall()}
    for name, definition in columns.items():
        if name in existing:
            continue
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {name} {definition}")


def init_db():
    """Initialize SQLite database for storing classifications."""
    conn = sqlite3.connect(str(get_data_db_path()))
    cursor = conn.cursor()
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS classifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        study_area_name TEXT NOT NULL,
        study_area_location TEXT,
        study_area_bounds TEXT,
        crs TEXT,
        uploaded_filename TEXT,
        status TEXT,
        detection_type TEXT,
        affected_area_size REAL,
        affected_area_unit TEXT,
        confidence_score REAL,
        source TEXT,
        classification_date TEXT,
        classification_timestamp TEXT,
        last_updated TEXT,
        water_pixels INTEGER,
        seagrass_pixels INTEGER,
        sand_pixels INTEGER,
        cloud_pixels INTEGER,
        total_pixels INTEGER,
        pixel_area_sqm REAL,
        avg_confidence_percent REAL,
        classified_image_base64 TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS study_areas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        study_area_location TEXT,
        bounds TEXT,
        crs TEXT,
        first_classification_date TEXT,
        last_classification_date TEXT,
        classification_count INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    """)


    _ensure_table_columns(conn, "classifications", {
        "study_area_name": "TEXT NOT NULL DEFAULT 'Unknown'",
        "study_area_location": "TEXT",
        "study_area_bounds": "TEXT",
        "crs": "TEXT",
        "uploaded_filename": "TEXT",
        "status": "TEXT",
        "detection_type": "TEXT",
        "affected_area_size": "REAL",
        "affected_area_unit": "TEXT",
        "confidence_score": "REAL",
        "source": "TEXT",
        "classification_date": "TEXT",
        "classification_timestamp": "TEXT",
        "last_updated": "TEXT",
        "water_pixels": "INTEGER",
        "seagrass_pixels": "INTEGER",
        "sand_pixels": "INTEGER",
        "cloud_pixels": "INTEGER",
        "total_pixels": "INTEGER",
        "pixel_area_sqm": "REAL",
        "avg_confidence_percent": "REAL",
        "classified_image_base64": "TEXT",
        "notes": "TEXT",
        "created_at": "TEXT DEFAULT CURRENT_TIMESTAMP",
    })

    _ensure_table_columns(conn, "study_areas", {
        "name": "TEXT UNIQUE",
        "study_area_location": "TEXT",
        "bounds": "TEXT",
        "crs": "TEXT",
        "first_classification_date": "TEXT",
        "last_classification_date": "TEXT",
        "classification_count": "INTEGER DEFAULT 1",
        "created_at": "TEXT DEFAULT CURRENT_TIMESTAMP",
        "updated_at": "TEXT DEFAULT CURRENT_TIMESTAMP",
    })

    
    conn.commit()
    conn.close()


def init_auth_db() -> None:
    """Initialize SQLite database for storing user accounts."""
    conn = sqlite3.connect(str(AUTH_DB_PATH))
    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        last_login TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    """)

    _ensure_table_columns(conn, "users", {
        "username": "TEXT UNIQUE NOT NULL",
        "password_hash": "TEXT NOT NULL",
        "role": "TEXT NOT NULL",
        "last_login": "TEXT",
        "created_at": "TEXT DEFAULT CURRENT_TIMESTAMP",
    })
    conn.commit()
    conn.close()


def create_user(username: str, password_hash: str, role: str) -> int:
    """Create a user account and return its ID."""
    init_auth_db()
    conn = sqlite3.connect(str(AUTH_DB_PATH))
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
        (username, password_hash, role),
    )
    user_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return user_id


def get_user_by_username(username: str) -> Optional[dict]:
    """Fetch a user record by username."""
    init_auth_db()
    conn = sqlite3.connect(str(AUTH_DB_PATH))
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, username, password_hash, role, last_login, created_at FROM users WHERE username = ?",
        (username,),
    )
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    return {
        "id": row[0],
        "username": row[1],
        "password_hash": row[2],
        "role": row[3],
        "last_login": row[4],
        "created_at": row[5],
    }


def update_user_last_login(user_id: int) -> None:
    """Update last login timestamp for a user."""
    init_auth_db()
    conn = sqlite3.connect(str(AUTH_DB_PATH))
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE users SET last_login = ? WHERE id = ?",
        (datetime.utcnow().isoformat(), user_id),
    )
    conn.commit()
    conn.close()


def list_users() -> list[dict]:
    """List user accounts without password hashes."""
    init_auth_db()
    conn = sqlite3.connect(str(AUTH_DB_PATH))
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, role, last_login, created_at FROM users")
    rows = cursor.fetchall()
    conn.close()
    return [
        {
            "id": row[0],
            "username": row[1],
            "role": row[2],
            "last_login": row[3],
            "created_at": row[4],
        }
        for row in rows
    ]


def save_classification(
    study_area_name: str,
    study_area_location: Optional[str],
    study_area_bounds: Optional[dict],
    crs: Optional[str],
    uploaded_filename: str,
    status: Optional[str],
    detection_type: Optional[str],
    affected_area_size: Optional[float],
    affected_area_unit: Optional[str],
    confidence_score: Optional[float],
    source: Optional[str],
    classification_date: Optional[str],
    water_pixels: int,
    seagrass_pixels: int,
    sand_pixels: int,
    cloud_pixels: int,
    total_pixels: int,
    pixel_area_sqm: Optional[float] = None,
    avg_confidence_percent: Optional[float] = None,
    classified_image_base64: str = "",
    notes: str = "",
) -> int:
    """Save a classification result to the database.
    
    Returns: classification_id
    """
    init_db()
    conn = sqlite3.connect(str(get_data_db_path()))
    cursor = conn.cursor()

    cursor.execute("PRAGMA table_info(classifications)")
    classification_columns = {row[1] for row in cursor.fetchall()}
    
    bounds_json = json.dumps(study_area_bounds) if study_area_bounds else None
    timestamp = datetime.utcnow().isoformat()
    last_updated = timestamp

    insert_columns = [
        "study_area_name",
        "study_area_location",
        "study_area_bounds",
        "crs",
        "uploaded_filename",
        "status",
        "detection_type",
        "affected_area_size",
        "affected_area_unit",
        "confidence_score",
        "source",
        "classification_date",
        "water_pixels",
        "seagrass_pixels",
        "sand_pixels",
        "cloud_pixels",
        "total_pixels",
        "pixel_area_sqm",
        "avg_confidence_percent",
        "classified_image_base64",
        "notes",
    ]
    insert_values = [
        study_area_name,
        study_area_location,
        bounds_json,
        crs,
        uploaded_filename,
        status,
        detection_type,
        affected_area_size,
        affected_area_unit,
        confidence_score,
        source,
        classification_date,
        water_pixels,
        seagrass_pixels,
        sand_pixels,
        cloud_pixels,
        total_pixels,
        pixel_area_sqm,
        avg_confidence_percent,
        classified_image_base64,
        notes,
    ]

    if "classification_timestamp" in classification_columns:
        insert_columns.append("classification_timestamp")
        insert_values.append(timestamp)
    if "timestamp" in classification_columns:
        insert_columns.append("timestamp")
        insert_values.append(timestamp)
    if "last_updated" in classification_columns:
        insert_columns.append("last_updated")
        insert_values.append(last_updated)

    placeholders = ", ".join(["?"] * len(insert_columns))
    column_list = ", ".join(insert_columns)
    cursor.execute(
        f"INSERT INTO classifications ({column_list}) VALUES ({placeholders})",
        tuple(insert_values),
    )
    
    classification_id = cursor.lastrowid
    
    cursor.execute("SELECT * FROM study_areas WHERE name = ?", (study_area_name,))
    existing_area = cursor.fetchone()
    
    if existing_area:
        cursor.execute("""
        UPDATE study_areas
        SET classification_count = classification_count + 1,
            last_classification_date = ?,
            updated_at = ?
        WHERE name = ?
        """, (timestamp, timestamp, study_area_name))
    else:
        cursor.execute("""
        INSERT INTO study_areas (name, study_area_location, bounds, crs, first_classification_date, last_classification_date)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (study_area_name, study_area_location, bounds_json, crs, timestamp, timestamp))
    
    conn.commit()
    conn.close()
    
    return classification_id


def get_study_area(name: str) -> Optional[dict]:
    """Get study area details."""
    init_db()
    conn = sqlite3.connect(str(get_data_db_path()))
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM study_areas WHERE name = ?", (name,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
    
    return {
        "id": row[0],
        "name": row[1],
        "study_area_location": row[2],
        "bounds": json.loads(row[3]) if row[3] else None,
        "crs": row[4],
        "first_classification_date": row[5],
        "last_classification_date": row[6],
        "classification_count": row[7],
    }


def get_classification_by_id(classification_id: int) -> Optional[dict]:
    """Get a single classification record by ID."""
    init_db()
    conn = sqlite3.connect(str(get_data_db_path()))
    cursor = conn.cursor()

    cursor.execute("""
    SELECT id, study_area_name, study_area_location, study_area_bounds, crs,
           uploaded_filename, status, detection_type, affected_area_size,
           affected_area_unit, confidence_score, source, classification_date,
           classification_timestamp, last_updated, water_pixels, seagrass_pixels,
            sand_pixels, cloud_pixels, total_pixels, pixel_area_sqm, avg_confidence_percent, classified_image_base64, notes, created_at
    FROM classifications
    WHERE id = ?
    """, (classification_id,))

    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    return {
        "id": row[0],
        "study_area_name": row[1],
        "study_area_location": row[2],
        "study_area_bounds": json.loads(row[3]) if row[3] else None,
        "crs": row[4],
        "uploaded_filename": row[5],
        "status": row[6],
        "detection_type": row[7],
        "affected_area_size": row[8],
        "affected_area_unit": row[9],
        "confidence_score": row[10],
        "source": row[11],
        "classification_date": row[12],
        "classification_timestamp": row[13],
        "last_updated": row[14],
        "water_pixels": row[15],
        "seagrass_pixels": row[16],
        "sand_pixels": row[17],
        "cloud_pixels": row[18],
        "total_pixels": row[19],
        "pixel_area_sqm": row[20],
        "avg_confidence_percent": row[21],
        "classified_image_base64": row[22],
        "notes": row[23],
        "created_at": row[24],
    }


def get_classifications_for_study_area(study_area_name: str) -> list[dict]:
    """Get all classifications for a study area."""
    init_db()
    conn = sqlite3.connect(str(get_data_db_path()))
    cursor = conn.cursor()
    
    cursor.execute("""
    SELECT id, study_area_name, study_area_location, classification_timestamp,
        status, detection_type, affected_area_size, affected_area_unit,
        confidence_score, source, classification_date, last_updated,
        water_pixels, seagrass_pixels, sand_pixels, cloud_pixels, total_pixels, pixel_area_sqm, avg_confidence_percent, notes
    FROM classifications
    WHERE study_area_name = ?
    ORDER BY classification_timestamp DESC
    """, (study_area_name,))
    
    rows = cursor.fetchall()
    conn.close()
    
    return [
        {
            "id": row[0],
            "study_area_name": row[1],
            "study_area_location": row[2],
            "timestamp": row[3],
            "status": row[4],
            "detection_type": row[5],
            "affected_area_size": row[6],
            "affected_area_unit": row[7],
            "confidence_score": row[8],
            "source": row[9],
            "classification_date": row[10],
            "last_updated": row[11],
            "water_pixels": row[12],
            "seagrass_pixels": row[13],
            "sand_pixels": row[14],
            "cloud_pixels": row[15],
            "total_pixels": row[16],
            "pixel_area_sqm": row[17],
            "avg_confidence_percent": row[18],
            "notes": row[19],
        }
        for row in rows
    ]


def get_all_study_areas() -> list[dict]:
    """Get all study areas."""
    init_db()
    conn = sqlite3.connect(str(get_data_db_path()))
    cursor = conn.cursor()
    
    cursor.execute("""
    SELECT name, study_area_location, classification_count, last_classification_date
    FROM study_areas
    ORDER BY last_classification_date DESC
    """)
    
    rows = cursor.fetchall()
    conn.close()
    
    return [
        {
            "name": row[0],
            "study_area_location": row[1],
            "classification_count": row[2],
            "last_classification_date": row[3],
        }
        for row in rows
    ]


def get_all_classifications() -> list[dict]:
    """Get all classifications across all study areas."""
    init_db()
    conn = sqlite3.connect(str(get_data_db_path()))
    cursor = conn.cursor()

    cursor.execute("""
    SELECT id, study_area_name, study_area_location, study_area_bounds, crs,
           uploaded_filename, status, detection_type, affected_area_size,
           affected_area_unit, confidence_score, source, classification_date,
           classification_timestamp, last_updated, water_pixels, seagrass_pixels,
             sand_pixels, cloud_pixels, total_pixels, pixel_area_sqm, avg_confidence_percent, classified_image_base64,
           notes, created_at
    FROM classifications
    ORDER BY COALESCE(classification_date, classification_timestamp, created_at) DESC, id DESC
    """)

    rows = cursor.fetchall()
    conn.close()

    return [
        {
            "id": row[0],
            "study_area_name": row[1],
            "study_area_location": row[2],
            "study_area_bounds": json.loads(row[3]) if row[3] else None,
            "crs": row[4],
            "uploaded_filename": row[5],
            "status": row[6],
            "detection_type": row[7],
            "affected_area_size": row[8],
            "affected_area_unit": row[9],
            "confidence_score": row[10],
            "source": row[11],
            "classification_date": row[12],
            "classification_timestamp": row[13],
            "last_updated": row[14],
            "water_pixels": row[15],
            "seagrass_pixels": row[16],
            "sand_pixels": row[17],
            "cloud_pixels": row[18],
            "total_pixels": row[19],
            "pixel_area_sqm": row[20],
            "avg_confidence_percent": row[21],
            "classified_image_base64": row[22],
            "notes": row[23],
            "created_at": row[24],
        }
        for row in rows
    ]


def delete_classification(classification_id: int) -> bool:
    """Delete a classification record."""
    init_db()
    conn = sqlite3.connect(str(get_data_db_path()))
    cursor = conn.cursor()
    
    cursor.execute("DELETE FROM classifications WHERE id = ?", (classification_id,))
    conn.commit()
    conn.close()
    
    return cursor.rowcount > 0


def update_classification(classification_id: int, status: Optional[str] = None, notes: Optional[str] = None) -> bool:
    """Update mutable classification fields."""
    init_db()
    conn = sqlite3.connect(str(get_data_db_path()))
    cursor = conn.cursor()

    cursor.execute("PRAGMA table_info(classifications)")
    classification_columns = {row[1] for row in cursor.fetchall()}

    updates: list[str] = []
    values: list[object] = []

    if status is not None and "status" in classification_columns:
        updates.append("status = ?")
        values.append(status)

    if notes is not None and "notes" in classification_columns:
        updates.append("notes = ?")
        values.append(notes)

    if "last_updated" in classification_columns:
        updates.append("last_updated = ?")
        values.append(datetime.utcnow().isoformat())

    if not updates:
        conn.close()
        return False

    values.append(classification_id)
    cursor.execute(
        f"UPDATE classifications SET {', '.join(updates)} WHERE id = ?",
        tuple(values),
    )
    conn.commit()
    conn.close()

    return cursor.rowcount > 0
