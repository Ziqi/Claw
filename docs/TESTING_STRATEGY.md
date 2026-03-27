# 🛡️ CLAW 自动化测试战略纲领 (Testing Strategy)

## 0x00 为什么我们需要系统级化测试？
随着 CLAW V8.2 引入极具破坏性的 **多态 AI 武器 (MCP)** 和高危的 **多线程底层系统调用 (OP Pipeline)**，代码库的任何一丝变动都可能引发致命后果：
1. **防越权**：保证红队扫描数据绝对不会跨越“战区 (Theater)”泄露给客户。
2. **防核爆**：保证 AI 不会因为 `prompt` 绕过而调用系统底层 API 将本机（指挥台）给格盘。
3. **防崩盘**：保证大量并发的 WebSocket PTY 通信和 SSE 长轮询日志不会将 Uvicorn 异步循环死锁。

## 0x01 测试层级架构图 (The Test Pyramid)

我们将采取 3 层测试防线护城河：

### 🏔️ 第一层：核心逻辑单元测试 (Unit Tests)
**范围**：不依赖数据库、不依赖网络、不依赖大模型的纯 Python 计算模块。
* `test_db_engine.py`: 测试纯 SQL 语句的合法性、SQLite 并发写的锁机制检测。
* `test_agent_nlp.py`: 测试命令敏感分类器 (`RED`/`YELLOW`/`GREEN`) 的正则与词法拦截率。
* `test_mcp_schema.py`: 测试 MCP 描述文件抽取器，能否正确将 Python TypeHints 转换成 Google Gemini Schema。

### 🛥️ 第二层：接口与组件集成测试 (Integration Tests)
**范围**：测试具有环境依赖的连通性（数据库+FastAPI路由）。
* **战区沙盒流**：`T0`创建环境 -> `T1`注入扫描结果 -> `T2`切换环境查询 -> 断言获取为空 -> `T3`删除原环境。全面跑通租户逻辑。
* **OP 流水线**：模拟生成常驻进程 (`ping / nmap`)，测试异步获取 PID，中途测试 `ops_stop` API 猎杀进程树的成功率。
* **并发防波堤**：复用我们刚才构建的 `test_uvicorn_async.py` 穿刺脚本，确保日后无论谁修改 `main.py` 导致了 I/O 阻塞，都会被测试环境当场拦截卡死。

### 🚢 第三层：模拟人机交互测试 (E2E & Chaos Tests)
**范围**：将整个系统黑盒化，利用无头浏览器从外部进行物理模拟点击。
* **端到端 UI (`Playwright`)**：模拟红队攻击者点开浏览器 -> 新建战区 -> 切换侧边栏 -> 点击 "AI 渗透" -> 断言弹出交互窗。
* **Chaos Monkey (混沌破坏测试)**：在运行长耗时漏洞扫描的途中，强制断开浏览器的 WiFi / SSE 连接，断言后端的 `background_waiter` 安全接管文件资源不漏内存，僵尸进程不逃逸。

---

## 0x02 覆盖率指标与执行流水线 (CI/CD)
在此模块完工后，所有的 `pytest` 脚本会被汇总，利用 `pytest-cov` 分析。要求 `backend/` 目录下核心的 `main.py` 和 `agent_mcp.py` 必须达成至少 **85% 的代码行覆盖率**。
我们在后续甚至可以将该脚本挂载到 GitHub Actions，每次 Git Push 都自动运行。
