import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, cp, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getBlobStore } from "../../functions/_shared/blob-store.mjs";
import { decryptSeed } from "../../functions/_shared/seed-crypto.mjs";

const runtimeDir = path.dirname(fileURLToPath(import.meta.url));
const databaseStoreName = "catkinsblog-database";
const databaseKey = "catkinsblog.sqlite";
const lockStoreName = "catkinsblog-locks";
const lockKey = "database-write";
const lockWaitMs = 9_000;
const lockTtlMs = 60_000;

let cachedDatabase = null;
let uploadsPromise = null;

export function isWriteRequest(request) {
    const method = String(request.method || "GET").toUpperCase();
    if (["GET", "HEAD", "OPTIONS"].includes(method)) {
        return false;
    }

    const pathname = new URL(request.url).pathname;
    if (pathname === "/api/guestbook" && method === "POST") return true;
    if (pathname === "/api/albums" && method === "POST") return true;
    if (/^\/api\/album-upload-sessions\/[^/]+\/complete$/.test(pathname) && method === "POST") return true;
    if (pathname.startsWith("/api/admin/") && ["PATCH", "DELETE"].includes(method)) return true;
    if (/^\/api\/album-uploads\/[^/]+\/(likes|comments)$/.test(pathname) && method === "POST") return true;
    if (/^\/api\/posts\/[^/]+$/.test(pathname) && method === "PUT") return true;
    if (/^\/api\/posts\/[^/]+\/(likes|comments)$/.test(pathname) && method === "POST") return true;
    return false;
}

export async function prepareReadEnv() {
    const state = await ensureDatabase();
    return buildEnv(state, process.env);
}

export async function withDatabaseWrite(callback) {
    const lock = await acquireLock();
    try {
        const state = await ensureDatabase({ force: true });
        const env = await buildEnv(state, process.env);
        const result = await callback(env);
        await persistDatabase(state);
        return result;
    } finally {
        await releaseLock(lock);
    }
}

export function errorResponse(request, error) {
    const message = error?.message || String(error);
    const status = Number(error?.status) || 500;
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
        return new Response(JSON.stringify({ error: message }), {
            status,
            headers: {
                "content-type": "application/json; charset=utf-8",
                "cache-control": "no-store",
            },
        });
    }
    return new Response(status === 503 ? message : `服务暂时不可用：${message}`, {
        status,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
}

async function ensureDatabase({ force = false } = {}) {
    const store = getBlobStore(databaseStoreName);
    const metadata = await store.getMetadata(databaseKey);
    const etag = metadata?.etag || "seed";

    if (!force && cachedDatabase?.etag === etag && existsSync(cachedDatabase.filePath)) {
        return cachedDatabase;
    }

    const filePath = path.join(
        os.tmpdir(),
        `catkinsblog-${safeEtag(etag)}-${randomUUID()}.sqlite`,
    );
    await mkdir(path.dirname(filePath), { recursive: true });

    if (!metadata) {
        const seed = await resolveSeedDatabase();
        const temporary = `${filePath}.tmp`;
        await copyFile(seed, temporary);
        await rename(temporary, filePath);
    } else {
        const data = await store.get(databaseKey, { type: "arrayBuffer" });
        if (!data) {
            throw httpError("数据库暂时不可用，请稍后重试", 503);
        }
        await writeFile(filePath, Buffer.from(data));
    }

    const state = { etag, filePath };
    if (!force) {
        cachedDatabase = state;
    }
    return state;
}

async function persistDatabase(state) {
    const { DatabaseSync } = await import("node:sqlite");
    const checkpoint = new DatabaseSync(state.filePath);
    try {
        let busy = true;
        for (let attempt = 0; attempt < 5 && busy; attempt += 1) {
            const result = checkpoint.prepare("PRAGMA wal_checkpoint(TRUNCATE);").get();
            busy = Boolean(result?.busy);
            if (busy) await sleep(25);
        }
        if (busy) {
            throw httpError("数据库正在被其他请求读取，请稍后重试", 503);
        }
    } finally {
        checkpoint.close();
    }

    const bytes = await readFile(state.filePath);
    if (!bytes.length) {
        throw httpError("数据库保存失败，请稍后重试", 500);
    }

    const store = getBlobStore(databaseStoreName);
    const options = state.etag === "seed" ? { onlyIfNew: true } : { onlyIfMatch: state.etag };
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const result = await store.set(databaseKey, arrayBuffer, options);
    if (!result.modified) {
        throw httpError("站点刚刚被另一个请求更新，请重试刚才的操作", 503);
    }
    cachedDatabase = { etag: result.etag, filePath: state.filePath };
}

async function buildEnv(state, baseEnv) {
    const uploadsRoot = await ensureUploads();
    const directory = path.dirname(state.filePath);
    return {
        ...baseEnv,
        BLOG_DB_FILE: state.filePath,
        ALBUM_DB_FILE: state.filePath,
        SITE_STATS_DB_FILE: state.filePath,
        GUESTBOOK_DB_FILE: state.filePath,
        ALBUM_DATA_DIR: directory,
        UPLOADS_DIR: uploadsRoot,
        SQLITE_JOURNAL_MODE: "WAL",
        CATKINS_USE_BLOBS: "true",
    };
}

async function ensureUploads() {
    if (uploadsPromise) {
        return uploadsPromise;
    }
    uploadsPromise = (async () => {
        const seed = seedUploadsPath();
        const target = path.join(os.tmpdir(), "catkinsblog-uploads");
        if (existsSync(target)) {
            return target;
        }
        await mkdir(target, { recursive: true });
        if (existsSync(seed)) {
            await cp(seed, target, { recursive: true, force: true });
        }
        return target;
    })();
    return uploadsPromise;
}

async function resolveSeedDatabase() {
    const plain = firstExisting([
        process.env.CATKINS_SEED_DB,
        path.join(process.cwd(), "netlify", "seed", "catkinsblog.sqlite"),
        path.join(runtimeDir, "..", "seed", "catkinsblog.sqlite"),
        path.join(runtimeDir, "..", "..", "netlify", "seed", "catkinsblog.sqlite"),
    ]);
    if (plain) {
        return plain;
    }

    const encrypted = firstExisting([
        process.env.CATKINS_SEED_DB_ENC,
        path.join(process.cwd(), "netlify", "seed", "catkinsblog.sqlite.enc"),
        path.join(runtimeDir, "..", "seed", "catkinsblog.sqlite.enc"),
        path.join(runtimeDir, "..", "..", "netlify", "seed", "catkinsblog.sqlite.enc"),
    ]);
    if (!encrypted) {
        throw httpError("站点种子数据库未部署，请重新部署包含 netlify/seed/catkinsblog.sqlite.enc 的版本", 503);
    }

    const target = path.join(os.tmpdir(), "catkinsblog-seed-decrypted.sqlite");
    if (existsSync(target)) {
        return target;
    }
    let decrypted;
    try {
        decrypted = decryptSeed(await readFile(encrypted), process.env);
    } catch (error) {
        throw httpError(
            `种子数据库解密失败：请确认 Netlify 的 ADMIN_SESSION_SECRET 与 VPS 上一致，或设置 CATKINS_SEED_KEY 后重新部署（${error.message}）`,
            503,
        );
    }
    const temporary = `${target}.${randomUUID()}.tmp`;
    await writeFile(temporary, decrypted);
    await rename(temporary, target);
    return target;
}

function seedUploadsPath() {
    return firstExisting([
        process.env.CATKINS_SEED_UPLOADS,
        path.join(process.cwd(), "netlify", "seed", "uploads"),
        path.join(runtimeDir, "..", "seed", "uploads"),
        path.join(runtimeDir, "..", "..", "netlify", "seed", "uploads"),
    ]) || path.join(process.cwd(), "netlify", "seed", "uploads");
}

function firstExisting(candidates) {
    return candidates.find((candidate) => candidate && existsSync(candidate)) || null;
}

async function acquireLock() {
    const store = getBlobStore(lockStoreName);
    const owner = randomUUID();
    const deadline = Date.now() + lockWaitMs;
    let delay = 50;

    while (Date.now() < deadline) {
        const record = await store.getWithMetadata(lockKey).catch(() => null);
        if (!record) {
            const result = await store.set(
                lockKey,
                JSON.stringify({ owner, expires: Date.now() + lockTtlMs }),
                { onlyIfNew: true },
            );
            if (result.modified) {
                return { owner };
            }
        } else {
            let current = null;
            try {
                current = JSON.parse(record.data);
            } catch {
                current = null;
            }
            if (!current || Number(current.expires) < Date.now()) {
                const result = await store.set(
                    lockKey,
                    JSON.stringify({ owner, expires: Date.now() + lockTtlMs }),
                    { onlyIfMatch: record.etag },
                );
                if (result.modified) {
                    return { owner };
                }
            }
        }

        await sleep(delay + Math.floor(Math.random() * 50));
        delay = Math.min(Math.round(delay * 1.5), 500);
    }

    throw httpError("站点正在保存另一项更新，请稍后重试", 503);
}

async function releaseLock(lock) {
    if (!lock) return;
    try {
        const store = getBlobStore(lockStoreName);
        const record = await store.getWithMetadata(lockKey);
        if (!record) return;
        if (JSON.parse(record.data).owner === lock.owner) {
            await store.delete(lockKey);
        }
    } catch {
        // The lock will expire on its own if cleanup fails.
    }
}

function safeEtag(etag) {
    return String(etag).replace(/[^a-z0-9]/gi, "").slice(0, 32) || "current";
}

function httpError(message, status) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
