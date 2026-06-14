import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, rename } from "node:fs/promises";
import path from "node:path";
import { INBOX_DIR, SLUG_RE, UPLOAD_METADATA_FILENAME } from "./lib/constants.mjs";

const slug = process.argv[2];
const apply = process.argv.includes("--apply");

if (!slug || !SLUG_RE.test(slug)) {
  console.error("[ERROR] usage: npm run import:loose {slug} -- --apply");
  process.exit(1);
}

if (!existsSync(INBOX_DIR)) {
  console.log("[INFO] _inbox does not exist.");
  process.exit(0);
}

const entries = await readdir(INBOX_DIR, { withFileTypes: true });
const files = entries.filter((entry) => entry.isFile() && entry.name !== ".gitkeep" && entry.name !== UPLOAD_METADATA_FILENAME);
if (files.length === 0) {
  console.log("[INFO] no loose files found.");
  process.exit(0);
}

const target = path.join(INBOX_DIR, slug);
console.log(`[INFO] ${apply ? "moving" : "dry-run"} ${files.length} files to ${target}`);
for (const file of files) {
  console.log(`${apply ? "MOVE" : "PLAN"} ${path.join(INBOX_DIR, file.name)} -> ${path.join(target, file.name)}`);
}

if (apply) {
  await mkdir(target, { recursive: true });
  for (const file of files) {
    await rename(path.join(INBOX_DIR, file.name), path.join(target, file.name));
  }
  const metadata = path.join(INBOX_DIR, UPLOAD_METADATA_FILENAME);
  if (existsSync(metadata)) await copyFile(metadata, path.join(target, UPLOAD_METADATA_FILENAME));
}
