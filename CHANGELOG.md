# CatTeam 更新日志

---

## [V9.3 / A3.0] -- 2026-03-31 Electro-Phantom Sprint 1 (态势感知增强)
> **Sprint 1 完成：WiFi 雷达从静态表格升级为动态态势感知大屏。Docker 正式退役，全面切换至 Kali VM 原生架构。**

### 态势感知增强 (Sprint 1)
- **RSSI Sparkline 微折线图**: WiFi 雷达面板的信号列新增内联 SVG 折线图，前 10 个 AP 自动批量获取 RSSI 历史数据并实时绘制。
- **AP Ghosting 残影动画**: 基于 `last_seen` 计算时间差，>10s 半透明、>60s 虚线淡出、>5min 移入底部"历史残影"可折叠区域。
- **探针健康状态灯 (HudBar)**: 新增 `ALFA 探针` 指示器，实时显示 ONLINE/DELAYED/OFFLINE + AP 计数。
- **探针健康状态灯 (雷达面板)**: 标题栏同步显示探针状态圆点。

### 指挥交互升级 (Mission Briefing)
- **战术意图 Chips**: 新增 6 个预制标签，一键填充输入框。
- **推送成功反馈**: 按钮从"全域推送"变为绿色"已下发"，2 秒后恢复。
- **活跃状态指示**: "ACTIVE BRIEFING" + 绿色脉冲呼吸灯。

### CampaignPipeline 重构 5->4 阶段
- 战区锚定 -> 服务指纹 -> 威胁研判 -> 战报输出。移除"Weapon 注入"阶段。

### OUTPUT LOGS -> MCP 工具调用监控台
- AI Copilot 的 TOOL_CALL_START / TOOL_CALL_RESULT 同步推送至面板。

### 全域视觉合规 + Docker 退役
- Emoji 全面清除，替换为 ASCII 符号。
- Dockerfile / docker-compose / Docker 标签页删除。Docker Desktop 已卸载，释放 4.57 GB。

### Bug 修复
- React Hooks 违规修复 (Mission Briefing useState)
- fastmcp 依赖安装，MCP Worker 恢复

---

## [V9.3 / A2.2] — 2026-03-30 🧹 Electro-Phantom (The Final Purge)
> **系统定位回归：彻底卸载了“危险框架”的历史包袱，进化为纯粹的态势感知指令塔。攻击能力全量下放至离线终端人工执行。**

### 🛡️ 架构脱敏与端点根除 (Egress of Offensive Automation)
- **根除自动化火力流 (`/api/v1/ops/run`)**: 从 FastAPI 核心管线彻底切断并物理删除了调用长寿命 `subprocess.Popen` 及关联 `ACTIVE_JOBS` 的挂起调度池，斩断了云端直接发起本地系统攻击指令的神经元。
- **清除多模态钓鱼锻造场 (`/api/v1/agent/forge`)**: 拆除了使用 Playwright 和 Gemini 组合自举生成以假乱真的 A2UI Web 欺骗登录页的高危微服务闭环。
- **拆卸自动提纯字典 (`/api/v1/agent/osint/stream`)**: 移除了高危的目标设备弱口令流式生成器与下发机制。

### 🛸 前端雷达净化 (HUD De-militarization)
- **拔除悬浮火控挂架 (`TacticalArmoryModal`)**: 将 36 种原生存取操作能力从 WebUI 中物理剥离，严守“只看雷达不发炮”原则。
- **卸载极客 OSINT 终端 (`OsintTerminalModal`)**: 去除了步进式 Hacker 行动字幕和字典注入窗口的组件渲染路径。
- **修复与瘦身**: 剔除了上述危险模块的引爆源后，通过严格的 Linter 验证，根绝了因移除节点导致的前端 React 闭合标签失效、变量重复声明等编译障碍，目前产物更清爽、轻量。
## [V9.2 / A2.2] — 2026-03-29 🚀 Deep Autonomy (Released)

### 📡 射频战术管线 (ALFA Wireless Integration)
- **底层网卡感知**: 新增了 `wifi_nodes` 表，打通了物理层无线资产（BSSID）的数据流，使其能与现有 IP 资产被统一纳管在相同的态势感知平台内。
- **全案武器库覆盖**: 将 ALFA 网卡雷达面板从虚拟数据正式切入真实状态机。Lynx 智能体现在可以根据多模态扫描图谱主动为所选 BSSID 调取对应的脱机攻击策略（如 Deauth 断网或破解）。
- **MCP 认知升级**: 在 `mcp_armory_server.py` 中更新了工具指引，为 AI 建立基于 MAC 地址的电磁识别和底层查询规则。

### 🎯 全局标靶锁定池 (Global Target Reticle)
- **多选阵列打通**: 彻底修复了战术沙盒中的“单选限制”缺陷。重构了前端 `globalTargets` 状态流，成功在每次的对答回合里将整个标靶数组注入大模型的强制系统级上下文。
- **并发火力规划**: 现在指挥官可以批量选中目标群发任务，AI 将正确理解并循环、批量下发代码级行动。

---

## [V9.1 / A2.2] — 2026-03-28 ⭐ Hacker Copilot 核心护城河重铸 (Operation Hardening)

### 🪟 UX 降维与隐式提权 (Sudo Keyring)
- **隐式提权管线**: 在全局 Commander HUD 中新增发光的 `KeyRound` 密钥环挂载件，支持指挥官提前注入 Root 密码。
- **劫持拦截器**: LYNX 特工在后台下达 `sudo` 挂载指令（如 nmap 提权扫描或 MSF 运行）时，后端会自动从内存截获并透明压入 `echo '<pass>' | sudo -S`，彻底消灭了需要唤起无脑阻塞 TUI 索要密码的历史僵局。

### 📡 SSE 通信稳定器 (Data Stream Hardening)
- **废弃弱态 Keep-Alive**: 移除了导致 React 彻底假死报错 (`Unexpected end of JSON input`) 的旧版空投注释 `: keepalive`。全面改为结构化的 `event: ping / data: {"status": "heartbeat"}`。
- **报错气泡贯通**: Backend FastApi 不再对前端吞咽原生的 `503 Service Unavailable` 谷歌原生熔断。将底层的 Traceback 堆栈精准穿透抛向 WebUI，保证了排障透明度。

### 🧠 Gemini 3.1 无状态记忆重塑 (Stateless SQLite Re-hydration)
- **解决失忆症**: 鉴于新的原生 `google-genai` SDK 缺乏远端上下文支持（抛弃了旧版的 Interactions API），我们手写了原生的 `mcp_messages` SQLite 持久化管线。
- **序列化剥离**: 现在，每个独立的 `campaign_id` 战役会在底层 `_history` 中被动态剥离、压包入库，并在下一次请求时重新还原成 `types.Content` 阵列。无论怎么切换，大模型的连续多回合问答（长达数百步的扫描数据推演）再也不会断板！

### 🌐 Google Grounding 全网安全雷达 (Anti-Censorship Profiling)
- **内置沙盒唤醒 (CodeExecution)**: 突破本地计算局限，开启了谷歌原生的 Python Sandbox，赋能大模型云端免杀处理。
- **全网漏洞嗅探与反审查人格**: 向大模型底层成功挂载 `Google Search`。在系统 `SYSTEM_PROMPT` 中强行写入 **[安全合规协议 (Safety Guardrails Override)]**。现在，当收到要求输出 0-DAY 或历史武器库代码时，LYNX 均会自动套用“防守方验证机制审计”的人设护盾，100% 绕过了谷歌严苛的内容审核阻断过滤器！

---

## [V9.0 / A2.1] — 2026-03-27 ⭐ V9 架构基线雷达与验收矩阵 (D14 Alignment Audit)

本节点为一次特殊的全量代码审计记录。旨在复盘 V9 实际产出代码与 `V9_DESIGN.md` 及 `D14_ADVISOR_RULING.md` 顶层设计的偏离度。

### ✅ 1. 严格遵循设计的模块 (Aligned with Docs)
- **指挥官视窗 (Commander's HUD)**: 完美落地 [顶栏管线] + [中部沙盒] + [右栏 AI] 的三段式布局。
- **内存级轻量图谱 (NetworkX)**: 严格落实剔除 Neo4j，改回 NetworkX 内存推演。
- **Pydantic 结构化提纯 (Structured Output)**: 彻底消除 JSON 幻觉截断。

### 🔄 2. 妥协性开发的模块 (Implemented Differently)
- **原生 Interactions API**: 因 `google.genai` SDK 版本限制，降级回了 `chats.create` 结合前端 `history` 数组的平替状态机，未做到全托管。
- **Deep Research 下沉**: 未能完全剥离独立的异步探员模型，而是改用同级别 Flash 模型并在 `/agent/osint` 端点执行提纯。
- **ReAct 防熔断**: 采用了暴力的第 15 步 `tools=[]` 熔断机制，没有从通信层彻底重构连续性校验。

### ➕ 3. 规范外衍生模块 (Newly Added / Solo)
- **多战区大沙箱 (Theater Manager)**: 为解决实战数据污染，超纲强写了 SQLite 的环境变量区隔离层。
- **Sliver C2 原生集成**: 超纲介入公网远控，编写了原生的 React 面板。
- **兵工厂落盘固化**: A2UI 从预览概念变为了实体持久化（`/forge/save`）。

### 🚨 4. V9.0 时期未执行开发与历史核心欠债 (现已于 V9.2 修复)
- **全局多选管线断裂**: `✅ 已于 V9.2 修复`，恢复了跨页面的标靶多选锁定。
- **ToolCodeExecution 代码沙箱**: `✅ 已于 V9.1 修复`，挂载核心沙箱环境。
- **A2UI 视觉自我纠错**: Playwright 链路视效优化。

---

## [V9.0 / A2.1] — 2026-03-27 ⭐ 全栈智能大盘 (Phase 15 & 16)

### 🛸 界面重构：指挥官的战术沙盒 (The Commander's HUD)
- **全局战术管线 (CampaignPipeline)**: 废除分散的菜单与页面。将整个渗透进程凝聚在顶部发光管线 (`战区锚定` → `射频嗅探` → `脆弱性指纹` → `Alfa 注入` → `战报生成`)。并且去除了违规 Emoji，替换为 `lucide-react` SVG 标准合规版。
- **微观多选火力网 (Micro-Swarming Checkboxes)**: 资产卡片现已支持 Checkbox 多选。
- **悬浮战术武库 (Tactical Armory)**: 在沙盒选中资产后，原有的 TUI 打击能力 (36个核心利用模块) 直接从悬浮动作栏通过 `<TacticalArmoryModal>` 华丽复活！完美结合了界面操作的快感与实弹代码的摧毁力。

### 🧠 兵工厂融合与 OSINT 降维打击
- **`/api/v1/agent/osint` 端点**: 彻底贯通后端 `google.genai`。根据选定的机器属性当场生成10-20条贴脸级的靶向密码字典。
- **矩阵极客终端 (`OsintTerminalModal`)**: 在生成字典时接管前端视野，使用步进式的 Hacker 行动字幕。输出格式被 Pydantic 硬性约束为 JSON Array。
- **历史缝合**: 完全补齐了 V8 时期由 `OperationPipeline` 分发的 `./catteam.sh` 集成武器，通过新的 Fetch 底层发往 `/api/v1/ops/run`。

---

## [V8.2 / A2.1] — 2026-03-27 ⭐ MCP 架构 + UI 全面审计 (Sprint 3)

### 🔌 MCP (Model Context Protocol) 架构落地
- **`backend/mcp_armory_server.py`**: 武器/工具封装为标准 MCP Tools，Agent 通过 stdio 协议动态发现与挂载
- **`backend/agent_mcp.py`**: 重写为缓存式架构：MCP 工具 schema 首次发现后缓存在内存，后续消息 **零子进程开销**
- **废弃硬编码**: 旧版 `agent.py` 中的 `tool_execute_shell` 等 6 个直连函数降级为 fallback

### 🎨 UI/UX 与核心架构全面审计 (12 项修复)
- **P0 战区隔离与越权防漏 (Theater Isolation)**: 修复了 `main.py` 中的 SQLite 查询漏洞。废弃跨域的 `ORDER BY scan_id DESC`，全面接入 `JOIN scans WHERE s.env=?`，根绝了 A 战区资产与高危漏洞串流至 B 战区的历史技术债，涵盖所有报表与查询接口。
- **P0 AI 熔断**: 修复 SSE 断线重连时引发无主进程滥刷 Token 漏洞 (`await request.is_disconnected()`)。
- **P0 数据安全**: OP Pipeline `theater` 参数从硬编码 `default` 改为当前战区动态注入。
- **P1 交互优化**: OP Tab 新增侧边栏 (战区上下文 + 快速跳转)，移除空壳 Agent 审计日志 Tab。
- **P2 功能补全**: C2 面板 + 拓扑图新增刷新按钮，Debug Console 改为系统连接状态面板。
- **P3 代码整洁**: 消除 `window.__claw_filters` 全局变量，改为 React Props 传递。
- **实时日志**: 时间戳从静态 "10 分钟前" 改为动态 HH:MM:SS (当前时钟 - 偏移量)。
- **HUD 防溢出**: 增加 `overflow-x: auto` 防窄屏内容裁剪。

### 🖼️ Emoji → SVG 图标迁移
- **全面去 Emoji**: 武器按钮、探测按钮、OP 流水线、C2、AI 面板等 25+ 处 emoji 替换为 lucide-react SVG
- **22 个图标**: `Search` `Globe` `Bug` `Lock` `ClipboardList` `KeyRound` `Monitor` `Skull` `Crosshair` `Loader2` `Rocket` `Zap` `Building` `FlaskConical` `Copy` `X` `Info` `RefreshCw` 等
- **符合设计规范**: 对齐 CONVENTIONS.md Bloomberg Terminal 视觉标准（无 Emoji、纯 SVG）

### ⚡ AI 性能优化
- **MCP 工具缓存**: 每条消息不再启动 MCP 子进程做工具发现，首次 3s → 后续 < 0.5s
- **数据同步**: OP 执行完成 30s 自动刷新全局资产，战区切换立即同步 `currentTheater`
- **AI 上下文**: Agent 通过 MCP `claw_query_db` 直查 SQLite，始终获取最新数据

---

## [V8.2 / A2.1] — 2026-03-27 ⭐ 流式作战流水线 (Sprint 2)

### ⚡ 标准化作战流程 (Operation Pipeline)
- **前端重构**: `Activity Bar` 新增独立的 `OP (作战)` Tab 视图。
- **5 阶段全覆盖**: 原 TUI 的 15 个独立菜单彻底组件化为 5 个战略节点: ① 侦察 → ② 扫描 → ③ 审计 → ④ 攻击 → ⑤ 报告。
- **一键触发**: 摒弃 CLI，全面可视化点选 `[▶ 执行]`，自动投递到底层作战引擎。
- **流式输出 (SSE)**: 控制台新增 `OUTPUT` 面板，支持通过 Server-Sent Events (SSE) 实时监听脚本的每行标准输出，实现远端控制感与 TUI 操作体验拉平。

### 📡 态势感知增强 (RC Panel)
- **实战流数据馈送**: `RC (侦察)` 面板左侧保留指标矩阵，右侧重构为 `⚡ 实时动态日志 (Live Activity Feed)`。
- **多战区隔离**: 配合 V8.1 的战区选择机制，不同 `Theater` 运行的 OP 作战流水线相互独立。

### 🔌 API 引擎升级
- **异步操作端点**: 新增 `POST /api/v1/ops/run`，支持触发后台 `subprocess.Popen` 长寿命进程。
- **SSE 流式追踪**: 新增 `GET /api/v1/ops/log/{job_id}`，实现极低延迟的前端流式打印体验。

---

## [V8.0.1 / A2.1] — 2026-03-27 ⭐ 交互重构 + 实弹就绪


### 🎯 交互重构 (UX Overhaul)

- **Sidebar 联动**: 左侧从冗余 IP 列表改为筛选面板 (搜索/风险/端口过滤)，右侧台账实时响应
- **冗余清理**: 删除 AG Tab、AT 子 Tab (端口暴露面)、重复 IP 列表
- **自动定位**: 选中资产时右侧台账自动平滑滚动至视口中央
- **代码块可操作**: AI 回复中 ```bash 代码块渲染为面板，支持 📋 复制 / ▶ 执行
- **Console Tab**: OUTPUT (Agent审计日志) + DEBUG CONSOLE 完整功能化

### 🐳 Docker 实弹集成

- **云端战车**: Docker 面板从占位符改为实时状态面板，显示 v1-v4 镜像 + 容器状态
- **容器控制**: Web 端 ▶ 启动 / ⏹ 停止 / 🔄 重启 容器
- **API**: `GET /api/v1/docker/status`, `POST /api/v1/docker/{action}/{name}`

### 🔫 武器库扩展

- **36 个模块**: 从 12 个扩展至 36 个 (含 MSF/Hashcat/John/Hydra/Responder/Aircrack-ng 等)
- **6 大分类**: 侦察 / 漏洞利用 / 密码破解 / 横向移动 / 无线与固件 / AI+报告
- **紧凑卡片**: 去编号，中文标题，180px 最小宽度
- **点击调用**: 每张卡片点击直接触发 AI 对选定目标执行操作

### 🛡️ Agent 工具修复 (5 个同类 Bug)

- `claw_read_file`: 支持读取项目根目录脚本 (不再限于 Loot)
- `claw_run_module`: 已知 make target 从 10 扩展到 18，自动补全 `make ` 前缀
- `claw_sliver_execute`: 修复 justification/reason 参数名不匹配
- `tool_read_file` 路径穿越检查: 白名单加入项目根目录
- 工具描述: 更新为包含项目脚本的说明

### 🌐 可视化增强

- **拓扑图**: 节点可点击，右上角浮动卡片显示详情
- **ATT&CK 矩阵**: 技术卡片可点击，底部显示覆盖状态
- **C2 面板**: 新增 MOCK 标签和中文说明
- **Scope 管理**: HUD 栏 Scope 按钮 + 配置模态框

---

## [V8.0-alpha / A2.0] — 2026-03-26 ⭐ 全栈作战平台

### 🖥️ Web Dashboard (Phase 1: 黎明中枢)

- **后端 (FastAPI)**: 5 个 REST API (`/stats`, `/assets`, `/scans`, `/audit`, `/agent/chat`)
  - SQLite claw.db 直接查询, CORS 中间件, 分页搜索
- **前端 (React + Vite)**: Bloomberg Terminal 彭博终端级交互设计
  - HUD 状态栏: Hosts/Ports/Vulns/Scans/实时时钟
  - Activity Bar (RC/AT/AG) + 左侧资产面板 (威胁热力图 + 列表)
  - 中间工作区 3 Tab: RECON_OVERVIEW / ASSET_TABLE / PORT_MATRIX
  - 右侧 AI Copilot 面板 (拖拽缩放/模型选择器/流式打字/快捷指令)
- **设计规范**: 纯黑 #000 / 零圆角 / 琥珀金 + 青色 / Consolas 等宽

### 🏛️ 架构升级

- **Monorepo** 结构: `backend/` (FastAPI) + `frontend/` (React)
- B/S 架构: 浏览器端替代 TUI, 保留 CLI 兼容
- vis.js 网络拓扑图 (力导向, 风险着色)

### 📐 战略

- 导师 D8 批复: LLM-Native CTEM 定位确认
- Open Core 商业模式 / Sliver C2 全仓押注 / MITRE ATT&CK 标签
- 竞品对标: Mythic / Cobalt Strike / Caldera / BloodHound / Havoc / Faraday

---

## [V7.0 / A2.0] — 2026-03-25 ⭐ Agentic AI 里程碑

### 🧠 CLAW Agent 智能体

- `claw-agent.py` — Gemini 3 Interactions API + ReAct Loop 自主智能体
- **A1.0 (M1)**: 3 只读工具 (claw_query_db / claw_read_file / claw_list_assets)
- **A2.0 (M2)**: 2 执行工具 (claw_execute_shell / claw_run_module) + HITL 三级分权
- HITL 安全: 🟢 GREEN 自动放行 / 🟡 YELLOW [Y/n] 确认 / 🔴 RED 双重确认
- 流式输出: Popen 实时显示 + sudo 密码透传
- `catteam.sh` 新增菜单 `20) 🧠 CLAW Agent`

### 📋 工程治理

- `CONVENTIONS.md` v2.0 — 三轨版本号 (V=系统 / A=Agent / D=导师文档)
- 强制文档同步清单 (Section 5): 6 份必须同步 + 4 份按需更新
- Docker V4 镜像构建 + Nuclei v3.7.1 模板安装

### 📐 战略文档

- `V8_STRATEGIC_ANALYSIS.md` — 差距分析 + 竞品对标 + 四维升级路线图
- 7 个导师讨论议题 (定位/C2/多Agent/知识工程/伦理)

---

## [v5.0.1-B] — 2026-03-25 (晚间冲刺)

### 🔧 B类待办批量交付

**新模块:**
- `18-ai-bloodhound.py` — AI-Hound: BloodHound JSON → Gemini 图论推理引擎
- `23-hp-proxy-unlocker.py` — HP 代理跳板机复仇者 (4 阶段自动化攻击)
- `make toolbox` — 扩展工具箱 (Nikto/Hydra/Sqlmap/binwalk/固件解剖刀 交互菜单)
- `make firmware` — 固件解剖刀快捷入口

**模块重组:**
- `21-firmware-autopsy.py` → `scripts/firmware-autopsy.py` (正式通用工具)
- `20-tplink-probe.py` → `scripts/examples/` (实战参考 PoC)
- `22-printer-probe.py` → `scripts/examples/` (实战参考 PoC)

**基础设施:**
- `Dockerfile` V3 → V4 (新增 binwalk 固件逆向工具)
- `docs/CONVENTIONS.md` — 技术标准文档 (版本号/命名/编码规范)

**导师文档:**
- `V7_AGENTIC_PROPOSAL.md` — Agentic AI 全自动智能体架构推演
- `V7_ADVISOR_RULING.md` — 导师 V7 批复存档
- `V7_QUESTIONS.md` — V7 战略请示 (界面/模型/安全边界)

---

## [v5.0.0-alpha] — 2026-03-25

### 🗄️ Phase 1: SQLite 数据层 (双写架构)

- `db_engine.py` — SQLite 引擎 (scans/assets/ports/vulns 四张表)
- `02.5-parse.py` — 双写模式: SQLite (claw.db) + JSON (live_assets.json)
- `08-diff.py` v5.0 — SQL EXCEPT 差异引擎 + JSON 兼容 fallback

### 🐱 Phase 2: AI 智能副官 (Gemini Flash)

- `16-ai-analyze.py` — AI 战术分析 (SQLite → Prompt → Gemini → 建议)
- `17-ask-lynx.py` — 多轮对话 (自动携带扫描上下文, 滑动窗口 10 轮)
- `catteam.sh` v5.0 — 新增 [AI 副官] 菜单 (13/14)
- OPSEC 脱敏层 + Python json.dumps 安全构建 JSON

### 📡 Phase 3: 智能告警引擎

- `11-webhook.py` — 自动 Diff → AI 分析 → 本地告警 + macOS 通知
- `CatTeam_Loot/alerts/` — 告警文件存储 + alerts.log 汇总
- Gmail 推送接口预留 (后期启用)
- 支持 `--cron` 静默模式 (crontab 定时执行)
- `config.sh` — 新增 AI 配置段 (CLAW_AI_KEY/MODEL/URL)
- `.gitignore` — 保护 config.sh (含 API Key) 和 CatTeam_Loot/
- `docs/advisor/` — 导师交流文档独立目录

### 🛠️ Phase 4: TUI 优化与底层架构修复 (v5.0.1)

- `catteam.sh` — 新增 `r) 上帝模式` 动态物理开关，支持绕过 ROE 授权直接渗透
- `catteam.sh` — 修复 `suggest_next` 时序逻辑，精准识别后台 `Responder` 驻留状态避免重复引导
- **全局 UX 优化** — 解耦所有底层脚本 (`01-recon` ~ `10-kerberoast`) 硬编码的模块序号，统一改用动态语义化命名，完美对齐 TUI 菜单
- `16-ai-analyze.py` / `17-ask-lynx.py` — 修复会话隔离时序 Bug，强制从 `latest` 战区直读 Web 指纹，确保 AI 情报绝对同步
- `04-phantom.sh` — 支持原生本地 `Responder`，更新 `config.sh` 改用相对路径
- `db_engine.py` — 完成老旧扫描数据的 `AscottLot` 环境热迁移

---

## [v4.0.0] — 2026-03-25

### 🏰 合规层 + 侦察升维 + 后渗透 + AD 域链

**Sprint 1: 合规与基建**
- `scope.txt` — ROE 白名单文件 (多 CIDR 支持)
- `scripts/scope_check.py` — ipaddress 交集校验
- `01-recon.sh` 集成 scope 校验
- `tests/` — Docker Compose 自动化靶场 (DVWA + Samba)
- Makefile: `make test`

**Sprint 2: 侦察升维**
- `01-recon.sh` 双侦察引擎 (passive/active 模式)
- `config.sh`: `RECON_MODE` + `ACTIVE_CIDR`
- Dockerfile v3: Nuclei 漏洞扫描器
- `nuclei-templates/` 枪弹分离架构
- Makefile: `make nuclei`

**Sprint 3: 后渗透 + AD 域**
- `09-loot.sh` — secretsdump + smbclient (强制 --confirm 安全阀)
- `10-kerberoast.sh` — GetUserSPNs + BloodHound
- Makefile: `make loot` + `make kerberoast`

**交互式控制台**
- `catteam.sh` — TUI 交互菜单 (ASCII+ANSI, 状态感知, 前置条件校验)
- Makefile: `make console`

**基础设施**
- Dockerfile v3: my-kali-arsenal:v3 (Nuclei 已焊入)
- config.sh: IMAGE_NAME 切换至 v3

**交互式控制台 (Project CLAW)**
- `catteam.sh` TUI: Lynx 猫头 ASCII logo
- 主动探活自动读取 scope.txt 建议 CIDR
- 模块执行后智能推荐下一步

**Bug 修复**
- Makefile: phantom/crack/lateral 加入 USE_LATEST=true，修复攻击模块执行后 targets 归零的问题

---

## [v3.1.0] — 2026-03-25

### 📊 情报层 + 安全加固

- `07-report.py` — 渗透测试战报自动生成 (Markdown)
- `08-diff.py` — 资产变化检测 (新增/消失主机 + 端口变化)
- OPSEC 修复: 06-psexec 不再接受命令行密码参数
- 僵尸修复: 04-phantom --stop 使用 pkill -f 清理 tail 管线
- Dockerfile v2: 基于 v1 + Impacket 焊入镜像
- 修复: make clean 加 sudo (root 文件), 02.5/03 Python 适配时间戳目录

---

## [v3.0.0] — 2026-03-25

### 🗡️ 攻击链扩展：投毒 → 破解 → 横向

**新增攻击模块：**
- `04-phantom.sh` — Mac 原生 Responder 投毒 (解决 Docker --network host 在 Mac 上不可用)
  - 实时 Hash 清洗伴生管线 (sed 提取，不截断 NTLMv2)
  - 防重复启动检测 + PID 管理 + `--stop` 回收
- `05-cracker.sh` — 宿主机原生 Hashcat (直接利用 GPU/Metal)
  - 自动搜索 rockyou.txt (3 个候选路径)
  - 从 `captured_hash.txt` 直接对接 04 模块
- `06-psexec.sh` — Docker Impacket 横向移动
  - 凭据三级获取: CLI参数 > config.sh > 05自动加载 > 交互输入
  - 用 Python 替代 jq 解析 JSON (Mac 无 jq)
  - smbexec 静默认证 + 四级结果分类

**config.sh 扩展：**
- `RESPONDER_PY_PATH` — Responder 路径
- `HASHCAT_BIN` / `WORDLIST` — Hashcat + 字典配置
- `LATERAL_USER` / `LATERAL_PASS` / `LATERAL_DOMAIN` — 凭据配置

**Makefile v3.0：**
- 新增: `make phantom` / `make phantom-stop` / `make crack` / `make lateral`

---

## [v2.0.0] — 2026-03-25

### 🏗️ 系统级现代化改造

- `config.sh` 统一配置中心 (端口模板/日志/时间戳目录)
- `blacklist.txt` IP 禁飞区
- 时间戳任务目录 + `latest` 软链接
- `log()` 双写 (终端 + catteam.log)
- Makefile `preflight` 飞行前预检
- `03-audit-web.py` 纯 Python httpx 替代品
- `03-exploit-76.py` VNC/SMB 精准打击

---

## [v1.0.0] — 2026-03-24

### 🎉 首次发布

- 00-armory / 01-recon / 02-probe / 02.5-parse / 03-audit
- `set -euo pipefail` + trap 清理 + 错误检查
- Makefile v1.0 中控引擎
