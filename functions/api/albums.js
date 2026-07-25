import { AlbumError, createAlbum, listAlbums } from "../_shared/albums.mjs";
import { jsonResponse } from "../_shared/html.mjs";
import { hasInnerAlbumSession } from "../_shared/album-mode-auth.mjs";

export function onRequestGet({ request, env }) {
    try {
        const wantsInner = new URL(request.url).searchParams.get("view") === "inner";
        const includeInner = wantsInner && hasInnerAlbumSession(request, env);
        return jsonResponse({ albums: listAlbums(env, includeInner), mode: includeInner ? "inner" : "public" });
    } catch (error) {
        return albumErrorResponse(error);
    }
}

export async function onRequestPost({ request, env }) {
    try {
        return jsonResponse({ album: createAlbum(env, await request.json()) }, 201);
    } catch (error) {
        return albumErrorResponse(error);
    }
}

function albumErrorResponse(error) {
    const status = error instanceof AlbumError ? error.status : error instanceof SyntaxError ? 400 : 500;
    const message = error instanceof SyntaxError ? "请求内容不是有效 JSON" : error.message;
    return jsonResponse({ error: status === 500 ? "相册服务暂时不可用" : message }, status);
}
