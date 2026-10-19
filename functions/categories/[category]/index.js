import { getPublishedPosts, normalizeCategory } from "../../_shared/blog.mjs";
import { htmlResponse, renderCategoryPage } from "../../_shared/html.mjs";

export async function onRequestGet({ env, params }) {
    try {
        const category = decodeURIComponent(params.category || "");
        const posts = (await getPublishedPosts(env)).filter(
            (post) => normalizeCategory(post.data.category) === normalizeCategory(category),
        );
        return htmlResponse(renderCategoryPage(category, posts));
    } catch (error) {
        return htmlResponse(`<pre>${String(error.stack || error.message || error)}</pre>`, 500);
    }
}
