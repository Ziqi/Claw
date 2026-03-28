# 🐱 CatTeam 作战手册 (V9.2 Deep Autonomy)

本手册按**实战场景**组织，重点介绍 **G.I. 智能大屏** 的核心管线。

> **V9.2 深度自动化声明**: 本文档已经过 V9.1 原生代码基准线的清洗。TUI 终端降级为次要的回退手段。

---

## 🖥️ G.I. 智能大屏操作术 (V9.2 Commander's HUD)

### 启动服务

```bash
# 后端 (FastAPI MCP 桥接层) — 端口 8000
cd ~/CatTeam && uvicorn backend.main:app --reload --port 8000

# 前端 (React G.I. 大屏) — 端口 5173
cd ~/CatTeam/frontend && npx vite --port 5173
```

浏览器打开 `http://localhost:5173` 即可进入单兵全维度指挥大屏。

### V9.2 界面布局与管线节点 (The "HUD" Layout)

左侧的 `Activity Bar` 导航条**并未被删除，而是被深度重构为 V9 核心中枢**。当前系统完全服从上、中、右的三段军事化布局：

| 区域 | 真实模块 | 说明 |
|---|---|---|
| **领航域 (Top Header)** | 全局战役管线 (CampaignPipeline) 进度发光条 | 当前战区的射频、注入、报告进度指示器。 |
| **情境沙盒 (Center Pane)**| 【资产大表 AssetTable】与【战役看板 TheaterKanban】 | ALFA 与 NMAP 双重雷达探明的资产。 |
| **火控挂架 (Center Top)** | **开发中：** 全局多选准星 (Global Multi-Select Reticle) | 允许在不同的资产上框选靶标。 |
| **视觉防线 (A2UI Forge)**| AI 实时锻造引擎 (A2UIForgeModal) | 视觉层面反馈 Web 对话页面。 |
| **C2 远控桥 (Left Tab)**  | Sliver GRPC / Web 控制台 (SliverViewTab) | 后渗透 C2 端点控制。 |
| **副官参谋 (Right Pane)** | 原生闪电大模型终端支持 (Interactions State Machine) | OSINT 字典生成与其他复杂任务辅助。 |

### [➕超纲新增] V9.0 环境壁垒 (Theater Manager)
在启动 Web 面板后，**强烈建议第一步在顶部 Header 选择/新建 `战区 (Theater)`**。
所有扫描仪、资产入库、AI 对话上下文，**均被 SQLite 物理隔离在您选定的战区内**，横跨星巴克与内网时绝不会出现数据串流污染！

### A2UI 零日武器生成与持久化
在主面板触发 `拦截 Beacon` 等高级对抗动作时，AI 副官会实时推送 `A2UIForgeModal` (零日钓鱼锻造仓)。后端将自动解析渲染意图，将伪造页面实装到沙盒中投递。

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

# 2. 一键跑通（自动预检 Docker/镜像/权限）
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

# 或 Docker 内 httpx
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
docker exec -it kali_arsenal /bin/bash         # 进入战车
```

---

## 📦 模块使用前置条件

| 模块 | 需要先完成 | 额外依赖 |
|---|---|---|
| `00-armory` | 无 | sudo |
| `01-recon` | 无 | sudo, tcpdump |
| `02-probe` | 01 的 targets.txt | Docker + Kali 镜像 |
| `02.5-parse` | 02 的 nmap_results.xml | Python3 |
| `03-audit` | 02.5 的 live_assets.json | Docker + httpx |
| `03-audit-web` | 02.5 的 live_assets.json | Python3 |
| `04-phantom` | 无 (独立运行) | Responder + scapy |
| `05-cracker` | 04 的 captured_hash.txt | Hashcat + rockyou.txt |
| `06-psexec` | 02.5 的 live_assets.json + 凭据 | Docker + Impacket |
| `07-report` | 任意 Loot 数据 | Python3 |
| `08-diff` | 至少两次扫描记录 | Python3, claw.db (优先) |
| `09-loot` | 06 的 lateral_results.txt + 凭据 | Docker + Impacket + `--confirm` |
| `10-kerberoast` | 域用户凭据 + 域控 IP | Docker + Impacket + BloodHound |
| `16-ai-analyze` | claw.db (02.5 生成) | Python3, curl, Gemini API Key |
| `17-ask-lynx` | 无 (可选 claw.db) | Python3, curl, Gemini API Key |
| `18-ai-bloodhound` | BloodHound JSON/ZIP (`10-kerberoast` 生成) | Python3, Gemini API Key |
| `23-hp-proxy-unlocker` | 目标 IP | Python3 |
| **Web Dashboard (后端)** | 无 | Python3, uvicorn, FastAPI |
| **Web Dashboard (前端)** | 后端运行中 | Node.js, npm |
| `agent_mcp.py` | claw.db + Gemini API Key | Python3, MCP Server |
| `mcp_armory_server.py` | claw.db | Python3 |
| `make toolbox` | Docker 容器运行中 | Docker + Kali 镜像 V4 |
| `make firmware` | 固件 .bin 文件 | Python3 |

---

## ⚠️ 常见问题

| 问题 | 解决 |
|---|---|
| `make run` 卡在换脸 | `make fast` 跳过 |
| 飞行前预检失败 | 启动 Docker / 构建镜像 |
| "弹药库为空" | 延长 `RECON_TIME` 或确保网络有广播 |
| 扫的端口太少 | `PROFILE=full` |
| 误扫了不该扫的 | 编辑 `blacklist.txt` |
| Hashcat 找不到字典 | 更新 `config.sh` 中 `WORDLIST` 路径 |
| 04 模块在 Mac 上抓不到包 | 检查 SIP 是否禁用了原始套接字 |
| 06 凭据从哪来 | 自动从 05 的 cracked_passwords.txt 加载 |
