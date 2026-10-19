import { getPublishedPosts } from "../../_shared/blog.mjs";
import { htmlResponse, renderTagPage } from "../../_shared/html.mjs";

export async function onRequestGet({ env, params }) {
    try {
        const tag = decodeURIComponent(params.tag);
        const posts = (await getPublishedPosts(env)).filter((post) => post.data.tags.includes(tag));
        return htmlResponse(renderTagPage(tag, posts));
    } catch (error) {
        return htmlResponse(`服务暂时不可用：${error.message}`, 500);
    }
}
