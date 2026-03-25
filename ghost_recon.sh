#!/bin/bash
# ==============================================================================
# 行动代号：影子网络 (Ghost Recon)
# 战术定位：macOS 专属自动化前沿侦察脚本
# 核心逻辑：物理换脸 -> 绝对静默 -> 情报提取 -> 轻量级探活
# ==============================================================================

# 战术 UI 颜色配置
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}======================================================${NC}"
echo -e "${CYAN}  [ 影子网络 ] - 战术先遣侦察协议 v1.0 启动 ${NC}"
echo -e "${CYAN}======================================================${NC}"

# 1. 权限控制 (必须以 Root 身份执行网卡级操作)
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[!] 战术动作受限：执行 MAC 伪装和底层嗅探需要最高权限，请使用 sudo 运行此脚本。${NC}"
  exit 1
fi

# 锁定物理监听网卡 (Mac Wi-Fi 默认为 en0)
INTERFACE="en0"
echo -e "${GREEN}[*] 锁定战术网卡: ${INTERFACE}${NC}"

# ==============================================================================
# 阶段一：OPSEC 物理层伪装 (换脸)
# ==============================================================================
echo -e "\n${YELLOW}>>> 阶段一：OPSEC 物理特征消除 <<<${NC}"
ORIG_MAC=$(ifconfig $INTERFACE | grep ether | awk '{print $2}')
echo -e "[-] 当前真实 MAC 地址: ${ORIG_MAC}"

# 生成 macOS 兼容的随机 MAC 地址 (保留本地管理位)
RAND_MAC=$(printf '%02x:%02x:%02x:%02x:%02x:%02x' $((RANDOM%256|2)) $((RANDOM%256)) $((RANDOM%256)) $((RANDOM%256)) $((RANDOM%256)) $((RANDOM%256)))
ifconfig $INTERFACE ether $RAND_MAC

NEW_MAC=$(ifconfig $INTERFACE | grep ether | awk '{print $2}')
if [ "$ORIG_MAC" != "$NEW_MAC" ]; then
    echo -e "${GREEN}[+] 伪装成功！已披上幽灵外衣，当前 MAC: ${NEW_MAC}${NC}"
else
    echo -e "${RED}[!] 伪装失败，请检查网卡状态。${NC}"
fi

# ==============================================================================
# 阶段二：绝对静默侦察 (无声雷达)
# ==============================================================================
echo -e "\n${YELLOW}>>> 阶段二：60秒无线电静默嗅探 <<<${NC}"
PCAP_FILE="/tmp/shadow_recon_$(date +%s).pcap"
echo -e "[-] 正在开启全频段监听，不发送任何数据包，防守方 IDS 无法感知..."

# macOS 原生后台监听方案 (替代不支持的 timeout 命令)
tcpdump -i $INTERFACE -n 'broadcast or multicast or arp' -w $PCAP_FILE 2>/dev/null &
DUMP_PID=$!

# 倒计时模块
for i in {60..1}; do
    printf "\r${CYAN}[~] 雷达扫掠中... 剩余时间: %2d 秒 ${NC}" $i
    sleep 1
done
printf "\r${GREEN}[+] 监听完成！测绘数据已落盘。                      ${NC}\n"
kill $DUMP_PID 2>/dev/null

# ==============================================================================
# 阶段三：战区情报提取 (剥离真实目标)
# ==============================================================================
echo -e "\n${YELLOW}>>> 阶段三：战区高价值情报解析 <<<${NC}"
echo -e "[-] 正在从截获的底层电波中提取活跃 IP 与设备特征..."

# 提取并去重活跃 IP
ACTIVE_IPS=$(tcpdump -r $PCAP_FILE -n 2>/dev/null | awk '{print $3, $5}' | grep -oE "\b([0-9]{1,3}\.){3}[0-9]{1,3}\b" | sort -u)

if [ -z "$ACTIVE_IPS" ]; then
    echo -e "${RED}[!] 雷达静默：未嗅探到任何广播 IP，战区可能被严密物理隔离或处于深度休眠。${NC}"
else
    echo -e "${GREEN}[+] 发现以下静默活跃资产 (极度安全的情报)：${NC}"
    echo "$ACTIVE_IPS" | awk '{print "    -> "$1}'
    
    # 提取最高频出现的网段 (推测主战区)
    PRIMARY_SUBNET=$(echo "$ACTIVE_IPS" | awk -F'.' '{print $1"."$2"."$3".0/24"}' | sort | uniq -c | sort -nr | head -n 1 | awk '{print $2}')
    echo -e "${CYAN}[*] 战术系统推断，主战区网段大概率为: ${PRIMARY_SUBNET}${NC}"
fi

# ==============================================================================
# 阶段四：控制级火力探活 (接管网段)
# ==============================================================================
echo -e "\n${YELLOW}>>> 阶段四：轻量级主动指纹探活 <<<${NC}"
echo -e "[-] 警告：此阶段将向局域网发射低频探测包。"
read -p "[?] 是否对推断网段 ($PRIMARY_SUBNET) 发起隐蔽探活? [Y/n]: " DO_ACTIVE

if [[ "$DO_ACTIVE" == "Y" || "$DO_ACTIVE" == "y" || -z "$DO_ACTIVE" ]]; then
    if command -v arp-scan &> /dev/null; then
        echo -e "${GREEN}[+] 发射 ARP 探针矩阵...${NC}"
        arp-scan -l --interface=$INTERFACE
    else
        echo -e "${RED}[!] 战车缺少 'arp-scan' 组件 (建议后续运行: brew install arp-scan)。${NC}"
        if command -v nmap &> /dev/null; then
           echo -e "${CYAN}[+] 降级使用 Nmap 轻量级 Ping 扫描 (-sn)...${NC}"
           nmap -sn -T2 $PRIMARY_SUBNET
        else
           echo -e "${RED}[!] 战车缺少 Nmap，跳过主动探测。${NC}"
        fi
    fi
else
    echo -e "[-] 收到指令，保持绝对静默，放弃主动探测。"
fi

# ==============================================================================
# 任务结束与现场清理
# ==============================================================================
echo -e "\n${CYAN}======================================================${NC}"
echo -e "${GREEN}[*] 影子先遣行动结束。数据已保存至: $PCAP_FILE${NC}"
echo -e "${YELLOW}[!] 注意: 要恢复你 Mac 的原始物理 MAC 地址，请断开并重新连接 Wi-Fi，或执行:${NC}"
echo -e "    sudo ifconfig $INTERFACE ether $ORIG_MAC"
echo -e "${CYAN}======================================================${NC}"
