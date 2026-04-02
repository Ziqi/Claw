#!/usr/bin/env python3
"""
CatTeam 模块 03 — Web 资产全面清扫 (httpx 手搓替代品)
纯 Python 实现，零第三方依赖。
数据源: CatTeam_Loot/live_assets.json
输出:   CatTeam_Loot/web_fingerprints.txt
"""

import json
import os
import re
import ssl
import sys
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

# ========== 极客色彩系统 ==========
class C:
    RED    = "\033[0;31m"
    GREEN  = "\033[1;32m"
    YELLOW = "\033[1;33m"
    CYAN   = "\033[0;36m"
    PURPLE = "\033[1;35m"
    WHITE  = "\033[1;37m"
    DIM    = "\033[2m"
    NC     = "\033[0m"

BASE_LOOT_DIR = "./CatTeam_Loot"

# 兼容 v2.0 时间戳目录
RUN_ID = os.environ.get("RUN_ID", "")
if os.environ.get("USE_LATEST") == "true" or not RUN_ID:
    latest_link = os.path.join(BASE_LOOT_DIR, "latest")
    if os.path.islink(latest_link) or os.path.isdir(latest_link):
        LOOT_DIR = os.path.realpath(latest_link)
    else:
        subdirs = sorted(
            [d for d in os.listdir(BASE_LOOT_DIR)
             if os.path.isdir(os.path.join(BASE_LOOT_DIR, d)) and d[0].isdigit()],
            reverse=True
        ) if os.path.isdir(BASE_LOOT_DIR) else []
        LOOT_DIR = os.path.join(BASE_LOOT_DIR, subdirs[0]) if subdirs else BASE_LOOT_DIR
else:
    LOOT_DIR = os.path.join(BASE_LOOT_DIR, RUN_ID)

ASSETS_FILE = os.path.join(LOOT_DIR, "live_assets.json")
OUTPUT_FILE = os.path.join(LOOT_DIR, "web_fingerprints.txt")

WEB_PORTS = {80, 443, 8080, 8443, 8000, 8888, 3000, 5000, 9000, 9090}
MAX_WORKERS = 10
TIMEOUT = 3

# 忽略 SSL 证书警告
SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE


def banner():
    print(f"""
{C.PURPLE}╔══════════════════════════════════════════════════════════╗
║  {C.WHITE}🐱 CatTeam 模块: Web 指纹清扫{C.PURPLE}                           ║
║  {C.CYAN}任务: 内网 Web 资产全面清扫{C.PURPLE}                              ║
║  {C.CYAN}引擎: Python urllib + ThreadPool({MAX_WORKERS}){C.PURPLE}                  ║
║  {C.DIM}时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}{C.PURPLE}                          ║
╚══════════════════════════════════════════════════════════╝{C.NC}
""")


def print_ok(msg):
    print(f"  {C.GREEN}[+]{C.NC} {msg}")

def print_warn(msg):
    print(f"  {C.YELLOW}[!]{C.NC} {msg}")

def print_fail(msg):
    print(f"  {C.RED}[✗]{C.NC} {msg}")

def print_info(msg):
    print(f"  {C.CYAN}[~]{C.NC} {msg}")


def load_targets():
    """从 live_assets.json 提取 Web 目标"""
    if not os.path.isfile(ASSETS_FILE):
        print_fail(f"找不到 {ASSETS_FILE}，请先执行 make fast 生成数据。")
        sys.exit(1)

    with open(ASSETS_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    targets = []
    assets = data.get("assets", {})

    for ip, info in assets.items():
        for port in info.get("ports", []):
            if port in WEB_PORTS:
                scheme = "https" if port in (443, 8443) else "http"
                targets.append({
                    "ip": ip,
                    "port": port,
                    "url": f"{scheme}://{ip}:{port}",
                })

    return targets


def probe_web(target: dict) -> dict:
    """探测单个 Web 目标，抓取 Title 和 Server 头"""
    url = target["url"]
    result = {
        "ip": target["ip"],
        "port": target["port"],
        "url": url,
        "status": None,
        "title": None,
        "server": None,
        "error": None,
    }

    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "CatTeam/1.0 (Web Audit)",
                "Accept": "text/html",
                "Connection": "close",
            },
        )

        handler = urllib.request.HTTPSHandler(context=SSL_CTX)
        opener = urllib.request.build_opener(handler)

        with opener.open(req, timeout=TIMEOUT) as resp:
            result["status"] = resp.status
            result["server"] = resp.headers.get("Server", "N/A")

            # 读取前 8KB 提取 <title>
            body = resp.read(8192)
            charset = resp.headers.get_content_charset() or "utf-8"
            try:
                html = body.decode(charset, errors="replace")
            except (LookupError, UnicodeDecodeError):
                html = body.decode("utf-8", errors="replace")

            # 正则提取 <title>
            match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
            if match:
                title = match.group(1).strip()
                # 清理多余空白
                title = re.sub(r"\s+", " ", title)
                result["title"] = title[:120]  # 截断过长标题
            else:
                result["title"] = "(无 Title)"

    except urllib.error.HTTPError as e:
        result["status"] = e.code
        result["server"] = e.headers.get("Server", "N/A") if e.headers else "N/A"
        result["title"] = f"(HTTP {e.code})"
    except urllib.error.URLError as e:
        result["error"] = f"连接失败: {e.reason}"
    except Exception as e:
        result["error"] = str(e)[:80]

    return result


def main():
    banner()

    # 加载目标
    print_info("正在从 live_assets.json 加载 Web 目标...")
    targets = load_targets()

    if not targets:
        print_fail("未发现任何 Web 端口目标，请检查 live_assets.json。")
        sys.exit(1)

    print_ok(f"锁定 {C.WHITE}{len(targets)}{C.NC} 个 Web 目标")
    for t in targets:
        print(f"      {C.DIM}→ {t['url']}{C.NC}")
    print()

    # 并发探测
    print_info(f"启动线程池 ({MAX_WORKERS} workers)，开始并发指纹提取...\n")
    results = []

    print(f"  {C.YELLOW}{'─'*58}{C.NC}")
    print(f"  {C.WHITE}{'IP':<18} {'端口':>5}  {'状态':>4}  {'Server':<20} Title{C.NC}")
    print(f"  {C.YELLOW}{'─'*58}{C.NC}")

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        future_map = {pool.submit(probe_web, t): t for t in targets}

        for future in as_completed(future_map):
            r = future.result()
            results.append(r)

            if r["error"]:
                print(f"  {C.RED}{r['ip']:<18} {r['port']:>5}  {'ERR':>4}  {C.DIM}{r['error'][:40]}{C.NC}")
            else:
                status_color = C.GREEN if r["status"] == 200 else C.YELLOW
                title_display = r["title"] or "(无 Title)"
                server_display = (r["server"] or "N/A")[:20]
                print(f"  {C.WHITE}{r['ip']:<18}{C.NC} {r['port']:>5}  "
                      f"{status_color}{r['status']:>4}{C.NC}  "
                      f"{C.CYAN}{server_display:<20}{C.NC} "
                      f"{title_display}")

    print(f"  {C.YELLOW}{'─'*58}{C.NC}\n")

    # 统计
    success = [r for r in results if r["status"] is not None]
    failed = [r for r in results if r["error"] is not None]

    print_ok(f"探测完毕: {C.GREEN}{len(success)}{C.NC} 成功, {C.RED}{len(failed)}{C.NC} 失败, 共 {len(results)} 目标")

    # 保存结果
    print_info(f"正在保存结果至 {OUTPUT_FILE} ...")

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(f"# CatTeam Web Fingerprint Report\n")
        f.write(f"# Generated: {datetime.now().isoformat()}\n")
        f.write(f"# Targets: {len(results)} | Success: {len(success)} | Failed: {len(failed)}\n")
        f.write(f"{'='*70}\n\n")

        for r in sorted(results, key=lambda x: (x["ip"], x["port"])):
            if r["error"]:
                f.write(f"[FAIL] {r['url']}\n")
                f.write(f"       Error: {r['error']}\n\n")
            else:
                f.write(f"[{r['status']}] {r['url']}\n")
                f.write(f"       Server: {r['server']}\n")
                f.write(f"       Title:  {r['title']}\n\n")

    print_ok(f"报告已保存: {C.WHITE}{OUTPUT_FILE}{C.NC}")

    # 高价值目标提示
    interesting = [r for r in success if r["title"] and r["title"] not in ("(无 Title)", f"(HTTP {r['status']})")]
    if interesting:
        print(f"\n  {C.PURPLE}{'='*58}")
        print(f"  🎯 高价值目标 (含有效 Title):")
        print(f"  {'='*58}{C.NC}")
        for r in sorted(interesting, key=lambda x: x["ip"]):
            print(f"  {C.WHITE}{r['url']:<30}{C.NC} → {C.GREEN}{r['title']}{C.NC}")
        print(f"\n  {C.CYAN}[~] 建议: 将上述目标交由 AI 进行 CVE 匹配和利用脚本生成。{C.NC}")

    print(f"\n  {C.DIM}CatTeam 03-audit-web 清扫完毕 🐱{C.NC}\n")


if __name__ == "__main__":
    main()
