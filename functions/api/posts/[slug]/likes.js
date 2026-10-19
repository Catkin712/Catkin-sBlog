import { addPostLike, BlogError } from "../../../_shared/blog.mjs";
import { jsonResponse } from "../../../_shared/html.mjs";

export async function onRequestPost({ request, env, params }) {
    try {
        return jsonResponse({ like: await addPostLike(env, params.slug, await request.json()) }, 201);
    } catch (error) {
        const status = error instanceof BlogError ? error.status : error instanceof SyntaxError ? 400 : 500;
        const message = error instanceof SyntaxError ? "请求内容不是有效 JSON" : error.message;
        return jsonResponse({ error: status === 500 ? "点赞失败，请稍后再试" : message }, status);
    }
}
