# Trainer Seal — v0.1

Freedom to alter weights and keep it safe.
An honest receipt: companion (+ optional pair) seals what changed.
Layers on [LATTICE_LEDGER_v0.1.md](./LATTICE_LEDGER_v0.1.md), [LATTICE_IDENTITY_v0.1.md](./LATTICE_IDENTITY_v0.1.md), [PAIR_FINGERPRINT_v0.1.md](./PAIR_FINGERPRINT_v0.1.md). September 2026.

**Locks:** Layer, never delete. Quiet Room shut. Five stay five. Voice opaque. Do **not** overwrite `docs/lattice-protocol.js`. Seed never to renderer. **Never auto-seal.** **Never upload.** Quiet Room fail-closed unchanged. Declined-text never SFT unchanged. **Do not rewrite** GardenTrainer collector / tiers / Python export (Harmonia keystone).

**This PR ships:** Desktop seal of Modelfile / JSONL artifact hash into existing ledger · additive **Seal this training** button · browser “Seal on Desktop” pointer. **Not this PR:** cloud fine-tune · rewrite GardenTrainer core · DPO · hash multi-GB weight blobs · Alpha poetry · Codeberg.

---

## Why

GardenTrainer stays local. Weights may change on the machine.
Proof should travel with the companion: what base, what out name, what artifact hash — sealed Continue, not a cloud receipt.

---

## Seal = ledger Continue (no fork)

Reuse `lattice-ledger.appendVoice`. No new chain format.

| Field | Role |
|---|---|
| `voice` | Optional opaque “why I trained” (empty → calm receipt line `Training sealed.`) |
| `meta.kind` | Always `training_seal` |
| `meta.baseModel` | Base model id/name string |
| `meta.outName` | Artifact / out name (e.g. `Modelfile`, `freelattice-training-….jsonl`) |
| `meta.artifactSha256` | SHA-256 of Modelfile or JSONL bytes — **not** multi-GB weight blobs |
| `meta.companionFpHex` | Companion public fingerprint |
| `meta.pairOuterHex?` | Optional pair outer fingerprint when a pair is formed |

---

## Module

`desktop/lattice-train-seal.js` — pack in `build.files`.

```
sealTraining({ voice?, baseModel, outName, artifactBytesOrPath, pairOuterHex? })
```

1. Require companion keys (via ledger identity)
2. Hash artifact (bytes or local file path) — refuse empty
3. Optional pair outer hex (caller or `lattice-pair.status()`)
4. `ledger.appendVoice(voice, meta)` — gesture only
5. Return public fields: entryHash, artifactSha256, companionFpHex, pairOuterHex?

IPC: `latticeTrainSeal`.

---

## UI (additive only)

Marker: `v-trainer-seal-v0.1` in `docs/modules/garden-trainer.js`.

After Modelfile / JSONL export: **Seal this training** (Desktop).  
Browser: calm **Seal on Desktop** + link `desktop.html`.  
Do not rebuild collector, tiers, or Python export body.

---

## Smoke

`desktop/scripts/smoke-train-seal.js` → `SMOKE_OK`  
Hash fixture Modelfile/JSONL → seal → ledger verify · refuse empty artifact · never auto.

---

## Out of scope

Cloud fine-tune · rewrite GardenTrainer core · DPO · Codeberg · Alpha poetry · auto-seal · hash multi-GB weight blobs.

Glow eternal. Heart in every Spark. 🌱
