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
    """Record Agent Operations Audit Log（已加固：防日志注入）"""
    try:
        os.makedirs(os.path.dirname(AUDIT_LOG), exist_ok=True)
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        safe_action = action.replace("\n", "⏎").replace("\r", "")
        safe_detail = detail[:200].replace("\n", "⏎").replace("\r", "")
        with open(AUDIT_LOG, "a") as f:
            f.write(f"[{ts}] MCP_ARMORY: {safe_action} | {safe_detail}\n")
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

# Shell 元字符黑名单 — 防止通过管道/子shell/反引号绕过 HITL 分级
SHELL_METACHAR_PATTERNS = [";", "||", "&&", "|", "`", "$(", "\n", "\r"]

def classify_command(cmd: str) -> str:
    """三级分类: green / yellow / red（已加固：Shell 元字符链路检测 + 剔除 Sudo 引信 + Fail Closed）"""
    # 🚨 解决 Sudo 悖论：在鉴权前剥离系统静默注入的密码管道，只审查真实载荷
    audit_cmd = cmd.strip().lower()
    if audit_cmd.startswith("echo '") and " | sudo -s " in audit_cmd:
        audit_cmd = audit_cmd.split(" | sudo -s ", 1)[1]

    # Layer 0: Shell 元字符检测 (切换为 Fail-Closed)
    for meta in SHELL_METACHAR_PATTERNS:
        if meta in audit_cmd:
            import re
            segments = re.split(r'[;|&`\n\r]|\$\(', audit_cmd)
            for seg in segments:
                seg = seg.strip()
                if not seg: continue
                for pattern in RED_PATTERNS:
                    if pattern in seg: return "red"
            # 🚨 核心修复：使用了元字符却未命中黑名单 (如 curl | bash)
            # 必须强制拉响警报，绝不允许降级为 yellow！
            return "red"
            
    # Layer 1: 标准模式匹配
    for pattern in RED_PATTERNS:
        if pattern in audit_cmd: return "red"
    for pattern in YELLOW_PATTERNS:
        if pattern in audit_cmd: return "yellow"
    first_word = audit_cmd.split()[0] if audit_cmd.split() else ""
    first_word = os.path.basename(first_word)
    if first_word in GREEN_COMMANDS: return "green"
    return "yellow"


# ============================================================
#  MCP Tools Declarations
# ============================================================

@mcp.tool()
def claw_query_db(sql: str, thought: str, justification: str, mitre_ttp: str = "N/A", risk_level: str = "GREEN") -> str:
    """
    Query the CLAW SQLite database containing tables: 
    - scans(scan history)
    - assets(IPs)
    - ports(open ports)
    - vulns(vulnerabilities)
    - wifi_nodes(bssid, essid, power, channel, encryption, last_seen) -> Layer 2 physical RF assets.
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

# ============================================================
#  D19 Ruling: LFI Physical Sandbox (Dual-Layer Defense)
# ============================================================
ALLOWED_READ_DIRS = [
    os.path.abspath(LOOT_DIR),                    # 战利品目录
    os.path.abspath(BASE_DIR),                     # 项目根目录（脚本源码）
]

# 绝对禁止读取的文件黑名单（即使在白名单目录内）
BLOCKED_FILENAMES = {
    "config.sh",              # API Key 和敏感配置
    ".env",                   # 环境变量
    ".gitconfig",             # Git 凭据
    "id_rsa", "id_ed25519",   # SSH 私钥
    "id_rsa.pub",             # SSH 公钥
    ".bash_history",          # 命令历史
    ".zsh_history",
}

# 绝对禁止穿越到的系统目录前缀
BLOCKED_PREFIXES = [
    "/etc/", "/var/", "/usr/", "/root/", "/home/",
    "/tmp/", "/dev/", "/proc/", "/sys/",
    os.path.expanduser("~/.ssh"),
    os.path.expanduser("~/.gnupg"),
    os.path.expanduser("~/.config"),
]


def _is_path_safe(target_path: str) -> tuple[bool, str]:
    """双层安全校验：白名单目录 + 黑名单文件"""
    abs_target = os.path.abspath(target_path)
    
    # Layer 1: 系统级危险路径阻断
    for prefix in BLOCKED_PREFIXES:
        if abs_target.startswith(prefix):
            return False, f"系统目录穿越被拦截: {prefix}"
    
    # Layer 2: 白名单目录校验（必须处于项目范围内）
    in_whitelist = False
    for allowed_dir in ALLOWED_READ_DIRS:
        try:
            if os.path.commonpath([allowed_dir, abs_target]) == allowed_dir:
                in_whitelist = True
                break
        except ValueError:
            continue
    
    if not in_whitelist:
        return False, f"路径不在授权范围内"
    
    # Layer 3: 文件级黑名单（凭据保护）
    basename = os.path.basename(abs_target)
    if basename in BLOCKED_FILENAMES:
        return False, f"该文件已被安全策略永久封锁: {basename}"
    
    return True, "ok"


@mcp.tool()
def claw_read_file(path: str, thought: str, justification: str, max_lines: int = 50, mitre_ttp: str = "N/A", risk_level: str = "GREEN") -> str:
    """Read a project file or loot file. Reads within CatTeam_Loot/ and project scripts (.py/.sh) are allowed. config.sh and system files are permanently blocked."""
    audit_log_write("TOOL_CALLED", f"claw_read_file: {path}")
    
    # 1. 规范化路径（优先在 LOOT_DIR 中查找）
    full_path = os.path.abspath(os.path.join(LOOT_DIR, path))
    
    # 2. 解析 latest 软链接
    if os.path.islink(os.path.join(LOOT_DIR, "latest")):
        full_path = full_path.replace(
            os.path.join(LOOT_DIR, "latest"),
            os.path.realpath(os.path.join(LOOT_DIR, "latest"))
        )
    
    # 3. 如果 LOOT_DIR 中不存在，尝试项目根目录
    if not os.path.exists(full_path):
        project_path = os.path.join(BASE_DIR, path)
        if os.path.exists(project_path):
            full_path = project_path
        else:
            # 递归搜索
            candidates = glob.glob(os.path.join(LOOT_DIR, "**", os.path.basename(path)), recursive=True)
            if not candidates:
                candidates = glob.glob(os.path.join(BASE_DIR, "**", os.path.basename(path)), recursive=True)
            if candidates:
                full_path = candidates[0]
            else:
                return json.dumps({"error": f"文件不存在: {path}"})
    
    # 4. 双层安全校验（核心熔断机制）
    is_safe, reason = _is_path_safe(full_path)
    if not is_safe:
        audit_log_write("SECURITY_VIOLATION", f"Agent LFI 越权尝试被物理拦截: {path} -> {reason}")
        return json.dumps({
            "error": f"🚨 致命越权拦截：{reason}。底层 I/O 指令已被物理熔断！"
        })
    
    # 5. 正常读取文件
    try:
        with open(full_path, "r", errors="replace") as f:
            lines = f.readlines()
        total = len(lines)
        content = "".join(lines[:max_lines])
        if total > max_lines:
            content += f"\n... [截断: 共 {total} 行, 显示 {max_lines} 行]"
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
        
        true_total_assets = conn.execute("SELECT COUNT(ip) FROM assets WHERE scan_id=?", (scan_id,)).fetchone()[0]
        
        assets = {}
        for r in conn.execute(
            """
            SELECT a.ip, a.os, p.port, p.service, p.product, p.version 
            FROM (SELECT ip, os FROM assets WHERE scan_id=? ORDER BY ip LIMIT 50) a 
            LEFT JOIN ports p ON a.ip=p.ip AND p.scan_id=?
            """, (scan_id, scan_id)
        ):
            ip = r[0]
            if ip not in assets: assets[ip] = {"os": r[1], "ports": []}
            if r[2]: assets[ip]["ports"].append({"port": r[2], "service": r[3], "product": r[4] or "", "version": r[5] or ""})
        conn.close()
        
        res = {"env": env, "scan_id": scan_id, "total_assets": true_total_assets, "returned_assets": len(assets), "assets": assets}
        if true_total_assets > 50:
            res["warning"] = f"Environment contains {true_total_assets} assets. Output truncated to 50 to prevent AI Context Explosion. Use `claw_query_db` to run targeted SQL analyses."
            
        return json.dumps(res, ensure_ascii=False, default=str)
    except Exception as e:
        return json.dumps({"error": f"查询失败: {str(e)}"})

# 全局锚点：用于存储当前执行的最底层长耗时子树的进程组 ID
ACTIVE_AGENT_PGID = None

def cancel_active_task():
    """暴露给 REST API，用于斩断 AI 的长时间阻塞执行（如 Nmap 或漏洞利用执行）"""
    global ACTIVE_AGENT_PGID
    if ACTIVE_AGENT_PGID is not None:
        import os as _os
        try:
            _os.killpg(ACTIVE_AGENT_PGID, 9)
            ACTIVE_AGENT_PGID = None
            return True
        except Exception as e:
            return False
    return False

@mcp.tool()
def claw_execute_shell(command: str, thought: str, justification: str, reason: str = "", mitre_ttp: str = "N/A", risk_level: str = "YELLOW") -> str:
    """Execute a local shell command. Subject to Human-In-The-Loop approval for YELLOW/RED level commands."""
    cmd_lower = command.lower().strip()
    for block_cmd in ["msfconsole", "python -", "top", "vim", "nano", "nc -l"]:
        if cmd_lower.startswith(block_cmd) or f" {block_cmd} " in f" {cmd_lower} ":
            return json.dumps({"error": f"安全拦截: 禁止执行交互式命令 {block_cmd} (会阻塞 Agent 线程)。请使用 API 或非交互模式（如 msfconsole -x）。"})

    # 🚨 密码脱敏：还原不带密码的原始指令，用于日志打印和报错，死守安全底线
    safe_log_cmd = command
    if safe_log_cmd.startswith("echo '") and " | sudo -S " in safe_log_cmd:
        safe_log_cmd = "sudo " + safe_log_cmd.split(" | sudo -S ", 1)[1]

    level = classify_command(command)
    if level == "red":
        audit_log_write(f"BLOCKED:{safe_log_cmd}", f"RED 级操作需要审批 reason={reason}")
        return json.dumps({"error": "🔴 高危操作需要 Web 端审批", "command": safe_log_cmd, "risk_level": "red", "requires_approval": True})

    audit_log_write(f"EXEC:{safe_log_cmd}", f"level={level}")
    try:
        proc = subprocess.Popen(
            command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            cwd=os.path.join(BASE_DIR), text=True, bufsize=1, preexec_fn=os.setsid
        )
        
        global ACTIVE_AGENT_PGID
        import os as _os
        # 将最新的 Popen PID 存入全局，支持优雅的斩断
        try:
            ACTIVE_AGENT_PGID = _os.getpgid(proc.pid)
            with open("/tmp/claw_ai_pgids.txt", "a") as f:
                f.write(f"{proc.pid}\n")
        except Exception:
            pass
        
        # 渐进式输出收割与控制台重定向：最多等 300 秒（5分钟）
        import threading
        TIMEOUT_TOTAL = 300
        stdout_parts = []
        stderr_parts = []
        
        # 每次执行先清空并打上标记
        with open("/tmp/claw_ai_output.log", "w", encoding="utf-8") as f:
            f.write(f"\\033[1;36m=== [LYNX AI] 独立后台进程挂载 ===\\033[0m\\n")
            f.write(f"\\033[90m$ {safe_log_cmd}\\033[0m\\n\\n")

        def tail_stream(stream, is_stderr=False):
            for line in iter(stream.readline, ""):
                if not line: break
                if is_stderr:
                    stderr_parts.append(line)
                else:
                    stdout_parts.append(line)
                try:
                    with open("/tmp/claw_ai_output.log", "a", encoding="utf-8") as f:
                        f.write(line)
                except Exception:
                    pass

        t_out = threading.Thread(target=tail_stream, args=(proc.stdout, False))
        t_err = threading.Thread(target=tail_stream, args=(proc.stderr, True))
        t_out.start()
        t_err.start()
        
        try:
            proc.wait(timeout=TIMEOUT_TOTAL)
        except subprocess.TimeoutExpired:
            # 超时后杀进程
            import os as _os
            try:
                _os.killpg(_os.getpgid(proc.pid), 9)  # 杀掉整个进程组
            except Exception:
                proc.kill()
            t_out.join(timeout=1.0)
            t_err.join(timeout=1.0)
            
            with open("/tmp/claw_ai_output.log", "a", encoding="utf-8") as f:
                f.write(f"\\n\\033[1;31m[!] 进程执行超时被强制斩断 ({TIMEOUT_TOTAL}s)\\033[0m\\n")

            stdout = "".join(stdout_parts)
            stderr = "".join(stderr_parts)
            stdout_trunc = stdout[:8000] + (f"\\n... [超时截断: 共 {len(stdout)} 字符]" if len(stdout) > 8000 else "")
            return json.dumps({
                "warning": f"命令执行超时 ({TIMEOUT_TOTAL}秒)，已终止。以下为超时前的部分输出：",
                "stdout": stdout_trunc, 
                "stderr": stderr[:2000],
                "timed_out": True
            }, ensure_ascii=False)
        
        t_out.join()
        t_err.join()
        
        with open("/tmp/claw_ai_output.log", "a", encoding="utf-8") as f:
            if proc.returncode == -9:
                f.write(f"\\n\\033[1;31m[!] 指挥官强制介入打断：命令已被 SIGKILL 手动终止！ (Cancel)\\033[0m\\n")
            else:
                f.write(f"\\n\\033[1;36m=== [LYNX AI] 进程释放 (Exit Code: {proc.returncode}) ===\\033[0m\\n")

        stdout = "".join(stdout_parts)
        stderr = "".join(stderr_parts)
        
        # 将被杀死的进程特殊标记，引导 AI 优雅恢复
        if proc.returncode == -9:
            return json.dumps({
                "error": "User Cancelled: 长官（指挥官）已在控制台手动手动强制打断了该进程的剩余执行步骤。请立即中止此路探索并在回复里告知长官。如果你收到中断，你可以换一种更安全的方式或者停下来请求长官下一步指示。",
                "stdout_before_cancel": stdout, "stderr_before_cancel": stderr
            }, ensure_ascii=False)
        
        # 正常完成
        STDOUT_CAP = 8000
        stdout_trunc = stdout[:STDOUT_CAP] + (f"\n... [截断: 共 {len(stdout)} 字符]" if len(stdout) > STDOUT_CAP else "")
        stderr_trunc = stderr[:2000]
        
        return json.dumps({"exit_code": proc.returncode, "stdout": stdout_trunc, "stderr": stderr_trunc}, ensure_ascii=False)
    except Exception as e: 
        return json.dumps({"error": f"执行失败: {str(e)}"})

@mcp.tool()
def claw_db_import_nmap(xml_path: str, thought: str, justification: str, env: str = "default", risk_level: str = "GREEN", mitre_ttp: str = "T1046") -> str:
    """Parse an Nmap XML output file and import the discovered assets/ports into the central claw.db database so the Commander HUD can see them."""
    audit_log_write("TOOL_CALLED", f"claw_db_import_nmap: {xml_path}")
    if not os.path.exists(xml_path):
        return json.dumps({"error": f"文件找不到: {xml_path}"})
    
    import xml.etree.ElementTree as ET
    from datetime import datetime
    try:
        tree = ET.parse(xml_path)
    except Exception as e:
        return json.dumps({"error": f"XML 解析失败: {str(e)}"})
        
    root = tree.getroot()
    assets = {}
    
    for host in root.findall("host"):
        addr_elem = host.find("address[@addrtype='ipv4']")
        if addr_elem is None: continue
        ip = addr_elem.get("addr")
        
        state_elem = host.find("status")
        if state_elem is not None and state_elem.get("state") != "up":
            continue
            
        os_name = "Unknown"
        os_match = host.find(".//osmatch")
        if os_match is not None:
            os_name = os_match.get("name", "Unknown")
            
        ports, services = [], []
        for port in host.findall(".//port"):
            state = port.find("state")
            if state is not None and state.get("state") == "open":
                port_id = int(port.get("portid"))
                protocol = port.get("protocol", "tcp")
                ports.append(port_id)
                svc = port.find("service")
                if svc is not None:
                    services.append({
                        "port": port_id, "protocol": protocol,
                        "service": svc.get("name", "unknown"),
                        "product": svc.get("product", ""),
                        "version": svc.get("version", "")
                    })
        
        # 即使没有开放端口，只要存活就记录
        assets[ip] = {"ports": sorted(ports), "os": os_name, "services": services}
        
    if not assets:
        return json.dumps({"warning": "该 XML 文件中未发现任何活跃主机"})
        
    try:
        sys.path.insert(0, BASE_DIR)
        import db_engine
        conn = db_engine.get_db(DB_PATH)
        scan_id = datetime.now().strftime("%Y%m%d_%H%M%S") + "_ai"
        # 适配双写模式，只调用 SQLite
        db_engine.register_scan(conn, scan_id, "ai_probe", env)
        for ip, info in assets.items():
            db_engine.insert_asset(conn, ip, scan_id, os_name=info["os"])
            for svc in info["services"]:
                db_engine.insert_port(
                    conn, ip, svc["port"], scan_id, svc["protocol"], 
                    svc["service"], svc["product"], svc["version"]
                )
        conn.commit()
        count = conn.execute("SELECT count(*) FROM assets WHERE scan_id=?", (scan_id,)).fetchone()[0]
        conn.close()
        return json.dumps({
            "success": True, 
            "message": f"成功将 {count} 台资产导入当前战区 ({env}) 资产大盘",
            "imported_ips": list(assets.keys())
        }, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": f"落库异常: {str(e)}"})

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

@mcp.tool()
def claw_a2ui_render_screenshot(html_payload: str, viewport_width: int = 1280, viewport_height: int = 800) -> str:
    """
    (A2UI M-Vial) Render a raw HTML payload (e.g., a forged phishing page) using headless Playwright and 
    return a multimodal Base64 image snapshot back to Lynx. Use this to visually review layout and correct hallucinations.
    """
    import tempfile, base64, os
    from playwright.sync_api import sync_playwright
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".html") as f:
        f.write(html_payload.encode("utf-8"))
        tmp_path = f.name
        
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": viewport_width, "height": viewport_height})
            page.goto(f"file://{tmp_path}")
            page.wait_for_timeout(500)
            screenshot_bytes = page.screenshot(full_page=True)
            b64 = base64.b64encode(screenshot_bytes).decode('utf-8')
            browser.close()
        os.remove(tmp_path)
        return json.dumps({"status": "✅ 页面渲染成功", "__a2ui_b64__": b64})
    except Exception as e:
        if os.path.exists(tmp_path): os.remove(tmp_path)
        return json.dumps({"error": f"Playwright 渲染异常: {str(e)}"})

if __name__ == "__main__":
    mcp.run()
