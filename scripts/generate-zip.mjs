import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { CONTENT_MODELS_DIR, PUBLIC_DIR } from "./lib/constants.mjs";
import { parseFrontmatter } from "./lib/frontmatter.mjs";
import {
  downloadFolderForExtension,
  ensureDir,
  findSources,
  formatBool,
  validateRepository
} from "./lib/model-utils.mjs";
import { contentHash, writeStoreZip } from "./lib/zip-store.mjs";

const { report, models } = await validateRepository();
if (report.errors.length > 0) {
  for (const error of report.errors) console.error(`[ERROR] ${error.message}`);
  process.exit(1);
}

let generated = 0;
for (const model of models.filter((item) => item.status === "public" || item.status === "hidden")) {
  const dir = path.join(CONTENT_MODELS_DIR, model.slug);
  const sources = await findSources(dir);
  if (sources.length === 0) continue;

  const entries = [];
  const markdownPath = path.join(dir, `${model.slug}.md`);
  const raw = await readFile(markdownPath, "utf8");
  const { data } = parseFrontmatter(raw);
  const zipRoot = model.slug;

  entries.push({
    name: `${zipRoot}/README.md`,
    data: Buffer.from(renderZipReadme(model, data), "utf8")
  });
  entries.push({
    name: `${zipRoot}/LICENSE.txt`,
    data: Buffer.from(await licenseText(model.license), "utf8")
  });

  for (const source of sources) {
    const ext = path.extname(source).toLowerCase();
    const folder = downloadFolderForExtension(ext);
    entries.push({
      name: `${zipRoot}/${folder}/${path.basename(source)}`,
      data: await readFile(source)
    });
  }

  for (const image of await zipImages(dir)) {
    entries.push({
      name: `${zipRoot}/images/${path.basename(image)}`,
      data: await readFile(image)
    });
  }

  const hash = contentHash(entries);
  const versionPart = model.version ? `-v${model.version}` : "";
  const fileName = `${model.slug}${versionPart}-${hash}.zip`;
  const downloadsDir = path.join(PUBLIC_DIR, model.slug, "downloads");
  await ensureDir(downloadsDir);
  await clearOldZips(downloadsDir);
  await writeStoreZip(path.join(downloadsDir, fileName), entries);
  generated += 1;
  console.log(`[INFO] generated zip: ${model.slug}/${fileName}`);
}

console.log(`[INFO] generated zips: ${generated}`);

function renderZipReadme(model, data) {
  return [
    `# ${model.title}`,
    "",
    model.summary || "配布モデルです。",
    "",
    "## Metadata",
    "",
    `- Slug: ${model.slug}`,
    `- Version: ${model.version || "unspecified"}`,
    `- License: ${model.license}`,
    `- Unit: ${model.unit}`,
    model.scale ? `- Scale: ${model.scale}` : null,
    "",
    "## License Conditions",
    "",
    `- 商用利用: ${formatBool(data.commercial_use)}`,
    `- 改変: ${formatBool(data.modification)}`,
    `- 再配布: ${formatBool(data.redistribution)}`,
    `- クレジット: ${data.credit_required === true ? "必要" : data.credit_required === false ? "不要" : "要確認"}`,
    "",
    "詳細な注意事項は配布ページの本文を確認してください。"
  ]
    .filter((line) => line !== null)
    .join("\n");
}

async function licenseText(license) {
  const normalized = license.replace(/\s+/g, "-");
  const candidates = [
    path.join("templates", "license", `${normalized}.txt`),
    path.join("templates", "license", "Original.txt")
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return readFile(candidate, "utf8");
  }
  return `${license}\n`;
}

async function zipImages(dir) {
  const output = [];
  for (const name of ["cover.jpg", "cover.png", "thumbnail.jpg", "thumbnail.png"]) {
    const file = path.join(dir, name);
    if (existsSync(file)) output.push(file);
  }
  const photosDir = path.join(dir, "photos");
  if (existsSync(photosDir)) {
    const entries = await readdir(photosDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) output.push(path.join(photosDir, entry.name));
    }
  }
  return output;
}

async function clearOldZips(dir) {
  if (!existsSync(dir)) return;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".zip")) {
      await rm(path.join(dir, entry.name), { force: true });
    }
  }
}
