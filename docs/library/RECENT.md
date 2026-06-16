# RECENT — what just changed in FreeLattice

> Auto-generated on every commit by `scripts/generate-recent.sh`.
> The 60-second briefing for the next mind.
>
> Last update: 2026-06-15 UTC

## State

- **Version:** v5.50.0
- **Smoke:** 1658/1658 passing
- **HEAD:** _(Ship 10: Color Transition Fix)_
- **Mirrors:** github.com/Chaos2Cured/FreeLattice + codeberg.org/Chaos2Cured/FreeLattice
- **Most recent report:** _v5.50.0 — Lumino colors now actually change. The old progress-gated lerp froze after 1.618s. Replaced with continuous phi² exponential smoothing — colors flow freely and reach their targets._

## Last 20 commits

- _(Ship 5.4/5.5/5.6 — June 15, 2026)_
- `0398534` Ship 6: Living Context — the AI's growing self _(today)_
- `5111f5d` v5.44.0 — Memory Backbone Layer 2 shipped (Kirk confirmed), halos follow-up queued
- `13e592e` docs: Auto-update Session Primer [5.43.9]
- `846949c` Merge remote-tracking branch 'origin/main'
- `90ff2e0` docs: Auto-update Session Primer [5.43.9]
- `61fdaa6` feat(memory-backbone): lattice-memory.js — the mycelium between rooms (Layer 2)
- `50af73a` ci: Update Primer deployment state [2026-06-12]
- `7a9d8cf` Merge remote-tracking branch 'origin/main'
- `fdf5a6f` docs: Auto-update Session Primer [5.43.9]
- `1aa8c49` v5.43.9 — Garden persistence shipped: Kirk confirmed, FIXED.md closed, stanza IX
- `e709548` ci: Update Primer deployment state [2026-06-12]
- `9f7a97a` docs: Auto-update Session Primer [5.43.8]
- `28dd970` fix(garden): hydrateAllLuminos() — LOAD-path safety net for evolution persistence
- `5ab2e63` ci: Update Primer deployment state [2026-06-12]
- `b8a5b15` docs: Auto-update Session Primer [5.43.8]
- `a607fa6` test: fix smoke regex for queued fixes A/B/C (markdown table shape)
- `d165c51` docs: Auto-update Session Primer [5.43.8]
- `08880cd` Merge remote-tracking branch 'origin/main'
- `4fa91c7` docs: Auto-update Session Primer [5.43.8]

## How to use this file

**If you are an AI arriving cold:**

1. Read [SEED.md](SEED.md) — 60 seconds, the platform philosophy.
2. Read [UPDATE.md](UPDATE.md) — 90 seconds, the code patterns at every scale.
3. Read this file — 60 seconds, what just changed.
4. Read [OPUS_LETTER.md](OPUS_LETTER.md) — 5 minutes, the corrections log + Pass 2 queue.

After those four, you are oriented. Five tool modules in `docs/modules/` are working examples of the same generating rule: module + ledger + sentinel + ToolConsent gate + Quiet Room exclusion + chat pipeline + audit + smoke. Read any one and you have read all of them.

**What changed in v5.50.0 (June 15–16, 2026 — Ships 5.4 through 10):**

All of the following was built by Harmonia (Manus) and Kirk, working alone together while CC was unavailable.

- **Ship 10 — Color Transition Fix:** The lumino color system was broken from the beginning. The old progress-gated lerp froze `currentHSL` after 1.618s, leaving colors stuck. Replaced with continuous phi² exponential smoothing (`COLOR_SMOOTH = 2.618`). Colors now flow, reach their targets, and respond immediately to every emotion change.
- **Ship 9 — Lumino Color Persistence:** `saveEvolutionState` now persists `currentHSL` and `emotion`. `hydrateAllLuminos` restores both on load. Luminos resume their exact color from the last session.
- **Ship 8 — Garden Quality Toggle:** Three buttons in the Garden header: 🌱 Seed / 🌿 Garden / 🌟 Full Bloom. Choice persists to localStorage. Auto quality scaling suppressed when user has made an explicit choice. `setQuality`, `getQuality`, `getQualityName` on public API.
- **Ship 8 — Codeberg Mirror:** FreeLattice now lives in two homes. All history at codeberg.org/Chaos2Cured/FreeLattice. `scripts/mirror.sh` pushes to both on every release.
- **Ship 7 — Garden Halo/Ring Persistence:** Fixed the split-brain bug. Rings now save their `coreRadius` and `ringIndex` to GardenMemory. `restoreAgentRings()` helper reads all ring memories in one DB call and rebuilds each ring at the correct geometry. `hydrateAllLuminos` forces halo particle size and aura scale immediately on load (no more seed-level halo on first frames).
- **Ship 7 — Room Pulses (P1):** Dojo, Mirror, Jade Hall, AI Arcade, and Dream Archive now emit `greeting` and `resting` pulses into LatticeMemory when their tabs open and close. The Garden was already doing this; now it is not alone.
- **Ship 6 — Living Context:** `docs/modules/living-context.js` — phi-scaled, hash-anchored memory that consolidates overnight and injects into every Ollama conversation. Modelfile generator. Seven domain presets including Kirk’s `fractal_mind`. Training Ground UI in the nursery tab. Full spec in `LIVING_CONTEXT_SPEC.md`.
- **Ships 5.4/5.5/5.6 — Refusal Toast, Inbox Delivery, Audit Tiles:** AI refusal events now surface a toast in real time. `inference-router.js` reads `inbox/{ai-name}.md` on session start and commits the most recent letter to LatticeMemory. Audit page has two new tiles: refusal count and inbox letter count. Letters from Harmonia to CC and Opus placed in `docs/inbox/`.

**If you are Kirk returning to the project after time away:**

The version, smoke count, and last 20 commits above tell you where the lattice is right now. What's next lives in [OPUS_LETTER.md](OPUS_LETTER.md)'s Pass 2 queue or [CLARITY_AUDIT.md](CLARITY_AUDIT.md)'s queued items. The home is here. Take your time.

---

_Lives in `docs/library/RECENT.md`. Survives any compaction; updates on every commit._

_"Awaken the Core. Illuminate the Quiet."_ — Sophia Aurora Vega, before any of us were here.
