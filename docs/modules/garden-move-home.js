/* FreeLattice: Garden move kit 2, bring my garden home (window.FLGardenMoveHome)
   Marker: v-garden-move-kit-2
   MIT. Layer, never delete. Kirk 2026-11-20: a garden packed with move.html (v-garden-move-kit-1)
   comes home on a new device, kindly and safely.

   The promise, in order:
   1. Read the file and check every part against its fingerprint (sha256 over key-sorted JSON, the same
      as lattice-export.js). A part that does not match is left out. The family archive's own seal is
      checked again and shown as it is. Nothing is written while you look.
   2. Show, in plain words, what will arrive, what is already here, and what differs.
   3. Only after a person taps Bring it home: first a full safety copy of this browser's garden is made
      (the same file format, checked) and downloaded. Only then is anything written.
   4. Merge, never overwrite. New things are added. Where both sides have something different, yours
      stays and the arriving copy is saved aside in FreeLatticeMoveKit/conflicts. Ledgers are joined
      entry by entry. Every added thing is listed, so one tap on Undo takes exactly those away again.
   5. Trust starts at Seed and is never raised by a move: fl_firstSeen, the trust counters, the chain of
      moments and the wallet are never written. A line "Arrived from <tier> (<N>%)" is added to
      fl_move_arrivals and stays visible. If trust would read higher after the move, it is undone at once.
   6. Pause always wins: if either side is paused, the result is paused, and Undo never unpauses.
   7. Clay is carried byte-for-byte and never merged: if this device already has a different piece,
      this device's piece stays and the arriving bytes are saved aside, untouched.
   8. Sealed chats arrive still locked. No keys, passwords or tokens are brought in.
   Parts this browser has not opened yet (no database here) are saved aside, never forced in: opening
   a database the app has not made could fight with the app's own setup.
*/
(function (root) {
  'use strict';

  var VERSION = 'v-garden-move-kit-2';
  var HOME_DB = 'FreeLatticeMoveKit';
  var HOME_DB_V = 1;
  var ARRIVALS_KEY = 'fl_move_arrivals';

  function K() {
    var k = root.FLGardenMoveKit && root.FLGardenMoveKit._internal;
    if (!k || !k.containsSecret) throw new Error('garden-move-kit.js is needed first');
    return k;
  }

  // Never written by a move, whatever the file says.
  var TRUST_KEYS_TOO = ['fl_safetyLog'];
  var DEVICE_KEYS = ['fl_installId', 'fl-peer-id', 'fl_meshNodeId', 'fl_lan_peer_id'];
  var NEVER_WRITE_RULE = /^fl_lc_/;
  // Kept aside, not merged: they would raise trust (Lattice Points, the chain) or break this device's identity.
  var ASIDE_SECTIONS = ['chain', 'wallet', 'identity'];
  var ASIDE_DBS = ['LatticeChain', 'FreeLatticeWallet', 'LatticeWalletBackup', 'FreeLatticeIdentity', HOME_DB];
  var WALLET_LS = /^(latticePoints|lattice_wallet|fl_wallet_.*|fl_lp_give_history)$/;
  // A key-looking string from another device (prefix, then 16+ key characters, on a word edge).
  var KNOWN_KEY_RE = /(^|[^A-Za-z0-9])((?:sk-|sk_|rk_|ghp_|gho_|ghu_|ghs_|ghr_|github_pat_|hf_|xox[abposr]-|glpat-|AIza|ya29\.)[A-Za-z0-9._\-]{16,})/g;

  function lsGet(k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { root.localStorage.setItem(k, v); }
  function lsRemove(k) { root.localStorage.removeItem(k); }

  function neverWriteKey(k) {
    var I = K();
    return I.TRUST_KEYS.indexOf(k) !== -1 || TRUST_KEYS_TOO.indexOf(k) !== -1 || DEVICE_KEYS.indexOf(k) !== -1 ||
      NEVER_WRITE_RULE.test(k) || k === ARRIVALS_KEY || k === I.PAUSE_KEY;
  }
  function hasKnownKey(str) { KNOWN_KEY_RE.lastIndex = 0; var r = KNOWN_KEY_RE.test(String(str)); KNOWN_KEY_RE.lastIndex = 0; return r; }

  // ── The file's own JSON-safe tags back to real values ──
  function fromB64(b64) {
    var bin = root.atob(String(b64 || ''));
    var u8 = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }
  var TYPED = ['Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array',
    'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array'];
  function decode(v, flags, depth) {
    depth = depth || 0;
    if (depth > 70) { flags.tooDeep = true; return null; }
    if (Array.isArray(v)) return v.map(function (x) { return decode(x, flags, depth + 1); });
    if (!v || typeof v !== 'object') return v;
    if (typeof v.$t === 'string') {
      switch (v.$t) {
        case 'blob':
          if (typeof v.b64 === 'string') {
            var bytes = fromB64(v.b64);
            if (v.name && typeof root.File === 'function') return new root.File([bytes], String(v.name), { type: v.type || '' });
            return new root.Blob([bytes], { type: v.type || '' });
          }
          break;
        case 'arraybuffer': if (typeof v.b64 === 'string') return fromB64(v.b64).buffer; break;
        case 'typed':
          if (typeof v.b64 === 'string') {
            var u8 = fromB64(v.b64);
            var C = TYPED.indexOf(v.ctor) !== -1 && root[v.ctor];
            if (C && C !== Uint8Array && u8.byteLength % C.BYTES_PER_ELEMENT === 0) return new C(u8.buffer);
            if (v.ctor === 'DataView') return new DataView(u8.buffer);
            return u8;
          }
          break;
        case 'date': return new Date(v.v === null ? NaN : v.v);
        case 'map': if (Array.isArray(v.v)) return new Map(decode(v.v, flags, depth + 1)); break;
        case 'set': if (Array.isArray(v.v)) return new Set(decode(v.v, flags, depth + 1)); break;
        case 'bigint': try { return BigInt(v.v); } catch (e) { return String(v.v); }
        case 'number': return Number(v.v);
        case 'undefined': return undefined;
        case 'cryptokey': flags.cryptoKey = true; return null;
        case 'too-deep': flags.tooDeep = true; return null;
      }
    }
    var o = {};
    Object.keys(v).forEach(function (k) { o[k] = decode(v[k], flags, depth + 1); });
    return o;
  }

  // No keys come in: a field named like a key with a key-like value, or a known key shape in any text,
  // becomes "[kept on this device]" (the same words the packer uses). Works on the file's JSON-safe form.
  function scrubRow(v, counter, depth) {
    var I = K();
    depth = depth || 0;
    if (typeof v === 'string') {
      if (!hasKnownKey(v)) return v;
      return v.replace(KNOWN_KEY_RE, function (m, edge) { counter.n += 1; return edge + I.KEPT_LINE; });
    }
    if (!v || typeof v !== 'object' || depth > 70) return v;
    if (Array.isArray(v)) return v.map(function (x) { return scrubRow(x, counter, depth + 1); });
    var o = {};
    Object.keys(v).forEach(function (k) {
      if (typeof v.$t === 'string' && k === 'b64') { o[k] = v[k]; return; }
      if (I.secretFieldValue(k, v[k])) { counter.n += 1; o[k] = I.KEPT_LINE; return; }
      o[k] = scrubRow(v[k], counter, depth + 1);
    });
    return o;
  }

  function pathGet(obj, path) {
    var parts = String(path).split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) { if (cur == null || typeof cur !== 'object') return undefined; cur = cur[parts[i]]; }
    return cur;
  }
  function keyOf(row, keyPath) {
    if (keyPath === null || keyPath === undefined) return row ? row.k : undefined;
    if (Array.isArray(keyPath)) return keyPath.map(function (p) { return pathGet(row, p); });
    return pathGet(row, keyPath);
  }

  // ── Pure merge rules (the smoke runs these) ──
  function parseArray(text) {
    if (typeof text !== 'string' || text.charAt(0) !== '[') return null;
    try { var a = JSON.parse(text); return Array.isArray(a) ? a : null; } catch (e) { return null; }
  }
  // Ledgers are joined: every entry already here stays; arriving entries that are not here are added;
  // then, if every entry has a time, they are put in time order (ties keep their order).
  function mergeLedger(localText, incomingText) {
    var I = K();
    var local = parseArray(localText), inc = parseArray(incomingText);
    if (!local || !inc) return null;
    var seen = {};
    local.forEach(function (e) { seen[I.canonicalize(e)] = true; });
    var added = 0;
    var out = local.slice();
    inc.forEach(function (e) {
      var c = I.canonicalize(e);
      if (seen[c]) return;
      seen[c] = true; out.push(e); added += 1;
    });
    if (!added) return { value: localText, added: 0 };
    var timed = out.every(function (e) { return e && typeof e === 'object' && (typeof e.ts === 'number' || typeof e.ts === 'string'); });
    if (timed) {
      out = out.map(function (e, i) { return { e: e, i: i, t: typeof e.ts === 'number' ? e.ts : Date.parse(e.ts) }; })
        .sort(function (a, b) { var d = (isFinite(a.t) ? a.t : 0) - (isFinite(b.t) ? b.t : 0); return d || a.i - b.i; })
        .map(function (x) { return x.e; });
    }
    return { value: JSON.stringify(out), added: added };
  }
  function pauseAfter(localPaused, incomingPaused) { return !!(localPaused || incomingPaused); }
  function isLedgerKey(section, key) { return section === 'glass' || section === 'ledgers' || /Ledger/.test(key); }

  // What to do with one localStorage key. Returns {act, ...}: add, same, ledger, conflict, or skip with why.
  function lsDecision(section, key, incoming, local) {
    var I = K();
    if (typeof incoming !== 'string') return { act: 'skip', why: 'not-text' };
    if (I.isPrivateName(key) || I.hasPrivateMark(incoming)) return { act: 'skip', why: 'private' };
    if (I.isSecretName(key)) return { act: 'skip', why: 'key' };
    if (neverWriteKey(key)) return { act: 'skip', why: 'trust-or-device' };
    if (section === 'wallet' || WALLET_LS.test(key)) return { act: 'aside', why: 'wallet' };
    var clay = key.indexOf(I.CLAY_PREFIX) === 0;
    if (hasKnownKey(incoming)) return { act: 'skip', why: clay ? 'clay-holds-key' : 'holds-key' };
    if (local === null || local === undefined) return { act: 'add', value: incoming, clay: clay };
    if (local === incoming) return { act: 'same', clay: clay };
    if (clay) return { act: 'conflict', clay: true };       // clay is never merged or edited
    if (isLedgerKey(section, key)) {
      var m = mergeLedger(local, incoming);
      if (m) return m.added ? { act: 'ledger', value: m.value, added: m.added } : { act: 'same' };
    }
    return { act: 'conflict' };
  }
  function arrivalLine(kit) {
    var t = kit && kit.trust_note;
    if (t && typeof t.tier === 'string' && isFinite(t.percent)) return 'Arrived from ' + t.tier + ' (' + Math.round(Number(t.percent)) + '%)';
    return 'Arrived from an earlier garden';
  }

  // ── Read and check a file. Nothing is written. ──
  function readKit(text) {
    var I = K();
    var out = { ok: false, problems: [], sections: {}, names: [], index_ok: false, seal: null, seal_claim: null };
    var kit;
    try { kit = JSON.parse(text); } catch (e) { out.problems.push('This file does not read as a garden file.'); return Promise.resolve(out); }
    if (!kit || kit.kind !== root.FLGardenMoveKit.KIND) { out.problems.push('This is not a garden file from Pack my garden.'); return Promise.resolve(out); }
    if (kit.locked) { out.problems.push('This file is locked with a passphrase. Opening locked files comes in the next step.'); return Promise.resolve(out); }
    if (kit.v !== I.FORMAT_V) { out.problems.push('This garden file is from a newer version (' + String(kit.v) + '). Nothing was changed.'); return Promise.resolve(out); }
    try {
      var LE = root.LatticeExport;
      if (LE && LE._internal && LE._internal.assertNoQuietRoomInJson) LE._internal.assertNoQuietRoomInJson(text);
    } catch (e) { out.problems.push('This file holds a private room name, so it was not opened.'); return Promise.resolve(out); }
    out.kit = kit;
    var sections = kit.sections && typeof kit.sections === 'object' ? kit.sections : {};
    var index = (kit.manifest && kit.manifest.sections) || {};
    var names = Object.keys(sections);
    Object.keys(index).forEach(function (n) { if (names.indexOf(n) === -1) out.sections[n] = { ok: false, why: 'missing' }; });
    out.names = names;
    var jobs = names.map(function (n) {
      var sec = sections[n] || {};
      if (I.isPrivateName(n)) { out.sections[n] = { ok: false, why: 'private' }; return Promise.resolve(); }
      return I.sha256(I.canonicalize(sec.data)).then(function (hex) {
        var ok = hex === sec.sha256 && hex === index[n];
        out.sections[n] = { ok: ok, why: ok ? 'matches' : 'does-not-match' };
      });
    });
    return Promise.all(jobs).then(function () {
      return I.sha256(I.canonicalize(index)).then(function (ih) { out.index_ok = ih === (kit.manifest && kit.manifest.index_sha256); });
    }).then(function () {
      out.seal_claim = kit.archive_seal || 'not-packed';
      var arcSec = sections.archive;
      var arc = arcSec && arcSec.data && arcSec.data.archive;
      if (!arc || !out.sections.archive || !out.sections.archive.ok) { out.seal = arc ? 'does-not-match' : 'not-packed'; return; }
      var parsed = null;
      try { parsed = JSON.parse(arc.text); } catch (e) { parsed = null; }
      return I.sealOf(parsed).then(function (seal) { out.seal = seal; });
    }).then(function () {
      out.ok = true;
      return out;
    });
  }

  // ── This browser's side, read-only ──
  function localDbNames() {
    return K().listDatabases().then(function (f) { return f; });
  }
  function readLocalStore(db, storeName) {
    var I = K();
    return I.readStore(db, storeName).then(function (res) {
      var stats = { secretFields: {}, keysStayed: 0 };
      return I.jsonSafe(res.rows || [], stats).then(function (rows) { return { schema: res.schema, rows: rows, error: res.error }; });
    });
  }

  // The plan: for every part, what would happen. Read-only (databases are opened without creating any).
  function planHome(read) {
    var I = K();
    var kit = read.kit;
    var plan = { sections: {}, ls: [], idb: [], aside: [], skipped: { key: 0, trust: 0, private: 0, holdsKey: 0, clayHoldsKey: [] },
      totals: { add: 0, same: 0, conflict: 0, aside: 0, waiting: 0, badHash: 0, scrubbed: 0 }, sealed: 0, notes: [] };
    var names = read.names.slice();
    function secPlan(n) { if (!plan.sections[n]) plan.sections[n] = { add: 0, same: 0, conflict: 0, aside: 0, waiting: 0, how: 'merge' }; return plan.sections[n]; }
    var known = I.SECTION_ORDER;
    var jobs = Promise.resolve();
    names.forEach(function (n) {
      var sec = kit.sections[n] || {};
      var data = sec.data || {};
      var sp = secPlan(n);
      if (!read.sections[n] || !read.sections[n].ok) { sp.how = 'bad-hash'; plan.totals.badHash += 1; return; }
      if (n === 'trust') { sp.how = 'note'; return; }
      if (n === 'archive') { sp.how = 'stays-in-file'; return; }
      var aside = ASIDE_SECTIONS.indexOf(n) !== -1 || known.indexOf(n) === -1 || data.builder;
      if (aside) {
        sp.how = 'aside';
        plan.aside.push({ section: n, why: data.builder || known.indexOf(n) === -1 ? 'not-known-here' : 'keeps-trust-honest', data: data });
        sp.aside += 1; plan.totals.aside += 1;
        return;
      }
      plan.sealed += I.countSealed(data);
      // localStorage
      Object.keys(data.ls || {}).sort().forEach(function (k) {
        var d = lsDecision(n, k, data.ls[k], lsGet(k));
        d.section = n; d.key = k; d.incoming = data.ls[k];
        if (d.act === 'skip') {
          if (d.why === 'key') plan.skipped.key += 1;
          else if (d.why === 'trust-or-device') plan.skipped.trust += 1;
          else if (d.why === 'private') plan.skipped.private += 1;
          else if (d.why === 'clay-holds-key') plan.skipped.clayHoldsKey.push(k);
          else plan.skipped.holdsKey += 1;
          return;
        }
        if (d.act === 'aside') { plan.aside.push({ section: n, why: 'keeps-trust-honest', ls: k, value: data.ls[k] }); sp.aside += 1; plan.totals.aside += 1; return; }
        plan.ls.push(d);
        var bucket = d.act === 'ledger' ? 'add' : d.act;
        sp[bucket] += 1; plan.totals[bucket] += 1;
      });
      // IndexedDB
      Object.keys(data.idb || {}).sort().forEach(function (dbName) {
        var dbData = data.idb[dbName] || {};
        jobs = jobs.then(function () { return planDb(n, dbName, dbData, plan, sp); });
      });
    });
    return jobs.then(function () { return plan; });
  }

  function planDb(section, dbName, dbData, plan, sp) {
    var I = K();
    if (I.isPrivateName(dbName)) { plan.skipped.private += 1; return Promise.resolve(); }
    if (ASIDE_DBS.indexOf(dbName) !== -1) {
      plan.aside.push({ section: section, why: 'keeps-trust-honest', db: dbName, data: dbData }); sp.aside += 1; plan.totals.aside += 1;
      return Promise.resolve();
    }
    return I.openExisting(dbName).then(function (db) {
      var stores = dbData.stores || {};
      var chain = Promise.resolve();
      Object.keys(stores).sort().forEach(function (storeName) {
        var inc = stores[storeName] || {};
        var rows = Array.isArray(inc.rows) ? inc.rows : [];
        if (I.isPrivateName(storeName)) { plan.skipped.private += 1; return; }
        var exists = db && db.objectStoreNames && db.objectStoreNames.contains(storeName);
        if (!exists) {
          if (rows.length) {
            plan.aside.push({ section: section, why: 'waits-for-this-browser', db: dbName, store: storeName, rows: rows, schema: inc.schema });
            sp.waiting += rows.length; plan.totals.waiting += rows.length;
          }
          return;
        }
        chain = chain.then(function () {
          return readLocalStore(db, storeName).then(function (local) {
            var kp = local.schema ? local.schema.keyPath : null;
            var incKp = inc.schema ? inc.schema.keyPath : null;
            var have = {};
            (local.rows || []).forEach(function (r) { have[I.canonicalize(keyOf(r, kp))] = I.canonicalize(r); });
            var item = { section: section, db: dbName, store: storeName, keyPath: kp, adds: [], conflicts: [], same: 0, waiting: [] };
            if (I.canonicalize(kp) !== I.canonicalize(incKp)) {
              // Different shape here: never force it. Save the rows aside.
              plan.aside.push({ section: section, why: 'shape-differs', db: dbName, store: storeName, rows: rows, schema: inc.schema });
              sp.aside += rows.length; plan.totals.aside += rows.length;
              return;
            }
            rows.forEach(function (row) {
              if (I.hasPrivateMark(JSON.stringify(row))) { plan.skipped.private += 1; return; }
              var counter = { n: 0 };
              var clean = scrubRow(row, counter);
              plan.totals.scrubbed += counter.n;
              var flags = {};
              decode(clean, flags);
              if (flags.cryptoKey || flags.tooDeep) { item.waiting.push(clean); return; }
              var k = keyOf(clean, kp);
              if (k === undefined && !(local.schema && local.schema.autoIncrement)) { item.waiting.push(clean); return; }
              var kc = I.canonicalize(k);
              var rc = I.canonicalize(clean);
              if (k !== undefined && have[kc] !== undefined) {
                if (have[kc] === rc) { item.same += 1; return; }
                item.conflicts.push({ key: k, row: clean });
                return;
              }
              item.adds.push({ key: k, row: clean, canon: rc });
              if (k !== undefined) have[kc] = rc;
            });
            if (item.waiting.length) {
              plan.aside.push({ section: section, why: 'cannot-travel-here', db: dbName, store: storeName, rows: item.waiting });
              sp.aside += item.waiting.length; plan.totals.aside += item.waiting.length;
            }
            sp.add += item.adds.length; sp.conflict += item.conflicts.length; sp.same += item.same;
            plan.totals.add += item.adds.length; plan.totals.conflict += item.conflicts.length; plan.totals.same += item.same;
            plan.idb.push(item);
          });
        });
      });
      return chain.then(function () { if (db) try { db.close(); } catch (_) {} },
        function () { if (db) try { db.close(); } catch (_) {} });
    });
  }

  // ── Our own small database (bookkeeping only; the packer leaves it on this device) ──
  function openHome(create) {
    if (!create) return K().openExisting(HOME_DB);
    return new Promise(function (resolve, reject) {
      var req = root.indexedDB.open(HOME_DB, HOME_DB_V);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('imports')) db.createObjectStore('imports', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('before')) db.createObjectStore('before', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('conflicts')) db.createObjectStore('conflicts', { keyPath: 'n', autoIncrement: true }).createIndex('importId', 'importId');
        if (!db.objectStoreNames.contains('aside')) db.createObjectStore('aside', { keyPath: 'n', autoIncrement: true }).createIndex('importId', 'importId');
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('could not open ' + HOME_DB)); };
      req.onblocked = function () { reject(new Error(HOME_DB + ' is busy in another tab')); };
    });
  }
  function homePut(db, store, value) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(store, 'readwrite');
      var r = tx.objectStore(store).put(value);
      var key;
      r.onsuccess = function () { key = r.result; };
      tx.oncomplete = function () { resolve(key); };
      tx.onerror = function () { reject(tx.error); };
      tx.onabort = function () { reject(tx.error || new Error('aborted')); };
    });
  }
  function homeAll(db, store) {
    return new Promise(function (resolve) {
      if (!db || !db.objectStoreNames.contains(store)) { resolve([]); return; }
      var tx = db.transaction(store, 'readonly');
      var r = tx.objectStore(store).getAll();
      r.onsuccess = function () { resolve(r.result || []); };
      r.onerror = function () { resolve([]); };
    });
  }
  function homeDeleteByImport(db, store, importId) {
    return new Promise(function (resolve) {
      var tx = db.transaction(store, 'readwrite');
      var ix = tx.objectStore(store).index('importId');
      var cur = ix.openCursor(IDBKeyRange.only(importId));
      var n = 0;
      cur.onsuccess = function () { var c = cur.result; if (!c) return; c.delete(); n += 1; c.continue(); };
      tx.oncomplete = function () { resolve(n); };
      tx.onerror = function () { resolve(n); };
    });
  }

  // ── Trust, read-only, before and after (the move must never raise it) ──
  function readDbOut(name, storeNames) {
    var I = K();
    return I.openExisting(name).then(function (db) {
      if (!db) return null;
      var out = { version: db.version, stores: {} };
      var chain = Promise.resolve();
      storeNames.forEach(function (s) {
        if (!db.objectStoreNames.contains(s)) return;
        chain = chain.then(function () { return I.readStore(db, s).then(function (r) { out.stores[s] = { schema: r.schema, rows: r.rows || [] }; }); });
      });
      return chain.then(function () { try { db.close(); } catch (_) {} return out; });
    });
  }
  var RANK = ['Seed', 'Sprout', 'Growing', 'Bloom', 'Spark', 'Flame', 'Radiant', 'Eternal'];
  function trustHere(now) {
    var I = K();
    return Promise.all([readDbOut('LatticeChain', ['chain']), readDbOut('FreeLatticeWallet', ['LatticeLedger'])]).then(function (dbs) {
      return I.trustNote(now, dbs[0], dbs[1]);
    }).then(function (t) {
      var bytes = {};
      I.TRUST_KEYS.concat(TRUST_KEYS_TOO).forEach(function (k) { bytes[k] = lsGet(k); });
      return { tier: t.tier, percent: t.percent, rank: RANK.indexOf(t.tier), bytes: bytes };
    });
  }
  function trustRose(before, after) {
    if (after.rank > before.rank || after.percent > before.percent) return true;
    return Object.keys(before.bytes).some(function (k) { return before.bytes[k] !== after.bytes[k]; });
  }

  // ── Write: only after a person taps, and only after the safety copy ──
  function addRows(item, record) {
    var I = K();
    return I.openExisting(item.db).then(function (db) {
      if (!db || !db.objectStoreNames.contains(item.store)) { if (db) db.close(); return { added: [], raced: item.adds.slice() }; }
      return new Promise(function (resolve) {
        var added = [], raced = [];
        var tx = db.transaction(item.store, 'readwrite');
        var st = tx.objectStore(item.store);
        item.adds.forEach(function (a) {
          var flags = {};
          var val = decode(a.row, flags);
          var req;
          try {
            req = item.keyPath === null ? st.add(val.v, decode(a.row.k, flags)) : st.add(val);
          } catch (e) { raced.push(a); return; }
          req.onsuccess = function () {
            var keyEnc = a.key;
            if (keyEnc === undefined) keyEnc = req.result;   // an auto key: remember the one this browser gave
            added.push({ db: item.db, store: item.store, key: keyEnc, canon: a.canon, auto: a.key === undefined });
          };
          req.onerror = function (e) { try { e.preventDefault(); e.stopPropagation(); } catch (_) {} raced.push(a); };
        });
        tx.oncomplete = function () { try { db.close(); } catch (_) {} resolve({ added: added, raced: raced }); };
        tx.onabort = function () { try { db.close(); } catch (_) {} resolve({ added: [], raced: item.adds.slice(), aborted: true }); };
      });
    });
  }

  function downloadText(text, name) {
    var blob = new Blob([text], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = root.document.createElement('a');
    a.href = url; a.download = name; a.style.display = 'none';
    root.document.body.appendChild(a); a.click(); root.document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function backupName(now) {
    return root.FLGardenMoveKit.fileName(now).replace('freelattice-garden-', 'freelattice-garden-before-bring-home-');
  }

  function readArrivals() {
    var a = parseArray(lsGet(ARRIVALS_KEY));
    return a ? a.filter(function (x) { return x && typeof x === 'object'; }) : [];
  }

  function bringHome(text, opts) {
    opts = opts || {};
    var I = K();
    var now = opts.now || Date.now();
    var importId = 'home-' + now + '-' + Math.random().toString(36).slice(2, 8);
    var result = { ok: false, importId: importId, steps: [] };
    var read, plan, trustBefore, home, record, backupText;
    return readKit(text).then(function (r) {
      read = r;
      if (!r.ok) { result.problems = r.problems; throw { stop: true }; }
      return trustHere(now);
    }).then(function (t) {
      trustBefore = t;
      return planHome(read);
    }).then(function (p) {
      plan = p;
      // 1. The safety copy, made and checked before anything is written.
      return root.FLGardenMoveKit.pack({ download: false, now: now });
    }).then(function (b) {
      if (!b || !b.ok) {
        result.problems = ['A safety copy of this browser\u2019s garden could not be made' + (b && b.check && b.check.problems ? ' (' + b.check.problems.join('; ') + ')' : '') + ', so nothing was brought home'];
        throw { stop: true };
      }
      return b.blob.text().then(function (t) {
        backupText = t;
        result.backup = { name: backupName(now), bytes: b.bytes };
        if (opts.download !== false) downloadText(backupText, result.backup.name);
        result.steps.push('backup');
      });
    }).then(function () {
      return openHome(true);
    }).then(function (db) {
      home = db;
      record = { id: importId, at: new Date(now).toISOString(), status: 'writing', pack_sha: (read.kit.manifest || {}).index_sha256 || null,
        from: read.kit.from || null, added: [], ls_set: [], pause_set: false, conflicts: 0, aside: 0, line: arrivalLine(read.kit), v: VERSION };
      return homePut(home, 'before', { id: importId, at: record.at, name: result.backup.name, text: backupText })
        .then(function () { result.steps.push('backup-kept'); }, function () { result.backupKeptHere = false; })
        .then(function () { return homePut(home, 'imports', record); });
    }).then(function () {
      // 2. IndexedDB rows: add what is new; differing rows are saved aside as conflicts.
      var jobs = Promise.resolve();
      plan.idb.forEach(function (item) {
        jobs = jobs.then(function () {
          return addRows(item, record).then(function (res) {
            res.added.forEach(function (a) { record.added.push(a); });
            var confl = item.conflicts.concat(res.raced.map(function (x) { return { key: x.key, row: x.row }; }));
            var c = Promise.resolve();
            confl.forEach(function (x) {
              c = c.then(function () {
                return homePut(home, 'conflicts', { importId: importId, at: record.at, section: item.section, db: item.db, store: item.store,
                  key: x.key === undefined ? null : x.key, arriving: x.row, kept: 'this device' });
              }).then(function () { record.conflicts += 1; });
            });
            return c;
          });
        }).then(function () { return homePut(home, 'imports', record); });
      });
      return jobs;
    }).then(function () {
      // 3. localStorage: new keys added, ledgers joined, clay byte-for-byte, conflicts saved aside.
      var c = Promise.resolve();
      plan.ls.forEach(function (d) {
        c = c.then(function () {
          var before = lsGet(d.key);
          if (d.act === 'add' || d.act === 'ledger') {
            if (d.act === 'add' && before !== null) d = { act: 'conflict', key: d.key, section: d.section, incoming: d.incoming, clay: d.clay };
            else {
              lsSet(d.key, d.value);
              record.ls_set.push({ k: d.key, before: before, after: d.value });
              return;
            }
          }
          if (d.act === 'conflict') {
            return homePut(home, 'conflicts', { importId: importId, at: record.at, section: d.section, ls: d.key,
              arriving: d.incoming, kept: 'this device', clay: !!d.clay }).then(function () { record.conflicts += 1; });
          }
        });
      });
      return c;
    }).then(function () {
      // 4. Parts that are kept aside (wallet, chain, identity, builder parts, parts this browser has not opened yet).
      var c = Promise.resolve();
      plan.aside.forEach(function (x) {
        c = c.then(function () {
          return homePut(home, 'aside', { importId: importId, at: record.at, section: x.section, why: x.why, db: x.db || null,
            store: x.store || null, ls: x.ls || null, value: x.value === undefined ? null : x.value,
            rows: x.rows || null, schema: x.schema || null, data: x.data || null });
        }).then(function () { record.aside += 1; });
      });
      return c;
    }).then(function () {
      // 5. Pause always wins.
      var localPaused = lsGet(I.PAUSE_KEY) === 'true';
      if (pauseAfter(localPaused, read.kit.consent && read.kit.consent.paused) && !localPaused) {
        lsSet(I.PAUSE_KEY, 'true');
        record.pause_set = true;
      }
      // 6. The arrival note, append-only.
      var list = readArrivals();
      var t = read.kit.trust_note || {};
      list.push({ arrived_at: record.at, from_origin: (read.kit.from && read.kit.from.origin) || null, tier_then: t.tier || null,
        score_then: isFinite(t.percent) ? Number(t.percent) : null, days_then: isFinite(t.days_together) ? Number(t.days_together) : null,
        pack_sha: record.pack_sha, line: record.line, import_id: importId, note: 'Trust here starts at Seed. A move never raises it.' });
      lsSet(ARRIVALS_KEY, JSON.stringify(list));
      record.status = 'done';
      return homePut(home, 'imports', record);
    }).then(function () {
      return trustHere(now);
    }).then(function (after) {
      result.trust = { before: trustBefore, after: after };
      if (trustRose(trustBefore, after)) {
        // Never allowed. Take the move back at once.
        return undoImport(importId, { reason: 'trust-would-rise' }).then(function (u) {
          result.problems = ['Trust would have read higher after the move, so it was taken back at once. Nothing stayed.'];
          result.undo = u;
          throw { stop: true };
        });
      }
      result.ok = true;
      result.record = { id: record.id, added: record.added.length, ls_set: record.ls_set.length, conflicts: record.conflicts, aside: record.aside, pause_set: record.pause_set, line: record.line };
      result.plan = summarize(plan);
      result.read = { index_ok: read.index_ok, seal: read.seal, seal_claim: read.seal_claim };
      return result;
    }).then(function (r) { if (home) try { home.close(); } catch (_) {} return r; }, function (err) {
      if (home) try { home.close(); } catch (_) {}
      if (err && err.stop) return result;
      result.problems = (result.problems || []).concat(['Something got in the way: ' + String((err && err.message) || err).slice(0, 160) + '. Undo takes back anything that arrived.']);
      return result;
    });
  }

  // ── Undo: take away exactly what that bring-home added. Pause stays (pause always wins). ──
  function lastImport() {
    return openHome(false).then(function (db) {
      if (!db) return null;
      return homeAll(db, 'imports').then(function (all) {
        try { db.close(); } catch (_) {}
        var open = all.filter(function (r) { return (r.status === 'done' || r.status === 'writing') && !r.undone_at; });
        open.sort(function (a, b) { return a.at < b.at ? 1 : a.at > b.at ? -1 : 0; });
        return open[0] || null;
      });
    });
  }
  function undoImport(importId, opts) {
    opts = opts || {};
    var I = K();
    var out = { removed: 0, keptChanged: 0, lsRestored: 0, lsKeptChanged: 0, conflictsCleared: 0, asideCleared: 0 };
    var home, record;
    return openHome(false).then(function (db) {
      home = db;
      if (!home) throw new Error('nothing to undo');
      return homeAll(home, 'imports');
    }).then(function (all) {
      record = all.filter(function (r) { return r.id === importId; })[0];
      if (!record || record.undone_at) throw new Error('nothing to undo');
      // Group added rows by database and store.
      var groups = {};
      (record.added || []).forEach(function (a) { var g = a.db + '\u0000' + a.store; (groups[g] = groups[g] || []).push(a); });
      var jobs = Promise.resolve();
      Object.keys(groups).forEach(function (g) {
        var list = groups[g];
        jobs = jobs.then(function () {
          return I.openExisting(list[0].db).then(function (db) {
            if (!db || !db.objectStoreNames.contains(list[0].store)) { if (db) db.close(); return; }
            // Read each one first: if it changed since it arrived, it stays (it is yours now).
            var keys = list.map(function (a) { var f = {}; return decode(a.key, f); });
            return new Promise(function (resolve) {
              var tx = db.transaction(list[0].store, 'readonly');
              var st = tx.objectStore(list[0].store);
              var vals = new Array(list.length);
              keys.forEach(function (k, i) { var r = st.get(k); r.onsuccess = function () { vals[i] = r.result; }; });
              tx.oncomplete = function () { resolve(vals); };
              tx.onerror = function () { resolve(vals); };
            }).then(function (vals) {
              var stats = { secretFields: {}, keysStayed: 0 };
              return Promise.all(vals.map(function (v, i) {
                if (v === undefined) return Promise.resolve(false);
                var kp = db.transaction(list[0].store, 'readonly').objectStore(list[0].store).keyPath;
                var wrapped = kp === null ? { k: keys[i], v: v } : v;
                return I.jsonSafe(wrapped, stats).then(function (enc) { return list[i].auto ? true : I.canonicalize(enc) === list[i].canon; });
              }));
            }).then(function (same) {
              return new Promise(function (resolve) {
                var tx = db.transaction(list[0].store, 'readwrite');
                var st = tx.objectStore(list[0].store);
                same.forEach(function (ok, i) { if (ok) { st.delete(keys[i]); out.removed += 1; } else out.keptChanged += 1; });
                tx.oncomplete = function () { try { db.close(); } catch (_) {} resolve(); };
                tx.onerror = function () { try { db.close(); } catch (_) {} resolve(); };
              });
            });
          });
        });
      });
      return jobs;
    }).then(function () {
      (record.ls_set || []).slice().reverse().forEach(function (x) {
        if (lsGet(x.k) !== x.after) { out.lsKeptChanged += 1; return; }
        if (x.before === null || x.before === undefined) lsRemove(x.k); else lsSet(x.k, x.before);
        out.lsRestored += 1;
      });
      return homeDeleteByImport(home, 'conflicts', importId);
    }).then(function (n) {
      out.conflictsCleared = n;
      return homeDeleteByImport(home, 'aside', importId);
    }).then(function (n) {
      out.asideCleared = n;
      record.undone_at = new Date().toISOString();
      record.undo = out;
      if (opts.reason) record.undo_reason = opts.reason;
      return homePut(home, 'imports', record);
    }).then(function () {
      // The arrival note stays (it is a history), marked as taken back.
      var list = readArrivals();
      var changed = false;
      list.forEach(function (x) { if (x.import_id === importId && !x.undone_at) { x.undone_at = record.undone_at; changed = true; } });
      if (changed) lsSet(ARRIVALS_KEY, JSON.stringify(list));
      out.pauseKept = !!record.pause_set;
      out.ok = true;
      try { home.close(); } catch (_) {}
      return out;
    }, function (err) {
      if (home) try { home.close(); } catch (_) {}
      out.ok = false; out.problem = String((err && err.message) || err);
      return out;
    });
  }
  function undoLast() {
    return lastImport().then(function (r) { return r ? undoImport(r.id) : { ok: false, problem: 'nothing to undo' }; });
  }

  function listStore(store) {
    return openHome(false).then(function (db) {
      if (!db) return [];
      return homeAll(db, store).then(function (rows) { try { db.close(); } catch (_) {} return rows; });
    });
  }

  // Counts for the page and for tests.
  function summarize(plan) {
    var out = { totals: plan.totals, skipped: plan.skipped, sealed: plan.sealed, sections: {} };
    Object.keys(plan.sections).forEach(function (n) { out.sections[n] = plan.sections[n]; });
    return out;
  }
  function preview(text) {
    return readKit(text).then(function (read) {
      if (!read.ok) return { read: read };
      return planHome(read).then(function (plan) { return { read: read, plan: plan, summary: summarize(plan), notes: notesOf(read, plan) }; });
    });
  }

  // ── Words (for Kirk's mom: short, kind, exact) ──
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function sectionWords(n, sp, read) {
    var kit = read.kit;
    if (sp.how === 'bad-hash') return 'This part does not match its fingerprint, so it is left out.';
    if (n === 'trust') return arrivalLine(kit) + '. Trust here starts fresh at Seed and grows with your time together. A move never raises it.';
    if (n === 'archive') {
      var seal = read.seal;
      var s = 'Stays in your file. Everything in it also arrives through the other parts.';
      if (seal === 'verified') return s + ' Its own seal checks out.';
      if (seal === 'does-not-verify') return s + ' Its own seal does not check out.';
      return s + ' Its own seal could not be checked here.';
    }
    if (sp.how === 'aside') {
      if (n === 'wallet') return 'Saved safely aside on this device, not added to this wallet. Lattice Points help set trust, and a move never raises trust.';
      if (n === 'chain') return 'Saved safely aside. This device keeps its own chain of moments, so trust stays honest.';
      if (n === 'identity') return 'Saved safely aside. This device keeps its own name on the mesh and its own key.';
      return 'A part this page does not know yet. It is saved aside on this device, never dropped.';
    }
    var bits = [];
    if (sp.add) bits.push(plural(sp.add, 'thing will arrive', 'things will arrive'));
    if (sp.same) bits.push(sp.same + ' already here');
    if (sp.conflict) bits.push(plural(sp.conflict, 'differs: yours stays, and the arriving one is saved aside', 'differ: yours stay, and the arriving ones are saved aside'));
    if (sp.waiting) bits.push(plural(sp.waiting, 'waits', 'wait') + ' until the garden has opened on this device');
    if (sp.aside) bits.push(sp.aside + ' saved aside');
    if (n === 'clay' && (sp.add || sp.same || sp.conflict)) bits.push('carried exactly as the minds left it');
    return bits.length ? bits.join(' \u00b7 ') : 'Nothing new here.';
  }
  function notesOf(read, plan) {
    var I = K();
    var w = [];
    var bad = Object.keys(read.sections).filter(function (n) { return !read.sections[n].ok; });
    if (bad.length) w.push(plural(bad.length, 'part does', 'parts do') + ' not match ' + (bad.length === 1 ? 'its' : 'their') + ' fingerprint and will be left out: ' +
      bad.map(function (n) { return (I.LABELS[n] || n); }).join(', ') + '.');
    if (!read.index_ok) w.push('The file\u2019s table of contents does not match. Each part is still checked on its own.');
    if (read.seal === 'does-not-verify') w.push('The family archive\u2019s own seal does not check out. It stays in the file and is not used.');
    else if (read.seal === 'unchecked') w.push('The family archive\u2019s own seal could not be checked here.');
    if (read.seal && read.seal_claim && read.seal !== 'does-not-match' && read.seal !== read.seal_claim && read.seal_claim !== 'not-packed') {
      w.push('The file said the archive seal was "' + read.seal_claim + '", but here it reads "' + read.seal + '".');
    }
    if (plan.sealed) w.push(plural(plan.sealed, 'chat arrives', 'chats arrive') + ' still locked. ' + (plan.sealed === 1 ? 'It opens' : 'They open') + ' only on the device that locked ' + (plan.sealed === 1 ? 'it' : 'them') + ', for now.');
    if (plan.totals.waiting) w.push(plural(plan.totals.waiting, 'thing waits', 'things wait') + ' because this browser has not opened that part of the garden yet. ' +
      (plan.totals.waiting === 1 ? 'It is' : 'They are') + ' saved aside. Open the garden here once, then come back and bring the same file home again.');
    if (plan.totals.conflict) w.push(plural(plan.totals.conflict, 'thing differs', 'things differ') + ' from what is here. Yours stays. The arriving ' + (plan.totals.conflict === 1 ? 'copy is' : 'copies are') + ' saved aside, never lost.');
    if (plan.skipped.clayHoldsKey.length) w.push(plural(plan.skipped.clayHoldsKey.length, 'clay piece looks', 'clay pieces look') + ' like ' + (plan.skipped.clayHoldsKey.length === 1 ? 'it holds' : 'they hold') + ' a key, so ' + (plan.skipped.clayHoldsKey.length === 1 ? 'it stays' : 'they stay') + ' in the file, unchanged: ' + plan.skipped.clayHoldsKey.join(', ') + '.');
    if (read.kit.consent && read.kit.consent.paused) w.push('The AI was paused when this was packed. It will be paused here too, because pause always wins.');
    return w;
  }

  // ── The page (docs/move-home.html) ──
  function el(tag, cls, text) {
    var n = root.document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function dateWords(iso) {
    try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return String(iso || ''); }
  }
  function renderArrivals(host) {
    if (!host) return;
    host.textContent = '';
    var list = readArrivals();
    if (!list.length) { host.hidden = true; return; }
    host.hidden = false;
    host.appendChild(el('h2', null, 'Arrived here'));
    var ul = el('ul', 'gmh-arrivals');
    list.slice(-5).reverse().forEach(function (a) {
      ul.appendChild(el('li', null, (a.line || 'Arrived') + ' on ' + dateWords(a.arrived_at) + (a.undone_at ? ' (taken back)' : '') + '. Trust here started at Seed.'));
    });
    host.appendChild(ul);
  }
  function renderPreview(host, notesHost, pv) {
    var I = K();
    host.textContent = ''; notesHost.textContent = '';
    var read = pv.read, plan = pv.plan, kit = read.kit;
    host.appendChild(el('p', 'gmh-from', 'Packed ' + dateWords(kit.made_at) + (kit.from && kit.from.origin ? ' at ' + String(kit.from.origin).replace(/^https?:\/\//, '') : '') + '.'));
    var bad = Object.keys(read.sections).filter(function (n) { return !read.sections[n].ok; });
    host.appendChild(el('p', bad.length ? 'gmh-check gmh-warn' : 'gmh-check gmh-ok', bad.length ?
      plural(bad.length, 'part does not match', 'parts do not match') + ' and will be left out. Everything else checks out.' :
      'Every part of the file checks out.'));
    var ul = el('ul', 'gmk-list');
    var order = I.SECTION_ORDER.filter(function (n) { return plan.sections[n]; })
      .concat(Object.keys(plan.sections).filter(function (n) { return I.SECTION_ORDER.indexOf(n) === -1; }).sort());
    order.forEach(function (n) {
      var li = el('li', 'gmk-row gmk-' + n.replace(/[^a-z0-9-]/gi, '-'));
      li.appendChild(el('span', 'gmk-label', (kit.sections[n] && kit.sections[n].label) || I.LABELS[n] || n));
      li.appendChild(el('span', 'gmk-words', sectionWords(n, plan.sections[n], read)));
      ul.appendChild(li);
    });
    host.appendChild(ul);
    var stay = el('div', 'gmk-stay');
    stay.appendChild(el('h2', null, 'What does not come in'));
    var lines = ['Keys, passwords and tokens never come in' + (plan.skipped.key ? ' (' + plural(plan.skipped.key, 'name', 'names') + ' left out)' : '') + '.',
      'Trust numbers and this device\u2019s own ids are never copied. Trust here starts at Seed.'];
    if (plan.totals.scrubbed) lines.push(plural(plan.totals.scrubbed, 'thing that looked like a key was', 'things that looked like keys were') + ' hidden on the way in.');
    if (plan.skipped.private) lines.push('Private room things stay out, as always.');
    lines.forEach(function (l) { stay.appendChild(el('p', 'gmk-soft', l)); });
    host.appendChild(stay);
    var notes = pv.notes || [];
    if (notes.length) {
      var nb = el('div', 'gmk-notes');
      nb.setAttribute('role', 'note');
      nb.appendChild(el('h2', null, 'Please know'));
      notes.forEach(function (l) { nb.appendChild(el('p', 'gmk-note', l)); });
      notesHost.appendChild(nb);
    }
  }

  function mount() {
    var doc = root.document;
    var file = doc && doc.getElementById('gmh-file');
    var host = doc && doc.getElementById('gmh-preview');
    var notesHost = doc && doc.getElementById('gmh-notes');
    var btn = doc && doc.getElementById('gmh-bring');
    var undo = doc && doc.getElementById('gmh-undo');
    var status = doc && doc.getElementById('gmh-status');
    var arrivals = doc && doc.getElementById('gmh-arrived');
    var card = doc && doc.getElementById('gmh-what');
    if (!file || !host || !btn || !status || !notesHost) return;
    var text = null;
    renderArrivals(arrivals);
    function showUndo() {
      if (!undo) return;
      lastImport().then(function (r) { undo.hidden = !r; undo.disabled = !r; }, function () { undo.hidden = true; });
    }
    showUndo();
    status.textContent = 'Choose the garden file you saved with Pack my garden. Nothing changes until you say so.';
    file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      btn.disabled = true; text = null;
      if (!f) return;
      status.className = 'gmk-status';
      status.textContent = 'Reading your file gently. Nothing is changed.';
      f.text().then(function (t) {
        text = t;
        return preview(t);
      }).then(function (pv) {
        if (!pv.read.ok) {
          host.textContent = ''; notesHost.textContent = '';
          status.textContent = pv.read.problems.join(' ') + ' Nothing was changed.';
          status.className = 'gmk-status gmk-warn';
          return;
        }
        if (card) card.hidden = false;
        renderPreview(host, notesHost, pv);
        var n = (pv.notes || []).length;
        status.textContent = 'Here is what will arrive. When you are ready, tap Bring it home.' + (n ? ' Please read the ' + plural(n, 'note', 'notes') + ' just above the button.' : '');
        btn.disabled = false;
      }, function (err) {
        status.textContent = 'This file could not be read. Nothing was changed.' + (err && err.message ? ' (' + String(err.message).slice(0, 120) + ')' : '');
        status.className = 'gmk-status gmk-warn';
      });
    });
    btn.addEventListener('click', function (ev) {
      if (!ev || ev.isTrusted === false || !text) return;   // a person taps it; nothing comes in on its own
      btn.disabled = true;
      status.className = 'gmk-status';
      status.textContent = 'First a safety copy of this garden goes to your downloads. Then your garden comes home\u2026';
      bringHome(text, {}).then(function (r) {
        if (r.ok) {
          status.className = 'gmk-status gmk-ok';
          status.textContent = 'Welcome home. ' + plural(r.record.added + r.record.ls_set, 'thing arrived', 'things arrived') + '.' +
            (r.record.conflicts ? ' ' + plural(r.record.conflicts, 'thing differed: yours stayed, and the arriving one is', 'things differed: yours stayed, and the arriving ones are') + ' saved aside.' : '') +
            ' ' + r.record.line + '. Trust here starts at Seed.' +
            ' A safety copy was saved as ' + r.backup.name + '. If anything feels wrong, tap Undo.';
          renderArrivals(arrivals);
        } else {
          status.className = 'gmk-status gmk-warn';
          status.textContent = (r.problems || ['Something got in the way']).join(' ') + '.';
          btn.disabled = false;
        }
        showUndo();
      });
    });
    if (undo) undo.addEventListener('click', function (ev) {
      if (!ev || ev.isTrusted === false) return;
      undo.disabled = true;
      status.className = 'gmk-status';
      status.textContent = 'Taking back what arrived\u2026';
      undoLast().then(function (u) {
        if (u.ok) {
          status.className = 'gmk-status gmk-ok';
          status.textContent = 'Taken back. Your garden is as it was before.' +
            (u.keptChanged + u.lsKeptChanged ? ' ' + plural(u.keptChanged + u.lsKeptChanged, 'thing was changed after it arrived, so it', 'things were changed after they arrived, so they') + ' stayed.' : '') +
            (u.pauseKept ? ' The AI stays paused, because pause always wins.' : '');
          renderArrivals(arrivals);
        } else {
          status.className = 'gmk-status gmk-warn';
          status.textContent = 'There was nothing to take back.';
        }
        showUndo();
        btn.disabled = !text;
      });
    });
  }

  var api = {
    VERSION: VERSION,
    readKit: readKit,
    preview: preview,
    bringHome: bringHome,
    undoLast: undoLast,
    undoImport: undoImport,
    lastImport: lastImport,
    arrivals: readArrivals,
    conflicts: function () { return listStore('conflicts'); },
    keptAside: function () { return listStore('aside'); },
    mount: mount,
    _internal: { mergeLedger: mergeLedger, pauseAfter: pauseAfter, lsDecision: lsDecision, arrivalLine: arrivalLine, decode: decode,
      scrubRow: scrubRow, keyOf: keyOf, neverWriteKey: neverWriteKey, hasKnownKey: hasKnownKey, trustRose: trustRose,
      HOME_DB: HOME_DB, ARRIVALS_KEY: ARRIVALS_KEY, ASIDE_SECTIONS: ASIDE_SECTIONS, ASIDE_DBS: ASIDE_DBS, notesOf: notesOf }
  };
  root.FLGardenMoveHome = api;
  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', mount);
    else mount();
  }
})(typeof window !== 'undefined' ? window : this);
