#!/bin/bash
set -euo pipefail

# ========== CatTeam 统一色彩方案 ==========
RED='\033[0;31m'; GREEN='\033[1;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

CONTAINER_NAME="kali_arsenal"
LOOT_DIR="$(pwd)/CatTeam_Loot"
ASSETS_FILE="$LOOT_DIR/live_assets.json"

echo -e "${YELLOW}>>> [CatTeam 模块: 应用层审计] 启动 <<<${NC}"

# -------- 前置检查 --------
if [ ! -f "$ASSETS_FILE" ] || [ ! -s "$ASSETS_FILE" ]; then
    echo -e "${RED}[!] 缺少 live_assets.json！请先执行完整杀伤链: make run 或 make fast${NC}"
    exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo -e "${RED}[!] 战车未运行！请先执行 make probe 部署战车。${NC}"
    exit 1
fi

# -------- 检查战车内是否有 httpx --------
if ! docker exec "$CONTAINER_NAME" which httpx > /dev/null 2>&1; then
    echo -e "${YELLOW}[~] 战车内未发现 httpx，正在安装...${NC}"
    if ! docker exec "$CONTAINER_NAME" bash -c "apt-get update -qq && apt-get install -y -qq httpx-toolkit 2>/dev/null || go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest 2>/dev/null"; then
        echo -e "${RED}[!] httpx 安装失败，请手动在战车内安装。${NC}"
        exit 1
    fi
fi

# -------- 从 live_assets.json 提取 Web 端口目标 --------
echo -e "[-] 正在从 live_assets.json 提取 Web 目标..."

# 用 Python 提取可能的 Web 端口 (80, 443, 8080, 8443, 8000, 8888, 9000, 9090 等)
python3 -c "
import json, sys
WEB_PORTS = {80, 443, 8080, 8443, 8000, 8888, 9000, 9090, 5000, 3000}
with open('$ASSETS_FILE') as f:
    data = json.load(f)
targets = []
for ip, info in data.get('assets', {}).items():
    for port in info.get('ports', []):
        if port in WEB_PORTS:
            scheme = 'https' if port in (443, 8443) else 'http'
            targets.append(f'{scheme}://{ip}:{port}')
if not targets:
    print('[!] 未发现 Web 端口目标', file=sys.stderr)
    sys.exit(1)
print('\n'.join(targets))
" > "$LOOT_DIR/web_targets.txt"

WEB_COUNT=$(wc -l < "$LOOT_DIR/web_targets.txt" | awk '{print $1}')
echo -e "${GREEN}[+] 提取到 ${WEB_COUNT} 个 Web 目标${NC}"

# -------- httpx 应用层指纹提取 --------
echo -e "[-] 正在执行应用层指纹提取 (httpx)..."

docker exec "$CONTAINER_NAME" bash -c "\
    cat /workspace/web_targets.txt | httpx -silent \
    -title -status-code -tech-detect -content-length \
    -follow-redirects -timeout 10 \
    -o /workspace/httpx_results.txt \
    > /workspace/httpx_run.log 2>&1" || true

# -------- 输出结果 --------
echo -e "\n${GREEN}[+] 应用层审计完毕！${NC}"

if [ -s "$LOOT_DIR/httpx_results.txt" ]; then
    echo -e "${CYAN}[~] Web 指纹摘要：${NC}"
    cat "$LOOT_DIR/httpx_results.txt"
    echo ""
    echo -e "${GREEN}[+] 详细结果已保存至 CatTeam_Loot/httpx_results.txt${NC}"
    echo -e "${CYAN}[~] 下一步: 将 live_assets.json + httpx_results.txt 喂给 AI，生成精准利用脚本。${NC}"
else
    echo -e "${YELLOW}[!] httpx 未返回有效结果，可能目标 Web 服务无响应。${NC}"
    echo -e "    运行日志: $LOOT_DIR/httpx_run.log"
fi
