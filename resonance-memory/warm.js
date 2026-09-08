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
 * warm.js - ephemeral spreading activation (Phase 1). NEVER persisted (I7).
 *
 * Gemini's current_resonance lives here as node energy, not as an edge column
 * and not as a sidecar. The Map dies with the process; a restart is empty.
 * Ranking is not this module's job — PR1 seeds and spreads so the energy is
 * observable (trace / unit tests); PR2 may read it into Related:; PR3 may
 * fuse it into rank behind a flag. Until then, creating a WarmField must not
 * change a recall's output string.
 *
 * Two clocks, never mixed (design D4):
 *   λ_turn  — dimensionless per notional recall-turn. Default 0.357 ⇒ 1.0 → ~0.7.
 *             Eval and production both call decayAll({ turns: 1 }) once per recall.
 *             NEVER pass wall-clock seconds into λ_turn (a 5s think-pause would
 *             empty the map).
 *   λ_wall  — optional per-second wall decay, default 0. v1's wall mechanism is
 *             the idle TTL (clear the map after 30 min of no events).
 *
 * Edge argument to spread() is Map<id, [{ id, sim }]> — the exact return shape
 * of field.buildEdges. Update is max, not sum, capped at 1.0, so a dense cluster
 * cannot runaway. Spread iterates thisTurn only (the ids seed() just recorded);
 * value === 1.0 is not the seed test (a sim=1.0 neighbor would then re-spread).
 */

function nowMs() { return Date.now(); }

function envInt(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

// Cap is applied at spread() only (shouldSpread), never inside getEdges, so a
// large store cannot disable the field's Related: path. 0 is a legitimate
// "never spread" value — do not `Number(x) || 512`.
const WARM_EDGE_CAP = envInt("RESONANCE_WARM_EDGE_CAP", 512);

function vectorCount(mems) {
  // Typed arrays (SqliteStore) fail Array.isArray; cosine still works.
  return (mems || []).filter((m) => {
    const e = m && m.embedding;
    return !!(e && e.length > 0 && typeof e[0] === "number");
  }).length;
}

function shouldSpread(mems, cap) {
  const n = cap == null ? WARM_EDGE_CAP : cap;
  return vectorCount(mems) <= n;
}

class WarmField {
  constructor(opts = {}) {
    this.nodes = new Map();            // id -> { value, ts }
    this.thisTurn = new Set();         // ids seeded this tick; spread iterates ONLY these
    this.lambdaTurn = opts.lambdaTurn != null ? opts.lambdaTurn : 0.357;
    this.lambdaWall = opts.lambdaWall != null ? opts.lambdaWall : 0; // v1: idle-TTL-only
    this.floor = opts.floor != null ? opts.floor : 0.1;
    this.cap = opts.cap != null ? opts.cap : 32;
    this.idleMs = opts.idleMs != null ? opts.idleMs : 30 * 60 * 1000;
    this.hops = opts.hops != null ? opts.hops : 1;
    this.lastEvent = null;             // null = never; 0 is a legal injectable timestamp
    this.now = opts.now || nowMs;      // injectable for tests
  }

  decayAll({ turns = 1 } = {}) {
    const now = this.now();
    if (this.lastEvent != null && now - this.lastEvent > this.idleMs) {
      this.nodes.clear();
      this.thisTurn.clear();
      this.lastEvent = now;
      return;
    }
    const turnFactor = Math.exp(-this.lambdaTurn * turns);
    let wallFactor = 1;
    if (this.lambdaWall > 0 && this.lastEvent != null) {
      const dtSec = Math.max(0, (now - this.lastEvent) / 1000);
      wallFactor = Math.exp(-this.lambdaWall * dtSec);
    }
    const factor = turnFactor * wallFactor;
    for (const [id, node] of [...this.nodes]) {
      const v = node.value * factor;
      if (v < this.floor) this.nodes.delete(id);
      else this.nodes.set(id, { value: v, ts: now });
    }
    this.lastEvent = now;
  }

  // Model-visible primary ids this turn. Records thisTurn; spread uses that, not E===1.0.
  seed(ids, energy) {
    const e = energy == null ? 1.0 : energy;
    const now = this.now();
    this.thisTurn = new Set();
    for (const id of ids || []) {
      const k = String(id);
      this.nodes.set(k, { value: e, ts: now });
      this.thisTurn.add(k);
    }
    this.lastEvent = now;
    this._evictCap();
  }

  // edges: Map<id, [{ id, sim }]> — the exact return shape of field.buildEdges.
  // Iterates thisTurn only, then clears it. Newly warmed ids are NOT added to
  // thisTurn (no chain within the tick via thisTurn). hops>1 walks a separate
  // frontier so the hop bound is real; v1 default is 1.
  // Update: E_target = min(1.0, max(E_target, E_source * sim))  — max, not sum.
  spread(edges, { hops } = {}) {
    const depth = hops != null ? hops : this.hops;
    const sources = [...this.thisTurn];
    this.thisTurn.clear();
    if (!edges || !sources.length) return;
    const now = this.now();
    let frontier = sources;
    const seen = new Set(sources.map(String));
    for (let h = 0; h < depth; h++) {
      const next = [];
      for (const s of frontier) {
        const eSrc = (this.nodes.get(String(s)) || {}).value || 0;
        const nbrs = edges.get(s) || edges.get(Number(s)) || edges.get(String(s)) || [];
        for (const e of nbrs) {
          const k = String(e.id);
          const incoming = eSrc * (e.sim || 0);
          const nv = Math.min(1.0, Math.max((this.nodes.get(k) || {}).value || 0, incoming));
          if (nv < this.floor) continue;
          const cur = this.nodes.get(k);
          if (!cur || nv > cur.value) this.nodes.set(k, { value: nv, ts: now });
          if (!seen.has(k)) {
            seen.add(k);
            next.push(k);
          }
        }
      }
      frontier = next;
    }
    this._evictCap();
  }

  get(id) { const n = this.nodes.get(String(id)); return n ? n.value : 0; }
  entries() { return this.nodes.entries(); }
  forget(id) { this.nodes.delete(String(id)); this.thisTurn.delete(String(id)); }
  clear() { this.nodes.clear(); this.thisTurn.clear(); }
  trace(id) { const n = this.nodes.get(String(id)); return n ? n.value : 0; }

  _evictCap() {
    if (this.nodes.size <= this.cap) return;
    const ranked = [...this.nodes.entries()].sort((a, b) => a[1].value - b[1].value);
    for (let i = 0; i < ranked.length - this.cap; i++) {
      this.nodes.delete(ranked[i][0]);
      this.thisTurn.delete(ranked[i][0]);
    }
  }
}

/*
 * Tracing helper. Callers MUST gate on the trace flag before calling so the
 * hot path is a single boolean check when RESONANCE_WARM_TRACE is off (no
 * stringify, no iteration). activation is its own field — do not collapse it
 * into final_score (Phase 2.1). PR1 does not rank, so final_score stays semantic.
 */
function emitWarmTrace(W, info) {
  if (!W) return;
  const activation = {};
  for (const [id, node] of W.entries()) activation[id] = node.value;
  const row = {
    query: info && info.query,
    primary: ((info && info.primary) || []).map((m) => String(m && m.id != null ? m.id : m)),
    activation,
    final_score: "semantic",
  };
  try { process.stderr.write("[warm-trace] " + JSON.stringify(row) + "\n"); } catch { /* never throw */ }
}

module.exports = {
  WarmField, shouldSpread, vectorCount, WARM_EDGE_CAP, emitWarmTrace,
};
