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
 * eval/decay-probe.js - measures the Hebbian layer's two timescales directly.
 *
 * Live decay (Phase 0.2) is lazy wall-clock via effectiveHebbian, half-life
 * ~7 days for facts — an instant probe cannot observe it. The FORGETTING loop
 * below still drives the RETIRED epoch clock (EdgeStore.tick / beta=0.95 every
 * 10) so the original timescale remains inspectable. Do not treat those
 * "recalls to forget" as the live law; live forgetting is elapsed time.
 *
 *   LEARNING  - how many co-recalls lift  cosine + bonus  over the 0.55 edge gate
 *   FORGETTING- (retired epoch math) how many ticks drop it back under the gate
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { EdgeStore } = require("../edges.js");
const { embed } = require("./embed-cache.js");

const GATE = 0.55;   // field.js minSim

// Related pairs that plausibly sit BELOW the cosine edge gate (so the static graph
// misses them) but are semantically linked enough that reinforcement is meaningful.
const PAIRS = [
  ["lactose", "I'm lactose intolerant, dairy upsets my stomach", "This creamy alfredo is loaded with butter and cheese"],
  ["gluten", "I have celiac disease and can't eat gluten", "The bakery's sourdough loaves are fresh every morning"],
  ["budget", "I'm trying to save money this year", "We booked the expensive beachfront resort for the trip"],
];

function cosine(a, b) {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? d / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

async function probe(label, ta, tb) {
  const [va, vb] = await embed([ta, tb]);
  const cos = cosine(va, vb);

  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "rm-decay-")), "l.edges.json");
  const L = new EdgeStore(file);
  const score = () => cos + L.bonus("A", "B");

  // LEARNING: co-recall A and B as primaries (alphaPP), until score crosses the gate.
  let learnTurn = null;
  for (let t = 1; t <= 60 && learnTurn === null; t++) {
    L.reinforceRecall(["A", "B"], []);
    if (score() >= GATE) learnTurn = t;
  }
  const peak = score(), peakW = L.weight("A", "B");

  // FORGETTING: stop reinforcing; replay the retired epoch clock (not the live path).
  let forgetRecalls = null;
  if (learnTurn !== null) {
    for (let r = 1; r <= 5000 && forgetRecalls === null; r++) {
      L.tick();
      if (score() < GATE) forgetRecalls = r;
    }
  }

  const pad = (s, n) => String(s).padEnd(n);
  console.log(
    pad(label, 10) +
    "cos=" + cos.toFixed(3) +
    (cos >= GATE ? "  (already >= gate; not a decay case)" :
      "  learn=" + (learnTurn ? learnTurn + " co-recalls" : ">60 (never crosses)") +
      "  peak=" + peak.toFixed(3) + " (w=" + peakW.toFixed(2) + ")" +
      "  forget=" + (forgetRecalls ? forgetRecalls + " recalls" : ">5000")));
}

(async () => {
  console.log("\nHEBBIAN TIMESCALES  (edge gate = " + GATE + ", bonus max = 0.30)\n");
  for (const [label, a, b] of PAIRS) await probe(label, a, b);
  console.log("\nlearn = co-recalls (alphaPP=0.1 each) to lift cosine+bonus over the gate");
  console.log("forget = retired epoch ticks (beta=0.95 every 10); live decay is wall-clock half-life\n");
})().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
