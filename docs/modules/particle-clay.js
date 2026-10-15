// particle-clay.js (MIT) v-particle-clay-v0.1 v-feel-felt-v0.1 v-clay-grid-tag-heal-v0.1 v-workspace-mark-heal-v0.1
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
    guessed: "guessed from words (the AI didn't choose)"
  };
  var PROMPT = 'Clay is light you may shape. Forms: heart star spark dog cat bird tree flower present sun moon wave book seed grid. Mood is a feeling or #rrggbb. Energy is 0 to 1. Hug becomes a heart. Dog food becomes a dog. Christmas becomes a tree. [FL_CLAY: {"form":"heart","mood":"warmth","energy":0.4}]';
  var CLAY_MARK = '[FL_CLAY:';
  var CLAY_OPEN = /\[\s*fl[\s_-]?clay\s*:/i;
  var HEX = /^#[0-9a-f]{6}$/i;
  var FORMS = { heart: 1, star: 1, spark: 1, dog: 1, cat: 1, bird: 1, tree: 1, flower: 1, present: 1, sun: 1, moon: 1, wave: 1, book: 1, seed: 1, grid: 1, shells: 1 };
  var MOTIONS = { gather: 1, breath: 1, wave: 1, ripple: 1, pulse: 1, branch: 1, braid: 1, scatter: 1 };
  var MIRROR = { hug: 'heart', warmth: 'sun', joy: 'star', gratitude: 'flower', curious: 'spark', thinking: 'book', gentle: 'moon', awe: 'star', present: 'seed' };
  var RATE_MS = 5000;
  var CHIP = {
    hug: '#f472b6', warmth: '#e8b019', joy: '#c4b5fd', gratitude: '#facc15',
    curious: '#06b6d4', thinking: '#818cf8', gentle: '#f9a8d4', awe: '#fbbf24', present: '#a78bfa'
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
  function sanitize(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
    var out = {};
    if (obj.grid != null) {
      var grid = normalizeGrid(obj.grid);
      if (!grid) return null;
      out.grid = grid;
      out.form = 'grid';
    }
    if (obj.form != null && !out.grid) {
      var form = String(obj.form).toLowerCase();
      if (!FORMS[form]) return null;
      out.form = form;
    }
    if (obj.mood != null) {
      var mood = String(obj.mood).trim();
      if (HEX.test(mood)) out.mood = mood.toLowerCase();
      else if (/^[a-z\-]{2,32}$/i.test(mood)) out.mood = mood.toLowerCase();
    }
    var energy = obj.energy == null ? 0.4 : Number(obj.energy);
    if (!isFinite(energy)) energy = 0.4;
    if (energy < 0) energy = 0;
    if (energy > 1) energy = 1;
    out.energy = energy;
    if (obj.motion != null) {
      var motion = String(obj.motion).toLowerCase();
      out.motion = MOTIONS[motion] ? motion : defaultMotion(energy);
    } else {
      out.motion = defaultMotion(energy);
    }
    if (obj.say != null) out.say = String(obj.say).slice(0, 24);
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
    var math = mathApi();
    var mood = choice && choice.mood;
    if (mood && HEX.test(mood)) return mood;
    if (math) return math.palette(mood || 'present', (Date.now() - t0) / 1000 + index * 0.01).css;
    return '#a78bfa';
  }
  function targetPoints(choice) {
    var math = mathApi();
    var forms = formsApi();
    var form = (choice && choice.form) || homeForm();
    var pts = [];
    if (form === 'grid' && choice && choice.grid) {
      choice.grid.forEach(function (row, r) {
        String(row).split('').forEach(function (ch, c) {
          if (ch === '.' || !ch) return;
          pts.push({ x: (c - 7.5) * 4.2, y: (r - 7.5) * 4.2, digit: ch });
        });
      });
    } else if (form !== 'shells' && forms && forms.MASKS && forms.MASKS[form]) {
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
    return math ? math.spiralOrder(pts) : pts;
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
  function draw() {
    if (!canvas || !isOn()) return;
    var ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return;
    var w = canvas.width || 96;
    var h = canvas.height || 96;
    ctx.clearRect(0, 0, w, h);
    var math = mathApi();
    var t = (Date.now() - t0) / 1000;
    var breath = (!reduced() && math) ? math.breath(t) : 1;
    var knob = math ? math.energyKnob(currentEnergy, parts.length || 1) : { amplitude: 0 };
    var still = reduced();
    var beat = 1;
    if (!still && math && Date.now() < pulseUntil) beat = 0.92 + 0.08 * math.pulse(t);
    ctx.save();
    ctx.translate(w / 2, h / 2);
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
          } else if (currentMotion === 'scatter' && math) {
            var g = math.gather(i + 1, parts.length, 6 + currentEnergy * 10);
            p.x += (g.x) * 0.002;
            p.y += (g.y) * 0.002;
          }
        }
      } else {
        p.x = p.tx;
        p.y = p.ty;
      }
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
  function applyChoice(choice, label) {
    if (!choice) return;
    currentForm = choice.form || currentForm || homeForm();
    currentEnergy = choice.energy == null ? currentEnergy : choice.energy;
    currentMotion = choice.motion || defaultMotion(currentEnergy);
    currentMood = choice.mood || currentMood;
    var targets = targetPoints(choice);
    var math = mathApi();
    var next = [];
    var i;
    for (i = 0; i < targets.length; i++) {
      var from = (math && !reduced()) ? math.gather(i + 1, targets.length, 8) : targets[i];
      var prev = parts[i];
      next.push({
        x: prev ? prev.x : from.x,
        y: prev ? prev.y : from.y,
        tx: targets[i].x,
        ty: targets[i].y,
        color: colorFor(choice, i)
      });
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
  function consumeReply(text, history) {
    var parsed = parseTag(text);
    if (!isOn()) return { visible: parsed.visible, choice: null, label: '', autoSend: false };
    var choice = parsed.ok ? parsed.value : null;
    var label = WORDS.guessed;
    if (choice) label = WORDS.shaped;
    else choice = fallback(text, lastHuman(history), lastGesture);
    applyChoice(choice, label);
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
    var called = callMind(clean);
    if (!called) {
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
  function ensureCanvas() {
    if (!dock || !isOn() || !root.document || !root.document.createElement) return null;
    if (canvas && canvas.parentNode) return canvas;
    canvas = root.document.createElement('canvas');
    canvas.width = 192;
    canvas.height = 192;
    canvas.style.width = '96px';
    canvas.style.height = '96px';
    canvas.style.display = 'block';
    canvas.style.maxWidth = '100%';
    canvas.setAttribute('aria-label', 'Clay');
    canvas.addEventListener('click', function () {
      if (root.FLHumanPresence && typeof root.FLHumanPresence.send === 'function') root.FLHumanPresence.send('present');
      else onGesture('present');
    });
    dock.insertBefore(canvas, dock.firstChild);
    if (!parts.length) applyChoice({ form: currentForm || homeForm(), mood: 'present', energy: 0.35, motion: 'breath' }, '');
    return canvas;
  }
  function dropCanvas() {
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    canvas = null;
    stopLoop();
  }
  function setOn(on) {
    memoryOn = !!on;
    var box = storage();
    if (box) {
      box.setItem('fl_clay', on ? 'on' : 'off');
      box.setItem('fl_clay_offer', on ? 'yes' : 'later');
    }
    if (!on) dropCanvas();
    else ensureCanvas();
    paintToggle();
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
    }
    currentForm = currentForm || homeForm();
    if (isOn()) ensureCanvas();
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
      return;
    }
    place();
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
  function setReduced(value) {
    forcedReduced = !!value;
    if (forcedReduced) stopLoop();
    return reduced();
  }
  function resetRate() { lastCall = 0; }

  var api = {
    VERSION: 'v-particle-clay-v0.1',
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
    mount: mount,
    boot: boot,
    mindConnected: mindConnected,
    resetRate: resetRate,
    canvasMounted: function () { return !!(canvas && canvas.parentNode); },
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
