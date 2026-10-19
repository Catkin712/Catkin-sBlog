import { writeFileSync } from "node:fs";
import path from "node:path";
import { getStore } from "@netlify/blobs";

const siteID = process.env.NETLIFY_SITE_ID;
const token = process.env.NETLIFY_AUTH_TOKEN;
if (!siteID || !token) {
    console.error("请先设置 NETLIFY_SITE_ID 和 NETLIFY_AUTH_TOKEN（Netlify User settings → Applications → Personal access tokens）。");
    process.exit(1);
}

const output = process.argv[2] || `catkinsblog-netlify-${new Date().toISOString().slice(0, 10)}.sqlite`;
const store = getStore({ name: "catkinsblog-database", siteID, token, consistency: "strong" });
const data = await store.get("catkinsblog.sqlite", { type: "arrayBuffer" });
if (!data) {
    console.error("Netlify Blobs 中还没有数据库。先打开一次线上站点并保存一篇文章，或运行一次写入操作。");
    process.exit(1);
}

writeFileSync(output, Buffer.from(data));
console.log(`已备份到 ${path.resolve(output)}（${Buffer.from(data).length} bytes）`);
