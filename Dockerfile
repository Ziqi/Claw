# ========== CatTeam 影子军火库 战车底盘 V3.0 ==========
# 基于 V2 (全量工具集 + Impacket)，补装 Nuclei 漏洞扫描器
FROM my-kali-arsenal:v2

ENV DEBIAN_FRONTEND=noninteractive

# 【V3.0 升级装甲】补装 Nuclei Web 漏洞扫描引擎
# 注意: 模板不烧进镜像，运行时通过 Volume 挂载 (枪弹分离)
RUN apt-get update && apt-get install -y nuclei 2>/dev/null \
    || (apt-get install -y golang-go 2>/dev/null && go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest 2>/dev/null && cp ~/go/bin/nuclei /usr/local/bin/ 2>/dev/null) \
    || echo "Nuclei install skipped - install manually if needed"

RUN apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace