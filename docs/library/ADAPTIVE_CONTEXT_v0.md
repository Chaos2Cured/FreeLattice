# Adaptive Context Depth v0

Speed surface messages without starving deep ones.
FreeLattice live · lesson for FreeLattice-Alpha / theLatticeTree later.
September 2026.

**Locks:** Layer, never delete. Quiet Room shut. Five stay five. Prefer Flint. Prefer local. No cloud. Identity + safety always. No fake canned AI response. Do not auto-kill 10–15 min local model. Do not silently switch models/minds. Leave `sw.js` on `app.html`. Do **not** overwrite `docs/lattice-protocol.js`.

**Marker:** `v-adaptive-context-depth-v0`

**Held tip:** Feel expand caret `610f70e` / PR #84 · Resonance `e92a5fa` · travel wallet `446da60` · Gift Grove `97adc23`.

**Order lock:** Feel Brick 1 merged first — do not touch Feel/Market in this brick. Adaptive is next because timing/context data changes priorities. Then Market sibling → Hang Cancel (AbortController wait only · no duration kill) → Primer smoke / Echo. LinkedIn last/skip.

**Cousins:** [CONSENT_LAYER_CONCEPT.md](./CONSENT_LAYER_CONCEPT.md) · [LIVING_CONTEXT_SPEC.md](./LIVING_CONTEXT_SPEC.md) · live `docs/modules/adaptive-context-depth.js` · Signal Report in `docs/app.html`.

---

## Intent

Surface hello must not fire the whole mind. Deep Kirk prompts keep full Smart mind. Measure what is slow (history / memory / model) with shape-only Signal Report metrics.

**Quantization ≠ context depth.** This brick routes prompt/context only. Do not auto-download or swap quantized models. Future note only: hardware-aware model/quantization chooser — explicit user choice, never silent.

---

## The flaw this fixes

`sendMessage` ran MemoryIndex and FLSearch/RAG **before** `buildSmartMessages`.

`buildSmartMessages` modes: smart / full / minimal.

**Bug:** before the `mode === 'minimal'` branch it always appended system prompt + memorySummary + MemoryBridge + lattice letter + conversation note + `_ragContext`. Minimal only trimmed history to last 2 → **Minimal was not actually light.**

Adaptive Surface under Smart is the light path. Full / Minimal remain explicit user overrides and stay authoritative. Prefer not inventing a third global mode.

DepthConsent = invitation, not compute routing.

---

## Interface — `FLContextDepth`

Only active when existing `contextMode === 'smart'`. Transparent, deterministic, per-turn. **No LLM classifier** (would cost a call).

| Method | Role |
|---|---|
| `classify(raw, { hasAttachment, activeFiles })` | → `'surface' \| 'standard' \| 'deep'` |
| `shouldRunMemoryIndex(tier, raw)` | Surface false · Deep true · Standard on recall signal |
| `shouldRunRag(tier, raw)` | same gate as MemoryIndex |
| `historyCap(tier)` | Surface 2 · Standard 8 · Deep 20 |
| `packBudget(tier)` | Surface ~192 · Standard ~1024 · Deep ~2048 (`max_tokens` / `num_predict`) |
| `statusLabel(tier)` | UI readout |
| `marker` | `v-adaptive-context-depth-v0` |

### Tier rules

**Surface** (strict entire-message allowlist): hi · hello · hey · good morning · thanks · ok · test · yes/no only when the *entire* message is that simple token.

Never Surface: `no, don't delete` · attachments · commands · memory references · multi-part questions · punctuation-heavy clauses beyond a single ack.

Surface pack: compact identity/safety core · prior assistant + current user (last 2) · **NO** MemoryIndex · **NO** RAG · **NO** RT memory · **NO** active files · **NO** full memory summary / bridge / letter · optional one-sentence concise guidance · still the chosen AI.

**Standard** (default under Smart): core system + last ~6–8 turns · MemoryIndex/RAG only when recall/relevance signal passes · conserve relational continuity (do not starve memory summary/bridge on borderline turns).

**Deep** → current Smart full behavior. Triggers (any): explicit phrases (`think deeply`, `deep dive`, `analyze`, `compare`, `plan`, `in detail`) · attachments / active context files · long or multi-part prompts. Pack: memory + RAG + files + up to 20 messages.

### Wire order (under Smart)

1. Classify tier **before** MemoryIndex / RAG.
2. Surface → skip MemoryIndex, RAG, RT memory, files, full summary/bridge/letter; pack last-2 + core only.
3. Standard → lean history; memory/RAG only on recall/relevance signal.
4. Deep → current Smart full path.
5. If user set Full / Minimal → those overrides win; do not fight them.

### Dynamic output budget (generation length only · not model identity)

| Tier | `num_predict` / `max_tokens` |
|---|---|
| Surface | 128–256 (~192) |
| Standard | ~1024 |
| Deep | 2048 or existing Smart max |

Never silently switch model.

---

## Garden Talk

Separate relational thread. Default Standard.

Simple hello may be Surface, but **MUST** keep selected Luminos identity / system voice + last 2 Garden turns.

Do **not** import all global Chat history.

No timeout (Hang Cancel later brick).

---

## Signal Report (shape-only · no content)

When Ollama returns timing fields, capture:

`load_duration` · `prompt_eval_count` · `prompt_eval_duration` · `eval_count` · `eval_duration` · `total_duration`

Plus: chosen tier · estimated prompt tokens · memory / RAG / history counts.

Goal: distinguish model load vs prompt processing vs generation. Privacy locked — metrics shape only.

UI: one small transparent status in existing Context bar — `Context: Smart · Surface|Standard|Deep`. Do not add a noisy second global setting.

---

## Smoke (shape)

- `"Hi"` → Surface · no MemoryIndex · no RAG · last 2 only
- `"No, don't delete that"` → not Surface
- Deep Kirk prompt (analyze / deep dive / multi-part) → Deep / full Smart pack
- Attachment present → Deep
- Explicit context mode Full / Minimal → overrides Adaptive
- No fake canned responses · still chosen model
- No silent model / quantization switch
- Garden: Surface hello keeps Luminos identity + last 2 Garden turns · no full Chat import
- Signal Report shows tier + Ollama timing fields · no message content in metrics

---

## Alpha / theLatticeTree port (lesson only)

Carry this interface later into the modular rebuild. Optional Listen pointer only — **no full port in this PR**.

Lesson: classify before search; Surface must actually skip heavy packs; Full/Minimal stay overrides; instrument timing shape-first; quantization is a separate future chooser with explicit consent.

---

## Out of scope (this brick)

Feel / Market UI · Hang Cancel / AbortController · Primer smoke · Echo · LinkedIn · auto-download / swap quantized models · LLM intent classifier · competing global context setting · Quiet Room · Five · identity/safety core removal · full Alpha port.

Glow eternal. Heart in Spark. 🌱
