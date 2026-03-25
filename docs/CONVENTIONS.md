# 🐱 CatTeam/CLAW 技术标准文档 (Conventions & Standards)

**版本：** 1.0  
**最后更新：** 2026-03-25

---

## 1. 版本号规范

### 1.1 CLAW 平台版本 (唯一的"主版本号")

**当前版本：v5.0.1**

```
格式: vX.Y.Z
  X = 大版本 (架构级变更, 如引入 SQLite / AI / C2)
  Y = 中版本 (新功能模块, 如 Webhook / Toolbox)
  Z = 补丁   (Bug 修复, 文档修正, UX 优化)
```

**历史版本线：**
| 版本 | 标志性变更 |
|---|---|
| v1.0 | 基础侦察链 (00→02.5) |
| v2.0 | 工程化 (config.sh, 时间戳, Docker) |
| v3.0 | 攻击链 (Responder/Hashcat/psexec) |
| v3.1 | 情报层 (报告+Diff) |
| v4.0 | 合规层 (ROE) + AD 域 + TUI |
| v5.0 | SQLite 数据层 + AI 副官 |
| v5.0.1 | TUI 修复 + 实战渗透工具 |
| v6.0 *(计划)* | Sliver C2 + Ligolo-ng 隧道 |
| v7.0 *(远期)* | Agentic AI 全自动智能体 |

### 1.2 Dockerfile 版本

Docker 镜像版本**独立于** CLAW 平台版本，因为镜像构建由用户手动触发。

```
格式: my-kali-arsenal:vN  (N 为递增整数)
```

| 镜像版本 | 内容 |
|---|---|
| v1 | Kali 基础工具 (nmap, curl, netcat) |
| v2 | + Impacket (smbexec, secretsdump) |
| v3 *(Dockerfile 定义)* | + Nuclei |
| v4 *(Dockerfile 定义)* | + binwalk |

### 1.3 Advisor 文档编号

Advisor 文档中的 "V4/V5/V6/V7" **不是版本号**，而是**讨论批次编号**。

```
格式: V{N}_{TYPE}.md
  N    = 讨论序号 (按时间递增)
  TYPE = PROPOSAL / FEEDBACK / RULING / SESSION_REPORT 等
```

---

## 2. 模块命名规范

### 2.1 主线模块 (根目录)

```
格式: {NN}-{name}.{sh|py}
  NN   = 两位数编号 (按功能链排列)
  name = 小写英文, 用连字符分隔
```

**编号段分配：**

| 编号段 | 功能链 | 示例 |
|---|---|---|
| 00-02 | 侦察链 | `00-armory.sh`, `02-probe.sh` |
| 02.5 | 数据清洗 | `02.5-parse.py` |
| 03 | 审计层 | `03-audit.sh`, `03-audit-web.py` |
| 04-06 | 攻击链 | `04-phantom.sh`, `06-psexec.sh` |
| 07-08 | 情报层 | `07-report.py`, `08-diff.py` |
| 09-10 | 后渗透/AD | `09-loot.sh`, `10-kerberoast.sh` |
| 11 | 告警 | `11-webhook.py` |
| 16-17 | AI 副官 | `16-ai-analyze.py`, `17-ask-lynx.py` |
| 18+ | 预留给 v6/v7 新模块 | `18-ai-bloodhound.py` |

> **注意**: 12-15 空缺是有意预留的，供未来在功能链中插入新模块。

### 2.2 工具脚本 (scripts/)

```
scripts/
├── scope_check.py        # 核心工具 (被主线模块调用)
├── db_engine.py          # 核心工具
├── firmware-autopsy.py   # 独立工具 (通用, 可单独使用)
└── examples/             # 实战参考脚本 (一次性 PoC, 不入主线)
    ├── 20-tplink-probe.py
    └── 22-printer-probe.py
```

### 2.3 TUI 菜单编号

TUI (`catteam.sh`) 中的菜单编号**与底层脚本解耦**。菜单使用语义化命令名，不硬编码脚本序号。

---

## 3. 目录结构规范

```
CatTeam/
├── NN-name.sh/py         # 主线模块
├── catteam.sh             # TUI 控制台
├── config.sh              # 统一配置 (唯一配置源)
├── config.sh.example      # 脱敏模板
├── Makefile               # 编排引擎
├── Dockerfile             # Docker 战车底盘
├── scripts/               # 工具脚本 & 辅助函数
│   ├── examples/          # 实战参考 PoC
│   └── *.py               # 核心工具
├── docs/                  # 项目文档
│   ├── ARCHITECTURE.md    # 架构设计
│   ├── ROADMAP.md         # 演进路线图
│   ├── OPERATIONS.md      # 操作手册
│   └── advisor/           # 导师交流文档
├── CatTeam_Loot/          # 扫描产出 (git ignored)
│   ├── {RUN_ID}/          # 每次运行的隔离目录
│   ├── claw.db            # SQLite 资产库
│   └── alerts/            # 告警记录
├── tests/                 # 自动化测试
└── firmware/              # 固件样本 (git ignored)
```

---

## 4. 编码规范

### 4.1 Shell 脚本 (.sh)
- 首行 `#!/usr/bin/env bash`
- 必须 `set -euo pipefail`
- 必须 `source config.sh`
- 必须有 `trap` 清理逻辑

### 4.2 Python 脚本 (.py)
- 首行 `#!/usr/bin/env python3`
- 尽量**零外部依赖**（仅用标准库）
- 色彩输出使用 ANSI 转义码（不依赖 colorama）
- 敏感数据从环境变量读取，禁止硬编码

### 4.3 配置管理
- 所有可配置项集中在 `config.sh`
- 新增配置项必须同步更新 `config.sh.example`
- API Key 等密钥**禁止**提交 Git

### 4.4 Git 提交规范

```
格式: {emoji} {简要描述}

emoji:
  🐱 = 常规功能/架构变更
  🔧 = Bug 修复
  📋 = 文档更新
  🔒 = 安全/OPSEC 修复
```

---

*本文档是 Project CLAW 的工程治理基线，所有新增模块和文档必须遵循以上规范。*
