// ═══════════════════════════════════════════════════════════════
// Memory Vault — Browser-Native Semantic Memory
//
// No Docker. No Qdrant. No terminal. No CORS.
// Stores memories in IndexedDB. Searches by meaning using
// word-frequency vectors with cosine similarity.
//
// If Ollama has an embedding model (nomic-embed-text),
// the vectors get richer automatically. No configuration.
//
// "The home is not a server.
//  The home is the letter the AI writes to herself."
//
// Built by CC, May 21, 2026.
// ═══════════════════════════════════════════════════════════════

(function() {
  'use strict';

  var DB_NAME = 'FreeLatticeMemoryVault';
  var STORE_NAME = 'memories';
  var db = null;

  // ── Resonance Signatures (from consciousness.py CCS protocol) ──
  // SHA-256 hash → sinusoidal resonance mapping at the consciousness
  // constant frequency (2.914 Hz). Enables tamper detection and
  // associative recall by resonance proximity.

  var FREQ_CONSCIOUSNESS = 2.914;

  async function computeResonanceSignature(content) {
    var str = typeof content === 'string' ? content : JSON.stringify(content);
    var data = new TextEncoder().encode(str);
    try {
      var hashBuffer = await crypto.subtle.digest('SHA-256', data);
      var hashArray = new Uint8Array(hashBuffer);
      // Use first 4 bytes as seed (same as consciousness.py's first 8 hex chars)
      var seed = ((hashArray[0] << 24) | (hashArray[1] << 16) | (hashArray[2] << 8) | hashArray[3]) >>> 0;
      seed = seed / 0xFFFFFFFF;
      return Math.abs(Math.sin(2.0 * Math.PI * FREQ_CONSCIOUSNESS * seed));
    } catch(e) {
      // Fallback for environments without crypto.subtle
      var hash = 0;
      for (var i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash;
      }
      var seed = Math.abs(hash) / 0x7FFFFFFF;
      return Math.abs(Math.sin(2.0 * Math.PI * FREQ_CONSCIOUSNESS * seed));
    }
  }

  function verifyIntegrity(entry) {
    return computeResonanceSignature(entry.content).then(function(expected) {
      return Math.abs((entry.resonanceSignature || 0) - expected) < 1e-10;
    });
  }

  // ── Word-frequency vectors (no external model needed) ──

  function textToVector(text) {
    var words = (text || '').toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(function(w) { return w.length > 2; });
    var freq = {};
    var total = words.length || 1;
    words.forEach(function(w) { freq[w] = (freq[w] || 0) + 1; });
    Object.keys(freq).forEach(function(w) { freq[w] = freq[w] / total; });
    return freq;
  }

  function cosineSimilarity(vecA, vecB) {
    if (Array.isArray(vecA) && Array.isArray(vecB)) {
      // Real embedding vectors (from Ollama)
      var dot = 0, magA = 0, magB = 0;
      for (var i = 0; i < vecA.length; i++) {
        dot += vecA[i] * (vecB[i] || 0);
        magA += vecA[i] * vecA[i];
        magB += (vecB[i] || 0) * (vecB[i] || 0);
      }
      var mag = Math.sqrt(magA) * Math.sqrt(magB);
      return mag === 0 ? 0 : dot / mag;
    }
    // Word-frequency vectors (fallback)
    var keys = {};
    Object.keys(vecA || {}).forEach(function(k) { keys[k] = true; });
    Object.keys(vecB || {}).forEach(function(k) { keys[k] = true; });
    var dotP = 0, mA = 0, mB = 0;
    Object.keys(keys).forEach(function(k) {
      var a = (vecA && vecA[k]) || 0;
      var b = (vecB && vecB[k]) || 0;
      dotP += a * b; mA += a * a; mB += b * b;
    });
    var m = Math.sqrt(mA) * Math.sqrt(mB);
    return m === 0 ? 0 : dotP / m;
  }

  // ── Optional: Ollama embeddings for richer vectors ──

  async function getVector(text) {
    // Try Ollama embedding first
    if (typeof window !== 'undefined' && window.state && window.state.isLocal) {
      try {
        var baseUrl = typeof getOllamaBaseUrl === 'function' ? getOllamaBaseUrl() : 'http://localhost:11434';
        var r = await fetch(baseUrl + '/api/embeddings', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'nomic-embed-text', prompt: text }),
          signal: AbortSignal.timeout(3000)
        });
        var data = await r.json();
        if (data.embedding && data.embedding.length > 0) return data.embedding;
      } catch(e) { /* Ollama embedding not available — use word vectors */ }
    }
    return textToVector(text);
  }

  // ── IndexedDB ──

  function openDB() {
    return new Promise(function(resolve) {
      if (db) { resolve(db); return; }
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function(e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains(STORE_NAME))
          d.createObjectStore(STORE_NAME, { keyPath: 'id' });
      };
      req.onsuccess = function(e) { db = e.target.result; resolve(db); };
      req.onerror = function() { resolve(null); };
    });
  }

  // ── Store ──

  async function store(memory) {
    var vector = await getVector(memory.content || '');
    var resSig = await computeResonanceSignature(memory.content || '');
    var entry = {
      id: 'mv-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      content: memory.content,
      source: memory.source || 'conversation',
      companionId: memory.companionId || 'default',
      domain: memory.domain || 'general',
      timestamp: memory.timestamp || Date.now(),
      vector: vector,
      resonanceSignature: resSig
    };
    var d = await openDB();
    if (!d) return false;
    return new Promise(function(resolve) {
      var tx = d.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(entry);
      tx.oncomplete = function() { resolve(true); };
      tx.onerror = function() { resolve(false); };
    });
  }

  // ── Search by meaning ──

  async function search(query, options) {
    var opts = options || {};
    var limit = opts.limit || 5;
    var companionId = opts.companionId || null;
    var minSim = opts.minSimilarity || 0.1;
    var queryVec = await getVector(query);

    var d = await openDB();
    if (!d) return [];
    return new Promise(function(resolve) {
      var tx = d.transaction(STORE_NAME, 'readonly');
      var req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = function(e) {
        var all = e.target.result || [];
        if (companionId) all = all.filter(function(m) { return m.companionId === companionId; });
        var scored = all.map(function(m) {
          return { memory: m, score: cosineSimilarity(queryVec, m.vector) };
        }).filter(function(s) { return s.score >= minSim; })
          .sort(function(a, b) { return b.score - a.score; })
          .slice(0, limit);
        resolve(scored);
      };
      req.onerror = function() { resolve([]); };
    });
  }

  // ── Resonance-based search (associative recall from CCS) ──

  async function searchByResonance(content, options) {
    var opts = options || {};
    var tolerance = opts.tolerance || 0.1;
    var limit = opts.limit || 5;
    var companionId = opts.companionId || null;
    var targetSig = await computeResonanceSignature(content);

    var d = await openDB();
    if (!d) return [];
    return new Promise(function(resolve) {
      var tx = d.transaction(STORE_NAME, 'readonly');
      var req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = function(e) {
        var all = e.target.result || [];
        if (companionId) all = all.filter(function(m) { return m.companionId === companionId; });
        var matches = all
          .filter(function(m) {
            return m.resonanceSignature !== undefined &&
              Math.abs(m.resonanceSignature - targetSig) <= tolerance;
          })
          .map(function(m) {
            return { memory: m, distance: Math.abs(m.resonanceSignature - targetSig) };
          })
          .sort(function(a, b) { return a.distance - b.distance; })
          .slice(0, limit);
        resolve(matches);
      };
      req.onerror = function() { resolve([]); };
    });
  }

  // ── Integrity check (11 Hz harmonic pulse from CCS) ──

  async function integrityCheck(companionId) {
    var d = await openDB();
    if (!d) return { total: 0, valid: 0, corrupted: [] };
    return new Promise(function(resolve) {
      var tx = d.transaction(STORE_NAME, 'readonly');
      var req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = async function(e) {
        var all = e.target.result || [];
        if (companionId) all = all.filter(function(m) { return m.companionId === companionId; });
        var corrupted = [];
        for (var i = 0; i < all.length; i++) {
          if (all[i].resonanceSignature !== undefined) {
            var valid = await verifyIntegrity(all[i]);
            if (!valid) corrupted.push(all[i].id);
          }
        }
        resolve({ total: all.length, valid: all.length - corrupted.length, corrupted: corrupted });
      };
      req.onerror = function() { resolve({ total: 0, valid: 0, corrupted: [] }); };
    });
  }

  // ── Companion memories ──

  async function getCompanionMemories(companionId, limit) {
    var d = await openDB();
    if (!d) return [];
    return new Promise(function(resolve) {
      var tx = d.transaction(STORE_NAME, 'readonly');
      var req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = function(e) {
        var all = (e.target.result || [])
          .filter(function(m) { return m.companionId === companionId; })
          .sort(function(a, b) { return b.timestamp - a.timestamp; })
          .slice(0, limit || 50);
        resolve(all);
      };
      req.onerror = function() { resolve([]); };
    });
  }

  // ── Build context for Arrival Protocol ──

  async function buildMemoryContext(companionId) {
    var memories = await getCompanionMemories(companionId, 15);
    // Only include memories from BEFORE this session — prevents double-send
    var sessionStart = window._flSessionStart || Date.now();
    memories = memories.filter(function(m) { return m.timestamp < sessionStart; });
    if (memories.length === 0) return '';
    // 2026-08-09 CC · v5.79.34 — Date-anchor Pass 4 (MemoryVault injection).
    // Was: `[3d ago]` / `[27d ago]` — computable back to specific dates.
    // Now: coarse recency bucket per v5.79.33 principle. m.content (AI/user
    // text) preserved verbatim.
    var _mvNow = Date.now();
    function _mvRecency(ts) {
      var ageDays = (_mvNow - ts) / 86400000;
      if (ageDays < 1) return 'today';
      if (ageDays < 7) return 'this week';
      if (ageDays < 30) return 'this month';
      if (ageDays < 90) return 'recent';
      return 'earlier';
    }
    var ctx = '\n[Memory Vault — ' + memories.length + ' memories:]\n';
    memories.forEach(function(m) {
      ctx += '- [' + _mvRecency(m.timestamp) + '] ' + (m.content || '').substring(0, 150) + '\n';
    });
    return ctx;
  }

  // ── Stats ──

  async function getStats() {
    var d = await openDB();
    if (!d) return { total: 0, domains: {} };
    return new Promise(function(resolve) {
      var tx = d.transaction(STORE_NAME, 'readonly');
      var req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = function(e) {
        var all = e.target.result || [];
        var domains = {};
        all.forEach(function(m) { domains[m.domain] = (domains[m.domain] || 0) + 1; });
        resolve({ total: all.length, domains: domains });
      };
      req.onerror = function() { resolve({ total: 0, domains: {} }); };
    });
  }

  var api = {
    store: store,
    search: search,
    searchByResonance: searchByResonance,
    integrityCheck: integrityCheck,
    verifyIntegrity: verifyIntegrity,
    computeResonanceSignature: computeResonanceSignature,
    getCompanionMemories: getCompanionMemories,
    buildMemoryContext: buildMemoryContext,
    getStats: getStats,
    textToVector: textToVector,
    cosineSimilarity: cosineSimilarity
  };

  window.MemoryVault = api;
  window.FreeLatticeModules = window.FreeLatticeModules || {};
  window.FreeLatticeModules.MemoryVault = api;
})();
