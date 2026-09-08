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
 * eval/probe.js - a geometry inspector for designing valid field cases.
 *
 *   node eval/probe.js <corpus-file> <case-id>
 *
 * Builds the case's store, then dumps for its query: the full cosine ranking (so
 * you can see whether the target sits OUTSIDE top-k), the static kNN edges, and the
 * neighborhood expansion from the cosine top-5 seeds. A field case is only valid if
 * the target is out of cosine's top-k AND reachable via an edge from a seed - this
 * shows you both, on the real embedder, before you assert an expectation.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { JsonlStore } = require("../store.js");
const fieldMod = require("../field.js");
const { createMemory, cosine } = require("./pipeline.js");
const { embed } = require("./embed-cache.js");

async function main() {
  const corpusFile = process.argv[2];
  const caseId = process.argv[3];
  const cases = fs.readFileSync(path.join(__dirname, "corpora", corpusFile), "utf8")
    .split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const c = cases.find((x) => x.id === caseId) || cases[0];

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rm-probe-"));
  const file = path.join(dir, "store.jsonl");
  const store = new JsonlStore(file);
  const mem = createMemory({ store, embed, fieldEnabled: true, edgesPath: file + ".edges.json" });
  for (const w of c.writes) await mem.save(w);

  const q = c.query || (c.repeat && c.repeat[c.repeat.length - 1].query);
  const mems = store.current();
  const byId = new Map(mems.map((m) => [String(m.id), m]));
  const [qv] = await embed([q]);
  const ranked = mems.map((m) => ({ id: m.id, text: m.text, s: cosine(qv, m.embedding) }))
    .sort((a, b) => b.s - a.s);

  console.log("CASE:", c.id, "  (" + mems.length + " memories, k=5)");
  console.log("QUERY:", q);
  const target = (c.expect && c.expect.contains && c.expect.contains[0]) || null;
  console.log("TARGET term:", target);

  console.log("\nCOSINE RANK:");
  ranked.forEach((r, i) => {
    const isTarget = target && r.text.toLowerCase().includes(target.toLowerCase());
    console.log("  " + String(i + 1).padStart(2) + ". " + r.s.toFixed(3) +
      "  [id " + r.id + "] " + r.text.slice(0, 58) + (isTarget ? "   <== TARGET" : "") +
      (i === 4 ? "   --- top-5 cut ---" : ""));
  });

  const edges = fieldMod.buildEdges(mems, { k: 2, minSim: 0.70 });
  console.log("\nSTATIC kNN EDGES (k=2, minSim=0.70):");
  let any = false;
  for (const [id, es] of edges) {
    if (!es.length) continue;
    any = true;
    console.log("  [" + id + "] " + byId.get(String(id)).text.slice(0, 44));
    for (const e of es) console.log("        -> " + e.sim.toFixed(3) + "  [" + e.id + "] " + byId.get(String(e.id)).text.slice(0, 44));
  }
  if (!any) console.log("  (none clear the 0.70 gate)");

  const top5 = ranked.slice(0, 5).map((r) => r.id);
  const nb = fieldMod.neighborhood(edges, top5, { hops: 1, max: 4 });
  console.log("\nNEIGHBORHOOD from cosine top-5 (what field-on would append):");
  if (!nb.length) console.log("  (nothing - field adds nothing here)");
  nb.forEach((e) => {
    const isTarget = target && byId.get(String(e.id)).text.toLowerCase().includes(target.toLowerCase());
    console.log("  " + e.sim.toFixed(3) + "  [id " + e.id + "] " + byId.get(String(e.id)).text.slice(0, 48) +
      "  (via " + e.via + ")" + (isTarget ? "   <== TARGET RESCUED" : ""));
  });

  fs.rmSync(dir, { recursive: true, force: true });
}

main().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
