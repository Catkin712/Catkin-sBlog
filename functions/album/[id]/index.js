import { getAlbum, listAlbums } from "../../_shared/albums.mjs";
import { renderAlbumPage } from "../../_shared/album-html.mjs";
import { htmlResponse } from "../../_shared/html.mjs";
import { hasInnerAlbumSession } from "../../_shared/album-mode-auth.mjs";

export async function onRequestGet({ request, env, params }) {
    try {
        const wantsInner = new URL(request.url).searchParams.get("view") === "inner";
        const innerMode = wantsInner && hasInnerAlbumSession(request, env);
        const album = getAlbum(env, params.id, innerMode);
        return htmlResponse(renderAlbumPage(album, listAlbums(env, innerMode), {
            innerMode,
            uploadOrigin: env.ALBUM_UPLOAD_ORIGIN || "",
        }), album ? 200 : 404, {
            "cache-control": "no-store",
        });
    } catch (error) {
        return htmlResponse(`相册暂时不可用：${error.message}`, error.status || 500);
    }
}
