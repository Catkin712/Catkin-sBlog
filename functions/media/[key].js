import { cosObjectUrl, normalizeObjectKey } from "../_shared/cos.mjs";

export async function onRequestGet({ env, params }) {
    try {
        const key = normalizeObjectKey(decodeObjectPath(params.key));
        if (!key.startsWith("posts/")) {
            return new Response("Not Found", { status: 404 });
        }
        return new Response(null, {
            status: 302,
            headers: {
                location: cosObjectUrl(env, key, "GET", { expires: env.COS_READ_URL_TTL_SECONDS || 600 }),
                "cache-control": "public, max-age=300",
            },
        });
    } catch {
        return new Response("Not Found", { status: 404 });
    }
}

function decodeObjectPath(value) {
    return String(value || "").split("/").map(decodeURIComponent).join("/");
}
