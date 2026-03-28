## [V9.2 - D1 Code Review Refactoring] - 2026-03-28
### Added / Fixed
- **AI Core (agent_mcp.py)**: Fixed P0 Schema Crash. Added `OBJECT` support and explicit internal constraints for `ARRAY` to avoid Gemini 400 Bad Request during MCP initialization.
- **AI Core (agent_mcp.py)**: Fixed P0 Cognitive Blackhole. `thinking_level="high"` is now suppressed for non-affirming statements (e.g. "不需要思考"), and dynamically downgraded to `"low"` while digesting JSON tool callbacks inside the ReAct loop.
- **AI Core (agent_mcp.py)**: Fixed P0 Frontend Deadlock. 15-step safety limits now strictly follow Gemini turn protocols via explicit empty configuration (`FunctionCallingConfig(mode="NONE")`). Assured `RUN_FINISHED` SSE trigger in a `finally` safety net to unlock frontend UI.

## [V9.2 - D2 Code Review Refactoring] - 2026-03-28
### Added / Fixed
- **Armory Scripts (`05-cracker.sh`)**: Removed the dangerous `|| true` hashcat wrap. Exit codes are now strictly caught to prevent green-lighting an OOM or hardware crash. Outputs structured JSON warnings (`{"level":"FATAL"...}`) to standard error for seamless LLM parsing.
- **Armory Scripts (`05-cracker.sh`)**: Introduced `$TIMEOUT_CMD -k 5m 60m` to prevent hashcat/metal deadlocks from permanently zombifying the Agent's ReAct pipeline. Handles both Linux `timeout` and macOS `gtimeout`.
- **Armory Scripts (`05-cracker.sh`)**: Extracted hash mode and attack mode hardcoding. Introduced pre-processing pipeline for `.pcapng` target files via `hcxpcapngtool` to convert EAPOL captures to `hc22000` payload. Added support for `$HASH_MODE` (22000) and `$ATTACK_MODE` parsing.
- **Armory Controller (`Makefile`)**: Added new stub targets `wifi-mon` and `wifi-deauth` to support the incoming physical Alfa antennas on the V9.2 roadmap. Emits JSON error dumps if the Aircrack-ng suite isn't found.
