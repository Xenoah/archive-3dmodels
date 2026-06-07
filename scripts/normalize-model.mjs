import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CONTENT_MODELS_DIR,
  FORBIDDEN_EXTENSIONS,
  FORBIDDEN_FILENAMES,
  IMAGE_EXTENSIONS,
  PREVIEW_EXTENSIONS,
  SLUG_RE
} from "./lib/constants.mjs";

const slug = process.argv[2];
const apply = process.argv.includes("--apply");

if (!slug || !SLUG_RE.test(slug)) {
  console.error("[ERROR] usage: npm run normalize:model {slug} -- --apply");
  process.exit(1);
}

const dir = path.join(CONTENT_MODELS_DIR, slug);
if (!existsSync(dir)) {
  console.error(`[ERROR] ${slug}: model does not exist.`);
  process.exit(1);
}

const plans = [];
const entries = await readdir(dir, { withFileTypes: true });
const hasCover = existsSync(path.join(dir, "cover.jpg")) || existsSync(path.join(dir, "cover.png"));
const topImages = entries.filter(
  (entry) =>
    entry.isFile() &&
    IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) &&
    !["cover.jpg", "cover.png", "thumbnail.jpg", "thumbnail.png"].includes(entry.name)
);
const topPreviews = entries.filter(
  (entry) =>
    entry.isFile() &&
    PREVIEW_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) &&
    entry.name !== "model.glb"
);
const topSources = entries.filter(
  (entry) => {
    if (!entry.isFile() || entry.name === `${slug}.md`) return false;
    const ext = path.extname(entry.name).toLowerCase();
    const basename = entry.name.toLowerCase();
    return (
      !IMAGE_EXTENSIONS.has(ext) &&
      !PREVIEW_EXTENSIONS.has(ext) &&
      !FORBIDDEN_FILENAMES.has(basename) &&
      !FORBIDDEN_EXTENSIONS.has(ext)
    );
  }
);

let photoIndex = await nextPhotoIndex(path.join(dir, "photos"));
topImages.forEach((entry, index) => {
  const ext = path.extname(entry.name).toLowerCase();
  if (!hasCover && index === 0) {
    plans.push({
      type: "copy",
      from: path.join(dir, entry.name),
      target: path.join(dir, `cover${ext}`)
    });
  }
  plans.push({
    type: "move",
    from: path.join(dir, entry.name),
    target: path.join(dir, "photos", `photo-${String(photoIndex).padStart(3, "0")}${ext}`)
  });
  photoIndex += 1;
});

if (!existsSync(path.join(dir, "model.glb")) && topPreviews[0]) {
  plans.push({
    type: "move",
    from: path.join(dir, topPreviews[0].name),
    target: path.join(dir, "model.glb")
  });
}

for (const entry of topSources) {
  plans.push({
    type: "move",
    from: path.join(dir, entry.name),
    target: uniqueTarget(path.join(dir, "source"), entry.name)
  });
}

console.log(`[INFO] ${apply ? "apply" : "dry-run"} normalize for ${slug}`);
if (plans.length === 0) console.log("[INFO] nothing to normalize.");
for (const plan of plans) console.log(`${apply ? plan.type.toUpperCase() : "PLAN"} ${plan.from} -> ${plan.target}`);

if (apply) {
  await mkdir(path.join(dir, "photos"), { recursive: true });
  await mkdir(path.join(dir, "source"), { recursive: true });
  for (const plan of plans) {
    if (existsSync(plan.target)) {
      console.warn(`[WARN] skip existing file: ${plan.target}`);
    } else if (plan.type === "move") {
      await rename(plan.from, plan.target);
    } else if (plan.type === "copy") {
      await writeFile(plan.target, await readFile(plan.from));
    }
  }
  await updateMarkdownRefs(dir, slug, plans);
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

function uniqueTarget(targetDir, fileName) {
  const parsed = path.parse(fileName);
  let target = path.join(targetDir, fileName);
  let index = 2;
  while (existsSync(target)) {
    target = path.join(targetDir, `${parsed.name}-${index}${parsed.ext}`);
    index += 1;
  }
  return target;
}

async function updateMarkdownRefs(modelDir, modelSlug, executedPlans) {
  const mdPath = path.join(modelDir, `${modelSlug}.md`);
  if (!existsSync(mdPath)) return;
  let markdown = await readFile(mdPath, "utf8");
  for (const plan of executedPlans) {
    const fromName = path.basename(plan.from);
    const relativeTarget = path.relative(modelDir, plan.target).replace(/\\/g, "/");
    markdown = markdown.replaceAll(`(${fromName})`, `(./${relativeTarget})`);
    markdown = markdown.replaceAll(`(./${fromName})`, `(./${relativeTarget})`);
  }
  await writeFile(mdPath, markdown);
}
