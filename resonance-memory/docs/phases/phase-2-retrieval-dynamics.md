# Phase 2 — Retrieval & association dynamics

**Depends on:** Phase 1 ([[phase-1-transient-activation]]) for activation as a signal; Phase 0 for
the substrate. **Items:** `RM-05` (fusion), `RM-09` (competition/normalization tuning), `RM-16`
(poisoning defense, a gate). **Status:** ⬜ / ⛔ / 🟡 per sub-phase. Route + status: [[ROADMAP]].
Deep designs (reference): [[0003-hybrid-retrieval]], [[0007-eval-harness]].

> Buildable, individually testable. Keep the signals **independently observable** (semantic ·
> learned · activation · recency · context · salience) — do not collapse them into one opaque
> score. **Tracing ships first and unconditionally**; fusion ships behind a flag, off by default.

---

## Scope

Turn the substrate's separate signals into a *measured* retrieval improvement — or a written-down
negative result. This is the phase that resolves the old "ranking = cosine only" tension, through a
real gate rather than an argument.

## Build steps

### 2.1 Separate signals
- [ ] Keep semantic · learned · activation · recency · context · salience independently observable;
      do not collapse early.

### 2.2 Retrieval scoring & tracing ⛔
- [ ] **Tracing first, unconditionally:** one JSON record per candidate in debug mode
      (`query_id`, `candidate_id`, `semantic`, `hebbian`, `recency`, `activation`, `final_score`).
      Toggle via config/env; off in normal operation; never a production bottleneck.
- [ ] Then **behind a flag, off by default** (`RM-05`, [[0003-hybrid-retrieval]]): evaluate RRF
      *and* multiplicative gating; prefer a model stable across score-scale changes; Hebbian must
      never fully override semantic; **degrade to pure cosine** when field/ledger is unavailable (I3).

### The promotion gate ⛔ — fusion becomes default **only when all four hold**
1. [ ] **A/B win on the golden set** — recall@k + MRR up, false-association + staleness not worse.
       *(Those metrics don't exist yet — 2.5. Building them is a prerequisite of this gate.)*
2. [ ] **2.3 + 2.4 landed** — once learned weight enters rank, rank reinforces what ranked
       (rich-get-richer, hub formation). Competition + normalization are the damping; they exist
       **before** promotion.
3. [ ] **`RM-16` landed** — promotion turns the edge store from discovery cache into answer-shaper;
       the threat changes with it, so the defense ships with it. The threat itself is
       [`0009`](../proposed/0009-edge-threat-model.md) (Phase 0.6): semantic is recomputable,
       a poisoned reinforcement is a durable false memory, and the answers to "what mints /
       raises / bridges / persists an edge" *change* once learned weight enters rank.
       `0009` §7 is the requirement list this gate is checking. `RM-16` is not built in
       Phase 0.
4. [ ] **`DEVELOPERS.md` + `CLAUDE.md` amended in the same PR** with the measurement that earned it.

A failed gate keeps the flag off and writes the negative result down. A measured "no" is a shipped result.

### 2.3 Association competition
- [ ] Neighborhood competition — prevent frequently **co-activated** memories becoming universal
      hubs. *(Not "frequently accessed" — access frequency is telemetry under I2b.)*

### 2.4 Homeostatic normalization 🟡
- [ ] Bound **total** associative strength per neighborhood. *(Per-edge `maxBonus·tanh(w)` bounding
      is shipped; total is missing — per-edge does not prevent a hub with many edges. `RM-09`.)*
- [ ] Ensure normalization does not erase genuinely strong learned relationships.

### 2.5 Retrieval evaluation ✅ 🔀 — **this is `RM-00`; extend, don't rebuild**
Already live: JSONL corpora, contains/excludes scorecard, superseded-surfacing, field ROC/TBR,
golden-set gate, offline/deterministic. Reporting-metric registry (RM-02.a + S1): `recall_at_k`,
`duplicate_rate`, `mrr`. **Still open:** staleness rate, false-association rate, hub-formation.
Anything depending on those (the fusion gate first) needs them built.
- [x] recall@k · duplicate rate (reporting metrics, `eval/metrics.js` registry + `eval/measure.js`;
      not the golden gate).
- [ ] MRR · staleness · false-association rate under fusion · hub-formation metric
      (degree distribution) · retrieval latency as the graph grows · semantic-only vs. fused
      as a standing A/B.
- [x] **Corpus realism** (measured 2026-08-22): corpora were clean (4 within-scenario pairs > 0.75,
      top 0.818) — competition/normalization tuned here are not fitting duplicate bloat; the risk
      runs the other way (real stores carry duplicates until `RM-02`). Duplicate-heavy corpus:
      `eval/corpora/duplicates.jsonl` (RM-02.a). See [[RESULTS]], [[0007-eval-harness]].

## Success metrics
Grounded (build them here, then measure): recall@k, MRR, staleness rate, duplicate rate,
false-association rate, hub-formation degree distribution, retrieval latency vs. graph size. The
**promotion gate is the success test for fusion** — an A/B win on the golden set, or a documented
negative.

## Failure signatures
- Fusion promoted without all four gate conditions met.
- A signal collapsed into rank without its trace observable first.
- Hub formation (a few nodes dominating the degree distribution) after learned weight enters rank.
- Normalization erasing a genuinely strong learned edge.
- Any access-frequency signal appearing in a scoring or prune expression (I2b).

## Test plan
- [ ] Tracing emits a complete per-candidate record with every signal, toggleable, zero-cost when off.
- [ ] A/B harness runs semantic-only vs. fused and reports the delta both ways.
- [ ] Competition test: high-frequency co-activated nodes do not become universal hubs.
- [ ] Normalization test: repeated reinforcement bounded per neighborhood; strong edges survive.
- [ ] Duplicate-heavy corpus added and 2.3/2.4 constants re-checked against it.

## Exit
Fusion has either won the gate (and shipped default with docs amended) or lost it (flag off,
negative written down). Then [[phase-3-episodic-context]].

---

## Related

[[ROADMAP]] · [[phase-0-edge-substrate]] · [[phase-1-transient-activation]] · [[phase-3-episodic-context]] · [[0003-hybrid-retrieval]] · [[0007-eval-harness]] · [[0009-edge-threat-model]] · [[eval/README]] · [[RESULTS]] · [[BACKLOG]] · [[ARCHITECTURE]]
