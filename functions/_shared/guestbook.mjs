import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { albumStoragePaths } from "./album-storage.mjs";

const maxNicknameLength = 24;
const maxContentLength = 120;
const maxMessages = 160;
const databases = new Map();

export async function listGuestbookMessages(env = {}) {
    const db = getDatabase(env);
    return db.prepare(`
        SELECT id, nickname, content, created_at AS createdAt
        FROM guestbook_messages
        ORDER BY created_at DESC, id DESC
        LIMIT ?
    `).all(maxMessages);
}

export async function addGuestbookMessage(env = {}, payload = {}) {
    const nickname = normalizeText(payload.nickname, maxNicknameLength) || "匿名小猫";
    const content = normalizeText(payload.content, maxContentLength);

    if (!content) {
        throw new Error("留言内容不能为空");
    }

    const db = getDatabase(env);
    const message = {
        id: `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`,
        nickname,
        content,
        createdAt: new Date().toISOString(),
    };

    db.prepare(`
        INSERT INTO guestbook_messages (id, nickname, content, created_at)
        VALUES (?, ?, ?, ?)
    `).run(message.id, message.nickname, message.content, message.createdAt);

    db.prepare(`
        DELETE FROM guestbook_messages
        WHERE id NOT IN (
            SELECT id FROM guestbook_messages
            ORDER BY created_at DESC, id DESC
            LIMIT ?
        )
    `).run(maxMessages);

    return message;
}

function getDatabase(env) {
    const { databaseFile: defaultDatabaseFile } = albumStoragePaths(env);
    const databaseFile = path.resolve(env.GUESTBOOK_DB_FILE || env.BLOG_DB_FILE || defaultDatabaseFile);
    if (databases.has(databaseFile)) {
        return databases.get(databaseFile);
    }

    mkdirSync(path.dirname(databaseFile), { recursive: true });
    const db = new DatabaseSync(databaseFile);
    db.exec(`PRAGMA journal_mode = ${journalMode(env)}; PRAGMA busy_timeout = 5000;`);
    db.exec(`
        CREATE TABLE IF NOT EXISTS guestbook_messages (
            id TEXT PRIMARY KEY,
            nickname TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_guestbook_created
            ON guestbook_messages(created_at DESC);
    `);
    databases.set(databaseFile, db);
    return db;
}

function journalMode(env) {
    return String(env.SQLITE_JOURNAL_MODE || "WAL").toUpperCase() === "DELETE" ? "DELETE" : "WAL";
}

function normalizeText(value, maxLength) {
    return String(value ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maxLength);
}
