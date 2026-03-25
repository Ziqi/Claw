# CatTeam V4.0 — 最终工程报告 (给导师)

**工程师：** AI 工程助手 (Antigravity) + 首席工程官  
**日期：** 2026-03-25  
**版本：** v4.0 (已封版)

---

## 一、本轮交付总览

### Sprint 1: 合规与基建 ✅
| 文件 | 说明 |
|---|---|
| `scope.txt` | ROE 白名单 (多 CIDR, 默认 10.140.0.0/16) |
| `scripts/scope_check.py` | ipaddress 交集校验，覆写 targets.txt |
| `01-recon.sh` | 集成 scope 白名单校验 |
| `tests/docker-compose.yml` | Docker Compose 靶场 (DVWA + Samba, 172.30.0.0/24) |
| `tests/run_tests.sh` | 6 阶段自动化测试 |

### Sprint 2: 侦察升维 ✅
| 文件 | 说明 |
|---|---|
| `config.sh` | +RECON_MODE (passive/active) +ACTIVE_CIDR |
| `01-recon.sh` | 双引擎: passive=tcpdump, active=Docker nmap -sn |
| `Dockerfile` | v3: +Nuclei (枪弹分离，模板运行时挂载) |
| `nuclei-templates/` | 模板目录 + README |

### Sprint 3: 后渗透 + AD 域 + TUI ✅
| 文件 | 说明 |
|---|---|
| `09-loot.sh` | secretsdump + smbclient, --confirm 安全阀 |
| `10-kerberoast.sh` | GetUserSPNs + BloodHound (JSON ZIP) |
| `catteam.sh` | 新增 | TUI 控制台: Lynx 猫头 logo, 状态感知, 前置条件校验, 下一步建议 |
| Makefile | 修改 | +loot +kerberoast +console; phantom/crack/lateral 加 USE_LATEST 修复 |

### 基础设施升级 ✅
- Docker 镜像: v2 -> v3 (Nuclei 已焊入)
- config.sh: IMAGE_NAME 已切换至 v3

### 品牌升级
- 系统代号: **Project CLAW** (CatTeam Lateral Arsenal Weapon)
- 吉祥物代号: **Lynx** (猞猁)
- 主动探活自动读取 scope.txt 建议 CIDR

---

## 二、架构全景 (v4.0 最终版)

```
         /\_/\
        ( o.o )  CatTeam Shadow Arsenal v4.0
         > ^ <

合规层    scope.txt ROE 白名单 + blacklist.txt
侦察链    00-armory -> 01-recon(passive|active) -> 02-probe -> 02.5-parse
审计层    03-audit / 03-web / Nuclei
攻击链    04-phantom -> 05-cracker -> 06-psexec
AD域链    10-kerberoast (GetUserSPNs + BloodHound)
后渗透    09-loot (secretsdump + smbclient) [人工阀门]
情报层    07-report / 08-diff
质量层    make test (Docker Compose 靶场)
控制台    catteam.sh (TUI 交互菜单)
```

---

## 三、v5.0 演进方向 (恳请导师指导)

> 导师指示: 先聚焦 CLAW 系统本身的完善，暂不扩展 VPS 审计场景。

### A. AI 智能副官 (导师重点推荐)
在 TUI 中嵌入 AI 能力，三层递进设计：
- **层级 1 (已实现):** 基于文件状态的规则建议 (`suggest_next`)
- **层级 2 (待做):** 菜单项 "AI 分析"，将扫描结果喂给 LLM，输出风险评估+攻击路径+生成命令
- **层级 3 (待做):** 菜单项 "问 Lynx"，自由对话模式，AI 可读取所有 Loot 数据

设计原则: AI 不主动干扰工作流，仅在用户主动调用时出现。

### B. 持续攻击面管理 (ASM/CTEM)
- cron 定时 `make fast` + `make diff`
- 变化告警 (邮件/Webhook)

### C. 数据层升级
- live_assets.json -> SQLite 持久化
- 历史查询 + 趋势分析

### D. 工具箱落地 (make toolbox)
- Nikto / Hydra (IoT) / Sqlmap

---

## 四、导师的"赛博战场 vs 资本市场"洞察

导师指出的四个镜像关系，我们已在工程中部分印证：

| 网安概念 | 量化概念 | CLAW 实现 |
|---|---|---|
| 广域侦察 Recon | 数据清洗 | 01-recon + 02.5-parse |
| 漏洞挖掘 Exploit | Alpha 捕获 | 03-audit + Nuclei |
| 隐蔽 OPSEC | 降低市场冲击 | scope.txt + blacklist |
| 横向移动 Lateral | 复利杠杆 | 06-psexec + 09-loot |

---

## 五、恳请导师审查

1. AI 智能副官的三层设计是否合理？用哪个 LLM API？
2. ASM 持续监控对学生当前阶段是否过早？
3. 是否有其他导师认为必须优先的方向？

*v4.0 已全部落地并封版。等待导师批示后启动 v5.0。*
