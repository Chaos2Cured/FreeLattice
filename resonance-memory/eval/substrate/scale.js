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
 * eval/substrate/scale.js — S1 needle-in-haystack characterization.
 *
 * Does RM surface the RIGHT memory as the store grows 1k → 50k(+100k)?
 * Quality (recall@1/5/10, MRR, mean/median rank, hard-distractor beats)
 * and latency (p50/p95/p99 of a real recall(), field off AND on).
 *
 * Characterization, not a pass/fail A/B. Thresholds below were written
 * BEFORE any measurement ran — changing them after seeing the table is
 * cheating (same discipline as Phase 0.1's 250 ms save-time budget).
 *
 * Golden-safe: does not touch save/recall/memory-core.js. Queries go
 * through pipeline.js → createCore.recall (the same cosine path the
 * server uses). Vectors are live-embedded once against LM Studio and
 * cached under eval/substrate/.cache/ so a later run is offline.
 *
 * Usage:
 *   node eval/substrate/scale.js                 # 1k / 10k / 50k / 100k
 *   node eval/substrate/scale.js --quick         # 1k only, fewer trials
 *   node eval/substrate/scale.js --n 1000,10000
 *   node eval/substrate/scale.js --skip-100k
 *   node eval/substrate/scale.js --no-field      # skip field-on latency
 *   node eval/substrate/scale.js --embed-only    # fill the vector cache
 *   node eval/substrate/scale.js --quality-only
 *   node eval/substrate/scale.js --latency-only
 *   node eval/substrate/scale.js --store sqlite --n 50000,100000 --no-field
 *        # RM-07 product Store; direct INSERT
 *   node eval/substrate/migrate-proof.js
 *        # RM-07 slice 2a: 50k JSONL → SQLite lossless migrate
 */

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { JsonlStore, SqliteStore } = require("../../store.js");
const { normalize, isCurrent } = require("../../record.js");
const { createMemory } = require("../pipeline.js");
const { explainMetric, parsePrimaryHits } = require("../metrics.js");
const { generateScaleCorpus, DEFAULT_SEED } = require("./generate.js");

// =====================================================================
// PRE-DECLARED CONCERN THRESHOLDS (written BEFORE any measurement ran)
// =====================================================================
//
// Quality — field off, primary cosine, planted needles vs a growing
// haystack that includes HARD near-topic distractors:
//
//   recall@5  < 0.90 at N=50k  → discrimination failing
//     (a near-distractor, or haystack noise, beat the needle out of top-5)
//   MRR       < 0.80 at N=50k  → needles slipping even if still in top-5
//   mean rank > 3    at N=50k  → the "right memory" is no longer the answer
//   distractor-beat rate > 0.20 at any N
//     → the homonym/same-frame trap outranks the needle (adv-height-homonym
//       at scale). Counted per query: did ANY planted hard distractor
//       outrank that query's needle?
//
// Latency — a single recall(query, k=5) through the real path (JsonlStore
// all() parse + cosine scan + format; field-on also pays field.buildEdges
// O(n²) per call — W-03):
//
//   field-off p95 > 100 ms at N=10k
//     → RM-07 GO at the BACKLOG's estimated JSONL ceiling. RM-07's own
//       acceptance is "100k memories, recall p95 <100ms" (the SQLite
//       target); crossing 100 ms at 10k on JSONL confirms that estimate.
//   field-off p95 > 250 ms at N=50k
//     → the Phase 0.1 "tool is hanging" bar; RM-07 confirmed for scale.
//   field-on  p95 > 1000 ms at N=10k
//     → W-03 confirmed: field.buildEdges O(n²) is the owner, ANN rides
//       with RM-07. Field-on at 50k is capped if the first trial exceeds
//       FIELD_ON_TRIAL_CAP_MS (estimated ~30 min from the 0.1 scan).
//
// Measured (2026-09-05, nomic-embed 768-d, JsonlStore): field-off p95
// 489 ms at 10k; field-on p95 91 s at 10k. 50k JSONL is 834 MB and
// JsonlStore.all() throws (Node max string ~512 MB). That load failure
// is itself an RM-07 GO. Do not raise the bars to match.
//
// Changing these numbers after seeing the table is cheating.
// =====================================================================

const QUALITY_RECALL5_FLOOR = 0.90;
const QUALITY_MRR_FLOOR = 0.80;
const QUALITY_MEAN_RANK_CEILING = 3;
const QUALITY_DISTRACTOR_BEAT_CEILING = 0.20;
const LATENCY_OFF_P95_AT_10K_MS = 100;
const LATENCY_OFF_P95_AT_50K_MS = 250;
const LATENCY_ON_P95_AT_10K_MS = 1000;
const FIELD_ON_TRIAL_CAP_MS = 120000;

const DIM_EXPECTED = 768;
const EMBED_URL = process.env.EMBED_ENDPOINT || "http://localhost:1234/v1/embeddings";
const EMBED_MODEL = process.env.EMBED_MODEL || "text-embedding-nomic-embed-text-v1.5";
const BATCH = Math.max(1, Number(process.env.RESONANCE_SCALE_BATCH || 32));

const CACHE_DIR = path.join(__dirname, ".cache");
const INDEX_PATH = path.join(CACHE_DIR, "index.json");
const VEC_PATH = path.join(CACHE_DIR, "vectors.f32");
const LAST_RUN_PATH = path.join(__dirname, "last-run.json");

const FULL_NS = [1000, 10000, 50000, 100000];
const QUICK_NS = [1000];

function hash16(t) {
  return crypto.createHash("sha256").update(String(t)).digest("hex").slice(0, 16);
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function fmt(ms) { return (Math.round(ms * 10) / 10).toFixed(1); }
function fmt4(x) { return Number(x).toFixed(4); }

function trialsFor(n, fieldOn) {
  if (fieldOn) {
    if (n <= 1000) return 8;
    if (n <= 10000) return 3;
    return 1;
  }
  if (n <= 1000) return 40;
  if (n <= 10000) return 20;
  if (n <= 50000) return 12;
  return 8;
}

function parseNs(argv) {
  if (argv.includes("--quick")) return QUICK_NS.slice();
  const flag = argv.find((a) => a.startsWith("--n"));
  let ns;
  if (!flag) {
    ns = FULL_NS.slice();
  } else {
    const raw = flag.includes("=") ? flag.split("=")[1] : argv[argv.indexOf(flag) + 1];
    ns = String(raw || "").split(",").map((s) => Number(s.trim())).filter((n) => n > 0);
  }
  if (argv.includes("--skip-100k")) ns = ns.filter((n) => n < 100000);
  return ns;
}

// ---- vector cache (float32 sidecar; not committed) --------------------

function loadIndex() {
  try {
    const idx = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
    if (idx.model !== EMBED_MODEL) return { model: EMBED_MODEL, dim: DIM_EXPECTED, entries: {} };
    return idx;
  } catch {
    return { model: EMBED_MODEL, dim: DIM_EXPECTED, entries: {} };
  }
}

function saveIndex(idx) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(INDEX_PATH, JSON.stringify(idx));
}

function vecCountOnDisk() {
  try {
    return Math.floor(fs.statSync(VEC_PATH).size / (DIM_EXPECTED * 4));
  } catch { return 0; }
}

function readVecFromBuf(buf, slot, dim) {
  // readFloatLE rather than a Float32Array view: readFileSync Buffers
  // can be slices of a pool whose byteOffset is not a multiple of 4.
  const start = slot * dim * 4;
  const a = new Array(dim);
  for (let i = 0; i < dim; i++) a[i] = buf.readFloatLE(start + i * 4);
  return a;
}

function loadVecFile() {
  return fs.readFileSync(VEC_PATH);
}

function appendVecs(vectors, dim) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const fd = fs.openSync(VEC_PATH, "a");
  try {
    for (const v of vectors) {
      const buf = Buffer.alloc(dim * 4);
      const view = new Float32Array(buf.buffer, buf.byteOffset, dim);
      for (let i = 0; i < dim; i++) view[i] = v[i];
      fs.writeSync(fd, buf);
    }
  } finally { fs.closeSync(fd); }
}

async function liveEmbed(texts) {
  const res = await fetch(EMBED_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error("embed HTTP " + res.status + " " + body.slice(0, 200));
  }
  const json = await res.json();
  const out = new Array(texts.length);
  for (const d of json.data || []) {
    const i = d.index != null ? d.index : json.data.indexOf(d);
    out[i] = d.embedding;
  }
  for (let i = 0; i < out.length; i++) {
    if (!out[i]) throw new Error("embed response missing index " + i);
  }
  return out;
}

async function embedWithRetry(texts, tries) {
  let last;
  for (let t = 0; t < (tries || 3); t++) {
    try { return await liveEmbed(texts); }
    catch (e) {
      last = e;
      process.stderr.write("  embed retry " + (t + 1) + ": " + String(e.message || e) + "\n");
      await new Promise((r) => setTimeout(r, 1000 * (t + 1)));
    }
  }
  throw last;
}

async function probeEmbedder() {
  const modelsUrl = EMBED_URL.replace(/\/embeddings\/?$/, "/models");
  const res = await fetch(modelsUrl, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error("embedder probe HTTP " + res.status + " at " + modelsUrl);
  return true;
}

async function ensureVectors(texts, opts) {
  const idx = loadIndex();
  const dim = idx.dim || DIM_EXPECTED;
  const missing = [];
  const missingHash = [];
  for (const t of texts) {
    const h = hash16(t);
    if (idx.entries[h] == null) {
      missing.push(t);
      missingHash.push(h);
    }
  }
  if (!missing.length) return { idx, dim, fetched: 0 };

  if (opts && opts.offline) {
    throw new Error(missing.length + " texts uncached. Run without --offline with LM Studio on :1234.");
  }
  await probeEmbedder();
  process.stderr.write("live-embed " + missing.length + " new texts (batch=" + BATCH +
    ", already cached=" + Object.keys(idx.entries).length + ")\n");

  let slot = vecCountOnDisk();
  const fetched = [];
  for (let i = 0; i < missing.length; i += BATCH) {
    const chunk = missing.slice(i, i + BATCH);
    const vecs = await embedWithRetry(chunk);
    if (vecs[0].length !== dim && Object.keys(idx.entries).length === 0) {
      idx.dim = vecs[0].length;
    }
    const useDim = idx.dim || dim;
    if (vecs[0].length !== useDim) {
      throw new Error("embed dim " + vecs[0].length + " != cache dim " + useDim);
    }
    appendVecs(vecs, useDim);
    for (let j = 0; j < chunk.length; j++) {
      idx.entries[hash16(chunk[j])] = slot++;
    }
    fetched.push(...vecs);
    const done = Math.min(i + BATCH, missing.length);
    if (done % (BATCH * 4) === 0 || done === missing.length) {
      process.stderr.write("  " + done + "/" + missing.length + "\n");
      saveIndex(idx);
    }
  }
  saveIndex(idx);
  return { idx, dim: idx.dim || dim, fetched: missing.length };
}

function vecFor(idx, dim, text, buf) {
  const slot = idx.entries[hash16(text)];
  if (slot == null) throw new Error("uncached text: " + text.slice(0, 80));
  return readVecFromBuf(buf, slot, dim);
}

// ---- stores ----------------------------------------------------------

class RamStore {
  // In-memory Store seam for QUALITY. Ranking still goes through
  // memory-core.recall (cosine, k, historical split). applyRecall is a
  // no-op so a 24-query quality pass does not rewrite a sidecar 24 times.
  // LATENCY uses JsonlStore — that is the user-facing all()-parse cost.
  constructor(recs) { this._recs = recs; }
  all() { return this._recs; }
  current() { return this._recs.filter(isCurrent); }
  active() { return this._recs.filter((r) => !r.deleted); }
  applyRecall() { /* quality: no I/O */ }
}

function stampRecords(corpus, idx, dim, buf) {
  const created = "2026-01-01T00:00:00.000Z";
  return corpus.records.map((r) => normalize({
    id: r.id,
    text: r.text,
    embedding: vecFor(idx, dim, r.text, buf),
    created,
    embedding_version: 1,
  }));
}

function writeJsonl(file, recs) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const fd = fs.openSync(file, "w");
  try {
    for (let i = 0; i < recs.length; i++) {
      fs.writeSync(fd, JSON.stringify(recs[i]) + "\n");
    }
  } finally { fs.closeSync(fd); }
}

function makeEmbedder(idx, dim, buf) {
  // Recall only embeds the query (records already carry vectors). A
  // vectorless row would be a generator bug; fail loud rather than
  // hit the network mid-benchmark.
  const memo = new Map();
  return async function embed(texts) {
    return texts.map((t) => {
      let v = memo.get(t);
      if (!v) {
        v = vecFor(idx, dim, t, buf);
        memo.set(t, v);
      }
      return v;
    });
  };
}

// ---- quality ---------------------------------------------------------

async function rankQuery(mem, q, n, distractorIds) {
  const window = Math.min(50, n);
  const first = parsePrimaryHits(await mem.recall(q.query, window));
  const needleId = String(q.relevant_ids[0]);
  let hits = first;
  let needleRank = first.findIndex((h) => String(h.id) === needleId) + 1 || null;
  if (needleRank == null && n > window) {
    hits = parsePrimaryHits(await mem.recall(q.query, n));
    needleRank = hits.findIndex((h) => String(h.id) === needleId) + 1 || null;
  }
  const beaters = [];
  for (const d of distractorIds) {
    const r = hits.findIndex((h) => String(h.id) === String(d.id)) + 1 || null;
    if (r && needleRank && r < needleRank) {
      beaters.push({ id: d.id, rank: r, kind: d.kind, text: d.text });
    }
  }
  return {
    id: q.id,
    query: q.query,
    needleId: q.needleId,
    relevant_ids: q.relevant_ids,
    ranked_ids: hits.map((h) => String(h.id)),
    ranked_texts: hits.map((h) => h.text),
    rank: needleRank,
    beaters,
  };
}

async function runQuality(corpus, recs, embed) {
  const store = new RamStore(recs);
  const mem = createMemory({ store, embed, fieldEnabled: false });
  const byNeedle = new Map();
  for (const r of corpus.records) {
    if (r.role === "distractor") {
      let list = byNeedle.get(r.needleId);
      if (!list) { list = []; byNeedle.set(r.needleId, list); }
      list.push({ id: r.id, kind: r.kind, text: r.text });
    }
  }
  const queries = [];
  for (const q of corpus.queries) {
    queries.push(await rankQuery(mem, q, corpus.n, byNeedle.get(q.needleId) || []));
  }
  const result = { queries };
  const r1 = explainMetric("recall_at_k", result, null, { k: 1 });
  const r5 = explainMetric("recall_at_k", result, null, { k: 5 });
  const r10 = explainMetric("recall_at_k", result, null, { k: 10 });
  const mrr = explainMetric("mrr", result, null);
  const beatQueries = queries.filter((q) => q.beaters.length);
  return {
    n: corpus.n,
    n_queries: queries.length,
    recall_at_1: r1.rate,
    recall_at_5: r5.rate,
    recall_at_10: r10.rate,
    mrr: mrr.mrr,
    mean_rank: mrr.mean_rank,
    median_rank: mrr.median_rank,
    n_missed: mrr.n_missed,
    misses: mrr.misses,
    distractor_beat_rate: queries.length ? beatQueries.length / queries.length : 0,
    distractor_beats: beatQueries.map((q) => ({
      id: q.id,
      query: q.query,
      needle_rank: q.rank,
      beaters: q.beaters,
    })),
    byQuery: queries.map((q) => ({
      id: q.id, rank: q.rank, beaters: q.beaters.length, missed: q.rank == null,
    })),
  };
}

async function checkI9(recs, embed, query, tmpDir) {
  const file = path.join(tmpDir, "i9.jsonl");
  writeJsonl(file, recs);
  const store = new JsonlStore(file);
  const off = createMemory({ store, embed, fieldEnabled: false });
  const on = createMemory({
    store, embed, fieldEnabled: true, edgesPath: file + ".edges.json",
  });
  const a = parsePrimaryHits(await off.recall(query, 5));
  const b = parsePrimaryHits(await on.recall(query, 5));
  return JSON.stringify(a.map((h) => h.id)) === JSON.stringify(b.map((h) => h.id));
}

// ---- latency ---------------------------------------------------------

function parseStoreKind(argv) {
  const flag = argv.find((a) => a === "--store" || a.startsWith("--store="));
  if (!flag) return "jsonl";
  const raw = flag.includes("=") ? flag.split("=")[1] : argv[argv.indexOf(flag) + 1];
  return String(raw || "jsonl").toLowerCase() === "sqlite" ? "sqlite" : "jsonl";
}

async function runLatency(recs, embed, n, fieldOn, tmpDir, storeKind) {
  storeKind = storeKind || "jsonl";
  const base = path.join(tmpDir, "n" + n + (fieldOn ? "-on" : "-off"));
  let store, file, writeMs, bytes, writeLabel;

  if (storeKind === "sqlite") {
    file = base + ".db";
    writeLabel = "insert sqlite";
    process.stdout.write("    " + writeLabel + " (" + recs.length + " recs) ... ");
    const tWrite0 = process.hrtime.bigint();
    store = new SqliteStore(file);
    store.addMany(recs);
    writeMs = Number(process.hrtime.bigint() - tWrite0) / 1e6;
    try { bytes = fs.statSync(file).size; } catch { bytes = 0; }
  } else {
    file = base + ".jsonl";
    writeLabel = "write jsonl";
    process.stdout.write("    " + writeLabel + " (" + recs.length + " recs) ... ");
    const tWrite0 = process.hrtime.bigint();
    writeJsonl(file, recs);
    writeMs = Number(process.hrtime.bigint() - tWrite0) / 1e6;
    bytes = fs.statSync(file).size;
    store = new JsonlStore(file);
  }
  process.stdout.write(fmt(writeMs) + " ms, " + bytes + " bytes\n");

  const mem = createMemory({
    store, embed, fieldEnabled: fieldOn,
    edgesPath: fieldOn ? file + ".edges.json" : undefined,
  });
  const probeQ = "where do I live";
  process.stdout.write("    warm ... ");
  const tWarm0 = process.hrtime.bigint();
  await mem.recall(probeQ, 5);
  const warmMs = Number(process.hrtime.bigint() - tWarm0) / 1e6;
  process.stdout.write(fmt(warmMs) + " ms\n");

  if (fieldOn && warmMs > FIELD_ON_TRIAL_CAP_MS) {
    return {
      n, field: true, trials: 0, capped: true,
      warm_ms: warmMs, write_ms: writeMs, bytes,
      p50: warmMs, p95: warmMs, p99: warmMs,
      note: "first field-on recall exceeded " + FIELD_ON_TRIAL_CAP_MS +
        " ms; remaining trials skipped (W-03 O(n²))",
    };
  }

  const trials = trialsFor(n, fieldOn);
  const samples = [];
  const queries = [
    "where do I live",
    "what am I allergic to",
    "how tall should I make the bookshelf",
    "where do I work",
    "what medication do I take",
    "when is standup",
    "what's my dog's name",
    "how do I take my coffee",
  ];
  for (let t = 0; t < trials; t++) {
    const q = queries[t % queries.length];
    const t0 = process.hrtime.bigint();
    await mem.recall(q, 5);
    const t1 = process.hrtime.bigint();
    samples.push(Number(t1 - t0) / 1e6);
    if (fieldOn && samples[samples.length - 1] > FIELD_ON_TRIAL_CAP_MS) {
      samples.sort((a, b) => a - b);
      return {
        n, field: true, trials: samples.length, capped: true,
        warm_ms: warmMs, write_ms: writeMs, bytes,
        p50: percentile(samples, 50),
        p95: percentile(samples, 95),
        p99: percentile(samples, 99),
        min: samples[0], max: samples[samples.length - 1],
        note: "trial exceeded " + FIELD_ON_TRIAL_CAP_MS + " ms; stopping",
      };
    }
  }
  samples.sort((a, b) => a - b);
  const out = {
    n, field: fieldOn, trials, capped: false,
    warm_ms: warmMs, write_ms: writeMs, bytes, store: storeKind,
    p50: percentile(samples, 50),
    p95: percentile(samples, 95),
    p99: percentile(samples, 99),
    min: samples[0], max: samples[samples.length - 1],
  };
  try { if (storeKind === "sqlite" && store && typeof store.close === "function") store.close(); } catch { /* */ }
  return out;
}

function qualityVerdict(row) {
  const flags = [];
  if (row.n >= 50000 && row.recall_at_5 < QUALITY_RECALL5_FLOOR) {
    flags.push("recall@5 " + fmt4(row.recall_at_5) + " < " + QUALITY_RECALL5_FLOOR + " at N=" + row.n);
  }
  if (row.n >= 50000 && row.mrr < QUALITY_MRR_FLOOR) {
    flags.push("MRR " + fmt4(row.mrr) + " < " + QUALITY_MRR_FLOOR + " at N=" + row.n);
  }
  if (row.n >= 50000 && row.mean_rank != null && row.mean_rank > QUALITY_MEAN_RANK_CEILING) {
    flags.push("mean rank " + row.mean_rank.toFixed(2) + " > " + QUALITY_MEAN_RANK_CEILING + " at N=" + row.n);
  }
  if (row.distractor_beat_rate > QUALITY_DISTRACTOR_BEAT_CEILING) {
    flags.push("distractor-beat " + fmt4(row.distractor_beat_rate) + " > " + QUALITY_DISTRACTOR_BEAT_CEILING);
  }
  return flags;
}

function latencyVerdict(row) {
  const flags = [];
  if (!row.field && row.n >= 10000 && row.n < 50000 && row.p95 > LATENCY_OFF_P95_AT_10K_MS) {
    flags.push("field-off p95 " + fmt(row.p95) + " ms > " + LATENCY_OFF_P95_AT_10K_MS + " ms at N=10k (RM-07)");
  }
  if (!row.field && row.n >= 50000 && row.p95 > LATENCY_OFF_P95_AT_50K_MS) {
    flags.push("field-off p95 " + fmt(row.p95) + " ms > " + LATENCY_OFF_P95_AT_50K_MS + " ms at N=" + row.n + " (RM-07)");
  }
  if (row.field && row.n >= 10000 && row.n < 50000 && row.p95 > LATENCY_ON_P95_AT_10K_MS) {
    flags.push("field-on p95 " + fmt(row.p95) + " ms > " + LATENCY_ON_P95_AT_10K_MS + " ms at N=10k (W-03)");
  }
  if (row.capped) flags.push("capped: " + (row.note || "trial budget"));
  return flags;
}

function printQualityTable(rows) {
  console.log("");
  console.log("QUALITY (field off, primary cosine, k-window from full ranking)");
  console.log("| N | Q | recall@1 | recall@5 | recall@10 | MRR | mean rank | median | beat rate | misses |");
  console.log("|---|---|----------|----------|-----------|-----|-----------|--------|-----------|--------|");
  for (const r of rows) {
    console.log("| " + r.n +
      " | " + r.n_queries +
      " | " + fmt4(r.recall_at_1) +
      " | " + fmt4(r.recall_at_5) +
      " | " + fmt4(r.recall_at_10) +
      " | " + fmt4(r.mrr) +
      " | " + (r.mean_rank == null ? "n/a" : r.mean_rank.toFixed(2)) +
      " | " + (r.median_rank == null ? "n/a" : r.median_rank) +
      " | " + fmt4(r.distractor_beat_rate) +
      " | " + r.n_missed + " |");
  }
}

function printLatencyTable(rows, label) {
  console.log("");
  const kind = (rows[0] && rows[0].store) || "jsonl";
  const byteCol = kind === "sqlite" ? "db bytes" : "jsonl bytes";
  console.log("LATENCY " + label + " (recall(query, k=5), " +
    (kind === "sqlite" ? "SqliteStore, BLOB + in-process cache" : "JsonlStore, embeddings in JSONL") + ")");
  console.log("| N | trials | p50 (ms) | p95 (ms) | p99 (ms) | " + byteCol + " | write (ms) | warm (ms) |");
  console.log("|---|--------|----------|----------|----------|-------------|------------|-----------|");
  for (const r of rows) {
    console.log("| " + r.n +
      " | " + r.trials + (r.capped ? "*" : "") +
      " | " + fmt(r.p50) +
      " | " + fmt(r.p95) +
      " | " + fmt(r.p99) +
      " | " + r.bytes +
      " | " + fmt(r.write_ms) +
      " | " + fmt(r.warm_ms) + " |");
  }
}

async function main(argv) {
  argv = argv || process.argv.slice(2);
  const ns = parseNs(argv);
  const maxN = Math.max.apply(null, ns);
  const wantQuality = !argv.includes("--latency-only");
  const wantLatency = !argv.includes("--quality-only") && !argv.includes("--embed-only");
  const wantField = !argv.includes("--no-field") && wantLatency;
  const fieldLarge = argv.includes("--field-50k");
  const offline = argv.includes("--offline");
  const embedOnly = argv.includes("--embed-only");
  const storeKind = parseStoreKind(argv);

  console.log("S1 substrate recall scale");
  console.log("seed=" + DEFAULT_SEED + "  model=" + EMBED_MODEL + "  batch=" + BATCH);
  console.log("N=" + ns.join(",") + "  maxN=" + maxN + "  store=" + storeKind);
  console.log("PRE-DECLARED: recall@5≥" + QUALITY_RECALL5_FLOOR +
    "  MRR≥" + QUALITY_MRR_FLOOR +
    "  mean rank≤" + QUALITY_MEAN_RANK_CEILING +
    "  beat≤" + QUALITY_DISTRACTOR_BEAT_CEILING);
  console.log("PRE-DECLARED: field-off p95≤" + LATENCY_OFF_P95_AT_10K_MS + "ms @10k, ≤" +
    LATENCY_OFF_P95_AT_50K_MS + "ms @50k; field-on p95≤" + LATENCY_ON_P95_AT_10K_MS + "ms @10k");
  console.log("");

  process.stdout.write("generate N=" + maxN + " ... ");
  const tGen0 = process.hrtime.bigint();
  const full = generateScaleCorpus({ n: maxN, seed: DEFAULT_SEED });
  console.log(full.records.length + " records (" + full.planted +
    " planted, " + full.queries.length + " needles) in " +
    fmt(Number(process.hrtime.bigint() - tGen0) / 1e6) + " ms");

  const texts = full.records.map((r) => r.text).concat(full.queries.map((q) => q.query));
  const { idx, dim, fetched } = await ensureVectors(texts, { offline });
  console.log("vectors dim=" + dim + "  newly embedded=" + fetched +
    "  cache entries=" + Object.keys(idx.entries).length);
  if (embedOnly) {
    console.log("embed-only: cache filled, exiting.");
    return;
  }

  const vecBuf = loadVecFile();
  const embed = makeEmbedder(idx, dim, vecBuf);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rm-s1-"));
  const qualityRows = [];
  const latencyOff = [];
  const latencyOn = [];
  const allFlags = [];
  let i9 = null;

  try {
    for (const n of ns) {
      console.log("\n=== N=" + n + " ===");
      const corpus = generateScaleCorpus({ n, seed: DEFAULT_SEED });
      process.stdout.write("  attach embeddings ... ");
      const tA0 = process.hrtime.bigint();
      const recs = stampRecords(corpus, idx, dim, vecBuf);
      console.log(fmt(Number(process.hrtime.bigint() - tA0) / 1e6) + " ms");

      if (wantQuality) {
        process.stdout.write("  quality ... ");
        const tQ0 = process.hrtime.bigint();
        const qrow = await runQuality(corpus, recs, embed);
        console.log(fmt(Number(process.hrtime.bigint() - tQ0) / 1e6) + " ms  " +
          "r@1=" + fmt4(qrow.recall_at_1) +
          " r@5=" + fmt4(qrow.recall_at_5) +
          " r@10=" + fmt4(qrow.recall_at_10) +
          " mrr=" + fmt4(qrow.mrr) +
          " meanRank=" + (qrow.mean_rank == null ? "n/a" : qrow.mean_rank.toFixed(2)) +
          " beat=" + fmt4(qrow.distractor_beat_rate));
        const qf = qualityVerdict(qrow);
        if (qf.length) {
          console.log("    CONCERN: " + qf.join("; "));
          allFlags.push(...qf);
        }
        if (qrow.distractor_beats.length) {
          for (const b of qrow.distractor_beats) {
            console.log("    BEAT " + b.id + " needle_rank=" + b.needle_rank +
              " by " + b.beaters.map((x) => x.kind + " r" + x.rank + " «" + x.text + "»").join(" | "));
          }
        }
        qualityRows.push(qrow);
      }

      if (i9 == null && n <= 1000 && wantField) {
        process.stdout.write("  I9 primary-identical field on/off ... ");
        i9 = await checkI9(recs, embed, corpus.queries[0].query, tmpDir);
        console.log(i9 ? "HOLD" : "BROKEN");
        if (!i9) allFlags.push("I9 broken at N=" + n + ": field reordered primary hits");
      }

      if (wantLatency) {
        process.stdout.write("  latency field-off (" + trialsFor(n, false) + " trials)\n");
        let off;
        try {
          off = await runLatency(recs, embed, n, false, tmpDir, storeKind);
        } catch (e) {
          console.log("    FAILED: " + String(e && e.message || e));
          allFlags.push("field-off latency failed at N=" + n + ": " + String(e && e.message || e));
          off = null;
        }
        if (!off) continue;
        console.log("    p50=" + fmt(off.p50) + "  p95=" + fmt(off.p95) + "  p99=" + fmt(off.p99));
        const of = latencyVerdict(off);
        if (of.length) {
          console.log("    CONCERN: " + of.join("; "));
          allFlags.push(...of);
        }
        latencyOff.push(off);

        const runOn = wantField && (n <= 10000 || (fieldLarge && n <= 50000));
        if (runOn) {
          process.stdout.write("  latency field-on (" + trialsFor(n, true) + " trials)\n");
          try {
            const on = await runLatency(recs, embed, n, true, tmpDir, storeKind);
            console.log("    p50=" + fmt(on.p50) + "  p95=" + fmt(on.p95) + "  p99=" + fmt(on.p99) +
              (on.capped ? "  CAPPED" : ""));
            const onf = latencyVerdict(on);
            if (onf.length) {
              console.log("    CONCERN: " + onf.join("; "));
              allFlags.push(...onf);
            }
            latencyOn.push(on);
          } catch (e) {
            console.log("    FAILED: " + String(e && e.message || e));
            allFlags.push("field-on latency failed at N=" + n + ": " + String(e && e.message || e));
          }
        } else if (wantField) {
          console.log("  latency field-on SKIPPED at N=" + n +
            " (pass --field-50k to force; W-03 O(n²) estimated minutes-to-hours)");
        }
      }
    }
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* tmp */ }
  }

  if (qualityRows.length) printQualityTable(qualityRows);
  if (latencyOff.length) printLatencyTable(latencyOff, "field-off");
  if (latencyOn.length) printLatencyTable(latencyOn, "field-on");

  console.log("");
  console.log("Thresholds tripped: " + (allFlags.length ? allFlags.join(" | ") : "none"));
  const qualityConcern = qualityRows.some((r) => qualityVerdict(r).length);
  const latencyConcern = [...latencyOff, ...latencyOn].some((r) => latencyVerdict(r).length);
  let story;
  if (qualityConcern && latencyConcern) story = "BOTH: discrimination AND latency (RM-07 / W-03)";
  else if (qualityConcern) story = "QUALITY: substrate discrimination (not RM-07)";
  else if (latencyConcern) story = "LATENCY: quality held; RM-07 / W-03 owns the curve";
  else story = "NEITHER threshold tripped at the measured N (still a characterization, not a ship gate)";
  console.log("Story: " + story);
  if (i9 != null) console.log("I9 primary-identical at N<=1k: " + (i9 ? "HOLD" : "BROKEN"));

  const payload = {
    generated: new Date().toISOString(),
    seed: DEFAULT_SEED,
    model: EMBED_MODEL,
    dim,
    ns,
    store: storeKind,
    predeclared: {
      QUALITY_RECALL5_FLOOR, QUALITY_MRR_FLOOR, QUALITY_MEAN_RANK_CEILING,
      QUALITY_DISTRACTOR_BEAT_CEILING, LATENCY_OFF_P95_AT_10K_MS,
      LATENCY_OFF_P95_AT_50K_MS, LATENCY_ON_P95_AT_10K_MS, FIELD_ON_TRIAL_CAP_MS,
    },
    quality: qualityRows,
    latency_off: latencyOff,
    latency_on: latencyOn,
    flags: allFlags,
    story,
    i9,
  };
  fs.writeFileSync(LAST_RUN_PATH, JSON.stringify(payload, null, 2));
  console.log("wrote " + LAST_RUN_PATH);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(String(e && e.stack || e));
    process.exit(2);
  });
}

module.exports = {
  QUALITY_RECALL5_FLOOR, QUALITY_MRR_FLOOR, QUALITY_MEAN_RANK_CEILING,
  QUALITY_DISTRACTOR_BEAT_CEILING, LATENCY_OFF_P95_AT_10K_MS,
  LATENCY_OFF_P95_AT_50K_MS, LATENCY_ON_P95_AT_10K_MS,
  parseNs, trialsFor, qualityVerdict, latencyVerdict,
};
