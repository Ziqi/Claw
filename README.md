<div align="center">

```
     /\_/\  
    ( o.o )  Project CLAW V10.0
     > ^ <   CatTeam Lateral Arsenal Weapon
    /|   |\  
   (_|   |_) Codename: Lynx · Protocol Anatomy
```

# Project CLAW

**C**atTeam **L**ateral **A**rsenal **W**eapon

协议级态势感知引擎 · AI 辅助 IDS 规则生成 · Bloomberg-Style HUD

[![Version](https://img.shields.io/badge/version-V10.0_Protocol_Anatomy-blue)]()
[![Agent](https://img.shields.io/badge/Agent-A3.0%20MCP-green)]()
[![Dashboard](https://img.shields.io/badge/Dashboard-Bloomberg%20HUD-black)]()
[![AI](https://img.shields.io/badge/AI-Gemini%203.1%20Pro-orange)]()
[![Tests](https://img.shields.io/badge/tests-64%20passed-brightgreen)]()
[![License](https://img.shields.io/badge/license-Academic-purple)]()

</div>

---

## What is CLAW?

CLAW 是一个面向**学术研究与合法授权安全评估**的 AI 原生态势感知平台。它不执行攻击——所有攻击性操作均在 Kali VM 终端由人工确认。

**核心能力**：多源协议遥测汇聚 → 实时态势可视化 → AI 研判分析 → 学术战报输出

```
┌─────────── 探针层 ───────────┐     ┌──────────── 中枢层 ────────────┐     ┌──── AI 层 ────┐
│                               │     │                                │     │                │
│  Kali VM (武器库)             │     │  Mac (CLAW 指挥中枢)           │     │  Gemini 3.1    │
│  ├ LLMNR/ARP 协议探针  ──────POST──→  FastAPI :8000                 │     │  Pro / Flash   │
│  ├ ALFA WiFi 射频探针  ──────POST──→  ├ 告警引擎 (protocol_alerts)  │←───→│  30-step ReAct │
│  └ Nmap/Nuclei 扫描    ─────SSH───→  ├ 资产引擎 (assets/ports)     │     │  MCP 工具链    │
│                               │     │  └ WAL SQLite                  │     │  Google Search │
└───────────────────────────────┘     │                                │     └────────────────┘
                                      │  React HUD :5173               │
                                      │  ├ 指挥座舱 (HQ)              │
                                      │  ├ WiFi 雷达 (RF)             │
                                      │  ├ 协议告警 (PA) ← V10.0 NEW │
                                      │  └ 数字兵站 (DP)              │
                                      └────────────────────────────────┘
```

## V10.0 新特性

### 🔬 协议级态势感知

| 能力 | 实现 |
|---|---|
| **LLMNR/NBT-NS 毒化检测** | Scapy 探针 → UDP 5355 流量分析 |
| **ARP 欺骗检测** | MAC 漂移追踪 + 网关绑定校验 |
| **暴力破解感知** | 认证失败频率统计 (SSH/RDP/SMB) |
| **告警大屏** | 严重度色标 + MITRE ATT&CK TTP + 实时筛选 |
| **AI 规则生成** | 一键将告警特征发送 AI → 生成 Suricata IDS 规则 |

### 📡 HUD 四视图

| 视图 | 功能 |
|---|---|
| **HQ** 指挥座舱 | C4ISR 管线 + Mission Briefing + 全域侦察概览 |
| **RF** 无线电场 | 802.11 实时雷达，RSSI Sparkline，AP Ghosting |
| **PA** 协议告警 | 协议异常时间线，告警确认，IDS 规则生成 |
| **DP** 数字兵站 | 靶标资产表 + Kali 工具手册 |

## 快速开始

```bash
# 1. 克隆
git clone https://github.com/Ziqi/Claw.git && cd Claw

# 2. 配置
cp config.sh.example config.sh    # 填入 Gemini API Key
vim scope.txt                      # 填入授权网段

# 3. 安装
pip install -r backend/requirements.txt
cd frontend && npm install && cd ..

# 4. 启动
./claw-launch.sh
# → 浏览器打开 http://localhost:5173
```

## LYNX Agent (A3.0)

基于 **Gemini 3.1 Pro** 的 ReAct 智能体，通过 MCP 协议控制战区。

| 工具 | 能力 | 安全等级 |
|---|---|---|
| `claw_query_db` | SQLite 资产/WiFi/告警查询 | 🟢 GREEN |
| `claw_read_file` | 文件读取 (LFI 三层防护) | 🟢 GREEN |
| `claw_list_assets` | 资产清单 | 🟢 GREEN |
| `claw_db_import_nmap` | Nmap XML 入库 | 🟢 GREEN |
| `claw_execute_shell` | Shell 命令 | 🟡🔴 HITL |
| `claw_run_module` | 战术模块 | 🟡🔴 HITL |
| `claw_delegate_agent` | A2A 子智能体 | 🟢 内部 |

**HITL 三级分权**：
- 🟢 **GREEN** `ls` `cat` `grep` `ping` → 自动放行
- 🟡 **YELLOW** `nmap` `nikto` `curl` → 需确认
- 🔴 **RED** `psexec` `hashcat` `rm -rf` → 物理熔断

## 安全特性

| 层 | 机制 |
|---|---|
| **命令控制** | HITL 三级分权 + Shell 元字符 Fail-Closed |
| **文件访问** | 系统目录阻断 → 白名单 → 凭据文件黑名单 |
| **数据库** | DROP/DELETE/INSERT/ALTER 关键字拦截 |
| **探针认证** | `Bearer Token` 鉴权 (环境变量配置) |
| **密码保护** | Sudo 管道自动脱敏 + API Key gitignore |
| **审计追踪** | Agent 操作日志 (防注入格式化) |

## 测试

```bash
# V9.3 回归测试 (45 项) + V10.0 告警测试 (19 项) = 64 项
python -m pytest tests/test_claw_v93.py tests/test_claw_v10.py -v

# 测试覆盖:
# 数据库引擎 · REST API · 数据一致性 · 安全机制
# 报告生成 · 版本对齐 · 前端契约 · 告警 CRUD
# 鉴权校验 · HUD 统计 · Schema 完整性
```

## 项目结构

```
CatTeam/
├── backend/                          # FastAPI 后端
│   ├── main.py                       # REST API + 告警引擎
│   ├── agent_mcp.py                  # MCP ReAct 循环
│   └── mcp_armory_server.py          # MCP 工具服务器
├── frontend/src/                     # React HUD
│   ├── App.jsx                       # 主框架 (~3000 行)
│   ├── components/                   # 独立组件
│   │   └── ProtocolAlertPanel.jsx    # V10.0 协议告警面板
│   ├── store.js                      # Zustand 状态管理
│   └── index.css                     # Bloomberg 设计系统
├── probes/                           # 协议探针集群
│   └── claw_llmnr_probe.py           # LLMNR/NBT-NS 检测 (Scapy)
├── tests/                            # 测试套件
│   ├── test_claw_v93.py              # V9.3 回归 (45 项)
│   └── test_claw_v10.py              # V10.0 告警 (19 项)
├── docs/                             # 文档体系
│   ├── ARCHITECTURE.md               # 系统架构
│   ├── INFRASTRUCTURE.md             # 基础设施规划
│   ├── DEPLOYMENT.md                 # 部署指南
│   ├── OPERATIONS.md                 # 作战手册
│   ├── ROADMAP.md                    # 版本路线图
│   ├── design/V10_DESIGN.md          # V10 设计文档
│   └── archive/                      # 历史版本存档
├── scripts/                          # 工具脚本
│   ├── kali_legacy/                  # V1-V5 CLI 模块归档
│   └── firmware-autopsy.py           # 固件分析
├── db_engine.py                      # SQLite 数据引擎
├── claw-launch.sh / claw-stop.sh     # Mac 启停脚本
├── claw-field.sh                     # Kali 端部署脚本
└── Makefile                          # 构建入口
```

## 版本演进

```
V1.0 → V2.0 → V3.0 → V4.0 → V5.0 → V7.0 → V8.0 → V9.0 → V9.1 → V9.2 → V9.3 → V10.0
Shell   工程化  攻击链  合规    SQLite  Agentic  Web    大屏    护城河  深度     电幻    协议解剖
脚本                    AD              AI       HUD                    自治     猎影    ← 当前
```

## 环境要求

| 组件 | 版本 | 用途 |
|---|---|---|
| macOS | Apple Silicon | 指挥中枢宿主机 |
| Python | 3.10+ | 后端 + Agent |
| Node.js | 18+ | React + Vite |
| Kali VM | 2024+ | 武器库 + 探针 |
| Gemini API | 3.1 Pro | AI 智能体 |
| ALFA 网卡 | RTL8812AU (可选) | 无线侦察 |

---

<div align="center">

**⚠️ 仅供合法授权安全测试与学术研究使用 ⚠️**

Made with `/\_/\` by CatTeam · Codename Lynx

</div>
