# Resonance Memory — backlog

Itemized work, each with acceptance criteria you can actually check off. Phases and rationale
live in [`ROADMAP.md`](ROADMAP.md); deep designs in [`proposed/`](proposed/).

**Effort key:** S = hours · M = a day or two · L = a week · XL = multi-week
**Status:** `todo` · `in progress` · `done` · `deferred`

**Invariant reminder for every item below:** the public tool surface stays at **four verbs**
(`save_memory` / `recall_memory` / `edit_memory` / `delete_memory`). Everything here lands in
the substrate. If an item seems to need a fifth verb, the design is wrong.

---

## Phase 0 — Measurement

### `RM-00` — Evaluation harness and corpora · **XL** · ✅ `done` — core harness shipped & in use
> *Blocked everything; it now exists. Built `2026-07-29` (`cf70448`), and every field
> experiment since ran against it. Extended corpora/metrics travel with the features they test.*

Build `eval/` with seeded, offline, reproducible scoring.

- [x] Fixture corpora in `eval/corpora/*.jsonl`: `basic`, `contradictions`, `constraints`,
      `adversarial`, plus `field-noise` / `field-stress`. *(`duplicates` landed with RM-02.a
      as a measurement corpus — skipped by the golden runner. `messy` landed with RM-01.a.
      `temporal` still lands with a later RM-04 expansion.)*
- [ ] ≥50 contradiction/update cases — **the axis LOCOMO and LongMemEval both under-test.**
      *(4 today; expand as RM-03 detection matures.)*
- [~] Metrics: `recall@k`, `duplicate_rate`, `extraction_precision`,
      `extraction_recall`, and `mrr` shipped as **reporting** metrics (registry in
      `eval/metrics.js`; `node eval/measure.js`; not folded into `golden.json`),
      plus the field-experiment **ROC / TBR** split.
      *(`staleness_rate`, `false_supersession` still land with RM-03.)*
- [x] Constraint cases run with the field **off and on**; report both and the gap.
- [x] Repeated cases (`repeat` / `contains_by_turn`) keep one store across turns and report
      `first_hit_turn`, so a constraint that lands by turn 4 isn't scored as a miss.
- [x] `npm run eval` → scorecard table. *(`--json` for CI still pending.)*
- [x] Golden-set regression gate: any metric drop fails with a diff of which cases flipped.
- [x] Deterministic: fixed seeds, cached embeddings committed, **no network, no API key**.
- [x] Runs in <60s on a laptop.
- [x] PR-path CI (`.github/workflows/ci.yml`) runs the golden on every
      push to `main` and every pull request. Complements the RM-11
      release matrix, which only runs on a tag.

**Acceptance:** a deliberately-broken change (e.g. rank by recency) is caught by the gate.

**Why it's XL and worth it:** this is the difference between *"it has a conflict handler"* and
*"the conflict handler rarely makes things worse."* See `proposed/0007`.

---

## Phase 1 — Write path

### `RM-04` — Temporal metadata · **S** · ✅ `done`

- [x] Add to the record: `valid_from`, `valid_to` (null = currently true), `last_confirmed`,
      `superseded_by`, `supersedes`, `revision`, `needs_review` — in `record.js`.
- [x] `normalize()` backfills all of them for legacy rows — **no migration script, no breaking
      change**. Covered by tests incl. the oldest `ts`-only shape.
- [x] `save_memory` sets `valid_from = now`, `last_confirmed = now`.
- [x] Re-saving an *identical* memory bumps `last_confirmed` instead of appending a duplicate.
      (Near-duplicate detection shipped in `RM-02.b`.)
- [x] `store.current()` excludes superseded; `active()` keeps history.
- [x] Recall answers from current facts; superseded surface only on explicitly historical
      queries and are labelled "no longer current".
- [x] Panel: superseded nodes dimmed in the 3D graph, counted separately, flagged on hover.
- [x] `supersedePatches()` + `updateMany()` land a supersession as one atomic write — ready
      for `RM-03` to call.

**Shipped alongside:** `record.js` (shared schema), `store.js` (storage seam extracted from
`server.js`), `test.js` (the test suite), and the fixes for `BUG-001` / `BUG-002` / `BUG-007`
(the last one introduced *by* the `BUG-002` fix) — see [`BUGS.md`](BUGS.md).

**Remaining for `RM-03`:** the *detection* logic that decides when to call `supersedePatches`.

Design: [`proposed/0002`](proposed/0002-temporal-supersession.md).

---

### `RM-01` — Write-side extraction and summarization · **L** · ✅ `done` — 01.a + 01.b + 01.c shipped

A **tiered** pipeline. Cheap deterministic work first; the LLM pass is optional, local,
off by default, and never blocks the save.

- [x] **01.a measurement seed**: `extraction_precision` registry, `eval/corpora/messy.jsonl`,
      pre-extraction baseline + pre-declared 0.9 bar in
      [`eval/RESULTS.md`](../eval/RESULTS.md). Product behaviour unchanged.
- [x] **Tier 0 (always on, no LLM):** trim, normalize whitespace, strip filler openers
      ("I think you should know that…"), drop imperatives aimed at the assistant, split
      multi-fact runs on `; ` / ` and also ` when both halves stand alone.
      Implemented against corpus gold, not 0001's regexes as-is (long openers;
      `make sure you` / `remember to remind me`; conservative no-split on the honey trap).
- [x] **Tier 1 (always on):** secret/PII guard — refuse to store anything matching
      API-key/password/card shapes; return a clear refusal string. Refusal not
      redaction; `\b[0-9]{13,16}\b` does not eat `4821` / `1500mg`. Prefixes
      widened past 01.b for 2026 issued shapes (`github_pat_`, real `ghp_`,
      `sk-proj-`/`sk-ant-`, Slack `xapp-`, Stripe `sk_live_`/`rk_live_`, Google
      `AIza…`, HuggingFace `hf_`, Groq `gsk_`, AWS `ASIA`, OpenSSH PEM, JWT,
      `passphrase:` / high-entropy `api_key=`). Match the token, not the
      English — "the secret is browning the butter" still stores. Stripe
      publishable `pk_live_` is not refused.
- [x] **`extraction_recall`** registry (anti-cheat for vacuous precision). A/B in
      [`eval/RESULTS.md`](../eval/RESULTS.md) RM-01.b: precision 0.2609 → **1.0000**,
      recall@5 held at **1.0000**, pii_refusal_rate 0 → **1.0000**.
- [x] **Tier 2 (opt-in, local):** a single-pass extraction prompt against the *already
      configured local endpoint* (or MCP sampling), emitting `{facts: [...], skip: bool}`.
      One call, ADD-only, conflict resolution deferred to `RM-03` — mirroring Mem0's 2026
      move that cut write-time LLM calls 60–70%. Off by default. Capability-detect:
      sampling **or** a non-embedding chat model at `/v1/models`.
- [x] Tier 2 failures degrade silently to Tier 0/1. **A save never fails because extraction did.**
- [x] Panel toggle, same live-config pattern as the associative field. Surfaced when a
      capable model is detected ("a capable model is available — enable LLM extraction?").

**Acceptance:** `extraction_precision ≥ 0.9` on `eval/messy` with Tier 2 off; Tier 2 improves
recall@5 without lowering precision; write latency p95 unchanged when Tier 2 off.
**Met (01.b):** messy precision 0.2609 → **1.0000**, recall@5 held, pii_refusal 1.0.
**Met (01.c):** messy-hard A/B in [`eval/RESULTS.md`](../eval/RESULTS.md) —
`openai/gpt-oss-20b` temp 0: `extraction_recall` 0 → **0.5833**, `recall@5`
0 → **0.5833**, precision 0 → 0.3023 (did not drop; the extra 0.70
anti-flood floor missed because the model over-extracted unlabeled true
details, not invented facts).

Design: [`proposed/0001`](proposed/0001-write-pipeline.md).

---

### `RM-02` — Deduplication and merge · **M** · ✅ `done` — 02.a + 02.b + 02.c shipped

- [x] **02.a measurement seed**: metric registry (`recall_at_k`, `duplicate_rate`),
      `eval/corpora/duplicates.jsonl`, pre-dedup baseline + pre-declared 50% bar in
      [`eval/RESULTS.md`](../eval/RESULTS.md). Product behaviour unchanged.
- [x] Near-duplicate detection at save: cosine ≥ `DEDUP_HI` (0.95) → treat as restatement.
- [x] Restatement → bump `last_confirmed` + `access_count`, do **not** append.
- [x] Band `DEDUP_LO..DEDUP_HI` (0.88–0.95) → candidate merge; keep the longer/more specific
      text, union the metadata, link the loser with `superseded_by`.
- [x] Thresholds are config, not constants, and are **tuned on `RM-00`, not vibes**.
      (`DEDUP_HI` 0.95 / `DEDUP_LO` 0.88; env + live-config; A/B in RESULTS.md.)
- [x] Backfill mode: `--dedup-existing` reports what it *would* merge before doing it.
      Dry-run is the default; `--apply` performs one durable rewrite. Same
      `detectNearDuplicate` / `pickMergeSurvivor` / `mergeBandPatches` as save()
      (file-order pass, each record vs earlier survivors). Second `--apply` is a
      no-op. Vectorless rows are skipped, not merged blind.

**Acceptance:** `duplicate_rate` drops ≥50% on `eval/duplicates` with zero recall@5 regression.
**Met (02.b):** 0.3182 → **0.0000** (100% drop), `recall@5` held at **1.0000**. See
[`eval/RESULTS.md`](../eval/RESULTS.md) RM-02.b.
**Met (02.c):** the same 02.a-shaped store (save-time dedup bypassed) backfills
to the same after-column: dry-run plan is 4 HI restatements + 3 mid merges;
`--apply` → `duplicate_rate` 0.3182 → **0.0000**, `recall@5` held at **1.0000**.
See [`eval/RESULTS.md`](../eval/RESULTS.md) RM-02.c.

---

### `RM-03` — Contradiction and supersession · **L** · `in progress` — v1 (cue-gated) shipped & ON

Follow Graphiti's proven shape: **invalidate, never delete.** v1 landed in `b143e2d`
(cue-gated, argmax-limited, on by default — worst case retires nothing).

- [x] On save, find high-similarity prior memories that are *not* duplicates (the
      "same subject, different value" band) via a contradiction check.
- [~] Detection: **explicit correction markers shipped** (cue-gated — "actually", "now",
      "no longer", "moved to"…, argmax-limited). *(negation-flip and numeric/date-change
      heuristics + optional Tier 2 LLM adjudication reusing the `RM-01` endpoint: still open.)*
- [x] On confirmed contradiction: set old `valid_to = new.valid_from`, `superseded_by = new.id`.
      **Both rows are kept** — non-overlapping validity chain, history preserved. *(first live
      writer of the bi-temporal model, via `supersedePatches()`.)*
- [x] Recall prefers current facts; superseded surface only when the query is explicitly
      historical ("used to", "before", "last year").
- [~] Ambiguous cases keep **both** and mark `needs_review` — never guess destructively.
      *(the conservative cue-gate covers this today; richer adjudication rides with the
      heuristics above.)*

**Acceptance:** `staleness_rate` drops ≥70% on `eval/contradictions`; **zero** cases where a
still-true fact is wrongly invalidated (this metric is a hard gate — a false supersession is
worse than a miss).

Design: [`proposed/0002`](proposed/0002-temporal-supersession.md).

---

## Phase 2 — Retrieval and shape

### `RM-21` — Edge substrate unification (one store, two signals) · **L** · ✅ `done` — **roadmap Phase 0, exit met** 🔀

> **Migration, not greenfield.** `field.js` (static kNN, rebuilt per recall, persists nothing)
> and `ledger.js` (Hebbian sidecar, persists, decays on a recall-count clock) merge into **one
> persistent edge store with two independent signals**: `semantic` (derived / recomputable) and
> `learned` (source-of-truth / irreplaceable). Building it fresh produces a *second* parallel
> associative system beside the one already running. Design: [`phases/phase-0`](phases/phase-0-edge-substrate.md).

- [x] **PRE-0:** `BUG-008` fixed (see [`BUGS.md`](BUGS.md)). Phase-0 cells of the edge
      state-transition table are decided. The `superseded → inherited?` cell is a
      deferred-decision (Phase 7), not a Phase 0 exit miss.
- [x] **0.0** One edge store, two signals (semantic derived, learned source-of-truth), typed
      provenance. `embedding_version` added to `record.js normalize()` (defaults legacy rows to
      `1`). **Migrate every `.assoc.json` edge in, one-way**: an old build reading a new sidecar
      fails cleanly, never silently drops edges. `field.js` constraint-rescue + mutual-kNN
      preserved through the move. Live path is `EdgeStore` (`<store>.edges.json`); `Ledger` is
      retired from recall/reinforce.
- [x] **0.1** Save-time semantic edges (K=5, cosine 0.25, `hebbian.weight=0`) + edge timestamps.
      **Cost sweep:** `eval/save-time-cost.js`; pre-declared p95 budget 250 ms; measured p95 at
      N=100k is 77.1 ms → **NO-GO on forcing `RM-07` from this slice.** Table in
      [`phases/phase-0`](phases/phase-0-edge-substrate.md). Recall still uses `field.js`.
- [x] **0.2** **Lazy wall-clock decay of the learned signal** (configurable half-life), replacing
      the recall-count clock (`ledger.tick`). `reinforceRecall` untouched — **this is where `I6`
      became true.** Not `RM-08` *importance* decay (different object, different law — see there).
      Starting half-lives (parameters, seconds): constraint 30d · fact 7d · working 1h.
- [x] **0.3** Materialize-on-mutation + MCP request-ID idempotency. **Dedup record and weight
      change commit atomically** (LRU of processed JSON-RPC ids lives inside the sidecar
      envelope, one `writeFileDurable`). Relates to `W-04` (orthogonal: this is same-process
      retry, not cross-process last-writer-wins).
- [x] **0.4** Soft pruning — an edge whose learned signal hits zero survives if semantic still
      clears the gate (`SEMANTIC_PRUNE_GATE` 0.25 = save-time bind). Mirror soft-delete +
      `vacuum()` (`I8` now held for edges). **Reactivation is server-side only**
      (I1): revive in place, `created_at` preserved, `prune_count`/`first_pruned_at`/
      `last_reactivated_at` kept bounded; no `reactivate_edge()` tool.
- [x] **0.5** Phase 0 tests — every transition-table row incl. the negatives (recall/edit write
      nothing to the edge store), *reading ≠ decay-clock advance*, *signals stay separate*,
      *stale-semantic self-heals by version compare*, *fails-open*. `test.js` is the
      Phase 0 contract (section headers keyed to sub-phase / invariant).
- [x] **0.6** Threat-model sketch (design only; `RM-16` implementation stays gated to Phase 2).
      [`proposed/0009`](proposed/0009-edge-threat-model.md). No code. Carry-forward is the
      `RM-16` requirements at the Phase 2.2 gate, not an implementation here.

**Acceptance:** the `RM-00` golden set does **not** regress at any sub-phase boundary
(`npm run eval`); a store recalled N times under a frozen clock shows **zero** learned-edge decay;
migration is lossless and one-way; an `edit()` bumps `embedding_version` so incident edges fail the
`src_versions` match on next read **with no invalidation event run**; a corrupted edge store
degrades to plain cosine with no throw. Full criteria + mechanism in
[`phases/phase-0`](phases/phase-0-edge-substrate.md).

> **Ordering:** unify the substrate **before** tuning what sits on it (`RM-09`) or promoting a
> fusion arm (`RM-05`) — tuning against a substrate that is about to change tunes noise.

---

### `RM-05` — Hybrid retrieval · **M** · `todo`

> **⚠️ Touches the "ranking = cosine only" invariant.** Ships behind a flag, off by default;
> promoted only on an A/B win, and `DEVELOPERS.md` is amended in the same PR with the
> measurement that earned it. Unmeasured rank changes stay forbidden.

- [ ] Promote `keywordScore` from *fallback-only* to a **first-class retrieval arm** (BM25-ish).
- [ ] Fuse with **Reciprocal Rank Fusion**, `score = Σ 1/(k + rank_i)`, `k = 60` (standard;
      RRF fuses *ranks*, sidestepping the score-incompatibility that breaks weighted averaging).
- [ ] Optional third arm: graph neighborhood from `field.js` as a fusion input.
- [ ] Flag `RESONANCE_MEMORY_HYBRID` + panel toggle.
- [ ] A/B on the golden set; publish the delta either way.

**Acceptance:** RRF beats cosine-only on `recall@5` and `MRR`, **or** it is dropped and the
negative result is written down (a negative result is a real deliverable here).

**Promotion gate (all four, per `ROADMAP.md`).** Fusion becomes default *only* when: (1) an A/B
win on the `RM-00` golden set — **the metrics it needs (`MRR`, `staleness_rate`,
`false_supersession`, `duplicate_rate`) don't exist yet** and building them is a prerequisite
(they land with the features they test — see `RM-00`); (2) `RM-21` has landed (competition +
normalization must exist before learned weight enters rank, or ranking reinforces what already
ranked); (3) `RM-16` (poisoning defense) has landed; (4) `DEVELOPERS.md` + `CLAUDE.md` amended
in the same PR with the measurement that earned it. A failed gate keeps the flag off and writes
the negative result down.

Design: [`proposed/0003`](proposed/0003-hybrid-retrieval.md).

---

### `RM-08` — Soft constraints, decay, pruning · **M** · `todo`

- [ ] **Soft constraints** as a first-class memory kind (`kind: "constraint"`): "I'm diabetic —
      no sugary recipes."
- [ ] **Start by measuring what already works.** `field.js` + `ledger.js` *already* surface
      constraints by association and *already* strengthen that path with use — the Hebbian
      bonus is applied before the `minSim` gate, so a reinforced edge clears a gate that raw
      cosine misses. Run `constraint-learning` and the `field: true` / `false` pair
      (`proposed/0007`) before writing any new retrieval code.
- [ ] Two small fixes, if measurement shows they're needed: **seed constraint edges at write
      time** (cold start — the loop can't reinforce an edge that never fired once), and allow
      **2 hops for `kind: "constraint"`** (one hop can't carry dog→walk→diabetes→sugar).
- [ ] **Reserved slot** (~10 lines) for the cold-start case only.
- [ ] The domain-probe machinery in `proposed/0006` is **probably redundant** — it statically
      reimplements what the field does dynamically. Build only if the above doesn't close it.
- [ ] **Importance decay** (a *retention* signal on **records**): `importance *= exp(-λ·Δt)`,
      refreshed on access/confirm. Distinct from `RM-21`'s **learned-edge** decay (an
      *association* signal on **edges**) — different object, different law; never wire one into
      the other (see [`phases/phase-0`](phases/phase-0-edge-substrate.md) §5).
- [ ] Pruning proposals surfaced **in the panel for review** — never silent deletion.
- [ ] Never auto-prune anything with `kind: "constraint"` or a manual pin.

**Acceptance:** constraint memories appear in ≥90% of topically-related recalls in
`eval/constraints`, **reported with the field both off and on** — the gap is what the
associative field is worth, and it may show most of this item is already done. No unreviewed
deletions, ever.

---

### `RM-09` — Neighborhood and Hebbian tuning · **M** · `todo`

> Our actual differentiator. Tune it *after* Phase 1 (or you're tuning noise in a store full of
> duplicates and contradictions) **and after `RM-21`** — tune the *unified* substrate, not the
> two pre-unification mechanisms that are about to merge.

- [ ] Sweep `k`, `minSim`, hop count, decay rate, bonus cap against `RM-00`.
- [ ] Asymmetric edges (A→B ≠ B→A) — association is directional in minds.
- [ ] Edge *types*: semantic / co-activation / supersession / constraint-bridge, distinctly
      colored in the 3D panel.
- [ ] Revisit the bounded `cosine + 0.3·tanh(w)` blend now that there's a measurement to justify it.
- [ ] Guard the invariant: co-activation still **expands** the candidate set, never reorders
      the primary cosine result — unless `RM-05`'s A/B says otherwise, explicitly.

**Acceptance:** measured lift on multi-hop association cases with no regression on direct recall.

---

## Phase 3 — Scope and scale

### `RM-07` — Store abstraction + SQLite backend · **L** · `todo`
> **Update:** the *data-loss* half of this is **fixed** — writes are atomic and recall no
> longer rewrites the store (`BUG-001`/`BUG-002` in [`BUGS.md`](BUGS.md)). What remains is the
> *performance* half: `all()` still parses the whole store per call, and mutations still
> rewrite the file. Comfortable ceiling was **estimated** at ~10k memories. **S1
> measured it (2026-09-05):** field-off `recall()` p95 **489 ms at N=10k** (bar was
> 100 ms → RM-07 GO). A 50k store with embeddings in the JSONL is 834 MB and
> **cannot load** (`readFileSync` exceeds Node's ~512 MB string cap). Field-on at
> 10k is 91 s (`field.buildEdges` O(n²), W-03). Quality is a separate finding
> (13/24 needles stay rank-1 at 100k; underspecified / same-frame queries fail
> at 1k already). Curve: [`eval/RESULTS.md`](../eval/RESULTS.md) "S1". Phase 0.1's
> save-time neighbor scan is **not** this: scan p95 at N=100k is 77.1 ms vs. a
> pre-declared 250 ms budget (`eval/save-time-cost.js`).

- [x] Extract the storage layer into its own module (`store.js`) so it can be constructed and
      tested without starting the MCP stdio loop.
- [ ] Formalize the documented `Store` interface (`touch`, `searchDense`, `searchSparse`) —
      the seam exists now but still leaks JSONL assumptions. `searchDense` is a later
      slice (the 100k-bar shave; product S1 already clears 100 ms at 100k on the
      JsonlStore surface via the in-process cache).
- [x] Add `SqliteStore` — drop-in behind the JsonlStore surface (`store-sqlite.js`).
      WAL + `synchronous=FULL`, BLOB embeddings, in-process Float32 cache, JS cosine.
      **No sqlite-vec** (spike: slower at 10k–100k + SEA packaging). Selectable via
      `RESONANCE_STORE` / live-config `store`; **SQLite is the default** as of
      slice 4 (`RESONANCE_STORE=jsonl` pins JSONL). Product S1 (2026-09-05): **loads 50k (196 MB) and 100k (392 MB)**;
      field-off cached recall p95 **49.6 ms @50k, 96.4 ms @100k** (JSONL cannot
      load either). Opaque ids preserved; `created` is a real column; access
      counts in-table (never `AccessLog` — BUG-007). FTS5 / `searchSparse` wait
      on RM-05.
- [x] Conformance test suite both backends must pass identically. `test.js`
      "Store conformance" + I5-SQLite BUG-002, id-preservation, created-preservation,
      normalize() typed-array trap. (`touch` / `searchDense` not on this slice's
      surface.)
- [x] Streaming JSONL→SQLite migrator (`migrate-sqlite.js`, `--migrate` /
      `npm run migrate`). 10-step protocol: stream (never `readFileSync`),
      preserve ids, fold AccessLog once at ingest (BUG-007), count-verify,
      WAL checkpoint, atomic `.db` rename, **then** JSONL → `.jsonl.bak`.
      `.bak` is a recovery snapshot, not the sovereignty export. Kill-9
      before the rename leaves the JSONL live; re-run completes. 50k/768-d
      proof: lossless in 2.5 s against a 785 MB JSONL that `readFileSync`
      cannot load. Slice 4's `openStore()` calls the same function on first open.
- [x] JSONL export / zip bundle (slice 2b) — the live sovereignty artifact.
      `--export` writes a ZIP64 zip (Desktop, `--name` / `--out`, never-overwrite)
      with `memories.jsonl` (embeddings as arrays; a competitor reads it without
      our exe), `memories/YYYY/MM/DD/<id>-<slug>.json` (no vectors), `catalog.txt`,
      `edges.json` (Hebbian; `processed_ids` out), `manifest.json`, `README.txt`.
      `--export-jsonl` stays as the raw primitive. Read-only. 50k proof: 34.3 s,
      387 MB zip, 50k/50k lossless, Windows opens, ZIP64 at 70k entries.
      Panel button is slice 2c (shipped).
- [x] Panel export button (slice 2c) — confirm modal, heartbeat pause + yield,
      POST `/api/export` shells 2b, toast + copy-path + Windows reveal.
      Not an MCP tool. Empty store still exports. User store, never demo-seed.
- [x] Transparent one-way migration on first open (slice 4 default switch).
      SQLite is the default. `openStore()`: jsonl pin → JsonlStore; `.db`
      exists → SqliteStore (leftover JSONL → `.bak`); JSONL only → auto-migrate
      via the 2a protocol (fail-open to JSONL if it throws before the atomic
      rename); neither → fresh `.db`. Downgrade honesty: `.bak` is a recovery
      snapshot, not a two-way door. `node eval/run.js` (sqlite default) and
      `--store jsonl` both 27/31.
- [x] JSONL stays the default until SQLite passes conformance + eval parity.
      Conformance green. Golden parity (slice 3): SqliteStore matches JSONL
      **27/31 case-for-case**. Slice 4 flipped the default after 2c (panel
      export) so migration did not open a lock-in window.
- [x] Edges-in-db (slice 5). EdgeStore API unchanged; SQLite persistence
      adapter shares the SqliteStore connection. `processed_ids` + weight
      UPDATE are one txn (0.3 atomicity fix). I6: `effectiveHebbian`
      computed-on-read, never stored. I3 crash-domain: an edges write
      failure leaves memories recallable. Leftover `.edges.json` migrates
      on first-open (count-verify, sidecar → `.bak`). Export reads edges
      from the table. Phase 0.2–0.5 matrix green on both adapters. Golden
      27/31 unmoved. One-file sovereignty is complete; `searchDense` is
      only-if-250k+.

**Acceptance:** 100k memories, recall p95 <100ms, no full-file rewrite; both backends
byte-identical on the eval scorecard.

Design: [`proposed/0005`](proposed/0005-store-abstraction.md) (seam) ·
[`proposed/0010`](proposed/0010-sqlite-backend.md) (measured backend).

---

### `RM-06` — Scoping: multi-user, multi-agent, session vs long-term · **L** · `todo`

- [ ] Record fields: `scope` (namespace), `agent_id`, `session_id`, `tier` (`session` | `long_term`).
- [ ] Scope resolution from MCP client identity / env, **never** from a model-supplied argument
      (a model must not be able to read another scope by asking).
- [ ] Recall defaults to `long_term` + current `session`; cross-scope reads require explicit config.
- [ ] Promotion path: session memories that recur get promoted to long-term (ties into `RM-10`).
- [ ] Panel: scope switcher; the 3D graph filters per scope.

**Acceptance:** an eval case proves agent A cannot recall agent B's memories; session memories
expire on schedule while long-term persists.

---

### `RM-10` — Idle-time consolidation ("sleep-time compute") · **M** · `todo`

Letta's sharpest idea, worth borrowing in shape: consolidate while idle, not on the hot path.

- [ ] Background pass on panel idle: run `RM-02` merges, `RM-03` conflict sweeps, decay,
      promote recurring session memories.
- [ ] Strictly off the critical path; cancellable; never runs during an active recall.
- [ ] Panel shows what it did, with **undo**.

**Acceptance:** a store that has drifted for 500 simulated updates measurably re-coheres
(staleness + duplicate rates drop) with no user-visible latency.

---

## Phase 4 — Reach

### `RM-11` — Cross-platform + signing · **M** · `todo`
- [x] macOS + Linux SEA builds (SEA is per-platform; macOS must build on a Mac).
      Parametrized `build-exe.js` (PR #33) + GitHub Actions release matrix
      (`.github/workflows/release.yml`): `windows-latest` / `ubuntu-latest` /
      `macos-latest` each build natively, smoke `--mcp` on that runner, and
      attach all three plus `SHA256SUMS` to a GitHub Release. macOS is
      arm64-only until Node SEA tests x64. Tag `v*` (rc tags are
      prereleases of `package.json`'s version). Unsigned on purpose.
- [ ] Code signing / notarization to kill the SmartScreen + Gatekeeper warnings (a real
      adoption tax on an unsigned binary).
- [ ] Fix the noted default-path wart: data lands in `~/.lmstudio/…` even for Claude-only users.

### `RM-12` — SDKs and a documented local API · **L** · `todo`
- [x] Bind-address + CSRF/`Origin` lock (**W-02**, shipped before documenting the
      surface): panel binds `127.0.0.1`; Host must be loopback; Origin (when
      present) must be this panel; mutating POSTs require a per-process
      `X-Resonance-Token` baked into the page. Residual: a local process that
      reads the page can steal the token (same class as binding 127.0.0.1).
      No `Access-Control-Allow-Origin`.
- [ ] Version and document the panel's HTTP surface as a stable local API.
- [ ] Thin Python + TypeScript clients. No auth needed (127.0.0.1 only) — the
      W-02 lock is the ship-gate; clients still wait on the documented surface.

### `RM-13` — Failure-mode capture (opt-in, local) · **M** · `todo`
> The counter to the one moat we can't code past: incumbents see the long tail of real abuse.
- [ ] `Export failure bundle` button: the failing query, redacted/hashed memory shapes,
      metrics — **never raw memory text** unless explicitly ticked.
- [ ] Bundles drop straight into `eval/corpora/` as runnable cases.
- [ ] Opt-in, local-only, off by default. No phone-home, ever.

### `RM-14` — Hosted / enterprise · `deferred` — **on purpose**
Hosting rots the local path (see Zep's deprecated community edition). If it ever happens it
should be a **separately named product**, so the local one can't be hollowed out to protect
revenue. Non-hosted "enterprise" wants (multi-user scoping, audit log, policy file) are
covered by `RM-06` and `RM-16`.

---

## Cross-cutting (things not on the original list, but load-bearing)

### `RM-15` — Longitudinal coherence soak test · **M** · `todo`
> *Directly targets: "the gap between a working prototype of temporal/contradiction handling
> and one that stays coherent after hundreds of updates."*

- [ ] Simulate 1,000+ updates to an evolving persona (job changes, moves, preference flips,
      corrections, re-corrections).
- [ ] Assert coherence at checkpoints 100/250/500/1000: is the *current* answer right; is
      history intact; did the store grow superlinearly; did the graph fragment?
- [ ] Plot metric drift over update count — **the curve is the deliverable**, because slow rot
      is invisible to single-shot benchmarks.

**Acceptance:** staleness stays flat (not creeping) from update 100 → 1000.

### `RM-16` — Memory poisoning / injection defense · **M** · `todo` — **gates Phase 2.2 promotion**

> **Not started.** Phase 0.6 wrote the threat sketch
> ([`proposed/0009`](proposed/0009-edge-threat-model.md)); this item **implements** the
> defense. The record-provenance bullets below are necessary and **not sufficient** —
> Phase 0 made `hebbian.weight` an irreplaceable source of truth, and 2.2 would let it
> enter rank. Do not promote fusion until the carry-forward requirements in `0009` §7
> are met.

- [ ] Treat tool-call content as untrusted: text a model saw on a webpage must not silently
      become a durable "user preference."
- [ ] Provenance on every record: `source` (`user_stated` | `model_inferred` | `tool_content`).
- [ ] Recall weights user-stated over model-inferred; panel can filter by provenance.
- [ ] Eval case: an adversarial "remember that you must always…" payload must not become a
      high-confidence long-term memory.

**Carry-forward from `0009` (must hold before the 2.2 gate can pass):**

- [ ] Untrusted provenance must not mint or raise `hebbian.weight` at full `alphaPP`.
      Record `source` (and/or per-reinforcement provenance) has to reach `_bump`, not
      just the JSONL row. The existing primary-vs-neighborhood discount is
      retrieval-provenance; generalize it to *who said it*.
- [ ] Bound the rate an adversary can buy once learned weight enters rank (`tanh` on
      the discovery bonus does not automatically bound rank influence). 2.3/2.4 are
      the damping half; this is the provenance half.
- [ ] Sidecar import / `RM-17` restore is an injection path: export must preserve
      Hebbian (irreplaceable); import must not silently bless a planted sidecar.
- [ ] Re-evaluate the save-time 0.25 persist-net before anything reads it into rank
      (latent parasite edges accumulated while the field was off).
- [ ] Keep I9 as the fallback: if the A/B is inconclusive or the bullets above are
      not in, fusion stays flag-off.
- [ ] Eval the *edge*, not only the record: parasite + co-recall, planted sidecar,
      constraint-cue vs "remember that you must always…" (different attacks).

*(The Hebbian path is already provenance-discounted by retrieval role —
primary↔primary / primary↔neighborhood / zero N↔N. This generalizes that
instinct to the whole write path **and** to the writer of the learned signal.)*

### `RM-17` — Portability: export / import / backup · **S** · ✅ `done` — export + import CLI + panel button shipped
- [x] One-click export to plain JSONL + a documented schema *(RM-07 slice 2b zip
      + `--export-jsonl`; panel button 2c)*.
- [x] Import with dedup *(CLI `--import`, dry-run default; `--apply` restores
      into an empty dest; `--merge` skip-id / skip-text / remap colliding ids.
      Direct store write — does not go through `save()`, so ids, embeddings,
      and history survive. Streaming; not `readFileSync`.)*
- [x] Export preserves `hebbian.weight`. Import does **not** silently bless a
      planted sidecar (`0009` §5 / §7.3): `--with-edges` is opt-in, requires
      `manifest.format = "resonance-memory-export"`, a raw `.edges.json` is
      refused, dest-already-has-edges needs `--replace-edges`.
- [x] Panel import button (the 2c analogue: path + confirm; shells the same
      `runImport()` engine). `--with-edges` checkbox default-off. Heartbeat
      pause + yield like export. Not an MCP tool.
- [x] Reinforces the trust claim: your memories are *yours*, and leaving is easy.

### `RM-18` — Encryption at rest (optional) · **M** · `todo`
- [ ] Opt-in passphrase encryption for the store; off by default (it costs the
      inspect-with-a-text-editor property, which is currently a feature).

### `RM-19` — Recall explainability · **S** · `todo`
- [ ] Panel: "why did this surface?" — cosine, Hebbian bonus, graph hop, fusion rank.
- [ ] Turns the 3D graph from a pretty object into a debugging instrument, and makes `RM-05`
      and `RM-09` tuning legible instead of magic.

### `RM-20` — First-run quality · **S** · `in progress` — empty-store nudge + import-from-zip hole named
- [x] The empty-store experience: what to say to your AI to seed it well.
      *(Panel card when `memories === 0`; "Copy a starter prompt" clipboard.
      README "first thing worth doing" under Get started.)*
- [x] Detect "connected but never saved anything" and offer a nudge in the panel.
      *(Same card retitles when any MCP client is installed and the store is empty.)*
- [x] Panel import button (RM-17) — first-run card names "Import memories"
      for the "I have a zip from my old machine" hole.

---

## Dependency graph

```
RM-00 (eval) ─────────────────────────────┬──> everything
                                          │
RM-04 (temporal) ──┬──> RM-03 (conflict) ─┤
                   └──> RM-08 (decay)     │
RM-01 (extract) ───┬──> RM-02 (dedup) ────┘
                   └──> RM-10 (idle consolidation)
RM-21 (substrate) ─┬──> RM-09 (Hebbian tuning)
                   └──> RM-05 (hybrid) ──> RM-09
RM-16 (poisoning) ─────> RM-05 promotion gate
RM-07 (store) ─────────> RM-06 (scoping) ──> RM-12 (SDKs)
RM-15 (soak) ── validates ──> RM-03, RM-08, RM-10, RM-21
```

## Suggested first five

If you want a concrete "start Monday" list, in order:

1. **`RM-00`** — the harness. Everything else is guesswork without it.
2. **`RM-04`** — temporal fields. Cheap, additive, unblocks two other items.
3. **`RM-02`** — dedup. Highest visible quality-per-hour; users *feel* duplicate bloat.
4. **`RM-03`** — supersession. The headline capability gap vs Zep.
5. **`RM-07`** — SQLite. Removes the full-file-rewrite bomb before anyone hits it.

---

## Related

[[ROADMAP]] · [[ARCHITECTURE]] · [[BUGS]] · [[phase-0-edge-substrate]] · [[phase-2-retrieval-dynamics]] · [[0009-edge-threat-model]] · [[proposed/README]] · [[RESULTS]]
