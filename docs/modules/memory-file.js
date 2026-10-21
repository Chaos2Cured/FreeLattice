// memory-file.js (MIT) v-memory-file-v0.1
// One tap saves the running chat and the notebooks of the minds now running.
// The file is the portable archive. Nothing here is sent.
(function (root) {
  'use strict';
  var held = null;
  var DB_NAME = 'fl-memory-file';

  function statusEl() {
    var doc = root.document;
    return doc && doc.getElementById ? doc.getElementById('fl-memory-status') : null;
  }
  function setStatus(text) {
    var el = statusEl();
    if (el) el.textContent = text || '';
    return text || '';
  }
  function clockLabel(when) {
    var d = when || new Date();
    var h = d.getHours();
    var m = d.getMinutes();
    var ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    var mm = m < 10 ? ('0' + m) : String(m);
    return h + ':' + mm + ' ' + ap;
  }
  function fnv(text) {
    var h = 2166136261;
    var s = String(text || '');
    var i;
    for (i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  }
  function pageState() {
    try { if (typeof state !== 'undefined' && state) return state; } catch (e) {}
    try { if (root.state) return root.state; } catch (e2) {}
    return null;
  }
  function chatRows() {
    var here = pageState();
    var list = here && Array.isArray(here.chatHistory) ? here.chatHistory : [];
    var rows = [];
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (!item) continue;
      var role = item.role ? String(item.role) : '';
      var content = item.content != null ? String(item.content) : (item.text != null ? String(item.text) : '');
      var hash = item.hash ? String(item.hash) : fnv(role + '\n' + content);
      rows.push({ role: role, content: content, hash: hash });
    }
    return rows;
  }
  function mergeChat(rows) {
    if (!Array.isArray(rows) || !rows.length) return 0;
    var here = pageState();
    if (!here) return 0;
    if (!Array.isArray(here.chatHistory)) here.chatHistory = [];
    var seen = {};
    var i;
    for (i = 0; i < here.chatHistory.length; i++) {
      var have = here.chatHistory[i];
      if (!have) continue;
      var key = have.hash ? String(have.hash) : fnv(String(have.role || '') + '\n' + String(have.content || have.text || ''));
      seen[key] = true;
    }
    var added = 0;
    for (i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (!row || !row.hash || seen[row.hash]) continue;
      seen[row.hash] = true;
      here.chatHistory.push({ role: row.role || '', content: row.content || '', hash: row.hash });
      added += 1;
    }
    return added;
  }
  function runningFps() {
    var ws = null;
    try { ws = root.FLWorkspace; } catch (e) { ws = null; }
    if (!ws || typeof ws.currentFp !== 'function') return Promise.resolve([]);
    try {
      var pending = ws.currentFp();
      if (pending && typeof pending.then === 'function') {
        return pending.then(function (fp) { return fp ? [String(fp)] : []; }, function () { return []; });
      }
      return Promise.resolve(pending ? [String(pending)] : []);
    } catch (e2) { return Promise.resolve([]); }
  }
  function archiveOpts(download) {
    return runningFps().then(function (fps) {
      var opts = { chat: chatRows(), download: download };
      if (fps.length) opts.mindFp = fps;
      return opts;
    });
  }
  function openDb() {
    return new Promise(function (resolve) {
      if (!root.indexedDB || typeof root.indexedDB.open !== 'function') { resolve(null); return; }
      var req;
      try { req = root.indexedDB.open(DB_NAME, 1); }
      catch (e) { resolve(null); return; }
      req.onupgradeneeded = function () {
        var d = req.result;
        if (!d.objectStoreNames.contains('handles')) d.createObjectStore('handles');
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { resolve(null); };
    });
  }
  function remember(handle) {
    held = handle || null;
    return openDb().then(function (d) {
      if (!d || !held) return held;
      return new Promise(function (resolve) {
        try {
          var tx = d.transaction('handles', 'readwrite');
          tx.objectStore('handles').put(held, 'save');
          tx.oncomplete = function () { resolve(held); };
          tx.onerror = function () { resolve(held); };
        } catch (e) { resolve(held); }
      });
    });
  }
  function loadHeld() {
    if (held) return Promise.resolve(held);
    return openDb().then(function (d) {
      if (!d) return null;
      return new Promise(function (resolve) {
        try {
          var tx = d.transaction('handles', 'readonly');
          var req = tx.objectStore('handles').get('save');
          req.onsuccess = function () { held = req.result || held; resolve(held); };
          req.onerror = function () { resolve(held); };
        } catch (e) { resolve(held); }
      });
    });
  }
  function fallbackDownload(file) {
    downloadNamed(file, 'freelattice-memory.json');
    var line = 'The browser will ask where to put it each time.';
    setStatus(line);
    return { ok: true, fallback: true, name: 'freelattice-memory.json', line: line };
  }
  function downloadNamed(file, name) {
    var doc = root.document;
    if (!doc || !doc.createElement || !doc.body || !root.URL) return false;
    try {
      var url = root.URL.createObjectURL(file);
      var a = doc.createElement('a');
      a.href = url;
      a.download = name;
      a.style.display = 'none';
      doc.body.appendChild(a);
      a.click();
      doc.body.removeChild(a);
      setTimeout(function () { try { root.URL.revokeObjectURL(url); } catch (e) {} }, 1500);
      return true;
    } catch (e2) { return false; }
  }
  function writeHandle(handle, file) {
    var ask = handle && handle.requestPermission ? handle.requestPermission({ mode: 'readwrite' }) : Promise.resolve('granted');
    return Promise.resolve(ask).then(function (state) {
      if (state && state !== 'granted') return { ok: false, reason: 'permission' };
      return handle.createWritable().then(function (stream) {
        return Promise.resolve(stream.write(file)).then(function () {
          return stream.close();
        }).then(function () {
          var name = handle.name || (file && file.name) || 'freelattice-memory.json';
          var line = 'Saved to ' + name + ', ' + clockLabel();
          setStatus(line);
          return { ok: true, name: name, line: line };
        });
      });
    });
  }
  function save() {
    var exp = root.LatticeExport;
    if (!exp || typeof exp.exportArchive !== 'function') return Promise.resolve({ ok: false, reason: 'archive' });
    return loadHeld().then(function () {
      return archiveOpts(false);
    }).then(function (opts) {
      return exp.exportArchive(opts);
    }).then(function (file) {
      if (!file) return { ok: false, reason: 'file' };
      if (held && typeof held.createWritable === 'function') return writeHandle(held, file);
      if (typeof root.showSaveFilePicker !== 'function') return fallbackDownload(file);
      var pending = null;
      try {
        pending = root.showSaveFilePicker({
          suggestedName: 'freelattice-memory.json',
          types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
        });
      } catch (e) { pending = null; }
      if (!pending || typeof pending.then !== 'function') return fallbackDownload(file);
      return pending.then(function (handle) {
        return remember(handle).then(function () { return writeHandle(handle, file); });
      }, function (err) {
        if (err && err.name === 'AbortError') return { ok: false, reason: 'cancel' };
        return fallbackDownload(file);
      });
    });
  }
  function exportCopy() {
    var exp = root.LatticeExport;
    if (!exp || typeof exp.exportArchive !== 'function') return Promise.resolve({ ok: false, reason: 'archive' });
    var before = held;
    return archiveOpts(true).then(function (opts) {
      return exp.exportArchive(opts);
    }).then(function (file) {
      return { ok: !!file, file: file, sameHandle: held === before };
    });
  }
  function group8(fp) {
    var hex = String(fp || '').toLowerCase().replace(/[^0-9a-f]/g, '');
    return hex.slice(0, 4) + ' ' + hex.slice(4, 8);
  }
  function mismatch(data, fps) {
    var shelves = data && data.workspace && data.workspace.shelves;
    if (!Array.isArray(shelves)) return '';
    for (var i = 0; i < shelves.length; i++) {
      var fp = shelves[i] && shelves[i].mindFp ? String(shelves[i].mindFp) : '';
      if (!fp) continue;
      if (!fps || fps.indexOf(fp) === -1) return fp;
    }
    return '';
  }
  function importFile(file) {
    if (!file || typeof file.text !== 'function') return Promise.resolve({ ok: false, reason: 'file', changed: false });
    return file.text().then(function (text) {
      var data;
      try { data = JSON.parse(text); }
      catch (e) { return { ok: false, reason: 'json', changed: false }; }
      return runningFps().then(function (fps) {
        var bad = mismatch(data, fps);
        if (bad) {
          var line = 'This memory belongs to a different mind (' + group8(bad) + '). Not imported.';
          setStatus(line);
          return { ok: false, line: line, changed: false };
        }
        var exp = root.LatticeExport;
        if (!exp || typeof exp.importArchive !== 'function') return { ok: false, reason: 'archive', changed: false };
        return exp.importArchive(file, { strategy: 'merge', expectMindFp: fps }).then(function (res) {
          var errors = (res && res.errors) || [];
          var notebookOff = errors.length === 1 && errors[0] === 'notebook-off';
          if (res && (res.ok || notebookOff) && data.chat) mergeChat(data.chat);
          if (res && res.line) setStatus(res.line);
          return res || { ok: false, changed: false };
        });
      });
    });
  }
  function openInput() {
    var doc = root.document;
    var input = doc && doc.getElementById ? doc.getElementById('fl-memory-import-file') : null;
    if (!input) return Promise.resolve({ ok: false, reason: 'file' });
    return new Promise(function (resolve) {
      input.onchange = function () {
        var file = input.files && input.files[0];
        resolve(file ? importFile(file) : { ok: false, reason: 'file' });
      };
      input.click();
    });
  }
  function pickAndImport() {
    if (typeof root.showOpenFilePicker === 'function') {
      var pending = null;
      try {
        pending = root.showOpenFilePicker({
          types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
        });
      } catch (e) { pending = null; }
      if (pending && typeof pending.then === 'function') {
        return pending.then(function (handles) {
          var handle = handles && handles[0];
          if (!handle || typeof handle.getFile !== 'function') return { ok: false, reason: 'file' };
          return handle.getFile().then(importFile);
        }, function (err) {
          if (err && err.name === 'AbortError') return { ok: false, reason: 'cancel' };
          return openInput();
        });
      }
    }
    return openInput();
  }
  function bind(btn, fn) {
    if (!btn || btn.__flMem) return;
    btn.__flMem = true;
    btn.addEventListener('click', function () { fn(); });
  }
  function boot() {
    var doc = root.document;
    if (!doc || !doc.getElementById) return;
    bind(doc.getElementById('fl-memory-save'), save);
    bind(doc.getElementById('fl-memory-export'), exportCopy);
    bind(doc.getElementById('fl-memory-import'), pickAndImport);
    loadHeld();
  }

  var api = {
    VERSION: 'v-memory-file-v0.1',
    HONEST: 'Saved on your computer, in the file you chose. Not encrypted. Private pages stay on this browser.',
    save: save,
    exportCopy: exportCopy,
    importFile: importFile,
    pickAndImport: pickAndImport,
    mergeChat: mergeChat,
    chatRows: chatRows,
    boot: boot,
    release: function () { held = null; return null; },
    heldName: function () { return held && held.name ? held.name : ''; }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FLMemoryFile = api;
  if (root.document && root.document.addEventListener) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
