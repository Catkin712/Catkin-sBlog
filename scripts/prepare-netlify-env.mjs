import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const [serverEnvFile, serverLocalEnvFile, outputFile] = process.argv.slice(2);
if (!serverEnvFile || !outputFile) {
    console.error("Usage: node scripts/prepare-netlify-env.mjs <server.env> [server.env.local] <output>");
    process.exit(1);
}

const serverEnv = parseEnv(serverEnvFile);
const serverLocalEnv = serverLocalEnvFile ? parseEnv(serverLocalEnvFile) : {};

const values = {};
for (const key of [
    "ADMIN_USERNAME",
    "ADMIN_PASSWORD",
    "ADMIN_SESSION_SECRET",
    "COS_SECRET_ID",
    "COS_SECRET_KEY",
    "COS_BUCKET",
    "COS_REGION",
    "COS_UPLOAD_URL_TTL_SECONDS",
    "COS_READ_URL_TTL_SECONDS",
]) {
    if (serverEnv[key]) values[key] = serverEnv[key];
}

if (serverLocalEnv.ADMIN_EXTRA_USERS) {
    values.ADMIN_EXTRA_USERS = serverLocalEnv.ADMIN_EXTRA_USERS;
}

values.ALBUM_INNER_PASSWORD ||= serverEnv.ALBUM_INNER_PASSWORD || "妄想清高";
const existingOutput = readIfExists(outputFile);
values.ALBUM_MODE_SESSION_SECRET ||= existingOutput.ALBUM_MODE_SESSION_SECRET || serverEnv.ALBUM_MODE_SESSION_SECRET || randomBytes(32).toString("base64url");
values.SITE_VISITOR_SEED ||= serverEnv.SITE_VISITOR_SEED || "8042";
values.AWS_LAMBDA_JS_RUNTIME ||= "nodejs24.x";
values.TZ ||= "Asia/Shanghai";

const lines = [
    "# Generated for Netlify. Do not commit this file.",
    "# Import with: npx netlify env:import .env.netlify --site <SITE_ID>",
    "",
];
for (const [key, value] of Object.entries(values)) {
    lines.push(`${key}=${quote(value)}`);
}
lines.push("");
writeFileSync(outputFile, lines.join("\n"), "utf8");
console.log(JSON.stringify({
    output: outputFile,
    keys: Object.keys(values),
    adminSessionSecretIncluded: Boolean(values.ADMIN_SESSION_SECRET),
    albumModeSecretGenerated: !serverEnv.ALBUM_MODE_SESSION_SECRET,
}));
if (!values.ADMIN_SESSION_SECRET) {
    console.error("缺少 ADMIN_SESSION_SECRET：种子数据库将无法解密，请检查源 .env");
    process.exitCode = 1;
}

function readIfExists(file) {
    return existsSync(file) ? parseEnv(file) : {};
}

function parseEnv(file) {
    const result = {};
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const separator = trimmed.indexOf("=");
        if (separator === -1) continue;
        const key = trimmed.slice(0, separator).trim();
        let value = trimmed.slice(separator + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        if (key) result[key] = value;
    }
    return result;
}

function quote(value) {
    const text = String(value);
    if (/^[A-Za-z0-9_./:@,+=\-\[\]]*$/.test(text)) {
        return text;
    }
    return JSON.stringify(text);
}
