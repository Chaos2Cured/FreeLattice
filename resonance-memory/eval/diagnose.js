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
 * eval/diagnose.js - the failure-surface mapper (READ-ONLY; touches no field.js).
 *
 *   node eval/diagnose.js [corpus-file]     (default: field-stress.jsonl)
 *
 * For every rescue/constraint case it reports, without changing the shipped
 * mechanism, whether the target memory is reachable from the cosine top-5 seeds
 * under four candidate traversal strategies -
 *
 *   fwd-1  forward edges, 1 hop   (THIS IS WHAT SHIPS TODAY)
 *   fwd-2  forward edges, 2 hops
 *   bi-1   bidirectional, 1 hop
 *   bi-2   bidirectional, 2 hops
 *
 * - and how many NON-target memories each strategy drags in (the noise/precision
 * cost). This is the decision table: per case, which fix rescues the target and at
 * what precision price. Measure before touching field.js.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { JsonlStore } = require("../store.js");
const fieldMod = require("../field.js");
const { createMemory, cosine } = require("./pipeline.js");
const { embed } = require("./embed-cache.js");

// Build a directed adjacency (forward = the shipped kNN edges) and its reverse.
function adjacencies(mems) {
  const edges = fieldMod.buildEdges(mems, { k: 2, minSim: 0.70 });   // exactly what ships
  const forward = new Map();
  const reverse = new Map();
  for (const [a, list] of edges) {
    forward.set(String(a), list.map((e) => ({ id: String(e.id), sim: e.sim })));
    for (const e of list) {
      const k = String(e.id);
      if (!reverse.has(k)) reverse.set(k, []);
      reverse.get(k).push({ id: String(a), sim: e.sim });
    }
  }
  // bidirectional = union of forward + reverse per node
  const bidi = new Map();
  for (const m of mems) {
    const k = String(m.id);
    const seen = new Set();
    const merged = [];
    for (const e of [...(forward.get(k) || []), ...(reverse.get(k) || [])]) {
      if (seen.has(e.id)) continue; seen.add(e.id); merged.push(e);
    }
    bidi.set(k, merged);
  }
  return { forward, bidi };
}

// Generic BFS-ish expansion from seeds; returns the set of reached ids (excl seeds).
function reach(adj, seedIds, hops) {
  const seen = new Set(seedIds.map(String));
  const reached = new Set();
  let frontier = seedIds.map(String);
  for (let h = 0; h < hops; h++) {
    const next = [];
    for (const s of frontier) {
      for (const e of (adj.get(s) || [])) {
        if (seen.has(e.id)) continue;
        seen.add(e.id); reached.add(e.id); next.push(e.id);
      }
    }
    frontier = next;
  }
  return reached;
}

async function diagnoseCase(c) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rm-diag-"));
  const file = path.join(dir, "store.jsonl");
  const store = new JsonlStore(file);
  const mem = createMemory({ store, embed, fieldEnabled: true, edgesPath: file + ".edges.json" });
  for (const w of c.writes) await mem.save(w);

  const q = c.query || (c.repeat && c.repeat[c.repeat.length - 1].query);
  const mems = store.current();
  const [qv] = await embed([q]);
  const ranked = mems.map((m) => ({ m, s: cosine(qv, m.embedding) })).sort((a, b) => b.s - a.s);

  const term = (c.expect && c.expect.contains && c.expect.contains[0]) || "";
  const targetRec = mems.find((m) => m.text.toLowerCase().includes(term.toLowerCase()));
  const targetId = targetRec ? String(targetRec.id) : null;
  const targetRank = ranked.findIndex((r) => String(r.m.id) === targetId) + 1;

  const seeds = ranked.slice(0, 5).map((r) => String(r.m.id));
  const inTop5 = targetRank >= 1 && targetRank <= 5;
  const { forward, bidi } = adjacencies(mems);

  const strat = (adj, hops) => {
    const reached = reach(adj, seeds, hops);
    const rescued = targetId ? reached.has(targetId) : false;
    const noise = reached.size - (rescued ? 1 : 0);
    return { rescued, noise };
  };
  const cell = (r) => (r.rescued ? "YES" : " . ") + "(" + r.noise + ")";

  const fwd1 = strat(forward, 1), fwd2 = strat(forward, 2);
  const bi1 = strat(bidi, 1), bi2 = strat(bidi, 2);

  fs.rmSync(dir, { recursive: true, force: true });
  return { id: c.id, n: mems.length, targetRank, inTop5, fwd1, fwd2, bi1, bi2, cell };
}

async function main() {
  const corpusFile = process.argv[2] || "field-stress.jsonl";
  const cases = fs.readFileSync(path.join(__dirname, "corpora", corpusFile), "utf8")
    .split("\n").filter(Boolean).map((l) => JSON.parse(l))
    .filter((c) => c.kind === "constraint");

  console.log("\nFAILURE-SURFACE MAP  (" + corpusFile + ")   cell = rescued?(noise pulled)");
  console.log("target rank is the target's cosine position; top-5 means cosine already gets it\n");
  console.log("case".padEnd(22) + "n   rank  " + "fwd-1(ship)".padEnd(13) + "fwd-2".padEnd(9) + "bi-1".padEnd(9) + "bi-2");
  console.log("-".repeat(78));
  for (const c of cases) {
    const r = await diagnoseCase(c);
    const rankNote = r.inTop5 ? (r.targetRank + "*") : String(r.targetRank);
    console.log(
      r.id.padEnd(22) + String(r.n).padEnd(4) + rankNote.padEnd(6) +
      r.cell(r.fwd1).padEnd(13) + r.cell(r.fwd2).padEnd(9) + r.cell(r.bi1).padEnd(9) + r.cell(r.bi2));
  }
  console.log("-".repeat(78));
  console.log("* target already in cosine top-5 (field not needed). YES = target rescued.");
  console.log("(n) after each = non-target memories that strategy drags in (precision cost).\n");
}

main().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
