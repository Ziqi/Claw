#!/usr/bin/env python3
"""
CatTeam 模块: 固件解剖刀 (Pure Python Firmware Analyzer)
=========================================================
零依赖的固件扫描与提取工具，替代 binwalk。
支持 TP-Link 固件头、uImage、SquashFS、LZMA 等常见嵌入式签名。

用法: python3 21-firmware-autopsy.py <firmware.bin>

⚠️ 仅供授权安全研究使用
"""

import sys
import os
import struct
import hashlib

# ========== 色彩 ==========
G = "\033[1;32m"
R = "\033[0;31m"
Y = "\033[1;33m"
C = "\033[0;36m"
P = "\033[1;35m"
W = "\033[1;37m"
DIM = "\033[2m"
NC = "\033[0m"

# ========== 固件签名库 ==========
SIGNATURES = [
    # (magic_bytes, name, parser_func_or_None)
    (b"\x27\x05\x19\x56", "uImage header"),
    (b"hsqs", "SquashFS filesystem (little-endian)"),
    (b"sqsh", "SquashFS filesystem (big-endian)"),
    (b"\x5d\x00\x00", "LZMA compressed data"),
    (b"\xfd\x37\x7a\x58\x5a\x00", "XZ compressed data"),
    (b"\x1f\x8b\x08", "gzip compressed data"),
    (b"BZ", "bzip2 compressed data"),
    (b"\x89PNG", "PNG image"),
    (b"JFIF", "JPEG image"),
    (b"ELF", "ELF executable"),
    (b"#!/bin/sh", "Shell script"),
    (b"#!/bin/ash", "Ash shell script"),
    (b"<!DOCTYPE html", "HTML document"),
    (b"<html", "HTML document"),
    (b"-----BEGIN", "PEM certificate/key"),
    (b"ssh-rsa", "SSH RSA public key"),
    (b"root:", "Unix passwd file entry"),
    (b"admin:", "Admin credentials entry"),
    (b"password", "Possible password reference"),
    (b"httpd", "HTTP daemon reference"),
    (b"httpProcDataSrv", "⚠️ CVE-2024-46486 漏洞函数!"),
    (b"system(", "system() 函数调用 (命令注入风险)"),
    (b"popen(", "popen() 函数调用 (命令注入风险)"),
    (b"execve(", "execve() 函数调用"),
    (b"/bin/sh", "/bin/sh shell 路径"),
    (b"telnetd", "telnet 守护进程"),
    (b"dropbear", "Dropbear SSH 服务"),
    (b"busybox", "BusyBox 多功能工具集"),
    (b"TP-LINK", "TP-Link 品牌标识"),
    (b"tp-link", "TP-Link 品牌标识 (小写)"),
    (b"tplogin", "TP-Link 登录页面引用"),
    (b"WDR5620", "WDR5620 型号标识"),
    (b"cfgsync", "⚠️ cfgsync 接口 (CVE 旁路关键字)"),
    (b"httpDoAuthorize", "⚠️ httpDoAuthorize 鉴权函数"),
]

# TP-Link 固件头格式 (前 512 字节)
TPLINK_HEADER_MAGIC = b"\x01\x00\x00\x00"  # 常见 TP-Link 头


def banner():
    print(f"""
{P}╔══════════════════════════════════════════════════════════╗
║  {W}🔪 CatTeam 固件解剖刀 (Firmware Autopsy){P}              ║
║  {C}零依赖 Pure Python 固件分析工具{P}                       ║
║  {Y}⚠️  仅供授权安全研究{P}                                   ║
╚══════════════════════════════════════════════════════════╝{NC}
""")


def format_size(size):
    """人类可读大小"""
    for unit in ["B", "KB", "MB", "GB"]:
        if size < 1024:
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} TB"


def scan_signatures(data: bytes, filename: str):
    """扫描固件中的已知签名"""
    print(f"\n  {Y}{'='*55}")
    print(f"  Phase 1: X 光特征扫描")
    print(f"  {'='*55}{NC}\n")

    print(f"  {'OFFSET':<14} {'HEX':<14} {'DESCRIPTION'}")
    print(f"  {'-'*14} {'-'*14} {'-'*40}")

    findings = []
    for sig, name in SIGNATURES:
        offset = 0
        while True:
            pos = data.find(sig, offset)
            if pos == -1:
                break
            findings.append((pos, name, sig))
            offset = pos + 1
            # 只记录前 5 个匹配
            if offset - data.find(sig, 0) > len(data) // 2:
                break
            count = sum(1 for f in findings if f[1] == name)
            if count >= 5:
                break

    # 去重并按偏移量排序
    seen = set()
    unique = []
    for pos, name, sig in findings:
        key = (pos, name)
        if key not in seen:
            seen.add(key)
            unique.append((pos, name, sig))
    unique.sort(key=lambda x: x[0])

    critical_findings = []
    for pos, name, sig in unique:
        is_critical = "⚠️" in name or "CVE" in name
        color = R if is_critical else G
        print(f"  {color}{pos:<14} 0x{pos:08X}     {name}{NC}")
        if is_critical:
            critical_findings.append((pos, name))

    print(f"\n  {C}[+] 共发现 {len(unique)} 处已知特征{NC}")
    return unique, critical_findings


def parse_uimage(data: bytes, offset: int):
    """解析 uImage 头部"""
    if len(data) < offset + 64:
        return None

    header = data[offset:offset+64]
    magic = struct.unpack(">I", header[0:4])[0]
    if magic != 0x27051956:
        return None

    # uImage header fields
    hcrc = struct.unpack(">I", header[4:8])[0]
    timestamp = struct.unpack(">I", header[8:12])[0]
    size = struct.unpack(">I", header[12:16])[0]
    load_addr = struct.unpack(">I", header[16:20])[0]
    entry_point = struct.unpack(">I", header[20:24])[0]
    dcrc = struct.unpack(">I", header[24:28])[0]
    os_type = header[28]
    arch = header[29]
    img_type = header[30]
    comp = header[31]
    name = header[32:64].split(b"\x00")[0].decode("ascii", errors="replace")

    OS_TYPES = {0: "Invalid", 1: "OpenBSD", 2: "NetBSD", 4: "4-4BSD", 5: "Linux", 17: "VxWorks"}
    ARCH_TYPES = {0: "Invalid", 1: "Alpha", 2: "ARM", 3: "x86", 5: "MIPS", 15: "ARM64"}
    COMP_TYPES = {0: "none", 1: "gzip", 2: "bzip2", 3: "lzma", 4: "lzo", 5: "lz4"}

    return {
        "name": name,
        "size": size,
        "load_addr": f"0x{load_addr:08X}",
        "entry_point": f"0x{entry_point:08X}",
        "os": OS_TYPES.get(os_type, f"Unknown({os_type})"),
        "arch": ARCH_TYPES.get(arch, f"Unknown({arch})"),
        "compression": COMP_TYPES.get(comp, f"Unknown({comp})"),
    }


def analyze_strings(data: bytes):
    """提取固件中的敏感字符串"""
    print(f"\n  {Y}{'='*55}")
    print(f"  Phase 2: 敏感字符串淘金")
    print(f"  {'='*55}{NC}\n")

    sensitive_patterns = [
        (b"root:", "🔑 Root 凭据"),
        (b"admin:", "🔑 Admin 凭据"),
        (b"password", "🔑 密码引用"),
        (b"passwd", "🔑 密码文件"),
        (b"secret", "🔑 密钥/秘密"),
        (b"api_key", "🔑 API 密钥"),
        (b"appkey", "🔑 App 密钥"),
        (b"token", "🔑 令牌"),
        (b"httpProcDataSrv", "🔥 CVE 漏洞函数"),
        (b"cfgsync", "🔥 鉴权旁路关键字"),
        (b"httpDoAuthorize", "🔥 鉴权函数"),
        (b"system(", "💀 命令注入风险"),
        (b"popen(", "💀 命令注入风险"),
        (b"/bin/sh", "🐚 Shell 路径"),
        (b"telnetd", "🌐 Telnet 服务"),
        (b"tplogin", "🌐 登录页面"),
        (b"WDR5620", "📌 型号标识"),
    ]

    for pattern, desc in sensitive_patterns:
        positions = []
        offset = 0
        while True:
            pos = data.find(pattern, offset)
            if pos == -1:
                break
            positions.append(pos)
            offset = pos + 1
            if len(positions) >= 10:
                break

        if positions:
            color = R if "🔥" in desc or "💀" in desc else Y if "🔑" in desc else C
            count_str = f"({len(positions)} 处)" if len(positions) > 1 else ""
            print(f"  {color}[+] {desc}: {pattern.decode('ascii', errors='replace')} {count_str}{NC}")

            # 尝试提取上下文
            for pos in positions[:3]:
                # 向前后各取 40 字节上下文
                start = max(0, pos - 20)
                end = min(len(data), pos + len(pattern) + 40)
                context = data[start:end]
                # 只保留可打印字符
                printable = "".join(chr(b) if 32 <= b < 127 else "." for b in context)
                print(f"  {DIM}    @ 0x{pos:08X}: ...{printable}...{NC}")


def file_overview(data: bytes, filepath: str):
    """文件基本信息"""
    print(f"  {W}[*] 固件文件: {G}{os.path.basename(filepath)}{NC}")
    print(f"  {W}[*] 文件大小: {G}{format_size(len(data))}{NC}")
    print(f"  {W}[*] MD5:      {G}{hashlib.md5(data).hexdigest()}{NC}")
    print(f"  {W}[*] SHA256:   {G}{hashlib.sha256(data).hexdigest()[:32]}...{NC}")

    # TP-Link 头部检测
    if len(data) >= 4:
        print(f"  {W}[*] 头部魔数: {G}0x{data[0]:02X} 0x{data[1]:02X} 0x{data[2]:02X} 0x{data[3]:02X}{NC}")


def main():
    banner()

    if len(sys.argv) < 2:
        print(f"  {Y}用法: python3 {sys.argv[0]} <firmware.bin>{NC}")
        print(f"  {DIM}  例: python3 {sys.argv[0]} firmware/wdr5620_v2.bin{NC}\n")
        sys.exit(1)

    filepath = sys.argv[1]
    if not os.path.isfile(filepath):
        print(f"  {R}[!] 文件不存在: {filepath}{NC}")
        sys.exit(1)

    # 读取固件
    print(f"  {C}[~] 读取固件中...{NC}")
    with open(filepath, "rb") as f:
        data = f.read()

    file_overview(data, filepath)

    # Phase 1: 特征扫描
    findings, critical = scan_signatures(data, filepath)

    # 解析 uImage (如果找到)
    for pos, name, sig in findings:
        if "uImage" in name:
            print(f"\n  {C}[~] 解析 uImage 头部 @ 0x{pos:08X}...{NC}")
            info = parse_uimage(data, pos)
            if info:
                print(f"  {G}    名称:    {info['name']}{NC}")
                print(f"  {G}    操作系统: {info['os']}{NC}")
                print(f"  {G}    架构:    {info['arch']}{NC}")
                print(f"  {G}    压缩:    {info['compression']}{NC}")
                print(f"  {G}    大小:    {format_size(info['size'])}{NC}")
                print(f"  {G}    加载地址: {info['load_addr']}{NC}")
                print(f"  {G}    入口点:  {info['entry_point']}{NC}")

                if info["os"] == "VxWorks":
                    print(f"\n  {R}  ⚠️ 该设备运行 VxWorks RTOS！{NC}")
                    print(f"  {Y}    - 非标准 Linux，无 /etc/passwd{NC}")
                    print(f"  {Y}    - 逆向难度更高，需要 VxWorks 专用工具{NC}")
                elif info["os"] == "Linux":
                    print(f"\n  {G}  ✅ 该设备运行嵌入式 Linux{NC}")
                    print(f"  {G}    - 预期存在 SquashFS 根文件系统{NC}")
                    print(f"  {G}    - 可提取 /etc/passwd, /usr/bin/httpd 等{NC}")

    # Phase 2: 敏感字符串
    analyze_strings(data)

    # 总结
    print(f"\n  {Y}{'='*55}")
    print(f"  解剖总结")
    print(f"  {'='*55}{NC}\n")

    if critical:
        print(f"  {R}  ████████████████████████████████████████████{NC}")
        print(f"  {R}  ██ 🔥 发现 {len(critical)} 处 CVE 相关特征！         ██{NC}")
        print(f"  {R}  ████████████████████████████████████████████{NC}\n")
        for pos, name in critical:
            print(f"  {R}    @ 0x{pos:08X}: {name}{NC}")
        print(f"\n  {Y}  建议: 用 Ghidra 打开固件中的 httpd 二进制,{NC}")
        print(f"  {Y}  定位 httpProcDataSrv 函数进行深度逆向分析{NC}")
    else:
        print(f"  {G}  [+] 未发现 CVE 相关特征 (可能固件已修补){NC}")

    print(f"\n  {DIM}CatTeam 固件解剖完毕 🐱{NC}\n")


if __name__ == "__main__":
    main()
