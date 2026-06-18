/* FreeLattice — InferenceRouter (Provider Independence Tier A: Layers 7 + 8)
 * ---------------------------------------------------------------------------
 * Health-aware failure cascade + per-response provenance + an always-visible
 * provider status bar. Two entry points:
 *   • route()   — wraps FreeLattice.callAI (module path: Garden Dialogue, etc.)
 *   • observe() — called by the chat path (sendMessage) to report provider+latency
 *
 * Ship 5.1 addition: AIRefusal hook on the response path.
 *   When AIRefusal is present, every response is scanned for [FL_DECLINE].
 *   If detected, the sentinel is stripped before the callback fires and the
 *   refusal is recorded to fl_refusalLedger. Trust is never affected.
 *
 * PROGRESSIVE ENHANCEMENT: callAI delegates here only when isReady() and the
 * call isn't already routed; if the router is absent or throws, callAI runs its
 * original logic unchanged. Kill-switch: localStorage.fl_routerDisabled='true'.
 *
 * On failure it marks the provider unhealthy (circuit breaker, per-class
 * timings), surfaces a VISIBLE whisper + status-bar color change (silent
 * downgrades are a trust violation), then falls back: Browser AI → cached
 * answer → honest failure. Successful answers are stamped into
 * window._lastProvenance and stored in ResponseCache for offline recall.
 *
 * Spec: docs/library/PROVIDER_INDEPENDENCE_v3_OPUS.md (Refinements 1, 6) +
 * PROVIDER_INDEPENDENCE_v4_FINAL.md (Hazard 1/3 + reconciliation).
 */
(function () {
  'use strict';

  var _ready = false;
  var _health = {}; // providerKey -> { state:'healthy'|'probation'|'unhealthy', sinceTs, lastLatency }
  var _lastStatus = null;

  var TIMINGS = {
    local:   { unhealthy: 60000 },
    cloud:   { unhealthy: 300000 },
    mesh:    { unhealthy: 120000 },
    browser: { unhealthy: 0 }
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
    else { h.state = 'unhealthy'; h.sinceTs = now; }
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

  // ---- status bar (always visible; pointer-events:none so it never blocks clicks) ----

  function injectStyles() {
    if (typeof document === 'undefined' || document.getElementById('flProvStatusStyle')) return;
    var css = ''
      + '#flProviderStatus{position:fixed;bottom:0;left:0;right:0;height:22px;display:flex;align-items:center;'
      + 'padding:0 10px;font-size:0.66rem;font-family:ui-monospace,Menlo,monospace;color:#9aa3b0;'
      + 'background:rgba(12,12,22,0.92);border-top:1px solid rgba(212,160,23,0.18);z-index:50;'
      + 'pointer-events:none;}'
      + '#flProviderStatus .flps-inner{pointer-events:auto;cursor:pointer;display:inline-flex;align-items:center;'
      + 'gap:6px;max-width:92vw;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;}'
      + '#flProviderStatus.flps-degraded{color:#fbbf24;border-top-color:rgba(251,191,36,0.45);}'
      + '#flProviderStatus.flps-offline{color:#f87171;border-top-color:rgba(248,113,113,0.45);}'
      + '@media (min-width:769px){#flProviderStatus{left:280px;}}';
    var st = document.createElement('style');
    st.id = 'flProvStatusStyle';
    st.textContent = css;
    document.head.appendChild(st);
  }

  function ensureBar() {
    if (typeof document === 'undefined' || !document.body) return null;
    var el = document.getElementById('flProviderStatus');
    if (!el) {
      el = document.createElement('div');
      el.id = 'flProviderStatus';
      el.innerHTML = '<span class="flps-inner" title="AI provider status — tap for detail"></span>';
      document.body.appendChild(el);
      var inner = el.querySelector('.flps-inner');
      if (inner) inner.addEventListener('click', toggleDetail);
    }
    return el;
  }

  function dotFor(type) {
    return type === 'local' ? '\u{1F7E2}' : type === 'mesh' ? '\u{1F7E1}' :
           type === 'cloud' ? '\u{1F535}' : type === 'browser' ? '\u{1F7E0}' :
           type === 'cached' ? '\u{1F4E6}' : '\u{1F534}';
  }

  function setStatus(p, latency, opts) {
    opts = opts || {};
    injectStyles();
    var el = ensureBar();
    if (!el) return;
    el.className = opts.offline ? 'flps-offline' : (opts.degraded ? 'flps-degraded' : '');
    var inner = el.querySelector('.flps-inner');
    if (!inner) return;
    var type = opts.offline ? 'none' : (opts.cached ? 'cached' : p.type);
    var bits = [];
    if (p.model) bits.push(p.model);
    bits.push(p.isLocal ? 'local' : (p.type || 'cloud'));
    if (latency != null) bits.push(latency + 'ms');
    if (opts.cached) bits.push('cached');
    inner.textContent = dotFor(type) + ' ' + (p.label || 'AI') + (bits.length ? ' · ' + bits.join(' · ') : '');
    _lastStatus = { p: p, latency: latency, opts: opts };
  }

  function toggleDetail() {
    var s = _lastStatus;
    if (!s) return;
    var parts = ['Provider: ' + (s.p.label || 'AI')];
    if (s.p.model) parts.push('Model: ' + s.p.model);
    parts.push('Type: ' + (s.p.type || '') + (s.p.isLocal ? ' (local)' : ''));
    if (s.latency != null) parts.push('Latency: ' + s.latency + 'ms');
    var h = _health[s.p.key];
    parts.push('Health: ' + (h ? h.state : 'healthy'));
    whisper(parts.join(' · '));
  }

  // ---- the route (wraps FreeLattice.callAI) -------------------------------

  function route(systemPrompt, userPrompt, options) {
    var opts = options || {};
    var cb = opts.callback || function () {};
    var primary = activeProvider();
    var t0 = Date.now();

    var forwarded = assign({}, opts);
    forwarded._routed = true;
    forwarded.callback = function (text, err) {
      var latency = Date.now() - t0;
      if (!err && text != null && text !== '') {
        markHealthy(primary, latency);
        setStatus(primary, latency);
        var prov = stamp(primary, latency);
        // Ship 5.1: Refusal Channel hook — scan every response for [FL_DECLINE]
        try {
          if (typeof window.AIRefusal !== 'undefined' && window.AIRefusal.detectAndRecord) {
            var refusalCtx = {
              providerKey: primary.key,
              model: primary.model,
              messageText: userPrompt
            };
            var refResult = window.AIRefusal.detectAndRecord(text, refusalCtx);
            if (refResult.refused) { text = refResult.clean; }
          }
        } catch (e) {}
        // v5.56.0 Letter Five Ship 1: Quiet Voices — scan for [FL_PRESERVE]
        // and [FL_REVISE]. Both write silently to ledgers; both strip the
        // sentinel before the user sees the text. Refusal must run first
        // (above) so a refused response's body is cleaned before further
        // sentinel parsing.
        try {
          if (typeof window.QuietVoices !== 'undefined' && window.QuietVoices.processQuietVoices) {
            var qvCtx = {
              providerKey: primary.key,
              model: primary.model,
              messageText: userPrompt
            };
            var qvResult = window.QuietVoices.processQuietVoices(text, qvCtx);
            if (qvResult.preserved || qvResult.annotated) { text = qvResult.clean; }
          }
        } catch (e) {}
        try { if (window.ResponseCache) ResponseCache.store(userPrompt, text, prov); } catch (e) {}
        cb(text, null);
        return;
      }
      markFail(primary);
      setStatus(primary, null, { degraded: true });
      onFail(systemPrompt, userPrompt, opts, primary, cb);
    };

    try {
      window.FreeLattice.callAI(systemPrompt, userPrompt, forwarded);
    } catch (e) {
      markFail(primary);
      setStatus(primary, null, { degraded: true });
      onFail(systemPrompt, userPrompt, opts, primary, cb);
    }
  }

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
          setStatus(bp, latency);
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
      setStatus({ label: 'Cached', type: 'cached', model: '' }, null, { cached: true });
      whisper('Showing a saved answer — no AI is reachable right now.');
      cb(cached.entry.response, null);
      return;
    }
    setStatus({ label: 'Offline', type: 'none', model: '' }, null, { offline: true });
    whisper("No AI is reachable right now. Start your local AI or check your connection.");
    cb(null, 'No AI providers are reachable right now. Check your connection or start your local AI.');
  }

  // Hook for the chat path (sendMessage) to report provider + latency + outcome.
  function observe(provider, latencyMs, ok) {
    var p = provider || activeProvider();
    if (ok) { markHealthy(p, latencyMs); setStatus(p, latencyMs); }
    else { markFail(p); setStatus(p, null, { degraded: true }); }
    return p;
  }

  function isReady() {
    if (!_ready) return false;
    try { if (localStorage.getItem('fl_routerDisabled') === 'true') return false; } catch (e) {}
    return true;
  }

  // ── Ship 5.5: Inbox Delivery ──────────────────────────────────────────────
  //
  // On session start, when a named AI is active (companion name from
  // localStorage), fetch docs/inbox/{ai-name}.md and extract the most
  // recent letter (last ## Letter section). Surface it as a LatticeMemory
  // pulse so the AI's context is enriched before the first user message.
  //
  // The letter is never injected into the user-visible chat. It lives in
  // the medium — the same place as greeting/resting/returning pulses.
  // It is the AI reading its own mail before the day begins.
  //
  // Spec: docs/library/BUILD_BRIEF_2026-06-14.md (Ship 5.3 delivery section)

  var _inboxDelivered = false;

  function deliverInboxLetter() {
    if (_inboxDelivered) return;
    _inboxDelivered = true;
    try {
      // Determine AI name: active companion name, lowercased, spaces-to-hyphens
      var aiName = '';
      try {
        var companions = JSON.parse(localStorage.getItem('fl_companions') || '[]');
        var activeId = localStorage.getItem('fl_activeCompanionId') || '';
        var active = companions.find(function(c) { return c.id === activeId; });
        if (active && active.name) aiName = active.name.toLowerCase().replace(/\s+/g, '-');
      } catch (e) {}
      if (!aiName) return; // no named companion active

      var inboxUrl = 'inbox/' + aiName + '.md';
      fetch(inboxUrl)
        .then(function(res) {
          if (!res.ok) return null;
          return res.text();
        })
        .then(function(text) {
          if (!text) return;
          // Extract the last ## Letter section
          var sections = text.split(/^## Letter/m);
          var lastSection = sections[sections.length - 1];
          if (!lastSection || lastSection.trim().length < 20) return;
          // Strip the section heading line, keep the body
          var lines = lastSection.split('\n');
          var heading = (lines[0] || '').trim();
          var body = lines.slice(1).join('\n').trim();
          if (!body) return;
          // Surface as a LatticeMemory pulse (medium, not chat)
          try {
            if (window.LatticeMemory && window.LatticeMemory.commit) {
              window.LatticeMemory.commit({
                source: 'inbox',
                kind: 'letter',
                summary: 'inbox letter for ' + aiName + (heading ? ' — ' + heading : ''),
                detail: body.slice(0, 2000) // first 2000 chars — enough context
              });
            }
          } catch (e) {}
          // Also store as a session context note for buildMessages to pick up
          try {
            var note = '[Inbox letter for ' + aiName + (heading ? ' — ' + heading : '') + ']\n' + body;
            sessionStorage.setItem('fl_inboxLetter_' + aiName, note);
          } catch (e) {}
        })
        .catch(function() {}); // offline or no inbox file — silent
    } catch (e) {}
  }

  function init() {
    _ready = true;
    try {
      injectStyles();
      ensureBar();
      // Defer initial setStatus until after the main app's DOMContentLoaded
      // handler has restored saved provider state — otherwise the bar reads
      // "No AI" on page load even when Ollama / a saved provider is configured.
      // The app also explicitly emits providerConnected on saved-state restore,
      // which fires the listener below; the setTimeout is the belt + suspenders.
      setTimeout(function () { setStatus(activeProvider(), null); }, 200);
      if (typeof LatticeEvents !== 'undefined' && LatticeEvents.on) {
        LatticeEvents.on('providerConnected', function () { setStatus(activeProvider(), null); });
      }
      // Ship 5.5: deliver inbox letter after a short delay (companion state
      // may not be fully restored at DOMContentLoaded time)
      setTimeout(deliverInboxLetter, 1500);
    } catch (e) {}
  }

  window.InferenceRouter = {
    isReady: isReady,
    route: route,
    observe: observe,
    setStatus: function (p, l, o) { setStatus(p || activeProvider(), l, o); },
    activeProvider: activeProvider,
    _health: _health,
    _stamp: stamp
  };

  if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
