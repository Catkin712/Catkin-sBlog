import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isInnerAlbumFile, resolveUploadedFile } from "./functions/_shared/album-storage.mjs";
import { hasInnerAlbumSession } from "./functions/_shared/album-mode-auth.mjs";

import * as homePage from "./functions/index.js";
import * as adminPage from "./functions/admin.js";
import * as adminAlbumsPage from "./functions/admin/albums.js";
import * as guestbookPage from "./functions/guestbook/index.js";
import * as albumPage from "./functions/album/index.js";
import * as albumDetailPage from "./functions/album/[id]/index.js";
import * as archivePage from "./functions/archive/index.js";
import * as tagsPage from "./functions/tags/index.js";
import * as tagPage from "./functions/tags/[tag]/index.js";
import * as categoriesPage from "./functions/categories/index.js";
import * as categoryPage from "./functions/categories/[category]/index.js";
import * as postPage from "./functions/posts/[slug]/index.js";
import * as searchJson from "./functions/search.json.js";
import * as rssXml from "./functions/rss.xml.js";
import * as guestbookApi from "./functions/api/guestbook.js";
import * as albumsApi from "./functions/api/albums.js";
import * as albumUploadersApi from "./functions/api/album-uploaders.js";
import * as albumUploadSessionsApi from "./functions/api/album-upload-sessions.js";
import * as albumUploadCompleteApi from "./functions/api/album-upload-sessions/[id]/complete.js";
import * as postMediaApi from "./functions/api/post-media.js";
import * as adminAlbumUploadsApi from "./functions/api/admin/album-uploads.js";
import * as adminAlbumUploadApi from "./functions/api/admin/album-uploads/[id].js";
import * as adminAlbumPhotoApi from "./functions/api/admin/album-photos/[id].js";
import * as mediaApi from "./functions/media/[key].js";
import * as albumModeApi from "./functions/api/album-mode.js";
import * as albumUploadLikesApi from "./functions/api/album-uploads/[id]/likes.js";
import * as albumUploadCommentsApi from "./functions/api/album-uploads/[id]/comments.js";
import * as postsApi from "./functions/api/posts.js";
import * as postApi from "./functions/api/posts/[slug].js";
import * as postLikesApi from "./functions/api/posts/[slug]/likes.js";
import * as postCommentsApi from "./functions/api/posts/[slug]/comments.js";
import * as loginApi from "./functions/api/login.js";
import * as logoutApi from "./functions/api/logout.js";
import * as buildApi from "./functions/api/build.js";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const distRoot = path.join(projectRoot, "dist");
const publicRoot = path.join(projectRoot, "public");

const routes = [
    ["GET", /^\/$/, homePage],
    ["GET", /^\/admin\/?$/, adminPage],
    ["GET", /^\/admin\/albums\/?$/, adminAlbumsPage],
    ["GET", /^\/guestbook\/?$/, guestbookPage],
    ["GET", /^\/album\/?$/, albumPage],
    ["GET", /^\/album\/([^/]+)\/?$/, albumDetailPage, ["id"]],
    ["GET", /^\/archive\/?$/, archivePage],
    ["GET", /^\/tags\/?$/, tagsPage],
    ["GET", /^\/tags\/([^/]+)\/?$/, tagPage, ["tag"]],
    ["GET", /^\/categories\/?$/, categoriesPage],
    ["GET", /^\/categories\/([^/]+)\/?$/, categoryPage, ["category"]],
    ["GET", /^\/posts\/([^/]+)\/?$/, postPage, ["slug"]],
    ["GET", /^\/search\.json$/, searchJson],
    ["GET", /^\/rss\.xml$/, rssXml],
    ["GET", /^\/api\/guestbook$/, guestbookApi],
    ["POST", /^\/api\/guestbook$/, guestbookApi],
    ["GET", /^\/api\/albums$/, albumsApi],
    ["POST", /^\/api\/albums$/, albumsApi],
    ["GET", /^\/api\/album-uploaders$/, albumUploadersApi],
    ["POST", /^\/api\/album-upload-sessions$/, albumUploadSessionsApi],
    ["POST", /^\/api\/album-upload-sessions\/([^/]+)\/complete$/, albumUploadCompleteApi, ["id"]],
    ["POST", /^\/api\/post-media$/, postMediaApi],
    ["GET", /^\/api\/admin\/album-uploads$/, adminAlbumUploadsApi],
    ["PATCH", /^\/api\/admin\/album-uploads\/([^/]+)$/, adminAlbumUploadApi, ["id"]],
    ["PATCH", /^\/api\/admin\/album-photos\/([^/]+)$/, adminAlbumPhotoApi, ["id"]],
    ["DELETE", /^\/api\/admin\/album-photos\/([^/]+)$/, adminAlbumPhotoApi, ["id"]],
    ["GET", /^\/media\/(.+)$/, mediaApi, ["key"]],
    ["POST", /^\/api\/album-mode$/, albumModeApi],
    ["DELETE", /^\/api\/album-mode$/, albumModeApi],
    ["POST", /^\/api\/album-uploads\/([^/]+)\/likes$/, albumUploadLikesApi, ["id"]],
    ["POST", /^\/api\/album-uploads\/([^/]+)\/comments$/, albumUploadCommentsApi, ["id"]],
    ["GET", /^\/api\/posts$/, postsApi],
    ["GET", /^\/api\/posts\/([^/]+)$/, postApi, ["slug"]],
    ["PUT", /^\/api\/posts\/([^/]+)$/, postApi, ["slug"]],
    ["POST", /^\/api\/posts\/([^/]+)\/likes$/, postLikesApi, ["slug"]],
    ["POST", /^\/api\/posts\/([^/]+)\/comments$/, postCommentsApi, ["slug"]],
    ["POST", /^\/api\/login$/, loginApi],
    ["POST", /^\/api\/logout$/, logoutApi],
    ["POST", /^\/api\/build$/, buildApi],
];

export async function handleRequest(request, env = process.env) {
    const staticResponse = await serveStatic(request, env);
    if (staticResponse) {
        return staticResponse;
    }

    const url = new URL(request.url);
    const method = request.method === "HEAD" ? "GET" : request.method;
    for (const [routeMethod, pattern, routeModule, paramNames = []] of routes) {
        if (routeMethod !== method) {
            continue;
        }

        const match = pattern.exec(url.pathname);
        if (!match) {
            continue;
        }

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

async function serveStatic(request, env) {
    if (!["GET", "HEAD"].includes(request.method)) {
        return null;
    }

    let url;
    try {
        url = new URL(request.url);
    } catch {
        return null;
    }
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
