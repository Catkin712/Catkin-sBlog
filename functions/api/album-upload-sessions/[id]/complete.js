import { completeCosUploadSession } from "../../../_shared/cos-upload.mjs";
import { AlbumError } from "../../../_shared/albums.mjs";
import { jsonResponse } from "../../../_shared/html.mjs";

export async function onRequestPost({ env, params }) {
    try {
        return jsonResponse({ upload: await completeCosUploadSession(env, params.id) }, 201);
    } catch (error) {
        const status = error instanceof AlbumError ? error.status : Number(error?.status) || 500;
        return jsonResponse({ error: status === 500 ? "照片保存失败，请稍后重试" : error.message }, status);
    }
}
