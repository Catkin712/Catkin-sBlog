import { isAuthenticated } from "../../../_shared/auth.mjs";
import {
    AlbumError,
    deleteAlbumPhotoForAdmin,
    updateAlbumPhotoForAdmin,
} from "../../../_shared/albums.mjs";
import { jsonResponse } from "../../../_shared/html.mjs";

export async function onRequestPatch({ request, env, params }) {
    if (!(await isAuthenticated(request, env))) return jsonResponse({ error: "未登录" }, 401);
    try {
        return jsonResponse({ photo: updateAlbumPhotoForAdmin(env, params.id, await request.json()) });
    } catch (error) {
        return adminAlbumError(error, "照片信息保存失败");
    }
}

export async function onRequestDelete({ request, env, params }) {
    if (!(await isAuthenticated(request, env))) return jsonResponse({ error: "未登录" }, 401);
    try {
        return jsonResponse({ result: await deleteAlbumPhotoForAdmin(env, params.id) });
    } catch (error) {
        return adminAlbumError(error, "照片删除失败");
    }
}

function adminAlbumError(error, fallback) {
    const status = error instanceof AlbumError ? error.status : error instanceof SyntaxError ? 400 : 500;
    return jsonResponse({ error: status === 500 ? fallback : error.message }, status);
}
