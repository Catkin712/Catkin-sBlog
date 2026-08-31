import Busboy from "busboy";
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { albumStoragePaths } from "./album-storage.mjs";
import { AlbumError, createUploadFromStagedFiles } from "./albums.mjs";
import { jsonResponse } from "./html.mjs";

const maxPhotoBytes = 20 * 1024 * 1024;

export async function handleNodeAlbumUpload(nodeRequest, env = {}, maxRequestBytes) {
    const contentType = nodeRequest.headers["content-type"] || "";
    if (!contentType.startsWith("multipart/form-data")) {
        nodeRequest.resume();
        return jsonResponse({ error: "上传请求格式不正确" }, 400);
    }

    const declaredSize = Number(nodeRequest.headers["content-length"] || 0);
    if (declaredSize > maxRequestBytes) {
        nodeRequest.resume();
        return jsonResponse({ error: "上传内容超过服务器限制" }, 413);
    }

    const stagingDirectory = path.join(
        albumStoragePaths(env).uploadsRoot,
        ".staging",
        randomUUID(),
    );
    try {
        await mkdir(stagingDirectory, { recursive: true });
        const parts = await parseMultipart(nodeRequest, stagingDirectory, maxRequestBytes);
        const upload = await createUploadFromStagedFiles(env, parts);
        return jsonResponse({ upload }, 201);
    } catch (error) {
        const status = error instanceof AlbumError ? error.status : Number(error?.status) || 500;
        return jsonResponse({
            error: status === 500 ? "照片上传失败，请稍后再试" : error.message,
        }, status);
    } finally {
        await rm(stagingDirectory, { recursive: true, force: true }).catch(() => {});
    }
}

async function parseMultipart(nodeRequest, stagingDirectory, maxRequestBytes) {
    const fields = { albumIds: [] };
    const photos = [];
    let avatar = null;
    const writes = [];
    let totalBytes = 0;
    let parser;

    try {
        parser = Busboy({
            headers: nodeRequest.headers,
            defParamCharset: "utf8",
            limits: {
                fieldNameSize: 80,
                fieldSize: 16 * 1024,
                fields: 50,
                fileSize: maxPhotoBytes,
                files: 21,
                parts: 75,
            },
        });
    } catch {
        nodeRequest.resume();
        throw new AlbumError("上传请求格式不正确");
    }

    parser.on("field", (name, value) => {
        if (name === "albumIds") {
            fields.albumIds.push(value);
            return;
        }
        if (["nickname", "people", "location", "message", "newAlbumName", "visibility"].includes(name)) {
            fields[name] = value;
        }
    });

    parser.on("file", (name, file, info) => {
        if (!info.filename || !["photos", "avatar"].includes(name)) {
            file.resume();
            return;
        }
        if (name === "avatar" && avatar) {
            file.resume();
            parser.destroy(new AlbumError("每次只能上传一个头像"));
            return;
        }

        const item = {
            tempPath: path.join(stagingDirectory, randomUUID()),
            originalName: info.filename,
            byteSize: 0,
        };
        if (name === "photos") {
            photos.push(item);
        } else {
            avatar = item;
        }

        let exceeded = false;
        file.on("data", (chunk) => {
            item.byteSize += chunk.length;
        });
        file.on("limit", () => {
            exceeded = true;
        });
        const write = pipeline(file, createWriteStream(item.tempPath, { flags: "wx" }))
            .then(() => {
                if (exceeded) {
                    throw new AlbumError(`${name === "avatar" ? "头像" : "照片"} ${info.filename} 超过大小限制`);
                }
            });
        write.catch(() => {});
        writes.push(write);
    });

    parser.once("filesLimit", () => {
        parser.destroy(new AlbumError("每次最多上传 20 张照片和 1 个头像"));
    });
    parser.once("fieldsLimit", () => {
        parser.destroy(new AlbumError("上传字段数量超过限制"));
    });
    parser.once("partsLimit", () => {
        parser.destroy(new AlbumError("上传内容数量超过限制"));
    });

    const limiter = new Transform({
        transform(chunk, encoding, callback) {
            totalBytes += chunk.length;
            if (totalBytes > maxRequestBytes) {
                const error = new AlbumError("上传内容超过服务器限制", 413);
                error.status = 413;
                callback(error);
                return;
            }
            callback(null, chunk);
        },
    });

    let parseError = null;
    try {
        await new Promise((resolve, reject) => {
            parser.once("close", resolve);
            parser.once("error", reject);
            limiter.once("error", (error) => {
                parser.destroy(error);
                reject(error);
            });
            nodeRequest.once("aborted", () => reject(new AlbumError("上传连接已中断", 400)));
            nodeRequest.once("error", reject);
            nodeRequest.pipe(limiter).pipe(parser);
        });
    } catch (error) {
        parseError = error;
        nodeRequest.unpipe(limiter);
        limiter.unpipe(parser);
        nodeRequest.resume();
    }

    const writeResults = await Promise.allSettled(writes);
    const failedWrite = writeResults.find((result) => result.status === "rejected");
    if (parseError) {
        throw parseError;
    }
    if (failedWrite) {
        throw failedWrite.reason;
    }
    if (photos.length > 20) {
        throw new AlbumError("每次最多上传 20 张照片");
    }

    return { fields, photos, avatar };
}
