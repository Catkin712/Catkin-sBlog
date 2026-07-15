import { marked } from "marked";
import markedKatex from "marked-katex-extension";

const postsPath = "src/content/posts";
const cacheTtl = 60 * 1000;
let postsCache = {
    expiresAt: 0,
    posts: null,
};

marked.setOptions({
    gfm: true,
    breaks: false,
});
marked.use(markedKatex({ throwOnError: false, strict: "ignore", nonStandard: true }));

export function clearPostCache() {
    postsCache = {
        expiresAt: 0,
        posts: null,
    };
}

export async function getAllPosts(env) {
    const now = Date.now();
    if (postsCache.posts && postsCache.expiresAt > now) {
        return postsCache.posts;
    }

    const files = await listGitHubDirectory(env, postsPath);
    const posts = await Promise.all(
        files
            .filter((file) => file.type === "file" && file.name.endsWith(".md"))
            .map(async (file) => {
                const slug = file.name.replace(/\.md$/, "");
                const markdown = await readGitHubTextFile(env, `${postsPath}/${file.name}`);
                return parsePost(slug, markdown);
            }),
    );

    postsCache = {
        expiresAt: now + cacheTtl,
        posts,
    };
    return posts;
}

export async function getPublishedPosts(env) {
    const posts = await getAllPosts(env);
    return posts
        .filter((post) => !post.data.draft)
        .sort((a, b) => dateValue(b) - dateValue(a));
}

export async function getPublishedPost(env, slug) {
    assertSlug(slug);
    const posts = await getPublishedPosts(env);
    return posts.find((post) => post.id === slug) ?? null;
}

export async function readPost(env, slug) {
    assertSlug(slug);
    const markdown = await readGitHubTextFile(env, `${postsPath}/${slug}.md`);
    return parsePost(slug, markdown);
}

export async function listAdminPosts(env) {
    const posts = await getAllPosts(env);
    return posts
        .map((post) => ({
            slug: post.slug,
            title: post.data.title,
            pubDate: post.data.pubDate,
            description: post.data.description,
            author: post.data.author,
            category: post.data.category,
            tags: post.data.tags,
            featured: post.data.featured,
            draft: post.data.draft,
        }))
        .sort((a, b) => String(b.pubDate).localeCompare(String(a.pubDate)));
}

export async function writePost(env, slug, payload) {
    assertSlug(slug);
    if (payload.slug !== slug) {
        throw new Error("Slug 与请求路径不一致");
    }

    const post = normalizePost(payload);
    if (payload.imageUpload?.base64) {
        post.image = await saveCover(env, slug, payload.imageUpload, payload.imageAlt || post.title);
    }

    await writeGitHubTextFile(
        env,
        `${postsPath}/${slug}.md`,
        serializeMarkdown(post),
        `content: ${post.draft ? "save draft" : "publish"} ${slug}`,
    );
    clearPostCache();
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

function parsePost(slug, markdown) {
    const { data, body } = parseMarkdown(markdown);
    return {
        id: slug,
        slug,
        data,
        body,
        html: marked.parse(body),
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
            url: String(payload.imageUrl).trim(),
            alt: String(payload.imageAlt ?? "").trim() || post.title,
        };
    }

    return post;
}

async function saveCover(env, slug, upload, alt) {
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

    const bytes = base64ToBytes(String(upload.base64));
    if (bytes.byteLength > 5_000_000) {
        throw new Error("封面图片不能超过 5MB");
    }

    const fileName = `${slug}.${extension}`;
    await writeGitHubBase64File(
        env,
        `public/covers/${fileName}`,
        String(upload.base64),
        `content: update cover for ${slug}`,
    );
    return {
        url: `/covers/${fileName}`,
        alt: String(alt ?? "").trim() || slug,
    };
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

function assertSlug(slug) {
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(slug)) {
        throw new Error("Slug 只能包含小写字母、数字、短横线和下划线");
    }
}

function getGitHubConfig(env) {
    const token = env.GITHUB_TOKEN;
    const owner = env.GITHUB_OWNER;
    const repo = env.GITHUB_REPO;
    const branch = env.GITHUB_BRANCH || "main";
    const missing = [
        ["GITHUB_TOKEN", token],
        ["GITHUB_OWNER", owner],
        ["GITHUB_REPO", repo],
    ]
        .filter(([, value]) => !value)
        .map(([name]) => name);

    if (missing.length > 0) {
        throw new Error(`缺少 GitHub 环境变量：${missing.join(", ")}`);
    }

    return { token, owner, repo, branch };
}

async function githubRequest(env, apiPath, options = {}) {
    const { token, owner, repo } = getGitHubConfig(env);
    const { allowMissing, headers, ...fetchOptions } = options;
    let response;
    try {
        response = await fetch(`https://api.github.com/repos/${owner}/${repo}${apiPath}`, {
            ...fetchOptions,
            headers: {
                accept: "application/vnd.github+json",
                authorization: `Bearer ${token}`,
                "content-type": "application/json",
                "user-agent": "catkins-blog-cloudflare-pages",
                "x-github-api-version": "2022-11-28",
                ...(headers ?? {}),
            },
        });
    } catch (error) {
        throw new Error(`GitHub API 请求失败：${error.cause?.message ?? error.message}`);
    }

    if (response.status === 404 && allowMissing) {
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

async function listGitHubDirectory(env, repoPath) {
    const { branch } = getGitHubConfig(env);
    return await githubRequest(
        env,
        `/contents/${encodeRepoPath(repoPath)}?ref=${encodeURIComponent(branch)}`,
    );
}

async function getGitHubContent(env, repoPath) {
    const { branch } = getGitHubConfig(env);
    return await githubRequest(
        env,
        `/contents/${encodeRepoPath(repoPath)}?ref=${encodeURIComponent(branch)}`,
        { allowMissing: true },
    );
}

async function readGitHubTextFile(env, repoPath) {
    const file = await getGitHubContent(env, repoPath);
    if (!file?.content) {
        throw new Error(`GitHub 中不存在 ${repoPath}`);
    }
    return decodeBase64ToText(file.content.replace(/\n/g, ""));
}

async function writeGitHubTextFile(env, repoPath, content, message) {
    await writeGitHubBase64File(env, repoPath, encodeTextToBase64(content), message);
}

async function writeGitHubBase64File(env, repoPath, base64Content, message) {
    const { branch } = getGitHubConfig(env);
    const existing = await getGitHubContent(env, repoPath);
    const body = {
        message,
        content: base64Content,
        branch,
    };

    if (existing?.sha) {
        body.sha = existing.sha;
    }

    await githubRequest(env, `/contents/${encodeRepoPath(repoPath)}`, {
        method: "PUT",
        body: JSON.stringify(body),
    });
}

function decodeBase64ToText(base64) {
    return new TextDecoder().decode(base64ToBytes(base64));
}

function encodeTextToBase64(text) {
    return bytesToBase64(new TextEncoder().encode(text));
}

function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function bytesToBase64(bytes) {
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
}
