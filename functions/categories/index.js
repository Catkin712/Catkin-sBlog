import { getPublishedPosts } from "../_shared/blog.mjs";
import { htmlResponse, renderCategoriesIndex } from "../_shared/html.mjs";

export async function onRequestGet({ env }) {
    try {
        return htmlResponse(renderCategoriesIndex(await getPublishedPosts(env)));
    } catch (error) {
        return htmlResponse(`<pre>${String(error.stack || error.message || error)}</pre>`, 500);
    }
}
