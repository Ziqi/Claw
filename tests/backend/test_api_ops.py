import pytest
from fastapi.testclient import TestClient
from backend.main import app, ACTIVE_JOBS
import time

client = TestClient(app)

def test_ops_run_and_stop_lifecycle():
    """Verify the orchestration of OP pipelines, background execution, and cleanup mechanics."""
    # 1. Dispatch a fast recon command
    res = client.post("/api/v1/ops/run", json={"command": "sleep 0.1", "theater": "default"})
    assert res.status_code == 200
    
    data = res.json()
    assert "job_id" in data
    job_id = data["job_id"]
    
    # 2. Execute process termination (Sniper kill).
    # Since TestClient resolves BackgroundTasks blocks inline, the process may already be completed:
    res_stop = client.post(f"/api/v1/ops/stop/{job_id}")
    assert res_stop.status_code == 200
