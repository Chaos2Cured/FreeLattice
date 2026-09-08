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
 * inspect_sidecar.js - telemetry for the Hebbian association ledger (Phase 2b).
 *
 * Answers the four field-hardening questions before we drop the RESONANCE_MEMORY_FIELD
 * flag and make the associative field the default:
 *   1. Is the ledger breathing (decaying/pruning) or growing a hairball?
 *   2. Are the threshold-crossers genuine semantic leaps (HIGH weight, LOW cosine)
 *      or just filler that co-fired? -> we resolve edge ids to memory TEXT and
 *      recompute base cosine from the stored vectors so you can actually judge.
 *   3. Do the top-weight edges reflect deliberate, repeated intent (good) or the
 *      graph slowly validating its own noise (bad)?
 *   4. (perf) Ledger size, so you can see whether the on-recall save could stutter.
 *
 * Reads the live sidecar (`kind: "resonance-edges"`, hebbian.weight on each
 * record) and the leftover `{ recalls, edges: { "a:b": weight } }` shape, and
 * joins ids back to the JSONL store. Standard library + local field.js only, no deps.
 *
 *   node inspect_sidecar.js [path_to_.edges.json | path_to_.assoc.json]
 */

const fs = require("fs");
const path = require("path");

// Inlined (identical to field.js) so this script is standalone and portable -
// drop it next to any resonance-memory store and it runs with zero dependencies.
function cosine(a, b) {
  if (!a || !b) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

const STORE_PATH = process.env.MEMORY_FILE_PATH ||
  path.join(process.env.USERPROFILE || process.env.HOME || ".", ".lmstudio", "resonance-memory.jsonl");
const EDGES_PATH = STORE_PATH + ".edges.json";
const ASSOC_PATH = STORE_PATH + ".assoc.json";
// Prefer the live sidecar; fall back to a leftover .assoc.json so an upgraded
// install that hasn't recalled-with-field-on yet is still inspectable.
const SIDECAR_PATH = process.argv[2] || (fs.existsSync(EDGES_PATH) ? EDGES_PATH : ASSOC_PATH);

function loadStore() {
  const byId = new Map();
  try {
    for (const line of fs.readFileSync(STORE_PATH, "utf8").split("\n")) {
      if (!line.trim()) continue;
      let r; try { r = JSON.parse(line); } catch { continue; }
      if (r && r.id != null) byId.set(String(r.id), r);
    }
  } catch { /* no store yet */ }
  return byId;
}

function snippet(rec, n = 60) {
  if (!rec) return "(deleted or unknown id)";
  const t = (rec.text || "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

function baseCosine(store, a, b) {
  const ra = store.get(String(a)), rb = store.get(String(b));
  if (!ra || !rb || !ra.embedding || !rb.embedding) return null;
  return cosine(ra.embedding, rb.embedding);
}

function main() {
  console.log("\n========================================");
  console.log("  RESONANCE MEMORY ASSOCIATION TELEMETRY ");
  console.log("========================================\n");
  console.log(`store:   ${STORE_PATH}`);
  console.log(`sidecar: ${SIDECAR_PATH}\n`);

  if (!fs.existsSync(SIDECAR_PATH)) {
    console.log("No sidecar yet. The edge store is created on the first recall with the");
    console.log("field ON (RESONANCE_MEMORY_FIELD=1 or config.json field:true). Nothing to");
    console.log("inspect until the field has actually been used. This is expected early on.");
    return;
  }

  let j;
  try { j = JSON.parse(fs.readFileSync(SIDECAR_PATH, "utf8")); }
  catch (e) { console.error(`[!] cannot parse sidecar: ${e.message}`); process.exit(1); }

  const edgesObj = j.edges || {};
  const recalls = j.recalls || 0;
  const store = loadStore();

  const edges = Object.entries(edgesObj).map(([key, w]) => {
    // Legacy sidecar: number. Native EdgeStore record: hebbian.weight.
    const weight = typeof w === "number" ? w
      : (w && w.hebbian && typeof w.hebbian.weight === "number") ? w.hebbian.weight
      : (w && typeof w.weight === "number") ? w.weight
      : 0;
    const [a, b] = key.split(":");
    return { key, a, b, weight, baseCos: baseCosine(store, a, b) };
  }).sort((x, y) => y.weight - x.weight);

  const total = edges.length;

  // --- 1. Equilibrium / breathing -------------------------------------------
  const nearFloor = edges.filter(e => e.weight < 0.1).length;       // about to be pruned
  const consolidated = edges.filter(e => e.weight >= 0.5).length;   // strongly learned
  console.log("### 1. Equilibrium & breathing");
  console.log(`- leftover epoch counter:       ${recalls}  (not the decay clock as of 0.2)`);
  console.log(`- total active edges:           ${total}`);
  console.log(`- near prune floor (<0.1):      ${nearFloor}`);
  console.log(`- consolidated (>=0.5):         ${consolidated}`);
  console.log(`  decay is lazy wall-clock (effectiveHebbian); stored weights do not fade`);
  console.log(`  until a mutation materializes them (0.3). Watch last_updated vs now.`);
  console.log(`  red flag: total climbs day over day and never falls -> hairball.\n`);
  if (total === 0) { console.log("Ledger is empty. Nothing more to report.\n"); return; }

  // --- 2. Semantic leaps: HIGH weight, LOW base cosine ----------------------
  console.log("### 2. Semantic leaps (high learned weight, low base cosine)");
  const leaps = edges.filter(e => e.baseCos != null && e.baseCos < 0.55)
    .sort((x, y) => y.weight - x.weight).slice(0, 5);
  if (leaps.length === 0) {
    console.log("  (none yet - no low-cosine pair has been co-activated enough to matter)\n");
  } else {
    for (const e of leaps) {
      console.log(`  w=${e.weight.toFixed(3)}  cos=${e.baseCos.toFixed(3)}  [${e.key}]`);
      console.log(`     A: ${snippet(store.get(e.a))}`);
      console.log(`     B: ${snippet(store.get(e.b))}`);
    }
    console.log(`  judge: are these intuitive links, or filler that co-fired?\n`);
  }

  // --- 3. Provenance dominance: strongest edges overall ---------------------
  console.log("### 3. Strongest edges (should reflect deliberate, repeated intent)");
  for (const e of edges.slice(0, 5)) {
    const c = e.baseCos == null ? "  n/a" : e.baseCos.toFixed(3);
    console.log(`  w=${e.weight.toFixed(3)}  cos=${c}  [${e.key}]`);
    console.log(`     A: ${snippet(store.get(e.a))}`);
    console.log(`     B: ${snippet(store.get(e.b))}`);
  }
  console.log(`  red flag: top weights between obscure pairs you didn't type recently\n`);

  // --- 4. Distribution / perf ----------------------------------------------
  const ws = edges.map(e => e.weight);
  const sum = ws.reduce((a, w) => a + w, 0);
  const bytes = fs.statSync(SIDECAR_PATH).size;
  console.log("### 4. Distribution & size");
  console.log(`- max / avg / min weight: ${ws[0].toFixed(3)} / ${(sum / total).toFixed(3)} / ${ws[ws.length - 1].toFixed(3)}`);
  console.log(`- sidecar file size:      ${bytes} bytes  (rewritten on reinforce, not on a decay tick)`);
  console.log(`  perf is only a concern if this grows large; wall-clock decay fades the`);
  console.log(`  learned signal on read; pruneSweep (0.4) soft-prunes idle AND weak ones.\n`);
}

main();
