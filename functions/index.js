import { getPublishedPosts } from "./_shared/blog.mjs";
import { htmlResponse, renderHome } from "./_shared/html.mjs";

export async function onRequestGet({ env }) {
    try {
        return htmlResponse(renderHome(await getPublishedPosts(env)));
    } catch (error) {
        return htmlResponse(`服务暂时不可用：${error.message}`, 500);
    }
}
