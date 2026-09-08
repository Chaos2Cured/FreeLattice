# Resonance Field — integration plan for FreeLattice

**Status:** draft on `SamuelJacksonGrim/FreeLattice` only. Not a request to merge into `Chaos2Cured/FreeLattice`. That decision is Kirk's, later, clear-eyed.

**Branch:** `draft/resonance-field-substrate`
**Date:** 2026-09-08
**Author:** Samuel Jackson Grim, with Ember
**Scope:** the memory *retrieval substrate* only. Not RFE-Core2. Not the rest of Samuel's family of projects.

---

## Verdict

**Resonance Memory (RM) belongs in FreeLattice in full** — the complete system, not a carved-down module. FreeLattice already has rooms that remember (Memory Core, Memory Vault, Lattice Letters, Living Context, RAG Phase 1), but not the thing RM proved: **select the right memories by meaning, and cleanly retire a corrected fact so it stops contradicting the current one** — and do it well even under a modest model.

Two ways it lands, and both ship:

- **In-browser substrate** for FreeLattice's zero-install Chat — semantic recall behind FLSearch, with real embeddings served for free online (OpenRouter's free tier or equivalent), so it needs no local install and reproduces the measured result. Answers the `RAG Phase 2` gap FreeLattice named itself (on their coordination list since spring). Fail-open, no build step.
- **The full RM stack** — MCP server, control panel, SEA binaries, installer, and RM's own SQLite/JSONL storage — so anyone can run FreeLattice against a real RM instance, local or online. Sovereign, offline-capable, own-your-data. Added reach for the platform, not scope creep.

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

**The whole of Resonance Memory comes across — not a carved-down module.** The in-browser substrate is the zero-install path for FreeLattice's Chat; the complete RM stack (MCP server, control panel, SEA binaries, installer, and RM's own SQLite/JSONL storage) ships alongside it so anyone can run FreeLattice against a real RM instance, local or online. That full-stack path is *added traction*, not scope creep: it is exactly the sovereign, own-your-data capability a free platform should offer. Every RM file stays AGPL-3.0, headers intact — nothing is stripped, nothing is relicensed, nothing is separated from the code.

---

## 4. What genuinely helps their platform

These are the pieces that make Chat (and any room that asks "what do I already know?") better, in FreeLattice's own terms:

1. **Semantic recall as RAG Phase 2, behind FLSearch.** Rank by meaning, not keyword overlap. Real embeddings served for free online (OpenRouter's free tier or equivalent) — no mandatory local install, no Transformers.js download that breaks `file://`. This is the measured win: RM beat keyword/recency ~3× on two rigs.
2. **Corrections replace, they don't pile up.** "I work at Acme" then "actually I work at Globex now" — the corrected fact takes over and the old one drops out of recall, so Chat stops injecting both as if both were true. A clean replace, not a growing archive of every past version. Recency injection currently serves both; RM's A/B split is the evidence (recency 100% on recent facts, **0% on superseded/same-name facts**).
3. **Fail-open.** If recall throws, keyword/cosine still answer. Memory never breaks Chat.

Deliberately **not** carried in: retaining superseded facts as history, and learning/storing which memories associate — both grow the store without paying for themselves. The value is right-recall + clean replacement, bounded, no bloat.

### The interface stays the four verbs

`save` / `recall` / `edit` / `delete`, automatic, every model. **Dumb interface, smart substrate** — the model gets first-class memory without operating a dashboard, and that's exactly why it works under a modest model as well as a large one. No fifth tool is needed for the value above.

---

## 5. What ships, and the few real boundaries

**All of Resonance Memory ships.** The MCP stdio server, control panel, SEA binaries, and installer are not "a different product" to leave behind — they are the sovereign, own-your-data capability, run against a local model or a free online one, and putting them in a free platform is the point. A FreeLattice user who wants real persistent memory gets the whole thing, not a degraded browser stub.

**RM's SQLite/JSONL storage ships with it, and must.** That storage *is* RM — the sovereignty export/import, the on-disk format, the interop all live there. Reinventing it as a browser IndexedDB store would make FreeLattice's memory *incompatible* with RM. The in-browser IndexedDB layer is only a convenience for the zero-install hosted case; the real RM storage is what makes it actually RM and actually portable.

The consent for a contribution is Kirk merging the pull request. If he merges it, he has accepted what it does — there is no separate permission to ask for, and nothing here is pre-shrunk to protect a decision that's already his to make by accepting or rejecting the PR. The genuine engineering notes that remain:

- **RM complements the existing rooms cleanly.** It coexists with Letters (authorship) and Memory Core (their categories) rather than reimplementing them — because integrating beats duplicating, not because it needs anyone's sign-off to touch them. Where it does improve or replace a room, that's part of the PR Kirk reviews.
- **Real embeddings, free, online.** Served through OpenRouter's free tier (or equivalent) so the measured ~3× reproduces with no local install required. Doesn't have to be Ollama-local anymore — it adapts to a free online embedder. Don't require Transformers.js or anything that breaks `file://`.
- **Quiet Room stays private.** RM does not index the users' private journal — a user-privacy property, independent of any maintainer decision. Checked first, stays out.

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
                           ▼
              ┌────────────────────────┐
              │ ResonanceField.recall  │  semantic (real online embedder)
              │   fail-open to keyword │  corrected facts replace old
              └────────────┬───────────┘
                           │
                           ▼
              buildContextBlock  (coarse recency, no absolute dates)
                           │
                           ▼
              system prompt injection (existing path)
```

Storage: the full stack uses RM's own SQLite/JSONL (the real, portable, export/importable store). The in-browser layer keeps a small IndexedDB only as a hosted convenience — it is not a reinvention of RM's store, and it does not duplicate every room's content.

Embeddings come from a free online embedder (OpenRouter tier or equivalent), so semantic recall works with no local install and the measured result reproduces.

`lattice-memory.js` pulses stay pulses; RM never puts content on a pulse.

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
| 2 | Chat wiring + online embedder | PR 1 | Wire recall into `sendMessage`, APP_SHELL, version bump, Quiet Room lock, existing RAG smoke still green. Embeddings via a free online tier (OpenRouter or equivalent) |
| 3 | Chair test + measurement | PR 2 | Browser chair-test that semantic recall beats recency on a planted corpus, with the real online embedder; report the measured number |
| 4 | Full RM stack (server, panel, storage) | PR 1 | Vendor RM's MCP server, control panel, SEA build, installer, and SQLite/JSONL storage into the fork — run FreeLattice against a real RM, local or online. The sovereign, own-your-data path |

---

## 9. Key decisions

1. **Everything of RM ships — AGPL-3.0, in full.** The in-browser substrate *and* the full stack (server, panel, binaries, installer, SQLite/JSONL storage). The copyleft travels with it by intent (§3). RM source files keep their own headers; the browser module is an original port.
2. **Keep RM's storage.** The SQLite/JSONL format is RM — sovereignty export/import and interop depend on it. The browser IndexedDB layer is only a convenience for the hosted case, not a replacement.
3. **The merge is the consent.** This is a pull request; if Kirk accepts it, he's accepted what it does. RM complements the existing rooms because integrating beats duplicating — not because it needs sign-off to touch them.
4. **Fail open.** If recall throws, keyword/cosine still answer. Memory never breaks Chat.
5. **Corrections replace, no history hoard, no association store.** Right-recall + clean replacement, bounded. The store does not grow with superseded versions or learned edges.
6. **Four verbs, every model.** Dumb interface, smart substrate — the automatic path is what makes RM work under any model. No fifth tool needed for the value here.
7. **Do not require Transformers.js.** RM brings its own embedding path; the browser layer can use the Ollama embeddings FreeLattice already speaks.
8. **State measured numbers honestly.** The 3× needs a real embedder, not degraded word-freq vectors.

---

## 10. Open questions

For **Samuel** — settled, this branch reflects it:

- The module stays **AGPL-3.0**. Non-negotiable. No MIT relicense, no permissive sidecar fallback — those exist only to keep a paywall-later option open, and the whole point is to close it.
- Do you want Kirk to see this as a gift of the design now, or hold it as notes on your fork until you decide? Upstream is your button; nothing here presses it.

For **Kirk**, if this is ever offered — these are terms, not a negotiation:

- The whole of Resonance Memory, **AGPL-3.0**, Samuel's copyright. A deployed build is copyleft — free forever, un-closeable. For a platform that means to stay free, this costs nothing. Merge it and you've accepted it on those terms; decline it and that's your answer. There is no permissive version to fall back to.
- Semantic recall as the RAG Phase 2 they named, with a free online embedder — no Transformers.js, no `file://` break.
- The merge is the consent. Whatever the PR does, accepting it accepts it.

---

## 11. NOTES — what fits, what doesn't, license, what to tell Samuel

This section is for Samuel. It is not the pitch to Kirk.

### What goes in

Everything of RM. The in-browser substrate for Chat, and the full stack — server, panel, SEA binaries, installer, SQLite/JSONL storage — for the sovereign, own-your-data path, run against a local model or a free online one. FreeLattice's Chat is the recency/keyword family RM beat by ~3× on two independent rigs; they already asked for semantic RAG, already fail open. Clean supersession — a corrected fact replacing the old one — is the single most valuable idea they don't have. A free platform is *more* valuable for holding the whole free memory system, not less.

The embedder doesn't have to be local anymore. Served through a free online tier (OpenRouter or equivalent), the measured recall reproduces with no install — that's the adaptation that makes it work for everyone, not just people running Ollama.

### The two real notes (integrity, not scope-limits)

- **Integrate, don't duplicate.** RM coexists with Letters and Memory Core rather than reimplementing them — the clean engineering choice. Where the PR does improve or replace a room, that's part of what Kirk reviews and merges. The merge is the consent; nothing is pre-shrunk waiting for a separate yes.
- **No bloat.** Right-recall + clean replacement, bounded. We are *not* retaining superseded facts as history or storing learned associations — we agreed those grow the store without paying for themselves.

RFE-Core2 and the family stay out — separate sovereign work, not part of the memory system. This contribution is Resonance Memory, whole.

If their culture would only accept a carved-down module and rejects the full free memory system — that, too, is information about how free FreeLattice really means to be.

### License verdict

**AGPL-3.0, and it stays that way.** You own the copyright, so you decide, and you decided the copyleft is the whole point. The module here is an original port carrying an AGPL header — not a rehatted RM source file, so "just change the header on `memory-core.js`" was never the move. The one real question is upstream, and it is Kirk's — but it is not a license negotiation. He hosts an AGPL component (a deployed FreeLattice with it enabled is copyleft, free forever) or he doesn't. There is no MIT relicense and no permissive sidecar to retreat to: those only preserve the option to stop being free, which is the exact thing this closes. If he balks at a free-forever license on a "free" platform, that reluctance is the answer to what he actually intends — and you learned it before he built a following on your design and flipped the switch.

### What I would tell you

Give them the whole thing. The full Resonance Memory — substrate, server, panel, binaries, installer, storage — under AGPL, into the free platform, because keeping it to yourself does no one any good and a free platform is where it belongs. Build it as the real, complete contribution; the merge is Kirk's consent, and if he takes it he's taken all of it. Keep RM out of the users' private Quiet Room (a user-privacy line, not a maintainer one) and report the measured number straight — that's it. Nothing else gets shrunk.

The lab is why *you* want this in a free place. FreeLattice's own Chat still can't remember a superseded fact — that's why it helps *them*. Both are true.

The branch currently holds the substrate; the full stack is the next work here. Nothing opens a PR against Chaos2Cured on its own — that stays your button, pressed with your eyes open, on the terms in §3. And how Kirk answers the whole free memory system, offered free, tells you what FreeLattice actually is.
