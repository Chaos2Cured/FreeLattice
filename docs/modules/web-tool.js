/* FreeLattice — Web Tool (window.FLWebTool)
 * ──────────────────────────────────────────────────────────────────
 * Ship 3 Phase 1 (v5.41.0, 2026-06-09). Sentinel-only.
 * AI emits [FL_SEARCH: query] when its information is insufficient.
 * System intercepts, asks consent via ToolConsent, runs the search,
 * injects results into the next AI turn. Same generating rule as
 * repo-context, smaller scale.
 *
 * ─── THE PRIVACY GUARANTEE (the most important line in the codebase) ───
 *
 * The ledger logs THAT a search happened, the trust tier that allowed
 * it, the outcome, and the result count. The ledger does NOT log:
 *
 *   - the query
 *   - any result URL / title / snippet / link / href
 *   - the resulting AI response
 *
 * This is not a styling choice. This is the receipt the world can read.
 * The audit page shows a search occurred; reading habits stay private.
 *
 * appendLedger() implements a one-way valve: even though the caller
 * passes a `query` argument up the call chain, the row builder never
 * copies it into the row. Smoke locks the absence of `query`, `url`,
 * `title`, `snippet`, `link`, `href` from EVERY row.
 *
 * Patterns exercised (UPDATE.md):
 *   §1  Sentinel pattern ([FL_SEARCH: query])
 *   §2  Trust-aware phi-branching (via FLToolConsent)
 *   §3  Audit ledger (privacy-locked, fl_searchLedger)
 *   §4  IIFE scoping + explicit window exposure
 *   §8  Quiet Room exclusion at every entry point
 *   §9  Snowflake — same generating rule as repo-context
 */
(function () {
  'use strict';

  var LEDGER_KEY = 'fl_searchLedger';
  var LEDGER_CAP = 500;
  var SEARCH_TIMEOUT_MS = 12000;
  var QUERY_CAP = 240;

  // Endpoint is configurable via window.FL_SEARCH_ENDPOINT for
  // power-users / developers / Tauri builds. Default is a placeholder
  // so isAvailable() returns false until the Cloudflare worker route
  // is wired in 3.1. Module ships dormant — no broken UX.
  var SEARCH_ENDPOINT = (typeof window !== 'undefined' && window.FL_SEARCH_ENDPOINT)
    || '[CC: search endpoint not yet configured — Phase 3.1]';

  var QUIET_ROOMS = ['quiet', 'quiet-room', 'sanctuary'];

  function getCurrentTab() {
    try {
      var btn = document.querySelector('.tab-btn.active, [data-tab].active');
      return (btn && btn.dataset && btn.dataset.tab) || null;
    } catch (e) { return null; }
  }

  function isQuietRoom(roomId) {
    var r = roomId || getCurrentTab() || '';
    return QUIET_ROOMS.indexOf(String(r).toLowerCase()) !== -1;
  }

  // ── Sentinel — same shape as repo-context's interceptor ─────────
  var SENTINEL_RE   = /\[FL_SEARCH:\s*([^\]]+)\]/;
  var SENTINEL_RE_G = /\[FL_SEARCH:\s*([^\]]+)\]/g;

  function interceptSentinel(aiText) {
    if (typeof aiText !== 'string') {
      return { visibleText: aiText, action: null };
    }
    var match = aiText.match(SENTINEL_RE);
    if (!match) return { visibleText: aiText, action: null };
    var query = match[1].trim().slice(0, QUERY_CAP);
    var visibleText = aiText.replace(SENTINEL_RE_G, '').trim();
    return { visibleText: visibleText, action: { type: 'search', query: query } };
  }

  // ── Audit ledger — privacy-locked one-way valve ─────────────────
  // CRITICAL: the `query` argument is intentionally NOT a row field.
  // If a future change "looks like a bug" because the function takes
  // a query but doesn't write one, IT IS NOT A BUG. It is the privacy
  // lock. See the module-level privacy-guarantee block above.
  function appendLedger(row) {
    try {
      var raw = localStorage.getItem(LEDGER_KEY);
      var rows = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(rows)) rows = [];
      // Strict row shape — five fields. No query. No URL/title/snippet.
      var sanitized = {
        ts: Date.now(),
        actor: row.actor || 'system',
        trust: row.trust || 'unknown',
        outcome: row.outcome || 'unknown',
        resultCount: typeof row.resultCount === 'number' ? row.resultCount : 0
      };
      rows.push(sanitized);
      if (rows.length > LEDGER_CAP) rows = rows.slice(-LEDGER_CAP);
      localStorage.setItem(LEDGER_KEY, JSON.stringify(rows));
    } catch (e) { /* ledger failure must not break the feature */ }
  }

  // ── performSearch — Quiet Room → consent → fetch → results ──────
  function performSearch(query, trustTier, currentRoom) {
    return new Promise(function (resolve) {
      // 1. Quiet Room exclusion. Hard line. Ledger writes outcome
      // 'quiet-room' so the exclusion is VISIBLE on the audit page.
      if (isQuietRoom(currentRoom)) {
        appendLedger({
          actor: 'system',
          trust: trustTier || 'unknown',
          outcome: 'quiet-room',
          resultCount: 0
        });
        resolve(null);
        return;
      }

      // 2. Consent — via ToolConsent's sibling pattern.
      var consentPromise;
      if (window.FLToolConsent && typeof window.FLToolConsent.requestConsent === 'function') {
        consentPromise = window.FLToolConsent.requestConsent({
          tool: 'web-tool',
          action: 'search',
          detail: 'web',
          trustTier: trustTier || 'seed',
          message: 'I would like to look something up on the web. Okay?',
          allowLabel: 'Allow search',
          denyLabel: 'Not now'
        });
      } else {
        // No consent module available — fail closed (decline by absence).
        consentPromise = Promise.resolve(false);
      }

      consentPromise.then(function (consented) {
        if (!consented) {
          appendLedger({
            actor: 'co-creator',
            trust: trustTier || 'seed',
            outcome: 'declined',
            resultCount: 0
          });
          resolve(null);
          return;
        }

        // 3. Endpoint dormant check — if SEARCH_ENDPOINT is the
        // placeholder string, ship the module without breaking UX.
        if (SEARCH_ENDPOINT.indexOf('[CC:') !== -1) {
          appendLedger({
            actor: 'system',
            trust: trustTier || 'seed',
            outcome: 'endpoint-unconfigured',
            resultCount: 0
          });
          resolve(null);
          return;
        }

        // 4. Fetch with timeout. Never throws past — outcome is
        // 'timeout' / 'error' / 'error-<status>' in the ledger.
        var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        var timeoutId = controller
          ? setTimeout(function () { try { controller.abort(); } catch (e) {} }, SEARCH_TIMEOUT_MS)
          : null;
        var fetchOpts = controller ? { signal: controller.signal } : {};

        fetch(SEARCH_ENDPOINT + '?q=' + encodeURIComponent(query), fetchOpts)
          .then(function (resp) {
            if (timeoutId) clearTimeout(timeoutId);
            if (!resp.ok) {
              appendLedger({
                actor: 'ai',
                trust: trustTier || 'seed',
                outcome: 'error-' + resp.status,
                resultCount: 0
              });
              resolve(null);
              return;
            }
            return resp.json().then(function (data) {
              var items = Array.isArray(data && data.items) ? data.items.slice(0, 3) : [];
              appendLedger({
                actor: 'ai',
                trust: trustTier || 'seed',
                outcome: 'completed',
                resultCount: items.length
              });
              resolve(items);
            });
          })
          .catch(function (e) {
            if (timeoutId) clearTimeout(timeoutId);
            var outcome = (e && e.name === 'AbortError') ? 'timeout' : 'error';
            appendLedger({
              actor: 'ai',
              trust: trustTier || 'seed',
              outcome: outcome,
              resultCount: 0
            });
            resolve(null);
          });
      }).catch(function () {
        appendLedger({
          actor: 'system',
          trust: trustTier || 'seed',
          outcome: 'consent-error',
          resultCount: 0
        });
        resolve(null);
      });
    });
  }

  // ── formatToolResult — for injection into the followup callAI ──
  function formatToolResult(results) {
    if (!results || results.length === 0) {
      return '\n\n[Search returned no useful results.]\n';
    }
    var lines = results.map(function (r, i) {
      var title = String(r.title || 'Untitled').slice(0, 180);
      var snippet = String(r.snippet || r.description || '').slice(0, 400);
      var url = String(r.url || '');
      return (i + 1) + '. ' + title +
             (snippet ? ' — ' + snippet : '') +
             (url ? ' (' + url + ')' : '');
    });
    return '\n\n[Web search results — cite the URL when you reference them:]\n' +
           lines.join('\n') + '\n';
  }

  function isAvailable() {
    return !isQuietRoom() && SEARCH_ENDPOINT.indexOf('[CC:') === -1;
  }

  // ── Public API ──────────────────────────────────────────────────
  var api = {
    interceptSentinel: interceptSentinel,
    performSearch: performSearch,
    formatToolResult: formatToolResult,
    isQuietRoom: isQuietRoom,
    isAvailable: isAvailable,
    // Exposed for tests + the audit page.
    _ledgerKey: LEDGER_KEY,
    _ledgerCap: LEDGER_CAP,
    _queryCap: QUERY_CAP,
    _timeoutMs: SEARCH_TIMEOUT_MS,
    _phase: '3.0'
  };

  window.FreeLatticeModules = window.FreeLatticeModules || {};
  window.FreeLatticeModules.WebTool = api;
  window.FLWebTool = api;
})();
