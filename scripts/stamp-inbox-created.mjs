import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { INBOX_DIR, UPLOAD_METADATA_FILENAME } from "./lib/constants.mjs";
import { formatDateTimeSecond } from "./lib/date-utils.mjs";

const stage = process.argv.includes("--stage");
const force = process.argv.includes("--force");

if (!existsSync(INBOX_DIR)) {
  console.log("[INFO] _inbox does not exist.");
  process.exit(0);
}

const metadataFiles = [];
const inboxEntries = await readdir(INBOX_DIR, { withFileTypes: true });
const rootFiles = inboxEntries.filter((entry) => isStampableFile(entry.name, entry.isFile()));
if (rootFiles.length > 0) {
  metadataFiles.push(await writeMetadata(INBOX_DIR, rootFiles.map((entry) => entry.name)));
}

for (const entry of inboxEntries.filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
  const dir = path.join(INBOX_DIR, entry.name);
  const files = (await readdir(dir, { withFileTypes: true }))
    .filter((item) => isStampableFile(item.name, item.isFile()))
    .map((item) => item.name)
    .sort((a, b) => a.localeCompare(b));
  if (files.length === 0) continue;
  metadataFiles.push(await writeMetadata(dir, files));
}

const written = metadataFiles.filter(Boolean);
if (stage && written.length > 0) {
  const result = spawnSync("git", ["add", ...written], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`[INFO] stamped upload metadata: ${written.length}`);

function isStampableFile(name, isFile) {
  return isFile && name !== ".gitkeep" && name !== UPLOAD_METADATA_FILENAME;
}

async function writeMetadata(dir, fileNames) {
  const metadataPath = path.join(dir, UPLOAD_METADATA_FILENAME);
  const existing = await readExistingMetadata(metadataPath);
  const files = {};

  for (const fileName of fileNames) {
    const fullPath = path.join(dir, fileName);
    const fileStat = await stat(fullPath);
    const previous = existing.files?.[fileName] ?? {};
    const createdAt = force || !previous.createdAt ? fileCreatedAt(fileStat) : previous.createdAt;
    files[fileName] = {
      createdAt,
      modifiedAt: formatDateTimeSecond(fileStat.mtime),
      size: fileStat.size
    };
  }

  const filesChanged = JSON.stringify(existing.files ?? {}) !== JSON.stringify(files);
  if (!force && !filesChanged) return null;

  const metadata = {
    version: 1,
    generatedAt: new Date().toISOString(),
    files
  };
  const next = `${JSON.stringify(metadata, null, 2)}\n`;
  await writeFile(metadataPath, next);
  console.log(`[INFO] wrote ${metadataPath}`);
  return metadataPath;
}

async function readExistingMetadata(metadataPath) {
  if (!existsSync(metadataPath)) return { files: {}, raw: "" };
  try {
    const raw = await readFile(metadataPath, "utf8");
    const parsed = JSON.parse(raw);
    return { ...parsed, raw };
  } catch {
    return { files: {}, raw: "" };
  }
}

function fileCreatedAt(fileStat) {
  const candidates = [
    Number.isNaN(fileStat.birthtimeMs) || fileStat.birthtimeMs <= 0 ? null : fileStat.birthtime,
    Number.isNaN(fileStat.mtimeMs) || fileStat.mtimeMs <= 0 ? null : fileStat.mtime
  ].filter(Boolean);
  const date = candidates.sort((left, right) => left.getTime() - right.getTime())[0] ?? new Date();
  return formatDateTimeSecond(date);
}
