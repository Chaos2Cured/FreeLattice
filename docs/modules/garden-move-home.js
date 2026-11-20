/* FreeLattice: Garden move kit 2, bring my garden home (window.FLGardenMoveHome)
   Marker: v-garden-move-kit-2
   MIT. Layer, never delete. Kirk 2026-11-20: a garden packed with move.html (v-garden-move-kit-1)
   comes home on a new device, kindly and safely. The rules themselves live in garden-move-merge.js.

   The promise, in order:
   1. Read the file and check every part against its fingerprint (sha256 over key-sorted JSON, the same
      as lattice-export.js). A part that does not match is left out. The family archive's own seal is
      checked again and shown as it is. Fingerprints show the file was not damaged; they cannot show who
      made it, so nothing in any file can bring trust, ids or Lattice Points in. Nothing is written while you look.
   2. Show, in plain words, what will arrive, what is already here, and what differs.
   3. Only after a person taps Bring it home: a full safety copy of this browser's garden is made (the same
      file format, checked), kept in FreeLatticeMoveKit/before, read back and checked again, and offered as
      a download. If it cannot be kept and checked, nothing is brought home.
   4. Write-ahead: before the first write, the whole list of what will be written (every row, and every key
      with the value it has now) is saved in FreeLatticeMoveKit/imports. So Undo knows everything, even if
      the browser stops part-way. If anything fails part-way, everything that arrived is taken back at once.
   5. Merge, never overwrite. New things are added. Where both sides have something different, yours stays
      and the arriving copy is saved aside in FreeLatticeMoveKit/conflicts. Ledgers are joined entry by entry.
      Only keys on the arrival allow-list go live; any other key is saved aside, never used.
   6. Trust starts at Seed and is never raised by a move: fl_firstSeen, the trust counters, the chain of
      moments, the wallet, device, mesh and kin ids are never written. A line "Arrived from <tier> (<N>%)"
      is added to fl_move_arrivals and stays visible. If trust would read higher after the move, it is undone.
   7. Pause always wins: if either side is paused, the result is paused, and Undo never unpauses.
   8. Clay is carried byte-for-byte and never merged. Sealed chats arrive still locked. No keys come in.
   9. Undo takes back exactly what arrived, then checks. It says "as it was before" only when that is true;
      otherwise it lists what is left and why.
   Parts this browser has not opened yet (no database here) are saved aside, never forced in.
*/
(function (root) {
  'use strict';

  var VERSION = 'v-garden-move-kit-2';
  var HOME_DB = 'FreeLatticeMoveKit';
  var HOME_DB_V = 1;

  function K() {
    var k = root.FLGardenMoveKit && root.FLGardenMoveKit._internal;
    if (!k || !k.containsSecret) throw new Error('garden-move-kit.js is needed first');
    return k;
  }
  function M() {
    var m = root.FLGardenMoveMerge;
    if (!m || !m.lsDecision) throw new Error('garden-move-merge.js is needed first');
    return m;
  }

  function lsGet(k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { root.localStorage.setItem(k, v); }
  function lsRemove(k) { root.localStorage.removeItem(k); }

  // Set a property without ever touching a prototype (Hypha soft S-b).
  function setOwn(o, k, v) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true });
    else o[k] = v;
  }

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
    if (Object.prototype.hasOwnProperty.call(v, '$t') && typeof v.$t === 'string') {
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
    Object.keys(v).forEach(function (k) { setOwn(o, k, decode(v[k], flags, depth + 1)); });
    return o;
  }

  // No keys come in: a field named like a key with a key-like value, or a known key shape in any text,
  // becomes "[kept on this device]" (the same words the packer uses). Works on the file's JSON-safe form.
  function scrubRow(v, counter, depth) {
    var I = K();
    depth = depth || 0;
    if (typeof v === 'string') {
      var h = M().hideKnownKeys(v, I.KEPT_LINE);
      counter.n += h.n;
      return h.text;
    }
    if (!v || typeof v !== 'object' || depth > 70) return v;
    if (Array.isArray(v)) return v.map(function (x) { return scrubRow(x, counter, depth + 1); });
    var o = {};
    var tagged = Object.prototype.hasOwnProperty.call(v, '$t') && typeof v.$t === 'string';
    Object.keys(v).forEach(function (k) {
      if (tagged && k === 'b64') { setOwn(o, k, v[k]); return; }
      if (I.secretFieldValue(k, v[k])) { counter.n += 1; setOwn(o, k, I.KEPT_LINE); return; }
      setOwn(o, k, scrubRow(v[k], counter, depth + 1));
    });
    return o;
  }

  function pathGet(obj, path) {
    var parts = String(path).split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null || typeof cur !== 'object' || !Object.prototype.hasOwnProperty.call(cur, parts[i])) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }
  function keyOf(row, keyPath) {
    if (keyPath === null || keyPath === undefined) return row && Object.prototype.hasOwnProperty.call(row, 'k') ? row.k : undefined;
    if (Array.isArray(keyPath)) {
      var ks = keyPath.map(function (p) { return pathGet(row, p); });
      return ks.some(function (x) { return x === undefined; }) ? undefined : ks;
    }
    return pathGet(row, keyPath);
  }

  // This device's own saved keys, so a same-browser pack and bring-home does not count a hidden key as a difference.
  function localSecrets() {
    var I = K();
    var out = [];
    I.lsKeys().forEach(function (k) {
      if (!I.isSecretName(k)) return;
      var v = lsGet(k);
      if (I.huntable(k, v)) out.push(String(v).trim());
    });
    return out;
  }
  function hideLocal(v, secrets) {
    if (!secrets.length) return null;
    var c = { n: 0 };
    var out = K().hideSecretLeaves(v, secrets, c);
    return c.n ? out : null;
  }

  // ── Read and check a file. Nothing is written. ──
  function readKit(text) {
    var I = K(), R = M();
    var out = { ok: false, problems: [], sections: Object.create(null), names: [], refused: [], index_ok: false, seal: null, seal_claim: null };
    var kit;
    try { kit = JSON.parse(text); } catch (e) { out.problems.push('This file does not read as a garden file.'); return Promise.resolve(out); }
    if (!kit || typeof kit !== 'object' || kit.kind !== root.FLGardenMoveKit.KIND) { out.problems.push('This is not a garden file from Pack my garden.'); return Promise.resolve(out); }
    if (kit.locked) { out.problems.push('This file is locked with a passphrase. Opening locked files comes in the next step.'); return Promise.resolve(out); }
    if (kit.v !== I.FORMAT_V) { out.problems.push('This garden file is from a newer version (' + String(kit.v) + '). Nothing was changed.'); return Promise.resolve(out); }
    if (!I.noPrivateRoomMarks(text)) { out.problems.push('This file holds a private room name, so it was not opened.'); return Promise.resolve(out); }
    out.kit = kit;
    var sections = kit.sections && typeof kit.sections === 'object' ? kit.sections : {};
    var index = (kit.manifest && kit.manifest.sections && typeof kit.manifest.sections === 'object') ? kit.manifest.sections : {};
    Object.keys(sections).forEach(function (n) { if (R.isUnsafeName(n)) out.refused.push(n); });
    var names = R.ownKeys(sections);
    R.ownKeys(index).forEach(function (n) { if (names.indexOf(n) === -1) out.sections[n] = { ok: false, why: 'missing' }; });
    out.names = names;
    var jobs = names.map(function (n) {
      var sec = sections[n] || {};
      if (I.isPrivateName(n)) { out.sections[n] = { ok: false, why: 'private' }; return Promise.resolve(); }
      return I.sha256(I.canonicalize(sec.data)).then(function (hex) {
        var ok = hex === sec.sha256 && R.own(index, n) && hex === index[n];
        out.sections[n] = { ok: ok, why: ok ? 'matches' : 'does-not-match' };
      });
    });
    return Promise.all(jobs).then(function () {
      return I.sha256(I.canonicalize(index)).then(function (ih) { out.index_ok = ih === (kit.manifest && kit.manifest.index_sha256); });
    }).then(function () {
      out.seal_claim = typeof kit.archive_seal === 'string' ? kit.archive_seal : 'not-packed';
      var arcSec = R.own(sections, 'archive') ? sections.archive : null;
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

  function readLocalStore(db, storeName) {
    var I = K();
    return I.readStore(db, storeName).then(function (res) {
      var stats = { secretFields: {}, keysStayed: 0 };
      return I.jsonSafe(res.rows || [], stats).then(function (rows) { return { schema: res.schema, rows: rows, error: res.error }; });
    });
  }
  function knownDbs() {
    var I = K();
    var list = [];
    Object.keys(I.DB_SECTIONS).forEach(function (s) { I.DB_SECTIONS[s].forEach(function (n) { list.push(n); }); });
    return list;
  }

  // The plan: for every part, what would happen. Read-only (databases are opened without creating any).
  function planHome(read) {
    var I = K(), R = M();
    var kit = read.kit;
    var secrets = localSecrets();
    var plan = { sections: Object.create(null), ls: [], idb: [], aside: [], refused: read.refused.slice(),
      skipped: { key: 0, trust: 0, private: 0, identity: 0, holdsKey: 0, clayHoldsKey: [], unsafe: 0 },
      totals: { add: 0, same: 0, conflict: 0, aside: 0, waiting: 0, badHash: 0, scrubbed: 0 }, sealed: 0, secrets: secrets };
    function secPlan(n) { if (!plan.sections[n]) plan.sections[n] = { add: 0, same: 0, conflict: 0, aside: 0, waiting: 0, how: 'merge' }; return plan.sections[n]; }
    var jobs = Promise.resolve();
    read.names.forEach(function (n) {
      var sec = kit.sections[n] || {};
      var data = sec.data && typeof sec.data === 'object' ? sec.data : {};
      var sp = secPlan(n);
      if (!read.sections[n] || !read.sections[n].ok) { sp.how = 'bad-hash'; plan.totals.badHash += 1; return; }
      var how = R.sectionDisposition(n, !!data.builder);
      sp.how = how;
      if (how === 'note' || how === 'stays-in-file' || how === 'refuse') return;
      if (how === 'aside') {
        plan.aside.push({ section: n, why: data.builder || I.SECTION_ORDER.indexOf(n) === -1 ? 'not-known-here' : 'keeps-trust-honest', data: data });
        sp.aside += 1; plan.totals.aside += 1;
        return;
      }
      plan.sealed += I.countSealed(data);
      var ls = data.ls && typeof data.ls === 'object' ? data.ls : {};
      Object.keys(ls).sort().forEach(function (k) {
        if (R.isUnsafeName(k)) { plan.skipped.unsafe += 1; return; }
        var v = ls[k];
        var local = lsGet(k);
        var flags = { private: I.isPrivateName(k) || I.hasPrivateMark(v), secret: I.isSecretName(k) };
        if (I.TRUST_KEYS.indexOf(k) !== -1) { plan.skipped.trust += 1; return; }
        var localHidden = local === null ? null : hideLocal(local, secrets);
        var d = R.lsDecision({ key: k, incoming: v, local: local, flags: flags, localHidden: localHidden });
        d.key = k; d.incoming = v; d.fromSection = n;
        if (d.act === 'skip') {
          if (d.why === 'key') plan.skipped.key += 1;
          else if (d.why === 'trust-or-device') plan.skipped.trust += 1;
          else if (d.why === 'private') plan.skipped.private += 1;
          else if (d.why === 'identity') plan.skipped.identity += 1;
          else if (d.why === 'unsafe-name') plan.skipped.unsafe += 1;
          else if (d.why === 'clay-holds-key') plan.skipped.clayHoldsKey.push(k);
          else plan.skipped.holdsKey += 1;
          return;
        }
        if (d.act === 'aside') {
          plan.aside.push({ section: n, why: d.why === 'wallet' ? 'keeps-trust-honest' : 'not-known-here', ls: k, value: v });
          sp.aside += 1; plan.totals.aside += 1; return;
        }
        plan.ls.push(d);
        var bucket = d.act === 'ledger' ? 'add' : d.act;
        sp[bucket] += 1; plan.totals[bucket] += 1;
      });
      var idb = data.idb && typeof data.idb === 'object' ? data.idb : {};
      R.ownKeys(idb).sort().forEach(function (dbName) {
        var dbData = idb[dbName] || {};
        jobs = jobs.then(function () { return planDb(n, dbName, dbData, plan, sp); });
      });
    });
    return jobs.then(function () { return plan; });
  }

  function planDb(section, dbName, dbData, plan, sp) {
    var I = K(), R = M();
    if (I.isPrivateName(dbName)) { plan.skipped.private += 1; return Promise.resolve(); }
    var how = R.dbDisposition(dbName, knownDbs());
    if (how !== 'merge') {
      if (how === 'aside') { plan.aside.push({ section: section, why: 'keeps-trust-honest', db: dbName, data: dbData }); sp.aside += 1; plan.totals.aside += 1; }
      return Promise.resolve();
    }
    return I.openExisting(dbName).then(function (db) {
      var stores = dbData.stores && typeof dbData.stores === 'object' ? dbData.stores : {};
      var chain = Promise.resolve();
      R.ownKeys(stores).sort().forEach(function (storeName) {
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
            var have = Object.create(null), haveHidden = Object.create(null);
            (local.rows || []).forEach(function (r) {
              var kc = I.canonicalize(keyOf(r, kp));
              have[kc] = I.canonicalize(r);
              var hidden = hideLocal(r, plan.secrets);
              if (hidden) haveHidden[kc] = I.canonicalize(hidden);
            });
            var item = { section: section, db: dbName, store: storeName, keyPath: kp, adds: [], conflicts: [], same: 0, waiting: [] };
            if (I.canonicalize(kp) !== I.canonicalize(incKp)) {
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
              var kc = I.canonicalize(k === undefined ? null : k);
              var rc = I.canonicalize(clean);
              var dec = R.rowDecision({ hasKey: k !== undefined, rowCanon: rc, localCanon: have[kc] === undefined ? null : have[kc], localHiddenCanon: haveHidden[kc] || null });
              if (dec === 'aside') { item.waiting.push(clean); return; }
              if (dec === 'same') { item.same += 1; return; }
              if (dec === 'conflict') { item.conflicts.push({ key: k, row: clean }); return; }
              item.adds.push({ key: k, row: clean, canon: rc });
              have[kc] = rc;
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
      var tx;
      try { tx = db.transaction(store, 'readwrite'); } catch (e) { reject(e); return; }
      var key;
      try {
        var r = tx.objectStore(store).put(value);
        r.onsuccess = function () { key = r.result; };
      } catch (e) { reject(e); return; }
      tx.oncomplete = function () { resolve(key); };
      tx.onerror = function () { reject(tx.error); };
      tx.onabort = function () { reject(tx.error || new Error('aborted')); };
    });
  }
  function homeGet(db, store, key) {
    return new Promise(function (resolve) {
      if (!db || !db.objectStoreNames.contains(store)) { resolve(undefined); return; }
      var r = db.transaction(store, 'readonly').objectStore(store).get(key);
      r.onsuccess = function () { resolve(r.result); };
      r.onerror = function () { resolve(undefined); };
    });
  }
  function homeAll(db, store) {
    return new Promise(function (resolve) {
      if (!db || !db.objectStoreNames.contains(store)) { resolve([]); return; }
      var r = db.transaction(store, 'readonly').objectStore(store).getAll();
      r.onsuccess = function () { resolve(r.result || []); };
      r.onerror = function () { resolve([]); };
    });
  }
  function homeDeleteByImport(db, store, importId) {
    return new Promise(function (resolve) {
      var tx = db.transaction(store, 'readwrite');
      var cur = tx.objectStore(store).index('importId').openCursor(IDBKeyRange.only(importId));
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
    var I = K(), R = M();
    return Promise.all([readDbOut('LatticeChain', ['chain']), readDbOut('FreeLatticeWallet', ['LatticeLedger'])]).then(function (dbs) {
      return I.trustNote(now, dbs[0], dbs[1]);
    }).then(function (t) {
      var bytes = {};
      I.TRUST_KEYS.concat(R.TRUST_KEYS).forEach(function (k) { bytes[k] = lsGet(k); });
      return { tier: t.tier, percent: t.percent, rank: RANK.indexOf(t.tier), bytes: bytes };
    });
  }

  // ── Writing rows (add only) ──
  function addRows(item) {
    var I = K();
    return I.openExisting(item.db).then(function (db) {
      if (!db || !db.objectStoreNames.contains(item.store)) { if (db) db.close(); return { ok: item.adds.map(function () { return false; }), raced: item.adds.slice() }; }
      return new Promise(function (resolve, reject) {
        var ok = item.adds.map(function () { return false; }), raced = [];
        var tx;
        try { tx = db.transaction(item.store, 'readwrite'); } catch (e) { db.close(); reject(e); return; }
        var st = tx.objectStore(item.store);
        var failure = null;
        item.adds.forEach(function (a, i) {
          if (failure) return;
          var flags = {};
          var val = decode(a.row, flags);
          var req;
          try {
            req = item.keyPath === null ? st.add(val.v, decode(a.row.k, flags)) : st.add(val);
          } catch (e) {
            // before (29663dce): } catch (e) { raced.push(a); return; }   (a refused add was counted as "already here")
            // Hypha walk of #367: a row this store will not take (full disk, bad key) stops the whole bring-home,
            // so it is taken back and said plainly, never reported as arrived.
            failure = e; try { tx.abort(); } catch (_) {} return;
          }
          req.onsuccess = function () { ok[i] = true; };
          req.onerror = function (e) {
            var name = req.error && req.error.name;
            if (name === 'ConstraintError') { try { e.preventDefault(); e.stopPropagation(); } catch (_) {} raced.push(a); }
          };
        });
        tx.oncomplete = function () { try { db.close(); } catch (_) {} resolve({ ok: ok, raced: raced }); };
        tx.onabort = function () { try { db.close(); } catch (_) {} reject(failure || tx.error || new Error('rows could not be added')); };
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
    var a = M().parseArray(lsGet(M().ARRIVALS_KEY));
    return a ? a.filter(function (x) { return x && typeof x === 'object'; }) : [];
  }

  function bringHome(text, opts) {
    opts = opts || {};
    var I = K(), R = M();
    var now = opts.now || Date.now();
    var importId = 'home-' + now + '-' + Math.random().toString(36).slice(2, 8);
    var result = { ok: false, importId: importId, steps: [] };
    var read, plan, trustBefore, home, record, backupText, writing = false;
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
      if (!b || !b.ok || !b.blob) {
        result.problems = ['A safety copy of this browser\u2019s garden could not be made' + (b && b.check && b.check.problems ? ' (' + b.check.problems.join('; ') + ')' : '') + ', so nothing was brought home'];
        throw { stop: true };
      }
      return b.blob.text().then(function (t) { backupText = t; result.backup = { name: backupName(now), bytes: b.bytes }; });
    }).then(function () {
      return openHome(true);
    }).then(function (db) {
      home = db;
      // 2. Keep the safety copy here, read it back and check it. Hypha soft S-a: no verified copy, no bring-home.
      var at = new Date(now).toISOString();
      return homePut(home, 'before', { id: importId, at: at, name: result.backup.name, text: backupText })
        .then(function () { return homeGet(home, 'before', importId); })
        .then(function (back) {
          if (!back || back.text !== backupText) throw new Error('read back differs');
          return Promise.all([I.sha256(back.text), I.sha256(backupText)]);
        })
        .then(function (h) {
          if (h[0] !== h[1]) throw new Error('read back differs');
          result.backup.kept_here = true; result.backup.sha256 = h[0];
          result.steps.push('backup-kept-and-checked');
        }, function () {
          result.problems = ['A safety copy could not be kept and checked on this device, so nothing was brought home. Your garden is unchanged'];
          throw { stop: true };
        });
    }).then(function () {
      if (opts.download !== false) {
        try { downloadText(backupText, result.backup.name); result.backup.offered = true; } catch (e) { result.backup.offered = false; }
      }
      // 3. Write-ahead: every planned write, with today's value, is saved before the first one.
      var lsPlan = plan.ls.filter(function (d) { return d.act === 'add' || d.act === 'ledger'; }).map(function (d) {
        return { k: d.key, before: lsGet(d.key), after: d.value, section: d.section };
      });
      var rowsPlan = [];
      plan.idb.forEach(function (item) {
        item.adds.forEach(function (a) { rowsPlan.push({ db: item.db, store: item.store, key: a.key, canon: a.canon, state: 'planned' }); });
      });
      record = { id: importId, at: new Date(now).toISOString(), status: 'writing', v: VERSION,
        pack_sha: (read.kit.manifest || {}).index_sha256 || null, from: read.kit.from || null, line: R.arrivalLine(read.kit.trust_note),
        ls_plan: lsPlan, rows_plan: rowsPlan, pause_set: false, conflicts: 0, aside: 0, backup_sha256: result.backup.sha256 };
      return homePut(home, 'imports', record).then(function () { writing = true; result.steps.push('write-ahead'); });
    }).then(function () {
      // 4. IndexedDB rows: add what is new; differing rows are saved aside as conflicts.
      var jobs = Promise.resolve();
      var offset = 0;
      plan.idb.forEach(function (item) {
        var start = offset; offset += item.adds.length;
        jobs = jobs.then(function () {
          return addRows(item).then(function (res) {
            res.ok.forEach(function (ok, i) { record.rows_plan[start + i].state = ok ? 'added' : 'not-added'; });
            var confl = item.conflicts.concat(res.raced.map(function (x) { return { key: x.key, row: x.row }; }));
            var c = Promise.resolve();
            confl.forEach(function (x) {
              c = c.then(function () {
                return homePut(home, 'conflicts', { importId: importId, at: record.at, section: item.section, db: item.db, store: item.store,
                  key: x.key === undefined ? null : x.key, arriving: x.row, kept: 'this device' });
              }).then(function () { record.conflicts += 1; });
            });
            return c;
          }).then(function () { return homePut(home, 'imports', record); });
        });
      });
      return jobs;
    }).then(function () {
      // 5. localStorage, in the write-ahead order. A key that changed since the plan is not touched.
      var c = Promise.resolve();
      record.ls_plan.forEach(function (e) {
        c = c.then(function () {
          if (lsGet(e.k) !== e.before) { e.skipped = 'changed-before-write'; return; }
          lsSet(e.k, e.after);
          e.done = true;
        });
      });
      plan.ls.filter(function (d) { return d.act === 'conflict'; }).forEach(function (d) {
        c = c.then(function () {
          return homePut(home, 'conflicts', { importId: importId, at: record.at, section: d.section, ls: d.key,
            arriving: d.incoming, kept: 'this device', clay: !!d.clay }).then(function () { record.conflicts += 1; });
        });
      });
      return c.then(function () { return homePut(home, 'imports', record); });
    }).then(function () {
      // 6. Parts kept aside (wallet, chain, identity, unknown keys and parts, parts this browser has not opened yet).
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
      // 7. Pause always wins (recorded before it is written).
      var localPaused = lsGet(R.PAUSE_KEY) === 'true';
      if (R.pauseAfter(localPaused, read.kit.consent && read.kit.consent.paused) && !localPaused) {
        record.pause_set = true;
        return homePut(home, 'imports', record).then(function () { lsSet(R.PAUSE_KEY, 'true'); });
      }
    }).then(function () {
      // 8. The arrival note, append-only.
      var list = readArrivals();
      var t = read.kit.trust_note || {};
      list.push({ arrived_at: record.at, from_origin: (read.kit.from && typeof read.kit.from.origin === 'string') ? read.kit.from.origin.slice(0, 200) : null,
        tier_then: /^[A-Za-z]{2,12}$/.test(String(t.tier)) ? t.tier : null,
        score_then: isFinite(t.percent) ? Number(t.percent) : null, days_then: isFinite(t.days_together) ? Number(t.days_together) : null,
        pack_sha: record.pack_sha, line: record.line, import_id: importId, note: 'Trust here starts at Seed. A move never raises it.' });
      lsSet(R.ARRIVALS_KEY, JSON.stringify(list));
      record.status = 'done';
      return homePut(home, 'imports', record);
    }).then(function () {
      return trustHere(now);
    }).then(function (after) {
      result.trust = { before: trustBefore, after: after };
      if (R.trustRose(trustBefore, after)) {
        return closeHome().then(function () { return undoImport(importId, { reason: 'trust-would-rise' }); }).then(function (u) {
          result.problems = ['Trust would have read higher after the move, so it was taken back at once.' + (u.verified ? ' Nothing stayed.' : ' ' + leftWords(u))];
          result.undo = u;
          throw { stop: true };
        });
      }
      result.ok = true;
      var added = record.rows_plan.filter(function (x) { return x.state === 'added'; }).length;
      var setN = record.ls_plan.filter(function (x) { return x.done; }).length;
      result.record = { id: record.id, added: added, ls_set: setN, conflicts: record.conflicts, aside: record.aside, pause_set: record.pause_set, line: record.line };
      result.plan = summarize(plan);
      result.read = { index_ok: read.index_ok, seal: read.seal, seal_claim: read.seal_claim };
      return closeHome().then(function () { return result; });
    }).then(null, function (err) {
      return closeHome().then(function () {
        if (err && err.stop) return result;
        var why = String((err && (err.name === 'QuotaExceededError' ? 'this browser is out of room' : err.message)) || err).slice(0, 160);
        if (!writing) {
          result.problems = ['Something got in the way before anything was written (' + why + '). Your garden is unchanged'];
          return result;
        }
        // H1: a failure part-way. Take back everything that arrived, then say what is true.
        return undoImport(importId, { reason: 'write-failed' }).then(function (u) {
          result.undo = u;
          result.problems = ['Something got in the way part-way (' + why + '), so what had arrived was taken back.' +
            (u.verified ? ' Your garden is as it was before.' : ' ' + leftWords(u))];
          return result;
        });
      });
    });
    function closeHome() { if (home) { try { home.close(); } catch (_) {} home = null; } return Promise.resolve(); }
  }

  // ── Undo: take back exactly what that bring-home wrote, then check. Pause stays (pause always wins). ──
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
  function readRowCanons(list) {
    // list: entries with db, store, key. Returns canonical JSON of what is there now, or null.
    var I = K();
    return I.openExisting(list[0].db).then(function (db) {
      if (!db || !db.objectStoreNames.contains(list[0].store)) { if (db) db.close(); return { db: null, canons: list.map(function () { return null; }) }; }
      var keys = list.map(function (a) { var f = {}; return decode(a.key, f); });
      return new Promise(function (resolve) {
        var tx = db.transaction(list[0].store, 'readonly');
        var st = tx.objectStore(list[0].store);
        var kp = st.keyPath;
        var vals = new Array(list.length);
        keys.forEach(function (k, i) { try { var r = st.get(k); r.onsuccess = function () { vals[i] = r.result; }; } catch (e) { vals[i] = undefined; } });
        tx.oncomplete = function () { resolve({ vals: vals, kp: kp }); };
        tx.onerror = function () { resolve({ vals: vals, kp: kp }); };
      }).then(function (got) {
        var stats = { secretFields: {}, keysStayed: 0 };
        return Promise.all(got.vals.map(function (v, i) {
          if (v === undefined) return Promise.resolve(null);
          var wrapped = got.kp === null ? { k: keys[i], v: v } : v;
          return I.jsonSafe(wrapped, stats).then(function (enc) { return I.canonicalize(enc); });
        })).then(function (canons) { return { db: db, keys: keys, canons: canons }; });
      });
    });
  }
  function undoImport(importId, opts) {
    opts = opts || {};
    var R = M();
    var out = { removed: 0, keptChanged: 0, lsRestored: 0, lsKeptChanged: 0, conflictsCleared: 0, asideCleared: 0, left: [], verified: false };
    var home, record, rowsPlan, lsPlan;
    return openHome(false).then(function (db) {
      home = db;
      if (!home) throw new Error('nothing to undo');
      return homeGet(home, 'imports', importId);
    }).then(function (rec) {
      record = rec;
      if (!record || record.undone_at) throw new Error('nothing to undo');
      // Older records (29663dce) kept added/ls_set; read them too.
      rowsPlan = (record.rows_plan || []).concat((record.added || []).map(function (a) { return { db: a.db, store: a.store, key: a.key, canon: a.canon, state: a.auto ? 'auto' : 'added' }; }));
      lsPlan = (record.ls_plan || []).concat((record.ls_set || []).map(function (x) { return { k: x.k, before: x.before, after: x.after }; }));
      var groups = Object.create(null);
      rowsPlan.forEach(function (a) { var g = a.db + '\u0000' + a.store; (groups[g] = groups[g] || []).push(a); });
      var jobs = Promise.resolve();
      Object.keys(groups).forEach(function (g) {
        var list = groups[g];
        jobs = jobs.then(function () {
          return readRowCanons(list).then(function (now) {
            if (!now.db) return;
            var steps = list.map(function (e, i) {
              if (e.state === 'auto') return 'keep-changed';   // Hypha soft S-c: a row whose key this browser chose is never guessed at
              return R.undoRowStep(e, now.canons[i]);
            });
            return new Promise(function (resolve) {
              var tx = now.db.transaction(list[0].store, 'readwrite');
              var st = tx.objectStore(list[0].store);
              steps.forEach(function (s, i) {
                if (s === 'delete') { st.delete(now.keys[i]); out.removed += 1; }
                else if (s === 'keep-changed') { out.keptChanged += 1; list[i].kept = true; }
              });
              tx.oncomplete = function () { try { now.db.close(); } catch (_) {} resolve(); };
              tx.onerror = function () { try { now.db.close(); } catch (_) {} resolve(); };
            });
          });
        });
      });
      return jobs;
    }).then(function () {
      lsPlan.slice().reverse().forEach(function (x) {
        var s = R.undoLsStep(x, lsGet(x.k));
        try {
          if (s === 'remove') { lsRemove(x.k); out.lsRestored += 1; }
          else if (s === 'restore') { lsSet(x.k, x.before); out.lsRestored += 1; }
          else if (s === 'keep-changed') { out.lsKeptChanged += 1; x.kept = true; }
        } catch (e) { x.failed = true; }
      });
      return homeDeleteByImport(home, 'conflicts', importId);
    }).then(function (n) {
      out.conflictsCleared = n;
      return homeDeleteByImport(home, 'aside', importId);
    }).then(function (n) {
      out.asideCleared = n;
      // Check: is everything really back?
      var groups = Object.create(null);
      rowsPlan.forEach(function (a) { if (a.state !== 'not-added') { var g = a.db + '\u0000' + a.store; (groups[g] = groups[g] || []).push(a); } });
      var rowsNow = [];
      var jobs = Promise.resolve();
      Object.keys(groups).forEach(function (g) {
        var list = groups[g];
        jobs = jobs.then(function () {
          return readRowCanons(list).then(function (now) {
            if (now.db) try { now.db.close(); } catch (_) {}
            list.forEach(function (e, i) {
              var there = now.canons[i] !== null && (e.state !== 'planned' || now.canons[i] === e.canon || e.kept);
              rowsNow.push({ where: e.db + ' / ' + e.store, key: e.key, there: there, kept: !!e.kept });
            });
          });
        });
      });
      return jobs.then(function () {
        var lsNow = lsPlan.map(function (x) { return { k: x.k, before: x.before === undefined ? null : x.before, now: lsGet(x.k), kept: !!x.kept }; });
        var v = R.verifyUndo(lsNow, rowsNow);
        out.verified = v.clean; out.left = v.left;
        // Something left that is not yours (a write that failed again): keep the record open so Undo can try again.
        out.canRetry = v.left.some(function (x) { return !x.changed; });
      });
    }).then(function () {
      if (out.canRetry) {
        record.undo_tries = (record.undo_tries || 0) + 1;
        record.last_undo = out;
        if (opts.reason) record.undo_reason = opts.reason;
        return homePut(home, 'imports', record).then(function () {
          out.pauseKept = !!record.pause_set; out.ok = true;
          try { home.close(); } catch (_) {}
          return out;
        });
      }
      record.undone_at = new Date().toISOString();
      record.undo = out;
      if (opts.reason) record.undo_reason = opts.reason;
      return homePut(home, 'imports', record).then(function () { return null; });
    }).then(function (done) {
      if (done) return done;   // the record stays open for another try
      // The arrival note stays (it is a history), marked as taken back.
      var list = readArrivals();
      var changed = false;
      list.forEach(function (x) { if (x.import_id === importId && !x.undone_at) { x.undone_at = record.undone_at; changed = true; } });
      if (changed) try { lsSet(R.ARRIVALS_KEY, JSON.stringify(list)); } catch (e) { out.noteNotMarked = true; }
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
  function leftWords(u) {
    var left = (u && u.left) || [];
    if (!left.length) return '';
    var mine = left.filter(function (x) { return x.changed; }).map(function (x) { return x.where + (x.key !== undefined && x.key !== null ? ' (' + JSON.stringify(x.key) + ')' : ''); });
    var other = left.filter(function (x) { return !x.changed; }).map(function (x) { return x.where + (x.key !== undefined && x.key !== null ? ' (' + JSON.stringify(x.key) + ')' : ''); });
    var s = [];
    if (mine.length) s.push(plural(mine.length, 'thing was', 'things were') + ' changed after arriving, so ' + (mine.length === 1 ? 'it stays' : 'they stay') + ': ' + mine.join(', ') + '.');
    if (other.length) s.push(plural(other.length, 'thing could', 'things could') + ' not be taken back yet: ' + other.join(', ') + '. Tap Undo again to try once more. The safety copy still holds how it was.');
    return s.join(' ');
  }

  function listStore(store) {
    return openHome(false).then(function (db) {
      if (!db) return [];
      return homeAll(db, store).then(function (rows) { try { db.close(); } catch (_) {} return rows; });
    });
  }

  // Counts for the page and for tests.
  function summarize(plan) {
    var sections = {};
    Object.keys(plan.sections).forEach(function (n) { sections[n] = plan.sections[n]; });
    return { totals: plan.totals, skipped: plan.skipped, sealed: plan.sealed, refused: plan.refused, sections: sections };
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
    if (n === 'trust') return M().arrivalLine(kit.trust_note) + '. Trust here starts fresh at Seed and grows with your time together. A move never raises it.';
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
    if (plan.refused.length) w.push(plural(plan.refused.length, 'part has a name', 'parts have names') + ' this page never uses, so ' + (plan.refused.length === 1 ? 'it is' : 'they are') + ' left out.');
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
    try { var d = new Date(iso); if (isNaN(d.getTime())) return 'an unknown day'; return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return 'an unknown day'; }
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
      ul.appendChild(el('li', null, String(a.line || 'Arrived') + ' on ' + dateWords(a.arrived_at) + (a.undone_at ? ' (taken back)' : '') + '. Trust here started at Seed.'));
    });
    host.appendChild(ul);
  }
  function renderPreview(host, notesHost, pv) {
    var I = K();
    host.textContent = ''; notesHost.textContent = '';
    var read = pv.read, plan = pv.plan, kit = read.kit;
    host.appendChild(el('p', 'gmh-from', 'Packed ' + dateWords(kit.made_at) + (kit.from && typeof kit.from.origin === 'string' ? ' at ' + kit.from.origin.replace(/^https?:\/\//, '').slice(0, 80) : '') + '.'));
    var bad = Object.keys(read.sections).filter(function (n) { return !read.sections[n].ok; });
    host.appendChild(el('p', bad.length ? 'gmh-check gmh-warn' : 'gmh-check gmh-ok', bad.length ?
      plural(bad.length, 'part does not match', 'parts do not match') + ' and will be left out. Everything else checks out.' :
      'Every part of the file checks out.'));
    // Hypha soft S-e: say what a fingerprint can and cannot show.
    host.appendChild(el('p', 'gmh-from', 'The fingerprints show the file was not damaged on the way. They cannot show who made it, so trust, ids and Lattice Points never come in from any file.'));
    var ul = el('ul', 'gmk-list');
    var names = Object.keys(plan.sections);
    var order = I.SECTION_ORDER.filter(function (n) { return names.indexOf(n) !== -1; })
      .concat(names.filter(function (n) { return I.SECTION_ORDER.indexOf(n) === -1; }).sort());
    order.forEach(function (n) {
      var li = el('li', 'gmk-row gmk-' + n.replace(/[^a-z0-9-]/gi, '-'));
      var label = kit.sections[n] && typeof kit.sections[n].label === 'string' ? kit.sections[n].label : (I.LABELS[n] || n);
      li.appendChild(el('span', 'gmk-label', label.slice(0, 120)));
      li.appendChild(el('span', 'gmk-words', sectionWords(n, plan.sections[n], read)));
      ul.appendChild(li);
    });
    host.appendChild(ul);
    var stay = el('div', 'gmk-stay');
    stay.appendChild(el('h2', null, 'What does not come in'));
    var lines = ['Keys, passwords and tokens never come in' + (plan.skipped.key ? ' (' + plural(plan.skipped.key, 'name', 'names') + ' left out)' : '') + '.',
      'Trust numbers never come in. Trust here starts at Seed.',
      'The other device\u2019s ids never come in: device, mesh and kin ids stay in the file' + (plan.skipped.identity ? ' (' + plan.skipped.identity + ' left out)' : '') + '.',
      'Settings this page does not know are saved aside on this device, not used.'];
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
      status.textContent = 'First a safety copy of this garden is made and checked. Then your garden comes home\u2026';
      bringHome(text, {}).then(function (r) {
        if (r.ok) {
          status.className = 'gmk-status gmk-ok';
          status.textContent = 'Welcome home. ' + plural(r.record.added + r.record.ls_set, 'thing arrived', 'things arrived') + '.' +
            (r.record.conflicts ? ' ' + plural(r.record.conflicts, 'thing differed: yours stayed, and the arriving one is', 'things differed: yours stayed, and the arriving ones are') + ' saved aside.' : '') +
            ' ' + r.record.line + '. Trust here starts at Seed.' +
            ' A checked safety copy is kept on this device' + (r.backup.offered ? ' and was offered to your downloads as ' + r.backup.name : '') + '. If anything feels wrong, tap Undo.';
          renderArrivals(arrivals);
        } else {
          status.className = 'gmk-status gmk-warn';
          status.textContent = (r.problems || ['Something got in the way']).join(' ') + '.';
          btn.disabled = false;
          renderArrivals(arrivals);
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
          status.className = u.verified ? 'gmk-status gmk-ok' : 'gmk-status gmk-warn';
          // H1: "as it was before" only when the check says so.
          status.textContent = (u.verified ? 'Taken back. Your garden is as it was before.' : 'Taken back, except for this. ' + leftWords(u)) +
            (u.pauseKept ? ' The AI stays paused, because pause always wins.' : '') + (u.canRetry ? '' : ' The arrival note stays, marked as taken back.');
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
    _internal: { decode: decode, scrubRow: scrubRow, keyOf: keyOf, notesOf: notesOf, leftWords: leftWords, HOME_DB: HOME_DB }
  };
  root.FLGardenMoveHome = api;
  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', mount);
    else mount();
  }
})(typeof window !== 'undefined' ? window : this);
