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
 * eval/soak/run.js — RM-15 control harness (0011 §7.3).
 *
 * Measurement infrastructure only. No dream mutation, no Op A/B/C/D, no
 * --dreamer, no crystal, no Grimoire write. Plays the persona soak with
 * field-on accrual (both arms will, so we do not accidentally measure
 * field-on-vs-off — RM-00 already does that) and emits the CONTROL CURVE
 * at checkpoints 100 / 250 / 500 / 1000.
 *
 *   node eval/soak/run.js                  # control arm, committed corpus
 *   node eval/soak/run.js --arm control
 *   node eval/soak/run.js --arm redundancy     # errors: not until slice 4.x
 *   node eval/soak/run.js --arm grimoire-walk  # errors: not until slice 4.1b
 *   node eval/soak/run.js --json
 *   node eval/soak/run.js --n 100          # prefix of the committed log
 *   node eval/soak/run.js --store jsonl
 *   node eval/soak/run.js --write-corpus   # regenerate eval/corpora/soak-rm15.jsonl
 *
 * Offline + deterministic: vectors from eval/embed-cache.js. EVAL_REFRESH=1
 * to grow the cache against a live embedder, same ritual as RM-00.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const { openStore } = require("../../store.js");
const { isCurrent, hasVector } = require("../../record.js");
const { createMemory } = require("../pipeline.js");
const { embed } = require("../embed-cache.js");
const {
  explainMetric, parsePrimaryHits, groupsFromWrites,
} = require("../metrics.js");
const {
  DEFAULT_SEED, DEFAULT_N, CHECKPOINTS, SLOT_ORDER, SLOT_QUERY,
  generateSoakCorpus, eventsToJsonl, collectTexts, loadEventsFromJsonl,
} = require("./generate.js");

const CORPORA = path.join(__dirname, "..", "corpora");
const CORPUS_PATH = path.join(CORPORA, "soak-rm15.jsonl");
const LAST_RUN = path.join(__dirname, "last-run.json");

const ARMS = {
  control: { implemented: true, dream: false },
  redundancy: { implemented: false, slice: "4.0 vehicle / Op A" },
  nominate: { implemented: false, slice: "4.1 / Op B" },
  crystal: { implemented: false, slice: "4.2 / Op C" },
  "grimoire-walk": { implemented: false, slice: "4.1b / Op D" },
};

const UNIMPLEMENTED_MSG = (arm) =>
  "arm '" + arm + "' is scaffolded; dream steps are not implemented until slice " +
  ARMS[arm].slice + " (0011 §8). 4.0 is the control harness only.";

function parseArm(argv) {
  const eq = argv.find((a) => a.startsWith("--arm="));
  let raw = "control";
  if (eq) raw = eq.slice("--arm=".length);
  else {
    const i = argv.indexOf("--arm");
    if (i >= 0) raw = argv[i + 1];
  }
  const arm = String(raw || "control");
  if (!ARMS[arm]) {
    throw new Error("unknown --arm " + JSON.stringify(arm) +
      " (control|redundancy|nominate|crystal|grimoire-walk)");
  }
  return arm;
}

function parseStoreKind(argv) {
  const eq = argv.find((a) => a.startsWith("--store="));
  let raw = null;
  if (eq) raw = eq.slice("--store=".length);
  else {
    const i = argv.indexOf("--store");
    if (i >= 0) raw = argv[i + 1];
  }
  if (raw == null) return "sqlite";
  const v = String(raw).toLowerCase();
  if (v !== "jsonl" && v !== "sqlite") {
    throw new Error("unknown --store " + JSON.stringify(raw) + " (jsonl|sqlite)");
  }
  return v;
}

function fmt4(x) {
  if (x == null || Number.isNaN(x)) return "n/a";
  return Number(x).toFixed(4);
}

function closeStore(store) {
  if (store && typeof store.close === "function") {
    try { store.close(); } catch { /* temp */ }
  }
}

/*
 * Fake Date so save()/nextId()/EdgeStore isoNow follow the event log's
 * timestamps. Decay and the 48h span gate are then real without injecting
 * a clock into memory-core.js (product path stays closed).
 */
function installFakeDate(clock) {
  const RealDate = Date;
  function FakeDate(...args) {
    if (!new.target) return RealDate(clock.ms);
    if (args.length === 0) return new RealDate(clock.ms);
    return new RealDate(...args);
  }
  FakeDate.now = () => clock.ms;
  FakeDate.parse = RealDate.parse.bind(RealDate);
  FakeDate.UTC = RealDate.UTC.bind(RealDate);
  Object.setPrototypeOf(FakeDate, RealDate);
  FakeDate.prototype = RealDate.prototype;
  global.Date = FakeDate;
  return function restore() { global.Date = RealDate; };
}

function makeClock(startMs) {
  const clock = { ms: startMs };
  return clock;
}

async function freshStore(storeKind) {
  const kind = storeKind === "jsonl" ? "jsonl" : "sqlite";
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rm-soak-"));
  const jsonlFile = path.join(dir, "store.jsonl");
  const store = await openStore(jsonlFile, { backend: kind });
  return { store, file: store.file || jsonlFile, dir, storeKind: kind };
}

function loadCommittedCorpus() {
  if (!fs.existsSync(CORPUS_PATH)) {
    throw new Error("missing " + CORPUS_PATH + " — run node eval/soak/generate.js --out " + CORPUS_PATH);
  }
  const raw = fs.readFileSync(CORPUS_PATH, "utf8").split("\n").filter(Boolean);
  const { meta, events } = loadEventsFromJsonl(raw);
  return { meta, events };
}

function groupsFromEvents(events) {
  const writes = [];
  for (const e of events) {
    if (e.event === "missed_dup" && Array.isArray(e.texts)) {
      for (const t of e.texts) writes.push({ text: t, dup_group: e.dup_group });
    } else if (e.event === "near_miss" && Array.isArray(e.texts)) {
      e.texts.forEach((t, i) => writes.push({
        text: t,
        dup_group: (e.dup_group || "nm") + (i ? "-b" : ""),
      }));
    } else if (e.role === "write" && e.text && e.dup_group) {
      writes.push({ text: e.text, dup_group: e.dup_group });
    }
  }
  return groupsFromWrites(writes);
}

async function saveTracked(mem, store, text, writeId, writeToId) {
  const before = new Set((typeof store.all === "function" ? store.all() : store.current())
    .map((r) => String(r.id)));
  const msg = await mem.save(text);
  const after = typeof store.all === "function" ? store.all() : store.current();
  const added = after.filter((r) => !before.has(String(r.id)));
  if (writeId) {
    if (added.length) writeToId.set(writeId, String(added[0].id));
    else {
      const hit = after.find((r) => r.text === text);
      if (hit) writeToId.set(writeId, String(hit.id));
    }
  }
  return { msg, added };
}

async function backfillVectorless(store, embedFn) {
  const recs = (typeof store.all === "function" ? store.all() : store.current())
    .filter((r) => !hasVector(r));
  if (!recs.length) return 0;
  const vecs = await embedFn(recs.map((r) => r.text));
  const map = new Map();
  recs.forEach((r, i) => map.set(String(r.id), vecs[i]));
  store.applyRecall([], map);
  return recs.length;
}

function slotSnapshot(played) {
  const slots = {};
  for (const e of played) {
    if ((e.event === "assert" || e.event === "correct") && e.slot && e.slot !== "name") {
      slots[e.slot] = e;
    }
  }
  return slots;
}

async function probeCheckpoint(mem, store, played, writeToId, k) {
  const slots = slotSnapshot(played);
  const slotProbes = [];
  for (const slot of SLOT_ORDER) {
    const cur = slots[slot];
    if (!cur) continue;
    const output = await mem.recall(SLOT_QUERY[slot], k);
    const hits = parsePrimaryHits(output);
    const rid = cur.write_id && writeToId.get(cur.write_id);
    slotProbes.push({
      id: "probe-slot-" + slot,
      slot,
      query: SLOT_QUERY[slot],
      query_kind: "slot",
      ranked_ids: hits.map((h) => String(h.id)),
      ranked_texts: hits.map((h) => h.text),
      current_value: cur.value,
      relevant_ids: rid ? [rid] : [],
      current_write_id: cur.write_id,
    });
  }

  const needleQueries = [];
  for (const e of played) {
    if (e.event !== "episodic") continue;
    const output = await mem.recall(e.query, k);
    const hits = parsePrimaryHits(output);
    const rid = e.write_id && writeToId.get(e.write_id);
    needleQueries.push({
      id: "probe-ep-" + e.token,
      query: e.query,
      query_kind: "episodic",
      needle: true,
      token: e.token,
      ranked_ids: hits.map((h) => String(h.id)),
      ranked_texts: hits.map((h) => h.text),
      relevant_ids: rid ? [rid] : [],
    });
  }

  const recallQueries = [];
  for (const e of played) {
    if (e.role !== "query" || !e.ranked_ids) continue;
    const relevant = [];
    if (Array.isArray(e.relevant_writes)) {
      for (const w of e.relevant_writes) {
        const id = writeToId.get(w);
        if (id) relevant.push(id);
      }
    }
    recallQueries.push({
      id: e.id,
      query: e.query,
      query_kind: e.query_kind,
      ranked_ids: e.ranked_ids,
      relevant_ids: relevant,
      needle: !!e.needle,
    });
  }

  const records = store.current();
  const allRecords = typeof store.all === "function" ? store.all() : records;
  const nWrites = played.filter((e) => e.role === "write").length;
  const nAsserts = nWrites;
  const groups = groupsFromEvents(played);

  const writeToObj = {};
  for (const [k2, v] of writeToId) writeToObj[k2] = v;

  const metricInput = {
    records,
    all_records: allRecords,
    n_current: records.length,
    n_writes: nWrites,
    n_asserts: nAsserts,
    slot_probes: slotProbes,
    needle_queries: needleQueries,
    queries: recallQueries.concat(slotProbes, needleQueries),
    write_to_id: writeToObj,
  };
  const corpus = { groups, n_writes: nWrites, n_asserts: nAsserts };

  const stale = explainMetric("staleness_rate", metricInput, corpus, { k });
  const needles = explainMetric("needle_retention@k", {
    queries: needleQueries, needle_queries: needleQueries,
  }, corpus, { k });
  const dup = explainMetric("duplicate_rate", { records }, { groups });
  const storage = explainMetric("storage_ratio", metricInput, corpus);
  const falseMerge = explainMetric("false_merge_rate", {
    records: allRecords,
    write_to_id: writeToObj,
  }, { must_not_merge: (played._must_not_merge) || [] });
  const recall = explainMetric("recall_at_k", { queries: metricInput.queries }, corpus, { k });
  const mrr = explainMetric("mrr", { queries: metricInput.queries }, corpus);

  const scaffolded = {};
  for (const name of [
    "gist_recall@k", "false_generalization_rate", "cluster_precision", "cluster_recall",
    "hub_contamination", "provenance_integrity", "grimoire_hit_rate", "grimoire_crowding",
    "cofire_rate", "near_miss_cofire",
  ]) {
    scaffolded[name] = explainMetric(name, metricInput, corpus);
  }

  return {
    n_events: played.length,
    n_current: records.length,
    n_writes: nWrites,
    n_active: allRecords.filter((r) => !r.deleted).length,
    metrics: {
      staleness_rate: stale.rate,
      duplicate_rate: dup.rate,
      needle_retention: needles.rate,
      storage_ratio: storage.rate,
      false_merge_rate: falseMerge.rate,
      recall_at_k: recall.rate,
      mrr: mrr.mrr,
    },
    explain: {
      staleness_rate: stale,
      duplicate_rate: dup,
      needle_retention: needles,
      storage_ratio: storage,
      false_merge_rate: falseMerge,
      recall_at_k: recall,
      mrr,
    },
    scaffolded: Object.fromEntries(Object.entries(scaffolded).map(([n, s]) => [n, s.rate == null ? null : s.rate])),
  };
}

async function playSoak(opts) {
  const k = opts.k != null ? Number(opts.k) : 5;
  const fieldEnabled = opts.fieldEnabled !== false; // 0011: both arms field-on for accrual
  const storeKind = opts.storeKind || "sqlite";
  const events = opts.events;
  const mustNotMerge = (opts.meta && opts.meta.must_not_merge) || [];
  const checkpoints = (opts.checkpoints || CHECKPOINTS).filter((c) => c <= events.length);

  const { store, file, dir } = await freshStore(storeKind);
  let vectorless = false;
  const baseEmbed = opts.embed || embed;
  const embedFn = async (texts) => {
    if (vectorless) throw new Error("vectorless (missed_dup)");
    return baseEmbed(texts);
  };

  const clock = makeClock(events.length && events[0].t ? Date.parse(events[0].t) : Date.parse("2026-01-05T20:00:00.000Z"));
  const restoreDate = installFakeDate(clock);
  const writeToId = new Map();
  const played = [];
  played._must_not_merge = mustNotMerge;
  const curve = [];
  let dreamsSkipped = 0;

  const mem = createMemory({
    store, embed: embedFn, fieldEnabled, edgesPath: file + ".edges.json",
  });

  try {
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (e.t) clock.ms = Date.parse(e.t);
      else clock.ms += 1;

      if (e.event === "dream") {
        dreamsSkipped++;
        played.push(e);
      } else if (e.event === "time_skip") {
        played.push(e);
      } else if (e.event === "missed_dup") {
        const texts = Array.isArray(e.texts) && e.texts.length ? e.texts : [e.text];
        vectorless = true;
        try {
          for (let t = 0; t < texts.length; t++) {
            const wid = t === 0 ? e.write_id : (e.write_id ? e.write_id + "-b" : null);
            await saveTracked(mem, store, texts[t], wid, writeToId);
            clock.ms += 1;
          }
        } finally {
          vectorless = false;
        }
        await backfillVectorless(store, baseEmbed);
        played.push(e);
      } else if (e.event === "near_miss" && Array.isArray(e.texts) && e.texts.length >= 2) {
        await saveTracked(mem, store, e.texts[0], e.write_id, writeToId);
        clock.ms += 1;
        await saveTracked(mem, store, e.texts[1], e.write_id_b, writeToId);
        played.push(e);
      } else if (e.role === "write") {
        await saveTracked(mem, store, e.text, e.write_id, writeToId);
        played.push(e);
      } else if (e.role === "query") {
        const output = await mem.recall(e.query, k);
        const hits = parsePrimaryHits(output);
        e.ranked_ids = hits.map((h) => String(h.id));
        e.ranked_texts = hits.map((h) => h.text);
        played.push(e);
      } else {
        played.push(e);
      }

      const n = played.length;
      if (checkpoints.includes(n)) {
        const row = await probeCheckpoint(mem, store, played, writeToId, k);
        row.checkpoint = n;
        row.t = e.t || null;
        curve.push(row);
        if (opts.onCheckpoint) opts.onCheckpoint(row);
      }
    }

    if (!curve.length && events.length) {
      const row = await probeCheckpoint(mem, store, played, writeToId, k);
      row.checkpoint = played.length;
      curve.push(row);
    }

    return {
      arm: opts.arm || "control",
      field: fieldEnabled,
      store: storeKind,
      k,
      n_events: events.length,
      dreams_skipped: dreamsSkipped,
      curve,
      n_current: store.current().length,
    };
  } finally {
    restoreDate();
    closeStore(store);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ }
  }
}

function printCurve(report) {
  const line = "-".repeat(78);
  console.log("\nRM-15 control curve  " + new Date().toISOString());
  console.log("arm=" + report.arm + "  field=" + report.field + "  store=" + report.store +
    "  k=" + report.k + "  events=" + report.n_events +
    "  dreams_skipped=" + report.dreams_skipped);
  console.log("(A/B numbers, not the golden gate. Reproduce: node eval/soak/run.js)");
  console.log(line);
  console.log("| ckpt | n_current | n_writes | staleness | dup_rate | needle@k | storage | false_merge |");
  console.log("|------|-----------|----------|-----------|----------|----------|---------|-------------|");
  for (const r of report.curve) {
    const m = r.metrics;
    console.log("| " + String(r.checkpoint).padStart(4) +
      " | " + String(r.n_current).padStart(9) +
      " | " + String(r.n_writes).padStart(8) +
      " | " + fmt4(m.staleness_rate).padStart(9) +
      " | " + fmt4(m.duplicate_rate).padStart(8) +
      " | " + fmt4(m.needle_retention).padStart(8) +
      " | " + fmt4(m.storage_ratio).padStart(7) +
      " | " + fmt4(m.false_merge_rate).padStart(11) + " |");
  }
  console.log(line);
  if (report.curve.length) {
    const last = report.curve[report.curve.length - 1];
    console.log("scaffolded (NA in control): " +
      Object.entries(last.scaffolded).map(([n, v]) => n + "=" + (v == null ? "n/a" : fmt4(v))).join("  "));
  }
  console.log("");
}

async function main(argv) {
  argv = argv || process.argv.slice(2);
  const arm = parseArm(argv);
  if (!ARMS[arm].implemented) {
    console.error(UNIMPLEMENTED_MSG(arm));
    return 2;
  }
  const storeKind = parseStoreKind(argv);
  const json = argv.includes("--json");
  const writeCorpus = argv.includes("--write-corpus");
  const ni = argv.indexOf("--n");
  const n = ni >= 0 ? Number(argv[ni + 1]) : DEFAULT_N;
  const ki = argv.indexOf("--k");
  const k = ki >= 0 ? Number(argv[ki + 1]) : 5;

  if (writeCorpus) {
    const corpus = generateSoakCorpus({ n: DEFAULT_N, seed: DEFAULT_SEED });
    fs.writeFileSync(CORPUS_PATH, eventsToJsonl(corpus));
    console.error("wrote " + CORPUS_PATH + "  events=" + corpus.events.length +
      "  writes=" + corpus.n_writes);
  }

  if (argv.includes("--embed-only")) {
    const corpus = generateSoakCorpus({ n: DEFAULT_N, seed: DEFAULT_SEED });
    const texts = collectTexts(corpus);
    const BATCH = 32;
    let done = 0;
    for (let i = 0; i < texts.length; i += BATCH) {
      await embed(texts.slice(i, i + BATCH));
      done = Math.min(i + BATCH, texts.length);
      process.stderr.write("  embed " + done + "/" + texts.length + "\n");
    }
    console.error("embed-only: cached " + texts.length + " unique texts");
    return 0;
  }

  const committed = loadCommittedCorpus();
  const generated = generateSoakCorpus({ n: DEFAULT_N, seed: committed.meta.seed != null ? committed.meta.seed : DEFAULT_SEED });
  if (committed.events.length !== generated.events.length) {
    console.error("WARN: committed corpus n=" + committed.events.length +
      " != generator n=" + generated.events.length + " (regenerate with --write-corpus)");
  } else {
    const a = committed.events.map((e) => e.event + "\t" + (e.text || e.query || ""));
    const b = generated.events.map((e) => e.event + "\t" + (e.text || e.query || ""));
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      console.error("WARN: committed corpus drifted from generateSoakCorpus(DEFAULT_SEED). Re-run --write-corpus.");
    }
  }

  const events = committed.events.slice(0, n);
  if (!json) {
    console.log("RM-15 soak  seed=" + (committed.meta.seed || DEFAULT_SEED) +
      "  n=" + events.length + "  arm=" + arm + "  store=" + storeKind);
    const texts = collectTexts({ events });
    console.log("unique texts (writes+queries)=" + texts.length);
  }

  const report = await playSoak({
    arm, events, meta: committed.meta, storeKind, k,
    checkpoints: CHECKPOINTS,
    onCheckpoint: json ? null : (row) => {
      process.stdout.write("  checkpoint " + row.checkpoint +
        "  current=" + row.n_current +
        "  staleness=" + fmt4(row.metrics.staleness_rate) +
        "  dup=" + fmt4(row.metrics.duplicate_rate) +
        "  needle=" + fmt4(row.metrics.needle_retention) +
        "  storage=" + fmt4(row.metrics.storage_ratio) + "\n");
    },
  });

  const slimCurve = (report.curve || []).map((row) => ({
    checkpoint: row.checkpoint,
    t: row.t,
    n_current: row.n_current,
    n_writes: row.n_writes,
    n_active: row.n_active,
    metrics: row.metrics,
    staleness_misses: row.explain && row.explain.staleness_rate && row.explain.staleness_rate.misses,
    duplicate_extras: row.explain && row.explain.duplicate_rate && row.explain.duplicate_rate.extras,
    needle_misses: row.explain && row.explain.needle_retention && row.explain.needle_retention.misses,
    false_merge_pairs: row.explain && row.explain.false_merge_rate && row.explain.false_merge_rate.false_pairs,
    scaffolded: row.scaffolded,
  }));
  fs.writeFileSync(LAST_RUN, JSON.stringify({
    generated: new Date().toISOString(),
    seed: committed.meta.seed || DEFAULT_SEED,
    arm: report.arm,
    field: report.field,
    store: report.store,
    k: report.k,
    n_events: report.n_events,
    dreams_skipped: report.dreams_skipped,
    n_current: report.n_current,
    curve: slimCurve,
  }, null, 2));

  if (json) {
    console.log(JSON.stringify({
      generated: new Date().toISOString(),
      seed: committed.meta.seed || DEFAULT_SEED,
      ...report,
    }, null, 2));
  } else {
    printCurve(report);
    console.log("wrote " + LAST_RUN);
  }
  return 0;
}

module.exports = {
  ARMS, UNIMPLEMENTED_MSG, parseArm, playSoak, loadCommittedCorpus,
  CORPUS_PATH, LAST_RUN, installFakeDate, makeClock,
};

if (require.main === module) {
  main().then((code) => process.exit(code)).catch((e) => {
    console.error(String(e && e.stack || e));
    process.exit(2);
  });
}
