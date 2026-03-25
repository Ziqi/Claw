#!/bin/bash
set -euo pipefail

# CatTeam 自动化测试脚本
# 用法: ./tests/run_tests.sh (或 make test)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"

RED='\033[0;31m'; GREEN='\033[1;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

PASSED=0
FAILED=0

assert() {
    local desc="$1"
    local cmd="$2"
    if eval "$cmd" > /dev/null 2>&1; then
        echo -e "  ${GREEN}[✓]${NC} $desc"
        PASSED=$((PASSED + 1))
    else
        echo -e "  ${RED}[✗]${NC} $desc"
        FAILED=$((FAILED + 1))
    fi
}

echo -e "${YELLOW}═══════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  🐱 CatTeam 自动化测试 (make test)${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════${NC}"
echo ""

# ---- Phase 1: 启动靶场 ----
echo -e "${CYAN}[Phase 1] 启动微型靶场 (Docker Compose)...${NC}"
cd "$SCRIPT_DIR"
docker compose up -d 2>/dev/null || docker-compose up -d 2>/dev/null

echo -e "  ${YELLOW}[~] 等待靶机初始化 (15s)...${NC}"
sleep 15

# 验证靶机已启动
assert "靶场网络 catteam_range 已创建" "docker network inspect tests_catteam_range > /dev/null 2>&1 || docker network inspect catteam_range > /dev/null 2>&1"
assert "Web 靶机 (172.30.0.10) 已启动" "docker ps --format '{{.Names}}' | grep -q catteam_target_web"
assert "SMB 靶机 (172.30.0.20) 已启动" "docker ps --format '{{.Names}}' | grep -q catteam_target_smb"

echo ""

# ---- Phase 2: 注入测试目标 ----
echo -e "${CYAN}[Phase 2] 注入测试配置...${NC}"

# 创建测试用 loot 目录
TEST_RUN_ID="test_$(date +%Y%m%d_%H%M%S)"
TEST_LOOT="$PROJECT_DIR/CatTeam_Loot/$TEST_RUN_ID"
mkdir -p "$TEST_LOOT"

# 写入已知靶机 IP（跳过 01-recon，直接注入目标）
echo "172.30.0.10" > "$TEST_LOOT/targets.txt"
echo "172.30.0.20" >> "$TEST_LOOT/targets.txt"

# 创建 latest 软链接
ln -sfn "$TEST_LOOT" "$PROJECT_DIR/CatTeam_Loot/latest"

assert "测试目标已注入 targets.txt" "[ -s '$TEST_LOOT/targets.txt' ]"
assert "latest 软链接指向测试目录" "[ -L '$PROJECT_DIR/CatTeam_Loot/latest' ]"
echo ""

# ---- Phase 3: 测试 scope_check ----
echo -e "${CYAN}[Phase 3] 测试 ROE 白名单校验...${NC}"

# 临时 scope 文件
echo "172.30.0.0/24" > /tmp/catteam_test_scope.txt
cp "$TEST_LOOT/targets.txt" /tmp/catteam_test_targets.txt

# 加入一个越界 IP
echo "192.168.99.99" >> /tmp/catteam_test_targets.txt

python3 "$PROJECT_DIR/scripts/scope_check.py" /tmp/catteam_test_targets.txt /tmp/catteam_test_scope.txt 2>/dev/null
assert "ROE 过滤: 越界 IP 被拦截" "! grep -q '192.168.99.99' /tmp/catteam_test_targets.txt"
assert "ROE 过滤: 合法 IP 被保留" "grep -q '172.30.0.10' /tmp/catteam_test_targets.txt"

rm -f /tmp/catteam_test_scope.txt /tmp/catteam_test_targets.txt
echo ""

# ---- Phase 4: 测试扫描链 ----
echo -e "${CYAN}[Phase 4] 测试扫描链 (02-probe → 02.5-parse)...${NC}"

# 将战车加入靶场网络
docker network connect tests_catteam_range kali_arsenal 2>/dev/null || \
    docker network connect catteam_range kali_arsenal 2>/dev/null || true

# 确保 loot 目录权限
chmod -R 777 "$TEST_LOOT" 2>/dev/null || true

# 运行 Nmap 扫描（只扫 80,445）
docker exec kali_arsenal bash -c \
    "nmap -iL /workspace/targets.txt -p 80,445 -Pn -T4 --open -oA /workspace/nmap_results > /workspace/nmap_run.log 2>&1" 2>/dev/null || true

assert "Nmap 扫描生成 XML 输出" "[ -f '$TEST_LOOT/nmap_results.xml' ]"

# 运行解析
cd "$PROJECT_DIR"
USE_LATEST=true python3 ./02.5-parse.py 2>/dev/null || true

assert "02.5-parse 生成 live_assets.json" "[ -f '$TEST_LOOT/live_assets.json' ]"
echo ""

# ---- Phase 5: 测试报告生成 ----
echo -e "${CYAN}[Phase 5] 测试情报层 (07-report)...${NC}"

USE_LATEST=true python3 ./07-report.py 2>/dev/null || true
assert "07-report 生成 CatTeam_Report.md" "[ -f '$TEST_LOOT/CatTeam_Report.md' ]"
echo ""

# ---- Phase 6: 清理 ----
echo -e "${CYAN}[Phase 6] 清理靶场...${NC}"

# 断开战车与靶场网络
docker network disconnect tests_catteam_range kali_arsenal 2>/dev/null || \
    docker network disconnect catteam_range kali_arsenal 2>/dev/null || true

# 销毁靶场
cd "$SCRIPT_DIR"
docker compose down 2>/dev/null || docker-compose down 2>/dev/null
echo -e "  ${GREEN}[✓]${NC} 靶场已销毁"

# 清理测试数据
sudo rm -rf "$TEST_LOOT" 2>/dev/null || rm -rf "$TEST_LOOT" 2>/dev/null || true

echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════${NC}"
echo -e "  📊 测试结果: ${GREEN}${PASSED} 通过${NC} / ${RED}${FAILED} 失败${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════${NC}"

if [ "$FAILED" -gt 0 ]; then
    echo -e "${RED}[!] 存在失败项，请检查上方日志。${NC}"
    exit 1
else
    echo -e "${GREEN}[+] 🎉 全部测试通过！代码健康度 100%${NC}"
fi
