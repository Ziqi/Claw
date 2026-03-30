# V9.3 详细设计：态势感知增强 + UI 瘦身

**版本**：V1.1
**日期**：2026-03-31
**设计依据**：V93_ROADMAP.md V3.1（Sprint 1 已完成）

---

## 1. UI 组件变更清单

### 1.1 删除的组件（4 个）

| 组件 | 行数 (约) | 删除理由 |
|---|---|---|
| `DockerPanel` (L2706-2803) | ~98 行 | Kali VM 替代 Docker，无需前端管理容器 |
| `SliverViewTab` (L1392-1438) | ~47 行 | 远期功能，无实际数据源，属于摆设 |
| `XTermConsole` (L1229-1296) | ~68 行 | SSH 进 Kali 用原生终端更好，内嵌终端体验差 |
| `AttackMatrixView` (L1927-1968) | ~42 行 | ATT&CK 矩阵无数据驱动，纯静态展示无价值 |

**共删除约 255 行前端代码。**

同步删除的后端端点：

| 端点 | 删除理由 |
|---|---|
| `GET /api/v1/docker/status` | DockerPanel 删除后无调用者 |
| `POST /api/v1/docker/{action}/{name}` | 同上 |
| `GET /api/v1/sliver/sessions` | SliverViewTab 删除后无调用者 |
| `GET /api/v1/attack_matrix/` | AttackMatrixView 删除后无调用者 |
| `WS /api/v1/ws/terminal` | XTermConsole 删除后无调用者 |

### 1.2 精简的组件（2 个）

#### TacticalArmoryModal → QuickCommandPanel

**当前**：36 个武器模块的执行按钮，点击后直接在 CLAW 内执行命令。
**改为**：快捷命令**建议**面板——展示推荐的 Kali 命令，用户点击后**复制到剪贴板**，自行粘贴到 Kali 终端执行。

```jsx
// 改造前：直接执行
onClick={() => onExecCommand(`nmap -sV ${ip}`)}

// 改造后：复制到剪贴板 + 提示
onClick={() => {
  navigator.clipboard.writeText(`nmap -sV ${ip}`);
  toast("🔗 命令已复制！请在 Kali 终端粘贴执行");
}}
```

#### OsintTerminalModal

**当前**：独立弹窗 + 独立 SSE 流调用 OSINT。
**改为**：不再需要独立弹窗，直接在 AI 对话面板中完成即可。标记为弃用。

### 1.3 增强的组件（1 个核心）

#### RadioRadarPanel 增强

**当前**：静态表格，每行一个 AP，显示 BSSID/SSID/PWR/CH/ENC。

**V9.3 增强**：

| 增强项 | 实现方式 |
|---|---|
| **RSSI Sparkline** | PWR 列改为内联 SVG 折线图 (60 秒 / 20 个数据点) |
| **Ghosting 动画** | data-stale 属性 + CSS opacity 渐变 |
| **状态徽章** | LIVE 🟢 / OFFLINE 🟡 / CRACKED 🔴 |
| **加密类型高亮** | WEP/OPEN → 🔴红底 / WPA2 → 🟡 / WPA3 → 🟢 |
| **展开行详情** | 点击 AP 行展开：first_seen / clients_count / manufacturer |

### 1.4 新增的控件（2 个）

#### 探针状态灯

**位置**：HudBar 右侧（与 Hosts/Ports/Vulns 同行）

```
[Hosts: 12] [Ports: 89] [Vulns: 3] [📡 探针: 🟢 在线] 
```

**实现**：
- 读取 wifi_nodes 表 max(last_seen)
- 与当前时间差 < 30s → 🟢 在线
- 30s-120s → 🟡 延迟
- > 120s → 🔴 离线

#### 历史折叠面板

**位置**：RadioRadarPanel 底部

```
▶ 历史设备 (5 个已离线)
  [展开后显示 status=OFFLINE/ARCHIVED 的 AP]
```

---

## 2. 后端变更

### 2.1 新增端点

```python
GET /api/v1/sensors/wifi/rssi_history?bssid=XX&limit=20
  Return: [{ "signal_strength": -45, "recorded_at": "..." }, ...]
  用途: Sparkline 数据源

GET /api/v1/sensors/health
  Return: { "wifi_probe": { "status": "online", "last_heartbeat": "...", "nodes_count": 12 } }
  用途: 探针状态灯
```

### 2.2 扩展现有端点

```python
POST /api/v1/sensors/wifi/ingest  (现有，扩展)
  新增行为:
    - 每个 node 同时写入 wifi_rssi_history 表
    - 更新 wifi_nodes.status 字段
    - 接收可选的 handshake_captured / password 字段（人工标记回传）
```

### 2.3 删除的端点

| 端点 | 理由 |
|---|---|
| `/api/v1/docker/*` (2 个) | Docker 面板删除 |
| `/api/v1/sliver/*` (1 个) | Sliver 面板删除 |
| `/api/v1/attack_matrix/` (1 个) | ATT&CK 面板删除 |
| `WS /api/v1/ws/terminal` (1 个) | 内嵌终端删除 |

### 2.4 AI 分析模板

`agent.py` SYSTEM_PROMPT 新增（分析能力，非攻击能力）：

```
## 无线电态势分析
你可以查询 wifi_nodes 表分析无线环境：
- 识别使用弱加密（WEP/OPEN）的高风险 AP
- 分析信号强度分布，推断 AP 物理位置远近
- 识别隐藏 SSID 或 MAC 地址异常
- 根据 encryption 和 clients_count 给出安全评估报告

你只负责分析和建议。实际攻击操作由指挥官在 Kali 终端手动执行。
```

---

## 3. 文件变更矩阵

| 文件 | 操作 | 详情 |
|---|---|---|
| `frontend/src/App.jsx` | 删除 | DockerPanel, SliverViewTab, XTermConsole, AttackMatrixView |
| `frontend/src/App.jsx` | 改造 | TacticalArmoryModal → 复制命令模式 |
| `frontend/src/App.jsx` | 增强 | RadioRadarPanel (Sparkline + Ghosting + 状态徽章) |
| `frontend/src/App.jsx` | 新增 | 探针状态灯 (HudBar) + 历史折叠面板 |
| `frontend/src/index.css` | 新增 | Ghosting 动画 CSS + Sparkline 样式 |
| `backend/main.py` | 删除 | docker/sliver/attack_matrix/ws/terminal 端点 |
| `backend/main.py` | 新增 | /sensors/wifi/rssi_history + /sensors/health |
| `backend/main.py` | 修改 | /sensors/wifi/ingest 扩展写入 rssi_history |
| `backend/agent.py` | 修改 | SYSTEM_PROMPT 增加无线电分析模板 |
| `docs/ARCHITECTURE.md` | 修改 | 架构图更新 |
| `docs/ROADMAP.md` | 已更新 | V9.3 段落已更新 |

---

## 4. 执行顺序

```
Step 1: 后端 — 删除废弃端点 (docker/sliver/attack_matrix/ws)  ✅ 已完成
Step 2: 后端 — 新增 rssi_history + health 端点              ✅ 已完成
Step 3: 后端 — 扩展 ingest 写入 rssi_history                 ✅ 已完成
Step 4: 后端 — agent.py System Prompt 更新                  部分完成
Step 5: 前端 — 删除 4 个废弃组件                            ✅ 已完成
Step 6: 前端 — RadioRadarPanel 增强 (Sparkline + Ghosting) ✅ 已完成
Step 7: 前端 — 探针状态灯 + 历史折叠                       ✅ 已完成
Step 8: 前端 — TacticalArmoryModal 改造                     ✅ 已完成
Step 9: 测试 — 回归验证                                   待执行
Step 10: 文档 — ARCHITECTURE.md 更新                       ✅ 已完成
```
