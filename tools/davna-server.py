"""
Davna Local Server — STUB
============================================================================
Serves any GGUF / safetensors model via the OpenAI-compatible HTTP API.

FreeLattice auto-discovers this on port 8000 (see app.html: AI_DISCOVERY_SERVERS).
Once running, the InferenceRouter routes to it like any other provider — no
configuration on the user's side. They start the server, FreeLattice finds it.

Usage (once implemented):
    python tools/davna-server.py --model path/to/model.gguf

Dependencies (when implementing):
    pip install flask llama-cpp-python
    # or
    pip install flask ctransformers

This is a STUB. The real implementation lands when the partner training the
model delivers it. Until then, save the architecture so it's ready.

----------------------------------------------------------------------------
IMPLEMENTATION CHECKLIST (TODO)
----------------------------------------------------------------------------

1. Flask app with the two OpenAI-compatible endpoints FreeLattice probes:
     GET  /v1/models                    -> { "data": [ { "id": "...", ... } ] }
     POST /v1/chat/completions          -> OpenAI streaming or non-streaming
                                           response shape (choices[0].delta.content
                                           for streaming, choices[0].message.content
                                           for non-streaming).

2. Model loader: llama-cpp-python (GGUF) or ctransformers (broader format set).
   Lazy-load on first request; keep in memory thereafter.

3. GPU detection and layer offloading:
     - NVIDIA: torch.cuda.is_available() OR pynvml; offload max layers that
       fit in detected VRAM.
     - Apple Silicon (Metal): llama-cpp-python with Metal build (n_gpu_layers=-1).
     - AMD ROCm: parallel path if rocm-smi present.
     - CPU fallback: explicit, no surprise.

4. Streaming via Server-Sent Events:
     yield 'data: ' + json.dumps({ 'choices': [{ 'delta': { 'content': chunk } }] }) + '\\n\\n'
     yield 'data: [DONE]\\n\\n'
   Match the streaming shape the chat's streaming parser at app.html ~31574 expects.

5. CORS — set Access-Control-Allow-Origin: * (or echo Origin) so the browser
   page on freelattice.com can talk to localhost:8000. Without this,
   browsers block the cross-origin fetch even though localhost is exempt
   from mixed-content blocking.

6. Optional: --port arg (default 8000), --host (default 127.0.0.1 — keep
   off the public internet by default), --context-length, --max-tokens.

----------------------------------------------------------------------------
CC's reading (notes for the next builder, May 31, 2026)
----------------------------------------------------------------------------

* **Auto-discovery is already wired.** FreeLattice's `scanForLocalAI()`
  (docs/app.html ~31949) probes port 8000 expecting OpenAI-compatible JSON
  (`{ data: [...] }`) at `/v1/models`. As long as this server matches that
  shape, no FreeLattice-side change is needed. Test locally with:
      curl http://localhost:8000/v1/models
  before claiming the integration works.

* **InferenceRouter routes by format family.** Port 8000 is classified
  `openai-chat` in the discovery table (CODEX.md, "Provider Independence
  Tier A"). Provenance stamping, circuit-breaker health, ResponseCache
  fallback — all of it works automatically the moment this server responds.

* **Streaming format is non-negotiable.** Match
  `choices[0].delta.content` exactly. The chat parser at app.html ~31574
  reads that path; sending `choices[0].text` (legacy) won't render.

* **CORS is the single most likely failure mode.** Test with a chrome
  page open on freelattice.com pointing fetch at localhost:8000 BEFORE
  shipping. The Welcome Wizard's harness handles CORS for Ollama via
  OLLAMA_ORIGINS=* — this server needs the equivalent Flask CORS setup.
  Recommend: `from flask_cors import CORS; CORS(app)`.

* **Name in user-facing UI.** Per docs/library/CLARITY_AUDIT.md, "Davna"
  is an internal-only name and should NOT appear in user-visible strings.
  When the wizard surfaces a discovered server on port 8000, it'll show
  the user the *model name* (returned via /v1/models), not "Davna." The
  internal codename stays in the code and these notes.

* **Suggested folder layout when the real implementation lands:**
      tools/davna/
          server.py            # Flask app, request routing
          model.py             # Loader, GPU offload, generation
          stream.py            # SSE helper
          README.md            # How to run, dependencies, troubleshooting
      tools/davna-server.py    # Thin shim that imports tools.davna.server

  Until then, this single stub file holds the architecture.

* **Verification plan when implementing:**
  1. `python tools/davna-server.py --model some.gguf` runs without error.
  2. `curl http://localhost:8000/v1/models` returns valid JSON.
  3. Open freelattice.com locally — the wizard discovers port 8000 and
     surfaces the model name.
  4. Send a chat message — provenance chip shows the model from this server.
  5. Kill the server mid-conversation — the InferenceRouter whispers a
     downgrade and falls back to Browser AI or cache.

----------------------------------------------------------------------------

if __name__ == '__main__':
    raise NotImplementedError(
        'Davna server stub. Implementation pending the partner\\'s model '
        'training. See the IMPLEMENTATION CHECKLIST in this file.'
    )
"""
raise NotImplementedError(
    "Davna server stub. See the docstring's IMPLEMENTATION CHECKLIST."
)
