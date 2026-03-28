import pytest
import asyncio
import httpx
import os
import sys

# 强行注入模块搜索路径以拉取类型与服务
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

BASE_URL = "http://127.0.0.1:8000"
UX_TEST_ENV = "test_ux_journey_redteam"

@pytest.fixture
async def client():
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        yield client

@pytest.mark.asyncio
async def test_ux_journey_full_tactical_flow(client: httpx.AsyncClient):
    """
    [全环节通关]：模拟用户完整的点击动作流，不跳过任何依赖。
    一键建战区 -> 设定上帝模式 (Scope) -> 发起探测 -> 分页搜索断言 -> 生成报告 -> 删战区收尾
    """
    # [Step 1] 点击下拉框：清空同名老战区，建立全新战役靶场
    await client.post("/api/v1/env/delete", json={"name": UX_TEST_ENV})
    create_res = await client.post("/api/v1/env/create", json={
        "name": UX_TEST_ENV, "env_type": "lan", "targets": "127.0.0.1"
    })
    assert create_res.status_code == 200, "UX 崩溃：新建大盘无端报错"
    
    # [Step 2] 切换左侧战区侧边栏
    switch_res = await client.post("/api/v1/env/switch", json={"name": UX_TEST_ENV})
    assert switch_res.status_code == 200, "UX 崩溃：点击新战区无法挂载"
    
    # [Step 3] 开启上帝模式，修改 Scope
    scope_res = await client.post("/api/v1/scope", json={"scope": ["127.0.0.1", "192.168.1.0/24"]})
    assert scope_res.status_code == 200, "UX 崩溃：写入 Scope 文本框失败"

    # [Step 4] 用户点击 Nmap Probe！生成挂载的进程 Task
    run_res = await client.post("/api/v1/ops/run", json={"command": "nmap", "theater": UX_TEST_ENV})
    assert run_res.status_code == 200
    job_data = run_res.json()
    assert "job_id" in job_data, "业务错误：点击运行探测后没给到 job_id 进行进度追踪"
    
    # 模拟等待网卡缓冲
    await asyncio.sleep(0.5)
    
    # [Step 5] 用户切换到大盘 Assets Table 进行翻页与字符搜索
    assets_res = await client.get("/api/v1/assets?search=127&page=1&size=50")
    assert assets_res.status_code == 200
    assets_data = assets_res.json()
    assert isinstance(assets_data.get("assets", []), list), "大盘坠毁：拿到的 Assets 不是 List 导致 React 树崩溃"
    
    # [Step 6] 模拟查杀正在进行的任务，点击 X 号
    job_id = job_data["job_id"]
    kill_res = await client.post(f"/api/v1/ops/stop/{job_id}")
    assert kill_res.status_code == 200, "操作阻断：不让用户安全结束并杀死进行中的探测任务"
    
    # [Step 7] 业务完结，点击生成大屏战报
    report_res = await client.get("/api/v1/report/generate")
    assert report_res.status_code == 200
    report_content = report_res.json().get("report", "")
    assert isinstance(report_content, str), "报告导出失败：渗透产出为空载体"
    
    # [Step 8] 落幕清理，点选战区配置，彻底粉碎数据
    del_res = await client.post("/api/v1/env/delete", json={"name": UX_TEST_ENV})
    assert del_res.status_code == 200, "删除防线被卡：带有附带挂载进程/资产表的战区被锁死禁止删除"
    
@pytest.mark.asyncio
async def test_ux_god_mode_and_sliver(client: httpx.AsyncClient):
    """
    [额外按钮挂载与状态流]：上帝模式启停保护，与 Sliver C2 Session 端点的空态保护
    """
    # 无论有无会话，Sliver 都应返回空数组，而不是抛 500 把页面搞出 Undefined 弹窗
    slv_res = await client.get("/api/v1/sliver/sessions")
    assert slv_res.status_code == 200
    # 该接口通常返回 {"sessions": []}
    
    # 上帝模式读取状态应该能完美承接给 Zustand store
    scope_res = await client.get("/api/v1/scope")
    assert scope_res.status_code == 200
    assert "god_mode" in scope_res.json(), "Zustand 的 GodMode 参数源头丢失"
