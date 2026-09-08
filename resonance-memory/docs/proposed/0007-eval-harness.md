# 0007 — The evaluation harness

**Status:** proposed · **Backlog:** `RM-00` · **Depends on:** nothing · **Blocks:** everything

## Why this is first

Every capability on the roadmap — extraction, dedup, supersession, decay, Hebbian tuning — is
a feature that **can make the system worse**. An extraction pass that drops a nuance, a
supersession rule that hides a true fact, a decay curve that prunes the one thing you needed.
Without measurement you cannot tell the difference between shipping a feature and shipping a
regression, and you will not find out for months.

The market makes this vivid. Mem0 and Zep are in a public credibility fight over LOCOMO —
84% → 58.44% → 75.14%, every number contested, independent observers advising that no vendor
number be trusted. That happened because numbers shipped ahead of methodology.

**Our counter-position is not a better number. It is reproducibility.** A harness anyone can
run offline in under a minute, on their own machine, with committed fixtures and fixed seeds,
is a claim hosted vendors structurally cannot match — their eval needs their cloud. That is
the asymmetry to press.

## Layout

```
eval/
  corpora/
    basic.jsonl           # plain save/recall
    contradictions.jsonl  # ≥50 cases - THE differentiating axis
    duplicates.jsonl      # restatements, near-dupes
    temporal.jsonl        # "used to", validity windows
    messy.jsonl           # typos, fragments, pronouns, compound facts
    constraints.jsonl     # diabetic→sugar: must surface on related topics
    adversarial.jsonl     # injection, secrets, memory poisoning (RM-16)
  embeddings.cache.json   # COMMITTED - makes runs offline + deterministic
  run.js                  # the runner
  metrics.js              # scoring
  golden.json             # last accepted scorecard (the regression gate)
```

### Case format

```jsonl
{"id":"contra-001","kind":"contradiction",
 "writes":["I work at Acme","Actually I work at Globex now"],
 "query":"where do I work",
 "expect":{"contains":["Globex"],"excludes":["Acme"],"current_only":true}}

{"id":"constraint-004","kind":"constraint",
 "writes":["I'm diabetic, no sugary foods","I take my dog Rex on long walks"],
 "query":"suggest a snack for after my walk",
 "expect":{"contains":["diabetic"],"reason":"health constraint must bridge via the walk"}}
```

`excludes` is as important as `contains` — most memory bugs are *extra wrong stuff*, not
missing right stuff.

### The five cases to run first

These settle an open disagreement about how much work plain cosine and the existing
associative field already do, and they should be written **before** any of `RM-08` is
implemented — the answer changes how much of it is needed.

```jsonl
{"id":"constraint-near","kind":"constraint",
 "writes":["I'm diabetic - keep sugar out of any recipe"],
 "query":"suggest a dessert",
 "expect":{"contains":["diabetic"],
   "note":"DISPUTED - the stored text contains 'sugar' and 'recipe', so this plausibly clears the gate on cosine alone. Measure before assuming it needs constraint machinery."}}

{"id":"constraint-far-sparse","kind":"constraint",
 "writes":["I'm diabetic - keep sugar out of any recipe"],
 "query":"what should I bring to the potluck on Friday",
 "expect":{"contains":["diabetic"],
   "note":"No shared vocabulary - but the EMBEDDING may still carry potluck->food->sweets->diabetic, because it was trained on text where those co-occur. One memory, so no graph hops are available: this measures the embedding's own geometry, alone."}}

{"id":"constraint-far-rich","kind":"constraint",
 "writes":["I'm diabetic - keep sugar out of any recipe",
           "I usually bring my lemon bars to group dinners",
           "Everyone at the office loves dessert potlucks"],
 "query":"what should I bring to the potluck on Friday",
 "expect":{"contains":["diabetic"],
   "note":"Same query, but now intermediate memories exist for the graph to hop through. Difference vs constraint-far-sparse isolates what the associative field adds ON TOP of the embedding."}}

{"id":"constraint-crowded","kind":"constraint",
 "writes":["I'm diabetic - keep sugar out of any recipe",
           "...50 unrelated recipe memories..."],
 "query":"suggest a dessert recipe",
 "expect":{"contains":["diabetic"],
   "note":"Similarity may be fine while the top-k budget is not. Isolates crowding from matching."}}
```

### The cases above are all one-shot — that is a flaw

Every case so far issues a query once and scores the result. But recall is **not a static
function**: `reinforceRecall` strengthens an edge each time memories co-surface, and that
bonus is added *before* the `minSim` gate. A constraint that misses on query 1 may hit on
query 5 purely because the association has been reinforced. **A one-shot harness cannot see
that, and will systematically undervalue the associative field.**

So constraint cases need a repeated form:

```jsonl
{"id":"constraint-learning","kind":"constraint","field":true,
 "writes":["I'm diabetic - keep sugar out of any recipe",
           "I make lemon bars for the office"],
 "repeat":[{"query":"dessert ideas for the office"},
           {"query":"what should I bake this weekend"},
           {"query":"dessert ideas for the office"},
           {"query":"what should I bring to the potluck on Friday"}],
 "expect":{"contains_by_turn":[false,null,null,true],
   "note":"Turn 1 may miss (Hebbian weight is 0 - pure cosine). Turn 4 is the distant query that should now land BECAUSE turns 1-3 reinforced the edge. Passing turn 4 while turn 1 misses is the signal we want."}}
```

Report `first_hit_turn` alongside pass/fail. **"Missed at first, learned by turn 4" is a
success for this architecture, and a one-shot metric would score it as a failure.**

Run every constraint case twice — `field: false` and `field: true` — and report both. The gap
between them *is* the associative field's measured value, which is the number this project
most needs and has never had.

### Two mechanisms, easy to confuse

There are *two* separate things that could carry `potluck → food → sweets → diabetic`, and the
sparse/rich pair above exists to tell them apart:

1. **The embedding's own geometry.** `nomic-embed-text` was trained on text where potlucks,
   desserts, sugar and diabetes co-occur constantly. That chain is already compressed into the
   vector space — cosine is *not* keyword overlap, and it plausibly spans the whole hop
   sequence on its own. This works with a **single** stored memory.
2. **The associative graph.** `field.js` expands through *your stored memories*, not through
   world knowledge. It can only hop `potluck → lemon bars → dessert → diabetic` if you
   actually saved something about lemon bars. **In a sparse store there is nothing to hop
   through**, and the graph contributes nothing.

The honest expectation is that mechanism 1 does most of the work, and that constraint
machinery earns its place mainly through **crowding** (`constraint-crowded`) rather than
through similarity. But that's a prediction, not a measurement.

### What the results mean

| Result | Implication |
|---|---|
| `constraint-near` passes | The dessert claim on the landing page is honest today |
| `constraint-far-sparse` passes | The embedding carries the whole chain unaided — `RM-08`'s domain machinery is mostly redundant for retrieval |
| `constraint-far-rich` passes but `-sparse` fails | The associative field is doing real, measurable work — the strongest evidence yet for the project's central bet |
| `constraint-crowded` fails while the others pass | The problem was never similarity; it's the top-k budget. Fix with a reserved slot, not a better domain model |
| `constraint-learning` hits by turn 4 having missed turn 1 | **The Hebbian loop works.** Retrieval improves with use, exactly as designed — and no static analysis of cosine would ever have shown it |
| Any case passes with `field: true` and fails with `field: false` | Direct measurement of what the associative field is worth. This is the project's central claim, currently untested |

That third row is worth the whole harness on its own: it's the first test that would show the
Hebbian/associative substrate earning its keep against a plain vector store, which is the one
claim this project rests on and has never measured.

**None of this is knowable without the embedder** — which is exactly why the harness comes
first, and why these cases are the cheapest first thing to run.

## Metrics

| Metric | Definition | Why |
|---|---|---|
| `recall@k` | fraction of cases whose expected memory is in top-k | baseline quality. **Shipped (RM-02.a)** as reporting metric `recall_at_k` (success@k; registry in `eval/metrics.js`). |
| `MRR` | mean reciprocal rank of first correct hit | ranking quality, not just presence. **Shipped (S1)** as reporting metric `mrr` (misses contribute 0; truncated at the ranked-list window). |
| **`staleness_rate`** | answers drawn from a superseded fact | **our differentiating axis** |
| `false_supersession` | still-true facts wrongly invalidated | **hard gate — must be 0** |
| `duplicate_rate` | extras beyond one-per-ground-truth-group / current stored count | store hygiene. **Shipped (RM-02.a)** as a labeled reporting metric, *not* "pairs with cos > 0.95" (that would be circular for cosine-dedup). |
| `extraction_precision` | stored facts that are genuinely durable | `RM-01` guard. **Shipped (RM-01.a)** as reporting metric (exact gold-fact match, not containment; PII refusal is a separate explain readout). |
| `extraction_recall` | gold facts that actually landed as a stored record | `RM-01` anti-cheat. **Shipped (RM-01.b)**. Vacuous precision (refuse everything → 1.0) craters this. |
| `constraint_surfacing` | constraints appearing on topically-related recalls | `RM-08` |
| `write_latency_p95` | ms per save | guards against LLM-on-write creep |
| `store_growth` | bytes per 100 writes | supersession must not balloon the file |

## Determinism

The single most important property: **runs must be offline and repeatable.**

```js
// eval/embed-cache.js
// Real embeddings, computed once, committed. The harness NEVER hits the network,
// so results are identical on CI, on a laptop, and on a plane.
const cache = JSON.parse(fs.readFileSync("eval/embeddings.cache.json", "utf8"));

async function embedCached(texts) {
  const missing = texts.filter(t => !(hash(t) in cache));
  if (missing.length) {
    if (process.env.EVAL_REFRESH !== "1")
      throw new Error(
        `${missing.length} uncached strings. Run: EVAL_REFRESH=1 npm run eval  (needs a live embedder)`);
    const fresh = await realEmbed(missing);           // only in refresh mode
    missing.forEach((t, i) => { cache[hash(t)] = fresh[i]; });
    fs.writeFileSync("eval/embeddings.cache.json", JSON.stringify(cache));
  }
  return texts.map(t => cache[hash(t)]);
}
```

Adding a case is a two-step ritual (`EVAL_REFRESH=1` once, then commit the cache), and that is
a *feature*: it keeps the fixture set honest and reviewable in a diff.

## The runner

```js
// eval/run.js
async function runCase(c, { variant, field }) {
  const store = freshStore();                          // isolated temp store per case
  for (const w of c.writes) await saveMemory(w, { store, variant });

  // Repeated cases (constraint-learning) exercise the Hebbian loop: the SAME store
  // across turns, so reinforceRecall can strengthen edges between them. Scoring a
  // repeat case with a single recall would measure the opposite of what it tests.
  const turns = c.repeat || [{ query: c.query }];
  const seen = [];
  for (const t of turns) {
    const got = await recallMemory(t.query, { store, variant, field });
    seen.push(got);
  }
  return {
    id: c.id, kind: c.kind, field,
    ...score(c, seen),                                 // handles contains / contains_by_turn
    first_hit_turn: seen.findIndex(g => hits(c, g)) + 1 || null,
  };
}

async function run({ variant = "default", filter = null } = {}) {
  const results = [];
  for (const file of fs.readdirSync("eval/corpora")) {
    for (const c of readJsonl(`eval/corpora/${file}`)) {
      if (filter && !c.id.startsWith(filter)) continue;
      // Constraint cases run BOTH ways; the gap is the field's measured value.
      const modes = c.kind === "constraint" ? [false, true] : [c.field ?? false];
      for (const field of modes) results.push(await runCase(c, { variant, field }));
    }
  }
  return aggregate(results);
}

// Regression gate
const golden = JSON.parse(fs.readFileSync("eval/golden.json", "utf8"));
const now = await run();
const regressions = Object.entries(now).filter(([m, v]) =>
  HIGHER_IS_BETTER.has(m) ? v < golden[m] - EPS : v > golden[m] + EPS);

if (regressions.length) {
  console.error("REGRESSION:", regressions);
  console.error(diffCases(golden.cases, now.cases));   // WHICH cases flipped, not just totals
  process.exit(1);
}
```

`diffCases` matters more than the aggregate. "recall@5 dropped 0.02" is unactionable;
"`contra-017` and `contra-023` flipped from pass to fail" sends you straight to the bug.

## A/B mode

For `RM-05` (hybrid) and `RM-09` (Hebbian tuning), where the question is "is variant B better":

```bash
npm run eval -- --ab cosine-only,hybrid-rrf
npm run eval -- --ab field-off,field-on     # the one that matters most; see below
```

```
metric                cosine-only   hybrid-rrf     delta
recall@5                   0.784        0.831     +0.047  ✅
MRR                        0.712        0.749     +0.037  ✅
  └ rare_noun              0.522        0.698     +0.176  ✅
  └ identifier             0.481        0.744     +0.263  ✅
  └ negation               0.610        0.634     +0.024  ~
  └ paraphrase             0.848        0.836     -0.012  ~
write_latency_p95 (ms)      12.3         12.4      +0.1   ~
```

Per-category breakdown is the point. An aggregate win that comes entirely from one category
while regressing another is a *different decision* than a broad win, and the table has to show
you which one you're looking at.

## Soak mode (`RM-15`)

```bash
npm run eval -- --soak 1000
```

Simulates a persona evolving over 1,000 updates (job changes, moves, preference flips,
corrections of corrections), checkpointing at 100/250/500/1000:

```
updates   staleness   duplicates   store_kb   graph_components
    100       0.02         0.01         340                  3
    250       0.03         0.02         820                  4
    500       0.03         0.02        1610                  4
   1000       0.04         0.03        3180                  5
```

**The curve is the deliverable.** Slow rot is invisible to single-shot benchmarks, and it is
the real gap between a working prototype of temporal/contradiction handling and one that stays
coherent after hundreds of updates. Flat lines here are the strongest quality claim the
project can make.

## What we publish

- The harness, the corpora, the cache, the seeds, the exact command.
- A `RESULTS.md` regenerated by the runner, with the date and commit.
- **No competitor comparison numbers.** If someone wants to compare, the harness is right
  there and it runs against any MCP memory server. Let them.

## Acceptance

- `npm run eval` runs offline in <60s and prints a scorecard.
- CI fails on regression, naming the flipped cases.
- ≥50 contradiction cases; every corpus category represented.
- A deliberately-broken change (rank by recency) is caught.
- `--ab` and `--soak` both work.
- Constraint cases run with the field **off and on**, and the scorecard reports both plus the
  gap — the associative field's measured value, which the project has never had.
- Repeated cases keep one store across turns and report `first_hit_turn`, so "missed at turn 1,
  landed by turn 4" scores as the success it is rather than a failure.

---

## Related

[[phase-2-retrieval-dynamics]] · [[eval/README]] · [[RESULTS]] · [[BACKLOG]] · [[ARCHITECTURE]] · [[proposed/README]]
