const defaultScriptUrl = "https://cloud.umami.is/script.js";
const defaultApiUrl = "https://api.umami.is/v1";

export function getUmamiTrackingConfig(env) {
    const websiteId = String(env.UMAMI_WEBSITE_ID ?? "").trim();
    const scriptUrl = String(env.UMAMI_SCRIPT_URL ?? defaultScriptUrl).trim();

    return {
        enabled: Boolean(websiteId && scriptUrl),
        websiteId,
        scriptUrl,
    };
}

export async function getUmamiSummary(env) {
    const tracking = getUmamiTrackingConfig(env);
    const apiKey = String(env.UMAMI_API_KEY ?? "").trim();
    const apiToken = String(env.UMAMI_API_TOKEN ?? "").trim();

    if (!tracking.enabled) {
        return {
            enabled: false,
            configured: false,
            message: "Umami 未配置",
        };
    }

    if (!apiKey && !apiToken) {
        return {
            enabled: true,
            configured: false,
            message: "Umami 统计凭据未配置",
        };
    }

    const now = Date.now();
    const startAt = now - 30 * 24 * 60 * 60 * 1000;
    const apiUrl = String(env.UMAMI_API_URL ?? defaultApiUrl).replace(/\/$/, "");
    const url = new URL(`${apiUrl}/websites/${encodeURIComponent(tracking.websiteId)}/stats`);
    url.searchParams.set("startAt", String(startAt));
    url.searchParams.set("endAt", String(now));

    const headers = {
        accept: "application/json",
    };
    if (apiKey) {
        headers["x-umami-api-key"] = apiKey;
    } else {
        headers.authorization = `Bearer ${apiToken}`;
    }

    try {
        const response = await fetch(url, { headers });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload?.message ?? `Umami API 返回 ${response.status}`);
        }

        return {
            enabled: true,
            configured: true,
            periodLabel: "近 30 天",
            pageviews: metricValue(payload.pageviews),
            visitors: metricValue(payload.visitors),
            visits: metricValue(payload.visits),
            bounces: metricValue(payload.bounces),
        };
    } catch (error) {
        return {
            enabled: true,
            configured: false,
            message: error.message,
        };
    }
}

function metricValue(metric) {
    if (typeof metric === "number") {
        return metric;
    }
    if (metric && typeof metric === "object" && "value" in metric) {
        return Number(metric.value) || 0;
    }
    return 0;
}
