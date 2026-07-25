import { createCosUploadSession } from "../_shared/cos-upload.mjs";
import { AlbumError } from "../_shared/albums.mjs";
import { jsonResponse } from "../_shared/html.mjs";

export async function onRequestPost({ request, env }) {
    try {
        const payload = await request.json();
        return jsonResponse({ session: await createCosUploadSession(env, payload) }, 201);
    } catch (error) {
        const status = error instanceof AlbumError ? error.status : Number(error?.status) || 500;
        return jsonResponse({ error: status === 500 ? "上传会话创建失败，请稍后重试" : error.message }, status);
    }
}
