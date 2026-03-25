# Project CLAW V8.0 — 全栈架构设计提案

**编制：** CatTeam AI 工程团队  
**日期：** 2026-03-25  
**版本：** D8 (第 8 轮导师文档)  
**状态：** 🟡 待导师审阅

---

## 一、行业定性：工具集 vs 框架 vs 作战平台

先搞清楚一个根本问题——市面上的东西到底是什么？

### 1.1 三个层次

```
┌────────────────────────────────────────────────────────┐
│  作战平台 (Platform)                                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │  框架 (Framework)                                │  │
│  │  ┌──────────────────────────────────────────┐    │  │
│  │  │  工具集 (Toolkit)                        │    │  │
│  │  │  nmap, hashcat, sqlmap, binwalk...       │    │  │
│  │  └──────────────────────────────────────────┘    │  │
│  │  编排 + 数据共享 + API                            │  │
│  └──────────────────────────────────────────────────┘  │
│  GUI + 协作 + AI + 态势感知 + 审计                       │
└────────────────────────────────────────────────────────┘
```

| 层次 | 代表 | 特征 |
|---|---|---|
| **工具集** | Kali Linux, nmap, Hashcat | 独立工具的集合，用户手动串联 |
| **框架** | Metasploit, Sliver, Cobalt Strike | 统一架构 + 插件体系 + C2 通信 |
| **作战平台** | Mythic + BloodHound + Caldera | 框架 + GUI + 协作 + 态势感知 + 审计链 |

### 1.2 竞品详细对标

| 系统 | 类型 | 界面 | 语言 | 开源 | 核心能力 |
|---|---|---|---|---|---|
| **Kali Linux** | 工具集 | CLI | – | ✅ | 600+ 工具预装，是 OS 不是平台 |
| **Metasploit** | 框架 | CLI + Armitage(GUI) | Ruby | ✅ | exploit 库 + payload 生成 + 后渗透 |
| **Cobalt Strike** | 框架 | Java GUI | Java | ❌ $3500/yr | Beacon C2 + 团队协作 + Malleable C2 |
| **Sliver** | 框架 | CLI (gRPC) | Go | ✅ | 现代 C2，CS 的开源替代 |
| **Havoc** | 框架 | Qt5 GUI | C/C++ | ✅ | 最新 C2，类 CS 但免费 |
| **Mythic** | 平台 | Web Dashboard | Python/Go | ✅ | **最接近我们目标**: Web UI + 多 Agent + 审计 |
| **Caldera** | 平台 | Web Dashboard | Python | ✅ | MITRE ATT&CK 自动化 + 红蓝对抗 |
| **BloodHound** | 分析工具 | Web UI | JS | ✅ | AD 域攻击路径图谱 (Neo4j) |
| **Faraday** | 平台 | Web Dashboard | Python | ✅ | 漏洞管理协作平台 |
| **Pentera** | 平台 | Web GUI | – | ❌ 商业 | 全自动渗透测试验证 |

### 1.3 CLAW 的定位

```
CLAW V7.0 (当前):  工具集 → 框架 (已跨越: 有编排+数据层+Agent)
CLAW V8.0 (目标):  框架 → 作战平台 (需要: GUI + 协作 + 审计 + 态势感知)
```

> **核心差异化**: 市面上没有任何平台内置 AI Agent。CLAW 的 AI 赋能是独一无二的竞争力。

---

## 二、V8.0 全栈架构设计

### 2.1 三层交互架构

```
                    ┌──────────────────────────────┐
                    │     Web Dashboard (GUI)        │
                    │  React + Tailwind + WebSocket  │
                    │  态势感知 / 攻击图谱 / 思维链    │
                    └───────────┬──────────────────┘
                                │ REST API
                    ┌───────────┴──────────────────┐
                    │     API Server (Backend)       │
                    │  FastAPI (Python) / WebSocket   │
                    │  认证 / 路由 / 中间件            │
                    └───────────┬──────────────────┘
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
    ┌───────┴──────┐  ┌────────┴───────┐  ┌───────┴──────┐
    │   Agent 引擎  │  │   工具编排引擎   │  │   数据引擎    │
    │  Gemini 3     │  │  现有模块 00-23  │  │  SQLite/     │
    │  ReAct Loop   │  │  + 外部工具      │  │  PostgreSQL  │
    │  HITL 分权    │  │  Makefile 编排   │  │  审计日志     │
    └──────────────┘  └────────────────┘  └──────────────┘
            │                   │                   │
    ┌───────┴───────────────────┴───────────────────┘
    │              CLI / TUI (保留)
    │          catteam.sh / claw-agent.py
    └────────────────────────────────────────────────
```

### 2.2 各层职责

| 层 | 技术选型 | 职责 |
|---|---|---|
| **GUI** | React + Vite + Tailwind | 可视化: 资产拓扑/攻击路径/思维链/实时日志 |
| **API** | FastAPI (Python) | RESTful API + WebSocket 推送 + JWT 认证 |
| **Agent** | 现有 claw-agent.py 升级 | AI 推理 + 工具调用 + HITL 审批 |
| **编排** | Makefile + Python | 工具链执行 + 流水线管理 |
| **数据** | SQLite → PostgreSQL (长期) | 资产库 + 审计日志 + 会话存储 |
| **CLI/TUI** | 现有 catteam.sh | 保持完整，高级用户直接操作 |

---

## 三、GUI 设计方案

### 3.1 页面规划 (5 个核心页面)

```
┌─ 导航栏 ──────────────────────────────────────────────┐
│  🐱 CLAW   | Dashboard | Assets | Agent | Reports | ⚙️ │
└───────────────────────────────────────────────────────┘

Page 1: Dashboard (首页)
┌────────────────────────────────────────────────────────┐
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐│
│  │ 94 Hosts │  │ 342 Ports│  │ 12 Vulns │  │ 3 Creds││
│  └──────────┘  └──────────┘  └──────────┘  └────────┘│
│                                                        │
│  ┌─ 攻击面热力图 ─────────────┐  ┌─ 最新告警 ────────┐│
│  │                            │  │ [!] SMB 匿名访问  ││
│  │  10.130.0.x  ████████      │  │ [!] 默认凭据发现  ││
│  │  10.130.1.x  ██████        │  │ [~] 新增 3 主机   ││
│  └────────────────────────────┘  └──────────────────┘│
│                                                        │
│  ┌─ Agent 思维链 (实时) ──────────────────────────────┐│
│  │ 🧠 Lynx: 检测到 10.130.0.96 开放 445 端口...       ││
│  │ 🔧 claw_query_db → 查询历史凭据...                 ││
│  │ 🟡 建议执行 smbclient 匿名枚举 → [批准] [拒绝]     ││
│  └────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────┘

Page 2: Assets (资产视图)
- 网络拓扑图 (D3.js / vis.js 力导向图)
- 资产表格 (排序/过滤/搜索)
- 端口服务详情面板

Page 3: Agent (智能体)
- 对话界面 (类 ChatGPT)
- 思维链可视化 (工具调用流程)
- HITL 审批按钮 (在 Web 上确认/拒绝)
- 执行历史 + 审计日志

Page 4: Reports (报告)
- Markdown 渲染
- 一键导出 PDF
- 合规模板选择 (PTES/OWASP)

Page 5: Settings (设置)
- API Key 管理
- HITL 权限级别配置
- 环境切换
- Agent 模型选择 (Flash/Pro)
```

### 3.2 交互设计原则

1. **CLI 优先**: GUI 是 CLI 的可视化层，不替代 CLI
2. **实时同步**: WebSocket 推送 Agent 思维链和扫描进度
3. **HITL 多端**: CLI 和 GUI 都能审批 Agent 操作
4. **暗色主题**: 安全工具标配，减少视觉疲劳

### 3.3 技术栈推荐

| 组件 | 推荐 | 备选 | 理由 |
|---|---|---|---|
| 前端框架 | **React + Vite** | Vue 3 | 生态最大，Mythic 也用 React |
| UI 库 | **Tailwind + shadcn/ui** | Ant Design | 暗色主题友好，现代感 |
| 图表 | **Recharts** | ECharts | React 原生集成 |
| 网络图 | **vis.js** | D3.js | 力导向图开箱即用 |
| 后端 | **FastAPI** | Flask | 原生异步 + 自动文档 |
| 实时通信 | **WebSocket** | SSE | 双向通信 |

---

## 四、工具集成路线

### 4.1 现有工具 (V1-V7 已集成)

| 工具 | 类型 | 集成方式 |
|---|---|---|
| Nmap | 侦察 | Docker + XML 解析 |
| Responder | 投毒 | Mac 原生 |
| Hashcat | 破解 | Mac GPU (Metal) |
| Impacket | 横移 | Docker (psexec/secretsdump) |
| Nuclei | 漏洞 | Docker + JSONL 解析 |
| binwalk | 逆向 | Docker |
| httpx | Web 指纹 | Docker / 纯 Python |

### 4.2 待集成工具 (V8.0 规划)

| 工具 | 类型 | 优先级 | 集成方式 |
|---|---|---|---|
| **Sliver** | C2 框架 | P0 | 独立部署，gRPC API |
| **Ligolo-ng** | 隧道穿透 | P0 | 独立部署 |
| **CrackMapExec** | AD 批量 | P1 | Docker |
| **Certipy** | AD CS 攻击 | P1 | Docker |
| **BloodHound CE** | AD 图谱 | P1 | Docker + Neo4j |
| **Chisel** | HTTP 隧道 | P2 | 二进制 |
| **ffuf** | Web Fuzz | P2 | Docker |
| **SQLMap** | SQL 注入 | P2 | Docker (已有) |

### 4.3 请导师推荐的工具类型

1. **云环境渗透**: AWS/Azure/GCP 专用工具 (如 Pacu, ScoutSuite)
2. **容器安全**: Kubernetes 渗透工具 (如 kube-hunter)
3. **无线网络**: WiFi 审计工具 (如 aircrack-ng)
4. **API 安全**: RESTful API 测试工具
5. **移动安全**: Android/iOS 审计工具

---

## 五、后端 API 设计

### 5.1 核心 API 端点

```
/api/v1/
├── auth/
│   ├── POST /login            # JWT 登录
│   └── POST /refresh          # Token 刷新
├── assets/
│   ├── GET  /list             # 资产列表
│   ├── GET  /{ip}/detail      # 资产详情
│   └── GET  /topology         # 网络拓扑数据
├── agent/
│   ├── POST /chat             # 发送消息给 Agent
│   ├── GET  /history          # 对话历史
│   ├── POST /approve/{id}     # HITL 审批
│   └── GET  /audit            # 审计日志
├── scans/
│   ├── POST /run              # 启动扫描
│   ├── GET  /status           # 扫描状态
│   └── GET  /results          # 扫描结果
├── reports/
│   ├── POST /generate         # 生成报告
│   └── GET  /download/{id}    # 下载报告
└── ws/
    └── WS  /stream            # WebSocket 实时推送
```

### 5.2 数据库升级方案

```
当前: SQLite (claw.db) — 4 张表
  ↓
V8.0: SQLite + 新表
  + agent_sessions  (Agent 会话)
  + agent_audit     (审计日志, 替代文件)
  + attack_paths    (攻击路径图谱)
  + credentials     (凭据管理)
  ↓
V9.0+ (长期): PostgreSQL
  + 并发支持 (多用户)
  + 全文检索
  + JSON 查询
```

---

## 六、导师讨论清单

### 战略决策 (需导师拍板)

1. **平台定位**: "AI 驱动的安全评估平台" vs "自动化红队框架"？定位决定 GUI 的侧重点
2. **开源策略**: 核心引擎是否开源？开源有助于社区贡献，但存在武器化风险
3. **GUI 技术栈**: React + FastAPI 是否合适？还是导师有其他推荐？

### 工程决策 (请导师建议)

4. **C2 选型确认**: Sliver (成熟/Go) vs Havoc (现代/C++)？或者自研轻量 C2？
5. **图数据库**: BloodHound 用 Neo4j，我们要不要也引入？还是用 SQLite 的 JSON 字段模拟？
6. **前端部署**: 打包为 Electron 桌面应用 vs 纯 Web 服务？

### 工具/能力 (请导师推荐)

7. **导师推荐工具**: 上述待集成列表是否完整？是否有遗漏的关键工具？
8. **云安全方向**: 是否需要扩展到云环境渗透 (AWS/Azure)？
9. **合规标准**: 除了 PTES/OWASP 外，还需要支持哪些合规框架？

### 能力边界 (请导师把关)

10. **自主权上限**: Agent 在 GUI 中是否允许"一键全自动"模式（从侦察到报告无人介入）？
11. **演示环境**: 是否需要内置靶场 (如 DVWA/Juice Shop) 用于教学演示？

---

## 七、实施阶段建议

```
Phase 1 (V8.0-alpha): 基础 Web Dashboard     [2-3 周]
  → FastAPI 后端 + React 前端
  → Dashboard + Assets + Agent 对话页面
  → WebSocket 实时推送

Phase 2 (V8.0-beta): 工具深度集成             [2-3 周]
  → Sliver C2 + Ligolo-ng
  → 攻击路径可视化
  → 合规报告模板

Phase 3 (V8.0): 协作与安全                    [1-2 周]
  → JWT 认证 + 多用户
  → 完整审计链
  → 部署文档
```

---

*本文档涵盖了 Project CLAW 从"框架"进化到"作战平台"的完整技术蓝图。请导师重点审阅第六节的 11 个决策议题。*
