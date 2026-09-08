# Resonance Memory — Roadmap

**Supersedes** the previous `docs/ROADMAP.md` (product track, `RM-00`…`RM-20`) and the root
`ROADMAP-IMPLEMENTATION.md` (substrate mechanisms, Phases 0–8) — both described one system at two
altitudes. Prior versions remain in git history.

## What this document is — and what it deliberately isn't

A roadmap holds **route and status**: what is done, what isn't, what's in progress, shelved, or
rescinded, in what order, and why that order. Nothing else. Every claim of *fact* — how a thing is
built, what an invariant protects, what "done" means, whether a claim is currently true — lives in
the doc whose **function** owns it, referenced here by **stable name** (an item ID, an invariant
ID, a bug ID, a proposed-design number), never by line number or code excerpt. A roadmap that
restates mechanism goes stale the moment the mechanism changes — and it did (`BUG-006`).

| For… | Ask… |
|---|---|
| What "done" means for an item — acceptance criteria, scope | [`BACKLOG.md`](BACKLOG.md) (`RM-00`…`RM-21`, **authoritative**) |
| How it's built; what each invariant protects | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| What broke, how, whether it's fixed | [`BUGS.md`](BUGS.md) |
| The measured state — is a claim actually true now | [`../eval/`](../eval/), `../eval/RESULTS.md`, `npm run eval` |
| The buildable phase specs (scope · steps · metrics · tests) | [`phases/`](phases/) — `phase-0` … `phase-8` |
| Deep designs that gate a phase | [`proposed/`](proposed/) — `0003` (Phase 2.2 gate), `0009` (edge threat model, feeds `RM-16`), `0007` (the harness), `0002`/`0004`/`0006` (referenced by their phases) |
| What shipped when | [`../CHANGELOG.md`](../CHANGELOG.md) |
| Pricing / positioning | [`COMPETITIVE-ANALYSIS.md`](COMPETITIVE-ANALYSIS.md) |
| Working agreement; build/run/test | [`../CLAUDE.md`](../CLAUDE.md), [`../DEVELOPERS.md`](../DEVELOPERS.md) |

If this roadmap and any of those disagree, **the other doc wins** — and this file is the one to fix.

---

## What this is

A persistent, event-driven associative memory substrate, exposed over MCP, that runs entirely on
the user's machine, tied to no account, sent to no cloud. **Substrate and product are the same
claim:** the substrate *is* what ships; any model can drive it and any host can run it precisely
because the interface stays dumb and the sophistication stays underneath.

**Core principle: time is a function, not a process** — no heartbeat, no dream loop, no decay
daemon; every operation observes state at *T*, computes temporal effects, mutates, persists.
Autonomous cognition belongs in the consuming agent; the MCP boundary is that line. (Mechanism:
`ARCHITECTURE.md` §1.)

**The goal.** Be the memory layer people choose *instead of* a paid hosted service — free,
local-only, copyleft, architecturally better at association. Never enter the benchmark-number war;
compete on **reproducibility**, which hosted vendors structurally cannot match. (Pricing:
`COMPETITIVE-ANALYSIS.md`.)

### Where we stand *(September 2026 — recheck before trusting)*

| Area | Position | Owned by |
|---|---|---|
| Evaluation | **No longer a gap.** `RM-00` shipped: offline, deterministic, golden-gated. Reporting metrics: `recall@k` + `duplicate_rate` (RM-02.a), `extraction_precision` / `extraction_recall` (RM-01), `mrr` (S1). Staleness still open — Phase 2.5. S1 scale curve in `eval/RESULTS.md`. | `RM-00`, `eval/` |
| Write path | **The real gap, closing.** `RM-04` + `RM-03` v1 + `RM-02` landed; `RM-01` done (Tier 0/1 + opt-in Tier 2). | `RM-01`–`RM-04` |
| Substrate | **Unified.** One edge table, two signals (semantic derived, Hebbian source-of-truth). Phase 0 exit met (0.6). | Phase 0 ✅, `ARCHITECTURE.md` |
| Distribution | **Ahead.** Single file, zero terminal, no API key. | `DEVELOPERS.md` |

Which fixes the order: **the substrate is unified (Phase 0); close the write-path gap, then tune
what sits on top.** Tuning against a substrate that was about to change is why Phase 0 went first.

---

## Status legend

| Mark | Meaning |
|---|---|
| ✅ | Shipped and tested — do not rebuild |
| 🟡 | Partially shipped — the roadmap wants more than exists |
| ⬜ | Open |
| 🔀 | **Migration, not greenfield** — working code exists and must change |
| ⛔ | Gated — cannot become default without a named measurement |
| 🛑 | **Rescinded** — decided against (distinct from a *measured* "no," which is a shipped result) |
| ⏸ | **Shelved** — deliberately parked; may return. Kept visible on purpose |

🔀 is the load-bearing one: roughly a third of Phase 0 reads as new construction but is a rewrite
of the shipping `field.js`/`ledger.js`. Greenfield produces a second, parallel associative system.

---

## Invariant guardrails

Every phase must leave these standing. **Definitions, rationale, and the backing code live in
[`ARCHITECTURE.md`](ARCHITECTURE.md) §2** — the only roadmap-relevant fact is *held vs. target*.

| | Invariant (one line) | Status |
|---|---|---|
| I1 | Four verbs, nothing more | ✅ held |
| I2 | No *unmeasured* signal touches rank | ✅ held (amended — see ARCHITECTURE) |
| I2b | Access-frequency signals are telemetry only | ✅ held |
| I3 | The associative layer fails open | ✅ held |
| I4 | Embed at save; server owns all metadata | ✅ held (one self-extinguishing legacy exception) |
| I5 | Durable writes; no *unbounded* write on a read path | ✅ held (one self-extinguishing legacy exception) |
| I6 | Reading does not drive the decay clock | ✅ held |
| I7 | Activation never persists | ⬜ n/a until Phase 1 |
| I8 | No silent removal | ✅ held (records + edges, Phase 0.4) |
| I9 | Discovery nominates; it does not appoint | ✅ held |

The I4/I5 exceptions are real and named on purpose; an invariant claimed more strongly than
the code supports stops anyone from looking. Full accounting in ARCHITECTURE. I6 flipped
from target to held in Phase 0.2 (lazy wall-clock decay; `tick()` gone from recall). I8
flipped from held-records-only to held-for-edges in Phase 0.4 (`pruneSweep` marks
`pruned_at`; `vacuum()` is the explicit hard drop).

---

## Already shipped — do not rebuild

Status only. Where each lives and how it works: `ARCHITECTURE.md`. What each satisfies: `BACKLOG.md`.

| Capability | Item | Note |
|---|---|---|
| Four-verb MCP surface; single shared core (server + eval) | — | Foundation — do not fork |
| Embed-at-save, cosine recall, keyword fallback | — | Foundation |
| Durable atomic writes; recall does no *unbounded* store write | — | `BUG-001`/`BUG-002` |
| Soft delete + `vacuum()` compaction | — | Records: `deleted` then `vacuum()`. Edges (0.4): `pruned_at` then `EdgeStore.vacuum()`. |
| Store abstraction behind the verbs | `RM-07` | `SqliteStore` is the default (slice 4). Existing JSONL auto-migrates on first open (2a protocol; fail-open to JSONL). `RESONANCE_STORE=jsonl` pins JSONL. Golden 27/31 on sqlite default and `--store jsonl`. S1 product: loads 50k/100k; field-off p95 49.6 / 96.4 ms. |
| kNN semantic graph, neighborhood expansion, constraint rescue | — | 🟡 ephemeral, rebuilt per recall |
| Hebbian weights, bounded `maxBonus·tanh(w)`, provenance-discounted | — | 🟡 per-edge bounding solved; wall-clock decay ✅ (0.2) |
| Decay + prune | — | ✅ lazy wall-clock half-life (0.2); soft prune + reactivation (0.4, I8 held for edges) |
| Bi-temporal validity + current-gating | `RM-04` | ✅ extended by Phase 7, not started by it |
| Cue-gated supersession detection v1 | `RM-03` v1 | 🟡 continued by Phase 7.2 |
| Offline deterministic eval + golden gate | `RM-00` | ✅ **this is Phase 2.5** — extend, don't rebuild |
| Dependency-free test suite (61 after PRE-0) | — | Count in `CHANGELOG.md`; run it, don't cite it |

---

## PRE-0 — before any Phase 0 code

- [x] **`BUG-008`** — `edit()` embedding-destruction fix + 4 regression tests (`test.js` 57 → 61). ✅ (`BUGS.md`)
- [x] **Edge state-transition table** — Phase 0 cells decided. `superseded → inherited?` remains deferred to Phase 7 (named, not forgotten). Table: [`phase-0`](phases/phase-0-edge-substrate.md).

---

## Phases — the build track

Each phase is a **self-contained, individually buildable + testable** doc in [`phases/`](phases/):
scope, build steps, its **own** success/failure metrics + test plan, exit criteria. This roadmap
holds only *where we are*; the phase doc holds *what to build and how to know it worked*.

**Rule carried into every phase doc:** pre-declare the success **and** failure signature → build
one mechanism → test → measure → break it → fix → document → then the next. **No phase ships
without its own custom eval** — a blanket metric does not fit a phase scope.

| Phase | Focus | Status | Doc |
|---|---|---|---|
| **0** | Unify time & persistence (edge substrate) 🔀 | ✅ **exit met** | [`phase-0`](phases/phase-0-edge-substrate.md) |
| 1 | Transient activation | ⬜ **← next** | [`phase-1`](phases/phase-1-transient-activation.md) |
| 2 | Retrieval & association dynamics | ⬜ ⛔ | [`phase-2`](phases/phase-2-retrieval-dynamics.md) |
| 3 | Episodic working context *(overlaps `RM-06`)* | ⬜ | [`phase-3`](phases/phase-3-episodic-context.md) |
| 4 | Consolidation *(weakest prior — cut if unproven)* | ⬜ | [`phase-4`](phases/phase-4-consolidation.md) |
| 5 | Temporal & predictive 🔀 | ⬜ | [`phase-5`](phases/phase-5-temporal-predictive.md) |
| 6 | Rich structure *(watch `I1`)* | ⬜ | [`phase-6`](phases/phase-6-rich-structure.md) |
| 7 | Reconsolidation *(extends `RM-04`/`RM-03`)* | 🟡 | [`phase-7`](phases/phase-7-reconsolidation.md) |
| 8 | Cognitive integration | ⬜ | [`phase-8`](phases/phase-8-cognitive-integration.md) |

Phase 0 exit is met; everything after Phase 1 is **planned, not committed** — the code must earn it.

### Phase 0 — live sub-phase tracker

Full spec + metrics + tests: [`phase-0`](phases/phase-0-edge-substrate.md). **Exit met** at 0.6.

| Sub-phase | Purpose | Status |
|---|---|---|
| **0.0** | One edge store, two signals; `embedding_version` schema; migrate `.assoc.json` (one-way) | ✅ |
| **0.1** | Save-time semantic edges + edge timestamps; save-latency cost sweep | ✅ |
| **0.2** | Lazy wall-clock decay of the learned signal (**I6 held**) | ✅ |
| **0.3** | Materialize-on-mutation; MCP request-ID idempotency (atomic dedup) | ✅ |
| **0.4** | Soft pruning (mirror `vacuum()`); server-side reactivation | ✅ |
| **0.5** | Phase 0 tests — every transition row, *reading ≠ decay*, *fails-open* | ✅ |
| **0.6** | Threat-model sketch (design only; `RM-16` stays gated to Phase 2) | ✅ [`0009`](proposed/0009-edge-threat-model.md) |

**Exit met:** golden green and reliable; I6 held; I8 held for edges; migration lossless + one-way;
signals stay separate. Next is Phase 1. `RM-16` implementation stays gated to Phase 2 — the
sketch feeds it, it does not build it. Deferred out of this exit (named): `superseded → inherited?`
is Phase 7; `RM-08` record importance decay is a different object.

### The promotion gate ⛔ (Phase 2)

The one cross-phase gate worth stating at the route level. Fusion becomes default **only when all
four hold** — (1) A/B win on the `RM-00` golden set *(needs metrics that don't exist yet — Phase
2.5)* · (2) Phase 2.3 + 2.4 landed (competition + normalization damp rich-get-richer before learned
weight enters rank) · (3) `RM-16` landed · (4) `DEVELOPERS.md` + `CLAUDE.md` amended in the same PR.
A failed gate keeps the flag off and writes the negative result down. A measured "no" is a shipped
result. Full form: [`phase-2`](phases/phase-2-retrieval-dynamics.md), `BACKLOG.md` `RM-05`.

---

## Product track — items with no mechanism phase

Not substrate work; what makes it runnable by anyone. Scope + acceptance: `BACKLOG.md`.

| Item | What | Status |
|---|---|---|
| `RM-01` | Write-side extraction (heuristics first; local LLM optional, off by default, never blocks save) | ✅ 01.a+01.b+01.c (messy precision 0.26→1.00; messy-hard live Tier 2 A/B in RESULTS.md) |
| `RM-02` | Near-duplicate detection + merge | ✅ 02.a+02.b+02.c (A/B + backfill: dup_rate 0.3182→0.0000, recall@5 held) |
| `RM-07` | SQLite backend behind the Store seam (`node:sqlite` + BLOB/JS cosine; FTS5 later) | 🟡 slice 1+2a+2b+2c+3 shipped (selectable Store, `--migrate`, `--export` zip, panel export button, golden parity); default switch still open. [`proposed/0010`](proposed/0010-sqlite-backend.md) |
| `RM-11` | Cross-platform builds + signing | 🟡 unsigned per-OS SEA via GH Actions; signing still open |
| `RM-12` | SDKs against a documented local HTTP API | ⬜ — W-02 Origin/CSRF lock shipped; SDKs + documented surface still open |
| `RM-13` | Opt-in local-only telemetry + failure-report bundle | ⬜ |
| `RM-15` | Longitudinal coherence soak test | ⬜ |
| `RM-16` | Poisoning / injection defense | ⬜ **gates Phase 2.2 promotion** — threat sketch: [`0009`](proposed/0009-edge-threat-model.md) |
| `RM-17` | Export / import / backup | ✅ — zip export 2b + panel 2c; `--import` CLI (dry-run default, `--apply`, `--with-edges` opt-in); panel import button shipped (confirm modal, shells `runImport()`, with-edges default-off) |
| `RM-18` | Encryption at rest (optional) | ⬜ |
| `RM-19` | Recall explainability | ⬜ — near-free once 2.2 tracing exists |
| `RM-20` | First-run quality | 🟡 — panel empty-store nudge + starter prompt shipped; panel import button names the "zip from another machine" hole |
| `RM-14` | Hosted / enterprise | ⛔ **deliberately deferred** — a separate product with a separate name |

---

## What we are deliberately not doing

- **Not entering the benchmark-number war.** (LOCOMO: 84 % → 58.44 % → 75.14 %, all contested.) Publish a harness; compete on reproducibility.
- **Not adding a fifth verb.** Every capability lands in the substrate.
- **Not requiring a cloud LLM on the critical path.** Optional, local, off by default.
- **Not shipping a feature without its eval.** "It has a conflict handler" is worthless; "measurably reduces staleness" is the product.
- **Not building a future phase because you can see where it goes.** The architecture may anticipate; the code must earn it.

---

## Success measures

Only the first is a measure; the others are aims, labelled so they can't pass for measurements.

| Horizon | | |
|---|---|---|
| Near | **Measurable now** | `npm run eval` green and public; staleness + duplicate rates trending down; no golden regressions across Phase 0 |
| Mid | *Aim — no harness exists* | A user with 10k memories has a better experience than a paid hosted starter tier, for $0 |
| Long | *Aim — unfalsifiable* | "Just use Resonance" is the default answer for anyone privacy- or price-sensitive |

---

## Development loop

Pre-declare the success **and** failure signature → implement one mechanism → test → measure →
deliberately break it → find the failure mode → fix → document → only then add the next. A clean
confirming result is the alarm, not the trophy. A behaviour change isn't done until the docs that
describe it change with it (`BUG-006`).

---

## Current build target

```
PRE-0     ✅ BUG-008 fixed · ✅ Phase-0 table cells decided (inheritance → Phase 7)
  ↓
Phase 0.0   one substrate, two signals · embedding_version · migrate .assoc.json
  ↓
Phase 0.1   save-time semantic edges · edge timestamps · cost sweep   ✅
  ↓
Phase 0.2   lazy wall-clock decay of the learned signal   (I6 held)   ✅
  ↓
Phase 0.3   materialize-on-mutation · request-ID idempotency   ✅
  ↓
Phase 0.4   soft pruning · server-side reactivation   ✅
  ↓
Phase 0.5   tests — reading ≠ reinforcement · fails-open   ✅
  ↓
Phase 0.6   threat-model sketch (design only; RM-16 stays gated)   ✅
  ↓
GREEN (npm test + npm run eval)  — Phase 0 EXIT MET
  ↓
Phase 1
```

Everything after Phase 1 is planned, not committed.

---

## Accepted risks & open problems

Route-level only. The mechanism behind each lives in its owning doc (Phase 0 risks:
[`phase-0`](phases/phase-0-edge-substrate.md)).

1. **Save-time cost is measured** — Phase 0.1 scan p95 at N=100k is 77.1 ms vs. a pre-declared 250 ms budget. **`RM-07` is not forced by the neighbor scan**; it stays scheduled on JSONL-rewrite grounds. Table in [`phase-0`](phases/phase-0-edge-substrate.md).
2. **Two cosine thresholds serve different jobs** (recall gate 0.55 vs. save-time bind 0.25) — deliberate and documented, not accidental.
3. **Consolidation (Phase 4) may not earn its place** — exit criterion is measurable retrieval gain; absent that, cut it.
4. **Fusion may lose the Phase 2.2 gate** — valid and publishable; the flag stays off.
5. **Edge inheritance across supersession is undecided** (Phase 7) — the quietest data-loss path.
6. **Phases 5–8 have no eval design yet** — metrics before code.
7. **Sidecar migration is one-way** — an old build reading a new sidecar must fail cleanly, not silently drop edges.
8. **The sidecar now holds irreplaceable state** — semantic rebuilds, learned weight does not; `RM-17` backup rises in priority.

---

## Related

[[ARCHITECTURE]] · [[BACKLOG]] · [[BUGS]] · [[COMPETITIVE-ANALYSIS]] · [[proposed/README]] · [[0009-edge-threat-model]] · [[phase-0-edge-substrate]] · [[phase-1-transient-activation]] · [[phase-2-retrieval-dynamics]] · [[phase-3-episodic-context]] · [[phase-4-consolidation]] · [[phase-5-temporal-predictive]] · [[phase-6-rich-structure]] · [[phase-7-reconsolidation]] · [[phase-8-cognitive-integration]] · [[CLAUDE]] · [[DEVELOPERS]] · [[roadmap-dissemination-log]] · [[RESULTS]]
