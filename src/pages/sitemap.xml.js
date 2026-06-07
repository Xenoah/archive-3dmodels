import models from "../data/models.generated.json";

export function GET({ site }) {
  const base = new URL(import.meta.env.BASE_URL, site).href.replace(/\/$/, "");
  const pageModels = models.filter((model) => model.status === "public" || model.status === "draft" || model.status === "hidden");
  const urls = [
    `${base}/`,
    `${base}/terms/`,
    ...pageModels.map((model) => `${base}/${model.slug}/`)
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`)
    .join("\n")}\n</urlset>\n`;

  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8" }
  });
}

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
