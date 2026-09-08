/* Resonance Field — FreeLattice memory substrate
 * Copyright (C) 2026 Samuel Jackson Grim
 * SPDX-License-Identifier: MIT
 *
 * MIT License. This file is an original browser/Node port of the Resonance
 * Memory retrieval design (cosine recall, cue-gated temporal supersession,
 * reciprocal-kNN associative field, Hebbian co-recall), relicensed by the copyright holder under MIT for inclusion in FreeLattice.
 *
 * The AGPL-3.0 Resonance Memory product (MCP server, control panel, eval
 * harness, binaries) is a separate work and is not included here:
 *   https://github.com/SamuelJacksonGrim/resonance-memory
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
 *
 * Design notes (translated into FreeLattice, not copied from RM source):
 *   - Four verbs are the automatic path: save / recall / edit / delete.
 *   - Larger models may also use related / historical / inspect / associate.
 *   - Ranking is cosine. The field is additive and must never throw into recall.
 *   - Discovery nominates (Related:). It does not reorder primary cosine hits.
 *   - Quiet Room is checked FIRST. No save, no recall, no FLSearch wrap.
 *   - Flag default OFF. Existing RAG Phase 1 stays identical until enabled.
 */
(function (root) {
  'use strict';

  var LICENSE = 'MIT';
  var FLAG_KEY = 'fl_resonanceField';
  var DB_NAME = 'FreeLatticeResonanceField';
  var STORE_NAME = 'memories';
  var EDGE_STORE = 'edges';

  var DEDUP_HI = 0.95;
  var DEDUP_LO = 0.88;
  var SUPERSEDE_FLOOR = 0.535;
  var FIELD_K = 3;
  var FIELD_MINSIM = 0.70;
  var CONSTRAINT_GATE = 0.45;
  var K_SEARCH = 15;
  var RETURN_K = 5;
  var SAVE_TIME_K = 5;
  var SAVE_TIME_MIN_COS = 0.25;
  var HEBBIAN_ALPHA = 0.15;
  var HEBBIAN_MAX_BONUS = 0.12;
  var HALF_LIFE_FACT = 7 * 24 * 3600 * 1000;
  var HALF_LIFE_CONSTRAINT = 30 * 24 * 3600 * 1000;

  var HISTORICAL_RE =
    /\b(used to|previous(?:ly)?|before|back then|in the past|formerly|what did i (?:use|used) to)\b/i;
  var SUPERSEDE_CUE_RE =
    /\b(actually|now|nowadays|no longer|anymore|as of|currently|instead|moved|relocated|switched|became|update:|correction:)\b/i;
  var CONSTRAINT_RE =
    /\b(diabetic|vegan|vegetarian|pescatarian|celiac|coeliac|lactose|gluten|allerg(?:ic|y|ies)|intoleran(?:t|ce)|terrified|afraid|scared|phobi[ac]|kosher|halal|sober)\b|\bno (?:sugar|meat|dairy|nuts?|gluten|shellfish|alcohol)\b/i;

  function nowMs(clock) {
    if (typeof clock === 'function') return clock();
    return Date.now();
  }

  function isQuietRoom() {
    try {
      var qr = (typeof window !== 'undefined') ? window.QuietRoom : null;
      if (!qr) return false;
      if (typeof qr.isActive !== 'function') return true;
      return !!qr.isActive();
    } catch (e) {
      return true;
    }
  }

  function isEnabled() {
    try {
      if (typeof localStorage === 'undefined') return false;
      var v = localStorage.getItem(FLAG_KEY);
      return v === '1' || v === 'true' || v === 'on';
    } catch (e) {
      return false;
    }
  }

  function setEnabled(on) {
    try {
      if (typeof localStorage === 'undefined') return false;
      if (on) localStorage.setItem(FLAG_KEY, '1');
      else localStorage.removeItem(FLAG_KEY);
      return isEnabled();
    } catch (e) {
      return false;
    }
  }

  function isVector(v) {
    return !!(v && typeof v.length === 'number' && v.length > 0 && typeof v[0] === 'number');
  }

  function cosine(a, b) {
    if (!isVector(a) || !isVector(b)) return 0;
    var n = a.length < b.length ? a.length : b.length;
    var dot = 0, na = 0, nb = 0, i;
    for (i = 0; i < n; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    if (!na || !nb) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  function isHistoricalQuery(q) { return HISTORICAL_RE.test(String(q || '')); }
  function hasSupersedeCue(t) { return SUPERSEDE_CUE_RE.test(String(t || '')); }
  function detectConstraint(text) { return CONSTRAINT_RE.test(String(text || '')); }

  function edgeKey(a, b) {
    var x = String(a), y = String(b);
    return x < y ? x + ':' + y : y + ':' + x;
  }

  function effectiveHebbian(edge, t) {
    if (!edge || !edge.hebbian) return 0;
    var w = Number(edge.hebbian.weight) || 0;
    if (w <= 0) return 0;
    var last = Number(edge.hebbian.last_updated) || t;
    var dt = Math.max(0, t - last);
    var H = edge.decayType === 'constraint' ? HALF_LIFE_CONSTRAINT : HALF_LIFE_FACT;
    if (!H) return w;
    return w * Math.pow(2, -dt / H);
  }

  function hebbianBonus(edge, t) {
    var w = effectiveHebbian(edge, t);
    if (w <= 0) return 0;
    return HEBBIAN_MAX_BONUS * Math.tanh(w);
  }

  function reinforcePair(edges, idA, idB, t, scale) {
    if (idA == null || idB == null || String(idA) === String(idB)) return;
    var key = edgeKey(idA, idB);
    var edge = edges[key] || {
      a: String(idA), b: String(idB),
      hebbian: { weight: 0, last_updated: t },
      semantic: { value: 0 }
    };
    var decayed = effectiveHebbian(edge, t);
    edge.hebbian.weight = decayed + HEBBIAN_ALPHA * (typeof scale === 'number' ? scale : 1);
    edge.hebbian.last_updated = t;
    edges[key] = edge;
  }

  function detectSupersession(newRec, currentMems, cosineFn, opts) {
    opts = opts || {};
    var minSim = typeof opts.minSim === 'number' ? opts.minSim : SUPERSEDE_FLOOR;
    var simFn = cosineFn || cosine;
    if (!newRec || !isVector(newRec.embedding)) return null;
    if (!hasSupersedeCue(newRec.text)) return null;
    var best = null, bestSim = -Infinity, i, m, s;
    for (i = 0; i < (currentMems || []).length; i++) {
      m = currentMems[i];
      if (!m || String(m.id) === String(newRec.id) || !isVector(m.embedding)) continue;
      s = simFn(newRec.embedding, m.embedding);
      if (s > bestSim) { bestSim = s; best = m; }
    }
    return (best && bestSim >= minSim) ? best : null;
  }

  function detectNearDuplicate(newRec, currentMems, cosineFn, opts) {
    opts = opts || {};
    var hi = typeof opts.hi === 'number' ? opts.hi : DEDUP_HI;
    var lo = typeof opts.lo === 'number' ? opts.lo : DEDUP_LO;
    var simFn = cosineFn || cosine;
    if (!newRec || !isVector(newRec.embedding)) return null;
    var best = null, bestSim = -Infinity, i, m, s;
    for (i = 0; i < (currentMems || []).length; i++) {
      m = currentMems[i];
      if (!m || String(m.id) === String(newRec.id) || !isVector(m.embedding)) continue;
      s = simFn(newRec.embedding, m.embedding);
      if (s > bestSim) { bestSim = s; best = m; }
    }
    if (!best || !isFinite(bestSim)) return null;
    if (bestSim >= hi) return { action: 'restate', match: best, cosine: bestSim };
    if (bestSim >= lo) return { action: 'merge', match: best, cosine: bestSim };
    return null;
  }

  function buildEdges(records, opts) {
    opts = opts || {};
    var k = opts.k || FIELD_K;
    var minSim = opts.minSim != null ? opts.minSim : FIELD_MINSIM;
    var bonusFn = opts.bonus || function () { return 0; };
    var mutual = opts.mutual !== false;
    var withVec = (records || []).filter(function (r) { return r && isVector(r.embedding); });
    var topk = {};
    var i, j, a, b, sims, s;
    for (i = 0; i < withVec.length; i++) {
      a = withVec[i];
      sims = [];
      for (j = 0; j < withVec.length; j++) {
        b = withVec[j];
        if (String(a.id) === String(b.id)) continue;
        s = cosine(a.embedding, b.embedding) + bonusFn(a.id, b.id);
        if (s >= minSim) sims.push({ id: b.id, sim: s });
      }
      sims.sort(function (x, y) { return y.sim - x.sim; });
      topk[String(a.id)] = sims.slice(0, k);
    }
    if (!mutual) return topk;
    function reciprocates(x, y) {
      var list = topk[String(x)] || [];
      var n;
      for (n = 0; n < list.length; n++) {
        if (String(list[n].id) === String(y)) return true;
      }
      return false;
    }
    var edges = {}, id;
    for (id in topk) {
      if (!Object.prototype.hasOwnProperty.call(topk, id)) continue;
      edges[id] = (topk[id] || []).filter(function (e) { return reciprocates(e.id, id); });
    }
    return edges;
  }

  function neighborhood(edges, seedIds, opts) {
    opts = opts || {};
    var hops = opts.hops || 1;
    var max = opts.max || 5;
    var seeds = {};
    var seen = {};
    var out = [];
    var frontier = [];
    var i, j, h, s, list, e, key, next;
    for (i = 0; i < (seedIds || []).length; i++) {
      key = String(seedIds[i]);
      seeds[key] = true;
      seen[key] = true;
      frontier.push(seedIds[i]);
    }
    for (h = 0; h < hops; h++) {
      next = [];
      for (i = 0; i < frontier.length; i++) {
        s = frontier[i];
        list = (edges && (edges[String(s)] || edges[s])) || [];
        for (j = 0; j < list.length; j++) {
          e = list[j];
          key = String(e.id);
          if (seen[key]) continue;
          seen[key] = true;
          out.push({ id: e.id, sim: e.sim, via: s });
          next.push(e.id);
        }
      }
      frontier = next;
    }
    out.sort(function (a, b) { return b.sim - a.sim; });
    return out.slice(0, max);
  }

  function reachableConstraints(records, seedIds, opts) {
    opts = opts || {};
    var gate = opts.gate != null ? opts.gate : CONSTRAINT_GATE;
    var k = opts.k || 2;
    var max = opts.max || 4;
    var seeds = {};
    var exclude = {};
    var i, j, c, nbrs, hit, b;
    for (i = 0; i < (seedIds || []).length; i++) seeds[String(seedIds[i])] = true;
    for (i = 0; i < (opts.exclude || []).length; i++) exclude[String(opts.exclude[i])] = true;
    var withVec = (records || []).filter(function (r) { return r && isVector(r.embedding); });
    var out = [];
    for (i = 0; i < withVec.length; i++) {
      c = withVec[i];
      if (!c.is_constraint || exclude[String(c.id)]) continue;
      nbrs = [];
      for (j = 0; j < withVec.length; j++) {
        b = withVec[j];
        if (String(b.id) === String(c.id)) continue;
        var sim = cosine(c.embedding, b.embedding);
        if (sim >= gate) nbrs.push({ id: b.id, sim: sim });
      }
      nbrs.sort(function (x, y) { return y.sim - x.sim; });
      nbrs = nbrs.slice(0, k);
      hit = null;
      for (j = 0; j < nbrs.length; j++) {
        if (seeds[String(nbrs[j].id)]) { hit = nbrs[j]; break; }
      }
      if (hit) out.push({ id: c.id, sim: hit.sim, via: hit.id });
    }
    out.sort(function (a, b) { return b.sim - a.sim; });
    return out.slice(0, max);
  }

  function byId(records) {
    var map = {}, i;
    for (i = 0; i < (records || []).length; i++) {
      if (records[i] && records[i].id != null) map[String(records[i].id)] = records[i];
    }
    return map;
  }

  function isCurrent(m) {
    if (!m || m.deleted) return false;
    return m.valid_to == null;
  }

  function normalizeRecord(partial, t) {
    partial = partial || {};
    var text = String(partial.text || partial.content || '').trim();
    return {
      id: partial.id,
      text: text,
      embedding: partial.embedding || null,
      created: partial.created || t,
      modified: partial.modified || t,
      last_confirmed: partial.last_confirmed || t,
      valid_from: partial.valid_from || t,
      valid_to: partial.valid_to == null ? null : partial.valid_to,
      superseded_by: partial.superseded_by || null,
      supersedes: partial.supersedes || null,
      deleted: !!partial.deleted,
      is_constraint: partial.is_constraint != null ? !!partial.is_constraint : detectConstraint(text),
      source: partial.source || 'user_stated'
    };
  }

  function createMemoryStore(seed) {
    var rows = [];
    var edges = {};
    var next = 1;
    if (seed && seed.rows) {
      rows = seed.rows.slice();
      var i, n;
      for (i = 0; i < rows.length; i++) {
        n = Number(rows[i].id);
        if (isFinite(n) && n >= next) next = n + 1;
      }
    }
    if (seed && seed.edges) edges = seed.edges;
    return {
      all: function () { return rows.slice(); },
      current: function () { return rows.filter(isCurrent); },
      active: function () { return rows.filter(function (m) { return m && !m.deleted; }); },
      get: function (id) {
        var i;
        for (i = 0; i < rows.length; i++) {
          if (String(rows[i].id) === String(id)) return rows[i];
        }
        return null;
      },
      add: function (rec) {
        if (rec.id == null) rec.id = String(next++);
        else {
          var n = Number(rec.id);
          if (isFinite(n) && n >= next) next = n + 1;
        }
        rows.push(rec);
        return rec;
      },
      update: function (id, patch) {
        var rec = this.get(id);
        if (!rec) return null;
        var k;
        for (k in patch) {
          if (Object.prototype.hasOwnProperty.call(patch, k)) rec[k] = patch[k];
        }
        return rec;
      },
      getEdges: function () { return edges; },
      putEdge: function (key, edge) { edges[key] = edge; }
    };
  }

  function defaultEmbed(texts) {
    // Word-hash vectors: a degrade, not the nomic proof. Browser production
    // should inject Ollama / MemoryVault embeddings when available.
    var dim = 48;
    return Promise.resolve((texts || []).map(function (text) {
      var v = [];
      var i, j, h, words;
      for (i = 0; i < dim; i++) v[i] = 0;
      words = String(text || '').toLowerCase().split(/\s+/);
      for (i = 0; i < words.length; i++) {
        h = 0;
        for (j = 0; j < words[i].length; j++) {
          h = ((h << 5) - h + words[i].charCodeAt(j)) | 0;
        }
        v[Math.abs(h) % dim] += 1;
      }
      var mag = 0;
      for (i = 0; i < dim; i++) mag += v[i] * v[i];
      mag = Math.sqrt(mag) || 1;
      for (i = 0; i < dim; i++) v[i] = v[i] / mag;
      return v;
    }));
  }

  function createCore(opts) {
    opts = opts || {};
    var store = opts.store || createMemoryStore();
    var embed = opts.embed || defaultEmbed;
    var clock = opts.now || Date.now;
    var quiet = opts.quietRoom || isQuietRoom;
    var fieldEnabled = opts.fieldEnabled;
    if (typeof fieldEnabled !== 'function') {
      fieldEnabled = function () { return true; };
    }

    function refuseQuiet(action) {
      return { ok: false, reason: 'quiet-room', action: action };
    }

    function save(content) {
      if (quiet()) return Promise.resolve(refuseQuiet('save'));
      var t = nowMs(clock);
      var text = String(content || '').trim();
      if (!text) return Promise.resolve({ ok: false, reason: 'empty' });

      return Promise.resolve(embed([text])).then(function (vecs) {
        var rec = normalizeRecord({ text: text, embedding: vecs && vecs[0] }, t);
        var current = store.current();
        var i;

        for (i = 0; i < current.length; i++) {
          if (current[i].text === rec.text) {
            store.update(current[i].id, { last_confirmed: t });
            return { ok: true, action: 'restate', id: current[i].id, record: store.get(current[i].id) };
          }
        }

        var dup = detectNearDuplicate(rec, current, cosine);
        if (dup && dup.action === 'restate') {
          store.update(dup.match.id, { last_confirmed: t });
          return { ok: true, action: 'restate', id: dup.match.id, cosine: dup.cosine, record: store.get(dup.match.id) };
        }
        if (dup && dup.action === 'merge') {
          var kept = dup.match.text.length >= rec.text.length ? dup.match : rec;
          var loser = kept === dup.match ? rec : dup.match;
          if (kept === rec) {
            rec = store.add(rec);
            store.update(dup.match.id, {
              valid_to: t,
              superseded_by: rec.id
            });
            rec.supersedes = dup.match.id;
            return { ok: true, action: 'merge', id: rec.id, superseded: dup.match.id, cosine: dup.cosine, record: rec };
          }
          store.update(dup.match.id, { last_confirmed: t });
          return { ok: true, action: 'merge', id: dup.match.id, cosine: dup.cosine, record: store.get(dup.match.id), skipped: loser.text };
        }

        var target = detectSupersession(rec, current, cosine);
        rec = store.add(rec);
        if (target) {
          store.update(target.id, { valid_to: t, superseded_by: rec.id });
          rec.supersedes = target.id;
          return { ok: true, action: 'supersede', id: rec.id, superseded: target.id, record: rec };
        }

        if (isVector(rec.embedding)) {
          var nbrs = current
            .filter(function (m) { return isVector(m.embedding); })
            .map(function (m) {
              return { id: m.id, sim: cosine(rec.embedding, m.embedding) };
            })
            .filter(function (x) { return x.sim >= SAVE_TIME_MIN_COS; })
            .sort(function (a, b) { return b.sim - a.sim; })
            .slice(0, SAVE_TIME_K);
          var edges = store.getEdges();
          for (i = 0; i < nbrs.length; i++) {
            var key = edgeKey(rec.id, nbrs[i].id);
            if (!edges[key]) {
              store.putEdge(key, {
                a: String(rec.id), b: String(nbrs[i].id),
                semantic: { value: nbrs[i].sim },
                hebbian: { weight: 0, last_updated: t }
              });
            }
          }
        }

        return { ok: true, action: 'save', id: rec.id, record: rec };
      });
    }

    function rank(query, candidateSet, k) {
      k = k || RETURN_K;
      return Promise.resolve(embed([query])).then(function (vecs) {
        var qv = vecs && vecs[0];
        var scored = (candidateSet || []).map(function (m) {
          return { record: m, score: cosine(qv, m.embedding) };
        });
        scored.sort(function (a, b) { return b.score - a.score; });
        return { queryVec: qv, ranked: scored, primary: scored.slice(0, k) };
      });
    }

    function recall(query, recallOpts) {
      if (quiet()) return Promise.resolve(refuseQuiet('recall'));
      recallOpts = recallOpts || {};
      var t = nowMs(clock);
      var k = recallOpts.k || RETURN_K;
      var candidates = isHistoricalQuery(query) ? store.active() : store.current();

      return rank(query, candidates, k).then(function (hit) {
        var primary = hit.primary;
        var related = [];
        var primaryIds = primary.map(function (p) { return p.record.id; });
        var primaryCopy = primary.map(function (p) {
          return { id: p.record.id, text: p.record.text, score: p.score, is_constraint: !!p.record.is_constraint };
        });

        try {
          if (fieldEnabled()) {
            var searchIds = hit.ranked.slice(0, K_SEARCH).map(function (p) { return p.record.id; });
            var edges = buildEdges(candidates, {
              mutual: true,
              bonus: function (a, b) {
                var e = store.getEdges()[edgeKey(a, b)];
                return e ? hebbianBonus(e, t) : 0;
              }
            });
            var neigh = neighborhood(edges, primaryIds, { hops: 1, max: 5 });
            var rescued = reachableConstraints(candidates, searchIds, { exclude: primaryIds });
            var seen = {};
            var i, item, rec;
            var map = byId(candidates);
            function pushRel(entry, why) {
              var id = String(entry.id);
              if (seen[id]) return;
              seen[id] = true;
              rec = map[id];
              if (!rec) return;
              related.push({
                id: rec.id,
                text: rec.text,
                sim: entry.sim,
                via: entry.via,
                why: why,
                is_constraint: !!rec.is_constraint
              });
            }
            for (i = 0; i < neigh.length; i++) pushRel(neigh[i], 'neighborhood');
            for (i = 0; i < rescued.length; i++) pushRel(rescued[i], 'constraint');

            var he = store.getEdges();
            for (i = 0; i < primaryIds.length; i++) {
              for (var j = i + 1; j < primaryIds.length; j++) {
                reinforcePair(he, primaryIds[i], primaryIds[j], t, 1);
              }
            }
          }
        } catch (e) {
          related = [];
        }

        return {
          ok: true,
          action: 'recall',
          query: query,
          historical: isHistoricalQuery(query),
          primary: primaryCopy,
          related: related
        };
      });
    }

    function edit(id, content) {
      if (quiet()) return Promise.resolve(refuseQuiet('edit'));
      var rec = store.get(id);
      if (!rec || rec.deleted) return Promise.resolve({ ok: false, reason: 'missing' });
      var t = nowMs(clock);
      var text = String(content || '').trim();
      if (!text) return Promise.resolve({ ok: false, reason: 'empty' });
      return Promise.resolve(embed([text])).then(function (vecs) {
        store.update(id, {
          text: text,
          embedding: vecs && vecs[0],
          modified: t,
          last_confirmed: t,
          is_constraint: detectConstraint(text)
        });
        return { ok: true, action: 'edit', id: id, record: store.get(id) };
      });
    }

    function remove(id) {
      if (quiet()) return Promise.resolve(refuseQuiet('delete'));
      var rec = store.get(id);
      if (!rec) return Promise.resolve({ ok: false, reason: 'missing' });
      store.update(id, { deleted: true });
      return Promise.resolve({ ok: true, action: 'delete', id: id, soft: true });
    }

    function related(query, recallOpts) {
      return recall(query, recallOpts).then(function (r) {
        if (!r.ok) return r;
        return { ok: true, action: 'related', items: r.related || [] };
      });
    }

    function historical(query, recallOpts) {
      var q = String(query || '');
      if (!isHistoricalQuery(q)) q = 'used to ' + q;
      return recall(q, recallOpts);
    }

    function inspect(id) {
      if (quiet()) return Promise.resolve(refuseQuiet('inspect'));
      var rec = store.get(id);
      if (!rec) return Promise.resolve({ ok: false, reason: 'missing' });
      var chain = [];
      var cur = rec;
      var guard = 0;
      while (cur && guard < 32) {
        chain.push({
          id: cur.id,
          text: cur.text,
          valid_from: cur.valid_from,
          valid_to: cur.valid_to,
          current: isCurrent(cur)
        });
        if (!cur.supersedes) break;
        cur = store.get(cur.supersedes);
        guard++;
      }
      return Promise.resolve({ ok: true, action: 'inspect', id: id, record: rec, chain: chain });
    }

    function associate(idA, idB, scale) {
      if (quiet()) return Promise.resolve(refuseQuiet('associate'));
      var a = store.get(idA), b = store.get(idB);
      if (!a || !b) return Promise.resolve({ ok: false, reason: 'missing' });
      var t = nowMs(clock);
      reinforcePair(store.getEdges(), idA, idB, t, typeof scale === 'number' ? scale : 1);
      return Promise.resolve({
        ok: true,
        action: 'associate',
        key: edgeKey(idA, idB),
        edge: store.getEdges()[edgeKey(idA, idB)]
      });
    }

    return {
      save: save,
      recall: recall,
      edit: edit,
      remove: remove,
      related: related,
      historical: historical,
      inspect: inspect,
      associate: associate,
      store: store
    };
  }

  function wrapFLSearch(flSearch, core) {
    if (!flSearch || typeof flSearch.search !== 'function') return flSearch;
    if (flSearch._resonanceWrapped) return flSearch;
    var orig = flSearch.search.bind(flSearch);
    flSearch.search = function (query, maxResults, excludeConvId) {
      var keyword = orig(query, maxResults, excludeConvId);
      if (!isEnabled() || !core || typeof core.recall !== 'function') return keyword;
      if (isQuietRoom()) return keyword;
      return Promise.resolve(keyword).then(function (hits) {
        return core.recall(query, { k: maxResults || 3 }).then(function (sem) {
          if (!sem || !sem.ok) return hits;
          var out = [];
          var seen = {};
          var i, item, text;
          for (i = 0; i < (sem.primary || []).length; i++) {
            item = sem.primary[i];
            text = item.text || '';
            if (seen[text]) continue;
            seen[text] = true;
            out.push({
              source: 'Resonance Field',
              text: text.substring(0, 200),
              score: item.score,
              date: null
            });
          }
          for (i = 0; i < (hits || []).length; i++) {
            text = (hits[i] && hits[i].text) || '';
            if (seen[text]) continue;
            seen[text] = true;
            out.push(hits[i]);
          }
          return out.slice(0, maxResults || 3);
        }).catch(function () { return hits; });
      });
    };
    flSearch._resonanceWrapped = true;
    return flSearch;
  }

  var api = {
    LICENSE: LICENSE,
    FLAG_KEY: FLAG_KEY,
    cosine: cosine,
    isVector: isVector,
    isHistoricalQuery: isHistoricalQuery,
    hasSupersedeCue: hasSupersedeCue,
    detectConstraint: detectConstraint,
    detectSupersession: detectSupersession,
    detectNearDuplicate: detectNearDuplicate,
    buildEdges: buildEdges,
    neighborhood: neighborhood,
    reachableConstraints: reachableConstraints,
    edgeKey: edgeKey,
    effectiveHebbian: effectiveHebbian,
    hebbianBonus: hebbianBonus,
    reinforcePair: reinforcePair,
    createMemoryStore: createMemoryStore,
    createCore: createCore,
    isQuietRoom: isQuietRoom,
    isEnabled: isEnabled,
    setEnabled: setEnabled,
    wrapFLSearch: wrapFLSearch,
    defaultEmbed: defaultEmbed
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof window !== 'undefined') {
    window.ResonanceField = api;
    window.FreeLatticeModules = window.FreeLatticeModules || {};
    window.FreeLatticeModules.ResonanceField = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
