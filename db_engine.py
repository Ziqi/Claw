#!/usr/bin/env python3
"""
Project CLAW — SQLite 数据引擎 (v5.0)
四张表: scans / assets / ports / vulns
数据库文件: CatTeam_Loot/claw.db (全局唯一, 跨任务共享)
环境隔离: claw_env.txt 记录当前环境, diff 只在同环境内比较
"""

import sqlite3
import os

DEFAULT_DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "CatTeam_Loot", "claw.db")
ENV_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "CatTeam_Loot", "claw_env.txt")

SCHEMA = """
CREATE TABLE IF NOT EXISTS scans (
    scan_id   TEXT PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    mode      TEXT DEFAULT 'unknown',
    env       TEXT DEFAULT 'default'
);

CREATE TABLE IF NOT EXISTS assets (
    ip      TEXT NOT NULL,
    mac     TEXT DEFAULT '',
    os      TEXT DEFAULT 'Unknown',
    scan_id TEXT NOT NULL,
    FOREIGN KEY (scan_id) REFERENCES scans(scan_id),
    UNIQUE(ip, scan_id)
);

CREATE TABLE IF NOT EXISTS ports (
    ip       TEXT NOT NULL,
    port     INTEGER NOT NULL,
    protocol TEXT DEFAULT 'tcp',
    service  TEXT DEFAULT 'unknown',
    product  TEXT DEFAULT '',
    version  TEXT DEFAULT '',
    scan_id  TEXT NOT NULL,
    FOREIGN KEY (scan_id) REFERENCES scans(scan_id),
    UNIQUE(ip, port, protocol, scan_id)
);

CREATE TABLE IF NOT EXISTS vulns (
    ip      TEXT NOT NULL,
    type    TEXT NOT NULL,
    details TEXT DEFAULT '',
    scan_id TEXT NOT NULL,
    FOREIGN KEY (scan_id) REFERENCES scans(scan_id)
);
"""


def get_db(db_path=None):
    """获取数据库连接，自动建表 + 迁移"""
    path = db_path or DEFAULT_DB_PATH
    os.makedirs(os.path.dirname(path), exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    # 自动迁移: 给旧数据加 env 列
    try:
        conn.execute("SELECT env FROM scans LIMIT 1")
    except sqlite3.OperationalError:
        conn.execute("ALTER TABLE scans ADD COLUMN env TEXT DEFAULT 'default'")
        conn.commit()
    return conn


# ========== 环境管理 ==========
def get_current_env():
    """读取当前环境名"""
    if os.path.isfile(ENV_FILE):
        with open(ENV_FILE, "r") as f:
            env = f.read().strip()
            if env:
                return env
    return "default"


def set_current_env(env_name):
    """切换环境"""
    os.makedirs(os.path.dirname(ENV_FILE), exist_ok=True)
    with open(ENV_FILE, "w") as f:
        f.write(env_name.strip())
    return env_name.strip()


def list_envs(conn):
    """列出所有环境及其扫描次数"""
    rows = conn.execute(
        "SELECT env, count(*) as cnt FROM scans GROUP BY env ORDER BY env"
    ).fetchall()
    return [(r["env"], r["cnt"]) for r in rows]


def register_scan(conn, scan_id, mode="probe", env=None):
    """注册一次扫描批次"""
    if env is None:
        env = get_current_env()
    conn.execute(
        "INSERT OR REPLACE INTO scans (scan_id, mode, env) VALUES (?, ?, ?)",
        (scan_id, mode, env)
    )
    conn.commit()


def insert_asset(conn, ip, scan_id, mac="", os_name="Unknown"):
    """写入资产"""
    conn.execute(
        "INSERT OR REPLACE INTO assets (ip, mac, os, scan_id) VALUES (?, ?, ?, ?)",
        (ip, mac, os_name, scan_id)
    )


def insert_port(conn, ip, port, scan_id, protocol="tcp", service="unknown", product="", version=""):
    """写入端口"""
    conn.execute(
        "INSERT OR REPLACE INTO ports (ip, port, protocol, service, product, version, scan_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (ip, port, protocol, service, product, version, scan_id)
    )


def insert_vuln(conn, ip, vuln_type, details, scan_id):
    """写入漏洞/情报"""
    conn.execute(
        "INSERT INTO vulns (ip, type, details, scan_id) VALUES (?, ?, ?, ?)",
        (ip, vuln_type, details, scan_id)
    )


def write_scan_data(conn, scan_id, assets_dict, mode="probe"):
    """
    一次性写入完整扫描数据 (由 02.5-parse.py 调用)
    assets_dict 格式与 live_assets.json 中的 assets 字段一致
    """
    register_scan(conn, scan_id, mode)

    for ip, info in assets_dict.items():
        os_name = info.get("os", "Unknown")
        insert_asset(conn, ip, scan_id, os_name=os_name)

        for svc in info.get("services", []):
            insert_port(
                conn, ip, svc.get("port", 0), scan_id,
                protocol=svc.get("protocol", "tcp"),
                service=svc.get("service", "unknown"),
                product=svc.get("product", ""),
                version=svc.get("version", ""),
            )

    conn.commit()


def get_last_two_scans(conn, env=None):
    """获取最近两次 scan_id (同环境内)"""
    if env is None:
        env = get_current_env()
    rows = conn.execute(
        "SELECT scan_id FROM scans WHERE env=? ORDER BY timestamp DESC LIMIT 2",
        (env,)
    ).fetchall()
    if len(rows) >= 2:
        return rows[0]["scan_id"], rows[1]["scan_id"]
    elif len(rows) == 1:
        return rows[0]["scan_id"], None
    return None, None


def diff_hosts(conn, new_scan, old_scan):
    """SQL 集合差: 新增主机 / 消失主机"""
    new_hosts = conn.execute(
        "SELECT ip FROM assets WHERE scan_id=? EXCEPT SELECT ip FROM assets WHERE scan_id=?",
        (new_scan, old_scan)
    ).fetchall()

    gone_hosts = conn.execute(
        "SELECT ip FROM assets WHERE scan_id=? EXCEPT SELECT ip FROM assets WHERE scan_id=?",
        (old_scan, new_scan)
    ).fetchall()

    return [r["ip"] for r in new_hosts], [r["ip"] for r in gone_hosts]


def diff_ports(conn, new_scan, old_scan):
    """SQL 集合差: 端口变化"""
    # 共同主机
    common = conn.execute(
        "SELECT ip FROM assets WHERE scan_id=? INTERSECT SELECT ip FROM assets WHERE scan_id=?",
        (new_scan, old_scan)
    ).fetchall()

    changes = []
    for row in common:
        ip = row["ip"]
        added = conn.execute(
            "SELECT port FROM ports WHERE ip=? AND scan_id=? EXCEPT SELECT port FROM ports WHERE ip=? AND scan_id=?",
            (ip, new_scan, ip, old_scan)
        ).fetchall()

        removed = conn.execute(
            "SELECT port FROM ports WHERE ip=? AND scan_id=? EXCEPT SELECT port FROM ports WHERE ip=? AND scan_id=?",
            (ip, old_scan, ip, new_scan)
        ).fetchall()

        if added or removed:
            changes.append({
                "ip": ip,
                "added": sorted([r["port"] for r in added]),
                "removed": sorted([r["port"] for r in removed]),
            })

    return changes


def get_scan_assets(conn, scan_id):
    """获取指定扫描的所有资产 (用于 JSON 导出)"""
    assets = {}
    rows = conn.execute(
        "SELECT ip, os FROM assets WHERE scan_id=?", (scan_id,)
    ).fetchall()

    for row in rows:
        ip = row["ip"]
        ports_rows = conn.execute(
            "SELECT port, protocol, service, product, version FROM ports WHERE ip=? AND scan_id=?",
            (ip, scan_id)
        ).fetchall()

        services = []
        port_list = []
        for p in ports_rows:
            port_list.append(p["port"])
            svc = {"port": p["port"], "protocol": p["protocol"], "service": p["service"]}
            if p["product"]:
                svc["product"] = p["product"]
            if p["version"]:
                svc["version"] = p["version"]
            services.append(svc)

        assets[ip] = {
            "ports": sorted(port_list),
            "os": row["os"],
            "services": services,
        }

    return assets


# ========== 自测 ==========
if __name__ == "__main__":
    import tempfile
    db_path = os.path.join(tempfile.gettempdir(), "claw_test.db")
    conn = get_db(db_path)

    # 模拟写入
    test_assets = {
        "10.140.0.1": {
            "ports": [22, 80],
            "os": "Linux",
            "services": [
                {"port": 22, "protocol": "tcp", "service": "ssh"},
                {"port": 80, "protocol": "tcp", "service": "http", "product": "nginx"},
            ]
        },
        "10.140.0.2": {
            "ports": [445],
            "os": "Windows",
            "services": [
                {"port": 445, "protocol": "tcp", "service": "microsoft-ds"},
            ]
        }
    }

    write_scan_data(conn, "20260325_120000", test_assets, mode="probe")
    print(f"[+] 写入测试数据: {db_path}")

    # 验证
    count = conn.execute("SELECT count(*) as c FROM assets").fetchone()["c"]
    print(f"[+] assets 表: {count} 条")

    count = conn.execute("SELECT count(*) as c FROM ports").fetchone()["c"]
    print(f"[+] ports 表: {count} 条")

    conn.close()
    os.remove(db_path)
    print("[+] 自测通过，临时数据库已清理")
