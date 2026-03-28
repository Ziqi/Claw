import asyncio
import time
import httpx
import sys

API_URL = "http://127.0.0.1:8000/api/v1"

async def read_sse(job_id):
    """Simulates a heavy SSE logger reading the ops_log pipeline"""
    print(f"    [SSE Client] Connecting to log stream for {job_id}...")
    try:
        async with httpx.AsyncClient() as client:
            async with client.stream("GET", f"{API_URL}/ops/log/{job_id}", timeout=20.0) as response:
                async for chunk in response.aiter_text():
                    # We just continually parse the stream payload
                    pass
    except Exception as e:
        pass
    print("    [SSE Client] Disconnected naturally.")

async def hammer_assets():
    """Hits the /assets database via Uvicorn 100 times concurrently."""
    await asyncio.sleep(1) # Wait for SSE to fully engage the event loop
    print("    [Attacker] Initiating 100 concurrent requests to /api/v1/assets...")
    t0 = time.time()
    
    async with httpx.AsyncClient() as client:
        reqs = [client.get(f"{API_URL}/assets?size=1") for _ in range(100)]
        results = await asyncio.gather(*reqs, return_exceptions=True)
    
    total_time = time.time() - t0
    success = sum(1 for r in results if not isinstance(r, Exception) and r.status_code == 200)
    print(f"    [Attacker] Complete! {success}/100 succeeded in {total_time:.3f} seconds.")
    
    if total_time > 4.0:
        print("    [!] FAILED: Event loop starvation detected. `ops_log` is blocking async IO.")
        sys.exit(1)
    else:
        print(f"    [✓] SUCCESS: Event loop is free! Max latency ~{total_time/100*1000:.2f}ms per req.")

async def main():
    print("\n[+] Testing FastAPI Uvicorn Event Loop Starvation with concurrent SSE and DB calls")
    # 1. Trigger a heavy background task lasting 10 seconds
    async with httpx.AsyncClient() as client:
        res = await client.post(f"{API_URL}/ops/run", json={"command": "ping -c 8 127.0.0.1"})
        job_id = res.json().get("job_id")
    
    if not job_id:
        print("Failed to dispatch ops task")
        return
        
    print(f"    [Setup] Triggered background OP task {job_id} (ping for 8 seconds)")
        
    # 2. Concurrently read the SSE and hammer the assets
    await asyncio.gather(
        read_sse(job_id),
        hammer_assets()
    )

if __name__ == "__main__":
    asyncio.run(main())
