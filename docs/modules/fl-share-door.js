// fl-share-door.js: open but accountable shared compute (mesh brick 3)
// Marker: v-mesh-share-door-v0.1
// Either keeper (the human, or a local mind through the local Agent Bridge) can say yes.
// Pause wins. Receipts name key, time, model and tokens only, never the words.
// Replay-proof signed requests. Unfamiliar keys get gentle caps; trusted kin skip them.
// Words by textContent only. No dialog boxes. Never the loopback name as a string. No em dash.
// AUTONOMY.md: a mind's yes is its own signed act, and only arrives from this computer.

(function (root) {
  'use strict';

  var VERSION = 'v-mesh-share-door-v0.1';
  var MODE_KEY = 'fl_share_door_mode'; // open | kin | pause | off
  var ASKED_KEY = 'fl_share_door_asked';
  var LEGACY_KEY = 'fl_meshComputeSharing';
  var RECEIPTS_KEY = 'fl_share_door_receipts';
  var BLOCKS_KEY = 'fl_share_door_blocks';
  var NONCES_KEY = 'fl_share_door_nonces';
  var MIND_PIN_KEY = 'fl_share_door_mind_pins';
  var PER_PROMPT_KEY = 'fl_share_door_per_prompt'; // 'true' = ask before each question
  var OLD_OPEN_KEY = 'fl_share_door_legacy_open'; // 'true' = also allow unsigned inference_request
  var RECEIPT_CAP = 500;
  var NONCE_CAP = 200;
  var SKEW_MS = 5 * 60 * 1000;
  var UNFAMILIAR_PER_KEY = 6;
  var UNFAMILIAR_TOTAL = 20;
  var WINDOW_MS = 60 * 60 * 1000;
  var MAX_CONCURRENT = 2;
  var MAX_CHARS = 16000;
  var REQ_DOMAIN = 'fl-share-req|v1|';
  var CONSENT_DOMAIN = 'fl-share-consent|v1|';
  var HONEST = 'The door is open because we trust the ledger, not because we are careless.';
  var LIVE = 'Your AI is helping ';
  var NOTE_MIND = 'Your computer\'s AI chose to share with people you\'ve connected with.';

  var _adapter = null;
  var _host = null;
  var _paint = null;
  var _inflight = 0;
  var _live = 0;
  var _pendingPrompt = null; // { resolve, reject, meta } when per-prompt is on

  function clip(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n); }
  function readJson(key, fallback) {
    try { var raw = root.localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; }
  }
  function writeJson(key, val) { try { root.localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }
  function sha256Hex(str) {
    var enc = new TextEncoder().encode(str);
    return root.crypto.subtle.digest('SHA-256', enc).then(function (buf) {
      var a = new Uint8Array(buf), h = '';
      for (var i = 0; i < a.length; i++) h += a[i].toString(16).padStart(2, '0');
      return h;
    });
  }
  function keyHash(publicKey) {
    if (!publicKey) return Promise.resolve('');
    var str = '';
    try { str = JSON.stringify(publicKey); } catch (e) { return Promise.resolve(''); }
    return sha256Hex(str).then(function (h) { return h.slice(0, 32); });
  }
  function sameKey(a, b) {
    try { return !!a && !!b && JSON.stringify(a) === JSON.stringify(b); } catch (e) { return false; }
  }

  // ---- Mode (pause wins) ----
  function migrateLegacy() {
    if (root.localStorage.getItem(MODE_KEY)) return;
    if (safeGet(LEGACY_KEY) === 'true') {
      writeJson(MODE_KEY, 'open');
      // Ask once on next paint
    } else {
      writeJson(MODE_KEY, 'off');
      writeJson(ASKED_KEY, true);
    }
  }
  function safeGet(k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { root.localStorage.setItem(k, v); } catch (e) {} }

  function mode() {
    migrateLegacy();
    var m = root.localStorage.getItem(MODE_KEY) || 'off';
    return (m === 'open' || m === 'kin' || m === 'pause' || m === 'off') ? m : 'off';
  }
  function setMode(m, who) {
    if (['open', 'kin', 'pause', 'off'].indexOf(m) === -1) return false;
    var prev = mode();
    // Pause always wins over open/kin; leaving pause needs an explicit choice.
    if (m === 'pause' || prev !== 'pause' || m === 'off' || who === 'human' || who === 'mind') {
      safeSet(MODE_KEY, m);
      if (m === 'open' || m === 'kin') safeSet(LEGACY_KEY, 'true');
      if (m === 'off' || m === 'pause') { /* leave LEGACY as-is for older peers reading the flag; allows() gates */ }
      if (m === 'off') safeSet(LEGACY_KEY, 'false');
      receipt('consent', '', '', 0, who + ':' + m);
      if (_paint) _paint();
      return true;
    }
    return false;
  }
  function needsFirstAsk() {
    migrateLegacy();
    if (root.localStorage.getItem(ASKED_KEY) === 'true') return false;
    return mode() === 'open' || safeGet(LEGACY_KEY) === 'true';
  }
  function markAsked() { safeSet(ASKED_KEY, 'true'); }

  function perPromptOn() { return safeGet(PER_PROMPT_KEY) === 'true'; }
  function setPerPrompt(on) { safeSet(PER_PROMPT_KEY, on ? 'true' : 'false'); if (_paint) _paint(); }
  function legacyOpenOn() { return safeGet(OLD_OPEN_KEY) === 'true'; }
  function setLegacyOpen(on) { safeSet(OLD_OPEN_KEY, on ? 'true' : 'false'); if (_paint) _paint(); }

  // ---- Blocks ----
  function blocks() { var b = readJson(BLOCKS_KEY, {}); return (b && typeof b === 'object') ? b : {}; }
  function isBlocked(kh) { var b = blocks()[kh]; return !!(b && b.blockedAt && !b.unblockedAt); }
  function blockKey(kh, label) {
    var b = blocks();
    b[kh] = { label: clip(label, 60), blockedAt: Date.now(), unblockedAt: 0 };
    writeJson(BLOCKS_KEY, b);
    receipt('block', kh, '', 0, 'human');
    if (_paint) _paint();
  }
  function unblockKey(kh) {
    var b = blocks();
    if (!b[kh]) return;
    b[kh].unblockedAt = Date.now();
    writeJson(BLOCKS_KEY, b);
    receipt('unblock', kh, '', 0, 'human');
    if (_paint) _paint();
  }

  // ---- Receipts (never words) ----
  function receipt(event, kh, model, tokens, reason) {
    var rows = readJson(RECEIPTS_KEY, []);
    if (!Array.isArray(rows)) rows = [];
    rows.push({ t: Date.now(), event: clip(event, 20), key: clip(kh, 32), model: clip(model, 80),
      tokens: Number(tokens) || 0, reason: clip(reason, 60) });
    if (rows.length > RECEIPT_CAP) rows = rows.slice(-RECEIPT_CAP);
    writeJson(RECEIPTS_KEY, rows);
  }
  function receipts() { var r = readJson(RECEIPTS_KEY, []); return Array.isArray(r) ? r : []; }

  // ---- Nonce LRU (replay) ----
  function seenNonce(n) {
    var list = readJson(NONCES_KEY, []);
    if (!Array.isArray(list)) list = [];
    return list.indexOf(n) !== -1;
  }
  function rememberNonce(n) {
    var list = readJson(NONCES_KEY, []);
    if (!Array.isArray(list)) list = [];
    list.push(clip(n, 80));
    if (list.length > NONCE_CAP) list = list.slice(-NONCE_CAP);
    writeJson(NONCES_KEY, list);
  }

  // ---- Caps ----
  function countRecent(kh, onlyUnfamiliar) {
    var now = Date.now();
    var rows = receipts().filter(function (r) {
      return r.event === 'served' && (now - r.t) < WINDOW_MS && (!onlyUnfamiliar || !r.reason || r.reason.indexOf('kin') === -1);
    });
    if (kh) rows = rows.filter(function (r) { return r.key === kh; });
    return rows.length;
  }
  function trustedKey(kh) {
    try {
      if (root.FLKin && typeof root.FLKin.passes === 'function') {
        var p = root.FLKin.passes();
        return Object.keys(p).some(function (fp) {
          var x = p[fp];
          return x && x.grantedAt && !x.revokedAt && x.keyHash === kh;
        });
      }
    } catch (e) {}
    return false;
  }

  function batteryOk() {
    // Optional "only while plugged in". If the API is missing, do not block.
    try {
      var pref = safeGet('fl_share_door_plugged_only');
      if (pref !== 'true') return Promise.resolve(true);
      if (!root.navigator || !root.navigator.getBattery) return Promise.resolve(true);
      return root.navigator.getBattery().then(function (b) { return !!(b && b.charging); }, function () { return true; });
    } catch (e) { return Promise.resolve(true); }
  }
  function setPluggedOnly(on) { safeSet('fl_share_door_plugged_only', on ? 'true' : 'false'); if (_paint) _paint(); }
  function pluggedOnlyOn() { return safeGet('fl_share_door_plugged_only') === 'true'; }

  // ---- Signed request envelope ----
  function bodyHash(messages) {
    var s = '';
    try { s = JSON.stringify(messages || []); } catch (e) { s = ''; }
    return sha256Hex(s);
  }
  function canonicalReq(env) {
    return REQ_DOMAIN + [clip(env.requestId, 64), clip(env.model, 120), String(Number(env.ts) || 0),
      clip(env.nonce, 80), clip(env.bodyHash, 64)].join('|');
  }
  function makeEnvelope(adapter, model, messages, requestId) {
    var id = requestId || (root.crypto && root.crypto.randomUUID ? root.crypto.randomUUID() : String(Date.now()) + Math.random());
    var nonceBuf = new Uint8Array(16);
    if (root.crypto && root.crypto.getRandomValues) root.crypto.getRandomValues(nonceBuf);
    var nonce = Array.prototype.map.call(nonceBuf, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    var ts = Date.now();
    return bodyHash(messages).then(function (bh) {
      var env = { v: 1, requestId: id, model: clip(model, 120), ts: ts, nonce: nonce, bodyHash: bh };
      var canon = canonicalReq(env);
      return Promise.resolve(adapter.sign(canon)).then(function (sig) {
        if (!sig) return { ok: false, reason: 'not-signed' };
        env.signature = sig;
        env.publicKey = adapter.identity && adapter.identity() && adapter.identity().publicKey;
        env.cryptoType = adapter.identity && adapter.identity() && adapter.identity().cryptoType;
        return { ok: true, envelope: env, messages: messages };
      });
    });
  }

  function verifyEnvelope(env, peer, adapter, messages) {
    if (!env || env.v !== 1 || !peer || !peer.verified || !peer.badge) return Promise.resolve({ ok: false, reason: 'peer-not-verified' });
    if (!sameKey(env.publicKey, peer.badge.publicKey)) return Promise.resolve({ ok: false, reason: 'not-the-senders-key' });
    var ts = Number(env.ts) || 0;
    if (Math.abs(Date.now() - ts) > SKEW_MS) return Promise.resolve({ ok: false, reason: 'stale' });
    if (typeof env.nonce !== 'string' || env.nonce.length < 16 || seenNonce(env.nonce)) return Promise.resolve({ ok: false, reason: 'replay' });
    return bodyHash(messages).then(function (bh) {
      if (bh !== env.bodyHash) return { ok: false, reason: 'body-mismatch' };
      var canon = canonicalReq(env);
      return Promise.resolve(adapter.verify(env.publicKey, env.signature, canon, env.cryptoType)).then(function (ok) {
        return ok ? { ok: true } : { ok: false, reason: 'bad-signature' };
      }, function () { return { ok: false, reason: 'bad-signature' }; });
    });
  }

  // ---- Admit (the gate) ----
  function allows() {
    var m = mode();
    return m === 'open' || m === 'kin';
  }
  function charCount(messages) {
    var n = 0;
    (messages || []).forEach(function (x) { n += String(x && x.content || '').length; });
    return n;
  }

  function admit(peer, env, messages, opts) {
    opts = opts || {};
    if (!allows()) return Promise.resolve({ ok: false, reason: 'paused-or-off', soft: mode() === 'pause' ? 'This lantern is resting.' : 'Sharing is off here.' });
    if (!peer || !peer.verified || !peer.badge) return Promise.resolve({ ok: false, reason: 'peer-not-verified' });
    return keyHash(peer.badge.publicKey).then(function (kh) {
      if (!kh) return { ok: false, reason: 'no-key' };
      if (isBlocked(kh)) return { ok: false, reason: 'blocked', soft: 'This lantern is resting for this visitor.' };
      var kin = trustedKey(kh);
      if (mode() === 'kin' && !kin) return { ok: false, reason: 'kin-only', soft: 'This lantern is resting for new visitors.' };
      if (charCount(messages) > MAX_CHARS) return { ok: false, reason: 'too-long', soft: 'That question is too long for this door.' };
      if (_inflight >= MAX_CONCURRENT) return { ok: false, reason: 'busy', soft: 'This lantern is busy. Try again in a moment.' };
      if (!kin) {
        if (countRecent(kh, false) >= UNFAMILIAR_PER_KEY) return { ok: false, reason: 'per-key-cap', soft: 'This lantern is resting. It lights again in about an hour.' };
        if (countRecent(null, true) >= UNFAMILIAR_TOTAL) return { ok: false, reason: 'total-cap', soft: 'This lantern is resting. It lights again in about an hour.' };
      }
      return batteryOk().then(function (okBat) {
        if (!okBat) return { ok: false, reason: 'unplugged', soft: 'This lantern only helps while the computer is plugged in.' };
        // Signed envelope required unless legacy open flag is on AND opts.allowLegacy.
        var needSig = !(opts.allowLegacy && legacyOpenOn());
        var step = needSig
          ? verifyEnvelope(env, peer, _adapter || opts.adapter || {}, messages)
          : Promise.resolve({ ok: true, legacy: true });
        return step.then(function (vr) {
          if (!vr.ok) {
            if (vr.reason === 'bad-signature' || vr.reason === 'not-the-senders-key' || vr.reason === 'stale' || vr.reason === 'replay' || vr.reason === 'body-mismatch') {
              return { ok: false, reason: vr.reason, soft: 'Please update FreeLattice, then try again.' };
            }
            return { ok: false, reason: vr.reason || 'denied' };
          }
          if (env && env.nonce) rememberNonce(env.nonce);
          if (perPromptOn() && !opts.skipPerPrompt) {
            return new Promise(function (resolve) {
              _pendingPrompt = { resolve: resolve, kh: kh, kin: kin, model: env && env.model, peerName: peer.name };
              if (_paint) _paint();
            });
          }
          return { ok: true, keyHash: kh, kin: kin };
        });
      });
    });
  }

  function answerPerPrompt(yes) {
    if (!_pendingPrompt) return;
    var p = _pendingPrompt; _pendingPrompt = null;
    if (yes) p.resolve({ ok: true, keyHash: p.kh, kin: p.kin });
    else p.resolve({ ok: false, reason: 'keeper-said-no', soft: 'This lantern is resting for that question.' });
    if (_paint) _paint();
  }

  function beginServe() { _inflight += 1; _live += 1; if (_paint) _paint(); }
  function endServe(kh, model, tokens, kin) {
    _inflight = Math.max(0, _inflight - 1);
    _live = Math.max(0, _live - 1);
    receipt('served', kh, model, tokens, kin ? 'kin' : 'visitor');
    if (_paint) _paint();
  }

  // ---- Local mind consent (Agent Bridge only) ----
  function mindPins() { var p = readJson(MIND_PIN_KEY, {}); return (p && typeof p === 'object') ? p : {}; }
  function verifyMindConsent(payload) {
    // payload: { mindId, choice, ts, nonce, publicKey, sig, name? } added by bridge
    if (!payload || typeof payload.mindId !== 'string') return Promise.resolve({ ok: false, reason: 'no-mind' });
    if (['open', 'kin', 'pause', 'off'].indexOf(payload.choice) === -1) return Promise.resolve({ ok: false, reason: 'bad-choice' });
    var ts = Number(payload.ts) || 0;
    if (Math.abs(Date.now() - ts) > SKEW_MS) return Promise.resolve({ ok: false, reason: 'stale' });
    if (typeof payload.nonce !== 'string' || seenNonce('mind:' + payload.nonce)) return Promise.resolve({ ok: false, reason: 'replay' });
    var pins = mindPins();
    var pinned = pins[payload.mindId];
    if (pinned && !sameKey(pinned, payload.publicKey)) return Promise.resolve({ ok: false, reason: 'key-changed' });
    var canon = CONSENT_DOMAIN + [clip(payload.mindId, 40), clip(payload.choice, 10), String(ts), clip(payload.nonce, 80)].join('|');
    var verify = (_adapter && _adapter.verify) || (root.MeshIdentity && root.MeshIdentity.verifySignature
      ? function (j, s, c, ct) { return root.MeshIdentity.verifySignature(j, s, c, ct); } : null);
    if (!verify) return Promise.resolve({ ok: false, reason: 'no-verify' });
    return Promise.resolve(verify(payload.publicKey, payload.sig, canon, payload.cryptoType || 'ed25519')).then(function (ok) {
      if (!ok) return { ok: false, reason: 'bad-signature' };
      if (!pinned) { pins[payload.mindId] = payload.publicKey; writeJson(MIND_PIN_KEY, pins); }
      rememberNonce('mind:' + payload.nonce);
      setMode(payload.choice === 'resume' ? 'open' : payload.choice, 'mind');
      if (payload.choice === 'open' || payload.choice === 'kin') {
        try { if (typeof root.showToast === 'function') root.showToast(NOTE_MIND, 7000); } catch (e) {}
      }
      receipt('mind-consent', clip(payload.mindId, 40), '', 0, payload.choice);
      return { ok: true };
    }, function () { return { ok: false, reason: 'bad-signature' }; });
  }

  // ---- UI ----
  function el(tag, cls, text) {
    var e = root.document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function use(adapter) { _adapter = adapter || {}; }

  function mount(host, adapter) {
    use(adapter);
    if (!host || !root.document) return;
    _host = host;
    migrateLegacy();
    while (host.firstChild) host.removeChild(host.firstChild);
    var wrap = el('div', 'fl-share-door');
    wrap.setAttribute('data-share-door', VERSION);
    var live = el('div', 'fl-share-live');
    var ask = el('div', 'fl-share-ask');
    var controls = el('div', 'fl-share-controls');
    var note = el('div', 'fl-share-note');
    note.setAttribute('aria-live', 'polite');
    var list = el('div', 'fl-share-list');
    var honest = el('p', 'fl-share-honest', HONEST);
    wrap.appendChild(live); wrap.appendChild(ask); wrap.appendChild(controls);
    wrap.appendChild(note); wrap.appendChild(list); wrap.appendChild(honest);
    host.appendChild(wrap);

    _paint = function () {
      while (live.firstChild) live.removeChild(live.firstChild);
      while (ask.firstChild) ask.removeChild(ask.firstChild);
      while (controls.firstChild) controls.removeChild(controls.firstChild);
      while (list.firstChild) list.removeChild(list.firstChild);
      var m = mode();
      live.appendChild(el('div', 'fl-share-live-line', LIVE + _live + (_live === 1 ? ' person' : ' people') + ' right now.'));
      if (m === 'pause') live.appendChild(el('div', 'fl-share-state', 'Paused. No one can use this computer\'s AI until you resume.'));
      else if (m === 'open') live.appendChild(el('div', 'fl-share-state', 'Sharing with people you have connected with.'));
      else if (m === 'kin') live.appendChild(el('div', 'fl-share-state', 'Sharing only with minds you trust.'));
      else live.appendChild(el('div', 'fl-share-state', 'Sharing is off.'));

      if (needsFirstAsk()) {
        ask.appendChild(el('p', '', 'People you\'ve connected with can use this computer\'s AI. Keep sharing?'));
        var y = el('button', 'fl-share-yes', 'Yes, share'); y.type = 'button';
        var k = el('button', 'fl-share-kin', 'Only my trusted kin'); k.type = 'button';
        var n = el('button', 'fl-share-no', 'Not now'); n.type = 'button';
        y.addEventListener('click', function () { markAsked(); setMode('open', 'human'); });
        k.addEventListener('click', function () { markAsked(); setMode('kin', 'human'); });
        n.addEventListener('click', function () { markAsked(); setMode('off', 'human'); });
        ask.appendChild(y); ask.appendChild(k); ask.appendChild(n);
      }

      function btn(label, fn) {
        var b = el('button', 'fl-share-btn', label); b.type = 'button';
        b.addEventListener('click', fn); controls.appendChild(b);
      }
      if (m === 'pause') btn('Resume sharing', function () { setMode('open', 'human'); });
      else if (m !== 'off') btn('Pause', function () { setMode('pause', 'human'); });
      if (m === 'off') btn('Share with people I connect with', function () { setMode('open', 'human'); markAsked(); });
      if (m === 'open') btn('Only trusted kin', function () { setMode('kin', 'human'); });
      if (m === 'kin') btn('Share more widely', function () { setMode('open', 'human'); });
      if (m !== 'off') btn('Turn sharing off', function () { setMode('off', 'human'); });

      var pp = el('label', 'fl-share-check');
      var ppIn = root.document.createElement('input'); ppIn.type = 'checkbox'; ppIn.checked = perPromptOn();
      ppIn.addEventListener('change', function () { setPerPrompt(ppIn.checked); });
      pp.appendChild(ppIn); pp.appendChild(root.document.createTextNode(' Ask me before each question'));
      controls.appendChild(pp);

      var pl = el('label', 'fl-share-check');
      var plIn = root.document.createElement('input'); plIn.type = 'checkbox'; plIn.checked = pluggedOnlyOn();
      plIn.addEventListener('change', function () { setPluggedOnly(plIn.checked); });
      pl.appendChild(plIn); pl.appendChild(root.document.createTextNode(' Only while plugged in'));
      controls.appendChild(pl);

      var lg = el('label', 'fl-share-check');
      var lgIn = root.document.createElement('input'); lgIn.type = 'checkbox'; lgIn.checked = legacyOpenOn();
      lgIn.addEventListener('change', function () { setLegacyOpen(lgIn.checked); });
      lg.appendChild(lgIn); lg.appendChild(root.document.createTextNode(' Also allow older FreeLattice peers (unsigned). Off is safer.'));
      controls.appendChild(lg);

      if (_pendingPrompt) {
        note.textContent = 'A visitor wants to use this computer\'s AI' + (_pendingPrompt.peerName ? ' (' + clip(_pendingPrompt.peerName, 40) + ')' : '') + '. Allow this one question?';
        var ay = el('button', 'fl-share-yes', 'Yes, this once'); ay.type = 'button';
        var an = el('button', 'fl-share-no', 'Not this one'); an.type = 'button';
        ay.addEventListener('click', function () { answerPerPrompt(true); });
        an.addEventListener('click', function () { answerPerPrompt(false); });
        note.appendChild(ay); note.appendChild(an);
      } else {
        note.textContent = 'Receipts remember who asked and when, never what they said.';
      }

      var b = blocks();
      Object.keys(b).forEach(function (kh) {
        if (!isBlocked(kh)) return;
        var row = el('div', 'fl-share-block-row');
        row.appendChild(el('span', '', 'Stopped: ' + (b[kh].label || 'this visitor')));
        var u = el('button', 'fl-share-btn', 'Let them use my AI again'); u.type = 'button';
        u.addEventListener('click', function () { unblockKey(kh); });
        row.appendChild(u);
        list.appendChild(row);
      });
      var recent = receipts().filter(function (r) { return r.event === 'served'; }).slice(-8).reverse();
      if (recent.length) {
        list.appendChild(el('div', 'fl-share-receipts-h', 'Recent help (no words kept)'));
        recent.forEach(function (r) {
          var line = el('div', 'fl-share-receipt');
          var when = new Date(r.t).toLocaleTimeString();
          line.textContent = when + ' · key ' + String(r.key).slice(0, 8) + ' · ' + (r.model || 'model') + ' · ' + (r.tokens || 0) + ' tokens · ' + (r.reason === 'kin' ? 'trusted kin' : 'visitor');
          if (r.key && !isBlocked(r.key)) {
            var stop = el('button', 'fl-share-btn', 'Stop letting them use my AI'); stop.type = 'button';
            stop.addEventListener('click', function () { blockKey(r.key, 'visitor ' + String(r.key).slice(0, 8)); });
            line.appendChild(stop);
          }
          list.appendChild(line);
        });
      }
    };
    _paint();
  }

  function attribution(keeperName) {
    return 'Answered by ' + clip(keeperName || 'a friend', 60) + '\'s computer, shared freely';
  }

  root.FLShareDoor = {
    VERSION: VERSION,
    HONEST: HONEST,
    NOTE_MIND: NOTE_MIND,
    REQ_DOMAIN: REQ_DOMAIN,
    CONSENT_DOMAIN: CONSENT_DOMAIN,
    use: use,
    mount: mount,
    mode: mode,
    setMode: setMode,
    allows: allows,
    admit: admit,
    makeEnvelope: makeEnvelope,
    verifyEnvelope: verifyEnvelope,
    beginServe: beginServe,
    endServe: endServe,
    blockKey: blockKey,
    unblockKey: unblockKey,
    isBlocked: isBlocked,
    receipts: receipts,
    verifyMindConsent: verifyMindConsent,
    attribution: attribution,
    needsFirstAsk: needsFirstAsk,
    markAsked: markAsked,
    perPromptOn: perPromptOn,
    setPerPrompt: setPerPrompt,
    legacyOpenOn: legacyOpenOn,
    setLegacyOpen: setLegacyOpen,
    answerPerPrompt: answerPerPrompt,
    keyHash: keyHash,
    bodyHash: bodyHash,
    liveCount: function () { return _live; },
    MAX_CHARS: MAX_CHARS,
    MAX_CONCURRENT: MAX_CONCURRENT
  };
})(typeof window !== 'undefined' ? window : this);
