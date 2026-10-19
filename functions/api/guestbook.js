import { addGuestbookMessage, listGuestbookMessages } from "../_shared/guestbook.mjs";
import { jsonResponse } from "../_shared/html.mjs";

export async function onRequestGet({ env }) {
    try {
        return jsonResponse({ messages: await listGuestbookMessages(env) });
    } catch (error) {
        return jsonResponse({ error: error.message }, 500);
    }
}

export async function onRequestPost({ request, env }) {
    try {
        const payload = await request.json();
        const message = await addGuestbookMessage(env, payload);
        return jsonResponse({ message }, 201);
    } catch (error) {
        return jsonResponse({ error: error.message }, 400);
    }
}
