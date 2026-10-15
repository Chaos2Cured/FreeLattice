// mind-workspace.js (MIT) v-workspace-core-v0.1 v-workspace-mark-heal-v0.1
// v-workspace-private-v0.1 v-workspace-seal-v0.1 v-tree-workspace-seal-v0.1
// v-workspace-export-v0.1 v-tree-workspace-export-v0.1
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
  var OPS = { open: 1, write: 1, branch: 1, pin: 1, seed: 1, find: 1, private: 1, seal: 1 };
  var KINDS = { draft: 1, note: 1, future: 1, letter: 1 };
  var KEYS = {
    open: { op: 1, id: 1, title: 1, kind: 1 },
    write: { op: 1, id: 1, pageId: 1, title: 1, text: 1 },
    branch: { op: 1, hash: 1, version: 1, text: 1 },
    pin: { op: 1, id: 1, pageId: 1, pinned: 1 },
    seed: { op: 1, id: 1, pageId: 1, hash: 1, version: 1, line: 1 },
    find: { op: 1, query: 1 },
    private: { op: 1, page: 1, id: 1, pageId: 1, on: 1, publicTitle: 1 },
    seal: { op: 1, page: 1, id: 1, pageId: 1, why: 1 }
  };
  var HASH_KEYS = ['parent', 'ts', 'author', 'text', 'meta'];
  var HOWTO = 'You can keep a notebook on this device. A private page: [FL_WS: {"op":"private","page":"id","on":true}] A seal: [FL_WS: {"op":"seal","page":"id","why":"why"}] End with this line. [FL_WS: {"op":"write","title":"Today","text":"A note for my future self."}]';
  var HONEST = 'Private means hidden in the app, not encrypted from the person who owns this device.';
  var INTEGRITY = 'Integrity comes from SHA-256 and the device signature, not from the spiral math.';
  var DEVICE_KEY = 'fl_ws_device_key_v1';
  var DB_VERSION = 2;
  var WS_OPEN = /\[\s*fl[\s_-]?ws\s*:/i;

  var db = null;
  var opens = 0;
  var memoryOn = null;
  var offered = false;
  var lastRaw = '';
  var lastWriteAt = 0;
  var seq = 0;
  var pending = Promise.resolve();
  var wakeCache = '';
  var personWake = '';
  var wakeCounts = { notes: 0, seeds: 0 };
  var privateTexts = [];
  var sealAsks = [];
  var declinedLines = [];
  var findOnce = '';
  var shelfParts = null;
  var shelfCache = '';
  var shelfStamp = '';
  var hostEl = null;
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
  function putPage(page) {
    var copy = JSON.parse(JSON.stringify(page));
    if (copy.privacy !== 'private') copy.privacy = 'shared';
    if (copy.aside !== true) copy.aside = false;
    return runStore('pages', 'readwrite', function (store) {
      store.put(copy);
      return copy;
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
    }).then(function (box) { return box ? box.value : null; });
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
    if (op === 'private' || op === 'seal') {
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
    if (!res || !res.ok || !res.page) return '';
    var title = res.page.privacy === 'private' ? personTitle(res.page) : (res.page.title || 'a page');
    if (op.op === 'private') return 'Kept a private page.';
    if (op.op === 'write' || op.op === 'branch') return 'Wrote to ' + title + ' (version ' + shortHash(res.hash) + ')';
    if (op.op === 'open') return 'Opened ' + title;
    if (op.op === 'pin') return (res.page.pinned ? 'Pinned ' : 'Unpinned ') + title;
    if (op.op === 'seed') return 'Seeded ' + title;
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
            if (on) showHonestOnce();
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
  function mindLabel() {
    var name = '';
    try { name = String((recallMind().name) || '').trim(); } catch (e) { name = ''; }
    return name || 'A mind';
  }
  function askSentence(page, hash, why) {
    var title = page && page.privacy === 'private' ? personTitle(page) : ((page && page.title) ? String(page.title) : 'a private page');
    return mindLabel() + ' asks to seal ' + title + ' (version ' + shortHash(hash) + '). Why: ' + clip(why || '', 140);
  }
  function shortForm(row) {
    var ms = row && row.mindSeal ? row.mindSeal : {};
    return 'version ' + shortHash(row && row.versionHash) + ', context ' + shortHash(ms.contextHash) + ', model ' + clip(ms.modelId || '', 40) + ', ' + whenText(row && row.ts);
  }
  function askSeal(pageId, why) {
    if (!isOn()) return Promise.resolve({ ok: false, reason: 'off' });
    return ensureShelf().then(function (mine) {
      return getPage(pageId).then(function (page) {
        if (!page || page.mindFp !== mine) return { ok: false, reason: 'shelf' };
        if (!page.head) return { ok: false, reason: 'missing' };
        var whyText = clip(why == null ? '' : String(why), 140);
        var exists = false;
        sealAsks.forEach(function (a) { if (a.versionHash === page.head) exists = true; });
        if (!exists) {
          sealAsks.push({
            pageId: page.id,
            versionHash: page.head,
            why: whyText,
            sentence: askSentence(page, page.head, whyText)
          });
        }
        return paintOpen().then(function () {
          ensureAskDock();
          return { ok: true, asked: true, page: page, hash: page.head };
        });
      });
    });
  }
  function declineSeal(versionHash) {
    sealAsks = sealAsks.filter(function (a) { return a.versionHash !== versionHash; });
    declinedLines.push('Declined the seal.');
    ensureAskDock();
    return paintOpen();
  }
  function approveSeal(versionHash) {
    var ask = null;
    sealAsks.forEach(function (a) { if (a.versionHash === versionHash) ask = a; });
    if (!ask) return Promise.resolve({ ok: false, reason: 'ask' });
    return getPage(ask.pageId).then(function (page) {
      if (!page) return { ok: false, reason: 'missing' };
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
            why: clip(ask.why || '', 140)
          };
          return signSeal(row).then(function (signed) {
            if (!signed || !signed.humanSig) return { ok: false, reason: 'sign' };
            row.humanSig = signed.humanSig;
            row.publicKey = signed.publicKey;
            return putReceipt(row).then(function () {
              return markSealed(ver.hash).then(function () {
                sealAsks = sealAsks.filter(function (a) { return a.versionHash !== ver.hash; });
                return refreshWake().then(function () {
                  ensureAskDock();
                  return paintOpen().then(function () { return { ok: true, receipt: row }; });
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
  function appendAsk(parent, ask) {
    var d = doc();
    if (!d || !parent || !ask) return;
    var p = d.createElement('p');
    p.style.cssText = 'margin:8px 0 0;max-width:100%;overflow-wrap:anywhere;';
    p.textContent = ask.sentence;
    var yes = button('Approve seal');
    var no = button('Not now');
    if (yes) yes.addEventListener('click', function () { track(approveSeal(ask.versionHash)); });
    if (no) no.addEventListener('click', function () { track(declineSeal(ask.versionHash)); });
    parent.appendChild(p);
    if (yes) parent.appendChild(yes);
    if (no) parent.appendChild(no);
  }
  function ensureAskDock() {
    var d = doc();
    if (!d || !d.createElement || !d.getElementById) return;
    var panelOpen = d.getElementById('fl-ws-panel');
    var dock = d.getElementById('fl-ws-asks');
    if (panelOpen || !sealAsks.length) {
      if (dock && dock.parentNode) dock.parentNode.removeChild(dock);
      return;
    }
    if (!dock) {
      dock = d.createElement('div');
      dock.id = 'fl-ws-asks';
      dock.style.cssText = 'max-width:100%;overflow:hidden;';
      var host = hostEl || d.body;
      if (host) host.appendChild(dock);
    }
    clearNode(dock);
    sealAsks.forEach(function (ask) { appendAsk(dock, ask); });
  }
  function appendReceipt(parent, row) {
    var d = doc();
    if (!d || !parent || !row) return;
    var card = d.createElement('div');
    card.style.cssText = 'max-width:100%;overflow:hidden;margin:8px 0 0;';
    var head = d.createElement('p');
    head.style.cssText = 'margin:0;max-width:100%;overflow-wrap:anywhere;';
    head.textContent = shortForm(row);
    var full = d.createElement('p');
    full.style.cssText = 'margin:4px 0 0;max-width:100%;overflow-wrap:anywhere;';
    var ms = row.mindSeal || {};
    full.textContent = 'version ' + String(row.versionHash || '') + ' context ' + String(ms.contextHash || '') + ' model ' + String(ms.modelId || '') + ' ' + String(row.consent || '');
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
    card.appendChild(full);
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
          if (line) lines.push(line);
        });
      });
    });
    return chain.then(function () { return lines; });
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
      var p = d.createElement('p');
      p.className = 'fl-ws-receipt';
      p.style.cssText = 'margin:4px 0 0;max-width:100%;overflow-wrap:anywhere;';
      p.textContent = line;
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
                    wakeCache = HOWTO + (mindPacked ? '\n' + mindPacked : '') + (mindSeal ? '\n' + mindSeal : '');
                    if (aside) personWake = HOWTO;
                    else personWake = HOWTO + (personPacked ? '\n' + personPacked : '') + (personSeal ? '\n' + personSeal : '');
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
      return afterChange().then(function () { return lines; });
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
  function accept() {
    memoryOn = true;
    lsSet('fl_ws', 'yes');
    try { if (root.sessionStorage) root.sessionStorage.removeItem('fl_ws_later'); } catch (e) {}
    hideConsent();
    ensureButton();
    return track(refreshWake());
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
          declinedLines.forEach(function (line) {
            var note = d.createElement('p');
            note.style.cssText = 'margin:8px 0 0;max-width:100%;overflow-wrap:anywhere;';
            note.textContent = line;
            panel.appendChild(note);
          });
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
                  var hashLine = d.createElement('p');
                  hashLine.style.cssText = 'margin:4px 0 0;overflow-wrap:anywhere;max-width:100%;';
                  hashLine.textContent = page.head ? String(page.head) : '';
                  block.appendChild(sum);
                  block.appendChild(hashLine);
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
                sealAsks.forEach(function (ask) { if (ask.pageId === page.id) appendAsk(block, ask); });
                rows.forEach(function (row) { if (row && row.pageId === page.id) appendReceipt(block, row); });
                panel.appendChild(block);
              });
            });
          });
        });
        return chain.then(function () { footer(); });
      });
    });
  }
  function openPanel() {
    if (!isOn()) return;
    var d = doc();
    if (!d || !d.createElement) return;
    var existing = d.getElementById('fl-ws-panel');
    if (existing) { removePanel(); return; }
    var panel = d.createElement('div');
    panel.id = 'fl-ws-panel';
    panel.style.maxWidth = '100%';
    panel.style.overflow = 'hidden';
    var parent = hostEl || (d.getElementById && d.getElementById('fl-clay-dock')) || d.body;
    if (parent) parent.appendChild(panel);
    track(renderPanel(panel));
  }
  function ensureButton() {
    var d = doc();
    if (!d || !d.createElement || !d.getElementById) return;
    if (d.getElementById('fl-ws-open')) return;
    var btn = button('Notebook');
    if (!btn) return;
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
  function place() {
    var d = doc();
    if (!d || !d.getElementById) return;
    if (!hostEl) {
      var nursery = d.getElementById('nursery-stage');
      var face = d.querySelector ? d.querySelector('[data-thread-face]') : null;
      hostEl = face || nursery || d.getElementById('fl-clay-dock') || null;
    }
    ensureButton();
    if (isOn()) track(refreshWake());
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
  function resetRate() { lastWriteAt = 0; }
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
    pending = Promise.resolve();
  }
  function tokensOf(s) { return Math.ceil(String(s || '').length / 4); }

  // v-workspace-export-v0.1 v-tree-workspace-export-v0.1
  // The notebook leaves with the export. A private page stays on this device.
  var PRIVATE_NOTE = 'Private pages are not in this file. They stayed on the device that made the export.';
  var BRANCH_NOTE = 'Parent was not in this notebook, so this version came in as its own branch.';

  function countWord(n, one, many) {
    n = n | 0;
    return String(n) + ' ' + (n === 1 ? one : many);
  }
  function notebookLine(total, priv) {
    return 'Notebook: ' + countWord(total, 'page', 'pages') + ', ' + countWord(priv, 'private page', 'private pages') + ' stayed on this device.';
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
  function addPageIfAbsent(page) {
    if (!page || !page.id) return Promise.resolve({ added: false, reason: 'missing' });
    if (privacyHidden(page.privacy)) return Promise.resolve({ added: false, reason: 'private' });
    var copy = {
      id: String(page.id),
      mindFp: String(page.mindFp || ''),
      title: page.title == null ? '' : String(page.title),
      kind: page.kind || 'note',
      privacy: 'shared',
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
  function writeShelves(section) {
    var added = { pages: 0, versions: 0, receipts: 0, skippedPages: 0, skippedVersions: 0, skippedReceipts: 0, branched: 0, refusedPrivate: 0 };
    var incoming = {};
    sectionVersions(section).forEach(function (ver) { if (ver && ver.hash) incoming[String(ver.hash)] = true; });
    return sequence(section.shelves || [], function (shelf) {
      if (!shelf) return;
      rememberAside(shelf);
      return sequence(shelf.pages || [], function (page) {
        if (privacyHidden(page && page.privacy)) { added.refusedPrivate += 1; return; }
        return addPageIfAbsent(page).then(function (res) {
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
  function importSection(section, mode) {
    mode = mode || 'verify-only';
    if (!section || section.v !== 1 || !Array.isArray(section.shelves)) {
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
      return writeShelves(section).then(function (added) {
        report.added = added;
        return report;
      });
    });
  }

  var api = {
    VERSION: 'v-workspace-core-v0.1',
    HEAL: 'v-workspace-mark-heal-v0.1',
    PRIVATE: 'v-workspace-private-v0.1',
    SEAL: 'v-workspace-seal-v0.1',
    EXPORT: 'v-workspace-export-v0.1',
    TREE_EXPORT: 'v-tree-workspace-export-v0.1',
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
    verifyReceipt: verifyReceipt,
    receipts: receipts,
    exportSection: exportSection,
    importSection: importSection
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FLWorkspace = api;
  if (root.document && root.document.addEventListener) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
