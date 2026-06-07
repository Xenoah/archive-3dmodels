import { existsSync } from "node:fs";
import { mkdir, readdir, rename } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { INBOX_DIR, SLUG_RE, UPLOADED_DIR } from "./lib/constants.mjs";

const apply = process.argv.includes("--apply");
const merge = process.argv.includes("--merge");

if (!existsSync(INBOX_DIR)) {
  console.log("[INFO] _inbox does not exist.");
  process.exit(0);
}

const entries = await readdir(INBOX_DIR, { withFileTypes: true });
const slugs = entries
  .filter((entry) => entry.isDirectory() && SLUG_RE.test(entry.name))
  .map((entry) => entry.name)
  .sort();

if (slugs.length === 0) {
  console.log("[INFO] no _inbox/{slug} folders found.");
  process.exit(0);
}

let failed = false;
const archived = [];
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

  const inboxPath = path.join(INBOX_DIR, slug);
  const uploadedPath = uniqueUploadedPath(slug);
  if (apply) {
    await mkdir(UPLOADED_DIR, { recursive: true });
    await rename(inboxPath, uploadedPath);
    archived.push(uploadedPath);
    console.log(`DO archive ${inboxPath} -> ${uploadedPath}`);
  } else {
    console.log(`PLAN archive ${inboxPath} -> ${uploadedPath}`);
  }
}

if (process.env.GITHUB_STEP_SUMMARY) {
  const mode = apply ? "apply" : "dry-run";
  const lines = [
    `## Inbox import ${mode}`,
    "",
    `Detected ${slugs.length} inbox folder(s).`,
    "",
    ...slugs.map((slug) => `- \`${path.join(INBOX_DIR, slug).replace(/\\/g, "/")}\``),
    ...(archived.length
      ? ["", "Archived:", "", ...archived.map((dir) => `- \`${dir.replace(/\\/g, "/")}\``)]
      : [])
  ];
  await import("node:fs/promises").then(({ writeFile }) =>
    writeFile(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`, { flag: "a" })
  );
}

if (failed) process.exit(1);

function uniqueUploadedPath(slug) {
  let candidate = path.join(UPLOADED_DIR, slug);
  let index = 2;
  while (existsSync(candidate)) {
    candidate = path.join(UPLOADED_DIR, `${slug}-${index}`);
    index += 1;
  }
  return candidate;
}
