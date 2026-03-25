# CatTeam 影子军火库 — 架构评审报告

**项目名称：** CatTeam 模块化内网安全测绘与渗透工具链  
**版本：** v3.0  
**日期：** 2026-03-25  
**作者：** Xiaoziqi  
**评审请求：** 恳请导师对本项目的整体架构设计、代码质量、数据流设计及安全性进行综合评审，提出改进意见。

---

## 一、项目概述

CatTeam 是一套面向内网环境的模块化安全测绘与渗透测试工具链。采用 **Mac 宿主机 + Docker Kali 容器** 的混合架构，覆盖从网络侦察到横向移动的完整杀伤链。

**设计目标：**
- 模块化：每个脚本独立可用，通过 Makefile 统一编排
- 自动化：一键执行完整的侦察/审计/攻击流程
- 可追溯：时间戳隔离的任务目录 + 统一日志
- Mac 适配：针对 macOS Docker 的 L2/GPU 限制采用混合执行策略

---

## 二、系统架构

### 2.1 分层设计

```
┌──────────────────────────────────────────────────┐
│  控制面 — Makefile v3.0                           │
│  preflight 预检 → run/fast/phantom/crack/lateral │
├──────────────────────────────────────────────────┤
│  配置层 — config.sh (Single Source of Truth)       │
│  网络/端口模板/Docker/Responder/Hashcat/凭据      │
├──────────────────────────────────────────────────┤
│  模块层 — 00~06 (三条功能链)                      │
│  侦察链: 00→01→02→02.5                           │
│  审计层: 03-audit / 03-web / 03-exploit           │
│  攻击链: 04→05→06                                │
├──────────────────────────────────────────────────┤
│  数据层 — CatTeam_Loot/{RUN_ID}/                  │
│  时间戳隔离 + latest 软链接 + catteam.log 日志    │
├──────────────────────────────────────────────────┤
│  基础设施 — Mac 宿主机 ←Volume→ Docker Kali      │
└──────────────────────────────────────────────────┘
```

### 2.2 混合执行策略

本项目的一个核心设计决策是：**不把所有模块放进 Docker**。原因如下：

| 任务类型 | 执行环境 | 不用 Docker 的原因 |
|---|---|---|
| L2 嗅探 (tcpdump) | Mac 宿主机 | macOS Docker `--network host` 绑定的是虚拟机网卡，听不到物理网卡广播 |
| Responder 投毒 | Mac 宿主机 | 同上，必须直接接管 en0 |
| Hashcat 破解 | Mac 宿主机 | Docker 无法穿透 Apple Silicon GPU/Metal |
| Nmap 扫描 | Docker 容器 | 应用层 TCP 可穿透虚拟机 NAT |
| Impacket 横移 | Docker 容器 | 应用层 SMB，且隔离依赖 |

---

## 三、全模块清单与数据流

### 3.1 模块职责

| 编号 | 文件 | 功能 | 环境 | 输入 | 输出 |
|---|---|---|---|---|---|
| 00 | `00-armory.sh` | DHCP 续租换 IP | Mac (sudo) | en0 | 新 IP |
| 01 | `01-recon.sh` | 60s 被动嗅探 | Mac (sudo) | 网络流量 | `targets.txt` |
| 02 | `02-probe.sh` | Nmap 端口扫描 | Docker | `targets.txt` | `nmap_results.*` |
| 02.5 | `02.5-parse.py` | XML→JSON 降维 | Mac (Python) | `.xml` | `live_assets.json` |
| 03 | `03-audit.sh` | httpx 指纹探测 | Docker | `live_assets.json` | `httpx_results.txt` |
| 03-web | `03-audit-web.py` | 手搓 httpx | Mac (Python) | `live_assets.json` | `web_fingerprints.txt` |
| 03-exp | `03-exploit-76.py` | VNC/SMB 精准探测 | Mac (Python) | 硬编码 IP | 终端输出 |
| 04 | `04-phantom.sh` | Responder 投毒 | Mac 原生 | en0 | `captured_hash.txt` |
| 05 | `05-cracker.sh` | Hashcat 字典攻击 | Mac 原生 | `captured_hash.txt` | `cracked_passwords.txt` |
| 06 | `06-psexec.sh` | Impacket 横向移动 | Docker | JSON+凭据 | `lateral_results.txt` |

### 3.2 数据流拓扑

```
                     ┌──────────────────────────────────────┐
                     │         侦察链 (make fast/run)        │
                     │                                      │
  config.sh ─source→ │  00-armory → 01-recon → 02-probe     │
       │             │       │          │          │         │
       │             │    新 IP    targets.txt  nmap.xml    │
       │             │                             │         │
       │             │                      02.5-parse       │
       │             │                             │         │
       │             │                    live_assets.json   │
       │             └──────────────┬───────────────────────┘
       │                            │
       │              ┌─────────────┼─────────────┐
       │              │             │             │
       │         03-audit      03-web      03-exploit-76
       │         (Docker)     (Python)      (Python)
       │
       │             ┌──────────────────────────────────────┐
       │             │          攻击链                       │
       │             │                                      │
       └──source──→  │  04-phantom ──→ 05-cracker ──→ 06-psexec
                     │       │              │             │  ↑
                     │  captured_hash  cracked_pass     结果 │
                     │                                   │  │
                     │                    live_assets.json ──┘
                     └──────────────────────────────────────┘
```

> **关键设计点：** 06 模块是两条链的交汇点 —— 它同时需要侦察链产出的 `live_assets.json`（知道哪些机器开了 SMB）和攻击链产出的 `cracked_passwords.txt`（知道用什么凭据去打）。

---

## 四、关键设计决策与工程特性

### 4.1 统一配置 (`config.sh`)

所有模块通过 `source config.sh` 加载统一配置，消除了早期版本中散布在各脚本中的硬编码问题。

**配置项涵盖：** 网络参数、三套端口模板 (default/iot/full)、Docker 容器/镜像名、Responder/Hashcat 路径、凭据管理。

**端口模板切换机制：**
```bash
# 通过环境变量 PROFILE 在运行时切换
make run PROFILE=iot    # IoT 设备专用 11 端口
make run PROFILE=full   # 全面扫描 30 端口
```

### 4.2 任务隔离

每次 `make run/fast` 生成带时间戳的独立目录：
```
CatTeam_Loot/
├── 20260325_010000/    ← 第一次运行
├── 20260325_020000/    ← 第二次运行
└── latest → 20260325_020000   ← 软链接
```

- 侦察链创建新 `RUN_ID` 目录
- 攻击链模块使用 `USE_LATEST=true` 附加到最新目录
- 避免多次测试数据覆盖

### 4.3 防御性编程

| 技术 | 应用场景 |
|---|---|
| `set -euo pipefail` | 所有 Bash 脚本全局启用 |
| `trap INT TERM` | tcpdump 僵尸进程清理 |
| 超时保护 | DHCP 续租 10s 超时 |
| 黑名单过滤 | `blacklist.txt` 保护关键设备 |
| 防重复启动 | 04-phantom PID 检测 |
| 空结果保护 | targets.txt 为空时阻止下游执行 |
| Makefile preflight | Docker/镜像/Python/sudo 四项预检 |

### 4.4 日志系统

```bash
log() {
    local msg="[$(date '+%H:%M:%S')] $1"
    echo -e "$msg" | tee -a "$MASTER_LOG" 2>/dev/null
}
```

所有模块调用 `log()` 实现终端输出 + `catteam.log` 文件双写，事后可完整复盘。

### 4.5 攻击链特殊设计

**04→05 数据管线：** 04 模块启动一个伴生进程 (`tail -f | grep | sed`)，实时将 Responder 日志中的 NTLMv2 Hash 提取清洗到 `captured_hash.txt`，05 模块直接读取。

**06 凭据三级获取：** 命令行参数 → config.sh → 05 输出自动加载 → 交互式输入。绝不硬编码密码。

**06 JSON 解析：** 使用内联 Python 替代 `jq`，因为 macOS 不预装 jq。

---

## 五、代码结构概览

```
CatTeam/                        代码行数 (约)
├── config.sh                   ~90 行   配置中心
├── blacklist.txt               模板     IP 禁飞区
├── Makefile                    ~150 行  中控引擎
│
├── 00-armory.sh                ~35 行   DHCP 换脸
├── 01-recon.sh                 ~60 行   被动嗅探
├── 02-probe.sh                 ~55 行   Nmap 扫描
├── 02.5-parse.py               ~120 行  XML→JSON
│
├── 03-audit.sh                 ~80 行   httpx 审计
├── 03-audit-web.py             ~200 行  手搓 httpx
├── 03-exploit-76.py            ~390 行  VNC/SMB 探测
│
├── 04-phantom.sh               ~110 行  Responder 投毒
├── 05-cracker.sh               ~85 行   Hashcat 破解
├── 06-psexec.sh                ~140 行  横向移动
│
├── README.md                   项目总览
├── CHANGELOG.md                版本记录
└── docs/
    ├── ARCHITECTURE.md         架构设计
    └── OPERATIONS.md           作战手册
```

---

## 六、恳请导师评审的重点方向

### 6.1 架构层面

1. **混合执行模型** — Mac 宿主机与 Docker 的分工是否合理？是否有更优的容器网络解决方案？
2. **模块间耦合度** — 当前模块通过文件传递数据 (`targets.txt → nmap.xml → live_assets.json`)，这种松耦合是否足够稳健？
3. **config.sh 设计** — 将所有配置集中到一个 Shell 脚本是否是最佳实践？是否应该使用 YAML/JSON 配置文件？

### 6.2 安全性层面

4. **凭据管理** — config.sh 中的 `LATERAL_USER/PASS` 变量存在明文风险，是否应引入加密存储？
5. **黑名单机制** — 当前的 IP 黑名单是否足够？是否需要白名单模式（只扫允许的目标）？
6. **操作审计** — catteam.log 的日志粒度是否满足红队行动后的报告需求？

### 6.3 代码质量层面

7. **Bash 脚本的错误处理** — `set -euo pipefail` + `|| true` 的组合是否有意外交互？
8. **Python 脚本风格** — 03-exploit-76.py 中手搓 SMB 协议报文 的实现是否符合最佳实践？
9. **可测试性** — 当前缺少单元测试和集成测试，如何在安全工具中引入测试？

### 6.4 扩展性层面

10. **新模块接入** — 如果要增加 UDP 扫描模块或 DNS 隧道模块，当前架构是否支持无痛扩展？
11. **多网段支持** — 如果要同时测绘多个子网，当前的 `INTERFACE` 单网卡设计是否需要重构？

---

## 七、代码包说明

随本报告附交 `CatTeam_v3.0.tar.gz` 代码包。

**包结构：**
```
CatTeam_v3.0/
├── 源代码 (所有 .sh / .py 文件)
├── 配置文件 (config.sh, blacklist.txt, Makefile)
├── 文档 (README.md, CHANGELOG.md, docs/)
└── 不含 CatTeam_Loot/ 运行时数据
```

**快速验证方式：**
```bash
tar xzf CatTeam_v3.0.tar.gz
cd CatTeam_v3.0
make help          # 查看所有可用指令
cat config.sh      # 查看统一配置
```

---

## 八、版本迭代历程

| 版本 | 日期 | 核心变化 |
|---|---|---|
| v1.0 | 03-24 | 首次发布：00-03 侦察+审计链 |
| v2.0 | 03-25 | 系统化改造：config.sh / 时间戳隔离 / preflight / 日志 |
| v3.0 | 03-25 | 攻击链扩展：04 投毒 / 05 破解 / 06 横移 + 混合架构 |

---

*报告结束。恳请导师拨冗审阅，期待您的宝贵意见。*
