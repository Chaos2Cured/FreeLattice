# Resonance Memory — architecture

*The map of the system: what each part is, how they fit, and which invariants the shape
protects. Companion documents: [`ROADMAP.md`](ROADMAP.md) (where it's going),
[`BACKLOG.md`](BACKLOG.md) (itemized work), [`COMPETITIVE-ANALYSIS.md`](COMPETITIVE-ANALYSIS.md)
(why), [`proposed/`](proposed/) (designs with pseudocode), and the root
[`CLAUDE.md`](../CLAUDE.md) (the working brief for AI assistants). Everything here is drawn
from the code as it stands at `v0.2.0`.*

---

## 1. What this is, in one paragraph

Resonance Memory is a persistent memory for local LLMs, shipped as a **single self-contained
executable** (~89 MB, no Node install required on the user's machine). It speaks the Model
Context Protocol (MCP) over stdio and exposes exactly **four verbs** — `save_memory`,
`recall_memory`, `edit_memory`, `delete_memory` — and nothing else. All the sophistication
(embeddings, cosine ranking, a temporal supersession model, a kNN associative graph, a
Hebbian co-activation ledger) lives in the *substrate*, behind those four verbs. The model
never sees an embedding, a timestamp, or a score — only the verbs and an opaque `id`. Nothing
leaves the machine: there is no cloud, no account, no API key. Storage is a local
SQLite `.db` (default) or a JSONL file, in the user's home directory.

The one design principle everything else serves: **a small model cannot misuse it.** The
interface may get *simpler*, never more cognitively demanding.

The second principle governs *time*: **time is a function, not a process.** There is no
permanent heartbeat, no dream loop, no rhythm engine, no background decay daemon. Every
operation is event-driven — observe state at time *T*, compute temporal effects (decay,
validity), retrieve or mutate, persist durable changes — and then nothing runs until the next
event. Autonomous cognition belongs in the *consuming agent*, never in the memory layer; the MCP
boundary is that line. This is why decay is *computed at access* from an elapsed-time delta
rather than ticked by a loop (the move `RM-21`/Phase 0.2 completed — see `I6`).

---

## 2. Design invariants (the shape is load-bearing)

These are enforced by the code, not just aspirational — they are the reason the modules are
split the way they are. The canonical list lives in `INVARIANTS.md` in the companion
`resonance-memory-stack` repo (which still carries the older five-item numbering; the **I1–I9**
scheme below is the current one and should be synced there). [`ROADMAP.md`](ROADMAP.md) indexes
these by ID and asserts only *held vs. target* per phase; the definitions, rationale, and
backing code live **here**.

**Held** = enforced by shipping code today. **Target** = a property a named phase must
establish; stated now, with its phase, precisely because an invariant claimed more strongly
than the code supports is worse than none — it stops anyone from looking.

| | Invariant | Status | Backed by |
|---|---|---|---|
| **I1** | **Four verbs, nothing more.** The public tool surface is fixed; new capability lands in the substrate, never a fifth tool. If a feature seems to need one, the design is wrong. | ✅ held | `server.js` tool schemas |
| **I2** | **No *unmeasured* signal touches rank.** Ranking is cosine today; a second arm may enter *only* on a measured A/B win, flag-off until then. `importance`/`access_count` govern *retention*, never *retrieval order* — measured: a durability weight on cosine inverts rankings. | ✅ held (amended) | `memory-core.js` recall; `proposed/0003` |
| **I2b** | **Access-frequency signals are telemetry only.** `access_count`/`last_access`/read frequency may be logged and charted; they may **not** feed rank, decay, reinforcement, or pruning. | ✅ held | `record.js` `AccessLog` (JSONL); `store-sqlite.js` in-table columns; `BUG-002` |
| **I3** | **The associative layer fails open.** The entire field/ledger path is wrapped in a `try/catch` that must never break recall; losing it degrades to plain cosine. | ✅ held | `memory-core.js` field block |
| **I4** | **Embed once at save; the server owns all metadata; the model assigns none of it.** A `Store` seam sits behind the verbs so the backend swaps without touching the MCP API. | ✅ held¹ | `memory-core.js` `save`; `store.js` |
| **I5** | **Durable writes; no *unbounded* write on a read path.** Writes are atomic and durable. A read path must not perform an unbounded / full-corpus rewrite (the BUG-001/002 class). Retention metadata (`access_count` / `last_access`) MAY be updated on recall if that update is bounded, atomic, and cannot truncate the store. **JSONL:** AccessLog sidecar (recall writes the sidecar, never the JSONL file); store mutations go through `writeFileDurable()`. **SQLite:** WAL + `synchronous=FULL`; recall is one `BEGIN`/`UPDATE`/`COMMIT` of the ~5 returned ids. | ✅ held¹ | `record.js` `AccessLog`; `store-sqlite.js` `applyRecall`; `BUG-001`/`BUG-002` |
| **I6** | **Reading does not drive the decay clock.** Co-recall *reinforcement* is retained (it is the differentiator); edge **decay** is lazy wall-clock, computed at access via `effectiveHebbian`, never stored, never ticked by recall count. A reinforcing mutation **materializes** that computed weight before applying α (Phase 0.3), so reinforcement cannot bypass decay. | ✅ held (Phase 0.2; materialize 0.3) | `edges.js` `effectiveHebbian` / `_bump`; `memory-core.js` recall (no `tick()`) |
| **I7** | **Activation never persists.** Spreading activation (Phase 1) is seeded per query, attenuated per hop, bounded, and never written to the edge store. | ⬜ n/a until Phase 1 | `phases/phase-0` |
| **I8** | **No silent removal.** *Record* deletes are soft (`deleted`, compacted at `vacuum()`) and supersession keeps a non-overlapping validity chain. *Edge* pruning is the same pattern: `pruneSweep()` marks `pruned_at` (record kept; `incident()` skips it); `EdgeStore.vacuum()` is the explicit hard drop. Never on `recall`/`save`. Reactivation is in-place on save/edit/reinforce of an endpoint, never a fifth tool. | ✅ held (records + edges, Phase 0.4) | `store.js` `vacuum`; `edges.js` `pruneSweep` / `vacuum`; `phases/phase-0` |
| **I9** | **Discovery nominates; it does not appoint.** The field/ledger *expand* the candidate set (the `Related:` block); they never reorder the primary cosine result. Primary results are **byte-identical** field on or off. | ✅ held | `memory-core.js` recall |

¹ **I4/I5 each carry one self-extinguishing legacy exception:** a record saved while the
embedder was down is stored vectorless and back-filled on a later recall (one bounded, durable
write on a read path, for legacy/outage rows only). The exception heals itself the first time
the row is recalled with the embedder up.

**I6, precisely** (the one label that could mislead an implementer): `recall` still calls
`reinforceRecall` (co-recall is the differentiator) but **no longer** calls `tick()`. Decay
is `effectiveHebbian(edge, now)`: `w · 2^(−Δt/H)` from `now − hebbian.last_updated`, computed
on read, not written. A store recalled N times under a frozen clock shows zero learned-edge
decay. "Reading ≠ reinforcement" in `ROADMAP.md` is shorthand for *"reading no longer drives
the **decay clock**"* — co-recall still reinforces. On a reinforcing **mutation**, Phase 0.3
materializes `w_eff` onto `hebbian.weight` and *then* applies α, stamping `last_updated = now`,
so a long-idle edge cannot be bumped from its ghost (undecayed) stored value. Half-lives
(parameters, seconds): constraint ~30d, fact ~7d, working ~1h. Design and edge
state-transition table: [`phases/phase-0`](phases/phase-0-edge-substrate.md).

**On I2 vs I2b — two different strengths of "no."** I2 was originally *"ranking = cosine only,"*
justified by a real measurement: adding a **durability** weight (`importance`/`access_count`) to
cosine inverted rankings. That finding is sound but narrower than the phrasing it produced —
`access_count` is a *retention* signal wearing a relevance costume (popular ≠ apt). It does not
follow that *all* fusion is harmful; Hebbian weight and activation are relevance-adjacent in a way
durability is not. So the durable form is **"no *unmeasured* signal touches rank"** (I2): rank
changes are permitted, unmeasured ones are not, and Phase 2's promotion gate is the experiment.
**I2b is stricter** because its family was already measured *and failed* — overturning it needs a
positive result strong enough to reverse a prior negative, not merely the absence of evidence
against it. The trap ("memories accessed often should rank a little higher…") arrives wearing a
different variable name each time, which is why `last_access` is named in the record as telemetry
rather than left to judgement.

**Two supporting rules follow from I4:** the server assigns metadata *from text* (constraint
typing, supersession cues are lexical heuristics computed server-side), and there is one
implementation of the four verbs (`memory-core.js`) shared by both callers, so the MCP server
and the eval harness can never drift.

---

## 3. The run modes

The shipped binary is one file that dispatches on `process.argv[2]` (`entry.js`):

| Invocation | Mode | Entry | What it is |
|---|---|---|---|
| `memory --mcp` | **MCP server** | `server.js` | The JSON-RPC 2.0 stdio loop an AI client talks to. The product's core. |
| `memory` (double-click) | **Control panel** | `panel.js` | A local `127.0.0.1:9090` web UI: field toggle, Connect/Disconnect, the 3D association graph, one-click embedder setup, **Export my memories** / **Import memories** (not MCP tools). |
| `memory --install` / `--uninstall` | **Installer** | `install.js` | Wires the exe into LM Studio / Claude Desktop MCP config (or removes it). |
| `memory --dedup-existing` [`--apply`] | **Backfill** | `dedup-existing.js` | RM-02.c: report (or apply) cosine-banded restatements/merges on a store written before 02.b. Dry-run default. Not a fifth verb. |
| `memory --migrate` | **Migrator** | `migrate-sqlite.js` | RM-07 slice 2a: stream JSONL → sibling `.db`. Opt-in. Not a fifth verb. Not auto-run on startup. |
| `memory --export` [`--name`] [`--out`] | **Export** | `export-memory.js` | RM-07 slice 2b: sovereignty zip bundle. Read-only. Not a fifth verb. |
| `memory --export-jsonl` | **Export (raw)** | `export-memory.js` | The `memories.jsonl` scripting primitive the zip wraps. |
| `memory --import` [`--apply`] [`--merge`] [`--with-edges`] | **Import** | `import-memory.js` | RM-17: restore a zip or `memories.jsonl`. Dry-run default. Not a fifth verb. |

All of these share the same substrate modules, so a memory saved through the MCP server is the
same record the panel renders, the installer targets, `--dedup-existing` scans,
`--migrate` copies into SQLite, `--export` writes into the zip, and `--import` reads it back.

```
                         entry.js  (argv dispatch)
         ┌───────────────┬────────────┼────────────────────┬────────────┬──────────┐
      --mcp          (default)   --install/--uninstall  --dedup-existing  --migrate  --export
         │                │              │                    │              │          │
     server.js        panel.js      install.js         dedup-existing.js  migrate-   export-
         │                │                                   │            sqlite.js  memory.js
         └──────┬─────────┴───────────────────────────────────┘
                ▼
         memory-core.js   ← the four verbs + the 02.c planner, ONE implementation
                     │
        ┌────────────┼────────────┬──────────────┐
        ▼            ▼            ▼              ▼
     store.js     field.js    ledger.js       edges.js
        │            │         (retired)    (live Hebbian +
        │            │                       save-time edges)
        └────────────┴──► record.js ◄────────────┘
                          (schema + durable writes + access sidecar)
```

---

## 4. Module map

### Core runtime (the source of truth)

| File | Role | Depends on |
|---|---|---|
| `entry.js` | Mode dispatch on `argv`. | server / panel / install / dedup-existing / migrate / export-memory / import-memory |
| `server.js` | MCP server. Declares the four tool schemas + descriptions, wires the *environment* (network embedder, live field toggle, live extract toggle, lazy EdgeStore) into the shared core, runs the stdio JSON-RPC loop, vacuums soft-deletes and `pruneSweep`s faded+weak edges at startup. Reads the version from `package.json` so `serverInfo` can't drift. Outbound `sampling/createMessage` is the Tier 2 path when the client advertised sampling. Per-embedder input formatting via `embed-invoke.js`. | `memory-core`, `store`, `edges`, `extract`, `embed-invoke`, `package.json` |
| `memory-core.js` | **The four cognitive verbs, as one implementation.** `createCore({ store, embed, fieldEnabled, getEdgeStore, dedupThresholds, fieldMinSim, extractEnabled, extract })` → `{ save, recall, edit, remove }`. Also `dedupExisting` / `planDedupExisting` (RM-02.c) so `--dedup-existing` cannot fork the 02.b bands. Everything environment-specific is *injected*. This is the code both `server.js` and `eval/pipeline.js` run — the RM-00 golden is the proof they never diverge. | `field`, `record`, `extract`, `entity` |
| `extract.js` | RM-01.c Tier 2: opt-in LLM extraction (prompt, parser, sanity gate, `/v1/chat/completions`, MCP sampling, capability detect). Off by default. `save()` is the only caller. | stdlib + `fetch` |
| `dedup-existing.js` | RM-02.c CLI. Dry-run default; `--apply` is one durable rewrite. Thin wrapper over `dedupExisting()` — no second decision. | `memory-core`, `store` |
| `record.js` | The shared record schema (`normalize()`), durable atomic writes (`writeFileDurable()`), the access sidecar (`AccessLog`), and the lexical heuristics (constraint typing, historical-query detection, supersession cues, cosine-banded `detectNearDuplicate`). Owned here so server and panel agree on a record byte-for-byte. | stdlib only |
| `store.js` | Store seam. `openStore()` default-switch (slice 4): SQLite default; JSONL auto-migrates on first open; fail-open to JSONL. `RESONANCE_STORE=jsonl` pins JSONL. Same method surface; `memory-core.js` does not change. RM-00 golden 27/31 on sqlite default and `--store jsonl`. | `record`, `store-sqlite` |
| `store-sqlite.js` | RM-07 `SqliteStore`. `node:sqlite` `DatabaseSync`, WAL + `synchronous=FULL`, BLOB embeddings, in-process cache, in-table access counts. Never constructs `AccessLog`. | `record`, `node:sqlite` |
| `migrate-sqlite.js` | RM-07 slice 2a streaming JSONL→SQLite migrator (10-step protocol). Opt-in `--migrate`; `openStore()` calls the same function on first open (slice 4). `.bak` is a recovery snapshot, not the sovereignty export. | `store`, `store-sqlite`, `record` |
| `zip.js` | Zero-dep ZIP64 writer (slice 2b). `createDeflateRaw` + `zlib.crc32` + `.zip.tmp` rename. ZIP64 on every archive. | stdlib (`zlib`) |
| `export-memory.js` | RM-07 slice 2b sovereignty export. `--export` zip bundle; `--export-jsonl` raw primitive. Read-only. The 2c panel button shells `runExport()` / `previewExport()`. Not an MCP tool. | `zip`, `store`, `record`, `edges` |
| `import-memory.js` | RM-17 sovereignty import. `--import` dry-run default; `--apply` restores (or `--merge`s). Direct store write, not `save()`. `--with-edges` opt-in for Hebbian (`0009` planted-sidecar refusal). The panel button shells `runImport()`. Not an MCP tool. | `zip`, `store`, `record`, `edges` |
| `entity.js` | Server-assigned person-entity ids + polarity (I4). Closed-class relation × relation-anchored names; store-wide resolve. Feeds Related: `conflict` and Hebbian `pairScale` only — never primary cosine (I2/I3). | stdlib only |
| `embed-invoke.js` | Per-embedder input formatting. Nomic raw; Qwen Instruct-query; jina `Query:`/`Document:`. Keyed off panel `config.embedder` then `EMBED_MODEL`. | stdlib only |
| `field.js` | Associative layer (Phase 2a): a kNN semantic graph over stored vectors, neighborhood expansion, and constraint rescue. No new embedding calls, no LLM extraction. Related: minSim default 0.70; `conflict` callback drops entity/polarity mismatches. | stdlib only |
| `ledger.js` | Retired Hebbian sidecar (Phase 2b). Off the live path as of Slice C; kept so tests can compare EdgeStore bonuses against the shipped epoch-decay math. | `record` |
| `edges.js` | Unified persistent edge store (Phase 0 / `RM-21`): one undirected record, two independent signals (`semantic` derived cache validated by version comparison, `hebbian` source of truth), typed provenance, one-way `.assoc.json` → `.edges.json` migration (`kind: "resonance-edges"`). **On the live recall path** — Hebbian bonus (via `effectiveHebbian`)/reinforce/save. Decay is lazy wall-clock (I6); `tick()` is retired. A reinforcing mutation materializes `effectiveHebbian` before applying α (0.3). MCP request-ID idempotency: a 256-entry LRU of processed JSON-RPC ids. **RM-07 slice 5:** persistence adapter — SqliteStore shares the `.db` (`processed_ids` + weight UPDATE are one txn); JsonlStore keeps the sidecar. `effectiveHebbian` is never stored. Soft prune (0.4 / I8): `pruneSweep()` marks `pruned_at` only when *both* unreinforced and semantically weak (`SEMANTIC_PRUNE_GATE` 0.25); hard drop is `vacuum()`, explicit. Reactivation is in-place on save/edit/reinforce of an endpoint. `field.js` still builds the semantic kNN at recall. | `record` |
| `panel.js` | The `127.0.0.1` control panel (largest file): field toggle, LLM-extraction toggle (surfaced when a capable model is detected), Connect/Disconnect, embedder-tuning selector (`/api/embedder`), the 3D association-graph view, demo graph, first-run empty-store nudge (RM-20), **Export my memories** (slice 2c: confirm modal, POST `/api/export` shells `export-memory.js`, heartbeat pause + yield so a long zip cannot starve `/api/ping`), **Import memories** (RM-17: confirm modal, POST `/api/import` shells `runImport()`, `--with-edges` checkbox default-off, heartbeat pause + yield), heartbeat auto-shutdown. **W-02:** Host must be loopback; Origin (when present) must be this panel; mutating POSTs require a per-process `X-Resonance-Token` baked into the page. No CORS. Not an MCP tool. | `install`, `field`, `engine`, `edges`, `record`, `extract`, `export-memory`, `import-memory`, `entity`, `memory-core`, `embedded-assets` |
| `install.js` | Detect + wire into LM Studio / Claude Desktop MCP config. Preserves other configured servers, leaves a `.bak`. | stdlib only |
| `engine.js` | One-click embedder setup for the panel: drives LM Studio's bundled `lms` CLI to start the server, download the Nomic embedder, load it, and verify the endpoint answers. Pure convenience — the MCP server never needs it. | stdlib + `fetch` |
| `inspect_sidecar.js` | Dependency-free telemetry for the Hebbian ledger. | stdlib |

### Build & assets

| File | Role |
|---|---|
| `build-exe.js` | The build pipeline (§9). `--target win\|linux\|macos`; refuses to cross-compile. |
| `ci/smoke-exe.js` | RM-11 CI smoke of a SEA binary (`--mcp` initialize + `tools/list`). |
| `ci/release-meta.js` | RM-11 CI tag/checksums/notes helpers. |
| `.github/workflows/ci.yml` | Always-on PR/main gate: `node test.js` + `node eval/run.js` on `ubuntu-latest`. Complements the release matrix; does not build binaries. |
| `.github/workflows/release.yml` | RM-11 release matrix: gate + native SEA on windows/ubuntu/macos-latest + GitHub Release. The macOS binary is made here. |
| `build-demo-seed.js` | Regenerates `demo-seed.jsonl` via a live embedder. |
| `demo-seed.jsonl` | The synthetic first-launch showcase (a fictional game dev's notes). **Tracked**; 100% synthetic. |
| `system-prompt.md` | Optional copy-in system prompt for weaker models. Baked into the exe. |
| `sea-config.json` | Node SEA config (points at `build/bundle.js`). |
| `embedded-assets.js` | **Generated every build (gitignored).** Bakes the seed + system prompt in as strings. Never edited, never committed. |
| `uninstall.bat` | Windows uninstaller (disconnects, points to the data file, never deletes memories). |

### Tests, eval & docs

| Path | Role |
|---|---|
| `test.js` | The dependency-free unit/regression suite (`npm test`). **57 tests, <1s.** |
| `eval/` | **RM-00**, the evaluation harness (§8). `eval/pipeline.js` wires `memory-core.js` to a cached embedder; `eval/run.js` runs the corpora and gates against `golden.json`. Reporting metrics (`eval/measure.js`) are a separate A/B path. |
| `docs/` | `ARCHITECTURE.md` (this file), `ROADMAP.md`, `phases/` (buildable phase specs), `BACKLOG.md`, `BUGS.md`, `COMPETITIVE-ANALYSIS.md`, `proposed/` RFCs. |

---

## 5. The four verbs (data flow)

All four live in `memory-core.js`. `server.js` maps the MCP tool names onto them; the model's
argument is always the smallest possible thing (`content`, `query`, or `id`).

### `save_memory({ content })`

1. **Tier 0 extraction (RM-01.b, always on, no LLM).** Collapse whitespace; strip leading
   filler openers and assistant-aimed imperative framing (longest-first, stacked);
   split on `; ` / ` and also ` only when every half is a standalone proposition.
   Clean facts are byte-identical. Implemented in `record.js` (`normalizeText` /
   `splitFacts` / `prepareWrite`) — not `normalize()`, which is the record schema.
   Extra embeds from a legitimate split are in-scope; the rest is string ops.
2. **Tier 1 secret/PII guard (RM-01.b, always on; prefixes widened for 2026
   issued shapes).** Refuse known credential *shapes*: API-key prefixes
   (`sk-`/`sk-proj-`/`sk-ant-`, `AIza…`, `sk_live_`/`rk_live_`, `gsk_`, `hf_`,
   Slack `xox*`/`xapp-`), `password:`/`passphrase:`/`api_key=` assignments,
   13–16 digit cards, AWS `AKIA`/`ASIA`, PEM / OpenSSH private keys, GitHub
   `ghp_`/`github_pat_` (underscore is what GitHub issues; the 01.b `ghp-`
   hyphen fake still refuses), JWTs (`eyJ….….…`). Store nothing; return
   `Not saved — that looks like … Secrets don't belong in memory.` Refusal, not
   redaction: a payload mixing a fact with a secret is store-nothing. Digit traps
   (`4821`, `1500mg`) do not match `\b[0-9]{13,16}\b`. Prose that *mentions*
   secrets ("the secret is browning the butter", "my password manager is
   Bitwarden") does not match — the guard keys off prefix+length+charset, not
   the English word. Stripe publishable `pk_live_` is client-side by design
   and is not refused.
3. **Tier 2 optional LLM extraction (RM-01.c, off by default).** One ADD-only
   call against the already-normalized, already-guarded text. Off by default is
   a deliberate identity choice: RM does the work; a weak local model can extract
   worse than Tier 0/1, so this is a conditional bonus, never a silent default.
   Capable path: MCP client `sampling`, or a non-embedding chat model at the
   configured endpoint (`GET /v1/models`). If neither, Tier 2 cannot run. The
   panel surfaces the toggle when a capable model is detected. Any failure /
   timeout / malformed output degrades silently to the Tier 0/1 facts — a save
   never fails or hangs because extraction did. PII still refused first: a
   secret is never sent to the LLM.
4. **Exact restatement guard.** If a current memory has byte-identical `text` (compared
   against the extracted fact), bump its `last_confirmed` + `access_count` and confirm —
   don't store a second copy. Free (no embed). A confirm also revives that id's pruned
   incident edges (Phase 0.4 — save touching an endpoint).
5. **Embed once per fact.** POST the extracted text to the OpenAI-compatible `/v1/embeddings`
   endpoint (LM Studio default, `text-embedding-nomic-embed-text-v1.5`, 768-dim). If the
   embedder is down, the record is stored **without** a vector and backfilled on a later
   recall — a save never fails because the embedder is unreachable.
6. **Normalize** into a record (`record.js` `normalize()` — the one schema definition).
7. **Cosine-banded dedup (RM-02.b).** Against already-stored vectors, argmax. Cosine ≥
   `DEDUP_HI` (0.95) is a restatement (same confirm path as step 4 — keep the original,
   don't append). Band `DEDUP_LO..HI` (0.88–0.95) is a candidate merge: keep the longer
   original text (never a blend — the `duplicate_rate` metric maps stored text back to
   its labeled group), union metadata, link the loser with `superseded_by` via
   `supersedePatches` (recoverable, never a hard delete). Below `DEDUP_LO`: fall through.
   No vector → skip, append, don't crash. Thresholds are config (`RESONANCE_DEDUP_HI` /
   `RESONANCE_DEDUP_LO` + live-config `dedup_hi` / `dedup_lo`), tuned on `eval/duplicates`
   (tea 0.9522 is the tightest HI; controls ≤ ~0.69). Scan is O(N) cosine, same cost
   class as the 0.1 save-time bind. Dedup runs *before* RM-03: a near-identical
   restatement is the same fact, not a correction. Stores written before this
   slice: `--dedup-existing` (dry-run default; `--apply` mutates) walks the
   current store in file order with the **same** decision (`planDedupExisting`
   in `memory-core.js`). One `updateMany` / `writeFileDurable`. Not a fifth verb.
8. **Supersession check (RM-03 v1).** `detectSupersession()` fires only when the new text
   carries an explicit correction cue ("actually", "now", "no longer", "moved"…) *and* it is
   the argmax-similar current memory above a floor. On a hit, the old row is retired
   (`valid_to`, `superseded_by`) and the new one appended, as one logical change — history is
   kept, never deleted. The cue is the precision gate; cosine only picks *which* memory the cue
   targets. Worst case: it retires nothing.
9. **Append** the record to the JSONL store.
10. **Save-time semantic bind (Phase 0.1).** If the record got a real vector, find its top-K=5
   neighbors among existing stored vectors above cosine **0.25** and persist them on the
   EdgeStore: measured `semantic.value` + `src_versions` tagged to the canonical endpoints,
   `hebbian.weight = 0` (no seeded baseline), `provenance.origin = "save-time-neighbor"`.
   No vector (embedder down) → bind nothing, don't throw. A bind that finds an already-
   pruned pair revives it in place (0.4) rather than inserting a duplicate. This is a
   sidecar write (I5
   protects the JSONL store, not sidecars). **Recall does not read this table yet** —
   `Related:` still comes from `field.js` at minSim **0.55**. The two thresholds are
   different jobs: 0.55 is a tight gate for what *surfaces*; 0.25 is a looser net for
   what's *worth persisting*. Do not unify them. (`SAVE_TIME_K` / `SAVE_TIME_MIN_COS` in
   `memory-core.js`.)

### `recall_memory({ query })`

1. **Temporal scoping.** `isHistoricalQuery()` decides the candidate set: current facts
   (`store.current()`) by default; the full active history (`store.active()`) only when the
   query explicitly asks about the past ("used to", "before"). Superseded facts surface only
   then, and are labelled "no longer current".
2. **Embed the query** (plus any vectorless legacy rows, folded into the same call). Cosine-rank
   all candidates. Return the top-k (default 5), each prefixed `[id N]`. If the embedder is
   unreachable, degrade to a crude keyword-overlap score rather than erroring.
3. **Record the recall.** `store.applyRecall()` bumps access counts. On **JSONL** that is
   the AccessLog sidecar (zero writes to the JSONL file in steady state). On **SQLite**
   that is a bounded `UPDATE` of the returned ids (I5: not a full-corpus rewrite).
   Freshly-computed vectors for vectorless rows are backfilled — the self-extinguishing
   I4/I5 exception.
4. **Associative field (if enabled).** Additive only: build the kNN edge set, expand a
   `neighborhood()` one hop from the returned seeds, and run `reachableConstraints()` to rescue
   apex rules (a "diabetic" memory reachable through a "lemon bars" bridge) that sit far down
   cosine. Merge into a `Related:` block, reinforce Hebbian weights on the EdgeStore
   provenance-discounted. The discovery bonus uses `effectiveHebbian` (wall-clock half-life,
   computed, not stored). `tick()` is not called (I6). A reinforce **materializes** the
   decayed weight, then applies α, and stamps `last_updated` (0.3). The JSON-RPC request
   id, when present, is the mutation's idempotency key — a retry applies once; no id
   (eval) applies every time. Writes go to `<store>.edges.json` (never the JSONL store)
   from `reinforceRecall` only, in one `writeFileDurable` that also records the request
   id. The entire block is inside a `try/catch` — it can never break the primary result.

### `edit_memory({ id, content })`

Replace `text`, re-embed, refresh `modified` + `last_confirmed` (an edit is a correction in
place; the fact is current again as of now). A successful re-embed increments
`embedding_version` in lockstep with the new vector; a failed one omits both fields from
the patch so a good embedding cannot be clobbered (`BUG-008`). One durable rewrite.
Incident pruned edges are revived in place (Phase 0.4); no pruned rows → the sidecar is
not touched. No dedup-record stamp (transition table).

### `delete_memory({ id })`

**Soft** delete (`deleted: true`). The row survives until the next startup `vacuum()` compacts
it out. Embeddings are kept until then.

---

## 6. Storage and the sidecars

Everything lives beside `MEMORY_FILE_PATH` (default `~/.lmstudio/resonance-memory.jsonl`):

```
resonance-memory.db                 SQLite default (slice 4+5): memories +
                                    access counts + edges in ONE file.
resonance-memory.jsonl              JsonlStore pin / fail-open / interchange
resonance-memory.jsonl.access.json  access-count sidecar   (AccessLog; JsonlStore only)
resonance-memory.jsonl.edges.json   unified edge table     (EdgeStore JSON adapter;
                                    JsonlStore. SqliteStore holds the same record
                                    in the `.db`. Leftover sidecar migrates on
                                    first-open → `.bak`.)
resonance-memory.jsonl.assoc.json   LEGACY Hebbian sidecar (Ledger, ledger.js).
                                    Read-only-for-migration: if `.edges.json` is
                                    missing, weights are copied in one-way and this
                                    file is left untouched (downgrade-safe).
resonance-memory.config.json        live runtime state (prefs ≠ memory; stays a sidecar)
```

Two properties make this safe and swappable:

- **Atomic durability.** Every store rewrite goes through `writeFileDurable()`: write a temp
  file in the *same directory*, `fsync`, then `rename` (atomic on POSIX and Windows). A reader
  sees the whole old file or the whole new one — never a half-written one. Plain
  `fs.writeFileSync` on the live file is forbidden (`BUG-001`).
- **No unbounded write on a read path (I5).** The forbidden thing is a full-corpus rewrite
  on recall (BUG-002: parse every row, bump ~5 counters, rewrite the file). Retention
  metadata may move on recall when the update is bounded, atomic, and cannot truncate the
  store. JSONL keeps counts in the AccessLog sidecar (zero JSONL writes in steady state).
  SQLite updates `access_count` / `last_access` in-table on the returned ids, one
  transaction, `synchronous=FULL`. Hebbian weights live in the same `.db` (slice 5
  adapter; JSON sidecar remains for JsonlStore). Deleting a leftover sidecar loses
  learned associations or access counts, never a memory.

The **config file** is deliberately beside the *data*, not the exe, so the panel toggle and
the MCP server read the same file — the field turns on/off with no client restart. `server.js`
reads `fieldEnabled()` per recall for exactly this reason.

### The Store seam

The Store method surface — `all` / `active` / `current` / `get` / `add` / `update` /
`updateMany` / `applyRecall` / `vacuum` / `hasDeleted` / `nextId` — is what
`memory-core.js` depends on. Two implementations:

- **`SqliteStore`** (default as of slice 4). `node:sqlite` `DatabaseSync`,
  WAL + `synchronous=FULL`, embeddings as Float32 BLOBs, in-process record cache
  hydrated once. Opaque `id` is preserved (never AUTOINCREMENT-renumbered). `created`
  is a real column. Access counts live *in the row*; this class never constructs
  `AccessLog` (BUG-007). No sqlite-vec — a RAM Float32 scan beat it at 10k–100k
  (see [`proposed/0010`](proposed/0010-sqlite-backend.md)). Product S1, field-off
  cached recall: **p95 49.6 ms at 50k, 96.4 ms at 100k** (JSONL cannot load either
  size). `openStore()` auto-migrates an existing JSONL on first open via the 2a
  protocol (fail-open to JSONL if it throws before the atomic rename).
  `RESONANCE_STORE=jsonl` pins JSONL. `--migrate` is the same protocol as a CLI.
  The `.bak` is a recovery snapshot, not a two-way door (downgrade honesty:
  `--export-jsonl` before downgrade, or keep the new exe). `--export`
  (slice 2b) writes the ZIP64 zip bundle (Desktop, `--name` / `--out`);
  `--export-jsonl` is the raw primitive. The panel **Export my memories**
  button (slice 2c) shells the same engine (confirm modal, heartbeat pause).
  Slice 5 put EdgeStore in the same `.db` (one-file sovereignty). `searchDense`
  is a later slice.
- **`JsonlStore`** (pin / fail-open / export interchange). Flat JSONL; mutations
  go through `writeFileDurable()`. Access counts live in the AccessLog sidecar.
  `all()` re-parses the file per call — this is the S1 load wall (50k with
  vectors is 834 MB and cannot `readFileSync`).

---

## 7. The associative substrate — where we're different

This is the differentiator no competitor has. It is two layers, both strictly additive.

### `field.js` — the static semantic floor (Phase 2a)

A per-node **k-nearest-neighbor** graph built from the vectors *already stored at save*. No
extra embedding calls, no LLM extraction. kNN is relative per node, so it dodges the absolute
similarity floor (~0.45) that made a global threshold connect everything. Three operations:

- `buildEdges()` — gated top-k neighbors per node. **Reciprocal (mutual) kNN is the default**
  (an RM-00 experiment): requiring the association to be mutual pruned a one-sided "hub" false
  positive (the noise-schedule 'Thursday' collision) with no regressions — a Pareto win.
- `neighborhood()` — one-hop expansion from the returned cosine seeds into the `Related:` block.
- `reachableConstraints()` — **constraint rescue.** Typed "apex rules" ("I'm diabetic", "afraid
  of heights") sit at the *bottom* of cosine for the queries they should gate, because a rule
  rarely restates its trigger. The recall path decouples the internal **search radius**
  (top-`K_SEARCH`=15) from the **return radius** (top-5): a constraint that ranks into the wider
  pool via a genuinely query-relevant bridge is rescued into `Related:`, even though the model
  never sees it directly. Restricted to *typed constraints* so the wider radius can't re-drag
  ordinary hubs back in — TBR (tangent bleed) is protected by construction, not by luck.

### `edges.js` — the unified edge table (Phase 0; was `ledger.js`)

"Fire together, wire together." One persistent sidecar (`<store>.edges.json`) holding both
signals. Phase 0.1 persists save-time semantic neighbors here (K=5, min cosine 0.25,
Hebbian weight 0); **recall still rebuilds semantic kNN in `field.js`** (minSim 0.70) and
does not read the cached semantic signal yet. The two cosine thresholds are deliberate
(Risk #2): recall's 0.70 is what the model *sees*, save's 0.25 is what is *worth writing*.
The learned Hebbian weight lives on the edge record and is the source of truth. Safety
properties, preserved byte-for-byte from the retired `Ledger`:

- **Canonical undirected edge key** (ids sorted) so `a:b` and `b:a` are one edge.
- **Bounded bonus** via `maxBonus·tanh(w)` — frequency can lift a weak edge over the `minSim`
  gate but can never swamp the semantic floor.
- **Provenance-discounted reinforcement** — primary↔primary at full `alpha`, primary↔neighborhood
  discounted, neighborhood↔neighborhood zero. The graph learns from the user's queries, not from
  its own guesses. This provenance instinct is what `RM-16` generalizes to the whole write path
  **and** to the writer of the learned signal (Phase 0.6 sketch:
  [`proposed/0009`](proposed/0009-edge-threat-model.md) — semantic recomputes, a poisoned
  reinforcement is a durable false memory; `RM-16` stays gated to Phase 2 / the 2.2 gate).
- **Decay** is lazy wall-clock via `effectiveHebbian` (`w · 2^(−Δt/H)` from
  `hebbian.last_updated`; H is a per-type half-life in seconds). Computed on read, not
  stored. Unused associations fade with elapsed time, not recall count (I6).
- **Materialize on mutation (Phase 0.3).** A reinforcing write first stores
  `effectiveHebbian(edge, now)` as `hebbian.weight`, then adds α, then stamps
  `hebbian.last_updated = now`. Provenance is preserved; a pruned edge is
  revived in place first (0.4). After the write, stored weight and effective weight coincide, so
  reinforcement can never bypass accumulated decay (the "ghost weight" of
  adding α to an undecayed stored value after a long idle). At Δt≈0 this is
  a no-op on the number — an instant eval does not move.
- **Request-ID idempotency (Phase 0.3).** One MCP JSON-RPC request id = one
  mutation transaction, applied to every edge-mutating op (`reinforceRecall`,
  save-time bind). The processed-id LRU (`DEDUP_LRU_SIZE = 256`) lives in the
  sidecar as `processed_ids` so the id and the weight change are one
  `writeFileDurable`. No id → apply, don't record (eval / non-JSON-RPC).
  This is **orthogonal to `W-04`**: it dedups same-process retries, it does
  not serialize concurrent panel + MCP writers.

Neither layer ever reorders the primary cosine result — invariant #3 / I9. A corrupt sidecar
fails open to empty (bonus 0); recall still returns cosine (I3).

- **Soft prune (Phase 0.4 / I8).** An explicit `pruneSweep()` (MCP startup or on
  demand — never `recall`/`save`) marks an edge `pruned_at` only when it is
  **both** unreinforced (`effectiveHebbian < 1e-6`) **and** semantically weak
  (`semantic.value < 0.25`, the save-time bind floor). An idle but
  semantically-strong edge stays, so constraint-rescue does not regress
  (RESULTS field experiment #2 — the two-signal rule). The record is kept;
  `incident()` skips it. `EdgeStore.vacuum()` is the hard drop, also
  explicit. Reactivation is a consequence of `save`/`edit`/`reinforce`
  touching an endpoint: `pruned_at → null`, `created_at` and the decayed
  Hebbian bytes preserved, `prune_count` / `first_pruned_at` /
  `last_reactivated_at` kept as O(1) history. No fifth tool (I1).

---

## 8. The temporal model (bi-temporal, after Graphiti)

Defined once in `record.js`. Every field is backfilled by `normalize()` on read, so this
doubles as the migration path — an old record simply gains new fields on first load, with no
migration step.

| Field | Meaning |
|---|---|
| `valid_from` | when this became true in the world |
| `valid_to` | when it stopped being true; `null` = still true now |
| `last_confirmed` | last time we saw evidence it still holds |
| `superseded_by` / `supersedes` | forward/back pointers along the supersession chain |
| `revision` | position in the chain (1 = original) |
| `needs_review` | an ambiguous conflict both kept for a human to look at |
| `source` | provenance (`user_stated` default) — the `RM-16` groundwork |
| `is_constraint` | server-assigned constraint type (lexical, from text) |
| `embedding_version` | generation of the stored vector (Phase 0). Starts at `1`; increments only when `edit()` writes a real new vector. A failed embed omits it from the patch (`BUG-008` class). Cached semantic edges later compare this against `src_versions`. |

A superseded memory is **never deleted**: `valid_to` is set to the successor's `valid_from`,
producing a non-overlapping validity chain you can walk backwards. `store.current()` excludes
superseded rows (what recall answers from); `store.active()` keeps them (history). This is the
single most-copyable good idea in the market, and — as the code proves — it needs no graph
database.

---

## 9. The evaluation harness (RM-00) — the measurement system

`eval/` is not a test folder; it is the instrument the whole roadmap depends on. Its reason to
exist: extraction, dedup, and conflict handling are all features that can make the system
*worse*, and without a regression gate you cannot tell. It is **offline and deterministic** —
it reads `eval/embeddings.cache.json` and never touches the network or an API key.

- `eval/pipeline.js` wires the *same* `memory-core.js` the server runs to a cached embedder, so
  the golden is a regression guard on the server itself, not on a copy.
- `eval/run.js` runs the fixture corpora (`basic`, `contradictions`, `constraints`,
  `adversarial`, `field-noise`, `field-stress`) with the field **off and on**, reports the
  **ROC** (did the apex constraint surface?) and **TBR** (did forbidden junk bleed in?) split,
  and gates against `golden.json`. `--filter <id>` runs a subset; `--accept` locks the current
  scorecard as the new golden (jsonl-only; re-run with `--store jsonl`). Default
  (RM-07 slice 4) is SqliteStore, two-sided parity against `golden.json` (any
  case flip is a STOP). `--store jsonl` keeps the JSONL path testable. Measurement corpora (`duplicates`) are skipped here.
- `eval/measure.js` runs reporting metrics from the registry in `eval/metrics.js`
  (`recall_at_k`, `duplicate_rate`, `extraction_precision`, `extraction_recall`, `mrr`;
  add more with `register(...)`). A/B numbers, not the
  golden gate. See `eval/RESULTS.md` (RM-02.a baseline, RM-02.b A/B and RM-02.c
  backfill: dup_rate 0.3182 → 0.0000, recall@5 held at 1.0000).
- Current scorecard: **27/31 checks**, field lifts 3 cases fail→pass and the golden gate holds.

`npm test` (57 tests) covers the substrate directly; `npm run eval` covers recall behavior.
Both run in well under a minute. The acceptance test for the harness itself: a deliberately
broken change (e.g. rank by recency) is caught by the gate.

---

## 10. The build pipeline

`build-exe.js` produces the single shippable file:

```
[0] embed runtime assets  → generate embedded-assets.js (demo seed + system prompt as strings)
[1] esbuild               → bundle entry.js + all requires into one file, strip per-file
                            AGPL headers, prepend a single collapsed notice
[2] Node SEA blob         → --experimental-sea-config sea-config.json
[3] copy the node runtime → resonance-memory.exe (Windows) /
                            resonance-memory-linux-<arch> /
                            resonance-memory-macos-<arch>
[4] postject inject       → embed the SEA blob into the copied runtime
    (Windows) flip PE subsystem console(3) → GUI(2) so double-click opens no console window;
    MCP mode is unaffected (LM Studio pipes stdin/stdout)
    (macOS) codesign --remove-signature, postject, ad-hoc codesign --sign -
[5] stage dist/           → the shippable bundle
```

Zero runtime dependencies is load-bearing: it keeps the exe small, the build simple, and the
test suite instant. Build-time tools (`esbuild`, `postject`) are invoked via `npx --yes`, never
installed into `package.json`. SEA is per-platform — the macOS binary must be built on a Mac,
which in this project means the GitHub Actions `macos-latest` job in
`.github/workflows/release.yml` (no Mac hardware on the desk). A `v*` tag
gates on `test.js` + `eval/run.js`, builds natively on each OS, smokes
`--mcp` on that runner, and attaches the three binaries plus `SHA256SUMS`
to a GitHub Release. Between tags, `.github/workflows/ci.yml` runs the
same `test.js` + `eval/run.js` gate on every push to `main` and every
pull request (checks UI: `CI / gate`) so a regression cannot sit on
`main` until the next release. macOS ships arm64-only. Binaries are unsigned.

---

## 11. Configuration surface

All environment variables, read at startup:

| Variable | Default | Effect |
|---|---|---|
| `MEMORY_FILE_PATH` | `~/.lmstudio/resonance-memory.jsonl` | the store (sidecars derive from it) |
| `RESONANCE_MEMORY_CONFIG` | beside the store | live field / extract-toggle config file |
| `EMBED_ENDPOINT` | `http://localhost:1234/v1/embeddings` | OpenAI-compatible embeddings endpoint |
| `EMBED_MODEL` | `text-embedding-nomic-embed-text-v1.5` | embedding model name |
| `RESONANCE_MEMORY_FIELD` | off | default field state when no config file exists |
| `RESONANCE_FIELD_MUTUAL` | on | reciprocal-kNN topology (`0` → directional) |
| `RESONANCE_FIELD_KSEARCH` | 15 | internal search radius for constraint rescue |
| `RESONANCE_FIELD_MINSIM` | 0.70 | Related: kNN floor (live-config `field_minsim` wins) |
| `RESONANCE_CONSTRAINT_GATE` | 0.45 | min cosine for a constraint↔seed bridge (live-config `constraint_gate` wins) |
| `RESONANCE_MEMORY_PANEL_PORT` | 9090 | control-panel port (127.0.0.1 only) |
| `RESONANCE_EXTRACT_LLM` | off | default Tier 2 state when no config file exists |
| `RESONANCE_EXTRACT_MODEL` | auto (first non-embed) | preferred chat model id for Tier 2 |
| `RESONANCE_EXTRACT_TIMEOUT_MS` | 8000 | interactive extract bound; degrade to Tier 0/1 |

The embedder is **not bundled** — we depend on the `/v1/embeddings` *interface*, not a specific
model, so any compatible embedding model can be swapped in.

The panel's HTTP surface (`127.0.0.1` only): `GET /`, `GET /api/state` (includes
`extract_llm` / `extract_capable` / `extract_model`), `GET /api/graph`,
`GET /api/clients`, `GET /api/engine`, `GET /api/system-prompt`, `POST /api/toggle`
(`field` and/or `extract_llm`; extract-on is refused if no capable model),
`POST /api/connect|disconnect`, `POST /api/engine/setup`, `POST /api/ping` (heartbeat),
`GET`/`POST /api/export` (slice 2c), `GET`/`POST /api/import` (RM-17; POST
`apply:false` is the dry-run, `apply:true` writes; `withEdges` default-off). This is not yet a documented stable API (`RM-12`).
**W-02 (shipped):** Host must be loopback; Origin, when present, must be this panel
(`http://127.0.0.1:<port>` / `localhost`); mutating POSTs require a per-process
`X-Resonance-Token` baked into the page. No CORS. Residual: a local process that
reads the page can steal the token.

---

## 12. Extension seams (where new work plugs in)

The architecture is built to absorb the roadmap without touching the MCP API or forking the
recall path:

- **Substrate unification** → the two association layers (`field.js` static kNN rebuilt per
  recall, `ledger.js` Hebbian sidecar) merged into one **persistent edge store with two
  independent signals** — semantic (derived / recomputable from vectors) and learned
  (source-of-truth / irreplaceable). The record + sidecar live in `edges.js` and are on
  the live recall path (Slice C). Save-time semantic neighbors persist in 0.1; recall
  still computes semantic kNN in `field.js` until a later gated switchover. I6 is held
  as of 0.2 (lazy wall-clock decay; `tick()` gone from recall). It is a **migration, not
  greenfield** — existing `.assoc.json` sidecars
  are carried into `.edges.json` one-way (`RM-21`, design in
  [`phases/phase-0`](phases/phase-0-edge-substrate.md)).
- **New store backend** → implement the `JsonlStore` method surface (`RM-07`, SQLite).
- **Write-path cleanup** (extraction, dedup) → in `save()` inside `memory-core.js`, before the
  store append (`RM-01`, `RM-02`). A save must never fail because a cleanup tier did.
- **Hybrid retrieval** → a second ranking arm fused with RRF, behind a flag, promoted only on a
  measured A/B win, with `DEVELOPERS.md` amended in the same PR (`RM-05` — this is the one seam
  that touches the cosine-only invariant, and the process guards it).
- **Scoping / multi-agent** → new record fields resolved from client identity, never from a
  model argument (`RM-06`).
- **Idle consolidation** → a background pass on panel idle, strictly off the recall hot path
  (`RM-10`).

The single rule across all of them: capability goes in the substrate, the four verbs stay
fixed, and no unmeasured signal touches ranking.

---

## 13. Where to read next

- Building, running, and verifying → [`../DEVELOPERS.md`](../DEVELOPERS.md).
- What's being built now, and in what order → [`ROADMAP.md`](ROADMAP.md) + [`phases/`](phases/).
- What's done, in progress, and open → [`BACKLOG.md`](BACKLOG.md) (`RM-00`…`RM-20`).
- Known defects and the watch list → [`BUGS.md`](BUGS.md).
- Why the roadmap is ordered the way it is → [`COMPETITIVE-ANALYSIS.md`](COMPETITIVE-ANALYSIS.md).
- Deep designs with pseudocode → [`proposed/`](proposed/).
</content>
</invoke>

---

## Related

[[ROADMAP]] · [[BACKLOG]] · [[BUGS]] · [[CLAUDE]] · [[DEVELOPERS]] · [[phase-0-edge-substrate]] · [[phase-2-retrieval-dynamics]] · [[phase-7-reconsolidation]] · [[0009-edge-threat-model]] · [[RESULTS]] · [[proposed/README]] · [[COMPETITIVE-ANALYSIS]]
