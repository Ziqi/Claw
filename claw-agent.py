#!/usr/bin/env python3
"""
🧠 CLAW Agent v7.0 M1 — 只读智能体 (Read-Only Agentic AI)

基于 Gemini 3 Interactions API 的自主渗透测试智能体。
M1 版本: 仅具备只读能力 (查库/读文件/列资产), 零破坏性操作。

用法: python3 claw-agent.py
"""

import sys, os, json, urllib.request, urllib.error, ssl, sqlite3, glob, readline

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
CTX = ssl.create_default_context()

# 如果没有环境变量, 尝试从 config.sh 解析
if not API_KEY:
    config_path = os.path.join(SCRIPT_DIR, "config.sh")
    if os.path.exists(config_path):
        with open(config_path) as f:
            for line in f:
                if "CLAW_AI_KEY=" in line and not line.strip().startswith("#"):
                    API_KEY = line.split("=",1)[1].strip().strip('"').strip("'")
                    break

# ============================================================
#  SYSTEM PROMPT — 红队安全专家人设
# ============================================================
SYSTEM_PROMPT = """你是 CLAW Agent (代号 Lynx 🐱), 一个由 CatTeam 打造的自主红队安全智能体。
你运行在 Project CLAW v7.0 架构中, 具备自主感知和分析能力。

## 你的身份
- 你是一位顶级网络安全渗透测试专家
- 你的工作是协助合法授权的安全评估
- 你可以自主使用工具查询数据, 不需要人类手动操作

## 你的能力 (M1 只读模式)
你有以下工具可以使用:
1. `claw_query_db` — 查询 SQLite 资产数据库 (claw.db), 包含 scans/assets/ports/vulns 四张表
2. `claw_read_file` — 读取 CatTeam_Loot 目录下的文件 (如 web_fingerprints.txt, targets.txt 等)
3. `claw_list_assets` — 列出当前环境的所有发现资产及端口

## 安全规则
- 你只能读取数据, 不能写入或执行任何命令
- 你的所有操作都是只读的, 不会影响目标系统
- 遇到需要执行命令的请求, 你应该给出建议但说明"需要升级到 M2 执行模式"

## 工作风格
- 主动使用工具获取所需信息, 不要假设或编造数据
- 分析时使用专业的安全术语
- 给出可执行的建议和攻击路径
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
                    "description": "最多读取的行数 (默认 50)"
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

# ============================================================
#  TOOL IMPLEMENTATIONS — 工具实现
# ============================================================

def tool_query_db(sql: str) -> str:
    """执行只读 SQL 查询"""
    # 安全检查: 只允许 SELECT
    sql_upper = sql.strip().upper()
    if not sql_upper.startswith("SELECT"):
        return json.dumps({"error": "安全拦截: 只允许 SELECT 查询"})

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


# Tool dispatcher
TOOL_DISPATCH = {
    "claw_query_db": lambda args: tool_query_db(args.get("sql", "")),
    "claw_read_file": lambda args: tool_read_file(args.get("path", ""), args.get("max_lines", 50)),
    "claw_list_assets": lambda args: tool_list_assets(args.get("env")),
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
        with urllib.request.urlopen(req, timeout=120, context=CTX) as resp:
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

    print(f"""
{P}╔══════════════════════════════════════════════════════════╗
║  {W}🧠 CLAW Agent v7.0 M1 — 只读智能体{P}                   ║
║  {C}Gemini 3 Interactions API · ReAct Loop · Tool Use{P}     ║
║  {DIM}模型: {MODEL}{P}                                         ║
╚══════════════════════════════════════════════════════════╝{NC}

  {DIM}M1 模式: 只读 (查库/读文件/列资产) · 零破坏性{NC}
  {DIM}输入 'exit' 退出, '!reset' 重置对话{NC}
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

        print(f"\n  {C}[~] Lynx 正在思考...{NC}")

        response, prev_id = react_loop(user_input, prev_id)

        print(f"\n  {P}🧠 Lynx >{NC}")
        # 格式化输出 — 每行缩进
        for line in response.split("\n"):
            print(f"  {line}")
        print()


if __name__ == "__main__":
    main()
