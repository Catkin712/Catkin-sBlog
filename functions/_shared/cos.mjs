import { createHmac, createHash, randomUUID } from "node:crypto";

const defaultUrlTtl = 600;

export function hasCosConfig(env = {}) {
    return Boolean(env.COS_SECRET_ID && env.COS_SECRET_KEY && env.COS_BUCKET && env.COS_REGION);
}

export function requireCosConfig(env = {}) {
    if (!hasCosConfig(env)) {
        throw new Error("COS 尚未配置，请先设置 COS_SECRET_ID、COS_SECRET_KEY、COS_BUCKET 和 COS_REGION");
    }
}

export function cosObjectUrl(env, objectKey, method = "GET", options = {}) {
    requireCosConfig(env);
    const key = normalizeObjectKey(objectKey);
    const expires = Math.max(60, Math.min(3600, Number(options.expires || defaultUrlTtl)));
    const start = Math.floor(Date.now() / 1000);
    const signTime = `${start};${start + expires}`;
    const host = `${env.COS_BUCKET}.cos.${env.COS_REGION}.myqcloud.com`;
    const path = `/${key.split("/").map(encodeURIComponent).join("/")}`;
    const headers = normalizeSignMap(options.headers);
    const params = normalizeSignMap(options.params);
    const httpParameters = formatSignMap(params);
    const httpHeaders = formatSignMap(headers);
    const httpString = [String(method).toLowerCase(), path, httpParameters, httpHeaders, ""].join("\n");
    const signKey = hmacSha1(env.COS_SECRET_KEY, signTime);
    const stringToSign = ["sha1", signTime, sha1(httpString), ""].join("\n");
    const signature = hmacSha1(signKey, stringToSign);
    const authorization = [
        "q-sign-algorithm=sha1",
        `q-ak=${encodeURIComponent(env.COS_SECRET_ID)}`,
        `q-sign-time=${signTime}`,
        `q-key-time=${signTime}`,
        `q-header-list=${Object.keys(headers).sort().join(";")}`,
        `q-url-param-list=${Object.keys(params).sort().join(";")}`,
        `q-signature=${signature}`,
    ].join("&");
    return `https://${host}${path}?${authorization}`;
}

export function createCosObjectKey(env, kind, visibility, extension = "jpg") {
    const roots = {
        avatar: "avatars",
        cover: "covers",
        photo: "albums",
        post: "posts",
    };
    const root = roots[kind];
    if (!root) {
        throw new Error("COS 对象类型无效");
    }
    const folder = kind === "photo" ? visibility : "shared";
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    return `${root}/${folder}/${year}/${month}/${randomUUID()}.${extension}`;
}

export function mediaUrl(env, value, expires = 3600) {
    const text = String(value || "");
    return text.startsWith("cos:")
        ? cosObjectUrl(env, text.slice(4), "GET", { expires: env.COS_READ_URL_TTL_SECONDS || expires })
        : text;
}

export function normalizeObjectKey(value) {
    const key = String(value || "").replace(/^\/+/, "");
    if (!key || key.length > 1024 || key.includes("..") || /[\0\r\n]/.test(key)) {
        throw new Error("COS 对象键无效");
    }
    return key;
}

export async function headCosObject(env, objectKey) {
    const response = await fetch(cosObjectUrl(env, objectKey, "HEAD"), {
        method: "HEAD",
    });
    if (!response.ok) {
        throw new Error(`COS 对象校验失败（HTTP ${response.status}）`);
    }
    return {
        byteSize: Number(response.headers.get("content-length") || 0),
        mimeType: response.headers.get("content-type") || "",
    };
}

export async function deleteCosObject(env, objectKey) {
    const response = await fetch(cosObjectUrl(env, objectKey, "DELETE"), { method: "DELETE" });
    if (!response.ok && response.status !== 404) {
        throw new Error(`COS object cleanup failed (HTTP ${response.status})`);
    }
}

export async function readCosObjectHeader(env, objectKey) {
    const response = await fetch(cosObjectUrl(env, objectKey, "GET"), {
        headers: { Range: "bytes=0-15" },
    });
    if (!response.ok && response.status !== 206) {
        throw new Error(`COS 对象内容校验失败（HTTP ${response.status}）`);
    }
    return Buffer.from(await response.arrayBuffer());
}

function normalizeSignMap(values = {}) {
    return Object.fromEntries(Object.entries(values || {})
        .map(([key, value]) => [String(key).toLowerCase(), String(value)])
        .filter(([key]) => /^[a-z0-9-]+$/.test(key)));
}

function formatSignMap(values) {
    return Object.keys(values).sort().map((key) => `${safeEncode(key)}=${safeEncode(values[key])}`).join("&");
}

function safeEncode(value) {
    return encodeURIComponent(String(value)).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function hmacSha1(key, value) {
    return createHmac("sha1", key).update(value).digest("hex");
}

function sha1(value) {
    return createHash("sha1").update(value).digest("hex");
}
