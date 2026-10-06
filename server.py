#!/usr/bin/env python3
"""Tiny same-origin proxy for the NGEN API, so a static browser app avoids CORS.

Serves index.html and forwards /api/* to the NGEN backend with the Origin header
the backend's CORS allowlist requires. Stdlib only. Run: python3 server.py [port]
"""
import sys, urllib.request, urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

UPSTREAM = "https://api-ngen-eu17.rgiseu.com"
ALLOWED_ORIGIN = "https://ngen-eu17.rgiseu.com"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class Handler(BaseHTTPRequestHandler):
    def _proxy(self):
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else None
        req = urllib.request.Request(UPSTREAM + self.path, data=body, method=self.command)
        # forward the bits the API cares about; spoof Origin/Referer past the allowlist
        req.add_header("Origin", ALLOWED_ORIGIN)
        req.add_header("Referer", ALLOWED_ORIGIN + "/")
        if self.headers.get("Authorization"):
            req.add_header("Authorization", self.headers["Authorization"])
        req.add_header("Content-Type", self.headers.get("Content-Type", "application/json"))
        try:
            resp = urllib.request.urlopen(req, timeout=60)
            data, status, ctype = resp.read(), resp.status, resp.headers.get("Content-Type", "application/json")
        except urllib.error.HTTPError as e:                 # 4xx/5xx still carry a useful body
            data, status, ctype = e.read(), e.code, e.headers.get("Content-Type", "application/json")
        except Exception as e:
            data, status, ctype = str(e).encode(), 502, "text/plain"
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _static(self):
        path = "index.html" if self.path in ("/", "") else self.path.lstrip("/")
        try:
            with open(path, "rb") as f:
                data = f.read()
        except OSError:
            self.send_error(404); return
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        self._proxy() if self.path.startswith("/api/") else self._static()

    do_POST = do_PUT = do_DELETE = lambda self: self._proxy()

    def log_message(self, *a):  # quieter
        sys.stderr.write("%s %s -> %s\n" % (self.command, self.path, a[-1] if a else ""))


if __name__ == "__main__":
    print(f"NGEN app on http://localhost:{PORT}  (proxying /api -> {UPSTREAM})")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
