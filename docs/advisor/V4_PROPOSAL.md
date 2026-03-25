# CatTeam v4.0 演进方案 (第二版 — 供导师评审)

**日期：** 2026-03-25  
**状态：** 已落地 P0/P1 报告与检测模块，余下方向恳请导师指导  

---

## 一、已完成的 v3.x 增量升级

### ✅ 07-report.py (战报自动化) — 已落地

`make report` 自动汇总所有 Loot 数据生成标准化 Markdown 报告：
- 资产侦察总览 + 端口暴露热力榜
- 凭据泄露统计（自动脱敏）
- 横向移动战果汇总
- 风险评级与修复建议（自动根据暴露端口生成）

### ✅ 08-diff.py (资产变化检测) — 已落地

`make diff` 对比最近两次扫描的 `live_assets.json`：
- 🚨 新增主机检测（私接设备/新业务上线）
- 📡 消失主机检测（下线/防火墙拦截）
- 🔄 端口变化检测（悄悄开放的高危端口）
- 输出 `asset_diff.json` 结构化差异报告

### ✅ 导师 V3 Review 两条紧急修复 — 已落地

- OPSEC 凭据泄露：06-psexec 不再接受命令行密码参数
- 僵尸进程：04-phantom --stop 使用 pkill -f 清理 tail 管线

---

## 二、待导师指导的演进方向

### 方向 A：主动/被动双侦察引擎

**现状：** 01-recon 仅支持 L2 被动嗅探，跨网段不可见  

**请导师定夺：**
1. 主动探活引擎选型：`nmap -sn` (ICMP/ARP) vs `masscan` (SYN)？考虑因素：速度、隐蔽性、Docker 兼容性
2. 架构选型：单脚本 `RECON_MODE=passive|active|both` vs 拆成两个脚本 `01a` + `01b`？
3. 02-probe 的输入接口 `targets.txt` 是否能保持不变？

### 方向 B：后渗透战利品提取 (07-loot)

**能力：** 06 横移成功后，对沦陷目标执行 `impacket-secretsdump` 提取 SAM/NTDS 哈希  

**请导师定夺：**
1. secretsdump 威力极大（能 dump 域控完整密码库），是否需要额外的 `--confirm` 人工确认步骤？
2. 提取出的凭据是否应加密存储（如 `gpg -c`）？
3. 除了 secretsdump，`impacket-smbclient` 列举共享目录是否也应纳入自动化？

### 方向 C：MSF Resource Script 自动生成

**构想：** 将 `live_assets.json` 转化为 MSF `.rc` 脚本，自动匹配高危端口到对应 exploit  

**请导师定夺：**
1. 自动化粒度：全自动 `exploit` 还是只到 `.rc` 文件生成 + 人工 review？
2. 端口到 exploit 的映射规则怎么维护？硬编码 dict 还是外部配置文件？
3. 这个模块的优先级如何？是否等 A/B 稳定后再做？

### 方向 D：ROE 白名单子网校验

**方案成熟，可随时落地（~20行代码）：**
```bash
# config.sh
TARGET_SUBNET="10.140.0.0/24"
```
01-recon 提取 IP 后校验是否在授权子网内。

**请导师确认：** 是否需要支持多子网？例如 `10.140.0.0/24,192.168.1.0/24`

### 方向 E：自动化靶场 (make test)

基于导师建议的 Docker Compose 轻量靶场（DVWA + Samba），实现全链路盲打验证。

**请导师指导：** 靶场网络设计——用 Docker 自建 bridge network 还是用 host 模式？需要考虑 CatTeam 的 Docker 战车如何与靶机通信。

---

## 三、战车武器库全量盘点 (v2 = v1 全量 + Impacket)

对 Docker 战车进行了完整扫描（v2 基于 v1 构建，包含 v1 全部工具）：

### 已接入 CatTeam 的工具

| 工具 | 模块 | 用途 |
|---|---|---|
| nmap | 02-probe | 端口扫描 |
| tcpdump | 01-recon (宿主机) | 被动嗅探 |
| httpx | 03-audit | Web 指纹 |
| Impacket smbexec | 06-psexec | 横向移动 |
| Responder | 04-phantom (宿主机) | 投毒 |
| Hashcat | 05-cracker (宿主机) | 离线破解 |

### ⭐ 未利用的高价值工具

| 工具 | 能力 | 融合方向 | 优先级 |
|---|---|---|---|
| **bloodhound-python** | 无需管理员权限画出域信任图 | 独立模块：域侦察 | ⭐⭐⭐⭐⭐ |
| **impacket-secretsdump** | 提取 SAM/NTDS 哈希 | 06 之后：凭据提取 | ⭐⭐⭐⭐⭐ |
| **impacket-GetUserSPNs** | Kerberoast 提取域 Hash | 独立模块→05-cracker | ⭐⭐⭐⭐ |
| **hydra** | SSH/RDP/SMB/Web 在线爆破 | 独立模块 or 03 审计扩展 | ⭐⭐⭐⭐ |
| **nikto** | Web 漏洞自动扫描 | 03-audit 链扩展 | ⭐⭐⭐⭐ |
| **sqlmap** | SQL 注入自动化 | 03-web 发现注入点后调用 | ⭐⭐⭐⭐ |
| **impacket-ntlmrelayx** | NTLM 中继（无需破解） | 替代 04 投毒策略 | ⭐⭐⭐⭐ |
| **evil-winrm** | WinRM 远程 Shell | 替代 smbexec 的备用通道 | ⭐⭐⭐ |
| **proxychains4** | 跳板穿透多层网络 | 06 成功后的纵深扩展 | ⭐⭐⭐ |
| **masscan** | 百倍速度全端口扫描 | 替代/补充 02-probe | ⭐⭐⭐ |
| **msfconsole** | 漏洞利用框架 | .rc 脚本自动生成 | ⭐⭐⭐ |
| **john** | 密码破解（补充 hashcat） | 05-cracker 备用 | ⭐⭐ |
| **ettercap** | ARP 欺骗/中间人 | 高级嗅探场景 | ⭐⭐ |

### 其他已确认可用

Python 库: scapy, requests, paramiko, ldap3, cryptography, netaddr  
字典: rockyou.txt.gz, dirb, wfuzz, metasploit 内置  
网络: tshark, dsniff, arp-scan, fping, hping3, socat, netcat

---

## 四、新增演进方向（追加导师问题）

### 方向 F：AD 域攻击链 (bloodhound → Kerberoast)

**构想：** 在 06 横移成功后或独立运行，用 `bloodhound-python` 收集域信息，再用 `GetUserSPNs` 做 Kerberoast 提取 Hash 喂给 05-cracker。

这条链的意义是**从"打单机"升级到"打整个域"**。

```
bloodhound-python → 域关系图
GetUserSPNs → Kerberos Hash → 05-cracker → 域管密码
```

**请导师定夺：**
1. AD 域攻击在当前靶场环境中是否现实？（需要有 Windows AD 域控）
2. bloodhound 的数据量很大，是否需要单独的可视化方案？

### 方向 G：Web 漏洞自动化链 (nikto → sqlmap)

**构想：** 在 03-audit 识别出 Web 服务后，自动调用 nikto 扫漏洞 + sqlmap 测注入。

```
03-audit (识别 Web) → nikto (扫漏洞) → sqlmap (验证注入)
```

**请导师定夺：**
1. Web 攻击面和 SMB 攻击面是两条独立杀伤链，导师建议先深耕哪条？
2. sqlmap 自动化程度：`--batch` 全自动还是交互式确认？

### 方向 H：在线密码爆破 (hydra)

**与 hashcat 的区别：** hashcat 需要先抓 Hash 再离线破解；hydra 直接对登录接口进行在线字典攻击（SSH/RDP/SMB/Web 表单）。

**请导师确认：** 在线爆破的流量特征极其明显，是否只在 CTF 靶场中使用？

### 方向 I：跳板穿透 (proxychains + 二层渗透)

**构想：** 06 拿下一台跳板后，通过 `proxychains4` 让所有工具透过跳板打第二层网络。

**请导师指导：** 这涉及整个数据流重新设计——01~06 需要支持 "通过代理执行" 模式。是否值得在 v4.0 引入？

### 方向 J：工具选型哲学

**请导师指导：** 战车里有 100+ 工具，但我们只接入了 6 个。导师认为是：
- **少而精**：每个都深度自动化（当前路线）
- **多而广**：提供工具箱让操作员按需调用
- **混合**：核心链自动化 + 其余提供 `make toolbox` 快捷入口

---

## 五、更新后的路线图

```
v3.1 (已完成)   07-report + 08-diff + OPSEC/僵尸修复
v3.2 (本周)     D 白名单 ROE
v4.0 (下周)     导师选定方向 (A/B/C/F/G/H/I)
v4.1 (后续)     E make test 靶场 + SQLite
```

---

## 六、当前完整模块清单 (v3.1)

```
侦察链:  00-armory → 01-recon → 02-probe → 02.5-parse
                                                │
审计层:                   03-audit / 03-web ←───┤
                                                │
攻击链:            04-phantom → 05-cracker → 06-psexec
                                                │
情报层:                          07-report / 08-diff
```

---

*恳请导师审阅并指导 A~J 方向的优先级与架构选型。*

