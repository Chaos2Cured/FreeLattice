# Phase 8 — Cognitive integration

**Depends on:** Phases 1–7. **Status:** ⬜ open (the far horizon). Route + status: [[ROADMAP]].

> Buildable, individually testable. The top of the stack — goals, working memory, multi-hop
> reasoning — with the hard line intact: **autonomous cognition lives in the consuming agent, not
> the memory layer** (the MCP boundary — [[ARCHITECTURE]] §1).

## Build steps
- [ ] **8.1 Goals** — goal relevance in retrieval; distinguish "relevant to the query" from
      "relevant to what the system is trying to do"; test goal-conditioned retrieval. ⛔ *rank
      entry via the Phase 2.2 gate.*
- [ ] **8.2 Working memory** — expand episodic context into explicit working memory; track active
      concepts and relevant memories; integrate activation and context.
- [ ] **8.3 Multi-hop reasoning** — controlled traversal, provenance tracked, depth bounded, no
      associative explosion; distinguish discovered relationships from established facts.
- [ ] **8.4 Autonomous behaviour — optional, and probably not.** Only if a consuming system
      actually needs it. Keep the MCP boundary clean.

## Success / failure metrics — **to be designed for this phase before building**
No eval design exists yet. Pre-declare per sub-phase: success = goal-conditioned retrieval measurably
beats query-only on a goal-labelled set; multi-hop stays bounded and provenance-traced; failure =
associative explosion, discovered relationships presented as established facts, or autonomy leaking
into the memory layer across the MCP boundary. **Metrics before code.** No blanket metric.

## Test plan
- [ ] Goal-conditioned retrieval beats query-only on a goal-labelled set (8.1, behind the 2.2 gate).
- [ ] Multi-hop traversal is depth-bounded, provenance-tracked, no explosion.
- [ ] Discovered relationships stay distinguishable from established facts.
- [ ] The MCP boundary holds — no autonomous loop inside the memory layer.

## Exit
The stack is integrated without violating the four verbs or the MCP boundary. End of the planned
substrate track; everything here is **planned, not committed** ([[ROADMAP]]).

---

## Related

[[ROADMAP]] · [[phase-7-reconsolidation]] · [[phase-1-transient-activation]] · [[phase-3-episodic-context]] · [[BACKLOG]] · [[ARCHITECTURE]]
