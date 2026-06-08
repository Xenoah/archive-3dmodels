import models from "../data/models.generated.json";

export function GET({ site }) {
  const base = new URL(import.meta.env.BASE_URL, site).href.replace(/\/$/, "");
  const publicModels = models
    .filter((model) => model.status === "public")
    .slice(0, 20);

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n  <channel>\n    <title>3D Models</title>\n    <link>${escapeXml(`${base}/`)}</link>\n    <description>Downloadable 3D model archive</description>\n${publicModels
      .map((model) => {
        const link = `${base}/${encodeURIComponent(model.slug)}/`;
        return `    <item>\n      <title>${escapeXml(model.title)}</title>\n      <link>${escapeXml(link)}</link>\n      <guid>${escapeXml(link)}</guid>\n      <description>${escapeXml(model.summary || model.title)}</description>\n    </item>`;
      })
      .join("\n")}\n  </channel>\n</rss>\n`;

  return new Response(body, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" }
  });
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
