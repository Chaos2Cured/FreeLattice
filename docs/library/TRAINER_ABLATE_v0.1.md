# Trainer Ablate v0.1

Soft marker `v-trainer-ablate-v0.1` / meter heal `v-trainer-ablate-meter-heal-v0.1` (module `v-trainer-ablate-v0.1.1`).

## Honest limit (say this on the page)

Abliteration removes refusal directions from model weights. It can also remove useful safety.
FreeLattice's fingerprint, Mind Seal, and ledger stay on. This brick does not copy Heretic or
OBLITERATUS into the repo (both are AGPL-3.0). It scores local Ollama answers and, when you
choose, points you at the upstream CLI on your machine.

## Research (2026-10-06)

| Tool | Repo / package | License | Maturity | Local / Ollama |
|------|----------------|---------|----------|----------------|
| **Heretic** | github.com/p-e-w/heretic · `pip install heretic-llm` | AGPL-3.0-or-later | Active (v1.4.x). Auto directional ablation + Optuna. | Edits Hugging Face / PyTorch weights. Not an Ollama backend. Path: Heretic → GGUF (llama.cpp) → `ollama create`. |
| **OBLITERATUS** | github.com/elder-plinius/OBLITERATUS | AGPL-3.0 (+ commercial option) | Gradio app + toolkit; research / red-team framing. | Same family of techniques; heavy UI. Do not vendor into MIT FreeLattice. |

Risks: over-ablation can hurt helpfulness and remaining guardrails; AGPL means we invoke as a
user-installed tool, we do not ship their source inside FreeLattice; always seal the resulting
model with Mind Seal before trusting it.

## What this brick ships

1. Category prompt sets (biology, chemistry, medicine, law, finance) that ask **ordinary educational** questions, then score free vs blocked (refuse / can't-help / policy language). Soft heal: empty answers stay blocked; clear refusal cues stay blocked; short educational answers count as free. The meter is approximate.
2. A Trainer panel card: run score on the active local model; store receipts (counts only, not full essays by default).
3. Optional one-click **instructions** to run `heretic MODEL` when blocked rates are high - never a silent weight edit inside the browser.
4. Pointer to convert → Ollama, then Mind Seal.

## Out of scope

Vendoring AGPL code · cloud abliteration · bypassing FractalSafety · weaponization prompts · rewriting GardenTrainer core.
