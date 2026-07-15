import { getUmamiTrackingConfig } from "../../_shared/analytics.mjs";
import { jsonResponse } from "../../_shared/html.mjs";

export async function onRequestGet({ env }) {
    const config = getUmamiTrackingConfig(env);
    return jsonResponse(
        {
            enabled: config.enabled,
            websiteId: config.enabled ? config.websiteId : "",
            scriptUrl: config.enabled ? config.scriptUrl : "",
        },
        200,
        { "cache-control": "public, max-age=300" },
    );
}
