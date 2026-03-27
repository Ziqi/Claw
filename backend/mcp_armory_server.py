#!/usr/bin/env python3
"""
🧠 CLAW Armory MCP Server (V8.2 Sprint 4)

Provides the Tactical Armory tools via Model Context Protocol (MCP) using FastMCP.
This decouples the tools from the LLM execution logic, allowing any agent
to dynamically discover and use them.
"""

import os, json, sqlite3, glob, subprocess, threading
from datetime import datetime
from mcp.server.fastmcp import FastMCP

# === Initialize FastMCP Server ===
mcp = FastMCP("CLAW_Armory_Server")

# === Paths ===
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "CatTeam_Loot", "claw.db")
LOOT_DIR = os.path.join(BASE_DIR, "CatTeam_Loot")
AUDIT_LOG = os.path.join(BASE_DIR, "CatTeam_Loot", "agent_audit.log")

def audit_log_write(action: str, detail: str = ""):
    """Record Agent Operations Audit Log"""
    try:
        os.makedirs(os.path.dirname(AUDIT_LOG), exist_ok=True)
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(AUDIT_LOG, "a") as f:
            f.write(f"[{ts}] MCP_ARMORY: {action} | {detail[:200]}\n")
    except:
        pass

# === HITL Rules ===
GREEN_COMMANDS = {
    "ls", "cat", "head", "tail", "wc", "grep", "find", "file",
    "whoami", "hostname", "ifconfig", "ip", "arp", "netstat",
    "dig", "nslookup", "ping", "traceroute",
    "sqlite3", "python3", "echo", "date", "uptime", "ps", "which",
}
YELLOW_PATTERNS = [
    "nmap", "make fast", "make recon", "make web", "make diff",
    "make status", "make report", "make nuclei", "make toolbox",
    "curl", "wget", "nikto", "hydra",
    "01-recon", "02-probe", "02.5-parse", "03-audit",
    "07-report", "08-diff", "11-webhook", "12-nuclei",
    "16-ai-analyze", "17-ask-lynx", "18-ai-bloodhound",
]
RED_PATTERNS = [
    "rm ", "rm -", "mkfs", "dd if", "shutdown", "reboot",
    "make crack", "make lateral", "make loot", "make phantom",
    "make kerberoast", "make clean",
    "04-phantom", "05-cracker", "06-psexec", "09-loot", "10-kerberoast",
    "23-hp-proxy",
    "psexec", "smbexec", "wmiexec", "secretsdump",
    "responder", "hashcat", "john",
    "> /", ">> /", "chmod", "chown", "sudo",
]

def classify_command(cmd: str) -> str:
    cmd_lower = cmd.strip().lower()
    for pattern in RED_PATTERNS:
        if pattern in cmd_lower: return "red"
    for pattern in YELLOW_PATTERNS:
        if pattern in cmd_lower: return "yellow"
    first_word = cmd_lower.split()[0] if cmd_lower.split() else ""
    first_word = os.path.basename(first_word)
    if first_word in GREEN_COMMANDS: return "green"
    return "yellow"


# ============================================================
#  MCP Tools Declarations
# ============================================================

@mcp.tool()
def claw_query_db(sql: str, thought: str, justification: str, mitre_ttp: str = "N/A", risk_level: str = "GREEN") -> str:
    """
    Query the CLAW SQLite database containing tables: scans(scan history), assets(IPs), ports(open ports), vulns(vulnerabilities).
    Only SELECT or PRAGMA statements are permitted.
    """
    audit_log_write("TOOL_CALLED", f"claw_query_db: {sql}")
    sql_upper = sql.strip().upper()
    if not sql_upper.startswith("SELECT") and not sql_upper.startswith("PRAGMA"):
        return json.dumps({"error": "安全拦截: 只允许 SELECT 或 PRAGMA 查询"})
    for forbidden in ["DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "CREATE", "ATTACH"]:
        if forbidden in sql_upper: return json.dumps({"error": f"安全拦截: 禁止 {forbidden}"})
    if not os.path.exists(DB_PATH): return json.dumps({"error": "数据库不存在。请先运行 make fast"})
    
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        rows = [dict(r) for r in conn.execute(sql).fetchall()]
        conn.close()
        if not rows: return json.dumps({"result": "查询返回空结果", "sql": sql})
        result = rows[:100]
        return json.dumps({"result": result, "total": len(rows), "shown": len(result)}, ensure_ascii=False, default=str)
    except Exception as e:
        return json.dumps({"error": f"SQL 执行失败: {str(e)}"})

@mcp.tool()
def claw_read_file(path: str, thought: str, justification: str, max_lines: int = 50, mitre_ttp: str = "N/A", risk_level: str = "GREEN") -> str:
    """Read a project file or loot file from CatTeam_Loot directory."""
    audit_log_write("TOOL_CALLED", f"claw_read_file: {path}")
    full_path = os.path.normpath(os.path.join(LOOT_DIR, path))
    if not (full_path.startswith(os.path.normpath(LOOT_DIR)) or full_path.startswith(os.path.normpath(BASE_DIR))):
        return json.dumps({"error": "安全拦截: 路径穿越被禁止"})
    if os.path.islink(os.path.join(LOOT_DIR, "latest")):
        full_path = full_path.replace(os.path.join(LOOT_DIR, "latest"), os.path.realpath(os.path.join(LOOT_DIR, "latest")))
    
    if not os.path.exists(full_path):
        project_path = os.path.join(BASE_DIR, path)
        if os.path.exists(project_path): full_path = project_path
        else:
            candidates = glob.glob(os.path.join(LOOT_DIR, "**", os.path.basename(path)), recursive=True)
            if not candidates: candidates = glob.glob(os.path.join(BASE_DIR, "**", os.path.basename(path)), recursive=True)
            if candidates: full_path = candidates[0]
            else: return json.dumps({"error": f"文件不存在: {path}"})
            
    try:
        with open(full_path, "r", errors="replace") as f: lines = f.readlines()
        total = len(lines)
        content = "".join(lines[:max_lines])
        if total > max_lines: content += f"\n... [截断: 共 {total} 行, 显示 {max_lines} 行]"
        return json.dumps({"file": path, "content": content, "total_lines": total}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": f"读取失败: {str(e)}"})

@mcp.tool()
def claw_list_assets(thought: str, justification: str, env: str = "default", mitre_ttp: str = "N/A", risk_level: str = "GREEN") -> str:
    """List all discovered assets and ports in the current environment."""
    audit_log_write("TOOL_CALLED", f"claw_list_assets: env={env}")
    if not os.path.exists(DB_PATH): return json.dumps({"error": "数据库不存在"})
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.execute("SELECT scan_id FROM scans WHERE env=? ORDER BY timestamp DESC LIMIT 1", (env,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            return json.dumps({"error": f"环境 '{env}' 无扫描记录"})
        scan_id = row[0]
        assets = {}
        for r in conn.execute(
            "SELECT a.ip, a.os, p.port, p.service, p.product, p.version "
            "FROM assets a LEFT JOIN ports p ON a.ip=p.ip AND a.scan_id=p.scan_id "
            "WHERE a.scan_id=?", (scan_id,)
        ):
            ip = r[0]
            if ip not in assets: assets[ip] = {"os": r[1], "ports": []}
            if r[2]: assets[ip]["ports"].append({"port": r[2], "service": r[3], "product": r[4] or "", "version": r[5] or ""})
        conn.close()
        return json.dumps({"env": env, "scan_id": scan_id, "total_assets": len(assets), "assets": assets}, ensure_ascii=False, default=str)
    except Exception as e:
        return json.dumps({"error": f"查询失败: {str(e)}"})

@mcp.tool()
def claw_execute_shell(command: str, thought: str, justification: str, reason: str = "", mitre_ttp: str = "N/A", risk_level: str = "YELLOW") -> str:
    """Execute a local shell command. Subject to Human-In-The-Loop approval for YELLOW/RED level commands."""
    cmd_lower = command.lower().strip()
    for block_cmd in ["msfconsole", "python -", "top", "vim", "nano", "nc -l"]:
        if cmd_lower.startswith(block_cmd) or f" {block_cmd} " in f" {cmd_lower} ":
            return json.dumps({"error": f"安全拦截: 禁止执行交互式命令 {block_cmd} (会阻塞 Agent 线程)。请使用 API 或非交互模式（如 msfconsole -x）。"})

    level = classify_command(command)
    if level == "red":
        audit_log_write(f"BLOCKED:{command}", f"RED 级操作需要审批 reason={reason}")
        return json.dumps({"error": "🔴 高危操作需要 Web 端审批", "command": command, "risk_level": "red", "requires_approval": True})

    audit_log_write(f"EXEC:{command}", f"level={level}")
    try:
        proc = subprocess.Popen(
            command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            cwd=os.path.join(BASE_DIR), text=True, bufsize=1
        )
        stdout_lines, stderr_buf = [], []
        def read_stderr():
            for line in proc.stderr: stderr_buf.append(line)
        t = threading.Thread(target=read_stderr, daemon=True)
        t.start()
        for line in proc.stdout: stdout_lines.append(line)
        proc.wait(timeout=120)
        t.join(timeout=2)
        
        stdout = "".join(stdout_lines)[:3000]
        stderr = "".join(stderr_buf)[:1000]
        if len("".join(stdout_lines)) > 3000: stdout += f"\n... [截断: 共 {len(''.join(stdout_lines))} 字符]"
        
        return json.dumps({"exit_code": proc.returncode, "stdout": stdout, "stderr": stderr}, ensure_ascii=False)
    except subprocess.TimeoutExpired: return json.dumps({"error": "命令执行超时 (120秒)"})
    except Exception as e: return json.dumps({"error": f"执行失败: {str(e)}"})

@mcp.tool()
def claw_run_module(module: str, thought: str, justification: str, reason: str = "", mitre_ttp: str = "N/A", risk_level: str = "YELLOW") -> str:
    """Run a specific CLAW macro module (e.g. 'make fast', 'make web')."""
    module = module.strip()
    if not module.startswith("make "):
        known = [
            'fast', 'run', 'web', 'audit', 'crack', 'diff', 'recon', 'scan',
            'loot', 'probe', 'parse', 'phantom', 'report', 'webhook', 'ghost',
            'bloodhound', 'ask-lynx', 'ai-analyze', 'exploit', 'proxy-unlock',
            'lateral', 'nuclei', 'kerberoast', 'firmware', 'status', 'console',
            'toolbox', 'armory',
        ]
        for k in known:
            if k in module.lower():
                module = f"make {k}"
                break
        else:
            return json.dumps({"error": f"无法识别模块 '{module}'。请使用 make 命令，如: make audit, make web, make fast"})
    return claw_execute_shell(command=module, thought=thought, justification=justification, reason=reason, mitre_ttp=mitre_ttp, risk_level=risk_level)

@mcp.tool()
def claw_delegate_agent(target_agent: str, task: str, thought: str, justification: str, risk_level: str = "GREEN") -> str:
    """
    (A2A Protocol) Delegate a specialized task to a remote sub-agent (e.g. 'recon_agent').
    Lynx should use this to offload complex specialized analysis such as deep recon planning or exploit crafting.
    """
    import urllib.request
    audit_log_write("A2A_DELEGATE", f"Target: {target_agent}, Task: {task}")
    
    port_map = {"recon_agent": 8001}
    target_port = port_map.get(target_agent.lower())
    if not target_port:
        return json.dumps({"error": f"Agent {target_agent} 未注册或不在线。当前可用子智能体: {list(port_map.keys())}"})
        
    url = f"http://localhost:{target_port}/a2a/chat"
    data = json.dumps({"task": task}).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            res = json.loads(resp.read())
            return json.dumps({"delegate_result": res.get("reply", "No response")})
    except Exception as e:
        return json.dumps({"error": f"A2A 请求失败: {str(e)}"})

if __name__ == "__main__":
    mcp.run()
