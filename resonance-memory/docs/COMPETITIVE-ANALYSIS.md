# Competitive analysis — the AI memory layer market

*Compiled July 2026; **repo-state refreshed August 2026** (`v0.2.0`) — the market facts below
are unchanged, but Resonance's own column has moved and the matrix in §5 now reflects what has
actually shipped. Every claim here is sourced; re-verify before quoting numbers publicly,
because this market's published benchmarks are actively disputed (see §4).*

> **What moved since July** (details in the matrix and §6): the **eval harness (`RM-00`)
> shipped** — offline, deterministic, golden-gated, 57 unit tests + a 27/31 recall scorecard —
> so "run it yourself" is now a claim we can make. **Contradiction *detection* (`RM-03` v1,
> cue-gated) shipped** on top of the already-landed temporal metadata (`RM-04`), moving us from
> "applies supersession but can't detect it" to "detects explicit corrections and applies them,
> fuller heuristics still open." **Provenance (`source`) is now seeded in the record schema**
> (the `RM-16` groundwork). The write path (extraction, cosine-banded dedup) and hybrid
> retrieval remain the real open gaps. **RM-07 SQLite is selectable** (slices 1+2a+2b+3;
> [`proposed/0010`](proposed/0010-sqlite-backend.md)): S1 made it a measured GO (JSONL
> cannot load 50k); `node:sqlite` + BLOB + JS cosine; lossless `--export` zip is the
> anti-lock-in path (§6 claim 5) and has shipped. Default switch (slice 4) has shipped:
> new stores are SQLite; existing JSONL auto-migrates on first open.

The goal of this document is not to cheer. It is to answer three questions honestly:

1. What do the paid incumbents actually do that we don't?
2. Where is their moat real, and where is it just funding and marketing?
3. What is the shortest credible path from where Resonance Memory is today to being
   the thing a person picks *instead of* paying $249/mo?

---

## 1. The field

| System | License | Hosted price | Local/self-host | Core idea |
|---|---|---|---|---|
| **Mem0** | Apache 2.0 core | Free (10K adds) → $19 → $79 → **$249** Pro | Yes, mature | LLM extracts facts on write; vector + KV, **graph only on Pro** |
| **Zep / Graphiti** | Graphiti OSS (Apache) | **$25** Flex (graph at every tier) → enterprise | Graphiti yes; **Zep community edition deprecated** | Bi-temporal knowledge graph, edge invalidation |
| **Letta (MemGPT)** | Apache 2.0 | Cloud + OSS | Yes | Agent *self-edits* memory blocks; sleep-time compute |
| **MemOS** | Research/OSS | — | Yes | "Memory OS", strong LOCOMO/LongMemEval numbers |
| **Supermemory / Cognee / EverMind / Hindsight** | Mixed OSS | Varies; Hindsight ships all features at every tier | Yes | Consolidation-focused, graph retrieval |
| **VEKTOR / OMEGA / Mnemosyne / memory-mcp** | OSS | Free | Yes, local-first | SQLite + `sqlite-vec` + FTS5, MCP-native, no cloud |
| **Resonance Memory** | **AGPL-3.0** | **$0** | Local-only by design | kNN associative field + **Hebbian co-activation reshaping** |

### What the incumbents actually give you

**Mem0** — the market leader by mindshare (58.4K GitHub stars as of June 2026). Its
defining feature is *automatic extraction*: you feed it raw conversation, an LLM pass pulls
out structured facts, preferences and relationships, and it stores those instead of
transcripts. In 2026 they moved to **single-pass ADD-only extraction** — one LLM call to
extract, with conflict resolution deferred to retrieval time or handled async — which cut
write-time LLM calls 60–70%. That is a direct admission that *write-time conflict resolution
is the expensive, hard part*, and it is worth internalizing before we build ours.

**Zep/Graphiti** — the technically deepest. A **bi-temporal** knowledge graph: every fact
carries both *valid time* (when it was true in the world) and *ingestion/transaction time*
(when the system learned it), tracked as four timestamps (`t_valid`, `t_invalid`,
`t'_created`, `t'_expired`). When a new fact contradicts an old one over an overlapping
window, Graphiti **invalidates rather than deletes** — it sets the old edge's `t_invalid` to
the new edge's `t_valid`, producing a non-overlapping validity chain and preserving history.
This is the single most-copyable good idea in the market and it does **not** require a graph
database to implement (see `proposed/0002`).

**Letta** — memory as an OS. Three tiers (core / recall / archival) and the agent edits its
own memory via tool calls. **Sleep-time compute** is their sharpest idea: agents reflect on
history during idle periods and consolidate memories asynchronously, improving both latency
and memory quality. We can steal the *shape* of this (idle-time consolidation) without the
agent-framework baggage.

---

## 2. Where the moat is real

Be honest — three of these are genuine:

1. **Extraction quality under messy input.** Anyone can write an extraction prompt. Making
   it not-worse-than-nothing across thousands of real, weird conversations takes evaluation
   data and iteration. This is the gap the user correctly identified: *"the difference between
   'it has a conflict handler' and 'the conflict handler rarely makes things worse.'"*
2. **Distribution → failure-mode knowledge.** Incumbents see the long tail of how people and
   models actually abuse the tools. That's information, not code, and we can't shortcut it.
   Mitigation: ship telemetry that is **local-only and opt-in**, plus a public eval corpus so
   contributors can report failures reproducibly.
3. **Coherence at scale over time.** A prototype that handles one contradiction is easy. One
   that stays coherent after *hundreds* of updates is a different artifact. This is why the
   eval harness (`proposed/0007`) must land **before** the clever features, not after.

## 3. Where the moat is *not* real

1. **Graph memory is not worth $249/mo.** Mem0 locks graph memory to Pro — a 13× jump from
   the $19 Starter — and the $19→$249 cliff is the single most-cited community frustration on
   HN and developer forums. Zep undercuts this by including the temporal graph at $25. There
   is a large, visibly annoyed population between those price points. **That is our wedge.**
2. **Token costs are a real, documented pain.** Mem0 GitHub issue #2066 documents graph-mode
   costs 15× higher than generation, with 62 photo descriptions taking over an hour to save.
   Every LLM call on the write path is a cost, a latency spike, and a privacy leak. Our
   embed-once-locally design has a **structural** advantage here that no amount of their
   funding erases.
3. **Self-hosting is being quietly de-prioritized.** Zep's community edition is deprecated.
   The hosted tier is where the money is, so the local path rots. We are local-*only*; ours
   can't rot.
4. **"Local-first" alone is not a differentiator anymore.** VEKTOR, OMEGA, Mnemosyne and
   memory-mcp all do local SQLite + embeddings + MCP, and OMEGA claims 95.4% on LongMemEval.
   We must **not** market on "local" alone — it's table stakes now. Our differentiator has to
   be the associative substrate and the zero-terminal UX.

## 4. The benchmark situation is a mess — use it

LOCOMO is the headline benchmark and its numbers are *actively disputed*:

- Zep published **84%**.
- Mem0 responded that Zep included adversarial categories the spec excludes → **58.44%**.
- Zep rebutted that Mem0 misconfigured Zep → corrected **75.14%**, ~10% over Mem0's best.
- Mem0's 2026 algorithm claims **92.5 LOCOMO / 94.4 LongMemEval**.
- MemOS claims best-average across task categories.

Independent observers advise treating *any* single vendor number with caution. Two
takeaways:

- **Do not enter the number war.** Publishing "Resonance scores X on LOCOMO" invites the same
  credibility spiral. 
- **Do compete on reproducibility.** Ship the harness, the corpus, the seeds, and a one-command
  reproduce script. "Run it yourself in 30 seconds on your own machine" is a *better* claim
  than a number, and it's one the hosted vendors structurally cannot match — their eval needs
  their cloud. **This is now real, not aspirational:** `npm run eval` runs offline and
  deterministic (cached embeddings committed, no network, no API key), gates against a golden
  scorecard, and finishes in well under a minute. The reproduce-it-yourself claim is earned.

Also note: **neither LOCOMO nor LongMemEval systematically tests contradictory memories**,
even though conflict resolution is where production systems rot ("memory poisoning"). The
`Supersede` paper (arXiv 2606.27472) exists specifically to diagnose this *memory-update gap*.
That's an under-served evaluation axis where we can lead rather than follow.

---

## 5. Capability gap matrix

Honest scoring of Resonance Memory **today** (`v0.2.0`, August 2026) against the field.
✅ have it · 🟡 partial · ❌ absent.

| Capability | Mem0 | Zep | Letta | **Resonance (today)** | Backlog item |
|---|:--:|:--:|:--:|:--:|---|
| Semantic recall | ✅ | ✅ | ✅ | ✅ | — |
| Embed-once-on-save | ✅ | ✅ | ✅ | ✅ | — |
| Automatic fact extraction on write | ✅ | ✅ | ✅ | ✅ *(Tier 0/1 always-on; Tier 2 LLM opt-in, off by default)* | `RM-01` ✅ |
| Deduplication | ✅ | ✅ | 🟡 | ✅ *(cosine-banded at save + `--dedup-existing` backfill)* | `RM-02` ✅ |
| Contradiction / supersession | 🟡 | ✅ | 🟡 | 🟡 *(v1: detects explicit correction cues + applies it; fuller heuristics open)* | `RM-03` |
| Temporal metadata (valid-from/to) | 🟡 | ✅ | ❌ | ✅ | — |
| Hybrid retrieval (semantic+keyword) | ✅ | ✅ | 🟡 | 🟡 *(keyword only as fallback)* | `RM-05` |
| Graph retrieval | 💰 Pro | ✅ | ❌ | ✅ **free** | — |
| **Hebbian / co-activation reshaping** | ❌ | ❌ | ❌ | ✅ **unique** | `RM-09` |
| Importance decay / pruning | 🟡 | ✅ | 🟡 | 🟡 *(retention signal only)* | `RM-08` |
| Multi-user / agent scoping | ✅ | ✅ | ✅ | ❌ | `RM-06` |
| Session vs long-term separation | ✅ | ✅ | ✅ | ❌ | `RM-06` |
| Idle/sleep-time consolidation | 🟡 | ✅ | ✅ | ❌ | `RM-10` |
| Pluggable store backend | ✅ | ✅ | ✅ | ✅ *(SQLite default, JSONL pin / fail-open / export; [`proposed/0010`](proposed/0010-sqlite-backend.md))* | `RM-07` |
| Lossless export / anti-lock-in | 🟡 | 🟡 | 🟡 | ✅ *( `--export` zip + `--export-jsonl`; a competitor reads `memories.jsonl` without our exe)* | `RM-07` 2b ✅ |
| Eval harness / regression suite | ✅ | ✅ | ✅ | ✅ *(offline, deterministic, golden-gated)* | `RM-00` ✅ |
| Provenance on records (poisoning defense) | 🟡 | 🟡 | 🟡 | 🟡 *(`source` field seeded; recall-weighting + filter open)* | `RM-16` |
| SDKs | ✅ | ✅ | ✅ | ❌ | `RM-12` |
| Hosted option | ✅ | ✅ | ✅ | ❌ *(deliberate)* | — |
| Zero-terminal install | ❌ | ❌ | ❌ | ✅ **unique** | — |
| Runs with no API key / no cloud | 🟡 | ❌ | 🟡 | ✅ | — |
| Copyleft (forks stay open) | ❌ | ❌ | ❌ | ✅ | — |

**Reading the matrix (August 2026):** we are competitive on *substrate* and *distribution UX*,
and the **evaluation** gap has closed — `RM-00` shipped, so every claim from here on is
measurable and the regression gate is live. Temporal metadata (`RM-04`) is in, and `RM-03` v1
now *detects* explicit corrections rather than only applying supersession blindly. What remains
behind is first-class hybrid retrieval (`RM-05`, keyword is still fallback-only)
and the store/scale work (`RM-07`). Automatic fact extraction (`RM-01`) is done:
Tier 0/1 met the 0.9 precision bar on `eval/messy`; Tier 2 is opt-in, off by
default, degrade-safe, and measured on `eval/messy-hard` (see `eval/RESULTS.md`).
Cosine-banded dedup (`RM-02`) is done: save-time bands (`RM-02.b`) plus `--dedup-existing`
backfill (`RM-02.c`) both take `duplicate_rate` 0.3182 → 0.0000 on `eval/duplicates` with
`recall@5` held at 1.0.
That is exactly the ordering the roadmap encodes: measurement first (done), then the write
path, then the substrate tuning our moat depends on.

---

## 6. Positioning

> **Resonance Memory is the memory layer that costs nothing, sends nothing, and remembers
> like a mind instead of a filing cabinet.**

Three claims we can defend, and should lead with:

1. **$0 forever, graph included.** Everything Mem0 gates behind $249 is in the free download.
2. **Nothing leaves the machine.** Not a privacy policy — an architecture. No API key exists to leak.
3. **Association, not just retrieval.** The Hebbian field is genuinely not in any competitor.
   Memories reinforce each other through use; recall surfaces a *neighborhood*, not a list.
4. **Reproducible, not benchmarked.** *(Newly earned, August 2026.)* The eval harness ships in
   the repo and runs offline in under a minute — no cloud, no API key. "Verify our claims on
   your own machine" is a claim the hosted vendors structurally cannot match, and it sidesteps
   the LOCOMO number war entirely (§4).
5. **You can leave.** *(Shipped, RM-07 slice 2b / [`proposed/0010`](proposed/0010-sqlite-backend.md).)*
   The working copy may be SQLite for speed; the interchange format is the same JSONL RM
   already uses, lossless, as `memories.jsonl` inside a ZIP64 bundle (`--export`) or as a
   raw file (`--export-jsonl`). Copy the `.db` between devices (RM↔RM), or export and
   hand the jsonl to a competing provider. Hosted Mem0/Zep *are* the lock-in — your memory
   lives in their cloud so leaving costs a migration you don't control. Local-only is
   necessary but not sufficient (VEKTOR et al. are local too); **export that a competitor
   can read without our exe** is the anti-hoarding claim, and it is a CLI + panel
   path on purpose (four verbs stay four — a model that can dump the store is an
   exfil path). We do not sanitize the export. The panel button shipped as
   slice 2c; `--import` CLI + panel button are RM-17.

Three claims we must **not** make until earned (updated August 2026):
- ❌ "Beats Mem0 on LOCOMO" — still don't enter the number war (§4). `RM-00` has landed, so we
  *can* now say "here's a harness, run it yourself" — but not "we score X," which invites the
  same credibility spiral.
- 🟡 "Handles contradictions" — **partially earned.** `RM-03` v1 (cue-gated detection) has
  shipped *with* eval coverage and a hard false-supersession gate, so the honest claim today is
  "detects and applies *explicit* corrections, conservatively." The unqualified "handles
  contradictions" waits on the fuller detection heuristics (negation flip, numeric/date change).
- ❌ "Production ready at scale" — unchanged: recall no longer rewrites the store, but every
  *mutation* still rewrites the whole JSONL file and `all()` parses it per call (see `RM-07`).

---

## Sources

- [Mem0 2026 token optimization playbook](https://mem0.ai/blog/the-2026-token-optimization-playbook-cut-ai-agent-memory-costs-3%E2%80%934x)
- [Mem0 state of AI agent memory 2026](https://mem0.ai/blog/state-of-ai-agent-memory-2026)
- [Mem0 alternatives + pricing (Atlan)](https://atlan.com/know/mem0-alternatives/)
- [Zep vs Mem0 (Atlan)](https://atlan.com/know/zep-vs-mem0/)
- [Zep: temporal knowledge graph](https://www.getzep.com/ai-agents/temporal-knowledge-graph/)
- [Zep paper (arXiv 2501.13956)](https://arxiv.org/pdf/2501.13956)
- [Graphiti on Neo4j blog](https://neo4j.com/blog/developer/graphiti-knowledge-graph-memory/)
- [Zep: "Is Mem0 really SOTA?"](https://blog.getzep.com/lies-damn-lies-statistics-is-mem0-really-sota-in-agent-memory/)
- [Corrected LoCoMo claim (getzep/zep-papers#5)](https://github.com/getzep/zep-papers/issues/5)
- [Letta memory blocks](https://www.letta.com/blog/memory-blocks/)
- [Letta agent memory](https://www.letta.com/blog/agent-memory/)
- [Mem0 vs Letta (Vectorize)](https://vectorize.io/articles/mem0-vs-letta)
- [The consolidation problem in agent memory (Hindsight)](https://hindsight.vectorize.io/blog/2026/05/21/agent-memory-consolidation)
- [Supersede: diagnosing the memory-update gap (arXiv 2606.27472)](https://arxiv.org/html/2606.27472v1)
- [LongMemEval-V2 (arXiv 2605.12493)](https://arxiv.org/pdf/2605.12493)
- [Governed shared memory for multi-agent LLM systems (arXiv 2606.24535)](https://arxiv.org/pdf/2606.24535)
- [Hybrid search: BM25, vector & reranking reference 2026](https://www.digitalapplied.com/blog/hybrid-search-bm25-vector-reranking-reference-2026)
- [Understanding reciprocal rank fusion](https://glaforge.dev/posts/2026/02/10/advanced-rag-understanding-reciprocal-rank-fusion-in-hybrid-search/)
- [Memory MCP servers directory](https://mcpservers.org/category/memory)

---

## Related

[[ROADMAP]] · [[README]] · [[BACKLOG]] · [[LICENSING]]
