"""HttpStore round-trip against a minimal in-process HTTP sink."""

from __future__ import annotations

import json
import threading
import urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer

from tongflow.engine.store import HttpStore

TOKEN = "test-token"


class _Sink(BaseHTTPRequestHandler):
    blobs: dict[str, bytes] = {}
    counter = 0

    def _authed(self) -> bool:
        return self.headers.get("Authorization") == f"Bearer {TOKEN}"

    def do_POST(self):  # noqa: N802
        if not self._authed():
            self.send_error(401)
            return
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        ext = (qs.get("ext") or ["bin"])[0]
        length = int(self.headers.get("Content-Length", "0"))
        data = self.rfile.read(length)
        _Sink.counter += 1
        file_key = f"tasks/t1/{_Sink.counter}.{ext}"
        _Sink.blobs[file_key] = data
        body = json.dumps({"file_key": file_key}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):  # noqa: N802
        if not self._authed():
            self.send_error(401)
            return
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        key = (qs.get("file_key") or [""])[0]
        blob = _Sink.blobs.get(key)
        if blob is None:
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("Content-Type", "application/octet-stream")
        self.end_headers()
        self.wfile.write(blob)

    def log_message(self, *args):  # silence
        pass


def test_http_store_roundtrip():
    server = HTTPServer(("127.0.0.1", 0), _Sink)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        endpoint = f"http://127.0.0.1:{server.server_address[1]}/assets"
        store = HttpStore(endpoint, TOKEN)

        ref = store.put(b"hello-bytes", mime="image/png", ext="png")
        assert ref["file_key"].endswith(".png")
        assert ref["mime"] == "image/png"

        assert store.get(ref["file_key"]) == b"hello-bytes"
        assert store.get("tasks/does-not-exist.png") is None
        # URL-ish refs skip the sink entirely
        assert store.get("https://example.com/x.png") is None
        assert store.get("mem://abc") is None
    finally:
        server.shutdown()
