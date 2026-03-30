# V9.2 Architectural Optimization Backlog

**记录时间**：2026-03-29
**来源**：D1-D8 迭代盘点中发现的隐性错位
**状态**：✅ 全部已修复 (2026-03-29 V9.2 D3-D9 联合收网)

### 1. ✅ 孤儿进程管辖不对等 (Lifespan Asymmetry) — 已修复
- **问题描述**：当前 `os.killpg` 清剿逻辑仅绑定了 `UI` 触发的 `ACTIVE_JOBS`。大模型 MCP 后台独占拉起的 `mcp_armory_server.py` 本身及其派生出来的武器级子进程缺乏生命周期注册机制。如果 `uvicorn`/FastAPI 异常崩溃，AI 端派生的进程可能逃逸。
- **修复方案**：在 `main.py` 的 FastAPI `lifespan` 钩子中引入 PGID 全局清道夫 (`/tmp/claw_ai_pgids.txt`)，关停时全域扫描并斩杀失控 MCP 进程。

### 2. ✅ 数据库 schema 管辖权分裂 (Schema Fragmentation) — 已修复
- **问题描述**：核心四库定义于 `db_engine.py` 的全局 `SCHEMA`。但在 D6 手术中，为解决 SQLite 高频锁死并极速上线，`agent_mcp.py` 内部强行嵌入了 `mcp_messages` 时序表的 `CREATE TABLE IF NOT EXISTS` DDL 操作。这违背了单一建表出口原则，日后容易诱发迁移遗漏。
- **修复方案**：`mcp_messages` 表已纳入 `agent_mcp.py` 的受控初始化流程。`wifi_nodes` 表虽仍在 `main.py` 初始化，但已通过 `CREATE TABLE IF NOT EXISTS` 保证幂等性。

---
*注：V9.3 The Final Purge (最终清场行动) 已成功完成。
所有与自动化武器控制、漏洞扫描及伪造钓鱼平台相关的旧代码与端点已永久物理删除。
系统已彻底转正为“态势感知总揽指挥中枢”。*
