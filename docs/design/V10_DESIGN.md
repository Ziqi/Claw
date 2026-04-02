# CLAW V10.0 — Protocol Anatomy Engine 设计文档

**版本**：V1.0
**日期**：2026-04-02
**状态**：规划中
**代号**：Protocol Anatomy (协议解剖)

---

## 一、系统定位

### 1.1 一句话定位

> **CLAW V10.0 = AI 增强的多域态势感知研究平台**
> 能看见协议层的异常，能理解攻击的本质，能输出防御的方案。

### 1.2 定位演进

```
V9.3:  态势感知指挥中枢 — "看得见战场" (WiFi + IP 资产)
V10.0: 协议级态势感知引擎 — "看得懂协议" (WiFi + IP + 协议异常 + 行为基线)
```

### 1.3 核心原则（继承 V9.3 "做减法"哲学）

| ✅ CLAW 该做的 | ❌ CLAW 不该做的 |
|---|---|
| 接收多源探针数据 | 实时流量匹配（那是 Suricata 的事） |
| 告警可视化 + AI 研判 | 自动阻断/联动交换机 |
| 生成 IDS 规则建议 | 内嵌完整 IDS 引擎 |
| 输出学术报告和防御方案 | 自动化发动攻击 |
| 自研轻量 Scapy 探针 (研究原型) | 替代 Zeek/Suricata |

### 1.4 三角分工（升级版）

```
  Kali VM (武器库 + 探针集群)        CLAW (指挥中枢 / Mac)           Gemini (AI 参谋)
  ─────────────────────              ─────────────────────           ─────────────────
  aircrack-ng / hashcat              Bloomberg HUD 大屏               辅助协议异常分析
  nmap / nuclei / hydra              WiFi 态势雷达                    生成 Suricata 规则
  claw_wifi_sensor.py                协议告警面板 (V10.0 新增)        关联多域告警
  claw_llmnr_probe.py (新增)         资产数据库 (SQLite)              输出防御建议
  claw_arp_probe.py (新增)           战报自动生成                     辅助学术报告
  
  [人工执行攻击]                     [自动展示 + AI 分析]             [AI 辅助决策]
  [探针被动检测]
```

---

## 二、架构设计

### 2.1 数据流全景

```
                    ┌─── WiFi 探针 (claw_wifi_sensor.py)
                    │       └→ POST /sensors/wifi/ingest
                    │
  Kali VM ──────────┼─── LLMNR 探针 (claw_llmnr_probe.py)
  (探针集群)        │       └→ POST /alerts/ingest
                    │
                    ├─── ARP 探针 (claw_arp_probe.py)
                    │       └→ POST /alerts/ingest
                    │
                    └─── 暴力破解探针 (claw_bruteforce_probe.py)
                            └→ POST /alerts/ingest
                                    │
                                    ▼
              ┌──────────────────────────────────────┐
              │  CLAW Backend (FastAPI)                │
              │                                        │
              │  ├── wifi_nodes 表 (WiFi 态势)         │
              │  ├── protocol_alerts 表 (协议告警)     │
              │  ├── assets/ports/vulns 表 (IP 资产)   │
              │  │                                     │
              │  ├── /alerts/list   → 告警面板数据源   │
              │  ├── /alerts/stats  → HUD 告警计数     │
              │  └── /report/generate → 含协议章节     │
              └────────────┬─────────────────────────┘
                           │
                           ▼
              ┌──────────────────────────────────────┐
              │  CLAW Frontend (React)                 │
              │                                        │
              │  ├── HUD: Hosts | Ports | Vulns |     │
              │  │        Alerts ← (V10.0 新增)       │
              │  ├── WiFi 雷达面板 (已有)              │
              │  ├── 协议告警面板 (V10.0 新增)          │
              │  └── AI Copilot (扩展协议分析能力)      │
              └──────────────────────────────────────┘
```

### 2.2 新增数据表

```sql
-- V10.0 新增 (已实现)
CREATE TABLE IF NOT EXISTS protocol_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_type TEXT NOT NULL,      -- LLMNR_POISON / ARP_SPOOF / BRUTE_FORCE / DTP_ATTACK
    severity TEXT DEFAULT 'HIGH',  -- CRITICAL / HIGH / MEDIUM / LOW / INFO
    source_ip TEXT,
    source_mac TEXT,
    target_ip TEXT,
    protocol TEXT,                 -- LLMNR / NBT-NS / ARP / DTP / SSH / HTTP
    details TEXT DEFAULT '{}',     -- JSON 格式详细信息
    raw_evidence TEXT DEFAULT '',  -- 原始数据包摘要
    mitre_ttp TEXT DEFAULT 'N/A', -- ATT&CK TTP 映射
    remediation TEXT DEFAULT '',  -- 防御修复建议
    probe_id TEXT DEFAULT 'unknown',
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    acknowledged BOOLEAN DEFAULT 0
);
```

### 2.3 新增 API 端点

```
/api/v1/alerts/
├── POST /ingest              # 探针告警摄入 (Bearer Token 鉴权)  ← 已实现
├── GET  /list                # 告警列表 (分页/筛选)              ← 已实现
├── GET  /stats               # 告警统计 (按类型/严重度分组)      ← 已实现
└── POST /{id}/acknowledge    # 指挥官确认告警                    ← 已实现
```

---

## 三、探针设计

### 3.1 设计哲学

探针是**研究原型**，不是生产级 IDS。核心学术价值在于：
1. 展示对协议本质的理解（Scapy 逐字节解析）
2. 从攻击特征中提取检测逻辑（不调用现成工具黑盒）
3. 遵循 MITRE ATT&CK 框架标注检测点

### 3.2 已规划探针

| 探针 | 检测目标 | ATT&CK TTP | 核心逻辑 | 优先级 |
|---|---|---|---|---|
| `claw_llmnr_probe.py` | LLMNR/NBT-NS 毒化 | T1557.001 | 统计非域控 IP 的 Response 频率 | P0 |
| `claw_arp_probe.py` | ARP 欺骗 | T1557.002 | MAC↔IP 映射漂移检测 | P1 |
| `claw_bruteforce_probe.py` | 暴力破解 | T1110 | 单位时间鉴权失败速率统计 | P1 |
| `claw_l2_probe.py` | DTP/STP 异常 | T1599 | L2 控制帧被动检测 | P2 |

### 3.3 统一回传协议

所有探针共享同一套回传格式（与 WiFi 探针架构对齐）：

```python
POST /api/v1/alerts/ingest
Authorization: Bearer <CLAW_SENSOR_TOKEN>

{
    "probe_id": "kali-llmnr-01",
    "alerts": [{
        "alert_type": "LLMNR_POISON",
        "severity": "HIGH",
        "source_ip": "10.140.0.55",
        "source_mac": "AA:BB:CC:DD:EE:FF",
        "protocol": "LLMNR",
        "details": {"queries_answered": 47, "window_seconds": 60},
        "raw_evidence": "UDP 5355 Response ...",
        "mitre_ttp": "T1557.001",
        "remediation": "GPO 禁用 LLMNR + 强制 SMB Signing"
    }]
}
```

---

## 四、AI 研判能力扩展

### 4.1 学术核心亮点：AI 辅助 IDS 规则生成

这是 V10.0 最具论文价值的能力——利用 LLM 从协议告警中自动生成 Suricata IDS 规则：

```
协议告警 → AI Copilot 分析 → 输出 Suricata 规则 + 防御建议

示例 AI 输出:
  alert udp any any -> any 5355 (msg:"LYNXCLAW DETECT - LLMNR Poisoning";
    flow:to_server; content:"|00 00 80|"; offset:2; depth:3;
    threshold:type both, track by_src, count 5, seconds 60;
    classtype:attempted-recon; sid:1000001; rev:1;)
```

### 4.2 SYSTEM_PROMPT 增强

AI Copilot 的系统提示词中增加协议分析能力描述：
- 可查询 `protocol_alerts` 表分析网络异常
- 可关联 WiFi 物理层和协议层告警（同一 MAC 在两个维度出现）
- 可输出 Suricata/Snort 格式规则
- 可生成 GPO/ACL 修复建议清单

---

## 五、基础设施规划

### 5.1 短期拓扑（立即可做）

```
┌─────────────────────────────────────┐
│  MacBook Air (指挥台 + CLAW)         │
│  ├── CLAW Web UI (:8000)            │
│  ├── AI Copilot (Gemini 3.1)        │
│  └── Tailscale (100.64.0.1)         │
└────────────┬────────────────────────┘
             │ 192.168.64.10 (静态 IP)
             ▼
┌─────────────────────────────────────┐
│  Kali VM (武器库 + 探针)             │
│  ├── 固定 IP: 192.168.64.10        │
│  ├── claw_wifi_sensor.py            │
│  ├── claw_llmnr_probe.py           │
│  ├── claw_arp_probe.py             │
│  ├── Tailscale (100.64.0.2)        │
│  └── ALFA 网卡 (USB 直通)           │
└─────────────────────────────────────┘

📱 手机: Tailscale → http://100.64.0.1:8000
```

### 5.2 Kali VM 静态 IP 配置

```bash
# Kali VM 内执行
sudo tee /etc/network/interfaces.d/eth0-static << 'EOF'
auto eth0
iface eth0 inet static
    address 192.168.64.10
    netmask 255.255.255.0
    gateway 192.168.64.1
    dns-nameservers 8.8.8.8
EOF
sudo systemctl restart networking
```

Mac 端 SSH 配置：
```
# ~/.ssh/config
Host kali
    HostName 192.168.64.10
    User root
    StrictHostKeyChecking no
```

---

## 六、里程碑

| Sprint | 内容 | 工时 | 状态 |
|---|---|---|---|
| Sprint 0 | 告警数据表 + API 端点 | 0.5 天 | ✅ 已完成 |
| Sprint 1 | LLMNR 探针原型 + 告警前端面板 | 1.5 天 | 🚧 进行中 |
| Sprint 2 | AI 协议分析 + IDS 规则生成 | 1 天 | 待开始 |
| Sprint 3 | 战报协议章节 + ARP 探针 | 1 天 | 待开始 |
| Sprint 4 | 基础设施 (静态 IP / Tailscale) | 0.5 天 | 待开始 |
| **总计** | | **~4.5 天** | |

---

## 七、学术叙事链

```
论文可能的章节结构:

1. 问题提出: 企业内网广播协议的先天信任缺陷
2. 方法论: 在隔离靶场中进行协议级实证分析
3. 系统设计: CLAW — AI 增强的多域态势感知研究平台
   3.1 多源探针架构 (Scapy 自研 → 协议本质检测)
   3.2 多域数据融合 (WiFi + 有线 + 协议告警)
   3.3 AI 辅助防御 (LLM 生成 IDS 规则 + 修复建议)
4. 实验验证: 靶场实测 (LLMNR/ARP/暴力破解 检测效果)
5. 防御建议: GPO/ACL/Fail2Ban/DAI 最佳实践
6. 结论
```
