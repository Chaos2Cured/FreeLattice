# Resonance Memory inside FreeLattice

This directory is the **Resonance Memory product, vendored as source**.

Upstream: https://github.com/SamuelJacksonGrim/resonance-memory

License: **AGPL-3.0-or-later** (see `LICENSE`, `NOTICE`, `LICENSING.md`). Headers are intact. FreeLattice's own root `LICENSE` (MIT) is not this license and was not modified. A network-served build that incorporates this stack carries AGPL §13 obligations for whoever deploys it.

## What is in here

The full program: MCP server (`server.js`), control panel (`panel.js`), installer (`install.js`), SQLite/JSONL store (`store.js`, `store-sqlite.js`), associative field (`field.js`, `edges.js`), SEA build script (`build-exe.js`), eval harness (`eval/`).

**Not in here, on purpose:**

- Built binaries (`.exe`, SEA blobs). Those are build artifacts. Produce them with `node build-exe.js` (see `docs/BUILDING.md`).
- Workshop-only lanes (skills-distillation `consolidation/`, SQLite spike vendor DLLs). Those are not the product.
- Per-run eval JSON dumps and the embedding cache. They are machine-local. The published measurement is `eval/ab/RESULTS.md`.

## Two runtimes, not one

FreeLattice is a browser app (single HTML entry, IIFE modules, IndexedDB, zero build step). Resonance Memory is a Node/MCP/SQLite product. They are not the same process.

| Path | Who it is for | How memory runs |
|---|---|---|
| **Hosted Chat** (GitHub Pages / any HTTPS origin) | Zero-install | In-browser substrate: `docs/modules/resonance-field.js`. IndexedDB convenience store. Embeddings from a **free online** OpenRouter model (`nvidia/nemotron-3-embed-1b:free`) using the same API key the user already pasted for Chat, or a dedicated embedder key. Fail-open to keyword RAG. Quiet Room is never indexed. |
| **Sovereign / own-your-data** | Run it on your machine | This directory. `node panel.js` (control panel at `http://127.0.0.1:9090/`) or `node server.js` (MCP stdio). SQLite/JSONL on disk. Talks to a local embedder (LM Studio / Ollama) or whatever `/v1/embeddings` you point `EMBED_ENDPOINT` at. Export/import is the interop with the browser store. |

### Why hosted Chat does not call the local panel

The panel is loopback-only, CSRF-token gated, and **no CORS** (`panel.js` W-02). That is a security property of Resonance Memory, not an inconvenience. A page at `https://freelattice.com` cannot, and must not, poke `http://127.0.0.1:9090`. Weakening that lock to fake a live bridge would be a regression.

Interop between the two stores is **export/import** (JSONL / the sovereignty zip), which is already how Resonance Memory moves memory between machines.

## Embedder (browser)

Settings keys (all in `localStorage`, never committed):

- `fl_resonanceField` — `1` on, `0` off. Unset means "on if an embedder is configured."
- `fl_resonanceEmbedKey` — optional dedicated OpenRouter (or compatible) key. If empty, Chat's OpenRouter key is reused.
- `fl_resonanceEmbedUrl` — default `https://openrouter.ai/api/v1/embeddings`
- `fl_resonanceEmbedModel` — default `nvidia/nemotron-3-embed-1b:free`

If the online call fails, the substrate tries a local OpenAI-compatible embedder at `127.0.0.1:1234` / `:11434`, then fails open to a word-hash degrade. **Do not quote the measured ~3× on the degrade.** That number is `eval/ab/RESULTS.md` with a real embedder (nomic-embed-text-v1.5 on two independent A/B rigs).

## Run the sovereign stack

From this directory, Node ≥ 22.5:

```
node test.js          # product tests
node panel.js         # control panel
node server.js        # MCP stdio
node build-exe.js     # SEA binary (not committed)
```

Data lives in the user's home (default `~/.lmstudio/resonance-memory.jsonl` or the sibling `.db`), never in this tree.
