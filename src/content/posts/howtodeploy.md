---
title: "【自用】如何将本地代码部署至服务器"
pubDate: 2026-07-18
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

### 在本地项目目录打包：
`cd E:\Catkin-sBlog\Catkin-sBlog`

`npm run build`

`tar --exclude=node_modules --exclude=.git --exclude=catkinsblog-vps.tar.gz -czf catkinsblog-vps.tar.gz .`

`scp -P 22333 .\catkinsblog-vps.tar.gz catkin@123.99.201.167:/var/www/catkinsblog/`

### 服务器登录
`ssh -p [端口] catkin@ip`

### 服务器上执行
`cd /var/www/catkinsblog`

`tar -xzf catkinsblog-vps.tar.gz`

`npm install`

`npm run build`

`pm2 restart catkinsblog`
