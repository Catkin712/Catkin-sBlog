# Catkin's Blog 
基于 Astro 7 搭建的轻量化个人内容站，内容待定

## 🔗 在线访问
站点地址：https://catkinsblog.pages.dev/
托管平台：Cloudflare Pages

<!-- ## 🎯 项目优势
1. 纯静态站点，加载速度极快，无冗余 JavaScript
2. Markdown 原生支持，写作简单，专注内容阅读
3. 代码变更通过 Cloudflare Pages 部署，文章更新通过 Pages Functions 运行时读取 GitHub 生效
4. 结构轻量化，布局、组件可自由自定义修改
5. TypeScript 类型约束，代码规范易维护 -->

## 技术栈
- 核心框架：Astro v7.0.3
- 语言：TypeScript
- 样式：原生 CSS
- 部署模式：Cloudflare Pages 静态资源 + Pages Functions
- 包管理：npm
- 代码托管：GitHub
- 线上部署：Cloudflare Pages

## 内容管理
文章存放在 `src/content/posts`，并由 `src/content.config.ts` 统一校验 frontmatter。

## 本地写作后台
```bash
npm run admin
```

打开 `http://127.0.0.1:8787` 后，可以新建或编辑 Markdown 文章。保存草稿会写入 `draft: true`，发布会写入 `draft: false`。

后台登录支持环境变量 `ADMIN_USERNAME`、`ADMIN_PASSWORD`、`ADMIN_EXTRA_USERS` 和 `ADMIN_SESSION_SECRET`。本地开发未配置环境变量时，会使用 `catkin` / `catkin123` 作为开发默认账号；Cloudflare Pages 线上环境必须显式配置账号密码，不会使用开发默认账号。`ADMIN_EXTRA_USERS` 使用 `username:password` 格式，多个账号用英文逗号或换行分隔。
本地开发可以直接写入 `.env.local`，`npm run admin` 会自动读取。
如果要本地预览 Cloudflare Pages Functions，请把同样的变量写入 `.dev.vars`，然后运行 `npm run pages:dev`。

## Cloudflare Pages 部署
后台和动态文章页面已拆为 Cloudflare Pages Functions，线上入口为 `/admin`，API 路由为 `/api/login`、`/api/logout`、`/api/posts`、`/api/posts/:slug` 和 `/api/build`。

博客前台已改为 Pages Functions 运行时读取 GitHub 文章。保存文章会通过 GitHub Contents API 提交到仓库，首页、文章页、归档、标签、搜索和 RSS 会在运行时读取最新内容，不需要每次发文后重新部署。

Cloudflare Pages 项目配置：

- Framework preset：`Astro`
- Build command：`npm run build`
- Build output directory：`dist`
- Functions directory：保持默认，项目根目录的 `functions`
- Node.js version：`22.12.0` 或更高

需要在 Cloudflare Pages 的 Environment variables 中配置：

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_EXTRA_USERS`，用于第二套及更多账号，例如 `username:password`
- `ADMIN_SESSION_SECRET`
- `GITHUB_TOKEN`
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_BRANCH`，默认 `main`

`GITHUB_TOKEN` 需要有目标仓库 contents 读写权限。

Cloudflare Pages 只需要在代码结构或依赖变化时重新部署。后台新增或修改文章后，函数会直接读取 GitHub 最新内容，不需要触发部署。

## 本地开发运行
环境要求：Node.js 22.12.0 及以上版本
```bash
# 1. 克隆项目到本地
git clone https://github.com/Catkin712/AstroBlogTest.git
cd Catkin'sBlog

# 2. 安装全部依赖
npm install

# 3. 启动 Astro 静态页面开发服务（访问 http://localhost:4321）
npm run dev

# 4. 预览 Cloudflare Pages + Functions（需要 .dev.vars）
npm run pages:dev

# 5. 打包生产静态资源
npm run build

# 6. 本地预览 Astro 静态产物
npm run preview
```
