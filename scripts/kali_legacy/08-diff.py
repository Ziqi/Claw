#!/usr/bin/env python3
"""
CatTeam 模块 08 — 资产变化检测引擎 (Delta Detector)
v5.0: 优先使用 SQLite (SQL EXCEPT)，fallback JSON 比对
"""

import json
import os
import sys
from datetime import datetime

# 导入 CLAW 数据库引擎
import db_engine

# ========== 色彩 ==========
G = "\033[1;32m"
Y = "\033[1;33m"
C = "\033[0;36m"
R = "\033[0;31m"
P = "\033[1;35m"
NC = "\033[0m"

BASE_LOOT_DIR = "./CatTeam_Loot"


def diff_via_sqlite():
    """SQL EXCEPT 模式 (v5.0 主引擎)"""
    db_path = os.path.join(BASE_LOOT_DIR, "claw.db")
    if not os.path.isfile(db_path):
        return None

    conn = db_engine.get_db(db_path)
    new_scan, old_scan = db_engine.get_last_two_scans(conn)

    if not new_scan or not old_scan:
        conn.close()
        return None

    print(f"  {C}[~]{NC} 引擎: {G}SQLite (SQL EXCEPT){NC}")
    print(f"  {C}[~]{NC} 当前扫描: {G}{new_scan}{NC}")
    print(f"  {C}[~]{NC} 对比基线: {Y}{old_scan}{NC}")
    print()

    new_hosts, gone_hosts = db_engine.diff_hosts(conn, new_scan, old_scan)
    port_changes = db_engine.diff_ports(conn, new_scan, old_scan)

    # 获取新增主机的端口信息 (用于显示)
    new_host_ports = {}
    for ip in new_hosts:
        rows = conn.execute(
            "SELECT port FROM ports WHERE ip=? AND scan_id=?", (ip, new_scan)
        ).fetchall()
        new_host_ports[ip] = [r["port"] for r in rows]

    # 统计
    old_count = conn.execute("SELECT count(*) as c FROM assets WHERE scan_id=?", (old_scan,)).fetchone()["c"]
    new_count = conn.execute("SELECT count(*) as c FROM assets WHERE scan_id=?", (new_scan,)).fetchone()["c"]

    conn.close()

    return {
        "new_scan": new_scan,
        "old_scan": old_scan,
        "new_hosts": sorted(new_hosts),
        "gone_hosts": sorted(gone_hosts),
        "port_changes": port_changes,
        "new_host_ports": new_host_ports,
        "old_count": old_count,
        "new_count": new_count,
    }


def diff_via_json():
    """JSON 比对模式 (v4.0 兼容 fallback)"""
    if not os.path.isdir(BASE_LOOT_DIR):
        return None

    runs = sorted(
        [d for d in os.listdir(BASE_LOOT_DIR)
         if os.path.isdir(os.path.join(BASE_LOOT_DIR, d)) and d[0].isdigit()],
        reverse=True
    )

    if len(runs) < 2:
        return None

    new_run, old_run = runs[0], runs[1]

    def load_assets(run_id):
        path = os.path.join(BASE_LOOT_DIR, run_id, "live_assets.json")
        if not os.path.isfile(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data.get("assets", {})

    old_assets = load_assets(old_run)
    new_assets = load_assets(new_run)

    if old_assets is None or new_assets is None:
        return None

    print(f"  {C}[~]{NC} 引擎: {Y}JSON (兼容模式){NC}")
    print(f"  {C}[~]{NC} 当前扫描: {G}{new_run}{NC}")
    print(f"  {C}[~]{NC} 对比基线: {Y}{old_run}{NC}")
    print()

    old_ips = set(old_assets.keys())
    new_ips = set(new_assets.keys())

    new_hosts = sorted(new_ips - old_ips)
    gone_hosts = sorted(old_ips - new_ips)
    port_changes = []

    for ip in sorted(old_ips & new_ips):
        old_ports = set(old_assets[ip].get("ports", []))
        new_ports = set(new_assets[ip].get("ports", []))
        added = sorted(new_ports - old_ports)
        removed = sorted(old_ports - new_ports)
        if added or removed:
            port_changes.append({"ip": ip, "added": added, "removed": removed})

    new_host_ports = {}
    for ip in new_hosts:
        new_host_ports[ip] = new_assets[ip].get("ports", [])

    return {
        "new_scan": new_run,
        "old_scan": old_run,
        "new_hosts": new_hosts,
        "gone_hosts": gone_hosts,
        "port_changes": port_changes,
        "new_host_ports": new_host_ports,
        "old_count": len(old_assets),
        "new_count": len(new_assets),
    }


def display_and_save(result):
    """统一输出显示 + 保存报告"""
    has_changes = False

    if result["new_hosts"]:
        has_changes = True
        print(f"  {R}[!] 新增主机 ({len(result['new_hosts'])} 台):{NC}")
        for ip in result["new_hosts"]:
            ports = result["new_host_ports"].get(ip, [])
            print(f"     {R}+ {ip}{NC}  端口: {', '.join(str(p) for p in ports)}")
        print()

    if result["gone_hosts"]:
        has_changes = True
        print(f"  {Y}[-] 消失主机 ({len(result['gone_hosts'])} 台):{NC}")
        for ip in result["gone_hosts"]:
            print(f"     {Y}- {ip}{NC}")
        print()

    if result["port_changes"]:
        has_changes = True
        print(f"  {P}[~] 端口变化 ({len(result['port_changes'])} 台):{NC}")
        for change in result["port_changes"]:
            ip = change["ip"]
            if change["added"]:
                print(f"     {R}+  {ip}  新开: [{', '.join(str(p) for p in change['added'])}]{NC}")
            if change["removed"]:
                print(f"     {G}-  {ip}  关闭: [{', '.join(str(p) for p in change['removed'])}]{NC}")
        print()

    if not has_changes:
        print(f"  {G}[+] 资产状态无变化。内网环境稳定。{NC}")
        print()

    # 保存报告
    diff_dir = os.path.join(BASE_LOOT_DIR, result["new_scan"])
    os.makedirs(diff_dir, exist_ok=True)
    diff_report = os.path.join(diff_dir, "asset_diff.json")
    report_data = {
        "_meta": {
            "current_run": result["new_scan"],
            "baseline_run": result["old_scan"],
            "generated_at": datetime.now().isoformat(),
            "has_changes": has_changes,
        },
        "summary": {
            "new_hosts": len(result["new_hosts"]),
            "gone_hosts": len(result["gone_hosts"]),
            "port_changes": len(result["port_changes"]),
        },
        "details": {
            "new_hosts": result["new_hosts"],
            "gone_hosts": result["gone_hosts"],
            "port_changes": result["port_changes"],
        },
    }
    with open(diff_report, "w", encoding="utf-8") as f:
        json.dump(report_data, f, indent=2, ensure_ascii=False)

    print(f"  {G}[+]{NC} 差异报告: {C}{diff_report}{NC}")

    print(f"\n  {P}{'='*45}")
    print(f"  变化摘要: {result['new_scan']} vs {result['old_scan']}")
    print(f"  {'='*45}{NC}")
    print(f"  新增主机:   {R}{len(result['new_hosts'])}{NC}")
    print(f"  消失主机:   {Y}{len(result['gone_hosts'])}{NC}")
    print(f"  端口变化:   {P}{len(result['port_changes'])}{NC}")
    print(f"  旧基线主机: {result['old_count']}")
    print(f"  新扫描主机: {result['new_count']}")
    print()


def main():
    print(f"{Y}>>> [CatTeam 模块: 资产探测] 变化检测引擎 v5.0 <<<{NC}")
    print()

    # 优先 SQLite，fallback JSON
    result = diff_via_sqlite()
    if result is None:
        result = diff_via_json()

    if result is None:
        print(f"  {R}[!]{NC} 需要至少两次扫描记录才能进行差异比对。")
        print(f"  {C}[~]{NC} 请再执行一次 make fast 后重试。")
        sys.exit(1)

    display_and_save(result)


if __name__ == "__main__":
    main()
