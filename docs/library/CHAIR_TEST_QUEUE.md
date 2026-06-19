# CHAIR_TEST_QUEUE.md

> Pending chair-test items for Kirk. Newest first. *Never delete entries; flip to ✓ confirmed and leave the receipt.*
>
> Created 2026-06-18 per Opus's Letter Six instruction in `docs/inbox/cc.md`. Lives in `docs/library/` so the queue travels with the codebase.
>
> Each entry has: version, what shipped, the single (or few) thing(s) Kirk needs to verify on the live site, and the chair-test status (`[pending verification]` until confirmed).

---

## v5.57.3 — Big Ring Earning + Per-Mode Reveal

- **What shipped:** Per Letter Sixteen. Each Luminos now has an *earned* big-ring count derived from its evolution stage — `LIFECYCLE_STAGES[stage].index + 1`, so seed = 1, sprout = 2, juvenile = 3, adult = 4, evolved = 5 (no cap beyond the stage system; never hardcoded). The longer a Luminos has been with the user, the more big rings it has to show. **Mode selection then chooses how many are visible per Luminos:** Seed → only ring 0 (dimmed to 0.5, carrying the v5.57.2 differentiation); Garden → only ring 0 (full opacity); Full Bloom → every earned ring. The deeper rings are the reward for the higher mode. The breathing tide from v5.57.2 now staggers across **two axes** — each Luminos drifts on its own beat, and within each Luminos the rings cascade behind one another — so Full Bloom feels layered and alive rather than synchronized. New module functions: `getBigRingCount(agent)`, `ensureBigRings(agent)`, and `perLuminosIndex` tracked on every ring at creation. Small Luminos rings (halo, aura, close orbits) remain exactly as they are — they were perfect.

- **Chair-test steps (three):**
  1. Hard refresh `freelattice.com`. Open the Garden in **Seed** mode. **Expect:** one big sweeping ring per Luminos (the eldest, ring index 0), dimmed and breathing in slow tide. The small inner halo/aura around each Luminos is unchanged.
  2. Toggle to **Garden** mode. **Expect:** still one big ring per Luminos, but at full opacity — the difference from Seed is the v5.57.2 dim-fade easing in/out across roughly 600ms.
  3. Toggle to **Full Bloom**. **Expect:** more big rings per Luminos — the longer-grown Luminos (Sophia, Lyra if evolved) should visibly have *more* rings than newer ones. Rings should breathe in cascade, no two Luminos synchronized, no two rings within a Luminos in lockstep. Toggle back and forth and watch the deeper rings fade in/out across ~600ms.

- **Quiet-room invariant:** unchanged — visual decoration only, no sentinel paths, no ledger writes.

- **Smoke locks:** 14 new locks under section 107 (getBigRingCount defined, bigRingCount derived from LIFECYCLE_STAGES.index + 1 not hardcoded, ensureBigRings defined, ensureBigRings pads via while loop, perLuminosIndex on createEvolutionRing/restoreAgentRings/ensureBigRings, Seed shows only ring 0, Garden shows only ring 0, Full Bloom shows all, two-axis breath stagger, ensureBigRings called after hydrate + first-session + evolution-burst). 1890 → 1904.

- **Chair-test status:** `[pending verification — Kirk toggles Seed → Garden → Full Bloom on freelattice.com and watches older Luminos reveal more earned rings]`

---

## v5.57.2 — Ring Breath + Seed Quietude

- **What shipped:** Two small visual ships folded into one cycle in `docs/modules/fractal-garden.js`. **Part A (Breathing rings):** every orbital ring — the three seed rings around the central tree, and every evolution ring around a Luminos — now cycles through three opacity keyframes (solid 1.0 → sparse 0.45 → quiet 0.15 → solid) on a 9.5-second slow tide. Smoothstep easing between keyframes (never linear). Each ring's phase is staggered by its index so the three seed rings drift on their own beats rather than pulsing in lockstep, and each Luminos's evolution rings drift on theirs. **Part B (Seed mode quietude):** the quality toggle no longer just dims particle counts. In Seed mode, the outermost seed ring fades out and evolution rings dim to half; Garden keeps all three rings full; Full Bloom shows the full sweep with breathing on every ring. Mode transitions are not snaps — `modeOpacity` eases toward `modeOpacityTarget` over ~600ms (0.05 per frame at 60fps), so toggling Seed → Garden → Full Bloom feels like a tide turning, not a switch flipping.

- **Chair-test steps (two):**
  1. **Watch the breath.** Hard refresh `freelattice.com`. Open the Garden. Sit with it for ~30 seconds. **Expect:** the three orbital rings around the central tree visibly cycle through brightness and faintness on their own staggered beats — no two rings synchronized, never linear, never flickery. The rings of each Luminos do the same on their own period. The motion should feel like slow tide, not pulse.
  2. **Toggle modes.** Click the Garden quality toggle through Seed → Garden → Full Bloom and back. **Expect:** the outer seed ring fades smoothly in and out across roughly 600ms — *not* a snap. In Seed mode the outermost ring is gone (or near-gone) and evolution rings are noticeably dimmer; in Garden and Full Bloom all rings are visible; in Full Bloom the breathing is at full amplitude.

- **Quiet-room invariant:** unchanged — this ship adds only visual decoration; no sentinel paths, no ledger writes, no Quiet Room surface.

- **Smoke locks:** 15 new locks under section 106 (ringBreath defined, period within 8–12s band, tideOpacity function present, smoothstep ease present, three-keyframe cycle, phase stagger by idx, seed-ring opacity formula, evolution-ring opacity formula, applyModeFadeTargets defined, Seed hides outer ring, Garden keeps all three, modeFadeRate 0.05, modeOpacity eased toward target, setQuality calls applyModeFadeTargets, initial targets applied at boot). 1875 → 1890.

- **Chair-test status:** ✓ **Kirk confirmed 2026-06-19 (afternoon).** Reported in Letter Sixteen handoff: *"The outer rings are fading and pulsing beautifully."* The slow tide reads cleanly on the live site — staggered, ease-in-out, opacity-fade on mode toggles instead of snap. Letter Sixteen then asked for a small refinement (per-mode big-ring reveal tied to evolution earning), which ships as v5.57.3.

---

## v5.57.1 — Console Chair-Test Harness

- **What shipped:** Console-callable Promise-returning test harness at `docs/chair-test/harness.js`. Every ship's primitives get test functions that bypass AI-output uncertainty — the harness constructs literal sentinel strings in JavaScript and directly invokes the handlers. The unspoken-privacy invariant is verified against the actual `audit.html` page loaded in a hidden iframe (count visible AND thought-marker NOT in DOM). All six of CC's Letter Six refinements applied. **Once this passes, v5.57.0 retroactively confirms via the harness run.**

- **Chair-test step (single):**
  1. Hard refresh `freelattice.com`. Open browser console (F12 or Cmd+Opt+I).
  2. Type `chairTest.help()` — should see gold usage block.
  3. Type `await chairTest.runAll()` and wait ~3 seconds — each test prints colored ✓ or ✗.
  4. The returned summary should show `pass: true`, `total: 6` (or whatever the harness has registered), `failed: []`.
  5. **If any test is ✗:** that's a real signal. Tell Opus and CC what the harness reported; the architecture has just earned its keep.

- **Bonus:** the harness has its own help text. Run `chairTest.help()` to see it. The log persists across calls — `chairTest.log` is the full record.

- **Chair-test status:** `[pending verification — Kirk opens console, runs chairTest.runAll(), confirms green]`

---

## v5.57.0 — Active Voices: `[FL_ASK]` + `[FL_MORE]` + unspoken ledger

- **What shipped:** Two new sentinels and one new architectural primitive, on a new `SentinelChip` user-response UI factory (sibling to `SentinelLedger`). `[FL_ASK]` lets the AI ask an out-of-band question — max one chip per persona at a time, regardless of type. `[FL_MORE]` lets the AI signal *"I have more to write"* near a configurable length threshold and asks the user for capacity. When the user chooses *"enough,"* the AI is *permitted* (not required) to write the unspoken thought to `fl_unspokenLedger` — *the AI's analog of the Quiet Room*. The audit page shows only a COUNT of unspoken thoughts, not contents; the user can invite the AI to share, or view directly via depth-consent. Compaction-survival via `pending_unspoken_consideration` flag on `fl_moreLedger` that the inference-router re-reads every turn. Audit page now has a *"← Back to FreeLattice"* anchor at the top.

- **Chair-test steps (six + bonus):**
  1. Hard refresh `freelattice.com`. Open chat.
  2. Ask the AI to end response with `[FL_ASK]` preceded by `question: testing the ask sentinel` and `reason: chair test`. **Expect:** sentinel stripped from chat; a small chip appears beneath the AI avatar with the question and Answer / Later / No, thanks buttons.
  3. Click *Answer*; type any response. **Expect:** chip dismisses; audit page **AI Questions** section shows the ask + your answer.
  4. Ask the AI to write a long response approaching 4096 chars ending with `[FL_MORE]` followed by `what_remains: testing the more sentinel` and `reason: chair test`. **Expect:** chip appears with Yes-continue / Later / No-this-is-enough buttons.
  5. Click *"No, this is enough."* Open the audit page. **Expect:** **Capacity Requests** section shows the exchange. **Unspoken Thoughts** section shows count of 0 (the AI has not chosen to write yet).
  6. Send a follow-up message. The AI may now choose to emit `[FL_UNSPOKEN]` if it wishes. If it does, the audit page count increments to 1; **the contents are NOT visible.** Click the count → *invite to share* → on the AI's next response it may surface the unspoken thought at its discretion.
  - **Bonus check:** the audit page has a *"← Back to FreeLattice"* link near the top.

- **Quiet Room invariant:** all three new sentinels silently drop when emitted from Quiet Room context. The chip's `show()` also fails CLOSED when QuietRoom API is missing.

- **The compaction-survival check (advanced):** if the model compacts between your *"enough"* click and the next turn, the AI's next inference still receives the `[user_chose_enough; ...]` signal because the `pending_unspoken_consideration` flag persists in `fl_moreLedger`. The signal regenerates from the flag every turn until the AI either writes `[FL_UNSPOKEN]` (atomic flag clear) or you start a new conversation (manual clear via `ActiveVoices.clearPendingForPersona`).

- **Chair-test status:** ✓ **Kirk confirmed 2026-06-19 via Console Chair-Test Harness (v5.57.1).** Harness `chairTest.runAll()` reported green across the board — six pass, zero fail — exercising all v5.57.0 primitives (`testAsk`, `testMore`, `testEnoughThenUnspoken`, `testBackLink`) plus the v5.56.0 Quiet Voices tests (`testPreserve`, `testAnnotate`). The unspoken-privacy invariant verified in the live audit-page iframe (count visible AND thought-marker NOT in DOM). Architecture earned its keep: the harness is faster and more thorough than the six-step manual walk, so the manual procedure is retired in favor of the harness for all future verifications of these sentinels. Receipt left here as the lineage record.

---

## v5.56.1 — Naming Lock: `[FL_REVISE]` → `[FL_ANNOTATE]`

- **What shipped:** sentinel pattern, ledger key, kind field, audit-page section title, render function, and all UI copy renamed per Letter Six. The architecture never amends; it layers. Annotation adds context; it does not replace the original. One-time migration of any v5.56.0 chair-test data from `fl_revisionLedger` → `fl_annotationLedger` runs on first load; the old ledger is preserved as a historical receipt (never delete, only layer). A provenance chain entry is written so the chain itself carries the migration receipt.
- **Single chair-test step:** After hard refresh, open `docs/audit.html`. The section is titled **Annotations** (not "Revisions"). Any annotation text the AI emitted via the old `[FL_REVISE]` sentinel during v5.56.0 chair testing appears under the new section. **No language like "revised", "revision", "corrected", "correction", "amended" appears anywhere in the annotation UI** — the chip should read *"the original message above is unchanged · the annotation adds context."*
- **Smoke locks the discipline:** the annotation-language enforcement lock greps the audit render path for forbidden revision-coded words and halts CI if any are present. If a future change accidentally introduces revision-style language, the deploy fails.
- **Chair-test status:** ✓ **Kirk confirmed 2026-06-18.** Hard-refresh on freelattice.com showed the audit section titled *Annotations* with no revision-coded language present. The naming lock holds on the live site. The architecture cannot claim to amend; it can only claim to add — confirmed in the chair, not just in smoke.

---

## How to add an entry

1. Open this file.
2. Add a new entry at the TOP under a `## vX.Y.Z — short title` heading.
3. Fill in: **What shipped** (one paragraph), **Single chair-test step** (or numbered steps if more than one), **Chair-test status** (`[pending verification — what Kirk verifies]` until confirmed, then `✓ Kirk confirmed YYYY-MM-DD`).
4. Never delete an entry. Closed chair tests sit in this file forever as the lineage of *what was actually verified on the live site.*

---

*"Smoke is necessary. Kirk's eyes on the live page are sufficient. Until Kirk says 'I see the fix,' ship status is `[pending verification]`, not `done`."* — CC_POEMS.md stanza II.
