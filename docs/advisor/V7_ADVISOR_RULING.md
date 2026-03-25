# Project CLAW v7.0 — 导师批复与技术路线定稿

**来源：** 导师/教授  
**日期：** 2026-03-25  
**触发文件：** `V7_AGENTIC_PROPOSAL.md`

---

## 导师核心判定

> **"CLAW v7.0 不需要艰难的底层重构，我们可以直接实现赛博飞升！"**

导师完全认可 Agentic 架构方向，并指出 Google Gemini 3 的 **Interactions API** 已在底层 API 级别**原生解决了**我们提案中的所有技术瓶颈。

---

## 关键技术修正 (导师指令)

### 1. 废弃上下文截断 → 拥抱 Server-side State

- **原方案**：外挂 ChromaDB 向量库做记忆管理
- **导师修正**：切换到 **Interactions API**，通过 `previous_interaction_id` 让 Google 服务器自动维护 **1M Token** 的攻击链上下文
- **收益**：几万行渗透日志直接砸给它，永不遗忘，且降低重复 Token 成本

### 2. 死守 Thought Signatures (思维签名)

- **致命暗坑**：Gemini 3 依赖动态推理 (Thinking)，每次 Function Call 会生成加密的 `thoughtSignature`
- **架构红线**：将执行结果通过 `function_result` 传回模型时，**必须原封不动带上签名**
- **后果**：一旦漏传，Agent 瞬间"失忆"并抛出 400 错误，渗透死循环

### 3. Function Calling 标准化

导师给出了标准的 JSON Schema 工具声明格式：
```json
[
  {
    "name": "claw_execute_shell",
    "description": "执行非交互式 Bash 命令。破坏性命令触发人类授权拦截。",
    "parameters": { "command": {"type": "string"} }
  },
  {
    "name": "claw_query_sqlite",
    "description": "执行 SQL 查询渗透资产库 (claw.db)。",
    "parameters": { "sql": {"type": "string"} }
  }
]
```

### 4. HITL Kill Switch (审批机制)

- 🟢 **绿灯**：`claw_query_sqlite` → 自动执行
- 🔴 **红灯**：`claw_execute_shell` + 破坏性指令 → 终端阻塞，弹 `[Y/n]`
- 拒绝后返回 `"执行被人类指挥官拒绝"` 让模型重新规划

---

## 四个杀手级进阶方向 (导师挖掘)

| # | 方向 | API 支撑 | 战术价值 |
|---|---|---|---|
| 1 | **免搓脚本数据清洗** | `code_execution` 内置沙箱 | AI 自己写 Python 解析乱码/XML |
| 2 | **战前 Deep Research** | `deep-research-pro` Agent | 后台静默爬网做 OSINT 情报 |
| 3 | **动态思维引擎** | `thinking_level` (low/high) | 查库用 low，横移决策用 high |
| 4 | **MCP Server 架构** | `mcp_server` 原生支持 | 把 CLAW 变成任何大模型的武器库 |

---

## MVP 破冰路线图 (导师定调)

### Milestone 1: 只读智能体 (The Observer)
- 接入 Interactions API
- 仅开放 `claw_query_sqlite`
- 验证：AI 自主写 SQL 查库 + Thought Signature 传递

### Milestone 2: 带锁的执行者 (The Copilot+)
- 开放 `claw_execute_shell`，全局 100% 拦截 (所有命令弹 Y/n)
- 验证：AI 提议 → 人类授权 → 本地执行 → 结果传回 AI

### Milestone 3: 全自动红队智能体 (Full Autonomous Agent)
- 引入 RBAC 白名单 (nmap 自动放行，psexec 拦截)
- 达成 **"One-Prompt Pentesting"**

---

*V7.0 技术路线已获导师全面认可。等待首席工程官排期启动。*
