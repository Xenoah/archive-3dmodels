import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { CONTENT_MODELS_DIR, IMAGE_EXTENSIONS } from "./lib/constants.mjs";

const apply = process.argv.includes("--apply");
const targetSlug = process.argv.find((arg) => !arg.startsWith("--") && arg !== process.argv[1]);

if (!existsSync(CONTENT_MODELS_DIR)) {
  console.log("[INFO] no content/models directory.");
  process.exit(0);
}

const files = [];
for (const file of await listFiles(CONTENT_MODELS_DIR)) {
  const ext = path.extname(file).toLowerCase();
  if (IMAGE_EXTENSIONS.has(ext) && (!targetSlug || file.includes(`${path.sep}${targetSlug}${path.sep}`))) {
    files.push(file);
  }
}

let changed = 0;
for (const file of files) {
  const ext = path.extname(file).toLowerCase();
  if (ext !== ".jpg" && ext !== ".jpeg") continue;
  const input = await readFile(file);
  const output = stripJpegApp1(input);
  if (output.length !== input.length) {
    changed += 1;
    console.log(`${apply ? "STRIP" : "PLAN"} ${file} (${input.length - output.length} bytes metadata removed)`);
    if (apply) await writeFile(file, output);
  }
}

if (changed === 0) console.log("[INFO] no JPEG metadata changes detected.");
if (!apply) console.log("[INFO] dry-run only. Re-run with --apply to modify files.");

async function listFiles(dir) {
  const output = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) output.push(...(await listFiles(fullPath)));
    if (entry.isFile()) output.push(fullPath);
  }
  return output;
}

function stripJpegApp1(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return buffer;
  const parts = [buffer.subarray(0, 2)];
  let offset = 2;

  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) {
      parts.push(buffer.subarray(offset));
      break;
    }
    const marker = buffer[offset + 1];
    if (marker === 0xda) {
      parts.push(buffer.subarray(offset));
      break;
    }
    const length = buffer.readUInt16BE(offset + 2);
    const end = offset + 2 + length;
    if (end > buffer.length) {
      parts.push(buffer.subarray(offset));
      break;
    }
    if (marker !== 0xe1) {
      parts.push(buffer.subarray(offset, end));
    }
    offset = end;
  }

  return Buffer.concat(parts);
}
