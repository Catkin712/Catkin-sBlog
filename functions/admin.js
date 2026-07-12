import { isAuthenticated } from "./_shared/auth.mjs";
import { htmlResponse, renderAdminPage, renderLoginPage } from "./_shared/html.mjs";

export async function onRequestGet({ request, env }) {
    return htmlResponse((await isAuthenticated(request, env)) ? renderAdminPage() : renderLoginPage(), 200, {
        "cache-control": "no-store",
    });
}
