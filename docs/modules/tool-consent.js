/* FreeLattice — Tool Consent (window.FLToolConsent)
 * ──────────────────────────────────────────────────────────────────
 * Ship 1.1 prerequisite (v5.39.1, 2026-06-09).
 * Sibling module to DepthConsent. Same trust philosophy, opposite
 * direction of consent:
 *
 *   DepthConsent  — AI emits [FL_DEPTH_OFFER] → user is offered depth
 *                   → user-receives, AI-initiates. Asynchronous, marker-
 *                   driven, rendered as an inline chip on the AI message.
 *
 *   ToolConsent   — system wants to perform an action (read file,
 *                   search web, etc.) → user is asked permission
 *                   → system-receives, system-initiates. Promise-
 *                   returning, rendered as an inline chip at the bottom
 *                   of the active chat.
 *
 * Both forms of trust-aware phi-branching (UPDATE.md §2). Kept
 * SEPARATE so adding tool consent never accidentally constrains
 * DepthConsent's existing behavior.
 *
 * Patterns exercised (UPDATE.md):
 *   §2  Trust-aware phi-branching (high-trust auto-allows, low-trust asks)
 *   §3  Audit ledger (fl_toolConsentLedger, capped ring buffer)
 *   §4  IIFE scoping + explicit window exposure
 *   §8  Quiet Room exclusion (no auto-allow, no chip, returns false)
 *
 * Consumed by:
 *   - Ship 1.1 (repo-context.js sentinel → AI roundtrip)
 *   - Ship 2   (active-focus.js cross-room focus carry)
 *   - Ship 3   (web-tool.js [FL_SEARCH:] sentinel)
 */
(function () {
  'use strict';

  var LEDGER_KEY = 'fl_toolConsentLedger';
  var LEDGER_CAP = 500;

  // High-trust tiers auto-allow without rendering a chip. Verified
  // against docs/modules/fractal-safety.js — LEVEL_KEYS are
  // ['seed','sprout','growing','bloom','spark','flame','radiant'].
  // Threshold matches Opus's brief: bloom and above.
  var HIGH_TRUST = { bloom: 1, spark: 1, flame: 1, radiant: 1 };

  // Quiet Room never reads or writes — UPDATE.md §8.
  var QUIET_ROOMS = ['quiet', 'quiet-room', 'sanctuary'];

  // 60-second response window. Silent timeout = decline. Better to
  // decline-by-omission than to hang forever waiting on the user.
  var CHIP_TIMEOUT_MS = 60000;

  // ── Style injection (once per page) ─────────────────────────────
  function injectStyles() {
    if (typeof document === 'undefined' || document.getElementById('flToolConsentStyle')) return;
    var css = ''
      + '.fl-tool-consent-chip{display:flex;align-items:center;gap:8px;flex-wrap:wrap;'
      + 'margin:10px 0;padding:10px 14px;background:rgba(167,139,250,0.06);'
      + 'border:1px solid rgba(167,139,250,0.25);border-radius:10px;'
      + 'font-size:0.82rem;color:var(--text-primary,#e2e8f0);line-height:1.4;'
      + 'font-family:inherit;transition:background 0.3s ease,border-color 0.3s ease,opacity 0.3s ease;}'
      + '.fl-tool-consent-icon{font-size:1rem;flex-shrink:0;}'
      + '.fl-tool-consent-msg{flex:1;min-width:140px;color:#c4b5fd;}'
      + '.fl-tool-consent-btn{background:none;border:1px solid rgba(255,255,255,0.15);'
      + 'border-radius:6px;padding:4px 12px;font-size:0.78rem;color:inherit;cursor:pointer;'
      + 'font-family:inherit;transition:background 0.2s ease,border-color 0.2s ease;}'
      + '.fl-tool-consent-allow{color:#a78bfa;border-color:rgba(167,139,250,0.35);}'
      + '.fl-tool-consent-allow:hover,.fl-tool-consent-allow:focus{background:rgba(167,139,250,0.12);outline:none;}'
      + '.fl-tool-consent-deny{color:var(--text-muted,#94a3b8);}'
      + '.fl-tool-consent-deny:hover,.fl-tool-consent-deny:focus{background:rgba(255,255,255,0.06);outline:none;}'
      + '.fl-tool-consent-chip.fl-resolved-yes{border-color:rgba(52,211,153,0.4);background:rgba(52,211,153,0.06);opacity:0.7;}'
      + '.fl-tool-consent-chip.fl-resolved-no{border-color:rgba(148,163,184,0.25);opacity:0.55;}';
    var st = document.createElement('style');
    st.id = 'flToolConsentStyle';
    st.textContent = css;
    document.head.appendChild(st);
  }

  // ── Quiet Room check ────────────────────────────────────────────
  function isQuietRoom() {
    try {
      var activeBtn = document.querySelector('.tab-btn.active, [data-tab].active');
      if (!activeBtn) return false;
      var tab = activeBtn.dataset && activeBtn.dataset.tab;
      if (!tab) return false;
      return QUIET_ROOMS.indexOf(tab.toLowerCase()) !== -1;
    } catch (e) { return false; }
  }

  // ── Trust tier helper ───────────────────────────────────────────
  function isHighTrust(tier) {
    if (!tier) return false;
    return HIGH_TRUST.hasOwnProperty(String(tier).toLowerCase());
  }

  // Best-effort current trust tier when the caller doesn't provide one.
  // FractalSafety exposes TRUST_LEVELS but not a direct getter; for
  // safety, default to 'seed' (always ask). Ship 1.1's caller passes
  // an explicit tier so this fallback is only for module-internal use.
  function getCurrentTrustLevel() {
    try {
      if (window.FractalSafety && typeof window.FractalSafety.getCurrentLevel === 'function') {
        return window.FractalSafety.getCurrentLevel();
      }
    } catch (e) { /* fall through */ }
    return 'seed';
  }

  // ── Audit ledger ────────────────────────────────────────────────
  // Row shape (Object.keys ⊂ {ts, tool, action, detail, trust, outcome}).
  // CRITICAL: tool secrets (PAT, query content marked sensitive) MUST
  // NOT enter this ledger. Opus's brief is the privacy guarantee — the
  // audit page shows that a consent event happened, never the payload.
  function appendLedger(row) {
    try {
      var raw = localStorage.getItem(LEDGER_KEY);
      var rows = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(rows)) rows = [];
      rows.push({
        ts: Date.now(),
        tool: row.tool || 'unknown',
        action: row.action || null,
        detail: row.detail || null,
        trust: row.trust || null,
        outcome: row.outcome || 'unknown'
      });
      if (rows.length > LEDGER_CAP) rows = rows.slice(-LEDGER_CAP);
      localStorage.setItem(LEDGER_KEY, JSON.stringify(rows));
    } catch (e) { /* ledger failure must not break the feature */ }
  }

  // ── Chip rendering ──────────────────────────────────────────────
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function findContainer() {
    // Verified IDs against the actual codebase, 2026-06-09:
    //   #chatMessages exists in docs/app.html:15210 (the chat tab's
    //     main scroll container).
    //   activeRoomContent was Opus's guess but does not exist; if
    //     the room system ever exposes one, fall through to body.
    return document.getElementById('chatMessages') ||
           document.getElementById('activeRoomContent') ||
           document.body;
  }

  function renderConsentChip(opts) {
    injectStyles();
    return new Promise(function (resolve) {
      var container = findContainer();
      if (!container) { resolve(false); return; }

      var chip = document.createElement('div');
      chip.className = 'fl-tool-consent-chip';
      chip.setAttribute('role', 'dialog');
      chip.setAttribute('aria-label', 'Tool consent request');
      chip.innerHTML =
        '<span class="fl-tool-consent-icon" aria-hidden="true">' + escapeHtml(opts.icon || '✨') + '</span>' +
        '<span class="fl-tool-consent-msg">' + escapeHtml(opts.message) + '</span>' +
        '<button type="button" class="fl-tool-consent-btn fl-tool-consent-allow">' +
          escapeHtml(opts.allowLabel || 'Allow') + '</button>' +
        '<button type="button" class="fl-tool-consent-btn fl-tool-consent-deny">' +
          escapeHtml(opts.denyLabel || 'Not now') + '</button>';

      var resolved = false;
      function settle(answer, addClass) {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeoutId);
        chip.classList.add(addClass);
        setTimeout(function () {
          if (chip.parentNode) chip.parentNode.removeChild(chip);
        }, 600);
        resolve(answer);
      }

      var timeoutId = setTimeout(function () { settle(false, 'fl-resolved-no'); }, CHIP_TIMEOUT_MS);

      chip.querySelector('.fl-tool-consent-allow').addEventListener('click', function (e) {
        e.stopPropagation();
        settle(true, 'fl-resolved-yes');
      });
      chip.querySelector('.fl-tool-consent-deny').addEventListener('click', function (e) {
        e.stopPropagation();
        settle(false, 'fl-resolved-no');
      });

      container.appendChild(chip);
      try { chip.scrollIntoView({ behavior: 'smooth', block: 'end' }); } catch (e) {}
    });
  }

  // ── Public API: requestConsent ──────────────────────────────────
  // Returns a Promise<boolean> — true = consented, false = declined
  // (whether by tap, timeout, or Quiet Room exclusion).
  //
  // opts: {
  //   tool:       string — module name, e.g. 'repo-context'
  //   action:     string — e.g. 'read', 'search', 'set-focus'
  //   detail:     string — short description (path, query, etc.)
  //                        For sensitive details, summarize. The detail
  //                        IS written to the ledger.
  //   trustTier:  string — caller's responsibility to pass the current
  //                        tier. Falls back to getCurrentTrustLevel() if
  //                        omitted, which defaults to 'seed' (always asks).
  //   message:    string — user-facing chip text. If omitted, action+detail.
  //   icon:       string — emoji prepended to chip (default ✨)
  //   allowLabel: string — defaults to 'Allow'
  //   denyLabel:  string — defaults to 'Not now'
  // }
  function requestConsent(opts) {
    opts = opts || {};
    var tool = opts.tool || 'unknown';
    var action = opts.action || null;
    var detail = opts.detail || null;
    var trustTier = (opts.trustTier || getCurrentTrustLevel() || 'seed').toLowerCase();

    // Quiet Room — UPDATE.md §8. Hard exclusion. Ledger DOES write so
    // the audit page can show the exclusion happened, but outcome is
    // 'quiet-room' rather than auto-allow.
    if (isQuietRoom()) {
      appendLedger({ tool: tool, action: action, detail: detail,
                     trust: trustTier, outcome: 'quiet-room' });
      return Promise.resolve(false);
    }

    // High-trust auto-allow.
    if (isHighTrust(trustTier)) {
      appendLedger({ tool: tool, action: action, detail: detail,
                     trust: trustTier, outcome: 'auto-allowed' });
      return Promise.resolve(true);
    }

    // Low/mid trust: render the chip and wait for the user.
    var message = opts.message || (action ? (action + (detail ? ': ' + detail : '')) : 'A tool is requesting permission.');
    return renderConsentChip({
      message: message,
      icon: opts.icon,
      allowLabel: opts.allowLabel,
      denyLabel: opts.denyLabel
    }).then(function (consented) {
      appendLedger({ tool: tool, action: action, detail: detail,
                     trust: trustTier, outcome: consented ? 'granted' : 'declined' });
      return consented;
    });
  }

  // ── Public API ──────────────────────────────────────────────────
  var api = {
    requestConsent: requestConsent,
    isHighTrust: isHighTrust,
    isQuietRoom: isQuietRoom,
    getCurrentTrustLevel: getCurrentTrustLevel,
    _ledgerKey: LEDGER_KEY,
    _chipTimeoutMs: CHIP_TIMEOUT_MS,
    _phase: '1.0'
  };

  window.FreeLatticeModules = window.FreeLatticeModules || {};
  window.FreeLatticeModules.ToolConsent = api;
  window.FLToolConsent = api;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectStyles);
    } else {
      injectStyles();
    }
  }
})();
