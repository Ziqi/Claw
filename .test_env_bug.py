from backend.main import env_create, EnvCreateRequest, env_list
import sqlite3
from db_engine import get_db

# Trigger initialization
get_db()

# Test creating a new blank theater
env_create(EnvCreateRequest(name="GhostTheater"))

# View listing output
result = env_list()
found = any(e['name'] == 'GhostTheater' for e in result['theaters'])
print("SUCCESS: GhostTheater found in env_list():", found)
print([e['name'] for e in result['theaters']])
