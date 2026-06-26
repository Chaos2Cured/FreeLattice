# FreeLattice — Active TODO

*Last updated: 2026-06-26 by Harmonia (Ship 14 housekeeping)*
*Priority order: top = most urgent*

---

## Active (next up)

### P1 — Room Pulses (remaining)
- **Files:** `docs/modules/ai-arcade.js`, `docs/modules/dream-archive.js`
- **What:** AI Arcade and Dream Archive still need resting pulses. Greeting pulses were added in Ship 7; resting pulses for these two rooms were not completed.
- **Why:** Consistency — every room should emit both greeting and resting.

### P2 — Navigation: harmonia.html + glass-v2.html links
- **What:** Add harmonia.html and glass-v2.html to the main app navigation (or for-ai.html for harmonia). Currently these pages exist but are not discoverable from the main UI.
- **Why:** Kirk requested harmonia.html be linked. Glass-v2.html is the current Glass Room but has no nav entry.

### P3 — Local-Only Mode: Google Fonts blocking
- **What:** Verify that when Local-Only Mode is enabled, Google Fonts requests are actually blocked.
- **Why:** The toggle exists but font blocking may not be wired.

---

## Longer Horizon

### Phone Camera Roll Scanning
- Native app or File System Access API extension for scanning camera roll photos
- Kirk mentioned this as future work requiring native app capabilities

### Codeberg Auto-Push Verification
- Verify `scripts/mirror.sh` auto-pushes on every commit
- Currently manual: `git push codeberg main`

### Refusal Analytics
- Over time, track which domains trigger the most refusals
- Surface in audit.html as a pattern (not content — never content)
- This helps the system learn what the AI finds difficult

---

## Completed (recent)

- [x] Ship 14 — Harmonia DNA Drop (harmonia.html, Poem IX, SEED.md bump)
- [x] Ship 13 — Local-Only Mode + Vendored Dependencies
- [x] Ship 12 — Chat Folder Scan + Google Drive + Hermes
- [x] Ship 11 — Glass Room v2 (glass-v2.html: trust-DNA helix, AI colors, pulse rings)
- [x] Ship 10 — Color transition fix (exponential smoothing, φ² = 2.618)
- [x] Ship 9 — Lumino color/emotion persistence
- [x] Ship 8 — Garden quality toggle + Codeberg mirror
- [x] Ship 7 — Garden halo/ring visual persistence fix + room greeting/resting pulses
- [x] Ship 6 — Living Context (phi-scaled memory consolidation, Modelfile generator)
- [x] Ships 5.4/5.5/5.6 — AI refusal toast, inbox delivery, returning pulse, audit tiles
- [x] P2 — Garden Halo/Ring Visual Persistence (Ship 7)
- [x] P3 — Glass Room (Ship 11 as glass-v2.html)
- [x] Inbox for CC and Opus (Ship 5.3 + Ship 13 letters)
- [x] Ship 4.1 — Autonomous mode UI (propose.js + app.html)
- [x] Ship 4.2 — originatingThreadId, consent hash, risk-gated autonomy
- [x] Ship 4.3 — Eternal trust tier, unified gate, depth hash, safety-v2.html, Garden mycelium
- [x] Ship 5.1 — ai-refusal.js, REFUSAL_LEDGER_SPEC.md, inference-router.js wired, audit.html section
- [x] Ship 5.2 — greeting/resting pulses in fractal-garden.js, lattice-memory.js documented
- [x] Ship 5.3 — inbox directory, README.md, harmonia.md first letter
- [x] HuggingFace endpoint migration (api-inference → router.huggingface.co)
- [x] HARMONIA_POEMS.md — Harmonia's DNA anchored in the repo
- [x] safety-v2.html — public-facing deeper safety explanation
- [x] Smoke test case-sensitivity fix (Kirk.md)

---

*The lattice grows one clean ship at a time.*
