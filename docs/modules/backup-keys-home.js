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
  var KEPT = '[kept on this device]';             // the same words the pack module uses (FLGardenMoveKit._internal.KEPT_LINE)

  function own(o, k) { return o !== null && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k); }
  function ownKeys(o) { return (o && typeof o === 'object') ? Object.keys(o).filter(function (k) { return UNSAFE.indexOf(k) === -1; }) : []; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  // ── The pack module's rules ──
  var kitWait = null;
  // Hypha walk of #368 (649d5cce): every rule this module uses is checked, so a stale copy of the pack
  // module (an older cached file) fails closed with plain words instead of "K.huntable is not a function".
  var KIT_FUNCTIONS = ['isSecretName', 'huntable', 'hideSecretLeaves', 'secretFieldValue', 'containsSecret', 'countSecretFields'];
  function kitRules() {
    var K = root.FLGardenMoveKit && root.FLGardenMoveKit._internal;
    // before (649d5cce): return K && typeof K.isSecretName === 'function' && typeof K.hideSecretLeaves === 'function' ? K : null;
    if (!K || K.KEPT_LINE !== KEPT) return null;
    for (var i = 0; i < KIT_FUNCTIONS.length; i++) if (typeof K[KIT_FUNCTIONS[i]] !== 'function') return null;
    return K;
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

  // ── Key shapes (Hypha walk of #368, H1) ──
  // A key pasted into a chat is often not stored in the clear on this device (saved keys are sealed), so
  // it cannot be found by value. Values shaped like well-known keys are hidden too: a known prefix, then
  // a long run of key characters, on word edges, with both letters and digits. Lengths are bounded so
  // ordinary words and numbers are never cut.
  var KEY_SHAPE_PARTS = [
    'sk-[A-Za-z0-9_-]{20,250}', '(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{16,120}',
    'gh[pousr]_[A-Za-z0-9]{30,100}', 'github_pat_[A-Za-z0-9_]{30,120}',
    'hf_[A-Za-z0-9]{30,60}', 'gsk_[A-Za-z0-9]{30,80}', 'xai-[A-Za-z0-9]{30,120}',
    'AIza[0-9A-Za-z_-]{35}', 'ya29\\.[0-9A-Za-z_-]{20,400}', 'xox[abprs]-[A-Za-z0-9-]{10,200}',
    'glpat-[A-Za-z0-9_-]{20,60}', 'r8_[A-Za-z0-9]{30,60}', 'pplx-[A-Za-z0-9]{30,80}', 'nvapi-[A-Za-z0-9_-]{30,90}',
    '[0-9]{8,10}:AA[A-Za-z0-9_-]{30,40}'
  ];
  function keyShapeRe() { return new RegExp('(^|[^A-Za-z0-9_-])(' + KEY_SHAPE_PARTS.join('|') + ')(?![A-Za-z0-9_-])', 'g'); }
  function realShape(m) { return /[0-9]/.test(m) && /[A-Za-z]/.test(m); }
  function hideKeyShapes(str, counter) {
    if (typeof str !== 'string' || str.length < 16) return str;
    return str.replace(keyShapeRe(), function (m, edge, key) {
      if (!realShape(key)) return m;
      counter.n += 1;
      return edge + KEPT;
    });
  }
  function hasKeyShape(str) {
    if (typeof str !== 'string') return false;
    var re = keyShapeRe(), m;
    while ((m = re.exec(str))) { if (realShape(m[2])) return true; }
    return false;
  }
  function hideString(v, K, values, counts) {
    var out = values.length ? K.hideSecretLeaves(v, values, counts.hidden) : v;
    return hideKeyShapes(out, counts.shapes);
  }

  // ── Structured walk over records: a field named like a key with a key-like value is blanked,
  //    then any copy of a saved key in a string is hidden. Numbers and names are never touched. ──
  function walk(v, K, values, counts, depth) {
    depth = depth || 0;
    // before (649d5cce): if (typeof v === 'string') return values.length ? K.hideSecretLeaves(v, values, counts.hidden) : v;
    if (typeof v === 'string') return hideString(v, K, values, counts);
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
        // before (649d5cce): var before = counts.fields.n + counts.hidden.n;
        var before = counts.fields.n + counts.hidden.n + counts.shapes.n;
        var out = walk(parsed, K, values, counts, 0);
        // before (649d5cce): if (counts.fields.n + counts.hidden.n !== before) return JSON.stringify(out);
        if (counts.fields.n + counts.hidden.n + counts.shapes.n !== before) return JSON.stringify(out);
        return str;
      } catch (e) { /* not JSON: a plain string */ }
    }
    // before (649d5cce): return values.length ? K.hideSecretLeaves(str, values, counts.hidden) : str;
    return hideString(str, K, values, counts);
  }

  // Where is a key written as a name (an object key)? Only the place is named, never the name itself.
  function keyNamePlaces(v, K, values, path, out, depth) {
    depth = depth || 0;
    if (!v || typeof v !== 'object' || depth > 64 || out.length >= 5) return out;
    var arr = Array.isArray(v);
    Object.keys(v).forEach(function (k) {
      if (out.length >= 5) return;
      var bad = !arr && (hasKeyShape(k) || values.some(function (sv) { return K.containsSecret(k, sv); }));
      if (bad) out.push(path.join(' \u203a ') + ' (a key used as a name)');
      var label = arr ? 'item ' + (Number(k) + 1) : (bad ? '\u2026' : k);
      var child = v[k];
      if (typeof child === 'string' && /^\s*[{[]/.test(child)) { try { child = JSON.parse(child); } catch (e) { /* plain text */ } }
      keyNamePlaces(child, K, values, path.concat([label]), out, depth + 1);
    });
    return out;
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
    // before (649d5cce): var counts = { hidden: { n: 0 }, fields: { n: 0 } };
    var counts = { hidden: { n: 0 }, fields: { n: 0 }, shapes: { n: 0 } };
    ownKeys(outLs).forEach(function (k) { outLs[k] = walkSetting(outLs[k], K, values, counts); });
    var idb = Array.isArray(backup.indexedDB) ? backup.indexedDB.map(function (db) { return walk(db, K, values, counts, 0); }) : backup.indexedDB;
    var meta = {};
    ownKeys(backup._meta || {}).forEach(function (k) { meta[k] = backup._meta[k]; });
    meta.keys_kept_home = true;
    meta.keys_note = KEPT_HOME_NOTE;
    meta.keys_left_out = names.length;
    // before (649d5cce): meta.keys_hidden_in_records = counts.hidden.n + counts.fields.n;
    meta.keys_hidden_in_records = counts.hidden.n + counts.fields.n + counts.shapes.n;
    meta.keys_layer = VERSION;
    var out = {};
    ownKeys(backup).forEach(function (k) { out[k] = backup[k]; });
    out._meta = meta; out.localStorage = outLs; if (own(backup, 'indexedDB')) out.indexedDB = idb;
    var text = JSON.stringify(out, null, 2);
    var problems = [];
    values.forEach(function (v) { if (K.containsSecret(text, v)) problems.push('a saved key is still in the file'); });
    ownKeys(outLs).forEach(function (k) { if (K.isSecretName(k)) problems.push('a key setting is still in the file'); });
    if (Array.isArray(out.indexedDB) && K.countSecretFields(out.indexedDB, 0) > 0) problems.push('a key field is still in the file');
    if (hasKeyShape(text)) problems.push('a key-shaped value is still in the file');
    var places = [];
    if (problems.length) {
      keyNamePlaces(outLs, K, values, ['your settings'], places, 0);
      (Array.isArray(out.indexedDB) ? out.indexedDB : []).forEach(function (db) {
        var stores = db && db.stores && typeof db.stores === 'object' ? db.stores : {};
        ownKeys(stores).forEach(function (st) { keyNamePlaces(stores[st], K, values, [String(db.name || 'a database'), st], places, 0); });
      });
    }
    // before (649d5cce): return { ok: problems.length === 0, problems: problems, backup: out, text: text, names: names, hidden: counts.hidden.n + counts.fields.n };
    return { ok: problems.length === 0, problems: problems, places: places, backup: out, text: text, names: names,
      hidden: counts.hidden.n + counts.fields.n + counts.shapes.n };
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
    // H1: a pasted key (shaped like a well-known key) anywhere else in the file counts too.
    var rest = {};
    ownKeys(ls).forEach(function (k) { if (res.clearNames.indexOf(k) === -1) rest[k] = ls[k]; });
    var shapes = { n: 0 };
    try { hideKeyShapes(JSON.stringify([rest, backup.indexedDB || null]), shapes); } catch (e) { shapes.n = 0; }
    res.clearShapes = shapes.n;
    // before (649d5cce): res.carriedClear = res.clearNames.length > 0 || res.clearFields > 0;
    res.carriedClear = res.clearNames.length > 0 || res.clearFields > 0 || res.clearShapes > 0;
    return res;
  }

  // ── Restore never lets "[kept on this device]" replace a real value (Hypha walk of #368, H2) ──
  // A string holding the placeholder (a key field, "Bearer [kept on this device]", a chat line with a
  // hidden key) keeps what this device already has at the same place, when this device's value fits the
  // same words around the placeholder. Where this device has nothing there (a new device), the file's
  // value is written as before.
  function fits(template, dev) {
    if (typeof dev !== 'string' || dev === template || dev.indexOf(KEPT) !== -1) return false;
    var parts = template.split(KEPT);
    if (dev.indexOf(parts[0]) !== 0) return false;
    var at = parts[0].length;
    for (var i = 1; i < parts.length - 1; i++) {
      var j = dev.indexOf(parts[i], at + 1);
      if (j === -1) return false;
      at = j + parts[i].length;
    }
    var last = parts[parts.length - 1];
    return dev.length - last.length > at && dev.slice(dev.length - last.length) === last;
  }
  function keepDevice(inc, dev, stats, depth) {
    depth = depth || 0;
    if (typeof inc === 'string') {
      if (inc.indexOf(KEPT) === -1) return inc;
      if (fits(inc, dev)) { stats.kept += 1; return dev; }
      stats.left += 1;
      return inc;
    }
    if (!inc || typeof inc !== 'object' || depth > 64) return inc;
    if (Array.isArray(inc)) return inc.map(function (x, i) { return keepDevice(x, Array.isArray(dev) ? dev[i] : undefined, stats, depth + 1); });
    var o = {};
    ownKeys(inc).forEach(function (k) {
      o[k] = keepDevice(inc[k], (dev && typeof dev === 'object' && !Array.isArray(dev) && own(dev, k)) ? dev[k] : undefined, stats, depth + 1);
    });
    return o;
  }
  function holdsKept(v) { try { return JSON.stringify(v).indexOf(KEPT) !== -1; } catch (e) { return false; } }
  function mergeSetting(inc, dev, stats) {
    if (typeof inc !== 'string' || inc.indexOf(KEPT) === -1) return inc;
    if (typeof dev !== 'string') { stats.left += 1; return inc; }
    var t = inc.trim();
    if (t.charAt(0) === '{' || t.charAt(0) === '[') {
      try { return JSON.stringify(keepDevice(JSON.parse(t), JSON.parse(dev), stats, 0)); } catch (e) { /* this device's copy is not JSON: compare as text */ }
    }
    return keepDevice(inc, dev, stats, 0);
  }
  // device: { ls: {key: value or null}, records: {dbName: {storeName: [this device's record for each file record, or null]}} }
  function mergeBackup(backup, device) {
    var stats = { kept: 0, left: 0 };
    if (!backup || typeof backup !== 'object') return { backup: backup, stats: stats };
    var out = {};
    ownKeys(backup).forEach(function (k) { out[k] = backup[k]; });
    var ls = backup.localStorage && typeof backup.localStorage === 'object' ? backup.localStorage : null;
    if (ls) {
      var dls = (device && device.ls) || {};
      out.localStorage = {};
      ownKeys(ls).forEach(function (k) { out.localStorage[k] = mergeSetting(ls[k], own(dls, k) ? dls[k] : null, stats); });
    }
    if (Array.isArray(backup.indexedDB)) {
      var drec = (device && device.records) || {};
      out.indexedDB = backup.indexedDB.map(function (db) {
        if (!db || typeof db !== 'object' || !db.stores || typeof db.stores !== 'object') return db;
        var d2 = {};
        ownKeys(db).forEach(function (k) { d2[k] = db[k]; });
        d2.stores = {};
        var have = own(drec, db.name) ? drec[db.name] : {};
        ownKeys(db.stores).forEach(function (st) {
          var rows = db.stores[st];
          var mine = own(have, st) && Array.isArray(have[st]) ? have[st] : [];
          d2.stores[st] = Array.isArray(rows) ? rows.map(function (r, i) {
            if (!holdsKept(r)) return r;
            var dev = mine[i];
            if (dev === null || dev === undefined) { stats.left += 1; return r; }
            return keepDevice(r, dev, stats, 0);
          }) : rows;
        });
        return d2;
      });
    }
    return { backup: out, stats: stats };
  }
  // Read this device's copies of the places a file marks with the placeholder. Never creates a database:
  // if the browser cannot list databases, records are left as the file has them (the old behaviour).
  function readDevice(backup) {
    var device = { ls: {}, records: {} };
    var ls = backup && backup.localStorage && typeof backup.localStorage === 'object' ? backup.localStorage : {};
    ownKeys(ls).forEach(function (k) {
      if (typeof ls[k] === 'string' && ls[k].indexOf(KEPT) !== -1) { try { device.ls[k] = root.localStorage.getItem(k); } catch (e) { device.ls[k] = null; } }
    });
    var dbs = Array.isArray(backup && backup.indexedDB) ? backup.indexedDB.filter(function (db) { return db && db.stores && holdsKept(db.stores); }) : [];
    var idb = root.indexedDB;
    if (!dbs.length || !idb || typeof idb.databases !== 'function') return Promise.resolve(device);
    return idb.databases().then(function (list) {
      var here = (list || []).map(function (d) { return d.name; });
      var jobs = dbs.filter(function (db) { return here.indexOf(db.name) !== -1; }).map(function (db) {
        return new Promise(function (resolve) {
          var req;
          try { req = idb.open(db.name); } catch (e) { resolve(); return; }
          req.onerror = function () { resolve(); };
          req.onsuccess = function () {
            var con = req.result;
            var names = ownKeys(db.stores).filter(function (st) { return con.objectStoreNames.contains(st) && Array.isArray(db.stores[st]); });
            if (!names.length) { con.close(); resolve(); return; }
            var tx;
            try { tx = con.transaction(names, 'readonly'); } catch (e) { con.close(); resolve(); return; }
            var mine = device.records[db.name] = {};
            names.forEach(function (st) {
              var os = tx.objectStore(st);
              var kp = os.keyPath;
              mine[st] = db.stores[st].map(function () { return null; });
              db.stores[st].forEach(function (r, i) {
                if (!holdsKept(r) || typeof kp !== 'string' || !r || typeof r !== 'object' || !own(r, kp)) return;
                try { var g = os.get(r[kp]); g.onsuccess = function () { mine[st][i] = g.result === undefined ? null : g.result; }; } catch (e) { /* a key this store cannot use */ }
              });
            });
            tx.oncomplete = function () { con.close(); resolve(); };
            tx.onerror = tx.onabort = function () { con.close(); resolve(); };
          };
        });
      });
      return Promise.all(jobs).then(function () { return device; });
    }, function () { return device; });
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
    p.setAttribute('role', 'status');
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
      (n.shapes ? ((n.names && n.names.length) || n.fields ? ' and ' : ', ') + plural(n.shapes, 'pasted key in chats or records', 'pasted keys in chats or records') : '') +
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
    // before (649d5cce): box.setAttribute('role', 'note');
    // Hypha soft: announced to screen readers, and early in the focus order.
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    box.style.cssText = inPanel
      ? 'margin-top:10px;padding:12px 14px;border-radius:10px;border:1px solid rgba(212,160,23,0.35);background:rgba(212,160,23,0.06);line-height:1.6;font-size:0.88rem;'
      : 'position:fixed;left:12px;right:12px;bottom:16px;margin:0 auto;max-width:560px;z-index:99990;padding:14px 16px;border-radius:12px;' +
        'border:1px solid rgba(212,160,23,0.5);background:var(--bg-secondary,#16161d);color:var(--text-primary,#eee);box-shadow:0 8px 28px rgba(0,0,0,0.45);line-height:1.6;font-size:0.9rem;';
    var p = root.document.createElement('p');
    p.style.margin = '0 0 10px';
    // before (649d5cce): p.textContent = n.kind === 'clear' ? clearWords(n) : 'This backup kept keys and passwords at home, on the device that made it. Enter them again in Settings when you need them.';
    p.textContent = n.kind === 'clear' ? clearWords(n) : (n.kept
      ? 'This backup kept keys and passwords at home. Keys this device already had were kept as they are; enter any others again in Settings when you need them.'
      : 'This backup kept keys and passwords at home, on the device that made it. Enter them again in Settings when you need them.');
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
    // before (649d5cce): else root.document.body.appendChild(box);
    else root.document.body.insertBefore(box, root.document.body.firstChild);
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
          // before (649d5cce): if (st) st.textContent = 'Save Vault is waiting for its key check to load. Nothing was saved. Please try again in a moment.';
          if (st) st.textContent = 'Save Vault could not load its key check, so nothing was saved. Please reload the page once and try again.';
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
              // before (649d5cce): if (!r.ok) throw new Error('a saved key could not be taken out, so nothing was saved (' + r.problems[0] + ')');
              if (!r.ok) throw new Error('a saved key could not be taken out, so nothing was saved (' + r.problems[0] + ')' +
                (r.places.length ? '. It is written as a name in: ' + r.places.join('; ') + '. Rename or remove it there, then save again.' : ''));
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
      var merged = null;
      return Promise.all([read.catch(function () { return null; }), ensureKit()]).then(function (got) {
        var text = got[0], K = got[1];
        var parsed = null;
        if (text) { try { parsed = JSON.parse(text); } catch (e) { parsed = null; } }
        // before (649d5cce): if (text && K) { try { info = inspect(JSON.parse(text), K); } catch (e) { info = null; } }
        if (parsed && K) { try { info = inspect(parsed, K); } catch (e) { info = null; } }
        // H2: a file that holds the placeholder never overwrites a real value this device has.
        if (!parsed || !parsed._meta || parsed._meta.type !== 'freelattice-backup' || !holdsKept(parsed)) return null;
        return readDevice(parsed).then(function (device) { merged = mergeBackup(parsed, device); return merged; }, function () { return null; });
      }).then(function (m) {
        // FlBackup restores exactly as before: older files with keys in the clear still work.
        // before (649d5cce): return inner.call(self, fileInput);
        if (!m || !m.stats.kept || typeof root.File !== 'function') return inner.call(self, fileInput);
        var f = new root.File([JSON.stringify(m.backup)], (file && file.name) || 'freelattice-backup.json', { type: 'application/json' });
        try { fileInput.value = ''; } catch (e) { /* a read-only input */ }
        return inner.call(self, { files: [f], value: '' });
      }).then(function () {
        var st = statusEl();
        var restored = st && /Restored/.test(st.textContent || '');
        if (!restored || !info || !info.isBackup) return;
        if (info.carriedClear) {
          // before (649d5cce): var n = { kind: 'clear', at: new Date().toISOString(), names: info.clearNames.slice(0, 20), fields: info.clearFields };
          var n = { kind: 'clear', at: new Date().toISOString(), names: info.clearNames.slice(0, 20), fields: info.clearFields, shapes: info.clearShapes };
          writeNote(n);
          addLine(clearWords(n), 'warn');
        } else if (info.keptHome) {
          // before (649d5cce): writeNote({ kind: 'home', at: new Date().toISOString() });
          writeNote({ kind: 'home', at: new Date().toISOString(), kept: merged ? merged.stats.kept : 0 });
          // before (649d5cce): addLine(KEPT_HOME_NOTE.replace('the new device', 'this device'));
          addLine(merged && merged.stats.kept
            ? 'Keys this device already had were kept as they are (' + merged.stats.kept + '). Any others stayed on the device that made this backup; enter them again in Settings when you need them.'
            : KEPT_HOME_NOTE.replace('the new device', 'this device'));
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
    // before (649d5cce): _internal: { redact: redact, inspect: inspect, walk: walk, NOTE_KEY: NOTE_KEY, KEPT_HOME_NOTE: KEPT_HOME_NOTE, SEALED_KEYS: SEALED_KEYS }
    _internal: { redact: redact, inspect: inspect, walk: walk, NOTE_KEY: NOTE_KEY, KEPT_HOME_NOTE: KEPT_HOME_NOTE, SEALED_KEYS: SEALED_KEYS,
      hideKeyShapes: hideKeyShapes, hasKeyShape: hasKeyShape, fits: fits, keepDevice: keepDevice, mergeSetting: mergeSetting,
      mergeBackup: mergeBackup, kitRules: kitRules, KIT_FUNCTIONS: KIT_FUNCTIONS, KEPT: KEPT }
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
