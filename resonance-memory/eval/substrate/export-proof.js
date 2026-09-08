#!/usr/bin/env node
/*
 * Resonance Memory
 * Copyright (C) 2026 Samuel Jackson Grim
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version. See <https://www.gnu.org/licenses/>.
 */
/*
 * eval/substrate/export-proof.js — RM-07 slice 2b real-store proof.
 *
 * Build a ~50k SqliteStore with 768-d vectors (the S1 shape JSONL cannot
 * load), plant CJK / reserved-name / deleted / superseded rows plus a
 * Hebbian sidecar, `--export` the sovereignty zip, and assert:
 *   - the zip opens (ZipReader + Windows ZipFile.OpenRead)
 *   - ZIP64 EOCD is present (and a synthetic 70k-entry zip exceeds 65,535)
 *   - memories.jsonl round-trips lossless (count + field equality;
 *     embeddings within 1e-5 — the jsonl IS the interchange copy)
 *   - catalog paths resolve, folder tree is YYYY/MM/DD, edges.json present
 *   - non-Latin + reserved-name slugs are safe
 *
 * Not the golden gate. Not npm test (too heavy).
 *
 *   node eval/substrate/export-proof.js
 *   node eval/substrate/export-proof.js --n 50000
 */

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline");
const { spawnSync } = require("child_process");
const { generateScaleCorpus, attachSyntheticEmbeddings } = require("./generate.js");
const { SqliteStore } = require("../../store-sqlite.js");
const { ZipWriter, ZipReader, hasZip64Eocd } = require("../../zip.js");
const {
  exportZipBundle, memorySlug, memoryDayPath, recordToJsonlLine,
} = require("../../export-memory.js");
const { normalize, hasVector } = require("../../record.js");
const { EdgeStore, makeEdge } = require("../../edges.js");

const N = (() => {
  const flag = process.argv.find((a) => a.startsWith("--n"));
  if (!flag) return 50000;
  const raw = flag.includes("=") ? flag.split("=")[1] : process.argv[process.argv.indexOf(flag) + 1];
  const n = Number(raw);
  return n > 0 ? n : 50000;
})();
const DIM = 768;
const EPS = 1e-5;
const ZIP64_N = 70000;

function embClose(a, b, eps) {
  eps = eps == null ? EPS : eps;
  if ((a == null || (a.length || 0) === 0) && (b == null || (b.length || 0) === 0)) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > eps) return false;
  return true;
}

function fmtMs(ms) { return (Math.round(ms * 10) / 10).toFixed(1) + " ms"; }
function fmtMb(bytes) { return (bytes / 1048576).toFixed(1) + " MB"; }

function isoDay(i) {
  // ~70 files/day-folder at 50k — the Explorer-hang line the design picked.
  const start = Date.parse("2024-01-01T00:00:00.000Z");
  return new Date(start + Math.floor(i / 70) * 86400000).toISOString();
}

function windowsOpenCount(zipPath) {
  const ps = [
    "Add-Type -AssemblyName System.IO.Compression.FileSystem",
    "$z = [System.IO.Compression.ZipFile]::OpenRead(" + JSON.stringify(zipPath) + ")",
    "Write-Output $z.Entries.Count",
    "$z.Dispose()",
  ].join("; ");
  const r = spawnSync("powershell.exe", ["-NoProfile", "-Command", ps], {
    encoding: "utf8", timeout: 120000,
  });
  if (r.status !== 0) {
    return { ok: false, error: (r.stderr || r.stdout || "powershell failed").trim() };
  }
  const n = Number(String(r.stdout || "").trim());
  return { ok: Number.isFinite(n), count: n, stdout: String(r.stdout || "").trim() };
}

async function roundTripJsonl(zip, root, sqlite) {
  const name = root + "/memories.jsonl";
  const stream = zip.createReadStream(name);
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  const byId = new Map();
  for (const r of sqlite.iterate()) byId.set(String(r.id), r);
  let n = 0, mismatches = [];
  for await (const line of rl) {
    if (!String(line).trim()) continue;
    n++;
    const raw = JSON.parse(line);
    const got = byId.get(String(raw.id));
    if (!got) {
      mismatches.push("jsonl extra id " + raw.id);
      if (mismatches.length > 8) break;
      continue;
    }
    if (got.text !== raw.text) mismatches.push("text id " + raw.id);
    if (got.created !== raw.created) mismatches.push("created id " + raw.id);
    if (!!got.deleted !== !!raw.deleted) mismatches.push("deleted id " + raw.id);
    if (String(got.superseded_by || "") !== String(raw.superseded_by || "")) {
      mismatches.push("superseded_by id " + raw.id);
    }
    if ((got.valid_to || null) !== (raw.valid_to || null)) mismatches.push("valid_to id " + raw.id);
    if (got.access_count !== raw.access_count) mismatches.push("access_count id " + raw.id);
    const srcEmb = hasVector(got) ? got.embedding : null;
    const dstEmb = Array.isArray(raw.embedding) ? raw.embedding : null;
    if (!embClose(srcEmb, dstEmb)) mismatches.push("embedding id " + raw.id);
  }
  if (n !== byId.size) mismatches.push("count jsonl=" + n + " store=" + byId.size);
  return { n, mismatches };
}

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rm-export-proof-"));
  const dbPath = path.join(dir, "mem.db");
  const zipPath = path.join(dir, "resonance-memories-proof.zip");
  const out = {
    n: N, dim: DIM, dir, dbPath, zipPath,
    generateMs: 0, insertMs: 0, exportMs: 0, zipBytes: 0, dbBytes: 0,
    entries: 0, jsonlBytes: 0, zip64: false, windowsOpens: null,
    roundTrip: null, catalogOk: false, layoutOk: false,
    cjkOk: false, reservedOk: false, edgesOk: false,
    zip64_70k: null, lossless: false,
  };

  process.stderr.write("generate n=" + N + " dim=" + DIM + "\n");
  const tGen = Date.now();
  const corpus = generateScaleCorpus({ n: N, seed: 0xE702 });
  attachSyntheticEmbeddings(corpus, DIM, 0xE702);
  // Sovereignty landmines planted on known ids (not colliding with needles 1..planted).
  const cjkId = N - 3;
  const reservedId = N - 2;
  const deletedId = N - 1;
  const supersededId = N;
  const recs = corpus.records.map((r, i) => {
    const id = r.id;
    const created = isoDay(i);
    const rec = normalize({
      id, text: r.text, created, embedding: r.embedding,
      access_count: id === 1 ? 4 : 0,
    });
    rec.embedding = r.embedding;
    if (id === cjkId) {
      rec.text = "记忆测试 — 这是一条中文记忆";
      rec.created = "2026-03-05T08:00:00.000Z";
    }
    if (id === reservedId) {
      rec.text = "CON";
      rec.created = "2026-03-05T09:00:00.000Z";
    }
    if (id === deletedId) {
      rec.deleted = true;
      rec.text = "a deleted memory that must still be exported";
    }
    if (id === supersededId) {
      rec.superseded_by = cjkId;
      rec.valid_to = rec.created;
      rec.text = "I used to live in a place that got superseded";
    }
    return rec;
  });
  out.generateMs = Date.now() - tGen;
  process.stderr.write("  generate " + fmtMs(out.generateMs) + "\n");

  process.stderr.write("insert sqlite\n");
  const tIns = Date.now();
  const store = new SqliteStore(dbPath);
  const BATCH = 1000;
  for (let i = 0; i < recs.length; i += BATCH) {
    store.addMany(recs.slice(i, i + BATCH));
  }
  store.close();
  out.insertMs = Date.now() - tIns;
  out.dbBytes = fs.statSync(dbPath).size;
  process.stderr.write("  db " + fmtMb(out.dbBytes) + " in " + fmtMs(out.insertMs) + "\n");

  const E = new EdgeStore(dbPath + ".edges.json");
  E.put(makeEdge(1, 2, {
    origin: "co-activation", now: "2026-01-01T00:00:00.000Z", hebbianWeight: 0.55,
  }));
  E.processedIds = ["rpc-must-not-travel"];
  E.save();

  const dbBefore = fs.readFileSync(dbPath);
  process.stderr.write("export zip\n");
  const tExp = Date.now();
  const ro = new SqliteStore(dbPath, { readOnly: true });
  const result = await exportZipBundle(ro, zipPath, {
    name: "resonance-memories-proof",
    storePath: dbPath,
    now: "2026-09-05T00:00:00.000Z",
  });
  ro.close();
  out.exportMs = Date.now() - tExp;
  out.zipBytes = fs.statSync(zipPath).size;
  out.entries = result.entries;
  out.jsonlBytes = result.jsonlBytes;
  out.count = result.count;
  process.stderr.write("  zip " + fmtMb(out.zipBytes) + " entries=" + out.entries +
    " jsonl=" + fmtMb(out.jsonlBytes) + " in " + fmtMs(out.exportMs) + "\n");

  const dbAfter = fs.readFileSync(dbPath);
  out.storeUnchanged = dbBefore.equals(dbAfter);

  out.zip64 = hasZip64Eocd(zipPath);
  const zip = ZipReader.open(zipPath);
  const root = "resonance-memories-proof";
  out.readerEntries = zip.entries.length;
  out.layoutOk = zip.names().some((n) => /\/memories\/\d{4}\/\d{2}\/\d{2}\//.test(n));
  out.hasReadme = zip.has(root + "/README.txt");
  out.hasManifest = zip.has(root + "/manifest.json");
  out.hasCatalog = zip.has(root + "/catalog.txt");
  out.hasJsonl = zip.has(root + "/memories.jsonl");
  out.hasEdges = zip.has(root + "/edges.json");

  const man = JSON.parse(zip.readStored(root + "/manifest.json").toString("utf8"));
  out.manifestLayout = man.layout;
  out.manifestCount = man.count;

  const cjkName = root + "/" + memoryDayPath("2026-03-05T08:00:00.000Z") + "/" +
    memorySlug(cjkId, "记忆测试 — 这是一条中文记忆");
  const reservedName = root + "/" + memoryDayPath("2026-03-05T09:00:00.000Z") + "/" +
    memorySlug(reservedId, "CON");
  out.cjkPath = cjkName;
  out.reservedPath = reservedName;
  out.cjkOk = zip.has(cjkName);
  out.reservedOk = zip.has(reservedName) && /\/\d+\.json$/.test(reservedName);

  const catalog = zip.readStored(root + "/catalog.txt").toString("utf8");
  const catLines = catalog.trim().split("\n").slice(1);
  let catMiss = 0;
  for (const line of catLines) {
    const p = line.split("\t")[3];
    if (!zip.has(p)) catMiss++;
  }
  out.catalogRows = catLines.length;
  out.catalogMiss = catMiss;
  out.catalogOk = catMiss === 0 && catLines.length === N;

  const edges = JSON.parse(zip.readStored(root + "/edges.json").toString("utf8"));
  const ev = Object.values(edges.edges || {})[0];
  out.edgesOk = !("processed_ids" in edges) && !!(ev && ev.hebbian && ev.hebbian.weight > 0);
  out.edgesProcessedIdsPresent = "processed_ids" in edges;

  process.stderr.write("round-trip memories.jsonl\n");
  const tRt = Date.now();
  const cmpStore = new SqliteStore(dbPath, { readOnly: true });
  const cmp = await roundTripJsonl(zip, root, cmpStore);
  cmpStore.close();
  out.roundTripMs = Date.now() - tRt;
  out.roundTrip = cmp;

  process.stderr.write("windows ZipFile.OpenRead\n");
  out.windowsOpens = windowsOpenCount(zipPath);

  process.stderr.write("synthetic ZIP64 " + ZIP64_N + " entries\n");
  const z70 = path.join(dir, "zip64-70k.zip");
  const t70 = Date.now();
  const w = new ZipWriter(z70);
  const one = Buffer.from("x");
  for (let i = 0; i < ZIP64_N; i++) {
    w.addStored("e/" + String(i).padStart(6, "0"), one);
  }
  const fin70 = w.finalize();
  out.zip64_70k = {
    ms: Date.now() - t70,
    entries: fin70.entries,
    bytes: fin70.bytes,
    zip64: hasZip64Eocd(z70),
    reader: ZipReader.open(z70).entries.length,
    windows: windowsOpenCount(z70),
  };
  process.stderr.write("  70k " + fmtMs(out.zip64_70k.ms) + " entries=" +
    out.zip64_70k.entries + " zip64=" + out.zip64_70k.zip64 + "\n");

  out.lossless = cmp.mismatches.length === 0 && cmp.n === N &&
    out.zip64 &&
    out.storeUnchanged &&
    out.catalogOk &&
    out.cjkOk &&
    out.reservedOk &&
    out.edgesOk &&
    out.layoutOk &&
    man.layout === "memories/YYYY/MM/DD" &&
    out.zip64_70k.entries === ZIP64_N &&
    out.zip64_70k.reader === ZIP64_N &&
    out.zip64_70k.zip64 &&
    (out.windowsOpens.ok ? out.windowsOpens.count === out.entries : true) &&
    (out.zip64_70k.windows.ok ? out.zip64_70k.windows.count === ZIP64_N : true);

  console.log(JSON.stringify(out, null, 2));
  if (!out.lossless) {
    process.stderr.write("NOT LOSSLESS: " + JSON.stringify({
      mismatches: cmp.mismatches,
      catalogMiss: out.catalogMiss,
      cjkOk: out.cjkOk,
      reservedOk: out.reservedOk,
      edgesOk: out.edgesOk,
      zip64: out.zip64,
      zip64_70k: out.zip64_70k,
      windows: out.windowsOpens,
    }) + "\n");
    process.exit(1);
  }
  process.stderr.write("LOSSLESS n=" + N + " export=" + fmtMs(out.exportMs) +
    " zip=" + fmtMb(out.zipBytes) + " entries=" + out.entries +
    " zip64-70k=" + out.zip64_70k.entries + "\n");
}

main().catch((e) => {
  console.error(String(e && e.stack || e));
  process.exit(1);
});
