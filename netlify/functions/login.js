import { getStore } from "@netlify/blobs";
import { clientInfo } from "./track.js";

const UPSTREAM = "https://api-ngen-eu17.rgiseu.com/api/login";

// Proxies /api/login to NGEN and logs the attempt (with badge/event) to Blobs.
export default async (req, context) => {
  const bodyText = await req.text();
  let up;
  try {
    up = await fetch(UPSTREAM, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bodyText,
    });
  } catch (err) {
    return Response.json({ errorMessage: "Proxy error: " + err.message }, { status: 502 });
  }
  const text = await up.text();

  try {
    const e = clientInfo(req, context);
    e.type = "login";
    e.success = up.ok;
    e.url = "/api/login";
    try { const b = JSON.parse(bodyText); e.badgeId = b.badgeId || ""; e.eventId = b.eventId || ""; e.eventCode = b.eventCode || ""; } catch {}
    await getStore("visits").setJSON(`${e.ts}-${Math.random().toString(36).slice(2, 8)}`, e);
  } catch { /* logging must never break login */ }

  return new Response(text, { status: up.status, headers: { "Content-Type": "application/json" } });
};
