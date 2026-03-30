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

AI-Native C4ISR 态势感知指挥中枢 · Generative Interface (HUD) · FastAPI + React · Gemini 3.1 Pro

[![Version](https://img.shields.io/badge/V9.3-blue)]()
[![Agent](https://img.shields.io/badge/Agent-A3.0%20MCP-green)]()
[![Dashboard](https://img.shields.io/badge/Dashboard-Bloomberg%20HUD-black)]()
[![AI](https://img.shields.io/badge/AI-Gemini%203.1%20Pro-orange)]()
[![License](https://img.shields.io/badge/license-Private-red)]()

</div>

---

## 快速开始

```bash
# 克隆项目
git clone https://github.com/Ziqi/Claw.git && cd Claw

# 配置 (首次)
cp config.sh.example config.sh   # 编辑填入你的 Gemini API Key
vim scope.txt                     # 填入授权网段 (CIDR)

# 启动 Web Dashboard
cd ~/CatTeam && uvicorn backend.main:app --reload --port 8000 &
cd ~/CatTeam/frontend && npm install && npm run dev
# 打开 http://localhost:5173
```

## 系统架构

```
  Kali VM (武器库)             CLAW (指挥中枢 / Mac)        Gemini CLI (前线参谋)
  ──────────                   ──────────                    ──────────
  aircrack-ng / hashcat        雷达大屏 (Bloomberg HUD)      终端内 AI 分析
  nmap / nuclei / hydra        资产数据库 (SQLite)           协助人工决策
  Wireshark / Kismet           AI 研判引擎 (Gemini 3.1)     辅助命令编写
  claw_wifi_sensor.py          MCP 工具调用监控台
                               战报自动生成
                               探针健康监控

  [人工执行攻击]               [自动展示态势]                [AI 辅助思考]
```

### 部署拓扑 (V9.3)

```
┌─────────────────────────────────┐
│  MacBook Air (指挥台)            │
│  ├── 浏览器 → CLAW Web UI       │
│  │    ├── 态势感知雷达 (WiFi RF) │
│  │    ├── 资产列表 + 全局多选    │
│  │    ├── AI Copilot (MCP 研判)  │
│  │    ├── MCP 工具调用监控台     │
│  │    └── 战报导出               │
│  ├── 后端 (uvicorn :8000)       │
│  └── Antigravity (架构 AI)      │
└────────────┬────────────────────┘
             │ SSH / HTTP
             ▼
┌─────────────────────────────────┐
│  Kali VM (武器库 + 探针)         │
│  ├── ALFA 网卡 + 9dBi 天线      │
│  ├── 人工操作 aircrack-ng 套件   │
│  ├── Gemini CLI (AI 辅助思考)   │
│  ├── claw_wifi_sensor.py (探针)  │
│  │    └── POST → CLAW /ingest   │
│  └── nmap / nuclei / hydra 原生  │
└─────────────────────────────────┘
```

## LYNX Agent (V9.3 / A3.0 MCP 架构)

基于 **Gemini 3.1 Pro** 构建的 ReAct 智能体，通过 MCP (Model Context Protocol) 控制战区。内置 Cloud Python Execution 与 Google Search Grounding。

| 工具 | 能力 | 安全等级 |
|---|---|---|
| `claw_query_db` | SQLite 资产查询 | GREEN (自动) |
| `claw_read_file` | 文件读取 | GREEN (自动) |
| `claw_list_assets` | 资产清单列表 | GREEN (自动) |
| `claw_execute_shell` | Kali 远程命令执行 | YELLOW/RED (HITL) |

**HITL 三级分权：**
- GREEN: `ls`, `cat`, `grep` → 自动放行
- YELLOW: `nmap`, `nikto` → 需确认 [Y/n]
- RED: `psexec`, `hashcat` → 需输入 CONFIRM

**降级保障：** Gemini Pro 不可用时自动降级至 Flash 模型，保证 AI 链路不中断。

## V9.3 核心功能

### 态势感知
- **WiFi 雷达面板**：实时 802.11 态势感知，支持 RSSI Sparkline 微折线图
- **AP Ghosting 残影**：断联 AP 逐渐消隐，>5min 移入历史折叠区
- **探针健康指示**：HudBar 实时显示 ALFA 探针在线/离线状态
- **加密类型高亮**：WEP/OPEN 红色高危 / WPA2 黄色 / WPA3 绿色

### 指挥控制
- **CampaignPipeline**：4 阶段战术管线（战区锚定→服务指纹→威胁研判→战报输出）
- **Mission Briefing**：6 个预制战术意图 Chips + 全域推送 + 活跃状态指示
- **多战区管理**：SQLite 环境隔离，一键切换战区
- **全局多选标靶**：批量选中目标，AI 联合研判

### AI 研判
- **MCP 工具调用监控台**：实时展示 AI 的工具调用过程和结果
- **AI Copilot**：Gemini 3.1 Pro + ReAct 循环 + MCP 工具链
- **Google Grounding**：全网漏洞情报搜索
- **Cloud Code Execution**：云端 Python 沙箱
- **战报自动生成**：一键导出 PTES 格式 Markdown 报告

## 安全特性

| 特性 | 说明 |
|---|---|
| **ROE 白名单** | `scope.txt` + `scope_check.py` 双重校验 |
| **HITL 分权** | Agent 执行命令受三级审批控制 |
| **环境隔离** | SQLite `env` 字段多租户隔离 |
| **Sudo 防注入** | 自动转义特殊字符，防止命令注入 |
| **API Key 保护** | `config.sh` 已加入 `.gitignore` |
| **审计日志** | Agent 操作记录到 `agent_audit.log` |

## 环境要求

| 依赖 | 用途 | 安装 |
|---|---|---|
| macOS | 宿主机平台 | -- |
| Python 3.x | 核心脚本引擎 | 系统自带 |
| Kali Linux VM | 武器库 + ALFA 探针 | VMware / UTM |
| Gemini API Key | AI 智能体 | [申请](https://aistudio.google.com/apikey) |
| ALFA 网卡 | 无线侦察 (可选) | RTL8812AU |

## 版本演进

```
V1.0 (基础链) → V2.0 (工程化) → V3.0 (攻击链) → V4.0 (合规/AD)
     → V5.0 (SQLite+AI) → V7.0 (Agentic AI) → V8.0 (Web Dashboard)
     → V9.0 (智能大屏) → V9.1 (护城河加固)
     → V9.2 (Deep Autonomy) → V9.3 (Electro-Phantom) ← 当前版本
```

## 文档索引

| 文档 | 内容 |
|---|---|
| [架构设计](docs/ARCHITECTURE.md) | 系统架构、数据流、模块矩阵 |
| [作战手册](docs/OPERATIONS.md) | 实战操作场景详解 |
| [开发路线](docs/ROADMAP.md) | V1.0 → V9.3 演进记录 |
| [技术标准](docs/CONVENTIONS.md) | 版本号 / 命名 / 编码规范 |
| [部署指南](docs/DEPLOYMENT.md) | Mac + Kali VM 部署架构 |
| [V9.3 路线图](docs/design/V93_ROADMAP.md) | V9.3 Sprint 计划 |
| [更新日志](CHANGELOG.md) | 每个版本的详细变更 |

---

<div align="center">

**仅供授权安全测试使用 -- 未经授权的渗透测试是违法行为**

Made with `/\_/\` by CatTeam

</div>
