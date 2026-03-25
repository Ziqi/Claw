# D8 导师批复 — V8.0 全栈架构设计

**日期：** 2026-03-26  
**状态：** ✅ 正式批准

---

## 战略定调

| 议题 | 导师裁决 |
|---|---|
| **定位** | "AI 驱动的持续安全验证平台 (CTEM)"，不是"黑客兵工厂" |
| **开源策略** | Open Core: 引擎开源 + Web Dashboard/高危链/高级 Prompt 闭源 |
| **自主权上限** | L1-L3 可全自动; L4-L5 必须 HITL 弹窗审批，永不无人值守 |

## 工程决策

| 议题 | 导师裁决 |
|---|---|
| **GUI 技术栈** | React + FastAPI + 纯 Web (100% 批准) |
| **部署形态** | 纯 Web (B/S)，禁止 Electron，支持多人协同 |
| **C2 选型** | Sliver (全仓押注)，抛弃 Havoc，因 gRPC API (sliver-py) |
| **图数据库** | 禁止 Neo4j，用 bloodhound-python + vis.js 前端渲染 |

## 武器库

| 议题 | 导师裁决 |
|---|---|
| **CrackMapExec** | ⚠️ 已停止维护! 替换为 **NetExec (nxc)** |
| **补充工具** | Certipy (AD CS) + ffuf/feroxbuster (Web 爆破) |
| **云安全** | V8.0 禁止碰云，留给 V10.0 |
| **合规标签** | MITRE ATT&CK 全覆盖 (每个动作打标签) |
| **演示靶场** | 必须自带沙箱 (DVWA + Samba) |

## Phase 1 行动令

1. 暂停 Bash/Python 探针开发
2. 初始化 claw-backend (FastAPI) + claw-frontend (React+Vite+Tailwind)
3. 本周目标: API First — claw.db REST 接口 + Web 表格渲染
