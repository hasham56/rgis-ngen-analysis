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
  e.url = new URL(req.url).searchParams.get("u") || e.referer || "/"; // page the client reported
  try {
    await getStore("visits").setJSON(`${e.ts}-${Math.random().toString(36).slice(2, 8)}`, e);
  } catch (err) {
    // surface the real reason (visible only when ?debug=1) instead of silently swallowing
    if (new URL(req.url).searchParams.get("debug") === "1")
      return new Response("log-error: " + (err && err.message), { status: 200 });
  }
  return new Response("ok", { status: 200 }); // 204 is rejected by the functions runtime

};
