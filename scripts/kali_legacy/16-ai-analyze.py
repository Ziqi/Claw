#!/usr/bin/env python3
"""
Project CLAW 模块 16 — AI 战术分析 (Gemini Flash)
读取 SQLite 扫描数据 → 构建 prompt → 调用 Gemini generateContent → 输出战术建议
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
NC = "\033[0m"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)
import db_engine

# ========== 配置 ==========
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
                # 解析 KEY="VALUE" 或 KEY=VALUE
                m = re.match(r'^(\w+)=["\']?([^"\']*)["\']?', line)
                if m:
                    config[m.group(1)] = m.group(2)
    return config


def get_api_key(config):
    """获取 API Key (环境变量优先)"""
    key = os.environ.get("CLAW_AI_KEY", config.get("CLAW_AI_KEY", ""))
    if not key:
        print(f"{R}[!] 未找到 API Key。请在 config.sh 中设置 CLAW_AI_KEY{NC}")
        sys.exit(1)
    return key


# ========== OPSEC 脱敏层 ==========
def mask_data(text, enable_mask=False):
    """
    OPSEC 脱敏：替换真实 IP 为别名
    靶场模式(默认): 不脱敏
    实战模式: enable_mask=True 时启用
    """
    if not enable_mask:
        return text

    # 收集所有 IP 并分配别名
    ips = sorted(set(re.findall(r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b', text)))
    ip_map = {}
    for i, ip in enumerate(ips):
        ip_map[ip] = f"[TARGET_{chr(65+i)}]"  # TARGET_A, TARGET_B, ...

    masked = text
    for ip, alias in ip_map.items():
        masked = masked.replace(ip, alias)
    return masked


# ========== 数据提取 ==========
def extract_scan_summary(conn, scan_id):
    """从 SQLite 提取扫描摘要，格式化为 AI 可读文本"""
    assets = db_engine.get_scan_assets(conn, scan_id)
    if not assets:
        return None

    lines = []
    lines.append(f"扫描批次: {scan_id}")
    lines.append(f"活跃主机: {len(assets)} 台")
    lines.append("")

    for ip in sorted(assets.keys()):
        info = assets[ip]
        port_str = ", ".join(str(p) for p in info["ports"])
        lines.append(f"主机: {ip}  OS: {info['os']}")
        lines.append(f"  端口: [{port_str}]")
        for svc in info.get("services", []):
            svc_line = f"  - {svc['port']}/{svc.get('protocol','tcp')} {svc['service']}"
            if svc.get("product"):
                svc_line += f" ({svc['product']}"
                if svc.get("version"):
                    svc_line += f" {svc['version']}"
                svc_line += ")"
            lines.append(svc_line)
        lines.append("")

    return "\n".join(lines)


def extract_web_fingerprints():
    """读取最新的 web_fingerprints.txt 作为附加情报，解决文件系统与SQLite的时序偏差"""
    wf_path = os.path.join(SCRIPT_DIR, "CatTeam_Loot", "latest", "web_fingerprints.txt")
    if os.path.isfile(wf_path):
        try:
            with open(wf_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
            
            # 只提取成功的记录 (过滤掉 [FAIL])
            useful_lines = []
            skip = False
            for line in lines:
                if line.startswith("[FAIL]"):
                    skip = True
                    continue
                elif line.startswith("["):
                    skip = False
                
                if not skip:
                    useful_lines.append(line)
            
            content = "".join(useful_lines).strip()
            if content:
                # 依然防超载，但现在提纯后的内容很短
                return content[:3000]
        except Exception:
            pass
    return None


def extract_diff_summary(conn):
    """提取最近一次 diff 摘要"""
    new_scan, old_scan = db_engine.get_last_two_scans(conn)
    if not new_scan or not old_scan:
        return None

    new_hosts, gone_hosts = db_engine.diff_hosts(conn, new_scan, old_scan)
    port_changes = db_engine.diff_ports(conn, new_scan, old_scan)

    if not new_hosts and not gone_hosts and not port_changes:
        return f"对比 {new_scan} vs {old_scan}: 无变化"

    lines = [f"资产变化 ({new_scan} vs {old_scan}):"]
    if new_hosts:
        lines.append(f"  新增主机: {', '.join(new_hosts)}")
    if gone_hosts:
        lines.append(f"  消失主机: {', '.join(gone_hosts)}")
    for c in port_changes:
        if c["added"]:
            lines.append(f"  {c['ip']} 新开端口: {c['added']}")
        if c["removed"]:
            lines.append(f"  {c['ip']} 关闭端口: {c['removed']}")
    return "\n".join(lines)


# ========== Gemini API 调用 ==========
def call_gemini(api_key, model, prompt):
    """调用 Gemini generateContent API"""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    payload = {
        "contents": [{
            "parts": [{"text": prompt}]
        }],
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

    # 用 Python json.dumps 安全构建 JSON（导师要求，避免 Bash 转义灾难）
    payload_json = json.dumps(payload, ensure_ascii=False)

    result = subprocess.run(
        ["curl", "-s", "-X", "POST", url,
         "-H", "Content-Type: application/json",
         "-d", payload_json],
        capture_output=True, text=True, timeout=60
    )

    if result.returncode != 0:
        return None, f"curl 失败: {result.stderr}"

    try:
        resp = json.loads(result.stdout)
    except json.JSONDecodeError:
        return None, f"JSON 解析失败: {result.stdout[:200]}"

    # 提取回复文本
    if "candidates" in resp:
        parts = resp["candidates"][0].get("content", {}).get("parts", [])
        text = "\n".join(p.get("text", "") for p in parts)
        return text, None

    if "error" in resp:
        return None, f"API 错误: {resp['error'].get('message', str(resp['error']))}"

    return None, f"未知响应: {json.dumps(resp, ensure_ascii=False)[:200]}"


# ========== 主逻辑 ==========
SYSTEM_PROMPT = """你是 Lynx，Project CLAW 红队系统的 AI 战术副官。你的任务：

1. 分析扫描数据，识别高价值目标和潜在攻击路径
2. 根据开放端口和服务版本，判断可能存在的漏洞
3. 推荐具体的下一步行动（使用 CLAW 菜单编号），优先级排序
4. 给出 OPSEC 提醒（哪些操作会产生大量流量/日志）

输出格式：
- 用中文回复
- 先给出 1-2 句总体态势判断
- 然后列出具体发现和建议
- 每条建议标注 [高/中/低] 优先级
"""


def main():
    print(f"{Y}>>> [Project CLAW 模块 16] AI 战术分析 <<<{NC}")
    print()

    config = load_config()
    api_key = get_api_key(config)
    model = config.get("CLAW_AI_MODEL", "gemini-3-flash-preview")

    # 检查 OPSEC 模式
    opsec_mode = os.environ.get("CLAW_OPSEC", "lab") == "live"

    # 连接数据库
    db_path = os.path.join(SCRIPT_DIR, "CatTeam_Loot", "claw.db")
    if not os.path.isfile(db_path):
        print(f"{R}[!] 未找到 claw.db。请先执行 make parse 生成数据。{NC}")
        sys.exit(1)

    conn = db_engine.get_db(db_path)

    # 获取最新 scan_id
    latest_scan, prev_scan = db_engine.get_last_two_scans(conn)
    if not latest_scan:
        print(f"{R}[!] 数据库中没有扫描记录。{NC}")
        conn.close()
        sys.exit(1)

    print(f"  {C}[~]{NC} 分析扫描: {G}{latest_scan}{NC}")
    print(f"  {C}[~]{NC} 模型: {G}{model}{NC}")
    print(f"  {C}[~]{NC} OPSEC: {Y}{'实战脱敏' if opsec_mode else '靶场模式'}{NC}")
    print()

    # 构建数据上下文
    scan_data = extract_scan_summary(conn, latest_scan)
    diff_data = extract_diff_summary(conn) if prev_scan else None
    conn.close()

    if not scan_data:
        print(f"{R}[!] 无法提取扫描数据。{NC}")
        sys.exit(1)

    # 构建 Prompt
    user_prompt = f"以下是最新的内网扫描结果，请分析并给出战术建议：\n\n{scan_data}"
    
    web_data = extract_web_fingerprints()
    if web_data:
        user_prompt += f"\n\n--- 补充情报: Web 指纹探测结果 ---\n{web_data}"

    if diff_data:
        user_prompt += f"\n\n--- 资产变化 ---\n{diff_data}"

    # OPSEC 脱敏
    user_prompt = mask_data(user_prompt, enable_mask=opsec_mode)
    full_prompt = SYSTEM_PROMPT + "\n\n" + user_prompt

    # 调用 API
    print(f"  {DIM}[-] 正在请求 Lynx 分析...{NC}")
    print()

    text, err = call_gemini(api_key, model, full_prompt)

    if err:
        print(f"{R}[!] AI 调用失败: {err}{NC}")
        sys.exit(1)

    # 输出
    print(f"  {P}{'='*50}")
    print(f"  🐱 Lynx 战术分析         ")
    print(f"  {'='*50}{NC}")
    print()
    print(text)
    print()
    print(f"  {P}{'='*50}{NC}")
    print(f"  {DIM}模型: {model} | 扫描: {latest_scan}{NC}")
    print()


if __name__ == "__main__":
    main()
