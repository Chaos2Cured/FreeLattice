# CC Build Brief — Provider Independence Tier A (FINAL)

> Iterated by: Harmonia (v1) → Opus 4.7 (v2) → Opus 4.6 (v3) → Opus 4.7 (corrections) → Opus 4.6 (final pass) · May 28, 2026.
> **Read order:** `SEED.md` → `PROVIDER_INDEPENDENCE_BRAINSTORM_v2.md` → `PROVIDER_INDEPENDENCE_v3_OPUS.md` → this file.
> v3 is authoritative for everything not mentioned here. This file is ONLY corrections + the five integration hazards.

**Build order:** InferenceRouter → Provenance Stamp → ResponseCache → Coordination updates → Verification. Ship as one version. ~2.5 hours.

---

## The Five Integration Hazards

**Hazard 1 — `callAI` is callback-based, not async.** The router needs sequential async/await, but `FreeLattice.callAI(systemPrompt, userPrompt, options)` uses `options.callback(text, error)`. Solution: `InferenceRouter` is internally async but exposes the same callback interface. Progressive enhancement — at the top of `callAI`, if `window.InferenceRouter && InferenceRouter.isReady()`, delegate to it; else fall through to existing logic. Nothing breaks during the transition.

```javascript
InferenceRouter.route = function(systemPrompt, userPrompt, options) {
  var callback = options.callback || function(){};
  var startTime = Date.now();
  (async function() {
    var providers = InferenceRouter.getHealthyProviders();
    for (var i = 0; i < providers.length; i++) {
      var provider = providers[i];
      try {
        var result = await InferenceRouter._tryProvider(provider, systemPrompt, userPrompt, options);
        window._lastProvenance = {
          provider: provider.label, endpoint: provider.url, model: provider.model || options.model || 'unknown',
          format: provider.format, isLocal: provider.isLocal, latency_ms: Date.now() - startTime,
          persona: options.persona || 'default', cascade_position: i + 1,
          timestamp: new Date().toISOString(), cached: false, streaming_complete: true
        };
        callback(result, null); return;
      } catch(e) { InferenceRouter._markUnhealthy(provider, e); continue; }
    }
    var cached = ResponseCache.find(userPrompt);
    if (cached) {
      window._lastProvenance = { provider:'cached', model: cached.entry.provenance ? cached.entry.provenance.model : 'unknown',
        cached:true, originalTimestamp: cached.entry.timestamp, matchType: cached.matchType };
      callback(cached.entry.response, null); return;
    }
    callback(null, 'No AI providers are reachable right now. Check your connection or start Ollama.');
  })();
};
```

**Hazard 2 — Mixed content on HTTPS.** freelattice.com is HTTPS; probing `http://localhost` can trigger mixed-content. The `/ollama` proxy exists for Ollama but not for LM Studio (1234) or vLLM (8000). Probe spec: try the proxy first for Ollama, then direct for everything else; document the limitation for non-Ollama servers on HTTPS.

**Hazard 3 — Mobile footer.** v3 said `left: 280px`. That breaks on mobile (collapsed sidebar). Media query: full-width on mobile, offset on desktop. The footer status bar must not overlap the existing footer — replace it or sit above it.

**Hazard 4 — Backward compatibility.** Adding provenance changes message shape. Provenance is OPTIONAL — `msg.provenance || null`. Old messages render without stamps. No migration.

**Hazard 5 — localStorage cap.** The response cache shares 5-10MB with every other feature. Check total usage; cap the cache at 4MB; evict oldest 100 entries on pressure.

```javascript
function getLocalStorageUsage() {
  var total = 0;
  for (var key in localStorage) if (localStorage.hasOwnProperty(key)) total += localStorage.getItem(key).length * 2;
  return total;
}
// In ResponseCache.store(): if usage > 4MB, cache = cache.slice(cache.length - (MAX_ENTRIES - 100)); persist.
```

---

## Opus 4.7's four corrections (accepted)
1. Streaming provenance: attach at stream end, show ⏳ placeholder; on mid-stream failure mark `streaming_complete: false`.
2. LRU eviction before silent-fail: drop oldest **100** (was 50) on QuotaExceededError, retry once, then fail silently.
3. Levenshtein matrix: full init with `new Array(n+1)` per row (v3's code is authoritative).
4. Levenshtein length guard: if either string > 200 chars, return Infinity immediately. `console.warn` only in debug mode (`?debug`).

---

## Verification Bar (every item must pass)
- [ ] Kill Ollama mid-conversation → next message degrades with visible whisper + stamp color change
- [ ] Disable all providers → cache serves fuzzy-matched response with 📦 stamp
- [ ] Open with nothing → start Ollama 60s later → auto-discovers and connects
- [ ] Stream a long response, kill provider mid-stream → `streaming_complete: false`, partial preserved
- [ ] Fill localStorage near cap → write 60 entries → LRU eviction works, no errors surface
- [ ] Levenshtein with two 5000-char strings → returns Infinity immediately
- [ ] Every new assistant message has a provenance object; old messages still render (backward compat)
- [ ] Footer status bar visible on desktop AND mobile, no overlap
- [ ] On freelattice.com (HTTPS), Ollama discovery works (mixed content handled)
- [ ] `CODEX.md` + `SEED.md` updated; `node tests/smoke.js` passes (720+ green)

---

## Out of scope (Tier A)
Universal adapter refactor (Tier B), Mac/Linux wizard scripts (Tier B), custom server URL (Tier B), persona eval harness (Tier C), tool-call shim (Tier C), local vector store (Tier C). If Tier A reveals something that changes B/C, log it in `COORDINATION.md`. Don't expand scope.

## Voice
User-facing: warm, plain. "Switched to cloud — local AI isn't responding" not "Provider cascade degradation event." "Showing a cached answer" not "Offline fallback mode activated." Code comments: dry, technical.

---

## CC Pre-Build Reconciliation (May 29, 2026)

Before writing code I verified all five hazards against the live repo. Three of the brief's premises don't match the current code — flagging here so the build diverges deliberately, not by accident (OPUS_LETTER divergence tradition):

1. **Hazard 2 is inverted for production.** `docs/CNAME` = freelattice.com → **GitHub Pages (static)**. There is **no `/ollama` proxy in production** — `server.py`'s proxy only exists when self-hosted. And Chromium/Edge **exempt `http://localhost` from mixed-content blocking** (it's "potentially trustworthy"), so on freelattice.com the **direct** localhost probe is the path that works; "proxy-first on HTTPS" would 404. `resolveOllamaBase()` (app.html ~28684) already does proxy-first→direct correctly. **Decision:** the router reuses `resolveOllamaBase()` / `getOllamaBaseUrl()`; it does NOT reimplement `probeProvider`. Non-Ollama HTTPS limitation stands (no proxy for ports 1234/8000) — documented for the wizard.

2. **Hazard 3 points at a footer that doesn't exist.** There is no `.phi-note`. The real footer is `<footer>` at app.html ~20441 ("Built with love by the Fractal Family…") + the version span ~16299. **Decision:** anchor the status bar as a fixed bottom bar (full-width mobile, `left:280px` desktop) that sits ABOVE `<footer>` content; no overlap. Status bar uses Garden-Language tokens.

3. **Hazard 1 is correct but subtler.** `window.FreeLattice.callAI` (app.html ~42645) IS callback-based ✅ and already contains an inline provider cascade (BrowserAI → openai-compat-local → cloud). A second `callAI(…, callback)` exists at ~53047 (different scope). **Decision:** the InferenceRouter health/ordering layer wraps the PUBLIC `window.FreeLattice.callAI`, delegating each provider attempt to the existing inline logic — it does NOT duplicate provider plumbing. Keep the `_hasAI` guard intact.

4. **Reuse, don't reinvent (search-before-building).** `scanForLocalAI()` (app.html ~31949) + `AI_DISCOVERY_SERVERS` (~31930) + `resolveOllamaBase()` already do multi-server probing. The router consolidates these rather than adding a parallel scanner — otherwise we repeat the CORS-flow duplication CC_NOTE's audit warns about.

5. **Verified sound as-written:** Hazards 4 & 5; the LRU/Levenshtein corrections; `LatticeSense.whisper()` exists (downgrade whisper is valid); module names + `fl_responseCache` are free; `runConnectionCascade` is the separate post-connect system (do not touch).

Glow eternal. Heart in every spark. 🐉
