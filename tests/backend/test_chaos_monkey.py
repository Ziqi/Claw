import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch
from backend.main import app

client = TestClient(app, raise_server_exceptions=False)

def test_chaos_monkey_disk_full_degradation():
    """Verify that a catastrophic physical disk OS Error (e.g. No space left on device) 
    fails gracefully with HTTP 500 instead of terminating the Uvicorn host process."""
    
    # 模拟磁盘耗尽: OSError [Errno 28] No space left on device
    mock_os_error = OSError(28, "No space left on device")
    
    with patch("os.makedirs", side_effect=mock_os_error):
        res = client.post("/api/v1/ops/run", json={"command": "whoami", "theater": "default"})
        
        # Uvicorn/FastAPI must catch the unhandled Kernel Exception and emit a generic 500,
        # shielding the overall web server event loop from fatal termination.
        assert res.status_code == 500
        assert "Internal Server Error" in res.text

def test_chaos_monkey_sqlite_locked():
    """Verify that a SQLite concurrency lock fail (OperationalError: database is locked)
    does not deadlock the API but rather returns an immediate 500 traceback."""
    import sqlite3
    
    mock_db_error = sqlite3.OperationalError("database is locked")
    
    # Mocking the SQLite connect layer to fail
    with patch("sqlite3.connect", side_effect=mock_db_error):
        res = client.get("/api/v1/stats?env=default")
        
        assert res.status_code == 500
        assert "database is locked" in res.text or "Internal Server Error" in res.text
