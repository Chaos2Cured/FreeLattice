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
 * eval/save-time-cost.js — Phase 0.1 cost sweep (Risk #1).
 *
 * Times the NEW cost save-time semantic binding adds to save(): the O(N)
 * cosine neighbor scan + writing K edges through EdgeStore.save /
 * writeFileDurable. The embedder is not in the loop (vectors are
 * synthesized). JSONL rewrite is also not in the loop — that cost is a
 * known RM-07 driver (BACKLOG: ~10k comfortable ceiling, unread) and
 * mixing it in would hide the question this sweep exists to answer:
 * "does the neighbor scan itself force RM-07?"
 *
 * =====================================================================
 * PRE-DECLARED p95 BUDGET (written BEFORE any measurement ran)
 * =====================================================================
 *
 *     SAVE_TIME_P95_BUDGET_MS = 250
 *
 * Reasoning, declared in advance:
 *
 * A `save_memory` tool call sits on the agent's turn. Local MCP is
 * otherwise cheap (localhost embed ~20–80 ms, JSONL append of one row).
 * The user has already heard "I'll remember that"; anything that then
 * stalls long enough to feel like a hang is a conversation-quality bug,
 * not a scale nice-to-have.
 *
 * 250 ms is a conservative "this tool is hanging" threshold for an
 * in-process sidecar write: well above a 768-d scan of a few thousand
 * vectors on this class of machine, well below a one-second "did it
 * crash?" beat. If save-time binding's p95 crosses 250 ms at a store
 * size users will actually hit, RM-07 (indexed neighbor query +
 * incremental sidecar writes) is mandatory, not scheduled.
 *
 * Verdict rule (also declared before running):
 *   - p95 > 250 ms at N ≤ 10k  → RM-07 GO (mandatory now). 10k is the
 *     BACKLOG's estimated JSONL ceiling; if the NEW cost already blows
 *     the budget there, do not wait for JSONL to fail too.
 *   - p95 > 250 ms only at N ≥ 50k → RM-07 stays scheduled (the scan
 *     did not force it ahead of the JSONL rewrite that will).
 *   - p95 ≤ 250 ms at 100k → RM-07 is NOT forced by save-time bind.
 *
 * Changing this number after seeing the table is cheating.
 *
 * Usage:
 *   node eval/save-time-cost.js              # full N = 100 / 1k / 10k / 50k / 100k
 *   node eval/save-time-cost.js --quick      # N = 100 / 1k only (smoke)
 *   node eval/save-time-cost.js --n 100,1000,10000
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { EdgeStore, makeEdge } = require("../edges.js");
const { bindSaveTimeNeighbors, SAVE_TIME_K, SAVE_TIME_MIN_COS } = require("../memory-core.js");

// ---- pre-declared budget. Do not edit after the first run. ----
const SAVE_TIME_P95_BUDGET_MS = 250;

const DIM = 768;   // production: nomic-embed-text-v1.5
const FULL_NS = [100, 1000, 10000, 50000, 100000];
const QUICK_NS = [100, 1000];
const TRIALS_FOR = (n) => {
  if (n <= 100) return 80;
  if (n <= 1000) return 40;
  if (n <= 10000) return 20;
  if (n <= 50000) return 12;
  return 8;
};

function parseNs(argv) {
  if (argv.includes("--quick")) return QUICK_NS;
  const flag = argv.find((a) => a.startsWith("--n"));
  if (!flag) return FULL_NS;
  const raw = flag.includes("=") ? flag.split("=")[1] : argv[argv.indexOf(flag) + 1];
  return String(raw || "").split(",").map((s) => Number(s.trim())).filter((n) => n > 0);
}

// Deterministic PRNG so a re-run is comparable. Not cryptographic.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function fillUnitMems(n, dim, rng) {
  // Real JS Arrays, not Float64Array. bindSaveTimeNeighbors (and field.js)
  // gate on Array.isArray — that's what JSON.parse of a stored embedding
  // produces. Feeding typed arrays would skip the scan and report a fake
  // early-return cost (caught: first run printed bound=0 at every N).
  const mems = new Array(n);
  for (let i = 0; i < n; i++) {
    const v = new Array(dim);
    let norm = 0;
    for (let d = 0; d < dim; d++) {
      const x = rng() * 2 - 1;
      v[d] = x;
      norm += x * x;
    }
    norm = Math.sqrt(norm) || 1;
    for (let d = 0; d < dim; d++) v[d] /= norm;
    mems[i] = { id: i + 1, embedding: v, embedding_version: 1 };
  }
  return mems;
}

function mixNear(mems, k, dim) {
  // Average of the first k records, renormalized. In 768-d, k random unit
  // vectors are nearly orthogonal, so cosine(mean, each of them) ≈ 1/sqrt(k)
  // ≈ 0.447 for k=5 — above SAVE_TIME_MIN_COS 0.25, so the trial actually
  // writes K edges rather than scanning into an empty persist.
  const v = new Array(dim).fill(0);
  const take = Math.min(k, mems.length);
  for (let i = 0; i < take; i++) {
    const e = mems[i].embedding;
    for (let d = 0; d < dim; d++) v[d] += e[d];
  }
  let norm = 0;
  for (let d = 0; d < dim; d++) norm += v[d] * v[d];
  norm = Math.sqrt(norm) || 1;
  for (let d = 0; d < dim; d++) v[d] /= norm;
  return v;
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function fmt(ms) { return ms.toFixed(1); }

function measureAtN(n, trials, tmpDir) {
  const rng = mulberry32(0xC0FFEE ^ n);
  process.stdout.write("alloc ... ");
  const mems = fillUnitMems(n, DIM, rng);

  const edgesPath = path.join(tmpDir, "n" + n + ".edges.json");
  const store = new EdgeStore(edgesPath);
  const samples = [];
  let lastBound = 0;

  // Warm the hidden classes once so trial 1 isn't the JIT tax.
  bindSaveTimeNeighbors(
    { id: "warm", embedding: mixNear(mems, SAVE_TIME_K, DIM), embedding_version: 1 },
    mems, store
  );

  for (let t = 0; t < trials; t++) {
    const rec = {
      id: n + 1 + t,
      embedding: mixNear(mems, SAVE_TIME_K, DIM),
      embedding_version: 1,
    };
    const t0 = process.hrtime.bigint();
    const result = bindSaveTimeNeighbors(rec, mems, store);
    const t1 = process.hrtime.bigint();
    samples.push(Number(t1 - t0) / 1e6);
    lastBound = result.bound;
    if (t === 0 && result.bound === 0) {
      console.warn("WARNING: bound=0 on trial 0 — mixNear did not clear minCos; write cost is undercounted");
    }
  }

  samples.sort((a, b) => a - b);
  return {
    n,
    trials,
    p50: percentile(samples, 50),
    p95: percentile(samples, 95),
    p99: percentile(samples, 99),
    min: samples[0],
    max: samples[samples.length - 1],
    bound: lastBound,
    sidecarBytes: fs.existsSync(edgesPath) ? fs.statSync(edgesPath).size : 0,
  };
}

function verdictFor(row) {
  if (row.p95 <= SAVE_TIME_P95_BUDGET_MS) return "UNDER";
  return "OVER";
}

function overallVerdict(rows) {
  const over = rows.filter((r) => r.p95 > SAVE_TIME_P95_BUDGET_MS);
  if (!over.length) {
    return "NO-GO on forcing RM-07 from this slice: p95 stayed ≤ " +
      SAVE_TIME_P95_BUDGET_MS + " ms through N=" + rows[rows.length - 1].n +
      ". RM-07 remains scheduled on the JSONL-rewrite / all()-parse grounds already in BACKLOG.";
  }
  const first = over[0];
  if (first.n <= 10000) {
    return "GO on RM-07 (mandatory now): p95 " + fmt(first.p95) +
      " ms at N=" + first.n + " exceeds the pre-declared " +
      SAVE_TIME_P95_BUDGET_MS + " ms budget at a store size users will hit.";
  }
  return "NO-GO on forcing RM-07 from this slice: p95 first exceeds " +
    SAVE_TIME_P95_BUDGET_MS + " ms at N=" + first.n +
    " (" + fmt(first.p95) + " ms). The scan did not fail at the 10k JSONL ceiling; " +
    "RM-07 stays scheduled.";
}

function measureSidecarRewrite(edgeCount, trials, tmpDir) {
  // Isolated writeFileDurable cost of a mature .edges.json. The N-sweep
  // sidecar only holds the trial's K edges; a real store of N memories has
  // ~O(N) save-time edges rewritten on every bind. This is the OTHER half
  // of save-time cost, reported as a footnote so it cannot hide inside the
  // scan numbers.
  const edgesPath = path.join(tmpDir, "sidecar-" + edgeCount + ".edges.json");
  const store = new EdgeStore(edgesPath);
  for (let i = 0; i < edgeCount; i++) {
    store.put(makeEdge(i + 1, i + 2, { origin: "save-time-neighbor", hebbianWeight: 0 }));
  }
  store.save();
  const samples = [];
  for (let t = 0; t < trials; t++) {
    const t0 = process.hrtime.bigint();
    store.save();
    const t1 = process.hrtime.bigint();
    samples.push(Number(t1 - t0) / 1e6);
  }
  samples.sort((a, b) => a - b);
  return {
    edges: edgeCount,
    trials,
    p50: percentile(samples, 50),
    p95: percentile(samples, 95),
    p99: percentile(samples, 99),
    bytes: fs.existsSync(edgesPath) ? fs.statSync(edgesPath).size : 0,
  };
}

function main() {
  const argv = process.argv.slice(2);
  const sidecarOnly = argv.includes("--sidecar");
  const ns = sidecarOnly ? [] : parseNs(argv);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rm-save-time-cost-"));
  console.log("Phase 0.1 save-time bind cost sweep");
  console.log("DIM=" + DIM + "  K=" + SAVE_TIME_K + "  minCos=" + SAVE_TIME_MIN_COS);
  console.log("PRE-DECLARED p95 budget: " + SAVE_TIME_P95_BUDGET_MS + " ms");
  console.log("(declared in this file's header before any measurement ran)");
  console.log("isolates neighbor scan + EdgeStore.save; embed and JSONL rewrite excluded");
  console.log("tmp " + tmpDir);
  console.log("");

  const rows = [];
  for (const n of ns) {
    const trials = TRIALS_FOR(n);
    process.stdout.write("N=" + n + "  trials=" + trials + " ... ");
    const row = measureAtN(n, trials, tmpDir);
    rows.push(row);
    console.log("p50=" + fmt(row.p50) + "  p95=" + fmt(row.p95) + "  p99=" + fmt(row.p99) +
      "  bound=" + row.bound + "  " + verdictFor(row));
  }

  if (rows.length) {
    console.log("");
    console.log("| N | trials | p50 (ms) | p95 (ms) | p99 (ms) | K bound | vs " + SAVE_TIME_P95_BUDGET_MS + " ms |");
    console.log("|---|--------|----------|----------|----------|---------|----------------|");
    for (const r of rows) {
      console.log("| " + r.n + " | " + r.trials + " | " + fmt(r.p50) + " | " + fmt(r.p95) +
        " | " + fmt(r.p99) + " | " + r.bound + " | " + verdictFor(r) + " |");
    }
    console.log("");
    console.log("RM-07 verdict (scan + K-edge write): " + overallVerdict(rows));
  }

  const sidecarCounts = [1000, 10000, 50000];
  console.log("");
  console.log("Sidecar rewrite footnote (EdgeStore.save of an already-full table; no scan):");
  const sideRows = [];
  for (const e of sidecarCounts) {
    process.stdout.write("edges=" + e + " ... ");
    const row = measureSidecarRewrite(e, 8, tmpDir);
    sideRows.push(row);
    console.log("p50=" + fmt(row.p50) + "  p95=" + fmt(row.p95) + "  p99=" + fmt(row.p99) +
      "  bytes=" + row.bytes);
  }
  console.log("| edges | trials | p50 (ms) | p95 (ms) | p99 (ms) | bytes | vs " + SAVE_TIME_P95_BUDGET_MS + " ms |");
  console.log("|-------|--------|----------|----------|----------|-------|----------------|");
  for (const r of sideRows) {
    const vs = r.p95 <= SAVE_TIME_P95_BUDGET_MS ? "UNDER" : "OVER";
    console.log("| " + r.edges + " | " + r.trials + " | " + fmt(r.p50) + " | " + fmt(r.p95) +
      " | " + fmt(r.p99) + " | " + r.bytes + " | " + vs + " |");
  }

  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* tmp */ }
}

main();
