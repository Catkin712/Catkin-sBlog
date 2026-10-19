import { existsSync, readFileSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const [source, target, guestbookFile] = process.argv.slice(2);
if (!source || !target) {
    console.error("Usage: node export-netlify-seed.mjs <source.sqlite> <target.sqlite> [guestbook.json]");
    process.exit(1);
}

const sourceDb = new DatabaseSync(source);
sourceDb.exec("PRAGMA wal_checkpoint(TRUNCATE);");
rmSync(target, { force: true });
sourceDb.exec(`VACUUM INTO '${target.replaceAll("'", "''")}';`);
sourceDb.close();

const seed = new DatabaseSync(target);
seed.exec(`
    CREATE TABLE IF NOT EXISTS guestbook_messages (
        id TEXT PRIMARY KEY,
        nickname TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_guestbook_created
        ON guestbook_messages(created_at DESC);
`);

if (guestbookFile && existsSync(guestbookFile)) {
    const messages = JSON.parse(readFileSync(guestbookFile, "utf8"));
    const insert = seed.prepare(`
        INSERT OR REPLACE INTO guestbook_messages (id, nickname, content, created_at)
        VALUES (?, ?, ?, ?)
    `);
    for (const message of messages) {
        if (!message?.id || !message?.content) continue;
        insert.run(
            String(message.id),
            String(message.nickname || "匿名小猫"),
            String(message.content),
            String(message.createdAt || new Date().toISOString()),
        );
    }
    console.log(`Imported ${messages.length} guestbook messages`);
}

const visitors = seed.prepare("SELECT COUNT(*) AS count FROM site_visitors").get().count;
const posts = seed.prepare("SELECT COUNT(*) AS count FROM posts").get().count;
const photos = seed.prepare("SELECT COUNT(*) AS count FROM photos").get().count;
const guestbook = seed.prepare("SELECT COUNT(*) AS count FROM guestbook_messages").get().count;
seed.exec("PRAGMA wal_checkpoint(TRUNCATE);");
seed.close();
console.log(JSON.stringify({ posts, photos, guests: guestbook, visitors }, null, 2));
