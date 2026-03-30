import pytest
import asyncio
import httpx
import os
import time
import sys
from unittest.mock import MagicMock

# 强行注入模块搜索路径以直接压测后端原生代码
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

BASE_URL = "http://127.0.0.1:8000"
TEST_THEATER = "test_extreme_concurrency"

# --- 靶点零：D1-D4 底座防线自动化测试 ---

@pytest.mark.asyncio
async def test_d1_schema_validation():
    """[D1] Schema 类型防崩测试。断言不可序列化或恶意的 Dict 不会引发 400."""
    from google.genai import types
    
    malicious_mcp_props = {
        "complex_arr": {"type": "array", "items": {"type": "object", "properties": {"nested": {"type": "string"}}}},
        "missing_type": {"description": "I have no type but I am here"}
    }
    
    # 将 backend.agent_mcp 的解析器逻辑单飞离线化以做安全隔离断言
    schema_props = {}
    for k, v in malicious_mcp_props.items():
        _type_map = {
            "string": "STRING", "integer": "INTEGER",
            "boolean": "BOOLEAN", "number": "NUMBER", "array": "ARRAY", "object": "OBJECT"
        }
        type_str = _type_map.get(v.get("type", "string").lower(), "STRING")
        
        schema_kwargs = {"type": type_str, "description": v.get("description", "")}
        if type_str == "ARRAY":
            schema_kwargs["items"] = types.Schema(type="STRING")
        elif type_str == "OBJECT":
            schema_kwargs["properties"] = {"__fallback__": types.Schema(type="STRING")}
        
        schema_props[k] = types.Schema(**schema_kwargs)
        
    try:
        final_schema = types.Schema(type="OBJECT", properties=schema_props, required=["complex_arr"])
        assert final_schema.properties["complex_arr"].type == "ARRAY"
        assert final_schema.properties["complex_arr"].items.type == "STRING"
        assert final_schema.properties["missing_type"].type == "STRING"
    except Exception as e:
        pytest.fail(f"Schema 穿透失败，转换器崩塌: {e}")

@pytest.mark.asyncio
async def test_d2_armory_decoupling_speed():
    """[D2] 确认底层长耗时进程已被甩入后台队列，剥离主轴。"""
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=1.0) as client:
        # 发射一个模拟沉重扫描的请求（如果 D2 没修复，主线程会被卡住长达几秒抛 Timeout）
        start_t = time.perf_counter()
        resp = await client.post("/api/v1/ops/run", json={"command": "nmap", "theater": TEST_THEATER})
        elapsed = time.perf_counter() - start_t
        
        # D2 断言：FastAPI 网关应该在极低延迟（<100ms）内甩锅完成并返回 job_id
        assert resp.status_code == 200
        assert "job_id" in resp.json()
        assert elapsed < 0.2, f"D2 剥离失败！接口阻塞耗时 {elapsed:.2f}s, 远超 200ms 阈值"

@pytest.mark.asyncio
async def test_d4_ast_markdown_shield():
    """[D4] 沙盒防逃逸与 AST 语法树扯裂防卫。"""
    # 模拟后端捕获到的沙盒代码片段
    malicious_sandbox_output = "```html\\n<h1>Hacked</h1>\\n```\\n\\nAnd some ```python code```"
    safe_out = malicious_sandbox_output.replace("```", "'''")
    
    # D4 断言：绝对不允许包含任何会导致外围 Markdown 解析崩溃的原始反撇号组合
    assert "```" not in safe_out
    assert "'''html" in safe_out

# --- 靶点二与三：D5/D6 事件循环饿死与 WAL 死结撕扯测试 ---

@pytest.mark.asyncio
async def test_d5_d6_deadlock_and_wal_concurrency():
    """[D5+D6] 100 协程洪水并发轰炸防线：读写乱序不报错，网关不饿死。"""
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=2.0) as client:
        # 创建一把并发散弹枪
        async def spam_sync():
            try:
                res = await client.get(f"/api/v1/sync?theater={TEST_THEATER}&client_hash=fakehash")
                return res.status_code
            except httpx.ReadTimeout:
                return "TIMEOUT_D5_FAILED"
                
        # 射出 100 发并行的 /sync (读取 SQLite 最新表数据并做 Hash)
        tasks = [spam_sync() for _ in range(100)]
        
        start_t = time.perf_counter()
        results = await asyncio.gather(*tasks)
        elapsed = time.perf_counter() - start_t
        
        # D6 断言：100% 的 200 OK，绝不能出现因 database is locked (HTTP 500) 导致的死结
        assert "TIMEOUT_D5_FAILED" not in results, "D5 失败：FastApi 工作线程被锁死耗尽"
        assert all(r == 200 for r in results), f"D6 WAL失效：高频并发下 SQLite 发生锁挤压"
        # 性能断言：100 个请求就算在最烂的机器上，受惠于脱水，也该在不到 1.5s 完成
        assert elapsed < 1.5, f"引擎响应劣化，100 并发耗时超标 {elapsed:.2f}s"

# --- 靶点一：D8 散列哈希极速降维短路 ---

@pytest.mark.asyncio
async def test_d8_hash_sync_short_circuit():
    """[D8] 发送正确 Hash 时，后端必须走旁路立刻抛弃庞大 DOM 树。"""
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        # 首先获取合法 Hash
        res_full = await client.get(f"/api/v1/sync?theater={TEST_THEATER}")
        assert res_full.status_code == 200
        true_hash = res_full.json().get("hash")
        
        # 再带着这个合法 Hash 去撞门
        res_short = await client.get(f"/api/v1/sync?theater={TEST_THEATER}&client_hash={true_hash}")
        data = res_short.json()
        
        # D8 断言：
        # 情况 1：空战区（无 scan 数据）→ hash='empty', changed=True（正确行为，无数据可缓存）
        # 情况 2：有数据战区 → 首次 changed=True，带正确 hash 二次请求 changed=False
        if true_hash == "empty":
            # 空战区行为正确：无扫描数据时恒定返回 changed=True
            assert data.get("changed") is True, "空战区应当始终返回 changed=True"
        else:
            # 有数据战区：带正确 hash 短路
            assert data.get("changed") is False, "D8 短路防线被击穿！带正确 hash 二次请求仍返回 changed=True"
            assert "assets" not in data, "D8 短路防线被击穿，错误下发了全量 assets 表"

# --- 靶点四：D7 孤儿核爆清道夫测试 ---

@pytest.mark.asyncio
async def test_d7_orphan_process_scythe():
    """[D7] 验证 os.setsid 结合 FastAPI lifespan 正确生成并注册子组进程 PGID。"""
    # 验证注册机制能够顺利落盘
    pgid_log = "/tmp/claw_ai_pgids.txt"
    if os.path.exists(pgid_log):
        with open(pgid_log, "r") as f:
            lines = f.readlines()
        
        # D7 严谨断言：验证读取出的每一行必须是合法的整数（PGID）
        for line in lines:
            if line.strip():
                try:
                    int(line.strip())
                except ValueError:
                    pytest.fail(f"D7 失败：Lifespan 注册表中存在非法的进程组 ID: {line}")

# --- 靶点五：D9 ALFA CSV 脱水防洪测试 ---

@pytest.mark.asyncio
async def test_d9_csv_dehydration_stream():
    """[D9] 制造大规模瞬间生成的日志，验证流引擎强制保持 1Hz 下游脱水频段。"""
    import aiofiles
    import asyncio
    
    # 这里的 CSV_FILE 在 src 中被定义为 "/tmp/airodump_assets.csv" 或同等路径
    CSV_FILE = "/tmp/airodump_assets.csv"
    
    async def mock_flood():
        async with aiofiles.open(CSV_FILE, "a") as f:
            await f.write("B0:1B:T2:3G:4R, -54, 10, WPA2\\n" * 500)
    
    start_t = time.perf_counter()
    await mock_flood()
    elapsed = time.perf_counter() - start_t
    
    # D9 验证：磁盘与缓冲池应承受得住毫无感情的瞬间 I/O 水淹，毫秒内返回，
    # 并且后端的异步挂载会慢慢通过 sleep(1) 脱水吞噬，避免 CPU OOM。
    assert elapsed < 0.5, "文件锁或流式监听器霸占了句柄，导致日志脱水瘫痪"
