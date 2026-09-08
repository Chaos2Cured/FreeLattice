# 0006 — Soft constraints, importance decay, pruning

**Status:** proposed · **Backlog:** `RM-08` · **Depends on:** `RM-04`, `RM-00`

> **Scope banner (read first).** This doc owns two things, both about *records*: constraint
> retrieval, and **importance** decay (`importance · exp(−λ·Δt)`, a retention signal). It does
> **not** own the *edge* substrate or **learned-edge** decay — those moved to
> [`phase-0`](../phases/phase-0-edge-substrate.md) (`RM-21`, roadmap Phase 0). The two decays are
> distinct mechanisms on distinct objects; do not conflate them (see phase-0). And per the three
> corrections below, treat the *constraint* half here as **measure-first, probably redundant** —
> `field.js` + `ledger.js` may already do it (`RM-08` acceptance measures exactly that).

## Problem

Three related failures, all about *which memories deserve to be present*.

### 1. Constraints surface only when they happen to match

> "I'm diabetic — don't give me sugary recipes."

**First, a correction to an earlier draft of this document.** It claimed that asking for a
dessert wouldn't surface this memory, because "dessert" isn't close to "I'm diabetic." That
argument was wrong, and wrong in an instructive way: it silently compared the query against a
*truncated* version of the memory. The stored text contains **"sugary"** and **"recipes"** —
a dessert or recipe query has real lexical and semantic overlap with it, and probably does
clear the gate. The same draft then asserted two paragraphs later that "the substrate already
places these near each other," which contradicts the claim outright. **Treat the near-miss
case as unmeasured until `eval/constraints` says otherwise** (see `RM-00`).

**Then a second correction, and then a third — this section has now been wrong three times,
each time by analysing retrieval as if it were a static function of cosine.**

The second draft demoted semantic distance but promoted **top-k crowding** in its place,
arguing a constraint could score above the gate and still lose all five slots, and that better
embeddings would make that *worse* by surfacing more competitors.

That is also wrong, and this time the counter-evidence is in the codebase. Read
`server.js: recallMemory()`:

```js
const edges = field.buildEdges(mems, { k: 2, minSim: 0.55, bonus });
const rel   = field.neighborhood(edges, ranked.map(m => m.id), { hops: 1, max: 4 });
if (rel.length) out += "\n\nRelated:\n" + ...
L.reinforceRecall(ranked.map(m => m.id), rel.map(e => e.id));
```

Three things follow, and together they dismantle the crowding argument:

1. **`Related:` is a separate channel.** Up to four more memories, reached by *association*
   from whatever did match. They do not compete for the five cosine slots. A constraint
   crowded out of the ranked list is still reachable — the effective budget is nine, not five.
2. **The Hebbian bonus is added before the gate.** `bonus(a,b)` from `ledger.js` is
   `0.3·tanh(w)`, applied inside `buildEdges` *before* `minSim` is checked. A learned
   association can lift a weak-cosine edge **over** the gate. `field.js` says so in its own
   docstring: "lets a learned association lift a weak-cosine edge over the gate without
   erasing semantics."
3. **It compounds.** `reinforceRecall` strengthens the edge every time the constraint
   co-surfaces. So the association gets *easier* to trigger the more it is used — the exact
   opposite of the "better embeddings crowd it out" claim, and the whole reason the Hebbian
   layer exists.

**The mechanism this document proposed building already exists and already learns.** A recipe
query pulls recipe memories by cosine; the graph reaches the constraint from them; surfacing it
reinforces that edge; next time it fires more readily, and eventually clears the gate for
queries that started out too distant. That is precisely the "matching gets stronger with use"
behaviour the project was built around, and three drafts of this section reasoned as though it
weren't there.

### What is actually missing

Much less than any previous draft claimed:

1. **The field is off by default.** None of the above happens for a typical user. This is
   almost certainly worth more than every feature specified below, and it costs nothing to
   change once `RM-00` validates it. *(Tracked as a known limitation in the changelog.)*
2. **Cold start.** On the first relevant query the Hebbian weight is zero, so the edge is pure
   cosine. The loop can't reinforce an association that has never once fired.
3. **One hop, not two.** `neighborhood(..., { hops: 1 })` reaches constraints adjacent to a
   match. The `chewtoy → heartworm → walk → diabetes → sugar` chain needs two, and each hop
   also has its own `max: 4` budget.
4. **The bonus is capped at 0.3** — deliberately, so learning can never swamp semantics. Sound
   design, but it means association alone cannot rescue an arbitrarily weak cosine.

Only (2) and (3) are code, and both are small: seed constraint edges at write time so the loop
has something to reinforce, and allow a second hop for `kind: "constraint"`. Neither needs a
domain model.

### What survives of the design below

The **reserved slot** is worth keeping for cold start — it's ten lines and it makes the first
firing happen, which is what the Hebbian loop needs in order to start compounding.

The `constraintDomain()` / `applicableConstraints()` machinery is **probably redundant**: it
reimplements, statically, what `field.js` + `ledger.js` already do dynamically and better.
It stays below only as the fallback if `constraint-far-sparse` fails *and* the two small fixes
above don't close the gap. **Measure before building any of it.**

### 2. Everything is equally permanent

A store only grows. "I'm allergic to penicillin" and "I'm at the airport" have identical
standing forever.

### 3. Nothing is ever removed

There is no pruning at all. `importance` is assigned (`= access_count`) and then never read by
anything. It is currently a **write-only field** — dead weight that looks like a feature.

---

## Part 1 — Constraints as a memory kind

### Classification (write side, cheap)

```js
const CONSTRAINT_RE = new RegExp([
  /\b(i'?m|i am) (allergic to|diabetic|vegetarian|vegan|lactose|celiac|sober)\b/,
  /\b(don'?t|do not|never|avoid|no more) \w+/,
  /\b(i can'?t|i cannot|i must not|i'?m not allowed to) \w+/,
  /\b(always|never) (give|send|suggest|recommend|use|call) me\b/,
].map(r => r.source).join("|"), "i");

function classify(text) {
  if (CONSTRAINT_RE.test(text)) return "constraint";
  return "fact";
}
```

Stored as `kind: "constraint"` (backfilled `"fact"` by `normalize()`, so nothing migrates).

### The reserved slot — for cold start only

> Not the first thing to build. **Measure what the associative field already does first**
> (`constraint-learning` and the `field: true`/`false` pair in `0007`). This exists for the
> case the field cannot cover on its own: the very first firing, when the Hebbian weight is
> still zero and there is no learned edge to lift the constraint over the gate.

Reserve one of the `k` result slots for the best-scoring constraint, so a constraint that
clears the gate can never be squeezed out of the *ranked* list by memories matching the
phrasing more closely.

Note this is a **cold-start aid, not a crowding fix** — the opening of this document explains
why crowding isn't fatal on its own (`Related:` is a separate channel of four more slots
reached by association, so a constraint pushed out of the ranked five is still reachable). What
the reserved slot buys is the *first* firing, before any Hebbian weight exists to lift that
association over the gate. Once the loop has fired once, it compounds on its own.

```js
const CONSTRAINT_GATE = 0.42;    // below the 0.55 edge gate; tune on RM-00

function withReservedConstraint(ranked, all, queryVec, k = 5) {
  if (ranked.some(m => m.kind === "constraint")) return ranked;   // already surfaced

  const best = all
    .filter(m => m.kind === "constraint" && !ranked.includes(m))
    .map(m => ({ m, s: cosine(queryVec, m.embedding) }))
    .filter(x => x.s >= CONSTRAINT_GATE)
    .sort((a, b) => b.s - a.s)[0];

  if (!best) return ranked;
  return [...ranked.slice(0, k - 1), best.m];   // drop the weakest, seat the constraint
}
```

Note what this does *not* do: it doesn't reorder the primary results and it doesn't invent a
similarity signal. It spends one slot of the output budget. **Ten lines and no new subsystem** —
which is why it's worth having even if measurement shows the field already covers most cases.

Everything below is the fallback for the case where similarity genuinely can't reach — build
it only if `constraint-far-sparse` proves that case is real.

### Domain extraction

A constraint needs to know *what it governs*. We already have the machinery — the constraint's
own embedding — so the domain is defined by proximity rather than by a taxonomy:

```js
/*
 * A constraint applies to a query when the query is semantically near the
 * constraint's DOMAIN, which is broader than the constraint's text.
 *
 * "I'm diabetic" -> domain includes food, sugar, dessert, recipes, snacks, health.
 *
 * We derive it without an LLM: take the constraint's neighborhood in the existing
 * association graph and use those memories as additional probes. This is precisely
 * what field.js already computes - we just consult it at a different moment.
 */
function constraintDomain(constraint, edges, records) {
  const near = field.neighborhood(edges, [constraint.id], { hops: 2, max: 12 });
  return {
    id: constraint.id,
    probes: [constraint.embedding, ...near.map(n => byId(records, n.id).embedding)].filter(Boolean),
    hops: new Map(near.map(n => [String(n.id), n.sim])),
  };
}
```

**Two hops, not one** — that's what carries `sugary recipe → walk → dog`. The graph is the
domain model; we don't need to build a second one.

### Surfacing

```js
// Reuses CONSTRAINT_GATE from the reserved-slot section above.
function applicableConstraints(queryVec, constraints, domains) {
  const hits = [];
  for (const c of constraints) {
    const d = domains.get(String(c.id));
    // Max over probes: near ANY part of the constraint's domain is enough.
    const score = Math.max(...d.probes.map(p => cosine(queryVec, p)));
    if (score >= CONSTRAINT_GATE) hits.push({ c, score });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, 3);
}
```

Appended to recall as a **separate section**, not merged into the ranked list:

```
1. [id 12] Rex needs his heartworm meds monthly
2. [id 31] I usually walk 3 miles after dinner

Keep in mind:
- [id 7] I'm diabetic — no sugary recipes.
```

> ### ⚠️ Invariant check
> This does **not** violate "ranking = cosine only." The ranked list is untouched, in the same
> order, by the same rule. Constraints are an *additional section* — the same structural move
> the associative field already makes with its `Related:` block, which was accepted on exactly
> this basis. Nothing is reordered; something is added.

---

## Part 2 — Importance decay

Replace the write-only `importance = access_count` with something that actually means
"how much does this still matter."

```js
/*
 * Exponential decay with a floor, refreshed by use.
 *
 *   importance(t) = base * exp(-lambda * days_since_confirmed) + floor(kind)
 *
 * lambda is per-kind: a constraint should barely decay; an observation should
 * fade quickly if never touched again.
 */
const HALF_LIFE_DAYS = { constraint: Infinity, preference: 365, fact: 180, observation: 30 };

function importanceOf(r, now = Date.now()) {
  const hl = HALF_LIFE_DAYS[r.kind] ?? HALF_LIFE_DAYS.fact;
  if (hl === Infinity) return 1;                         // constraints never decay
  const days = (now - Date.parse(r.last_confirmed || r.created)) / 864e5;
  const lambda = Math.LN2 / hl;
  const base = Math.min(1, 0.3 + 0.1 * (r.access_count || 0));   // use raises the ceiling
  return base * Math.exp(-lambda * days);
}
```

Two properties worth stating:

- **`last_confirmed` is the clock, not `created`.** A ten-year-old fact you reaffirmed
  yesterday is fresh. `RM-04` put that field there for exactly this.
- **Access raises the ceiling, not the score.** Frequently-used memories decay from a higher
  base rather than getting a rank bonus. **Importance still never touches ranking** — it
  governs retention only, per the invariant.

---

## Part 3 — Pruning (proposal, never silent deletion)

```js
const PRUNE_FLOOR = 0.05;

function pruneCandidates(store, now = Date.now()) {
  return store.current()
    .filter(r => r.kind !== "constraint")          // never propose a constraint
    .filter(r => !r.pinned)                        // never propose a pin
    .map(r => ({ r, importance: importanceOf(r, now) }))
    .filter(x => x.importance < PRUNE_FLOOR)
    .filter(x => (x.r.access_count || 0) === 0)    // never recalled even once
    .sort((a, b) => a.importance - b.importance);
}
```

Superseded memories are a separate, safer case — their successor already carries the truth:

```js
// A superseded memory whose successor has itself been stable for months is
// history nobody is reading. Drop the EMBEDDING (the bulk), keep the TEXT.
//
// Batch through updateMany: store.update() re-reads and rewrites the WHOLE
// file per call, so updating N records one at a time is O(N^2) writes. This
// is one read and one write regardless of how many rows compact.
function compactSuperseded(store, { afterDays = 180 } = {}) {
  const cutoff = Date.now() - afterDays * 864e5;
  const patches = {};
  for (const r of store.all()) {
    if (!r.valid_to || !r.embedding) continue;
    if (Date.parse(r.valid_to) < cutoff) patches[String(r.id)] = { embedding: null, compacted: true };
  }
  if (Object.keys(patches).length) store.updateMany(patches);
}
```

That reclaims ~95% of the bytes (768 floats vs a sentence) while keeping the historical record
readable. It directly answers the `store_growth` risk flagged in `proposed/0002`.

### The rule that matters

> **Nothing is ever deleted without the user seeing it first.**

Pruning produces a **review list in the panel**, with a one-click "keep" that pins the memory
and a "forget these" that batch-deletes. An idle pass may *propose*; only a human disposes.

This is not timidity. The asymmetry is real: a wrongly-kept memory costs a few bytes and a
slightly noisier graph. A wrongly-deleted memory is *gone*, the user finds out at the worst
possible moment, and they never trust the tool again. For a product whose entire pitch is
"this remembers for you," silent forgetting is the one unforgivable bug.

---

## Configuration

| Key | Default | Meaning |
|---|---|---|
| `constraints` | `true` | Surface applicable constraints on recall |
| `constraint_gate` | `0.42` | Domain-proximity threshold |
| `decay` | `true` | Compute importance with decay |
| `prune_review` | `true` | Generate prune proposals during idle passes |
| `auto_prune` | **`false`** | Never default to true |

## Risks

| Risk | Mitigation |
|---|---|
| Constraint fires on every query (noise) | Gate tuned on `RM-00`; hard cap of 3; measured by a false-positive metric |
| Constraint *misses* when it matters | `constraint_surfacing ≥ 0.9` is the acceptance gate. First line of defence is the associative field, which already reaches constraints and strengthens that path with use; the 2-hop domain is the fallback if measurement shows the field can't cover it |
| Decay drops something needed yearly ("my sister's birthday") | Never auto-prune; `last_confirmed` refresh on any access; pinning |
| Classifier mislabels a fact as a constraint | Over-inclusion is cheap here (a constraint just decays slower); under-inclusion is the costly error |
| `importanceOf` is recomputed on every read | Pure function of stored fields — memoize per read; no write amplification |

## Acceptance

> **Measure before building.** Everything below is the bar for the *finished* capability, not
> a build order. The first three bullets may already be met by the associative field as it
> stands — `constraint-learning` and the `field: true`/`false` pair in `0007` settle that, and
> a pass there removes most of this document's scope.

- **`constraint_surfacing ≥ 0.9`** on `eval/constraints` — including the dog→walk→diabetes→
  sugar chain, which is the canonical case. Report it with the field **on and off**; the gap
  is what the field is worth.
- The `constraint-learning` case reaches the constraint by a later turn than it does on turn 1
  — evidence the Hebbian loop is doing the work rather than a static domain model.
- Constraint false-positive rate < 0.1 on unrelated queries.
- **Zero** unreviewed deletions, ever.
- `store_growth` on the `RM-15` soak improves measurably with `compactSuperseded` on.
- Ranked recall order is **byte-identical** with constraints on vs off (they add a section;
  they do not reorder).

---

## Related

[[phase-0-edge-substrate]] · [[BACKLOG]] · [[ARCHITECTURE]] · [[RESULTS]] · [[proposed/README]]
