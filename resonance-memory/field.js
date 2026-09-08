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
 * field.js - the associative layer for resonance-memory (Phase 2a, Node prototype).
 *
 * Builds a semantic association graph over stored memories from the vectors we
 * ALREADY store at save time - no new embedding calls, no LLM extraction. Edges
 * are per-node k-nearest-neighbors by cosine of full memory text vs full memory
 * text. That is the RICH-TO-RICH regime the measured finding says works; kNN is
 * relative per node, so it dodges the absolute-similarity floor (~0.45) that made
 * a global threshold connect everything.
 *
 * Recall can then expand from cosine seeds to a neighborhood (a region, not a
 * record). Co-activation reinforcement (memories recalled together strengthen
 * their edge) is a separate, additive weight - it never touches query ranking,
 * which stays pure cosine per the ROADMAP invariant.
 */

function cosine(a, b) {
  if (!a || !b) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

/*
 * Build kNN association edges.
 *   records: [{ id, text, embedding }]  (embedding may be null -> node has no edges)
 *   opts.k: neighbors per node (default 3)
 *   opts.minSim: floor to drop weak/generic links (default 0.70). This is the
 *               RECALL gate for what surfaces in Related:. Tuned on fire-together
 *               (nomic plain): 0.55 kept 30/30 true pairs but leaked 11 near-miss
 *               edges; 0.70 keeps 28/30 true (bookshelf m2↔m3 at 0.676 is the
 *               cost), zero near-miss, zero unrelated. Save-time persist uses a
 *               looser 0.25 (SAVE_TIME_MIN_COS in memory-core.js) — two jobs,
 *               two numbers, do not unify them (phase-0 Risk #2).
 *   opts.bonus: (idA, idB) => number, a bounded Hebbian bonus added to cosine
 *               before gating/ranking (default: none). Lets a learned association
 *               lift a weak-cosine edge over the gate without erasing semantics.
 *   opts.conflict: (recA, recB) => bool. True → do not emit the edge. Server-
 *               assigned entity/polarity mismatch (entity.js) lives here so a
 *               0.88 Omar-dentist pair cannot surface as Related:. Discovery
 *               only — never reorders primary cosine (I2/I3).
 *   opts.mutual: keep an edge a->b only if a is ALSO in b's top-k (reciprocal kNN).
 *               Default false = the original directional kNN. Directional edges are
 *               asymmetric: a generic "hub" node that shares a token with many others
 *               lands in their top-k and gets dragged into a seed's neighborhood as a
 *               false positive (measured: the noise-schedule 'Thursday' collision).
 *               Mutual kNN requires the association to be reciprocated, pruning those
 *               one-sided hub links. RM-00 judges whether it is a net improvement.
 * Returns Map<id, [{ id, sim }]> sorted by blended score desc.
 */
function hasEmb(r) {
  // Array.isArray is false for Float32Array (SqliteStore cache form).
  // Cosine only needs length + numeric index.
  const e = r && r.embedding;
  return !!(e && e.length > 0 && typeof e[0] === "number");
}

function buildEdges(records, opts = {}) {
  const k = opts.k || 3;
  const minSim = opts.minSim != null ? opts.minSim : 0.70;
  const bonus = opts.bonus || (() => 0);
  const conflict = typeof opts.conflict === "function" ? opts.conflict : () => false;
  const withVec = records.filter(hasEmb);

  // Pass 1: each node's gated top-k candidates (the directional kNN).
  const topk = new Map();
  for (const a of withVec) {
    const sims = [];
    for (const b of withVec) {
      if (a.id === b.id) continue;
      if (conflict(a, b)) continue;
      const s = cosine(a.embedding, b.embedding) + bonus(a.id, b.id);
      if (s >= minSim) sims.push({ id: b.id, sim: s });
    }
    sims.sort((x, y) => y.sim - x.sim);
    topk.set(a.id, sims.slice(0, k));
  }
  if (!opts.mutual) return topk;

  // Pass 2 (mutual): drop any edge a->b that b does not reciprocate in its own top-k.
  const reciprocates = (x, y) => (topk.get(x) || []).some((e) => String(e.id) === String(y));
  const edges = new Map();
  for (const a of withVec) {
    edges.set(a.id, (topk.get(a.id) || []).filter((e) => reciprocates(e.id, a.id)));
  }
  return edges;
}

/*
 * Expand from seed ids to their neighborhood.
 *   edges: Map from buildEdges
 *   seedIds: ids of the cosine-ranked query hits
 *   opts.hops: graph hops (default 1), opts.max: cap on returned related ids
 * Returns [{ id, sim, via }] for related ids NOT already in seedIds, sorted by sim.
 */
function neighborhood(edges, seedIds, opts = {}) {
  const hops = opts.hops || 1;
  const max = opts.max || 5;
  const seeds = new Set(seedIds.map(String));
  const seen = new Set(seeds);
  const out = [];
  let frontier = [...seedIds];
  for (let h = 0; h < hops; h++) {
    const next = [];
    for (const s of frontier) {
      for (const e of (edges.get(s) || edges.get(Number(s)) || [])) {
        const key = String(e.id);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ id: e.id, sim: e.sim, via: s });
        next.push(e.id);
      }
    }
    frontier = next;
  }
  out.sort((a, b) => b.sim - a.sim);
  return out.slice(0, max);
}

/*
 * Constraint rescue (RM-00 field experiment #2). Find typed-constraint memories
 * reachable from the (expanded) cosine seed pool within one BIDIRECTIONAL hop, so an
 * apex rule that sits far down cosine ("I'm diabetic", rank 21) still surfaces when a
 * bridge it associates with ("lemon bars", rank 7) made it into the seed pool.
 *
 * Why this is a separate path, not just wider neighborhood(): it only ever returns
 * CONSTRAINTS. The expanded seed radius would otherwise re-drag non-constraint hubs
 * (the mechanic FP) back in; restricting the aggressive reach to typed constraints
 * means a corpus with no constraints (the noise cases) gets nothing new — TBR is
 * protected by construction, not by luck.
 *
 *   records: normalized memories (must carry is_constraint + embedding)
 *   seedIds: the internal cosine seed pool (k_search wide, e.g. 15)
 *   opts.exclude: ids ALREADY returned to the model (skip these — no double-surfacing).
 *              NOTE: this is the RETURNED set (top return_k), NOT the seed pool. A
 *              constraint that ranked into the wider pool but fell outside the returned
 *              top-k is precisely a rescue target (vegetarian, rank 10 with return_k=5).
 *   opts.gate: min cosine for a constraint<->seed association (0.55 default here;
 *              memory-core ships 0.45 so heights<->rooftop = 0.472 still rescues).
 *              Independent of Related: minSim (0.70) — do not unify them.
 *   opts.k:    neighbors examined per constraint (default 2, matches buildEdges)
 *   opts.max:  cap on rescued constraints
 * Returns [{ id, sim, via }] for unreturned constraints, best first.
 */
function reachableConstraints(records, seedIds, opts = {}) {
  const gate = opts.gate != null ? opts.gate : 0.55;
  const k = opts.k || 2;
  const max = opts.max || 4;
  const seeds = new Set(seedIds.map(String));
  const exclude = new Set((opts.exclude || []).map(String));
  const withVec = records.filter(hasEmb);
  const out = [];
  for (const c of withVec) {
    if (!c.is_constraint || exclude.has(String(c.id))) continue;
    // Bridge rescue ONLY: the constraint must be associated (>= gate) with a memory
    // that is itself in the query's seed pool. We deliberately do NOT auto-surface a
    // constraint merely because it landed in the pool: when the store is smaller than
    // k_search the pool IS the whole store, so "in the pool" carries no relevance
    // signal and would surface every constraint (measured: a shellfish allergy fired
    // for an oil-change query, adv-offtopic-quiet). A constraint must EARN its way in
    // through a genuinely query-relevant bridge, not by mere existence.
    const nbrs = withVec
      .filter((b) => String(b.id) !== String(c.id))
      .map((b) => ({ id: b.id, sim: cosine(c.embedding, b.embedding) }))
      .filter((x) => x.sim >= gate)
      .sort((a, b) => b.sim - a.sim)
      .slice(0, k);
    // reachable iff one of them landed in the seed pool (bidirectional 1-hop).
    const hit = nbrs.find((n) => seeds.has(String(n.id)));
    if (hit) out.push({ id: c.id, sim: hit.sim, via: hit.id });
  }
  out.sort((a, b) => b.sim - a.sim);
  return out.slice(0, max);
}

module.exports = { cosine, buildEdges, neighborhood, reachableConstraints };
