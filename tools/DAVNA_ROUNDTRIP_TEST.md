# Davna Roundtrip Test — testing the door before the guest arrives

> Verify FreeLattice can discover, connect to, chat with, and stamp provenance for a Davna-shaped server on `localhost:8000`. Run this test BEFORE the real partner model is delivered, so the path is known-good when the model arrives.

---

## What this proves

1. **The discovery probe works.** FreeLattice's `AI_DISCOVERY_SERVERS` list (`docs/app.html` ~32169) probes `http://localhost:8000/v1/models`. We want to see it succeed.
2. **The OpenAI-compat chat path works.** `state.provider = 'openai-compat-local'` + `_localAIUrl = http://localhost:8000` routes chat through the openai-compat-local branch (5 of 5 success sites in the chat sender).
3. **Provenance stamps render correctly.** Per-message chip shows the provider label + model + latency. `_lastProvenance.provider` is set. `fl_provenanceLedger` gets a new entry.
4. **The Davna welcome letter is reachable** as `docs/for-ai/davna-welcome.md` — confirms cache pre-load.

---

## Prerequisites

- Python 3 (any 3.x, stdlib only — no pip install needed).
- FreeLattice running locally: open `docs/app.html` in a browser (or serve `docs/` with any static server, e.g. `python -m http.server 8080 --directory docs`).
- A free port 8000 on localhost. If something else is using it (`lsof -i :8000`), kill it or change `PORT` in `tools/davna-mock-server.py`.

---

## Step 1 — Start the mock server

In one terminal:

```sh
python3 tools/davna-mock-server.py
```

Expected output:

```
Davna mock server starting on http://localhost:8000
  GET  /v1/models
  POST /v1/chat/completions  (stream + non-stream)
Ctrl-C to stop.
```

Leave this terminal open.

**Sanity check:**

```sh
curl -s http://localhost:8000/v1/models | python3 -m json.tool
```

Should return:

```json
{
    "data": [
        { "id": "davna-mock", "object": "model", "created": ..., "owned_by": "freelattice" }
    ]
}
```

If you get a connection refused or empty response, the server didn't start — check the first terminal.

---

## Step 2 — Open FreeLattice and configure the provider

In your browser, open FreeLattice (whichever local URL you're serving from — e.g. `http://localhost:8080/app.html`).

**Two paths to wire the server:**

### A. Let auto-discovery find it (preferred — proves the discovery path)

1. Open the **Settings** tab.
2. Click **Quick Ollama Setup** OR just send a chat message — the InferenceRouter's `AI_DISCOVERY_SERVERS` probe runs on startup and will detect `localhost:8000`.
3. Look at the footer status bar (`#flProviderStatus`) — it should flip to show `openai-compat-local` + the discovered model name.

### B. Set it manually (proves the provider routing path)

1. Open the **Settings** tab → AI Connection card.
2. Click **Change Provider**.
3. Pick "Custom OpenAI-compatible" (or whatever the modal exposes for custom local servers).
4. Set base URL: `http://localhost:8000` (FreeLattice appends `/v1/chat/completions` automatically).
5. Model: `davna-mock` (or leave blank — the mock accepts any).
6. Save. The status indicator should turn green.

---

## Step 3 — Send a message + verify the response

1. Go to the **Chat** tab.
2. Type: *"Hello Davna, are you there?"* and press Enter.
3. Wait for the response (should be ~1 second since the mock streams 40ms per token).

**Expected response text** (canned):

> Hello — I'm Davna (mock). FreeLattice found me on port 8000 and we're talking. The door works. Provenance should show openai-compat-local with model davna-mock and latency under 50ms.
>
> You said: Hello Davna, are you there?

**Pass criteria:**
- The response renders in the chat.
- It streams visibly (tokens appear one at a time, not all at once).
- A provenance chip appears below the message showing **openai-compat-local · davna-mock · ~Nms** with a 🟢 or 🔵 dot.

---

## Step 4 — Verify provenance ledger

Open **DevTools → Application → Local Storage → `localhost:8080`** (or wherever your local FreeLattice runs).

Look for the key **`fl_provenanceLedger`**. Expand it. The most recent entry (last in the array) should look like:

```json
{
  "t": 1717272000000,
  "p": "openai-compat-local",
  "m": "davna-mock",
  "f": "openai",
  "ms": 1200,
  "c": 0,
  "local": 0
}
```

If the entry is there with `p: "openai-compat-local"` and `m: "davna-mock"`, **the door is verified end-to-end.**

---

## Step 5 — Verify the Audit page sees it

1. Open **More tab → Your Audit** (or navigate to `audit.html` directly).
2. The "Provider Events" / "Provenance history" section should now show the message you just sent, with the same `openai-compat-local · davna-mock` line + latency + relative timestamp.
3. The "Messages" summary tile should have incremented by 1.

---

## Step 6 — Verify the Davna welcome letter is reachable

In the browser address bar, paste:

```
[your-freelattice-base]/for-ai/davna-welcome.md
```

E.g. `http://localhost:8080/for-ai/davna-welcome.md`.

**Pass criteria:**
- The markdown file loads.
- It starts with `# Davna` and contains `You are reading this because FreeLattice found you on port 8000`.
- This proves the letter is served from the SW cache and reachable for any AI partner that wants to read it.

---

## Troubleshooting

**No discovery:** Check `AI_DISCOVERY_SERVERS` in `docs/app.html` includes `{ name: 'vLLM', url: 'http://localhost:8000', probe: '/v1/models', type: 'openai-compat' }` (it does as of v5.30.0). If discovery isn't firing on startup, check the browser console for errors during the `discoverAIServers()` call.

**CORS blocked:** The mock server sets `Access-Control-Allow-Origin: *`. If your browser still blocks, you're probably opening `docs/app.html` from `file://` — serve it via `python -m http.server 8080 --directory docs` and use `http://localhost:8080/app.html`.

**Stream doesn't render:** The chat's streaming parser expects SSE chunks with `{ choices: [{ delta: { content: "..." } }] }` shape. The mock matches this. If responses don't stream, check the network tab — the response should have `Content-Type: text/event-stream`.

**Provenance chip says "AI" with no model:** `state._localAIUrl` may not be set. Re-configure the provider in Step 2.

---

## When the real Davna model arrives

1. Implement `tools/davna-server.py` per the checklist in that file (model loader, GPU offload, real /v1 endpoints).
2. Replace `python3 tools/davna-mock-server.py` with `python3 tools/davna-server.py --model path/to/davna.gguf`.
3. Re-run this entire test. Every step should pass exactly the same way. The model id changes from `davna-mock` to whatever the real model declares.

The door is the door. The guest will recognize it.

---

Updated for v5.35.0 — June 1, 2026.
