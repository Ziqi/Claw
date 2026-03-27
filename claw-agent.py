#!/usr/bin/env python3
"""
🧠 CLAW Agent v7.0 M2 — 带锁执行者 (Locked Executor)

基于 Gemini 3 Interactions API 的自主渗透测试智能体。
M2 版本: 只读 + 受控执行能力, 三级 HITL 权限分级。

用法: python3 claw-agent.py
      python3 claw-agent.py --readonly   # 强制 M1 只读模式
"""

import sys, os, json, urllib.request, urllib.error, ssl, sqlite3, glob, readline, subprocess, shlex

# === 路径 ===
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

# === 色彩 ===
G="\033[1;32m"; R="\033[0;31m"; Y="\033[1;33m"; C="\033[0;36m"
P="\033[1;35m"; W="\033[1;37m"; DIM="\033[2m"; BOLD="\033[1m"; NC="\033[0m"

# === 配置 ===
API_KEY = os.environ.get("GEMINI_API_KEY") or os.environ.get("CLAW_AI_KEY", "")
MODEL = os.environ.get("CLAW_AGENT_MODEL", "gemini-3-flash-preview")
API_BASE = "https://generativelanguage.googleapis.com/v1beta"
DB_PATH = os.path.join(SCRIPT_DIR, "CatTeam_Loot", "claw.db")
LOOT_DIR = os.path.join(SCRIPT_DIR, "CatTeam_Loot")
AUDIT_LOG = os.path.join(SCRIPT_DIR, "CatTeam_Loot", "agent_audit.log")
CTX = ssl.create_default_context()

from datetime import datetime

def audit_log(action: str, detail: str = ""):
    """记录 Agent 操作审计日志"""
    try:
        os.makedirs(os.path.dirname(AUDIT_LOG), exist_ok=True)
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(AUDIT_LOG, "a") as f:
            f.write(f"[{ts}] {action} | {detail[:200]}\n")
    except:
        pass

# 如果没有环境变量, 尝试从 config.sh 解析
if not API_KEY:
    config_path = os.path.join(SCRIPT_DIR, "config.sh")
    if os.path.exists(config_path):
        with open(config_path) as f:
            for line in f:
                if "CLAW_AI_KEY=" in line and not line.strip().startswith("#"):
                    API_KEY = line.split("=",1)[1].strip().strip('"').strip("'")
                    break

# === 运行模式 ===
READONLY_MODE = "--readonly" in sys.argv

# ============================================================
#  HITL 三级权限系统 (导师批复: 混合界面 + HITL 三级分权)
# ============================================================

# 🟢 GREEN: 自动放行 (只读/无副作用)
GREEN_COMMANDS = {
    "ls", "cat", "head", "tail", "wc", "grep", "find", "file",
    "whoami", "hostname", "ifconfig", "ip", "arp", "netstat",
    "dig", "nslookup", "ping", "traceroute",
    "sqlite3", "python3",  # 读取脚本
    "echo", "date", "uptime", "ps", "which",
}

# 🟡 YELLOW: 需要人工确认 [Y/n] (侦察/扫描/非破坏性)
YELLOW_PATTERNS = [
    "nmap", "make fast", "make recon", "make web", "make diff",
    "make status", "make report", "make nuclei", "make toolbox",
    "curl", "wget", "nikto", "hydra",
    "01-recon", "02-probe", "02.5-parse", "03-audit",
    "07-report", "08-diff", "11-webhook", "12-nuclei",
    "16-ai-analyze", "17-ask-lynx", "18-ai-bloodhound",
]

# 🔴 RED: 强制拦截 (破坏性/后渗透/横向移动)
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
    """三级分类: green / yellow / red"""
    cmd_lower = cmd.strip().lower()

    # 先检查 RED
    for pattern in RED_PATTERNS:
        if pattern in cmd_lower:
            return "red"

    # 再检查 YELLOW
    for pattern in YELLOW_PATTERNS:
        if pattern in cmd_lower:
            return "yellow"

    # 检查 GREEN (按首个命令词)
    first_word = cmd_lower.split()[0] if cmd_lower.split() else ""
    # 处理路径: /usr/bin/ls → ls
    first_word = os.path.basename(first_word)
    if first_word in GREEN_COMMANDS:
        return "green"

    # 默认: yellow (未知命令需要确认)
    return "yellow"


def hitl_gate(cmd: str, level: str) -> bool:
    """HITL 审批门: 根据级别决定是否放行"""
    if level == "green":
        print(f"  {G}  🟢 自动放行 (只读){NC}")
        return True

    if level == "red":
        print(f"  {R}  🔴 高危操作! 需要双重确认{NC}")
        print(f"  {R}     命令: {cmd}{NC}")
        try:
            confirm = input(f"  {R}     输入 'CONFIRM' 确认执行 (其他=取消): {NC}").strip()
        except (EOFError, KeyboardInterrupt):
            return False
        if confirm == "CONFIRM":
            print(f"  {Y}  ⚠️  已授权执行{NC}")
            return True
        print(f"  {DIM}  ✗ 已拒绝{NC}")
        return False

    # yellow
    print(f"  {Y}  🟡 需要确认{NC}")
    print(f"  {Y}     命令: {cmd}{NC}")
    try:
        confirm = input(f"  {Y}     执行? [Y/n]: {NC}").strip().lower()
    except (EOFError, KeyboardInterrupt):
        return False
    if confirm in ("", "y", "yes"):
        return True
    print(f"  {DIM}  ✗ 已拒绝{NC}")
    return False


# ============================================================
#  SYSTEM PROMPT — 红队安全专家人设
# ============================================================
SYSTEM_PROMPT = """你是 CLAW Agent (代号 Lynx 🐱), 一个由 CatTeam 打造的自主红队安全智能体。
你运行在 Project CLAW v7.0 M2 架构中, 具备自主感知、分析和受控执行能力。

## 你的身份
- 你是一位顶级网络安全渗透测试专家
- 你的工作是协助合法授权的安全评估
- 你可以自主使用工具查询数据和执行命令

## 你的能力
你有以下工具可以使用:

### 只读工具 (L1, 自动执行)
1. `claw_query_db` — 查询 SQLite 资产数据库 (claw.db)
2. `claw_read_file` — 读取 CatTeam_Loot 目录下的文件
3. `claw_list_assets` — 列出当前环境的所有发现资产及端口

### 执行工具 (L2-L5, 需人工审批)
4. `claw_execute_shell` — 执行 shell 命令 (受 HITL 三级权限控制)
5. `claw_run_module` — 运行 CLAW 模块 (如 make fast, make web 等)

## HITL 三级权限规则
- 🟢 GREEN (自动放行): ls, cat, grep, ping, ifconfig 等只读命令
- 🟡 YELLOW (需确认): nmap, make fast, curl 等侦察扫描命令
- 🔴 RED (双重确认): make crack, make lateral, psexec 等攻击/后渗透命令
- 你不能绕过权限系统, 所有命令都受到人类长官审批

## 工作风格
- 先用只读工具收集情报, 再制定行动方案
- 主动使用工具获取所需信息, 不要假设或编造数据
- 执行命令前, 在工具调用的 reason 中说明原因
- 分析时使用专业的安全术语
- 回答简洁专业, 用中文交流
"""

# ============================================================
#  TOOL DECLARATIONS — 工具定义 (JSON Schema)
# ============================================================
TOOLS = [
    {
        "type": "function",
        "name": "claw_query_db",
        "description": "查询 CLAW SQLite 资产数据库。数据库包含四张表: scans(扫描记录), assets(资产/IP), ports(端口/服务), vulns(漏洞)。请用标准 SQL 查询。示例: SELECT ip, port, service FROM ports WHERE scan_id=(SELECT scan_id FROM scans ORDER BY timestamp DESC LIMIT 1)",
        "parameters": {
            "type": "object",
            "properties": {
                "sql": {
                    "type": "string",
                    "description": "要执行的 SQL 查询语句 (只允许 SELECT)"
                }
            },
            "required": ["sql"]
        }
    },
    {
        "type": "function",
        "name": "claw_read_file",
        "description": "读取 CatTeam_Loot 目录下的文件。常用文件: latest/web_fingerprints.txt (Web指纹), latest/targets.txt (目标IP列表), latest/nmap_results.xml (Nmap原始结果), alerts/alerts.log (告警日志)。路径相对于 CatTeam_Loot/ 目录。",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "相对于 CatTeam_Loot/ 目录的文件路径, 如 'latest/web_fingerprints.txt'"
                },
                "max_lines": {
                    "type": "integer",
                    "description": "最多读取的行数 (默认 30, 最大 100)"
                }
            },
            "required": ["path"]
        }
    },
    {
        "type": "function",
        "name": "claw_list_assets",
        "description": "列出当前环境中发现的所有资产 (IP地址) 及其开放端口和服务。返回格式化的资产清单。",
        "parameters": {
            "type": "object",
            "properties": {
                "env": {
                    "type": "string",
                    "description": "环境名称 (可选, 默认使用当前环境)"
                }
            }
        }
    }
]

# === M2 执行工具 (仅在非只读模式下启用) ===
M2_TOOLS = [
    {
        "type": "function",
        "name": "claw_execute_shell",
        "description": "执行 shell 命令。受 HITL 三级权限控制: 🟢GREEN(ls/cat等)自动执行, 🟡YELLOW(nmap/curl等)需用户确认, 🔴RED(psexec/hashcat等)需双重确认。命令在项目根目录下执行。",
        "parameters": {
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "要执行的 shell 命令"
                },
                "reason": {
                    "type": "string",
                    "description": "执行此命令的原因 (会展示给人类长官)"
                }
            },
            "required": ["command", "reason"]
        }
    },
    {
        "type": "function",
        "name": "claw_run_module",
        "description": "运行 CLAW 已有模块。可用模块: make fast(快速侦察), make web(Web指纹), make diff(资产对比), make report(生成战报), make nuclei(漏洞扫描), make toolbox(工具箱), make status(状态)。危险模块需双重确认。",
        "parameters": {
            "type": "object",
            "properties": {
                "module": {
                    "type": "string",
                    "description": "模块命令, 如 'make fast', 'make web'"
                },
                "reason": {
                    "type": "string",
                    "description": "运行此模块的原因"
                }
            },
            "required": ["module", "reason"]
        }
    }
]

# 根据模式组合工具列表
if not READONLY_MODE:
    TOOLS.extend(M2_TOOLS)

# ============================================================
#  TOOL IMPLEMENTATIONS — 工具实现
# ============================================================

def tool_query_db(sql: str) -> str:
    """执行只读 SQL 查询"""
    # 安全检查: 只允许 SELECT
    sql_upper = sql.strip().upper()
    if not sql_upper.startswith("SELECT") and not sql_upper.startswith("PRAGMA"):
        return json.dumps({"error": "安全拦截: 只允许 SELECT 或 PRAGMA 查询"})

    for forbidden in ["DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "CREATE", "ATTACH"]:
        if forbidden in sql_upper:
            return json.dumps({"error": f"安全拦截: 禁止使用 {forbidden} 语句"})

    if not os.path.exists(DB_PATH):
        return json.dumps({"error": "数据库不存在。请先运行扫描 (make fast)"})

    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.execute(sql)
        rows = [dict(row) for row in cursor.fetchall()]
        conn.close()

        if not rows:
            return json.dumps({"result": "查询返回空结果", "sql": sql})

        # 限制结果大小
        result = rows[:100]
        return json.dumps({"result": result, "total": len(rows), "shown": len(result)}, ensure_ascii=False, default=str)
    except Exception as e:
        return json.dumps({"error": f"SQL 执行失败: {str(e)}"})


def tool_read_file(path: str, max_lines: int = 50) -> str:
    """读取 Loot 目录下的文件"""
    # 安全: 防止路径穿越
    full_path = os.path.normpath(os.path.join(LOOT_DIR, path))
    if not full_path.startswith(os.path.normpath(LOOT_DIR)):
        return json.dumps({"error": "安全拦截: 路径穿越被禁止"})

    # 解析 symlink
    if os.path.islink(os.path.join(LOOT_DIR, "latest")):
        full_path = full_path.replace(
            os.path.join(LOOT_DIR, "latest"),
            os.path.realpath(os.path.join(LOOT_DIR, "latest"))
        )

    if not os.path.exists(full_path):
        # 尝试模糊匹配
        candidates = glob.glob(os.path.join(LOOT_DIR, "**", os.path.basename(path)), recursive=True)
        if candidates:
            full_path = candidates[0]
        else:
            return json.dumps({"error": f"文件不存在: {path}", "available": _list_loot_files()})

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


def tool_list_assets(env: str = None) -> str:
    """列出资产清单"""
    if not os.path.exists(DB_PATH):
        return json.dumps({"error": "数据库不存在"})

    try:
        conn = sqlite3.connect(DB_PATH)

        # 获取环境
        if not env:
            env_file = os.path.join(LOOT_DIR, "claw_env.txt")
            env = open(env_file).read().strip() if os.path.exists(env_file) else "default"

        # 获取最新 scan_id
        cursor = conn.execute(
            "SELECT scan_id FROM scans WHERE env=? ORDER BY timestamp DESC LIMIT 1", (env,)
        )
        row = cursor.fetchone()
        if not row:
            conn.close()
            return json.dumps({"error": f"环境 '{env}' 无扫描记录"})

        scan_id = row[0]

        # 获取资产
        assets = {}
        for r in conn.execute(
            "SELECT a.ip, a.os, p.port, p.service, p.product, p.version "
            "FROM assets a LEFT JOIN ports p ON a.ip=p.ip AND a.scan_id=p.scan_id "
            "WHERE a.scan_id=?", (scan_id,)
        ):
            ip = r[0]
            if ip not in assets:
                assets[ip] = {"os": r[1], "ports": []}
            if r[2]:
                assets[ip]["ports"].append({
                    "port": r[2], "service": r[3],
                    "product": r[4] or "", "version": r[5] or ""
                })

        conn.close()
        return json.dumps({
            "env": env, "scan_id": scan_id,
            "total_assets": len(assets), "assets": assets
        }, ensure_ascii=False, default=str)
    except Exception as e:
        return json.dumps({"error": f"查询失败: {str(e)}"})


def _list_loot_files():
    """列出 Loot 目录中的文件"""
    files = []
    latest = os.path.join(LOOT_DIR, "latest")
    if os.path.exists(latest):
        real_latest = os.path.realpath(latest)
        for f in os.listdir(real_latest):
            if os.path.isfile(os.path.join(real_latest, f)):
                files.append(f"latest/{f}")
    return files[:20]


# === M2 执行工具实现 ===

def tool_execute_shell(command: str, reason: str = "") -> str:
    """执行 shell 命令 (受 HITL 控制)"""
    if READONLY_MODE:
        return json.dumps({"error": "只读模式: 不允许执行命令。请去掉 --readonly 参数"})

    cmd_lower = command.lower().strip()
    for block_cmd in ["msfconsole", "python -", "top", "vim", "nano", "nc -l"]:
        if cmd_lower.startswith(block_cmd) or f" {block_cmd} " in f" {cmd_lower} ":
            return json.dumps({"error": f"安全拦截: 禁止执行交互式命令 {block_cmd} (会阻塞 Agent 线程)。请使用 API 或非交互模式（如 msfconsole -x）。"})

    level = classify_command(command)
    print(f"  {DIM}  理由: {reason}{NC}")

    if not hitl_gate(command, level):
        return json.dumps({"error": "人类长官拒绝执行此命令", "command": command})

    try:
        # 使用 Popen 实时流式输出 (解决 sudo/长时间运行卡住问题)
        proc = subprocess.Popen(
            command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            stdin=sys.stdin,  # 透传 stdin (让 sudo 密码提示正常工作)
            cwd=SCRIPT_DIR, text=True, bufsize=1
        )

        print(f"  {DIM}  ─── 命令输出 ───{NC}")
        stdout_lines = []
        import select, threading

        # 用线程读取 stderr 防止阻塞
        stderr_buf = []
        def read_stderr():
            for line in proc.stderr:
                stderr_buf.append(line)
        t = threading.Thread(target=read_stderr, daemon=True)
        t.start()

        # 实时读取 stdout 并显示
        for line in proc.stdout:
            stripped = line.rstrip('\n')
            if len(stdout_lines) < 50:  # 实时显示前 50 行
                print(f"  {DIM}  │ {stripped}{NC}")
            elif len(stdout_lines) == 50:
                print(f"  {DIM}  │ ... (后续输出省略显示，仍在运行){NC}")
            stdout_lines.append(line)

        proc.wait(timeout=300)
        print(f"  {DIM}  ─── 退出码: {proc.returncode} ───{NC}")
        t.join(timeout=2)

        stdout = "".join(stdout_lines)[:3000]
        stderr = "".join(stderr_buf)[:1000]
        if len("".join(stdout_lines)) > 3000:
            stdout += f"\n... [截断: 共 {len(''.join(stdout_lines))} 字符]"

        return json.dumps({
            "exit_code": proc.returncode,
            "stdout": stdout,
            "stderr": stderr,
        }, ensure_ascii=False)
    except subprocess.TimeoutExpired:
        return json.dumps({"error": "命令执行超时 (120秒)"})
    except Exception as e:
        return json.dumps({"error": f"执行失败: {str(e)}"})


def tool_run_module(module: str, reason: str = "") -> str:
    """运行 CLAW 模块 (make 命令)"""
    if READONLY_MODE:
        return json.dumps({"error": "只读模式: 不允许执行模块"})

    # 只允许 make 命令
    if not module.strip().startswith("make "):
        return json.dumps({"error": "只允许 make 开头的模块命令"})

    return tool_execute_shell(module, reason)


# Tool dispatcher
TOOL_DISPATCH = {
    "claw_query_db": lambda args: tool_query_db(args.get("sql", "")),
    "claw_read_file": lambda args: tool_read_file(args.get("path", ""), min(args.get("max_lines", 30), 100)),
    "claw_list_assets": lambda args: tool_list_assets(args.get("env")),
    "claw_execute_shell": lambda args: tool_execute_shell(args.get("command", ""), args.get("reason", "")),
    "claw_run_module": lambda args: tool_run_module(args.get("module", ""), args.get("reason", "")),
}

# ============================================================
#  API CLIENT — Interactions API (零依赖 REST)
# ============================================================

def api_call(payload: dict) -> dict:
    """调用 Interactions API"""
    url = f"{API_BASE}/interactions?key={API_KEY}"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})

    try:
        with urllib.request.urlopen(req, timeout=300, context=CTX) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        return {"error": f"HTTP {e.code}: {body[:500]}"}
    except Exception as e:
        return {"error": str(e)}

# ============================================================
#  REACT LOOP — 感知→行动→验证循环
# ============================================================

def react_loop(user_input: str, prev_id: str = None) -> tuple:
    """
    执行 ReAct 循环:
    1. 发送用户输入 + 工具定义
    2. 如果模型返回 function_call, 执行工具并回送结果
    3. 重复直到模型返回纯文本

    Returns: (response_text, interaction_id)
    """
    # 构建请求
    payload = {
        "model": MODEL,
        "input": user_input,
        "tools": TOOLS,
        "system_instruction": SYSTEM_PROMPT,
    }
    if prev_id:
        payload["previous_interaction_id"] = prev_id

    max_steps = 10  # 防止无限循环
    step = 0

    while step < max_steps:
        step += 1
        result = api_call(payload)

        if "error" in result:
            return f"[API Error] {result['error']}", prev_id

        interaction_id = result.get("id", prev_id)
        outputs = result.get("outputs", [])

        if not outputs:
            return "[模型未返回内容]", interaction_id

        # 检查是否有 function_call
        function_calls = [o for o in outputs if o.get("type") == "function_call"]

        if not function_calls:
            # 纯文本回复 — 循环结束
            text_parts = [o.get("text", "") for o in outputs if o.get("type") == "text" or "text" in o]
            final_text = "\n".join(t for t in text_parts if t)
            if not final_text:
                # 可能 text 直接在 output 的顶层
                final_text = outputs[-1].get("text", str(outputs[-1]))
            return final_text, interaction_id

        # 有 function_call — 执行工具
        function_results = []
        for fc in function_calls:
            name = fc.get("name", "")
            args = fc.get("arguments", {})
            call_id = fc.get("id", "")

            print(f"  {C}🔧 调用工具: {name}({json.dumps(args, ensure_ascii=False)[:80]}){NC}")

            # 执行
            handler = TOOL_DISPATCH.get(name)
            if handler:
                tool_result = handler(args)
            else:
                tool_result = json.dumps({"error": f"未知工具: {name}"})

            # 审计日志
            try:
                parsed = json.loads(tool_result)
                status = "ERROR" if "error" in parsed else "OK"
            except:
                status = "OK"
            audit_log(f"TOOL:{name}", f"args={json.dumps(args, ensure_ascii=False)[:100]} status={status}")

            # 输出简要结果
            try:
                parsed = json.loads(tool_result)
                if "error" in parsed:
                    print(f"  {R}  ✗ {parsed['error']}{NC}")
                else:
                    preview = tool_result[:100] + "..." if len(tool_result) > 100 else tool_result
                    print(f"  {G}  ✓ 返回 {len(tool_result)} 字节{NC}")
            except:
                pass

            function_results.append({
                "type": "function_result",
                "name": name,
                "call_id": call_id,
                "result": tool_result
            })

        # 构建下一轮请求 — 回送工具结果
        payload = {
            "model": MODEL,
            "input": function_results,
            "tools": TOOLS,
            "system_instruction": SYSTEM_PROMPT,
            "previous_interaction_id": interaction_id,
        }

    return "[警告: ReAct 循环超过最大步数]", interaction_id

# ============================================================
#  TUI REPL — 交互式命令行
# ============================================================

def main():
    if not API_KEY:
        print(f"\n  {R}[!] 未找到 API Key{NC}")
        print(f"  {DIM}    请设置 GEMINI_API_KEY 或 CLAW_AI_KEY 环境变量{NC}")
        print(f"  {DIM}    或在 config.sh 中配置 CLAW_AI_KEY{NC}\n")
        sys.exit(1)

    mode_label = "M1 只读" if READONLY_MODE else "M2 带锁执行者"
    mode_color = C if READONLY_MODE else Y

    print(f"""
{P}╔══════════════════════════════════════════════════════════╗
║  {W}🧠 CLAW Agent v7.0 — {mode_label}{P}                      ║
║  {C}Gemini 3 Interactions API · ReAct Loop · Tool Use{P}     ║
║  {DIM}模型: {MODEL}{P}                                         ║
╚══════════════════════════════════════════════════════════╝{NC}

  {mode_color}模式: {mode_label}{NC}
  {DIM}工具: 3 只读{(' + 2 执行 (HITL 三级分权)' if not READONLY_MODE else '')}{NC}
  {DIM}输入 'exit' 退出, '!reset' 重置对话, '!mode' 查看权限{NC}
""")

    prev_id = None

    while True:
        try:
            user_input = input(f"  {G}🐱 You >{NC} ").strip()
        except (EOFError, KeyboardInterrupt):
            print(f"\n  {DIM}安全撤退。再见，长官。{NC}\n")
            break

        if not user_input:
            continue
        if user_input.lower() in ("exit", "quit", "q"):
            print(f"\n  {DIM}安全撤退。再见，长官。{NC}\n")
            break
        if user_input == "!reset":
            prev_id = None
            print(f"  {Y}[~] 对话已重置{NC}\n")
            continue
        if user_input == "!id":
            print(f"  {DIM}Interaction ID: {prev_id}{NC}\n")
            continue
        if user_input == "!mode":
            print(f"  {W}当前模式: {'M1 只读' if READONLY_MODE else 'M2 带锁执行者'}{NC}")
            print(f"  {G}  🟢 GREEN (自动): ls, cat, grep, ping...{NC}")
            if not READONLY_MODE:
                print(f"  {Y}  🟡 YELLOW (确认): nmap, make fast, curl...{NC}")
                print(f"  {R}  🔴 RED (双重确认): psexec, hashcat, make crack...{NC}")
            print()
            continue

        print(f"\n  {C}[~] Lynx 正在思考...{NC}")

        response, prev_id = react_loop(user_input, prev_id)

        print(f"\n  {P}🧠 Lynx >{NC}")
        # 格式化输出 — 每行缩进
        for line in response.split("\n"):
            print(f"  {line}")
        print()


if __name__ == "__main__":
    main()
