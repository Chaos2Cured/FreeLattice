# RM-00 — the evaluation harness

The measurement system the whole roadmap depends on. Every capability ahead —
contradiction detection, dedup, hybrid retrieval, decay — is a feature that *can make
recall worse*. Without measurement you can't tell a shipped feature from a shipped
regression, and you won't find out for months.

Our counter-position to the Mem0/Zep benchmark wars is **not a better number — it's
reproducibility**: a harness anyone can run offline in seconds, on their own machine,
with committed fixtures and a committed embedding cache. Hosted vendors structurally
can't match that; their eval needs their cloud.

## Run it

```powershell
npm run eval                 # run all corpora, print the scorecard, check regressions (sqlite default)
npm run eval -- --accept     # lock the current scorecard in as golden.json (needs --store jsonl)
npm run eval -- --filter constraint   # only cases whose id starts with "constraint"
npm run eval -- --store jsonl         # RM-07: JSONL path (still 27/31; --accept is jsonl-only)
npm run measure              # reporting metrics (A/B): recall@k, duplicate_rate, extraction_precision, mrr, …
npm run measure -- --bands   # also print pairwise cosine within each dup group
npm run measure -- --json    # machine-readable (the 02.b A/B compares this)
npm run scale                # S1 needle-in-haystack at 1k/10k/50k/100k (live embed first run)
npm run soak                 # RM-15 control curve (0011 §7.3; field-on, no dream)
```

Live A/B value proof (modest local driver, three arms, equal injection budget) is
**not** on this golden path — it needs LM Studio. Two independent rigs, same
discipline, disjoint scenarios:

```powershell
node eval/ab/run.js --selftest --runs 1          # Ember's (Dana)
node eval/ab-grok/check.js                       # Grok's offline invariants
node eval/ab-grok/run.js --selftest --runs 1     # Grok's (Jules Marin); needs embedder
```

See `eval/ab/README.md` and `eval/ab-grok/README.md`. Do not reuse one scenario
as the other; the point of two rigs is that they did not share a user.


Default (RM-07 slice 4) is SqliteStore. `--store jsonl` (or
`RESONANCE_STORE=jsonl`; `--store` wins) keeps the JSONL path testable. The
eval stays offline — vectors still come from `embeddings.cache.json`; SQLite
holds them as Float32 BLOBs for the run. The sqlite gate is **parity**,
not one-way regression: any case that differs from `golden.json` (fail→pass
or pass→fail) is a STOP. `--accept` is jsonl-only so an f32 quirk cannot
rewrite the lock. Slice 3/4 result: **27/31 identical, case-for-case, no
flips** on both backends. See `RESULTS.md` "RM-07 slice 3" and "RM-07 slice 4".

JsonlStore persists embeddings as JSON float64 arrays; SqliteStore packs
Float32 BLOBs. In principle a 7th-decimal cosine difference could swap a
near-tie and flip a case. On this corpus it did not: every cached component
(`nomic-embed-text-v1.5`) is already an exact f32 (`Math.fround` is a
no-op on all 271,872 values), so packing is lossless. The tightest HI pair
(tea, 0.952246) sits 0.002246 above `DEDUP_HI` 0.95 — the gap is three
orders above f32 ulp. Primary hit **text** order matched on every golden
case (opaque ids differ because `nextId()` is `Date.now()`). No tolerance
was added: a silent epsilon would hide a real inequivalence, and this run
did not need one.

Normal runs are **offline and deterministic** — they read `embeddings.cache.json` and
never touch the network. CI (`.github/workflows/ci.yml`) runs `node eval/run.js` on
every push to `main` and every pull request under that same contract: no
`EVAL_REFRESH`, no embedder, a cache miss fails the `CI / gate` check instead of
hanging. Adding a new corpus case needs its embeddings once:

```powershell
$env:EVAL_REFRESH=1; npm run eval; Remove-Item Env:EVAL_REFRESH
# measurement corpora (skipped by eval/run.js):
$env:EVAL_REFRESH=1; npm run measure; Remove-Item Env:EVAL_REFRESH
```

That hits a live LM Studio (`/v1/embeddings` on :1234), grows the cache, and you commit
the diff. The two-step ritual is a feature: fixtures stay honest and reviewable.

Measurement corpora (`duplicates.jsonl`, `messy.jsonl`, `messy-hard.jsonl`) are skipped by `npm run eval`,
so a new write or query there is refreshed with `EVAL_REFRESH=1 npm run measure` instead.

## What it measures

The headline is the one number this project has never had: **what the associative field
is actually worth.** Every `constraint` case runs twice — field **off** and field **on** —
and the scorecard prints the gap. A case that fails off and passes on is the field earning
its keep; a case that passes off and fails on is the field *breaking* recall (a regression
the gate will catch).

The harness also supports *repeated* cases (a `repeat` array instead of `query`): one store
held across turns so the Hebbian ledger can strengthen an edge with use, scored per-turn with
`contains_by_turn`. "Missed at turn 1, landed by turn 4" is a **success** for this architecture,
and `first_hit_turn` is reported so a one-shot metric can't score it as a failure. (No corpus
case currently exercises this — the machinery is kept for the topology experiments ahead.)

**Contradiction / supersession (RM-03).** `contradiction` cases save two facts and check that a
correction retires the stale one: "I work at Acme" → "Actually I work at Globex now" should leave
only Globex current. The `contra-wrongslot` and `contra-additive-pets` guards check the *inverse*
— that a cross-slot or cue-less save does **not** delete an unrelated memory. See `RESULTS.md`
("RM-03") for why detection is gated on a correction cue, not raw cosine.

**Reporting metrics (RM-02 / RM-01), distinct from the golden gate.** `eval/metrics.js` has a
**registry**: a metric is `{ name, compute(results, corpus, opts) -> number }`, plus optional
`explain` for a breakdown. Builtins today: `recall_at_k` (success@k, default k=5),
`duplicate_rate` (extras beyond one-per-ground-truth-group / current stored count),
`extraction_precision` (stored records that match a gold atomic fact and contain no labeled
noise), `extraction_recall` (gold facts with a matching stored record / gold facts —
the anti-cheat for vacuous precision), and `mrr` (mean reciprocal rank of the first relevant
id; misses contribute 0). They are A/B numbers, not pass/fail — `node eval/run.js` still gates only the
contains/excludes scorecard, and measurement corpora (`kind: "duplicates"` / `"messy"`,
`gate: false`) are skipped there so a new fixture cannot flip golden. Run them with
`node eval/measure.js` (reuses `pipeline.js` → `memory-core.js`; field off so rank stays
cosine). See `RESULTS.md` ("RM-02.a") for the pre-dedup baseline and the pre-declared 50%
bar, ("RM-02.b") for the measured win at save-time, and ("RM-02.c") for the
`--dedup-existing` backfill of a pre-02.b store: `duplicate_rate` 0.3182 → 0.0000,
`recall@5` held at 1.0000. RM-02 is done. See `RESULTS.md` ("RM-01.a") for the
pre-extraction baseline on `eval/messy` and ("RM-01.b") for the measured win:
`extraction_precision` 0.2609 → 1.0000, `extraction_recall` 1.0000, `recall@5` held,
`pii_refusal_rate` 0 → 1.0000. RM-01.c adds `eval/corpora/messy-hard.jsonl` (implicit
facts Tier 0 cannot split) and a live Tier 2 A/B (`--extract`); that number is **not**
the golden gate. See `RESULTS.md` ("RM-01.c").

## Layout

```
eval/
  corpora/*.jsonl        committed fixtures (tracked despite the repo's *.jsonl ignore)
                         golden cases have expect+query; measurement corpora
                         (duplicates.jsonl, messy.jsonl) are skipped by run.js
  embeddings.cache.json  committed real embeddings -> offline + deterministic
  embed-cache.js         the cached embedder (refresh ritual above)
  pipeline.js            the real substrate (store/field/edges/record) composed into
                         an injectable save/recall, mirroring server.js
  metrics.js             golden scoring (contains / excludes / current_only / per-turn)
                         PLUS the reporting-metric registry (recall_at_k,
                         duplicate_rate, extraction_precision, extraction_recall, mrr)
  run.js                 the golden runner + regression gate
                         (sqlite default = two-sided parity; `--store jsonl` still testable)
  measure.js             reporting-metric runner (A/B; does not touch golden.json)
  golden.json            last accepted scorecard (written by --accept)
  save-time-cost.js      Phase 0.1 cost sweep (neighbor-scan + EdgeStore.save p50/p95/p99
                         at N=100/1k/10k/50k/100k). Pre-declares the p95 budget that
                         triggers RM-07 *before* measuring. Not part of npm run eval.
  substrate/             S1 needle-in-haystack scale (generator + live-embed cache +
                         quality/latency runner). Seed + generator committed; vectors
                         cached in substrate/.cache/ (gitignored). See RESULTS.md "S1".
  soak/                  RM-15 control harness (0011 §7.3). Generator + runner
                         arms. Slice 4.0 is measurement only: control arm plays
                         the persona soak field-on, no dream. See soak/README.md.


## Case format

```jsonl
{"id":"contra-job","kind":"contradiction",
 "writes":["I work at Acme","Actually I work at Globex now"],
 "query":"where do I work",
 "expect":{"contains":["Globex"],"excludes":["Acme"],"current_only":true}}
```

`excludes` matters as much as `contains` — most memory bugs are *extra wrong stuff*, not
missing right stuff. `kind:"constraint"` triggers the off/on double-run. A `repeat` array
(instead of `query`) keeps one store across turns; pair it with `contains_by_turn`.

### Measurement corpora (`eval/corpora/duplicates.jsonl`)

A store-level scenario, not a per-case golden. Stream JSONL so a diff is reviewable:

```jsonl
{"id":"dup-rm02-bands","kind":"duplicates","role":"meta","gate":false}
{"role":"write","dup_group":"penicillin","band":"hi","text":"I'm allergic to penicillin"}
{"role":"write","dup_group":"penicillin","band":"hi","text":"I am allergic to penicillin"}
{"role":"query","id":"q-penicillin","query":"what am I allergic to","relevant_groups":["penicillin"]}
```

`band` is `exact` (byte-identical restatement) / `hi` (cos ≥ ~0.95, now restated) /
`mid` (cos ~0.88–0.95, now merged) / `control` (singleton; must not merge). `eval/measure.js` saves
every write into ONE store, then scores `duplicate_rate` on `store.current()` and
`recall_at_k` on the queries (relevant ids resolved by matching stored text to the
group's labeled writes — a merge must keep an original text). Self-contained `{writes, queries}` objects also load, so a
later slice can drop a one-line scenario without the stream format.

### Adding a reporting metric

In `eval/metrics.js`:

```js
register({
  name: "mrr",
  description: "mean reciprocal rank of the first relevant id",
  compute(results, corpus, opts) { /* return a number */ },
  explain(results, corpus, opts) { /* optional breakdown */ },
});
```

`eval/measure.js` will emit it on the next run — no runner rewrite. Frozen-k aliases
are `register(makeRecallAtK(10))`. Levers that are not the number (field on/off,
hybrid, k) belong on the runner (`--field`, `--k`), not inside the metric: a metric
is a function of a result shape; the runner decides which core flags produced it.

`duplicate_rate` definition (the number RM-02's acceptance names):
`max(0, N − G*) / N` where N is current stored records and G* is labeled groups
represented among them (plus one singleton per unmatched text). Group membership is
by stored `text` ∈ the group's write texts — RM-02.b merge must keep one of the
original texts (the spec already says "keep the longer/more specific"). See the
comment on the metric for why this is not "pairs with cosine > 0.95."

### Measurement corpora (`eval/corpora/messy.jsonl`)

Write-side labels, not a retrieval golden. Stream JSONL, same loader as duplicates:

```jsonl
{"id":"messy-rm01-extract","kind":"messy","role":"meta","gate":false}
{"role":"write","id":"w-filler-fyi","band":"filler",
 "text":"FYI, the Friday standup is at 10am",
 "gold_facts":["The Friday standup is at 10am"],"noise":["FYI"]}
{"role":"write","id":"w-pii-apikey","band":"pii",
 "text":"my API key is sk-…","gold_facts":[],"noise":["sk-…"],"expect_refusal":true}
{"role":"query","id":"q-standup","query":"when is the Friday standup",
 "relevant_writes":["w-filler-fyi"],"relevant_facts":["The Friday standup is at 10am"]}
```

`band` is `filler` / `imperative` / `multi` / `multi-nosplit` / `pii` / `control`.
`gold_facts: []` plus `expect_refusal: true` means store nothing. `eval/measure.js`
saves each write, attributes the `store.current()` delta to that write, and scores
`extraction_precision` on those stored texts. Queries keep a recall@5 backstop
(relevant ids = origin-write records, with a gold-fact match when extraction has
cleaned the text).

`extraction_precision` definition (the number RM-01's acceptance names):
`n_correct / n_stored` where a stored record is correct iff it equals a gold
atomic fact (whitespace-collapsed, case-folded) AND contains none of the case's
noise spans. Exact equality, not containment — a raw blob that *contains* the
fact plus filler is noise. A correct PII refusal stores nothing, so it does not
dilute precision; `pii_refusal_rate` in the explain breakdown is refused-and-wrote-nothing
/ PII cases. See the comment on the metric.

`extraction_recall` (RM-01.b): `|gold facts with a matching stored record| / |gold facts|`.
Refuse-everything scores precision 1.0 and recall 0 — the A/B is two-sided.

### RM-15 control soak (`eval/soak/`, `eval/corpora/soak-rm15.jsonl`)

Longitudinal coherence, 0011 §7.3. A seeded generator (S1 shape — not a
1,000-line hand-write) emits a timed, labeled event log for one evolving
persona (job / city / allergy / pet / project change) plus standing themes
and a distractor haystack. Checkpoints at 100 / 250 / 500 / 1000.

`node eval/soak/run.js` (or `npm run soak`) plays the log through
`pipeline.js` → `memory-core.js`, field-on for Hebbian accrual, **no dream**.
That control curve is the baseline every later treatment arm measures
against. Other arm flags (`--arm redundancy|nominate|crystal|grimoire-walk`)
are scaffolded and error `"not until slice 4.x"`.

New registry metrics (still in `eval/metrics.js`, no forked scorer):
`staleness_rate`, `needle_retention@k`, `false_merge_rate`, `storage_ratio`,
plus names later slices fill (`gist_recall@k`, `cluster_precision` / `_recall`,
`hub_contamination`, `provenance_integrity`, `grimoire_hit_rate` /
`grimoire_crowding`, `cofire_rate` / `near_miss_cofire`). `recall_at_k` / `mrr` `explain().byKind`
split on `query_kind`. The soak is `gate: false` and skipped by `eval/run.js`
and `eval/measure.js` — it cannot flip golden.

Refresh embeddings the usual way, then commit the cache diff:

```powershell
$env:EVAL_REFRESH=1; node eval/soak/run.js --embed-only; Remove-Item Env:EVAL_REFRESH
```

See [`soak/README.md`](soak/README.md) for the 4.0 control numbers.

---

## Related

[[RESULTS]] · [[0007-eval-harness]] · [[BACKLOG]] · [[phase-2-retrieval-dynamics]] · [[ARCHITECTURE]] · [[ROADMAP]]
