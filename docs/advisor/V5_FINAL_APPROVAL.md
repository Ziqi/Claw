# 导师终极批示 — V5.0 全盘核准 + V6/V7 战略定调

**日期：** 2026-03-25  
**来源：** 导师  
**状态：** ✅ V5.0 正式立项

---

## V5.0 批示结果

| 议题 | 导师裁决 |
|---|---|
| SQLite + JSON 双写 | ✅ 全盘批准 ("价值百万的架构经验") |
| Phase 顺序: AI 先于 Webhook | ✅ 完全批准 |
| Gemini 3 Flash via curl | ✅ 批准，但必须加脱敏层 + 用 jq 构建 JSON |
| 四张表 Schema | ✅ scans / assets / ports / vulns + scan_id |

## V6/V7 战略定调

| 方向 | 导师裁决 |
|---|---|
| Proxychains | ❌ 废弃。改用 Ligolo-ng 或 Chisel (TUN 接口) |
| C2 框架 | Sliver (开源, Go, mTLS)，抛弃 Cobalt Strike |
| BloodHound | 方案 C: 不装 Neo4j，直接用 Gemini 1M 上下文做图论推理 |

## 导师指定的 SQLite Schema

```sql
CREATE TABLE scans (scan_id TEXT PRIMARY KEY, timestamp DATETIME, mode TEXT);
CREATE TABLE assets (ip TEXT, mac TEXT, os TEXT, scan_id TEXT);
CREATE TABLE ports (ip TEXT, port INTEGER, protocol TEXT, service TEXT, scan_id TEXT);
CREATE TABLE vulns (ip TEXT, type TEXT, details TEXT, scan_id TEXT);
```

Diff 引擎核心查询:
```sql
SELECT port FROM ports WHERE scan_id='CURRENT'
EXCEPT
SELECT port FROM ports WHERE scan_id='PREVIOUS';
```

## 工程助手补充意见

- AI 分析模块建议用 Python 脚本 (`16-ai-analyze.py`)，非纯 Bash
- Python `json.dumps()` + 正则脱敏比 Bash sed 拼 JSON 安全可靠
- TUI 保持 Bash，AI 调用走 Python

---

*V5.0 Phase 1 (SQLite 数据层) 正式破冰。*
