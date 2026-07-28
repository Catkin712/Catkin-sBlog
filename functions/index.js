import { getPublishedPosts } from "./_shared/blog.mjs";
import { countPhotos } from "./_shared/albums.mjs";
import { htmlResponse, renderHome } from "./_shared/html.mjs";
import { recordSiteVisit } from "./_shared/site-stats.mjs";

export async function onRequestGet({ request, env }) {
    try {
        const posts = await getPublishedPosts(env);
        const visit = recordSiteVisit(env, request);
        return htmlResponse(renderHome(posts, {
            imageCount: countPhotos(env),
            visitorCount: visit.visitorCount,
        }), 200, visit.setCookie ? { "set-cookie": visit.setCookie } : {});
    } catch (error) {
        return htmlResponse(`服务暂时不可用：${error.message}`, 500);
    }
}
