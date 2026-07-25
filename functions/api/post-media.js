import { isAuthenticated } from "../_shared/auth.mjs";
import { cosObjectUrl, createCosObjectKey } from "../_shared/cos.mjs";
import { jsonResponse } from "../_shared/html.mjs";

const imageTypes = new Map([
    ["image/jpeg", "jpg"],
    ["image/png", "png"],
    ["image/gif", "gif"],
    ["image/webp", "webp"],
]);

export async function onRequestPost({ request, env }) {
    if (!(await isAuthenticated(request, env))) {
        return jsonResponse({ error: "未登录" }, 401);
    }

    try {
        const payload = await request.json();
        const kind = payload.kind === "cover" ? "cover" : payload.kind === "body" ? "post" : "";
        const mimeType = String(payload.mimeType || "").toLowerCase();
        const size = Number(payload.size || 0);
        const maxBytes = kind === "cover" ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
        if (!kind) throw new Error("图片用途无效");
        if (!imageTypes.has(mimeType)) throw new Error("只支持 PNG、JPG、WebP 或 GIF");
        if (!Number.isSafeInteger(size) || size <= 0 || size > maxBytes) {
            throw new Error(`图片不能超过 ${maxBytes / 1024 / 1024} MB`);
        }

        const key = createCosObjectKey(env, kind, "public", imageTypes.get(mimeType));
        return jsonResponse({
            uploadUrl: cosObjectUrl(env, key, "PUT", { expires: env.COS_UPLOAD_URL_TTL_SECONDS || 600 }),
            value: kind === "cover" ? `cos:${key}` : `/media/${encodeObjectPath(key)}`,
            previewUrl: cosObjectUrl(env, key, "GET", { expires: env.COS_READ_URL_TTL_SECONDS || 600 }),
            expiresIn: Number(env.COS_UPLOAD_URL_TTL_SECONDS || 600),
        }, 201);
    } catch (error) {
        return jsonResponse({ error: error.message || "图片上传会话创建失败" }, 400);
    }
}

function encodeObjectPath(key) {
    return key.split("/").map(encodeURIComponent).join("/");
}
