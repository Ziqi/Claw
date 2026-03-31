# CLAW V9.3 — 电磁幽灵 (Electro-Phantom) 设计文档

**版本**：V3.1 (Sprint 1 已完成)
**日期**：2026-03-31
**状态**：Sprint 1 已交付
**核心定位**：CLAW = 态势感知指挥中枢，不是武器库。攻击执行交给 Kali 原生工具 + 人工操作。

---

## 架构哲学：做减法

> **CLAW 的价值不是自动化发动攻击，而是让指挥官在一块大屏上看清战场全貌，并由 AI 提供战术分析建议。**

### 三角分工

```
  Kali (武器库)           CLAW (指挥中枢)          Gemini CLI (前线参谋)
  ──────────              ──────────               ──────────
  aircrack-ng             雷达大屏                  终端内 AI 分析
  hashcat                 资产数据库                协助人工决策
  Wireshark               探针数据接收              辅助命令编写
  Kismet                  AI 分析建议
  nmap                    战报生成
  wifiphisher             态势可视化

  👨‍💻 人工执行攻击          📡 自动展示态势            🤖 AI 辅助思考
```

### 明确边界

| ✅ CLAW 该做的 | ❌ CLAW 不该做的 |
|---|---|
| 接收探针数据 (`/sensors/wifi/ingest`) | 自动化 Deauth 端点 |
| wifi_nodes 资产持久化 + 历史查询 | 自动化密码破解管线 |
| RSSI 信号强度可视化 | aircrack-ng/hashcat 进程管理 |
| AP 状态 Ghosting 动画 | Evil Twin 钓鱼代码 |
| 探针健康检测 | 武器 API 端点 |
| AI 分析战术建议 | AI 自动执行攻击命令 |
| 战报自动生成 | Docker 武器容器 |

### 部署架构

```
┌─────────────────────────────────┐
│  MacBook Air (指挥台)            │
│  ├── 浏览器 → CLAW Web UI       │
│  │    ├── 雷达大屏               │
│  │    ├── 资产列表               │
│  │    ├── AI 对话 (分析建议)     │
│  │    └── 战报查看               │
│  └── Antigravity (架构 AI)      │
└────────────┬────────────────────┘
             │ SSH / HTTP
             ▼
┌─────────────────────────────────┐
│  Kali VM (武器库 + 探针)         │
│  ├── ALFA 网卡 + 9dBi 天线      │
│  ├── 人工操作 aircrack-ng 套件   │
│  ├── Gemini CLI (AI 辅助思考)   │
│  ├── claw_wifi_sensor.py (探针)  │
│  │    └── POST → CLAW /ingest   │
│  └── (可选) Kismet + USB GPS    │
└─────────────────────────────────┘
```

---

## 第零章：V9.2 遗留项消化 ✅ 已完成

| # | 遗留项 | 状态 |
|---|---|---|
| R1 | `wifi_nodes` 建表收归 `db_engine.py` | ✅ 已完成 |
| R4 | `ALFA_CSV_PREFIX` 死变量清理 | ✅ 已完成 |
| — | wifi_nodes 扩展 9 个 V9.3 字段 | ✅ 已完成 |
| — | wifi_rssi_history 新表 | ✅ 已完成 |
| — | 旧数据库自动迁移逻辑 | ✅ 已完成 |

---

## 第一章：Sprint 1 — 态势感知增强 (2 天)

### 1.1 RSSI Sparkline 微型折线图

**目标**：RadioRadarPanel 的 PWR 列从静态数字改为 60 秒微型折线图

**实现**：
- 探针每次上报时，后端同时写入 `wifi_rssi_history` 表
- 前端新增 `/api/v1/sensors/wifi/rssi_history?bssid=XX` 端点
- 用 SVG 或 CSS 绘制内联微型折线（不引入重型图表库）

**用途**：走近 AP 时信号增强、远离时减弱 → 物理定位辅助

### 1.2 视觉残影 Ghosting

**目标**：探针停止上报后，AP 在大屏逐渐消隐

**实现**：
- `last_seen` 与当前时间差 > 10s → 半透明
- > 60s → 虚线框 + 灰色文字
- > 5min → 移入"历史区"折叠面板

**CSS 方案**：
```css
.ap-row[data-stale="mild"]   { opacity: 0.6; }
.ap-row[data-stale="fading"] { opacity: 0.3; border-style: dashed; }
.ap-row[data-stale="ghost"]  { display: none; /* 移入历史折叠 */ }
```

### 1.3 探针健康检测

**后端**：
```python
GET /api/v1/sensors/health
  Return: {
    "wifi_probe": {
      "status": "online" | "offline",
      "last_heartbeat": "2026-03-30T10:00:00Z",
      "nodes_reported": 12
    }
  }
```

**实现**：基于 `wifi_nodes` 表最新 `last_seen` 时间推算，无需探针额外上报。

**前端**：大屏左下角状态灯 🟢 在线 / 🔴 离线

---

## 第二章：Sprint 2 — 探针能力扩展 (1 天)

### 2.1 wifi_sensor 扩展上报字段

现有探针 `claw_wifi_sensor.py` 的 ingest 数据增加：

```python
# 新增上报字段（Kali 侧手动操作后由探针回传）
{
    "nodes": [...],          # 现有 AP 列表
    "probe_status": {
        "uptime": 3600,
        "monitor_interface": "wlan0mon",
        "channel_locked": null    # 或锁定的信道号
    }
}
```

### 2.2 后端 ingest 扩展

`/api/v1/sensors/wifi/ingest` 端点增加：
- 写入 `wifi_rssi_history` 表（Sparkline 数据源）
- 更新 `wifi_nodes.status` 字段（LIVE/OFFLINE）
- 接收可选的 `handshake_captured` 和 `cracked` 状态（人工标记后回传）

### 2.3 Kismet 探针（可选）

```python
# claw_kismet_sensor.py — 从 Kismet SQLite 数据库读取并回传
# Kismet 输出 kismetdb 格式，本质是 SQLite
# 定时读取 → POST 到 /api/v1/sensors/kismet/ingest
```

仅在 Kali 安装 Kismet + USB GPS 后启用。CLAW 侧只需一个数据接收端点。

---

## 第三章：Sprint 3 — AI 分析深化 (0.5 天)

### 3.1 Lynx 无线电分析模板

在 `agent.py` 的 SYSTEM_PROMPT 中增加分析能力（不是攻击能力）：

```
## 无线电态势分析能力
你可以通过 claw_query_db 查询 wifi_nodes 表，分析无线环境：
- 识别使用弱加密（WEP/OPEN）的高风险 AP
- 分析信号强度分布，判断 AP 物理位置
- 识别可疑的隐藏 SSID 或 MAC 地址欺骗
- 根据加密类型和客户端数量给出安全评估

注意：你只负责分析和建议，实际攻击操作由指挥官在 Kali 终端手动执行。
```

### 3.2 战报增强

`/api/v1/report/generate` 端点增加无线电资产章节：
- 发现的 AP 数量及加密类型分布
- 高风险 AP 列表（WEP/OPEN）
- 信号强度趋势

---

## 第四章：从 V9.3 设计中移除的功能

以下功能在 V3.0 版设计中**明确移除**，理由如下：

| 移除功能 | 原设计位置 | 移除状态 |
|---|---|---|
| `/weapons/wifi/deauth` | Sprint 1 | ✅ 已于 V9.3 The Final Purge 彻底移除 |
| `/weapons/wifi/capture/*` | Sprint 1 | ✅ 已于 V9.3 The Final Purge 彻底移除 |
| `/weapons/wifi/crack` | Sprint 2 | ✅ 已于 V9.3 The Final Purge 彻底移除 |
| L2→L3 自动升级桥 | Sprint 2 | ✅ 已于 V9.3 The Final Purge 彻底移除 |
| AI 自主编排攻击链 | Sprint 3 | ✅ (UI / API 触发点均已移除) |
| MCP 双模 target:kali | Sprint 3 | ✅ (不再提供双模能力) |
| Evil Twin 模块 | Sprint 4 | ✅ (锻造端点 `agent/forge` 等彻底清除) |
| `claw_write_loot_file` | Sprint 2 | ✅ (相关文件与后台调度 `ops/run` 清除) |

**正确的攻击流程**：
```
指挥官看 CLAW 雷达 → 发现目标 AP
    ↓
SSH 进 Kali → 或在 Kali 终端用 Gemini CLI
    ↓
人工执行 aireplay-ng / aircrack-ng
    ↓
结果通过探针自动回传到 CLAW 大屏展示
```

---

## 第五章：数据库 Schema (已完成)

### wifi_nodes 表 (15 字段)

```sql
bssid, essid, power, channel, encryption, last_seen, first_seen,
status, password, cracked_at, channel_locked, capture_file,
handshake_captured, clients_count, manufacturer
```

> `password`、`cracked_at`、`handshake_captured` 等字段由探针回传人工操作结果，不由 CLAW 自动填写。

### wifi_rssi_history 表 (4 字段)

```sql
id, bssid, signal_strength, recorded_at
```

---

## 第六章：硬件建议

| 项目 | 建议 | 预算 |
|---|---|---|
| **Kali 环境** | 继续用 VM，不买专用电脑（VM 是业界标准） | ¥0 |
| **9dBi 全向天线** | 建议购买，覆盖翻 3-5 倍 | ¥30-50 |
| **USB GPS** | 可选，用于 Kismet Wardriving 地图 | ¥30 |
| **专用电脑** | ❌ 不建议，VM + 快照是最佳方案 | — |

---

## 第七章：里程碑

| Sprint | 内容 | 工时 | 需要 Kali？ |
|---|---|---|---|
| Sprint 0 | V9.2 清理 + Schema 扩展 | ✅ 已完成 | 否 |
| Sprint 1 | Sparkline + Ghosting + 探针状态灯 | ✅ 已完成 (2026-03-31) | 否 |
| Sprint 2 | 探针扩展 + ingest 增强 | ✅ 已完成 (2026-03-31) | 测试时需要 |
| Sprint 3 | AI 分析模板 + 战报增强 | ✅ 已完成 (2026-03-31) | 否 |
| **总计** | | **~3.5 天** | |

> 对比 V2.0 版的 11 天工作量，做减法后缩减至 **3.5 天**。方向更聚焦，产出更清晰。
