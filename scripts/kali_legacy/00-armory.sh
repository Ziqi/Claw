#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/config.sh"
init_loot_dir

log "${YELLOW}>>> [CatTeam 模块: 后勤总机] 启动 <<<${NC}"
log "[-] 正在向网关申请全新的数字身份 (DHCP Renew, ${DHCP_TIMEOUT}秒超时保护)..."

# DHCP 续租放入后台，加超时保护，防止 Mac Wi-Fi 卡死
sudo ipconfig set "$INTERFACE" DHCP &
DHCP_PID=$!

for (( i=1; i<=DHCP_TIMEOUT; i++ )); do
    if ! kill -0 $DHCP_PID 2>/dev/null; then
        break
    fi
    sleep 1
done

if kill -0 $DHCP_PID 2>/dev/null; then
    sudo kill $DHCP_PID 2>/dev/null
    wait $DHCP_PID 2>/dev/null || true
    log "${YELLOW}[!] DHCP 续租超时 (${DHCP_TIMEOUT}秒)，已强制终止。使用当前 IP 继续任务。${NC}"
else
    wait $DHCP_PID 2>/dev/null || true
fi

sleep 1
NEW_IP=$(ifconfig "$INTERFACE" | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n 1 || true)

if [ -z "$NEW_IP" ]; then
    log "${RED}[!] 致命错误：无法获取 IP！请检查物理网络连接。${NC}"
    exit 1
fi

log "${GREEN}[+] 身份就绪，CatTeam 当前隐蔽 IP: ${NEW_IP}${NC}"