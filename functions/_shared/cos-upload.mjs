import { randomUUID } from "node:crypto";
import { AlbumError, createUploadFromCosObjects } from "./albums.mjs";
import {
    cosObjectUrl,
    createCosObjectKey,
    deleteCosObject,
    headCosObject,
    normalizeObjectKey,
    readCosObjectHeader,
} from "./cos.mjs";

const sessions = new Map();
const maxPhotoBytes = 20 * 1024 * 1024;
const maxAvatarBytes = 5 * 1024 * 1024;
const maxPhotoCount = 20;
const maxBatchBytes = 90 * 1024 * 1024;
const imageTypes = new Map([
    ["image/jpeg", "jpg"],
    ["image/png", "png"],
    ["image/gif", "gif"],
    ["image/webp", "webp"],
]);

export async function createCosUploadSession(env = {}, payload = {}) {
    const photos = normalizeDescriptors(payload.photos, maxPhotoCount, maxPhotoBytes, "照片");
    const avatar = payload.avatar ? normalizeDescriptor(payload.avatar, maxAvatarBytes, "头像") : null;
    const visibility = String(payload.visibility || "");
    if (!["public", "inner"].includes(visibility)) {
        throw new AlbumError("请选择上传表图还是里图");
    }
    const totalBytes = photos.reduce((sum, photo) => sum + photo.size, 0) + (avatar?.size || 0);
    if (totalBytes > maxBatchBytes) {
        throw new AlbumError("本批文件不能超过 90 MB");
    }
    if (!imageTypes.has(photos[0].mimeType)) {
        throw new AlbumError("请选择支持的图片格式");
    }
    const values = {
        nickname: payload.nickname,
        people: payload.people,
        location: payload.location,
        message: payload.message,
        albumIds: payload.albumIds,
        newAlbumName: payload.newAlbumName,
        visibility,
        photos,
        avatar,
    };
    const sessionId = randomUUID();
    const photoUploads = photos.map((photo, index) => {
        const extension = imageTypes.get(photo.mimeType) || extensionFromName(photo.name);
        const key = createCosObjectKey(env, "photo", visibility, extension);
        return {
            field: "photos",
            index,
            key,
            name: photo.name,
            size: photo.size,
            mimeType: photo.mimeType,
            url: cosObjectUrl(env, key, "PUT", { expires: env.COS_UPLOAD_URL_TTL_SECONDS || 600 }),
        };
    });
    const avatarUpload = avatar
        ? (() => {
            const key = createCosObjectKey(env, "avatar", visibility, imageTypes.get(avatar.mimeType) || extensionFromName(avatar.name));
            return {
                field: "avatar",
                index: 0,
                key,
                name: avatar.name,
                size: avatar.size,
                mimeType: avatar.mimeType,
                url: cosObjectUrl(env, key, "PUT", { expires: env.COS_UPLOAD_URL_TTL_SECONDS || 600 }),
            };
        })()
        : null;
    sessions.set(sessionId, {
        createdAt: Date.now(),
        values,
        photos: photoUploads,
        avatar: avatarUpload,
    });
    const cleanupTimer = setTimeout(() => {
        const current = sessions.get(sessionId);
        if (!current) return;
        sessions.delete(sessionId);
        void Promise.all([
            ...current.photos.map((photo) => deleteCosObject(env, photo.key).catch(() => {})),
            current.avatar ? deleteCosObject(env, current.avatar.key).catch(() => {}) : null,
        ].filter(Boolean));
    }, 15 * 60 * 1000);
    cleanupTimer.unref?.();
    pruneSessions(env);
    return {
        sessionId,
        expiresIn: 600,
        uploads: [...photoUploads, ...(avatarUpload ? [avatarUpload] : [])],
    };
}

export async function completeCosUploadSession(env = {}, sessionId) {
    const id = String(sessionId || "");
    const session = sessions.get(id);
    if (!session || Date.now() - session.createdAt > 15 * 60 * 1000) {
        sessions.delete(id);
        throw new AlbumError("上传会话已过期，请重新选择照片", 410);
    }

    try {
        const uploadedPhotos = [];
        for (const item of session.photos) {
            uploadedPhotos.push(await verifyObject(env, item, "照片"));
        }
        const uploadedAvatar = session.avatar
            ? await verifyObject(env, session.avatar, "头像")
            : null;
        const upload = await createUploadFromCosObjects(env, {
            ...session.values,
            photos: uploadedPhotos,
            avatar: uploadedAvatar,
        });
        sessions.delete(id);
        return upload;
    } catch (error) {
        await Promise.all([
            ...session.photos.map((photo) => deleteCosObject(env, photo.key).catch(() => {})),
            session.avatar ? deleteCosObject(env, session.avatar.key).catch(() => {}) : null,
        ].filter(Boolean));
        sessions.delete(id);
        throw error;
    }
}

async function verifyObject(env, item, label) {
    const key = normalizeObjectKey(item.key);
    const metadata = await headCosObject(env, key);
    if (metadata.byteSize !== item.size) {
        throw new AlbumError(`${label} ${item.name} 大小校验失败，请重新上传`, 400);
    }
    if (metadata.byteSize <= 0 || metadata.byteSize > (label === "头像" ? maxAvatarBytes : maxPhotoBytes)) {
        throw new AlbumError(`${label} ${item.name} 大小不符合限制`, 400);
    }
    const header = await readCosObjectHeader(env, key);
    const detected = detectImageType(header);
    if (!detected || detected.mimeType !== item.mimeType) {
        throw new AlbumError(`${label} ${item.name} 不是有效的图片文件`, 400);
    }
    return {
        key,
        originalName: item.name,
        mimeType: detected.mimeType,
        byteSize: metadata.byteSize,
    };
}

function normalizeDescriptors(value, maxCount, maxBytes, label) {
    if (!Array.isArray(value) || value.length === 0) {
        throw new AlbumError(`请至少选择一张${label}`);
    }
    if (value.length > maxCount) {
        throw new AlbumError(`每次最多上传 ${maxCount} 张照片`);
    }
    return value.map((item) => normalizeDescriptor(item, maxBytes, label));
}

function normalizeDescriptor(item, maxBytes, label) {
    const name = String(item?.name || "文件").normalize("NFKC").replace(/[\0\r\n]/g, "").slice(0, 160);
    const size = Number(item?.size || 0);
    const mimeType = String(item?.mimeType || item?.type || "").toLowerCase();
    if (!name || !Number.isSafeInteger(size) || size <= 0 || size > maxBytes) {
        throw new AlbumError(`${label} ${name || "文件"} 大小不符合限制`);
    }
    if (!imageTypes.has(mimeType)) {
        throw new AlbumError(`${label} ${name} 格式不受支持`);
    }
    return { name, size, mimeType };
}

function extensionFromName(name) {
    return String(name).split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
}

function detectImageType(buffer) {
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { mimeType: "image/jpeg" };
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mimeType: "image/png" };
    if (buffer.length >= 6 && ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii"))) return { mimeType: "image/gif" };
    if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return { mimeType: "image/webp" };
    return null;
}

function pruneSessions(env) {
    const cutoff = Date.now() - 15 * 60 * 1000;
    for (const [id, session] of sessions) {
        if (session.createdAt < cutoff) {
            sessions.delete(id);
            void Promise.all([
                ...session.photos.map((photo) => deleteCosObject(env, photo.key).catch(() => {})),
                session.avatar ? deleteCosObject(env, session.avatar.key).catch(() => {}) : null,
            ].filter(Boolean));
        }
    }
}
