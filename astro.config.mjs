import { defineConfig } from "astro/config";

const base = process.env.PUBLIC_BASE_PATH ?? "/archive-3dmodels";

export default defineConfig({
  site: process.env.PUBLIC_SITE ?? "https://xenoah.github.io",
  base,
  output: "static",
  trailingSlash: "always"
});
