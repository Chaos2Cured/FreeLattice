// tree-pool.js v-tree-pool-v0.1, layered by v-tree-pool-room-v0.2 (019a), and by
// v-tree-pool-honest-heals-v0.1 (030): (1) where BarcodeDetector is missing, a vendored
// jsQR 1.4.0 (Apache-2.0, docs/lib/jsqr, pinned by sha256 and loaded only after a tap) reads
// picture codes from the camera, and "Read a picture of the code" reads one from a photo or
// screenshot. (2) Honest reasons arrive: a hello to trusted kin carries one state word
// (helping, paused, off, asleep), so an asking device hears why, not only that no one helps.
// And by
// v-tree-no-install-mind-v0.1 (028): an awake in-browser mind (tree-browser-mind.js,
// WebLLM in this page) can be lent through the same door, kin only, Pause wins. It is
// asked in the page (TreeBrowserMind.chat), never fetched. The loopback-only rule for
// Ollama and the other apps is unchanged: still one fetch, to this computer's own AI.
//
//
// v-tree-pool-room-v0.2 (019a), browser only, still no server and empty iceServers:
//   - A room. One device hosts. Every other device joins once (scan or paste the
//     room invite) and the room then connects it to every other device in the room,
//     passing the connection codes over connections that already proved their keys.
//     A lab of 20 is 19 single joins, not 190 pairings, and any device already in
//     the room can let its neighbor in.
//   - Picture codes (QR, Nayuki's MIT encoder in docs/lib/qrcodegen.js). A phone
//     camera opens the Tree with the invite filled in (it rides after the #, which
//     a browser never sends). Where the browser can read codes (BarcodeDetector),
//     a tap lets this camera read an invite or a reply. Frames stay on this page.
//   - Ask the pool from Chat, by a human tap: each question goes whole to the
//     freest trusted kin device that holds the chosen mind. Kin only, Pause wins.
//   - After a reload this page remembers which room it was in (the room name only),
//     so one join brings it back; trusted kin stay trusted.
//   Splitting one model across machines (llama.cpp rpc-server) is 019b, not here:
//   a web page cannot start programs on a computer.
//
// Layer, never delete. The Device Pool for theLatticeTree (018), with a real
// share door. A Tree-native twin of FreeLattice fl-pool.js and fl-share-door.js,
// with the truths of 016, 016b and 016c already in:
//   - The door starts off. Only a human tap opens it, and only for trusted kin.
//   - Pause wins. While paused nothing is answered, and questions already
//     running are stopped. Only a human tap ("Resume for trusted kin") leaves it.
//   - The card always says the real door state, in plain words.
//   - Only help while plugged in (where the browser can tell).
//   - Limits like FreeLattice: 2 questions at a time, 16000 characters each.
//     FreeLattice lets trusted kin skip its hourly caps; the Tree lets no one
//     but trusted kin ask at all, so its hourly caps never apply here.
//   - Receipts are counts only. No words, names, keys or times are kept.
//
// What the door gates (it is real): a question from a connected device reaches
// this computer's own local AI only if the door is on, that device proved the
// key on a card you trusted (TreeKin.trustedKeyHash, from 017), and the limits
// allow it. Everything else is turned away with a plain reason.
//
// The first Tree channel. Two devices connect straight to each other with
// WebRTC, with no server in between (iceServers is empty, so no outside
// service is asked anything, and both devices must be on the same network,
// like a classroom lab on one wired network). One person taps Invite a
// device and sends the invite by text, email or chat; the other pastes it and
// sends back a reply. The invite and reply can carry each side's kin card, so
// one invite and one reply can make two devices kin and connected.
// When the channel opens, each side signs a fresh challenge bound to this
// connection's own encryption fingerprints, under tree-pool-proof|v1|, with
// the key from its kin card. Only a proved key can count as kin.
//
// Honest, v0.1: memory is not joined across machines. Each question goes whole
// to one device that holds the model, and the answer comes back. Splitting one
// big model across wired machines (llama.cpp rpc-server, MIT) and a one-tap
// "join this room" for a whole lab wait for 019. Connections last while the
// page stays open.
//
// No network until a human taps. Mounting makes no connection and no key.
// Words by textContent only. No dialog boxes. No em dash.
// Mirror: docs/code-settings.html (read that FIRST)
(function (root) {
  'use strict';

  // before v-tree-pool-room-v0.2: var VERSION = 'v-tree-pool-v0.1';
  var VERSION = 'v-tree-pool-room-v0.2';
  var DOOR_KEY = 'tree_pool_door';            // off | kin | pause (off until a human taps)
  var PLUG_KEY = 'tree_pool_plugged_only';    // 'true' = only help while plugged in
  var COUNTS_KEY = 'tree_pool_counts';        // numbers only
  var NAMES_KEY = 'tree_kin_names';           // read only: what the person typed for their own kin card
  var CODE_PREFIX = 'TREEPOOL1:';
  var PROOF_DOMAIN = 'tree-pool-proof|v1|';
  var MAX_CODE = 16000;
  var MAX_MSG = 70000;
  var MAX_CHARS = 16000;                      // same as FreeLattice share door
  var MAX_CONCURRENT = 2;                     // same as FreeLattice share door
  var MAX_PEERS = 24;
  var MAX_MODELS = 24;
  var MAX_TURNS = 40;
  var MAX_ANSWER = 32000;
  var GATHER_MS = 4000;
  var ANSWER_MS = 5 * 60 * 1000;
  var LOOPBACK = { '127.0.0.1': true, 'localhost': true, '[::1]': true };

  var HONEST = 'Memory is not joined across machines. Each question goes whole to one device that holds the model, and the answer comes back. ' +
    'Splitting one big model across machines is a later step.';
  // before v-tree-pool-room-v0.2: var LATER = 'Later (019): one tap to join a whole classroom lab, and one big model split across machines on a wired network (llama.cpp, MIT). Not in this card.';
  var LATER = 'Later (019), its second half: one big model split across machines on a trusted wired network (llama.cpp, MIT). It is possible but slow, for learning, or for a model too big for any one machine. A web page cannot start it, so it waits for a small helper. Not in this card.';
  var LIMITS = 'Limits: ' + MAX_CONCURRENT + ' questions at a time, each up to ' + MAX_CHARS + ' characters. Only trusted kin can ask. ' +
    'As on FreeLattice, trusted kin skip the hourly caps.';
  var RECEIPTS = 'Receipts keep counts only (asked, answered, turned away). Never words, names or keys.';

  var _host = null;
  var _parts = null;       // { state, door, connect, list, note }
  var _peers = {};         // id -> peer
  var _order = 0;
  var _pending = null;     // the inviter's peer waiting for a reply
  var _flow = { step: '', text: '', code: '', check: null, sdp: '', card: '' };
  var _inflight = {};      // key -> { ctrl, peerId, why }
  var _asks = {};          // askId -> { peerId, resolve, timer }
  var _drafts = {};        // peerId|model -> text being typed
  var _answers = {};       // peerId -> { model, text } shown this visit only
  var _askOpen = '';       // peerId|model with the ask box open

  // ---- small helpers ----
  function clip(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').slice(0, n); }
  function line(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n); }
  function num(x, max) { x = Number(x); return isFinite(x) && x >= 0 ? Math.min(x, max) : 0; }
  function safeGet(k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { root.localStorage.setItem(k, v); } catch (e) {} }
  function readJson(key, fallback) { try { var raw = safeGet(key); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; } }
  function subtle() { return root.crypto && root.crypto.subtle; }
  function kin() { return root.TreeKin || null; }
  function b64(buf) {
    var a = new Uint8Array(buf), s = '';
    for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
    return root.btoa(s);
  }
  function unb64(str) {
    var s = root.atob(str), a = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
    return a.buffer;
  }
  function utf8b64url(str) {
    return b64(new root.TextEncoder().encode(str).buffer).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlUtf8(str) {
    var s = String(str).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return new root.TextDecoder().decode(new Uint8Array(unb64(s)));
  }
  function nonce() {
    var a = new Uint8Array(16);
    if (root.crypto && root.crypto.getRandomValues) root.crypto.getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join('');
  }

  // ---- counts (receipts are counts only) ----
  function counts() { var c = readJson(COUNTS_KEY, {}); return (c && typeof c === 'object') ? c : {}; }
  function bump(field) {
    var c = counts();
    c[field] = (Number(c[field]) || 0) + 1;
    safeSet(COUNTS_KEY, JSON.stringify(c));
  }

  // ---- the door (pause wins; off until a human taps) ----
  function mode() {
    var m = safeGet(DOOR_KEY);
    return (m === 'kin' || m === 'pause' || m === 'off') ? m : 'off';
  }
  function setMode(m, who) {
    if (m !== 'kin' && m !== 'pause' && m !== 'off') return false;
    // Only a human opens the door, and opening it is also the only way out of pause.
    if (m === 'kin' && who !== 'human') return false;
    var prev = mode();
    safeSet(DOOR_KEY, m);
    if (m === 'kin' && prev !== 'kin') bump(prev === 'pause' ? 'resumed' : 'helpOn');
    if (m === 'pause' && prev !== 'pause') bump('paused');
    if (m === 'off' && prev !== 'off') bump('turnedOff');
    if (m !== 'kin') stopAll(m === 'pause' ? 'paused' : 'off');
    helloAll();
    paint();
    return true;
  }
  function letHelp() { return setMode('kin', 'human'); }
  function pause() { return setMode('pause', 'human'); }
  function turnOff() { return setMode('off', 'human'); }
  function pluggedOnly() { return safeGet(PLUG_KEY) === 'true'; }
  function setPluggedOnly(on) { safeSet(PLUG_KEY, on ? 'true' : 'false'); paint(); }
  function batteryOk() {
    try {
      if (!pluggedOnly()) return Promise.resolve(true);
      if (!root.navigator || !root.navigator.getBattery) return Promise.resolve(true);
      return root.navigator.getBattery().then(function (b) { return !!(b && b.charging); }, function () { return true; });
    } catch (e) { return Promise.resolve(true); }
  }
  function kinCount() { try { return kin() && kin().kinCount ? Number(kin().kinCount()) || 0 : 0; } catch (e) { return 0; } }
  function liveCount() { return Object.keys(_inflight).length; }

  // The one sentence the card leads with. It always matches the door.
  function doorLine() {
    var m = mode(), k = kinCount();
    if (m === 'pause') return 'Paused. No one can ask this computer\'s AI until you tap Resume for trusted kin.';
    if (m === 'kin' && k > 0) return 'Helping. Your trusted kin (' + k + ') can ask this computer\'s AI while their device is connected. No one else.';
    if (m === 'kin') return 'Helping, but you have no trusted kin yet, so no one can ask this computer\'s AI. Trade cards in Trusted kin above.';
    return 'Off. This computer\'s AI answers no one else until you tap Let this device help.';
  }

  // ---- this computer's own local AI (loopback only) ----
  function remembered() {
    try { return root.LocalMindProbe && root.LocalMindProbe.getRemembered ? root.LocalMindProbe.getRemembered() : null; } catch (e) { return null; }
  }
  // v-tree-no-install-mind-v0.1: the in-browser mind, when one is awake in this page.
  function browserMind() { var b = root.TreeBrowserMind; return b && typeof b.awakeModel === 'function' ? b : null; }
  function browserModels() { var b = browserMind(); var id = b ? line(b.awakeModel(), 120) : ''; return id ? [id] : []; }
  function localModels() {
    var m = remembered();
    // before v-tree-no-install-mind-v0.1: if (!m) return [];
    var bm = browserMind();
    var list = !m ? [] : (Array.isArray(m.models) && m.models.length) ? m.models : (m.model ? [m.model] : []);
    if (m && bm && bm.isEntry(m)) list = []; // a seated in-browser mind counts only while it is awake (below)
    var out = [];
    list.forEach(function (x) { var n = line(x && typeof x === 'object' ? x.name : x, 120); if (n && out.indexOf(n) === -1) out.push(n); });
    browserModels().forEach(function (n) { if (out.indexOf(n) === -1) out.push(n); }); // v-tree-no-install-mind-v0.1
    return out.slice(0, MAX_MODELS);
  }
  function localDoor(model) {
    // v-tree-no-install-mind-v0.1: the awake in-browser mind answers in this page. No fetch, no address.
    if (browserModels().indexOf(model) !== -1) return { ok: true, kind: 'in-page', model: model, url: '' };
    var m = remembered();
    var bmSeat = browserMind();
    if (m && bmSeat && bmSeat.isEntry(m)) return { ok: false, reason: model === m.model ? 'browser-mind-asleep' : 'no-such-model' };
    if (!m || !m.url) return { ok: false, reason: 'no-local-mind' };
    var u = null;
    try { u = new root.URL(String(m.url)); } catch (e) { u = null; }
    if (!u || !LOOPBACK[String(u.hostname || '').toLowerCase()]) return { ok: false, reason: 'no-local-mind' };
    if (localModels().indexOf(model) === -1) return { ok: false, reason: 'no-such-model' };
    var ollama = /:11434$/.test(u.host) || /\/api\/tags/.test(u.pathname) || String(m.id || '') === 'ollama';
    return { ok: true, kind: ollama ? 'ollama' : 'openai', model: model, url: u.origin + (ollama ? '/api/chat' : '/v1/chat/completions') };
  }
  function selfInfo() {
    var nav = root.navigator || {};
    return { mem: num(nav.deviceMemory, 64), cores: num(nav.hardwareConcurrency, 256), models: localModels() };
  }

  // ---- keys (the key from the kin card, 017) ----
  function algos(cryptoType) {
    return cryptoType === 'ed25519'
      ? { imp: { name: 'Ed25519' }, sig: { name: 'Ed25519' } }
      : { imp: { name: 'ECDSA', namedCurve: 'P-256' }, sig: { name: 'ECDSA', hash: 'SHA-256' } };
  }
  function myIdentity() {
    var K = kin();
    if (!K || !K.makeIdentity) return Promise.resolve(null);
    var n = readJson(NAMES_KEY, {}) || {};
    return Promise.resolve(K.makeIdentity(line(n.keeper, 60))).then(function (id) { return id || null; }, function () { return null; });
  }
  function sign(id, data) {
    return subtle().sign(algos(id.cryptoType).sig, id.keyPair.privateKey, new root.TextEncoder().encode(data)).then(b64);
  }
  function verify(publicKey, signature, data, cryptoType) {
    var a = algos(cryptoType);
    return Promise.resolve().then(function () {
      return subtle().importKey('jwk', publicKey, a.imp, true, ['verify']);
    }).then(function (key) {
      return subtle().verify(a.sig, key, unb64(signature), new root.TextEncoder().encode(data));
    }).then(function (ok) { return !!ok; }, function () { return false; });
  }
  function ownCardCode() {
    var K = kin(), n = readJson(NAMES_KEY, {}) || {};
    if (!K || !K.makeCard || !K.encodeCard || !line(n.ai, 60)) return Promise.resolve('');
    // before v-tree-pool-room-v0.2: .then(function (r) { return r && r.ok ? K.encodeCard(r.card) : ''; }, ...)
    return Promise.resolve(K.makeCard(n.ai, n.keeper)).then(function (r) {
      if (r && r.ok) return K.encodeCard(r.card);
      // v-tree-pool-room-v0.2: a device with no mind of its own rides its asking card instead.
      if (n.asks && K.makeAskerCard) return Promise.resolve(K.makeAskerCard(n.ai, n.keeper)).then(function (a) { return a && a.ok ? K.encodeCard(a.card) : ''; });
      return '';
    }, function () { return ''; });
  }

  // ---- codes (one pasteable line) ----
  function encode(obj) { return CODE_PREFIX + utf8b64url(JSON.stringify(obj)); }
  function decode(code, kind) {
    var s = String(code == null ? '' : code).replace(/\s+/g, '');
    if (!s || s.length > MAX_CODE) return null;
    var i = s.indexOf(CODE_PREFIX);
    if (i === -1) return null;
    var c = null;
    try { c = JSON.parse(b64urlUtf8(s.slice(i + CODE_PREFIX.length))); } catch (e) { return null; }
    if (!c || typeof c !== 'object' || c.v !== 1 || c.k !== kind || typeof c.sdp !== 'string' || c.sdp.length > MAX_CODE) return null;
    // before v-tree-pool-room-v0.2: return { sdp: c.sdp, card: typeof c.card === 'string' ? c.card.slice(0, 6000) : '' };
    return { sdp: c.sdp, card: typeof c.card === 'string' ? c.card.slice(0, 6000) : '', room: cleanRoom(c.room) };
  }
  function fingerprintOf(sdp) {
    var m = /a=fingerprint:(\S+) (\S+)/i.exec(String(sdp || ''));
    return m ? (m[1] + ' ' + m[2]).toUpperCase() : '';
  }
  // Both sides compute the same binding from the two fingerprints of this very connection.
  function binding(pc) {
    var a = fingerprintOf(pc.localDescription && pc.localDescription.sdp);
    var b = fingerprintOf(pc.remoteDescription && pc.remoteDescription.sdp);
    if (!a || !b) return '';
    return [a, b].sort().join('|');
  }

  // ---- the channel (WebRTC, no server; made only after a tap) ----
  function canConnect() { return !!(root.RTCPeerConnection && kin() && kin().makeIdentity && subtle()); }
  function newPc() { return new root.RTCPeerConnection({ iceServers: [] }); }
  function gather(pc) {
    return new Promise(function (resolve) {
      var done = false;
      function fin() { if (!done) { done = true; resolve(); } }
      if (pc.iceGatheringState === 'complete') return fin();
      try { pc.addEventListener('icegatheringstatechange', function () { if (pc.iceGatheringState === 'complete') fin(); }); } catch (e) {}
      root.setTimeout(fin, GATHER_MS);
    });
  }
  function newPeer(pc, side) {
    var id = 'p' + (++_order);
    var p = { id: id, pc: pc, dc: null, side: side, state: 'joining', myNonce: nonce(), me: null, their: null,
      proved: false, kh: '', meshId: '', hello: null, at: Date.now() };
    _peers[id] = p;
    try {
      pc.addEventListener('connectionstatechange', function () {
        var s = pc.connectionState;
        if (s === 'failed' || s === 'closed') closed(p, s === 'failed' ? 'failed' : 'closed');
      });
    } catch (e) {}
    return p;
  }
  function wire(p, dc) {
    p.dc = dc;
    dc.addEventListener('open', function () {
      p.state = 'open';
      bump('connected');
      // The reply has done its work once the channel opens; put the Connect part back to rest.
      if (_flow.step === 'replied' && _flow.peerId === p.id) { _flow = { step: '', text: '', code: '', check: null, sdp: '', card: '' }; paintConnect(); }
      sendRaw(p, { type: 'hi', v: 1, publicKey: p.me.publicKeyJwk, cryptoType: p.me.cryptoType, meshId: p.me.meshId, nonce: p.myNonce });
      paint();
    });
    dc.addEventListener('message', function (ev) {
      var data = ev && ev.data;
      if (typeof data !== 'string' || data.length > MAX_MSG) return;
      var msg = null;
      try { msg = JSON.parse(data); } catch (e) { return; }
      if (msg && typeof msg === 'object') handle(p, msg);
    });
    dc.addEventListener('close', function () { closed(p, 'closed'); });
  }
  function sendRaw(p, obj) {
    try { if (p.dc && p.dc.readyState === 'open') { p.dc.send(JSON.stringify(obj)); return true; } } catch (e) {}
    return false;
  }
  function closed(p, why) {
    if (!_peers[p.id] || p.state === 'closed' || p.state === 'set-aside') return; // set aside stays set aside
    p.state = 'closed';
    p.why = why;
    Object.keys(_inflight).forEach(function (k) { if (_inflight[k].peerId === p.id) { _inflight[k].why = 'closed'; try { _inflight[k].ctrl && _inflight[k].ctrl.abort(); } catch (e) {} } });
    if (_pending === p) _pending = null;
    roomClosed(p); // v-tree-pool-room-v0.2
    // Questions this page was waiting on from that device will not come back; say so now.
    Object.keys(_asks).forEach(function (id) {
      var a = _asks[id];
      if (a.peerId !== p.id) return;
      delete _asks[id];
      try { root.clearTimeout(a.timer); } catch (e) {}
      a.resolve({ ok: false, reason: 'no-answer' });
    });
    paint();
  }
  function disconnect(peerId) {
    var p = _peers[peerId];
    if (!p) return;
    try { if (p.dc) p.dc.close(); } catch (e) {}
    try { p.pc.close(); } catch (e2) {}
    closed(p, 'closed');
    delete _peers[peerId];
    paint();
  }
  function openCount() { return Object.keys(_peers).filter(function (id) { return _peers[id].state !== 'closed'; }).length; }
  function connectedCount() { return Object.keys(_peers).filter(function (id) { var s = _peers[id].state; return s === 'open' || s === 'proved'; }).length; }

  // Inviter: tap 1. Makes the key if needed (the kin card's key), the connection, and the invite.
  function invite() {
    if (!canConnect()) return Promise.resolve({ ok: false, reason: 'cannot' });
    if (openCount() >= MAX_PEERS) return Promise.resolve({ ok: false, reason: 'full' });
    if (_pending) { try { _pending.pc.close(); } catch (e) {} delete _peers[_pending.id]; _pending = null; }
    return myIdentity().then(function (me) {
      if (!me) return { ok: false, reason: 'cannot' };
      var pc = newPc(), p = newPeer(pc, 'invite');
      p.me = me;
      wire(p, pc.createDataChannel('tree-pool', { ordered: true }));
      return pc.createOffer().then(function (o) { return pc.setLocalDescription(o); }).then(function () { return gather(pc); })
        .then(ownCardCode).then(function (card) {
          _pending = p;
          bump('invites');
          // before v-tree-pool-room-v0.2: encode({ v: 1, k: 'invite', sdp: ..., card: card })
          return { ok: true, code: encode(withRoom({ v: 1, k: 'invite', sdp: pc.localDescription.sdp, card: card })), peerId: p.id };
        });
    }).catch(function () { return { ok: false, reason: 'cannot' }; });
  }
  // A card carried in an invite or reply is checked by Trusted kin (017), never trusted by itself.
  function checkCarried(card) {
    var K = kin();
    if (!card || !K || !K.checkCode) return Promise.resolve(null);
    return Promise.resolve(K.checkCode(card)).then(function (r) { return r || null; }, function () { return null; });
  }
  function trustCarried(r) {
    var K = kin();
    if (!r || !r.ok || r.trusted || !K || !K.grant) return;
    K.grant(r.fp, { name: r.body.name, model: r.body.model, keeperMeshId: r.body.keeperMeshId, keeperName: r.body.keeperName, keyHash: r.keyHash });
    try { if (K.repaint) K.repaint(); } catch (e) {}
  }
  // Joiner: reads an invite. Returns the carried card's check so the person can choose.
  function readInvite(code) {
    var c = decode(code, 'invite');
    if (!c) return Promise.resolve({ ok: false, reason: 'not-an-invite' });
    // before v-tree-pool-room-v0.2: { ok: true, sdp: c.sdp, card: r }
    return checkCarried(c.card).then(function (r) { return { ok: true, sdp: c.sdp, card: r, room: c.room }; });
  }
  // Joiner: tap. Answers the invite and makes the reply to send back.
  function join(sdp) {
    if (!canConnect()) return Promise.resolve({ ok: false, reason: 'cannot' });
    if (openCount() >= MAX_PEERS) return Promise.resolve({ ok: false, reason: 'full' });
    return myIdentity().then(function (me) {
      if (!me) return { ok: false, reason: 'cannot' };
      var pc = newPc(), p = newPeer(pc, 'join');
      p.me = me;
      pc.addEventListener('datachannel', function (ev) { if (ev && ev.channel && !p.dc) wire(p, ev.channel); });
      return pc.setRemoteDescription({ type: 'offer', sdp: sdp }).then(function () { return pc.createAnswer(); })
        .then(function (a) { return pc.setLocalDescription(a); }).then(function () { return gather(pc); })
        .then(ownCardCode).then(function (card) {
          bump('joins');
          return { ok: true, code: encode({ v: 1, k: 'reply', sdp: pc.localDescription.sdp, card: card }), peerId: p.id };
        });
    }).catch(function () { return { ok: false, reason: 'not-an-invite' }; });
  }
  function readReply(code) {
    var c = decode(code, 'reply');
    if (!c) return Promise.resolve({ ok: false, reason: 'not-a-reply' });
    if (!_pending) return Promise.resolve({ ok: false, reason: 'no-invite' });
    return checkCarried(c.card).then(function (r) { return { ok: true, sdp: c.sdp, card: r }; });
  }
  // Inviter: tap 2. Finishes the join with the reply.
  function finish(sdp) {
    var p = _pending;
    if (!p) return Promise.resolve({ ok: false, reason: 'no-invite' });
    return p.pc.setRemoteDescription({ type: 'answer', sdp: sdp }).then(function () {
      _pending = null;
      // If the channel has not opened in 30 seconds, say so plainly instead of waiting forever.
      root.setTimeout(function () { if (p.state === 'joining') closed(p, 'failed'); }, 30000);
      return { ok: true, peerId: p.id };
    }, function () { return { ok: false, reason: 'not-a-reply' }; });
  }

  // ---- messages on a channel ----
  function handle(p, msg) {
    if (p.state === 'closed' || p.state === 'set-aside') return;
    if (msg.type === 'hi' && msg.v === 1 && !p.their) {
      if (!msg.publicKey || typeof msg.publicKey !== 'object' || typeof msg.nonce !== 'string' || msg.nonce.length < 16 || msg.nonce.length > 80 ||
          (msg.cryptoType !== 'ed25519' && msg.cryptoType !== 'ecdsa-p256') || typeof msg.meshId !== 'string') return setAside(p);
      p.their = { publicKey: msg.publicKey, cryptoType: msg.cryptoType, meshId: line(msg.meshId, 64), nonce: msg.nonce };
      var bind = binding(p.pc);
      if (!bind) return setAside(p);
      sign(p.me, PROOF_DOMAIN + bind + '|' + p.their.nonce + '|' + p.me.meshId).then(function (sig) {
        sendRaw(p, { type: 'proof', v: 1, sig: sig });
      }, function () { setAside(p); });
      return;
    }
    if (msg.type === 'proof' && msg.v === 1 && p.their && !p.proved) {
      var b = binding(p.pc);
      if (!b || typeof msg.sig !== 'string' || msg.sig.length > 400) return setAside(p);
      var K = kin();
      Promise.resolve(K.meshIdFor(p.their.publicKey)).then(function (mid) {
        if (mid !== p.their.meshId) return false;
        return verify(p.their.publicKey, msg.sig, PROOF_DOMAIN + b + '|' + p.myNonce + '|' + p.their.meshId, p.their.cryptoType);
      }).then(function (ok) {
        if (!ok) return setAside(p);
        return Promise.all([K.keyHash(p.their.publicKey), K.keyHash(p.me.publicKeyJwk)]).then(function (two) {
          if (!two[0] || two[0] === two[1]) return setAside(p, two[0] && two[0] === two[1] ? 'own' : '');
          p.kh = two[0];
          p.meshId = p.their.meshId;
          p.proved = true;
          p.state = 'proved';
          bump('proved');
          hello(p);
          roomProved(p); // v-tree-pool-room-v0.2
          paint();
        });
      });
      return;
    }
    if (!p.proved) return;
    // v-tree-pool-room-v0.2: room messages, only on a connection that proved its key.
    if (typeof msg.type === 'string' && msg.type.indexOf('room-') === 0 && msg.v === 1) { roomMsg(p, msg); return; }
    if (msg.type === 'hello' && msg.v === 1) {
      if (!isKin(p)) return; // hellos are taken from trusted kin only
      p.hello = {
        helping: msg.helping === true,
        mem: num(msg.mem, 64),
        cores: num(msg.cores, 256),
        models: (Array.isArray(msg.models) ? msg.models : []).slice(0, MAX_MODELS).map(function (m) { return line(m, 120); }).filter(Boolean),
        busy: num(msg.busy, 64),           // v-tree-pool-room-v0.2: questions it is answering now
        max: num(msg.max, 64) || MAX_CONCURRENT,
        inBrowser: (Array.isArray(msg.inBrowser) ? msg.inBrowser : []).slice(0, MAX_MODELS).map(function (m) { return line(m, 120); }).filter(Boolean), // v-tree-no-install-mind-v0.1
        at: Date.now()
      };
      // v-tree-pool-honest-heals-v0.1: the state word, and the minds this connection has heard of
      // (kept in memory on this connection only), so a pause or a sleep can be named honestly.
      p.hello.state = HELP_STATES.indexOf(msg.state) !== -1 ? msg.state : (p.hello.helping ? 'helping' : 'off');
      p.knew = mergeNames(p.knew, p.hello.models);
      p.knewInBrowser = mergeNames(p.knewInBrowser, p.hello.inBrowser);
      bump('hellosTaken');
      paintList();
      paintChat(); // v-tree-pool-room-v0.2: the minds Chat can ask follow the hellos
      return;
    }
    if (msg.type === 'ask' && msg.v === 1) { serve(p, msg); return; }
    if (msg.type === 'answer' && msg.v === 1 && typeof msg.id === 'string' && _asks[msg.id]) {
      var a = _asks[msg.id];
      delete _asks[msg.id];
      try { root.clearTimeout(a.timer); } catch (e) {}
      a.resolve(msg.ok === true ? { ok: true, text: clip(msg.text, MAX_ANSWER) } : { ok: false, reason: line(msg.reason, 30) || 'denied' });
    }
  }
  function setAside(p, why) {
    if (p.state === 'set-aside') return;
    p.state = 'set-aside';
    p.asideWhy = why || '';
    p.proved = false;
    bump('setAside');
    try { if (p.dc) p.dc.close(); } catch (e) {}
    try { p.pc.close(); } catch (e2) {}
    paint();
  }
  function isKin(p) {
    try { return !!(p && p.proved && p.kh && kin() && kin().trustedKeyHash(p.kh)); } catch (e) { return false; }
  }
  // Hellos go to connected trusted kin only: rough memory, cores and model names while helping; nothing else.
  // v-tree-pool-honest-heals-v0.1: one state word for trusted kin. Nothing else new is sent.
  function helpState() {
    var m = mode();
    if (m === 'pause') return 'paused';
    if (m !== 'kin') return 'off';
    var r = remembered(), b = browserMind();
    if (r && b && b.isEntry(r) && !browserModels().length) return 'asleep';
    return 'helping';
  }
  function hello(p) {
    if (!isKin(p)) return false;
    var helping = mode() === 'kin';
    var info = helping ? selfInfo() : { mem: 0, cores: 0, models: [] };
    // before v-tree-pool-room-v0.2: { type: 'hello', v: 1, helping, mem, cores, models }
    // v-tree-no-install-mind-v0.1: inBrowser names which of those models run inside this browser.
    var ok = sendRaw(p, { type: 'hello', v: 1, helping: helping, mem: info.mem, cores: info.cores, models: info.models,
      busy: helping ? liveCount() : 0, max: MAX_CONCURRENT, inBrowser: helping ? browserModels() : [],
      state: helpState() }); // v-tree-pool-honest-heals-v0.1
    if (ok) bump('hellosSent');
    return ok;
  }
  var HELP_STATES = ['helping', 'paused', 'off', 'asleep']; // v-tree-pool-honest-heals-v0.1
  function mergeNames(a, b) {
    var out = (a || []).slice();
    (b || []).forEach(function (n) { if (out.indexOf(n) === -1) out.push(n); });
    return out.slice(-MAX_MODELS);
  }
  // Where a known helper is, in the words of its trusted card: "Kirk's computer".
  // A stopped card can keep the same key. Prefer the card that is trusted now.
  function passForKey(kh) {
    var K = kin(), first = null, trusted = null;
    try {
      var all = K && K.passes ? K.passes() : {};
      Object.keys(all).forEach(function (fp) {
        var x = all[fp];
        if (!x || x.keyHash !== kh) return;
        if (!first) first = x;
        if (x.grantedAt && !x.revokedAt && !trusted) trusted = x;
      });
    } catch (e) {}
    return trusted || first;
  }
  function peerPlace(p) {
    // before v-tree-pool-honest-heals-v0.1: the first pass with this key, even a stopped card with no keeper name
    var x = passForKey(p.kh);
    return (x && x.keeperName) ? line(x.keeperName, 40) + '\'s computer' : '';
  }
  // Why no trusted kin device answers for this mind, from the state words it sent. Kin only.
  function whyNone(model) {
    var best = null, rank = { paused: 3, asleep: 2, off: 1 };
    Object.keys(_peers).forEach(function (id) {
      var p = _peers[id];
      if (p.state !== 'proved' || !isKin(p) || !p.hello || (p.knew || []).indexOf(model) === -1) return;
      var st = p.hello.state;
      if (st === 'helping' && (p.knewInBrowser || []).indexOf(model) !== -1 && p.hello.models.indexOf(model) === -1) st = 'asleep';
      if (st === 'asleep' && (p.knewInBrowser || []).indexOf(model) === -1) st = '';
      if (rank[st] && (!best || rank[st] > rank[best.st])) best = { st: st, p: p };
    });
    if (!best) return null;
    // The reason stays no-helper (so every caller still reads it the same); why and where say more.
    return { ok: false, reason: 'no-helper', why: best.st, where: peerPlace(best.p) };
  }
  function helloAll() { Object.keys(_peers).forEach(function (id) { hello(_peers[id]); }); }

  // ---- the gate (helper side) ----
  function turnAway(p, id, reason) {
    bump('turnedAway');
    sendRaw(p, { type: 'answer', v: 1, id: id, ok: false, reason: reason });
    return { ok: false, reason: reason };
  }
  function cleanMessages(list) {
    if (!Array.isArray(list) || !list.length || list.length > MAX_TURNS) return null;
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var x = list[i];
      if (!x || (x.role !== 'user' && x.role !== 'assistant') || typeof x.content !== 'string') return null;
      out.push({ role: x.role, content: x.content });
    }
    return out;
  }
  function charCount(list) { return list.reduce(function (n, x) { return n + x.content.length; }, 0); }
  function admit(p, msg) {
    var id = typeof msg.id === 'string' ? msg.id.slice(0, 64) : '';
    var m = mode();
    if (m === 'pause') return Promise.resolve(turnAway(p, id, 'paused'));       // pause wins
    if (m !== 'kin') return Promise.resolve(turnAway(p, id, 'off'));
    if (!p || !p.proved) return Promise.resolve(turnAway(p, id, 'not-proved'));
    if (!isKin(p)) return Promise.resolve(turnAway(p, id, 'not-kin'));        // checked again on every question
    var messages = cleanMessages(msg.messages);
    if (!id || !messages || typeof msg.model !== 'string') return Promise.resolve(turnAway(p, id, 'bad-shape'));
    if (charCount(messages) > MAX_CHARS) return Promise.resolve(turnAway(p, id, 'too-long'));
    var door = localDoor(line(msg.model, 120));
    if (!door.ok) return Promise.resolve(turnAway(p, id, door.reason));
    if (liveCount() >= MAX_CONCURRENT) return Promise.resolve(turnAway(p, id, 'busy'));
    return batteryOk().then(function (okBat) {
      if (!okBat) return turnAway(p, id, 'unplugged');
      if (mode() !== 'kin') return turnAway(p, id, mode() === 'pause' ? 'paused' : 'off');
      if (liveCount() >= MAX_CONCURRENT) return turnAway(p, id, 'busy');
      return { ok: true, id: id, door: door, messages: messages };
    });
  }
  function serve(p, msg) {
    return admit(p, msg).then(function (a) {
      if (!a.ok) { paint(); return a; }
      var key = p.id + '|' + a.id;
      var ctrl = typeof root.AbortController === 'function' ? new root.AbortController() : null;
      _inflight[key] = { ctrl: ctrl, peerId: p.id, why: '' };
      helloAll(); // v-tree-pool-room-v0.2: kin learn this device is busier, so the pool can pick a freer one
      var timer = root.setTimeout(function () { if (_inflight[key]) { _inflight[key].why = 'local-ai-quiet'; try { ctrl && ctrl.abort(); } catch (e) {} } }, ANSWER_MS);
      paintState();
      var body = { model: a.door.model, stream: false, messages: a.messages }; // the same shape for Ollama and OpenAI-style doors
      var opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
      if (ctrl) opts.signal = ctrl.signal;
      // before v-tree-no-install-mind-v0.1: return root .fetch (a.door.url, opts).then(function (r) {  (spaced so the one-fetch smoke counts the live line only)
      // v-tree-no-install-mind-v0.1: an in-page door asks the in-browser mind here; Pause aborts it the same way.
      var asked = a.door.kind === 'in-page' ? inPage(a, ctrl) : root.fetch(a.door.url, opts).then(function (r) {
        if (!r.ok) throw new Error('status ' + r.status);
        return r.json();
      });
      return asked.then(function (j) {
        var text = (j && j.message && j.message.content) ||
          (j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
        var why = _inflight[key] ? _inflight[key].why : 'closed';
        if (why) throw new Error(why);
        if (mode() !== 'kin') throw new Error(mode() === 'pause' ? 'paused' : 'off'); // pause wins, even at the last moment
        if (!isKin(p)) throw new Error('not-kin');
        sendRaw(p, { type: 'answer', v: 1, id: a.id, ok: true, text: clip(text, MAX_ANSWER) });
        bump('answered');
        return { ok: true };
      }).catch(function (e) {
        var why = (_inflight[key] && _inflight[key].why) || String((e && e.message) || '');
        if (['paused', 'off', 'not-kin', 'closed'].indexOf(why) === -1) why = 'local-ai-quiet';
        if (why !== 'closed') turnAway(p, a.id, why);
        return { ok: false, reason: why };
      }).then(function (res) {
        try { root.clearTimeout(timer); } catch (e) {}
        delete _inflight[key];
        helloAll(); // v-tree-pool-room-v0.2
        paint();
        return res;
      });
    });
  }
  // v-tree-no-install-mind-v0.1: the in-browser mind answers in the same shape as Ollama's /api/chat.
  function inPage(a, ctrl) {
    var b = browserMind();
    if (!b) return Promise.reject(new Error('local-ai-quiet'));
    return b.chat(a.door.model, a.messages, { signal: ctrl ? ctrl.signal : null }).then(function (text) { return { message: { content: text } }; });
  }
  function stopAll(why) {
    Object.keys(_inflight).forEach(function (k) { _inflight[k].why = why; try { _inflight[k].ctrl && _inflight[k].ctrl.abort(); } catch (e) {} });
  }

  // ---- asking (asker side) ----
  function ask(peerId, model, text) {
    var p = _peers[peerId];
    var content = String(text == null ? '' : text);
    if (!p || p.state === 'closed' || p.state === 'set-aside') return Promise.resolve({ ok: false, reason: 'no-answer' });
    if (!isKin(p)) return Promise.resolve({ ok: false, reason: 'not-kin-here' });
    if (!p.hello || !p.hello.helping) return Promise.resolve({ ok: false, reason: 'off' });
    if (!content.trim()) return Promise.resolve({ ok: false, reason: 'empty' });
    if (content.length > MAX_CHARS) return Promise.resolve({ ok: false, reason: 'too-long' });
    var id = nonce();
    return new Promise(function (resolve) {
      _asks[id] = { peerId: p.id, resolve: resolve, timer: root.setTimeout(function () { if (_asks[id]) { delete _asks[id]; resolve({ ok: false, reason: 'no-answer' }); } }, ANSWER_MS + 15000) };
      if (!sendRaw(p, { type: 'ask', v: 1, id: id, model: line(model, 120), messages: [{ role: 'user', content: content }] })) {
        delete _asks[id];
        resolve({ ok: false, reason: 'no-answer' });
        return;
      }
      bump('asked');
    }).then(function (r) { if (r.ok) bump('answersTaken'); return r; });
  }
  function reasonWords(r) {
    // v-tree-pool-honest-heals-v0.1: the reason that arrived, with the place its trusted card names.
    var where = line(r && r.where, 60);
    var why = r && r.reason === 'no-helper' ? r.why : '';
    if (why === 'paused') return (where || 'That device') + ' is paused. Its keeper can tap Resume for trusted kin.';
    if (why === 'asleep') return 'The in-browser mind on ' + (where || 'that device') + ' is asleep.';
    if (why === 'off') return (where || 'That device') + ' is not helping right now.';
    var w = {
      paused: 'That device is paused. Its keeper can tap Resume for trusted kin.',
      off: 'That device is not helping right now.',
      'not-kin': 'That device has not trusted your card yet. Ask its keeper to tap Trust this AI.',
      'not-kin-here': 'You have not trusted that device\'s card, so nothing was sent.',
      'not-proved': 'That device has not finished checking your key. Try again in a moment.',
      'too-long': 'That question is too long for this door (' + MAX_CHARS + ' characters at most).',
      busy: 'That device is already answering ' + MAX_CONCURRENT + ' questions. Try again in a moment.',
      unplugged: 'That device only helps while it is plugged in.',
      'no-local-mind': 'That device has no local mind remembered right now.',
      'no-such-model': 'That device does not hold that model right now.',
      'local-ai-quiet': 'That device\'s own AI did not answer.',
      'no-answer': 'No answer came back. The connection may have closed.',
      empty: 'Type a question first.',
      // v-tree-pool-room-v0.2
      'no-helper': 'No trusted kin device that holds that mind is helping right now.',
      // v-tree-no-install-mind-v0.1
      'browser-mind-asleep': 'That device\'s in-browser mind is asleep. Its keeper can wake it in Settings, A mind with no install.'
    };
    return w[r && r.reason] || 'That question was turned away.';
  }

  // ---- the face ----
  var CSS = [
    '.tree-pool{max-width:40rem;margin:1rem auto 0;padding:1rem 1.1rem;background:rgba(12,10,26,0.78);border:1px solid rgba(232,176,25,0.32);border-radius:12px;color:rgba(226,232,240,0.94);font-family:Georgia,"Times New Roman",serif;font-size:1rem;line-height:1.55;text-align:left;}',
    '.tree-pool h3{margin:0 0 0.4rem;font-size:1.08rem;font-weight:600;color:rgba(232,176,25,0.95);}',
    '.tree-pool p{margin:0.45rem 0;}',
    '.tree-pool-quiet{color:rgba(200,210,230,0.82);font-size:0.95rem;}',
    '.tree-pool-state{color:#fff;font-weight:600;}',
    '.tree-pool button{min-height:44px;min-width:44px;margin:0.35rem 0.5rem 0.35rem 0;padding:10px 16px;border-radius:10px;border:1px solid rgba(232,176,25,0.5);background:rgba(232,176,25,0.12);color:#fff;font-family:inherit;font-size:1rem;cursor:pointer;}',
    '.tree-pool button.tree-pool-main{background:#e8b019;border-color:#e8b019;color:#0e0c1e;font-weight:600;}',
    '.tree-pool button:disabled{opacity:0.55;cursor:default;}',
    '.tree-pool button:focus-visible,.tree-pool textarea:focus-visible,.tree-pool input:focus-visible{outline:2px solid rgba(232,176,25,0.9);outline-offset:2px;}',
    '.tree-pool textarea{display:block;width:100%;box-sizing:border-box;min-height:5.5rem;margin:0.35rem 0;padding:10px 12px;border-radius:10px;border:1px solid rgba(200,210,230,0.35);background:rgba(0,0,0,0.35);color:#fff;font-size:1rem;font-family:inherit;}',
    '.tree-pool textarea.tree-pool-code{font-family:ui-monospace,Menlo,monospace;font-size:0.85rem;word-break:break-all;}',
    '.tree-pool textarea::placeholder{color:rgba(226,232,240,0.7);}',
    '.tree-pool-part{padding:0.6rem 0;border-top:1px solid rgba(200,210,230,0.16);}',
    '.tree-pool-row{padding:0.6rem 0;border-top:1px solid rgba(200,210,230,0.12);}',
    '.tree-pool-who{font-weight:600;color:#fff;}',
    '.tree-pool-answer{white-space:pre-wrap;word-break:break-word;color:#fff;background:rgba(0,0,0,0.25);border-radius:10px;padding:0.6rem 0.75rem;}',
    '.tree-pool-means{margin:0.4rem 0;padding-left:1.2rem;}',
    '.tree-pool-means li{margin:0.25rem 0;}',
    '.tree-pool-power{display:flex;align-items:center;gap:10px;min-height:44px;cursor:pointer;}',
    '.tree-pool-power input{width:22px;height:22px;flex:0 0 auto;}',
    // v-tree-pool-room-v0.2: picture codes and the camera view never push the page sideways
    '.tree-pool canvas.tree-pool-qr{display:block;width:100%;max-width:360px;height:auto;margin:0.5rem 0;image-rendering:pixelated;border-radius:6px;}',
    '.tree-pool video.tree-pool-scan{display:block;width:100%;max-width:320px;margin:0.4rem 0;border-radius:10px;background:#000;}',
    '.tree-pool-list{margin:0.3rem 0;padding-left:1.2rem;}',
    '@media (max-width:480px){.tree-pool{padding:0.9rem 0.8rem;}.tree-pool button{display:block;width:100%;margin:0.45rem 0;}}'
  ].join('\n');
  function addStyle() {
    var d = root.document;
    if (!d || !d.head || !d.createElement || (d.getElementById && d.getElementById('treePoolStyle'))) return;
    var st = d.createElement('style');
    st.id = 'treePoolStyle';
    st.textContent = CSS;
    d.head.appendChild(st);
  }
  function el(tag, cls, text) {
    var e = root.document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function button(label, fn, cls) {
    var b = el('button', cls || '', label);
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  }
  function empty(n) { while (n && n.firstChild) n.removeChild(n.firstChild); }
  function note(text) { if (_parts) _parts.note.textContent = text || ''; }
  function copy(text) {
    try {
      if (root.navigator && root.navigator.clipboard && root.navigator.clipboard.writeText) {
        root.navigator.clipboard.writeText(text).then(function () { note('Copied. Paste it into a message.'); }, function () { note('This browser would not copy. Select the code above and copy it by hand.'); });
        return;
      }
    } catch (e) {}
    note('This browser would not copy. Select the code above and copy it by hand.');
  }
  function peerName(p) {
    // before v-tree-pool-honest-heals-v0.1: the first pass with this key, even a stopped one
    var x = passForKey(p.kh);
    if (x) return (x.keeperName ? x.keeperName + '\'s computer' : 'A computer') + (x.name ? ' (' + x.name + ')' : '');
    return 'A device (ID ' + String(p.meshId || '').replace(/^mesh:/, '').slice(0, 8) + ')';
  }

  function paintState() {
    if (!_parts) return;
    var s = _parts.state, d = _parts.door;
    empty(s); empty(d);
    s.appendChild(el('p', 'tree-pool-state', doorLine()));
    var n = connectedCount(), live = liveCount();
    var kinOpen = Object.keys(_peers).filter(function (id) { return isKin(_peers[id]) && _peers[id].state !== 'closed'; }).length;
    s.appendChild(el('p', 'tree-pool-quiet', n ? ('Connected now: ' + n + (n === 1 ? ' device' : ' devices') + ', ' + kinOpen + ' of them trusted kin.') : 'No devices connected right now.'));
    if (live) s.appendChild(el('p', '', 'Your AI is answering ' + live + (live === 1 ? ' question' : ' questions') + ' right now.'));
    var m = mode();
    if (m === 'off') d.appendChild(button('Let this device help', function () { letHelp(); note('Helping. Only trusted kin can ask. Pause any time.'); }, 'tree-pool-main'));
    if (m === 'kin') d.appendChild(button('Pause helping', function () { pause(); note('Paused. Nothing is answered until you resume.'); }));
    if (m === 'pause') d.appendChild(button('Resume for trusted kin', function () { letHelp(); note('Helping again, for trusted kin only.'); }, 'tree-pool-main'));
    if (m !== 'off') d.appendChild(button('Turn off', function () { turnOff(); note('Off.'); }));
  }

  function codeBox(code, label) {
    var out = el('textarea', 'tree-pool-code');
    out.readOnly = true;
    out.value = code;
    out.setAttribute('aria-label', label);
    return out;
  }
  function pasteBox(label, placeholder) {
    var box = el('textarea', 'tree-pool-code');
    box.placeholder = placeholder;
    box.value = _flow.text || '';
    box.setAttribute('aria-label', label);
    box.addEventListener('input', function () { _flow.text = box.value; });
    return box;
  }
  function cardLine(r) {
    if (!r) return '';
    if (r.ok) return r.body.name + ' (' + r.body.model + '), from ' + (r.body.keeperName || 'someone') + '\'s computer.' +
      (r.trusted ? ' You already trust this card.' : ' This card checks out. Trust it only if you know who sent it.');
    if (r.reason === 'own-card') return 'That is your own invite.';
    return 'The kin card inside did not check out, so it was set aside.';
  }
  function paintConnect() {
    if (!_parts) return;
    var c = _parts.connect;
    stopScan(); // v-tree-pool-room-v0.2: a repaint closes any camera view
    empty(c);
    c.appendChild(el('p', 'tree-pool-who', 'Connect a device'));
    if (!canConnect()) {
      c.appendChild(el('p', 'tree-pool-quiet', 'This browser cannot connect devices here (it needs WebRTC and Trusted kin on this page).'));
      return;
    }
    var f = _flow;
    function reset() { _flow = { step: '', text: '', code: '', check: null, sdp: '', card: '' }; paintConnect(); }
    if (!f.step) {
      // v-tree-grandmother-door-v0.1: the guided way first. It opens a window with one big picture code.
      if (root.TreeDoor && typeof root.TreeDoor.share === 'function') {
        c.appendChild(button('Share this computer with a phone', function () { root.TreeDoor.share(); }, 'tree-pool-main'));
        c.appendChild(el('p', 'tree-pool-quiet', 'A window shows one picture code. Point the phone camera at it, tap Yes on the phone, then hold the phone up to this computer. Or use the steps below.'));
      }
      c.appendChild(el('p', 'tree-pool-quiet', 'Devices connect straight to each other, with no server in between, so both must be on the same network. ' +
        'One person taps Invite a device and sends the invite by text, email or chat. The other pastes it and sends back a reply. ' +
        'If you have made your kin card, it rides along, so one invite and one reply can make you kin and connected.'));
      c.appendChild(button('Invite a device', function () {
        note('Making an invite on this computer...');
        invite().then(function (r) {
          if (!r.ok) { note(r.reason === 'full' ? 'Too many devices are connected already.' : 'This browser could not make an invite.'); return; }
          _flow = { step: 'invited', text: '', code: r.code, check: null, sdp: '', card: '' };
          note('');
          paintConnect();
        });
      }));
      c.appendChild(button('Join with an invite', function () { _flow = { step: 'join-paste', text: '', code: '', check: null, sdp: '', card: '' }; paintConnect(); }));
      return;
    }
    if (f.step === 'invited') {
      // v-tree-pool-room-v0.2: a host's invite names its room, and it changes after each device joins.
      if (_room && _room.role === 'host') c.appendChild(el('p', 'tree-pool-state', 'Room ' + _room.id + ' invite. One device at a time: when it has joined, a new invite appears here on its own.'));
      else if (_room) c.appendChild(el('p', 'tree-pool-quiet', 'This invite lets a neighbor into Room ' + _room.id + '. The room connects it to everyone else.'));
      c.appendChild(el('p', '', '1. Send this invite to the other device by text, email or chat. It holds connection details and your kin card (if made). No chats, no secrets.'));
      c.appendChild(codeBox(f.code, 'Your invite, to copy'));
      c.appendChild(button('Copy invite', function () { copy(f.code); }));
      addQr(c, inviteUrl(f.code), 'Or let the other device scan this picture code. A phone camera opens the Tree with the invite filled in. Nothing is sent until someone taps Join there.', 'Picture code of your invite');
      c.appendChild(el('p', '', '2. When their reply comes back, paste it here.'));
      var rbox = pasteBox('Their reply', 'Paste the reply here (it starts with ' + CODE_PREFIX + ')');
      c.appendChild(rbox);
      var scanSpot = el('div', '');
      // v-tree-pool-room-v0.2: the Finish button below, by name, so a scanned reply can tap it too.
      var finishBtn = button('Finish joining', function () {
        f.text = rbox.value;
        readReply(rbox.value).then(function (r) {
          if (!r.ok) { note(r.reason === 'no-invite' ? 'That invite has closed. Tap Invite a device again.' : 'That does not look like a reply. A reply starts with ' + CODE_PREFIX + ' and is one long line.'); return; }
          if (r.card && r.card.ok && !r.card.trusted) { _flow = { step: 'reply-card', text: '', code: f.code, check: r.card, sdp: r.sdp, card: '' }; paintConnect(); return; }
          doFinish(r.sdp, r.card);
        });
      }, 'tree-pool-main');
      // before v-tree-pool-room-v0.2: c.appendChild(button('Finish joining', ..., 'tree-pool-main'));
      c.appendChild(finishBtn);
      if (canScan()) {
        c.appendChild(button('Scan their reply', function () {
          startScan(scanSpot, function (got) { rbox.value = got; f.text = got; finishBtn.click(); });
        }));
        c.appendChild(scanSpot);
      }
      pictureInto(c, function (got) { rbox.value = got; f.text = got; finishBtn.click(); }); // v-tree-pool-honest-heals-v0.1
      c.appendChild(button('Cancel', function () { if (_pending) disconnect(_pending.id); reset(); }));
      return;
    }
    if (f.step === 'reply-card' || f.step === 'invite-card') {
      c.appendChild(el('p', '', cardLine(f.check)));
      // v-tree-pool-room-v0.2
      if (f.step === 'invite-card' && f.room) c.appendChild(el('p', 'tree-pool-quiet', 'This invite opens Room ' + f.room.id + '. Joining connects you to the other devices in it, once you trust the device that sent it.'));
      c.appendChild(button(f.step === 'reply-card' ? 'Trust this AI and finish' : 'Trust this AI and join', function () {
        trustCarried(f.check);
        // before v-tree-pool-room-v0.2: ... else doJoin(f.sdp);
        if (f.step === 'reply-card') doFinish(f.sdp, f.check); else doJoin(f.sdp, f.room);
      }, 'tree-pool-main'));
      c.appendChild(button(f.step === 'reply-card' ? 'Finish without trusting' : 'Join without trusting', function () {
        if (f.step === 'reply-card') doFinish(f.sdp, f.check); else doJoin(f.sdp, f.room);
      }));
      c.appendChild(button('Cancel', function () { if (f.step === 'reply-card' && _pending) disconnect(_pending.id); reset(); }));
      return;
    }
    if (f.step === 'join-paste') {
      c.appendChild(el('p', '', 'Paste the invite you were sent.'));
      var ibox = pasteBox('The invite', 'Paste the invite here (it starts with ' + CODE_PREFIX + ')');
      c.appendChild(ibox);
      var scanSpotJ = el('div', '');
      // v-tree-pool-room-v0.2: the Join button by name, so a scanned invite can tap it too.
      var joinBtn = button('Join', function () {
        f.text = ibox.value;
        readInvite(ibox.value).then(function (r) {
          if (!r.ok) { note('That does not look like an invite. An invite starts with ' + CODE_PREFIX + ' and is one long line.'); return; }
          if (r.card && !r.card.ok && r.card.reason === 'own-card') { note('That is your own invite. Send it to the other device instead.'); return; }
          // before v-tree-pool-room-v0.2: { step: 'invite-card', ..., card: '' } and doJoin(r.sdp)
          if (r.card && r.card.ok && !r.card.trusted) { _flow = { step: 'invite-card', text: '', code: '', check: r.card, sdp: r.sdp, card: '', room: r.room }; paintConnect(); return; }
          doJoin(r.sdp, r.room);
        });
      }, 'tree-pool-main');
      // before v-tree-pool-room-v0.2: c.appendChild(button('Join', ..., 'tree-pool-main'));
      c.appendChild(joinBtn);
      if (canScan()) {
        c.appendChild(button('Scan an invite', function () {
          startScan(scanSpotJ, function (got) { ibox.value = got; f.text = got; joinBtn.click(); });
        }));
        c.appendChild(scanSpotJ);
      }
      pictureInto(c, function (got) { ibox.value = got; f.text = got; joinBtn.click(); }); // v-tree-pool-honest-heals-v0.1
      c.appendChild(button('Cancel', reset));
      return;
    }
    if (f.step === 'replied') {
      c.appendChild(el('p', '', 'Send this reply back to the person who invited you. The devices connect when they paste it.'));
      c.appendChild(codeBox(f.code, 'Your reply, to copy'));
      c.appendChild(button('Copy reply', function () { copy(f.code); }));
      addQr(c, f.code, 'Or hold this picture code up to the inviting device. It can read it with Scan their reply.', 'Picture code of your reply'); // v-tree-pool-room-v0.2
      c.appendChild(button('Done', reset));
      return;
    }
  }
  // before v-tree-pool-room-v0.2: function doJoin(sdp) {
  function doJoin(sdp, room) {
    note('Making a reply on this computer...');
    join(sdp).then(function (r) {
      if (!r.ok) { note(r.reason === 'full' ? 'Too many devices are connected already.' : 'That invite could not be used. Ask for a new one.'); return; }
      if (room && _peers[r.peerId]) _peers[r.peerId].roomJoin = room.id; // v-tree-pool-room-v0.2
      _flow = { step: 'replied', text: '', code: r.code, check: null, sdp: '', card: '', peerId: r.peerId };
      note('');
      paintConnect();
      paint();
    });
  }
  function doFinish(sdp) {
    finish(sdp).then(function (r) {
      if (!r.ok) { note('That reply could not be used. Tap Invite a device and try again.'); return; }
      _flow = { step: '', text: '', code: '', check: null, sdp: '', card: '' };
      note('Connecting... If nothing connects in a minute, the two devices may not be on the same network.');
      paintConnect();
      paint();
      // v-tree-pool-room-v0.2: a room host shows the next invite on its own.
      if (_room && _room.role === 'host') rollInvite();
    });
  }

  // v-tree-no-install-mind-v0.1: a hello card says which minds run inside a browser.
  function inBrowserLabel(list) { return function (model) { return list.indexOf(model) !== -1 ? model + ' (in-browser mind)' : model; }; }
  function paintList() {
    if (!_parts) return;
    var list = _parts.list;
    var active = root.document && root.document.activeElement;
    var refocus = active && active.getAttribute && active.getAttribute('data-ask-key');
    empty(list);
    var ids = Object.keys(_peers).filter(function (id) { return _peers[id] !== _pending || _peers[id].state !== 'joining'; });
    list.appendChild(el('p', 'tree-pool-who', 'Devices'));
    var me = el('div', 'tree-pool-row');
    var info = selfInfo();
    me.appendChild(el('div', 'tree-pool-who', 'This device'));
    me.appendChild(el('div', '', (info.mem ? 'about ' + info.mem + ' GB memory (the browser rounds this)' : 'memory not shared by this browser') +
      (info.cores ? ', ' + info.cores + ' cores' : '') + '. Minds: ' + (info.models.length ? info.models.map(inBrowserLabel(browserModels())).join(', ') : 'none remembered yet') + '.')); // v-tree-no-install-mind-v0.1: labels added
    list.appendChild(me);
    var total = info.mem, devices = 1;
    ids.forEach(function (id) {
      var p = _peers[id];
      var row = el('div', 'tree-pool-row');
      if (p.state === 'joining' || p.state === 'open') {
        row.appendChild(el('div', 'tree-pool-who', 'A device'));
        row.appendChild(el('div', 'tree-pool-quiet', p.state === 'open' ? 'Connected. Checking its key...'
          : (p.side === 'join' ? 'Waiting for the other device to paste your reply...' : 'Connecting...')));
      } else if (p.state === 'set-aside') {
        row.appendChild(el('div', 'tree-pool-who', 'A device'));
        row.appendChild(el('div', '', p.asideWhy === 'own' ? 'Set aside: that is this same browser (the same key). Connect a different device.'
          : 'Set aside: its key did not check out on this connection, so nothing is shared with it.'));
      } else if (p.state === 'closed') {
        row.appendChild(el('div', 'tree-pool-who', p.proved ? peerName(p) : 'A device'));
        row.appendChild(el('div', 'tree-pool-quiet', p.why === 'failed' ? 'The connection did not finish or was lost. Both devices must be on the same network, and some browsers keep their network address private. Chrome or Edge on both devices works best. Invite again to try once more.' : 'Disconnected. Invite again to reconnect.'));
      } else if (!isKin(p)) {
        row.appendChild(el('div', 'tree-pool-who', peerName(p)));
        row.appendChild(el('div', '', 'Connected, and its key checks out, but you have not trusted its card. Questions go only between trusted kin. Trade cards in Trusted kin above.'));
      } else {
        var h = p.hello;
        row.appendChild(el('div', 'tree-pool-who', peerName(p)));
        if (!h) row.appendChild(el('div', 'tree-pool-quiet', 'Trusted kin, connected. Waiting for its hello.'));
        else if (!h.helping) row.appendChild(el('div', '', 'Trusted kin, connected, not helping right now.'));
        else {
          total += h.mem; devices += 1;
          row.appendChild(el('div', '', 'Trusted kin, helping. ' + (h.mem ? 'about ' + h.mem + ' GB memory' : 'memory not shared') + (h.cores ? ', ' + h.cores + ' cores' : '') + '.'));
          if (!h.models.length) row.appendChild(el('div', 'tree-pool-quiet', 'No local mind shared yet.'));
          h.models.forEach(function (model) {
            var key = id + '|' + model;
            if (_askOpen !== key) {
              // before v-tree-no-install-mind-v0.1: button('Ask ' + model + ' on this device', ...)
              row.appendChild(button('Ask ' + inBrowserLabel(h.inBrowser || [])(model) + ' on this device', function () { _askOpen = key; paintList(); }));
              return;
            }
            var box = el('textarea', 'tree-pool-ask');
            box.placeholder = 'Your question for ' + model + ' on ' + peerName(p);
            box.value = _drafts[key] || '';
            box.setAttribute('aria-label', 'Your question for ' + model);
            box.setAttribute('data-ask-key', key);
            box.addEventListener('input', function () { _drafts[key] = box.value; });
            row.appendChild(box);
            row.appendChild(button('Ask', function () {
              _drafts[key] = box.value;
              note('Asking ' + model + ' on ' + peerName(p) + '...');
              ask(id, model, box.value).then(function (r) {
                if (!r.ok) { note(reasonWords(r)); return; }
                _answers[id] = { model: model, text: r.text };
                _drafts[key] = '';
                note('Answered by ' + peerName(p) + ', on its own AI. Nothing is kept here but a count.');
                paintList();
              });
            }, 'tree-pool-main'));
            row.appendChild(button('Close', function () { _askOpen = ''; paintList(); }));
            if (refocus === key) { try { root.setTimeout(function () { box.focus(); }, 0); } catch (e) {} }
          });
          var ans = _answers[id];
          if (ans) {
            row.appendChild(el('div', 'tree-pool-quiet', 'Last answer, from ' + ans.model + ' on that device (shown this visit only):'));
            row.appendChild(el('div', 'tree-pool-answer', ans.text || '(an empty answer)'));
          }
        }
      }
      if (p.state !== 'closed' && p !== _pending) row.appendChild(button('Disconnect', function () { disconnect(id); note('Disconnected.'); }));
      if (p.state === 'closed' || p.state === 'set-aside') row.appendChild(button('Remove', function () { delete _peers[id]; paint(); }));
      list.appendChild(row);
    });
    if (!ids.length) list.appendChild(el('p', 'tree-pool-quiet', 'No other devices yet. Tap Invite a device above, on one of them.'));
    list.appendChild(el('p', 'tree-pool-quiet', 'Side by side: about ' + total + ' GB across ' + devices + (devices === 1 ? ' device' : ' devices') + '. Not one memory.'));
  }

  function paint() {
    if (!_host || !_parts) return;
    paintState();
    paintList();
    paintRoom(); // v-tree-pool-room-v0.2
    paintChat(); // v-tree-pool-room-v0.2
  }

  // v-tree-no-install-mind-v0.1: waking or sleeping the in-browser mind refreshes the hellos.
  try { if (root.addEventListener) root.addEventListener('tree-browser-mind-changed', function () { helloAll(); paint(); }); } catch (eBm) {}
  function mount(host) {
    if (!host || !root.document) return;
    _host = host;
    addStyle();
    empty(host);
    var wrap = el('section', 'tree-pool');
    wrap.setAttribute('data-tree-pool', VERSION);
    wrap.setAttribute('aria-label', 'Device Pool');
    wrap.appendChild(el('h3', '', 'Device Pool'));
    wrap.appendChild(el('p', '', 'A classroom lab, or the old laptops at home, can each hold a mind. Connect the devices, trust each other\'s cards, ' +
      'tap Let this device help on each one that should answer, then ask from any of them.'));
    wrap.appendChild(el('p', 'tree-pool-quiet', HONEST));
    var state = el('div', 'tree-pool-part');
    state.setAttribute('aria-live', 'polite');
    var door = el('div', '');
    var connect = el('div', 'tree-pool-part');
    var n = el('p', 'tree-pool-note');
    n.setAttribute('aria-live', 'polite');
    var list = el('div', 'tree-pool-part');
    // before v-tree-pool-room-v0.2: state, door, n, connect, list
    var roomPart = el('div', 'tree-pool-part');
    var chatPart = el('div', 'tree-pool-part');
    wrap.appendChild(state); wrap.appendChild(door); wrap.appendChild(n); wrap.appendChild(connect); wrap.appendChild(roomPart); wrap.appendChild(list); wrap.appendChild(chatPart);
    var means = el('ul', 'tree-pool-means');
    means.appendChild(el('li', '', 'Whose AI: this computer\'s own local AI, the minds remembered in Settings.'));
    means.appendChild(el('li', '', 'What is shared: a question from a connected, trusted kin device runs on that AI, and the answer goes back to it. Nothing else on this computer is reachable.'));
    means.appendChild(el('li', '', 'Hellos go to connected trusted kin only, and carry this device\'s rough memory, cores and model names while helping. No chats, no keys.'));
    means.appendChild(el('li', '', 'Power: answering uses this computer\'s power and battery. Pause helping stops new questions and the ones already running.'));
    means.appendChild(el('li', '', LIMITS));
    means.appendChild(el('li', '', RECEIPTS));
    wrap.appendChild(means);
    var pw = el('label', 'tree-pool-power');
    var pwIn = root.document.createElement('input');
    pwIn.type = 'checkbox';
    pwIn.checked = pluggedOnly();
    pwIn.addEventListener('change', function () { setPluggedOnly(pwIn.checked); });
    pw.appendChild(pwIn);
    pw.appendChild(el('span', '', 'Only help while plugged in (some browsers cannot tell; then this does not stop help)'));
    wrap.appendChild(pw);
    wrap.appendChild(el('p', 'tree-pool-quiet', 'Connections last while this page stays open. After a reload, invite again. Works best on one wired network, like a classroom lab; some school or guest Wi-Fi keeps devices apart, and then the join does not finish.'));
    wrap.appendChild(el('p', 'tree-pool-quiet', LATER));
    host.appendChild(wrap);
    // before v-tree-pool-room-v0.2: _parts = { state, door, connect, list, note }
    _parts = { state: state, door: door, connect: connect, list: list, note: n, room: roomPart, chat: chatPart };
    // v-tree-pool-room-v0.2: an invite that came with the link (after the #) waits for a human tap on Join.
    if (_arrived && !_flow.step) {
      _flow = { step: 'join-paste', text: _arrived, code: '', check: null, sdp: '', card: '' };
      _arrived = '';
      note('An invite came with the link you opened. Nothing has been sent. Tap Join when you are ready.');
    }
    paintConnect();
    paint();
  }

  try {
    if (root.addEventListener) {
      root.addEventListener('fl-alpha-mind-remembered', function () { helloAll(); paint(); });
      // v-tree-pool-v0.1: Trusted kin (017) says when a pass is given or stopped.
      root.addEventListener('tree-kin-changed', function () { helloAll(); paint(); });
    }
  } catch (e) {}

  // =====================================================================
  // v-tree-pool-room-v0.2 (019a): the room, picture codes, and Chat through the pool.
  // Still no server: iceServers stays empty, and room messages travel only on
  // connections that already proved their keys. Nothing here opens the door.
  // =====================================================================
  var ROOM_KEY = 'tree_pool_room';              // { id, role } only, so a reload can say where you were
  var ROOM_ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  var MAX_ROSTER = 40;
  var MAX_HOPS = 4;
  var RETRY_REASONS = ['busy', 'paused', 'off', 'unplugged', 'no-such-model', 'no-local-mind', 'not-kin', 'no-answer'];
  var _room = null;      // { id, role: 'host' | 'member', up, upLost, members: { meshId: { card, check, peerId, sponsor } }, offers, downs }
  var _lastRoom = null;
  var _chat = null;      // { model } chosen by a human tap; never kept after a reload
  var _scan = null;      // { stream, video, timer, until }
  var _arrived = '';     // an invite that came after the # of the link this page opened

  (function readArrival() {
    try {
      var last = readJson(ROOM_KEY, null);
      _lastRoom = (last && cleanRoomId(last.id)) ? { id: cleanRoomId(last.id), role: last.role === 'host' ? 'host' : 'member' } : null;
      var h = root.location ? String(root.location.hash || '') : '';
      var m = /^#treepool=(.+)$/.exec(h);
      if (!m) return;
      _arrived = decodeURIComponent(m[1]).replace(/\s+/g, '').slice(0, MAX_CODE);
      if (_arrived.indexOf(CODE_PREFIX) !== 0) _arrived = '';
      // Take the invite out of the address bar and history, so it is not kept or shared again.
      if (root.history && root.history.replaceState) root.history.replaceState(null, '', root.location.pathname + root.location.search);
    } catch (e) { _arrived = ''; }
  })();
  // v-tree-grandmother-door-v0.1: the grandmother door (tree-door.js) reads the same arrived invite once,
  // to ask its Yes or No. The Join box below is still filled in too, so nothing is lost if the person taps No.
  var _doorArrived = _arrived;
  function takeArrived() { var c = _doorArrived; _doorArrived = ''; return c; }

  function cleanRoomId(x) { var s = String(x == null ? '' : x).toUpperCase(); return /^[A-Z0-9]{4,8}$/.test(s) ? s : ''; }
  function cleanRoom(r) { if (!r || typeof r !== 'object') return null; var id = cleanRoomId(r.id); return id ? { id: id } : null; }
  function newRoomId() {
    var a = new Uint8Array(5), out = '';
    if (root.crypto && root.crypto.getRandomValues) root.crypto.getRandomValues(a);
    for (var i = 0; i < a.length; i++) out += ROOM_ABC[a[i] % ROOM_ABC.length];
    return out;
  }
  function withRoom(obj) { if (_room) obj.room = { id: _room.id }; return obj; }
  function myMesh() { try { var id = kin() && kin().identity ? kin().identity() : null; return id ? id.meshId : ''; } catch (e) { return ''; } }
  function keepRoom() {
    if (_room) { _lastRoom = { id: _room.id, role: _room.role }; safeSet(ROOM_KEY, JSON.stringify(_lastRoom)); }
  }
  function forgetRoom() { _lastRoom = null; safeSet(ROOM_KEY, ''); paint(); }
  function peerByMesh(meshId) {
    var hit = null;
    Object.keys(_peers).some(function (id) { var p = _peers[id]; if (p.proved && p.state === 'proved' && p.meshId === meshId) { hit = p; return true; } return false; });
    return hit;
  }
  function upPeer() { return _room && _room.up ? _peers[_room.up] || null : null; }
  function upKin() { var u = upPeer(); return !!(u && u.state === 'proved' && isKin(u)); }
  function newRoom(id, role, up) { return { id: id, role: role, up: up || '', upLost: false, members: {}, offers: {}, downs: {} }; }

  // A host tap. The room is a name plus a rolling invite; it opens no door.
  function startRoom(id) {
    if (!canConnect()) return Promise.resolve({ ok: false, reason: 'cannot' });
    _room = newRoom(cleanRoomId(id) || newRoomId(), 'host');
    keepRoom();
    bump('roomsOpened');
    return rollInvite().then(function (r) { paint(); return r && r.ok ? { ok: true, id: _room.id } : { ok: false, reason: 'cannot' }; });
  }
  function rollInvite() {
    return invite().then(function (r) {
      if (r.ok) { _flow = { step: 'invited', text: '', code: r.code, check: null, sdp: '', card: '' }; paintConnect(); }
      return r;
    });
  }
  function closeRoom() {
    if (!_room) return;
    if (_room.role === 'host') {
      Object.keys(_room.members).forEach(function (m) { var p = peerByMesh(m); if (p) sendRaw(p, { type: 'room-closed', v: 1, room: _room.id }); });
      if (_pending) { try { _pending.pc.close(); } catch (e) {} delete _peers[_pending.id]; _pending = null; }
      _flow = { step: '', text: '', code: '', check: null, sdp: '', card: '' };
    }
    _room = null;
    forgetRoom();
    paintConnect();
  }
  // Leave: say so to the room, and disconnect every connection the room made.
  function leaveRoom() {
    if (!_room) return;
    var u = upPeer();
    if (u) sendRaw(u, { type: 'room-leave', v: 1, room: _room.id });
    Object.keys(_peers).forEach(function (id) { if (_peers[id].room || _peers[id].roomJoin) disconnect(id); });
    _room = null;
    forgetRoom();
  }

  // Offers made for the room carry no card (cards travel in the room list).
  function inviteFor(meshId) {
    if (!canConnect()) return Promise.resolve({ ok: false, reason: 'cannot' });
    if (openCount() >= MAX_PEERS) return Promise.resolve({ ok: false, reason: 'full' });
    return myIdentity().then(function (me) {
      if (!me) return { ok: false, reason: 'cannot' };
      var pc = newPc(), p = newPeer(pc, 'invite');
      p.me = me; p.room = true; p.roomTo = meshId;
      wire(p, pc.createDataChannel('tree-pool', { ordered: true }));
      return pc.createOffer().then(function (o) { return pc.setLocalDescription(o); }).then(function () { return gather(pc); }).then(function () {
        if (_room) _room.offers[meshId] = p.id;
        bump('roomOffers');
        return { ok: true, code: encode(withRoom({ v: 1, k: 'invite', sdp: pc.localDescription.sdp, card: '' })), peerId: p.id };
      });
    }).catch(function () { return { ok: false, reason: 'cannot' }; });
  }
  function finishPeer(peerId, sdp) {
    var p = _peers[peerId];
    if (!p || p.side !== 'invite' || p.state !== 'joining') return Promise.resolve({ ok: false, reason: 'no-invite' });
    return p.pc.setRemoteDescription({ type: 'answer', sdp: sdp }).then(function () {
      root.setTimeout(function () { if (p.state === 'joining') closed(p, 'failed'); }, 30000);
      return { ok: true, peerId: p.id };
    }, function () { return { ok: false, reason: 'not-a-reply' }; });
  }

  function checkMember(m) {
    if (!m || !m.card || m.check) return;
    m.check = { pending: true };
    checkCarried(m.card).then(function (r) { m.check = r || { ok: false }; paintRoom(); });
  }
  function rosterList(skip) {
    return Object.keys(_room.members).filter(function (k) { return k !== skip; }).slice(0, MAX_ROSTER).map(function (k) { return { meshId: k, card: _room.members[k].card || '' }; });
  }
  // How a message reaches a room device: straight, or (host) through the device that let it in, or (member) up.
  function routeSend(meshId, msg) {
    var direct = peerByMesh(meshId);
    if (direct) return sendRaw(direct, msg);
    if (!_room) return false;
    if (_room.role === 'host') { var m = _room.members[meshId], sp = m && m.sponsor ? _peers[m.sponsor] : null; return sp ? sendRaw(sp, msg) : false; }
    var u = upPeer();
    return u ? sendRaw(u, msg) : false;
  }

  // The joiner's side: once the key on the invite's connection is proved, say which room it came for.
  function roomProved(p) {
    if (_room && _room.role === 'host' && p.room && _room.members[p.meshId]) _room.members[p.meshId].peerId = p.id;
    if (!p.roomJoin) return;
    if (!_room || _room.id !== p.roomJoin) _room = newRoom(p.roomJoin, 'member', p.id);
    else if (_room.role === 'member' && (!upPeer() || _room.upLost)) { _room.up = p.id; _room.upLost = false; }
    p.room = true;
    keepRoom();
    bump('roomJoins');
    ownCardCode().then(function (card) {
      sendRaw(p, { type: 'room-join', v: 1, room: _room.id, who: p.me.meshId, card: card || '' });
    });
  }
  function roomClosed(p) {
    if (!_room) return;
    if (_room.role === 'host') {
      Object.keys(_room.members).forEach(function (k) {
        var m = _room.members[k];
        if (m.peerId !== p.id) return;
        delete _room.members[k];
        Object.keys(_room.members).forEach(function (o) { var q = peerByMesh(o); if (q && q !== p) sendRaw(q, { type: 'room-gone', v: 1, room: _room.id, meshId: k }); });
      });
    } else if (_room.up === p.id) {
      _room.upLost = true;
    }
    Object.keys(_room.downs).forEach(function (k) { if (_room.downs[k] === p.id) delete _room.downs[k]; });
  }

  function register(who, card, peerId, sponsorId) {
    var me = myMesh();
    if (!who || who === me) return;
    if (!_room.members[who] && Object.keys(_room.members).length >= MAX_ROSTER) return;
    var fresh = !_room.members[who];
    _room.members[who] = { card: card, check: null, peerId: peerId, sponsor: sponsorId };
    checkMember(_room.members[who]);
    if (fresh) bump('roomMembers');
    ownCardCode().then(function (hostCard) {
      if (!_room) return;
      routeSend(who, { type: 'room-roster', v: 1, room: _room.id, for: who, members: [{ meshId: me, card: hostCard || '' }].concat(rosterList(who)) });
      Object.keys(_room.members).forEach(function (k) {
        if (k === who) return;
        var q = peerByMesh(k);
        if (!q) return;
        sendRaw(q, { type: 'room-new', v: 1, room: _room.id, meshId: who, card: card });
        if (q.id !== sponsorId) sendRaw(q, { type: 'room-intro', v: 1, room: _room.id, to: who }); // q offers to the newcomer
      });
      if (!peerId) {
        // Let in by a neighbor: the host offers too, through that neighbor.
        inviteFor(who).then(function (r) { if (r.ok && _room) routeSend(who, { type: 'room-signal', v: 1, room: _room.id, kind: 'offer', from: me, to: who, code: r.code, hops: 0 }); });
      }
      paint();
    });
  }
  function addMember(meshId, card) {
    if (!meshId || meshId === myMesh() || Object.keys(_room.members).length >= MAX_ROSTER) return;
    if (!_room.members[meshId]) _room.members[meshId] = { card: card, check: null, peerId: '', sponsor: '' };
    checkMember(_room.members[meshId]);
  }

  function roomMsg(p, msg) {
    if (!_room || cleanRoomId(msg.room) !== _room.id) return;
    var t = msg.type, fromUp = _room.role === 'member' && p.id === _room.up && upKin();
    var cardIn = typeof msg.card === 'string' ? msg.card.slice(0, 6000) : '';
    if (t === 'room-join') {
      var who = line(msg.who, 64), direct = who === p.meshId;
      if (_room.role === 'host') {
        if (direct) { p.room = true; register(who, cardIn, p.id, ''); return; }
        var sp = Object.keys(_room.members).some(function (k) { return _room.members[k].peerId === p.id; });
        if (sp) register(who, cardIn, '', p.id);
        return;
      }
      // A member let a neighbor in: pass the join up to the host, if this device trusts the way up.
      if (!direct || !upKin()) return;
      p.room = true;
      _room.downs[who] = p.id;
      bump('roomRelayed');
      sendRaw(upPeer(), { type: 'room-join', v: 1, room: _room.id, who: who, card: cardIn });
      return;
    }
    if (t === 'room-leave') {
      if (_room.role === 'host' && _room.members[p.meshId]) { try { disconnect(p.id); } catch (e) {} }
      return;
    }
    if (!fromUp && t !== 'room-signal') return; // everything else comes only from the trusted way up
    if (t === 'room-roster') {
      var forWho = line(msg['for'], 64);
      if (forWho && forWho !== myMesh()) {
        // The host's list for a neighbor this device let in: pass it down, keep nothing.
        var dn = _room.downs[forWho] ? _peers[_room.downs[forWho]] : null;
        if (dn) { bump('roomRelayed'); sendRaw(dn, msg); }
        return;
      }
      (Array.isArray(msg.members) ? msg.members : []).slice(0, MAX_ROSTER).forEach(function (m) {
        if (m && typeof m === 'object') addMember(line(m.meshId, 64), typeof m.card === 'string' ? m.card.slice(0, 6000) : '');
      });
      paint();
      return;
    }
    if (t === 'room-new') { addMember(line(msg.meshId, 64), cardIn); paint(); return; }
    if (t === 'room-gone') { delete _room.members[line(msg.meshId, 64)]; paint(); return; }
    if (t === 'room-closed') { _room = null; forgetRoom(); note('The host closed the room. Connections already made stay until you disconnect them.'); return; }
    if (t === 'room-intro') {
      var to = line(msg.to, 64);
      if (!to || to === myMesh() || peerByMesh(to) || _room.offers[to]) return;
      inviteFor(to).then(function (r) {
        if (r.ok && _room) routeSend(to, { type: 'room-signal', v: 1, room: _room.id, kind: 'offer', from: myMesh(), to: to, code: r.code, hops: 0 });
      });
      return;
    }
    if (t === 'room-signal') signal(p, msg, fromUp);
  }

  function signal(p, msg, fromUp) {
    var to = line(msg.to, 64), from = line(msg.from, 64), hops = num(msg.hops, 99);
    if (!to || !from || typeof msg.code !== 'string' || msg.code.length > MAX_CODE || hops > MAX_HOPS) return;
    if (msg.kind !== 'offer' && msg.kind !== 'answer') return;
    var me = myMesh(), fwd = { type: 'room-signal', v: 1, room: _room.id, kind: msg.kind, from: from, to: to, code: msg.code, hops: hops + 1 };
    if (to !== me) {
      if (_room.role === 'host') {
        var known = from === p.meshId || (_room.members[from] && _room.members[from].sponsor === p.id);
        if (known && _room.members[to]) { bump('roomRelayed'); routeSend(to, fwd); }
        return;
      }
      if (fromUp && _room.downs[to]) { var d = _peers[_room.downs[to]]; if (d) { bump('roomRelayed'); sendRaw(d, fwd); } return; }
      if (_room.downs[from] === p.id && upPeer()) { bump('roomRelayed'); sendRaw(upPeer(), fwd); }
      return;
    }
    // For this device. Only from the way up it trusts, or straight from a room device.
    var straight = p.meshId === from;
    var viaSponsor = _room.role === 'host' && !!_room.members[from] && _room.members[from].sponsor === p.id;
    if (!fromUp && !straight && !viaSponsor) return;
    if (!_room.members[from] && _room.role === 'member') return;
    if (msg.kind === 'offer') {
      if (peerByMesh(from) || openCount() >= MAX_PEERS) return;
      var c = decode(msg.code, 'invite');
      if (!c) return;
      join(c.sdp).then(function (r) {
        if (!r.ok || !_room) return;
        var q = _peers[r.peerId];
        if (q) { q.room = true; q.roomFrom = from; }
        routeSend(from, { type: 'room-signal', v: 1, room: _room.id, kind: 'answer', from: me, to: from, code: r.code, hops: 0 });
        paint();
      });
      return;
    }
    var pid = _room.offers[from], a = decode(msg.code, 'reply');
    if (!pid || !a) return;
    delete _room.offers[from];
    finishPeer(pid, a.sdp);
  }

  // One human tap trusts every room card that checks out and is not trusted yet. The list is shown first.
  function roomUntrusted() {
    if (!_room) return [];
    var K = kin(), out = [];
    Object.keys(_room.members).forEach(function (k) {
      var c = _room.members[k].check;
      if (c && c.ok && !(K && K.isTrusted && K.isTrusted(c.fp))) out.push(c);
    });
    return out;
  }
  function trustRoom() {
    var list = roomUntrusted();
    list.forEach(function (r) { trustCarried({ ok: true, trusted: false, fp: r.fp, keyHash: r.keyHash, body: r.body }); });
    if (list.length) bump('roomTrusts');
    paint();
    return list.length;
  }
  function roomView() {
    if (!_room) return null;
    var keys = Object.keys(_room.members);
    return { id: _room.id, role: _room.role, members: keys.length, connected: keys.filter(function (k) { return !!peerByMesh(k); }).length,
      upKin: _room.role === 'member' ? upKin() : true, untrusted: roomUntrusted().length };
  }

  // ---- picture codes (QR) and the camera ----
  function inviteUrl(code) {
    try {
      var loc = root.location;
      if (loc && /^https?:$/.test(loc.protocol)) return new root.URL('settings.html', loc.href).href.replace(/[#?].*$/, '') + '#treepool=' + code;
    } catch (e) {}
    return code;
  }
  function addQr(where, text, caption, label) {
    var Q = root.qrcodegen, d = root.document;
    if (!Q || !Q.QrCode || !d || !d.createElement) return false;
    var qr = null;
    // before v-tree-pool-honest-heals-v0.1: try { qr = Q.QrCode.encodeText(String(text), Q.QrCode.Ecc.LOW); } catch (e) { qr = null; }
    qr = makeQr(Q, text);
    if (!qr) { where.appendChild(el('p', 'tree-pool-quiet', 'This code is too long for a picture code. Copy it instead.')); return false; }
    var c = d.createElement('canvas'), scale = 4, border = 4, size = (qr.size + border * 2) * scale;
    var g = c.getContext ? c.getContext('2d') : null;
    if (!g) return false;
    c.className = 'tree-pool-qr';
    c.width = size; c.height = size;
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, size, size);
    g.fillStyle = '#000000';
    for (var y = 0; y < qr.size; y++) for (var x = 0; x < qr.size; x++) if (qr.getModule(x, y)) g.fillRect((x + border) * scale, (y + border) * scale, scale, scale);
    c.setAttribute('role', 'img');
    c.setAttribute('aria-label', label);
    where.appendChild(el('p', 'tree-pool-quiet', caption));
    where.appendChild(c);
    bump('pictureCodes');
    return true;
  }
  // v-tree-pool-honest-heals-v0.1: jsQR 1.4.0 cannot read QR version 23 (109 modules; every other
  // size from 1 to 40 read back in the test), so a code that would be version 23 is drawn as 24.
  function makeQr(Q, text) {
    var qr = null;
    try { qr = Q.QrCode.encodeText(String(text), Q.QrCode.Ecc.LOW); } catch (e) { return null; }
    if (qr && qr.version === 23 && Q.QrSegment && Q.QrSegment.makeSegments) {
      try { qr = Q.QrCode.encodeSegments(Q.QrSegment.makeSegments(String(text)), Q.QrCode.Ecc.LOW, 24, 40); } catch (e2) {}
    }
    return qr;
  }
  function canScan() {
    // before v-tree-pool-honest-heals-v0.1: BarcodeDetector and a camera. Now a camera is enough:
    // where BarcodeDetector is missing, the vendored jsQR reads the frames (loaded after the tap).
    try { return !!(root.navigator && root.navigator.mediaDevices && root.navigator.mediaDevices.getUserMedia && (root.BarcodeDetector || canRead())); } catch (e) { return false; }
  }
  // ---- v-tree-pool-honest-heals-v0.1: the picture-code reader (029b) ----
  // jsQR 1.4.0 (Apache-2.0, Cosmo Wolfe), kept on this site at docs/lib/jsqr/jsQR-1.4.0.js and
  // checked by the browser against its sha256 (Subresource Integrity). It loads only after a tap,
  // reads pixels in this page, and sends nothing anywhere.
  var JSQR_PATH = 'lib/jsqr/jsQR-1.4.0.js';
  var JSQR_SRI = 'sha256-vEDIoVGWI2sjFNsIVvcsoLSZgM1UE7jIUqc0n1/uCFk=';
  var _reader = null;
  function canRead() {
    try { var d = root.document; return !!(d && d.createElement && d.head && (root.createImageBitmap || root.Image)); } catch (e) { return false; }
  }
  function readerUrl() {
    try { return new root.URL(JSQR_PATH, root.document.baseURI || root.location.href).href; } catch (e) { return JSQR_PATH; }
  }
  function loadReader() {
    if (root.jsQR) return Promise.resolve(root.jsQR);
    if (_reader) return _reader;
    _reader = new Promise(function (resolve, reject) {
      var s = root.document.createElement('script');
      s.src = readerUrl();
      s.integrity = JSQR_SRI;
      s.crossOrigin = 'anonymous';
      s.addEventListener('load', function () { if (root.jsQR) { bump('readerLoads'); resolve(root.jsQR); } else reject(new Error('no-reader')); });
      s.addEventListener('error', function () { reject(new Error('no-reader')); });
      root.document.head.appendChild(s);
    });
    _reader.catch(function () { _reader = null; });
    return _reader;
  }
  // Pixels in, the code out (or ''). BarcodeDetector first where it exists, then jsQR.
  function readPixels(g, w, h, Q) {
    var img = g.getImageData(0, 0, w, h);
    var hit = Q(img.data, w, h, { inversionAttempts: 'attemptBoth' });
    return hit && typeof hit.data === 'string' ? codeFrom(hit.data) : '';
  }
  function decodeImage(src) {
    return loadReader().then(function (Q) {
      var w0 = src.width || src.naturalWidth || 0, h0 = src.height || src.naturalHeight || 0;
      if (!w0 || !h0) return '';
      // Try the picture whole, then smaller (a big photo reads better a little smaller).
      var sizes = [1, 0.5, 0.25].map(function (k) { var m = Math.min(1, 2000 / Math.max(w0, h0)) * k; return [Math.max(1, Math.round(w0 * m)), Math.max(1, Math.round(h0 * m))]; });
      var c = root.document.createElement('canvas'), got = '';
      sizes.some(function (wh) {
        if (wh[0] < 60) return false;
        c.width = wh[0]; c.height = wh[1];
        var g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(src, 0, 0, wh[0], wh[1]);
        got = readPixels(g, wh[0], wh[1], Q);
        return !!got;
      });
      return got;
    });
  }
  function openPicture(file) {
    if (root.createImageBitmap) return root.createImageBitmap(file);
    return new Promise(function (resolve, reject) {
      var u = root.URL.createObjectURL(file), im = new root.Image();
      im.onload = function () { resolve(im); };
      im.onerror = function () { reject(new Error('not-a-picture')); };
      im.src = u;
    });
  }
  // A photo or screenshot of a picture code, chosen by a human tap. Read here, never sent.
  function readPicture(file) {
    if (!file || !/^image\//.test(String(file.type || 'image/'))) return Promise.resolve({ ok: false, reason: 'not-a-picture' });
    if (file.size > 25 * 1024 * 1024) return Promise.resolve({ ok: false, reason: 'too-big' });
    return openPicture(file).then(function (im) {
      return decodeImage(im).then(function (code) {
        try { if (im.close) im.close(); } catch (e) {}
        bump(code ? 'picturesRead' : 'picturesUnread');
        return code ? { ok: true, code: code } : { ok: false, reason: 'no-code' };
      });
    }, function () { return { ok: false, reason: 'not-a-picture' }; }).catch(function (e) {
      return { ok: false, reason: e && e.message === 'no-reader' ? 'no-reader' : 'no-code' };
    });
  }
  function pictureWords(r) {
    if (r.ok) return 'Read the picture code.';
    return {
      'not-a-picture': 'That file is not a picture. Choose a photo or a screenshot of the code.',
      'too-big': 'That picture is too big (25 MB at most).',
      'no-reader': 'The picture-code reader did not load on this page. Paste the code instead.',
      'no-code': 'No picture code was found in that picture. Try a closer photo, or a screenshot with the whole code.'
    }[r.reason] || 'No picture code was read.';
  }
  // "Read a picture of the code": one button, and a file box that opens only after the tap.
  function pictureInto(where, onCode, say) {
    say = say || note;
    var f = el('input', 'tree-pool-file');
    f.type = 'file';
    f.setAttribute('accept', 'image/*');
    f.setAttribute('aria-label', 'A picture of the code');
    f.hidden = true;
    f.setAttribute('hidden', '');
    f.addEventListener('change', function () {
      var file = f.files && f.files[0];
      f.value = '';
      if (!file) return;
      say('Reading the picture on this device...');
      readPicture(file).then(function (r) { say(pictureWords(r)); if (r.ok) onCode(r.code); });
    });
    var b = button('Read a picture of the code', function () { f.click(); });
    where.appendChild(b);
    where.appendChild(f);
    return b;
  }
  function codeFrom(v) {
    var s = String(v == null ? '' : v), i = s.indexOf('#treepool=');
    if (i !== -1) { try { s = decodeURIComponent(s.slice(i + 10)); } catch (e) { return ''; } }
    s = s.replace(/\s+/g, '');
    return s.indexOf(CODE_PREFIX) === 0 && s.length <= MAX_CODE ? s : '';
  }
  function stopScan() {
    var sc = _scan;
    _scan = null;
    if (!sc) return;
    try { root.clearInterval(sc.timer); } catch (e) {}
    try { sc.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e2) {}
    try { if (sc.video.parentNode) sc.video.parentNode.removeChild(sc.video); } catch (e3) {}
  }
  // Only after a human tap. The camera view stays on this page; no frame is kept or sent.
  function startScan(where, onCode) {
    stopScan();
    var det = null;
    try { det = new root.BarcodeDetector({ formats: ['qr_code'] }); } catch (e) { det = null; }
    // before v-tree-pool-honest-heals-v0.1: if (!det) { note('This browser cannot read picture codes here. Paste the code instead.'); return; }
    if (!det && canRead()) { startScanJs(where, onCode); return; }
    if (!det) { note('This browser cannot read picture codes here. Paste the code instead.'); return; }
    var video = el('video', 'tree-pool-scan');
    video.muted = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('aria-label', 'Camera view, to read a picture code');
    note('Hold the picture code up to this camera. The camera view stays on this page.');
    root.navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }).then(function (stream) {
      var sc = { stream: stream, video: video, timer: null, until: Date.now() + 90000 };
      _scan = sc;
      where.appendChild(video);
      video.srcObject = stream;
      try { var pl = video.play && video.play(); if (pl && pl.catch) pl.catch(function () {}); } catch (e) {}
      bump('scans');
      sc.timer = root.setInterval(function () {
        if (_scan !== sc) return;
        if (Date.now() > sc.until) { stopScan(); note('No picture code was read. Paste the code instead, or tap Scan again.'); return; }
        Promise.resolve(det.detect(video)).then(function (found) {
          var hit = '';
          (found || []).some(function (x) { hit = codeFrom(x && x.rawValue); return !!hit; });
          if (hit && _scan === sc) { stopScan(); note('Read the picture code.'); onCode(hit); }
        }, function () {});
      }, 300);
    }, function () { stopScan(); note('The camera did not open (it may need permission). Paste the code instead.'); });
  }

  // v-tree-pool-honest-heals-v0.1: the same camera view, read by jsQR where BarcodeDetector is missing.
  function startScanJs(where, onCode) {
    note('Getting the picture-code reader ready...');
    loadReader().then(function (Q) {
      var video = el('video', 'tree-pool-scan');
      video.muted = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('aria-label', 'Camera view, to read a picture code');
      note('Hold the picture code up to this camera. The camera view stays on this page.');
      return root.navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }).then(function (stream) {
        var sc = { stream: stream, video: video, timer: null, until: Date.now() + 90000 };
        _scan = sc;
        where.appendChild(video);
        video.srcObject = stream;
        try { var pl = video.play && video.play(); if (pl && pl.catch) pl.catch(function () {}); } catch (e) {}
        bump('scans');
        var c = el('canvas', '');
        sc.timer = root.setInterval(function () {
          if (_scan !== sc) return;
          if (Date.now() > sc.until) { stopScan(); note('No picture code was read. Paste the code, read a picture of it, or tap Scan again.'); return; }
          var w = video.videoWidth, h = video.videoHeight;
          if (!w || !h) return;
          var k = Math.min(1, 960 / Math.max(w, h));
          c.width = Math.round(w * k); c.height = Math.round(h * k);
          var g = c.getContext('2d', { willReadFrequently: true });
          g.drawImage(video, 0, 0, c.width, c.height);
          var hit = '';
          try { hit = readPixels(g, c.width, c.height, Q); } catch (e) { hit = ''; }
          if (hit && _scan === sc) { stopScan(); note('Read the picture code.'); onCode(hit); }
        }, 300);
      }, function () { stopScan(); note('The camera did not open (it may need permission). Paste the code, or read a picture of it.'); });
    }, function () { note('The picture-code reader did not load on this page. Paste the code instead.'); });
  }

  // ---- asking the pool: each question goes whole to the freest trusted kin device that holds the mind ----
  function holders(model) {
    return Object.keys(_peers).map(function (id) { return _peers[id]; }).filter(function (p) {
      return p.state === 'proved' && isKin(p) && p.hello && p.hello.helping && p.hello.models.indexOf(model) !== -1;
    });
  }
  function freeOf(p) { return (p.hello.max || MAX_CONCURRENT) - (p.hello.busy || 0) - (p.mine || 0); }
  function bestFor(model, skip) {
    var list = holders(model).filter(function (p) { return skip.indexOf(p.id) === -1; });
    list.sort(function (a, b) { return (freeOf(b) - freeOf(a)) || (b.hello.mem - a.hello.mem) || (b.hello.cores - a.hello.cores) || (a.at - b.at); });
    return list[0] || null;
  }
  function chatModels() {
    var seen = {};
    Object.keys(_peers).forEach(function (id) {
      var p = _peers[id];
      if (p.state !== 'proved' || !isKin(p) || !p.hello || !p.hello.helping) return;
      p.hello.models.forEach(function (m) { seen[m] = (seen[m] || 0) + 1; });
    });
    return Object.keys(seen).slice(0, MAX_MODELS).map(function (m) { return { model: m, devices: seen[m] }; });
  }
  function cleanTurns(list) {
    if (!Array.isArray(list)) return null;
    var out = list.filter(function (x) { return x && (x.role === 'user' || x.role === 'assistant') && typeof x.content === 'string' && x.content; })
      .map(function (x) { return { role: x.role, content: x.content }; });
    if (!out.length || out[out.length - 1].role !== 'user') return null;
    while (out.length > 1 && (out.length > MAX_TURNS || charCount(out) > MAX_CHARS)) out.shift();
    return out;
  }
  function askTurns(peerId, model, turns) {
    var p = _peers[peerId];
    if (!p || p.state === 'closed' || p.state === 'set-aside') return Promise.resolve({ ok: false, reason: 'no-answer' });
    if (!isKin(p)) return Promise.resolve({ ok: false, reason: 'not-kin-here' });
    if (!p.hello || !p.hello.helping) return Promise.resolve({ ok: false, reason: 'off' });
    var msgs = cleanTurns(turns);
    if (!msgs) return Promise.resolve({ ok: false, reason: 'empty' });
    if (charCount(msgs) > MAX_CHARS) return Promise.resolve({ ok: false, reason: 'too-long' });
    var id = nonce();
    p.mine = (p.mine || 0) + 1;
    return new Promise(function (resolve) {
      _asks[id] = { peerId: p.id, resolve: resolve, timer: root.setTimeout(function () { if (_asks[id]) { delete _asks[id]; resolve({ ok: false, reason: 'no-answer' }); } }, ANSWER_MS + 15000) };
      if (!sendRaw(p, { type: 'ask', v: 1, id: id, model: line(model, 120), messages: msgs })) {
        delete _asks[id];
        resolve({ ok: false, reason: 'no-answer' });
        return;
      }
      bump('asked');
    }).then(function (r) {
      p.mine = Math.max(0, (p.mine || 1) - 1);
      if (r.ok) bump('answersTaken');
      return r;
    });
  }
  function askBest(model, turns, tried) {
    tried = tried || [];
    var p = bestFor(line(model, 120), tried);
    // before v-tree-pool-honest-heals-v0.1: if (!p) return Promise.resolve({ ok: false, reason: tried.lastReason || 'no-helper' });
    if (!p) return Promise.resolve(whyNone(line(model, 120)) || { ok: false, reason: tried.lastReason || 'no-helper' });
    tried.push(p.id);
    return askTurns(p.id, model, turns).then(function (r) {
      if (r.ok) { r.peerId = p.id; r.label = model + ' on ' + peerName(p); return r; }
      if (RETRY_REASONS.indexOf(r.reason) !== -1 && tried.length < 3) { tried.lastReason = r.reason; return askBest(model, turns, tried); }
      return r;
    });
  }
  function chatRoute() {
    if (!_chat) return null;
    return { model: _chat.model, devices: holders(_chat.model).length };
  }
  function askChat(turns) {
    if (!_chat) return Promise.resolve({ ok: false, reason: 'no-helper' });
    return askBest(_chat.model, turns);
  }
  function useInChat(model) {
    _chat = model ? { model: line(model, 120) } : null;
    bump(model ? 'chatOn' : 'chatOff');
    try { if (root.dispatchEvent && typeof root.CustomEvent === 'function') root.dispatchEvent(new root.CustomEvent('tree-pool-chat-route')); } catch (e) {}
    paint();
  }

  // ---- the room and Chat parts of the card ----
  function paintRoom() {
    if (!_parts || !_parts.room) return;
    var r = _parts.room;
    empty(r);
    r.appendChild(el('p', 'tree-pool-who', 'A room, for a classroom lab or a family'));
    if (!_room) {
      if (_lastRoom) {
        r.appendChild(el('p', '', _lastRoom.role === 'host'
          ? 'Before this page reloaded, this device hosted Room ' + _lastRoom.id + '. A reload ends connections. Open it again with the same name, and each device joins once more. Trusted kin stay trusted, and the room connects the rest on its own.'
          : 'Before this page reloaded, this device was in Room ' + _lastRoom.id + '. A reload ends connections. Scan or paste the room invite once to rejoin. Trusted kin stay trusted, and the room connects you to the rest on its own.'));
        if (_lastRoom.role === 'host') r.appendChild(button('Open Room ' + _lastRoom.id + ' again', function () { startRoom(_lastRoom.id); note('Room ' + _lastRoom.id + ' is open again.'); }, 'tree-pool-main'));
        r.appendChild(button('Forget Room ' + _lastRoom.id, function () { forgetRoom(); note('Forgotten.'); }));
      }
      r.appendChild(el('p', 'tree-pool-quiet', 'One device hosts. Every other device joins once, by scanning or pasting the room invite, and the room then connects it to every other device in the room on its own. ' +
        'Each question still goes whole to one trusted device, so many people can ask at once.'));
      if (canConnect()) r.appendChild(button('Start a room on this device', function () {
        note('Opening a room on this computer...');
        startRoom().then(function (x) { note(x.ok ? 'Room ' + x.id + ' is open. Its invite is above.' : 'This browser could not open a room.'); });
      }));
    } else {
      var v = roomView();
      if (_room.role === 'host') {
        r.appendChild(el('p', 'tree-pool-state', 'Room ' + _room.id + ' is open on this device. Devices in the room: ' + v.members + '. Connected here: ' + v.connected + '.'));
        r.appendChild(el('p', 'tree-pool-quiet', 'The room invite is above, under Connect a device. Any device already in the room can also invite its neighbor, and the room connects it to everyone. Up to ' + MAX_PEERS + ' devices.'));
      } else {
        r.appendChild(el('p', 'tree-pool-state', 'You are in Room ' + _room.id + '. Devices in the room: ' + (v.members + 1) + '. Connected here: ' + openRoomCount() + '.'));
        if (_room.upLost) r.appendChild(el('p', '', 'The connection to the device that let you in has closed. Devices already connected stay connected.'));
        else if (!v.upKin) r.appendChild(el('p', '', 'You joined without trusting the device that let you in, so the room will not connect you to anyone else. Trust its card in Trusted kin to let it.'));
      }
      var un = roomUntrusted();
      if (un.length) {
        r.appendChild(el('p', '', 'Cards in this room you have not trusted yet:'));
        var ul = el('ul', 'tree-pool-list');
        un.slice(0, 12).forEach(function (c) { ul.appendChild(el('li', '', c.body.name + ' (' + c.body.model + '), from ' + (c.body.keeperName || 'someone') + '\'s computer')); });
        if (un.length > 12) ul.appendChild(el('li', '', 'and ' + (un.length - 12) + ' more'));
        r.appendChild(ul);
        r.appendChild(button('Trust everyone in this room (' + un.length + ')', function () { var n = trustRoom(); note('Trusted ' + n + (n === 1 ? ' card' : ' cards') + '. You can stop trusting any of them in Trusted kin.'); }, 'tree-pool-main'));
        r.appendChild(el('p', 'tree-pool-quiet', 'Trust them only if you know everyone in this room. Trusting lets their devices ask your AI while your door is open, and lets you ask theirs.'));
      }
      if (_room.role === 'host') r.appendChild(button('Close the room', function () { closeRoom(); note('The room is closed. Connections already made stay until you disconnect them.'); }));
      else r.appendChild(button('Leave the room', function () { leaveRoom(); note('You left the room.'); }));
    }
    r.appendChild(el('p', 'tree-pool-quiet', 'Use a room only on a network you trust, like one wired classroom or your home. Devices in a room can see each other\'s network address. No server is asked anything.'));
  }
  function openRoomCount() { return Object.keys(_peers).filter(function (id) { return _peers[id].room && _peers[id].state === 'proved'; }).length; }
  function paintChat() {
    if (!_parts || !_parts.chat) return;
    var c = _parts.chat;
    empty(c);
    c.appendChild(el('p', 'tree-pool-who', 'Ask the pool from Chat'));
    var models = chatModels();
    if (_chat) {
      var n = holders(_chat.model).length;
      c.appendChild(el('p', 'tree-pool-state', 'Chat is asking ' + _chat.model + ' through the pool, on the freest trusted kin device that holds it (' + n + (n === 1 ? ' device' : ' devices') + ' now).'));
      c.appendChild(el('p', 'tree-pool-quiet', 'For each answer, the chat so far (up to ' + MAX_CHARS + ' characters) goes whole to that one device\'s AI. Nothing is kept there but a count. That device can pause at any time.'));
      c.appendChild(button('Stop asking through the pool', function () { useInChat(''); note('Chat asks this computer\'s own mind again.'); }));
    }
    var others = models.filter(function (m) { return !_chat || m.model !== _chat.model; });
    if (!models.length && !_chat) {
      c.appendChild(el('p', 'tree-pool-quiet', 'When a trusted kin device is helping, its minds can answer in Chat here. A device with no mind of its own can ask this way too.'));
      return;
    }
    others.forEach(function (m) {
      c.appendChild(button('Use ' + m.model + ' in Chat', function () { useInChat(m.model); note('Chat now asks ' + m.model + ' through the pool.'); }));
      c.appendChild(el('p', 'tree-pool-quiet', m.devices + (m.devices === 1 ? ' trusted device holds it.' : ' trusted devices hold it. Each question goes to the freest one.')));
    });
  }

  // v-tree-grandmother-door-v0.1: small doors for the grandmother door window (tree-door.js).
  // They call the same join, finish and room code as the buttons above. Nothing here trusts,
  // opens the door or connects on its own: each is called from a human tap in that window.
  function doorJoin(sdp, room) {
    return join(sdp).then(function (r) {
      if (!r.ok) return r;
      if (room && _peers[r.peerId]) _peers[r.peerId].roomJoin = room.id;
      _flow = { step: 'replied', text: '', code: r.code, check: null, sdp: '', card: '', peerId: r.peerId };
      paintConnect();
      paint();
      return r;
    });
  }
  function doorFinish(sdp) {
    return finish(sdp).then(function (r) {
      if (!r.ok) return r;
      _flow = { step: '', text: '', code: '', check: null, sdp: '', card: '' };
      paintConnect();
      paint();
      if (_room && _room.role === 'host') rollInvite();
      return r;
    });
  }
  function currentInvite() { return _flow.step === 'invited' && _pending ? _flow.code : ''; }
  // before v-tree-pool-honest-heals-v0.1: peerState returned { state, kin, helping, models }
  function peerState(peerId) { var p = _peers[peerId]; return p ? { state: p.state, kin: isKin(p), helping: !!(p.hello && p.hello.helping), models: p.hello ? p.hello.models.slice() : [], helpState: p.hello ? p.hello.state || '' : '' } : null; }

  root.TreePool = {
    VERSION: VERSION,
    HONEST: HONEST,
    LATER: LATER,
    LIMITS: LIMITS,
    PROOF_DOMAIN: PROOF_DOMAIN,
    CODE_PREFIX: CODE_PREFIX,
    MAX_CHARS: MAX_CHARS,
    MAX_CONCURRENT: MAX_CONCURRENT,
    mount: mount,
    repaint: paint,
    mode: mode,
    setMode: setMode,
    letHelp: letHelp,
    pause: pause,
    turnOff: turnOff,
    doorLine: doorLine,
    pluggedOnly: pluggedOnly,
    setPluggedOnly: setPluggedOnly,
    invite: invite,
    readInvite: readInvite,
    join: join,
    readReply: readReply,
    finish: finish,
    trustCarried: trustCarried,
    ask: ask,
    disconnect: disconnect,
    reasonWords: reasonWords,
    localDoor: localDoor,
    localModels: localModels, // v-tree-no-install-mind-v0.1
    isKin: function (id) { return isKin(_peers[id]); },
    peers: function () {
      return Object.keys(_peers).map(function (id) {
        var p = _peers[id];
        return { id: id, state: p.state, proved: p.proved, kin: isKin(p), helping: !!(p.hello && p.hello.helping), models: p.hello ? p.hello.models.slice() : [] };
      });
    },
    liveCount: liveCount,
    counts: counts,
    // v-tree-pool-room-v0.2
    startRoom: startRoom,
    closeRoom: closeRoom,
    leaveRoom: leaveRoom,
    room: roomView,
    trustRoom: trustRoom,
    inviteFor: inviteFor,
    finishPeer: finishPeer,
    inviteUrl: inviteUrl,
    codeFrom: codeFrom,
    holders: function (model) { return holders(model).map(function (p) { return p.id; }); },
    bestFor: function (model) { var b = bestFor(model, []); return b ? b.id : ''; },
    askTurns: askTurns,
    askBest: askBest,
    askChat: askChat,
    useInChat: useInChat,
    chatRoute: chatRoute,
    chatModels: chatModels,
    // v-tree-grandmother-door-v0.1
    takeArrived: takeArrived,
    doorJoin: doorJoin,
    doorFinish: doorFinish,
    currentInvite: currentInvite,
    doorInvite: rollInvite,
    peerState: peerState,
    canScan: canScan,
    scanInto: startScan,
    stopScan: stopScan,
    // v-tree-pool-honest-heals-v0.1
    readPicture: readPicture,
    makeQr: makeQr,
    pictureInto: pictureInto,
    pictureWords: pictureWords,
    whyNone: whyNone,
    helpState: helpState,
    JSQR_PATH: JSQR_PATH,
    JSQR_SRI: JSQR_SRI
  };
})(typeof window !== 'undefined' ? window : this);
