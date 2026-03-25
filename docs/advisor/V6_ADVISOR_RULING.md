# Project CLAW — 导师 V6.0 战略批复

**来源：** 导师/教授  
**日期：** 2026-03-25  
**触发文件：** `V5_SESSION_REPORT.md`

---

## 四大战略请示裁决

### 1. C2 框架选型 → ✅ 批准 Sliver

- **选型**：Sliver (Go 语言, 开源, mTLS 加密, 原生免杀)
- **架构红线**：Sliver Server **不能**装进 Docker 战车，必须独立部署
- **CLAW 职责**：通过 06-psexec 或漏洞利用投递 Implant → 目标回连 C2
- **目标杀伤链**：`CLAW 发现破绽 → 自动化投递 → Sliver 接收反弹 Shell`

### 2. BloodHound → ❌ 拒绝 Neo4j，走 AI 图谱推理

- **禁止** Neo4j 进入 CLAW 技术栈（Java，过于臃肿）
- **创新路线**：将 `10-kerberoast.sh` 输出的 JSON ZIP 直接喂给 Lynx (Gemini 1M 上下文)
- **Prompt 范式**：让大模型基于图论推理最短权限提升路径

### 3. Proxychains → ❌ 彻底摒弃，用 Ligolo-ng / Chisel

- **技术缺陷**：不支持 ICMP/UDP，强制降级 SYN→TCP 全连接，拦截不了 Go 二进制
- **V6.0 标准**：`Ligolo-ng` 或 `Chisel` (真实 TUN 网卡隧道)

### 4. Ghidra 固件逆向 → ✅ 鼓励个人研究，但不入主线

- **CLAW 边界**：`21-firmware-autopsy.py` 走到自动解包+提取密钥即可
- **Ghidra/IDA**：属于"独立兵工厂"，手动 GUI 智力博弈，不应自动化

---

## 关于 HP 打印机 (10.130.0.96) 的额外情报

导师提示该设备可能是防守方伪装的**边界跳板机 (Pivot Node)**：
- 8080 端口曾返回 `X-Session-Status: locked`
- 历史上通过投屏器密码本 (`12345678` / `ASCOTT`) 解锁过该代理
- 建议优先复查 8080 代理端口状态

---

*V6.0 开发方向已明确，等待首席工程官排期启动。*
