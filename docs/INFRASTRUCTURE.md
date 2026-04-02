# CLAW 基础设施与演进方向规划

**版本**：V10.0 Protocol Anatomy
**日期**：2026-04-02
**作者**：CatTeam 架构组
**状态**：方向已确认，按阶段推进

---

## 一、系统演进方向

### 1.1 现有资源

| 资源 | 角色 | 核心能力 |
|---|---|---|
| MacBook Air (M-series) | 指挥台 | CLAW Web UI + AI Copilot + GPU (Metal) |
| Kali VM (UTM/VMware) | 武器库 + 探针 | aircrack-ng / nmap / Responder / ALFA 网卡 |
| 幸福广场 11 楼靶场 | 实验环境 | 赵教授督导 · 完全授权隔离网络 |
| ALFA 网卡 + 9dBi 天线 | 物理探针 | 802.11 Monitor Mode · RTL8812AU |

### 1.2 演进策略：深度 > 广度

CLAW 不往"更多功能"方向堆砌，而往 **"更深的协议理解 + 更顺的作战流程"** 两个轴演进：

```
                深度 (协议理解)
                    ▲
                    │
                    │   ⭐ 目标区域
                    │   ┌─────────────┐
                    │   │ V10.0       │
                    │   │ 协议探针    │
                    │   │ + AI 规则   │
                    │   │ + 告警大屏  │
                    │   └─────────────┘
        V9.3 ─ ─ ─ ┼ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─►  广度 (功能数量)
                    │
```

**纵轴深挖（学术价值）**：
1. 自研 Scapy 探针 → 展示对协议本质的理解
2. AI 生成 IDS 规则 → 论文核心创新点（LLM for Security）
3. 多域态势融合 (WiFi + 协议 + 资产) → 系统工程贡献

**横轴只补两块短板（运维效率）**：
1. Mac ↔ Kali 自动化连接（静态 IP / Tailscale）
2. 探针一键部署与生命周期管理

> ⚠️ **核心原则：不再增加武器模块。** 导师已明确——武器在 Kali 终端手动用。
> CLAW 的价值在于"看清战场 + AI 辅助决策"，不在于"一键开火"。

---

## 二、VPS 部署分析

### 2.1 结论：不部署 VPS，使用 Tailscale 隧道替代

| 风险 | 说明 |
|---|---|
| 🔴 **网络隔离** | CLAW 需要和靶场在同一局域网才能接收探针数据。VPS 在公网，看不到 11 楼内网 |
| 🔴 **USB 设备** | ALFA 网卡是 USB 直通到 VM，无法从 VPS 使用 |
| 🔴 **安全风险** | 渗透测试平台暴露在公网 = 自己成为靶标，且可能违反授权范围 |
| 🔴 **延迟** | 实时态势感知需要低延迟，VPS 网络往返破坏 HUD 实时性 |

### 2.2 替代方案：Tailscale 零配置 VPN 组网

[Tailscale](https://tailscale.com) 基于 WireGuard，解决远程访问问题：

- 免费版支持 3 个设备
- 每个设备获得**固定的 100.x.x.x IP**（永远不变！）
- 端到端加密，流量不经过第三方服务器
- 1 分钟安装，无需端口转发

```
📱 手机 (Tailscale)  ──┐
                        ├──→  Tailscale VPN 网格  ──→  Mac (CLAW :8000)
💻 iPad (Tailscale)  ──┘                               │
                                                        └──→ Kali VM
```

安装命令：
```bash
# Mac
brew install tailscale && tailscale up

# Kali VM
curl -fsSL https://tailscale.com/install.sh | sh && sudo tailscale up

# 手机: App Store 下载 Tailscale App
# → 任何地方都能通过 http://100.x.x.x:8000 访问 CLAW 大屏
```

> **Tailscale 同时解决了 VM IP 变动问题**——Kali VM 在 Tailscale 网络中的 IP 是固定的（如 100.64.0.2），无论 VM 本地 DHCP 怎么变。

---

## 三、Kali Linux 运行环境选型

### 3.1 三种方案对比

| 方案 | 优势 | 劣势 | 适用阶段 |
|---|---|---|---|
| **A. VM (当前)** | 快照回滚 · 便携 · 资源共享 | USB 直通偶尔不稳 · VM 网络层隔离 | ✅ **当前最优** |
| **B. 独立电脑** | 原生驱动 · 性能最佳 · 可长期运行 | 额外成本 · 多一台设备 | 🔮 中/长期升级 |
| **C. M4 MacBook 直装** | 性能最强 | 失去 macOS + CLAW 环境 | ❌ **不推荐** |

### 3.2 分阶段升级路线

**短期（当前阶段）**：继续用 VM
- 学术研究和靶场实验不需要极致性能
- VM Snapshot 是安全研究的核心工具（搞坏了 3 秒回滚）
- M 系列芯片跑 UTM/VMware Fusion 性能完全足够

**中期（大量无线渗透时）**：加入 Raspberry Pi 5
```
Raspberry Pi 5 (¥400) + Kali ARM + ALFA 网卡
= 永远在线的探针节点
= 部署在靶场角落 24/7 运行
= 通过 Tailscale 接入 CLAW 网络

MacBook 继续做指挥台（CLAW + AI Copilot）
```

**长期（职业安全方向）**：二手 ThinkPad
```
IBM ThinkPad T480 (¥800-1200 二手)
= Kali 原生安装
= Intel 网卡 + ALFA 外接 = 双网卡
= 原生 Linux 内核，无线驱动零问题
= 足够的算力跑 hashcat CPU 模式
```

> ⚠️ **M4 MacBook 直装 Kali 是最差选择**——会失去 macOS 上的 CLAW 开发环境、Antigravity、以及整个指挥台生态。MacBook 的价值就是做指挥台，不要让它去当武器机。

---

## 四、远程控制链路优化

### 4.1 当前链路（合理，需优化）

```
手机 ──(远程桌面)──→ Mac ──(SSH)──→ Kali VM
                      │
                      └──(浏览器)──→ CLAW :8000
```

这是业界标准的远程渗透测试架构，但存在三个痛点。

### 4.2 痛点 1：VM IP 每次变化

> 解决方案（三选一，推荐 A 或 C）

#### 方案 A：VM 配置静态 IP（最简单）

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
```bash
# ~/.ssh/config
Host kali
    HostName 192.168.64.10
    User root
    StrictHostKeyChecking no
```

之后永远 `ssh kali` 即可连接。

#### 方案 B：Avahi/mDNS 主机名发现

```bash
# Kali VM 安装 avahi
sudo apt install avahi-daemon
sudo systemctl enable avahi-daemon

# 之后不管 IP 怎么变，都能用主机名连接
ssh root@kali.local
```

#### 方案 C：Tailscale 固定 IP（最优雅）

同时解决手机远程访问 + VM IP 固定两个问题（见第二章方案）。

### 4.3 痛点 2：CLAW 是否需要直连 Kali VM？

| 场景 | 需要 CLAW → Kali？ | 推荐方案 |
|---|---|---|
| 接收探针数据 | ❌ 不需要（探针 POST 到 CLAW） | 现有架构即可 |
| 在 CLAW 界面看 Kali 终端 | 🟡 可选 | SSH Web Terminal (未来 P2) |
| CLAW 远程触发 Kali 扫描 | ⚠️ 危险 | **不推荐**（违反 HITL 原则） |

**结论**：不需要 CLAW 直连 Kali。探针主动 POST 数据到 CLAW 是更安全的架构（Kali 是武器节点，应由人控制，不应被 CLAW 反向连接）。

### 4.4 痛点 3：手机远程控制体验优化

| 方案 | 体验 | 推荐场景 |
|---|---|---|
| Apple 远程桌面 (VNC) | 全屏控制，延迟较大 | 需要看完整桌面时 |
| Termius App (SSH) | 纯终端，响应快 | 操作 Kali 命令行 |
| **Tailscale + 手机浏览器** | 直接打开 CLAW HUD | **⭐ 日常态势监控最优** |

最终推荐链路：
```
手机浏览器 ──(Tailscale)──→ http://100.x.x.x:8000 ──→ CLAW 态势大屏
  + Termius ──(Tailscale)──→ ssh root@100.x.x.y   ──→ Kali 终端
```

---

## 五、拓扑演进路线图

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
│  ├── claw_llmnr_probe.py (V10.0)   │
│  ├── Tailscale (100.64.0.2)        │
│  └── ALFA 网卡 (USB 直通)           │
└─────────────────────────────────────┘

📱 手机: Tailscale App → http://100.64.0.1:8000
```

### 5.2 中期拓扑（加入边缘探针节点）

```
📱 手机 ──(Tailscale)──┐
                        │
MacBook (CLAW 指挥台)───┤── Tailscale Mesh VPN
                        │
Kali VM (武器库)────────┤
                        │
Raspberry Pi 5 ─────────┘
  ├── Kali ARM + ALFA 网卡
  ├── 24/7 无线探针
  └── 部署在靶场角落持续监控
```

### 5.3 长期拓扑（团队化 / 职业化）

```
📱 手机 ──(Tailscale)──┐
                        │
MacBook (CLAW 指挥台)───┤
                        │
ThinkPad (Kali 专机)────┤── Tailscale Mesh VPN
                        │
Raspberry Pi (探针 ×N)──┤
                        │
(可选) VPS ──────────────┘
  ├── Tailscale Exit Node
  └── 报告托管 / 外网 OSINT 出口
```

---

## 六、决策记录

| 决策项 | 结论 | 日期 |
|---|---|---|
| 系统演进方向 | 深度优先（协议理解 + AI 规则），不堆砌功能 | 2026-04-02 |
| VPS 部署 | 不部署，用 Tailscale 替代 | 2026-04-02 |
| Kali 运行环境 | 短期 VM → 中期 Raspberry Pi → 长期 ThinkPad | 2026-04-02 |
| VM IP 问题 | 静态 IP (192.168.64.10) + Tailscale 双保险 | 2026-04-02 |
| CLAW 直连 Kali | 不需要，探针主动 POST 是更安全的架构 | 2026-04-02 |
| 手机远程控制 | Tailscale + 浏览器 CLAW HUD + Termius SSH | 2026-04-02 |
