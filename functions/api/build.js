import { isAuthenticated } from "../_shared/auth.mjs";
import { jsonResponse } from "../_shared/html.mjs";

export async function onRequestPost({ request, env }) {
    if (!(await isAuthenticated(request, env))) {
        return jsonResponse({ error: "未登录" }, 401);
    }

    return jsonResponse({
        ok: true,
        output: "当前站点已迁移到 Cloudflare Pages Functions，文章更新不需要重新部署。",
    });
}
