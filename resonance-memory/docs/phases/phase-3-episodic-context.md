# Phase 3 — Episodic working context

**Depends on:** Phase 2 ([[phase-2-retrieval-dynamics]]). **Overlaps:** `RM-06` (session vs.
long-term scoping) — build the scope field here rather than retrofitting. Deep design (reference):
[[0004-scoping]]. **Status:** ⬜ open. Route + status: [[ROADMAP]].

> Buildable, individually testable. A bounded, decaying buffer of recent queries + retrieved
> memories, kept **separate from long-term** and **not permanently written**.

## Build steps
- [ ] **3.1 Context buffer** — recent queries + retrieved memories, bounded, separate from
      long-term, not permanently written.
- [ ] **3.2 Representation** — a temporary context vector; test aggregation strategies; kept
      distinct from durable memory.
- [ ] **3.3 Decay** — lazy, own configurable half-life; stale context must not dominate.
- [ ] **3.4 Context-biased retrieval** ⛔ — contextual relevance as a signal; test topic continuity
      and indirect reference ("that", "it", "the previous one"); log contributions. **Rank entry
      goes through the Phase 2.2 gate.**

## Success / failure metrics — **to be designed for this phase before building**
Pre-declare, specific to episodic context: e.g. success = indirect reference resolved measurably
more often with context on than off, *without* stale context degrading a fresh topic; failure =
context dominating a topic switch, context vectors persisting to disk, or 3.4 touching rank outside
the gate. No blanket metric — design the custom test with the sub-phase.

## Test plan
- [ ] Topic continuity and indirect-reference resolution with context on vs. off.
- [ ] Context decays; never persists to durable memory; never dominates a topic switch.
- [ ] Scope field isolates session from long-term (feeds `RM-06`).

## Exit
Context is a measured, bounded, ephemeral signal. Then [[phase-4-consolidation]].

---

## Related

[[ROADMAP]] · [[phase-2-retrieval-dynamics]] · [[phase-4-consolidation]] · [[0004-scoping]] · [[BACKLOG]] · [[ARCHITECTURE]]
