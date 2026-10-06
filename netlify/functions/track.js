import { getStore } from "@netlify/blobs";

// visitor detail from the request + Netlify's edge geo/ip
function clientInfo(req, context) {
  const g = (context && context.geo) || {};
  const ts = Date.now();
  return {
    ts,
    time: new Date(ts).toISOString(),
    ip: (context && context.ip) || req.headers.get("x-nf-client-connection-ip") ||
        req.headers.get("x-forwarded-for") || "",
    city: g.city || "",
    subdivision: (g.subdivision && g.subdivision.name) || "",
    country: (g.country && (g.country.name || g.country.code)) || "",
    lat: g.latitude ?? "",
    lon: g.longitude ?? "",
    timezone: g.timezone || "",
    ua: req.headers.get("user-agent") || "",
    referer: req.headers.get("referer") || "",
  };
}

export { clientInfo };

export default async (req, context) => {
  const e = clientInfo(req, context);
  e.type = "pageview";
  try {
    await getStore("visits").setJSON(`${e.ts}-${Math.random().toString(36).slice(2, 8)}`, e);
  } catch { /* never block the page on a logging failure */ }
  return new Response("", { status: 204 });
};
