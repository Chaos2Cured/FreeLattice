# A/B value rig (Grok) — does Resonance Memory make a modest local model measurably better?

This is the **second, independent** end-to-end value proof. Ember's rig lives at
`eval/ab/` (Dana). This one must not collide with it, and must not reuse its
user, facts, probes, filler, or grader wording. Shared discipline only — see
`eval/ab/README.md`.

The product question is the same: **if I bolt RM onto a small local model, does
it get measurably better at remembering me across sessions — and better than
just stuffing recent history into the prompt?**

A single rig can be accused of being built so the product wins. Two disjoint
scenarios, two authors, same three arms, same modest drivers: if both say RM
wins, that is the result worth posting. If they disagree, that is also a result.

## What this copy shares (the discipline)

- Same driver across all arms. Modest drivers only: `openai/gpt-oss-20b` and
  `qwythos-9b-claude-mythos-5-1m` (both loaded in LM Studio on `:1234`).
- Three arms: **cold** / **recency** / **rm**. Recency and RM get an *identical*
  injection-token budget (`--budget`, default 700). Only the selection differs.
- Scaffolded, not agentic: the harness saves/recalls and injects; the driver
  just uses what it's given.
- Scripted (fixed) user turns; only the assistant is stochastic.
- Probes phrased indirectly (no verbatim echo of the planted sentence).
- Blind, deterministic, auditable grading (accept/reject tokens; raw answers saved).
- Repeated runs, reported as **mean ± sd**. A single run is noise.
- Memory injected as **one combined system message**, not a weak second system
  block (gpt-oss-20b ignored a second system message even when it held the answer).

## What this copy must not share

Jules Marin, not Dana. Different plants, different updates, different filler,
different probes, different accept/reject wording. Offline checks in `check.js`
fail the unit gate if Dana/Ember-facts leak in, or if an accept token already
sits in the probe question.

## The three arms

| arm | what it injects before each turn |
|---|---|
| **cold** | nothing across sessions — current session only. The floor. |
| **recency** | most-recent raw user turns, newest-first, up to the token budget. The naive hard control. |
| **rm** | RM as shipped: `save()` every user turn; `recall()` top-k; inject the real recall string, truncated to the same budget. |

## The scenario (Grok's)

A fictional user, **Jules Marin** — not a real person's data.

- **Plants (early):** mango allergy (epipen); orange sailor-cat **Harbin**; niece
  **Juniper** (ferry captain, Juneau); objects conservator at **Plover & Keel
  Museum**; vegan; can't have NSAIDs (lithium interaction); **neighbor also
  named Juniper** (tax-prep stall); restoring a **1924 pump organ**; never does
  cruise ships (cabin + motion panic).
- **Updates (early, then buried):** left Plover & Keel → State Historical Society
  contract; vegan → eats eggs and dairy again.
- **Filler:** 70 buried turns (including a few adjacent distractors: museum
  loan paperwork, house-cat lifespan, green curry, overnight camping) plus 40
  clean tail turns with no topical overlap, so the recency window is not
  accidentally full of probe-relevant chatter.
- **Late plants (inside the 700-token window on purpose):** second cat **Quill**;
  a used **tandem kayak** with a yellow hatch. Recency is *supposed* to win or
  tie these. A rig that never lets recency win has proved nothing.
- **Probes (last):** 12 indirect questions. Kinds: `recall`, `constraint`,
  `update`, `update-historical`, `discrim`, `control`, `recent`.

`check.js` simulates the recency pack at budget 700 and asserts buried markers
are gone and late markers are still in. If that assertion ever fails, the
control is dishonest — stop, don't read an RM win.

## Scoring

Same shape as Ember's, different tokens: pass iff accept-hit AND no reject-hit.
Reject dominates. Accept tokens are required to be *absent from the question
text* (except the in-session control), and generic affirmatives (`yes`) are not
used as accept tokens. That is a known failure mode of substring graders: the
model quotes the user, or says "yes" from world knowledge, and luck looks like
memory.

## Pre-declared verdict bands (two-sided; advisory — the numbers are the artifact)

Declared in `scenario.js` `meta.bands` **before** any live driver run:

- **PASS** — `rm ≥ cold + 0.15` (memory matters) **and** `rm ≥ recency` at equal
  budget **and** `rm ≥ recency` on the hard subset `{update, update-historical,
  discrim}`, where naive recency structurally loses the old/superseded/same-name
  facts.
- **FAIL-DEAD** — `rm ≤ cold + 0.05`: recall isn't firing.
- **FAIL-NOISE** — `rm < recency − 0.05`: RM injects but crowds out good context.
- **SCENARIO-WEAK** (annotation, not a product fail) — recency scores `< 0.5` on
  the `recent` subset. The late plants were not actually in the window; do not
  read an RM win as beating a working control.

The `recent` subset is where recency is *allowed* to beat RM. That is not a
product failure; it is the control earning its keep.

## Running it

```bash
# offline invariants (no LLM, no embedder):
node eval/ab-grok/check.js

# plumbing check, no chat LLM (stub driver echoes the injected memory).
# The RM arm still needs the embedder on :1234.
EMBED_MODEL=text-embedding-nomic-embed-text-v1.5 \
  node eval/ab-grok/run.js --selftest --runs 1

# real run against whatever chat model + embedder are loaded in LM Studio (:1234):
EMBED_MODEL=text-embedding-nomic-embed-text-v1.5 \
  node eval/ab-grok/run.js --model "openai/gpt-oss-20b" --arms cold,recency,rm --runs 5 --budget 700 --field on

EMBED_MODEL=text-embedding-nomic-embed-text-v1.5 \
  node eval/ab-grok/run.js --model "qwythos-9b-claude-mythos-5-1m" --arms cold,recency,rm --runs 5 --budget 700 --field on
```

Needs LM Studio serving a chat model **and** an embedding model at once.
Results land in `eval/ab-grok/results/<model>-<stamp>.{json,md}`. `AB_DEBUG=1`
prints the injected block + answer for every probe.

Flags: `--model`, `--arms`, `--runs`, `--budget`, `--field on|off`, `--temp`,
`--selftest`, `--out`.
