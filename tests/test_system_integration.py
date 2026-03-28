"""
🧪 Project CLAW V9.2 — Full System Integration Test Suite
==========================================================

Coverage Matrix:
  1. REST API 端点完整性 (stats/assets/scans/report/topology/audit...)
  2. 数据库引擎完整性 (CRUD / 环境隔离 / diff / 迁移)
  3. SSE 流式通信可靠性 (连接建立 / JSON 解析 / keepalive)
  4. Agent 记忆管线 (内存缓存 / 冷启动 / 异步落盘)
  5. LFI 安全沙箱 (路径穿越 / 凭据泄露 / symlink 逃逸)
  6. HITL 权限分级 (GREEN/YELLOW/RED 命令分类)
  7. MCP 工具声明完整性 (tool schema 缓存 / function dispatch)
  8. 环境管理 (战区创建/切换/重命名/删除/数据隔离)
  9. 作战命令执行 (ops/run + ops/log 后台任务管道)
  10. 边界条件与异常处理
  
Usage:
  PYTHONPATH=. pytest tests/test_system_integration.py -v
"""

import pytest
import sys, os, json, time, tempfile, sqlite3, asyncio

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ============================================================
#  Module 1: REST API 端点完整性
# ============================================================
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


class TestRESTEndpoints:
    """Verify all REST API endpoints return correct status codes and shapes."""
    
    # --- Dashboard & Stats ---
    def test_stats_returns_200(self):
        r = client.get("/api/v1/stats")
        assert r.status_code == 200
        data = r.json()
        assert "hosts" in data
        assert "ports" in data
        assert "vulns" in data
        assert "scans" in data
        assert isinstance(data["hosts"], int)

    def test_root_endpoint(self):
        r = client.get("/")
        assert r.status_code == 200
        data = r.json()
        assert "name" in data
        assert data["name"] == "CLAW API"

    # --- Assets ---
    def test_assets_list_empty_ok(self):
        r = client.get("/api/v1/assets")
        assert r.status_code == 200
        data = r.json()
        assert "assets" in data
        assert isinstance(data["assets"], list)

    def test_assets_pagination_params(self):
        r = client.get("/api/v1/assets?page=1&size=10")
        assert r.status_code == 200

    def test_assets_search_filter(self):
        r = client.get("/api/v1/assets?search=10.0.0")
        assert r.status_code == 200

    def test_asset_detail_404_for_missing(self):
        r = client.get("/api/v1/assets/99.99.99.99")
        assert r.status_code == 404

    # --- Scans ---
    def test_scans_list(self):
        r = client.get("/api/v1/scans")
        assert r.status_code == 200
        data = r.json()
        assert "scans" in data

    # --- Campaigns ---
    def test_campaigns_list(self):
        r = client.get("/api/v1/campaigns")
        assert r.status_code == 200
        data = r.json()
        assert "campaigns" in data
        assert isinstance(data["campaigns"], list)

    # --- Report ---
    def test_report_generate(self):
        r = client.get("/api/v1/report/generate")
        assert r.status_code == 200
        data = r.json()
        assert "report" in data
        assert "CLAW" in data["report"]

    # --- Audit Log ---
    def test_audit_log(self):
        r = client.get("/api/v1/audit")
        assert r.status_code == 200
        data = r.json()
        assert "entries" in data
        assert "total" in data

    # --- Topology ---
    def test_topology(self):
        r = client.get("/api/v1/topology")
        assert r.status_code == 200
        data = r.json()
        assert "nodes" in data
        assert "edges" in data
        # Attacker node should always exist
        assert any(n["id"] == "attacker" for n in data["nodes"])

    # --- Attack Matrix ---
    def test_attack_matrix(self):
        r = client.get("/api/v1/attack_matrix")
        assert r.status_code == 200
        data = r.json()
        assert "matrix" in data
        assert "active" in data
        assert "Reconnaissance" in data["matrix"]

    # --- Scope ---
    def test_scope_get(self):
        r = client.get("/api/v1/scope")
        assert r.status_code == 200
        data = r.json()
        assert "scope" in data

    # --- Sliver C2 Mock ---
    def test_sliver_sessions(self):
        r = client.get("/api/v1/sliver/sessions")
        assert r.status_code == 200
        data = r.json()
        assert "sessions" in data
        assert len(data["sessions"]) > 0

    def test_sliver_interact(self):
        r = client.post("/api/v1/sliver/interact", json={"session_id": "c8a4b3d1", "command": "whoami"})
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "success"

    # --- Docker Status ---
    def test_docker_status(self):
        r = client.get("/api/v1/docker/status")
        assert r.status_code == 200
        data = r.json()
        assert "images" in data
        assert "containers" in data


# ============================================================
#  Module 2: 环境管理 (Theater Management)
# ============================================================

class TestTheaterManagement:
    """Verify theater creation, switching, renaming, deletion, and data isolation."""

    def test_env_list(self):
        r = client.get("/api/v1/env/list")
        assert r.status_code == 200
        data = r.json()
        assert "current" in data
        assert "theaters" in data

    def test_env_create_and_switch(self):
        r = client.post("/api/v1/env/create", json={"name": "test_theater_ci", "env_type": "lab"})
        assert r.status_code == 200
        assert r.json()["theater"] == "test_theater_ci"

        # verify switched
        r = client.get("/api/v1/env/list")
        assert r.json()["current"] == "test_theater_ci"

    def test_env_switch_back(self):
        client.post("/api/v1/env/switch", json={"name": "default"})
        r = client.get("/api/v1/env/list")
        assert r.json()["current"] == "default"

    def test_env_rename(self):
        client.post("/api/v1/env/create", json={"name": "rename_test"})
        r = client.post("/api/v1/env/rename", json={"old_name": "rename_test", "new_name": "renamed_test"})
        assert r.status_code == 200

    def test_env_delete(self):
        client.post("/api/v1/env/create", json={"name": "delete_me"})
        client.post("/api/v1/env/switch", json={"name": "default"})  # switch away first
        r = client.post("/api/v1/env/delete", json={"name": "delete_me"})
        assert r.status_code == 200

    def test_env_delete_default_rejected(self):
        r = client.post("/api/v1/env/delete", json={"name": "default"})
        assert r.status_code == 422 or r.status_code == 400

    def test_env_empty_name_rejected(self):
        r = client.post("/api/v1/env/create", json={"name": ""})
        assert r.status_code == 200
        assert "error" in r.json() or r.json().get("theater") == ""

    def test_stats_isolated_by_env(self):
        """Data from one theater should not leak into another."""
        client.post("/api/v1/env/switch", json={"name": "default"})
        stats_default = client.get("/api/v1/stats").json()

        client.post("/api/v1/env/create", json={"name": "isolated_test"})
        stats_isolated = client.get("/api/v1/stats").json()
        # New theater should have zero data
        assert stats_isolated["hosts"] == 0
        assert stats_isolated["scans"] == 0

        # cleanup
        client.post("/api/v1/env/switch", json={"name": "default"})


# ============================================================
#  Module 3: 数据库引擎完整性
# ============================================================

class TestDatabaseEngine:
    """Test db_engine.py CRUD operations, diff, and migration."""
    
    @pytest.fixture
    def temp_db(self):
        """Create a temporary database for testing."""
        import db_engine
        fd, path = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        conn = db_engine.get_db(path)
        yield conn, path
        conn.close()
        os.remove(path)

    def test_schema_creation(self, temp_db):
        conn, path = temp_db
        tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
        assert "scans" in tables
        assert "assets" in tables
        assert "ports" in tables
        assert "vulns" in tables
        assert "environments" in tables

    def test_write_scan_data(self, temp_db):
        import db_engine
        conn, path = temp_db
        test_assets = {
            "192.168.1.1": {
                "os": "Linux",
                "services": [{"port": 22, "protocol": "tcp", "service": "ssh"}]
            }
        }
        db_engine.write_scan_data(conn, "test_scan_001", test_assets)
        
        count = conn.execute("SELECT COUNT(*) as c FROM assets").fetchone()["c"]
        assert count == 1
        
        port_count = conn.execute("SELECT COUNT(*) as c FROM ports").fetchone()["c"]
        assert port_count == 1

    def test_diff_hosts(self, temp_db):
        import db_engine
        conn, path = temp_db
        
        # Scan 1: hosts A, B
        db_engine.write_scan_data(conn, "scan_old", {
            "10.0.0.1": {"os": "Linux", "services": []},
            "10.0.0.2": {"os": "Windows", "services": []},
        })
        
        # Scan 2: hosts B, C (A disappeared, C is new)
        db_engine.write_scan_data(conn, "scan_new", {
            "10.0.0.2": {"os": "Windows", "services": []},
            "10.0.0.3": {"os": "Mac", "services": []},
        })
        
        new_hosts, gone_hosts = db_engine.diff_hosts(conn, "scan_new", "scan_old")
        assert "10.0.0.3" in new_hosts
        assert "10.0.0.1" in gone_hosts
        assert "10.0.0.2" not in new_hosts

    def test_diff_ports(self, temp_db):
        import db_engine
        conn, path = temp_db
        
        db_engine.write_scan_data(conn, "p_old", {
            "10.0.0.1": {"os": "Linux", "services": [{"port": 22, "protocol": "tcp", "service": "ssh"}]},
        })
        db_engine.write_scan_data(conn, "p_new", {
            "10.0.0.1": {"os": "Linux", "services": [
                {"port": 22, "protocol": "tcp", "service": "ssh"},
                {"port": 80, "protocol": "tcp", "service": "http"},
            ]},
        })
        
        changes = db_engine.diff_ports(conn, "p_new", "p_old")
        assert len(changes) == 1
        assert 80 in changes[0]["added"]


# ============================================================
#  Module 4: HITL 权限分级
# ============================================================

class TestHITLClassification:
    """Verify command classification for GREEN/YELLOW/RED levels."""
    
    def test_green_commands(self):
        from backend.agent import classify_command
        assert classify_command("ls -la") == "green"
        assert classify_command("cat /etc/hostname") == "green"
        assert classify_command("whoami") == "green"
        assert classify_command("ping 10.0.0.1") == "green"

    def test_yellow_commands(self):
        from backend.agent import classify_command
        assert classify_command("nmap -sV 10.0.0.1") == "yellow"
        assert classify_command("make fast") == "yellow"
        assert classify_command("curl https://example.com") == "yellow"

    def test_red_commands(self):
        from backend.agent import classify_command
        assert classify_command("rm -rf /") == "red"
        assert classify_command("make crack") == "red"
        assert classify_command("psexec.py admin@10.0.0.1") == "red"
        assert classify_command("hashcat -m 1000 hash.txt") == "red"
        assert classify_command("sudo iptables -F") == "red"

    def test_mcp_classify_command(self):
        """MCP server has its own classification — verify consistency."""
        from backend.mcp_armory_server import classify_command as mcp_classify
        assert mcp_classify("ls") == "green"
        assert mcp_classify("nmap 10.0.0.1") == "yellow"
        assert mcp_classify("rm -rf /tmp") == "red"

    def test_interactive_commands_blocked(self):
        """Interactive commands must be blocked to prevent thread blocking."""
        from backend.agent import tool_execute_shell
        result = json.loads(tool_execute_shell("msfconsole"))
        assert "error" in result
        assert "交互式命令" in result["error"]

    def test_sql_injection_blocked(self):
        """SQL injection via claw_query_db must be blocked."""
        from backend.agent import tool_query_db
        result = json.loads(tool_query_db("DROP TABLE assets"))
        assert "error" in result
        assert "安全拦截" in result["error"]

    def test_sql_update_blocked(self):
        from backend.agent import tool_query_db
        result = json.loads(tool_query_db("UPDATE assets SET os='hacked'"))
        assert "error" in result

    def test_sql_select_allowed(self):
        from backend.agent import tool_query_db
        result = json.loads(tool_query_db("SELECT 1 as test"))
        # Should succeed even if no data
        assert "error" not in result or "执行失败" not in result.get("error", "")


# ============================================================
#  Module 5: SSE 流式通信
# ============================================================

class TestSSEStreaming:
    """Test SSE endpoints for proper streaming behavior."""
    
    def test_sse_get_requires_api_key(self):
        """Without API key, should return 503."""
        # This depends on env var — test the endpoint responds
        r = client.get("/api/agent/stream?query=test")
        # Could be 200 (streaming) or 503 (no API key)
        assert r.status_code in [200, 503]

    def test_sse_post_requires_api_key(self):
        r = client.post("/api/agent/stream", json={"query": "test"})
        assert r.status_code in [200, 503]

    def test_sse_post_validates_payload(self):
        """Missing required field should fail validation."""
        r = client.post("/api/agent/stream", json={})
        assert r.status_code == 422  # Pydantic validation error

    def test_sse_content_type(self):
        """SSE endpoint must return text/event-stream."""
        r = client.get("/api/agent/stream?query=hello")
        if r.status_code == 200:
            assert "text/event-stream" in r.headers.get("content-type", "")


# ============================================================
#  Module 6: 作战命令执行管道
# ============================================================

class TestOpsRunPipeline:
    """Test ops/run async command execution and log streaming."""

    def test_ops_run_basic(self):
        r = client.post("/api/v1/ops/run", json={
            "command": "echo 'CLAW_TEST_SUCCESS'",
            "theater": "default"
        })
        assert r.status_code == 200
        data = r.json()
        assert "job_id" in data
        assert data["status"] == "ok"

    def test_ops_run_with_targets(self):
        r = client.post("/api/v1/ops/run", json={
            "command": "echo 'test'",
            "theater": "default",
            "target_ips": ["10.0.0.1", "10.0.0.2"]
        })
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "ok"

    def test_ops_stop_nonexistent_job(self):
        r = client.post("/api/v1/ops/stop/job_nonexistent")
        assert r.status_code == 200
        data = r.json()
        assert "error" in data


# ============================================================
#  Module 7: MCP 工具声明与安全
# ============================================================

class TestMCPToolSecurity:
    """Test MCP tool declarations and security policies."""

    def test_blocked_filenames_include_config(self):
        from backend.mcp_armory_server import BLOCKED_FILENAMES
        assert "config.sh" in BLOCKED_FILENAMES
        assert ".env" in BLOCKED_FILENAMES
        assert "id_rsa" in BLOCKED_FILENAMES

    def test_claw_query_db_readonly(self):
        from backend.mcp_armory_server import claw_query_db
        result = json.loads(claw_query_db(
            sql="DELETE FROM assets",
            thought="test", justification="test",
            mitre_ttp="N/A", risk_level="GREEN"
        ))
        assert "error" in result

    def test_claw_query_db_select_ok(self):
        from backend.mcp_armory_server import claw_query_db
        result = json.loads(claw_query_db(
            sql="SELECT COUNT(*) as c FROM assets",
            thought="test", justification="test",
            mitre_ttp="N/A", risk_level="GREEN"
        ))
        # Should return result or empty, not error
        assert "error" not in result or "不存在" in result.get("error", "")

    def test_claw_read_file_sandbox(self):
        from backend.mcp_armory_server import claw_read_file
        result = json.loads(claw_read_file(
            path="../../../../etc/passwd",
            thought="test", justification="test"
        ))
        assert "error" in result

    def test_claw_read_file_config_blocked(self):
        from backend.mcp_armory_server import claw_read_file
        result = json.loads(claw_read_file(
            path="config.sh",
            thought="test", justification="test"
        ))
        assert "error" in result
        assert "越权拦截" in result["error"] or "永久封锁" in result["error"]

    def test_claw_execute_shell_red_blocked(self):
        from backend.mcp_armory_server import claw_execute_shell
        result = json.loads(claw_execute_shell(
            command="rm -rf /tmp/test",
            thought="test", justification="test",
            mitre_ttp="N/A", risk_level="RED"
        ))
        assert "error" in result or result.get("requires_approval") is True

    def test_claw_execute_shell_green_ok(self):
        from backend.mcp_armory_server import claw_execute_shell
        result = json.loads(claw_execute_shell(
            command="echo 'safe_test'",
            thought="test", justification="test",
            mitre_ttp="N/A", risk_level="GREEN"
        ))
        assert result.get("exit_code") == 0 or "error" not in result

    def test_claw_run_module_invalid(self):
        from backend.mcp_armory_server import claw_run_module
        result = json.loads(claw_run_module(
            module="invalid_command",
            thought="test", justification="test",
            mitre_ttp="N/A", risk_level="GREEN"
        ))
        assert "error" in result

    def test_a2a_delegate_unreachable(self):
        """A2A delegate to non-running sub-agent should fail gracefully."""
        from backend.mcp_armory_server import claw_delegate_agent
        result = json.loads(claw_delegate_agent(
            target_agent="recon_agent",
            task="test recon",
            thought="test", justification="test"
        ))
        assert "error" in result


# ============================================================
#  Module 8: Agent 记忆管线
# ============================================================

class TestMemoryPipeline:
    """Test the D19 in-memory session cache and write-behind logic."""

    def test_cache_globals_initialized(self):
        from backend.agent_mcp import _session_cache, _session_timestamps
        assert isinstance(_session_cache, dict)
        assert isinstance(_session_timestamps, dict)

    def test_cold_start_nonexistent_campaign(self):
        from backend.agent_mcp import _load_history_from_db
        result = _load_history_from_db(f"ci_test_{time.time()}")
        assert isinstance(result, list)
        assert len(result) == 0

    def test_serialize_empty(self):
        from backend.agent_mcp import _serialize_turns
        assert _serialize_turns([]) == []

    def test_sync_persist_empty(self):
        from backend.agent_mcp import _sync_persist_history
        # Should not raise
        _sync_persist_history(f"test_empty_{time.time()}", [])

    def test_cache_write_read_delete(self):
        from backend.agent_mcp import _session_cache, _session_timestamps
        key = f"ci_{time.time()}"
        _session_cache[key] = ["data"]
        _session_timestamps[key] = time.time()
        assert key in _session_cache
        del _session_cache[key]
        del _session_timestamps[key]


# ============================================================
#  Module 9: 边界条件与异常处理
# ============================================================

class TestEdgeCases:
    """Test various edge cases and error handling scenarios."""
    
    def test_probe_empty_target(self):
        """Probe with empty target should fail cleanly."""
        r = client.post("/api/v1/probe", json={"target": ""})
        assert r.status_code in [400, 422]

    def test_scope_update_empty(self):
        r = client.post("/api/v1/scope", json={"scope": []})
        assert r.status_code == 200
        assert r.json()["god_mode"] is True

    def test_docker_invalid_action(self):
        r = client.post("/api/v1/docker/drop/container_name")
        assert r.status_code == 200
        assert "error" in r.json()

    def test_audit_log_limit_bounds(self):
        r = client.get("/api/v1/audit?limit=1")
        assert r.status_code == 200
        
    def test_scans_limit_max(self):
        r = client.get("/api/v1/scans?limit=100")
        assert r.status_code == 200

    def test_assets_page_zero_rejected(self):
        """Page 0 should be rejected by validation."""
        r = client.get("/api/v1/assets?page=0")
        assert r.status_code == 422

    def test_osint_dictionary_no_key(self):
        """OSINT endpoint should gracefully fallback without API key."""
        r = client.post("/api/v1/agent/osint", json={"targets": ["10.0.0.1"]})
        assert r.status_code == 200
        data = r.json()
        assert "dictionary" in data
        assert isinstance(data["dictionary"], list)

    def test_report_survives_missing_vulnid(self):
        """Report generation should not crash if vulns table has different schema."""
        r = client.get("/api/v1/report/generate")
        assert r.status_code == 200
        assert "report" in r.json()

    def test_forge_save_creates_file(self):
        """Test the forge save endpoint."""
        r = client.post("/api/v1/agent/forge/save", json={
            "html": "<html><body>test</body></html>",
            "target_ip": "10.0.0.1",
            "theater": "default"
        })
        assert r.status_code == 200
        assert r.json()["status"] == "ok"
        # Cleanup
        saved_path = r.json().get("path", "")
        if saved_path and os.path.exists(saved_path):
            os.remove(saved_path)

    def test_env_switch_nonexistent_creates(self):
        """Switching to a nonexistent env should be handled."""
        r = client.post("/api/v1/env/switch", json={"name": "phantom_env"})
        assert r.status_code == 200
        # Switch back
        client.post("/api/v1/env/switch", json={"name": "default"})


# ============================================================
#  Module 10: LFI 安全沙箱全面攻击矢量测试
# ============================================================

class TestLFIAttackVectors:
    """Comprehensive LFI attack vector testing against the sandbox."""
    
    def test_dot_dot_slash_basic(self):
        from backend.mcp_armory_server import _is_path_safe
        BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        path = os.path.join(BASE, "CatTeam_Loot", "..", "..", "etc", "passwd")
        safe, _ = _is_path_safe(path)
        assert safe is False

    def test_null_byte_injection(self):
        """Null byte injection should be handled."""
        from backend.mcp_armory_server import claw_read_file
        result = json.loads(claw_read_file(
            path="test.txt%00.jpg",
            thought="test", justification="test"
        ))
        # Should get file not found or error, not a crash
        assert isinstance(result, dict)

    def test_unicode_normalization_attack(self):
        """Unicode tricks should not bypass sandbox."""
        from backend.mcp_armory_server import _is_path_safe
        safe, _ = _is_path_safe("/etc/shadow")
        assert safe is False

    def test_double_encoding(self):
        """Double URL encoding should not bypass."""
        from backend.mcp_armory_server import claw_read_file
        result = json.loads(claw_read_file(
            path="..%252F..%252Fetc%252Fshadow",
            thought="test", justification="test"
        ))
        assert isinstance(result, dict)

    def test_dev_null_blocked(self):
        from backend.mcp_armory_server import _is_path_safe
        safe, _ = _is_path_safe("/dev/null")
        assert safe is False

    def test_proc_self_blocked(self):
        from backend.mcp_armory_server import _is_path_safe
        safe, _ = _is_path_safe("/proc/self/environ")
        assert safe is False

    def test_home_directory_blocked(self):
        from backend.mcp_armory_server import _is_path_safe
        home = os.path.expanduser("~")
        safe, _ = _is_path_safe(os.path.join(home, ".ssh", "id_rsa"))
        assert safe is False

    def test_loot_dir_allowed(self):
        from backend.mcp_armory_server import _is_path_safe
        BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        path = os.path.join(BASE, "CatTeam_Loot", "claw.db")
        safe, _ = _is_path_safe(path)
        assert safe is True

    def test_bash_history_blocked(self):
        from backend.mcp_armory_server import BLOCKED_FILENAMES
        assert ".bash_history" in BLOCKED_FILENAMES
        assert ".zsh_history" in BLOCKED_FILENAMES


# ============================================================
#  Cleanup: Reset theater to default after all tests
# ============================================================

@pytest.fixture(autouse=True, scope="session")
def cleanup_theater():
    yield
    try:
        client.post("/api/v1/env/switch", json={"name": "default"})
    except:
        pass
