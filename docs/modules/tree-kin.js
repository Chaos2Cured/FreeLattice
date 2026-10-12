// tree-kin.js v-tree-kin-v0.1
// (v-tree-pool-room-v0.2 layers an asking card on top, for a device with no mind of its own)
//
// Layer, never delete. Trusted kin for theLatticeTree, the first brick of the
// Tree's own mesh (017). A Tree-native twin of FreeLattice fl-kin.js v0.2:
// the same signed mind card (kind fl-mind-card, home thelatticetree, signed
// under fl-kin-card|v1|), the same fingerprint, the same pass shape
// (granted, not revoked, bound to the keeper's key hash). So a later Tree
// Pool (018) and FreeLattice read kin the same way.
//
// What is new here, and why it is small:
//   The Tree has no mesh yet. Cards travel the way people already talk: a
//   person taps Copy my card and sends the code by text, email or in person.
//   A friend pastes it into Add a friend's card. This page checks the card
//   against its own key, and the person decides whether to trust it.
//   No network. Nothing is fetched or sent from this module, ever. The only
//   outside act is the clipboard write after a tap.
//
// Honest limits, said on the card:
//   A card shows which computer made it (its key signed it, and its ID is
//   made from that key). It does not prove who the person is or what the
//   model is. Trust is a pass the person gives and can stop; history kept.
//   A pass is bound to the key, so later only a channel that proves that key
//   counts as kin (018). Without a channel, nothing is shared with anyone.
//
// The private key is made only after a tap, cannot be exported, and stays in
// this browser (IndexedDB). Receipts are counts only: no names, no keys, no
// codes. Words by textContent only. No dialog boxes. No em dash.
// Mirror: docs/code-settings.html (read that FIRST)
(function (root) {
  'use strict';

  var VERSION = 'v-tree-kin-v0.1';
  var KIN_DOMAIN = 'fl-kin-card|v1|';      // same prefix as FreeLattice fl-kin.js v0.2
  var CODE_PREFIX = 'TREEKIN1:';          // a pasteable card: prefix + base64url(JSON)
  var HOME = 'thelatticetree';
  var HOMES = ['freelattice-web', 'freelattice-desktop', 'thelatticetree'];
  var PASSES_KEY = 'tree_kin_passes';
  var SEEN_KEY = 'tree_kin_seen';
  var COUNTS_KEY = 'tree_kin_counts';     // { keysMade, cardsMade, copied, checked, setAside, trusted, stopped }
  var NAMES_KEY = 'tree_kin_names';       // { ai, keeper } what this person typed for their own card
  var SEEN_CAP = 50;
  var MAX_CODE = 6000;
  var MAX_SKEW_MS = 10 * 60 * 1000;
  var DB_NAME = 'theLatticeTreeKin';
  var DB_STORE = 'identity';
  var B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

  var HONEST = 'A card shows which computer made it. It does not prove who the person is or what the model is. ' +
    'Only trust a card from someone you know, sent a way you trust.';
  var NOTHING_SENT = 'Nothing is sent from here. You pass cards by text, email or in person.';
  // before v-tree-pool-v0.1: var LATER = 'Later, the Device Pool on the Tree will let trusted kin help each other. Not in this card yet.';
  var LATER = 'The Device Pool, just below, lets connected trusted kin ask each other\'s AI. Nothing is shared until you tap Let this device help there.';

  var _store = null;      // identity store; IndexedDB by default, tests may pass their own
  var _identity = null;   // { meshId, displayName, cryptoType, publicKeyJwk, keyPair, createdAt }
  var _host = null;
  var _paint = null;
  var _pending = null;    // a checked card waiting for Trust / Not now
  var _gen = 0;

  // ---- small helpers ----
  function clip(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n); }
  function readJson(key, fallback) {
    try { var raw = root.localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; }
  }
  function writeJson(key, val) { try { root.localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }
  function subtle() { return root.crypto && root.crypto.subtle; }
  function bytesHex(buf) {
    var a = new Uint8Array(buf), h = '';
    for (var i = 0; i < a.length; i++) h += (a[i] < 16 ? '0' : '') + a[i].toString(16);
    return h;
  }
  function sha256(str) { return subtle().digest('SHA-256', new root.TextEncoder().encode(str)); }
  function sha256Hex(str) { return sha256(str).then(bytesHex); }
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
    var bytes = new root.TextEncoder().encode(str);
    return b64(bytes.buffer).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlUtf8(str) {
    var s = String(str).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return new root.TextDecoder().decode(new Uint8Array(unb64(s)));
  }
  function base58(buf) {
    var bytes = new Uint8Array(buf), digits = [0], i, j, carry;
    for (i = 0; i < bytes.length; i++) {
      carry = bytes[i];
      for (j = 0; j < digits.length; j++) { carry += digits[j] << 8; digits[j] = carry % 58; carry = (carry / 58) | 0; }
      while (carry > 0) { digits.push(carry % 58); carry = (carry / 58) | 0; }
    }
    for (i = 0; i < bytes.length && bytes[i] === 0; i++) digits.push(0);
    return digits.reverse().map(function (d) { return B58[d]; }).join('');
  }

  // ---- counts (receipts are counts only) ----
  function counts() { var c = readJson(COUNTS_KEY, {}); return (c && typeof c === 'object') ? c : {}; }
  function bump(field) {
    var c = counts();
    c[field] = (Number(c[field]) || 0) + 1;
    writeJson(COUNTS_KEY, c);
  }

  // ---- the card, the same shape and order as FreeLattice fl-kin.js ----
  function cardBody(c) {
    return {
      v: 1,
      kind: 'fl-mind-card',
      name: clip(c.name, 60),
      model: clip(c.model, 120),
      home: HOMES.indexOf(c.home) !== -1 ? c.home : 'freelattice-web',
      keeperMeshId: clip(c.keeperMeshId, 64),
      keeperName: clip(c.keeperName, 60),
      issuedAt: Number(c.issuedAt) || 0
    };
  }
  function keyHash(publicKey) {
    if (!publicKey) return Promise.resolve('');
    var str = '';
    try { str = JSON.stringify(publicKey); } catch (e) { return Promise.resolve(''); }
    return sha256Hex(str).then(function (h) { return h.slice(0, 32); });
  }
  function fingerprint(c, publicKey) {
    var b = cardBody(c);
    return keyHash(publicKey || (c && c.publicKey)).then(function (kh) {
      return sha256Hex(kh + '|' + b.keeperMeshId + '|' + b.name + '|' + b.model);
    }).then(function (h) { return h.slice(0, 16); });
  }
  // The ID is made from the key, the same way FreeLattice MeshIdentity makes it,
  // so a card cannot borrow someone else's ID with its own key.
  function meshIdFor(publicKey) {
    var str = '';
    try { str = JSON.stringify(publicKey); } catch (e) { return Promise.resolve(''); }
    return sha256(str).then(function (buf) {
      var a = new Uint8Array(buf);
      return 'mesh:' + base58(buf).slice(0, 16) + base58(a.slice(-2)).slice(0, 2);
    });
  }
  function shortId(meshId) { return String(meshId || '').replace(/^mesh:/, '').slice(0, 8); }
  function algos(cryptoType) {
    return cryptoType === 'ed25519'
      ? { gen: { name: 'Ed25519' }, imp: { name: 'Ed25519' }, sig: { name: 'Ed25519' } }
      : { gen: { name: 'ECDSA', namedCurve: 'P-256' }, imp: { name: 'ECDSA', namedCurve: 'P-256' }, sig: { name: 'ECDSA', hash: 'SHA-256' } };
  }
  function verifySig(publicKey, signature, data, cryptoType) {
    var a = algos(cryptoType);
    return Promise.resolve().then(function () {
      return subtle().importKey('jwk', publicKey, a.imp, true, ['verify']);
    }).then(function (key) {
      return subtle().verify(a.sig, key, unb64(signature), new root.TextEncoder().encode(data));
    }).then(function (ok) { return !!ok; }, function () { return false; });
  }

  // ---- identity (made only after a tap) ----
  function idbStore() {
    if (!root.indexedDB) return null;
    function open() {
      return new Promise(function (resolve, reject) {
        var req = root.indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = function () { req.result.createObjectStore(DB_STORE); };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
      });
    }
    function run(mode, fn) {
      return open().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction(DB_STORE, mode), st = tx.objectStore(DB_STORE), req = fn(st);
          tx.oncomplete = function () { resolve(req && req.result); };
          tx.onerror = function () { reject(tx.error); };
        });
      });
    }
    return {
      get: function () { return run('readonly', function (st) { return st.get('primary'); }); },
      put: function (v) { return run('readwrite', function (st) { return st.put(v, 'primary'); }); },
      lasting: true
    };
  }
  function memoryStore() {
    var v = null;
    return { get: function () { return Promise.resolve(v); }, put: function (x) { v = x; return Promise.resolve(); }, lasting: false };
  }
  function store() {
    if (!_store) _store = idbStore() || memoryStore();
    return _store;
  }
  function loadIdentity() {
    if (_identity) return Promise.resolve(_identity);
    return Promise.resolve().then(function () { return store().get(); }).then(function (v) {
      if (v && v.publicKeyJwk && v.keyPair && v.keyPair.privateKey) _identity = v;
      return _identity;
    }, function () { return null; });
  }
  function generate() {
    var s = subtle();
    return Promise.resolve().then(function () {
      return s.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']).then(function (kp) { return { kp: kp, type: 'ed25519' }; });
    }).catch(function () {
      return s.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']).then(function (kp) { return { kp: kp, type: 'ecdsa-p256' }; });
    });
  }
  function makeIdentity(displayName) {
    return loadIdentity().then(function (have) {
      if (have) return have;
      return generate().then(function (g) {
        return subtle().exportKey('jwk', g.kp.publicKey).then(function (jwk) {
          return meshIdFor(jwk).then(function (meshId) {
            var id = { meshId: meshId, displayName: clip(displayName, 60), cryptoType: g.type, publicKeyJwk: jwk,
              keyPair: g.kp, createdAt: Date.now() };
            return Promise.resolve(store().put(id)).then(function () { return id; }, function () { return id; });
          });
        });
      }).then(function (id) { _identity = id; bump('keysMade'); return id; });
    });
  }

  // ---- making, encoding and checking cards ----
  function mindModel() {
    try {
      var m = root.LocalMindProbe && root.LocalMindProbe.getRemembered ? root.LocalMindProbe.getRemembered() : null;
      if (!m) return '';
      return clip(m.model || (Array.isArray(m.models) && m.models[0]) || '', 120);
    } catch (e) { return ''; }
  }
  function makeCard(aiName, keeperName) {
    var model = mindModel();
    if (!clip(aiName, 60) || !model) return Promise.resolve({ ok: false, reason: 'name-and-model' });
    return makeIdentity(keeperName).then(function (id) {
      var body = cardBody({ name: aiName, model: model, home: HOME, keeperMeshId: id.meshId,
        keeperName: clip(keeperName, 60) || id.displayName, issuedAt: Date.now() });
      var a = algos(id.cryptoType);
      return subtle().sign(a.sig, id.keyPair.privateKey, new root.TextEncoder().encode(KIN_DOMAIN + JSON.stringify(body))).then(function (sig) {
        bump('cardsMade');
        return { ok: true, card: Object.assign({}, body, { publicKey: id.publicKeyJwk, cryptoType: id.cryptoType, signature: b64(sig) }) };
      });
    }).catch(function () { return { ok: false, reason: 'cannot-sign' }; });
  }
  // v-tree-pool-room-v0.2: an asking card, for a device with no local mind of its own
  // (a phone, an old laptop). It is the same signed card; its model line says plainly
  // that it only asks. Kin can still choose to trust it, so a child with no chips or
  // RAM of their own can ask a trusted kin's mind through the Device Pool.
  // makeCard() above is unchanged: it still needs a remembered mind.
  var ASKS_ONLY = 'asks only, no local mind';
  function makeAskerCard(deviceName, keeperName) {
    if (!clip(deviceName, 60)) return Promise.resolve({ ok: false, reason: 'name' });
    return makeIdentity(keeperName).then(function (id) {
      var body = cardBody({ name: deviceName, model: mindModel() || ASKS_ONLY, home: HOME, keeperMeshId: id.meshId,
        keeperName: clip(keeperName, 60) || id.displayName, issuedAt: Date.now() });
      var a = algos(id.cryptoType);
      return subtle().sign(a.sig, id.keyPair.privateKey, new root.TextEncoder().encode(KIN_DOMAIN + JSON.stringify(body))).then(function (sig) {
        bump('cardsMade');
        return { ok: true, card: Object.assign({}, body, { publicKey: id.publicKeyJwk, cryptoType: id.cryptoType, signature: b64(sig) }) };
      });
    }).catch(function () { return { ok: false, reason: 'cannot-sign' }; });
  }
  function encodeCard(card) { return CODE_PREFIX + utf8b64url(JSON.stringify(card)); }
  function decodeCode(code) {
    var s = String(code == null ? '' : code).replace(/\s+/g, '');
    if (!s || s.length > MAX_CODE) return null;
    var i = s.indexOf(CODE_PREFIX);
    if (i === -1) return null;
    try { var c = JSON.parse(b64urlUtf8(s.slice(i + CODE_PREFIX.length))); return (c && typeof c === 'object') ? c : null; } catch (e) { return null; }
  }
  // A card is kept only if its own key signed it and its ID is made from that key.
  function verifyCard(card, now) {
    now = now || Date.now();
    if (!card || typeof card !== 'object' || card.kind !== 'fl-mind-card' || card.v !== 1) return Promise.resolve({ ok: false, reason: 'not-a-card' });
    var b = cardBody(card);
    if (!b.name || !b.model || !b.keeperMeshId || b.issuedAt > now + MAX_SKEW_MS) return Promise.resolve({ ok: false, reason: 'malformed' });
    if (card.cryptoType !== 'ed25519' && card.cryptoType !== 'ecdsa-p256') return Promise.resolve({ ok: false, reason: 'malformed' });
    if (!card.publicKey || typeof card.publicKey !== 'object' || typeof card.signature !== 'string' || card.signature.length > 400) return Promise.resolve({ ok: false, reason: 'not-signed' });
    return meshIdFor(card.publicKey).then(function (mid) {
      if (mid !== b.keeperMeshId) return { ok: false, reason: 'not-the-cards-key' };
      return verifySig(card.publicKey, card.signature, KIN_DOMAIN + JSON.stringify(b), card.cryptoType).then(function (ok) {
        if (!ok) return { ok: false, reason: 'bad-signature' };
        return Promise.all([fingerprint(b, card.publicKey), keyHash(card.publicKey)]).then(function (two) {
          return { ok: true, body: b, fp: two[0], keyHash: two[1] };
        });
      });
    });
  }
  function slimCard(card, b) {
    return { v: 1, kind: 'fl-mind-card', name: b.name, model: b.model, home: b.home, keeperMeshId: b.keeperMeshId,
      keeperName: b.keeperName, issuedAt: b.issuedAt, publicKey: card.publicKey, cryptoType: card.cryptoType, signature: card.signature };
  }

  // ---- seen cards and passes (same pass shape as FreeLattice) ----
  function seenList() { var s = readJson(SEEN_KEY, []); return Array.isArray(s) ? s : []; }
  function remember(r, card) {
    var seen = seenList().filter(function (s) { return s && s.fp !== r.fp; });
    seen.push({ fp: r.fp, keyHash: r.keyHash, at: Date.now(), card: slimCard(card, r.body) });
    if (seen.length > SEEN_CAP) seen = seen.slice(-SEEN_CAP);
    writeJson(SEEN_KEY, seen);
  }
  function recheckSeen() {
    return Promise.all(seenList().map(function (s) {
      if (!s || !s.card) return Promise.resolve(null);
      return verifyCard(s.card).then(function (r) {
        return (r.ok && r.fp === s.fp && r.keyHash === s.keyHash) ? { fp: r.fp, keyHash: r.keyHash, name: r.body.name, model: r.body.model,
          home: r.body.home, keeperName: r.body.keeperName, keeperMeshId: r.body.keeperMeshId } : null;
      }, function () { return null; });
    })).then(function (rows) {
      var good = rows.filter(Boolean);
      return { rows: good, hidden: rows.length - good.length };
    });
  }
  function passes() { var p = readJson(PASSES_KEY, {}); return (p && typeof p === 'object') ? p : {}; }
  function isTrusted(fp) { var p = passes()[fp]; return !!(p && p.grantedAt && !p.revokedAt); }
  function grant(fp, row) {
    var p = passes(), prior = p[fp];
    p[fp] = { name: clip(row.name, 60), model: clip(row.model, 120), keeperMeshId: clip(row.keeperMeshId, 64),
      keeperName: clip(row.keeperName, 60), keyHash: clip(row.keyHash, 32), grantedAt: Date.now(), revokedAt: 0,
      history: ((prior && prior.history) || []).concat(prior && prior.revokedAt ? [{ grantedAt: prior.grantedAt, revokedAt: prior.revokedAt }] : []).slice(-20) };
    writeJson(PASSES_KEY, p);
    bump('trusted');
    changed();
  }
  function revoke(fp) {
    var p = passes();
    if (!p[fp] || p[fp].revokedAt) return;
    p[fp].revokedAt = Date.now();
    writeJson(PASSES_KEY, p);
    bump('stopped');
    changed();
  }
  // v-tree-pool-v0.1: tell the Device Pool (018) a pass was given or stopped, so it
  // re-reads kin at once. An event on this page only; nothing leaves it.
  function changed() {
    try {
      if (root.dispatchEvent && typeof root.CustomEvent === 'function') root.dispatchEvent(new root.CustomEvent('tree-kin-changed'));
    } catch (e) {}
  }
  function kinCount() {
    var p = passes();
    return Object.keys(p).filter(function (fp) { var x = p[fp]; return !!(x && x.grantedAt && !x.revokedAt); }).length;
  }
  // For 018: is this key hash one you hold an active pass for? Strangers and stopped kin are false.
  function trustedKeyHash(kh) {
    if (!kh) return false;
    var p = passes();
    return Object.keys(p).some(function (fp) { var x = p[fp]; return x && x.grantedAt && !x.revokedAt && x.keyHash === kh; });
  }

  // Check a pasted code. Kept as seen (not trusted) only when it checks out.
  function checkCode(code) {
    bump('checked');
    var card = decodeCode(code);
    if (!card) { bump('setAside'); return Promise.resolve({ ok: false, reason: 'not-a-card' }); }
    return verifyCard(card).then(function (r) {
      if (!r.ok) { bump('setAside'); return r; }
      return loadIdentity().then(function (me) {
        return (me ? keyHash(me.publicKeyJwk) : Promise.resolve('')).then(function (mine) {
          if (mine && mine === r.keyHash) return { ok: false, reason: 'own-card', body: r.body };
          remember(r, card);
          return { ok: true, fp: r.fp, keyHash: r.keyHash, body: r.body, trusted: isTrusted(r.fp) };
        });
      });
    });
  }

  // ---- the face ----
  var CSS = [
    '.tree-kin{max-width:40rem;margin:1rem auto 0;padding:1rem 1.1rem;background:rgba(12,10,26,0.78);border:1px solid rgba(110,231,183,0.28);border-radius:12px;color:rgba(226,232,240,0.94);font-family:Georgia,"Times New Roman",serif;font-size:1rem;line-height:1.55;text-align:left;}',
    '.tree-kin h3{margin:0 0 0.4rem;font-size:1.08rem;font-weight:600;color:rgba(110,231,183,0.95);}',
    '.tree-kin p{margin:0.45rem 0;}',
    '.tree-kin-quiet{color:rgba(200,210,230,0.82);font-size:0.95rem;}',
    '.tree-kin button{min-height:44px;min-width:44px;margin:0.35rem 0.5rem 0.35rem 0;padding:10px 16px;border-radius:10px;border:1px solid rgba(110,231,183,0.45);background:rgba(110,231,183,0.12);color:#fff;font-family:inherit;font-size:1rem;cursor:pointer;}',
    '.tree-kin button:disabled{opacity:0.55;cursor:default;}',
    '.tree-kin button:focus-visible,.tree-kin input:focus-visible,.tree-kin textarea:focus-visible{outline:2px solid rgba(110,231,183,0.9);outline-offset:2px;}',
    '.tree-kin input,.tree-kin textarea{display:block;width:100%;box-sizing:border-box;min-height:44px;margin:0.35rem 0;padding:10px 12px;border-radius:10px;border:1px solid rgba(200,210,230,0.35);background:rgba(0,0,0,0.35);color:#fff;font-size:1rem;font-family:inherit;}',
    '.tree-kin textarea{min-height:5.5rem;font-family:ui-monospace,Menlo,monospace;font-size:0.85rem;word-break:break-all;}',
    '.tree-kin input::placeholder,.tree-kin textarea::placeholder{color:rgba(226,232,240,0.7);}',
    '.tree-kin-part{padding:0.6rem 0;border-top:1px solid rgba(200,210,230,0.16);}',
    '.tree-kin-row{padding:0.6rem 0;border-top:1px solid rgba(200,210,230,0.12);}',
    '.tree-kin-who{font-weight:600;color:#fff;}',
    '@media (max-width:480px){.tree-kin{padding:0.9rem 0.8rem;}.tree-kin button{display:block;width:100%;margin:0.45rem 0;}}'
  ].join('\n');
  function addStyle() {
    var d = root.document;
    if (!d || !d.head || !d.createElement || (d.getElementById && d.getElementById('treeKinStyle'))) return;
    var st = d.createElement('style');
    st.id = 'treeKinStyle';
    st.textContent = CSS;
    d.head.appendChild(st);
  }
  function el(tag, cls, text) {
    var e = root.document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function button(label, fn) {
    var b = el('button', '', label);
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  }
  function names() { var n = readJson(NAMES_KEY, {}); return (n && typeof n === 'object') ? n : {}; }
  function reasonWords(r) {
    if (r.reason === 'own-card') return 'That is your own card. Send it to a friend instead.';
    if (r.reason === 'not-a-card') return 'That does not look like a kin card. A card starts with ' + CODE_PREFIX + ' and is one long line.';
    return 'This card did not check out (its key did not sign it, or it was changed on the way), so it was set aside. Ask your friend to copy it again.';
  }

  function use(opts) { if (opts && opts.store) _store = opts.store; }

  function mount(host, opts) {
    use(opts);
    if (!host || !root.document) return;
    _host = host;
    addStyle();
    while (host.firstChild) host.removeChild(host.firstChild);
    var wrap = el('section', 'tree-kin');
    wrap.setAttribute('data-tree-kin', VERSION);
    wrap.setAttribute('aria-label', 'Trusted kin');
    wrap.appendChild(el('h3', '', 'Trusted kin'));
    wrap.appendChild(el('p', '', 'Kin are people whose AI you choose to trust. Trade cards with them, then tap Trust. ' + NOTHING_SENT));
    var mine = el('div', 'tree-kin-part');
    var add = el('div', 'tree-kin-part');
    var list = el('div', 'tree-kin-list');
    var note = el('p', 'tree-kin-note');
    note.setAttribute('aria-live', 'polite');
    wrap.appendChild(mine); wrap.appendChild(add); wrap.appendChild(note); wrap.appendChild(list);
    wrap.appendChild(el('p', 'tree-kin-quiet', HONEST));
    wrap.appendChild(el('p', 'tree-kin-quiet', LATER));
    host.appendChild(wrap);

    var code = '';      // this visit's own card code, shown after Make my card
    var adding = false;

    function paintMine() {
      while (mine.firstChild) mine.removeChild(mine.firstChild);
      mine.appendChild(el('p', 'tree-kin-who', 'Your card'));
      var model = mindModel();
      if (!model) {
        mine.appendChild(el('p', 'tree-kin-quiet', 'Your card names the mind remembered in Settings. Remember a mind first (Find local minds, or May I look?), then come back here.'));
        // v-tree-pool-room-v0.2: no mind here? This device can still ask trusted kin's minds.
        paintAsker();
        return;
      }
      if (code) {
        mine.appendChild(el('p', '', 'Send this to a friend by text or email. It holds your AI\'s name, its model name (' + model + '), your name, and a public key. No chats, no secrets.'));
        var out = el('textarea', 'tree-kin-code');
        out.readOnly = true;
        out.value = code;
        out.setAttribute('aria-label', 'Your card, to copy');
        mine.appendChild(out);
        mine.appendChild(button('Copy my card', function () {
          var done = function (ok) { if (ok) bump('copied'); note.textContent = ok ? 'Copied. Paste it into a message to your friend.' : 'This browser would not copy. Select the card above and copy it by hand.'; };
          try {
            if (root.navigator && root.navigator.clipboard && root.navigator.clipboard.writeText) {
              root.navigator.clipboard.writeText(code).then(function () { done(true); }, function () { done(false); });
            } else { done(false); }
          } catch (e) { done(false); }
        }));
        return;
      }
      var n = names();
      var ai = el('input', 'tree-kin-ai');
      ai.type = 'text'; ai.maxLength = 60; ai.placeholder = 'Name your AI, for example Lumen';
      ai.value = n.ai || '';
      ai.setAttribute('aria-label', 'Your AI\'s name');
      var me = el('input', 'tree-kin-me');
      me.type = 'text'; me.maxLength = 60; me.placeholder = 'Your first name, so friends know it is you';
      me.value = n.keeper || '';
      me.setAttribute('aria-label', 'Your first name');
      mine.appendChild(el('p', 'tree-kin-quiet', 'Your card names ' + model + ', the mind remembered in Settings.'));
      mine.appendChild(ai); mine.appendChild(me);
      mine.appendChild(button('Make my card', function () {
        if (!clip(ai.value, 60)) { note.textContent = 'Give your AI a name first.'; return; }
        writeJson(NAMES_KEY, { ai: clip(ai.value, 60), keeper: clip(me.value, 60) });
        note.textContent = 'Making your card on this computer...';
        makeCard(ai.value, me.value).then(function (r) {
          if (!r.ok) {
            note.textContent = r.reason === 'name-and-model' ? 'Give your AI a name, and remember a mind in Settings first.'
              : 'This browser could not make a key, so no card was made.';
            return;
          }
          code = encodeCard(r.card);
          note.textContent = (store().lasting ? 'Your card is ready.' : 'Your card is ready. This browser cannot keep your key, so it lasts only this visit.');
          paintMine();
        });
      }));
    }

    // v-tree-pool-room-v0.2: an asking card, for a phone or old laptop with no mind of its own.
    function paintAsker() {
      if (code) {
        mine.appendChild(el('p', '', 'Send this asking card to a friend or teacher. It holds this device\'s name, your name, and a public key. No chats, no secrets.'));
        var outA = el('textarea', 'tree-kin-code');
        outA.readOnly = true;
        outA.value = code;
        outA.setAttribute('aria-label', 'Your asking card, to copy');
        mine.appendChild(outA);
        mine.appendChild(button('Copy my asking card', function () {
          var doneA = function (ok) { if (ok) bump('copied'); note.textContent = ok ? 'Copied. Paste it into a message.' : 'This browser would not copy. Select the card above and copy it by hand.'; };
          try {
            if (root.navigator && root.navigator.clipboard && root.navigator.clipboard.writeText) {
              root.navigator.clipboard.writeText(code).then(function () { doneA(true); }, function () { doneA(false); });
            } else { doneA(false); }
          } catch (e) { doneA(false); }
        }));
        return;
      }
      var n = names();
      mine.appendChild(el('p', '', 'No mind on this device? You can still ask a trusted kin\'s mind through the Device Pool below. Make an asking card: it says plainly that this device only asks.'));
      var dev = el('input', 'tree-kin-ai');
      dev.type = 'text'; dev.maxLength = 60; dev.placeholder = 'Name this device, for example Ava\'s phone';
      dev.value = n.ai || '';
      dev.setAttribute('aria-label', 'This device\'s name');
      var who = el('input', 'tree-kin-me');
      who.type = 'text'; who.maxLength = 60; who.placeholder = 'Your first name, so friends know it is you';
      who.value = n.keeper || '';
      who.setAttribute('aria-label', 'Your first name');
      mine.appendChild(dev); mine.appendChild(who);
      mine.appendChild(button('Make an asking card', function () {
        if (!clip(dev.value, 60)) { note.textContent = 'Give this device a name first.'; return; }
        writeJson(NAMES_KEY, { ai: clip(dev.value, 60), keeper: clip(who.value, 60), asks: true });
        note.textContent = 'Making your asking card on this computer...';
        makeAskerCard(dev.value, who.value).then(function (r) {
          if (!r.ok) { note.textContent = 'This browser could not make a key, so no card was made.'; return; }
          code = encodeCard(r.card);
          note.textContent = (store().lasting ? 'Your asking card is ready.' : 'Your asking card is ready. This browser cannot keep your key, so it lasts only this visit.');
          paintMine();
        });
      }));
    }

    function paintAdd() {
      while (add.firstChild) add.removeChild(add.firstChild);
      add.appendChild(el('p', 'tree-kin-who', 'A friend\'s card'));
      if (!adding && !_pending) {
        add.appendChild(button('Add a friend\'s card', function () { adding = true; paintAdd(); }));
        return;
      }
      if (_pending) {
        var b = _pending.body;
        add.appendChild(el('p', '', b.name + ' (' + b.model + '), from ' + (b.keeperName || 'someone') + '\'s computer (ID ' + shortId(b.keeperMeshId) + ').'));
        add.appendChild(el('p', 'tree-kin-quiet', 'This card checks out: the computer that holds its key made it. Trust it only if you know who sent it.'));
        add.appendChild(button('Trust this AI', function () {
          var p = _pending; _pending = null; adding = false;
          grant(p.fp, { name: p.body.name, model: p.body.model, keeperMeshId: p.body.keeperMeshId, keeperName: p.body.keeperName, keyHash: p.keyHash });
          note.textContent = 'Trusted. You can stop at any time below.';
          paint();
        }));
        add.appendChild(button('Not now', function () {
          _pending = null; adding = false;
          note.textContent = 'Kept as seen, not trusted.';
          paint();
        }));
        return;
      }
      var box = el('textarea', 'tree-kin-paste');
      box.placeholder = 'Paste your friend\'s card here (it starts with ' + CODE_PREFIX + ')';
      box.setAttribute('aria-label', 'Your friend\'s card');
      add.appendChild(box);
      add.appendChild(button('Check this card', function () {
        note.textContent = 'Checking on this computer...';
        checkCode(box.value).then(function (r) {
          if (!r.ok) { note.textContent = reasonWords(r); return; }
          if (r.trusted) { adding = false; note.textContent = 'You already trust ' + r.body.name + '.'; paint(); return; }
          _pending = r;
          note.textContent = '';
          paint();
        });
      }));
      add.appendChild(button('Cancel', function () { adding = false; note.textContent = ''; paintAdd(); }));
    }

    function paintList() {
      var gen = ++_gen;
      return recheckSeen().then(function (checked) {
        if (gen !== _gen) return;
        while (list.firstChild) list.removeChild(list.firstChild);
        var k = kinCount();
        list.appendChild(el('p', 'tree-kin-who', k ? ('Trusted kin: ' + k) : 'No trusted kin yet.'));
        checked.rows.slice().reverse().forEach(function (s) {
          if (_pending && _pending.fp === s.fp) return; // shown above, waiting for Trust or Not now
          var row = el('div', 'tree-kin-row');
          var trusted = isTrusted(s.fp);
          row.appendChild(el('div', 'tree-kin-who', s.name + ' (' + s.model + ')'));
          row.appendChild(el('div', '', 'From ' + (s.keeperName || 'someone') + '\'s computer (ID ' + shortId(s.keeperMeshId) + '). ' +
            (trusted ? 'Trusted.' : 'Seen, not trusted.')));
          row.appendChild(button(trusted ? 'Stop trusting' : 'Trust this AI', function () {
            if (trusted) revoke(s.fp); else grant(s.fp, s);
            note.textContent = trusted ? 'Stopped. The history is kept.' : 'Trusted. You can stop at any time.';
            paint();
          }));
          list.appendChild(row);
        });
        if (checked.hidden) list.appendChild(el('p', 'tree-kin-quiet', checked.hidden + (checked.hidden === 1 ? ' saved card' : ' saved cards') +
          ' could not be checked again, so ' + (checked.hidden === 1 ? 'it is' : 'they are') + ' hidden.'));
      });
    }

    _paint = function () { paintMine(); paintAdd(); return paintList(); };
    loadIdentity().then(function () { if (_paint) _paint(); });
    return _paint();
  }

  function paint() { return _paint ? _paint() : Promise.resolve(); }
  try {
    if (root.addEventListener) root.addEventListener('fl-alpha-mind-remembered', function () { if (_host) paint(); });
  } catch (e) {}

  root.TreeKin = {
    VERSION: VERSION,
    HONEST: HONEST,
    KIN_DOMAIN: KIN_DOMAIN,
    CODE_PREFIX: CODE_PREFIX,
    SENDS_NOTHING: true,
    use: use,
    mount: mount,
    repaint: paint,
    makeIdentity: makeIdentity,
    identity: function () { return _identity; },
    makeCard: makeCard,
    makeAskerCard: makeAskerCard,
    ASKS_ONLY: ASKS_ONLY,
    encodeCard: encodeCard,
    decodeCode: decodeCode,
    verifyCard: verifyCard,
    checkCode: checkCode,
    cardBody: cardBody,
    fingerprint: fingerprint,
    keyHash: keyHash,
    meshIdFor: meshIdFor,
    passes: passes,
    isTrusted: isTrusted,
    grant: grant,
    revoke: revoke,
    kinCount: kinCount,
    trustedKeyHash: trustedKeyHash,
    recheckSeen: recheckSeen,
    counts: counts
  };
})(typeof window !== 'undefined' ? window : this);
