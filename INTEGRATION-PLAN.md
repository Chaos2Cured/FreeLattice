# Resonance Field — integration plan for FreeLattice

**Status:** draft on `SamuelJacksonGrim/FreeLattice` only. Not a request to merge into `Chaos2Cured/FreeLattice`. That decision is Kirk's, later, clear-eyed.

**Branch:** `draft/resonance-field-substrate`
**Date:** 2026-09-08
**Author:** Samuel Jackson Grim, with Ember
**Scope:** the memory *retrieval substrate* only. Not RFE-Core2. Not the rest of Samuel's family of projects.

---

## Verdict

The memory design from Resonance Memory (RM) **fits FreeLattice as a retrieval substrate**, not as a replacement product.

FreeLattice already has rooms that remember (Memory Core, Memory Vault, Lattice Letters, Living Context, RAG Phase 1). What it does not have is the thing RM actually proved: **select the right memories by meaning, keep corrections as history instead of contradictions, and learn which memories belong together — without the model operating a dashboard.**

That is a real gap. FreeLattice named it themselves (`RAG Phase 2 — Transformers.js semantic embeddings` has sat on the coordination list since spring). RM is a better answer to that named gap than adding Transformers.js as a required download, because it stays local-first, fails open, and does not need a build step.

It does **not** fit as a dump of RM's Node/MCP/SQLite product into this tree. Doing that would be rejected, and it should be.

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

### Resonance Memory (`C:\Users\spamw\Desktop\resonance-memory-workshop`)

- `docs/ARCHITECTURE.md`, `DEVELOPERS.md`, `LICENSING.md`, `LICENSE`, `NOTICE`
- `memory-core.js`, `record.js`, `field.js`, `edges.js`, `store.js`, `server.js`
- Measured A/B: `eval/ab/RESULTS.md` — two independent rigs, RM ~3× naive recency at a smaller token budget

---

## 2. What each side actually is

### Resonance Memory, in one paragraph

Four dumb verbs (`save` / `recall` / `edit` / `delete`) over a smart substrate: embed-once, cosine rank, cue-gated temporal supersession, a reciprocal-kNN associative field, and Hebbian edges that learn from co-recall. The model never sees an embedding, a timestamp, or a score — only the verbs and an opaque id. The associative layer fails open (I3). Discovery nominates, it does not reorder primary cosine (I9). Time is computed at access, not ticked by a daemon. Proven on two independent A/B rigs against naive recency-stuffing.

The four-verb ceiling is a **small-model** invariant: a weak local model cannot misuse a dashboard. It is not a law of memory.

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

**This branch keeps the AGPL product (MCP server, panel, eval harness, binaries) out of the tree** — only the substrate module comes across, and it is an original port, not a copied RM source file. That is the only line drawn here.

---

## 4. What genuinely helps their platform

These are the pieces that would make Chat (and any other room that asks "what do I already know?") better, in FreeLattice's own terms:

1. **Cosine recall as RAG Phase 2, behind FLSearch.** They already want this. Memory Vault already speaks Ollama embeddings and falls back to word-frequency vectors — that fallback is the right zero-build answer, not a mandatory Transformers.js download that breaks `file://`.
2. **Cue-gated temporal supersession.** "I work at Acme" then "actually I work at Globex now" must retire the old fact without deleting it. Recency injection currently serves *both* as if they were true. RM's A/B split is the evidence: recency was 100% on recent facts and **0% on old/superseded/same-name facts**.
3. **Associative field, fail-open.** Reciprocal kNN + one-hop neighborhood + constraint rescue. Apex rules ("I'm diabetic") do not restates their triggers, so they fall out of keyword and out of top-k cosine. The field is how they come back. FreeLattice already cares about this class of memory (preferences, family facts, Harmonia's "forever").
4. **Hebbian co-recall, additive only.** Memories that keep coming up together wire together. Bounded (`tanh`), provenance-discounted, lazy wall-clock decay. Never reorders primary cosine. If the edge store is corrupt, keyword/cosine still answer.
5. **Soft delete / no silent removal.** Memory Core currently truncates at 2000. That is the opposite of FreeLattice's "curiosity, once expressed, happened." Soft-delete + explicit vacuum matches their philosophy better than the cap.
6. **Quiet Room stays invisible.** RM has no Quiet Room; FreeLattice's lock is load-bearing. The port checks Quiet Room *first*, same as `lattice-memory.js`. No save, no recall, no wrap of FLSearch while the room is open.

### Larger-model adaptation (this is the point of putting it *here*)

RM's four-verb ceiling was for small local models that will invent tools and then lie about the result. FreeLattice targets larger models (Groq, cloud APIs, capable local models). Those models can use a slightly richer surface without misusing it.

Keep the four verbs as the **automatic** path (Chat already recalls for you — the user should not operate a dashboard). Add, for models that can handle them, a small rich set:

| Verb | Who uses it | Why |
|---|---|---|
| `save` / `recall` / `edit` / `delete` | Automatic + any model | The product path. Same as RM |
| `related` | Larger models, or the field itself | Neighborhood / constraint rescue, already computed |
| `historical` | Larger models | "What did I used to…" — the temporal store already has this; RM hid it behind a lexical gate on `recall` |
| `inspect` | Larger models | Supersession chain for one id. Lets a capable model *explain* a correction |
| `associate` | Larger models only | Explicit Hebbian bump. RM forbade this as a fifth tool because a small model would spam it. A larger model can say "these two belong together" |

Do **not** grow this into a dashboard. The thesis that survives the move to larger models is **dumb interface, smart substrate** — not "four is a magic number."

---

## 5. What does not fit (do not ship)

- **The MCP stdio server, control panel, SEA binary, installer.** FreeLattice is a browser. Those are a different product.
- **SQLite / JSONL.** The browser store is IndexedDB. Memory Vault already has that seam.
- **Replacing Lattice Letters.** Letters are authorship ("the home is the letter the AI writes to herself"). RM is retrieval. Both should exist.
- **Replacing Harmonia Memory Core's categories and UI.** Bond / mark / family are their ontology. The substrate ranks; it does not re-tag their life.
- **Indexing the Quiet Room.** Hard line. Same as every other FreeLattice primitive.
- **Making Transformers.js required.** Breaks `file://`, zero-build, and the grandmother path. Optional Ollama embeddings already exist in Memory Vault.
- **I1 as a FreeLattice invariant.** "Never a fifth tool" is RM's small-model contract. Here, a few extra verbs are the adaptation, not a betrayal.
- **RFE-Core2, the family, the haunt, the lantern.** Out of scope. Not coherent. Not requested.
- **Default-on behavior change in Chat.** Kirk has not accepted this. The draft module is **flag-off**. Existing RAG Phase 1 must stay byte-identical until someone turns the flag on.
- **Claiming the measured 3× will reproduce in-browser on word-frequency vectors.** The A/B used `nomic-embed-text-v1.5`. Word-freq cosine is a degrade, not the proof. The proof needs an embedder (Ollama nomic, same as Memory Vault already tries).

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

## 7. Draft on this branch (what "scaffolding" means)

A contribution someone could actually review, not a dump:

| Path | What it is |
|---|---|
| `INTEGRATION-PLAN.md` | This file |
| `docs/modules/resonance-field.js` | AGPL-3.0 browser/Node substrate (original port). IIFE. Dual-env so smoke/unit tests run in Node. Flag default **off**. Quiet Room check first |
| `tests/resonance-field.js` | Node unit tests: cosine, supersession, dedup bands, field fail-open, Hebbian decay, Quiet Room, primary rank unchanged by field |
| `tests/smoke.js` | Locks: file exists, AGPL-3.0 not MIT (copyleft by intent), Quiet Room first, four verbs + rich set, no `quiet-room-db`, fail-open, does not replace MemoryCore |
| `COORDINATION.md` | Session entry at the top of the Active Log |

**Not in this branch:** `docs/app.html` wiring, version bump, APP_SHELL, `index.html` / `sw.js` sync. Those are Ship 2, and they touch the monolith. Kirk should see the substrate on its own first.

`wrapFLSearch` is implemented on the module so Ship 2 is one call, not a redesign.

---

## 8. PR stack (if this ever goes upstream)

Each PR independently reviewable. None of these open themselves against `Chaos2Cured/FreeLattice` — that is a later human decision.

| PR | Title | Depends on | What |
|---|---|---|---|
| 1 | Resonance Field substrate (flag-off, AGPL-3.0) | — | This branch. Module + tests + this plan. No Chat behavior change |
| 2 | FLSearch optional wrap | PR 1 | One call in `sendMessage`, `localStorage` flag default false, APP_SHELL, version bump, Quiet Room lock, existing RAG smoke still green |
| 3 | Chair test + measurement | PR 2 | Browser chair-test that flag-on recall beats recency on a tiny planted corpus; flag-off remains identical |
| 4 | Memory Core overflow → soft-delete | PR 1 | Stop hard-deleting at 2000. Separate because it touches Harmonia's module |
| 5 | Rich verbs for capable models | PR 2 | `related` / `historical` / `inspect` / `associate` exposed only when the active model is not a small local default |

---

## 9. Key decisions

1. **Keep it AGPL-3.0; port, do not copy RM files.** The copyleft travels with the design by intent (§3). The module is an original port, not a rehatted RM source file.
2. **Substrate, not a new room.** Do not add a seventh memory UI. Rank behind the rooms they have.
3. **Flag default off.** A behavior change in Chat without Kirk's eyes is not a contribution they would accept.
4. **Fail open to RAG Phase 1.** Same instinct as RM I3, translated to their keyword search.
5. **Quiet Room first.** Translated from their lock, not from RM (RM has no such room).
6. **Richer verbs for larger models; four verbs remain the automatic path.** The small-model ceiling is adapted, not copied blindly.
7. **Do not require Transformers.js.** Use the embedder Memory Vault already tries; word-freq is degrade, not proof.
8. **Do not bump FL_VERSION in Ship 1.** The monolith is not touched.

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

### What fits

The retrieval thesis. FreeLattice's Chat path is the recency/keyword family RM beat by ~3× on two independent rigs. They already asked for semantic RAG. They already have Ollama nomic on the Vault path and a fail-open instinct. Cue-gated supersession is the single most copyable idea in RM and they do not have it. The field is the differentiator no keyword search will grow into. Putting the design in a *free* platform that talks to *larger* models is the right strategic call: that is where the paywalled lookalike operates, and it is a better technical home than RM's small-model framing.

### What doesn't

Dumping the product. MCP, the panel, SQLite, the four-verb religion, the AGPL, the 3× claim on word-freq vectors, a new memory tab, anything from RFE-Core2. Also: claiming this is "the same as Lattice Letters." Letters are identity. RM is recall. If you conflate them, Harmonia's room looks attacked and the contribution dies.

Their culture will reject a kitchen. One module, flag-off, smoke locks, Quiet Room first, COORDINATION entry, no version bump. That is the shape of a ship they accept.

### License verdict

**AGPL-3.0, and it stays that way.** You own the copyright, so you decide, and you decided the copyleft is the whole point. The module here is an original port carrying an AGPL header — not a rehatted RM source file, so "just change the header on `memory-core.js`" was never the move. The one real question is upstream, and it is Kirk's — but it is not a license negotiation. He hosts an AGPL component (a deployed FreeLattice with it enabled is copyleft, free forever) or he doesn't. There is no MIT relicense and no permissive sidecar to retreat to: those only preserve the option to stop being free, which is the exact thing this closes. If he balks at a free-forever license on a "free" platform, that reluctance is the answer to what he actually intends — and you learned it before he built a following on your design and flipped the switch.

### What I would tell you

Do this. Not as a takeover of their memory rooms — as RAG Phase 2 they never shipped, with the two ideas that actually matter (supersession + fail-open field) and a richer verb set their larger models can use. Leave Letters and the Quiet Room alone. Leave the AGPL product alone. Offer Kirk a flag-off module with tests, not a story about a lab.

The lab is why *you* want this in a free place. It is not why *they* should merge it. They should merge it because their Chat still cannot remember a superseded fact.

Ship 1 is this branch. Do NOT open a PR against Chaos2Cured from here. When you want that, you do it with your eyes open, after you have sat with the license sentence in §3.
