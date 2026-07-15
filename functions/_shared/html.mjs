import {
    adminEditorScript,
    adminEditorStyles,
    adminMarkdownToolbar,
    katexCssHref,
    katexScriptHref,
} from "./admin-editor.mjs";
import {
    formatPostDate,
    getPublishedCategories,
    getPublishedTags,
    normalizeCategory,
    publicPostSummary,
} from "./blog.mjs";

const siteName = "Catkin's Blog";
const defaultDescription = "Catkin's Blog 是一个记录技术学习、生活观察和个人内容的轻量博客。";

export function htmlResponse(body, status = 200, headers = {}) {
    return new Response(body, {
        status,
        headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "public, max-age=30, s-maxage=300, stale-while-revalidate=86400",
            ...headers,
        },
    });
}

export function jsonResponse(payload, status = 200, headers = {}) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
            ...headers,
        },
    });
}

export function xmlResponse(body, status = 200) {
    return new Response(body, {
        status,
        headers: {
            "content-type": "application/rss+xml; charset=utf-8",
            "cache-control": "public, max-age=30, s-maxage=300, stale-while-revalidate=86400",
        },
    });
}

export function renderHome(posts) {
    const featuredPosts = posts.filter((post) => post.data.featured);
    const latestPosts = posts.filter((post) => !post.data.featured);
    const body = `
        <h1>${escapeHtml(siteName)}</h1>
        <section class="home-hero">
            <p>以渺小启程</p>
        </section>
        <section class="home-section" aria-labelledby="featured-posts-title">
            <div class="section-heading">
                <h2 id="featured-posts-title">精选文章</h2>
            </div>
            <div class="post-feed">
                ${featuredPosts.map((post) => renderPostCard(post, { featured: true })).join("") || '<p class="article-description">暂无精选文章。</p>'}
            </div>
        </section>
        <section class="home-section" aria-labelledby="latest-posts-title">
            <div class="section-heading">
                <h2 id="latest-posts-title">最新文章</h2>
            </div>
            <div class="post-feed" aria-label="文章列表">
                ${(latestPosts.length > 0 ? latestPosts : posts).map(renderPostCard).join("")}
            </div>
        </section>
    `;
    return renderLayout({ title: siteName, active: "/", body, showTitle: false });
}

export function renderArchive(posts) {
    const body = `
        <h1>归档</h1>
        <section class="archive-list" aria-label="文章归档">
            ${posts
                .map(
                    (post) => `
                        <article class="archive-item">
                            <time datetime="${escapeAttr(post.data.pubDate)}">${escapeHtml(formatPostDate(post))}</time>
                            <div>
                                <h2><a href="/posts/${encodeURIComponent(post.id)}/">${escapeHtml(post.data.title)}</a></h2>
                                <p>${escapeHtml(post.data.author)}</p>
                            </div>
                        </article>
                    `,
                )
                .join("")}
        </section>
    `;
    return renderLayout({ title: "归档", active: "/archive/", body, showTitle: false });
}

export function renderArticle(post) {
    if (!post) {
        return renderLayout({
            title: "文章不存在",
            body: `
                <article class="article-page">
                    <h1>文章不存在</h1>
                    <p class="article-description">请检查链接是否正确。</p>
                </article>
            `,
            showTitle: false,
        });
    }

    const coverUrl = post.data.image?.url || "/defaultCover.png";
    const coverAlt = post.data.image?.alt || `${post.data.title} 的文章封面`;
    const body = `
        <article class="article-page">
            <header class="article-header">
                <div class="article-heading">
                    <h1>${escapeHtml(post.data.title)}</h1>
                    <p class="article-description">${escapeHtml(post.data.description)}</p>
                    <div class="article-meta">
                        <span>作者：${escapeHtml(post.data.author)}</span>
                        <time datetime="${escapeAttr(post.data.pubDate)}">${escapeHtml(formatPostDate(post))}</time>
                        <a href="/categories/${encodeURIComponent(normalizeCategory(post.data.category))}/">${escapeHtml(normalizeCategory(post.data.category))}</a>
                    </div>
                </div>
                <img class="article-cover" src="${escapeAttr(coverUrl)}" alt="${escapeAttr(coverAlt)}" loading="lazy" />
            </header>

            <div class="article-content">${post.html}</div>

            ${
                post.data.tags.length > 0
                    ? `<footer class="article-tags" aria-label="文章标签">
                        <p>标签</p>
                        <div>${post.data.tags.map(renderTagLink).join("")}</div>
                    </footer>`
                    : ""
            }
        </article>
    `;
    return renderLayout({
        title: post.data.title,
        description: post.data.description,
        body,
        showTitle: false,
    });
}

export function renderTagsIndex(posts) {
    const tags = getPublishedTags(posts);
    const body = `
        <h1>标签索引</h1>
        <div class="tag-cloud">
            ${tags.map((tag) => renderTagLink(tag, posts.filter((post) => post.data.tags.includes(tag)).length)).join("")}
        </div>
    `;
    return renderLayout({ title: "标签索引", active: "/tags/", body, showTitle: false });
}

export function renderTagPage(tag, posts) {
    const body = `
        <h1>${escapeHtml(tag)}</h1>
        <p>包含「${escapeHtml(tag)}」标签的文章</p>
        <section class="post-feed">
            ${posts.map(renderPostCard).join("") || '<p class="article-description">暂无文章。</p>'}
        </section>
    `;
    return renderLayout({ title: tag, active: "/tags/", body, showTitle: false });
}

export function renderCategoriesIndex(posts) {
    const categories = getPublishedCategories(posts);
    const body = `
        <h1>分类</h1>
        <section class="category-list" aria-label="文章分类">
            ${categories
                .map((category) => {
                    const categoryPosts = posts.filter(
                        (post) => normalizeCategory(post.data.category) === category,
                    );
                    return `
                        <section class="category-group">
                            <h2><a href="/categories/${encodeURIComponent(category)}/">${escapeHtml(category)}</a></h2>
                            <p>${categoryPosts.length} 篇文章</p>
                            <ol>
                                ${categoryPosts
                                    .map(
                                        (post) => `
                                            <li>
                                                <time datetime="${escapeAttr(post.data.pubDate)}">${escapeHtml(formatPostDate(post))}</time>
                                                <a href="/posts/${encodeURIComponent(post.id)}/">${escapeHtml(post.data.title)}</a>
                                            </li>
                                        `,
                                    )
                                    .join("")}
                            </ol>
                        </section>
                    `;
                })
                .join("")}
        </section>
    `;
    return renderLayout({ title: "分类", active: "/categories/", body, showTitle: false });
}

export function renderCategoryPage(category, posts) {
    const normalizedCategory = normalizeCategory(category);
    const body = `
        <h1>${escapeHtml(normalizedCategory)}</h1>
        <p>分类为「${escapeHtml(normalizedCategory)}」的文章</p>
        <section class="post-feed">
            ${posts.map(renderPostCard).join("") || '<p class="article-description">暂无文章。</p>'}
        </section>
    `;
    return renderLayout({ title: normalizedCategory, active: "/categories/", body, showTitle: false });
}

export function renderSearchJson(posts) {
    return posts.map(publicPostSummary);
}

export function renderRssXml(posts, siteUrl) {
    const normalizedSite = siteUrl.replace(/\/$/, "");
    return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
<channel>
<title>${escapeXml(siteName)}</title>
<description>${escapeXml("记录技术学习、生活观察和个人内容。")}</description>
<link>${escapeXml(normalizedSite)}</link>
<language>zh-CN</language>
${posts
    .map(
        (post) => `<item>
<title>${escapeXml(post.data.title)}</title>
<description>${escapeXml(post.data.description)}</description>
<pubDate>${escapeXml(new Date(post.data.pubDate).toUTCString())}</pubDate>
<link>${escapeXml(`${normalizedSite}/posts/${post.id}/`)}</link>
<guid>${escapeXml(`${normalizedSite}/posts/${post.id}/`)}</guid>
</item>`,
    )
    .join("\n")}
</channel>
</rss>`;
}

export function renderLoginPage() {
    return `<!doctype html>
<html lang="zh-CN">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Catkin's Blog Admin Login</title>
        <style>
            body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f6f7f9; color: #20242c; font-family: sans-serif; }
            .login-panel { width: min(420px, calc(100vw - 2rem)); border: 1px solid #d9dee7; border-radius: 8px; background: #fff; padding: 1.5rem; }
            h1 { margin: 0 0 0.35rem; font-size: 1.25rem; }
            p { margin: 0 0 1rem; color: #687386; font-size: 0.92rem; }
            form { display: grid; gap: 0.75rem; }
            label { display: grid; gap: 0.3rem; font-weight: 700; }
            input { width: 100%; border: 1px solid #d9dee7; border-radius: 6px; padding: 0.65rem; font: inherit; }
            button { border: 0; border-radius: 6px; background: #216869; color: #fff; cursor: pointer; padding: 0.7rem; font: inherit; }
            #status { min-height: 1.2rem; color: #687386; }
        </style>
    </head>
    <body>
        <section class="login-panel">
            <h1>Catkin's Blog Admin</h1>
            <p>请输入管理员账号密码。</p>
            <form id="loginForm">
                <label>用户名<input id="username" name="username" autocomplete="username" required /></label>
                <label>密码<input id="password" name="password" type="password" autocomplete="current-password" required /></label>
                <button type="submit">登录</button>
                <p id="status"></p>
            </form>
        </section>
        <script>
            document.querySelector("#loginForm").addEventListener("submit", async (event) => {
                event.preventDefault();
                const status = document.querySelector("#status");
                status.textContent = "正在登录...";
                const response = await fetch("/api/login", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                        username: document.querySelector("#username").value,
                        password: document.querySelector("#password").value,
                    }),
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                    status.textContent = payload.error || "登录失败";
                    return;
                }
                location.reload();
            });
        </script>
    </body>
</html>`;
}

export function renderAdminPage() {
    return `<!doctype html>
<html lang="zh-CN">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Catkin's Blog Admin</title>
        <link rel="stylesheet" href="${katexCssHref}" crossorigin="anonymous" />
        <script src="${katexScriptHref}" crossorigin="anonymous"></script>
        <style>
            :root { --line: #d9dee7; --brand: #216869; --muted: #687386; --code: #101828; }
            body { margin: 0; background: #f6f7f9; color: #20242c; font-family: sans-serif; }
            header { display: flex; justify-content: space-between; gap: 1rem; align-items: center; border-bottom: 1px solid #d9dee7; background: #fff; padding: 0.8rem 1rem; }
            h1 { margin: 0; font-size: 1.15rem; }
            button, input, textarea { font: inherit; }
            button { border: 1px solid #d9dee7; border-radius: 6px; background: #fff; cursor: pointer; padding: 0.45rem 0.75rem; }
            button.primary { border-color: #216869; background: #216869; color: #fff; }
            .layout { display: grid; grid-template-columns: 280px minmax(0, 1fr); min-height: calc(100vh - 57px); }
            aside { border-right: 1px solid #d9dee7; background: #fff; padding: 1rem; overflow: auto; }
            main { padding: 1rem; }
            .post-list { display: grid; gap: 0.5rem; }
            .post-item { display: grid; gap: 0.15rem; text-align: left; }
            .post-item.active { border-color: #216869; }
            .post-title { font-weight: 700; }
            .post-meta { color: #687386; font-size: 0.82rem; }
            form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.85rem; }
            label { display: grid; gap: 0.3rem; font-weight: 700; }
            label.checkbox-label { display: inline-flex; gap: 0.45rem; align-items: center; justify-self: start; }
            label.checkbox-label input { width: auto; }
            input, textarea { width: 100%; border: 1px solid #d9dee7; border-radius: 6px; padding: 0.6rem; }
            textarea { min-height: 360px; resize: vertical; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
${adminEditorStyles}
            .span-2 { grid-column: 1 / -1; }
            .actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
            #status { color: #687386; }
            @media (max-width: 820px) { .layout { grid-template-columns: 1fr; } aside { border-right: 0; border-bottom: 1px solid #d9dee7; } form { grid-template-columns: 1fr; } }
        </style>
    </head>
    <body>
        <header>
            <h1>Catkin's Blog Admin</h1>
            <div class="actions">
                <button id="newPost" type="button">新文章</button>
                <button id="refreshPosts" type="button">刷新</button>
                <button id="logout" type="button">退出</button>
            </div>
        </header>
        <div class="layout">
            <aside>
                <div id="postList" class="post-list"></div>
            </aside>
            <main>
                <form id="postForm">
                    <label>Slug<input id="slug" required pattern="[a-z0-9][a-z0-9_-]*" /></label>
                    <label>日期<input id="pubDate" type="date" required /></label>
                    <label class="span-2">标题<input id="title" required /></label>
                    <label class="span-2">描述<input id="description" required /></label>
                    <label>作者<input id="author" required /></label>
                    <label>分类<input id="category" list="categoryOptions" placeholder="未分类" /></label>
                    <datalist id="categoryOptions"></datalist>
                    <label>标签<input id="tags" placeholder="逗号分隔" /></label>
                    <label class="checkbox-label">精选文章<input id="featured" type="checkbox" /></label>
                    <label class="span-2">封面 URL<input id="imageUrl" /></label>
                    <label>上传封面<input id="imageFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" /></label>
                    <label>封面描述<input id="imageAlt" /></label>
                    <div class="editor-grid span-2">
                        <div class="markdown-editor">
                            <label for="body">正文</label>
${adminMarkdownToolbar}
                            <textarea id="body" required></textarea>
                        </div>
                        <section class="preview-panel" aria-label="Markdown 预览">
                            <p>预览</p>
                            <article id="preview" class="preview"></article>
                        </section>
                    </div>
                    <div class="span-2 actions">
                        <button id="saveDraft" type="button">保存草稿</button>
                        <button id="publishPost" class="primary" type="button">发布文章</button>
                    </div>
                    <p id="status" class="span-2"></p>
                </form>
            </main>
        </div>
        <script>
            const els = {
                form: document.querySelector("#postForm"),
                postList: document.querySelector("#postList"),
                slug: document.querySelector("#slug"),
                title: document.querySelector("#title"),
                pubDate: document.querySelector("#pubDate"),
                description: document.querySelector("#description"),
                author: document.querySelector("#author"),
                category: document.querySelector("#category"),
                categoryOptions: document.querySelector("#categoryOptions"),
                tags: document.querySelector("#tags"),
                featured: document.querySelector("#featured"),
                imageUrl: document.querySelector("#imageUrl"),
                imageFile: document.querySelector("#imageFile"),
                imageAlt: document.querySelector("#imageAlt"),
                body: document.querySelector("#body"),
                status: document.querySelector("#status"),
            };
            let posts = [];
            let currentSlug = "";
            const setStatus = (value) => { els.status.textContent = value; };
            const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
            const slugify = (value) => value.toLowerCase().trim().replace(/[^a-z0-9\\s_-]/g, "").replace(/[\\s_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
            const normalizeCategory = (value) => String(value || "").trim() || "未分类";
            const refreshCategoryOptions = () => {
                const categories = [...new Set(posts.map((post) => normalizeCategory(post.category)))].sort();
                els.categoryOptions.innerHTML = categories.map((category) => '<option value="' + escapeHtml(category) + '"></option>').join("");
            };
            const requestJson = async (url, options) => {
                const response = await fetch(url, { headers: { "content-type": "application/json" }, ...options });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(payload.error || "请求失败");
                return payload;
            };
            const readImageFile = (file) => new Promise((resolve, reject) => {
                if (!file) return resolve(null);
                const reader = new FileReader();
                reader.addEventListener("load", () => {
                    const value = String(reader.result || "");
                    const [, base64 = ""] = value.split(",");
                    resolve({ name: file.name, type: file.type, base64 });
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
            const renderPostList = () => {
                els.postList.innerHTML = posts.map((post) => '<button class="post-item' + (post.slug === currentSlug ? ' active' : '') + '" type="button" data-slug="' + escapeHtml(post.slug) + '"><span class="post-title">' + escapeHtml(post.title) + '</span><span class="post-meta">' + escapeHtml(post.pubDate) + ' · ' + (post.featured ? '精选 · ' : '') + (post.draft ? '草稿' : '已发布') + '</span></button>').join("");
                els.postList.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => loadPost(button.dataset.slug)));
            };
            const loadPosts = async () => {
                posts = await requestJson("/api/posts");
                refreshCategoryOptions();
                renderPostList();
            };
            const loadPost = async (slug) => {
                const post = await requestJson("/api/posts/" + slug);
                currentSlug = slug;
                els.slug.value = post.slug;
                els.title.value = post.data.title || "";
                els.pubDate.value = String(post.data.pubDate || "").slice(0, 10);
                els.description.value = post.data.description || "";
                els.author.value = post.data.author || "";
                els.category.value = normalizeCategory(post.data.category);
                els.tags.value = (post.data.tags || []).join(", ");
                els.featured.checked = Boolean(post.data.featured);
                els.imageUrl.value = post.data.image?.url || "";
                els.imageAlt.value = post.data.image?.alt || "";
                els.imageFile.value = "";
                els.body.value = post.body || "";
                if (typeof window.refreshMarkdownPreview === "function") {
                    window.refreshMarkdownPreview();
                } else {
                    els.body.dispatchEvent(new Event("input", { bubbles: true }));
                }
                renderPostList();
                setStatus("已加载 " + slug + ".md");
            };
            const newPost = () => {
                currentSlug = "";
                els.form.reset();
                els.pubDate.value = new Date().toISOString().slice(0, 10);
                els.author.value = "catkin";
                els.category.value = "未分类";
                els.featured.checked = false;
                els.body.value = "";
                if (typeof window.refreshMarkdownPreview === "function") {
                    window.refreshMarkdownPreview();
                } else {
                    els.body.dispatchEvent(new Event("input", { bubbles: true }));
                }
                setStatus("正在新建文章。");
                renderPostList();
            };
            const save = async (draft) => {
                if (!els.form.reportValidity()) return;
                const payload = await formData(draft);
                await requestJson("/api/posts/" + payload.slug, { method: "PUT", body: JSON.stringify(payload) });
                currentSlug = payload.slug;
                await loadPosts();
                await loadPost(payload.slug);
                setStatus(draft ? "草稿已保存。" : "文章已发布。");
            };
            els.title.addEventListener("input", () => { if (!currentSlug) els.slug.value = slugify(els.title.value); });
            document.querySelector("#newPost").addEventListener("click", newPost);
            document.querySelector("#refreshPosts").addEventListener("click", () => loadPosts().catch((error) => setStatus(error.message)));
            document.querySelector("#logout").addEventListener("click", async () => { await fetch("/api/logout", { method: "POST" }); location.reload(); });
            document.querySelector("#saveDraft").addEventListener("click", () => save(true).catch((error) => setStatus(error.message)));
            document.querySelector("#publishPost").addEventListener("click", () => save(false).catch((error) => setStatus(error.message)));
            loadPosts().then(() => posts[0] ? loadPost(posts[0].slug) : newPost()).catch((error) => setStatus(error.message));
        </script>
        <script>
${adminEditorScript}
        </script>
    </body>
</html>`;
}

function renderPostCard(post, options = {}) {
    const coverUrl = post.data.image?.url || "/defaultCover.png";
    const coverAlt = post.data.image?.alt || `${post.data.title} 的文章封面`;
    return `
        <article class="post-card">
            <a class="post-card-link" href="/posts/${encodeURIComponent(post.id)}/">
                <img class="post-card-cover" src="${escapeAttr(coverUrl)}" alt="${escapeAttr(coverAlt)}" loading="lazy" />
                <div class="post-card-body">
                    <div class="post-card-meta">
                        <span>${escapeHtml(formatPostDate(post))}</span>
                        <span>${escapeHtml(post.data.author)}</span>
                        <span>${escapeHtml(normalizeCategory(post.data.category))}</span>
                        ${options.featured || post.data.featured ? '<span class="post-card-badge">精选</span>' : ""}
                    </div>
                    <h2>${escapeHtml(post.data.title)}</h2>
                    <p>${escapeHtml(post.data.description)}</p>
                </div>
            </a>
            <div class="post-card-tags" aria-label="文章标签">
                ${post.data.tags.map(renderTagLink).join("")}
            </div>
        </article>
    `;
}

function renderTagLink(tag, count = null) {
    const label = count === null ? tag : `${tag} (${count})`;
    return `<a href="/tags/${encodeURIComponent(tag)}/">${escapeHtml(label)}</a>`;
}

function renderLayout({
    title,
    body,
    active = "",
    description = defaultDescription,
    showTitle = true,
}) {
    return `<!doctype html>
<html lang="zh-CN">
    <head>
        <meta charset="utf-8" />
        <link rel="icon" type="image/png" href="/avatar.png" />
        <link rel="apple-touch-icon" href="/avatar.png" />
        <meta name="viewport" content="width=device-width" />
        <meta name="description" content="${escapeAttr(description)}" />
        <title>${escapeHtml(title)}</title>
        <script>try{const t=localStorage.getItem("theme");const d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d)}catch{}</script>
        <link rel="stylesheet" href="${katexCssHref}" crossorigin="anonymous" />
        <link rel="stylesheet" href="/site.css" />
    </head>
    <body>
        <div class="site-shell">
            ${renderSidebar(active)}
            <main class="site-main">
                ${showTitle ? `<h1>${escapeHtml(title)}</h1>` : ""}
                ${body}
                <hr />
                <footer class="site-footer">
                    <p>© 2026 By Catkin</p>
                    <p>Powered by Astro</p>
                </footer>
            </main>
        </div>
        <script src="/site.js" defer></script>
    </body>
</html>`;
}

function renderSidebar(active) {
    const navItems = [
        ["/", "首页"],
        ["/categories/", "分类"],
        ["/archive/", "归档"],
        ["/tags/", "标签"],
        ["/about/", "关于"],
    ];
    return `
        <header class="site-sidebar">
            <div class="sidebar-inner">
                <div class="sidebar-tools">
                    <button aria-expanded="false" aria-controls="main-menu" class="menu">菜单</button>
                    <button id="themeToggle" aria-label="Toggle theme">
                        <svg aria-hidden="true" width="30" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                            <path class="sun" fill-rule="evenodd" d="M12 17.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11zm0 1.5a7 7 0 1 0 0-14 7 7 0 0 0 0 14zm12-7a.8.8 0 0 1-.8.8h-2.4a.8.8 0 0 1 0-1.6h2.4a.8.8 0 0 1 .8.8zM4 12a.8.8 0 0 1-.8.8H.8a.8.8 0 0 1 0-1.6h2.5a.8.8 0 0 1 .8.8zm16.5-8.5a.8.8 0 0 1 0 1l-1.8 1.8a.8.8 0 0 1-1-1l1.7-1.8a.8.8 0 0 1 1 0zM6.3 17.7a.8.8 0 0 1 0 1l-1.7 1.8a.8.8 0 1 1-1-1l1.7-1.8a.8.8 0 0 1 1 0zM12 0a.8.8 0 0 1 .8.8v2.5a.8.8 0 0 1-1.6 0V.8A.8.8 0 0 1 12 0zm0 20a.8.8 0 0 1 .8.8v2.4a.8.8 0 0 1-1.6 0v-2.4a.8.8 0 0 1 .8-.8zM3.5 3.5a.8.8 0 0 1 1 0l1.8 1.8a.8.8 0 1 1-1 1L3.5 4.6a.8.8 0 0 1 0-1zm14.2 14.2a.8.8 0 0 1 1 0l1.8 1.7a.8.8 0 0 1-1 1l-1.8-1.7a.8.8 0 0 1 0-1z"></path>
                            <path class="moon" fill-rule="evenodd" d="M16.5 6A10.5 10.5 0 0 1 4.7 16.4 8.5 8.5 0 1 0 16.4 4.7l.1 1.3zm-1.7-2a9 9 0 0 1 .2 2 9 9 0 0 1-11 8.8 9.4 9.4 0 0 1-.8-.3c-.4 0-.8.3-.7.7a10 10 0 0 0 .3.8 10 10 0 0 0 9.2 6 10 10 0 0 0 4-19.2 9.7 9.7 0 0 0-.9-.3c-.3-.1-.7.3-.6.7a9 9 0 0 1 .3.8z"></path>
                        </svg>
                    </button>
                </div>
                <div class="sidebar-search" role="search">
                    <label for="site-search">搜索文章</label>
                    <input id="site-search" type="search" autocomplete="off" placeholder="标题 / 标签 / 作者" />
                    <div id="search-results" class="search-results" hidden></div>
                </div>
                <a class="profile" href="/" aria-label="Catkin 的首页">
                    <img src="/avatar.png" alt="Catkin 的头像" width="96" height="96" />
                    <span class="profile-name">Catkin</span>
                    <span class="profile-signature">以渺小启程</span>
                </a>
                <nav aria-label="主导航">
                    <div id="main-menu" class="nav-links">
                        ${navItems
                            .map(
                                ([href, label]) =>
                                    `<a class="${active === href ? "active" : ""}" href="${href}">${label}</a>`,
                            )
                            .join("")}
                    </div>
                </nav>
            </div>
        </header>
    `;
}

export function escapeHtml(value) {
    return String(value ?? "").replace(
        /[&<>"']/g,
        (char) =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
            })[char],
    );
}

function escapeAttr(value) {
    return escapeHtml(value);
}

function escapeXml(value) {
    return escapeHtml(value);
}
