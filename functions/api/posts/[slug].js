import { isAuthenticated } from "../../_shared/auth.mjs";
import { readPost, writePost } from "../../_shared/blog.mjs";
import { jsonResponse } from "../../_shared/html.mjs";

export async function onRequestGet({ request, env, params }) {
    if (!(await isAuthenticated(request, env))) {
        return jsonResponse({ error: "未登录" }, 401);
    }

    try {
        return jsonResponse(await readPost(env, params.slug));
    } catch (error) {
        return jsonResponse({ error: error.message }, 500);
    }
}

export async function onRequestPut({ request, env, params }) {
    if (!(await isAuthenticated(request, env))) {
        return jsonResponse({ error: "未登录" }, 401);
    }

    try {
        const payload = await request.json();
        await writePost(env, params.slug, payload);
        return jsonResponse({ ok: true });
    } catch (error) {
        return jsonResponse({ error: error.message }, 500);
    }
}
