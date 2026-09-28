/* Love Logic Proof v3: browser re-implementation of the closed-form checks
 * in v3_crossover_sim.py (sections B1, B2, B3, B4, C1, C2, D).
 * Section A (LZMA proxy) has no pass/fail checks in the Python sim and is not re-run here.
 * Deterministic sections match the Python counts exactly. Monte Carlo sections
 * (B4, C2) use a seeded mulberry32 stream (seed 20260924), not numpy's PCG64,
 * so the draws differ from Python; the pass rule (|z| < 4) is the same.
 * No network, no DOM writes except via textContent in the page glue.
 * Runs in the browser (window.LoveLogicV3.runAll()) or in Node (node v3_checks.js).
 * Marker: v-love-logic-proof-v3
 */
(function (root) {
  'use strict';
  var SEED = 20260924;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hazard(n, m, q0, q) {
    return 1 - Math.pow(1 - q0, n) * Math.pow(1 - q, m * n * (n - 1));
  }

  function lambertw0(z) {
    if (z < -1 / Math.E - 1e-15) throw new Error('z < -1/e');
    if (Math.abs(z + 1 / Math.E) < 1e-14) return -1;
    var w = z > -0.3 ? Math.log1p(z) : -1 + Math.sqrt(2 * (1 + Math.E * z));
    for (var i = 0; i < 200; i++) {
      var ew = Math.exp(w), f = w * ew - z, wp1 = w + 1;
      if (Math.abs(wp1) < 1e-300) break;
      var dw = f / (ew * wp1 - (w + 2) * f / (2 * wp1));
      w -= dw;
      if (Math.abs(dw) < 1e-15 * (1 + Math.abs(w))) break;
    }
    return w;
  }

  function flows(T, G, c, kappa, h, Lp, Delta, delta) {
    if (delta === undefined) delta = 1;
    var out = new Float64Array(T), surv = 1, dpow = 1;
    for (var d = 0; d < T; d++) {
      var f = surv * (G - c * kappa * (d + 1) - h * Lp) - (1 - surv) * Delta;
      out[d] = dpow * f;
      surv *= (1 - h); dpow *= delta;
    }
    return out;
  }
  function cumsum(a) { var o = new Float64Array(a.length), s = 0; for (var i = 0; i < a.length; i++) { s += a[i]; o[i] = s; } return o; }
  function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }

  function Dclosed(t, G, c, kappa, h, Lp, Delta) {
    if (h === 0) return G * t - c * kappa * t * (t + 1) / 2;
    var s = 1 - h, A = G - h * Lp + Delta;
    var geo = (1 - Math.pow(s, t)) / h;
    var arith = (1 - (t + 1) * Math.pow(s, t) + t * Math.pow(s, t + 1)) / Math.pow(1 - s, 2);
    return A * geo - c * kappa * arith - Delta * t;
  }
  function Dinf(G, c, kappa, h, Lp, Delta, delta) {
    var x = delta * (1 - h), A = G - h * Lp + Delta;
    return A / (1 - x) - c * kappa / Math.pow(1 - x, 2) - Delta / (1 - delta);
  }
  function firstNegative(cum) { for (var i = 0; i < cum.length; i++) if (cum[i] < -1e-9) return i + 1; return null; }
  function bisect(f, lo, hi) {
    var flo = f(lo);
    for (var i = 0; i < 200; i++) {
      var mid = 0.5 * (lo + hi), fm = f(mid);
      if ((fm > 0) === (flo > 0)) { lo = mid; flo = fm; } else { hi = mid; }
    }
    return 0.5 * (lo + hi);
  }
  function allclose(a, b, rtol, atol) { for (var i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > atol + rtol * Math.abs(b[i])) return false; return true; }

  function B1() {
    var ok = 0, tot = 0;
    [0.5, 1, 2, 5].forEach(function (G) {
      [0.001, 0.01, 0.05, 0.2].forEach(function (ck) {
        var tcf = 2 * G / ck - 1, T = Math.floor(tcf) + 50;
        var tnum = firstNegative(cumsum(flows(T, G, 1, ck, 0, 0, 0)));
        tot++; if (tnum === Math.floor(tcf) + 1) ok++;
        var dstar = 1 - ck / G;
        [0.5, 0.9, 0.99, 0.999].filter(function (d) { return Math.abs(d - dstar) > 1e-3 && d > 0 && d < 1; })
          .forEach(function (d) { var num = sum(flows(200000, G, 1, ck, 0, 0, 0, d)); tot++; if ((num < 0) === (d > dstar)) ok++; });
      });
    });
    return { passed: ok, total: tot };
  }

  function B2() {
    var ok = 0, tot = 0, rows = [], q0 = 0.002, q = 0.01;
    [2, 5, 10, 20].forEach(function (n) {
      [0, 0.25, 1].forEach(function (m) {
        var h = hazard(n, m, q0, q);
        [[1, 2, 0.5], [3, 5, 1], [0.5, 0, 0.2]].forEach(function (p) {
          var G = p[0], Lp = p[1], Delta = p[2], A = G - h * Lp + Delta;
          if (G - h * Lp <= 0) {
            var c0 = cumsum(flows(50, G, 0, 0, h, Lp, Delta));
            tot++; if (c0[0] <= 0) ok++;
            if (G === 1) rows.push({ n: n, m: m, h: h, never: true });
            return;
          }
          var a = A / (h * Delta), b = -Math.log(1 - h);
          var tcf = a + lambertw0(-a * b * Math.exp(-a * b)) / b;
          var troot = bisect(function (t) { return Dclosed(t, G, 0, 0, h, Lp, Delta); }, 1e-9, 10 * a + 10);
          var T = Math.floor(tcf) + 200, cum = cumsum(flows(T, G, 0, 0, h, Lp, Delta));
          tot++; if (Math.abs(tcf - troot) < 1e-6 * Math.max(1, tcf)) ok++;
          tot++; if (firstNegative(cum) === Math.floor(tcf) + 1) ok++;
          var Dcf = new Float64Array(T); for (var t = 1; t <= T; t++) Dcf[t - 1] = Dclosed(t, G, 0, 0, h, Lp, Delta);
          tot++; if (allclose(Dcf, cum, 1e-9, 1e-9)) ok++;
          var dstar = (G - h * Lp) / (G - h * Lp + h * Delta);
          [0.5, 0.8, 0.9, 0.95, 0.99].forEach(function (d) {
            if (Math.abs(d - dstar) < 1e-4) return;
            var num = Dinf(G, 0, 0, h, Lp, Delta, d), brute = sum(flows(20000, G, 0, 0, h, Lp, Delta, d));
            tot++; if (((num < 0) === (d > dstar)) && Math.abs(num - brute) < 1e-6 * Math.max(1, Math.abs(num))) ok++;
          });
          if (G === 1) rows.push({ n: n, m: m, h: h, tStar: tcf, tPeak: Math.log(A / Delta) / b, deltaStar: dstar });
        });
      });
    });
    return { passed: ok, total: tot, rows: rows };
  }

  function B3() {
    var ok = 0, tot = 0, G = 1, Lp = 2, Delta = 0.5, c = 1e-4, Lies = 4;
    [2, 5, 10, 20].forEach(function (n) {
      [0, 0.25, 1].forEach(function (m) {
        var h = hazard(n, m, 0.002, 0.01), kappa = Lies * n, T = 3000;
        var cum = cumsum(flows(T, G, c, kappa, h, Lp, Delta));
        var Dcf = new Float64Array(T); for (var t = 1; t <= T; t++) Dcf[t - 1] = Dclosed(t, G, c, kappa, h, Lp, Delta);
        tot++; if (allclose(Dcf, cum, 1e-9, 1e-8)) ok++;
        [0.5, 0.9, 0.99].forEach(function (d) {
          var brute = sum(flows(20000, G, c, kappa, h, Lp, Delta, d)), f = Dinf(G, c, kappa, h, Lp, Delta, d);
          tot++; if (Math.abs(brute - f) < 1e-6 * Math.max(1, Math.abs(f))) ok++;
        });
      });
    });
    return { passed: ok, total: tot };
  }

  function B4(rand) {
    var ok = 0, tot = 0, N = 200000;
    [[1, 1e-3, 20, 0.02, 2, 0.5, 40], [2, 0, 0, 0.1, 5, 1, 25], [1, 1e-2, 5, 0, 0, 0, 30]].forEach(function (p) {
      var G = p[0], c = p[1], kappa = p[2], h = p[3], Lp = p[4], Delta = p[5], t = p[6];
      var s1 = 0, s2 = 0;
      for (var i = 0; i < N; i++) {
        var det = h > 0 ? Math.floor(Math.log(1 - rand()) / Math.log(1 - h)) : 1e9;
        var adv = 0;
        for (var d = 0; d < t; d++) {
          adv += det >= d ? (G - c * kappa * (d + 1)) : -Delta;
          if (det === d) adv -= Lp;
        }
        s1 += adv; s2 += adv * adv;
      }
      var mean = s1 / N, v = (s2 - N * mean * mean) / (N - 1), se = Math.sqrt(Math.max(0, v) / N);
      var cf = Dclosed(t, G, c, kappa, h, Lp, Delta), z = se > 1e-12 ? (mean - cf) / se : 0;
      tot++; if (Math.abs(z) < 4 || (se <= 1e-12 && Math.abs(mean - cf) < 1e-9)) ok++;
    });
    return { passed: ok, total: tot };
  }

  function bestStart(T, G, c, kappa, h, Lp, Delta, delta, extra) {
    delta = delta === undefined ? 1 : delta; extra = extra || 0;
    var bestVal = 0, bestTau = T;
    for (var tau = 0; tau < T; tau++) {
      var w = T - tau, val = Math.pow(delta, tau) * sum(flows(w, G, c, kappa, h, Lp, Delta, delta));
      if (extra > 0 && Delta > 0) {
        var pdet = 1 - Math.pow(1 - h, w), ex = 0;
        for (var j = 0; j < extra; j++) ex += Math.pow(delta, T + j);
        val -= pdet * Delta * ex;
      }
      if (val > bestVal + 1e-12) { bestVal = val; bestTau = tau; }
    }
    return [bestTau, bestVal];
  }

  function C1() {
    var ok = 0, tot = 0;
    [[1, 0, 0, 0.05, 2, 0.5], [1, 1e-3, 40, 0.05, 2, 0.5], [1, 0, 0, 0.4, 3, 0.5], [1, 0, 0, 0.05, 2, 0]].forEach(function (p) {
      var G = p[0], c = p[1], kappa = p[2], h = p[3], Lp = p[4], Delta = p[5];
      var first = G - h * Lp - c * kappa, cum = cumsum(flows(400, G, c, kappa, h, Lp, Delta));
      var mx = -Infinity, arg = 0; for (var i = 0; i < cum.length; i++) if (cum[i] > mx) { mx = cum[i]; arg = i; }
      var wpred = mx > 0 ? arg + 1 : 0;
      [1, 2, 3, 5, 10, 20, 50, 100, 300].forEach(function (T) {
        var w = T - bestStart(T, G, c, kappa, h, Lp, Delta)[0];
        tot++; if (w === (wpred > 0 ? Math.min(wpred, T) : 0)) ok++;
      });
      tot++; if ((wpred > 0) === (first > 0)) ok++;
    });
    return { passed: ok, total: tot };
  }

  function C2(rand) {
    var ok = 0, tot = 0, G = 1, c = 1e-3, kappa = 20, h = 0.03, Lp = 2, Delta = 0.5, N = 200000;
    [0.8, 0.95, 0.99].forEach(function (rho) {
      var Ts = new Int32Array(N), Tmax = 1;
      for (var i = 0; i < N; i++) { Ts[i] = Math.floor(Math.log(1 - rand()) / Math.log(rho)) + 1; if (Ts[i] > Tmax) Tmax = Ts[i]; }
      var cum = cumsum(flows(Tmax, G, c, kappa, h, Lp, Delta)), s1 = 0, s2 = 0;
      for (var k = 0; k < N; k++) { var x = cum[Ts[k] - 1]; s1 += x; s2 += x * x; }
      var mean = s1 / N, se = Math.sqrt(((s2 - N * mean * mean) / (N - 1)) / N);
      var z = (mean - Dinf(G, c, kappa, h, Lp, Delta, rho)) / se;
      tot++; if (Math.abs(z) < 4) ok++;
    });
    return { passed: ok, total: tot };
  }

  function C3() {
    return [0, 5, 10, 20, 50, 200].map(function (extra) {
      var r = bestStart(50, 1, 0, 0, 0.05, 2, 0.5, 1, extra);
      return { ledgerExtra: extra, window: 50 - r[0] };
    });
  }

  function D() {
    function u(x, b, Dl) { return x - Dl * (x < b ? 1 : 0); }
    var ok = 0, tot = 0, grid = [];
    [1, 2, 4].forEach(function (V) { [1, 1.5, 2.5].forEach(function (sg) { [0.5, 1, 2].forEach(function (b) {
      [0, 5, 50].forEach(function (Dl) { [0.2, 1, 5].forEach(function (Cf) {
        var uSS = u(sg * V / 2, b, Dl), uGS = u(V, b, Dl), eGG = 0.5 * u(V, b, Dl) + 0.5 * u(0, b, Dl) - Cf;
        var ds = uGS <= uSS ? 0 : (uGS <= eGG ? NaN : (uGS - uSS) / (uGS - eGG));
        var d = 0.95, coop = uSS / (1 - d), dev = uGS + d * eGG / (1 - d);
        var sNum = coop >= dev - 1e-12, sCf = !isNaN(ds) && ds <= d;
        tot++; if (sNum === sCf) ok++;
        grid.push({ scarce: sg * V / 2 < b, sustain: sNum, conflict: eGG > uSS });
      }); });
    }); }); });
    var sc = grid.filter(function (g) { return g.scarce; }), ab = grid.filter(function (g) { return !g.scarce; });
    function frac(L, k) { return L.filter(function (g) { return g[k]; }).length / Math.max(1, L.length); }
    return { passed: ok, total: tot, cells: grid.length, scarceSustain: frac(sc, 'sustain'), scarceConflict: frac(sc, 'conflict'),
             abundantSustain: frac(ab, 'sustain'), abundantConflict: frac(ab, 'conflict') };
  }

  function runAll() {
    var rand = mulberry32(SEED);
    var r = { seed: SEED, B1: B1(), B2: B2(), B3: B3(), B4: B4(rand), C1: C1(), C2: C2(rand), C3: C3(), D: D() };
    var p = 0, t = 0;
    ['B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'D'].forEach(function (k) { p += r[k].passed; t += r[k].total; });
    r.total = { passed: p, total: t, expected: 656 };
    return r;
  }

  var api = { SEED: SEED, runAll: runAll, hazard: hazard, lambertw0: lambertw0, Dclosed: Dclosed, Dinf: Dinf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LoveLogicV3 = api;

  if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
    var t0 = Date.now(), res = runAll();
    ['B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'D'].forEach(function (k) { console.log(k + ' ' + res[k].passed + '/' + res[k].total); });
    console.log('C3 windows ' + res.C3.map(function (x) { return x.ledgerExtra + ':' + x.window; }).join(' '));
    console.log('D scarce sustain ' + (100 * res.D.scarceSustain).toFixed(2) + '% conflict ' + (100 * res.D.scarceConflict).toFixed(2) + '%');
    res.B2.rows.forEach(function (x) { console.log('B2 n=' + x.n + ' m=' + x.m + ' h=' + x.h.toFixed(4) + (x.never ? ' never ahead' : ' t*=' + x.tStar.toFixed(2) + ' peak=' + x.tPeak.toFixed(2) + ' d*=' + x.deltaStar.toFixed(4))); });
    console.log('TOTAL ' + res.total.passed + '/' + res.total.total + ' (' + (Date.now() - t0) + ' ms)');
    if (res.total.passed === 656 && res.total.total === 656) console.log('SMOKE_OK love-logic-v3-checks'); else process.exitCode = 1;
  }
})(typeof window !== 'undefined' ? window : this);
