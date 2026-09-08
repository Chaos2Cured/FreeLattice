#!/usr/bin/env node
/*
 * Resonance Memory
 * Copyright (C) 2026 Samuel Jackson Grim
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
/*
 * store-sqlite.js — SqliteStore, the RM-07 drop-in behind the Store seam.
 *
 * Implements exactly JsonlStore's public method surface so memory-core.js
 * is unchanged: all / current / active / get / add / update / updateMany /
 * applyRecall / vacuum / hasDeleted / nextId. (close / addMany / stats are
 * extras; searchDense is a later slice.)
 *
 * Driver is node:sqlite DatabaseSync — no npm dependency. WAL +
 * synchronous=FULL is the I5 analogue of writeFileDurable(): a committed
 * transaction is atomic and on disk. Kill-9 mid-transaction leaves the
 * previous commit; never a truncated store.
 *
 * Vectors live as a BLOB (Float32 packed) plus an in-process record cache
 * hydrated once. Cosine stays in memory-core (I2). No sqlite-vec — the
 * spike showed a RAM Float32 scan is faster at 10k–100k and a native
 * extension is a SEA packaging problem we do not need.
 *
 * Access counts live IN THE ROW. This class must NEVER construct AccessLog
 * (BUG-007): a leftover .access.json next to a .db with access columns is
 * the doubling bug in a new costume. Folding a JSONL sidecar happens ONCE,
 * at ingest, in migrate-sqlite.js (RM-07 slice 2a). This constructor
 * refuses to touch a sibling sidecar.
 *
 * I5 restated: writes are atomic + durable; a read path must not perform
 * an UNBOUNDED / full-corpus rewrite; retention metadata MAY be updated
 * on recall if that update is bounded, atomic, and cannot truncate the
 * store. Operationalized here as one BEGIN/UPDATE/COMMIT of the ~5
 * returned ids (and, the self-extinguishing I4/I5 exception, a vector
 * backfill of vectorless rows).
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { normalize, isCurrent } = require("./record.js");

const COLS = [
  "id", "created", "modified", "text", "embedding",
  "importance", "access_count", "last_access",
  "valid_from", "valid_to", "last_confirmed",
  "superseded_by", "supersedes", "revision", "needs_review",
  "embedding_version", "source", "is_constraint", "deleted",
];

function loadDatabaseSync() {
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require("node:sqlite"));
  } catch (e) {
    throw new Error(
      "SqliteStore requires Node >= 22.5 (built-in node:sqlite). " +
      String(e && e.message || e)
    );
  }
  return DatabaseSync;
}

function embeddingToBlob(emb) {
  if (!emb || !emb.length) return null;
  if (emb instanceof Float32Array) {
    return new Uint8Array(emb.buffer, emb.byteOffset, emb.byteLength);
  }
  const f = new Float32Array(emb.length);
  for (let i = 0; i < emb.length; i++) f[i] = emb[i];
  return new Uint8Array(f.buffer);
}

function blobToF32(blob) {
  if (blob == null) return null;
  const buf = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
  // Copy onto a freshly-allocated Buffer so the Float32Array view is
  // 4-byte aligned. node:sqlite may hand back a slice of a pool whose
  // byteOffset is not a multiple of 4 (same trap scale.js documents).
  const aligned = Buffer.allocUnsafe(buf.length);
  buf.copy(aligned);
  return new Float32Array(aligned.buffer, aligned.byteOffset, (aligned.length / 4) | 0);
}

function coerceId(id) {
  if (id == null) return null;
  if (typeof id === "bigint") return Number(id);
  const n = Number(id);
  return Number.isFinite(n) ? n : id;
}

function rowToRecord(row) {
  // normalize() only preserves Array.isArray embeddings. A Float32Array is
  // a view, not an Array — it becomes null. Attach AFTER so the store's
  // BLOB representation survives (spike: a whole run stored NULLs before
  // this was caught). The schema stays normalize()'s; the vector's storage
  // form is the store's concern.
  const emb = blobToF32(row.embedding);
  const rec = normalize({
    id: coerceId(row.id),
    created: row.created,
    modified: row.modified,
    text: row.text,
    embedding: null,
    importance: row.importance,
    access_count: row.access_count,
    last_access: row.last_access,
    valid_from: row.valid_from,
    valid_to: row.valid_to,
    last_confirmed: row.last_confirmed,
    superseded_by: row.superseded_by == null ? null : coerceId(row.superseded_by),
    supersedes: row.supersedes == null ? null : coerceId(row.supersedes),
    revision: row.revision,
    needs_review: !!row.needs_review,
    embedding_version: row.embedding_version,
    source: row.source,
    is_constraint: !!row.is_constraint,
    deleted: !!row.deleted,
  });
  rec.embedding = emb;
  return rec;
}

class SqliteStore {
  constructor(file, opts) {
    // BUG-007: access counts live in the row. Do not construct AccessLog,
    // do not read a sibling .access.json, do not fold a leftover sidecar.
    // A live .access.json next to a .db with access columns is the
    // doubling bug in a new costume. Folding that sidecar happens ONCE,
    // at ingest, in migrate-sqlite.js. This constructor refuses to touch it.
    opts = opts || {};
    this.file = file;
    this.access = undefined;
    this.readOnly = !!opts.readOnly;
    if (!this.readOnly && file && file !== ":memory:") {
      fs.mkdirSync(path.dirname(file), { recursive: true });
    }
    const DatabaseSync = loadDatabaseSync();
    this.db = new DatabaseSync(file, this.readOnly ? { readOnly: true } : {});
    // WAL + FULL = I5: a COMMIT is atomic and durable. Mid-transaction
    // crash leaves the previous commit; never a half-written store.
    // Export (slice 2b) opens read-only so a sovereignty dump cannot
    // checkpoint, create a WAL, or otherwise mutate the live store.
    if (!this.readOnly) {
      this.db.exec("PRAGMA journal_mode = WAL");
      this.db.exec("PRAGMA synchronous = FULL");
    }
    this.db.exec("PRAGMA busy_timeout = 5000");
    if (!this.readOnly) this._initSchema();
    this._insert = this.db.prepare(
      "INSERT INTO memories (" + COLS.join(",") + ") VALUES (" +
      COLS.map(() => "?").join(",") + ")"
    );
    this._get = this.db.prepare("SELECT * FROM memories WHERE id = ?");
    this._all = this.db.prepare("SELECT * FROM memories");
    this._current = this.db.prepare(
      "SELECT * FROM memories WHERE deleted = 0 AND valid_to IS NULL"
    );
    this._active = this.db.prepare("SELECT * FROM memories WHERE deleted = 0");
    this._maxId = this.db.prepare("SELECT MAX(id) AS m FROM memories");
    this._hasDeleted = this.db.prepare(
      "SELECT 1 AS x FROM memories WHERE deleted = 1 LIMIT 1"
    );
    this._count = this.db.prepare("SELECT COUNT(*) AS n FROM memories");
    this._replace = this.db.prepare(
      "UPDATE memories SET created=?, modified=?, text=?, embedding=?, " +
      "importance=?, access_count=?, last_access=?, valid_from=?, valid_to=?, " +
      "last_confirmed=?, superseded_by=?, supersedes=?, revision=?, " +
      "needs_review=?, embedding_version=?, source=?, is_constraint=?, deleted=? " +
      "WHERE id=?"
    );
    this._bump = this.db.prepare(
      // Bounded retention UPDATE (I5). importance tracks access_count the
      // same way AccessLog.apply() does on JSONL — a retention signal, never
      // rank (I2b). RHS sees the pre-update row, so `access_count + 1`
      // is the new total for both columns.
      "UPDATE memories SET access_count = access_count + 1, " +
      "last_access = ?, importance = access_count + 1 WHERE id = ?"
    );
    this._setEmb = this.db.prepare(
      "UPDATE memories SET embedding = ? WHERE id = ?"
    );
    this._cache = null;   // records[] with Float32Array embeddings, or null
  }

  _initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id                INTEGER PRIMARY KEY,
        created           TEXT NOT NULL,
        modified          TEXT NOT NULL,
        text              TEXT NOT NULL,
        embedding         BLOB,
        importance        REAL DEFAULT 0,
        access_count      INTEGER DEFAULT 0,
        last_access       TEXT,
        valid_from        TEXT NOT NULL,
        valid_to          TEXT,
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
      CREATE INDEX IF NOT EXISTS idx_current
        ON memories(deleted, valid_to);
    `);
  }

  _bind(rec) {
    // Blob the ORIGINAL embedding. normalize() drops Float32Array
    // (Array.isArray is false for a typed array) — silent vector loss if
    // we blob the normalized copy. Schema columns still come from
    // normalize(); the vector's storage form is ours.
    const rawEmb = rec && rec.embedding;
    const r = normalize(rec);
    return [
      coerceId(r.id), r.created, r.modified, r.text, embeddingToBlob(rawEmb || r.embedding),
      r.importance, r.access_count, r.last_access,
      r.valid_from, r.valid_to, r.last_confirmed,
      r.superseded_by == null ? null : coerceId(r.superseded_by),
      r.supersedes == null ? null : coerceId(r.supersedes),
      r.revision, r.needs_review ? 1 : 0,
      r.embedding_version, r.source, r.is_constraint ? 1 : 0, r.deleted ? 1 : 0,
    ];
  }

  _replaceRow(rec) {
    const rawEmb = rec && rec.embedding;
    const r = normalize(Object.assign({}, rec, { embedding: null }));
    r.embedding = rawEmb;
    this._replace.run(
      r.created, r.modified, r.text, embeddingToBlob(rawEmb),
      r.importance, r.access_count, r.last_access,
      r.valid_from, r.valid_to, r.last_confirmed,
      r.superseded_by == null ? null : coerceId(r.superseded_by),
      r.supersedes == null ? null : coerceId(r.supersedes),
      r.revision,
      r.needs_review ? 1 : 0, r.embedding_version, r.source,
      r.is_constraint ? 1 : 0, r.deleted ? 1 : 0, coerceId(r.id)
    );
  }

  _txn(fn) {
    this.db.exec("BEGIN");
    try {
      const out = fn();
      this.db.exec("COMMIT");
      return out;
    } catch (e) {
      try { this.db.exec("ROLLBACK"); } catch { /* already aborted */ }
      throw e;
    }
  }

  _hydrate() {
    if (this._cache) return this._cache;
    this._cache = this._all.all().map(rowToRecord);
    return this._cache;
  }

  _invalidate() { this._cache = null; }

  all() { return this._hydrate().slice(); }
  current() { return this._hydrate().filter(isCurrent); }
  active() { return this._hydrate().filter((r) => !r.deleted); }

  /*
   * Cursor over every row (including deleted + superseded). Export uses
   * this so a 50k dump does not have to hydrate the RAM cache first.
   * One record at a time; the 785 MB jsonl is never one string.
   */
  *iterate() {
    if (this._cache) {
      for (const r of this._cache) yield r;
      return;
    }
    for (const row of this._all.iterate()) yield rowToRecord(row);
  }

  _assertWritable() {
    if (this.readOnly) throw new Error("SqliteStore is read-only (export path)");
  }

  get(id) {
    const k = String(id);
    if (this._cache) {
      return this._cache.find((r) => String(r.id) === k) || null;
    }
    const row = this._get.get(coerceId(id));
    return row ? rowToRecord(row) : null;
  }

  add(rec) {
    this._assertWritable();
    this._insert.run(...this._bind(rec));
    this._invalidate();
  }

  /*
   * Extra (not on the JsonlStore surface): batched INSERT in one
   * transaction. Scale populate uses this so 100k rows are not 100k
   * autocommit writes. The JSONL→SQLite migrator prefers ingestAsync()
   * so it never materializes the whole file as a string (S1 834 MB wall).
   */
  addMany(recs) {
    this._assertWritable();
    if (!recs || !recs.length) return 0;
    this._txn(() => {
      for (const rec of recs) this._insert.run(...this._bind(rec));
    });
    this._invalidate();
    return recs.length;
  }

  /*
   * Stream-ingest an async iterable of records in ONE transaction.
   * Used by migrate-sqlite.js: readline yields a record, we INSERT,
   * never readFileSync the JSONL. Caller owns fold/normalize.
   */
  async ingestAsync(asyncIterable) {
    this._assertWritable();
    let n = 0;
    this.db.exec("BEGIN");
    try {
      for await (const rec of asyncIterable) {
        this._insert.run(...this._bind(rec));
        n++;
      }
      this.db.exec("COMMIT");
    } catch (e) {
      try { this.db.exec("ROLLBACK"); } catch { /* already aborted */ }
      throw e;
    }
    this._invalidate();
    return n;
  }

  rowCount() {
    return Number(this._count.get().n) || 0;
  }

  embeddingRowCount() {
    return Number(this.db.prepare(
      "SELECT COUNT(*) AS n FROM memories WHERE embedding IS NOT NULL"
    ).get().n) || 0;
  }

  checkpoint() {
    this._assertWritable();
    try { this.db.exec("PRAGMA wal_checkpoint(TRUNCATE)"); } catch { /* :memory: */ }
  }

  update(id, patch) {
    this._assertWritable();
    const rec = this.get(id);
    if (!rec) return false;
    Object.assign(rec, patch);
    this._replaceRow(rec);
    // rec is the cached object (or a one-off from SELECT). If we had no
    // cache, the next read hits SQL. If we did, Object.assign already
    // mutated it. Don't invalidate — a full rehydrate after every edit
    // would throw away the vector cache for one patched row.
    return true;
  }

  updateMany(patchById) {
    this._assertWritable();
    // Several rows in ONE transaction: the supersession pair must not be
    // observable half-applied (same reason JsonlStore does one rewrite).
    let n = 0;
    this._txn(() => {
      for (const [id, patch] of Object.entries(patchById)) {
        const rec = this.get(id);
        if (!rec) continue;
        Object.assign(rec, patch);
        this._replaceRow(rec);
        n++;
      }
    });
    return n;
  }

  applyRecall(returnedIds, embeddingById) {
    this._assertWritable();
    const ids = returnedIds || [];
    const hasEmb = !!(embeddingById && embeddingById.size);
    if (!ids.length && !hasEmb) return;
    const now = new Date().toISOString();
    this._txn(() => {
      for (const id of ids) this._bump.run(now, coerceId(id));
      if (hasEmb) {
        for (const [id, v] of embeddingById) {
          if (!v || !v.length) continue;
          this._setEmb.run(embeddingToBlob(v), coerceId(id));
        }
      }
    });
    // In-place cache update — do NOT invalidate. Recall is the hot path;
    // throwing away a 100k-row hydrate to bump 5 counters is the uncached
    // curve the spike measured (1.6 s at 100k). Mutating the ~5 records
    // keeps the RAM scan.
    if (this._cache) {
      const idSet = new Set(ids.map(String));
      for (const r of this._cache) {
        const key = String(r.id);
        if (idSet.has(key)) {
          r.access_count = (r.access_count || 0) + 1;
          r.last_access = now;
          r.importance = r.access_count;
        }
        if (hasEmb) {
          const v = embeddingById.get(key);
          if (v && v.length) {
            r.embedding = v instanceof Float32Array ? v : Float32Array.from(v);
          }
        }
      }
    }
  }

  vacuum() {
    this._assertWritable();
    this.db.exec("DELETE FROM memories WHERE deleted = 1");
    const n = this._count.get().n;
    try { this.db.exec("PRAGMA wal_checkpoint(TRUNCATE)"); } catch { /* :memory: */ }
    this._invalidate();
    return n;
  }

  hasDeleted() {
    if (this._cache) return this._cache.some((r) => r.deleted);
    return !!this._hasDeleted.get();
  }

  nextId() {
    // Same rule as JsonlStore: Date.now() unless an existing id is already
    // ahead of the clock (rapid saves in one ms, or a clock jump back).
    let max = 0;
    if (this._cache) {
      for (const r of this._cache) {
        const n = Number(r.id);
        if (Number.isFinite(n) && n > max) max = n;
      }
    } else {
      const row = this._maxId.get();
      if (row && row.m != null) max = Number(row.m) || 0;
    }
    const now = Date.now();
    return now > max ? now : max + 1;
  }

  stats() {
    const row = this.db.prepare(
      "SELECT COUNT(*) AS count, " +
      "SUM(CASE WHEN deleted = 0 AND valid_to IS NULL THEN 1 ELSE 0 END) AS current, " +
      "SUM(CASE WHEN superseded_by IS NOT NULL THEN 1 ELSE 0 END) AS superseded, " +
      "SUM(CASE WHEN deleted = 1 THEN 1 ELSE 0 END) AS deleted " +
      "FROM memories"
    ).get();
    let bytes = 0;
    try { if (this.file && this.file !== ":memory:") bytes = fs.statSync(this.file).size; } catch { /* */ }
    return {
      count: row.count || 0,
      current: row.current || 0,
      superseded: row.superseded || 0,
      deleted: row.deleted || 0,
      bytes,
    };
  }

  close() {
    if (!this.readOnly) {
      try { this.db.exec("PRAGMA wal_checkpoint(TRUNCATE)"); } catch { /* closing */ }
    }
    try { this.db.close(); } catch { /* already closed */ }
    this._cache = null;
  }
}

module.exports = {
  SqliteStore,
  embeddingToBlob,
  blobToF32,
  rowToRecord,
};
