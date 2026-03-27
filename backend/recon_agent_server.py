#!/usr/bin/env python3
"""
🔍 A2A Recon Sub-Agent (V8.2 Sprint 4)

Provides specialized reconnaissance capabilities, exposed via A2A Protocol.
Listens on port 8001.
"""
from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="Recon Agent A2A Node")

# A2A Discovery card
AGENT_CARD = {
    "name": "recon_agent",
    "description": "专业负责执行初步侦察、端口扫描分析与资产梳理。",
    "skills": [
        {"id": "port_analysis", "name": "端口梳理", "description": "分析大批量未知端口极其对应的潜在威胁。"},
        {"id": "recon_strategy", "name": "侦察策略", "description": "为特定网段制定侦察顺序和探测包类型。"}
    ],
    "url": "http://localhost:8001",
    "version": "1.0.0"
}

@app.get("/.well-known/agent-card.json")
def get_agent_card():
    return AGENT_CARD

class A2AMessage(BaseModel):
    task: str

@app.post("/a2a/chat")
def a2a_chat(msg: A2AMessage):
    # In a real integration, this uses its own LLM. Here we simulate the Recon Agent's expert analysis.
    task = msg.task
    return {
        "status": "success",
        "agent": "recon_agent",
        "reply": f"[ReconAgent 专家报告]\n接收到任务: {task}\n经过专家的纵深端口特征解析，发现以下重点侦察视角: \n1. 目标暴露面过大，建议立即使用 make fast 进行存活探测。\n2. 若存在 445 端口，强烈建议标记为高价值横向信道。\n(A2A 跨智能体协同已完成)"
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
