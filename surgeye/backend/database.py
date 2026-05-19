"""
SurgEye Database Module
SQLite database for nurses, shifts, violations, investigations, and surgery assignments.
"""

import sqlite3
import json
import os
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from uuid import uuid4

DATABASE_PATH = os.path.join(os.path.dirname(__file__), 'surgeye.db')


def get_db_connection():
    """Get database connection with row factory."""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_database():
    """Initialize all tables on startup."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Nurses table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS nurses (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            available INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Shifts table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS shifts (
            id TEXT PRIMARY KEY,
            nurse_id TEXT,
            date TEXT NOT NULL,
            time_start TEXT NOT NULL,
            time_end TEXT NOT NULL,
            status TEXT DEFAULT 'scheduled',
            replacement_nurse_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (nurse_id) REFERENCES nurses(id)
        )
    ''')
    
    # Surgery assignments table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS surgery_assignments (
            id TEXT PRIMARY KEY,
            surgery_id TEXT NOT NULL,
            nurse_id TEXT NOT NULL,
            role TEXT NOT NULL,
            date TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (nurse_id) REFERENCES nurses(id)
        )
    ''')
    
    # Violations table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS violations (
            id TEXT PRIMARY KEY,
            nurse_id TEXT NOT NULL,
            surgery_id TEXT NOT NULL,
            instrument_name TEXT NOT NULL,
            instrument_count INTEGER DEFAULT 1,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'under_investigation',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (nurse_id) REFERENCES nurses(id)
        )
    ''')
    
    # Investigations table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS investigations (
            id TEXT PRIMARY KEY,
            nurse_id TEXT NOT NULL,
            surgery_id TEXT NOT NULL,
            violation_id TEXT,
            report_json TEXT,
            baseline_image TEXT,
            postop_image TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            audit_status TEXT DEFAULT 'pending_review',
            FOREIGN KEY (nurse_id) REFERENCES nurses(id),
            FOREIGN KEY (violation_id) REFERENCES violations(id)
        )
    ''')
    
    # Surgery sessions table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS surgery_sessions (
            id TEXT PRIMARY KEY,
            nurse_id TEXT NOT NULL,
            nurse_name TEXT NOT NULL,
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ended_at TIMESTAMP,
            status TEXT DEFAULT 'active',
            baseline_counts TEXT,
            final_counts TEXT,
            baseline_image TEXT,
            postop_image TEXT,
            investigation_id TEXT,
            FOREIGN KEY (nurse_id) REFERENCES nurses(id)
        )
    ''')
    
    conn.commit()
    conn.close()
    print("[DB] Database initialized successfully")


def seed_dummy_data():
    """Seed dummy nurses and shifts for demo."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if data already exists
    cursor.execute('SELECT COUNT(*) FROM nurses')
    if cursor.fetchone()[0] > 0:
        conn.close()
        print("[DB] Dummy data already exists, skipping seed")
        return
    
    # Seed nurses
    nurses = [
        ('nurse-001', 'Sarah Chen', 'Scrub Nurse', 'active', 1),
        ('nurse-002', 'James Wong', 'Scrub Nurse', 'active', 1),
        ('nurse-003', 'Aisha Rahman', 'Circulating Nurse', 'active', 1),
        ('nurse-004', 'David Lim', 'Scrub Nurse', 'active', 1),
        ('nurse-005', 'Mei Lin', 'Scrub Nurse', 'active', 1),
        ('nurse-006', 'John Tan', 'Circulating Nurse', 'active', 1),
    ]
    
    cursor.executemany(
        'INSERT INTO nurses (id, name, role, status, available) VALUES (?, ?, ?, ?, ?)',
        nurses
    )
    
    # Generate 7 days of shifts
    today = datetime.now()
    shifts = []
    shift_times = [
        ('07:00', '15:00'),  # Morning
        ('15:00', '23:00'),  # Afternoon
        ('23:00', '07:00'),  # Night
    ]
    
    for day_offset in range(7):
        shift_date = (today + timedelta(days=day_offset)).strftime('%Y-%m-%d')
        for nurse_id, _, _, _, _ in nurses:
            for time_start, time_end in shift_times:
                shifts.append((
                    f'shift-{uuid4().hex[:8]}',
                    nurse_id,
                    shift_date,
                    time_start,
                    time_end,
                    'scheduled',
                    None
                ))
    
    cursor.executemany(
        'INSERT INTO shifts (id, nurse_id, date, time_start, time_end, status, replacement_nurse_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        shifts
    )
    
    # Create a surgery assignment for today (for demo)
    cursor.execute(
        'INSERT INTO surgery_assignments (id, surgery_id, nurse_id, role, date) VALUES (?, ?, ?, ?, ?)',
        ('surgery-001', 'surgery-session-001', 'nurse-001', 'Scrub Nurse', today.strftime('%Y-%m-%d'))
    )
    
    # Seed demo surgery sessions with baseline data for presentation
    demo_sessions = [
        {
            'id': 'surgery-demo-001',
            'nurse_id': 'nurse-001',
            'nurse_name': 'Sarah Chen',
            'baseline': {'Forceps': 2, 'Hemostat': 1, 'Scalpel': 1, 'Army_navy': 3},
            'final': {'Forceps': 2, 'Hemostat': 1, 'Scalpel': 1, 'Army_navy': 3},
            'status': 'completed',
            'passed': True
        },
        {
            'id': 'surgery-demo-002',
            'nurse_id': 'nurse-002',
            'nurse_name': 'James Wong',
            'baseline': {'Forceps': 3, 'Hemostat': 2, 'Scalpel': 1, 'Towel_clip': 4},
            'final': {'Forceps': 3, 'Hemostat': 1, 'Scalpel': 1, 'Towel_clip': 4},
            'status': 'completed',
            'passed': False,
            'investigation_id': 'investigation-demo-001'
        }
    ]
    
    for session in demo_sessions:
        cursor.execute('''
            INSERT INTO surgery_sessions (id, nurse_id, nurse_name, status, baseline_counts, final_counts, investigation_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            session['id'],
            session['nurse_id'],
            session['nurse_name'],
            session['status'],
            json.dumps(session['baseline']),
            json.dumps(session['final']),
            session.get('investigation_id')
        ))
    
    # Seed demo investigations
    cursor.execute('''
        INSERT INTO violations (id, nurse_id, surgery_id, instrument_name, instrument_count, status)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', ('violation-demo-001', 'nurse-002', 'surgery-demo-002', 'Hemostat', 1, 'under_investigation'))
    
    cursor.execute('''
        INSERT INTO investigations (id, nurse_id, surgery_id, violation_id, report_json, audit_status)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (
        'investigation-demo-001',
        'nurse-002',
        'surgery-demo-002',
        'violation-demo-001',
        json.dumps({'missing_items': {'Hemostat': 1}, 'timeline': []}),
        'under_investigation'
    ))
    
    conn.commit()
    conn.close()
    print(f"[DB] Seeded {len(nurses)} nurses, {len(shifts)} shifts, {len(demo_sessions)} demo sessions")


# ============ Nurse Operations ============

def get_nurse(nurse_id: str) -> Optional[Dict[str, Any]]:
    """Get nurse by ID."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM nurses WHERE id = ?', (nurse_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def get_all_nurses() -> List[Dict[str, Any]]:
    """Get all nurses."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM nurses')
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_nurse_status(nurse_id: str) -> Dict[str, Any]:
    """Get nurse status with any active violations."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM nurses WHERE id = ?', (nurse_id,))
    nurse = cursor.fetchone()
    
    cursor.execute(
        'SELECT * FROM violations WHERE nurse_id = ? AND status = ?',
        (nurse_id, 'under_investigation')
    )
    violations = cursor.fetchall()
    
    conn.close()
    
    return {
        'nurse': dict(nurse) if nurse else None,
        'active_violations': [dict(v) for v in violations],
        'has_violations': len(violations) > 0
    }


# ============ Shift Operations ============

def get_nurse_upcoming_shifts(nurse_id: str, days: int = 7) -> List[Dict[str, Any]]:
    """Get nurse's upcoming shifts for the next N days."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    today = datetime.now().strftime('%Y-%m-%d')
    end_date = (datetime.now() + timedelta(days=days)).strftime('%Y-%m-%d')
    
    cursor.execute('''
        SELECT * FROM shifts 
        WHERE nurse_id = ? 
        AND date >= ? 
        AND date <= ?
        AND status = 'scheduled'
        ORDER BY date, time_start
    ''', (nurse_id, today, end_date))
    
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def remove_nurse_from_shifts(nurse_id: str) -> List[Dict[str, Any]]:
    """Remove nurse from all upcoming shifts, return the removed shifts."""
    shifts = get_nurse_upcoming_shifts(nurse_id)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    for shift in shifts:
        cursor.execute(
            'UPDATE shifts SET status = ?, nurse_id = NULL WHERE id = ?',
            ('removed', shift['id'])
        )
    
    conn.commit()
    conn.close()
    
    return shifts


def find_replacement_nurse(shift: Dict[str, Any], excluded_nurse_ids: List[str] = None) -> Optional[str]:
    """Find an available replacement nurse for a shift."""
    if excluded_nurse_ids is None:
        excluded_nurse_ids = []
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Find nurses who:
    # 1. Are active and available
    # 2. Have no violations
    # 3. Are not already scheduled for this shift time
    
    cursor.execute('''
        SELECT n.id, n.name FROM nurses n
        WHERE n.status = 'active'
        AND n.available = 1
        AND n.id NOT IN (
            SELECT DISTINCT nurse_id FROM violations 
            WHERE status = 'under_investigation'
        )
        AND n.id NOT IN (
            SELECT nurse_id FROM shifts 
            WHERE date = ? AND time_start = ? AND status = 'scheduled'
        )
        AND n.id NOT IN ({})
        LIMIT 1
    '''.format(','.join(['?'] * len(excluded_nurse_ids)) if excluded_nurse_ids else "''"),
    [shift['date'], shift['time_start']] + excluded_nurse_ids)
    
    row = cursor.fetchone()
    conn.close()
    
    return row['id'] if row else None


def reassign_shift(shift_id: str, new_nurse_id: str) -> bool:
    """Reassign a shift to a new nurse."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        UPDATE shifts 
        SET nurse_id = ?, status = 'reassigned', replacement_nurse_id = ?
        WHERE id = ?
    ''', (new_nurse_id, new_nurse_id, shift_id))
    
    conn.commit()
    conn.close()
    return True


# ============ Violation Operations ============

def create_violation(
    nurse_id: str,
    surgery_id: str,
    instrument_name: str,
    instrument_count: int = 1
) -> str:
    """Create a new violation record."""
    violation_id = f'violation-{uuid4().hex[:8]}'
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO violations (id, nurse_id, surgery_id, instrument_name, instrument_count, status)
        VALUES (?, ?, ?, ?, ?, 'under_investigation')
    ''', (violation_id, nurse_id, surgery_id, instrument_name, instrument_count))
    
    conn.commit()
    conn.close()
    
    return violation_id


def get_all_violations() -> List[Dict[str, Any]]:
    """Get all violations."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT v.*, n.name as nurse_name 
        FROM violations v
        LEFT JOIN nurses n ON v.nurse_id = n.id
        ORDER BY v.created_at DESC
    ''')
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


# ============ Investigation Operations ============

def create_investigation(
    nurse_id: str,
    surgery_id: str,
    violation_id: str,
    missing_items: Dict[str, int],
    baseline_image: str = None,
    postop_image: str = None,
    timeline: List[Dict] = None
) -> str:
    """Create a new investigation record."""
    investigation_id = f'investigation-{uuid4().hex[:8]}'
    
    report = {
        'missing_items': missing_items,
        'timeline': timeline or [],
        'created_at': datetime.now().isoformat()
    }
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO investigations (id, nurse_id, surgery_id, violation_id, report_json, baseline_image, postop_image, audit_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_review')
    ''', (investigation_id, nurse_id, surgery_id, violation_id, json.dumps(report), baseline_image, postop_image))
    
    conn.commit()
    conn.close()
    
    return investigation_id


def get_all_investigations() -> List[Dict[str, Any]]:
    """Get all investigations with nurse info."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT i.*, n.name as nurse_name 
        FROM investigations i
        LEFT JOIN nurses n ON i.nurse_id = n.id
        ORDER BY i.created_at DESC
    ''')
    rows = cursor.fetchall()
    conn.close()
    
    investigations = []
    for row in rows:
        inv = dict(row)
        # Parse report_json
        if inv.get('report_json'):
            inv['report'] = json.loads(inv['report_json'])
            inv['missing_items'] = inv['report'].get('missing_items', {})
        investigations.append(inv)
    
    return investigations


def get_investigation(investigation_id: str) -> Optional[Dict[str, Any]]:
    """Get investigation by ID with full details."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT i.*, n.name as nurse_name, n.role as nurse_role
        FROM investigations i
        LEFT JOIN nurses n ON i.nurse_id = n.id
        WHERE i.id = ?
    ''', (investigation_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
    
    inv = dict(row)
    if inv.get('report_json'):
        inv['report'] = json.loads(inv['report_json'])
    
    return inv


# ============ Surgery Session Operations ============

def create_surgery_session(nurse_id: str, nurse_name: str) -> str:
    """Create a new surgery session."""
    session_id = f'surgery-{uuid4().hex[:8]}'
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO surgery_sessions (id, nurse_id, nurse_name, status)
        VALUES (?, ?, ?, 'active')
    ''', (session_id, nurse_id, nurse_name))
    
    conn.commit()
    conn.close()
    
    return session_id


def end_surgery_session(session_id: str) -> bool:
    """End a surgery session."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        UPDATE surgery_sessions 
        SET status = 'completed', ended_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ''', (session_id,))
    
    conn.commit()
    conn.close()
    
    return True


def save_baseline_to_session(session_id: str, baseline_counts: Dict, baseline_image: str = None):
    """Save baseline counts to session."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        UPDATE surgery_sessions 
        SET baseline_counts = ?, baseline_image = ?
        WHERE id = ?
    ''', (json.dumps(baseline_counts), baseline_image, session_id))
    
    conn.commit()
    conn.close()


def save_postop_to_session(session_id: str, final_counts: Dict, postop_image: str = None, investigation_id: str = None):
    """Save post-op results to session."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        UPDATE surgery_sessions 
        SET final_counts = ?, postop_image = ?, investigation_id = ?
        WHERE id = ?
    ''', (json.dumps(final_counts), postop_image, investigation_id, session_id))
    
    conn.commit()
    conn.close()


def get_session(session_id: str) -> Optional[Dict[str, Any]]:
    """Get surgery session by ID."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM surgery_sessions WHERE id = ?', (session_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
    
    session = dict(row)
    if session.get('baseline_counts'):
        session['baseline_counts'] = json.loads(session['baseline_counts'])
    if session.get('final_counts'):
        session['final_counts'] = json.loads(session['final_counts'])
    
    return session


# ============ Surgery Assignment Operations ============

def get_surgery_assignment(surgery_id: str) -> Optional[Dict[str, Any]]:
    """Get surgery assignment by surgery ID."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT sa.*, n.name as nurse_name, n.role as nurse_role
        FROM surgery_assignments sa
        LEFT JOIN nurses n ON sa.nurse_id = n.id
        WHERE sa.surgery_id = ?
    ''', (surgery_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


# Initialize on import
if __name__ != '__main__':
    init_database()
    seed_dummy_data()
