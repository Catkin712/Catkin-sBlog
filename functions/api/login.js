import {
    createSessionCookie,
    getAdminAccounts,
    getAdminConfigError,
} from "../_shared/auth.mjs";
import { jsonResponse } from "../_shared/html.mjs";

export async function onRequestPost({ request, env }) {
    const configError = getAdminConfigError(env);
    if (configError) {
        return jsonResponse({ error: configError }, 500);
    }

    const payload = await request.json().catch(() => ({}));
    const account = getAdminAccounts(env).find(
        (item) => item.username === payload.username && item.password === payload.password,
    );

    if (!account) {
        return jsonResponse({ error: "用户名或密码错误" }, 401);
    }

    return jsonResponse(
        { ok: true },
        200,
        {
            "set-cookie": await createSessionCookie(account.username, request, env),
        },
    );
}
