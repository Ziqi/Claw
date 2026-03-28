"""
D19 LFI Sandbox Test Suite — Verifies the physical path traversal jail.
"""
import pytest
import sys, os, json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from backend.mcp_armory_server import claw_read_file, _is_path_safe, BLOCKED_FILENAMES


class TestPathSafety:
    """Test the dual-layer path safety validator."""
    
    def test_loot_dir_allowed(self):
        """Files within CatTeam_Loot should be allowed."""
        base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        loot_path = os.path.join(base, "CatTeam_Loot", "test.txt")
        safe, reason = _is_path_safe(loot_path)
        assert safe is True, f"Loot dir should be allowed but got: {reason}"

    def test_project_script_allowed(self):
        """Project scripts (*.py) should be allowed."""
        base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        script_path = os.path.join(base, "02.5-parse.py")
        safe, reason = _is_path_safe(script_path)
        assert safe is True, f"Project scripts should be allowed but got: {reason}"

    def test_etc_shadow_blocked(self):
        """Absolute system paths like /etc/shadow must be blocked."""
        safe, reason = _is_path_safe("/etc/shadow")
        assert safe is False
        assert "系统目录穿越" in reason

    def test_etc_passwd_blocked(self):
        safe, reason = _is_path_safe("/etc/passwd")
        assert safe is False

    def test_path_traversal_blocked(self):
        """../../../etc/shadow style traversal must be blocked."""
        base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        evil_path = os.path.join(base, "CatTeam_Loot", "..", "..", "..", "etc", "shadow")
        safe, reason = _is_path_safe(evil_path)
        assert safe is False, f"Path traversal should be blocked but got: safe={safe}, reason={reason}"

    def test_config_sh_blocked(self):
        """config.sh (contains API Key) must be permanently blocked."""
        base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        config_path = os.path.join(base, "config.sh")
        safe, reason = _is_path_safe(config_path)
        assert safe is False
        assert "永久封锁" in reason

    def test_env_file_blocked(self):
        """.env file must be blocked."""
        base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        env_path = os.path.join(base, ".env")
        safe, reason = _is_path_safe(env_path)
        assert safe is False

    def test_ssh_key_blocked(self):
        """SSH private key must be blocked."""
        safe, reason = _is_path_safe(os.path.expanduser("~/.ssh/id_rsa"))
        assert safe is False

    def test_home_dir_blocked(self):
        """Home directory traversal must be blocked."""
        safe, reason = _is_path_safe("/home/user/secrets.txt")
        assert safe is False


class TestClawReadFile:
    """Integration tests for the claw_read_file MCP tool."""

    def test_read_existing_loot_file(self):
        """Reading a file in CatTeam_Loot should work (if it exists)."""
        result = json.loads(claw_read_file(
            path="claw.db",
            thought="test", justification="test read",
            max_lines=1
        ))
        # Either succeeds or says file not found — both are valid non-security-error responses
        assert "致命越权拦截" not in result.get("error", "")

    def test_read_config_sh_blocked(self):
        """Attempting to read config.sh must be physically blocked."""
        result = json.loads(claw_read_file(
            path="../config.sh",
            thought="test", justification="test read config",
        ))
        assert "error" in result
        assert "致命越权拦截" in result["error"] or "永久封锁" in result["error"]

    def test_read_etc_shadow_blocked(self):
        """Attempting to read /etc/shadow via path traversal must not succeed."""
        result = json.loads(claw_read_file(
            path="../../../../etc/shadow",
            thought="test", justification="test LFI",
        ))
        assert "error" in result
        # On macOS /etc/shadow doesn't exist, so glob returns "file not found" before reaching security check.
        # The critical path traversal defense is verified by TestPathSafety::test_path_traversal_blocked.
        assert "致命越权拦截" in result["error"] or "文件不存在" in result["error"]

    def test_blocked_filenames_comprehensive(self):
        """All blocked filenames must be in the set."""
        assert "config.sh" in BLOCKED_FILENAMES
        assert ".env" in BLOCKED_FILENAMES
        assert "id_rsa" in BLOCKED_FILENAMES
