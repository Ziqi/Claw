# ============================================================
#  CatTeam 中控引擎 v3.0 (Control Plane)
#  用法：make run | make fast | make clean | make audit
#  攻击链: make phantom | make crack | make lateral
# ============================================================

SHELL := /bin/bash
BASE_LOOT := ./CatTeam_Loot
CONTAINER := kali_arsenal
IMAGE := my-kali-arsenal:v2
PROFILE ?= default

# 共享 RUN_ID，确保同一次 make run 所有模块写入同一目录
export RUN_ID := $(shell date +%Y%m%d_%H%M%S)
export PROFILE
export RECON_MODE
export ACTIVE_CIDR

.PHONY: run fast clean audit parse recon probe armory help preflight status web phantom crack lateral report diff test nuclei loot kerberoast console

# -------- 默认目标：显示战术面板 --------
help:
	@echo ""
	@echo "  \033[1;33m╔══════════════════════════════════════════════╗\033[0m"
	@echo "  \033[1;33m║     🐱 CatTeam 中控引擎 v4.0                ║\033[0m"
	@echo "  \033[1;33m╚══════════════════════════════════════════════╝\033[0m"
	@echo ""
	@echo "  \033[1;36m作战指令：\033[0m"
	@echo "    make console          启动交互式控制台"
	@echo "    make run              完整杀伤链 (00→01→02→02.5)"
	@echo "    make fast             跳过换脸 (01→02→02.5)"
	@echo "    make run PROFILE=iot  IoT 专用端口"
	@echo "    make run PROFILE=full 全面扫描 (Top 30 端口)"
	@echo "    make audit            触发 03 应用层审计"
	@echo "    make web              手搓 httpx Web 清扫"
	@echo "    make phantom          04 投毒陷阱 (Responder)"
	@echo "    make phantom-stop     回收陷阱"
	@echo "    make crack            05 算力破解 (Hashcat)"
	@echo "    make lateral          06 横向移动 (Impacket)"
	@echo "    make report           07 生成渗透测试战报"
	@echo "    make diff             08 资产变化检测"
	@echo "    make loot             09 后渗透提取 (需 --confirm)"
	@echo "    make kerberoast       10 AD 域 Kerberoast"
	@echo "    make nuclei           Nuclei 漏洞扫描"
	@echo "    make toolbox          🔧 扩展工具箱 (Nikto/Hydra/Sqlmap/binwalk)"
	@echo "    make firmware FW=x.bin 固件解剖刀 (纯 Python)"
	@echo "    make test             自动化靶场测试"
	@echo "    make clean            清空战区，重置所有数据"
	@echo "    make status           查看战区状态"
	@echo ""
	@echo "  \033[1;36m侦察模式：\033[0m"
	@echo "    make fast                         被动嗅探 (默认)"
	@echo "    make fast RECON_MODE=active ACTIVE_CIDR=10.0.0.0/24  主动探活"
	@echo "  \033[1;36m单模块指令：\033[0m"
	@echo "    make armory           仅 00 DHCP 换脸"
	@echo "    make recon            仅 01 被动嗅探"
	@echo "    make probe            仅 02 端口扫描"
	@echo "    make parse            仅 02.5 数据降维"
	@echo ""

# -------- 飞行前检查 --------
preflight:
	@echo "\033[1;33m[~] 飞行前检查 (Preflight)...\033[0m"
	@# 检查 Docker
	@if ! docker info > /dev/null 2>&1; then \
		echo "\033[0;31m[✗] Docker 未运行！请先启动 Docker Desktop。\033[0m"; \
		exit 1; \
	fi
	@echo "  \033[0;32m[✓]\033[0m Docker 运行中"
	@# 检查镜像
	@if ! docker images --format '{{.Repository}}:{{.Tag}}' | grep -q "^$(IMAGE)$$"; then \
		echo "\033[0;31m[✗] 镜像 $(IMAGE) 不存在！请先构建: docker build -t $(IMAGE) .\033[0m"; \
		exit 1; \
	fi
	@echo "  \033[0;32m[✓]\033[0m 镜像 $(IMAGE) 就绪"
	@# 检查 Python
	@if ! command -v python3 > /dev/null 2>&1; then \
		echo "\033[0;31m[✗] Python3 未安装！\033[0m"; \
		exit 1; \
	fi
	@echo "  \033[0;32m[✓]\033[0m Python3 就绪"
	@# 检查 sudo 缓存
	@echo "  \033[1;33m[~]\033[0m 检查 sudo 权限 (可能需要输入密码)..."
	@sudo -v
	@echo "  \033[0;32m[✓]\033[0m sudo 权限已缓存"
	@echo "\033[1;32m[✓] 飞行前检查全部通过！起飞！\033[0m"
	@echo ""

# -------- 完整杀伤链 --------
run: preflight armory recon probe parse
	@echo ""
	@echo "\033[1;32m[✓] 完整杀伤链执行完毕 (任务 ID: $(RUN_ID), PROFILE: $(PROFILE))\033[0m"
	@echo "    数据目录: $(BASE_LOOT)/$(RUN_ID)/"

# -------- 快速模式 --------
fast: preflight recon probe parse
	@echo ""
	@echo "\033[1;32m[✓] 快速杀伤链执行完毕 (任务 ID: $(RUN_ID), PROFILE: $(PROFILE))\033[0m"
	@echo "    数据目录: $(BASE_LOOT)/$(RUN_ID)/"

# -------- 单模块目标 --------
armory:
	@sudo ./00-armory.sh

recon:
	@sudo ./01-recon.sh

probe:
	@sudo ./02-probe.sh

parse:
	@USE_LATEST=true python3 ./02.5-parse.py

web:
	@USE_LATEST=true python3 ./03-audit-web.py

# -------- 攻击模块 --------
phantom:
	@sudo USE_LATEST=true ./04-phantom.sh --start

phantom-stop:
	@sudo ./04-phantom.sh --stop

crack:
	@USE_LATEST=true ./05-cracker.sh

lateral:
	@sudo USE_LATEST=true ./06-psexec.sh

report:
	@USE_LATEST=true python3 ./07-report.py

diff:
	@python3 ./08-diff.py

loot:
	@sudo ./09-loot.sh $(CONFIRM)

kerberoast:
	@sudo ./10-kerberoast.sh

nuclei:
	@echo "\033[1;33m[~] Nuclei 漏洞扫描...\033[0m"
	@USE_LATEST=true python3 -c "import json,os; \
		d=json.load(open(os.path.realpath('./CatTeam_Loot/latest/live_assets.json'))); \
		targets=[f'{ip}:{p}' for ip,info in d.get('assets',{}).items() for p in info.get('ports',[]) if p in (80,443,8080,8443)]; \
		open('/tmp/catteam_nuclei_targets.txt','w').write('\n'.join(targets))" 2>/dev/null
	@docker exec -v "$(shell pwd)/nuclei-templates:/root/nuclei-templates" $(CONTAINER) \
		nuclei -l /workspace/nuclei_targets.txt -o /workspace/nuclei_results.txt 2>/dev/null || \
		echo "\033[0;31m[!] Nuclei 未安装或模板未配置。请先 docker build -t my-kali-arsenal:v3 . 并更新 config.sh\033[0m"

test:
	@echo "\033[1;33m[~] 启动自动化靶场测试...\033[0m"
	@bash ./tests/run_tests.sh

console:
	@bash ./catteam.sh

# -------- 工具箱 (P4) --------
toolbox:
	@echo ""
	@echo "  \033[1;33m╔══════════════════════════════════════╗\033[0m"
	@echo "  \033[1;33m║     🔧 CatTeam 扩展工具箱           ║\033[0m"
	@echo "  \033[1;33m╚══════════════════════════════════════╝\033[0m"
	@echo ""
	@echo "  \033[1;36m可用工具：\033[0m"
	@echo "    1) Nikto    — Web 服务器漏洞扫描"
	@echo "    2) Hydra    — 在线密码爆破"
	@echo "    3) Sqlmap   — SQL 注入自动化"
	@echo "    4) binwalk  — 固件逆向分析"
	@echo "    5) 固件解剖刀 — 纯 Python 固件分析 (零依赖)"
	@echo ""
	@read -p "  选择工具 [1-5]: " TOOL; \
	case $$TOOL in \
		1) docker exec -it $(CONTAINER) nikto -h $${TARGET:-http://127.0.0.1} ;; \
		2) echo "  用法: make hydra TARGET=10.0.0.1 SERVICE=ssh"; \
		   docker exec -it $(CONTAINER) hydra -L /usr/share/wordlists/fasttrack.txt -P /usr/share/wordlists/fasttrack.txt $${TARGET:-127.0.0.1} $${SERVICE:-ssh} ;; \
		3) echo "  用法: make sqlmap URL=http://target/page?id=1"; \
		   docker exec -it $(CONTAINER) sqlmap -u "$${URL:-http://127.0.0.1}" --batch ;; \
		4) echo "  用法: make toolbox (选 4), 然后输入固件路径"; \
		   read -p "  固件文件路径: " FW; \
		   docker exec -it $(CONTAINER) binwalk -e "/workspace/$$FW" ;; \
		5) read -p "  固件文件路径: " FW; \
		   python3 ./scripts/firmware-autopsy.py "$$FW" ;; \
		*) echo "  \033[0;31m无效选择\033[0m" ;; \
	esac

firmware:
	@echo "\033[1;33m[~] 固件解剖刀 (纯 Python)...\033[0m"
	@python3 ./scripts/firmware-autopsy.py $(FW)

# -------- 03 审计 --------
audit:
	@sudo USE_LATEST=true ./03-audit.sh

# -------- 清空战区 --------
clean:
	@echo "\033[1;33m[~] 正在清空战区...\033[0m"
	@sudo rm -rf $(BASE_LOOT)/*
	@-docker rm -f $(CONTAINER) 2>/dev/null || true
	@echo "\033[1;32m[✓] 战区已重置，战车已回收。\033[0m"

# -------- 战区状态 --------
status:
	@echo ""
	@echo "\033[1;33m[~] CatTeam 战区状态报告\033[0m"
	@echo "──────────────────────────────────────"
	@echo -n "  当前端口配置: "; echo "\033[0;36m$(PROFILE)\033[0m"
	@echo -n "  历史任务数量: "; echo "\033[0;36m$$(ls -d $(BASE_LOOT)/[0-9]* 2>/dev/null | wc -l | tr -d ' ')\033[0m"
	@echo -n "  最新任务目录: "; \
	LATEST=$$(ls -dt $(BASE_LOOT)/[0-9]* 2>/dev/null | head -1); \
	if [ -n "$$LATEST" ]; then echo "\033[0;32m$$LATEST\033[0m"; else echo "\033[0;31m无\033[0m"; fi
	@echo -n "  战车状态:     "; \
	if docker ps --format '{{.Names}}' | grep -q "^$(CONTAINER)$$"; then echo "\033[0;32m运行中\033[0m"; \
	elif docker ps -a --format '{{.Names}}' | grep -q "^$(CONTAINER)$$"; then echo "\033[1;33m已停止\033[0m"; \
	else echo "\033[0;31m未部署\033[0m"; fi
	@# 显示最新任务内容
	@LATEST=$$(ls -dt $(BASE_LOOT)/[0-9]* 2>/dev/null | head -1); \
	if [ -n "$$LATEST" ]; then \
		echo ""; \
		echo "  \033[1;36m最新任务文件:\033[0m"; \
		ls -lh "$$LATEST" 2>/dev/null | tail -n +2 | while read line; do echo "    $$line"; done; \
	fi
	@echo ""

# -------- 无线打击预留接口 (V9.2 Alfa Pipeline) --------
wifi-mon:
	@echo "\033[1;33m[~] 此模块为 V9.2 预留：开启监视模式 (WLAN Monitor)...\033[0m"
	@if ! command -v airmon-ng &>/dev/null; then \
		echo '{"level":"FATAL","module":"wifi-mon","err_code":127,"msg":"airmon-ng 未安装"}' >&2; exit 127; \
	fi
	@echo "    等待物理 Alfa 网卡接入..."

wifi-deauth:
	@echo "\033[1;33m[~] 此模块为 V9.2 预留：发射反认证帧获取握手包...\033[0m"
	@if ! command -v aireplay-ng &>/dev/null; then \
		echo '{"level":"FATAL","module":"wifi-deauth","err_code":127,"msg":"aireplay-ng 未安装"}' >&2; exit 127; \
	fi
	@echo "    等待物理 Alfa 网卡接入..."
