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
 * store.js - the storage backend, behind the Store seam.
 *
 * Lives in its own module so it can be constructed and tested without starting
 * the MCP stdio loop, and so a second backend (SQLite; see docs/proposed/0005
 * and 0010) can sit alongside JsonlStore without touching memory-core.js. The
 * MCP verbs never see anything in here.
 *
 * RM-07 slice 4: SqliteStore is the default. openStore() is the one
 * construction path. Given MEMORY_FILE_PATH (still a *.jsonl path) and no
 * explicit backend override:
 *
 *   1. RESONANCE_STORE=jsonl (or live-config `store: "jsonl"`) → JsonlStore.
 *      The pin stays — a user can keep JSONL. RESONANCE_STORE=sqlite forces
 *      sqlite (same walk as the default, never a dual-write "switch back").
 *   2. <stem>.db exists and opens → SqliteStore. A leftover <stem>.jsonl
 *      (2a crash-between-step-7-and-8) is renamed to .bak now (finish
 *      step 8). The .db is live truth. Never dual-read.
 *   3. No .db, but <stem>.jsonl exists → AUTO-MIGRATE via the 2a 10-step
 *      protocol (call migrateJsonlToSqlite; do not reimplement it). Then
 *      open the .db. Fail-open: if migration throws before the atomic
 *      rename, keep the JSONL live, drop the temp, open JsonlStore.
 *      A failed auto-migrate must never block the user from their
 *      memories. Retry next open.
 *   4. Neither exists (new user) → fresh SqliteStore (.db).
 *
 * RM-07 slice 5: a SqliteStore also ingests a leftover `<store>.edges.json`
 * into the edges table on this same first-open (count-verify, sidecar →
 * `.bak`, fail-open if missing). JsonlStore keeps the JSON sidecar.
 *
 * Empty .db beside a still-live JSONL is the slice-1 openStore() footgun,
 * not live truth — drop the empty artifact and auto-migrate. Completing
 * step 8 on that state would rename the real store away.
 *
 * openStore is async because the 2a protocol streams. Callers await it.
 * Logs go to stderr (MCP stdio is stdout).
 */

const fs = require("fs");
const {
  writeFileDurable, appendLineDurable, normalize, isCurrent, AccessLog,
} = require("./record.js");

// ------------------------------------------------------------------- Store
// Swappable backend. This one is flat JSONL; a Lantern-backed Store can replace
// it later with the same method surface, leaving the MCP verbs untouched.
class JsonlStore {
  constructor(file) {
    this.file = file;
    // Retention metadata lives in a sidecar so recall never rewrites the store.
    this.access = new AccessLog(file + ".access.json");
  }

  all() {
    if (!fs.existsSync(this.file)) return [];
    const recs = fs.readFileSync(this.file, "utf8")
      .split("\n").filter(Boolean)
      .map((l) => { try { return normalize(JSON.parse(l)); } catch { return null; } })
      .filter(Boolean);
    return this.access.apply(recs);   // fold in sidecar access counts
  }

  /* Not deleted. Includes superseded memories - use current() to exclude those. */
  active() { return this.all().filter((r) => !r.deleted); }

  /* Currently true: not deleted, not superseded. What recall answers from. */
  current() { return this.all().filter(isCurrent); }

  get(id) { const k = String(id); return this.all().find((r) => String(r.id) === k) || null; }

  // Durable full rewrite: temp -> fsync -> atomic rename. Only mutations land here
  // (save/edit/delete/vacuum), never a read.
  _writeAll(recs) {
    const data = recs.map((r) => JSON.stringify(r)).join("\n") + (recs.length ? "\n" : "");
    writeFileDurable(this.file, data);
    // `recs` came from all(), so they already carry the sidecar's counts folded in.
    // Now that those totals are persisted in the store itself, the sidecar must be
    // cleared - otherwise the next read folds them in AGAIN and access_count doubles
    // on every edit/vacuum. A full rewrite is the natural checkpoint for this.
    this.access.consolidate();
    this.access.save();
  }

  add(rec) { appendLineDurable(this.file, JSON.stringify(rec) + "\n"); }

  // patch matched by id (string-compared so a number or string id both work)
  update(id, patch) {
    const key = String(id);
    const recs = this.all();
    let found = false;
    for (const r of recs) { if (String(r.id) === key) { Object.assign(r, patch); found = true; } }
    if (found) this._writeAll(recs);
    return found;
  }

  // Apply several patches in ONE rewrite: { id -> patch }. Used by supersession,
  // where two rows change together and must not be observable half-applied.
  updateMany(patchById) {
    const recs = this.all();
    let n = 0;
    for (const r of recs) {
      const p = patchById[String(r.id)];
      if (p) { Object.assign(r, p); n++; }
    }
    if (n) this._writeAll(recs);
    return n;
  }

  /*
   * Record a recall. Access bumps go to the sidecar (no store write at all).
   * Freshly-computed vectors DO belong in the store, but that only happens for
   * legacy rows or after an embedder outage - so in steady state a recall
   * performs zero writes to the memory store.
   */
  applyRecall(returnedIds, embeddingById) {
    this.access.bump(returnedIds);
    this.access.save();
    if (embeddingById && embeddingById.size) {
      const recs = this.all();
      let n = 0;
      for (const r of recs) {
        const v = embeddingById.get(String(r.id));
        // First-time backfill of a vectorless row (legacy, or a save-time
        // embedder outage). The vector now matches the text, but this is not
        // a re-embed: embedding_version stays at the normalize() default (1).
        // Bumping here would make a save-time failure look like an edit()
        // mutation, which Phase 0's version-comparison cache cannot tell apart.
        if (v) { r.embedding = v; n++; }
      }
      if (n) this._writeAll(recs);
    }
  }

  vacuum() {
    const kept = this.all().filter((r) => !r.deleted);
    this._writeAll(kept);   // consolidates + clears the sidecar; nothing left to prune
    return kept.length;
  }

  hasDeleted() { return this.all().some((r) => r.deleted); }

  nextId() {
    const ids = this.all().map((r) => Number(r.id)).filter((n) => !Number.isNaN(n));
    const max = ids.length ? Math.max(...ids) : 0;
    const now = Date.now();
    return now > max ? now : max + 1;
  }
}

/*
 * Backend selectability (RM-07 slice 4). Default is sqlite. Live-config
 * `store` wins over env RESONANCE_STORE, same pattern as the field toggle.
 * `store: "jsonl"` / RESONANCE_STORE=jsonl is the pin that skips the
 * filesystem walk. A backend change needs a process restart (you cannot
 * hot-swap engines under an open file). There is no "switch back to JSONL
 * and dual-write" env — after a store is .db, the JSONL at .bak is a
 * recovery snapshot, not a two-way door.
 */
function resolveStoreBackend(config) {
  if (config && (config.store === "sqlite" || config.store === "jsonl")) return config.store;
  const raw = String(process.env.RESONANCE_STORE || "").toLowerCase();
  if (raw === "jsonl") return "jsonl";
  return "sqlite";
}

function sqlitePathFor(file) {
  const s = String(file || "");
  if (/\.db$/i.test(s)) return s;
  if (/\.jsonl$/i.test(s)) return s.replace(/\.jsonl$/i, ".db");
  return s + ".db";
}

function jsonlHasContent(p) {
  try { return !!(p && fs.existsSync(p) && fs.statSync(p).size > 0); }
  catch { return false; }
}

// MEMORY_FILE_PATH is still a *.jsonl path. A caller that already passed a
// .db path has no JSONL sibling to bak — do not treat the .db as leftover JSONL.
function jsonlLivePath(file, dbPath) {
  const s = String(file || "");
  if (!s || s === dbPath) return null;
  if (/\.db$/i.test(s)) return null;
  return s;
}

function defaultStoreLog(msg) {
  // MCP stdio is stdout; store-selection / auto-migrate must never land there.
  try { console.error(msg); } catch { /* */ }
}

async function openStore(file, opts) {
  opts = opts || {};
  const backend = opts.backend || resolveStoreBackend(opts.config);
  const log = opts.log || defaultStoreLog;
  const readOnly = !!(opts.readOnly);

  if (backend === "jsonl") return new JsonlStore(file);

  const { SqliteStore } = require("./store-sqlite.js");
  const migrate = require("./migrate-sqlite.js");
  const dbPath = sqlitePathFor(file);
  const jsonlPath = jsonlLivePath(file, dbPath);
  const leftoverJsonl = jsonlHasContent(jsonlPath);

  function withEdges(s) {
    if (readOnly) return s;
    try {
      const { migrateEdgesSidecarIntoDb } = require("./edges.js");
      migrateEdgesSidecarIntoDb(s.db, { storePath: file, dbPath, log });
    } catch (e) {
      log("RESONANCE: edges sidecar migrate failed (" + String(e && e.message || e) +
        "); memories stay reachable.");
    }
    return s;
  }

  const live = migrate.dbExistsAndOpens(dbPath);

  // Empty .db beside a still-live JSONL is the slice-1 footgun, not a
  // completed migrate. Dropping it and auto-migrating is the data-safe
  // move; finishing step 8 would rename the real store away.
  if (live.exists && live.opens && live.count === 0 && leftoverJsonl) {
    if (readOnly) return new JsonlStore(jsonlPath);
    log("RESONANCE: empty SQLite db at " + dbPath + " sits beside " + jsonlPath +
      "; dropping the empty .db and auto-migrating the JSONL.");
    migrate.removeSqliteTree(dbPath);
  } else if (live.exists && live.opens) {
    if (leftoverJsonl) migrate.finishStep8(jsonlPath, log);
    return withEdges(new SqliteStore(dbPath, { readOnly }));
  } else if (live.exists && !live.opens) {
    if (leftoverJsonl) {
      log("RESONANCE: " + dbPath + " exists but does not open" +
        (live.error ? " (" + live.error.message + ")" : "") +
        "; failing open to JSONL at " + jsonlPath);
      return new JsonlStore(jsonlPath);
    }
    const err = new Error(
      "SQLite store at " + dbPath + " exists but does not open" +
      (live.error ? ": " + live.error.message : "")
    );
    err.code = "STORE_DB_UNREADABLE";
    throw err;
  }

  if (leftoverJsonl) {
    // Export is read-only and must not migrate. Panel / MCP first-open does.
    if (readOnly) return new JsonlStore(jsonlPath);
    try {
      await migrate.migrateJsonlToSqlite(jsonlPath, Object.assign({
        log,
        dbPath,
      }, opts.migrate || {}));
      return withEdges(new SqliteStore(dbPath, { readOnly }));
    } catch (e) {
      // I3-spirit fail-open at the store level: a hiccup must not hide
      // the user's memories. 2a already dropped the temp on throw-before-7.
      log("RESONANCE: auto-migrate failed (" + String(e && e.message || e) +
        "); opening JSONL so your memories stay reachable. Will retry next open.");
      return new JsonlStore(jsonlPath);
    }
  }

  return withEdges(new SqliteStore(dbPath, { readOnly }));
}

module.exports = { JsonlStore, openStore, resolveStoreBackend, sqlitePathFor };
Object.defineProperty(module.exports, "SqliteStore", {
  enumerable: true,
  get() { return require("./store-sqlite.js").SqliteStore; },
});
