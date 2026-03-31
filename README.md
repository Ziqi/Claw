<div align="center">

```
     /\_/\  
    ( o.o )  Project CLAW V9.3
     > ^ <   CatTeam Lateral Arsenal Weapon
    /|   |\  
   (_|   |_) Codename: Lynx · Electro-Phantom
```

# Project CLAW

**C**atTeam **L**ateral **A**rsenal **W**eapon

AI-Native C4ISR 态势感知指挥中枢 · Bloomberg-Style HUD · FastAPI + React · Gemini 3.1 Pro

[![Version](https://img.shields.io/badge/version-V9.3_Electro--Phantom-blue)]()
[![Agent](https://img.shields.io/badge/Agent-A3.0%20MCP-green)]()
[![Dashboard](https://img.shields.io/badge/Dashboard-Bloomberg%20HUD-black)]()
[![AI](https://img.shields.io/badge/AI-Gemini%203.1%20Pro-orange)]()
[![Tests](https://img.shields.io/badge/tests-45%20passed-brightgreen)]()
[![License](https://img.shields.io/badge/license-Private-red)]()

</div>

---

## 系统定位

Project CLAW 是一个面向合法授权安全评估的 **AI 原生态势感知指挥中枢（C4ISR）**。它不是自动化攻击工具——所有攻击性操作均由人工在 Kali VM 终端确认执行。CLAW 专注于：

- 📡 **态势感知**：WiFi/IP 双域实时雷达，自动汇聚探针遥测数据
- 🤖 **AI 研判**：Gemini 3.1 Pro 驱动的 ReAct 智能体，辅助漏洞分析与作战决策
- 🛡️ **合规优先**：HITL 三级分权 + 审计日志，强制人类在回路

## 快速开始

```bash
# 1. 克隆项目
git clone https://github.com/Ziqi/Claw.git && cd Claw

# 2. 配置 (首次)
cp config.sh.example config.sh   # 编辑填入你的 Gemini API Key
vim scope.txt                     # 填入授权网段 (CIDR)

# 3. 安装依赖
pip install -r backend/requirements.txt
cd frontend && npm install && cd ..

# 4. 启动 (一键)
./claw-launch.sh
# 或手动:
# uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000 &
# cd frontend && npm run dev
# 浏览器打开 http://localhost:5173
```

## 系统架构

```
  ┌─────────────────────────────────────────────────────────────┐
  │  MacBook Air (指挥台 · CLAW Web UI)                          │
  │                                                             │
  │  ┌──────────────────┐  ┌──────────────┐  ┌──────────────┐  │
  │  │ Bloomberg HUD     │  │ AI Copilot   │  │ 战报引擎     │  │
  │  │ ├ WiFi 态势雷达   │  │ Gemini 3.1   │  │ PTES Report  │  │
  │  │ ├ 资产大盘        │  │ MCP ReAct    │  │ WiFi 审计    │  │
  │  │ ├ 全局多选标靶    │  │ 30-step Loop │  │ Markdown     │  │
  │  │ └ 探针健康监控    │  │ Google 情报  │  │ PDF 导出     │  │
  │  └──────────────────┘  └──────────────┘  └──────────────┘  │
  │                                                             │
  │  FastAPI :8000  ←─ SQLite (WAL) ─→  db_engine.py            │
  └───────────────────────┬─────────────────────────────────────┘
                          │ SSH / HTTP POST
                          ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  Kali VM (武器库 + 边缘探针)                                 │
  │                                                             │
  │  ├── ALFA 网卡 (RTL8812AU) + 9dBi 天线                      │
  │  ├── Monitor Mode → claw_wifi_sensor.py → POST /ingest      │
  │  ├── aircrack-ng / hashcat / nmap / nuclei                  │
  │  └── 所有攻击命令由人工终端执行 (HITL)                        │
  └─────────────────────────────────────────────────────────────┘
```

## LYNX Agent (A3.0 MCP 架构)

基于 **Gemini 3.1 Pro** 构建的 ReAct 智能体，通过 MCP (Model Context Protocol) 控制战区。内置 Cloud Python Execution 与 Google Search Grounding。

| 工具 | 能力 | 安全等级 |
|---|---|---|
| `claw_query_db` | SQLite 资产/WiFi 查询 | 🟢 GREEN (自动) |
| `claw_read_file` | 文件读取 (LFI 三层防护) | 🟢 GREEN (自动) |
| `claw_list_assets` | 资产清单列表 | 🟢 GREEN (自动) |
| `claw_db_import_nmap` | Nmap XML 入库 | 🟢 GREEN (自动) |
| `claw_execute_shell` | Shell 命令执行 | 🟡🔴 HITL |
| `claw_run_module` | 战术模块调用 | 🟡🔴 HITL |
| `claw_delegate_agent` | A2A 子智能体委托 | 🟢 (内部) |

**HITL 三级分权：**
- 🟢 **GREEN**: `ls`, `cat`, `grep`, `ping` → 自动放行
- 🟡 **YELLOW**: `nmap`, `nikto`, `curl` → 需确认
- 🔴 **RED**: `psexec`, `hashcat`, `rm -rf` → 物理熔断拦截

**安全加固：** Shell 元字符链路攻击检测 (Fail-Closed) + Sudo 密码管道脱敏 + 交互式命令阻断

## V9.3 核心功能

### 📡 态势感知
- **WiFi 雷达面板**：实时 802.11 态势感知，RSSI Sparkline 微折线图（15s TTL 自动刷新）
- **AP Ghosting 残影**：断联 AP 逐渐消隐，>5min 移入历史折叠区（UTC 时区对齐）
- **探针健康指示**：HudBar 实时显示 ALFA 探针 Online/Delayed/Offline 状态
- **加密类型高亮**：WEP/OPN → 🔴 高危 / WPA2 → 🟡 / WPA3 → 🟢

### 🎯 指挥控制
- **Mission Briefing**：6 个预制战术意图 Chips + 全域推送 + 活跃状态指示
- **多战区管理**：SQLite 环境隔离，一键切换，防串台 Drift Guard
- **全局多选标靶**：批量选中 IP/BSSID，AI 联合研判
- **48H 残影清除**：一键剔除超时离线节点，自动刷新大盘

### 🤖 AI 研判
- **MCP 工具调用监控台**：实时展示 AI 的工具调用链路和结果
- **AI Copilot**：Gemini 3.1 Pro + 30-step ReAct 循环 + MCP 工具链
- **WiFi 分析模板**：5 种预设 SQL 查询模板（全域、弱加密、信道拥堵、信号趋势、陌生设备）
- **Google Grounding**：全网漏洞情报搜索
- **Cloud Code Execution**：云端 Python 沙箱
- **降级保障**：Pro 不可用时自动降级 Flash，保证 AI 链路不中断

### 📊 战报引擎
- **PTES 格式报告**：自动生成含 WiFi RF 章节的 Markdown 报告
- **NUL severity 防护**：优雅处理缺失字段，不崩溃

## 安全特性

| 特性 | 说明 |
|---|---|
| **HITL 三级分权** | GREEN/YELLOW/RED 命令三级审批 |
| **Shell 元字符检测** | 管道/子shell/反引号 Fail-Closed 升级为 RED |
| **LFI 三层物理沙箱** | 系统目录阻断 → 白名单校验 → 凭据文件黑名单 |
| **SQL 注入防护** | DROP/DELETE/INSERT/ALTER 等关键字拦截 |
| **探针认证** | `Authorization: Bearer` Token 鉴权 |
| **Sudo 密码脱敏** | 日志和报错中自动剥离密码管道 |
| **审计日志** | Agent 操作记录到 `agent_audit.log`（防日志注入） |
| **API Key 保护** | `config.sh` + `.env` 已加入 `.gitignore` |

## 测试

```bash
# 运行全量测试套件 (45 项, 覆盖 7 大维度)
python -m pytest tests/test_claw_v93.py -v

# 测试维度:
# T1. 数据库引擎 (7)  — CRUD, WAL, 环境隔离, WiFi schema
# T2. REST API   (13) — 全端点覆盖 (stats/sync/assets/sensors/env/report)
# T3. 数据一致性 (3)  — stats-sync 口径对齐, 资产数/端口数一致
# T4. 安全机制   (9)  — HITL 分级, 元字符升级, LFI, SQL 注入
# T5. 报告生成   (2)  — NULL 防护, 版本号
# T6. 版本对齐   (4)  — V8 残留, Docker 残留
# T7. 前端契约   (7)  — API 返回结构 vs 前端期望
```

## 环境要求

| 依赖 | 用途 | 安装 |
|---|---|---|
| macOS | 宿主机平台 | -- |
| Python 3.10+ | 后端 + Agent | 系统自带 |
| Node.js 18+ | 前端 (React + Vite) | `brew install node` |
| Kali Linux VM | 武器库 + 探针 | VMware / UTM |
| Gemini API Key | AI 智能体 | [申请](https://aistudio.google.com/apikey) |
| ALFA 网卡 | 无线侦察 (可选) | RTL8812AU |

## 项目结构

```
CatTeam/
├── backend/
│   ├── main.py              # FastAPI REST API (1278 行)
│   ├── agent_mcp.py         # MCP ReAct 循环 (626 行)
│   ├── agent.py             # Legacy Agent (保留参考)
│   ├── mcp_armory_server.py # MCP 工具服务器 (562 行)
│   └── recon_agent_server.py # A2A 子智能体
├── frontend/src/
│   ├── App.jsx              # 主 UI 组件 (3256 行)
│   ├── store.js             # Zustand 状态管理
│   └── index.css            # Bloomberg HUD 设计系统
├── db_engine.py             # SQLite 数据引擎
├── tests/
│   └── test_claw_v93.py     # V9.3 全量测试套件 (45 项)
├── docs/
│   ├── ARCHITECTURE.md      # 系统架构设计
│   ├── DEPLOYMENT.md        # 部署指南
│   ├── OPERATIONS.md        # 作战手册
│   ├── ROADMAP.md           # 版本演进路线
│   ├── CONVENTIONS.md       # 编码规范
│   └── design/
│       ├── V93_ROADMAP.md   # V9.3 Sprint 计划
│       └── V93_DETAILED_DESIGN.md
└── CHANGELOG.md             # 变更日志
```

## 版本演进

```
V1.0 → V2.0 → V3.0 → V4.0 → V5.0 → V7.0 → V8.0 → V9.0 → V9.1 → V9.2 → V9.3
基础链  工程化   攻击链  合规/AD  SQLite   Agentic  Web HUD  大屏    护城河   深度自治  电幻猎影
                                          AI                                         ← 当前
```

---

<div align="center">

**⚠️ 仅供合法授权安全测试使用 — 未经授权的渗透测试是违法行为 ⚠️**

Made with `/\_/\` by CatTeam · Codename Lynx

</div>
