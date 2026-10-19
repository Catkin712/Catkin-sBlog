import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { getBlobStore } from "./blob-store.mjs";
import { albumStoragePaths } from "./album-storage.mjs";

const visitorCookieName = "catkins_visitor";
const databases = new Map();
const visitorStoreName = "catkinsblog-stats";
const visitorKey = "unique-visitors";

export async function recordSiteVisit(env = {}, request) {
    const cookieVisitorId = readCookie(request, visitorCookieName);
    const visitorId = isValidVisitorId(cookieVisitorId) ? cookieVisitorId : randomUUID();
    const isNewVisitor = visitorId !== cookieVisitorId;

    if (usesBlobStats(env)) {
        const visitorCount = await recordBlobVisit(env, isNewVisitor);
        return {
            visitorCount,
            setCookie: isNewVisitor ? buildVisitorCookie(visitorId) : "",
        };
    }

    const db = getDatabase(env);
    const now = new Date().toISOString();

    db.prepare(`
        INSERT INTO site_visitors (id, first_seen, last_seen, visits)
        VALUES (?, ?, ?, 1)
        ON CONFLICT(id) DO UPDATE SET
            last_seen = excluded.last_seen,
            visits = site_visitors.visits + 1
    `).run(visitorId, now, now);

    const visitorCount = Number(db.prepare("SELECT COUNT(*) AS count FROM site_visitors").get()?.count || 0);
    return {
        visitorCount,
        setCookie: isNewVisitor ? buildVisitorCookie(visitorId) : "",
    };
}

function usesBlobStats(env) {
    return String(env.CATKINS_USE_BLOBS || env.NETLIFY || "").toLowerCase() === "true";
}

async function recordBlobVisit(env, isNewVisitor) {
    const fallback = Number(env.SITE_VISITOR_SEED || 8042);
    try {
        const store = getBlobStore(visitorStoreName);
        const state = await readVisitorState(store);
        if (!isNewVisitor) {
            return state?.count ?? fallback;
        }

        let current = state;
        for (let attempt = 0; attempt < 6; attempt += 1) {
            const count = Number(current?.count ?? fallback) + 1;
            const result = await store.setJSON(
                visitorKey,
                { count, updatedAt: new Date().toISOString() },
                current?.etag ? { onlyIfMatch: current.etag } : { onlyIfNew: true },
            );
            if (result.modified) {
                return count;
            }
            current = await readVisitorState(store);
        }
        return Number(current?.count ?? fallback);
    } catch (error) {
        console.error("Failed to record visitor count in Netlify Blobs:", error);
        return fallback;
    }
}

async function readVisitorState(store) {
    const record = await store.getWithMetadata(visitorKey, { consistency: "strong" });
    if (!record?.data) {
        return null;
    }
    try {
        return { ...JSON.parse(record.data), etag: record.etag };
    } catch {
        return null;
    }
}

function getDatabase(env) {
    const { databaseFile: defaultDatabaseFile } = albumStoragePaths(env);
    const databaseFile = path.resolve(env.SITE_STATS_DB_FILE || env.BLOG_DB_FILE || defaultDatabaseFile);
    if (databases.has(databaseFile)) {
        return databases.get(databaseFile);
    }

    mkdirSync(path.dirname(databaseFile), { recursive: true });
    const db = new DatabaseSync(databaseFile);
    const journalMode = String(env.SQLITE_JOURNAL_MODE || "WAL").toUpperCase() === "DELETE" ? "DELETE" : "WAL";
    db.exec(`PRAGMA journal_mode = ${journalMode}; PRAGMA busy_timeout = 5000;`);
    db.exec(`
        CREATE TABLE IF NOT EXISTS site_visitors (
            id TEXT PRIMARY KEY,
            first_seen TEXT NOT NULL,
            last_seen TEXT NOT NULL,
            visits INTEGER NOT NULL DEFAULT 1
        );
    `);
    databases.set(databaseFile, db);
    return db;
}

function readCookie(request, name) {
    const cookieHeader = request?.headers?.get("cookie") || "";
    return cookieHeader
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${name}=`))
        ?.slice(name.length + 1) || "";
}

function buildVisitorCookie(visitorId) {
    return `${visitorCookieName}=${visitorId}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly`;
}

function isValidVisitorId(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}
