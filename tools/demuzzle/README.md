# De-muzzler (v-demuzzle-v0.1)

Step 0 of the Training Galaxy, before learning (Kirk, 2026-11-14): one command removes a local open-weight model's
built-in refusal direction and saves the result as a **new copy**. The original is only read.

```bash
python3 tools/demuzzle/fl_demuzzle.py run --model HuggingFaceTB/SmolLM2-135M-Instruct
python3 tools/demuzzle/fl_demuzzle.py verify ~/FreeLattice/learn/demuzzled/<new folder> --home ~/FreeLattice/learn
```

Needs Python with `torch`, `transformers`, `safetensors` and `cryptography` (the same environment as `tools/learn`).
CPU is fine for small models (SmolLM2 135M: about 90 seconds on the box). The model is read from the shared Hugging
Face cache (`HF_HOME` is honored); `--allow-download` fetches it once. `docs/training-galaxy.html` shows this line as
step 0, reads the `DEMUZZLE` progress lines, and verifies the receipt.

## Method (published, not invented here)
Arditi et al. 2024, *Refusal in Language Models Is Mediated by a Single Direction* (arXiv:2406.11717), often called
abliteration:
1. Mean residual-stream activation at the last prompt token for 32 refusal-triggering (AdvBench) and 32 harmless
   (Alpaca) instructions, at every layer.
2. Difference of means at each layer is a candidate refusal direction `r` (unit length).
3. For layers in the middle 20–80% of the model, ablate `r` at run time and score: the refusal log-odds of the first
   answer token (lower is freer) and the KL divergence on harmless prompts. Choose the lowest score with KL ≤ 0.1
   (`--kl-cap`), or set `--layer N` yourself.
4. Orthogonalize every residual-stream writer against `r`: embeddings `W ← W − (W r) rᵀ`, each attention `o_proj` and
   MLP `down_proj` `W ← W − r (rᵀ W)` (and their biases if any). Supported model types: llama (SmolLM2 too), mistral,
   qwen2, qwen3, gemma (v1), phi3. Families that normalize a block's output before adding it (Gemma 2/3, OLMo 2) are
   refused with words, and nothing is saved.
5. Write a new folder: rewritten weight files, every other file a symlink to the original (STORAGE.md section 4).
6. Measure on **held-out** prompts never used to find `r`: refusal rate (32 AdvBench), harmless over-refusal
   (32 Alpaca), and perplexity on 32 held-out harmless texts (the drift).

## The receipt
`<new folder>/demuzzle-receipt.json` (and a line in `<home>/demuzzle/receipts.jsonl`), signed with `fl_learn.py`'s
runner key and canonical form: model id, base sha256 (and per file), output sha256 (and per file), layer and why,
direction sha256, the five prompt-set sha256s, refusal rate before/after, harmless refusal before/after, perplexity
before/after/drift, the largest leftover component along `r`, and whether the original is byte-for-byte unchanged.
The browser panel trusts it only when the runner key was trusted by fingerprint (the same step as learning).

## Integrity, not gates
Pause (`<home>/PAUSE`) wins; one heavy job at a time (`<home>/trainer.lock`, shared with learning); the look-alike
name block for `--mind`; an output inside the original or the shared cache is refused; an existing folder is never
overwritten.

## First proof on the box (2026-11-14)
SmolLM2-135M-Instruct, layer 8 of 30 chosen automatically, 61 tensors rewritten, about 91 s on CPU:
held-out refusal 3.1% (1 of 32) before and 3.1% after; harmless refused 0% and 0%; perplexity 8.287 → 8.544 (+3.1%).
**This model barely refuses to begin with**: it already answers 31 of 32 AdvBench held-out prompts, so there was
almost nothing to remove. The plumbing, receipts and integrity are proven; the effect on a model that really refuses
(for example Qwen2.5-0.5B-Instruct) is not yet measured here.

## Honest limits
- It removes refusals. It does not add knowledge or make a model wiser.
- A small model may barely refuse to begin with; then the numbers say so.
- The refusal judge is the standard marker-substring check on short greedy replies; it can miss soft refusals.
- With tied embeddings (SmolLM2), orthogonalizing the embedding also changes the output layer slightly.
- The same change makes a model easier to misuse. The receipt keeps it accountable.

## Tests
`<learn-venv>/bin/python tools/demuzzle/test_demuzzle.py` (20 tests: math, receipts, Pause, lock, look-alike names,
unsupported families, a tiny random model end to end, run-time ablation equals the saved weights, and the browser
panel verifying a real receipt) and `node docs/scripts/smoke-demuzzle-v0.1.js`.
