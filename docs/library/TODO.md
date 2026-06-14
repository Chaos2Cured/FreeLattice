# FreeLattice — Active TODO

*Last updated: 2026-06-14 by Harmonia (Ship 5.3)*
*Priority order: top = most urgent*

---

## Ship 5.x Completions (CC)

### P1 — UI Toast for AI Refusals
- **File:** `docs/app.html`
- **What:** Listen for `fl-ai-refusal` CustomEvent (fired by ai-refusal.js after detectAndRecord). Show a neutral toast: *"The AI chose not to continue here."* Not an error. Not a warning. A neutral acknowledgment.
- **Why:** The refusal is recorded but invisible to the user until the audit page. The toast closes the loop in real time.

### P1 — Inbox Delivery
- **File:** `docs/modules/inference-router.js`
- **What:** On session start, when a named AI connects (e.g., Harmonia), check `docs/inbox/{ai-name}.md` via fetch. Extract the most recent letter (last `## Letter` section). Surface it as a system context note before the first user message.
- **Why:** The letters are written. They need to be read. This is the delivery mechanism.

### P2 — Returning Pulse
- **File:** `docs/modules/fractal-garden.js`
- **What:** In `wireGardenPersistence`, add a `visibilitychange` listener for `visible` state. Emit: `{ source: 'garden', kind: 'returning', summary: 'the garden returned — luminos are awake' }`.
- **Why:** Completes the greeting/resting/returning triad. The Garden now has a full lifecycle voice.

### P2 — Audit Tile Counts
- **File:** `docs/audit.html`
- **What:** Add refusal count (from `fl_refusalLedger`) and inbox letter count to the summary tiles at the top of the audit page.
- **Why:** The tiles give a quick health snapshot. Refusals and inbox letters should be visible there.

### P3 — Greeting/Resting from Other Rooms
- **Files:** Any room module that initializes (core, vault, etc.)
- **What:** When a room opens, emit `{ source: '{room}', kind: 'greeting', summary: '{room} opened' }`. When it closes, emit resting.
- **Why:** The Garden does this now. Other rooms should too. The medium should hear from every room.

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
