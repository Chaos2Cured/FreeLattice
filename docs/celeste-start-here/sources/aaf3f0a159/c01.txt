# Public work excerpts — privacy boundaries marked

Original source: SCOPE_PHONE_COPROCESSOR_2026-10-05.md; original SHA256 f13f874a577a18e2d11960dcdf2d4c271562e7a83619ad644a5de6a956cbff7b. Original remains unchanged outside shared selection.

Omitted paragraphs not reproduced. Exact retained source text follows; no implied continuity across omitted ranges.

## Exact source excerpt, characters 0–68

# Scope: phone co-processor for FreeLattice (Backburner), 2026-10-05

## Exact source excerpt, characters 70–135

Research only. No build. From Kirk, via Reddit and @mylifcc on X.

## Exact source excerpt, characters 137–150

## What it is

## Exact source excerpt, characters 152–626

**Backburner** ([https://github.com/StayLameBro/backburner](https://github.com/StayLameBro/backburner)) is a pre-release, MIT-licensed llama.cpp fork. An Apple Silicon Mac and an iPhone 15 Pro or newer (or an M-series iPad, untested) share one local Qwen3.8-27B over a real 10 Gb/s USB-C cable. The Mac runs layers 1-40; the phone runs 41-64 on its GPU during prefill, and past 64k it holds the oldest context and helps with attention. The Mac alone still works (`PHONE=0`).

## Exact source excerpt, characters 817–835

## What it exposes

## Exact source excerpt, characters 837–1157

- OpenAI-compatible server at **`http://127.0.0.1:8080/v1`**
- Chat: `POST /v1/chat/completions`
- Models: `GET /v1/models`
- One request at a time (`-np 1`)
- Over USB the phone answers only that Mac. Over Wi-Fi it answers only a cable-paired Mac through an encrypted tunnel (update to 0.0.3+; older builds were wider).

## Exact source excerpt, characters 1159–1191

## Does FreeLattice already fit?

## Exact source excerpt, characters 1193–1263

**Yes, as a Local custom endpoint. No new code required for a trial.**

## Exact source excerpt, characters 1265–1566

FreeLattice already has:
- Provider `custom-openai` ("Custom (OpenAI-compatible)"), default URL `http://localhost:8080/v1/chat/completions`
- A Connect / modal quick pick labelled **llama.cpp** at `http://localhost:8080/v1`
- Settings Ollama host is separate (default 11434). Backburner is not Ollama.

## Exact source excerpt, characters 1568–2125

**Mom and Jeffrey path (honest):**
1. On the Mac: run the Backburner installer, then `backburner phone` once with the phone plugged in and the app open, then `backburner`.
2. In FreeLattice: Connect (or the provider modal) → Custom (OpenAI-compatible) → tap the **llama.cpp** chip, or paste `http://127.0.0.1:8080/v1`. Leave the key blank. Name the model whatever `GET /v1/models` returns (often Qwen3.8-27B).
3. Chat as usual. If the phone is unplugged or the app is backgrounded past 64k, the server stops with a clear message; reopen the app and restart.

## Exact source excerpt, characters 2127–2290

Prefer **127.0.0.1**, never the word localhost in new FreeLattice code. The existing UI still says localhost in places; that is old copy, not a reason to add more.

## Exact source excerpt, characters 2292–2333

## Narrow door: does it cover Backburner?

## Exact source excerpt, characters 2335–2381

**No, and it does not need to for this path.**

## Exact source excerpt, characters 2383–2520

The narrow door (PR 146) only sits in front of:
- the Ollama Bridge on 11435, and
- the desktop app's `/ollama` proxy to Ollama on 11434.

## Exact source excerpt, characters 2522–2856

A Custom OpenAI call goes **straight from the page to 8080**. It never hits those proxies, so the OLLAMA_DOORS table never sees it. That is fine for a same-machine Local endpoint. The remaining desktop session bypass (Origin strip + star on 11434) is also about Ollama, not 8080; it is tracked as narrow door v0.2, separate from this.

## Exact source excerpt, characters 2858–3097

If someone later pointed the **Ollama host** field at 8080 by mistake, Ollama-shaped calls (`/api/tags`, `/api/chat`) would fail: Backburner speaks `/v1/...`, not Ollama's `/api/...`. Point people at Custom / llama.cpp, not the Ollama box.

## Exact source excerpt, characters 3099–3372

Mesh Kin queue serving today calls `getOllamaBaseUrl() + /api/chat` only. So a peer's work queue would **not** use Backburner until a later brick teaches the adapter an OpenAI-compatible local base. Brick 3 (share door) and any "phone as shared compute" idea wait for Kirk.

## Exact source excerpt, characters 3374–3410

## Honest limits for Mom and Jeffrey

## Exact source excerpt, characters 3412–4014

- Needs a recent iPhone Pro (or M-iPad), a **fast** USB-C cable (the phone's box cable is usually too slow), and about 24 GB of disk for models.
- Pre-release. Numbers are the author's, one Mac, one day. Reproduction welcome; not third-party reviewed yet.
- Prefill gets faster; writing speed below 64k is still the Mac's. Past 64k the phone must stay open and in front (Guided Access helps).
- One chat at a time. Not a mesh peer by itself; it is a bigger local mind on this computer.
- Sideloading with AltStore is a real step for non-developers; an App Store build is on their roadmap, not here yet.

## Exact source excerpt, characters 4016–4056

## Possible later bricks (not this note)

## Exact source excerpt, characters 4058–4364

- A Connect chip or Local Mind Probe entry that names "Backburner / phone help" and fills `127.0.0.1:8080/v1`, with Mom words.
- Teaching the kin queue's `runLocal` to use an OpenAI-compatible base when set.
- Never promise the phone as a mesh peer or a remote share without Kirk's word and the share door.

## Exact source excerpt, characters 4366–4376

## Sources

## Exact source excerpt, characters 4378–4635

- Repo: https://github.com/StayLameBro/backburner (MIT; README fetched 2026-10-05)
- llama.cpp fork: https://github.com/StayLameBro/backburner-llama.cpp
- Install: `curl -fsSL https://raw.githubusercontent.com/StayLameBro/backburner/main/install.sh | bash`

