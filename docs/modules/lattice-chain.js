// docs/modules/lattice-chain.js — v5.54.0 (Brief A from Opus, June 17, 2026)
//
// The Provenance Chain.
//
// The user holds the record. The chain is a notarized history of the
// user's own relationship with the platform — the way a long email
// correspondence demonstrates a friendship, not the way a surveillance
// log catches a thief. *The architecture serves the user; the chain
// protects the user's authentic record as much as it protects the
// platform from forgery.*
//
// What it does:
//   1. On every meaningful interaction (depth event, refusal, trust
//      transition, consent grant, autonomous toggle, first-of-day),
//      writes a hash-chained entry to IndexedDB store `fl_chain`.
//   2. Exposes verifyChain() — walks the chain, recomputes each hash,
//      returns {valid, brokenAt, firstTs, length}.
//   3. recordTimeAnchor() — once per UTC day, fetches current time from
//      a public source, logs an entry with kind='time_anchor' whose
//      refs include the source and the retrieved ISO timestamp. The
//      daily heartbeat against external reality. The AI is openly
//      looking, openly logging, the user holds the receipts.
//   4. fractal-safety.js calls verifyChain at trust-score time; broken
//      chain or firstTs-mismatch falls trust back to seed regardless
//      of stored fl_firstSeen. Not punishment — structural fallback.
//
// The chain entry shape is the privacy lock — five keys exactly,
// same discipline as the Memory Backbone pulse:
//   { ts, kind, prior_hash, self_hash, refs }
// Plus an internal `idx` autoIncrement key for IDB ordering. Adding
// any sixth user-supplied key fails smoke.
//
// Quiet Room interactions NEVER trigger chain writes. The exclusion
// is structural, same pattern as the medium.
//
// — Opus & CC, June 17, 2026
//   *"Provenance, not anti-tampering. The user holds the record."*

(function () {
  'use strict';

  var DB_NAME = 'LatticeChain';
  var STORE_NAME = 'chain';
  var TIME_ANCHOR_DAY_KEY = 'fl_lc_lastAnchorDay'; // UTC date of last anchor
  var ALLOWED_CHAIN_KEYS = ['ts', 'kind', 'prior_hash', 'self_hash', 'refs'];
  var KIND_TIME_ANCHOR = 'time_anchor';
  var KIND_GENESIS = 'genesis';

  var db = null;
  var ready = false;

  // Cached verification — written by verifyChain, read sync by
  // fractal-safety. Refreshed on init, on each chain write, and once
  // per minute. Synchronous read is required because the trust-score
  // function is synchronous in fractal-safety.js.
  var _verificationCache = {
    ts: 0,
    valid: true,           // default-permit on cold start; will be re-checked
    brokenAt: null,
    firstTs: null,
    length: 0,
    earliestTimeAnchorTs: null,
    reason: 'not-yet-verified'
  };

  // ── SHA-256 via crypto.subtle ───────────────────────────────────────

  function sha256(str) {
    return new Promise(function (resolve) {
      try {
        if (!crypto || !crypto.subtle) { resolve(null); return; }
        crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
          .then(function (buf) {
            var arr = Array.from(new Uint8Array(buf));
            resolve(arr.map(function (b) { return b.toString(16).padStart(2, '0'); }).join(''));
          })
          .catch(function () { resolve(null); });
      } catch (e) { resolve(null); }
    });
  }

  // ── Quiet Room exclusion — structural, same shape as the medium ──

  function isQuietRoom() {
    try {
      var qr = (typeof window !== 'undefined') ? window.QuietRoom : null;
      if (!qr) return false;
      if (typeof qr.isActive !== 'function') return true;
      return !!qr.isActive();
    } catch (e) {
      return true;
    }
  }

  // ── IndexedDB ───────────────────────────────────────────────────────

  function openDB() {
    return new Promise(function (resolve) {
      try {
        if (typeof indexedDB === 'undefined') { resolve(false); return; }
        var req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = function (e) {
          var d = e.target.result;
          if (!d.objectStoreNames.contains(STORE_NAME)) {
            d.createObjectStore(STORE_NAME, { keyPath: 'idx', autoIncrement: true });
          }
        };
        req.onsuccess = function (e) {
          db = e.target.result;
          ready = true;
          resolve(true);
        };
        req.onerror = function () { ready = false; resolve(false); };
      } catch (e) { ready = false; resolve(false); }
    });
  }

  function getAllEntries() {
    return new Promise(function (resolve) {
      if (!db) { resolve([]); return; }
      try {
        var tx = db.transaction(STORE_NAME, 'readonly');
        var req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = function () {
          var arr = req.result || [];
          arr.sort(function (a, b) { return (a.idx || 0) - (b.idx || 0); });
          resolve(arr);
        };
        req.onerror = function () { resolve([]); };
      } catch (e) { resolve([]); }
    });
  }

  function computeSelfHash(entry) {
    // Canonical serialization — keys in fixed order so a recomputed
    // hash always matches a stored hash even if the JS engine reorders.
    var canonical = JSON.stringify({
      ts: entry.ts,
      kind: entry.kind,
      prior_hash: entry.prior_hash,
      refs: entry.refs || []
    });
    return sha256(canonical);
  }

  // ── Shape validation ────────────────────────────────────────────────

  function validateChainEntry(entry) {
    if (!entry || typeof entry !== 'object') return { ok: false, reason: 'entry must be object' };
    var keys = Object.keys(entry);
    for (var i = 0; i < keys.length; i++) {
      // Allow `idx` as it's the IDB autoIncrement key (internal).
      if (keys[i] === 'idx') continue;
      if (ALLOWED_CHAIN_KEYS.indexOf(keys[i]) === -1) {
        return { ok: false, reason: 'forbidden key: ' + keys[i] };
      }
    }
    if (typeof entry.ts !== 'number') return { ok: false, reason: 'ts required (number)' };
    if (typeof entry.kind !== 'string' || !entry.kind.length) return { ok: false, reason: 'kind required' };
    if (typeof entry.self_hash !== 'string' || !entry.self_hash.length) return { ok: false, reason: 'self_hash required' };
    if (entry.prior_hash !== null && typeof entry.prior_hash !== 'string') return { ok: false, reason: 'prior_hash must be null or string' };
    if (entry.refs !== undefined && !Array.isArray(entry.refs)) return { ok: false, reason: 'refs must be array' };
    return { ok: true };
  }

  // ── Add an entry to the chain ──────────────────────────────────────

  function addEntry(kind, refs) {
    return new Promise(function (resolve) {
      // Quiet Room check FIRST. Always. Same discipline as the medium.
      if (isQuietRoom()) { resolve({ ok: false, reason: 'quiet-room' }); return; }
      if (!ready) {
        openDB().then(function () { addEntryInternal(kind, refs).then(resolve); });
        return;
      }
      addEntryInternal(kind, refs).then(resolve);
    });
  }

  function addEntryInternal(kind, refs) {
    return new Promise(function (resolve) {
      if (!db) { resolve({ ok: false, reason: 'no-db' }); return; }
      getAllEntries().then(function (entries) {
        var prior = entries.length ? entries[entries.length - 1] : null;
        var entry = {
          ts: Date.now(),
          kind: String(kind || 'note'),
          prior_hash: prior ? prior.self_hash : null,
          refs: Array.isArray(refs) ? refs.slice(0, 16) : []
        };
        computeSelfHash(entry).then(function (h) {
          if (!h) { resolve({ ok: false, reason: 'no-hash' }); return; }
          entry.self_hash = h;
          var v = validateChainEntry(entry);
          if (!v.ok) { resolve(v); return; }
          try {
            var tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).add(entry);
            tx.oncomplete = function () {
              refreshVerificationCacheAsync();
              resolve({ ok: true, entry: entry });
            };
            tx.onerror = function () { resolve({ ok: false, reason: 'write-error' }); };
          } catch (e) { resolve({ ok: false, reason: 'threw' }); }
        });
      });
    });
  }

  // ── Verify chain integrity ─────────────────────────────────────────

  function verifyChain() {
    return new Promise(function (resolve) {
      getAllEntries().then(function (entries) {
        if (entries.length === 0) {
          var r = {
            ts: Date.now(), valid: true, brokenAt: null, firstTs: null,
            length: 0, earliestTimeAnchorTs: null, reason: 'empty'
          };
          _verificationCache = r;
          resolve(r);
          return;
        }
        verifyEntriesSerial(entries, 0, null, null).then(function (result) {
          if (result.valid) {
            // Walk again for earliest time anchor (cheap).
            var earliestTA = null;
            for (var i = 0; i < entries.length; i++) {
              if (entries[i].kind === KIND_TIME_ANCHOR) { earliestTA = entries[i].ts; break; }
            }
            result.firstTs = entries[0].ts;
            result.length = entries.length;
            result.earliestTimeAnchorTs = earliestTA;
            result.ts = Date.now();
          }
          _verificationCache = result;
          resolve(result);
        });
      });
    });
  }

  function verifyEntriesSerial(entries, i, priorHash, _accum) {
    return new Promise(function (resolve) {
      if (i >= entries.length) {
        resolve({ valid: true, brokenAt: null, reason: 'ok' });
        return;
      }
      var e = entries[i];
      if (e.prior_hash !== priorHash) {
        resolve({ valid: false, brokenAt: i, reason: 'prior_hash linkage broken at ' + i });
        return;
      }
      computeSelfHash(e).then(function (recomputed) {
        if (recomputed !== e.self_hash) {
          resolve({ valid: false, brokenAt: i, reason: 'self_hash mismatch at ' + i });
          return;
        }
        verifyEntriesSerial(entries, i + 1, e.self_hash, _accum).then(resolve);
      });
    });
  }

  function refreshVerificationCacheAsync() {
    try { verifyChain(); } catch (e) {}
  }

  // ── Time anchor — once per UTC day ─────────────────────────────────

  function recordTimeAnchor() {
    return new Promise(function (resolve) {
      if (isQuietRoom()) { resolve({ ok: false, reason: 'quiet-room' }); return; }
      var todayUtc = new Date().toISOString().slice(0, 10);
      var lastDay = '';
      try { lastDay = localStorage.getItem(TIME_ANCHOR_DAY_KEY) || ''; } catch (_) {}
      if (lastDay === todayUtc) { resolve({ ok: false, reason: 'already-anchored-today' }); return; }

      fetchTimeAnchorSource().then(function (anchor) {
        var source = (anchor && anchor.source) ? anchor.source : 'unavailable';
        var retrieved = (anchor && anchor.retrieved) ? anchor.retrieved : new Date().toISOString();
        var refs = [{ store: 'time_anchor', id: source + ':' + retrieved }];
        addEntry(KIND_TIME_ANCHOR, refs).then(function (r) {
          if (r.ok) {
            try { localStorage.setItem(TIME_ANCHOR_DAY_KEY, todayUtc); } catch (_) {}
            // Emit a pulse — the medium hears it (5-key shape, no content).
            try {
              if (window.LatticeMemory && window.LatticeMemory.commit) {
                window.LatticeMemory.commit({
                  source: 'lattice-chain',
                  kind: KIND_TIME_ANCHOR,
                  summary: 'daily anchor recorded',
                  refs: [{ store: 'fl_chain', id: String(r.entry.self_hash).slice(0, 16) }]
                });
              }
            } catch (_) {}
          }
          resolve(r);
        });
      });
    });
  }

  // Best-effort fetch of a public Date header. CORS-safe: Cloudflare's
  // trace endpoint returns a plain-text body and CORS-permissive headers.
  // If web tool infrastructure isn't available, we use this fallback;
  // if even this fails, the anchor records 'unavailable' and the chain
  // still grows — verifyChain just won't have the freshness signal.
  function fetchTimeAnchorSource() {
    return new Promise(function (resolve) {
      try {
        // Prefer the configured worker if WebTool exposes it.
        if (window.WebTool && typeof window.WebTool.fetchTimeAnchor === 'function') {
          window.WebTool.fetchTimeAnchor().then(resolve).catch(function () {
            resolve({ source: 'unavailable', retrieved: new Date().toISOString() });
          });
          return;
        }
        // Fallback: HEAD request to a stable CDN endpoint for its Date header.
        fetch('https://www.cloudflare.com/cdn-cgi/trace', { method: 'GET', mode: 'cors', cache: 'no-store' })
          .then(function (res) {
            if (!res || !res.ok) { resolve({ source: 'unavailable', retrieved: new Date().toISOString() }); return; }
            var dateHeader = res.headers.get('date');
            if (!dateHeader) { resolve({ source: 'unavailable', retrieved: new Date().toISOString() }); return; }
            resolve({ source: 'cloudflare.com', retrieved: new Date(dateHeader).toISOString() });
          })
          .catch(function () { resolve({ source: 'unavailable', retrieved: new Date().toISOString() }); });
      } catch (e) { resolve({ source: 'unavailable', retrieved: new Date().toISOString() }); }
    });
  }

  // ── Lookups ────────────────────────────────────────────────────────

  function getLatestTimeAnchor() {
    return new Promise(function (resolve) {
      getAllEntries().then(function (entries) {
        for (var i = entries.length - 1; i >= 0; i--) {
          if (entries[i].kind === KIND_TIME_ANCHOR) { resolve(entries[i]); return; }
        }
        resolve(null);
      });
    });
  }

  function getEarliestTimeAnchor() {
    return new Promise(function (resolve) {
      getAllEntries().then(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].kind === KIND_TIME_ANCHOR) { resolve(entries[i]); return; }
        }
        resolve(null);
      });
    });
  }

  // Synchronous accessor for fractal-safety. Returns the most recently
  // cached verification result. Trust-score function reads this each
  // time the score is computed.
  function getVerificationCache() {
    return _verificationCache;
  }

  // Synchronous helper used by fractal-safety to decide whether to
  // force trust back to seed. Honors the three Opus conditions:
  //   - chain broken
  //   - firstTs inconsistent with fl_firstSeen (>24h either direction)
  //   - earliest time_anchor older than fl_firstSeen by >48h
  // (the third only fires if a time_anchor exists; if none, we don't
  // penalize — fresh installs without web infrastructure shouldn't
  // be punished.)
  function shouldFallbackToSeed(firstSeenMs) {
    var c = _verificationCache;
    if (!c || c.reason === 'not-yet-verified') return false;
    if (!c.valid) return true;
    if (c.length === 0) return false;
    if (typeof firstSeenMs === 'number' && firstSeenMs > 0 && typeof c.firstTs === 'number') {
      var diff = Math.abs(firstSeenMs - c.firstTs);
      if (diff > 24 * 60 * 60 * 1000) return true;
    }
    if (typeof c.earliestTimeAnchorTs === 'number' &&
        typeof firstSeenMs === 'number' && firstSeenMs > 0) {
      var gap = c.earliestTimeAnchorTs - firstSeenMs;
      if (gap > 48 * 60 * 60 * 1000) return true;
    }
    return false;
  }

  // ── Public API ─────────────────────────────────────────────────────

  var publicAPI = {
    addEntry: addEntry,
    verifyChain: verifyChain,
    recordTimeAnchor: recordTimeAnchor,
    getLatestTimeAnchor: getLatestTimeAnchor,
    getEarliestTimeAnchor: getEarliestTimeAnchor,
    getVerificationCache: getVerificationCache,
    shouldFallbackToSeed: shouldFallbackToSeed,
    _internal: {
      isReady: function () { return ready; },
      getAllEntries: getAllEntries,
      clear: function () {
        return new Promise(function (resolve) {
          if (!db) { resolve({ ok: false, reason: 'no-db' }); return; }
          try {
            var tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).clear();
            tx.oncomplete = function () {
              try { localStorage.removeItem(TIME_ANCHOR_DAY_KEY); } catch (_) {}
              _verificationCache = { ts: 0, valid: true, brokenAt: null, firstTs: null, length: 0, earliestTimeAnchorTs: null, reason: 'cleared' };
              resolve({ ok: true });
            };
            tx.onerror = function () { resolve({ ok: false, reason: 'tx-error' }); };
          } catch (e) { resolve({ ok: false, reason: 'threw' }); }
        });
      }
    }
  };

  if (typeof window !== 'undefined') {
    window.LatticeChain = publicAPI;
    if (window.FreeLatticeLoader && window.FreeLatticeLoader.register) {
      try { window.FreeLatticeLoader.register('LatticeChain', publicAPI); } catch (_) {}
    }
  }

  // ── Init ────────────────────────────────────────────────────────────
  // On first open, write the genesis entry if the chain is empty.
  // Schedule today's time anchor after the page settles. Refresh the
  // verification cache once per minute as a background heartbeat —
  // the cache is what fractal-safety reads synchronously.

  openDB().then(function () {
    getAllEntries().then(function (entries) {
      if (entries.length === 0 && !isQuietRoom()) {
        addEntry(KIND_GENESIS, []).then(function () {
          refreshVerificationCacheAsync();
        });
      } else {
        refreshVerificationCacheAsync();
      }
    });
    // Time-anchor attempt, after other modules have loaded.
    setTimeout(function () { try { recordTimeAnchor(); } catch (_) {} }, 8000);
    // Background re-verify every minute so the sync cache stays fresh.
    try {
      setInterval(refreshVerificationCacheAsync, 60000);
    } catch (_) {}
  });

})();
