import { getPublishedPost } from "../../_shared/blog.mjs";
import { htmlResponse, renderArticle } from "../../_shared/html.mjs";

export async function onRequestGet({ env, params }) {
    try {
        const post = await getPublishedPost(env, params.slug);
        return htmlResponse(renderArticle(post), post ? 200 : 404);
    } catch (error) {
        return htmlResponse(`服务暂时不可用：${error.message}`, 500);
    }
}
