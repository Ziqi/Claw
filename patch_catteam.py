import sys

with open("catteam.sh", "r") as f:
    lines = f.readlines()

new_lines = []
in_main = False
for line in lines:
    if line.startswith("main() {"):
        new_lines.append(line)
        new_lines.append("""    if [ $# -gt 0 ]; then
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
""")
    else:
        new_lines.append(line)

with open("catteam.sh", "w") as f:
    f.writelines(new_lines)
