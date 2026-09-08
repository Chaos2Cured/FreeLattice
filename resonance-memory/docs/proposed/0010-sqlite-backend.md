# 0010 — SQLite backend behind the Store seam (RM-07)

**Status:** slice 1 shipped (drop-in `SqliteStore`) · slice 2a shipped (streaming JSONL→SQLite migrator) · **slice 2b shipped** (sovereignty zip export) · **slice 2c shipped** (panel export button) · **slice 3 shipped** (RM-00 golden on SqliteStore = JSONL 27/31 case-for-case) · **slice 4 shipped** (SQLite is the default; auto-migrate on first open; fail-open to JSONL) · **slice 5 shipped** (edges-in-db: EdgeStore SQLite adapter, one-file sovereignty) · **Backlog:** `RM-07` · **Depends on:** `RM-00`, [`0005`](0005-store-abstraction.md)
**Spike:** [`spike/rm-07-sqlite/`](../../spike/rm-07-sqlite/) — de-risked the driver and the vector path.
**Product:** `store-sqlite.js` `SqliteStore`, same JsonlStore method surface, `memory-core.js` verbs unchanged.

This RFC extends 0005. 0005 named the seam and guessed `node:sqlite` + `sqlite-vec`. This
document is the **measured** architecture for the backend, after a de-risking spike that
actually opened a db, loaded a vector extension, and re-ran S1 at 50k/100k — the sizes
JSONL cannot load.

---

## Why now (S1 made this a measured GO)

S1 (`eval/substrate/scale.js`, 2026-09-05) tripped RM-07's own bars:

| signal | bar | JSONL | verdict |
|---|---|---|---|
| field-off p95 at 10k | ≤ 100 ms | **488.7 ms** | GO |
| field-off p95 at 50k | ≤ 250 ms | **cannot load** (834 MB > Node ~512 MB string) | GO, harder |
| cosine-only at 50k / 100k | — | ~52 ms / ~113 ms (RamStore) | parse, not cosine |

The bottleneck was `JsonlStore.all()` → `readFileSync` + JSON.parse of embeddings-as-text.
A 50k store with 768-d vectors in JSONL is 834 MB of decimal floats. Cosine itself was
never the thing that forced SQLite.

---

## Constraints (the walls)

1. **Self-contained / portable-on-install.** One per-platform SEA exe. Zero runtime npm
   deps. The engine *and* whatever does vector search ship *inside* the exe — not a
   plugin the user installs.
2. **Data sovereignty.** The user owns the memory and can move it: copy between devices,
   or export and hand it to a competitor. SQLite is a speed/scale engine, not a trap.
3. **Invariants + golden.** Same Store method surface as `JsonlStore` so `memory-core.js`
   stays the single implementation. I5 durable writes. I9 field-off primary byte-identical.
   Four verbs. JSONL↔SQLite migration lossless and reversible.

---

## Spike findings (ran, not reasoned)

Host: Node **v24.18.0**, bundled SQLite **3.53.1**, Windows x64, 128 GB, Ultra 9 285K.
Full tables in [`spike/rm-07-sqlite/results.md`](../../spike/rm-07-sqlite/results.md).

### 1. `node:sqlite` works, including inside a SEA

- CRUD (create / insert / query) on `:memory:` — ok.
- FTS5 is compiled in. `OMIT_LOAD_EXTENSION` is **not** set. `loadExtension` exists.
- Stability 1.1 (active development), flagless since v22.13 / v23.4.
- **SEA:** `build-exe.js` copies `process.execPath`. A mini-SEA of a 20-line
  `require("node:sqlite")` script printed
  `SEA node:sqlite OK node=v24.18.0 sqlite=3.53.1`. The shipped runtime *is* the
  Node used to build. Built here → sqlite is in the exe. Built with Node 18/20 → it
  is not. `package.json` `engines` is still `>=18`; esbuild `--target=node20` is
  syntax only.

### 2. sqlite-vec loads, is correct, and is the wrong default

- `node:sqlite` `DatabaseSync(path, { allowExtension: true })` + `loadExtension(vec0.dll)`
  loaded **sqlite-vec v0.1.9**. Derived entry point worked; no npm package.
- 400 × 768-d random unit vectors: sqlite-vec top-10 **id-identical** to brute-force
  cosine, max `|Δscore|` = **6.5e-8**.
- Quirk: vec0 `rowid` binds must be **BigInt**. A JS `Number` throws
  `Only integers are allowed for primary key values on vec_items`.
- kNN latency vs cached JS cosine (field-off `recall()` through `memory-core`):

  | N | sqlite-vec MATCH | cached JS cosine | packed Float32 scan |
  |---|---|---|---|
  | 10k | 16.4 ms | **10.4 ms** | 6.1 ms |
  | 50k | 79.3 ms | **57.9 ms** | 23.4 ms |
  | 100k | **159.5 ms** | **107.6 ms** | **48.0 ms** |

  sqlite-vec is *slower* than a RAM Float32Array scan at every S1 size. It only
  beats the *uncached* "SELECT blob every query" path. Bundling it costs a
  per-platform `.dll` extracted from the SEA (stock Node cannot statically link
  it) for a path that loses on the number that matters.

### 3. SQLite loads 50k / 100k. JSONL cannot.

Uncached `SpikeSqliteStore` (re-hydrate `current()` every `recall()`, JsonlStore
surface, `memory-core` unchanged):

| N | load | db size | uncached recall p95 | current() hydrate | packed cosine |
|---|---|---|---|---|---|
| 10k | yes | 39.3 MB | 100.1 ms | 81.6 ms | 6.1 ms |
| 50k | **yes** | 196.3 MB | 614.6 ms | 470.5 ms | 23.4 ms |
| 100k | **yes** | 392.7 MB | 1638.8 ms | 1130.7 ms | 48.0 ms |

JSONL: 167 MB / 834 MB (cannot load) / 1.67 GB (cannot load). Binary blobs are
~4× smaller than JSON number arrays, which is why 50k fits.

Uncached p95 is hydrate-bound, not cosine-bound. **A Store-side vector cache**
(hydrate once, then RAM — still the JsonlStore surface; `memory-core` still
calls `current()`) is the number a product Store would ship:

| N | cached-recall p95 | vs JSONL | vs 100 ms bar |
|---|---|---|---|
| 10k | **10.4 ms** | 489 ms | under, ~47× |
| 50k | **57.9 ms** | cannot load | under |
| 100k | **107.6 ms** | cannot load | 7.6 ms over |

S1's hypothesis holds: **SQLite + BLOB + JS cosine, with an in-process cache,
is enough.** Cosine was never the bottleneck. The 100k bar is a hair over
because `memory-core` still maps 100k objects and sorts; packed cosine itself
is 48 ms. Clearing that last 8 ms is `searchDense` (0005), a later slice.

### 4. JSONL export/import is lossless

25 records including 768-d vectors, constraint flag, access_count, a superseded
row: export → stream-import → field-equal, embeddings within 1e-5. The reverse
of migration exists. Streaming import is mandatory — `readFileSync` of the JSONL
we are migrating *is* the S1 wall.

---

## Recommended architecture

### Driver: `node:sqlite` (`DatabaseSync`)

No npm dep, no native build, already in the SEA if we build with Node ≥22.5.
FTS5 comes free for RM-05. WAL + `synchronous=FULL` is the I5 analogue of
`writeFileDurable()`: a committed transaction is atomic and durable. Kill-9
mid-transaction leaves the previous commit; never a truncated store.

**Not** `better-sqlite3` (native dep, SEA fight, last resort, unused). **Not**
`sql.js` (whole DB in memory — half the reason we are here).

Bump `engines` to `>=22.5` (or `>=22.13` if we ever `loadExtension`) and build
the SEA with that Node. esbuild `--target` should follow (syntax). This is an
open decision only in the "which exact floor" sense — 18/20 cannot ship this
backend.

### Vectors: BLOB + in-process Float32Array cache + JS cosine

```sql
CREATE TABLE memories (
  id                INTEGER PRIMARY KEY,
  created           TEXT NOT NULL,
  modified          TEXT NOT NULL,
  text              TEXT NOT NULL,
  embedding         BLOB,                 -- Float32 × 768, 3072 bytes
  importance        REAL DEFAULT 0,
  access_count      INTEGER DEFAULT 0,
  last_access       TEXT,
  valid_from        TEXT NOT NULL,
  valid_to          TEXT,                 -- NULL = current
  last_confirmed    TEXT,
  superseded_by     INTEGER,
  supersedes        INTEGER,
  revision          INTEGER DEFAULT 1,
  needs_review      INTEGER DEFAULT 0,
  embedding_version INTEGER DEFAULT 1,
  source            TEXT DEFAULT 'user_stated',
  is_constraint     INTEGER DEFAULT 0,
  deleted           INTEGER DEFAULT 0
);
CREATE INDEX idx_current ON memories(deleted, valid_to);
```

On open (or first `current()`): load `id, embedding` into a packed
`Float32Array` of N×768 plus an id index. Mutations invalidate the cache.
`current()` returns records with `embedding` attached as `Float32Array`
(*after* `normalize()` — see trap below). Ranking stays cosine in
`memory-core` (I2). No unmeasured signal.

Do **not** ship sqlite-vec in the first implementation slice. Keep the door
open: `searchDense` can swap in a vec0 MATCH later if N>>100k or an ANN is
measured in. That is a packaging decision we do not have to make to clear
the load wall.

### Store method surface — JsonlStore first, 0005 extras later

First landing implements **exactly** `JsonlStore`'s methods so `memory-core.js`
is unchanged:

`all` / `current` / `active` / `get` / `add` / `update` / `updateMany` /
`applyRecall` / `vacuum` / `hasDeleted` / `nextId`

0005's `touch` / `searchDense` / `searchSparse` / `stats` are additive. They
are how we shave 107.6 → <100 ms at 100k (`searchDense` scans the packed
buffer, hydrates only top-k) and how RM-05 gets FTS5. They require a small
`memory-core` change (recall calls `searchDense` when present, else today's
`current()` + cosine). **Not this slice's product code; next slice after
sign-off can land the JsonlStore-surface Store without them.**

### Data sovereignty — lossless JSONL export/import

SQLite is the working copy. JSONL is the interchange format RM already uses.

| Direction | How | Guarantee |
|---|---|---|
| JSONL → SQLite | Stream line-at-a-time (`readline` + batched INSERT in one transaction) into a temp `.db.migrating`. Count-verify. WAL checkpoint. Atomic rename to `.db`. **Then** rename JSONL → `.jsonl.bak`. See [the 10-step protocol](#the-10-step-commit-protocol). | The 834 MB file that cannot `readFileSync` still migrates. 50k/768-d proof: **lossless in 2.5 s**. |
| SQLite → JSONL | Stream `iterate()`, reconstruct `normalize()`-shape records. Embeddings as JSON arrays (the format a competitor's importer can read without RM). **Slice 2b shipped** (`--export` zip wraps `memories.jsonl`; `--export-jsonl` is the raw primitive). | 50k/768-d: 50,000/50,000 field-equal, embeddings within 1e-5. |
| Zip / JSONL → store (RM-17) | `--import` streams `memories.jsonl` back in (direct store write, not `save()`). `--with-edges` opt-in for Hebbian; planted sidecar refused. | CLI + panel button shipped. |
| RM → RM, same/other device | copy the `.db` **after** `PRAGMA wal_checkpoint(TRUNCATE)` so `-wal`/`-shm` do not have to travel. SQLite files are cross-platform. | Convenience, not the sovereignty path. |

**`.bak` is a recovery snapshot, not the sovereignty export.** The retained JSONL is a
*pre-migration* copy: it goes stale on the next save to the `.db`. A downgraded exe
must not serve it, which is why it is renamed *off* `MEMORY_FILE_PATH`. The live
sovereignty artifact is slice 2b's `--export` zip bundle of the store as it
stands now (`--export-jsonl` is the raw scripting primitive wrapped inside).
Two artifacts, two jobs. Do not `copyFile` to `.bak` *and* keep the
original — that is two full copies of an 834 MB file; one retained original (the
rename) is enough.

Export is a **maintenance CLI + panel button**, not a fifth MCP verb.
The four-verb surface does not grow. A model that can dump the store to a
file is an exfil path. The panel button (slice 2c, shipped) shells the
same `runExport()` as `--export`.

A user leaving RM hands `memories.jsonl` (inside the zip, or via `--export-jsonl`)
to Mem0/Zep/a script. That is the anti-hoarding claim; see
[`COMPETITIVE-ANALYSIS`](../COMPETITIVE-ANALYSIS.md).

### How the invariants hold

| Invariant | Holds because |
|---|---|
| I2 ranking = cosine only | Cache is a faster load of the same vectors. No durability/recency weight. |
| I3 field fails open | Unchanged: field still `try/catch` around `field.js`. Backend is below that. |
| I5 durable writes; no *unbounded* write on a read path | Restated (ARCHITECTURE / CLAUDE / AGENTS now agree): writes are atomic + durable; a read path must not perform an unbounded / full-corpus rewrite; retention metadata MAY be updated on recall if that update is bounded, atomic, and cannot truncate the store. **JSONL** = AccessLog sidecar (unchanged). **SQLite** = one `BEGIN`/`UPDATE`/`COMMIT` of the ~5 returned ids, `synchronous=FULL`. Vector backfill of vectorless rows stays the self-extinguishing I4/I5 exception. |
| I6 reading never drives decay | Unchanged: `effectiveHebbian` is computed on read, never stored (a SELECT is not an UPDATE). Slice 5 did not add an `effective_hebbian` column. |
| I9 field on/off primary byte-identical | Ranking still cosine over the same vectors. Backend cannot reorder. |
| Four verbs | No new tool. Export/migrate are CLI. |
| Zero runtime deps | `node:sqlite` is the runtime. No `package.json` `dependencies`. |

### Trap: `normalize()` drops `Float32Array`

`record.normalize()` keeps `embedding` only if `Array.isArray`. A typed array
is a view, not an Array — it becomes `null`. The spike stored NULLs for a
whole run before catching this. Product `SqliteStore` must either:

- attach `embedding` *after* `normalize()`, or
- teach `normalize()` to accept ArrayLike (a behaviour change in `record.js`,
  needs a test that fails without the fix).

Silent vector loss if forgotten. Encode as a test.

### Per-platform packaging

```
build-exe.js copies process.execPath
        ↓
SEA is Node 22.5+/24 with node:sqlite compiled in
        ↓
esbuild leaves `require("node:sqlite")` external (node builtin)
        ↓
no .dll, no .node, no extract-on-first-run
```

If a later slice bundles sqlite-vec: embed `vec0.{dll,so,dylib}` per platform
in the SEA blob, extract to `os.tmpdir()` (or beside the exe) on first open,
`loadExtension` with `allowExtension: true`. Not recommended now.

---

## Slice 1 (shipped) — drop-in `SqliteStore`

Landed. Selectable, not the default.

- Driver: `node:sqlite` `DatabaseSync`. No npm `dependencies`. WAL +
  `synchronous=FULL`. `engines` ≥22.5; esbuild `--target=node22`.
- Schema: `memories` table, `normalize()` fields as columns, opaque `id`
  preserved (never AUTOINCREMENT-renumbered), `created` a real TEXT column,
  embedding a Float32 BLOB. Access counts **in the row**. `SqliteStore`
  never constructs `AccessLog` (BUG-007).
- Vectors: BLOB + in-process record cache (hydrate once) + JS cosine in
  `memory-core`. No sqlite-vec.
- `normalize()` still drops `Float32Array`; the store attaches after.
  Encoded as a regression test.
- Selectability: `RESONANCE_STORE=sqlite` or live-config `store: "sqlite"`.
  Sibling path `*.jsonl` → `*.db`. Default was JsonlStore this slice;
  slice 4 flipped it.
- I5 operationalized per backend as above. BUG-002 SQLite test: after
  recall, only retention columns changed on the returned rows; row count
  unchanged.
- Conformance: same save/recall/edit/delete/all/vacuum/retention ops on
  both backends, identical observables.
- Product S1 (2026-09-05, this slice, `--store sqlite --n 50000,100000
  --no-field --latency-only --offline`): **loads** 50k (206 MB) and 100k
  (412 MB). Field-off cached recall p95 **49.6 ms @50k, 96.4 ms @100k**.
  JSONL cannot load either size. The 100k <100 ms bar is cleared on the
  JsonlStore surface without `searchDense`.

## What this slice is *not* (later slices)

- Ripping out `JsonlStore`. JSONL remains the pin (`RESONANCE_STORE=jsonl`),
  the fail-open backend, the export interchange, and the eval `--store jsonl`
  path. Slice 4 made sqlite the default; JsonlStore is not deleted.
- Changing `memory-core.js` to `searchDense`. First landing is a drop-in
  Store. `searchDense` is a later shave (packed cosine was 48 ms at 100k
  in the spike); the product cache already cleared 100 ms.
- Adding npm dependencies.
- Panel export button (**slice 2c, shipped**). `--export` / `--export-jsonl`
  are the CLI; the button shells the same function. Heartbeat pause lives
  with the panel (a sync 30–60s zip would otherwise starve `/api/ping` and
  `process.exit(0)` a truncated tmp).
- Edges-in-db. **Slice 5, shipped.** EdgeStore API stays; persistence is an
  adapter (JSON sidecar for JsonlStore, tables in the same `.db` for
  SqliteStore). The zip still carries `edges.json` (sourced from the table
  when the backend is SQLite).

## Slice 2a (shipped) — streaming JSONL→SQLite migrator

Landed. Opt-in CLI; slice 4's `openStore()` calls the same `migrateJsonlToSqlite()`
on first open of an existing JSONL (not a second implementation).

Product: `migrate-sqlite.js`, `node entry.js --migrate` / `npm run migrate`.
`memory-core.js` unchanged.

### The 10-step commit protocol

Settled across the design rounds. This is the data-safety spine — implement
exactly, do not "improve" the order:

1. If `<store>.db` exists and opens → it is live; a leftover `<store>.jsonl`
   is **IGNORED** (log it). Never dual-read.
2. If only `<store>.jsonl` exists → create `<store>.db.migrating` (temp).
   **STREAM** the JSONL line-at-a-time (`readline` over a read stream —
   **NEVER** `readFileSync`; that IS the S1 834 MB wall). Batched INSERT
   inside one transaction.
3. **Preserve ids** exactly — the opaque id, `superseded_by`, all provenance.
   NO AUTOINCREMENT renumber (edges + the ids the model already saw depend
   on it).
4. Fold the `<store>.access.json` (AccessLog) counts into the row columns
   **ONCE, at ingest** (BUG-007). `SqliteStore` never constructs AccessLog.
5. Count-verify: migrated row count === source line count (minus blanks);
   embeddings-present-iff-source-had-them (don't silently drop or invent
   vectors). A mismatch = abort, keep the JSONL, delete the temp.
6. WAL checkpoint (`wal_checkpoint(TRUNCATE)`) on the temp db so it's a
   clean single file at rest.
7. Atomic rename `<store>.db.migrating` → `<store>.db`.
8. **THEN** rename `<store>.jsonl` → `<store>.jsonl.bak` and
   `<store>.access.json` → `.bak`. Recovery snapshots — NOT the sovereignty
   export. Rename OFF `MEMORY_FILE_PATH` so a downgraded exe can't serve
   the stale JSONL.
9. Failure BEFORE step 7 → JSONL is still live at its path, delete the
   temp `.db`, retry next run. **NO resume-from-partial.**
10. Log: `migrated N memories; original kept at <path>.bak`.

Do **not**: `copyFile` to `.bak` AND rename to `.migrated` (two full copies
of an 834 MB file); dual-write JSONL after migration; add a "switch back
to JSONL" env (footgun). `JsonlStore` stays for tests / conformance / export.

An empty `.db` sitting beside a still-live JSONL is the slice-1
`openStore()`-created footgun, not a completed migrate (a completed migrate
would have renamed JSONL off the path). `--migrate` refuses that state
rather than ignore the JSONL. Slice 4's `openStore()` drops the empty `.db`
and auto-migrates — finishing step 8 on that state would rename the real
store away.

Kill-9 before step 7: JSONL stays at its path, no half `.db` sits at
`MEMORY_FILE_PATH`, leftover `.db.migrating` is dropped on the next run
(no resume-from-partial), re-run completes.

### 50k lossless proof (2026-09-05)

S1 generator, 50k records, 768-d synthetic vectors, access sidecar fold,
a vectorless row, a 2019 `created`, a superseded pair, a deleted row.
`node eval/substrate/migrate-proof.js`.

| | |
|---|---|
| JSONL size | **785.3 MB** (823,425,829 bytes) |
| `readFileSync` | **FAILED** — `Cannot create a string longer than 0x1fffffe8 characters` (the S1 wall) |
| stream-migrate | **2.456 s** → 50,000 rows, 196.3 MB `.db` |
| lossless | **yes** — 50k/50k field-equal, embeddings within 1e-5, ids preserved, `created` preserved, access 2+3=5 (not doubled to 8), vectorless stayed vectorless |

The stream is the thing that beats the wall. Holding 50k parsed objects is
fine on this box; materializing the JSONL as one UTF-8 string is not.

---

## Slice 2b (shipped) — sovereignty export (zip + `--export-jsonl`)

Landed. READ-ONLY CLI, not a fifth MCP verb, not a golden-path change.
`memory-core.js` is untouched. The panel button is **slice 2c (shipped)**.

This is the anti-lock-in artifact: the user's memory as a file they own and
can carry to another device or hand to a competing provider. It lands
*before* the default switch (slice 4) so migrating never opens a lock-in
window. We do **not** sanitize the export (filtering your own data out is
the opposite of sovereignty; Tier-1 refusal does not re-run).

Product: `zip.js` (zero-dep ZIP64 writer), `export-memory.js`,
`node entry.js --export` / `npm run export`. `--export-jsonl` stays as the
raw scripting primitive; the zip wraps it, does not replace it.

### The bundle (one `.zip`)

Settled across the design rounds (0010 + export deliberation 1–3).
Top-level folder = archive name (anti-tarbomb). Default dest = **Desktop**
(fallback home, then beside the store). `--name` defaults to
`resonance-memories-<local-date>` and is both the `.zip` filename and the
root folder; never overwrite → `Name (2).zip`.

| Member | Why | Compression |
|---|---|---|
| `memories.jsonl` | Machine interchange: `normalize()`-shape, one record per line, embeddings as JSON arrays. A competitor reads this **without our exe**. | DEFLATE (`createDeflateRaw`) |
| `memories/YYYY/MM/DD/<id>-<slug>.json` | Human-browsable, selectively extractable. Path = pure `f(created)` UTC, zero-padded, **always day-granular** (no dynamic spill; ~70 files/day at 50k). Text + metadata, **no embedding vectors** (they'd bloat it 800 MB+ and bury the sentence; re-embed on import). Pretty-printed. | STORE |
| `catalog.txt` | Flat scan index (id · status · created · **path** · **bytes** · first ~80 chars). Usable without unzipping; the fallback when Explorer chokes on tens of thousands of members. Encoding-safe index for CJK names. | STORE |
| `edges.json` | Hebbian sidecar. Without it the export is a "memory-amnesia machine" — facts carried, learned associations abandoned. Semantic cache may drop (recomputable); Hebbian weight may not. `processed_ids` / config stay OUT (runtime / prefs, not memory). | STORE |
| `manifest.json` | Counts (total/current/superseded/deleted), export time, RM version, schema version, **`layout: "memories/YYYY/MM/DD"`**, what's in/not-in. | STORE |
| `README.txt` | Plain text (Windows double-clicks it): these are your memories, you own them, this is a diary not a settings file, filenames may contain memory text, `memories.jsonl` is the importable half, use `catalog.txt` at scale, extract to a short path (Windows MAX_PATH). | STORE |

Whole store, including deleted and superseded. History is the point.

**Slug rule** (safety-only — don't sanitize into unrecognizable junk):
`<id>-<slug>.json`. Lowercase, spaces→hyphens, strip filesystem-illegal
(`<>:"/\|?*`, controls, trailing dots/spaces). Windows reserved
(`CON`/`PRN`/`NUL`/`COM1-9`/`LPT1-9`/empty) → `<id>.json`. **No hash
suffix.** Cap ~40 at the last hyphen (keep whole words). **Don't ASCII-fold
non-Latin** — a CJK memory folded to empty→`<id>.json` is the payload
failure for a whole class of users; preserve letters from any script and
set the UTF-8 flag on the zip entry.

### The zip writer

Zero npm deps. `package.json` stays clean. Local file headers +
`zlib.createDeflateRaw` (**not** `createDeflate` — the zlib wrapper makes
Explorer reject the entry) + `zlib.crc32` (Node ≥22.5) + central directory
+ EOCD. **ZIP64 is mandatory** (extra field + ZIP64 EOCD + locator on every
archive): classic zip caps at 65,535 entries; 100k individual files exceed
it → a corrupt archive at the exact scale RM-07 exists for. There is no
classic-only path that works at 10k and corrupts at 70k. Stream to
`<name>.zip.tmp` and rename at EOCD (a killed export must not leave a
truncated file that looks like a valid zip). Never materialize the 785 MB
jsonl in memory — stream the Store (`iterate()` / SQLite cursor).

### 50k proof (2026-09-05)

S1 generator, 50k records, 768-d synthetic vectors, planted CJK / `CON` /
deleted / superseded rows, Hebbian sidecar with `processed_ids` that must
not travel. `node eval/substrate/export-proof.js`.

| | |
|---|---|
| SqliteStore | **196.3 MB** (205,840,384 bytes) |
| export | **34.3 s** → 50,005 entries, **387.0 MB** zip |
| `memories.jsonl` uncompressed | **791.7 MB** (830,119,709 bytes) — streamed, never one string |
| Windows `ZipFile.OpenRead` | **50,005** entries |
| lossless jsonl round-trip | **yes** — 50k/50k field-equal, embeddings within 1e-5 |
| catalog paths | 50,000/50,000 resolve |
| layout | `memories/YYYY/MM/DD` |
| CJK slug | preserved (`49997-记忆测试-—-这是一条中文记忆.json`) |
| reserved `CON` | `<id>.json` |
| `edges.json` | Hebbian weight present; `processed_ids` omitted |
| store mutated | **no** |
| synthetic ZIP64 | **70,000** entries, Windows opens 70,000, 0.9 s |

The panel button (**slice 2c, shipped**) was the last UX gate before the
default-switch (slice 4).

---

## Slice 2c (shipped) — panel "Export my memories" button

Landed. Discoverable sovereignty: export is a visible button on the local
`127.0.0.1` control panel, not a CLI flag someone has to know exists.
**Not an MCP tool.** A model that can dump the store to a file is an
exfil path; the four verbs stay four. Panel + CLI only.

Product: `panel.js` GET/POST `/api/export` shells `export-memory.js`
`previewExport()` / `runExport()` (the 2b engine — no second writer).
The server writes the zip to Desktop (fallback home) and returns the
path. A browser cannot pick an arbitrary FS path, and streaming a
GB-class zip through the download manager is a footgun at 100k.

Confirm modal (nothing is written until Export):

- what it does: writes a `.zip` of YOUR memories (`memories.jsonl` + one
  file per memory) to the path shown
- what it does **not**: nothing deleted, nothing sent, live store stays
  put — it says "read-only" because it is
- count (N memories, current vs history) + uncompressed-size estimate
- destination path (Desktop default)
- one-line note that filenames may contain a preview of the memory
- `[Export]` / `[Cancel]`

On Export: POST → zip on disk → `"saved to <path>"` toast + copy-path
(same clipboard pattern as the system prompt) + on Windows
`explorer /select,<path>`. Button disabled in-flight (a double-click is
two concurrent writers; server 409). Honest "Exporting… (this can take a
minute at large N)" — not a fake percentage that stalls on the jsonl
deflate. Empty store: modal still opens (count 0); Export writes a
README + empty jsonl bundle. User store only — never `demo-seed.jsonl`.
JSONL and SQLite both work (the engine handles both).

**Heartbeat pause + yield (load-bearing).** `panel.js` exits if
`/api/ping` is idle >12s. Node is single-threaded; a synchronous 30–60s
zip of 50k members means pings don't get answered → `process.exit(0)` →
truncated tmp on the Desktop. Export (a) pauses the watchdog for the
duration and (b) `setImmediate`s every N records so the spinner stays
alive. Re-arms when done/failed.

This clears the last UX gate before slice 4 (default switch: new stores
→ sqlite; existing JSONL auto-migrate first-open with the 10-step
protocol). Slice 5 (edges-in-db) shipped; 6 `searchDense` is only-if-250k+,
7 smart-recall is the next track.

---

## Slice 3 (shipped) — RM-00 golden on SqliteStore

Landed. The drop-in contract: same `memory-core.js`, different Store, **identical
scorecard**. This is the bar that unblocks the default switch (slice 4) — 2b
export/zip and 2c panel button have shipped.

Product: `eval/run.js --store sqlite` (also `RESONANCE_STORE=sqlite`; `--store`
wins). `eval/pipeline.js` is unchanged — the Store is injected; sqlite vs jsonl
is `openStore({ backend })` in the runner. Offline + deterministic: vectors
still come from `eval/embeddings.cache.json`; SqliteStore holds them as
Float32 BLOBs for the run. The sqlite gate is **two-sided parity** against
`golden.json` (fail→pass is as much a STOP as pass→fail). `--accept` is
jsonl-only so an f32 quirk cannot rewrite the lock.

### Scorecard (2026-09-05)

Both backends: **27/31**, same cases passing and failing. No flips.

| | jsonl (`--store jsonl`) | sqlite (default / `--store sqlite`) |
|---|---|---|
| TOTAL | 27/31 | 27/31 |
| field lifted fail→pass | 3 | 3 |
| field BROKE | 1 (`adv-height-homonym`) | 1 (same) |
| ROC off / on | 1/4 / 4/4 | 1/4 / 4/4 |
| TBR off / on | 0/4 / 1/4 | 0/4 / 1/4 |
| gate | No regressions vs golden. | SqliteStore scorecard matches golden case-for-case. |

Reproduce: `node eval/run.js` (sqlite default, slice 4) and
`node eval/run.js --store jsonl`. Side-by-side in
[`eval/RESULTS.md`](../../eval/RESULTS.md) "RM-07 slice 3" (parity) and
"RM-07 slice 4" (default switch).

### f32 vs f64 (the near-tie watch)

JsonlStore persists embeddings as JSON number arrays (IEEE-754 float64).
SqliteStore packs Float32 BLOBs. Cosine of a 768-d unit vector could in
principle differ in the ~7th decimal and swap a rank-5/6 near-tie, or
push a pair across `DEDUP_HI` 0.95. **On this corpus it did not, and
the reason is measured, not hoped:**

- Every component in `eval/embeddings.cache.json` (354 vectors, 271,872
  floats, `nomic-embed-text-v1.5`) is already an exact f32:
  `Math.fround(x) === x` for all of them. Packing is lossless. Pairwise
  `|cos(f64,f64) − cos(f64, f32)|` over the cache is **0**.
- Tightest HI pair (tea): cosine **0.952246** on both paths, **0.002246**
  above `DEDUP_HI` 0.95. That margin is three orders above f32 ulp; a
  band flip would need a bug, not rounding.
- Primary-hit **text** order was identical on all 31 golden checks
  (opaque ids differ because `nextId()` is `Date.now()` per save).

No tolerance was added to the parity gate. A silent epsilon would hide a
genuine inequivalence; this run did not need one. If a future embedder
emits values that are not f32-exact and a case actually flips, the honest
move is to name the case and decide then — not to pre-paper the gate.

This clears the default-switch *eval* gate. Slice 2b (export/zip) and
slice 2c (panel button) have landed, so a migrated user can leave from
the UI as well as the CLI. Slice 4 is the default switch.

---

## Slice 4 (shipped) — the default switch

Landed. This is the slice that delivers RM-07's value to a real user: new
stores are SQLite, and an existing JSONL user (the one who hit the 50k
wall and will never run `--migrate`) is auto-migrated the first time they
open. Sovereignty (2b) already shipped, so migrating no longer opens a
lock-in window. Slice 3 proved SqliteStore ≡ JsonlStore on the golden
(27/31), so flipping the default is behaviour-safe.

Product: `openStore()` in `store.js` is the one construction path. It
**calls** `migrateJsonlToSqlite()` (the 2a protocol) — it does not
reimplement it. `openStore` is async because the protocol streams.

### Backend-selection order

Given the configured `MEMORY_FILE_PATH` (still a `*.jsonl` path) and no
explicit backend override:

1. **`RESONANCE_STORE=jsonl` (or live-config `store: "jsonl"`)** → JsonlStore.
   The override stays — a user can pin JSONL. (`RESONANCE_STORE=sqlite`
   forces sqlite, same walk as the default.)
2. **`<stem>.db` exists and opens** → SqliteStore. If a leftover
   `<stem>.jsonl` also sits at the path (the 2a crash-between-step-7-and-8
   case), **finish step 8**: rename the JSONL → `.bak` now (the `.db` is
   already the live truth). Log it. Never dual-read.
3. **No `.db`, but `<stem>.jsonl` exists** → **AUTO-MIGRATE** via the 2a
   10-step protocol, then open the `.db`. **Fail-open (I3-spirit at the
   store level):** if migration throws before the atomic rename, keep the
   JSONL live, drop the temp, open JsonlStore. A failed auto-migrate must
   NEVER block the user from their memories. Log, retry next open.
4. **Neither exists (new user)** → create a fresh SqliteStore (`.db`).

An empty `.db` beside a still-live JSONL is the slice-1 footgun, not live
truth. `openStore` drops the empty artifact and auto-migrates — finishing
step 8 on that state would rename the real store away.

Export is **read-only** and must not migrate: `openExportStore` inspects
the filesystem (`.db` if present, else JSONL) and never creates a `.db`.
The panel demo graph never goes through `openStore` — auto-migrating
`demo-seed.jsonl` would mutate a tracked file.

### Data-safety

- Same 2a protocol. Lossless, kill-9-safe, keeps `.bak`.
- Failed/aborted auto-migrate → the user still opens their JSONL and
  loses NOTHING.
- Do **not** delete the `.bak` (recovery snapshot). Live `--export-jsonl`
  is the sovereignty copy. Two artifacts, two jobs.
- **Downgrade honesty:** after a store is `.db`, an old exe opening the
  `.bak` sees a stale store. Recovery is `--export-jsonl` before
  downgrade, or keep the new exe. The `.bak` is not a two-way door. No
  "switch back to JSONL and dual-write" env.

### Eval

`node eval/run.js` (no flag) is sqlite — two-sided parity against
`golden.json`, 27/31. `--store jsonl` keeps the JSONL path testable
(one-way regression gate, still 27/31). `--accept` is jsonl-only so an
f32 quirk cannot rewrite the lock.

---

## Slice 5 (shipped) — edges-in-db (one-file sovereignty)

Landed. With SQLite the default, a user's memory was still `<store>.db` +
`<store>.edges.json`. "Your memory is ONE file you carry" is true only once
the learned associations live in the same `.db`. This slice is a
**persistence adapter**, not a fold-into-`SqliteStore`. EdgeStore's API
(`get` / `put` / `reinforce` / `reinforceRecall` / `pruneSweep` / `vacuum` /
`acceptRequest` / `effectiveHebbian` / `incident` / …) is unchanged;
`memory-core.js` consumers did not change.

- **Adapter select.** SqliteStore → `edges` + `edge_processed_ids` tables
  in the same `DatabaseSync` (one WAL, one file). JsonlStore → the
  `.edges.json` sidecar, unchanged, for as long as JSONL is a live write
  path. `openEdgeStore({ store, storePath })` is the construction path
  `server.js` / `eval/pipeline.js` / the panel use.
- **Schema.** Two-signal record (semantic `{value, src_versions}`, hebbian
  `{weight, last_updated}`, provenance, created_at, prune fields).
  `effectiveHebbian` is **never a column** (I6: decay is math on read).
- **0.3 atomicity fix.** JSON sidecar: `processed_ids` + the weight change
  were "durable each, not atomic as a pair" if split across files. SQLite:
  the dedup-id claim and the weight UPDATE COMMIT together. A
  throw-before-commit rolls back **both**.
- **Crash-domain.** Edges mutations run in their own transaction. A thrown
  edges write cannot poison the memories connection. Conformance: an edges
  write failure leaves memories recallable.
- **Migration.** On the same first-open as slice 4: leftover
  `<store>.edges.json` + empty edges table → ingest, count-verify, rename
  sidecar → `.bak`. Fail-open if missing/corrupt (I3). Do not merge a
  leftover `.assoc.json` if `.edges.json` exists (existing authority rule).
- **Export (2b).** When the backend is SQLite, `edges.json` in the zip is
  sourced from the table (Hebbian data; `processed_ids` still omitted).
  One `.db` copy carries everything; the bundle still separates facts
  (jsonl) from associations (edges.json) as designed.
- **config.json stays a sidecar.** Prefs ≠ memory.

Phase 0.2–0.5 edge matrix is parameterized and green on **both** adapters.
RM-00 golden 27/31 unmoved (I9: primary cosine is byte-identical; the
persist swap is not a ranking change). `searchDense` (slice 6) is only-if
250k+; smart-recall is the next track. RM-07's sovereignty promise is
closed: one file, everything in it, yours to carry.

---

## Open decisions (Samuel)

These are product calls. The spike is evidence, not a substitute.

1. **Vector path.** Recommend **BLOB + JS cosine + in-process cache, no
   sqlite-vec in v1.** sqlite-vec works and matches brute force, but it is
   slower at 10k–100k than RAM cosine and costs a per-platform `.dll` in the
   SEA. Bundle it later only if N>>100k is measured and RAM cache is the
   problem (307 MB of float32 at 100k; 3 GB at 1M).
2. **SEA Node floor.** Recommend **build and `engines` ≥22.5** (24.x is what
   this box ships). Node 18/20 SEAs cannot include `node:sqlite`. This is a
   user-visible "minimum Node to *build*" change; end users still get an exe.
3. **100k <100 ms bar.** Cached JsonlStore-surface recall is **107.6 ms** at
   100k — 7.6 ms over 0005's acceptance. Options: (a) accept 108 ms for the
   first landing (50k is 58 ms; the load wall is gone); (b) land `searchDense`
   in the same implementation slice (packed 48 ms + hydrate k rows) — a
   `memory-core` change. Recommend **(a) then (b)** so the drop-in Store is
   reviewable without a recall-path diff.
4. **Default backend.** **Settled, slice 4 shipped.** SQLite default for
   new stores; existing JSONL auto-migrates on first open with `.bak`.
   JSONL remains the pin, the fail-open backend, and the export
   interchange. Parity is proven (slice 3, 27/31 case-for-case).
   Slice 5 closed the remaining `.edges.json` sidecar: one `.db` carries
   memories + access + associations.
5. **Move-between-devices story.** `.db` copy (after checkpoint) for RM↔RM;
   JSONL export for leaving RM / handing to a competitor. Recommend **both**,
   with JSONL as the documented sovereignty path (embeddings as JSON, no RM
   needed to read them). **Slice 5:** a checkpointed `.db` is now the whole
   memory (facts + associations), not `.db` + `.edges.json`.
6. **Access counts on recall.** **Settled this slice.** I5 restated (no
   letter-vs-spirit exception): JSONL keeps the AccessLog sidecar for as
   long as it is a live write path; SQLite does a bounded in-table `UPDATE`
   of the returned ids. `SqliteStore` never constructs `AccessLog`.
7. **`normalize()` ArrayLike embeddings.** Teach `normalize()` to keep
   typed arrays, or always attach after? Recommend **attach after** in
   SqliteStore and add a test; don't change the JSONL migration-on-read
   path unless we have a reason.

---

## Implementation slice (after sign-off) — suggested order

1. `SqliteStore` in `store.js` (or `store-sqlite.js`) with the JsonlStore
   surface, WAL, BLOB embeddings, in-process cache. Flag / env to select
   backend. `memory-core.js` unchanged.
2. Streaming migrator JSONL→SQLite (**slice 2a, shipped** — `--migrate`) +
   export SQLite→JSONL (**slice 2b, shipped** — `--export` zip /
   `--export-jsonl`) + panel button (**slice 2c, shipped**). `.bak` is
   the recovery snapshot from 2a, not the export. Not an MCP tool.
3. Conformance suite both backends (0005 step 4). Encode BUG-001/002.
4. `normalize()` typed-array trap test.
5. RM-00 golden on SqliteStore — must match JSONL scorecard. **Shipped (slice 3).**
6. Re-run S1 against the product Store at 50k/100k; expect cached-recall
   numbers, not the uncached hydrate curve.
7. Docs (`CLAUDE.md` storage section, BACKLOG tick, COMPETITIVE-ANALYSIS
   already updated here). Default-backend switch is decision 4.

`searchDense` + FTS5 (`searchSparse`) are a *following* slice. They are how
RM-05 gets cheap and how 100k drops under 100 ms.

---

## Risks

| Risk | Mitigation |
|---|---|
| `node:sqlite` still Stability 1.1 | Pin the SEA Node version we tested (24.18.0 / sqlite 3.53.1). Conformance suite. Node 22.5+ has had the API for a year; 1.1 is "may still move", not "broken". |
| SEA built with Node <22.5 | `engines` bump + CI/build Node pin. Mini-SEA smoke in the spike is the regression test to keep. |
| Cache staleness | Invalidate on `add`/`update`/`updateMany`/`vacuum`. Single-threaded MCP process: no reader/writer race. |
| Migration of an 834 MB JSONL | Stream. Never `readFileSync` the whole file. `.bak` + count. |
| Two backends drift | Conformance + golden. Same `memory-core`. |
| RAM at 100k (cache ~300 MB of float32) | Fine on any machine that was trying to hold an 834 MB JSONL string. At 1M, revisit sqlite-vec / mmap. |
| `normalize()` silent vector drop | Test. Attach after. |

---

## Acceptance (for the implementation slice, not this RFC)

Carried from 0005, updated with measured numbers:

- 50k memories: load succeeds; field-off recall p95 <100 ms with the cache
  (spike: 57.9 ms).
- 100k memories: load succeeds; p95 is <110 ms on the JsonlStore surface
  (spike: 107.6 ms) and <100 ms once `searchDense` lands (packed cosine 48 ms).
- No full-file rewrite on any read path.
- Both backends pass conformance; RM-00 golden is identical.
- JSONL↔SQLite round-trip lossless (count + field equality, embeddings
  within 1e-5).
- Kill-9 mid-write leaves a readable store (WAL).
- **No change to the four MCP verbs.**
- `package.json` still has no `dependencies` block.

---

## Related

[[0005]] · [[BACKLOG]] · [[COMPETITIVE-ANALYSIS]] · [[ARCHITECTURE]] · [[spike/rm-07-sqlite]]
