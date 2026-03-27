import re

# 1. Update CONVENTIONS.md
with open("docs/CONVENTIONS.md", "r") as f:
    text = f.read()
text = re.sub(r"\*\*版本：\*\* 2\.3\n\*\*最后更新：\*\* 2026-03-27\n", r"**版本：** 3.0\n**最后更新：** 2026-03-27\n", text)
text = re.sub(r"\*\*当前版本：V8\.2 / A2\.1\*\*", r"**当前版本：V9.0 / A2.1**", text)
text = re.sub(r"\| \*\*V8\.2\*\* \| \*\*MCP.*?\n", r"| **V8.2** | **MCP 架构 + OP 流式流水线 + UI 全面审计 + Emoji→SVG**|\n| **V9.0** | **The Commander's HUD + OSINT 语义特工 + TUI 武库融合**|\n", text)
text = re.sub(r"CONVENTIONS\.md v2\.3", r"CONVENTIONS.md v3.0", text)
with open("docs/CONVENTIONS.md", "w") as f:
    f.write(text)

# 2. Update ROADMAP.md
with open("docs/ROADMAP.md", "r") as f:
    text = f.read()
text = re.sub(r"\*\*最后更新：\*\* 2026-03-27 V8\.2 / A2\.1", r"**最后更新：** 2026-03-27 V9.0 / A2.1", text)
text = text.replace("[ ] **全栈指挥官视窗 (The Commander's HUD)**", "[x] **全栈指挥官视窗 (The Commander's HUD)**")
text = text.replace("[ ] **Deep Research ✖️ 语义密码图谱**", "[x] **Deep Research ✖️ 语义密码图谱**")
text = text.replace("## 🔮 未来计划 (Planned)", "## 🔮 未来计划 (Planned)\n\n### 🌟 V10-alpha — 多智能体分布式渗透 (Planned)\n> 预留占位区。")
text = text.replace("### 🌟 V9.0 — 全栈智能大屏", "### ⭐ V9.0 — 全栈智能大屏")
text = re.sub(r"## ✅ 已完成版本", r"## ✅ 已完成版本\n\n### ⭐ V9.0 — 全栈智能大屏 (03-27) ← 当前版本\n\n> **聚焦单兵作战环境下的全维自主渗透。依托极简硬件 (单本+Alfa网卡)，将大屏彻底升级为 G.I. (Generative Interface) 时代的智控终端，建立【领航域】+【情境沙盒】+【AI 参谋部】三段式指挥范式。**\n\n**【🔴 完工基座：底层引擎重构与多模态战斧 (Phases 12-14)】**\n- [x] **原生 Interactions API (长程记忆)**\n- [x] **云端免杀代码沙箱 (CodeExecution)**\n- [x] **ReAct 引擎防熔断 (State Continuum)**\n- [x] **Pydantic 认知图谱蒸馏 (Phase 13)**\n- [x] **A2UI ✖️ 视觉自我博弈 (Phase 14)**\n\n**【🔴 完工模块：全栈交互补全与 OSINT 特工 (Phases 15-16)】**\n- [x] **全栈指挥官视窗 (The Commander's HUD)**：正式废弃枯燥独立的 OP 遥控面板。引入顶部【点亮式全局战役线】导航，改造中部资产大盘为【支持多选框 + 悬浮武库弹窗】的战术图表沙盒。\n- [x] **Deep Research ✖️ 语义密码图谱**：新增 `/api/v1/agent/osint` 后端直连，大模型提炼为致密的近源特定密码本（<500词），供 Alfa 空爆秒收。\n", text)
text = re.sub(r"### ⭐ V8\.2 — 流式作战流水线 \(03-27\) ← 当前版本", r"### ⭐ V8.2 — 流式作战流水线 (03-27)", text)
with open("docs/ROADMAP.md", "w") as f:
    f.write(text)

# 3. Update CHANGELOG.md
with open("CHANGELOG.md", "r") as f:
    text = f.read()
changelog_entry = """## [V9.0 / A2.1] — 2026-03-27 ⭐ 全栈智能指挥大盘 (Phase 15 & 16)

### 🛸 界面重构：指挥官的战术沙盒 (The Commander's HUD)
- **全局战术管线 (CampaignPipeline)**: 废除分散的菜单与页面。将整个渗透进程凝聚在顶部发光管线 (`战区锚定` → `射频嗅探` → `脆弱性指纹` → `Alfa 注入` → `战报生成`)。并且去除了违规 Emoji，替换为 `lucide-react` SVG 标准合规版。
- **微观多选火力网 (Micro-Swarming Checkboxes)**: 资产卡片现已支持 Checkbox 多选。
- **悬浮战术武库 (Tactical Armory)**: 在沙盒选中资产后，原有的 TUI 打击能力 (36个核心利用模块) 直接从悬浮动作栏通过 `<TacticalArmoryModal>` 华丽复活！完美结合了界面操作的快感与实弹代码的摧毁力。

### 🧠 兵工厂融合与 OSINT 降维打击
- **`/api/v1/agent/osint` 端点**: 彻底贯通后端 `google.genai`。根据选定的机器属性当场生成10-20条贴脸级的靶向密码字典。
- **矩阵极客终端 (`OsintTerminalModal`)**: 在生成字典时接管前端视野，使用步进式的 Hacker 行动字幕。输出格式被 Pydantic 硬性约束为 JSON Array。
- **历史缝合**: 完全补齐了 V8 时期由 `OperationPipeline` 分发的 `./catteam.sh` 集成武器，通过新的 Fetch 底层发往 `/api/v1/ops/run`。

---

"""
text = text.replace("## [V8.2 / A2.1]", changelog_entry + "## [V8.2 / A2.1]", 1)
with open("CHANGELOG.md", "w") as f:
    f.write(text)

# 4. Update README.md
with open("README.md", "r") as f:
    text = f.read()
text = text.replace("Project CLAW V8.2", "Project CLAW V9.0")
text = text.replace("Weapon V8.2", "Weapon V9.0")
text = text.replace("badge/V8.2", "badge/V9.0")
text = text.replace("badge/AI-Gemini%203%20Flash", "badge/AI-Gemini%203.1%20Pro")
text = text.replace("V8.2 (MCP + 流式流水线)", "V8.2 (MCP + 流式流水线) \\n     → V9.0 (全栈智能指挥大盘)")
with open("README.md", "w") as f:
    f.write(text)

print("Synchronized all docs!")
