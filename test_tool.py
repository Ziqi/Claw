from google.genai import types
tc = types.ToolConfig()
print("Props containing 'server_side':", [d for d in dir(tc) if "server" in d.lower()])
