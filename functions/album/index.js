import { listAlbums } from "../_shared/albums.mjs";
import { renderAlbumsPage } from "../_shared/album-html.mjs";
import { htmlResponse } from "../_shared/html.mjs";
import { hasInnerAlbumSession } from "../_shared/album-mode-auth.mjs";

export async function onRequestGet({ request, env }) {
    try {
        const wantsInner = new URL(request.url).searchParams.get("view") === "inner";
        const innerMode = wantsInner && hasInnerAlbumSession(request, env);
        return htmlResponse(renderAlbumsPage(listAlbums(env, innerMode), {
            innerMode,
            uploadOrigin: env.ALBUM_UPLOAD_ORIGIN || "",
        }), 200, {
            "cache-control": "no-store",
        });
    } catch (error) {
        return htmlResponse(`相册暂时不可用：${error.message}`, 500);
    }
}
