# Project CLAW V9.2 — AI 引擎深度进化与战术自动化设计规范

**Project CLAW · V9.2**  
**版本：** 1.0 (Draft)  
**日期：** 2026-03-28  
**修订状态：** 📝 基于 A3.0 审计报告 + Gemini 3.1 全量文档特性扫描
**代号：** Deep Autonomy

---

## 一、V9.2 定位

```text
V9.1 (A3.0):  记忆重铸 + LFI 铁牢 + 安全硬化 (底层护城河加固)
V9.2:         AI 能力纵深拓展 + 战术自动化管线 + UX 交互层偿债
```

V9.2 的核心目标不再是修复底层缺陷，而是**纵向挖掘 Gemini 3 已暴露但未使用的高价值 API 特性**，横向打通 OSINT→破解→报告的端到端自动化管线，并偿还 D17 导师裁定的 P0 UX 欠债。

---

## 二、V9.2 已完成项 (2026-03-28 本轮)

| # | 改动 | 文件 | 说明 |
|---|---|---|---|
| ✅ P1-1 | **URL Context 工具启用** | `agent_mcp.py` | 追加 `types.Tool(url_context=types.UrlContext())`，赋予 AI 直接阅读 CVE 详情页/目标官网内容的能力 |
| ✅ P1-2 | **MCP Schema 类型映射补全** | `agent_mcp.py` | 完善 `boolean`/`number`/`array` 类型，修复参数丢失类型的隐性 bug |
| ✅ P1-3 | **System Prompt 视觉侦察指令注入** | `agent.py` | 新增 `## 多模态侦察能力` 段，激活 A2UI 截图主动分析 CMS 和 URL Context 读取 CVE |
| ✅ P1-4 | **Forge 截图 `media_resolution_high`** | `main.py` | 在 A2UI 视觉自我博弈中启用高清 OCR 模式，细微排版破绽识别率提升 |
| ✅ P0-2 | **冷启动 Thought Signature 保护** | `agent_mcp.py` | 跳过 SQLite 中无法恢复 `thoughtSignature` 的 `[thinking]` 占位符，防止 400 崩溃 |
| ✅ P0-3 | **全局多选准星 (Global Target)** | `App.jsx`, `agent.py` | (D4 重构) 将前端选中 IP 集通过 SSE 打入 System Prompt 的强制靶向清单，消除盲狙 |
| ✅ P0-4 | **Markdown 护城河 (AST State Machine)** | `App.jsx`, `agent.py` | (D4 重构) 废弃正则流解析，后端脱敏沙盒反撇号，前端拦截残缺结构并增加 A2UI JSON Loading 保护 |

---

## 三、V9.2 待开发项 (按优先级排列)

### 🔴 P0 — 核心 UX 欠债

#### 3.0 前端渲染管线重构 (D3 延期债务)

> D3 导师案卷裁决 + 高危卡顿 OOM 风险点

**问题**：目前近 3000 行的 `App.jsx` 单体包含致命的级联重绘（Render Avalanche）、Mutation 状态污染及 `AiPanel` 内存泄露问题。在进行高频拖拽或收到大量大模型 SSE 数据时极易拉死主线程。

**设计方案 (V9.2 专项分支处理)**：
- 将全局频繁触发 `Re-render` 的 `aiWidth` / `selectedIp` 从 `<App />` 转移至下层叶子组件内部订阅机制。
- 对 Zunstand 长会话状态（如打字机气泡）实行严格的 Immutability 更新机制。
- 对事件总线、`AbortController`、拖拽鼠标监听事件补充 React 生命周期销毁（`useEffect` cleanup）以防挂起。

**涉及文件**：
- `frontend/src/App.jsx`

---

### 🟡 P1 — 战术自动化管线

#### 3.2 OSINT → Hashcat 端到端自动管线

**问题**：OSINT 特工生成的 <500 词密码本目前交由前端手动复制，没有自动将字典传入 `make crack` 的端到端管线。

**设计方案**：
- AI 生成密码本后，自动写入 `CatTeam_Loot/dicts/<target>_osint.txt`
- 新增 MCP 工具 `claw_write_loot_file`（白名单限制只能写入 `dicts/` 子目录）
- 前端 OSINT 面板增加"一键载入至 Hashcat"按钮
- 后端 `make crack` 自动加载最新字典文件

**涉及文件**：
- `backend/mcp_armory_server.py` — 新增 `claw_write_loot_file` 工具
- `backend/main.py` — OSINT 端点增强
- `frontend/` — OSINT 面板 UI

**预估工作量**：中（1 天）

#### 3.3 Google Search Grounding 引用渲染

**问题**：AI 使用 Google Search 返回的搜索结果中包含 `groundingMetadata.groundingChunks`（信息来源），但前端完全未处理这些引用，用户无法验证搜索结果的可信度。

**设计方案**：
- 后端 SSE 流中新增 `GROUNDING_METADATA` 事件类型
- 前端 AI 面板在回答末尾渲染搜索来源卡片（URL + 标题 + 摘要）
- 满足 Google Search Terms of Service 的展示要求

**涉及文件**：
- `backend/agent_mcp.py` — 解析 grounding metadata 并通过 SSE 推送
- `frontend/src/App.jsx` — 搜索来源 UI 组件

**预估工作量**：中（1 天）

---

### 🟡 P1 — Gemini 3 深度能力挖掘

#### 3.4 Deep Research Agent 异步接入

**问题**：设计要求使用 `deep-research-pro-preview-12-2025` 异步后台模型进行深度情报研报，当前用 Flash 同步替代。

**设计方案**：
- 依赖 Interactions API（`client.interactions.create(..., agent="deep-research-pro-preview-12-2025", background=True)`）
- 新增 `/api/v1/agent/deep-research` 端点，返回 task_id
- 前端新增异步轮询机制 + 进度条
- 研报完成后自动推送至 AI 参谋部

**前置条件**：需确认 `google.genai` SDK 是否已支持 `client.interactions.create`

**涉及文件**：
- `backend/main.py` — 新增深度研究端点
- `frontend/` — 异步任务 UI

**预估工作量**：中（1-2 天）

#### 3.5 `customtools` 模型变体评估

**问题**：AI 有时忽略 MCP 自定义工具而倾向于直接输出 bash 命令文本。

**设计方案**：
- 评估 `gemini-3.1-pro-preview-customtools` 模型在 CLAW 场景下的工具调用命中率
- 如果效果显著，在 MODEL_CONFIG 梯队中新增 `"tools"` 模式

**涉及文件**：
- `backend/agent_mcp.py` — MODEL_CONFIG

**预估工作量**：小（评估 + 1 行代码）

---

### 🟢 P2 — 深度功能增强

#### 3.6 Interactions API 迁移 (长期目标)

**问题**：当前使用 `client.aio.chats.create` 而非真正的 Interactions API，冷启动时 `thoughtSignature` 无法完整恢复。

**前置条件**：Interactions API 支持**流式输出 (streaming)** 后方可启动迁移

**设计方案**：
- 将 `react_loop_stream` 底层从 `chats.create` 迁移至 `interactions.create`
- 利用 `previous_interaction_id` 实现云端自动上下文管理
- 废弃 `_session_cache` + SQLite 手动持久化
- 保留 SSE AG-UI 流式事件协议不变

**涉及文件**：
- `backend/agent_mcp.py` — 全面重构

**预估工作量**：大（架构级重构）

#### 3.7 前端告警面板

**问题**：TUI 版本有 `alerts.log` 和陷阱监控 (`s` 键)，GUI 完全缺失。

**设计方案**：
- 新增 Activity Bar `AL` (Alerts) Tab
- 从 `CatTeam_Loot/alerts/` 读取告警日志
- 实时 WebSocket 推送 Responder 捕获的 Hash

**涉及文件**：
- `backend/main.py` — 新增告警 API
- `frontend/` — Alerts Tab UI

**预估工作量**：中

#### 3.8 ALFA 无线战术管线 (WiFi 自动化渗透链)

**问题**：前端 ALFA 射频看板已完成 80% 的 UI（具备目标多选、信号图表），但后端由于前置硬件 (Alfa 网卡) 未到位，没有任何能够真实调用 `aircrack-ng` 套件的代码，当前为纯前端展示（使用 Dummy 数据）。

**设计方案 (端到端实施计划)**：
1. **环境与驱动层 (`backend/main.py`)**： 
   - 新增 `/api/v1/wifi/monitor`：管理 `airmon-ng start/stop`，建立网卡状态机。
   - 新增 `/api/v1/wifi/scan`：后台运行 `airodump-ng` 会话，解析生成的 `.csv` 报文，替换前端的 BSSID Dummy 数据，实现射频雷达实时刷新。
   - 新增 `/api/v1/wifi/deauth`：接收前端传入的目标 MAC 列表，调用 `aireplay-ng -0` 发射反认证波强踢客户端断线。
2. **战利品捕获层 (`backend/main.py`)**：
   - 监听引擎持续解析 `airodump-ng` 输出，一旦捕捉到 EAPOL WPA 四次握手包（`.cap`），前端面板的 **[战利品缓存栈]** 状态点亮，提示可进行字典爆破。
3. **算力破障层 (`05-cracker.sh`)**：
   - 升级现有的打底脚本，新增对 WPA2/WPA3 的支持。
   - 内部调用 `hcxpcapngtool` 自动将抓到的 `.cap` 文件转化为 Hashcat 可读的 `.hc22000` 格式。
   - 使用 `hashcat -m 22000` （结合由 OSINT 特工生成的定制语义字典）执行 GPU 加速秒破。
4. **AI MCP 赋权 (`backend/mcp_armory_server.py`)**：
   - 注册 `claw_wifi_scan`, `claw_wifi_deauth`, `claw_wifi_crack` 三个 MCP 工具，赋予 Lynx 智能体**自主发现-拒止-捕获-破解**的无线攻击闭环能力。

**涉及文件**：
- `backend/main.py` — 暴露 WiFi 底层控制与状态 API
- `frontend/src/App.jsx` — 移除假数据，对接真实 API 并闭环战利品栈
- `05-cracker.sh` — 增加 WPA2 (mode 22000) 分支
- `backend/mcp_armory_server.py` — AI 工具声明

**预估工作量**：大（1-2 天，极度依赖物理实盘调试）

---

## 四、Gemini 3 API 特性路线图

| 特性 | V9.2 状态 | 计划版本 |
|---|---|---|
| `thinking_level` (5 级梯队) | ✅ 已用 | — |
| Code Execution 云沙箱 | ✅ 已用 | — |
| Google Search Grounding | ✅ 已用 | P1: 引用渲染 (§3.3) |
| Function Calling + MCP | ✅ 已用 | P1: Schema 已补全 |
| Structured Output | ✅ 已用 | — |
| `include_server_side_tool_invocations` | ✅ 已用 | — |
| **URL Context** | ✅ **本轮新增** | — |
| **`media_resolution`** | ✅ **本轮新增** | — |
| Deep Research Agent | ❌ 未用 | P1 (§3.4) |
| `customtools` 模型变体 | ❌ 未用 | P1 评估 (§3.5) |
| Computer Use | ❌ 未用 | V10 远期 |
| Image Generation | N/A | 不需要 |

---

## 五、版本演进全景 (更新)

```
V9.0 (03-27)  ━━  V9.1 (03-28)  ━━  V9.2 (计划中)  ━━  V10 (远期)
全栈智能大屏     护城河加固        深度自动化         多智能体分布式
```

**Gemini 3 API 利用率演进**：
- V9.0: ~50% → V9.1: ~60% → **V9.2 本轮: ~75%** → V9.2 完整: ~85%
