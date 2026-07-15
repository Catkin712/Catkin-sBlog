import { createServer } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    adminEditorScript,
    adminEditorStyles,
    adminMarkdownToolbar,
    katexCssHref,
    katexScriptHref,
} from "../functions/_shared/admin-editor.mjs";

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(modulePath), "..");
loadEnvFile(path.join(projectRoot, ".env"));
loadEnvFile(path.join(projectRoot, ".env.local"));
const host = process.env.ADMIN_HOST ?? "127.0.0.1";
const port = Number(process.env.ADMIN_PORT ?? 8787);
const isHostedRuntime = Boolean(process.env.CF_PAGES) || Boolean(process.env.CONTEXT);
const adminUsername = process.env.ADMIN_USERNAME ?? (isHostedRuntime ? "" : "catkin");
const adminPassword = process.env.ADMIN_PASSWORD ?? (isHostedRuntime ? "" : "catkin123");
const adminAccounts = getAdminAccounts();
const sessionSecret =
    process.env.ADMIN_SESSION_SECRET ?? (isHostedRuntime ? "" : "catkin-dev-session-secret");
const adminConfigError = getAdminConfigError();
const sessionMaxAge = 60 * 60 * 24 * 7;

const loginHtml = String.raw`<!doctype html>
<html lang="zh-CN">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Catkin's Blog Admin Login</title>
        <style>
            :root {
                color-scheme: light;
                --bg: #f6f7f9;
                --panel: #ffffff;
                --line: #d9dee7;
                --text: #20242c;
                --muted: #687386;
                --brand: #216869;
                --brand-strong: #154c4d;
            }

            * {
                box-sizing: border-box;
            }

            body {
                margin: 0;
                min-height: 100vh;
                display: grid;
                place-items: center;
                background: var(--bg);
                color: var(--text);
                font-family:
                    ui-sans-serif,
                    system-ui,
                    -apple-system,
                    BlinkMacSystemFont,
                    "Segoe UI",
                    sans-serif;
            }

            .login-panel {
                width: min(420px, calc(100vw - 2rem));
                border: 1px solid var(--line);
                border-radius: 8px;
                background: var(--panel);
                padding: 1.5rem;
            }

            h1 {
                margin: 0 0 0.35rem;
                font-size: 1.25rem;
            }

            p {
                margin: 0 0 1rem;
                color: var(--muted);
                font-size: 0.92rem;
            }

            form {
                display: grid;
                gap: 0.75rem;
            }

            label {
                display: grid;
                gap: 0.35rem;
                font-size: 0.92rem;
                font-weight: 700;
            }

            input,
            button {
                font: inherit;
            }

            input {
                border: 1px solid var(--line);
                border-radius: 6px;
                padding: 0.65rem 0.75rem;
            }

            button {
                border: 1px solid var(--brand);
                border-radius: 6px;
                background: var(--brand);
                color: #fff;
                padding: 0.65rem 0.75rem;
                cursor: pointer;
            }

            button:hover {
                background: var(--brand-strong);
            }

            .status {
                min-height: 1.2rem;
                color: var(--muted);
                font-size: 0.85rem;
            }
        </style>
    </head>
    <body>
        <section class="login-panel">
            <h1>Catkin's Blog Admin</h1>
            <p>请输入管理员账号密码。</p>
            <form id="loginForm">
                <label>
                    用户名
                    <input id="username" name="username" autocomplete="username" required />
                </label>
                <label>
                    密码
                    <input id="password" name="password" type="password" autocomplete="current-password" required />
                </label>
                <button type="submit">登录</button>
                <p id="status" class="status"></p>
            </form>
        </section>
        <script>
            const form = document.querySelector("#loginForm");
            const status = document.querySelector("#status");

            form?.addEventListener("submit", async (event) => {
                event.preventDefault();
                status.textContent = "正在登录...";

                const payload = {
                    username: document.querySelector("#username").value,
                    password: document.querySelector("#password").value,
                };

                const response = await fetch("/api/login", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify(payload),
                });

                if (!response.ok) {
                    const result = await response.json();
                    status.textContent = result.error ?? "登录失败";
                    return;
                }

                window.location.reload();
            });
        </script>
    </body>
</html>`;

const adminHtml = String.raw`<!doctype html>
<html lang="zh-CN">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Catkin's Blog Admin</title>
        <link rel="stylesheet" href="${katexCssHref}" crossorigin="anonymous" />
        <script src="${katexScriptHref}" crossorigin="anonymous"></script>
        <style>
            :root {
                color-scheme: light;
                --bg: #f6f7f9;
                --panel: #ffffff;
                --line: #d9dee7;
                --text: #20242c;
                --muted: #687386;
                --brand: #216869;
                --brand-strong: #154c4d;
                --danger: #b42318;
                --code: #101828;
            }

            * {
                box-sizing: border-box;
            }

            body {
                margin: 0;
                background: var(--bg);
                color: var(--text);
                font-family:
                    ui-sans-serif,
                    system-ui,
                    -apple-system,
                    BlinkMacSystemFont,
                    "Segoe UI",
                    sans-serif;
            }

            header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 1rem;
                padding: 0.875rem 1rem;
                border-bottom: 1px solid var(--line);
                background: var(--panel);
            }

            header h1 {
                margin: 0;
                font-size: 1.1rem;
            }

            button,
            input,
            textarea {
                font: inherit;
            }

            button {
                min-height: 2.25rem;
                border: 1px solid var(--line);
                border-radius: 6px;
                background: #ffffff;
                color: var(--text);
                cursor: pointer;
                padding: 0.4rem 0.7rem;
            }

            button:hover {
                border-color: var(--brand);
            }

            button.primary {
                border-color: var(--brand);
                background: var(--brand);
                color: #ffffff;
            }

            button.primary:hover {
                background: var(--brand-strong);
            }

            button.danger {
                color: var(--danger);
            }

            .layout {
                display: grid;
                grid-template-columns: minmax(220px, 280px) 1fr;
                min-height: calc(100vh - 61px);
            }

            aside {
                border-right: 1px solid var(--line);
                background: var(--panel);
                padding: 1rem;
            }

            main {
                padding: 1rem;
            }

            .toolbar,
            .actions {
                display: flex;
                flex-wrap: wrap;
                gap: 0.5rem;
                align-items: center;
            }

            .post-list {
                display: grid;
                gap: 0.5rem;
                margin-top: 1rem;
            }

            .post-item {
                display: grid;
                gap: 0.25rem;
                width: 100%;
                text-align: left;
            }

            .post-item.active {
                border-color: var(--brand);
                box-shadow: inset 3px 0 0 var(--brand);
            }

            .post-title {
                font-weight: 700;
            }

            .post-meta,
            .hint,
            label span {
                color: var(--muted);
                font-size: 0.875rem;
            }

            form {
                display: grid;
                gap: 1rem;
            }

            .fields {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 0.75rem;
            }

            label {
                display: grid;
                gap: 0.35rem;
                font-weight: 700;
            }

            label.checkbox-label {
                display: inline-flex;
                gap: 0.45rem;
                align-items: center;
                justify-self: start;
            }

            label.checkbox-label input {
                width: auto;
            }

            input,
            textarea {
                width: 100%;
                border: 1px solid var(--line);
                border-radius: 6px;
                background: #ffffff;
                color: var(--text);
                padding: 0.55rem 0.65rem;
            }

            textarea {
                min-height: 460px;
                resize: vertical;
                line-height: 1.55;
                font-family:
                    ui-monospace,
                    SFMono-Regular,
                    Consolas,
                    "Liberation Mono",
                    monospace;
            }

            .editor-grid {
                display: grid;
                grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
                gap: 1rem;
                align-items: start;
            }

            .preview,
            .output {
                border: 1px solid var(--line);
                border-radius: 6px;
                background: var(--panel);
                padding: 1rem;
            }

            .preview {
                min-height: 460px;
                overflow-wrap: anywhere;
            }

            .preview h1,
            .preview h2,
            .preview h3 {
                line-height: 1.2;
            }

            .preview code,
            .output {
                color: var(--code);
                font-family:
                    ui-monospace,
                    SFMono-Regular,
                    Consolas,
                    "Liberation Mono",
                    monospace;
                font-size: 0.875rem;
            }

${adminEditorStyles}

            .status {
                min-height: 1.5rem;
                color: var(--muted);
            }

            .output {
                display: none;
                max-height: 280px;
                overflow: auto;
                white-space: pre-wrap;
            }

            @media (max-width: 860px) {
                .layout,
                .editor-grid,
                .fields {
                    grid-template-columns: 1fr;
                }

                aside {
                    border-right: 0;
                    border-bottom: 1px solid var(--line);
                }
            }
        </style>
    </head>
    <body>
        <header>
            <h1>Catkin's Blog Admin</h1>
            <div class="toolbar">
                <button id="logout" type="button">退出</button>
                <button id="refreshPosts" type="button">刷新</button>
                <button id="buildSite" type="button" class="primary">刷新文章</button>
            </div>
        </header>
        <div class="layout">
            <aside>
                <div class="toolbar">
                    <button id="newPost" type="button" class="primary">新文章</button>
                </div>
                <div id="postList" class="post-list"></div>
            </aside>
            <main>
                <form id="postForm">
                    <div class="fields">
                        <label>
                            标题
                            <input id="title" name="title" required />
                        </label>
                        <label>
                            Slug
                            <input id="slug" name="slug" pattern="[a-z0-9][a-z0-9_-]*" required />
                            <span>只使用小写字母、数字、短横线和下划线</span>
                        </label>
                        <label>
                            日期
                            <input id="pubDate" name="pubDate" type="date" required />
                        </label>
                        <label>
                            作者
                            <input id="author" name="author" required />
                        </label>
                        <label>
                            分类
                            <input id="category" name="category" list="categoryOptions" placeholder="未分类" />
                            <datalist id="categoryOptions"></datalist>
                            <span>可选择已有分类，也可以直接输入新分类</span>
                        </label>
                        <label>
                            标签
                            <input id="tags" name="tags" placeholder="astro, blog" />
                            <span>用英文逗号分隔</span>
                        </label>
                        <label class="checkbox-label">
                            精选文章
                            <input id="featured" name="featured" type="checkbox" />
                        </label>
                        <label>
                            封面 URL
                            <input id="imageUrl" name="imageUrl" />
                            <span>可填写外链或 /covers/example.png</span>
                        </label>
                        <label>
                            本地封面
                            <input id="imageFile" name="imageFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
                            <span>选择本地图片会覆盖封面 URL</span>
                        </label>
                        <label>
                            封面描述
                            <input id="imageAlt" name="imageAlt" />
                        </label>
                        <label>
                            摘要
                            <input id="description" name="description" required />
                        </label>
                    </div>
                    <div class="editor-grid">
                        <div class="markdown-editor">
                            <label for="body">Markdown</label>
${adminMarkdownToolbar}
                            <textarea id="body" name="body" required></textarea>
                        </div>
                        <section>
                            <p class="hint">预览</p>
                            <article id="preview" class="preview"></article>
                        </section>
                    </div>
                    <div class="actions">
                        <button id="saveDraft" type="button">保存草稿</button>
                        <button id="publishPost" type="button" class="primary">发布</button>
                    </div>
                    <p id="status" class="status"></p>
                    <pre id="output" class="output"></pre>
                </form>
            </main>
        </div>
        <script>
            const els = {
                postList: document.querySelector("#postList"),
                form: document.querySelector("#postForm"),
                title: document.querySelector("#title"),
                slug: document.querySelector("#slug"),
                pubDate: document.querySelector("#pubDate"),
                author: document.querySelector("#author"),
                category: document.querySelector("#category"),
                categoryOptions: document.querySelector("#categoryOptions"),
                tags: document.querySelector("#tags"),
                featured: document.querySelector("#featured"),
                imageUrl: document.querySelector("#imageUrl"),
                imageFile: document.querySelector("#imageFile"),
                imageAlt: document.querySelector("#imageAlt"),
                description: document.querySelector("#description"),
                body: document.querySelector("#body"),
                preview: document.querySelector("#preview"),
                status: document.querySelector("#status"),
                output: document.querySelector("#output"),
            };

            let posts = [];
            let currentSlug = "";

            const today = () => new Date().toISOString().slice(0, 10);
            const normalizeCategory = (value) => String(value || "").trim() || "未分类";
            const setStatus = (message) => {
                els.status.textContent = message;
            };

            const refreshCategoryOptions = () => {
                const categories = [...new Set(posts.map((post) => normalizeCategory(post.category)))].sort();
                els.categoryOptions.innerHTML = categories
                    .map((category) => '<option value="' + escapeHtml(category) + '"></option>')
                    .join("");
            };

            const slugify = (value) => {
                const slug = value
                    .toLowerCase()
                    .trim()
                    .normalize("NFKD")
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-+|-+$/g, "");
                return slug || "post-" + today();
            };

            const escapeHtml = (value) =>
                value.replace(/[&<>"']/g, (char) => ({
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#039;",
                }[char]));

            const inlineMarkdown = (value) =>
                escapeHtml(value)
                    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                    .replace(/\x60(.+?)\x60/g, "<code>$1</code>");

            const renderMarkdown = (markdown) => {
                const lines = markdown.split(/\r?\n/);
                const html = [];
                let inList = false;

                for (const line of lines) {
                    if (/^\s*$/.test(line)) {
                        if (inList) {
                            html.push("</ul>");
                            inList = false;
                        }
                        continue;
                    }

                    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
                    if (heading) {
                        if (inList) {
                            html.push("</ul>");
                            inList = false;
                        }
                        html.push(
                            "<h" +
                                heading[1].length +
                                ">" +
                                inlineMarkdown(heading[2]) +
                                "</h" +
                                heading[1].length +
                                ">",
                        );
                        continue;
                    }

                    const item = /^\s*(?:[-*]|\d+\.)\s+(.+)$/.exec(line);
                    if (item) {
                        if (!inList) {
                            html.push("<ul>");
                            inList = true;
                        }
                        html.push("<li>" + inlineMarkdown(item[1]) + "</li>");
                        continue;
                    }

                    if (inList) {
                        html.push("</ul>");
                        inList = false;
                    }
                    html.push("<p>" + inlineMarkdown(line) + "</p>");
                }

                if (inList) {
                    html.push("</ul>");
                }

                return html.join("");
            };

            const refreshPreview = () => {
                if (typeof window.refreshMarkdownPreview === "function") {
                    window.refreshMarkdownPreview();
                    return;
                }
                els.preview.innerHTML = renderMarkdown(els.body.value);
            };

            const fillForm = (post) => {
                currentSlug = post.slug;
                els.title.value = post.data.title ?? "";
                els.slug.value = post.slug ?? "";
                els.slug.readOnly = Boolean(post.slug);
                els.pubDate.value = (post.data.pubDate ?? today()).slice(0, 10);
                els.author.value = post.data.author ?? "catkin";
                els.category.value = normalizeCategory(post.data.category);
                els.tags.value = (post.data.tags ?? []).join(", ");
                els.featured.checked = Boolean(post.data.featured);
                els.imageUrl.value = post.data.image?.url ?? "";
                els.imageFile.value = "";
                els.imageAlt.value = post.data.image?.alt ?? "";
                els.description.value = post.data.description ?? "";
                els.body.value = post.body ?? "";
                refreshPreview();
                renderPostList();
            };

            const newPost = () => {
                currentSlug = "";
                els.form.reset();
                els.slug.readOnly = false;
                els.pubDate.value = today();
                els.author.value = "catkin";
                els.category.value = "未分类";
                els.featured.checked = false;
                els.body.value = "";
                refreshPreview();
                setStatus("正在新建文章。");
                renderPostList();
            };

            const readImageFile = (file) =>
                new Promise((resolve, reject) => {
                    if (!file) {
                        resolve(null);
                        return;
                    }

                    const reader = new FileReader();
                    reader.addEventListener("load", () => {
                        const result = String(reader.result ?? "");
                        const [, base64 = ""] = result.split(",");
                        resolve({
                            name: file.name,
                            type: file.type,
                            size: file.size,
                            base64,
                        });
                    });
                    reader.addEventListener("error", () => reject(new Error("封面读取失败")));
                    reader.readAsDataURL(file);
                });

            const formData = async (draft) => ({
                slug: els.slug.value.trim(),
                title: els.title.value.trim(),
                pubDate: els.pubDate.value,
                description: els.description.value.trim(),
                author: els.author.value.trim(),
                category: normalizeCategory(els.category.value),
                tags: els.tags.value.split(",").map((tag) => tag.trim()).filter(Boolean),
                featured: els.featured.checked,
                draft,
                imageUrl: els.imageUrl.value.trim(),
                imageUpload: await readImageFile(els.imageFile.files?.[0]),
                imageAlt: els.imageAlt.value.trim(),
                body: els.body.value,
            });

            const requestJson = async (url, options) => {
                const response = await fetch(url, {
                    headers: { "content-type": "application/json" },
                    ...options,
                });
                const payload = await response.json();
                if (!response.ok) {
                    throw new Error(payload.error ?? "请求失败");
                }
                return payload;
            };

            const loadPosts = async () => {
                posts = await requestJson("/api/posts");
                refreshCategoryOptions();
                renderPostList();
            };

            const loadPost = async (slug) => {
                const post = await requestJson("/api/posts/" + slug);
                fillForm(post);
                setStatus("已加载 " + slug + ".md");
            };

            const save = async (draft) => {
                if (!els.form.reportValidity()) {
                    return;
                }

                const payload = await formData(draft);
                await requestJson("/api/posts/" + payload.slug, {
                    method: "PUT",
                    body: JSON.stringify(payload),
                });
                currentSlug = payload.slug;
                await loadPosts();
                await loadPost(payload.slug);
                setStatus(draft ? "草稿已保存。" : "文章已发布。");
            };

            const buildSite = async () => {
                els.output.style.display = "block";
                els.output.textContent = "正在刷新 GitHub 文章数据...";
                setStatus("正在刷新文章数据。");
                await loadPosts();
                if (currentSlug) {
                    await loadPost(currentSlug);
                }
                els.output.textContent = "文章列表已刷新，前台无需重新部署。";
                setStatus("文章数据已刷新。");
            };

            const renderPostList = () => {
                els.postList.innerHTML = "";
                for (const post of posts) {
                    const button = document.createElement("button");
                    button.type = "button";
                    button.className = "post-item" + (post.slug === currentSlug ? " active" : "");
                    button.innerHTML =
                        '<span class="post-title">' +
                        escapeHtml(post.title) +
                        '</span><span class="post-meta">' +
                        escapeHtml(post.pubDate) +
                        " · " +
                        (post.featured ? "精选 · " : "") +
                        (post.draft ? "草稿" : "已发布") +
                        "</span>";
                    button.addEventListener("click", () => loadPost(post.slug));
                    els.postList.append(button);
                }
            };

            els.title.addEventListener("input", () => {
                if (!currentSlug) {
                    els.slug.value = slugify(els.title.value);
                }
            });
            els.body.addEventListener("input", refreshPreview);
            document.querySelector("#newPost").addEventListener("click", newPost);
            document.querySelector("#logout").addEventListener("click", async () => {
                await fetch("/api/logout", { method: "POST" });
                window.location.reload();
            });
            document.querySelector("#refreshPosts").addEventListener("click", loadPosts);
            document.querySelector("#saveDraft").addEventListener("click", () => save(true).catch((error) => setStatus(error.message)));
            document.querySelector("#publishPost").addEventListener("click", () => save(false).catch((error) => setStatus(error.message)));
            document.querySelector("#buildSite").addEventListener("click", () => buildSite().catch((error) => setStatus(error.message)));

            loadPosts()
                .then(() => {
                    if (posts[0]) {
                        return loadPost(posts[0].slug);
                    }
                    newPost();
                })
                .catch((error) => setStatus(error.message));
        </script>
        <script>
${adminEditorScript}
        </script>
    </body>
</html>`;

export async function handleAdminRequest(request) {
    try {
        const url = new URL(request.url);

        if (request.method === "GET" && ["/", "/admin"].includes(url.pathname)) {
            return htmlResponse(isAuthenticated(request) ? adminHtml : loginHtml);
        }

        if (request.method === "POST" && url.pathname === "/api/login") {
            if (adminConfigError) {
                return jsonResponse(500, { error: adminConfigError });
            }

            const payload = await readJson(request);
            const account = adminAccounts.find(
                (item) =>
                    item.username === payload.username &&
                    item.password === payload.password,
            );
            if (!account) {
                return jsonResponse(401, { error: "用户名或密码错误" });
            }

            const token = createSessionToken(account.username);
            return jsonResponse(200, { ok: true }, {
                "set-cookie": buildSessionCookie(token),
            });
        }

        if (request.method === "POST" && url.pathname === "/api/logout") {
            return jsonResponse(200, { ok: true }, {
                "set-cookie": buildExpiredSessionCookie(),
            });
        }

        if (!isAuthenticated(request)) {
            return jsonResponse(401, { error: "未登录" });
        }

        if (request.method === "GET" && url.pathname === "/api/posts") {
            return jsonResponse(200, await listPosts());
        }

        const postMatch = /^\/api\/posts\/([^/]+)$/.exec(url.pathname);
        if (postMatch && request.method === "GET") {
            return jsonResponse(200, await readPost(decodeURIComponent(postMatch[1])));
        }

        if (postMatch && request.method === "PUT") {
            const slug = decodeURIComponent(postMatch[1]);
            const payload = await readJson(request);
            await writePost(slug, payload);
            return jsonResponse(200, { ok: true });
        }

        if (request.method === "POST" && url.pathname === "/api/build") {
            return jsonResponse(200, await runBuild());
        }

        return jsonResponse(404, { error: "Not found" });
    } catch (error) {
        return jsonResponse(500, { error: error.message });
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
    const server = createServer(async (request, response) => {
        const webRequest = await toWebRequest(request);
        const webResponse = await handleAdminRequest(webRequest);
        await sendNodeResponse(response, webResponse);
    });

    server.listen(port, host, () => {
        console.log(`Admin server running at http://${host}:${port}`);
    });
}

function htmlResponse(body) {
    return new Response(body, {
        status: 200,
        headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
        },
    });
}

function jsonResponse(status, payload, headers = {}) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
            ...headers,
        },
    });
}

async function toWebRequest(request) {
    const requestHost = request.headers.host ?? `${host}:${port}`;
    const url = `http://${requestHost}${request.url ?? "/"}`;
    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
        if (Array.isArray(value)) {
            for (const item of value) {
                headers.append(key, item);
            }
        } else if (value !== undefined) {
            headers.set(key, value);
        }
    }

    const method = request.method ?? "GET";
    if (["GET", "HEAD"].includes(method)) {
        return new Request(url, { method, headers });
    }

    const body = await readNodeBody(request);
    return new Request(url, {
        method,
        headers,
        body,
        duplex: "half",
    });
}

function readNodeBody(request) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        request.on("data", (chunk) => chunks.push(chunk));
        request.on("end", () => resolve(Buffer.concat(chunks)));
        request.on("error", reject);
    });
}

async function sendNodeResponse(response, webResponse) {
    response.statusCode = webResponse.status;
    webResponse.headers.forEach((value, key) => {
        response.setHeader(key, value);
    });
    response.end(Buffer.from(await webResponse.arrayBuffer()));
}

async function readJson(request) {
    const body = await request.text();
    if (body.length > 8_000_000) {
        throw new Error("请求内容过大");
    }
    return body ? JSON.parse(body) : {};
}

function getSessionToken(request) {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const cookie = cookieHeader
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith("admin_session="));
    return cookie ? decodeURIComponent(cookie.split("=").slice(1).join("=")) : "";
}

function isAuthenticated(request) {
    const token = getSessionToken(request);
    return Boolean(token && verifySessionToken(token));
}

function buildSessionCookie(token) {
    return `admin_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionMaxAge}`;
}

function buildExpiredSessionCookie() {
    return "admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
}

function loadEnvFile(filePath) {
    if (!existsSync(filePath)) {
        return;
    }

    const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
            continue;
        }

        const index = trimmed.indexOf("=");
        if (index === -1) {
            continue;
        }

        const key = trimmed.slice(0, index).trim();
        let value = trimmed.slice(index + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }

        if (!process.env[key] && key) {
            process.env[key] = value;
        }
    }
}

function createSessionToken(username) {
    const payload = Buffer.from(
        JSON.stringify({
            username,
            exp: Date.now() + sessionMaxAge * 1000,
        }),
    ).toString("base64url");
    return `${payload}.${sign(payload)}`;
}

function verifySessionToken(token) {
    const [payload, signature] = token.split(".");
    if (!payload || !signature) {
        return false;
    }

    const expected = sign(payload);
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (
        signatureBuffer.length !== expectedBuffer.length ||
        !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
        return false;
    }

    try {
        const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
        return (
            adminAccounts.some((account) => account.username === data.username) &&
            Number(data.exp) > Date.now()
        );
    } catch {
        return false;
    }
}

function sign(payload) {
    return createHmac("sha256", sessionSecret).update(payload).digest("base64url");
}

function getAdminAccounts() {
    const accounts = [];

    if (adminUsername && adminPassword) {
        accounts.push({
            username: adminUsername,
            password: adminPassword,
        });
    }

    const extraUsers = process.env.ADMIN_EXTRA_USERS ?? "";
    for (const pair of extraUsers.split(/[\n,]+/)) {
        const trimmed = pair.trim();
        if (!trimmed) {
            continue;
        }

        const separatorIndex = trimmed.indexOf(":");
        if (separatorIndex === -1) {
            continue;
        }

        const username = trimmed.slice(0, separatorIndex).trim();
        const password = trimmed.slice(separatorIndex + 1).trim();
        if (username && password) {
            accounts.push({ username, password });
        }
    }

    return accounts;
}

function getAdminConfigError() {
    const missing = [];
    if (!adminUsername || !adminPassword) {
        missing.push("ADMIN_USERNAME", "ADMIN_PASSWORD");
    }
    if (!sessionSecret) {
        missing.push("ADMIN_SESSION_SECRET");
    }

    if (missing.length === 0 && adminAccounts.length > 0) {
        return "";
    }

    return `缺少后台登录环境变量：${[...new Set(missing)].join(", ")}。请在 Cloudflare Pages 的 Environment variables 中配置后重新部署。`;
}

async function listPosts() {
    const files = await listGitHubDirectory("src/content/posts");
    const posts = await Promise.all(
        files
            .filter((file) => file.type === "file" && file.name.endsWith(".md"))
            .map(async (file) => {
            const slug = file.name.replace(/\.md$/, "");
            const post = await readPost(slug);
            return {
                slug,
                title: post.data.title,
                pubDate: post.data.pubDate,
                description: post.data.description,
                author: post.data.author,
                category: post.data.category,
                tags: post.data.tags,
                featured: post.data.featured,
                draft: post.data.draft,
            };
        }),
    );

    return posts.sort((a, b) => b.pubDate.localeCompare(a.pubDate));
}

async function readPost(slug) {
    assertSlug(slug);
    const markdown = await readGitHubTextFile(`src/content/posts/${slug}.md`);
    const { data, body } = parseMarkdown(markdown);
    return { slug, data, body };
}

async function writePost(slug, payload) {
    assertSlug(slug);
    if (payload.slug !== slug) {
        throw new Error("Slug 与请求路径不一致");
    }

    const post = normalizePost(payload);
    if (payload.imageUpload?.base64) {
        post.image = await saveCover(slug, payload.imageUpload, payload.imageAlt || post.title);
    }
    await writeGitHubTextFile(
        `src/content/posts/${slug}.md`,
        serializeMarkdown(post),
        `content: ${post.draft ? "save draft" : "publish"} ${slug}`,
    );
}

function assertSlug(slug) {
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(slug)) {
        throw new Error("Slug 只能包含小写字母、数字、短横线和下划线");
    }
}

function normalizePost(payload) {
    const required = ["title", "pubDate", "description", "author", "body"];
    for (const field of required) {
        if (!String(payload[field] ?? "").trim()) {
            throw new Error(`${field} 不能为空`);
        }
    }

    const post = {
        title: String(payload.title).trim(),
        pubDate: String(payload.pubDate).slice(0, 10),
        description: String(payload.description).trim(),
        author: String(payload.author).trim(),
        category: String(payload.category ?? "").trim() || "未分类",
        tags: Array.isArray(payload.tags)
            ? payload.tags.map((tag) => String(tag).trim()).filter(Boolean)
            : [],
        featured: Boolean(payload.featured),
        draft: Boolean(payload.draft),
        body: String(payload.body).replace(/\s+$/, ""),
    };

    if (!/^\d{4}-\d{2}-\d{2}$/.test(post.pubDate)) {
        throw new Error("pubDate 必须是 YYYY-MM-DD");
    }

    if (payload.imageUrl) {
        post.image = {
            url: String(payload.imageUrl).trim(),
            alt: String(payload.imageAlt ?? "").trim() || post.title,
        };
    }

    return post;
}

async function saveCover(slug, upload, alt) {
    const extensions = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/webp": "webp",
        "image/gif": "gif",
    };
    const extension = extensions[upload.type];
    if (!extension) {
        throw new Error("封面只支持 PNG、JPG、WebP 或 GIF");
    }

    const buffer = Buffer.from(String(upload.base64), "base64");
    if (buffer.length > 5_000_000) {
        throw new Error("封面图片不能超过 5MB");
    }

    const fileName = `${slug}.${extension}`;
    await writeGitHubBase64File(
        `public/covers/${fileName}`,
        buffer.toString("base64"),
        `content: update cover for ${slug}`,
    );
    return {
        url: `/covers/${fileName}`,
        alt: String(alt ?? "").trim() || slug,
    };
}

function parseMarkdown(markdown) {
    const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(markdown);
    if (!match) {
        throw new Error("Markdown 缺少 frontmatter");
    }

    return {
        data: parseFrontmatter(match[1]),
        body: match[2].trimStart(),
    };
}

function parseFrontmatter(frontmatter) {
    const data = { tags: [], featured: false, draft: false, category: "未分类" };
    const lines = frontmatter.split(/\r?\n/);

    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        const keyValue = /^([a-zA-Z][\w-]*):\s*(.*)$/.exec(line);
        if (!keyValue) {
            continue;
        }

        const [, key, rawValue] = keyValue;
        if (key === "image" && rawValue === "") {
            const image = {};
            while (lines[i + 1]?.startsWith("    ") || lines[i + 1]?.startsWith("  ")) {
                i += 1;
                const child = /^\s+([a-zA-Z][\w-]*):\s*(.*)$/.exec(lines[i]);
                if (child) {
                    image[child[1]] = parseScalar(child[2]);
                }
            }
            data.image = image;
            continue;
        }

        data[key] = parseScalar(rawValue);
    }

    return {
        title: data.title ?? "",
        pubDate: String(data.pubDate ?? ""),
        description: data.description ?? "",
        author: data.author ?? "",
        category: String(data.category ?? "").trim() || "未分类",
        image: data.image,
        tags: Array.isArray(data.tags) ? data.tags : [],
        featured: Boolean(data.featured),
        draft: Boolean(data.draft),
    };
}

function parseScalar(value) {
    const trimmed = value.trim();
    if (trimmed === "true") {
        return true;
    }
    if (trimmed === "false") {
        return false;
    }
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        return JSON.parse(trimmed.replaceAll("'", '"'));
    }
    if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}

function serializeMarkdown(post) {
    const lines = [
        "---",
        `title: ${JSON.stringify(post.title)}`,
        `pubDate: ${post.pubDate}`,
        `description: ${JSON.stringify(post.description)}`,
        `author: ${JSON.stringify(post.author)}`,
        `category: ${JSON.stringify(post.category)}`,
    ];

    if (post.image) {
        lines.push("image:");
        lines.push(`    url: ${JSON.stringify(post.image.url)}`);
        lines.push(`    alt: ${JSON.stringify(post.image.alt)}`);
    }

    lines.push(`tags: ${JSON.stringify(post.tags)}`);
    lines.push(`featured: ${post.featured}`);
    lines.push(`draft: ${post.draft}`);
    lines.push("---", "", post.body, "");
    return lines.join("\n");
}

async function runBuild() {
    return {
        ok: true,
        output: "当前站点已改为运行时读取文章，不需要重新部署。",
    };
}

function getGitHubConfig() {
    const token = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH ?? "main";
    const missing = [
        ["GITHUB_TOKEN", token],
        ["GITHUB_OWNER", owner],
        ["GITHUB_REPO", repo],
    ]
        .filter(([, value]) => !value)
        .map(([name]) => name);

    if (missing.length > 0) {
        throw new Error(
            `缺少 GitHub 环境变量：${missing.join(", ")}。文章列表、读取和保存文章需要这些变量；请在 Cloudflare Pages 的 Environment variables 中配置后重新部署。`,
        );
    }

    return { token, owner, repo, branch };
}

async function githubRequest(apiPath, options = {}) {
    const { token, owner, repo } = getGitHubConfig();
    let response;
    try {
        response = await fetch(`https://api.github.com/repos/${owner}/${repo}${apiPath}`, {
            ...options,
            headers: {
                accept: "application/vnd.github+json",
                authorization: `Bearer ${token}`,
                "content-type": "application/json",
                "user-agent": "catkins-blog-admin",
                "x-github-api-version": "2022-11-28",
                ...(options.headers ?? {}),
            },
        });
    } catch (error) {
        throw new Error(`GitHub API 请求失败：${error.cause?.message ?? error.message}`);
    }

    if (response.status === 404 && options.allowMissing) {
        return null;
    }

    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;
    if (!response.ok) {
        throw new Error(payload?.message ?? `GitHub API 返回 ${response.status}`);
    }
    return payload;
}

function encodeRepoPath(repoPath) {
    return repoPath.split("/").map(encodeURIComponent).join("/");
}

async function listGitHubDirectory(repoPath) {
    const { branch } = getGitHubConfig();
    return await githubRequest(
        `/contents/${encodeRepoPath(repoPath)}?ref=${encodeURIComponent(branch)}`,
    );
}

async function getGitHubContent(repoPath) {
    const { branch } = getGitHubConfig();
    return await githubRequest(
        `/contents/${encodeRepoPath(repoPath)}?ref=${encodeURIComponent(branch)}`,
        { allowMissing: true },
    );
}

async function readGitHubTextFile(repoPath) {
    const file = await getGitHubContent(repoPath);
    if (!file?.content) {
        throw new Error(`GitHub 中不存在 ${repoPath}`);
    }
    return Buffer.from(file.content.replace(/\n/g, ""), "base64").toString("utf8");
}

async function writeGitHubTextFile(repoPath, content, message) {
    await writeGitHubBase64File(
        repoPath,
        Buffer.from(content, "utf8").toString("base64"),
        message,
    );
}

async function writeGitHubBase64File(repoPath, base64Content, message) {
    const { branch } = getGitHubConfig();
    const existing = await getGitHubContent(repoPath);
    const body = {
        message,
        content: base64Content,
        branch,
    };

    if (existing?.sha) {
        body.sha = existing.sha;
    }

    await githubRequest(`/contents/${encodeRepoPath(repoPath)}`, {
        method: "PUT",
        body: JSON.stringify(body),
    });
}
