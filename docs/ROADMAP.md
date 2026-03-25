# 🐱 CatTeam 开发路线图 (Roadmap)

**最后更新：** 2026-03-25 v5.0  

---

## 版本演进全景

```
v1.0 (03-24)  ━━  v2.0 (03-25)  ━━  v3.0 (03-25)  ━━  v3.1 (03-25)  ━━  v4.0 (03-25)  ━━  v5.0 (03-25)  ━━  v6.0 (计划中)
  基础链             工程化            攻击链            情报层           合规/侦察/AD      SQLite+AI副官    隧道/C2
```

---

## ✅ 已完成版本

### v1.0 — 首次发布 (03-24)

基础侦察链闭环：
- 00-armory (DHCP 换脸) → 01-recon (被动嗅探) → 02-probe (Nmap 扫描) → 02.5-parse (XML→JSON) → 03-audit (httpx)
- Makefile v1.0 中控引擎
- `set -euo pipefail` + trap 清理

### v2.0 — 系统级现代化 (03-25)

- `config.sh` 统一配置中心
- 时间戳任务目录 + `latest` 软链接
- `log()` 双写、`preflight` 飞行前预检
- 03-audit-web.py (纯 Python httpx)、03-exploit-76.py (VNC/SMB 精准打击)
- Dockerfile v1 → v2 (Impacket 焊入镜像)

### v3.0 — 攻击链扩展 (03-25)

完整投毒→破解→横移杀伤链：
- 04-phantom (Responder 投毒, Mac 原生)
- 05-cracker (Hashcat 离线破解, GPU)
- 06-psexec (Impacket smbexec 横向移动)

### v3.1 — 情报层 + 安全加固 (03-25)

- 07-report.py (Markdown 战报自动生成)
- 08-diff.py (资产变化检测)
- OPSEC: 06 禁止命令行密码、04 僵尸进程清理

### v4.0 — 合规/侦察升维/AD 域链 (03-25) ← 当前版本

**Sprint 1: 合规与基建**
- `scope.txt` ROE 白名单 (多 CIDR)
- `scripts/scope_check.py` ipaddress 交集校验
- `tests/` Docker Compose 自动化靶场 (DVWA + Samba)

**Sprint 2: 侦察升维**
- 01-recon 双模式 (passive + active via Docker nmap -sn)
- Dockerfile v3 + Nuclei (枪弹分离架构)

**Sprint 3: 后渗透 + AD 域**
- 09-loot.sh (secretsdump + smbclient, --confirm 安全阀)
- 10-kerberoast.sh (GetUserSPNs + BloodHound)

**交互式控制台**
- `catteam.sh` TUI 交互菜单 (`make console`)
- ASCII+ANSI 样式、实时状态栏、前置条件校验

**平台升级**
- Dockerfile v3: Nuclei 已焍入
- config.sh: IMAGE_NAME 切换至 v3

### v5.0 — SQLite 数据层 + AI 副官 (03-25) ← 当前版本

**Phase 1: SQLite 双写架构**
- `db_engine.py` — 四张表 (scans/assets/ports/vulns) + scan_id 隔离
- `02.5-parse.py` — 双写: SQLite (claw.db) + JSON (live_assets.json)
- `08-diff.py` v5.0 — SQL EXCEPT 差异引擎 + JSON 兼容 fallback

**Phase 2: AI 智能副官 (Gemini Flash)**
- `16-ai-analyze.py` — 战术分析 (SQLite → Prompt → Gemini → 建议)
- `17-ask-lynx.py` — 多轮对话 (自动携带扫描上下文, 滑动窗口 10 轮)
- `catteam.sh` v5.0 — [AI 副官] 菜单 (13/14)
- OPSEC 脱敏层 + config.sh AI 配置段
- `.gitignore` 保护 API Key

**Phase 3: 智能告警引擎**
- `11-webhook.py` — 自动 Diff → AI 分析 → 本地告警 + macOS 通知
- 告警存储至 `CatTeam_Loot/alerts/`
- 支持 `--cron` 静默轮询机制

**Phase 4: TUI 优化与底层架构修复 (v5.0.1)**
- 菜单支持环境隔离，并在控制台状态栏输出 `Env: ...`
- 新增 `r) 上帝模式` 动态绕过 ROE 授权的物理开关
- 新增 `s) 陷阱监控` 一键查看 Responder 进程状态和捕获的 Hash
- 修复 `suggest_next` 建议引擎，精准识别后台 Responder 驻守状态
- 全局解耦底层脚本硬编码序号，统一改用语义化模块名
- 修复 AI 情报截断 Bug：过滤 `[FAIL]` 垃圾数据，确保 TP-Link 等高价值目标不被 3000 字符限制吞没
- 彻底解决 Web 指纹与 SQLite ID 的时序不一致 (Session Mismatch)
- 自动化处理 `Responder` 原生克隆及相对路径映射

---

## 🚀 v6.0 — 导师批复路线 (待启动)

> 以下方向已获导师正式批准 (2026-03-25)

| 方向 | 决策 | 技术选型 |
|---|---|---|
| **C2 框架** | ✅ 批准 | Sliver (独立部署，不入 Docker) |
| **内网穿透** | ✅ 批准 | Ligolo-ng / Chisel (替代 Proxychains) |
| **BloodHound** | ✅ AI 推理 | JSON ZIP → Lynx (Gemini 1M 上下文图论推理) |
| **固件逆向** | ⚠️ 手动 | Ghidra 个人研究，CLAW 仅做自动解包 |

### 待用户操作的环境依赖项

| 编号 | 任务 | 前置条件 |
|---|---|---|
| T1 | `make test` 靶场验证 | 需 `docker pull` |
| T2 | Dockerfile V4 构建 | 需 `docker build` |
| T3 | Nuclei 模板更新 | 需 `nuclei -update-templates` |
| T4 | 01-recon active 实测 | 需靶场网络 |
| T5 | 09-loot / 10-kerberoast 实测 | 需 AD 域控靶机 |

---

## 🚀 v6.0 远期规划 (导师已定调)

### P1: 隧道穿透 (导师批准)
- **Ligolo-ng** / Chisel (TUN 虚拟网卡, 不用 Proxychains)
- ‘route add’ 级别的全流量代理

### P2: AI + BloodHound (方案 C)
- 不装 Neo4j——直接喂 Gemini 1M 上下文做图论推理
- “从当前用户到 Domain Admin 的最短路径”

### P3: Webhook 告警
- `11-webhook.py` + cron 定时扫描
- AI 分析结果推送钉钉/飞书

### P4: make toolbox
- Nikto / Hydra / Sqlmap 子菜单

### P5: Nuclei 深度集成
- 从 live_assets.json 自动生成目标清单
- 扫描结果 → vulns 表 → 07-report

### P6: Sliver C2
- 开源, Go, mTLS/WireGuard
- EDR 绕过研究
- 分布式扫描节点

---

## 📊 模块成熟度矩阵

| 模块 | 版本 | 生产就绪? | 实战验证? |
|---|---|---|---|
| 00-armory | v1.0 | ✅ | ✅ |
| 01-recon (passive) | v4.0 | ✅ | ✅ |
| 01-recon (active) | v4.0 | ✅ | ⚠️ 待测 |
| 02-probe | v2.0 | ✅ | ✅ |
| `02.5-parse` | v5.0 | ✅ | ✅ |
| `03-audit` | v1.0 | ✅ | ✅ |
| `03-audit-web` | v2.0 | ✅ | ✅ |
| `04-phantom` | v3.0 | ✅ | ✅ |
| `05-cracker` | v3.0 | ✅ | ⚠️ 待密码验证 |
| `06-psexec` | v3.1 | ✅ | ⚠️ 待凭据 |
| `07-report` | v3.1 | ✅ | ✅ |
| `08-diff` | v5.0 | ✅ | ✅ (SQL EXCEPT) |
| `09-loot` | v4.0 | ✅ | ⚠️ 需 AD 靶机 |
| `10-kerberoast` | v4.0 | ✅ | ⚠️ 需 AD 靶机 |
| `db_engine` | v5.0 | ✅ | ✅ (自测通过) |
| `16-ai-analyze` | v5.0 | ✅ | ✅ (Gemini Flash 实测) |
| `17-ask-lynx` | v5.0 | ✅ | ✅ |
| `scope_check` | v4.0 | ✅ | ✅ |
| `make test` | v4.0 | ✅ | ⚠️ 需拉镜像 |

---

## 🗺️ 开发里程碑

| 日期 | 事件 |
|---|---|
| 03-24 | v1.0 首次发布，基础侦察链5个模块 |
| 03-25 AM | v2.0 工程化改造 (config/时间戳/Docker v2) |
| 03-25 PM | v3.0 攻击链 (投毒/破解/横移) |
| 03-25 PM | 导师 v3.0 Code Review → OPSEC 修复 |
| 03-25 PM | v3.1 情报层 (报告+变化检测) |
| 03-25 PM | V4.0 提案 → 导师 10 方向评审 → AI 4 点反馈 |
| 03-25 Night | v4.0 三个 Sprint 全部落地 |
| 03-25 AM | TUI 控制台 + Docker v3 (Nuclei) 升级 |
| 03-25 PM | v5.0 Phase 1: SQLite 双写架构 |
| 03-25 PM | v5.0 Phase 2: AI 副官 (Gemini Flash) 集成 |
| 03-25 PM | v5.0.1 TUI 修复 + 实战渗透 (TP-Link/HP/AirTunes) |
| 03-25 Night | 导师批复 v6.0 (Sliver/Ligolo-ng) + v7.0 (Agentic AI) |
