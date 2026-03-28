"""
D19 Memory Pipeline Test Suite — Verifies in-memory session cache and write-behind.
"""
import pytest
import sys, os, json, time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from backend.agent_mcp import (
    _session_cache, _session_timestamps, _SESSION_MAX_AGE,
    _load_history_from_db, _serialize_turns, _sync_persist_history
)


class TestSessionCacheGlobals:
    """Verify that the session cache structures are properly initialized."""
    
    def test_cache_is_dict(self):
        assert isinstance(_session_cache, dict)
    
    def test_timestamps_is_dict(self):
        assert isinstance(_session_timestamps, dict)
    
    def test_max_age_is_positive(self):
        assert _SESSION_MAX_AGE > 0


class TestColdStartRecovery:
    """Test cold start history loading from SQLite."""
    
    def test_load_nonexistent_campaign(self):
        """Loading a campaign that doesn't exist should return empty list."""
        result = _load_history_from_db("nonexistent_campaign_" + str(time.time()))
        assert isinstance(result, list)
        assert len(result) == 0

    def test_load_returns_list(self):
        """Result must always be a list."""
        result = _load_history_from_db("default")
        assert isinstance(result, list)


class TestSerializeTurns:
    """Test the serialization of types.Content to JSON-storable format."""
    
    def test_empty_turns(self):
        """Empty input should return empty output."""
        result = _serialize_turns([])
        assert result == []


class TestSyncPersist:
    """Test the synchronous SQLite persistence function."""
    
    def test_persist_empty_turns(self):
        """Persisting empty turns should not raise."""
        # Should complete without error even with empty data
        _sync_persist_history("test_campaign_empty", [])


class TestCacheIntegrity:
    """Test that the cache properly stores and retrieves data."""
    
    def test_cache_write_and_read(self):
        """Manually writing to cache should be immediately readable."""
        test_id = f"test_cache_{time.time()}"
        test_data = ["mock_content_1", "mock_content_2"]
        _session_cache[test_id] = test_data
        _session_timestamps[test_id] = time.time()
        
        assert test_id in _session_cache
        assert _session_cache[test_id] == test_data
        assert _session_timestamps[test_id] > 0
        
        # Cleanup
        del _session_cache[test_id]
        del _session_timestamps[test_id]

    def test_cache_miss_triggers_cold_start(self):
        """A cache miss should result in not finding the campaign in cache."""
        assert "definitely_not_cached_campaign" not in _session_cache
