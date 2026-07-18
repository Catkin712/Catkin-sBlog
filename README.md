# Catkin's Blog

Catkin's Blog 是一个基于 Astro 7 的个人博客项目。当前线上部署方式是 VPS 自托管：Astro 负责构建静态资源，`server.mjs` 在 Node.js 中运行原 `functions` 目录里的动态页面和后台 API，Nginx 对外提供访问并反向代理到 Node 服务。

## 在线访问

当前 VPS 访问地址：

```text
http://123.99.201.167:8888/
```

后台入口：

```text
http://123.99.201.167:8888/admin
```

说明：服务器的 `80/8080` 端口可能被服务商策略拦截，目前使用 `8888` 作为对外访问端口。

## 技术栈

- Astro 7：构建静态页面和静态资源
- Node.js：运行 `server.mjs`，承接动态路由和后台 API
- Nginx：反向代理到 `127.0.0.1:3000`
- PM2：保持 Node 服务常驻运行
- Preact：前端交互组件
- Markdown：文章内容格式
- KaTeX：数学公式渲染
- GitHub Contents API：运行时读取和写入文章

## 当前架构

项目分成两部分：

- `dist` 和 `public`：静态资源，由 Astro 构建或直接提供
- `functions`：动态页面、文章列表、文章详情、分类、标签、RSS、搜索、后台登录和文章保存 API

VPS 上的访问链路：

```text
浏览器 -> Nginx :8888 -> Node server.mjs :3000 -> functions / static files
```

`server.mjs` 会先查找静态文件；如果没有命中，再把请求交给对应的 `functions` 路由。

## 目录说明

```text
src/
  pages/              Astro 静态页面，目前主要保留 about 页面
  content/posts/      本地文章源文件
  components/         Astro / Preact 组件
  layouts/            页面布局
  style/              全局样式
  script/             前端脚本
functions/
  _shared/            博客渲染、GitHub 读写、后台鉴权等公共逻辑
  api/                后台登录、文章读取和写入 API
  posts/              文章详情动态路由
  tags/               标签动态路由
  categories/         分类动态路由
  archive/            归档页
public/               头像、封面、favicon、全站 CSS/JS 等静态资源
scripts/
  deploy-vps.ps1      Windows 下一键部署到 VPS 的脚本
server.mjs            VPS 上的 Node 运行入口
DEPLOY_VPS.md         VPS 部署说明
```

## 内容管理

文章 Markdown 文件位于：

```text
src/content/posts
```

线上页面运行时会通过 GitHub Contents API 读取仓库中的最新文章。后台保存草稿或发布文章时，也会通过 GitHub Contents API 写回仓库。

后台支持：

- 登录 / 退出
- 文章列表加载
- 文章详情加载
- 新建文章
- 保存草稿
- 发布文章
- 上传封面并写入 `public/covers`
- 精选文章标记
- Markdown 预览和数学公式渲染

## 环境变量

VPS 项目目录 `/var/www/catkinsblog` 下需要有 `.env`：

```env
HOST=127.0.0.1
PORT=3000
ADMIN_USERNAME=catkin
ADMIN_PASSWORD=你的后台密码
ADMIN_SESSION_SECRET=一长串随机字符
GITHUB_TOKEN=你的GitHubToken
GITHUB_OWNER=Catkin712
GITHUB_REPO=AstroBlogTest
GITHUB_BRANCH=main
```

注意：

- `GITHUB_TOKEN` 需要有目标仓库 contents 读写权限
- 不要把 `.env` 提交到 GitHub
- 如果重新生成了 GitHub Token，需要更新服务器 `.env` 并执行 `pm2 restart catkinsblog`

## 本地开发

环境要求：

- Node.js 22.12.0 或更高版本
- npm

安装依赖：

```bash
npm install
```

启动 Astro 开发服务：

```bash
npm run dev
```

构建静态资源：

```bash
npm run build
```

本地运行 VPS 版本服务：

```bash
npm run build
npm run start
```

默认访问：

```text
http://127.0.0.1:3000/
```

如果本地也需要完整测试后台 GitHub 读写，请在项目根目录创建 `.env.local`，内容与服务器 `.env` 类似。

## 部署方式

当前推荐使用一键部署脚本：

```powershell
npm run deploy:vps
```

这个脚本会自动完成：

```text
测试 SSH -> 本地构建 -> 打包 -> 上传 -> 服务器解压 -> npm install -> npm run build -> pm2 restart/save
```

脚本默认使用 SSH 别名：

```text
catkinblog
```

## 在新电脑上部署到 VPS

项目代码由 GitHub 托管。换一台电脑后，需要先把项目拉到本地，再配置 SSH 免密和 `catkinblog` 别名，之后就可以用一键部署脚本发布到服务器。

### 1. 准备本地环境

新电脑需要先安装：

- Git
- Node.js 22.12.0 或更高版本
- Windows PowerShell
- OpenSSH 客户端

检查命令：

```powershell
git --version
node -v
npm -v
ssh -V
```

### 2. 克隆项目

```powershell
cd E:\
git clone https://github.com/Catkin712/AstroBlogTest.git Catkin-sBlog
cd E:\Catkin-sBlog
npm install
```

如果项目实际目录名不同，以本地克隆后的目录为准。

### 3. 配置 SSH 免密登录

生成本机 SSH 密钥：

```powershell
ssh-keygen -t ed25519 -C "catkinsblog-vps"
```

一路回车即可。如果已经有 `id_ed25519`，可以复用已有密钥。

把公钥写入服务器：

```powershell
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh -p 22333 catkin@123.99.201.167 "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys"
```

测试是否免密成功：

```powershell
ssh -p 22333 catkin@123.99.201.167
```

如果不再要求输入密码，就说明成功。输入 `exit` 退出服务器。

### 4. 配置 SSH 别名

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

测试别名：

```powershell
ssh catkinblog
```

成功后输入 `exit` 退出。

### 5. 一键部署

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

### 6. 服务器端要求

服务器需要提前准备好：

- 项目目录：`/var/www/catkinsblog`
- Node.js 22.12.0 或更高版本
- npm
- pm2
- Nginx 反向代理到 `127.0.0.1:3000`
- Nginx 当前对外端口：`8888`
- 服务商防火墙/安全组放行 `8888`

服务器项目目录里需要有 `.env`，并配置：

```env
HOST=127.0.0.1
PORT=3000
ADMIN_USERNAME=catkin
ADMIN_PASSWORD=你的后台密码
ADMIN_SESSION_SECRET=一长串随机字符
GITHUB_TOKEN=你的GitHubToken
GITHUB_OWNER=Catkin712
GITHUB_REPO=AstroBlogTest
GITHUB_BRANCH=main
```

不要把 `.env` 提交到 GitHub。

### 7. 常见问题

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
