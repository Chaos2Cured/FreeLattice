// memory-compound.js (MIT)
// v-memory-compound-v0.1
// Shared memory key, phi spread, save-only-new, and the wake check.
// No DOM at load. A later Tree twin can copy this file as-is.
(function (root) {
  'use strict';

  var MARK = 'v-memory-compound-v0.1';
  var PHI = (1 + Math.sqrt(5)) / 2;
  var FIB32 = 2654435769; // floor(2^32 / phi), Knuth's Fibonacci hashing constant
  var ALG_KEY = 'fl_memory_key_alg_v0';
  var INDEX_KEY = 'fl_memory_index_v0';

  function roomShut() {
    var c = root.FLSnowflakeCore;
    try { return !!(c && typeof c.roomShut === 'function' ? c.roomShut() : false); } catch (e) { return true; }
  }

  // Spread keys evenly over 2^bits slots. Neighbouring keys land far apart.
  function fibBucket(key8, bits) {
    bits = bits || 8;
    var n = parseInt(String(key8).slice(0, 8), 16) >>> 0;
    var h = Math.imul(n, FIB32) >>> 0;
    return h >>> (32 - bits);
  }

  // Golden-angle position on a ring, for drawing and for a later replay order.
  // The walk itself stays in stored order so a checkpoint index still names the same node.
  function goldenSlot(i, size) { return Math.floor(((i * (PHI - 1)) % 1) * size); }

  // Next replay gap for a flake after its k-th replay: 1 day * phi^k, capped at 89 days.
  function phiGapMs(k) { return Math.min(86400000 * Math.pow(PHI, k || 0), 89 * 86400000); }

  function dueForReplay(flake, now) {
    var r = (flake && flake.replay) || { k: 0, t: 0 };
    return !r.t || (now - Date.parse(r.t)) >= phiGapMs(r.k);
  }

  // Normalize: NFKC, lower case, collapse whitespace, strip zero-width, trim, clip 2000.
  function normalize(text) {
    var s = String(text == null ? '' : text);
    try { s = s.normalize('NFKC'); } catch (e) {}
    return s.replace(/[\u200B-\u200D\uFEFF]/g, '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 2000);
  }

  function storedAlg() {
    try {
      if (!root.localStorage) return '';
      return String(root.localStorage.getItem(ALG_KEY) || '');
    } catch (e) { return ''; }
  }

  function pinAlg(alg) {
    if (roomShut()) return;
    try {
      if (!root.localStorage) return;
      if (root.localStorage.getItem(ALG_KEY)) return;
      root.localStorage.setItem(ALG_KEY, alg);
    } catch (e) {}
  }

  // Key = first 8 hex of the phi-salted SHA-256 when phiHashData exists (app.html),
  // else Snowflake's sha8. Both are SHA-256 based; record which one in key.alg.
  // One alg per device, pinned the first time, so keys never mix.
  function memoryKey(text) {
    var n = normalize(text);
    var saved = storedAlg();
    var canPhi = typeof root.phiHashData === 'function';
    if (saved === 'sha8' || (saved === 'phi' && !canPhi) || (!saved && !canPhi)) {
      var c = root.FLSnowflakeCore;
      return c.sha8(n).then(function (h) {
        if (!saved && !canPhi) pinAlg('sha8');
        var alg = (saved === 'phi' && !canPhi) ? 'sha8' : (saved || 'sha8');
        return { key: h, alg: alg, norm: n };
      });
    }
    return root.phiHashData(n).then(function (h) {
      if (!saved) pinAlg('phi');
      return { key: String(h).slice(0, 8), alg: 'phi', norm: n };
    });
  }

  function loadIndex() {
    try {
      var ix = JSON.parse(root.localStorage.getItem(INDEX_KEY));
      if (!ix || typeof ix !== 'object' || !ix.b || typeof ix.b !== 'object') return { b: {} };
      return ix;
    } catch (e) { return { b: {} }; }
  }

  function saveIndex(ix) {
    if (roomShut()) return;
    try { root.localStorage.setItem(INDEX_KEY, JSON.stringify(ix)); } catch (e) { console.warn(MARK, 'index save failed', e); }
  }

  function tokens(n) { return String(n || '').split(' ').filter(Boolean); }

  function jaccard(a, b) {
    var A = {};
    var i;
    var inter = 0;
    var uni;
    a.forEach(function (t) { A[t] = 1; });
    b.forEach(function (t) { if (A[t]) inter++; });
    uni = a.length + b.length - inter;
    return uni ? inter / uni : 1;
  }

  function nearIn(list, store, norm) {
    var i;
    var words = tokens(norm);
    for (i = 0; i < list.length; i++) {
      if (list[i].store !== store) continue;
      if (list[i].norm && jaccard(tokens(list[i].norm), words) >= 0.9) return list[i];
    }
    return null;
  }

  // Exact repeat = same key. Near repeat = token Jaccard >= 0.9.
  function isNew(text, store) {
    return memoryKey(text).then(function (k) {
      var ix = loadIndex();
      var bucket = String(fibBucket(k.key, 8));
      var list = ix.b[bucket] || [];
      var i;
      for (i = 0; i < list.length; i++) {
        if (list[i].store !== store) continue;
        if (list[i].key === k.key) return { fresh: false, why: 'exact', key: k.key };
        if (list[i].norm && jaccard(tokens(list[i].norm), tokens(k.norm)) >= 0.9) return { fresh: false, why: 'near', key: list[i].key };
      }
      // Phi spread puts a one-word change in another bucket. Step 5 still skips that note.
      var names = Object.keys(ix.b);
      for (i = 0; i < names.length; i++) {
        if (names[i] === bucket) continue;
        var hit = nearIn(ix.b[names[i]] || [], store, k.norm);
        if (hit) return { fresh: false, why: 'near', key: hit.key };
      }
      return { fresh: true, key: k.key, k: k };
    });
  }

  function remember(k, store) {
    if (roomShut() || !k || !k.key) return;
    var ix = loadIndex();
    var bucket = String(fibBucket(k.key, 8));
    ix.b[bucket] = (ix.b[bucket] || []).concat([{ key: k.key, store: store, norm: k.norm.slice(0, 300), t: new Date().toISOString() }]).slice(-34);
    saveIndex(ix);
  }

  function notify(text) {
    if (roomShut()) return;
    var d = root.document;
    if (!d || typeof d.createElement !== 'function' || typeof d.getElementById !== 'function') return;
    var line = d.getElementById('flMemoryNotice');
    if (!line) {
      line = d.createElement('p');
      line.id = 'flMemoryNotice';
      line.setAttribute('role', 'status');
      line.setAttribute('aria-live', 'polite');
      var anchor = d.getElementById('statusText') || d.getElementById('flSnowflakeStatus');
      if (anchor && anchor.parentNode) {
        if (anchor.nextSibling) anchor.parentNode.insertBefore(line, anchor.nextSibling);
        else anchor.parentNode.appendChild(line);
      } else if (d.body) d.body.appendChild(line);
    }
    line.textContent = String(text || '');
  }

  function coreText(content) {
    if (content != null && String(content).trim()) return String(content);
    var d = root.document;
    if (!d || typeof d.getElementById !== 'function') return content == null ? '' : String(content);
    var box = d.getElementById('coreContentInput');
    if (box && box.value && String(box.value).trim()) return String(box.value);
    var modal = d.getElementById('coreModalContent');
    if (modal && modal.value && String(modal.value).trim()) return String(modal.value);
    return content == null ? '' : String(content);
  }

  function wrapOnce(obj, name, store, textOf) {
    if (!obj || typeof obj[name] !== 'function' || obj[name].__flMem) return false;
    var orig = obj[name];
    var wrapped = function () {
      var args = arguments;
      var self = this;
      var text = textOf.apply(null, args);
      var force = store === 'core' && args[5] && args[5].force === true;
      if (roomShut() || (!text && !force)) return orig.apply(self, args);
      if (force) {
        return Promise.resolve(orig.apply(self, args)).then(function (out) {
          if (!text || roomShut()) return out;
          return memoryKey(text).then(function (k) {
            remember(k, store);
            return out;
          });
        });
      }
      return isNew(text, store).then(function (r) {
        if (!r.fresh) {
          console.info(MARK, store, 'skipped', r.why, r.key);
          notify('Already in your memory (' + r.why + ' match).');
          return { skipped: true, why: r.why, key: r.key };
        }
        return Promise.resolve(orig.apply(self, args)).then(function (out) {
          remember(r.k, store);
          return out;
        });
      });
    };
    wrapped.__flMem = true;
    obj[name] = wrapped;
    return true;
  }

  function lookup(globalName) {
    try {
      if (globalName === 'CoreModule' && typeof CoreModule !== 'undefined') return CoreModule;
    } catch (e) {}
    try {
      if (globalName === 'MemoryBridge' && typeof MemoryBridge !== 'undefined') return MemoryBridge;
    } catch (e2) {}
    return root[globalName];
  }

  // On wake: read the last Snowflake ledger row back, recompute psi, and check where-I-stopped.
  function wakeCheck() {
    var c = root.FLSnowflakeCore;
    if (roomShut() || !c || typeof c.loadLedger !== 'function') return Promise.resolve({ ok: null, why: 'no core' });
    var book = c.loadLedger();
    var rows = (book && book.rows) || [];
    if (!rows.length) return Promise.resolve({ ok: true, why: 'empty' });
    var last = rows[rows.length - 1];
    return c.recomputePsi(last).then(function (psi) {
      var stop = null;
      try { stop = JSON.parse(root.localStorage.getItem('fl_snowflake_replay_v0')); } catch (e) {}
      var ok = psi === last.psi && !!last.lambda;
      return { ok: ok, lambda: last.lambda, psi: last.psi, got: psi, stoppedAt: stop };
    }).catch(function (e) { return { ok: false, why: String(e && e.message || e) }; });
  }

  var woke = false;

  function attach() {
    var coreMod = lookup('CoreModule');
    var bridge = lookup('MemoryBridge');
    var wrappedCore = wrapOnce(coreMod, 'plantContribution', 'core', coreText);
    var wrappedBridge = wrapOnce(bridge, 'addInsight', 'bridge', function (text) { return text; });
    if (woke || roomShut()) return { core: wrappedCore, bridge: wrappedBridge, woke: woke };
    woke = true;
    var pending = wakeCheck().then(function (report) {
      var ui = root.FLSnowflake;
      if (ui && typeof ui.showMemoryCanary === 'function') ui.showMemoryCanary(report);
      return report;
    });
    return { core: wrappedCore, bridge: wrappedBridge, woke: true, wake: pending };
  }

  function recall(text) {
    return memoryKey(text).then(function (k) {
      var ix = loadIndex();
      var all = [];
      var exact = [];
      var similar = [];
      Object.keys(ix.b).forEach(function (b) { all = all.concat(ix.b[b]); });
      all.forEach(function (r) {
        if (!r) return;
        if (r.key === k.key) exact.push(r);
        else if (r.norm && jaccard(tokens(r.norm), tokens(k.norm)) >= 0.5) similar.push(r);
      });
      return { key: k.key, exact: exact, similar: similar.slice(0, 5), reachedContext: false };
    });
  }

  function markReached(report, injectedText) {
    report.reachedContext = !!injectedText && report.exact.concat(report.similar).some(function (r) {
      return r && r.norm && String(injectedText).toLowerCase().indexOf(String(r.norm).slice(0, 40)) !== -1;
    });
    return report;
  }

  var api = {
    MARK: MARK,
    PHI: PHI,
    roomShut: roomShut,
    fibBucket: fibBucket,
    goldenSlot: goldenSlot,
    phiGapMs: phiGapMs,
    dueForReplay: dueForReplay,
    normalize: normalize,
    memoryKey: memoryKey,
    isNew: isNew,
    remember: remember,
    recall: recall,
    markReached: markReached,
    wakeCheck: wakeCheck,
    attach: attach,
    notify: notify
  };
  root.FLMemory = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
