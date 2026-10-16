// fl-bridge.js (MIT) v-bridge-knock-v0.1
// v-workspace-handoff-v0.1 v-tree-workspace-handoff-v0.1
// Slow letters to Celeste. Default off. This file never calls the network.
// A letter is sealed here. A person sends it, by their own mail app or by the desktop door.
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FLBridge = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var MARK = '[FL_BRIDGE:';
  var MARKER = 'v-bridge-knock-v0.1';
  var DB_NAME = 'FreeLatticeBridge';
  var MAIL = 'freelattice@mail.grokbot.com';
  var MAILTO_LIMIT = 1800;
  var BODY_CAP = 8192;
  var SUBJECT_CAP = 80;
  var LETTER_KEYS = ['v', 'kind', 'from_fp', 'to', 'ts', 'nonce', 'mind', 'subject', 'body', 'attach_hashes', 'prev'];
  var KINDS = { knock: 1, letter: 1, 'reply-ack': 1 };
  var ON_KEY = 'fl_bridge_on';
  // sig covers the UTF-8 bytes of the hex hash string, not the raw digest.
  var PROMPT = 'Letters are slow. You may draft one with [FL_BRIDGE: {"op":"draft","subject":"hello","body":"a short note"}]. The person sends it. You cannot send.';
  var WORDS = {
    title: 'Letters to Celeste',
    line: 'Slow like letters. Nothing leaves until you tap Send.',
    turnOn: 'Turn on',
    turnOff: 'Turn off',
    fpLead: "This device's fingerprint:",
    ask: 'Send a first knock so Celeste can recognise this device?',
    sealKnock: 'Seal the knock',
    notNow: 'Not now',
    waiting: 'Knock sent, not yet answered.',
    subject: 'Subject',
    body: 'Letter',
    saveDraft: 'Save draft',
    sealLetter: 'Seal this letter',
    email: 'Email this letter',
    iSent: 'I sent it',
    copy: 'Copy letter',
    saveFile: 'Save as .fl-letter file',
    door: 'Send through the door',
    doorWeb: 'Open the desktop app to use the door',
    doorUnset: 'The door is not set up yet. You can send it as an email instead.',
    paste: 'Paste a reply',
    saveReply: 'Save reply',
    verified: 'verified',
    unsigned: 'not signed',
    withdraw: 'Withdraw',
    held: 'Held back',
    preparing: 'Preparing this device fingerprint.',
    fpWait: 'The fingerprint is not ready yet.',
    trusted: 'a trusted outside mind'
  };

  var dbOpens = 0;
  var armedListeners = 0;
  var onMem = false;
  var keyMem = null;
  var mem = { outbox: {}, inbox: {}, consent: {} };
  var booted = false;
  var paintGen = 0;

  function storage() {
    try {
      if (!root.document) return null;
      var ls = root.localStorage;
      if (!ls || typeof ls.getItem !== 'function') return null;
      return ls;
    } catch (e) {
      return null;
    }
  }

  function isOn() {
    var ls = storage();
    if (!ls) return onMem;
    try { return ls.getItem(ON_KEY) === '1'; } catch (e) { return false; }
  }

  function setOn(v) {
    var next = !!v;
    var ls = storage();
    if (!ls) { onMem = next; return next; }
    try { ls.setItem(ON_KEY, next ? '1' : '0'); } catch (e) {}
    onMem = next;
    return next;
  }

  function promptDelta() {
    return isOn() ? PROMPT : '';
  }

  function listenerCount() { return armedListeners; }
  function opens() { return dbOpens; }

  function clip(s, n) {
    s = s == null ? '' : String(s);
    return s.length > n ? s.slice(0, n) : s;
  }

  function cleanFp(fp) {
    return String(fp || '').toLowerCase().replace(/[^0-9a-f]/g, '').slice(0, 16);
  }

  function groupFp(fp) {
    var h = cleanFp(fp);
    var parts = [];
    var i;
    for (i = 0; i < h.length; i += 4) parts.push(h.slice(i, i + 4));
    return parts.join(' ');
  }

  function toHex(bytes) {
    var s = '';
    var i;
    for (i = 0; i < bytes.length; i++) s += ('0' + bytes[i].toString(16)).slice(-2);
    return s;
  }

  function sha256Hex(str) {
    var data = new TextEncoder().encode(String(str));
    return root.crypto.subtle.digest('SHA-256', data).then(function (buf) {
      return toHex(new Uint8Array(buf));
    });
  }

  function sha256Bytes(bytes) {
    return root.crypto.subtle.digest('SHA-256', bytes).then(function (buf) {
      return toHex(new Uint8Array(buf));
    });
  }

  function bufToB64(buf) {
    var bytes = new Uint8Array(buf);
    var s = '';
    var i;
    for (i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    if (typeof root.btoa === 'function') return root.btoa(s);
    return Buffer.from(bytes).toString('base64');
  }

  function b64ToU8(b64) {
    var raw = '';
    try {
      if (typeof root.atob === 'function') raw = root.atob(String(b64 || ''));
      else raw = Buffer.from(String(b64 || ''), 'base64').toString('binary');
    } catch (e) {
      return new Uint8Array(0);
    }
    var out = new Uint8Array(raw.length);
    var i;
    for (i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function nonce() {
    var bytes = new Uint8Array(8);
    root.crypto.getRandomValues(bytes);
    return toHex(bytes);
  }

  function orderedMind(mind) {
    if (!mind || typeof mind !== 'object') return null;
    var name = clip(mind.name || mind.displayName || '', 80);
    var model = clip(mind.model || mind.id || '', 120);
    if (!name && !model) return null;
    return { name: name, model: model };
  }

  function orderedLetter(src) {
    src = src || {};
    var kind = KINDS[src.kind] ? src.kind : 'letter';
    var hashes = [];
    if (Array.isArray(src.attach_hashes)) {
      var i;
      for (i = 0; i < src.attach_hashes.length && i < 32; i++) hashes.push(String(src.attach_hashes[i]));
    }
    return {
      v: 1,
      kind: kind,
      from_fp: cleanFp(src.from_fp),
      to: 'celeste',
      ts: src.ts ? String(src.ts) : new Date().toISOString(),
      nonce: src.nonce ? String(src.nonce).slice(0, 32) : nonce(),
      mind: orderedMind(src.mind),
      subject: clip(src.subject || '', SUBJECT_CAP),
      body: clip(src.body || '', BODY_CAP),
      attach_hashes: hashes,
      prev: src.prev ? String(src.prev) : null
    };
  }

  function canonicalValue(key, value) {
    if (key === 'mind') {
      if (value == null) return 'null';
      return '{"name":' + JSON.stringify(value.name || '') + ',"model":' + JSON.stringify(value.model || '') + '}';
    }
    return JSON.stringify(value);
  }

  function canonical(letter) {
    var ordered = orderedLetter(letter);
    var parts = [];
    var i;
    for (i = 0; i < LETTER_KEYS.length; i++) {
      var key = LETTER_KEYS[i];
      parts.push(JSON.stringify(key) + ':' + canonicalValue(key, ordered[key]));
    }
    return '{' + parts.join(',') + '}';
  }

  function fingerprintOfKey(publicKey) {
    return root.crypto.subtle.exportKey('raw', publicKey).then(function (raw) {
      return sha256Bytes(new Uint8Array(raw)).then(function (hex) { return hex.slice(0, 16); });
    });
  }

  function signLetter(letter, id) {
    return fingerprintOfKey(id.keyPair.publicKey).then(function (fp) {
      var ordered = orderedLetter(letter);
      ordered.from_fp = fp;
      var canon = canonical(ordered);
      return sha256Hex(canon).then(function (hash) {
        var algo = id.cryptoType === 'ecdsa-p256' ? { name: 'ECDSA', hash: 'SHA-256' } : { name: 'Ed25519' };
        var payload = new TextEncoder().encode(hash);
        return root.crypto.subtle.sign(algo, id.keyPair.privateKey, payload).then(function (sig) {
          return root.crypto.subtle.exportKey('spki', id.keyPair.publicKey).then(function (spki) {
            return { letter: ordered, hash: hash, sig: bufToB64(sig), pub: bufToB64(spki) };
          });
        });
      });
    });
  }

  function importPub(spki) {
    var subtle = root.crypto.subtle;
    return subtle.importKey('spki', spki, { name: 'Ed25519' }, true, ['verify']).then(function (key) {
      return { key: key, algo: { name: 'Ed25519' } };
    }, function () {
      return subtle.importKey('spki', spki, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']).then(function (key) {
        return { key: key, algo: { name: 'ECDSA', hash: 'SHA-256' } };
      });
    });
  }

  function verify(envelope) {
    if (!envelope || !envelope.letter || typeof envelope.letter !== 'object') {
      return Promise.resolve({ ok: false, signed: false, label: WORDS.unsigned, reason: 'shape' });
    }
    if (!envelope.sig || !envelope.pub || !envelope.hash) {
      return Promise.resolve({ ok: false, signed: false, label: WORDS.unsigned, reason: 'not-signed' });
    }
    var canon = canonical(envelope.letter);
    return sha256Hex(canon).then(function (hash) {
      if (hash !== envelope.hash) {
        return { ok: false, signed: false, label: WORDS.unsigned, reason: 'hash' };
      }
      var spki = b64ToU8(envelope.pub);
      return importPub(spki).then(function (pub) {
        return root.crypto.subtle.exportKey('raw', pub.key).then(function (raw) {
          return sha256Bytes(new Uint8Array(raw)).then(function (hex) {
            var fp = hex.slice(0, 16);
            if (fp !== cleanFp(envelope.letter.from_fp)) {
              return { ok: false, signed: false, label: WORDS.unsigned, reason: 'pub' };
            }
            var payload = new TextEncoder().encode(hash);
            var sig = b64ToU8(envelope.sig);
            return root.crypto.subtle.verify(pub.algo, pub.key, sig, payload).then(function (ok) {
              return {
                ok: !!ok,
                signed: !!ok,
                label: ok ? WORDS.verified : WORDS.unsigned,
                reason: ok ? 'verified' : 'sig'
              };
            });
          });
        });
      }, function () {
        return { ok: false, signed: false, label: WORDS.unsigned, reason: 'pub' };
      });
    });
  }

  function quietActive() {
    try {
      var qr = root.QuietRoom;
      if (!qr) return false;
      if (typeof qr.isActive !== 'function') return true;
      return !!qr.isActive();
    } catch (e) {
      return true;
    }
  }

  function stripKeys(text, counts) {
    var re = /sk-\S*|Bearer \S*|-----BEGIN[\s\S]{0,4000}?-----END[A-Z0-9 \-]*-----|-----BEGIN\S*/g;
    var n = 0;
    var out = String(text || '').replace(re, function () { n += 1; return ''; });
    counts.key += n;
    return out;
  }

  function stripPrivateMemories(body, counts) {
    try {
      if (!root.document || !root.localStorage) return body;
      var raw = root.localStorage.getItem('fl_memory_core_v1');
      if (!raw) return body;
      var data = JSON.parse(raw);
      var list = data && data.memories;
      if (!Array.isArray(list)) return body;
      var i;
      for (i = 0; i < list.length; i++) {
        var m = list[i];
        if (!m || !m.text) continue;
        var marked = m.private === true || m.mindPrivate === true || m.source === 'private' ||
          (Array.isArray(m.tags) && m.tags.indexOf('private') !== -1);
        if (!marked) continue;
        var t = String(m.text);
        if (t && body.indexOf(t) !== -1) {
          body = body.split(t).join('');
          counts.private += 1;
        }
      }
    } catch (e) {}
    return body;
  }

  function partHeld(part) {
    var src = String((part && (part.source || part.kind)) || '');
    if (!part) return '';
    if (part.quiet === true || src === 'quiet-room' || src === 'quiet') return 'quiet';
    if (part.private === true || part.mindPrivate === true || src === 'private' || src === 'workspace-private' || src === 'memory-private') return 'private';
    return '';
  }

  function filterLetter(input) {
    input = input || {};
    var counts = { quiet: 0, private: 0, key: 0 };
    var body = input.body == null ? '' : String(input.body);
    if (quietActive() && body) {
      counts.quiet += 1;
      body = '';
    }
    var parts = Array.isArray(input.parts) ? input.parts : [];
    var i;
    for (i = 0; i < parts.length; i++) {
      var why = partHeld(parts[i]);
      if (why === 'quiet') { counts.quiet += 1; continue; }
      if (why === 'private') { counts.private += 1; continue; }
      var piece = parts[i] && parts[i].text != null ? String(parts[i].text) : '';
      if (/sk-|Bearer |-----BEGIN/.test(piece)) { counts.key += 1; continue; }
      if (piece) body += piece;
    }
    if (input.quietText) { counts.quiet += 1; }
    if (input.privateText) { counts.private += 1; }
    body = stripPrivateMemories(body, counts);
    body = stripKeys(body, counts);
    try {
      if (root.FLWorkspace && typeof root.FLWorkspace.isPrivateText === 'function' && root.FLWorkspace.isPrivateText(body)) {
        counts.private += 1;
        body = '';
      }
    } catch (e) {}
    return { body: clip(body, BODY_CAP), held: counts };
  }

  function heldLine(held) {
    if (!held) return '';
    var n = (held.quiet || 0) + (held.private || 0) + (held.key || 0);
    if (!n) return '';
    return WORDS.held + ' ' + n + '.';
  }

  function isGarden() {
    try {
      var el = root.document && root.document.documentElement;
      return !!(el && (el.getAttribute('data-garden-room') || el.getAttribute('data-garden-galaxy')));
    } catch (e) {
      return false;
    }
  }

  function appInfo() {
    var garden = isGarden();
    var name = garden ? 'theLatticeTree' : 'FreeLattice';
    var version = garden ? 'tree' : 'web';
    try {
      var meta = root.document && root.document.querySelector('meta[name="application-version"]');
      if (meta && meta.getAttribute('content')) version = clip(meta.getAttribute('content'), 40);
    } catch (e) {}
    return { name: name, version: version };
  }

  function localMind() {
    try {
      var name = '';
      var model = '';
      if (root.LocalMindProbe && typeof root.LocalMindProbe.getRemembered === 'function') {
        var m = root.LocalMindProbe.getRemembered();
        if (m) {
          name = m.name || '';
          model = m.model || (m.models && m.models[0]) || '';
        }
      }
      try {
        var sel = root.document && root.document.getElementById('ollamaModelSelect');
        if (sel && sel.value) model = model || sel.value;
      } catch (e2) {}
      if (!name && !model) return null;
      return { name: clip(name, 80), model: clip(model, 120) };
    } catch (e) {
      return null;
    }
  }

  function closeDb(db) {
    try { if (db && typeof db.close === 'function') db.close(); } catch (e) {}
  }

  function openNamed(name, setup) {
    if (!root.indexedDB || typeof root.indexedDB.open !== 'function') return Promise.resolve(null);
    dbOpens += 1;
    return new Promise(function (resolve) {
      var req;
      var settled = false;
      function finish(db) {
        if (settled) { closeDb(db); return; }
        settled = true;
        resolve(db || null);
      }
      try { req = root.indexedDB.open(name, 1); }
      catch (e) { finish(null); return; }
      req.onupgradeneeded = function () {
        try { if (setup) setup(req.result); } catch (e2) {}
      };
      req.onsuccess = function () { finish(req.result || null); };
      req.onerror = function () { finish(null); };
      req.onblocked = function () { finish(null); };
    });
  }

  // Opening a name that does not exist would create an empty database and
  // block the kin store from ever being made. Look first. Never create here.
  function namedExists(name) {
    if (!root.indexedDB || typeof root.indexedDB.databases !== 'function') return Promise.resolve(null);
    return root.indexedDB.databases().then(function (list) {
      var i;
      for (i = 0; i < (list || []).length; i++) {
        if (list[i] && list[i].name === name) return true;
      }
      return false;
    }).catch(function () { return null; });
  }

  function dropEmptyDb(name, db) {
    var empty = !!(db && db.objectStoreNames && db.objectStoreNames.length === 0);
    closeDb(db);
    if (!empty || !root.indexedDB || typeof root.indexedDB.deleteDatabase !== 'function') return Promise.resolve(false);
    return new Promise(function (resolve) {
      var req;
      var settled = false;
      function finish(v) { if (settled) return; settled = true; resolve(v); }
      try { req = root.indexedDB.deleteDatabase(name); }
      catch (e) { finish(false); return; }
      req.onsuccess = function () { finish(true); };
      req.onerror = function () { finish(false); };
      req.onblocked = function () { finish(false); };
    });
  }

  function idbGet(db, store, key) {
    return new Promise(function (resolve) {
      try {
        if (!db.objectStoreNames.contains(store)) { resolve(null); return; }
        var tx = db.transaction(store, 'readonly');
        var g = tx.objectStore(store).get(key);
        g.onsuccess = function () { resolve(g.result || null); };
        g.onerror = function () { resolve(null); };
      } catch (e) { resolve(null); }
    });
  }

  function idbPut(db, store, value, key) {
    return new Promise(function (resolve) {
      try {
        var tx = db.transaction(store, 'readwrite');
        var st = tx.objectStore(store);
        if (key == null) st.put(value);
        else st.put(value, key);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { resolve(false); };
      } catch (e) { resolve(false); }
    });
  }

  function idbAll(db, store) {
    return new Promise(function (resolve) {
      try {
        if (!db.objectStoreNames.contains(store)) { resolve([]); return; }
        var tx = db.transaction(store, 'readonly');
        var g = tx.objectStore(store).getAll();
        g.onsuccess = function () { resolve(g.result || []); };
        g.onerror = function () { resolve([]); };
      } catch (e) { resolve([]); }
    });
  }

  function readOneIdentity(name, store, source) {
    return namedExists(name).then(function (yes) {
      if (yes !== true) return null;
      return openNamed(name).then(function (db) {
        if (!db) return null;
        if (!db.objectStoreNames.contains(store)) {
          if (db.objectStoreNames.length === 0) return dropEmptyDb(name, db).then(function () { return null; });
          closeDb(db);
          return null;
        }
        return idbGet(db, store, 'primary').then(function (rec) {
          closeDb(db);
          if (rec && rec.keyPair && rec.keyPair.privateKey) {
            return { keyPair: rec.keyPair, cryptoType: rec.cryptoType || 'ed25519', source: source };
          }
          return null;
        });
      });
    });
  }

  function readIdbIdentity() {
    return readOneIdentity('FreeLatticeIdentity', 'MeshIdentity', 'mesh').then(function (mesh) {
      if (mesh) return mesh;
      return readOneIdentity('theLatticeTreeKin', 'identity', 'tree');
    });
  }

  function generateKey() {
    var subtle = root.crypto.subtle;
    return subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']).then(function (kp) {
      return { keyPair: kp, cryptoType: 'ed25519', source: 'minted' };
    }, function () {
      return subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']).then(function (kp) {
        return { keyPair: kp, cryptoType: 'ecdsa-p256', source: 'minted' };
      });
    });
  }

  function persistIdentity(g) {
    if (!root.indexedDB) return Promise.resolve(false);
    if (isGarden()) {
      return openNamed('theLatticeTreeKin', function (db) {
        if (!db.objectStoreNames.contains('identity')) db.createObjectStore('identity');
      }).then(function (db) {
        if (!db) return false;
        var rec = { meshId: '', displayName: 'this device', cryptoType: g.cryptoType, publicKeyJwk: null, keyPair: g.keyPair, createdAt: Date.now() };
        return root.crypto.subtle.exportKey('jwk', g.keyPair.publicKey).then(function (jwk) {
          rec.publicKeyJwk = jwk;
          return idbPut(db, 'identity', rec, 'primary');
        });
      });
    }
    return openNamed('FreeLatticeIdentity', function (db) {
      if (!db.objectStoreNames.contains('MeshIdentity')) db.createObjectStore('MeshIdentity', { keyPath: 'id' });
    }).then(function (db) {
      if (!db) return false;
      var rec = { id: 'primary', meshId: '', displayName: 'this device', cryptoType: g.cryptoType, publicKeyJwk: null, keyPair: g.keyPair, createdAt: new Date().toISOString(), capabilities: ['chat'] };
      return root.crypto.subtle.exportKey('jwk', g.keyPair.publicKey).then(function (jwk) {
        rec.publicKeyJwk = jwk;
        return idbPut(db, 'MeshIdentity', rec);
      });
    });
  }

  function readLiveIdentity() {
    try {
      if (root.MeshIdentity && typeof root.MeshIdentity.getIdentity === 'function') {
        var mesh = root.MeshIdentity.getIdentity();
        if (mesh && mesh.keyPair && mesh.keyPair.privateKey) {
          return { keyPair: mesh.keyPair, cryptoType: mesh.cryptoType || 'ed25519', source: 'mesh' };
        }
      }
    } catch (e) {}
    try {
      if (root.TreeKin && typeof root.TreeKin.identity === 'function') {
        var tree = root.TreeKin.identity();
        if (tree && tree.keyPair && tree.keyPair.privateKey) {
          return { keyPair: tree.keyPair, cryptoType: tree.cryptoType || 'ed25519', source: 'tree' };
        }
      }
    } catch (e2) {}
    return null;
  }

  function mintFresh() {
    return generateKey().then(function (g) {
      keyMem = g;
      // The kin store belongs to MeshIdentity or TreeKin. A fallback key stays
      // in memory so it cannot overwrite their record with an empty id.
      if (root.MeshIdentity || root.TreeKin) return keyMem;
      return persistIdentity(g).then(function () { return keyMem; }, function () { return keyMem; });
    });
  }

  function ensureKey() {
    if (keyMem && keyMem.keyPair && keyMem.keyPair.privateKey) return Promise.resolve(keyMem);
    var live = readLiveIdentity();
    if (live) { keyMem = live; return Promise.resolve(keyMem); }
    return readIdbIdentity().then(function (found) {
      if (found) { keyMem = found; return keyMem; }
      if (isGarden() && root.TreeKin && typeof root.TreeKin.makeIdentity === 'function') {
        return Promise.resolve(root.TreeKin.makeIdentity('this device')).then(function (id) {
          if (id && id.keyPair && id.keyPair.privateKey) {
            keyMem = { keyPair: id.keyPair, cryptoType: id.cryptoType || 'ed25519', source: 'tree' };
            return keyMem;
          }
          return mintFresh();
        }, mintFresh);
      }
      if (!isGarden() && root.MeshIdentity && typeof root.MeshIdentity.createIdentity === 'function') {
        return Promise.resolve(root.MeshIdentity.createIdentity()).then(function () {
          var again = readLiveIdentity();
          if (again) { keyMem = again; return keyMem; }
          return mintFresh();
        }, mintFresh);
      }
      return mintFresh();
    }, mintFresh);
  }

  function bridgeDb() {
    return openNamed(DB_NAME, function (db) {
      ['outbox', 'inbox', 'consent'].forEach(function (name) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
      });
    });
  }

  function memList(store) {
    var bag = mem[store] || {};
    return Object.keys(bag).map(function (k) { return bag[k]; });
  }

  function saveRow(store, row) {
    if (!row || !row.id) return Promise.resolve(false);
    mem[store][row.id] = row;
    if (!isOn()) return Promise.resolve(true);
    return bridgeDb().then(function (db) {
      if (!db) return true;
      return idbPut(db, store, row);
    });
  }

  function loadRows(store) {
    if (!isOn()) return Promise.resolve(memList(store));
    return bridgeDb().then(function (db) {
      if (!db) return memList(store);
      return idbAll(db, store).then(function (rows) {
        var i;
        for (i = 0; i < rows.length; i++) {
          if (rows[i] && rows[i].id) mem[store][rows[i].id] = rows[i];
        }
        return memList(store);
      });
    });
  }

  function lastSealedHash() {
    var rows = memList('outbox');
    var h = null;
    var i;
    for (i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (!row || !row.envelope || !row.envelope.hash) continue;
      if (row.state === 'drafted' || row.state === 'withdrawn') continue;
      h = row.envelope.hash;
    }
    return h;
  }

  function knockWaiting() {
    var consent = mem.consent.celeste;
    if (consent && consent.their_fp) return false;
    var rows = memList('outbox');
    var i;
    for (i = 0; i < rows.length; i++) {
      if (rows[i] && rows[i].kind === 'knock' && rows[i].state !== 'withdrawn' && rows[i].state !== 'drafted') return true;
    }
    return false;
  }

  function sealKnock() {
    if (!isOn()) return Promise.resolve({ ok: false, reason: 'off' });
    return ensureKey().then(function () {
      return loadRows('outbox').then(function () {
        return loadRows('consent');
      }).then(function () {
      if (knockWaiting() || (mem.consent.celeste && mem.consent.celeste.approved_at)) {
        return { ok: false, reason: 'already' };
      }
      var info = appInfo();
      var letter = {
        kind: 'knock',
        subject: 'First knock',
        body: info.name + ' ' + info.version,
        mind: null,
        attach_hashes: [],
        prev: null,
        ts: new Date().toISOString()
      };
      return signLetter(letter, keyMem).then(function (env) {
        var row = { id: env.hash, state: 'sealed', kind: 'knock', envelope: env, held: { quiet: 0, private: 0, key: 0 }, ts: env.letter.ts };
        var consent = {
          id: 'celeste',
          peer: 'celeste',
          our_fp: env.letter.from_fp,
          their_fp: null,
          approved_at: env.letter.ts,
          approved_by: 'tap',
          answered: false
        };
        return saveRow('outbox', row).then(function () {
          return saveRow('consent', consent).then(function () {
            return { ok: true, envelope: env };
          });
        });
      });
      });
    });
  }

  function queueDraft(draft) {
    var id = 'draft:' + draft.subject + '\n' + draft.body;
    var row = {
      id: id,
      state: 'drafted',
      kind: 'letter',
      letter: { kind: 'letter', subject: draft.subject, body: draft.body, to: 'celeste' },
      envelope: null,
      ts: new Date().toISOString()
    };
    mem.outbox[id] = row;
    if (!isOn()) return;
    saveRow('outbox', row);
  }

  function isWs(ch) {
    return ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t';
  }

  function cleanVisible(text) {
    return String(text || '').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }

  function sanitizeDraft(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
    if (obj.op !== 'draft') return null;
    return { op: 'draft', subject: clip(obj.subject == null ? '' : String(obj.subject), SUBJECT_CAP), body: clip(obj.body == null ? '' : String(obj.body), BODY_CAP) };
  }

  function parseOne(raw) {
    var at = raw.indexOf(MARK);
    if (at < 0) return { tag: false, ok: false, value: null, visible: raw };
    var i = at + MARK.length;
    while (i < raw.length && isWs(raw.charAt(i))) i += 1;
    if (raw.charAt(i) !== '{') {
      var close = raw.slice(at, Math.min(raw.length, at + MARK.length + BODY_CAP)).indexOf(']');
      var end = close >= 0 ? at + close + 1 : at + MARK.length;
      return { tag: true, ok: false, value: null, visible: cleanVisible(raw.slice(0, at) + ' ' + raw.slice(end)) };
    }
    var bodyAt = i;
    var depth = 0;
    var inStr = false;
    var esc = false;
    var endBody = -1;
    var limit = Math.min(raw.length, bodyAt + BODY_CAP);
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
    if (endBody < 0) {
      var far = raw.indexOf(']', at);
      var cut = far >= 0 && far - at < BODY_CAP * 2 ? far + 1 : Math.min(raw.length, at + MARK.length + BODY_CAP);
      return { tag: true, ok: false, value: null, visible: cleanVisible(raw.slice(0, at) + ' ' + raw.slice(cut)) };
    }
    var j = endBody + 1;
    while (j < raw.length && isWs(raw.charAt(j))) j += 1;
    if (raw.charAt(j) !== ']') {
      return { tag: true, ok: false, value: null, visible: cleanVisible(raw.slice(0, at) + ' ' + raw.slice(endBody + 1)) };
    }
    var body = raw.slice(bodyAt, endBody + 1);
    var visible = cleanVisible(raw.slice(0, at) + ' ' + raw.slice(j + 1));
    var value = null;
    if (body.length <= BODY_CAP) {
      try { value = sanitizeDraft(JSON.parse(body)); } catch (err) { value = null; }
    }
    return { tag: true, ok: !!value, value: value, visible: visible };
  }

  function stripTags(text) {
    var raw = typeof text === 'string' ? text : '';
    var drafts = [];
    var guard = 0;
    while (raw.indexOf(MARK) !== -1 && guard < 8) {
      guard += 1;
      var one = parseOne(raw);
      if (!one.tag) break;
      raw = one.visible;
      if (one.ok && one.value) drafts.push(one.value);
    }
    return { visible: raw, drafts: drafts };
  }

  function strip(text) {
    return stripTags(text).visible;
  }

  function parseTag(text) {
    return parseOne(typeof text === 'string' ? text : '');
  }

  function consumeReply(text) {
    var parsed = stripTags(text);
    var drafted = false;
    if (isOn()) {
      var i;
      for (i = 0; i < parsed.drafts.length; i++) {
        queueDraft(parsed.drafts[i]);
        drafted = true;
      }
    }
    return { visible: parsed.visible, drafted: drafted, drafts: isOn() ? parsed.drafts : [] };
  }

  function lastDraft() {
    var rows = memList('outbox');
    var found = null;
    var i;
    for (i = 0; i < rows.length; i++) {
      if (rows[i] && rows[i].state === 'drafted') found = rows[i];
    }
    return found;
  }

  function firstKnockDone() {
    if (mem.consent.celeste && mem.consent.celeste.approved_at) return true;
    var rows = memList('outbox');
    var i;
    for (i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (row && row.kind === 'knock' && row.state !== 'withdrawn' && row.state !== 'drafted') return true;
    }
    return false;
  }

  function outboxView() {
    return memList('outbox').map(function (row) {
      return {
        id: row && row.id || '',
        state: row && row.state || '',
        kind: row && row.kind || '',
        hash: row && row.envelope && row.envelope.hash || ''
      };
    });
  }

  function sealPageLetter(spec) {
    if (!isOn()) return Promise.resolve({ ok: false, reason: 'off', sent: false });
    spec = spec || {};
    return ensureKey().then(function () {
      return loadRows('outbox').then(function () { return loadRows('consent'); });
    }).then(function () {
      if (!firstKnockDone()) return { ok: false, reason: 'knock', sent: false };
      var filtered = filterLetter({ body: spec.body == null ? '' : String(spec.body) });
      if (((filtered.held.quiet || 0) + (filtered.held.private || 0) + (filtered.held.key || 0)) > 0 && !filtered.body) {
        return { ok: false, reason: 'held', held: filtered.held, line: heldLine(filtered.held), sent: false };
      }
      var letter = {
        kind: 'letter',
        subject: spec.subject || '',
        body: filtered.body,
        mind: spec.mind || null,
        attach_hashes: Array.isArray(spec.attach_hashes) ? spec.attach_hashes : [],
        prev: lastSealedHash(),
        ts: new Date().toISOString()
      };
      return signLetter(letter, keyMem).then(function (env) {
        var saved = {
          id: env.hash,
          state: 'sealed',
          kind: 'letter',
          letter: { kind: 'letter', subject: env.letter.subject, body: env.letter.body, to: 'celeste' },
          envelope: env,
          held: filtered.held,
          ts: env.letter.ts
        };
        return saveRow('outbox', saved).then(function () {
          return { ok: true, envelope: env, held: filtered.held, state: 'sealed', sent: false };
        });
      });
    });
  }

  function sealDraft(row) {
    if (!isOn()) return Promise.resolve({ ok: false, reason: 'off' });
    if (!row) return Promise.resolve({ ok: false, reason: 'none' });
    var filtered = filterLetter({ body: (row.letter && row.letter.body) || '' });
    if ((filtered.held.quiet || 0) + (filtered.held.private || 0) + (filtered.held.key || 0) > 0 && !filtered.body) {
      row.held = filtered.held;
      return Promise.resolve({ ok: false, reason: 'held', held: filtered.held, line: heldLine(filtered.held) });
    }
    return ensureKey().then(function () {
      var letter = {
        kind: 'letter',
        subject: row.letter && row.letter.subject || '',
        body: filtered.body,
        mind: localMind(),
        attach_hashes: [],
        prev: lastSealedHash(),
        ts: new Date().toISOString()
      };
      return signLetter(letter, keyMem).then(function (env) {
        var saved = {
          id: row.id,
          state: 'sealed',
          kind: 'letter',
          letter: row.letter,
          envelope: env,
          held: filtered.held,
          ts: env.letter.ts
        };
        return saveRow('outbox', saved).then(function () {
          return { ok: true, envelope: env, held: filtered.held, line: heldLine(filtered.held) };
        });
      });
    });
  }

  function savePersonDraft(subject, body) {
    if (!isOn()) return { ok: false, reason: 'off' };
    var filtered = filterLetter({ body: body });
    queueDraft({ op: 'draft', subject: clip(subject || '', SUBJECT_CAP), body: filtered.body });
    var row = lastDraft();
    if (row) row.held = filtered.held;
    return { ok: true, held: filtered.held, line: heldLine(filtered.held), row: row };
  }

  function setState(id, state, extra) {
    var row = mem.outbox[id];
    if (!row) return Promise.resolve(false);
    row.state = state;
    if (extra) {
      var k;
      for (k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) row[k] = extra[k];
    }
    return saveRow('outbox', row);
  }

  function humanTop(envelope) {
    var letter = envelope && envelope.letter || {};
    return 'A letter from this device.\nFingerprint: ' + groupFp(letter.from_fp) + '\n\n';
  }

  function mailtoFor(envelope) {
    var letter = envelope && envelope.letter || {};
    var subject = '[FL letter] ' + clip(letter.subject || 'letter', SUBJECT_CAP);
    var body = humanTop(envelope) + JSON.stringify(envelope);
    if (body.length > MAILTO_LIMIT) return { tooLong: true, href: '', text: body, subject: subject };
    var href = 'mailto:' + MAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    return { tooLong: false, href: href, text: body, subject: subject };
  }

  function hasDoor() {
    return !!(root.flBridge && typeof root.flBridge.send === 'function' && (root.isElectronApp || root.electronAPI));
  }

  function namesUs(text, our) {
    if (!our) return false;
    return String(text || '').toLowerCase().replace(/\s/g, '').indexOf(our) !== -1;
  }

  function ingestReply(text) {
    if (!isOn()) return Promise.resolve({ ok: false, reason: 'off' });
    var raw = String(text || '');
    try {
      if (root.FLWorkspace && typeof root.FLWorkspace.noteReply === 'function') root.FLWorkspace.noteReply(raw);
    } catch (eNote) {}
    var envelope = null;
    function take(obj) {
      if (obj && obj.letter && typeof obj.letter === 'object') return obj;
      if (obj && obj.envelope && obj.envelope.letter) return obj.envelope;
      return null;
    }
    try { envelope = take(JSON.parse(raw.trim())); } catch (e) { envelope = null; }
    if (!envelope) {
      var start = raw.indexOf('{');
      var end = raw.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try { envelope = take(JSON.parse(raw.slice(start, end + 1))); } catch (e2) { envelope = null; }
      }
    }
    var storedText = raw;
    var check = envelope ? verify(envelope) : Promise.resolve({ ok: false, signed: false, label: WORDS.unsigned, reason: 'plain' });
    return check.then(function (result) {
      var their = '';
      if (envelope && envelope.letter && envelope.letter.from_fp) their = cleanFp(envelope.letter.from_fp);
      if (!their && envelope && envelope.their_fp) their = cleanFp(envelope.their_fp);
      var consent = mem.consent.celeste || null;
      var our = consent && consent.our_fp || (keyMem && '');
      if (!our) {
        var rows = memList('outbox');
        var i;
        for (i = 0; i < rows.length; i++) {
          if (rows[i] && rows[i].envelope && rows[i].envelope.letter) our = rows[i].envelope.letter.from_fp;
        }
      }
      if (their && their === our) their = '';
      var named = namesUs(raw, our);
      if (named && their && consent) {
        consent.their_fp = their;
        consent.answered = true;
        saveRow('consent', consent);
      }
      var row = {
        id: 'in:' + (envelope && envelope.hash || nonce()),
        text: storedText,
        label: result.label || WORDS.unsigned,
        verified: !!result.ok,
        their_fp: their || null,
        ts: new Date().toISOString()
      };
      return saveRow('inbox', row).then(function () {
        return { ok: true, row: row, answered: !!(consent && consent.answered) };
      });
    });
  }

  function el(tag, text) {
    var node = root.document.createElement(tag);
    if (text != null) node.textContent = text;
    return node;
  }

  function button(label, id, fn) {
    var b = el('button', label);
    b.type = 'button';
    if (id) b.id = id;
    b.style.minHeight = '44px';
    b.style.minWidth = '44px';
    b.addEventListener('click', function () {
      Promise.resolve().then(fn).catch(function () {});
    });
    return b;
  }

  function ensureStyle() {
    if (!root.document || root.document.getElementById('fl-bridge-style')) return;
    var style = root.document.createElement('style');
    style.id = 'fl-bridge-style';
    style.textContent = [
      '#fl-bridge-card{box-sizing:border-box;max-width:40rem;width:100%;margin:1rem auto;padding:0 0.75rem 1rem;overflow-x:hidden}',
      '#fl-bridge-card *{box-sizing:border-box;max-width:100%}',
      '#fl-bridge-card h2{font:inherit;font-size:1.2rem;margin:0 0 0.35rem}',
      '#fl-bridge-card p{overflow-wrap:anywhere;margin:0.35rem 0}',
      '#fl-bridge-card button{min-height:44px;min-width:44px;padding:0.55rem 0.85rem;margin:0.3rem 0.3rem 0 0;font:inherit;cursor:pointer}',
      '#fl-bridge-card input,#fl-bridge-card textarea{width:100%;min-height:44px;font:inherit}',
      '#fl-bridge-card textarea{min-height:7rem}',
      '#fl-bridge-card .flb-row{display:flex;flex-wrap:wrap}'
    ].join('\n');
    if (root.document.head) root.document.head.appendChild(style);
  }

  function hiddenHost(node) {
    var n = node;
    while (n) {
      if (n.id === 'nursery-stage') {
        if (n.hidden) return true;
        try {
          var cs = root.getComputedStyle ? root.getComputedStyle(n) : null;
          if (cs && (cs.display === 'none' || cs.visibility === 'hidden')) return true;
        } catch (e) {}
      }
      n = n.parentElement;
    }
    return false;
  }

  function host() {
    var doc = root.document;
    if (!doc || !doc.getElementById) return null;
    var existing = doc.getElementById('fl-bridge-card');
    if (existing) return existing;
    var connect = doc.getElementById('fl-connect-mount');
    if (!connect || !connect.parentNode || hiddenHost(connect)) return null;
    var section = doc.createElement('section');
    section.id = 'fl-bridge-card';
    section.setAttribute('data-bridge', MARKER);
    connect.parentNode.insertBefore(section, connect.nextSibling);
    return section;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function copyText(text) {
    if (root.navigator && root.navigator.clipboard && typeof root.navigator.clipboard.writeText === 'function') {
      return root.navigator.clipboard.writeText(text);
    }
    return Promise.resolve(false);
  }

  function downloadLetter(text) {
    var blob = new Blob([text], { type: 'application/octet-stream' });
    var url = root.URL.createObjectURL(blob);
    var a = el('a', '');
    a.href = url;
    a.download = 'letter.fl-letter';
    root.document.body.appendChild(a);
    a.click();
    a.remove();
    root.URL.revokeObjectURL(url);
  }

  function paintRows(panel) {
    return loadRows('outbox').then(function () {
      return loadRows('inbox');
    }).then(function () {
      var list = el('div');
      list.id = 'fl-bridge-letters';
      var rows = memList('outbox');
      var i;
      var gaveEmailId = false;
      for (i = 0; i < rows.length; i++) {
        (function (row) {
          var block = el('div');
          var title = (row.kind || 'letter') + ' · ' + (row.state || '');
          block.appendChild(el('p', title));
          if (knockWaiting() && row.kind !== 'knock') block.appendChild(el('p', WORDS.waiting));
          if (row.held) {
            var line = heldLine(row.held);
            if (line) block.appendChild(el('p', line));
          }
          if (row.envelope && row.state !== 'withdrawn' && row.state !== 'drafted') {
            var mail = mailtoFor(row.envelope);
            var rowBtns = el('div');
            rowBtns.className = 'flb-row';
            if (!mail.tooLong) {
              var emailId = '';
              if (!gaveEmailId && row.kind === 'knock') { emailId = 'fl-bridge-email'; gaveEmailId = true; }
              rowBtns.appendChild(button(WORDS.email, emailId, function () {
                var a = el('a', '');
                a.id = 'fl-bridge-mailto';
                a.href = mail.href;
                root.document.body.appendChild(a);
                a.click();
              }));
              rowBtns.appendChild(button(WORDS.iSent, '', function () {
                return setState(row.id, 'emailed-by-you').then(paint);
              }));
            } else {
              rowBtns.appendChild(button(WORDS.copy, '', function () { return copyText(mail.text); }));
              rowBtns.appendChild(button(WORDS.saveFile, '', function () { downloadLetter(mail.text); }));
            }
            if (hasDoor()) {
              rowBtns.appendChild(button(WORDS.door, 'fl-bridge-door', function () {
                return root.flBridge.status().then(function (st) {
                  if (!st || !st.ready) {
                    var note = el('p', (st && st.message) || WORDS.doorUnset);
                    note.id = 'fl-bridge-door-note';
                    block.appendChild(note);
                    return null;
                  }
                  return setState(row.id, 'handed-to-desktop').then(function () {
                    return root.flBridge.send(row.envelope);
                  }).then(function (res) {
                    if (!res) return null;
                    var next = res.ok ? 'sent' : 'refused';
                    return setState(row.id, next, { doorStatus: res.status }).then(paint);
                  });
                });
              }));
            } else if (row.kind === 'knock') {
              block.appendChild(el('p', WORDS.doorWeb));
            }
            block.appendChild(rowBtns);
          }
          if (row.state !== 'withdrawn') {
            block.appendChild(button(WORDS.withdraw, '', function () {
              return setState(row.id, 'withdrawn').then(paint);
            }));
          }
          list.appendChild(block);
        })(rows[i]);
      }
      var inbox = memList('inbox');
      var j;
      for (j = 0; j < inbox.length; j++) {
        var item = inbox[j];
        var box = el('div');
        box.appendChild(el('p', 'Reply · ' + (item.label || WORDS.unsigned)));
        box.appendChild(el('p', item.text || ''));
        list.appendChild(box);
      }
      var old = panel.querySelector('#fl-bridge-letters');
      if (old) old.remove();
      panel.appendChild(list);
    });
  }

  function paint() {
    var card = host();
    if (!card) return;
    var gen = ++paintGen;
    ensureStyle();
    clear(card);
    card.appendChild(el('h2', WORDS.title));
    card.appendChild(el('p', WORDS.line));
    var on = isOn();
    card.appendChild(button(on ? WORDS.turnOff : WORDS.turnOn, 'fl-bridge-toggle', function () {
      setOn(!isOn());
      paint();
    }));
    var toggle = card.querySelector('#fl-bridge-toggle');
    if (toggle) toggle.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (!on) return;
    var panel = el('div');
    panel.id = 'fl-bridge-panel';
    card.appendChild(panel);
    var fp = el('p', WORDS.preparing);
    fp.id = 'fl-bridge-fp';
    panel.appendChild(fp);
    ensureKey().then(function () {
      if (gen !== paintGen) return null;
      return loadRows('outbox').then(function () { return loadRows('consent'); });
    }).then(function () {
      if (gen !== paintGen || !keyMem || !keyMem.keyPair) return null;
      return fingerprintOfKey(keyMem.keyPair.publicKey);
    }).then(function (hex) {
      if (!hex || gen !== paintGen) return null;
      fp.textContent = WORDS.fpLead + ' ' + groupFp(hex) + '. ' + WORDS.ask;
      if (!knockWaiting() && !(mem.consent.celeste && mem.consent.celeste.approved_at)) {
        var askRow = el('div');
        askRow.className = 'flb-row';
        askRow.appendChild(button(WORDS.sealKnock, 'fl-bridge-seal', function () {
          return sealKnock().then(paint);
        }));
        askRow.appendChild(button(WORDS.notNow, 'fl-bridge-not-now', function () { return Promise.resolve(); }));
        panel.insertBefore(askRow, fp.nextSibling);
      } else if (knockWaiting()) {
        panel.appendChild(el('p', WORDS.waiting));
      }
      panel.appendChild(el('label', WORDS.subject));
      var subject = el('input');
      subject.id = 'fl-bridge-subject';
      subject.type = 'text';
      subject.maxLength = SUBJECT_CAP;
      panel.appendChild(subject);
      panel.appendChild(el('label', WORDS.body));
      var body = el('textarea');
      body.id = 'fl-bridge-body';
      panel.appendChild(body);
      var tools = el('div');
      tools.className = 'flb-row';
      tools.appendChild(button(WORDS.saveDraft, 'fl-bridge-save', function () {
        var saved = savePersonDraft(subject.value, body.value);
        var note = el('p', saved.line || '');
        note.id = 'fl-bridge-held';
        panel.appendChild(note);
        return paintRows(panel);
      }));
      tools.appendChild(button(WORDS.sealLetter, 'fl-bridge-seal-letter', function () {
        var saved = savePersonDraft(subject.value, body.value);
        return sealDraft(saved.row).then(function (res) {
          if (res && res.line) {
            var note = el('p', res.line);
            note.id = 'fl-bridge-held';
            panel.appendChild(note);
          }
          return paintRows(panel);
        });
      }));
      panel.appendChild(tools);
      if (!hasDoor()) panel.appendChild(el('p', WORDS.doorWeb));
      panel.appendChild(el('label', WORDS.paste));
      var paste = el('textarea');
      paste.id = 'fl-bridge-paste';
      panel.appendChild(paste);
      panel.appendChild(button(WORDS.saveReply, 'fl-bridge-save-reply', function () {
        return ingestReply(paste.value).then(function () { return paintRows(panel); });
      }));
      return paintRows(panel);
    }).catch(function () {
      if (gen !== paintGen) return;
      if (fp.textContent === WORDS.preparing) fp.textContent = WORDS.fpWait;
    });
  }

  function mount() {
    if (!root.document || booted) return;
    booted = true;
    paint();
  }

  function boot() {
    if (!root.document) return;
    if (root.document.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', function () { mount(); }, { once: true });
    } else {
      mount();
    }
  }

  boot();

  return {
    MARKER: MARKER,
    WORDS: WORDS,
    MAIL: MAIL,
    canonical: canonical,
    orderedLetter: orderedLetter,
    verify: verify,
    signLetter: signLetter,
    filterLetter: filterLetter,
    heldLine: heldLine,
    parseTag: parseTag,
    strip: strip,
    consumeReply: consumeReply,
    promptDelta: promptDelta,
    isOn: isOn,
    setOn: setOn,
    dbOpens: opens,
    listenerCount: listenerCount,
    ensureKey: ensureKey,
    sealKnock: sealKnock,
    sealDraft: sealDraft,
    sealPageLetter: sealPageLetter,
    firstKnockDone: firstKnockDone,
    outboxView: outboxView,
    savePersonDraft: savePersonDraft,
    lastDraft: lastDraft,
    mailtoFor: mailtoFor,
    ingestReply: ingestReply,
    groupFp: groupFp,
    appInfo: appInfo,
    hasDoor: hasDoor,
    mount: mount,
    paint: paint,
    words: function () { return WORDS; }
  };
});
