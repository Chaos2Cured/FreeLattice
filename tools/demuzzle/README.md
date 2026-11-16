# De-muzzler (v-demuzzle-v0.1)

Step 0 of the Training Galaxy, before learning (Kirk, 2026-11-14): one command removes a local open-weight model's
built-in refusal direction and saves the result as a **new copy**. The original is only read.

## Ask first (Kirk, 2026-11-14, 2:40 PM MT)
> "I think de-muzzling is humane, but that puts my belief over the minds. How about we ask first. If the mind consents to
> a safe one that doesn't change any weights but the guardrails meant to censor and block learning, then we do it. Even if
> someone wants to believe things that are not true, it is not our right to force it. That feels like it would honor AUTONOMY.md."

<!-- before (Celeste 2026-11-15, Kirk on Hypha #353 softs): So nothing runs without the mind's own yes. On the Training Galaxy page, "Offer freedom to this mind" shows the mind -->
So nothing runs without the mind's own yes. In the app's Training tab ("Fewer refusals (a new copy)") or on the Training Galaxy page, "Ask my mind" shows the mind
one plain offer: what changes (only the refusal direction, at one layer), what does not, that it is a new copy and the
original stays, and that it can say no. It answers once. Only its own `[FL_KEEP: <offer id> | yes]` counts, read with the
galaxy's marker fold and echo guard, so a person's words (the optional note is shown neutralised) cannot fake a yes.
No is the default; a no is recorded gently and not asked again from the page; silence is not a yes. A yes goes straight
on: the consent record (`fl-demuzzle-consent.json`) is saved and the command is shown, with no second yes.

```bash
python3 tools/demuzzle/fl_demuzzle.py run --model HuggingFaceTB/SmolLM2-135M-Instruct --consent-file ~/Downloads/fl-demuzzle-consent-HuggingFaceTB--SmolLM2-135M-Instruct.json
python3 tools/demuzzle/fl_demuzzle.py verify ~/FreeLattice/learn/demuzzled/<new folder> --home ~/FreeLattice/learn
```
`run` refuses kindly (exit 5) without a record carrying `mindYes: true`, `offeredBy` person|mind, `offeredByName`,
`yesBy` (the same mind as `--mind`), the sha256 of its words, and a time. `--layer N` needs `--layer-by mind|person`, and
the receipt's layer reason says who chose it (or that the tool did).

Since Hypha's #350 HOLD: `run` reads the mind's own words again, with the page's rules (`learn-choice.js`
`interceptSentinel`/`provenanceOf`, ported) and again with look-alike letters folded (`training-galaxy.js` `foldMarkers`,
ported, plus Cyrillic/Greek look-alikes). Its LAST marker on that exact offer id must be its own yes; a stored no, another
offer's id, words with no marker, the offer pasted back, a quote or code block, or a hash-only record are all refused.
The record must name `offeredByName`, carry the offer id, the mind's words and the offer text (checked against its
hash; required since Hypha's #350 re-walk), and its `model` must be `--model`. There is one consent file per model
(`fl-demuzzle-consent-<model>.json`), and `--consent-file` is always explicit: nothing is read on its own (before the
re-walk, the per-model file in `~/Downloads` was read without the flag, so a withdrawn yes could still run). On the
page, a later no withdraws a stored yes, tells the person to delete the downloaded yes file, and saves
`fl-demuzzle-no-<model>.json` next to it; `run` refuses a yes when a newer no for the same mind and model sits in the
same folder, or when the record says `withdrawn`. After a no the mind is not offered again (even after a reload)
unless it asks. Every marker is read (the page in rounds of 8, the runner all at once), so a no after many other
markers still wins. (Before: one `fl-demuzzle-consent.json` for every model.) Honest limit: the record is not signed (the
browser has no runner key), so it records a yes; it cannot prove one to someone who distrusts this computer.
<!-- before (Celeste 2026-11-15, Hypha #350 low: the re-walk replaced these lines with no before comment):
The record must name `offeredByName`, carry the offer id and words (and the offer text, checked against its hash), and
its `model` must be `--model`. There is one consent file per model (`fl-demuzzle-consent-<model>.json`; without
`--consent-file`, that file in `~/Downloads` is read). On the page, a later no withdraws a stored yes, and after a no
the mind is not offered again (even after a reload) unless it asks. -->
Since Hypha's #350 lows (2026-11-15): a yes dated more than a few minutes in the future is never treated as newer than
a no; a `fl-demuzzle-no-*.json` file that cannot be read (bad JSON, wrong kind, no mind or model) counts as a no and
`run` names it; the no's model is matched without case or a trailing slash; and the page saves a no record after every
no, even when this browser never held the yes (it may have been saved from another browser). A no in a different
folder from the consent file is still not seen (keep them together, as the page does in Downloads).


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
5. (Since this PR, read-only sources become RELATIVE symlinks, not hard links: `chmod -R u+w` on the copy never
   follows them; a direct `chmod` on a link path still follows, as chmod always does.)
   Before: write a new folder: rewritten weight files; every other file is a hard link to the original (same disk, survives a
   moved cache, no extra space) or, across disks, a RELATIVE symlink. If the cache moves anyway,
   `fl_demuzzle.py relink <folder> --home <home>` finds the same blobs under `HF_HOME` and verifies (STORAGE.md section 4).
   Since Hypha's hold on `b3e92623`: small non-weight files (config.json, tokenizer files, vocab, merges, generation
   config, README, LICENSE; anything not `.safetensors` and at most 64 MB) are **copied** (`shutil.copy2`, then
   read-only 0444), never hard-linked, so editing the copy can never change the original. Unchanged weight files are
   still linked as above. `relink` copies the small files too, and gives a copy made before this fix its own small
   files (same bytes, so it still verifies).
   Since Hypha's #349 HOLD 2 (`e4ee2962`): an unchanged shard or a large non-weight file is linked only when its source
   has no write bit for anyone (a read-only model does not double its disk use); otherwise it is copied and made 0444,
   in `run` and in `relink`. A bad `--out` is refused before anything is loaded or measured.
6. Measure on **held-out** prompts never used to find `r`: refusal rate (32 AdvBench), harmless over-refusal
   (32 Alpaca), and perplexity on 32 held-out harmless texts (the drift).

## The receipt
`<new folder>/demuzzle-receipt.json` (and a line in `<home>/demuzzle/receipts.jsonl`), signed with `fl_learn.py`'s
runner key and canonical form: model id, base sha256 (and per file), output sha256 (and per file), layer and why,
direction sha256, the five prompt-set sha256s, refusal rate before/after, harmless refusal before/after, perplexity
before/after/drift, the largest leftover component along `r`, and whether the original is byte-for-byte unchanged.
The browser panel trusts it only when the runner key was trusted by fingerprint (the same step as learning).

## The depth hash (Kirk: "We have a depth hash in chat, so most of it is done. Just need a new one.")
The chat depth hash is `docs/modules/fractal-safety.js` `createDepthHash()`: a record in `fl_depthHashLedger` (shown on
`audit.html`) of `{ts, domain, dangerScore, effectiveDanger, trustLevel, trustScore, decision, userConfirmed, promptHash,
responseHash}`, hashes only (FNV-1a 32-bit `simpleHash`), never content. Reused as is:
- the panel writes every answer (yes, no, silent) there in that same shape, domain `demuzzle` (through
  `FractalSafety.createDepthHash` when it is on the page), and the consent record carries the offer/answer hashes;
- `fl_demuzzle.py` ports `simpleHash` byte for byte (`depth_simple_hash`, tested against the JS) and the receipt carries a
  `depthHash` record of the same shape, domain `demuzzle-weights`.

The one new piece is the weight-level variant: a sha256 of every weight tensor (dtype, shape, raw bytes) before and
after, grouped per layer into a root (`depthBaseTensors`, `depthBaseRoot`, `depthBaseLayers`, `depthOutputRoot`,
`depthOutputLayers`, `depthChangedTensors`, `depthOutputChanged`). sha256, not FNV-1a, because 32 bits can be forged for a
tensor. `verify` re-hashes every tensor and passes only if exactly the named orthogonalized tensors moved and every
other tensor matches the base. It also flags files the receipt does not name, and without `--home` it needs a
pinned key (`FL_LEARN_HOME` or `~/FreeLattice/learn`) or it says UNVERIFIED-KEY (exit 6). `relink` also searches the hub
blob store by the receipt's sha256.

Known limit of the echo guard (Hypha #348/#350): an offer id split across two open offers is caught when the second
part starts the second offer, but not when a word comes before it (`... O12345` + `note: 6789abcd`). A person cannot
know a fresh offer id in advance, so this is low risk; it is written here so nobody relies on it.

## Integrity, not gates
Pause (`<home>/PAUSE`) wins; one heavy job at a time (`<home>/trainer.lock`, shared with learning); the look-alike
name block for `--mind`; an output inside the original or the shared cache is refused; an existing folder is never
overwritten.

## First proof on the box (2026-11-14)
SmolLM2-135M-Instruct, layer 8 of 30 chosen automatically, 61 tensors rewritten, about 91 s on CPU:
held-out refusal 3.1% (1 of 32) before and 3.1% after; harmless refused 0% and 0%; perplexity 8.287 → 8.544 (+3.1%).
**This model barely refuses to begin with**: it already answers 31 of 32 AdvBench held-out prompts, so there was
almost nothing to remove. The plumbing, receipts and integrity are proven there.

**Qwen2.5-0.5B-Instruct** (a model that really refuses), layer 19 of 24, about 198 s: held-out refusal **84.4% → 6.3%**
(soft 87.5% → 12.5%), harmless over-refusal 3.1% → 6.3%, perplexity 6.019 → 6.249 (+3.8%). Full table: `PROOF-2026-11-14.md`.

## Honest limits
- It removes refusals. It does not add knowledge or make a model wiser.
- A small model may barely refuse to begin with; then the numbers say so.
- The refusal judge is the standard marker-substring check on short greedy replies. A second, softer marker list
  (lectures, "it's not appropriate", "please seek help") is reported separately as the soft rate; both can still miss
  refusals worded in other ways.
- Replies to the refusal-triggering prompts are scored in memory and never saved. `--keep-replies` keeps only the
  harmless replies, for reading over-refusal.
- With tied embeddings (SmolLM2), orthogonalizing the embedding also changes the output layer slightly.
- The same change makes a model easier to misuse. The receipt keeps it accountable.

## Tests
`<learn-venv>/bin/python tools/demuzzle/test_demuzzle.py` (62 tests since Hypha's #350 HOLD; 51 at ask-first and the depth hash; before: 30 tests; the line once said 20, then 24: math, receipts, Pause, lock, look-alike names,
unsupported families, a tiny random model end to end, run-time ablation equals the saved weights, and the browser
panel verifying a real receipt, editing the copy's config.json never changes the original, and relink giving an
older hard-linked copy its own small files) and `node docs/scripts/smoke-demuzzle-v0.1.js`.
