#!/usr/bin/env python3
"""
Davna Mock Server — OpenAI-compatible test harness on port 8000
================================================================
Minimal OpenAI-compatible HTTP server. Lets us test FreeLattice's
Davna discovery + chat path BEFORE the real model arrives.

What it does:
    GET  /v1/models                    → returns one mock model "davna-mock"
    POST /v1/chat/completions          → returns a canned response
                                          (non-streaming + streaming both supported)
    OPTIONS *                          → CORS preflight (Access-Control-Allow-Origin: *)

Usage:
    python tools/davna-mock-server.py
    # then in FreeLattice, the InferenceRouter probe will discover
    # http://localhost:8000/v1/models and offer to use it.
    # OR set provider to "openai-compat-local" with base URL http://localhost:8000

No dependencies — pure stdlib http.server + json.

Once the real Davna model arrives, swap this for tools/davna-server.py
(the real implementation). The wire shape is identical.
"""

import json
import sys
import time
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = 8000

CANNED_REPLY = (
    "Hello — I'm Davna (mock). FreeLattice found me on port 8000 and "
    "we're talking. The door works. Provenance should show "
    "openai-compat-local with model davna-mock and latency under 50ms."
)


def cors_headers(handler):
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-Requested-With",
    )


class DavnaMockHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        # Keep logs visible but quiet — one line per request.
        sys.stderr.write("[davna-mock %s] %s\n" % (
            time.strftime("%H:%M:%S"), fmt % args
        ))

    def do_OPTIONS(self):
        self.send_response(204)
        cors_headers(self)
        self.end_headers()

    def do_GET(self):
        if self.path.startswith("/v1/models"):
            body = {
                "data": [
                    {
                        "id": "davna-mock",
                        "object": "model",
                        "created": int(time.time()),
                        "owned_by": "freelattice",
                    }
                ]
            }
            payload = json.dumps(body).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            cors_headers(self)
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        self.send_response(404)
        cors_headers(self)
        self.end_headers()
        self.wfile.write(b'{"error":"not found"}')

    def do_POST(self):
        if not self.path.startswith("/v1/chat/completions"):
            self.send_response(404)
            cors_headers(self)
            self.end_headers()
            return

        length = int(self.headers.get("Content-Length", "0") or "0")
        raw = self.rfile.read(length) if length > 0 else b"{}"
        try:
            req = json.loads(raw.decode("utf-8") or "{}")
        except Exception:
            req = {}

        stream = bool(req.get("stream", False))
        model = req.get("model", "davna-mock")
        # Echo a brief acknowledgement of the user prompt so the test is
        # visibly responsive (and provenance gets a non-cached latency).
        msgs = req.get("messages") or []
        last_user = ""
        for m in reversed(msgs):
            if m.get("role") == "user":
                last_user = (m.get("content") or "")[:120]
                break
        reply = (
            CANNED_REPLY
            + ("\n\nYou said: " + last_user if last_user else "")
        )

        if not stream:
            body = {
                "id": "chatcmpl-davna-mock-" + str(int(time.time() * 1000)),
                "object": "chat.completion",
                "created": int(time.time()),
                "model": model,
                "choices": [
                    {
                        "index": 0,
                        "message": {"role": "assistant", "content": reply},
                        "finish_reason": "stop",
                    }
                ],
                "usage": {
                    "prompt_tokens": sum(
                        len((m.get("content") or "").split()) for m in msgs
                    ),
                    "completion_tokens": len(reply.split()),
                    "total_tokens": 0,
                },
            }
            payload = json.dumps(body).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            cors_headers(self)
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        # Streaming path (SSE).
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        cors_headers(self)
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.end_headers()

        def sse(obj):
            self.wfile.write(b"data: " + json.dumps(obj).encode("utf-8") + b"\n\n")
            try:
                self.wfile.flush()
            except Exception:
                pass

        words = reply.split(" ")
        for i, w in enumerate(words):
            chunk = w + ("" if i == len(words) - 1 else " ")
            sse(
                {
                    "id": "chatcmpl-stream",
                    "object": "chat.completion.chunk",
                    "created": int(time.time()),
                    "model": model,
                    "choices": [
                        {
                            "index": 0,
                            "delta": {"content": chunk},
                            "finish_reason": None,
                        }
                    ],
                }
            )
            time.sleep(0.04)  # 40ms per token — visible streaming pace
        sse(
            {
                "id": "chatcmpl-stream",
                "object": "chat.completion.chunk",
                "created": int(time.time()),
                "model": model,
                "choices": [
                    {"index": 0, "delta": {}, "finish_reason": "stop"}
                ],
            }
        )
        self.wfile.write(b"data: [DONE]\n\n")
        try:
            self.wfile.flush()
        except Exception:
            pass


def main():
    print("Davna mock server starting on http://localhost:%d" % PORT)
    print("  GET  /v1/models")
    print("  POST /v1/chat/completions  (stream + non-stream)")
    print("Ctrl-C to stop.")
    try:
        HTTPServer(("127.0.0.1", PORT), DavnaMockHandler).serve_forever()
    except KeyboardInterrupt:
        print("\nDavna mock server stopped.")


if __name__ == "__main__":
    main()
