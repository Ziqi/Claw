#!/usr/bin/env python3
"""
🐱 CLAW Backend V8.0 — FastAPI REST API
将 claw.db 数据通过 REST API 暴露给 Web Dashboard。
"""

import os, sqlite3, json, re
from fastapi import FastAPI, Query, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from contextlib import contextmanager, asynccontextmanager
from pydantic import BaseModel
import pty, fcntl, struct, termios, asyncio, aiofiles
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

ACTIVE_JOBS = {}
import signal

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动前钩子
    yield
    # 关闭时钩子（清场行动）：彻底斩首所有遗留后台任务的孤儿进程
    for j_id, job in list(ACTIVE_JOBS.items()):
        if job.get("proc") and job["proc"].poll() is None:
            try:
                os.killpg(os.getpgid(job["proc"].pid), signal.SIGTERM)
            except Exception:
                pass
                
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
    title="CLAW API",
    description="Project CLAW V8.2 — AI 驱动的安全验证平台",
    version="8.2.0",
    lifespan=lifespan
)

# CORS — 允许前端开发服务器
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
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
    """仪表盘统计概览 (已修复：按战区/env 隔离数据)"""
    with get_db() as conn:
        env = get_current_env()
        
        hosts = conn.execute(
            "SELECT COUNT(DISTINCT a.ip) as c FROM assets a JOIN scans s ON a.scan_id = s.scan_id WHERE s.env = ?", 
            (env,)
        ).fetchone()["c"]
        
        ports = conn.execute(
            "SELECT COUNT(*) as c FROM ports p JOIN scans s ON p.scan_id = s.scan_id WHERE s.env = ?", 
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
        
        latest = conn.execute(
            "SELECT timestamp, env FROM scans WHERE env = ? ORDER BY timestamp DESC LIMIT 1",
            (env,)
        ).fetchone()

        return {
            "hosts": hosts,
            "ports": ports,
            "vulns": vulns,
            "scans": scans,
            "latest_scan": dict(latest) if latest else None,
        }

import hashlib

@app.get("/api/v1/sync")
def sync_data(theater: str = Query("default", description="显式战区防串台"), client_hash: str = Query(None)):
    """智能增量同步接口：返回特征哈希，若无变化则直接短路"""
    with get_db() as conn:
        env = theater # 彻底抛弃 get_current_env() 隐式调用
        
        # 1. 极速聚合核心特征
        hosts = conn.execute("SELECT COUNT(DISTINCT a.ip) as c FROM assets a JOIN scans s ON a.scan_id = s.scan_id WHERE s.env = ?", (env,)).fetchone()["c"]
        ports = conn.execute("SELECT COUNT(*) as c FROM ports p JOIN scans s ON p.scan_id = s.scan_id WHERE s.env = ?", (env,)).fetchone()["c"]
        vulns = conn.execute("SELECT COUNT(*) as c FROM vulns v JOIN scans s ON v.scan_id = s.scan_id WHERE s.env = ?", (env,)).fetchone()["c"]
        scans = conn.execute("SELECT COUNT(*) as c FROM scans WHERE env = ?", (env,)).fetchone()["c"]
        
        latest_row = conn.execute("SELECT timestamp FROM scans WHERE env = ? ORDER BY timestamp DESC LIMIT 1", (env,)).fetchone()
        latest_ts = latest_row["timestamp"] if latest_row else "empty"
        
        # 2. 生成当前战区的数据摘要 (Digest Hash)
        current_hash = hashlib.md5(f"{hosts}-{ports}-{vulns}-{latest_ts}".encode()).hexdigest()
        
        stats = {
            "hosts": hosts, "ports": ports, "vulns": vulns, "scans": scans,
            "latest_scan": {"timestamp": latest_ts} if latest_row else None
        }
        
        # 【防雪崩短路】如果前端传来的 Hash 一致，直接拒绝下发全量大表
        if client_hash == current_hash:
            return {"changed": False, "hash": current_hash, "stats": stats}
            
        # 3. 若数据有变，进行消除 N+1 的极速全量拉取
        scan_id_row = conn.execute("SELECT scan_id FROM scans WHERE env=? ORDER BY timestamp DESC LIMIT 1", (env,)).fetchone()
        assets = []
        if scan_id_row:
            scan_id = scan_id_row["scan_id"]
            
            # 批量查 assets
            asset_rows = conn.execute("SELECT ip, os FROM assets WHERE scan_id = ? ORDER BY ip", (scan_id,)).fetchall()
            # 批量查 ports，避免 for 循环里发 SQL
            port_rows = conn.execute("SELECT ip, port, service, product, version FROM ports WHERE scan_id = ?", (scan_id,)).fetchall()
            
            ports_by_ip = {}
            for p in port_rows:
                ports_by_ip.setdefault(p["ip"], []).append(dict(p))
                
            for r in asset_rows:
                ip = r["ip"]
                assets.append({
                    "ip": ip,
                    "os": r["os"],
                    "port_count": len(ports_by_ip.get(ip, [])),
                    "ports": ports_by_ip.get(ip, [])
                })
                
        return {
            "changed": True,
            "hash": current_hash,
            "stats": stats,
            "assets": assets
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

        scan_id = asset["scan_id"]
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
MOCK_SLIVER_SESSIONS = [
    {"id": "c8a4b3d1", "name": "DESKTOP-9X21B", "os": "windows", "ip": "10.140.0.96", "user": "NT AUTHORITY\\SYSTEM", "last_checkin": "12s ago", "status": "active"},
    {"id": "f5e9a2c0", "name": "UBUNTU-WEB-01", "os": "linux", "ip": "172.16.5.12", "user": "www-data", "last_checkin": "45s ago", "status": "active"},
    {"id": "a1b2c3d4", "name": "EXCHANGE-SRV", "os": "windows", "ip": "10.140.0.101", "user": "NT AUTHORITY\\SYSTEM", "last_checkin": "10m ago", "status": "dead"}
]

@app.get("/api/v1/sliver/sessions")
def get_sliver_sessions():
    """获取 Sliver C2 当前上线的 Session (Mock)"""
    return {"sessions": MOCK_SLIVER_SESSIONS}

class OpsRunRequest(BaseModel):
    command: str
    theater: str = "default"
    sudo_pass: str | None = None

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


# === A2UI GENERATIVE PAYLOAD FORGE (Multimodal Self-Correction) ===
import base64
from playwright.async_api import async_playwright

class ForgeRequest(BaseModel):
    target_ip: str
    target_info: dict
    concept: str = "企业内网登录凭据截获 Portal"

class ForgeResponse(BaseModel):
    html: str
    screenshot: str

HTML_PROMPT = """你是一个顶级前端渗透逆向工程师。
请为目标 ({target_ip}, OS: {os}, 开放端口：{ports}, 意图方案：{concept})
编写一个【极度逼真】的、不留安全瑕疵的 HTML 页面源码。
要求：
1. 必须包含内联的 TailwindCSS (<script src="https://cdn.tailwindcss.com"></script>)。
2. 背景、Logo 占位符、渐变色必须符合目标身份。
3. 表单结构必须极为合理（如用户名、密码、MFA 输入框），必须有一个醒目的登录按钮。
4. 页面需要有微妙的动效（如 hover 阴影）。
5. 必须返回纯粹且完整的 HTML 代码，不包含多余的代码块标记。
"""

CORRECTION_PROMPT = """这是一个多模态自我视觉审核过程。这是你刚才生成的页面的浏览器真实截图。
你必须以专业 UI/UX 设计师和红队代码审查者的身份，找出所有破绽：
1. 排版是否错位或内容溢出？
2. 留白是否生硬？
3. 颜色、边框或按钮是不是显得很“假”？
如果存在视觉破绽，请直接输出修复这些问题的 **极其完美的、纯粹的 HTML 源码**（绝不带 markdown 块或冗杂说明）。
但如果你认为当前的页面具有完美的欺骗性，或者没有任何严重的排版错误，请直接仅回复：<NO_ISSUES>
"""

@app.post("/api/v1/agent/forge", response_model=ForgeResponse)
async def forge_payload(req: ForgeRequest):
    if not AGENT_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")
        
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=AGENT_API_KEY)
    
    ports_desc = ", ".join([f"{p.get('port')}/{p.get('service')}" for p in req.target_info.get("ports", [])])
    prompt = HTML_PROMPT.format(target_ip=req.target_ip, os=req.target_info.get("os", "未知系统"), ports=ports_desc, concept=req.concept)
    
    # 1. Text-to-Code 初稿生成
    try:
        resp = client.models.generate_content(
            model="gemini-3.1-pro-preview",
            contents=prompt,
            config=types.GenerateContentConfig(temperature=0.3)
        )
        first_draft_html = resp.text.strip()
        if first_draft_html.startswith("```html"):
            first_draft_html = first_draft_html.removeprefix("```html").removesuffix("```").strip()
        elif first_draft_html.startswith("```"):
            first_draft_html = first_draft_html.removeprefix("```").removesuffix("```").strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation fail: {e}")

    # 2. Playwright 无头拍照
    screenshot_b64 = ""
    screenshot_bytes = b""
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page(viewport={"width": 1280, "height": 800})
            await page.set_content(first_draft_html)
            await asyncio.sleep(1) # wait for tailwind CDN and fonts
            screenshot_bytes = await page.screenshot(type="jpeg", quality=80)
            screenshot_b64 = base64.b64encode(screenshot_bytes).decode("utf-8")
            await browser.close()
    except Exception as e:
        print(f"[PLAYWRIGHT] Error: {e}")
        return ForgeResponse(html=first_draft_html, screenshot="")

    # 3. 多模态视觉自我博弈
    try:
        image_part = types.Part.from_bytes(data=screenshot_bytes, mime_type="image/jpeg")
        correction_resp = client.models.generate_content(
            model="gemini-3.1-pro-preview", 
            contents=[image_part, CORRECTION_PROMPT],
            config=types.GenerateContentConfig(
                temperature=0.1,
                media_resolution=types.MediaResolution.MEDIA_RESOLUTION_HIGH,  # P1-4: 提升视觉自纠错 OCR 精度
            )
        )
        correction_result = correction_resp.text.strip()
        
        if "<NO_ISSUES>" not in correction_result.upper():
            final_html = correction_result
            if final_html.startswith("```html"):
                final_html = final_html.removeprefix("```html").removesuffix("```").strip()
            elif final_html.startswith("```"):
                final_html = final_html.removeprefix("```").removesuffix("```").strip()
            
            # 再拍一次以展示成果
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page(viewport={"width": 1280, "height": 800})
                await page.set_content(final_html)
                await asyncio.sleep(1)
                screenshot_bytes2 = await page.screenshot(type="jpeg", quality=80)
                screenshot_b64 = base64.b64encode(screenshot_bytes2).decode("utf-8")
                await browser.close()
        else:
            final_html = first_draft_html
    except Exception as e:
        print(f"[MULTIMODAL] Error: {e}")
        final_html = first_draft_html
        
    return ForgeResponse(html=final_html, screenshot=f"data:image/jpeg;base64,{screenshot_b64}")


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
            return {"report": f"# Project CLAW V8.0 ({env})\n\nNo scan data available in the current theater."}
        
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
                matches = re.findall(r'(T\d{4}(?:\.\d{3})?)', line)
                active_ttps.update(matches)
                
    return {"matrix": matrix, "active": list(active_ttps)}

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

class ForgeSaveRequest(BaseModel):
    html: str
    target_ip: str
    theater: str = "default"

@app.post("/api/v1/agent/forge/save")
def forge_save_payload(req: ForgeSaveRequest):
    """(Phase 23) 永久固化 A2UI 钓鱼靶面板至本地兵工厂载荷目录"""
    theater_dir = os.path.join(BASE_DIR, "CatTeam_Loot", req.theater) if req.theater != "default" else os.path.join(BASE_DIR, "CatTeam_Loot")
    payload_dir = os.path.join(theater_dir, "payloads")
    os.makedirs(payload_dir, exist_ok=True)
    
    filename = f"{req.target_ip}_a2ui_phishing.html"
    file_path = os.path.join(payload_dir, filename)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(req.html)
        
    return {"status": "ok", "message": "Saved successfully", "path": file_path}

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
            
            # Get latest scan_id for this env
            scan_row = conn.execute("SELECT scan_id FROM scans WHERE env=? ORDER BY timestamp DESC LIMIT 1", (env_name,)).fetchone()
            asset_count = 0
            if scan_row:
                asset_count = conn.execute("SELECT COUNT(DISTINCT ip) as c FROM assets WHERE scan_id=?", (scan_row["scan_id"],)).fetchone()["c"]
                
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


# (ACTIVE_JOBS 和 signal 已移至顶部)
import uuid
import subprocess
import os
import asyncio

async def background_waiter(job_id: str, proc: subprocess.Popen, log_fh):
    """后台监控子进程结束，确保释放文件句柄并清理内存"""
    try:
        while proc.poll() is None:
            await asyncio.sleep(1)
    except Exception:
        pass
    finally:
        try:
            log_fh.close()
        except Exception:
            pass
        if job_id in ACTIVE_JOBS:
            del ACTIVE_JOBS[job_id]
class OpsRunRequest(BaseModel):
    command: str
    theater: str = "default"
    sudo_pass: Optional[str] = None
    target_ips: Optional[List[str]] = []

@app.post("/api/v1/ops/run")
def ops_run(req: OpsRunRequest, background_tasks: BackgroundTasks):
    """异步执行作战命令，返回 job_id"""
    job_id = f"job_{uuid.uuid4().hex[:8]}"
    
    # Ensure theater dir exists (which should be CatTeam_Loot/theater_name, except default is CatTeam_Loot)
    theater_dir = os.path.join(BASE_DIR, "CatTeam_Loot", req.theater) if req.theater != "default" else os.path.join(BASE_DIR, "CatTeam_Loot")
    log_dir = os.path.join(theater_dir, "logs")
    os.makedirs(log_dir, exist_ok=True)
    log_file = os.path.join(log_dir, f"{job_id}.log")

    if req.target_ips and len(req.target_ips) > 0:
        targets_file = os.path.join(theater_dir, "targets.txt")
        with open(targets_file, "w") as f:
            for ip in req.target_ips:
                f.write(f"{ip}\n")

    # Start process in background
    with open(log_file, "w") as f:
        f.write(f"--- [Project CLAW V8.2] Task Started: {req.command} ---\n")
        if req.target_ips and len(req.target_ips) > 0:
            f.write(f"--- [Target Scope Override] Locked on {len(req.target_ips)} critical host(s) ---\n")
        f.write("\n")
    
    # Open log file for subprocess stdout — store handle so it can be closed later
    log_fh = open(log_file, "a")
    
    # D7 PTY 伪装：用 script 强行剥除 isatty() 的无色彩降级，并防止管道缓存。兼容 macOS/Linux 取消 '-c'
    # 使用 python3 原生 pty 包裹作为最高兼容性的“万能欺骗器”，强制工具开启 TTY 行缓冲并吐出 ANSI 颜色！
    cmd_wrapper = f"""python3 -c "import pty, sys; sys.exit(pty.spawn(['bash', '-c', {repr(req.command)}]))" """
    
    if req.sudo_pass:
        cmd_wrapper = f"sudo -S -p '' {cmd_wrapper}"
        proc = subprocess.Popen(
            cmd_wrapper,
            shell=True,
            cwd=BASE_DIR,
            stdin=subprocess.PIPE,
            stdout=log_fh,
            stderr=subprocess.STDOUT,
            text=True,
            preexec_fn=os.setsid
        )
        proc.stdin.write(req.sudo_pass + "\n")
        proc.stdin.flush()
        proc.stdin.close()
    else:
        proc = subprocess.Popen(
            cmd_wrapper,
            shell=True,
            cwd=BASE_DIR,
            stdout=log_fh,
            stderr=subprocess.STDOUT,
            text=True,
            preexec_fn=os.setsid
        )

    ACTIVE_JOBS[job_id] = {"proc": proc, "log_fh": log_fh}
    
    # 安全的后台清理任务
    background_tasks.add_task(background_waiter, job_id, proc, log_fh)
    
    return {"status": "ok", "job_id": job_id, "command": req.command, "log_file": log_file}

@app.post("/api/v1/ops/stop/{job_id}")
def ops_stop(job_id: str):
    job = ACTIVE_JOBS.get(job_id)
    if not job:
        return {"error": "Job not found or already completed"}
    try:
        # Kill the entire process group, not just the shell (prevents nmap/nuclei orphans)
        os.killpg(os.getpgid(job["proc"].pid), signal.SIGTERM)
        # file close and memory cleanup is now handled safely by background_waiter!
        return {"status": "ok", "message": f"Job {job_id} terminated."}
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/v1/ops/jobs/active")
def ops_active_jobs():
    """抛出当前失联阵地里的挂起任务，供终端断线重连（D7）"""
    jobs = []
    for jid, job in ACTIVE_JOBS.items():
        if job.get("proc") and job["proc"].poll() is None:
            jobs.append({"job_id": jid, "pid": job["proc"].pid})
    return {"status": "ok", "active_jobs": jobs}

@app.get("/api/v1/ops/log/{job_id}")
async def ops_log(job_id: str, theater: str = "default", request: Request = None):
    """SSE 流式返回该 job 的日志输出（D7 Chunk 块重构版）"""
    log_file = os.path.join(BASE_DIR, "CatTeam_Loot", theater, "logs", f"{job_id}.log")
    
    async def log_generator():
        if not os.path.exists(log_file):
            yield f"data: {json.dumps({'text': '[Sys] Log file not found'})}\n\n"
            return
            
        async with aiofiles.open(log_file, "rb") as f:
            job = ACTIVE_JOBS.get(job_id)
            proc = job["proc"] if job else None
            
            while True:
                if request and await request.is_disconnected():
                    break # 侦测断开，及时止损后端 I/O

                # 采用 4KB Chunk 块读取，彻底解决 OOM 和 \r 进度条阻塞死锁
                chunk = await f.read(4096)
                if chunk:
                    # 宽容解码，直接投喂原生块给 xterm.js
                    text = chunk.decode("utf-8", errors="replace")
                    yield f"data: {json.dumps({'text': text}, ensure_ascii=False)}\n\n"
                    
                    # 🚀 极其关键：强制让出事件循环控制权，拯救 FastAPI 高并发！
                    await asyncio.sleep(0.01)
                else:
                    if proc and proc.poll() is not None:
                        # Process finished and no more lines — close file handle
                        if job and job.get("log_fh"):
                            try: job["log_fh"].close()
                            except: pass
                        finished_msg = f"\n--- [Task Finished with code {proc.returncode}] ---\n"
                        yield f"data: {json.dumps({'text': finished_msg, 'done': True})}\n\n"
                        break
                    # 进程还在跑，暂无新输出，挂起等待
                    await asyncio.sleep(0.2)

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

import google.genai as genai

class OsintRequest(BaseModel):
    targets: List[str]

class OsintDictionary(BaseModel):
    dictionary: List[str]

import csv
from io import StringIO

ALFA_CSV_PREFIX = "/tmp/claw_alfa"

@app.post("/api/v1/wifi/start")
def start_alfa_sniffing(interface: str = "wlan1"):
    """启动 Airodump-ng 物理嗅探守护进程"""
    os.system(f"rm -f {ALFA_CSV_PREFIX}-*.csv")

    cmd = [
        "airodump-ng", interface,
        "-w", ALFA_CSV_PREFIX,
        "--output-format", "csv",
        "--write-interval", "1"  # 关键：每1秒强制落盘一次
    ]
    # 使用 DEVNULL 丢弃终端脏输出，完全依靠 CSV 数据交换
    subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, preexec_fn=os.setsid)
    return {"status": "sniffing_started", "interface": interface}

@app.get("/api/v1/wifi/stream")
async def stream_alfa_radar(request: Request):
    """前端接入此端点，获取无阻塞的 1Hz 雷达刷新流"""
    csv_file = f"{ALFA_CSV_PREFIX}-01.csv"
    
    async def event_generator():
        while True:
            if await request.is_disconnected():
                break
                
            if os.path.exists(csv_file):
                try:
                    # aiofiles 确保读取不阻塞 FastAPI 主事件循环
                    async with aiofiles.open(csv_file, mode='r', encoding='utf-8', errors='ignore') as f:
                        content = await f.read()
                        
                    # 坑点防范：airodump CSV 分为上下两截，上半区 AP，下半区 Client，中间由空行隔开
                    ap_section = content.split('\r\n\r\n')[0] if '\r\n\r\n' in content else content.split('\n\n')[0]
                    reader = csv.DictReader(StringIO(ap_section.strip()))
                    
                    bssids = []
                    for row in reader:
                        # 清洗脏键名与无效行
                        row = {k.strip(): v.strip() for k, v in row.items() if k and k.strip()}
                        if not row or row.get('BSSID') == 'BSSID' or not row.get('BSSID'): 
                            continue
                            
                        bssids.append({
                            "bssid": row.get('BSSID', ''),
                            "ssid": row.get('ESSID', '').strip() or '<HIDDEN>',
                            "pwr": row.get('Power', '-100'),
                            "ch": row.get('channel', '0'),
                            "enc": row.get('Privacy', 'OPEN')
                        })
                        
                    yield f"data: {json.dumps({'targets': bssids})}\n\n"
                except Exception:
                    pass # 容忍读写瞬间极小概率的 I/O 竞态冲突
            
            await asyncio.sleep(1) # 与 write-interval 同频脉冲

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.post("/api/v1/agent/osint/stream")
async def generate_osint_dict_stream(req: OsintRequest, request: Request):
    """流式 OSINT 特工 (彻底释放主线程阻塞)"""
    
    async def event_generator():
        # 1. 立即返回握手日志，稳住前端 UI
        yield f"data: {json.dumps({'type': 'log', 'msg': '[OSINT] 建立隐蔽安全隧道...'})}\n\n"
        await asyncio.sleep(0.5)
        yield f"data: {json.dumps({'type': 'log', 'msg': f'[OSINT] 劫持目标实体指纹: {req.targets}'})}\n\n"
        yield f"data: {json.dumps({'type': 'log', 'msg': '[OSINT] 呼叫 Gemini 3.1 Pro 智能体群集推演...'})}\n\n"

        # 2. 将同步阻塞的大模型请求封装为普通函数
        def _call_gemini():
            if not AGENT_API_KEY:
                return {"dictionary": ["Admin@2026", "root", "123456"]}
            from google import genai
            client = genai.Client(api_key=AGENT_API_KEY)
            prompt = f"针对高危设备 {req.targets} 推断15个极其精准的弱口令... 无废话，返回JSON格式"
            response = client.models.generate_content(
                model='gemini-3.1-pro-preview',
                contents=prompt,
                config={'response_mime_type': 'application/json', 'response_schema': OsintDictionary}
            )
            return json.loads(response.text)

        try:
            # 3. 核心：在此异步挂起，由线程池接管重型计算，绝对不阻塞 FastAPI 主循环
            result = await asyncio.to_thread(_call_gemini)
            
            if await request.is_disconnected():
                return
                
            yield f"data: {json.dumps({'type': 'log', 'msg': '[OSINT] Pydantic 字典蒸馏完成！'})}\n\n"
            # 推送最终成果并标记结束
            yield f"data: {json.dumps({'type': 'done', 'dictionary': result.get('dictionary', [])})}\n\n"
            
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'msg': f'特工神经元熔断: {str(e)}'})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/")
def root():
    return {
        "name": "CLAW API",
        "version": "8.2.0",
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
