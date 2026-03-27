import asyncio
from mcp.client.stdio import stdio_client
from mcp.client.session import ClientSession
from mcp import StdioServerParameters

async def main():
    print("[*] Starting MCP client...")
    server_params = StdioServerParameters(command="python3", args=["/Users/xiaoziqi/CatTeam/backend/mcp_armory_server.py"])
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            print("[*] Initialized session! Fetching tools...")
            tools = await session.list_tools()
            for t in tools.tools:
                print(f"Tool: {t.name} - {t.description}")

if __name__ == "__main__":
    asyncio.run(main())
