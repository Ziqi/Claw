#!/bin/bash
# ==============================================================================
# 行动代号：影子点火协议 V2.0 (Ghost Ignition Pro)
# 核心升级：战利品持久化挂载、权限撕裂修复、底层网络特权、战术端口预留
# ==============================================================================

# ================= 战术配置区 =================
INTERFACE="en0"                   
IMAGE_NAME="kalilinux/kali-rolling" # 请替换为你的专属军火库镜像名
CONTAINER_NAME="kali_arsenal"     
RECON_TIME=60                     

# 【核心修正】自动捕获执行 sudo 的真实宿主用户，解决 Docker 权限撕裂
REAL_USER=${SUDO_USER:-$USER}     
# 【核心修正】建立战术数据总线 (宿主机战利品存放点)
LOOT_DIR="/Users/$REAL_USER/RedTeam_Loot_$(date +%Y%m%d)" 
# ==============================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}======================================================${NC}"
echo -e "${CYAN}  [ 影子点火协议 V2.0 ] - 首席架构师特供版 ${NC}"
echo -e "${CYAN}======================================================${NC}"

if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[!] 权限不足：底层嗅探需要最高权限，请使用 'sudo ./脚本名' 运行。${NC}"
  exit 1
fi

# 确保战利品共享舱存在，并赋予真实用户权限
mkdir -p "$LOOT_DIR"
chown "$REAL_USER" "$LOOT_DIR"

# ==============================================================================
# 阶段一：OPSEC 警告与 IP 刷新
# ==============================================================================
echo -e "\n${YELLOW}>>> [1/3] OPSEC 检查与网络重置 <<<${NC}"
echo -e "[-] 检测到当前使用网卡: $INTERFACE"
echo -e "[-] ${RED}警告：已跳过 macOS 内置网卡 en0 的 MAC 强制伪装，以防止底层驱动卡死断网。${NC}"
echo -e "[-] 建议后续高烈度演练配备独立 USB 无线网卡作为“脏接口”。"
echo -e "[-] 正在向网关申请全新的数字身份 (DHCP Renew)..."
ipconfig set $INTERFACE DHCP
sleep 3
NEW_IP=$(ifconfig $INTERFACE | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n 1)
echo -e "${GREEN}[+] 坐标刷新完毕，当前新 IP:  ${NEW_IP}${NC}"

# ==============================================================================
# 阶段二：绝对静默侦察 (测绘情报直接落入共享货舱)
# ==============================================================================
echo -e "\n${YELLOW}>>> [2/3] 无线电静默嗅探 ($RECON_TIME 秒) <<<${NC}"
# 【核心修正】PCAP 直接存入共享目录
PCAP_FILE="$LOOT_DIR/shadow_recon.pcap"

tcpdump -i $INTERFACE -n 'broadcast or multicast or arp' -w "$PCAP_FILE" 2>/dev/null &
DUMP_PID=$!

for (( i=$RECON_TIME; i>0; i-- )); do
    printf "\r${CYAN}[~] 雷达扫掠中... 剩余: %2d 秒 ${NC}" $i
    sleep 1
done
printf "\r${GREEN}[+] 监听完成！测绘数据已落盘至共享舱: $LOOT_DIR ${NC}\n"
kill $DUMP_PID 2>/dev/null

echo -e "\n[-] 正在解析高价值局域网特征..."
# 剔除自身 IP 和无意义广播噪点
ACTIVE_IPS=$(tcpdump -r "$PCAP_FILE" -n 2>/dev/null | awk '{print $3}' | grep -oE "^([0-9]{1,3}\.){3}[0-9]{1,3}" | grep -v "255.255.255.255" | sort -u)

if [ -z "$ACTIVE_IPS" ]; then
    echo -e "${RED}[!] 雷达静默：未嗅探到任何有效源 IP。${NC}"
else
    echo -e "${GREEN}[+] 截获以下静默活跃资产：${NC}"
    echo "$ACTIVE_IPS" | awk '{print "    -> "$1}'
fi

# ==============================================================================
# 阶段三 & 四：战车引擎点火 & 挂载登舱 (特权模式)
# ==============================================================================
echo -e "\n${CYAN}======================================================${NC}"
echo -e "${YELLOW}>>> [3/3] 启动战术隔离舱 (Docker) <<<${NC}"

# 【核心修正】使用 sudo -u 降级到真实用户执行 docker，防止找不到守护进程
DOCKER_CMD="sudo -u $REAL_USER docker"

if ! $DOCKER_CMD info > /dev/null 2>&1; then
  echo -e "${RED}[!] 致命错误：Docker 引擎未启动！请手动打开 Docker Desktop。${NC}"
  exit 1
fi

if ! $DOCKER_CMD ps -a --format '{{.Names}}' | grep -Eq "^${CONTAINER_NAME}\$"; then
    echo -e "[-] 首次部署战车，正在建立物理与虚拟通道..."
    
    # 【核心升级】挂载数据卷 (-v)、底层网络提权 (--cap-add)、预留 C2 反弹端口 (-p)
    $DOCKER_CMD run -dit --name $CONTAINER_NAME \
        -v "$LOOT_DIR:/workspace" \
        -w /workspace \
        --cap-add=NET_RAW \
        --cap-add=NET_ADMIN \
        -p 4444:4444 -p 8000:8000 \
        $IMAGE_NAME /bin/bash > /dev/null
        
    echo -e "${GREEN}[+] 战车部署成功！物理弹药库已挂载至 /workspace ${NC}"
else
    CONTAINER_STATE=$($DOCKER_CMD inspect -f '{{.State.Running}}' $CONTAINER_NAME 2>/dev/null)
    if [ "$CONTAINER_STATE" == "true" ]; then
        echo -e "${GREEN}[+] 战车 '$CONTAINER_NAME' 引擎已在正常运转。${NC}"
    else
        echo -e "[-] 战车 '$CONTAINER_NAME' 处于休眠，执行点火程序..."
        $DOCKER_CMD start $CONTAINER_NAME > /dev/null
        echo -e "${GREEN}[+] 引擎重新点火成功！${NC}"
    fi
fi

echo -e "${CYAN}======================================================${NC}"
echo -e "${GREEN}[*] 所有前置战术动作完毕。武器库就绪！${NC}"
echo -e "${GREEN}[*] 进去之后你就在 /workspace 目录，直接 ls 就能看到 pcap 情报！${NC}"
echo -e "${CYAN}======================================================${NC}"
sleep 1

# 强行登入战车
$DOCKER_CMD exec -it $CONTAINER_NAME /bin/bash
