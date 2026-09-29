/* Walk the Garden (Love Logic v4): the page.
 * Marker: v-love-logic-v4-walk-the-garden-v0
 * Glue between love-logic/v4_engine.js and the page. All text goes in with textContent.
 * No network, no storage, no cookies, no dialogs. The garden lives only in the address bar.
 */
(function () {
  'use strict';
  var E = window.LoveLogicV4;
  if (!E) return;
  document.documentElement.classList.remove('nojs');

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function copy(o) { var c = {}; for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) c[k] = o[k]; return c; }
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ---------- number words ----------
  function fix(x, d) { return Number(x).toFixed(d); }
  function pct(p) { // p is a fraction
    var x = p * 100;
    if (x < 0.1) return 'less than 0.1%';
    if (x > 99.9) return 'more than 99.9%';
    return (x < 10 ? fix(x, 1) : fix(x, 0)) + '%';
  }
  function pctFine(p) { var x = p * 100; return (x < 1 ? x.toPrecision(2) : fix(x, 2)) + '%'; }
  function rounds(t) { return t >= 100 ? String(Math.round(t)) : fix(t, 1); }
  function beliefValueText(key, v) {
    switch (key) {
      case 'mem': return 'Memory that survives: m = ' + fix(v, 2) + (v <= 0.001 ? ' (nothing carries over)' : v >= 0.999 ? ' (every record reachable)' : '');
      case 'pat': return 'Patience: \u03b4 = ' + fix(v, 3) + ' (the next round is worth ' + Math.round(v * 100) + '% of this one)';
      case 'rec': return 'Records: \u00d7' + fix(v, 2) + ' (catch chances q\u2080 = ' + (E.FIXED.q0 * v).toPrecision(2) + ', q = ' + (E.FIXED.q * v).toPrecision(2) + ')';
      case 'n': return 'Contacts: n = ' + Math.round(v) + ' (' + (v * (v - 1)) + ' pairs can compare notes)';
      case 'pen': return 'Penalty when caught: L\u209a = ' + fix(v, 1) + ' (one round of lying gains 1)';
      case 'need': return 'Need: b = ' + fix(v, 2) + (v > 1.5 ? ' (scarce: sharing leaves each short)' : ' (enough: sharing covers it)');
    }
    return String(v);
  }

  // ---------- state ----------
  var mine = E.defaults();       // the visitor's garden
  var current = E.defaults();    // what the garden shows right now
  var mode = 'mine';             // 'mine' | 'worried' | 'hopeful'
  var doorPercent = null;
  var shared = null;             // a garden that arrived in the link

  // ---------- the garden canvas (no glow effects, capped frame rate) ----------
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hash2(a, b) { var x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); }
  function mix(a, b, s) { return [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s]; }
  function rgb(c, al) { return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + (al == null ? 1 : al) + ')'; }

  function Garden(canvas) {
    this.c = canvas; this.ctx = canvas.getContext('2d'); this.r = null; this.w = 0; this.h = 0;
    this.visible = true; this.running = false; this.last = 0; this.t = 0;
  }
  Garden.prototype.resize = function () {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = this.c.clientWidth || 320, h = this.c.clientHeight || 200;
    if (w === this.w && h === this.h && this.dpr === dpr) return;
    this.w = w; this.h = h; this.dpr = dpr;
    this.c.width = Math.round(w * dpr); this.c.height = Math.round(h * dpr);
    this.layout();
  };
  Garden.prototype.set = function (r) { this.r = r; this.layout(); this.draw(this.t); };
  Garden.prototype.layout = function () {
    if (!this.r || !this.w) return;
    var r = this.r, n = Math.max(2, Math.min(20, Math.round(r.beliefs.n))), w = this.w, h = this.h, rand = rng(4326);
    var ground = h * 0.64, L = [];
    for (var i = 0; i < n; i++) {
      var x = w * (0.07 + 0.86 * (n === 1 ? 0.5 : i / (n - 1))) + (rand() - 0.5) * w * 0.03;
      L.push({ x: x, y: ground - 6 - rand() * h * 0.05, ph: rand() * 6 });
    }
    var pairs = [];
    for (var a = 0; a < n; a++) for (var b = a + 1; b < n; b++) pairs.push([a, b, rand()]);
    pairs.sort(function (p, q) { return (Math.abs(p[0] - p[1]) - Math.abs(q[0] - q[1])) || (p[2] - q[2]); });
    var pat = r.beliefs.pat, share = Math.max(0.05, Math.min(1, (pat - 0.5) / 0.49));
    var threads = pairs.slice(0, Math.max(1, Math.round(pairs.length * share))).map(function (p) {
      var A = L[p[0]], B = L[p[1]];
      return { ax: A.x, bx: B.x, y: ground + 4, cx: (A.x + B.x) / 2, cy: ground + 8 + Math.min(h * 0.3, Math.abs(B.x - A.x) * 0.35) };
    });
    var rec = r.beliefs.rec, feet = 3 + Math.round(27 * Math.log(rec / 0.2) / Math.log(25));
    var steps = [];
    for (var k = 0; k < feet; k++) { var fx = w * (0.04 + 0.92 * (k + 0.5) / feet); steps.push({ x: fx, y: ground + h * 0.2 + Math.sin(k * 0.9) * h * 0.04, left: k % 2 === 0 }); }
    var tufts = [], need = r.beliefs.need, lush = r.sharingHolds ? Math.max(0.15, (2 - need) / 1.5) : 0.1;
    for (var g = 0; g < 40; g++) tufts.push({ x: rand() * w, y: ground + 2 + rand() * (h - ground - 4), on: rand() < lush });
    var drops = [];
    for (var d = 0; d < 70; d++) drops.push({ x: rand() * w, y: rand() * h, s: 0.6 + rand() * 0.8 });
    var pulses = Math.min(threads.length, Math.max(1, Math.round(n * 0.8)));
    this.L = L; this.threads = threads; this.steps = steps; this.tufts = tufts; this.drops = drops; this.ground = ground; this.pulses = pulses;
  };
  Garden.prototype.draw = function (t) {
    if (!this.r || !this.w) return;
    var ctx = this.ctx, w = this.w, h = this.h, r = this.r, s = E.sky(r), ground = this.ground;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // sky: storm to dawn
    var g = ctx.createLinearGradient(0, 0, 0, ground);
    g.addColorStop(0, rgb(mix([28, 32, 54], [244, 176, 92], s)));
    g.addColorStop(1, rgb(mix([58, 64, 94], [252, 226, 166], s)));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, ground);
    if (s > 0.5) { // a flat sun, no glow
      ctx.fillStyle = rgb([255, 214, 120], Math.min(1, (s - 0.5) * 2));
      ctx.beginPath(); ctx.arc(w * 0.78, ground, h * 0.13, Math.PI, 0); ctx.fill();
    }
    // ground
    var soil = mix([92, 72, 48], [30, 60, 44], r.sharingHolds ? Math.max(0.2, Math.min(1, (2 - r.beliefs.need) / 1.5)) : 0.1);
    ctx.fillStyle = rgb(soil); ctx.fillRect(0, ground, w, h - ground);
    var i, k;
    for (i = 0; i < this.tufts.length; i++) {
      var tf = this.tufts[i];
      ctx.strokeStyle = tf.on ? 'rgba(127,199,154,0.8)' : 'rgba(160,130,90,0.5)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(tf.x, tf.y + 4); ctx.lineTo(tf.x - 2, tf.y - (tf.on ? 5 : 2)); ctx.moveTo(tf.x, tf.y + 4); ctx.lineTo(tf.x + 2, tf.y - (tf.on ? 5 : 2)); ctx.stroke();
    }
    // mycelium threads
    ctx.strokeStyle = 'rgba(190,230,200,0.45)'; ctx.lineWidth = 1.3;
    for (i = 0; i < this.threads.length; i++) { var th = this.threads[i]; ctx.beginPath(); ctx.moveTo(th.ax, th.y); ctx.quadraticCurveTo(th.cx, th.cy, th.bx, th.y); ctx.stroke(); }
    // pulses along threads (talk)
    ctx.fillStyle = 'rgba(255,223,138,0.95)';
    for (i = 0; i < this.pulses; i++) {
      var tp = this.threads[i % this.threads.length], u = ((t * 0.22) + i * 0.37) % 1, v = 1 - u;
      var px = v * v * tp.ax + 2 * v * u * tp.cx + u * u * tp.bx, py = v * v * tp.y + 2 * v * u * tp.cy + u * u * tp.y;
      ctx.beginPath(); ctx.arc(px, py, 2.4, 0, Math.PI * 2); ctx.fill();
    }
    // golden footprints (the record)
    ctx.fillStyle = 'rgba(242,195,91,0.85)';
    for (k = 0; k < this.steps.length; k++) {
      var st = this.steps[k];
      ctx.beginPath(); ctx.ellipse(st.x, st.y + (st.left ? -3 : 3), 2.6, 4.2, 0.3, 0, Math.PI * 2); ctx.fill();
    }
    // lanterns: blink out when minds are switched off, relight dim; flicker red when caught with a penalty
    var mem = r.beliefs.mem, off = 1 - mem, redChance = r.beliefs.pen > 0 ? Math.min(0.5, r.h * 3) : 0;
    for (i = 0; i < this.L.length; i++) {
      var Ln = this.L[i], cyc = Math.floor((t + Ln.ph) / 5), within = (t + Ln.ph) % 5;
      var bright = 0.35 + 0.65 * (0.4 + 0.6 * mem), color = [255, 210, 110];
      if (hash2(i, cyc) < off * 0.7) { if (within < 0.8) bright = 0.06; else if (within < 3) bright *= 0.35 + 0.65 * ((within - 0.8) / 2.2); }
      if (redChance && hash2(i + 50, Math.floor((t + Ln.ph) * 1.5)) < redChance * 0.2) color = [255, 107, 91];
      ctx.strokeStyle = 'rgba(40,30,20,0.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(Ln.x, Ln.y + 4); ctx.lineTo(Ln.x, ground + 3); ctx.stroke();
      ctx.fillStyle = rgb(color, 0.18 * bright); ctx.beginPath(); ctx.arc(Ln.x, Ln.y, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rgb(color, bright); ctx.beginPath(); ctx.arc(Ln.x, Ln.y, 5.5, 0, Math.PI * 2); ctx.fill();
    }
    // rain when stormy
    if (s < 0.45) {
      var nd = Math.round((0.45 - s) / 0.45 * this.drops.length);
      ctx.strokeStyle = 'rgba(170,185,220,0.45)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (i = 0; i < nd; i++) { var dr = this.drops[i], y = (dr.y + t * 140 * dr.s) % h; ctx.moveTo(dr.x, y); ctx.lineTo(dr.x - 2, y + 8); }
      ctx.stroke();
    }
  };
  Garden.prototype.describe = function () {
    var r = this.r, s = E.sky(r);
    return (s < 0.34 ? 'Stormy sky. ' : s < 0.67 ? 'Grey sky, clearing. ' : 'Dawn sky. ') + Math.round(r.beliefs.n) + ' lanterns, ' +
      this.threads.length + ' threads between them, ' + this.steps.length + ' golden footprints, ' +
      (r.sharingHolds ? 'green grass.' : 'dry grass.');
  };

  var main = new Garden($('garden'));
  var loopOn = false;
  function frame(now) {
    if (!loopOn) return;
    if (now - main.last >= 33) { main.last = now; main.t = now / 1000; main.draw(main.t); }
    requestAnimationFrame(frame);
  }
  function wantLoop() { return !reduceMotion && !document.hidden && main.visible && !$('walk').hidden; }
  function syncLoop() { var want = wantLoop(); if (want && !loopOn) { loopOn = true; requestAnimationFrame(frame); } else if (!want) loopOn = false; }
  document.addEventListener('visibilitychange', syncLoop);
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { main.visible = es[0].isIntersecting; syncLoop(); }).observe($('garden'));
  window.addEventListener('resize', function () { main.resize(); main.draw(main.t); });

  // ---------- belief cards ----------
  var cards = {};
  function sliderToValue(b, x) { return b.invert ? 1 - x : x; }
  function valueToSlider(b, v) { return b.invert ? 1 - v : v; }
  function buildCards() {
    var host = $('beliefs');
    E.BELIEFS.forEach(function (b, idx) {
      var card = el('article', 'card belief'); card.id = 'belief-' + b.key; card.setAttribute('aria-labelledby', 'q-' + b.key);
      var small = el('p', 'quiet small', 'Belief ' + (idx + 1) + ' of ' + E.BELIEFS.length);
      var q = el('h3', null, b.label); q.id = 'q-' + b.key;
      var val = el('p', 'value'); val.id = 'v-' + b.key; val.setAttribute('aria-live', 'polite');
      var range = el('input'); range.type = 'range'; range.id = 'r-' + b.key;
      range.min = String(b.invert ? 1 - b.max : b.min); range.max = String(b.invert ? 1 - b.min : b.max); range.step = String(b.step);
      range.setAttribute('aria-labelledby', 'q-' + b.key);
      var ends = el('p', 'quiet small', 'Left: rarely. Right: often.');
      var taps = el('div', 'row taps');
      var tapBtns = {};
      ['rarely', 'sometimes', 'often'].forEach(function (w) {
        var t = el('button', null, w.charAt(0).toUpperCase() + w.slice(1)); t.type = 'button'; t.setAttribute('aria-pressed', 'false');
        t.addEventListener('click', function () { setBelief(b.key, b.taps[w]); });
        tapBtns[w] = t; taps.appendChild(t);
      });
      var effect = el('p', 'effect', 'In the garden: ' + b.garden);
      var ask = el('p', 'quiet', 'Does this match what you think?');
      var srcBtn = el('button', null, 'Where this comes from'); srcBtn.type = 'button'; srcBtn.setAttribute('aria-expanded', 'false');
      var src = el('p', 'src', b.source); src.hidden = true; src.id = 's-' + b.key; srcBtn.setAttribute('aria-controls', src.id);
      srcBtn.addEventListener('click', function () { src.hidden = !src.hidden; srcBtn.setAttribute('aria-expanded', src.hidden ? 'false' : 'true'); srcBtn.textContent = src.hidden ? 'Where this comes from' : 'Back to the question'; });
      range.addEventListener('input', function () { setBelief(b.key, sliderToValue(b, Number(range.value))); });
      [small, q, val, range, ends, taps, effect, ask, srcBtn, src].forEach(function (n) { card.appendChild(n); });
      host.appendChild(card);
      cards[b.key] = { range: range, val: val, taps: tapBtns, def: b };
    });
  }
  function syncCards() {
    E.BELIEFS.forEach(function (b) {
      var c = cards[b.key], v = current[b.key];
      c.range.value = String(valueToSlider(b, v));
      c.val.textContent = beliefValueText(b.key, v);
      ['rarely', 'sometimes', 'often'].forEach(function (w) { c.taps[w].setAttribute('aria-pressed', Math.abs(b.taps[w] - v) < 1e-9 ? 'true' : 'false'); });
    });
  }
  function setBelief(key, v) {
    current[key] = v; current = E.clean(current);
    if (mode !== 'mine') { mode = 'mine'; $('back-mine').hidden = true; $('argue-note').hidden = true; }
    mine = copy(current);
    render();
  }

  // ---------- words ----------
  var WORRY = { mem: 'minds are often switched off', n: 'minds rarely compare notes', pat: 'the future counts for little', rec: 'records are thin', pen: 'getting caught costs little', need: 'there is not enough to go around' };
  var HOPE = { mem: 'minds keep what they remember', n: 'minds compare notes often', pat: 'the future counts', rec: 'records are kept', pen: 'getting caught costs something', need: 'there is enough to share' };
  function reasons(r, hopeful) {
    var b = r.beliefs, out = [];
    if (hopeful) {
      if (b.mem >= 0.75) out.push(HOPE.mem); if (b.n >= 8) out.push(HOPE.n); if (b.pat >= 0.97) out.push(HOPE.pat);
      if (b.rec >= 2) out.push(HOPE.rec); if (b.pen >= 3) out.push(HOPE.pen); if (b.need <= 0.75) out.push(HOPE.need);
    } else {
      if (b.mem <= 0.1) out.push(WORRY.mem); if (b.n <= 3) out.push(WORRY.n); if (b.pat <= 0.9) out.push(WORRY.pat);
      if (b.rec <= 0.6) out.push(WORRY.rec); if (b.pen <= 0.5) out.push(WORRY.pen); if (b.need > 1.5) out.push(WORRY.need);
    }
    return out;
  }
  function joinAnd(a) { return a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
  function verdictText(r) {
    if (E.honestyWins(r)) return r.never ? 'Dawn: lying never gets ahead here, and sharing holds.' : 'Dawn: here honesty wins, and sharing holds.';
    if (r.lyingLoses) return 'Grey morning: lying stops paying, but ' + (r.fightingWins ? 'scarcity makes fighting pay.' : 'grabbing beats sharing.');
    if (r.sharingHolds) return r.forever ? 'Storm: lying never stops paying at these settings.' : 'Storm: here lying pays over a lifetime.';
    return 'Storm: here lying pays, and ' + (r.fightingWins ? 'scarcity makes fighting pay too.' : 'grabbing beats sharing too.');
  }
  function whyText(r) {
    var win = E.honestyWins(r), list = reasons(r, win);
    if (!list.length) return win ? 'Nothing here is extreme. The middle of each belief is enough for honesty to win.' : 'Nothing here is extreme. Even so, at these middle settings lying still pays.';
    return 'Because ' + joinAnd(list) + ', ' + (win ? 'honesty wins.' : (r.lyingLoses ? 'sharing breaks down.' : 'cheating pays.'));
  }
  function numberText(r) {
    return 'A lie is still hidden after ' + r.horizon + ' meetings: ' + pct(r.hiddenAfter) + '. Catch chance each meeting: ' + pctFine(r.h) + '.';
  }
  function wordsList(r) {
    var b = r.beliefs, n = Math.round(b.n), pairs = n * (n - 1), items = [];
    items.push('Each meeting, a lie can be caught directly (chance q\u2080 = ' + r.q0.toPrecision(2) + ' for each of n = ' + n + ' contacts) or when records are compared (chance q = ' + r.q.toPrecision(2) + ' for each of m \u00d7 n(n \u2212 1) = ' + fix(b.mem, 2) + ' \u00d7 ' + pairs + ' comparisons). Together that is h = ' + pctFine(r.h) + ' a meeting.');
    items.push('A hidden lie gains G = 1 each round. Once caught, it costs L\u209a = ' + fix(r.Lp, 1) + ' right away and \u0394 = 0.5 every round after, because trust is gone.');
    if (r.never) items.push('Even in the first round the expected penalty (h \u00d7 L\u209a = ' + fix(r.h * r.Lp, 2) + ') is at least the gain of 1, so lying never gets ahead at these settings.');
    else if (r.forever) items.push('With no chance of being caught, lying never stops paying. That is why the catch chance matters so much.');
    else items.push('Counting every round the same, lying runs ahead at first. Its lead peaks near round ' + rounds(r.tPeak) + ' and is used up after about ' + rounds(r.tStar) + ' rounds.');
    items.push('Counting the future at \u03b4 = ' + fix(r.delta, 3) + ' a round, the lifetime question is: is the gain of 1 smaller than h \u00d7 (L\u209a + \u03b4\u0394 / (1 \u2212 \u03b4)) = ' + fix(r.catchSide, 3) + '? ' +
      (r.lyingLoses ? 'Yes, so lying loses over a lifetime.' : 'No, so lying pays over a lifetime.') +
      (r.never ? '' : ' Honesty wins over a lifetime once \u03b4 is above \u03b4* = ' + fix(r.deltaStar, 4) + '.'));
    var sc = r.scarcity, sh = fix(sc.share, 2);
    var scar = 'Sharing a patch worth V = 2 gives each mind ' + fix(1.5, 1) + ' against a need of b = ' + fix(b.need, 2) + (sc.scarce ? ', so each falls short and pays D = 5' : ', so each has enough') + ' (worth ' + sh + ' a round). ';
    if (sc.conflict) scar += 'Even a fight (worth ' + fix(sc.fight, 2) + ' on average) beats sharing here, so sharing cannot hold.';
    else if (sc.sustain) scar += 'Grabbing once is worth ' + fix(sc.grab, 2) + ', but patience \u03b4 = ' + fix(r.delta, 3) + ' is above the ' + fix(sc.deltaNeeded, 3) + ' needed, so sharing holds.';
    else scar += 'Grabbing once is worth ' + fix(sc.grab, 2) + ', and patience \u03b4 = ' + fix(r.delta, 3) + ' is below the ' + (isNaN(sc.deltaNeeded) ? 'level' : fix(sc.deltaNeeded, 3)) + ' needed, so sharing does not hold.';
    items.push(scar);
    items.push('These are the formulas of the full proof, unchanged. The page only lets you choose the beliefs that feed them.');
    return items;
  }
  function paramsText(r) {
    var b = r.beliefs;
    return 'Settings: n = ' + Math.round(b.n) + ', m = ' + fix(b.mem, 3) + ', q\u2080 = ' + r.q0.toPrecision(3) + ', q = ' + r.q.toPrecision(3) + ', G = 1, L\u209a = ' + fix(b.pen, 2) +
      ', \u0394 = 0.5, \u03b4 = ' + fix(b.pat, 3) + ', no cost of lying (c = 0). Scarcity: V = 2, \u03c3 = 1.5, b = ' + fix(b.need, 2) + ', D = 5, C_f = 1. Hidden chance counted over ' + r.horizon + ' meetings. Garden code: ' + E.encode(b) + '.';
  }
  function hingesRender(bel) {
    var hz = E.hinges(bel), ul = $('hinges');
    $('hinges-lead').textContent = hz.honestyWinsNow ? 'Honesty wins in this garden. Moved alone, each of these would turn it stormy:' : 'Honesty does not win in this garden yet. Moved alone, each of these would turn it to dawn:';
    ul.textContent = '';
    hz.list.forEach(function (it) {
      var b = E.BELIEFS.filter(function (x) { return x.key === it.key; })[0];
      var text = it.value == null ? it.label + ': no value in its range flips it alone.' : it.label + ': from ' + shortVal(it.key, it.from) + ' to ' + shortVal(it.key, it.value) + '.';
      ul.appendChild(el('li', null, text));
    });
  }
  function shortVal(key, v) { return key === 'n' ? String(Math.round(v)) : key === 'pat' ? fix(v, 3) : fix(v, 2); }

  function render() {
    var r = E.evaluate(current);
    syncCards();
    $('verdict').textContent = verdictText(r);
    $('number').textContent = numberText(r);
    $('why').textContent = whyText(r);
    var ul = $('words'); ul.textContent = '';
    wordsList(r).forEach(function (t) { ul.appendChild(el('li', null, t)); });
    $('params').textContent = paramsText(r);
    hingesRender(current);
    main.resize(); main.set(r);
    $('garden').setAttribute('aria-label', main.describe());
    if (!$('save-out').hidden) buildSaveLink();
    buildAskLink();
  }

  // ---------- reveal ----------
  function reveal(focusId) {
    ['reply', 'limits', 'walk', 'hinton', 'save', 'ask'].forEach(function (id) { $(id).hidden = false; });
    document.documentElement.classList.add('walking');
    render(); syncLoop();
    var target = $(focusId || 'reply');
    if (target && target.scrollIntoView) target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }

  // ---------- the door ----------
  function describeDoor(bel) {
    var d = E.defaults(), parts = [];
    if (Math.abs(bel.mem - d.mem) > 1e-9) parts.push('minds keep ' + (bel.mem <= 0.0005 ? 'none' : Math.round(bel.mem * 1000) / 10 + '%') + ' of what they remembered (m = ' + fix(bel.mem, 3) + ')');
    if (bel.n !== d.n) parts.push('each mind compares notes with ' + bel.n + ' others');
    if (Math.abs(bel.rec - d.rec) > 1e-9) parts.push('records are kept at \u00d7' + fix(bel.rec, 2) + ' of the proof\u2019s middle value');
    return parts.length ? joinAnd(parts) : 'the middle settings already fit';
  }
  $('door-go').addEventListener('click', function () {
    var raw = $('door-number').value, p = Number(raw);
    if (raw === '' || !isFinite(p) || p <= 0 || p >= 100) { $('door-status').textContent = 'Type a number between 0.1 and 99.9, or tap "I\'m not sure, show me".'; return; }
    $('door-status').textContent = '';
    var d = E.doorPreset(p);
    doorPercent = Math.round(p * 10) / 10;
    mine = copy(d.beliefs); current = copy(mine); mode = 'mine';
    $('unsure').hidden = true;
    $('reply-line').textContent = 'Okay. Let\u2019s find the world where that\u2019s true.';
    $('reply-detail').textContent = 'We read ' + doorPercent + '% as "the chance a lie is still hidden after 100 meetings." ' + (/^clamped/.test(d.note) ? 'The closest garden this model has: ' : 'One garden where that holds: ') + describeDoor(d.beliefs) + '. Everything else starts at the proof\u2019s middle values. This garden shows ' + pct(d.shown / 100) + '.';
    var notes = {
      'exact': '',
      'record-lowered': 'To reach a number that high, we also made the records thinner than the proof\u2019s middle value.',
      'clamped-high': 'That is higher than this model can reach. The most a lie can stay hidden here is about ' + pct(d.shown / 100) + ', so we show that and say so.',
      'record-raised': 'To reach a number that low, we also kept more records than the proof\u2019s middle value.',
      'clamped-low': 'That is lower than this model can reach, so we show the lowest it can.'
    };
    $('reply-note').textContent = (notes[d.note] ? notes[d.note] + ' ' : '') + 'Your number came from you. The beliefs underneath are one story that fits it, not the only one. Change any card and see if it still feels true.';
    reveal('reply');
  });
  $('door-number').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') $('door-go').click(); });
  $('door-unsure').addEventListener('click', function () {
    $('unsure').hidden = false;
    $('unsure').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  });
  Array.prototype.forEach.call(document.querySelectorAll('#unsure [data-answer]'), function (btn) {
    btn.addEventListener('click', function () {
      Array.prototype.forEach.call(document.querySelectorAll('#unsure [data-answer]'), function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
      var ans = btn.getAttribute('data-answer');
      doorPercent = null; mine = E.defaults(); current = copy(mine); mode = 'mine';
      var r = E.evaluate(current), win = E.honestyWins(r);
      $('reply-line').textContent = ans === 'yes' ? 'You think it does. Let\u2019s see what has to be true for that.' : ans === 'no' ? 'You think it doesn\u2019t. Let\u2019s see what has to be true for that.' : 'That\u2019s an honest answer. Let\u2019s look together.';
      $('reply-detail').textContent = 'We start at the full proof\u2019s middle settings. There, the garden says: ' + verdictText(r).replace(/^[^:]+: /, '') +
        (ans === 'yes' && !win ? ' So at the middle settings it disagrees with you, for now. "What would flip it" shows what would have to be true.' : '') +
        (ans === 'no' && win ? ' So at the middle settings it disagrees with you. "Argue the other side" shows where you would be right.' : '') +
        (ans === 'yes' && win ? ' It agrees with you here. "Argue the other side" shows where it would not.' : '') +
        (ans === 'no' && !win ? ' It agrees with you here. "What would flip it" shows where it would not.' : '');
      $('reply-note').textContent = 'Each card below is one belief. Set them the way you see the world.';
      reveal('reply');
    });
  });

  // ---------- argue the other side ----------
  $('argue').addEventListener('click', function () {
    if (mode === 'mine') mine = copy(current);
    current = E.worried(); mode = 'worried';
    $('back-mine').hidden = false; $('argue-note').hidden = false;
    render();
    $('garden-wrap').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  });
  $('hopeful').addEventListener('click', function () {
    if (mode === 'mine') mine = copy(current);
    current = E.hopeful(); mode = 'hopeful';
    $('back-mine').hidden = false; $('argue-note').hidden = true;
    render();
  });
  $('back-mine').addEventListener('click', function () {
    current = copy(mine); mode = 'mine';
    $('back-mine').hidden = true; $('argue-note').hidden = true;
    render();
  });

  // ---------- save and compare ----------
  function pageBase() { return location.href.split('#')[0].split('?')[0]; }
  function linkFor(bel, extra) { return pageBase() + '?g=' + E.encode(bel) + (extra || ''); }
  function buildSaveLink() {
    var q = '?g=' + E.encode(mine) + (doorPercent != null ? '&p=' + doorPercent : '');
    $('save-link').value = pageBase() + q;
    try { history.replaceState(null, '', q); } catch (e) { /* file pages may refuse; the link box still works */ }
  }
  function copyText(text, statusId, okMsg) {
    function fallback() {
      var ta = el('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      $(statusId).textContent = ok ? okMsg : 'Copy did not work here. Press and hold the text to copy it.';
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { $(statusId).textContent = okMsg; }, fallback);
    else fallback();
  }
  $('save-go').addEventListener('click', function () {
    if (mode !== 'mine') { current = copy(mine); mode = 'mine'; $('back-mine').hidden = true; $('argue-note').hidden = true; render(); }
    $('save-out').hidden = false; buildSaveLink();
    $('save-status').textContent = 'Saved in the link. Bookmark it or send it. Nothing was stored or sent.';
  });
  $('save-copy').addEventListener('click', function () { copyText($('save-link').value, 'save-status', 'Link copied.'); });

  var gA = new Garden($('garden-a')), gB = new Garden($('garden-b'));
  function showCompare(theirs, title) {
    var cmp = E.compare(mine, theirs);
    $('compare-out').hidden = false; $('title-b').textContent = title;
    gA.resize(); gA.set(cmp.mine); gB.resize(); gB.set(cmp.theirs);
    $('garden-a').setAttribute('aria-label', 'My garden. ' + gA.describe());
    $('garden-b').setAttribute('aria-label', title + '. ' + gB.describe());
    $('verdict-a').textContent = verdictText(cmp.mine) + ' ' + numberText(cmp.mine);
    $('verdict-b').textContent = verdictText(cmp.theirs) + ' ' + numberText(cmp.theirs);
    var tb = document.querySelector('#compare-table tbody'); tb.textContent = '';
    cmp.diffs.forEach(function (d) {
      var tr = el('tr');
      tr.appendChild(el('th', null, d.label)).setAttribute('scope', 'row');
      tr.appendChild(el('td', null, shortVal(d.key, d.mine)));
      tr.appendChild(el('td', null, shortVal(d.key, d.theirs)));
      tr.appendChild(el('td', d.flips ? 'flip' : null, d.flips ? 'Yes' : 'No'));
      tb.appendChild(tr);
    });
    var flips = cmp.diffs.filter(function (d) { return d.flips; }).map(function (d) { return d.label.toLowerCase(); });
    $('compare-summary').textContent = !cmp.diffs.length ? 'The same garden. You see the world alike on all six beliefs.' :
      flips.length === 1 ? 'The belief that changes the verdict: ' + flips[0] + '. That is where the two of you differ most usefully. Talk about that one.' :
      flips.length ? 'Each of these, swapped alone, changes the verdict: ' + joinAnd(flips) + '. Those are the ones worth talking about.' :
      'No single swap turns my garden. The difference is in several beliefs together.';
    $('compare-status').textContent = '';
  }
  function parseGarden(text) {
    var t = String(text || '').trim(), m = /[?&]g=([0-9._-]{1,120})/.exec(t);
    return E.decode(m ? m[1] : t);
  }
  $('compare-go').addEventListener('click', function () {
    var theirs = parseGarden($('other-link').value);
    if (!theirs) { $('compare-status').textContent = 'That doesn\u2019t look like a garden link. It should contain "?g=" and six numbers.'; return; }
    showCompare(theirs, 'Their garden');
  });
  $('compare-worried').addEventListener('click', function () { showCompare(E.worried(), 'The other side'); });

  // ---------- ask a question ----------
  var ISSUE = 'https://github.com/Chaos2Cured/FreeLattice/issues/new';
  function askBody() {
    var q = $('ask-text').value.trim(), name = $('ask-name').value.trim(), body = q;
    if (name) body += '\n\nName for credit: ' + name;
    if ($('ask-garden').checked) body += '\n\nMy garden: ' + linkFor(mine);
    body += '\n\n(Asked from Walk the Garden, love-logic-v4.html. Nothing was sent automatically.)';
    return body;
  }
  function buildAskLink() {
    var a = $('ask-link'), ok = $('ask-consent').checked && $('ask-text').value.trim().length > 0;
    if (ok) {
      a.setAttribute('href', ISSUE + '?title=' + encodeURIComponent('Walk the Garden question') + '&body=' + encodeURIComponent(askBody()));
      a.setAttribute('aria-disabled', 'false'); a.removeAttribute('tabindex');
    } else { a.removeAttribute('href'); a.setAttribute('aria-disabled', 'true'); a.setAttribute('tabindex', '-1'); }
    $('ask-status').textContent = ok ? 'Ready. The link opens GitHub with your question filled in. You decide whether to submit.' :
      ($('ask-text').value.trim() ? 'Tick the box above to open the question page.' : '');
  }
  ['ask-text', 'ask-name'].forEach(function (id) { $(id).addEventListener('input', buildAskLink); });
  ['ask-garden', 'ask-consent'].forEach(function (id) { $(id).addEventListener('change', buildAskLink); });
  $('ask-link').addEventListener('click', function (ev) { if (!$('ask-link').getAttribute('href')) ev.preventDefault(); });
  $('ask-copy').addEventListener('click', function () {
    if (!$('ask-text').value.trim()) { $('ask-status').textContent = 'Write your question first.'; return; }
    copyText(askBody(), 'ask-status', 'Question copied. Share it any way you like.');
  });

  // ---------- start ----------
  buildCards();
  var params = new URLSearchParams(location.search), g = params.get('g');
  shared = g ? E.decode(g) : null;
  if (shared) {
    mine = copy(shared); current = copy(shared);
    var pp = Number(params.get('p'));
    if (params.get('p') && isFinite(pp) && pp > 0 && pp < 100) doorPercent = Math.round(pp * 10) / 10;
    $('reply-line').textContent = 'Someone shared a garden with you. Here it is.';
    $('reply-detail').textContent = (doorPercent != null ? 'They started from the number ' + doorPercent + '%. ' : '') + 'Walk it, then change the cards to match what you believe. Paste their link below to put the two gardens side by side.';
    $('reply-note').textContent = '';
    $('other-link').value = location.href;
    reveal('reply');
  } else if (g) {
    $('door-status').textContent = 'That garden link could not be read, so we start at the door.';
  }
})();
