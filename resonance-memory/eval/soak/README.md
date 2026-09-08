# RM-15 — control soak (slice 4.0)

Measurement infrastructure for 0011 §7.3. **No dream mutation.** The
deliverable is the control curve: does the store stay coherent after 1,000
updates *even if we never dream*.

Same identity as RM-00: offline, deterministic, reads `eval/embeddings.cache.json`,
never hits the network. The soak is a **new eval instrument**, separate from
`golden.json`. `eval/run.js` skips it (`gate: false`, `kind: "soak"`).
`eval/measure.js` also skips it — the log is timed and ordered; dumping it
as write-then-query would drop the clock, the vectorless missed-dups, and
the checkpoints.

## Run

```
node eval/soak/run.js                  # control arm, committed corpus
node eval/soak/run.js --arm control
node eval/soak/run.js --json
node eval/soak/run.js --n 100          # prefix (generator is prefix-stable)
node eval/soak/run.js --store jsonl
node eval/soak/run.js --write-corpus   # regenerate eval/corpora/soak-rm15.jsonl
node eval/soak/run.js --embed-only     # EVAL_REFRESH=1, fill the embed cache
node eval/soak/run.js --arm crystal    # errors: not until slice 4.2
node eval/soak/run.js --arm grimoire-walk  # errors: not until slice 4.1b
```

`npm run soak` is the same as `node eval/soak/run.js`.

Arms (runner flags, same shape as `measure.js --extract`): `control` /
`redundancy` / `nominate` / `crystal` / `grimoire-walk`. **Only `control` runs
end-to-end in 4.0.** The others are recognized and error
`"not until slice 4.x"` — Op A/B/C/D are not implemented here.

Field is **on** for accrual (0011: both arms will, so this is not a
field-on-vs-off measurement). A fake `Date` follows the event log so
Hebbian decay and the 48h span gate are real without touching
`memory-core.js`.

## Generator

`eval/soak/generate.js`, S1 shape: committed seed `0x524D15` plus a
generator, not a 1,000-line hand-written JSONL. Prefix-stable. Labels
assigned at generation, never after.

Persona slots that **change** (job, city, allergy, pet, project) plus
standing themes (morning-drink, climbing, sister-Naima) and a distractor
haystack. Event types are exactly 0011 §7.3: `assert` / `restate` /
`missed_dup` / `correct` / `episodic` / `theme_assert` / `near_miss` /
`recall` / `accidental_recall` / `hub_query` / `time_skip` / `dream`.

`missed_dup` is two vectorless saves then an embedding backfill — the Op A
needle. `dream` is a treatment-only marker; control skips it.

Committed corpus: `eval/corpora/soak-rm15.jsonl`.

## Metrics

Registered in `eval/metrics.js` (no forked scorer). Control arm produces
numbers for:

| Metric | What |
|---|---|
| `staleness_rate` | slot probes whose top-k does not contain the current value |
| `duplicate_rate` | extras beyond one-per-dup_group on `current()` |
| `needle_retention@k` | unique-token episodic still retrievable by source id |
| `storage_ratio` | `current().length / n_writes` (treatment: `/ control_n`) |
| `false_merge_rate` | must_not_merge pairs sharing a `superseded_by` survivor |
| `recall_at_k` / `mrr` | reused; `explain().byKind` splits on `query_kind` |

Scaffolded names (registered, return `null` in control): `gist_recall@k`,
`false_generalization_rate`, `cluster_precision`, `cluster_recall`,
`hub_contamination`, `provenance_integrity`, `grimoire_hit_rate` /
`grimoire_crowding`, `cofire_rate`, `near_miss_cofire`.

## Control baseline (4.0)

Reproduced `2026-09-06`, nomic-embed-text-v1.5, SqliteStore, field-on,
seed `0x524D15`. See `last-run.json`.

| ckpt | n_current | n_writes | staleness | dup_rate | needle@k | storage | false_merge |
|------|-----------|----------|-----------|----------|----------|---------|-------------|
|  100 |        69 |       81 |    0.0000 |   0.0435 |   1.0000 |  0.8519 |      0.0000 |
|  250 |       124 |      194 |    0.2000 |   0.0323 |   1.0000 |  0.6392 |      0.0000 |
|  500 |       197 |      387 |    0.2000 |   0.0305 |   1.0000 |  0.5090 |      0.0000 |
| 1000 |       280 |      787 |    0.2000 |   0.0250 |   1.0000 |  0.3558 |      0.0000 |

Staleness from 250 onward is the city slot (`where do I live` after the
Austin→Denver move) crowded out of top-5 — not a creeping all-slot rot.
Needle retention holds at 1.0. Near-misses do not merge. Storage is
sublinear (theme restatements collapse under RM-02.b). Duplicate extras
are the planted missed-dups plus a few theme cousins below the merge
band; the rate falls as the haystack grows.

This is the baseline every treatment arm later measures against.
