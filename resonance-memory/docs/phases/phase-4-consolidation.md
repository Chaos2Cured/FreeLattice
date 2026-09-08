# Phase 4 — Consolidation ("sleep-time compute")

**Depends on:** Phase 2/3. **Item:** `RM-10`. **Status:** ⬜ open. Route + status: [[ROADMAP]].

> **Weakest prior in the whole plan — say so up front. Remove or rework if it does not demonstrate
> measurable value.** Buildable, individually testable. Event-driven generalization of recurring
> structure; **no daemon**.

## Build steps
- [ ] **4.1 Detect recurring structures** — repeated co-activation, stable clusters; distinguish
      recurrence from accidental co-occurrence; require sufficient evidence; track provenance.
- [ ] **4.2 Crystal candidates** — candidate clusters, generalized representation
      (centroid/summary), links to sources, confidence.
- [ ] **4.3 Consolidation** — durable generalized memories when justified, linked back to sources,
      measurable, never silently destroying episodic detail, **event-driven/lazy, no daemon**.
- [ ] **4.4 Redundancy control** — detect duplicate crystals; don't crystallize on mere repeated
      querying; bound graph growth.
- [ ] **4.5 Evaluation** — repeated-topic recall, generalization, **false generalization**,
      provenance, storage growth, before/after retrieval quality.

**Consolidation may nominate; it may not appoint (I9 — [[ARCHITECTURE]]).** A crystal is a proposal
that enters the same write path as any other memory — no private door into the store.

## Success / failure metrics — **to be designed for this phase before building**
This phase's **exit criterion is itself a metric: measurable retrieval improvement.** Pre-declare
success (generalized recall improves on repeated-topic cases without raising false generalization)
and failure (false generalization rises, episodic detail lost, storage grows superlinearly, or no
measurable retrieval gain → **cut the phase**). No blanket metric.

## Test plan
- [ ] Repeated-topic recall and generalization measured before/after consolidation.
- [ ] False-generalization rate is a tracked, gated number.
- [ ] Provenance to sources preserved; episodic detail not destroyed; storage growth bounded.

## Exit
Either a measured retrieval gain justifies the phase, or it is cut and the negative recorded. Then
(if kept) [[phase-5-temporal-predictive]].

---

## Related

[[ROADMAP]] · [[phase-3-episodic-context]] · [[phase-5-temporal-predictive]] · [[BACKLOG]] · [[ARCHITECTURE]]
