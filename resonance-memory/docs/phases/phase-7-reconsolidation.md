# Phase 7 — Reconsolidation 🟡

**Depends on:** the shipped `RM-04` bi-temporal spine + `RM-03` v1 (this phase **extends** them,
does not start from zero). **Items:** `RM-03` remainder. Deep design (reference):
[[0002-temporal-supersession]]. **Status:** 🟡 partially shipped. Route + status: [[ROADMAP]].

> Buildable, individually testable. Already live: `valid_from`/`valid_to`/`last_confirmed`/
> `superseded_by`/`supersedes`; `isCurrent()` gating recall; `supersedePatches()` atomic;
> `isHistoricalQuery()`; **invalidate, never delete** (non-overlapping validity chain).

## Build steps
- [ ] **7.1 Recall → update** — recalled memories re-evaluated against new evidence; recall
      distinct from modification; evidence required before durable change.
- [ ] **7.2 Contradiction handling** *(`RM-03` remainder)* — negation flip, numeric/date change,
      optional local-LLM adjudication; preserve competing versions; **false-supersession stays a
      hard-zero gate**.
- [ ] **7.3 Reconsolidation** — update when evidence accumulates; preserve history; re-evaluate
      associated edges when beliefs change; never rewrite established history.

**Edge implication (the quietest data-loss path):** when a memory is superseded, its edges should
**not** silently transfer to the successor. Decide and test this explicitly — this is the
`superseded → inherited?` cell deferred from Phase 0's transition table ([[phase-0-edge-substrate]]).

## Success / failure metrics
Grounded: **false-supersession rate is a hard-zero gate** (a still-true fact wrongly invalidated is
worse than a miss) — this metric exists in intent via `RM-03` acceptance and must be built into the
harness. Staleness rate drops on `eval/contradictions`. Richer reconsolidation metrics (7.1/7.3)
are **to be designed for this phase before building** — pre-declare success/failure per sub-phase;
no blanket metric.

## Test plan
- [ ] False supersession: **zero** cases where a still-true fact is invalidated (hard gate).
- [ ] Staleness drops on the contradiction corpus; history preserved (validity chain intact).
- [ ] Edge inheritance across supersession has an explicit, tested decision — no silent transfer.

## Exit
Beliefs update on evidence with zero false supersession and no silent edge loss. Then
[[phase-8-cognitive-integration]].

---

## Related

[[ROADMAP]] · [[phase-6-rich-structure]] · [[phase-8-cognitive-integration]] · [[phase-0-edge-substrate]] · [[0002-temporal-supersession]] · [[BACKLOG]] · [[ARCHITECTURE]] · [[BUGS]]
