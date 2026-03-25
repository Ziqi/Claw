#!/usr/bin/env python3
"""
CatTeam 模块 02.5 — 数据清洗层 (Data Ingestion)
将 Nmap XML 输出降维转化为结构化数据。
双写模式: SQLite (claw.db) + JSON (live_assets.json)
"""

import xml.etree.ElementTree as ET
import json
import os
import sys
from datetime import datetime

# 导入 CLAW 数据库引擎
import db_engine

# ========== 色彩方案 ==========
YELLOW = "\033[1;33m"
GREEN = "\033[1;32m"
RED = "\033[0;31m"
CYAN = "\033[0;36m"
NC = "\033[0m"

BASE_LOOT_DIR = "./CatTeam_Loot"

# 兼容 v2.0 时间戳目录：优先用 RUN_ID，其次找 latest，最后用 base
RUN_ID = os.environ.get("RUN_ID", "")
if os.environ.get("USE_LATEST") == "true" or not RUN_ID:
    # 找最新的任务目录
    latest_link = os.path.join(BASE_LOOT_DIR, "latest")
    if os.path.islink(latest_link) or os.path.isdir(latest_link):
        LOOT_DIR = os.path.realpath(latest_link)
    else:
        # fallback: 找最新的时间戳目录
        subdirs = sorted(
            [d for d in os.listdir(BASE_LOOT_DIR)
             if os.path.isdir(os.path.join(BASE_LOOT_DIR, d)) and d[0].isdigit()],
            reverse=True
        ) if os.path.isdir(BASE_LOOT_DIR) else []
        LOOT_DIR = os.path.join(BASE_LOOT_DIR, subdirs[0]) if subdirs else BASE_LOOT_DIR
else:
    LOOT_DIR = os.path.join(BASE_LOOT_DIR, RUN_ID)

XML_FILE = os.path.join(LOOT_DIR, "nmap_results.xml")
JSON_FILE = os.path.join(LOOT_DIR, "live_assets.json")

# scan_id = 目录名 (时间戳)
SCAN_ID = os.path.basename(LOOT_DIR)


def parse_nmap_xml(xml_path: str) -> dict:
    """解析 Nmap XML，提取活跃资产清单。"""
    tree = ET.parse(xml_path)
    root = tree.getroot()

    assets = {}

    for host in root.findall("host"):
        # 提取 IP
        addr_elem = host.find("address[@addrtype='ipv4']")
        if addr_elem is None:
            continue
        ip = addr_elem.get("addr")

        # 提取 OS 指纹（如果有）
        os_name = "Unknown"
        os_match = host.find(".//osmatch")
        if os_match is not None:
            os_name = os_match.get("name", "Unknown")

        # 提取开放端口
        ports = []
        services = []
        for port in host.findall(".//port"):
            state = port.find("state")
            if state is not None and state.get("state") == "open":
                port_id = int(port.get("portid"))
                protocol = port.get("protocol", "tcp")
                ports.append(port_id)

                # 提取服务信息
                svc = port.find("service")
                service_info = {
                    "port": port_id,
                    "protocol": protocol,
                    "service": svc.get("name", "unknown") if svc is not None else "unknown",
                    "product": svc.get("product", "") if svc is not None else "",
                    "version": svc.get("version", "") if svc is not None else "",
                }
                # 清理空值
                service_info = {k: v for k, v in service_info.items() if v}
                services.append(service_info)

        if ports:  # 只记录有开放端口的主机
            assets[ip] = {
                "ports": sorted(ports),
                "os": os_name,
                "services": services,
            }

    return assets


def main():
    print(f"{YELLOW}>>> [CatTeam 模块: 数据入库] 数据清洗引擎启动 (双写模式) <<<{NC}")

    # 检查 XML 输入文件
    if not os.path.isfile(XML_FILE):
        print(f"{RED}[!] 找不到 Nmap XML 输出文件: {XML_FILE}{NC}")
        print(f"{RED}    请先执行 02-probe.sh 生成扫描数据。{NC}")
        sys.exit(1)

    if os.path.getsize(XML_FILE) == 0:
        print(f"{RED}[!] XML 文件为空，无数据可解析。{NC}")
        sys.exit(1)

    print(f"[-] 正在解析 Nmap XML 并降维转化...")

    try:
        assets = parse_nmap_xml(XML_FILE)
    except ET.ParseError as e:
        print(f"{RED}[!] XML 解析失败: {e}{NC}")
        sys.exit(1)

    if not assets:
        print(f"{RED}[!] 未发现任何活跃资产（开放端口的主机），请检查扫描结果。{NC}")
        sys.exit(1)

    # ===== 写入 1: SQLite =====
    print(f"[-] 写入 SQLite 数据库...")
    try:
        conn = db_engine.get_db()
        db_engine.write_scan_data(conn, SCAN_ID, assets, mode="probe")
        db_count = conn.execute("SELECT count(*) as c FROM assets WHERE scan_id=?", (SCAN_ID,)).fetchone()["c"]
        conn.close()
        print(f"{GREEN}[+] SQLite 写入完毕: {db_count} 台主机 → claw.db{NC}")
    except Exception as e:
        print(f"{RED}[!] SQLite 写入失败: {e} (JSON 仍会正常生成){NC}")

    # ===== 写入 2: JSON (兼容旧模块) =====
    output = {
        "_meta": {
            "generated_by": "CatTeam 02.5-parse",
            "generated_at": datetime.now().isoformat(),
            "source_file": XML_FILE,
            "scan_id": SCAN_ID,
            "total_hosts": len(assets),
            "total_open_ports": sum(len(v["ports"]) for v in assets.values()),
        },
        "assets": assets,
    }

    with open(JSON_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"{GREEN}[+] JSON 导出完毕: {JSON_FILE}{NC}")
    print(f"    活跃主机: {len(assets)} 台")
    print(f"    开放端口: {sum(len(v['ports']) for v in assets.values())} 个")

    # 打印快速摘要
    print(f"\n{CYAN}[~] 资产快速摘要：{NC}")
    for ip, info in sorted(assets.items()):
        port_str = ", ".join(str(p) for p in info["ports"])
        svc_str = " | ".join(
            f"{s['service']}" + (f"({s.get('product', '')})" if s.get("product") else "")
            for s in info["services"]
        )
        print(f"    {ip}  →  [{port_str}]  {svc_str}")

    print(f"\n{GREEN}[+] 双写完毕 (SQLite + JSON)。数据已就绪。{NC}")


if __name__ == "__main__":
    main()

