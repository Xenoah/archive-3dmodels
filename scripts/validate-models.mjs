import { validateRepository } from "./lib/model-utils.mjs";

const { report } = await validateRepository();

for (const info of report.info) console.log(`[INFO] ${info}`);
for (const warning of report.warnings) console.warn(`[WARN] ${warning.message}`);
for (const error of report.errors) console.error(`[ERROR] ${error.message}`);

if (report.errors.length > 0) {
  process.exitCode = 1;
}
