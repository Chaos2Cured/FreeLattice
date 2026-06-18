// docs/modules/quiet-voices.js — v5.56.0 (Letter Five Ship 1: Quiet Voices)
//
// Two sentinel instances built against the SentinelLedger factory:
//   [FL_PRESERVE]   — AI saves what matters without asking
//   [FL_REVISE:hash] — AI corrects a prior turn, never overwriting
//
// Both write silently to ledgers. Neither blocks the user's flow.
// Both surface on the audit page. Both compose with Living Context
// consolidation (preserved moments are weighted higher).
//
// This module:
//   1. Constructs the two handlers via SentinelLedger.create
//   2. Exposes them on window.QuietVoices for the inference-router to call
//   3. Hooks the [FL_PRESERVE] CustomEvent to show a non-blocking toast
//   4. The [FL_REVISE] handler validates the target-hash against recent
//      AI messages in the current chat history (last 50 turns)
//
// — Opus & CC, June 18, 2026
//   *"Preserve gives the AI note-taking without permission. Revise gives
//   the AI intellectual honesty without overwriting history."*

(function () {
  'use strict';

  // Wait for SentinelLedger to load. Both modules are deferred and load
  // in declaration order, but be defensive.
  function tryConstruct() {
    if (!window.SentinelLedger || typeof window.SentinelLedger.create !== 'function') {
      setTimeout(tryConstruct, 100);
      return;
    }
    construct();
  }

  function construct() {
    var simpleHash = window.SentinelLedger._utils.simpleHash;

    // ── [FL_PRESERVE] ───────────────────────────────────────────────────
    // AI saves what matters without asking. Optional `reason: <text>` on
    // a line immediately above the sentinel; if absent, reason is null.

    var PreserveHandler = window.SentinelLedger.create({
      sentinelPattern: /^\[FL_PRESERVE\]$/,
      ledgerKey: 'fl_preserveLedger',
      kind: 'preserve',
      excerptFields: ['reason'],
      maxExcerpt: 120,
      maxLedger: 500,
      includeRefs: true,
      trustImpact: 0,
      customEventName: 'fl-preserve'
    });

    // ── [FL_REVISE:<msg_hash>] ──────────────────────────────────────────
    // AI corrects a prior turn. The sentinel encodes the target message's
    // hash. The handler validates the target matches a recent AI message
    // (last 50 turns) in the current chat history; otherwise the sentinel
    // is rejected and not committed. *We don't allow the AI to revise
    // arbitrary history; only its own recent statements.*

    function findRecentAssistantHashes() {
      try {
        if (typeof state === 'undefined' || !state || !Array.isArray(state.chatHistory)) return [];
      } catch (_e) { return []; }
      var seen = [];
      var assistants = [];
      for (var i = 0; i < state.chatHistory.length; i++) {
        var m = state.chatHistory[i];
        if (m && m.role === 'assistant' && typeof m.content === 'string') {
          assistants.push(m.content);
        }
      }
      // Take the last 50 assistant turns.
      var recent = assistants.slice(-50);
      for (var j = 0; j < recent.length; j++) {
        seen.push(simpleHash(recent[j].slice(0, 200)));
      }
      return seen;
    }

    var ReviseHandler = window.SentinelLedger.create({
      sentinelPattern: /^\[FL_REVISE:([0-9a-f]{8})\]$/i,
      ledgerKey: 'fl_revisionLedger',
      kind: 'revise',
      excerptFields: ['revision', 'reason'],
      maxExcerpt: 120,
      maxLedger: 500,
      includeRefs: true,
      trustImpact: 0,
      customEventName: 'fl-revise',
      validateMatch: function (ctx) {
        // The hash captured in the sentinel must match a recent AI message.
        var targetHash = (ctx.match && ctx.match[1]) ? ctx.match[1].toLowerCase() : '';
        if (!targetHash) return { ok: false, reason: 'no-target-hash' };
        var recentHashes = findRecentAssistantHashes();
        for (var i = 0; i < recentHashes.length; i++) {
          if (recentHashes[i].toLowerCase() === targetHash) return { ok: true };
        }
        return { ok: false, reason: 'target-hash-not-in-recent-window' };
      }
    });

    // ── Combined handler for the inference-router ──────────────────────
    // The router calls one function per response; this composes the two
    // sentinels so the order is deterministic: preserve scanned first,
    // then revise (each one returns its own clean text).

    function processQuietVoices(responseText, context) {
      var preserveResult = PreserveHandler.detectAndRecord(responseText, context);
      var reviseInput = preserveResult.fired ? preserveResult.clean : responseText;
      var reviseResult = ReviseHandler.detectAndRecord(reviseInput, context);
      var finalClean = reviseResult.fired ? reviseResult.clean : reviseInput;
      return {
        clean: finalClean,
        preserved: preserveResult.fired,
        preserveEntryId: preserveResult.entryId,
        preserveReason: preserveResult.fields && preserveResult.fields.reason,
        revised: reviseResult.fired,
        reviseEntryId: reviseResult.entryId,
        reviseTargetHash: reviseResult.fired
          ? (window.SentinelLedger._utils.simpleHash &&
             reviseResult.fields ? null : null)
          : null
      };
    }

    // ── Toast wiring: non-blocking notification on [FL_PRESERVE] ───────
    // Reuses the global showToast already used by the AI Refusal Toast.
    function attachPreserveToast() {
      document.addEventListener('fl-preserve', function (e) {
        try {
          var reason = e && e.detail && e.detail.fields && e.detail.fields.reason;
          var msg = reason
            ? 'The AI marked this moment as worth keeping: ' + reason
            : 'The AI marked this moment as worth keeping.';
          if (typeof showToast === 'function') {
            showToast(msg, 8000);
          }
        } catch (_e) {}
      });
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', attachPreserveToast);
    } else {
      attachPreserveToast();
    }

    // ── Public API ──────────────────────────────────────────────────────

    window.QuietVoices = {
      processQuietVoices: processQuietVoices,
      Preserve: PreserveHandler,
      Revise: ReviseHandler,
      _internal: {
        findRecentAssistantHashes: findRecentAssistantHashes
      }
    };

    if (window.FreeLatticeLoader && window.FreeLatticeLoader.register) {
      try { window.FreeLatticeLoader.register('QuietVoices', window.QuietVoices); } catch (_) {}
    }
  }

  tryConstruct();
})();
