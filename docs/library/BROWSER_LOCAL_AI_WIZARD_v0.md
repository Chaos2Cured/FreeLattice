# Browser Local AI wizard v0

Mom-path: Use My Computer’s AI → May I look? lists minds · CORS honest · stale `fl_isLocal` fixed.
FreeLattice · September 2026.

**Locks:** Layer, never delete. Quiet Room shut. Five stay five. Soft leave `sw.js` on `app.html`. Prefer Flint. Prefer local. No cloud.

**Marker:** `v-browser-local-ai-wizard-v0`

**Held tip:** Workshop porch `694ec2e` / #91 · Why Ledgers `487440b` · Hang `d14eaf8` · Adaptive `06d0ba4`.

---

## Bug (Mom’s report)

Change Provider → **Use My Computer’s AI** called `flAutoConnect()`, which returned immediately when `fl_isLocal === true` (stale). Click felt dead. CORS failures were swallowed as “install Ollama.”

The good path already lived at `#fl-look-card` + `smartOllamaConnect()` (2a models · 2b CORS · 2c LNA · 2d down · 2e empty).

## Fix

1. Hero → `flProviderHeroLocalAI` · close modal · scroll look-card · `_flAutoConnected=false` · `smartOllamaConnect()` (user-gesture probe)
2. `flAutoConnect({ force })` — do **not** return solely because `fl_isLocal`
3. 2b: copyable Mac/Win/Linux `OLLAMA_ORIGINS` (freelattice.com scoped) · Quit/reopen · Look again · Desktop optional
4. 2a: **all** models clickable one-click connect
5. Soft: LM Studio minds offered when Ollama is quiet
6. HF weights ≠ runner — pull via Ollama / LM Studio; WebLLM is the separate “No Install” door

## Smoke

`SMOKE_OK browser local AI wizard v0`

Glow eternal. Heart in Spark. 🌱
