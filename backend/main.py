#!/usr/bin/env python3
"""
🐱 CLAW Backend V9.3 — FastAPI REST API
将 claw.db 数据通过 REST API 暴露给 Web Dashboard。
"""

import os, sqlite3, json, re
from fastapi import FastAPI, Query, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from contextlib import contextmanager, asynccontextmanager
from pydantic import BaseModel
import asyncio, aiofiles
import time
from typing import Optional, List
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db_engine import get_current_env, set_current_env, list_envs as db_list_envs

# Agent 模块
from backend.agent_mcp import react_loop_stream
from backend.agent import API_KEY as AGENT_API_KEY

# === 配置 ===
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "CatTeam_Loot", "claw.db")
AUDIT_LOG = os.path.join(BASE_DIR, "CatTeam_Loot", "agent_audit.log")

import signal

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动前钩子
    yield
    # 关闭时钩子：清理 AI 智能体发起的后台进程
                
    # 斩首 AI 智能体背着 UI 悄悄发起的长时进程 (PGID 档案)
    ai_pgids_file = "/tmp/claw_ai_pgids.txt"
    if os.path.exists(ai_pgids_file):
        try:
            with open(ai_pgids_file, "r") as f:
                for line in f:
                    pid_str = line.strip()
                    if pid_str.isdigit():
                        try:
                            # 发送 SIGTERM 给整个进程组
                            os.killpg(os.getpgid(int(pid_str)), signal.SIGTERM)
                        except Exception:
                            pass
            os.remove(ai_pgids_file)
        except Exception:
            pass

app = FastAPI(
    title="CLAW",
    description="Project CLAW V9.3 — Electro-Phantom",
    version="9.3.0",
    lifespan=lifespan
)

# CORS — 允许所有内网来源（手机热点 172.20.10.x / VM 192.168.64.x / localhost）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


_DB_INITIALIZED = False

# === 数据库连接 ===
@contextmanager
def get_db():
    global _DB_INITIALIZED
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")  # P1-1 修复：补齐 D6 导师裁定的 WAL 防锁（db_engine/agent_mcp 已有，此处遗漏）
    
    if not _DB_INITIALIZED:
        from db_engine import SCHEMA
        is_new = not os.path.exists(DB_PATH)
        if is_new:
            os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        try:
            conn.executescript(SCHEMA)
            conn.execute("INSERT OR IGNORE INTO environments (name) VALUES ('default')")
            try:
                conn.execute("INSERT OR IGNORE INTO environments (name) SELECT DISTINCT env FROM scans")
            except Exception:
                pass
            # wifi_nodes 表已迁入 db_engine.py SCHEMA 统管 (V9.3)
            # 自动迁移：为旧 wifi_nodes 表添加 V9.3 新字段
            _v93_columns = [
                ("first_seen", "DATETIME DEFAULT CURRENT_TIMESTAMP"),
                ("status", "TEXT DEFAULT 'LIVE'"),
                ("password", "TEXT"),
                ("cracked_at", "DATETIME"),
                ("channel_locked", "BOOLEAN DEFAULT 0"),
                ("capture_file", "TEXT"),
                ("handshake_captured", "BOOLEAN DEFAULT 0"),
                ("clients_count", "INTEGER DEFAULT 0"),
                ("manufacturer", "TEXT"),
            ]
            for col_name, col_type in _v93_columns:
                try:
                    conn.execute(f"ALTER TABLE wifi_nodes ADD COLUMN {col_name} {col_type}")
                except sqlite3.OperationalError:
                    pass  # 列已存在，安全跳过
            conn.commit()
            _DB_INITIALIZED = True
        except sqlite3.OperationalError as e:
            print(f"Schema init delay: {e}")
            
    try:
        yield conn
    finally:
        conn.close()


# === API 路由 ===

@app.get("/api/v1/stats")
def get_stats():
    """仪表盘统计概览 — 基于最新扫描的数据（与 sync 资产列表保持一致）"""
    with get_db() as conn:
        env = get_current_env()
        
        # 先获取最新 scan_id，确保与 /sync 返回的资产列表一致
        latest_scan = conn.execute(
            "SELECT scan_id, timestamp, env FROM scans WHERE env = ? ORDER BY timestamp DESC LIMIT 1",
            (env,)
        ).fetchone()
        
        if not latest_scan:
            return {"hosts": 0, "ports": 0, "vulns": 0, "scans": 0, "latest_scan": None}
        
        scan_id = latest_scan["scan_id"]
        
        hosts = conn.execute(
            "SELECT COUNT(DISTINCT a.ip) as c FROM assets a JOIN scans s ON a.scan_id = s.scan_id WHERE s.env = ?", 
            (env,)
        ).fetchone()["c"]
        
        ports = conn.execute(
            "SELECT COUNT(DISTINCT p.ip || ':' || p.port) as c FROM ports p JOIN scans s ON p.scan_id = s.scan_id WHERE s.env = ?", 
            (env,)
        ).fetchone()["c"]
        
        vulns = conn.execute(
            "SELECT COUNT(*) as c FROM vulns v JOIN scans s ON v.scan_id = s.scan_id WHERE s.env = ?", 
            (env,)
        ).fetchone()["c"]
        
        scans = conn.execute(
            "SELECT COUNT(*) as c FROM scans WHERE env = ?", 
            (env,)
        ).fetchone()["c"]

        return {
            "hosts": hosts,
            "ports": ports,
            "vulns": vulns,
            "scans": scans,
            "latest_scan": {"timestamp": latest_scan["timestamp"], "env": latest_scan["env"]},
        }

import hashlib
from datetime import datetime

class WifiIngestPayload(BaseModel):
    bssid: str
    essid: str = ""
    power: int = -100
    channel: int = 1
    encryption: str = "OPN"

# 探针认证密钥（防止任意来源伪造遥测数据）
SENSOR_AUTH_TOKEN = os.environ.get("CLAW_SENSOR_TOKEN", "claw-sensor-2026")

# V9.3 全局指挥官意图 (联邦通信基座) — 持久化至 mission.txt
MISSION_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'CatTeam_Loot', 'mission.txt')

# V9.3 Sprint 2: 探针元数据缓存（内存级，重启丢失可接受）
_PROBE_STATUS_CACHE: dict = {}

def _load_mission_from_file():
    """启动时从磁盘恢复上一次的指挥意图"""
    try:
        if os.path.exists(MISSION_FILE):
            with open(MISSION_FILE, 'r') as f:
                content = f.read().strip()
                if content:
                    return content
    except Exception:
        pass
    return "待命中... (Waiting for Commander Intent)"

CURRENT_MISSION_BRIEFING = _load_mission_from_file()

class MissionPayload(BaseModel):
    briefing: str

@app.post("/api/v1/mission")
def update_mission_briefing(payload: MissionPayload):
    """(V9.3) 移动端/大屏指挥官下发战略简报 — 同步落盘"""
    global CURRENT_MISSION_BRIEFING
    CURRENT_MISSION_BRIEFING = payload.briefing
    # 持久化：写入 mission.txt，与 Kali 探针 claw_wifi_sensor.py 共享同一文件
    try:
        os.makedirs(os.path.dirname(MISSION_FILE), exist_ok=True)
        with open(MISSION_FILE, 'w') as f:
            f.write(payload.briefing)
    except Exception as e:
        print(f"[WARN] Mission briefing persist failed: {e}")
    return {"status": "ok", "current_mission": CURRENT_MISSION_BRIEFING}

@app.post("/api/v1/sensors/wifi/ingest")
async def ingest_wifi_telemetry(request: Request):
    """(V9.3 v2) Edge Sensor 遥测摄入接口
    
    兼容两种 payload 格式：
    - v1 (旧版): List[{bssid, essid, power, channel, encryption}]
    - v2 (新版): {"nodes": [...], "probe_status": {"uptime": int, "monitor_interface": str, "channel_locked": int|null}}
    """
    # 认证校验：检查 Authorization 头
    auth_header = request.headers.get("Authorization", "")
    expected = f"Bearer {SENSOR_AUTH_TOKEN}"
    if auth_header != expected:
        raise HTTPException(status_code=401, detail="Unauthorized sensor. Invalid or missing token.")
    
    # 解析 raw JSON，兼容 v1 和 v2 格式
    raw_body = await request.json()
    
    if isinstance(raw_body, dict) and "nodes" in raw_body:
        # V9.3 v2 信封格式
        nodes_raw = raw_body.get("nodes", [])
        probe_status = raw_body.get("probe_status", {})
        # 更新探针元数据缓存
        if probe_status:
            _PROBE_STATUS_CACHE.update(probe_status)
            _PROBE_STATUS_CACHE["last_report_time"] = datetime.now().isoformat()
    elif isinstance(raw_body, list):
        # v1 旧版格式：裸 AP 列表
        nodes_raw = raw_body
        probe_status = {}
    else:
        raise HTTPException(status_code=422, detail="Invalid payload format. Expected List[AP] or {nodes: [...], probe_status: {...}}")
    
    # 验证并写入数据库
    with get_db() as conn:
        for ap_data in nodes_raw:
            # 手动验证字段（兼容非 Pydantic 路径）
            bssid = ap_data.get("bssid", "") if isinstance(ap_data, dict) else ""
            if not bssid:
                continue
            essid = ap_data.get("essid", "")
            power = ap_data.get("power", -100)
            channel = ap_data.get("channel", 1)
            encryption = ap_data.get("encryption", "OPN")
            
            conn.execute(
                '''INSERT INTO wifi_nodes (bssid, essid, power, channel, encryption, last_seen)
                   VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                   ON CONFLICT(bssid) DO UPDATE SET 
                     essid=excluded.essid,
                     power=excluded.power,
                     channel=excluded.channel,
                     encryption=excluded.encryption,
                     last_seen=CURRENT_TIMESTAMP''',
                (bssid, essid, power, channel, encryption)
            )
            # V9.3: 同时写入 RSSI 历史表（Sparkline 数据源）
            conn.execute(
                '''INSERT INTO wifi_rssi_history (bssid, signal_strength)
                   VALUES (?, ?)''',
                (bssid, power)
            )
        conn.commit()
    return {
        "status": "ok", 
        "ingested": len(nodes_raw),
        "top_intent": CURRENT_MISSION_BRIEFING
    }

@app.get("/api/v1/sensors/wifi/radar")
def get_wifi_radar():
    """获取全域战术频谱雷达图（5分钟内活跃的AP + V9.3 扩展字段）"""
    with get_db() as conn:
        rows = conn.execute(
            '''SELECT bssid, essid, power, channel, encryption, last_seen,
                      status, handshake_captured, clients_count, manufacturer
               FROM wifi_nodes 
               WHERE datetime(last_seen) >= datetime('now', '-5 minute')
               ORDER BY power DESC'''
        ).fetchall()
        
        return {
            "timestamp": datetime.now().isoformat(),
            "active_nodes": [dict(r) for r in rows]
        }

# V9.3: RSSI 历史查询（Sparkline 折线图数据源）
@app.get("/api/v1/sensors/wifi/rssi_history")
def get_rssi_history(bssid: str = Query(..., description="目标 AP 的 BSSID"), limit: int = Query(20, description="返回数据点数")):
    """获取指定 AP 的信号强度历史（用于前端 Sparkline 微型折线图）"""
    with get_db() as conn:
        rows = conn.execute(
            '''SELECT signal_strength, recorded_at FROM wifi_rssi_history
               WHERE bssid = ? ORDER BY recorded_at DESC LIMIT ?''',
            (bssid, limit)
        ).fetchall()
        return {"bssid": bssid, "history": [dict(r) for r in reversed(rows)]}

# V9.3: 探针健康检测（基于 wifi_nodes 最新时间推算 + v2 探针元数据）
@app.get("/api/v1/sensors/health")
def get_sensor_health():
    """(V9.3 v2) 探针健康状态：数据库 last_seen 推算 + 探针 probe_status 元数据"""
    with get_db() as conn:
        row = conn.execute(
            "SELECT MAX(last_seen) as latest, COUNT(*) as total FROM wifi_nodes"
        ).fetchone()
        
        latest = row["latest"] if row else None
        total = row["total"] if row else 0
        
        # 判断探针状态
        status = "offline"
        if latest:
            from datetime import datetime as dt
            try:
                last_dt = dt.fromisoformat(latest)
                diff = (dt.now() - last_dt).total_seconds()
                if diff < 30:
                    status = "online"
                elif diff < 120:
                    status = "delayed"
                else:
                    status = "offline"
            except Exception:
                status = "unknown"
        
        # V9.3 Sprint 2: 合并探针 v2 元数据
        probe_info = {
            "status": status,
            "last_heartbeat": latest,
            "nodes_count": total,
            # 以下来自探针 v2 上报的 probe_status 缓存
            "uptime": _PROBE_STATUS_CACHE.get("uptime"),
            "monitor_interface": _PROBE_STATUS_CACHE.get("monitor_interface"),
            "channel_locked": _PROBE_STATUS_CACHE.get("channel_locked"),
        }
        
        return {"wifi_probe": probe_info}

@app.get("/api/v1/sync")
def sync_data(theater: str = Query("default", description="显式战区防串台"), client_hash: str = Query(None)):
    """智能增量同步接口：返回特征哈希，若无变化则直接短路"""
    with get_db() as conn:
        env = theater # 彻底抛弃 get_current_env() 隐式调用
        
        # 1. 先获取最新 scan_id（与资产列表数据源一致）
        scan_id_row = conn.execute("SELECT scan_id, timestamp FROM scans WHERE env=? ORDER BY timestamp DESC LIMIT 1", (env,)).fetchone()
        
        if not scan_id_row:
            empty_stats = {"hosts": 0, "ports": 0, "vulns": 0, "scans": 0, "latest_scan": None}
            return {"changed": True, "hash": "empty", "stats": empty_stats, "assets": []}
        
        latest_ts = scan_id_row["timestamp"]
        
        # 2. 基于聚合快照统计
        hosts = conn.execute("SELECT COUNT(DISTINCT a.ip) as c FROM assets a JOIN scans s ON a.scan_id = s.scan_id WHERE s.env = ?", (env,)).fetchone()["c"]
        ports = conn.execute("SELECT COUNT(DISTINCT p.ip || ':' || p.port) as c FROM ports p JOIN scans s ON p.scan_id = s.scan_id WHERE s.env = ?", (env,)).fetchone()["c"]
        vulns = conn.execute("SELECT COUNT(*) as c FROM vulns v JOIN scans s ON v.scan_id = s.scan_id WHERE s.env = ?", (env,)).fetchone()["c"]
        scans = conn.execute("SELECT COUNT(*) as c FROM scans WHERE env = ?", (env,)).fetchone()["c"]
        
        # 3. 生成当前战区的数据摘要 (Digest Hash)
        current_hash = hashlib.md5(f"{hosts}-{ports}-{vulns}-{latest_ts}".encode()).hexdigest()
        
        stats = {
            "hosts": hosts, "ports": ports, "vulns": vulns, "scans": scans,
            "latest_scan": {"timestamp": latest_ts}
        }
        
        # 【防雪崩短路】如果前端传来的 Hash 一致，直接拒绝下发全量大表
        if client_hash == current_hash:
            return {"changed": False, "hash": current_hash, "stats": stats}
            
        # 4. 若数据有变，进行极速全量聚合拉取
        query = "SELECT a.ip, a.os, MAX(s.timestamp) as last_seen, a.scan_id FROM assets a JOIN scans s ON a.scan_id = s.scan_id WHERE s.env=? GROUP BY a.ip"
        asset_rows = conn.execute(query, (env,)).fetchall()
        
        assets = []
        for r in asset_rows:
            # 根据 MAX 聚合推导出的精准 scan_id 拉取对应快照端口
            port_rows = conn.execute(
                "SELECT port, service, product, version FROM ports WHERE ip=? AND scan_id=?",
                (r["ip"], r["scan_id"])
            ).fetchall()
            assets.append({
                "ip": r["ip"],
                "os": r["os"],
                "port_count": len(port_rows),
                "ports": [dict(p) for p in port_rows]
            })
                
        return {
            "changed": True,
            "hash": current_hash,
            "stats": stats,
            "assets": assets
        }

@app.get("/api/v1/assets")
def list_assets(
    scan_id: str = Query(None, description="指定 scan_id，默认当前战区全局聚合快照"),
    search: str = Query(None, description="搜索 IP 或 OS"),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
):
    """资产列表（分页+搜索）：已升级为增量全域快照聚合模式"""
    with get_db() as conn:
        env = get_current_env()
        
        if not scan_id:
            # 战区模式：跨单次查询，提取每个IP的最新鲜记录
            query = "SELECT a.ip, a.os, MAX(s.timestamp) as last_seen, a.scan_id FROM assets a JOIN scans s ON a.scan_id = s.scan_id WHERE s.env=?"
            params = [env]
            if search:
                query += " AND (a.ip LIKE ? OR a.os LIKE ?)"
                params.extend([f"%{search}%", f"%{search}%"])
            query += " GROUP BY a.ip"
            
            # Count the total groups (IPs)
            count_query = f"SELECT COUNT(*) as c FROM ({query})"
            total = conn.execute(count_query, params).fetchone()["c"]

            # Pagination
            query += " ORDER BY a.ip LIMIT ? OFFSET ?"
            params.extend([size, (page - 1) * size])
            rows = conn.execute(query, params).fetchall()

            assets = []
            for r in rows:
                port_rows = conn.execute(
                    "SELECT port, service, product, version FROM ports WHERE ip=? AND scan_id=?",
                    (r["ip"], r["scan_id"])  # 利用绑定该IP提取所对应的具体scan_id提取其端口快照
                ).fetchall()
                assets.append({
                    "ip": r["ip"],
                    "os": r["os"],
                    "port_count": len(port_rows),
                    "ports": [dict(p) for p in port_rows],
                })
            return {"assets": assets, "total": total, "scan_id": "aggregated", "page": page, "env": env}
        else:
            # 单兵历史查询模式（点击某个历史快照记录时）
            query = "SELECT ip, os FROM assets WHERE scan_id = ?"
            params = [scan_id]
            if search:
                query += " AND (ip LIKE ? OR os LIKE ?)"
                params.extend([f"%{search}%", f"%{search}%"])

            total = conn.execute(query.replace("SELECT ip, os", "SELECT COUNT(*) as c"), params).fetchone()["c"]

            query += " ORDER BY ip LIMIT ? OFFSET ?"
            params.extend([size, (page - 1) * size])
            rows = conn.execute(query, params).fetchall()

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
            return {"assets": assets, "total": total, "scan_id": scan_id, "page": page, "env": env}


@app.get("/api/v1/assets/{ip}")
def get_asset_detail(ip: str):
    """单个资产详情 (已修复脱离战区限制的错误关联)"""
    with get_db() as conn:
        env = get_current_env()
        asset = conn.execute(
            "SELECT a.*, s.timestamp FROM assets a JOIN scans s ON a.scan_id = s.scan_id "
            "WHERE a.ip=? AND s.env=? ORDER BY s.timestamp DESC LIMIT 1", 
            (ip, env)
        ).fetchone()
        if not asset:
            raise HTTPException(status_code=404, detail=f"资产 {ip} 在当前战区 {env} 未找到")

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

class CleanupRequest(BaseModel):
    inactive_hours: int = 48
    
@app.post("/api/v1/assets/cleanup")
def assets_cleanup(req: CleanupRequest):
    """(新增) 清理战区内超过指定时间（默认 48H）未在快照中发声的静默机器"""
    import datetime
    env = get_current_env()
    cutoff_time = (datetime.datetime.utcnow() - datetime.timedelta(hours=req.inactive_hours)).strftime("%Y-%m-%d %H:%M:%S")
    
    with get_db() as conn:
        # 获取要删除的幽灵 IP 列表
        ghosts = conn.execute(
            "SELECT a.ip FROM assets a JOIN scans s ON a.scan_id = s.scan_id "
            "WHERE s.env = ? GROUP BY a.ip HAVING MAX(s.timestamp) < ?",
            (env, cutoff_time)
        ).fetchall()
        
        ghost_ips = [r["ip"] for r in ghosts]
        
        if ghost_ips:
            # 删除隶属于该战区所有扫描记录下的这些 IP 资产
            ids_placeholder = ",".join("?" for _ in ghost_ips)
            conn.execute(
                f"DELETE FROM assets WHERE ip IN ({ids_placeholder}) AND scan_id IN (SELECT scan_id FROM scans WHERE env = ?)",
                (*ghost_ips, env)
            )
            conn.commit()
            
        return {"status": "ok", "deleted_count": len(ghost_ips), "ghost_ips": ghost_ips, "cutoff_utc": cutoff_time}

@app.get("/api/v1/env/network_alignment")
def check_network_alignment():
    """(新增) 核对本机网关与战区主频段是否偏移"""
    import socket
    env = get_current_env()
    local_ips = []
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ips.append(s.getsockname()[0])
        s.close()
    except Exception:
        pass
        
    try:
        host_name = socket.gethostname()
        _, _, ips = socket.gethostbyname_ex(host_name)
        for ip in ips:
            if not ip.startswith("127.") and ip not in local_ips:
                local_ips.append(ip)
    except Exception:
        pass

    import subprocess, re
    try:
        out = subprocess.check_output(["ifconfig"], universal_newlines=True)
        matches = re.findall(r'inet\s+(\d+\.\d+\.\d+\.\d+)', out)
        for m in matches:
            if not m.startswith("127.") and not m.startswith("172.1") and m not in local_ips:
                local_ips.append(m)
    except Exception:
        pass

    if not local_ips:
        local_ips = ["127.0.0.1"]

    with get_db() as conn:
        rows = conn.execute(
            "SELECT a.ip FROM assets a JOIN scans s ON a.scan_id = s.scan_id "
            "WHERE s.env = ? GROUP BY a.ip", 
            (env,)
        ).fetchall()
        
        if not rows:
            return {"aligned": True, "local_ips": local_ips, "theater_subnets": []}
            
        from collections import Counter
        subnets = Counter([".".join(r["ip"].split(".")[:3]) for r in rows])
        theater_subnets = [k for k, v in subnets.most_common(3)]
            
        local_subnets = [".".join(ip.split(".")[:3]) for ip in local_ips]
        
        aligned = False
        for ts in theater_subnets:
            if ts in local_subnets:
                aligned = True
                break
                
        return {"aligned": aligned, "local_ips": local_ips, "theater_subnets": theater_subnets}


@app.get("/api/v1/scans")
def list_scans(limit: int = Query(20, ge=1, le=100)):
    """扫描历史"""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT s.scan_id, s.env, s.timestamp, s.mode, "
            "(SELECT COUNT(DISTINCT a.ip) FROM assets a WHERE a.scan_id = s.scan_id) as total_hosts "
            "FROM scans s ORDER BY s.timestamp DESC LIMIT ?",
            (limit,)
        ).fetchall()
        return {"scans": [dict(r) for r in rows]}


@app.get("/api/v1/campaigns")
def list_campaigns(limit: int = Query(20, ge=1, le=100)):
    """获取所有 Agent 对话历史 (Campaign)"""
    with get_db() as conn:
        try:
            rows = conn.execute(
                "SELECT campaign_id, title, updated_at FROM conversations ORDER BY updated_at DESC LIMIT ?",
                (limit,)
            ).fetchall()
            return {"campaigns": [dict(r) for r in rows]}
        except sqlite3.OperationalError:
            try:
                # 兼容旧版本无 title 列
                rows = conn.execute(
                    "SELECT campaign_id, updated_at FROM conversations ORDER BY updated_at DESC LIMIT ?",
                    (limit,)
                ).fetchall()
                return {"campaigns": [dict(r) for r in rows]}
            except sqlite3.OperationalError:
                # conversations 表如果还未创建
                return {"campaigns": []}


# === SLIVER C2 MOCK APIs ===
# [REMOVED in V9.3] Sliver C2 Mock 端点 (sliver/sessions + sliver/interact)
# 原因：无实际 C2 数据源，纯 Mock 展示

# [REMOVED in V9.3] OpsRunRequest — ops/run 管线已在 Final Purge 中物理删除


# === STRUCTURED OUTPUT: COGNITIVE GRAPH DISTILLATION ===
from pydantic import Field
class KillChainNode(BaseModel):
    source_ip: str = Field(description="攻击发起方IP，如 'Alfa网卡'")
    target_ip: str = Field(description="攻击目标IP")
    technique: str = Field(description="使用的杀伤链技术，如 'SMB 爆破'")
    severity: str = Field(description="危险等级: High, Medium, Low")
    description: str = Field(description="该攻击节点的原理及目标说明")

class AttackGraph(BaseModel):
    nodes: list[KillChainNode] = Field(description="杀伤链攻击图谱节点列表")

@app.get("/api/v1/agent/graph")
def generate_attack_graph(target_ip: str):
    """(Phase 13) 认知图谱蒸馏：利用 Structured Output 强制返回 JSON 杀伤链"""
    if not AGENT_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")
        
    with get_db() as conn:
        env = get_current_env()
        scan = conn.execute("SELECT scan_id FROM scans WHERE env=? ORDER BY timestamp DESC LIMIT 1", (env,)).fetchone()
        if not scan:
            return {"nodes": []}
        scan_id = scan["scan_id"]
        
        ports = conn.execute("SELECT port, service, product FROM ports WHERE ip=? AND scan_id=?", (target_ip, scan_id)).fetchall()
        try:
            vulns = conn.execute("SELECT vulnid, description, severity FROM vulns WHERE ip=? AND scan_id=?", (target_ip, scan_id)).fetchall()
        except sqlite3.OperationalError:
            vulns = []
            
    context_data = {
        "target_ip": target_ip,
        "ports": [dict(p) for p in ports],
        "vulns": [dict(v) for v in vulns]
    }
    
    prompt = f"""
    我们正在为 Project CLAW V9 构建全域指挥官看板。
    以下是目标主机 {target_ip} 的侦察情报：
    {json.dumps(context_data, ensure_ascii=False)}
    
    请严格按照给定的 Pydantic JSON Schema 输出一条理论上的最快攻击链路（最多进行 2 次横向推演）。
    第一步的 source_ip 必须是系统内置的攻击设备，例如 'Alfa无线监听网卡' 或 'CLAW 主战平台'。
    如果没有任何已知洞，请推演一个最有可能成功的战术（例如针对 Web 端口的密码爆破）。
    """
    
    try:
        from google import genai
        from google.genai import types
        # Note: Depending on the active version, 3-flash or 3.1-pro might be required
        client = genai.Client(api_key=AGENT_API_KEY)
        response = client.models.generate_content(
            model="gemini-3.1-pro-preview", 
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=AttackGraph,
                temperature=0.1
            )
        )
        # response.text is guaranteed to be JSON matching AttackGraph
        return json.loads(response.text)
    except Exception as e:
        print(f"[GRAPH DISTILLATION ERROR] {e}")
        return {"nodes": []}


# [REMOVED in V9.3] A2UI Payload Forge + ForgeRequest — Final Purge 清除



# === OSINT DEEP RESEARCH APIs ===
class OsintTarget(BaseModel):
    target: str

def run_osint_task(target: str):
    """异步执行长期 OSINT 爬虫任务 (Stub)"""
    time.sleep(10)  # 模拟延时
    print(f"[OSINT WORKER] Completed deep research for {target}")

@app.post("/api/v1/osint/research")
def start_osint_research(req: OsintTarget, background_tasks: BackgroundTasks):
    """启动外部攻击面 OSINT 分析"""
    background_tasks.add_task(run_osint_task, req.target)
    return {"status": "started", "target": req.target, "message": "Deep Research agent dispatched."}


# === REPORTING & EGRESS APIs ===
@app.get("/api/v1/report/generate")
def generate_report():
    """一键生成 Markdown 格式的渗透测试报告 (已修复脱离战区限制的跨域泄露问题)"""
    with get_db() as conn:
        env = get_current_env()
        row = conn.execute("SELECT scan_id, timestamp FROM scans WHERE env=? ORDER BY timestamp DESC LIMIT 1", (env,)).fetchone()
        if not row:
            return {"report": f"# Project CLAW V9.3 ({env})\n\nNo scan data available in the current theater."}
        
        scan_id = row['scan_id']
        ts = row['timestamp']
        
        # Calculate host count from assets table
        hosts_count_row = conn.execute("SELECT COUNT(DISTINCT ip) as c FROM assets WHERE scan_id=?", (scan_id,)).fetchone()
        hosts_count = hosts_count_row['c'] if hosts_count_row else 0

        assets = conn.execute("SELECT ip, os FROM assets WHERE scan_id=?", (scan_id,)).fetchall()
        ports = conn.execute("SELECT ip, port, service, version FROM ports WHERE scan_id=?", (scan_id,)).fetchall()
        try:
            # ONLY grab vulns for this specific scan_id!
            vulns = conn.execute("SELECT ip, vulnid, description, severity FROM vulns WHERE scan_id=?", (scan_id,)).fetchall()
        except sqlite3.OperationalError:
            vulns = []

    audit_lines = []
    if os.path.exists(AUDIT_LOG):
        with open(AUDIT_LOG, "r") as f:
            audit_lines = f.readlines()[-30:]

    md = []
    md.append(f"# CLAW V9.3 - Egress Penetration Test Report")
    md.append(f"**Generated At:** {ts}  \n**Target Scope ID:** `{scan_id}`  \n**Total Assets Discovered:** {hosts_count}\n")
    
    md.append("## 1. Executive Summary")
    md.append("CLAW V9.3 operated in Human-AI Co-Piloting mode. This report presents an automated synthesis of discovered assets, exposed services, and potential vulnerabilities across the target scope.\n")

    md.append("## 2. Asset & Attack Surface")
    md.append("| Target IP | OS Fingerprint | Discovered Ports & Services |")
    md.append("|---|---|---|")
    
    ports_by_ip = {}
    for p in ports:
        ports_by_ip.setdefault(p['ip'], []).append(f"{p['port']}/{p['service']}")
    
    for a in assets:
        ip = a['ip']
        os_info = a['os'] or 'Unknown'
        services = ", ".join(ports_by_ip.get(ip, ["None"]))
        md.append(f"| `{ip}` | {os_info} | {services} |")
    md.append("")

    md.append("## 3. Vulnerability Findings")
    if not vulns:
        md.append("> *No confirmed vulnerabilities explicitly logged in the DB for this scope.*")
    else:
        md.append("| Target IP | Vuln ID | Severity | Description |")
        md.append("|---|---|---|---|")
        for v in vulns:
            md.append(f"| `{v['ip']}` | {v['vulnid']} | **{(v['severity'] or 'UNKNOWN').upper()}** | {v['description'] or ''} |")
    md.append("")

    # V9.3 Sprint 3: WiFi 资产章节
    md.append("## 4. Wireless RF Asset Analysis")
    try:
        with get_db() as wifi_conn:
            wifi_nodes = wifi_conn.execute(
                "SELECT bssid, essid, channel, encryption, power, status, manufacturer FROM wifi_nodes ORDER BY power DESC"
            ).fetchall()
        
        if wifi_nodes:
            md.append(f"**Total RF Nodes Discovered:** {len(wifi_nodes)}\n")
            
            # 加密类型分布统计
            enc_dist = {}
            high_risk_aps = []
            for n in wifi_nodes:
                enc = n['encryption'] or 'UNKNOWN'
                enc_dist[enc] = enc_dist.get(enc, 0) + 1
                if enc in ('OPN', 'WEP') or 'WEP' in enc:
                    high_risk_aps.append(n)
            
            md.append("**Encryption Distribution:**")
            for enc_type, count in sorted(enc_dist.items(), key=lambda x: -x[1]):
                pct = round(count / len(wifi_nodes) * 100, 1)
                md.append(f"- {enc_type}: {count} ({pct}%)")
            md.append("")
            
            # 高危 AP 列表
            if high_risk_aps:
                md.append(f"**High Risk APs (WEP/OPN): {len(high_risk_aps)}**")
                md.append("| BSSID | SSID | Channel | Encryption | Signal (dBm) |")
                md.append("|---|---|---|---|---|")
                for ap in high_risk_aps:
                    md.append(f"| `{ap['bssid']}` | {ap['essid'] or '<HIDDEN>'} | {ap['channel']} | **{ap['encryption']}** | {ap['power']} |")
                md.append("")
            else:
                md.append("> *No high-risk (WEP/OPN) access points detected.*\n")
            
            # 全量 AP 列表
            md.append("**Full AP Inventory:**")
            md.append("| BSSID | SSID | CH | Encryption | Signal | Status | Manufacturer |")
            md.append("|---|---|---|---|---|---|---|")
            for n in wifi_nodes[:50]:  # 限制前 50 个防爆表
                md.append(f"| `{n['bssid']}` | {n['essid'] or '<HIDDEN>'} | {n['channel']} | {n['encryption']} | {n['power']} dBm | {n['status'] or 'LIVE'} | {n['manufacturer'] or 'N/A'} |")
            if len(wifi_nodes) > 50:
                md.append(f"| ... | *({len(wifi_nodes) - 50} more nodes omitted)* | | | | | |")
            md.append("")
        else:
            md.append("> *No wireless RF nodes have been captured by the edge probe.*\n")
    except Exception as e:
        md.append(f"> *WiFi asset data unavailable: {e}*\n")

    md.append("## 5. Agent Operational Audit Trail")
    md.append("Trace of the LYNX Agent during the engagement:")
    md.append("```log")
    if audit_lines:
        md.extend([line.strip() for line in audit_lines])
    else:
        md.append("[SYS] No active agent traces found in audit.log")
    md.append("```\n")

    md.append("---\n*End of Report | Auto-generated by CLAW V9.3*")

    return {"report": "\n".join(md)}


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
        try:
            ts = line[1:20]
            rest = line[22:]
            action, _, detail = rest.partition(" | ")
            entries.append({"timestamp": ts, "action": action, "detail": detail})
        except:
            entries.append({"timestamp": "", "action": line, "detail": ""})

    return {"entries": entries, "total": len(lines)}


@app.get("/api/v1/topology")
def get_topology(scan_id: str = Query(None)):
    """网络拓扑数据 (供 vis.js 渲染)"""
    env = get_current_env()
    with get_db() as conn:
        if not scan_id:
            row = conn.execute("SELECT scan_id FROM scans WHERE env=? ORDER BY timestamp DESC LIMIT 1", (env,)).fetchone()
            if not row: return {"nodes": [{"id": "attacker", "label": "CLAW AI\nOpSec Node", "group": "attacker"}], "edges": []}
            scan_id = row["scan_id"]
            
        nodes = [{"id": "attacker", "label": "CLAW AI\nOpSec Node", "group": "attacker"}]
        edges = []
        rows = conn.execute("SELECT ip, os FROM assets WHERE scan_id=?", (scan_id,)).fetchall()
        for r in rows:
            nodes.append({"id": r["ip"], "label": f"{r['ip']}\n{r['os'][:12]}", "group": "target"})
            edges.append({"from": "attacker", "to": r["ip"]})
            
        return {"nodes": nodes, "edges": edges}


# [REMOVED in V9.3] ATT&CK Matrix 端点
# 原因：无数据驱动，纯静态展示，无实际价值

# ============================================================
#  Agent SSE 流式端点 (Phase 2 核心)
# ============================================================

class ChatRequest(BaseModel):
    query: str
    campaign_id: str = "default"
    model: str = "flash"
    theater: str = "default"
    agent_mode: bool = True
    sudo_pass: str | None = None


@app.get("/api/agent/stream")
async def agent_stream_get(
    request: Request,
    query: str = Query(..., description="用户消息"),
    campaign_id: str = Query("default", description="会话标识"),
    model: str = Query("flash", description="模型选择"),
    theater: str = Query("default", description="作战战区"),
    agent_mode: bool = Query(True, description="Agent 模式控制开关"),
    sudo_pass: str | None = Query(None, description="SUDO 密码")
):
    """SSE 流式 Agent 对话 (GET — 兼容 EventSource)"""
    if not AGENT_API_KEY:
        raise HTTPException(status_code=503, detail="未配置 Gemini API Key")

    async def event_generator():
        q = asyncio.Queue()
        
        async def producer():
            try:
                async for event in react_loop_stream(query, campaign_id, model_key=model, theater=theater, agent_mode=agent_mode, sudo_pass=sudo_pass):
                    await q.put(event)
                await q.put(None)
            except Exception as e:
                import traceback
                traceback.print_exc()
                import json
                err_data = {"message": f"后台队列异常: {str(e)}"}
                await q.put(f"event: error\ndata: {json.dumps(err_data, ensure_ascii=False)}\n\n")
                await q.put(None)

        prod_task = asyncio.create_task(producer())
        
        while True:
            if await request.is_disconnected():
                prod_task.cancel()
                break
            
            try:
                event = await asyncio.wait_for(q.get(), timeout=3.0)
                if event is None:
                    break
                yield event
            except asyncio.TimeoutError:
                yield ": keepalive\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@app.post("/api/agent/stream")
async def agent_stream_post(request: Request, req: ChatRequest):
    """SSE 流式 Agent 对话 (POST — 支持 @microsoft/fetch-event-source)"""
    if not AGENT_API_KEY:
        raise HTTPException(status_code=503, detail="未配置 Gemini API Key")

    async def event_generator():
        q = asyncio.Queue()
        
        async def producer():
            try:
                async for event in react_loop_stream(req.query, req.campaign_id, model_key=req.model, theater=req.theater, agent_mode=req.agent_mode, sudo_pass=req.sudo_pass):
                    await q.put(event)
                await q.put(None) # Sentinel for EOF
            except Exception as e:
                import traceback
                traceback.print_exc()
                await q.put(f"event: error\ndata: {{\"message\": \"后台队列异常: {str(e)}\"}}\n\n")
                await q.put(None)

        prod_task = asyncio.create_task(producer())
        
        while True:
            if await request.is_disconnected():
                prod_task.cancel()
                break
            
            try:
                # Wait for next event or pulse a heartbeat every 3 seconds to cheat VPN/Proxies idle timeouts
                event = await asyncio.wait_for(q.get(), timeout=3.0)
                if event is None:
                    break
                yield event
            except asyncio.TimeoutError:
                # Yield a safe JSON ping event to keep connection alive
                yield "event: ping\ndata: {\"status\": \"keepalive\"}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


# === SCOPE & TARGET PROBE APIs (Sprint 4: 实弹作战) ===
SCOPE_FILE = os.path.join(BASE_DIR, "scope.txt")

@app.get("/api/v1/scope")
def get_scope():
    """读取当前 scope.txt 作战授权范围"""
    if not os.path.exists(SCOPE_FILE):
        return {"scope": [], "god_mode": True}
    with open(SCOPE_FILE, "r") as f:
        lines = [l.strip() for l in f if l.strip() and not l.strip().startswith("#")]
    return {"scope": lines, "god_mode": len(lines) == 0}


class ScopeUpdate(BaseModel):
    scope: list[str]

@app.post("/api/v1/scope")
def update_scope(req: ScopeUpdate):
    """更新 scope.txt 作战授权范围"""
    with open(SCOPE_FILE, "w") as f:
        f.write("# CatTeam ROE Scope File\n")
        f.write("# 每行一个 CIDR 或单 IP\n\n")
        for entry in req.scope:
            if entry.strip():
                f.write(entry.strip() + "\n")
    return {"status": "ok", "count": len(req.scope), "god_mode": len(req.scope) == 0}


# [REMOVED in V9.3] Docker Management 端点 (docker/status + docker/{action})
# 原因：Kali VM 替代 Docker，CLAW 回归指挥中枢定位


# ============================================================
#  ENVIRONMENT / THEATER MANAGEMENT
# ============================================================

@app.get("/api/v1/env/list")
def env_list():
    """返回所有战区及其资产统计 (已修复 SQL 聚合错误)"""
    current = get_current_env()
    with get_db() as conn:
        envs = []
        # Pull ALL environments natively, linking any prior scans explicitly 
        env_rows = conn.execute(
            "SELECT e.name as env, MAX(s.timestamp) as last_scan FROM environments e LEFT JOIN scans s ON e.name = s.env GROUP BY e.name ORDER BY last_scan DESC"
        ).fetchall()
        
        for r in env_rows:
            env_name = r["env"]
            last_scan = r["last_scan"]
            
            # Compute total distinct IPs across the whole env unconditionally
            asset_count = conn.execute(
                "SELECT COUNT(DISTINCT a.ip) as c FROM assets a JOIN scans s ON a.scan_id = s.scan_id WHERE s.env=?",
                (env_name,)
            ).fetchone()["c"]
                
            envs.append({
                "name": env_name,
                "asset_count": asset_count,
                "last_scan": last_scan,
                "active": env_name == current
            })
            
        # If current env not in list (e.g. brand new), add it
        if not any(e["name"] == current for e in envs):
            envs.insert(0, {"name": current, "asset_count": 0, "last_scan": None, "active": True})
            
    return {"current": current, "theaters": envs}


class EnvSwitchRequest(BaseModel):
    name: str

@app.post("/api/v1/env/switch")
def env_switch(req: EnvSwitchRequest):
    """切换当前战区"""
    old = get_current_env()
    new = set_current_env(req.name)
    return {"status": "ok", "old": old, "current": new}


class EnvCreateRequest(BaseModel):
    name: str
    env_type: str = "lan"  # lan / public / lab
    targets: str = ""  # multi-line IPs/CIDRs

@app.post("/api/v1/env/create")
def env_create(req: EnvCreateRequest):
    """创建新战区并切换"""
    name = req.name.strip()
    if not name:
        return {"error": "战区名称不能为空"}
        
    with get_db() as conn:
        conn.execute("INSERT OR IGNORE INTO environments (name) VALUES (?)", (name,))
        conn.commit()
        
    set_current_env(name)
    # Write targets to scope.txt if provided
    if req.targets.strip():
        scope_file = os.path.join(BASE_DIR, "scope.txt")
        with open(scope_file, "w") as f:
            f.write(req.targets.strip() + "\n")
    return {"status": "ok", "theater": name, "type": req.env_type, "targets": req.targets.strip()}

class EnvRenameRequest(BaseModel):
    old_name: str
    new_name: str

@app.post("/api/v1/env/rename")
def env_rename(req: EnvRenameRequest):
    if not req.old_name or not req.new_name:
        raise HTTPException(status_code=400, detail="名称不能为空")
    with get_db() as conn:
        conn.execute("UPDATE scans SET env=? WHERE env=?", (req.new_name, req.old_name))
        try:
            conn.execute("UPDATE environments SET name=? WHERE name=?", (req.new_name, req.old_name))
        except Exception:
            pass
        conn.commit()
    if get_current_env() == req.old_name:
        set_current_env(req.new_name)
    return {"status": "ok", "message": f"战区 {req.old_name} 已重命名为 {req.new_name}"}

class EnvDeleteRequest(BaseModel):
    name: str

@app.post("/api/v1/env/delete")
def env_delete(req: EnvDeleteRequest):
    if not req.name:
        raise HTTPException(status_code=400, detail="名称不能为空")
    if req.name == "default":
        raise HTTPException(status_code=400, detail="系统默认战区无法删除")
    with get_db() as conn:
        conn.execute("DELETE FROM scans WHERE env=?", (req.name,))
        conn.execute("DELETE FROM environments WHERE name=?", (req.name,))
        conn.commit()
    if get_current_env() == req.name:
        set_current_env("default")
    return {"status": "ok", "message": f"战区 {req.name} 已删除/清空"}


# [REMOVED in V9.3] ops/run + ops/stop + ops/jobs/active + ops/log 管线
# 原因：CLAW 回归指挥中枢定位，命令执行通过 MCP claw_execute_shell 工具完成
# 前端已无任何调用入口，MCP 工具链不依赖此 REST 端点


class ProbeRequest(BaseModel):
    target: str
    profile: str = "default"
    env_mode: str = "current"

@app.post("/api/v1/probe")
def probe_target(req: ProbeRequest, background_tasks: BackgroundTasks):
    """对指定目标发起实弹 nmap 扫描"""
    target = req.target.strip()
    if not target:
        raise HTTPException(status_code=400, detail="目标不能为空")

    # 确定端口模板
    port_profiles = {
        "default": "80,443,445,1723,5000,5900,8080",
        "iot": "80,443,554,5000,8080,8443,8899,37777,49152,49297,54321",
        "full": "21,22,23,25,53,80,110,111,135,139,143,443,445,993,995,1433,1723,3306,3389,5000,5432,5900,6379,8000,8080,8443,8888,9000,9090,27017",
    }
    ports = port_profiles.get(req.profile, port_profiles["default"])

    import subprocess, xml.etree.ElementTree as ET

    scan_id = f"probe_{int(time.time())}"

    def run_probe():
        """后台执行 nmap 扫描并入库"""
        try:
            xml_out = os.path.join(BASE_DIR, "CatTeam_Loot", f"{scan_id}.xml")
            os.makedirs(os.path.dirname(xml_out), exist_ok=True)
            cmd = ["nmap", "-sV", "-p", ports, "-oX", xml_out, "--open", target]
            subprocess.run(cmd, timeout=300, capture_output=True, text=True)

            if not os.path.exists(xml_out):
                return

            tree = ET.parse(xml_out)
            root = tree.getroot()

            with get_db() as conn:
                target_env = get_current_env() if req.env_mode == "current" else f"probe"
                conn.execute("INSERT OR REPLACE INTO scans (scan_id, timestamp, mode, env) VALUES (?, CURRENT_TIMESTAMP, 'probe', ?)", (scan_id, target_env))
                for host in root.findall(".//host"):
                    addr = host.find("address")
                    if addr is None:
                        continue
                    ip = addr.get("addr", "")
                    os_el = host.find(".//osmatch")
                    os_name = os_el.get("name", "Unknown") if os_el is not None else "Unknown"
                    conn.execute("INSERT OR REPLACE INTO assets (ip, os, scan_id) VALUES (?, ?, ?)", (ip, os_name, scan_id))
                    for port_el in host.findall(".//port"):
                        port_num = int(port_el.get("portid", 0))
                        proto = port_el.get("protocol", "tcp")
                        svc = port_el.find("service")
                        service = svc.get("name", "unknown") if svc is not None else "unknown"
                        product = svc.get("product", "") if svc is not None else ""
                        version = svc.get("version", "") if svc is not None else ""
                        conn.execute("INSERT OR REPLACE INTO ports (ip, port, protocol, service, product, version, scan_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
                                     (ip, port_num, proto, service, product, version, scan_id))
                conn.commit()
        except Exception as e:
            print(f"[PROBE ERROR] {e}")

    background_tasks.add_task(run_probe)
    return {"status": "started", "target": target, "scan_id": scan_id, "profile": req.profile, "message": f"Nmap 实弹扫描已对 {target} 发起 (模板: {req.profile})"}



@app.post("/api/v1/agent/cancel")
async def cancel_agent_tool(request: Request):
    try:
        from backend.mcp_armory_server import cancel_active_task
        killed = cancel_active_task()
        return {"success": killed, "message": "已成功斩断活动进程" if killed else "没有正在运行的阻塞子进程"}
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.get("/api/v1/agent/active_log")
def get_active_agent_log():
    try:
        import os
        if not os.path.exists("/tmp/claw_ai_output.log"):
            return {"log": ""}
        with open("/tmp/claw_ai_output.log", "r", encoding="utf-8") as f:
            # Read last 16KB to prevent blowing up HTTP
            f.seek(0, 2)
            size = f.tell()
            f.seek(max(size - 16384, 0))
            return {"log": f.read()}
    except Exception:
        return {"log": ""}

@app.get("/")
def root():
    return {
        "name": "CLAW API",
        "version": "9.3.0",
        "docs": "/docs",
        "status": "operational",
        "agent": "ready" if AGENT_API_KEY else "no_api_key",
    }


# [REMOVED in V9.3] TerminalSession + /api/v1/terminal WebSocket 端点
# 原因：SSH 进 Kali 用原生终端更好，CLAW 回归指挥中枢定位
