<div align="center">

```
     /\_/\  
    ( o.o )  Project CLAW V8.2
     > ^ <   CatTeam Lateral Arsenal Weapon V8.2
    /|   |\  
   (_|   |_) Codename: Lynx · Bloomberg Terminal
```

# 🐱 Project CLAW

**C**atTeam **L**ateral **A**rsenal **W**eapon

AI-Native 红队全栈作战平台 · Bloomberg Terminal UI · FastAPI + React · Gemini 3 Agentic AI

[![Version](https://img.shields.io/badge/V8.2-blue)]()
[![Agent](https://img.shields.io/badge/Agent-A2.1-green)]()
[![Dashboard](https://img.shields.io/badge/Dashboard-Bloomberg-black)]()
[![AI](https://img.shields.io/badge/AI-Gemini%203%20Flash-orange)]()
[![License](https://img.shields.io/badge/license-Private-red)]()

</div>

---

## ⚡ 快速开始

```bash
# 克隆项目
git clone https://github.com/Ziqi/Claw.git && cd Claw

# 配置 (首次)
cp config.sh.example config.sh   # 编辑填入你的 Gemini API Key
vim scope.txt                     # 填入授权网段 (CIDR)

# 启动 Web Dashboard (推荐)
cd ~/CatTeam && uvicorn backend.main:app --reload --port 8000 &
cd ~/CatTeam/frontend && npm install && npm run dev
# 打开 http://localhost:5173

# 或 CLI 模式
make console          # TUI 控制台
python3 claw-agent.py # AI 智能体
```

## 🎯 系统架构

```
┌─ 侦察链 ──────────────────────────────────────────────┐
│  00 后勤总机 → 01 幽灵斥候 → 02 端口扫描 → 02.5 数据入库 │
│  DHCP换脸       被动嗅探       Nmap扫描      XML→SQLite   │
└──────────────────────────┬─────────────────────────────┘
                           │ claw.db + live_assets.json
                ┌──────────┼──────────┐
                ↓          ↓          ↓
           03 Web指纹   Nuclei      🧠 CLAW Agent (MCP)
           纯Python     漏洞扫描     Gemini 3 ReAct
                                     HITL 三级分权
┌─ 攻击链 ──────────────────────────────────────────────┐
│  04 投毒陷阱  → 05 算力破解  → 06 横向移动               │
│  Responder      Hashcat GPU    Impacket SMB            │
│  09 后渗透提取 → 10 AD域Kerberoast                      │
└────────────────────────────────────────────────────────┘
```

## 🧠 CLAW Agent (V8.2 / MCP 架构)

基于 **Gemini 3 Interactions API** 的自主红队智能体，V8.2 已迁移至 MCP 架构 (动态工具发现 + 缓存式 schema)：

| 模式 | 工具 | 安全机制 |
|---|---|---|
| **A1.0 (M1)** 只读 | `claw_query_db` / `claw_read_file` / `claw_list_assets` | 自动放行 |
| **A2.0 (M2)** 执行 | `claw_execute_shell` / `claw_run_module` | HITL 三级分权 |

**HITL 三级分权：**
- 🟢 **GREEN**: `ls`, `cat`, `grep` → 自动放行
- 🟡 **YELLOW**: `nmap`, `make fast` → 需确认 [Y/n]
- 🔴 **RED**: `psexec`, `hashcat` → 需输入 CONFIRM

```bash
python3 claw-agent.py            # M2 模式 (默认)
python3 claw-agent.py --readonly # M1 只读模式
```

## 🖥️ TUI 控制台

通过 `make console` 进入全功能 TUI：

```
  [侦察链]                        [攻击链]
    1) 被动嗅探 (tcpdump)           6) 投毒陷阱 (Responder)
    2) 主动探活 (nmap -sn)          7) 算力破解 (Hashcat)
    3) 端口扫描                      8) 横向移动 (Impacket)
                                     9) 后渗透提取 [!需确认]
  [审计层]                          10) AD 域 Kerberoast
    4) Web 指纹清扫
    5) Nuclei 漏洞扫描             [情报层]
                                    11) 生成战报 (Markdown)
  [🧠 AI 智能体] Gemini 3           12) 资产变化检测
   13) AI 战术分析
   14) 问 Lynx (对话)             [系统]
   15) 智能告警                     16) 切换环境  r) 上帝模式
   20) 🧠 CLAW Agent               s) 陷阱监控  h) 帮助文档
```

## 📋 Make 指令一览

| 指令 | 说明 |
|---|---|
| `make console` | 🏆 启动交互式 TUI 控制台 |
| `make fast` | 一键侦察 (01→02→02.5) |
| `make run` | 完整杀伤链 (00→01→02→02.5) |
| `make web` | Web 指纹清扫 (纯 Python) |
| `make nuclei` | Nuclei 漏洞扫描 |
| `make phantom` / `phantom-stop` | 布下/回收投毒陷阱 |
| `make crack` | Hashcat 算力破解 |
| `make lateral` | Impacket 横向移动 |
| `make report` | 生成 Markdown 渗透战报 |
| `make diff` | SQL EXCEPT 资产变化检测 |
| `make loot CONFIRM=--confirm` | 后渗透提取 (secretsdump) |
| `make kerberoast` | AD 域 Kerberoast 攻击 |
| `make toolbox` | 🔧 扩展工具箱 (Nikto/Hydra/Sqlmap/binwalk) |
| `make firmware FW=x.bin` | 固件解剖刀 (纯 Python) |
| `make status` | 战区状态报告 |

## 🔐 安全特性

| 特性 | 说明 |
|---|---|
| **ROE 白名单** | `scope.txt` + `scope_check.py` 双重校验 |
| **HITL 分权** | Agent 执行命令受三级审批控制 |
| **环境隔离** | SQLite `env` 字段多租户隔离 |
| **OPSEC 脱敏** | AI 分析自动替换敏感 IP |
| **API Key 保护** | `config.sh` 已加入 `.gitignore` |
| **审计日志** | Agent 操作记录到 `agent_audit.log` |

## ⚙️ 环境要求

| 依赖 | 用途 | 安装 |
|---|---|---|
| macOS | 宿主机平台 | — |
| Python 3.x | 核心脚本引擎 | 系统自带 |
| Docker Desktop | Kali 战车容器 | [下载](https://www.docker.com/products/docker-desktop/) |
| Gemini API Key | AI 智能体 | [申请](https://aistudio.google.com/apikey) |
| Hashcat | GPU 密码破解 | `brew install hashcat` |

## 🗺️ 版本演进

```
V1.0 (基础链) → V2.0 (工程化) → V3.0 (攻击链) → V4.0 (合规/AD)
     → V5.0 (SQLite+AI) → V7.0 (Agentic AI) → V8.0 (Web Dashboard)
     → V8.2 (MCP + 流式流水线) ← 当前版本
```

## 📚 文档索引

| 文档 | 内容 |
|---|---|
| [架构设计](docs/ARCHITECTURE.md) | 系统架构、数据流、模块矩阵 |
| [作战手册](docs/OPERATIONS.md) | 实战操作场景详解 |
| [开发路线](docs/ROADMAP.md) | V1.0 → V8.2 演进记录 |
| [技术标准](docs/CONVENTIONS.md) | 版本号 / 命名 / 编码规范 |
| [更新日志](CHANGELOG.md) | 每个版本的详细变更 |

---

<div align="center">

**⚠️ 仅供授权安全测试使用 · 未经授权的渗透测试是违法行为**

Made with 🐱 by CatTeam

</div>
