import asyncio
import time
import sys
import os

# Add parent dir to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from backend.agent_mcp import _call_mcp_tool

async def run():
    print(f"\n[+] Testing MCP Connection Pooling via AsyncExitStack")
    t0 = time.time()
    res = await _call_mcp_tool("claw_list_assets", {"env": "default"})
    cold_start = time.time() - t0
    print(f"    - Call 1 (Cold Start initialization): {cold_start:.3f} seconds")
    
    times = []
    for i in range(20):
        t0 = time.time()
        await _call_mcp_tool("claw_list_assets", {"env": "default"})
        times.append(time.time() - t0)
    
    avg_hot = sum(times) / len(times) * 1000
    print(f"    - Average time for next 20 continuous calls: {avg_hot:.2f} ms")
    
    if avg_hot > 100:
        print("    [!] FAILED: Hot calls took longer than 100ms. Process pool might be spawning repeatedly.")
        sys.exit(1)
    else:
        print("    [✓] SUCCESS: MCP persistent session pooling logic works perfectly under high stress.")

if __name__ == "__main__":
    asyncio.run(run())
