import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(projectRoot, "scripts", "luogu-articles.json");
const defaultDatabasePath = process.platform === "win32"
    ? path.join(projectRoot, "data", "albums", "catkinsblog.sqlite")
    : "/var/lib/catkinsblog/catkinsblog.sqlite";
const databasePath = path.resolve(process.env.BLOG_DB_FILE || defaultDatabasePath);
const coverPath = "/covers/luogu-articles.jpg";

const articles = JSON.parse(readFileSync(sourcePath, "utf8").replace(/^\uFEFF/, ""));
if (!Array.isArray(articles) || articles.length === 0) {
    throw new Error(`迁移源为空：${sourcePath}`);
}

const db = new DatabaseSync(databasePath);
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
    CREATE TABLE IF NOT EXISTS post_likes (
        id INTEGER PRIMARY KEY,
        post_slug TEXT NOT NULL REFERENCES posts(slug) ON DELETE CASCADE,
        nickname TEXT NOT NULL,
        nickname_key TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (post_slug, nickname_key)
    );
    CREATE TABLE IF NOT EXISTS post_comments (
        id INTEGER PRIMARY KEY,
        post_slug TEXT NOT NULL REFERENCES posts(slug) ON DELETE CASCADE,
        nickname TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_posts_published
        ON posts(draft, pub_date DESC);
    CREATE INDEX IF NOT EXISTS idx_posts_category
        ON posts(category, draft, pub_date DESC);
`);

const now = new Date().toISOString();
const upsert = db.prepare(`
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
`);

const description = "算法相关的学习笔记与代码记录。";

let imported = 0;
db.exec("BEGIN IMMEDIATE");
try {
    for (const article of articles) {
        const title = String(article.title || "").trim();
        const lid = String(article.lid || "").trim();
        const body = String(article.content || "").trim();
        if (!title || !lid || !body) {
            throw new Error(`文章数据不完整：${lid || title || "unknown"}`);
        }

        const pubDate = formatShanghaiDate(article.time);
        const tags = [...new Set(["洛谷迁移", "算法"])]

        upsert.run(
            `luogu-${lid}`,
            title,
            pubDate,
            description,
            "willow_Catkin",
            "算法",
            coverPath,
            `${title} 的统一封面`,
            JSON.stringify(tags),
            0,
            0,
            body,
            now,
            now,
        );
        imported += 1;
    }
    db.exec("COMMIT");
} catch (error) {
    db.exec("ROLLBACK");
    throw error;
}

console.log(`已导入 ${imported} 篇洛谷文章`);
console.log(`数据库：${databasePath}`);

function formatShanghaiDate(unixSeconds) {
    const timestamp = Number(unixSeconds);
    if (!Number.isFinite(timestamp)) {
        throw new Error(`发布时间无效：${unixSeconds}`);
    }
    const date = new Date(timestamp * 1000);
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(date);
}
