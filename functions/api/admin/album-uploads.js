import { isAuthenticated } from "../../_shared/auth.mjs";
import { listAlbumUploadsForAdmin } from "../../_shared/albums.mjs";
import { jsonResponse } from "../../_shared/html.mjs";

export async function onRequestGet({ request, env }) {
    if (!(await isAuthenticated(request, env))) return jsonResponse({ error: "未登录" }, 401);
    try {
        return jsonResponse(listAlbumUploadsForAdmin(env));
    } catch {
        return jsonResponse({ error: "相册管理数据加载失败" }, 500);
    }
}
