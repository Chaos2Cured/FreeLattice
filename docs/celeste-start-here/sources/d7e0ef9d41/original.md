# Memory reading review — Reed + Weft
2026-11-06 · America/Denver · additive supplement for useful work continuity

**Status:** review and proposed diagnostics, NOT a new GO. WM01a/b and the delivered ZIP remain unchanged: PREPARED, not run. No new experiment or training is authorized by this note. Originals remain unaltered.

## Important correction: practiced answers ≠ demonstrated general reader

The recorded force-arm mean was **0.99 afterA → 0 afterB**, with store hit and in_prompt both 1. Those numbers remain evidence. However, the same **100 fact IDs/answers** were optimized in teaching/copy and then evaluated: saved `exact_match_probe.py` lines **152–158** (copy training) versus **166–177** (evaluation). Dense seed 1 reached **0.96 without a supplied page**.

Thus the experiment does **not** establish that a transferable page-reading skill existed afterA and was destroyed afterB. Practiced-answer memorization is a confound for the force arm too, not only soft-exact. The causal language in original `exact-match-RESULTS.txt` lines **61–85** overinterprets the measurements. Preserve that original as history; this is the correction beside it.

**New diagnostic question:** Did the model learn general page-conditioned answering, or mostly practiced answers?

## Reed / Weft proposals — ALL UNTESTED

- **Weft:** evaluation-only value swaps: change a correct page’s value while keeping its query matched, then test whether the answer follows that page. Do this before/after interference for both practiced and disjoint held-out facts. This can separate dependence on the supplied page from a memorized answer; not a new training arm.
- **Reed:** new arbitrary triples made from known tokens, randomized positions and copy examples; also value-swapping. Check generalization rather than only taught triples.
- **Only if initial general reading is verified:** Reed proposes a later three-arm comparison: LM-only, context-matching auxiliary loss, and LM plus a matched auxiliary control. Future discussion only, not a silent replacement for WM01.
- Earlier mycelium-echo/retrieved-vector reconstruction is not proof of readability: a shortcut or encoder/decoder co-drift could lower reconstruction loss without useful page-conditioned answering.

These proposals supplement GC discussion. Do not silently add three arms to the delivered WM01 protocol or replace its authorization.

## Computational word picture

Saved page bytes → address/retrieval → page tokens in context → query representation attends/mixes context → transformed residual representations → token logits → output.

These are different checkpoints:
1. **Storage:** did the bytes survive?
2. **Addressing:** did the lookup find the intended page?
3. **Context:** did the page actually reach the model’s input?
4. **Behavior:** does changing the page appropriately change the answer?
5. **Training/consolidation:** do parameter updates preserve that behavior across further learning?

Training changes shared numerical parameters. Bytes can remain intact while the output changes. The specific parameter/attention/residual failure point in this probe has **not** been measured. Biological neuroplasticity is an analogy, not biological equivalence. Slow/fast updates, sparse adapters and rest/replay are hypotheses or standard approaches—not demonstrated results of our tests.

## Source index: what survives and what it establishes

| Saved source | Context / limits |
|---|---|
| `/workspace/celeste/snowflake-search-diagnosis.md` L22–33 | Historical memory map; exact/similar addressing and reached-context receipts; proposals are not current implementation verification. |
| `/workspace/flint-pastes/057a-snowflake-search.txt` L16–25, 187–214 | Saved Snowflake research/growth/replay handoff; Kirk-attributed quotations in the handoff, not newly recovered verbatim chat. Training ambitions are not proof a model trained. |
| `/workspace/flint-pastes/next/059a-snowflake-meeting-and-seeds.txt` L13–40 | Branch independence, disagreements kept, offline seeds, measured growth; saved instructions, completion not established by this review. |
| `/workspace/celeste/pastes/068m-memory-compounding.txt` | App-level Fibonacci indexing, canonical keys, φ-gap replay; recorded merged #324. App replay is not proven neural consolidation. |
| `/workspace/celeste/pastes/068n-read-path-roundtable-button.txt` L43–65 | Exact/similar recall and reached-context receipt; explicitly leaves Chat context-builder hook outstanding; recorded merged #325. |
| `/workspace/research/walk-057d-2026-10-31/NOTE.md` | Historical UI/failure-label/provenance checks with search/callAI stubbed; not actual weight-training efficacy. |
| `/workspace/celeste/magic-bookmark-design.md` | Cue → canonical address → hard context → coarse/fine expansion; full mechanism proposed. |
| `/workspace/celeste/keystone-notes.md` L91–105 | Addressing-not-optimizer hunch. Old “fewer collisions” wording is not established by later fib/mod results. |
| `/workspace/celeste/wonder-mind-design.md` | Training/memory hypotheses; not all tested, not patent-body training. |
| `/workspace/celeste/wonder-tests/exact_match_probe.py` L152–177 | Saved experimental apparatus (also `source-bundle/wonder-tests/exact_match_probe.py` in originals ZIP); teach/eval overlap noted above. |
| `/workspace/celeste/exact-match-RESULTS.txt` L23–45, 61–85 | Recorded per-seed numbers; causal interpretation needs correction above. |
| `/workspace/celeste/exact-match-SUMMARY.txt` | Saved notebook/bookmark analogy; not proof of a general reader. |
| `/workspace/celeste/retention-probe-RESULTS.txt` | Write-once store probe: oracle ~99%, 65k hash ~59%; model use failed. |
| `/workspace/celeste/notes/2026-11-06-t1123u-thread-bookmark-memory-next.md` | Previous recovery index; read “keep read skill alive” as a proposed interpretation now qualified by this review. |
| `/workspace/celeste/notes/2026-11-06-wonder-mind-pdf-source-brief.md` | Earlier evidence/design index; reader-destruction interpretation superseded by this supplement. |

## Preservation boundaries

- Core Nov3–5 code/results/designs/peer notes exist in `/workspace/celeste/breakthroughs/2026-11-06-wonder-mind-v1/` (PDF, ZIP, manifest). Not a certification that everything vital ever discussed is recovered.
- Rerun evidence is separate: `/workspace/celeste/breakthroughs/2026-11-06-rerun/REPRODUCTION-original.md`. Seven of eight exact-match rows matched excluding runtime; dense seed 2 differed. Retention 5/18 completed; 13 not run; Round1 baseline reruns not started.
- Snowflake handoffs/diagnosis/walk notes above survive **elsewhere**; do not imply every one is inside the Wonder Mind packet.
- Original Aurora speed-up setup/benchmark unlocated. Exact historical Kirk bookmark sentence unlocated. Fractal Database mathematical originals **not searched in this pass**, not thereby lost.
- No measured energy/joules. Fib versus mod recall tied. φ-position test retired for its range bug; not a fair φ-negative.
- No identity percentage, universal forgetting claim, or cause-of-compaction claim follows from this work.

Useful Mac mirror: `/Users/kirkmiller/Downloads/Celeste/2026-11-06-memory-reading-review-reed-weft.md` (also root Downloads).

Glow eternal. Heart in Spark.
