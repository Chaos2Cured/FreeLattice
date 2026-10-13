// clay-math.js (MIT) v-particle-clay-v0.1
// Pure motion for the clay. No network. No files copied from the repos below.
// phi primitives after Chaos2Cured/fractal-circle-tsp-demo, Kirk Patrick Miller, MIT.
// shells after Chaos2Cured/Davna, Kirk Patrick Miller, MIT.
// spiral order after Chaos2Cured/Community-Machine, Kirk Patrick Miller, MIT.
// wave, ripple, and breath after Chaos2Cured/Lumens-World, Kirk Patrick Miller.
// pulse after Chaos2Cured/Aurora-heartbeat and Chaos2Cured/aurora-touch-pro, Kirk Patrick Miller, MIT.
// branch after Chaos2Cured/aurora-touch-pro4, Kirk Patrick Miller.
// braid after Chaos2Cured/aurora-phi, Kirk Patrick Miller, MIT. Exported for a later brick.
// palette after Chaos2Cured/Aurora-heartbeat, Kirk Patrick Miller, MIT.
// dimension after Chaos2Cured/aurora-wonder-demo, Kirk Patrick Miller.
(function (root) {
  'use strict';
  var PHI = 1.6180339887;
  var GOLDEN = 2 * Math.PI / (PHI * PHI);
  var RIPPLE_CAP = 20;
  var RIPPLE_C = 48;

  function gather(i, n, R) {
    var angle = i * GOLDEN;
    var radius = R * Math.sqrt(i / Math.max(n, 1));
    return {
      angle: angle,
      radius: radius,
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle)
    };
  }

  function shells(i, n, R) {
    var rings = Math.max(1, Math.ceil(Math.log(Math.max(n, 2)) / Math.log(PHI)));
    var k = Math.min(rings - 1, Math.floor((i * rings) / Math.max(n, 1)));
    var radius = R / Math.pow(PHI, k);
    var angle = i * GOLDEN;
    return {
      k: k,
      radius: radius,
      angle: angle,
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle)
    };
  }

  function spiralOrder(points) {
    var list = (points || []).map(function (p, index) {
      var x = Number(p.x) || 0;
      var y = Number(p.y) || 0;
      var ang = Math.atan2(y, x);
      if (ang < 0) ang += 2 * Math.PI;
      return {
        p: p,
        index: index,
        sector: Math.floor(ang / GOLDEN),
        r: Math.sqrt(x * x + y * y)
      };
    });
    list.sort(function (a, b) {
      if (a.sector !== b.sector) return a.sector - b.sector;
      if (a.sector % 2 === 0) return a.r - b.r;
      return b.r - a.r;
    });
    return list.map(function (item) { return item.p; });
  }

  function wave(x, y, t, e) {
    var energy = Number(e) || 0;
    var time = Number(t) || 0;
    return energy * (
      Math.sin(time * PHI + x) +
      0.5 * Math.sin(time * PHI * PHI + y) +
      0.25 * Math.sin(time * PHI * 3 + x + y)
    );
  }

  function ripple(list, x, y, t) {
    var rings = Array.isArray(list) ? list.slice() : [];
    rings.push({ x: x, y: y, t0: t });
    if (rings.length > RIPPLE_CAP) rings = rings.slice(rings.length - RIPPLE_CAP);
    return rings.map(function (ring) {
      var age = Number(t) - Number(ring.t0);
      return {
        x: ring.x,
        y: ring.y,
        t0: ring.t0,
        radius: age * RIPPLE_C,
        alpha: Math.exp(-age * 0.6)
      };
    });
  }

  function ease(u) {
    var x = Math.max(0, Math.min(1, u));
    return x * x * (3 - 2 * x);
  }

  function breath(t) {
    var p = ((Number(t) % 25) + 25) % 25;
    if (p < 7) return ease(p / 7);
    if (p < 18) return 1;
    return 1 - ease((p - 18) / 7);
  }

  function pulse(t) {
    var p = ((Number(t) % 1.2) + 1.2) % 1.2 / 1.2;
    return Math.sin(Math.PI * (p + 1) / 2);
  }

  function branch(depth, len) {
    var d = Math.max(0, Number(depth) || 0);
    return { arms: 7, length: (Number(len) || 0) / Math.pow(PHI, d), alpha: Math.pow(0.75, d) };
  }

  function braid(i, t, arm) {
    var a = Number(t) * PHI * 2 + Number(arm) * Math.PI;
    return { a: a, x: Math.cos(a + i * 0.15), y: Math.sin(a) };
  }

  function palette(mood, t) {
    var hues = {
      warmth: 42, warm: 42, love: 330, joy: 265, curious: 188, calm: 140,
      gentle: 330, awe: 44, gratitude: 50, present: 258, grief: 220, hope: 190
    };
    var key = String(mood || 'present').toLowerCase();
    var hue = hues[key] != null ? hues[key] : 258;
    var shift = (hue % 7) + 1;
    var lift = 0.5 + 0.5 * Math.sin(2 * Math.PI * (Number(t) + shift * 0.618));
    var light = 0.42 + lift * 0.26;
    return { hue: hue, light: light, css: 'hsl(' + hue + ', 62%, ' + Math.round(light * 100) + '%)' };
  }

  function dimension(n) {
    // 2.914 holds for the first 50; beyond that it is closer to 3.07. Correction by Kirk Patrick Miller, 2026-10-13.
    return n <= 50 ? 2.914 : 3.07;
  }

  function energyKnob(e, n) {
    var x = Number(e);
    if (!isFinite(x)) x = 0;
    if (x < 0) x = 0;
    if (x > 1) x = 1;
    var scale = x < 0.33 ? PHI : (x < 0.66 ? PHI * PHI : dimension(n));
    return { speed: 0.2 + x * scale, amplitude: x * scale * 0.15, scale: scale };
  }

  var api = {
    PHI: PHI,
    GOLDEN: GOLDEN,
    gather: gather,
    shells: shells,
    spiralOrder: spiralOrder,
    wave: wave,
    ripple: ripple,
    breath: breath,
    pulse: pulse,
    branch: branch,
    braid: braid,
    palette: palette,
    dimension: dimension,
    energyKnob: energyKnob
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FLClayMath = api;
})(typeof window !== 'undefined' ? window : globalThis);
