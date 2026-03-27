import pytest
from fastapi.testclient import TestClient
from backend.main import app
import time

client = TestClient(app)

def test_pty_websocket_duplex():
    """Verify the WebSocket-to-Unix-PTY bidirectional communication stream."""
    with client.websocket_connect("/api/v1/terminal") as websocket:
        # 1. Send input payload via Xterm.js compatible format
        websocket.send_json({"type": "input", "data": "echo 'HACK_THE_PLANET'\r"})
        
        # 2. Wait and buffer the streaming stdout
        output_buffer = ""
        success = False
        
        # Read up to 10 frames looking for the payload execution echo
        for _ in range(10):
            try:
                data = websocket.receive_json()
                if data and data.get("type") == "output":
                    output_buffer += data["data"]
                    
                    # The PTY will echo the command typed, and then output the executed string.
                    if "HACK_THE_PLANET" in output_buffer:
                        success = True
                        break
            except Exception:
                pass
                
        assert success, f"STDOUT WebSocket stream did not return execution payload. Buffer received: {output_buffer}"
