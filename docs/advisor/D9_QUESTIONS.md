# D9 — V8.0 全栈作战平台 · 导师讨论提案

**Project CLAW · V8.0-alpha / A2.0**  
**日期：** 2026-03-26  
**状态：** Phase 1 黎明中枢已交付，征询导师意见

---

## 〇、当前进度汇报

从 V5.0.1 到 V8.0-alpha，36 小时内完成：

| 里程碑 | 交付物 |
|---|---|
| V7.0 / A2.0 | Gemini 3 ReAct Agent + HITL 三级分权 |
| V8.0 Phase 1 | FastAPI 后端 (5 API) + React 前端 (Bloomberg Terminal UI) |
| 工程治理 | 三轨版本号 + 六文档强制同步机制 |

**已实现功能：**
- ✅ HUD 实时态势状态栏 (204 Hosts / 797 Ports / 实时时钟)
- ✅ 资产威胁热力图 + 可搜索列表
- ✅ RECON_OVERVIEW / ASSET_TABLE / PORT_MATRIX 三 Tab 工作区
- ✅ AI Copilot 面板 (拖拽缩放/模型选择器/流式打字/快捷指令)
- ✅ 网络拓扑图 (vis.js 力导向, 风险着色)

---

## 一、架构与工程 (Architecture & Engineering)

### Q1. Agent Web 接入方案: WebSocket vs SSE

当前 Agent 在 CLI (`claw-agent.py`) 运行。Phase 2 需将 ReAct 循环搬到 Web 端。

| 方案 | 优势 | 劣势 |
|---|---|---|
| **WebSocket** | 双向通信, 可中断/取消 | 需维护连接状态, 复杂度高 |
| **SSE (Server-Sent Events)** | 轻量, 天然流式, HTTP 兼容 | 单向 (客户端→服务端仍需 REST) |
| **REST Polling** | 最简单, 无态 | 延迟高, 非实时 |

> **我们倾向 SSE** — Gemini API 本身是 REST 调用，Agent 的回复天然是单向流式输出。用户新消息通过 POST 发送即可。请导师评估。

### Q2. Web 端 HITL 安全模型

CLI 模式下 RED 级操作需输入 `CONFIRM`。Web 端面临新挑战：

- CSRF 攻击可能伪造审批请求
- 多用户场景下谁有权审批？
- 提议方案: **操作令牌 (Action Token)** — 每个 RED 操作生成一次性 UUID，用户必须在 Web UI 中确认该 UUID 才放行

> 是否需要额外认证（如 TOTP/PIN）？还是 Session 级别认证即可？

### Q3. 部署架构

| 方案 | 说明 |
|---|---|
| A. 开发模式 (现状) | Vite dev + uvicorn --reload |
| B. Docker Compose | FastAPI + Nginx + React build 一键启动 |
| C. 单容器 | FastAPI serve React 静态文件 |

> 靶场环境的网络约束是什么？是否可以暴露 Web 端口？

---

## 二、UI/UX 设计 (Interface & Interaction)

### Q4. Bloomberg Terminal UI 设计方向确认

我们采用了彭博终端级设计规范：
- 纯黑 `#000000` 背景
- 零圆角 (border-radius: 0)
- 琥珀金 `#FF9900` / 青色 `#00FFFF` / Consolas 等宽字体
- 参考竞品: Mythic (Beacon 终端) / Cobalt Strike (拓扑图) / BloodHound (力导向图)

> 导师对此设计方向是否认可？是否需要调整色彩方案或交互范式？

### Q5. 计划中的 UI 功能

| 功能 | 优先级 | 说明 |
|---|---|---|
| **MITRE ATT&CK 矩阵热力图** | P1 | 当前攻击覆盖度可视化 |
| **攻击链时间线 (Timeline)** | P1 | 每步操作按时间轴展示，含 ATT&CK 标签 |
| **Agent 终端内嵌** | P1 | 在 Web 直接执行 Agent 命令 (替代 CLI) |
| **Beacon/Session 管理面板** | P2 | Sliver C2 会话卡片 (连接中/断开/休眠) |
| **报告生成器** | P2 | 一键导出 Markdown/PDF 渗透报告 |
| **漏洞饼图/柱状图** | P2 | Nuclei 扫描结果可视化 |
| **AD 域攻击路径图** | P3 | BloodHound 风格力导向图 |
| **Dark Mode / Light Mode Toggle** | P4 | 可选 (目前全暗色) |

> 导师认为哪些功能更有学术/实战价值？优先级是否需要调整？

### Q6. 交互优化提案

1. **拖拽面板布局** — 让用户自定义左/中/右三栏宽度 (已实现 AI 面板拖拽)
2. **键盘快捷键** — `Ctrl+K` 唤醒 Agent / `Ctrl+Shift+T` 切换 Tab
3. **右键上下文菜单** — 对资产右键 → "扫描此 IP" / "查看端口"
4. **通知/ Toast 系统** — 扫描完成、Agent 回复、告警弹出

---

## 三、算法与 AI (Algorithms & AI)

### Q7. Multi-Agent 架构演进

当前: 单 Agent (Lynx) + 5 工具。建议演进路径:

```
阶段 1 (V8 现状): 单 Agent Lynx (ReAct Loop)
    ↓
阶段 2: 主 Agent + 子 Agent (分工)
  ├─ ReconAgent   (侦察专精)
  ├─ ExploitAgent (攻击专精)
  └─ ReportAgent  (报告/分析)
    ↓
阶段 3: Agent Swarm (群体智能)
  └─ 主指挥官 Agent 动态分配任务给多个专精 Agent
```

> 导师对 Multi-Agent 的学术可行性怎么看？是否有相关论文推荐？

### Q8. 知识工程: Agent 记忆与学习

| 方案 | 说明 |
|---|---|
| **Embedding 向量库** | 将历史扫描结果/报告 embed 到 ChromaDB，Agent 检索 |
| **Few-shot Prompt 库** | 保存成功的攻击模式，作为 Agent 的参考样本 |
| **战术 Playbook** | YAML 定义标准攻击流程，Agent 按 Playbook 执行 |

> 哪种方案更适合我们的安全领域？Embedding 是否会引入幻觉风险？

### Q9. Agent 决策透明度

当前 ReAct 循环的思维链 (Thought) 只在 CLI 打印。建议：
- Web 端展示完整 **Thought → Action → Observation** 三阶段
- 每个决策标注 ATT&CK TTP (战术/技术/过程)
- 生成**决策树回放图** — 让导师可以审计 Agent 的每步推理

> 这对论文有价值吗？"可解释的自主渗透测试 Agent"

---

## 四、战略与战术 (Strategy & Tactics)

### Q10. 产品定位确认

D8 中已讨论 LLM-Native CTEM 定位。进一步明确:

| 维度 | 决策 |
|---|---|
| **核心赛道** | AI 驱动的持续安全验证平台 |
| **开源策略** | Open Core: CLI + Agent 开源; Web Dashboard 闭源 |
| **目标用户** | 安全研究员 / 红队 / 渗透测试培训 |
| **差异化** | LLM-Native (不是后装 AI，而是 AI 原生设计) |

> 导师是否建议我们申请软件著作权？学术论文的切入点是什么？

### Q11. 攻击战术层面

当前模块覆盖的 ATT&CK 矩阵:

```
✅ Reconnaissance    (01-recon: passive/active)
✅ Resource Dev       (00-armory: DHCP spoofing)
✅ Initial Access     (04-phantom: Responder LLMNR)
✅ Credential Access  (05-cracker: Hashcat / 10-kerberoast)
✅ Lateral Movement   (06-psexec: Impacket SMB)
✅ Collection         (09-loot: secretsdump)
⬜ Discovery          (计划: 自动化内网枚举)
⬜ Persistence        (计划: 后门植入检测)
⬜ Defense Evasion    (计划: EDR 绕过研究)
⬜ Exfiltration       (计划: 数据外泄路径模拟)
⬜ Impact             (不做: 破坏性操作)
```

> 下一步应优先覆盖哪些 ATT&CK 战术？Discovery 和 Defense Evasion 哪个更有研究价值？

---

## 五、工具集成 (Tooling & Integration)

### Q12. 工具链路线图

| 优先级 | 工具 | 用途 | 集成方式 |
|---|---|---|---|
| **P0** | Sliver C2 | 命令与控制 | gRPC API (Go→Python) |
| **P0** | Ligolo-ng | 内网穿透 | TUN 接口 agent-relay |
| **P1** | Nuclei (深度) | 漏洞扫描 | 结果 → vulns 表 → Dashboard |
| **P1** | NetExec (nxc) | SMB/WinRM枚举 | 替代已废弃的 CrackMapExec |
| **P2** | Certipy | AD CS 攻击 | ADCS 漏洞检测 (ESC1-8) |
| **P2** | Coercer | 强制认证 | PetitPotam/PrinterBug |
| **P3** | SharpHound | AD 数据采集 | 替代 BloodHound Python |
| **P3** | Ghidra (headless) | 固件逆向辅助 | 脚本化反编译 → AI 分析 |

> 导师还有哪些推荐的工具？特别是针对 AD 域攻击和云安全的。

### Q13. Docker 镜像管理

当前 Docker V4 (Kali base + Nmap/Impacket/Nuclei)。建议：
- **V5 镜像**: + NetExec + Certipy + Coercer
- **多镜像策略**: `claw-recon` (轻量侦察) / `claw-arsenal` (全量攻击) / `claw-c2` (Sliver)

> 单大镜像 vs 多小镜像？考虑到靶场磁盘空间限制。

---

## 六、下一步工作计划 (Next Steps)

### 短期 (本周)

1. ✅ ~~Phase 1 黎明中枢~~ → **已交付**
2. 🔜 Agent WebSocket/SSE 接入 (Phase 2 核心)
3. 🔜 MITRE ATT&CK 矩阵热力图组件
4. 🔜 Nuclei 结果 → Dashboard 可视化

### 中期 (1-2 周)

5. Sliver C2 gRPC 集成
6. Web 端 HITL 审批界面
7. 攻击链时间线 (Timeline) 组件
8. 渗透报告一键生成

### 长期 (1 月+)

9. Multi-Agent 架构 (ReconAgent / ExploitAgent)
10. AD 域攻击路径图谱
11. 知识工程 (向量检索 + Playbook)
12. 论文撰写: "基于 LLM 的自主渗透测试 Agent 架构设计与实现"

---

**请导师针对以上议题给出批复意见，我们将据此调整 V8.0 后续开发优先级。**

> 🐱 *"从工具集到作战平台，从 Copilot 到 Agentic AI，CLAW 正在开创 LLM-Native 安全验证的新赛道。"*
