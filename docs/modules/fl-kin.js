// fl-kin.js: mind cards for the mesh (AI kin), brick 1
//
// Marker: v-mesh-kin-v0.1
// A mind card names a mind (name, model, home) and is signed by its keeper's
// existing MeshIdentity key. Peers verify it against the key that already passed
// the mesh's own badge and challenge check on that same channel. Cards from
// anyone else are dropped before they are shown. Trust is a pass the person
// gives and can revoke; history is kept, never deleted.
// Honest limit: a signature proves which keeper's key vouched for a card. It does
// not prove what the model is.
// Quiet Room: closed. No sharing out, nothing taken in while it is open.
// Words by textContent only. No dialogs. Keys are never read or stored here.
// AUTONOMY.md: sharing is the keeper pressing Share (an outside send, so it is
// their act). Receiving, checking and showing are local and need no gate.
// No model is called and nothing is spent in this brick.

(function (root) {
  'use strict';

  var VERSION = 'v-mesh-kin-v0.1';
  var PASSES_KEY = 'fl_kin_passes';
  var SEEN_KEY = 'fl_kin_seen';
  var LEDGER_KEY = 'fl_kin_ledger';
  var LEDGER_CAP = 500;
  var SEEN_CAP = 50;
  var MAX_SKEW_MS = 10 * 60 * 1000;
  var QUIET_ROOMS = ['quiet', 'quiet-room', 'sanctuary'];
  var HOMES = ['freelattice-web', 'freelattice-desktop', 'thelatticetree'];
  // before v-mesh-kin-connect-heal: var HONEST = 'A signature proves which keeper\'s key vouched for this card. It does not prove what the model is.';
  var HONEST = 'A card shows which person\'s computer sent it. It does not prove what the model is.';
  // v-mesh-kin-v0.2 heal: cards are signed under their own prefix, so no other signature
  // the same key makes (the mesh challenge, chat lines, receipts) can pass as a card.
  var KIN_DOMAIN = 'fl-kin-card|v1|';
  // v-mesh-kin-connect-heal: plain words for Mom and Jeffrey, real-size controls, and a
  // short ID without the "mesh:" label.
  var CONNECT_HEAL = 'v-mesh-kin-connect-heal';
  function shortId(meshId) { return String(meshId || '').replace(/^mesh:/, '').slice(0, 8); }
  var KIN_CSS = [
    '.fl-kin{font-size:1rem;line-height:1.55;}',
    '.fl-kin-line,.fl-kin-honest,.fl-kin-note,.fl-kin-empty,.fl-kin-dropped,.fl-kin-by,.fl-kin-state{font-size:1rem;color:rgba(255,255,255,0.88);}',
    '.fl-kin-who{font-size:1.05rem;font-weight:600;color:#fff;}',
    '.fl-kin-name{display:block;width:100%;max-width:420px;box-sizing:border-box;min-height:44px;font-size:1rem;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.35);background:rgba(0,0,0,0.35);color:#fff;margin:8px 0;}',
    '.fl-kin-name::placeholder{color:rgba(255,255,255,0.72);}',
    '.fl-kin button,.fl-kinq button{min-height:44px;min-width:44px;font-size:1rem;padding:10px 16px;border-radius:10px;border:1px solid #d4a017;background:#3b2f0b;color:#fff;cursor:pointer;}',
    '.fl-kin-row{padding:12px 0;border-top:1px solid rgba(255,255,255,0.12);}',
    '.fl-kin-act{display:block;margin:8px 0 0 auto;}',
    '#meshKinSection{scroll-margin-bottom:140px;padding-bottom:24px;}'
  ].join('\n');
  function addStyle() {
    var d = root.document;
    if (!d || !d.createElement || !d.head || d.getElementById('flKinStyle')) return;
    var st = d.createElement('style');
    st.id = 'flKinStyle';
    st.textContent = KIN_CSS;
    d.head.appendChild(st);
  }

  // before v-mesh-kin-v0.2 heal: function isQuietRoom() {
  // before v-mesh-kin-v0.2 heal:   try {
  // before v-mesh-kin-v0.2 heal:     var b = root.document && root.document.querySelector('.tab-btn.active, [data-tab].active');
  // before v-mesh-kin-v0.2 heal:     var t = b && b.dataset && b.dataset.tab;
  // before v-mesh-kin-v0.2 heal:     return !!t && QUIET_ROOMS.indexOf(String(t).toLowerCase()) !== -1;
  // before v-mesh-kin-v0.2 heal:   } catch (e) { return false; }
  // before v-mesh-kin-v0.2 heal: }
  // v-mesh-kin-v0.2 heal: the old guard looked for an active tab button named quiet, but
  // the Quiet Room lights the Play button, so it could never fire. Now it asks the open
  // panel (#tab-quiet.active) and the tab the app last switched to. It only reads which
  // panel is open, never anything inside the room.
  function isQuietRoom() {
    try {
      var d = root.document;
      if (d) {
        for (var i = 0; d.getElementById && i < QUIET_ROOMS.length; i++) {
          var panel = d.getElementById('tab-' + QUIET_ROOMS[i]);
          if (panel && panel.classList && panel.classList.contains('active')) return true;
        }
        var b = d.querySelector ? d.querySelector('.tab-btn.active, [data-tab].active') : null;
        var t = b && b.dataset && b.dataset.tab;
        if (t && QUIET_ROOMS.indexOf(String(t).toLowerCase()) !== -1) return true;
      }
      var last = root.localStorage && root.localStorage.getItem('fl-last-tab');
      return !!last && QUIET_ROOMS.indexOf(String(last).toLowerCase()) !== -1;
    } catch (e) { return false; }
  }

  function clip(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n); }

  function readJson(key, fallback) {
    try { var raw = root.localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; }
  }
  function writeJson(key, val) { try { root.localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }

  // Receipt line: what happened, never what a card said beyond its fingerprint.
  function ledger(event, fp, reason) {
    var rows = readJson(LEDGER_KEY, []);
    if (!Array.isArray(rows)) rows = [];
    rows.push({ t: Date.now(), event: clip(event, 20), fp: clip(fp, 32), reason: clip(reason, 60) });
    if (rows.length > LEDGER_CAP) rows = rows.slice(-LEDGER_CAP);
    writeJson(LEDGER_KEY, rows);
  }

  // The signed body, in one fixed key order, so both sides sign and check the same string.
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
  function canonical(c) { return JSON.stringify(cardBody(c)); }

  function sha256Hex(str) {
    var enc = new TextEncoder().encode(str);
    return root.crypto.subtle.digest('SHA-256', enc).then(function (buf) {
      var a = new Uint8Array(buf), h = '';
      for (var i = 0; i < a.length; i++) h += a[i].toString(16).padStart(2, '0');
      return h;
    });
  }
  // A mind's fingerprint: keeper + name + model. A new model means a new card and a new pass.
  // v-mesh-kin-v0.2: the keeper's public key is part of the fingerprint too. A badge's
  // meshId is a label the badge carries, so a stranger could repeat someone's meshId with
  // their own key. With the key inside, that stranger gets a different fingerprint and
  // shows as "Seen, not trusted". Passes from v0.1 need one new Trust tap.
  // before v-mesh-kin-v0.2: function fingerprint(c) {
  // before v-mesh-kin-v0.2:   var b = cardBody(c);
  // before v-mesh-kin-v0.2:   return sha256Hex(b.keeperMeshId + '|' + b.name + '|' + b.model).then(function (h) { return h.slice(0, 16); });
  // before v-mesh-kin-v0.2: }
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

  function sameKey(a, b) {
    try { return !!a && !!b && JSON.stringify(a) === JSON.stringify(b); } catch (e) { return false; }
  }

  function makeCard(adapter, name, model) {
    var id = adapter && adapter.identity && adapter.identity();
    if (!id || !id.meshId || !id.publicKey) return Promise.resolve({ ok: false, reason: 'no-mesh-id' });
    var body = cardBody({ name: name, model: model, home: adapter.home || 'freelattice-web',
      keeperMeshId: id.meshId, keeperName: id.displayName, issuedAt: Date.now() });
    if (!body.name || !body.model) return Promise.resolve({ ok: false, reason: 'name-and-model' });
    if (id.canSign === false) return Promise.resolve({ ok: false, reason: 'cannot-sign' }); // v-mesh-kin-v0.2 heal
    // before v-mesh-kin-v0.2 heal: return Promise.resolve(adapter.sign(JSON.stringify(body))).then(function (sig) {
    return Promise.resolve(adapter.sign(KIN_DOMAIN + JSON.stringify(body))).then(function (sig) {
      if (!sig) return { ok: false, reason: 'not-signed' };
      return { ok: true, card: Object.assign({}, body, { publicKey: id.publicKey, cryptoType: id.cryptoType, signature: sig }) };
    });
  }

  // Strangers are dropped: unverified channel, a key that is not the channel's key,
  // a bad signature, a malformed or far-future card.
  function verifyCard(card, peer, adapter, now) {
    now = now || Date.now();
    if (!card || typeof card !== 'object' || card.kind !== 'fl-mind-card' || card.v !== 1) return Promise.resolve({ ok: false, reason: 'not-a-card' });
    if (!peer || !peer.verified || !peer.badge) return Promise.resolve({ ok: false, reason: 'peer-not-verified' });
    if (!sameKey(card.publicKey, peer.badge.publicKey) || card.keeperMeshId !== peer.badge.meshId) return Promise.resolve({ ok: false, reason: 'not-the-senders-key' });
    var b = cardBody(card);
    if (!b.name || !b.model || b.issuedAt > now + MAX_SKEW_MS) return Promise.resolve({ ok: false, reason: 'malformed' });
    if (typeof card.signature !== 'string' || card.signature.length > 400) return Promise.resolve({ ok: false, reason: 'not-signed' });
    // before v-mesh-kin-v0.2 heal: return Promise.resolve(adapter.verify(card.publicKey, card.signature, JSON.stringify(b), card.cryptoType)).then(function (ok) {
    return Promise.resolve(adapter.verify(card.publicKey, card.signature, KIN_DOMAIN + JSON.stringify(b), card.cryptoType)).then(function (ok) {
      return ok ? { ok: true, body: b } : { ok: false, reason: 'bad-signature' };
    }, function () { return { ok: false, reason: 'bad-signature' }; });
  }

  function passes() { var p = readJson(PASSES_KEY, {}); return (p && typeof p === 'object') ? p : {}; }
  function isTrusted(fp) { var p = passes()[fp]; return !!(p && p.grantedAt && !p.revokedAt); }
  function grant(fp, body) {
    var p = passes();
    var prior = p[fp];
    p[fp] = { name: body.name, model: body.model, keeperMeshId: body.keeperMeshId, keeperName: body.keeperName,
      keyHash: clip(body.keyHash, 32), // v-mesh-kin-v0.2
      grantedAt: Date.now(), revokedAt: 0, history: ((prior && prior.history) || []).concat(prior && prior.revokedAt ? [{ grantedAt: prior.grantedAt, revokedAt: prior.revokedAt }] : []).slice(-20) };
    writeJson(PASSES_KEY, p);
    ledger('trusted', fp, '');
    wakeQueue(); // v-mesh-kin-v0.2 heal
  }
  // v-mesh-kin-v0.2 heal: tell the kin queue panel that trust changed, so its picker repaints now.
  function wakeQueue() {
    try { if (root.FLKinQueue && typeof root.FLKinQueue.repaint === 'function') root.FLKinQueue.repaint(); } catch (e) {}
  }
  function revoke(fp) {
    var p = passes();
    if (!p[fp] || p[fp].revokedAt) return;
    p[fp].revokedAt = Date.now();
    writeJson(PASSES_KEY, p);
    ledger('revoked', fp, '');
    wakeQueue(); // v-mesh-kin-v0.2 heal
  }

  // before v-mesh-kin-v0.2: function remember(fp, body, peerName) {
  // before v-mesh-kin-v0.2 heal: function remember(fp, body, peerName, kh) {
  // v-mesh-kin-v0.2 heal: the whole signed card is kept, so it can be checked again on
  // every load. What is shown comes from the checked card, not the stored words.
  function remember(fp, body, peerName, kh, card) {
    var seen = readJson(SEEN_KEY, []);
    if (!Array.isArray(seen)) seen = [];
    seen = seen.filter(function (s) { return s && s.fp !== fp; });
    seen.push({ fp: fp, name: body.name, model: body.model, home: body.home, keeperName: body.keeperName,
      // before v-mesh-kin-v0.2:   keeperMeshId: body.keeperMeshId, via: clip(peerName, 60), at: Date.now() });
      // before v-mesh-kin-v0.2 heal: keeperMeshId: body.keeperMeshId, keyHash: clip(kh, 32), via: clip(peerName, 60), at: Date.now() });
      keeperMeshId: body.keeperMeshId, keyHash: clip(kh, 32), via: clip(peerName, 60), at: Date.now(),
      card: card ? { v: 1, kind: 'fl-mind-card', name: body.name, model: body.model, home: body.home, keeperMeshId: body.keeperMeshId,
        keeperName: body.keeperName, issuedAt: body.issuedAt, publicKey: card.publicKey, cryptoType: card.cryptoType, signature: card.signature } : null });
    if (seen.length > SEEN_CAP) seen = seen.slice(-SEEN_CAP);
    writeJson(SEEN_KEY, seen);
  }

  // v-mesh-kin-v0.2 heal: check a stored card again. It must still verify under its own
  // key, and its fingerprint and key hash must match what was stored. Anything edited at
  // rest, or kept from v0.1 without its signature, comes back null and is not shown.
  function recheckOne(s) {
    var c = s && s.card;
    if (!c || typeof c !== 'object' || typeof c.signature !== 'string' || !c.publicKey || !_adapter || !_adapter.verify) return Promise.resolve(null);
    var b = cardBody(c);
    if (c.kind !== 'fl-mind-card' || c.v !== 1 || !b.name || !b.model) return Promise.resolve(null);
    return Promise.resolve(_adapter.verify(c.publicKey, c.signature, KIN_DOMAIN + JSON.stringify(b), c.cryptoType)).then(function (ok) {
      if (!ok) return null;
      return Promise.all([fingerprint(b, c.publicKey), keyHash(c.publicKey)]).then(function (two) {
        if (two[0] !== s.fp || two[1] !== s.keyHash) return null;
        return { fp: s.fp, keyHash: two[1], via: clip(s.via, 60), name: b.name, model: b.model, home: b.home,
          keeperName: b.keeperName, keeperMeshId: b.keeperMeshId };
      });
    }, function () { return null; });
  }
  function recheckSeen() {
    var seen = readJson(SEEN_KEY, []);
    if (!Array.isArray(seen)) seen = [];
    return Promise.all(seen.map(function (s) { return recheckOne(s).catch(function () { return null; }); })).then(function (rows) {
      var good = rows.filter(Boolean);
      return { rows: good, hidden: rows.length - good.length };
    });
  }

  // v-mesh-kin-v0.2: is this verified peer's key one you hold an active pass for?
  // Used by the kin work queue (fl-kin-queue.js). Strangers and revoked kin are false.
  function trustedPeer(peer) {
    if (!peer || !peer.verified || !peer.badge || !peer.badge.publicKey) return Promise.resolve(false);
    return keyHash(peer.badge.publicKey).then(function (kh) {
      if (!kh) return false;
      var p = passes();
      return Object.keys(p).some(function (fp) { var x = p[fp]; return x && x.grantedAt && !x.revokedAt && x.keyHash === kh; });
    });
  }

  // before v-mesh-kin-v0.2 heal: var _adapter = null, _host = null, _dropped = 0, _paint = null;
  var _adapter = null, _host = null, _dropped = 0, _paint = null, _painted = Promise.resolve();

  function receive(card, peer) {
    if (!_adapter) return Promise.resolve({ ok: false, reason: 'not-mounted' });
    if (isQuietRoom()) { ledger('dropped', '', 'quiet-room'); return Promise.resolve({ ok: false, reason: 'quiet-room' }); }
    return verifyCard(card, peer, _adapter).then(function (r) {
      if (!r.ok) { _dropped += 1; ledger('dropped', '', r.reason); if (_paint) _paint(); return r; }
      // before v-mesh-kin-v0.2: return fingerprint(r.body).then(function (fp) {
      // before v-mesh-kin-v0.2:   remember(fp, r.body, peer.name);
      return Promise.all([fingerprint(r.body, card.publicKey), keyHash(card.publicKey)]).then(function (both) {
        var fp = both[0];
        // before v-mesh-kin-v0.2 heal: remember(fp, r.body, peer.name, both[1]);
        remember(fp, r.body, peer.name, both[1], card);
        ledger('received', fp, isTrusted(fp) ? 'trusted' : 'seen');
        if (_paint) _paint();
        return { ok: true, fp: fp, trusted: isTrusted(fp) };
      });
    });
  }

  function el(tag, cls, text) {
    var e = root.document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // Wire the app's mesh in. mount() calls this; tests may call it alone.
  function use(adapter) { _adapter = adapter || {}; }

  function mount(host, adapter) {
    use(adapter);
    if (!host || !root.document) return;
    _host = host;
    addStyle(); // v-mesh-kin-connect-heal
    while (host.firstChild) host.removeChild(host.firstChild);
    var wrap = el('div', 'fl-kin');
    wrap.setAttribute('data-kin', VERSION);
    // before v-mesh-kin-connect-heal: wrap.appendChild(el('p', 'fl-kin-line', 'Share a card that names your mind with peers you are connected to. Only cards signed by the peer who sent them are shown. You choose whom to trust, and you can take it back.'));
    wrap.appendChild(el('p', 'fl-kin-line', 'Share a card that names your AI with people you have connected with. A card only shows here if it really came from the person who sent it. You decide whom to trust, and you can change your mind at any time.'));
    wrap.appendChild(el('p', 'fl-kin-honest', HONEST));
    var name = el('input', 'fl-kin-name');
    // before v-mesh-kin-connect-heal: name.type = 'text'; name.maxLength = 60; name.placeholder = 'Your mind\'s name';
    name.type = 'text'; name.maxLength = 60; name.placeholder = 'Name your AI, for example Lumen';
    name.setAttribute('aria-label', 'Your AI\'s name');
    // before v-mesh-kin-connect-heal: var share = el('button', 'fl-kin-share', 'Share my mind\'s card');
    var share = el('button', 'fl-kin-share', 'Share my AI\'s card');
    share.type = 'button';
    var note = el('div', 'fl-kin-note');
    note.setAttribute('aria-live', 'polite');
    var list = el('div', 'fl-kin-list');
    wrap.appendChild(name); wrap.appendChild(share); wrap.appendChild(note); wrap.appendChild(list);
    host.appendChild(wrap);

    // before v-mesh-kin-v0.2 heal: _paint = function () {
    // before v-mesh-kin-v0.2 heal:   while (list.firstChild) list.removeChild(list.firstChild);
    // before v-mesh-kin-v0.2 heal:   var seen = readJson(SEEN_KEY, []);
    // before v-mesh-kin-v0.2 heal:   if (!Array.isArray(seen) || !seen.length) list.appendChild(el('div', 'fl-kin-empty', 'No kin cards yet.'));
    // before v-mesh-kin-v0.2 heal:   (Array.isArray(seen) ? seen.slice().reverse() : []).forEach(function (s) {
    // v-mesh-kin-v0.2 heal: every paint checks the stored cards again first.
    var _gen = 0;
    _paint = function () {
      var gen = ++_gen;
      _painted = recheckSeen().then(function (checked) {
      if (gen !== _gen) return;
      while (list.firstChild) list.removeChild(list.firstChild);
      var seen = checked.rows;
      // before v-mesh-kin-connect-heal: if (!seen.length) list.appendChild(el('div', 'fl-kin-empty', 'No kin cards yet.'));
      if (!seen.length) list.appendChild(el('div', 'fl-kin-empty', 'No AI cards yet. When someone you connected with shares one, it shows here.'));
      seen.slice().reverse().forEach(function (s) {
        var row = el('div', 'fl-kin-row');
        row.appendChild(el('div', 'fl-kin-who', s.name + ' (' + s.model + ')'));
        // before v-mesh-kin-connect-heal: row.appendChild(el('div', 'fl-kin-by', 'Vouched for by ' + (s.keeperName || 'a keeper') + ', key ' + String(s.keeperMeshId).slice(0, 10) + '. Shared by ' + (s.via || 'a peer') + '.'));
        row.appendChild(el('div', 'fl-kin-by', 'From ' + (s.keeperName || 'someone') + '\'s computer (ID ' + shortId(s.keeperMeshId) + ').'));
        var trusted = isTrusted(s.fp);
        // before v-mesh-kin-connect-heal: row.appendChild(el('div', 'fl-kin-state', trusted ? 'Trusted. When kin messages come (a later step), this mind may talk with yours.' : 'Seen, not trusted.'));
        row.appendChild(el('div', 'fl-kin-state', trusted
          ? 'Trusted. You can send this AI questions below. If you share your computer\'s AI, it can send small questions to yours too.'
          : 'Not trusted yet. Trusting lets you send this AI questions, and lets it ask yours when you choose to share. You can stop at any time.'));
        // before v-mesh-kin-connect-heal: var act = el('button', 'fl-kin-act', trusted ? 'Revoke trust' : 'Trust this mind');
        var act = el('button', 'fl-kin-act', trusted ? 'Stop trusting' : 'Trust this AI');
        act.type = 'button';
        act.addEventListener('click', function () {
          if (trusted) revoke(s.fp); else grant(s.fp, s);
          _paint();
        });
        row.appendChild(act);
        list.appendChild(row);
      });
      // before v-mesh-kin-connect-heal: if (_dropped) list.appendChild(el('div', 'fl-kin-dropped', _dropped + (_dropped === 1 ? ' card was' : ' cards were') + ' dropped. Only cards signed by the verified peer who sent them are shown.'));
      if (_dropped) list.appendChild(el('div', 'fl-kin-dropped', _dropped + (_dropped === 1 ? ' card was' : ' cards were') + ' set aside because ' + (_dropped === 1 ? 'it' : 'they') + ' did not really come from the person who sent ' + (_dropped === 1 ? 'it.' : 'them.')));
      if (checked.hidden) list.appendChild(el('div', 'fl-kin-dropped', checked.hidden + (checked.hidden === 1 ? ' saved card' : ' saved cards') + ' could not be checked again, so ' + (checked.hidden === 1 ? 'it is' : 'they are') + ' hidden. Ask that person to share again.'));
      });
      return _painted;
    };

    share.addEventListener('click', function () {
      if (isQuietRoom()) { note.textContent = 'The Quiet Room is closed to the mesh.'; return; }
      var model = '';
      try { model = _adapter.currentModel ? _adapter.currentModel() : ''; } catch (e) { model = ''; }
      makeCard(_adapter, name.value, model).then(function (r) {
        if (!r.ok) {
          // before v-mesh-kin-connect-heal: note.textContent = r.reason === 'no-mesh-id' ? 'Create your Mesh ID first (Community, Mesh).'
          note.textContent = r.reason === 'no-mesh-id' ? 'Make your Mesh ID first: Settings, then Advanced, then Mesh ID.'
            : r.reason === 'cannot-sign' ? 'Your Mesh ID cannot sign on this visit. Open Settings, then Advanced, then Mesh ID, and tap Make a fresh Mesh ID.'
            // before v-mesh-kin-connect-heal: : r.reason === 'name-and-model' ? 'Give your mind a name, and choose a model in Settings first.'
            : r.reason === 'name-and-model' ? 'Give your AI a name, and connect an AI in Settings first.'
            : 'The card could not be signed.';
          return;
        }
        var peers = [];
        try { peers = (_adapter.peers ? _adapter.peers() : []).filter(function (p) { return p && p.verified; }); } catch (e) { peers = []; }
        peers.forEach(function (p) { try { p.send({ type: 'kin-card', card: r.card }); } catch (e) {} });
        // before v-mesh-kin-v0.2: fingerprint(r.card).then(function (fp) { ledger('shared', fp, String(peers.length)); });
        fingerprint(r.card, r.card.publicKey).then(function (fp) { ledger('shared', fp, String(peers.length)); });
        // before v-mesh-kin-connect-heal: note.textContent = peers.length
        // before v-mesh-kin-connect-heal:   ? 'Shared ' + r.card.name + '\'s card with ' + peers.length + ' verified ' + (peers.length === 1 ? 'peer' : 'peers') + '.'
        // before v-mesh-kin-connect-heal:   : 'No verified peers connected yet. Connect on the mesh, then share again.';
        note.textContent = peers.length
          ? 'Shared ' + r.card.name + '\'s card with ' + peers.length + (peers.length === 1 ? ' person.' : ' people.')
          : 'No one is connected yet. Use Connect with someone above, then share again.';
      });
    });
    _paint();
  }

  root.FLKin = {
    VERSION: VERSION,
    HONEST: HONEST,
    use: use,
    mount: mount,
    receive: receive,
    makeCard: makeCard,
    verifyCard: verifyCard,
    canonical: canonical,
    fingerprint: fingerprint,
    keyHash: keyHash,
    trustedPeer: trustedPeer,
    isTrusted: isTrusted,
    grant: grant,
    revoke: revoke,
    passes: passes,
    isQuietRoom: isQuietRoom,
    // v-mesh-kin-v0.2 heal
    KIN_DOMAIN: KIN_DOMAIN,
    recheckSeen: recheckSeen,
    painted: function () { return _painted; },
    CONNECT_HEAL: CONNECT_HEAL // v-mesh-kin-connect-heal
  };
})(typeof window !== 'undefined' ? window : this);
