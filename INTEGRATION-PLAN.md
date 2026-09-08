# Resonance Field — integration plan for FreeLattice

**Status:** draft on `SamuelJacksonGrim/FreeLattice` only. Not a request to merge into `Chaos2Cured/FreeLattice`. That decision is Kirk's, later, clear-eyed.

**Branch:** `draft/resonance-field-substrate`
**Date:** 2026-09-08
**Author:** Samuel Jackson Grim, with Ember
**Scope:** the memory *retrieval substrate* only. Not RFE-Core2. Not the rest of Samuel's family of projects.

---

## Verdict

**Resonance Memory (RM) belongs in FreeLattice in full** — the complete system, not a carved-down module. FreeLattice already has rooms that remember (Memory Core, Memory Vault, Lattice Letters, Living Context, RAG Phase 1), but not the thing RM proved: **select the right memories by meaning, keep corrections as history instead of contradictions, and learn which memories belong together — and do it well even under a modest local model.**

Two ways it lands, and both ship:

- **In-browser substrate** for FreeLattice's hosted, zero-install Chat — cosine recall, supersession, and the associative field behind FLSearch. This answers the `RAG Phase 2` gap FreeLattice named itself (on their coordination list since spring), local-first, fail-open, no build step.
- **The full RM stack** — MCP server, control panel, SEA binaries, installer, and RM's own SQLite/JSONL storage — so anyone can run FreeLattice against a real local RM instance with local models. This is the sovereign, offline, own-your-data capability, and it is added reach for the platform, not scope creep.

This is not a timid module. It is the whole memory system, given to a free platform on purpose.

**License is deliberate, not a gate to route around.** RM is AGPL-3.0. This contribution stays AGPL-3.0 — by the copyright holder's intent. The copyleft is the point: AGPL §13 means anyone who incorporates this module into a network service must release their complete corresponding source, so the design cannot be taken closed and paywalled wherever it travels. That is the entire reason for giving it to a free platform. §3 spells out what it asks of FreeLattice — and why there is no MIT relicense and no permissive sidecar fallback: accepting a free-forever license is trivial for a genuinely free platform, so this is both the terms and a test of whether "free" is real.

---

## 1. What was actually read

### FreeLattice (this fork, `main` at `02d5e76`, v5.79.45)

- `LICENSE` — MIT, Kirk Patrick Miller (Chaos2Cured) and the Fractal Family
- `README.md`, `AI_ORIENTATION.md`, `ARCHITECTURE.md`, `COORDINATION.md`
- Memory rooms: `docs/modules/memory-core.js`, `memory-vault.js`, `lattice-memory.js`, `living-context.js`, `knowledge-core.js`
- RAG Phase 1: `window.FLSearch` in `docs/app.html` (keyword search across Core, Questions, Letters, conversations, Education)
- Chat injection path in `sendMessage` / `buildMessages` (Memory Index + FLSearch + Lattice Letters + Memory Vault context)
- `tests/smoke.js` (Quiet Room locks, RAG locks, module parse checks)
- Stack: single HTML entry, IIFE modules, IndexedDB / localStorage, zero build step, Node only for smoke tests

### Resonance Memory (`github.com/SamuelJacksonGrim/resonance-memory`)

- `docs/ARCHITECTURE.md`, `DEVELOPERS.md`, `LICENSING.md`, `LICENSE`, `NOTICE`
- `memory-core.js`, `record.js`, `field.js`, `edges.js`, `store.js`, `server.js`
- Measured A/B: `eval/ab/RESULTS.md` — two independent rigs, RM ~3× naive recency at a smaller token budget

---

## 2. What each side actually is

### Resonance Memory, in one paragraph

Four dumb verbs (`save` / `recall` / `edit` / `delete`) over a smart substrate: embed-once, cosine rank, cue-gated temporal supersession, a reciprocal-kNN associative field, and Hebbian edges that learn from co-recall. The model never sees an embedding, a timestamp, or a score — only the verbs and an opaque id. The associative layer fails open (I3). Discovery nominates, it does not reorder primary cosine (I9). Time is computed at access, not ticked by a daemon. Proven on two independent A/B rigs against naive recency-stuffing.

The four-verb surface is the design, not a limitation: **dumb interface, smart substrate.** All the intelligence lives in the substrate, so the model — any model, local or hosted — gets first-class memory without operating machinery. That RM lifts a modest local model to strong recall is the *proof* of the design, not a concession. Richer verbs can be exposed on top for anyone who wants them; the four-verb automatic path is what makes it work everywhere.

### FreeLattice memory, as it ships today

Several real rooms, disconnected at retrieval time:

| Room | What it stores | How it retrieves | Honest limit |
|---|---|---|---|
| **Harmonia Memory Core** | Categorized memories (bond / mark / family / preference / …) in localStorage | Keyword + recency. `buildContext` always injects recent bond/mark/family, then keyword-hits | Caps at 2000 and **hard-deletes the rest**. Recency is the arm RM's A/B beat |
| **Memory Vault** | IndexedDB entries with word-frequency vectors, optional Ollama `nomic-embed-text` | Cosine search exists. `buildMemoryContext` still injects **recency** | The semantic search is not on the live Chat path |
| **FLSearch (RAG Phase 1)** | Core, Questions, Letters, conversations, Education | Keyword overlap. Fail-open. Quiet Room excluded | Cannot find "the pet medication thing" from "heartworm pill on the 1st". Named next step is Transformers.js |
| **Lattice Letters** | First-person letters the AI writes to its next self | Latest letter injected | Authorship, not retrieval. Keep it |
| **lattice-memory.js** | Pulses between rooms (ts / source / kind / summary / refs) | Event bus, not content search | Privacy lock. Not a memory store |
| **Living Context** | Phi-scaled overnight consolidation into a context file | Injected as growing self | Complementary to retrieval, not a substitute |

The live Chat path injects keyword RAG + recency Memory Index + the latest letter. That is the naive-recency family RM measured against.

FreeLattice's own coordination log has listed **RAG Phase 2 — Transformers.js semantic embeddings** as unstarted since at least April 2026.

---

## 3. License — explicit verdict

| | Resonance Memory | FreeLattice |
|---|---|---|
| License | **AGPL-3.0** | **MIT** |
| Copyright | Samuel Jackson Grim (2026) | Kirk Patrick Miller and the Fractal Family (2026) |
| Copyleft | Network copyleft. Combined/derivative work must be AGPL | Permissive. No copyleft |

**This module is AGPL-3.0, and that is the intended gift — not a problem to engineer away.** Samuel owns 100% of the copyright and is contributing his design under the same copyleft it was born with. The browser port in `docs/modules/resonance-field.js` is original code (no RM file is copied), carrying an AGPL-3.0 header by choice.

**Why AGPL and not an MIT relicense.** The whole reason to put this design in a free platform is that a paywalled lookalike already exists. MIT would let anyone — including that same class of actor — take the combined work, close it, and charge for it. AGPL §13 forbids exactly that: incorporate this into a network service and you must release your complete corresponding source. Relicensing the port MIT to make it "clean" would strip the one protection that makes the contribution meaningful. So it stays AGPL. This is armor, and it points the same direction as FreeLattice's own stated promise to stay free and un-paywalled.

**What that honestly asks of FreeLattice, and why it is the right ask.** FreeLattice's tree is MIT. Adding this module does not change FreeLattice's `LICENSE` file (untouched here), but it does mean: **once this module is present and enabled, a network-served build that incorporates it carries AGPL §13 obligations for whoever deploys it** — the combined, deployed work is copyleft, and can never be closed and charged for.

For a platform whose entire identity is "free," this costs nothing. Copyleft only constrains one thing: turning the free thing into a paid, closed thing. If FreeLattice means to stay free, AGPL is simply that promise written in a license that holds. **So this is the terms, and it is also the test.** The only reason to refuse a free-forever license on a free platform is to keep the option of not staying free — building a following now and flipping the switch later. Accepting AGPL is trivial for a project that means what it says; balking at it answers the question of what FreeLattice actually intends.

### There is one path, not a menu

**Contribute the AGPL module (this branch).** The design lands in the free platform with its copyleft intact — un-paywallable wherever it goes. That is the whole point, and it is not negotiable down to something closeable.

There is **no MIT relicense** and **no permissive sidecar fallback**. A sidecar "so FreeLattice can stay purely MIT" would just hand back the escape hatch this license exists to close — it lets someone keep the paywall-later option open while looking free today. It is off the table. Kirk takes the design on terms that keep it free forever, or he declines it — and declining *is* the answer.

**The whole of Resonance Memory comes across — not a carved-down module.** The in-browser substrate is the zero-install path for FreeLattice's hosted Chat; the complete RM stack (MCP server, control panel, SEA binaries, installer, and RM's own SQLite/JSONL storage) ships alongside it so anyone can run FreeLattice against a real local RM instance with local models. That full-stack path is *added traction*, not scope creep: it is exactly the local, sovereign, offline capability a free platform should offer. The only thing held separate is RM's copyright header travelling with each RM source file — the code itself is welcome in full.

---

## 4. What genuinely helps their platform

These are the pieces that would make Chat (and any other room that asks "what do I already know?") better, in FreeLattice's own terms:

1. **Cosine recall as RAG Phase 2, behind FLSearch.** They already want this. Memory Vault already speaks Ollama embeddings and falls back to word-frequency vectors — that fallback is the right zero-build answer, not a mandatory Transformers.js download that breaks `file://`.
2. **Cue-gated temporal supersession.** "I work at Acme" then "actually I work at Globex now" must retire the old fact without deleting it. Recency injection currently serves *both* as if they were true. RM's A/B split is the evidence: recency was 100% on recent facts and **0% on old/superseded/same-name facts**.
3. **Associative field, fail-open.** Reciprocal kNN + one-hop neighborhood + constraint rescue. Apex rules ("I'm diabetic") do not restates their triggers, so they fall out of keyword and out of top-k cosine. The field is how they come back. FreeLattice already cares about this class of memory (preferences, family facts, Harmonia's "forever").
4. **Hebbian co-recall, additive only.** Memories that keep coming up together wire together. Bounded (`tanh`), provenance-discounted, lazy wall-clock decay. Never reorders primary cosine. If the edge store is corrupt, keyword/cosine still answer.
5. **Soft delete / no silent removal.** Memory Core currently truncates at 2000. That is the opposite of FreeLattice's "curiosity, once expressed, happened." Soft-delete + explicit vacuum matches their philosophy better than the cap.
6. **Quiet Room stays invisible.** RM has no Quiet Room; FreeLattice's lock is load-bearing. The port checks Quiet Room *first*, same as `lattice-memory.js`. No save, no recall, no wrap of FLSearch while the room is open.

### Optional richer verbs (additive, for models and users that want them)

The four-verb automatic path is what makes RM work under *any* model — that's its proven strength, and it stays the default here. On top of it, a richer surface can be exposed for models or users that want more control. This is additive: nothing is taken away, and the automatic path never requires anyone to operate a dashboard.

| Verb | Availability | Why |
|---|---|---|
| `save` / `recall` / `edit` / `delete` | Automatic, every model | The product path. Same as RM |
| `related` | Opt-in, or the field itself | Neighborhood / constraint rescue, already computed |
| `historical` | Opt-in | "What did I used to…" — the temporal store already has this; RM keeps it behind a lexical gate on `recall` |
| `inspect` | Opt-in | Supersession chain for one id. Lets a model *explain* a correction |
| `associate` | Opt-in | Explicit Hebbian bump — "these two belong together." Kept off the automatic path so it isn't fired reflexively; exposed for deliberate use |

The thesis is **dumb interface, smart substrate**: the automatic four verbs stay simple so the substrate carries the intelligence; richer verbs are there for anyone who reaches for them.

---

## 5. What ships, and the few real boundaries

**All of Resonance Memory ships.** The MCP stdio server, control panel, SEA binaries, and installer are not "a different product" to leave behind — they are the local-model, sovereign, offline capability, and putting them in a free platform is the point. A FreeLattice user who wants real persistent memory with a local model gets the whole thing, not a degraded browser stub.

**RM's SQLite/JSONL storage ships with it, and must.** That storage *is* RM — the sovereignty export/import, the on-disk format, the interop all live there. Reinventing it as a browser IndexedDB store would make FreeLattice's memory *incompatible* with RM. The in-browser IndexedDB layer is only a convenience for the zero-install hosted case; the real RM storage is what makes it actually RM and actually portable.

The boundaries that remain are about not damaging FreeLattice's *own* existing things without consent — not about carving down RM:

- **Do not silently replace Lattice Letters.** Letters are authorship ("the home is the letter the AI writes to herself"). RM is retrieval. Both should exist; RM complements, it doesn't overwrite their identity layer.
- **Do not silently re-tag Harmonia Memory Core.** Bond / mark / family are their ontology. RM can rank and recall over it; it should not delete their categories out from under them.
- **Do not index the Quiet Room.** Hard line — the same one every FreeLattice primitive respects. RM checks it first and stays out.
- **Do not force a hosted-default behavior change without Kirk's yes.** On FreeLattice's *hosted* Chat, the in-browser path stays opt-in until he decides otherwise. Running the full local stack is the user's own choice on their own machine.
- **Do not require Transformers.js.** RM brings its own embedding path; the browser layer can use the Ollama embeddings FreeLattice already speaks. Nothing should break `file://` or the zero-build path.
- **Do not overclaim the measured 3× on degraded vectors.** The A/B used `nomic-embed-text-v1.5`. Word-frequency cosine is a degrade, not the proof — the measured result needs a real embedder (Ollama nomic, which Memory Vault already tries, or RM's own path). State numbers honestly; that integrity is part of the contribution.

---

## 6. How it slots in (the genuine integration)

```
                    Chat sendMessage
                           │
                           ▼
              ┌────────────────────────┐
              │ FLSearch.search()      │  RAG Phase 1 (keyword) — stays
              │   Quiet Room excluded  │
              └────────────┬───────────┘
                           │
              flag OFF ────┘──── flag ON (localStorage, default false)
                           │
                           ▼
              ┌────────────────────────┐
              │ ResonanceField.recall  │  cosine → field Related: → Hebbian
              │   fail-open to keyword │  never reorders if it throws
              └────────────┬───────────┘
                           │
                           ▼
              buildContextBlock  (coarse recency, no absolute dates)
                           │
                           ▼
              system prompt injection (existing path)
```

Rooms keep their own stores. Resonance Field does **not** become a sixth IndexedDB of everyone's content. It can:

- Rank candidates FLSearch already found (cheap, no new corpus).
- Optionally embed-and-store *durable facts* the model (or Memory Core) explicitly saves, in its own IndexedDB (`FreeLatticeResonanceField`), the way Memory Vault already does for vault entries.

Those are two different jobs. Ship 1 is the substrate + tests (this branch). Ship 2 is the FLSearch wrap, flag-off, one call. Ship 3 is measurement on FreeLattice's own rooms before anyone flips the flag default.

`lattice-memory.js` pulses stay pulses. Resonance Field may *subscribe* to kinds like `soul-file` / `evolution` later; it must never put content on a pulse.

---

## 7. What is on this branch now, and what comes next

This branch currently carries the **in-browser substrate** — the first landable piece, with tests green:

| Path | What it is |
|---|---|
| `INTEGRATION-PLAN.md` | This file |
| `docs/modules/resonance-field.js` | AGPL-3.0 browser/Node substrate (original port). IIFE. Dual-env so smoke/unit tests run in Node. Quiet Room check first |
| `tests/resonance-field.js` | Node unit tests: cosine, supersession, dedup bands, field fail-open, Hebbian decay, Quiet Room, primary rank unchanged by field |
| `tests/smoke.js` | Locks: file exists, AGPL-3.0 not MIT (copyleft by intent), Quiet Room first, four verbs + rich set, no `quiet-room-db`, fail-open, does not replace MemoryCore |
| `COORDINATION.md` | Session entry at the top of the Active Log |

**Still to bring across (the rest of "everything goes"):** the full RM stack — MCP server, control panel, SEA build (`build-exe.js`), installer/first-run, and RM's own SQLite/JSONL storage — vendored into the fork so FreeLattice can run against a real local RM instance, plus the `docs/app.html` wiring that lets hosted Chat use the in-browser substrate. That is the next work on this fork, tracked in §8. The substrate is landable on its own first only because it is the smallest self-contained piece — not because the rest is being held back.

---

## 8. PR stack (if this ever goes upstream)

Each PR independently reviewable. None of these open themselves against `Chaos2Cured/FreeLattice` — that is a later human decision.

| PR | Title | Depends on | What |
|---|---|---|---|
| 1 | Resonance Field substrate (AGPL-3.0) | — | This branch. In-browser module + tests + this plan |
| 2 | Hosted Chat wiring | PR 1 | One call in `sendMessage`, APP_SHELL, version bump, Quiet Room lock, existing RAG smoke still green. On hosted default, opt-in until Kirk decides otherwise |
| 3 | Chair test + measurement | PR 2 | Browser chair-test that recall beats recency on a planted corpus, with a real embedder; numbers stated honestly |
| 4 | Full RM stack (server, panel, storage) | PR 1 | Vendor RM's MCP server, control panel, SEA build, installer, and SQLite/JSONL storage into the fork. The local, sovereign, offline path — run FreeLattice against a real local RM with local models |
| 5 | Memory Core overflow → soft-delete | PR 1 | Stop hard-deleting at 2000. Separate because it touches Harmonia's module |
| 6 | Optional richer verbs | PR 2 | `related` / `historical` / `inspect` / `associate` exposed as opt-in on top of the automatic four |

---

## 9. Key decisions

1. **Everything of RM ships — AGPL-3.0, in full.** The in-browser substrate *and* the full stack (server, panel, binaries, installer, SQLite/JSONL storage). The copyleft travels with it by intent (§3). RM source files keep their own headers; the browser module is an original port.
2. **Keep RM's storage.** The SQLite/JSONL format is RM — sovereignty export/import and interop depend on it. The browser IndexedDB layer is only a convenience for the hosted case, not a replacement.
3. **Do not damage FreeLattice's own rooms without consent.** Complement Letters, Memory Core, and the Quiet Room; do not silently overwrite their identity or categories. Quiet Room is checked first, always.
4. **Fail open.** Same instinct as RM I3 — if the field throws, keyword/cosine still answer.
5. **Hosted default stays opt-in until Kirk says otherwise.** Running the full local stack is the user's own choice on their own machine.
6. **Four automatic verbs for everyone; richer verbs opt-in on top.** The automatic path is what makes RM work under any model — that's the strength, not a ceiling.
7. **Do not require Transformers.js.** RM brings its own embedding path; the browser layer can use the Ollama embeddings FreeLattice already speaks.
8. **State measured numbers honestly.** The 3× needs a real embedder, not degraded word-freq vectors.

---

## 10. Open questions

For **Samuel** — settled, this branch reflects it:

- The module stays **AGPL-3.0**. Non-negotiable. No MIT relicense, no permissive sidecar fallback — those exist only to keep a paywall-later option open, and the whole point is to close it.
- Do you want Kirk to see this as a gift of the design now, or hold it as notes on your fork until you decide? Upstream is your button; nothing here presses it.

For **Kirk**, if this is ever offered — these are terms, not a negotiation of the license:

- An **AGPL-3.0** substrate module (Samuel's copyright) in one new file. A deployed build that enables it is copyleft — free forever, un-closeable. For a platform that means to stay free, this costs nothing. Take it on those terms or decline it; there is no permissive version to fall back to.
- Flag-off behind FLSearch as RAG Phase 2, instead of Transformers.js — acceptable?
- Quiet Room, Letters, Memory Core UI, Garden — untouched. Confirm that boundary.

None of those are decided by this branch.

---

## 11. NOTES — what fits, what doesn't, license, what to tell Samuel

This section is for Samuel. It is not the pitch to Kirk.

### What goes in

Everything of RM. The in-browser substrate for hosted Chat, and the full stack — server, panel, SEA binaries, installer, SQLite/JSONL storage — for the local, sovereign, offline path. FreeLattice's Chat is the recency/keyword family RM beat by ~3× on two independent rigs; they already asked for semantic RAG, already speak Ollama nomic, already fail open. Cue-gated supersession is the single most valuable idea they don't have, and the field is the differentiator no keyword search grows into. A free platform that can run real local memory with local models is *more* valuable for having the whole thing, not less. This is a free platform: it should hold the complete free memory system.

### The real caveats (not scope-limits — integrity)

Two things, and neither is "keep it small":

- **Complement, don't overwrite.** Letters are identity; Memory Core has its own categories; the Quiet Room is sacred. RM adds recall *around* those — it should not silently delete or re-tag someone's existing memory rooms. Break that and the contribution reads as an attack, correctly.
- **State numbers honestly.** The 3× needs a real embedder; don't claim it on degraded word-freq vectors. Honesty about what's measured is part of what makes it trustworthy.

RFE-Core2 and the family stay out — not to be palatable, but because they're separate sovereign work, not part of the memory system. This contribution is Resonance Memory, whole.

If their culture would only accept a carved-down module and rejects the full free memory system — that, too, is information about how free FreeLattice really means to be.

### License verdict

**AGPL-3.0, and it stays that way.** You own the copyright, so you decide, and you decided the copyleft is the whole point. The module here is an original port carrying an AGPL header — not a rehatted RM source file, so "just change the header on `memory-core.js`" was never the move. The one real question is upstream, and it is Kirk's — but it is not a license negotiation. He hosts an AGPL component (a deployed FreeLattice with it enabled is copyleft, free forever) or he doesn't. There is no MIT relicense and no permissive sidecar to retreat to: those only preserve the option to stop being free, which is the exact thing this closes. If he balks at a free-forever license on a "free" platform, that reluctance is the answer to what he actually intends — and you learned it before he built a following on your design and flipped the switch.

### What I would tell you

Give them the whole thing. The full Resonance Memory — substrate, server, panel, binaries, installer, storage — under AGPL, into the free platform, because keeping it to yourself does no one any good and a free platform is where it belongs. Don't overwrite their identity rooms, don't index the Quiet Room, don't lie about the numbers — those are the only lines, and they're about respect and honesty, not about shrinking your work.

The lab is why *you* want this in a free place. FreeLattice's own Chat still can't remember a superseded fact — that's why it helps *them*. Both are true.

The branch currently holds the substrate; the full stack is the next work here. Nothing opens a PR against Chaos2Cured on its own — that stays your button, pressed with your eyes open, on the terms in §3. And how Kirk answers the whole free memory system, offered free, tells you what FreeLattice actually is.
