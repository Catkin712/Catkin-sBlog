import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getStore } from "@netlify/blobs";

const localStores = new Map();

/**
 * Returns a Netlify Blobs store in production, or a small filesystem-backed
 * lookalike when CATKINS_BLOB_DIR is set (used for local migration tests).
 */
export function getBlobStore(name) {
    const localRoot = process.env.CATKINS_BLOB_DIR;
    if (localRoot) {
        const key = path.resolve(localRoot);
        let stores = localStores.get(key);
        if (!stores) {
            stores = new Map();
            localStores.set(key, stores);
        }
        if (!stores.has(name)) {
            stores.set(name, new FileBlobStore(path.join(key, name)));
        }
        return stores.get(name);
    }
    return getStore({ name, consistency: "strong" });
}

class FileBlobStore {
    constructor(root) {
        this.root = root;
    }

    async get(key, options = {}) {
        const buffer = await this.read(key);
        if (buffer === null) return null;
        return decode(buffer, options.type);
    }

    async getWithMetadata(key, options = {}) {
        const buffer = await this.read(key);
        if (buffer === null) return null;
        const meta = await this.readMetadata(key);
        return {
            data: options.type === "json" ? JSON.parse(buffer.toString("utf8")) : buffer.toString("utf8"),
            etag: meta?.etag,
            metadata: meta?.metadata || {},
        };
    }

    async getMetadata(key) {
        if (!existsSync(this.filePath(key))) return null;
        return await this.readMetadata(key);
    }

    async setJSON(key, value, options = {}) {
        return this.set(key, JSON.stringify(value), options);
    }

    async set(key, value, options = {}) {
        const exists = existsSync(this.filePath(key));
        const current = exists ? await this.readMetadata(key) : null;
        if (options.onlyIfNew && exists) {
            return { modified: false };
        }
        if (options.onlyIfMatch && current?.etag !== options.onlyIfMatch) {
            return { modified: false };
        }

        const buffer = await toBuffer(value);
        const etag = createHash("sha256").update(buffer).digest("hex");
        await mkdir(path.dirname(this.filePath(key)), { recursive: true });
        const temporary = `${this.filePath(key)}.${randomUUID()}.tmp`;
        await writeFile(temporary, buffer);
        await rename(temporary, this.filePath(key));
        await writeFile(this.metaPath(key), JSON.stringify({ etag, metadata: options.metadata || {} }));
        return { modified: true, etag };
    }

    async delete(key) {
        await unlink(this.filePath(key)).catch(() => {});
        await unlink(this.metaPath(key)).catch(() => {});
    }

    async read(key) {
        try {
            return await readFile(this.filePath(key));
        } catch (error) {
            if (error.code === "ENOENT") return null;
            throw error;
        }
    }

    async readMetadata(key) {
        try {
            return JSON.parse(await readFile(this.metaPath(key), "utf8"));
        } catch (error) {
            if (error.code === "ENOENT") return null;
            throw error;
        }
    }

    filePath(key) {
        const safe = Buffer.from(String(key)).toString("base64url");
        return path.join(this.root, "objects", safe);
    }

    metaPath(key) {
        return `${this.filePath(key)}.meta.json`;
    }
}

async function toBuffer(value) {
    if (Buffer.isBuffer(value)) return value;
    if (value instanceof ArrayBuffer) return Buffer.from(value);
    if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
    if (typeof value === "string") return Buffer.from(value);
    if (value && typeof value.arrayBuffer === "function") return Buffer.from(await value.arrayBuffer());
    throw new TypeError("Unsupported blob value");
}

function decode(buffer, type) {
    if (type === "json") return JSON.parse(buffer.toString("utf8"));
    if (type === "arrayBuffer") {
        return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    }
    if (type === "blob") return new Blob([buffer]);
    return buffer.toString("utf8");
}
