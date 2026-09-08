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
 * --export / --export-jsonl (RM-07 slice 2b): the sovereignty artifact.
 *
 * SQLite is a speed engine, not a trap. This is the file the user owns and
 * can carry to another device or hand to a competing provider — the
 * anti-lock-in counter to Mem0/Zep hoarding your data. Shipped before the
 * default-switch (slice 4) so migrating never opened a lock-in window.
 *
 *   --export            the .zip bundle (the user-facing artifact)
 *   --export-jsonl      the raw memories.jsonl (scripting primitive; the
 *                       zip wraps this, it is not replaced)
 *
 * READ-ONLY. Never mutates the store, never WAL-checkpoints, never
 * rewrites sidecars. Not a fifth MCP verb. The panel button (slice 2c)
 * shells runExport() / previewExport() — same engine, not a second writer.
 *
 * Bundle (one .zip, top-level folder = archive name, anti-tarbomb):
 *   memories.jsonl          normalize()-shape, embeddings as JSON arrays
 *                           (a competitor reads this WITHOUT our exe). DEFLATE.
 *   memories/YYYY/MM/DD/    one pretty JSON per memory, NO embeddings,
 *                           keyed on created UTC, always day-granular. STORE.
 *   catalog.txt             id · status · created · path · bytes · first-80
 *   edges.json              Hebbian data (from the table when sqlite, else
 *                           the sidecar; processed_ids/config OUT)
 *   manifest.json           counts, versions, layout: "memories/YYYY/MM/DD"
 *   README.txt              plain text; Windows double-clicks it
 *
 * We do NOT sanitize the export. Filtering your own data out is the
 * opposite of sovereignty — Tier-1 refusal does not re-run here.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { ZipWriter } = require("./zip.js");
const { JsonlStore, resolveStoreBackend, sqlitePathFor } = require("./store.js");
const { normalize, isVector } = require("./record.js");
const {
  SIDECAR_KIND, SIDECAR_VERSION, migrateAssoc, readLegacyAssoc, sidecarKind,
  SqliteEdgePersist, isSqliteStore,
} = require("./edges.js");

const LAYOUT = "memories/YYYY/MM/DD";
const SCHEMA_VERSION = 1;
const SLUG_CAP = 40;
const SNIPPET_LEN = 80;
const FS_ILLEGAL = /[<>:"/\\|?*\x00-\x1f]/g;
const WINDOWS_RESERVED = /^(con|prn|nul|com[1-9]|lpt[1-9])$/i;

function packageVersion() {
  try { return require("./package.json").version; }
  catch { return "0.0.0"; }
}

function defaultStorePath() {
  return process.env.MEMORY_FILE_PATH ||
    path.join(process.env.USERPROFILE || process.env.HOME || ".", ".lmstudio", "resonance-memory.jsonl");
}

function defaultOutDir(storePath) {
  const home = process.env.USERPROFILE || process.env.HOME || null;
  if (home) {
    const desktop = path.join(home, "Desktop");
    try { if (fs.existsSync(desktop) && fs.statSync(desktop).isDirectory()) return desktop; }
    catch { /* */ }
    try { if (fs.existsSync(home) && fs.statSync(home).isDirectory()) return home; }
    catch { /* */ }
  }
  if (storePath) return path.dirname(path.resolve(storePath));
  return process.cwd();
}

function localDateStamp(d) {
  const dt = d instanceof Date ? d : new Date();
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

function defaultExportName(d) {
  return "resonance-memories-" + localDateStamp(d);
}

/*
 * Safety-only filename sanitize (Samuel: don't scrub into unrecognizable
 * junk). Lowercase, spaces→hyphens, strip filesystem-illegal and trailing
 * dots/spaces, collapse hyphens. Reserved / empty → empty string so the
 * caller can fall back to `<id>.json`. No hash suffix. No ASCII-fold.
 */
function safetySlug(text) {
  let s = String(text || "").toLowerCase();
  s = s.replace(/\s+/g, "-");
  s = s.replace(FS_ILLEGAL, "");
  s = s.replace(/-+/g, "-");
  s = s.replace(/^[.-]+/, "");
  s = s.replace(/[.\s-]+$/, "");
  if (s.length > SLUG_CAP) {
    const cut = s.slice(0, SLUG_CAP);
    const h = cut.lastIndexOf("-");
    s = h > 0 ? cut.slice(0, h) : cut;
    s = s.replace(/[.-]+$/, "");
  }
  if (!s || s === "." || s === ".." || WINDOWS_RESERVED.test(s)) return "";
  return s;
}

function memorySlug(id, text) {
  const slug = safetySlug(text);
  const ident = String(id);
  return slug ? ident + "-" + slug + ".json" : ident + ".json";
}

function sanitizeExportName(raw, fallback) {
  const fb = fallback || defaultExportName();
  let s = String(raw == null || raw === "" ? fb : raw);
  s = s.replace(/[/\\]+/g, "-");
  s = s.replace(FS_ILLEGAL, "");
  s = s.replace(/\.zip$/i, "");
  s = s.replace(/[.\s]+$/g, "");
  s = s.replace(/^[.\s]+/g, "");
  if (!s || WINDOWS_RESERVED.test(s)) return fb;
  return s;
}

function uniqueZipPath(dir, name, opts) {
  // Preview (panel confirm modal) must not mkdir — that's a write.
  // The real export still creates the dest dir so Desktop-missing is fine.
  if (!opts || opts.create !== false) fs.mkdirSync(dir, { recursive: true });
  const first = path.join(dir, name + ".zip");
  if (!fs.existsSync(first)) return first;
  for (let i = 2; i < 10000; i++) {
    const p = path.join(dir, name + " (" + i + ").zip");
    if (!fs.existsSync(p)) return p;
  }
  throw new Error("could not find a free export name under " + dir);
}

function uniqueJsonlPath(dir, name) {
  fs.mkdirSync(dir, { recursive: true });
  const first = path.join(dir, name + ".jsonl");
  if (!fs.existsSync(first)) return first;
  for (let i = 2; i < 10000; i++) {
    const p = path.join(dir, name + " (" + i + ").jsonl");
    if (!fs.existsSync(p)) return p;
  }
  throw new Error("could not find a free export name under " + dir);
}

/*
 * Folder tree is a pure function of `created` (UTC, zero-padded).
 * Always day-granular — no dynamic spill. Path = f(record).
 */
function memoryDayPath(created) {
  const d = new Date(created);
  const dt = Number.isNaN(d.getTime()) ? new Date(0) : d;
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(dt.getUTCDate()).padStart(2, "0");
  return "memories/" + y + "/" + m + "/" + day;
}

function recordStatus(r) {
  if (r && r.deleted) return "deleted";
  if (r && (r.valid_to || r.superseded_by)) return "superseded";
  return "current";
}

function embeddingAsArray(emb) {
  if (!isVector(emb)) return null;
  return Array.from(emb);
}

function recordToJsonlLine(rec) {
  const n = normalize(rec);
  n.embedding = embeddingAsArray(rec && rec.embedding);
  return JSON.stringify(n);
}

function recordToHumanJson(rec) {
  const n = normalize(rec);
  delete n.embedding;
  return JSON.stringify(n, null, 2) + "\n";
}

function snippet(text, n) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  if (s.length <= n) return s;
  return s.slice(0, n);
}

function catalogHeader() {
  return ["id", "status", "created", "path", "bytes", "text"].join("\t") + "\n";
}

function catalogLine(rec, archivePath, bytes) {
  return [
    String(rec.id),
    recordStatus(rec),
    rec.created || "",
    archivePath,
    String(bytes),
    snippet(rec.text, SNIPPET_LEN),
  ].join("\t") + "\n";
}

function buildReadme() {
  return [
    "Resonance Memory — your memories",
    "================================",
    "",
    "These are YOUR memories. You own this file. It is a diary, not a",
    "settings file. Anyone who has this archive can read its contents.",
    "",
    "Filenames under memories/ may contain the text of a memory (so the",
    "zip listing is a table of contents). Treat this archive as personal",
    "data.",
    "",
    "What is in here",
    "---------------",
    "memories.jsonl",
    "    The machine-interchange copy. One memory per line, embeddings as",
    "    JSON arrays. A competitor, a script, or another device can read",
    "    this WITHOUT Resonance Memory. This is the importable half.",
    "",
    "memories/YYYY/MM/DD/<id>-<slug>.json",
    "    One file per memory, human-browsable, keyed on created (UTC,",
    "    zero-padded). Text and metadata only — no embedding vectors",
    "    (re-embed on import). Always day-granular.",
    "",
    "catalog.txt",
    "    Flat scan index (id, status, created, path, bytes, first words).",
    "    Usable without unzipping. Use this when the archive is large;",
    "    Explorer/Finder can choke on tens of thousands of members.",
    "",
    "edges.json",
    "    Learned associations (Hebbian weights). Without this file the",
    "    facts travel and the associations do not. Semantic scores are a",
    "    derived cache and may be recomputed; Hebbian weight may not.",
    "",
    "manifest.json",
    "    Counts, versions, and layout: \"" + LAYOUT + "\".",
    "",
    "We do not sanitize this export. Filtering your own data out of a",
    "copy you own is the opposite of sovereignty. Secrets you saved are",
    "still here.",
    "",
    "Extract to a short path (Windows MAX_PATH is 260 characters unless",
    "long paths are enabled). Example: C:\\rm-export",
    "",
    "How to use this on another device",
    "---------------------------------",
    "Keep the zip. Hand memories.jsonl to anything that reads JSONL.",
    "To load it back into Resonance Memory:",
    "  resonance-memory --import this.zip            (dry-run; writes nothing)",
    "  resonance-memory --import this.zip --apply    (restore into an empty store)",
    "  Add --merge if the destination already has memories.",
    "  Add --with-edges to restore learned associations (opt-in on purpose).",
    "",
  ].join("\n");
}

function buildManifest(info) {
  return JSON.stringify({
    format: "resonance-memory-export",
    schema_version: SCHEMA_VERSION,
    layout: LAYOUT,
    rm_version: info.rmVersion || packageVersion(),
    exported_at: info.exportedAt,
    name: info.name,
    count: {
      total: info.count.total,
      current: info.count.current,
      superseded: info.count.superseded,
      deleted: info.count.deleted,
    },
    includes: {
      memories_jsonl: "normalize()-shape records, embeddings as JSON arrays; the importable half",
      memories_files: "text + metadata, no embedding vectors; re-embed on import",
      catalog: "id, status, created, path, bytes, first ~80 chars",
      edges: "Hebbian sidecar (learned associations); processed_ids omitted",
      readme: true,
    },
    excludes: {
      embeddings_in_files: "would bloat the human tree; re-embed on import",
      processed_ids: "runtime MCP request-id LRU, not memory",
      config: "prefs, not memory",
    },
    notes: [
      "Extract to a short path (Windows MAX_PATH).",
      "memories.jsonl is the machine-interchange copy — a competitor reads it without our exe.",
      "Use catalog.txt at large N; Explorer/Finder may hang on tens of thousands of members.",
      "Whole store is included (current, superseded, and deleted). History is the point.",
    ],
  }, null, 2) + "\n";
}

/*
 * Read the Hebbian sidecar without constructing EdgeStore — its
 * constructor lazily writes a migrated .edges.json, and export is
 * read-only. processed_ids stay OUT (runtime, not memory).
 */
function edgesPathCandidates(storePath, storeFile) {
  const out = [];
  const add = (p) => { if (p && out.indexOf(p) < 0) out.push(p); };
  if (storePath) add(storePath + ".edges.json");
  if (storeFile) {
    add(storeFile + ".edges.json");
    if (/\.db$/i.test(storeFile)) add(storeFile.replace(/\.db$/i, ".jsonl") + ".edges.json");
    if (/\.jsonl$/i.test(storeFile)) add(storeFile.replace(/\.jsonl$/i, ".db") + ".edges.json");
  }
  return out;
}

function snapToExportEnvelope(snap) {
  const bag = {};
  if (snap && snap.edges) {
    for (const [k, rec] of snap.edges) bag[k] = rec;
  }
  return {
    kind: SIDECAR_KIND,
    version: SIDECAR_VERSION,
    recalls: snap && typeof snap.recalls === "number" ? snap.recalls : 0,
    edges: bag,
  };
}

function loadEdgesEnvelope(storePath, storeFile, store) {
  const empty = { kind: SIDECAR_KIND, version: SIDECAR_VERSION, recalls: 0, edges: {} };
  // Slice 5: SQLite backend stores Hebbian data in the table. Read that
  // first (export is read-only — do not migrate a leftover sidecar here).
  // processed_ids stay OUT (runtime, not memory).
  if (isSqliteStore(store)) {
    try {
      const persist = new SqliteEdgePersist(store.db, { readOnly: true });
      const snap = persist.load();
      if (snap.edges && snap.edges.size > 0) return snapToExportEnvelope(snap);
    } catch { /* fall through to sidecar */ }
  }
  const candidates = edgesPathCandidates(storePath, storeFile);
  for (const p of candidates) {
    if (!p || !fs.existsSync(p)) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(p, "utf8"));
      const kind = sidecarKind(raw);
      if (kind === SIDECAR_KIND) {
        const bag = raw.edges && typeof raw.edges === "object" && !Array.isArray(raw.edges)
          ? raw.edges : {};
        return {
          kind: SIDECAR_KIND,
          version: typeof raw.version === "number" ? raw.version : SIDECAR_VERSION,
          recalls: typeof raw.recalls === "number" ? raw.recalls : 0,
          edges: bag,
        };
      }
      if (kind === "legacy-assoc") {
        const parsed = readLegacyAssoc(raw);
        const mapped = migrateAssoc(raw);
        const bag = {};
        for (const [k, rec] of mapped) bag[k] = rec;
        return {
          kind: SIDECAR_KIND,
          version: SIDECAR_VERSION,
          recalls: parsed.recalls || 0,
          edges: bag,
        };
      }
    } catch { /* fail open — missing associations, not a crash */ }
  }
  // One more try: sibling .assoc.json of the first candidate, in-memory only.
  for (const p of candidates) {
    const assoc = p && p.endsWith(".edges.json") ? p.slice(0, -".edges.json".length) + ".assoc.json" : null;
    if (!assoc || !fs.existsSync(assoc)) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(assoc, "utf8"));
      const parsed = readLegacyAssoc(raw);
      const mapped = migrateAssoc(raw);
      const bag = {};
      for (const [k, rec] of mapped) bag[k] = rec;
      return {
        kind: SIDECAR_KIND,
        version: SIDECAR_VERSION,
        recalls: parsed.recalls || 0,
        edges: bag,
      };
    } catch { /* */ }
  }
  return empty;
}

function readLiveConfig(storePath) {
  const p = process.env.RESONANCE_MEMORY_CONFIG ||
    path.join(path.dirname(storePath), "resonance-memory.config.json");
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch { return null; }
}

function openExportStore(storePath, opts) {
  opts = opts || {};
  const resolved = path.resolve(storePath);
  // READ-ONLY. Never auto-migrate, never create a .db as a side effect of
  // export. Inspect the filesystem the same way openStore would, then open
  // whichever store is already live.
  if (/\.db$/i.test(resolved)) {
    const { SqliteStore } = require("./store-sqlite.js");
    return { store: new SqliteStore(resolved, { readOnly: true }), storePath: resolved, backend: "sqlite" };
  }
  const config = opts.config || readLiveConfig(resolved);
  const backend = opts.backend || resolveStoreBackend(config);
  if (backend === "jsonl") {
    return { store: new JsonlStore(resolved), storePath: resolved, backend: "jsonl" };
  }
  const dbPath = sqlitePathFor(resolved);
  if (fs.existsSync(dbPath)) {
    const { SqliteStore } = require("./store-sqlite.js");
    return { store: new SqliteStore(dbPath, { readOnly: true }), storePath: resolved, backend: "sqlite" };
  }
  // JSONL still at the path (not yet first-opened, or fail-open after a
  // failed auto-migrate). Export that. Do not throw EXPORT_NO_DB — slice 4
  // made sqlite the default, so a JSONL user who has not opened yet still
  // has a store to export.
  return { store: new JsonlStore(resolved), storePath: resolved, backend: "jsonl" };
}

function iterateRecords(store) {
  if (store && typeof store.iterate === "function") return store.iterate();
  return store.all();
}

function formatBytes(n) {
  const x = Number(n) || 0;
  if (x <= 0) return "empty";
  if (x < 1024) return x + " B";
  if (x < 1024 * 1024) return Math.round(x / 1024) + " KB";
  const mb = x / (1024 * 1024);
  if (x < 1024 * 1024 * 1024) return (mb >= 10 ? mb.toFixed(0) : mb.toFixed(1)) + " MB";
  return (x / (1024 * 1024 * 1024)).toFixed(1) + " GB";
}

/*
 * Stream-count a JSONL store for the panel confirm modal. Must NOT
 * readFileSync the file — that is the S1 834 MB wall. Line-at-a-time
 * parse; drop the object immediately. File size is the uncompressed
 * jsonl estimate (USB/disk-full is the question the modal answers).
 */
async function summarizeJsonlFile(file) {
  const counts = { total: 0, current: 0, superseded: 0, deleted: 0 };
  let estimateBytes = 0;
  if (!file || !fs.existsSync(file)) return { count: counts, estimateBytes: 0 };
  try { estimateBytes = fs.statSync(file).size; } catch { estimateBytes = 0; }
  const readline = require("readline");
  const rl = readline.createInterface({
    input: fs.createReadStream(file, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line) continue;
    let o;
    try { o = JSON.parse(line); } catch { continue; }
    counts.total++;
    const st = recordStatus(o);
    counts[st] = (counts[st] || 0) + 1;
  }
  return { count: counts, estimateBytes };
}

async function summarizeStore(storePath, opts) {
  const opened = openExportStore(storePath, opts);
  try {
    if (opened.backend === "sqlite" && opened.store && typeof opened.store.stats === "function") {
      const s = opened.store.stats();
      return {
        backend: "sqlite",
        count: {
          total: Number(s.count) || 0,
          current: Number(s.current) || 0,
          superseded: Number(s.superseded) || 0,
          deleted: Number(s.deleted) || 0,
        },
        estimateBytes: Number(s.bytes) || 0,
      };
    }
    const file = opened.store && opened.store.file;
    const jsonl = await summarizeJsonlFile(file);
    return { backend: "jsonl", count: jsonl.count, estimateBytes: jsonl.estimateBytes };
  } finally {
    if (opened.store && typeof opened.store.close === "function") {
      try { opened.store.close(); } catch { /* */ }
    }
  }
}

/*
 * Confirm-modal payload. Read-only. Does not mkdir, does not write a zip.
 * destPath is the would-be unique name (Name (2).zip if Name.zip exists).
 */
async function previewExport(storePath, opts) {
  opts = opts || {};
  const resolved = path.resolve(storePath || defaultStorePath());
  const destDir = opts.outDir || defaultOutDir(resolved);
  const name = sanitizeExportName(opts.name, defaultExportName());
  const destPath = uniqueZipPath(destDir, name, { create: false });
  let summary;
  try {
    summary = await summarizeStore(resolved, opts);
  } catch {
    summary = {
      backend: "jsonl",
      count: { total: 0, current: 0, superseded: 0, deleted: 0 },
      estimateBytes: 0,
    };
  }
  return {
    destDir,
    destName: name,
    destPath,
    storePath: resolved,
    backend: summary.backend,
    count: summary.count,
    estimateBytes: summary.estimateBytes,
    estimateLabel: formatBytes(summary.estimateBytes),
  };
}

async function maybeCrashAfterEntry(opts, ctx) {
  if (opts && typeof opts.onAfterEntry === "function") {
    await opts.onAfterEntry(ctx);
  }
  const after = process.env.RM_EXPORT_CRASH_AFTER;
  if (after && ctx.n >= Number(after)) {
    const ready = process.env.RM_EXPORT_CRASH_READY;
    if (ready) fs.writeFileSync(ready, "ready\n");
    await new Promise(() => {});
  }
}

async function maybeCrashBeforeRename(opts, ctx) {
  if (opts && typeof opts.onBeforeRename === "function") {
    await opts.onBeforeRename(ctx);
  }
  if (process.env.RM_EXPORT_CRASH_BEFORE_RENAME) {
    const ready = process.env.RM_EXPORT_CRASH_READY;
    if (ready) fs.writeFileSync(ready, "ready\n");
    await new Promise(() => {});
  }
}

function parseArgs(argv) {
  const args = argv || [];
  let mode = "zip";
  if (args[0] === "--export-jsonl") mode = "jsonl";
  else if (args[0] === "--export") mode = "zip";
  const rest = (args[0] === "--export" || args[0] === "--export-jsonl") ? args.slice(1) : args;
  const out = { mode, json: false, help: false, name: null, outDir: null, outFile: null, storePath: null };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--json") out.json = true;
    else if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--name") out.name = rest[++i];
    else if (a === "--out") {
      const v = rest[++i];
      if (mode === "jsonl") out.outFile = v;
      else out.outDir = v;
    }
    else if (a && !String(a).startsWith("-")) out.storePath = a;
    else if (a && String(a).startsWith("--name=")) out.name = a.slice("--name=".length);
    else if (a && String(a).startsWith("--out=")) {
      const v = a.slice("--out=".length);
      if (mode === "jsonl") out.outFile = v;
      else out.outDir = v;
    }
  }
  out.storePath = out.storePath || defaultStorePath();
  return out;
}

const USAGE = [
  "Usage:",
  "  resonance-memory --export [--name <n>] [--out <dir>] [--json] [store.jsonl]",
  "  resonance-memory --export-jsonl [--out <file-or-dir>] [--json] [store.jsonl]",
  "",
  "  --export          write the sovereignty zip bundle (memories.jsonl +",
  "                    per-memory files + catalog + edges + manifest + README).",
  "  --export-jsonl    write the raw memories.jsonl (scripting primitive).",
  "  --name            archive/folder name (default resonance-memories-<local-date>).",
  "                    Also the top-level folder inside the zip (anti-tarbomb).",
  "  --out             destination directory (zip) or file/dir (jsonl).",
  "                    Default: Desktop, then home, then beside the store.",
  "  --json            machine-readable result on stdout.",
  "",
  "Never overwrites: if Name.zip exists, writes Name (2).zip.",
  "Read-only: the store is not mutated. Extract to a short path (Windows MAX_PATH).",
  "Not a fifth MCP verb. The panel 'Export my memories' button shells this same function.",
].join("\n");

async function exportJsonlToFile(store, destFile, opts) {
  opts = opts || {};
  const dest = path.resolve(destFile);
  const tmp = dest + ".tmp";
  try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch { /* leftover */ }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const fd = fs.openSync(tmp, "w");
  let n = 0;
  let bytes = 0;
  try {
    for (const rec of iterateRecords(store)) {
      const line = recordToJsonlLine(rec) + "\n";
      const buf = Buffer.from(line, "utf8");
      fs.writeSync(fd, buf);
      bytes += buf.length;
      n++;
    }
    try { fs.fsyncSync(fd); } catch { /* */ }
    fs.closeSync(fd);
  } catch (e) {
    try { fs.closeSync(fd); } catch { /* */ }
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch { /* */ }
    throw e;
  }
  fs.renameSync(tmp, dest);
  return { path: dest, count: n, bytes };
}

async function exportZipBundle(store, destZip, opts) {
  opts = opts || {};
  const dest = path.resolve(destZip);
  const name = sanitizeExportName(opts.name, path.basename(dest, ".zip"));
  const root = name;
  const exportedAt = opts.now || new Date().toISOString();
  const zip = new ZipWriter(dest, { mtime: opts.mtime || new Date(exportedAt) });
  const counts = { total: 0, current: 0, superseded: 0, deleted: 0 };
  const catalogRows = [catalogHeader()];
  let jsonlBytes = 0;
  let filesBytes = 0;

  try {
    zip.addStored(root + "/README.txt", buildReadme());

    async function* jsonlAndFiles() {
      for (const rec of iterateRecords(store)) {
        const line = recordToJsonlLine(rec) + "\n";
        jsonlBytes += Buffer.byteLength(line, "utf8");
        const human = recordToHumanJson(rec);
        const humanBytes = Buffer.byteLength(human, "utf8");
        filesBytes += humanBytes;
        const rel = memoryDayPath(rec.created) + "/" + memorySlug(rec.id, rec.text);
        const archivePath = root + "/" + rel;
        zip.addStored(archivePath, human);
        catalogRows.push(catalogLine(rec, archivePath, humanBytes));
        counts.total++;
        counts[recordStatus(rec)]++;
        await maybeCrashAfterEntry(opts, {
          n: counts.total, tmpPath: zip.tmpPath, destPath: dest, rec,
        });
        yield line;
      }
    }

    const deflated = await zip.addDeflatedStream(root + "/memories.jsonl", jsonlAndFiles());
    jsonlBytes = deflated.usize;

    zip.addStored(root + "/catalog.txt", catalogRows.join(""));

    const edges = loadEdgesEnvelope(opts.storePath, store.file, store);
    zip.addStored(root + "/edges.json", JSON.stringify(edges, null, 2) + "\n");

    const manifest = buildManifest({
      rmVersion: packageVersion(),
      exportedAt,
      name,
      count: counts,
    });
    zip.addStored(root + "/manifest.json", manifest);

    await maybeCrashBeforeRename(opts, { tmpPath: zip.tmpPath, destPath: dest, counts });
    const fin = zip.finalize();
    return {
      path: fin.path,
      name,
      count: counts,
      entries: fin.entries,
      zipBytes: fin.bytes,
      jsonlBytes,
      filesBytes,
      zip64: true,
      layout: LAYOUT,
    };
  } catch (e) {
    try { zip.abort(); } catch { /* */ }
    throw e;
  }
}

async function runExport(parsed, opts) {
  opts = opts || {};
  const opened = openExportStore(parsed.storePath, opts);
  const store = opened.store;
  try {
    if (parsed.mode === "jsonl") {
      let dest;
      if (parsed.outFile && /\.jsonl$/i.test(parsed.outFile)) {
        dest = path.resolve(parsed.outFile);
        if (fs.existsSync(dest)) {
          dest = uniqueJsonlPath(path.dirname(dest), path.basename(dest, ".jsonl"));
        }
      } else {
        const dir = parsed.outFile ? path.resolve(parsed.outFile) : defaultOutDir(parsed.storePath);
        const name = sanitizeExportName(parsed.name, defaultExportName());
        dest = uniqueJsonlPath(dir, name);
      }
      const r = await exportJsonlToFile(store, dest, opts);
      return Object.assign({ mode: "jsonl", storePath: opened.storePath, backend: opened.backend }, r);
    }
    const dir = parsed.outDir ? path.resolve(parsed.outDir) : defaultOutDir(parsed.storePath);
    const name = sanitizeExportName(parsed.name, defaultExportName());
    const dest = uniqueZipPath(dir, name);
    const r = await exportZipBundle(store, dest, Object.assign({}, opts, {
      name,
      storePath: opened.storePath,
    }));
    return Object.assign({ mode: "zip", storePath: opened.storePath, backend: opened.backend }, r);
  } finally {
    if (store && typeof store.close === "function") {
      try { store.close(); } catch { /* */ }
    }
  }
}

async function main(argv) {
  const parsed = parseArgs(argv);
  if (parsed.help) {
    console.log(USAGE);
    return 0;
  }
  try {
    const result = await runExport(parsed);
    if (parsed.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (result.mode === "jsonl") {
      console.log("Wrote " + result.count + " memories to " + result.path +
        " (" + result.bytes + " bytes).");
    } else {
      const c = result.count;
      console.log("Exported " + c.total + " memories (" +
        c.current + " current, " + c.superseded + " superseded, " +
        c.deleted + " deleted) to");
      console.log("  " + result.path);
      console.log("Uncompressed memories.jsonl ~ " + result.jsonlBytes +
        " bytes; zip " + result.zipBytes + " bytes, " +
        result.entries + " entries (ZIP64).");
      console.log("Extract to a short path (Windows MAX_PATH). Use catalog.txt at large N.");
    }
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
  runExport,
  exportZipBundle,
  exportJsonlToFile,
  openExportStore,
  previewExport,
  summarizeStore,
  summarizeJsonlFile,
  formatBytes,
  memorySlug,
  safetySlug,
  memoryDayPath,
  recordStatus,
  recordToJsonlLine,
  recordToHumanJson,
  catalogLine,
  catalogHeader,
  sanitizeExportName,
  uniqueZipPath,
  uniqueJsonlPath,
  defaultOutDir,
  defaultExportName,
  defaultStorePath,
  loadEdgesEnvelope,
  buildReadme,
  buildManifest,
  LAYOUT,
  SCHEMA_VERSION,
  SLUG_CAP,
  USAGE,
};
