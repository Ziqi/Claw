#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
export USE_LATEST=true
source "$SCRIPT_DIR/config.sh"

log "${YELLOW}>>> [CatTeam 模块: 端口扫描] 战车主炮预热 <<<${NC}"
log "[-] 当前端口配置 (PROFILE=${PROFILE:-default}): ${NMAP_PORTS}"

if [ ! -f "$TARGETS_FILE" ] || [ ! -s "$TARGETS_FILE" ]; then
    log "${RED}[!] 弹药库为空！请先执行 01-recon.sh${NC}"
    exit 1
fi

# 部署或唤醒战车
if ! docker ps -a --format '{{.Names}}' | grep -Eq "^${CONTAINER_NAME}\$"; then
    log "[-] 部署 CatTeam 专属战车..."
    if ! docker run -dit --name "$CONTAINER_NAME" -v "$(cd "$LOOT_DIR" && pwd):/workspace" -w /workspace \
        --cap-add=NET_RAW --cap-add=NET_ADMIN "$IMAGE_NAME" /bin/bash > /dev/null; then
        log "${RED}[!] 战车部署失败！请检查 Docker 服务状态及镜像 ${IMAGE_NAME} 是否存在。${NC}"
        exit 1
    fi
else
    log "[-] 重新点燃战车引擎..."
    docker start "$CONTAINER_NAME" > /dev/null

    # 更新挂载路径（如果任务目录变了）
    CURRENT_MOUNT=$(docker inspect "$CONTAINER_NAME" --format '{{range .Mounts}}{{.Source}}{{end}}' 2>/dev/null || true)
    EXPECTED_MOUNT="$(cd "$LOOT_DIR" && pwd)"
    if [ "$CURRENT_MOUNT" != "$EXPECTED_MOUNT" ]; then
        log "${YELLOW}[!] 战车挂载路径变更，重建战车...${NC}"
        docker rm -f "$CONTAINER_NAME" > /dev/null 2>&1
        docker run -dit --name "$CONTAINER_NAME" -v "$EXPECTED_MOUNT:/workspace" -w /workspace \
            --cap-add=NET_RAW --cap-add=NET_ADMIN "$IMAGE_NAME" /bin/bash > /dev/null
    fi

    sleep 2
fi

log "[-] 正在执行外科手术式扫描 (日志将写入 ${LOG_FILE})..."

# 确保宿主机目录权限对容器可写（01-recon 以 sudo 创建目录，可能是 root 所有）
chmod -R 777 "$LOOT_DIR" 2>/dev/null || true

# 捕获 Nmap 退出状态码
if ! docker exec "$CONTAINER_NAME" bash -c "nmap -iL /workspace/targets.txt -p ${NMAP_PORTS} -Pn -T4 --open -oA /workspace/nmap_results > /workspace/nmap_run.log 2>&1"; then
    log "${RED}[!] 战车主炮哑火！请查看 ${LOG_FILE} 排查原因。${NC}"
    exit 1
fi

log "${GREEN}[+] 轰炸完毕！结构化体检报告已生成。${NC}"
log "${CYAN}[~] 开放端口快速摘要 (宿主机直读)：${NC}"

grep 'open' "$LOOT_DIR/nmap_results.nmap" 2>/dev/null | head -n 20 || echo -e "[-] 无开放端口发现。"