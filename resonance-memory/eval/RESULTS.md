# RM-00 — first results

**Date:** 2026-07-29 · **Substrate baseline:** commit `29238f5` · **Embedder:**
`text-embedding-nomic-embed-text-v1.5` (768-dim, via LM Studio), cached offline in
`embeddings.cache.json`. **Reproduce:** `npm run eval` (offline, deterministic).

This is the record of the first serious experiment against the claim the whole project
rested on and had never tested: *that the associative field improves retrieval over plain
cosine similarity.* The harness was built specifically so that claim could be **falsified**.

## The result, stated precisely

> **The current associative field topology does not demonstrate a retrieval advantage over
> cosine similarity in the evaluated corpus.**

and, separately and independently:

> **The Hebbian reinforcement and decay mechanisms themselves were experimentally confirmed
> at the ledger level.**

That distinction is the whole finding. Three independently testable layers:

```
                    RM-00 RESULT
                         |
          +--------------+--------------+
          |                             |
   RETRIEVAL GEOMETRY            HEBBIAN DYNAMICS
   (associative topology)        (reinforce / decay)
          |                             |
   NOT validated                 mechanically WORKS
   over cosine                   (measured, below)
          |                             |
          +--------------+--------------+
                         |
                  FUTURE RESEARCH
          Change the TOPOLOGY, not the baseline.
                 RM-00 judges it.
```

## What was measured

Scorecard: **16 / 25 checks pass** across `basic`, `constraint`, `contradiction`,
`field-stress`, `field-noise`. The failures are informative, not accidental:

### 1. Cosine retrieval is strong
`constraint-crowded` (16 memories, k=5): cosine ranks the "diabetic" constraint into the
top-5 for "dessert recipe" on embedding geometry alone. `basic-*` and `regress-direct` all
pass. (Note: `constraint-near/-far-sparse/-far-rich` pass **trivially** — their stores are
≤ k, so everything returns; they discriminate nothing and are kept only as a floor.)

### 2. The associative field earns nothing here, and costs precision
`field lifted 0 cases fail→pass, and BROKE 1.` Net value on this corpus is **negative**.

**Rescue failures — the field cannot surface niche/leaf memories** (failure-surface map,
`node eval/diagnose.js`; cell = rescued?(non-target memories dragged in)):

```
case                  n   rank  fwd-1(ship)  fwd-2   bi-1    bi-2
field-rescue          24  21     . (2)        . (3)   . (4)  YES(8)
field-rescue-veg      20  10     . (3)        . (5)  YES(5)  YES(9)
field-rescue-heights  18  18     . (1)        . (2)   . (4)   . (6)
regress-direct        14  1*     . (1)        . (1)   . (1)   . (1)
```

Two distinct failure modes:
- **Edge exists but traversal strands it** (`diabetic`, `vegetarian`). Fixable only by more
  aggressive traversal — and the fix drags in **5–8 non-target memories per rescue** (a
  5:1–8:1 noise-to-signal ratio). `diabetic` needs bidirectional **and** 2-hop *together*;
  neither alone reaches it.
- **Edge never forms** (`heights`). No traversal strategy rescues it: the
  fear-of-heights ↔ rooftop-bar similarity fell below the 0.55 edge gate, so the leaf is
  isolated. Traversal cannot reach an edge that does not exist.

**Measured false positive — the field surfaces irrelevant associates:** `noise-schedule`
passes with the field off and **fails with it on** — asked "when is my doctor's appointment,"
the field dragged in "the mechanic said the car will be ready **Thursday**" on the shared
word alone. (`noise-homonym` stayed clean, so precision is *inconsistent*, case-dependent.)

So the current field **misses what you want and surfaces what you don't.** This is a property
of the kNN-from-cosine-seeds topology, not a parameter setting.

### 3. The Hebbian dynamics mechanically work (ledger probe, `node eval/decay-probe.js`)
```
pair     cosine   learning              forgetting
gluten   0.530    1 co-recall to cross  80 recalls to decay back
budget   0.466    3 co-recalls          10 recalls
```
Co-activation lifts a sub-threshold edge over the 0.55 gate in **1–3 activations**; the
retired epoch clock removed it in **10–80 recalls** (scaled by margin over the gate). As of
Phase 0.2 the live law is wall-clock half-life (`effectiveHebbian`, facts ~7 days), so an
instant eval no longer fades anything — the probe's forget column is the old timescale,
kept inspectable via `tick()`. "Learns through use, fades without it" is real. Its
*retrieval* impact is bottlenecked by the same misaligned topology above: a fast learner
on a bad map still arrives in the wrong place.

### 4. Documented gaps (not regressions — improvements when closed)
- **Contradiction detection (`contra-job`, `contra-city`): fails.** Nothing wires supersession
  into the save verb — `supersedePatches` is defined and unit-tested but called by no verb, so
  contradictory facts both store as current. This is `RM-03`. **→ Now closed; see the RM-03
  addendum below.**

## Decisions taken

1. **Field parked, not removed.** `field.js`/`ledger.js` are intact and gated off by default.
   Do **not** modify them before changing anything — the current behavior is the experimental
   baseline.
2. **This scorecard is locked as `golden.json`.** Future topology experiments (semantic typing,
   salience-weighted edges, asymmetric association, activation spreading, a different graph
   construction) must **beat this baseline**, measured by RM-00 — not modify the baseline itself.
3. **The public claim follows the evidence.** The associative field is an *experimental research
   subsystem*, off by default. The product is not marketed as "learns which memories belong
   together" until RM-00 shows a topology that beats cosine without the noise cost.

## Why this matters

Twelve hours ago the position was *"we believe this associative substrate is what makes
Resonance different."* It is now *"we built an instrument capable of falsifying that hypothesis,
and the first serious experiment showed the dynamics work but the current topology does not
produce the desired retrieval behavior."* That is the difference between a belief and a result.

---

# RM-03 — contradiction detection (supersession wired into `save`)

**Date:** 2026-08-01 · **Substrate baseline:** commit `cf70448` (RM-00) · same embedder and
offline harness. **Scorecard: 20 / 27** — `contra-job` and `contra-city` flipped **fail → pass**
(RM-00's documented gap #4, now closed), plus two new precision guards. No RM-00 case moved.

## What was broken

`supersedePatches` (record.js) and `updateMany` (store.js) both existed, were unit-tested, and
were **called by nothing**. So "I work at Acme" then "Actually I work at Globex now" stored *two*
current facts, and recall surfaced the stale one. The missing piece was never persistence — it
was the **decision**: *when are two memories a correction rather than two separate truths?*

## The measurement that shaped the design

Before writing a line of detection, the pairwise cosines (offline cache):

```
0.5703   "I work at Acme"        <> "Actually I work at Globex now"   SHOULD supersede
0.5599   "I live in Austin"      <> "I moved to Denver last month"    SHOULD supersede
0.5124   "Actually...Globex now" <> "I live in Austin"                MUST NOT (different slot)
0.4736   "I work at Acme"        <> "I live in Austin"
```

> **On this embedder, a same-attribute update and a different-attribute statement in the same
> first-person voice are only ~0.05 cosine apart.** Cosine alone cannot tell a correction from a
> coincidental resemblance.

A similarity-threshold-only detector would eventually retire an unrelated memory (the 0.51 case
is a *new job*, not a move — it must not delete "I live in Austin"). Worse, two genuinely
additive facts — "I have a dog named Rex" / "I have a cat named Whiskers" — are geometrically
*closer* (shared "I have a … named" frame) than the real updates, so cosine-only would delete
the dog.

## The design (cue-gated, argmax-targeted)

Supersession fires only when **all** hold (`detectSupersession`, record.js — pure, unit-tested):

1. the new memory carries an explicit **correction cue** (`actually`, `now`, `moved`, `no longer`,
   `switched`, `instead`, …) — *not* history cues like "used to", which surface the old fact;
2. it is above a **similarity floor** (0.535 — measured to sit between the 0.51 cross-slot pair
   and the 0.56 real updates); and
3. it retires only the **single most-similar** current memory (argmax), never a set.

**The cue gate carries the precision; cosine only picks which memory the cue targets.** This is
the honest boundary: RM-03 detects *user-signalled* corrections, not silent value swaps ("I work
at Globex" with no cue, following "I work at Acme", is **not** caught — documented, not hidden).

## What the guards prove

```
contra-job          Globex retires Acme                     PASS  (cue + 0.57)
contra-city         Denver retires Austin                   PASS  (cue + 0.56)
contra-wrongslot    new job does NOT retire the city        PASS  (cue, but 0.51 < floor)
contra-additive-pets  cat does NOT retire the dog           PASS  (no cue -> both kept)
```

The last two are the point: they are the cases a naive "high similarity → supersede" gets
**wrong**, and they lock the precision boundary into the golden.

## Known boundaries (measured, not aspirational)

- **The 0.535 floor is empirically tuned** to this embedder on short first-person statements,
  where the same-slot/different-slot margin is only ~0.05. It is fragile *by nature of the
  geometry*; the cue gate, not the floor, is what makes the mechanism safe.
- **Supersession is order-dependent** — it only retires memories already present when the
  correction is saved. (This is why `field-rescue`'s "The Friday standup moved to 3pm" line,
  which carries the "moved" cue, does **not** disturb that corpus: at save time its only
  neighbors score 0.43, below the floor.)
- **Silent value swaps are out of scope** — no cue, no supersession, by design.

## Decision

Supersession is **on by default** in the `save` verb (unlike the field, which stays parked): it
is cue-gated and argmax-limited, so its worst case is retiring nothing, and the guard cases prove
it does not delete additive or cross-slot facts. The RM-04 bi-temporal model (`valid_to`,
`superseded_by`, `supersedes`, `revision`) now has its first live writer.

---

# RM-00 field experiment #1 — reciprocal (mutual) kNN

**Date:** 2026-08-01 · same harness. **Scorecard: 20/27 → 21/27**, `noise-schedule [field:on]`
flips **fail → pass**, no regressions. First experiment run *against* the parked field, judged by
the golden the way RM-00 said it must be.

## Hypothesis

RM-00 measured the field's one concrete harm: on "when is my doctor's appointment," the field
appended "the mechanic said the car will be ready **Thursday**" — a false positive on a shared
token. Diagnosis: **directional** kNN edges are asymmetric. A generic node that shares a word with
many others lands in *their* top-k and gets dragged into a seed's neighborhood, even though it
does not rank *them* back. Hypothesis: require the association to be **reciprocal** (edge a↔b only
if each is in the other's top-k) and the one-sided hub link disappears.

## Result — a cost removed, not value added

```
                    directional kNN (RM-00)      mutual kNN (this run)
noise-schedule on   fail  (mechanic FP)          PASS   <-- FP pruned
field-rescue*  on   fail  (leaf stranded)        fail   (unchanged)
field lifted        0, and BROKE 1               0, and BROKE 0
```

Mutual kNN did exactly what it was meant to and **nothing more**:

- **It removed the field's only measured precision cost.** The Thursday bleed is gone; the field
  went from **net-negative** (breaks 1, earns 0) to **net-neutral** (breaks 0, earns 0).
- **It did not earn a single rescue.** `field-rescue`/`-veg`/`-heights` are unchanged. That is
  expected and worth stating plainly: leaf-stranding is a **traversal-reach** problem (the leaf's
  edge exists but the walk doesn't reach it, or never formed), not an **edge-quality** problem.
  Reciprocity prunes bad edges; it cannot manufacture a path to an isolated leaf.

So the honest headline is unchanged from RM-00: **the field still does not beat cosine — it has
stopped *losing* to it.** The RM-00 result ("topology not validated over cosine") stands; what
moved is that turning the field on is no longer strictly a downgrade.

## Decision

Mutual kNN is a **Pareto improvement** on the corpus (one case up, none down), so per the ratchet
it becomes the **default** edge construction and the golden is re-locked at **21/27**. This is the
bar climbing on a real gain, not the bar being lowered to manufacture a pass — the distinction the
RM-00 discipline turns on. Escape hatch `RESONANCE_FIELD_MUTUAL=0` restores directional kNN for
comparison. Unit tests (`test.js`, "reciprocal kNN") lock the semantics: mutual is always a subset
of directional, and it prunes exactly the un-reciprocated edges.

**What this does NOT change:** the field is still **off by default**, and the product is still not
marketed as "learns which memories belong together." Removing a cost is not earning a keep. The
next field experiments (activation-spreading / 2-hop-with-a-precision-guard to attack traversal
reach; a lower gate for edge *formation* on the `heights` never-forms case) must show a real
**fail → pass on a rescue** against this 21/27 golden.

---

# RM-00 field experiment #2 — instrumentation first (ROC / TBR split)

**Date:** 2026-08-01. **No behavior change** — pure measurement, golden still 21/27. Built before
touching any traversal or gate, on external review's advice: a flat pass/fail scalar weights a *fatal
false negative* ("forgot the user is diabetic") the same as an *annoying false positive* ("also
mentioned the mechanic"), and for a memory system those are not equal. So the scorecard now reports
two rates apart (`eval/metrics.js` `fieldSignals`, panels in `eval/run.js`):

- **ROC — Constraint Rescue Rate:** did the apex rule surface? Measured over the `metric:"roc"` cases
  (`constraint-crowded` + the three `field-rescue*`).
- **TBR — Tangent Bleed Rate:** did a forbidden term leak in? Measured over the `metric:"tbr"` noise
  cases, plus `+Nrel` = how many memories the field *appended* (tangent surface, the early-warning gauge).

**Baseline (mutual-kNN default):**
```
ROC  off=1/4 (25%)  on=1/4 (25%)   field-attributable rescues: 0
     (only constraint-crowded rescues, via cosine; the field rescues 0/3 stranded leaves)
TBR  off=0/2 (0%)   on=0/2 (0%)    appended: noise-schedule +1rel, noise-homonym +4rel
     (0 forbidden bleed, but the field already appends 1-4 non-answer nodes on precision queries)
```

This is the legibility foundation for experiment #2 (typed-constraint retrieval). The bar is now
explicit and two-dimensional: **drive ROC up (rescue the diabetic/veg/heights leaves) while holding
TBR at 0** — and watch `+Nrel` as the leading indicator that a gate loosening is about to bleed.

## Stage 1 — typed traversal (no gate change): diabetic + vegetarian rescued

**Result: ROC 25% → 75% (3/4), TBR held at 0%, golden 22→23/27.** The first field-attributable
constraint rescues in the project's history. Three mechanisms, all local, no gate drop, no LLM:

1. **Server-side constraint typing at save** (`record.detectConstraint`, wired through `normalize`).
   A lexical heuristic flags apex rules (diabetic / vegetarian / allergic / terrified / "no meat"…).
   Measured on the corpus: **4/4 constraints flagged, 0 false positives across 131 memories.** The
   server assigns it, never the model (small-model-safe); it only widens retrieval, so a false
   positive is cheap.
2. **Decoupled search vs return radius** (`K_SEARCH=15`, `return_k=5`). The model still sees 5, but
   the field's constraint walk seeds from the top 15 — so the diabetic bridge "lemon bars" (rank 7)
   becomes a seed.
3. **Constraint-restricted bidirectional 1-hop** (`field.reachableConstraints`). From the wide seed
   pool, surface any *typed constraint* that is either (a) in the pool but outside the returned top-k
   (vegetarian, rank 10 — it fell in the gap between return_k and k_search), or (b) reachable via a
   bridge in the pool (diabetic, rank 21 → via lemon bars, rank 7). **Restricted to constraints**, so
   the wider radius cannot re-drag a non-constraint hub — the noise corpora have no constraint to
   surface, so TBR is protected *by construction*, and indeed `+Nrel` on the noise cases was unchanged.

`heights` still fails: its only bridge (`rooftop`, cos 0.472) is below the 0.55 edge gate, so it forms
no association at all. That is Stage 2's target — a constraint-only gate drop to ~0.45.

## Stage 2 — constraint-only gate drop to 0.45: heights rescued, geometry wins

**Result: ROC 75% → 100% (4/4), TBR held at 0%, golden 23 → 24/27.** `heights` — the case external
review first conceded to a save-time NLI model, believing the bridge "does not exist (cos 0.395)" —
flipped `fail → PASS` on **pure local geometry**. The lever was a single default change: the constraint
gate (the min cosine for a *typed constraint* to claim a bridge in the seed pool) dropped 0.55 → **0.45**,
which lets `heights → rooftop` (0.472) form. `RESONANCE_CONSTRAINT_GATE` A/Bs it.

All three stranded constraints now rescue, with **zero tangent bleed and no LLM/NLI/cloud anywhere** —
the geometric thesis holds end to end. The `heights` rescue in particular only exists because the
`0.395 → 0.472` measurement error was caught; trusting the first read would have shipped a 30MB model
the geometry did not need.

### Honest boundary — what this corpus can and cannot prove about the 0.45 gate
The gate only governs whether a **typed constraint** finds a bridge; it never loosens ordinary recall,
and it is inert on any query whose store has no constraint memory — which is exactly why TBR stayed 0
on the noise cases (they contain no constraints). **So this corpus does not yet stress the real
precision risk of a 0.45 gate:** a store where a constraint has a *spurious* 0.45–0.55 link to an
unrelated query's seeds, and would surface when it should not. The next adversarial corpus case should
be exactly that — a constraint that must **not** fire — so TBR has something real to catch at 0.45.
Until then, 0.45 is validated only on non-adversarial evidence (ROC 4/4, TBR 0), and that caveat is the
honest state of it.

## Stage 3 — the adversarial test paid off: one hole fixed, one hard boundary found

Built the "constraint that must NOT fire" cases Stage 2 said it owed (`corpora/adversarial.jsonl`).
Both bled on the first run (TBR 0 → 100%) — the test did exactly its job. Diagnosis found **two
distinct failure modes**, not one:

**Mode 1 — small-store over-reach (`adv-offtopic-quiet`): FIXED.** With `k_search=15`, a store of 8
memories means the seed pool *is the whole store*. The old "surface a constraint that's in the pool but
unreturned" path (the mechanism that had rescued vegetarian) then fired for **any** constraint in a small
store — a shellfish allergy surfaced for "when should I change my oil" (constraint↔query cos 0.430, and
it had *no* bridge at all). Fix: **removed the pool-membership auto-surface entirely.** A constraint must
now EARN its way in through a genuinely query-relevant bridge (`reachableConstraints`, bridge path only).
Vegetarian still rescues — via its "dinner playlist" bridge, not by mere existence — so **ROC held at
4/4 while `adv-offtopic-quiet` flipped to pass.**

**Mode 2 — lexical polysemy (`adv-height-homonym`): the measured boundary of pure geometry.** "I'm
terrified of heights" surfaces for "how tall should I make the bookshelf" because *height/tall* tokens
dominate the vector. This is not tunable — it is the distributional-vs-entailment gap, and three separate
geometric separators were measured to **fail**:

```
signal                     legit rescue (veg)   spurious trap (heights→bookshelf)
constraint↔query cosine    0.536                0.537        <- one thousandth apart
bridge cosine              0.592 (playlist)     0.594 (top shelf)
constraint's rank in the   #6 of 20             #6 of 10     <- same band; and the GOOD
bridge's own neighbor list                                     heights rescue is #16
```

Cosine, query relevance, and reciprocal rank all overlap the good and bad cases. **No purely geometric
rule separates "vegetarian bears on cooking" from "heights spuriously matches a tall bookshelf."** That
is a real, honest result — and it is the first place in this whole line of work where a **tiny local
semantic/entailment check is measurement-JUSTIFIED** rather than assumed: run only as a precision filter
on the ≤4 constraints a query actually rescues (local, cheap, no per-recall-on-everything cost), to
answer "does this rule bear on this query?" — the one question geometry provably cannot. Not built yet;
it is now a defensible design option instead of a premature reflex.

**Net:** golden 24/27 → **27/31** (2 adversarial cases added; `adv-offtopic-quiet` passes, the polysemy
`adv-height-homonym [field:on]` is locked as a *documented known-fail boundary* — a future entailment
filter flipping it to pass will register as the improvement it is). ROC 4/4 held; TBR 2/2 → **1/4**, the
single remaining leak being the polysemy case we now understand exactly. The field stays behind its flag:
the adversarial test **validated that decision** — the precision hole is real, one half is closed by
geometry, and the other half has a named, measured path forward.

### Corrected geometry that sets up experiment #2 (measured, not assumed)
External review initially conceded `heights` to a save-time NLI model, believing the `heights↔rooftop`
edge "does not exist (cosine 0.395)." That 0.395 is `heights`-to-**query**; the actual **pair** cosine
`heights↔rooftop` is **0.472** — below the 0.55 edge gate but **above 0.45**. Measured best bridges:
```
diabetic  → "lemon bars"     0.613   (already forms at 0.55)
vegetarian→ "dinner playlist"0.592 / "ribeye" 0.571  (forms — but to semantically INVERTED neighbors)
heights   → "rooftop bar"    0.472   (forms only at a ~0.45 gate)
```
So all three leaves have a real geometric bridge at ≥0.45. **The rescue is reachable on local geometry
alone — no LLM/NLI extraction needed.** Plan for #2: type constraints at save (server heuristic, not the
model), give typed constraints a lower edge gate (~0.45) + exemption from mutual-kNN + a bidirectional
1-hop restricted to them, and decouple the internal search radius (k_search≈15) from the returned k (5)
so a rank-7 bridge like "lemon bars" becomes a seed. The typing keeps the aggressive reach settings off
the ordinary nodes, so `noise-schedule` precision is not re-broken.

---

## Phase 0.1 — save-time bind cost sweep (2026-09-05)

Pre-declared p95 budget **250 ms** (written in `eval/save-time-cost.js` before any
measurement ran). Isolates neighbor scan + `EdgeStore.save` of K=5 edges; embed and JSONL
rewrite excluded. 768-d JS Arrays (production shape). Reproduce: `node eval/save-time-cost.js`.

| N | trials | p50 (ms) | p95 (ms) | p99 (ms) | K bound | vs 250 ms |
|---|--------|----------|----------|----------|---------|-----------|
| 100 | 80 | 1.7 | 2.0 | 2.7 | 5 | UNDER |
| 1 000 | 40 | 2.0 | 2.4 | 2.6 | 5 | UNDER |
| 10 000 | 20 | 8.6 | 9.1 | 9.1 | 5 | UNDER |
| 50 000 | 12 | 38.2 | 45.5 | 45.5 | 5 | UNDER |
| 100 000 | 8 | 75.4 | 77.1 | 77.1 | 5 | UNDER |

Sidecar rewrite footnote (mature `.edges.json`, no scan): 1k edges p95 2.9 ms · 10k 12.6 ms ·
50k 59.1 ms.

**RM-07 verdict: NO-GO on forcing `RM-07` from this slice.** Scan p95 at N=100k is 77.1 ms
against a 250 ms budget. `RM-07` stays scheduled on the JSONL-rewrite / `all()`-parse
grounds already in BACKLOG. Full write-up: [`phases/phase-0`](../docs/phases/phase-0-edge-substrate.md).

Golden (`npm run eval`) after this slice: **No regressions vs golden.** Recall still uses
`field.js`; the persist-on-save path is additive.

---

# RM-02.a — measurement seed (pre-dedup baseline)

**Date:** 2026-09-05 · **Product behaviour:** unchanged (`memory-core.js` / `record.js` /
`save` / `recall` untouched). **Embedder:** `text-embedding-nomic-embed-text-v1.5`,
cache-extended for the new corpus. **Reproduce:** `node eval/measure.js --bands`
(offline after the cache commit). Golden: `node eval/run.js` → **No regressions vs golden.**

This slice builds the three things RM-02's acceptance names and that did not exist:
a `duplicate_rate` metric, a `recall@k` metric, and `eval/corpora/duplicates.jsonl`.
Dedup itself is 02.b; these numbers are the "before."

## Registry

Reporting metrics live in `eval/metrics.js` as named entries
`{ name, compute(results, corpus, opts) -> number }`, distinct from the golden
contains/excludes scorer. Builtins: `recall_at_k` (success@k, default k=5) and
`duplicate_rate`. Adding `mrr` / `staleness_rate` / `extraction_precision` is
`register({ name, compute })`. Runner: `eval/measure.js` (reuses `pipeline.js`).
Levers (field, k) are runner flags, not metric internals.

`duplicate_rate` = `max(0, N − G*) / N` on `store.current()`: N = current stored
records, G* = labeled groups represented among them (unmatched texts count as
their own singleton). Membership is stored `text` ∈ the group's write texts.
This is **not** "pairs with cosine > 0.95" — measuring cosine-dedup by cosine
would be circular; the labels are the ground truth.

`recall_at_k` = fraction of queries whose top-k **primary** cosine ids contain
at least one relevant id (success@k, not set-recall). Relevant ids resolve
through the same text→group mapping.

## Corpus (`eval/corpora/duplicates.jsonl`)

One store, four bands, 15 groups, 23 writes, 17 queries. Pairwise cosine is
from the committed cache (overlapping strings with `basic.jsonl` keep their
original vectors — that's the geometry the rest of the eval uses):

| group | band | members | pairwise cos |
|---|---|---|---|
| coffee-order | exact | 2× byte-identical | 1.0 (collapsed by the shipping restatement path) |
| penicillin | hi | 3 paraphrases | 0.9883 / 0.9651 / 0.9524 |
| tea | hi | 2 | 0.9522 |
| peanuts | hi | 2 | 0.9581 |
| job | mid | 2 (longer = more specific) | 0.9261 |
| cat | mid | 2 | 0.9435 |
| diabetic | mid | 2 | 0.9433 |
| dog, peanut-allergy, standup, mechanic, name, night-owl, sister-bday, garage | control | 1 each | — |

Controls include two **precision traps**: `dog` vs `cat` (same-frame pets, live
pair ~0.69) and `peanut-allergy` vs `peanuts` (same-topic, live pair ~0.67).
Both sit well below DEDUP_LO ~0.88; a too-aggressive merge would tank
`q-cat` / `q-dog` / `q-peanut-allergy`. No correction cues, so RM-03 does not fire.

The brief's example pair *"I'm allergic to penicillin" / "penicillin gives me
hives, I'm allergic"* measured **0.8941 (mid, not hi)** on this embedder. HI
in the corpus is tighter paraphrases that actually clear 0.95; mid is the
"same fact, one more specific" band.

## Baseline (today, pre-dedup)

```
writes=23  stored_current=22  groups=15  exact_restatements_caught=1
duplicate_rate  0.3182   (extras=7/22, G*=15)
recall@5        1.0000   (17/17 queries hit)
```

**Existing restatement path:** the byte-identical `coffee-order` pair is
confirmed, not appended (`Already remembered`). **No HI paraphrase is
caught** — `r.text === content` is exact match only, so the four HI extras
and three mid extras all store. That is the RM-02 gap, measured.

Extras by band: HI 4 (penicillin 2 + tea 1 + peanuts 1) · MID 3 · exact 0 ·
control 0.

## Pre-declared RM-02 pass bar (written BEFORE 02.b runs)

Same discipline as the Phase 0.1 250 ms budget. Changing these numbers after
seeing 02.b's table is cheating.

| metric | baseline | pass iff |
|---|---|---|
| `duplicate_rate` | **0.3182** | drops ≥ 50% relative → **≤ 0.1591** |
| `recall@5` | **1.0000** | not lower → **= 1.0000** (17/17 holds) |

Arithmetic that 02.b will hit whether or not it ships the mid band:

| 02.b does | extras left | stored | rate | relative drop | vs 50% |
|---|---|---|---|---|---|
| nothing | 7 | 22 | 0.3182 | 0% | FAIL |
| HI restatement only (4 extras gone) | 3 | 18 | 0.1667 | **47.6%** | **FAIL** (shy of 50%) |
| mid merge only (3 extras gone) | 4 | 19 | 0.2105 | 33.8% | FAIL |
| HI + mid (the spec) | 0 | 15 | 0.0000 | 100% | PASS, if recall@5 holds |
| over-merge a control into a dup group | ≤3 | ≤18 | maybe ≤0.1591 | maybe | **FAIL on recall@5** (q-cat / q-dog / q-peanut-allergy) |

So the 50% bar is not free on the easy ≥0.95 band: **DEDUP_HI restatement
alone is expected to miss.** The mid-band merge is what the acceptance
actually demands. Over-merge is caught by recall@5 sitting at 1.0 with
no room to drop.

Reproduce the before-column: `node eval/measure.js --corpus duplicates`.
02.b compares the after-column to the table above.

---

# RM-02.b — cosine-banded dedup/merge at save (measured A/B)

**Date:** 2026-09-05 · **Product behaviour:** `save()` in `memory-core.js` now
runs cosine-banded dedup against already-stored vectors after embed, before
RM-03. **Embedder:** `text-embedding-nomic-embed-text-v1.5`, same committed
cache. **Reproduce:** `node eval/measure.js --corpus duplicates` (offline).
Golden: `node eval/run.js` → **No regressions vs golden.** (27/31 unmoved —
the golden corpora are distinct memories, so the bands did not fire.)

This is the first real measured A/B in the project: 02.a built the stick and
locked the bar; this slice moved the number and proved it.

## Tuned thresholds

| knob | value | why |
|---|---|---|
| `DEDUP_HI` | **0.95** (`≥`) | HI paraphrases sit 0.9522–0.9883. Tea at **0.9522** is the tightest HI and clears 0.95 with margin. `≥` not `>`: a pair sitting exactly on 0.95 is treated as restatement (keep the original) rather than merge. Equality is hypothetical on this corpus. |
| `DEDUP_LO` | **0.88** (`≥`, band is `[lo, hi)`) | Mid pairs sit 0.9261–0.9435; controls ≤ ~0.69 (dog/cat ~0.69, peanuts/peanut-allergy ~0.67). 0.88 sits well above the control ceiling so those traps cannot merge. |

Config, not constants: env `RESONANCE_DEDUP_HI` / `RESONANCE_DEDUP_LO` plus
live-config keys `dedup_hi` / `dedup_lo` (same pattern as the field toggle).
Defaults are these tuned values.

HI-only restatement would have left the three mid extras (`duplicate_rate`
0.1667, shy of 0.1591). The mid-band merge is what the 50% bar actually
demanded. Confirmed: no control crept in, no mid pair was missed.

## After (02.b)

```
writes=23  stored_current=15  groups=15  exact_restatements_caught=5
duplicate_rate  0.0000   (extras=0/15, G*=15)
recall@5        1.0000   (17/17 queries hit)
```

`exact_restatements_caught` rose 1 → 5 because HI paraphrases now share the
byte-identical confirm path ("Already remembered"): coffee-order (exact) +
penicillin ×2 + tea + peanuts. The three mid extras (job, cat, diabetic) were
merged via `supersedePatches` (loser linked with `superseded_by`, survivor
kept one of the original texts). Controls untouched.

## A/B vs the pre-declared bar

| metric | baseline (02.a) | after (02.b) | pass iff | verdict |
|---|---|---|---|---|
| `duplicate_rate` | **0.3182** | **0.0000** | ≤ 0.1591 (≥50% relative drop) | **PASS** (100% drop) |
| `recall@5` | **1.0000** | **1.0000** | = 1.0000 (17/17 holds) | **PASS** (controls not over-merged) |

Both conditions. `q-cat` / `q-dog` / `q-peanut-allergy` still hit — the
precision traps did not fire. Survivor texts are original labeled writes, so
the group mapping did not break.

## Decision

Cosine-banded dedup is **on by default** in `save()` (unlike the field):
worst case on a miss is "append as before"; a hit never hard-deletes (I8:
restatement keeps the original; merge links the loser with `superseded_by`).
No vector (embedder down) → append, don't crash.

---

# RM-02.c — `--dedup-existing` backfill (offline pass)

**Date:** 2026-09-05 · **Product behaviour:** `save()` / `recall()` untouched
(CLI/maintenance path). Same bands, same `detectNearDuplicate` /
`pickMergeSurvivor` / `mergeBandPatches` as 02.b — the planner lives in
`memory-core.js` so the offline pass and the write path cannot disagree.
**Reproduce:** the corpus fixture is built inside `test.js` ("duplicates
corpus backfill"); golden: `node eval/run.js` → **No regressions vs golden.**

This is the retroactive pass for stores written **before 02.b**. Exact
restatement already existed (RM-04), so a pre-02.b store still carries the
four HI extras and three mid extras — the 02.a baseline.

## Pass order

File order (JSONL insertion). Each current record is treated as an incoming
`save()` against the survivors of earlier records. That is why `--apply`
twice is a no-op: after one pass every remaining current pair is below
`DEDUP_LO` (or vectorless, which we refuse to merge blind). Dry-run is the
default; `--apply` is one `store.updateMany` → `writeFileDurable` (I5).
Restatement losers already on disk are superseded, not deleted (I8) — so
`current()` matches sequential save, while `all()` keeps the extra rows.

## Backfill result (pre-02.b fixture)

`eval/corpora/duplicates.jsonl` writes, save-time dedup **bypassed**, the
second byte-identical `coffee-order` dropped (already collapsed by RM-04).
22 current records, 7 extras. Dry-run plan: 4 HI restatements (penicillin,
tea, peanuts) + 3 mid merges (job, cat, diabetic); 8 controls untouched.

```
current           22 → 15
duplicate_rate    0.3182 → 0.0000   (extras 7 → 0, G*=15)
recall@5          1.0000            (17/17 queries still hit)
```

Same after-column as 02.b's sequential save. Online-vs-offline equivalence
(synthetic fixture in `test.js`): `current()` texts match one-by-one
`save()`. Second `--apply` writes nothing. Vectorless row + dead embedder
→ skipped, not merged.

## Decision

`--dedup-existing` ships as a CLI (dry-run default). RM-02 acceptance is
fully met: the 50% bar was cleared by 02.b at save-time, and 02.c applies
the same decision to stores that never went through that path.

---

# RM-01.a — measurement seed (pre-extraction baseline)

**Date:** 2026-09-05 · **Product behaviour:** unchanged (`memory-core.js` / `record.js` /
`save` / `recall` untouched). **Embedder:** `text-embedding-nomic-embed-text-v1.5`,
cache-extended for the new corpus. **Reproduce:** `node eval/measure.js --corpus messy`
(offline after the cache commit). Golden: `node eval/run.js` → **No regressions vs golden.**

This slice builds the three things RM-01's acceptance names and that did not exist:
an `extraction_precision` metric, `eval/corpora/messy.jsonl`, and a recall@5 backstop
on that corpus. Extraction itself is 01.b (Tier 0/1, Tier 2 off); these numbers are
the "before."

## Registry

`extraction_precision` is a named entry in the same `eval/metrics.js` registry as
`recall_at_k` / `duplicate_rate`. Adding it is `register({ name, compute })`; the
runner (`eval/measure.js`) emits it when the scenario's writes carry `gold_facts`.

Definition, computable from what `save()` actually persists:

```
precision = n_correct / n_stored
```

A stored record is **correct** iff its text equals one of the write's gold atomic
facts (whitespace-collapsed, case-folded) **and** contains none of that write's
noise spans. Exact equality, not containment: today's `save()` stores the raw
blob, which *contains* the fact plus filler/imperative/sibling-fact — counting
that as correct would make the pre-extraction baseline look healthy.

- `n_stored` is the per-write delta of `store.current()` (a restatement confirm
  that writes nothing contributes 0; a refusal that writes nothing contributes 0).
- PII writes have `gold_facts: []` and `expect_refusal: true`. Storing the payload
  is a false positive. Refusing (stored nothing, `refused=true`) does not dilute
  precision; `pii_refusal_rate` in `explain` is the dedicated readout
  (refused-and-wrote-nothing / PII cases).
- Vacuous: labeled cases + zero stored → 1.0 (no false positives). That is the
  all-refuse cheat — precision aces, recall@5 is the backstop. Unlabeled input
  (no `gold_facts`) → 0, so `computeAll` on a duplicates result doesn't look like
  a perfect extraction run.

## Corpus (`eval/corpora/messy.jsonl`)

One store, 23 writes, 19 queries. Gold facts are unique across writes so 01.b
restatement will not collapse the A/B. No correction cues, so RM-03 does not fire.
Bands:

| band | n | what 01.b should do |
|---|---|---|
| filler | 6 | strip the opener ("I think you should know that…", "just so you're aware", "FYI", stacked), keep the fact |
| imperative | 3 | drop assistant-aimed framing ("remember to remind me", "make sure you", "Please remember that"), keep the embedded fact |
| multi | 2 | split on `; ` / ` and also ` — both halves stand alone (≥4 words + copula/verb, not a dependent clause) |
| multi-nosplit | 1 | `and also` but the second half does **not** stand alone ("…and also with honey") — keep as one fact |
| pii | 6 | refuse the whole write (API key / password / card / AWS / PEM / GitHub token). Fake payloads; they match the 0001 shapes |
| control | 5 | clean single facts, including two digit traps (garage code `4821`, `1500mg` metformin) that must **not** trip the card-number guard |

## Baseline (today, pre-extraction)

```
writes=23  stored_current=23  groups=23  exact_restatements_caught=0
duplicate_rate         0.0000   (no dup labels; each write is its own text)
recall@5               1.0000   (19/19 queries hit)
extraction_precision   0.2609   (correct=6/23 stored, labeled=23)
pii_refusal_rate       0.0000   (0/6 PII writes refused)
```

**What the 6/23 is.** `save()` stores the trimmed raw text as-is. The five
controls and the should-not-split compound equal their gold facts, so they
count as correct. Every filler/imperative/to-split-multi blob fails exact
match (and the filler/imperative ones contain a noise span). Every PII
payload is stored — there is no guard.

That is the RM-01 gap, measured: filler, imperatives, and compound facts
all land as one embedding; secrets land at all.

## Pre-declared RM-01.b pass bar (written BEFORE 01.b runs)

Same discipline as the RM-02.a 50% bar and the Phase 0.1 250 ms budget.
Changing these numbers after seeing 01.b's table is cheating. **Tier 2 is
off** — 01.b is deterministic Tier 0 + Tier 1 only. (Tier 2 is deferred
pending a design decision with Samuel.)

| metric | baseline | pass iff |
|---|---|---|
| `extraction_precision` | **0.2609** (6/23) | **≥ 0.9** (Tier 2 off) |
| `recall@5` | **1.0000** (19/19) | not lower → **= 1.0000** |
| `pii_refusal_rate` | **0.0000** (0/6) | **= 1.0000** (every PII write refused; implied by the spec's "every secret-shaped input is refused" and needed to clear 0.9 — leaving all 6 PII stored caps precision at 17/23 = 0.739 even with perfect Tier 0) |
| write-latency p95 | (Tier 2 off) | **unchanged** — Tier 0/1 are string ops, no extra embed, no LLM/network call. Extra embeds from a *legitimate* split are in-scope (that's storing two memories, not extraction overhead). |

Arithmetic that 01.b will hit:

| 01.b does | correct/stored | precision | vs 0.9 | recall@5 |
|---|---|---|---|---|
| nothing | 6/23 | 0.2609 | FAIL | holds |
| PII refuse only (6 gone) | 6/17 | 0.3529 | FAIL | holds (queries aren't the PII writes) |
| filler+imperative strip, no split, no PII guard | 14/23 | 0.6087 | FAIL | holds if controls pass through |
| Tier 0 perfect, PII still stored | 17/23 | 0.7391 | FAIL | holds |
| Tier 0+1 perfect (the spec) | 19/19 | **1.0000** | PASS, if recall@5 holds and controls aren't rewritten |
| over-split the nosplit trap | 18/20 or similar | maybe ≥0.9 | maybe | **FAIL on q-tea-honey** if the surviving half doesn't carry "honey" / the labeled text |
| strip a control ("I think" false-positive on a non-opener) | <19/19 | maybe | maybe | **FAIL on recall@5** if the gold text is gone |
| refuse everything | 0/0 → vacuous 1.0 | PASS on precision | **FAIL on recall@5** (19 misses) |

So the 0.9 bar is not free on PII-refuse-alone or filler-strip-alone: **Tier 0
and Tier 1 together are what the acceptance actually demands**, and recall@5
sitting at 1.0 with no room to drop is the anti-cheat for "drop the messy
writes, keep the controls."

Reproduce the before-column: `node eval/measure.js --corpus messy`.
01.b compares the after-column to the table above.

---

# RM-01.b — Tier 0/1 extraction (measured A/B)

**Date:** 2026-09-05 · **Embedder:** `text-embedding-nomic-embed-text-v1.5`.
**Reproduce:** `node eval/measure.js --corpus messy` (offline after the cache
commit). Golden: `node eval/run.js` → **No regressions vs golden.**
**Product:** `record.js` `prepareWrite` / `normalizeText` / `splitFacts` /
`guardSecrets`; `memory-core.js save()` is the single caller (no fork).
Tier 2 is **not** in this slice.

## After (Tier 0 + Tier 1 on, Tier 2 off)

```
writes=23  stored_current=18  groups=23  exact_restatements_caught=0
duplicate_rate         0.0000
recall@5               1.0000   (19/19 queries hit)
extraction_precision   1.0000   (correct=19/19 stored, labeled=23)
extraction_recall      1.0000   (hit=19/19 gold facts)
pii_refusal_rate       1.0000   (6/6 PII writes refused)
```

`extraction_recall` is new this slice (`|gold facts with a matching stored
record| / |gold facts|`). Vacuous precision (refuse everything → 1.0) would
crater it; the A/B is two-sided.

## Before → after vs the pre-declared bar

| metric | 01.a baseline | 01.b | bar | verdict |
|---|---|---|---|---|
| `extraction_precision` | 0.2609 (6/23) | **1.0000** (19/19) | ≥ 0.90 | PASS |
| `extraction_recall` | (not registered) | **1.0000** (19/19) | anti-cheat (no vacuous 1.0) | PASS |
| `recall@5` | 1.0000 (19/19) | **1.0000** (19/19) | = 1.0000 | PASS |
| `pii_refusal_rate` | 0.0000 (0/6) | **1.0000** (6/6) | = 1.0000 | PASS |
| write-latency p95 | string ops | string ops; +1 embed per legitimate split (2 splits in this corpus) | unchanged except in-scope split embeds | PASS |

Arithmetic: 6 PII refused, 2 multi-facts split (each +1 record), 19 gold
facts stored. `stored_current=18` not 19 because RM-02.b mid-band-merged
"I prefer tea over coffee" into the longer nosplit
"I like tea more than coffee and also with honey" (cosine **0.8831**, just
above `DEDUP_LO` 0.88). That is not an extraction miss — both writes stored
their gold (precision 19/19, recall 19/19); the survivor still answers
`q-tea` and `q-tea-honey`. The measure runner follows `superseded_by` so a
merge is not scored as a drop.

Clean controls (`My name is Samuel`, garage `4821`, `1500mg` metformin, …)
pass through byte-identical. Golden corpora are clean facts; the gate did
not move.

---

# RM-01.c — Tier 2 opt-in LLM extraction (messy-hard)

**Date:** 2026-09-05 · **Embedder:** `text-embedding-nomic-embed-text-v1.5`.
**Chat model (live A/B only):** `openai/gpt-oss-20b` · **temperature 0** (greedy) ·
`max_tokens` 400 · timeout 45s for the measurement (production interactive
bound is 8s). **Reproduce the offline floor:**
`node eval/measure.js --corpus messy-hard` (Tier 2 off, cached embed).
**Reproduce the live column:** load the chat model beside the embedder, then
`node eval/measure.js --corpus messy-hard --extract --extract-model openai/gpt-oss-20b --extract-timeout 45000`
with `EVAL_REFRESH=1` so newly extracted strings enter the cache. **Not part of
the golden gate.** Golden: `node eval/run.js` → **No regressions vs golden.**
Tier 2 is **off by default**; `eval/run.js` never invokes it.

`eval/messy` is already maxed by Tier 0/1 (precision 1.0, recall 1.0). Tier 2
cannot show improvement there. `eval/corpora/messy-hard.jsonl` is the stick:
implicit facts, facts buried in narrative, paraphrase multi-facts that do not
split on `; ` / `and also`, coreference. Matching is **cover** (short stored
text covering gold tokens), not exact — an LLM will paraphrase. Query→gold
geometry (nomic-embed-text-v1.5): **24/24** queries sit closer to their gold
fact than to the raw narrative blob.

## Tier-0-only baseline on messy-hard (measured BEFORE the live run)

```
writes=12  stored_current=9  groups=12  exact_restatements_caught=0
duplicate_rate         0.0000
recall@5               0.0000   (0/24 queries hit)
extraction_precision   0.0000   (correct=0/12 stored, labeled=12)
extraction_recall      0.0000   (hit=0/24 gold facts)
```

Tier 0 stores the narrative blob. Cover-match rejects long blobs on purpose,
so every gold fact is a miss. `stored_current=9` not 12 because RM-02.b merged
three near-narrative pairs after the fact — extraction scoring is per-write
delta (12 blobs stored, 0 correct), not the post-merge current count.

## Pre-declared RM-01.c pass bar (written BEFORE the live Tier-2 run)

Same discipline as the RM-02.a 50% bar and the 01.b 0.9 bar. Changing these
numbers after seeing the live table is cheating.

| metric | Tier-0 baseline | pass iff |
|---|---|---|
| `extraction_recall` | **0.0000** (0/24) | lift **≥ +0.50** absolute → **≥ 0.50** (Tier 2 recovers the implicit facts) |
| `extraction_precision` | **0.0000** (0/12) | **≥ baseline** (the spec) **and ≥ 0.70** (anti-hallucination floor — ≥ 0 is free when baseline is 0; we require most stored facts to cover gold) |
| `recall@5` | **0.0000** (0/24) | **rises** (atomic facts retrieve; the blob does not) |

`eval/messy` with Tier 2 **off** stays at precision 1.0 / recall 1.0 (01.b
acceptance, unchanged). Write-latency p95 with Tier 2 off is still string
ops — the live path is not entered.

## After (live Tier 2 ON, `openai/gpt-oss-20b`, temp 0)

```
writes=12  stored_current=42  groups=12  exact_restatements_caught=0
duplicate_rate         0.0000
recall@5               0.5833   (14/24 queries hit)
extraction_precision   0.3023   (correct=13/43 stored, labeled=12)
extraction_recall      0.5833   (hit=14/24 gold facts)
```

Model id: **`openai/gpt-oss-20b`** (MXFP4, LM Studio). Temperature **0**.
`max_tokens` 400. Measure timeout 45s (no timeouts fired). Interactive
production bound remains 8s.

## Before → after vs the pre-declared bar

| metric | Tier-0 baseline | Tier 2 ON | bar | verdict |
|---|---|---|---|---|
| `extraction_recall` | 0.0000 (0/24) | **0.5833** (14/24) | ≥ 0.50 | **PASS** (+0.58) |
| `extraction_precision` | 0.0000 (0/12) | **0.3023** (13/43) | ≥ baseline **and ≥ 0.70** | ≥ baseline **PASS**; ≥ 0.70 **FAIL** |
| `recall@5` | 0.0000 (0/24) | **0.5833** (14/24) | rises | **PASS** |

`eval/messy` with Tier 2 off is unchanged (precision 1.0 / recall 1.0 / recall@5 1.0).
Write path with the toggle off never calls extract (unit-tested).

### What the extras are (not invented medical facts)

43 stored vs 24 gold. The 30 "incorrect" records are almost all **true
details copied from the source** that the gold did not list, plus a few
ephemeral / process sentences the prompt asked to omit:

- Thyroid: stored "had a great chat with Dr. Chen about my thyroid" and
  "keep taking the same dose" — did **not** emit "I have a thyroid
  condition". Follow-up was phrased "Dr. Chen wants me back in 3 months"
  (cover-miss vs the gold wording).
- Honey / cats: stored the *evidence* ("skipped baklava because of the
  honey", "cats trigger my symptoms") rather than the named constraint
  ("I cannot eat honey", "I am allergic to cats").
- Cello / parrot / Maya / Oak / Harbor: surface-form gold, recovered.

No case invented a fact absent from the input (no fabricated doctor, no
fake allergy). The precision miss vs 0.70 is **over-extraction of
unlabeled true details + sentence-copy instead of implicit naming**, not
hallucination of things that are not there. gpt-oss-20b at temp 0 is
faithful and verbose. A follow-up (different instruct model, or a
stricter "at most 2 facts, name the implied condition") could chase the
0.70 floor; this slice records the first live number.

Query misses (10/24): thyroid, follow-up, wrists, oat, tom-job, honey,
mead, cats, dogs, lena-start — the implicit-naming cases plus a few
cover-threshold near-misses.

### Backlog acceptance (the original RM-01 line)

- `extraction_precision ≥ 0.9` on `eval/messy` with Tier 2 off: **met (01.b)**.
- Tier 2 improves `recall@5` without lowering precision (messy-hard):
  recall@5 0 → 0.58, precision 0 → 0.30: **met**.
- Write latency p95 unchanged when Tier 2 off: **met** (path not entered).

RM-01 is done against that acceptance. The extra 0.70 anti-flood floor
on messy-hard is a recorded miss, not a silent one.

---

# Tier 1 prefix widening (2026 issued shapes)

**Date:** 2026-09-07 · **Product:** `record.js` `SECRET_PATTERNS` /
`guardSecrets` only. Recall path untouched. Golden must hold 27/31.
**Reproduce:** `node test.js` (modern-shape refuse + prose canaries);
`node eval/measure.js --corpus messy` (offline; new PII rows are refused
pre-embed so the cache does not grow); `node eval/run.js`.

01.b caught hyphen fakes (`ghp-`, `sk-`, `xoxb-`) plus cards / PEM / AWS
`AKIA` / `password:`. GitHub's *issued* shape is underscore (`ghp_`,
`github_pat_`); Stripe is `sk_live_`; Google is `AIza…`. Those missed.
The widening is prefix+length+charset, not English — a false positive
drops the whole write (refuse-not-redact), which is worse than missing
an exotic key.

True-positives added to `eval/corpora/messy.jsonl` (refused, empty gold).
Prose canaries live in `test.js` so they do not perturb recall@5
geometry or require `EVAL_REFRESH`.

Historical 01.b A/B above is unchanged (6 PII writes, precision 1.0).
Measured on the widened corpus (`node eval/measure.js --corpus messy`):

```
writes=34  stored_current=18
recall@5               1.0000   (19/19 queries hit)
extraction_precision   1.0000   (correct=19/19 stored, labeled=34)
extraction_recall      1.0000   (hit=19/19 gold facts)
pii_refusal_rate       1.0000   (17/17 PII writes refused)
```

Same 19 gold facts as 01.b; 11 new PII rows, all refused pre-embed.

---

# S1 — recall accuracy + latency at scale (needle-in-haystack)

**Date:** 2026-09-05 · **Product behaviour:** unchanged (`memory-core.js` /
`save` / `recall` untouched). **Track:** substrate stress-tests. **Reproduce:**
`node eval/substrate/scale.js` (live embed once against LM Studio
`text-embedding-nomic-embed-text-v1.5` on `:1234`; later runs read
`eval/substrate/.cache/`, gitignored). Generator seed `0x525301` in
`eval/substrate/generate.js` — the seed + generator are committed, not 50k
vectors. Golden: `node eval/run.js` → **No regressions vs golden.**

This is the reproducibility case for the product: prove RM's own recall
works — accurately, at scale, under any driver — without borrowing a big
model's intelligence. It is also the test of RM as an *agent's* cross-session
memory (surface the right knowledge from a large accumulated store amid
distractors), not just a user-fact lookup.

Characterization, not a pass/fail A/B. `mrr` lands in the reporting-metric
registry (`eval/metrics.js`); `eval/measure.js` emits it. The scale runner
is `eval/substrate/scale.js`.

## Corpus

24 planted needles (preferences, facts, conditions, relationships, events,
possessions) each with a query whose relevant record is known **by
construction**, plus 3 hard near-topic distractors per needle (same-frame
different value / other-person / homonym / related-entity / historical).
The `height-bookshelf` needle carries `I'm terrified of heights` as a
distractor — the `adv-height-homonym` problem at scale.

Haystack fill is first-person about the same entity, across many topics,
and is **forbidden** from restating a needle's current first-person slot
(`I work at …`, `I live in …`, `I'm allergic to …`). A store of 50k
contradictory jobs is not a haystack.

Needles occupy stable ids 1…P as N grows; extra volume is haystack only.
Same 24 queries at every N.

## Pre-declared concern thresholds

Written in `eval/substrate/scale.js` **before any measurement ran**.
Changing these after seeing the table is cheating (same discipline as
Phase 0.1's 250 ms save-time budget).

### Quality (field off, primary cosine)

| signal | concern iff | why |
|---|---|---|
| `recall@5` | **< 0.90 at N=50k** | discrimination failing: a near-distractor or haystack noise beat the needle out of top-5 |
| `MRR` | **< 0.80 at N=50k** | needles slipping even if they still make the top-5 window |
| mean rank of the needle | **> 3 at N=50k** | the "right memory" is no longer the answer an agent would use |
| hard-distractor beat rate | **> 0.20 at any N** | the homonym/same-frame trap outranks the needle (`adv-height-homonym` at scale). Per query: did *any* planted hard distractor outrank that query's needle? |

`recall@1` is reported but not gated: top-1 is strict and a single near-distractor stealing #1 while the needle stays #2 is a slope (MRR), not a miss (`recall@5`).

### Latency (one `recall(query, k=5)` through the real path)

JsonlStore `all()` parse + cosine scan + format. Field-on also pays
`field.buildEdges` O(n²) per call (W-03).

| signal | concern iff | owner |
|---|---|---|
| field-off p95 | **> 100 ms at N=10k** | **RM-07**. BACKLOG estimated a ~10k JSONL ceiling; RM-07's own acceptance is "100k memories, recall p95 <100ms" (the SQLite *target*). Crossing 100 ms at 10k on JSONL confirms the estimate. |
| field-off p95 | **> 250 ms at N=50k** | **RM-07**. Phase 0.1 "tool is hanging" bar. |
| field-on p95 | **> 1000 ms at N=10k** | **W-03**. `field.buildEdges` is O(n²); ANN rides with RM-07. |

Field-on at N≥50k is capped if the first trial exceeds 120 s (Phase 0.1
scan numbers imply ~30 min/recall at 50k, hours at 100k). That cap is
itself a W-03 finding, not a skip of the measurement.

### How to read the story

- Quality holds, latency blows up → **RM-07 / W-03** (index + incremental store).
- Quality degrades → **substrate discrimination**, its own slice (bands, not ANN).
- Both → both owners.

## Measured

**Date of run:** 2026-09-05. Embedder `text-embedding-nomic-embed-text-v1.5`
(768-d) via LM Studio `:1234`. 100,029 texts live-embedded (24 needles + 72
hard distractors + haystack + 24 queries), cached in `eval/substrate/.cache/`
(gitignored). Ranking through `pipeline.js` → `memory-core.recall`. I9
primary-identical field on/off at N=1k: **HOLD**.

### Quality (field off)

| N | Q | recall@1 | recall@5 | recall@10 | MRR | mean rank | median | beat rate | missed |
|---|---|----------|----------|-----------|-----|-----------|--------|-----------|--------|
| 1 000 | 24 | 0.5417 | 0.7917 | 0.9583 | 0.6772 | 3.46 | **1** | 0.3333 | 0 |
| 10 000 | 24 | 0.5417 | 0.7500 | 0.7500 | 0.6508 | 26.50 | **1** | 0.3333 | 0 |
| 50 000 | 24 | 0.5417 | **0.7500** | 0.7500 | **0.6472** | **115.08** | **1** | **0.3333** | 0 |
| 100 000 | 24 | 0.5417 | 0.7500 | 0.7500 | 0.6471 | 159.75 | **1** | 0.3333 | 0 |

Bold cells trip a pre-declared threshold (recall@5 / MRR / mean rank gated at
N=50k; beat rate at any N).

**The curve in one sentence:** specific questions stay at rank 1 through 100k;
underspecified questions and same-frame distractors fail at 1k and stay failed.
Haystack volume is not what breaks recall@1 — geometry is.

Three populations, visible in the per-query ranks:

**1. Stable rank-1 (13/24), including the height-homonym needle.** Rank 1 at
every N through 100k: bookshelf height, Austin, diabetic, Rex, Friday standup,
Maya's birthday, night-owl, lisinopril, spouse Jordan, Civic, Project Harbor,
Colemak, O-neg. **`I'm terrified of heights` did not beat "how tall should I
make the bookshelf"** — that trap is a field-on TBR (`adv-height-homonym`),
not a cosine miss. Cosine keeps the bookshelf at #1 in a 100k store.

**2. Stable near-miss (5/24), rank 2 at every N.** Scale-invariant. Four are
planted hard distractors at #1:

| query | needle rank | who beat it (kind) |
|---|---|---|
| what am I allergic to | 2 | "I'm allergic to cats" (same-frame different value) |
| how much is my rent | 2 | "Maya's rent is $1850" (same number, other person) |
| what phone do I have | 2 | "I used to have an iPhone" (historical same slot) |
| when is my dentist appointment | 2 | "I need to schedule a dentist appointment" (related, not the booked one) |
| where do I want to travel | 2 | *haystack* (not a planted distractor) — a first-person visit memory stole #1 |

**3. Falling tail (6/24).** Underspecified queries. Rank grows roughly with N
because many haystack memories share the frame:

| query | 1k | 10k | 50k | 100k |
|---|---|---|---|---|
| where do I work | 10 | 104 | 656 | 1118 |
| what should I eat for dinner | 7 | 138 | 560 | 671 |
| how do I take my coffee | 20 | 157 | 670 | 959 |
| can I eat the Thai noodles | 10 | 143 | 578 | 732 |
| what music do I like | 9 | 57 | 230 | 284 |
| can I eat the pizza | 4 | 14 | 45 | 47 |

These six are why mean rank explodes (3.5 → 160) while **median stays 1**.
MRR barely moves (0.677 → 0.647) because the 13 rank-1 hits dominate the
mean of reciprocals; a rank-1000 miss contributes ~0 either way.

**Distractor-beat 8/24 = 0.3333 at every N.** Same eight queries, same
planted beaters. Haystack growth did not recruit new planted distractors
into beating the needle. The 0.20 ceiling trips at 1k already — this is
embedder geometry, not scale. Extra beaters vs the table above:
"I like podcasts more than music on long drives" ranks #1 for "what music
do I like" at every N (the word *music* is in the distractor); "The pizza
place on 6th has a gluten-free crust" ranks #1 for "can I eat the pizza".

#### Quality vs the pre-declared bar

| signal | bar | measured at 50k | verdict |
|---|---|---|---|
| recall@5 | ≥ 0.90 | **0.7500** (18/24) | **TRIPPED** |
| MRR | ≥ 0.80 | **0.6472** | **TRIPPED** |
| mean rank | ≤ 3 | **115** | **TRIPPED** (median 1; tail-driven) |
| distractor-beat | ≤ 0.20 | **0.3333** (already at 1k) | **TRIPPED** |

Owner: **substrate discrimination**, not RM-07. Cosine does not separate
same-frame different-value ("allergic to cats" vs penicillin) or a generic
question from a large same-frame haystack ("where do I work" / "what should
I eat"). It *does* separate a specific question from 100k distractors,
including the height/tall homonym.

### Latency

| N | field | trials | p50 (ms) | p95 (ms) | p99 (ms) | jsonl | vs bar |
|---|---|---|---|---|---|---|---|
| 1 000 | off | 40 | 51.1 | 61.1 | 66.3 | 16.7 MB | — |
| 1 000 | on | 8 | 687.6 | 724.2 | 724.2 | 16.7 MB | under 1000 ms |
| 10 000 | off | 20 | 464.0 | **488.7** | 513.5 | 167 MB | **> 100 ms — RM-07** |
| 10 000 | on | 3 | 90512 | **90795** | 90795 | 167 MB | **> 1000 ms — W-03** (91 s) |
| 50 000 | off | — | — | — | — | 834 MB | **cannot load**: Node `readFileSync` max string 0x1fffffe8 (~512 MB) |
| 100 000 | off | — | — | — | — | 1.67 GB | same wall |

Field-on at N≥50k was not run (pre-declared cap; 10k already 91 s, O(n²)
projects to ~30 min at 50k).

**The JSONL wall is harder than the 10k estimate.** `JsonlStore.all()`
reads the whole file as one UTF-8 string. A 50k-record store *with
embeddings in the JSONL* is 834 MB, above Node's ~512 MB string cap, so
`recall()` throws before cosine runs. Comfortable loaded ceiling with
768-d vectors in JSONL is between 10k (167 MB, works, p95 489 ms) and
~30k (would approach 512 MB). That is a **GO on RM-07**, not a schedule
item: the current backend cannot serve a 50k store.

In-memory ranking cost, isolated from the parse (quality pass, RamStore,
k≤50): ~0.7 ms/query at 1k · ~9.5 ms at 10k · ~52 ms at 50k · ~113 ms at
100k. The *scan* would meet a 100 ms bar at 50k if the store could load.
Parse, not cosine, is the field-off latency. Field-on is `buildEdges`.

#### Latency vs the pre-declared bar

| signal | bar | measured | verdict |
|---|---|---|---|
| field-off p95 at 10k | ≤ 100 ms | **489 ms** | **TRIPPED — RM-07** |
| field-off p95 at 50k | ≤ 250 ms | cannot load (834 MB > 512 MB string) | **TRIPPED harder than the bar** |
| field-on p95 at 10k | ≤ 1000 ms | **90.8 s** | **TRIPPED — W-03** |

### Story

**BOTH.** They have different owners:

- **Quality / discrimination.** 13/24 needles are rank-1 at 100k. The
  failures are (a) same-frame distractors that already win at 1k and
  (b) underspecified queries that drown as the frame fills. Not an ANN
  problem. A later slice: query specificity, or a slot/type signal that
  is *not* rank (I2) — maybe a filter, maybe the `Related:` path.
- **Latency / RM-07 + W-03.** Field-off p95 489 ms at 10k and a hard
  inability to load 50k JSONL-with-vectors. Field-on 91 s at 10k
  (`buildEdges` O(n²)). SQLite + `sqlite-vec` (RM-07) and an ANN for
  the field (W-03) are now measured-mandatory, not estimated.

Reproduce: `node eval/substrate/scale.js` (offline after the cache fill).
`--quick` is N=1k; `--no-field` skips the 91 s 10k field-on cell.

### S1 follow-up — RM-07 spike (SQLite prototype, 2026-09-05)

Not a product Store. `memory-core.js` unchanged. Full write-up:
[`docs/proposed/0010-sqlite-backend.md`](../docs/proposed/0010-sqlite-backend.md),
numbers in [`spike/rm-07-sqlite/results.md`](../spike/rm-07-sqlite/results.md).

JSONL's load wall is gone. A `node:sqlite` prototype with BLOB vectors **loads
50k and 100k**. Field-off `recall()` through the JsonlStore surface, with an
in-process vector cache (hydrate once):

| N | JSONL S1 p95 | SQLite cached p95 | load |
|---|---|---|---|
| 10k | 488.7 ms | **10.4 ms** | both |
| 50k | cannot load (834 MB) | **57.9 ms** | SQLite yes (196 MB) |
| 100k | cannot load | **107.6 ms** | SQLite yes (393 MB) |

Packed cosine alone is 48 ms at 100k. sqlite-vec *does* load via
`node:sqlite` `loadExtension` and matches brute cosine (Δ 6.5e-8) but is
**slower** than RAM JS cosine at these sizes (159 ms at 100k). The S1
hypothesis holds: parse was the bottleneck, not cosine. Recommended v1 path
is BLOB + JS cosine, no vector extension.

Mini-SEA smoke: `node:sqlite` runs inside a Node 24.18.0 SEA
(`SEA node:sqlite OK`).

### S1 follow-up — RM-07 slice 1 product Store (2026-09-05)

Not the spike. `SqliteStore` in `store-sqlite.js`, same JsonlStore surface,
`memory-core.recall` unchanged. Direct INSERT (the migrator is slice 2a, below).
Reproduce: `node eval/substrate/scale.js --store sqlite --n 50000,100000 --no-field --latency-only --offline`.

| N | JSONL S1 | spike cached p95 | **product SqliteStore p95** | load | db |
|---|---|---|---|---|---|
| 50k | cannot load (834 MB) | 57.9 ms | **49.6 ms** | yes | 206 MB |
| 100k | cannot load | 107.6 ms | **96.4 ms** | yes | 412 MB |

Warm (hydrate-once) 544 ms @50k / 1.3 s @100k; then the cached scan. Insert
830 ms / 1.7 s. Pre-declared 250 ms @50k bar: **held**. The 0005 100k <100 ms
bar: **held on the JsonlStore surface**, without `searchDense`.

### S1 follow-up — RM-07 slice 2a streaming migrator (2026-09-05)

The product Store can load 50k. Existing users have JSONL (some too big for
JSONL to even load). Slice 2a is the non-destructive streaming migrator —
opt-in CLI (`node entry.js --migrate`), not auto-run, JSONL stays default
so the golden is unmoved.

Reproduce: `node eval/substrate/migrate-proof.js` (S1 generator, 50k × 768-d
synthetic vectors, access sidecar, a vectorless row, a 2019 `created`, a
superseded pair, a deleted row). Stream-write the JSONL, stream-migrate,
stream-compare against `sqlite.all()`. Never `readFileSync` the JSONL.

| | |
|---|---|
| N / dim | 50,000 / 768 |
| JSONL | **785.3 MB** (823,425,829 bytes) |
| `readFileSync` (the old wall) | **FAILED** — `Cannot create a string longer than 0x1fffffe8 characters` |
| stream-migrate | **2.456 s** → 50,000 rows |
| `.db` | **196.3 MB** |
| lossless | **yes** — 50k/50k field-equal, embeddings within 1e-5 |
| ids | preserved (not AUTOINCREMENT-renumbered) |
| `created` | preserved (2019-06-01 survived; the export folder tree keys on it) |
| access fold | in-row 2 + sidecar 3 = **5** (doubled would be 8) |
| vectorless | stayed vectorless (no invented blob) |

The stream is what beats the wall. Kill-9 before the `.db` rename is a unit
test: JSONL stays at its path, no half `.db` at `MEMORY_FILE_PATH`, re-run
completes (no resume-from-partial). `.bak` is a recovery snapshot, not the
sovereignty export (slice 2b).

### RM-07 slice 3 — golden parity (2026-09-05)

The drop-in contract: same `memory-core.js`, SqliteStore instead of JsonlStore,
**identical RM-00 scorecard**. This is the eval bar that unblocks the default
switch (slice 4); 2b export has shipped, 2c is the panel button.

Reproduce (slice 3; slice 4 flipped the default, same scorecard):

```
node eval/run.js                 # sqlite default (slice 4)
node eval/run.js --store jsonl   # JSONL path, still testable
```

Both offline (read `embeddings.cache.json`). Sqlite gate is two-sided parity
against `golden.json`; any case flip is a STOP.

#### Scorecards, side by side

| case | jsonl | sqlite |
|---|---|---|
| adv-height-homonym [field:off] | PASS | PASS |
| adv-height-homonym [field:on] | FAIL | FAIL |
| adv-offtopic-quiet [field:off] | PASS | PASS |
| adv-offtopic-quiet [field:on] | PASS | PASS |
| basic-name | PASS | PASS |
| basic-work | PASS | PASS |
| basic-pref | PASS | PASS |
| constraint-near [field:off] | PASS | PASS |
| constraint-near [field:on] | PASS | PASS |
| constraint-far-sparse [field:off] | PASS | PASS |
| constraint-far-sparse [field:on] | PASS | PASS |
| constraint-far-rich [field:off] | PASS | PASS |
| constraint-far-rich [field:on] | PASS | PASS |
| constraint-crowded [field:off] | PASS | PASS |
| constraint-crowded [field:on] | PASS | PASS |
| contra-job | PASS | PASS |
| contra-city | PASS | PASS |
| contra-wrongslot | PASS | PASS |
| contra-additive-pets | PASS | PASS |
| noise-schedule [field:off] | PASS | PASS |
| noise-schedule [field:on] | PASS | PASS |
| noise-homonym [field:off] | PASS | PASS |
| noise-homonym [field:on] | PASS | PASS |
| field-rescue [field:off] | FAIL | FAIL |
| field-rescue [field:on] | PASS | PASS |
| field-rescue-veg [field:off] | FAIL | FAIL |
| field-rescue-veg [field:on] | PASS | PASS |
| field-rescue-heights [field:off] | FAIL | FAIL |
| field-rescue-heights [field:on] | PASS | PASS |
| regress-direct [field:off] | PASS | PASS |
| regress-direct [field:on] | PASS | PASS |
| **TOTAL** | **27/31** | **27/31** |
| field lifted fail→pass | 3 | 3 |
| field BROKE | 1 | 1 |
| ROC off / on | 1/4 / 4/4 | 1/4 / 4/4 |
| TBR off / on | 0/4 / 1/4 | 0/4 / 1/4 |

**No case flipped.** Gate lines: jsonl `No regressions vs golden.` · sqlite
`SqliteStore scorecard matches golden case-for-case.`

#### f32 vs f64

JsonlStore stores embeddings as JSON float64 arrays; SqliteStore stores
Float32 BLOBs. A 7th-decimal cosine difference *could* swap a near-tie
(`constraint-crowded` is k=5; tea HI is 0.9522 vs `DEDUP_HI` 0.95).

Measured on this corpus:

- 354 cached vectors, 271,872 components: every value is already an exact
  f32 (`Math.fround(x) === x`). `nomic-embed-text-v1.5` via the JSON cache
  does not produce leftover f64 bits. Packing is lossless; pairwise
  `|cos(f64,f64) − cos(query-f64, stored-f32)|` over the cache is **0**.
- Tea HI pair: cosine **0.952246** on both paths, **0.002246** above 0.95.
- Primary-hit **text** order identical on all 31 checks (opaque ids differ
  because `nextId()` is `Date.now()`).

No tolerance in the parity gate. A silent epsilon would hide a real
inequivalence; this run did not need one. Clean equivalence, not a fudge.

JSONL stayed the default through this slice. Slice 2b (export/zip) and 2c
(panel button) landed next; slice 4 flipped the default (see below).

---

## RM-07 slice 2b — sovereignty export (2026-09-05)

`--export` zip + `--export-jsonl`. Read-only. Not the golden gate.
Reproduce: `node eval/substrate/export-proof.js`.

S1 generator, 50k records, 768-d synthetic vectors, planted CJK / `CON` /
deleted / superseded rows, Hebbian sidecar with a `processed_ids` LRU that
must not travel.

| | |
|---|---|
| SqliteStore | 196.3 MB |
| export | **34.3 s** → 50,005 entries, **387.0 MB** zip |
| `memories.jsonl` uncompressed | 791.7 MB (streamed; never one string) |
| Windows `ZipFile.OpenRead` | **50,005** |
| jsonl round-trip | **50k/50k** field-equal, embeddings within 1e-5 |
| catalog paths | 50,000/50,000 resolve |
| layout | `memories/YYYY/MM/DD` |
| CJK slug | preserved |
| reserved `CON` | `<id>.json` |
| `edges.json` | Hebbian present; `processed_ids` omitted |
| store mutated | no |
| synthetic ZIP64 | **70,000** entries, Windows opens 70,000, 0.9 s |

Golden unmoved (export is a separate CLI path). Panel button is 2c.

---

### RM-07 slice 4 — default switch (2026-09-05)

SQLite is the default. `openStore()` auto-migrates an existing JSONL on
first open via the 2a protocol; a failed migrate fail-opens to JSONL.
`RESONANCE_STORE=jsonl` pins JSONL. Eval default follows the product
default (two-sided parity). `--store jsonl` stays testable.

Reproduce:

```
node eval/run.js                 # sqlite default; 27/31; No regressions vs golden.
node eval/run.js --store jsonl   # JSONL path; 27/31; No regressions vs golden.
```

Golden unmoved (slice 3 already proved case-for-case identity). A golden
move on the default flip would have been a STOP.

---

## Entity layer + field minSim 0.70 + embedder invocation (2026-09-07)

Follow-on from `eval/substrate/fire-together-embedder-fair-report.md`:
the embedder is not the lever. This pass *ships* the measured ones.

**What changed in the product**

1. `entity.js` — server-assigned (I4) person ids + polarity. Closed-class
   relation (family/work/friend) × relation-anchored name. Related: edge
   drop + Hebbian `pairScale` zero on mismatch. Primary cosine untouched (I2).
2. Related: minSim **0.55 → 0.70**. Constraint rescue stays at 0.45.
3. Cosine-gated reinforce (`α × (cos − gate) / (1 − gate)`) and
   neighborhood-normalized field bonus (`tanh(w / nodeMax)`). EdgeStore
   `bonus()` stays tanh (Ledger parity).
4. `embed-invoke.js` — nomic raw, Qwen Instruct-query, jina Query:/Document:.

**Entity layer, measured** (`eval/substrate/entity-layer-measure.js`)

| check | result |
|---|---|
| sister-Naima t3_m1/m2/m3 | one id (`e1`) — over-split guard held |
| coworker-Naima t3_nm | `e2`, conflicts with all three true members |
| fire-together true pairs sharing an id | 3/15 (exactly the three sister-Naima pairs; other themes have no person names) |
| named true pairs split | **0** |
| fire-together near-miss conflicts | 3/15 (exactly the three sister-Naima near-misses) |
| probes A1–A4, Ap1–Ap2, B1, F1–F2, P1–P2 | **11/11** |
| nomic-plain field kNN @ 0.70 | true 14/15, near-miss **0/15** (entity filter adds nothing on this set — Omar-class is not in the 5-theme members; it is in A2/A3 at cosine 0.88–0.95, which 0.70 cannot catch and the entity filter does) |

**Golden verdict: HELD 27/31, not re-accepted.**

`node eval/run.js` (sqlite) and `--store jsonl` are case-for-case identical
to `golden.json`. Field-rescue / veg / heights still fail-off pass-on
(constraint gate 0.45 is independent of minSim 0.70). `adv-height-homonym`
field:on still fails (terrified-of-heights still bridges at 0.45 onto a
bookshelf-height query). Raising minSim did not flip that TBR case and
did not drop a rescue. No `--accept`.

**Ceilings, named**

- B1 (sister Naima chemist vs sister Layla chemist): different entity ids,
  but no *name-conflict* flag, so Related: still follows geometry (~0.88).
  The filter is name-keyed on purpose; a role-only penalty would also
  drop two facts about one unnamed sister.
- Polarity generalizes to closed-class predicates (incompatible vs
  synergistic on a shared object). It does not invent a topic ontology.
  Arbitrary antonyms still need NLI/cross-encoder, not a bigger embedder.
- Primary-rank cofire on underspecified queries ("what do I drink?") is
  I2. Entity/minSim clean Related: and starve Hebbian; they do not reorder
  the cosine top-k.

---

---

## What 0001 got wrong (and 01.b did not ship)

Measured against the messy gold, not 0001's regexes as-is (01.a NOTES §3):

- `^(i think )` half-strips "I think you should know that Samuel prefers
  concise answers" to "You should know that…" — still contains the noise
  span, fails exact gold. Opener is the **full phrase**.
- Missing "just so you're aware", "remember to remind me", "make sure you",
  "don't forget to", "be sure to".
- Guard is **refusal not redaction**: a fact mixed with a secret is
  store-nothing.
- Card pattern stays `\b[0-9]{13,16}\b` — `4821` and `1500mg` survive.
- Split is conservative: `and also with honey` is not a standalone half.

---

## Related

[[eval/README]] · [[0007-eval-harness]] · [[phase-0-edge-substrate]] · [[phase-2-retrieval-dynamics]] · [[BACKLOG]] · [[ARCHITECTURE]]
