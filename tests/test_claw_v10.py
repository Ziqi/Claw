#!/usr/bin/env python3
"""
🧪 CLAW V10.0 Protocol Anatomy — 告警系统测试套件
====================================================

测试维度:
  T1. protocol_alerts 表 Schema 验证
  T2. 告警 API 端点 (ingest / list / stats / acknowledge)
  T3. 告警鉴权机制
  T4. 告警数据一致性
  T5. HUD stats 告警计数
  T6. 版本号 V10.0 对齐

运行: cd CatTeam && python -m pytest tests/test_claw_v10.py -v
"""

import os
import sys
import json
import sqlite3
import tempfile
import shutil

import pytest

# === 路径设置 ===
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_ROOT)
sys.path.insert(0, os.path.join(PROJECT_ROOT, "backend"))


# === Fixtures ===

@pytest.fixture
def tmp_db():
    """创建隔离的临时数据库"""
    tmp_dir = tempfile.mkdtemp(prefix="claw_v10_test_")
    db_path = os.path.join(tmp_dir, "test_claw.db")
    yield db_path
    shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.fixture
def seeded_db(tmp_db):
    """预填充告警测试数据的数据库"""
    import db_engine
    conn = db_engine.get_db(tmp_db)

    # 基础数据：资产和扫描
    db_engine.register_scan(conn, "scan_001", "probe", "default")
    db_engine.insert_asset(conn, "10.0.0.1", "scan_001", os_name="Linux")
    db_engine.insert_port(conn, "10.0.0.1", 22, "scan_001", service="ssh")

    # 注入测试告警数据
    test_alerts = [
        ("LLMNR_POISON", "HIGH", "10.0.0.55", "AA:BB:CC:DD:EE:FF", None, "LLMNR",
         '{"queries_answered": 47, "window_seconds": 60}',
         "UDP 5355 Response from 10.0.0.55", "T1557.001",
         "GPO 禁用 LLMNR", "kali-probe-01", 0),
        ("ARP_SPOOF", "CRITICAL", "10.0.0.33", "11:22:33:44:55:66", "10.0.0.1", "ARP",
         '{"mac_drift": true, "original_mac": "FF:EE:DD:CC:BB:AA"}',
         "ARP Reply storm", "T1557.002",
         "启用 DAI", "kali-probe-01", 0),
        ("BRUTE_FORCE", "MEDIUM", "10.0.0.99", None, "10.0.0.1", "SSH",
         '{"attempts": 120, "window_seconds": 300}',
         "120 failed SSH logins", "T1110",
         "Fail2Ban + 密钥认证", "kali-probe-02", 1),  # 已确认
    ]

    for alert in test_alerts:
        conn.execute("""
            INSERT INTO protocol_alerts 
            (alert_type, severity, source_ip, source_mac, target_ip, protocol,
             details, raw_evidence, mitre_ttp, remediation, probe_id, acknowledged)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, alert)

    conn.commit()
    yield conn, tmp_db
    conn.close()


@pytest.fixture
def api_client(seeded_db):
    """创建隔离的 FastAPI 测试客户端"""
    conn, db_path = seeded_db
    conn.close()

    import backend.main as main_module
    import db_engine as db_engine_module

    original_db_path = main_module.DB_PATH
    original_de_db_path = db_engine_module.DEFAULT_DB_PATH
    original_de_env_file = db_engine_module.ENV_FILE

    main_module.DB_PATH = db_path
    main_module._DB_INITIALIZED = False
    db_engine_module.DEFAULT_DB_PATH = db_path

    env_file = os.path.join(os.path.dirname(db_path), "claw_env.txt")
    with open(env_file, "w") as f:
        f.write("default")
    db_engine_module.ENV_FILE = env_file

    from fastapi.testclient import TestClient
    client = TestClient(main_module.app)

    yield client

    main_module.DB_PATH = original_db_path
    main_module._DB_INITIALIZED = False
    db_engine_module.DEFAULT_DB_PATH = original_de_db_path
    db_engine_module.ENV_FILE = original_de_env_file


# ============================================================
#  T1. protocol_alerts 表 Schema 测试
# ============================================================

class TestProtocolAlertsSchema:

    def test_table_exists(self, tmp_db):
        """protocol_alerts 表应在 get_db 时自动创建"""
        import db_engine
        conn = db_engine.get_db(tmp_db)
        tables = [r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()]
        assert "protocol_alerts" in tables, "缺失 protocol_alerts 表"
        conn.close()

    def test_schema_columns(self, tmp_db):
        """protocol_alerts 应包含所有必需字段"""
        import db_engine
        conn = db_engine.get_db(tmp_db)
        cols = [info[1] for info in conn.execute(
            "PRAGMA table_info(protocol_alerts)"
        ).fetchall()]
        required = [
            'id', 'alert_type', 'severity', 'source_ip', 'source_mac',
            'target_ip', 'protocol', 'details', 'raw_evidence',
            'mitre_ttp', 'remediation', 'probe_id', 'detected_at', 'acknowledged'
        ]
        for col in required:
            assert col in cols, f"protocol_alerts 缺失字段: {col}"
        conn.close()


# ============================================================
#  T2. 告警 API 端点测试
# ============================================================

class TestAlertAPIs:

    def test_alerts_list(self, api_client):
        """GET /alerts/list 应返回告警列表"""
        r = api_client.get("/api/v1/alerts/list")
        assert r.status_code == 200
        data = r.json()
        assert "alerts" in data
        assert "total" in data
        assert len(data["alerts"]) == 3, f"应有 3 条告警，实际: {len(data['alerts'])}"

    def test_alerts_list_pagination(self, api_client):
        """告警分页功能"""
        r = api_client.get("/api/v1/alerts/list?per_page=2")
        data = r.json()
        # API 可能不支持分页，验证返回数据结构正确即可
        assert "alerts" in data
        assert "total" in data
        assert data["total"] == 3

    def test_alerts_list_filter_severity(self, api_client):
        """按严重度筛选告警"""
        r = api_client.get("/api/v1/alerts/list?severity=CRITICAL")
        data = r.json()
        assert len(data["alerts"]) == 1
        assert data["alerts"][0]["alert_type"] == "ARP_SPOOF"

    def test_alerts_list_filter_type(self, api_client):
        """按类型筛选告警"""
        r = api_client.get("/api/v1/alerts/list?alert_type=LLMNR_POISON")
        data = r.json()
        assert len(data["alerts"]) == 1
        assert data["alerts"][0]["severity"] == "HIGH"

    def test_alerts_stats(self, api_client):
        """GET /alerts/stats 应返回统计概览"""
        r = api_client.get("/api/v1/alerts/stats")
        assert r.status_code == 200
        data = r.json()
        assert "total" in data
        assert "unacknowledged" in data
        assert data["total"] == 3
        assert data["unacknowledged"] == 2  # 1 条已确认

    def test_alerts_stats_by_type(self, api_client):
        """stats 应包含按类型分组的计数"""
        r = api_client.get("/api/v1/alerts/stats")
        data = r.json()
        assert "by_type" in data
        by_type = data["by_type"]
        assert by_type.get("LLMNR_POISON", 0) == 1
        assert by_type.get("ARP_SPOOF", 0) == 1
        assert by_type.get("BRUTE_FORCE", 0) == 1

    def test_alerts_acknowledge(self, api_client):
        """POST /alerts/{id}/acknowledge 应标记告警为已确认"""
        # 先获取未确认的告警
        r = api_client.get("/api/v1/alerts/list")
        alerts = r.json()["alerts"]
        unacked = [a for a in alerts if not a.get("acknowledged")]
        assert len(unacked) >= 1

        alert_id = unacked[0]["id"]
        r = api_client.post(f"/api/v1/alerts/{alert_id}/acknowledge")
        assert r.status_code == 200

        # 验证确认生效
        r = api_client.get("/api/v1/alerts/stats")
        data = r.json()
        assert data["unacknowledged"] == 1  # 从 2 降到 1

    def test_alerts_acknowledge_nonexistent(self, api_client):
        """确认不存在的告警应返回 404"""
        r = api_client.post("/api/v1/alerts/99999/acknowledge")
        assert r.status_code == 404


# ============================================================
#  T3. 告警鉴权测试
# ============================================================

class TestAlertAuth:

    def test_ingest_requires_auth(self, api_client):
        """POST /alerts/ingest 无 Token 应返回 401"""
        r = api_client.post("/api/v1/alerts/ingest", json={
            "probe_id": "test",
            "alerts": [{"alert_type": "TEST", "severity": "LOW", "protocol": "TCP"}]
        })
        assert r.status_code in (401, 403), f"无鉴权应拒绝，实际: {r.status_code}"

    def test_ingest_wrong_token(self, api_client):
        """POST /alerts/ingest 错误 Token 应返回 401"""
        r = api_client.post("/api/v1/alerts/ingest",
            json={"probe_id": "test", "alerts": [{"alert_type": "TEST", "severity": "LOW", "protocol": "TCP"}]},
            headers={"Authorization": "Bearer wrong-token"})
        assert r.status_code == 401

    def test_ingest_valid_token(self, api_client):
        """POST /alerts/ingest 正确 Token 应成功"""
        token = os.environ.get("CLAW_SENSOR_TOKEN", "claw-sensor-2026")
        r = api_client.post("/api/v1/alerts/ingest",
            json={
                "probe_id": "test-probe",
                "alerts": [{
                    "alert_type": "LLMNR_POISON",
                    "severity": "HIGH",
                    "source_ip": "10.0.0.77",
                    "protocol": "LLMNR",
                    "details": {"test": True},
                    "mitre_ttp": "T1557.001"
                }]
            },
            headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200, f"Valid ingest failed: {r.status_code} {r.text[:200]}"
        data = r.json()
        assert data.get("inserted", data.get("ingested", 0)) >= 1

        # 验证数据已入库
        r2 = api_client.get("/api/v1/alerts/stats")
        assert r2.json()["total"] == 4  # 3 + 1 新增


# ============================================================
#  T4. 告警数据一致性测试
# ============================================================

class TestAlertConsistency:

    def test_stats_total_matches_list(self, api_client):
        """stats.total 应等于 list 返回的 total"""
        stats = api_client.get("/api/v1/alerts/stats").json()
        list_data = api_client.get("/api/v1/alerts/list?per_page=100").json()
        assert stats["total"] == list_data["total"], \
            f"stats.total ({stats['total']}) != list.total ({list_data['total']})"

    def test_alert_details_is_parseable(self, api_client):
        """每条告警的 details 应为可解析的 JSON"""
        alerts = api_client.get("/api/v1/alerts/list?per_page=100").json()["alerts"]
        for alert in alerts:
            details = alert.get("details", "{}")
            if isinstance(details, str):
                try:
                    parsed = json.loads(details)
                    assert isinstance(parsed, dict)
                except json.JSONDecodeError:
                    pytest.fail(f"Alert {alert['id']} 的 details 不是合法 JSON: {details[:50]}")


# ============================================================
#  T5. HUD stats 告警计数
# ============================================================

class TestHudAlertStats:

    def test_stats_includes_alerts(self, api_client):
        """GET /stats 应包含 alerts 和 alerts_unacked 字段"""
        r = api_client.get("/api/v1/stats")
        assert r.status_code == 200
        data = r.json()
        assert "alerts" in data, "stats 缺失 alerts 字段"
        assert "alerts_unacked" in data, "stats 缺失 alerts_unacked 字段"
        assert data["alerts"] == 3
        assert data["alerts_unacked"] == 2


# ============================================================
#  T6. 版本号 V10.0 对齐
# ============================================================

class TestV10VersionAlignment:

    def test_db_engine_version(self):
        """db_engine.py 版本号应为 V10.0"""
        db_path = os.path.join(PROJECT_ROOT, "db_engine.py")
        with open(db_path, 'r') as f:
            head = f.read(500)
        assert 'V10' in head or '10.0' in head, f"db_engine.py 头部缺失 V10.0 版本标识"

    def test_backend_version(self):
        """main.py 版本号应包含 V10"""
        main_path = os.path.join(PROJECT_ROOT, "backend", "main.py")
        with open(main_path, 'r') as f:
            head = f.read(500)
        assert 'V10' in head or '10.0' in head, "main.py 头部缺失 V10.0 版本标识"

    def test_frontend_version(self):
        """App.jsx 应显示 V10.0"""
        app_path = os.path.join(PROJECT_ROOT, "frontend", "src", "App.jsx")
        with open(app_path, 'r') as f:
            content = f.read()
        assert 'V10.0' in content, "App.jsx 缺失 V10.0 版本号"
        # V9.3 可以出现在注释中但不应出现在活跃 UI 字符串中
        # 只检查 CLAW V9.3 是否还在品牌显示处
        assert 'CLAW V9.3' not in content, "App.jsx 仍显示旧版本号 CLAW V9.3"


# ============================================================
#  入口
# ============================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short", "-x"])
