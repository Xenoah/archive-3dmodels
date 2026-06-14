import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { CONTENT_MODELS_DIR, INBOX_DIR, SLUG_RE, UPLOADED_DIR, UPLOAD_METADATA_FILENAME } from "./lib/constants.mjs";
import { dateTimeValue, fileCreatedDate, formatYearMonth } from "./lib/date-utils.mjs";
import { parseFrontmatter, stringifyFrontmatter } from "./lib/frontmatter.mjs";

const apply = process.argv.includes("--apply");
const MODEL_EXTENSIONS = new Set([".fbx", ".step", ".stp", ".stl", ".3mf", ".obj", ".glb"]);

if (!existsSync(INBOX_DIR)) {
  console.log("[INFO] _inbox does not exist.");
  process.exit(0);
}

const entries = await readdir(INBOX_DIR, { withFileTypes: true });
const slugs = entries
  .filter((entry) => entry.isDirectory() && SLUG_RE.test(entry.name))
  .map((entry) => entry.name)
  .sort((left, right) => left.localeCompare(right));

if (slugs.length === 0) {
  console.log("[INFO] no _inbox folders to sync.");
  process.exit(0);
}

let failed = false;
for (const slug of slugs) {
  const inboxDir = path.join(INBOX_DIR, slug);
  const modelDir = path.join(CONTENT_MODELS_DIR, slug);
  const markdownPath = path.join(modelDir, `${slug}.md`);
  if (!existsSync(markdownPath)) {
    console.error(`[ERROR] ${slug}: ${markdownPath} does not exist. Import the model before sync.`);
    failed = true;
    continue;
  }

  const source = await primaryModelFile(inboxDir);
  if (!source) {
    console.warn(`[WARN] ${slug}: no model source found in _inbox; keeping existing created date.`);
  }

  const detectedDate = source ? await fileCreatedDate(source) : null;
  const uploadedPath = uniqueUploadedPath(slug);
  console.log(`[INFO] ${apply ? "apply" : "dry-run"} sync ${slug}`);
  if (detectedDate) {
    console.log(`${apply ? "DO" : "PLAN"} update created=${formatYearMonth(detectedDate)} createdAt=${dateTimeValue(detectedDate)}`);
  }
  console.log(`${apply ? "DO" : "PLAN"} archive ${inboxDir} -> ${uploadedPath}`);

  if (!apply) continue;

  if (detectedDate) await updateCreatedDate(markdownPath, detectedDate);
  await mkdir(UPLOADED_DIR, { recursive: true });
  await rename(inboxDir, uploadedPath);
}

if (apply) await cleanupRootUploadMetadata();
if (failed) process.exit(1);

async function cleanupRootUploadMetadata() {
  const metadataPath = path.join(INBOX_DIR, UPLOAD_METADATA_FILENAME);
  if (existsSync(metadataPath)) await rm(metadataPath);
}

async function primaryModelFile(dir) {
  const files = await listFilesRecursive(dir);
  return files
    .filter((file) => MODEL_EXTENSIONS.has(path.extname(file).toLowerCase()))
    .sort((left, right) => modelPriority(left) - modelPriority(right) || left.localeCompare(right))[0] ?? null;
}

async function listFilesRecursive(dir) {
  const output = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      output.push(...(await listFilesRecursive(fullPath)));
    } else {
      output.push(fullPath);
    }
  }
  return output;
}

function modelPriority(file) {
  const priorities = [".fbx", ".step", ".stp", ".stl", ".3mf", ".obj", ".glb"];
  const index = priorities.indexOf(path.extname(file).toLowerCase());
  return index === -1 ? 999 : index;
}

async function updateCreatedDate(markdownPath, date) {
  const parsed = parseFrontmatter(await readFile(markdownPath, "utf8"));
  await writeFile(
    markdownPath,
    stringifyFrontmatter(
      {
        ...parsed.data,
        created: formatYearMonth(date),
        createdAt: dateTimeValue(date)
      },
      parsed.body
    )
  );
}

function uniqueUploadedPath(slug) {
  let candidate = path.join(UPLOADED_DIR, slug);
  let index = 2;
  while (existsSync(candidate)) {
    candidate = path.join(UPLOADED_DIR, `${slug}-${index}`);
    index += 1;
  }
  return candidate;
}
