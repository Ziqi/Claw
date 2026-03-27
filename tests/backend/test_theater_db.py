from fastapi.testclient import TestClient
from backend.main import app, get_db
from db_engine import set_current_env, get_current_env
import uuid

import uuid

client = TestClient(app)

def test_theater_db_multi_tenant_isolation():
    """Verify that assets posted to one environment cannot be read by another."""
    
    env_target = "test_alpha"
    env_attacker = "test_beta"
    mock_id = f"mock_scan_{uuid.uuid4().hex[:8]}"
    
    # 1. Simulate an asset discovery injected into ALPHA theater
    # We directly inject a mocked scan into SQLite because there's no public API to insert raw assets yet
    original_env = get_current_env()
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("INSERT INTO scans (scan_id, env, timestamp) VALUES (?, ?, datetime('now'))", (mock_id, env_target))
            conn.commit()
            
            cursor.execute("INSERT INTO assets (scan_id, ip, os) VALUES (?, ?, ?)", (mock_id, "10.0.0.99", "Linux"))
            conn.commit()
        
        # 2. Assert ALPHA can view the asset
        set_current_env(env_target)
        res_alpha = client.get(f"/api/v1/assets?size=10")
        assert res_alpha.status_code == 200
        assert len(res_alpha.json()["assets"]) == 1
        assert res_alpha.json()["assets"][0]["ip"] == "10.0.0.99"
        
        # 3. Assert BETA cannot view the asset (Strict Multi-Tenant Firewall)
        set_current_env(env_attacker)
        res_beta = client.get(f"/api/v1/assets?size=10")
        assert res_beta.status_code == 200
        assert len(res_beta.json()["assets"]) == 0
        
    finally:
        set_current_env(original_env)
        # Teardown
        with get_db() as conn:
            conn.execute("DELETE FROM assets WHERE scan_id=?", (mock_id,))
            conn.execute("DELETE FROM scans WHERE scan_id=?", (mock_id,))
            conn.execute("DELETE FROM scans WHERE env=?", (env_attacker,))
            conn.commit()
