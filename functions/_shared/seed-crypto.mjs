import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const magic = Buffer.from("CBS1");
const algorithm = "aes-256-gcm";
const ivLength = 12;
const tagLength = 16;

export function encryptSeed(buffer, env = {}) {
    const key = deriveSeedKey(env);
    const iv = randomBytes(ivLength);
    const cipher = createCipheriv(algorithm, key, iv);
    cipher.setAAD(magic);
    const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
    return Buffer.concat([magic, iv, cipher.getAuthTag(), ciphertext]);
}

export function decryptSeed(buffer, env = {}) {
    if (buffer.length < magic.length + ivLength + tagLength || !buffer.subarray(0, magic.length).equals(magic)) {
        throw new Error("种子数据库格式无效");
    }
    const iv = buffer.subarray(magic.length, magic.length + ivLength);
    const tag = buffer.subarray(magic.length + ivLength, magic.length + ivLength + tagLength);
    const ciphertext = buffer.subarray(magic.length + ivLength + tagLength);
    const decipher = createDecipheriv(algorithm, deriveSeedKey(env), iv);
    decipher.setAAD(magic);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function deriveSeedKey(env) {
    const secret = String(env.CATKINS_SEED_KEY || env.ADMIN_SESSION_SECRET || "");
    if (!secret) {
        throw new Error("缺少 CATKINS_SEED_KEY 或 ADMIN_SESSION_SECRET，无法解密种子数据库");
    }
    return createHash("sha256").update(`catkinsblog-seed-v1:${secret}`).digest();
}
