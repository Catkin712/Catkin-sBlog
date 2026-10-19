import { listGuestbookMessages } from "../_shared/guestbook.mjs";
import { htmlResponse, renderGuestbook } from "../_shared/html.mjs";

export async function onRequestGet({ env }) {
    try {
        return htmlResponse(renderGuestbook(await listGuestbookMessages(env)), 200, {
            "cache-control": "no-store",
        });
    } catch (error) {
        return htmlResponse(`留言板暂时不可用：${error.message}`, 500);
    }
}
