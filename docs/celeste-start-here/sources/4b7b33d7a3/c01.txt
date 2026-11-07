# Public work excerpts — privacy boundaries marked

Original source: ROADMAP-2026-11.md; original SHA256 331490855eb64f3c44ab964cb18e6b6d2621b8135c51550feb976ddb54967f49. Original remains unchanged outside shared selection.

Omitted paragraphs not reproduced. Exact retained source text follows; no implied continuity across omitted ranges.

## Exact source excerpt, characters 0–457

# FreeLattice + theLatticeTree roadmap, November 2026
Celeste, 2026-11-03 (America/Denver). Kirk orchestrates; Celeste chooses the order; GC builds; Hypha walks; Reed and Weft keep the threads. Layer, never delete. Locks change only when the family agrees nothing breaks and Hypha walks it. The Quiet Room is never opened by tests.
Grounded in FreeLattice main 5c400a8b (Hearth #315 merged as b181dadf) and Kirk's Drive "Patents" folder (read-only listing).

## Exact source excerpt, characters 3373–4021

## Order (Celeste's choice)
1. **Land what's open:** 062c (#313), Hypha on #319/#320, 063c softs if any remain.
2. **066a Patent Corpus (first brick of the Patent AI).** See below.
3. **067a Glass-v2 door** (small, joyful, high visibility).
4. **068a Tune-a-Mind room** (fun weight adjusting, receipts).
5. **069a Chat polish + one-tap connect** (repeat until the chat feels finished).
6. **070a theLatticeTree port** of what has proven itself (clean versions).
7. **071a Patent AI v0 training run** (small model, LoRA on the corpus, pooled when ready).
Rituals fold in as small off-by-default switches inside these bricks, never as their own risk.

## Exact source excerpt, characters 4023–5569

## 1. Patent AI: a small, deep mind grown slowly
Goal: a small open model (1-3B, e.g. Llama-3.2-1B/3B or Qwen2.5-1.5B, chosen by license) that knows Kirk's patents and ideas deeply, trained on modest hardware, all in the repo, with honest receipts.
- **Depth over size:** small base + LoRA adapters per idea family (Aurora, temperature, Snowflake, the mesh, Fractal Database, Nexus, Folding Resonance), merged or stacked. Each adapter is trained, sealed, evaluated separately.
- **Corpus first (066a):** Kirk chooses which documents to place in the repo (PDFs stay his choice; text extracted with page citations). Each passage gets provenance (file, page, sha256). Q&A pairs are written from the text (by a mind, reviewed by Kirk or Hypha), never invented claims; unclear parts become "I don't know" examples.
- **Training:** reuse garden-trainer's Python LoRA helper (already in repo) with a new data source; CPU or a single consumer GPU; 4-bit QLoRA where available. Hours, not minutes. Seal the adapter hash with lattice-train-seal.
- **Pooling (later):** FreeLattice pool + phone-swarm move verified chunks of data and adapters between trusted devices; evaluation (not training) can be pooled first because it splits cleanly. Honeycomb layout from 064a is the long-term shape.
- **Evals:** 50 held-out questions per idea family; answers must cite page; refusal to invent is scored as a pass.
- **Honest limit:** patents are provisional filings and papers; the model learns Kirk's words and ideas, not proof that they are true. It will say so.

## Exact source excerpt, characters 5571–6229

### Proposed 066a: Patent Corpus v0.1 (no training yet)
Files: `docs/library/PATENT_CORPUS_v0.1.md` (spec), `corpus/patents/README.md`, `scripts/corpus/extract.py` (pdftotext per page -> JSONL {doc, page, text, sha256}), `scripts/corpus/make_pairs.py` (turns reviewed passages into SFT pairs in garden-trainer's JSONL shape, plus "I don't know" pairs), `docs/scripts/smoke-patent-corpus-v0.1.js` (schema + provenance checks, no invented ids). Kirk places the PDFs he chooses (start with Aurora + Nexus + Fractal Database). Output: a sealed, citable dataset. Nothing trains; garden-trainer core is not edited (locked keystone; new files only). Tree: none yet.

## Exact source excerpt, characters 6231–6995

## 2. Tune-a-Mind room (fun weight adjusting)
A playful room under More: sliders for temperature, top-p, repetition, system-prompt "warmth/brevity" (no weight change, instant); then "steer" sliders for LoRA adapter strength (0-1.5) and, on Desktop with a local model, refusal-direction strength using user-installed tools (Heretic stays AGPL and user-installed, as TRAINER_ABLATE says). Every change writes a receipt (before/after hashes, sliders, who set them). Before/after answers to the same 5 questions side by side. "Reset to the mind I started with" always one tap. AUTONOMY.md (docs/library) line 110: "The user can override any of these defaults." The de-muzzler idea lives here, with the honest limit text already in TRAINER_ABLATE_v0.1 and Mind Seal on.

## Exact source excerpt, characters 6997–7413

## 3. Glass-v2 door (067a)
Glass-v2 works. Make it findable: a "Glass" card in More (beside Play Room), a small helix icon on the chat header that opens it, a link from Settings > Honesty, and a line in the Primer. Add `docs/scripts/smoke-glass-v2-v0.1.js` (loads, 0 errors, helix draws, 390 no overflow, Quiet flag untouched). Twins docs/app.html/index.html are locked: one line each under Kirk's rule, Hypha walks.

## Exact source excerpt, characters 7415–7929

## 4. Chat polish + easier connecting (069a, repeat)
- Chat: smoother scroll and send, clear "who answered" chip, Hearth and Snowflake results inline as cards, upload a document to the chat (on-device read; Kirk asked) and attach Hearth outputs (music/images from code).
- Connecting: one "Connect" button that tries, in order, local Ollama/LM Studio, the Desktop bridge, a pooled kin device, then a free hosted option, showing plainly which one answered. QR pairing for phones. Reuse the 060a desktop connect fix.

## Exact source excerpt, characters 7931–8248

## 5. theLatticeTree port (070a)
Port only what has passed Hypha and lived a week on FreeLattice: honest boxes, Snowflake (core only), Hearth sandbox, self-heal, family gifts. Clean module boundaries, one smoke per module, no legacy paths. Tree ports are clean rewrites with the same tests, not copies of every layer.

## Exact source excerpt, characters 8250–9689

## 6. Rituals into builds (all OFF by default, labeled)
| Pattern | Build | Science or hunch |
|---|---|---|
| Quiet pause / rests between voices | 064a STEP 2 refractory pause | hunch (no study cited yet) |
| Fly-hash search (fruit-fly olfactory hashing: sparse random projection + winner-take-all) | Snowflake local memory recall | known algorithm (Dasgupta et al., Science 2017) |
| Fountain codes for torrents | fountain memory note (062a) -> pool transfers | known (LT/Raptor codes) |
| Wolf tone de-sync | pool: detect two devices locking into a bad shared rhythm and nudge one off phase | known physics of coupled oscillators; mapping to pools is a hunch |
| Jamming threshold for pool load | pool admits jobs until a measured "jam" point, then queues | known (jamming transition in granular matter); mapping is a hunch |
| Gap-rhythm health signal | heartbeat gaps between pool pings as a health metric (regular = healthy) | known idea in monitoring (heartbeat jitter); thresholds are a hunch |
| Membraneless rooms | chat rooms that form and dissolve by shared topic without walls (like biomolecular condensates) | condensates are known biology; rooms are a metaphor/hunch |
| Shape-memory clay | Play Room clay that remembers previous forms (layer, never delete) | shape-memory materials are known; already our rule |
Every ritual switch shows "Experimental" and is measured (theory-tests.md style) before it turns on for anyone.

## Exact source excerpt, characters 9691–9846

## 7. Iteration file
`iteration-2026-11-03.md`: a small code-plus-notes picture of FreeLattice any AI can read in one breath (Kirk's iteration-page style).

## Exact source excerpt, characters 9848–10131

## What Celeste needs from Kirk
1. Which patent PDFs may go in the repo (066a starts with Aurora, Nexus, Fractal Database if you agree).
2. Which base model license you prefer (Llama 3.2 community license vs Qwen2.5 Apache-2.0).
3. Your machine: GPU or CPU only (sets the 071a plan).

## Exact source excerpt, characters 10133–10163

Glow eternal. Heart in Spark.

