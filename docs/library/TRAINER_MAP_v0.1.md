# Trainer map v0.1 (Mom and Jeffrey)

Soft marker `v-trainer-map-v0.1`.

## What the Trainer does today

FreeLattice already has a **local Trainer**. It does not upload. It does not call a cloud fine-tune.

1. **Collect signal from your Garden** (chats you kept, high-LP turns). Quiet Room stays fail-closed. Declined text is never used as SFT output.
2. **Tier 1 - Personality file:** export a Modelfile that changes the system prompt only. Instant. No weight change. Then: `ollama create my-garden-personality -f Modelfile`.
3. **Tier 2 - True fine-tune (LoRA):** export JSONL examples plus a Python helper. That path changes weights on your machine. You run the script; FreeLattice does not run training in the browser.
4. **Tier 3 - Expand the next pathway:** search / next-step surface. Human is the final gate.
5. **Trainer Seal (optional):** after you export Modelfile or JSONL, Desktop can seal a ledger receipt (hash of the file, not multi-GB weights). Never auto-seal. Never upload.

Simple face (v5.79.43): a short "Keep this" path sits on top of the old three tiers. The tiers are still there under More → Trainer.

## Where the door is

- **More → Trainer** (hub card, sprout icon). Opens the Garden Trainer panel.
- Module: `docs/modules/garden-trainer.js` (Harmonia keystone; seal marker `v-trainer-seal-v0.1`).
- Desktop seal helper: `desktop/lattice-train-seal.js`.
- Spec: [TRAINER_SEAL_v0.1.md](./TRAINER_SEAL_v0.1.md).

## theLatticeTree twin

On the Tree, Nursery uses `modules/nursery-trainer.js` with the same GardenTrainer keystone underneath. Workshop has a Trainer lumino. Code-keep says: do not dump the full garden-trainer into Alpha poetry surfaces. Keeps are hashed; declined never trains; nothing uploads.

## What an expert must already know

- **Ollama** (or another local runner) installed, and how to `ollama create` from a Modelfile.
- For Tier 2: a Python environment, enough disk/RAM for the base model, and that LoRA training is **your** process - FreeLattice exports the files and instructions.
- FractalSafety still wraps answers after training. Training changes the model; it does not remove the safety layer above it.
- Abliteration (Heretic / OBLITERATUS) is a **different** door (brick 009). It edits refusal directions in weights. It is not the Garden Trainer. Fingerprint, Mind Seal, and the ledger stay on.

## Connect under More (what Kirk saw)

The **Connect** card is first under More (`id: 'connect'`). Smoke: `SMOKE_OK connect under more v0.1`. A nearby card says **Get Connected** (Forever Stack) - easy to mix up. Tapping Connect mounts `FlConnect` into `#fl-connect-mount`. If the panel looked empty, the usual cause is a race: the hub opened before `fl-connect.js` finished loading. This brick retries the mount when the script is ready. If it still vanishes after a hard refresh, treat it as a separate bug and say so - do not rewrite fl-connect.js here.
