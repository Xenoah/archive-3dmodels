import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  copyFile,
  lstat,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import {
  CATEGORIES,
  CONTENT_MODELS_DIR,
  FORBIDDEN_FILENAMES,
  FORBIDDEN_EXTENSIONS,
  GENERATED_DATA_FILE,
  IMAGE_EXTENSIONS,
  INBOX_DIR,
  KNOWN_FRONTMATTER_KEYS,
  MAX_FILE_BYTES,
  PERSONAL_INFO_PATTERNS,
  PUBLIC_DIR,
  REPORTS_DIR,
  SECRET_PATTERNS,
  SLUG_RE,
  STANDALONE_MODEL_EXTENSIONS,
  STATUSES,
  WARN_FILE_BYTES
} from "./constants.mjs";
import { dateTimeValue, fileCreatedDate, formatYearMonth } from "./date-utils.mjs";
import { parseFrontmatter } from "./frontmatter.mjs";
import { containsRawHtml, renderMarkdown } from "./markdown.mjs";

export function siteBase() {
  const raw = process.env.PUBLIC_BASE_PATH ?? "/archive-3dmodels";
  return `/${raw.replace(/^\/+|\/+$/g, "")}`;
}

export function titleFromSlug(slug) {
  return slug
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatBool(value) {
  if (value === true) return "可";
  if (value === false) return "不可";
  return "要確認";
}

export function downloadFolderForExtension(ext) {
  if (ext === ".fbx") return "FBX";
  if (ext === ".stl") return "STL";
  if (ext === ".step" || ext === ".stp") return "STEP";
  if (ext === ".3mf") return "3MF";
  if (ext === ".obj") return "OBJ";
  if (ext === ".txt" || ext === ".md" || ext === ".pdf") return "docs";
  return "docs";
}

export async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

async function listFilesRecursive(dir) {
  if (!existsSync(dir)) return [];
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

export async function scanRepositoryFiles() {
  const roots = [CONTENT_MODELS_DIR, INBOX_DIR, "templates"];
  const files = [];
  for (const root of roots) files.push(...(await listFilesRecursive(root)));
  return files;
}

export async function validateRepository() {
  const report = {
    generatedAt: new Date().toISOString(),
    info: [],
    warnings: [],
    errors: [],
    models: []
  };

  await validateInbox(report);
  const models = await collectModels(report, { copyAssets: false, includeDrafts: true });

  report.info.push(`detected models: ${models.length}`);
  report.info.push(`public: ${models.filter((model) => model.status === "public").length}`);
  report.info.push(`draft: ${models.filter((model) => model.status === "draft").length}`);
  report.info.push(`hidden: ${models.filter((model) => model.status === "hidden").length}`);

  await writeReports(report);
  return { report, models };
}

async function validateInbox(report) {
  if (!existsSync(INBOX_DIR)) return;
  const entries = await readdir(INBOX_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".gitkeep") continue;
    const fullPath = path.join(INBOX_DIR, entry.name);
    if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (STANDALONE_MODEL_EXTENSIONS.has(ext)) {
        report.warnings.push({
          code: "inbox-loose-model-file",
          message: `${path.join(INBOX_DIR, entry.name).replace(/\\/g, "/")}: standalone model file will be auto-foldered by import.`
        });
        continue;
      }
      report.errors.push({
        code: "inbox-loose-file",
        message: `_inbox: loose files detected. Put files into _inbox/{slug}/.`
      });
      continue;
    }
    if (!SLUG_RE.test(entry.name)) {
      report.errors.push({
        code: "invalid-inbox-slug",
        slug: entry.name,
        message: `${entry.name}: slug contains unsupported characters.`
      });
    }
    await validateFileTree(fullPath, report, entry.name);
  }
}

async function validateFileTree(dir, report, slug) {
  const files = await listFilesRecursive(dir);
  for (const file of files) {
    const relative = path.relative(".", file).replace(/\\/g, "/");
    const ext = path.extname(file).toLowerCase();
    const basename = path.basename(file).toLowerCase();
    const fileStat = await lstat(file);
    if (fileStat.isSymbolicLink()) {
      report.errors.push({ code: "symlink", slug, message: `${relative}: symlink is not allowed.` });
    }
    if (fileStat.nlink > 1) {
      report.errors.push({ code: "hardlink", slug, message: `${relative}: hardlink is not allowed.` });
    }
    if (fileStat.size >= MAX_FILE_BYTES) {
      report.errors.push({ code: "large-file", slug, message: `${relative}: file is 100MiB or larger.` });
    } else if (fileStat.size >= WARN_FILE_BYTES) {
      report.warnings.push({ code: "large-file-warn", slug, message: `${relative}: file is larger than 50MiB.` });
    }
    if (FORBIDDEN_FILENAMES.has(basename)) {
      report.errors.push({ code: "forbidden-filename", slug, message: `${relative}: filename is forbidden.` });
    } else if (FORBIDDEN_EXTENSIONS.has(ext)) {
      report.errors.push({ code: "forbidden-extension", slug, message: `${relative}: ${ext} is forbidden.` });
    }
    if (ext === ".pdf") {
      report.warnings.push({ code: "pdf-metadata", slug, message: `${relative}: PDF may contain metadata; review before publishing.` });
    }
    await scanSensitiveText(file, relative, report, slug, fileStat.size);
  }
}

async function scanSensitiveText(file, relative, report, slug, size) {
  const ext = path.extname(file).toLowerCase();
  const textExtensions = new Set([".md", ".txt", ".json", ".yaml", ".yml", ".csv", ".tsv"]);
  if (!textExtensions.has(ext) || size > 1024 * 1024) return;
  const text = await readFile(file, "utf8");
  for (const item of SECRET_PATTERNS) {
    if (item.pattern.test(text)) {
      report.errors.push({ code: "secret-detected", slug, message: `${relative}: possible ${item.name} detected.` });
    }
  }
  for (const item of PERSONAL_INFO_PATTERNS) {
    if (item.pattern.test(text)) {
      report.warnings.push({ code: "personal-info", slug, message: `${relative}: possible ${item.name} detected.` });
    }
  }
}

export async function collectModels(report, options = {}) {
  const { copyAssets = false, includeDrafts = true } = options;
  if (!existsSync(CONTENT_MODELS_DIR)) return [];

  const entries = await readdir(CONTENT_MODELS_DIR, { withFileTypes: true });
  const models = [];
  const seen = new Set();

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;
    if (slug.startsWith(".")) continue;
    const dir = path.join(CONTENT_MODELS_DIR, slug);
    const modelReport = { slug, warnings: [], errors: [] };
    report.models.push(modelReport);

    if (seen.has(slug)) {
      modelReport.errors.push("duplicate slug");
      report.errors.push({ code: "duplicate-slug", slug, message: `${slug}: duplicate slug.` });
    }
    seen.add(slug);

    if (!SLUG_RE.test(slug)) {
      modelReport.errors.push("invalid slug");
      report.errors.push({ code: "invalid-slug", slug, message: `${slug}: slug contains unsupported characters.` });
    }

    await validateFileTree(dir, report, slug);

    const expectedMd = path.join(dir, `${slug}.md`);
    const dirEntries = await readdir(dir, { withFileTypes: true });
    const mdFiles = dirEntries.filter((item) => item.isFile() && path.extname(item.name).toLowerCase() === ".md");
    if (!existsSync(expectedMd)) {
      modelReport.errors.push("missing markdown");
      report.errors.push({ code: "missing-md", slug, message: `${slug}: ${slug}.md is required.` });
      continue;
    }
    for (const md of mdFiles) {
      if (md.name !== `${slug}.md`) {
        modelReport.errors.push("markdown name mismatch");
        report.errors.push({
          code: "md-name-mismatch",
          slug,
          message: `${slug}: markdown file must be ${slug}.md, found ${md.name}.`
        });
      }
    }

    const raw = await readFile(expectedMd, "utf8");
    const { data, body } = parseFrontmatter(raw);
    const status = typeof data.status === "string" ? data.status : "draft";
    const tags = Array.isArray(data.tags) ? data.tags : [];
    const extra = {};
    for (const [key, value] of Object.entries(data)) {
      if (!KNOWN_FRONTMATTER_KEYS.has(key)) extra[key] = value;
    }

    if (!STATUSES.has(status)) {
      modelReport.errors.push("invalid status");
      report.errors.push({ code: "invalid-status", slug, message: `${slug}: status is invalid.` });
    }

    const required = ["title", "category", "tags", "license", "status", "unit"];
    if (status === "public") {
      for (const key of required) {
        if (data[key] === undefined || data[key] === "" || (Array.isArray(data[key]) && key !== "tags" && data[key].length === 0)) {
          modelReport.errors.push(`missing ${key}`);
          report.errors.push({ code: "missing-required", slug, message: `${slug}: ${key} is required for public models.` });
        }
      }
    }
    if (data.category && !CATEGORIES.has(data.category)) {
      modelReport.warnings.push("unknown category");
      report.warnings.push({ code: "unknown-category", slug, message: `${slug}: category ${data.category} is not in the initial list.` });
    }
    if (data.tags !== undefined && !Array.isArray(data.tags)) {
      modelReport.errors.push("tags must be array");
      report.errors.push({ code: "invalid-tags", slug, message: `${slug}: tags must be an array.` });
    }
    if (containsRawHtml(body)) {
      modelReport.errors.push("raw html in markdown");
      report.errors.push({ code: "raw-html", slug, message: `${slug}: raw HTML is not allowed in markdown.` });
    }

    const cover = await findCover(dir);
    const preview = await findPreview(dir);
    const photos = await findPhotos(dir);
    const sources = await findSources(dir);
    const download = await findDownload(slug);
    const sourceCreatedAt = await sourceCreatedDateTime(sources);
    const createdAt = dateTimeValue(data.createdAt, "") || dateTimeValue(data.created, "") || sourceCreatedAt;
    const uploadedAt = dateTimeValue(data.uploadedAt, "");
    const updatedAt = dateTimeValue(data.updatedAt, "") || dateTimeValue(data.updated, "") || createdAt;
    const created = data.created || (createdAt ? formatYearMonth(new Date(createdAt)) : "") || "";
    const hasViewerSource = sources.some((source) => viewerTypeForExt(path.extname(source).toLowerCase()));

    if (!cover) report.warnings.push({ code: "missing-cover", slug, message: `${slug}: cover image is missing.` });
    if (!preview && !hasViewerSource) report.warnings.push({ code: "missing-preview", slug, message: `${slug}: preview model is missing.` });
    if (photos.length === 0) report.warnings.push({ code: "empty-photos", slug, message: `${slug}: photos are empty.` });
    if (sources.length === 0) report.warnings.push({ code: "empty-source", slug, message: `${slug}: source is empty.` });
    if (status === "draft") report.warnings.push({ code: "draft", slug, message: `${slug}: status is draft.` });

    if (copyAssets) {
      await copyPublicAssets(slug, { cover, preview, photos, sources });
    }

    if (includeDrafts || status !== "draft") {
      models.push({
        slug,
        title: data.title || titleFromSlug(slug),
        summary: data.summary || "",
        category: data.category || "other",
        tags,
        license: data.license || "Original",
        version: data.version || "",
        status,
        unit: data.unit || "mm",
        scale: data.scale || "",
        created,
        createdAt,
        uploaded: data.uploaded || (uploadedAt ? formatYearMonth(new Date(uploadedAt)) : ""),
        uploadedAt,
        updated: data.updated || created || "",
        updatedAt,
        commercial_use: data.commercial_use,
        redistribution: data.redistribution,
        modification: data.modification,
        credit_required: data.credit_required,
        bodyHtml: renderMarkdown(body),
        bodyText: body.replace(/\s+/g, " ").trim(),
        aliases: Array.isArray(data.aliases) ? data.aliases : [],
        assets: makeAssets(slug, { cover, preview, photos, sources, download }),
        sourceCount: sources.length,
        extra
      });
    }
  }

  return models.sort((a, b) => {
    const left = a.updatedAt || a.updated || "";
    const right = b.updatedAt || b.updated || "";
    if (left !== right) return right.localeCompare(left);
    return a.title.localeCompare(b.title);
  });
}

async function sourceCreatedDateTime(sources) {
  const modelSources = sources.filter((source) => [".fbx", ".step", ".stp", ".stl", ".3mf", ".obj", ".glb"].includes(path.extname(source).toLowerCase()));
  const source = selectPrimarySource(modelSources);
  if (!source) return "";
  return dateTimeValue(await fileCreatedDate(source));
}

function selectPrimarySource(sources) {
  const priorities = [".fbx", ".step", ".stp", ".stl", ".3mf", ".obj", ".glb"];
  return [...sources].sort((left, right) => {
    const leftIndex = priorities.indexOf(path.extname(left).toLowerCase());
    const rightIndex = priorities.indexOf(path.extname(right).toLowerCase());
    return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex) || left.localeCompare(right);
  })[0] ?? null;
}

async function findCover(dir) {
  const candidates = ["cover.jpg", "cover.png", "thumbnail.jpg", "thumbnail.png"];
  for (const candidate of candidates) {
    const fullPath = path.join(dir, candidate);
    if (existsSync(fullPath)) return fullPath;
  }
  const photos = await findPhotos(dir);
  return photos[0] ?? null;
}

async function findPreview(dir) {
  const candidates = ["model.glb", "preview.glb"];
  for (const candidate of candidates) {
    const fullPath = path.join(dir, candidate);
    if (existsSync(fullPath)) return fullPath;
  }
  const files = await readdir(dir, { withFileTypes: true });
  const firstGlb = files.find((file) => file.isFile() && path.extname(file.name).toLowerCase() === ".glb");
  return firstGlb ? path.join(dir, firstGlb.name) : null;
}

async function findPhotos(dir) {
  const photosDir = path.join(dir, "photos");
  if (!existsSync(photosDir)) return [];
  const entries = await readdir(photosDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => path.join(photosDir, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

export async function findSources(dir) {
  const sourceDir = path.join(dir, "source");
  if (!existsSync(sourceDir)) return [];
  const files = await listFilesRecursive(sourceDir);
  return files
    .filter((file) => {
      const ext = path.extname(file).toLowerCase();
      const basename = path.basename(file).toLowerCase();
      return basename !== ".gitkeep" && !FORBIDDEN_FILENAMES.has(basename) && !FORBIDDEN_EXTENSIONS.has(ext);
    })
    .sort((a, b) => a.localeCompare(b));
}

async function findDownload(slug) {
  const downloadsDir = path.join(PUBLIC_DIR, slug, "downloads");
  if (!existsSync(downloadsDir)) return null;
  const entries = await readdir(downloadsDir, { withFileTypes: true });
  const zip = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".zip"))
    .map((entry) => entry.name)
    .sort()
    .at(-1);
  return zip ? path.join(downloadsDir, zip) : null;
}

function makeAssets(slug, assets) {
  const base = siteBase();
  const url = (file) => (file ? `${base}/${slug}/${path.basename(file)}` : null);
  const sourceUrl = (file) => `${base}/${slug}/source/${path.basename(file)}`;
  const sourceAssets = assets.sources.map((source) => ({
    name: path.basename(source),
    ext: path.extname(source).toLowerCase(),
    url: sourceUrl(source),
    downloadName: sourceDownloadName(slug, source)
  }));
  const viewers = findViewerAssets(sourceAssets);
  const viewer = viewers[0] ?? null;
  return {
    cover: url(assets.cover),
    preview: url(assets.preview),
    photos: assets.photos.map((photo) => `${base}/${slug}/photos/${path.basename(photo)}`),
    sources: sourceAssets,
    stlPreview: sourceAssets.find((source) => source.ext === ".stl")?.url ?? null,
    viewer,
    viewers,
    download: assets.download ? `${base}/${slug}/downloads/${path.basename(assets.download)}` : null
  };
}

function findViewerAssets(sourceAssets) {
  const priorities = [
    { type: "fbx", exts: [".fbx"] },
    { type: "step", exts: [".step", ".stp"] },
    { type: "stl", exts: [".stl"] }
  ];
  return priorities.flatMap((priority) =>
    sourceAssets
      .filter((source) => priority.exts.includes(source.ext))
      .map((source) => ({ ...source, type: priority.type }))
  );
}

function viewerTypeForExt(ext) {
  if (ext === ".fbx") return "fbx";
  if (ext === ".step" || ext === ".stp") return "step";
  if (ext === ".stl") return "stl";
  return "";
}

function sourceDownloadName(slug, source) {
  const parsed = path.parse(source);
  const partName = parsed.name
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "part";
  return `${slug}_${partName}${parsed.ext.toLowerCase()}`;
}

async function resetGeneratedPublic() {
  if (!existsSync(PUBLIC_DIR)) await ensureDir(PUBLIC_DIR);
  const entries = await readdir(PUBLIC_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".gitkeep") continue;
    await rm(path.join(PUBLIC_DIR, entry.name), { recursive: true, force: true });
  }
}

async function copyPublicAssets(slug, assets) {
  const targetDir = path.join(PUBLIC_DIR, slug);
  await cleanPublicAssetDir(targetDir);
  await ensureDir(path.join(targetDir, "photos"));
  await ensureDir(path.join(targetDir, "source"));
  if (assets.cover) await copyFile(assets.cover, path.join(targetDir, path.basename(assets.cover)));
  if (assets.preview) await copyFile(assets.preview, path.join(targetDir, path.basename(assets.preview)));
  for (const photo of assets.photos) {
    await copyFile(photo, path.join(targetDir, "photos", path.basename(photo)));
  }
  for (const source of assets.sources) {
    await copyFile(source, path.join(targetDir, "source", path.basename(source)));
  }
}

async function cleanPublicAssetDir(targetDir) {
  if (!existsSync(targetDir)) return;
  const entries = await readdir(targetDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "downloads") continue;
    await rm(path.join(targetDir, entry.name), { recursive: true, force: true });
  }
}

export async function writeReports(report) {
  await ensureDir(REPORTS_DIR);
  await writeFile(path.join(REPORTS_DIR, "model-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  const md = [
    "# Model Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `Errors: ${report.errors.length}`,
    `Warnings: ${report.warnings.length}`,
    "",
    "## Info",
    ...report.info.map((item) => `- ${item}`),
    "",
    "## Errors",
    ...(report.errors.length ? report.errors.map((item) => `- ${item.message}`) : ["- None"]),
    "",
    "## Warnings",
    ...(report.warnings.length ? report.warnings.map((item) => `- ${item.message}`) : ["- None"])
  ].join("\n");
  await writeFile(path.join(REPORTS_DIR, "model-report.md"), `${md}\n`);

  if (process.env.GITHUB_STEP_SUMMARY) {
    await writeFile(process.env.GITHUB_STEP_SUMMARY, `${md}\n`, { flag: "a" });
  }
}

export async function writeGeneratedModels(models) {
  await ensureDir(path.dirname(GENERATED_DATA_FILE));
  await writeFile(GENERATED_DATA_FILE, `${JSON.stringify(models, null, 2)}\n`);
}

export async function fileHash(files) {
  const hash = createHash("sha256");
  for (const file of files.toSorted()) {
    const data = await readFile(file);
    const fileStat = await stat(file);
    hash.update(path.relative(".", file).replace(/\\/g, "/"));
    hash.update(String(fileStat.size));
    hash.update(data);
  }
  return hash.digest("hex").slice(0, 7);
}
