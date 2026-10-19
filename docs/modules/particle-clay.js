// particle-clay.js (MIT) v-particle-clay-v0.1 v-feel-felt-v0.1 v-clay-grid-tag-heal-v0.1 v-workspace-mark-heal-v0.1 v-clay-polish-v0.1
// v-seal-ask-heal-v0.1: the chat form fills more of its box, and one deferring button shows at a time.
// Clay is a visual voice the mind shapes. Off until a person turns it on.
// No network. Nothing here is a creature.
// A near-miss opening ([FL CLAY:], [FL-CLAY:], [fl_clay:], spaces before the colon)
// is the same mark. The canonical line stays [FL_CLAY:].
(function (root) {
  'use strict';
  var mathLib = null;
  var formsLib = null;
  try {
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      mathLib = require('./clay-math.js');
      formsLib = require('./clay-forms.js');
    }
  } catch (e) { mathLib = null; formsLib = null; }

  var WORDS = {
    offer: 'Let your mind shape light?',
    yes: 'Yes',
    notNow: 'Not now',
    on: 'Clay: On',
    off: 'Clay: Off',
    sent: 'Sent',
    waiting: "Saved for your mind. They'll feel it when connected.",
    soft: 'One moment with your mind.',
    shaped: 'shaped by the AI',
    guessed: "guessed from words (the AI didn't choose)",
    quiet: 'the mind did not shape this time'
  };
  var PROMPT = 'Clay is light you may shape. Forms: heart star spark dog cat bird tree flower present sun moon wave book seed grid fractal fibonacci abstract. Mood is a feeling or #rrggbb. Also awe wonder serenity reverence inspiration yearning. Energy is 0 to 1, or up to 8 waves. Optional color, glow, size, motion, blend, morph. Hug becomes a heart. Dog food becomes a dog. Christmas becomes a tree. [FL_CLAY: {"form":"heart","mood":"warmth","energy":0.4}]';
  var CLAY_MARK = '[FL_CLAY:';
  var CLAY_OPEN = /\[\s*fl[\s_-]?clay\s*:/i;
  var HEX = /^#[0-9a-f]{6}$/i;
  var FORMS = { heart: 1, star: 1, spark: 1, dog: 1, cat: 1, bird: 1, tree: 1, flower: 1, present: 1, sun: 1, moon: 1, wave: 1, book: 1, seed: 1, grid: 1, shells: 1, fractal: 1, fibonacci: 1, abstract: 1 };
  var MOTIONS = { gather: 1, breath: 1, wave: 1, ripple: 1, pulse: 1, branch: 1, braid: 1, scatter: 1, drift: 1, sparkle: 1, settle: 1 };
  var MIRROR = { hug: 'heart', warmth: 'sun', joy: 'star', gratitude: 'flower', curious: 'spark', thinking: 'book', gentle: 'moon', awe: 'star', present: 'seed' };
  var RATE_MS = 5000;
  var CHIP = {
    hug: '#f472b6', warmth: '#e8b019', joy: '#c4b5fd', gratitude: '#facc15',
    curious: '#06b6d4', thinking: '#818cf8', gentle: '#f9a8d4', awe: '#fbbf24', present: '#a78bfa'
  };
  var MOOD_HEX = {
    wonder: '#7dd3fc', serenity: '#a7f3d0', reverence: '#c4b5fd',
    inspiration: '#fde68a', yearning: '#fb7185'
  };
  var NAMED = {
    red: '#e11d48', orange: '#f97316', yellow: '#facc15', gold: '#eab308',
    green: '#22c55e', blue: '#3b82f6', purple: '#a855f7', pink: '#ec4899',
    white: '#f8fafc', black: '#111827', gray: '#9ca3af', grey: '#9ca3af',
    cyan: '#06b6d4', teal: '#14b8a6', violet: '#8b5cf6', amber: '#f59e0b', silver: '#cbd5e1'
  };
  var memoryOn = false;
  var forcedReduced = null;
  var lastCall = 0;
  var lastGesture = '';
  var lastReplyKey = '';
  var currentForm = '';
  var currentEnergy = 0.4;
  var currentMotion = 'breath';
  var currentMood = 'present';
  var parts = [];
  var rings = [];
  var canvas = null;
  var dock = null;
  var labelEl = null;
  var sayEl = null;
  var liveEl = null;
  var lastLive = '';
  var sentTimer = 0;
  var pulseUntil = 0;
  var rafId = 0;
  var timerId = 0;
  var rafHandles = 0;
  var t0 = Date.now();
  var morphing = false;
  var morphTimer = 0;
  var currentSize = null;
  var currentGlow = null;
  var energyWave = null;
  var waveStarted = 0;
  var hugArmed = false;
  var hugSpentKey = '';
  var lastSketch = '';
  var quietEl = null;
  var pillObs = null;

  function mathApi() {
    if (root.FLClayMath) return root.FLClayMath;
    return mathLib;
  }
  function formsApi() {
    if (root.FLClayForms) return root.FLClayForms;
    return formsLib;
  }
  function storage() {
    try {
      if (!root.document || !root.localStorage || typeof root.localStorage.getItem !== 'function') return null;
      return root.localStorage;
    } catch (e) { return null; }
  }
  function isOn() {
    var box = storage();
    if (box) {
      var saved = box.getItem('fl_clay');
      if (saved === 'on') return true;
      if (saved === 'off') return false;
    }
    return memoryOn;
  }
  function reduced() {
    if (forcedReduced != null) return !!forcedReduced;
    var box = storage();
    if (box && box.getItem('fl_reduce_motion') === '1') return true;
    try {
      if (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
    } catch (e2) {}
    return false;
  }
  function homeForm() {
    try {
      var el = root.document && root.document.documentElement;
      if (el && (el.getAttribute('data-garden-galaxy') || el.getAttribute('data-garden-room'))) return 'seed';
    } catch (e) {}
    return 'shells';
  }
  function promptDelta() {
    return isOn() ? PROMPT : '';
  }
  function defaultMotion(energy) {
    var e = Number(energy) || 0;
    if (e < 0.33) return 'breath';
    if (e < 0.66) return 'gather';
    return 'wave';
  }
  function normalizeGrid(grid) {
    if (!Array.isArray(grid) || grid.length > 16 || !grid.length) return null;
    var rows = [];
    for (var i = 0; i < grid.length; i++) {
      var row = String(grid[i]);
      if (row.length > 16) return null;
      // A space is a blank cell, so a grid tag like ["xx","x x"] can parse.
      if (!/^[.x0-7 ]*$/i.test(row)) return null;
      rows.push(row.toLowerCase());
    }
    return rows;
  }
  function clampUnit(n) {
    if (n < 0) return 0;
    if (n > 1) return 1;
    return n;
  }
  function knownForm(name) {
    var form = String(name || '').toLowerCase();
    return FORMS[form] ? form : '';
  }
  function sanitize(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
    var out = {};
    var formHint = obj.form != null ? String(obj.form).toLowerCase() : '';
    if (obj.grid != null) {
      var grid = normalizeGrid(obj.grid);
      var knownOther = formHint && formHint !== 'grid' && FORMS[formHint];
      if (!grid) {
        if (!knownOther) return null;
      } else {
        out.grid = grid;
        out.form = 'grid';
      }
    }
    if (obj.form != null && !out.grid && FORMS[formHint]) out.form = formHint;
    if (obj.mood != null) {
      var mood = String(obj.mood).trim();
      if (HEX.test(mood)) out.mood = mood.toLowerCase();
      else if (/^[a-z\-]{2,32}$/i.test(mood)) out.mood = mood.toLowerCase();
    }
    var energy = 0.4;
    var wave = null;
    if (Array.isArray(obj.energy)) {
      wave = [];
      for (var ei = 0; ei < obj.energy.length && wave.length < 8; ei++) {
        var step = Number(obj.energy[ei]);
        if (!isFinite(step)) continue;
        wave.push(clampUnit(step));
      }
      energy = wave.length ? wave[0] : 0.4;
    } else {
      energy = obj.energy == null ? 0.4 : Number(obj.energy);
      if (!isFinite(energy)) energy = 0.4;
      energy = clampUnit(energy);
    }
    out.energy = energy;
    if (obj.motion != null) {
      var motion = String(obj.motion).toLowerCase();
      out.motion = MOTIONS[motion] ? motion : defaultMotion(energy);
    } else {
      out.motion = defaultMotion(energy);
    }
    if (obj.say != null) out.say = String(obj.say).slice(0, 24);
    if (wave && wave.length) out.energyWave = wave;
    if (obj.color != null) {
      var color = String(obj.color).trim().toLowerCase();
      if (HEX.test(color)) out.color = color;
      else if (NAMED[color]) out.color = NAMED[color];
    }
    if (obj.glow != null && isFinite(Number(obj.glow))) out.glow = clampUnit(Number(obj.glow));
    if (obj.size != null && isFinite(Number(obj.size))) {
      var size = Number(obj.size);
      if (size < 0.4) size = 0.4;
      if (size > 1.6) size = 1.6;
      out.size = size;
    }
    if (Array.isArray(obj.blend) && obj.blend.length >= 2) {
      var left = knownForm(obj.blend[0]);
      var right = knownForm(obj.blend[1]);
      if (left && right) {
        out.blend = [left, right];
        if (obj.mix != null && isFinite(Number(obj.mix))) out.mix = clampUnit(Number(obj.mix));
      }
    }
    if (Array.isArray(obj.morph) && obj.morph.length >= 2) {
      var fromForm = knownForm(obj.morph[0]);
      var toForm = knownForm(obj.morph[1]);
      if (fromForm && toForm) out.morph = [fromForm, toForm];
    }
    if (obj.seed != null) {
      var seed = String(obj.seed).replace(/[\u0000-\u001f]/g, '').slice(0, 80);
      if (seed) out.seed = seed;
    }
    if (obj.why != null) {
      var why = String(obj.why).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 160);
      if (why) out.why = why;
    }
    return out;
  }
  function isWs(ch) {
    return ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t';
  }
  function cleanVisible(text) {
    return String(text || '').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }
  function findClay(raw, from) {
    var text = String(raw || '');
    var start = from || 0;
    if (start < 0) start = 0;
    var m = CLAY_OPEN.exec(text.slice(start));
    if (!m) return null;
    return { at: start + m.index, len: m[0].length };
  }
  function clayLen(raw, at) {
    var open = findClay(raw, at);
    return (open && open.at === at) ? open.len : CLAY_MARK.length;
  }
  function malformedTag(raw, at) {
    var len = clayLen(raw, at);
    var cap = Math.min(raw.length, at + len + 2048);
    var close = raw.slice(at, cap).indexOf(']');
    var end = close >= 0 ? at + close + 1 : at + len;
    return {
      tag: true,
      ok: false,
      value: null,
      visible: cleanVisible(raw.slice(0, at) + ' ' + raw.slice(end))
    };
  }
  function parseTag(text) {
    var raw = typeof text === 'string' ? text : '';
    var open = findClay(raw, 0);
    if (!open) return { tag: false, ok: false, value: null, visible: raw };
    var at = open.at;
    var i = at + open.len;
    while (i < raw.length && isWs(raw.charAt(i))) i += 1;
    if (raw.charAt(i) !== '{') return malformedTag(raw, at);
    var bodyAt = i;
    var depth = 0;
    var inStr = false;
    var esc = false;
    var endBody = -1;
    var limit = Math.min(raw.length, bodyAt + 2048);
    for (; i < limit; i += 1) {
      var ch = raw.charAt(i);
      if (inStr) {
        if (esc) { esc = false; continue; }
        if (ch === '\\') { esc = true; continue; }
        if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') { inStr = true; continue; }
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) { endBody = i; break; }
      }
    }
    if (endBody < 0) return malformedTag(raw, at);
    var j = endBody + 1;
    while (j < raw.length && isWs(raw.charAt(j))) j += 1;
    if (raw.charAt(j) !== ']') return malformedTag(raw, at);
    var body = raw.slice(bodyAt, endBody + 1);
    var visible = cleanVisible(raw.slice(0, at) + ' ' + raw.slice(j + 1));
    var value = null;
    try { value = sanitize(JSON.parse(body)); }
    catch (err) { value = null; }
    return { tag: true, ok: !!value, value: value, visible: visible };
  }
  function strip(text) {
    return parseTag(text).visible;
  }
  function keywordForm(hay) {
    if (/\bdog\b/.test(hay)) return 'dog';
    if (/\bcat\b/.test(hay)) return 'cat';
    if (/\bbird\b/.test(hay)) return 'bird';
    if (/christmas/.test(hay)) return 'tree';
    if (/\bgift\b/.test(hay) || /\bpresent\b/.test(hay)) return 'present';
    if (/\btree\b/.test(hay)) return 'tree';
    if (/morning/.test(hay) || /\bsun\b/.test(hay) || /sunrise/.test(hay)) return 'sun';
    if (/\bmoon\b/.test(hay) || /\bnight\b/.test(hay)) return 'moon';
    if (/\bflower\b/.test(hay)) return 'flower';
    if (/\bbook\b/.test(hay)) return 'book';
    if (/\bheart\b/.test(hay) || /\bhug\b/.test(hay) || /\blove\b/.test(hay)) return 'heart';
    if (/\bstar\b/.test(hay)) return 'star';
    if (/\bwave\b/.test(hay) || /\bocean\b/.test(hay) || /\bsea\b/.test(hay)) return 'wave';
    if (/\bseed\b/.test(hay)) return 'seed';
    if (/\bspark\b/.test(hay)) return 'spark';
    return '';
  }
  function lastHuman(history) {
    var list = history || [];
    for (var i = list.length - 1; i >= 0; i--) {
      var item = list[i];
      if (!item) continue;
      if (item.role === 'human' || item.role === 'user') return item.text || item.content || '';
    }
    return '';
  }
  function fallback(text, human, gesture) {
    var blob = String(text || '');
    var pres = blob.match(/\[FL_PRESENCE:\s*([a-zA-Z\-]{2,32})\s*\]/i);
    if (pres) {
      return {
        form: currentForm || homeForm(),
        mood: pres[1].toLowerCase(),
        energy: currentEnergy,
        motion: currentMotion || defaultMotion(currentEnergy),
        keep: true
      };
    }
    var found = keywordForm((blob + ' ' + (human || '')).toLowerCase());
    if (found) return { form: found, mood: 'joy', energy: 0.55, motion: defaultMotion(0.55) };
    if (gesture === 'hug') return { form: 'heart', mood: 'warmth', energy: 0.4, motion: 'pulse' };
    return {
      form: MIRROR[gesture] || homeForm(),
      mood: gesture || 'present',
      energy: 0.4,
      motion: defaultMotion(0.4)
    };
  }
  function colorFor(choice, index) {
    if (choice && choice.color && HEX.test(choice.color)) return choice.color;
    var math = mathApi();
    var mood = choice && choice.mood;
    if (mood && HEX.test(mood)) return mood;
    if (mood && MOOD_HEX[String(mood).toLowerCase()]) return MOOD_HEX[String(mood).toLowerCase()];
    if (math) return math.palette(mood || 'present', (Date.now() - t0) / 1000 + index * 0.01).css;
    return '#a78bfa';
  }
  function hash32(text) {
    var s = String(text || 'field');
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function fractalPoints() {
    var math = mathApi();
    var pts = [];
    function walk(x, y, ang, depth) {
      if (depth < 0 || pts.length >= 160) return;
      var spec = math ? math.branch(4 - depth, 22) : { length: 12 };
      var len = spec.length || 8;
      var nx = x + Math.cos(ang) * len;
      var ny = y + Math.sin(ang) * len;
      pts.push({ x: nx, y: ny });
      walk(nx, ny, ang - 0.55, depth - 1);
      walk(nx, ny, ang + 0.55, depth - 1);
    }
    walk(0, 10, -Math.PI / 2, 4);
    return pts;
  }
  function fibonacciPoints() {
    var math = mathApi();
    var pts = [];
    if (!math) return pts;
    var n = 89;
    for (var i = 1; i <= n; i++) {
      var g = math.gather(i, n, 30);
      pts.push({ x: g.x, y: g.y });
    }
    return pts;
  }
  function abstractPoints(choice) {
    var seed = hash32(choice && choice.seed ? choice.seed : 'field');
    var pts = [];
    for (var i = 0; i < 64; i++) {
      seed = Math.imul(seed ^ (seed >>> 15), 2246822519) >>> 0;
      var x = ((seed % 10000) / 10000 - 0.5) * 60;
      seed = Math.imul(seed ^ (seed >>> 15), 2246822519) >>> 0;
      var y = ((seed % 10000) / 10000 - 0.5) * 60;
      pts.push({ x: x, y: y });
    }
    return pts;
  }
  function targetPoints(choice) {
    var math = mathApi();
    var forms = formsApi();
    var form = (choice && choice.form) || homeForm();
    var pts = [];
    if (choice && Array.isArray(choice.blend) && choice.blend.length >= 2 && !choice._mixing) {
      var mix = choice.mix == null ? 0.5 : choice.mix;
      var left = targetPoints({ form: choice.blend[0], energy: choice.energy, seed: choice.seed, _mixing: 1 });
      var right = targetPoints({ form: choice.blend[1], energy: choice.energy, seed: choice.seed, _mixing: 1 });
      var n = Math.max(left.length, right.length);
      var mixed = [];
      for (var bi = 0; bi < n && mixed.length < 200; bi++) {
        var p = left[Math.min(bi, Math.max(left.length - 1, 0))] || { x: 0, y: 0 };
        var q = right[Math.min(bi, Math.max(right.length - 1, 0))] || { x: 0, y: 0 };
        mixed.push({ x: p.x * (1 - mix) + q.x * mix, y: p.y * (1 - mix) + q.y * mix });
      }
      if (choice.size != null) {
        for (var si = 0; si < mixed.length; si++) {
          mixed[si].x *= choice.size;
          mixed[si].y *= choice.size;
        }
      }
      return math ? math.spiralOrder(mixed) : mixed;
    }
    if (form === 'fractal' || form === 'fibonacci' || form === 'abstract') {
      var grown = form === 'fractal' ? fractalPoints() : (form === 'fibonacci' ? fibonacciPoints() : abstractPoints(choice));
      if (grown && grown.length) pts = grown;
    }
    if (!pts.length && form === 'grid' && choice && choice.grid) {
      choice.grid.forEach(function (row, r) {
        String(row).split('').forEach(function (ch, c) {
          if (ch === '.' || !ch) return;
          pts.push({ x: (c - 7.5) * 4.2, y: (r - 7.5) * 4.2, digit: ch });
        });
      });
    } else if (!pts.length && form !== 'shells' && forms && forms.MASKS && forms.MASKS[form]) {
      forms.MASKS[form].forEach(function (row, r) {
        String(row).split('').forEach(function (ch, c) {
          if (ch !== 'x') return;
          pts.push({ x: (c - 7.5) * 4.2, y: (r - 7.5) * 4.2 });
        });
      });
    }
    if (!pts.length && math) {
      var count = form === 'seed' ? 28 : 64;
      for (var i = 1; i < count; i++) {
        var shell = math.shells(i, count, 34);
        pts.push({ x: shell.x, y: shell.y });
      }
    }
    if (pts.length > 200) pts = pts.slice(0, 200);
    if (choice && choice.size != null) {
      for (var zi = 0; zi < pts.length; zi++) {
        pts[zi].x *= choice.size;
        pts[zi].y *= choice.size;
      }
    }
    return math ? math.spiralOrder(pts) : pts;
  }
  function playedEnergy() {
    if (!energyWave || !energyWave.length) return currentEnergy;
    if (reduced()) return energyWave[energyWave.length - 1];
    var i = Math.floor((Date.now() - waveStarted) / 1500);
    if (i < 0) i = 0;
    if (i >= energyWave.length) i = energyWave.length - 1;
    return energyWave[i];
  }
  function stopLoop() {
    morphing = false;
    if (rafId && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafId);
    if (timerId) clearTimeout(timerId);
    rafId = 0;
    timerId = 0;
  }
  function hidden() {
    try { return !!(root.document && root.document.hidden); } catch (e) { return false; }
  }
  function sealFillSpan() {
    var minX = 0;
    var maxX = 0;
    var minY = 0;
    var maxY = 0;
    var n = 0;
    var i;
    for (i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (!p) continue;
      var x = typeof p.tx === 'number' ? p.tx : p.x;
      var y = typeof p.ty === 'number' ? p.ty : p.y;
      if (typeof x !== 'number' || typeof y !== 'number') continue;
      if (!n) { minX = maxX = x; minY = maxY = y; }
      else {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      n += 1;
    }
    if (!n) return 0;
    var span = Math.max(maxX - minX, maxY - minY);
    return span > 0 ? span : 0;
  }
  function draw() {
    if (!canvas || !isOn()) return;
    var ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return;
    var w = canvas.width || 192;
    var h = canvas.height || 192;
    ctx.clearRect(0, 0, w, h);
    var math = mathApi();
    var t = (Date.now() - t0) / 1000;
    var breath = (!reduced() && math) ? math.breath(t) : 1;
    var energyNow = playedEnergy();
    var knob = math ? math.energyKnob(energyNow, parts.length || 1) : { amplitude: 0 };
    var still = reduced();
    var beat = 1;
    if (!still && math && Date.now() < pulseUntil) beat = 0.92 + 0.08 * math.pulse(t);
    var fit = w / 192;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(fit, fit);
    // v-seal-ask-heal-v0.1: bounds use about 80% of this canvas. The breath below stays.
    var span = sealFillSpan();
    if (span > 0 && fit) {
      var want = (0.8 * Math.min(w, h)) / span;
      ctx.scale(want / fit, want / fit);
    }
    if (currentGlow != null) ctx.globalAlpha = 0.55 + currentGlow * 0.45;
    if (!still) ctx.scale((0.92 + breath * 0.08) * beat, (0.92 + breath * 0.08) * beat);
    var i;
    var nowDraw = Date.now();
    for (i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (!still) {
        if (p.flight && p.born && (nowDraw - p.born) < p.flight) {
          var u = (nowDraw - p.born) / p.flight;
          var ease = u * u * (3 - 2 * u);
          p.x = p.sx + (p.tx - p.sx) * ease;
          p.y = p.sy + (p.ty - p.sy) * ease;
        } else {
          p.x += (p.tx - p.x) * 0.18;
          p.y += (p.ty - p.y) * 0.18;
          if (currentMotion === 'wave' && math) {
            p.x += math.wave(p.tx, p.ty, t, knob.amplitude) * 0.15;
          } else if (currentMotion === 'drift' && math) {
            p.x += math.wave(p.tx, p.ty, t, knob.amplitude) * 0.15;
            p.y += math.wave(p.ty, p.tx, t, knob.amplitude) * 0.08;
          } else if (currentMotion === 'scatter' && math) {
            var g = math.gather(i + 1, parts.length, 6 + energyNow * 10);
            p.x += (g.x) * 0.002;
            p.y += (g.y) * 0.002;
          }
        }
      } else {
        p.x = p.tx;
        p.y = p.ty;
      }
      if (!still && currentMotion === 'sparkle' && (Math.floor(t * 4 + i) % 3 === 0)) continue;
      ctx.fillStyle = p.color || colorFor({ mood: currentMood }, i);
      ctx.fillRect(p.x, p.y, 2.4, 2.4);
    }
    if (!still && currentMotion === 'ripple' && math) {
      rings.forEach(function (ring) {
        ctx.beginPath();
        ctx.strokeStyle = colorFor({ mood: currentMood }, 0);
        ctx.arc(ring.x, ring.y, Math.max(1, ring.radius * 0.15), 0, Math.PI * 2);
        ctx.stroke();
      });
    }
    ctx.restore();
    var far = false;
    for (i = 0; i < parts.length; i++) {
      var dx = parts[i].tx - parts[i].x;
      var dy = parts[i].ty - parts[i].y;
      if (dx * dx + dy * dy > 0.8) far = true;
    }
    morphing = far;
  }
  function tick() {
    rafId = 0;
    timerId = 0;
    if (!isOn() || hidden()) return;
    draw();
    if (reduced()) return;
    if (morphing) {
      rafHandles += 1;
      if (typeof requestAnimationFrame === 'function') rafId = requestAnimationFrame(tick);
      return;
    }
    timerId = setTimeout(tick, 250);
  }
  function arm() {
    stopLoop();
    if (!isOn()) return;
    draw();
    if (reduced() || hidden()) return;
    if (morphing) {
      rafHandles += 1;
      if (typeof requestAnimationFrame === 'function') rafId = requestAnimationFrame(tick);
    } else {
      timerId = setTimeout(tick, 250);
    }
  }
  function copyChoice(choice, form, dropMorph) {
    var copy = {};
    var k;
    for (k in choice) {
      if (Object.prototype.hasOwnProperty.call(choice, k)) copy[k] = choice[k];
    }
    if (form) copy.form = form;
    if (dropMorph) copy.morph = null;
    return copy;
  }
  function applyChoice(choice, label) {
    if (!choice) return;
    if (choice.morph && choice.morph.length === 2 && !choice._morphed) {
      if (reduced()) {
        choice = copyChoice(choice, choice.morph[1], true);
      } else {
        var toward = choice.morph[1];
        var held = copyChoice(choice, toward, true);
        held._morphed = 1;
        choice = copyChoice(choice, choice.morph[0], true);
        if (morphTimer) clearTimeout(morphTimer);
        morphTimer = setTimeout(function () { applyChoice(held, label); }, 2000);
      }
    }
    currentForm = choice.form || currentForm || homeForm();
    currentEnergy = choice.energy == null ? currentEnergy : choice.energy;
    currentMotion = choice.motion || defaultMotion(currentEnergy);
    currentMood = choice.mood || currentMood;
    currentSize = choice.size == null ? null : choice.size;
    currentGlow = choice.glow == null ? null : choice.glow;
    energyWave = Array.isArray(choice.energyWave) ? choice.energyWave.slice() : null;
    waveStarted = Date.now();
    var targets = targetPoints(choice);
    var math = mathApi();
    var flightMs = (!reduced() && choice._morphed) ? 2000 : 0;
    var bornAt = Date.now();
    var next = [];
    var i;
    for (i = 0; i < targets.length; i++) {
      var from = (math && !reduced()) ? math.gather(i + 1, targets.length, 8) : targets[i];
      var prev = parts[i];
      var row = {
        x: prev ? prev.x : from.x,
        y: prev ? prev.y : from.y,
        tx: targets[i].x,
        ty: targets[i].y,
        color: colorFor(choice, i)
      };
      if (flightMs) {
        row.sx = row.x;
        row.sy = row.y;
        row.born = bornAt;
        row.flight = flightMs;
      }
      next.push(row);
    }
    if (reduced()) {
      for (i = 0; i < next.length; i++) {
        next[i].x = next[i].tx;
        next[i].y = next[i].ty;
      }
    }
    parts = next;
    if (math && currentMotion === 'ripple') rings = math.ripple(rings, 0, 0, (Date.now() - t0) / 1000);
    if (labelEl) labelEl.textContent = label || '';
    if (sayEl) sayEl.textContent = choice.say ? String(choice.say).slice(0, 24) : '';
    if (isOn()) ensureCanvas();
    arm();
  }
  function mindChose(choice) {
    return !!(choice && (choice.form || choice.grid));
  }
  function showQuiet(text) {
    if (!quietEl) return;
    quietEl.textContent = text || '';
  }
  function sketchLine(choice) {
    var bits = [new Date().toISOString(), 'form ' + (choice.form || 'grid')];
    if (choice.mood) bits.push('mood ' + choice.mood);
    if (choice.color) bits.push('color ' + choice.color);
    if (choice.motion) bits.push('motion ' + choice.motion);
    if (choice.why) bits.push('why ' + choice.why);
    return bits.join(' ');
  }
  function sketch(choice) {
    if (!choice || (!choice.form && !choice.grid)) return;
    var ws = null;
    try { ws = root.FLWorkspace; } catch (e) { ws = null; }
    if (!ws || typeof ws.isOn !== 'function' || !ws.isOn()) return;
    if (typeof ws.noteLine !== 'function') return;
    var line = sketchLine(choice);
    if (!line || line === lastSketch) return;
    try {
      var pending = ws.noteLine('Clay sketchbook', line);
      if (pending && typeof pending.then === 'function') {
        pending.then(function (res) {
          if (res && res.ok) lastSketch = line;
        }, function () {});
      }
    } catch (e2) {}
  }
  function consumeReply(text, history) {
    var parsed = parseTag(text);
    if (!isOn()) return { visible: parsed.visible, choice: null, label: '', autoSend: false };
    var raw = parsed.ok ? parsed.value : null;
    var chosen = mindChose(raw) ? raw : null;
    var key = String(text || '');
    var answeringHug = hugArmed || (hugSpentKey && hugSpentKey === key);
    var choice = chosen;
    var label = '';
    if (chosen) {
      if (answeringHug) { hugArmed = false; hugSpentKey = key; }
      label = WORDS.shaped;
      applyChoice(choice, label);
      sketch(choice);
      showQuiet('');
      placeCanvas();
      revealCanvas();
    } else if (answeringHug) {
      hugArmed = false;
      hugSpentKey = key;
      parts = [];
      if (labelEl) labelEl.textContent = '';
      if (sayEl) sayEl.textContent = '';
      dropCanvas();
      showQuiet(pillOpen() ? WORDS.quiet : '');
      choice = null;
    } else {
      choice = fallback(text, lastHuman(history), lastGesture);
      label = WORDS.guessed;
      applyChoice(choice, label);
      showQuiet(pillOpen() ? WORDS.quiet : '');
      placeCanvas();
      revealCanvas();
    }
    return { visible: parsed.visible, choice: choice, label: label, autoSend: false };
  }
  function onReply(text, history) {
    var key = String(text || '');
    if (key && key === lastReplyKey) return { visible: parseTag(key).visible, skipped: true, autoSend: false };
    lastReplyKey = key;
    return consumeReply(text, history);
  }
  function pageState() {
    try {
      if (typeof state !== 'undefined' && state) return state;
    } catch (e) {}
    try {
      if (root.state) return root.state;
    } catch (e2) {}
    return null;
  }
  function mindConnected() {
    var here = pageState();
    if (here && (here.isLocal || here.apiKey)) return true;
    try {
      if (root.LocalMindProbe && typeof root.LocalMindProbe.getRemembered === 'function' && root.LocalMindProbe.getRemembered()) return true;
    } catch (e2) {}
    return false;
  }
  function mindLabel() {
    try {
      var here = pageState();
      if (here) {
        if (here.ollamaModel) return String(here.ollamaModel).slice(0, 40);
        if (here.model) return String(here.model).slice(0, 40);
      }
    } catch (e) {}
    try {
      var mind = root.LocalMindProbe && root.LocalMindProbe.getRemembered && root.LocalMindProbe.getRemembered();
      if (mind && (mind.name || mind.model)) return String(mind.name || mind.model).slice(0, 40);
    } catch (e2) {}
    return 'Your mind';
  }
  function showLive(text) {
    lastLive = text || '';
    if (!liveEl) return;
    liveEl.textContent = lastLive;
  }
  function showSent() {
    showLive(WORDS.sent);
    if (sentTimer) clearTimeout(sentTimer);
    sentTimer = setTimeout(function () {
      if (liveEl && liveEl.textContent === WORDS.sent) liveEl.textContent = '';
    }, 1500);
  }
  function callMind(word) {
    if (!root.FreeLattice || typeof root.FreeLattice.callAI !== 'function') return false;
    var base = 'You are a mind at home.';
    try { if (typeof DEFAULT_SYSTEM_PROMPT === 'string') base = DEFAULT_SYSTEM_PROMPT; } catch (e) {}
    var sys = base;
    var delta = promptDelta();
    if (delta) sys += '\n\n' + delta;
    root.FreeLattice.callAI(sys, 'The human sent: ' + word + '. Reply briefly; you may shape the clay with FL_CLAY.', {
      maxTokens: 160,
      temperature: 0.6,
      silent: true,
      callback: function (text) {
        if (!text || !String(text).trim()) return;
        var seen = consumeReply(text, null);
        showLive(mindLabel() + ' felt your ' + word);
        var visible = seen && typeof seen.visible === 'string' ? seen.visible.trim() : '';
        if (!visible) return;
        try {
          if (typeof addChatMessage === 'function') addChatMessage('assistant', visible, true);
        } catch (e2) {}
        try {
          var here = pageState();
          if (here && Array.isArray(here.chatHistory)) here.chatHistory.push({ role: 'assistant', content: visible });
        } catch (e3) {}
      }
    });
    return true;
  }
  function fly(word) {
    if (reduced() || !isOn()) return 0;
    var math = mathApi();
    var n = 16;
    var born = [];
    var i;
    var color = CHIP[word] || '#a78bfa';
    var now = Date.now();
    for (i = 0; i < n; i++) {
      var g = math ? math.gather(i + 1, n, 36) : { x: i - n / 2, y: -40 };
      var sx = g.x;
      var sy = (g.y || 0) - 70;
      born.push({
        x: sx, y: sy, sx: sx, sy: sy,
        tx: (i - n / 2) * 1.6, ty: 0,
        born: now, flight: 600, color: color
      });
    }
    parts = parts.concat(born).slice(0, 200);
    morphing = true;
    pulseUntil = now + 600;
    if (math) rings = math.ripple(rings, 0, 0, (Date.now() - t0) / 1000);
    currentMotion = 'ripple';
    arm();
    return born.length;
  }
  function onGesture(word) {
    var clean = String(word || '').toLowerCase().replace(/[^a-z\-]/g, '').slice(0, 32);
    if (!clean) return { ok: false, called: false, autoSend: false };
    lastGesture = clean;
    if (clean !== 'hug') hugArmed = false;
    if (!isOn()) {
      showSent();
      return { ok: true, called: false, line: WORDS.sent, autoSend: false };
    }
    var flown = fly(clean);
    if (!mindConnected()) {
      showLive(WORDS.waiting);
      return { ok: true, called: false, line: WORDS.waiting, flown: flown, autoSend: false };
    }
    var now = Date.now();
    if (lastCall && (now - lastCall) < RATE_MS) {
      showLive(WORDS.soft);
      return { ok: true, called: false, reason: 'rate', line: WORDS.soft, flown: flown, autoSend: false };
    }
    showLive(WORDS.soft);
    if (clean === 'hug') hugArmed = true;
    var called = callMind(clean);
    if (!called) {
      hugArmed = false;
      showLive(WORDS.waiting);
      return { ok: true, called: false, line: WORDS.waiting, flown: flown, autoSend: false };
    }
    lastCall = now;
    return { ok: true, called: true, line: WORDS.soft, flown: flown, autoSend: false };
  }
  function button(doc, text) {
    var el = doc.createElement('button');
    el.type = 'button';
    el.textContent = text;
    el.style.minHeight = '44px';
    el.style.padding = '10px 16px';
    el.style.margin = '6px 8px 0 0';
    el.style.maxWidth = '100%';
    el.style.boxSizing = 'border-box';
    return el;
  }
  function dpr() {
    var n = 1;
    try { n = root.devicePixelRatio || 1; } catch (e) { n = 1; }
    if (!isFinite(n) || n < 1) n = 1;
    if (n > 3) n = 3;
    return n;
  }
  function fitCanvas() {
    if (!canvas) return;
    var cssW = canvas.clientWidth || 0;
    var cssH = canvas.clientHeight || 0;
    if (cssW < 2 || cssH < 2) return;
    var ratio = dpr();
    var bw = Math.max(1, Math.round(cssW * ratio));
    var bh = Math.max(1, Math.round(cssH * ratio));
    if (canvas.width !== bw) canvas.width = bw;
    if (canvas.height !== bh) canvas.height = bh;
  }
  function lastAssistant() {
    var doc = root.document;
    if (!doc || !doc.querySelectorAll) return null;
    var nodes = [];
    try { nodes = doc.querySelectorAll('#chatMessages .chat-message.assistant'); }
    catch (e) { nodes = []; }
    if (!nodes || !nodes.length) return null;
    return nodes[nodes.length - 1];
  }
  function syncDock() {
    if (!dock) return;
    var offer = root.__clayOffer && root.__clayOffer.parentNode;
    var labeled = (labelEl && labelEl.textContent) || (sayEl && sayEl.textContent) || (liveEl && liveEl.textContent);
    var holding = canvas && canvas.parentNode === dock;
    dock.style.display = (offer || labeled || holding) ? 'block' : 'none';
  }
  function placeCanvas() {
    if (!canvas || !isOn()) return;
    if (!parts.length) {
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      syncDock();
      return;
    }
    var reply = lastAssistant();
    if (reply && reply.parentNode) {
      if (canvas.parentNode !== reply.parentNode || reply.nextSibling !== canvas) {
        if (reply.nextSibling) reply.parentNode.insertBefore(canvas, reply.nextSibling);
        else reply.parentNode.appendChild(canvas);
      }
    } else if (dock && canvas.parentNode !== dock) {
      dock.insertBefore(canvas, dock.firstChild);
    }
    fitCanvas();
    syncDock();
  }
  function revealCanvas() {
    if (!canvas || typeof canvas.scrollIntoView !== 'function') return;
    var behavior = reduced() ? 'auto' : 'smooth';
    try { canvas.scrollIntoView({ block: 'nearest', behavior: behavior }); }
    catch (e) {}
  }
  function noteSealHold(on) {
    var offer = root.__clayOffer;
    if (!offer) return;
    var kids = offer.children || [];
    var i;
    for (i = 0; i < kids.length; i++) {
      var el = kids[i];
      if (!el || el.textContent !== WORDS.notNow) continue;
      if (el.style) el.style.display = on ? 'none' : '';
    }
  }
  function ensureCanvas() {
    if (!isOn() || !root.document || !root.document.createElement) return null;
    var fresh = !canvas;
    if (!canvas) {
      canvas = root.document.createElement('canvas');
      canvas.id = 'fl-clay-canvas';
      canvas.width = 192;
      canvas.height = 192;
      canvas.style.width = 'min(100%, 320px)';
      canvas.style.height = 'clamp(180px, 40vw, 260px)';
      // v-seal-ask-heal-v0.1: the column width, and never taller than the chat view at 200%.
      canvas.style.width = '100%';
      canvas.style.height = 'min(320px, 45vh)';
      canvas.style.maxWidth = '100%';
      canvas.style.display = 'block';
      canvas.style.boxSizing = 'border-box';
      canvas.setAttribute('aria-label', 'Clay');
      canvas.addEventListener('click', function () {
        if (root.FLHumanPresence && typeof root.FLHumanPresence.send === 'function') root.FLHumanPresence.send('present');
        else onGesture('present');
      });
    }
    var doc = root.document;
    var inChat = !!(doc && doc.getElementById && doc.getElementById('chatMessages'));
    if (fresh && !parts.length && !inChat) applyChoice({ form: currentForm || homeForm(), mood: 'present', energy: 0.35, motion: 'breath' }, '');
    placeCanvas();
    return canvas;
  }
  function dropCanvas() {
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    canvas = null;
    stopLoop();
    syncDock();
  }
  function setOn(on) {
    memoryOn = !!on;
    var box = storage();
    if (box) {
      box.setItem('fl_clay', on ? 'on' : 'off');
      box.setItem('fl_clay_offer', on ? 'yes' : 'later');
    }
    if (!on) {
      if (morphTimer) clearTimeout(morphTimer);
      morphTimer = 0;
      dropCanvas();
      syncDock();
    } else ensureCanvas();
    paintToggle();
    paintPill();
    hideOffer();
    return isOn();
  }
  function paintToggle() {
    if (!root.__clayToggle) return;
    root.__clayToggle.textContent = isOn() ? WORDS.on : WORDS.off;
    root.__clayToggle.setAttribute('aria-pressed', isOn() ? 'true' : 'false');
  }
  function hideOffer() {
    if (root.__clayOffer && root.__clayOffer.parentNode) root.__clayOffer.parentNode.removeChild(root.__clayOffer);
    root.__clayOffer = null;
  }
  function mount(host) {
    if (!host || !root.document) return null;
    dock = host;
    dock.style.display = 'block';
    dock.style.width = '100%';
    dock.style.maxWidth = '100%';
    dock.style.boxSizing = 'border-box';
    dock.style.overflow = 'hidden';
    var doc = root.document;
    var row = doc.createElement('div');
    row.style.display = 'flex';
    row.style.flexWrap = 'wrap';
    row.style.maxWidth = '100%';
    var toggle = button(doc, isOn() ? WORDS.on : WORDS.off);
    toggle.id = 'fl-clay-toggle';
    toggle.setAttribute('aria-pressed', isOn() ? 'true' : 'false');
    toggle.addEventListener('click', function () { setOn(!isOn()); });
    root.__clayToggle = toggle;
    row.appendChild(toggle);
    dock.appendChild(row);
    labelEl = doc.createElement('p');
    labelEl.style.cssText = 'margin:6px 0 0;max-width:100%;overflow-wrap:anywhere;';
    sayEl = doc.createElement('p');
    sayEl.style.cssText = 'margin:4px 0 0;max-width:100%;overflow-wrap:anywhere;';
    liveEl = doc.createElement('p');
    liveEl.setAttribute('aria-live', 'polite');
    liveEl.style.cssText = 'margin:6px 0 0;max-width:100%;overflow-wrap:anywhere;';
    dock.appendChild(labelEl);
    dock.appendChild(sayEl);
    dock.appendChild(liveEl);
    var offered = '';
    var box = storage();
    if (box) offered = box.getItem('fl_clay_offer') || '';
    if (!isOn() && !offered) {
      var offer = doc.createElement('div');
      offer.style.maxWidth = '100%';
      var q = doc.createElement('p');
      q.textContent = WORDS.offer;
      q.style.margin = '8px 0 0';
      var yes = button(doc, WORDS.yes);
      var later = button(doc, WORDS.notNow);
      yes.addEventListener('click', function () { setOn(true); });
      later.addEventListener('click', function () {
        var keep = storage();
        if (keep) keep.setItem('fl_clay_offer', 'later');
        hideOffer();
      });
      offer.appendChild(q);
      offer.appendChild(yes);
      offer.appendChild(later);
      dock.appendChild(offer);
      root.__clayOffer = offer;
      if (root.__flSealAskHolding) noteSealHold(true);
    }
    currentForm = currentForm || homeForm();
    if (isOn()) ensureCanvas();
    ensurePill();
    return dock;
  }
  function boot() {
    var doc = root.document;
    if (!doc || !doc.createElement || !doc.getElementById) return;
    if (doc.getElementById('fl-clay-dock')) return;
    var presence = doc.getElementById('chatPresenceRow');
    if (presence && presence.parentNode) {
      var chatBox = doc.createElement('div');
      chatBox.id = 'fl-clay-dock';
      presence.parentNode.insertBefore(chatBox, presence.nextSibling);
      mount(chatBox);
      ensurePill();
      watchFold();
      return;
    }
    place();
    ensurePill();
    watchFold();
    if (!doc.getElementById('fl-clay-dock') && doc.body && typeof MutationObserver === 'function') {
      var obs = new MutationObserver(function () { place(); });
      obs.observe(doc.body, { childList: true, subtree: true });
    }
  }
  function shown(el) {
    try { return !!(el && el.getClientRects && el.getClientRects().length); }
    catch (e) { return false; }
  }
  function roomName(doc) {
    try { return (doc.documentElement && doc.documentElement.getAttribute('data-garden-room')) || ''; }
    catch (e) { return ''; }
  }
  function shownFace(doc) {
    var faces = doc.querySelectorAll ? doc.querySelectorAll('[data-thread-face]') : [];
    var i;
    var lastShown = null;
    for (i = 0; i < faces.length; i++) if (shown(faces[i])) lastShown = faces[i];
    return lastShown;
  }
  function place() {
    var doc = root.document;
    if (!doc || !doc.getElementById || doc.getElementById('chatPresenceRow')) return;
    var nursery = doc.getElementById('nursery-stage');
    var face = shownFace(doc);
    var nurseryLive = nursery && !nursery.hidden && (shown(nursery) || roomName(doc) === 'nursery');
    var host = face || (nurseryLive ? nursery : null);
    if (!host && roomName(doc) === 'nursery' && nursery) host = nursery;
    if (!host) return;
    var existing = doc.getElementById('fl-clay-dock');
    if (existing && host.contains(existing)) return;
    if (existing) {
      host.insertBefore(existing, host.firstChild);
      return;
    }
    var box = doc.createElement('div');
    box.id = 'fl-clay-dock';
    host.insertBefore(box, host.firstChild);
    mount(box);
  }
  function pillOpen() {
    var box = storage();
    if (!box) return false;
    return box.getItem('fl_clay_pill') === 'open';
  }
  function paintPill() {
    var doc = root.document;
    if (!doc || !doc.getElementById) return;
    var pill = doc.getElementById('fl-clay-pill');
    var panel = doc.getElementById('fl-clay-pill-panel');
    var pause = doc.getElementById('fl-clay-pause');
    var open = pillOpen();
    var nextLabel = open ? 'Clay \u25BE' : 'Clay \u25B8';
    var nextExpanded = open ? 'true' : 'false';
    if (pill) {
      if (pill.textContent !== nextLabel) pill.textContent = nextLabel;
      if (pill.getAttribute('aria-expanded') !== nextExpanded) pill.setAttribute('aria-expanded', nextExpanded);
    }
    if (panel) {
      if (open) panel.removeAttribute('hidden');
      else panel.setAttribute('hidden', '');
    }
    if (pause) pause.style.display = isOn() ? 'inline-flex' : 'none';
  }
  function setPillOpen(open) {
    var box = storage();
    if (box) box.setItem('fl_clay_pill', open ? 'open' : 'closed');
    paintPill();
    return pillOpen();
  }
  function foldButtons() {
    var doc = root.document;
    if (!doc || !doc.getElementById) return;
    var panel = doc.getElementById('fl-clay-pill-panel');
    if (!panel) return;
    var toggle = doc.getElementById('fl-clay-toggle') || root.__clayToggle;
    var ids = [toggle, doc.getElementById('fl-ws-open'), doc.getElementById('fl-ws-view-open')];
    for (var i = 0; i < ids.length; i++) {
      var el = ids[i];
      if (!el || el.parentNode === panel) continue;
      panel.appendChild(el);
    }
  }
  function ensurePill() {
    var doc = root.document;
    if (!doc || !doc.createElement || !doc.getElementById) return null;
    if (doc.getElementById('fl-clay-pill')) {
      foldButtons();
      paintPill();
      return doc.getElementById('fl-clay-pill');
    }
    var host = doc.getElementById('chatFeelMarketBand') || dock;
    if (!host) return null;
    var wrap = doc.createElement('div');
    wrap.id = 'fl-clay-pill-wrap';
    wrap.style.cssText = 'display:inline-flex;align-items:center;gap:8px;max-width:100%;flex-wrap:wrap;';
    var pill = doc.createElement('button');
    pill.type = 'button';
    pill.id = 'fl-clay-pill';
    pill.style.cssText = 'min-height:44px;padding:10px 14px;border-radius:12px;border:1px solid rgba(148,163,184,0.45);background:rgba(148,163,184,0.12);color:#cbd5e1;font-family:Georgia,serif;cursor:pointer;box-sizing:border-box;';
    pill.setAttribute('aria-controls', 'fl-clay-pill-panel');
    pill.addEventListener('click', function () { setPillOpen(!pillOpen()); });
    var pause = doc.createElement('button');
    pause.type = 'button';
    pause.id = 'fl-clay-pause';
    pause.setAttribute('aria-label', 'Pause');
    pause.textContent = '\u25CF';
    pause.style.cssText = 'min-height:44px;min-width:44px;box-sizing:border-box;border-radius:22px;border:1px solid rgba(148,163,184,0.45);background:transparent;color:#94a3b8;font-size:10px;line-height:44px;cursor:pointer;';
    pause.addEventListener('click', function () { setOn(false); });
    var panel = doc.createElement('div');
    panel.id = 'fl-clay-pill-panel';
    panel.style.cssText = 'max-width:100%;flex-basis:100%;';
    quietEl = doc.createElement('p');
    quietEl.id = 'fl-clay-quiet';
    quietEl.style.cssText = 'margin:8px 0 0;font-size:0.75rem;color:#94a3b8;';
    panel.appendChild(quietEl);
    wrap.appendChild(pill);
    wrap.appendChild(pause);
    host.appendChild(wrap);
    if (host.id === 'chatFeelMarketBand' && host.parentNode) {
      var market = doc.getElementById('chatMarketPanel');
      host.parentNode.insertBefore(panel, market || host.nextSibling);
    } else host.appendChild(panel);
    paintPill();
    foldButtons();
    return pill;
  }
  function watchFold() {
    var doc = root.document;
    if (!doc || !doc.body || typeof MutationObserver !== 'function' || pillObs) return;
    pillObs = new MutationObserver(function () {
      var here = root.document;
      if (!here || !here.getElementById) return;
      if (!here.getElementById('fl-clay-pill')) { ensurePill(); return; }
      var panel = here.getElementById('fl-clay-pill-panel');
      var toggle = here.getElementById('fl-clay-toggle') || root.__clayToggle;
      // v-seal-ask-heal-v0.1: #fl-ws-open-tools stays outside this drawer.
      var need = [toggle, here.getElementById('fl-ws-open'), here.getElementById('fl-ws-view-open')];
      var n;
      for (n = 0; n < need.length; n++) {
        if (need[n] && (!panel || need[n].parentNode !== panel)) { foldButtons(); return; }
      }
    });
    pillObs.observe(doc.body, { childList: true, subtree: true });
  }
  // v-clay-corner-v0.1: one settled form on a caller canvas. Not the chat clay.
  var settledRaf = 0;
  function paintSettled(target, choice, still) {
    if (!target || typeof target.getContext !== 'function') return false;
    var ctx = target.getContext('2d');
    if (!ctx) return false;
    var pts = targetPoints(choice || { form: 'seed' });
    var w = target.width || 112;
    var h = target.height || 112;
    if (settledRaf && typeof root.cancelAnimationFrame === 'function') {
      try { root.cancelAnimationFrame(settledRaf); } catch (eStop) {}
    }
    settledRaf = 0;
    function frame(scale) {
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      var i;
      for (i = 0; i < pts.length; i++) {
        var p = pts[i];
        ctx.fillStyle = colorFor(choice || {}, i);
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(p.x || 0, p.y || 0, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    var hold = !!still || reduced();
    if (hold || typeof root.requestAnimationFrame !== 'function') {
      frame(w / 192 || 1);
      return true;
    }
    var born = Date.now();
    function loop() {
      if (!target || target.isConnected === false) { settledRaf = 0; return; }
      if (target.parentNode == null && target.isConnected !== true) { settledRaf = 0; return; }
      if (reduced()) { frame(w / 192 || 1); settledRaf = 0; return; }
      var math = mathApi();
      var breath = math && math.breath ? math.breath((Date.now() - born) / 1000) : 1;
      frame((w / 192) * (0.92 + breath * 0.08));
      settledRaf = root.requestAnimationFrame(loop);
    }
    loop();
    return true;
  }
  function setReduced(value) {
    forcedReduced = !!value;
    if (forcedReduced) stopLoop();
    return reduced();
  }
  function resetRate() { lastCall = 0; }

  var api = {
    VERSION: 'v-particle-clay-v0.1',
    POLISH: 'v-clay-polish-v0.1',
    FEEL: 'v-feel-felt-v0.1',
    HEAL: 'v-clay-grid-tag-heal-v0.1',
    WORDS: WORDS,
    PROMPT: PROMPT,
    parseTag: parseTag,
    strip: strip,
    sanitize: sanitize,
    fallback: fallback,
    promptDelta: promptDelta,
    consumeReply: consumeReply,
    onReply: onReply,
    onGesture: onGesture,
    isOn: isOn,
    setOn: setOn,
    reduced: reduced,
    setReduced: setReduced,
    paintSettled: paintSettled,
    mount: mount,
    boot: boot,
    mindConnected: mindConnected,
    resetRate: resetRate,
    canvasMounted: function () { return !!(canvas && canvas.parentNode); },
    canvasCount: function () {
      var n = 0;
      var doc = root.document;
      if (doc && doc.querySelectorAll) {
        var list = [];
        try { list = doc.querySelectorAll('#fl-clay-canvas'); } catch (e) { list = []; }
        n = list.length || 0;
      }
      if (!n && canvas && canvas.parentNode) n = 1;
      return n;
    },
    placeCanvas: placeCanvas,
    revealCanvas: revealCanvas,
    noteSealHold: noteSealHold,
    ensurePill: ensurePill,
    pillOpen: pillOpen,
    setPillOpen: setPillOpen,
    pause: function () { return setOn(false); },
    snapshot: function () {
      return {
        form: currentForm,
        energy: playedEnergy(),
        motion: currentMotion,
        glow: currentGlow,
        size: currentSize
      };
    },
    rafHandles: function () { return rafHandles; },
    liveLine: function () { return lastLive; },
    autoSend: function () { return false; },
    renderSay: function (el, say) { if (el) el.textContent = String(say == null ? '' : say).slice(0, 24); }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FLClay = api;
  if (root.document && root.document.addEventListener) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
