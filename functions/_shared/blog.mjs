import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { marked } from "marked";
import markedKatex from "marked-katex-extension";
import { albumStoragePaths } from "./album-storage.mjs";
import {
    cosObjectUrl,
    createCosObjectKey,
    deleteCosObject,
    mediaUrl,
    normalizeObjectKey,
} from "./cos.mjs";

const postsPath = "src/content/posts";
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const databases = new Map();
const initializations = new Map();

marked.setOptions({
    gfm: true,
    breaks: false,
});
marked.use(markedKatex({ throwOnError: false, strict: "ignore", nonStandard: true }));

export function clearPostCache() {
    // SQLite is the source of truth and writes are visible immediately.
}

export async function getAllPosts(env = {}) {
    const db = await getReadyDatabase(env);
    return db.prepare("SELECT * FROM posts ORDER BY pub_date DESC, slug ASC")
        .all()
        .map((row) => rowToPost(row, env));
}

export async function getPublishedPosts(env = {}) {
    const db = await getReadyDatabase(env);
    return db.prepare("SELECT * FROM posts WHERE draft = 0 ORDER BY pub_date DESC, slug ASC")
        .all()
        .map((row) => rowToPost(row, env));
}

export async function getPublishedPost(env = {}, slug) {
    assertSlug(slug);
    const row = (await getReadyDatabase(env))
        .prepare("SELECT * FROM posts WHERE slug = ? AND draft = 0")
        .get(slug);
    return row ? rowToPost(row, env) : null;
}

export async function readPost(env = {}, slug) {
    assertSlug(slug);
    const row = (await getReadyDatabase(env))
        .prepare("SELECT * FROM posts WHERE slug = ?")
        .get(slug);
    if (!row) {
        throw new Error(`文章 ${slug} 不存在`);
    }
    return rowToPost(row, env);
}

export async function listAdminPosts(env = {}) {
    const db = await getReadyDatabase(env);
    return db.prepare(`
        SELECT slug, title, pub_date AS pubDate, description, author, category,
               tags_json AS tagsJson, featured, draft
        FROM posts
        ORDER BY pub_date DESC, slug ASC
    `).all().map((row) => ({
        slug: row.slug,
        title: row.title,
        pubDate: row.pubDate,
        description: row.description,
        author: row.author,
        category: row.category,
        tags: parseTags(row.tagsJson),
        featured: Boolean(row.featured),
        draft: Boolean(row.draft),
    }));
}

export async function writePost(env = {}, slug, payload = {}) {
    assertSlug(slug);
    if (payload.slug !== slug) {
        throw new Error("Slug 与请求路径不一致");
    }

    const db = await getReadyDatabase(env);
    const existing = db.prepare("SELECT image_url AS imageUrl FROM posts WHERE slug = ?").get(slug);
    const post = normalizePost(env, payload);
    let uploadedCoverKey = null;

    if (payload.imageUpload?.base64) {
        const cover = await saveCover(env, slug, payload.imageUpload);
        uploadedCoverKey = cover.key;
        post.image = {
            url: cover.value,
            alt: String(payload.imageAlt ?? "").trim() || post.title,
        };
    }

    const now = new Date().toISOString();
    try {
        db.prepare(`
            INSERT INTO posts (
                slug, title, pub_date, description, author, category,
                image_url, image_alt, tags_json, featured, draft, body,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(slug) DO UPDATE SET
                title = excluded.title,
                pub_date = excluded.pub_date,
                description = excluded.description,
                author = excluded.author,
                category = excluded.category,
                image_url = excluded.image_url,
                image_alt = excluded.image_alt,
                tags_json = excluded.tags_json,
                featured = excluded.featured,
                draft = excluded.draft,
                body = excluded.body,
                updated_at = excluded.updated_at
        `).run(
            slug,
            post.title,
            post.pubDate,
            post.description,
            post.author,
            post.category,
            post.image?.url || "",
            post.image?.alt || "",
            JSON.stringify(post.tags),
            post.featured ? 1 : 0,
            post.draft ? 1 : 0,
            post.body,
            now,
            now,
        );
    } catch (error) {
        if (uploadedCoverKey) {
            await deleteCosObject(env, uploadedCoverKey).catch(() => {});
        }
        throw error;
    }

    const oldCoverKey = cosKeyFromValue(existing?.imageUrl);
    const nextCoverKey = cosKeyFromValue(post.image?.url);
    if (oldCoverKey && oldCoverKey !== nextCoverKey) {
        const references = db.prepare("SELECT COUNT(*) AS count FROM posts WHERE image_url = ?")
            .get(`cos:${oldCoverKey}`);
        if (Number(references?.count || 0) === 0) {
            await deleteCosObject(env, oldCoverKey).catch(() => {});
        }
    }
}

export function publicPostSummary(post) {
    return {
        title: post.data.title,
        description: post.data.description,
        author: post.data.author,
        category: post.data.category,
        tags: post.data.tags,
        pubDate: formatPostDate(post),
        url: `/posts/${post.id}/`,
    };
}

export function formatPostDate(post) {
    return String(post.data.pubDate).slice(0, 10);
}

export function dateValue(post) {
    const value = new Date(post.data.pubDate).valueOf();
    return Number.isNaN(value) ? 0 : value;
}

export function getPublishedTags(posts) {
    return [...new Set(posts.flatMap((post) => post.data.tags))].sort();
}

export function getPublishedCategories(posts) {
    return [...new Set(posts.map((post) => normalizeCategory(post.data.category)))].sort();
}

export function normalizeCategory(value) {
    return String(value ?? "").trim() || "未分类";
}

function getDatabase(env) {
    const { databaseFile: defaultDatabaseFile } = albumStoragePaths(env);
    const databaseFile = path.resolve(env.BLOG_DB_FILE || defaultDatabaseFile);
    if (databases.has(databaseFile)) {
        return databases.get(databaseFile);
    }

    mkdirSync(path.dirname(databaseFile), { recursive: true });
    const db = new DatabaseSync(databaseFile);
    db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
    db.exec(`
        CREATE TABLE IF NOT EXISTS posts (
            slug TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            pub_date TEXT NOT NULL,
            description TEXT NOT NULL,
            author TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT '未分类',
            image_url TEXT NOT NULL DEFAULT '',
            image_alt TEXT NOT NULL DEFAULT '',
            tags_json TEXT NOT NULL DEFAULT '[]',
            featured INTEGER NOT NULL DEFAULT 0,
            draft INTEGER NOT NULL DEFAULT 0,
            body TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS blog_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_posts_published
            ON posts(draft, pub_date DESC);
        CREATE INDEX IF NOT EXISTS idx_posts_category
            ON posts(category, draft, pub_date DESC);
    `);
    databases.set(databaseFile, db);
    return db;
}

async function getReadyDatabase(env) {
    const db = getDatabase(env);
    const { databaseFile: defaultDatabaseFile } = albumStoragePaths(env);
    const databaseFile = path.resolve(env.BLOG_DB_FILE || defaultDatabaseFile);
    if (!initializations.has(databaseFile)) {
        const initialization = initializePostStore(db, env).catch((error) => {
            initializations.delete(databaseFile);
            throw error;
        });
        initializations.set(databaseFile, initialization);
    }
    await initializations.get(databaseFile);
    return db;
}

async function initializePostStore(db, env) {
    if (db.prepare("SELECT 1 FROM blog_meta WHERE key = 'post_store_initialized'").get()) {
        return;
    }

    let importedPosts = [];
    if (hasGitHubConfig(env)) {
        try {
            importedPosts = await readGitHubPosts(env);
            console.log(`Imported ${importedPosts.length} posts from GitHub into SQLite`);
        } catch (error) {
            console.warn(`GitHub post import failed, using bundled Markdown: ${error.message}`);
        }
    }
    if (importedPosts.length === 0) {
        importedPosts = readBundledPosts();
        console.log(`Imported ${importedPosts.length} bundled posts into SQLite`);
    }

    const now = new Date().toISOString();
    const insert = db.prepare(`
        INSERT OR IGNORE INTO posts (
            slug, title, pub_date, description, author, category,
            image_url, image_alt, tags_json, featured, draft, body,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    db.exec("BEGIN IMMEDIATE");
    try {
        for (const post of importedPosts) {
            insert.run(
                post.slug,
                post.data.title,
                post.data.pubDate,
                post.data.description,
                post.data.author,
                post.data.category,
                post.data.image?.url || "",
                post.data.image?.alt || "",
                JSON.stringify(post.data.tags),
                post.data.featured ? 1 : 0,
                post.data.draft ? 1 : 0,
                post.body,
                now,
                now,
            );
        }
        db.prepare("INSERT OR REPLACE INTO blog_meta (key, value) VALUES ('post_store_initialized', ?)")
            .run(JSON.stringify({ completedAt: now, imported: importedPosts.length }));
        db.exec("COMMIT");
    } catch (error) {
        db.exec("ROLLBACK");
        throw error;
    }
}

function rowToPost(row, env) {
    const imageUrl = row.image_url ? mediaUrl(env, row.image_url) : "";
    const data = {
        title: row.title,
        pubDate: row.pub_date,
        description: row.description,
        author: row.author,
        category: normalizeCategory(row.category),
        tags: parseTags(row.tags_json),
        featured: Boolean(row.featured),
        draft: Boolean(row.draft),
    };
    if (imageUrl) {
        data.image = { url: imageUrl, alt: row.image_alt || row.title };
    }
    return {
        id: row.slug,
        slug: row.slug,
        data,
        body: row.body,
        html: marked.parse(row.body),
    };
}

function parsePost(slug, markdown) {
    const { data, body } = parseMarkdown(markdown);
    return { id: slug, slug, data, body, html: marked.parse(body) };
}

function parseMarkdown(markdown) {
    const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(markdown);
    if (!match) {
        throw new Error("Markdown 缺少 frontmatter");
    }
    return { data: parseFrontmatter(match[1]), body: match[2].trimStart() };
}

function parseFrontmatter(frontmatter) {
    const data = { tags: [], featured: false, draft: false, category: "未分类" };
    const lines = frontmatter.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
        const keyValue = /^([a-zA-Z][\w-]*):\s*(.*)$/.exec(lines[i]);
        if (!keyValue) continue;
        const [, key, rawValue] = keyValue;
        if (key === "image" && rawValue === "") {
            const image = {};
            while (lines[i + 1]?.startsWith("    ") || lines[i + 1]?.startsWith("  ")) {
                i += 1;
                const child = /^\s+([a-zA-Z][\w-]*):\s*(.*)$/.exec(lines[i]);
                if (child) image[child[1]] = parseScalar(child[2]);
            }
            data.image = image;
            continue;
        }
        data[key] = parseScalar(rawValue);
    }
    return {
        title: String(data.title ?? ""),
        pubDate: String(data.pubDate ?? ""),
        description: String(data.description ?? ""),
        author: String(data.author ?? ""),
        category: normalizeCategory(data.category),
        image: data.image,
        tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
        featured: Boolean(data.featured),
        draft: Boolean(data.draft),
    };
}

function parseScalar(value) {
    const trimmed = value.trim();
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        return JSON.parse(trimmed.replaceAll("'", '"'));
    }
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}

function normalizePost(env, payload) {
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
        category: normalizeCategory(payload.category),
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
            url: normalizeMediaStorageValue(env, payload.imageUrl),
            alt: String(payload.imageAlt ?? "").trim() || post.title,
        };
    }
    return post;
}

function normalizeMediaStorageValue(env, value) {
    const text = String(value || "").trim();
    if (!text || text.startsWith("cos:")) return text;
    try {
        const url = new URL(text);
        const cosHost = `${env.COS_BUCKET}.cos.${env.COS_REGION}.myqcloud.com`;
        if (url.hostname === cosHost) {
            const key = url.pathname.split("/").filter(Boolean).map(decodeURIComponent).join("/");
            return `cos:${normalizeObjectKey(key)}`;
        }
    } catch {
        // Relative and external URLs remain valid article media references.
    }
    return text;
}

async function saveCover(env, slug, upload) {
    const extensions = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/webp": "webp",
        "image/gif": "gif",
    };
    const extension = extensions[upload.type];
    if (!extension) throw new Error("封面只支持 PNG、JPG、WebP 或 GIF");
    const bytes = Buffer.from(String(upload.base64 || ""), "base64");
    if (bytes.length <= 0 || bytes.length > 5 * 1024 * 1024) {
        throw new Error("封面图片不能超过 5 MB");
    }
    const key = createCosObjectKey(env, "cover", "public", extension);
    const response = await fetch(cosObjectUrl(env, key, "PUT"), {
        method: "PUT",
        headers: { "content-type": upload.type },
        body: bytes,
    });
    if (!response.ok) {
        throw new Error(`封面上传到 COS 失败（HTTP ${response.status}）`);
    }
    return { key, value: `cos:${key}`, slug };
}

function cosKeyFromValue(value) {
    return String(value || "").startsWith("cos:") ? String(value).slice(4) : null;
}

function parseTags(value) {
    try {
        const tags = JSON.parse(String(value || "[]"));
        return Array.isArray(tags) ? tags.map(String) : [];
    } catch {
        return [];
    }
}

function assertSlug(slug) {
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(slug)) {
        throw new Error("Slug 只能包含小写字母、数字、短横线和下划线");
    }
}

function readBundledPosts() {
    const directory = path.join(projectRoot, postsPath);
    return readdirSync(directory, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
        .map((entry) => {
            const slug = entry.name.replace(/\.md$/, "");
            return parsePost(slug, readFileSync(path.join(directory, entry.name), "utf8"));
        });
}

function hasGitHubConfig(env) {
    return Boolean(env.GITHUB_TOKEN && env.GITHUB_OWNER && env.GITHUB_REPO);
}

async function readGitHubPosts(env) {
    const files = await githubRequest(env, `/contents/${encodeRepoPath(postsPath)}?ref=${encodeURIComponent(env.GITHUB_BRANCH || "main")}`);
    return await Promise.all(files
        .filter((file) => file.type === "file" && file.name.endsWith(".md"))
        .map(async (file) => {
            const content = await githubRequest(env, `/contents/${encodeRepoPath(`${postsPath}/${file.name}`)}?ref=${encodeURIComponent(env.GITHUB_BRANCH || "main")}`);
            return parsePost(file.name.replace(/\.md$/, ""), Buffer.from(content.content.replace(/\n/g, ""), "base64").toString("utf8"));
        }));
}

async function githubRequest(env, apiPath) {
    const response = await fetch(`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}${apiPath}`, {
        headers: {
            accept: "application/vnd.github+json",
            authorization: `Bearer ${env.GITHUB_TOKEN}`,
            "user-agent": "catkins-blog-post-migration",
            "x-github-api-version": "2022-11-28",
        },
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;
    if (!response.ok) {
        throw new Error(payload?.message || `GitHub API 返回 ${response.status}`);
    }
    return payload;
}

function encodeRepoPath(repoPath) {
    return repoPath.split("/").map(encodeURIComponent).join("/");
}
