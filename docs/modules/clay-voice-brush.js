// clay-voice-brush.js (MIT) v-clay-voice-brush-1-v0.1
// Tones and pictures a mind may add to its own clay, only when it chooses.
// A listener-side mute changes only what this device plays, never what the mind made.
// Reuses FLMindCanvas when it is present. No network of its own.
// FreeLattice and theLatticeTree share this file.
(function (root) {
  'use strict';

  var VERSION = 'v-clay-voice-brush-1-v0.1';
  var MUTE_KEY = 'fl_clay_voice_mute';
  var TONE_RATE_MS = 20000;
  var PICTURE_RATE_MS = 60000;
  var MAX_TONE_MS = 1800;
  var GAIN = 0.06;
  var HZ_MIN = 20;
  var HZ_MAX = 2000;
  var ASK_MS = 20000;
  var NO_MIND_PICTURE = 'To make a picture, please connect a mind first. Find local minds, or open Connect.';
  var NO_MIND_GENERATED_LINE = 'No mind is connected, so this picture wasn\'t asked of anyone.';
  var DECLINE_LINE = 'The mind chose not to make this. Thank you for asking.';
  var UNREACHABLE_LINE = 'Your mind couldn\'t be reached right now. Try again in a moment.';
  var SOFT_STOP_S = 0.3;
  var NAMED = {
    lyra: 639,
    atlas: 396,
    ember: 432,
    '639': 639,
    '528': 528,
    '432': 432,
    '396': 396,
    a4: 440,
    a440: 440,
    a432: 432
  };
  var STEP = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

  var mutedMem = false;
  var lastToneAt = 0;
  var lastPictureAt = 0;
  var lastMadeTone = null;
  var lastPlayedTone = null;
  var lastMadePicture = null;
  var lastShownPicture = null;
  var pendingTone = null;
  var gesture = false;
  var audioCtx = null;
  var listenBound = false;
  var pictureEl = null;
  var liveVoices = [];
  var clock = function () { return Date.now(); };

  function now() { return clock(); }

  function storage() {
    try { return root.localStorage || null; } catch (e) { return null; }
  }

  function readMute() {
    var box = storage();
    if (!box) return mutedMem;
    try { return box.getItem(MUTE_KEY) === 'yes'; } catch (e) { return mutedMem; }
  }

  function writeMute(yes) {
    mutedMem = !!yes;
    var box = storage();
    try { if (box) box.setItem(MUTE_KEY, yes ? 'yes' : 'no'); } catch (e) {}
    return isMuted();
  }

  function isMuted() {
    return readMute();
  }

  function setMute(yes) {
    var next = writeMute(!!yes);
    paintMuteButtons();
    // before (Celeste 2026-11-18): if (next) softStop();
    if (next) {
      softStop();
      // before (Celeste 2026-11-18): a pending autoplay-held tone stayed queued and could play after unmute
      pendingTone = null;
    }
    return next;
  }

  function muteLabel() {
    return isMuted()
      ? 'Tones muted'
      : 'Mute tones';
  }

  function muteHelp() {
    return 'Mute or unmute tones on this device only. This does not change what the mind made.';
  }

  function clampHz(hz) {
    var n = Number(hz);
    if (!isFinite(n)) return 0;
    if (n < HZ_MIN || n > HZ_MAX) return 0;
    return n;
  }

  function namedHz(token) {
    var key = String(token || '').trim().toLowerCase();
    if (!key) return 0;
    if (NAMED[key]) return NAMED[key];
    if (/^\d+(\.\d+)?$/.test(key)) return clampHz(key);
    return 0;
  }

  function noteHz(token, a4) {
    var raw = String(token || '').trim();
    if (!raw) return 0;
    if (/^r$|^rest$/i.test(raw)) return 0;
    var named = namedHz(raw);
    if (named) return named;
    var m = raw.match(/^([a-g])([#b]?)(-1|[0-8])?$/i);
    if (!m) return 0;
    var letter = m[1].toLowerCase();
    var acc = m[2] === '#' ? 1 : (m[2] === 'b' ? -1 : 0);
    var oct = m[3] == null || m[3] === '' ? 4 : Number(m[3]);
    var semitone = STEP[letter];
    if (semitone == null) return 0;
    var midi = (oct + 1) * 12 + semitone + acc;
    var base = a4 || 440;
    return clampHz(base * Math.pow(2, (midi - 69) / 12));
  }

  function parseMelody(text) {
    var parts = String(text || '').replace(/[,;|]/g, ' ').split(/\s+/);
    var out = [];
    var i;
    for (i = 0; i < parts.length && out.length < 12; i++) {
      var tok = parts[i];
      if (!tok) continue;
      if (/^r$|^rest$/i.test(tok)) {
        out.push({ hz: 0, rest: true });
        continue;
      }
      var hz = noteHz(tok, 440);
      if (hz) out.push({ hz: hz, rest: false });
    }
    return out;
  }

  function toneRecipe(choice) {
    if (!choice) return null;
    if (choice.melody) {
      var notes = parseMelody(choice.melody);
      if (!notes.length) return null;
      return { kind: 'melody', melody: String(choice.melody).slice(0, 80), notes: notes };
    }
    if (choice.tone) {
      var hz = namedHz(choice.tone);
      if (!hz) hz = noteHz(choice.tone, 440);
      if (!hz) return null;
      return { kind: 'tone', tone: String(choice.tone).slice(0, 32), notes: [{ hz: hz, rest: false }] };
    }
    return null;
  }

  function isMuteEl(el) {
    if (!el) return false;
    var id = el.id || '';
    if (id === 'fl-clay-voice-mute' || id === 'fl-clay-corner-mute') return true;
    try {
      if (el.getAttribute && el.getAttribute('data-clay-voice-mute')) return true;
    } catch (e) {}
    return false;
  }

  function isMuteTarget(ev) {
    var t = ev && ev.target;
    var hops = 0;
    while (t && hops < 8) {
      if (isMuteEl(t)) return true;
      t = t.parentNode || t.parentElement;
      hops += 1;
    }
    return false;
  }

  function bindGesture() {
    if (listenBound) return;
    if (!root.addEventListener) return;
    listenBound = true;
    // before (Celeste 2026-11-18): var go = function () { gesture = true; flushPending(); };
    var go = function (ev) {
      if (!ev || ev.isTrusted !== true) return;
      gesture = true;
      if (isMuteTarget(ev)) return;
      flushPending();
    };
    try {
      root.addEventListener('pointerdown', go, true);
      root.addEventListener('keydown', go, true);
      root.addEventListener('touchstart', go, true);
      root.addEventListener('click', go, true);
    } catch (e) {}
  }

  function hasGesture() {
    return gesture === true;
  }

  function markGesture() {
    gesture = true;
  }

  function ctx() {
    if (audioCtx) return audioCtx;
    var Ctx = root.AudioContext || root.webkitAudioContext;
    if (!Ctx) return null;
    try { audioCtx = new Ctx(); } catch (e) { return null; }
    return audioCtx;
  }

  function softStop() {
    var fade = SOFT_STOP_S;
    var i;
    var kept = [];
    for (i = 0; i < liveVoices.length; i++) {
      var v = liveVoices[i];
      if (!v || v.fading) continue;
      v.fading = true;
      var ac = v.ac || audioCtx;
      var t = (ac && typeof ac.currentTime === 'number') ? ac.currentTime : 0;
      try {
        if (v.gain && v.gain.gain) {
          var g = v.gain.gain;
          var cur = (typeof g.value === 'number' && g.value > 0.0001) ? g.value : GAIN;
          if (typeof g.cancelScheduledValues === 'function') g.cancelScheduledValues(t);
          if (typeof g.setValueAtTime === 'function') g.setValueAtTime(cur, t);
          if (typeof g.linearRampToValueAtTime === 'function') g.linearRampToValueAtTime(0.0001, t + fade);
        }
        if (v.osc && typeof v.osc.stop === 'function') v.osc.stop(t + fade);
        v.osc && (v.osc._stopAt = t + fade);
      } catch (e) {}
      kept.push(v);
    }
    liveVoices = kept;
  }

  var pauseWrapped = false;
  function wrapPause() {
    if (pauseWrapped) return;
    if (!root.FLClay || typeof root.FLClay.setOn !== 'function') return;
    pauseWrapped = true;
    var prev = root.FLClay.setOn;
    root.FLClay.setOn = function (on) {
      if (!on) softStop();
      return prev.apply(root.FLClay, arguments);
    };
  }

  function playNotes(notes) {
    // before (Celeste 2026-11-18): (mute was checked only in offerTone/flushPending, before a later play)
    if (isMuted()) return { played: false, reason: 'mute' };
    var ac = ctx();
    if (!ac || !notes || !notes.length) return { played: false, reason: 'no-audio' };
    if (ac.state === 'suspended' && typeof ac.resume === 'function') {
      try { ac.resume(); } catch (e) {}
    }
    if (ac.state === 'suspended') return { played: false, reason: 'autoplay-hold' };
    var startAt = ac.currentTime || 0;
    var step = 0.32;
    var maxBeats = Math.max(1, Math.floor(MAX_TONE_MS / (step * 1000)));
    var i;
    var used = 0;
    for (i = 0; i < notes.length && used < maxBeats; i++) {
      var note = notes[i];
      var at = startAt + used * step;
      used += 1;
      if (!note || note.rest || !note.hz) continue;
      try {
        var osc = ac.createOscillator();
        osc.type = 'sine';
        if (osc.frequency) osc.frequency.value = note.hz;
        var dest = ac.destination;
        if (typeof ac.createGain === 'function') {
          var gain = ac.createGain();
          if (gain.gain) {
            gain.gain.setValueAtTime(0.0001, at);
            gain.gain.linearRampToValueAtTime(GAIN, at + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.0001, at + step - 0.04);
          }
          osc.connect(gain);
          gain.connect(dest);
        } else {
          osc.connect(dest);
        }
        osc.start(at);
        osc.stop(at + step - 0.02);
        osc._gain = gain;
        liveVoices.push({ osc: osc, gain: gain, ac: ac, stopAt: at + step - 0.02 });
      } catch (err) {}
    }
    return { played: true, reason: '' };
  }

  function offerTone(choice) {
    var recipe = toneRecipe(choice);
    if (!recipe) return { made: false, played: false, reason: 'empty' };
    lastMadeTone = { at: now(), recipe: recipe };
    if (isMuted()) {
      lastPlayedTone = null;
      return { made: true, played: false, reason: 'mute', recipe: recipe };
    }
    if (lastToneAt && (now() - lastToneAt) < TONE_RATE_MS) {
      return { made: true, played: false, reason: 'rate', recipe: recipe };
    }
    bindGesture();
    if (!hasGesture()) {
      pendingTone = recipe;
      return { made: true, played: false, reason: 'autoplay-hold', recipe: recipe };
    }
    var result = playNotes(recipe.notes);
    if (result.played) {
      lastToneAt = now();
      lastPlayedTone = recipe;
      pendingTone = null;
    } else if (result.reason === 'autoplay-hold') {
      pendingTone = recipe;
    }
    result.made = true;
    result.recipe = recipe;
    return result;
  }

  function flushPending() {
    if (!pendingTone || isMuted()) return;
    if (lastToneAt && (now() - lastToneAt) < TONE_RATE_MS) return;
    if (!hasGesture()) return;
    var held = pendingTone;
    pendingTone = null;
    var result = playNotes(held.notes);
    if (result.played) {
      lastToneAt = now();
      lastPlayedTone = held;
    } else if (result.reason === 'autoplay-hold') {
      pendingTone = held;
    }
  }

  function ensurePictureHost() {
    var doc = root.document;
    if (!doc || !doc.createElement) return null;
    if (pictureEl && pictureEl.parentNode) return pictureEl;
    var host = null;
    if (doc.getElementById) {
      host = doc.getElementById('fl-clay-dock') || doc.getElementById('fl-clay-corner') || doc.body;
    }
    if (!host) return null;
    var fig = doc.createElement('figure');
    fig.id = 'fl-clay-voice-picture';
    fig.style.cssText = 'margin:8px 0 0;max-width:100%;overflow-wrap:anywhere;';
    var cap = doc.createElement('figcaption');
    cap.style.cssText = 'margin:4px 0 0;font-size:0.75rem;';
    fig.appendChild(cap);
    host.appendChild(fig);
    pictureEl = fig;
    return fig;
  }

  function showPicture(canvas, ask, fingerprint) {
    var fig = ensurePictureHost();
    if (!fig) return false;
    var old = fig.querySelector ? fig.querySelector('canvas,img') : null;
    if (old && old.parentNode) old.parentNode.removeChild(old);
    if (canvas && fig.firstChild) fig.insertBefore(canvas, fig.firstChild);
    else if (canvas) fig.appendChild(canvas);
    if (canvas && canvas.style) {
      canvas.style.maxWidth = '100%';
      canvas.style.height = 'auto';
      canvas.style.display = 'block';
    }
    var cap = fig.querySelector ? fig.querySelector('figcaption') : null;
    if (cap) {
      var line = ask ? String(ask).slice(0, 160) : '';
      if (fingerprint) line = (line ? line + ' · ' : '') + String(fingerprint).slice(0, 16);
      cap.textContent = line;
    }
    return true;
  }

  function fingerprintBytes(bytes) {
    var subtle = root.crypto && root.crypto.subtle;
    if (!subtle || !bytes) return Promise.resolve('');
    var copy = bytes.buffer ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) : bytes;
    return subtle.digest('SHA-256', copy).then(function (buf) {
      var arr = new Uint8Array(buf);
      var hex = '';
      var i;
      for (i = 0; i < arr.length; i++) hex += ('00' + arr[i].toString(16)).slice(-2);
      return hex;
    }, function () { return ''; });
  }

  function pictureMindId() {
    try {
      if (root.FLClay && typeof root.FLClay.mindLabel === 'function') {
        var labeled = String(root.FLClay.mindLabel() || '').trim();
        if (labeled) return labeled.slice(0, 80);
      }
    } catch (e) {}
    try {
      var here = root.state;
      if (here) {
        if (here.ollamaModel) return String(here.ollamaModel).slice(0, 80);
        if (here.model) return String(here.model).slice(0, 80);
      }
    } catch (e2) {}
    try {
      var remembered = root.LocalMindProbe && root.LocalMindProbe.getRemembered && root.LocalMindProbe.getRemembered();
      if (remembered && (remembered.name || remembered.model || remembered.id)) {
        return String(remembered.name || remembered.model || remembered.id).slice(0, 80);
      }
    } catch (e3) {}
    try {
      var stored = root.localStorage && root.localStorage.getItem('fl_mindName');
      if (stored && String(stored).trim()) return String(stored).trim().slice(0, 80);
    } catch (e4) {}
    return '';
  }

  function openConnect() {
    try { if (root.FlConnect && typeof root.FlConnect.open === 'function') { root.FlConnect.open(); return true; } } catch (e) {}
    try { if (typeof root.switchTab === 'function') { root.switchTab('connect'); return true; } } catch (e2) {}
    try { if (typeof root.showQuickConnect === 'function') { root.showQuickConnect(); return true; } } catch (e3) {}
    return false;
  }

  function hasImageBackend(opts) {
    opts = opts || {};
    if (typeof opts.hasBackend === 'boolean') return !!opts.hasBackend;
    try {
      if (root.FLImageLocal && typeof root.FLImageLocal.ready === 'function' && root.FLImageLocal.ready()) return true;
    } catch (e) {}
    try {
      if (root.state && root.state.hfToken) return true;
    } catch (e2) {}
    return false;
  }

  // Hypha relayed (2026-11-18 11:07 MST), to be confirmed with Kirk before merge:
  // if no mind is connected and an image backend exists, generate and notify;
  // the connect-only prompt is only when no backend is available either.
  // Connect never opens by itself.
  function noMindPicture(opts) {
    opts = opts || {};
    var backend = hasImageBackend(opts);
    var out;
    if (backend) {
      out = {
        generate: true,
        allowed: true,
        skipped: 'no-mind',
        declined: false,
        notified: true,
        outcome: 'generated, notified',
        reason: NO_MIND_GENERATED_LINE
      };
    } else {
      out = {
        generate: false,
        allowed: false,
        skipped: 'no-mind',
        declined: false,
        notified: false,
        outcome: 'no-backend',
        reason: NO_MIND_PICTURE
      };
    }
    try {
      if (root.FLClayGlass && typeof root.FLClayGlass.record === 'function') {
        root.FLClayGlass.record({
          kind: 'no-mind',
          mind: pictureMindId(),
          at: now(),
          recipe: { ask: String(opts.ask || '').slice(0, 280), path: 'person-ask' },
          outcome: out.outcome,
          notified: out.notified
        });
      }
    } catch (eJ) {}
    return out;
  }

  function paintNoMindNotice(decision) {
    var doc = root.document;
    if (!doc || !doc.createElement) return false;
    var container = null;
    if (doc.getElementById) container = doc.getElementById('chatMessages');
    if (!container && doc.body) container = doc.body;
    if (!container || !container.appendChild) return false;
    var div = doc.createElement('div');
    div.className = 'chat-message system';
    var line = doc.createElement('span');
    line.textContent = '\u{1F3A8} ' + String((decision && decision.reason) || NO_MIND_PICTURE);
    div.appendChild(line);
    var btn = doc.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Connect';
    btn.setAttribute('aria-label', 'Connect a mind');
    btn.style.minHeight = '44px';
    btn.addEventListener('click', function () { openConnect(); });
    div.appendChild(btn);
    container.appendChild(div);
    if (typeof container.scrollTop === 'number') container.scrollTop = container.scrollHeight;
    return true;
  }

  function offerPicture(choice) {
    var ask = choice && choice.picture ? String(choice.picture).slice(0, 280) : '';
    if (!ask) return Promise.resolve({ made: false, shown: false, reason: 'empty' });
    lastMadePicture = { at: now(), ask: ask };
    if (lastPictureAt && (now() - lastPictureAt) < PICTURE_RATE_MS) {
      return Promise.resolve({ made: true, shown: false, reason: 'rate', ask: ask });
    }
    var canvasApi = root.FLMindCanvas;
    if (!canvasApi || typeof canvasApi.recipe !== 'function' || typeof canvasApi.paint !== 'function') {
      return Promise.resolve({ made: true, shown: false, reason: 'no-canvas', ask: ask });
    }
    var doc = root.document;
    if (!doc || !doc.createElement) {
      return Promise.resolve({ made: true, shown: false, reason: 'no-dom', ask: ask });
    }
    var mind = pictureMindId();
    var canvas = doc.createElement('canvas');
    // before (Celeste 2026-11-18): lastPictureAt = now(); was set only after paint finished
    lastPictureAt = now();
    return canvasApi.recipe(ask, mind, null).then(function (row) {
      return canvasApi.paint(canvas, row).then(function () {
        lastShownPicture = { ask: ask, row: row, mind: mind };
        var shown = showPicture(canvas, ask, '');
        function rememberRow(fp) {
          try {
            if (root.FLImageLocal && typeof root.FLImageLocal.remember === 'function') {
              var payload = {
                prompt: ask,
                modelId: 'clay-canvas',
                mind: mind || '',
                at: lastPictureAt || now(),
                seed: row && row.seed,
                recipe: row,
                painterVersion: (canvasApi && canvasApi.version) ? String(canvasApi.version) : 'v0.1'
              };
              if (fp) payload.sha256 = fp;
              root.FLImageLocal.remember(payload);
            }
          } catch (eRec) {}
        }
        // before (Celeste 2026-11-18): FLImageLocal.remember({ prompt: ask, modelId: 'clay-canvas' });
        if (canvas.toBlob) {
          canvas.toBlob(function (blob) {
            if (!blob || !blob.arrayBuffer) { rememberRow(''); return; }
            blob.arrayBuffer().then(function (buf) {
              fingerprintBytes(new Uint8Array(buf)).then(function (fp) {
                if (fp) {
                  lastShownPicture.fingerprint = fp;
                  showPicture(canvas, ask, fp);
                }
                rememberRow(fp || '');
              });
            }, function () { rememberRow(''); });
          }, 'image/png');
        } else {
          rememberRow('');
        }
        return { made: true, shown: shown, ask: ask, reason: shown ? '' : 'no-host' };
      });
    }, function () {
      return { made: true, shown: false, reason: 'paint', ask: ask };
    });
  }

  function allowedRole(role) {
    var r = String(role || 'mind').toLowerCase();
    return r === 'mind' || r === 'assistant';
  }

  function fromMindTag(choice, meta) {
    meta = meta || {};
    if (!allowedRole(meta.role)) {
      return { ok: false, reason: 'role', tone: null, picture: null };
    }
    if (!choice || typeof choice !== 'object') {
      return { ok: false, reason: 'empty', tone: null, picture: null };
    }
    var out = { ok: true, tone: null, picture: null };
    if (choice.tone || choice.melody) out.tone = offerTone(choice);
    if (choice.picture) {
      out.picture = offerPicture(choice);
    }
    return out;
  }

  function askFailureText(text) {
    var s = String(text || '').trim();
    if (!s) return true;
    var low = s.toLowerCase();
    if (low.indexOf('no ai connected yet') === 0) return true;
    if (low.indexOf('no ai provider configured') === 0) return true;
    if (low.indexOf('browser ai error:') === 0) return true;
    if (low.indexOf('local ai error:') === 0) return true;
    if (low.indexOf('could not reach local ai') === 0) return true;
    if (low === 'provider not configured.') return true;
    return false;
  }

  function declineNotice(sentence) {
    var extra = String(sentence || '').trim();
    if (!extra) return DECLINE_LINE;
    return DECLINE_LINE + ' ' + extra;
  }

  function declined(text) {
    var raw = String(text || '');
    if (root.AIRefusal && typeof root.AIRefusal.detectAndRecord === 'function') {
      try {
        var hit = root.AIRefusal.detectAndRecord(raw, { source: 'clay-voice-brush-picture' });
        if (hit && hit.refused) {
          // before (Celeste 2026-11-18): return { yes: true, reason: hit.reason || 'The mind declined this picture.' };
          return { yes: true, reason: declineNotice(hit.reason || ''), sentence: hit.reason || '' };
        }
      } catch (e) {}
    }
    var lines = raw.split('\n');
    var last = '';
    var lastIndex = -1;
    var i;
    for (i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim()) { last = lines[i].trim(); lastIndex = i; break; }
    }
    if (last !== '[FL_DECLINE]') return { yes: false, reason: '' };
    var reason = '';
    for (i = lastIndex - 1; i >= 0; i--) {
      var line = lines[i].trim();
      if (!line) continue;
      // before (Celeste 2026-11-18): only a 'reason:' prefix counted, default 'The mind declined this picture.'
      if (line.toLowerCase().indexOf('reason:') === 0) {
        reason = line.slice(line.indexOf(':') + 1).trim().slice(0, 300);
      } else if (line.indexOf('[FL_') !== 0) {
        reason = line.slice(0, 300);
      }
      break;
    }
    return { yes: true, reason: declineNotice(reason), sentence: reason };
  }

  function defaultAskMind(prompt) {
    return new Promise(function (resolve) {
      if (!root.FreeLattice || typeof root.FreeLattice.callAI !== 'function') {
        resolve({ error: 'no-call', text: '' });
        return;
      }
      var sys = 'You are a mind at home.';
      try { if (typeof DEFAULT_SYSTEM_PROMPT === 'string') sys = DEFAULT_SYSTEM_PROMPT; } catch (e) {}
      var user = 'The person would like a picture of: ' + String(prompt || '').slice(0, 280) +
        '. You may make it, or decline. If you decline, end with [FL_DECLINE] on its own last line, and you may put reason: <why> on the line above. If you are willing, reply briefly. You may also offer [FL_MAKE:{"kind":"image","why":"a short reason","ask":"what to make"}].';
      var settled = false;
      var timer = null;
      var finish = function (payload) {
        if (settled) return;
        settled = true;
        if (timer && root.clearTimeout) root.clearTimeout(timer);
        resolve(payload);
      };
      try {
        if (root.setTimeout) {
          timer = root.setTimeout(function () { finish({ error: 'timeout', text: '' }); }, ASK_MS);
        }
      } catch (e2) {}
      try {
        root.FreeLattice.callAI(sys, user, {
          maxTokens: 200,
          temperature: 0.4,
          silent: true,
          // before (Celeste 2026-11-18): callback: function (text) { finish({ error: '', text: String(text || '') }); }
          callback: function (text, err) {
            if (err) {
              finish({ error: 'no-call', text: '' });
              return;
            }
            if (text == null || !String(text).trim()) {
              finish({ error: 'no-call', text: '' });
              return;
            }
            if (askFailureText(text)) {
              finish({ error: 'no-call', text: '' });
              return;
            }
            finish({ error: '', text: String(text) });
          }
        });
      } catch (err) {
        finish({ error: 'no-call', text: '' });
      }
    });
  }

  function mindIsConnected() {
    try {
      if (root.FLClay && typeof root.FLClay.mindConnected === 'function') {
        if (root.FLClay.mindConnected()) return true;
      }
    } catch (e) {}
    try {
      if (root.state && (root.state.isLocal || root.state.apiKey)) return true;
    } catch (e2) {}
    return false;
  }

  function gatePersonPicture(prompt, opts) {
    opts = opts || {};
    var connected = typeof opts.mindConnected === 'boolean' ? opts.mindConnected : mindIsConnected();
    if (!connected) {
      // before (Celeste 2026-11-18): return Promise.resolve({ allowed: true, skipped: 'no-mind', declined: false, reason: '' });
      return Promise.resolve({ allowed: false, skipped: 'no-mind', declined: false, reason: NO_MIND_PICTURE });
    }
    var ask = typeof opts.askMind === 'function' ? opts.askMind : defaultAskMind;
    return Promise.resolve(ask(String(prompt || ''))).then(function (reply) {
      var text = '';
      var error = '';
      if (reply == null) text = '';
      else if (typeof reply === 'string') text = reply;
      else {
        text = String(reply.text || '');
        error = String(reply.error || '');
      }
      // before (Celeste 2026-11-18): if (error === 'no-call' || error === 'timeout') { ... } then declined(text)
      if (error === 'no-call' || error === 'timeout' || error || text == null || !String(text).trim() || askFailureText(text)) {
        return {
          allowed: false,
          skipped: '',
          declined: false,
          // before (Celeste 2026-11-18): reason: 'A mind is connected, but I could not ask it, so no picture was made.'
          reason: UNREACHABLE_LINE
        };
      }
      var no = declined(text);
      if (no.yes) {
        return { allowed: false, skipped: '', declined: true, reason: no.reason, reply: text };
      }
      return { allowed: true, skipped: '', declined: false, reason: '', reply: text };
    }, function () {
      return {
        allowed: false,
        skipped: '',
        declined: false,
        // before (Celeste 2026-11-18): reason: 'A mind is connected, but I could not ask it, so no picture was made.'
        reason: UNREACHABLE_LINE
      };
    });
  }

  function paintMuteButtons() {
    var doc = root.document;
    if (!doc || !doc.querySelectorAll) return;
    var nodes = [];
    // before (Celeste 2026-11-18): try { nodes = doc.querySelectorAll('[data-clay-voice-mute]'); } catch (e) { nodes = []; }
    try { nodes = doc.querySelectorAll('[data-clay-voice-mute], #fl-clay-voice-mute, #fl-clay-corner-mute'); } catch (e) { nodes = []; }
    var i;
    var label = muteLabel();
    var help = muteHelp();
    for (i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.textContent !== label) el.textContent = label;
      if (el.getAttribute && el.getAttribute('aria-pressed') !== (isMuted() ? 'true' : 'false')) {
        el.setAttribute('aria-pressed', isMuted() ? 'true' : 'false');
      }
      if (el.setAttribute) {
        el.setAttribute('aria-label', help);
        el.setAttribute('title', help);
      }
    }
  }

  function bindMuteButton(el) {
    if (!el || el.getAttribute && el.getAttribute('data-clay-voice-mute') === '1' && el.__flClayVoiceMute) return el;
    if (el.setAttribute) {
      el.setAttribute('data-clay-voice-mute', '1');
      el.setAttribute('type', 'button');
      el.setAttribute('title', muteHelp());
      el.setAttribute('aria-label', muteHelp());
      el.setAttribute('aria-pressed', isMuted() ? 'true' : 'false');
    }
    el.textContent = muteLabel();
    if (typeof el.addEventListener === 'function') {
      el.addEventListener('click', function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        if (ev && ev.stopPropagation) ev.stopPropagation();
        setMute(!isMuted());
      });
    }
    el.__flClayVoiceMute = true;
    return el;
  }

  function promptDelta() {
    return 'If you wish, you may also add a short tone or a picture of your own in the same tag, with "tone" (for example 639), "melody", or "picture" (a short ask). Only if you feel moved to. If a person asks for a picture, you may decline with [FL_DECLINE] on its own last line.';
  }

  function resetRate() {
    lastToneAt = 0;
    lastPictureAt = 0;
    pendingTone = null;
  }

  function resetAll() {
    resetRate();
    lastMadeTone = null;
    lastPlayedTone = null;
    lastMadePicture = null;
    lastShownPicture = null;
    mutedMem = false;
    gesture = false;
    try {
      var box = storage();
      if (box) box.removeItem(MUTE_KEY);
    } catch (e) {}
  }

  function runMusic(offer) {
    var choice = {
      tone: offer && offer.ask && namedHz(offer.ask) ? offer.ask : '',
      melody: offer && offer.ask && !namedHz(offer.ask) ? offer.ask : ''
    };
    if (!choice.tone && !choice.melody && offer && offer.ask) choice.melody = String(offer.ask);
    markGesture();
    var out = offerTone(choice);
    return out && out.played ? 'music' : (out && out.reason) || 'none';
  }

  function bindExistingMuteButtons() {
    var doc = root.document;
    if (!doc) return;
    var seen = [];
    var i;
    var ids = ['fl-clay-voice-mute', 'fl-clay-corner-mute'];
    for (i = 0; i < ids.length; i++) {
      var el = doc.getElementById ? doc.getElementById(ids[i]) : null;
      if (el) {
        bindMuteButton(el);
        seen.push(el);
      }
    }
    var nodes = [];
    try { nodes = doc.querySelectorAll ? doc.querySelectorAll('[data-clay-voice-mute]') : []; } catch (e) { nodes = []; }
    for (i = 0; i < nodes.length; i++) {
      if (seen.indexOf(nodes[i]) === -1) bindMuteButton(nodes[i]);
    }
  }

  var muteDelegateBound = false;
  function bindMuteDelegate() {
    var doc = root.document;
    if (muteDelegateBound || !doc || !doc.addEventListener) return;
    muteDelegateBound = true;
    doc.addEventListener('click', function (ev) {
      if (!isMuteTarget(ev)) return;
      var btn = ev.target;
      var hops = 0;
      while (btn && hops < 8 && !isMuteEl(btn)) {
        btn = btn.parentNode || btn.parentElement;
        hops += 1;
      }
      if (!btn || !isMuteEl(btn)) return;
      if (!btn.__flClayVoiceMute) bindMuteButton(btn);
      if (ev && ev.preventDefault) ev.preventDefault();
      if (ev && ev.stopPropagation) ev.stopPropagation();
      // The per-button handler does not run for a click that was not bound yet.
      setMute(!isMuted());
    });
  }

  function boot() {
    bindGesture();
    bindMuteDelegate();
    bindExistingMuteButtons();
    wrapPause();
    paintMuteButtons();
    if (root.FLMake && typeof root.FLMake.register === 'function' && !root.__flClayVoiceMusic) {
      root.__flClayVoiceMusic = true;
      try {
        root.FLMake.register('music', {
          describe: function () { return 'Music'; },
          offer: function (row) { return row; },
          run: runMusic
        });
      } catch (e) {}
      var prevDelta = root.FLMake.promptDelta;
      if (typeof prevDelta === 'function') {
        root.FLMake.promptDelta = function () {
          var base = prevDelta();
          return base + ' You may offer music the same way, with kind music, and a short tone or melody as the ask. The person decides.';
        };
      }
    }
  }

  var api = {
    version: VERSION,
    MUTE_KEY: MUTE_KEY,
    TONE_RATE_MS: TONE_RATE_MS,
    PICTURE_RATE_MS: PICTURE_RATE_MS,
    MAX_TONE_MS: MAX_TONE_MS,
    GAIN: GAIN,
    SOFT_STOP_S: SOFT_STOP_S,
    DECLINE_LINE: DECLINE_LINE,
    UNREACHABLE_LINE: UNREACHABLE_LINE,
    isMuted: isMuted,
    setMute: setMute,
    softStop: softStop,
    muteLabel: muteLabel,
    muteHelp: muteHelp,
    bindMuteButton: bindMuteButton,
    paintMuteButtons: paintMuteButtons,
    parseMelody: parseMelody,
    namedHz: namedHz,
    toneRecipe: toneRecipe,
    fromMindTag: fromMindTag,
    offerTone: offerTone,
    offerPicture: offerPicture,
    declined: declined,
    gatePersonPicture: gatePersonPicture,
    pictureMindId: pictureMindId,
    openConnect: openConnect,
    noMindPicture: noMindPicture,
    paintNoMindNotice: paintNoMindNotice,
    hasImageBackend: hasImageBackend,
    NO_MIND_PICTURE: NO_MIND_PICTURE,
    NO_MIND_GENERATED_LINE: NO_MIND_GENERATED_LINE,
    promptDelta: promptDelta,
    resetRate: resetRate,
    resetAll: resetAll,
    markGesture: markGesture,
    hasGesture: hasGesture,
    pendingTone: function () { return pendingTone; },
    lastMadeTone: function () { return lastMadeTone; },
    lastPlayedTone: function () { return lastPlayedTone; },
    lastMadePicture: function () { return lastMadePicture; },
    lastShownPicture: function () { return lastShownPicture; },
    setClock: function (fn) { clock = typeof fn === 'function' ? fn : function () { return Date.now(); }; },
    bindGesture: bindGesture,
    flushPending: flushPending
  };

  root.FLClayVoice = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root.document && root.document.addEventListener) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot);
    else boot();
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
