import { expiredSessionCookie } from "../_shared/auth.mjs";
import { jsonResponse } from "../_shared/html.mjs";

export async function onRequestPost() {
    return jsonResponse({ ok: true }, 200, {
        "set-cookie": expiredSessionCookie(),
    });
}
