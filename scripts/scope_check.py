#!/usr/bin/env python3
"""
CatTeam ROE 白名单校验器
读取 scope.txt，过滤 targets.txt 中的非授权 IP。
用法: python3 scope_check.py <targets_file> <scope_file>
"""

import ipaddress
import sys
import os

RED = "\033[0;31m"
GREEN = "\033[1;32m"
YELLOW = "\033[1;33m"
NC = "\033[0m"


def load_scope(scope_file):
    """从 scope.txt 加载授权 CIDR 列表"""
    networks = []
    if not os.path.isfile(scope_file):
        return networks

    with open(scope_file, "r") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            try:
                networks.append(ipaddress.ip_network(line, strict=False))
            except ValueError as e:
                print(f"{YELLOW}[!] scope.txt 格式错误: {line} ({e}){NC}", file=sys.stderr)
    return networks


def filter_targets(targets_file, scope_networks):
    """过滤 targets.txt，只保留授权范围内的 IP"""
    if not os.path.isfile(targets_file):
        print(f"{RED}[!] 目标文件不存在: {targets_file}{NC}", file=sys.stderr)
        return [], []

    allowed = []
    rejected = []

    with open(targets_file, "r") as f:
        for line in f:
            ip_str = line.strip()
            if not ip_str:
                continue
            try:
                ip = ipaddress.ip_address(ip_str)
                if any(ip in net for net in scope_networks):
                    allowed.append(ip_str)
                else:
                    rejected.append(ip_str)
            except ValueError:
                rejected.append(ip_str)

    return allowed, rejected


def main():
    if len(sys.argv) < 3:
        print(f"用法: {sys.argv[0]} <targets_file> <scope_file>")
        sys.exit(1)

    targets_file = sys.argv[1]
    scope_file = sys.argv[2]

    # 优先检查环境变量
    if os.environ.get("ROE_BYPASS", "").lower() in ["true", "1", "yes"]:
        print(f"{YELLOW}[!] 警告: 检测到 ROE_BYPASS=true，已强制旁路所有 ROE 校验限制！{NC}", file=sys.stderr)
        sys.exit(0)

    # 加载授权范围 (scope.txt + 环境变量)
    scope_networks = load_scope(scope_file)
    
    # 追加环境变量指定的子网
    for env_key in ["ALLOWED_SUBNET", "ROE_TARGETS"]:
        env_val = os.environ.get(env_key, "").strip()
        if env_val:
            for subnet in env_val.split(","):
                subnet = subnet.strip()
                if subnet:
                    try:
                        scope_networks.append(ipaddress.ip_network(subnet, strict=False))
                    except ValueError:
                        pass

    if not scope_networks:
        # 没有 scope 文件且没有环境变量 → 不过滤，全部放行
        print(f"{YELLOW}[!] 未定义授权范围(scope.txt/ALLOWED_SUBNET为空)，跳过 ROE 校验（全部放行）{NC}", file=sys.stderr)
        sys.exit(0)

    # 过滤
    allowed, rejected = filter_targets(targets_file, scope_networks)

    if rejected:
        print(f"{RED}[!] ROE 过滤: 拦截 {len(rejected)} 个越界 IP{NC}", file=sys.stderr)
        for ip in rejected:
            print(f"{RED}    ✘ {ip} (不在授权范围内){NC}", file=sys.stderr)

    # 覆写 targets.txt（只保留合法 IP）
    with open(targets_file, "w") as f:
        for ip in allowed:
            f.write(ip + "\n")

    print(f"{GREEN}[+] ROE 校验通过: {len(allowed)} 个 IP 在授权范围内{NC}", file=sys.stderr)


if __name__ == "__main__":
    main()
