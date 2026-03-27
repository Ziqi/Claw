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


async def _call_mcp_tool(tool_name: str, args: dict) -> str:
    """Spawn a short-lived MCP session ONLY when a tool needs to be called."""
    server_params = StdioServerParameters(
        command="python3",
        args=[os.path.join(BASE_DIR, "backend", "mcp_armory_server.py")]
    )
    try:
        async with stdio_client(server_params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                result = await session.call_tool(tool_name, arguments=args)
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
                yield sse("TOOL_CALL_RESULT", {"name": fc.name, "status": status, "preview": result_text[:200]})
                
                tool_responses.append(types.Part.from_function_response(
                    name=fc.name, response={"result": result_text}
                ))
            
            current_input = tool_responses
        else:
            # Loop limit reached — graceful degradation
            audit_log_write("LOOP_LIMIT", f"MCP ReAct loop reached {max_steps} steps for campaign {campaign_id}")
            yield sse("TEXT_MESSAGE_CONTENT", {"delta": f"\n\n[LYNX] 本轮推理已执行 {max_steps} 步工具调用，已自动暂停。您可以继续追问。"})
            yield sse("RUN_FINISHED", {"interaction_id": campaign_id})
                
    except Exception as e:
        yield sse("error", {"message": f"执行总线异常: {str(e)}"})
