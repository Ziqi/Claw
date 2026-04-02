#!/usr/bin/env python3
"""
🎯 CatTeam Nuclei 深度集成引擎

功能:
  Phase 1: 从 live_assets.json 自动生成 Nuclei 目标清单
  Phase 2: 调用 Docker 内的 Nuclei 执行漏洞扫描
  Phase 3: 解析 Nuclei JSON 输出, 写入 claw.db vulns 表
  Phase 4: 生成漏洞摘要

用法:
  python3 12-nuclei-integration.py           # 全自动模式
  python3 12-nuclei-integration.py --parse-only nuclei_results.json  # 仅解析已有结果
"""

import sys, os, json, subprocess, time

# === 路径 ===
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)
import db_engine

# === 色彩 ===
G="\033[1;32m"; R="\033[0;31m"; Y="\033[1;33m"; C="\033[0;36m"
P="\033[1;35m"; W="\033[1;37m"; DIM="\033[2m"; NC="\033[0m"

# === 配置 ===
CONTAINER = os.environ.get("CONTAINER", "kali_arsenal")
LOOT_DIR = os.path.join(SCRIPT_DIR, "CatTeam_Loot")
WEB_PORTS = {80, 443, 8080, 8443, 8000, 8888, 5000, 3000, 9090}


def generate_targets():
    """Phase 1: 从 live_assets.json 生成 Nuclei 目标清单"""
    print(f"  {W}━━━ Phase 1: 生成目标清单 ━━━{NC}")

    # 找到最新的 live_assets.json
    latest = os.path.join(LOOT_DIR, "latest")
    if os.path.islink(latest):
        latest_dir = os.path.realpath(latest)
    else:
        # 查找最新目录
        dirs = sorted([d for d in os.listdir(LOOT_DIR) if d[0].isdigit()], reverse=True)
        if not dirs:
            print(f"  {R}[!] CatTeam_Loot 中无扫描记录{NC}")
            return []
        latest_dir = os.path.join(LOOT_DIR, dirs[0])

    assets_file = os.path.join(latest_dir, "live_assets.json")
    if not os.path.exists(assets_file):
        print(f"  {R}[!] 未找到 live_assets.json{NC}")
        return []

    with open(assets_file, "r") as f:
        data = json.load(f)

    targets = []
    assets = data.get("assets", {})
    for ip, info in assets.items():
        ports = info.get("ports", [])
        for p in ports:
            if int(p) in WEB_PORTS:
                scheme = "https" if int(p) in {443, 8443} else "http"
                targets.append(f"{scheme}://{ip}:{p}")

    if not targets:
        print(f"  {Y}[!] 未发现 Web 端口目标{NC}")
        return []

    # 写入目标文件
    target_file = os.path.join(latest_dir, "nuclei_targets.txt")
    with open(target_file, "w") as f:
        f.write("\n".join(targets))

    print(f"  {G}[+] 生成 {len(targets)} 个目标{NC}")
    for t in targets[:10]:
        print(f"  {DIM}    {t}{NC}")
    if len(targets) > 10:
        print(f"  {DIM}    ... 和 {len(targets)-10} 个更多{NC}")

    return targets


def run_nuclei(targets):
    """Phase 2: 执行 Nuclei 扫描"""
    print(f"\n  {W}━━━ Phase 2: Nuclei 漏洞扫描 ━━━{NC}")

    latest_dir = os.path.realpath(os.path.join(LOOT_DIR, "latest"))
    output_file = os.path.join(latest_dir, "nuclei_results.jsonl")
    target_file = os.path.join(latest_dir, "nuclei_targets.txt")

    # 检查 Docker 容器
    try:
        result = subprocess.run(
            ["docker", "ps", "--format", "{{.Names}}"],
            capture_output=True, text=True, timeout=5
        )
        if CONTAINER not in result.stdout:
            print(f"  {Y}[!] Docker 容器 {CONTAINER} 未运行{NC}")
            print(f"  {DIM}    请先运行 make run 或 docker start {CONTAINER}{NC}")
            return None
    except Exception:
        print(f"  {R}[!] Docker 未安装或未运行{NC}")
        return None

    print(f"  {C}[~] 正在扫描 {len(targets)} 个目标...{NC}")

    # 执行 Nuclei (-jsonl 输出)
    cmd = [
        "docker", "exec", CONTAINER,
        "nuclei",
        "-l", f"/workspace/{os.path.relpath(target_file, SCRIPT_DIR)}",
        "-jsonl",
        "-o", f"/workspace/{os.path.relpath(output_file, SCRIPT_DIR)}",
        "-silent",
        "-rate-limit", "50",
        "-severity", "info,low,medium,high,critical",
    ]

    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if proc.returncode != 0 and not os.path.exists(output_file):
            print(f"  {Y}[!] Nuclei 执行异常: {proc.stderr[:200]}{NC}")
            return None
    except subprocess.TimeoutExpired:
        print(f"  {Y}[!] Nuclei 扫描超时 (5分钟上限){NC}")
    except Exception as e:
        print(f"  {R}[!] 执行失败: {e}{NC}")
        return None

    if os.path.exists(output_file):
        with open(output_file) as f:
            lines = f.readlines()
        print(f"  {G}[+] 发现 {len(lines)} 个漏洞/信息{NC}")
        return output_file
    else:
        print(f"  {DIM}[·] 未发现漏洞{NC}")
        return None


def parse_results(results_file):
    """Phase 3: 解析 Nuclei JSONL 输出, 写入 vulns 表"""
    print(f"\n  {W}━━━ Phase 3: 结果入库 ━━━{NC}")

    if not os.path.exists(results_file):
        print(f"  {R}[!] 结果文件不存在: {results_file}{NC}")
        return []

    vulns = []
    with open(results_file, "r") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                item = json.loads(line)
                vuln = {
                    "ip": item.get("host", item.get("ip", "unknown")),
                    "template_id": item.get("template-id", item.get("templateID", "")),
                    "name": item.get("info", {}).get("name", "Unknown"),
                    "severity": item.get("info", {}).get("severity", "info"),
                    "matched_at": item.get("matched-at", item.get("matched", "")),
                    "description": item.get("info", {}).get("description", ""),
                    "reference": ", ".join(item.get("info", {}).get("reference", [])[:3]),
                }
                vulns.append(vuln)
            except json.JSONDecodeError:
                continue

    if not vulns:
        print(f"  {DIM}[·] 无可解析的结果{NC}")
        return []

    # 写入 SQLite vulns 表
    conn = db_engine.get_db()
    cursor = conn.cursor()

    # 获取最新 scan_id
    env = db_engine.get_current_env()
    cursor.execute("SELECT scan_id FROM scans WHERE env=? ORDER BY timestamp DESC LIMIT 1", (env,))
    row = cursor.fetchone()
    scan_id = row[0] if row else f"nuclei_{int(time.time())}"

    inserted = 0
    for v in vulns:
        # 提取 IP (从 URL 中)
        ip = v["ip"]
        if "://" in ip:
            ip = ip.split("://")[1].split(":")[0].split("/")[0]

        severity_tag = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🔵", "info": "⚪"}.get(v["severity"], "⚪")
        details = f"[{v['severity'].upper()}] {v['name']} | {v['matched_at']}"
        if v["reference"]:
            details += f" | Ref: {v['reference']}"

        try:
            cursor.execute(
                "INSERT OR IGNORE INTO vulns (ip, type, details, scan_id) VALUES (?, ?, ?, ?)",
                (ip, f"nuclei:{v['template_id']}", details, scan_id)
            )
            inserted += 1
            print(f"  {severity_tag} {v['severity']:8s} | {ip:15s} | {v['name']}")
        except Exception:
            pass

    conn.commit()
    conn.close()

    print(f"\n  {G}[+] 已写入 {inserted} 条漏洞记录到 claw.db{NC}")
    return vulns


def print_summary(vulns):
    """Phase 4: 漏洞摘要"""
    if not vulns:
        return

    print(f"\n  {W}━━━ Phase 4: 漏洞摘要 ━━━{NC}")

    severity_counts = {}
    for v in vulns:
        s = v.get("severity", "info")
        severity_counts[s] = severity_counts.get(s, 0) + 1

    severity_order = ["critical", "high", "medium", "low", "info"]
    severity_colors = {"critical": R, "high": Y, "medium": Y, "low": C, "info": DIM}

    for s in severity_order:
        if s in severity_counts:
            color = severity_colors.get(s, NC)
            bar = "█" * severity_counts[s]
            print(f"  {color}{s:10s} {severity_counts[s]:3d} {bar}{NC}")

    print(f"\n  {W}总计: {len(vulns)} 个发现{NC}")


def main():
    print(f"""
{P}╔══════════════════════════════════════════════════════════╗
║  {W}🎯 CatTeam Nuclei 深度集成引擎{P}                        ║
║  {C}live_assets → 目标生成 → 扫描 → vulns 入库{P}             ║
╚══════════════════════════════════════════════════════════╝{NC}
""")

    # 仅解析模式
    if len(sys.argv) > 1 and sys.argv[1] == "--parse-only" and len(sys.argv) > 2:
        vulns = parse_results(sys.argv[2])
        print_summary(vulns)
        return

    # 全自动模式
    targets = generate_targets()
    if not targets:
        print(f"\n  {DIM}无目标可扫描，退出{NC}\n")
        return

    results_file = run_nuclei(targets)
    if results_file:
        vulns = parse_results(results_file)
        print_summary(vulns)
    else:
        print(f"\n  {Y}[!] Nuclei 未产出结果 (可能未安装或容器未运行){NC}")
        print(f"  {DIM}    可手动执行后用 --parse-only 模式导入:{NC}")
        print(f"  {DIM}    python3 12-nuclei-integration.py --parse-only results.jsonl{NC}")

    print(f"\n  {DIM}Nuclei 集成引擎完毕 🐱{NC}\n")


if __name__ == "__main__":
    main()
