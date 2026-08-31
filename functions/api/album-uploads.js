import { AlbumError, createUpload } from "../_shared/albums.mjs";
import { jsonResponse } from "../_shared/html.mjs";

export async function onRequestPost({ request, env }) {
    try {
        const contentType = request.headers.get("content-type") || "";
        if (!contentType.startsWith("multipart/form-data")) {
            throw new AlbumError("上传请求格式不正确");
        }
        return jsonResponse({ upload: await createUpload(env, await request.formData()) }, 201);
    } catch (error) {
        const status = error instanceof AlbumError ? error.status : Number(error?.status) || 500;
        return jsonResponse({ error: status === 500 ? "照片上传失败，请稍后再试" : error.message }, status);
    }
}
