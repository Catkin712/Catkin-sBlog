import { randomUUID } from "node:crypto";
import { createWriteStream, mkdirSync } from "node:fs";
import { mkdir, open, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { DatabaseSync } from "node:sqlite";
import { albumStoragePaths } from "./album-storage.mjs";
import { mediaUrl } from "./cos.mjs";

const databases = new Map();
const maxPhotoCount = 20;
const maxPhotoBytes = 20 * 1024 * 1024;
const maxAvatarBytes = 5 * 1024 * 1024;

export class AlbumError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.name = "AlbumError";
        this.status = status;
    }
}

export function listAlbums(env = {}, includeInner = false) {
    const db = getDatabase(env);
    const visibleUpload = includeInner ? "1 = 1" : "u.visibility = 'public'";
    return db.prepare(`
        SELECT
            a.id,
            a.name,
            a.created_at AS createdAt,
            (
                SELECT COUNT(*)
                FROM album_uploads au
                JOIN uploads u ON u.id = au.upload_id
                WHERE au.album_id = a.id AND ${visibleUpload}
            ) AS uploadCount,
            (
                SELECT COUNT(*)
                FROM photos p
                JOIN album_uploads au ON au.upload_id = p.upload_id
                JOIN uploads u ON u.id = p.upload_id
                WHERE au.album_id = a.id AND ${visibleUpload}
            ) AS photoCount,
            (
                SELECT p.public_url
                FROM photos p
                JOIN uploads u ON u.id = p.upload_id
                JOIN album_uploads au ON au.upload_id = u.id
                WHERE au.album_id = a.id AND ${visibleUpload}
                ORDER BY u.created_at DESC, p.sort_order ASC
                LIMIT 1
            ) AS coverUrl
        FROM albums a
        ORDER BY a.created_at DESC, a.id DESC
    `).all().map((row) => normalizeAlbumRow(row, env));
}

export function getAlbum(env = {}, albumId, includeInner = false) {
    const db = getDatabase(env);
    const id = positiveInteger(albumId, "相册不存在");
    const visibleUpload = includeInner ? "1 = 1" : "u.visibility = 'public'";
    const album = db.prepare(`
        SELECT
            a.id,
            a.name,
            a.created_at AS createdAt,
            (
                SELECT COUNT(*)
                FROM album_uploads au
                JOIN uploads u ON u.id = au.upload_id
                WHERE au.album_id = a.id AND ${visibleUpload}
            ) AS uploadCount,
            (
                SELECT COUNT(*)
                FROM photos p
                JOIN album_uploads au ON au.upload_id = p.upload_id
                JOIN uploads u ON u.id = p.upload_id
                WHERE au.album_id = a.id AND ${visibleUpload}
            ) AS photoCount
        FROM albums a
        WHERE a.id = ?
    `).get(id);

    if (!album) {
        return null;
    }

    const uploads = db.prepare(`
        SELECT
            u.id,
            u.people,
            u.location,
            u.message,
            u.visibility,
            u.created_at AS createdAt,
            p.nickname,
            p.avatar_url AS avatarUrl
        FROM uploads u
        JOIN uploaders p ON p.id = u.uploader_id
        JOIN album_uploads au ON au.upload_id = u.id
        WHERE au.album_id = ? AND ${visibleUpload}
        ORDER BY u.created_at DESC, u.id DESC
    `).all(id);

    const photoQuery = db.prepare(`
        SELECT id, public_url AS url, original_name AS originalName, mime_type AS mimeType,
               byte_size AS byteSize, sort_order AS sortOrder
        FROM photos
        WHERE upload_id = ?
        ORDER BY sort_order ASC, id ASC
    `);
    const likeQuery = db.prepare(`
        SELECT id, nickname, created_at AS createdAt
        FROM likes
        WHERE upload_id = ?
        ORDER BY created_at ASC, id ASC
    `);
    const commentQuery = db.prepare(`
        SELECT id, nickname, content, created_at AS createdAt
        FROM comments
        WHERE upload_id = ?
        ORDER BY created_at ASC, id ASC
    `);
    const albumQuery = db.prepare(`
        SELECT a.id, a.name
        FROM albums a
        JOIN album_uploads au ON au.album_id = a.id
        WHERE au.upload_id = ?
        ORDER BY a.name COLLATE NOCASE ASC
    `);

    return {
        ...normalizeAlbumRow(album, env),
        uploads: uploads.map((upload) => ({
            ...upload,
            id: Number(upload.id),
            avatarUrl: mediaUrl(env, upload.avatarUrl),
            photos: photoQuery.all(upload.id).map((photo) => ({
                ...photo,
                url: mediaUrl(env, photo.url),
                id: Number(photo.id),
                byteSize: Number(photo.byteSize),
                sortOrder: Number(photo.sortOrder),
            })),
            likes: likeQuery.all(upload.id).map(normalizeId),
            comments: commentQuery.all(upload.id).map(normalizeId),
            albums: albumQuery.all(upload.id).map(normalizeId),
        })),
    };
}

export function createAlbum(env = {}, payload = {}) {
    const name = normalizeRequiredText(payload.name, 40, "请填写相册名称");
    const db = getDatabase(env);
    const existing = findAlbumByName(db, name);
    if (existing) {
        throw new AlbumError("已经有同名相册了", 409);
    }

    const result = db.prepare("INSERT INTO albums (name, name_key, created_at) VALUES (?, ?, ?)")
        .run(name, normalizeKey(name), new Date().toISOString());
    return db.prepare("SELECT id, name, created_at AS createdAt FROM albums WHERE id = ?")
        .get(result.lastInsertRowid);
}

export function uploaderStatus(env = {}, nicknameValue) {
    const nickname = normalizeText(nicknameValue, 24);
    if (!nickname) {
        return { exists: false, hasAvatar: false };
    }

    const uploader = getDatabase(env)
        .prepare("SELECT nickname, avatar_url AS avatarUrl FROM uploaders WHERE nickname_key = ?")
        .get(normalizeKey(nickname));
    return uploader
        ? { exists: true, hasAvatar: Boolean(uploader.avatarUrl), nickname: uploader.nickname, avatarUrl: mediaUrl(env, uploader.avatarUrl) }
        : { exists: false, hasAvatar: false };
}

export async function createUpload(env = {}, formData) {
    return createUploadFromSources(env, {
        nickname: formData.get("nickname"),
        people: formData.get("people"),
        location: formData.get("location"),
        message: formData.get("message"),
        photos: formData.getAll("photos").filter(isFileWithContent),
        avatar: isFileWithContent(formData.get("avatar")) ? formData.get("avatar") : null,
        albumIds: formData.getAll("albumIds"),
        newAlbumName: formData.get("newAlbumName"),
        visibility: formData.get("visibility"),
    });
}

export async function createUploadFromStagedFiles(env = {}, parts = {}) {
    return createUploadFromSources(env, {
        ...parts.fields,
        photos: parts.photos || [],
        avatar: parts.avatar || null,
    });
}

export async function createUploadFromCosObjects(env = {}, values = {}) {
    return createUploadFromSources(env, {
        ...values,
        photos: (values.photos || []).map((photo) => ({ ...photo, cosKey: photo.key })),
        avatar: values.avatar ? { ...values.avatar, cosKey: values.avatar.key } : null,
    });
}

async function createUploadFromSources(env, values) {
    const {
        nickname,
        people,
        location,
        message,
        photos,
        avatar,
        requestedAlbumIds,
        newAlbumName,
        visibility,
        db,
        uploader,
        validAlbumIds,
    } = normalizeUploadValues(env, values);
    const preparedPhotos = [];
    let preparedAvatar = null;
    const writtenFiles = [];
    let oldAvatarFile = null;

    try {
        for (const file of photos) {
            if (file.cosKey) {
                preparedPhotos.push({
                    originalName: file.originalName,
                    mimeType: file.mimeType,
                    byteSize: file.byteSize,
                    publicUrl: `cos:${file.cosKey}`,
                });
                continue;
            }
            const photo = await prepareImage(file, maxPhotoBytes, "照片");
            const stored = await storeImage(env, photo, visibility === "inner" ? "inner-album" : "album");
            writtenFiles.push(stored.filePath);
            photo.publicUrl = stored.publicUrl;
            preparedPhotos.push(photo);
        }
        if (avatar) {
            if (avatar.cosKey) {
                preparedAvatar = {
                    originalName: avatar.originalName,
                    mimeType: avatar.mimeType,
                    byteSize: avatar.byteSize,
                    publicUrl: `cos:${avatar.cosKey}`,
                };
            } else {
            preparedAvatar = await prepareImage(avatar, maxAvatarBytes, "头像");
            const stored = await storeImage(env, preparedAvatar, "avatar");
            writtenFiles.push(stored.filePath);
            preparedAvatar.publicUrl = stored.publicUrl;
            }
        }

        db.exec("BEGIN IMMEDIATE");
        try {
            const now = new Date().toISOString();
            let albumIds = [...validAlbumIds];
            if (newAlbumName) {
                let album = findAlbumByName(db, newAlbumName);
                if (!album) {
                    const albumResult = db.prepare("INSERT INTO albums (name, name_key, created_at) VALUES (?, ?, ?)")
                        .run(newAlbumName, normalizeKey(newAlbumName), now);
                    album = { id: albumResult.lastInsertRowid };
                }
                albumIds.push(Number(album.id));
            }
            albumIds = [...new Set(albumIds)];

            let uploaderId;
            if (uploader) {
                uploaderId = uploader.id;
                if (preparedAvatar) {
                    oldAvatarFile = publicUrlToFile(env, uploader.avatar_url);
                    db.prepare("UPDATE uploaders SET nickname = ?, avatar_url = ?, updated_at = ? WHERE id = ?")
                        .run(nickname, preparedAvatar.publicUrl, now, uploaderId);
                }
            } else {
                const uploaderResult = db.prepare(`
                    INSERT INTO uploaders (nickname, nickname_key, avatar_url, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                `).run(nickname, normalizeKey(nickname), preparedAvatar.publicUrl, now, now);
                uploaderId = uploaderResult.lastInsertRowid;
            }

            const uploadResult = db.prepare(`
                INSERT INTO uploads (uploader_id, people, location, message, visibility, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(uploaderId, people, location, message, visibility, now);
            const uploadId = uploadResult.lastInsertRowid;
            const insertPhoto = db.prepare(`
                INSERT INTO photos (upload_id, public_url, original_name, mime_type, byte_size, sort_order)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            preparedPhotos.forEach((photo, index) => {
                insertPhoto.run(uploadId, photo.publicUrl, photo.originalName, photo.mimeType, photo.byteSize, index);
            });
            const insertAlbumUpload = db.prepare("INSERT INTO album_uploads (album_id, upload_id) VALUES (?, ?)");
            albumIds.forEach((albumId) => insertAlbumUpload.run(albumId, uploadId));
            db.exec("COMMIT");

            if (oldAvatarFile) {
                await unlink(oldAvatarFile).catch(() => {});
            }
            return { id: Number(uploadId), albumIds, visibility };
        } catch (error) {
            db.exec("ROLLBACK");
            throw error;
        }
    } catch (error) {
        await Promise.all(writtenFiles.map((filePath) => unlink(filePath).catch(() => {})));
        throw error;
    }
}

function normalizeUploadValues(env, values) {
    const nickname = normalizeRequiredText(values.nickname, 24, "请填写上传者昵称");
    const people = normalizeText(values.people, 80);
    const location = normalizeText(values.location, 80);
    const message = normalizeText(values.message, 500, true);
    const photos = values.photos || [];
    const avatar = values.avatar || null;
    const requestedAlbumIds = [...new Set((values.albumIds || []).map(Number).filter(Number.isInteger))];
    const newAlbumName = normalizeText(values.newAlbumName, 40);
    const visibility = String(values.visibility || "");
    if (!["public", "inner"].includes(visibility)) throw new AlbumError("请选择上传表图还是里图");
    if (photos.length === 0) throw new AlbumError("请至少选择一张照片");
    if (photos.length > maxPhotoCount) throw new AlbumError(`每次最多上传 ${maxPhotoCount} 张照片`);
    if (requestedAlbumIds.length === 0 && !newAlbumName) throw new AlbumError("请至少选择或新建一个相册");
    const db = getDatabase(env);
    const uploader = db.prepare("SELECT * FROM uploaders WHERE nickname_key = ?").get(normalizeKey(nickname));
    if (!uploader && !avatar) throw new AlbumError("这个昵称第一次上传，请选择一张头像");
    const validAlbumIds = requestedAlbumIds.filter((id) => db.prepare("SELECT 1 FROM albums WHERE id = ?").get(id));
    if (validAlbumIds.length !== requestedAlbumIds.length) throw new AlbumError("选择的相册中有一个已不存在");
    return {
        nickname, people, location, message, photos, avatar, requestedAlbumIds,
        newAlbumName, visibility, db, uploader, validAlbumIds,
    };
}

export function addLike(env = {}, uploadIdValue, payload = {}) {
    const uploadId = existingUploadId(env, uploadIdValue);
    const nickname = normalizeRequiredText(payload.nickname, 24, "请填写昵称");
    const db = getDatabase(env);
    try {
        const result = db.prepare("INSERT INTO likes (upload_id, nickname, nickname_key, created_at) VALUES (?, ?, ?, ?)")
            .run(uploadId, nickname, normalizeKey(nickname), new Date().toISOString());
        return db.prepare("SELECT id, nickname, created_at AS createdAt FROM likes WHERE id = ?")
            .get(result.lastInsertRowid);
    } catch (error) {
        if (String(error.message).includes("UNIQUE")) {
            throw new AlbumError("这个昵称已经点过赞了", 409);
        }
        throw error;
    }
}

export function addComment(env = {}, uploadIdValue, payload = {}) {
    const uploadId = existingUploadId(env, uploadIdValue);
    const nickname = normalizeRequiredText(payload.nickname, 24, "请填写昵称");
    const content = normalizeRequiredText(payload.content, 240, "请填写评论内容", true);
    const db = getDatabase(env);
    const result = db.prepare(`
        INSERT INTO comments (upload_id, nickname, content, created_at)
        VALUES (?, ?, ?, ?)
    `).run(uploadId, nickname, content, new Date().toISOString());
    return db.prepare("SELECT id, nickname, content, created_at AS createdAt FROM comments WHERE id = ?")
        .get(result.lastInsertRowid);
}

export function isInnerUpload(env = {}, uploadIdValue) {
    const id = positiveInteger(uploadIdValue, "动态不存在");
    const upload = getDatabase(env).prepare("SELECT visibility FROM uploads WHERE id = ?").get(id);
    if (!upload) {
        throw new AlbumError("动态不存在", 404);
    }
    return upload.visibility === "inner";
}

function getDatabase(env) {
    const { databaseFile } = albumStoragePaths(env);
    if (databases.has(databaseFile)) {
        return databases.get(databaseFile);
    }

    mkdirSync(path.dirname(databaseFile), { recursive: true });
    const db = new DatabaseSync(databaseFile);
    db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
    db.exec(`
        CREATE TABLE IF NOT EXISTS uploaders (
            id INTEGER PRIMARY KEY,
            nickname TEXT NOT NULL,
            nickname_key TEXT NOT NULL UNIQUE,
            avatar_url TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS albums (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            name_key TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS uploads (
            id INTEGER PRIMARY KEY,
            uploader_id INTEGER NOT NULL REFERENCES uploaders(id),
            people TEXT NOT NULL DEFAULT '',
            location TEXT NOT NULL DEFAULT '',
            message TEXT NOT NULL DEFAULT '',
            visibility TEXT NOT NULL DEFAULT 'public',
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS photos (
            id INTEGER PRIMARY KEY,
            upload_id INTEGER NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
            public_url TEXT NOT NULL UNIQUE,
            original_name TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            byte_size INTEGER NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS album_uploads (
            album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
            upload_id INTEGER NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
            PRIMARY KEY (album_id, upload_id)
        );
        CREATE TABLE IF NOT EXISTS likes (
            id INTEGER PRIMARY KEY,
            upload_id INTEGER NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
            nickname TEXT NOT NULL,
            nickname_key TEXT NOT NULL,
            created_at TEXT NOT NULL,
            UNIQUE (upload_id, nickname_key)
        );
        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY,
            upload_id INTEGER NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
            nickname TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_album_uploads_upload ON album_uploads(upload_id);
        CREATE INDEX IF NOT EXISTS idx_photos_upload ON photos(upload_id, sort_order);
        CREATE INDEX IF NOT EXISTS idx_likes_upload ON likes(upload_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_comments_upload ON comments(upload_id, created_at);
    `);
    const uploadColumns = db.prepare("PRAGMA table_info(uploads)").all();
    if (!uploadColumns.some((column) => column.name === "visibility")) {
        db.exec("ALTER TABLE uploads ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public'");
    }
    db.exec("CREATE INDEX IF NOT EXISTS idx_uploads_visibility ON uploads(visibility, created_at)");
    databases.set(databaseFile, db);
    return db;
}

async function prepareImage(file, maxBytes, label) {
    const byteSize = Number(file.size ?? file.byteSize ?? 0);
    const originalName = file.name || file.originalName || "文件";
    if (byteSize > maxBytes) {
        throw new AlbumError(`${label} ${originalName} 超过大小限制`);
    }
    const header = file.tempPath
        ? await readFileHeader(file.tempPath)
        : Buffer.from(await file.slice(0, 16).arrayBuffer());
    const imageType = detectImageType(header);
    if (!imageType) {
        throw new AlbumError(`${label} ${originalName} 不是支持的图片格式`);
    }
    return {
        file: file.tempPath ? null : file,
        tempPath: file.tempPath || null,
        byteSize,
        extension: imageType.extension,
        mimeType: imageType.mimeType,
        originalName: normalizeText(originalName || `image.${imageType.extension}`, 160),
    };
}

async function readFileHeader(filePath) {
    const handle = await open(filePath, "r");
    try {
        const buffer = Buffer.alloc(16);
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
        return buffer.subarray(0, bytesRead);
    } finally {
        await handle.close();
    }
}

function detectImageType(buffer) {
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return { extension: "jpg", mimeType: "image/jpeg" };
    }
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
        return { extension: "png", mimeType: "image/png" };
    }
    if (buffer.length >= 6 && ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii"))) {
        return { extension: "gif", mimeType: "image/gif" };
    }
    if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
        return { extension: "webp", mimeType: "image/webp" };
    }
    return null;
}

async function storeImage(env, image, kind) {
    const storage = albumStoragePaths(env);
    const now = new Date();
    const relativeDir = path.join(String(now.getUTCFullYear()), String(now.getUTCMonth() + 1).padStart(2, "0"));
    const root = kind === "avatar"
        ? storage.avatarUploadsRoot
        : kind === "inner-album"
            ? storage.innerAlbumUploadsRoot
            : storage.albumUploadsRoot;
    const directory = path.join(root, relativeDir);
    const filename = `${randomUUID()}.${image.extension}`;
    await mkdir(directory, { recursive: true });
    const filePath = path.join(directory, filename);
    try {
        if (image.tempPath) {
            await rename(image.tempPath, filePath);
        } else {
            await pipeline(
                Readable.fromWeb(image.file.stream()),
                createWriteStream(filePath, { flags: "wx" }),
            );
        }
    } catch (error) {
        await unlink(filePath).catch(() => {});
        throw error;
    }
    const urlKind = kind === "avatar" ? "avatars" : kind === "inner-album" ? "inner-albums" : "albums";
    return {
        filePath,
        publicUrl: `/uploads/${urlKind}/${relativeDir.split(path.sep).join("/")}/${filename}`,
    };
}

function publicUrlToFile(env, publicUrl) {
    if (!String(publicUrl).startsWith("/uploads/")) {
        return null;
    }
    const { uploadsRoot } = albumStoragePaths(env);
    const filePath = path.resolve(uploadsRoot, String(publicUrl).slice("/uploads/".length));
    return filePath.startsWith(`${uploadsRoot}${path.sep}`) ? filePath : null;
}

function findAlbumByName(db, name) {
    return db.prepare("SELECT id, name, created_at AS createdAt FROM albums WHERE name_key = ?")
        .get(normalizeKey(name));
}

function existingUploadId(env, value) {
    const id = positiveInteger(value, "动态不存在");
    if (!getDatabase(env).prepare("SELECT 1 FROM uploads WHERE id = ?").get(id)) {
        throw new AlbumError("动态不存在", 404);
    }
    return id;
}

function positiveInteger(value, message) {
    const number = Number(value);
    if (!Number.isInteger(number) || number <= 0) {
        throw new AlbumError(message, 404);
    }
    return number;
}

function normalizeAlbumRow(row, env = {}) {
    return {
        ...row,
        id: Number(row.id),
        uploadCount: Number(row.uploadCount || 0),
        photoCount: Number(row.photoCount || 0),
        coverUrl: mediaUrl(env, row.coverUrl),
    };
}

function normalizeId(row) {
    return { ...row, id: Number(row.id) };
}

function normalizeRequiredText(value, maxLength, message, preserveLines = false) {
    const normalized = normalizeText(value, maxLength, preserveLines);
    if (!normalized) {
        throw new AlbumError(message);
    }
    return normalized;
}

function normalizeText(value, maxLength, preserveLines = false) {
    const text = String(value ?? "").normalize("NFKC").replace(/\0/g, "").trim();
    const normalized = preserveLines
        ? text.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n")
        : text.replace(/\s+/g, " ");
    return [...normalized].slice(0, maxLength).join("");
}

function normalizeKey(value) {
    return normalizeText(value, 80).toLocaleLowerCase("zh-CN");
}

function isFileWithContent(value) {
    return value && typeof value.arrayBuffer === "function" && Number(value.size) > 0;
}
