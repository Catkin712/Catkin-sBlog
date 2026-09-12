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
const selectedTitle = "恨7不成妻~完整思路";

const descriptions = {
    "IDA*": "从估价函数、迭代加深和剪枝入手，整理 IDA* 在排书问题中的搜索设计与复杂度分析。",
    "双向DFS": "以折半搜索为主线，说明如何把物品分成两组、排序去重并用二分查找合并最优答案。",
    "A*": "介绍 A* 的真实距离与估计距离、堆优化搜索，以及估价函数保证最优解的基本证明。",
    "博弈论与SG函数": "从 Nim 游戏出发，梳理公平组合游戏、有向图游戏、Mex 运算与 SG 函数的核心结论。",
    "矩阵乘法": "从矩阵运算定义推导线性递推的矩阵表示，并结合斐波那契数列说明矩阵快速幂的思路。",
    "【算法竞赛进阶指南】素数": "整理试除法、埃氏筛和线性筛的证明、模板与复杂度，作为素数处理的速查笔记。",
    "最短路计数问题": "比较 BFS、Dijkstra、双端队列 BFS 与 SPFA 在最短路计数中的适用条件和实现要点。",
    "迭代加深": "解释迭代加深如何用较小空间搜索较深答案，并结合搜索顺序和排重剪枝提升效率。",
    "Acwing168.生日蛋糕": "围绕生日蛋糕问题拆解外层搜索、半径高度枚举，以及上下界、体积和表面积等剪枝方法。",
    "剪枝": "总结搜索中的顺序优化、等效冗余排除、可行性剪枝和最优性剪枝，并配合典型题目说明。",
    "第k短路(A*)": "使用反向 Dijkstra 求估价函数，再借助 A* 的优先队列性质推导第 k 短路的搜索过程。",
    "BFS(双向广搜)": "以字符串变换为例，说明双向广搜如何从起点和终点同时扩展，显著减少状态数量。",
    "BFS(双端队列)": "把 0/1 边权最短路转化为双端队列 BFS，整理队列单调性、正确性和常用代码框架。",
    "最长公共子序列问题【LCS】": "从状态定义和分类转移出发，整理最长公共子序列的经典动态规划解法与复杂度。",
    "最长上升子序列问题【LIS】": "记录用贪心和二分把 LIS 从平方复杂度优化到 O(n log n) 的方法，并解释序列维护含义。",
    "单调队列——求滑动窗口最值": "用一段简洁模板记录单调队列求固定窗口最值的做法、下标维护和边界注意事项。",
    "恨7不成妻~完整思路": "完整梳理数位 DP 中计数、数字和、平方和等非计数状态的维护方式与状态转移。",
    "有关多重背包的二进制优化": "从多重背包的朴素三重循环出发，推导二进制拆分并转化为 01 背包的优化方法。",
    "Dijkstra算法求最短路": "从贪心确定点和松弛操作出发，整理朴素 Dijkstra 的实现结构、适用图形与时间复杂度。",
    "P4933大师": "以等差子序列为状态，说明如何按位置和公差进行动态规划，并处理负公差的下标映射。",
    "P1725 琪露诺": "把跳跃转移写成滑动区间最大值，使用单调队列优化 P1725 的动态规划边界与复杂度。",
};

const categoryFallbacks = {
    "博弈论与SG函数": "博弈论",
};

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

db.exec("BEGIN IMMEDIATE");
try {
    for (const article of articles) {
        const title = String(article.title || "").trim();
        const lid = String(article.lid || "").trim();
        const body = String(article.content || "").trim();
        if (!title || !lid || !body) {
            throw new Error(`文章数据不完整：${lid || title || "unknown"}`);
        }

        const category = String(
            categoryFallbacks[title] || article.categoryOld || "个人记录",
        ).trim();
        const pubDate = formatShanghaiDate(article.time);
        const description = descriptions[title] || `${category}相关的算法学习与代码记录。`;
        const tags = [...new Set(["洛谷迁移", category].filter(Boolean))];

        upsert.run(
            `luogu-${lid}`,
            title,
            pubDate,
            description,
            "willow_Catkin",
            category,
            coverPath,
            `${title} 的统一封面`,
            JSON.stringify(tags),
            title === selectedTitle ? 1 : 0,
            0,
            body,
            now,
            now,
        );
    }
    db.exec("COMMIT");
} catch (error) {
    db.exec("ROLLBACK");
    throw error;
}

console.log(`已导入 ${articles.length} 篇洛谷文章`);
console.log(`数据库：${databasePath}`);
console.log(`精选文章：${selectedTitle}`);

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
