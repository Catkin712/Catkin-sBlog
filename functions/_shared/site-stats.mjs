import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { albumStoragePaths } from "./album-storage.mjs";

const visitorCookieName = "catkins_visitor";
const databases = new Map();

export function recordSiteVisit(env = {}, request) {
    const db = getDatabase(env);
    const cookieVisitorId = readCookie(request, visitorCookieName);
    const visitorId = isValidVisitorId(cookieVisitorId) ? cookieVisitorId : randomUUID();
    const isNewVisitor = visitorId !== cookieVisitorId;
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

function getDatabase(env) {
    const { databaseFile: defaultDatabaseFile } = albumStoragePaths(env);
    const databaseFile = path.resolve(env.SITE_STATS_DB_FILE || env.BLOG_DB_FILE || defaultDatabaseFile);
    if (databases.has(databaseFile)) {
        return databases.get(databaseFile);
    }

    mkdirSync(path.dirname(databaseFile), { recursive: true });
    const db = new DatabaseSync(databaseFile);
    db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
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
