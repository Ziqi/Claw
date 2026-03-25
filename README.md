<![CDATA[<div align="center">

```
     /\_/\  
    ( o.o )  Project CLAW V7.0
     > ^ <   CatTeam Lateral Arsenal Weapon
    /|   |\  
   (_|   |_) Codename: Lynx
```

# 🐱 Project CLAW

**C**atTeam **L**ateral **A**rsenal **W**eapon

模块化内网红队基础设施 · Mac + Docker Kali 混合架构 · AI Agentic 智能体 (Gemini 3)

[![Version](https://img.shields.io/badge/V7.0-blue)]()
[![Agent](https://img.shields.io/badge/Agent-A2.0-green)]()
[![Platform](https://img.shields.io/badge/platform-macOS-lightgrey)]()
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

# 启动交互式控制台 (推荐)
make console

# 或一键侦察+扫描
make fast
```

## 🎯 系统架构

```
┌─ 侦察链 ─────────────────────────────────────────────┐
│  00 后勤总机 → 01 幽灵斥候 → 02 端口扫描 → 02.5 数据入库    │
│  DHCP换脸       被动嗅探       Nmap扫描      XML→SQLite+JSON │
└──────────────────────────┬─────────────────────────┘
                           │ claw.db + live_assets.json
                ┌──────────┼──────────┐
                ↓          ↓          ↓
           03 Web指纹   05 Nuclei   🧠 CLAW Agent
           纯Python     漏洞扫描     Gemini 3 ReAct
                                     HITL 三级分权
┌─ 攻击链 ─────────────────────────────────────────────┐
│  06 投毒陷阱  → 07 算力破解  → 08 横向移动                  │
│  Responder      Hashcat GPU    Impacket SMB              │
│  09 后渗透提取 → 10 AD域Kerberoast                         │
└────────────────────────────────────────────────┘
```

## 🖥️ TUI 交互式控制台

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
  [🧠 AI 智能体] Gemini 3             12) 资产变化检测
   13) AI 战术分析
   14) 问 Lynx (对话)             [系统]
   15) 智能告警                     16) 切换环境  r) 上帝模式
   20) 🧠 CLAW Agent                s) 陷阱监控  h) 帮助文档
```

## 📋 Make 指令一览

| 指令 | 说明 |
|---|---|
| `make console` | 🏆 启动交互式 TUI 控制台 |
| `make fast` | 一键侦察 (01→02→02.5) |
| `make run` | 完整杀伤链 (00→01→02→02.5) |
| `make run PROFILE=iot/full` | 切换端口扫描模板 |
| `make web` | Web 指纹清扫 (纯 Python) |
| `make phantom` / `phantom-stop` | 布下/回收投毒陷阱 |
| `make crack` | Hashcat 算力破解 |
| `make lateral` | Impacket 横向移动 |
| `make report` | 生成 Markdown 渗透战报 |
| `make diff` | SQL EXCEPT 资产变化检测 |
| `make loot CONFIRM=--confirm` | 后渗透提取 (secretsdump) |
| `make kerberoast` | AD 域 Kerberoast 攻击 |
| `make nuclei` | Nuclei 漏洞扫描 |
| `make toolbox` | 🔧 扩展工具箱 (Nikto/Hydra/Sqlmap/binwalk) |
| `make firmware FW=x.bin` | 固件解剖刀 (纯 Python) |
| `make clean` | 清空战区 + 销毁容器 |
| `make status` | 战区状态报告 |
| `make test` | 自动化靶场测试 |

## 🧩 项目结构

```
CatTeam/
├── config.sh                # 统一配置中心 (含 AI Key, 已 gitignore)
├── scope.txt                # ROE 白名单 (CIDR)
├── blacklist.txt            # IP 黑名单
├── Makefile                 # 中控引擎 v4.0
├── catteam.sh               # 交互式 TUI 控制台 v5.0
│
├── 00-armory.sh             # 后勤总机: DHCP 换脸
├── 01-recon.sh              # 幽灵斥候: 被动嗅探 / 主动探活
├── 02-probe.sh              # 端口扫描: Docker Nmap
├── 02.5-parse.py            # 数据入库: XML → SQLite + JSON (双写)
├── 03-audit.sh              # 应用层审计: Docker httpx
├── 03-audit-web.py          # Web 指纹清扫: 纯 Python ThreadPool
├── 03-exploit-76.py         # 精准打击: VNC/SMB 漏洞探测
├── 04-phantom.sh            # 投毒陷阱: Responder (Mac 原生)
├── 05-cracker.sh            # 算力破解: Hashcat (GPU 加速)
├── 06-psexec.sh             # 横向移动: Impacket smbexec
├── 07-report.py             # 战报生成: Markdown 自动化
├── 08-diff.py               # 资产探测: SQL EXCEPT 差异引擎
├── 09-loot.sh               # 后渗透提取: secretsdump + smbclient
├── 10-kerberoast.sh         # AD 域收割: GetUserSPNs
├── 11-webhook.py            # 智能告警: Diff → AI → macOS 通知
│
├── db_engine.py             # SQLite 数据引擎 (多环境隔离)
├── 16-ai-analyze.py         # AI 战术分析 (Gemini Flash)
├── 17-ask-lynx.py           # 问 Lynx: 多轮对话 (滑动窗口 10 轮)
├── 18-ai-bloodhound.py      # AI-Hound: BloodHound JSON → Gemini 图论推理
├── 23-hp-proxy-unlocker.py   # HP 代理跳板机复仇者
├── claw-agent.py            # 🧠 CLAW Agent V7.0: Gemini 3 ReAct + HITL
│
├── scripts/
│   ├── scope_check.py       # ROE 校验器
│   ├── db_engine.py         # SQLite 数据引擎
│   ├── firmware-autopsy.py  # 固件解剖刀 (零依赖 binwalk 替代)
│   └── examples/            # 实战参考 PoC
│
├── Dockerfile               # Kali 战车镜像 V4 (Nmap + Impacket + Nuclei + binwalk)
├── Responder/               # Responder 投毒工具 (本地克隆)
├── nuclei-templates/        # Nuclei 漏洞模板
├── tests/                   # Docker Compose 自动化靶场
│
├── CatTeam_Loot/            # 战利品目录 (已 gitignore)
│   ├── claw.db              #   SQLite 数据库 (按 env 字段多租户隔离)
│   ├── claw_env.txt          #   当前环境标识
│   ├── 20260325_HHMMSS/     #   按时间戳隔离的任务目录
│   └── latest → ...         #   指向最新任务的软链接
│
└── docs/
    ├── ARCHITECTURE.md      # 架构设计 & 数据流
    ├── OPERATIONS.md        # 作战手册
    ├── ROADMAP.md           # 开发路线图 (v1.0 → v7.0)
    ├── CONVENTIONS.md       # 技术标准 (版本号/命名/编码规范)
    └── advisor/             # 导师交流文档 (V4-V7)
```

## 🤖 AI 副官 (Lynx)

Project CLAW 内置了基于 **Gemini Flash** 的 AI 战术副官，代号 **Lynx**：

- **战术分析** (`13`)：自动读取 SQLite 扫描数据 + Web 指纹，生成攻击路径建议
- **多轮对话** (`14`)：携带完整扫描上下文，支持追问和深度分析
- **智能告警** (`15`)：定时 Diff 检测 → AI 分析 → macOS 推送通知
- **OPSEC 脱敏**：实战模式下自动替换内网 IP，防止敏感信息泄露

```bash
# 实战模式 (IP 自动脱敏)
CLAW_OPSEC=live python3 16-ai-analyze.py
```

## 🔐 安全特性

| 特性 | 说明 |
|---|---|
| **ROE 白名单** | `scope.txt` + `scope_check.py` 双重校验 |
| **上帝模式** | TUI 按 `r` 动态切换，靶场环境无需逐个配置 |
| **环境隔离** | SQLite `env` 字段多租户隔离，切换靶场零交叉污染 |
| **OPSEC 脱敏** | AI 分析自动替换敏感 IP |
| **API Key 保护** | `config.sh` 已加入 `.gitignore` |
| **安全阀门** | 后渗透模块需 `--confirm` 确认 |

## ⚙️ 环境要求

| 依赖 | 用途 | 安装 |
|---|---|---|
| macOS | 宿主机平台 | — |
| Python 3.x | 核心脚本引擎 | 系统自带 |
| Docker Desktop | Kali 战车容器 | [下载](https://www.docker.com/products/docker-desktop/) |
| Gemini API Key | AI 副官 | [申请](https://aistudio.google.com/apikey) |
| Hashcat | GPU 密码破解 | `brew install hashcat` |
| tcpdump | 被动嗅探 | 系统自带 |

## 🗺️ 版本演进

```
v1.0 (基础链) → v2.0 (工程化) → v3.0 (攻击链) → v3.1 (情报层)
     → v4.0 (合规/AD) → v5.0 (SQLite+AI) → v5.0.1 (TUI+工具箱+实战)
     → v6.0 (Sliver C2/Ligolo-ng) → v7.0 (Agentic AI 智能体)
```

## 📚 文档索引

| 文档 | 内容 |
|---|---|
| [架构设计](docs/ARCHITECTURE.md) | 系统架构、数据流、混合执行模型 |
| [作战手册](docs/OPERATIONS.md) | 实战操作场景详解 |
| [开发路线](docs/ROADMAP.md) | v1.0 → v7.0 完整演进记录 |
| [技术标准](docs/CONVENTIONS.md) | 版本号/命名/编码规范 |
| [更新日志](CHANGELOG.md) | 每个版本的详细变更记录 |

---

<div align="center">

**⚠️ 仅供授权安全测试使用 · 未经授权的渗透测试是违法行为**

Made with 🐱 by CatTeam

</div>
]]>
