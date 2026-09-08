# Phase 6 — Rich memory structure

**Depends on:** Phase 5. **Status:** ⬜ open. Route + status: [[ROADMAP]].

> Buildable, individually testable. **Watch I1 hardest here** ([[ARCHITECTURE]] §2): entities and
> events are the phases most likely to leak into the tool surface. They must remain **server-assigned
> from text — the model never names an entity.**

## Build steps
- [ ] **6.1 Entities** — persistent entities distinct from memories; link; track identity across
      memories; test resolution.
- [ ] **6.2 Events** — experiences as events with temporal relations, linked to entities and
      memories, provenance preserved.
- [ ] **6.3 Causal relationships** — causal hypotheses stored **separately** from associations,
      with evidence, uncertainty, source. Correlation is never automatically causation.
- [ ] **6.4 Inhibitory relationships** — negative association / suppression, bounded, tested
      against activation, kept distinct from ordinary similarity.

## Success / failure metrics — **to be designed for this phase before building**
No eval design exists yet. Pre-declare: success = entity resolution accuracy on a labelled set;
causal hypotheses carry calibrated uncertainty and never auto-promote from correlation; failure =
an entity name reaching the tool surface (I1 breach), causation asserted from correlation, or
inhibitory edges bleeding into similarity. **Metrics before code.** No blanket metric.

## Test plan
- [ ] Entity resolution on a labelled set; identity tracked across memories.
- [ ] The model never supplies an entity name — entities are server-assigned from text (I1).
- [ ] Causal stored separately from associative, with uncertainty; correlation ≠ causation.
- [ ] Inhibitory edges bounded and distinct from similarity.

## Exit
Rich structure exists without the model touching the four-verb surface. Then
[[phase-7-reconsolidation]].

---

## Related

[[ROADMAP]] · [[phase-5-temporal-predictive]] · [[phase-7-reconsolidation]] · [[BACKLOG]] · [[ARCHITECTURE]]
