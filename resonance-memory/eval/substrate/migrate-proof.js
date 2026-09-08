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
 * eval/substrate/migrate-proof.js — RM-07 slice 2a real-store proof.
 *
 * Generate a ~50k JSONL store with 768-d vectors (the S1 shape that
 * JsonlStore.all() / readFileSync cannot load), stream-migrate it, and
 * assert LOSSLESS: every source record field-equals the SqliteStore row
 * (embeddings within 1e-5), ids preserved, access folded once, created
 * preserved. Times the stream vs the readFileSync wall.
 *
 * Not the golden gate. Not npm test (too heavy, writes ~800 MB).
 *
 *   node eval/substrate/migrate-proof.js
 *   node eval/substrate/migrate-proof.js --n 50000
 */

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline");
const { generateScaleCorpus, attachSyntheticEmbeddings } = require("./generate.js");
const { migrateJsonlToSqlite } = require("../../migrate-sqlite.js");
const { SqliteStore, sqlitePathFor } = require("../../store.js");
const { AccessLog, hasVector } = require("../../record.js");

const N = (() => {
  const flag = process.argv.find((a) => a.startsWith("--n"));
  if (!flag) return 50000;
  const raw = flag.includes("=") ? flag.split("=")[1] : process.argv[process.argv.indexOf(flag) + 1];
  const n = Number(raw);
  return n > 0 ? n : 50000;
})();
const DIM = 768;
const CREATED = "2026-01-01T00:00:00.000Z";
const OLD_CREATED = "2019-06-01T00:00:00.000Z";
const EPS = 1e-5;

function embClose(a, b, eps) {
  eps = eps == null ? EPS : eps;
  if ((a == null || (a.length || 0) === 0) && (b == null || (b.length || 0) === 0)) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > eps) return false;
  return true;
}

function fmtMs(ms) { return (Math.round(ms * 10) / 10).toFixed(1) + " ms"; }
function fmtMb(bytes) { return (bytes / 1048576).toFixed(1) + " MB"; }

async function streamEqual(bakPath, sqlite, accessPathBak) {
  const access = new AccessLog(accessPathBak || bakPath + ".access.json");
  // AccessLog looks at its file; the bak'd sidecar is `<jsonl>.access.json.bak`.
  // If that path was passed, load() already ran against it.
  const byId = new Map();
  for (const r of sqlite.all()) byId.set(String(r.id), r);

  const stream = fs.createReadStream(bakPath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let n = 0, blanks = 0, mismatches = [];
  for await (const line of rl) {
    if (!String(line).trim()) { blanks++; continue; }
    n++;
    const raw = JSON.parse(line);
    const expected = access.apply([require("../../record.js").normalize({
      ...raw,
      embedding: null,
    })])[0];
    expected.embedding = hasVector(raw) ? raw.embedding : null;
    const got = byId.get(String(raw.id));
    if (!got) {
      mismatches.push("missing id " + raw.id);
      if (mismatches.length > 8) break;
      continue;
    }
    if (String(got.id) !== String(raw.id)) mismatches.push("id " + raw.id);
    if (got.created !== expected.created) {
      mismatches.push("created id " + raw.id + " src=" + expected.created + " dst=" + got.created);
    }
    if (got.text !== expected.text) mismatches.push("text id " + raw.id);
    if (got.access_count !== expected.access_count) {
      mismatches.push("access_count id " + raw.id + " src=" + expected.access_count + " dst=" + got.access_count);
    }
    if ((got.last_access || null) !== (expected.last_access || null)) {
      mismatches.push("last_access id " + raw.id);
    }
    if (String(got.superseded_by || "") !== String(expected.superseded_by || "")) {
      mismatches.push("superseded_by id " + raw.id);
    }
    if (!!got.deleted !== !!expected.deleted) mismatches.push("deleted id " + raw.id);
    if ((got.valid_to || null) !== (expected.valid_to || null)) mismatches.push("valid_to id " + raw.id);
    if (!embClose(got.embedding, expected.embedding)) {
      mismatches.push("embedding id " + raw.id +
        " srcLen=" + (expected.embedding && expected.embedding.length) +
        " dstLen=" + (got.embedding && got.embedding.length));
    }
    if (mismatches.length > 8) break;
  }
  if (n !== byId.size) mismatches.push("count source=" + n + " dest=" + byId.size);
  return { n, blanks, mismatches };
}

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rm-migrate-proof-"));
  const jsonl = path.join(dir, "resonance-memory.jsonl");
  const out = {
    n: N,
    dim: DIM,
    dir,
    generateMs: 0,
    writeMs: 0,
    jsonlBytes: 0,
    readFileSyncMs: null,
    readFileSyncError: null,
    migrateMs: 0,
    dbBytes: 0,
    lossless: false,
    mismatches: [],
    accessFold: null,
    createdPreserved: null,
    vectorlessPreserved: null,
    idsPreserved: null,
  };

  process.stderr.write("generate n=" + N + " dim=" + DIM + "\n");
  const tGen = Date.now();
  const corpus = generateScaleCorpus({ n: N });
  attachSyntheticEmbeddings(corpus, DIM, 0xE2E);
  out.generateMs = Date.now() - tGen;

  // Overlay protocol-sensitive cases onto known ids (S1 ids are 1..N).
  const byId = new Map(corpus.records.map((r) => [r.id, r]));
  const rec1 = byId.get(1);
  rec1.access_count = 2;
  rec1.created = CREATED;
  const rec13 = byId.get(13);
  delete rec13.embedding;          // vectorless — must stay vectorless
  rec13.created = CREATED;
  const rec14 = byId.get(14);
  rec14.created = OLD_CREATED;     // must survive (export folder tree keys on it)
  const rec20 = byId.get(20);
  rec20.deleted = true;
  rec20.created = CREATED;
  const rec21 = byId.get(21);
  rec21.valid_to = "2024-01-01T00:00:00.000Z";
  rec21.superseded_by = 22;
  rec21.created = CREATED;
  const rec22 = byId.get(22);
  rec22.supersedes = 21;
  rec22.created = CREATED;

  const access = {
    "1": { n: 3, last: "2026-09-01T00:00:00.000Z" },
    "2": { n: 1, last: "2026-09-02T00:00:00.000Z" },
  };

  process.stderr.write("stream-write JSONL\n");
  const tWrite = Date.now();
  const fd = fs.openSync(jsonl, "w");
  try {
    for (let i = 0; i < corpus.records.length; i++) {
      const r = corpus.records[i];
      const rec = {
        id: r.id,
        text: r.text,
        created: r.created || CREATED,
        modified: r.created || CREATED,
        embedding: r.embedding || undefined,
        access_count: r.access_count || 0,
        deleted: r.deleted || false,
        valid_from: r.valid_from || r.created || CREATED,
        valid_to: r.valid_to || null,
        superseded_by: r.superseded_by || null,
        supersedes: r.supersedes || null,
        embedding_version: 1,
        source: "user_stated",
      };
      if (!rec.embedding) delete rec.embedding;
      fs.writeSync(fd, JSON.stringify(rec) + "\n");
      if ((i + 1) % 10000 === 0) process.stderr.write("  wrote " + (i + 1) + "/" + N + "\n");
    }
    fs.writeSync(fd, "\n"); // a blank line — must not become a row
  } finally {
    fs.closeSync(fd);
  }
  fs.writeFileSync(jsonl + ".access.json", JSON.stringify({ counts: access }));
  out.writeMs = Date.now() - tWrite;
  out.jsonlBytes = fs.statSync(jsonl).size;
  process.stderr.write("JSONL " + fmtMb(out.jsonlBytes) + " in " + fmtMs(out.writeMs) + "\n");

  // The S1 wall: JsonlStore.all() is readFileSync of this file.
  process.stderr.write("try readFileSync (the old wall)\n");
  try {
    const tR = Date.now();
    const s = fs.readFileSync(jsonl, "utf8");
    out.readFileSyncMs = Date.now() - tR;
    out.readFileSyncBytes = s.length;
    out.readFileSyncError = null;
    process.stderr.write("  readFileSync DID load (" + fmtMb(s.length) + " string) in " +
      fmtMs(out.readFileSyncMs) + " — Node string cap did not trip at this size\n");
  } catch (e) {
    out.readFileSyncError = String(e && e.message || e);
    process.stderr.write("  readFileSync FAILED (the wall): " + out.readFileSyncError + "\n");
  }

  process.stderr.write("stream-migrate\n");
  const tMig = Date.now();
  const result = await migrateJsonlToSqlite(jsonl, {
    log: (m) => process.stderr.write(m + "\n"),
  });
  out.migrateMs = Date.now() - tMig;
  out.migrateStatus = result.status;
  out.migrateCount = result.count;
  if (result.status !== "migrated" || result.count !== N) {
    throw new Error("migrate did not land N rows: " + JSON.stringify(result));
  }
  const dbPath = sqlitePathFor(jsonl);
  out.dbBytes = fs.statSync(dbPath).size;
  process.stderr.write("db " + fmtMb(out.dbBytes) + " in " + fmtMs(out.migrateMs) + "\n");

  if (fs.existsSync(jsonl)) throw new Error("JSONL still at live path");
  if (!fs.existsSync(jsonl + ".bak")) throw new Error("missing .bak");

  process.stderr.write("lossless compare (stream bak vs sqlite.all)\n");
  const sqlite = new SqliteStore(dbPath);
  const tCmp = Date.now();
  const cmp = await streamEqual(jsonl + ".bak", sqlite, jsonl + ".access.json.bak");
  out.compareMs = Date.now() - tCmp;
  out.compared = cmp.n;
  out.mismatches = cmp.mismatches;

  const g1 = sqlite.get(1);
  out.accessFold = {
    id1: g1.access_count,
    expected: 5, // in-row 2 + sidecar 3
    last_access: g1.last_access,
    doubledWouldBe: 8,
  };
  out.createdPreserved = sqlite.get(14).created === OLD_CREATED;
  out.vectorlessPreserved = sqlite.get(13).embedding == null;
  out.idsPreserved = Number(sqlite.get(1).id) === 1 && Number(sqlite.get(N).id) === N;
  out.supersededPreserved = String(sqlite.get(21).superseded_by) === "22";
  out.deletedPreserved = sqlite.get(20).deleted === true;
  sqlite.close();

  out.lossless = cmp.mismatches.length === 0 && cmp.n === N &&
    out.accessFold.id1 === 5 &&
    out.createdPreserved &&
    out.vectorlessPreserved &&
    out.idsPreserved &&
    out.supersededPreserved &&
    out.deletedPreserved;

  console.log(JSON.stringify(out, null, 2));
  if (!out.lossless) {
    process.stderr.write("NOT LOSSLESS: " + JSON.stringify(cmp.mismatches) + "\n");
    process.exit(1);
  }
  process.stderr.write("LOSSLESS n=" + N + " migrate=" + fmtMs(out.migrateMs) +
    " jsonl=" + fmtMb(out.jsonlBytes) + " db=" + fmtMb(out.dbBytes) + "\n");
}

main().catch((e) => {
  console.error(String(e && e.stack || e));
  process.exit(1);
});
