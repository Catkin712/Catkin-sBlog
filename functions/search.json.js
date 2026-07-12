import { getPublishedPosts } from "./_shared/blog.mjs";
import { jsonResponse, renderSearchJson } from "./_shared/html.mjs";

export async function onRequestGet({ env }) {
    try {
        return jsonResponse(renderSearchJson(await getPublishedPosts(env)), 200, {
            "cache-control": "public, max-age=30, s-maxage=300, stale-while-revalidate=86400",
        });
    } catch (error) {
        return jsonResponse({ error: error.message }, 500);
    }
}
