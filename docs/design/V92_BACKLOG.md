# V9.2 Architectural Optimization Backlog

**记录时间**：2026-03-29
**来源**：D1-D8 迭代盘点中发现的隐性错位

### 1. 孤儿进程管辖不对等 (Lifespan Asymmetry)
- **问题描述**：当前 `os.killpg` 清剿逻辑仅绑定了 `UI` 触发的 `ACTIVE_JOBS`。大模型 MCP 后台独占拉起的 `mcp_armory_server.py` 本身及其派生出来的武器级子进程缺乏生命周期注册机制。如果 `uvicorn`/FastAPI 异常崩溃，AI 端派生的进程可能逃逸。
- **优化方案预案**：在 MCP 进程管理池中建立统一的进程组 ID (PGID) 登记表，并在 FastAPI `lifespan` 钩子中进行全域扫描。

### 2. 数据库 schema 管辖权分裂 (Schema Fragmentation)
- **问题描述**：核心四库定义于 `db_engine.py` 的全局 `SCHEMA`。但在 D6 手术中，为解决 SQLite 高频锁死并极速上线，`agent_mcp.py` 内部强行嵌入了 `mcp_messages` 时序表的 `CREATE TABLE IF NOT EXISTS` DDL 操作。这违背了单一建表出口原则，日后容易诱发迁移遗漏。
- **优化方案预案**：将 `mcp_messages` 表及其相关的 `WAL` 模式配置项上卷收归入 `db_engine.py` 进行统管。

---
*注：此 Backlog 暂不阻塞 V9.2 主线业务，定于 D9 修复完毕及 9 轮大复盘后抽空平扫优化。*
