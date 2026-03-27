#!/usr/bin/env python3
"""
CLAW Agent MCP V8.2 — Optimized for speed.

Performance fix: MCP tool schema is discovered ONCE at startup and cached.
Each chat message only creates a lightweight Gemini chat (no subprocess spawn).
The MCP subprocess is only spawned when a tool is actually called.
"""
import os, json, sqlite3, asyncio
from typing import AsyncGenerator
from mcp.client.stdio import stdio_client
from mcp.client.session import ClientSession
from contextlib import AsyncExitStack
from mcp import StdioServerParameters
from google import genai
from google.genai import types

from backend.agent import BASE_DIR, DB_PATH, classify_command, audit_log_write, SYSTEM_PROMPT, MODEL, API_KEY

# ====== Cached MCP Tool Declarations ======
_cached_gemini_tools = None
_cached_fn_decls = None
_cache_lock = asyncio.Lock()

async def _discover_mcp_tools():
    """Discover MCP tools ONCE and cache the Gemini-format declarations."""
    global _cached_gemini_tools, _cached_fn_decls
    
    server_params = StdioServerParameters(
        command="python3",
        args=[os.path.join(BASE_DIR, "backend", "mcp_armory_server.py")]
    )
    
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            mcp_tools_res = await session.list_tools()
            
            fn_decls = []
            for t in mcp_tools_res.tools:
                props = t.inputSchema.get("properties", {})
                req = t.inputSchema.get("required", [])
                schema_props = {}
                for k, v in props.items():
                    type_str = "STRING" if v.get("type") == "string" else (
                        "INTEGER" if v.get("type") == "integer" else "STRING"
                    )
                    schema_props[k] = types.Schema(type=type_str, description=v.get("description", ""))
                
                schema = types.Schema(type="OBJECT", properties=schema_props, required=req)
                fn_decls.append(types.FunctionDeclaration(
                    name=t.name, description=t.description, parameters=schema
                ))
            
            _cached_fn_decls = fn_decls
            _cached_gemini_tools = [types.Tool(function_declarations=fn_decls)]
    
    return _cached_gemini_tools


async def _get_gemini_tools():
    """Get cached Gemini tool declarations, discovering them if needed."""
    global _cached_gemini_tools
    if _cached_gemini_tools is not None:
        return _cached_gemini_tools
    
    async with _cache_lock:
        # Double-check after acquiring lock
        if _cached_gemini_tools is not None:
            return _cached_gemini_tools
        return await _discover_mcp_tools()


_mcp_queue = asyncio.Queue()
_mcp_worker_task = None

async def _mcp_worker():
    server_params = StdioServerParameters(
        command="python3",
        args=[os.path.join(BASE_DIR, "backend", "mcp_armory_server.py")]
    )
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            while True:
                tool_name, args, future = await _mcp_queue.get()
                try:
                    result = await session.call_tool(tool_name, arguments=args)
                    future.set_result(result)
                except Exception as e:
                    future.set_exception(e)

async def _call_mcp_tool(tool_name: str, args: dict) -> str:
    """Use persistent MCP session pool via dedicated async worker task to bypass AnyIO scope limits."""
    global _mcp_worker_task
    if _mcp_worker_task is None:
        _mcp_worker_task = asyncio.create_task(_mcp_worker())
        
    loop = asyncio.get_running_loop()
    future = loop.create_future()
    await _mcp_queue.put((tool_name, args, future))
    
    try:
        result = await future
        return result.content[0].text if result.content else ""
    except Exception as e:
        return f"Tool execution failed: {str(e)}"


async def react_loop_stream(user_input: str, campaign_id: str = "default", model_key: str = "flash") -> AsyncGenerator[str, None]:
    def sse(event: str, data: dict) -> str:
        return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

    if not API_KEY:
        yield sse("error", {"message": "未配置 API Key"})
        return
    
    yield sse("RUN_STARTED", {"status": "Lynx 正在初始化..."})

    # Model mapping: frontend key → (Gemini model, base thinking level)
    # NOTE: gemini-3-pro-preview was deprecated & shut down 2026-03-09.
    #       Migrated to gemini-3.1-pro-preview per official deprecation notice.
    #
    # 4-tier capability ladder:
    #   Flash     = 3-flash  + low     (fast, cheap)
    #   Think     = 3-flash  + high    (fast + deep reasoning)
    #   Pro       = 3.1-pro  + medium  (big model, balanced)
    #   Deep Think = 3.1-pro + high    (big model, max reasoning)
    MODEL_CONFIG = {
        "flash": ("gemini-3-flash-preview", "low"),
        "think": ("gemini-3-flash-preview", "high"),
        "pro":   ("gemini-3.1-pro-preview", "medium"),
        "deep":  ("gemini-3.1-pro-preview", "high"),
    }
    selected_model, base_thinking = MODEL_CONFIG.get(model_key, (MODEL, "low"))

    # Risk-Aware Dynamic Cognitive Routing (D10 批复)
    # For Flash mode, risk can escalate thinking; other modes keep their preset.
    if model_key == "flash":
        prompt_risk = classify_command(user_input)
        if prompt_risk == "red" or "思考" in user_input or "反思" in user_input:
            thinking_level = "high"
        elif prompt_risk == "yellow":
            thinking_level = "medium"
        else:
            thinking_level = base_thinking
    else:
        thinking_level = base_thinking

    try:
        # Step 1: Get cached tool declarations (fast after first call)
        gemini_tools = await _get_gemini_tools()
        
        # Step 2: Create Gemini chat
        # NOTE: Gemini 3 docs strongly recommend temperature=1.0 (default).
        #       Lower values cause looping/degraded reasoning.
        # NOTE: thinking_level must be nested inside ThinkingConfig, not as a top-level kwarg.
        client = genai.Client(api_key=API_KEY)
        chat = client.aio.chats.create(
            model=selected_model,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                tools=gemini_tools,
                temperature=1.0,
                thinking_config=types.ThinkingConfig(thinking_level=thinking_level),
            )
        )
        
        yield sse("RUN_STARTED", {"status": f"Lynx 正在分析您的请求... (模型: {selected_model}, 推理: {thinking_level})"})
        
        # Step 3: Multi-turn execution loop (max 15 steps safety limit)
        max_steps = 15
        current_input = user_input
        for step in range(max_steps):
            response_stream = await chat.send_message_stream(current_input)
            tool_calls_batch = []
            
            async for chunk in response_stream:
                if chunk.function_calls:
                    tool_calls_batch.extend(chunk.function_calls)
                if chunk.text:
                    yield sse("TEXT_MESSAGE_CONTENT", {"delta": chunk.text})
            
            if not tool_calls_batch:
                yield sse("RUN_FINISHED", {"interaction_id": campaign_id})
                break
            
            # Handle Tool Calls — only spawn MCP subprocess here
            tool_responses = []
            for fc in tool_calls_batch:
                args_dict = type(fc).to_dict(fc).get("args", {}) if hasattr(fc, "to_dict") else fc.args
                if not isinstance(args_dict, dict):
                    args_dict = {}
                
                risk = args_dict.get("risk_level", "GREEN")
                yield sse("TOOL_CALL_START", {"name": fc.name, "args": args_dict, "risk_level": risk})
                
                # Call MCP tool
                result_text = await _call_mcp_tool(fc.name, args_dict)
                status = "success" if not result_text.startswith("Tool execution failed") else "failed"
                # Formulate a human-readable preview chunk
                preview_text = result_text[:1000]
                if len(result_text) > 1000:
                    preview_text += f"\n... [系统截断: 共 {len(result_text)} 字符]"
                
                try:
                    parsed = json.loads(result_text)
                    if isinstance(parsed, dict):
                        if "exit_code" in parsed:
                            c = parsed.get("exit_code")
                            ico = "✅" if c == 0 else "❌"
                            preview_text = f"{ico} 执行完成 (Exit Code: {c})\n"
                            if parsed.get("stdout"): preview_text += f"=== 标准输出 ===\n{parsed['stdout'][:600].strip()}\n"
                            if parsed.get("stderr"): preview_text += f"=== 标准错误 ===\n{parsed['stderr'][:400].strip()}\n"
                        elif "total_assets" in parsed:
                            preview_text = f"✅ 资产加载成功 (战区: {parsed.get('env', '未知')})\n共发现存活主机: {parsed.get('total_assets')} 台\n"
                            preview_text += f"(已将全景端口快照与指纹信息隐式投喂至 AI 记忆区，不在此处刷屏显示。)"
                        elif "result" in parsed and "total" in parsed:
                            preview_text = f"✅ 数据库探测完成 (共命中 {parsed.get('total')} 条记录)\n"
                            if isinstance(parsed.get("result"), list) and len(parsed.get("result")) > 0:
                                preview_text += f"首条样本:\n{json.dumps(parsed['result'][0], ensure_ascii=False, indent=2)[:300]}"
                except Exception:
                    pass
                
                yield sse("TOOL_CALL_RESULT", {"name": fc.name, "status": status, "preview": preview_text})
                
                tool_responses.append(types.Part.from_function_response(
                    name=fc.name, response={"result": result_text}
                ))
            
            current_input = tool_responses
            # Emit a renewed RUN_STARTED event to wake up the frontend "Lynx 正在思考..." pulse animation
            # signaling that the AI is now digesting the returned tool payload.
            yield sse("RUN_STARTED", {"status": "已获取底层反馈，Lynx 正在消化战术执行结果..."})
        else:
            # Loop limit reached — graceful degradation
            audit_log_write("LOOP_LIMIT", f"MCP ReAct loop reached {max_steps} steps for campaign {campaign_id}")
            yield sse("TEXT_MESSAGE_CONTENT", {"delta": f"\n\n[LYNX / 系统阻断] 推理深度触达硬上限 ({max_steps} 步)，已强行切断底层调用授权...\n\n"})
            
            # Force the model to summarize whatever it accumulated so far, explicitly overriding tools to an empty list
            try:
                yield sse("RUN_STARTED", {"status": "正在将现有情报坍缩并强制提取最终结论..."})
                final_stream = await chat.send_message_stream(
                    "⚠️ 系统高优先指令：你已达到允许的工具调用次数硬上限。立即停止一切设想，必须使用纯文本，根据本轮所有的工具返回结果，给出目前最贴近真相的直接回答。严禁返回工具调用。",
                    config=types.GenerateContentConfig(tools=[])
                )
                async for chunk in final_stream:
                    if chunk.text:
                        yield sse("TEXT_MESSAGE_CONTENT", {"delta": chunk.text})
            except Exception as loop_err:
                 yield sse("TEXT_MESSAGE_CONTENT", {"delta": f"(强制总结失败: {str(loop_err)})"})
                 
            yield sse("RUN_FINISHED", {"interaction_id": campaign_id})
                
    except Exception as e:
        yield sse("error", {"message": f"执行总线异常: {str(e)}"})
