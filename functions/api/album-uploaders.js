import { uploaderStatus } from "../_shared/albums.mjs";
import { jsonResponse } from "../_shared/html.mjs";

export function onRequestGet({ request, env }) {
    try {
        return jsonResponse(uploaderStatus(env, new URL(request.url).searchParams.get("nickname")));
    } catch {
        return jsonResponse({ error: "暂时无法检查昵称" }, 500);
    }
}
