# Roadmap dissemination log

Traceability for splitting the one-shot **build spec** (the "full roadmap" Samuel supplied,
2026-08-25) into the docs whose *function* owns each part. The roadmap keeps only route + status;
everything else was routed to its owning doc. **This log is scaffolding — delete it once the split
is settled and verified in review.**

Rule applied throughout: when the spec said *"step X needs A, B, C,"* A/B/C landed in the owning
doc and `ROADMAP.md` kept **one status box for X** pointing here.

## Spec section → destination

| Spec section | Landed in | As |
|---|---|---|
| Header / supersedes / companion table | `ROADMAP.md` (top) | route |
| "What this is" + core principle (time is a function) | `ROADMAP.md` (brief) **+** `ARCHITECTURE.md` §1 (full) | principle |
| Goal / never-benchmark-war | `ROADMAP.md`; pricing → `COMPETITIVE-ANALYSIS.md` | route |
| Where we stand table | `ROADMAP.md` | status |
| Status legend | `ROADMAP.md` — **added 🛑 rescinded, ⏸ shelved** | status |
| Invariant guardrails I1–I9 (one-liners) | `ROADMAP.md` (index, held/target) | status |
| Invariant **definitions + rationale + code** (incl. I2/I2b "two strengths of no", I6-precise) | `ARCHITECTURE.md` §2 | mechanism |
| Already-shipped check-off ledger | `ROADMAP.md` | status |
| "Why Phase 0.0 exists" (asymmetry, layering, version-validity) | `phases/phase-0` §1, §4 | design |
| PRE-0 `BUG-008` (fix, tests, before/after counts) | `BUGS.md` `BUG-008` (already synced); status box → `ROADMAP.md` PRE-0 | defect |
| Edge state transition table (Writes? column) | `phases/phase-0` §5 | design |
| Phase 0.0–0.6 **implementation detail** | `phases/phase-0` §2–§3 | design |
| Phase 0.0–0.6 **checkable acceptance** | `BACKLOG.md` `RM-21` | acceptance |
| Phase 0.0–0.6 **status boxes** | `ROADMAP.md` Phase 0 table | status |
| Edge schema (semantic/hebbian/provenance/created_at/pruned_at + history) | `phases/phase-0` §2 | design |
| Version-comparison validity (`embedding_version`, `src_versions`) | `phases/phase-0` §4; schema note in `RM-21` | design |
| Reactivation semantics (`prune_count`, preserve `created_at`, server-side only) | `phases/phase-0` §3 (0.4), §5 | design |
| Idempotency atomicity (dedup+weight commit together) | `phases/phase-0` §3 (0.3) | design |
| Lazy decay half-life math, per-type half-lives, clamp | `phases/phase-0` §3 (0.2), §7 | design |
| Save-time cost sweep (N=100…100k, pre-declared budget) | `phases/phase-0` §3 (0.1); box in `RM-21` | design + acceptance |
| Two-decays distinction (edge vs importance) | `phases/phase-0` §7; cross-refs in `BACKLOG.md` `RM-08`/`RM-21` | design |
| Phase 0 test list | `phases/phase-0` §3 (0.5); box in `RM-21` | design |
| Threat-model sketch (0.6) | `phases/phase-0` §3 (0.6), §8 | design |
| Phase 0 exit diagram | `phases/phase-0` §6; short form in `ROADMAP.md` build target | design + route |
| Phase 1 (activation) | `ROADMAP.md` Phase 1 boxes — **design doc deferred until committed** | status |
| Phase 2 (fusion/tracing, gate, competition, normalization, 2.5 metrics) | `ROADMAP.md` Phase 2 + promotion gate; `BACKLOG.md` `RM-05`/`RM-09`; `proposed/0003` | status + acceptance |
| Phases 3–8 | `ROADMAP.md` thin outlines — **design docs deferred until committed** | status |
| Product track `RM-01`…`RM-20` | `ROADMAP.md` table (mirrors `BACKLOG.md`) | status |
| Not-doing / success measures / dev loop / build target | `ROADMAP.md` | route |
| Accepted risks (route-level) | `ROADMAP.md`; mechanism-level → `phases/phase-0` §8 | route + design |

## New IDs created

- **`RM-21`** — Edge substrate unification (Phase 0). `BACKLOG.md`.
- **`phases/phase-0-edge-substrate`** — Edge substrate unification build spec (absorbed the
  drafted `proposed/0008`, which was deleted). Indexed in `ROADMAP.md` Phases table + `phases/`.
- **`phases/phase-1` … `phase-8`** — one buildable spec per phase, each with its own
  success/failure metrics + test plan (metrics *to be designed* where not yet grounded).

## Deliberately deferred (flagged for Samuel)

- **Phases 1–8 design docs.** Not written yet — "planned, not committed" + "the code must earn
  it" ⇒ no `proposed/` doc for an uncommitted phase. Their boxes live in `ROADMAP.md`; each gets a
  `proposed/NNNN` when the phase is actually started. Reverse this only on request.
- **Exact code line numbers.** The spec cited `server.js:110–140`, `memory-core.js:146/197–199`,
  `store.js:104–116`, `record.js:228`. Deliberately **not** transcribed — owning docs cite
  file + function (stable) instead of line numbers (which rot; the spec itself says re-verify).

## Not yet done in code (dissemination is docs-only)

Everything above is **documentation of intent**. No Phase 0 code was written. `BUG-008` was
already fixed upstream. Next real code step is `RM-21` / Phase 0.0 per `phases/phase-0`.

---

## Related

[[ROADMAP]] · [[ARCHITECTURE]] · [[BACKLOG]] · [[BUGS]] · [[phase-0-edge-substrate]] · [[proposed/README]]
