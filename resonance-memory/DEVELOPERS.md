# Resonance Memory — developer notes

An MCP memory server for local LLMs that a small model can't misuse. Pure Node standard
library + built-in `fetch` (Node 18+), no SDK. Speaks MCP over stdio as line-delimited
JSON-RPC 2.0. The graph/store is the **substrate**; the model only ever sees four verbs and
an opaque `id`.

## Files

| File | What it is |
|---|---|
| `server.js` | The MCP server. Four verbs: `save_memory`, `recall_memory`, `edit_memory`, `delete_memory`. |
| `record.js` | The shared record schema (incl. temporal fields and `embedding_version`), durable atomic writes, and the access sidecar. |
| `store.js` | Store seam. `openStore()` default-switch (slice 4): SQLite default; JSONL auto-migrates on first open; fail-open to JSONL. Slice 5 also ingests a leftover `.edges.json` into the same `.db`. `RESONANCE_STORE=jsonl` pins JSONL. |
| `test.js` | Dependency-free test suite: `npm test`. |
| `package.json` | No dependencies — scripts only (`test`, `build`, `panel`, `mcp`, `seed`, `inspect`, `dedup-existing`, `migrate`, `export`, `import`). Sole source of the version string; `server.js` reads it so `serverInfo` can't drift. |
| `field.js` | Associative layer (Phase 2a): kNN semantic graph over stored vectors; neighborhood expansion. |
| `ledger.js` | Retired Hebbian sidecar (Phase 2b). Off the live path; kept as the epoch-decay reference. |
| `edges.js` | Unified persistent edge store (Phase 0): two-signal record + one-way `.assoc.json` → `.edges.json` migration. On the live recall path. Save-time semantic neighbors persist on `save()` (K=5, min cosine 0.25); recall still uses `field.js`. Hebbian decay is lazy wall-clock via `effectiveHebbian` (I6). Reinforce materializes the decayed weight before applying α; MCP request-ID dedup LRU (Phase 0.3). **RM-07 slice 5:** persistence adapter — SqliteStore shares the `.db`; JsonlStore keeps the sidecar. Soft prune (0.4 / I8) is an explicit `pruneSweep()` (not recall/save); reactivation is in-place on save/edit of an endpoint. |
| `extract.js` | RM-01.c Tier 2: opt-in LLM extraction (prompt, parser, sanity, chat/sampling, capability detect). Off by default. |
| `panel.js` | Local 127.0.0.1 control panel: field toggle, LLM-extraction toggle (surfaced when a capable model is detected), Connect/Disconnect, association graph view, first-run empty-store nudge (RM-20), **Export my memories** (slice 2c) / **Import memories** (RM-17: confirm modal, POST `/api/import` shells `runImport()`, with-edges default-off, heartbeat pause + yield), heartbeat auto-shutdown. **W-02:** Host/Origin lock + per-process `X-Resonance-Token` on POSTs. No CORS. Not an MCP tool. |
| `install.js` | Detect + wire into LM Studio / Claude Desktop MCP config (preserves other servers, leaves `.bak`). |
| `entry.js` | Bundle dispatch: `--mcp` → server, `--install`/`--uninstall` → installer, `--dedup-existing` → RM-02.c backfill (dry-run default), `--migrate` → RM-07 slice 2a JSONL→SQLite, `--export` / `--export-jsonl` → RM-07 slice 2b sovereignty export, `--import` → RM-17 restore (dry-run default), else → panel. |
| `dedup-existing.js` | RM-02.c CLI. Reports (or `--apply`s) cosine-banded restatements/merges on a store written before 02.b. Calls `dedupExisting()` in `memory-core.js` — same bands as `save()`, no second decision. |
| `migrate-sqlite.js` | RM-07 slice 2a. Streaming JSONL→SQLite (10-step protocol). Opt-in CLI; `openStore()` calls the same function on first open (slice 4). `.bak` is a recovery snapshot, not the sovereignty export. |
| `zip.js` | Zero-dep ZIP64 writer (slice 2b). `createDeflateRaw` + `zlib.crc32` + stream to `.zip.tmp` + rename. ZIP64 on every archive. |
| `export-memory.js` | Slice 2b CLI + the engine the 2c panel button shells. `--export` writes the zip bundle; `--export-jsonl` is the raw primitive. Read-only. Not an MCP tool. |
| `import-memory.js` | RM-17 CLI + the engine the panel import button shells. `--import` dry-run default; `--apply` restores. Direct store write (not `save()`). `--with-edges` opt-in for Hebbian. Not an MCP tool. |
| `build-exe.js` | Embed runtime assets → esbuild → Node SEA blob → postject → OS finish (Windows PE flip / macOS ad-hoc codesign / chmod) → stage `dist/`. `--target win\|linux\|macos`; refuses to cross-compile. |
| `ci/smoke-exe.js` | RM-11 CI smoke of a just-built binary (`--mcp` initialize + `tools/list`, four verbs, timeout-kill). |
| `ci/release-meta.js` | RM-11 CI: tag/`package.json` gate, runner asserts, checksums, Release notes. |
| `.github/workflows/ci.yml` | Always-on PR/main gate (`node test.js` + `node eval/run.js` on `ubuntu-latest`). Complements the release matrix; does not build binaries. Checks UI: `CI / gate`. |
| `.github/workflows/release.yml` | RM-11 release matrix (the macOS build path). `v*` tag → gate + native SEA on windows/ubuntu/macos-latest → smoke → GitHub Release. |
| `embedded-assets.js` | **Generated** each build (gitignored): `demo-seed.jsonl` + `system-prompt.md` baked in as strings so the shipped exe is one self-contained file. |
| `inspect_sidecar.js` | Dependency-free telemetry for the Hebbian ledger. |
| `build-demo-seed.js` | Regenerates `demo-seed.jsonl` (synthetic, pre-embedded) via the embedder. |

## Store & embeddings

- SQLite is the default backend (RM-07 slice 4). `MEMORY_FILE_PATH` is still a
  `*.jsonl` path (`~/.lmstudio/resonance-memory.jsonl`); `openStore()` walks it:
  jsonl pin → JsonlStore; `.db` exists → SqliteStore (leftover JSONL → `.bak`,
  never dual-read); JSONL only → auto-migrate via the 2a protocol then sqlite;
  neither → fresh `.db`. A failed auto-migrate fail-opens to JSONL (store
  intact, retry next open). `RESONANCE_STORE=jsonl` / live-config `store: "jsonl"`
  pins JSONL. **Slice 5:** a SqliteStore holds edges in the same `.db`
  (one-file sovereignty). JsonlStore still has two sidecars beside the stem:
  `<store>.edges.json` (Hebbian) and `<store>.access.json` (`BUG-002`). A
  leftover `<store>.assoc.json` is legacy / read-only-for-migration. A leftover
  `.edges.json` beside a `.db` migrates on first open (count-verify, → `.bak`).
  Sidecars are regenerable: deleting them loses learned associations and access
  counts, never a memory. config.json stays a sidecar (prefs ≠ memory). `npm run eval` is the sqlite parity gate (27/31);
  `--store jsonl` keeps the JSONL path testable. `--migrate` (`npm run migrate`)
  is the same 10-step protocol `openStore` calls (see
  [`proposed/0010`](docs/proposed/0010-sqlite-backend.md)). The `.bak` is a
  recovery snapshot, not the sovereignty export — do not delete it. After a
  store is `.db`, an old exe opening the `.bak` sees a stale store; recovery
  is `--export-jsonl` before downgrade, or keep the new exe. No dual-write
  "switch back to JSONL" env.
- Embeddings via an OpenAI-compatible `/v1/embeddings` endpoint (default LM Studio on
  `localhost:1234`, `text-embedding-nomic-embed-text-v1.5`, 768-dim). Keyword-overlap fallback
  if the endpoint is down. The embedder is **not bundled** — the user downloads it via LM Studio;
  we depend on the `/v1/embeddings` *interface*, not a specific model (`EMBED_MODEL` env var).
- **Third-party attribution:** `nomic-embed-text-v1.5` is © Nomic AI, **Apache 2.0**
  (<https://huggingface.co/nomic-ai/nomic-embed-text-v1.5>). Not redistributed by this project.
  Apache 2.0 is one-way compatible with our AGPL-3.0, so bundling it later would be license-clean.
- Embed **once** at save; recall embeds only the query, then cosine vs stored vectors.
  Save also runs cosine-banded dedup (RM-02.b): ≥ 0.95 restates, 0.88–0.95 merges
  (longer original text, loser linked with `superseded_by`). Thresholds are config
  (`RESONANCE_DEDUP_HI` / `RESONANCE_DEDUP_LO`).
- **`--dedup-existing`** (RM-02.c) is the offline pass for stores written before
  02.b. Dry-run default (`npm run dedup-existing`); `--apply` is one durable
  rewrite. File-order, each record vs earlier survivors — the same
  `detectNearDuplicate` decision as `save()`. Vectorless rows skip if the
  embedder is down. Second `--apply` is a no-op.
- **`--migrate`** (RM-07 slice 2a) streams a JSONL store into the sibling
  `.db`. Opt-in CLI (`npm run migrate`); slice 4's `openStore()` calls the
  same function on first open of an existing JSONL. 10-step protocol: temp
  `.db.migrating`, line-at-a-time INSERT, preserve ids, fold AccessLog once,
  count-verify, WAL checkpoint, atomic rename, **then** JSONL → `.jsonl.bak`.
  The `.bak` is a recovery snapshot, not the sovereignty export. Failure
  before the `.db` rename leaves the JSONL live; `openStore` then fail-opens
  to JsonlStore.
- **`--export`** (RM-07 slice 2b) writes the sovereignty zip bundle
  (default dest Desktop, `--name` / `--out`, never-overwrite). Contains
  `memories.jsonl` (a competitor reads it without our exe), per-memory
  files under `memories/YYYY/MM/DD/`, `catalog.txt`, `edges.json`,
  `manifest.json`, `README.txt`. **`--export-jsonl`** is the raw
  scripting primitive the zip wraps. Read-only; not a fifth verb. The
  panel **Export my memories** button (slice 2c) shells the same function:
  confirm modal, POST `/api/export`, watchdog pause + yield, toast +
  copy-path + Windows reveal. Extract to a short path (Windows MAX_PATH).
- **`--import`** (RM-17) is the return trip. Dry-run default
  (`npm run import -- the.zip`); `--apply` restores into an empty store.
  `--merge` to add to a store that already has memories (skip same-id
  same-text, remap colliding ids, dest kept). Does not go through `save()`
  — ids, embeddings, and history survive; no embedder required.
  `--with-edges` restores Hebbian from an RM export zip only; a raw
  `.edges.json` is refused (`0009` planted-sidecar). Panel **Import memories**
  button shells the same `runImport()` (confirm modal, with-edges default-off,
  heartbeat pause + yield). Not an MCP tool.

## Build

Per-OS instructions, Gatekeeper/SmartScreen, and the exact Mac steps:
[`docs/BUILDING.md`](docs/BUILDING.md).

```
node build-exe.js                  # this machine
node build-exe.js --target linux   # refuse unless this process is Linux
```

Produces a **single self-contained** binary in `dist/` (~90 MB, no Node needed on the
user's machine): `resonance-memory.exe` (Windows), `resonance-memory-linux-<arch>`,
or `resonance-memory-macos-<arch>`. The demo seed and system prompt are baked in, so
`dist/` is the binary plus a short `README.txt` — nothing loose to place beside it.
The source files stay the editable truth; only the *output* is one file. Edit
anything, re-run `node build-exe.js`, get a new binary.

SEA injects into **this** process's `node` binary, so a Linux binary is built on
Linux (WSL counts) and a macOS binary on a Mac. `--target` is a safety check, not
a cross-compiler. The Windows PE-subsystem flip (console→GUI, no console window
on double-click) runs only when building Windows on Windows; MCP mode is
unaffected because the client pipes stdio. macOS gets a free ad-hoc
`codesign --sign -` after postject (required for the kernel to exec; **not**
Developer ID / notarization). Binaries ship unsigned; see BUILDING.md for the
honest OS-warning path. Node ≥ 22.5 (`node:sqlite`).

Shippable binaries for strangers come from GitHub Releases, built by
`.github/workflows/release.yml` (native matrix, smoked on each runner).
That is also how the macOS binary is made at all — this project has no
Mac hardware. `macos-latest` is arm64; Intel macOS is not in the matrix.

## Design invariants (do not violate)

The full, ratified spec is [`INVARIANTS.md`](https://github.com/SamuelJacksonGrim/resonance-memory-stack)
in the `resonance-memory-stack` repo. The load-bearing ones:

- **Four verbs, nothing more** in the public tool surface (the interface may get simpler,
  never more cognitively demanding).
- **Ranking = cosine only.** `importance`/`access_count` govern *retention*, never *retrieval
  order* — measured: adding a durability weight to cosine inverts rankings.
- **The Hebbian layer is discovery, not ordering.** Co-activation expands the candidate set;
  it never reorders the primary cosine result.
- **Embed once at save; server owns all metadata; a `Store` abstraction sits behind the verbs**
  so the backend (JSONL now, SQLite later — see `docs/proposed/0005`) can be swapped without
  changing the MCP API. The seam lives in `store.js`.
- **Durable writes; no *unbounded* write on a read path (I5).** JSONL mutations go through
  `writeFileDurable()`; recall writes the AccessLog sidecar, never the JSONL file.
  SQLite uses WAL + `synchronous=FULL`; recall is a bounded in-table `UPDATE` of the
  returned ids. Both were violated once as a full-file rewrite; see `BUG-001`/`BUG-002`.

## Where the work is planned

| Document | What |
|---|---|
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | **Start here** — the scope/status map and phase index; current work is Phase 0 |
| [`docs/phases/`](docs/phases/) | The buildable phase specs (`phase-0` … `phase-8`): scope, steps, per-phase metrics + tests |
| [`docs/BACKLOG.md`](docs/BACKLOG.md) | Itemized work (`RM-00` … `RM-20`) with acceptance criteria |
| [`docs/BUGS.md`](docs/BUGS.md) | Known defects, fixed and open, with a watch list |
| [`docs/COMPETITIVE-ANALYSIS.md`](docs/COMPETITIVE-ANALYSIS.md) | Mem0 / Zep / Letta capability + pricing landscape, and our gaps |
| [`docs/proposed/`](docs/proposed/) | RFC-style designs with code and pseudocode |

Things a contributor should know before touching the code:

- **`proposed/0003` proposes amending the "ranking = cosine only" invariant** (hybrid
  retrieval). It ships flag-off and is promoted only on a measured A/B win. Don't flip a
  ranking default without that measurement.
- **Run `npm test` before pushing.** It's dependency-free and takes under a second.
  CI re-runs `node test.js` + `node eval/run.js` on every PR and every push to
  `main` (`.github/workflows/ci.yml`).
- **A behaviour change isn't done until the docs describing that behaviour change with it.**
  Six claims in `docs/` went stale in a single session this way — see `BUG-006`. Grep for what
  you changed before you push, and never assert how the system behaves without re-opening the
  file that decides it.

## Cross-repo plan

This is **Phase 1** of the Resonance memory stack. The portable work-order (roadmap +
per-repo backlog + architecture invariants) lives at
https://github.com/SamuelJacksonGrim/resonance-memory-stack.

---

## Related

[[README]] · [[ARCHITECTURE]] · [[ROADMAP]] · [[BACKLOG]] · [[CLAUDE]] · [[CHANGELOG]] · [[BUGS]]
