#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/config.sh"
init_loot_dir

log "${YELLOW}>>> [CatTeam 模块: 幽灵斥候] 出动 (模式: ${RECON_MODE}) <<<${NC}"

case "$RECON_MODE" in
    passive)
        # ---- 被动嗅探模式 (L2 同网段) ----
        log "[-] 被动嗅探模式: tcpdump 监听 $INTERFACE (${RECON_TIME}秒)"
        sudo tcpdump -i "$INTERFACE" -nn 'broadcast or multicast or arp' -w "$PCAP_FILE" 2>/dev/null &
        DUMP_PID=$!

        trap 'sudo kill $DUMP_PID 2>/dev/null; log "\n${RED}[!] 斥候任务被中止，已清理后台进程。${NC}"; exit 130' INT TERM

        for (( i=$RECON_TIME; i>0; i-- )); do
            printf "\r${CYAN}[~] 开启全频段静默监听... 剩余: %2d 秒 ${NC}" $i
            sleep 1
        done

        sudo kill $DUMP_PID 2>/dev/null
        wait $DUMP_PID 2>/dev/null || true
        trap - INT TERM

        log "\n${GREEN}[+] 截获完毕，正在启动正则吸星大法提取坐标...${NC}"

        MY_IP=$(ifconfig "$INTERFACE" | grep "inet " | awk '{print $2}' | head -n 1 || true)

        sudo tcpdump -nn -r "$PCAP_FILE" 2>/dev/null \
            | grep -oE "\b([0-9]{1,3}\.){3}[0-9]{1,3}\b" \
            | grep -v "255.255.255.255" \
            | grep -v "^0\.0\.0\.0$" \
            | grep -v "^${MY_IP}$" \
            | sort -u > "$TARGETS_FILE"
        ;;

    active)
        # ---- 主动探活模式 (L3 跨网段) ----
        if [ -z "$ACTIVE_CIDR" ]; then
            # 从 scope.txt 读取 CIDR
            SCOPE_FILE="$SCRIPT_DIR/scope.txt"
            if [ -f "$SCOPE_FILE" ]; then
                ACTIVE_CIDR=$(grep -v '^#' "$SCOPE_FILE" | grep -v '^\s*$' | head -1 || true)
            fi
            if [ -z "$ACTIVE_CIDR" ]; then
                log "${RED}[!] 主动模式需要指定 ACTIVE_CIDR 或在 scope.txt 中配置目标子网${NC}"
                log "${CYAN}[~] 用法: make fast RECON_MODE=active ACTIVE_CIDR=10.140.0.0/24${NC}"
                exit 1
            fi
        fi

        log "[-] 主动探活模式: nmap -sn $ACTIVE_CIDR (Docker 内执行)"

        # 确保战车存在
        if ! docker ps -a --format '{{.Names}}' | grep -Eq "^${CONTAINER_NAME}$"; then
            docker run -dit --name "$CONTAINER_NAME" -v "$(cd "$LOOT_DIR" && pwd):/workspace" -w /workspace \
                --cap-add=NET_RAW --cap-add=NET_ADMIN "$IMAGE_NAME" /bin/bash > /dev/null
        else
            docker start "$CONTAINER_NAME" > /dev/null 2>&1 || true
        fi

        # Docker 内 nmap 探活
        docker exec "$CONTAINER_NAME" bash -c \
            "nmap -sn $ACTIVE_CIDR -oG - 2>/dev/null | grep 'Status: Up' | awk '{print \$2}'" \
            > "$TARGETS_FILE" 2>/dev/null || true

        MY_IP=$(ifconfig "$INTERFACE" | grep "inet " | awk '{print $2}' | head -n 1 || true)
        [ -n "$MY_IP" ] && sed -i '' "/^${MY_IP}$/d" "$TARGETS_FILE" 2>/dev/null || true
        ;;

    *)
        log "${RED}[!] 未知侦察模式: $RECON_MODE (可选: passive | active)${NC}"
        exit 1
        ;;
esac

# 黑名单过滤：剔除绝对不碰的 IP
if [ -f "$BLACKLIST_FILE" ]; then
    # 提取非注释非空行作为过滤列表
    BLACKLIST_IPS=$(grep -v '^#' "$BLACKLIST_FILE" | grep -v '^\s*$' | awk '{print $1}' || true)
    if [ -n "$BLACKLIST_IPS" ]; then
        BEFORE=$(wc -l < "$TARGETS_FILE" | awk '{print $1}')
        echo "$BLACKLIST_IPS" | while read -r blocked_ip; do
            sed -i '' "/^${blocked_ip}$/d" "$TARGETS_FILE" 2>/dev/null || true
        done
        AFTER=$(wc -l < "$TARGETS_FILE" | awk '{print $1}')
        FILTERED=$((BEFORE - AFTER))
        if [ "$FILTERED" -gt 0 ]; then
            log "${YELLOW}[!] 黑名单过滤: 已剔除 ${FILTERED} 个禁止目标${NC}"
        fi
    fi
fi

# ROE 白名单校验：确保所有 IP 在授权子网内
SCOPE_FILE="$SCRIPT_DIR/scope.txt"
if [ -f "$SCOPE_FILE" ]; then
    python3 "$SCRIPT_DIR/scripts/scope_check.py" "$TARGETS_FILE" "$SCOPE_FILE"
fi

# 空结果保护
if [ ! -s "$TARGETS_FILE" ]; then
    log "${RED}[!] 未截获任何目标坐标，网络可能过于安静。${NC}"
    exit 1
fi

IP_COUNT=$(wc -l < "$TARGETS_FILE" | awk '{print $1}')
log "${GREEN}[+] 斥候归队！成功锁定 ${IP_COUNT} 个纯净坐标（已排除自身+黑名单+ROE校验），已存入 ${TARGETS_FILE}${NC}"