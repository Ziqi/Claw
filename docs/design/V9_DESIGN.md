# Project CLAW V9.0 — 下一代协同作战指挥系统架构设计规范

**Project CLAW · V9.0**  
**版本：** 0.1 (Draft)  
**日期：** 2026-03-27  
**状态：** 📝 规划中，等待导师审批
**代号：** Multiplayer Graph Command

---

## 一、平台定位与 V9 愿景

```text
CLAW V8.x:  人类与 AI 的双打工具 (Human-AI Co-Piloting)
CLAW V9.0:  多智能体与红队协同指挥中心 (AI-Driven Multiplayer Command Center)
```

**核心演进目标**：
1. **彻底摒弃表驱动 (Table-Driven)**，全面转向**图驱动 (Graph-Driven)** 的底层实战数据架构。
2. **多线程并发渗透**：破除当前单体长连接模型的单点瓶颈，进化为 Multi-Agent Swarm 协同作战。
3. **C2 深度集成**：战区 (Theater) 不再只是“发现的资产库”，而是“实控的信标池 (Beacon/Session Pool)”。

---

## 二、架构演进 (三大支柱)

### 2.1 支柱一：图数据库重构 (Graph-Native Attack Surface)

全面下线 `assets`, `ports`, `vulns` 孤立表结构，迁入 Neo4j 等图数据库。

- **节点 (Nodes)**: `[IP_HOST]`, `[PORT_SVC]`, `[CREDENTIAL]`, `[VULN]`, `[PROCESS]`
- **边 (Edges)**: `[HAS_PORT]`, `[AFFECTED_BY]`, `[CAN_RCE]`, `[HAS_ROUTE_TO]`, `[DUMPED_FROM]`
- **AI 赋能**：Gemini 将直接输出符合语义的 Cypher 语句建图与查图，彻底告别复杂的 JSON 组装。

### 2.2 支柱二：战役时间线总线 (Campaign Event Bus)

建立类似 EDR 黑匣子的战区微秒级操作记录系统。

| 组件 | 功能 | 价值 |
|---|---|---|
| **Event Tracker** | 窃听所有的 Nmap/Vuln/Hit 动作打入时序库 | 形成完整的红队攻击路径凭证 |
| **Chronos Memory** | 作为 AI 的远期记忆库缓存 | AI 不再重复攻击已经试错的资产 |
| **Theater Sync** | 向多端推送最新的时间线 UI | 玩家体验感大幅增强，适合红蓝对抗大屏 |

### 2.3 支柱三：多智能体并发调度 (Blackboard Agent Swarm)

打破单个 `react_loop_stream` 的死循环算力限制：

- **Commander (中控 / Gemini 3.1 Pro + Deep Think)**：负责统管全图，制定宏观战略方案，解析大目标并指派子任务。
- **Operator (干员 / Gemini 3.0 Flash)**：负责处理耗时的打点、Nmap 结果清洗、Web 目录探勘，然后将情报贴在全局黑板 (Blackboard) 上。

### 2.4 支柱四：智能化兵工厂与免杀规避 (AI-Native Arsenal & Evasion)

超越 Cobalt Strike 和 Metasploit 的底层逻辑，将固化的攻击脚本升级为基于 LLM 的大模型生成：

- **动态 Payload 生成引擎 (Generative Loader)**：针对靶机杀软特性，临时用 C/Nim 编写并交叉编译专属免杀加载器。
- **认知压缩 (Cognitive Distillation)**：1M 超长上下文直接吞噬清洗离线抓取的域内 BloodHound JSON 和数十 MB 网络流量，一句话提炼最短攻击路径。
- **拟人化流量调控 (Human-Mimicry Jitter)**：指令底层网关自动探测靶场业务活跃期，AI 动态决定 C2 的流量唤醒频次，以拟似办公行为深度规避 EDR 的网络模型。

---

## 三、C2 / Sliver 融合 (Sessions First)

在 V9 中，资产管理页面 (Asset Table) 将被降级，“上线机器 (Active Sessions)”列表将被置于最高级优先位置。

1. **Multiplexing 后端**：通过 gRPC / REST 与外部强大的 Sliver-C2 互联。
2. **语义化作战总线 (Semantic PTY)**：打破硬编码脚本，支持人类输入*“在这台机器设代理扫内网无文件免杀”*，系统直接连带 Chisel 编译、Socks5 隧道和下发信标一条龙自动完成。

---

## 四、安全与物理隔离准则升级

1. **Graph Namespace 隔离**：每一个战区 (Theater) 对标图数据库里的一个分离 Namespace/Tenant，从根本上防止 `COUNT(*)` 漏底。
2. **Action 级 HITL 审计**：AI 所有产生的 `WRITE` 级动作，必须带有密码学签名并存入区块链 / WORM 时序库备查。

---

**[导师批阅预留区]**

- [ ] 许可开始图数据库选型调研
- [ ] 许可进行 Multi-Agent 架构的 Demo 搭建
