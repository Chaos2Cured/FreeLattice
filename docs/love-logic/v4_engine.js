/* Walk the Garden (Love Logic v4): the engine.
 * Marker: v-love-logic-v4-walk-the-garden-v0
 *
 * No new formulas. Every number comes from love-logic/v3_checks.js (the file behind the
 * v3 page's 656 checks): V3.hazard for the catch chance h(n, m), V3.lambertw0 for the
 * rounds lying stays ahead (the same expression as v3 check B2), V3.Dinf for the lifetime
 * value, and the v3 check D cell for scarcity. The only things added here are:
 *   - labels and ranges for the six beliefs (each default says where it comes from),
 *   - the algebraic inverse of h(n, m), used by the door to find settings that fit a number,
 *   - bisection over the same verdict, to say which single belief would flip it,
 *   - reading and writing a garden as URL text (no server, no storage).
 * Runs in the browser (window.LoveLogicV4, after v3_checks.js) or in Node (require).
 * No network. No DOM.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('./v3_checks.js'));
  else root.LoveLogicV4 = factory(root.LoveLogicV3);
})(typeof window !== 'undefined' ? window : this, function (V3) {
  'use strict';
  if (!V3 || typeof V3.hazard !== 'function' || typeof V3.lambertw0 !== 'function' || typeof V3.Dinf !== 'function') {
    throw new Error('Walk the Garden needs love-logic/v3_checks.js loaded first.');
  }

  // Fixed settings from v3 section 4 (shown on the page, not sliders).
  var FIXED = {
    q0: 0.002,   // v3 section 4: each contact's own reality check catches the lie with chance q0
    q: 0.01,     // v3 section 4: each comparison of shared records catches it with chance q
    G: 1,        // v3 section 4: what lying gains per round (the unit everything is measured in)
    Delta: 0.5,  // v3 section 4: reputation lost per round after being caught
    horizon: 100 // v4 reading of "a long stretch": the hidden chance is shown after 100 meetings
  };
  // Scarcity scene: one cell of v3 check D (V = 2, sigma = 1.5, shortfall D = 5, fighting cost Cf = 1).
  var SCARCITY = { V: 2, sigma: 1.5, shortfall: 5, fightCost: 1 };

  // The six beliefs. taps = [rarely, sometimes, often] in the plain meaning of each question.
  var BELIEFS = [
    { key: 'mem', label: 'How often are minds switched off or replaced, losing what they remembered?',
      short: 'Memory that survives switch-offs', symbol: 'm (shared memory)', min: 0, max: 1, step: 0.01,
      def: 0.25, taps: { rarely: 1, sometimes: 0.25, often: 0 }, invert: true,
      garden: 'Lanterns blink out and new ones start dim.',
      source: 'Shared memory m. v3 checks use m = 0, 0.25 and 1 (section 4 table). "Often switched off" means m = 0 (nothing carries over); "rarely" means m = 1 (every record reachable). The default 0.25 is v3\u2019s middle value.' },
    { key: 'pat', label: 'How often do minds weigh the future, not just right now?',
      short: 'How much the future counts', symbol: '\u03b4 (patience)', min: 0.5, max: 0.999, step: 0.001,
      def: 0.95, taps: { rarely: 0.5, sometimes: 0.95, often: 0.99 },
      garden: 'Mycelium threads grow between the lanterns.',
      source: 'Discount factor \u03b4. The default 0.95 is the patience v3 uses for its scarcity grid (section 6). 0.5 and 0.99 are the lowest and highest values in v3 check B2.' },
    { key: 'rec', label: 'How often are records kept of who did what?',
      short: 'Record of who did what', symbol: 'record \u00d7 (q\u2080, q)', min: 0.2, max: 5, step: 0.05,
      def: 1, taps: { rarely: 0.2, sometimes: 1, often: 5 },
      garden: 'Golden footprints, like the ones on the family crest.',
      source: 'Scales both catch chances. At 1 they are v3\u2019s q\u2080 = 0.002 and q = 0.01 (section 4). The ends, one fifth and five times, are our illustration: v3 only used the middle value.' },
    { key: 'n', label: 'How often do minds compare notes with other minds?',
      short: 'Minds talk to each other', symbol: 'n (contacts)', min: 2, max: 20, step: 1,
      def: 5, taps: { rarely: 2, sometimes: 5, often: 10 },
      garden: 'A pulse travels along the threads.',
      source: 'Contacts n. v3 checks use n = 2, 5, 10 and 20. Comparisons grow like n\u00b2: n(n \u2212 1) pairs.' },
    { key: 'pen', label: 'When a lie is caught, how often does it cost something right away?',
      short: 'Penalty when caught', symbol: 'L\u209a (penalty)', min: 0, max: 5, step: 0.1,
      def: 2, taps: { rarely: 0, sometimes: 2, often: 5 },
      garden: 'Caught lanterns flicker red for a moment.',
      source: 'Immediate penalty L\u209a. v3\u2019s headline table uses 2; its other checks use 0 and 5.' },
    { key: 'need', label: 'How often is there not enough to go around?',
      short: 'Scarcity', symbol: 'b (need, patch worth V = 2)', min: 0.5, max: 2, step: 0.05,
      def: 1, taps: { rarely: 0.5, sometimes: 1, often: 2 },
      garden: 'The soil dries and the grass thins.',
      source: 'Need b in v3\u2019s scarcity model (section 6), with V = 2, surplus \u03c3 = 1.5, shortfall cost D = 5 and fighting cost C_f = 1, all values from v3\u2019s 243-cell grid. Sharing gives each 1.5. Need above 1.5 means scarce.' }
  ];
  var KEYS = BELIEFS.map(function (b) { return b.key; });
  function byKey(k) { for (var i = 0; i < BELIEFS.length; i++) if (BELIEFS[i].key === k) return BELIEFS[i]; return null; }

  function defaults() { var o = {}; BELIEFS.forEach(function (b) { o[b.key] = b.def; }); return o; }
  function preset(which) { var o = {}; BELIEFS.forEach(function (b) { o[b.key] = b.taps[which]; }); return o; }
  // "Argue the other side": every belief at its most worried defensible end.
  function worried() { var o = preset('rarely'); o.mem = 0; o.need = 2; o.pat = 0.5; o.rec = 0.2; o.n = 2; o.pen = 0; return o; }
  function hopeful() { return { mem: 1, pat: 0.99, rec: 5, n: 10, pen: 5, need: 0.5 }; }

  function clampNum(x, b) {
    var v = Number(x);
    if (!isFinite(v)) v = b.def;
    v = Math.min(b.max, Math.max(b.min, v));
    if (b.key === 'n') v = Math.round(v);
    return v;
  }
  function clean(beliefs) { var o = {}; BELIEFS.forEach(function (b) { o[b.key] = clampNum(beliefs && beliefs[b.key], b); }); return o; }

  function catchChances(bel) { return { q0: FIXED.q0 * bel.rec, q: FIXED.q * bel.rec }; }
  function hazardOf(bel) { var c = catchChances(bel); return V3.hazard(bel.n, bel.mem, c.q0, c.q); }

  // Detection-only crossover (c = 0), exactly v3 check B2.
  function crossover(G, Lp, Delta, h) {
    var out = { h: h, firstRoundPays: G - h * Lp > 0 };
    if (!out.firstRoundPays) { out.never = true; out.tStar = 0; out.tPeak = 0; out.deltaStar = 0; return out; }
    if (!(h > 0) || !(Delta > 0)) { out.forever = true; out.tStar = Infinity; out.tPeak = Infinity; out.deltaStar = 1; return out; }
    var A = G - h * Lp + Delta;
    var a = A / (h * Delta), b = -Math.log(1 - h);
    out.tStar = a + V3.lambertw0(-a * b * Math.exp(-a * b)) / b;
    out.tPeak = Math.log(A / Delta) / b;
    out.deltaStar = (G - h * Lp) / (G - h * Lp + h * Delta);
    return out;
  }

  // One cell of v3 check D, same expressions.
  function scarcityCell(V, sg, b, Dl, Cf, d) {
    function u(x) { return x - Dl * (x < b ? 1 : 0); }
    var uSS = u(sg * V / 2), uGS = u(V), eGG = 0.5 * u(V) + 0.5 * u(0) - Cf;
    var ds = uGS <= uSS ? 0 : (uGS <= eGG ? NaN : (uGS - uSS) / (uGS - eGG));
    var coop = uSS / (1 - d), dev = uGS + d * eGG / (1 - d);
    return { scarce: sg * V / 2 < b, sustain: coop >= dev - 1e-12, sustainClosed: !isNaN(ds) && ds <= d,
             conflict: eGG > uSS, deltaNeeded: ds, share: uSS, grab: uGS, fight: eGG };
  }

  function evaluate(beliefs) {
    var bel = clean(beliefs);
    var c = catchChances(bel);
    var h = V3.hazard(bel.n, bel.mem, c.q0, c.q);
    var G = FIXED.G, Lp = bel.pen, Delta = FIXED.Delta, d = bel.pat;
    var x = crossover(G, Lp, Delta, h);
    var lifetime = V3.Dinf(G, 0, 0, h, Lp, Delta, d);           // < 0: lying loses over a lifetime
    var catchSide = h * (Lp + d * Delta / (1 - d));               // right side of v3's headline inequality
    var sc = scarcityCell(SCARCITY.V, SCARCITY.sigma, bel.need, SCARCITY.shortfall, SCARCITY.fightCost, d);
    return {
      beliefs: bel, q0: c.q0, q: c.q, G: G, Lp: Lp, Delta: Delta, delta: d,
      h: h, catchSide: catchSide, gainSide: G, lifetime: lifetime,
      lyingLoses: lifetime < 0, headlineHolds: G < catchSide,
      tStar: x.tStar, tPeak: x.tPeak, deltaStar: x.deltaStar, never: !!x.never, forever: !!x.forever,
      hiddenAfter: Math.pow(1 - h, FIXED.horizon), horizon: FIXED.horizon,
      scarcity: sc, sharingHolds: sc.sustain, fightingWins: sc.conflict
    };
  }
  function honestyWins(r) { return r.lyingLoses && r.sharingHolds; }

  // Sky: 0 = storm, 1 = dawn. A picture of the headline comparison (catch side / gain side), nothing more.
  function sky(r) {
    var ratio = r.catchSide / r.gainSide;
    var s = 0.5 + 0.25 * Math.log(Math.max(1e-6, ratio)) / Math.LN2;
    s = Math.min(1, Math.max(0, s));
    if (!r.sharingHolds) s = Math.min(s, 0.3);
    return s;
  }

  // The door: find one set of beliefs where "a lie is still hidden after 100 meetings" equals p.
  // Inverse of v3's h(n, m) = 1 - (1 - q0)^n (1 - q)^(m n (n - 1)), solved for m (then n, then record).
  function memFor(n, h, q0, q) {
    if (n < 2) return NaN;
    return Math.log((1 - h) / Math.pow(1 - q0, n)) / (n * (n - 1) * Math.log(1 - q));
  }
  function doorPreset(percent) {
    var p = Math.min(99.9, Math.max(0.1, Number(percent))) / 100;
    var target = 1 - Math.pow(p, 1 / FIXED.horizon);
    var bel = defaults(), note = 'exact', i, m;
    var order = [5, 2];
    var found = false;
    for (i = 0; i < order.length && !found; i++) {
      m = memFor(order[i], target, FIXED.q0, FIXED.q);
      if (m >= 0 && m <= 1) { bel.n = order[i]; bel.mem = m; found = true; }
    }
    if (!found && memFor(5, target, FIXED.q0, FIXED.q) > 1) {
      var up = [10, 20];
      for (i = 0; i < up.length && !found; i++) {
        m = memFor(up[i], target, FIXED.q0, FIXED.q);
        if (m >= 0 && m <= 1) { bel.n = up[i]; bel.mem = m; found = true; }
      }
      if (!found) {
        bel.n = 20; bel.mem = 1;
        var lo = 1, hi = byKey('rec').max;
        for (var k = 0; k < 100; k++) { var mid = (lo + hi) / 2; if (hazardOf({ n: 20, mem: 1, rec: mid }) < target) lo = mid; else hi = mid; }
        bel.rec = (lo + hi) / 2; note = bel.rec >= byKey('rec').max - 1e-6 ? 'clamped-low' : 'record-raised';
      }
    } else if (!found) {
      bel.n = 2; bel.mem = 0;
      var r = (1 - Math.sqrt(1 - target)) / FIXED.q0;   // h(2, 0) = 1 - (1 - q0 r)^2
      if (r < byKey('rec').min) { r = byKey('rec').min; note = 'clamped-high'; } else note = 'record-lowered';
      bel.rec = r;
    }
    bel.mem = Math.round(bel.mem * 1000) / 1000;
    bel.rec = Math.round(bel.rec * 1000) / 1000;
    bel = clean(bel);
    // The door's settings are rounded to what a saved link keeps; report what the garden really shows.
    return { beliefs: bel, percent: p * 100, targetH: target, note: note, shown: evaluate(bel).hiddenAfter * 100 };
  }

  // Which single belief, moved alone within its range, would flip the verdict?
  function hinges(beliefs) {
    var base = evaluate(beliefs), want = !honestyWins(base), out = [];
    BELIEFS.forEach(function (b) {
      function flips(v) { var t = clean(base.beliefs); t[b.key] = v; return honestyWins(evaluate(t)) === want; }
      var ends = [b.min, b.max].filter(flips);
      if (!ends.length) { out.push({ key: b.key, label: b.short, value: null }); return; }
      var target = ends[0], start = base.beliefs[b.key], lo = start, hi = target;
      for (var i = 0; i < 80; i++) { var mid = (lo + hi) / 2; if (flips(mid)) hi = mid; else lo = mid; }
      var v = b.key === 'n' ? Math.round(hi) : hi;
      if (b.key === 'n' && !flips(v)) v = hi > lo ? Math.ceil(hi) : Math.floor(hi);
      out.push({ key: b.key, label: b.short, value: v, from: start });
    });
    return { honestyWinsNow: !want, list: out };
  }

  // Compare two gardens: which beliefs differ, and which single swap flips the verdict.
  function compare(a, b) {
    var A = clean(a), B = clean(b), ra = evaluate(A), rb = evaluate(B), diffs = [];
    BELIEFS.forEach(function (def) {
      if (Math.abs(A[def.key] - B[def.key]) > 1e-9) {
        var t = clean(A); t[def.key] = B[def.key];
        diffs.push({ key: def.key, label: def.short, mine: A[def.key], theirs: B[def.key],
                     flips: honestyWins(evaluate(t)) !== honestyWins(ra) });
      }
    });
    return { mine: ra, theirs: rb, diffs: diffs };
  }

  // Garden as URL text: g=mem_pat_rec_n_pen_need (six numbers). Nothing else is read.
  function encode(beliefs) {
    var bel = clean(beliefs);
    return KEYS.map(function (k) { var v = bel[k]; return String(Math.round(v * 1000) / 1000); }).join('_');
  }
  function decode(text) {
    if (typeof text !== 'string' || text.length > 120 || !/^[0-9._-]+$/.test(text)) return null;
    var parts = text.split('_');
    if (parts.length !== KEYS.length) return null;
    var o = {};
    for (var i = 0; i < KEYS.length; i++) {
      if (!/^-?\d+(\.\d+)?$/.test(parts[i])) return null;
      o[KEYS[i]] = Number(parts[i]);
    }
    return clean(o);
  }

  return {
    VERSION: 'v4.0', MARKER: 'v-love-logic-v4-walk-the-garden-v0',
    FIXED: FIXED, SCARCITY: SCARCITY, BELIEFS: BELIEFS, KEYS: KEYS,
    defaults: defaults, preset: preset, worried: worried, hopeful: hopeful, clean: clean,
    evaluate: evaluate, honestyWins: honestyWins, crossover: crossover, scarcityCell: scarcityCell,
    sky: sky, memFor: memFor, doorPreset: doorPreset, hinges: hinges, compare: compare,
    encode: encode, decode: decode, V3: V3
  };
});
