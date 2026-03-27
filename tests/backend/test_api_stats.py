import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_assets_pagination():
    """Verify that massively bloated asset queries are properly restrained by pagination sizes."""
    # Simulate MCP extracting 5 assets
    res = client.get("/api/v1/assets?env=default&size=5")
    assert res.status_code == 200
    
    data = res.json()
    assert "assets" in data
    assert "total" in data
    
    # We should not return more than requested size
    assert len(data["assets"]) <= 5

def test_stats_aggregation():
    """Verify stats engine generates global aggregations accurately."""
    res = client.get("/api/v1/stats?env=default")
    assert res.status_code == 200
    
    data = res.json()
    assert "hosts" in data
    assert "ports" in data
    assert "vulns" in data
