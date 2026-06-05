import { existsSync } from "node:fs";
import { mkdir, readdir, rename } from "node:fs/promises";
import path from "node:path";
import { CONTENT_MODELS_DIR, IMAGE_EXTENSIONS, SLUG_RE } from "./lib/constants.mjs";

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
const topImages = entries.filter(
  (entry) =>
    entry.isFile() &&
    IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) &&
    !["cover.jpg", "cover.png", "thumbnail.jpg", "thumbnail.png"].includes(entry.name)
);

topImages.forEach((entry, index) => {
  const ext = path.extname(entry.name).toLowerCase();
  plans.push({
    from: path.join(dir, entry.name),
    target: path.join(dir, "photos", `photo-${String(index + 1).padStart(3, "0")}${ext}`)
  });
});

console.log(`[INFO] ${apply ? "apply" : "dry-run"} normalize for ${slug}`);
if (plans.length === 0) console.log("[INFO] nothing to normalize.");
for (const plan of plans) console.log(`${apply ? "MOVE" : "PLAN"} ${plan.from} -> ${plan.target}`);

if (apply) {
  await mkdir(path.join(dir, "photos"), { recursive: true });
  for (const plan of plans) {
    if (existsSync(plan.target)) {
      console.warn(`[WARN] skip existing file: ${plan.target}`);
    } else {
      await rename(plan.from, plan.target);
    }
  }
}
