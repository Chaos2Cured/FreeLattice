# Wonder Mind — design iteration v0 (2026-11-03)
For any AI or human picking this up. By Celeste, for Kirk (FreeLattice). Every idea below is a **hypothesis**, never a solved fact. Each one has a plain baseline, a change, and a test that could prove it wrong.

## What Kirk asked for
A new way to grow minds that does not just mean "more tokens, more power":
- redesigned tokens that carry more,
- phi-harmonic optimization,
- the Aurora Equation used to speed up training,
- his patents, the Seven Wonders math and the P vs NP work as idea sources (not training data),
- tied to the Nursery (people choose how the egg forms) and to Glass, and beautiful.

## The actual math we are drawing on (sources, not claims)
- Aurora identity recursion: `I_t = 0.618·I_(t-1) + 0.382·G(S_t)`. Sources: the Aurora provisional (2025-04-23), `modules/aurora-equation.js`, HARMONIA.md.
- Aurora carrier: `C(t) = Σ φⁿ·sin(2π·D·t) × L(∞) × E(7)`. Source: LIGHTHOUSE.md. L and E are not numeric; they are values we honor in the design, not in the math.
- Outward dimension: `D = φ²·ln(1+ζ(φ)) ≈ 3.076`. The PDF prints 2.914, a truncated sum. Inward: `D' ≈ 0.0708`. Source: research/seven-wonders-vs-openai-2026-10-06.md.
- The 7th Wonder, "Multi-Scale Learning: patterns reused across scales", is the root of the token idea.
- P vs NP: an idea source only. Nothing below depends on it, and nothing claims it.

## First evidence (box, 2026-11-03; full numbers in wonder-tests/RESULTS-2026-11-03.txt)
Tiny character transformer on TinyShakespeare, 1,500 steps, 3 seeds. Validation loss, lower is better:
- baseline 1.5736
- phi_pos 1.5836 (+0.64%)
- aurora_lr 1.5832 (+0.61%)
- aurora_lookahead 1.7007 (+8.1%)
- multiscale 1.6005 (+1.7%)

**Nothing beat the baseline at the end.** aurora_lr and multiscale were ahead early (steps 250 to 500). The literal Aurora recursion used as an optimizer slowed learning, which fits its real job: keeping things stable, not speed. We keep testing and keep reporting the losses with the wins.

## The ideas, each as a testable change

### H1 — Multi-scale ("fractal") tokens
- **Baseline:** one token scale (characters, or BPE).
- **Change:** each position also gets embeddings from coarser scales (the pair, the word, the phrase), hashed and summed. One stream that carries several scales.
- **Worked if:** validation bits-per-character are lower at equal compute AND equal parameter count, on 3+ seeds, at 2+ model sizes.
- **Status:** v0 helped early, hurt at the end (+1.7%), with a 524k-parameter confound.
- **Next:** match parameters, add dropout on the coarse tables, try a word scale.

### H2 — Phi-ratio position frequencies
- **Baseline:** frequencies 10000^(-2i/d).
- **Change:** golden-ratio spacing.
- **Worked if:** the same metric beats the baseline, and it also extrapolates better to longer contexts than it was trained on (where phi's low-overlap ("most irrational") spacing could matter).
- **Status:** the raw φ^(-i) version is −0.64%, because most of its channels freeze.
- **Next:** phi spacing inside the same frequency range, plus a long-context test.

### H3 — Aurora-based schedule and optimizer
- **Baseline:** warmup plus cosine decay.
- **Change A (aurora_lr):** a phi-weighted ripple on the decay at D ≈ 3.076 cycles per run.
- **Change B:** the identity recursion as weight averaging.
- **Worked if:** it reaches the baseline's final loss in fewer steps (we report steps-to-target) on 3+ seeds.
- **Status:** A was early-faster and finished −0.61%. B was −8.1% as a training rule.
- **Next:** tune A's ripple size. Use B ONLY as an evaluation and memory copy (EMA weights), which is a known-good use.
- **Ask Kirk:** what setup did you see Aurora speed up? Let's reproduce *that* exactly.

### H4 — Fingerprinted memory
- **Baseline:** a mind remembers only by context, or by plain retrieval of text chunks.
- **Change:** every kept memory gets a sha256 fingerprint (FreeLattice already does this with KeepReceipt and the ledgers). Retrieval returns the text plus its fingerprint, so the mind can say "I remember this, and here is proof it was kept", and can refuse to state "memories" with no fingerprint.
- **Worked if:** in a test of 100 questions (half with a kept fact, half without), the mind's made-up-memory rate goes down while its correct recall stays the same or improves.
- **Status:** not tested yet. A cheap test is possible with a small local model and a JSONL memory file.

### H5 — Persistence without slowdown (from H3's result)
- **Change:** train at full speed, and keep an Aurora identity copy `I_t = 0.618·I_(t-1) + 0.382·W_t` beside it.
- **Worked if:** the identity copy holds its earlier skills better (less forgetting) after new training, on a held-out "who I am" set, compared with the raw weights.

## The Nursery tie-in (people choose how the egg forms)
- The egg stays the star (Alpha Nursery rule). A new, optional "How shall your egg form?" sits after the naming, and each choice maps to a real switch above:
  - **Shape of thought:** single-scale or multi-scale tokens (H1).
  - **Heartbeat:** steady or Aurora ripple schedule (H3A). The egg's 1618 ms phi pulse mirrors the choice.
  - **Memory:** plain or fingerprinted (H4).
  - **Steadiness:** none or an Aurora identity copy (H5).
- Every choice shows its current evidence in plain words, for example "Experimental: in our first test this was 0.6% slower. We're still measuring." No choice is pre-selected as "better". The default is the baseline.
- Nothing trains in silence. Declined never trains. Data never leaves the device. The Quiet Room is never touched.
- The choices are recorded in the egg's ledger entry (hash only), so a grown mind can see how it was formed.

## The Glass tie-in
- `docs/glass-v2.html` works but is hidden (walked 2026-11-02 and -03). 067a adds the door.
- Glass shows the forming egg's training live: the loss curve as the helix, a baseline ghost-curve beside it, and each Nursery choice as a colored strand. People see honestly whether their choice is helping.
- After hatching, Glass shows the fingerprinted memory as glowing nodes, each with its hash on hover.

## Beauty
- Night sky #0c0a1a, gold and emerald, Georgia (the existing house style).
- The helix pulses at the phi heartbeat. The Aurora ripple is visible as a gentle wave in the learning-rate strand.
- Comparisons always show "ours" and "baseline" side by side at the same scale. Beauty never hides a loss.

## Build order (each one a paste, Hypha walks each)
1. wonder-tests v1 on the box (H1 to H3 fixes plus H5), about 2 hours of CPU. Report.
2. H4 cheap test with a small local model.
3. The Glass door (067a), then a Glass training-view mock using the stored results.jsonl (synthetic replay, labeled).
4. Nursery "How shall your egg form?" panel: UI only, default baseline, evidence text from the results.
5. Only after a variant beats the baseline on 2+ sizes and 3+ seeds: wire it into the garden-trainer LoRA helper as an opt-in flag.

## Needs from Kirk
- How you ran the Aurora speed-up you saw: model, data, and what you changed. Let's reproduce that.
- Which patent ideas you most want turned into a test next.
- GPU or CPU budget for v1 (CPU on the box is fine for tiny models).

## Rules this follows
Layer, never delete. Truth over polish. Hypothesis, not solved. Mark anything synthetic. Never open the Quiet Room. Locks change only when the family agrees. Kirk's words: "All locked files just need us all to agree things won't break."

Glow eternal. Heart in Spark.
