# 0005 — Store abstraction and the SQLite backend

**Status:** proposed · **Backlog:** `RM-07` · **Depends on:** `RM-00`

> **Spike measured 2026-09-05.** The seam in this doc still stands. The *backend
> choice* (`node:sqlite` vs `better-sqlite3`, sqlite-vec vs BLOB+JS cosine, one-way
> vs reversible migration) is decided with numbers in
> [`0010-sqlite-backend.md`](0010-sqlite-backend.md). Short version: `node:sqlite`
> works inside a SEA; sqlite-vec loads and matches brute cosine to 1e-7 but is
> *slower* than a RAM Float32 scan at 10k–100k; JSONL export/import is lossless.
> Do not implement from this file's "sqlite-vec virtual table" sketch without
> reading 0010.

## Problem

`DEVELOPERS.md` claims a swappable `Store` abstraction so the backend can be swapped without
changing the MCP API. The intent is right; the seam is only half real:

1. **There is one implementation**, so no pressure has ever tested it. Interfaces with a single
   implementor are guesses. (The layer *has* been extracted into `store.js`, so it can now be
   constructed and tested without the stdio loop — that part is done.)
2. **The interface leaks JSONL assumptions.** `applyRecall(returnedIds, embeddingById)` and
   `vacuum()` are file-rewrite operations, not storage concepts. A SQL backend would implement
   `vacuum()` as a no-op — the shape is wrong.
3. **`all()` loads the entire store into memory and re-parses it on every call** — and it's
   called by `active()`, `current()`, `get()`, `update()`, `updateMany()`, `hasDeleted()` and
   `nextId()`. This is the remaining scaling limit and the main reason for SQLite.

### The urgent part — ✅ FIXED, described below as it was

> **Status:** both problems in this section were fixed in the `BUG-001` / `BUG-002` work (see
> [`../BUGS.md`](../BUGS.md)). Writes are now atomic (`writeFileDurable`) and access counts
> moved to a sidecar, so **recall performs zero writes to the store in steady state**. The
> text below is kept as the record of why the `Store` seam needs the shape it does — read it
> as history, not as current behaviour.
>
> What remains is the *performance* half: `all()` still parses the whole store per call and
> mutations still rewrite the file. That is what SQLite is for, and it is a scaling limit
> rather than a correctness one.

```js
// what applyRecall() used to do, when it lived in server.js
applyRecall(returnedIds, embeddingById) {
  const recs = this.all();          // parse the WHOLE file
  for (const r of recs) { /* bump access_count on ~5 rows */ }
  this._writeAll(recs);             // rewrite the WHOLE file
}
```

**Every recall rewrote the entire store.** At 200 memories that was invisible. At 50,000 it
would have been a multi-hundred-millisecond stall on a *read* operation, plus:

- **A data-loss window.** `fs.writeFileSync` on the live file is not atomic; power loss or a
  crash mid-write truncated the user's entire memory, with no `.bak` on that path.
- **Unbounded memory.** The whole store, embeddings included (768 floats × N), sat in a JS
  array during every recall.
- **SSD wear** proportional to store size × recall count.

All three are gone: writes are atomic and access counts live in a sidecar, so a recall now
performs no store writes at all. The code now lives in `store.js`. What this section is *for*
is the reason the `Store` seam below has the shape it does — `touch()` exists precisely because
bumping a counter should never have been a whole-file operation.

## Design

### Step 1 — a real interface

```js
/**
 * Store — the substrate contract. Implementations must be interchangeable
 * under eval/conformance.test.js. No method may leak a storage detail
 * (file paths, SQL, rewrite semantics) to callers.
 */
class Store {
  async init() {}                              // open/migrate; idempotent
  async get(id) {}                             // -> record | null
  async current({ scope } = {}) {}             // active, not superseded (RM-04/RM-06)
  async active({ scope } = {}) {}              // active, including superseded
  async add(record) {}                         // -> id
  async update(id, patch) {}                   // -> bool
  async updateMany(patchById) {}               // several rows in ONE write (supersession)
  async touch(ids, { at }) {}                  // bump access_count/last_access. NO full rewrite.
  async backfillEmbeddings(map) {}             // id -> vector
  async searchDense(vector, { limit, scope }) {}   // -> [{id, score}]
  async searchSparse(query, { limit, scope }) {}   // -> [{id, score}]  (RM-05)
  async stats() {}                             // { count, bytes, superseded }
  async close() {}
}
```

Two changes carry the weight:

- **`touch()` replaces `applyRecall()`.** Bumping access metadata is conceptually an update to
  a handful of rows, and the interface should say so. JSONL already implements this without any
  store write at all — the counts live in an `AccessLog` sidecar (`record.js`) and are folded in
  on read; SQLite implements it as one `UPDATE ... WHERE id IN (...)`. Whichever backend, the
  rule is the same: **a read must not write to the store.**
- **`searchDense` / `searchSparse` move *into* the store.** Ranking policy stays in the
  service layer, but *index access* belongs to the backend — otherwise every backend is forced
  to hand its whole corpus to the caller, which is precisely today's problem.

### Step 2 — SQLite backend

```sql
CREATE TABLE memories (
  id             INTEGER PRIMARY KEY,
  text           TEXT NOT NULL,
  created        TEXT NOT NULL,
  modified       TEXT NOT NULL,
  valid_from     TEXT NOT NULL,          -- RM-04
  valid_to       TEXT,                   -- NULL = current
  last_confirmed TEXT,
  superseded_by  INTEGER REFERENCES memories(id),
  supersedes     INTEGER REFERENCES memories(id),
  revision       INTEGER DEFAULT 1,
  needs_review   INTEGER DEFAULT 0,
  importance     REAL DEFAULT 0,
  access_count   INTEGER DEFAULT 0,
  last_access    TEXT,
  source         TEXT DEFAULT 'user_stated',  -- RM-16 provenance
  scope          TEXT DEFAULT 'default',      -- RM-06
  agent_id       TEXT,
  session_id     TEXT,
  tier           TEXT DEFAULT 'long_term',
  deleted        INTEGER DEFAULT 0
);

CREATE INDEX idx_current ON memories(scope, deleted, valid_to);
CREATE INDEX idx_session ON memories(scope, session_id, tier);

-- Vectors (sqlite-vec)
CREATE VIRTUAL TABLE memory_vec USING vec0(id INTEGER PRIMARY KEY, embedding FLOAT[768]);

-- Keyword arm for RM-05 - BM25 for free, incrementally maintained
CREATE VIRTUAL TABLE memory_fts USING fts5(text, content='memories', content_rowid='id');
CREATE TRIGGER mem_ai AFTER INSERT ON memories BEGIN
  INSERT INTO memory_fts(rowid, text) VALUES (new.id, new.text);
END;
CREATE TRIGGER mem_au AFTER UPDATE OF text ON memories BEGIN
  INSERT INTO memory_fts(memory_fts, rowid, text) VALUES('delete', old.id, old.text);
  INSERT INTO memory_fts(rowid, text) VALUES (new.id, new.text);
END;
CREATE TRIGGER mem_ad AFTER DELETE ON memories BEGIN
  INSERT INTO memory_fts(memory_fts, rowid, text) VALUES('delete', old.id, old.text);
END;
```

`touch()` becomes what it always should have been:

```js
async touch(ids, { at = new Date().toISOString() } = {}) {
  const q = `UPDATE memories
             SET access_count = access_count + 1, last_access = ?, importance = access_count + 1
             WHERE id IN (${ids.map(() => "?").join(",")})`;
  this.db.prepare(q).run(at, ...ids);
}
```

One indexed write instead of a full-file rewrite. **`RM-05`'s keyword arm also comes free** —
FTS5 gives real BM25, incrementally maintained by triggers, so the hand-rolled `Bm25` class in
`proposed/0003` gets deleted.

### Dependency question

`better-sqlite3` is native and would break the zero-dependency, single-SEA-binary property
that makes this project shippable. Options, in preference order:

1. **`node:sqlite`** — built into Node 22+. No dependency, no native build, works in SEA.
   **Confirmed available** on the Node 22 runtime this repo builds with (`DatabaseSync`,
   `StatementSync`, `backup`), so this is the choice. The open question is only whether the
   `sqlite-vec` extension loads inside a SEA context; the fallback below covers it if not.
2. **`sql.js`** (WASM) — no native build, but loads the whole DB into memory, which defeats
   half the purpose.
3. **`better-sqlite3`** — fastest and most mature, but a native module inside a SEA blob is a
   real packaging fight across three platforms.

`sqlite-vec` is a loadable extension; if it can't be loaded in the SEA context, fall back to
storing embeddings as `BLOB` and doing cosine in JS over a **candidate set pre-filtered by
FTS5** — still far better than scanning everything, and it keeps the door open.

> **Decide this with a spike before writing the backend.** The whole design pivots on which
> SQLite binding survives SEA packaging on Windows, macOS and Linux.

### Step 3 — migration

```js
async function migrateIfNeeded(jsonlPath, dbPath) {
  if (!fs.existsSync(jsonlPath) || fs.existsSync(dbPath)) return;
  fs.copyFileSync(jsonlPath, jsonlPath + ".bak");     // never migrate without a backup
  const db = new SqliteStore(dbPath); await db.init();
  for (const r of readJsonl(jsonlPath)) await db.add(normalize(r));
  const n = (await db.stats()).count;
  if (n !== countJsonl(jsonlPath)) throw new Error("migration count mismatch - aborting, .bak kept");
  fs.renameSync(jsonlPath, jsonlPath + ".migrated");
}
```

One-way, verified by count, `.bak` always. JSONL remains the default backend until SQLite
passes conformance **and** eval parity — the migration doesn't run just because the code exists.

### Step 4 — conformance suite

```js
// eval/conformance.test.js - run against EVERY backend
for (const makeStore of [() => new JsonlStore(tmp()), () => new SqliteStore(tmp())]) {
  test("add → get round-trips all fields", ...);
  test("update patches only named fields", ...);
  test("touch bumps access_count without altering text", ...);
  test("current() excludes superseded and deleted", ...);
  test("searchDense returns ids ordered by cosine", ...);
  test("concurrent add + recall does not corrupt", ...);
  test("crash mid-write leaves a readable store", ...);     // the JSONL bug, encoded
}
```

That last two are the ones that would have caught the current problem. Encode the bug as a
test so no future backend reintroduces it.

## Risks

| Risk | Mitigation |
|---|---|
| Native dep breaks the single-file exe | Prefer `node:sqlite`; spike SEA packaging **before** building |
| Migration corrupts a user's memories | `.bak` + count verification + one-way + JSONL stays default until proven |
| Interface churn ripples into `server.js` | Land the interface **first** with JSONL behind it; SQLite is then additive |
| `sqlite-vec` unavailable in SEA | Fall back to BLOB + JS cosine over an FTS5-prefiltered candidate set |
| Two backends drift | Conformance suite is the gate; both must produce identical eval scorecards |

## Acceptance

- 100k memories: recall p95 <100ms, no full-file rewrite on any read path.
- Both backends pass conformance identically and produce identical eval scorecards.
- Migration verified on a real store, with `.bak` retained.
- **No change to the four MCP verbs.**
- Kill-9 during a write leaves a readable store. *(Already true for JSONL as of `BUG-001` —
  the SQLite backend must not regress it. Encoded in the conformance suite.)*

---

## Related

[[BACKLOG]] · [[ARCHITECTURE]] · [[BUGS]] · [[0010-sqlite-backend]] · [[proposed/README]]
