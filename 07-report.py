#!/usr/bin/env python3
"""
CatTeam 模块 07 — 渗透测试战报自动化生成器
读取所有 Loot 数据，输出标准化 Markdown 报告。
输出: CatTeam_Loot/{RUN_ID}/CatTeam_Report.md
"""

import json
import os
import sys
from datetime import datetime

# ========== 色彩 ==========
G = "\033[1;32m"
Y = "\033[1;33m"
C = "\033[0;36m"
R = "\033[0;31m"
NC = "\033[0m"

# ========== 目录定位 ==========
BASE_LOOT_DIR = "./CatTeam_Loot"
RUN_ID = os.environ.get("RUN_ID", "")
if os.environ.get("USE_LATEST") == "true" or not RUN_ID:
    latest = os.path.join(BASE_LOOT_DIR, "latest")
    if os.path.islink(latest) or os.path.isdir(latest):
        LOOT_DIR = os.path.realpath(latest)
    else:
        subdirs = sorted(
            [d for d in os.listdir(BASE_LOOT_DIR)
             if os.path.isdir(os.path.join(BASE_LOOT_DIR, d)) and d[0].isdigit()],
            reverse=True
        ) if os.path.isdir(BASE_LOOT_DIR) else []
        LOOT_DIR = os.path.join(BASE_LOOT_DIR, subdirs[0]) if subdirs else BASE_LOOT_DIR
else:
    LOOT_DIR = os.path.join(BASE_LOOT_DIR, RUN_ID)


def read_json(path):
    if os.path.isfile(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return None


def read_lines(path):
    if os.path.isfile(path):
        with open(path, "r", encoding="utf-8") as f:
            return [l.rstrip() for l in f if l.strip() and not l.startswith("#")]
    return []


def generate_report():
    print(f"{Y}>>> [CatTeam 模块: 生成战报] 引擎启动 <<<{NC}")

    run_id = os.path.basename(LOOT_DIR)
    report_path = os.path.join(LOOT_DIR, "CatTeam_Report.md")
    lines = []

    def w(s=""):
        lines.append(s)

    # ---- 封面 ----
    w("# 🐱 CatTeam 渗透测试报告")
    w()
    w(f"| 项目 | 信息 |")
    w(f"|---|---|")
    w(f"| 任务 ID | `{run_id}` |")
    w(f"| 生成时间 | {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} |")
    w(f"| 数据目录 | `{LOOT_DIR}` |")
    w()
    w("---")
    w()

    # ---- 资产总览 ----
    assets_data = read_json(os.path.join(LOOT_DIR, "live_assets.json"))
    if assets_data:
        assets = assets_data.get("assets", {})
        meta = assets_data.get("_meta", {})
        w("## 一、资产侦察总览")
        w()
        w(f"- 活跃主机数: **{len(assets)}**")
        w(f"- 开放端口总数: **{meta.get('total_open_ports', sum(len(v.get('ports',[])) for v in assets.values()))}**")
        w()
        w("| IP | 开放端口 | OS | 服务 |")
        w("|---|---|---|---|")
        for ip in sorted(assets.keys()):
            info = assets[ip]
            ports = ", ".join(str(p) for p in info.get("ports", []))
            os_name = info.get("os", "N/A")
            svcs = ", ".join(
                s.get("service", "?") + (f"({s.get('product','')})" if s.get('product') else "")
                for s in info.get("services", [])
            )
            w(f"| {ip} | {ports} | {os_name} | {svcs} |")
        w()

        # 端口统计
        port_count = {}
        for info in assets.values():
            for p in info.get("ports", []):
                port_count[p] = port_count.get(p, 0) + 1
        if port_count:
            w("### 端口暴露热力榜")
            w()
            w("| 端口 | 暴露主机数 | 风险等级 |")
            w("|---|---|---|")
            high_risk = {445: "SMB", 3389: "RDP", 21: "FTP", 23: "Telnet", 1723: "VPN"}
            for port, count in sorted(port_count.items(), key=lambda x: -x[1]):
                risk = "🔴 高危" if port in high_risk else "🟡 关注" if port in (80, 8080, 8443) else "🟢 常规"
                w(f"| {port} | {count} | {risk} |")
            w()

        print(f"  {G}[+]{NC} 资产数据: {len(assets)} 台主机")
    else:
        w("## 一、资产侦察总览")
        w()
        w("> ⚠️ 未发现 live_assets.json，侦察链未执行。")
        w()

    w("---")
    w()

    # ---- Web 指纹 ----
    web_lines = read_lines(os.path.join(LOOT_DIR, "web_fingerprints.txt"))
    w("## 二、Web 资产指纹")
    w()
    if web_lines:
        w("```")
        for line in web_lines[:30]:
            w(line)
        if len(web_lines) > 30:
            w(f"... (共 {len(web_lines)} 行，已截断)")
        w("```")
        print(f"  {G}[+]{NC} Web 指纹: {len(web_lines)} 行")
    else:
        w("> ⚠️ 未发现 web_fingerprints.txt")
    w()
    w("---")
    w()

    # ---- 凭据捕获 ----
    hashes = read_lines(os.path.join(LOOT_DIR, "captured_hash.txt"))
    cracked = read_lines(os.path.join(LOOT_DIR, "cracked_passwords.txt"))
    w("## 三、凭据安全评估")
    w()
    w(f"| 指标 | 数量 |")
    w(f"|---|---|")
    w(f"| 捕获 NTLMv2 哈希 | **{len(hashes)}** |")
    w(f"| 成功破解明文 | **{len(cracked)}** |")
    w(f"| 破解率 | **{(len(cracked)/len(hashes)*100):.0f}%** |" if hashes else "| 破解率 | N/A |")
    w()
    if cracked:
        w("### ⚠️ 已泄露凭据")
        w()
        w("| 凭据 |")
        w("|---|")
        for c in cracked:
            # 脱敏: 只显示用户名部分
            user = c.split(":")[0] if ":" in c else c
            w(f"| `{user}:***` |")
        w()
        print(f"  {R}[!]{NC} 已泄露凭据: {len(cracked)} 条")
    w("---")
    w()

    # ---- 横向移动 ----
    lateral = read_lines(os.path.join(LOOT_DIR, "lateral_results.txt"))
    w("## 四、横向移动评估")
    w()
    if lateral:
        success = [l for l in lateral if l.startswith("[SUCCESS]")]
        failed = [l for l in lateral if l.startswith("[FAILED]")]
        partial = [l for l in lateral if l.startswith("[PARTIAL]")]
        w(f"| 状态 | 数量 |")
        w(f"|---|---|")
        w(f"| ✅ 沦陷 (完全控制) | **{len(success)}** |")
        w(f"| 🟡 部分 (认证有效但权限不足) | **{len(partial)}** |")
        w(f"| ❌ 失败 | **{len(failed)}** |")
        w()
        if success:
            w("### 🎯 沦陷主机清单")
            w()
            for s in success:
                w(f"- `{s}`")
            w()
        print(f"  {G}[+]{NC} 横向移动: {len(success)} 台沦陷")
    else:
        w("> ⚠️ 未发现 lateral_results.txt，攻击链未执行。")
    w()
    w("---")
    w()

    # ---- 风险评级与建议 ----
    w("## 五、风险评级与修复建议")
    w()
    risk_items = []
    if assets_data:
        assets = assets_data.get("assets", {})
        smb_count = sum(1 for v in assets.values() if 445 in v.get("ports", []))
        if smb_count > 0:
            risk_items.append(f"🔴 **{smb_count} 台主机暴露 SMB (445)** — 建议部署 LAPS + 关闭工作站间 SMB")
        vnc_count = sum(1 for v in assets.values() if 5900 in v.get("ports", []))
        if vnc_count > 0:
            risk_items.append(f"🔴 **{vnc_count} 台主机暴露 VNC (5900)** — 建议设置强密码或 VPN 隔离")
        rdp_count = sum(1 for v in assets.values() if 3389 in v.get("ports", []))
        if rdp_count > 0:
            risk_items.append(f"🔴 **{rdp_count} 台主机暴露 RDP (3389)** — 建议启用 NLA + 网络隔离")
    if cracked:
        risk_items.append(f"🔴 **{len(cracked)} 条密码被破解** — 建议强制密码策略 (12位+复杂度)")
    if lateral:
        success = [l for l in lateral if l.startswith("[SUCCESS]")]
        if success:
            risk_items.append(f"🔴 **{len(success)} 台主机可横向移动** — 建议部署 LAPS + 强制 SMB 签名")

    if risk_items:
        for item in risk_items:
            w(f"- {item}")
    else:
        w("- 🟢 未发现高危风险项")
    w()
    w("---")
    w()
    w(f"*报告由 CatTeam 07-report.py 自动生成 | {datetime.now().strftime('%Y-%m-%d %H:%M')}*")

    # ---- 写入 ----
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"\n  {G}[+]{NC} 战报已生成: {C}{report_path}{NC}")
    print(f"  {C}[~]{NC} 导出 PDF: 用 Typora/Pandoc 打开 Markdown 即可")


if __name__ == "__main__":
    generate_report()
