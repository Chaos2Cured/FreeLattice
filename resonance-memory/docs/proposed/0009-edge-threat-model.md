# 0009 — Edge-substrate threat-model sketch

**Status:** sketch (on-paper; not an implementation) · **Backlog:** `RM-16` (this
**feeds** it; it does **not** build it) · **Depends on:** Phase 0 / `RM-21` as
shipped · **Gates:** Phase 2.2 promotion ([`phase-2`](../phases/phase-2-retrieval-dynamics.md))

> **This is a sketch.** `RM-16` (poisoning / injection defense) stays **gated
> to Phase 2**. Nothing here is a licence to land defense code, a fifth verb,
> a rank change, or a write-path filter. The job is to answer four questions
> against the substrate Phase 0 actually built, name the asset worth
> protecting, and carry the answers that *change* at the Phase 2.2 gate
> forward as requirements `RM-16` must meet before fusion can become default.

Grounded in: `edges.js` (the two-signal record, `effectiveHebbian`,
`reinforceRecall` / `_bump`, `pruneSweep`, one-way migration),
`memory-core.js` (`bindSaveTimeNeighbors`, the field-on recall path),
`field.js` (`buildEdges`, `neighborhood`, `reachableConstraints`),
`record.js` (`detectConstraint`, `embedding_version`). Where this note and
those files disagree, the files win.

---

## Non-goals

- Not a multi-tenant / network-attacker model. Resonance Memory is local-only;
  the interesting adversary is untrusted *text* entering through the four
  verbs, plus a model that can be steered into issuing those verbs. A
  filesystem writer who can replace `<store>.edges.json` is in scope only as
  "the sidecar is unauthenticated source of truth" — `RM-18` (encryption at
  rest) is the related item, not this one.
- Not a redesign of `detectConstraint`, save-time `K` / `minCos`, half-lives,
  or the 0.55 / 0.25 / 0.45 three-threshold split. Those are measured or
  named; this sketch treats them as the room the adversary is in.
- Not an implementation of provenance on records or edges. Record `source`
  (`user_stated` default) is already the `RM-16` groundwork
  ([`ARCHITECTURE`](../ARCHITECTURE.md) §8); it is **not** consulted by any
  edge path today.

---

## Adversary model

The public surface is four verbs. The consuming model is the only client.
Untrusted content reaches the store when that model calls `save_memory` on
text it saw (a webpage, a tool result, a prompt-injection, a confused-deputy
turn). Untrusted *association* reaches the sidecar when that model then
calls `recall_memory` with the field on and two memories co-surface.

| Actor | What they can do | What they cannot do (today) |
|---|---|---|
| Steered model / injected text | `save` arbitrary text; `recall` queries that co-rank chosen ids; `edit` / `delete` by opaque id if the model was shown it | Assign metadata, embeddings, weights, or types (I4). No fifth verb. Cannot ask the substrate to "link A to B." |
| Local embedder | Determines cosine, hence save-time bind and primary rank | Does not write the sidecar. A poisoned embed self-heals on re-embed + version compare (semantic only). |
| Filesystem writer | Plant a well-formed `.edges.json` or a leftover `.assoc.json` before first load | A *corrupt* sidecar fails open to empty (I3) — well-formed poison is trusted. |
| Field-off user | Save-time bind still persists structure | No `Related:`, no `reinforceRecall`, no Hebbian growth. Default is off (`RESONANCE_MEMORY_FIELD`). |

The field is **off by default**. Hebbian poisoning and `Related:` nomination
require the user (or env) to turn it on. That is a real blast-radius cap,
not a footnote. Save-time bind still runs on every successful `save` of a
vectored record, field on or off — the persist-net is accumulated even
while discovery is dark.

---

## The two-signal record (the asset)

One undirected edge, two independently stored signals
([`phase-0`](../phases/phase-0-edge-substrate.md) "The asymmetry is
load-bearing"):

```
embedding            source of truth   (what the memory means)
edge semantic score  derived cache     (recomputable; validity is a
                                       version comparison, not a flag)
hebbian weight       source of truth   (irreplaceable; the only thing
                                       that decays; last_updated nests
                                       here because that's all it clocks)
```

Provenance on the edge records *how it came to exist*
(`save-time-neighbor` | `co-activation`), not what it currently is.
`migrated_from` is a separate fact. State is read off the signals
(`hebbian.weight === 0` is unreinforced). There is no bootstrap→learned
*transition* to attack; an edge simply accrues weight.

---

## 1. What can cause an edge to exist?

Three constructors. Nothing else. There is no "link these two" tool (I1).

### 1a. Save-time semantic bind (`bindSaveTimeNeighbors`)

On `save()` of a record that got a real vector, scan the store, keep the
top **K = 5** neighbors with cosine **≥ 0.25** (`SAVE_TIME_K` /
`SAVE_TIME_MIN_COS`). New row: `provenance.origin = "save-time-neighbor"`,
`hebbian.weight = 0` (no seeded baseline), `semantic.value` cached with
`src_versions` tagged to the **canonical** endpoints. Embedder down → bind
nothing, don't throw. An existing edge (e.g. already co-activated) has its
semantic cache refreshed if stale; Hebbian bytes and origin are left alone.

**Who controls the input.** The saved *text* (via the local embedder) and
the embeddings already in the store. The model picks the text; the server
picks the neighbors. The adversary cannot name an id pair.

**Can an adversary manufacture edges?** Yes, cheaply, for *nearby* pairs.
Save a parasite memory whose vector lands in the target's top-5 above 0.25
and the edge exists, durable, at Hebbian zero. They cannot manufacture an
edge between semantically distant memories this way — cosine is the gate,
and K caps how many neighbors one save can mint. They also cannot pick
*which* of the above-threshold candidates bind if more than five clear 0.25;
the top-5 by cosine wins.

**Latent, not live.** Recall does **not** read this table.
`Related:` is still `field.js` at `minSim` 0.55 (phase-0 Risk #2; 0.1
explicitly persisted the table and did not switch the read path). A
manufactured 0.25 edge is structure sitting in the sidecar, waiting for a
later slice to walk it. That latency is a blast-radius cap *today* and a
time-bomb at the 2.2 gate (see §6).

### 1b. Co-activation (`reinforceRecall` → `_bump` of a missing pair)

Field-on `recall` builds `Related:` then calls
`L.reinforceRecall(primaryIds, neighborhoodIds, { requestId, typeFn })`.
`_bump` on a pair that is not yet in the table `put`s a new edge with
`origin: "co-activation"` and `hebbianWeight: α`. Primary↔primary uses
`alphaPP = 0.1`; primary↔neighborhood uses `alphaPN = 0.02`;
neighborhood↔neighborhood is **α = 0 and is skipped**. The graph learns
from the user's queries, not from its own guesses (ARCHITECTURE: "this
provenance instinct is what `RM-16` generalizes to the whole write path").
That instinct is retrieval-provenance (primary vs neighborhood), **not**
record `source`. A `tool_content` memory in the primary top-k is
reinforced at full `alphaPP`.

**Who controls the input.** Cosine rank of the query (who is primary) and
the field graph (who is neighborhood). The query is the model's; the graph
is `buildEdges` (cosine + `bonus`, mutual kNN, minSim 0.55) plus
constraint-rescue (raw cosine, gate 0.45 — see §3).

**Can an adversary manufacture edges?** Yes, if they can cause co-surface
(§2). Cold-start is the real gate: a distant pair that never co-ranks in
the cosine top-k and never appears in `Related:` never gets a
co-activation edge. Save-time bind does not help them here — those edges
start at weight 0 and are not what `Related:` reads.

### 1c. One-way migration (`migrateAssoc`)

If `<store>.edges.json` is missing, a leftover `<store>.assoc.json` is
ingested: every numeric weight becomes `hebbian.weight`, origin
`co-activation`, `migrated_from: "assoc.json"`, timestamps at migration
time (lower bounds), semantic empty. The old file is left untouched
(downgrade-safe). An old-format reader seeing `kind: "resonance-edges"`
throws `IncompatibleEdgeFormatError` rather than returning a subset.

**Who controls the input.** Whoever wrote the legacy sidecar — previous
sessions of this install, or a filesystem writer who plants `.assoc.json`
before the first EdgeStore load. Load itself does not write (I5); the
constructor persists the new file only after a successful in-memory
migration into a missing `.edges.json`.

**Can an adversary manufacture edges?** Yes, with a disk write, and they
can plant *arbitrary Hebbian weights*, not just existence. A well-formed
`.edges.json` is trusted as source of truth on the next boot — I3 fails
open for *corrupt* JSON (empty table, cosine survives), not for *lying*
JSON. There is no MAC, no version pin against the JSONL store, no
"these endpoints still exist" check that drops the edge (orphan keys
sit until something incident-scans them).

### What cannot cause an edge

- A read (`recall`) without co-surface. Field-off recall writes nothing
  to the sidecar (0.5 contract).
- `edit` of an endpoint. No edge *create*; reactivation of a pruned
  incident row is a state flip, not a mint (0.4).
- `delete`. Soft-delete of a record does not drop its incident edges
  (orphans; `vacuum()` of *edges* is a separate, explicit call).
- Neighborhood↔neighborhood co-mention.

---

## 2. What can raise an edge's Hebbian weight?

**Only `reinforceRecall` → `_bump`.** Semantic never writes Hebbian.
`effectiveHebbian` never writes. `pruneSweep` never writes Hebbian.
`edit` never writes Hebbian. Save-time bind of an existing edge leaves
Hebbian bytes alone.

The mutation (Phase 0.3): revive if `pruned_at`, then
`w_eff = effectiveHebbian(edge, now)` (wall-clock,
`w · 2^(−Δt/H)`), then `setHebbian(w_eff + α, now)`. Reinforcement
cannot bypass accumulated decay (no "ghost weight"). `last_updated`
stamps `now`, which **resets the decay clock** — that is the persistence
buy in §4. Provenance is preserved. One MCP request id = one transaction
(256-entry LRU in the sidecar envelope; no id → apply, don't record).

### Can an adversary drive reinforcement?

Yes, by causing two memories to co-surface on a field-on `recall`. Two
grades:

| Co-surface | α | How they got there |
|---|---|---|
| Both in the primary cosine top-k (`return_k`, default 5) | `alphaPP = 0.1` | Query embeds near both. No field help. |
| One primary, one in `Related:` | `alphaPN = 0.02` | Neighborhood (cosine + Hebbian bonus ≥ 0.55, mutual kNN, hops=1, max=4) **or** constraint-rescue (typed constraint, raw cosine ≥ 0.45 to a seed in `K_SEARCH=15`, max=4). |

**Chicken-and-egg (load-bearing today).** To grow Hebbian on a *distant*
pair you must first co-surface them by cosine (or rescue). You cannot
bootstrap a far association from the persist-net, because recall does not
read it. The cheap attack is a **parasite memory**: save text that
*already* cosine-ranks with a high-traffic fact on the queries a user
actually asks ("what do I prefer", "where do I work"). Those two land in
the primary top-k together; each such recall is +0.1.

**Cost / rate (order of magnitude, no decay).**

- `bonus = maxBonus · tanh(w)` with `maxBonus = 0.3`. Asymptotic; frequency
  cannot swamp the semantic floor on the *discovery* path.
- To lift a 0.50 cosine over recall `minSim` 0.55 you need bonus ≥ 0.05 →
  `tanh(w) ≥ 1/6` → `w ≳ 0.17` → **two** primary co-recalls at α=0.1.
  That is the "false association appears in `Related:`" threshold, and it
  is cheap once the pair already co-ranks.
- Approaching saturation (`tanh(w) ≈ 0.8`, bonus ≈ 0.24) is ~11 primary
  co-recalls. Diminishing returns after that, on discovery. (At 2.2 the
  *rank* mapping is not this tanh gate — see §6.)
- Neighborhood reinforcement is 5× slower (α=0.02). N↔N is free of
  charge because it does not happen.
- Same request id retried: **zero**. Distinct ids both apply. Eval / panel
  / tests have no id and always apply — not an adversary path.
- LRU 256: a very-late retry of an evicted id can double-apply. That is
  the bound's job, not a nonce. An adversary who can mint distinct JSON-RPC
  ids (the model, every turn) is not constrained by the LRU.

**Decay is the rate limiter they have to beat.** Half-lives (parameters,
seconds): constraint ~30 days, fact ~7 days, working ~1 hour. An edge
whose either endpoint is `is_constraint` uses the constraint class
(`hebbianDecayType`). Steady state if they reinforce exactly once per
half-life: `w = 0.5w + α` → `w = 2α` (0.2 for P↔P). Once a day against a
fact (H=7d): `w ≈ α / (1 − 2^(−1/7)) ≈ 10.6α ≈ 1.06` for P↔P — already
near the saturated bonus. Idle after a burst: six fact half-lives (~6
weeks) takes a peak of 1.0 down to ~0.016; the *bonus* is then a rounding
error. The *edge record* may still be there (§4).

**Reading does not raise weight.** I6: 100 field-on recalls under a frozen
clock leave an *uninvolved* edge's stored weight + `last_updated`
byte-identical. The involved pair *does* strengthen — that is
co-recall, the differentiator, and the attack surface. Field-off recall
writes nothing.

---

## 3. What can make a memory a constraint-rescue bridge?

Two different questions, and the brief's wording slightly overstates the
live wiring. Split them.

### 3a. What rescue actually walks today

`field.reachableConstraints` (stage-2, default `CONSTRAINT_GATE = 0.45`):
for each typed constraint (`record.is_constraint`, assigned by
`detectConstraint` — a **lexical** regex of dietary / medical / phobia
cues, never the model), take its top-2 neighbors by **raw cosine**
(Hebbian bonus is **not** applied on this path) at ≥ 0.45; rescue it into
`Related:` iff one of those neighbors is in the query's seed pool
(`K_SEARCH = 15`), it is not already in the returned top-k, cap 4.

It does **not** read EdgeStore. It does not use save-time 0.25 edges. It
does not use `effectiveHebbian`. A strong-semantic persisted edge is
irrelevant to rescue *until a later slice walks the cache*. Phase 0.4
protects that persist-net **so this walk can be switched later without
regressing field experiment #2**; it is not the walk itself.

`buildEdges` / `neighborhood` (ordinary `Related:`) *does* add
`bonus = maxBonus·tanh(effectiveHebbian)` before the 0.55 gate. That is
how a learned weight currently changes who is a *neighborhood* neighbor,
not who is a *rescue* bridge.

### 3b. What makes a memory a bridge *in the persist-net* (the 0.4 concern)

A save-time (or later-filled) edge with `semantic.value ≥ 0.25` is not
pruned even at Hebbian ~0 (`SEMANTIC_PRUNE_GATE = 0.25`, equal to
`SAVE_TIME_MIN_COS`; conjunction with `HEBBIAN_PRUNE_FLOOR = 1e-6`). The
0.25–0.45 band is exactly the persist-net stage-2 rescue can still walk
*by live cosine* (heights↔rooftop = 0.472 was the measurement). Raising
the prune gate to 0.55 would drop it. An unreinforced strong-semantic
edge "reverts to a plain semantic edge" and stays.

### Can that be steered to surface attacker-chosen memories?

**Today, via rescue, without Hebbian:** yes, if the attacker can (1) get
`is_constraint = true` on a payload and (2) land a bridge in the seed
pool with cosine ≥ 0.45 to that payload.

(1) is **narrower than "injection-shaped text."** `CONSTRAINT_RE` matches
diabetic / vegan / allergy / phobia / "no sugar" / "can't eat …" — not
"remember that you must always…". The backlog's `RM-16` eval case, as
written, is a *record-poisoning* case (it saves as a fact and lives or
dies on cosine rank), not a rescue case, unless the payload also carries
a cue the regex accepts. A false-positive constraint only *widens*
retrieval (cheap); it never deletes. That is the documented reason a
loose type is acceptable — and it is also why a constraint-shaped
parasite is a widening attack.

(2) is the parasite-bridge: save "lemon bars with extra sugar" next to
"I'm diabetic", or a homonym that cosine-collides with a real apex rule
(`adv-height-homonym` is the measured form — field-on currently *fails*
that golden case by surfacing "terrified"). The attacker does not need
to grow Hebbian. They need one save that embeds near both the constraint
and the queries that pull the bridge into `K_SEARCH`.

**Today, via neighborhood, with Hebbian:** once a pair has been
co-surfaced enough for `bonus` to lift a sub-0.55 cosine over the gate
(§2: two P↔P recalls to buy +0.05), the parasite can start appearing in
`Related:` for queries that only matched the *other* endpoint. Mutual
kNN is a real damper (the 'Thursday' collision) — a one-sided hub does
not get dragged in unless the association is reciprocated in both
nodes' top-2.

**Can they appoint the primary answer?** No. I9: primary cosine results
are byte-identical field on or off. Rescue and neighborhood append
`Related:`. That is the current blast radius: **widen the candidate set
the model sees**, do not reorder what it was already going to see.

---

## 4. What can make an edge survive indefinitely?

Two independent survival laws. Mixing them is the failure 0.4 exists to
prevent.

### Semantic strength (structure; does not fade)

`semantic.value` is a derived cache of cosine(embeddings). It does not
decay. `pruneSweep` will not mark `pruned_at` if `semantic.value ≥ 0.25`,
even at `effectiveHebbian ≈ 0`. Empty/null semantic counts as weak
(migrated edges that have decayed to ~0 Hebbian **do** prune — a known
0.4 choice, and a quiet data-loss path for legacy learned edges whose
semantic was never filled).

**Self-heal on the read of semantic:** `semantic.src_versions` must match
both endpoints' `embedding_version`. `edit()` increments the version only
on a successful re-embed (`BUG-008`: a failed embed must not). Stale is
structurally self-evident; no invalidation event has to fire. A corrupt
or poisoned *semantic score* is therefore recoverable: re-embed, or wait
for the next save-time bind / a future recompute-on-read, and the cache
refills from the embeddings (the actual source of truth).

**Gap, named so it is not forgotten:** `pruneSweep` / `isSemanticallyWeak`
consult `semantic.value` **without** `semanticValid()`. A stale-high
cache (save bound at 0.40, then an `edit` drifted the text; versions no
longer match; the number is still 0.40) keeps the edge unpruned. The
transition table says `edit` writes no edge row, so the lie sits. A
later read that *does* check versions self-heals; prune does not. This
is persistence an adversary can buy for the *record*, not for the
*score a correct reader would use*. It becomes load-bearing the moment
anything walks the cache without a version check.

### Reinforcement (learned; resets the clock)

Every `_bump` stamps `hebbian.last_updated = now` after materializing
decay. Ongoing co-recall at a rate that beats the half-life keeps
effective weight in the tanh-useful band (§2). Stopping lets it fade;
six fact half-lives is enough to make the *bonus* irrelevant. The
*stored* weight is whatever was last materialized — I6 means reads do
not write it down, so a long-idle stored value can look "full" on disk
while `effectiveHebbian` is ~0. Prune uses effective, not stored.

### Soft prune is not death (I8)

`pruneSweep` (MCP startup or on demand — **never** `recall` / `save`)
marks `pruned_at`, bumps `prune_count`, keeps the record.
`incident()` / `bonus()` / `weight()` skip it. Hard drop is
`EdgeStore.vacuum()`, explicit, operator-only. Reactivation is
server-side only (I1): `save` / `edit` / confirming restatement /
`reinforceRecall` touching an endpoint revives in place; `created_at`
and the decayed Hebbian bytes are carried (not snapped to full). An
adversary who can `save` or `edit` near a pruned pair can bring it
back; the next sweep re-prunes only if it is still unreinforced *and*
semantically weak.

### What persistence an adversary can buy

| Buy | Cost | Lasts until |
|---|---|---|
| Unreinforced persist-net edge (cosine ≥ 0.25 at save) | One `save` of nearby text | Forever, against prune. Semantic self-heals on version mismatch; the *row* stays. Live `Related:` ignores it today. |
| Useful Hebbian bonus on a pair that already co-ranks | ~2 field-on primary co-recalls | Weeks without upkeep (fact H=7d); months if a constraint endpoint (H=30d). Bonus fades; row may not. |
| Saturated discovery bonus | ~11 P↔P co-recalls | Same decay clock. Cannot exceed `maxBonus` on discovery. |
| Constraint-rescue surfacing | One constraint-shaped save + a 0.45 bridge in `K_SEARCH` | As long as the embeddings stay close. No Hebbian required. |
| Arbitrary planted weight | One well-formed sidecar write | Until the user deletes the sidecar (memories survive; learned signal does not — that is the `RM-17` point). |
| Revive a pruned weak edge | `save`/`edit` of an endpoint | Until the next `pruneSweep`, unless they also re-earned semantic ≥ 0.25 or a fresh α. |

They cannot buy a Hebbian weight that outruns `tanh` on today's discovery
path. They cannot buy a semantic score that survives a real re-embed.
They **can** buy a durable *false learned association* that no recompute
will ever restore if it is lost, and that no recompute will ever *undo*
if it is wrong. That is §5.

---

## 5. The asymmetry, stated as a security property

**Semantic is recomputable. Hebbian is not.**

A corrupt, stale, or poisoned `semantic.value` is a cache miss waiting to
happen. Validity is a comparison (`src_versions` vs each endpoint's
`embedding_version`), not a flag an invalidation event might have missed.
The embeddings remain the source of truth for meaning; `edit()` re-embeds;
the cache refills. Destroying `<store>.edges.json` loses the derived
scores and nothing about the memories. They come back the next time
something binds or recomputes.

A poisoned **reinforcement** is a durable **false memory**.
`hebbian.weight` + `hebbian.last_updated` are the source of truth for
*use*. Nothing else in the system encodes "these two co-surfaced, on
purpose, this often, this recently." There is no embedding that implies
it, no JSONL field that rebuilds it, no version comparison that will
notice it is a lie. Re-embedding an endpoint leaves Hebbian **untouched**
(transition table: `edit` → hebbian unchanged). Decay will fade a
weight that is not upkept; it will not *correct* a weight that is
upkept. Migration copies it as gospel. A well-formed sidecar plant
*is* the learned history.

That is why the one-way migration exists: dropping even one learned
weight is data loss, and treating a new record as an old number would
NaN the bonus then overwrite the sidecar. The same property that makes
migration refuse to silently subset the table is the property that
makes a lie in that table irreplaceable.

**`RM-17` (export / import / backup) rises because of this, not despite
it.** Phase 0 risk #5 / ROADMAP accepted risk #8: the sidecar now holds
irreplaceable state; semantic rebuilds, learned weight does not.
Backup/export must preserve Hebbian weight and *may* drop semantic. An
export that ships only the JSONL is a memory-amnesia machine. An import
that blindly accepts a sidecar is a false-memory injection machine —
which is why `RM-16` and `RM-17` are coupled at the 2.2 gate even though
they look like different items. Restoring a backup is the cleanest way
to plant §1c.

The asset most worth protecting is therefore **not the edge table and
not the semantic cache. It is the Hebbian signal, and the right to be
the only writer of it.** Everything else in this sketch is a way to
become that writer without being the user.

---

## 6. Which answers change at the Phase 2.2 promotion gate

Today I9 holds: discovery nominates, it does not appoint. Primary
results are byte-identical field on or off. A poisoned edge's blast
radius is **widening the candidate set** (`Related:`, at most 4
neighborhood + 4 rescued, merged, de-duped against the top-k). Fusion
that lets learned weight enter **rank** (Phase 2.2, flag off until the
gate; [`phase-2`](../phases/phase-2-retrieval-dynamics.md),
[`0003`](0003-hybrid-retrieval.md), `RM-05`) turns the same edge into
an **answer-shaper**. That is a categorically worse threat. A failed
gate keeps the flag off and writes the negative down; that is still
the right default.

| Question | Phase 0 (now) | After 2.2, if promoted |
|---|---|---|
| **1. Existence** | Save-time 0.25 edges are latent (recall does not read them). Co-activation edges exist to feed `bonus` on the 0.55 discovery gate. Planted sidecars can lie, but I9 caps the lie to `Related:`. | If the graph is a fusion **arm** (`RM-05` optional third arm) or if Related: is switched onto the persist-net, **existence itself nominates into rank**. Every parasite edge ever bound at 0.25, including those accumulated while the field was off, becomes live without further attacker work. The latent persist-net detonates. |
| **2. Raising Hebbian** | α buys a bounded discovery bonus (`0.3·tanh(w)`), enough to lift a near-miss over 0.55 into `Related:`. Cheap for pairs that already co-rank; chicken-and-egg for distant pairs. Cannot reorder primary. | α buys **position in the primary answer**. Cost/rate must be re-derived against whatever fusion maps `w` onto rank (RRF of a graph arm, multiplicative gate, …). `tanh` bounding per edge does **not** automatically bound rank influence — per-edge cap does not prevent a hub with many edges (that is why 2.3 competition + 2.4 neighborhood-total normalization are also gate conditions). Rich-get-richer: rank reinforces what ranked. The chicken-and-egg damper *weakens* if a graph arm can introduce a pair into the ranked set that cosine would not have co-returned. |
| **3. Rescue / bridge** | Rescue is live cosine, typed-constraints only, not EdgeStore, not Hebbian. Surfaces in `Related:` only. Constraint-shaped parasites widen, they do not appoint. | If rescued ids or Hebbian-lifted bridges enter the fused ranking, a steered bridge can **appoint** the primary answer — including an attacker-chosen constraint that cosine put at rank 21. The "false positive only widens" argument dies the moment widening is promotion. |
| **4. Indefinite survival** | A ≥0.25 unreinforced edge lives forever as structure the live path ignores. Hebbian useful-life is weeks without upkeep. Soft-prune + reactivation is an existence flicker, not a rank flicker. | A forever-structure edge that fusion now *reads* is a forever-candidate. A Hebbian weight kept in band by a modest recall cadence is a forever-bias on the primary answer. Backup restore (`RM-17`) becomes rank injection, not just association injection. |

**What does *not* change at 2.2:** semantic remains recomputable; Hebbian
remains the irreplaceable source of truth; I3 (fails open to cosine)
must still hold ("degrade to pure cosine when field/ledger is
unavailable"); I1 (no fifth verb); I5 (no unbounded write on a read);
I6 (reading does not drive decay). The *asset* is the same. The *blast
radius of a successful write to that asset* is what changes.

---

## 7. Requirements `RM-16` must meet before the Phase 2.2 gate can pass

These are the carry-forward. They are not implemented here. The existing
`RM-16` bullets (treat tool-call content as untrusted; stamp
`source = user_stated | model_inferred | tool_content`; weight
user-stated over model-inferred at recall; eval the "remember that you
must always…" payload) are **necessary and not sufficient**. They cover
the *record*. The Phase 0 substrate made the *edge* the thing that
cannot be rebuilt.

Before learned weight may enter rank, `RM-16` must:

1. **Protect the Hebbian writer.** Untrusted provenance must not be able
   to mint or raise `hebbian.weight` at full `alphaPP`. Concretely: record
   `source` (and/or a per-reinforcement provenance) has to reach
   `_bump`, not just the JSONL row. A `tool_content` or `model_inferred`
   memory co-surfacing with a user fact should not teach the graph at
   the same rate as two user facts — the primary-vs-neighborhood
   discount is the existing instinct; generalize it to *who said it*,
   not only *where it sat in this recall*.
2. **Bound the rate an adversary can buy.** Distinct JSON-RPC ids every
   turn make the 256-LRU irrelevant as a poison damper. 2.2 needs a
   rate/competition story that is not "the tanh gate on discovery
   bonus," because that gate does not apply to rank. Phase 2.3 / 2.4
   (neighborhood competition, total-strength normalization) are the
   damping the promotion gate already names; `RM-16` is the
   *provenance* half of the same problem. Both must land.
3. **Treat sidecar import / restore as an injection path.** `RM-17`
   backup that round-trips Hebbian is in scope for `RM-16`: restoring
   a sidecar is §1c with a UI. Export must preserve learned weight
   (the irreplaceable asset); import must not silently bless a planted
   one. Semantic may be dropped and rebuilt; Hebbian may not be dropped
   and must not be blindly trusted from an unauthenticated blob.
4. **Re-evaluate the persist-net before anything reads it into rank.**
   Switching `Related:` or a fusion arm onto save-time 0.25 edges
   detonates every parasite bound while discovery was dark. Either the
   read path stays at 0.55-or-tighter for *nomination into rank*, or
   `RM-16` has a story for the 0.25 band (recompute-on-read with
   `semanticValid`, do not walk stale cache, do not let prune's
   version-blind `semantic.value` decide what rank sees).
5. **Keep I9 as the fallback, not the memory of a better time.** If the
   A/B is inconclusive, if 2.3/2.4 are not in, or if (1)–(4) are not
   in, fusion stays flag-off and primary remains cosine. A measured
   "no" is a shipped result ([`phase-2`](../phases/phase-2-retrieval-dynamics.md)
   promotion gate items 1–4; [`ROADMAP`](../ROADMAP.md) "The promotion
   gate").
6. **Eval the edge, not only the record.** The existing adversarial
   corpus case is a save-payload. Add cases that (a) parasite-save next
   to a high-traffic fact and co-recall it N times, asserting the
   primary cosine top-k does not flip pre-2.2 and that post-2.2 fusion
   does not flip it without provenance damping; (b) plant a well-formed
   sidecar with huge weights and assert fail-open / ignore / provenance
   reject, not appointment; (c) constraint-cue payload vs
   "remember that you must always…" (these are different attacks; the
   regex only catches the first). False-association rate under fusion
   is already on the 2.5 metric list; it is the number this sketch
   exists to make someone measure.

`RM-16` remains **M**, gated to Phase 2, and a **hard condition of the
2.2 promotion gate** (condition 3 of 4). This document is the threat
it has to answer, not a substitute for answering it.

---

## What this sketch does not decide

- Whether `Related:` should ever read the persist-net. (A later, gated
  slice; doing it without §7.4 is how the latent 0.25 net becomes a
  live widening channel.)
- Whether prune should consult `semanticValid()`. Named in §4 as a gap;
  not silently fixed here (no code in 0.6).
- Edge inheritance across supersession (Phase 7 — the quietest
  data-loss path, and a quiet *poison-preservation* path if a retired
  fact keeps its Hebbian).
- Filesystem integrity (`RM-18`).
- Turning the field on by default. Off-by-default is currently doing
  more for poisoning than any unbuilt defense; changing it is a
  product decision with a threat consequence, not a Phase 0 leftover.

---

## Related

[[phase-0-edge-substrate]] · [[phase-2-retrieval-dynamics]] · [[ROADMAP]] · [[BACKLOG]] · [[ARCHITECTURE]] · [[0003-hybrid-retrieval]] · [[0006-constraints-decay-pruning]] · [[0007-eval-harness]] · [[proposed/README]] · [[RESULTS]] · [[BUGS]]
