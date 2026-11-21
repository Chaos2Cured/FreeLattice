/* backup-keys-home.js — v-backup-keys-home (Layer, never delete). 21 November 2026.

   Save Vault (FlBackup in app.html) used to write every localStorage value into the backup file,
   so saved keys and tokens such as fl_api_key or fl_github_token travelled in the clear. This module
   layers on top of it without changing app.html:

   - New backups: FlBackup builds its file exactly as before. Just before the file is made, this
     module reads it, takes out keys and passwords (the same rules as the garden move kit: only real
     key values count, provider names and fl_tokenLimit are not secrets), hides any copy of a saved key
     found in records or settings, checks the result, and only then lets the file be made. If the check
     fails, no file is made and the page says so. The file says keys stayed home
     (_meta.keys_kept_home), and the page says to enter them again on the new device.
   - Older backups that carry keys in the clear still restore exactly as before (nothing becomes
     unreadable). The page says plainly that the file carried keys in the clear and gently offers to
     save a safe backup now. Backups that kept keys home restore with a gentle note to enter keys again.

   Loaded by soul-ceremony.js. It uses the pack module's rules (FLGardenMoveKit._internal), loading
   modules/garden-move-kit.js when it is not on the page yet. It never sends anything anywhere and
   never clears storage. */
(function (root) {
  'use strict';

  var VERSION = 'v-backup-keys-home';
  var NOTE_KEY = 'fl_backup_keys_note';          // a small note for after the reload: kind, time, key names (never values)
  var KEPT_HOME_NOTE = 'Keys and passwords stayed on the device that made this backup. Enter them again on the new device.';
  // Sealed with a device's own unlock key: never readable on another device, so never "in the clear".
  var SEALED_RULE = /_enc$/;
  var SEALED_KEYS = ['fl_ghSyncToken'];
  var UNSAFE = ['__proto__', 'constructor', 'prototype'];

  function own(o, k) { return o !== null && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k); }
  function ownKeys(o) { return (o && typeof o === 'object') ? Object.keys(o).filter(function (k) { return UNSAFE.indexOf(k) === -1; }) : []; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  // ── The pack module's rules ──
  var kitWait = null;
  function kitRules() {
    var K = root.FLGardenMoveKit && root.FLGardenMoveKit._internal;
    return K && typeof K.isSecretName === 'function' && typeof K.hideSecretLeaves === 'function' ? K : null;
  }
  function ensureKit() {
    if (kitRules()) return Promise.resolve(kitRules());
    if (kitWait) return kitWait;
    kitWait = new Promise(function (resolve) {
      var doc = root.document;
      if (!doc) { resolve(null); return; }
      var s = doc.createElement('script');
      s.src = 'modules/garden-move-kit.js';
      s.async = true;
      s.onload = function () { resolve(kitRules()); };
      s.onerror = function () { kitWait = null; resolve(null); };
      doc.head.appendChild(s);
    });
    return kitWait;
  }

  // ── Structured walk over records: a field named like a key with a key-like value is blanked,
  //    then any copy of a saved key in a string is hidden. Numbers and names are never touched. ──
  function walk(v, K, values, counts, depth) {
    depth = depth || 0;
    if (typeof v === 'string') return values.length ? K.hideSecretLeaves(v, values, counts.hidden) : v;
    if (!v || typeof v !== 'object' || depth > 64) return v;
    if (Array.isArray(v)) return v.map(function (x) { return walk(x, K, values, counts, depth + 1); });
    var o = {};
    ownKeys(v).forEach(function (k) {
      if (K.secretFieldValue(k, v[k])) { o[k] = K.KEPT_LINE; counts.fields.n += 1; return; }
      o[k] = walk(v[k], K, values, counts, depth + 1);
    });
    return o;
  }
  // A settings value may itself be JSON with key fields inside (a companion, a tool setting).
  function walkSetting(str, K, values, counts) {
    if (typeof str !== 'string') return str;
    var t = str.trim();
    if (t.charAt(0) === '{' || t.charAt(0) === '[') {
      try {
        var parsed = JSON.parse(t);
        var before = counts.fields.n + counts.hidden.n;
        var out = walk(parsed, K, values, counts, 0);
        if (counts.fields.n + counts.hidden.n !== before) return JSON.stringify(out);
        return str;
      } catch (e) { /* not JSON: a plain string */ }
    }
    return values.length ? K.hideSecretLeaves(str, values, counts.hidden) : str;
  }

  // Take keys out of a backup object. liveSecrets: key values this device holds that may not be in the
  // file (the unlock key is never in it), so a copy of them inside a record is hidden too.
  function redact(backup, K, liveSecrets) {
    var values = [];
    var names = [];
    var ls = (backup && backup.localStorage && typeof backup.localStorage === 'object') ? backup.localStorage : {};
    var outLs = {};
    ownKeys(ls).forEach(function (k) {
      var v = ls[k];
      if (k === NOTE_KEY) return;
      if (K.isSecretName(k)) {
        names.push(k);
        if (typeof v === 'string' && K.huntable(k, v)) values.push(v.trim());
        return;
      }
      outLs[k] = v;
    });
    (liveSecrets || []).forEach(function (v) { if (typeof v === 'string' && v.trim() && values.indexOf(v.trim()) === -1) values.push(v.trim()); });
    var counts = { hidden: { n: 0 }, fields: { n: 0 } };
    ownKeys(outLs).forEach(function (k) { outLs[k] = walkSetting(outLs[k], K, values, counts); });
    var idb = Array.isArray(backup.indexedDB) ? backup.indexedDB.map(function (db) { return walk(db, K, values, counts, 0); }) : backup.indexedDB;
    var meta = {};
    ownKeys(backup._meta || {}).forEach(function (k) { meta[k] = backup._meta[k]; });
    meta.keys_kept_home = true;
    meta.keys_note = KEPT_HOME_NOTE;
    meta.keys_left_out = names.length;
    meta.keys_hidden_in_records = counts.hidden.n + counts.fields.n;
    meta.keys_layer = VERSION;
    var out = {};
    ownKeys(backup).forEach(function (k) { out[k] = backup[k]; });
    out._meta = meta; out.localStorage = outLs; if (own(backup, 'indexedDB')) out.indexedDB = idb;
    var text = JSON.stringify(out, null, 2);
    var problems = [];
    values.forEach(function (v) { if (K.containsSecret(text, v)) problems.push('a saved key is still in the file'); });
    ownKeys(outLs).forEach(function (k) { if (K.isSecretName(k)) problems.push('a key setting is still in the file'); });
    if (Array.isArray(out.indexedDB) && K.countSecretFields(out.indexedDB, 0) > 0) problems.push('a key field is still in the file');
    return { ok: problems.length === 0, problems: problems, backup: out, text: text, names: names, hidden: counts.hidden.n + counts.fields.n };
  }

  // What an older backup holds, read before it is restored (nothing here writes).
  function inspect(backup, K) {
    var res = { isBackup: false, keptHome: false, clearNames: [], clearFields: 0 };
    if (!backup || !backup._meta || backup._meta.type !== 'freelattice-backup') return res;
    res.isBackup = true;
    res.keptHome = backup._meta.keys_kept_home === true;
    var ls = (backup.localStorage && typeof backup.localStorage === 'object') ? backup.localStorage : {};
    ownKeys(ls).forEach(function (k) {
      var v = ls[k];
      if (!K.isSecretName(k) || SEALED_RULE.test(k) || SEALED_KEYS.indexOf(k) !== -1) return;
      if (typeof v === 'string' && (K.huntable(k, v) || K.secretFieldValue(k, v))) res.clearNames.push(k);
    });
    if (Array.isArray(backup.indexedDB)) res.clearFields = K.countSecretFields(backup.indexedDB, 0);
    res.carriedClear = res.clearNames.length > 0 || res.clearFields > 0;
    return res;
  }

  function liveSecrets(K) {
    var out = [];
    try {
      for (var i = 0; i < root.localStorage.length; i++) {
        var k = root.localStorage.key(i);
        if (!K.isSecretName(k)) continue;
        var v = root.localStorage.getItem(k);
        if (typeof v === 'string' && K.huntable(k, v)) out.push(v.trim());
      }
    } catch (e) { /* storage blocked: the file's own values are still hunted */ }
    return out;
  }

  // ── The page ──
  function statusEl() { return root.document && root.document.getElementById('flBackupStatus'); }
  function addLine(text, tone) {
    var st = statusEl();
    if (!st) return null;
    var p = root.document.createElement('div');
    p.className = 'fl-backup-keys-line';
    p.style.cssText = 'margin-top:8px;line-height:1.6;font-size:0.86rem;color:' + (tone === 'warn' ? '#f0c674' : 'var(--text-secondary)') + ';';
    p.textContent = text;
    st.appendChild(p);
    return p;
  }
  function readNote() { try { var n = JSON.parse(root.localStorage.getItem(NOTE_KEY) || 'null'); return n && typeof n === 'object' ? n : null; } catch (e) { return null; } }
  function writeNote(n) { try { root.localStorage.setItem(NOTE_KEY, JSON.stringify(n)); } catch (e) { /* the note shows now, not after reload */ } }
  function clearNote() { try { root.localStorage.removeItem(NOTE_KEY); } catch (e) { /* nothing to do */ } }
  function clearWords(n) {
    var list = (n.names || []).slice(0, 6).join(', ');
    return 'This backup carried ' + (n.names && n.names.length ? 'saved keys in the clear (' + list + ')' : 'a saved key in the clear') +
      (n.fields ? (n.names && n.names.length ? ' and ' : ', ') + plural(n.fields, 'key inside a record', 'keys inside records') : '') +
      ', so anyone holding that file could read them. Everything was restored and works as before. ' +
      'You can save a new, safe backup now: keys stay on this device and never go in the file. After that, you may delete the old file.';
  }
  function renderNote() {
    var n = readNote();
    var st = statusEl();
    if (!n || !root.document.body || root.document.getElementById('flBackupKeysNote')) return;
    // The Memory Vault sits inside Settings, under Advanced, so after the reload it is usually out of
    // sight. Then the note is a small card at the bottom of the screen until it is answered.
    var inPanel = !!(st && st.getBoundingClientRect().height > 0 && st.offsetParent !== null);
    var box = root.document.createElement('div');
    box.id = 'flBackupKeysNote';
    box.setAttribute('role', 'note');
    box.style.cssText = inPanel
      ? 'margin-top:10px;padding:12px 14px;border-radius:10px;border:1px solid rgba(212,160,23,0.35);background:rgba(212,160,23,0.06);line-height:1.6;font-size:0.88rem;'
      : 'position:fixed;left:12px;right:12px;bottom:16px;margin:0 auto;max-width:560px;z-index:99990;padding:14px 16px;border-radius:12px;' +
        'border:1px solid rgba(212,160,23,0.5);background:var(--bg-secondary,#16161d);color:var(--text-primary,#eee);box-shadow:0 8px 28px rgba(0,0,0,0.45);line-height:1.6;font-size:0.9rem;';
    var p = root.document.createElement('p');
    p.style.margin = '0 0 10px';
    p.textContent = n.kind === 'clear' ? clearWords(n) : 'This backup kept keys and passwords at home, on the device that made it. Enter them again in Settings when you need them.';
    box.appendChild(p);
    function btn(label, fn, strong) {
      var b = root.document.createElement('button');
      b.type = 'button'; b.className = 'fl-backup-btn'; b.textContent = label;
      b.style.cssText = 'min-height:44px;width:auto;margin:6px 8px 0 0;padding:0 16px;border-radius:8px;font:inherit;cursor:pointer;color:inherit;' +
        'border:1px solid rgba(212,160,23,' + (strong ? '0.55' : '0.3') + ');background:rgba(212,160,23,' + (strong ? '0.18' : '0.06') + ');' + (strong ? 'font-weight:600;' : '');
      b.addEventListener('click', fn);
      box.appendChild(b);
    }
    if (n.kind === 'clear') {
      btn('Save a safe backup now', function () {
        var F = flBackup();
        if (!F) return;
        Promise.resolve(F.exportData()).then(function () {
          if (lastExport && lastExport.ok) { clearNote(); box.remove(); }
        });
      }, true);
      btn('Not now', function () { clearNote(); box.remove(); });
    } else {
      btn('OK', function () { clearNote(); box.remove(); });
    }
    if (inPanel) st.parentNode.insertBefore(box, st.nextSibling);
    else root.document.body.appendChild(box);
  }

  // ── Wrap FlBackup (whatever is there now, so the ceremony wrapper keeps working) ──
  function flBackup() {
    /* global FlBackup */
    try { if (typeof FlBackup !== 'undefined' && FlBackup) return FlBackup; } catch (e) { /* not on this page */ }
    return root.FlBackup || null;
  }
  var lastExport = null;
  var busy = false;
  function wrapExport(inner) {
    var safe = function () {
      var self = this, args = arguments;
      if (busy) return Promise.resolve();
      busy = true;
      lastExport = null;
      return ensureKit().then(function (K) {
        if (!K) {
          var st = statusEl();
          if (st) st.textContent = 'Save Vault is waiting for its key check to load. Nothing was saved. Please try again in a moment.';
          lastExport = { ok: false, problems: ['key check not loaded'] };
          return;
        }
        var RealBlob = root.Blob;
        var secrets = liveSecrets(K);
        function SafeBlob(parts, opts) {
          if (parts && parts.length === 1 && typeof parts[0] === 'string' && parts[0].indexOf('"freelattice-backup"') !== -1) {
            var parsed = null;
            try { parsed = JSON.parse(parts[0]); } catch (e) { parsed = null; }
            if (parsed && parsed._meta && parsed._meta.type === 'freelattice-backup') {
              var r = redact(parsed, K, secrets);
              lastExport = r;
              // No file is made if a key could still be in it: FlBackup shows "Export failed" with this reason.
              if (!r.ok) throw new Error('a saved key could not be taken out, so nothing was saved (' + r.problems[0] + ')');
              parts = [r.text];
            }
          }
          return new RealBlob(parts, opts);
        }
        SafeBlob.prototype = RealBlob.prototype;
        root.Blob = SafeBlob;
        return Promise.resolve().then(function () { return inner.apply(self, args); }).then(function () {
          root.Blob = RealBlob;
          if (lastExport && lastExport.ok) {
            addLine('Keys and passwords stayed on this device' +
              (lastExport.names.length ? ' (' + plural(lastExport.names.length, 'key setting', 'key settings') + ' left out)' : '') +
              (lastExport.hidden ? ', and ' + plural(lastExport.hidden, 'copy of a key was', 'copies of keys were') + ' hidden in your records' : '') +
              '. On a new device, enter them again in Settings.');
          }
        }, function (err) { root.Blob = RealBlob; throw err; });
      }).then(function () { busy = false; }, function (err) { busy = false; throw err; });
    };
    safe.__flKeysHome = VERSION;
    return safe;
  }
  function wrapImport(inner) {
    var safe = function (fileInput) {
      var self = this;
      var file = fileInput && fileInput.files && fileInput.files[0];
      var info = null;
      var read = file && typeof file.text === 'function' ? file.text() : Promise.resolve(null);
      return Promise.all([read.catch(function () { return null; }), ensureKit()]).then(function (got) {
        var text = got[0], K = got[1];
        if (text && K) { try { info = inspect(JSON.parse(text), K); } catch (e) { info = null; } }
        // FlBackup restores exactly as before: older files with keys in the clear still work.
        return inner.call(self, fileInput);
      }).then(function () {
        var st = statusEl();
        var restored = st && /Restored/.test(st.textContent || '');
        if (!restored || !info || !info.isBackup) return;
        if (info.carriedClear) {
          var n = { kind: 'clear', at: new Date().toISOString(), names: info.clearNames.slice(0, 20), fields: info.clearFields };
          writeNote(n);
          addLine(clearWords(n), 'warn');
        } else if (info.keptHome) {
          writeNote({ kind: 'home', at: new Date().toISOString() });
          addLine(KEPT_HOME_NOTE.replace('the new device', 'this device'));
        }
      });
    };
    safe.__flKeysHome = VERSION;
    return safe;
  }
  // Wrap once. soul-ceremony.js may wrap again on top of this (it calls what it found), which keeps both.
  var installed = false;
  function install() {
    if (installed) return true;
    var F = flBackup();
    if (!F || typeof F.exportData !== 'function' || typeof F.importData !== 'function') return false;
    if (!F.exportData.__flKeysHome) F.exportData = wrapExport(F.exportData);
    if (!F.importData.__flKeysHome) F.importData = wrapImport(F.importData);
    installed = true;
    return true;
  }

  var api = {
    VERSION: VERSION,
    install: install,
    ensureKit: ensureKit,
    renderNote: renderNote,
    lastExport: function () { return lastExport; },
    _internal: { redact: redact, inspect: inspect, walk: walk, NOTE_KEY: NOTE_KEY, KEPT_HOME_NOTE: KEPT_HOME_NOTE, SEALED_KEYS: SEALED_KEYS }
  };
  root.FLBackupKeysHome = api;

  if (root.document) {
    var tries = 0;
    var go = function () {
      ensureKit();
      // soul-ceremony.js also wraps FlBackup, 2 seconds after load. Wrapping whatever is there keeps both.
      if (!install() && tries++ < 40) { root.setTimeout(go, 250); return; }
      renderNote();
      root.setTimeout(renderNote, 2600);
    };
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', go);
    else go();
  }
})(typeof window !== 'undefined' ? window : this);
