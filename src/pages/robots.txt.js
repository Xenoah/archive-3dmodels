export function GET({ site }) {
  const base = new URL(import.meta.env.BASE_URL, site).href.replace(/\/$/, "");
  const body = [
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${base}/sitemap.xml`,
    ""
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });
}
