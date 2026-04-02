#!/usr/bin/env python3
"""
🔬 CLAW V10.0 — LLMNR/NBT-NS 毒化检测探针 (Protocol Anatomy Probe)

学术定位：
  这是一个研究性协议检测原型，基于 Scapy 直接解析 L3 名称解析协议。
  核心价值不在于替代 Suricata，而在于展示"从协议本质理解漏洞"的研发能力。

漏洞本质 (Root Cause)：
  Windows 的 LLMNR (UDP 5355) 和 NBT-NS (UDP 137) 协议设计存在先天缺陷：
  当 DNS 无法解析名称时，主机会向局域网广播求助，且默认信任第一个应答者。
  攻击者 (Responder) 冒充应答 → 骗取 NTLMv2 哈希 → 离线破解密码。

检测逻辑：
  - 被动嗅探 UDP 5355 (LLMNR) 和 UDP 137 (NBT-NS) 流量
  - 统计每个 IP 的 Response 频率
  - 某 IP 在窗口时间内应答了超过阈值数的不同名称 → 触发告警
  (正常终端只发 Query，不应答；频繁应答的非域控节点 = 毒化攻击源)

运行环境：Kali VM (需要 root 权限 + Scapy)
回传目标：CLAW 后端 /api/v1/alerts/ingest

用法：
  sudo python3 claw_llmnr_probe.py --interface eth0 --claw-url http://<Mac-IP>:8000
"""

import argparse
import json
import os
import sys
import time
import signal
import urllib.request
from collections import defaultdict
from datetime import datetime

# === 配置 ===
PROBE_ID = "kali-llmnr-01"
WINDOW_SECONDS = 60       # 统计窗口
RESPONSE_THRESHOLD = 5    # 窗口内应答 >= 5 个不同名称 → 告警
REPORT_INTERVAL = 10      # 每 10 秒检查一次并上报
CLAW_TOKEN = os.environ.get("CLAW_SENSOR_TOKEN", "claw-sensor-2026")

# === 全局状态 ===
response_tracker = defaultdict(lambda: {"names": set(), "first_seen": None, "count": 0})
running = True


def signal_handler(sig, frame):
    global running
    print("\n[*] 收到中断信号，优雅退出...")
    running = False

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)


def send_alerts_to_claw(alerts, claw_url):
    """将告警推送到 CLAW 后端"""
    if not alerts:
        return
    payload = json.dumps({
        "probe_id": PROBE_ID,
        "alerts": alerts
    }).encode("utf-8")
    
    url = f"{claw_url}/api/v1/alerts/ingest"
    req = urllib.request.Request(url, data=payload, headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {CLAW_TOKEN}"
    })
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            result = json.loads(resp.read())
            print(f"  [→] 已上报 {len(alerts)} 条告警到 CLAW: {result}")
    except Exception as e:
        print(f"  [!] 上报失败: {e}")


def analyze_and_report(claw_url):
    """分析统计窗口内的 Response 数据，生成告警"""
    now = time.time()
    alerts = []
    
    expired_ips = []
    for ip, data in response_tracker.items():
        # 清理过期窗口
        if data["first_seen"] and (now - data["first_seen"]) > WINDOW_SECONDS:
            expired_ips.append(ip)
            continue
        
        # 检测：某 IP 应答了过多不同名称
        if len(data["names"]) >= RESPONSE_THRESHOLD:
            alert = {
                "alert_type": "LLMNR_POISON",
                "severity": "HIGH",
                "source_ip": ip,
                "source_mac": data.get("mac", ""),
                "target_ip": "ff02::1:3 (multicast)",
                "protocol": "LLMNR",
                "details": {
                    "queries_answered": len(data["names"]),
                    "sample_names": list(data["names"])[:10],
                    "window_seconds": WINDOW_SECONDS,
                    "total_responses": data["count"],
                },
                "raw_evidence": f"UDP 5355 Response from {ip} for {len(data['names'])} distinct names in {WINDOW_SECONDS}s",
                "mitre_ttp": "T1557.001",
                "remediation": (
                    "1. GPO 禁用 LLMNR: Computer Config → Admin Templates → DNS Client → "
                    "Turn Off Multicast Name Resolution = Enabled\n"
                    "2. 注册表禁用 NBT-NS: HKLM\\SYSTEM\\CurrentControlSet\\Services\\NetBT\\Parameters → "
                    "NodeType = 2 (P-node)\n"
                    "3. 强制开启 SMB Signing: Computer Config → Policies → Windows Settings → "
                    "Security Settings → Local Policies → Security Options"
                ),
            }
            alerts.append(alert)
            print(f"  [🔴 ALERT] LLMNR Poisoning: {ip} 应答了 {len(data['names'])} 个不同名称！")
            expired_ips.append(ip)  # 上报后重置
    
    # 清理已上报/过期的记录
    for ip in expired_ips:
        del response_tracker[ip]
    
    # 推送到 CLAW
    if claw_url:
        send_alerts_to_claw(alerts, claw_url)
    
    return alerts


def run_scapy_sniffer(interface, claw_url):
    """使用 Scapy 被动嗅探 LLMNR/NBT-NS 流量"""
    try:
        from scapy.all import sniff, UDP, IP, DNS, DNSRR, Raw
    except ImportError:
        print("[!] Scapy 未安装。请运行: pip install scapy")
        print("[*] 切换到 tcpdump 降级模式...")
        run_tcpdump_fallback(interface, claw_url)
        return
    
    print(f"[*] CLAW LLMNR/NBT-NS 毒化检测探针启动")
    print(f"    接口: {interface}")
    print(f"    检测逻辑: 某 IP 在 {WINDOW_SECONDS}s 内应答 >= {RESPONSE_THRESHOLD} 个不同名称 → ALERT")
    print(f"    回传: {claw_url or '仅本地输出'}")
    print(f"    按 Ctrl+C 退出\n")
    
    last_report = time.time()
    
    def packet_handler(pkt):
        nonlocal last_report
        
        if not pkt.haslayer(UDP):
            return
        
        src_ip = pkt[IP].src if pkt.haslayer(IP) else "unknown"
        udp_sport = pkt[UDP].sport
        udp_dport = pkt[UDP].dport
        
        # === LLMNR Response 检测 (UDP 5355) ===
        # LLMNR 应答的源端口是 5355，目标端口是随机的（回复请求者）
        if udp_sport == 5355 and pkt.haslayer(DNS):
            dns = pkt[DNS]
            # DNS Flags: QR=1 表示 Response
            if dns.qr == 1 and dns.ancount > 0:
                # 提取被应答的名称
                try:
                    qname = dns.qd.qname.decode("utf-8", errors="replace").rstrip(".")
                except Exception:
                    qname = "unknown"
                
                tracker = response_tracker[src_ip]
                if tracker["first_seen"] is None:
                    tracker["first_seen"] = time.time()
                tracker["names"].add(qname)
                tracker["count"] += 1
                
                print(f"  [LLMNR Response] {src_ip} → 应答名称: {qname} (累计 {len(tracker['names'])} 个不同名称)")
        
        # === NBT-NS Response 检测 (UDP 137) ===
        elif udp_sport == 137:
            if pkt.haslayer(Raw):
                raw = bytes(pkt[Raw])
                # NBT-NS Response: 第 3 字节的高 1 bit 为 Response 标志
                if len(raw) > 4 and (raw[2] & 0x80):
                    tracker = response_tracker[src_ip]
                    if tracker["first_seen"] is None:
                        tracker["first_seen"] = time.time()
                    tracker["names"].add(f"NBT-NS:{src_ip}")
                    tracker["count"] += 1
                    print(f"  [NBT-NS Response] {src_ip} → NetBIOS 应答")
        
        # 定期检查并上报
        now = time.time()
        if now - last_report >= REPORT_INTERVAL:
            last_report = now
            analyze_and_report(claw_url)
    
    # 启动嗅探
    while running:
        try:
            sniff(
                iface=interface,
                filter="udp port 5355 or udp port 137",
                prn=packet_handler,
                store=0,
                timeout=REPORT_INTERVAL,
            )
            # 每轮超时后也做一次分析
            analyze_and_report(claw_url)
        except PermissionError:
            print("[!] 需要 root 权限。请使用 sudo 运行。")
            sys.exit(1)
        except Exception as e:
            print(f"[!] 嗅探异常: {e}")
            time.sleep(2)


def run_tcpdump_fallback(interface, claw_url):
    """降级模式：使用 tcpdump 抓包 (不需要 Scapy)"""
    import subprocess
    
    print(f"[*] 降级模式: 使用 tcpdump 监听 {interface}")
    print(f"    仅记录 LLMNR/NBT-NS 流量，不做深度解析")
    
    cmd = ["tcpdump", "-i", interface, "-l", "-n", "udp port 5355 or udp port 137"]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    
    last_report = time.time()
    
    try:
        for line in iter(proc.stdout.readline, ""):
            if not running:
                break
            print(f"  [tcpdump] {line.strip()}")
            
            # 简单解析 tcpdump 输出
            if ".5355" in line and ">" in line:
                parts = line.split()
                for p in parts:
                    if ".5355" in p and p.endswith(".5355"):
                        src_ip = p.rsplit(".", 1)[0]
                        tracker = response_tracker[src_ip]
                        if tracker["first_seen"] is None:
                            tracker["first_seen"] = time.time()
                        tracker["names"].add(f"tcpdump-{time.time()}")
                        tracker["count"] += 1
            
            now = time.time()
            if now - last_report >= REPORT_INTERVAL:
                last_report = now
                analyze_and_report(claw_url)
    finally:
        proc.kill()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CLAW LLMNR/NBT-NS 毒化检测探针")
    parser.add_argument("-i", "--interface", default="eth0", help="监听网卡 (默认 eth0)")
    parser.add_argument("--claw-url", default=None, help="CLAW 后端地址 (如 http://192.168.64.1:8000)")
    parser.add_argument("--threshold", type=int, default=RESPONSE_THRESHOLD, help=f"告警阈值 (默认 {RESPONSE_THRESHOLD})")
    parser.add_argument("--window", type=int, default=WINDOW_SECONDS, help=f"统计窗口秒数 (默认 {WINDOW_SECONDS})")
    args = parser.parse_args()
    
    RESPONSE_THRESHOLD = args.threshold
    WINDOW_SECONDS = args.window
    
    run_scapy_sniffer(args.interface, args.claw_url)
