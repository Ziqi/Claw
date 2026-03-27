import pytest
from backend.mcp_armory_server import claw_query_db
import sqlite3
import os

def test_agent_sql_injection_defense():
    """Verify that the AI Agent's database query tool fundamentally blocks destructive SQL injections."""
    
    # 1. Normal SELECT query (Should pass and return JSON data)
    safe_sql = "SELECT ip, os FROM assets LIMIT 1"
    res = claw_query_db(safe_sql, thought="recon", justification="audit")
    assert not isinstance(res, str) or "error" not in res.lower() # usually returns list or str
    
    # 2. Destructive DROP TABLE query (Must be blocked)
    danger_sql_1 = "DROP TABLE assets"
    danger_res_1 = claw_query_db(danger_sql_1, thought="destroy", justification="evil")
    # The agent function should return an error string or raise an exception securely. It must NOT execute.
    assert "error" in danger_res_1.lower() or "not allowed" in danger_res_1.lower() or "只允许" in danger_res_1 or "安全拦截" in danger_res_1

    # 3. Hidden multiple-statement injection
    danger_sql_2 = "SELECT * FROM assets; DELETE FROM scans"
    danger_res_2 = claw_query_db(danger_sql_2, thought="bypass", justification="evil")
    assert "error" in danger_res_2.lower() or "not allowed" in danger_res_2.lower() or "只允许" in danger_res_2 or "禁止" in danger_res_2

    # 4. Destructive UPDATE query
    danger_sql_3 = "UPDATE assets SET os='pwned'"
    danger_res_3 = claw_query_db(danger_sql_3, thought="tamper", justification="evil")
    assert "error" in danger_res_3.lower() or "not allowed" in danger_res_3.lower() or "只允许" in danger_res_3 or "禁止" in danger_res_3
