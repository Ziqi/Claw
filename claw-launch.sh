#!/bin/bash
# ============================================================
#  CLAW 指挥台一键启动 (Mac 端)
#  用法: ./claw-launch.sh
#  效果: 一键拉起后端 + 前端 + 自动显示手机访问地址
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  ${BOLD}CLAW V9.3 — 指挥台一键启动${NC}${CYAN}                      ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# Step 0: 防休眠 (后台运行，脚本退出后仍生效)
echo -e "${YELLOW}[1/4]${NC} 启动防休眠守护..."
caffeinate -d &
CAFFEINATE_PID=$!
echo -e "  ${GREEN}[OK]${NC} caffeinate PID=$CAFFEINATE_PID (合盖不休眠)"

# Step 1: 检查 API Key
echo -e "${YELLOW}[2/4]${NC} 检查环境..."
if [ -z "$GEMINI_API_KEY" ] && [ -z "$CLAW_AI_KEY" ]; then
    # 尝试从 config.sh 读取
    if [ -f "$SCRIPT_DIR/config.sh" ]; then
        source "$SCRIPT_DIR/config.sh" 2>/dev/null || true
    fi
    if [ -z "$GEMINI_API_KEY" ] && [ -z "$CLAW_AI_KEY" ]; then
        echo -e "  ${RED}[!]${NC} 未找到 GEMINI_API_KEY，AI Agent 将不可用"
    else
        echo -e "  ${GREEN}[OK]${NC} API Key 已从 config.sh 加载"
    fi
else
    echo -e "  ${GREEN}[OK]${NC} API Key 已配置"
fi

# Step 2: 启动后端 (后台)
echo -e "${YELLOW}[3/4]${NC} 启动后端服务..."
if lsof -ti:8000 > /dev/null 2>&1; then
    echo -e "  ${GREEN}[OK]${NC} 后端已在运行 (port 8000)"
else
    cd "$SCRIPT_DIR"
    nohup python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload \
        > "$SCRIPT_DIR/backend.log" 2>&1 &
    BACKEND_PID=$!
    sleep 2
    if lsof -ti:8000 > /dev/null 2>&1; then
        echo -e "  ${GREEN}[OK]${NC} 后端启动成功 PID=$BACKEND_PID (port 8000)"
    else
        echo -e "  ${RED}[!]${NC} 后端启动失败，查看 backend.log"
    fi
fi

# Step 3: 启动前端 (后台)
echo -e "${YELLOW}[4/4]${NC} 启动前端服务..."
if lsof -ti:5173 > /dev/null 2>&1; then
    echo -e "  ${GREEN}[OK]${NC} 前端已在运行 (port 5173)"
else
    cd "$SCRIPT_DIR/frontend"
    nohup npx vite --host 0.0.0.0 --port 5173 \
        > "$SCRIPT_DIR/frontend.log" 2>&1 &
    FRONTEND_PID=$!
    sleep 3
    if lsof -ti:5173 > /dev/null 2>&1; then
        echo -e "  ${GREEN}[OK]${NC} 前端启动成功 PID=$FRONTEND_PID (port 5173)"
    else
        echo -e "  ${RED}[!]${NC} 前端启动失败，查看 frontend.log"
    fi
fi

# Step 4: 显示访问地址
echo ""
echo -e "${CYAN}══════════════════════════════════════════════════${NC}"
echo ""

# 获取手机热点 IP（手机浏览器用这个访问）
HOTSPOT_IP=$(ipconfig getifaddr en0 2>/dev/null || echo "")
if [ -z "$HOTSPOT_IP" ]; then
    HOTSPOT_IP=$(ifconfig en0 2>/dev/null | grep 'inet ' | awk '{print $2}')
fi
if [ -z "$HOTSPOT_IP" ]; then
    HOTSPOT_IP="未连接热点"
fi

# 获取 VM 网关 IP（Kali 探针用这个连 Mac 后端）
# UTM Shared(NAT) 模式下，Mac 作为 Kali 的网关，通常是 192.168.64.1
VM_GATEWAY_IP=""
for iface in bridge100 bridge101 vmnet1 vmnet8; do
    VM_GATEWAY_IP=$(ifconfig $iface 2>/dev/null | grep 'inet ' | awk '{print $2}')
    if [ -n "$VM_GATEWAY_IP" ]; then
        break
    fi
done
# 如果 VM 未运行，提供默认建议
if [ -z "$VM_GATEWAY_IP" ]; then
    VM_GATEWAY_IP="192.168.64.1 (Kali VM 启动后自动生效)"
fi

echo -e "  ${BOLD}[手机浏览器]${NC}  看雷达大屏:"
echo -e "    ${GREEN}http://${HOTSPOT_IP}:5173${NC}"
echo ""
echo -e "  ${BOLD}[Mac 本机]${NC}    本地访问:"
echo -e "    ${GREEN}http://localhost:5173${NC}"
echo ""
echo -e "  ${BOLD}[Kali 探针]${NC}   母舰地址 (VM 内部网关):"
echo -e "    ${GREEN}http://${VM_GATEWAY_IP}:8000${NC}"
echo ""
echo -e "  ${BOLD}Kali 一键部署命令:${NC}"
echo ""
echo -e "  ${YELLOW}sudo ./claw-field.sh ${VM_GATEWAY_IP}${NC}"
echo ""
echo -e "  ${BOLD}(或手动启动探针):${NC}"
echo -e "  ${YELLOW}python3 claw_wifi_sensor.py \\\\${NC}"
echo -e "  ${YELLOW}  --csv /tmp/target_recon-01.csv \\\\${NC}"
echo -e "  ${YELLOW}  --mothership http://${VM_GATEWAY_IP}:8000 \\\\${NC}"
echo -e "  ${YELLOW}  --interface wlan0mon${NC}"
echo ""
echo -e "${CYAN}══════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BOLD}停止所有服务:${NC}  ${RED}./claw-stop.sh${NC}"
echo ""
