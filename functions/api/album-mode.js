import {
    createInnerSessionCookie,
    expiredInnerSessionCookie,
    verifyInnerPassword,
} from "../_shared/album-mode-auth.mjs";
import { jsonResponse } from "../_shared/html.mjs";

export async function onRequestPost({ request, env }) {
    const payload = await request.json().catch(() => ({}));
    if (!verifyInnerPassword(env, payload.password)) {
        return jsonResponse({ error: "密码不正确" }, 401);
    }

    return jsonResponse({ ok: true }, 200, {
        "set-cookie": createInnerSessionCookie(request, env),
    });
}

export function onRequestDelete() {
    return jsonResponse({ ok: true }, 200, {
        "set-cookie": expiredInnerSessionCookie(),
    });
}
