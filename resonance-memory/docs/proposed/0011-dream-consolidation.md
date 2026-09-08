# 0011 — Dream consolidation (the Grimoire, the dreamer, the soak)

**Status:** proposed (design **frozen** 2026-09-05; source of truth for the Phase 4 build; not an implementation) · **Backlog:** `RM-10`, `RM-15`; `RM-09` consumes the sim; `W-03` / `W-04` are prerequisites · **Depends on:** Phase 0, `RM-02`, `RM-07` as shipped · **Does not depend on:** Phase 1–3 for slices 4.0–4.1 / page index · **Gates:** Op C keep/cut = Phase 4 exit; `Related:` default-on = W-03 budget held OR persist-net-read (retrieve-then-filter) OR N-cap; crystal auto-appoint = Op C win **and** `RM-16`; idle 2pm schedule ≠ crystal auto-appoint

> **This is the frozen design**, not a licence to write dream-mutation code.
> Three Grok rounds (`task-20260905-130041`, `-214814`, `-221519`) plus ChatGPT
> convergence settled it; round 3's verdict was freeze. Measurement slices
> 4.0 / 4.0b / 4.0c are the only work that follows this RFC. No crystal, no
> Grimoire write, no `--dreamer` mutation until those numbers are in.
>
> Where this note and the shipping files disagree, **the files are the
> present** and this file is the future. Architecture §1, I8, and the
> `INVARIANTS.md` one-liner amend when the corresponding slice ships
> (`BUG-006` — docs change in the same commit as the behaviour).

Grounded in: `memory-core.js` (the one write path a crystal must enter),
`record.js` (`detectNearDuplicate` / `pickMergeSurvivor` / RM-04 timestamps),
`edges.js` (`effectiveHebbian`, two-signal record, `pruneSweep`), `field.js`
(`buildEdges` O(N²), minSim 0.55, constraint rescue), `entry.js` (CLI class
of `--export` / `--migrate` / `--dedup-existing`), [`0009`](0009-edge-threat-model.md)
(poison windows; **not repealed**), [`0003`](0003-hybrid-retrieval.md)
(the only door for recency-in-rank), [`phase-4`](../phases/phase-4-consolidation.md)
(the checklist this RFC is the mechanism for), `BUGS.md` W-03 / W-04.

---

## Non-goals (up front)

- **Not a fifth MCP verb.** The consuming agent never calls `dream_now`.
- **Not a daemon inside the MCP server.** Decay stays a function (I6, no `tick()`).
- **Not recency in primary rank.** That is a `0003` 2.2-class flag; non-goal for v1.
- **Not a Phase 7 global contradiction sweep** (RM-03 cue-less). Not Phase 3
  session→long-term promotion.
- **Not clustering on save-time semantic edges** (K=5 / cosine ≥ 0.25) **or**
  on WarmField / activation (I7).
- **Not loosening `DEDUP_LO` (0.88)** to "help" consolidation.
- **Not dream-mutation code in this RFC.** 4.0c / 4.0b / 4.0 measure; they
  do not appoint, merge, or write a Grimoire node.
- **Not an RM-16 write-path filter in the 4.0c slices.** Stamp the
  requirement here; build it at appointment.

The full non-goals list is restated in §9 so a reviewer gating this file
does not have to hunt.

---

## 1. Amendments, written honestly

These are load-bearing. Do not pretend the old text still holds. The
architecture / invariant files change when the slice that needs the
amendment ships, in the same commit.

### 1.1 §1 — decay stays a function; consolidation is work

Architecture §1 today: *"Time is a function, not a process. There is no
permanent heartbeat, no dream loop, no rhythm engine, no background decay
daemon… Autonomous cognition belongs in the consuming agent, never in the
memory layer."*

**Amendment:**

> **§1, decay vs work.** Time remains a function for *decay*: no heartbeat,
> no `tick()`, I6 holds. The MCP stdio server remains pure and event-driven
> — no dream loop inside `server.js`. **Consolidation is work, not time.**
> It runs in a separate **dreamer** process (`entry.js --dreamer`), the same
> class as `--export` / `--migrate` / `--dedup-existing`, except it may be
> scheduled. It is not a fifth MCP verb. Autonomous *cognition* still does
> not live in the memory layer: the dreamer nominates through the same write
> path, journals, and fails open. The consuming agent does not call
> `dream_now`.

"No daemon" narrows to: no daemon in the server, and no decay daemon. The
2pm clock is an OS scheduled task launching that process (§6), not a loop
inside MCP.

### 1.2 I8 — no silent / unjournaled removal; the dream never destroys a real memory

I8 today: no silent removal; record deletes are soft; edge prune is
mark-then-`vacuum()`.

**Amendment:**

> **I8.** No silent / unjournaled removal. A *real* memory is never destroyed
> by the dream. The only thing the dream may retire is a redundant copy
> (RM-02 exact / near-duplicate, no unique information), and only as a
> journaled, reversible supersession (`superseded_by` / `valid_to`), never a
> hard delete. User `delete_memory` stays a verb (still soft, still compacted
> at `vacuum()`). Edge `pruneSweep` stays mark-then-vacuum, explicit, not a
> memory delete. Grimoire nodes do **not** supersede their sources.

The bite this accepts: thematic restatements below `DEDUP_LO` (0.88) stay
current and crowd top-k over years. That is a feature of nothing-lost, not
a reason to loosen the band. Op C gists *surface* the pattern; they do not
delete the five honey-tea rows.

### 1.3 I2 — fade is discovery salience, not primary rank

"Fade while unused but still accessible" is I6 on the Hebbian edge
(`effectiveHebbian`), not a recency term on cosine.

A highly-relevant 2019 memory **still ranks top** on a direct query about
that topic. That is the point of a better-than-human memory. Recency in
primary rank is the trap I2 was written for (`importance` / `access_count`
inverted rankings).

**If** Samuel's mental model later wants "old stuff ranks a bit lower even
on a direct ask," that is a **`proposed/0003` 2.2-class flag**: flag-off,
A/B on RM-00 + the soak, promote only on a measured win that does not lose
needles. **Non-goal for v1.** Do not smuggle it.

`isHistoricalQuery` already expands the *candidate set* (current vs active).
That is not rank. The Grimoire walk (§4) is the same kind of thing.

### 1.4 The governing invariant (new)

Adopt verbatim as the one-liner (and later into `INVARIANTS.md` in the
stack repo, same commit as the field-split ships):

> **Learning is a property of the memory substrate. Presentation is a
> consumer of learned structure. No presentation-layer cost may disable
> or gate substrate learning.**

Today that coupling is literal: `reinforceRecall` sits **inside** the
`fieldEnabled()` block, **after** `buildEdges` (`memory-core.js`). Turning
the field off to escape W-03 also silences Hebbian. The split is the
uncoupling.

**This does not mean nothing may ever gate learning.** The one-liner is
about *presentation-layer cost*. Tighten it in the body:

| MAY still gate learning | MUST NOT gate learning |
|---|---|
| `RM-16` provenance (untrusted `source` must not `_bump` at full `alphaPP`) | `Related:` / `buildEdges` / panel-graph cost |
| I5 (accrual write must stay bounded — it is C(k,2), not N²) | Visualization, serialization |
| A user privacy kill-switch ("stop learning") | "Store is big, so stop accruing" as a proxy for W-03 |
| Tiny-store hairball: keep `mems.length > k`. If N ≤ k every recall co-fires the whole store | |

C(k,2) on `return_k ≈ 5` is ~10 pair bumps plus a bounded SQLite UPDATE.
That is not a reason to gate learning. If `return_k` is ever set to 100,
cap k; do not turn accrual off.

**"Field on" is never again one bit.** Three distinct consumers of the
learned signal:

| | Consumer | Default | Path |
|---|---|---|---|
| **(a)** | `hebbian_accrual` | **ON** | `reinforceRecall` on the primary top-k (and, if `Related:` ran, the existing discounted neighborhood). C(k,2). What the dream needs. What "repetition finds patterns" needs. |
| **(b)** | MCP `Related:` block | **gated** on the W-03 budget / N-cap / retrieve-then-filter decision (§7.1) | Neighborhood + constraint rescue. The actual interactive cost. I9: additive, never reorders primaries. |
| **(c)** | Panel 3D graph | already off the recall path | Visualization. Not this argument. |

ChatGPT's "visualization/recommendation machinery" conflates (b) and (c).
Only (a) and (b) are the field-split argument. (c) already does not run
inside `recall()`.

Samuel blessed this split. Accrual-on is decided. `Related:` default-on
is a **4.0c product conversation**, not a silent flip of
`RESONANCE_MEMORY_FIELD`.

---

## 2. The 0009 poison reconciliation

**Load-bearing. Get this exactly.** Splitting the coupled switch splits
the cap. [`0009`](0009-edge-threat-model.md) is **not repealed**; the cap
**moves** from the learning bit onto the consumers.

0009's "field off = poison cap" was a cap on a **coupled** switch
(accrual + `Related:` + `buildEdges` behind `fieldEnabled()`). Off-by-default
was a *temporary* blast-radius cap, not `RM-16`.

Three windows:

### WRITE window (the Hebbian table)

Learning-on **does** expand it. A parasite co-ranked in the primary top-k
accrues `alphaPP = 0.1` even while `Related:` is dark. No field help
required — primary↔primary is cosine. That is Samuel's deliberate call,
and it is **accepted**. Dark weight is written, durable, irreplaceable
(0009 §5: a poisoned reinforcement is a durable false memory).

### READ window (what the model sees)

Presentation stays gated, so I9 holds and `Related:` cannot widen. Dark
weight is an **inert time-bomb**, not a live nomination. Primary cosine
results stay byte-identical. The blast radius of a successful Hebbian
write remains "the table has a lie in it," not "the model was shown it."

### PROMOTION window (crystals / 2.2 fusion)

Still gated on `RM-16`. Accrual-on does **not** appoint. 0009 §6.1 / §7.4
already named this: switching a consumer onto the persist-net detonates
every parasite bound while discovery was dark. Crystal auto-appoint and
Phase 2.2 rank fusion are those consumers.

**Hold both as:** accrual always on; `RM-16` is the gate on every
**consumer that *uses* the learned signal** (`Related:` default-on at
scale, crystal auto-appoint, 2.2 rank). Op B may still nominate `tainted`
(provenance mix in the journal). The 0009 parasite + co-recall probe stays
a reporting probe, not a licence to delay Hebbian-on.

**Do not smuggle an `RM-16` write-path filter into the 4.0c measurement
slices.** Stamp the requirement here; build it at appointment. 4.0c
profiles cost. It does not become the provenance damper.

Carry-forward, restated so it cannot drift:

1. Untrusted `source` must reach `_bump` before any consumer that *uses*
   the learned signal becomes default-on (`0009` §7.1).
2. Switching `Related:` onto the persist-net is a consumer change: it is
   retrieve-then-filter (§7.1), not a dump of the 0.25 net, and it is
   still an `RM-16` question at default-on.
3. Crystal auto-appoint is a promotion-window consumer. Op C may write
   through `save()` under an explicit checkbox; auto-appoint waits on
   Op C's keep **and** `RM-16`.

---

## 3. Four operations

Keep the four. Do not smuggle RM-03 cue-less contradiction (Phase 7) or
Phase 3 session promotion into the first dream.

### Op A — redundancy (the only removal)

Store-wide RM-02.c cargo. Not a new mechanism.

`planDedupExisting` already walks current records in file order, treats
each as an incoming `save()` against earlier survivors, and uses the
**same** `detectNearDuplicate` + `pickMergeSurvivor` + `mergeBandPatches`.
Reuse the bands. Do not fork them. `memory-core.js` stays the single
decision.

The remaining gap after 02.b is real but narrow:

1. Pairs that were vectorless at save (embedder down → skip compare,
   append) and later both grew embeddings — never compared to each other.
2. An `edit()` that slides two previously-distinct records into the merge
   band.
3. Threshold changes after the fact.
4. `--dedup-existing` is a one-shot backfill CLI, not a monthly ritual.

Losers get `superseded_by` / `valid_to`, never a hard delete. Journaled,
reversible. This is the **only** removal the dream is allowed. Incremental
since `last_dream_at` (new / re-embedded / newly-vectored rows); full
pairwise is first session / `--dreamer --full`.

It does **not** catch thematic cousins. Cosine ≥ 0.88 is restatement /
merge of the *same fact*. Calling this 4.1 would be a category error. It
is the vehicle's first cargo, not the Phase 4 science.

### Op B — nominate Hebbian clusters (no memory writes)

Walk the **learned** graph. Nominate into the journal. Write **no
memories**. I9-pure: nominate, do not appoint.

**Learned edges only.** Not save-time 0.25 semantic neighbors
(`hebbian.weight === 0`, origin `"save-time-neighbor"`). Not WarmField /
activation (I7 — ephemeral, must not persist into clusters). Clustering
the persist-net is RM-02 at a reckless threshold; that is the named
failure if H2 starves.

Evidence gate — all must hold before a high-confidence nomination:

1. **Learned, not semantic.** Member edges have `effectiveHebbian(now) > 0`.
2. **More than one bump.** `hebbian.n ≥ 3` primary↔primary (or weight that
   one bump cannot explain after the span). `alphaPP = 0.1`; one co-recall
   is not a theme.
3. **Span.** `now - first_reinforced_at` ≥ 48h (named constant; tuned on
   the soak, not on vibes). Last night's clique waits.
4. **Size.** 3–8 current members. A pair is an edge, not a theme. >8 is a
   hub or a life-area too big to gist ("work"). Split or refuse.
5. **Hub filter.** A node in the top degree percentile of the reinforced
   graph cannot be the *reason* two others cluster; it can be a member
   only if the others meet 1–4 **without** it. This is 4.4's "mere
   repeated querying" in Op B, where it belongs. Do not use `access_count`
   (I2b).
6. **Cohesion with an escape hatch.** Mean intra-cluster cosine high
   enough to be one topic, **and** no near-miss sitting inside the
   component. If a near-miss is in the component, drop it; if that breaks
   size, refuse the cluster.
7. **Provenance mix.** If any member `source !== "user_stated"`, nominate
   with `confidence: tainted` and **never** auto-appoint. Journal it.

The shipping `hebbian` record is `{ weight, last_updated }`. Weight after
decay cannot tell "once last night" from "weekly for a month." **4.1
requires a `normalizeEdge` backfill:** `hebbian.n` (bump count) and
`hebbian.first_reinforced_at`. Allowed by the schema rule; not a Phase
1–3 dependency; is a 4.1 prerequisite. Do not try to prove recurrence on
`{weight, last_updated}` alone.

Confidence (journal / UI, **not rank** — I2): a monotone combination of
(n, span, intra-sim, inverse hub-degree). The LLM does not vote on
whether a cluster is real. Heuristics decide *whether*; optional local
model decides *wording* of a later gist.

### Op C — crystal / gist through `save()`

One gist per accepted cluster, through **`save()` in `memory-core.js`** —
no private `store.append`. Linked to sources, confidence on the record,
LLM-heavy, **opt-in, off by default**, local, fixture-in-CI. Fail-open to
"skip this cluster." 4.4 (duplicate crystals, don't crystallize on
repeated querying, bound graph growth) is a **gate on C**, not a sibling
of A.

**The I9 trap:** `save()` will RM-02 the gist against its sources. A gist
of five ramen facts will often land in the 0.88–0.95 band against the
longest source, or even ≥ 0.95. Then `pickMergeSurvivor` keeps the longer
text — either the gist eats the specific, or the specific eats the gist.
Both are wrong. A private door (skip `save()`, skip PII, skip extract) is
also wrong.

**Typed exception, still one `save()`:**

- Tag crystals (`kind: "crystal"` or `source: "model_inferred"` +
  `crystal_of: [ids]` — `source` already exists).
- In `detectNearDuplicate`, **skip crystal↔source pairs** (and
  crystal↔crystal of overlapping sources). Still compare crystal↔unrelated,
  so a second dream does not mint a duplicate gist of the same cluster
  (4.4). Still run PII / extract / embed. Still one `save()`
  implementation, with a typed exception the way vectorless rows are a
  typed exception.
- Sources stay `isCurrent()`. The crystal does **not** `supersede` them.
  A gist that invalidates its evidence is an I8 violation even if the
  bytes exist behind `valid_to`.
- Grimoire nodes use the same skip against *their* sources (§4).

Crystals **are** in the default cosine pool (I2: no unmeasured down-rank).
Needle queries must still prefer the source because the source shares more
tokens / geometry with a specific question. If they don't, that is an
**Op C cut**, not a licence to add a durability-style penalty. A later
"crystals sort below sources on needle-shaped queries" would be a 2.2-class
flag. Do not smuggle it.

Offline Op C in CI uses a **deterministic gist fixture** (cluster member
texts + a committed `gist` string, inserted through `save()`). That
measures crowding, needle retention, write-path interaction — the
substrate risk — without measuring "was the prose good." A live
`--crystal-llm` A/B (like `--extract` for RM-01.c) is reporting, not the
gate. If the fixture-crystal arm already loses `needle_retention`, **cut**
— the failure is the write, not the prompt.

### Op D — the Grimoire (temporal index)

After each successful dream of a grain, write (or refresh) the index node
for that grain: a page for the day, and when the week / month / year
closes, the parent. Non-destructive. This is how "Thursday January 2026"
walks. Fully specified in §4.

---

## 4. The Grimoire

**The Grimoire — Resonance Memory's temporal index of lived memory.** The whole
structure is *the Grimoire* (Grim → grimoire: a compiled body of accumulated
knowledge, organized for retrieval and use — which is exactly what the temporal
index is). Do not reuse "Grimoire" for a level.

> The Grimoire contains **Tomes**. Tomes contain **Volumes**. Volumes contain
> **Chapters**. Chapters contain **Pages**.

"Book" survives only as ordinary-language description, never as an architectural
term.

### Naming

| Grain | Calendar | Name | Why |
|---|---|---|---|
| day | local calendar date | **page** | Samuel's word |
| week | ISO week in the user's TZ | **chapter** | Samuel's word |
| month | calendar month in that TZ | **volume** | A bound gathering of chapters. Open question §9 (a) if Samuel prefers "part" |
| year | calendar year in that TZ | **tome** | A year of a life is a tome of the Grimoire. Not "Grimoire" (that's the whole spine). Not "yearbook" |

### Two spines — do not conflate them

RM-04 is **valid time** ("when it was true"): `valid_from` / `valid_to`.
"Where did I live in 2019" already has this.

The Grimoire is **transaction time** ("when we talked / when it was saved"):
`created` (and for a crystal, the dream's `valid_from`). "What did I talk
to you about on Thursday January 2026" is a Grimoire walk.

"I went to Kyoto in 2019," saved on 2026-01-08, lives on the
**2026-01-08 page**, not in a 2019 tome. The 2019 fact remains findable
by cosine and by valid-time historical queries. Mixing the spines is how
we hide a memory in the wrong year.

`HISTORICAL_RE` today does not match "on Thursday" / "in January 2026".
A second lexical detector, `isTemporalNavigationQuery`, same family as
`isHistoricalQuery` (server-assigned, not model-assigned). Overlap is
real: "what did I used to do on Thursdays" is valid-time habitual, not a
page walk. Cue-gate it the way RM-03 cue-gates supersession —
date / weekday / "on or around" / "that week" without a "used to" → Grimoire;
"used to" → `active()` validity chain.

### Calendar is civil, not rolling counts

Do not use rolling 7-day windows or "4 weeks = a month."

- **Pages** key by `YYYY-MM-DD` in **user local TZ** (the same TZ as the
  2pm timer — `created` is UTC; the page is `local-date(created)`).
- **Chapters** key by ISO week (`YYYY-Www`). A week that straddles
  December / January belongs to the **ISO week-year**, which is the year
  that contains that week's **Thursday** (ISO-8601). Document this; it
  is the one rule; it is boring; it is searchable.
- **Volumes** are calendar months, not "4 weeks": a month has 4 or 5 ISO
  weeks. A chapter is listed in the **volume that contains its Thursday**.
- **Tomes** are calendar years in that TZ.

### Record shape

Pages / chapters / volumes / tomes **are records**, through `save()`, not
a sidecar graph. They export. They have ids. They are not a fifth verb.

```text
kind:            "page" | "chapter" | "volume" | "tome"
source:          "model_inferred"          // RM-16: never user_stated
temporal_key:    { grain, start, end, tz } // civil range in user TZ
indexes:         [id…]                     // pages: memory ids
                                           // chapter: page ids; volume: chapter ids; tome: volume ids
crystal_of:      [id…]                     // members this gist is about (memories, not only children)
patterns:        [{ member_ids, confidence, evidence, journal_id }]
confidence:      number                    // journal/UI, NOT rank (I2)
```

`normalize()` backfills `kind: "memory"` for every existing row.
`isCurrent()` stays true for sources. Grimoire nodes do **not** set `valid_to`
on what they index.

Same-grain + same-`temporal_key` is a restatement: confirm, refresh gist,
do not append. PII / extract / embed still run. One `save()`. The
crystal↔source skip covers Grimoire-node↔its-sources.

### Candidate-set exclusion

**Grimoire nodes are out of the default `current()` cosine pool**, the same
way superseded rows are excluded from default and included when history
is asked. A daily gist in the ordinary pool will crowd "what's my tea
order" because Thursday's page mentioned tea. That is Op C's needle
failure, every day, for free.

Temporal-nav queries include the matching grain (and may walk it). Direct
"what is on page 2026-01-08" by asking about that day is the point.
Ordinary queries should not see the index.

This is a **candidate-set** change, already the historical-query pattern,
not an I2 rank amendment. Putting pages in the default pool is a measured
A/B, not the v1 default. Open question §9 (b).

Crystals (Op C) stay *in* the default pool. Grimoire nodes are the temporal
spine; crystals are theme gists. Different crowding, different gate.

### Traversal

Query: "What did I talk to you about on or around Thursday January 2026"

1. Lexical: temporal-nav, not merely historical.
2. Resolve civil date(s) in user TZ. **"On or around" → that page ±1
   civil day** (named window, frozen here).
3. Lookup `kind=page` with `temporal_key.start` in that window. If the
   page exists, its `indexes` are the candidate set; cosine-rank **those
   memories** (I2 still cosine). Append the page gist as a labelled
   **additive header**, never as a ranked peer — Related:-style additive
   text, **never reordering primaries**.
4. Miss: walk up. Chapter for that ISO week → its pages → union of
   indexes. Then cosine. This is how a forgotten Tuesday still falls out
   of "that week."
5. **No Grimoire node yet (dream hasn't run): fail open to ordinary cosine
   over `created` in that window** (filter current memories by
   local-date). The Grimoire is an accelerator, not a gate. A user who never
   dreams still answers "Thursday" by timestamp.

**Temporal recall must not depend on the dreamer.** The timestamp is
already truth; the dreamer enriches. Ship the `created`-window fallback
**with the detector**, even if gists are off.

### Rollup evidence

Round-1 evidence gates still apply, **but not at page grain.** A page is
too short for recurrence. The 48h span gate plus `hebbian.n ≥ 3` will
almost never fire inside a single day. "Finding patterns" on a page
invents them.

| Grain | What it is allowed to claim |
|---|---|
| **page** | Index of that day's saves + an **extractive** gist ("what we talked about"). **No theme claim.** No cluster. `patterns` empty in v1. |
| **chapter** | Recurrence across the week's pages. Hebbian clusters among the week's memories that pass the evidence gate (learned, n≥3, span, size 3–8, hub filter, provenance). A pattern must involve memories from **≥2 pages** or it is a same-day clump, not a week's theme. |
| **volume** | A pattern that appears in **≥2 chapters** of that month. Roll *cluster ids / member sets*, not the LLM's vibes. If chapter A and chapter B share a labeled cluster (**Hungarian IoU ≥ 0.5**, same as Op B metric), the volume may name it. One-week wonder stays in its chapter. |
| **tome** | Appears in **≥2 volumes**. Standing themes of the year. |

Same near-miss escape hatch at every grain: if a near-miss is in the
component, drop it; if that breaks size, refuse the pattern, keep the
index.

The LLM still does not vote on whether a pattern is real.

---

## 5. Fade = existing I6

Map fade onto `effectiveHebbian`. The law is already
`w_eff = w · 2^(−Δt / H)` with **H_fact = 7 days**, **H_constraint = 30
days**, computed on read, never stored (I6). Unused associations fall
below the discovery bonus and drop out of `Related:`. Direct cosine is
untouched.

A single unused α=0.1 bump is ~1% after ~7 weeks and numerically gone
well before a year. The felt "it stopped coming up" is already in the
substrate. We do not need a second fade clock. Dual-clock was a named bug.

**No epoch-modulated H in v1.** That is an unmeasured I6 amendment. Three
ideas that got glued together, only one of which is already true:

1. *Older unused material fades more* — **already true.** Larger Δt,
   smaller `w_eff`. No new math.
2. *A page-edge decays slower than a raw memory-edge; a chapter slower
   still* — **structural vs learned.** Index links (page→day's memories,
   chapter→pages) are the temporal spine. If they decay, "Thursday
   January 2026" goes blind while the memories still exist.
3. *Higher epochs fade more aggressively* as a *steeper H for old grains*
   — **unmeasured.** Do not shorten H because a memory is "in last year's
   tome." An old fact that still co-activates should keep its association.
   Wall-clock from `last_updated` already handles neglect.

If after the soak we see `Related:` still dumping January in March,
*then* we tune H via `RM-09` **on the eval**, not by grain.

**Grimoire-index edges are STRUCTURAL:** `provenance.origin = "grimoire-index"`,
Hebbian weight 0, **not unreinforced-prune-eligible**. Same two-signal
instinct as save-time neighbors: structure does not fade; learned
co-activation does. The temporal spine never goes blind because a
maintenance sweep thought an unreinforced index edge was garbage.

---

## 6. Dreamer safety

### Process and clock

Separate `entry.js --dreamer`. Same class as `--export` / `--migrate` /
`--dedup-existing`, except schedulable.

**The panel cannot host the 2pm timer.** It heartbeat-auto-shuts down.
"Built into the main app" only works while a tab is open. Samuel wants
2pm when he is away. That is an **OS scheduled task** (Task Scheduler /
launchd / systemd `--user`) launching the dreamer, registered at install
**after an install / panel consent** (not a silent task the user
discovers when fans spin). Time editable in the panel. Off means "never
auto"; `--dreamer --once` still exists.

The panel is the **consent UI + journal viewer + schedule config**, not
the clock.

Default time: **2pm local**. First-run schedule is default-on **after
consent**, not before.

**User-facing disclosure (ship-gate, Samuel 2026-09-05).** When the dreamer
slice ships, its README section and an in-app note must, *in the same commit*
(`BUG-006`), state plainly: that consolidation is **on by default**, **what it
does** (nightly Grimoire pages / dedup, using the local machine), that a
**toggle turns it on and off**, and that the **schedule time is adjustable**.
Do **not** add this note before the dreamer exists — a "it's on and does X"
claim written ahead of the behaviour is the stale-claim trap this RFC's
"the files are the present" rule forbids. The note lands *with* the feature,
never before it.

### W-04 becomes blocking

Two writer processes. Last-writer-wins on JSONL is unacceptable; SQLite
WAL is not enough by itself (two writers). Phase 0.3's MCP request-ID
dedup is **orthogonal**: it makes one JSON-RPC retry one mutation *inside
a single process*; it does not serialize two writers (`BUGS.md` W-04).

**One writer lock.** Dreamer takes it per-page / per-Op-A-txn. MCP
`save` / `edit` / `remove` sets a busy flag → dreamer checkpoints at the
next yield, **releases the lock, pauses, resumes after idle**.

**`recall` is not blocked behind a dream.** Recall is a bounded UPDATE of
~5 ids (I5). If the lock is held, recall proceeds; dreamer cannot start
a write until recall's txn ends. Busy-timeout + retry, not a queue inside
the stdio server.

### GPU lock

Pause-on-interaction pauses the **LLM steps too**. Op C uses the local
`:8080` model; do not fight the chat for the 5070 Ti. Detect MCP activity
(or panel Connect) → pause LLM steps immediately. Copy: "If you talk to
the assistant during a dream, this page may not finish. We'll pick it up
at the next cycle."

### Journal, txn, fail-open, yield

| Risk | Rule |
|---|---|
| Corruption | Every step is a journal row **before** mutate. SQLite: one txn per page (or per Op A apply). Rollback on cancel / crash. JSONL pin: do not dual-write; dreamer on jsonl is best-effort / refuse Op C, or journal + `updateMany` as today. Fail-open: journal `failed`, store unchanged. |
| Interrupt | Cooperative yield (`setImmediate` / per-page). Cancel loses **at most the current page**, not the week. Resumable: skip grains whose journal says `committed` for this civil key. Restartable from scratch for uncommitted grains (plan is pure). |
| Cost | Incremental Op A (since `last_dream_at`). Op B is O(E). Op D page gist: one optional LLM call, `max_crystals_per_session` still binds (start at 5). Pre-declare p95 at N=1k / 10k / 50k. Honest copy: **not** "minimal CPU." |
| I1 | Not a tool. A small model that can `dream_now` will. |
| I3 | Dream throw cannot break the next recall. |
| I5 | Dream is a write path; unbounded *here* is the point. Never from `recall`. |
| I9 | Dream does not reorder primaries. |

Journal lives in the `.db` (new tables), is included in `--export`, omits
`processed_ids`-class internals.

Reversibility, cheaply, no fifth verb (panel button, like export):

- Merge / restate undo = clear `superseded_by` / `valid_to` on the loser.
- Crystal undo = soft-delete the crystal.
- Cluster nomination undo = delete a journal row (no memory mutation).

**Consent grain:** session-level consent for housekeeping + nominate +
page index. Crystal *writing* is a checkbox on that same consent screen
("also write gists — uses the local model, slower"), off by default, same
pattern as Tier 2 extraction. Auto-appointing crystals through `save()`
is a later measured promotion, not the first ship.

**The killed-page warning copy is the fallback. Pause / resume is the
default** — a user who opens a chat at 2:05 should not have to understand
journals. The copy is for crash / kill, not for clicking Connect.

Copy for the panel must not say "minimal CPU" as a blanket. Say: "Finds
duplicates and repeating themes. Usually seconds. Gist-writing is optional
and uses your local model." Over-claiming is how this feature gets killed
by the first 20k-memory user.

---

## 7. Measurement slices

**The only things built after 0011. Still no dream mutation code.**

Order inside this section is 4.0c then 4.0b because that is the
dependency the numbers have on each other; the *build* order is §8
(4.0 control generator first).

### 7.1 4.0c — W-03 decomposition profile

On **current SqliteStore**, N = **200 / 500 / 1k / 2k / 5k / 10k**,
field-on, in the **eval harness, not product `recall()`**. A single
field-on p95 repeats S1. We already *attribute* 90.8 s to `buildEdges`;
we have not *profiled* it on current SqliteStore.

Six stages:

| Stage | What it is today |
|---|---|
| 1 embed | query vector (**eval embed-cache makes this look free — say so; live is a different number**) |
| 2 semantic rank | cosine over `current()`, plus `applyRecall` of ~5 ids |
| 3 accrual | `reinforceRecall` + `save()` — C(k,2), expect tiny |
| 4 assoc retrieval | **does not exist yet** — fused into 5 |
| 5 `Related:` construction | `buildEdges` (O(N²)) + `neighborhood` + `reachableConstraints` (time rescue separately; it is a different pass) |
| 6 serialize | format the string |

**Field-off = stages 1–2–6.** That is the control.

Freeze an interactive p95 budget (start **≤ 150 ms at "thousands"**). If
1k is still ~724 ms, `Related:` default-on is a hang for anyone past a
few hundred saves. Golden staying 27/31 is already true and does not
protect the user (I9 primaries are byte-identical; the user still waits
90 s at 10k).

**The `Related:` fix to freeze (not build yet):**

> **Retrieve incident edges from the table, THEN apply the 0.55 / mutual /
> rescue filters.** Do not rediscover the graph from all-pairs cosine. Do
> not dump 0.25.

This is **not** a behavior-preserving swap. Phase 0 Risk #2 is still in
`memory-core.js`: persist-net is K=5 / cosine ≥ 0.25; `Related:` is mutual
kNN / minSim 0.55 + constraint rescue. Dumping the table into `Related:`
would flood. **Unifying the thresholds is the named failure.**

Cost profile tells us *where* the 90 s is. Golden + I9 +
`adv-height-homonym` still gate the *switch*. **4.0c does not become that
switch.** It decides whether `Related:` default-on is:

- a product conversation (budget held on current `buildEdges`),
- an N-cap (cosine + accrual still run; `Related:` degrades with one
  honest panel line above the cap),
- or "do the retrieve-then-filter slice first."

Do not smuggle `RM-16` into this slice. Do not flip
`RESONANCE_MEMORY_FIELD` here.

Also report, as probes not gates: fresh-user TBR at N=8–15 (Related:
dump on a tiny store once `mems.length > k`); haystack crowding
(Related: length at N=200 vs 1k vs golden's small stores); the 0009
parasite-save + co-recall probe (primary top-k must not flip pre-2.2).

### 7.2 4.0b — Hermes fire-together sim

Hermes (local Qwen `:8080`, batched `/new` **per fact** — **do not rely
on auto-compact** to hold the spec across a long session) **generates +
caches** phrasings, then is **out of the loop**. Deterministic measurement
over the cache (`EVAL_REFRESH` embed-cache, committed). Same identity as
RM-00: offline + deterministic. Hermes is the corpus generator, not a
live scorer.

**Planted layout is theme-structured.** 15 singletons measure the **wrong
thing** (retrieval robustness: does a paraphrase still *hit* its fact).
Co-activation needs more than one memory in the same top-k.

- 5 themes × 3 members = **15 on-theme facts**
- **5 near-misses** (one per theme)
- **5 unrelated distractors**
- ~20 phrasings per member + theme-level queries ("what do I drink in
  the morning") **≈ 500 at the start**
- Scale to 10k by **more themes × phrasings + haystack**, not by making
  Hermes a runtime

**Headline hypothesis:** do natural paraphrases co-activate **often
enough** for the graph to be useful? If no, Op B is starved and we need
an explicit co-occurrence / context signal — that is a **Phase 4 cut on
clustering, not a licence to cluster save-time 0.25 edges.**

**Record** (per cached phrasing, through `memory-core.js`):

- fact identity
- phrasing
- semantic top-k
- activated ids
- co-activation pairs
- edge delta per recall (before / after on involved pairs)
- **false co-activation** = labeled near-miss pair in primary top-k together
- **cross-fact leakage** = off-diagonal mass on pairs with **no** theme
  and **no** near-miss label (hairball, not the designed trap)

False co-activation and leakage are named metrics derived from the
theme-block co-activation matrix, not extra log columns.

**Pre-declared bands** (frozen **before** running; derived from n≥3 /
48h plus a plausible ~12 theme-talks per week, **not from data**):

| | Metric | Pass | Starve / cut |
|---|---|---|---|
| **H1 retrieval** | paraphrase puts its fact in top-5 | ≥ 0.80 | < 0.50 is embeddings-don't-survive-language |
| **H2 cofire (headline)** | mean pairwise `cofire_rate` on true theme pairs | ≥ 0.25, **and** ≥3/5 themes have a pair ≥ 0.30 | < 0.10 mean → Op B unreachable on natural language |
| **H3 near-miss cofire** | mean cofire of labeled near-miss pairs | mean ≤ 0.10 **and** no near-miss pair ≥ 0.25 | a near-miss clearing the true-pair bar is a false cluster |
| **H4 leakage** | mean cofire of unrelated (no-theme, no-near-miss) pairs | ≤ 0.05 | unrelated pairs in the true-pair band is a hairball |
| **H5 edge delta** | after a scripted week, true pairs vs unrelated on the 0009 "bonus ≥ 0.05 / two P↔P" band | true pairs reach that band more than unrelated | unrelated staying in-band is poison-shaped learning |

0.50–0.80 retrieval or 0.10–0.25 cofire is "usable but hungry" — report,
don't retune into the floor.

**The sim REPORTS, never auto-writes constants.** `RM-09` finally has its
instrument; humans change `minSim` / `SAVE_TIME_MIN_COS` / `alphaPP` /
`CONSTRAINT_GATE` only with a named measurement, same as RM-02.b's tea
0.9522.

### 7.3 4.0 — RM-15 control generator + metrics (no dream code)

RM-15's original job is: does the store stay coherent after 1,000 updates
**even if we never dream**. The curve is the deliverable. That harness is
worth building **even if Phase 4 is cut**. If RM-15's acceptance is
"consolidation worked," the cut-if-unproven rule becomes circular.

So: **RM-15 = script engine + persona soak (control).** Phase 4.5 = a
scenario pack and treatment arm on that engine.

Corpus: a generator (S1 shape — committed seed, not a 1,000-line handwrite),
offline via embed cache. Timed event log, labeled at generation:

| Event | Purpose |
|---|---|
| `assert` | slot-backed fact |
| `restate` | planted near-dup (hi / mid bands) that save-time should catch |
| `missed_dup` | vectorless-then-backfilled pair — the Op A needle |
| `correct` | RM-03 cue — RM-15 staleness |
| `episodic` | dated event with a unique proper noun — the I8 needle |
| `theme_assert` | one more instance of a labeled cluster |
| `near_miss` | DISTINCT-but-similar (peanut allergy vs peanut butter) |
| `recall` | query that will co-rank a labeled pair (builds Hebbian) |
| `accidental_recall` | two unrelated facts co-enter top-5 **once** |
| `hub_query` | same popular fact recalled 30 times with random companions — 4.4 trap |
| `time_skip` | advance the clock so decay and span gates are real |
| `dream` | treatment only; control skips |

Checkpoints at 100 / 250 / 500 / 1000. Dream runs at 250 / 500 / 1000 in
the treatment arm (not every event — that would be a daemon in the eval).
Control and treatment both run field-on for *accrual*, otherwise we are
measuring "field on vs off," which RM-00 already does.

Arms (runner flags, same shape as `--extract`): `control` / `redundancy`
(Op A) / `nominate` (Op B journal only, store bytes identical) /
`crystal` (fixture gist through `save()`) / `grimoire-walk`.

Register in `eval/metrics.js`, do not fork a scorer. Reuse
`duplicate_rate`, `recall_at_k` / `mrr` **split by query kind**. New names:

| Metric | Used by |
|---|---|
| `gist_recall@k` | Op C (relevant = crystal **or** any current source; also report `crystal_hit_rate`) |
| `needle_retention@k` | Op C, I8-as-retrieval (relevant = the **source id**, not a gist that contains the token) |
| `false_merge_rate` | Op A, Op C (`must_not_merge` pairs sharing a survivor) |
| `false_generalization_rate` | Op C (needle top-k contains a crystal **and not** the source, **or** a near-miss pair in the same crystal) |
| `cluster_precision` / `cluster_recall` | Op B (Hungarian match, IoU ≥ 0.5) |
| `staleness_rate` | RM-15 (must not get worse) |
| `storage_ratio` | all (superlinear = fail; crystals may raise N slightly) |
| `provenance_integrity` | Op C (every crystal has sources covering the cluster; every source still `isCurrent()`) |
| `hub_contamination` | Op B / 4.4 |
| `grimoire_hit_rate` | Op D (temporal-nav queries) |
| `grimoire_crowding` | Op D (page gist in default top-k — **must be 0**) |
| `cofire_rate` / `near_miss_cofire` | 4.0b sim |

**Do not AND `duplicate_rate` down with gist-recall up as one Phase 4
keep.** On a post-02.b store, `duplicate_rate` is already ~0. Split per
slice. `duplicate_rate` is Op A's number.

**Op C keep / cut (the phase exit), absolute, not "up vs control"
(control false-gen is 0 by construction):**

- Success: `gist_recall@k` strictly up vs control (Δ frozen after seeing
  control baseline, **before** treatment). `needle_retention@k` held
  (planted unique-token needles = 1.0 on the small planted set).
  `false_generalization_rate` ≤ cap (v1: **0 on the planted set**).
  `storage_ratio` ≤ control × 1.05 or clearly sublinear. `staleness_rate`
  not worse. `provenance_integrity` = 1.
- Cut: false-gen above cap; any planted needle lost; storage superlinear;
  gist-recall not up; **or** gist-recall up *only because* the crystal ate
  the top slot and needles died.

Op B: `cluster_precision` floor starts at 0.8 (argue after one dry run of
the generator, then freeze); `cluster_recall` ≥ 0.5; `hub_contamination`
= 0; any accidental-pair nominated or any near-miss pair in the same
cluster is failure; store bytes identical to control.

Op A: `duplicate_rate` down on missed-dups; `recall@5` held;
`false_merge_rate` on near-miss / control = **0**.

The Hermes phrasing cache is the realistic-phrasing layer **on top of**
RM-15's `recall` events, and the `RM-09` tuning instrument. Do not
collapse them. A 10k-run of unlabeled random calls cannot give
`false_generalization_rate`.

---

## 8. Slice plan

Build order. One mechanism per slice. Gate both `node test.js` and
`node eval/run.js` on every slice that can touch recall / save. Docs in
the same commit (`BUG-006`).

| Slice | What | Dream mutation? |
|---|---|---|
| **4.0** | RM-15 control generator + metrics | no |
| **4.0b** | Hermes fire-together sim (theme-structured, ~500 phrasings, H1–H5) | no |
| **4.0c** | W-03 decomposition + field-split / N-cap / retrieve-then-filter **decision** | no |
| **4.0 vehicle** | journal + `--dreamer` + lock + Op A cargo | yes (Op A only) |
| **4.1** | Op B nominate-only | journal only |
| **4.1b** | Op D pages (index + gist; **created-window fallback ships with the detector even if gists are off**) | page index |
| **4.2 / 4.3** | Op C checkbox crystals | yes, checkbox-off |
| **4.4** | crystal-dup / hub | gate on C |

The 2pm schedule **may run A + B + D-page before C is allowed to
appoint.**

Gates, restated:

- **Op C keep / cut = Phase 4 exit.** No measurable gain on C → cut the
  phase, keep A as RM-02.d (periodic `--dedup-existing` from the panel)
  if A won on missed-dups, keep D-page if the grimoire-walk won. That is a
  shipped negative. Open question §9 (d) on the exact keep-the-dreamer
  policy.
- **`Related:` default-on = W-03 budget held OR persist-net-read
  (retrieve-then-filter) OR N-cap.** 4.0c decides which. Not a silent
  flip of `RESONANCE_MEMORY_FIELD`.
- **Crystal auto-appoint = Op C win AND `RM-16`.** Checkbox crystals may
  ship earlier.
- **Idle 2pm schedule ≠ crystal auto-appoint.** The schedule can exist
  as soon as the vehicle is real, running only what has been allowed.

Does not depend on Phase 1–3 for 4.0–4.1 / page index. Hub defense and
`RM-16` **are** blockers for *appointing* crystals. Activation (Phase 1)
must not be persisted into clusters (I7). Amend the phase-4 header from
"Depends on: Phase 2/3" when that doc is next edited (`BUG-006`).

---

## 9. Invariants checklist, non-goals, open questions

### Invariants

| | How 0011 holds it |
|---|---|
| **I1** | Dream is not a tool. Idle offer / consent is panel. `--dreamer` is CLI, same class as `--export`. A small model that can `dream_now` will. |
| **I2** | Fade is discovery salience, not primary rank. Recency-in-rank is a `0003` 2.2-class flag, non-goal for v1. Crystals in the cosine pool *are* a legal rank change (new vector); needle eval is the gate. No unmeasured down-rank of crystals. Confidence is not rank. |
| **I2b** | Do not use `access_count` as cluster evidence. Hubs from query frequency need graph degree / distinct-query evidence, not the telemetry column. |
| **I3** | Dream failure fails open: journal `failed`, store unchanged or rolled back. Never break recall. |
| **I4** | Server owns `kind` / `temporal_key` / `crystal_of` / confidence. The model does not pass `importance`. Cue-detectors (`isTemporalNavigationQuery`) are lexical, server-assigned. |
| **I5** | Dream is a write path, so unbounded *here* is the point — but not on recall, and not a full JSONL rewrite. Incremental patches / one txn per page. Accrual stays C(k,2). Recall's ~5-id UPDATE is not blocked behind a dream. |
| **I6** | No `tick()`. Cluster evidence uses `effectiveHebbian(now)`. A dream is not a recall for decay. No epoch-modulated H in v1. |
| **I7** | WarmField / activation never persisted into clusters. Op B walks learned Hebbian edges only. |
| **I8** | As amended §1.2: no silent / unjournaled removal; dream never destroys a real memory; only journaled reversible duplicate retirement. Grimoire nodes do not supersede sources. User `delete_memory` unchanged. `pruneSweep` unchanged. |
| **I9 (recall)** | Primaries byte-identical field on/off. Grimoire gist is an additive header, never a ranked peer. `Related:` stays additive. |
| **I9 (write)** | No private door into the store. Typed `detectNearDuplicate` skip for crystal↔source and Grimoire-node↔source; still one `save()`. |
| **Learning vs presentation** | §1.4. Accrual is substrate. `Related:` and the panel graph are consumers. Presentation-layer cost must not gate learning. |
| **`RM-16` gates consumers** | §2. Accrual-on does not appoint. Tainted clusters cannot auto-appoint. Do not smuggle a write-path filter into 4.0c. |

### Non-goals (restated)

- Fifth MCP verb (`dream_now`).
- Daemon inside the MCP server; decay daemon; `tick()`.
- Recency in primary rank (v1).
- Phase 7 global contradiction sweep.
- Phase 3 session promotion.
- Clustering on save-time semantic edges or WarmField / I7.
- Loosening `DEDUP_LO`.
- Unifying persist-net 0.25 with `Related:` 0.55 (the named failure).
- Dumping the K=5 / 0.25 persist-net into `Related:`.
- Epoch-modulated half-lives in v1.
- Auto-writing substrate constants from the sim.
- `RM-16` implementation in the measurement slices.
- Rank penalty for crystals without a 2.2-class measurement.
- Dual-write JSONL after the dreamer starts mutating.

### Open questions for Samuel

The field split, fade-as-I6 (not rank), retrieve-then-filter, theme-structured
sim, and freeze-0011 itself are **settled**. Naming and the cosine-exclusion are
now settled too (Samuel, 2026-09-05). These remain open:

1. **Naming — SETTLED.** The whole structure is **the Grimoire**; levels are
   **Page** (day) / **Chapter** (week) / **Volume** (month) / **Tome** (year).
   "Part" / "yearbook" / reusing "Grimoire" for a level were rejected.
2. **Grimoire nodes out of default cosine — CONFIRMED** (Samuel, 2026-09-05):
   v1 default is exclusion (candidate-set, like superseded rows), included only
   on `isTemporalNavigationQuery`. Keep the Grimoire a navigation/index
   structure, not another retrieval corpus. Putting nodes in the pool would be
   a later measured A/B, not the default.
3. **2pm via OS scheduled task after install / panel consent — CONFIRMED**
   (Samuel, 2026-09-05): OS scheduled task, after consent. Panel is consent +
   journal + schedule config, not the clock (it heartbeat-auto-shuts down).
   Not a silent Task Scheduler entry.
4. **Op C cut policy — CONFIRMED** (Samuel, 2026-09-05): if gist-writing (Op C)
   does not measurably earn its keep while dedup (Op A) and the Grimoire (Op D)
   do, cut **only** Op C, keep the dreamer for pages + dedup, and record the
   negative. A losing Op C never takes a winning Grimoire with it. (Samuel's
   own read: he expects Op C to work out; this is the safety net, not a
   prediction — the soak / sim decide, not assertion.)

All four open questions are now settled. Any further change is an amendment to
this RFC, not a pending decision.

---

## What this RFC does not decide

- The 4.0c *outcome* (budget held vs N-cap vs retrieve-then-filter-first).
  It freezes the measurement and the `Related:` fix *direction*.
- The 4.0b *outcome* (H1–H5 pass / starve). It freezes the bands and the
  layout. Humans change constants only with a named measurement.
- The IPC primitive for the writer lock / busy flag (lockfile vs a SQLite
  row vs a named mutex). The *requirement* is frozen (one writer; recall
  not blocked; pause / resume; per-page txn). The primitive is 4.0 vehicle.
- How `hebbian.n` / `first_reinforced_at` backfill from edges that accrued
  before 4.1 (weight / `alphaPP` is a lie for decayed edges). 4.1 names
  the fields; the backfill heuristic is that slice's job and should
  prefer "unknown → wait for new bumps" over inventing a count.
- User-TZ source when the panel is closed (dreamer process local TZ is
  the obvious answer; a travelling user can misfile a day). 4.1b.
- Whether prune should consult `semanticValid()` (named in 0009 §4; not
  this RFC).

---

## Related

[[phase-4-consolidation]] · [[ROADMAP]] · [[BACKLOG]] · [[ARCHITECTURE]] · [[0003-hybrid-retrieval]] · [[0009-edge-threat-model]] · [[0002-temporal-supersession]] · [[0007-eval-harness]] · [[phase-0-edge-substrate]] · [[BUGS]] · [[proposed/README]]
