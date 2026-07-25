import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isInnerAlbumFile, resolveUploadedFile } from "./functions/_shared/album-storage.mjs";
import { hasInnerAlbumSession } from "./functions/_shared/album-mode-auth.mjs";

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = path.dirname(modulePath);
const distRoot = path.join(projectRoot, "dist");
const publicRoot = path.join(projectRoot, "public");

loadEnvFile(path.join(projectRoot, ".env"));
loadEnvFile(path.join(projectRoot, ".env.local"));

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 3000);
const env = process.env;

const routes = [
    ["GET", /^\/$/, "functions/index.js"],
    ["GET", /^\/admin\/?$/, "functions/admin.js"],
    ["GET", /^\/guestbook\/?$/, "functions/guestbook/index.js"],
    ["GET", /^\/album\/?$/, "functions/album/index.js"],
    ["GET", /^\/album\/([^/]+)\/?$/, "functions/album/[id]/index.js", ["id"]],
    ["GET", /^\/archive\/?$/, "functions/archive/index.js"],
    ["GET", /^\/tags\/?$/, "functions/tags/index.js"],
    ["GET", /^\/tags\/([^/]+)\/?$/, "functions/tags/[tag]/index.js", ["tag"]],
    ["GET", /^\/categories\/?$/, "functions/categories/index.js"],
    [
        "GET",
        /^\/categories\/([^/]+)\/?$/,
        "functions/categories/[category]/index.js",
        ["category"],
    ],
    ["GET", /^\/posts\/([^/]+)\/?$/, "functions/posts/[slug]/index.js", ["slug"]],
    ["GET", /^\/search\.json$/, "functions/search.json.js"],
    ["GET", /^\/rss\.xml$/, "functions/rss.xml.js"],
    ["GET", /^\/api\/guestbook$/, "functions/api/guestbook.js"],
    ["POST", /^\/api\/guestbook$/, "functions/api/guestbook.js"],
    ["GET", /^\/api\/albums$/, "functions/api/albums.js"],
    ["POST", /^\/api\/albums$/, "functions/api/albums.js"],
    ["GET", /^\/api\/album-uploaders$/, "functions/api/album-uploaders.js"],
    ["POST", /^\/api\/album-upload-sessions$/, "functions/api/album-upload-sessions.js"],
    ["POST", /^\/api\/album-upload-sessions\/([^/]+)\/complete$/, "functions/api/album-upload-sessions/[id]/complete.js", ["id"]],
    ["POST", /^\/api\/post-media$/, "functions/api/post-media.js"],
    ["GET", /^\/media\/(.+)$/, "functions/media/[key].js", ["key"]],
    ["POST", /^\/api\/album-mode$/, "functions/api/album-mode.js"],
    ["DELETE", /^\/api\/album-mode$/, "functions/api/album-mode.js"],
    ["POST", /^\/api\/album-uploads\/([^/]+)\/likes$/, "functions/api/album-uploads/[id]/likes.js", ["id"]],
    ["POST", /^\/api\/album-uploads\/([^/]+)\/comments$/, "functions/api/album-uploads/[id]/comments.js", ["id"]],
    ["GET", /^\/api\/posts$/, "functions/api/posts.js"],
    ["GET", /^\/api\/posts\/([^/]+)$/, "functions/api/posts/[slug].js", ["slug"]],
    ["PUT", /^\/api\/posts\/([^/]+)$/, "functions/api/posts/[slug].js", ["slug"]],
    ["POST", /^\/api\/login$/, "functions/api/login.js"],
    ["POST", /^\/api\/logout$/, "functions/api/logout.js"],
    ["POST", /^\/api\/build$/, "functions/api/build.js"],
];

const server = createServer(async (nodeRequest, nodeResponse) => {
    let request;
    try {
        const requestPath = String(nodeRequest.url || "").split("?", 1)[0];
        request = await toWebRequest(nodeRequest);
        const response = await handleRequest(request);
        await sendNodeResponse(nodeResponse, response, nodeRequest.method === "HEAD");
    } catch (error) {
        const response = buildErrorResponse(
            request ?? new Request(`http://${nodeRequest.headers.host ?? "127.0.0.1"}${nodeRequest.url ?? "/"}`, {
                method: nodeRequest.method ?? "GET",
            }),
            error,
        );
        await sendNodeResponse(nodeResponse, response);
    }
});

server.listen(port, host, () => {
    console.log(`Catkin's Blog server running at http://${host}:${port}`);
});

async function handleRequest(request) {
    const staticResponse = await serveStatic(request);
    if (staticResponse) {
        return staticResponse;
    }

    const url = new URL(request.url);
    const method = request.method === "HEAD" ? "GET" : request.method;
    for (const [routeMethod, pattern, moduleFile, paramNames = []] of routes) {
        if (routeMethod !== method) {
            continue;
        }

        const match = pattern.exec(url.pathname);
        if (!match) {
            continue;
        }

        const routeModule = await import(pathToFileURL(path.join(projectRoot, moduleFile)));
        const handler = routeModule[`onRequest${toHandlerSuffix(method)}`];
        if (!handler) {
            break;
        }

        const params = Object.fromEntries(
            paramNames.map((name, index) => [name, match[index + 1]]),
        );
        return await handler({ request, env, params });
    }

    return new Response("Not Found", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" },
    });
}

async function serveStatic(request) {
    if (!["GET", "HEAD"].includes(request.method)) {
        return null;
    }

    const url = new URL(request.url);
    const uploadedCandidate = url.pathname.startsWith("/uploads/")
        ? resolveUploadedFile(env, url.pathname)
        : null;
    const protectedAlbumFile = isInnerAlbumFile(env, uploadedCandidate);
    if (protectedAlbumFile && !hasInnerAlbumSession(request, env)) {
        return new Response("Not Found", {
            status: 404,
            headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
        });
    }
    const candidate = uploadedCandidate && existsSync(uploadedCandidate) && statSync(uploadedCandidate).isFile()
        ? uploadedCandidate
        : resolveStaticPath(distRoot, url.pathname) ?? resolveStaticPath(publicRoot, url.pathname);
    if (!candidate) {
        return null;
    }

    return new Response(readFileSync(candidate), {
        headers: {
            "content-type": contentType(candidate),
            "cache-control": protectedAlbumFile
                ? "private, no-store"
                : uploadedCandidate
                    ? "public, max-age=31536000, immutable"
                    : cacheControl(candidate),
            "x-content-type-options": "nosniff",
        },
    });
}

function resolveStaticPath(root, pathname) {
    const decodedPath = decodeURIComponent(pathname);
    const relativePath = decodedPath.replace(/^\/+/, "");
    const filePath = path.resolve(root, relativePath);
    const normalizedRoot = path.resolve(root);
    if (filePath !== normalizedRoot && !filePath.startsWith(`${normalizedRoot}${path.sep}`)) {
        return null;
    }

    const candidates = [];
    if (pathname.endsWith("/")) {
        candidates.push(path.join(filePath, "index.html"));
    } else {
        candidates.push(filePath, path.join(filePath, "index.html"));
    }

    return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
}

function toHandlerSuffix(method) {
    return method.charAt(0).toUpperCase() + method.slice(1).toLowerCase();
}

async function toWebRequest(nodeRequest) {
    const requestHost = nodeRequest.headers.host ?? `${host}:${port}`;
    const requestProtocol = nodeRequest.headers["x-forwarded-proto"] ?? "http";
    const url = `${requestProtocol}://${requestHost}${nodeRequest.url ?? "/"}`;
    const headers = new Headers();
    for (const [key, value] of Object.entries(nodeRequest.headers)) {
        if (Array.isArray(value)) {
            for (const item of value) {
                headers.append(key, item);
            }
        } else if (value !== undefined) {
            headers.set(key, value);
        }
    }

    const method = nodeRequest.method ?? "GET";
    if (["GET", "HEAD"].includes(method)) {
        return new Request(url, { method, headers });
    }

    return new Request(url, {
        method,
        headers,
        body: await readNodeBody(nodeRequest, requestBodyLimit(nodeRequest.url)),
        duplex: "half",
    });
}

function readNodeBody(nodeRequest, maxBytes) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        let rejected = false;
        const declaredSize = Number(nodeRequest.headers["content-length"] || 0);
        if (declaredSize > maxBytes) {
            rejected = true;
            nodeRequest.resume();
            reject(httpError("上传内容超过服务器限制", 413));
            return;
        }
        nodeRequest.on("data", (chunk) => {
            if (rejected) return;
            size += chunk.length;
            if (size > maxBytes) {
                rejected = true;
                chunks.length = 0;
                reject(httpError("上传内容超过服务器限制", 413));
                return;
            }
            chunks.push(chunk);
        });
        nodeRequest.on("end", () => {
            if (!rejected) resolve(Buffer.concat(chunks));
        });
        nodeRequest.on("error", reject);
    });
}

function requestBodyLimit() {
    return 2 * 1024 * 1024;
}

function httpError(message, status) {
    const error = new Error(message);
    error.status = status;
    return error;
}

async function sendNodeResponse(nodeResponse, webResponse, skipBody = false) {
    nodeResponse.statusCode = webResponse.status;
    webResponse.headers.forEach((value, key) => {
        nodeResponse.setHeader(key, value);
    });

    if (skipBody) {
        nodeResponse.end();
        return;
    }

    nodeResponse.end(Buffer.from(await webResponse.arrayBuffer()));
}

function loadEnvFile(filePath) {
    if (!existsSync(filePath)) {
        return;
    }

    for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
            continue;
        }

        const separatorIndex = trimmed.indexOf("=");
        if (separatorIndex === -1) {
            continue;
        }

        const key = trimmed.slice(0, separatorIndex).trim();
        let value = trimmed.slice(separatorIndex + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }

        if (key && process.env[key] === undefined) {
            process.env[key] = value;
        }
    }
}

function contentType(filePath) {
    const extension = path.extname(filePath).toLowerCase();
    return (
        {
            ".css": "text/css; charset=utf-8",
            ".gif": "image/gif",
            ".html": "text/html; charset=utf-8",
            ".ico": "image/x-icon",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".js": "text/javascript; charset=utf-8",
            ".json": "application/json; charset=utf-8",
            ".png": "image/png",
            ".svg": "image/svg+xml; charset=utf-8",
            ".webp": "image/webp",
            ".xml": "application/xml; charset=utf-8",
        }[extension] || "application/octet-stream"
    );
}

function cacheControl(filePath) {
    const filename = path.basename(filePath).toLowerCase();
    if (["album.js", "album.css", "site.js", "site.css"].includes(filename)) {
        return "no-cache";
    }
    return filePath.includes(`${path.sep}_astro${path.sep}`)
        ? "public, max-age=31536000, immutable"
        : "public, max-age=300";
}

function buildErrorResponse(request, error) {
    const url = new URL(request.url);
    const message = error?.message || String(error);

    const status = Number(error?.status) || 500;
    if (url.pathname.startsWith("/api/")) {
        return new Response(
            JSON.stringify({
                error: message,
                method: request.method,
                path: url.pathname,
            }),
            {
                status,
                headers: {
                    "content-type": "application/json; charset=utf-8",
                    "cache-control": "no-store",
                },
            },
        );
    }

    return new Response(status === 413 ? message : `Internal Server Error\n${error?.stack || message}`, {
        status,
        headers: { "content-type": "text/plain; charset=utf-8" },
    });
}
