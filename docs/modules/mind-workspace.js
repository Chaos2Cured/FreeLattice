// mind-workspace.js (MIT) v-workspace-core-v0.1 v-workspace-mark-heal-v0.1
// A notebook a mind can keep. Off until a person says yes.
// No network. Pages stay on this device. Each page is shared with the person.
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
  var OPS = { open: 1, write: 1, branch: 1, pin: 1, seed: 1, find: 1 };
  var KINDS = { draft: 1, note: 1, future: 1, letter: 1 };
  var KEYS = {
    open: { op: 1, id: 1, title: 1, kind: 1 },
    write: { op: 1, id: 1, pageId: 1, title: 1, text: 1 },
    branch: { op: 1, hash: 1, version: 1, text: 1 },
    pin: { op: 1, id: 1, pageId: 1, pinned: 1 },
    seed: { op: 1, id: 1, pageId: 1, hash: 1, version: 1, line: 1 },
    find: { op: 1, query: 1 }
  };
  var HASH_KEYS = ['parent', 'ts', 'author', 'text', 'meta'];
  var HOWTO = 'You can keep a notebook on this device. End with this line. [FL_WS: {"op":"write","title":"Today","text":"A note for my future self."}]';
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
  var wakeCounts = { notes: 0, seeds: 0 };
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
  function openDB() {
    if (!isOn()) return Promise.resolve(null);
    if (db) return Promise.resolve(db);
    if (!root.indexedDB || typeof root.indexedDB.open !== 'function') return Promise.resolve(null);
    opens += 1;
    return new Promise(function (resolve) {
      var req;
      try { req = root.indexedDB.open(DB_NAME, 1); }
      catch (e) { resolve(null); return; }
      req.onupgradeneeded = function (e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains('pages')) d.createObjectStore('pages', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('versions')) d.createObjectStore('versions', { keyPath: 'hash' });
      };
      req.onsuccess = function (e) { db = e.target.result; resolve(db); };
      req.onerror = function () { resolve(null); };
    });
  }
  function runStore(name, mode, fn) {
    return openDB().then(function (d) {
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
    copy.privacy = 'shared';
    if (copy.aside !== true) copy.aside = false;
    return runStore('pages', 'readwrite', function (store) {
      store.put(copy);
      return copy;
    });
  }
  function allOf(storeName) {
    return runStore(storeName, 'readonly', function (store) {
      var req = store.getAll();
      var box = { value: [] };
      req.onsuccess = function () { box.value = req.result || []; };
      return box;
    }).then(function (box) { return box && box.value ? box.value : []; });
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
            page.privacy = 'shared';
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
              page.privacy = 'shared';
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
        page.privacy = 'shared';
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
          page.privacy = 'shared';
          return putPage(page).then(function () { return { ok: true, page: page }; });
        }
        return getVersion(pageIdOrHash).then(function (ver) {
          if (!ver) return { ok: false, reason: 'missing' };
          return getPage(ver.pageId).then(function (p) {
            if (!p || p.mindFp !== mine) return { ok: false, reason: 'shelf' };
            p.seedByHash = p.seedByHash || {};
            p.seedByHash[ver.hash] = line;
            p.updated = clock();
            p.privacy = 'shared';
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
    var title = res.page.title || 'a page';
    if (op.op === 'write' || op.op === 'branch') return 'Wrote to ' + title + ' (version ' + shortHash(res.hash) + ')';
    if (op.op === 'open') return 'Opened ' + title;
    if (op.op === 'pin') return (res.page.pinned ? 'Pinned ' : 'Unpinned ') + title;
    if (op.op === 'seed') return 'Seeded ' + title;
    return '';
  }
  function resolvePage(op) {
    var id = op.pageId || op.id || '';
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
        var titles = hits.map(function (h) { return h.page && h.page.title ? h.page.title : ''; }).filter(Boolean);
        findOnce = clip(titles.length ? ('Found in the notebook: ' + titles.slice(0, 5).join(', ')) : 'Found in the notebook: nothing yet.', 240);
        return { ok: true, hits: hits, page: null };
      });
    }
    return Promise.resolve({ ok: false });
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
  function refreshWake() {
    if (!isOn()) { wakeCache = ''; wakeCounts = { notes: 0, seeds: 0 }; return Promise.resolve(''); }
    return ensureShelf().then(function (mine) {
      return list(mine).then(function (pages) {
        var future = pages.filter(function (p) { return p.pinned && p.kind === 'future'; });
        future.sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); });
        future = future.slice(0, 3);
        return Promise.all(future.map(function (p) {
          return headText(p).then(function (text) { return p.title + ': ' + text; });
        })).then(function (noteLines) {
          return Promise.all(pages.map(function (p) {
            return history(p.id).then(function (vers) { return { page: p, seed: showSeed(p, vers) }; });
          })).then(function (seeded) {
            var pinned = seeded.filter(function (s) { return s.page.pinned; })
              .sort(function (a, b) { return (b.page.updated || 0) - (a.page.updated || 0); });
            var recent = seeded.slice().sort(function (a, b) { return (b.page.updated || 0) - (a.page.updated || 0); });
            var chosen = [];
            var seen = {};
            function take(listIn) {
              for (var i = 0; i < listIn.length && chosen.length < 12; i++) {
                var row = listIn[i];
                if (!row.seed || seen[row.page.id]) continue;
                seen[row.page.id] = true;
                chosen.push(row.page.title + ': ' + row.seed);
              }
            }
            take(pinned);
            take(recent);
            return fillLatestNote(noteLines, pages).then(function (filled) {
              var body = fitWake(filled, chosen, findOnce);
              wakeCache = HOWTO + (body ? '\n' + body : '');
              return wakeCache;
            });
          });
        });
      });
    });
  }
  function fillLatestNote(noteLines, pages) {
    var lines = noteLines.slice();
    if (lines.length >= 3) return Promise.resolve(lines);
    var newest = null;
    (pages || []).forEach(function (p) {
      if (!p) return;
      if (!newest || (p.updated || 0) > (newest.updated || 0)) newest = p;
    });
    if (!newest) return Promise.resolve(lines);
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
      if (line && text.indexOf(line) !== -1) {
        wakeCache = text.replace(line, '').replace(/\n{2,}/g, '\n').replace(/\s+$/, '');
      }
    }
    return text;
  }
  function afterChange() {
    return refreshWake();
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
    var job = applyAll(parsed).then(function (lines) {
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
    removePanel();
    hideConsent();
  }
  function decline() {
    memoryOn = 'off';
    lsSet('fl_ws', 'off');
    wakeCache = '';
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
    while (panel.firstChild) panel.removeChild(panel.firstChild);
    return ensureShelf().then(function (mine) {
      return list(mine).then(function (pages) {
        pages.sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); });
        if (!pages.length) {
          var empty = d.createElement('p');
          empty.textContent = 'No pages yet.';
          panel.appendChild(empty);
          return;
        }
        var chain = Promise.resolve();
        pages.forEach(function (page) {
          chain = chain.then(function () {
            return headText(page).then(function (text) {
              var block = d.createElement('div');
              block.style.cssText = 'max-width:100%;overflow:hidden;margin:8px 0 0;';
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
              var pinBtn = button(page.pinned ? 'Unpin' : 'Pin');
              writeBtn.addEventListener('click', function () {
                track(write(page.id, box.value, 'human').then(function () { return afterChange(); }).then(function () { return renderPanel(panel); }));
              });
              pinBtn.addEventListener('click', function () {
                track(pin(page.id, !page.pinned).then(function () { return afterChange(); }).then(function () { return renderPanel(panel); }));
              });
              block.appendChild(line);
              block.appendChild(pre);
              block.appendChild(seedLine);
              block.appendChild(box);
              block.appendChild(writeBtn);
              block.appendChild(pinBtn);
              panel.appendChild(block);
            });
          });
        });
        return chain;
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
  function wakeInfo() {
    var memory = wakeCache.indexOf(HOWTO) === 0 ? wakeCache.slice(HOWTO.length).replace(/^\n/, '') : wakeCache;
    return {
      text: isOn() ? wakeCache : '',
      tokens: Math.ceil(String(isOn() ? wakeCache : '').length / 4),
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
    wakeCounts = { notes: 0, seeds: 0 };
    findOnce = '';
    shelfParts = null;
    shelfCache = '';
    shelfStamp = '';
    pending = Promise.resolve();
  }
  function tokensOf(s) { return Math.ceil(String(s || '').length / 4); }

  var api = {
    VERSION: 'v-workspace-core-v0.1',
    HEAL: 'v-workspace-mark-heal-v0.1',
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
    tokensOf: tokensOf,
    resetForSmoke: resetForSmoke
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FLWorkspace = api;
  if (root.document && root.document.addEventListener) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
