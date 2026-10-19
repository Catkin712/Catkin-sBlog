# 迁移到 Netlify

本文对应 2026-10 的迁移：把原先跑在 VPS 上的 Catkin's Blog 迁移到 Netlify。代码已经改好，剩下的步骤需要 Netlify 账号、域名 DNS 和腾讯云 COS 控制台权限。

## 1. 迁移后的结构

```text
浏览器
  ├─ 静态文件（about、CSS、JS、封面图）──> Netlify CDN（dist/）
  └─ 动态页面 / API ─────────────────────> Netlify Function: netlify/functions/server.mjs
                                              ├─ SQLite 数据库快照 ──> Netlify Blobs
                                              ├─ 上传会话 ───────────> Netlify Blobs
                                              ├─ 访客计数 ───────────> Netlify Blobs
                                              └─ 图片/封面/相册 ─────> 腾讯云 COS（私有桶 + 临时签名 URL）
```

和 VPS 版本的区别：

- 不再有常驻 Node 进程；所有动态请求走一个 Netlify Function。
- SQLite 文件不再放在服务器磁盘，而是以快照形式放在 Netlify Blobs：每个写请求会加分布式锁，写入后把整个数据库快照写回 Blobs。
- 相册上传会话、访客计数也从进程内存 / 本地文件改到 Netlify Blobs。
- 文章、相册、评论、点赞、留言、后台编辑功能都保留。
- 种子数据库已加密后放进仓库；首次读取时用 `ADMIN_SESSION_SECRET` 解密。之后一旦有写操作，数据就以 Blobs 中的数据库为准，重新部署不会覆盖线上数据。

## 2. 我已经完成的部分

- 新增 `netlify/functions/server.mjs`：Netlify Functions v2 入口，`path = "/*"`、`preferStatic = true`，静态文件优先，动态请求交给原站点路由。
- 新增 `netlify/lib/runtime.mjs`：Blobs 数据库读写、版本检查、写锁、种子解密、`/uploads` 临时目录。
- 把 `server.mjs` 拆成 `server-core.mjs`（纯路由，静态 import 所有处理函数）+ `server.mjs`（本地 Node HTTP 外壳）。原因是 Netlify 的函数打包器无法可靠追踪原来按运行时路径 `import()` 的路由。
- 新增 `netlify.toml`、`netlify/seed/catkinsblog.sqlite.enc`、`netlify/seed/uploads/`。
- 留言板从 `data/guestbook.json` 迁移到 SQLite 的 `guestbook_messages` 表；种子库已导入 22 条留言。
- 相册上传会话支持 Blobs，跨 Lambda 实例也能完成“创建会话 → 直传 COS → 完成”的流程。
- 访客计数在 Netlify 上使用 Blobs 计数器，不再触发数据库写锁。
- 最后一个 `inner-albums` 本地图片已迁移到 COS，仓库里不再有私密相册原图。
- 新增迁移/测试/备份脚本（见第 6 节）。
- 本地已验证：主页、文章、归档、标签、分类、相册、留言板、RSS、搜索、后台登录、文章保存、点赞/评论、加密种子启动、跨进程持久化；`netlify build` 打包成功。

## 3. 你需要完成的操作

### 3.1 推送代码到 GitHub

当前本地 `main` 和远程 `AstroTest/main` 已经分叉（远程有一个同名但内容不同的提交）。为了不动远程 `main`，迁移代码已经放在一个独立的快照分支 `netlify-migration` 上，推荐直接推这个分支并在 Netlify 里选它：

```powershell
cd "D:\Catkin'sBlog"
git push -u AstroTest netlify-migration
```

然后在 Netlify 导入仓库时，把 **Branch to deploy** 选为 `netlify-migration`。

如果你想继续用 `main`，需要先合并/变基远程 `AstroTest/main`，解决冲突后再推；不要直接 `git push --force`，远程 `main` 上还有别的提交。

公开仓库也不要提交 `.env`、`.env.local`、`netlify/seed/catkinsblog.sqlite`；这些已经在 `.gitignore` 里。仓库中只有加密后的 `catkinsblog.sqlite.enc` 和公开的 `netlify/seed/uploads/`。

### 3.2 在 Netlify 创建站点

1. 登录 <https://app.netlify.com/>。
2. **Add new site → Import an existing project → GitHub**，选择上面的仓库。
3. 构建设置会自动读取 `netlify.toml`：
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
4. 先不要改构建命令。

### 3.3 配置环境变量

在 **Site configuration → Environment variables** 逐项添加。值从 VPS 的 `/var/www/catkinsblog/.env` 复制（`ssh catkinblog` 后 `cat /var/www/catkinsblog/.env`）。

| 变量 | 必需 | 说明 |
| --- | --- | --- |
| `ADMIN_USERNAME` | 是 | 后台用户名 |
| `ADMIN_PASSWORD` | 是 | 后台密码 |
| `ADMIN_SESSION_SECRET` | 是 | **必须与 VPS 上的值完全一致**，种子数据库用它派生解密密钥 |
| `ADMIN_EXTRA_USERS` | 否 | 额外账号，格式 `user:password,user2:password2` |
| `COS_SECRET_ID` | 是 | 腾讯云 CAM SecretId |
| `COS_SECRET_KEY` | 是 | 腾讯云 CAM SecretKey |
| `COS_BUCKET` | 是 | 含 APPID 的桶名 |
| `COS_REGION` | 是 | 例如 `ap-guangzhou` |
| `COS_UPLOAD_URL_TTL_SECONDS` | 否 | 默认 600 |
| `COS_READ_URL_TTL_SECONDS` | 否 | 默认 600 |
| `ALBUM_INNER_PASSWORD` | 建议 | “里图”相册密码；VPS 未显式设置时默认是 `妄想清高` |
| `ALBUM_MODE_SESSION_SECRET` | 建议 | 独立随机长字符串，用于签里图会话 Cookie |
| `SITE_VISITOR_SEED` | 否 | 访客初始值，默认 `8042` |
| `AWS_LAMBDA_JS_RUNTIME` | 建议 | 设为 `nodejs24.x`，确保 Functions 运行时带 `node:sqlite` |

不要设置 `BLOG_DB_FILE`、`ALBUM_DATA_DIR`、`UPLOADS_DIR`、`SQLITE_JOURNAL_MODE`、`CATKINS_USE_BLOBS`；函数运行时会自动设置。

如果之后修改了 `ADMIN_SESSION_SECRET`，需要重新加密种子库，否则首次读取会解密失败：

```powershell
$env:ADMIN_SESSION_SECRET="新的值"
npm run netlify:encrypt-seed
```

### 3.4 部署并验收

点击 **Deploy site**。首次部署后：

1. 打开 `https://<随机名>.netlify.app/`，确认首页、文章、相册能打开。
2. 打开 `/admin` 登录，新建一篇测试文章并保存；再打开该文章，确认写入成功。
3. 在文章页点赞、评论；在留言板发一条留言。
4. 进入 `/album/?view=inner`，输入里图密码，确认私密相册可见。
5. 上传一张小图片到相册，确认“创建会话 → 直传 COS → 完成”整个流程成功。
6. 删除测试文章/图片（后台支持的话），避免污染线上数据。

> 注意：第一次**写**操作才会把种子数据库写进 Netlify Blobs。只有读请求时，函数每次冷启动都会重新解密种子库；这是正常的。

### 3.5 绑定域名

在 Netlify **Domain management** 添加：

- `www.catkins.vip`（主域名）
- `catkins.vip`（建议 301 到 www）

然后在 Cloudflare DNS 里：

- `www`：CNAME 到 `<site>.netlify.app`，**代理状态设为 DNS only（灰云）**。
- 根域 `catkins.vip`：A 记录 `75.2.60.5`，或使用 Cloudflare 的 CNAME flattening / ALIAS 指向 Netlify。
- 删除旧的 Cloudflare Tunnel / `upload.catkins.vip` 记录和 Origin Rule（如果还指向 VPS 的 8889 端口）。
- 等 Netlify 自动签发 Let's Encrypt 证书。

如果继续让 Cloudflare 代理（橙云），需要把 SSL/TLS 设为 Full (strict)，并确认 Netlify 证书已生效；否则容易出现重定向循环。

### 3.6 腾讯云 COS CORS

浏览器直传 COS 依赖 CORS。进入 COS 桶 **安全管理 → 跨域访问 CORS**，在原有 `https://www.catkins.vip, https://catkins.vip` 之外，增加：

```text
https://<site>.netlify.app
```

方法 `PUT, GET, HEAD, DELETE`，Header `*`，Expose `ETag, x-cos-request-id`，Max age 600。绑定自定义域名后可以保留 Netlify 域名，方便以后预览部署。

## 4. 数据与备份

迁移时从 VPS 导出的数据：

- 52 篇文章
- 10 个相册、175 张照片（其中 92 张里图）
- 22 条留言
- 8,042 个访客记录
- 8 个文章点赞、3 条文章评论、相册点赞/评论若干

线上数据在 Netlify Blobs 的 `catkinsblog-database` store 的 `catkinsblog.sqlite` key 中。**Netlify Blobs 不是备份**，建议定期下载：

```powershell
$env:NETLIFY_SITE_ID="你的 Site ID"
$env:NETLIFY_AUTH_TOKEN="你的 Personal Access Token"
npm run netlify:backup
```

也可以直接在 Netlify 控制台 **Blobs** 里下载该 key。

> 本次种子库是 2026-10-19 从 VPS 导出的快照。如果正式切换前 VPS 上又发了新文章/相册，需要重新导出并加密，然后重新部署：
>
> ```powershell
> # 在 VPS 上执行导出脚本，把新的 /tmp/catkinsblog-seed.sqlite 下载到本地 netlify/seed/catkinsblog.sqlite
> $env:ADMIN_SESSION_SECRET="VPS 上的值"
> npm run netlify:encrypt-seed
> git add netlify/seed/catkinsblog.sqlite.enc
> git commit -m "Refresh Netlify seed"
> git push AstroTest main
> ```
>
> 如果 Netlify Blobs 中已经有数据库（说明线上已经发生写入），新的种子库不会自动覆盖它；需要先在 Blobs 中删除 `catkinsblog.sqlite`，或手动恢复。

## 5. 已知限制

- 这是“单文件 SQLite + Blobs 快照”方案，适合个人博客的低频写入；每次写操作会把约 1.5 MB 的数据库整体写回 Blobs，并用 Blobs 条件写实现互斥锁。若以后多人同时频繁写，建议换成 Netlify DB（Neon Postgres）或 Turso。
- 写入并发时，第二个请求最多等待约 9 秒；超时返回 503，重试即可。
- Netlify Function 同步执行上限 60 秒、请求体 6 MB；图片是浏览器直传 COS，不受这个限制。
- 页面默认 `s-maxage=300`，点赞/评论/留言在其他访客那里最多延迟约 5 分钟可见。
- 删除 Netlify Blobs 里的 `catkinsblog.sqlite` 会回到加密种子库的状态（相当于回滚到迁移时点）。
- 如果 `ADMIN_SESSION_SECRET` 丢失或修改且没有重新加密种子库，首次读取会失败；VPS 上的数据库和备份仍然可用。

## 6. 常用命令

```powershell
npm start                 # 本地 VPS 模式，读写 data/albums/catkinsblog.sqlite
npm run netlify:test      # 用文件系统模拟 Blobs，跑一遍 Netlify 运行时
npm run netlify:build     # 本地执行 Netlify 构建与函数打包
npm run netlify:dev       # Netlify CLI 本地开发（需要先 netlify link）
npm run netlify:deploy    # netlify deploy --build --prod
npm run netlify:backup    # 从 Blobs 下载数据库
npm run netlify:encrypt-seed
```

## 7. 回滚

在 DNS 切回 VPS 前，VPS 上的 PM2 服务和数据库不要删除。若 Netlify 验收失败：

1. 把 Cloudflare DNS 改回原来的 Tunnel / A 记录。
2. VPS 上 `pm2 restart catkinsblog`。
3. 迁移期间在 Netlify 产生的新文章/评论不会自动回到 VPS；需要时用 `npm run netlify:backup` 下载数据库，再在 VPS 上恢复。
