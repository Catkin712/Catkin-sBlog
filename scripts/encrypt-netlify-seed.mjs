import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { encryptSeed } from "../functions/_shared/seed-crypto.mjs";

const [input, output] = process.argv.slice(2);
if (!input || !output) {
    console.error("Usage: node scripts/encrypt-netlify-seed.mjs <input.sqlite> <output.sqlite.enc>");
    process.exit(1);
}

const plaintext = readFileSync(input);
const encrypted = encryptSeed(plaintext, process.env);
const temporary = `${output}.${process.pid}.tmp`;
writeFileSync(temporary, encrypted);
rmSync(output, { force: true });
renameSync(temporary, output);
console.log(JSON.stringify({
    input,
    output: path.resolve(output),
    plaintextBytes: plaintext.length,
    encryptedBytes: encrypted.length,
}));
