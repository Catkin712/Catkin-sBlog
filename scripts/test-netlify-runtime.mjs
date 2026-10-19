import { rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const blobDir = process.env.CATKINS_TEST_BLOBS || path.join(os.tmpdir(), "catkins-netlify-test-blobs");
if (process.env.CATKINS_TEST_RESET === "1") {
    await rm(blobDir, { recursive: true, force: true });
}
process.env.CATKINS_BLOB_DIR = blobDir;
process.env.NETLIFY = "true";
process.env.CATKINS_USE_BLOBS = "true";

const { default: handler } = await import("../netlify/functions/server.mjs");

const checks = [];
async function check(name, url, options = {}, verify = null, expectedStatus = 200) {
    const response = await handler(new Request(url, options));
    const body = await response.text();
    const ok = response.status === expectedStatus && (!verify || verify(body));
    checks.push({ name, status: response.status, size: body.length, ok });
    console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${response.status} ${body.length} bytes`);
    if (!ok) console.log(body.slice(0, 400));
    return { response, body };
}

await check("home", "https://www.catkins.vip/", {}, (body) => body.includes("Catkin"));
await check("post", "https://www.catkins.vip/posts/mader/", {}, (body) => body.includes("絮"));
await check("album", "https://www.catkins.vip/album/", {}, (body) => body.includes("相册"));
await check("tags", "https://www.catkins.vip/tags/", {}, (body) => body.includes("标签"));
await check("search", "https://www.catkins.vip/search.json", {}, (body) => body.startsWith("["));

const marker = `测试留言-${Date.now()}`;
await check("guestbook-post", "https://www.catkins.vip/api/guestbook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ nickname: "迁移测试", content: marker }),
}, (body) => body.includes(marker), 201);
await check("guestbook-page", "https://www.catkins.vip/guestbook/", {}, (body) => body.includes(marker));
await check("guestbook-api", "https://www.catkins.vip/api/guestbook", {}, (body) => body.includes(marker));
await check("album-mode-wrong-password", "https://www.catkins.vip/api/album-mode", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: "definitely-wrong" }),
}, null, 401);
await check("upload-session-invalid", "https://www.catkins.vip/api/album-upload-sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ nickname: "x", photos: [], visibility: "public" }),
}, null, 400);

const failed = checks.filter((item) => !item.ok);
console.log(JSON.stringify({ blobDir, failed: failed.length }, null, 2));
if (failed.length) process.exitCode = 1;
