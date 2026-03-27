import sqlite3
from db_engine import get_db

with get_db() as conn:
    print("Environments in table:", [r[0] for r in conn.execute("SELECT name FROM environments").fetchall()])
    rows = conn.execute("SELECT e.name as env, MAX(s.timestamp) as last_scan FROM environments e LEFT JOIN scans s ON e.name = s.env GROUP BY e.name ORDER BY last_scan DESC").fetchall()
    print("Environments from LEFT JOIN:", [r["env"] for r in rows])
