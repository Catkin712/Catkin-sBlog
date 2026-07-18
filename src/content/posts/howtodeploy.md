---
title: "【自用】连接服务器并使用脚本本地打包与部署"
pubDate: 2026-07-19
description: "备忘"
author: "catkin"
category: "web"
image:
    url: "/covers/howtodeploy.png"
    alt: "【自用】如何将本地代码部署至服务器"
tags: ["web","服务器"]
featured: false
draft: false
---

### 配置SSH免密登录

生成本机 SSH 密钥：

```powershell
ssh-keygen -t ed25519 -C "catkinsblog-vps"
```

把公钥写入服务器：

```powershell
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh -p 22333 catkin@123.99.201.167 "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys"
```

测试是否免密成功：

```powershell
ssh -p 22333 catkin@123.99.201.167
```

输入 `exit` 退出服务器。

### 配置 SSH 别名，从而运行上传脚本
打开 SSH 配置文件：

```powershell
notepad $env:USERPROFILE\.ssh\config
```

加入：

```sshconfig
Host catkinblog
    HostName 123.99.201.167
    User catkin
    Port 22333
    IdentityFile ~/.ssh/id_ed25519
```

自此，登录可用：

```powershell
ssh catkinblog
```

成功后输入 `exit` 退出。

### 自此，一键部署

在项目根目录执行：

```powershell
npm run deploy:vps
```

脚本会自动完成：

```text
测试 SSH -> 本地构建 -> 打包 -> 上传 -> 服务器解压 -> npm install -> npm run build -> pm2 restart/save
```

部署成功后访问：

```text
http://123.99.201.167:8888/
```

### 坑(因为我踩过了

如果 `npm run deploy:vps` 卡在 SSH：

```powershell
ssh catkinblog
```

先确认别名和免密登录是否正常。

如果部署后网站还是旧内容：

```bash
cd /var/www/catkinsblog
pm2 restart catkinsblog
```

如果服务器重启后网站打不开：

```bash
pm2 status
pm2 startup
pm2 save
```

`pm2 startup` 会输出一条 `sudo env ...` 命令，需要复制并执行一次。
