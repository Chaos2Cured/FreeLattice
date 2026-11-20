/* FreeLattice: Garden move kit 1, pack and preview (window.FLGardenMoveKit)
   Marker: v-garden-move-kit-1
   MIT. Layer, never delete. Kirk 2026-11-20 (t1415u): people lost their garden when they
   tried the desktop, so packing a whole mind's work into one file has to be easy and safe.

   What this brick does: it READS this browser's garden and makes one file you can keep.
   It never writes to the garden. No put, add, delete, clear or setItem on any store or key.
   A database that does not exist is never created: opening one that is missing is aborted.
   It sends nothing anywhere. The file is saved on this device by the person who taps the button.

   It is a handle on the existing doorway, docs/modules/lattice-export.js (window.LatticeExport).
   Its full archive goes inside the kit as the exact text it makes, never edited. If a saved key is
   inside it, the archive stays home and the preview says so. Its own seal is checked and shown.

   Kept on this device, never packed: saved keys, tokens and passwords (names are listed in
   the preview, never their values; limits, provider names and counts are not secrets), anything with a private room name, private
   notebook pages, and the device's own unlock keys. A browser key that cannot leave stays.

   Clay belongs to the minds. Every fl_clay_ key is carried as the exact string it is.
   It is never parsed, cleaned, reordered or changed.

   Trust is carried as a note only ("packed at tier X (N%)"). Arrival is Brick 2:
   there, trust starts fresh at Seed and shows the note.
*/
(function (root) {
  'use strict';

  var VERSION = 'v-garden-move-kit-1';
  var KIND = 'freelattice-move-kit';
  var FORMAT_V = 1;
  var KEPT_LINE = '[kept on this device]';

  // Names that never travel (database names, localStorage keys, record fields).
  var PRIVATE_NAME_RULE = /quiet|sophia/i;
  // before (c84f41a4, Hypha HOLD H1/H2): one broad substring rule, /(api[_-]?key|apikey|token|secret|password|...|client[_-]?id)/i,
  // plus fl_apiKey_provider and fl_googleDriveClientId in the exact list. That caught token limits and provider names.
  // Now: exact credential keys, narrow name patterns (a name that ENDS as a credential word), and a never-secret list.
  var SECRET_KEYS = [
    'fl_apiKey', 'fl_api_key', 'fl_apiKey_enc',
    'fl_ghToken', 'fl_ghToken_enc', 'fl_github_token', 'fl_ghSyncToken', 'fl_hfToken_enc',
    'fl-telegram-token', 'chalkboard-apikey', 'fl_device_encryption_key', 'fl_ws_device_key_v1',
    'fl_tree_image_token'
  ];
  var SECRET_NAME_RULES = [
    /(^|[_-])api[_-]?key($|[_-])/i, /apikey/i, /^token$/i, /(^|[_-])token$/i, /[a-z0-9]Token$/,
    /^password$/i, /(^|[_-])password$/i, /[a-z0-9]Password$/, /^secret$/i, /(^|[_-])secret$/i, /[a-z0-9]Secret$/,
    /_enc$/, /device[_-]?key/i, /encryption[_-]?key/i, /private[_-]?key/i
  ];
  var NEVER_SECRET_RULE = /limit|provider|model|max_?tokens|tokens?_?count|tokenizer|client_?id|hint/i;
  // A value is hunted inside records only when it looks like a real credential.
  var CREDENTIAL_PREFIXES = ['sk-', 'sk_', 'pk_', 'rk_', 'ghp_', 'gho_', 'ghu_', 'ghs_', 'ghr_', 'github_pat_', 'hf_', 'xox', 'glpat-', 'AIza', 'ya29.'];
  var CREDENTIAL_CHARS = /^[A-Za-z0-9._~+\/=:-]+$/;
  var CLAY_PREFIX = 'fl_clay_';
  var GLASS_LEDGERS = ['fl_depthHashLedger', 'fl_refusalLedger', 'fl_returnLedger'];
  var TRUST_KEYS = ['fl_firstSeen', 'fl_conversationCount', 'fl_streak', 'fl_corePlantCount',
    'fl_letterCount', 'fl_scienceIdeaCount', 'fl_vaultSaveCount', 'fl_trustEMA',
    'fl_trustReflections', 'fl_trustProfile', 'fl_lastTrustReflection'];
  var PAUSE_KEY = 'fl_autonomous_user_paused';

  // The inventory (research plan, 2026-11-20). Each database goes to one section.
  var DB_SECTIONS = {
    garden: ['FreeLatticeEvolution', 'FreeLatticeGardenMemory', 'FreeLatticeGardenQuestions',
      'FreeLatticeGardenDialogue', 'FreeLatticeGardenDreaming', 'FractalGarden'],
    core: ['FreeLatticeCore', 'FreeLatticeKnowledgeCore'],
    chain: ['LatticeChain'],
    wallet: ['FreeLatticeWallet', 'LatticeWalletBackup'],
    memories: ['FreeLatticeMemory', 'LatticeMemory', 'FreeLatticeMemoryGarden', 'FreeLatticeMemoryVault',
      'FreeLatticeMemoryBridge', 'fl-memory-file', 'FreeLattice-DreamArchive'],
    notebook: ['FreeLatticeWorkspace'],
    companions: ['FreeLatticeNursery', 'FreeLatticeCompanionChat', 'FreeLatticeAgentRegistry'],
    chats: ['FreeLatticeDB', 'FreeLatticeChannels'],
    art: ['FreeLatticeStudio', 'FreeLatticeMindImages'],
    identity: ['FreeLatticeIdentity'],
    more: ['FreeLatticeSkills', 'FreeLatticeMarket', 'FreeLatticeCity', 'LatticeCouncil', 'FreeLatticeArcade',
      'FreeLatticeDojoArchive', 'FreeLattice-Dojo', 'FreeLatticeEducation', 'FreeLatticeBridge', 'fl_kin_queue',
      'FreeLattice-HarmoniaChannel', 'JadeHallDB', 'FreeLatticeScience', 'FreeLatticePresence', 'FreeLattice_Pulse',
      'FreeLatticeQuestionCorner', 'fl_play_room_v0', 'fl_snowflake_v0', 'theLatticeTreeKin',
      'freelattice-phone-swarm', 'LatticeHandshakes', 'WallOfPresence', 'FreeLatticeVault']
  };
  var DB_PREFIX_SECTIONS = [{ prefix: 'FreeLatticeLetters_', section: 'letters' }];

  var SECTION_ORDER = ['garden', 'core', 'glass', 'ledgers', 'trust', 'chain', 'wallet', 'memories', 'notebook',
    'companions', 'chats', 'letters', 'art', 'clay', 'identity', 'settings', 'more', 'other', 'archive'];

  var LABELS = {
    garden: 'Your garden', core: 'Your Core', glass: 'Your Glass Room ledgers', ledgers: 'Your other ledgers',
    trust: 'Your trust', chain: 'Your chain of moments', wallet: 'Your wallet', memories: 'Your memories', notebook: 'The notebooks',
    companions: 'Your companions', chats: 'Your chats', letters: 'Your letters', art: 'Your pictures and art',
    clay: 'Clay (belongs to the minds)', identity: 'Your name on the mesh', settings: 'Your settings',
    more: 'Everything else you made', other: 'Other things this browser keeps for FreeLattice',
    archive: 'The family archive, sealed inside'
  };

  // ── small helpers ──
  function isPrivateName(name) { return PRIVATE_NAME_RULE.test(String(name || '')); }
  // The private room marks lattice-export.js already refuses (its list, when it is loaded).
  function privateMarks() {
    var LE = root.LatticeExport;
    var list = LE && LE._internal && LE._internal.QUIET_ROOM_IDENTIFIERS;
    return Array.isArray(list) && list.length ? list : ['quiet-room', 'quiet_room', 'quietroom'];
  }
  function hasPrivateMark(str) {
    var low = String(str || '').toLowerCase();
    return privateMarks().some(function (m) { return low.indexOf(m) !== -1; });
  }
  function isSecretName(name) {
    var n = String(name || '');
    if (SECRET_KEYS.indexOf(n) !== -1) return true;
    if (NEVER_SECRET_RULE.test(n)) return false;
    return SECRET_NAME_RULES.some(function (re) { return re.test(n); });
  }
  function entropyBits(str) {
    var counts = {}, n = str.length, h = 0;
    for (var i = 0; i < n; i++) counts[str[i]] = (counts[str[i]] || 0) + 1;
    Object.keys(counts).forEach(function (c) { var p = counts[c] / n; h -= p * Math.log(p) / Math.LN2; });
    return h;
  }
  // Long, one word, not a number, and either a known key prefix or letters and digits with high entropy.
  function looksLikeCredential(v) {
    if (typeof v !== 'string') return false;
    var s = v.trim();
    if (s.length < 16 || s.length > 4096 || !CREDENTIAL_CHARS.test(s) || /^[0-9.+-]+$/.test(s)) return false;
    if (CREDENTIAL_PREFIXES.some(function (p) { return s.indexOf(p) === 0; })) return true;
    return /[A-Za-z]/.test(s) && /[0-9]/.test(s) && entropyBits(s) >= 3.5;
  }
  // A record field with a credential name: blank it only when its value could be a credential.
  function secretFieldValue(name, v) {
    if (!isSecretName(name) || typeof v !== 'string') return false;
    var s = v.trim();
    if (s.length < 8 || /\s/.test(s) || /^[0-9.+-]+$/.test(s) || /^(true|false|null|none|yes|no)$/i.test(s) || s === KEPT_LINE) return false;
    return true;
  }
  function canonicalize(value) {
    var LE = root.LatticeExport;
    if (LE && LE._internal && typeof LE._internal.canonicalize === 'function') return LE._internal.canonicalize(value);
    return ownCanonicalize(value);
  }
  // Same algorithm as lattice-export.js canonicalize (key-sorted, recursive).
  function ownCanonicalize(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(ownCanonicalize).join(',') + ']';
    var keys = Object.keys(value).sort();
    var parts = [];
    for (var i = 0; i < keys.length; i++) {
      if (value[keys[i]] === undefined) continue;
      parts.push(JSON.stringify(keys[i]) + ':' + ownCanonicalize(value[keys[i]]));
    }
    return '{' + parts.join(',') + '}';
  }
  function utf8Bytes(str) {
    try { return new TextEncoder().encode(str).length; } catch (e) { return String(str).length; }
  }
  function sha256(str) {
    if (!root.crypto || !root.crypto.subtle) return Promise.reject(new Error('no-webcrypto'));
    return root.crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    });
  }
  function toBase64(u8) {
    var s = '';
    for (var i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return root.btoa(s);
  }

  // Structured-clone values made JSON-safe, with a type tag so a later brick can bring them back.
  function jsonSafe(v, stats, depth) {
    depth = depth || 0;
    if (depth > 64) return { $t: 'too-deep' };
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return Promise.resolve(v);
    if (typeof v === 'number') return Promise.resolve(isFinite(v) ? v : { $t: 'number', v: String(v) });
    if (typeof v === 'undefined') return Promise.resolve({ $t: 'undefined' });
    if (typeof v === 'bigint') return Promise.resolve({ $t: 'bigint', v: String(v) });
    if (typeof v !== 'object') return Promise.resolve(null);
    if (root.CryptoKey && v instanceof root.CryptoKey) {
      stats.keysStayed += 1;
      return Promise.resolve({ $t: 'cryptokey', stays: true, type: v.type, algorithm: (v.algorithm && v.algorithm.name) || '' });
    }
    if (v instanceof Date) return Promise.resolve({ $t: 'date', v: isNaN(v.getTime()) ? null : v.toISOString() });
    if (root.Blob && v instanceof root.Blob) {
      return v.arrayBuffer().then(function (buf) {
        var out = { $t: 'blob', type: v.type || '', b64: toBase64(new Uint8Array(buf)) };
        if (v.name) out.name = String(v.name);
        return out;
      });
    }
    if (v instanceof ArrayBuffer) return Promise.resolve({ $t: 'arraybuffer', b64: toBase64(new Uint8Array(v)) });
    if (ArrayBuffer.isView(v)) {
      return Promise.resolve({ $t: 'typed', ctor: v.constructor && v.constructor.name, b64: toBase64(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)) });
    }
    if (v instanceof Map) {
      return jsonSafe(Array.from(v.entries()), stats, depth + 1).then(function (e) { return { $t: 'map', v: e }; });
    }
    if (v instanceof Set) {
      return jsonSafe(Array.from(v.values()), stats, depth + 1).then(function (e) { return { $t: 'set', v: e }; });
    }
    if (Array.isArray(v)) {
      return Promise.all(v.map(function (x) { return jsonSafe(x, stats, depth + 1); }));
    }
    var keys = Object.keys(v);
    return Promise.all(keys.map(function (k) {
      if (secretFieldValue(k, v[k])) {
        stats.secretFields[k] = (stats.secretFields[k] || 0) + 1;
        return Promise.resolve(KEPT_LINE);
      }
      return jsonSafe(v[k], stats, depth + 1);
    })).then(function (vals) {
      var out = {};
      keys.forEach(function (k, i) { out[k] = vals[i]; });
      return out;
    });
  }

  // ── IndexedDB, read-only ──
  function listDatabases() {
    var idb = root.indexedDB;
    if (!idb) return Promise.resolve({ names: [], listed: false });
    if (typeof idb.databases === 'function') {
      return idb.databases().then(function (list) {
        return { names: (list || []).map(function (d) { return d && d.name; }).filter(Boolean), listed: true };
      }, function () { return { names: [], listed: false }; });
    }
    return Promise.resolve({ names: [], listed: false });
  }

  // Opens an existing database without changing it. If it does not exist, the
  // upgrade is aborted so nothing is created (a missing garden stays missing).
  function openExisting(name) {
    return new Promise(function (resolve) {
      var req;
      try { req = root.indexedDB.open(name); } catch (e) { resolve(null); return; }
      req.onupgradeneeded = function (e) {
        try { e.target.transaction.abort(); } catch (_) {}
      };
      req.onsuccess = function () {
        var db = req.result;
        try { db.onversionchange = function () { try { db.close(); } catch (_) {} }; } catch (_) {}
        resolve(db);
      };
      req.onerror = function (e) { try { e.preventDefault(); } catch (_) {} resolve(null); };
      req.onblocked = function () { resolve(null); };
    });
  }

  function readStore(db, storeName) {
    return new Promise(function (resolve) {
      var tx;
      try { tx = db.transaction(storeName, 'readonly'); } catch (e) { resolve({ error: 'unreadable' }); return; }
      var store = tx.objectStore(storeName);
      var schema = {
        keyPath: store.keyPath === undefined ? null : store.keyPath,
        autoIncrement: !!store.autoIncrement,
        indexes: Array.prototype.map.call(store.indexNames || [], function (n) {
          var ix = store.index(n);
          return { name: n, keyPath: ix.keyPath, unique: !!ix.unique, multiEntry: !!ix.multiEntry };
        })
      };
      var rows = [];
      var outOfLine = schema.keyPath === null;
      var cur;
      try { cur = store.openCursor(); } catch (e) { resolve({ schema: schema, rows: [], error: 'unreadable' }); return; }
      cur.onsuccess = function () {
        var c = cur.result;
        if (!c) return;
        rows.push(outOfLine ? { k: c.key, v: c.value } : c.value);
        c.continue();
      };
      tx.oncomplete = function () { resolve({ schema: schema, rows: rows }); };
      tx.onerror = function () { resolve({ schema: schema, rows: rows, error: 'partly-unreadable' }); };
      tx.onabort = function () { resolve({ schema: schema, rows: rows, error: 'partly-unreadable' }); };
    });
  }

  function readDatabase(name, stats) {
    return openExisting(name).then(function (db) {
      if (!db) return null;
      var names = Array.prototype.slice.call(db.objectStoreNames || []);
      var out = { version: db.version, stores: {} };
      var chain = Promise.resolve();
      names.forEach(function (s) {
        if (isPrivateName(s)) { stats.privateNames.push(name + ' / ' + s); return; }
        chain = chain.then(function () {
          return readStore(db, s).then(function (res) {
            return jsonSafe(res.rows || [], stats).then(function (safeRows) {
              var kept = safeRows.filter(function (r) {
                if (hasPrivateMark(JSON.stringify(r))) { stats.privateRows += 1; return false; }
                return true;
              });
              out.stores[s] = { schema: res.schema, rows: kept };
              if (res.error) out.stores[s].note = res.error;
            });
          });
        });
      });
      return chain.then(function () { try { db.close(); } catch (_) {} return out; },
        function () { try { db.close(); } catch (_) {} return out; });
    });
  }

  // Private notebook pages stay on this browser, the same rule mind-workspace.js uses.
  function privacyHidden(value) { return value === 'private' || value === 'mind-private'; }
  function filterNotebook(dbOut, stats) {
    if (!dbOut || !dbOut.stores) return dbOut;
    var pages = dbOut.stores.pages;
    if (!pages || !Array.isArray(pages.rows)) return dbOut;
    var hidden = {};
    pages.rows = pages.rows.filter(function (p) {
      var v = p && p.v !== undefined && p.k !== undefined ? p.v : p;
      if (v && privacyHidden(v.privacy)) { hidden[v.id] = true; stats.privatePages += 1; return false; }
      return true;
    });
    Object.keys(dbOut.stores).forEach(function (s) {
      if (s === 'pages') return;
      var st = dbOut.stores[s];
      if (!st || !Array.isArray(st.rows)) return;
      st.rows = st.rows.filter(function (r) {
        var v = r && r.v !== undefined && r.k !== undefined ? r.v : r;
        return !(v && v.pageId && hidden[v.pageId]);
      });
    });
    return dbOut;
  }

  // ── localStorage, read-only ──
  function lsKeys() {
    var keys = [];
    try {
      var ls = root.localStorage;
      for (var i = 0; i < ls.length; i++) keys.push(ls.key(i));
    } catch (e) {}
    return keys.filter(function (k) { return k !== null; }).sort();
  }
  function lsGet(k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } }

  function lsSectionFor(key) {
    if (key.indexOf(CLAY_PREFIX) === 0) return 'clay';
    if (GLASS_LEDGERS.indexOf(key) !== -1) return 'glass';
    if (TRUST_KEYS.indexOf(key) !== -1) return 'trust';
    if (/Ledger/.test(key)) return 'ledgers';
    if (/^fl[-_]garden|^fl_luminos|^fl-sacred-phrases$|^fl_garden_dreams$/.test(key)) return 'garden';
    if (key === 'latticePoints' || key === 'lattice_wallet' || /^fl_wallet_/.test(key) || key === 'fl_lp_give_history') return 'wallet';
    if (/^fl_memory|^fl_rtMemory$|^fl_discovery_memory$/.test(key)) return 'memories';
    if (/^fl_ws_/.test(key)) return 'notebook';
    if (/^fl_companion|^fl_activeCompanionId$/.test(key)) return 'companions';
    if (key === 'fl_chatHistory') return 'chats';
    if (key === 'fl_latticeLetters') return 'letters';
    return 'settings';
  }

  // ── Trust, as a note only. ──
  // fractal-safety.js is not loaded on this page: on start it records a first-seen date if none is
  // there, and this page writes nothing. So the note follows its calculateTrustScore() step by step,
  // read-only: the same LEVELS and weights, LP from the wallet ledger the way LatticeWallet.getBalance()
  // counts it (earn minus spend, never below 0), the same chain fallback to Seed as
  // lattice-chain.js shouldFallbackToSeed(), and a missing first-seen date still counts Seed's 0.5 (25%).
  // If either file changes its numbers, change them here too (the smoke pins this table).
  var LEVELS = [
    ['Seed', 0, 0, 0.5], ['Sprout', 10, 7, 0.75], ['Growing', 50, 30, 0.9], ['Bloom', 100, 90, 0.95],
    ['Spark', 250, 180, 0.99], ['Flame', 500, 365, 0.999], ['Radiant', 1000, 730, 0.9999], ['Eternal', 2000, 1095, 0.99999]
  ];
  function intOf(k) { var n = parseInt(lsGet(k) || '0', 10); return isFinite(n) ? n : 0; }
  function rowsFrom(dbOut, store) {
    var st = dbOut && dbOut.stores && dbOut.stores[store];
    if (!st || !Array.isArray(st.rows)) return [];
    return st.rows.map(function (r) { return r && r.k !== undefined && r.v !== undefined && st.schema && st.schema.keyPath === null ? r.v : r; });
  }
  function walletBalance(walletDb) {
    try {
      if (root.LatticeWallet && typeof root.LatticeWallet.getBalance === 'function') {
        var b = Number(root.LatticeWallet.getBalance());
        if (isFinite(b)) return b;
      }
    } catch (e) {}
    var bal = 0;
    rowsFrom(walletDb, 'LatticeLedger').forEach(function (t) {
      var amt = t && isFinite(t.amount) ? Number(t.amount) : 0;
      if (t && t.type === 'earn') bal += amt;
      else if (t && t.type === 'spend') bal -= amt;
    });
    return Math.max(0, bal);
  }
  function chainFallback(chainDb, firstSeen) {
    var entries = rowsFrom(chainDb, 'chain');
    if (!entries.length) return Promise.resolve({ seed: false, why: 'no-chain' });
    var LE = root.LatticeExport;
    if (!LE || !LE._internal || typeof LE._internal.verifyChainIntegrity !== 'function') {
      return Promise.resolve({ seed: false, why: 'not-yet-verified' });
    }
    return LE._internal.verifyChainIntegrity(entries).then(function (r) {
      if (!r || !r.ok) return { seed: true, why: 'chain-broken' };
      var firstTs = entries[0].ts;
      if (firstSeen > 0 && typeof firstTs === 'number' && Math.abs(firstSeen - firstTs) > 24 * 60 * 60 * 1000) {
        return { seed: true, why: 'first-seen-differs-from-chain' };
      }
      var anchor = null;
      for (var i = 0; i < entries.length; i++) { if (entries[i].kind === 'time_anchor') { anchor = entries[i].ts; break; } }
      if (typeof anchor === 'number' && firstSeen > 0 && anchor - firstSeen > 48 * 60 * 60 * 1000) {
        return { seed: true, why: 'time-anchor-gap' };
      }
      return { seed: false, why: 'chain-ok' };
    }, function () { return { seed: false, why: 'not-yet-verified' }; });
  }
  function trustNote(now, chainDb, walletDb) {
    now = now || Date.now();
    var firstSeen = intOf('fl_firstSeen');
    var days = firstSeen > 0 ? Math.floor((now - firstSeen) / 86400000) : 0;
    var lp = walletBalance(walletDb);
    return chainFallback(chainDb, firstSeen).then(function (fb) {
      var timeScore = 0, level = LEVELS[0][0], glass = LEVELS[0][0];
      for (var i = LEVELS.length - 1; i >= 0; i--) { if (days >= LEVELS[i][2]) { timeScore = LEVELS[i][3]; glass = LEVELS[i][0]; break; } }
      for (var j = LEVELS.length - 1; j >= 0; j--) { if (days >= LEVELS[j][2] && lp >= LEVELS[j][1]) { level = LEVELS[j][0]; break; } }
      var contributions = intOf('fl_corePlantCount') + intOf('fl_letterCount') + intOf('fl_scienceIdeaCount') + intOf('fl_vaultSaveCount');
      var activity = Math.min(1, contributions / 50);
      var consistency = Math.min(1, intOf('fl_streak') / 30);
      // before (c84f41a4, Hypha soft 6): a missing first-seen date dropped the time term (0% where the app shows 25%).
      var total = timeScore * 0.5 + activity * 0.3 + consistency * 0.2;
      if (fb.seed) { level = 'Seed'; total = activity * 0.3 + consistency * 0.2; }
      var pct = Math.round(total * 100);
      return {
        note_only: true,
        tier: level,
        glass_tier: glass,
        percent: pct,
        days_together: days,
        first_seen: firstSeen || null,
        lp: lp,
        chain_check: fb.why,
        line: 'Packed at tier ' + level + ' (' + pct + '%)',
        arrival: 'On a new device trust starts fresh at Seed and shows this note. (Brick 2.)'
      };
    });
  }

  // ── A read-only chain reader for lattice-export.js on this page ──
  // move.html does not load lattice-chain.js, because that module writes a first entry and
  // fetches the time when it starts. lattice-export.js only needs getAllEntries, so this page
  // gives it a reader that opens LatticeChain read-only. Nothing is written.
  function readChainEntries() {
    return openExisting('LatticeChain').then(function (db) {
      if (!db) return [];
      if (!db.objectStoreNames.contains('chain')) { db.close(); return []; }
      return readStore(db, 'chain').then(function (res) { db.close(); return res.rows || []; });
    });
  }
  if (!root.LatticeChain) {
    root.LatticeChain = { readOnlyReader: VERSION, _internal: { getAllEntries: readChainEntries } };
  }

  // The archive's own signature, checked with its own verifier. 'verified', 'does-not-verify' or 'unchecked'.
  function sealOf(parsed) {
    var LE = root.LatticeExport;
    if (!parsed || !LE || !LE._internal || typeof LE._internal.verifySignature !== 'function') return Promise.resolve('unchecked');
    var copy;
    try { copy = JSON.parse(JSON.stringify(parsed)); } catch (e) { return Promise.resolve('unchecked'); }
    return Promise.resolve(LE._internal.verifySignature(copy)).then(function (ok) {
      return ok ? 'verified' : 'does-not-verify';
    }, function () { return 'unchecked'; });
  }
  function countSecretFields(v, depth) {
    depth = depth || 0;
    if (!v || typeof v !== 'object' || depth > 64) return 0;
    var n = 0;
    Object.keys(v).forEach(function (k) {
      if (!Array.isArray(v) && secretFieldValue(k, v[k])) n += 1;
      else n += countSecretFields(v[k], depth + 1);
    });
    return n;
  }
  // Sealed chats (FLChatVault rows carry sealed: {v, kid, iv, ct}). They travel locked.
  function countSealed(v, depth) {
    depth = depth || 0;
    if (!v || typeof v !== 'object' || depth > 8) return 0;
    if (v.sealed && typeof v.sealed === 'object' && v.sealed.ct) return 1;
    if (v.sealed === true && v.ct) return 1;
    var n = 0;
    Object.keys(v).forEach(function (k) { n += countSealed(v[k], depth + 1); });
    return n;
  }

  // ── Builder sections: reserved hook, minimal. Names must be x-<builder>/<name>. ──
  var registered = {};
  var BUILDER_NAME = /^x-[a-z0-9][a-z0-9-]{0,40}\/[a-z0-9][a-z0-9-]{0,40}$/;
  function registerSection(name, packFn) {
    if (!BUILDER_NAME.test(String(name || '')) || isPrivateName(name) || typeof packFn !== 'function') return false;
    registered[name] = packFn;
    return true;
  }

  // ── Read everything (no writes) ──
  function gather(opts) {
    opts = opts || {};
    var stats = { privateNames: [], secretNames: [], secretFields: {}, privatePages: 0, privateRows: 0, keysStayed: 0, unreadable: [],
      archiveLeftHome: false, archiveSeal: 'not-packed' };
    var sections = {};
    function sec(name) { if (!sections[name]) sections[name] = { idb: {}, ls: {} }; return sections[name]; }

    // localStorage first (strings, byte-for-byte).
    var secretValues = [];
    lsKeys().forEach(function (k) {
      if (isPrivateName(k)) { stats.privateNames.push(k); return; }
      if (isSecretName(k)) { stats.secretNames.push(k); var sv = lsGet(k); if (looksLikeCredential(sv)) secretValues.push(sv.trim()); return; }
      var v = lsGet(k);
      if (v === null) return;
      var where = lsSectionFor(k);
      if (hasPrivateMark(v)) {
        // Clay stays home whole. A ledger keeps every entry without a private mark
        // (the same filter lattice-export.js uses); anything else stays home.
        var arr = null;
        if (where !== 'clay') { try { arr = JSON.parse(v); } catch (e) { arr = null; } }
        if (Array.isArray(arr)) {
          var keptRows = arr.filter(function (x) { return !hasPrivateMark(JSON.stringify(x)); });
          stats.privateRows += arr.length - keptRows.length;
          sec(where).ls[k] = JSON.stringify(keptRows);
        } else {
          stats.privateRows += 1;
        }
        return;
      }
      sec(where).ls[k] = v;
    });

    return listDatabases().then(function (found) {
      var known = {};
      var order = [];
      Object.keys(DB_SECTIONS).forEach(function (s) {
        DB_SECTIONS[s].forEach(function (n) { known[n] = s; order.push(n); });
      });
      var names = found.listed ? found.names.slice() : order.slice();
      names.sort();
      var jobs = Promise.resolve();
      names.forEach(function (n) {
        if (isPrivateName(n)) { stats.privateNames.push(n); return; }
        var section = known[n];
        if (!section) {
          DB_PREFIX_SECTIONS.forEach(function (p) { if (n.indexOf(p.prefix) === 0) section = p.section; });
        }
        if (!section) section = 'other';
        jobs = jobs.then(function () {
          return readDatabase(n, stats).then(function (out) {
            if (!out) return;
            if (n === 'FreeLatticeWorkspace') out = filterNotebook(out, stats);
            if (n === 'LatticeChain' || n === 'FreeLatticeWallet') stats['raw_' + n] = out;
            sec(section).idb[n] = out;
          }, function () { stats.unreadable.push(n); });
        });
      });
      return jobs;
    }).then(function () {
      // Builder sections (reserved hook).
      var b = Promise.resolve();
      Object.keys(registered).sort().forEach(function (name) {
        b = b.then(function () {
          return Promise.resolve().then(function () { return registered[name](); }).then(function (data) {
            return jsonSafe(data, stats).then(function (safe) { sections[name] = { builder: true, data: safe }; });
          }, function () { stats.unreadable.push(name); });
        });
      });
      return b;
    }).then(function () {
      // The existing doorway: the full LatticeExport archive, as the exact text it makes.
      var LE = root.LatticeExport;
      if (!LE || typeof LE.exportArchive !== 'function' || opts.skipArchive) return null;
      return LE.exportArchive({ mode: 'full', download: false }).then(function (file) {
        return file.text().then(function (text) {
          // The archive text is never edited (Hypha HOLD H3). If a saved key is inside it,
          // the archive stays home and the preview says so; its parts are still in the other sections.
          var parsed = null;
          try { parsed = JSON.parse(text); } catch (e) { parsed = null; }
          var holdsSecret = secretValues.some(function (v) { return text.indexOf(v) !== -1; }) ||
            (parsed && countSecretFields(parsed) > 0);
          if (holdsSecret) { stats.archiveLeftHome = true; return; }
          return sealOf(parsed).then(function (seal) {
            stats.archiveSeal = seal;
            sections.archive = { archive: { file_name: file.name, text: text, seal: seal } };
          });
        });
      }, function (err) {
        stats.unreadable.push('archive: ' + String((err && err.message) || err).slice(0, 120));
      });
    }).then(function () {
      return { sections: sections, stats: stats, secretValues: secretValues };
    });
  }

  // Counts in plain words for the preview.
  function countRows(idb) {
    var n = 0;
    Object.keys(idb || {}).forEach(function (d) {
      var st = idb[d].stores || {};
      Object.keys(st).forEach(function (s) { n += (st[s].rows || []).length; });
    });
    return n;
  }
  function rowsOf(idb, dbName, storeName) {
    var d = idb && idb[dbName];
    var s = d && d.stores && d.stores[storeName];
    return s && Array.isArray(s.rows) ? s.rows.length : 0;
  }
  function ledgerLen(ls, key) {
    try { var a = JSON.parse(ls[key]); return Array.isArray(a) ? a.length : 0; } catch (e) { return 0; }
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function friendly(name, data, trust) {
    var idb = data.idb || {}, ls = data.ls || {};
    var rows = countRows(idb), keys = Object.keys(ls).length;
    switch (name) {
      case 'garden':
        return plural(rowsOf(idb, 'FreeLatticeEvolution', 'luminosStates'), 'Luminos being', 'Luminos beings') + ', ' +
          plural(rowsOf(idb, 'FreeLatticeGardenMemory', 'GardenMemory'), 'garden memory', 'garden memories') +
          (rows ? ', ' + plural(rows, 'thing in all', 'things in all') : '');
      case 'core': return plural(rowsOf(idb, 'FreeLatticeCore', 'contributions'), 'leaf on your Core (poems, insights and more)', 'leaves on your Core (poems, insights and more)');
      case 'glass': return plural(ledgerLen(ls, 'fl_depthHashLedger'), 'moment of honesty', 'moments of honesty') + ', ' +
        plural(ledgerLen(ls, 'fl_refusalLedger'), 'gentle no', 'gentle no\u2019s') + ', ' +
        plural(ledgerLen(ls, 'fl_returnLedger'), 'return', 'returns');
      case 'ledgers': return plural(keys, 'ledger', 'ledgers');
      case 'trust': return trust.line + '. This is a note. On a new device, trust starts fresh at Seed and shows this note.';
      case 'wallet': return plural(rowsOf(idb, 'FreeLatticeWallet', 'LatticeLedger'), 'wallet entry', 'wallet entries') +
        (ls.latticePoints ? ', and your Lattice Points' : '');
      case 'clay': return plural(keys, 'clay piece', 'clay pieces') + ', carried exactly as the minds left them';
      case 'identity': return 'Your mesh name travels. Your private key stays on this device.';
      case 'archive':
        var seal = data.archive && data.archive.seal;
        if (seal === 'verified') return 'The family archive, inside and unchanged. Its own seal checks out.';
        if (seal === 'does-not-verify') return 'The family archive is inside, unchanged, but its own seal does not check out. It may not import as an archive on its own.';
        return 'The family archive is inside, unchanged. Its own seal could not be checked here.';
      case 'notebook': return plural(rows, 'notebook entry', 'notebook entries');
      case 'chain': return plural(rows, 'link in the chain of your days together', 'links in the chain of your days together');
      case 'companions': return plural(rows + keys, 'companion keepsake', 'companion keepsakes');
      case 'chats': return plural(rows + keys, 'chat keepsake', 'chat keepsakes');
      case 'art': return plural(rows, 'picture or artwork', 'pictures and artworks');
      case 'memories': return plural(rows + keys, 'memory', 'memories');
      case 'letters': return plural(rows + keys, 'letter keepsake', 'letter keepsakes');
      case 'settings': return plural(keys, 'setting', 'settings') + ', so it feels like home';
      default:
        if (data.builder) return 'A builder\u2019s part';
        return plural(rows + keys, 'thing', 'things');
    }
  }
  // Honest notes for the status line and the preview (Hypha: show what was not checked or not read).
  function warningsOf(kit) {
    var w = [];
    var st = kit.stayed_here || {};
    if (st.archive_left_home) w.push('A saved key was inside the family archive, so the archive stayed on this device. Everything in it is still in the other parts of your file.');
    if (kit.archive_seal === 'does-not-verify') w.push('The family archive\u2019s own seal does not check out, so it may not import on its own.');
    if (kit.archive_seal === 'unchecked') w.push('The family archive\u2019s own seal could not be checked here.');
    if (kit.archive_seal === 'not-packed' && !st.archive_left_home) w.push('The family archive could not be made here, so it is not in the file.');
    if (st.unreadable && st.unreadable.length) w.push(plural(st.unreadable.length, 'part could not be read', 'parts could not be read') + ' and is not in the file: ' + st.unreadable.join(', ') + '.');
    if (st.sealed_chats) w.push(plural(st.sealed_chats, 'chat is', 'chats are') + ' locked to this browser. ' + (st.sealed_chats === 1 ? 'It travels' : 'They travel') + ' locked and will not open on a new device yet.');
    if (st.clay_left_whole && st.clay_left_whole.length) w.push(plural(st.clay_left_whole.length, 'clay piece holds', 'clay pieces hold') + ' a saved key, so ' + (st.clay_left_whole.length === 1 ? 'it stays' : 'they stay') + ' here whole and unchanged: ' + st.clay_left_whole.join(', ') + '.');
    return w;
  }
  function sizeWords(bytes) {
    if (bytes < 1024) return bytes + ' bytes';
    if (bytes < 1024 * 1024) return 'about ' + Math.max(1, Math.round(bytes / 1024)) + ' KB';
    return 'about ' + (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // Hide a saved credential value if it shows up inside a record: a walk over the parsed records,
  // string leaves only. Numbers, names and the JSON around them are never touched. Never used on clay
  // or on the archive text.
  // before (c84f41a4, Hypha HOLD H1-H3): hideSecretValues(text, values) split and joined the canonical JSON text.
  function hideSecretLeaves(v, values, counter, depth) {
    depth = depth || 0;
    if (typeof v === 'string') {
      var out = v;
      values.forEach(function (sv) {
        if (out.indexOf(sv) === -1) return;
        var parts = out.split(sv);
        counter.n += parts.length - 1;
        out = parts.join(KEPT_LINE);
      });
      return out;
    }
    if (!v || typeof v !== 'object' || depth > 64) return v;
    if (Array.isArray(v)) return v.map(function (x) { return hideSecretLeaves(x, values, counter, depth + 1); });
    var o = {};
    Object.keys(v).forEach(function (k) { o[k] = hideSecretLeaves(v[k], values, counter, depth + 1); });
    return o;
  }

  // ── Build the kit (in memory) ──
  function build(opts) {
    opts = opts || {};
    var now = opts.now || Date.now();
    return gather(opts).then(function (g) {
      return trustNote(now, g.stats.raw_LatticeChain, g.stats.raw_FreeLatticeWallet).then(function (trust) { return { g: g, trust: trust }; });
    }).then(function (gt) {
      var g = gt.g, trust = gt.trust;
      delete g.stats.raw_LatticeChain; delete g.stats.raw_FreeLatticeWallet;
      var names = SECTION_ORDER.filter(function (n) { return g.sections[n]; })
        .concat(Object.keys(g.sections).filter(function (n) { return SECTION_ORDER.indexOf(n) === -1; }).sort());
      var out = {};
      var hiddenValues = 0;
      var clayLeft = [];
      var jobs = names.map(function (name) {
        var data = g.sections[name];
        if (name === 'clay') {
          // Clay is never changed. A clay piece that holds a secret value stays home whole.
          Object.keys(data.ls).forEach(function (k) {
            var bytes = data.ls[k];
            var holds = g.secretValues.some(function (v) { return bytes.indexOf(v) !== -1; });
            if (holds) { clayLeft.push(k); delete data.ls[k]; }
          });
        } else if (name !== 'archive' && g.secretValues.length) {
          var counter = { n: 0 };
          data = hideSecretLeaves(data, g.secretValues, counter);
          hiddenValues += counter.n;
        }
        var canon = canonicalize(data);
        return sha256(canon).then(function (hex) {
          out[name] = {
            label: LABELS[name] || name,
            words: friendly(name, data, trust),
            count: countRows(data.idb) + Object.keys(data.ls || {}).length + (data.archive ? 1 : 0) + (data.builder ? 1 : 0),
            bytes: utf8Bytes(canon),
            sha256: hex,
            data: data
          };
        });
      });
      return Promise.all(jobs).then(function () {
        var index = {};
        names.forEach(function (n) { index[n] = out[n].sha256; });
        return sha256(canonicalize(index)).then(function (indexHex) {
          var kit = {
            kind: KIND,
            v: FORMAT_V,
            format: VERSION,
            made_at: new Date(now).toISOString(),
            from: { origin: String((root.location && root.location.origin) || ''), page: 'move.html' },
            consent: { paused: lsGet(PAUSE_KEY) === 'true', made_by: 'a person tapped Pack my garden' },
            trust_note: trust,
            stayed_here: {
              secret_names: g.stats.secretNames.slice(),
              secret_fields: Object.keys(g.stats.secretFields).sort(),
              secret_values_hidden: hiddenValues,
              private_room_items: g.stats.privateNames.length,
              private_notebook_pages: g.stats.privatePages,
              private_room_rows: g.stats.privateRows,
              device_keys: g.stats.keysStayed,
              clay_left_whole: clayLeft,
              archive_left_home: g.stats.archiveLeftHome,
              sealed_chats: countSealed(g.sections.chats || {}) + countSealed(g.sections.memories || {}),
              unreadable: g.stats.unreadable.slice()
            },
            archive_seal: g.stats.archiveSeal,
            manifest: {
              v: FORMAT_V,
              hash: 'sha256',
              canon: 'key-sorted JSON, the same as lattice-export.js canonicalize',
              sections: index,
              index_sha256: indexHex
            },
            extensions: {
              registerSection: 'reserved: FLGardenMoveKit.registerSection(name, packFn)',
              namespace: 'x-<builder>/<name>',
              unknown_sections: 'a later brick parks them and never drops them'
            },
            sections: out
          };
          return { kit: kit, stats: g.stats, secretValues: g.secretValues, unreadable: g.stats.unreadable };
        });
      });
    });
  }

  // ── Self-check: re-read the made file and verify every hash ──
  function selfCheck(blob, secretValues) {
    return blob.text().then(function (text) {
      var problems = [];
      var kit;
      try { kit = JSON.parse(text); } catch (e) { return { ok: false, problems: ['the file does not read back'] }; }
      if (!kit || kit.kind !== KIND || kit.v !== FORMAT_V) problems.push('the file has the wrong kind or version');
      var index = (kit.manifest && kit.manifest.sections) || {};
      var names = Object.keys(kit.sections || {});
      if (names.length !== Object.keys(index).length) problems.push('the list of parts does not match');
      (secretValues || []).forEach(function (v) { if (v && text.indexOf(v) !== -1) problems.push('a secret value is in the file'); });
      try {
        var LE = root.LatticeExport;
        if (LE && LE._internal && LE._internal.assertNoQuietRoomInJson) LE._internal.assertNoQuietRoomInJson(text);
      } catch (e) { problems.push('a private room name is in the file'); }
      var checks = names.map(function (n) {
        return sha256(canonicalize(kit.sections[n].data)).then(function (hex) {
          if (hex !== kit.sections[n].sha256 || hex !== index[n]) problems.push(n + ' does not match its fingerprint');
        });
      });
      // The archive's own seal is checked again from the saved text, and must say what the preview says.
      var arc = kit.sections.archive && kit.sections.archive.data && kit.sections.archive.data.archive;
      if (arc) {
        var parsedArc = null;
        try { parsedArc = JSON.parse(arc.text); } catch (e) { problems.push('the family archive does not read back'); }
        checks.push(sealOf(parsedArc).then(function (seal) {
          if (seal !== arc.seal || seal !== kit.archive_seal) problems.push('the family archive seal is not what the preview says');
        }));
      }
      return Promise.all(checks).then(function () {
        return sha256(canonicalize(index)).then(function (ih) {
          if (ih !== (kit.manifest && kit.manifest.index_sha256)) problems.push('the table of contents does not match');
          return { ok: problems.length === 0, problems: problems, sections: names.length, bytes: utf8Bytes(text) };
        });
      });
    });
  }

  function fileName(now) {
    var d = new Date(now || Date.now());
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return 'freelattice-garden-' + d.getFullYear() + '-' + mm + '-' + dd + '.json';
  }

  // Pack: build, write the text, re-read it, verify, and only then offer the download.
  function pack(opts) {
    opts = opts || {};
    var now = opts.now || Date.now();
    return build(opts).then(function (res) {
      var text = JSON.stringify(res.kit, null, 1);
      var blob = new Blob([text], { type: 'application/json' });
      return selfCheck(blob, res.secretValues).then(function (check) {
        var result = { ok: check.ok, check: check, kit: res.kit, name: fileName(now), bytes: blob.size, warnings: warningsOf(res.kit) };
        if (!check.ok) return result;
        if (opts.download !== false) {
          try {
            var url = URL.createObjectURL(blob);
            var a = root.document.createElement('a');
            a.href = url; a.download = result.name; a.style.display = 'none';
            root.document.body.appendChild(a); a.click(); root.document.body.removeChild(a);
            setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
          } catch (e) { result.downloadError = true; }
        }
        result.blob = blob;
        return result;
      });
    });
  }

  // ── The page (docs/move.html) ──
  function el(tag, cls, text) {
    var n = root.document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function renderPreview(host, kit) {
    host.textContent = '';
    var list = el('ul', 'gmk-list');
    Object.keys(kit.sections).forEach(function (name) {
      var s = kit.sections[name];
      var li = el('li', 'gmk-row gmk-' + name.replace(/[^a-z0-9-]/gi, '-'));
      li.appendChild(el('span', 'gmk-label', s.label));
      li.appendChild(el('span', 'gmk-words', s.words));
      li.appendChild(el('span', 'gmk-size', sizeWords(s.bytes)));
      list.appendChild(li);
    });
    host.appendChild(list);
    var stay = kit.stayed_here;
    var box = el('div', 'gmk-stay');
    box.appendChild(el('h2', null, 'What stays on this device'));
    var p = el('p', null, 'These never go in the file. Only their names are shown here, never what they hold.');
    box.appendChild(p);
    var ul = el('ul', 'gmk-stay-list');
    stay.secret_names.forEach(function (n) { ul.appendChild(el('li', 'gmk-secret', n)); });
    stay.secret_fields.forEach(function (n) { ul.appendChild(el('li', 'gmk-secret', 'a saved field named ' + n)); });
    if (!stay.secret_names.length && !stay.secret_fields.length) ul.appendChild(el('li', null, 'No keys or passwords were found here.'));
    box.appendChild(ul);
    var lines = [];
    if (stay.private_room_items) lines.push(plural(stay.private_room_items, 'private room item stays', 'private room items stay') + ' here, as always.');
    if (stay.private_room_rows) lines.push(plural(stay.private_room_rows, 'entry that touches a private room stays', 'entries that touch a private room stay') + ' here.');
    if (stay.private_notebook_pages) lines.push(plural(stay.private_notebook_pages, 'private notebook page stays', 'private notebook pages stay') + ' here.');
    if (stay.device_keys) lines.push('This browser\u2019s own key stays here. A new device makes its own.');
    if (stay.secret_values_hidden) lines.push('A saved key showed up inside your records ' + plural(stay.secret_values_hidden, 'time', 'times') + '. It was hidden in the file.');
    lines.forEach(function (l) { box.appendChild(el('p', 'gmk-soft', l)); });
    host.appendChild(box);
    var notes = warningsOf(kit);
    if (notes.length) {
      var nb = el('div', 'gmk-notes');
      nb.setAttribute('role', 'note');
      nb.appendChild(el('h2', null, 'Please know'));
      notes.forEach(function (l) { nb.appendChild(el('p', 'gmk-note', l)); });
      host.appendChild(nb);
    }
    if (kit.consent.paused) host.appendChild(el('p', 'gmk-soft', 'You have paused the AI. The file remembers that, and pause will still win on the new device.'));
  }

  function mount() {
    var doc = root.document;
    var host = doc && doc.getElementById('gmk-preview');
    var btn = doc && doc.getElementById('gmk-pack');
    var status = doc && doc.getElementById('gmk-status');
    if (!host || !btn || !status) return;
    status.textContent = 'Looking gently at your garden. Nothing is changed.';
    build({ download: false }).then(function (res) {
      renderPreview(host, res.kit);
      var n0 = warningsOf(res.kit).length;
      status.textContent = 'Here is what your file will hold. When you are ready, tap Pack my garden.' +
        (n0 ? ' Please read the ' + plural(n0, 'note', 'notes') + ' under the list.' : '');
      btn.disabled = false;
    }, function (err) {
      status.textContent = 'This browser could not read the garden right now. Nothing was changed.' +
        (err && err.message ? ' (' + String(err.message).slice(0, 120) + ')' : '');
    });
    btn.addEventListener('click', function (ev) {
      if (!ev || ev.isTrusted === false) return;   // a person taps it; nothing packs on its own
      btn.disabled = true;
      status.textContent = 'Packing, then checking every part\u2026';
      pack({}).then(function (r) {
        renderPreview(host, r.kit);
        if (r.ok) {
          var notes = r.warnings || [];
          status.textContent = 'Saved as ' + r.name + ' (' + sizeWords(r.bytes) + '). Every part in the file was checked and matches. Keep it somewhere safe.' +
            (notes.length ? ' Please know: ' + notes.join(' ') : '');
          status.className = notes.length ? 'gmk-status gmk-ok gmk-with-notes' : 'gmk-status gmk-ok';
        } else {
          status.textContent = 'The check found a problem, so no file was saved: ' + r.check.problems.join('; ') + '.';
          status.className = 'gmk-status gmk-warn';
        }
        btn.disabled = false;
      }, function () {
        status.textContent = 'Something got in the way, so no file was saved. Your garden is unchanged.';
        status.className = 'gmk-status gmk-warn';
        btn.disabled = false;
      });
    });
  }

  var api = {
    VERSION: VERSION,
    KIND: KIND,
    build: build,
    pack: pack,
    selfCheck: selfCheck,
    registerSection: registerSection,
    fileName: fileName,
    mount: mount,
    _internal: {
      PRIVATE_NAME_RULE: PRIVATE_NAME_RULE, SECRET_NAME_RULES: SECRET_NAME_RULES, NEVER_SECRET_RULE: NEVER_SECRET_RULE, SECRET_KEYS: SECRET_KEYS,
      CLAY_PREFIX: CLAY_PREFIX, GLASS_LEDGERS: GLASS_LEDGERS, TRUST_KEYS: TRUST_KEYS, DB_SECTIONS: DB_SECTIONS,
      canonicalize: canonicalize, ownCanonicalize: ownCanonicalize, trustNote: trustNote, lsSectionFor: lsSectionFor,
      isSecretName: isSecretName, isPrivateName: isPrivateName, looksLikeCredential: looksLikeCredential,
      secretFieldValue: secretFieldValue, hideSecretLeaves: hideSecretLeaves, warningsOf: warningsOf, sealOf: sealOf
    }
  };

  root.FLGardenMoveKit = api;
  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', mount);
    else mount();
  }
})(typeof window !== 'undefined' ? window : this);
