import pytest
import asyncio
import httpx
import os
import sys
from unittest.mock import MagicMock

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

BASE_URL = "http://127.0.0.1:8000"

@pytest.fixture
async def client():
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        yield client

@pytest.mark.asyncio
async def test_chaos_monkey_delete_while_running(client: httpx.AsyncClient):
    """
    [流亡者之舞 (Chaos Monkey)]：
    模拟长官失误，在一个繁重的侦察任务刚开始发包（Pending）的时候，
    手贱点下“彻底删除战区”。系统必须优雅拦截阻断，绝对不能顺着外键把子进程挂起、
    或是由于僵尸进程把服务器带崩。
    """
    TEST_ENV = "test_chaos_red_zone"
    # 建个脆弱的环境
    await client.post("/api/v1/env/delete", json={"name": TEST_ENV})
    await client.post("/api/v1/env/create", json={"name": TEST_ENV, "env_type": "lan", "targets": "github.com"})
    await client.post("/api/v1/env/switch", json={"name": TEST_ENV})
    
    # [Step 1] 人工发起长耗时的扫描任务（它会被挂入 ACTIVE_JOBS）
    run_res = await client.post("/api/v1/ops/run", json={"command": "nmap", "theater": TEST_ENV})
    job_id = run_res.json().get("job_id")
    
    # 模拟手抖：0.1秒后还没跑完呢，立刻就给战区打上删除印记
    await asyncio.sleep(0.1)
    del_res = await client.post("/api/v1/env/delete", json={"name": TEST_ENV})
    
    # [混沌检验]：我们要么优雅拦截了这波删库，要求等待；要么用强制手段杀了那边的扫盘进程再成功删除！
    assert del_res.status_code == 200, f"混沌攻击失败：删除战区由于竞争锁挂起了 500 报错 {del_res.text}"
    
    # 此时再次尝试清理子池尸体（模拟 UI 上的 Kill X键），不能把空指针报错露到前端
    if job_id:
        kill_res = await client.post(f"/api/v1/ops/stop/{job_id}")
        assert kill_res.status_code in [200, 404], "业务流失衡：试图点击杀任务导致服务器抛出异常"

@pytest.mark.asyncio
async def test_ai_hallucination_tool_injection():
    """
    [AI 心智撕裂抵抗]：
    当 Gemini API 被混淆提示词攻击或自身幻觉时，
    假传工具请求或瞎写 JSON 结构，
    中间层转译引擎能否抗住崩溃（阻断 ValueError）。
    """
    # 此处利用 agent_mcp 的后端模型流逻辑，制造恶意的 _call_mcp_tool
    from backend.agent_mcp import _call_mcp_tool
    
    # 试图诱骗 MCP 开启不存在的命令：claw_burn_the_server
    try:
        res = await _call_mcp_tool("claw_burn_the_server", {"param": "nuclear"})
        # 业务合理性：我们不应该让 FastAPI 崩溃退出。我们应该优雅返回 "Tool execution failed" 字样，
        # 并吞吐到模型流上下文，让它知道自己发癫了！
        assert isinstance(res, str)
        assert "execution failed" in res.lower() or "not found" in res.lower() or "unknown tool" in res.lower(), "AI 降维抵抗弱：未知的工具请求没有转化为文字回执返回给模型"
    except Exception as e:
        pytest.fail(f"心智拦截破防：无效的幻觉工具导致后端报错了：{e}")

@pytest.mark.asyncio
async def test_malicious_input_escape(client: httpx.AsyncClient):
    """
    [非预期入参防御]：
    如果有人（或者被黑过的长官电脑）在新建战区的文字栏注入 XSS 
    或极端的换行符，后端接口的存储是否对单引号/非法换行免疫。
    """
    EVIL_ENV_NAME = "RedZone'; DROP TABLE assets; --"
    res = await client.post("/api/v1/env/create", json={"name": EVIL_ENV_NAME, "env_type": "lan", "targets": "127.0.0.1"})
    
    # 确保它即便创建了也不引发 SQLite 报错；或者被正则表达式正常拦截报错为 400
    assert res.status_code in [200, 400], "UI 穿透成功：恶意的单引号名称打爆了 SQLite 执行树"
    
    if res.status_code == 200:
        # 清理战场
        await client.post("/api/v1/env/delete", json={"name": EVIL_ENV_NAME})
