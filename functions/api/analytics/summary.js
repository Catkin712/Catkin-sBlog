import { getUmamiSummary } from "../../_shared/analytics.mjs";
import { jsonResponse } from "../../_shared/html.mjs";

export async function onRequestGet({ env }) {
    return jsonResponse(await getUmamiSummary(env), 200, {
        "cache-control": "public, max-age=300",
    });
}
