import { isAuthenticated } from "../_shared/auth.mjs";
import { renderAlbumAdminPage } from "../_shared/album-admin-html.mjs";
import { htmlResponse, renderLoginPage } from "../_shared/html.mjs";

export async function onRequestGet({ request, env }) {
    return htmlResponse((await isAuthenticated(request, env)) ? renderAlbumAdminPage() : renderLoginPage(), 200, {
        "cache-control": "no-store",
    });
}
