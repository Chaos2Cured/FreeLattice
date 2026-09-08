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
 * --import (RM-17): the sovereignty return trip.
 *
 * Export (RM-07 slice 2b) writes a zip you own. This reads it back onto
 * a new machine, or merges it into a store that already has memories.
 * Completes "portable, yours to carry." Not a fifth MCP verb. The panel
 * button shells runImport() — same engine, not a second writer.
 *
 *   --import <zip-or-jsonl>                 dry-run (default; writes nothing)
 *   --import <zip-or-jsonl> --apply         restore into an EMPTY dest
 *   --import <zip-or-jsonl> --apply --merge merge into a non-empty dest
 *   --import <zip> --apply --with-edges     also restore Hebbian (opt-in)
 *
 * Does NOT go through save(). Re-embedding would mint new ids, re-run
 * PII refusal on secrets the user already chose to keep (export does
 * not sanitize — that is the sovereignty claim), and need the embedder
 * on a machine that may not have one yet. Direct store write preserves
 * ids, embeddings, timestamps, superseded_by, deleted. Streaming is
 * mandatory: readFileSync of memories.jsonl is the S1 834 MB wall.
 *
 * Hebbian is the irreplaceable signal (proposed/0009). An import that
 * blindly accepts a sidecar is a false-memory injection machine. So:
 *   - a raw memories.jsonl never looks for a sibling .edges.json
 *   - a zip restores associations ONLY with --with-edges, and ONLY when
 *     manifest.format is "resonance-memory-export"
 *   - dest that already has edges refuses --with-edges unless
 *     --replace-edges (no silent union of planted + real)
 * Passing a `.edges.json` as the source is refused outright.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { Transform } = require("stream");
const zlib = require("zlib");
const { ZipReader } = require("./zip.js");
const { JsonlStore, openStore, resolveStoreBackend, sqlitePathFor } = require("./store.js");
const { normalize, isVector, appendLineDurable } = require("./record.js");
const {
  openEdgeStore, snapFromJson, SqliteEdgePersist, isSqliteStore,
} = require("./edges.js");

function packageVersion() {
  try { return require("./package.json").version; }
  catch { return "0.0.0"; }
}

function defaultStorePath() {
  return process.env.MEMORY_FILE_PATH ||
    path.join(process.env.USERPROFILE || process.env.HOME || ".", ".lmstudio", "resonance-memory.jsonl");
}

function loadLiveConfig(storePath) {
  const p = process.env.RESONANCE_MEMORY_CONFIG ||
    path.join(path.dirname(path.resolve(storePath || defaultStorePath())), "resonance-memory.config.json");
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch { return {}; }
}

class ImportError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "ImportError";
  }
}

function recordStatus(r) {
  if (r && r.deleted) return "deleted";
  if (r && (r.valid_to || r.superseded_by)) return "superseded";
  return "current";
}

function prepareRecord(obj) {
  const rawEmb = obj && obj.embedding;
  const rec = normalize(obj);
  if (isVector(rawEmb) && !Array.isArray(rawEmb)) rec.embedding = Array.from(rawEmb);
  else if (Array.isArray(rawEmb)) rec.embedding = rawEmb;
  return rec;
}

function recordToLine(rec) {
  const n = normalize(rec);
  const raw = rec && rec.embedding;
  if (isVector(raw)) n.embedding = Array.isArray(raw) ? raw : Array.from(raw);
  else n.embedding = Array.isArray(raw) ? raw : null;
  return JSON.stringify(n);
}

function findMember(zip, basename) {
  const names = zip.names();
  const hits = names.filter((n) => n === basename || n.endsWith("/" + basename));
  if (!hits.length) return null;
  hits.sort((a, b) => a.length - b.length);
  return hits[0];
}

function sniffKind(file) {
  const s = String(file || "");
  if (/\.edges\.json$/i.test(s) || /\.assoc\.json$/i.test(s)) return "sidecar";
  if (/\.zip$/i.test(s)) return "zip";
  if (/\.jsonl$/i.test(s)) return "jsonl";
  if (!fs.existsSync(s) || !fs.statSync(s).isFile()) return "missing";
  const fd = fs.openSync(s, "r");
  try {
    const buf = Buffer.alloc(4);
    const n = fs.readSync(fd, buf, 0, 4, 0);
    if (n >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07)) {
      return "zip";
    }
  } finally { fs.closeSync(fd); }
  return "jsonl";
}

function crcTransform() {
  let crc = 0;
  const t = new Transform({
    transform(chunk, _enc, cb) {
      crc = zlib.crc32(chunk, crc);
      this.push(chunk);
      cb();
    },
  });
  t.getCrc = () => crc >>> 0;
  return t;
}

async function* iterateLines(input, opts) {
  opts = opts || {};
  const expectedCrc = opts.expectedCrc;
  const crcT = expectedCrc != null ? crcTransform() : null;
  const stream = crcT ? input.pipe(crcT) : input;
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let n = 0;
  try {
    for await (const line of rl) {
      if (!line) continue;
      let obj;
      try { obj = JSON.parse(line); }
      catch (e) {
        const err = new ImportError(
          "IMPORT_BAD_JSONL",
          "unparseable non-blank line at record " + (n + 1) + ": " + String(e && e.message || e)
        );
        throw err;
      }
      n++;
      yield obj;
    }
  } finally {
    try { rl.close(); } catch { /* */ }
  }
  if (crcT && (crcT.getCrc() !== (expectedCrc >>> 0))) {
    throw new ImportError("IMPORT_CRC", "memories.jsonl CRC mismatch — archive is corrupt or truncated");
  }
}

function openJsonlStream(file) {
  return fs.createReadStream(file, { encoding: "utf8" });
}

function openSource(sourcePath) {
  const resolved = path.resolve(sourcePath);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new ImportError("IMPORT_SOURCE_MISSING", "import source not found: " + resolved);
  }
  const kind = sniffKind(resolved);
  if (kind === "sidecar") {
    throw new ImportError(
      "IMPORT_REFUSED_SIDECAR",
      "refusing to import a raw " + path.basename(resolved) +
        " — that is a planted-association path (proposed/0009). Import a zip or memories.jsonl."
    );
  }
  if (kind === "zip") {
    const zip = ZipReader.open(resolved);
    const memoriesName = findMember(zip, "memories.jsonl");
    if (!memoriesName) {
      throw new ImportError("IMPORT_NO_MEMORIES", "zip has no memories.jsonl (the importable half)");
    }
    const edgesName = findMember(zip, "edges.json");
    const manifestName = findMember(zip, "manifest.json");
    let manifest = null;
    if (manifestName) {
      try { manifest = JSON.parse(zip.readStored(manifestName).toString("utf8")); }
      catch { manifest = null; }
    }
    const isRmExport = !!(manifest && manifest.format === "resonance-memory-export");
    return {
      kind: "zip",
      path: resolved,
      zip,
      memoriesName,
      edgesName,
      manifest,
      isRmExport,
      close() { /* ZipReader holds no fd */ },
    };
  }
  return {
    kind: "jsonl",
    path: resolved,
    zip: null,
    memoriesName: null,
    edgesName: null,
    manifest: null,
    isRmExport: false,
    close() {},
  };
}

function iterateSourceRecords(src) {
  if (src.kind === "zip") {
    const entry = src.zip.get(src.memoriesName);
    const stream = src.zip.createReadStream(src.memoriesName);
    return iterateLines(stream, { expectedCrc: entry && entry.crc });
  }
  return iterateLines(openJsonlStream(src.path));
}

function loadSourceEdges(src) {
  if (src.kind !== "zip" || !src.edgesName) return { edges: new Map(), recalls: 0, count: 0 };
  let raw;
  try { raw = JSON.parse(src.zip.readStored(src.edgesName).toString("utf8")); }
  catch {
    return { edges: new Map(), recalls: 0, count: 0 };
  }
  const snap = snapFromJson(raw);
  return { edges: snap.edges, recalls: snap.recalls, count: snap.edges.size };
}

function emptyCounts() {
  return { total: 0, current: 0, superseded: 0, deleted: 0 };
}

function bumpStatus(counts, rec) {
  counts.total++;
  counts[recordStatus(rec)]++;
}

function jsonlHasContent(p) {
  try { return !!(p && fs.existsSync(p) && fs.statSync(p).isFile() && fs.statSync(p).size > 0); }
  catch { return false; }
}

function destEdgeCountFromFs(store, storePath) {
  if (store && isSqliteStore(store)) {
    try {
      const persist = new SqliteEdgePersist(store.db, { readOnly: true });
      return persist.edgeCount();
    } catch { return 0; }
  }
  const p = String(storePath || "") + ".edges.json";
  if (!fs.existsSync(p)) return 0;
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    const bag = raw && raw.edges;
    if (!bag || typeof bag !== "object" || Array.isArray(bag)) return 0;
    return Object.keys(bag).length;
  } catch { return 0; }
}

/*
 * Probe dest WITHOUT creating it. Dry-run must not mint an empty .db —
 * openStore() on neither-exists is a write (fresh SqliteStore).
 */
async function probeDest(storePath, opts) {
  opts = opts || {};
  const resolved = path.resolve(storePath);
  const config = opts.config || loadLiveConfig(resolved);
  const backend = opts.backend || resolveStoreBackend(config);
  const dbPath = sqlitePathFor(resolved);
  const ids = new Set();
  const texts = new Map(); // byte-identical text → dest id
  let maxId = 0;
  let count = 0;
  let edgeCount = 0;
  let store = null;

  function ingestRecs(recs) {
    for (const r of recs) {
      count++;
      const id = r.id;
      ids.add(String(id));
      const n = Number(id);
      if (Number.isFinite(n) && n > maxId) maxId = n;
      const t = String(r.text || "");
      if (t && !texts.has(t)) texts.set(t, id);
    }
  }

  try {
    if (backend === "jsonl") {
      if (!jsonlHasContent(resolved)) {
        return { backend: "jsonl", path: resolved, empty: true, count: 0, ids, texts, maxId: 0, edgeCount: 0 };
      }
      store = new JsonlStore(resolved);
      ingestRecs(store.all());
      edgeCount = destEdgeCountFromFs(store, resolved);
      return { backend: "jsonl", path: resolved, empty: count === 0, count, ids, texts, maxId, edgeCount };
    }

    const dbExists = fs.existsSync(dbPath);
    if (dbExists) {
      const { SqliteStore } = require("./store-sqlite.js");
      store = new SqliteStore(dbPath, { readOnly: true });
      if (typeof store.rowCount === "function" && store.rowCount() === 0) {
        edgeCount = destEdgeCountFromFs(store, resolved);
        return { backend: "sqlite", path: resolved, dbPath, empty: true, count: 0, ids, texts, maxId: 0, edgeCount };
      }
      ingestRecs(store.all());
      edgeCount = destEdgeCountFromFs(store, resolved);
      return { backend: "sqlite", path: resolved, dbPath, empty: count === 0, count, ids, texts, maxId, edgeCount };
    }
    if (jsonlHasContent(resolved)) {
      // Apply will auto-migrate. Probe the JSONL so dry-run sees the real dest.
      store = new JsonlStore(resolved);
      ingestRecs(store.all());
      edgeCount = destEdgeCountFromFs(store, resolved);
      return {
        backend: "sqlite", path: resolved, dbPath, empty: count === 0, count, ids, texts, maxId, edgeCount,
        willMigrate: true,
      };
    }
    return { backend: "sqlite", path: resolved, dbPath, empty: true, count: 0, ids, texts, maxId: 0, edgeCount: 0 };
  } finally {
    if (store && typeof store.close === "function") {
      try { store.close(); } catch { /* */ }
    }
  }
}

function allocId(maxIdRef) {
  const now = Date.now();
  const next = now > maxIdRef.n ? now : maxIdRef.n + 1;
  maxIdRef.n = next;
  return next;
}

function planRecord(rec, dest, used, maxIdRef) {
  const id = rec.id;
  const sid = String(id);
  const text = String(rec.text || "");
  const destHasId = dest.ids.has(sid);
  const usedHasId = used.ids.has(sid);
  // Merge skip-text is against DEST only. An empty-dest restore must be
  // lossless even when two source rows share a sentence (pre-02.b stores).
  const destTextId = dest.texts.has(text) ? dest.texts.get(text) : null;

  if (destHasId) {
    if (destTextId != null && String(destTextId) === sid) {
      return { action: "skip-id", id, newId: destTextId };
    }
    // Same id, different text: keep dest, remap incoming.
    const next = allocId(maxIdRef);
    used.ids.add(String(next));
    return { action: "remap", id, newId: next };
  }
  if (usedHasId) {
    const next = allocId(maxIdRef);
    used.ids.add(String(next));
    return { action: "remap", id, newId: next };
  }
  if (destTextId != null) {
    // Byte-identical text, different id: skip as restatement. Pointers
    // (superseded_by) rewrite onto the dest survivor so history still
    // resolves. Do not append a duplicate.
    return { action: "skip-text", id, newId: destTextId };
  }
  used.ids.add(sid);
  const n = Number(id);
  if (Number.isFinite(n) && n > maxIdRef.n) maxIdRef.n = n;
  return { action: "keep", id, newId: id };
}

async function buildPlan(src, dest, flags) {
  flags = flags || {};
  const merge = !!flags.merge;
  const withEdges = !!flags.withEdges;
  const replaceEdges = !!flags.replaceEdges;
  const records = emptyCounts();
  const remap = new Map();
  const used = { ids: new Set(), texts: new Map() };
  const maxIdRef = { n: dest.maxId || 0 };
  let willAdd = 0, willSkipId = 0, willSkipText = 0, willRemap = 0, willKeepId = 0;

  for await (const obj of iterateSourceRecords(src)) {
    const rec = prepareRecord(obj);
    bumpStatus(records, rec);
    const d = planRecord(rec, dest, used, maxIdRef);
    remap.set(String(d.id), d.newId);
    if (d.action === "keep") { willKeepId++; willAdd++; }
    else if (d.action === "remap") { willRemap++; willAdd++; }
    else if (d.action === "skip-id") willSkipId++;
    else if (d.action === "skip-text") willSkipText++;
  }

  const srcEdges = src.isRmExport ? loadSourceEdges(src) : { edges: new Map(), count: 0 };
  let edgesWillRestore = 0;
  let edgesSkipped = 0;
  if (withEdges && src.isRmExport) {
    const liveIds = new Set(dest.ids);
    for (const id of used.ids) liveIds.add(String(id));
    for (const [, newId] of remap) liveIds.add(String(newId));
    for (const rec of srcEdges.edges.values()) {
      const a = remap.has(String(rec.a)) ? remap.get(String(rec.a)) : rec.a;
      const b = remap.has(String(rec.b)) ? remap.get(String(rec.b)) : rec.b;
      if (liveIds.has(String(a)) && liveIds.has(String(b))) edgesWillRestore++;
      else edgesSkipped++;
    }
  }

  const errors = [];
  const warnings = [];
  if (!dest.empty && !merge) {
    errors.push({
      code: "IMPORT_DEST_NONEMPTY",
      message: "destination already has " + dest.count +
        " memories; pass --merge to add, or import into an empty store",
    });
  }
  if (withEdges && !src.isRmExport) {
    errors.push({
      code: "IMPORT_NOT_EXPORT",
      message: "--with-edges requires a Resonance Memory export zip (manifest.format = resonance-memory-export). " +
        "A raw jsonl never restores associations — that is the planted-sidecar refusal.",
    });
  }
  if (withEdges && src.isRmExport && dest.edgeCount > 0 && !replaceEdges) {
    errors.push({
      code: "IMPORT_EDGES_EXIST",
      message: "destination already has " + dest.edgeCount +
        " learned associations; pass --replace-edges to overwrite, or omit --with-edges to keep them",
    });
  }
  if (src.kind === "zip" && !src.isRmExport) {
    warnings.push("zip has no resonance-memory-export manifest; importing memories.jsonl only");
  }
  if (dest.willMigrate) {
    warnings.push("destination is a live JSONL; --apply will auto-migrate it to SQLite first (openStore default)");
  }

  return {
    sourceKind: src.kind,
    sourcePath: src.path,
    isRmExport: src.isRmExport,
    destEmpty: dest.empty,
    destBackend: dest.backend,
    destPath: dest.path,
    destCount: dest.count,
    destEdges: dest.edgeCount,
    records,
    willAdd,
    willSkipId,
    willSkipText,
    willRemap,
    willKeepId,
    edgesInSource: srcEdges.count,
    edgesWillRestore: withEdges ? edgesWillRestore : 0,
    edgesSkipped: withEdges ? edgesSkipped : 0,
    withEdges: !!withEdges,
    merge: !!merge,
    replaceEdges: !!replaceEdges,
    remap,
    warnings,
    errors,
    rmVersion: packageVersion(),
  };
}

function rewritePointers(rec, remap) {
  const out = rec;
  const idKey = String(out.id);
  if (remap.has(idKey)) out.id = remap.get(idKey);
  if (out.superseded_by != null) {
    const k = String(out.superseded_by);
    if (remap.has(k)) out.superseded_by = remap.get(k);
  }
  if (out.supersedes != null) {
    const k = String(out.supersedes);
    if (remap.has(k)) out.supersedes = remap.get(k);
  }
  return out;
}

async function maybeCrashAfter(n) {
  const after = process.env.RM_IMPORT_CRASH_AFTER;
  if (after && n >= Number(after)) {
    const ready = process.env.RM_IMPORT_CRASH_READY;
    if (ready) fs.writeFileSync(ready, "ready\n");
    await new Promise(() => {});
  }
}

async function* mappedRecords(src, plan, opts) {
  opts = opts || {};
  const remap = plan.remap;
  const skip = new Set();
  // Rebuild skip set from remap vs action: skip when remap target is dest
  // and we decided skip-id / skip-text. Easier: re-run action? We stored
  // only remap. Skip when newId is assigned to an incoming id whose action
  // wasn't add. Detect: if remap[id] !== id AND dest already had that newId
  // as the SAME incoming? Simpler to store skip ids on the plan.
  for (const id of plan._skipIds || []) skip.add(String(id));
  let n = 0;
  for await (const obj of iterateSourceRecords(src)) {
    const rec = prepareRecord(obj);
    const sid = String(rec.id);
    if (skip.has(sid)) continue;
    rewritePointers(rec, remap);
    n++;
    await maybeCrashAfter(n);
    // Panel import (RM-17) yields here so a long sqlite ingest cannot
    // starve /api/ping the way a 50k zip starved the 2c export watchdog.
    if (typeof opts.onAfterRecord === "function") {
      await opts.onAfterRecord({ n });
    }
    yield rec;
  }
}

function attachSkipIds(plan, dest) {
  // skip-id / skip-text: remap points at a dest (or earlier) id AND the
  // incoming id is not the newId (skip-text) OR the incoming id equals
  // newId and dest already had it (skip-id).
  const skipIds = [];
  for (const [oldId, newId] of plan.remap) {
    if (String(oldId) === String(newId) && dest.ids.has(String(oldId))) skipIds.push(oldId);
    else if (String(oldId) !== String(newId) && dest.ids.has(String(newId))) {
      // could be skip-text (newId is dest survivor) OR remap (newId is fresh).
      // Fresh remap ids are NOT in dest.ids (we allocated past maxId / Date.now()).
      // Collision: Date.now() could equal a dest id if dest used Date.now() ids.
      // planRecord only remaps when destHasId; skip-text when destTextId != null
      // and destHasId is false. skip-text: newId is destTextId, which IS in dest.ids.
      // remap: newId is freshly allocated, NOT in dest.ids at plan time.
      skipIds.push(oldId);
    }
  }
  plan._skipIds = skipIds;
  return skipIds;
}

async function ingestIntoStore(store, destPath, records, opts) {
  opts = opts || {};
  if (isSqliteStore(store) && typeof store.ingestAsync === "function") {
    return store.ingestAsync(records);
  }
  // JSONL dest. Empty restore: stream to .importing then rename (I5 cousin —
  // kill-9 leaves the tmp, not a truncated store). Merge: append.
  const file = store.file || destPath;
  if (opts.replaceFile) {
    const tmp = file + ".importing";
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch { /* leftover */ }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const fd = fs.openSync(tmp, "w");
    let n = 0;
    try {
      for await (const rec of records) {
        const line = recordToLine(rec) + "\n";
        fs.writeSync(fd, line);
        n++;
      }
      try { fs.fsyncSync(fd); } catch { /* */ }
      fs.closeSync(fd);
    } catch (e) {
      try { fs.closeSync(fd); } catch { /* */ }
      try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch { /* */ }
      throw e;
    }
    fs.renameSync(tmp, file);
    return n;
  }
  let n = 0;
  for await (const rec of records) {
    appendLineDurable(file, recordToLine(rec) + "\n");
    n++;
  }
  return n;
}

function restoreEdges(store, storePath, src, plan, dest) {
  if (!plan.withEdges || !src.isRmExport) return { restored: 0, skipped: 0 };
  const snap = loadSourceEdges(src);
  const remap = plan.remap;
  const live = new Set(dest.ids);
  for (const [, newId] of remap) live.add(String(newId));

  const out = new Map();
  let skipped = 0;
  for (const rec of snap.edges.values()) {
    const a = remap.has(String(rec.a)) ? remap.get(String(rec.a)) : rec.a;
    const b = remap.has(String(rec.b)) ? remap.get(String(rec.b)) : rec.b;
    if (!live.has(String(a)) || !live.has(String(b))) { skipped++; continue; }
    const rewritten = Object.assign({}, rec, { a: String(a), b: String(b) });
    // edgeKey sorts; put() will canonicalize
    const Etmp = { a: String(a), b: String(b) };
    const key = [Etmp.a, Etmp.b].sort().join(":");
    out.set(key, rewritten);
  }

  const E = openEdgeStore({ store, storePath });
  if (plan.replaceEdges || dest.edgeCount === 0) {
    E.persist.save({
      edges: out,
      recalls: snap.recalls || 0,
      processedIds: [],
      replaceAll: true,
      processedDirty: true,
      recallsDirty: true,
    });
    return { restored: out.size, skipped };
  }
  // Union into empty-of-conflict dest: skip keys dest already has.
  let restored = 0;
  for (const rec of out.values()) {
    if (E.has(rec.a, rec.b)) { skipped++; continue; }
    E.put(rec);
    restored++;
  }
  E.save();
  return { restored, skipped };
}

async function applyImport(src, destProbe, flags, opts) {
  flags = flags || {};
  opts = opts || {};
  const plan = await buildPlan(src, destProbe, flags);
  if (plan.errors.length) {
    const e = plan.errors[0];
    throw new ImportError(e.code, e.message);
  }
  attachSkipIds(plan, destProbe);

  const destPath = destProbe.path;
  const store = await openStore(destPath, {
    config: opts.config || loadLiveConfig(destPath),
    backend: opts.backend || destProbe.backend,
    log: opts.log || function () {},
  });
  try {
    const replaceFile = destProbe.empty && !isSqliteStore(store);
    const added = await ingestIntoStore(
      store,
      destPath,
      mappedRecords(src, plan, opts),
      { replaceFile }
    );
    const edges = restoreEdges(store, destPath, src, plan, destProbe);
    if (isSqliteStore(store) && typeof store.checkpoint === "function") {
      try { store.checkpoint(); } catch { /* */ }
    }
    return {
      apply: true,
      added,
      skipped: plan.willSkipId + plan.willSkipText,
      remapped: plan.willRemap,
      edgesRestored: edges.restored,
      edgesSkipped: edges.skipped,
      destPath,
      destBackend: isSqliteStore(store) ? "sqlite" : "jsonl",
      records: plan.records,
      warnings: plan.warnings,
      withEdges: plan.withEdges,
    };
  } finally {
    if (store && typeof store.close === "function") {
      try { store.close(); } catch { /* */ }
    }
  }
}

async function runImport(parsed, opts) {
  opts = opts || {};
  const flags = {
    merge: !!(parsed && parsed.merge),
    withEdges: !!(parsed && parsed.withEdges),
    replaceEdges: !!(parsed && parsed.replaceEdges),
  };
  const src = openSource(parsed.source);
  try {
    const destPath = parsed.destPath || defaultStorePath();
    const dest = await probeDest(destPath, opts);
    if (!parsed.apply) {
      const plan = await buildPlan(src, dest, flags);
      attachSkipIds(plan, dest);
      // remap is a Map — JSON.stringify would drop it. Report counts only.
      return {
        apply: false,
        sourceKind: plan.sourceKind,
        sourcePath: plan.sourcePath,
        isRmExport: plan.isRmExport,
        destEmpty: plan.destEmpty,
        destBackend: plan.destBackend,
        destPath: plan.destPath,
        destCount: plan.destCount,
        destEdges: plan.destEdges,
        records: plan.records,
        willAdd: plan.willAdd,
        willSkipId: plan.willSkipId,
        willSkipText: plan.willSkipText,
        willRemap: plan.willRemap,
        willKeepId: plan.willKeepId,
        edgesInSource: plan.edgesInSource,
        edgesWillRestore: plan.edgesWillRestore,
        edgesSkipped: plan.edgesSkipped,
        withEdges: plan.withEdges,
        merge: plan.merge,
        replaceEdges: plan.replaceEdges,
        warnings: plan.warnings,
        errors: plan.errors,
      };
    }
    // Re-open source for the apply pass (zip streams are single-shot;
    // jsonl too). buildPlan already consumed the first pass.
    src.close();
    const src2 = openSource(parsed.source);
    try {
      return await applyImport(src2, dest, flags, opts);
    } finally {
      src2.close();
    }
  } finally {
    src.close();
  }
}

function parseArgs(argv) {
  const args = argv || [];
  const rest = (args[0] === "--import") ? args.slice(1) : args;
  const out = {
    apply: false,
    merge: false,
    withEdges: false,
    replaceEdges: false,
    json: false,
    help: false,
    source: null,
    destPath: null,
  };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--apply") out.apply = true;
    else if (a === "--merge") out.merge = true;
    else if (a === "--with-edges") out.withEdges = true;
    else if (a === "--replace-edges") out.replaceEdges = true;
    else if (a === "--json") out.json = true;
    else if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--from") out.source = rest[++i];
    else if (a === "--into") out.destPath = rest[++i];
    else if (a && String(a).startsWith("--from=")) out.source = a.slice("--from=".length);
    else if (a && String(a).startsWith("--into=")) out.destPath = a.slice("--into=".length);
    else if (a && !String(a).startsWith("-") && !out.source) out.source = a;
    else if (a && !String(a).startsWith("-") && !out.destPath) out.destPath = a;
  }
  out.destPath = out.destPath || defaultStorePath();
  return out;
}

const USAGE = [
  "Usage:",
  "  resonance-memory --import <zip-or-jsonl> [--into store] [--apply] [--merge]",
  "                   [--with-edges] [--replace-edges] [--json]",
  "",
  "  --import          restore a sovereignty zip (or a raw memories.jsonl).",
  "                    Dry-run is the default: reports the plan, writes nothing.",
  "  --apply           perform the restore / merge.",
  "  --merge           required when the destination already has memories.",
  "                    Same-id same-text is skipped; same-id different-text is",
  "                    remapped (destination kept). Byte-identical text skips.",
  "  --into            destination store (default MEMORY_FILE_PATH).",
  "  --with-edges      also restore learned associations (Hebbian). Opt-in:",
  "                    import must not silently bless a planted sidecar.",
  "                    Requires a Resonance Memory export zip.",
  "  --replace-edges   overwrite destination associations (with --with-edges).",
  "  --json            machine-readable result on stdout.",
  "",
  "Does not go through save() — ids, embeddings, and history are preserved.",
  "Does not re-embed. Does not re-run the PII guard (export is unsanitized on purpose).",
  "Not a fifth MCP verb.",
].join("\n");

function printHuman(result) {
  if (!result.apply) {
    const c = result.records || emptyCounts();
    console.log("Import plan (dry-run; pass --apply to write):");
    console.log("  source     " + result.sourceKind + "  " + result.sourcePath);
    console.log("  dest       " + result.destBackend + "  " + result.destPath +
      (result.destEmpty ? "  (empty)" : "  (" + result.destCount + " existing)"));
    console.log("  records    " + c.total + " (" + c.current + " current, " +
      c.superseded + " superseded, " + c.deleted + " deleted)");
    console.log("  will add   " + result.willAdd +
      "  skip-id " + result.willSkipId +
      "  skip-text " + result.willSkipText +
      "  remap " + result.willRemap);
    if (result.withEdges) {
      console.log("  edges      restore " + result.edgesWillRestore +
        " / " + result.edgesInSource + " (skipped " + result.edgesSkipped + ")");
    } else {
      console.log("  edges      not restoring (pass --with-edges for Hebbian; opt-in on purpose)");
    }
    for (const w of result.warnings || []) console.log("  warning    " + w);
    for (const e of result.errors || []) console.log("  error      " + e.code + ": " + e.message);
    if (result.errors && result.errors.length) {
      console.log("Nothing written.");
    } else {
      console.log("Nothing written. Re-run with --apply to perform this plan.");
    }
    return;
  }
  console.log("Imported " + result.added + " memories into " + result.destPath +
    " (" + result.destBackend + ").");
  if (result.skipped) console.log("  skipped " + result.skipped + " (already present).");
  if (result.remapped) console.log("  remapped " + result.remapped + " colliding ids.");
  if (result.withEdges) {
    console.log("  associations restored: " + result.edgesRestored +
      (result.edgesSkipped ? " (skipped " + result.edgesSkipped + ")" : ""));
  }
  for (const w of result.warnings || []) console.log("  warning    " + w);
}

async function main(argv) {
  const parsed = parseArgs(argv);
  if (parsed.help) {
    console.log(USAGE);
    return 0;
  }
  if (!parsed.source) {
    console.error("missing source zip or memories.jsonl\n");
    console.error(USAGE);
    return 2;
  }
  try {
    const result = await runImport(parsed);
    if (parsed.json) console.log(JSON.stringify(result, null, 2));
    else printHuman(result);
    if (!parsed.apply && result.errors && result.errors.length) return 2;
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
    console.error(String(e && e.stack || e));
    process.exit(2);
  });
}

module.exports = {
  parseArgs,
  main,
  runImport,
  probeDest,
  openSource,
  ImportError,
  USAGE,
  defaultStorePath,
};
