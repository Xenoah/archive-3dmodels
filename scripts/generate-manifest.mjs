import { collectModels, validateRepository, writeGeneratedModels } from "./lib/model-utils.mjs";

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
await writeGeneratedModels(models);

console.log(`[INFO] generated manifest: ${models.length} models`);
