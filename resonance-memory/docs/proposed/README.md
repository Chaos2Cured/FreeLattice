# Proposed designs

RFC-style design documents. Each one states a problem, a design with real code or pseudocode,
the risks, and acceptance criteria. **Proposed ≠ decided** — these exist to be argued with
before anyone writes the implementation.

| # | Title | Backlog | Status |
|---|---|---|---|
| [0001](0001-write-pipeline.md) | Write pipeline: extraction, guarding, structuring | `RM-01` | **Shipped (RM-01.a+01.b+01.c)** |
| [0002](0002-temporal-supersession.md) | Temporal metadata and supersession | `RM-03`, `RM-04` | **schema shipped** (`RM-04`); logic proposed (`RM-03`) |
| [0003](0003-hybrid-retrieval.md) | Hybrid retrieval (semantic + keyword + graph) via RRF | `RM-05` | proposed ⚠️ |
| [0004](0004-scoping.md) | Scoping: multi-user, multi-agent, session vs long-term | `RM-06` | proposed |
| [0005](0005-store-abstraction.md) | Store abstraction and the SQLite backend | `RM-07` | proposed (`store.js` seam extracted; backend decision in [0010](0010-sqlite-backend.md)) |
| [0006](0006-constraints-decay-pruning.md) | Soft constraints, *importance* decay, pruning | `RM-08` | proposed — **scope likely much smaller than written**; measure first. *Substrate-level (learned-edge) decay moved to [`phase-0`](../phases/phase-0-edge-substrate.md).* |
| [0007](0007-eval-harness.md) | The evaluation harness | `RM-00` | proposed |
| [0009](0009-edge-threat-model.md) | Edge-substrate threat-model sketch | `RM-16` (feeds; does not build) | **sketch** — Phase 0.6. Implementation stays gated to Phase 2 / the 2.2 promotion gate |
| [0010](0010-sqlite-backend.md) | SQLite backend behind the Store seam | `RM-07` | **slice 1 shipped** (selectable `SqliteStore`) · **slice 2a shipped** (streaming JSONL→SQLite migrator) · **slice 2b shipped** (sovereignty zip) · **slice 2c shipped** (panel export button) · **slice 3 shipped** (RM-00 golden = JSONL 27/31 case-for-case) · **slice 4 shipped** (SQLite default; auto-migrate on first open; fail-open to JSONL). `node:sqlite` + BLOB + JS cosine; no sqlite-vec |
| [0011](0011-dream-consolidation.md) | Dream consolidation: the Grimoire, the dreamer, the soak | `RM-10`, `RM-15` (`RM-09` consumes the sim; W-03 / W-04 are prerequisites) | **proposed** (design frozen 2026-09-05 — source of truth for the Phase 4 build). Measurement slices next (4.0 / 4.0b / 4.0c). No dream mutation until those numbers are in. |

> **Phase specs live in [`../phases/`](../phases/), not here.** These `proposed/` docs are RFC-style
> *rationale* — reference material a phase links to. The edge-substrate design that was drafted here
> as `0008` graduated to [`phase-0`](../phases/phase-0-edge-substrate.md) (the canonical build spec
> for roadmap Phase 0). `0009` is the Phase 0.6 on-paper threat model of that substrate; it does
> not implement `RM-16`. **`0011` is the frozen Phase 4 design** (the Grimoire, the dreamer, the soak);
> [`phase-4`](../phases/phase-4-consolidation.md) remains the checklist. `0011` is the mechanism.

⚠️ **0003 touches a ratified invariant** (`ranking = cosine only`) and proposes a specific,
measured process for amending it. Read that section before implementing anything in it.

**0011 is the frozen Phase 4 design.** Argue with it by amending the RFC, not by implementing
a different dream. Measurement slices (4.0 / 4.0b / 4.0c) first; no dream mutation until those
numbers are in. It does not repeal [0009](0009-edge-threat-model.md) — the poison cap moves
from the learning bit onto the consumers.

## Reading order

If you're picking this up cold:

1. **[0007](0007-eval-harness.md)** — why measurement comes first, and what it measures.
2. **[0006](0006-constraints-decay-pruning.md)** — read this second even though it's late in
   the numbering. Its opening records three drafts that argued against behaviour the code
   already had, and why most of the design below it is probably unnecessary. It is the
   clearest warning in the repo about trusting a design doc over the source.
3. **[0002](0002-temporal-supersession.md)** — the headline capability gap vs Zep. The schema
   half **shipped**; what's left is `RM-03`, deciding *when* one fact supersedes another.
4. **[0001](0001-write-pipeline.md)** — how facts get cleaned before they're stored.
5. **[0005](0005-store-abstraction.md)** — the storage seam. The data-loss half of what this
   doc describes is **fixed** (see [`../BUGS.md`](../BUGS.md) `BUG-001`/`BUG-002`); the
   remaining O(N) parse/rewrite is what SQLite is for. **[0010](0010-sqlite-backend.md)** is
   the measured backend: `node:sqlite` in the SEA, BLOB + JS cosine, lossless JSONL
   export. Spike: [`spike/rm-07-sqlite/`](../../spike/rm-07-sqlite/).
6. **[0003](0003-hybrid-retrieval.md)** — the one with an invariant fight in it.
7. **[`phase-0`](../phases/phase-0-edge-substrate.md)** *(in `phases/`, not here)* — unify
   `field.js` and `ledger.js` into one persistent edge store with two signals
   (semantic = derived, learned = source-of-truth). Where `I6` became true (0.2).
   **Phase 0 exit is met** (0.6); next is [`phase-1`](../phases/phase-1-transient-activation.md).
8. **[0009](0009-edge-threat-model.md)** — what can mint an edge, raise Hebbian, steer a
   rescue bridge, or survive indefinitely. The load-bearing property: semantic
   recomputes, a poisoned reinforcement is a durable false memory. Carry-forward
   requirements for `RM-16` at the Phase 2.2 gate.
9. **[0011](0011-dream-consolidation.md)** — Phase 4 frozen: learning vs presentation,
   the 0009 three-window poison split, four operations, the Grimoire, fade = I6,
   `--dreamer` safety, the 4.0b / 4.0c measurement slices. Does not repeal 0009;
   the poison cap moves from the learning bit onto the consumers.

## Conventions

- **Four verbs, always.** If a design needs a fifth MCP tool, the design is wrong. Capability
  lives in the substrate; the interface may get simpler, never more demanding.
- **No unmeasured signal touches rank.** Anything affecting retrieval order ships behind a
  flag, off by default, until it wins on the golden set.
- **Nothing on the critical path requires a cloud.** LLM assistance is optional, local, and
  degrades silently.
- **Negative results are deliverables.** "We tried it and it lost" written down is worth more
  than an untested idea left open.

---

## Related

[[ROADMAP]] · [[ARCHITECTURE]] · [[BACKLOG]] · [[0001-write-pipeline]] · [[0002-temporal-supersession]] · [[0003-hybrid-retrieval]] · [[0004-scoping]] · [[0005-store-abstraction]] · [[0006-constraints-decay-pruning]] · [[0007-eval-harness]] · [[0009-edge-threat-model]] · [[0010-sqlite-backend]] · [[0011-dream-consolidation]] · [[phase-0-edge-substrate]] · [[phase-2-retrieval-dynamics]] · [[phase-4-consolidation]]
