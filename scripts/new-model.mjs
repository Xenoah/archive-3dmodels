import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { CONTENT_MODELS_DIR, SLUG_RE } from "./lib/constants.mjs";
import { titleFromSlug } from "./lib/model-utils.mjs";

const slug = process.argv[2];
if (!slug || !SLUG_RE.test(slug)) {
  console.error("[ERROR] usage: npm run new:model {slug}");
  console.error("[ERROR] slug may contain A-Z, a-z, 0-9, - and _ only.");
  process.exit(1);
}

const dir = path.join(CONTENT_MODELS_DIR, slug);
if (existsSync(dir)) {
  console.error(`[ERROR] ${slug}: model already exists.`);
  process.exit(1);
}

const template = await readFile(path.join("templates", "model.md"), "utf8");
const markdown = template
  .replaceAll("{{title}}", titleFromSlug(slug))
  .replaceAll("{{slug}}", slug);

await mkdir(path.join(dir, "photos"), { recursive: true });
await mkdir(path.join(dir, "source"), { recursive: true });
await writeFile(path.join(dir, `${slug}.md`), markdown);
console.log(`[INFO] created ${dir}`);
