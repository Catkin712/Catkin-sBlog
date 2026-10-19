import { AlbumError, addLike, isInnerUpload } from "../../../_shared/albums.mjs";
import { jsonResponse } from "../../../_shared/html.mjs";
import { hasInnerAlbumSession } from "../../../_shared/album-mode-auth.mjs";

export async function onRequestPost({ request, env, params }) {
    try {
        if (isInnerUpload(env, params.id) && !hasInnerAlbumSession(request, env)) {
            return jsonResponse({ error: "请先进入里图模式" }, 403);
        }
        return jsonResponse({ like: addLike(env, params.id, await request.json()) }, 201);
    } catch (error) {
        const status = error instanceof AlbumError ? error.status : error instanceof SyntaxError ? 400 : 500;
        const message = error instanceof SyntaxError ? "请求内容不是有效 JSON" : error.message;
        return jsonResponse({ error: status === 500 ? "点赞失败，请稍后再试" : message }, status);
    }
}
