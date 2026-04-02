#!/bin/bash
# ============================================================
#  CatTeam 影子军火库 — 交互式控制台 v5.0
#  用法: ./catteam.sh 或 make console
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh" 2>/dev/null || true

# ========== 色彩 ==========
R='\033[0;31m'; G='\033[1;32m'; Y='\033[1;33m'; C='\033[0;36m'; B='\033[1;34m'
DIM='\033[2m'; BOLD='\033[1m'; NC='\033[0m'

# ========== 状态检测 ==========
LOOT_LATEST="$SCRIPT_DIR/CatTeam_Loot/latest"

count_targets() {
    [ -f "$LOOT_LATEST/targets.txt" ] && wc -l < "$LOOT_LATEST/targets.txt" | tr -d ' ' || echo 0
}
count_hosts() {
    if [ -f "$LOOT_LATEST/live_assets.json" ]; then
        python3 -c "import json; d=json.load(open('$LOOT_LATEST/live_assets.json')); print(len(d.get('assets',{})))" 2>/dev/null || echo 0
    else echo 0; fi
}
count_success() {
    [ -f "$LOOT_LATEST/lateral_results.txt" ] && grep -c '^\[SUCCESS\]' "$LOOT_LATEST/lateral_results.txt" 2>/dev/null || echo 0
}
get_run_id() {
    if [ -L "$LOOT_LATEST" ]; then basename "$(readlink "$LOOT_LATEST")" 2>/dev/null || echo "none"
    else echo "none"; fi
}
has_file() { [ -f "$LOOT_LATEST/$1" ] && [ -s "$LOOT_LATEST/$1" ]; }
get_env() {
    local envfile="$SCRIPT_DIR/CatTeam_Loot/claw_env.txt"
    [ -f "$envfile" ] && cat "$envfile" 2>/dev/null || echo "default"
}

is_responder_running() {
    if [ -f "$LOOT_LATEST/responder.pid" ]; then
        local pid=$(cat "$LOOT_LATEST/responder.pid" 2>/dev/null)
        if [ -n "$pid" ] && ps -p "$pid" >/dev/null 2>&1; then
            return 0
        fi
    fi
    return 1
}

check_prereq() {
    local file="$1" desc="$2"
    if has_file "$file"; then echo -e "    ${G}[ok]${NC} $desc"; return 0
    else echo -e "    ${R}[--]${NC} $desc"; return 1; fi
}

# ========== 前置条件校验 ==========
prereq_gate() {
    local module="$1" all_ok=true
    echo ""; echo -e "  ${Y}[~] 前置条件检查:${NC}"
    case "$module" in
        probe)   check_prereq "targets.txt" "targets.txt (01-recon)" || all_ok=false ;;
        audit|web|nuclei) check_prereq "live_assets.json" "live_assets.json (02.5-parse)" || all_ok=false ;;
        crack)   check_prereq "captured_hash.txt" "captured_hash.txt (04-phantom)" || all_ok=false ;;
        lateral) check_prereq "live_assets.json" "live_assets.json (02.5-parse)" || all_ok=false
                 has_file "cracked_passwords.txt" || echo -e "    ${Y}[??]${NC} cracked_passwords.txt (可手动提供凭据)" ;;
        loot)    check_prereq "lateral_results.txt" "lateral_results.txt (06-psexec)" || all_ok=false ;;
        report)  check_prereq "live_assets.json" "live_assets.json" || all_ok=false ;;
        diff)    local count=$(find "$SCRIPT_DIR/CatTeam_Loot" -maxdepth 2 -name "live_assets.json" 2>/dev/null | wc -l | tr -d ' ')
                 if [ "$count" -lt 2 ]; then echo -e "    ${R}[--]${NC} 需要至少两次扫描 (当前: $count)"; all_ok=false
                 else echo -e "    ${G}[ok]${NC} $count 次扫描记录"; fi ;;
        *)       echo -e "    ${G}[ok]${NC} 无前置条件" ;;
    esac
    if [ "$all_ok" = false ]; then
        echo ""; echo -e "  ${R}[!] 前置条件不满足${NC}"
        echo -ne "  ${Y}是否仍要继续? (y/N): ${NC}"; read -r yn
        [ "$yn" = "y" ] || [ "$yn" = "Y" ] || return 1
    fi; return 0
}

# ========== 下一步建议 ==========
suggest_next() {
    echo ""; echo -e "  ${Y}[*] 建议下一步:${NC}"
    if ! has_file "targets.txt"; then
        echo -e "      -> 执行 ${G}1${NC}) 被动嗅探 或 ${G}2${NC}) 主动探活"
    elif ! has_file "nmap_results.xml"; then
        echo -e "      -> 执行 ${G}3${NC}) 端口扫描"
    elif ! has_file "live_assets.json"; then
        echo -e "      -> 等待解析 (02.5-parse 会自动执行)"
    elif ! has_file "web_fingerprints.txt"; then
        echo -e "      -> 执行 ${G}4${NC}) Web 指纹清扫"
        echo -e "      -> 或 ${G}6${NC}) 投毒陷阱 开始攻击链"
    elif ! has_file "captured_hash.txt"; then
        if is_responder_running; then
            echo -e "      -> ${CYAN}等待猎物上钩中... (Responder PID: $(cat "$LOOT_LATEST/responder.pid" 2>/dev/null) 驻守中)${NC}"
            echo -e "      -> 或执行 ${G}h${NC}) 查看其他战术可用动作"
        else
            echo -e "      -> 执行 ${G}6${NC}) 投毒陷阱 捕获凭据哈希"
        fi
    elif ! has_file "cracked_passwords.txt"; then
        echo -e "      -> 执行 ${G}7${NC}) 算力破解"
    elif ! has_file "lateral_results.txt"; then
        echo -e "      -> 执行 ${G}8${NC}) 横向移动"
    else
        echo -e "      -> 执行 ${G}13${NC}) AI 战术分析"
        echo -e "      -> 或 ${G}11${NC}) 生成战报"
    fi
}

# ========== 执行模块 ==========
run_module() {
    local name="$1"; shift
    echo ""
    echo -e "  ${C}------------------------------------------------------${NC}"
    echo -e "  ${BOLD}执行: $name${NC}"
    echo -e "  ${C}------------------------------------------------------${NC}"
    echo ""
    cd "$SCRIPT_DIR" && eval "$@"
    echo ""
    echo -e "  ${G}[+] $name 执行完毕${NC}"
    suggest_next
    echo ""
    if [ "${HEADLESS:-0}" = "0" ]; then
        echo -ne "  ${DIM}按回车返回主菜单...${NC}"
        read -r
    fi
}

# ========== 主菜单 ==========
show_menu() {
    echo ""
    echo -e "${B}  ======================================================${NC}"

    local targets=$(count_targets)
    local hosts=$(count_hosts)
    local success=$(count_success)
    local run_id=$(get_run_id)

    local S1="" S3="" S4="" S6="" S8=""
    has_file "targets.txt"          && S1="${DIM}[ok]${NC}" || S1="    "
    has_file "nmap_results.xml"     && S3="${DIM}[ok]${NC}" || S3="    "
    has_file "web_fingerprints.txt" && S4="${DIM}[ok]${NC}" || S4="    "
    has_file "captured_hash.txt"    && S6="${DIM}[ok]${NC}" || S6="    "
    has_file "lateral_results.txt"  && S8="${DIM}[ok]${NC}" || S8="    "

    echo ""
    echo -e "${C}         /\\_/\\  ${NC}"
    echo -e "${C}        ( o.o ) ${BOLD}Project CLAW${NC} ${G}v5.0${NC}"
    echo -e "${C}         > ^ <  ${DIM}CatTeam Lateral Arsenal Weapon${NC}"
    echo -e "${C}        /|   |\\ ${NC}"
    echo -e "${C}       (_|   |_)${NC} ${DIM}Codename: Lynx${NC}"
    echo ""
    echo -e "  ${B}------------------------------------------------------${NC}"
    echo -e "  ${DIM}Task:${NC}  ${C}${run_id}${NC}  ${DIM}Env:${NC} ${Y}$(get_env)${NC}"
    echo -e "  ${DIM}Recon:${NC} ${G}${targets}${NC} targets  ${G}${hosts}${NC} hosts  ${R}${success}${NC} pwned"
    echo -e "  ${B}------------------------------------------------------${NC}"
    echo ""
    echo -e "  ${BOLD}[侦察链]${NC}"
    echo -e "    ${G} 1${NC})  被动嗅探 (tcpdump ${RECON_TIME:-60}s)   $S1"
    echo -e "    ${G} 2${NC})  主动探活 (nmap -sn 跨网段)"
    echo -e "    ${G} 3${NC})  端口扫描                       $S3"
    echo ""
    echo -e "  ${BOLD}[审计层]${NC}"
    echo -e "    ${G} 4${NC})  Web 指纹清扫                   $S4"
    echo -e "    ${G} 5${NC})  Nuclei 漏洞扫描"
    echo ""
    echo -e "  ${BOLD}[攻击链]${NC}"
    echo -e "    ${G} 6${NC})  投毒陷阱 (Responder)           $S6"
    echo -e "    ${G} 7${NC})  算力破解 (Hashcat)"
    echo -e "    ${G} 8${NC})  横向移动 (Impacket)            $S8"
    echo -e "    ${R} 9${NC})  后渗透提取 ${R}[!需确认]${NC}"
    echo -e "    ${R}10${NC})  AD 域 Kerberoast"
    echo ""
    echo -e "  ${BOLD}[情报层]${NC}"
    echo -e "    ${G}11${NC})  生成战报 (Markdown)"
    echo -e "    ${G}12${NC})  资产变化检测"
    echo ""
    echo -e "  ${BOLD}[AI 副官]${NC}  ${DIM}Powered by Gemini Flash${NC}"
    echo -e "    ${G}13${NC})  AI 战术分析"
    echo -e "    ${G}14${NC})  问 Lynx (对话模式)"
    echo -e "    ${G}15${NC})  智能告警 (Diff + AI)"
    echo -e "    ${R}20${NC})  ${BOLD}🧠 CLAW Agent (智能体 v7.0)${NC}"
    echo ""
    # 读取最新 ROE_BYPASS 状态
    local current_roe="false"
    if grep -q 'export ROE_BYPASS="true"' "$SCRIPT_DIR/config.sh" 2>/dev/null; then current_roe="true"; fi
    local S_ROE="[ ${DIM}OFF${NC} ]"
    if [ "$current_roe" = "true" ]; then S_ROE="[ ${R}ON${NC} ]"; fi

    echo -e "  ${BOLD}[系统]${NC}"
    echo -e "    ${G}16${NC}) 切换环境  ${G}17${NC}) 战区状态  ${G}18${NC}) 清空战区"
    echo -e "    ${G}19${NC}) 靶场测试  ${C} r${NC}) 上帝模式 $S_ROE"
    echo -e "    ${C} s${NC}) 陷阱监控  ${C} h${NC}) 帮助文档  ${DIM} 0${NC}) 退出"
    echo ""
    echo -e "  ${B}------------------------------------------------------${NC}"
    echo ""
    echo -ne "  ${BOLD}CatTeam>${NC} "
}

# ========== 帮助 ==========
show_help() {
    echo ""
    echo -e "  ${B}======================================================${NC}"
    echo -e "  ${BOLD}Project CLAW v5.0 — 帮助文档${NC}"
    echo -e "  ${B}======================================================${NC}"
    echo ""
    echo -e "  ${BOLD}关于${NC}"
    echo -e "    Project CLAW (CatTeam Lateral Arsenal Weapon)"
    echo -e "    代号 Lynx — 模块化内网红队基础设施"
    echo -e "    AI 副官: Gemini 3 Flash | 数据引擎: SQLite"
    echo ""
    echo -e "  ${BOLD}快捷键${NC}"
    echo -e "    ${G}q${NC}  返回主菜单 (在任意子菜单中)"
    echo -e "    ${G}0${NC}  退出系统"
    echo -e "    ${G}h${NC}  显示此帮助"
    echo ""
    echo -e "  ${BOLD}典型工作流${NC}"
    echo -e "    1→3→4      侦察+扫描+指纹"
    echo -e "    6→7→8      投毒→破解→横移"
    echo -e "    13         AI 分析扫描结果"
    echo -e "    14         问 Lynx 任意安全问题"
    echo -e "    15         设置定时告警"
    echo ""
    echo -e "  ${BOLD}文档${NC}"
    echo -e "    架构设计    docs/ARCHITECTURE.md"
    echo -e "    作战手册    docs/OPERATIONS.md"
    echo -e "    开发路线    docs/ROADMAP.md"
    echo -e "    更新日志    CHANGELOG.md"
    echo -e "    导师交流    docs/advisor/"
    echo ""
    echo -e "  ${BOLD}环境隔离${NC}"
    echo -e "    切换靶场前按 ${G}16${NC}) 输入新环境名"
    echo -e "    diff/AI 只在同环境内比较，不会跨环境误报"
    echo ""
    echo -e "  ${BOLD}陷阱监控${NC}"
    echo -e "    使用 ${G}s${NC}) 键可实时查看 Responder 抓取状态"
    echo ""
    echo -e "  ${BOLD}OPSEC 提醒${NC}"
    echo -e "    实战模式:  ${C}CLAW_OPSEC=live python3 16-ai-analyze.py${NC}"
    echo -e "    API Key:   存于 config.sh (已加入 .gitignore)"
    echo ""
    echo -e "  ${B}======================================================${NC}"
    echo ""
    echo -ne "  ${DIM}按回车返回主菜单...${NC}"
    read -r
}

# ========== 主循环 ==========
main() {
    if [ $# -gt 0 ]; then
        export HEADLESS=1
        choice="$1"
        if [ "$choice" = "1" ]; then
            run_module "被动嗅探" "make recon"
        elif [ "$choice" = "2" ]; then
            export RECON_MODE=active
            export ACTIVE_CIDR=${2:-""}
            run_module "主动探活" "make recon"
        elif [ "$choice" = "3" ]; then
            export PROFILE=${2:-"default"}
            run_module "端口扫描 ($PROFILE)" "make fast PROFILE=$PROFILE"
        elif [ "$choice" = "4" ]; then
            run_module "Web 指纹清扫" "make web"
        elif [ "$choice" = "5" ]; then
            run_module "Nuclei 漏洞扫描" "make nuclei"
        elif [ "$choice" = "6" ]; then
            run_module "投毒陷阱" "make phantom"
        elif [ "$choice" = "7" ]; then
            run_module "算力破解" "make crack"
        elif [ "$choice" = "8" ]; then
            run_module "横向移动" "make lateral"
        elif [ "$choice" = "11" ]; then
            run_module "生成战报" "make report"
        elif [ "$choice" = "12" ]; then
            run_module "资产变化检测" "make diff"
        else
            echo "Headless mode does not support choice $choice natively yet."
        fi
        exit 0
    fi
    while true; do
        show_menu
        read -r choice
        case "$choice" in
            1)  prereq_gate "recon" && run_module "被动嗅探" "make recon" ;;
            2)  echo ""
                source "$SCRIPT_DIR/config.sh" 2>/dev/null
                DEFAULT_CIDR="${ACTIVE_CIDR:-}"
                if [ -n "$DEFAULT_CIDR" ]; then
                    echo -e "  ${DIM}从 config.sh 读取到默认子网:${NC} ${G}${DEFAULT_CIDR}${NC}"
                    echo ""
                elif [ -f "$SCRIPT_DIR/scope.txt" ]; then
                    SCOPE_LIST=$(grep -v '^#' "$SCRIPT_DIR/scope.txt" | grep -v '^\s*$' || true)
                    if [ -n "$SCOPE_LIST" ]; then
                        DEFAULT_CIDR=$(echo "$SCOPE_LIST" | head -1)
                        echo -e "  ${DIM}scope.txt 中的授权子网:${NC}"
                        echo "$SCOPE_LIST" | while read -r line; do
                            echo -e "    ${G}$line${NC}"
                        done
                        echo ""
                    fi
                fi
                if [ -n "$DEFAULT_CIDR" ]; then
                    echo -ne "  ${C}目标子网 [${DEFAULT_CIDR}] (回车=使用默认, q=返回): ${NC}"
                else
                    echo -ne "  ${C}目标子网 (如 10.140.0.0/24, 回车=返回): ${NC}"
                fi
                read -r cidr
                [ "$cidr" = "q" ] && continue
                [ -z "$cidr" ] && cidr="$DEFAULT_CIDR"
                [ -z "$cidr" ] && continue
                run_module "主动探活" "RECON_MODE=active ACTIVE_CIDR=$cidr make recon" ;;
            3)  echo ""
                echo -e "  ${C}扫描模板:${NC}"
                echo -e "   a) default  (7 常用端口)"
                echo -e "   b) iot      (11 IoT 端口)"
                echo -e "   c) full     (30 全面端口)"
                echo -ne "  ${BOLD}选择 (a/b/c, 回车=返回): ${NC}"
                read -r pc; [ -z "$pc" ] && continue
                case "$pc" in a) P="default";; b) P="iot";; c) P="full";; *) P="default";; esac
                prereq_gate "probe" && run_module "端口扫描 ($P)" "make fast PROFILE=$P" ;;
            4)  prereq_gate "web" && run_module "Web 指纹清扫" "make web" ;;
            5)  prereq_gate "nuclei" && run_module "Nuclei 漏洞扫描" "make nuclei" ;;
            6)  prereq_gate "phantom" && run_module "投毒陷阱" "make phantom" ;;
            7)  prereq_gate "crack" && run_module "算力破解" "make crack" ;;
            8)  prereq_gate "lateral" && run_module "横向移动" "make lateral" ;;
            9)  prereq_gate "loot" && run_module "后渗透提取" "make loot CONFIRM=--confirm" ;;
            10) echo ""
                echo -ne "  ${C}域控 IP (回车=返回): ${NC}"
                read -r dc_ip; [ -z "$dc_ip" ] && continue
                run_module "AD 域 Kerberoast" "sudo ./10-kerberoast.sh $dc_ip" ;;
            11) prereq_gate "report" && run_module "生成战报" "make report" ;;
            12) prereq_gate "diff" && run_module "资产变化检测" "make diff" ;;
            13) prereq_gate "audit" && run_module "AI 战术分析" "python3 $SCRIPT_DIR/16-ai-analyze.py" ;;
            14) run_module "问 Lynx" "python3 $SCRIPT_DIR/17-ask-lynx.py" ;;
            20) run_module "🧠 CLAW Agent" "python3 $SCRIPT_DIR/claw-agent.py" ;;
            15) echo ""
                echo -e "  ${C}------------------------------------------------------${NC}"
                echo -e "  ${BOLD}📡 告警日志查看器${NC}"
                echo -e "  ${C}------------------------------------------------------${NC}"
                echo ""
                ALERT_LOG="$SCRIPT_DIR/CatTeam_Loot/alerts/alerts.log"
                if [ -f "$ALERT_LOG" ]; then
                    ALERT_COUNT=$(wc -l < "$ALERT_LOG" | tr -d ' ')
                    echo -e "  ${G}[+] 共 $ALERT_COUNT 条告警记录${NC}"
                    echo ""
                    tail -n 20 "$ALERT_LOG" | while IFS= read -r line; do
                        echo -e "    ${DIM}$line${NC}"
                    done
                else
                    echo -e "  ${DIM}(暂无告警记录。运行 python3 11-webhook.py 生成告警)${NC}"
                fi
                echo ""
                ALERT_DIR="$SCRIPT_DIR/CatTeam_Loot/alerts"
                if [ -d "$ALERT_DIR" ]; then
                    ALERT_FILES=$(ls -1 "$ALERT_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ')
                    if [ "$ALERT_FILES" -gt 0 ]; then
                        echo -e "  ${Y}[~] 最近告警文件:${NC}"
                        ls -1t "$ALERT_DIR"/*.md 2>/dev/null | head -5 | while read -r f; do
                            echo -e "    ${DIM}$(basename "$f")${NC}"
                        done
                    fi
                fi
                echo ""
                echo -ne "  ${DIM}按回车返回主菜单...${NC}"
                read -r
                ;;
            16) echo ""
                echo -e "  ${C}------------------------------------------------------${NC}"
                echo -e "  ${BOLD}🌐 网络环境切换${NC}"
                echo -e "  ${C}------------------------------------------------------${NC}"
                echo ""
                echo -e "  ${W}[当前环境] $(get_env)${NC}"
                echo ""
                # 获取历史环境列表并编号
                ENV_LIST=$(python3 -c "
import sys; sys.path.insert(0,'$SCRIPT_DIR')
import db_engine
conn = db_engine.get_db()
envs = db_engine.list_envs(conn)
conn.close()
for i, (e, c) in enumerate(envs, 1):
    print(f'{i}|{e}|{c}')
" 2>/dev/null)
                if [ -n "$ENV_LIST" ]; then
                    echo -e "  ${Y}已有环境:${NC}"
                    echo "$ENV_LIST" | while IFS='|' read -r num name count; do
                        if [ "$name" = "$(get_env)" ]; then
                            echo -e "    ${G}[$num] $name ($count 次扫描) ← 当前${NC}"
                        else
                            echo -e "    ${DIM}[$num] $name ($count 次扫描)${NC}"
                        fi
                    done
                else
                    echo -e "  ${DIM}(无历史环境记录)${NC}"
                fi
                echo ""
                echo -e "  ${C}输入编号切换已有环境，或输入新名称创建新环境${NC}"
                echo -ne "  ${Y}选择 (回车=取消): ${NC}"
                read -r env_input
                if [ -n "$env_input" ]; then
                    # 判断是数字还是名称
                    if echo "$env_input" | grep -qE '^[0-9]+$'; then
                        # 数字: 从列表中选择
                        SELECTED=$(echo "$ENV_LIST" | sed -n "${env_input}p" | cut -d'|' -f2)
                        if [ -n "$SELECTED" ]; then
                            python3 -c "import sys; sys.path.insert(0,'$SCRIPT_DIR'); import db_engine; db_engine.set_current_env('$SELECTED')" 2>/dev/null
                            echo -e "  ${G}[+] 已切换至: $SELECTED${NC}"
                        else
                            echo -e "  ${R}[!] 无效编号${NC}"
                        fi
                    else
                        # 字符串: 创建新环境
                        python3 -c "import sys; sys.path.insert(0,'$SCRIPT_DIR'); import db_engine; db_engine.set_current_env('$env_input')" 2>/dev/null
                        echo -e "  ${G}[+] 已创建并切换至新环境: $env_input${NC}"
                    fi
                    sleep 1
                fi ;;
            17) run_module "战区状态" "make status" ;;
            18) echo -ne "  ${R}确认清空所有数据? (y/N): ${NC}"
                read -r yn; [ "$yn" = "y" ] && run_module "清空战区" "make clean" ;;
            19) run_module "靶场测试" "make test" ;;
            r|R)
                if grep -q 'export ROE_BYPASS="true"' "$SCRIPT_DIR/config.sh"; then
                    sed -i '' 's/export ROE_BYPASS="true"/export ROE_BYPASS="false"/' "$SCRIPT_DIR/config.sh"
                    echo -e "  ${DIM}[+] 已关闭上帝模式 (ROE_BYPASS=false)${NC}"
                elif grep -q 'export ROE_BYPASS="false"' "$SCRIPT_DIR/config.sh"; then
                    sed -i '' 's/export ROE_BYPASS="false"/export ROE_BYPASS="true"/' "$SCRIPT_DIR/config.sh"
                    echo -e "  ${R}[!] 已开启上帝模式 (ROE_BYPASS=true)，越权探测启动！${NC}"
                else
                    echo 'export ROE_BYPASS="true"' >> "$SCRIPT_DIR/config.sh"
                    echo -e "  ${R}[!] 已开启上帝模式 (已追加 ROE_BYPASS=true 到 config.sh)！${NC}"
                fi
                sleep 1
                ;;
            s|S)
                echo ""
                echo -e "  ${C}------------------------------------------------------${NC}"
                echo -e "  ${BOLD}陷阱监控 (Responder 状态)${NC}"
                echo -e "  ${C}------------------------------------------------------${NC}"
                echo ""
                if is_responder_running; then
                    echo -e "  ${G}[+] Responder 正在后台驻守监听 (PID: $(cat "$LOOT_LATEST/responder.pid" 2>/dev/null))${NC}"
                else
                    echo -e "  ${R}[-] Responder 当前未运行。${NC}"
                fi
                echo ""
                echo -e "  ${Y}[~] 最近 15 条嗅探日志 (responder_raw.log):${NC}"
                if [ -f "$LOOT_LATEST/responder_raw.log" ]; then
                    tail -n 15 "$LOOT_LATEST/responder_raw.log" | while read -r line; do echo -e "      ${DIM}$line${NC}"; done
                else
                    echo -e "      ${DIM}(无日志)${NC}"
                fi
                echo ""
                echo -e "  ${Y}[~] 战利品 (captured_hash.txt):${NC}"
                if has_file "captured_hash.txt"; then
                    cat "$LOOT_LATEST/captured_hash.txt" | while read -r line; do echo -e "      ${G}$line${NC}"; done
                else
                    echo -e "      ${DIM}(暂无猎物获取凭据)${NC}"
                fi
                echo ""
                echo -ne "  ${DIM}按回车返回主菜单...${NC}"
                read -r
                ;;
            h|H|help) show_help ;;
            0|q|exit|quit) echo -e "\n  ${G}[+] 安全撤退。再见，指挥官。${NC}\n"; exit 0 ;;
            "") continue ;;
            *)  echo -e "\n  ${R}[!] 无效指令${NC}"; sleep 1 ;;
        esac
    done
}

main "$@"
