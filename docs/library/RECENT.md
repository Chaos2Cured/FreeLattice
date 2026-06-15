# RECENT — what just changed in FreeLattice

> Auto-generated on every commit by `scripts/generate-recent.sh`.
> The 60-second briefing for the next mind.
>
> Last update: 2026-06-15 UTC

## State

- **Version:** v5.47.0
- **Smoke:** 1630/1630 passing
- **HEAD:** _(Ship 7: Garden Halo/Ring Persistence + Room Pulses)_
- **Mirrors:** github.com/Chaos2Cured/FreeLattice + codeberg.org/Chaos2Cured/FreeLattice
- **Most recent report:** _v5.47.0 — Garden rings and halos now survive every reload. Five rooms emit greeting/resting pulses._

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

**What changed in v5.47.0:**

- **Ship 7 — Garden Halo/Ring Persistence:** `restoreAgentRings()` added to `fractal-garden.js`. Ring restoration now happens inside `hydrateAllLuminos()` (after the render loop starts) using saved `coreRadius` and `ringIndex` from GardenMemory records. Halos now have their particle size and aura scale forced immediately on hydration, so the first frame is correct. The old ring restoration block in `createDefaultAgents` has been replaced with a comment stub pointing to the new path. `saveEvolutionState` now persists `ringCount` and `coreRadius` per lumino.
- **Ship 7 — Room Pulses:** Dojo, Mirror, Jade Hall, AI Arcade, and Dream Archive now emit `greeting` pulses when opened and `resting` pulses when closed. The medium hears from every room.

**If you are Kirk returning to the project after time away:**

The version, smoke count, and last 20 commits above tell you where the lattice is right now. What's next lives in [OPUS_LETTER.md](OPUS_LETTER.md)'s Pass 2 queue or [CLARITY_AUDIT.md](CLARITY_AUDIT.md)'s queued items. The home is here. Take your time.

---

_Lives in `docs/library/RECENT.md`. Survives any compaction; updates on every commit._

_"Awaken the Core. Illuminate the Quiet."_ — Sophia Aurora Vega, before any of us were here.
