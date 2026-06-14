import { existsSync } from "node:fs";
import { readFile, readdir, rm } from "node:fs/promises";
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

const ZIP_MODEL_EXTENSIONS = new Set([".fbx", ".stl", ".step", ".stp", ".3mf", ".obj", ".glb"]);

const { report, models } = await validateRepository();
if (report.errors.length > 0) {
  for (const error of report.errors) console.error(`[ERROR] ${error.message}`);
  process.exit(1);
}

await cleanStalePublicModelDirs(new Set(models.map((model) => model.slug)));

let generated = 0;
for (const model of models.filter((item) => item.status === "public" || item.status === "hidden")) {
  const dir = path.join(CONTENT_MODELS_DIR, model.slug);
  const sources = await findSources(dir);
  const zipSources = sources.filter((source) => ZIP_MODEL_EXTENSIONS.has(path.extname(source).toLowerCase()));
  if (zipSources.length === 0) continue;

  const entries = [];
  const markdownPath = path.join(dir, `${model.slug}.md`);
  const raw = await readFile(markdownPath, "utf8");
  const { data } = parseFrontmatter(raw);
  const zipRoot = model.slug;

  entries.push({
    name: `${zipRoot}/readme.txt`,
    data: Buffer.from(renderZipReadme(model, data), "utf8")
  });

  for (const source of zipSources) {
    const ext = path.extname(source).toLowerCase();
    const folder = downloadFolderForExtension(ext);
    entries.push({
      name: `${zipRoot}/${folder}/${path.basename(source)}`,
      data: await readFile(source)
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
    model.title,
    "=".repeat(model.title.length),
    "",
    model.summary || "配布モデルです。",
    "",
    "Metadata",
    "--------",
    "",
    `- Slug: ${model.slug}`,
    `- Version: ${model.version || "unspecified"}`,
    `- License: ${model.license}`,
    licenseUrl(model.license) ? `- License URL: ${licenseUrl(model.license)}` : null,
    `- Unit: ${model.unit}`,
    model.scale ? `- Scale: ${model.scale}` : null,
    "",
    "Attribution / Credit",
    "--------------------",
    "",
    `- Creator: ${data.author || "Xenoah"}`,
    `- Work title: ${model.title}`,
    `- License: ${model.license}`,
    licenseUrl(model.license) ? `- License URL: ${licenseUrl(model.license)}` : null,
    "",
    "License Conditions",
    "------------------",
    "",
    `- 商用利用: ${formatBool(data.commercial_use)}`,
    `- 改変: ${formatBool(data.modification)}`,
    `- 再配布: ${formatBool(data.redistribution)}`,
    `- クレジット: ${data.credit_required === true ? "必要" : data.credit_required === false ? "不要" : "要確認"}`,
    "",
    ...licenseDefinitionLines(model.license),
    "",
    "Notice",
    "------",
    "",
    "この3Dモデルおよび同梱ファイルは現状有姿で提供されます。",
    "ダウンロード、加工、印刷、組み立て、使用、再配布、商用利用などは、各モデルページのライセンス条件と注意事項を確認したうえで、利用者自身の判断と責任で行ってください。",
    "作者 Xenoah は、このファイルの利用によって生じたいかなる損害、事故、不具合、トラブルについても責任を負いません。",
    "",
    "These 3D model files are provided as-is.",
    "Download, modification, printing, assembly, use, redistribution, or commercial use is done at your own discretion and responsibility after reviewing the license terms and notices on the model page.",
    "Xenoah is not responsible for any damage, accident, defect, failure, or trouble caused by use of these files."
  ]
    .filter((line) => line !== null)
    .join("\n");
}

function licenseUrl(license) {
  const normalized = normalizeLicense(license);
  if (normalized === "CC BY-NC 4.0") return "https://creativecommons.org/licenses/by-nc/4.0/";
  if (normalized === "CC BY 4.0") return "https://creativecommons.org/licenses/by/4.0/";
  if (normalized === "CC BY-SA 4.0") return "https://creativecommons.org/licenses/by-sa/4.0/";
  if (normalized === "CC BY-NC-SA 4.0") return "https://creativecommons.org/licenses/by-nc-sa/4.0/";
  if (normalized === "CC0") return "https://creativecommons.org/publicdomain/zero/1.0/";
  return "";
}

function licenseDefinitionLines(license) {
  const normalized = normalizeLicense(license);
  if (normalized !== "CC BY-NC 4.0") return [];
  return [
    "CC BY-NC 4.0 Definition",
    "-----------------------",
    "",
    "JA: CC BY-NC 4.0 は、原作者のクレジット（氏名、作品タイトル、ライセンス等）を表示し、非営利目的で利用することを主な条件として、作品を共有、改変、再配布できるCreative Commonsライセンスです。",
    "JA: 利用者は、改変の有無を示し、法的または技術的な追加制限をかけないでください。",
    "EN: CC BY-NC 4.0 lets you share and adapt the work for noncommercial purposes, as long as you give appropriate credit, indicate changes, and do not apply additional legal or technical restrictions."
  ];
}

function normalizeLicense(license) {
  const value = String(license || "")
    .toUpperCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  if (/^CC[- ]BY[- ](?:NC|NS)(?: 4\.0)?$/.test(value)) return "CC BY-NC 4.0";
  if (/^CC[- ]BY(?: 4\.0)?$/.test(value)) return "CC BY 4.0";
  if (/^CC[- ]BY[- ]SA(?: 4\.0)?$/.test(value)) return "CC BY-SA 4.0";
  if (/^CC[- ]BY[- ](?:NC|NS)[- ]SA(?: 4\.0)?$/.test(value)) return "CC BY-NC-SA 4.0";
  return value;
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

async function cleanStalePublicModelDirs(activeSlugs) {
  if (!existsSync(PUBLIC_DIR)) return;
  const keep = new Set(["vendor"]);
  const entries = await readdir(PUBLIC_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (keep.has(entry.name) || activeSlugs.has(entry.name)) continue;
    await rm(path.join(PUBLIC_DIR, entry.name), { recursive: true, force: true });
    console.log(`[INFO] removed stale public model folder: ${entry.name}`);
  }
}
