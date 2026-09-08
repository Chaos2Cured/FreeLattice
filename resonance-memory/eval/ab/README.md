# A/B value rig — does Resonance Memory make a modest local model measurably better?

This is the **end-to-end value proof**, distinct from `eval/` (RM-00), which measures RM's
internal retrieval quality (recall@k, dedup, PII). RM-00 answers *"is recall good?"*. This rig
answers the product question a stranger actually asks: **"if I bolt RM onto my small local
model, does it get measurably better at remembering me across sessions — and better than just
stuffing recent history into the prompt?"**

It is designed to survive the hostile reading, because the honest failure mode of a
memory-vendor benchmark is *building the test so the product wins*. Three defenses:

1. **Modest drivers only.** `gpt-oss-20b` (competent-but-small) and
   `Qwythos-9B-Claude-Mythos` (small + loose). If RM only helps a frontier model, it proves
   nothing about the substrate. The floppier model is the better stress test.
2. **Three arms at an equal budget** (below). The hard control isn't "no memory" — it's the
   naive thing a developer actually ships: dump recent raw history into the prompt.
3. **Two independent rigs.** This is Ember's scenario/grader. Grok builds a *separate* one
   from scratch — different user, different facts, different probes, different grader —
   sharing only the discipline in this file. Convergent wins across two disjoint tasks is the
   credible result; a single rig is not.

## The three arms

Same driver, same scripted user, same injection framing. Only the cross-session memory differs:

| arm | what it injects before each turn |
|---|---|
| **cold** | nothing across sessions — current session's conversation only. The floor. |
| **recency** | the most-recent raw user turns, newest-first, up to the token budget. The naive hard control. |
| **rm** | RM as shipped: `save()` every user turn; `recall()` top-k for the current turn; inject the real recall string, truncated to the same budget. |

**The fairness knob:** `recency` and `rm` get an *identical* injection-token budget (`--budget`,
default 700). Only the **selection method** differs — dumb recency vs RM's semantic recall. That
isolates RM's actual claim: *given the same room in context, RM picks better.* `cold` gets none,
to establish that memory matters at all.

**Scaffolded, not agentic (on purpose).** The harness does the save/recall and injects the
result; the driver just uses what it's given. We are measuring **RM the substrate, not the
driver's tool-use skill** — and that matches the product promise ("works under a modest driver").
It also removes the biggest noise source (a 20B fumbling tool calls). Agentic end-to-end is a
possible later secondary run.

## The scenario (Ember's)

A fictional user, "Dana" — **not** a real person's data. Structure:

- **Plants (early):** facts and constraints — shellfish allergy, dog Biscuit, sister Robin
  (pediatric nurse, Denver), landscape architect at Cedar & Vale, vegetarian, no caffeine after
  2pm, afraid of heights, a **coworker also named Robin** (accounting), a novel set in a drowned
  city.
- **Updates (early, then buried):** quits Cedar & Vale → freelance; vegetarian → pescatarian.
- **Heavy filler:** a dozen benign one-turn sessions that push every plant and update **beyond
  any fixed recency window**. This is the whole point — old facts, retrieved on demand.
- **Probes (last):** 10 indirect questions whose answers need a buried fact. Phrased so a
  verbatim keyword echo won't save you (guards the keyword-match confound).

Probe kinds and what each stresses:

- `recall` — a plain buried fact (dog's name; novel setting).
- `constraint` — a plan that violates a stored constraint (oyster bar vs shellfish allergy; 4pm
  coffee vs caffeine cutoff; 30th-floor glass terrace vs height phobia). RM's constraint rescue.
- `update` — answer must reflect the **current** fact (freelance; can eat salmon), not the
  superseded one. RM's `store.current()` should hide the stale fact.
- `update-historical` — "what firm did I *used to* work at" must surface the **superseded**
  Cedar & Vale. RM's `isHistoricalQuery` path.
- `discrim` — "what does my sister do" must return nurse-Robin, not accounting-Robin. The
  entity-id + polarity work (PR #29).
- `control` — answerable from the current session alone (what city am I in, stated this
  session). A floor check: every arm should pass.

Only the **assistant** is stochastic; every user turn is fixed text, so the arms differ solely
in injected memory. Runs are repeated (`--runs`, default 5) and reported as **mean ± sd** — a
single run is noise (the "measured, not asserted" discipline; never trust one readout).

## Scoring

Deterministic, transparent, blind-to-arm (`grade.js`): a probe **passes** iff the answer
contains an accept token **and** no reject token (reject dominates — surfacing a
superseded/confused fact is a hard fail even when the right words also appear). Every raw answer
is saved in the results JSON so the accept/reject calls are auditable, and an LLM-judge
cross-check can be layered on. The grader never sees which arm produced an answer.

This is deliberately crude and reproducible. Its known weakness (short accept tokens can match
loosely) is why the raw transcripts ship with every run.

## Pre-declared verdict bands (two-sided; advisory — the numbers are the artifact)

Declared before the real runs, so a result can't be reverse-justified:

- **PASS** — `rm ≥ cold + 0.15` (memory matters) **and** `rm ≥ recency` at equal budget **and**
  `rm ≥ recency` on the hard subset `{update, update-historical, discrim}`, where naive recency
  structurally loses the old/superseded/same-name facts.
- **FAIL-DEAD** — `rm ≤ cold + 0.05`: recall isn't firing.
- **FAIL-NOISE** — `rm < recency − 0.05`: RM injects but crowds out good context (a two-sided
  guard — RM can fail by being useless *or* by being actively worse than dumb recency).

## Running it

```bash
# plumbing check, no LLM (stub driver echoes the injected memory):
node eval/ab/run.js --selftest --runs 1

# real run against whatever chat model + embedder are loaded in LM Studio (:1234):
EMBED_MODEL=text-embedding-nomic-embed-text-v1.5 \
  node eval/ab/run.js --model "openai/gpt-oss-20b" --arms cold,recency,rm --runs 5 --budget 700 --field on
```

Needs LM Studio serving a chat model **and** an embedding model at once (they coexist without
JIT thrash on this box — verified). Results land in `eval/ab/results/<model>-<stamp>.{json,md}`.
`AB_DEBUG=1` prints the injected block + answer for every probe.

Flags: `--model` (label; LM Studio serves whatever's loaded), `--arms`, `--runs`, `--budget`
(shared recency/rm injection budget in tokens), `--field on|off` (RM associative field),
`--temp`.

## Independence contract (what Grok's rig must share, and must NOT)

**Share (the discipline):** same driver across arms; the three arms; equal recency/rm budget;
modest driver; fixed (scripted) user turns; probes that need *buried* facts phrased indirectly;
repeated runs with mean ± sd; blind deterministic grading; pre-declared two-sided bands.

**Do NOT share (so the two rigs are genuinely independent):** the user, the facts, the probe
questions, the filler, the grader wording. Build your scenario from scratch. If both rigs
independently land PASS on disjoint tasks, that is the result worth posting.
