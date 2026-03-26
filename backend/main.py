#!/usr/bin/env python3
"""
🐱 CLAW Backend V8.0 — FastAPI REST API
将 claw.db 数据通过 REST API 暴露给 Web Dashboard。
"""

import os, sqlite3, json
from fastapi import FastAPI, Query, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from contextlib import contextmanager
from pydantic import BaseModel
import pty, fcntl, struct, termios, asyncio
import time
from typing import Optional, List
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db_engine import get_current_env, set_current_env, list_envs as db_list_envs

# Agent 模块
from backend.agent import react_loop_stream, API_KEY as AGENT_API_KEY

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
        # 获取 scan_id (按当前 env 过滤)
        if not scan_id:
            env = get_current_env()
            row = conn.execute("SELECT scan_id FROM scans WHERE env=? ORDER BY timestamp DESC LIMIT 1", (env,)).fetchone()
            if not row:
                # Fallback: try any env
                row = conn.execute("SELECT scan_id FROM scans ORDER BY timestamp DESC LIMIT 1").fetchone()
            if not row:
                return {"assets": [], "total": 0, "env": env}
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

        return {"assets": assets, "total": total, "scan_id": scan_id, "page": page, "env": get_current_env()}


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
MOCK_SLIVER_SESSIONS = [
    {"id": "c8a4b3d1", "name": "DESKTOP-9X21B", "os": "windows", "ip": "10.140.0.96", "user": "NT AUTHORITY\\SYSTEM", "last_checkin": "12s ago", "status": "active"},
    {"id": "f5e9a2c0", "name": "UBUNTU-WEB-01", "os": "linux", "ip": "172.16.5.12", "user": "www-data", "last_checkin": "45s ago", "status": "active"},
    {"id": "a1b2c3d4", "name": "EXCHANGE-SRV", "os": "windows", "ip": "10.140.0.101", "user": "NT AUTHORITY\\SYSTEM", "last_checkin": "10m ago", "status": "dead"}
]

@app.get("/api/v1/sliver/sessions")
def get_sliver_sessions():
    """获取 Sliver C2 当前上线的 Session (Mock)"""
    return {"sessions": MOCK_SLIVER_SESSIONS}

class SliverCommand(BaseModel):
    session_id: str
    command: str

@app.post("/api/v1/sliver/interact")
def interact_sliver(cmd: SliverCommand):
    """向给定的 Sliver Session 下发命令 (Mock)"""
    return {
        "status": "success", 
        "session_id": cmd.session_id, 
        "output": f"[SLIVER-RPC] Execute OK on {cmd.session_id}:\n{cmd.command}\nuid=0(root) gid=0(root)\n"
    }


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
    """一键生成 Markdown 格式的渗透测试报告 (Sprint 3)"""
    with get_db() as conn:
        row = conn.execute("SELECT scan_id, timestamp FROM scans ORDER BY timestamp DESC LIMIT 1").fetchone()
        if not row:
            return {"report": "# Project CLAW V8.0\n\nNo scan data available in the database."}
        
        scan_id = row['scan_id']
        ts = row['timestamp']
        
        # Calculate host count from assets table
        hosts_count_row = conn.execute("SELECT COUNT(DISTINCT ip) as c FROM assets WHERE scan_id=?", (scan_id,)).fetchone()
        hosts_count = hosts_count_row['c'] if hosts_count_row else 0

        assets = conn.execute("SELECT ip, os FROM assets WHERE scan_id=?", (scan_id,)).fetchall()
        ports = conn.execute("SELECT ip, port, service, version FROM ports WHERE scan_id=?", (scan_id,)).fetchall()
        try:
            vulns = conn.execute("SELECT ip, vulnid, description, severity FROM vulns").fetchall()
        except sqlite3.OperationalError:
            vulns = []

    audit_lines = []
    if os.path.exists(AUDIT_LOG):
        with open(AUDIT_LOG, "r") as f:
            audit_lines = f.readlines()[-30:]

    md = []
    md.append(f"# CLAW V8.0 - Egress Penetration Test Report")
    md.append(f"**Generated At:** {ts}  \n**Target Scope ID:** `{scan_id}`  \n**Total Assets Discovered:** {hosts_count}\n")
    
    md.append("## 1. Executive Summary")
    md.append("CLAW V8.0 operated in Human-AI Co-Piloting mode. This report presents an automated synthesis of discovered assets, exposed services, and potential vulnerabilities across the target scope.\n")

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
            md.append(f"| `{v['ip']}` | {v['vulnid']} | **{v['severity'].upper()}** | {v['description']} |")
    md.append("")

    md.append("## 4. Agent Operational Audit Trail")
    md.append("Trace of the LYNX Agent during the engagement:")
    md.append("```log")
    if audit_lines:
        md.extend([line.strip() for line in audit_lines])
    else:
        md.append("[SYS] No active agent traces found in audit.log")
    md.append("```\n")

    md.append("---\n*End of Report | Auto-generated by CLAW V8.0*")

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
    with get_db() as conn:
        if not scan_id:
            row = conn.execute("SELECT scan_id FROM scans ORDER BY timestamp DESC LIMIT 1").fetchone()
            if not row: return {"nodes": [], "edges": []}
            scan_id = row["scan_id"]
            
        nodes = [{"id": "attacker", "label": "CLAW AI\nOpSec Node", "group": "attacker"}]
        edges = []
        rows = conn.execute("SELECT ip, os FROM assets WHERE scan_id=?", (scan_id,)).fetchall()
        for r in rows:
            nodes.append({"id": r["ip"], "label": f"{r['ip']}\n{r['os'][:12]}", "group": "target"})
            edges.append({"from": "attacker", "to": r["ip"]})
            
        return {"nodes": nodes, "edges": edges}


@app.get("/api/v1/attack_matrix")
def get_attack_matrix():
    """MITRE ATT&CK 热力矩阵"""
    matrix = {
        "Reconnaissance": ["T1595.002", "T1592", "T1590", "T1046"],
        "Initial Access": ["T1190", "T1078"],
        "Execution": ["T1059.001", "T1059.003", "T1053"],
        "Persistence": ["T1505", "T1098", "T1136"],
        "Privilege Escalation": ["T1068", "T1548", "T1134"],
        "Defense Evasion": ["T1070", "T1562", "T1027"],
        "Credential Access": ["T1003", "T1558", "T1110"],
        "Discovery": ["T1087", "T1082", "T1018"],
        "Lateral Movement": ["T1021.001", "T1021.002", "T1550"]
    }
    active_ttps = set()
    if os.path.exists(AUDIT_LOG):
        with open(AUDIT_LOG, "r") as f:
            for line in f:
                import re
                matches = re.findall(r'(T\d{4}(?:\.\d{3})?)', line)
                active_ttps.update(matches)
                
    return {"matrix": matrix, "active": list(active_ttps)}

# ============================================================
#  Agent SSE 流式端点 (Phase 2 核心)
# ============================================================

class ChatRequest(BaseModel):
    query: str
    campaign_id: str = "default"


@app.get("/api/agent/stream")
async def agent_stream_get(
    query: str = Query(..., description="用户消息"),
    campaign_id: str = Query("default", description="会话标识")
):
    """SSE 流式 Agent 对话 (GET — 兼容 EventSource)"""
    if not AGENT_API_KEY:
        raise HTTPException(status_code=503, detail="未配置 Gemini API Key")

    def event_generator():
        for event in react_loop_stream(query, campaign_id):
            yield event

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
async def agent_stream_post(req: ChatRequest):
    """SSE 流式 Agent 对话 (POST — 支持 @microsoft/fetch-event-source)"""
    if not AGENT_API_KEY:
        raise HTTPException(status_code=503, detail="未配置 Gemini API Key")

    def event_generator():
        for event in react_loop_stream(req.query, req.campaign_id):
            yield event

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


# ============================================================
#  DOCKER MANAGEMENT
# ============================================================

@app.get("/api/v1/docker/status")
def docker_status():
    """获取 Docker 镜像和容器状态"""
    import subprocess as sp
    result = {"images": [], "containers": []}
    try:
        # Get images
        img_out = sp.run(["docker", "images", "--format", "{{.Repository}}:{{.Tag}}|{{.ID}}|{{.Size}}|{{.CreatedSince}}"],
                         capture_output=True, text=True, timeout=5)
        for line in img_out.stdout.strip().split("\n"):
            if not line or "<none>" in line:
                continue
            parts = line.split("|")
            if len(parts) >= 4:
                result["images"].append({
                    "name": parts[0], "id": parts[1][:12], "size": parts[2], "created": parts[3]
                })

        # Get containers
        ctr_out = sp.run(["docker", "ps", "-a", "--format", "{{.Names}}|{{.Image}}|{{.Status}}|{{.ID}}"],
                         capture_output=True, text=True, timeout=5)
        for line in ctr_out.stdout.strip().split("\n"):
            if not line:
                continue
            parts = line.split("|")
            if len(parts) >= 4:
                status = parts[2]
                running = "Up" in status
                result["containers"].append({
                    "name": parts[0], "image": parts[1], "status": status,
                    "id": parts[3][:12], "running": running
                })
    except Exception as e:
        result["error"] = str(e)
    return result


@app.post("/api/v1/docker/{action}/{container_name}")
def docker_control(action: str, container_name: str):
    """启动/停止 Docker 容器"""
    import subprocess as sp
    if action not in ("start", "stop", "restart"):
        return {"error": f"不支持的操作: {action}"}
    try:
        r = sp.run(["docker", action, container_name], capture_output=True, text=True, timeout=30)
        return {"status": "ok", "output": r.stdout.strip(), "error": r.stderr.strip() if r.returncode != 0 else None}
    except Exception as e:
        return {"error": str(e)}

# ============================================================
#  ENVIRONMENT / THEATER MANAGEMENT
# ============================================================

@app.get("/api/v1/env/list")
def env_list():
    """返回所有战区及其资产统计"""
    current = get_current_env()
    with get_db() as conn:
        envs = []
        rows = conn.execute(
            "SELECT s.env, COUNT(DISTINCT a.ip) as asset_count, MAX(s.timestamp) as last_scan "
            "FROM scans s LEFT JOIN assets a ON s.scan_id = a.scan_id "
            "GROUP BY s.env ORDER BY last_scan DESC"
        ).fetchall()
        for r in rows:
            envs.append({
                "name": r["env"],
                "asset_count": r["asset_count"] or 0,
                "last_scan": r["last_scan"],
                "active": r["env"] == current
            })
        # If current env not in list, add it
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
    set_current_env(name)
    # Write targets to scope.txt if provided
    if req.targets.strip():
        scope_file = os.path.join(BASE_DIR, "scope.txt")
        with open(scope_file, "w") as f:
            f.write(req.targets.strip() + "\n")
    return {"status": "ok", "theater": name, "type": req.env_type, "targets": req.targets.strip()}

# ============================================================
# OPERATION PIPELINE (Sprint 2 - 流程引擎与流式输出)
# ============================================================

import uuid
import subprocess

ACTIVE_JOBS = {}  # job_id -> Popen object

class OpsRunRequest(BaseModel):
    command: str
    theater: str = "default"

@app.post("/api/v1/ops/run")
def ops_run(req: OpsRunRequest, background_tasks: BackgroundTasks):
    """异步执行作战命令，返回 job_id"""
    job_id = f"job_{uuid.uuid4().hex[:8]}"
    log_dir = os.path.join(BASE_DIR, "CatTeam_Loot", req.theater, "logs")
    os.makedirs(log_dir, exist_ok=True)
    log_file = os.path.join(log_dir, f"{job_id}.log")

    # Start process in background
    with open(log_file, "w") as f:
        f.write(f"--- [Project CLAW V8.2] Task Started: {req.command} ---\n\n")
    
    # We use shlex to safely parse or just pass through shell=True for complex piplines
    # Since these are internal ops commands, shell=True is accepted for 'make' or chained commands
    proc = subprocess.Popen(
        req.command,
        shell=True,
        cwd=BASE_DIR,
        stdout=open(log_file, "a"),
        stderr=subprocess.STDOUT,
        text=True
    )
    ACTIVE_JOBS[job_id] = proc
    return {"status": "ok", "job_id": job_id, "command": req.command, "log_file": log_file}

import asyncio

@app.get("/api/v1/ops/log/{job_id}")
async def ops_log(job_id: str, theater: str = "default"):
    """SSE 流式返回该 job 的日志输出"""
    log_file = os.path.join(BASE_DIR, "CatTeam_Loot", theater, "logs", f"{job_id}.log")
    
    async def log_generator():
        if not os.path.exists(log_file):
            yield f"data: [Error: Log file not found for {job_id}]\n\n"
            return
            
        with open(log_file, "r") as f:
            # Read whatever is already there
            content = f.read()
            if content:
                # Send chunks or line by line
                lines = content.split('\n')
                for line in lines:
                    if line:
                        yield "data: {}\n\n".format(json.dumps({'text': line + '\n'}, ensure_ascii=False))
            
            # Tail the file
            proc = ACTIVE_JOBS.get(job_id)
            while True:
                line = f.readline()
                if line:
                    yield f"data: {json.dumps({'text': line}, ensure_ascii=False)}\n\n"
                else:
                    if proc and proc.poll() is not None:
                        # Process finished and no more lines
                        finished_msg = f"\\n--- [Task Finished with code {proc.returncode}] ---\\n"
                        yield f"data: {json.dumps({'text': finished_msg, 'done': True}, ensure_ascii=False)}\n\n"
                        break
                    await asyncio.sleep(0.5)

    return StreamingResponse(
        log_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )



class ProbeRequest(BaseModel):
    target: str
    profile: str = "default"

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
                conn.execute("INSERT OR REPLACE INTO scans (scan_id, timestamp, mode, env) VALUES (?, CURRENT_TIMESTAMP, 'probe', 'probe')", (scan_id,))
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


@app.get("/")
def root():
    return {
        "name": "CLAW API",
        "version": "8.0.0-alpha",
        "docs": "/docs",
        "status": "operational",
        "agent": "ready" if AGENT_API_KEY else "no_api_key",
    }


class TerminalSession:
    def __init__(self, websocket: WebSocket):
        self.websocket = websocket
        self.fd = None
        self.pid = None
        
    async def start(self):
        await self.websocket.accept()
        self.pid, self.fd = pty.fork()
        
        if self.pid == 0:
            os.environ['TERM'] = 'xterm-256color'
            # 开启 Bash 环境作为原生终端
            os.execv('/bin/bash', ['bash', '-l'])
            
        loop = asyncio.get_running_loop()
        loop.add_reader(self.fd, self._read_cb)
        
        try:
            while True:
                data = await self.websocket.receive_json()
                if data.get("type") == "resize":
                    self.resize(data.get("cols", 80), data.get("rows", 24))
                elif data.get("type") == "input":
                    os.write(self.fd, data["data"].encode())
        except WebSocketDisconnect:
            self.stop()
            
    def _read_cb(self):
        try:
            data = os.read(self.fd, 4096)
            if not data: return
            asyncio.create_task(self.websocket.send_json({"type": "output", "data": data.decode(errors='ignore')}))
        except Exception:
            self.stop()
            
    def resize(self, cols, rows):
        if self.fd:
            winsize = struct.pack("HHHH", rows, cols, 0, 0)
            fcntl.ioctl(self.fd, termios.TIOCSWINSZ, winsize)
            
    def stop(self):
        if self.fd:
            try: asyncio.get_running_loop().remove_reader(self.fd)
            except: pass
            try: os.close(self.fd)
            except: pass
        if self.pid:
            try: os.kill(self.pid, 9)
            except: pass


@app.websocket("/api/v1/terminal")
async def terminal_endpoint(websocket: WebSocket):
    session = TerminalSession(websocket)
    await session.start()
