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
 * eval/run.js - the RM-00 harness runner.
 *
 *   npm run eval                 run all corpora, print scorecard, check regressions
 *   npm run eval -- --accept     write the current scorecard as golden.json (the gate)
 *   npm run eval -- --filter X   run only cases whose id starts with X
 *   npm run eval -- --store jsonl
 *                                RM-07 slice 4: JSONL path (still testable).
 *                                Default (no flag) is sqlite. Both must match
 *                                golden 27/31 case-for-case. --store wins over
 *                                RESONANCE_STORE. --accept is jsonl-only.
 *
 * Reporting metrics (recall@k, duplicate_rate, …) are eval/measure.js, not
 * this file. Measurement corpora (kind: "duplicates" / "messy" / gate: false / no
 * expect, including messy-hard) are skipped here so they cannot flip golden.json.
 *
 * Constraint cases run BOTH field:false and field:true; the gap between them is
 * the associative field's measured value - the number this project most needs and
 * has never had. Repeated cases keep ONE store across turns so the Hebbian loop
 * can strengthen edges; first_hit_turn is reported so "missed at turn 1, landed by
 * turn 4" reads as the success it is.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { openStore } = require("../store.js");
const { createMemory } = require("./pipeline.js");
const { embed } = require("./embed-cache.js");
const { scoreSingle, scoreRepeat, fieldSignals } = require("./metrics.js");

const CORPORA = path.join(__dirname, "corpora");
const GOLDEN = path.join(__dirname, "golden.json");

function readJsonl(file) {
  return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

/*
 * Backend for this eval process. `--store jsonl|sqlite` (or `--store=`) wins
 * over RESONANCE_STORE. Slice 4: the product default is sqlite, so a bare
 * `node eval/run.js` is the sqlite parity run. `--store jsonl` keeps the
 * JSONL path testable. The golden lock remains the JSONL scorecard;
 * sqlite is two-sided parity (any flip is a STOP). Unknown values fail
 * loud — a typo must not silently pick a backend and green-wash the
 * drop-in contract.
 */
function parseStoreKind(argv, env) {
  const args = argv || [];
  const eq = args.find((a) => a.startsWith("--store="));
  let raw = null;
  if (eq) raw = eq.slice("--store=".length);
  else {
    const i = args.indexOf("--store");
    if (i >= 0) raw = args[i + 1];
  }
  if (raw != null) {
    const v = String(raw).toLowerCase();
    if (v !== "jsonl" && v !== "sqlite") {
      throw new Error("unknown --store " + JSON.stringify(raw) + " (jsonl|sqlite)");
    }
    return v;
  }
  const envRaw = String((env || process.env).RESONANCE_STORE || "").toLowerCase();
  if (envRaw === "jsonl") return "jsonl";
  return "sqlite";
}

async function freshStore(storeKind) {
  const kind = storeKind === "jsonl" ? "jsonl" : "sqlite";
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rm-eval-"));
  // openStore is the product construction path (same seam server.js uses).
  // Explicit backend: a fresh temp has neither file, so sqlite creates a
  // .db and jsonl stays JsonlStore. No auto-migrate in the eval loop.
  const jsonlFile = path.join(dir, "store.jsonl");
  const store = await openStore(jsonlFile, { backend: kind });
  return { store, file: store.file, dir, storeKind: kind };
}

function closeStore(store) {
  if (store && typeof store.close === "function") {
    try { store.close(); } catch { /* temp */ }
  }
}

async function runCase(c, fieldOn, storeKind) {
  const { store, file, dir } = await freshStore(storeKind);
  const mem = createMemory({ store, embed, fieldEnabled: fieldOn, edgesPath: file + ".edges.json" });
  try {
    for (const w of c.writes || []) await mem.save(w);
    const turns = c.repeat || [{ query: c.query }];
    const outputs = [];
    for (const t of turns) outputs.push(await mem.recall(t.query));
    const scored = c.repeat ? scoreRepeat(c, outputs) : scoreSingle(c, outputs[0]);
    const sig = fieldSignals(c, outputs[outputs.length - 1]);
    return {
      id: c.id, kind: c.kind, field: fieldOn, metric: c.metric || null,
      pass: scored.pass, reasons: scored.reasons,
      byTurn: scored.byTurn, first_hit_turn: scored.first_hit_turn,
      rescued: sig.rescued, bled: sig.bled, appended: sig.appended,
    };
  } finally {
    // Windows will not rmSync a directory that still has the .db open.
    closeStore(store);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ }
  }
}

// Golden cases are the RM-00 contains/excludes scorecard. Measurement
// corpora (RM-02 duplicates, RM-01 messy, later temporal) live in the same
// directory but are scored by eval/measure.js — they have no `expect`,
// and a write-object line would crash save(w) (objects have no .trim).
function isGoldenCase(c) {
  if (!c || c.gate === false) return false;
  if (c.kind === "duplicates" || c.kind === "messy" || c.kind === "measure") return false;
  return !!(c.expect && (c.query || c.repeat));
}

async function run({ filter = null, storeKind = "sqlite" } = {}) {
  const kind = storeKind === "jsonl" ? "jsonl" : "sqlite";
  const results = [];
  for (const fileName of fs.readdirSync(CORPORA).filter((f) => f.endsWith(".jsonl"))) {
    for (const c of readJsonl(path.join(CORPORA, fileName))) {
      if (!isGoldenCase(c)) continue;
      if (filter && !c.id.startsWith(filter)) continue;
      const modes = c.kind === "constraint" ? [false, true] : [c.field ?? false];
      for (const fieldOn of modes) results.push(await runCase(c, fieldOn, kind));
    }
  }
  return results;
}

const key = (r) => r.id + (r.kind === "constraint" ? (r.field ? " [field:on]" : " [field:off]") : "");

function scorecard(results, { storeKind = "sqlite" } = {}) {
  const line = "-".repeat(72);
  console.log("\nRM-00 eval scorecard  " + new Date().toISOString() + "  store=" + storeKind);
  console.log(line);

  // Per-case, grouped by kind
  const byKind = {};
  for (const r of results) (byKind[r.kind] ||= []).push(r);
  for (const kind of Object.keys(byKind)) {
    console.log("\n" + kind.toUpperCase());
    for (const r of byKind[kind]) {
      const tag = r.pass ? "PASS" : "FAIL";
      let extra = "";
      if (r.byTurn) extra += "  turns=[" + r.byTurn.map((b) => (b ? "1" : "0")).join(",") + "] first_hit=" + (r.first_hit_turn ?? "-");
      if (!r.pass && r.reasons.length) extra += "  (" + r.reasons.join("; ") + ")";
      console.log("  " + tag + "  " + key(r) + extra);
    }
  }

  // The headline: field off vs on, for constraint cases
  const constraints = results.filter((r) => r.kind === "constraint");
  if (constraints.length) {
    console.log("\n" + line);
    console.log("ASSOCIATIVE FIELD - measured value (constraint cases: off vs on)");
    const ids = [...new Set(constraints.map((r) => r.id))];
    let liftedToPass = 0, brokenByField = 0;
    for (const id of ids) {
      const off = constraints.find((r) => r.id === id && r.field === false);
      const on = constraints.find((r) => r.id === id && r.field === true);
      const o = off ? (off.pass ? "PASS" : "fail") : " - ";
      const n = on ? (on.pass ? "PASS" : "fail") : " - ";
      let mark = "";
      if (off && on && !off.pass && on.pass) { mark = "  <== field earned it"; liftedToPass++; }
      if (off && on && off.pass && !on.pass) { mark = "  <== field BROKE it"; brokenByField++; }
      console.log("  " + id.padEnd(24) + " off=" + o + "  on=" + n + mark);
    }
    console.log("  " + line.slice(0, 60));
    console.log("  field lifted " + liftedToPass + " case(s) fail->pass" +
      (brokenByField ? ", and BROKE " + brokenByField + " (regression!)" : ""));
  }

  // ROC / TBR split (RM-00 field metric): a forgotten constraint and a hallucinated
  // tangent are not the same failure. Track constraint rescue apart from tangent bleed.
  const rocIds = [...new Set(results.filter((r) => r.metric === "roc").map((r) => r.id))];
  if (rocIds.length) {
    console.log("\n" + line);
    console.log("CONSTRAINT RESCUE — ROC  (did the apex rule surface? off vs on)");
    let onHit = 0, offHit = 0, attributable = 0;
    for (const id of rocIds) {
      const off = results.find((r) => r.id === id && r.field === false);
      const on = results.find((r) => r.id === id && r.field === true);
      const o = off && off.rescued, n = on && on.rescued;
      if (n) onHit++; if (o) offHit++;
      let mark = "";
      if (!o && n) { mark = "  <== field rescued it"; attributable++; }
      console.log("  " + id.padEnd(22) + " off=" + (o ? "RESCUED" : " miss  ") + "  on=" + (n ? "RESCUED" : " miss  ") + mark);
    }
    const pct = (x) => (100 * x / rocIds.length).toFixed(0) + "%";
    console.log("  " + line.slice(0, 60));
    console.log("  ROC  off=" + offHit + "/" + rocIds.length + " (" + pct(offHit) + ")   on=" +
      onHit + "/" + rocIds.length + " (" + pct(onHit) + ")   field-attributable rescues: " + attributable);
  }

  const tbrIds = [...new Set(results.filter((r) => r.metric === "tbr").map((r) => r.id))];
  if (tbrIds.length) {
    console.log("\n" + line);
    console.log("TANGENT BLEED — TBR  (did forbidden junk leak in? off vs on)");
    let onBleed = 0, offBleed = 0;
    for (const id of tbrIds) {
      const off = results.find((r) => r.id === id && r.field === false);
      const on = results.find((r) => r.id === id && r.field === true);
      if (on && on.bled) onBleed++; if (off && off.bled) offBleed++;
      const tag = (r) => r ? (r.bled ? "BLED(" + r.bled + ")" : "clean  ") + " +" + r.appended + "rel" : " - ";
      console.log("  " + id.padEnd(22) + " off=" + tag(off) + "  on=" + tag(on));
    }
    const pct = (x) => (100 * x / tbrIds.length).toFixed(0) + "%";
    console.log("  " + line.slice(0, 60));
    console.log("  TBR  off=" + offBleed + "/" + tbrIds.length + " (" + pct(offBleed) + ")   on=" +
      onBleed + "/" + tbrIds.length + " (" + pct(onBleed) + ")   (+Nrel = memories the field appended)");
  }

  // Totals
  const passed = results.filter((r) => r.pass).length;
  console.log("\n" + line);
  console.log("TOTAL: " + passed + "/" + results.length + " checks passed");
  console.log(line + "\n");

  return { generated: new Date().toISOString(), passed, total: results.length,
    store: storeKind,
    cases: Object.fromEntries(results.map((r) => [key(r), r.pass])) };
}

function diffCases(goldenCases, currentCases) {
  const regressions = [], improvements = [], flips = [];
  for (const [k, wasPass] of Object.entries(goldenCases || {})) {
    const now = currentCases[k];
    if (now === undefined) continue;
    if (wasPass && !now) { regressions.push(k); flips.push(k); }
    if (!wasPass && now) { improvements.push(k); flips.push(k); }
  }
  return { regressions, improvements, flips };
}

function gate(current, { parity = false } = {}) {
  if (!fs.existsSync(GOLDEN)) {
    console.log("No golden.json yet. Review the scorecard above, then lock it in:");
    console.log("  npm run eval -- --accept\n");
    return 0;
  }
  const golden = JSON.parse(fs.readFileSync(GOLDEN, "utf8"));
  const { regressions, improvements, flips } = diffCases(golden.cases, current.cases);

  // SqliteStore parity is two-sided: a fail→pass is as much a drop-in
  // break as a pass→fail. The JSONL default gate stays one-way (an
  // improvement is news, not a red). Any sqlite flip is a STOP — f32
  // near-tie or genuine inequivalence, report the case, don't paper it.
  if (parity) {
    if (flips.length) {
      console.error("PARITY FAIL — scorecard differs from golden (store=" +
        (current.store || "sqlite") + "):");
      for (const k of flips) {
        const was = golden.cases[k];
        const now = current.cases[k];
        console.error("  " + k + "  golden=" + (was ? "PASS" : "FAIL") +
          "  now=" + (now ? "PASS" : "FAIL"));
      }
      console.error("");
      return 1;
    }
    console.log("SqliteStore scorecard matches golden case-for-case.");
    console.log("No regressions vs golden.\n");
    return 0;
  }

  if (improvements.length) console.log("IMPROVED since golden: " + improvements.join(", "));
  if (regressions.length) {
    console.error("REGRESSION - these cases flipped PASS -> FAIL:");
    for (const k of regressions) console.error("  " + k);
    console.error("");
    return 1;
  }
  console.log("No regressions vs golden.\n");
  return 0;
}

async function main(argv) {
  const args = argv || process.argv.slice(2);
  const accept = args.includes("--accept");
  const fi = args.indexOf("--filter");
  const filter = fi >= 0 ? args[fi + 1] : null;
  const storeKind = parseStoreKind(args);

  const results = await run({ filter, storeKind });
  const current = scorecard(results, { storeKind });

  if (accept) {
    // golden.json is the JSONL lock. Accepting a sqlite run would let an
    // f32 near-tie rewrite the gate without anyone noticing the flip.
    if (storeKind !== "jsonl") {
      console.error("--accept writes golden.json; that lock is the JSONL scorecard.");
      console.error("Re-run with --store jsonl.\n");
      return 2;
    }
    fs.writeFileSync(GOLDEN, JSON.stringify(current, null, 2));
    console.log("Wrote golden.json (" + current.passed + "/" + current.total + ").\n");
    return 0;
  }
  return gate(current, { parity: storeKind === "sqlite" });
}

module.exports = {
  run, runCase, scorecard, gate, parseStoreKind, isGoldenCase, key, diffCases, GOLDEN,
};

if (require.main === module) {
  main().then((code) => process.exit(code)).catch((e) => {
    console.error(String(e.message || e));
    process.exit(2);
  });
}
