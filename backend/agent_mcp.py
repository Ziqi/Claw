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
            _cached_gemini_tools = [
                types.Tool(function_declarations=fn_decls),
                types.Tool(code_execution=types.ToolCodeExecution())
            ]
    
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


async def react_loop_stream(user_input: str, campaign_id: str = "default", model_key: str = "flash", theater: str = "default", agent_mode: bool = True, sudo_pass: str = None) -> AsyncGenerator[str, None]:
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
        "lite":  ("gemini-3.1-flash-lite-preview", "minimal"),
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
        base_tools = await _get_gemini_tools()
        
        # Step 2: Create Gemini chat
        if not agent_mode:
            allowed_names = {"claw_list_assets", "claw_query_db", "claw_read_file"}
            filtered_decls = []
            for t in base_tools:
                if t.function_declarations:
                    for fd in t.function_declarations:
                        if fd.name in allowed_names:
                            filtered_decls.append(fd)
            gemini_tools = [types.Tool(function_declarations=filtered_decls)]
            include_server_tools = False
        else:
            # When agent mode is enabled, we append native Google Search for live Web capability and Code Execution!
            # Combining built-in tools with custom tools is supported natively in gemini-3.1!
            gemini_tools = base_tools.copy() if isinstance(base_tools, list) else list(base_tools)
            gemini_tools.append(types.Tool(google_search=types.GoogleSearch()))
            include_server_tools = True

        tool_config_obj = types.ToolConfig(
            function_calling_config=types.FunctionCallingConfig(mode="AUTO"),
            include_server_side_tool_invocations=include_server_tools
        )
            
        dynamic_prompt = SYSTEM_PROMPT + f"\n\n[SYSTEM NOTIFICATION]\nThe Commander is currently active in Operation Theater '{theater}'. " \
                                         f"All tools that accept an 'env' parameter MUST explicitly specify '{theater}' as the environment unless instructed otherwise.\n"

        # Step 1.5: Load Chat History from SQLite
        conn = sqlite3.connect(DB_PATH)
        conn.execute("CREATE TABLE IF NOT EXISTS mcp_messages (campaign_id TEXT, role TEXT, content TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)")
        cursor = conn.execute("SELECT role, content FROM mcp_messages WHERE campaign_id=? ORDER BY timestamp ASC", (campaign_id,))
        rows = cursor.fetchall()
        
        chat_history = []
        for r_role, r_json in rows:
            try:
                # Basic deserialization of stored text/parts into type.Content
                parts_data = json.loads(r_json)
                parts = []
                for p in parts_data:
                     if "text" in p: parts.append(types.Part.from_text(p["text"]))
                     elif "function_call" in p: parts.append(types.Part.from_function_call(name=p["function_call"]["name"], args=p["function_call"]["args"]))
                     elif "function_response" in p: parts.append(types.Part.from_function_response(name=p["function_response"]["name"], response=p["function_response"]["response"]))
                if parts:
                     chat_history.append(types.Content(role=r_role, parts=parts))
            except Exception as e:
                pass
        conn.close()

        client = genai.Client(api_key=API_KEY)
        chat = client.aio.chats.create(
            model=selected_model,
            history=chat_history,
            config=types.GenerateContentConfig(
                system_instruction=dynamic_prompt,
                tools=gemini_tools,
                temperature=1.0,
                thinking_config=types.ThinkingConfig(thinking_level=thinking_level),
                tool_config=tool_config_obj
            )
        )
        
        yield sse("RUN_STARTED", {"status": f"Lynx 正在分析您的请求... (模型: {selected_model}, 推理: {thinking_level})"})
        
        # Step 3: Multi-turn execution loop (max 15 steps safety limit)
        max_steps = 15
        current_input = user_input
        for step in range(max_steps):
            tool_calls_batch = []
            
            # --- Exponential Backoff Retry Block for 503/429 ---
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    response_stream = await chat.send_message_stream(current_input)
                    
                    async for chunk in response_stream:
                        if chunk.function_calls:
                            tool_calls_batch.extend(chunk.function_calls)
                        
                        # Yield text and cloud sandbox execution chunks
                        parts = chunk.parts if hasattr(chunk, "parts") and chunk.parts else []
                        for p in parts:
                            if hasattr(p, "text") and p.text:
                                yield sse("TEXT_MESSAGE_CONTENT", {"delta": p.text})
                            elif hasattr(p, "executable_code") and p.executable_code:
                                code = getattr(p.executable_code, "code", "")
                                yield sse("TEXT_MESSAGE_CONTENT", {"delta": f"\n\n```python\n# [AI Cloud Sandbox] Executing native python payload:\n{code}\n```\n"})
                            elif hasattr(p, "code_execution_result") and p.code_execution_result:
                                out = getattr(p.code_execution_result, "output", "")
                                yield sse("TEXT_MESSAGE_CONTENT", {"delta": f"\n\n```text\n# [Sandbox Output]:\n{out}\n```\n"})
                    break  # Success, exit retry loop
                    
                except Exception as api_err:
                    err_str = str(api_err)
                    if ("503" in err_str or "Unavailable" in err_str or "429" in err_str or "exhausted" in err_str or "temporary" in err_str.lower()) and attempt < max_retries - 1:
                        wait_sec = (attempt + 1) * 3
                        yield sse("TEXT_MESSAGE_CONTENT", {"delta": f"\n\n[LYNX / 通信阻塞] 谷歌原生节点队列涌塞 (API 503/429)... 正在进行第 {attempt+1}/{max_retries} 次网络退避，等待 {wait_sec} 秒后自动重试...\n\n"})
                        import asyncio
                        await asyncio.sleep(wait_sec)
                    else:
                        raise api_err  # Bubble up if max retries exceeded or unknown error
            # --- End Retry Block ---
            
            
            if not tool_calls_batch:
                break
            
            # Handle Tool Calls — only spawn MCP subprocess here
            tool_responses = []
            for fc in tool_calls_batch:
                args_dict = type(fc).to_dict(fc).get("args", {}) if hasattr(fc, "to_dict") else fc.args
                if not isinstance(args_dict, dict):
                    args_dict = {}
                
                risk = args_dict.get("risk_level", "GREEN")
                yield sse("TOOL_CALL_START", {"name": fc.name, "args": args_dict, "risk_level": risk})
                
                # Sudo Pipeline Injection
                if sudo_pass and fc.name == "claw_execute_shell":
                    cmd_val = args_dict.get("command", "")
                    if "sudo " in cmd_val:
                        args_dict["command"] = f"echo '{sudo_pass}' | sudo -S " + cmd_val.replace("sudo ", "", 1)
                elif sudo_pass and fc.name == "claw_run_module":
                    cmd_val = args_dict.get("module_cmd", "")
                    if "sudo " in cmd_val:
                        args_dict["module_cmd"] = f"echo '{sudo_pass}' | sudo -S " + cmd_val.replace("sudo ", "", 1)

                # Call MCP tool
                result_text = await _call_mcp_tool(fc.name, args_dict)
                status = "success" if not result_text.startswith("Tool execution failed") else "failed"
                # Formulate a human-readable preview chunk
                preview_text = result_text[:1000]
                if len(result_text) > 1000:
                    preview_text += f"\n... [系统截断: 共 {len(result_text)} 字符]"
                
                result_part = types.Part.from_function_response(name=fc.name, response={"result": result_text})
                extra_parts = []

                try:
                    parsed = json.loads(result_text)
                    if isinstance(parsed, dict):
                        if "__a2ui_b64__" in parsed:
                            import base64
                            b64 = parsed.pop("__a2ui_b64__")
                            preview_text = f"📸 A2UI 视觉捕捉完成 (渲染引擎: Playwright, 注入 {len(b64)} 字节多模态影像阵列)\n"
                            result_text = json.dumps(parsed, ensure_ascii=False)
                            result_part = types.Part.from_function_response(name=fc.name, response={"result": result_text})
                            extra_parts.append(types.Part.from_bytes(data=base64.b64decode(b64), mime_type="image/png"))
                        elif "exit_code" in parsed:
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
                
                tool_responses.append(result_part)
                tool_responses.extend(extra_parts)
            
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
                    "⚠️ 系统高优先指令：你已达到允许的工具调用次数硬上限。立即停止一切设想，必须使用纯文本，根据本轮所有的工具返回结果，给出目前最贴近真相的直接回答。严禁返回工具调用。"
                )
                async for chunk in final_stream:
                    if chunk.text:
                        yield sse("TEXT_MESSAGE_CONTENT", {"delta": chunk.text})
            except Exception as loop_err:
                 yield sse("TEXT_MESSAGE_CONTENT", {"delta": f"(强制总结失败: {str(loop_err)})"})

        # Step 4: Persist Chat History Delta to SQLite before exiting the interaction
        try:
            conn = sqlite3.connect(DB_PATH)
            # Only save the new additions to avoid duplicating history
            new_turns = chat._history[len(chat_history):] if chat._history else []
            for item in new_turns:
                parts_repr = []
                for p in item.parts:
                    if p.text:
                        parts_repr.append({"text": p.text})
                    elif p.function_call:
                        # Extract the inner dictionary mapping from the FunctionCall object
                        args_dict = {}
                        if hasattr(p.function_call.args, "items"):
                            args_dict = dict(p.function_call.args.items())
                        elif hasattr(p.function_call, "to_dict"):
                            args_dict = p.function_call.to_dict().get("args", {})
                        parts_repr.append({"function_call": {"name": p.function_call.name, "args": args_dict}})
                    elif p.function_response:
                        resp_dict = {}
                        if hasattr(p.function_response.response, "items"):
                            resp_dict = dict(p.function_response.response.items())
                        elif hasattr(p.function_response, "to_dict"):
                            resp_dict = p.function_response.to_dict().get("response", {})
                        parts_repr.append({"function_response": {"name": p.function_response.name, "response": resp_dict}})
                
                if parts_repr:
                    conn.execute(
                        "INSERT INTO mcp_messages (campaign_id, role, content) VALUES (?, ?, ?)",
                        (campaign_id, item.role, json.dumps(parts_repr, ensure_ascii=False))
                    )
            conn.commit()
            conn.close()
        except Exception as e:
            audit_log_write("DB_ERROR_MCP", f"Failed to persist chat history: {e}")

        yield sse("RUN_FINISHED", {"interaction_id": campaign_id})
                
    except Exception as e:
        yield sse("error", {"message": f"执行总线异常: {str(e)}"})
