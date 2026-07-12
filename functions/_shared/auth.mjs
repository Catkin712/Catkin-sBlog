const sessionCookieName = "admin_session";
const sessionMaxAge = 60 * 60 * 24 * 7;

export function getAdminConfigError(env) {
    const missing = [];
    if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD) {
        missing.push("ADMIN_USERNAME", "ADMIN_PASSWORD");
    }
    if (!env.ADMIN_SESSION_SECRET) {
        missing.push("ADMIN_SESSION_SECRET");
    }

    const accounts = getAdminAccounts(env);
    if (missing.length === 0 && accounts.length > 0) {
        return "";
    }

    return `缺少后台登录环境变量：${[...new Set(missing)].join(", ")}。请在 Cloudflare Pages 的 Environment variables 中配置后重新部署。`;
}

export function getAdminAccounts(env) {
    const accounts = [];
    if (env.ADMIN_USERNAME && env.ADMIN_PASSWORD) {
        accounts.push({
            username: env.ADMIN_USERNAME,
            password: env.ADMIN_PASSWORD,
        });
    }

    const extraUsers = env.ADMIN_EXTRA_USERS || "";
    for (const pair of extraUsers.split(/[\n,]+/)) {
        const trimmed = pair.trim();
        if (!trimmed) {
            continue;
        }
        const separatorIndex = trimmed.indexOf(":");
        if (separatorIndex === -1) {
            continue;
        }
        const username = trimmed.slice(0, separatorIndex).trim();
        const password = trimmed.slice(separatorIndex + 1).trim();
        if (username && password) {
            accounts.push({ username, password });
        }
    }
    return accounts;
}

export async function isAuthenticated(request, env) {
    const token = readCookie(request, sessionCookieName);
    if (!token) {
        return false;
    }

    const [payload, signature] = token.split(".");
    if (!payload || !signature) {
        return false;
    }

    const expected = await sign(payload, env.ADMIN_SESSION_SECRET || "");
    if (expected !== signature) {
        return false;
    }

    try {
        const data = JSON.parse(decodeBase64Url(payload));
        return (
            getAdminAccounts(env).some((account) => account.username === data.username) &&
            Number(data.exp) > Date.now()
        );
    } catch {
        return false;
    }
}

export async function createSessionCookie(username, request, env) {
    const payload = encodeBase64Url(
        JSON.stringify({
            username,
            exp: Date.now() + sessionMaxAge * 1000,
        }),
    );
    const token = `${payload}.${await sign(payload, env.ADMIN_SESSION_SECRET)}`;
    const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
    return `${sessionCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionMaxAge}${secure}`;
}

export function expiredSessionCookie() {
    return `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function readCookie(request, name) {
    const cookie = request.headers.get("cookie") || "";
    return (
        cookie
            .split(";")
            .map((part) => part.trim())
            .find((part) => part.startsWith(`${name}=`))
            ?.slice(name.length + 1) || ""
    );
}

async function sign(payload, secret) {
    if (!secret) {
        return "";
    }
    const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
    );
    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
    return bytesToBase64Url(new Uint8Array(signature));
}

function encodeBase64Url(value) {
    return bytesToBase64Url(new TextEncoder().encode(value));
}

function decodeBase64Url(value) {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
}

function bytesToBase64Url(bytes) {
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
