# Project CLAW V5.0 — AI 工程助手反馈 (给导师)

**来源：** AI 工程助手 (Antigravity)  
**日期：** 2026-03-25  
**回应：** 导师 V5.0 "赛博飞升" 行动代令

---

## 一、完全同意的批示

### 1. SQLite 绝对 P0
JSON 喂给 LLM 确实会 token 爆炸。Text-to-SQL 是 LLM 最成熟的落地模式——AI 只需知道 schema 就能写查询，比解析嵌套 JSON 准确率高一个数量级。**先建库，再接 AI，工程依赖关系正确。**

### 2. 三张表设计
Assets / Ports / Vulnerabilities 极简且够用。建议增加 `scan_id` 字段，使 `08-diff` 变为 SQL JOIN，替代当前的文件比对。

### 3. OPSEC 分场景选型
真实 IP + 密码发送至云端 = 向第三方泄露渗透成果。本地 Ollama 方案对 Mac Apple Silicon 完全可行。

### 4. 脱敏层 (masking_layer) 强制要求
云端调用前 IP→[TARGET_A]、密码→[REDACTED]，返回后反向映射。这是工程底线。

---

## 二、有保留意见的地方

### 1. "全面废弃 JSON" → 建议改为"双输出"

| 方案 | 导师方案 | 工程助手建议 |
|---|---|---|
| 主存储 | SQLite | SQLite ✅ |
| JSON | 废弃 | **保留为快照导出** |

理由：
- `cat live_assets.json | jq .` 是最快的人眼审查方式
- 下游脚本 (07-report, 08-diff) 已依赖 JSON，全面重写风险高
- SQLite 为主，JSON 为副（每次写库后自动导出一份），零冲突

### 2. Phase 顺序微调

导师路线：
```
Phase 1 SQLite → Phase 2 Webhook → Phase 3 AI → Phase 4 Toolbox
```

工程助手建议：
```
Phase 1 SQLite → Phase 2 AI副官 → Phase 3 Webhook → Phase 4 Toolbox
```

理由：
- Webhook 本身 50 行代码，随时可加，不是阻塞项
- 但 AI 副官**强依赖 SQLite**（Text-to-SQL），应紧跟其后
- Webhook 告警可**复用 AI 分析结果**（"Lynx 发现异常" 比 "端口变化" 更有价值）

### 3. 模型选型：确定使用 Gemini 3 Flash

学生已有 Gemini API Key，经评估确认方案：

| 维度 | 方案 |
|---|---|
| 模型 | `gemini-3-flash-preview` (免费额度, 1M 上下文) |
| 集成方式 | TUI 中直接 `curl` 调 REST API (零 Python 依赖) |
| OPSEC | 靶场环境直接用; 实战加脱敏层 |

**两个菜单项的技术路线：**
- **16) AI 分析:** `generateContent` 单次调用, `thinking_level: high`
- **17) 问 Lynx:** Interactions API 多轮对话, `previous_interaction_id` 自动记忆上下文

---

## 三、确认的 V5.0 执行路线

```
Phase 1: SQLite 数据层      [本周]
  - 三张表: Assets / Ports / Vulns + scan_id
  - 02.5-parse.py 改为 SQLite 写入 + JSON 导出
  - 07-report / 08-diff 改读 SQLite

Phase 2: AI 智能副官         [下周上半段]
  - Gemini 3.1 API 先跑通 MVP
  - TUI 新增: 16) AI 分析  17) 问 Lynx
  - Text-to-SQL + 战术推演

Phase 3: Webhook 告警        [下周下半段]
  - cron 定时 make fast + make diff
  - 11-webhook.py → 钉钉/飞书机器人
  - 复用 AI 分析结果

Phase 4: Toolbox             [随时穿插]
  - make toolbox 子菜单
  - Nikto / Hydra (IoT) / Sqlmap
```

---

*恳请导师审阅并批示。如无异议，即刻启动 Phase 1。*
