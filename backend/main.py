#!/usr/bin/env python3
"""
🐱 CLAW Backend V8.0 — FastAPI REST API
将 claw.db 数据通过 REST API 暴露给 Web Dashboard。
"""

import os, sqlite3, json
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import contextmanager

# === 配置 ===
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "CatTeam_Loot", "claw.db")
AUDIT_LOG = os.path.join(BASE_DIR, "CatTeam_Loot", "agent_audit.log")

app = FastAPI(
    title="CLAW API",
    description="Project CLAW V8.0 — AI 驱动的安全验证平台",
    version="8.0.0-alpha",
)

# CORS — 允许前端开发服务器
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# === 数据库连接 ===
@contextmanager
def get_db():
    if not os.path.exists(DB_PATH):
        raise HTTPException(status_code=503, detail="claw.db 不存在。请先运行 make fast")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


# === API 路由 ===

@app.get("/api/v1/stats")
def get_stats():
    """仪表盘统计概览"""
    with get_db() as conn:
        hosts = conn.execute("SELECT COUNT(DISTINCT ip) as c FROM assets").fetchone()["c"]
        ports = conn.execute("SELECT COUNT(*) as c FROM ports").fetchone()["c"]
        vulns = conn.execute("SELECT COUNT(*) as c FROM vulns").fetchone()["c"]
        scans = conn.execute("SELECT COUNT(*) as c FROM scans").fetchone()["c"]
        latest = conn.execute(
            "SELECT timestamp, env FROM scans ORDER BY timestamp DESC LIMIT 1"
        ).fetchone()

        return {
            "hosts": hosts,
            "ports": ports,
            "vulns": vulns,
            "scans": scans,
            "latest_scan": dict(latest) if latest else None,
        }


@app.get("/api/v1/assets")
def list_assets(
    scan_id: str = Query(None, description="指定 scan_id，默认最新"),
    search: str = Query(None, description="搜索 IP 或 OS"),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
):
    """资产列表（分页+搜索）"""
    with get_db() as conn:
        # 获取 scan_id
        if not scan_id:
            row = conn.execute("SELECT scan_id FROM scans ORDER BY timestamp DESC LIMIT 1").fetchone()
            if not row:
                return {"assets": [], "total": 0}
            scan_id = row["scan_id"]

        # 查询资产
        query = "SELECT ip, os FROM assets WHERE scan_id = ?"
        params = [scan_id]
        if search:
            query += " AND (ip LIKE ? OR os LIKE ?)"
            params.extend([f"%{search}%", f"%{search}%"])

        total = conn.execute(query.replace("SELECT ip, os", "SELECT COUNT(*) as c"), params).fetchone()["c"]

        query += " ORDER BY ip LIMIT ? OFFSET ?"
        params.extend([size, (page - 1) * size])
        rows = conn.execute(query, params).fetchall()

        # 为每个资产附加端口
        assets = []
        for r in rows:
            port_rows = conn.execute(
                "SELECT port, service, product, version FROM ports WHERE ip=? AND scan_id=?",
                (r["ip"], scan_id)
            ).fetchall()
            assets.append({
                "ip": r["ip"],
                "os": r["os"],
                "port_count": len(port_rows),
                "ports": [dict(p) for p in port_rows],
            })

        return {"assets": assets, "total": total, "scan_id": scan_id, "page": page}


@app.get("/api/v1/assets/{ip}")
def get_asset_detail(ip: str):
    """单个资产详情"""
    with get_db() as conn:
        asset = conn.execute("SELECT * FROM assets WHERE ip=? ORDER BY scan_id DESC LIMIT 1", (ip,)).fetchone()
        if not asset:
            raise HTTPException(status_code=404, detail=f"资产 {ip} 未找到")

        ports = conn.execute(
            "SELECT port, service, product, version FROM ports WHERE ip=? AND scan_id=?",
            (ip, asset["scan_id"])
        ).fetchall()

        return {
            "ip": asset["ip"],
            "os": asset["os"],
            "scan_id": asset["scan_id"],
            "ports": [dict(p) for p in ports],
        }


@app.get("/api/v1/scans")
def list_scans(limit: int = Query(20, ge=1, le=100)):
    """扫描历史"""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT scan_id, env, timestamp, total_hosts FROM scans ORDER BY timestamp DESC LIMIT ?",
            (limit,)
        ).fetchall()
        return {"scans": [dict(r) for r in rows]}


@app.get("/api/v1/audit")
def get_audit_log(limit: int = Query(50, ge=1, le=200)):
    """Agent 审计日志"""
    if not os.path.exists(AUDIT_LOG):
        return {"entries": [], "total": 0}

    with open(AUDIT_LOG, "r") as f:
        lines = f.readlines()

    entries = []
    for line in reversed(lines[-limit:]):
        line = line.strip()
        if not line:
            continue
        # 解析: [2026-03-25 23:16:02] TOOL:xxx | detail
        try:
            ts = line[1:20]
            rest = line[22:]
            action, _, detail = rest.partition(" | ")
            entries.append({"timestamp": ts, "action": action, "detail": detail})
        except:
            entries.append({"timestamp": "", "action": line, "detail": ""})

    return {"entries": entries, "total": len(lines)}


@app.get("/")
def root():
    return {
        "name": "CLAW API",
        "version": "8.0.0-alpha",
        "docs": "/docs",
        "status": "operational",
    }
