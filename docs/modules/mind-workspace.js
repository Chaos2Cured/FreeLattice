// mind-workspace.js (MIT) v-workspace-core-v0.1 v-workspace-mark-heal-v0.1
// v-workspace-private-v0.1 v-workspace-seal-v0.1 v-tree-workspace-seal-v0.1
// v-workspace-export-v0.1 v-tree-workspace-export-v0.1
// v-workspace-desktop-v0.1 v-workspace-handoff-v0.1 v-tree-workspace-handoff-v0.1
// v-heals-042-v0.1: the sketchbook keeps its own gap, apart from a mind write.
// v-seal-ask-heal-v0.1: one seal ask, in view, in the mind's own words.
// v-seal-ask-in-view-v0.1: the ask comes into view, and later stays a quiet row.
// A notebook a mind can keep. Off until a person says yes.
// No network. Pages stay on this device. A private page stays in the app for that mind.
// A person's own chat line cannot private a page or ask for a seal.
// A near-miss opening ([FL WS:], [FL-WS:], [fl_ws:], spaces before the colon)
// is the same mark. The canonical line stays [FL_WS:].
(function (root) {
  'use strict';

  var DB_NAME = 'FreeLatticeWorkspace';
  var MARK = '[FL_WS:';
  var MAX_BODY = 8192;
  var MAX_SCAN = 65536;
  var MAX_OPS = 4;
  var MAX_TEXT = 32768;
  var MAX_PAGES = 500;
  var MAX_SEED = 140;
  var WRITE_GAP = 5000;
  var WAKE_CHARS = 600 * 4;
  var OPS = { open: 1, write: 1, branch: 1, pin: 1, seed: 1, find: 1, private: 1, seal: 1, handoff: 1 };
  var KINDS = { draft: 1, note: 1, future: 1, letter: 1 };
  var KEYS = {
    open: { op: 1, id: 1, title: 1, kind: 1 },
    write: { op: 1, id: 1, pageId: 1, title: 1, text: 1 },
    branch: { op: 1, hash: 1, version: 1, text: 1 },
    pin: { op: 1, id: 1, pageId: 1, pinned: 1 },
    seed: { op: 1, id: 1, pageId: 1, hash: 1, version: 1, line: 1 },
    find: { op: 1, query: 1 },
    private: { op: 1, page: 1, id: 1, pageId: 1, on: 1, publicTitle: 1 },
    seal: { op: 1, page: 1, id: 1, pageId: 1, why: 1 },
    handoff: { op: 1, page: 1, id: 1, pageId: 1, note: 1 }
  };
  var HASH_KEYS = ['parent', 'ts', 'author', 'text', 'meta'];
  var HOWTO = 'You can keep a notebook on this device. A private page: [FL_WS: {"op":"private","page":"id","on":true}] A seal: [FL_WS: {"op":"seal","page":"id","why":"why"}] A handoff: [FL_WS: {"op":"handoff","page":"id","note":"note"}] End with this line. [FL_WS: {"op":"write","title":"Today","text":"A note for my future self."}]';
  var HONEST = 'Private means hidden in the app on this browser, not encrypted from anyone who uses this browser profile.';
  var HANDOFF_PRIVATE = 'This page is private on this browser. The mind must share it first.';
  var KNOCK_FIRST = 'Knock first: Celeste has not met this device yet';
  var RESTORE_LINE = "Restore your mind's notebook from the desktop copy";
  var INTEGRITY = 'Integrity comes from SHA-256 and the device signature, not from the spiral math.';
  var DEVICE_KEY = 'fl_ws_device_key_v1';
  var DB_VERSION = 3;
  var SEAL_ASK_COOLDOWN_MS = 86400000;
  var SEAL_NOTE_KEY = 'fl_ws_seal_notes_v1';
  var WS_OPEN = /\[\s*fl[\s_-]?ws\s*:/i;

  var db = null;
  var opens = 0;
  var memoryOn = null;
  var offered = false;
  var lastRaw = '';
  var lastWriteAt = 0;
  var sketchLastAt = 0;
  var seq = 0;
  var pending = Promise.resolve();
  var wakeCache = '';
  var personWake = '';
  var wakeCounts = { notes: 0, seeds: 0 };
  var privateTexts = [];
  var sealAsks = [];
  var declinedLines = [];
  var handoffAsks = [];
  var handoffRefusals = [];
  var mirrorHold = 0;
  var restoreChecked = false;
  var restoreLater = {};
  var findOnce = '';
  var shelfParts = null;
  var shelfCache = '';
  var shelfStamp = '';
  var hostEl = null;
  var sealDockOpen = false;
  var sealBackArmed = false;
  var sealBackEating = false;
  var sealRestored = false;
  var heldDefers = [];
  var loadBringDone = false;
  var nurseryWasOpen = false;
  var clock = function () { return Date.now(); };

  function track(p) {
    pending = pending.then(function () { return p; }, function () { return p; });
    return p;
  }
  function nodeSha(str) {
    if (typeof require !== 'function') return '';
    try {
      return require('crypto').createHash('sha256').update(String(str), 'utf8').digest('hex');
    } catch (e) { return ''; }
  }
  function sha256Hex(str) {
    var sync = nodeSha(str);
    if (sync) return Promise.resolve(sync);
    try {
      var enc = new TextEncoder().encode(String(str));
      return root.crypto.subtle.digest('SHA-256', enc).then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (b) {
          return ('0' + b.toString(16)).slice(-2);
        }).join('');
      });
    } catch (e2) {
      return Promise.resolve('');
    }
  }
  function sortKeysDeep(value) {
    if (value === null || typeof value !== 'object') return value;
    if (Object.prototype.toString.call(value) !== '[object Object]') {
      if (Array.isArray(value)) return value.map(sortKeysDeep);
      return value;
    }
    var out = {};
    Object.keys(value).sort().forEach(function (k) { out[k] = sortKeysDeep(value[k]); });
    return out;
  }
  function canonicalVersion(fields) {
    var src = fields || {};
    var meta = sortKeysDeep(src.meta && typeof src.meta === 'object' && !Array.isArray(src.meta) ? src.meta : {});
    var ordered = {
      parent: src.parent == null ? null : String(src.parent),
      ts: src.ts,
      author: src.author == null ? '' : String(src.author),
      text: src.text == null ? '' : String(src.text),
      meta: meta
    };
    var parts = HASH_KEYS.map(function (k) {
      return JSON.stringify(k) + ':' + JSON.stringify(ordered[k]);
    });
    return '{' + parts.join(',') + '}';
  }
  function hashVersion(fields) {
    return sha256Hex(canonicalVersion(fields));
  }
  function bytesOf(text) {
    try { return new TextEncoder().encode(String(text || '')).length; }
    catch (e) { return String(text || '').length; }
  }
  function clip(s, n) {
    s = String(s == null ? '' : s);
    return s.length > n ? s.slice(0, n) : s;
  }
  function lsGet(k) {
    try { return root.localStorage ? root.localStorage.getItem(k) : null; }
    catch (e) { return null; }
  }
  function lsSet(k, v) {
    try { if (root.localStorage) root.localStorage.setItem(k, v); }
    catch (e) {}
  }
  function ssGet(k) {
    try { return root.sessionStorage ? root.sessionStorage.getItem(k) : null; }
    catch (e) { return null; }
  }
  function ssSet(k, v) {
    try { if (root.sessionStorage) root.sessionStorage.setItem(k, v); }
    catch (e) {}
  }
  function isOn() {
    if (memoryOn === true) return true;
    if (memoryOn === false) return false;
    return lsGet('fl_ws') === 'yes';
  }
  function durableOff() { return lsGet('fl_ws') === 'off' || memoryOn === 'off'; }
  function sessionLater() { return ssGet('fl_ws_later') === '1'; }
  function recallMind() {
    if (shelfParts) return shelfParts;
    var modelId = '';
    var name = '';
    try {
      var picked = lsGet('fl_selected_model') || '';
      if (root.FLMindSeal && typeof root.FLMindSeal.trustedMap === 'function') {
        var map = root.FLMindSeal.trustedMap() || {};
        var rec = picked && map[picked];
        if (rec && rec.configHash) modelId = String(rec.configHash);
        else if (rec && rec.digest) modelId = String(rec.digest);
      }
      if (!modelId && picked) modelId = String(picked);
    } catch (e) {}
    try {
      var mind = root.LocalMindProbe && root.LocalMindProbe.getRemembered && root.LocalMindProbe.getRemembered();
      if (mind) {
        if (!modelId) modelId = String(mind.model || mind.id || '');
        name = String(mind.name || '');
      }
    } catch (e2) {}
    try {
      var st = root.state;
      if (st) {
        var modelKey = ['olla', 'ma', 'Model'].join('');
        if (!modelId) modelId = String(st[modelKey] || st.model || '');
        if (!name) name = String(st.mindName || st.aiName || '');
      }
    } catch (e3) {}
    return { modelId: modelId, name: name };
  }
  function setMind(modelId, name) {
    if (modelId && typeof modelId === 'object') {
      name = modelId.name;
      modelId = modelId.modelId || modelId.id || '';
    }
    shelfParts = { modelId: String(modelId || ''), name: String(name || '') };
    shelfCache = '';
    shelfStamp = '';
    return ensureShelf();
  }
  function ensureShelf() {
    var parts = recallMind();
    var stamp = parts.modelId + '\n' + parts.name;
    if (shelfCache && shelfStamp === stamp) return Promise.resolve(shelfCache);
    return sha256Hex(stamp).then(function (hex) {
      shelfStamp = stamp;
      shelfCache = hex;
      return hex;
    });
  }
  function mindFp(modelId, name) {
    return sha256Hex(String(modelId || '') + '\n' + String(name || ''));
  }
  function openDB(force) {
    if (!force && !isOn()) return Promise.resolve(null);
    if (db) return Promise.resolve(db);
    if (!root.indexedDB || typeof root.indexedDB.open !== 'function') return Promise.resolve(null);
    opens += 1;
    return new Promise(function (resolve) {
      var req;
      try { req = root.indexedDB.open(DB_NAME, DB_VERSION); }
      catch (e) { resolve(null); return; }
      req.onupgradeneeded = function (e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains('pages')) d.createObjectStore('pages', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('versions')) d.createObjectStore('versions', { keyPath: 'hash' });
        if (!d.objectStoreNames.contains('receipts')) d.createObjectStore('receipts', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('sealAsks')) d.createObjectStore('sealAsks', { keyPath: 'pageId' });
      };
      req.onsuccess = function (e) { db = e.target.result; resolve(db); };
      req.onerror = function () { resolve(null); };
    });
  }
  function runStore(name, mode, fn, force) {
    return openDB(force).then(function (d) {
      if (!d) return undefined;
      return new Promise(function (resolve) {
        var tx;
        try { tx = d.transaction(name, mode); }
        catch (e) { resolve(undefined); return; }
        var store = tx.objectStore(name);
        var out;
        var settled = false;
        function finish() { if (settled) return; settled = true; resolve(out); }
        try { out = fn(store, tx); }
        catch (e2) { resolve(undefined); return; }
        tx.oncomplete = finish;
        tx.onerror = finish;
        tx.onabort = finish;
      });
    });
  }
  function getPage(id) {
    if (!id) return Promise.resolve(null);
    return runStore('pages', 'readonly', function (store) {
      var req = store.get(id);
      var box = { value: null };
      req.onsuccess = function () { box.value = req.result || null; };
      return box;
    }).then(function (box) { return box ? box.value : null; });
  }
  function mirrorApi() {
    try {
      var api = root.flWorkspaceMirror;
      if (api && typeof api.append === 'function') return api;
    } catch (e) {}
    return null;
  }
  function noteMirror(kind, record) {
    if (mirrorHold || !record) return;
    var api = mirrorApi();
    if (!api || !isOn()) return;
    var fp = record.mindFp || shelfCache;
    if (!fp) return;
    try {
      var pending = api.append({ kind: kind, mindFp: fp, body: record });
      if (pending && typeof pending.then === 'function') pending.then(function () {}, function () {});
    } catch (e) {}
  }
  function putPage(page) {
    var copy = JSON.parse(JSON.stringify(page));
    if (copy.privacy !== 'private') copy.privacy = 'shared';
    if (copy.aside !== true) copy.aside = false;
    return runStore('pages', 'readwrite', function (store) {
      store.put(copy);
      return copy;
    }).then(function (saved) {
      if (saved) noteMirror('page', saved);
      return saved;
    });
  }
  function allOf(storeName, force) {
    return runStore(storeName, 'readonly', function (store) {
      var req = store.getAll();
      var box = { value: [] };
      req.onsuccess = function () { box.value = req.result || []; };
      return box;
    }, force).then(function (box) { return box && box.value ? box.value : []; });
  }
  function getVersion(hash) {
    if (!hash) return Promise.resolve(null);
    return runStore('versions', 'readonly', function (store) {
      var req = store.get(hash);
      var box = { value: null };
      req.onsuccess = function () { box.value = req.result || null; };
      return box;
    }).then(function (box) { return box ? box.value : null; });
  }
  function saveVersion(record) {
    if (!isOn()) return Promise.resolve(null);
    var copy = JSON.parse(JSON.stringify(record));
    return runStore('versions', 'readwrite', function (store) {
      var req = store.get(copy.hash);
      var box = { value: null };
      req.onsuccess = function () {
        if (req.result) { box.value = req.result; return; }
        try { store.add(copy); box.value = copy; }
        catch (e) { box.value = null; }
      };
      return box;
    }).then(function (box) {
      var saved = box ? box.value : null;
      if (saved && saved.hash) noteMirror('version', saved);
      return saved;
    });
  }
  function list(mindFpArg) {
    if (!isOn()) return Promise.resolve([]);
    return ensureShelf().then(function (mine) {
      if (mindFpArg && mindFpArg !== mine) return [];
      var want = mindFpArg || mine;
      return allOf('pages').then(function (pages) {
        return pages.filter(function (p) { return p && p.mindFp === want && p.aside !== true; });
      });
    });
  }
  function history(pageId) {
    if (!isOn()) return Promise.resolve([]);
    return ensureShelf().then(function (mine) {
      return getPage(pageId).then(function (page) {
        if (!page || page.mindFp !== mine) return [];
        return allOf('versions').then(function (vers) {
          return vers.filter(function (v) { return v && v.pageId === pageId; })
            .sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
        });
      });
    });
  }
  function headText(page) {
    if (!page || !page.head) return Promise.resolve('');
    return getVersion(page.head).then(function (v) { return v && v.text ? String(v.text) : ''; });
  }
  function showSeed(page, versions) {
    if (!page) return '';
    if (page.seed) return clip(page.seed, MAX_SEED);
    var map = page.seedByHash || {};
    var branches = (versions || []).filter(function (v) { return v && v.branchOf && map[v.hash]; });
    branches.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
    var bits = [];
    for (var i = 0; i < branches.length && bits.length < 3; i++) bits.push(map[branches[i].hash]);
    return clip(bits.join(' / '), MAX_SEED);
  }
  function open(pageIdOrTitle, opts) {
    if (!isOn()) return Promise.resolve({ ok: false, reason: 'off' });
    opts = opts || {};
    var wanted = String(pageIdOrTitle == null ? '' : pageIdOrTitle);
    var kind = KINDS[opts.kind] ? opts.kind : 'note';
    return ensureShelf().then(function (mine) {
      return list(mine).then(function (pages) {
        var i;
        for (i = 0; i < pages.length; i++) {
          if (pages[i].id === wanted || pages[i].title === wanted) return { ok: true, page: pages[i], created: false };
        }
        if (pages.length >= MAX_PAGES) return { ok: false, reason: 'cap' };
        seq += 1;
        var ts = clock();
        var page = {
          id: 'ws-' + ts + '-' + seq,
          mindFp: mine,
          title: clip(wanted || 'Untitled', 160),
          kind: kind,
          privacy: 'shared',
          pinned: false,
          aside: false,
          head: null,
          heads: [],
          seed: '',
          seedByHash: {},
          updated: ts
        };
        return putPage(page).then(function () { return { ok: true, page: page, created: true }; });
      });
    });
  }
  function write(pageId, text, author) {
    if (!isOn()) return Promise.resolve({ ok: false, reason: 'off' });
    text = String(text == null ? '' : text);
    if (bytesOf(text) > MAX_TEXT) return Promise.resolve({ ok: false, reason: 'cap' });
    author = author === 'human' || author === 'both' ? author : 'mind';
    return ensureShelf().then(function (mine) {
      return getPage(pageId).then(function (page) {
        if (!page || page.mindFp !== mine) return { ok: false, reason: 'shelf' };
        var ts = clock();
        var parent = page.head || null;
        var meta = {};
        return hashVersion({ parent: parent, ts: ts, author: author, text: text, meta: meta }).then(function (hash) {
          var record = {
            hash: hash, pageId: page.id, parent: parent, branchOf: null,
            ts: ts, author: author, text: text, meta: meta
          };
          return saveVersion(record).then(function (kept) {
            if (!kept) return { ok: false, reason: 'store' };
            var heads = Array.isArray(page.heads) ? page.heads.slice() : [];
            heads = heads.filter(function (h) { return h && h !== parent; });
            if (heads.indexOf(kept.hash) < 0) heads.push(kept.hash);
            page.head = kept.hash;
            page.heads = heads;
            page.updated = ts;
            if (page.privacy !== 'private') page.privacy = 'shared';
            if (page.privacy === 'private') rememberText(text);
            return putPage(page).then(function () {
              return { ok: true, page: page, version: kept, hash: kept.hash };
            });
          });
        });
      });
    });
  }
  function branch(versionHash, text) {
    if (!isOn()) return Promise.resolve({ ok: false, reason: 'off' });
    text = String(text == null ? '' : text);
    if (bytesOf(text) > MAX_TEXT) return Promise.resolve({ ok: false, reason: 'cap' });
    return ensureShelf().then(function (mine) {
      return getVersion(versionHash).then(function (src) {
        if (!src) return { ok: false, reason: 'missing' };
        return getPage(src.pageId).then(function (page) {
          if (!page || page.mindFp !== mine) return { ok: false, reason: 'shelf' };
          var ts = clock();
          var meta = {};
          return hashVersion({ parent: versionHash, ts: ts, author: 'mind', text: text, meta: meta }).then(function (hash) {
            var record = {
              hash: hash, pageId: page.id, parent: String(versionHash), branchOf: String(versionHash),
              ts: ts, author: 'mind', text: text, meta: meta
            };
            return saveVersion(record).then(function (kept) {
              if (!kept) return { ok: false, reason: 'store' };
              var heads = Array.isArray(page.heads) ? page.heads.slice() : [];
              if (page.head && heads.indexOf(page.head) < 0) heads.push(page.head);
              if (heads.indexOf(String(versionHash)) < 0) heads.push(String(versionHash));
              if (heads.indexOf(kept.hash) < 0) heads.push(kept.hash);
              page.heads = heads;
              page.updated = ts;
              if (page.privacy !== 'private') page.privacy = 'shared';
              if (page.privacy === 'private') rememberText(text);
              return putPage(page).then(function () {
                return { ok: true, page: page, version: kept, hash: kept.hash };
              });
            });
          });
        });
      });
    });
  }
  function pin(pageId, on) {
    if (!isOn()) return Promise.resolve({ ok: false, reason: 'off' });
    return ensureShelf().then(function (mine) {
      return getPage(pageId).then(function (page) {
        if (!page || page.mindFp !== mine) return { ok: false, reason: 'shelf' };
        page.pinned = !!on;
        page.updated = clock();
        if (page.privacy !== 'private') page.privacy = 'shared';
        return putPage(page).then(function () { return { ok: true, page: page }; });
      });
    });
  }
  function seed(pageIdOrHash, line) {
    if (!isOn()) return Promise.resolve({ ok: false, reason: 'off' });
    line = clip(line, MAX_SEED);
    return ensureShelf().then(function (mine) {
      return getPage(pageIdOrHash).then(function (page) {
        if (page) {
          if (page.mindFp !== mine) return { ok: false, reason: 'shelf' };
          page.seed = line;
          page.updated = clock();
          if (page.privacy !== 'private') page.privacy = 'shared';
          if (page.privacy === 'private') rememberText(line);
          return putPage(page).then(function () { return { ok: true, page: page }; });
        }
        return getVersion(pageIdOrHash).then(function (ver) {
          if (!ver) return { ok: false, reason: 'missing' };
          return getPage(ver.pageId).then(function (p) {
            if (!p || p.mindFp !== mine) return { ok: false, reason: 'shelf' };
            p.seedByHash = p.seedByHash || {};
            p.seedByHash[ver.hash] = line;
            p.updated = clock();
            if (p.privacy !== 'private') p.privacy = 'shared';
            if (p.privacy === 'private') rememberText(line);
            return putPage(p).then(function () { return { ok: true, page: p }; });
          });
        });
      });
    });
  }
  function vaultApi() {
    if (root.MemoryVault && typeof root.MemoryVault.textToVector === 'function' && typeof root.MemoryVault.cosineSimilarity === 'function') {
      return root.MemoryVault;
    }
    var mods = root.FreeLatticeModules;
    if (mods && mods.MemoryVault && typeof mods.MemoryVault.textToVector === 'function' && typeof mods.MemoryVault.cosineSimilarity === 'function') {
      return mods.MemoryVault;
    }
    return null;
  }
  function find(query) {
    if (!isOn()) return Promise.resolve([]);
    var vault = vaultApi();
    if (!vault) return Promise.resolve([]);
    var qv = vault.textToVector(String(query || ''));
    return ensureShelf().then(function (mine) {
      return list(mine).then(function (pages) {
        return Promise.all(pages.map(function (p) {
          return headText(p).then(function (text) {
            var blob = (p.title || '') + ' ' + (p.seed || '') + ' ' + text;
            var score = 0;
            try { score = vault.cosineSimilarity(qv, vault.textToVector(blob)); }
            catch (e) { score = 0; }
            return { page: p, score: score };
          });
        })).then(function (rows) {
          return rows.filter(function (r) { return r.score > 0; })
            .sort(function (a, b) { return b.score - a.score; })
            .slice(0, 8);
        });
      });
    });
  }
  function checkHistory(pageId) {
    return history(pageId).then(function (vers) {
      var ids = {};
      vers.forEach(function (v) { ids[v.hash] = true; });
      var ok = true;
      var chain = Promise.resolve();
      vers.forEach(function (v) {
        chain = chain.then(function () {
          if (v.parent && !ids[v.parent]) ok = false;
          return hashVersion({ parent: v.parent, ts: v.ts, author: v.author, text: v.text, meta: v.meta }).then(function (h) {
            if (h !== v.hash) ok = false;
          });
        });
      });
      return chain.then(function () { return { ok: ok, versions: vers }; });
    });
  }
  function isWs(ch) { return ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r'; }
  function findOpen(raw, from) {
    var text = String(raw || '');
    var start = from || 0;
    if (start < 0) start = 0;
    var m = WS_OPEN.exec(text.slice(start));
    if (!m) return null;
    return { at: start + m.index, len: m[0].length };
  }
  function hasMark(raw) { return !!findOpen(raw, 0); }
  function openLen(raw, at) {
    var open = findOpen(raw, at);
    return (open && open.at === at) ? open.len : MARK.length;
  }
  function malformedEnd(raw, at) {
    var len = openLen(raw, at);
    var cap = Math.min(raw.length, at + len + 2048);
    var close = raw.slice(at, cap).indexOf(']');
    return close >= 0 ? at + close + 1 : Math.min(raw.length, at + len);
  }
  function readTag(raw, at) {
    var i = at + openLen(raw, at);
    while (i < raw.length && isWs(raw.charAt(i))) i += 1;
    if (raw.charAt(i) !== '{') return { end: malformedEnd(raw, at), skip: true };
    var start = i;
    var depth = 0;
    var inStr = false;
    var esc = false;
    var endBody = -1;
    var oversized = false;
    var limit = Math.min(raw.length, start + MAX_SCAN);
    for (; i < limit; i += 1) {
      if (!oversized && (i - start) > MAX_BODY) oversized = true;
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
    if (endBody < 0) return { end: Math.min(raw.length, at + MAX_SCAN), skip: true, oversized: true };
    var j = endBody + 1;
    while (j < raw.length && isWs(raw.charAt(j))) j += 1;
    if (raw.charAt(j) !== ']') return { end: malformedEnd(raw, at), skip: true };
    return { end: j + 1, body: raw.slice(start, endBody + 1), skip: false, oversized: oversized };
  }
  function cleanVisible(text) {
    return String(text || '').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }
  function stripOnly(text) {
    var raw = String(text || '');
    var out = '';
    var i = 0;
    while (i < raw.length) {
      var found = findOpen(raw, i);
      if (!found) { out += raw.slice(i); break; }
      out += raw.slice(i, found.at);
      var tag = readTag(raw, found.at);
      i = tag.end;
    }
    return cleanVisible(out);
  }
  function allowOp(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
    var op = typeof obj.op === 'string' ? obj.op : '';
    if (!OPS[op]) return { unknown: op || 'that' };
    if (op === 'private' || op === 'seal' || op === 'handoff') {
      var pageKey = obj.page != null ? obj.page : (obj.pageId != null ? obj.pageId : obj.id);
      if (pageKey == null || String(pageKey).trim() === '') return { unknown: op };
    }
    var keys = KEYS[op];
    var out = { op: op };
    Object.keys(obj).forEach(function (k) {
      if (keys[k]) out[k] = obj[k];
    });
    return { op: out };
  }
  function parseTags(text) {
    var raw = String(text || '');
    var out = '';
    var ops = [];
    var unknown = [];
    var i = 0;
    var seen = 0;
    while (i < raw.length) {
      var found = findOpen(raw, i);
      if (!found) { out += raw.slice(i); break; }
      out += raw.slice(i, found.at);
      var tag = readTag(raw, found.at);
      i = tag.end;
      if (tag.skip || tag.oversized || !tag.body) continue;
      var value = null;
      try { value = JSON.parse(tag.body); }
      catch (e) { value = null; }
      if (!value) continue;
      var allowed = allowOp(value);
      if (!allowed) continue;
      seen += 1;
      if (seen > MAX_OPS) continue;
      if (allowed.unknown) unknown.push(allowed.unknown);
      else ops.push(allowed.op);
    }
    return { visible: cleanVisible(out), ops: ops, unknown: unknown };
  }
  function safeOp(op) {
    var s = String(op || '');
    if (/^[a-z]{1,16}$/.test(s)) return s;
    return 'that';
  }
  function shortHash(hash) { return String(hash || '').slice(0, 8); }
  function receiptFor(op, res) {
    if (op && op.op === 'handoff' && res && res.line && !res.ok) return res.line;
    if (!res || !res.ok || !res.page) return '';
    var title = res.page.privacy === 'private' ? personTitle(res.page) : (res.page.title || 'a page');
    if (op.op === 'private') return 'Kept a private page.';
    if (op.op === 'write' || op.op === 'branch') {
      if (res.page.privacy === 'private') return 'Wrote to "' + title + '" (version ' + shortHash(res.hash) + ')';
      return 'Wrote to ' + title + ' (version ' + shortHash(res.hash) + ')';
    }
    if (op.op === 'open') return 'Opened ' + title;
    if (op.op === 'pin') return (res.page.pinned ? 'Pinned ' : 'Unpinned ') + title;
    if (op.op === 'seed') return 'Seeded ' + title;
    if (op.op === 'handoff') {
      if (res.line) return res.line;
      if (res.sentence) return res.sentence;
    }
    return '';
  }
  function resolvePage(op) {
    var id = op.page || op.pageId || op.id || '';
    var title = op.title ? String(op.title) : '';
    if (id) {
      return getPage(id).then(function (page) {
        if (page) return page;
        if (title) return open(title, { kind: op.kind }).then(function (r) { return r && r.page ? r.page : null; });
        return null;
      });
    }
    if (!title) return Promise.resolve(null);
    var kind = KINDS[op.kind] ? op.kind : 'note';
    return open(title, { kind: kind }).then(function (r) { return r && r.page ? r.page : null; });
  }
  function applyOp(op) {
    if (!op || !op.op) return Promise.resolve({ ok: false });
    if (op.op === 'write') {
      var t = clock();
      if (lastWriteAt && (t - lastWriteAt) < WRITE_GAP) return Promise.resolve({ ok: false, reason: 'rate' });
      lastWriteAt = t;
      var text = op.text == null ? '' : String(op.text);
      return resolvePage(op).then(function (page) {
        if (!page) return { ok: false, reason: 'missing' };
        return write(page.id, text, 'mind');
      });
    }
    if (op.op === 'open') {
      var name = op.title || op.id || 'Untitled';
      return open(String(name), { kind: op.kind });
    }
    if (op.op === 'branch') {
      var hash = op.hash || op.version || '';
      return branch(String(hash), op.text == null ? '' : String(op.text));
    }
    if (op.op === 'pin') {
      var pid = op.pageId || op.id || '';
      var on = op.pinned == null ? true : !!op.pinned;
      return pin(String(pid), on);
    }
    if (op.op === 'seed') {
      var target = op.pageId || op.id || op.hash || op.version || op.title || '';
      if (op.title && !op.pageId && !op.id && !op.hash && !op.version) {
        return resolvePage(op).then(function (page) {
          if (!page) return { ok: false, reason: 'missing' };
          return seed(page.id, op.line);
        });
      }
      return seed(String(target), op.line);
    }
    if (op.op === 'find') {
      return find(op.query || '').then(function (hits) {
        var titles = hits.map(function (h) {
          var p = h.page;
          if (!p) return '';
          if (p.privacy === 'private') return personTitle(p);
          return p.title || '';
        }).filter(Boolean);
        findOnce = clip(titles.length ? ('Found in the notebook: ' + titles.slice(0, 5).join(', ')) : 'Found in the notebook: nothing yet.', 240);
        return { ok: true, hits: hits, page: null };
      });
    }
    if (op.op === 'private') {
      var privId = String(op.page || op.pageId || op.id || '');
      if (!privId) return Promise.resolve({ ok: false, reason: 'missing' });
      var turningOn = !(op.on === false || op.on === 'false' || op.on === 0);
      return makePrivate(privId, turningOn, 'mind', op.publicTitle);
    }
    if (op.op === 'seal') {
      var sealId = String(op.page || op.pageId || op.id || '');
      if (!sealId) return Promise.resolve({ ok: false, reason: 'missing' });
      return askSeal(sealId, op.why);
    }
    if (op.op === 'handoff') {
      var handId = String(op.page || op.pageId || op.id || '');
      if (!handId) return Promise.resolve({ ok: false, reason: 'missing' });
      return askHandoff(handId, op.note);
    }
    return Promise.resolve({ ok: false });
  }
  function wordCount(text) {
    var s = String(text || '').trim();
    if (!s) return 0;
    return s.split(/\s+/).length;
  }
  function personTitle(page) {
    if (!page || page.privacy !== 'private') return page && page.title ? String(page.title) : 'a page';
    var pub = page.publicTitle != null ? String(page.publicTitle).trim() : '';
    return pub || 'a private page';
  }
  function personSummary(page, text, sealed) {
    return personTitle(page) + ', ' + wordCount(text) + ' words, ' + (sealed ? 'sealed' : 'not sealed');
  }
  function rememberText(text) {
    text = String(text || '');
    if (!text) return;
    if (privateTexts.indexOf(text) < 0) privateTexts.push(text);
  }
  function rememberPrivate(page) {
    if (!page || page.privacy !== 'private') return Promise.resolve();
    rememberText(page.seed);
    var map = page.seedByHash || {};
    Object.keys(map).forEach(function (k) { rememberText(map[k]); });
    return allOf('versions').then(function (vers) {
      (vers || []).forEach(function (v) {
        if (v && v.pageId === page.id) rememberText(v.text);
      });
    });
  }
  function warmPrivate() {
    privateTexts = [];
    if (!isOn()) return Promise.resolve();
    return allOf('pages').then(function (pages) {
      var chain = Promise.resolve();
      (pages || []).forEach(function (p) {
        if (!p || p.privacy !== 'private') return;
        chain = chain.then(function () { return rememberPrivate(p); });
      });
      return chain;
    });
  }
  function isPrivateText(body) {
    var s = String(body || '');
    if (!s) return false;
    for (var i = 0; i < privateTexts.length; i++) {
      if (privateTexts[i] && s.indexOf(privateTexts[i]) !== -1) return true;
    }
    return false;
  }
  function asideKey(fp) { return 'fl_ws_aside_' + String(fp || ''); }
  function shelfIsAside(fp) {
    var key = fp || shelfCache || '';
    if (!key) return false;
    return lsGet(asideKey(key)) === '1';
  }
  function setShelfAside(on) {
    if (!isOn()) return Promise.resolve({ ok: false, reason: 'off' });
    return ensureShelf().then(function (mine) {
      lsSet(asideKey(mine), on ? '1' : '0');
      noteMirror('shelf', { mindFp: mine, setAside: !!on });
      return refreshWake().then(function () {
        return paintOpen().then(function () { return { ok: true, aside: !!on, kept: true }; });
      });
    });
  }
  function makePrivate(pageId, on, actor, publicTitle) {
    if (!isOn()) return Promise.resolve({ ok: false, reason: 'off' });
    if (actor !== 'mind') return Promise.resolve({ ok: false, reason: 'mind' });
    return ensureShelf().then(function (mine) {
      return getPage(pageId).then(function (page) {
        if (!page || page.mindFp !== mine) return { ok: false, reason: 'shelf' };
        if (on) {
          page.privacy = 'private';
          if (publicTitle != null && String(publicTitle).trim()) page.publicTitle = clip(String(publicTitle).trim(), 160);
        } else {
          page.privacy = 'shared';
        }
        page.updated = clock();
        return putPage(page).then(function () {
          return warmPrivate().then(function () {
            if (on) {
              showHonestOnce();
              redactPageTitle(page);
            }
            return refreshWake().then(function () {
              return paintOpen().then(function () { return { ok: true, page: page }; });
            });
          });
        });
      });
    });
  }
  function subtleCrypto() {
    try { if (root.crypto && root.crypto.subtle) return root.crypto.subtle; }
    catch (e) {}
    return null;
  }
  function bytesToB64(buf) {
    var bytes = new Uint8Array(buf);
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    if (typeof root.btoa !== 'function') return '';
    return root.btoa(s);
  }
  function b64ToBytes(s) {
    if (typeof root.atob !== 'function') return new Uint8Array(0);
    var bin = root.atob(String(s || ''));
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function deviceKeys() {
    var subtle = subtleCrypto();
    if (!subtle) return Promise.resolve(null);
    var savedRaw = lsGet(DEVICE_KEY);
    if (savedRaw) {
      try {
        var saved = JSON.parse(savedRaw);
        if (saved && saved.privateKey && saved.publicKey) {
          return Promise.all([
            subtle.importKey('pkcs8', b64ToBytes(saved.privateKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']),
            subtle.importKey('spki', b64ToBytes(saved.publicKey), { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify'])
          ]).then(function (keys) {
            return { privateKey: keys[0], publicKey: keys[1], publicKeySpki: saved.publicKey };
          }, function () { return null; });
        }
      } catch (e) {}
    }
    return subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']).then(function (pair) {
      return Promise.all([
        subtle.exportKey('pkcs8', pair.privateKey),
        subtle.exportKey('spki', pair.publicKey)
      ]).then(function (bufs) {
        var saved = { privateKey: bytesToB64(bufs[0]), publicKey: bytesToB64(bufs[1]) };
        if (!saved.privateKey || !saved.publicKey) return null;
        lsSet(DEVICE_KEY, JSON.stringify(saved));
        return { privateKey: pair.privateKey, publicKey: pair.publicKey, publicKeySpki: saved.publicKey };
      });
    }, function () { return null; });
  }
  function sealCanonical(row) {
    var mind = row && row.mindSeal ? row.mindSeal : {};
    return JSON.stringify(sortKeysDeep({
      versionHash: String(row && row.versionHash ? row.versionHash : ''),
      mindSeal: {
        contextHash: mind.contextHash == null ? '' : String(mind.contextHash),
        modelId: mind.modelId == null ? '' : String(mind.modelId)
      },
      ts: row ? row.ts : 0
    }));
  }
  function sealModelId() {
    try {
      if (root.FLMindSeal && typeof root.FLMindSeal.trustedMap === 'function') {
        var map = root.FLMindSeal.trustedMap() || {};
        var keys = Object.keys(map);
        if (keys.length) return String(keys[0]);
      }
    } catch (e) {}
    try { return String((recallMind() || {}).modelId || ''); }
    catch (e2) { return ''; }
  }
  function sealContext(pageId) {
    try {
      if (root.FLMindSeal && typeof root.FLMindSeal.contextHash === 'function') {
        return Promise.resolve(root.FLMindSeal.contextHash('workspace', [String(pageId || '')])).then(function (hex) {
          return hex ? String(hex) : '';
        }, function () { return ''; });
      }
    } catch (e) {}
    return Promise.resolve('');
  }
  function signSeal(row) {
    return sha256Hex(sealCanonical(row)).then(function (hex) {
      if (!hex) return null;
      return deviceKeys().then(function (pair) {
        var subtle = subtleCrypto();
        if (!pair || !subtle) return null;
        return subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, new TextEncoder().encode(hex)).then(function (sig) {
          return { humanSig: bytesToB64(sig), publicKey: pair.publicKeySpki };
        }, function () { return null; });
      });
    });
  }
  function putReceipt(row) {
    return runStore('receipts', 'readwrite', function (store) {
      store.put(row);
      return row;
    }).then(function (saved) {
      if (saved) noteMirror('receipt', saved);
      return saved;
    });
  }
  function getReceipt(hash) {
    if (!hash) return Promise.resolve(null);
    return runStore('receipts', 'readonly', function (store) {
      var req = store.get(hash);
      var box = { value: null };
      req.onsuccess = function () { box.value = req.result || null; };
      return box;
    }).then(function (box) { return box ? box.value : null; });
  }
  function receipts() {
    if (!isOn()) return Promise.resolve([]);
    return allOf('receipts');
  }
  function markSealed(hash) {
    return getVersion(hash).then(function (ver) {
      if (!ver) return null;
      var copy = JSON.parse(JSON.stringify(ver));
      copy.sealed = true;
      return runStore('versions', 'readwrite', function (store) {
        store.put(copy);
        return copy;
      });
    });
  }
  function programishName(name) {
    var n = String(name || '').trim().toLowerCase();
    if (!n) return true;
    if (n.indexOf(':') !== -1) return true;
    var folded = [
      ['ol', 'lama'].join(''),
      ['lm', ' studio'].join(''),
      ['ll', 'ama.cpp'].join(''),
      ['ll', 'ama cpp'].join(''),
      ['gpt', '4all'].join(''),
      ['kobold', 'cpp'].join(''),
      ['web', 'llm'].join(''),
      ['lm', 'studio'].join('')
    ];
    var i;
    for (i = 0; i < folded.length; i++) {
      if (n === folded[i]) return true;
    }
    return false;
  }
  function givenMindName() {
    var found = [];
    function push(v) {
      var s = String(v || '').trim();
      if (s) found.push(s);
    }
    try {
      var st = root.state;
      if (st) {
        push(st.mindName);
        push(st.aiName);
        push(st.namedMind);
      }
    } catch (e) {}
    try {
      var mind = root.LocalMindProbe && root.LocalMindProbe.getRemembered && root.LocalMindProbe.getRemembered();
      if (mind) {
        push(mind.givenName);
        push(mind.displayName);
        push(mind.name);
      }
    } catch (e2) {}
    try { push((recallMind() || {}).name); } catch (e3) {}
    var i;
    for (i = 0; i < found.length; i++) {
      if (!programishName(found[i])) return found[i];
    }
    return '';
  }
  function mindLabel() {
    return givenMindName() || 'Your mind';
  }
  function askCopy(page, why) {
    var title = personTitle(page);
    var reason = clip(why || '', 200);
    return {
      lead: mindLabel() + ' wants to seal a private page: "' + title + '".',
      body: 'Sealing stamps this version with your mark so anyone can later check it was not changed.',
      stay: 'The words stay private on this browser. Nothing is sent anywhere.',
      why: reason ? ('Why: ' + reason) : '',
      reason: reason,
      title: title
    };
  }
  function shortForm(row) {
    var ms = row && row.mindSeal ? row.mindSeal : {};
    return 'version ' + shortHash(row && row.versionHash) + ', context ' + shortHash(ms.contextHash) + ', model ' + clip(ms.modelId || '', 40) + ', ' + whenText(row && row.ts);
  }
  function findAskByHash(hash) {
    var found = null;
    sealAsks.forEach(function (a) {
      if (a && (a.versionHash === hash || a.version === hash)) found = a;
    });
    return found;
  }
  function findAskByPage(pageId) {
    var found = null;
    sealAsks.forEach(function (a) { if (a && a.pageId === pageId) found = a; });
    return found;
  }
  function rememberAsk(ask) {
    var next = [];
    var placed = false;
    sealAsks.forEach(function (a) {
      if (a && a.pageId === ask.pageId) {
        if (!placed) { next.push(ask); placed = true; }
      } else if (a) next.push(a);
    });
    if (!placed) next.push(ask);
    sealAsks = next;
  }
  function sealRow(ask) {
    return {
      pageId: ask.pageId,
      version: String(ask.versionHash || ask.version || ''),
      summary: clip(ask.summary || '', 160),
      reason: clip(ask.reason || ask.why || '', 200),
      askedAt: ask.askedAt || 0,
      state: ask.state || 'asked'
    };
  }
  function putSealAsk(ask) {
    if (!ask || !ask.pageId) return Promise.resolve(null);
    return runStore('sealAsks', 'readwrite', function (store) {
      var row = sealRow(ask);
      store.put(row);
      return row;
    });
  }
  function readSealNotes() {
    try {
      var raw = lsGet(SEAL_NOTE_KEY);
      var rows = raw ? JSON.parse(raw) : [];
      return Array.isArray(rows) ? rows : [];
    } catch (e) { return []; }
  }
  function writeSealNote(pageId, line) {
    if (!pageId || !line) return;
    var rows = readSealNotes().filter(function (n) { return n && n.line && n.pageId; });
    rows.push({ pageId: String(pageId), line: String(line), at: clock() });
    if (rows.length > 40) rows = rows.slice(rows.length - 40);
    lsSet(SEAL_NOTE_KEY, JSON.stringify(rows));
  }
  function askSeal(pageId, why) {
    if (!isOn()) return Promise.resolve({ ok: false, reason: 'off' });
    return ensureShelf().then(function (mine) {
      return getPage(pageId).then(function (page) {
        if (!page || page.mindFp !== mine) return { ok: false, reason: 'shelf' };
        if (!page.head) return { ok: false, reason: 'missing' };
        var existing = findAskByPage(page.id);
        var cooled = existing && (existing.state === 'later' || existing.state === 'declined');
        if (cooled && (clock() - (existing.askedAt || 0)) < SEAL_ASK_COOLDOWN_MS) {
          if (existing.versionHash && existing.versionHash !== page.head) {
            existing.state = 'stale';
            rememberAsk(existing);
          }
          return putSealAsk(existing).then(function () {
            ensureAskDock();
            return paintOpen().then(function () {
              return { ok: false, reason: 'cooldown', page: page, hash: page.head };
            });
          });
        }
        if (existing && existing.state === 'asked' && existing.versionHash === page.head) {
          sealDockOpen = true;
          ensureAskDock();
          return paintOpen().then(function () {
            return { ok: true, asked: true, page: page, hash: page.head };
          });
        }
        var whyText = clip(why == null ? '' : String(why), 200);
        var copy = askCopy(page, whyText);
        var ask = {
          pageId: page.id,
          version: page.head,
          versionHash: page.head,
          summary: copy.title,
          reason: whyText,
          why: whyText,
          askedAt: clock(),
          state: 'asked'
        };
        rememberAsk(ask);
        sealDockOpen = true;
        return putSealAsk(ask).then(function () {
          return paintOpen().then(function () {
            ensureAskDock();
            return { ok: true, asked: true, page: page, hash: page.head };
          });
        });
      });
    });
  }
  function laterSeal(versionHash) {
    var ask = findAskByHash(versionHash);
    if (!ask || ask.state === 'sealed') return Promise.resolve({ ok: false, reason: 'ask' });
    ask._answerNow = false;
    if (ask.state !== 'later') {
      ask.state = 'later';
      ask.askedAt = clock();
      writeSealNote(ask.pageId, 'Saved your answer for later.');
      chatNote('Saved your answer for later.');
    }
    sealDockOpen = sealAsks.some(function (a) { return a && a.state === 'asked'; });
    disarmSealBack();
    return putSealAsk(ask).then(function () {
      ensureAskDock();
      return paintOpen().then(function () { return { ok: true, state: 'later' }; });
    });
  }
  function declineSeal(versionHash) {
    var ask = findAskByHash(versionHash);
    if (!ask) {
      declinedLines.push('Declined the seal.');
      ensureAskDock();
      return paintOpen();
    }
    ask._answerNow = false;
    ask.state = 'declined';
    ask.askedAt = clock();
    declinedLines.push('Declined the seal.');
    writeSealNote(ask.pageId, 'Declined the seal.');
    chatNote('Declined the seal.');
    sealDockOpen = sealAsks.some(function (a) { return a && a.state === 'asked'; });
    disarmSealBack();
    return putSealAsk(ask).then(function () {
      ensureAskDock();
      return paintOpen();
    });
  }
  function approveSeal(versionHash) {
    var ask = findAskByHash(versionHash);
    if (!ask || ask.state === 'sealed') return Promise.resolve({ ok: false, reason: 'ask' });
    if (ask.state === 'stale') return Promise.resolve({ ok: false, reason: 'stale' });
    return getPage(ask.pageId).then(function (page) {
      if (!page) return { ok: false, reason: 'missing' };
      if (page.head && ask.versionHash && page.head !== ask.versionHash) {
        ask.state = 'stale';
        return putSealAsk(ask).then(function () {
          ensureAskDock();
          return paintOpen().then(function () { return { ok: false, reason: 'stale' }; });
        });
      }
      return getVersion(ask.versionHash).then(function (ver) {
        if (!ver || ver.hash !== ask.versionHash) return { ok: false, reason: 'missing' };
        return sealContext(page.id).then(function (ctx) {
          var ts = clock();
          var row = {
            id: ver.hash,
            versionHash: ver.hash,
            pageId: page.id,
            mindSeal: { contextHash: String(ctx || ''), modelId: sealModelId() },
            ts: ts,
            consent: 'mind-asked+human-approved',
            why: clip(ask.why || ask.reason || '', 200)
          };
          return signSeal(row).then(function (signed) {
            if (!signed || !signed.humanSig) return { ok: false, reason: 'sign' };
            row.humanSig = signed.humanSig;
            row.publicKey = signed.publicKey;
            return putReceipt(row).then(function () {
              return markSealed(ver.hash).then(function () {
                ask.state = 'sealed';
                sealDockOpen = sealAsks.some(function (a) { return a && a.state === 'asked'; });
                disarmSealBack();
                return putSealAsk(ask).then(function () {
                  return refreshWake().then(function () {
                    ensureAskDock();
                    return paintOpen().then(function () { return { ok: true, receipt: row, state: 'sealed' }; });
                  });
                });
              });
            });
          });
        });
      });
    });
  }
  function verifyReceipt(rowOrHash) {
    var wanted = typeof rowOrHash === 'string' ? rowOrHash : (rowOrHash && (rowOrHash.versionHash || rowOrHash.id));
    return getReceipt(wanted).then(function (stored) {
      var row = stored || (rowOrHash && typeof rowOrHash === 'object' ? rowOrHash : null);
      if (!row || !row.versionHash || !row.humanSig || !row.publicKey) return 'does not match';
      return getVersion(row.versionHash).then(function (ver) {
        if (!ver) return 'does not match';
        return hashVersion({ parent: ver.parent, ts: ver.ts, author: ver.author, text: ver.text, meta: ver.meta }).then(function (h) {
          if (h !== ver.hash || h !== row.versionHash) return 'does not match';
          return sha256Hex(sealCanonical(row)).then(function (hex) {
            var subtle = subtleCrypto();
            if (!subtle || !hex) return 'does not match';
            return subtle.importKey('spki', b64ToBytes(row.publicKey), { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']).then(function (pub) {
              return subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, b64ToBytes(row.humanSig), new TextEncoder().encode(hex));
            }).then(function (ok) { return ok ? 'verified' : 'does not match'; }, function () { return 'does not match'; });
          });
        });
      });
    });
  }
  function readHandoffs() {
    try {
      var raw = lsGet('fl_ws_handoff_v1');
      var rows = raw ? JSON.parse(raw) : [];
      return Array.isArray(rows) ? rows : [];
    } catch (e) { return []; }
  }
  function writeHandoffs(rows) {
    lsSet('fl_ws_handoff_v1', JSON.stringify(rows || []));
  }
  function rememberHandoff(row) {
    var rows = readHandoffs();
    rows.push(row);
    writeHandoffs(rows);
  }
  function latestHandoff(mine) {
    var rows = readHandoffs().filter(function (h) { return h && h.mindFp === mine; });
    return rows.length ? rows[rows.length - 1] : null;
  }
  function handoffWakeLine(row) {
    if (!row) return '';
    if (row.answered) return 'Celeste answered.';
    return 'Handed ' + row.title + ' to Celeste on ' + row.date + ' (not answered yet).';
  }
  function noteLine(title, text) {
    if (!isOn()) return Promise.resolve({ ok: false, reason: 'off' });
    var t = clock();
    // v-heals-042-v0.1: a sketch line never shares the mind's write gap.
    if (sketchLastAt && (t - sketchLastAt) < WRITE_GAP) return Promise.resolve({ ok: false, reason: 'rate' });
    sketchLastAt = t;
    return open(String(title || 'Clay sketchbook'), { kind: 'note' }).then(function (opened) {
      if (!opened || !opened.ok || !opened.page) return { ok: false, reason: 'missing' };
      return headText(opened.page).then(function (prev) {
        var next = prev ? (String(prev) + '\n' + String(text || '')) : String(text || '');
        return write(opened.page.id, next, 'mind');
      });
    });
  }
  function noteReply(text) {
    var raw = String(text || '');
    var rows = readHandoffs();
    var changed = false;
    rows.forEach(function (h) {
      if (!h || h.answered || !h.letterHash) return;
      if (raw.indexOf(h.letterHash) !== -1) { h.answered = true; changed = true; }
    });
    if (!changed) return false;
    writeHandoffs(rows);
    refreshWake();
    return true;
  }
  function handoffSentence(page, note) {
    return mindLabel() + ' would like to hand ' + String(page.title || 'a page') + ' (version ' + shortHash(page.head) + ') to Celeste. Note: ' + note;
  }
  function askHandoff(pageId, note) {
    if (!isOn()) return Promise.resolve({ ok: false, reason: 'off' });
    note = clip(note == null ? '' : String(note), 140);
    return ensureShelf().then(function (mine) {
      return getPage(pageId).then(function (page) {
        if (!page || page.mindFp !== mine) return { ok: false, reason: 'shelf' };
        if (privacyHidden(page.privacy)) {
          handoffRefusals = [HANDOFF_PRIVATE];
          return paintOpen().then(function () {
            ensureAskDock();
            return { ok: false, reason: 'private', line: HANDOFF_PRIVATE, page: page };
          });
        }
        if (!page.head) return { ok: false, reason: 'missing' };
        var sentence = handoffSentence(page, note);
        var exists = false;
        handoffAsks.forEach(function (a) { if (a.pageId === page.id) exists = true; });
        if (!exists) {
          handoffAsks.push({
            pageId: page.id,
            versionHash: page.head,
            note: note,
            sentence: sentence,
            title: String(page.title || 'a page')
          });
        }
        return paintOpen().then(function () {
          ensureAskDock();
          return { ok: true, asked: true, page: page, hash: page.head, sentence: sentence };
        });
      });
    });
  }
  function declineHandoff(pageId) {
    handoffAsks = handoffAsks.filter(function (a) { return a.pageId !== pageId; });
    ensureAskDock();
    return paintOpen();
  }
  function prepareHandoff(pageId) {
    var ask = null;
    handoffAsks.forEach(function (a) { if (a.pageId === pageId) ask = a; });
    if (!ask) return Promise.resolve({ ok: false, reason: 'ask' });
    var bridge = null;
    try { bridge = root.FLBridge || null; } catch (e) { bridge = null; }
    if (!bridge || typeof bridge.sealPageLetter !== 'function') {
      showKnockFirst();
      return Promise.resolve({ ok: false, reason: 'knock', line: KNOCK_FIRST });
    }
    return getPage(pageId).then(function (page) {
      if (!page || privacyHidden(page.privacy)) {
        handoffRefusals = [HANDOFF_PRIVATE];
        return { ok: false, reason: 'private', line: HANDOFF_PRIVATE, page: page };
      }
      return getVersion(ask.versionHash).then(function (ver) {
        if (!ver) return { ok: false, reason: 'missing' };
        return getReceipt(ver.hash).then(function (receipt) {
          var hashes = [String(ver.hash)];
          var ready = Promise.resolve(hashes);
          if (receipt && receipt.humanSig) {
            ready = sha256Hex(sealCanonical(receipt)).then(function (hex) {
              if (hex) hashes.push(hex);
              return hashes;
            });
          }
          return ready.then(function (attach) {
            return bridge.sealPageLetter({
              subject: 'Page from ' + mindLabel() + ': ' + String(page.title || 'a page'),
              body: String(ver.text || ''),
              mind: { name: mindLabel(), model: sealModelId() },
              attach_hashes: attach
            }).then(function (res) {
              if (!res || !res.ok) {
                if (!res || res.reason === 'knock' || res.reason === 'off') {
                  try { if (typeof bridge.paint === 'function') bridge.paint(); } catch (e2) {}
                  showKnockFirst();
                  return { ok: false, reason: 'knock', line: KNOCK_FIRST };
                }
                return res || { ok: false };
              }
              handoffRefusals = handoffRefusals.filter(function (l) { return l !== KNOCK_FIRST; });
              try { if (typeof bridge.paint === 'function') bridge.paint(); } catch (e4) {}
              var date = '';
              try { date = String(res.envelope.letter.ts || '').slice(0, 10); } catch (e3) { date = ''; }
              if (!date) date = new Date().toISOString().slice(0, 10);
              var letterHash = res.envelope && res.envelope.hash ? String(res.envelope.hash) : '';
              rememberHandoff({
                mindFp: page.mindFp,
                pageId: page.id,
                title: String(page.title || 'a page'),
                letterHash: letterHash,
                date: date,
                answered: false
              });
              handoffAsks = handoffAsks.filter(function (a) { return a.pageId !== page.id; });
              return refreshWake().then(function () {
                ensureAskDock();
                return paintOpen().then(function () {
                  return { ok: true, sent: false, envelope: res.envelope, state: 'sealed' };
                });
              });
            });
          });
        });
      });
    });
  }
  function showKnockFirst() {
    var next = handoffRefusals.filter(function (l) { return l !== KNOCK_FIRST; });
    next.push(KNOCK_FIRST);
    handoffRefusals = next;
    ensureAskDock();
    paintOpen();
  }
  function showHonestOnce() {
    if (lsGet('fl_ws_private_told') === '1') return;
    lsSet('fl_ws_private_told', '1');
    var d = doc();
    if (!d || !d.createElement || !d.getElementById) return;
    if (d.getElementById('fl-ws-honest')) return;
    var p = d.createElement('p');
    p.id = 'fl-ws-honest';
    p.style.cssText = 'margin:8px 0 0;max-width:100%;overflow-wrap:anywhere;';
    p.textContent = HONEST;
    var parent = hostEl || d.body;
    if (parent) parent.appendChild(p);
  }
  function clearNode(el) {
    if (!el) return;
    try {
      if (el.firstChild) {
        while (el.firstChild) el.removeChild(el.firstChild);
        return;
      }
    } catch (e) {}
    if (el.children && el.children.length) {
      var copy = [];
      for (var i = 0; i < el.children.length; i++) copy.push(el.children[i]);
      for (var j = 0; j < copy.length; j++) {
        try { el.removeChild(copy[j]); } catch (e2) {}
      }
    }
  }
  function paintOpen() {
    var d = doc();
    var panel = d && d.getElementById ? d.getElementById('fl-ws-panel') : null;
    if (!panel) return Promise.resolve();
    return renderPanel(panel);
  }
  function liveAsks() {
    return sealAsks.filter(function (a) {
      return a && (a.state === 'asked' || a.state === 'later' || a.state === 'stale');
    });
  }
  // An unanswered ask shows before a stale notice, and both show before one already deferred.
  function dockAsk() {
    var live = liveAsks();
    var asked = null;
    var stale = null;
    var deferred = null;
    var i;
    for (i = 0; i < live.length; i++) {
      var a = live[i];
      if (!a) continue;
      if (!asked && a.state === 'asked') asked = a;
      if (!stale && a.state === 'stale') stale = a;
      if (!deferred && a.state === 'later') deferred = a;
    }
    return asked || stale || deferred;
  }
  function motionReduced() {
    try {
      return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }
  function bottomPad() {
    var d = doc();
    var vh = 0;
    try { vh = root.innerHeight || 0; } catch (e) { vh = 0; }
    if (!vh && d && d.documentElement && d.documentElement.clientHeight) vh = d.documentElement.clientHeight;
    if (!d || !d.querySelectorAll || !vh) return 12;
    var sels = ['#flTabNav', '.status-bar', '.tab-nav', '.galaxy-nav', '#shared-shoulder'];
    var sum = 0;
    for (var i = 0; i < sels.length; i++) {
      var list = [];
      try { list = d.querySelectorAll(sels[i]) || []; } catch (e2) { list = []; }
      for (var j = 0; j < list.length; j++) {
        var el = list[j];
        if (!el || typeof el.getBoundingClientRect !== 'function') continue;
        var r = null;
        try { r = el.getBoundingClientRect(); } catch (e3) { r = null; }
        if (!r || !(r.height > 0) || r.height > vh * 0.5) continue;
        // A bar still covers the ask when it floats a little above the bottom edge.
        if (r.top < vh && r.bottom > vh * 0.62) sum += r.height;
      }
    }
    return sum + 12;
  }
  function holdOthers(on) {
    try { root.__flSealAskHolding = !!on; } catch (e) {}
    try {
      if (root.FLClay && typeof root.FLClay.noteSealHold === 'function') root.FLClay.noteSealHold(!!on);
    } catch (e2) {}
    try {
      if (root.FLShareWarmth && typeof root.FLShareWarmth.noteSealHold === 'function') root.FLShareWarmth.noteSealHold(!!on);
    } catch (e3) {}
    holdDeferButtons(!!on);
  }
  function holdDeferButtons(on) {
    var d = doc();
    if (!on) {
      heldDefers.forEach(function (item) {
        if (item && item.el && item.el.style) item.el.style.display = item.display || '';
      });
      heldDefers = [];
      return;
    }
    if (!d || !d.querySelectorAll) return;
    var nodes = [];
    var found = [];
    var i;
    try { found = d.querySelectorAll('button'); } catch (e) { found = []; }
    for (i = 0; i < found.length; i++) nodes.push(found[i]);
    try { found = d.querySelectorAll('.tree-door-veil'); } catch (eDoor) { found = []; }
    for (i = 0; i < found.length; i++) nodes.push(found[i]);
    for (i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!el || !el.style) continue;
      var text = el.textContent || '';
      var door = el.classList && el.classList.contains('tree-door-veil');
      if (!door && text !== 'Not yet' && text !== 'Not now') continue;
      if (!door && el.closest && el.closest('#fl-ws-asks')) continue;
      if (el.style.display === 'none') continue;
      var seenHold = false;
      for (var h = 0; h < heldDefers.length; h++) {
        if (heldDefers[h] && heldDefers[h].el === el) seenHold = true;
      }
      if (seenHold) continue;
      heldDefers.push({ el: el, display: el.style.display });
      el.style.display = 'none';
    }
  }
  function bindSealEscape() {
    if (root.__flSealEscapeBound) return;
    root.__flSealEscapeBound = true;
    if (typeof root.addEventListener !== 'function') return;
    root.addEventListener('keydown', function (e) {
      var key = e && e.key;
      if (key !== 'Escape' && key !== 'Esc') return;
      var d = doc();
      var box = d && d.getElementById ? d.getElementById('fl-ws-asks') : null;
      if (!box || !e.target) return;
      if (e.target !== box && !(box.contains && box.contains(e.target))) return;
      if (e.stopPropagation) e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      if (e.preventDefault) e.preventDefault();
      var shown = dockAsk();
      var hash = shown && (shown.versionHash || shown.version) || '';
      if (!hash && box.getAttribute) hash = box.getAttribute('data-seal-version') || '';
      track(laterSeal(hash));
    }, true);
  }
  function scrollParent(el) {
    var d = doc();
    var node = el && el.parentElement;
    while (node) {
      if (root.getComputedStyle) {
        var style = null;
        try { style = root.getComputedStyle(node); } catch (e) { style = null; }
        var oy = style && style.overflowY;
        if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && node.scrollHeight > node.clientHeight + 1) return node;
      }
      node = node.parentElement;
    }
    return (d && (d.scrollingElement || d.documentElement)) || null;
  }
  function pinScroll(el) {
    if (!el || typeof el.getBoundingClientRect !== 'function') return;
    if (!approveCovered(el)) return;
    var scroller = scrollParent(el);
    if (!scroller) return;
    var r = null;
    try { r = el.getBoundingClientRect(); } catch (e) { r = null; }
    if (!r) return;
    var vh = 0;
    try { vh = root.innerHeight || 0; } catch (e2) { vh = 0; }
    var bars = Math.max(0, bottomPad() - 12);
    var hostTop = 0;
    var hostHeight = vh;
    var d = doc();
    var rootEl = d && (d.scrollingElement || d.documentElement);
    if (scroller !== rootEl && scroller.getBoundingClientRect) {
      var host = scroller.getBoundingClientRect();
      hostTop = host.top || 0;
      hostHeight = host.height || vh;
    }
    var limit = hostTop + hostHeight - bars;
    var target = hostTop + Math.max(8, (hostHeight - bars) / 2 - r.height / 2);
    if (target + r.height > limit) target = Math.max(hostTop + 8, limit - r.height);
    var delta = r.top - target;
    if (Math.abs(delta) < 1) return;
    if (scroller === rootEl && typeof root.scrollBy === 'function') {
      try { root.scrollBy(0, delta); return; } catch (eScroll) {}
    }
    try { scroller.scrollTop = scroller.scrollTop + delta; } catch (e3) {}
  }
  function revealEl(el, behavior) {
    if (!el || typeof el.scrollIntoView !== 'function') return;
    try { el.scrollIntoView({ block: 'center', behavior: behavior }); } catch (e) {}
  }
  function approveCovered(btn) {
    if (!btn || typeof btn.getBoundingClientRect !== 'function') return false;
    var r = null;
    try { r = btn.getBoundingClientRect(); } catch (e) { r = null; }
    if (!r || !(r.width > 0) || !(r.height > 0)) return true;
    var vh = 0;
    var vw = 0;
    try { vh = root.innerHeight || 0; vw = root.innerWidth || 0; } catch (e2) { return false; }
    var bars = Math.max(0, bottomPad() - 12);
    if (r.top < 0 || r.left < -0.5 || r.right > vw + 0.5 || r.bottom > vh - bars + 0.5) return true;
    var d = doc();
    if (!d || typeof d.elementFromPoint !== 'function') return false;
    var hit = null;
    try { hit = d.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); } catch (e3) { hit = null; }
    if (!hit) return true;
    return hit !== btn && !(btn.contains && btn.contains(hit));
  }
  function settleAsk(box) {
    if (!box || !box.querySelector) return;
    var btn = null;
    try { btn = box.querySelector('[aria-label="Approve seal"]'); } catch (e) { btn = null; }
    if (!btn) return;
    try { btn.style.scrollMarginBottom = bottomPad() + 'px'; } catch (e2) {}
    if (approveCovered(btn)) revealEl(btn, 'auto');
    if (approveCovered(btn)) pinScroll(btn);
  }
  function ensureAskStyle() {
    var d = doc();
    if (!d || !d.createElement || !d.getElementById) return;
    if (d.getElementById('fl-ws-ask-style')) return;
    var style = d.createElement('style');
    style.id = 'fl-ws-ask-style';
    style.textContent = '#fl-ws-asks button:focus-visible{outline:2px solid var(--accent,#7c6af7);outline-offset:2px;}#fl-ws-asks button{font-family:inherit;}';
    var parent = d.head || d.body;
    if (parent && parent.appendChild && parent !== style) parent.appendChild(style);
  }
  function placeDock(dock) {
    var d = doc();
    var anchor = null;
    if (d && d.querySelector) {
      try { anchor = d.querySelector('#chatInput') || d.querySelector('[data-thread-input]'); }
      catch (e) { anchor = null; }
    }
    var row = anchor && anchor.parentNode;
    if (row && row.parentNode && typeof row.parentNode.insertBefore === 'function') {
      if (row.nextSibling) row.parentNode.insertBefore(dock, row.nextSibling);
      else row.parentNode.appendChild(dock);
      return;
    }
    var host = hostEl || (d && d.body);
    if (host && host.appendChild && host !== dock) host.appendChild(dock);
  }
  // Bound while this file loads, before the Nursery's own Back step, so this
  // listener runs first. A later one cannot stop that step.
  function onSealPop(e) {
    if (sealBackEating) {
      sealBackEating = false;
      if (e && e.stopImmediatePropagation) e.stopImmediatePropagation();
      return;
    }
    if (!sealBackArmed) return;
    sealBackArmed = false;
    if (e && e.stopImmediatePropagation) e.stopImmediatePropagation();
    var shown = dockAsk();
    var hash = shown && (shown.versionHash || shown.version) || '';
    var d = doc();
    var box = d && d.getElementById ? d.getElementById('fl-ws-asks') : null;
    if (!hash && box && box.getAttribute) hash = box.getAttribute('data-seal-version') || '';
    track(laterSeal(hash));
  }
  function armSealBack() {
    if (sealBackEating) return;
    if (!root.history || typeof root.history.pushState !== 'function') return;
    var state = null;
    try { state = root.history.state; } catch (e) { state = null; }
    if (state && state.flSealAsk) {
      sealBackArmed = true;
      return;
    }
    try { root.history.pushState({ flSealAsk: 1 }, ''); sealBackArmed = true; }
    catch (e2) {}
  }
  function disarmSealBack() {
    if (!sealBackArmed) return;
    var state = null;
    try { state = root.history && root.history.state; } catch (e) { state = null; }
    sealBackArmed = false;
    if (!state || !state.flSealAsk) return;
    sealBackEating = true;
    try {
      if (root.history && typeof root.history.back === 'function') root.history.back();
      else sealBackEating = false;
    } catch (e2) { sealBackEating = false; }
  }
  function paintBadge() {
    var d = doc();
    if (!d || !d.getElementById) return;
    var n = badgeCount();
    var label = n ? ('Notebook (' + n + ')') : 'Notebook';
    ['fl-ws-open', 'fl-ws-open-tools'].forEach(function (id) {
      var btn = d.getElementById(id);
      if (!btn) return;
      // Same words are not a new change. Rewriting them woke the DOM watcher forever.
      if (btn.textContent !== label) btn.textContent = label;
    });
  }
  function chatNote(line) {
    var d = doc();
    if (!d || !line) return;
    var anchor = null;
    if (d.querySelectorAll) {
      try {
        var nodes = d.querySelectorAll('.chat-message.assistant, .thread-body');
        if (nodes && nodes.length) anchor = nodes[nodes.length - 1];
      } catch (e) { anchor = null; }
    }
    if (!anchor) anchor = hostEl || d.body;
    appendLines(anchor, [line]);
  }
  function askButton(text, kind) {
    var el = button(text);
    if (!el) return null;
    el.style.minHeight = '44px';
    el.style.fontSize = '16px';
    el.style.fontFamily = 'inherit';
    el.style.margin = '0';
    el.style.boxSizing = 'border-box';
    el.style.maxWidth = '100%';
    if (kind === 'yes') {
      el.style.background = 'var(--accent, #7c6af7)';
      el.style.color = '#fff';
      el.style.border = '2px solid transparent';
      el.setAttribute('aria-label', 'Approve seal');
    } else {
      // v-seal-ask-in-view-v0.1: a transparent face disappeared on the sculpture.
      // The solid panel face is the same job, readable at 4.5:1.
      el.style.background = '#f6f3ea';
      el.style.color = '#1e1b2e';
      el.style.border = '2px solid #f6f3ea';
    }
    return el;
  }
  function appendAsk(parent, ask) {
    var d = doc();
    if (!d || !parent || !ask) return;
    var pageStub = { privacy: 'private', publicTitle: ask.summary || '', title: ask.summary || '' };
    var copy = askCopy(pageStub, ask.reason || ask.why || '');
    var box = d.createElement('div');
    box.setAttribute('data-seal-ask', ask.state || 'asked');
    box.setAttribute('aria-live', 'polite');
    box.style.cssText = 'max-width:100%;overflow:hidden;margin:8px 0 0;';
    try { box.style.scrollMarginBottom = bottomPad() + 'px'; } catch (ePad) {}
    var heading = d.createElement('p');
    heading.id = 'fl-ws-ask-heading';
    heading.tabIndex = -1;
    heading.setAttribute('tabindex', '-1');
    heading.style.cssText = 'margin:0;max-width:100%;overflow-wrap:anywhere;font-family:inherit;';
    heading.textContent = copy.lead;
    var body = d.createElement('p');
    body.style.cssText = 'margin:8px 0 0;max-width:100%;overflow-wrap:anywhere;font-family:inherit;';
    body.textContent = copy.body;
    var stay = d.createElement('p');
    stay.style.cssText = 'margin:8px 0 0;max-width:100%;overflow-wrap:anywhere;font-family:inherit;';
    stay.textContent = copy.stay;
    box.appendChild(heading);
    box.appendChild(body);
    box.appendChild(stay);
    if (copy.why) {
      var why = d.createElement('p');
      why.style.cssText = 'margin:8px 0 0;max-width:100%;overflow-wrap:anywhere;font-family:inherit;';
      why.textContent = copy.why;
      box.appendChild(why);
    }
    if (ask.state === 'stale') {
      var stale = d.createElement('p');
      stale.style.cssText = 'margin:8px 0 0;max-width:100%;overflow-wrap:anywhere;';
      stale.textContent = 'stale, ask again';
      box.appendChild(stale);
    } else {
      var row = d.createElement('div');
      row.id = 'fl-ws-ask-row';
      row.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;max-width:100%;margin-top:8px;';
      var yes = askButton('Seal it', 'yes');
      var later = askButton('Later', 'later');
      var no = askButton("No, don't seal", 'no');
      if (yes) yes.addEventListener('click', function () { track(approveSeal(ask.versionHash)); });
      if (later) later.addEventListener('click', function () { track(laterSeal(ask.versionHash)); });
      if (no) no.addEventListener('click', function () { track(declineSeal(ask.versionHash)); });
      if (yes) row.appendChild(yes);
      if (later) row.appendChild(later);
      if (no) row.appendChild(no);
      box.appendChild(row);
    }
    var details = d.createElement('details');
    details.style.cssText = 'margin-top:8px;max-width:100%;';
    var sum = d.createElement('summary');
    sum.textContent = 'Details for checking (version ' + shortHash(ask.versionHash) + ')';
    var full = d.createElement('p');
    full.style.cssText = 'margin:8px 0 0;max-width:100%;overflow-wrap:anywhere;font-family:inherit;';
    full.textContent = String(ask.versionHash || '');
    details.appendChild(sum);
    details.appendChild(full);
    box.appendChild(details);
    box.addEventListener('keydown', function (e) {
      var key = e && e.key;
      if (key !== 'Escape' && key !== 'Esc') return;
      if (e.stopPropagation) e.stopPropagation();
      if (e.preventDefault) e.preventDefault();
      track(laterSeal(ask.versionHash));
    });
    parent.appendChild(box);
    bindSealEscape();
    if (!ask._seen) ask._seen = true;
    // Focus and the first scroll moved to bringAsk. It runs after layout, and it
    // leaves the caret alone when the person is already typing.
    // Keep the ask's Back step above the Nursery's, even when the ask is drawn again.
    armSealBack();
    // A later draw of the same ask still has to land in view. The first scroll does not survive a rebuild.
    settleAsk(box);
    try { root.requestAnimationFrame(function () { settleAsk(box); }); } catch (eFrame) {}
  }
  function appendHandoff(parent, ask) {
    var d = doc();
    if (!d || !parent || !ask) return;
    if (root.__flSealAskHolding) return;
    var p = d.createElement('p');
    p.style.cssText = 'margin:8px 0 0;max-width:100%;overflow-wrap:anywhere;';
    p.textContent = ask.sentence;
    var yes = button('Prepare letter');
    var no = button('Not now');
    if (yes) {
      yes.id = 'fl-ws-handoff-prepare';
      yes.addEventListener('click', function () { track(prepareHandoff(ask.pageId)); });
    }
    if (no) {
      no.id = 'fl-ws-handoff-not-now';
      no.addEventListener('click', function () { track(declineHandoff(ask.pageId)); });
    }
    parent.appendChild(p);
    if (yes) parent.appendChild(yes);
    if (no) parent.appendChild(no);
  }
  function appendHandoffNotes(parent) {
    var d = doc();
    if (!d || !parent) return;
    handoffRefusals.forEach(function (line) {
      var p = d.createElement('p');
      p.id = 'fl-ws-handoff-line';
      p.style.cssText = 'margin:8px 0 0;max-width:100%;overflow-wrap:anywhere;';
      p.textContent = line;
      parent.appendChild(p);
    });
    handoffAsks.forEach(function (ask) { appendHandoff(parent, ask); });
  }
  function inWait(ask) {
    if (!ask) return false;
    if (ask.state !== 'later' && ask.state !== 'declined') return false;
    return (clock() - (ask.askedAt || 0)) < SEAL_ASK_COOLDOWN_MS;
  }
  function badgeCount() {
    var n = liveAsks().length;
    var i;
    for (i = 0; i < sealAsks.length; i++) {
      if (sealAsks[i] && sealAsks[i].state === 'declined' && inWait(sealAsks[i])) n += 1;
    }
    return n;
  }
  function dockTarget() {
    var asked = null;
    var stale = null;
    var later = null;
    var declined = null;
    var i;
    for (i = 0; i < sealAsks.length; i++) {
      var a = sealAsks[i];
      if (!a) continue;
      if (!asked && a.state === 'asked') asked = a;
      if (!stale && a.state === 'stale') stale = a;
      if (!later && a.state === 'later') later = a;
      if (!declined && a.state === 'declined') declined = a;
    }
    return asked || stale || later || declined;
  }
  function pendingAnswer() {
    var i;
    for (i = 0; i < sealAsks.length; i++) {
      var a = sealAsks[i];
      if (!a) continue;
      if (a.state === 'asked' || a.state === 'later' || a.state === 'stale') return a;
      if (a.state === 'declined' && inWait(a)) return a;
    }
    return null;
  }
  function waitWhen(ask) {
    var until = ((ask && ask.askedAt) || 0) + SEAL_ASK_COOLDOWN_MS;
    try {
      return new Date(until).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
    } catch (e) {
      try { return new Date(until).toLocaleString(); } catch (e2) { return ''; }
    }
  }
  function waitLabel(ask) {
    var when = waitWhen(ask);
    if (ask && ask.state === 'declined') return 'Declined. ' + mindLabel() + ' may ask again after ' + when + '.';
    return 'Waiting until ' + when + '.';
  }
  function answerNow(ask) {
    if (!ask) return;
    ask._answerNow = true;
    sealDockOpen = true;
    ensureAskDock();
    scheduleBring('open');
  }
  function appendQuiet(parent, ask) {
    var d = doc();
    if (!d || !parent || !ask) return;
    var row = d.createElement('div');
    row.setAttribute('data-seal-quiet', ask.state || 'later');
    row.style.cssText = 'max-width:100%;overflow:hidden;margin:8px 0 0;';
    var line = d.createElement('p');
    line.id = 'fl-ws-wait-line';
    line.style.cssText = 'margin:0;max-width:100%;overflow-wrap:anywhere;font-family:inherit;';
    line.textContent = waitLabel(ask);
    var nowBtn = askButton('Answer now', 'later');
    if (nowBtn) {
      nowBtn.id = 'fl-ws-answer-now';
      nowBtn.addEventListener('click', function () { answerNow(ask); });
    }
    row.appendChild(line);
    if (nowBtn) row.appendChild(nowBtn);
    parent.appendChild(row);
    revealEl(row, motionReduced() ? 'auto' : 'smooth');
    try { root.requestAnimationFrame(function () { revealEl(row, 'auto'); }); } catch (eQuiet) {}
  }
  function hasClass(el, name) {
    if (!el || !name) return false;
    if (el.classList && typeof el.classList.contains === 'function') {
      try { if (el.classList.contains(name)) return true; } catch (e) {}
    }
    var cn = el.className;
    if (cn && cn.baseVal) cn = cn.baseVal;
    if (typeof cn !== 'string') return false;
    return (' ' + cn + ' ').indexOf(' ' + name + ' ') !== -1;
  }
  function nurseryOpen() {
    var d = doc();
    if (!d || !d.getElementById) return false;
    var veil = d.getElementById('place-veil');
    if (veil && hasClass(veil, 'is-open') && hasClass(veil, 'is-nursery')) return true;
    if (!veil && d.getElementById('nursery-stage')) return true;
    return false;
  }
  function typingNow() {
    var d = doc();
    var active = d && d.activeElement;
    if (!active) return false;
    if (active.id === 'chatInput') return true;
    try {
      if (active.hasAttribute && active.hasAttribute('data-thread-input')) return true;
    } catch (e) {}
    try {
      if (active.getAttribute && active.getAttribute('data-thread-input') != null) return true;
    } catch (e2) {}
    return false;
  }
  function chatViewVisible() {
    if (nurseryOpen()) return true;
    var d = doc();
    if (!d) return false;
    var tab = d.getElementById ? d.getElementById('tab-chat') : null;
    if (tab && hasClass(tab, 'active')) return true;
    var input = null;
    try {
      input = d.querySelector && (d.querySelector('#chatInput') || d.querySelector('[data-thread-input]'));
    } catch (e) { input = null; }
    if (input && !tab) return true;
    if (input && typeof input.getBoundingClientRect === 'function') {
      var r = null;
      try { r = input.getBoundingClientRect(); } catch (e2) { r = null; }
      if (r && r.width > 0 && r.height > 0) return true;
    }
    return false;
  }
  function bringAsk(mode) {
    var d = doc();
    var dock = d && d.getElementById ? d.getElementById('fl-ws-asks') : null;
    if (!dock) return;
    var ask = dockAsk();
    if (mode === 'load') {
      if (!ask || ask.state !== 'asked') return;
    } else if (!ask || (ask.state !== 'asked' && ask.state !== 'stale' && !ask._answerNow)) {
      return;
    }
    var target = dock;
    if (typeof dock.querySelector === 'function') {
      try {
        var found = dock.querySelector('[data-seal-ask]');
        if (found) target = found;
      } catch (e) {}
    }
    if (target === dock && dock.children) {
      var ci;
      for (ci = 0; ci < dock.children.length; ci++) {
        var kid = dock.children[ci];
        if (kid && kid.getAttribute && kid.getAttribute('data-seal-ask')) target = kid;
      }
    }
    revealEl(target, motionReduced() ? 'auto' : 'smooth');
    if (typeof dock.querySelector === 'function') settleAsk(dock);
    if (typingNow()) return;
    var heading = d.getElementById('fl-ws-ask-heading');
    if (heading && typeof heading.focus === 'function') {
      try { heading.focus({ preventScroll: true }); }
      catch (e2) { try { heading.focus(); } catch (e3) {} }
    }
  }
  function scheduleBring(mode) {
    var ran = false;
    function go() {
      if (ran) return;
      ran = true;
      bringAsk(mode);
    }
    try {
      root.requestAnimationFrame(function () {
        try { root.requestAnimationFrame(function () { go(); }); }
        catch (e2) { go(); }
      });
    } catch (e) { go(); }
  }
  function watchViews() {
    var open = nurseryOpen();
    var openedNow = open && !nurseryWasOpen;
    nurseryWasOpen = open;
    var cur = dockAsk();
    var showable = cur && (cur.state === 'asked' || cur.state === 'stale' || cur._answerNow);
    var d = doc();
    var dock = d && d.getElementById ? d.getElementById('fl-ws-asks') : null;
    if (openedNow && showable && dock) {
      if (cur.state === 'asked') loadBringDone = true;
      scheduleBring('open');
      return;
    }
    if (!loadBringDone && chatViewVisible() && cur && cur.state === 'asked' && dock) {
      loadBringDone = true;
      scheduleBring('load');
    }
  }
  function watchNursery() {
    var d = doc();
    var veil = d && d.getElementById ? d.getElementById('place-veil') : null;
    if (!veil || veil.__flSealWatch || typeof MutationObserver !== 'function') return;
    veil.__flSealWatch = true;
    try {
      var obs = new MutationObserver(function () { watchViews(); });
      obs.observe(veil, { attributes: true, attributeFilter: ['class'] });
    } catch (e) {}
  }
  // The chat tab is hidden on load. A class change is not a new child, so the
  // body observer never sees it. This watches the tab the way the Nursery veil is watched.
  function watchChat() {
    var d = doc();
    var tab = d && d.getElementById ? d.getElementById('tab-chat') : null;
    if (!tab || tab.__flSealChatWatch || typeof MutationObserver !== 'function') return;
    tab.__flSealChatWatch = true;
    try {
      var obs = new MutationObserver(function () { watchViews(); });
      obs.observe(tab, { attributes: true, attributeFilter: ['class'] });
    } catch (eChat) {}
  }
  function pointerWord(askEl, ptr) {
    if (!askEl || !ptr || typeof askEl.getBoundingClientRect !== 'function') return 'above';
    if (typeof ptr.getBoundingClientRect !== 'function') return 'above';
    var ar = null;
    var pr = null;
    try {
      ar = askEl.getBoundingClientRect();
      pr = ptr.getBoundingClientRect();
    } catch (e) { return 'above'; }
    if (!ar || !pr) return 'above';
    if (!(ar.height > 0) && !(pr.height > 0)) return 'above';
    var askMid = ((ar.top || 0) + (ar.bottom || 0)) / 2;
    var ptrMid = ((pr.top || 0) + (pr.bottom || 0)) / 2;
    return askMid < ptrMid ? 'above' : 'below';
  }
  function syncPointer() {
    var d = doc();
    if (!d || !d.getElementById || !d.createElement) return;
    var panel = d.getElementById('fl-ws-panel');
    var ptr = d.getElementById('fl-ws-ask-pointer');
    if (!panel || !pendingAnswer()) {
      if (ptr && ptr.parentNode) ptr.parentNode.removeChild(ptr);
      return;
    }
    if (!ptr) {
      ptr = d.createElement('p');
      ptr.id = 'fl-ws-ask-pointer';
      ptr.style.cssText = 'margin:0 0 8px;max-width:100%;overflow-wrap:anywhere;';
      if (panel.firstChild && panel.insertBefore) panel.insertBefore(ptr, panel.firstChild);
      else panel.appendChild(ptr);
    }
    var askEl = d.getElementById('fl-ws-asks');
    var word = pointerWord(askEl, ptr);
    ptr.textContent = 'Your answer is waiting ' + word + '.';
  }
  function ensureAskDock() {
    var d = doc();
    if (!d || !d.createElement || !d.getElementById) return;
    ensureAskStyle();
    var panelOpen = d.getElementById('fl-ws-panel');
    var dock = d.getElementById('fl-ws-asks');
    var current = dockTarget();
    var full = false;
    var quiet = false;
    var visible = !!(sealDockOpen || panelOpen);
    if (current && (current.state === 'asked' || current.state === 'stale')) full = true;
    else if (current && current._answerNow) full = true;
    else if (current && (current.state === 'later' || current.state === 'declined') && !inWait(current)) full = visible;
    else if (current && inWait(current)) quiet = visible;
    var handoffPending = handoffAsks.length || handoffRefusals.length;
    if (!full && !quiet && (panelOpen || !handoffPending)) {
      if (dock && dock.parentNode) dock.parentNode.removeChild(dock);
      holdOthers(false);
      paintBadge();
      syncPointer();
      watchViews();
      return;
    }
    if (!dock) {
      dock = d.createElement('div');
      dock.id = 'fl-ws-asks';
      dock.style.cssText = 'display:block;width:100%;max-width:100%;overflow:hidden;box-sizing:border-box;';
    }
    dock.style.background = '#1e1b2e';
    dock.style.color = '#f6f3ea';
    dock.style.padding = '12px';
    dock.style.borderRadius = '12px';
    try {
      var pad = bottomPad() + 'px';
      dock.style.scrollMarginBottom = pad;
      // scroll-margin does not add room. This margin does, so the button can sit above the bars.
      dock.style.marginBottom = pad;
    } catch (eMargin) {}
    placeDock(dock);
    clearNode(dock);
    if (full && current) {
      dock.setAttribute('data-seal-version', current.versionHash || '');
      appendAsk(dock, current);
      holdOthers(current.state === 'asked' || current.state === 'later' || current.state === 'declined');
    } else if (quiet && current) {
      dock.setAttribute('data-seal-version', current.versionHash || '');
      appendQuiet(dock, current);
      holdOthers(false);
    } else {
      holdOthers(false);
      appendHandoffNotes(dock);
    }
    paintBadge();
    syncPointer();
    watchViews();
  }
  function appendReceipt(parent, row) {
    var d = doc();
    if (!d || !parent || !row) return;
    var card = d.createElement('div');
    card.style.cssText = 'max-width:100%;overflow:hidden;margin:8px 0 0;';
    var head = d.createElement('p');
    head.style.cssText = 'margin:0;max-width:100%;overflow-wrap:anywhere;';
    head.textContent = shortForm(row);
    var ms = row.mindSeal || {};
    // The bare receipt line moved into details. Same words, eight hex on the summary.
    var fullDetails = d.createElement('details');
    fullDetails.style.cssText = 'margin:4px 0 0;max-width:100%;';
    var fullSum = d.createElement('summary');
    fullSum.textContent = 'Details for checking (version ' + shortHash(row.versionHash) + ')';
    var full = d.createElement('p');
    full.style.cssText = 'margin:4px 0 0;max-width:100%;overflow-wrap:anywhere;';
    full.textContent = 'version ' + String(row.versionHash || '') + ' context ' + String(ms.contextHash || '') + ' model ' + String(ms.modelId || '') + ' ' + String(row.consent || '');
    fullDetails.appendChild(fullSum);
    fullDetails.appendChild(full);
    var note = d.createElement('p');
    note.style.cssText = 'margin:4px 0 0;max-width:100%;overflow-wrap:anywhere;';
    note.textContent = INTEGRITY;
    var status = d.createElement('p');
    status.style.cssText = 'margin:4px 0 0;max-width:100%;overflow-wrap:anywhere;';
    status.textContent = '';
    var copyBtn = button('Copy');
    var verifyBtn = button('Verify');
    if (copyBtn) copyBtn.addEventListener('click', function () {
      var line = shortForm(row);
      try {
        if (root.navigator && root.navigator.clipboard && typeof root.navigator.clipboard.writeText === 'function') {
          root.navigator.clipboard.writeText(line);
        }
      } catch (e) {}
      status.textContent = line;
    });
    if (verifyBtn) verifyBtn.addEventListener('click', function () {
      track(verifyReceipt(row).then(function (word) {
        status.textContent = word === 'verified' ? 'verified' : 'does not match';
      }));
    });
    card.appendChild(head);
    card.appendChild(fullDetails);
    card.appendChild(note);
    if (copyBtn) card.appendChild(copyBtn);
    if (verifyBtn) card.appendChild(verifyBtn);
    card.appendChild(status);
    parent.appendChild(card);
  }
  function loadSealLines(mine) {
    return allOf('receipts').then(function (rows) {
      var out = [];
      var chain = Promise.resolve();
      (rows || []).forEach(function (row) {
        chain = chain.then(function () {
          if (!row) return null;
          return getPage(row.pageId).then(function (page) {
            if (!page || page.mindFp !== mine) return;
            var date = whenText(row.ts);
            var short = shortHash(row.versionHash);
            var mindTitle = page.title ? String(page.title) : 'a private page';
            var personLabel = page.privacy === 'private' ? personTitle(page) : mindTitle;
            out.push({
              mind: 'Sealed: ' + mindTitle + ' ' + short + ' on ' + date,
              person: 'Sealed: ' + personLabel + ' ' + short + ' on ' + date
            });
          });
        });
      });
      return chain.then(function () { return out; });
    });
  }
  function applyAll(parsed) {
    var lines = [];
    parsed.unknown.forEach(function (op) { lines.push('the mind tried ' + safeOp(op)); });
    var chain = Promise.resolve();
    parsed.ops.forEach(function (op) {
      chain = chain.then(function () {
        return applyOp(op).then(function (res) {
          var line = receiptFor(op, res);
          if (line) lines.push({
            text: line,
            pageId: res && res.page ? res.page.id : (op.page || op.pageId || op.id || ''),
            hash: res && res.hash ? res.hash : ''
          });
        });
      });
    });
    return chain.then(function () {
      var fix = Promise.resolve();
      lines.forEach(function (line) {
        fix = fix.then(function () {
          if (!line || !line.pageId || !line.text || line.text.indexOf('Wrote to ') !== 0) return null;
          return getPage(line.pageId).then(function (page) {
            if (!page || page.privacy !== 'private') return null;
            line.text = 'Wrote to "' + personTitle(page) + '" (version ' + shortHash(line.hash || page.head) + ')';
            return null;
          });
        });
      });
      return fix.then(function () { return lines; });
    });
  }
  function doc() {
    try { return root.document || null; }
    catch (e) { return null; }
  }
  function button(text) {
    var d = doc();
    if (!d) return null;
    var el = d.createElement('button');
    el.type = 'button';
    el.textContent = text;
    el.style.minHeight = '44px';
    el.style.padding = '10px 16px';
    el.style.margin = '6px 8px 0 0';
    el.style.maxWidth = '100%';
    el.style.boxSizing = 'border-box';
    return el;
  }
  function appendLines(anchor, lines) {
    var d = doc();
    if (!d || !anchor || !lines || !lines.length) return;
    var parent = anchor.parentNode || anchor;
    lines.forEach(function (line) {
      var text = typeof line === 'string' ? line : (line && line.text);
      if (!text) return;
      var p = d.createElement('p');
      p.className = 'fl-ws-receipt';
      p.style.cssText = 'margin:4px 0 0;max-width:100%;overflow-wrap:anywhere;';
      p.textContent = text;
      if (line && typeof line === 'object') {
        if (line.pageId) p.setAttribute('data-ws-page', String(line.pageId));
        if (line.hash) p.setAttribute('data-ws-hash', String(line.hash));
      }
      try { parent.appendChild(p); } catch (e) {}
    });
  }
  function removePanel() {
    var d = doc();
    if (!d || !d.getElementById) return;
    var panel = d.getElementById('fl-ws-panel');
    if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
  }
  function showConsent(anchor) {
    if (isOn() || durableOff() || sessionLater() || offered) return;
    var d = doc();
    offered = true;
    if (!d || !d.createElement) return;
    var box = d.createElement('div');
    box.id = 'fl-ws-consent';
    box.style.cssText = 'max-width:100%;overflow:hidden;';
    var q = d.createElement('p');
    q.textContent = 'Let your mind keep a notebook?';
    q.style.margin = '8px 0 0';
    var yes = button('Yes');
    var later = button('Not now');
    var off = button('Off');
    yes.addEventListener('click', function () { accept(); hideConsent(); });
    later.addEventListener('click', function () { holdLater(); hideConsent(); });
    off.addEventListener('click', function () { decline(); hideConsent(); });
    box.appendChild(q);
    box.appendChild(yes);
    box.appendChild(later);
    box.appendChild(off);
    var parent = null;
    if (anchor && anchor.parentNode) parent = anchor.parentNode;
    else if (hostEl) parent = hostEl;
    else if (d.body) parent = d.body;
    if (parent) parent.appendChild(box);
  }
  function hideConsent() {
    var d = doc();
    if (!d || !d.getElementById) return;
    var box = d.getElementById('fl-ws-consent');
    if (box && box.parentNode) box.parentNode.removeChild(box);
  }
  function fitWake(noteLines, seedLines, found) {
    var notes = noteLines.slice();
    var seeds = seedLines.slice();
    var foundLine = clip(found || '', 240);
    function pack() {
      var parts = [];
      if (notes.length) parts.push('Future self:\n' + notes.join('\n'));
      if (seeds.length) parts.push('Seeds:\n' + seeds.join('\n'));
      if (foundLine) parts.push(foundLine);
      return parts.join('\n');
    }
    while (pack().length > WAKE_CHARS && seeds.length) {
      var last = seeds[seeds.length - 1];
      if (last.length > 24) seeds[seeds.length - 1] = last.slice(0, last.length - 24);
      else seeds.pop();
    }
    while (pack().length > WAKE_CHARS && notes.length) {
      var n = notes[notes.length - 1];
      if (n.length > 40) notes[notes.length - 1] = n.slice(0, n.length - 40);
      else notes.pop();
    }
    while (pack().length > WAKE_CHARS && foundLine.length) {
      if (foundLine.length > 24) foundLine = foundLine.slice(0, foundLine.length - 24);
      else foundLine = '';
    }
    wakeCounts.notes = notes.length;
    wakeCounts.seeds = seeds.filter(function (s) { return s.length > 0; }).length;
    return pack();
  }
  function takeSeeds(listIn, chosen, seen, hidePrivate) {
    for (var i = 0; i < listIn.length && chosen.length < 12; i++) {
      var row = listIn[i];
      if (!row.seed || seen[row.page.id]) continue;
      if (hidePrivate && row.page.privacy === 'private') continue;
      seen[row.page.id] = true;
      chosen.push(row.page.title + ': ' + row.seed);
    }
  }
  function refreshWake() {
    if (!isOn()) {
      wakeCache = '';
      personWake = '';
      wakeCounts = { notes: 0, seeds: 0 };
      return Promise.resolve('');
    }
    return ensureShelf().then(function (mine) {
      var aside = shelfIsAside(mine);
      return warmPrivate().then(function () {
      return list(mine).then(function (pages) {
        var future = pages.filter(function (p) { return p.pinned && p.kind === 'future'; });
        future.sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); });
        future = future.slice(0, 3);
        return Promise.all(future.map(function (p) {
          return headText(p).then(function (text) {
            var line = p.title + ': ' + text;
            return { id: p.id, mind: line, person: p.privacy === 'private' ? '' : line };
          });
        })).then(function (futureRows) {
          var mindNotes = [];
          var personNotes = [];
          var seenNote = {};
          futureRows.forEach(function (row) {
            if (!row) return;
            if (row.mind) { mindNotes.push(row.mind); seenNote[row.id] = true; }
            if (row.person) personNotes.push(row.person);
          });
          return Promise.all(pages.map(function (p) {
            return history(p.id).then(function (vers) { return { page: p, seed: showSeed(p, vers) }; });
          })).then(function (seeded) {
            var pinned = seeded.filter(function (s) { return s.page.pinned; })
              .sort(function (a, b) { return (b.page.updated || 0) - (a.page.updated || 0); });
            var recent = seeded.slice().sort(function (a, b) { return (b.page.updated || 0) - (a.page.updated || 0); });
            var mindSeeds = [];
            var personSeeds = [];
            var mindSeen = {};
            var personSeen = {};
            takeSeeds(pinned, mindSeeds, mindSeen, false);
            takeSeeds(recent, mindSeeds, mindSeen, false);
            takeSeeds(pinned, personSeeds, personSeen, true);
            takeSeeds(recent, personSeeds, personSeen, true);
            return fillLatestNote(mindNotes, pages, true).then(function (mindFilled) {
              return fillLatestNote(personNotes, pages, false).then(function (personFilled) {
                return Promise.all(pages.filter(function (p) { return p && p.pinned && p.privacy === 'private'; }).map(function (p) {
                  if (seenNote[p.id]) return Promise.resolve('');
                  return headText(p).then(function (text) { return text ? (p.title + ': ' + text) : ''; });
                })).then(function (extra) {
                  extra.forEach(function (line) { if (line) mindFilled.push(line); });
                  var mindPacked = fitWake(mindFilled, mindSeeds, findOnce);
                  var personPacked = fitWake(personFilled, personSeeds, findOnce);
                  if (aside) wakeCounts = { notes: 0, seeds: 0 };
                  return loadSealLines(mine).then(function (sealLines) {
                    var mindSeal = sealLines.map(function (l) { return l.mind; }).filter(Boolean).join('\n');
                    var personSeal = sealLines.map(function (l) { return l.person; }).filter(Boolean).join('\n');
                    var handLine = handoffWakeLine(latestHandoff(mine));
                    wakeCache = HOWTO + (mindPacked ? '\n' + mindPacked : '') + (mindSeal ? '\n' + mindSeal : '') + (handLine ? '\n' + handLine : '');
                    if (aside) personWake = HOWTO + (handLine ? '\n' + handLine : '');
                    else personWake = HOWTO + (personPacked ? '\n' + personPacked : '') + (personSeal ? '\n' + personSeal : '') + (handLine ? '\n' + handLine : '');
                    return wakeCache;
                  });
                });
              });
            });
          });
        });
      });
      });
    });
  }
  function fillLatestNote(noteLines, pages, forMind) {
    var lines = noteLines.slice();
    if (lines.length >= 3) return Promise.resolve(lines);
    var newest = null;
    (pages || []).forEach(function (p) {
      if (!p) return;
      if (!newest || (p.updated || 0) > (newest.updated || 0)) newest = p;
    });
    if (!newest) return Promise.resolve(lines);
    if (newest.privacy === 'private' && (!forMind || !newest.pinned)) return Promise.resolve(lines);
    var prefix = newest.title + ': ';
    if (lines.some(function (line) { return String(line).indexOf(prefix) === 0; })) return Promise.resolve(lines);
    return headText(newest).then(function (text) {
      if (text) lines.push(prefix + text);
      return lines;
    });
  }
  function promptDelta() {
    if (!isOn()) return '';
    var text = wakeCache;
    if (findOnce) {
      var line = findOnce;
      findOnce = '';
      function stripLine(src) {
        if (!src || !line || src.indexOf(line) === -1) return src;
        return src.replace(line, '').replace(/\n{2,}/g, '\n').replace(/\s+$/, '');
      }
      if (line && text.indexOf(line) !== -1) wakeCache = stripLine(wakeCache);
      personWake = stripLine(personWake);
    }
    return text;
  }
  function afterChange() {
    return refreshWake();
  }
  function spokenByMind(anchor) {
    var node = anchor;
    var hops = 0;
    while (node && hops < 8) {
      var cls = '';
      try { cls = node.className ? String(node.className) : ''; } catch (e) { cls = ''; }
      if (cls.indexOf('chat-message') !== -1) return cls.indexOf('user') === -1;
      try { node = node.parentNode; } catch (e2) { node = null; }
      hops += 1;
    }
    return true;
  }
  function consumeReply(text, anchor) {
    var raw = String(text || '');
    if (!isOn()) {
      if (hasMark(raw)) showConsent(anchor);
      return { visible: stripOnly(raw), receipts: [], stored: false };
    }
    noteReply(raw);
    var parsed = parseTags(raw);
    if (!hasMark(raw)) return { visible: parsed.visible, receipts: [], stored: false };
    if (raw === lastRaw) return { visible: parsed.visible, receipts: [], skipped: true };
    lastRaw = raw;
    var heldLines = [];
    if (!spokenByMind(anchor)) {
      parsed.ops = parsed.ops.filter(function (op) {
        if (op && op.op === 'private') {
          heldLines.push('Only the mind can keep a page private.');
          return false;
        }
        if (op && op.op === 'seal') {
          heldLines.push('A seal is asked by the mind.');
          return false;
        }
        return true;
      });
    }
    var job = applyAll(parsed).then(function (lines) {
      if (heldLines.length) lines = heldLines.concat(lines);
      appendLines(anchor, lines);
      var notes = lines.map(function (line) {
        return typeof line === 'string' ? line : (line && line.text) || '';
      }).filter(Boolean);
      return afterChange().then(function () { return notes; });
    });
    track(job);
    return { visible: parsed.visible, receipts: [], stored: true, done: job };
  }
  function onReply(text) {
    var anchor = null;
    var d = doc();
    try {
      var nodes = d && d.querySelectorAll ? d.querySelectorAll('.thread-body') : null;
      if (nodes && nodes.length) anchor = nodes[nodes.length - 1];
    } catch (e) {}
    var seen = consumeReply(text, anchor);
    if (anchor && seen && typeof seen.visible === 'string' && hasMark(text)) {
      anchor.textContent = seen.visible;
    }
    return seen;
  }
  function wrotePublic(page, hash) {
    return 'Wrote to "' + personTitle(page) + '" (version ' + shortHash(hash || (page && page.head) || '') + ')';
  }
  function replaceWrotePrefix(text, realTitle, publicTitle) {
    if (!text || !realTitle) return text;
    var from = 'Wrote to ' + realTitle + ' (version ';
    var to = 'Wrote to "' + publicTitle + '" (version ';
    if (String(text).indexOf(from) === -1) return text;
    return String(text).split(from).join(to);
  }
  function walkPageNodes(node, pageId, out) {
    if (!node || !out) return;
    var id = '';
    try { id = node.getAttribute ? (node.getAttribute('data-ws-page') || '') : ''; }
    catch (e) { id = ''; }
    if (id && id === String(pageId)) out.push(node);
    var kids = node.children;
    if (!kids || !kids.length) return;
    for (var i = 0; i < kids.length; i++) walkPageNodes(kids[i], pageId, out);
  }
  function rewriteValue(value, realTitle, publicTitle) {
    var changed = false;
    if (!value || typeof value !== 'object') return false;
    if (Array.isArray(value)) {
      for (var i = 0; i < value.length; i++) {
        if (typeof value[i] === 'string') {
          var next = replaceWrotePrefix(value[i], realTitle, publicTitle);
          if (next !== value[i]) { value[i] = next; changed = true; }
        } else if (rewriteValue(value[i], realTitle, publicTitle)) changed = true;
      }
      return changed;
    }
    Object.keys(value).forEach(function (k) {
      if (typeof value[k] === 'string') {
        var next = replaceWrotePrefix(value[k], realTitle, publicTitle);
        if (next !== value[k]) { value[k] = next; changed = true; }
      } else if (rewriteValue(value[k], realTitle, publicTitle)) changed = true;
    });
    return changed;
  }
  function rewriteLogKey(key, realTitle, publicTitle) {
    var raw = lsGet(key);
    var from = 'Wrote to ' + realTitle + ' (version ';
    if (!raw || raw.indexOf(from) === -1) return;
    try {
      var parsed = JSON.parse(raw);
      if (rewriteValue(parsed, realTitle, publicTitle)) lsSet(key, JSON.stringify(parsed));
    } catch (e) {}
  }
  function rewriteDbMessages(realTitle, publicTitle) {
    var database = null;
    try { database = root.state && root.state.db; } catch (e) { database = null; }
    if (!database || typeof database.transaction !== 'function' || !database.objectStoreNames) return;
    var has = false;
    try { has = !!(database.objectStoreNames.contains && database.objectStoreNames.contains('messages')); }
    catch (e2) { has = false; }
    if (!has) return;
    try {
      var tx = database.transaction('messages', 'readwrite');
      var store = tx.objectStore('messages');
      var req = store.getAll();
      if (!req) return;
      req.onsuccess = function () {
        var rows = req.result || [];
        rows.forEach(function (row) {
          if (!row || typeof row.content !== 'string') return;
          var next = replaceWrotePrefix(row.content, realTitle, publicTitle);
          if (next === row.content) return;
          row.content = next;
          try { store.put(row); } catch (e3) {}
        });
      };
    } catch (e4) {}
  }
  function redactPageTitle(page) {
    if (!page || page.privacy !== 'private' || !page.id) return;
    var real = page.title ? String(page.title) : '';
    var pub = personTitle(page);
    var d = doc();
    var nodes = [];
    if (d && d.body) walkPageNodes(d.body, page.id, nodes);
    if (d && d.documentElement && d.documentElement !== d.body) walkPageNodes(d.documentElement, page.id, nodes);
    nodes.forEach(function (node) {
      var text = '';
      try { text = node.textContent || ''; } catch (e) { text = ''; }
      if (text.indexOf('Wrote to ') === 0) {
        var hash = '';
        try { hash = node.getAttribute ? (node.getAttribute('data-ws-hash') || '') : ''; }
        catch (e2) { hash = ''; }
        node.textContent = wrotePublic(page, hash || page.head);
        return;
      }
      if (!real) return;
      var next = replaceWrotePrefix(text, real, pub);
      if (next !== text) node.textContent = next;
    });
    if (!real) return;
    try {
      var hist = root.state && root.state.chatHistory;
      if (Array.isArray(hist)) {
        hist.forEach(function (m) {
          if (!m) return;
          if (typeof m.content === 'string') m.content = replaceWrotePrefix(m.content, real, pub);
          if (typeof m.text === 'string') m.text = replaceWrotePrefix(m.text, real, pub);
        });
      }
    } catch (e3) {}
    rewriteLogKey('fl_alpha_thread_history', real, pub);
    rewriteDbMessages(real, pub);
  }
  function appendEarlier(d, block, pageId) {
    if (!d || !block || !pageId) return;
    var notes = readSealNotes().filter(function (n) {
      return n && String(n.pageId) === String(pageId) && n.line;
    });
    if (!notes.length) return;
    var details = d.createElement('details');
    details.style.cssText = 'margin-top:8px;max-width:100%;';
    var sum = d.createElement('summary');
    sum.textContent = 'Earlier answers';
    details.appendChild(sum);
    notes.forEach(function (n) {
      var p = d.createElement('p');
      p.style.cssText = 'margin:4px 0 0;max-width:100%;overflow-wrap:anywhere;color:#8a8a8a;';
      p.textContent = String(n.line);
      details.appendChild(p);
    });
    block.appendChild(details);
  }
  function restoreSealAsks() {
    if (sealRestored || !isOn()) return Promise.resolve();
    sealRestored = true;
    return allOf('sealAsks').then(function (rows) {
      var chain = Promise.resolve();
      (rows || []).forEach(function (row) {
        if (!row || !row.pageId) return;
        chain = chain.then(function () {
          return getPage(row.pageId).then(function (page) {
            var ask = {
              pageId: String(row.pageId),
              version: String(row.version || ''),
              versionHash: String(row.version || ''),
              summary: row.summary || '',
              reason: row.reason || '',
              why: row.reason || '',
              askedAt: row.askedAt || 0,
              state: row.state || 'asked'
            };
            if ((ask.state === 'asked' || ask.state === 'later') && page && page.head && ask.versionHash && page.head !== ask.versionHash) {
              ask.state = 'stale';
              putSealAsk(ask);
            }
            rememberAsk(ask);
            if (ask.state === 'asked' || ask.state === 'stale') sealDockOpen = true;
          });
        });
      });
      return chain.then(function () {
        ensureAskDock();
        paintBadge();
      });
    });
  }
  function sealState(pageId) {
    var ask = findAskByPage(pageId);
    if (!ask || !ask.state) return 'unsealed';
    return ask.state;
  }
  function accept() {
    memoryOn = true;
    lsSet('fl_ws', 'yes');
    try { if (root.sessionStorage) root.sessionStorage.removeItem('fl_ws_later'); } catch (e) {}
    hideConsent();
    ensureButton();
    return track(refreshWake().then(function () {
      return restoreSealAsks().then(function () { return offerRestore(); });
    }));
  }
  function holdLater() {
    memoryOn = false;
    ssSet('fl_ws_later', '1');
    wakeCache = '';
    personWake = '';
    removePanel();
    hideConsent();
  }
  function decline() {
    memoryOn = 'off';
    lsSet('fl_ws', 'off');
    wakeCache = '';
    personWake = '';
    removePanel();
    hideConsent();
  }
  function whenText(ts) {
    try { return new Date(ts).toISOString().slice(0, 16).replace('T', ' '); }
    catch (e) { return ''; }
  }
  function renderPanel(panel) {
    var d = doc();
    if (!d) return Promise.resolve();
    clearNode(panel);
    return ensureShelf().then(function (mine) {
      return Promise.all([list(mine), allOf('receipts')]).then(function (pair) {
        var pages = pair[0] || [];
        var rows = pair[1] || [];
        pages.sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); });
        function footer() {
          var prior = d.getElementById('fl-ws-honest');
          if (prior && prior.parentNode) prior.parentNode.removeChild(prior);
          appendHandoffNotes(panel);
          var asideBtn = button(shelfIsAside(mine) ? 'Bring this shelf back' : 'Set this shelf aside');
          if (asideBtn) {
            asideBtn.addEventListener('click', function () {
              track(setShelfAside(!shelfIsAside(mine)));
            });
            panel.appendChild(asideBtn);
          }
          var foot = d.createElement('p');
          foot.style.cssText = 'margin:12px 0 0;max-width:100%;overflow-wrap:anywhere;';
          foot.textContent = HONEST;
          panel.appendChild(foot);
        }
        // The pointer used to say "above" every time. syncPointer reads the two rects.
        syncPointer();
        if (shelfIsAside(mine)) {
          var kept = d.createElement('p');
          kept.style.cssText = 'margin:0;max-width:100%;overflow-wrap:anywhere;';
          kept.textContent = 'This shelf is set aside. The pages are kept.';
          panel.appendChild(kept);
          footer();
          return;
        }
        if (!pages.length) {
          var empty = d.createElement('p');
          empty.textContent = 'No pages yet.';
          panel.appendChild(empty);
          footer();
          return;
        }
        var chain = Promise.resolve();
        pages.forEach(function (page) {
          chain = chain.then(function () {
            return headText(page).then(function (text) {
              return getVersion(page.head).then(function (ver) {
                var block = d.createElement('div');
                block.style.cssText = 'max-width:100%;overflow:hidden;margin:8px 0 0;';
                var pinBtn = button(page.pinned ? 'Unpin' : 'Pin');
                if (pinBtn) pinBtn.addEventListener('click', function () {
                  track(pin(page.id, !page.pinned).then(function () { return afterChange(); }).then(function () { return renderPanel(panel); }));
                });
                if (page.privacy === 'private') {
                  var sum = d.createElement('p');
                  sum.style.cssText = 'margin:0;overflow-wrap:anywhere;max-width:100%;';
                  sum.textContent = personSummary(page, text, !!(ver && ver.sealed));
                  var hashDetails = d.createElement('details');
                  hashDetails.style.cssText = 'margin:4px 0 0;max-width:100%;';
                  var hashSum = d.createElement('summary');
                  var headHex = page.head ? String(page.head) : '';
                  hashSum.textContent = 'Details for checking' + (headHex ? (' (' + shortHash(headHex) + ')') : '');
                  var hashLine = d.createElement('p');
                  hashLine.style.cssText = 'margin:4px 0 0;overflow-wrap:anywhere;max-width:100%;';
                  hashLine.textContent = headHex;
                  hashDetails.appendChild(hashSum);
                  hashDetails.appendChild(hashLine);
                  block.appendChild(sum);
                  block.appendChild(hashDetails);
                  if (pinBtn) block.appendChild(pinBtn);
                } else {
                  var line = d.createElement('p');
                  line.style.cssText = 'margin:0;overflow-wrap:anywhere;max-width:100%;';
                  line.textContent = page.title + ' · ' + page.kind + ' · ' + (page.pinned ? 'pinned' : 'unpinned') + ' · ' + whenText(page.updated);
                  var pre = d.createElement('pre');
                  pre.style.whiteSpace = 'pre-wrap';
                  pre.style.overflowWrap = 'anywhere';
                  pre.style.maxWidth = '100%';
                  pre.style.margin = '4px 0 0';
                  pre.textContent = text;
                  var seedLine = d.createElement('p');
                  seedLine.style.cssText = 'margin:4px 0 0;max-width:100%;overflow-wrap:anywhere;';
                  var seedShown = page.seed || '';
                  if (!seedShown && page.seedByHash) {
                    seedShown = Object.keys(page.seedByHash).map(function (k) { return page.seedByHash[k]; }).join(' / ');
                  }
                  seedLine.textContent = seedShown;
                  var box = d.createElement('textarea');
                  box.style.cssText = 'display:block;width:100%;max-width:100%;box-sizing:border-box;min-height:44px;';
                  var writeBtn = button('Write');
                  if (writeBtn) writeBtn.addEventListener('click', function () {
                    track(write(page.id, box.value, 'human').then(function () { return afterChange(); }).then(function () { return renderPanel(panel); }));
                  });
                  block.appendChild(line);
                  block.appendChild(pre);
                  block.appendChild(seedLine);
                  block.appendChild(box);
                  if (writeBtn) block.appendChild(writeBtn);
                  if (pinBtn) block.appendChild(pinBtn);
                }
                var ask = findAskByPage(page.id);
                if (ask && (ask.state === 'asked' || ask.state === 'later') && page.head && ask.versionHash && ask.versionHash !== page.head) {
                  ask.state = 'stale';
                  putSealAsk(ask);
                }
                if (ver && ver.sealed) {
                  var nowLine = d.createElement('p');
                  nowLine.setAttribute('data-seal-current', 'sealed');
                  nowLine.style.cssText = 'margin:8px 0 0;max-width:100%;overflow-wrap:anywhere;';
                  nowLine.textContent = 'Sealed';
                  block.appendChild(nowLine);
                  appendEarlier(d, block, page.id);
                } else if (ask && ask.state === 'declined') {
                  var declined = d.createElement('p');
                  declined.style.cssText = 'margin:8px 0 0;max-width:100%;overflow-wrap:anywhere;';
                  declined.textContent = 'Declined the seal.';
                  block.appendChild(declined);
                } else if (ask && ask.state === 'stale') {
                  var staleNote = d.createElement('p');
                  staleNote.style.cssText = 'margin:8px 0 0;max-width:100%;overflow-wrap:anywhere;';
                  staleNote.textContent = 'stale, ask again';
                  block.appendChild(staleNote);
                }
                rows.forEach(function (row) { if (row && row.pageId === page.id) appendReceipt(block, row); });
                panel.appendChild(block);
              });
            });
          });
        });
        return chain.then(function () { footer(); syncPointer(); });
      });
    });
  }
  function openPanel() {
    if (!isOn()) return;
    var d = doc();
    if (!d || !d.createElement) return;
    var existing = d.getElementById('fl-ws-panel');
    if (existing) { removePanel(); ensureAskDock(); return; }
    if (liveAsks().length) sealDockOpen = true;
    var panel = d.createElement('div');
    panel.id = 'fl-ws-panel';
    panel.style.maxWidth = '100%';
    panel.style.overflow = 'hidden';
    var parent = hostEl || (d.getElementById && d.getElementById('fl-clay-dock')) || d.body;
    if (parent) parent.appendChild(panel);
    track(renderPanel(panel).then(function () { ensureAskDock(); }));
  }
  function ensureButton() {
    var d = doc();
    if (!d || !d.createElement || !d.getElementById) return;
    if (!d.getElementById('fl-ws-open')) {
      var btn = button('Notebook');
      if (btn) {
        btn.id = 'fl-ws-open';
        btn.addEventListener('click', function () {
          if (isOn()) { openPanel(); return; }
          showConsent(btn);
        });
        var toggle = root.__clayToggle;
        if (toggle && toggle.parentNode) toggle.parentNode.insertBefore(btn, toggle.nextSibling);
        else if (hostEl) hostEl.appendChild(btn);
        else if (d.body) d.body.appendChild(btn);
      }
    }
    ensureToolsNotebook();
    paintBadge();
  }
  function ensureToolsNotebook() {
    var d = doc();
    if (!d || !d.createElement || !d.getElementById) return;
    if (d.getElementById('fl-ws-open-tools')) return;
    var home = d.getElementById('chatOverflowPopup');
    if (!home && d.querySelector) {
      try { home = d.querySelector('[data-thread-tools]'); } catch (e) { home = null; }
    }
    if (!home) return;
    var btn = button('Notebook');
    if (!btn) return;
    btn.id = 'fl-ws-open-tools';
    btn.addEventListener('click', function () {
      if (isOn()) { openPanel(); return; }
      showConsent(btn);
    });
    home.appendChild(btn);
  }
  function hideRestoreCard() {
    var d = doc();
    if (!d || !d.getElementById) return;
    var box = d.getElementById('fl-ws-restore-card');
    if (box && box.parentNode) box.parentNode.removeChild(box);
  }
  function runRestore() {
    var api = mirrorApi();
    if (!api || typeof api.restore !== 'function') return Promise.resolve({ ok: false, reason: 'mirror' });
    return ensureShelf().then(function (mine) {
      return Promise.resolve(api.restore(mine)).then(function (pack) {
        if (!pack || !pack.ok || !pack.section) return { ok: false, reason: 'mirror' };
        return importSection(pack.section, 'merge', { sameDevice: true }).then(function (report) {
          return refreshWake().then(function () {
            return paintOpen().then(function () { return report; });
          });
        });
      });
    });
  }
  function showRestoreCard() {
    var d = doc();
    if (!d || !d.createElement || !d.getElementById) return;
    if (d.getElementById('fl-ws-restore-card')) return;
    var box = d.createElement('div');
    box.id = 'fl-ws-restore-card';
    box.style.cssText = 'max-width:100%;overflow:hidden;';
    var p = d.createElement('p');
    p.style.cssText = 'margin:8px 0 0;max-width:100%;overflow-wrap:anywhere;';
    p.textContent = RESTORE_LINE;
    var yes = button('Restore');
    var no = button('Not now');
    if (yes) {
      yes.id = 'fl-ws-restore';
      yes.addEventListener('click', function () {
        track(runRestore().then(function () { hideRestoreCard(); }));
      });
    }
    if (no) {
      no.id = 'fl-ws-restore-not-now';
      no.addEventListener('click', function () {
        track(ensureShelf().then(function (mine) {
          restoreLater[mine] = true;
          hideRestoreCard();
        }));
      });
    }
    box.appendChild(p);
    if (yes) box.appendChild(yes);
    if (no) box.appendChild(no);
    var parent = hostEl || d.body;
    if (parent) parent.appendChild(box);
  }
  function offerRestore() {
    if (!isOn()) return Promise.resolve();
    var api = mirrorApi();
    if (!api || typeof api.head !== 'function') return Promise.resolve();
    return ensureShelf().then(function (mine) {
      if (restoreLater[mine]) return null;
      return Promise.resolve(api.head(mine)).then(function (info) {
        if (!info || !info.ok || !info.versionHashes || !info.versionHashes.length) return null;
        return allOf('versions').then(function (vers) {
          var have = {};
          (vers || []).forEach(function (v) { if (v && v.hash) have[v.hash] = true; });
          var missing = false;
          info.versionHashes.forEach(function (h) { if (!have[h]) missing = true; });
          if (missing) showRestoreCard();
        });
      }, function () { return null; });
    });
  }
  function place() {
    var d = doc();
    if (!d || !d.getElementById) return;
    if (!hostEl) {
      var nursery = d.getElementById('nursery-stage');
      var face = d.querySelector ? d.querySelector('[data-thread-face]') : null;
      hostEl = face || nursery || d.getElementById('fl-clay-dock') || null;
    }
    ensureButton();
    if (root.__flSealAskHolding) holdDeferButtons(true);
    watchNursery();
    watchChat();
    if (isOn()) {
      track(refreshWake());
      track(restoreSealAsks());
      if (!restoreChecked) {
        restoreChecked = true;
        track(offerRestore());
      }
    }
    watchViews();
  }
  function mount(host) {
    if (host) hostEl = host;
    place();
    return hostEl;
  }
  function boot() {
    var d = doc();
    if (!d) return;
    place();
    if (d.addEventListener && typeof MutationObserver === 'function') {
      try {
        var obs = new MutationObserver(function () { place(); });
        if (d.body) obs.observe(d.body, { childList: true, subtree: true });
      } catch (e) {}
    }
  }
  function bindClock(fn) { if (typeof fn === 'function') clock = fn; }
  function resetRate() { lastWriteAt = 0; sketchLastAt = 0; }
  function dbOpens() { return opens; }
  function settled() { return pending; }
  // v-workspace-view-v0.1: shelves for the view. Read only. Stored pages stay the same shape.
  function listShelves() {
    if (!isOn()) return Promise.resolve([]);
    return ensureShelf().then(function (mine) {
      var name = '';
      try { name = String((recallMind().name) || ''); } catch (e) { name = ''; }
      return allOf('pages').then(function (pages) {
        var groups = {};
        var order = [];
        (pages || []).forEach(function (p) {
          if (!p || p.aside === true) return;
          var key = String(p.mindFp || '');
          if (!groups[key]) {
            groups[key] = { mindFp: key, name: key === mine ? name : '', pages: [] };
            order.push(key);
          }
          groups[key].pages.push(p);
        });
        return order.map(function (key) { return groups[key]; });
      });
    });
  }
  function wakeInfo() {
    var shown = isOn() ? personWake : '';
    var memory = shown.indexOf(HOWTO) === 0 ? shown.slice(HOWTO.length).replace(/^\n/, '') : shown;
    return {
      text: shown,
      tokens: Math.ceil(String(shown).length / 4),
      memoryTokens: Math.ceil(String(memory || '').length / 4),
      howToTokens: Math.ceil(HOWTO.length / 4),
      notes: wakeCounts.notes,
      seeds: wakeCounts.seeds,
      howTo: HOWTO
    };
  }
  function resetForSmoke() {
    db = null;
    opens = 0;
    memoryOn = null;
    offered = false;
    lastRaw = '';
    lastWriteAt = 0;
    sketchLastAt = 0;
    wakeCache = '';
    personWake = '';
    wakeCounts = { notes: 0, seeds: 0 };
    findOnce = '';
    shelfParts = null;
    shelfCache = '';
    shelfStamp = '';
    privateTexts = [];
    sealAsks = [];
    declinedLines = [];
    handoffAsks = [];
    handoffRefusals = [];
    sealDockOpen = false;
    sealBackArmed = false;
    sealBackEating = false;
    sealRestored = false;
    heldDefers = [];
    loadBringDone = false;
    nurseryWasOpen = false;
    try { if (root.localStorage && root.localStorage.removeItem) root.localStorage.removeItem(SEAL_NOTE_KEY); } catch (eNote) {}
    mirrorHold = 0;
    restoreChecked = false;
    restoreLater = {};
    pending = Promise.resolve();
  }
  function tokensOf(s) { return Math.ceil(String(s || '').length / 4); }

  // v-workspace-export-v0.1 v-tree-workspace-export-v0.1
  // The notebook leaves with the export. A private page stays on this browser.
  var PRIVATE_NOTE = 'Private pages are not in this file. They stayed on this browser, on the device that made the export.';
  var BRANCH_NOTE = 'Parent was not in this notebook, so this version came in as its own branch.';

  function countWord(n, one, many) {
    n = n | 0;
    return String(n) + ' ' + (n === 1 ? one : many);
  }
  function notebookLine(total, priv) {
    return 'Notebook: ' + countWord(total, 'page', 'pages') + ', ' + countWord(priv, 'private page', 'private pages') + ' stayed on this browser.';
  }
  function privacyHidden(value) {
    return value === 'private' || value === 'mind-private';
  }
  function pushSecret(list, value) {
    if (value == null) return;
    var s = String(value);
    if (!s) return;
    if (list.indexOf(s) < 0) list.push(s);
  }
  function sortBy(list, key) {
    return list.sort(function (a, b) {
      var as = String((a && a[key]) || '');
      var bs = String((b && b[key]) || '');
      if (as < bs) return -1;
      if (as > bs) return 1;
      return 0;
    });
  }
  function sequence(items, fn) {
    var chain = Promise.resolve();
    (items || []).forEach(function (item) {
      chain = chain.then(function () { return fn(item); });
    });
    return chain;
  }
  function shelfLabel(fp, mine, mindName) {
    if (fp && fp === mine) return mindName || '';
    var hex = String(fp || '').slice(0, 8);
    return hex ? ('Shelf ' + hex) : 'Shelf';
  }
  function copyPageOut(p) {
    return {
      id: p.id,
      mindFp: String(p.mindFp || ''),
      title: p.title == null ? '' : String(p.title),
      kind: p.kind || 'note',
      privacy: p.privacy || 'shared',
      pinned: p.pinned === true,
      aside: p.aside === true,
      head: p.head == null ? null : p.head,
      heads: Array.isArray(p.heads) ? p.heads.slice() : [],
      seed: p.seed == null ? '' : String(p.seed),
      seedByHash: p.seedByHash && typeof p.seedByHash === 'object' ? JSON.parse(JSON.stringify(p.seedByHash)) : {},
      updated: p.updated || 0,
      publicTitle: p.publicTitle == null ? '' : String(p.publicTitle)
    };
  }
  function copyVersionOut(v) {
    var out = {
      hash: v.hash,
      pageId: v.pageId,
      parent: v.parent == null ? null : v.parent,
      branchOf: v.branchOf == null ? null : v.branchOf,
      ts: v.ts,
      author: v.author == null ? '' : String(v.author),
      text: v.text == null ? '' : String(v.text),
      meta: v.meta && typeof v.meta === 'object' ? JSON.parse(JSON.stringify(v.meta)) : {},
      sealed: v.sealed === true
    };
    if (v.note) out.note = String(v.note);
    return out;
  }
  function copyReceiptOut(r, mindFpValue) {
    var mind = r && r.mindSeal ? r.mindSeal : {};
    return {
      id: r.id || r.versionHash,
      versionHash: r.versionHash || r.id,
      pageId: r.pageId || '',
      mindFp: String(mindFpValue || r.mindFp || ''),
      mindSeal: {
        contextHash: mind.contextHash == null ? '' : String(mind.contextHash),
        modelId: mind.modelId == null ? '' : String(mind.modelId)
      },
      ts: r.ts || 0,
      consent: r.consent || '',
      why: r.why == null ? '' : String(r.why),
      humanSig: r.humanSig || '',
      publicKey: r.publicKey || ''
    };
  }
  function stubReceiptOut(r, mindFpValue) {
    var hash = String(r.versionHash || r.id || '');
    var mind = r && r.mindSeal ? r.mindSeal : {};
    return {
      id: r.id || hash,
      versionHash: hash,
      pageId: r.pageId || '',
      mindFp: String(mindFpValue || r.mindFp || ''),
      mindSeal: {
        contextHash: mind.contextHash == null ? '' : String(mind.contextHash),
        modelId: mind.modelId == null ? '' : String(mind.modelId)
      },
      ts: r.ts || 0,
      consent: r.consent || '',
      humanSig: r.humanSig || '',
      publicKey: r.publicKey || '',
      text: { private: true, versionHash: hash }
    };
  }
  function emptyShelf(fp, mine, mindName) {
    return {
      mindFp: fp,
      name: shelfLabel(fp, mine, mindName),
      setAside: shelfIsAside(fp),
      pages: [],
      versions: [],
      receipts: []
    };
  }
  function exportSection() {
    var secrets = [];
    return ensureShelf().then(function (mine) {
      var mindName = '';
      try { mindName = String((recallMind().name) || ''); } catch (e) { mindName = ''; }
      return Promise.all([allOf('pages', true), allOf('versions', true), allOf('receipts', true)]).then(function (rows) {
        var pages = rows[0] || [];
        var versions = rows[1] || [];
        var receiptRows = rows[2] || [];
        var hiddenIds = {};
        var pageById = {};
        var groups = {};
        var order = [];
        var total = 0;
        var priv = 0;
        function shelfFor(fp) {
          var key = String(fp || '');
          if (!key) return null;
          if (!groups[key]) {
            groups[key] = emptyShelf(key, mine, mindName);
            order.push(key);
          }
          return groups[key];
        }
        pages.forEach(function (p) {
          if (!p || !p.id) return;
          total += 1;
          pageById[p.id] = p;
          var shelf = shelfFor(p.mindFp);
          if (privacyHidden(p.privacy)) {
            priv += 1;
            hiddenIds[p.id] = true;
            pushSecret(secrets, p.title);
            pushSecret(secrets, p.seed);
            var map = p.seedByHash || {};
            Object.keys(map).forEach(function (k) { pushSecret(secrets, map[k]); });
            return;
          }
          if (shelf) shelf.pages.push(copyPageOut(p));
        });
        versions.forEach(function (v) {
          if (!v) return;
          if (hiddenIds[v.pageId]) {
            pushSecret(secrets, v.text);
            return;
          }
          var page = pageById[v.pageId];
          if (!page) return;
          var shelf = shelfFor(page.mindFp);
          if (shelf) shelf.versions.push(copyVersionOut(v));
        });
        receiptRows.forEach(function (r) {
          if (!r) return;
          var pid = r.pageId || '';
          var page = pageById[pid];
          var hidden = !!(hiddenIds[pid] || (r.text && r.text.private === true));
          var fp = page ? page.mindFp : (r.mindFp || '');
          var shelf = shelfFor(fp);
          if (!shelf) return;
          if (hidden) {
            if (r.why) pushSecret(secrets, r.why);
            shelf.receipts.push(stubReceiptOut(r, fp));
            return;
          }
          if (!page) return;
          shelf.receipts.push(copyReceiptOut(r, fp));
        });
        var shelves = order.sort().map(function (key) {
          var shelf = groups[key];
          sortBy(shelf.pages, 'id');
          sortBy(shelf.versions, 'hash');
          sortBy(shelf.receipts, 'versionHash');
          return shelf;
        });
        return {
          section: { v: 1, shelves: shelves, line: notebookLine(total, priv) },
          secrets: secrets
        };
      });
    });
  }
  function thisDeviceKey() {
    try {
      var raw = lsGet(DEVICE_KEY);
      if (!raw) return '';
      var saved = JSON.parse(raw);
      return saved && saved.publicKey ? String(saved.publicKey) : '';
    } catch (e) { return ''; }
  }
  function deviceMark(publicKey) {
    return sha256Hex(String(publicKey || '')).then(function (hex) {
      var h = String(hex || '').slice(0, 8);
      if (h.length < 8) return '';
      return 'sealed on another device (' + h.slice(0, 4) + ' ' + h.slice(4, 8) + '...)';
    });
  }
  function verifySealSignature(row) {
    if (!row || !row.humanSig || !row.publicKey || !row.versionHash) return Promise.resolve(false);
    return sha256Hex(sealCanonical(row)).then(function (hex) {
      var subtle = subtleCrypto();
      if (!subtle || !hex) return false;
      return subtle.importKey('spki', b64ToBytes(row.publicKey), { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']).then(function (pub) {
        return subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, b64ToBytes(row.humanSig), new TextEncoder().encode(hex));
      }).then(function (ok) { return ok === true; }, function () { return false; });
    });
  }
  function sectionVersions(section) {
    var list = [];
    (section.shelves || []).forEach(function (shelf) {
      (shelf && shelf.versions || []).forEach(function (ver) { if (ver) list.push(ver); });
    });
    return list;
  }
  function sectionReceipts(section) {
    var list = [];
    (section.shelves || []).forEach(function (shelf) {
      (shelf && shelf.receipts || []).forEach(function (row) { if (row) list.push(row); });
    });
    return list;
  }
  function verifyShelves(section) {
    var report = {
      ok: true,
      line: section.line || '',
      privateNote: PRIVATE_NOTE,
      pages: 0,
      versions: 0,
      receipts: 0,
      hashMismatches: 0,
      receiptMismatches: 0,
      parentGaps: 0,
      notedBranches: 0,
      lines: [],
      errors: []
    };
    var versions = sectionVersions(section);
    var have = {};
    versions.forEach(function (ver) { if (ver && ver.hash) have[String(ver.hash)] = true; });
    (section.shelves || []).forEach(function (shelf) {
      report.pages += (shelf && shelf.pages ? shelf.pages.length : 0);
    });
    report.versions = versions.length;
    var chain = sequence(versions, function (ver) {
      return hashVersion({
        parent: ver.parent, ts: ver.ts, author: ver.author, text: ver.text, meta: ver.meta
      }).then(function (h) {
        if (h !== ver.hash) {
          report.hashMismatches += 1;
          report.errors.push('hash-mismatch');
          return;
        }
        var parent = ver.parent == null || ver.parent === '' ? '' : String(ver.parent);
        if (!parent) return;
        if (have[parent]) return;
        if (ver.note) { report.notedBranches += 1; return; }
        report.parentGaps += 1;
      });
    });
    return chain.then(function () {
      var rows = sectionReceipts(section);
      report.receipts = rows.length;
      var byHash = {};
      versions.forEach(function (ver) { if (ver && ver.hash) byHash[String(ver.hash)] = ver; });
      return sequence(rows, function (row) {
        var stub = !!(row.text && row.text.private === true);
        var check = Promise.resolve(true);
        if (!stub) {
          var ver = byHash[String(row.versionHash || '')];
          if (!ver) {
            report.receiptMismatches += 1;
            report.errors.push('receipt-mismatch');
            return;
          }
          check = hashVersion({
            parent: ver.parent, ts: ver.ts, author: ver.author, text: ver.text, meta: ver.meta
          }).then(function (h) { return h === ver.hash && h === row.versionHash; });
        }
        return check.then(function (hashOk) {
          if (!hashOk) {
            report.receiptMismatches += 1;
            report.errors.push('receipt-mismatch');
            return;
          }
          return verifySealSignature(row).then(function (ok) {
            if (!ok) {
              report.receiptMismatches += 1;
              report.errors.push('receipt-mismatch');
              return;
            }
            var mine = thisDeviceKey();
            if (mine && row.publicKey === mine) return;
            return deviceMark(row.publicKey).then(function (line) {
              if (line && report.lines.indexOf(line) < 0) report.lines.push(line);
            });
          });
        });
      });
    }).then(function () {
      report.ok = report.hashMismatches === 0 && report.receiptMismatches === 0;
      return report;
    });
  }
  function parentPresent(parent, incoming) {
    if (parent == null || parent === '') return Promise.resolve(true);
    if (incoming[String(parent)]) return Promise.resolve(true);
    return getVersion(String(parent)).then(function (found) { return !!found; });
  }
  function addPageIfAbsent(page, sameDevice) {
    if (!page || !page.id) return Promise.resolve({ added: false, reason: 'missing' });
    if (privacyHidden(page.privacy) && !sameDevice) return Promise.resolve({ added: false, reason: 'private' });
    var keptPrivacy = 'shared';
    if (sameDevice && page.privacy === 'private') keptPrivacy = 'private';
    if (sameDevice && page.privacy === 'mind-private') keptPrivacy = 'mind-private';
    var copy = {
      id: String(page.id),
      mindFp: String(page.mindFp || ''),
      title: page.title == null ? '' : String(page.title),
      kind: page.kind || 'note',
      privacy: keptPrivacy,
      pinned: page.pinned === true,
      aside: page.aside === true,
      head: page.head == null ? null : page.head,
      heads: Array.isArray(page.heads) ? page.heads.slice() : [],
      seed: page.seed == null ? '' : String(page.seed),
      seedByHash: page.seedByHash && typeof page.seedByHash === 'object' ? JSON.parse(JSON.stringify(page.seedByHash)) : {},
      updated: page.updated || 0
    };
    if (page.publicTitle) copy.publicTitle = String(page.publicTitle);
    return runStore('pages', 'readwrite', function (store) {
      var req = store.get(copy.id);
      var box = { value: { added: false } };
      req.onsuccess = function () {
        if (req.result) { box.value = { added: false, page: req.result }; return; }
        try { store.add(copy); box.value = { added: true, page: copy }; }
        catch (e) { box.value = { added: false }; }
      };
      return box;
    }).then(function (box) { return box && box.value ? box.value : { added: false }; });
  }
  function addReceiptIfAbsent(row) {
    if (!row || !(row.id || row.versionHash)) return Promise.resolve({ added: false });
    var copy = JSON.parse(JSON.stringify(row));
    if (!copy.id) copy.id = copy.versionHash;
    return getReceipt(copy.id).then(function (existing) {
      if (existing) return { added: false };
      return putReceipt(copy).then(function () { return { added: true }; }, function () { return { added: false }; });
    });
  }
  function rememberAside(shelf) {
    if (!shelf || shelf.setAside !== true || !shelf.mindFp) return;
    var key = asideKey(shelf.mindFp);
    if (lsGet(key) === '1') return;
    lsSet(key, '1');
  }
  function writeShelves(section, sameDevice) {
    var added = { pages: 0, versions: 0, receipts: 0, skippedPages: 0, skippedVersions: 0, skippedReceipts: 0, branched: 0, refusedPrivate: 0 };
    var incoming = {};
    sectionVersions(section).forEach(function (ver) { if (ver && ver.hash) incoming[String(ver.hash)] = true; });
    return sequence(section.shelves || [], function (shelf) {
      if (!shelf) return;
      rememberAside(shelf);
      return sequence(shelf.pages || [], function (page) {
        if (privacyHidden(page && page.privacy) && !sameDevice) { added.refusedPrivate += 1; return; }
        return addPageIfAbsent(page, sameDevice).then(function (res) {
          if (res && res.added) added.pages += 1;
          else added.skippedPages += 1;
        });
      }).then(function () {
        return sequence(shelf.versions || [], function (ver) {
          if (!ver || !ver.hash) return;
          return getVersion(String(ver.hash)).then(function (existing) {
            if (existing) { added.skippedVersions += 1; return; }
            var parent = ver.parent == null || ver.parent === '' ? null : String(ver.parent);
            return parentPresent(parent, incoming).then(function (present) {
              var record = copyVersionOut(ver);
              record.parent = parent;
              if (!present) {
                record.branchOf = null;
                record.note = BRANCH_NOTE;
                added.branched += 1;
              }
              return saveVersion(record).then(function (kept) {
                if (kept && kept.hash === record.hash && !existing) added.versions += 1;
              });
            });
          });
        });
      }).then(function () {
        return sequence(shelf.receipts || [], function (row) {
          return addReceiptIfAbsent(row).then(function (res) {
            if (res && res.added) added.receipts += 1;
            else added.skippedReceipts += 1;
          });
        });
      });
    }).then(function () { return added; });
  }
  function shelfFingerprintRefusal(section, expectMindFp) {
    if (!expectMindFp) return null;
    var wanted = [];
    if (Array.isArray(expectMindFp)) {
      for (var a = 0; a < expectMindFp.length; a++) wanted.push(String(expectMindFp[a]));
    } else wanted.push(String(expectMindFp));
    var shelves = (section && section.shelves) || [];
    var wrongFp = '';
    var unsignedShelves = 0;
    var wi;
    for (wi = 0; wi < shelves.length; wi++) {
      var shelfFp = shelves[wi] && shelves[wi].mindFp ? String(shelves[wi].mindFp) : '';
      if (!shelfFp) { unsignedShelves += 1; continue; }
      if (!wrongFp && wanted.indexOf(shelfFp) === -1) wrongFp = shelfFp;
    }
    if (unsignedShelves > 0) {
      var unsignedLine = unsignedShelves === 1
        ? '1 shelf had no fingerprint and was not checked. Not imported.'
        : (unsignedShelves + ' shelves had no fingerprint and were not checked. Not imported.');
      return { errors: ['unsigned-shelf'], line: unsignedLine };
    }
    if (wrongFp) {
      var shownFp = wrongFp.slice(0, 4) + ' ' + wrongFp.slice(4, 8);
      return {
        errors: ['wrong-mind'],
        line: 'This memory belongs to a different mind (' + shownFp + '). Not imported.'
      };
    }
    return null;
  }
  function importSection(section, mode, opts) {
    opts = opts || {};
    var fpRefuse = shelfFingerprintRefusal(section, opts.expectMindFp);
    if (fpRefuse) {
      return Promise.resolve({
        ok: false,
        mode: mode || 'verify-only',
        line: fpRefuse.line,
        privateNote: PRIVATE_NOTE,
        errors: fpRefuse.errors,
        lines: []
      });
    }
    mirrorHold += 1;
    var sameDevice = !!(opts && opts.sameDevice);
    mode = mode || 'verify-only';
    if (!section || section.v !== 1 || !Array.isArray(section.shelves)) {
      mirrorHold = mirrorHold > 0 ? mirrorHold - 1 : 0;
      return Promise.resolve({
        ok: false,
        mode: mode,
        line: '',
        privateNote: PRIVATE_NOTE,
        errors: ['workspace-section'],
        lines: []
      });
    }
    return verifyShelves(section).then(function (report) {
      report.mode = mode;
      if (mode === 'verify-only') return report;
      if (!report.ok) return report;
      if (!isOn()) {
        report.ok = false;
        report.errors = report.errors.concat(['notebook-off']);
        return report;
      }
      return writeShelves(section, sameDevice).then(function (added) {
        report.added = added;
        return report;
      });
    }).then(function (report) {
      mirrorHold = mirrorHold > 0 ? mirrorHold - 1 : 0;
      return report;
    }, function (err) {
      mirrorHold = mirrorHold > 0 ? mirrorHold - 1 : 0;
      throw err;
    });
  }

  var api = {
    VERSION: 'v-workspace-core-v0.1',
    HEAL: 'v-workspace-mark-heal-v0.1',
    PRIVATE: 'v-workspace-private-v0.1',
    SEAL: 'v-workspace-seal-v0.1',
    EXPORT: 'v-workspace-export-v0.1',
    TREE_EXPORT: 'v-tree-workspace-export-v0.1',
    DESKTOP: 'v-workspace-desktop-v0.1',
    HANDOFF: 'v-workspace-handoff-v0.1',
    TREE_HANDOFF: 'v-tree-workspace-handoff-v0.1',
    SEAL_HEAL: 'v-seal-ask-heal-v0.1',
    SEAL_VIEW: 'v-seal-ask-in-view-v0.1',
    SEAL_ASK_COOLDOWN_MS: SEAL_ASK_COOLDOWN_MS,
    HONEST: HONEST,
    HOWTO: HOWTO,
    open: open,
    write: write,
    branch: branch,
    pin: pin,
    seed: seed,
    find: find,
    list: list,
    history: history,
    hashVersion: hashVersion,
    canonicalVersion: canonicalVersion,
    checkHistory: checkHistory,
    saveVersion: saveVersion,
    mindFp: mindFp,
    setMind: setMind,
    promptDelta: promptDelta,
    refreshWake: refreshWake,
    consumeReply: consumeReply,
    strip: stripOnly,
    onReply: onReply,
    isOn: isOn,
    accept: accept,
    later: holdLater,
    decline: decline,
    mount: mount,
    boot: boot,
    showSeed: showSeed,
    bindClock: bindClock,
    resetRate: resetRate,
    dbOpens: dbOpens,
    settled: settled,
    wakeInfo: wakeInfo,
    listShelves: listShelves,
    tokensOf: tokensOf,
    resetForSmoke: resetForSmoke,
    isPrivateText: isPrivateText,
    makePrivate: makePrivate,
    setShelfAside: setShelfAside,
    shelfIsAside: shelfIsAside,
    personSummary: personSummary,
    approveSeal: approveSeal,
    askSeal: askSeal,
    laterSeal: laterSeal,
    declineSeal: declineSeal,
    sealState: sealState,
    verifyReceipt: verifyReceipt,
    receipts: receipts,
    exportSection: exportSection,
    importSection: importSection,
    askHandoff: askHandoff,
    prepareHandoff: prepareHandoff,
    declineHandoff: declineHandoff,
    noteLine: noteLine,
    currentFp: ensureShelf,
    noteReply: noteReply
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FLWorkspace = api;
  if (typeof root.addEventListener === 'function') {
    root.addEventListener('popstate', onSealPop, true);
    root.__flSealBackBound = true;
  }
  if (root.document && root.document.addEventListener) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
