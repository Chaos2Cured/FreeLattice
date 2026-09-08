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
 * --migrate (RM-07 slice 2a): streaming JSONL → SQLite migrator.
 *
 * The 10-step commit protocol is the data-safety spine (settled across the
 * 0010 deliberation rounds). Implement exactly:
 *
 *   1. If <store>.db exists and opens → it is live; leftover JSONL is
 *      IGNORED (log it). Never dual-read.
 *   2. If only JSONL exists → create <store>.db.migrating. STREAM the
 *      JSONL line-at-a-time (readline over a read stream — NEVER
 *      readFileSync; that IS the S1 834 MB wall). Batched INSERT inside
 *      one transaction.
 *   3. Preserve ids exactly — opaque id, superseded_by, all provenance.
 *      NO AUTOINCREMENT renumber (edges + ids the model already saw).
 *   4. Fold <store>.access.json (AccessLog) into the row columns ONCE,
 *      at ingest (BUG-007 — a leftover live sidecar next to in-row
 *      counts is the doubling bug; SqliteStore never constructs AccessLog).
 *   5. Count-verify: migrated row count === source line count (minus
 *      blanks); embeddings-present-iff-source-had-them. Mismatch → abort,
 *      keep the JSONL, delete the temp.
 *   6. WAL checkpoint (TRUNCATE) on the temp db so it is a clean single
 *      file at rest.
 *   7. Atomic rename <store>.db.migrating → <store>.db.
 *   8. THEN rename JSONL → .jsonl.bak and access.json → .bak (recovery
 *      snapshots — NOT the sovereignty export; live --export-jsonl is
 *      slice 2b). Rename OFF MEMORY_FILE_PATH so a downgraded exe cannot
 *      serve the stale JSONL.
 *   9. Failure BEFORE step 7 → JSONL is still live at its path, delete
 *      the temp, retry next run. NO resume-from-partial.
 *  10. Log: migrated N memories; original kept at <path>.bak.
 *
 * CLI is still opt-in (`node entry.js --migrate`). Slice 4's openStore()
 * calls migrateJsonlToSqlite() on first open of an existing JSONL — same
 * protocol, not a second implementation. Fail-open lives in openStore:
 * a throw before step 7 keeps the JSONL live and the user opens JsonlStore.
 *
 *   node entry.js --migrate [store.jsonl]
 *   npm run migrate
 *
 * Not a fifth MCP verb. JsonlStore stays for tests / conformance / export
 * and as the fail-open backend.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { sqlitePathFor } = require("./store.js");
const { SqliteStore } = require("./store-sqlite.js");
const { AccessLog, normalize, hasVector } = require("./record.js");

function defaultStorePath() {
  return process.env.MEMORY_FILE_PATH ||
    path.join(process.env.USERPROFILE || process.env.HOME || ".", ".lmstudio", "resonance-memory.jsonl");
}

function parseArgs(argv) {
  const args = argv || [];
  const json = args.includes("--json");
  const help = args.includes("--help") || args.includes("-h");
  const pathArg = args.find((a) => a && !String(a).startsWith("-"));
  return { json, help, storePath: pathArg || defaultStorePath() };
}

const USAGE = [
  "Usage: resonance-memory --migrate [--json] [store.jsonl]",
  "",
  "  Stream a JSONL store into a sibling SQLite .db (RM-07 slice 2a).",
  "  Non-destructive: the original is renamed to <store>.jsonl.bak, not",
  "  copied. Access counts fold into the row ONCE. Ids and created are",
  "  preserved. Failure before the .db rename leaves the JSONL live.",
  "",
  "  --json     machine-readable result on stdout",
  "  --help     this message",
  "",
  "Store path defaults to MEMORY_FILE_PATH, then ~/.lmstudio/resonance-memory.jsonl.",
  "Opt-in CLI. First-open auto-migrate lives in openStore() (slice 4) and",
  "calls this same protocol. The .bak is a recovery snapshot, not the",
  "sovereignty export (that's --export-jsonl).",
].join("\n");

function sqliteSidecars(file) {
  return [file, file + "-wal", file + "-shm", file + "-journal"];
}

function removeSqliteTree(file) {
  for (const p of sqliteSidecars(file)) {
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch { /* still locked; caller retries */ }
  }
}

function walHasBytes(file) {
  try {
    const wal = file + "-wal";
    return fs.existsSync(wal) && fs.statSync(wal).size > 0;
  } catch { return false; }
}

/*
 * One retained original (rename, not copyFile). An older .bak is dropped
 * so we do not keep two full copies of an 834 MB file.
 */
function renameOff(src, dest) {
  if (!src || !fs.existsSync(src)) return false;
  if (dest && fs.existsSync(dest)) fs.unlinkSync(dest);
  fs.renameSync(src, dest);
  return true;
}

/*
 * Protocol step 8, callable on its own. The 2a crash-between-7-and-8
 * case: .db is already live, JSONL still sits at MEMORY_FILE_PATH.
 * openStore finishes the rename so we never dual-read. Do not delete
 * the .bak — it is the recovery snapshot.
 */
function finishStep8(jsonlPath, log) {
  if (!jsonlPath || !fs.existsSync(jsonlPath)) return [];
  const bakPath = jsonlPath + ".bak";
  const accessPath = jsonlPath + ".access.json";
  const accessBak = accessPath + ".bak";
  const warnings = [];
  try {
    if (renameOff(jsonlPath, bakPath) && log) {
      log("RESONANCE: leftover JSONL renamed to " + bakPath +
        " (.db is live; never dual-read)");
    }
  } catch (e) {
    warnings.push("could not bak JSONL: " + e.message);
    if (log) log("RESONANCE: " + warnings[warnings.length - 1]);
  }
  try { if (fs.existsSync(accessPath)) renameOff(accessPath, accessBak); }
  catch (e) {
    warnings.push("could not bak access sidecar: " + e.message);
    if (log) log("RESONANCE: " + warnings[warnings.length - 1]);
  }
  return warnings;
}

function foldRecord(raw, access) {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    const err = new Error("JSONL line is not a record object");
    err.code = "MIGRATE_PARSE";
    throw err;
  }
  const hadEmb = hasVector(raw);
  const rawEmb = hadEmb ? raw.embedding : null;
  const rec = normalize(raw);
  if (access && typeof access.apply === "function") access.apply([rec]);
  // Restore the source vector AFTER normalize() (typed-array trap: normalize
  // drops Float32Array; JSONL vectors are number[] and survive, but we still
  // attach the original so we cannot invent or drop).
  rec.embedding = rawEmb;
  return { rec, hadEmb };
}

async function* parseJsonl(jsonlPath, access, counters) {
  // STREAM. Never readFileSync the JSONL — that is the S1 834 MB wall.
  const stream = fs.createReadStream(jsonlPath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let lineNo = 0;
  try {
    for await (const line of rl) {
      lineNo++;
      if (!String(line).trim()) { counters.blanks++; continue; }
      counters.sourceLines++;
      let raw;
      try { raw = JSON.parse(line); }
      catch (e) {
        const err = new Error("unparseable JSONL line " + lineNo + ": " + e.message);
        err.code = "MIGRATE_PARSE";
        throw err;
      }
      const { rec, hadEmb } = foldRecord(raw, access);
      if (hadEmb) counters.sourceWithEmb++;
      else counters.sourceWithoutEmb++;
      yield rec;
    }
  } finally {
    try { rl.close(); } catch { /* */ }
    try { stream.destroy(); } catch { /* */ }
  }
}

function dbExistsAndOpens(dbPath) {
  if (!fs.existsSync(dbPath)) return { exists: false, opens: false, count: 0 };
  let store;
  try {
    store = new SqliteStore(dbPath);
    const count = store.rowCount();
    store.close();
    return { exists: true, opens: true, count };
  } catch (e) {
    try { if (store) store.close(); } catch { /* */ }
    return { exists: true, opens: false, count: 0, error: e };
  }
}

async function maybeCrashBeforeRename(opts, ctx) {
  if (opts && typeof opts.onBeforeRename === "function") {
    await opts.onBeforeRename(ctx);
  }
  // Test-only kill-9 hook: write a ready file then hang until the parent
  // SIGKILLs us. finally/catch will NOT run — that is the point.
  if (process.env.RM_MIGRATE_CRASH_BEFORE_RENAME) {
    const ready = process.env.RM_MIGRATE_CRASH_READY;
    if (ready) fs.writeFileSync(ready, "ready\n");
    await new Promise(() => {});
  }
}

async function migrateJsonlToSqlite(jsonlPath, opts) {
  opts = opts || {};
  const log = opts.log || ((msg) => { console.log(msg); });
  jsonlPath = path.resolve(String(jsonlPath));
  const dbPath = path.resolve(opts.dbPath || sqlitePathFor(jsonlPath));
  const tempDb = dbPath + ".migrating";
  const accessPath = jsonlPath + ".access.json";
  const bakPath = jsonlPath + ".bak";
  const accessBak = accessPath + ".bak";

  // No resume-from-partial: a leftover temp from a killed run is junk.
  removeSqliteTree(tempDb);

  const live = dbExistsAndOpens(dbPath);
  if (live.exists) {
    if (!live.opens) {
      const err = new Error(
        "existing db at " + dbPath + " does not open; aborting (JSONL left in place)" +
        (live.error ? (": " + live.error.message) : "")
      );
      err.code = "MIGRATE_DB_UNREADABLE";
      throw err;
    }
    // Empty .db beside a still-live JSONL is the openStore() footgun, not a
    // completed migrate (a completed migrate would have renamed JSONL off
    // MEMORY_FILE_PATH). Refuse to ignore the JSONL.
    if (live.count === 0 && fs.existsSync(jsonlPath) && fs.statSync(jsonlPath).size > 0) {
      const err = new Error(
        "empty SQLite db at " + dbPath + " sits beside " + jsonlPath +
        ". The JSONL is the real store; the .db is probably an unmigrated " +
        "openStore() artifact. Delete the empty .db and re-run --migrate. " +
        "Refusing to ignore the JSONL."
      );
      err.code = "MIGRATE_EMPTY_DB";
      throw err;
    }
    if (fs.existsSync(jsonlPath)) {
      log("SqliteStore already live at " + dbPath + "; leftover JSONL ignored: " + jsonlPath);
    }
    return {
      status: "already_migrated",
      count: live.count,
      dbPath,
      jsonlPath,
      bakPath,
      ignoredJsonl: fs.existsSync(jsonlPath),
    };
  }

  if (!fs.existsSync(jsonlPath)) {
    log("No store at " + jsonlPath + ". Nothing to do.");
    return { status: "nothing", dbPath, jsonlPath, bakPath };
  }

  const access = new AccessLog(accessPath);
  const counters = { sourceLines: 0, sourceWithEmb: 0, sourceWithoutEmb: 0, blanks: 0 };
  let store = null;
  let renamed = false;
  const t0 = Date.now();

  try {
    store = new SqliteStore(tempDb);
    const inserted = await store.ingestAsync(parseJsonl(jsonlPath, access, counters));

    if (typeof opts.onAfterIngest === "function") {
      await opts.onAfterIngest(store, counters);
    }

    const destCount = store.rowCount();
    const destWithEmb = store.embeddingRowCount();
    if (destCount !== counters.sourceLines || inserted !== counters.sourceLines) {
      const err = new Error(
        "migration count mismatch: source=" + counters.sourceLines +
        " dest=" + destCount + " inserted=" + inserted
      );
      err.code = "MIGRATE_COUNT_MISMATCH";
      throw err;
    }
    if (destWithEmb !== counters.sourceWithEmb) {
      const err = new Error(
        "migration embedding mismatch: source-with-vector=" + counters.sourceWithEmb +
        " dest-with-blob=" + destWithEmb +
        " (would silently drop or invent vectors)"
      );
      err.code = "MIGRATE_EMBED_MISMATCH";
      throw err;
    }

    // Step 6: checkpoint so the temp is a single file before it becomes live.
    store.checkpoint();
    if (walHasBytes(tempDb)) {
      store.checkpoint();
    }
    store.close();
    store = null;
    // Drop 0-byte WAL/SHM leftovers so rename is one file. Abort if WAL
    // still carries bytes — renaming would orphan them under the old name.
    for (const p of [tempDb + "-wal", tempDb + "-shm", tempDb + "-journal"]) {
      try {
        if (fs.existsSync(p) && fs.statSync(p).size === 0) fs.unlinkSync(p);
      } catch { /* */ }
    }
    if (walHasBytes(tempDb)) {
      const err = new Error("WAL still has bytes after checkpoint; aborting rename");
      err.code = "MIGRATE_WAL";
      throw err;
    }

    await maybeCrashBeforeRename(opts, { tempDb, dbPath, jsonlPath });

    // Step 7: atomic rename. After this, the .db is live.
    fs.renameSync(tempDb, dbPath);
    renamed = true;

    // Step 8: rename the JSONL (and access sidecar) OFF MEMORY_FILE_PATH.
    const warnings = [];
    try { renameOff(jsonlPath, bakPath); }
    catch (e) { warnings.push("could not bak JSONL: " + e.message); }
    try { if (fs.existsSync(accessPath)) renameOff(accessPath, accessBak); }
    catch (e) { warnings.push("could not bak access sidecar: " + e.message); }

    const ms = Date.now() - t0;
    const msg = "migrated " + destCount + " memories; original kept at " + bakPath;
    log(msg);
    return {
      status: "migrated",
      count: destCount,
      sourceLines: counters.sourceLines,
      blanks: counters.blanks,
      withEmbedding: destWithEmb,
      dbPath,
      jsonlPath,
      bakPath,
      accessBak: fs.existsSync(accessBak) ? accessBak : null,
      ms,
      message: msg,
      warnings,
    };
  } catch (e) {
    // Step 9: failure BEFORE step 7 → JSONL still live, delete the temp.
    if (!renamed) {
      if (store) { try { store.close(); } catch { /* */ } }
      removeSqliteTree(tempDb);
      // A half .db must not sit at the live path.
      if (fs.existsSync(dbPath)) {
        // We never rename except on the success path; if something else
        // created a live .db during the attempt, leave it — but that is
        // not our write.
      }
    }
    throw e;
  }
}

async function main(argv) {
  const parsed = parseArgs(argv);
  if (parsed.help) {
    console.log(USAGE);
    return 0;
  }
  try {
    const result = await migrateJsonlToSqlite(parsed.storePath, {
      // --json is the machine-readable half; don't mix the human line into stdout.
      log: parsed.json ? function () {} : undefined,
    });
    if (parsed.json) console.log(JSON.stringify(result, null, 2));
    return 0;
  } catch (e) {
    console.error(String(e && e.message || e));
    return 2;
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => {
    if (code) process.exit(code);
  }).catch((e) => {
    console.error(String(e.message || e));
    process.exit(2);
  });
}

module.exports = {
  parseArgs,
  main,
  migrateJsonlToSqlite,
  defaultStorePath,
  removeSqliteTree,
  dbExistsAndOpens,
  finishStep8,
  renameOff,
  foldRecord,
  USAGE,
};
