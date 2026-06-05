import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CONTENT_MODELS_DIR,
  FORBIDDEN_EXTENSIONS,
  IMAGE_EXTENSIONS,
  INBOX_DIR,
  PREVIEW_EXTENSIONS,
  SLUG_RE,
  SOURCE_EXTENSIONS
} from "./lib/constants.mjs";
import { parseFrontmatter, stringifyFrontmatter } from "./lib/frontmatter.mjs";
import { titleFromSlug } from "./lib/model-utils.mjs";

const slug = process.argv[2];
const apply = process.argv.includes("--apply");
const merge = process.argv.includes("--merge");

if (!slug || !SLUG_RE.test(slug)) {
  console.error("[ERROR] usage: npm run import:inbox {slug} -- --apply");
  process.exit(1);
}

const inboxDir = path.join(INBOX_DIR, slug);
const modelDir = path.join(CONTENT_MODELS_DIR, slug);
if (!existsSync(inboxDir)) {
  console.error(`[ERROR] ${slug}: _inbox folder does not exist.`);
  process.exit(1);
}
if (existsSync(modelDir) && !merge) {
  console.error(`[ERROR] ${slug}: model already exists.`);
  console.error(`To merge: npm run import:inbox ${slug} -- --merge --apply`);
  process.exit(1);
}

const entries = (await readdir(inboxDir, { withFileTypes: true })).filter((entry) => entry.isFile());
const forbidden = entries.filter((entry) => FORBIDDEN_EXTENSIONS.has(path.extname(entry.name).toLowerCase()));
if (forbidden.length > 0) {
  for (const entry of forbidden) console.error(`[ERROR] ${entry.name}: forbidden extension.`);
  process.exit(1);
}

const images = entries.filter((entry) => IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()));
const previews = entries.filter((entry) => PREVIEW_EXTENSIONS.has(path.extname(entry.name).toLowerCase()));
const sources = entries.filter((entry) => SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()));
const markdown = sources.find((entry) => path.extname(entry.name).toLowerCase() === ".md");
const sourceFiles = sources.filter((entry) => path.extname(entry.name).toLowerCase() !== ".md");
const firstPhotoIndex = await nextPhotoIndex(path.join(modelDir, "photos"));

const plans = [];
if (!existsSync(modelDir)) {
  plans.push({ type: "mkdir", target: modelDir });
  plans.push({ type: "mkdir", target: path.join(modelDir, "photos") });
  plans.push({ type: "mkdir", target: path.join(modelDir, "source") });
}

if (!existsSync(path.join(modelDir, `${slug}.md`))) {
  plans.push({ type: "write-md", target: path.join(modelDir, `${slug}.md`) });
}

images.forEach((entry, index) => {
  const ext = path.extname(entry.name).toLowerCase();
  if (index === 0 && !(existsSync(path.join(modelDir, "cover.jpg")) || existsSync(path.join(modelDir, "cover.png")))) {
    plans.push({
      type: "copy",
      from: path.join(inboxDir, entry.name),
      target: path.join(modelDir, `cover${ext}`)
    });
  }
  plans.push({
    type: "copy",
    from: path.join(inboxDir, entry.name),
    target: path.join(modelDir, "photos", `photo-${String(firstPhotoIndex + index).padStart(3, "0")}${ext}`)
  });
});

if (previews[0] && !existsSync(path.join(modelDir, "model.glb"))) {
  plans.push({ type: "copy", from: path.join(inboxDir, previews[0].name), target: path.join(modelDir, "model.glb") });
} else if (previews[0]) {
  console.warn(`[WARN] ${slug}: model.glb already exists; preview ${previews[0].name} was not imported.`);
}

for (const entry of sourceFiles) {
  plans.push({
    type: "copy",
    from: path.join(inboxDir, entry.name),
    target: uniqueTarget(path.join(modelDir, "source"), entry.name)
  });
}

console.log(`[INFO] ${apply ? "apply" : "dry-run"} import for ${slug}`);
for (const plan of plans) {
  console.log(`${apply ? "DO" : "PLAN"} ${plan.type} ${plan.from ? `${plan.from} -> ` : ""}${plan.target}`);
}

if (!apply) process.exit(0);

await mkdir(path.join(modelDir, "photos"), { recursive: true });
await mkdir(path.join(modelDir, "source"), { recursive: true });

for (const plan of plans) {
  if (plan.type === "mkdir") await mkdir(plan.target, { recursive: true });
  if (plan.type === "copy") {
    if (existsSync(plan.target)) {
      console.warn(`[WARN] skip existing file: ${plan.target}`);
    } else {
      await copyFile(plan.from, plan.target);
    }
  }
  if (plan.type === "write-md") {
    await writeFile(plan.target, await initialMarkdown(slug, markdown ? path.join(inboxDir, markdown.name) : null));
  }
}

async function initialMarkdown(slugValue, sourceMarkdown) {
  let body = "概要を書く。\n";
  let data = {};
  if (sourceMarkdown) {
    const parsed = parseFrontmatter(await readFile(sourceMarkdown, "utf8"));
    data = parsed.data;
    body = parsed.body;
  }
  return stringifyFrontmatter(
    {
      title: data.title || titleFromSlug(slugValue),
      summary: data.summary || "",
      category: data.category || "other",
      tags: Array.isArray(data.tags) ? data.tags : [],
      license: data.license || "Original",
      version: data.version || "0.1.0",
      status: "draft",
      unit: data.unit || "mm",
      commercial_use: data.commercial_use ?? false,
      redistribution: data.redistribution ?? false,
      modification: data.modification ?? true,
      credit_required: data.credit_required ?? true
    },
    body
  );
}

async function nextPhotoIndex(photosDir) {
  if (!existsSync(photosDir)) return 1;
  const entries = await readdir(photosDir, { withFileTypes: true });
  const indices = entries
    .filter((entry) => entry.isFile())
    .map((entry) => /^photo-(\d{3,})\.[a-z0-9]+$/i.exec(entry.name))
    .filter(Boolean)
    .map((match) => Number(match[1]));
  return indices.length === 0 ? 1 : Math.max(...indices) + 1;
}

function uniqueTarget(dir, fileName) {
  const parsed = path.parse(fileName);
  let candidate = path.join(dir, fileName);
  let index = 2;
  while (existsSync(candidate)) {
    candidate = path.join(dir, `${parsed.name}-${index}${parsed.ext}`);
    index += 1;
  }
  return candidate;
}
