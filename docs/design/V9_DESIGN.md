# Project CLAW V9.0 — 全栈智能体指挥中心架构设计规范 (G.I. Era)

**Project CLAW · V9.0**  
**版本：** 0.9 (Draft)  
**日期：** 2026-03-27  
**修订状态：** 📝 架构大修完成，融入 D13 学术定调
**代号：** Monolithic Agentic Commander

---

## 一、平台定位与 V9 愿景

```text
CLAW V8.x: 离散仪表盘配合底层命令的弱关联体系 (Human-AI Co-Piloting)
CLAW V9.0: G.I. (生成式界面) 驱动的单兵全维度近源渗透工作站
```

**核心演进目标**：
1. **彻底摒弃隔离的 OP 遥控面板**，全面转向**指挥官视窗 (The Commander's HUD)** 交互范式，将行动触发点嵌入数据资产本身。
2. **极简硬件云边下沉**：搁置庞大且易损坏的分布式硬件（树莓派/菠萝派），以单本电脑 + **大功率 Alfa 无线监听网卡**为唯一硬件载体，发掘射频网卡在近源渗透中的战术主导力。
3. **前沿学术护城河**：实装基于大语言模型的生成式 0-Day 钓鱼欺骗引擎与语义降维密码本。

---

## 二、架构演进 (三大战略支柱)

### 2.1 支柱一：全栈指挥官视窗 (The Commander's HUD UX/UI)
为解决旧有仪表盘带来的“看板综合征”与“操作面板割裂感”，我们将彻底废弃原有的 `[OP 作战]` 遥控面板，界面布局按最高效的“上、中、右”三段式重构：

- **📍 顶部领航域 (The Global Campaign Header)**：贯穿屏幕上方的一条极简进度条 (`[ 🎯 战区锚定 ] ➔ [ 📡 射频嗅探 ] ➔ [ 🔍 脆弱性指纹 ] ➔ [ ⚔️ Alfa 注入 ] ➔ [ 📝 战报生成 ]`)。不仅指示当前战役走到哪一步，点击节点即可触发 AI 接管当前阶段任务，提供极强的线性流程安全感。
- **📍 中部数据海 (The Contextual Data Sandbox & Theater Kanban)**：彻底废弃“发丝球效应”的无序拓扑图，划分为杀伤链四列垂直泳道 (`刚嗅探到/高危暴露面/已拿下据点/核心高价值`)。资产不再是死数据，支持多选框操作 (Checkbox) 与右键微操（如框选两台打着 SMB 端口的 Windows 服务器，右键下发定制化定向爆破），将动作生长在数据上，实现指哪打哪。
- **📍 右翼参谋部 (The AI Copilot Pane)**：保留在界面最右侧的 LYNX 大模型终端面板。中部沙盒产生的所有底层执行（如 Hashcat 破解进度、Playwright 截图回调）均在此面板格式化流式输出。指挥官不再是背手敲代码的键盘侠，而是掌控全局、拥有最终 `[APPROVE]` 审批权的战役统帅。

### 2.2 支柱二：认知图谱与语义爆破 (Cognitive GraphRAG & OSINT)

遵照导师极限裁决，**彻底废弃 Neo4j 等重量级图数据库**。
- **内存拍扁 (NetworkX)**：沿用 SQLite 作为低频写入盘，作战时通过内存拉取节点拓扑，交付给 Gemini 1M 上下文直接进行关系流转挖掘。
- **特定目标凭据降维 (Semantic Profiling)**：针对小区等物理近源环境获取抓包文件后，OSINT 特工利用大模型针对受害地理环境特征生成小于 500 词的高概率定制微型密码字典，秒级穿透 WPA 防线，彻底弃用数十 GB 的机械字典。

### 2.3 支柱三：动态钓鱼生成引擎 (Generative Payload Forge)

超越 Cobalt Strike 固化 Payload 的束缚，引入**生成式零日 UI 欺骗** (Context-Aware Generative UI Spoofing)。
- **实时前端流转**：当 Alfa 网卡被动嗅探到目标手机发向隐形无线网的 Beacon 请教包时（如 probing "Starbucks"），后台 AI 瞬间生成基于 Tailwind 的极高拟真定制 Captive Portal（甚至夹挂当季促销伪装），并在本地通过 Nginx / Python http.server 即时挂载进行凭据盗取。

### 2.4 支柱四：实战级大模型能力融合 (Pragmatic LLM Integration & D14 Combos)

针对 Gemini 3 引擎，我们摒弃全盘科幻，严格按照 D14 学术定调采取以下“四大战斧”进行务实挂载：

1. **组合技：A2UI ✖️ 视觉自我博弈 (Self-Correction)**：
   不再盲目生成代码。AI 生成钓鱼前端后，底层拉起 Playwright 无头截图，利用 Multimodal 将成品喂回大模型进行视觉自纠错验证。最终完美的 0-Day 页面通过 A2UI 在看板渲染验收。
2. **组合技：Deep Research ✖️ 语义驱动降维爆破**：
   引入异步 `deep-research-pro-preview` 智能体作为“情报特工”，扒取目标环境背景 OSINT，生成 <500 词的极致精准定制密码本，交付本地 Hashcat 秒杀无线握手包。
3. **组合技：Structured Output ✖️ 认知图谱蒸馏**：
   废除发散性文字胡言。通过 Pydantic 强制大模型输出 JSON 化的攻击节点列表，完美吻合前端 `TheaterKanban` 的杀伤链渲染逻辑。
4. **原生免杀云沙箱 (Code Execution)**：
   彻底放弃本地静态解析。直接赋予 Gemini 3 `ToolCodeExecution` 权限，令其现场编写 Python 脚本清洗巨量 Nmap XML 脏数据，杜绝长文本截断幻觉。

---

## 三、安全与隔离准则持续演进

1. **G.I. 拦截阀 (HITL Check)**：AI 所有的射频发射动作与生成的大规模钓鱼页面替换，强行通过 MCP `claw_execute_shell` 的审批校验框进行终端二次确认（红色警告）。
2. **Graph Namespace 隔离**：每一个战区 (Theater) 从根本上防止 `COUNT(*)` SQL 越界渗透。

---

**[演进确认区]**
- [x] 确立 Alfa 单兵作战形态
- [x] 整合 Commander's HUD G.I. 前端推演 (Theater Kanban 完成)
- [x] 融入 D13 学术创新三板斧

**[D14 / V9.1 72小时破壁军令状执行结果]**
- [x] **记忆管线重构 (State Continuum)**：鉴于 Google 弃用 Interactions API，已在 `agent_mcp.py` 通过 SQLite `mcp_messages` 表级联，实现了原生的 `types.Content` 无状态会话完美持久化重构。
- [x] **开启 `ToolCodeExecution` 与 `GoogleSearch`**：已成功在底层 SDK 环境挂载内置沙箱代码执行权限并注入了 Google Search 全网实时安全情报雷达（含防审查人格设定）。
- [x] **修复 ReAct API 回合内的 15 步熔断崩溃**：采用早退 Yield 结构与强制纯文本输出指令，彻底解决了 `tools=[]` 参数导致的崩溃假死。
