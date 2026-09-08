# S1 — substrate recall at scale

Needle-in-haystack characterization of RM's own `recall()`: does the right
memory stay findable as the store grows 1k → 50k(+100k), and what does one
call cost?

This is **not** the golden gate. Product behaviour is unchanged
(`save` / `recall` / `memory-core.js` untouched). Queries go through
`pipeline.js` → `createCore.recall` so we do not reimplement cosine.

## Run

```
node eval/substrate/scale.js                 # 1k / 10k / 50k / 100k
node eval/substrate/scale.js --quick         # 1k, fewer trials
node eval/substrate/scale.js --n 1000,10000
node eval/substrate/scale.js --skip-100k
node eval/substrate/scale.js --no-field      # skip field-on latency (W-03)
node eval/substrate/scale.js --embed-only    # fill eval/substrate/.cache/
node eval/substrate/scale.js --offline       # cache must already exist
node eval/substrate/scale.js --store sqlite --n 50000,100000 --no-field --latency-only
     # RM-07 product Store; direct INSERT (the migrator is --migrate / migrate-proof.js)
node eval/substrate/migrate-proof.js
     # RM-07 slice 2a: 50k JSONL → SQLite lossless proof (stream vs readFileSync wall)
node eval/substrate/export-proof.js
     # RM-07 slice 2b: 50k sovereignty zip (opens, ZIP64 at 70k, jsonl round-trip)
node eval/substrate/entity-layer-measure.js
     # entity-id split/merge + polarity probes (uses eval/corpora/fire-together-corpus.json, text-only);
     # nomic-plain field kNN @ 0.70 if the gitignored fair-run cache is present
```

First run live-embeds against LM Studio (`:1234`, `text-embedding-nomic-embed-text-v1.5`),
batches, and writes `eval/substrate/.cache/` (gitignored). Later runs are offline
if the generator seed and texts have not changed.

The generator (`generate.js`) is deterministic: seed `0x525301`, planted needles
first (stable ids as N grows), haystack fill after. Commit the seed + generator,
not 50k vectors.

## What it measures

- **Quality** (field off): `recall@1` / `@5` / `@10`, `mrr`, mean/median rank of
  the planted needle, and whether a hard near-topic distractor outranked it.
  In-memory Store seam; ranking is still `memory-core.recall`.
- **Latency** (field off and on): p50/p95/p99 of `recall(query, k=5)` on a real
  store. Default is `JsonlStore` with embeddings in the JSONL — the user-facing
  `all()`-parse + cosine scan, plus `field.buildEdges` O(n²) when the field is
  on (W-03). `--store sqlite` uses `SqliteStore` (BLOB + in-process cache);
  that is the RM-07 measurement. JSONL cannot load 50k.

Pre-declared concern thresholds live in `scale.js` and in
[`eval/RESULTS.md`](../RESULTS.md) "S1". Changing them after seeing the table
is cheating.

## Tests

Unit tests in `test.js` cover `mrr` on a tiny ranked set, generator shape /
determinism / reserved-slot haystack, and a 3-needle / 100-store e2e with
*synthetic* geometry (plumbing, not the live embedder).
