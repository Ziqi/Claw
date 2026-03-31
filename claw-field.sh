#!/bin/bash
# ============================================================
#  CLAW 前线一键部署 (Kali 端)
#  用法: ./claw-field.sh <母舰IP>
#  示例: ./claw-field.sh 192.168.1.10
#
#  一键完成: MAC 抹除 → Monitor Mode → Airodump → 探针上线
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

MOTHERSHIP="${1:-}"
INTERFACE="${2:-wlan0}"
CHANNEL="${3:-}"
CSV_PATH="/tmp/claw_recon"
TOKEN="claw-sensor-2026"

# ============= 参数检查 =============
if [ -z "$MOTHERSHIP" ]; then
    echo ""
    echo -e "${RED}[!] 缺少母舰 IP！${NC}"
    echo ""
    echo -e "  用法: ${CYAN}sudo ./claw-field.sh <母舰IP> [网卡] [锁定信道]${NC}"
    echo ""
    echo -e "  示例: sudo ./claw-field.sh 192.168.1.10"
    echo -e "  示例: sudo ./claw-field.sh 192.168.1.10 wlan1"
    echo -e "  示例: sudo ./claw-field.sh 192.168.1.10 wlan0 6  (锁定信道6)"
    echo ""
    exit 1
fi

# ============= Root 检查 =============
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}[!] 需要 root 权限！请使用 sudo 运行${NC}"
    exit 1
fi

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  ${BOLD}CLAW V9.3 — 前线一键部署 (Kali)${NC}${CYAN}                ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  母舰地址: ${GREEN}http://${MOTHERSHIP}:8000${NC}"
echo -e "  物理网卡: ${GREEN}${INTERFACE}${NC}"
echo -e "  锁定信道: ${GREEN}${CHANNEL:-全频段跳跃}${NC}"
echo ""

# ============= Step 1: MAC 地址伪装 =============
echo -e "${YELLOW}[1/5]${NC} MAC 地址伪装..."
if command -v macchanger &> /dev/null; then
    # 先关闭接口再改 MAC
    ip link set "$INTERFACE" down 2>/dev/null || true
    FAKE_MAC=$(macchanger -r "$INTERFACE" 2>/dev/null | grep "New MAC" | awk '{print $3}')
    ip link set "$INTERFACE" up 2>/dev/null || true
    if [ -n "$FAKE_MAC" ]; then
        echo -e "  ${GREEN}[OK]${NC} 伪装 MAC: $FAKE_MAC"
    else
        echo -e "  ${YELLOW}[~]${NC} macchanger 执行但未返回新 MAC，可能需要手动检查"
    fi
else
    echo -e "  ${YELLOW}[~]${NC} macchanger 未安装，跳过 (sudo apt install macchanger)"
fi

# ============= Step 2: 清理冲突进程 =============
echo -e "${YELLOW}[2/5]${NC} 清理冲突进程..."
airmon-ng check kill > /dev/null 2>&1
echo -e "  ${GREEN}[OK]${NC} NetworkManager / wpa_supplicant 已暂停"

# ============= Step 3: 启用 Monitor Mode =============
echo -e "${YELLOW}[3/5]${NC} 启用 Monitor Mode..."
MON_IF="${INTERFACE}mon"

# 检查是否已在 monitor 模式
if iwconfig "$MON_IF" 2>/dev/null | grep -q "Mode:Monitor"; then
    echo -e "  ${GREEN}[OK]${NC} $MON_IF 已处于 Monitor 模式"
else
    airmon-ng start "$INTERFACE" > /dev/null 2>&1
    # 检测实际生成的接口名（airmon-ng 可能生成 wlan0mon 或 wlan0）
    if iwconfig "$MON_IF" 2>/dev/null | grep -q "Mode:Monitor"; then
        echo -e "  ${GREEN}[OK]${NC} Monitor 模式已激活: $MON_IF"
    elif iwconfig "$INTERFACE" 2>/dev/null | grep -q "Mode:Monitor"; then
        MON_IF="$INTERFACE"
        echo -e "  ${GREEN}[OK]${NC} Monitor 模式已激活: $MON_IF (同名接口)"
    else
        echo -e "  ${RED}[!]${NC} Monitor 模式启动失败，请检查网卡!"
        exit 1
    fi
fi

# ============= Step 4: 启动 Airodump-ng (后台) =============
echo -e "${YELLOW}[4/5]${NC} 启动 Airodump-ng 哨兵..."
AIRODUMP_ARGS="--write-interval 3 --output-format csv -w ${CSV_PATH}"
if [ -n "$CHANNEL" ]; then
    AIRODUMP_ARGS="$AIRODUMP_ARGS -c $CHANNEL"
fi

# 清理旧 CSV
rm -f ${CSV_PATH}*.csv 2>/dev/null

airodump-ng $MON_IF $AIRODUMP_ARGS > /dev/null 2>&1 &
AIRODUMP_PID=$!
sleep 3

# 找到生成的 CSV 文件
CSV_FILE=$(ls -t ${CSV_PATH}*.csv 2>/dev/null | head -1)
if [ -n "$CSV_FILE" ]; then
    echo -e "  ${GREEN}[OK]${NC} Airodump PID=$AIRODUMP_PID -> $CSV_FILE"
else
    echo -e "  ${RED}[!]${NC} Airodump 未生成 CSV 文件，检查网卡状态!"
    kill $AIRODUMP_PID 2>/dev/null
    exit 1
fi

# ============= Step 5: 启动 CLAW 探针 =============
echo -e "${YELLOW}[5/5]${NC} 启动 CLAW 边缘探针 v2..."
echo ""
echo -e "${CYAN}══════════════════════════════════════════════════${NC}"
echo -e "  ${BOLD}前线系统已就绪！${NC}"
echo ""
echo -e "  Airodump PID:  ${GREEN}${AIRODUMP_PID}${NC}"
echo -e "  Monitor 接口:  ${GREEN}${MON_IF}${NC}"
echo -e "  CSV 数据源:    ${GREEN}${CSV_FILE}${NC}"
echo -e "  母舰连接:      ${GREEN}http://${MOTHERSHIP}:8000${NC}"
echo ""
echo -e "  ${YELLOW}探针正在启动... (Ctrl+C 停止所有服务)${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════${NC}"
echo ""

# 设置退出清理钩子
cleanup() {
    echo ""
    echo -e "${YELLOW}[~] 正在回收前线资源...${NC}"
    kill $AIRODUMP_PID 2>/dev/null && echo -e "  ${GREEN}[OK]${NC} Airodump 已停止"
    airmon-ng stop "$MON_IF" > /dev/null 2>&1 && echo -e "  ${GREEN}[OK]${NC} Monitor 模式已关闭"
    echo -e "${GREEN}[OK] 前线已安全撤收${NC}"
    exit 0
}
trap cleanup SIGINT SIGTERM

# 构造探针参数
PROBE_ARGS="--csv $CSV_FILE --mothership http://${MOTHERSHIP}:8000 --token $TOKEN --interface $MON_IF"
if [ -n "$CHANNEL" ]; then
    PROBE_ARGS="$PROBE_ARGS --channel $CHANNEL"
fi

# 查找探针脚本（兼容多种部署位置）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROBE_SCRIPT=""
for candidate in \
    "$SCRIPT_DIR/CatTeam_Loot/claw_wifi_sensor.py" \
    "$SCRIPT_DIR/claw_wifi_sensor.py" \
    "$HOME/claw_wifi_sensor.py" \
    "./claw_wifi_sensor.py"; do
    if [ -f "$candidate" ]; then
        PROBE_SCRIPT="$candidate"
        break
    fi
done

if [ -z "$PROBE_SCRIPT" ]; then
    echo -e "${RED}[!] 找不到 claw_wifi_sensor.py！请确保探针脚本在以下位置之一:${NC}"
    echo "    - $SCRIPT_DIR/CatTeam_Loot/claw_wifi_sensor.py"
    echo "    - ~/claw_wifi_sensor.py"
    echo "    - 当前目录"
    cleanup
fi

# 前台运行探针（Ctrl+C 触发 cleanup）
python3 "$PROBE_SCRIPT" $PROBE_ARGS
