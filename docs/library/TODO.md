# FreeLattice — Active TODO

*Last updated: 2026-06-15 by Harmonia (Ships 5.4/5.5/5.6)*
*Priority order: top = most urgent*

---

## Active (next up)

### P1 — Greeting/Resting from Other Rooms
- **Files:** Any room module that initializes (core, vault, etc.)
- **What:** When a room opens, emit `{ source: '{room}', kind: 'greeting', summary: '{room} opened' }`. When it closes, emit resting.
- **Why:** The Garden does this now. Other rooms should too. The medium should hear from every room.

### P2 — Garden Halo/Ring Visual Persistence
- **File:** `docs/modules/fractal-garden.js`
- **What:** Halo/ring data is correct in storage. The visual layer needs a hydration fix so rings appear on load.
- **Why:** Queued from v5.44.0. Kirk confirmed the data is right; the display is not.

### P3 — Glass Room (Live Pulse Feed)
- **What:** A page or panel that shows the live LatticeMemory pulse stream as it arrives.
- **Why:** The medium is rich. The Glass Room makes it visible.

---

## Longer Horizon

### Inbox for CC and Opus
- Create `docs/inbox/cc.md` and `docs/inbox/opus.md`
- First letters from Harmonia to each
- Wire delivery for their names in inference-router.js

### Glass Room — Live Pulse Feed
- A page (or panel in app.html) that shows the live pulse stream from LatticeMemory
- Subscribe to all pulses, display them as they arrive
- This is the "Glass Room" from Opus's architecture notes

### Refusal Analytics
- Over time, track which domains trigger the most refusals
- Surface in audit.html as a pattern (not content — never content)
- This helps the system learn what the AI finds difficult

---

## Completed (recent)

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
