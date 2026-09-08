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
 * eval/measure.js — reporting metrics (A/B), distinct from the golden gate.
 *
 *   node eval/measure.js                     all measurement corpora, all registered metrics
 *                                           (recall_at_k, duplicate_rate, mrr, extraction_*)
 *   node eval/measure.js --corpus duplicates  one file / scenario-id prefix
 *   node eval/measure.js --k 5               recall_at_k's k (default 5)
 *   node eval/measure.js --json              machine-readable (02.b A/B)
 *   node eval/measure.js --bands             also print pairwise cosine within each group
 *   node eval/measure.js --extract           RM-01.c live Tier 2 (needs a chat model)
 *   node eval/measure.js --extract-model ID  chat model id (default: first non-embed)
 *   node eval/measure.js --extract-timeout N ms (default 45000 for the live A/B)
 *
 * Reuses `pipeline.js` → `memory-core.js`. Does not write golden.json, does
 * not change product behaviour. Measurement corpora (`kind: "duplicates"` /
 * `kind: "messy"` / `gate: false`) are skipped by `eval/run.js` so this
 * cannot flip the gate.
 *
 * Levers that will shift (write-path, warm-field, fusion) belong HERE as
 * runner flags, not inside a metric: a metric is a number over a result
 * shape; the runner decides which core flags produced the result. Today:
 * field off (I2: rank is cosine), k=5. `--field` is reserved so 02.b /
 * fusion don't grow a second runner.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { JsonlStore } = require("../store.js");
const { createMemory, cosine } = require("./pipeline.js");
const { embed } = require("./embed-cache.js");
const extract = require("../extract.js");
const {
  computeMetric, explainMetric, listMetrics, groupsFromWrites, parsePrimaryHits,
  isSaveRefusal, normFact, isCorrectStored,
} = require("./metrics.js");

const CORPORA = path.join(__dirname, "corpora");

function readJsonl(file) {
  return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

function isSelfContainedScenario(c) {
  return c && Array.isArray(c.writes) && Array.isArray(c.queries);
}

function isMeasurementLine(c) {
  if (!c) return false;
  if (c.kind === "duplicates" || c.kind === "messy" || c.kind === "measure" || c.gate === false) return true;
  if (c.role === "write" || c.role === "query" || c.role === "meta") return true;
  return isSelfContainedScenario(c) && !c.expect;
}

function loadScenarios(file) {
  const lines = readJsonl(file);
  const scenarios = [];
  let current = null;
  const flush = () => { if (current) { scenarios.push(current); current = null; } };
  for (const c of lines) {
    if (isSelfContainedScenario(c)) {
      flush();
      scenarios.push({
        id: c.id,
        kind: c.kind || "measure",
        writes: c.writes,
        queries: c.queries,
        note: c.note || "",
      });
      continue;
    }
    if (c.role === "meta" || (c.kind && c.id && !c.role && !c.text && !c.query)) {
      flush();
      current = {
        id: c.id, kind: c.kind || "measure", writes: [], queries: [],
        note: c.note || "", extract_match: c.extract_match || null,
      };
      continue;
    }
    if (c.role === "write" || (c.text && (c.dup_group || Array.isArray(c.gold_facts)) && !c.query)) {
      if (!current) throw new Error(file + ": write line before a meta/id line");
      const w = (current.extract_match && !c.extract_match)
        ? Object.assign({}, c, { extract_match: current.extract_match })
        : c;
      current.writes.push(w);
      continue;
    }
    if (c.role === "query" || (c.query && (c.relevant_groups || c.relevant_ids || c.relevant_texts || c.relevant_writes || c.relevant_facts))) {
      if (!current) throw new Error(file + ": query line before a meta/id line");
      current.queries.push(c);
      continue;
    }
  }
  flush();
  return scenarios;
}

function loadAllScenarios(filter) {
  const out = [];
  for (const fn of fs.readdirSync(CORPORA).filter((f) => f.endsWith(".jsonl"))) {
    const file = path.join(CORPORA, fn);
    const lines = readJsonl(file);
    if (!lines.some(isMeasurementLine)) continue;
    const stem = fn.replace(/\.jsonl$/, "");
    // RM-15 soak is a timed event log with its own runner (eval/soak/run.js).
    // Playing it as write-then-query would drop clock / missed_dup / order.
    if (lines.some((c) => c && c.kind === "soak")) continue;
    for (const s of loadScenarios(file)) {
      // Exact stem match (so --corpus messy does not also pull messy-hard)
      // or scenario-id prefix.
      if (filter && stem !== filter && !String(s.id).startsWith(filter)) continue;
      out.push(Object.assign({ file: fn }, s));
    }
  }
  return out;
}

function freshStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rm-measure-"));
  const file = path.join(dir, "store.jsonl");
  return { store: new JsonlStore(file), file, dir };
}

const MISSING_RELEVANT = "__none__";

function liveRelevantId(id, records, allRecords) {
  const currentIds = new Set((records || []).map((r) => String(r.id)));
  const start = String(id);
  if (currentIds.has(start)) return start;
  // RM-01.b × RM-02.b: two gold facts can land in the mid merge band
  // after extraction (messy tea-preference vs tea+honey is 0.8831).
  // A merge is not a drop — the survivor still answers the query —
  // so follow superseded_by into current(). A hard drop (no survivor)
  // keeps the origin id and misses, matching 01.a's "dropped fact
  // must miss, not skip".
  const byId = new Map();
  for (const r of allRecords || []) byId.set(String(r.id), r);
  const seen = new Set();
  let cur = byId.get(start);
  while (cur && cur.superseded_by != null && !seen.has(String(cur.id))) {
    seen.add(String(cur.id));
    const nextId = String(cur.superseded_by);
    if (currentIds.has(nextId)) return nextId;
    cur = byId.get(nextId);
  }
  return start;
}

function resolveRelevant(q, records, groups, saveLog, allRecords, opts) {
  if (Array.isArray(q.relevant_ids) && q.relevant_ids.length) {
    return q.relevant_ids.map(String);
  }
  const labeledWrite = Array.isArray(q.relevant_writes) && q.relevant_writes.length;
  const labeledFact = Array.isArray(q.relevant_facts) && q.relevant_facts.length;
  if (labeledWrite || labeledFact) {
    const origin = [];
    if (labeledWrite) {
      const wanted = new Set(q.relevant_writes.map(String));
      for (const entry of saveLog || []) {
        if (!wanted.has(String(entry.id))) continue;
        for (const r of entry.stored || []) origin.push(r);
      }
    }
    if (labeledFact) {
      const facts = q.relevant_facts;
      const cover = !!(opts && opts.extractMatch === "cover");
      const hit = (text) => cover
        ? isCorrectStored(text, facts, [], "cover")
        : facts.some((g) => normFact(g) === normFact(text));
      const matched = [];
      for (const rec of records || []) {
        if (hit(rec.text)) matched.push(String(rec.id));
      }
      for (const r of origin) {
        if (hit(asStoredText(r))) {
          matched.push(liveRelevantId(r.id, records, allRecords));
        }
      }
      const uniq = [...new Set(matched)];
      if (uniq.length) return uniq;
      // Cover-match (messy-hard): a narrative blob must NOT count as the
      // atomic fact. Miss, don't fall back to the origin write — that's
      // the Tier-0 baseline the A/B is supposed to show as low.
      if (cover) return [MISSING_RELEVANT];
    }
    // Baseline fallback: the raw blob does not equal the gold fact, so
    // fact-match is empty. Attribute the origin write's stored records
    // so the query stays labeled (a dropped fact must miss, not skip).
    // Follow a later merge so RM-02 retiring the origin is not scored
    // as a drop when the survivor is still current.
    if (origin.length) {
      return origin.map((r) => liveRelevantId(r.id, records, allRecords));
    }
    return [MISSING_RELEVANT];
  }
  const wanted = new Set();
  if (Array.isArray(q.relevant_groups)) {
    for (const g of q.relevant_groups) {
      for (const t of groups[g] || []) wanted.add(t);
    }
  }
  if (Array.isArray(q.relevant_texts)) {
    for (const t of q.relevant_texts) wanted.add(t);
  }
  return records.filter((r) => wanted.has(r.text)).map((r) => String(r.id));
}

function asStoredText(r) {
  return typeof r === "string" ? r : (r && r.text != null ? String(r.text) : "");
}

async function pairwiseCosines(groups) {
  const out = {};
  for (const [gid, texts] of Object.entries(groups)) {
    const uniq = [...new Set(texts)];
    if (uniq.length < 2) continue;
    const vecs = await embed(uniq);
    const pairs = [];
    for (let i = 0; i < uniq.length; i++) {
      for (let j = i + 1; j < uniq.length; j++) {
        pairs.push({ a: uniq[i], b: uniq[j], cosine: cosine(vecs[i], vecs[j]) });
      }
    }
    out[gid] = pairs;
  }
  return out;
}

async function runScenario(scenario, opts) {
  const k = opts && opts.k != null ? Number(opts.k) : 5;
  const fieldEnabled = !!(opts && opts.fieldEnabled);
  const extractEnabled = !!(opts && opts.extractEnabled);
  const { store, file, dir } = freshStore();
  const mem = createMemory({
    store, embed, fieldEnabled, edgesPath: file + ".edges.json",
    extractEnabled,
    extractCapable: opts && opts.extractCapable,
    extract: opts && opts.extract,
    extractTimeoutMs: opts && opts.extractTimeoutMs,
  });

  const writes = (scenario.writes || []).map((w) => (typeof w === "string" ? { text: w } : w));
  const saveLog = [];
  const seenIds = new Set();
  for (const w of writes) {
    const msg = await mem.save(w.text);
    const after = store.current();
    const stored = after.filter((r) => !seenIds.has(String(r.id)))
      .map((r) => ({ id: r.id, text: r.text }));
    stored.forEach((r) => seenIds.add(String(r.id)));
    saveLog.push({
      id: w.id || null,
      text: w.text,
      gold_facts: Array.isArray(w.gold_facts) ? w.gold_facts : null,
      noise: Array.isArray(w.noise) ? w.noise : null,
      expect_refusal: !!w.expect_refusal,
      dup_group: w.dup_group || null,
      band: w.band || null,
      msg,
      refused: isSaveRefusal(msg),
      stored,
    });
  }

  const records = store.current();
  const allRecords = typeof store.all === "function" ? store.all() : records;
  const groups = groupsFromWrites(writes);
  const dupExplain = explainMetric("duplicate_rate", { records }, { groups });
  const extractExplain = explainMetric("extraction_precision", { cases: saveLog }, { cases: writes });
  const extractRecallExplain = explainMetric("extraction_recall", { cases: saveLog }, { cases: writes });

  const queries = [];
  for (const q of scenario.queries || []) {
    const output = await mem.recall(q.query, k);
    const ranked = parsePrimaryHits(output);
    queries.push({
      id: q.id || q.query,
      query: q.query,
      ranked_ids: ranked.map((h) => String(h.id)),
      ranked_texts: ranked.map((h) => h.text),
      relevant_ids: resolveRelevant(q, records, groups, saveLog, allRecords, {
        extractMatch: scenario.extract_match,
      }),
      relevant_groups: q.relevant_groups || null,
      relevant_writes: q.relevant_writes || null,
      relevant_facts: q.relevant_facts || null,
      output,
    });
  }
  const recallExplain = explainMetric("recall_at_k", { queries }, scenario, { k });
  const mrrExplain = explainMetric("mrr", { queries }, scenario);

  const exactCaught = saveLog.filter((s) => /already remembered/i.test(s.msg || "")).length;

  let bands = null;
  if (opts && opts.bands) bands = await pairwiseCosines(groups);

  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ }

  const metrics = {
    duplicate_rate: dupExplain.rate,
    recall_at_k: recallExplain.rate,
    mrr: mrrExplain.mrr,
  };
  if (extractExplain.n_labeled) {
    metrics.extraction_precision = extractExplain.rate;
    metrics.extraction_recall = extractRecallExplain.rate;
  }

  return {
    id: scenario.id,
    file: scenario.file || null,
    k, field: fieldEnabled,
    n_writes: writes.length,
    n_stored_current: records.length,
    n_groups: Object.keys(groups).length,
    exact_restatements_caught: exactCaught,
    metrics,
    duplicate_rate: dupExplain,
    recall_at_k: recallExplain,
    mrr: mrrExplain,
    extraction_precision: extractExplain.n_labeled ? extractExplain : null,
    extraction_recall: extractExplain.n_labeled ? extractRecallExplain : null,
    queries,
    saveLog,
    groups,
    bands,
  };
}

function printHuman(reports, { k }) {
  const line = "-".repeat(72);
  console.log("\nRM-00 reporting metrics  " + new Date().toISOString());
  console.log("(A/B numbers, not the golden gate. Reproduce: node eval/measure.js)");
  console.log(line);
  console.log("registered: " + listMetrics().map((m) => m.name).join(", "));

  for (const r of reports) {
    console.log("\n" + (r.id || "(unnamed)") + (r.file ? "  [" + r.file + "]" : ""));
    console.log("  writes=" + r.n_writes + "  stored_current=" + r.n_stored_current +
      "  groups=" + r.n_groups + "  exact_restatements_caught=" + r.exact_restatements_caught);
    console.log("  duplicate_rate  " + r.metrics.duplicate_rate.toFixed(4) +
      "   (extras=" + r.duplicate_rate.extras + "/" + r.duplicate_rate.n +
      ", G*=" + r.duplicate_rate.gStar + ")");
    console.log("  recall@" + k + "         " + r.metrics.recall_at_k.toFixed(4) +
      "   (" + r.recall_at_k.hits + "/" + r.recall_at_k.n + " queries hit)");
    if (r.recall_at_k.misses && r.recall_at_k.misses.length) {
      console.log("    misses: " + r.recall_at_k.misses.join(", "));
    }
    const meanR = r.mrr && r.mrr.mean_rank != null ? r.mrr.mean_rank.toFixed(2) : "n/a";
    const medR = r.mrr && r.mrr.median_rank != null ? String(r.mrr.median_rank) : "n/a";
    console.log("  mrr              " + r.metrics.mrr.toFixed(4) +
      "   (mean rank " + meanR + ", median " + medR +
      ", missed=" + (r.mrr ? r.mrr.n_missed : "?") + ")");
    if (r.extraction_precision) {
      const e = r.extraction_precision;
      console.log("  extraction_precision " + e.rate.toFixed(4) +
        "   (correct=" + e.n_correct + "/" + e.n_stored + " stored, labeled=" + e.n_labeled + ")");
      if (r.extraction_recall) {
        const rec = r.extraction_recall;
        console.log("  extraction_recall    " + rec.rate.toFixed(4) +
          "   (hit=" + rec.n_hit + "/" + rec.n_gold + " gold facts)");
      }
      console.log("  pii_refusal_rate     " + e.pii_refusal_rate.toFixed(4) +
        "   (" + e.n_pii_refused + "/" + e.n_pii + " PII writes refused)");
    }
    if (r.bands) {
      console.log("  pairwise cosine (multi-member groups):");
      for (const [gid, pairs] of Object.entries(r.bands)) {
        for (const p of pairs) {
          const tag = p.cosine >= 0.95 ? "hi " : p.cosine >= 0.88 ? "mid" : "low";
          console.log("    " + gid.padEnd(16) + " " + p.cosine.toFixed(4) + " " + tag);
        }
      }
    }
  }
  console.log("\n" + line + "\n");
}

async function main(argv) {
  const args = argv || process.argv.slice(2);
  const json = args.includes("--json");
  const bands = args.includes("--bands");
  const fieldEnabled = args.includes("--field");
  const wantExtract = args.includes("--extract");
  const ci = args.indexOf("--corpus");
  const filter = ci >= 0 ? args[ci + 1] : null;
  const ki = args.indexOf("--k");
  const k = ki >= 0 ? Number(args[ki + 1]) : 5;
  const mi = args.indexOf("--extract-model");
  const extractModelArg = mi >= 0 ? args[mi + 1] : process.env.RESONANCE_EXTRACT_MODEL;
  const ti = args.indexOf("--extract-timeout");
  const extractTimeoutMs = ti >= 0 ? Number(args[ti + 1]) : 45000;

  let extractFn = null;
  let extractEnabled = false;
  if (wantExtract) {
    const probe = await extract.probeChatCapability({
      preferred: extractModelArg,
    });
    const model = extractModelArg || probe.model;
    if (!model) {
      console.error("Tier 2 --extract: no chat-capable model at " + extract.modelsUrl() + ".");
      process.exit(2);
    }
    extractFn = extract.makeChatExtractor({
      endpoint: extract.chatCompletionsUrl(),
      model,
      timeoutMs: extractTimeoutMs,
    });
    extractEnabled = true;
    if (!json) {
      console.error("Tier 2 live extract: model=" + model +
        " temperature=0 timeout_ms=" + extractTimeoutMs);
    }
  }

  const scenarios = loadAllScenarios(filter);
  if (!scenarios.length) {
    console.error("No measurement scenarios" + (filter ? " matching --corpus " + filter : "") + ".");
    process.exit(2);
  }
  const reports = [];
  for (const s of scenarios) {
    reports.push(await runScenario(s, {
      k, fieldEnabled, bands,
      extractEnabled, extract: extractFn, extractTimeoutMs,
    }));
  }

  if (json) {
    console.log(JSON.stringify({
      generated: new Date().toISOString(),
      k, field: fieldEnabled,
      metrics: listMetrics().map((m) => ({ name: m.name, description: m.description })),
      scenarios: reports.map((r) => ({
        id: r.id,
        n_writes: r.n_writes,
        n_stored_current: r.n_stored_current,
        n_groups: r.n_groups,
        exact_restatements_caught: r.exact_restatements_caught,
        metrics: r.metrics,
        duplicate_rate: r.duplicate_rate,
        recall_at_k: r.recall_at_k,
        mrr: r.mrr,
        extraction_precision: r.extraction_precision,
        extraction_recall: r.extraction_recall,
        bands: r.bands,
        misses: r.recall_at_k.misses,
      })),
    }, null, 2));
  } else {
    printHuman(reports, { k });
  }
}

if (require.main === module) {
  main().catch((e) => { console.error(String(e.message || e)); process.exit(2); });
}

module.exports = {
  loadScenarios, loadAllScenarios, runScenario, resolveRelevant, isMeasurementLine,
};
