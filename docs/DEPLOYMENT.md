# CLAW 部署架构迁移指南

**版本**：V9.3 规划
**最后更新**：2026-03-29
**目的**：记录三种部署方案的详细步骤，指导将 CLAW 从 MacBook Air + Docker 架构迁移至 Kali 原生环境。

---

## 1. 部署架构演进路线

```
V5-V8 (历史)        V9.2 (当前)          V9.3 (近期目标)      终极形态
┌──────────┐       ┌──────────────┐      ┌──────────────┐     ┌──────────────┐
│ Mac 本地  │       │ Mac 宿主机    │      │ Mac (仅浏览器) │     │ Kali 物理机   │
│ + Docker  │  ──→  │ + Kali VM    │ ──→  │ + Kali VM    │ ──→ │ (一体化全栈) │
│ 容器      │       │ + Docker(闲) │      │ (前后端全入VM) │     │ 无虚拟机开销 │
└──────────┘       └──────────────┘      └──────────────┘     └──────────────┘
```

---

## 2. 方案 A：短期优化（当前 Mac + Kali VM 架构改良）

### 2.1 核心改动：将前后端都搬入 Kali VM

**改动前**：
```
Mac 宿主机                    Kali VM
├── 后端 (uvicorn :8000)      ├── ALFA 网卡
├── 前端 (vite :5173)         ├── airodump-ng
└── 浏览器                    └── claw_wifi_sensor.py
                                   ↓ POST 跨网络
                                   → Mac:8000
```

**改动后**：
```
Mac 宿主机                    Kali VM
├── 浏览器                    ├── 后端 (uvicorn :8000)    ← 搬入
│    ↓ 访问 VM:5173           ├── 前端 (vite :5173)      ← 搬入
└── Claude Code / Antigravity ├── ALFA 网卡
                              ├── airodump-ng  
                              ├── claw_wifi_sensor.py
                              │    ↓ POST localhost:8000  ← 本地直连！
                              ├── Nmap / Nuclei / Hydra   ← 原生，无需 Docker
                              └── Wireshark / tshark      ← 原生 GUI
```

### 2.2 Kali VM 环境搭建步骤

#### Step 1：确认 VM 网络模式

```bash
# 在 Kali VM 中检查 IP
ip addr show

# 推荐使用桥接模式 (Bridged)
# 这样 VM 和 Mac 在同一个局域网，浏览器可通过 IP 直接访问
```

#### Step 2：安装 Python 依赖

```bash
# Kali 自带 Python 3，但需安装 pip 和项目依赖
sudo apt update
sudo apt install -y python3-pip python3-venv git

# 克隆代码仓库
git clone <YOUR_REPO_URL> ~/CatTeam
cd ~/CatTeam

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

# 安装后端依赖
pip install fastapi uvicorn[standard] aiofiles google-genai pydantic
```

#### Step 3：安装 Node.js 和前端依赖

```bash
# Kali 上安装 Node.js (推荐 v18+)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo bash -
sudo apt install -y nodejs

# 安装前端依赖
cd ~/CatTeam/frontend
npm install
```

#### Step 4：配置环境变量

```bash
# 在 ~/.bashrc 或 ~/.zshrc 中添加
export GEMINI_API_KEY="your-gemini-api-key"
export CLAW_SENSOR_TOKEN="claw-sensor-2026"

# 使其生效
source ~/.bashrc
```

#### Step 5：启动服务

```bash
# 终端 1：启动后端
cd ~/CatTeam
source venv/bin/activate
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

# 终端 2：启动前端 (需要绑定 0.0.0.0 让 Mac 可访问)
cd ~/CatTeam/frontend
npx vite --host 0.0.0.0 --port 5173
```

#### Step 6：在 Mac 浏览器中访问

```
http://<KALI_VM_IP>:5173
```

#### Step 7：启动 ALFA 探针（不再需要跨网络）

```bash
# 终端 3：开启监听模式
sudo airmon-ng check kill
sudo airmon-ng start wlan0

# 终端 4：启动 airodump
sudo airodump-ng wlan0mon --write-interval 3 --output-format csv -w /tmp/target_recon

# 终端 5：启动探针（现在是 localhost 直连！）
cd ~/CatTeam
python3 CatTeam_Loot/claw_wifi_sensor.py \
    --csv /tmp/target_recon-01.csv \
    --mothership http://localhost:8000 \
    --interval 3
```

### 2.3 方案 A 的优势

- ✅ **零成本**：不需要购买新硬件
- ✅ **探针本地直连**：不再需要跨网络 POST，延迟从 ~50ms 降到 <1ms
- ✅ **武器库原生**：Kali 预装 600+ 安全工具，Docker 完全退役
- ✅ **Wireshark 原生**：VM 窗口直接打开 GUI
- ✅ **Mac 专注 AI 编程**：Claude Code / Antigravity 不受影响

### 2.4 方案 A 的 MCP 工具适配

将 `claw_execute_shell` 从 Docker 调用改为本地调用：

```python
# mcp_armory_server.py — 修改前
proc = subprocess.Popen(command, shell=True, cwd="/path/to/CatTeam", ...)

# 修改后（已在 Kali 本地，无需变化！直接执行即可）
# 原来需要 docker exec 的，现在直接本地跑
proc = subprocess.Popen(command, shell=True, cwd="/root/CatTeam", ...)
```

---

## 3. 方案 B：中期升级（保留 VM，但增加 Claude Code）

在方案 A 的基础上，在 Kali VM 中安装 Claude Code：

```bash
# 安装 Claude Code
npm install -g @anthropic-ai/claude-code

# 设置 API Key
export ANTHROPIC_API_KEY="your-anthropic-key"

# 在项目目录中启动
cd ~/CatTeam
claude
```

### 双 AI 协作架构

```
Mac 宿主机                    Kali VM
├── Antigravity (Gemini)      ├── Claude Code (Anthropic)
│   架构设计 / 文档生成        │   底层代码 / 漏洞分析
│   Web UI 开发               │   Shell 脚本 / 安全审计
└── 浏览器 → VM:5173          └── CLAW 全栈 + 武器库
```

---

## 4. 方案 C：终极形态（Kali 物理机一体化）

### 4.1 推荐硬件配置

| 组件 | 推荐配置 | 理由 | 预算 |
|---|---|---|---|
| CPU | Intel i5-12400 / AMD Ryzen 5 | 足够跑 Nmap + Python | ¥800 二手 |
| 内存 | 16GB DDR4 | Hashcat + 多工具并发 | ¥200 |
| GPU | NVIDIA GTX 1660 Super | Hashcat GPU 加速 100x | ¥800 二手 |
| 硬盘 | 256GB NVMe SSD | Kali 系统 + 工具 + 数据 | ¥150 |
| 网卡 | 板载千兆 + ALFA USB | 有线管理 + 无线攻击 | 已有 |
| 总计 | | | **~¥2000-3000** |

### 4.2 系统安装

```bash
# 1. 下载 Kali Linux ISO
# https://www.kali.org/get-kali/#kali-installer-images

# 2. 制作 USB 启动盘
# 用 Rufus (Windows) 或 dd (Mac/Linux) 写入 USB

# 3. 从 USB 启动安装 Kali Linux
# 选择 "Graphical Install" → 全盘安装 → 设置用户名密码

# 4. 安装后更新
sudo apt update && sudo apt upgrade -y

# 5. 安装 NVIDIA 驱动 (GPU Hashcat 必需)
sudo apt install -y nvidia-driver nvidia-cuda-toolkit

# 6. 验证 GPU
nvidia-smi
hashcat -b  # GPU 基准测试
```

### 4.3 CLAW 部署

```bash
# 1. 安装项目依赖
sudo apt install -y python3-pip python3-venv nodejs npm git

# 2. 克隆仓库
git clone <YOUR_REPO_URL> ~/CatTeam
cd ~/CatTeam

# 3. Python 虚拟环境
python3 -m venv venv
source venv/bin/activate
pip install fastapi uvicorn[standard] aiofiles google-genai pydantic

# 4. 前端依赖
cd frontend && npm install && cd ..

# 5. 环境变量
echo 'export GEMINI_API_KEY="your-key"' >> ~/.bashrc
echo 'export CLAW_SENSOR_TOKEN="claw-sensor-2026"' >> ~/.bashrc
source ~/.bashrc

# 6. 启动 (推荐用 tmux 管理多终端)
sudo apt install -y tmux
tmux new-session -s claw

# 窗口 0：后端
uvicorn backend.main:app --host 0.0.0.0 --port 8000

# Ctrl+B C 新建窗口 1：前端
cd frontend && npx vite --host 0.0.0.0 --port 5173

# Ctrl+B C 新建窗口 2：打开浏览器
firefox http://localhost:5173 &
```

### 4.4 方案 C 的独特优势

- ✅ **GPU Hashcat**：破解 WPA 握手包速度从 CPU 的 ~500 H/s 飙升到 GPU 的 ~50,000 H/s（100 倍）
- ✅ **零虚拟化开销**：所有 CPU/内存/网络性能 100% 直达
- ✅ **ALFA 即插即用**：无需 USB 直通配置
- ✅ **L2 嗅探原生**：ARP 投毒、MITM 等物理层攻击无障碍
- ✅ **远程管理**：从 Mac SSH 连入，或者通过浏览器远程访问大屏

### 4.5 Mac 远程控制方案

```bash
# 在 Kali 物理机上开启 SSH
sudo systemctl enable ssh
sudo systemctl start ssh

# 从 Mac 远程连入
ssh kali@<KALI_PHYSICAL_IP>

# 从 Mac 浏览器远程访问 CLAW 大屏
# 打开 http://<KALI_PHYSICAL_IP>:5173
```

---

## 5. Docker 退役状态 (已完成 2026-03-31)

Docker 容器已正式退役，以下步骤均已完成：

```bash
# 已执行操作：
# 1. docker system prune -a --volumes (释放 4.57 GB)
# 2. Docker Desktop 已从 Mac 卸载
# 3. Dockerfile 已从项目中删除
# 4. tests/docker-compose.yml 已从项目中删除
# 5. 前端 VIEW_TABS 中的 Docker 标签页已移除
# 6. 后端 /api/v1/docker/* 端点已于 V9.3 Final Purge 中物理删除
```

**当前架构**：所有工具执行通过 MCP -> SSH -> Kali VM，完全不经过 Docker。

---

## 6. 安全注意事项

> ⚠️ **重要安全提醒**

1. **Gemini API Key**：不要硬编码在代码中。使用环境变量 `GEMINI_API_KEY`。
2. **SENSOR_TOKEN**：生产环境应更换为强随机字符串，不要使用默认值。
3. **SSH 密钥认证**：Kali 物理机的 SSH 应使用密钥而非密码登录。
4. **防火墙**：Kali 的 8000/5173 端口只需局域网可达，不要暴露到公网。
5. **VPN/Tor**：执行 OSINT 或外网扫描时，使用 VPN 隐藏真实 IP。

```bash
# 生成 SSH 密钥对 (在 Mac 上)
ssh-keygen -t ed25519 -C "claw-admin"
ssh-copy-id -i ~/.ssh/id_ed25519.pub kali@<KALI_IP>

# 开启 Kali 防火墙
sudo ufw enable
sudo ufw allow from 192.168.0.0/16 to any port 8000
sudo ufw allow from 192.168.0.0/16 to any port 5173
sudo ufw allow ssh
```
