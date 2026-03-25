#!/usr/bin/env python3
"""
CatTeam 模块: HP 打印机多协议漏洞探测
======================================
目标: HP DeskJet 4900 系列
攻击面: SNMP / PJL (9100) / IPP (631) / HTTP 旁路

用法: python3 22-printer-probe.py <target_ip>
"""

import sys
import os
import socket
import struct
import urllib.request
import urllib.error
import ssl
import re
import json

G = "\033[1;32m"
R = "\033[0;31m"
Y = "\033[1;33m"
C = "\033[0;36m"
P = "\033[1;35m"
W = "\033[1;37m"
DIM = "\033[2m"
NC = "\033[0m"

TIMEOUT = 5
SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE


def banner():
    print(f"""
{P}╔══════════════════════════════════════════════════════════╗
║  {W}🖨️ CatTeam HP 打印机多协议漏洞探测{P}                   ║
║  {C}攻击面: SNMP / PJL / IPP / HTTP{P}                       ║
║  {Y}⚠️  仅供授权安全测试{P}                                   ║
╚══════════════════════════════════════════════════════════╝{NC}
""")


def check_port(ip, port):
    try:
        with socket.create_connection((ip, port), timeout=3):
            return True
    except:
        return False


def http_get(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "CatTeam/5.0"})
        ctx = SSL_CTX if url.startswith("https") else None
        with urllib.request.urlopen(req, timeout=TIMEOUT, context=ctx) as resp:
            return resp.status, resp.read().decode("utf-8", errors="replace"), dict(resp.headers)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace") if e.fp else ""
        return e.code, body, dict(e.headers)
    except Exception as e:
        return None, str(e), {}


# ========== Phase 1: 端口侦察 ==========
def phase1_ports(ip):
    print(f"\n  {Y}{'='*55}")
    print(f"  Phase 1: 多协议端口侦察")
    print(f"  {'='*55}{NC}\n")

    ports = {
        80: "HTTP Web 管理",
        443: "HTTPS Web 管理",
        515: "LPD 打印协议",
        631: "IPP 打印协议",
        9100: "JetDirect (PJL 命令通道)",
        161: "SNMP (UDP)",
        8080: "HTTP 备用端口",
        5000: "mDNS/AirPrint",
    }

    open_ports = []
    for port, desc in ports.items():
        if port == 161:
            # UDP SNMP 需要特殊检测
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                sock.settimeout(2)
                # SNMP v1 GET community=public, OID=1.3.6.1.2.1.1.1.0 (sysDescr)
                snmp_get = bytes.fromhex(
                    "302902010004067075626c6963a01c0204000000010201000201003012301006082b060102010101000500"
                )
                sock.sendto(snmp_get, (ip, 161))
                try:
                    data, _ = sock.recvfrom(4096)
                    print(f"  {G}[OPEN] {ip}:{port:<6} {desc}  ← SNMP 响应 ({len(data)} 字节){NC}")
                    open_ports.append((port, data))
                except socket.timeout:
                    print(f"  {DIM}[----] {ip}:{port:<6} {desc}{NC}")
                sock.close()
            except Exception as e:
                print(f"  {DIM}[----] {ip}:{port:<6} {desc} ({e}){NC}")
        else:
            if check_port(ip, port):
                print(f"  {G}[OPEN] {ip}:{port:<6} {desc}{NC}")
                open_ports.append((port, None))
            else:
                print(f"  {DIM}[----] {ip}:{port:<6} {desc}{NC}")

    return open_ports


# ========== Phase 2: SNMP 信息提取 ==========
def phase2_snmp(ip, snmp_data=None):
    print(f"\n  {Y}{'='*55}")
    print(f"  Phase 2: SNMP 信息提取 (community: public)")
    print(f"  {'='*55}{NC}\n")

    if snmp_data:
        # 解析已有的响应
        try:
            # 简单提取 ASCII 可打印字符作为 sysDescr
            printable = "".join(chr(b) if 32 <= b < 127 else "" for b in snmp_data)
            if printable:
                print(f"  {G}[+] SNMP sysDescr: {printable[:200]}{NC}")
        except:
            pass

    # 尝试更多 SNMP OID
    oids = {
        "1.3.6.1.2.1.1.1.0": "系统描述 (sysDescr)",
        "1.3.6.1.2.1.1.3.0": "运行时间 (sysUpTime)",
        "1.3.6.1.2.1.1.4.0": "联系人 (sysContact)",
        "1.3.6.1.2.1.1.5.0": "主机名 (sysName)",
        "1.3.6.1.2.1.1.6.0": "位置 (sysLocation)",
    }

    for oid, desc in oids.items():
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.settimeout(2)
            # 构建简单 SNMP GET 请求
            oid_parts = [int(x) for x in oid.split(".")]
            # 编码 OID
            oid_bytes = b""
            for i, part in enumerate(oid_parts):
                if i == 0:
                    continue
                elif i == 1:
                    oid_bytes += bytes([oid_parts[0] * 40 + part])
                else:
                    if part < 128:
                        oid_bytes += bytes([part])
                    else:
                        # 多字节编码
                        pieces = []
                        val = part
                        pieces.append(val & 0x7F)
                        val >>= 7
                        while val:
                            pieces.append(0x80 | (val & 0x7F))
                            val >>= 7
                        oid_bytes += bytes(reversed(pieces))

            oid_tlv = bytes([0x06, len(oid_bytes)]) + oid_bytes
            varbind = oid_tlv + bytes([0x05, 0x00])  # NULL value
            varbind_seq = bytes([0x30, len(varbind)]) + varbind
            varbind_list = bytes([0x30, len(varbind_seq)]) + varbind_seq

            req_id = b"\x02\x04\x00\x00\x00\x01"
            error = b"\x02\x01\x00"
            error_idx = b"\x02\x01\x00"
            pdu_content = req_id + error + error_idx + varbind_list
            pdu = bytes([0xa0, len(pdu_content)]) + pdu_content

            version = b"\x02\x01\x00"  # v1
            community = b"\x04\x06public"
            msg_content = version + community + pdu
            packet = bytes([0x30, len(msg_content)]) + msg_content

            sock.sendto(packet, (ip, 161))
            data, _ = sock.recvfrom(4096)
            # 提取字符串值
            printable = ""
            # 找最后一个 0x04 (OCTET STRING) 标签
            for i in range(len(data) - 2, 0, -1):
                if data[i] == 0x04 and data[i+1] < 128:
                    strlen = data[i+1]
                    val = data[i+2:i+2+strlen]
                    printable = val.decode("utf-8", errors="replace")
                    break
            if printable:
                print(f"  {G}[+] {desc}: {printable}{NC}")
            else:
                print(f"  {C}[+] {desc}: (收到响应, {len(data)} 字节){NC}")
            sock.close()
        except socket.timeout:
            print(f"  {DIM}[·] {desc}: 无响应{NC}")
        except Exception as e:
            print(f"  {DIM}[·] {desc}: {e}{NC}")


# ========== Phase 3: PJL 命令探测 ==========
def phase3_pjl(ip):
    print(f"\n  {Y}{'='*55}")
    print(f"  Phase 3: PJL 命令通道 (端口 9100)")
    print(f"  {'='*55}{NC}\n")

    if not check_port(ip, 9100):
        print(f"  {DIM}[·] 端口 9100 未开放，跳过 PJL 探测{NC}")
        return

    pjl_commands = [
        ("设备信息", b"\x1b%-12345X@PJL INFO ID\r\n\x1b%-12345X"),
        ("设备状态", b"\x1b%-12345X@PJL INFO STATUS\r\n\x1b%-12345X"),
        ("文件系统枚举", b"\x1b%-12345X@PJL FSDIRLIST NAME=\"0:\\\" ENTRY=1 COUNT=99\r\n\x1b%-12345X"),
        ("环境变量", b"\x1b%-12345X@PJL INFO VARIABLES\r\n\x1b%-12345X"),
    ]

    for desc, cmd in pjl_commands:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(3)
            sock.connect((ip, 9100))
            sock.sendall(cmd)
            response = b""
            try:
                while True:
                    chunk = sock.recv(4096)
                    if not chunk:
                        break
                    response += chunk
                    if len(response) > 8192:
                        break
            except socket.timeout:
                pass
            sock.close()

            if response:
                text = response.decode("utf-8", errors="replace").strip()
                # 清理 PJL 前缀
                text = text.replace("\x1b%-12345X", "").replace("@PJL ", "").strip()
                if text:
                    print(f"  {G}[+] {desc}:{NC}")
                    for line in text.split("\n")[:10]:
                        print(f"  {DIM}      {line.strip()}{NC}")
                    if len(text.split("\n")) > 10:
                        print(f"  {DIM}      ... (共 {len(text)} 字符){NC}")
                else:
                    print(f"  {C}[+] {desc}: (空响应){NC}")
            else:
                print(f"  {DIM}[·] {desc}: 无响应{NC}")

        except Exception as e:
            print(f"  {R}[!] {desc}: {e}{NC}")
        print()


# ========== Phase 4: HTTP 信息收集 ==========
def phase4_http(ip):
    print(f"\n  {Y}{'='*55}")
    print(f"  Phase 4: HTTP 管理页面信息收集")
    print(f"  {'='*55}{NC}\n")

    # 常见 HP 打印机路径 (不需要 PIN 的信息页面)
    paths = [
        ("/", "首页"),
        ("/hp/device/info_config_AirPrint.html", "AirPrint 配置"),
        ("/DevMgmt/ProductConfigDyn.xml", "产品配置 XML"),
        ("/DevMgmt/DiscoveryTree.xml", "服务发现树"),
        ("/DevMgmt/NetAppsSecureDyn.xml", "网络安全配置"),
        ("/Networking/wireless", "WiFi 配置"),
        ("/hp/device/this.LCDisp498", "LCD 显示内容"),
        ("/IoMgmt/Adapters", "网络适配器信息"),
        ("/hp/device/info_deviceStatus.html", "设备状态"),
        ("/hp/device/info_supplies.html", "耗材信息"),
        ("/DevMgmt/ProductStatusDyn.xml", "产品状态 XML"),
        ("/DevMgmt/ProductUsageDyn.xml", "使用统计 XML"),
    ]

    for path, desc in paths:
        status, body, headers = http_get(f"http://{ip}{path}")
        if status and status < 400:
            # 提取有价值的信息
            info = ""
            if ".xml" in path and body:
                # 从 XML 中提取关键信息
                model = re.search(r"<dd:ProductModel>(.*?)</dd:ProductModel>", body)
                serial = re.search(r"<dd:SerialNumber>(.*?)</dd:SerialNumber>", body)
                fw = re.search(r"<dd:FirmwareDateCode>(.*?)</dd:FirmwareDateCode>", body)
                mac = re.search(r"<dd:MACAddress>(.*?)</dd:MACAddress>", body)
                ssid = re.search(r"<wifi:SSID>(.*?)</wifi:SSID>", body)
                ip_found = re.search(r"<dd:IPv4Address>(.*?)</dd:IPv4Address>", body)

                parts = []
                if model: parts.append(f"型号:{model.group(1)}")
                if serial: parts.append(f"序列号:{serial.group(1)}")
                if fw: parts.append(f"固件:{fw.group(1)}")
                if mac: parts.append(f"MAC:{mac.group(1)}")
                if ssid: parts.append(f"WiFi:{ssid.group(1)}")
                if ip_found: parts.append(f"IP:{ip_found.group(1)}")
                info = " | ".join(parts)

            if info:
                print(f"  {G}[+] {path:<45} HTTP {status}  {R}{info}{NC}")
            else:
                print(f"  {G}[+] {path:<45} HTTP {status}  ({len(body)} 字节){NC}")
        elif status and status in [401, 403]:
            print(f"  {Y}[🔒] {path:<45} HTTP {status}  (需要认证){NC}")
        else:
            print(f"  {DIM}[·]  {path:<45} {'HTTP '+str(status) if status else 'N/A'}{NC}")


def main():
    banner()

    if len(sys.argv) < 2:
        print(f"  {Y}用法: python3 {sys.argv[0]} <target_ip>{NC}")
        print(f"  {DIM}  例: python3 {sys.argv[0]} 10.130.0.96{NC}\n")
        sys.exit(1)

    ip = sys.argv[1]
    print(f"  {W}[*] 目标: {G}{ip}{NC}\n")

    # Phase 1
    open_ports = phase1_ports(ip)

    # Phase 2: SNMP
    snmp_data = None
    for port, data in open_ports:
        if port == 161:
            snmp_data = data
    phase2_snmp(ip, snmp_data)

    # Phase 3: PJL
    phase3_pjl(ip)

    # Phase 4: HTTP
    phase4_http(ip)

    # 总结
    print(f"\n  {Y}{'='*55}")
    print(f"  探测总结")
    print(f"  {'='*55}{NC}\n")

    open_list = [p for p, _ in open_ports]
    print(f"  {W}开放端口: {G}{', '.join(str(p) for p in open_list)}{NC}")
    print(f"  {W}攻击面: {NC}")
    if 9100 in open_list:
        print(f"  {R}  🔥 PJL (9100): 可能允许未授权文件系统访问/命令执行{NC}")
    if 161 in open_list or snmp_data:
        print(f"  {Y}  📡 SNMP: 可能泄露设备配置和网络信息{NC}")
    if 80 in open_list:
        print(f"  {C}  🌐 HTTP: 部分管理页面可能无需认证即可访问{NC}")

    print(f"\n  {DIM}CatTeam HP 打印机探测完毕 🐱{NC}\n")


if __name__ == "__main__":
    main()
