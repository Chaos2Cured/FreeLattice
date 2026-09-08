# Changelog

All notable changes to Resonance Memory are recorded here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project aims to follow
[Semantic Versioning](https://semver.org/). The public tool surface — the four verbs
`save_memory` / `recall_memory` / `edit_memory` / `delete_memory` — is intended to stay
stable; sophistication grows in the substrate, not in the API.

## [Unreleased]

### Changed
- **Weak-model system prompt rewritten + the copy button fixed.** The optional
  `system-prompt.md` block is now tighter and priority-ordered — recall-before-you-answer
  leads, save-what-lasts and keep-it-clean follow — so a small model that forgets to reach
  for tools has one clear routine. The panel's "copy a ready-made system prompt" button now
  copies **only the paste-ready block**, not the surrounding human-facing doc (it was
  handing over the "paste the block below…" intro too).

### Added
- **Independent A/B value rig (Grok).** `eval/ab-grok/` is a second, disjoint
  scenario (fictional user Jules Marin — not Dana) measuring cold vs equal-budget
  recency vs Resonance Memory under modest local drivers (`gpt-oss-20b`,
  `qwythos-9b`). Same discipline as `eval/ab/` (scaffolded, scripted user,
  identical injection budget, blind accept/reject grading, pre-declared
  two-sided bands, mean ± sd); different facts, probes, filler, grader wording.
  Late plants are left inside the recency window on purpose so the naive
  control has a home turf. Offline invariants (`node eval/ab-grok/check.js`,
  also on `node test.js`) refuse Dana-leaks, accept-token-in-question grader
  leaks, and a recency window that still contains "buried" plants. Not a fifth
  verb; not on the RM-00 golden path.
- **PR-path CI.** `.github/workflows/ci.yml` runs the deterministic
  gate (`node test.js` + `node eval/run.js`) on every push to `main`
  and every pull request, so a regression is caught when it lands,
  not when someone cuts a tag. Complements `release.yml` (the heavy
  native-build matrix, tag-only). One `ubuntu-latest` job, Node 24,
  no secrets, no network (eval reads `eval/embeddings.cache.json`;
  `EVAL_REFRESH` is never set, so a cache miss fails loud instead of
  hanging on localhost:1234). Actions reuse the same SHA pins as
  `release.yml`. Stale PR runs cancel (`cancel-in-progress: true` —
  the opposite of the release workflow, which must not cancel a
  publish). Checks UI: `CI / gate`. A red step fails the job
  (`process.exit(1)` from both commands; no `continue-on-error`).
- **Tier 1 secret/PII guard covers 2026 issued shapes.** `guardSecrets` in
  `record.js` still refuses, never redacts (a fact mixed with a secret is
  store-nothing). New prefixes are the credentials people actually paste:
  GitHub `github_pat_` and real `ghp_` (underscore — 01.b only had the
  hyphen fake), Slack `xapp-` (bot `xoxb-` already matched), Stripe
  `sk_live_`/`rk_live_`/`sk_test_` (not publishable `pk_live_`), Google
  `AIza…`, HuggingFace `hf_`, Groq `gsk_`, AWS STS `ASIA`, OpenSSH
  private keys (PEM already covered), JWTs (`eyJ….….…`), `passphrase:`
  and high-entropy `api_key=` assignments. `sk-proj-` / `sk-ant-` ride
  the existing `sk-` prefix. Match prefix+length+charset, not English:
  "the secret is browning the butter", "my password manager is Bitwarden",
  `4821`, `1500mg`, and `API_KEY=nomic-embed-text-v1.5` still store.
  True-positives in `eval/corpora/messy.jsonl`; prose canaries in `test.js`.
- **RM-11 release CI.** `.github/workflows/release.yml` is the
  native-build / macOS path (this project has no
  Mac hardware). A `v*` tag runs the local gate (`node test.js` +
  `node eval/run.js`) on Node 24, then builds a native SEA binary on
  `windows-latest` / `ubuntu-latest` / `macos-latest`, smokes each one
  with `ci/smoke-exe.js` (`--mcp` initialize + `tools/list`, exactly
  the four verbs, timeout-kills so a hang cannot ship), and attaches
  `resonance-memory.exe`, `resonance-memory-linux-x64`,
  `resonance-memory-macos-arm64`, and `SHA256SUMS` to a GitHub Release.
  `v0.2.0-rc1` is a prerelease of `package.json` 0.2.0 — an rc tag does
  not require bumping the version string. `workflow_dispatch` builds
  without publishing. macOS is arm64-only (Node SEA CI skips x64).
  Binaries stay unsigned; Gatekeeper / SmartScreen guidance lives in
  the Release body and `docs/BUILDING.md`. Actions pinned to
  full-length SHAs; `gh release` rather than a third-party action.
- **RM-17 panel import button.** Confirm modal shells `runImport()` — the
  same engine as `--import`, not a second writer. Path + Browse (native
  dialog; paste-a-path always works). `--with-edges` is a checkbox
  default-off (the `0009` planted-sidecar refusal). Merge into a store that
  already has memories is an **explicit opt-in**, never pre-checked — the
  checkbox starts off and the dry-run's `IMPORT_DEST_NONEMPTY` keeps Import
  disabled until the user ticks it, matching the CLI's `--merge` refusal.
  The safe common case (empty store) never shows the row. Heartbeat pause + yield like export
  so a long restore cannot `process.exit(0)` a truncated ingest. First-run
  empty-store card names the button for the "zip from another machine"
  hole. Not a fifth MCP verb.
- **W-02 panel Origin/CSRF lock.** The control panel still binds `127.0.0.1`
  only. Host must be loopback (DNS rebinding arrives as `Host: evil.example`).
  Origin, when present, must be this panel. Mutating POSTs require a
  per-process `X-Resonance-Token` baked into the page — a form from another
  origin cannot set a custom header. No `Access-Control-Allow-Origin`.
  Residual: a local process that GETs the page can steal the token (same
  class as binding 127.0.0.1). Settles the ship-gate before `RM-12`
  documents the HTTP surface as a stable API. Not a fifth MCP verb.
- **Entity-id + polarity layer (`entity.js`).** Server-assigned (I4),
  lexical: closed-class relation (family / work / friend, neighbor ∈ friend)
  plus relation-anchored proper names. Store-wide resolve so "My sister
  Naima teaches chemistry" and "I call my sister Naima every Sunday" share
  one id (E1) while "My coworker Naima is a frontend engineer" is E2.
  Same-name + conflicting relation drops the Related: edge and zeros
  Hebbian `pairScale` — never reorders primary cosine (I2/I3). Polarity is
  the same shape (`incompatible with X` vs `synergistic with X`). Measured
  on fire-together + the fair-run probes: 11/11, over-split 0 on named true
  pairs. B1 (sister Naima vs sister Layla) gets different ids but no
  name-conflict flag — that's the named ceiling. See
  `eval/substrate/entity-layer-results.md`.
- **Per-embedder invocation (`embed-invoke.js`).** `server.js` no longer
  POSTs raw text for every model. Nomic stays raw (verified best
  document-document geometry). Qwen queries get the Instruct-query wrapper;
  jina gets `Query:` / `Document:`. Family is keyed off the panel's
  `config.embedder` then `EMBED_MODEL`, so selecting Qwen/jina is no longer
  the broken plain geometry.
- **RM-20 first-run empty-store nudge.** When the user store has zero current
  memories, the control panel shows a card: what to tell your AI, a
  "Copy a starter prompt" button, and a distinct "connected but nothing
  saved yet" title if an MCP client is already hooked up. README "Get
  started" names the same first action. Not an MCP tool.
- **RM-17 import — the sovereignty return trip.** `--import <zip-or-jsonl>`
  (dry-run default, `--apply` writes) restores an export onto a new machine
  or `--merge`s into a store that already has memories. Direct store write —
  does **not** go through `save()`, so ids, embeddings, timestamps,
  `superseded_by`, and deleted rows survive, and a machine without an
  embedder can still load a copy. Streaming (the S1 834 MB wall). Hebbian
  restore is **opt-in** (`--with-edges`) and only from a zip whose
  `manifest.format` is `resonance-memory-export`: a raw `.edges.json` is
  refused, a dest that already has associations needs `--replace-edges`.
  That is the `0009` planted-sidecar refusal, not a missing feature.
  Not a fifth MCP verb. Panel button shipped (confirm modal, same engine).

### Changed
- **Related: minSim 0.55 → 0.70** (nomic default). Fair-run: 0.55 leaked 11
  near-miss edges; 0.70 keeps 14/15 true pairs (bookshelf m2↔m3 at 0.676 is
  the cost), zero near-miss, zero unrelated. Live-config `field_minsim` /
  env `RESONANCE_FIELD_MINSIM`. Constraint rescue stays at gate 0.45
  (independent path — field-rescue still 3/3). **RM-00 golden held 27/31
  case-for-case** on sqlite and jsonl; not re-accepted.
- **Cosine-gated reinforce + neighborhood-normalized readout.**
  `reinforceRecall` takes `pairScale`: α × how far doc-doc cosine sits
  above the gate (entity mismatch → 0; constraint bridges use
  `CONSTRAINT_GATE` so lemon↔diabetic still learns). Field bonus is
  `tanh(w / nodeMax) * maxBonus` instead of saturated `tanh(w)`. EdgeStore
  `bonus()` itself stays tanh so Ledger-parity tests hold.

### Added
- **RM-07 slice 5 — edges-in-db (one-file sovereignty).** EdgeStore keeps its
  API; persistence is now an adapter. SqliteStore shares the `DatabaseSync`
  connection so memories, access counts, and learned associations live in
  ONE `.db`. JsonlStore still uses the `<store>.edges.json` sidecar (unchanged
  while JSONL is a live write path). `processed_ids` + the weight UPDATE
  COMMIT in one transaction (the 0.3 atomicity fix the JSON envelope
  flagged). `effectiveHebbian` stays computed-on-read, never a column (I6).
  Edges mutations run in their own txn so a thrown edges write cannot poison
  memories (crash-domain). First-open ingests a leftover `.edges.json` into
  the table (count-verify, sidecar → `.bak`, fail-open if missing). Export
  reads Hebbian data from the table when the backend is SQLite. config.json
  stays a sidecar (prefs ≠ memory). Phase 0.2–0.5 edge matrix green on BOTH
  adapters; RM-00 golden 27/31 unmoved (I9).
- **RM-07 slice 4 — SQLite is the default.** New stores are `.db`. An existing
  JSONL auto-migrates on first open via the 2a 10-step protocol (stream,
  preserve ids, fold AccessLog once, count-verify, WAL checkpoint, atomic
  rename, **then** JSONL → `.bak`). `RESONANCE_STORE=jsonl` / live-config
  `store: "jsonl"` pins JSONL. A leftover JSONL beside a live `.db` is renamed
  to `.bak` (finish step 8; never dual-read). **Fail-open:** a failed
  auto-migrate keeps the JSONL live and opens JsonlStore — the user is never
  locked out of their memories. The `.bak` is the recovery snapshot, not the
  sovereignty export; do not delete it. Downgrade honesty: an old exe opening
  the `.bak` sees a stale store; recovery is `--export-jsonl` before
  downgrade, or keep the new exe. No dual-write "switch back" env.
  `node eval/run.js` (sqlite default) and `--store jsonl` both 27/31.
- **RM-07 slice 2c — panel export button.** "Export my memories" on the
  local control panel (same surface as the field toggle). Click opens a
  confirm modal (what it writes, that it is read-only, count + size
  estimate, dest path, filename-preview note) so a curious/accidental
  click writes nothing. Export POSTs to the panel server, which shells
  the 2b engine and writes the zip to Desktop, then a "saved to \<path\>"
  toast + copy-path + Windows `explorer /select`. Pauses the heartbeat
  watchdog and yields the event loop so a long zip cannot starve
  `/api/ping` and `process.exit(0)` a truncated tmp. Button disabled
  in-flight (409 on a concurrent POST). Empty store still exports.
  User store only — never `demo-seed.jsonl`. **Not an MCP tool.** Last
  UX gate before the slice-4 default switch.
- **RM-07 slice 2b — sovereignty export.** `--export` writes a ZIP64 zip
  (default dest Desktop, `--name` / `--out`, never-overwrite `Name (2).zip`)
  containing `memories.jsonl` (machine interchange, embeddings as JSON arrays —
  a competitor reads this without our exe), `memories/YYYY/MM/DD/<id>-<slug>.json`
  (human, no vectors), `catalog.txt`, `edges.json` (Hebbian; `processed_ids`
  omitted), `manifest.json` (`layout: "memories/YYYY/MM/DD"`), and `README.txt`.
  `--export-jsonl` stays as the raw scripting primitive. Zero-dep writer
  (`zip.js`: `createDeflateRaw` + `zlib.crc32` + stream to `.zip.tmp` + rename;
  ZIP64 extra + EOCD + locator on every archive). READ-ONLY; not a fifth MCP
  verb. We do not sanitize the export. 50k/768-d proof: **34.3 s**, 387 MB zip,
  50k/50k lossless, Windows `ZipFile.OpenRead` 50,005 entries; synthetic ZIP64
  **70,000** entries. Panel button shipped as slice 2c.
- **RM-07 slice 3 — RM-00 golden on SqliteStore.** `eval/run.js --store sqlite`
  (also `RESONANCE_STORE=sqlite`; `--store` wins) runs the same corpora through
  `SqliteStore` behind the Store seam — same `memory-core.js`, no forked recall
  path. Offline + deterministic (vectors from `eval/embeddings.cache.json`).
  The sqlite gate is two-sided parity against `golden.json`; `--accept` is
  jsonl-only. **27/31 identical case-for-case, no flips.** Cache embeddings
  are already exact f32, so Float32 BLOB packing is lossless on this embedder;
  no cosine-tolerance was added. JSONL stays default (switch is slice 4, after
  the 2c panel button).
- **RM-07 slice 2a — streaming JSONL→SQLite migrator.** Opt-in CLI
  (`node entry.js --migrate` / `npm run migrate`). 10-step protocol: stream
  line-at-a-time into `.db.migrating` (never `readFileSync` — that is the S1
  834 MB wall), preserve ids, fold AccessLog once at ingest (BUG-007),
  count-verify, WAL checkpoint, atomic rename to `.db`, **then** JSONL →
  `.jsonl.bak`. The `.bak` is a recovery snapshot, not the sovereignty export
  (that's slice 2b). Failure before the `.db` rename leaves the JSONL live;
  kill-9 is a test. Not auto-run on server startup. 50k/768-d proof:
  **lossless in 2.5 s** against a 785 MB JSONL that `readFileSync` cannot
  load. JSONL stays the default backend; golden unmoved.
- **RM-07 slice 1 — `SqliteStore` drop-in.** Selectable backend (`RESONANCE_STORE=sqlite`
  / live-config `store`); JSONL stays default. `node:sqlite` `DatabaseSync`, WAL +
  `synchronous=FULL`, embeddings as Float32 BLOBs, in-process cache, JS cosine (no
  sqlite-vec). Opaque ids preserved; `created` is a real column; access counts live
  in the row (`SqliteStore` never constructs `AccessLog`). Conformance suite proves
  JsonlStore ≡ SqliteStore on save/recall/edit/delete/vacuum. Product S1: **loads
  50k and 100k** (JSONL cannot); field-off recall p95 **49.6 ms @50k, 96.4 ms @100k**.
  Export, default switch, edges-in-db (slice 5, shipped), `searchDense` are later slices.

### Changed
- **I5 restated** to match ARCHITECTURE/ROADMAP: durable writes; no *unbounded* /
  full-corpus rewrite on a read path. Bounded atomic retention UPDATE of the
  returned ids is permitted (JSONL = AccessLog sidecar; SQLite = in-table
  `UPDATE`). CLAUDE.md / AGENTS.md brought in line.
- **`package.json` `engines`** `>=18` → `>=22.5` (`node:sqlite` floor). esbuild
  `--target` follows (`node22`).

Beta-readiness pass:

### Changed
- **Relicensed GPL-3.0 → AGPL-3.0.** Closes the SaaS / network-use loophole in plain GPL: a
  hosted or networked derivative must now also release its source. `LICENSE`, `package.json`
  (`AGPL-3.0-or-later`), and every per-file source header updated. This is the
  "revisit only if hosted resale looms" trigger the backlog pre-registered, now pulled.

### Added
- **RM-01.c Tier 2 opt-in LLM extraction.** Off by default (RM does the work; a
  weak local model can extract worse than Tier 0/1). Capability-detect: MCP
  sampling **or** a non-embedding chat model at the configured endpoint. Visible
  panel toggle, surfaced when a capable model is detected. One ADD-only call on
  the already-guarded text; any failure/timeout/garbage degrades silently to
  Tier 0/1 — a save never fails or hangs because extraction did. PII is refused
  before any LLM call. `eval/corpora/messy-hard.jsonl` is the stick (`eval/messy`
  is already maxed by 01.b). Live A/B (`openai/gpt-oss-20b`, temperature 0) in
  [`eval/RESULTS.md`](eval/RESULTS.md). Golden unmoved (Tier 2 is off on that
  path). RM-01 is done.
- **RM-01.b write-side extraction (Tier 0 + Tier 1, no LLM).** Always-on at
  `save()`: collapse whitespace, strip leading filler openers and assistant-aimed
  imperatives (full phrases, not 0001's short `^(i think )`), split on `; ` /
  ` and also ` only when both halves stand alone, refuse secret/PII shapes
  (store nothing — refusal, not redaction). Clean facts pass through
  byte-identical. `extraction_recall` added to the reporting registry (anti-cheat
  for vacuous precision). **A/B vs the 01.a bar:** `extraction_precision`
  0.2609 → **1.0000**, `extraction_recall` **1.0000**, `recall@5` held at
  **1.0000**, `pii_refusal_rate` 0 → **1.0000**. Golden unmoved. See
  [`eval/RESULTS.md`](eval/RESULTS.md) RM-01.b.
- **RM-01.a measurement seed (write-side extraction).** `extraction_precision`
  in the reporting-metric registry plus `eval/corpora/messy.jsonl` (filler
  openers, assistant-aimed imperatives, multi-fact splits, PII/secret
  refusals, clean controls). Distinct from the golden gate —
  `node eval/run.js` is unchanged ("No regressions vs golden"); `save()` /
  `memory-core.js` untouched. Pre-extraction baseline and the pre-declared
  RM-01.b bar (`extraction_precision ≥ 0.9` with Tier 2 off, recall@5 not
  lowered, write-latency p95 unchanged when Tier 2 off) live in
  [`eval/RESULTS.md`](eval/RESULTS.md).
- **RM-02.c `--dedup-existing` backfill.** Offline pass for stores written
  before 02.b. Dry-run is the default (`node entry.js --dedup-existing` /
  `npm run dedup-existing`); `--apply` performs it as one durable rewrite.
  Same `detectNearDuplicate` / `pickMergeSurvivor` / `mergeBandPatches` as
  `save()` — file-order, each record vs earlier survivors — so the offline
  pass and the write path cannot disagree. Restatement losers already on
  disk are superseded, not deleted (I8); vectorless rows are skipped if
  the embedder is down. Second `--apply` is a no-op. Measured on a pre-02.b
  `eval/duplicates` fixture: `duplicate_rate` 0.3182 → **0.0000**, `recall@5`
  held at **1.0000**. Golden unmoved. RM-02 is done. See
  [`eval/RESULTS.md`](eval/RESULTS.md).
- **RM-02.b cosine-banded dedup/merge at save.** First measured A/B in the
  project. After embed, `save()` compares the new vector to already-stored
  ones: cosine ≥ `DEDUP_HI` (0.95) is a restatement (bump `last_confirmed` +
  `access_count`, don't append — generalizes today's byte-identical confirm);
  band `DEDUP_LO..HI` (0.88–0.95) is a merge (keep the longer original text,
  union metadata, link the loser with `superseded_by` via `supersedePatches`;
  never a blend, never a hard delete). Below LO: append as before. No vector
  → append, don't crash. Thresholds are config (`RESONANCE_DEDUP_HI`/`LO` +
  live-config `dedup_hi`/`dedup_lo`), tuned on `eval/duplicates` (tea 0.9522
  is the tightest HI; controls ≤ ~0.69). **A/B vs the pre-declared bar:**
  `duplicate_rate` 0.3182 → **0.0000** (100% drop, bar was ≤ 0.1591) AND
  `recall@5` held at **1.0000** (controls not over-merged). Golden unmoved
  ("No regressions vs golden."). See [`eval/RESULTS.md`](eval/RESULTS.md).
- **RM-02.a measurement seed (write-path gap).** A reporting-metric registry in
  `eval/metrics.js` (`recall_at_k`, `duplicate_rate`) plus `eval/measure.js` and
  `eval/corpora/duplicates.jsonl`. Distinct from the golden contains/excludes
  gate — `node eval/run.js` is unchanged ("No regressions vs golden"); these
  numbers are the A/B 02.b compares against. Pre-dedup baseline:
  `duplicate_rate` 0.3182 (7/22 extras; the shipping exact-restatement path
  catches 1 byte-identical pair and zero paraphrases), `recall@5` 1.0000
  (17/17). Pre-declared RM-02 pass bar (before 02.b runs): dup-rate ≥50% down
  (→ ≤ 0.1591) AND recall@5 not lower. Product behaviour untouched.
- **Phase 0.6 threat-model sketch (design only).** On-paper analysis of the
  unified edge substrate: what can mint an edge, raise Hebbian weight, make a
  memory a constraint-rescue bridge, or survive indefinitely. The load-bearing
  property: semantic is a recomputable cache (version comparison against
  `embedding_version`); a poisoned reinforcement is a durable *false memory*
  nothing else encodes. Answers that change when learned weight enters rank
  are carried into `RM-16` as requirements of the Phase 2.2 promotion gate.
  `RM-16` is not implemented here. No code, no behaviour change; both gates
  reconfirmed green. See
  [`docs/proposed/0009-edge-threat-model.md`](docs/proposed/0009-edge-threat-model.md).
  **Phase 0 exit is met** (golden green + reliable; I6 held; I8 held for
  edges; migration lossless + one-way; signals stay separate).
- **Phase 0.5 test contract.** `test.js` is now the Phase 0 contract: every
  edge state-transition row (state change AND the `Writes?` column), every
  pre-declared failure signature, and interrupted/failed persistence atomic
  recovery. Section headers keyed to sub-phase / invariant. No behaviour
  change; golden unmoved. See
  [`docs/phases/phase-0-edge-substrate.md`](docs/phases/phase-0-edge-substrate.md).
- **Soft pruning + server-side reactivation (Phase 0.4 / I8).** An explicit
  `pruneSweep()` (MCP startup or on demand — never `recall`/`save`) marks an
  edge `pruned_at` only when it is **both** unreinforced (`effectiveHebbian <
  1e-6`) **and** semantically weak (`semantic.value < SEMANTIC_PRUNE_GATE`
  0.25, the save-time bind floor). An idle but semantically-strong edge stays
  so constraint-rescue cannot regress (RESULTS field experiment #2). The
  record is kept; `incident()` skips it. Hard drop is `EdgeStore.vacuum()`,
  also explicit. Reactivation is a consequence of `save`/`edit`/`reinforce`
  touching an endpoint: in-place, `created_at` preserved, Hebbian weight
  carried (not snapped to full), bounded `prune_count` history. No fifth
  tool. Golden did not move (eval never calls the sweep). See
  [`docs/phases/phase-0-edge-substrate.md`](docs/phases/phase-0-edge-substrate.md).
- **Materialize-on-mutation + MCP request-ID idempotency (Phase 0.3).** A reinforcing
  write first stores `effectiveHebbian(edge, now)` as `hebbian.weight`, then applies α,
  then stamps `hebbian.last_updated` — reinforcement cannot bypass accumulated decay
  (the "ghost weight" of adding α to an undecayed stored value after a long idle).
  Provenance is preserved. One MCP JSON-RPC request id = one mutation transaction:
  `server.js` extracts `req.id` and threads it into the four verbs; EdgeStore keeps a
  256-entry LRU of processed ids **inside** the sidecar (`processed_ids`) so one
  `writeFileDurable` commits the dedup record and the weight change together. No id
  (eval, tests, panel) applies normally. Golden did not move (Δt≈0 materialize is a
  no-op; eval carries no request ids). See
  [`docs/phases/phase-0-edge-substrate.md`](docs/phases/phase-0-edge-substrate.md).
- **Lazy wall-clock Hebbian decay (Phase 0.2 / I6).** Decay applies to `hebbian.weight` only
  (semantic never fades) and is **computed on read** via `effectiveHebbian(edge, now)` —
  `w · 2^(−Δt/H)`, `λ = ln(2)/H`, `Δt = max(0, now − last_updated)` in seconds. It is not
  written back (materialization-on-mutation is 0.3). The recall-epoch `tick()` is gone from
  the live path: reading no longer drives the decay clock. `reinforceRecall` is retained.
  Starting half-lives (parameters, not constants): constraint ~30 days, fact ~7 days,
  working ~1 hour. Per-type/namespace override via `opts.halfLives` / `hebbianDecayType`.
  Golden did not move (eval cases are single-recall on a fresh store; epoch ticks never
  fired, and Δt≈0 in an instant eval). See
  [`docs/phases/phase-0-edge-substrate.md`](docs/phases/phase-0-edge-substrate.md).
- **Save-time semantic edges (Phase 0.1).** On `save()` of a record with a real vector, persist
  its top-5 neighbors above cosine 0.25 into the EdgeStore (`semantic.value` + canonical
  `src_versions`, `hebbian.weight = 0`, origin `save-time-neighbor`). Embedder down → bind
  nothing. Recall is unchanged: `Related:` still comes from `field.js` at minSim 0.55 — the
  two thresholds serve different jobs and are not unified. Cost sweep
  (`eval/save-time-cost.js`): pre-declared p95 budget 250 ms; measured p95 at N=100k is
  77.1 ms → `RM-07` is **not** forced by the neighbor scan. See
  [`docs/phases/phase-0-edge-substrate.md`](docs/phases/phase-0-edge-substrate.md).
- **Unified edge store (`edges.js`, Phase 0.0).** One undirected edge record carrying two
  independent signals — `semantic` (derived cache, validated by `src_versions` vs each
  endpoint's `embedding_version`) and `hebbian` (source of truth; `last_updated` nests
  here because that's the only thing it clocks). Typed provenance (`origin` is how the
  edge came to exist; `migrated_from` is a separate fact). Existing `.assoc.json`
  sidecars migrate losslessly and one-way into `<store>.edges.json` (`kind: "resonance-edges"`;
  an old-format reader refuses rather than dropping edges). **On the live recall path:**
  Hebbian bonus/reinforce/save go through EdgeStore (`tick()` retired in 0.2); `ledger.js`
  is retired from recall. Semantic kNN + constraint-rescue still run in `field.js` at recall; save-time
  neighbor persist is the 0.1 entry above. See
  [`docs/phases/phase-0-edge-substrate.md`](docs/phases/phase-0-edge-substrate.md).
- **`embedding_version` on every memory** (Phase 0.0 schema). `record.js` `normalize()`
  backfills it to `1` for legacy rows. A successful `edit()` re-embed increments it; an
  embedder failure does not — the version moves in lockstep with the vector so a
  text-drifted-from-vector record stays distinguishable from a genuine re-embed
  (`BUG-008` class). See [`docs/phases/phase-0-edge-substrate.md`](docs/phases/phase-0-edge-substrate.md).
- **Association graph view** in the panel — a live 3D force-directed constellation of your
  memories; hover a dot to read it, line thickness = similarity, reinforced-by-use edges
  highlighted. Refreshes as the graph learns.
- **Demo graph** — a one-click, 100% synthetic sample (a fictional game dev's notes,
  pre-embedded in `demo-seed.jsonl`) so the panel shows non-obvious associative links on
  first launch with no setup and no real data. View-only; never written to your store.
- **"Support the Architect"** footer — Ko-fi + PayPal links.
- **Windowless single-click** — `resonance-memory.exe` opens the control panel with **no
  console window** (the build flips the Windows PE subsystem to GUI). One thing to click,
  no separate launcher, no stray terminal. The background process **shuts itself down ~12s
  after you close the tab** (heartbeat), so nothing lingers. MCP mode is unaffected.
- **`uninstall.bat`** — disconnects from LM Studio / Claude Desktop and points you to your
  data file (never auto-deletes your memories).
- **`build-demo-seed.js`** — regenerates the demo seed from synthetic text via the embedder.
- **GPL-3.0 licensing** — full `LICENSE` at the repo root plus per-file copyright headers; the
  build collapses them to a single notice in the bundle.
- **Planning docs** — [`docs/ROADMAP.md`](docs/ROADMAP.md), [`docs/BACKLOG.md`](docs/BACKLOG.md)
  (`RM-00`…`RM-20`), [`docs/COMPETITIVE-ANALYSIS.md`](docs/COMPETITIVE-ANALYSIS.md), and
  [`docs/proposed/`](docs/proposed/) design docs covering the write path (extraction, dedup,
  supersession), temporal metadata, hybrid retrieval, the store abstraction, and the
  evaluation harness.

- **Temporal groundwork (`RM-04`).** Memories now carry `valid_from` / `valid_to` /
  `last_confirmed`, recall answers from the ones still marked current, and superseded ones are
  kept rather than deleted — surfacing only when you ask about the past. **Nothing sets a
  memory superseded yet**; the detection that decides *when* one fact replaces another is
  `RM-03`, still to come. This release is the schema and the plumbing under it.
  Saving text you've already saved word-for-word confirms the existing memory instead of
  storing a copy. Old stores gain the new fields on first read; **no migration step**.
- **`test.js`** — a dependency-free test suite (`npm test`), plus a `package.json` so the
  usual entry points (`npm test`, `npm run build`, `npm run panel`) work.

### Fixed
- **Your memories can no longer be truncated by a crash.** Store writes replaced the live file
  in place, so a crash or power loss partway through could leave it empty. Writes are now
  atomic (temp → fsync → rename). Same fix applied to the Hebbian ledger. (`BUG-001`)
- **Recall no longer rewrites the entire memory file.** Every `recall_memory` used to re-serialize
  the whole store just to bump an access counter — O(store) work on a *read*, and a whole-file
  data-loss window. Access counts moved to a sidecar; recall now performs **zero** writes to
  the store in steady state. (`BUG-002`)

See [`docs/BUGS.md`](docs/BUGS.md) for the full write-up and the open watch list.

### Changed
- **Association graph is now 3D.** Memories are placed by association: each semantic/Hebbian
  link is a spring whose rest length shrinks as similarity rises, so related memories cluster
  and unrelated ones stay reachable only through what bridges them. Drag to rotate. More-
  connected memories carry more mass and draw larger.
- **The graph no longer re-settles on a timer.** Node positions persist across polls; the
  layout re-settles only when the set of memories changes. The render loop idles to zero CPU
  once settled.

## [0.1.0] - 2026-07-26

First packaged, double-click build. Everything below is the baseline going forward.

### Added

- **Four-verb MCP memory server** (`server.js`) a small local model cannot misuse:
  `save_memory`, `recall_memory`, `edit_memory`, `delete_memory`, spoken over stdio as
  JSON-RPC 2.0. The model only ever sees the four verbs and an opaque `id`.
- **Embed-on-save.** Each memory is embedded once at save time and the vector stored in
  the record; recall embeds only the query, then ranks by cosine. No re-embedding the
  whole store on every recall.
- **Server-owned metadata** (`id`, timestamps, `access_count`, `importance`, `deleted`),
  never assigned by the model. Soft delete + startup `vacuum()`.
- **Swappable store** (`JsonlStore`) behind the verbs, so the JSONL backend can be
  replaced later without touching the MCP API.
- **Ranking is cosine only.** Importance/recency govern retention, never retrieval order.
- **Associative field** (`field.js`, opt-in) — a kNN semantic graph built from the stored
  vectors (no extra LLM calls); recall can surface a related-memory neighborhood, not just
  a flat list. Measured kNN edge precision k=2 = 0.90 vs 0.20 chance.
- **Hebbian reshaping** (`ledger.js`, opt-in) — a sidecar that reinforces co-recalled
  memories (provenance-discounted so it learns from your queries, not its own guesses),
  with a bounded `cosine + 0.3·tanh(weight)` blend, decay, and pruning.
- **Zero-terminal control panel** (`panel.js`) — a local 127.0.0.1 page with a live toggle
  for the associative field and one-click Connect/Disconnect for your AI app.
- **Auto-installer** (`install.js`) — detects LM Studio and Claude Desktop, wires the
  server into their MCP config, preserves other servers, and leaves a `.bak`.
- **Single executable** (`resonance-memory.exe`, Node SEA via `build-exe.js`) — no Node install
  required. `resonance-memory.exe` opens the panel; `resonance-memory.exe --mcp` runs the server;
  `--install` / `--uninstall` are also available on the CLI.
- **Proactive save/recall nudge** — the four tool descriptions now encode *when* to act
  (save durable facts proactively with anti-spam guards; recall at conversation start and
  on back-references), plus an optional `system-prompt.md` for weaker models.
- **Telemetry** (`inspect_sidecar.js`) — dependency-free inspection of the association
  ledger: breathing, high-weight/low-cosine "semantic leaps", provenance, and size.

### Known limitations

- The executable is **unsigned** — Windows SmartScreen / macOS Gatekeeper will prompt to
  "run anyway" on first launch.
- The **macOS binary must be built on a Mac** (SEA is per-platform); only the Windows
  build ships today.
- The data directory currently defaults to `~/.lmstudio/…` even for Claude-only users.
- The associative field is **off by default** pending validation on a real corpus.

---

## Related

[[README]] · [[ROADMAP]] · [[BACKLOG]] · [[BUGS]] · [[DEVELOPERS]]
