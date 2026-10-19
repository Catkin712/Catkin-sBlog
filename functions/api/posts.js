import { isAuthenticated } from "../_shared/auth.mjs";
import { listAdminPosts } from "../_shared/blog.mjs";
import { jsonResponse } from "../_shared/html.mjs";

export async function onRequestGet({ request, env }) {
    if (!(await isAuthenticated(request, env))) {
        return jsonResponse({ error: "未登录" }, 401);
    }

    try {
        return jsonResponse(await listAdminPosts(env));
    } catch (error) {
        return jsonResponse({ error: error.message }, 500);
    }
}
