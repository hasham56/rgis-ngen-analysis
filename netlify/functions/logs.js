import { getStore } from "@netlify/blobs";

const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

// Password-gated viewer for the visit log. Set LOGS_PASSWORD in Netlify env vars.
export default async (req) => {
  const url = new URL(req.url);
  const pw = url.searchParams.get("pw") || "";
  const expected = process.env.LOGS_PASSWORD || "";

  if (!expected)
    return new Response("Set a LOGS_PASSWORD environment variable in Netlify (Site settings → Environment variables) to enable this page.", { status: 500 });
  if (pw !== expected)
    return new Response('<form style="font:16px system-ui;margin:12vh auto;max-width:300px"><p>Enter password</p><input name="pw" type="password" autofocus style="width:100%;padding:8px"><button style="margin-top:8px;padding:8px 14px">View logs</button></form>',
      { status: pw ? 401 : 200, headers: { "Content-Type": "text/html" } });

  // ponytail: one get per entry, fine at low volume, add paging if the log grows large
  const store = getStore("visits");
  const { blobs } = await store.list();
  const rows = [];
  for (const b of blobs) { const e = await store.get(b.key, { type: "json" }); if (e) rows.push(e); }
  rows.sort((a, b) => (b.ts || 0) - (a.ts || 0));

  // Date/Time shown in UK time (Europe/London), then the requested column order
  const ukDate = (r) => r.ts ? new Date(r.ts).toLocaleDateString("en-GB", { timeZone: "Europe/London" }) : "";
  const ukTime = (r) => r.ts ? new Date(r.ts).toLocaleTimeString("en-GB", { timeZone: "Europe/London" }) : "";
  const COLS = [
    ["Date", ukDate], ["Time", ukTime], ["URL", (r) => r.url], ["City", (r) => r.city],
    ["Country", (r) => r.country], ["IP", (r) => r.ip],
    ["Badge ID", (r) => r.badgeId], ["Auth Code", (r) => r.eventId], ["Connection Code", (r) => r.eventCode],
    ["Type", (r) => r.type], ["Success", (r) => r.success], ["Region", (r) => r.subdivision],
    ["Lat", (r) => r.lat], ["Lon", (r) => r.lon], ["Geo TZ", (r) => r.timezone],
    ["User-Agent", (r) => r.ua], ["Referer", (r) => r.referer],
  ];
  const body = rows.map((r) =>
    "<tr>" + COLS.map(([, fn]) => `<td>${esc(fn(r))}</td>`).join("") + "</tr>").join("");

  const html = `<!doctype html><meta charset=utf-8><title>Visit log</title>
<style>body{font:13px system-ui;margin:0;background:#15181c;color:#e7eaee}
header{padding:12px 16px;border-bottom:1px solid #2c323a}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #2c323a;padding:4px 8px;white-space:nowrap;text-align:left}
th{position:sticky;top:0;background:#1e2228}td{max-width:280px;overflow:hidden;text-overflow:ellipsis}
.wrap{overflow:auto;max-height:calc(100vh - 46px)}</style>
<header><b>Visit log</b> · ${rows.length} entries · times in UK (Europe/London)</header>
<div class=wrap><table><thead><tr>${COLS.map(([h]) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>`;
  return new Response(html, { headers: { "Content-Type": "text/html" } });
};
