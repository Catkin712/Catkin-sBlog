import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const cookieName = "album_inner_session";
const sessionMaxAge = 60 * 60 * 4;
const defaultInnerPassword = "妄想清高";

export function verifyInnerPassword(env = {}, value) {
    const expected = String(env.ALBUM_INNER_PASSWORD || defaultInnerPassword);
    return safeEqual(String(value ?? ""), expected);
}

export function hasInnerAlbumSession(request, env = {}) {
    const token = readCookie(request, cookieName);
    const separator = token.indexOf(".");
    if (separator === -1) {
        return false;
    }

    const expires = token.slice(0, separator);
    const signature = token.slice(separator + 1);
    if (!/^\d+$/.test(expires) || Number(expires) <= Date.now()) {
        return false;
    }

    return safeEqual(signature, sign(expires, sessionSecret(env)));
}

export function createInnerSessionCookie(request, env = {}) {
    const expires = String(Date.now() + sessionMaxAge * 1000);
    const token = `${expires}.${sign(expires, sessionSecret(env))}`;
    const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
    return `${cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionMaxAge}${secure}`;
}

export function expiredInnerSessionCookie() {
    return `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function sessionSecret(env) {
    return String(
        env.ALBUM_MODE_SESSION_SECRET ||
        env.ADMIN_SESSION_SECRET ||
        env.ALBUM_INNER_PASSWORD ||
        defaultInnerPassword,
    );
}

function sign(value, secret) {
    return createHmac("sha256", secret).update(value).digest("base64url");
}

function readCookie(request, name) {
    const cookie = request.headers.get("cookie") || "";
    const value = cookie
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${name}=`))
        ?.slice(name.length + 1);
    if (!value) {
        return "";
    }
    try {
        return decodeURIComponent(value);
    } catch {
        return "";
    }
}

function safeEqual(left, right) {
    const leftHash = createHash("sha256").update(left).digest();
    const rightHash = createHash("sha256").update(right).digest();
    return timingSafeEqual(leftHash, rightHash);
}
