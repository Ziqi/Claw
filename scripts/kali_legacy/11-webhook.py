#!/usr/bin/env python3
"""
Project CLAW 模块 11 — 智能告警引擎 (Webhook)
自动执行 Diff → AI 分析 → 本地告警 / Gmail (预留)

用法:
  python3 11-webhook.py              # 手动执行一次
  crontab: */30 * * * * cd ~/CatTeam && python3 11-webhook.py --cron
"""

import json
import os
import sys
import subprocess
import re
from datetime import datetime

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)
import db_engine

# ========== 色彩 ==========
Y = "\033[1;33m"
G = "\033[1;32m"
R = "\033[0;31m"
C = "\033[0;36m"
P = "\033[1;35m"
DIM = "\033[2m"
NC = "\033[0m"

ALERT_DIR = os.path.join(SCRIPT_DIR, "CatTeam_Loot", "alerts")
DB_PATH = os.path.join(SCRIPT_DIR, "CatTeam_Loot", "claw.db")


def load_config():
    """从 config.sh 读取配置"""
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


# ========== Diff 检测 ==========
def detect_changes():
    """检测资产变化，返回 diff 结果或 None"""
    if not os.path.isfile(DB_PATH):
        return None

    conn = db_engine.get_db(DB_PATH)
    new_scan, old_scan = db_engine.get_last_two_scans(conn)

    if not new_scan or not old_scan:
        conn.close()
        return None

    new_hosts, gone_hosts = db_engine.diff_hosts(conn, new_scan, old_scan)
    port_changes = db_engine.diff_ports(conn, new_scan, old_scan)

    if not new_hosts and not gone_hosts and not port_changes:
        conn.close()
        return None

    # 获取新增主机的端口
    new_host_ports = {}
    for ip in new_hosts:
        rows = conn.execute(
            "SELECT port FROM ports WHERE ip=? AND scan_id=?", (ip, new_scan)
        ).fetchall()
        new_host_ports[ip] = [r["port"] for r in rows]

    conn.close()

    return {
        "new_scan": new_scan,
        "old_scan": old_scan,
        "new_hosts": new_hosts,
        "gone_hosts": gone_hosts,
        "port_changes": port_changes,
        "new_host_ports": new_host_ports,
    }


# ========== AI 分析 ==========
def ai_analyze_changes(config, diff_result):
    """用 Gemini Flash 分析变化，返回分析文本"""
    api_key = os.environ.get("CLAW_AI_KEY", config.get("CLAW_AI_KEY", ""))
    model = config.get("CLAW_AI_MODEL", "gemini-3-flash-preview")

    if not api_key:
        return None

    # 构建变化摘要
    lines = [f"内网资产变化 ({diff_result['new_scan']} vs {diff_result['old_scan']}):"]
    if diff_result["new_hosts"]:
        for ip in diff_result["new_hosts"]:
            ports = diff_result["new_host_ports"].get(ip, [])
            lines.append(f"  🆕 新增主机: {ip} 端口: {ports}")
    if diff_result["gone_hosts"]:
        for ip in diff_result["gone_hosts"]:
            lines.append(f"  ❌ 消失主机: {ip}")
    for c in diff_result["port_changes"]:
        if c["added"]:
            lines.append(f"  📈 {c['ip']} 新开端口: {c['added']}")
        if c["removed"]:
            lines.append(f"  📉 {c['ip']} 关闭端口: {c['removed']}")

    change_text = "\n".join(lines)

    prompt = f"""你是 Lynx，红队 AI 副官。以下是内网资产变化告警，请用3-5句话给出：
1. 风险等级判断 (🔴高/🟡中/🟢低)
2. 最可能的原因分析
3. 建议的下一步行动 (引用 CLAW 菜单编号)

{change_text}"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.5, "maxOutputTokens": 1024},
        "safetySettings": [
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
        ]
    }

    try:
        result = subprocess.run(
            ["curl", "-s", "-X", "POST", url,
             "-H", "Content-Type: application/json",
             "-d", json.dumps(payload, ensure_ascii=False)],
            capture_output=True, text=True, timeout=30
        )
        resp = json.loads(result.stdout)
        if "candidates" in resp:
            parts = resp["candidates"][0].get("content", {}).get("parts", [])
            return "\n".join(p.get("text", "") for p in parts)
    except Exception:
        pass

    return None


# ========== 告警输出 ==========
def format_alert(diff_result, ai_text=None):
    """格式化告警内容"""
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    lines = []
    lines.append(f"{'='*60}")
    lines.append(f"🐱 CLAW 资产异动告警")
    lines.append(f"时间: {ts}")
    lines.append(f"扫描: {diff_result['new_scan']} vs {diff_result['old_scan']}")
    lines.append(f"{'='*60}")
    lines.append("")

    if diff_result["new_hosts"]:
        lines.append(f"🆕 新增主机 ({len(diff_result['new_hosts'])} 台):")
        for ip in diff_result["new_hosts"]:
            ports = diff_result["new_host_ports"].get(ip, [])
            lines.append(f"   + {ip}  端口: {ports}")
        lines.append("")

    if diff_result["gone_hosts"]:
        lines.append(f"❌ 消失主机 ({len(diff_result['gone_hosts'])} 台):")
        for ip in diff_result["gone_hosts"]:
            lines.append(f"   - {ip}")
        lines.append("")

    if diff_result["port_changes"]:
        lines.append(f"🔄 端口变化 ({len(diff_result['port_changes'])} 台):")
        for c in diff_result["port_changes"]:
            if c["added"]:
                lines.append(f"   + {c['ip']} 新开: {c['added']}")
            if c["removed"]:
                lines.append(f"   - {c['ip']} 关闭: {c['removed']}")
        lines.append("")

    if ai_text:
        lines.append(f"{'─'*60}")
        lines.append("🐱 Lynx AI 分析:")
        lines.append(ai_text)
        lines.append("")

    lines.append(f"{'='*60}")
    return "\n".join(lines)


def save_local_alert(alert_text):
    """保存到本地告警文件"""
    os.makedirs(ALERT_DIR, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    filepath = os.path.join(ALERT_DIR, f"alert_{ts}.txt")

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(alert_text)

    # 同时追加到汇总日志
    log_path = os.path.join(ALERT_DIR, "alerts.log")
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(alert_text + "\n\n")

    return filepath


def send_gmail(config, alert_text):
    """Gmail 推送 (预留接口，后期实现)"""
    gmail_to = config.get("CLAW_GMAIL_TO", "")
    if not gmail_to:
        return False
    # TODO: 使用 smtplib + App Password 发送
    # import smtplib
    # from email.mime.text import MIMEText
    # smtp = smtplib.SMTP_SSL('smtp.gmail.com', 465)
    # smtp.login(config['CLAW_GMAIL_USER'], config['CLAW_GMAIL_APP_PWD'])
    # msg = MIMEText(alert_text)
    # msg['Subject'] = '🐱 CLAW 资产异动告警'
    # smtp.sendmail(config['CLAW_GMAIL_USER'], gmail_to, msg.as_string())
    return False


# ========== macOS 通知 ==========
def notify_macos(title, message):
    """macOS 原生通知 (osascript)"""
    try:
        subprocess.run([
            "osascript", "-e",
            f'display notification "{message}" with title "{title}" sound name "Submarine"'
        ], timeout=5)
    except Exception:
        pass


# ========== 主逻辑 ==========
def main():
    is_cron = "--cron" in sys.argv
    if not is_cron:
        print(f"{Y}>>> [Project CLAW 模块 11] 智能告警引擎 <<<{NC}")
        print()

    config = load_config()

    # 1. 检测变化
    diff_result = detect_changes()

    if diff_result is None:
        if not is_cron:
            print(f"  {G}[+] 无资产变化，内网环境稳定。{NC}")
        return

    total_changes = (
        len(diff_result["new_hosts"]) +
        len(diff_result["gone_hosts"]) +
        len(diff_result["port_changes"])
    )

    if not is_cron:
        print(f"  {R}[!] 检测到 {total_changes} 项资产变化{NC}")
        print()

    # 2. AI 分析
    if not is_cron:
        print(f"  {DIM}[-] 请求 Lynx AI 分析...{NC}")

    ai_text = ai_analyze_changes(config, diff_result)

    # 3. 格式化告警
    alert_text = format_alert(diff_result, ai_text)

    # 4. 输出
    if not is_cron:
        print()
        print(alert_text)
        print()

    # 5. 保存本地
    filepath = save_local_alert(alert_text)
    if not is_cron:
        print(f"  {G}[+] 告警已保存: {C}{filepath}{NC}")

    # 6. Gmail (预留)
    if send_gmail(config, alert_text):
        if not is_cron:
            print(f"  {G}[+] Gmail 推送成功{NC}")

    # 7. macOS 通知
    notify_macos(
        "🐱 CLAW 资产异动",
        f"{total_changes} 项变化: {len(diff_result['new_hosts'])}新增 {len(diff_result['gone_hosts'])}消失"
    )

    if not is_cron:
        print()
        print(f"  {DIM}提示: 设置 cron 定时执行:{NC}")
        print(f"  {C}crontab -e{NC}")
        print(f"  {C}*/30 * * * * cd ~/CatTeam && python3 11-webhook.py --cron{NC}")
        print()


if __name__ == "__main__":
    main()
