import { getPublishedPosts } from "./_shared/blog.mjs";
import { getUmamiSummary } from "./_shared/analytics.mjs";
import { htmlResponse, renderHome } from "./_shared/html.mjs";

export async function onRequestGet({ env }) {
    try {
        const [posts, analytics] = await Promise.all([
            getPublishedPosts(env),
            getUmamiSummary(env),
        ]);
        return htmlResponse(renderHome(posts, analytics));
    } catch (error) {
        return htmlResponse(`服务暂时不可用：${error.message}`, 500);
    }
}
