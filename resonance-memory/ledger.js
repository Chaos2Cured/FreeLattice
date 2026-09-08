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
 * ledger.js - the Hebbian sidecar for the associative field (Phase 2b).
 *
 * RETIRED FROM THE LIVE PATH as of Phase 0 Slice C. Recall / reinforce /
 * tick / save now go through edges.js EdgeStore (`<store>.edges.json`).
 * This file is kept so the original epoch-decay math stays inspectable and
 * so tests can compare EdgeStore bonuses against the shipped Ledger on the
 * same fixture ("moving storage must not move the numbers"). Do not construct
 * Ledger from server.js / memory-core.js / eval/pipeline.js.
 *
 * Learned memory<->memory association weights, kept ENTIRELY separate from the
 * vector store. The cosine graph (field.js) is the static semantic floor; this
 * ledger is the dynamic layer that reshapes with use ("fire together, wire
 * together") and fades without it (decay + prune).
 *
 * Safety properties baked in here, per the Claude/Gemini design review:
 *   - Canonical undirected edge key (ids sorted) so a:b and b:a are one edge.
 *   - Bounded bonus via tanh: frequency can lift a weak edge over the gate but
 *     can never swamp the semantic floor (bonus in [0, maxBonus)).
 *   - Provenance-discounted reinforcement: primary<->primary full alpha,
 *     primary<->neighborhood discounted, neighborhood<->neighborhood zero -
 *     so the graph learns from the user's queries, not from its own guesses.
 */

const fs = require("fs");
const { writeFileDurable } = require("./record.js");

function edgeKey(a, b) { return [String(a), String(b)].sort().join(":"); }

class Ledger {
  constructor(file, opts = {}) {
    this.file = file;
    this.alphaPP = opts.alphaPP != null ? opts.alphaPP : 0.1;   // primary <-> primary
    this.alphaPN = opts.alphaPN != null ? opts.alphaPN : 0.02;  // primary <-> neighborhood
    this.beta = opts.beta != null ? opts.beta : 0.95;           // decay retention
    this.floor = opts.floor != null ? opts.floor : 0.05;        // prune threshold
    this.epoch = opts.epoch != null ? opts.epoch : 10;          // decay every N recalls
    this.maxBonus = opts.maxBonus != null ? opts.maxBonus : 0.3;
    this.edges = new Map();
    this.recalls = 0;
    this.load();
  }

  load() {
    try {
      const j = JSON.parse(fs.readFileSync(this.file, "utf8"));
      this.recalls = j.recalls || 0;
      for (const k in (j.edges || {})) this.edges.set(k, j.edges[k]);
    } catch { /* no sidecar yet - start empty */ }
  }

  save() {
    try {
      // Durable (temp -> fsync -> atomic rename): a crash mid-save must never
      // leave a truncated ledger that fails to parse on next load.
      writeFileDurable(this.file, JSON.stringify({ recalls: this.recalls, edges: Object.fromEntries(this.edges) }));
    } catch { /* non-fatal: the field must never break recall */ }
  }

  weight(a, b) { return this.edges.get(edgeKey(a, b)) || 0; }

  // bounded Hebbian bonus: 0 at weight 0, asymptotic to maxBonus, never exceeds it
  bonus(a, b) { const w = this.weight(a, b); return w > 0 ? this.maxBonus * Math.tanh(w) : 0; }

  _bump(a, b, alpha) {
    if (alpha <= 0 || String(a) === String(b)) return;
    const k = edgeKey(a, b);
    this.edges.set(k, (this.edges.get(k) || 0) + alpha);
  }

  // Reinforce one recall event given the provenance of the returned ids.
  reinforceRecall(primaryIds, neighborhoodIds) {
    for (let i = 0; i < primaryIds.length; i++)
      for (let j = i + 1; j < primaryIds.length; j++)
        this._bump(primaryIds[i], primaryIds[j], this.alphaPP);
    for (const p of primaryIds)
      for (const n of neighborhoodIds)
        this._bump(p, n, this.alphaPN);
    // neighborhood <-> neighborhood: alpha 0, intentionally skipped
  }

  // Advance the epoch clock; decay + prune on the boundary.
  tick() {
    this.recalls += 1;
    if (this.epoch > 0 && this.recalls % this.epoch === 0) this.decay();
  }

  decay() {
    for (const [k, w] of [...this.edges]) {
      const nw = w * this.beta;
      if (nw < this.floor) this.edges.delete(k);
      else this.edges.set(k, nw);
    }
  }
}

module.exports = { Ledger, edgeKey };
