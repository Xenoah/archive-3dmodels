import { collectModels, validateRepository, writeGeneratedModels } from "./lib/model-utils.mjs";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

const { report } = await validateRepository();
if (report.errors.length > 0) {
  for (const error of report.errors) console.error(`[ERROR] ${error.message}`);
  process.exit(1);
}

const manifestReport = {
  generatedAt: new Date().toISOString(),
  info: [],
  warnings: [],
  errors: [],
  models: []
};
const models = await collectModels(manifestReport, { copyAssets: true, includeDrafts: true });
await copyViewerVendor();
await writeGeneratedModels(models);

console.log(`[INFO] generated manifest: ${models.length} models`);

async function copyViewerVendor() {
  const sourceDir = path.join("node_modules", "occt-import-js", "dist");
  const targetDir = path.join("public", "vendor", "occt-import-js");
  await mkdir(targetDir, { recursive: true });
  for (const fileName of ["occt-import-js.js", "occt-import-js.wasm"]) {
    await copyFile(path.join(sourceDir, fileName), path.join(targetDir, fileName));
  }
}
