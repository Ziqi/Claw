# Nuclei 模板目录

此目录用于存放 Nuclei 漏洞扫描模板（枪弹分离架构）。

## 初始化

```bash
# 首次使用，下载官方模板库
nuclei -update-templates

# 或直接 clone
git clone https://github.com/projectdiscovery/nuclei-templates.git .
```

## 原理

模板不烧进 Docker 镜像，而是通过 Volume 挂载：
```bash
docker run -v "$(pwd)/nuclei-templates:/root/nuclei-templates" ...
```

这样模板随时可通过 `git pull` 秒级更新，无需重建镜像。
