# Phase 1 — Transient activation

**Depends on:** Phase 0 ([[phase-0-edge-substrate]]) — needs the persistent edge substrate to
spread over. **Status:** ⬜ open. Route + status: [[ROADMAP]].

> Buildable, individually testable work unit. Ephemeral spreading activation over the edge
> substrate: seeded from retrieval, attenuated per hop, bounded, **never persisted** (I7 —
> [[ARCHITECTURE]] §2). ⛔ Activation may **not** touch rank in this phase — it is observable and
> traced only; rank entry is the Phase 2.2 gate ([[phase-2-retrieval-dynamics]]).

---

## Scope

Give retrieval a short-lived, spreading "what's warm right now" signal computed over the edges
Phase 0 made persistent — without letting it change the answer yet. It exists to be *measured*
against rank before it is ever allowed near rank.

## Build steps

### 1.1 Activation state
- [ ] Ephemeral activation keyed by memory ID in an in-memory `Map`: `id → { value, timestamp }`.
- [ ] Separate from persistent strength; **never persisted** (I7).
- [ ] Cleared on process restart and on soft-prune of the memory. Bound cache size.

### 1.2 Initial activation
- [ ] Seed from semantic retrieval; keep similarity and activation separate internally.
- [ ] Normalization so raw similarity can't create unbounded activation.

### 1.3 Spreading activation
- [ ] Propagate through edges; attenuate per hop; bound depth.
- [ ] Stronger edges transmit more; weak bootstrap edges transmit appropriately little.
- [ ] Pruned edges never participate. Prevent runaway.

### 1.4 Activation decay
- [ ] Lazy/event-driven, timestamped, computed on access (same discipline as Phase 0.2).
- [ ] Persists between MCP calls while the server lives; resets on restart.
- [ ] Can never resurrect a soft-pruned memory.

### 1.5 Tests → see Test plan.

## Success metrics — **to be designed for this phase before building**

Testing is not optional and a blanket pass/fail does not fit this scope. Pre-declare, specific to
activation, before writing 1.3: e.g. *A activating raises B's activation through A↔B; a stronger
edge yields measurably stronger propagation; multi-hop attenuates monotonically.* Wire the
observable into the tracing that Phase 2.2 will consume.

## Failure signatures — **to be designed**, but at minimum
- Any activation value found on disk or in the store schema → I7 violated.
- Activation touching rank in this phase → the ⛔ gate breached.
- Activation resurrecting a soft-pruned memory → prune semantics broken.
- Unbounded/runaway spread → attenuation or depth bound missing.

## Test plan
- [ ] A activates → B receives through A↔B; stronger edge → stronger propagation; multi-hop attenuates.
- [ ] Activation decays; survives between calls; restart clears; prune clears.
- [ ] **Activation never reaches disk.**

## Exit
Activation is observable and traced, provably ephemeral, and provably not affecting rank. Then
[[phase-2-retrieval-dynamics]].

---

## Related

[[ROADMAP]] · [[phase-0-edge-substrate]] · [[phase-2-retrieval-dynamics]] · [[ARCHITECTURE]] · [[BACKLOG]]
