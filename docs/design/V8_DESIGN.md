# Project CLAW V8.2 — 全栈作战平台设计规范

**Project CLAW · V8.2 / A2.1**  
**版本：** 1.2 (新增作战流程流水线与动态输出引擎)  
**日期：** 2026-03-27  
**状态：** ✅ 执行中, Sprint 2 作战台已完成

---

## 一、平台定位

```
CLAW V7.0:  工具集 → 框架 (已跨越: 有编排+数据层+Agent)
CLAW V8.0:  框架 → 作战平台 (GUI + 态势感知 + 审计 + AI 赋能)
CLAW V8.2:  工作空间隔离 + 标准化流式流程引擎 (Operation Pipeline)
核心差异化: 市面唯一内置 LLM Agent 的红队作战平台
```

**论文定位 (导师定调)**：LLM-Native 微服务架构范式下的 AI 赋能红队作战平台。三大创新点：
1. **Explainable Thought Chain (XAI)** — 基于 Structured Output 的可视决策树
2. **Cryptographic Proof of HITL** — 基于 Challenge-Response 的 Action Token 密码学级安全锁
3. **Risk-Aware Dynamic Reasoning** — `thinking_level` 联动风险等级动态分配算力

---

## 二、技术栈

| 层 | 技术选型 | 备注 |
|---|---|---|
| **前端** | React + Vite + Tailwind | Bloomberg Terminal UI (纯黑 #000 / 琥珀金 #FF9900 / 青色 #00FFFF) |
| **后端** | FastAPI (Python) | REST API + SSE 流式推送 |
| **流水线** | `subprocess.Popen` + 异步生成器 | `ops/run` 异步执行，`ops/log` SSE 日志追踪 |
| **AI 引擎** | Gemini 3 Interactions API | 服务端状态管理 + Thought Signatures 自动处理 |
| **数据库** | SQLite (claw.db) → PostgreSQL (长期) | 扩展 conversations/messages/agent_audit/pending_actions 表 |
| **SSE 前端** | `@microsoft/fetch-event-source` | 支持 POST + JWT Header + 断线重连 |
| **可视化** | Vis.js (拓扑) + CSS Grid (ATT&CK) + React Tree | P0 优先级 |
| **终端集成** | xterm.js (Eavesdropping Shell) | 过滤后抄送 Agent，非全量旁听 |

---

## 三、AI 架构 (导师批复)

### 3.1 Interactions API 全面迁移 (P0)

**旧模式 (generateContent)**：手动管理 conversation_history + thoughtSignature → token 爆炸 + 400 错误风险

**新模式 (Interactions API)**：
```python
# 只需存储 interaction_id，上下文由 Google 服务端管理
interaction = client.interactions.create(
    model="gemini-3-flash-preview",
    input=user_query,
    previous_interaction_id=last_interaction_id,  # 自动继承 1M token 上下文
    config={"thinking_level": risk_to_thinking(hitl_level)}
)
```

### 3.2 Risk-Aware Dynamic Cognitive Routing

| HITL 级别 | Thinking Level | 行为 |
|---|---|---|
| 🟢 GREEN (L1-L2) | `low` / `minimal` | 自动执行，极速响应 |
| 🟡 YELLOW (L3) | `medium` | 单次确认 [Y/n] |
| 🔴 RED (L4-L5) | `high` | 强制自我反思 + 人类审批 + Challenge 质询 |

RED 级操作流程：
1. Agent 输出 `thinking_level="high"` 的深度风险评估
2. 前端弹出审批框 + 倒计时 (60s)
3. 质询：输入目标 IP 最后一段确认
4. 审计日志记录完整链路

### 3.3 Structured Output (强制)

Agent 每步输出必须符合 Pydantic JSON Schema：
```json
{
  "thought": "检测到 445 端口开放，疑似 SMB 服务...",
  "action_tool": "claw_execute_shell",
  "action_input": "nxc smb 10.140.0.96 --shares",
  "mitre_ttp": "T1021.002 - SMB/Windows Admin Shares",
  "justification": "枚举共享目录是横向移动的标准前置步骤",
  "risk_level": "YELLOW"
}
```

前端渲染为**思维链折叠树** (React Tree) → 100% 可解释性 (XAI)。

---

## 四、UI/UX 设计规范

### 4.1 四栏布局 (重构后)

```
┌──────────────────────────────────────────────────────────┐
│                    HUD 战区切换与状态栏                    │
├────┬──────────┬───────────────────────┬──────────────────┤
│ RC │ Sidebar  │      WorkArea         │  AI Copilot      │
│ AT │ (威胁大盘│ (侦察/资产/端口/拓扑)    │  (对话/思维链/    │
│ AM │  /资产/  │ (OP: 5阶段作战流水线)   │   审批/Chips)    │
│ OP │  C2)    │ (下放式 Console 控制台) │                  │
│ C2 │          │                       │                  │
│ VS │          │                       │                  │
├────┴──────────┴───────────────────────┴──────────────────┤
│                  永远不做移动端适配                         │
└──────────────────────────────────────────────────────────┘
```

### 4.2 交互增强

| 特性 | 设计 | 优先级 |
|---|---|---|
| **Cmd+K 全局搜索** | 输入 IP/端口/关键词，瞬间跳转 | P0 |
| **Context-Aware Chips** | 点击 IP → `[扫全端口] [识别 OS]`；点击 80 → `[Nuclei] [截图]` | P1 |
| **对话持久化** | SQLite conversations/messages 表 + Campaign ID + Interactions API | P0 |
| **新建/历史对话** | Copilot 顶部 `[+新建]` + `[📜历史]` | P0 |

### 4.3 可视化优先级

| 优先级 | 组件 | 用途 |
|---|---|---|
| **P0** | 树状折叠列表 (React Tree) | Agent 思维链展开 — 论文截图核心 |
| **P0** | ATT&CK 热力矩阵 (CSS Grid) | 战术覆盖度 — 行业标准 |
| **P1** | 力导向图 (Vis.js) | 网络拓扑 — 演示视觉中心 |
| **P1** | 进度条/饼图 (Recharts) | 扫描进度/服务分布 |

---

## 五、安全架构

### 5.1 HITL 三级分权 + Action Token

```
GREEN  → 自动执行，无需审批
YELLOW → [Y/n] 单次确认，5s 超时默认拒绝
RED    → UUID Action Token + 60s 倒计时 + Challenge 质询
         质询内容: "请输入目标 IP 最后一段 [.96] 以确认"
         审批记录写入 agent_audit 表 (不可篡改)
```

### 5.2 Eavesdropping Shell (AG 模块)

- xterm.js 连接 **CLAW 调度引擎**（非直接 Bash）
- 人类敲命令 → 引擎转发执行
- stdout/stderr 实时滚动 + **过滤后抄送** Lynx Agent
- Agent 右侧面板出建议（人机共驾 Human-AI Teaming）
- HITL 约束：`rm -rf` 类命令自动拦截

---

## 六、工具集成路线 (导师批准)

| 工具 | 优先级 | 集成方式 | 状态 |
|---|---|---|---|
| **NetExec (nxc)** | P0 | Docker (替代 CrackMapExec) | D9 批准 |
| **Certipy** | P1 | Docker | D9 批准 |
| **Sliver C2** | P1 | 独立部署, gRPC API | D9 批准 |
| **Ligolo-ng** | P1 | 独立部署 | D9 批准 |
| **Deep Research Agent** | P1 | Gemini Interactions API (background) | D10 批准 |

---

## 七、竞品对标

| 能力 | Mythic | Caldera | PentestGPT | AutoGPT | **CLAW V8.0** |
|---|---|---|---|---|---|
| 自然语言→自动攻击 | ❌ | ❌ | ✅ 纯 Copilot | ❌ | ✅ **自主执行** |
| 可解释思维链 | ❌ | ❌ | 部分 | ❌ | ✅ **Structured Output** |
| Web HITL 审批 | ✅ | ✅ | ❌ | ❌ | ✅ **Challenge-Response** |
| ATT&CK 映射 | ✅ | ✅ 核心 | ❌ | ❌ | ✅ **自动 TTP 标注** |
| Dynamic Reasoning | ❌ | ❌ | ❌ | ❌ | ✅ **独创** |

---

## 八、实施阶段

### Phase 1: 黎明中枢 ✅ (已完成)
- FastAPI 5 端点 + React Bloomberg UI + AI Copilot 面板

### Phase 2: 核爆行动 🚧 (72h 冲刺)
1. **重构中枢** — Interactions API 全面替换 generateContent
2. **结构化枷锁** — Pydantic Schema 强制 JSON 决策树输出
3. **SSE 桥梁** — `@microsoft/fetch-event-source` → 前端流式渲染

### Phase 3: 全域作战
- 对话持久化 (conversations/messages 表)
- Context-Aware Chips + Cmd+K Spotlight
- ATT&CK 热力矩阵 + 思维链折叠树

### Phase 4: C2 与情报
- Sliver gRPC 接入 + Ligolo-ng 路由管理
- Deep Research Agent (异步 OSINT)
- 渗透报告一键生成 (PTES/OWASP 模板)

---

*本文档是 Project CLAW V8.0 全栈作战平台的正式工程规范，综合了 D8/D9/D10 三轮导师批复的所有决策。*
