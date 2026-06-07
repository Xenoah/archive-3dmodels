import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { open, stat } from "node:fs/promises";
import path from "node:path";
import { UPLOADED_DIR } from "./constants.mjs";

export async function fileCreatedYearMonth(file, options = {}) {
  const metadataDate = await modelMetadataDate(file);
  if (metadataDate) return formatYearMonth(metadataDate);

  const uploadedFile = uploadedOriginalCandidate(file, options);
  if (uploadedFile) {
    const uploadedMetadataDate = await modelMetadataDate(uploadedFile);
    if (uploadedMetadataDate) return formatYearMonth(uploadedMetadataDate);

    const uploadedStat = await stat(uploadedFile);
    return formatYearMonth(earliestFileDate(uploadedStat));
  }

  const gitDate = gitFirstCommitDate(file);
  if (gitDate && isGitHubActions()) return formatYearMonth(gitDate);

  const fileStat = await stat(file);
  const fileDate = earliestFileDate(fileStat);
  return formatYearMonth(fileDate);
}

export function currentYearMonth() {
  return formatYearMonth(new Date());
}

export function yearMonthValue(value, fallback) {
  if (typeof value !== "string" || value.trim() === "") return fallback;
  const trimmed = value.trim();
  const japanese = /^(\d{4})年(\d{1,2})月$/.exec(trimmed);
  if (japanese) return `${japanese[1]}年${japanese[2].padStart(2, "0")}月`;
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return formatYearMonth(parsed);
  return trimmed;
}

export function formatYearMonth(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}年${month}月`;
}

async function modelMetadataDate(file) {
  const ext = path.extname(file).toLowerCase();
  if (![".fbx", ".step", ".stp", ".stl"].includes(ext)) return null;

  const header = await readHeaderText(file, ext === ".fbx" ? 1024 * 1024 : 128 * 1024);
  if (!header) return null;

  if (ext === ".step" || ext === ".stp") {
    const fileNameDate = /FILE_NAME\s*\([^;]*?['"](\d{4}[-/:]\d{1,2}[-/:]\d{1,2}(?:[T\s]\d{1,2}:\d{1,2}(?::\d{1,2})?)?)['"]/is.exec(header);
    const parsed = parseLooseDate(fileNameDate?.[1]);
    if (parsed) return parsed;
  }

  if (ext === ".fbx") {
    const creationTime = /CreationTime(?:Stamp)?[^0-9]{0,40}(\d{4}[-/:]\d{1,2}[-/:]\d{1,2}(?:[T\s]\d{1,2}:\d{1,2}(?::\d{1,2})?)?)/i.exec(header);
    const parsed = parseLooseDate(creationTime?.[1]);
    if (parsed) return parsed;
  }

  const genericDate = /\b(\d{4}[-/:]\d{1,2}[-/:]\d{1,2}(?:[T\s]\d{1,2}:\d{1,2}(?::\d{1,2})?)?)\b/.exec(header);
  return parseLooseDate(genericDate?.[1]);
}

async function readHeaderText(file, byteLength) {
  let handle;
  try {
    handle = await open(file, "r");
    const buffer = Buffer.alloc(byteLength);
    const { bytesRead } = await handle.read(buffer, 0, byteLength, 0);
    return buffer.subarray(0, bytesRead).toString("utf8");
  } catch {
    return "";
  } finally {
    await handle?.close();
  }
}

function parseLooseDate(value) {
  if (!value) return null;
  const normalized = value.trim().replace(/\//g, "-").replace(/^(\d{4})-(\d{1,2})-(\d{1,2})/, (_, year, month, day) => {
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  });
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isGitHubActions() {
  return process.env.GITHUB_ACTIONS === "true";
}

function gitFirstCommitDate(file) {
  for (const relativePath of gitPathCandidates(file)) {
    try {
      const output = execFileSync(
        "git",
        ["log", "--follow", "--diff-filter=A", "--format=%aI", "--", relativePath],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
      );
      const lines = output.trim().split(/\r?\n/).filter(Boolean);
      const parsed = lines.length > 0 ? new Date(lines.at(-1)) : null;
      if (parsed && !Number.isNaN(parsed.getTime())) return parsed;
    } catch {
      // Try the next plausible path. GitHub Actions may move loose inbox files before import.
    }
  }
  return null;
}

function gitPathCandidates(file) {
  const relativePath = path.relative(process.cwd(), file).replace(/\\/g, "/");
  if (!relativePath || relativePath.startsWith("..")) return [];

  const candidates = [relativePath];
  const inboxFolderFile = /^_inbox\/[^/]+\/(.+)$/.exec(relativePath);
  if (inboxFolderFile) candidates.push(`_inbox/${inboxFolderFile[1]}`);

  const contentSourceFile = /^content\/models\/([^/]+)\/source\/(.+)$/.exec(relativePath);
  if (contentSourceFile) {
    candidates.push(`_inbox/${contentSourceFile[1]}/${contentSourceFile[2]}`);
    candidates.push(`_inbox/${contentSourceFile[2]}`);
    candidates.push(`_uploaded/${contentSourceFile[1]}/${contentSourceFile[2]}`);
  }

  return [...new Set(candidates)];
}

function uploadedOriginalCandidate(file, options = {}) {
  if (options.uploadedSlug && options.uploadedRelativePath) {
    const candidate = path.join(UPLOADED_DIR, options.uploadedSlug, options.uploadedRelativePath);
    if (existsSync(candidate)) return candidate;

    const basenameCandidate = path.join(UPLOADED_DIR, options.uploadedSlug, path.basename(options.uploadedRelativePath));
    if (existsSync(basenameCandidate)) return basenameCandidate;
  }

  const relativePath = path.relative(process.cwd(), file).replace(/\\/g, "/");
  const contentSourceFile = /^content\/models\/([^/]+)\/source\/(.+)$/.exec(relativePath);
  if (!contentSourceFile) return null;

  const [, slug, sourceRelativePath] = contentSourceFile;
  const candidate = path.join(UPLOADED_DIR, slug, sourceRelativePath);
  if (existsSync(candidate)) return candidate;

  const basenameCandidate = path.join(UPLOADED_DIR, slug, path.basename(sourceRelativePath));
  return existsSync(basenameCandidate) ? basenameCandidate : null;
}

function earliestFileDate(fileStat) {
  const candidates = [
    Number.isNaN(fileStat.birthtimeMs) || fileStat.birthtimeMs <= 0 ? null : fileStat.birthtime,
    Number.isNaN(fileStat.mtimeMs) || fileStat.mtimeMs <= 0 ? null : fileStat.mtime
  ].filter(Boolean);
  return candidates.sort((left, right) => left.getTime() - right.getTime())[0] ?? new Date();
}
