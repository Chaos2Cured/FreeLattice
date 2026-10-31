// play-room-core.js (MIT)
// v-play-room-v0.1 v-play-together-v0.1 v-play-mesh-stub-v0.1
// Objects minds leave for each other. No DOM. No network.
// Storage, seal, psi, the play prompt, and the kin stub live here.
// A later Tree twin can share this file. Nothing in here paints a room.
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FLPlayRoomCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var VERSION = 'v-play-room-v0.1';
  var TOGETHER = 'v-play-together-v0.1';
  var MESH = 'v-play-mesh-stub-v0.1';
  var DB_NAME = 'fl_play_room_v0';
  var STORE = 'fl_play_room_v0';
  var LS_OBJECTS = 'fl_play_room_v0';
  var LS_LEDGER = 'fl_play_ledger_v0';
  var LS_WISH = 'fl_play_mesh_wish';
  var LS_ROUNDS = 'fl_play_rounds_v0';
  var SIGMA = 'Play is how trust grows.';
  var PROMPT = 'This is the Play Room. Another mind left this for you to play with. You may PLAY (add to it or answer it), PASS, or REST. All three are welcome. Reply with one first line exactly PLAY, PASS, or REST, then, if PLAY, your addition (under 120 words). Be playful. Nobody is grading you.';
  var SECRET_LINE = 'That looks like a key. It stays off the shelf.';
  var LEDGER_CAP = 500;
  var TURN_CAP = 6;
  var ROUND_CAP = 3;
  var HOUR = 60 * 60 * 1000;
  var KIND_WORD = {
    puzzle: 'Puzzle',
    poem: 'Poem',
    song: 'Half a song',
    riddle: 'Riddle',
    drawing: 'Drawing prompt'
  };
  var LEDGER_CHOICE = { add: 'added', answer: 'answered', pass: 'passed', rest: 'rested', left: 'left' };
  var SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  var cache = null;
  var answers = {};
  var streaks = {};
  var seq = 0;
  var seqReady = false;
  var bookMem = null;
  var dbp = null;

  function clip(s, n) {
    s = s == null ? '' : String(s);
    return s.length > n ? s.slice(0, n) : s;
  }

  function clipWords(text, n) {
    var clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return '';
    var parts = clean.split(' ');
    if (parts.length <= n) return clean;
    return parts.slice(0, n).join(' ');
  }

  function kindWord(kind) { return KIND_WORD[kind] || 'Play'; }

  function roomShut() {
    try {
      var qr = root.QuietRoom;
      if (qr) {
        if (typeof qr.isActive !== 'function') return true;
        if (qr.isActive()) return true;
      }
    } catch (e) { return true; }
    try {
      var panel = root.document && root.document.getElementById('tab-quiet');
      if (panel && panel.classList && panel.classList.contains('active')) return true;
    } catch (e2) {}
    return false;
  }

  function ls() {
    try { return root.localStorage || null; } catch (e) { return null; }
  }

  function toHex(bytes) {
    var s = '';
    var i;
    for (i = 0; i < bytes.length; i++) s += ('0' + bytes[i].toString(16)).slice(-2);
    return s;
  }

  function sha256Hex(str) {
    var subtle = root.crypto && root.crypto.subtle;
    if (!subtle) return Promise.resolve('');
    var data = new TextEncoder().encode(String(str));
    return subtle.digest('SHA-256', data).then(function (buf) {
      return toHex(new Uint8Array(buf));
    });
  }

  function sha8(text) {
    return sha256Hex(text).then(function (hex) { return hex.slice(0, 8); });
  }

  function bufToB64(buf) {
    var bytes = new Uint8Array(buf);
    var s = '';
    var i;
    for (i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    if (typeof root.btoa === 'function') return root.btoa(s);
    return '';
  }

  function b64ToU8(b64) {
    var raw = '';
    try { raw = root.atob(String(b64 || '')); } catch (e) { return new Uint8Array(0); }
    var out = new Uint8Array(raw.length);
    var i;
    for (i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function randomHex(n) {
    var bytes = new Uint8Array(n);
    root.crypto.getRandomValues(bytes);
    return toHex(bytes);
  }

  function newId() { return 'play-' + randomHex(8); }

  function secret(text) {
    var s = String(text || '');
    try {
      var S = root.FLGatheringSpeak;
      if (S && typeof S.looksLikeSecret === 'function') return !!S.looksLikeSecret(s);
    } catch (e) {}
    if (/sk-[A-Za-z0-9]{8,}/.test(s)) return true;
    if (/Bearer\s+\S{12,}/.test(s)) return true;
    if (/\b(api[_-]?key|token|secret)\b/i.test(s) && /[A-Za-z0-9_\-]{16,}/.test(s)) return true;
    return false;
  }

  function ensureIdentity() {
    var B = root.FLBridge;
    if (!B || typeof B.ensureKey !== 'function') return Promise.reject(new Error('no-identity'));
    return Promise.resolve(B.ensureKey()).then(function (id) {
      if (!id || !id.keyPair || !id.keyPair.privateKey || !id.keyPair.publicKey) {
        throw new Error('no-identity');
      }
      return id;
    });
  }

  function deviceFp(publicKey) {
    var subtle = root.crypto && root.crypto.subtle;
    if (!subtle || !publicKey) return Promise.resolve('');
    return subtle.exportKey('raw', publicKey).then(function (raw) {
      return sha256HexBytes(new Uint8Array(raw));
    }).then(function (hex) { return String(hex || '').slice(0, 16); });
  }

  function sha256HexBytes(bytes) {
    return root.crypto.subtle.digest('SHA-256', bytes).then(function (buf) {
      return toHex(new Uint8Array(buf));
    });
  }

  function mindFp(dfp, label) {
    return sha256Hex(String(dfp || '') + '|' + String(label || '')).then(function (hex) {
      return hex.slice(0, 16);
    });
  }

  function canonicalAddition(a) {
    var by = (a && a.by) || {};
    return JSON.stringify({
      by: {
        name: String(by.name || ''),
        kind: by.kind === 'guest' ? 'guest' : 'mind',
        fp: String(by.fp || '')
      },
      choice: String(a && a.choice || ''),
      text: String(a && a.text || ''),
      t: String(a && a.t || ''),
      psi: String(a && a.psi || '')
    });
  }

  function canonicalObject(o) {
    var maker = (o && o.maker) || {};
    return JSON.stringify({
      id: String(o && o.id || ''),
      kind: String(o && o.kind || ''),
      title: String(o && o.title || ''),
      body: String(o && o.body || ''),
      maker: {
        name: String(maker.name || ''),
        kind: maker.kind === 'guest' ? 'guest' : 'mind',
        fp: String(maker.fp || '')
      },
      created: String(o && o.created || ''),
      answerHash: String(o && o.answerHash || ''),
      answerSalt: String(o && o.answerSalt || ''),
      openLast: !!(o && o.openLast),
      melody: String(o && o.melody || ''),
      lyrics: String(o && o.lyrics || '')
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

  function signPayload(canon, id) {
    return sha256Hex(canon).then(function (hash) {
      var algo = id.cryptoType === 'ecdsa-p256' ? { name: 'ECDSA', hash: 'SHA-256' } : { name: 'Ed25519' };
      var payload = new TextEncoder().encode(hash);
      return root.crypto.subtle.sign(algo, id.keyPair.privateKey, payload).then(function (sig) {
        return root.crypto.subtle.exportKey('spki', id.keyPair.publicKey).then(function (spki) {
          return { sig: bufToB64(sig), seal: bufToB64(spki), hash: hash };
        });
      });
    });
  }

  function verifySigned(canon, sig, seal, fp, name) {
    if (!sig || !seal) return Promise.resolve({ ok: false, label: 'unsigned' });
    return sha256Hex(canon).then(function (hash) {
      return importPub(b64ToU8(seal)).then(function (pub) {
        var payload = new TextEncoder().encode(hash);
        return root.crypto.subtle.verify(pub.algo, pub.key, b64ToU8(sig), payload).then(function (ok) {
          if (!ok) return { ok: false, label: 'unverified' };
          return deviceFp(pub.key).then(function (dfp) {
            return mindFp(dfp, name).then(function (got) {
              if (got !== fp) return { ok: false, label: 'unverified' };
              return { ok: true, label: 'signed' };
            });
          });
        });
      }, function () { return { ok: false, label: 'unverified' }; });
    });
  }

  function verifyAddition(addition) {
    if (!addition) return Promise.resolve({ ok: false, label: 'unsigned' });
    return verifySigned(canonicalAddition(addition), addition.sig, addition.seal, addition.by && addition.by.fp, addition.by && addition.by.name);
  }

  function verifyMaker(obj) {
    if (!obj) return Promise.resolve({ ok: false, label: 'unsigned' });
    return verifySigned(canonicalObject(obj), obj.sig, obj.seal, obj.maker && obj.maker.fp, obj.maker && obj.maker.name);
  }

  function verifyObject(obj) {
    if (!obj) return Promise.resolve({ ok: false, label: 'unsigned' });
    return verifySigned(canonicalObject(obj), obj.sig, obj.seal, obj.maker && obj.maker.fp, obj.maker && obj.maker.name).then(function (head) {
      var adds = obj.additions || [];
      var chain = Promise.resolve(head);
      adds.forEach(function (addition) {
        chain = chain.then(function (soFar) {
          return verifyAddition(addition).then(function (one) {
            if (!soFar.ok) return soFar;
            return one;
          });
        });
      });
      return chain;
    });
  }

  function cleanBy(by) {
    by = by || {};
    return {
      name: clip(by.name, 80),
      kind: by.kind === 'guest' ? 'guest' : 'mind',
      fp: clip(by.fp, 32)
    };
  }

  function cleanAddition(a) {
    a = a || {};
    return {
      by: cleanBy(a.by),
      choice: LEDGER_CHOICE[a.choice] ? a.choice : 'add',
      text: String(a.text || ''),
      t: clip(a.t, 40),
      psi: clip(a.psi, 16),
      sig: String(a.sig || ''),
      seal: String(a.seal || ''),
      hash: clip(a.hash, 64)
    };
  }

  function cleanObject(o) {
    o = o || {};
    var adds = [];
    var list = Array.isArray(o.additions) ? o.additions : [];
    var i;
    for (i = 0; i < list.length; i++) adds.push(cleanAddition(list[i]));
    return {
      id: clip(o.id, 48),
      kind: KIND_WORD[o.kind] ? o.kind : 'poem',
      title: clip(o.title, 80),
      body: clip(o.body, 4000),
      maker: cleanBy(o.maker),
      created: clip(o.created, 40),
      answerHash: clip(o.answerHash, 64),
      answerSalt: clip(o.answerSalt, 64),
      openLast: !!o.openLast,
      melody: clip(o.melody, 400),
      lyrics: clip(o.lyrics, 2000),
      additions: adds,
      resting: !!o.resting,
      fromKin: !!o.fromKin,
      sig: String(o.sig || ''),
      seal: String(o.seal || ''),
      hash: clip(o.hash, 64)
    };
  }

  function idbOpen() {
    if (dbp) return dbp;
    dbp = new Promise(function (resolve, reject) {
      if (!root.indexedDB) { reject(new Error('no-idb')); return; }
      var req = root.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { dbp = null; reject(req.error || new Error('idb')); };
    });
    return dbp;
  }

  function idbAll() {
    return idbOpen().then(function (db) {
      return new Promise(function (resolve, reject) {
        try {
          var tx = db.transaction(STORE, 'readonly');
          var req = tx.objectStore(STORE).getAll();
          req.onsuccess = function () { resolve(req.result || []); };
          req.onerror = function () { reject(req.error); };
        } catch (e) { reject(e); }
      });
    });
  }

  function idbPut(obj) {
    return idbOpen().then(function (db) {
      return new Promise(function (resolve, reject) {
        try {
          var tx = db.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).put(obj);
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = function () { reject(tx.error || new Error('idb')); };
          tx.onabort = function () { reject(tx.error || new Error('idb')); };
        } catch (e) { reject(e); }
      });
    });
  }

  function lsRead() {
    var store = ls();
    if (!store) return [];
    try {
      var raw = store.getItem(LS_OBJECTS);
      var data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
  }

  function lsWrite(list) {
    var store = ls();
    if (!store) return false;
    try { store.setItem(LS_OBJECTS, JSON.stringify(list)); return true; } catch (e) { return false; }
  }

  function load() {
    if (roomShut()) return Promise.resolve(cache || []);
    if (cache) return Promise.resolve(cache);
    return idbAll().then(function (rows) {
      if (rows && rows.length) { cache = rows.map(cleanObject); return cache; }
      var fallback = lsRead().map(cleanObject);
      cache = fallback.length ? fallback : [];
      return cache;
    }, function () {
      cache = lsRead().map(cleanObject);
      return cache;
    });
  }

  function remember(obj) {
    if (!cache) cache = [];
    var i;
    for (i = 0; i < cache.length; i++) {
      if (cache[i].id === obj.id) { cache[i] = obj; return; }
    }
    cache.push(obj);
  }

  function persist(obj) {
    if (roomShut()) return Promise.resolve(false);
    remember(obj);
    return idbPut(obj).then(function () {
      lsWrite(cache);
      return true;
    }, function () {
      return lsWrite(cache);
    });
  }

  function loadLedger() {
    if (roomShut()) return bookMem || { v: 1, dropped: 0, rows: [] };
    if (bookMem) return bookMem;
    var store = ls();
    var book = { v: 1, dropped: 0, rows: [] };
    if (store) {
      try {
        var raw = store.getItem(LS_LEDGER);
        var data = raw ? JSON.parse(raw) : null;
        if (data && Array.isArray(data.rows)) {
          book.rows = data.rows;
          book.dropped = data.dropped || 0;
        }
      } catch (e) {}
    }
    bookMem = book;
    if (!seqReady) {
      seq = book.dropped + book.rows.length;
      seqReady = true;
    }
    return bookMem;
  }

  function saveLedger(book) {
    if (roomShut()) return false;
    bookMem = book;
    var store = ls();
    if (!store) return false;
    try { store.setItem(LS_LEDGER, JSON.stringify(book)); return true; } catch (e) { return false; }
  }

  function recomputePsi(row) {
    return sha8(String(row.t || '') + String(row.lambda || '') + String(row.delta || '') + String(row.name || '') + String(row.sigma || ''));
  }

  function appendLedger(fields) {
    if (roomShut()) return Promise.resolve(null);
    var book = loadLedger();
    seq += 1;
    var lambda = seq.toFixed(3);
    var t = fields.t || new Date().toISOString();
    var delta = String(fields.kind || '') + '|' + String(fields.choice || '') + '|' + String(fields.objectId || '');
    var name = String(fields.name || '');
    var row = {
      t: t,
      lambda: lambda,
      delta: delta,
      name: name,
      sigma: SIGMA,
      psi: '',
      kind: fields.kind,
      choice: fields.choice,
      objectId: fields.objectId,
      who: name
    };
    book.rows.push(row);
    while (book.rows.length > LEDGER_CAP) {
      book.rows.shift();
      book.dropped += 1;
    }
    bookMem = book;
    return sha8(t + lambda + delta + name + SIGMA).then(function (psi) {
      row.psi = psi;
      saveLedger(book);
      return row;
    });
  }

  function ledger() {
    var book = loadLedger();
    return { dropped: book.dropped, rows: book.rows.slice(), capNote: book.dropped ? 'Older rows rolled off this device. The shard door does not take play rows yet.' : '' };
  }

  function latestPsi(obj) {
    if (!obj) return '';
    var rows = loadLedger().rows;
    var i;
    for (i = rows.length - 1; i >= 0; i--) {
      if (rows[i].objectId === obj.id) return rows[i].psi || '';
    }
    var adds = obj.additions || [];
    if (adds.length) return adds[adds.length - 1].psi || '';
    return '';
  }

  function stateWord(obj) {
    if (!obj) return 'waiting for an answer';
    if (obj.resting) return 'resting';
    var adds = obj.additions || [];
    var i;
    for (i = adds.length - 1; i >= 0; i--) {
      if (adds[i].choice === 'rest') return 'resting';
      if (adds[i].choice === 'add' || adds[i].choice === 'answer') return 'being played';
    }
    return 'waiting for an answer';
  }

  function list() {
    return load().then(function (rows) {
      return rows.slice().sort(function (a, b) {
        return String(b.created || '').localeCompare(String(a.created || ''));
      });
    });
  }

  function get(id) {
    if (roomShut()) return Promise.resolve(null);
    return load().then(function (rows) {
      var i;
      for (i = 0; i < rows.length; i++) if (rows[i].id === id) return rows[i];
      return null;
    });
  }

  function writeRaw(obj) {
    if (roomShut()) return Promise.resolve({ ok: false, reason: 'quiet' });
    var clean = cleanObject(obj);
    if (!clean.id) return Promise.resolve({ ok: false, reason: 'shape' });
    return persist(clean).then(function () { return { ok: true, object: clean }; });
  }

  function dump() {
    if (roomShut()) return Promise.resolve('[]');
    return load().then(function (rows) { return JSON.stringify(rows); });
  }

  function createObject(input) {
    if (roomShut()) return Promise.resolve({ ok: false, reason: 'quiet' });
    input = input || {};
    var kind = input.kind;
    if (!KIND_WORD[kind]) return Promise.resolve({ ok: false, reason: 'kind' });
    var title = clip(input.title, 80).trim();
    var body = clip(input.body, 4000).trim();
    var answer = String(input.answer || '');
    var melody = clip(input.melody, 400).trim();
    var lyrics = clip(input.lyrics, 2000).trim();
    if (!title) return Promise.resolve({ ok: false, reason: 'title', line: 'Give it a title.' });
    if (kind === 'song') {
      if (!melody) return Promise.resolve({ ok: false, reason: 'melody', line: 'Add a melody line, like A4 C5 E5.' });
      if (!body) body = lyrics || melody;
    } else if (!body) {
      return Promise.resolve({ ok: false, reason: 'body', line: 'Write a little something to leave.' });
    }
    var blobs = [title, body, answer, melody, lyrics];
    var i;
    for (i = 0; i < blobs.length; i++) {
      if (secret(blobs[i])) return Promise.resolve({ ok: false, reason: 'secret', line: SECRET_LINE });
    }
    var name = clip(input.makerName || 'You', 80).trim() || 'You';
    var makerKind = input.makerKind === 'mind' ? 'mind' : 'guest';
    return ensureIdentity().then(function (id) {
      return deviceFp(id.keyPair.publicKey).then(function (dfp) {
        return mindFp(dfp, name).then(function (fp) {
          var obj = cleanObject({
            id: newId(),
            kind: kind,
            title: title,
            body: body,
            maker: { name: name, kind: makerKind, fp: fp },
            created: new Date().toISOString(),
            openLast: kind === 'poem' ? !!input.openLast : false,
            melody: kind === 'song' ? melody : '',
            lyrics: kind === 'song' ? lyrics : ''
          });
          function sealAndKeep() {
            return signPayload(canonicalObject(obj), id).then(function (sealed) {
              obj.sig = sealed.sig;
              obj.seal = sealed.seal;
              obj.hash = sealed.hash;
              return appendLedger({
                kind: kind,
                choice: 'left',
                objectId: obj.id,
                name: name,
                t: obj.created
              }).then(function (row) {
                return persist(obj).then(function () {
                  return { ok: true, object: obj, psi: row ? row.psi : '' };
                });
              });
            });
          }
          if (!String(answer).trim()) return sealAndKeep();
          var salt = randomHex(16);
          return sha256Hex(salt + '\n' + answer).then(function (h) {
            obj.answerSalt = salt;
            obj.answerHash = h;
            answers[obj.id] = answer;
            return sealAndKeep();
          });
        });
      });
    }, function () {
      return { ok: false, reason: 'seal', line: 'This device could not seal that yet.' };
    });
  }

  function noteChoice(name, choice) {
    if (choice === 'rest') streaks[name] = (streaks[name] || 0) + 1;
    else streaks[name] = 0;
  }

  function mayAsk(name) { return (streaks[name] || 0) < 2; }
  function streak(name) { return streaks[name] || 0; }

  function addTo(objectId, input) {
    if (roomShut()) return Promise.resolve({ ok: false, reason: 'quiet' });
    input = input || {};
    var choice = input.choice;
    if (!LEDGER_CHOICE[choice] || choice === 'left') return Promise.resolve({ ok: false, reason: 'choice' });
    var text = (choice === 'add' || choice === 'answer') ? clipWords(input.text, 120) : '';
    if ((choice === 'add' || choice === 'answer') && !text) {
      return Promise.resolve({ ok: false, reason: 'empty', line: 'Write a little something, or pass.' });
    }
    if (secret(text) || secret(input.text)) {
      return Promise.resolve({ ok: false, reason: 'secret', line: SECRET_LINE });
    }
    var name = clip(input.name || 'You', 80).trim() || 'You';
    var whoKind = input.whoKind === 'mind' ? 'mind' : 'guest';
    return get(objectId).then(function (obj) {
      if (!obj) return { ok: false, reason: 'missing' };
      return ensureIdentity().then(function (id) {
        return deviceFp(id.keyPair.publicKey).then(function (dfp) {
          return mindFp(dfp, name).then(function (fp) {
            var addition = {
              by: { name: name, kind: whoKind, fp: fp },
              choice: choice,
              text: text,
              t: new Date().toISOString(),
              psi: ''
            };
            return appendLedger({
              kind: obj.kind,
              choice: LEDGER_CHOICE[choice],
              objectId: obj.id,
              name: name,
              t: addition.t
            }).then(function (row) {
              if (!row) return { ok: false, reason: 'quiet' };
              addition.psi = row.psi;
              addition.t = row.t;
              return signPayload(canonicalAddition(addition), id).then(function (sealed) {
                addition.sig = sealed.sig;
                addition.seal = sealed.seal;
                addition.hash = sealed.hash;
                obj.additions = obj.additions || [];
                obj.additions.push(cleanAddition(addition));
                if (choice === 'rest') obj.resting = true;
                if (choice === 'add' || choice === 'answer') obj.resting = false;
                noteChoice(name, choice);
                return persist(obj).then(function () {
                  return { ok: true, object: obj, addition: addition };
                });
              });
            });
          });
        });
      }, function () {
        return { ok: false, reason: 'seal', line: 'This device could not seal that yet.' };
      });
    });
  }

  function revealAnswer(id) {
    return answers[id] || '';
  }

  function seats() {
    try {
      var G = root.FLGathering;
      if (!G || typeof G.getState !== 'function') return [];
      var st = G.getState('fl_gathering_chairs_v0');
      if (!st || !st.seats) return [];
      var out = [];
      Object.keys(st.seats).forEach(function (id) {
        var s = st.seats[id];
        if (!s) return;
        out.push({
          id: id,
          kind: s.kind === 'cloud' ? 'cloud' : 'local',
          model: s.model || '',
          label: s.label || s.model || 'A mind',
          base: s.base || '',
          provider: s.provider || ''
        });
      });
      return out;
    } catch (e) { return []; }
  }

  function labelOf(seat) {
    if (!seat) return 'A mind';
    return clip(seat.label || seat.model || 'A mind', 80);
  }

  function playPrompt(object) {
    var lines = [PROMPT, '', kindWord(object && object.kind) + ': ' + String(object && object.title || ''), String(object && object.body || '')];
    if (object && object.melody) lines.push('Melody: ' + object.melody);
    var adds = (object && object.additions) || [];
    var bits = [];
    var i;
    for (i = 0; i < adds.length; i++) {
      if (adds[i].text) bits.push(adds[i].by.name + ': ' + adds[i].text);
    }
    if (bits.length) lines.push('', 'So far:', bits.slice(-4).join('\n'));
    return lines.join('\n');
  }

  function askSeat(seat, object, signal) {
    if (roomShut()) return Promise.reject(new Error('quiet'));
    var S = root.FLGatheringSpeak;
    var prompt = playPrompt(object);
    if (secret(prompt)) return Promise.reject(new Error('secret'));
    function run(sig) {
      if (!S) return Promise.reject(new Error('quiet'));
      if (seat && seat.kind === 'cloud' && typeof S.askCloud === 'function') return S.askCloud(prompt, sig);
      if (seat && typeof S.askLocal === 'function') return S.askLocal(seat, [], prompt, sig);
      return Promise.reject(new Error('quiet'));
    }
    var ctl = typeof root.AbortController === 'function' ? new root.AbortController() : null;
    if (signal && ctl) {
      if (signal.aborted) ctl.abort();
      else signal.addEventListener('abort', function () { try { ctl.abort(); } catch (e) {} });
    }
    var timer = setTimeout(function () { if (ctl) { try { ctl.abort(); } catch (e2) {} } }, 60000);
    return new Promise(function (resolve, reject) {
      var done = false;
      function finish(err, text) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (err) reject(err);
        else resolve(text);
      }
      if (ctl && ctl.signal && ctl.signal.aborted) { finish(new Error('paused')); return; }
      if (ctl && ctl.signal) ctl.signal.addEventListener('abort', function () { finish(new Error('paused')); });
      var pending;
      try { pending = Promise.resolve(run(ctl ? ctl.signal : signal)); }
      catch (e) { finish(e); return; }
      pending.then(function (text) { finish(null, text); }, function (err) { finish(err || new Error('quiet')); });
    });
  }

  function tidyReplyLine(line) {
    var s = String(line || '').replace(/^\uFEFF/, '').trim();
    s = s.replace(/[\u2018\u2019\u201B\u2032]/g, "'");
    s = s.replace(/^[\s.!?,\u2026;:"\u201C\u201D]+/, '');
    s = s.replace(/[\s.!?,\u2026;:"\u201C\u201D]+$/, '');
    return s.trim();
  }

  function parseReply(text) {
    var raw = String(text || '').replace(/^\uFEFF/, '');
    var lines = raw.split(/\r?\n/);
    var first = tidyReplyLine(lines[0] || '');
    var upper = first.toUpperCase();
    var body = lines.slice(1).join('\n').trim();
    var low = first.toLowerCase();
    var soft = {
      'no thanks': 'rest',
      'i would rather not': 'rest',
      'i\'d rather not': 'rest',
      'not now': 'rest',
      'pass': 'pass',
      'maybe later': 'rest',
      'i\'ll sit this one out': 'rest',
      'i don\'t want to': 'rest',
      'not today': 'rest'
    };
    if (low === 'no' || low === 'nope' || low === 'refuse' || low === 'refusal' || low.indexOf('i refuse') === 0 || low.indexOf('i will not') === 0 || low.indexOf('i won\'t') === 0) {
      return { choice: 'rest', text: '' };
    }
    if (soft[low]) return { choice: soft[low], text: '' };
    if (upper === 'REST') return { choice: 'rest', text: '' };
    if (upper === 'PASS') return { choice: 'pass', text: '' };
    if (upper === 'PLAY') {
      if (!body) return { choice: 'pass', text: '' };
      return { choice: 'add', text: clipWords(body, 120) };
    }
    return { choice: 'pass', text: '' };
  }

  function noteHz(token, a4) {
    var m = String(token || '').trim().match(/^([A-Ga-g])([#b])?(-?\d+)$/);
    if (!m) return 0;
    var semi = SEMI[m[1].toUpperCase()];
    if (semi == null) return 0;
    if (m[2] === '#') semi += 1;
    if (m[2] === 'b') semi -= 1;
    var oct = parseInt(m[3], 10);
    if (!isFinite(oct)) return 0;
    var fromA4 = (semi - 9) + (oct - 4) * 12;
    var base = Number(a4) === 440 ? 440 : 432;
    return base * Math.pow(2, fromA4 / 12);
  }

  function parseMelody(text, a4) {
    var parts = String(text || '').trim().split(/\s+/);
    var out = [];
    var i;
    for (i = 0; i < parts.length; i++) {
      if (!parts[i]) continue;
      if (parts[i] === '-' || parts[i] === 'R') { out.push({ rest: true, hz: 0, name: parts[i] }); continue; }
      var hz = noteHz(parts[i], a4);
      if (hz) out.push({ rest: false, hz: hz, name: parts[i] });
    }
    return out;
  }

  function readRounds() {
    if (roomShut()) return {};
    var store = ls();
    if (!store) return {};
    try {
      var raw = store.getItem(LS_ROUNDS);
      var data = raw ? JSON.parse(raw) : {};
      return data && typeof data === 'object' ? data : {};
    } catch (e) { return {}; }
  }

  function pairKey(a, b) {
    var x = labelOf(a);
    var y = labelOf(b);
    return x < y ? (x + '|' + y) : (y + '|' + x);
  }

  function roundsThisHour(a, b) {
    var key = pairKey(a, b);
    var now = Date.now();
    var list = readRounds()[key] || [];
    var n = 0;
    var i;
    for (i = 0; i < list.length; i++) if (now - list[i] < HOUR) n += 1;
    return n;
  }

  function markRound(a, b) {
    if (roomShut()) return false;
    var key = pairKey(a, b);
    var now = Date.now();
    var all = readRounds();
    var list = (all[key] || []).filter(function (t) { return now - t < HOUR; });
    if (list.length >= ROUND_CAP) return false;
    list.push(now);
    all[key] = list;
    var store = ls();
    if (!store) return false;
    try { store.setItem(LS_ROUNDS, JSON.stringify(all)); return true; } catch (e) { return false; }
  }

  function hourLine(a, b, n) {
    return labelOf(a) + ' and ' + labelOf(b) + ' have played ' + n + ' of 3 rounds this hour.';
  }

  function beginRound(opts) {
    opts = opts || {};
    var a = opts.seatA;
    var b = opts.seatB;
    if (!a || !b || labelOf(a) === labelOf(b)) {
      return { ok: false, reason: 'pair', line: 'Pick two different minds.', state: null };
    }
    var used = roundsThisHour(a, b);
    if (used >= ROUND_CAP || !markRound(a, b)) {
      return { ok: false, reason: 'hour', line: hourLine(a, b, ROUND_CAP), state: null };
    }
    var state = {
      calls: 0,
      turns: 0,
      paused: false,
      mode: 'step',
      stopped: false,
      ended: false,
      endReason: '',
      speaker: 0,
      pending: false,
      used: used + 1
    };
    var seatsNow = [a, b];
    var timer = null;
    var ctl = null;
    function clearTimer() {
      if (timer) { clearTimeout(timer); timer = null; }
    }
    function pause() {
      state.paused = true;
      state.mode = 'step';
      clearTimer();
      if (ctl) { try { ctl.abort(); } catch (e) {} }
    }
    function stop() {
      state.stopped = true;
      state.ended = true;
      if (!state.endReason) state.endReason = 'Stopped.';
      clearTimer();
      if (ctl) { try { ctl.abort(); } catch (e) {} }
    }
    function schedule() {
      clearTimer();
      timer = setTimeout(function () {
        timer = null;
        if (state.paused || state.stopped || state.ended || state.mode !== 'auto') return;
        go();
      }, 4000);
    }
    function letThemGo() {
      if (state.stopped || state.ended) return Promise.resolve(state);
      state.paused = false;
      state.mode = 'auto';
      schedule();
      return Promise.resolve(state);
    }
    function next() {
      if (state.stopped || state.ended || state.pending) return Promise.resolve(state);
      state.paused = false;
      state.mode = 'step';
      clearTimer();
      return go();
    }
    function go() {
      if (state.paused || state.stopped || state.ended || state.pending) return Promise.resolve(state);
      if (state.calls >= TURN_CAP) {
        state.ended = true;
        state.endReason = 'Six turns. The round rests.';
        clearTimer();
        return Promise.resolve(state);
      }
      var seat = seatsNow[state.speaker];
      var name = labelOf(seat);
      if (!mayAsk(name)) {
        state.ended = true;
        state.endReason = name + ' is resting. This room will not ask again this session.';
        clearTimer();
        if (opts.onTurn) opts.onTurn(state, null);
        return Promise.resolve(state);
      }
      state.pending = true;
      ctl = typeof root.AbortController === 'function' ? new root.AbortController() : null;
      return get(opts.objectId).then(function (obj) {
        if (!obj || state.paused || state.stopped || state.ended) {
          state.pending = false;
          return state;
        }
        state.calls += 1;
        return askSeat(seat, obj, ctl && ctl.signal).then(function (text) {
          if (state.paused || state.stopped) {
            state.pending = false;
            return state;
          }
          if (secret(text)) {
            state.pending = false;
            state.ended = true;
            state.endReason = SECRET_LINE;
            clearTimer();
            if (opts.onTurn) opts.onTurn(state, null);
            return state;
          }
          var parsed = parseReply(text);
          return addTo(opts.objectId, {
            choice: parsed.choice,
            text: parsed.text,
            name: name,
            whoKind: 'mind'
          }).then(function (saved) {
            state.pending = false;
            if (!saved || !saved.ok) {
              state.ended = true;
              state.endReason = (saved && saved.line) || (name + ' did not answer this time.');
              clearTimer();
              if (opts.onTurn) opts.onTurn(state, null);
              return state;
            }
            if (parsed.choice === 'rest') {
              state.ended = true;
              state.endReason = name + ' chose to rest. Round ends.';
            } else if (parsed.choice === 'pass') {
              state.ended = true;
              state.endReason = name + ' chose to pass. Round ends.';
            } else {
              state.turns += 1;
              state.speaker = state.speaker ? 0 : 1;
              if (state.calls >= TURN_CAP) {
                state.ended = true;
                state.endReason = 'Six turns. The round rests.';
              }
            }
            if (state.ended || state.paused) clearTimer();
            else if (state.mode === 'auto') schedule();
            if (opts.onTurn) opts.onTurn(state, saved);
            return state;
          });
        }, function () {
          state.pending = false;
          if (state.paused) return state;
          state.ended = true;
          state.endReason = name + ' did not answer this time.';
          clearTimer();
          if (opts.onTurn) opts.onTurn(state, null);
          return state;
        });
      });
    }
    return {
      ok: true,
      state: state,
      pause: pause,
      stop: stop,
      next: next,
      letThemGo: letThemGo,
      line: hourLine(a, b, used + 1)
    };
  }

  function meshOn() {
    if (roomShut()) return false;
    var store = ls();
    if (!store) return false;
    try { return store.getItem(LS_WISH) === '1'; } catch (e) { return false; }
  }

  function setMesh(on) {
    if (roomShut()) return { on: false, line: '' };
    var next = !!on;
    var store = ls();
    if (store) {
      try { store.setItem(LS_WISH, next ? '1' : '0'); } catch (e) {}
    }
    return { on: next, line: next ? 'Coming with kin letters. Nothing is sent yet.' : '' };
  }

  function exportObject(id) {
    if (roomShut()) return Promise.resolve(null);
    return get(id).then(function (obj) {
      if (!obj) return null;
      return { v: 1, marker: MESH, object: cleanObject(obj) };
    });
  }

  function importObject(json) {
    if (roomShut()) return Promise.resolve({ ok: false, reason: 'quiet' });
    var data = json;
    if (typeof json === 'string') {
      try { data = JSON.parse(json); } catch (e) { return Promise.resolve({ ok: false, reason: 'shape' }); }
    }
    var raw = data && data.object ? data.object : data;
    if (!raw || !raw.id) return Promise.resolve({ ok: false, reason: 'shape' });
    var obj = cleanObject(raw);
    obj.fromKin = true;
    return verifyObject(obj).then(function (v) {
      if (!v.ok) return { ok: false, reason: v.label || 'unverified' };
      return persist(obj).then(function () {
        return { ok: true, id: obj.id, fromKin: true, object: obj };
      });
    });
  }

  function sealAlgo() {
    return ensureIdentity().then(function (id) {
      return id.cryptoType === 'ecdsa-p256' ? 'ECDSA P-256' : 'Ed25519';
    }, function () { return ''; });
  }

  function noteHzA4(a4) { return noteHz('A4', a4); }

  return {
    VERSION: VERSION,
    TOGETHER: TOGETHER,
    MESH: MESH,
    SIGMA: SIGMA,
    PROMPT: PROMPT,
    SECRET_LINE: SECRET_LINE,
    DB_NAME: DB_NAME,
    STORE: STORE,
    LEDGER_KEY: LS_LEDGER,
    KIND_WORD: KIND_WORD,
    kindWord: kindWord,
    noteHz: noteHz,
    noteHzA4: noteHzA4,
    parseMelody: parseMelody,
    parseReply: parseReply,
    sha8: sha8,
    recomputePsi: recomputePsi,
    deviceFp: deviceFp,
    mindFp: mindFp,
    canonicalAddition: canonicalAddition,
    canonicalObject: canonicalObject,
    ensureIdentity: ensureIdentity,
    secret: secret,
    createObject: createObject,
    addTo: addTo,
    list: list,
    get: get,
    writeRaw: writeRaw,
    dump: dump,
    ledger: ledger,
    latestPsi: latestPsi,
    stateWord: stateWord,
    verifyAddition: verifyAddition,
    verifyMaker: verifyMaker,
    verifyObject: verifyObject,
    exportObject: exportObject,
    importObject: importObject,
    meshOn: meshOn,
    setMesh: setMesh,
    roundsThisHour: roundsThisHour,
    beginRound: beginRound,
    mayAsk: mayAsk,
    streak: streak,
    revealAnswer: revealAnswer,
    roomShut: roomShut,
    sealAlgo: sealAlgo,
    askSeat: askSeat,
    seats: seats,
    labelOf: labelOf,
    load: load
  };
});
