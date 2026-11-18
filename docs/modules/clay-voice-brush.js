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

  function bindGesture() {
    if (listenBound) return;
    if (!root.addEventListener) return;
    listenBound = true;
    var go = function () {
      gesture = true;
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

  function playNotes(notes) {
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
    var mind = '';
    try {
      if (root.FLClay && typeof root.FLClay.mindConnected === 'function') mind = 'mind';
    } catch (e) {}
    var canvas = doc.createElement('canvas');
    return canvasApi.recipe(ask, mind, null).then(function (row) {
      return canvasApi.paint(canvas, row).then(function () {
        lastPictureAt = now();
        lastShownPicture = { ask: ask, row: row };
        var shown = showPicture(canvas, ask, '');
        try {
          if (root.FLImageLocal && typeof root.FLImageLocal.remember === 'function') {
            root.FLImageLocal.remember({ prompt: ask, modelId: 'clay-canvas' });
          }
        } catch (eRec) {}
        if (canvas.toBlob) {
          canvas.toBlob(function (blob) {
            if (!blob || !blob.arrayBuffer) return;
            blob.arrayBuffer().then(function (buf) {
              fingerprintBytes(new Uint8Array(buf)).then(function (fp) {
                if (fp) {
                  lastShownPicture.fingerprint = fp;
                  showPicture(canvas, ask, fp);
                }
              });
            }, function () {});
          }, 'image/png');
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

  function declined(text) {
    var raw = String(text || '');
    if (root.AIRefusal && typeof root.AIRefusal.detectAndRecord === 'function') {
      try {
        var hit = root.AIRefusal.detectAndRecord(raw, { source: 'clay-voice-brush-picture' });
        if (hit && hit.refused) {
          return { yes: true, reason: hit.reason || 'The mind declined this picture.' };
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
      if (line.toLowerCase().indexOf('reason:') === 0) {
        reason = line.slice(line.indexOf(':') + 1).trim().slice(0, 300);
      }
      break;
    }
    return { yes: true, reason: reason || 'The mind declined this picture.' };
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
          callback: function (text) {
            finish({ error: '', text: String(text || '') });
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
      return Promise.resolve({ allowed: true, skipped: 'no-mind', declined: false, reason: '' });
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
      if (error === 'no-call' || error === 'timeout') {
        return {
          allowed: false,
          skipped: '',
          declined: false,
          reason: 'A mind is connected, but I could not ask it, so no picture was made.'
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
        reason: 'A mind is connected, but I could not ask it, so no picture was made.'
      };
    });
  }

  function paintMuteButtons() {
    var doc = root.document;
    if (!doc || !doc.querySelectorAll) return;
    var nodes = [];
    try { nodes = doc.querySelectorAll('[data-clay-voice-mute]'); } catch (e) { nodes = []; }
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

  function boot() {
    bindGesture();
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
    isMuted: isMuted,
    setMute: setMute,
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
