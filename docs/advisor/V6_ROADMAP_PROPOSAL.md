# Project CLAW — 进阶路线分析 (请导师定夺)

**来源：** AI 工程助手 (Antigravity)  
**日期：** 2026-03-25  
**背景：** 学生助理对比了 CLAW 与顶尖红队的差距，工程助手对此进行了可行性分级

---

## 一、现阶段可落地 (v5.0 周期内)

| 功能 | 工作量 | 说明 |
|---|---|---|
| **SQLite 数据层** | 中 | 已列入 Phase 1，三张表设计 |
| **AI 智能副官** | 中 | Gemini 3 Flash 免费额度，纯 curl 集成 |
| **BloodHound 图谱** | 小 | `10-kerberoast.sh` 已输出 JSON ZIP，只需装 Neo4j 可视化 |
| **Nmap 静默模式** | 极小 | `-T2 --scan-delay 500ms`，TUI 加一个 PROFILE=stealth |
| **Webhook 告警** | 小 | 50 行 Python，cron 定时 + 钉钉/飞书推送 |

## 二、需要导师指导方向

### 1. Proxychains 跳板模式
让扫描流量经过跳板机，不暴露真实 IP：
```
Mac → SSH隧道 → 跳板VPS → 目标网络
```
- 技术实现不难 (`proxychains4 nmap ...`)
- **问题：** 在课程靶场环境下是否有必要/合规？

### 2. C2 框架选型
- Cobalt Strike (商业，$3500/年)
- **Sliver** (开源，Go 语言，SpecterOps 开发)
- 是否在 v6.0 引入轻量 C2？导师对此有何建议？

### 3. BloodHound 集成深度
- 方案 A：仅作可视化工具（手动导入 ZIP）
- 方案 B：**深度集成** — SQLite 数据自动导入 Neo4j，AI 结合图谱推理攻击路径
- 导师推荐哪种？

## 三、认知储备 (暂不实施)

| 方向 | 原因 |
|---|---|
| 0-Day 漏洞挖掘 | 需逆向工程功底，属研究级课题 |
| CDN 域前置 | 需大量云资源 + 法律合规评估 |
| EDR 绕过 / 免杀 | Direct Syscalls / BYOVD 属高级攻防，需导师专项带路 |
| 分布式蜂群 C2 | 需运维数十台 VPS，超出当前课程范围 |

## 四、建议的长期路线图

```
v5.0 [本周-下周]
  Phase 1: SQLite 数据层
  Phase 2: AI 副官 (Gemini Flash)
  Phase 3: Webhook 告警
  Phase 4: Toolbox

v6.0 [待导师定夺]
  - BloodHound 图谱集成
  - Nmap 静默 PROFILE
  - Proxychains 跳板 (如导师批准)

v7.0 [远期愿景]
  - 轻量 C2 (Sliver)
  - EDR 绕过研究
  - 分布式扫描节点
```

---

*恳请导师审阅并批示：第二部分的三个方向选择，以及长期路线图的优先级。*
