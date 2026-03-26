# 📝 CatTeam 更新日志

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
