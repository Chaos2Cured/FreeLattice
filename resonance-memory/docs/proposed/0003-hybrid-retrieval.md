# 0003 — Hybrid retrieval (semantic + keyword + graph) via RRF

**Status:** proposed · **Backlog:** `RM-05` · **Depends on:** `RM-00`

> ## ⚠️ This proposal touches a ratified invariant
>
> `DEVELOPERS.md` states: **"Ranking = cosine only."** Hybrid retrieval changes ranking.
> This is a real conflict and must not be waved through. See [§5](#5-the-invariant-question)
> for the resolution — the short version is: **ship behind a flag, promote only on a measured
> A/B win, amend the invariant in the same PR with the measurement that earned it.**

## Problem

Retrieval today is cosine-only, with `keywordScore` used **only as a fallback when the
embedding endpoint is down** — it appears exactly once in `server.js`, inside the `catch` of
`recallMemory()`. That means we lose on exactly the queries dense vectors are worst at:

| Query type | Why cosine struggles | Example |
|---|---|---|
| Rare proper nouns | Not well represented in embedding space | "what did I say about **Kwaltz**" |
| Exact identifiers | Tokenized into meaningless pieces | "invoice **AC-9931**" |
| Numbers / dates | Embeddings smear numeric distinctions | "the **$4,200** quote" |
| Negation | Dense vectors famously ignore it | "the client who **didn't** sign" |

Meanwhile keyword search is terrible at synonymy and paraphrase — which cosine is great at.
They fail in *complementary* directions, which is the textbook case for fusion.

## Design: Reciprocal Rank Fusion

Fuse **ranks**, not scores:

```
RRF(d) = Σ  1 / (k + rank_i(d))          k = 60
        arms
```

Why RRF rather than a weighted score blend:

- **It sidesteps score incompatibility.** Cosine ∈ [-1,1], BM25 ∈ [0,∞) and is corpus-
  dependent. Naïve weighted averaging of incommensurable scales is the classic production RAG
  bug. RRF ignores magnitudes entirely.
- **`k = 60` is the well-established default.** It damps the influence of deep results; lower
  `k` over-weights top ranks, higher `k` dilutes the fusion.
- **It degrades gracefully.** An arm that returns nothing simply contributes nothing — no
  renormalization, no special-casing. Given our embedding endpoint can be *down*, this
  property is worth a lot.

### Arms

1. **Dense** — existing cosine over stored vectors. Unchanged.
2. **Sparse** — BM25 over memory text. A real BM25, replacing the naïve `keywordScore`
   (which is unnormalized set-overlap and rewards long documents).
3. **Graph** *(optional)* — `field.js` neighborhood expansion from the top dense hits. This is
   where **our** substrate enters the ranking, which no competitor's fusion has.

### Implementation

```js
// retrieve.js
function rrfFuse(arms, { k = 60, limit = 5 } = {}) {
  const scores = new Map();                 // id -> { score, arms: {} }
  for (const [armName, ranked] of Object.entries(arms)) {
    ranked.forEach((id, i) => {
      const key = String(id);
      const cur = scores.get(key) || { score: 0, arms: {} };
      cur.score += 1 / (k + i + 1);         // rank is 1-based
      cur.arms[armName] = i + 1;            // keep per-arm rank for RM-19 explainability
      scores.set(key, cur);
    });
  }
  return [...scores.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, limit)
    .map(([id, v]) => ({ id, score: v.score, arms: v.arms }));
}
```

BM25 over a local store, no dependencies:

```js
// bm25.js - k1/b are the standard defaults; tune only with RM-00 evidence.
class Bm25 {
  constructor(docs, { k1 = 1.5, b = 0.75 } = {}) {
    this.k1 = k1; this.b = b;
    this.docs = docs.map(d => ({ id: d.id, terms: tokenize(d.text) }));
    this.avgdl = this.docs.reduce((s, d) => s + d.terms.length, 0) / (this.docs.length || 1);
    this.df = new Map();
    for (const d of this.docs)
      for (const t of new Set(d.terms)) this.df.set(t, (this.df.get(t) || 0) + 1);
    this.N = this.docs.length;
  }
  idf(t) {
    const n = this.df.get(t) || 0;
    return Math.log(1 + (this.N - n + 0.5) / (n + 0.5));      // BM25+ style, always positive
  }
  search(query, limit = 20) {
    const q = tokenize(query);
    return this.docs.map(d => {
      let s = 0;
      const len = d.terms.length;
      for (const t of new Set(q)) {
        const f = d.terms.filter(x => x === t).length;
        if (!f) continue;
        s += this.idf(t) * (f * (this.k1 + 1)) /
             (f + this.k1 * (1 - this.b + this.b * len / this.avgdl));
      }
      return { id: d.id, s };
    }).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, limit).map(x => x.id);
  }
}
```

> **Once `RM-07` lands, delete most of this.** SQLite FTS5 gives BM25 natively and
> incrementally — no in-memory index rebuild per query. The class above is the JSONL-era
> bridge, and it is deliberately written to be thrown away.

### Wiring

```js
async function recallHybrid(query, k = 5) {
  const mems = store.current();
  const arms = {};

  try {
    const qv = (await embed([query]))[0];
    arms.dense = mems.map(m => ({ id: m.id, s: cosine(qv, m.embedding) }))
                     .sort((a, b) => b.s - a.s).slice(0, 20).map(x => x.id);
  } catch { /* endpoint down: sparse arm alone still answers */ }

  arms.sparse = new Bm25(mems).search(query, 20);

  if (fieldEnabled() && arms.dense) {
    const edges = field.buildEdges(mems, { k: 2, minSim: 0.55, bonus });
    arms.graph = field.neighborhood(edges, arms.dense.slice(0, 3), { hops: 1, max: 10 })
                      .map(e => e.id);
  }

  return rrfFuse(arms, { k: 60, limit: k });
}
```

Note the failure behaviour: **if embedding is down, hybrid still returns good results** from
the sparse arm rather than falling off a cliff. That is a robustness win independent of the
ranking-quality question.

---

## 5. The invariant question

The invariant exists for a good reason. `DEVELOPERS.md` records a **measured** finding:
adding a durability weight (importance/access_count) to cosine **inverted rankings** and made
results worse. The lesson learned was correct.

But note precisely what was measured: *durability signals* — importance and access count —
polluting relevance. That is a different claim from *"no second relevance signal may ever
inform rank."* BM25 is not a durability signal; it is an independent **relevance** signal,
measuring the same target quantity by another route.

So the invariant's real content is:

> **No unmeasured signal touches rank. Retention signals never touch rank.**

Both survive this proposal intact. The process:

1. Implement behind `RESONANCE_MEMORY_HYBRID`, **default off**.
2. A/B on the `RM-00` golden set: cosine-only vs RRF, reporting `recall@5`, `MRR`, and
   per-category deltas (the rare-noun/identifier/negation categories are where the win should
   appear, if it exists).
3. **If it wins:** flip the default, and in the *same PR* amend `DEVELOPERS.md` to
   *"Ranking = cosine, plus any relevance signal that has beaten cosine-only on the golden
   set. Retention signals (importance, access_count) never touch rank."* — with a link to the
   measurement.
4. **If it loses:** keep it flag-off for the endpoint-down robustness benefit, and write down
   the negative result. **A negative result here is a real deliverable** — it converts a
   folk-belief invariant into a measured one.

Under no circumstances does the default flip without the measurement. That is the part of the
invariant that actually matters.

---

## Risks

| Risk | Mitigation |
|---|---|
| BM25 index rebuild per query is O(N) | Cache and invalidate on write; deleted entirely by `RM-07`/FTS5 |
| Keyword arm surfaces literal-but-irrelevant matches | RRF requires cross-arm agreement to rank highly |
| Graph arm amplifies its own Hebbian feedback loop | Graph is a *fusion input*, not a multiplier; ledger stays provenance-discounted |
| Fusion masks a broken dense arm | Per-arm ranks recorded and surfaced via `RM-19` |
| `k=60` is cargo-culted | Sweep `k ∈ {10,30,60,100}` in the A/B; publish the curve |

## Acceptance

- RRF beats cosine-only on `recall@5` **and** `MRR` on the golden set, **or** it's dropped and
  documented.
- Wins specifically on the `rare_noun`, `identifier`, and `negation` eval categories.
- With the embedding endpoint killed, hybrid still returns non-empty, sane results.
- Per-arm rank contributions visible in the panel (`RM-19`).

---

## Related

[[phase-2-retrieval-dynamics]] · [[BACKLOG]] · [[ARCHITECTURE]] · [[ROADMAP]] · [[proposed/README]]
