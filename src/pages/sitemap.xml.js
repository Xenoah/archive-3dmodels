import models from "../data/models.generated.json";

export function GET({ site }) {
  const base = new URL(import.meta.env.BASE_URL, site).href.replace(/\/$/, "");
  const publicModels = models.filter((model) => model.status === "public");
  const urls = [
    { loc: `${base}/`, lastmod: newestLastmod(publicModels) },
    { loc: `${base}/terms/` },
    ...publicModels.map((model) => ({
      loc: `${base}/${model.slug}/`,
      lastmod: model.updatedAt || model.createdAt || ""
    }))
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((url) => {
      const lastmod = sitemapDate(url.lastmod);
      return `  <url><loc>${escapeXml(url.loc)}</loc>${lastmod ? `<lastmod>${escapeXml(lastmod)}</lastmod>` : ""}</url>`;
    })
    .join("\n")}\n</urlset>\n`;

  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8" }
  });
}

function newestLastmod(models) {
  return models
    .map((model) => model.updatedAt || model.createdAt || "")
    .filter(Boolean)
    .sort()
    .at(-1);
}

function sitemapDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
