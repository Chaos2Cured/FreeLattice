# Phase 0 — Unify time & persistence (edge substrate) 🔀 ✅ **exit met**

**Backlog:** `RM-21` · **Depends on:** `RM-00` (golden gate), `RM-04` (temporal schema),
`BUG-008` (fixed in PRE-0) · **Scope owner:** this doc. Route + status: [[ROADMAP]].

> This is a **buildable, individually testable** work unit. It carries the full spec so it can be
> built and verified on its own. Deeper rationale that predates it lives in the RFCs it links
> under **Related**; this doc is the canonical build spec — where they disagree, this wins and the
> RFC is reference only.

---

## Scope — two mechanisms describing one idea

The associative substrate is today **two mechanisms with different lifetimes**, cooperating but
not unified:

```
field.js    semantic edges    ephemeral   rebuilt every recall    not persisted
ledger.js   learned weights   persistent  epoch-decayed (retired) JSON sidecar
edges.js    both signals      persistent  Hebbian wall-clock      .edges.json
```

Save-time edges are meant to be persisted, to compete, and to accrue Hebbian weight over time.
That only works if save-time and learned edges live in **one table**. Phase 0 unifies `field.js`
and `ledger.js` into a single persistent edge substrate with **independently stored semantic and
learned signals**, typed provenance, and shared temporal/competition machinery.

**Not one weight.** Collapsing `cosine(a,b)` and the Hebbian weight into a single scalar throws
away the distinction the whole design rests on, and contradicts Phase 2.1 (signals must stay
independently observable). **One edge substrate, two signals.**

### The asymmetry is load-bearing

| | Semantic | Learned (Hebbian) |
|---|---|---|
| Source | Derived from stored embeddings | Accumulated from use |
| If lost | Recomputable | **Gone forever** |
| Decays? | **No** — a structural fact, not a memory trace | Yes. Lazy wall-clock half-life (0.2); computed, not stored |
| Invalidated by | `edit()` re-embedding either endpoint | Nothing |

```
embedding            source of truth   (what the memory means)
edge semantic score  derived cache     (recomputable from the above)
hebbian weight       source of truth   (irreplaceable; nothing else encodes it)
```

Consequences that drive real behaviour: backup/export (`RM-17`) must preserve learned weight and
may drop semantic; a corrupt semantic score is recoverable, a corrupt learned weight is not; and
because `edit()` re-embeds, cached semantic scores must be validated by **version comparison
against their endpoints**, not by trusting an invalidation event to have fired.

This is a **migration with a compatibility path for existing `.assoc.json` sidecars**, not
greenfield — built fresh, it produces a second parallel associative system beside the one shipping.

---

## The unified edge record

```js
{
  a, b,                                           // endpoints (canonical: edgeKey sorts them)
  semantic: { value, src_versions: { a, b } },    // DERIVED cache; validity is a comparison
  hebbian:  { weight, last_updated },             // SOURCE OF TRUTH; the only thing that decays
  provenance: { origin, migrated_from },          // how the edge came to exist
  created_at,                                      // provenance only; never decay, never rank
  // last_accessed is deliberately ABSENT — persisting it means an edge write on every recall,
  //   which I5 forbids (the BUG-002 class). Hold it in memory or the AccessLog sidecar.
  pruned_at,                                       // current-state marker (null = active)
  prune_count, first_pruned_at, last_reactivated_at // bounded history (I8), O(1), no arrays
}
```

- **No bare `last_updated`** — it nests inside `hebbian`, the only thing it clocks. The nesting
  answers "does re-embedding update this?" before anyone asks.
- **`provenance.origin`** records *how the edge came to exist* (`save-time-neighbor` |
  `co-activation`), not what it currently is; state is read off the signals (`hebbian.weight === 0`
  is unreinforced). No bootstrap→learned *transition* — an edge simply accrues weight.
- **`provenance.migrated_from`** is separate, not an origin value: a legacy sidecar edge genuinely
  arose from co-activation, so folding migration into the origin enum would overwrite a true fact
  with a bookkeeping one. Record both.
- **`created_at`** is "provenance only" = never touches rank/decay/pruning, **not** unimportant.
  Only history tells these two apart: `created → never reinforced → pruned` vs.
  `created → reinforced 37× → decayed → pruned → reactivated → reinforced again`.

Preserved unchanged: bounded bonus `maxBonus·tanh(w)` (I2/I9), provenance-discounted reinforcement
(`alphaPP`/`alphaPN`/zero N↔N), fails-open (I3), discovery-not-ordering (I9 — primary cosine result
byte-identical field on/off).

---

## Validity by version comparison (not remembered invalidation)

Give each memory an `embedding_version`, incremented on every re-embed. An edge's cached
`semantic.value` is valid **iff** `semantic.src_versions` match both endpoints' current versions.
Stale is then *structurally self-evident* — no invalidation event has to fire, and none can be
silently missed. *(Event-based invalidation has a failure window: memory persists → invalidation
throws → embedding is v13 while the edge still describes v12, and nothing knows.)*

`embedding_version` is a **store schema change** — it lands in `record.js normalize()` alongside
the `RM-04` fields, defaulting existing records to `1`. **`BUG-008` dependency:** an embed
*failure* must never increment the version (that would falsely assert the vector is current).
Text-drifted-from-vector is a known, recoverable state that must stay distinguishable from a real
re-embed — which is why `BUG-008` was fixed in PRE-0 before this schema hardens.

---

## Build steps (each sub-phase is independently buildable + testable)

### 0.0 — Edge store unification 🔀 *(start here)*
- [x] One edge table, two signals, typed provenance. (`edges.js`, on the live recall path as of
      Slice C — `Ledger` is retired from recall/reinforce; Hebbian bonus/tick/save read
      `hebbian.weight` on the EdgeStore. Persists to `<store>.edges.json`, not `.assoc.json`.)
- [x] `embedding_version` in `record.js normalize()` (legacy rows default `1`).
- [x] Migrate every `.assoc.json` edge in: weight → `hebbian.weight`; stamp `hebbian.last_updated`
      + `created_at` at migration time (both **lower bounds** — note it); origin `co-activation`,
      `migrated_from: "assoc.json"`; semantic empty, computed on first use.
- [x] **Migration is one-way:** an old build reading a new sidecar fails cleanly, never silently
      drops edges. Signalled by top-level `kind: "resonance-edges"`; `readLegacyAssoc()` throws
      `IncompatibleEdgeFormatError` rather than returning a subset. Live path: if
      `<store>.edges.json` is missing, a leftover `<store>.assoc.json` is ingested and the
      old file is left untouched (downgrade-safe).
- [x] Preserve `field.js` constraint-rescue + mutual-kNN through the move (measured — [[RESULTS]]
      field experiment #2). Semantic kNN is still built at recall; save-time edges are
      persisted in 0.1 but recall does not read them yet.

### 0.1 — Edge timestamps & save-time edges
- [x] On `save()`, bind top-K semantic neighbors (start **K = 5**) above a min cosine (**0.25**;
      `field.js` uses 0.55 at *recall* — two thresholds, two jobs, see Risk #2 below). Recall
      still uses `field.js` for `Related:` — this slice persists the table, it does not switch
      the read path. (`memory-core.js` `bindSaveTimeNeighbors`; constants `SAVE_TIME_K` /
      `SAVE_TIME_MIN_COS`.)
- [x] Save-time edges store measured `semantic.value` (+ `src_versions` tagged to the
      **canonical** endpoints `edge.a`/`edge.b`, not save-argument order) and
      `hebbian.weight = 0` — **no seeded baseline** (an unreinforced edge's Hebbian signal is
      genuinely zero). `provenance.origin = "save-time-neighbor"`. No vector at save → bind
      nothing, don't throw.
- [x] **Cost sweep:** record `save_latency` p50/p95/p99 at N = 100 / 1k / 10k / 50k / 100k;
      **pre-declare** the p95 budget that triggers `RM-07` *before* running the sweep.
      Script: `eval/save-time-cost.js`. Table + verdict below.

#### Cost sweep (0.1) — pre-declared budget, measured table, RM-07 verdict

**Pre-declared p95 budget: 250 ms.** Written in `eval/save-time-cost.js`'s header before any
measurement ran. Reasoning: a `save_memory` tool call sits on the agent's turn; 250 ms is a
conservative "this tool is hanging" threshold for the *new* in-process work (well above a
768-d scan of a few thousand vectors, well below a one-second "did it crash?" beat). If
save-time binding's p95 crosses 250 ms at a store size users will actually hit (≤ 10k, the
BACKLOG JSONL ceiling), `RM-07` is mandatory, not scheduled.

Isolates neighbor scan + `EdgeStore.save` of K edges. Embed and JSONL rewrite are excluded —
JSONL `all()`-parse / full rewrite is a *known* `RM-07` driver; mixing it in would hide the
question this sweep exists to answer. Vectors are 768-d JS Arrays (production shape).
`K bound = 5` at every N (the trial vector is a mix of 5 existing records so the persist
path actually fires).

| N | trials | p50 (ms) | p95 (ms) | p99 (ms) | K bound | vs 250 ms |
|---|--------|----------|----------|----------|---------|-----------|
| 100 | 80 | 1.7 | 2.0 | 2.7 | 5 | UNDER |
| 1 000 | 40 | 2.0 | 2.4 | 2.6 | 5 | UNDER |
| 10 000 | 20 | 8.6 | 9.1 | 9.1 | 5 | UNDER |
| 50 000 | 12 | 38.2 | 45.5 | 45.5 | 5 | UNDER |
| 100 000 | 8 | 75.4 | 77.1 | 77.1 | 5 | UNDER |

Footnote — mature sidecar rewrite (`EdgeStore.save` of an already-full table, no scan). A
real store of N memories holds ~O(N) save-time edges rewritten on every bind; the N-sweep
sidecar only held the trial's K edges.

| edges | trials | p50 (ms) | p95 (ms) | p99 (ms) | bytes | vs 250 ms |
|-------|--------|----------|----------|----------|-------|-----------|
| 1 000 | 8 | 2.5 | 2.9 | 2.9 | 347 KB | UNDER |
| 10 000 | 8 | 11.1 | 12.6 | 12.6 | 3.5 MB | UNDER |
| 50 000 | 8 | 57.4 | 59.1 | 59.1 | 17.7 MB | UNDER |

**RM-07 verdict: NO-GO on forcing `RM-07` from this slice.** Scan p95 stayed ≤ 250 ms through
N=100k (77.1 ms). Combined with a 50k-edge sidecar rewrite (59.1 ms) still under budget at
the 10k JSONL ceiling. `RM-07` remains scheduled on the JSONL-rewrite / `all()`-parse grounds
already in BACKLOG. Caveat: a dense 100k-record graph (~250k unique K=5 edges) would
extrapolate the sidecar rewrite toward/over 250 ms on its own — incremental sidecar writes
travel with `RM-07` when it does land, but the *scan* did not force the date.

### 0.2 — Lazy wall-clock decay ✅ *(replaces `ledger.js tick()/decay()`)*
- [x] Decay applies to **`hebbian.weight` only** (semantic is structural, does not fade).
- [x] `effectiveHebbian(edge, now)` decaying from `now − hebbian.last_updated`; remove the
      recall-epoch clock; no background loop. (`edges.js`; `memory-core.js` recall no longer
      calls `tick()`. `tick()` remains on EdgeStore as the retired Ledger-parity copy —
      live path does not invoke it.)
- [x] **Reading never resets decay — this is where I6 became true.** `reinforceRecall` is
      untouched. Proof: 100 reads under a frozen clock leave `hebbian.weight` +
      `hebbian.last_updated` byte-identical; a genuine `reinforceRecall` then changes them.
- [x] Configurable **half-life**, not raw lambda: `lambda = ln(2)/halfLife`; per-type/namespace
      half-lives; normalize to seconds; clamp `delta = max(0, now − last_updated)`; verified
      monotonic. Shipped starting parameters (`HALF_LIFE_SECONDS` in `edges.js` — **parameters,
      not constants**):

      | type / namespace | half-life | seconds |
      |---|---|---|
      | `constraint` | ~30 days | `30 * 86400` |
      | `fact` (default) | ~7 days | `7 * 86400` |
      | `working` | ~1 hour | `3600` |

      An edge whose either endpoint is `is_constraint` uses the constraint class
      (`hebbianDecayType`). Override per store via `opts.halfLives` / `opts.halfLife`.
- [ ] Ships with `RM-08` (same decay/pruning surface) — see [[0006-constraints-decay-pruning]].
      The half-life table is the shared surface; `RM-08` *record* importance decay is still
      a separate law on a separate object.

### 0.3 — Materialize on mutation & idempotency ✅
- [x] On mutation: materialize effective weight → apply reinforcement to *that* → store → stamp
      `hebbian.last_updated` → keep provenance. Reinforcement can never bypass accumulated decay.
      (`edges.js` `_bump`: `w_eff = effectiveHebbian(edge, now)` then `setHebbian(w_eff + α, now)`.
      Δt=0 is a no-op on the stored value, which is why the golden does not move.)
- [x] **One MCP request ID = one mutation transaction.** Extract request IDs at the server
      boundary (`server.js` `handle` → `callTool(..., id)`); thread into mutations as
      `opts.requestId`. Two distinct requests reinforcing A↔B both apply; one request retried
      applies once. No id (eval, tests, panel) applies normally — never recorded, never crashes.
- [x] **Dedup record + weight change commit atomically** (I5 makes each write durable, not the
      *pair* atomic). Dedup LRU lives *inside the sidecar* (`processed_ids` on the envelope) so
      one `writeFileDurable` commits both. Claim is in-memory first (`acceptRequest`) so an
      in-process retry cannot double-apply before `save()`; the durable form is still one write,
      not a separate dedup-first file.
- [x] Bounded LRU of processed IDs (`DEDUP_LRU_SIZE = 256`); apply to **all** mutating edge
      ops (`reinforceRecall` and save-time bind). `edit`/`delete` are not edge writes and must
      not stamp a dedup record (transition table). Relates to `W-04` ([[BUGS]]) — orthogonal
      (same-process retry vs cross-process last-writer-wins).

### 0.4 — Soft pruning ✅
- [x] **An edge whose Hebbian signal decays to zero is not pruned if semantic still clears the
      gate** — it reverts to an unreinforced semantic edge. Prune only edges that are *both*
      unreinforced (`effectiveHebbian < HEBBIAN_PRUNE_FLOOR`, 1e-6) and semantically weak
      (`semantic.value < SEMANTIC_PRUNE_GATE`). *(This is why the two signals can't share one
      scalar: a merged weight would prune a semantically-strong, rarely-recalled pair and break
      constraint rescue — [[RESULTS]] field experiment #2.)*
- [x] **Soft prune first** (I8): mark inactive, set `pruned_at`, `prune_count++`, keep the
      record. `incident()` / `bonus()` / `weight()` skip `pruned_at != null`. Hard compaction
      is `EdgeStore.vacuum()`, explicit — mirror `JsonlStore.vacuum()`. Never automatic on
      read. `pruneSweep()` is the same class of operation as record `vacuum()`: MCP startup
      or on demand, **never** `recall()` / `save()`.
- [x] **Reactivation is server-side only** (guards I1): a consequence of an existing mutation
      (`save`/`edit` touching an endpoint, or `reinforceRecall` of the pair), never a new tool.
      Revive in place; `created_at` preserved; `hebbian.weight` / `hebbian.last_updated` carried
      (do not stamp `last_updated` — that would snap effective weight back to full);
      `pruned_at` → `null` while `prune_count`/`first_pruned_at`/`last_reactivated_at` keep
      bounded history.

#### Prune gate (0.4) — named, deliberate

| Constant | Value | Why this number |
|---|---|---|
| `SEMANTIC_PRUNE_GATE` | **0.25** | Equal to `SAVE_TIME_MIN_COS`. Below it, today's save-time bind would not even create the edge — it is not worth persisting as structure. Raising this to recall `minSim` 0.55 (or the constraint-rescue gate 0.45) would drop the 0.25–0.45 persist-net, including bridges stage-2 rescue can still walk. Do not silently unify the three. |
| `HEBBIAN_PRUNE_FLOOR` | **1e-6** | "~0" for the learned signal. The retired epoch floor of 0.05 would mark a single α=0.1 bump pruned after one half-life; that is not decayed-to-zero. `tanh(1e-6)·maxBonus` is a rounding error on any gate. |

Conjunction is the whole predicate. Reinforced+weak stays (Hebbian is enough). Unreinforced+strong stays (the failure-signature case). Only unreinforced+weak is marked `pruned_at`. Empty/null semantic counts as weak.

### 0.5 — Phase 0 tests ✅ *(see Test plan below)*
- [x] `test.js` is the Phase 0 contract. Section headers are keyed to the
      sub-phase / invariant they defend (`Phase 0.0` … `Phase 0.5`). Every
      transition-table row asserts the state change AND the `Writes?` column
      (I5). Every pre-declared failure signature has a test that fails if
      that bug is reintroduced. Interrupted/failed persistence atomic
      recovery is covered. No behaviour change; golden unmoved.

### 0.6 — Threat-model sketch ✅ *(design only; `RM-16` implementation stays gated to Phase 2)*
- [x] On paper: what can cause an edge to exist? raise Hebbian weight? make a memory a
      constraint-rescue bridge? survive indefinitely? Record that **semantic is recomputable,
      Hebbian is not** — a poisoned reinforcement is a durable *false memory*. Carry the answers
      that change at the Phase 2.2 gate into `RM-16`.
      Sketch: [`0009-edge-threat-model`](../proposed/0009-edge-threat-model.md). No code, no
      behaviour change. `RM-16` is not built here.

---

## Edge state transition table (PRE-0 ratifiable artifact)

The `Writes?` column makes **I5** checkable at a glance. Ratifying = every cell decided.

| Event | `semantic` | `hebbian.weight` | `hebbian.last_updated` | `created_at` | `pruned_at` | Writes? |
|---|---|---|---|---|---|---|
| **save** creates edge | compute + cache w/ `src_versions` | `0` | = `created_at` | set | `null` | yes |
| **save** where edge exists | recompute if versions stale | unchanged | unchanged | unchanged | unchanged | only if semantic recomputed |
| **recall** (read) | unchanged | unchanged — decay *computed*, not stored | unchanged | unchanged | unchanged | **no** |
| **reinforce** | unchanged | materialize decay → apply α | `now` | unchanged | `null` (reactivation) | yes, atomic w/ dedup record |
| **edit** endpoint | self-invalidates by version mismatch | unchanged | unchanged | unchanged | unchanged | **no edge write at all** |
| **soft prune** | unchanged | unchanged (keeps decayed value) | unchanged | unchanged | `now`, `prune_count++` | yes |
| **reactivate** | self-heals by version mismatch | unchanged | unchanged | **preserved** | `null`, `last_reactivated_at = now` | yes |
| **migration** | empty; computed on first use | imported from sidecar | migration time *(lower bound)* | migration time *(lower bound)* | `null` | yes, once |
| **hard compaction** | dropped with the edge | dropped | — | — | — | yes |

Filling this found a conflict: `last_accessed` cannot be a persisted edge field written on recall
(the `BUG-002` class **I5** prevents). It is **not written on the read path** — kept in memory or
batched through the `AccessLog` pattern. Telemetry does not get to violate an invariant.

---

## Success metrics

- **Golden set does not regress** (`npm run eval`) at **any** sub-phase boundary. This is the
  primary gate — do not proceed past a red one.
- **I6 true:** a store recalled N times under a **frozen clock** shows **zero** learned-edge decay;
  decay appears only as wall-clock advances.
- **Migration lossless + one-way:** every `.assoc.json` edge survives into the new store.
- **Stale-semantic self-heals:** an `edit()` bumps `embedding_version` so incident edges fail the
  `src_versions` match on next read **with no invalidation event run**.
- **Signals stay separate:** heavy reinforcement leaves `semantic.value` unmoved; decay-to-zero
  leaves the edge alive with semantic intact.
- **Cost sweep produces a decision:** the pre-declared p95 budget is compared against measured
  `save_latency`, yielding a go/no-go on `RM-07` — a *number*, not a guess.

## Failure signatures *(pre-declared — a clean pass is the alarm, not the trophy)*

- A read moves `hebbian.last_updated` or changes effective weight → I6 violated.
- An `.assoc.json` edge silently absent after migration → data loss; migration is not lossless.
- A stale semantic score served after an `edit()` with no version bump caught → validity broken.
- A corrupt sidecar throws or empties recall → I3 (fails-open) violated.
- A retried MCP request double-reinforces → idempotency broken.
- A merged/collapsed scalar prunes a strong-semantic rarely-recalled edge → constraint rescue
  regressed (the thing 0.4 exists to prevent).
- An embed *failure* increments `embedding_version` → `BUG-008` class reintroduced.

## Test plan *(fake clock throughout; every transition-table row incl. the negatives)*

- [x] Decay at multiple elapsed times · half-life math · negative clock deltas.
- [x] Persistence/reload; legacy `.assoc.json` migration (weight lands, nothing dropped).
- [x] **Signals stay separate** (reinforce → semantic unmoved; decay to zero → edge survives).
      *(reinforce: `setHebbian` leaves `semantic` byte-identical. 0.2: computed decay-to-zero
      leaves the edge present with semantic intact; stored weight is unmoved. Soft-prune of
      the zero-Hebbian case is 0.4.)*
- [x] **Stale semantic structurally detectable** (edit → version++ → incident edges fail
      `src_versions` on read, no event run; also: persist memory, crash before touching edges,
      edge still seen stale).
      *(module-level: bump the version argument to `semanticValid`, no invalidate() exists.
      The edit() wiring + crash-before-edge-write case is Slice C.)*
- [x] `edit()` with a dead embedder does **not** increment `embedding_version`.
- [x] **Reading does not drive the decay clock (I6):** read one edge 100× under a frozen
      clock → weight + `last_updated` unchanged, *then* genuine reinforcement does change
      them. Live path: 100 field-on recalls do not decay an uninvolved edge and do not
      increment the leftover `recalls` counter. Co-recall reinforcement is retained.
- [x] Reactivation preserves history (`created_at` unmoved, `prune_count === 1`, weight carried).
      *(0.4: `reactivateEdge` / `reactivateIncident`; live path: `edit` of an endpoint, confirming
      `save`, save-time bind of a pruned pair, `reinforceRecall` of a pruned pair.)*
- [x] Save-time edges (creation, K=5, 0.25 threshold, fewer-than-K, weight starts 0,
      semantic cached with canonical `src_versions`, origin `save-time-neighbor`;
      embedder-down binds nothing; `edit()` bumps version so the incident edge reads
      stale with no invalidation event).
- [x] Reinforcement after long inactivity materializes decay first.
      *(module-level: one fact half-life idle → stored = decayed+α, not original+α;
      Δt=0 matches the pre-0.3 / Ledger number. Live path uses the same `_bump`.)*
- [x] Soft-pruned edges survive persistence; duplicate reinforcement / request-ID dedup.
      *(request-ID half is 0.3: same id once, two ids both apply, no-id always applies,
      LRU eviction, one sidecar write holds id+weight. Soft-prune persistence is 0.4:
      `pruned_at` survives reload; `incident()` skips it; `vacuum()` is the hard drop.)*
- [x] Interrupted/failed persistence, atomic recovery.
      *(0.5: leftover `.tmp` is ignored — the target is still the complete previous
      document; a leftover tmp with no target is not ingested (fail-open empty);
      `writeFileDurable` on failure unlinks its temp and does not clobber the live
      file; `EdgeStore.save` failure does not throw or empty the in-memory table.)*
- [x] **Field fails open (I3):** corrupt sidecar → recall still returns cosine.
- [x] Negatives: recall writes nothing to the edge store **on the decay account**; edit
      writes nothing to the edge store.
      *(edit: tested, no edge write unless reactivation (0.4) actually revives a pruned
      row. recall-the-verb still co-issues `reinforceRecall` + sidecar save — that write
      is the SIDECAR, not the JSONL store (I5), and is the retained co-recall path.
      Field-off recall writes nothing at all (0.5). `tick()` is gone. Decay does not
      move `last_updated` or stored weight. Save-where-exists with fresh `src_versions`
      does not rewrite the sidecar.)*

---

## The two decays, kept distinct

| | Object | Signal | Law | Clock | Owner |
|---|---|---|---|---|---|
| **Learned-edge decay** | an *edge* | `hebbian.weight` | half-life `w·2^(−Δt/H)` then soft-prune iff also semantically weak | **wall-clock** (this doc) | `RM-21` / Phase 0.2+0.4 |
| **Importance decay** | a *record* | `importance` | `importance·exp(−λ·Δt)`, refreshed on access/confirm | wall-clock | `RM-08` / [[0006-constraints-decay-pruning]] |

Never wire one into the other — a single `Δt` for both couples association strength to record
retention, the hidden coupling that inverts behaviour under load.

## Risks

1. **Save-time cost measured (0.1).** Pre-declared p95 budget 250 ms. Scan p95 at N=100k is
   77.1 ms → **NO-GO on forcing `RM-07` from this slice.** JSONL rewrite / `all()`-parse
   remains the scheduled driver. See the 0.1 table.
2. **Two cosine thresholds disagree, on purpose.** Recall `minSim` 0.55 (tight gate for what
   *surfaces* in `Related:`) vs. save-time bind 0.25 (looser net for what's *worth persisting*).
   Named constants `SAVE_TIME_MIN_COS` vs. `field.js` `minSim`; do not silently unify them.
3. **`null`-through-`Object.assign` class** (`BUG-008` is one instance) — sweep every
   `store.update()` caller before 0.0 adds more.
4. **Edge inheritance across supersession undecided** (Phase 7 — [[phase-7-reconsolidation]]) — the
   quietest data-loss path; deferred there on purpose.
5. **Migration is one-way** — the learned signal is irreplaceable, so `RM-17` (backup) rises.
   Threat-model sketch (0.6): [[0009-edge-threat-model]] — a poisoned reinforcement is the
   same irreplaceable asset, read as a false memory.
6. **Cached semantic scores are derived** — residual cost is recompute-on-read for stale edges + a
   periodic full-recompute escape hatch for bulk drift.

## Exit

```
A ↔ B    semantic → unchanged by time; recomputed only when an endpoint's version moves
         hebbian  → time passes → decays mathematically
read     → last_accessed moves in memory/AccessLog only; no edge write; no decay change
reinforce→ decayed weight materialized → α applied → last_updated stamped → durable
edit A   → version++ → incident edges structurally stale on next read → hebbian untouched
```

**Exit met (Phase 0.6).** The mechanism criteria hold:

| Criterion | Held by |
|---|---|
| Golden green and reliable | `npm run eval` → "No regressions vs golden." (reconfirmed 0.6; no code change) |
| I6 held | 0.2 — lazy wall-clock `effectiveHebbian`; `tick()` gone from recall |
| I8 held for edges | 0.4 — `pruneSweep` marks `pruned_at`; `vacuum()` is the explicit hard drop |
| Migration lossless + one-way | 0.0 — every `.assoc.json` edge survives; old reader refuses the new sidecar |
| Signals stay separate | 0.5 contract — reinforce leaves `semantic` unmoved; decay-to-zero leaves the edge alive |

Not in this exit (named, deferred, not forgotten): `superseded → inherited?` is Phase 7;
`RM-08` *record* importance decay is a different law on a different object; recall still
rebuilds semantic kNN in `field.js` and does not read the cached semantic signal (0.1
explicitly persisted the table and did not switch the read path).

Next: [[phase-1-transient-activation]]. Threat-model carry-forward for the Phase 2.2
gate: [[0009-edge-threat-model]].

---

## Related

[[ROADMAP]] · [[BACKLOG]] · [[ARCHITECTURE]] · [[BUGS]] · [[phase-1-transient-activation]] · [[phase-2-retrieval-dynamics]] · [[0006-constraints-decay-pruning]] · [[0005-store-abstraction]] · [[0009-edge-threat-model]] · [[RESULTS]] · [[eval/README]] · [[CLAUDE]] · [[roadmap-dissemination-log]]
