#!/usr/bin/env python3
"""
Project CLAW 模块 17 — 问 Lynx (交互式 AI 对话)
多轮对话模式：自动携带扫描上下文，持续问答
"""

import json
import os
import sys
import subprocess
import re

# ========== 色彩 ==========
Y = "\033[1;33m"
G = "\033[1;32m"
R = "\033[0;31m"
C = "\033[0;36m"
P = "\033[1;35m"
DIM = "\033[2m"
BOLD = "\033[1m"
NC = "\033[0m"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)
import db_engine


def load_config():
    """从 config.sh 读取 AI 配置"""
    config = {}
    config_path = os.path.join(SCRIPT_DIR, "config.sh")
    if os.path.isfile(config_path):
        with open(config_path, "r") as f:
            for line in f:
                line = line.strip()
                if line.startswith("#") or "=" not in line:
                    continue
                m = re.match(r'^(\w+)=["\']?([^"\']*)["\']?', line)
                if m:
                    config[m.group(1)] = m.group(2)
    return config


def get_scan_context():
    """自动提取最新扫描数据作为系统上下文"""
    db_path = os.path.join(SCRIPT_DIR, "CatTeam_Loot", "claw.db")
    if not os.path.isfile(db_path):
        return "暂无扫描数据。"

    conn = db_engine.get_db(db_path)
    latest_scan, _ = db_engine.get_last_two_scans(conn)
    if not latest_scan:
        conn.close()
        return "暂无扫描数据。"

    assets = db_engine.get_scan_assets(conn, latest_scan)
    conn.close()

    if not assets:
        return "暂无扫描数据。"

    lines = [f"当前扫描 {latest_scan}, {len(assets)} 台主机:"]
    for ip in sorted(assets.keys()):
        info = assets[ip]
        svcs = ", ".join(
            f"{s['port']}/{s['service']}" + (f"({s.get('product','')})" if s.get('product') else "")
            for s in info.get("services", [])
        )
        lines.append(f"  {ip} [{info['os']}]: {svcs}")

    # 尝试加载 web_fingerprints
    wf_path = os.path.join(SCRIPT_DIR, "CatTeam_Loot", "latest", "web_fingerprints.txt")
    if os.path.isfile(wf_path):
        try:
            with open(wf_path, "r", encoding="utf-8") as f:
                lines_tmp = f.readlines()
            useful_wf = []
            skip = False
            for line in lines_tmp:
                if line.startswith("[FAIL]"):
                    skip = True
                    continue
                elif line.startswith("["):
                    skip = False
                if not skip:
                    useful_wf.append(line)
            wf = "".join(useful_wf).strip()
            if wf:
                lines.append("\n--- Web 指纹探测结果 ---\n" + wf[:3000])
        except Exception:
            pass

    return "\n".join(lines)


SYSTEM_PROMPT = """你是 Lynx，Project CLAW 红队系统的 AI 战术副官。

你的角色：
- 回答关于渗透测试、网络安全的技术问题
- 基于当前扫描数据给出具体建议
- 帮助构建攻击命令（Nmap, Impacket, Nuclei 等）
- 提供 OPSEC 提醒

规则：
- 用中文简洁回答
- 涉及命令时给出可直接复制的完整命令
- 引用 CLAW 菜单编号（如"建议执行 8) 横向移动"）

以下是当前内网扫描数据：
"""


def call_gemini(api_key, model, messages):
    """调用 Gemini 多轮对话"""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    contents = []
    for msg in messages:
        contents.append({
            "role": msg["role"],
            "parts": [{"text": msg["text"]}]
        })

    payload = {
        "contents": contents,
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 4096,
        },
        "safetySettings": [
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
        ]
    }

    payload_json = json.dumps(payload, ensure_ascii=False)

    result = subprocess.run(
        ["curl", "-s", "-X", "POST", url,
         "-H", "Content-Type: application/json",
         "-d", payload_json],
        capture_output=True, text=True, timeout=120
    )

    if result.returncode != 0:
        return None, f"curl 失败: {result.stderr}"

    try:
        resp = json.loads(result.stdout)
    except json.JSONDecodeError:
        return None, f"JSON 解析失败: {result.stdout[:200]}"

    if "candidates" in resp:
        parts = resp["candidates"][0].get("content", {}).get("parts", [])
        text = "\n".join(p.get("text", "") for p in parts)
        return text, None

    if "error" in resp:
        return None, f"API 错误: {resp['error'].get('message', str(resp['error']))}"

    return None, f"未知响应: {json.dumps(resp, ensure_ascii=False)[:200]}"


def main():
    print(f"{Y}>>> [Project CLAW 模块 17] 问 Lynx — 交互式 AI 对话 <<<{NC}")
    print()

    config = load_config()
    api_key = os.environ.get("CLAW_AI_KEY", config.get("CLAW_AI_KEY", ""))
    if not api_key:
        print(f"{R}[!] 未找到 API Key。请在 config.sh 中设置 CLAW_AI_KEY{NC}")
        sys.exit(1)

    model = config.get("CLAW_AI_MODEL", "gemini-3-flash-preview")

    # 加载扫描上下文
    scan_context = get_scan_context()

    # 初始化对话历史（系统提示 + 扫描数据作为第一轮）
    system_text = SYSTEM_PROMPT + "\n" + scan_context
    messages = [
        {"role": "user", "text": system_text},
        {"role": "model", "text": "收到，Lynx 已就绪。我已加载当前扫描数据，随时准备为你提供战术支持。请问有什么需要分析的？"}
    ]

    print(f"  {P}/\\_/\\{NC}")
    print(f"  {P}( o.o ){NC}  {BOLD}Lynx 对话模式{NC}")
    print(f"  {P} > ^ <{NC}  {DIM}模型: {model}{NC}")
    print()
    print(f"  {DIM}输入问题开始对话，输入 q 或 exit 退出{NC}")
    print(f"  {DIM}已自动加载扫描数据作为上下文{NC}")
    print()

    turn_count = 0

    while True:
        try:
            user_input = input(f"  {G}你>{NC} ").strip()
        except (EOFError, KeyboardInterrupt):
            break

        if not user_input:
            continue
        if user_input.lower() in ("q", "quit", "exit", "bye"):
            break

        messages.append({"role": "user", "text": user_input})
        turn_count += 1

        print(f"\n  {DIM}[-] Lynx 思考中...{NC}\n")

        text, err = call_gemini(api_key, model, messages)

        if err:
            print(f"  {R}[!] {err}{NC}\n")
            messages.pop()  # 移除失败的用户消息
            continue

        # 记录到对话历史
        messages.append({"role": "model", "text": text})

        # 显示回复
        print(f"  {P}Lynx>{NC} {text}\n")

        # 控制上下文窗口（保留系统提示 + 最近 10 轮）
        max_messages = 22  # 2(系统) + 10轮 * 2
        if len(messages) > max_messages:
            messages = messages[:2] + messages[-(max_messages-2):]

    print(f"\n  {G}[+] Lynx 对话结束。共 {turn_count} 轮。{NC}\n")


if __name__ == "__main__":
    main()
