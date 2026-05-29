/* FreeLattice — ResponseCache
 * ---------------------------------------------------------------------------
 * Offline fallback for the inference failure cascade. A ring buffer of recent
 * AI answers keyed by a hash of the user message. Exact-hash match first, then
 * Levenshtein fuzzy match. Lives in localStorage (synchronous + fast — it sits
 * in the cascade hot path, not IndexedDB).
 *
 * Exposes window.ResponseCache: { store(userMsg, response, provenance), find(userMsg) }.
 * Spec: docs/library/PROVIDER_INDEPENDENCE_v3_OPUS.md (Refinement 4) + v4 corrections
 * (4MB usage cap, LRU-100 eviction, 200-char Levenshtein length guard, debug-only warn).
 */
(function () {
  'use strict';

  var CACHE_KEY = 'fl_responseCache';
  var MAX_ENTRIES = 500;
  var MAX_USAGE = 4 * 1024 * 1024;   // 4MB — leave headroom for themes, settings, indicators
  var EVICT_TO = MAX_ENTRIES - 100;  // on pressure, drop oldest 100
  var MAX_LEV = 200;                 // length guard — beyond this, skip fuzzy compare
  var DEBUG = (function () { try { return /[?&]debug\b/.test(location.search); } catch (e) { return false; } })();

  function hashMessage(msg) {
    var hash = 0;
    var str = String(msg == null ? '' : msg).toLowerCase().trim();
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0; // 32-bit
    }
    return hash.toString(36);
  }

  // Full-matrix Levenshtein with a length guard (v4 correction).
  function levenshtein(a, b) {
    a = String(a == null ? '' : a);
    b = String(b == null ? '' : b);
    var m = a.length, n = b.length;
    if (m > MAX_LEV || n > MAX_LEV) {
      if (DEBUG) console.warn('[ResponseCache] Levenshtein length guard hit:', m, n);
      return Infinity;
    }
    if (m === 0) return n;
    if (n === 0) return m;
    var d = [];
    for (var i = 0; i <= m; i++) { d[i] = new Array(n + 1); d[i][0] = i; }
    for (var j = 0; j <= n; j++) d[0][j] = j;
    for (var i2 = 1; i2 <= m; i2++) {
      for (var j2 = 1; j2 <= n; j2++) {
        d[i2][j2] = Math.min(
          d[i2 - 1][j2] + 1,
          d[i2][j2 - 1] + 1,
          d[i2 - 1][j2 - 1] + (a[i2 - 1] === b[j2 - 1] ? 0 : 1)
        );
      }
    }
    return d[m][n];
  }

  function read() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'); }
    catch (e) { return []; }
  }

  function getLocalStorageUsage() {
    var total = 0;
    try {
      for (var k in localStorage) {
        if (localStorage.hasOwnProperty(k)) {
          var v = localStorage.getItem(k);
          if (v) total += (v.length + k.length) * 2; // UTF-16 ≈ 2 bytes/char
        }
      }
    } catch (e) {}
    return total;
  }

  function persist(cache) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
      // QuotaExceededError — drop oldest 100, retry once, then fail silently.
      try {
        cache = cache.slice(Math.max(0, cache.length - EVICT_TO));
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      } catch (e2) { /* still full — degrade silently, never break the cascade */ }
    }
  }

  function store(userMessage, assistantResponse, provenance) {
    if (!userMessage || !assistantResponse) return;
    var cache = read();
    cache.push({
      hash: hashMessage(userMessage),
      userMsg: String(userMessage).substring(0, 200),
      response: String(assistantResponse).substring(0, 2000),
      provenance: provenance || null,
      timestamp: Date.now()
    });
    if (cache.length > MAX_ENTRIES) cache = cache.slice(cache.length - MAX_ENTRIES);
    // Pre-emptive cap: if total localStorage is tight, evict oldest 100 so the
    // response cache never starves themes/settings/custom-indicators of space.
    if (getLocalStorageUsage() > MAX_USAGE) cache = cache.slice(Math.max(0, cache.length - EVICT_TO));
    persist(cache);
  }

  function find(userMessage) {
    var cache = read();
    if (!cache.length) return null;
    var query = String(userMessage == null ? '' : userMessage).toLowerCase().trim();

    // 1) exact hash match — return the most recent
    var hash = hashMessage(userMessage);
    var exact = cache.filter(function (e) { return e.hash === hash; });
    if (exact.length) return { entry: exact[exact.length - 1], matchType: 'exact' };

    // 2) fuzzy match — Levenshtein over the last 100 entries, threshold < 30% of query length
    var threshold = Math.max(query.length * 0.3, 5);
    var best = null, bestScore = Infinity;
    for (var i = cache.length - 1; i >= Math.max(0, cache.length - 100); i--) {
      var dist = levenshtein(query.substring(0, 100), String(cache[i].userMsg || '').substring(0, 100).toLowerCase());
      if (dist < threshold && dist < bestScore) { bestScore = dist; best = cache[i]; }
    }
    if (best) return { entry: best, matchType: 'fuzzy', distance: bestScore };
    return null;
  }

  window.ResponseCache = {
    store: store,
    find: find,
    // exposed for tests
    _hash: hashMessage,
    _levenshtein: levenshtein,
    _usage: getLocalStorageUsage
  };
})();
