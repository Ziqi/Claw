# 🐱 CatTeam/CLAW 技术标准文档 (Conventions & Standards)

**版本：** 2.1  
**最后更新：** 2026-03-26

---

## 1. 版本号规范

### 1.1 CLAW 平台版本 (V 前缀)

**当前版本：V8.0-alpha**

```
格式: V{X}.{Y}.{Z}
  V = 系统/平台版本前缀
  X = 大版本 (架构级变更, 如引入 SQLite / AI / Agent)
  Y = 中版本 (新功能模块)
  Z = 补丁   (Bug 修复, 文档修正)
```

**版本线：**
| 版本 | 标志性变更 |
|---|---|
| V1.0 | 基础侦察链 (00→02.5) |
| V2.0 | 工程化 (config.sh, Docker) |
| V3.0 | 攻击链 (Responder/Hashcat/psexec) |
| V3.1 | 情报层 (报告+Diff) |
| V4.0 | 合规层 (ROE) + AD 域 + TUI |
| V5.0 | SQLite 数据层 + AI 副官 |
| V5.0.1 | TUI 修复 + 实战工具 + Nuclei 集成 |
| V6.0 *(计划)* | Sliver C2 + Ligolo-ng |
| **V7.0** | **Agentic AI 智能体 (M1+M2)** |
| **V8.0-alpha** | **全栈作战平台 (FastAPI+React Bloomberg UI)** |

### 1.2 Agent 版本 (A 前缀)

Agent 智能体**独立于**平台版本，因为 Agent 演进频率更高。

```
格式: A{X}.{Y}
  A = Agent 版本前缀
  X = 里程碑 (M1=只读, M2=执行, M3=自主)
  Y = 迭代号
```

| Agent 版本 | 能力 | 状态 |
|---|---|---|
| A1.0 (M1) | 只读: 查库/读文件/列资产 | ✅ |
| **A2.0 (M2)** | **带锁执行: shell + HITL 三级分权** | **✅** |
| A3.0 (M3) *(计划)* | 自主任务链 + LLM Routing | – |
| A4.0 (M4) *(远期)* | 多 Agent 协作 + 知识图谱 | – |

### 1.3 Dockerfile 版本

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

### 1.4 Advisor 文档编号 (D 前缀)

Advisor 文档中的编号是**讨论批次编号**，不是版本号。

```
格式: D{N}_{TYPE}.md
  D    = 文档前缀
  N    = 讨论序号 (按时间递增)
  TYPE = PROPOSAL / FEEDBACK / RULING / QUESTIONS / ANSWERS
```

> **三轨版本号摘要**: `V7.0` = 平台版本, `A2.0` = Agent 版本, `D7` = 导师文档第 7 轮

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
├── backend/               # FastAPI 统一 API 层 (V8.0+)
├── frontend/              # Node.js/React Web大屏 (V8.0+)
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

### 4.3 Web 端架构规范 (V8.0 新增)
- **前端 (React/Vite)**: 纯静态分离，禁止在组件内写带副作用的死循环，UI 使用 Bloomberg 视觉标准（极黑背景无圆角）。
- **后端 (FastAPI)**: 标准化返回 JSON，长耗时任务必须异步（Celery/后台任务），绝不阻塞主线程。

### 4.4 配置管理
- Shell 自动化层的所有可配置项集中在 `config.sh`
- 新增配置项必须同步更新 `config.sh.example`
- Web 服务配置 (如 IP、端口) 可使用 `.env` 或复用 `config.sh` (由 Python 解析)
- API Key 等密钥**禁止**提交 Git

### 4.5 Git 提交规范

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

---

## 5. 强制文档同步清单

每次发布新版本或新增模块时，以下文档**必须同步更新**：

### 5.1 必须更新 (每次变更必须同步)

| 文档 | 更新内容 | 触发条件 |
|---|---|---|
| `CHANGELOG.md` | 新增版本段落 | 任何新增/变更 |
| `README.md` | 项目结构 + Make 指令表 + 版本线 | 新增模块/命令 |
| `docs/ARCHITECTURE.md` | 模块矩阵 + 数据流 | 新增模块 |
| `docs/ROADMAP.md` | 模块成熟度矩阵 + 里程碑 | 新增模块/里程碑变化 |
| `docs/OPERATIONS.md` | 前置条件表 | 新增模块 |
| `docs/CONVENTIONS.md` | 版本号更新 | 版本号变化 |

### 5.2 按需更新

| 文档 | 触发条件 |
|---|---|
| `docs/advisor/D{N}_*.md` | 导师交流后 |
| `config.sh.example` | 新增配置项时 |
| `Makefile` | 新增 make 指令时 |
| `Dockerfile` | 新增工具依赖时 |

### 5.3 文档同步 Git 提交规范

```
文档同步提交必须包含 📋 emoji 并注明所有已同步文档:

示例: 📋 全量文档同步 (CHANGELOG/README/ARCHITECTURE/OPERATIONS/ROADMAP)
```

---

*本文档是 Project CLAW 的工程治理基线。CONVENTIONS.md v2.0 — 2026-03-25*
