#!/usr/bin/env python3
"""
🧠 CatTeam AI-Hound: BloodHound JSON → Gemini 图论推理引擎

功能: 读取 10-kerberoast.sh 生成的 BloodHound JSON 数据,
     利用 Gemini 大模型的超长上下文进行 AD 域提权路径推理。

用法: python3 18-ai-bloodhound.py [bloodhound_zip_or_dir]
"""

import sys, os, json, glob, zipfile, io

# === 色彩 ===
G="\033[1;32m"; R="\033[0;31m"; Y="\033[1;33m"; C="\033[0;36m"
P="\033[1;35m"; W="\033[1;37m"; DIM="\033[2m"; NC="\033[0m"

# === 配置 ===
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3-flash")
GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "")

SYSTEM_PROMPT = """你是一位顶级 Active Directory 域安全分析师 (代号: AI-Hound 🐕)。
你将收到 BloodHound 导出的 AD 域拓扑数据 (JSON 格式, 包含 Users, Groups, Computers, Sessions, ACLs 等节点和边)。

你的任务:
1. 分析域拓扑结构, 识别所有特权用户和组 (Domain Admins, Enterprise Admins 等)
2. 从当前已控主机/用户出发, 规划到 Domain Admin 的最短提权路径
3. 识别高危 ACL 配置 (如 GenericAll, WriteDACL, ForceChangePassword)
4. 识别 Kerberoastable 账户和 AS-REP Roastable 账户
5. 给出具体的攻击步骤和使用的工具 (Impacket, Rubeus 等)

输出格式:
- 先给出拓扑摘要 (多少用户/计算机/组)
- 然后给出推荐的攻击路径 (编号步骤)
- 最后给出风险评估和建议
"""


def load_bloodhound_data(path):
    """加载 BloodHound JSON 数据 (支持 ZIP 和目录)"""
    data = {}

    if os.path.isfile(path) and path.endswith(".zip"):
        print(f"  {C}[~] 从 ZIP 文件加载: {path}{NC}")
        with zipfile.ZipFile(path, "r") as zf:
            for name in zf.namelist():
                if name.endswith(".json"):
                    key = os.path.splitext(os.path.basename(name))[0]
                    with zf.open(name) as f:
                        try:
                            data[key] = json.load(f)
                            count = len(data[key].get("data", data[key].get("nodes", [])))
                            print(f"  {G}[+] {key}: {count} 条记录{NC}")
                        except json.JSONDecodeError:
                            print(f"  {Y}[!] {key}: JSON 解析失败{NC}")

    elif os.path.isdir(path):
        print(f"  {C}[~] 从目录加载: {path}{NC}")
        for fpath in sorted(glob.glob(os.path.join(path, "*.json"))):
            key = os.path.splitext(os.path.basename(fpath))[0]
            try:
                with open(fpath, "r") as f:
                    data[key] = json.load(f)
                    count = len(data[key].get("data", data[key].get("nodes", [])))
                    print(f"  {G}[+] {key}: {count} 条记录{NC}")
            except (json.JSONDecodeError, IOError) as e:
                print(f"  {Y}[!] {key}: {e}{NC}")
    else:
        print(f"  {R}[!] 路径不存在或格式不支持: {path}{NC}")
        print(f"  {DIM}    支持: .zip 文件 或 包含 JSON 的目录{NC}")
        sys.exit(1)

    if not data:
        print(f"  {R}[!] 未找到任何 BloodHound JSON 数据{NC}")
        sys.exit(1)

    return data


def build_prompt(data):
    """将 BloodHound 数据拼接为 Prompt"""
    prompt_parts = ["以下是 BloodHound 导出的 AD 域拓扑数据:\n"]

    total_chars = 0
    max_chars = 800000  # 留余量给系统 Prompt 和回复

    for key, content in data.items():
        chunk = f"\n=== {key.upper()} ===\n{json.dumps(content, indent=1, ensure_ascii=False)}\n"
        if total_chars + len(chunk) > max_chars:
            prompt_parts.append(f"\n[⚠️ {key} 数据因上下文限制被截断]")
            break
        prompt_parts.append(chunk)
        total_chars += len(chunk)

    prompt_parts.append("\n请基于以上数据, 为我规划从当前已控位置到 Domain Admin 的最短提权路径。")
    return "".join(prompt_parts)


def call_gemini(system_prompt, user_prompt):
    """调用 Gemini API"""
    import urllib.request, ssl

    if not GEMINI_KEY:
        print(f"  {R}[!] 请设置 GEMINI_API_KEY 环境变量{NC}")
        sys.exit(1)

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_KEY}"

    payload = {
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"parts": [{"text": user_prompt}]}],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 4096
        }
    }

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})

    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=120, context=ctx) as resp:
            result = json.load(resp)
            candidates = result.get("candidates", [])
            if candidates:
                return candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
            return "[模型未返回内容]"
    except Exception as e:
        return f"[API 调用失败: {e}]"


def main():
    print(f"""
{P}╔══════════════════════════════════════════════════════════╗
║  {W}🧠 CatTeam AI-Hound — AD 域提权路径推理引擎{P}           ║
║  {C}BloodHound JSON → Gemini 图论推理{P}                     ║
║  {DIM}⚠️  仅供授权安全测试{P}                                  ║
╚══════════════════════════════════════════════════════════╝{NC}
""")

    # 确定数据路径
    if len(sys.argv) > 1:
        path = sys.argv[1]
    else:
        # 自动搜索 CatTeam_Loot 中的 BloodHound 数据
        loot_dir = os.path.join(os.path.dirname(__file__), "CatTeam_Loot")
        candidates = sorted(glob.glob(os.path.join(loot_dir, "**/*bloodhound*"), recursive=True))
        candidates += sorted(glob.glob(os.path.join(loot_dir, "**/*.zip"), recursive=True))

        if candidates:
            path = candidates[-1]
            print(f"  {C}[~] 自动发现: {path}{NC}")
        else:
            print(f"  {Y}[!] 未找到 BloodHound 数据{NC}")
            print(f"  {DIM}    用法: python3 18-ai-bloodhound.py <bloodhound.zip 或目录>{NC}")
            print(f"  {DIM}    提示: 先运行 10-kerberoast.sh 生成数据{NC}")
            sys.exit(1)

    # 加载数据
    print(f"\n  {W}━━━ Phase 1: 数据加载 ━━━{NC}")
    data = load_bloodhound_data(path)

    # 构建 Prompt
    print(f"\n  {W}━━━ Phase 2: 构建推理 Prompt ━━━{NC}")
    user_prompt = build_prompt(data)
    token_est = len(user_prompt) // 4
    print(f"  {G}[+] Prompt 长度: {len(user_prompt):,} 字符 (~{token_est:,} Tokens){NC}")

    # 调用 Gemini
    print(f"\n  {W}━━━ Phase 3: Gemini 图论推理 ━━━{NC}")
    print(f"  {C}[~] 正在调用 {GEMINI_MODEL}，请稍候...{NC}\n")

    response = call_gemini(SYSTEM_PROMPT, user_prompt)

    print(f"  {W}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{NC}")
    print(f"  {P}🐕 AI-Hound 分析报告:{NC}")
    print(f"  {W}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{NC}\n")
    print(response)
    print(f"\n  {DIM}AI-Hound 分析完毕 🐱{NC}\n")


if __name__ == "__main__":
    main()
