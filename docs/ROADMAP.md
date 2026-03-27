# 🐱 CatTeam 开发路线图 (Roadmap)

**最后更新：** 2026-03-28 V9.1 / A2.2  

---

## 版本演进全景

```
V1.0 (03-24)  ━━  V2.0 (03-25)  ━━  V3.0 (03-25)  ━━  V4.0 (03-25)  ━━  V5.0 (03-25)  ━━  V7.0 (03-25)  ━━  V8.0-α (03-26)  ━━  V8.2 (03-27)  ━━  V9.0 (Planned)
  基础链           工程化           攻击链           合规/AD/TUI       SQLite+AI       Agentic AI       Web Dashboard     流式工作台        多智能体+图谱
```

---

## 🔮 未来计划 (Planned)

### 🌟 V10-alpha — 多智能体分布式渗透 (Planned)
> 预留占位区。

### ⭐ V9.0 — 全栈智能大屏 (Generative Interface Era) & D14/D15 架构落地
> **聚焦单兵作战环境下的全维自主渗透。依托极简硬件 (单本+Alfa网卡)，将大屏彻底升级为 G.I. (Generative Interface) 时代的智控终端，建立【领航域】+【情境沙盒】+【AI 参谋部】三段式指挥范式。**

**【🔴 已完工基座：底层引擎重构与多模态战斧 (Phases 12-14)】**
- [🔄偏离执行] **跨版本状态机平替 (Interactions API)**：D14 要求 `client.interactions`，因 SDK 不支持，改用 `client.chats.create` 手写上下文栈模拟。
- [❌重大遗漏] **云端免杀代码沙箱 (CodeExecution)**：D14 要求 `types.Tool(code_execution=...)`，但 V9 未予开发挂载。
- [🔄偏离执行] **ReAct 引擎护城河 (State Continuum)**：采用第 15 步截断 `tools=[]` 强制总结，而非深度修改底层状态机。
- [✅彻底对齐] **Pydantic 认知图谱蒸馏 (Structured Output)**：强制大模型按 `AttackGraph` 结构输出 JSON，彻底消灭渲染挂死。
- [✅彻底对齐] **A2UI ✖️ 零日欺骗落地 (Phase 14)**：实装假页面提纯投递，并[➕新增]落盘持久化至实体兵工厂。
- [❌重大遗漏] **视觉自我博弈循环**：Playwright 无头浏览器渲染并多模态喂图截断环节未开发。
- [🔄偏离执行] **轻量图谱降维 (GraphRAG Light)**：彻底去除 Neo4j，采用在前端跑 NetworkX 内存状态全替换。

**【⏳ 待开工模块与 V9.1 架构偿债 (Phases 15-16)】**
- [✅彻底对齐] **全栈指挥官视窗 (The Commander's HUD)**：正式废弃枯燥独立的 OP 遥控面板。引入顶部【点亮式全局战役线】，左翼隔离武库，右翼 AI 参谋部。
- [❌核心欠债] **全局多选准星 (Global Target Reticle)**：长期未开发的 P0 债。目前独立武库由于缺乏此跨页多选状态管线，陷入单机盲狙陷阱。V9.2 首要任务！
- [🔄偏离执行] **Deep Research ✖️ 语义密码图谱**：采用一般级 Flash 大模型及 Pydantic 下发，在 `/api/v1/agent/osint` 端点直连，未拉起深层次纯后台模型。
- [➕超纲新增] **战区物理隔离 (Theater Manager)**：为防靶场内网跨界污染，强制新增 SQLite 环境层隔离。
- [➕超纲新增] **C2 控制流 (Sliver Integration)**：越过原设计，新增前端 React C2 面板预留位。

---

## ✅ 已完成版本

### ⭐ V9.1 — Hacker Copilot 护城河加固 (03-28) ← 当前版本

> **专注解决底层 API 的状态丢失、SSE 渲染挂死，并建立起一套对抗内容审查的云端搜索体系。**

**【🔴 完工模块：底层护城河与原生云能力】**
- [x] **记忆管线重构 (State Continuum)**：在 `agent_mcp.py` 通过 SQLite `mcp_messages` 表级联，实现了原生的 `types.Content` 无状态会话完美持久化重构。
- [x] **原生沙盒与全网雷达 (GoogleSearch + CodeExecution)**：开启云端 Python 沙盒并外接原生搜索，配合 `SYSTEM_PROMPT` 人格注入，全面突破平台安全审查。
- [x] **隐式提权指令 (Sudo Bypass)**：彻底移除终端截盘输入，通过 HUD Keyring 和进程切片下发，实现全自动渗透闭环。
- [x] **通信稳定器 (SSE Resiliency)**：结构化 JSON 心跳包全面替代原有的空注释流，解决了长时间推演时的 503 报错丢失或假死。

### ⭐ V9.0 — 全栈智能大屏 (03-27)

> **聚焦单兵作战环境下的全维自主渗透。依托极简硬件 (单本+Alfa网卡)，将大屏彻底升级为 G.I. (Generative Interface) 时代的智控终端，建立【领航域】+【情境沙盒】+【AI 参谋部】三段式指挥范式。**

**【🔴 完工基座：底层引擎重构与多模态战斧 (Phases 12-14)】**
- [x] **原生 Interactions API (长程记忆)**
- [x] **云端免杀代码沙箱 (CodeExecution)**
- [x] **ReAct 引擎防熔断 (State Continuum)**
- [x] **Pydantic 认知图谱蒸馏 (Phase 13)**
- [x] **A2UI ✖️ 视觉自我博弈 (Phase 14)**

**【🔴 完工模块：全栈交互补全与 OSINT 特工 (Phases 15-16)】**
- [x] **全栈指挥官视窗 (The Commander's HUD)**：正式废弃枯燥独立的 OP 遥控面板。引入顶部【点亮式全局战役线】导航，改造中部资产大盘为【支持多选框 + 悬浮武库弹窗】的战术图表沙盒。
- [x] **Deep Research ✖️ 语义密码图谱**：新增 `/api/v1/agent/osint` 后端直连，大模型提炼为致密的近源特定密码本（<500词），供 Alfa 空爆秒收。


### ⭐ V8.2 — 流式作战流水线 (03-27)

> **彻底组件化原有的 CLI 流程编排，实现实时反馈的全量级操作流水线。**

**Sprint 2: 流程引擎与流式输出**
- **OP 作战面板**: 取代原有分散在 Console 或者通过 CLI 键入命令的操作方式，提供 ① 侦察 → ② 扫描 → ③ 审计 → ④ 攻击 → ⑤ 报告 的 5 阶段工作流可视化面板。
- **SSE 流式回显**: 后端新增 `ops/run` 与 `ops/log` 接口，底层调起 `subprocess.Popen` 长进程后使用 Server-Sent Events 无延迟投递 stdout 与 stderr 到前端 Output Console。
- **实战流数据馈送**: Recon 侦察面板结构重组，新增右上角的实时威胁动态流，为后续红方作业或者告警审计提供全景化信息源。

### v1.0 — 首次发布 (03-24)

基础侦察链闭环：
- 00-armory (DHCP 换脸) → 01-recon (被动嗅探) → 02-probe (Nmap 扫描) → 02.5-parse (XML→JSON) → 03-audit (httpx)
- Makefile v1.0 中控引擎
- `set -euo pipefail` + trap 清理

### v2.0 — 系统级现代化 (03-25)

- `config.sh` 统一配置中心
- 时间戳任务目录 + `latest` 软链接
- `log()` 双写、`preflight` 飞行前预检
- 03-audit-web.py (纯 Python httpx)、03-exploit-76.py (VNC/SMB 精准打击)
- Dockerfile v1 → v2 (Impacket 焊入镜像)

### v3.0 — 攻击链扩展 (03-25)

完整投毒→破解→横移杀伤链：
- 04-phantom (Responder 投毒, Mac 原生)
- 05-cracker (Hashcat 离线破解, GPU)
- 06-psexec (Impacket smbexec 横向移动)

### v3.1 — 情报层 + 安全加固 (03-25)

- 07-report.py (Markdown 战报自动生成)
- 08-diff.py (资产变化检测)
- OPSEC: 06 禁止命令行密码、04 僵尸进程清理

### v4.0 — 合规/侦察升维/AD 域链 (03-25)

**Sprint 1: 合规与基建**
- `scope.txt` ROE 白名单 (多 CIDR)
- `scripts/scope_check.py` ipaddress 交集校验
- `tests/` Docker Compose 自动化靶场 (DVWA + Samba)

**Sprint 2: 侦察升维**
- 01-recon 双模式 (passive + active via Docker nmap -sn)
- Dockerfile v3 + Nuclei (枪弹分离架构)

**Sprint 3: 后渗透 + AD 域**
- 09-loot.sh (secretsdump + smbclient, --confirm 安全阀)
- 10-kerberoast.sh (GetUserSPNs + BloodHound)

**交互式控制台**
- `catteam.sh` TUI 交互菜单 (`make console`)
- ASCII+ANSI 样式、实时状态栏、前置条件校验

**平台升级**
- Dockerfile v3: Nuclei 已焍入
- config.sh: IMAGE_NAME 切换至 v3

### v5.0 — SQLite 数据层 + AI 副官 (03-25)

**Phase 1: SQLite 双写架构**
- `db_engine.py` — 四张表 (scans/assets/ports/vulns) + scan_id 隔离
- `02.5-parse.py` — 双写: SQLite (claw.db) + JSON (live_assets.json)
- `08-diff.py` v5.0 — SQL EXCEPT 差异引擎 + JSON 兼容 fallback

**Phase 2: AI 智能副官 (Gemini Flash)**
- `16-ai-analyze.py` — 战术分析 (SQLite → Prompt → Gemini → 建议)
- `17-ask-lynx.py` — 多轮对话 (自动携带扫描上下文, 滑动窗口 10 轮)
- `catteam.sh` v5.0 — [AI 副官] 菜单 (13/14)
- OPSEC 脱敏层 + config.sh AI 配置段
- `.gitignore` 保护 API Key

**Phase 3: 智能告警引擎**
- `11-webhook.py` — 自动 Diff → AI 分析 → 本地告警 + macOS 通知
- 告警存储至 `CatTeam_Loot/alerts/`
- 支持 `--cron` 静默轮询机制

**Phase 4: TUI 优化与底层架构修复 (v5.0.1)**
- 菜单支持环境隔离，并在控制台状态栏输出 `Env: ...`
- 新增 `r) 上帝模式` 动态绕过 ROE 授权的物理开关
- 新增 `s) 陷阱监控` 一键查看 Responder 进程状态和捕获的 Hash
- 修复 `suggest_next` 建议引擎，精准识别后台 Responder 驻守状态
- 全局解耦底层脚本硬编码序号，统一改用语义化模块名
- 修复 AI 情报截断 Bug：过滤 `[FAIL]` 垃圾数据，确保 TP-Link 等高价值目标不被 3000 字符限制吞没
- 彻底解决 Web 指纹与 SQLite ID 的时序不一致 (Session Mismatch)
- 自动化处理 `Responder` 原生克隆及相对路径映射

---

## ⭐ V7.0 — Agentic AI 智能体 (03-25)

> **这是 Project CLAW 从 Copilot 升级为 Agentic AI 的里程碑。**

**A1.0 (M1): 只读智能体**
- `claw-agent.py` — Gemini 3 Interactions API, ReAct Loop
- 3 只读工具: claw_query_db / claw_read_file / claw_list_assets
- 服务端状态管理 (previous_interaction_id)

**A2.0 (M2): 带锁执行者**
- 2 执行工具: claw_execute_shell / claw_run_module
- HITL 三级分权: 🟢 GREEN 自动 / 🟡 YELLOW [Y/n] / 🔴 RED CONFIRM
- 流式输出: Popen 实时打印 + sudo 透传
- `catteam.sh` 菜单 20) CLAW Agent

**工程治理:**
- CONVENTIONS.md v2.0: 三轨版本号 (V/A/D) + 强制文档同步
- Docker V4 镜像 (Nuclei v3.7.1 + binwalk)

---

## ⭐ V8.0.1 — 交互重构 + 实弹就绪 (03-27)

> **将看板型 UI 升级为交互式作战平台。全面消除 UX 冗余，武器库扩充至 36 模块。**

### ✅ Sprint 4: 交互重构 (已完成)

- Sidebar 从冗余 IP 列表改为筛选/探测面板 (搜索+风险+端口过滤)
- 删除 AG Tab、AT 子 Tab (端口暴露面)，合并审计日志至 RC
- 代码块可操作 (📋 复制 / ▶ 执行)，Console OUTPUT/DEBUG Tab 功能化
- Docker 云端战车: 实时镜像/容器状态 + Web 端启停控制
- 武器库 36 模块: 含 MSF/Hashcat/John/Hydra/Responder/Aircrack-ng/Binwalk 等
- Agent 工具修复: read_file 路径回退、run_module 自动补全、参数名兼容
- 拓扑图节点可点击、ATT&CK 矩阵技术卡可点击

---

## V8.0-alpha — 全栈作战平台 (03-26)

> **Phase 1 黎明中枢已交付。从 CLI 工具集升级为 B/S 三层架构作战平台。**

### ✅ Phase 1: 黎明中枢 (已完成)

**后端 (FastAPI):**
- `backend/main.py` — 5 个 REST API 端点
- `/api/v1/stats` / `assets` / `scans` / `audit` / `agent/chat`
- SQLite claw.db 直接查询, CORS, 分页搜索

**前端 (React + Vite):**
- Bloomberg Terminal 彭博终端级 UI
- HUD 状态栏 (Hosts/Ports/Vulns/Scans/实时时钟)
- Activity Bar (RC/AT/AM/C2/VS) + 威胁热力图 + 筛选面板
- AI Copilot 面板: 拖拽缩放 / 模型选择器 (Flash/Pro/Deep) / 流式打字 / 快捷指令
- 网络拓扑图 (vis.js 力导向, 风险着色, 点击查看)

**设计规范:**
- 纯黑 #000 / 零圆角 / 琥珀金 #FF9900 + 青色 #00FFFF / Consolas 等宽

### 🚧 Phase 2: 核爆行动 (72h 冲刺, D10 批准)

**Sprint 1: 重构中枢 — Interactions API 全面迁移**
- 抛弃 `generateContent`，全面接入 Gemini 3 Interactions API
- SQLite 存储 `previous_interaction_id`，服务端自动管理 1M 上下文
- Thought Signatures 由 Google 服务端自动累积，清除技术债
- 底层脚本用 `asyncio.create_subprocess_exec` 包装为 Worker Task

**Sprint 2: 结构化枷锁 — Pydantic Schema 强制 JSON 决策树**
- 强制 Agent 输出 `{thought, action_tool, mitre_ttp, justification, risk_level}` JSON
- 实现 Risk-Aware Dynamic Cognitive Routing (thinking_level 联动 HITL)
- RED 级操作触发 `thinking_level="high"` 自我反思

**Sprint 3: SSE 桥梁 — @microsoft/fetch-event-source**
- FastAPI `/api/agent/stream` SSE 端点
- 前端 `@microsoft/fetch-event-source` 替代原生 EventSource（支持 POST + JWT）
- 思维链折叠树 (React Tree) 实时渲染

### 🚧 Phase 3: 全域作战 (D10 批准)

**对话持久化:**
- SQLite conversations/messages 表 + Campaign ID
- Copilot 顶部 `[+新建对话]` + `[📜历史]`
- 配合 Interactions API 服务端状态继承

**交互增强:**
- `Cmd+K` 全局 Spotlight 搜索
- Context-Aware Chips (点击不同资产动态变化)
- Action Token Challenge 质询 (输入 IP 最后一段确认)

**可视化:**
- P0: Agent 思维链折叠树 (React Tree)
- P0: ATT&CK 热力矩阵 (CSS Grid)
- P1: 力导向图网络拓扑 (Vis.js)

### 🚧 Phase 4: C2 集成与情报 (计划中)
- Sliver C2 gRPC API 接入 + Session 管理
- Ligolo-ng 隧道管理界面
- Deep Research Agent (异步 OSINT Delegation)
- Eavesdropping Shell (xterm.js 人机共驾)
- 渗透报告一键生成 (PTES/OWASP)

### 待用户操作的环境依赖项

| 编号 | 任务 | 前置条件 |
|---|---|---|
| T1 | `make test` 靶场验证 | 需 `docker pull` |
| ~~T2~~ | ~~Dockerfile V4 构建~~ | ✅ 已完成 |
| ~~T3~~ | ~~Nuclei 模板更新~~ | ✅ 已完成 |
| T4 | 01-recon active 实测 | 需靶场网络 |
| T5 | 09-loot / 10-kerberoast 实测 | 需 AD 域控靶机 |

---

## 🚀 v6.0 远期规划 (导师已定调)

### P1: 隧道穿透 (导师批准)
- **Ligolo-ng** / Chisel (TUN 虚拟网卡, 不用 Proxychains)
- 'route add' 级别的全流量代理

### P2: AI + BloodHound (方案 C)
- 不装 Neo4j——直接喂 Gemini 1M 上下文做图论推理
- "从当前用户到 Domain Admin 的最短路径"

### ~~P3: Webhook 告警~~ ✅ 已在 V5.0 实现
- ~~`11-webhook.py` + cron 定时扫描~~
- ~~AI 分析结果推送钉钉/飞书~~

### P4: make toolbox ✅ 已在 V5.0.1 实现

### ~~P5: Nuclei 深度集成~~ ✅ 已在 V5.0.1 实现
- ~~从 live_assets.json 自动生成目标清单~~
- ~~扫描结果 → vulns 表 → 07-report~~

### P6: Sliver C2
- 开源, Go, mTLS/WireGuard
- EDR 绕过研究
- 分布式扫描节点

---

## 📊 模块成熟度矩阵

| 模块 | 版本 | 生产就绪? | 实战验证? |
|---|---|---|---|
| 00-armory | v1.0 | ✅ | ✅ |
| 01-recon (passive) | v4.0 | ✅ | ✅ |
| 01-recon (active) | v4.0 | ✅ | ⚠️ 待测 |
| 02-probe | v2.0 | ✅ | ✅ |
| `02.5-parse` | v5.0 | ✅ | ✅ |
| `03-audit` | v1.0 | ✅ | ✅ |
| `03-audit-web` | v2.0 | ✅ | ✅ |
| `04-phantom` | v3.0 | ✅ | ✅ |
| `05-cracker` | v3.0 | ✅ | ⚠️ 待密码验证 |
| `06-psexec` | v3.1 | ✅ | ⚠️ 待凭据 |
| `07-report` | v3.1 | ✅ | ✅ |
| `08-diff` | v5.0 | ✅ | ✅ (SQL EXCEPT) |
| `09-loot` | v4.0 | ✅ | ⚠️ 需 AD 靶机 |
| `10-kerberoast` | v4.0 | ✅ | ⚠️ 需 AD 靶机 |
| `11-webhook` | v5.0 | ✅ | ✅ (本地告警) |
| `12-nuclei-integration` | v5.0.1 | ✅ | ⚠️ 需 Docker V4 |
| `db_engine` | v5.0 | ✅ | ✅ |
| `16-ai-analyze` | v5.0 | ✅ | ✅ (Gemini Flash) |
| `17-ask-lynx` | v5.0 | ✅ | ✅ |
| `18-ai-bloodhound` | v5.0.1 | ✅ | ⚠️ 需 AD JSON |
| `23-hp-proxy-unlocker` | v5.0.1 | ✅ | ⚠️ 需靶场 |
| `scripts/firmware-autopsy` | v5.0.1 | ✅ | ✅ |
| `make toolbox` | v5.0.1 | ✅ | ⚠️ 需 Docker V4 |
| `scope_check` | v4.0 | ✅ | ✅ |
| `make test` | v4.0 | ✅ | ⚠️ 需拉镜像 |

---

## 🗺️ 开发里程碑

| 日期 | 事件 |
|---|---|
| 03-24 | v1.0 首次发布，基础侦察链5个模块 |
| 03-25 AM | v2.0 工程化改造 (config/时间戳/Docker v2) |
| 03-25 PM | v3.0 攻击链 (投毒/破解/横移) |
| 03-25 PM | 导师 v3.0 Code Review → OPSEC 修复 |
| 03-25 PM | v3.1 情报层 (报告+变化检测) |
| 03-25 Night | v4.0 三个 Sprint 全部落地 |
| 03-26 AM | TUI 控制台 + Docker v3 (Nuclei) 升级 |
| 03-25 PM | v5.0 Phase 1: SQLite 双写架构 |
| 03-25 PM | v5.0 Phase 2: AI 副官 (Gemini Flash) 集成 |
| 03-25 PM | v5.0.1 TUI 修复 + 实战渗透 (TP-Link/HP/AirTunes) |
| 03-25 Night | 导师批复 v6.0 (Sliver/Ligolo-ng) + v7.0 (Agentic AI) |
| 03-26 凌晨 | V8.0-alpha Phase 1 全栈作战平台上线 (FastAPI+React) |
| 03-26 凌晨 | Bloomberg Terminal UI 落地 (HUD/Activity Bar/AI Copilot) |
| 03-26 凌晨 | AI 面板: 拖拽缩放/模型选择器/流式打字效果 |
| 03-26 AM | D10 提交 (Q14-Q26: Gemini 3 能力+竞品+UI+代码审查) |
| 03-26 PM | D10 导师批复: TUI 冻结 / Interactions API P0 / 三板斧论文创新点 |
| 03-26 PM | docs 重构 (advisor 归档/design 分离/.gitignore) + V8_DESIGN.md |
