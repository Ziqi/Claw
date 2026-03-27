import asyncio
from google.adk.agents import Agent
from google.adk.tools.mcp_tool import McpToolset
from google.adk.tools.mcp_tool.mcp_session_manager import StdioConnectionParams
from mcp import StdioServerParameters
from google.adk.agents.invocation_context import InvocationContext

async def main():
    print("[*] Initializing MCP Toolset...")
    toolbox_tools = McpToolset(connection_params=StdioConnectionParams(
        server_params=StdioServerParameters(
            command="python3", args=["/Users/xiaoziqi/CatTeam/backend/mcp_armory_server.py"],
            env={}),
        timeout=30))

    print("[*] Initializing Lynx Agent...")
    lynx_agent = Agent(
        model="gemini-3-flash-preview",
        name="lynx_commander",
        instruction="You are CLAW Agent Lynx. Help the user. Read the assets.",
        tools=[toolbox_tools],
    )
    
    print("[*] Running Agent...")
    try:
        context = InvocationContext(session_id="test", user_input="List the currently discovered assets in the default environment.")
        async for event in lynx_agent.run_live(parent_context=context):
            print(event)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
