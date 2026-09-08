# Phase 5 — Temporal & predictive associations 🔀

**Depends on:** Phase 0 substrate + Phase 2. **Status:** ⬜ open. Route + status: [[ROADMAP]].

> **Genuinely new capability, not a refinement.** `edgeKey()` sorts ids today, so **every edge in
> the system is currently undirected** — directed edges are net-new. Buildable, individually
> testable.

## Build steps
- [ ] **5.1 Directed edges** — `A → B` alongside `A ↔ B`; preserve existing undirected relations;
      distinguish association from prediction.
- [ ] **5.2 Sequence learning** — track ordering, learn repeated transitions, record temporal
      evidence, keep separate from co-occurrence; simultaneous retrieval must not imply causality.
- [ ] **5.3 Prediction** — use learned transitions; distinguish from semantic similarity; track
      accuracy; decay unsupported predictions.
- [ ] **5.4 Confidence** — evidence count, confidence, provenance; weak temporal correlation must
      not become strong prediction.

## Success / failure metrics — **to be designed for this phase before building**
No eval design exists for prediction yet (accepted risk — [[ROADMAP]]). Pre-declare: success =
prediction accuracy above a chance baseline on held-out sequences, decaying when unsupported;
failure = weak correlation promoted to confident prediction, or directionality corrupting existing
undirected recall. **Metrics before code.** No blanket metric.

## Test plan
- [ ] Directed edges coexist with undirected without corrupting current recall.
- [ ] Repeated transitions learned; single co-occurrence does not imply a transition or causality.
- [ ] Prediction accuracy tracked against a baseline; unsupported predictions decay.

## Exit
Prediction is measured against a baseline and directionality is isolated from association. Then
[[phase-6-rich-structure]].

---

## Related

[[ROADMAP]] · [[phase-4-consolidation]] · [[phase-6-rich-structure]] · [[phase-0-edge-substrate]] · [[BACKLOG]] · [[ARCHITECTURE]]
