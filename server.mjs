import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleRequest } from "./server-core.mjs";

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = path.dirname(modulePath);

loadEnvFile(path.join(projectRoot, ".env"));
loadEnvFile(path.join(projectRoot, ".env.local"));

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 3000);
const env = process.env;

const server = createServer(async (nodeRequest, nodeResponse) => {
    let request;
    try {
        request = await toWebRequest(nodeRequest);
        const response = await handleRequest(request, env);
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

function toWebRequest(nodeRequest) {
    return (async () => {
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
            body: await readNodeBody(nodeRequest, requestBodyLimit()),
            duplex: "half",
        });
    })();
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
