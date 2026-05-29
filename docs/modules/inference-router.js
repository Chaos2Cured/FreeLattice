/* FreeLattice — InferenceRouter (Provider Independence Tier A, Layer 7 engine)
 * ---------------------------------------------------------------------------
 * Health-aware failure cascade + per-response provenance for the
 * FreeLattice.callAI path (used by Garden Dialogue, Round Table, Question
 * Corner, and the other modules). PROGRESSIVE ENHANCEMENT: callAI delegates
 * here only when isReady() is true and the call isn't already routed; if the
 * router is absent or throws, callAI runs its original logic unchanged.
 *
 * On a provider failure it: marks the provider unhealthy (circuit breaker with
 * per-class timings), surfaces a VISIBLE whisper (silent downgrades are a trust
 * violation), then falls back to Browser AI, then to a cached answer, then to
 * an honest failure. Every successful answer is stamped into window._lastProvenance
 * and stored in ResponseCache for offline recall.
 *
 * NOTE: the main chat (sendMessage) has its own inline inference and does NOT
 * go through callAI — its provenance chip + status bar are Tier A Part 2.
 *
 * Spec: docs/library/PROVIDER_INDEPENDENCE_v3_OPUS.md (Refinements 1, 6) +
 * PROVIDER_INDEPENDENCE_v4_FINAL.md (Hazard 1 + reconciliation).
 */
(function () {
  'use strict';

  var _ready = false;
  var _health = {}; // providerKey -> { state:'healthy'|'probation'|'unhealthy', sinceTs, lastLatency }

  // Circuit-breaker timings by provider class (Refinement 1).
  var TIMINGS = {
    local:   { unhealthy: 60000 },   // restarts fast
    cloud:   { unhealthy: 300000 },  // rate limits / outages last minutes
    mesh:    { unhealthy: 120000 },
    browser: { unhealthy: 0 }        // works or it doesn't
  };

  var CLOUD_LABELS = {
    groq: 'Groq', openai: 'OpenAI', anthropic: 'Claude', google: 'Gemini',
    huggingface: 'Hugging Face', xai: 'Grok', openrouter: 'OpenRouter',
    deepseek: 'DeepSeek', together: 'Together', mistral: 'Mistral'
  };

  function assign(target, src) {
    if (src) for (var k in src) if (Object.prototype.hasOwnProperty.call(src, k)) target[k] = src[k];
    return target;
  }

  // Read-only detection of the provider callAI WOULD use, so provenance is honest.
  function activeProvider() {
    try {
      if (typeof BrowserAI !== 'undefined' && BrowserAI.ready &&
          (typeof state === 'undefined' || state.provider === 'browser')) {
        return { key: 'browser', label: 'Browser AI', type: 'browser', isLocal: false, model: BrowserAI.modelName || 'in-browser' };
      }
      if (typeof state !== 'undefined') {
        if (state.provider === 'openai-compat-local') {
          return { key: 'local:openai-compat', label: 'Local server', type: 'local', isLocal: true, model: state.ollamaModel || 'local' };
        }
        if (state.meshInference && state.meshPeerId) {
          return { key: 'mesh:' + state.meshPeerId, label: 'Mesh peer', type: 'mesh', isLocal: false, model: state.meshModel || state.ollamaModel || 'peer' };
        }
        if (state.isLocal) {
          return { key: 'local:' + (state.provider || 'ollama'), label: (state.provider === 'lmstudio' ? 'LM Studio' : 'Ollama'), type: 'local', isLocal: true, model: state.ollamaModel || 'local' };
        }
        if (state.apiKey) {
          return { key: 'cloud:' + state.provider, label: CLOUD_LABELS[state.provider] || (state.provider || 'Cloud'), type: 'cloud', isLocal: false, model: state.model || state.provider };
        }
      }
    } catch (e) {}
    return { key: 'none', label: 'No AI', type: 'none', isLocal: false, model: '' };
  }

  // ---- circuit breaker ----------------------------------------------------

  function health(key) {
    if (!_health[key]) _health[key] = { state: 'healthy', sinceTs: Date.now(), lastLatency: 0 };
    return _health[key];
  }
  function markHealthy(p, latency) {
    var h = health(p.key); h.state = 'healthy'; h.sinceTs = Date.now();
    if (latency != null) h.lastLatency = latency;
  }
  function markFail(p) {
    var h = health(p.key); var now = Date.now();
    if (p.type === 'browser') { h.state = 'unhealthy'; h.sinceTs = now; return; }
    if (h.state === 'healthy') { h.state = 'probation'; h.sinceTs = now; }
    else { h.state = 'unhealthy'; h.sinceTs = now; } // probation→unhealthy, or stays unhealthy
  }
  function isUsable(p) {
    var h = _health[p.key];
    if (!h) return true;
    if (h.state === 'unhealthy') {
      var t = TIMINGS[p.type] || TIMINGS.local;
      if (Date.now() - h.sinceTs > t.unhealthy) { h.state = 'probation'; h.sinceTs = Date.now(); return true; }
      return false;
    }
    return true;
  }

  // ---- provenance ---------------------------------------------------------

  function stamp(p, latency, extra) {
    var prov = {
      provider: p.label, model: p.model, format: p.type, isLocal: p.isLocal,
      latency_ms: (latency == null ? null : latency), cascade_position: 1,
      cached: false, streaming_complete: true, timestamp: new Date().toISOString()
    };
    if (extra) assign(prov, extra);
    try { window._lastProvenance = prov; } catch (e) {}
    return prov;
  }

  function whisper(msg) {
    try { if (typeof LatticeSense !== 'undefined' && LatticeSense.whisper) LatticeSense.whisper(msg, 'provider'); } catch (e) {}
  }

  // ---- the route (wraps FreeLattice.callAI) -------------------------------

  function route(systemPrompt, userPrompt, options) {
    var opts = options || {};
    var cb = opts.callback || function () {};
    var primary = activeProvider();
    var t0 = Date.now();

    var forwarded = assign({}, opts);
    forwarded._routed = true; // recursion guard — runs callAI's original logic
    forwarded.callback = function (text, err) {
      var latency = Date.now() - t0;
      if (!err && text != null && text !== '') {
        markHealthy(primary, latency);
        var prov = stamp(primary, latency);
        try { if (window.ResponseCache) ResponseCache.store(userPrompt, text, prov); } catch (e) {}
        cb(text, null);
        return;
      }
      markFail(primary);
      onFail(systemPrompt, userPrompt, opts, primary, cb);
    };

    try {
      window.FreeLattice.callAI(systemPrompt, userPrompt, forwarded);
    } catch (e) {
      markFail(primary);
      onFail(systemPrompt, userPrompt, opts, primary, cb);
    }
  }

  // Fallback chain: Browser AI (clean promise API, no state mutation) → cache → honest failure.
  function onFail(systemPrompt, userPrompt, opts, failed, cb) {
    if (typeof BrowserAI !== 'undefined' && BrowserAI.ready && failed.type !== 'browser') {
      whisper('Switched to in-browser AI — ' + failed.label + " isn't responding.");
      var bp = { key: 'browser', label: 'Browser AI', type: 'browser', isLocal: false, model: BrowserAI.modelName || 'in-browser' };
      var t0 = Date.now();
      try {
        BrowserAI.chat(
          [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
          { maxTokens: opts.maxTokens || 1024, temperature: opts.temperature || 0.7 }
        ).then(function (text) {
          if (text == null || text === '') { fallbackCache(userPrompt, failed, cb); return; }
          var latency = Date.now() - t0;
          markHealthy(bp, latency);
          var prov = stamp(bp, latency, { cascade_position: 2 });
          try { if (window.ResponseCache) ResponseCache.store(userPrompt, text, prov); } catch (e) {}
          cb(text, null);
        }).catch(function () { fallbackCache(userPrompt, failed, cb); });
        return;
      } catch (e) { /* fall through to cache */ }
    }
    fallbackCache(userPrompt, failed, cb);
  }

  function fallbackCache(userPrompt, failed, cb) {
    var cached = null;
    try { if (window.ResponseCache) cached = ResponseCache.find(userPrompt); } catch (e) {}
    if (cached) {
      stamp({ label: 'Cached', type: 'cached', model: (cached.entry.provenance && cached.entry.provenance.model) || 'unknown', isLocal: false },
        null, { cached: true, matchType: cached.matchType, originalTimestamp: cached.entry.timestamp, cascade_position: 7 });
      whisper('Showing a saved answer — no AI is reachable right now.');
      cb(cached.entry.response, null);
      return;
    }
    whisper("No AI is reachable right now. Start Ollama or check your connection.");
    cb(null, 'No AI providers are reachable right now. Check your connection or start your local AI.');
  }

  // Public hook for the chat path (Tier A Part 2) to report provider + latency.
  function observe(provider, latencyMs, ok) {
    var p = provider || activeProvider();
    if (ok) markHealthy(p, latencyMs); else markFail(p);
    return p;
  }

  function isReady() {
    if (!_ready) return false;
    // Kill-switch: set localStorage.fl_routerDisabled='true' to instantly revert
    // to callAI's original behavior without a deploy.
    try { if (localStorage.getItem('fl_routerDisabled') === 'true') return false; } catch (e) {}
    return true;
  }

  function init() { _ready = true; }

  window.InferenceRouter = {
    isReady: isReady,
    route: route,
    observe: observe,
    activeProvider: activeProvider,
    // exposed for tests / status UI (Part 2)
    _health: _health,
    _stamp: stamp
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
