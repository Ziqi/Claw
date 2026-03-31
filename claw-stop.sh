#!/bin/bash
# ============================================================
#  CLAW 服务停止脚本 (Mac 端)
#  用法: ./claw-stop.sh
# ============================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo -e "${YELLOW}[~] 正在关闭 CLAW 服务...${NC}"

# 停止后端
if lsof -ti:8000 > /dev/null 2>&1; then
    kill $(lsof -ti:8000) 2>/dev/null
    echo -e "  ${GREEN}[OK]${NC} 后端已停止 (port 8000)"
else
    echo -e "  ${YELLOW}[-]${NC} 后端未在运行"
fi

# 停止前端
if lsof -ti:5173 > /dev/null 2>&1; then
    kill $(lsof -ti:5173) 2>/dev/null
    echo -e "  ${GREEN}[OK]${NC} 前端已停止 (port 5173)"
else
    echo -e "  ${YELLOW}[-]${NC} 前端未在运行"
fi

# 停止 caffeinate
pkill -f "caffeinate -d" 2>/dev/null && \
    echo -e "  ${GREEN}[OK]${NC} caffeinate 已停止" || \
    echo -e "  ${YELLOW}[-]${NC} caffeinate 未在运行"

echo ""
echo -e "${GREEN}[OK] CLAW 所有服务已关闭${NC}"
echo ""
