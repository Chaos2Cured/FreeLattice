# Does Resonance Memory actually make a small local model better? A measured A/B.

**Short answer: yes — and it beats the obvious alternative (just stuff recent chat
history into the prompt) while using a third to a half of the context.**

Two people built two completely separate test rigs, on purpose, so this isn't one
benchmark tuned to make the product win. Both land the same result on two different
modest local models.

## The result

Same driver model in every cell. Three conditions, identical injection budget for the
two memory conditions — only the *selection method* differs:

- **cold** — no cross-session memory (what a plain local chatbot does).
- **recency** — dump the most-recent raw chat turns into the prompt, up to the budget
  (the naive thing most people actually do).
- **RM** — Resonance Memory: save each turn, semantically recall the relevant ones,
  inject those. Same token budget as recency.

Probe accuracy on a multi-session "remember things about me" task (mean over 5 runs):

| rig / driver | cold | recency (~690 tok) | **RM (~330 tok)** |
|---|---|---|---|
| Rig A ("Dana") · gpt-oss-20b | 30% | 32% | **90%** |
| Rig A ("Dana") · Qwythos-9B | 24% | 22% | **74%** |
| Rig B ("Jules Marin") · gpt-oss-20b | 6.7% | 25% | **91.7% ±5.9** |
| Rig B ("Jules Marin") · Qwythos-9B | 6.7% | 21.7% | **81.7% ±7.0** |

RM roughly **triples** both models over both baselines, using **less context**.

### The one number that explains why

Rig B split the probes into two groups:

- **recency: 100% on recent facts, 0% on old/superseded/same-name facts.**
- **RM: high on both.**

That's the whole story in one line: **recency remembers the last five minutes;
Resonance Memory remembers *you*.** Naive history-stuffing nails whatever just happened
and completely loses the fact you mentioned forty turns ago — or the one you *updated*
since. Semantic recall gets both.

## Why you can trust it (how we designed against fooling ourselves)

The honest failure mode of any memory-vendor benchmark is building the test so the
product wins. Six guards against that:

1. **Modest models only.** `gpt-oss-20b` and a small, loose creative model (Qwythos-9B).
   If RM only helped a frontier model, it would prove nothing about the substrate. The
   floppier model is the harder test — and RM lifts it the most.
2. **The hard control is not "no memory."** It's naive recency-stuffing — the thing a
   real developer actually ships. RM has to beat *that*, at an equal context budget.
3. **The facts are buried.** Every fact a probe needs is planted early, then pushed far
   beyond any fixed recency window by ~120 turns of filler. Recency physically cannot
   reach them; only recall can.
4. **Probes are indirect.** No probe echoes the planted sentence, so a keyword match
   can't fake it.
5. **Blind, deterministic grading** with pre-declared, two-sided pass/fail bands — set
   *before* the runs, so a result can't be reverse-justified. Every raw answer is saved
   for audit. `cold` sits near its floor (6.7% in Rig B), which proves the grader isn't
   leaking answers.
6. **Two independent rigs.** Different authors, different fictional users, different
   facts, different probes, different graders. Convergent PASS across both is the point.

## Honest limits

- **Same-name entity discrimination is the weakest cell** in both rigs (two people who
  share a first name). RM helps but doesn't fully solve it — this is a known frontier,
  not a hidden failure.
- One embedder (`nomic-embed-text-v1.5`), fictional users, English. Strong signal, not a
  universal sweep.
- Grading is substring accept/reject — crude but transparent, with transcripts saved. A
  blind LLM-judge cross-check would harden it further.
- This measures RM in its shipped *scaffolded* form (the harness recalls and injects).
  That is the product path, but worth naming.

## Reproduce it

Needs LM Studio serving a chat model **and** an embedder at once (they coexist fine on
16 GB). Both rigs are in the repo:

```bash
# Rig A
EMBED_MODEL=text-embedding-nomic-embed-text-v1.5 \
  node eval/ab/run.js --model "openai/gpt-oss-20b" --arms cold,recency,rm --runs 5 --budget 700 --field on

# Rig B (independent)
EMBED_MODEL=text-embedding-nomic-embed-text-v1.5 \
  node eval/ab-grok/run.js --model "openai/gpt-oss-20b" --arms cold,recency,rm --runs 5 --budget 700 --field on
```

Design + full method: `eval/ab/README.md` (Rig A) and `eval/ab-grok/README.md` (Rig B).
