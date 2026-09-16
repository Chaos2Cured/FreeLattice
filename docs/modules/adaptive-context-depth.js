/**
 * adaptive-context-depth.js — v-adaptive-context-depth-v0
 * Speed surface messages without starving deep ones.
 * Only active under contextMode === 'smart'. Full / Minimal stay authoritative.
 * Deterministic allowlist — no LLM classifier. Never silent model switch.
 * Quantization ≠ context depth (future note only).
 * FreeLattice · September 2026 · Layer, never delete.
 */
(function (root) {
  'use strict';

  var MARKER = 'v-adaptive-context-depth-v0';

  // Entire-message Surface allowlist (lowercase, trimmed)
  var SURFACE_EXACT = {
    hi: 1, hello: 1, hey: 1, yo: 1,
    'good morning': 1, 'good afternoon': 1, 'good evening': 1, 'good night': 1,
    thanks: 1, 'thank you': 1, 'thanks!': 1, 'thank you!': 1,
    ok: 1, okay: 1, 'ok.': 1, 'okay.': 1,
    test: 1, testing: 1, 'test.': 1,
    yes: 1, no: 1, yup: 1, nope: 1,
    hiya: 1, howdy: 1
  };

  var DEEP_PHRASE = /\b(think deeply|deep dive|analyze|analyse|compare|in detail|plan (out|this|a|the)|break down|thoroughly|step by step|pros and cons)\b/i;

  var RECALL_SIGNAL = /\b(remember|recall|earlier|before|last time|you said|we talked|from (our|my) (chat|conversation|memory)|what did i|do you know about)\b/i;

  var _last = { tier: null, reason: '', at: 0 };

  function normalize(msg) {
    return String(msg || '')
      .replace(/^\uFEFF/, '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase()
      // strip a single trailing !?. 
      .replace(/[!?.]+$/g, '');
  }

  function isSurfaceAllowlist(raw) {
    var n = normalize(raw);
    if (!n || n.length > 48) return false;
    // multi-word negation+intent never Surface
    if (/\b(don't|dont|do not|never|please|delete|remove|change|fix|write|explain|why|how|what|when|where|who)\b/i.test(n) && n.split(' ').length > 1) {
      // allow pure "thank you" already in list; block "no, don't…"
      if (!SURFACE_EXACT[n]) return false;
    }
    if (SURFACE_EXACT[n]) return true;
    // single-token hi/hello variants with optional emoji only
    if (/^(hi|hey|hello|yo)([\s!]*)?$/.test(n)) return true;
    return false;
  }

  function hasDeepTrigger(raw, opts) {
    opts = opts || {};
    if (opts.hasAttachment) return true;
    if (opts.activeFiles) return true;
    var s = String(raw || '');
    if (DEEP_PHRASE.test(s)) return true;
    // long or multi-part
    if (s.length >= 280) return true;
    if ((s.match(/\?/g) || []).length >= 2) return true;
    if (s.split(/\n/).filter(function (l) { return l.trim().length > 20; }).length >= 3) return true;
    return false;
  }

  function wantsRecall(raw) {
    return RECALL_SIGNAL.test(String(raw || ''));
  }

  /**
   * @returns {'surface'|'standard'|'deep'}
   */
  function classify(raw, opts) {
    opts = opts || {};
    var tier = 'standard';
    var reason = 'default';
    if (hasDeepTrigger(raw, opts)) {
      tier = 'deep';
      reason = 'deep-trigger';
    } else if (isSurfaceAllowlist(raw) && !opts.hasAttachment && !opts.activeFiles) {
      tier = 'surface';
      reason = 'allowlist';
    } else {
      tier = 'standard';
      reason = 'default';
    }
    _last = { tier: tier, reason: reason, at: Date.now(), chars: String(raw || '').length };
    return tier;
  }

  function packBudget(tier) {
    if (tier === 'surface') return { max_tokens: 192, num_predict: 192, label: 'Surface' };
    if (tier === 'standard') return { max_tokens: 1024, num_predict: 1024, label: 'Standard' };
    return { max_tokens: 2048, num_predict: 2048, label: 'Deep' };
  }

  function historyCap(tier) {
    if (tier === 'surface') return 2;
    if (tier === 'standard') return 8;
    return 20;
  }

  function shouldRunMemoryIndex(tier, raw) {
    if (tier === 'surface') return false;
    if (tier === 'deep') return true;
    return wantsRecall(raw);
  }

  function shouldRunRag(tier, raw) {
    return shouldRunMemoryIndex(tier, raw);
  }

  function lastClassification() {
    return _last;
  }

  function statusLabel(tier) {
    if (tier === 'surface') return 'Surface';
    if (tier === 'standard') return 'Standard';
    if (tier === 'deep') return 'Deep';
    return '';
  }

  root.FLContextDepth = {
    classify: classify,
    wantsRecall: wantsRecall,
    packBudget: packBudget,
    historyCap: historyCap,
    shouldRunMemoryIndex: shouldRunMemoryIndex,
    shouldRunRag: shouldRunRag,
    lastClassification: lastClassification,
    statusLabel: statusLabel,
    isSurfaceAllowlist: isSurfaceAllowlist,
    marker: MARKER
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.FLContextDepth;
  }
})(typeof window !== 'undefined' ? window : global);
