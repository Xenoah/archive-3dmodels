import { defineConfig } from "astro/config";

const base = process.env.PUBLIC_BASE_PATH ?? "/models";

export default defineConfig({
  site: process.env.PUBLIC_SITE ?? "https://xenoah.github.io",
  base,
  output: "static",
  trailingSlash: "always"
});
