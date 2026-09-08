# 0002 — Temporal metadata and supersession

**Status:** proposed · **Backlog:** `RM-04` (schema), `RM-03` (logic) · **Depends on:** `RM-00`

## Problem

> **Status:** the schema half (`RM-04`) **shipped** — `valid_from` / `valid_to` /
> `last_confirmed` / `superseded_by` / `supersedes` / `revision` are live in `record.js`,
> recall filters to currently-true memories, and `supersedePatches()` + `updateMany()` apply a
> supersession atomically. What is still missing is `RM-03`: the *detection* logic that decides
> **when** to call them. The problem statement below describes the situation before `RM-04`.

Before this work, the store had no concept of *when a fact was true* — only `created` /
`modified`. So:

- "I work at Acme" and "I work at Globex" both sit in the store, both match "where do I work",
  and recall returns whichever embeds closer to the query. **The answer is arbitrary.**
- Correcting a fact means the model must recall → find the id → call `edit_memory`, which
  small models reliably fail to do, and which **destroys the history** when they succeed.
- There is no way to ask "where did I *used* to work."

This is the capability gap vs Zep, and it is the one that causes **memory poisoning**: long-
running agents accumulate contradictions from corrections and evolving preferences, and
without supersession they get progressively more incoherent.

## Prior art worth copying

Graphiti (Zep) uses a **bi-temporal** model with four timestamps per fact:

| | Meaning |
|---|---|
| `t_valid` | when the fact became true **in the world** |
| `t_invalid` | when it stopped being true in the world |
| `t'_created` | when the **system** learned it |
| `t'_expired` | when the system marked it superseded |

On a temporally-overlapping contradiction, Graphiti **invalidates rather than deletes**: it
sets the old edge's `t_invalid` to the new edge's `t_valid`, producing a **non-overlapping
validity chain**. History is preserved without recomputation.

We copy the *semantics*, not the infrastructure. **This needs no graph database** — it's five
fields on a flat record.

## Schema (`RM-04`)

```js
{
  id, created, modified, text, embedding,        // unchanged
  importance, access_count, last_access, deleted, // unchanged

  valid_from:     "2026-07-28T10:00:00Z",  // world-time this became true (default: created)
  valid_to:       null,                     // null = still true. Set on supersession.
  last_confirmed: "2026-07-28T10:00:00Z",  // last time we saw evidence it still holds
  superseded_by:  null,                     // id of the fact that replaced it
  supersedes:     null,                     // id of the fact this replaced (back-pointer)
  revision:       1,                        // position in the chain
  needs_review:   false                     // ambiguous conflict - kept both, flagged
}
```

**Migration is free.** `JsonlStore._normalize()` already backfills missing fields on read;
add these there and every legacy row gains them with no migration script and no breaking
change:

```js
_normalize(r) {
  const created = r.created || r.ts || new Date().toISOString();
  return {
    /* ...existing... */
    valid_from:     r.valid_from     || created,
    valid_to:       r.valid_to       || null,
    last_confirmed: r.last_confirmed || r.modified || created,
    superseded_by:  r.superseded_by  || null,
    supersedes:     r.supersedes     || null,
    revision:       typeof r.revision === "number" ? r.revision : 1,
    needs_review:   !!r.needs_review,
  };
}
```

`current(r)` is then simply `!r.deleted && r.valid_to === null`.

---

## Detection (`RM-03`)

The hard question is not *how to record* supersession — it's *how to notice* it. A new memory
relates to an existing one in one of four ways:

```
                 cosine similarity to nearest existing memory
   low ───────────────────────────────────────────────────► high
   │                    │                  │                │
   NEW                  RELATED            CONTRADICTION?   DUPLICATE
   (just store)         (just store)       (adjudicate)     (touch, don't store)
                        < 0.88             0.88 – 0.95      > 0.95
```

The dangerous band is **0.88–0.95**: same subject, possibly different value. That is where
supersession lives, and where a wrong call does real damage.

### Tier 0 — deterministic signals (always on)

```js
const CORRECTION_MARKERS =
  /\b(actually|correction|no longer|not anymore|used to|changed to|now it'?s|instead of|scratch that)\b/i;

const NEGATION = /\b(not|never|no longer|doesn'?t|isn'?t|won'?t|stopped)\b/i;

// Subject overlap: do these two facts talk about the same thing?
function subjectOverlap(a, b) {
  const content = s => new Set(
    s.toLowerCase().match(/\b[a-z][a-z'-]{2,}\b/g)?.filter(w => !STOPWORDS.has(w)) || []
  );
  const A = content(a), B = content(b);
  if (!A.size || !B.size) return 0;
  let shared = 0; for (const w of A) if (B.has(w)) shared++;
  return shared / Math.min(A.size, B.size);        // asymmetric-safe
}

// A value changed while the subject stayed the same -> classic supersession.
function valueChanged(a, b) {
  const nums = s => (s.match(/\b\d+(?:\.\d+)?\b/g) || []).join(",");
  const dates = s => (s.match(/\b(19|20)\d{2}\b/g) || []).join(",");
  return (nums(a) !== nums(b)) || (dates(a) !== dates(b)) ||
         (NEGATION.test(a) !== NEGATION.test(b));
}

function contradictionScore(newText, oldText) {
  let score = 0;
  if (subjectOverlap(newText, oldText) > 0.5) score += 0.5;   // same topic
  if (valueChanged(newText, oldText))          score += 0.3;   // different value
  if (CORRECTION_MARKERS.test(newText))        score += 0.4;   // explicit correction
  return Math.min(score, 1);
}
```

### Tier 2 — optional local adjudication

Only for scores in the uncertain middle (`0.4 – 0.7`), reusing the `0001` endpoint:

```
Do these two statements about the same subject conflict, such that the
second REPLACES the first?

A (existing): {old}
B (new):      {new}

Answer ONLY: {"replaces": true|false, "confidence": 0.0-1.0}
```

### The decision

```js
async function reconcile(newText, newVec, store) {
  const candidates = store.current()
    .map(m => ({ m, sim: cosine(newVec, m.embedding) }))
    .filter(x => x.sim >= 0.88)
    .sort((a, b) => b.sim - a.sim);

  if (!candidates.length) return { action: "store" };

  const top = candidates[0];
  if (top.sim >= 0.95) return { action: "duplicate", id: top.m.id };   // RM-02

  const score = contradictionScore(newText, top.m.text);
  if (score >= 0.7)  return { action: "supersede", id: top.m.id, confidence: score };
  if (score >= 0.4 && adjudicationEnabled()) {
    const verdict = await adjudicate(top.m.text, newText);
    if (verdict.replaces && verdict.confidence >= 0.7)
      return { action: "supersede", id: top.m.id, confidence: verdict.confidence };
  }
  // Uncertain: keep BOTH, flag for review. Never guess destructively.
  return { action: "store", needs_review: score >= 0.4, related: top.m.id };
}
```

> **The asymmetry is deliberate and load-bearing.** A missed supersession leaves a stale fact
> that recall might rank second — annoying. A *false* supersession silently hides a true fact
> the user still relies on — corrosive, and invisible until it bites. So: high threshold,
> keep-both on doubt, and `needs_review` surfaced in the panel. `RM-03`'s acceptance criteria
> makes "zero wrongly-invalidated facts" a **hard gate**, not a soft metric.

### Applying it

```js
// Both rows must change together. Two separate store.update() calls would be two
// full-file rewrites, and a crash between them would leave a HALF-APPLIED
// supersession: the old fact closed while nothing points at its replacement.
// updateMany() applies both in a single atomic write. (record.js exposes
// supersedePatches() so the patch shapes stay in one place; store.js:updateMany
// lands them. Both are implemented and tested.)
function supersede(oldId, newId, store, at = new Date().toISOString()) {
  const p = supersedePatches(store.get(oldId), store.get(newId), at);
  store.updateMany({ [String(oldId)]: p.old, [String(newId)]: p.new });
  // Optional: record the supersession as a typed edge for the 3D graph (RM-09).
}
```

Note this is **not** a delete and **not** an `edit_memory`. Both rows survive; they form a
chain you can walk backwards.

---

## Retrieval semantics

```js
const HISTORICAL = /\b(used to|previously|before|back then|in the past|last (year|month)|formerly|old)\b/i;

function filterByTime(records, query) {
  if (HISTORICAL.test(query)) return records;              // history explicitly requested
  return records.filter(r => r.valid_to === null);         // default: current facts only
}
```

Default recall answers from **current** facts. Superseded ones become reachable only when the
query is explicitly historical. This directly targets `staleness_rate` — the metric neither
LOCOMO nor LongMemEval systematically tests, which is why it's a place we can lead.

Panel: superseded nodes render dimmed in the 3D graph, with the supersession chain drawn as a
distinct edge type. That makes "why does it think I work at Globex" a *visible* answer rather
than an argument.

---

## Worked example

```
t0  save "I work at Acme"
      → no candidates → store  {id:1, valid_from:t0, valid_to:null}

t1  save "I work at Acme as a senior engineer"
      → sim 0.96 → DUPLICATE → touch id 1 (last_confirmed=t1). Nothing appended.

t2  save "Actually I work at Globex now"
      → sim 0.91 (danger band)
      → subjectOverlap("work") 0.6  → +0.5
      → valueChanged (Acme≠Globex)  → +0.3
      → CORRECTION_MARKERS ("Actually", "now") → +0.4
      → score 1.0 ≥ 0.7 → SUPERSEDE
      → id 1: valid_to=t2, superseded_by=2
      → id 2: valid_from=t2, supersedes=1, revision=2

recall "where do I work"       → "Globex"          (id 1 filtered out)
recall "where did I used to work" → both, ordered   (HISTORICAL matched)
```

## Risks

| Risk | Mitigation |
|---|---|
| False supersession hides a true fact | High threshold, keep-both on doubt, `needs_review`, hard eval gate |
| Two facts coexist legitimately ("I work at Acme *and* freelance") | `valueChanged` alone never triggers; needs subject overlap **and** score ≥0.7 |
| Chain grows unbounded | `RM-08` prunes superseded rows older than N with no access |
| Clock skew / relative dates | `valid_from` defaults to ingestion time; relative-date parsing is explicitly out of scope for v1 |
| Store grows with every correction | Measured by `store_growth` in `RM-00`; superseded rows drop their embedding after N days (text kept) |

## Acceptance

- `staleness_rate` drops ≥70% on `eval/contradictions`.
- **Zero** wrongly-invalidated still-true facts (hard gate).
- `eval/temporal` historical queries return superseded facts correctly.
- Legacy stores load with no migration step.
- `RM-15` soak: staleness stays flat from update 100 → 1000.

---

## Related

[[phase-7-reconsolidation]] · [[BACKLOG]] · [[ARCHITECTURE]] · [[BUGS]] · [[proposed/README]]
