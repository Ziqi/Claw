# CatTeam 架构设计文档 V8.2 / A2.1

## 1. 平台定位与行业对标

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

CLAW V7.0: 工具集 → 框架 (已跨越: 有编排+数据层+Agent)
CLAW V8.0: 框架 → 作战平台 (GUI + 协作 + 审计 + 态势感知)
CLAW V8.2: 引入多战区隔离机制与流式作战流水线 (Operation Pipeline)
```

### 1.2 竞品对标

| 系统 | 类型 | 界面 | 开源 | 核心能力 |
|---|---|---|---|---|
| **Kali Linux** | 工具集 | CLI | ✅ | 600+ 工具预装 |
| **Metasploit** | 框架 | CLI + Armitage | ✅ | exploit 库 + payload```
┌──────────────────────────────────────────┐
│    🖥️ Web Dashboard (React + Vite)        │ ← V8.2 (MCP+流水线+审计)
│  Bloomberg Terminal UI · lucide-react SVG  │
│  HUD/Activity Bar/AI Copilot/OP/拓扑图    │
├──────────────────────────────────────────┤
│    🌐 API 层 (FastAPI)                    │ ← V8.2
│  /api/v1/ops/run · ops/log · env/switch  │
├──────────────────────────────────────────┤
│         控制面 (Makefile v5.0 + TUI)      │
│   preflight → run/fast/phantom/crack/... │
├──────────────────────────────────────────┤
│    🗡️ MCP 层 (Model Context Protocol)    │ ← V8.2 NEW
│  mcp_armory_server.py: 工具 → MCP Tool    │
│  agent_mcp.py: stdio 动态发现+缓存 schema │
├──────────────────────────────────────────┤
│      🧠 Agent 层 (Gemini 3 via MCP)       │
│  ReAct Loop + HITL 三级分权              │
│  MCP Tools: query_db/read_file/list      │
│    /execute_shell/run_module/sliver_exec  │
├──────────────────────────────────────────┤
│         AI 辅助层 (Gemini Flash)            │
│  16-ai-analyze / 17-ask-lynx / 脱敏层    │
├──────────────────────────────────────────┤
│         合规层 (scope.txt ROE)             │
│  白名单 CIDR 校验 + 黑名单过滤              │
├──────────────────────────────────────────┤
│         模块层 (00-17)                    │
│  侦察链: 00→01(passive|active)→02→02.5   │
│  审计层: 03-audit / 03-web / Nuclei      │
│  攻击链: 04→05→06                        │
│  情报层: 07-report / 08-diff             │
│  后渗透: 09-loot / 10-kerberoast         │
├──────────────────────────────────────────┤
│         数据层 (双写架构)                  │
│  SQLite: claw.db (AI Text-to-SQL)        │
│  JSON:   live_assets.json (jq 兼容)      │
│  隔离:   CatTeam_Loot/{RUN_ID}/          │
├──────────────────────────────────────────┤
│         基础设施层                         │
│  Mac 宿主机 ─── Volume ──→ Docker Kali   │
├──────────────────────────────────────────┤
│         质量层 (make test)                 │
│  Docker Compose 自动化靶场验证             │
└──────────────────────────────────────────┘
```�──────────────┤
│    🌐 API 层 (FastAPI)                    │ ← V8.2 NEW
│  /api/v1/ops/run · ops/log · env/switch  │
├──────────────────────────────────────────┤
│         控制面 (Makefile v5.0 + TUI)      │
│   preflight → run/fast/phantom/crack/... │
├──────────────────────────────────────────┤
│ 🧠 Agent 智能层 (Gemini 3.1 SDK + SQLite) │ ← V9.1 NEW
│  agent_mcp.py: Types.Content 记忆管线重塑  │
│  原生云能力: Google Search / Code Sandbox │
│  内部武库: execute_shell/run_module/...   │
├──────────────────────────────────────────┤
│         AI 辅助层 (Gemini Flash)            │
│  16-ai-analyze / 17-ask-lynx / 脱敏层    │
├──────────────────────────────────────────┤
│         合规层 (scope.txt ROE)             │
│  白名单 CIDR 校验 + 黑名单过滤              │
├──────────────────────────────────────────┤
│         模块层 (00-17)                    │
│  侦察链: 00→01(passive|active)→02→02.5   │
│  审计层: 03-audit / 03-web / Nuclei      │
│  攻击链: 04→05→06                        │
│  情报层: 07-report / 08-diff             │
│  后渗透: 09-loot / 10-kerberoast         │
├──────────────────────────────────────────┤
│         数据层 (双写架构)                  │
│  SQLite: claw.db (AI Text-to-SQL)        │
│  JSON:   live_assets.json (jq 兼容)      │
│  隔离:   CatTeam_Loot/{RUN_ID}/          │
├──────────────────────────────────────────┤
│         基础设施层                         │
│  Mac 宿主机 ←── Volume ──→ Docker Kali   │
├──────────────────────────────────────────┤
│         质量层 (make test)                 │
│  Docker Compose 自动化靶场验证             │
└──────────────────────────────────────────┘
```

---

## 4. 全模块职责矩阵

### 侦察链 (Recon Chain)

| 模块 | 环境 | 输入 | 输出 | 关键特性 |
|---|---|---|---|---|
| `00-armory` | Mac | en0 | 新 IP | DHCP 超时保护 (10s) |
| `01-recon` | Mac (sudo) | 网络流量 | `targets.txt` | 正则提取, 黑名单过滤, trap 清理 |
| `02-probe` | Docker | `targets.txt` | `nmap_results.*` | PROFILE 端口切换, 日志保留 |
| `02.5-parse` | Mac (Python) | `nmap_results.xml` | `live_assets.json` + `claw.db` | 双写: SQLite + JSON |

### 审计层 (Audit Layer)

| 模块 | 环境 | 输入 | 输出 | 关键特性 |
|---|---|---|---|---|
| `03-audit` | Docker | `live_assets.json` | `httpx_results.txt` | httpx 应用层指纹 |
| `03-audit-web` | Mac (Python) | `live_assets.json` | `web_fingerprints.txt` | 纯 Python, 10 线程并发 |
| `03-exploit-76` | Mac (Python) | 硬编码 IP | 终端输出 | VNC Banner + SMB 匿名探测 |

### 攻击链 (Attack Chain)

| 模块 | 环境 | 输入 | 输出 | 关键特性 |
|---|---|---|---|---|
| `04-phantom` | **Mac 原生** | en0 网卡 | `captured_hash.txt` | 原生 Responder, 实时 Hash 清洗管线 |
| `05-cracker` | **Mac 原生** | `captured_hash.txt` | `cracked_passwords.txt` | 宿主机 Hashcat (GPU/Metal) |
| `06-psexec` | Docker | `live_assets.json` + 凭据 | `lateral_results.txt` | Impacket smbexec, 凭据自动加载 |

### 情报层 (Intelligence Layer)

| 模块 | 环境 | 输入 | 输出 | 关键特性 |
|---|---|---|---|---|
| `07-report` | Mac (Python) | 所有 Loot 文件 | `CatTeam_Report.md` | 端口热力榜, 凭据脱敏, 风险评级 |
| `08-diff` | Mac (Python) | `claw.db` (fallback JSON) | `asset_diff.json` | SQL EXCEPT 差异引擎 |

### AI 副官 (v5.0 新增)

| 模块 | 环境 | 输入 | 输出 | 关键特性 |
|---|---|---|---|---|
| `db_engine` | Mac (Python) | — | `claw.db` | 四张表 (带有 `env` 字段支持多靶场隔离) |
| `16-ai-analyze` | Mac (Python) | `claw.db` + `web_fingerprints.txt` (最高频同步) | 终端输出 | Gemini Flash 战术分析, 解决时序差异 |
| `17-ask-lynx` | Mac (Python) | `claw.db` + `web_fingerprints.txt` | 终端对话 | 多轮对话, 滑动窗口 10 轮 |

### 工具箱 (v5.0.1 新增)

| 模块 | 环境 | 输入 | 输出 | 关键特性 |
|---|---|---|---|---|
| `11-webhook` | Mac (Python) | `08-diff` 结果 | `alerts/` 目录 | 自动 Diff + AI 分析 + macOS 通知 |
| `scripts/firmware-autopsy` | Mac (Python) | `.bin` 固件文件 | 终端输出 | 零依赖 binwalk 替代, CVE 签名猎杀 |
| `scripts/examples/20-*` | Mac (Python) | IP | 终端输出 | TP-Link CVE PoC (实战参考) |
| `scripts/examples/22-*` | Mac (Python) | IP | 终端输出 | HP 多协议探测 (实战参考) |

### 战术升级 (v5.0.1-B 新增)

| 模块 | 环境 | 输入 | 输出 | 关键特性 |
|---|---|---|---|---|
| `18-ai-bloodhound` | Mac (Python) | BloodHound JSON/ZIP | 终端输出 | Gemini 图论推理 AD 域提权路径 |
| `23-hp-proxy-unlocker` | Mac (Python) | IP + 凭据字典 | 终端输出 | 4 阶段代理解锁: 端口→状态→爆破→隧道 |
| `make toolbox` | Docker/Mac | 交互选择 | 各工具输出 | Nikto/Hydra/Sqlmap/binwalk/固件解剖刀 |

### 🧠 Agent 智能体 (V7.0 新增, V8.2 MCP 迁移)

| 模块 | 环境 | 输入 | 输出 | 关键特性 |
|---|---|---|---|---|
| `agent_mcp.py` | Mac (Python) | 自然语言 | 智能分析 + 命令执行 | Gemini 3, MCP 动态工具发现, 缓存式 schema |
| `mcp_armory_server.py` | Mac (Python) | MCP stdio | 工具执行结果 | 标准 MCP Server, 6 个 Tool |
| MCP Tool: `claw_query_db` | 内嵌 | SQL | JSON | 只允许 SELECT, 自动放行 |
| MCP Tool: `claw_read_file` | 内嵌 | 文件路径 | 文件内容 | 路径穿越防护, 支持 Loot + 项目根目录 |
| MCP Tool: `claw_list_assets` | 内嵌 | 环境名 | 资产清单 | 自动放行 |
| MCP Tool: `claw_execute_shell` | 内嵌 | shell 命令 | 执行结果 | HITL 三级分权 |
| MCP Tool: `claw_run_module` | 内嵌 | make 命令 | 执行结果 | HITL 三级分权 |
| MCP Tool: `claw_sliver_exec` | 内嵌 | C2 指令 | 执行结果 | HITL RED 级 |

---

## 5. 模块递进关系与数据流

```mermaid
graph TD
    CFG[config.sh] -.->|source| ALL[所有模块]

    subgraph 侦察链
        A[00-armory<br/>DHCP换脸] --> B[01-recon<br/>嗅探+黑名单]
        B -->|targets.txt| C[02-probe<br/>Nmap扫描]
        C -->|nmap_results.xml| D[02.5-parse<br/>XML→JSON]
    end

    subgraph 审计层
        D -->|live_assets.json| E1[03-audit<br/>httpx]
        D -->|live_assets.json| E2[03-audit-web<br/>手搓httpx]
    end

    subgraph 攻击链
        F[04-phantom<br/>Responder投毒] -->|"captured_hash.txt"| G[05-cracker<br/>Hashcat破解]
        G -->|"cracked_passwords.txt"| H[06-psexec<br/>横向移动]
        D -->|"live_assets.json<br/>SMB目标"| H
    end

    subgraph 情报层
        H --> I[07-report<br/>战报生成]
        D --> I
        D --> J[08-diff<br/>资产变化]
    end

    style A fill:#ff9800
    style B fill:#2196f3,color:#fff
    style C fill:#f44336,color:#fff
    style D fill:#9c27b0,color:#fff
    style E1 fill:#e91e63,color:#fff
    style E2 fill:#e91e63,color:#fff
    style F fill:#b71c1c,color:#fff
    style G fill:#ff5722,color:#fff
    style H fill:#d50000,color:#fff
    style I fill:#1565c0,color:#fff
    style J fill:#1565c0,color:#fff
```

### 数据文件依赖链

```
模块输出                    →  下游消费者
─────────────────────────────────────────
targets.txt                →  02-probe
nmap_results.xml           →  02.5-parse
claw.db                    →  08-diff, 16-ai-analyze, 17-ask-lynx (按 env 过滤)
live_assets.json           →  03-audit, 03-web, 06-psexec, 07-report
web_fingerprints.txt       →  16-ai-analyze, 17-ask-lynx (从 latest 目录直读)
captured_hash.txt          →  05-cracker
cracked_passwords.txt      →  06-psexec (自动加载), 07-report
lateral_results.txt        →  07-report
asset_diff.json            →  07-report (可选)
```

> **三条链 + 一个汇聚点**：侦察链 (00→02.5) 负责发现；攻击链 (04→06) 负责突破；情报层 (07/08) 汇总所有产出生成可交付物。

---

## 6. 混合执行模型

### 为什么不全用 Docker？

| 场景 | Mac 宿主机 | Docker 容器 | 原因 |
|---|---|---|---|
| L2 嗅探 (tcpdump) | ✅ | ❌ | 容器听不到物理网卡广播 |
| Responder 投毒 | ✅ | ❌ | 同上，macOS Docker `--network host` 不生效 |
| Hashcat 破解 | ✅ | ❌ | Docker 无法穿透 Apple Silicon GPU |
| Nmap 扫描 | ❌ | ✅ | 应用层 TCP 可穿透 NAT |
| Impacket 横移 | ❌ | ✅ | 应用层 SMB, 且依赖隔离 |
| 数据解析 (Python) | ✅ | ❌ | 轻量操作无需容器开销 |

---

## 7. 任务隔离机制

```
CatTeam_Loot/
├── 20260325_010000/        ← make run 第一次
│   ├── catteam.log          ← 统一日志
│   ├── targets.txt
│   ├── nmap_results.*
│   ├── live_assets.json
│   ├── captured_hash.txt    ← 04 输出
│   ├── cracked_passwords.txt ← 05 输出
│   ├── lateral_results.txt  ← 06 输出
│   ├── CatTeam_Report.md    ← 07 输出
│   ├── asset_diff.json      ← 08 输出
│   ├── responder.pid        ← 04 进程管理
│   └── extractor.pid
├── 20260325_020000/        ← make run 第二次
└── latest → 20260325_020000
```

- 侦察链 (`make run/fast`) 创建新 `RUN_ID` 目录
- 攻击链 (`make phantom/crack/lateral`) 使用 `USE_LATEST=true` 附加到最新目录

---

## 8. 错误处理策略

| 场景 | 策略 |
|---|---|
| DHCP 卡死 | 后台执行 + 超时强制终止 |
| tcpdump Ctrl+C | `trap INT TERM` 清理 |
| Docker 未启动 | Makefile `preflight` 拦截 |
| Responder 重复启动 | PID 检测 + 拒绝重复点火 |
| Hash 格式截断 | `sed` 全行提取，不用 awk 切割 |
| Hashcat 找不到字典 | 自动搜索 3 个常见路径 |
| 凭据硬编码 | 环境变量 > 05自动加载 > 交互输入 (绝不走 CLI) |
| 密码暴露在 history | OPSEC: 禁止命令行参数传递密码 |
| `jq` 在 Mac 不存在 | 用 Python 替代 JSON 解析 |
| 多次运行覆盖数据 | 时间戳目录隔离 |

---

## 9. REST API 规范 (V8.0)

```
/api/v1/
├── stats/                  # GET  — HUD 统计数据 (hosts/ports/vulns)
├── assets/                 # GET  — 资产列表 (分页/搜索)
├── topology/               # GET  — 网络拓扑数据 (vis.js 格式)
├── attack_matrix/          # GET  — ATT&CK 矩阵覆盖数据
├── scans/                  # GET  — 扫描记录
├── sliver/sessions         # GET  — C2 会话列表
├── armory/                 # GET  — 武器库模块列表
├── env/
│   ├── GET  /list           # 战区列表 + 当前战区
│   ├── POST /switch         # 切换战区
│   ├── POST /create         # 创建战区
│   └── POST /delete         # 删除战区
├── ops/
│   ├── POST /run            # 启动作战流水线步骤 (subprocess.Popen)
│   └── GET  /log/{job_id}   # SSE 流式日志追踪
├── probe/
│   └── POST /run            # 发起探测扫描
├── agent/
│   ├── POST /chat           # SSE 流式对话 (MCP ReAct Loop)
│   └── GET  /campaigns      # 会话历史列表
├── docker/
│   ├── GET  /status          # 容器/镜像状态
│   └── POST /{action}/{name} # 容器控制 (start/stop/restart)
└── ws/
    └── WS   /terminal        # WebSocket PTY 终端
```

---

## 10. 数据库演进路线

```
当前 V7.0: SQLite (claw.db) — 4 张表 (scans/assets/ports/vulns)
    ↓
V8.0: SQLite + 扩展表
  + conversations     (Agent 会话持久化)
  + messages          (多轮对话记录)
  + agent_audit       (审计日志, 替代文件)
  + attack_paths      (攻击路径图谱)
  + credentials       (凭据管理)
  + pending_actions   (HITL Action Token 队列)
    ↓
V9.0+ (长期): PostgreSQL
  + 并发支持 (多用户协作)
  + 全文检索
  + JSONB 查询
```

---

## 11. 工具集成路线

### 已集成 (V1-V7)

| 工具 | 类型 | 集成方式 |
|---|---|---|
| Nmap | 侦察 | Docker + XML 解析 |
| Responder | 投毒 | Mac 原生 |
| Hashcat | 破解 | Mac GPU (Metal) |
| Impacket | 横移 | Docker (psexec/secretsdump) |
| Nuclei | 漏洞 | Docker + JSONL 解析 |
| binwalk | 逆向 | Docker |
| httpx | Web 指纹 | Docker / 纯 Python |

### 待集成 (V8.0 规划, 导师已批准)

| 工具 | 类型 | 优先级 | 集成方式 |
|---|---|---|---|
| **NetExec (nxc)** | AD 批量 | P0 | Docker (D9 定调, 替代 CrackMapExec) |
| **Certipy** | AD CS 攻击 | P1 | Docker (D9 定调) |
| **Sliver** | C2 框架 | P1 | 独立部署, gRPC API |
| **Ligolo-ng** | 隧道穿透 | P1 | 独立部署 |
| **BloodHound CE** | AD 图谱 | P2 | Docker + Neo4j |
| **Chisel** | HTTP 隧道 | P2 | 二进制 |
