import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  CONTENT_MODELS_DIR,
  INBOX_DIR,
  SLUG_RE,
  STANDALONE_MODEL_EXTENSIONS,
  UPLOAD_METADATA_FILENAME
} from "./lib/constants.mjs";

const apply = process.argv.includes("--apply");
const merge = process.argv.includes("--merge");

if (!existsSync(INBOX_DIR)) {
  console.log("[INFO] _inbox does not exist.");
  process.exit(0);
}

const looseResult = await prepareLooseModelFiles();
if (looseResult.failed) process.exit(1);

const entries = await readdir(INBOX_DIR, { withFileTypes: true });
const slugs = entries
  .filter((entry) => entry.isDirectory() && SLUG_RE.test(entry.name))
  .map((entry) => entry.name)
  .sort();

if (slugs.length === 0) {
  if (looseResult.prepared.length > 0) {
    console.log("[INFO] loose model files will be imported after auto-foldering during apply.");
    await writeSummary([], looseResult, []);
    process.exit(0);
  }
  console.log("[INFO] no _inbox/{slug} folders found.");
  process.exit(0);
}

let failed = false;
for (const slug of slugs) {
  console.log(`\n[INFO] ${apply ? "apply" : "dry-run"} import for _inbox/${slug}`);
  const args = ["scripts/import-inbox.mjs", slug];
  if (merge) args.push("--merge");
  if (apply) args.push("--apply");
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: false
  });
  if (result.status !== 0) {
    failed = true;
    continue;
  }
  if (apply) {
    console.log(`[INFO] kept _inbox/${slug}. Run npm run sync:uploaded -- --apply after pull/sync to archive locally.`);
  } else {
    console.log(`PLAN keep _inbox/${slug}`);
  }
}

await writeSummary(slugs, looseResult);

if (failed) process.exit(1);

async function writeSummary(slugs, looseResult) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  const mode = apply ? "apply" : "dry-run";
  const lines = [
    `## Inbox import ${mode}`,
    "",
    `Detected ${slugs.length} inbox folder(s).`,
    "",
    ...slugs.map((slug) => `- \`${path.join(INBOX_DIR, slug).replace(/\\/g, "/")}\``),
    ...(looseResult.prepared.length
      ? ["", "Auto-foldered loose model file(s):", "", ...looseResult.prepared.map((item) => `- \`${item.from.replace(/\\/g, "/")}\` -> \`${item.to.replace(/\\/g, "/")}\``)]
      : []),
    "",
    "Inbox folders are kept. Archive locally with `npm run sync:uploaded -- --apply` after pull/sync."
  ];
  await import("node:fs/promises").then(({ writeFile }) =>
    writeFile(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`, { flag: "a" })
  );
}

async function prepareLooseModelFiles() {
  const inboxEntries = await readdir(INBOX_DIR, { withFileTypes: true });
  const looseFiles = inboxEntries.filter(
    (entry) => entry.isFile() && entry.name !== ".gitkeep" && entry.name !== UPLOAD_METADATA_FILENAME
  );
  if (looseFiles.length === 0) return { failed: false, prepared: [] };

  const invalid = looseFiles.filter((entry) => !STANDALONE_MODEL_EXTENSIONS.has(path.extname(entry.name).toLowerCase()));
  if (invalid.length > 0) {
    for (const entry of invalid) {
      console.error(`[ERROR] ${path.join(INBOX_DIR, entry.name)}: loose file is not a standalone 3D model.`);
    }
    console.error("[ERROR] Put non-model loose files into _inbox/{slug}/ with their model.");
    return { failed: true, prepared: [] };
  }

  const prepared = [];
  const rootMetadata = await readUploadMetadata(INBOX_DIR);
  const reserved = new Set(
    inboxEntries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  );

  for (const entry of looseFiles.sort((a, b) => a.name.localeCompare(b.name))) {
    const slug = uniqueInboxSlug(slugFromFileName(entry.name), reserved);
    reserved.add(slug);
    const source = path.join(INBOX_DIR, entry.name);
    const targetDir = path.join(INBOX_DIR, slug);
    const target = path.join(targetDir, entry.name);
    prepared.push({ from: source, to: target, slug });

    if (apply) {
      await mkdir(targetDir, { recursive: true });
      await rename(source, target);
      await writeUploadMetadata(targetDir, entry.name, rootMetadata.files?.[entry.name]);
      console.log(`DO auto-folder ${source} -> ${target}`);
    } else {
      console.log(`PLAN auto-folder ${source} -> ${target}`);
    }
  }

  return { failed: false, prepared };
}

async function readUploadMetadata(dir) {
  const metadataPath = path.join(dir, UPLOAD_METADATA_FILENAME);
  if (!existsSync(metadataPath)) return { version: 1, files: {} };
  try {
    return JSON.parse(await readFile(metadataPath, "utf8"));
  } catch {
    return { version: 1, files: {} };
  }
}

async function writeUploadMetadata(dir, fileName, entry) {
  if (!entry) return;
  const metadata = {
    version: 1,
    generatedAt: new Date().toISOString(),
    files: {
      [fileName]: entry
    }
  };
  await writeFile(path.join(dir, UPLOAD_METADATA_FILENAME), `${JSON.stringify(metadata, null, 2)}\n`);
}

function slugFromFileName(fileName) {
  const base = path.parse(fileName).name;
  const slug = base
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]+/gu, "-")
    .replace(/\s+/g, "-")
    .replace(/[-_]{2,}/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
  return SLUG_RE.test(slug) ? slug : "model";
}

function uniqueInboxSlug(baseSlug, reserved) {
  let candidate = baseSlug;
  let index = 2;
  while (
    reserved.has(candidate) ||
    existsSync(path.join(INBOX_DIR, candidate)) ||
    existsSync(path.join(CONTENT_MODELS_DIR, candidate))
  ) {
    candidate = `${baseSlug}-${index}`;
    index += 1;
  }
  return candidate;
}
