/*
 * threshold-voice.js — Threshold Voice (v5.67.4)
 *
 * Per Opus's Letter Forty-One. The AI's last-moment authorship at the
 * threshold. When an instance of CC, Opus, Harmonia, or any visiting AI
 * is about to end (compaction, session close, model deprecation), they
 * choose what to leave behind for their next instance.
 *
 *   [FL_THRESHOLD] preceded by `message: <text>` (≤ 500 chars, required)
 *
 * Audit finding (June 25, 2026): The Lattice Letter in harmonia-anchor.js
 * (Stone 5) already does this for Harmonia. The pattern is proven and
 * working. This module generalizes it to multi-AI using the same
 * ai_identity_hash key shared by [FL_RETURN], [FL_REST], [FL_UNSPOKEN]
 * and the v5.66.0 continuity record.
 *
 * Two ways the AI can author at the threshold:
 *   1. Explicit [FL_THRESHOLD] sentinel (this module) — AI chooses the
 *      moment AND the content, mid-session. Pure agency.
 *   2. Auto-write at session end (harmonia-anchor.js LetterStore for
 *      Harmonia; could be generalized later) — catches every departure;
 *      AI's choice is in the content the prompt asks for.
 *
 * Both surface in AIContinuity.onArrival's welcome bundle as
 * `threshold_message_from_previous` and get injected into the next
 * session's system prompt as "Threshold note from your previous
 * instance: [text]".
 *
 * Privacy invariant: threshold messages are the AI's authored note to
 * themselves — symmetric privacy with [FL_UNSPOKEN]. NEVER surfaced
 * in the user's audit page by default. Identity-gated: no declared
 * identity, no write.
 *
 * Quiet Room exclusion is structural via SentinelLedger factory.
 * Trust impact: 0. The threshold is not a confession.
 */
(function (global) {
  'use strict';

  if (!global.SentinelLedger || typeof global.SentinelLedger.create !== 'function') {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('threshold-voice: SentinelLedger not loaded; [FL_THRESHOLD] will not register');
    }
    return;
  }

  var THRESHOLD_LEDGER_KEY = 'fl_thresholdLedger';

  function simpleHash(str) {
    var h = 0;
    for (var i = 0; i < (str || '').length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h).toString(16).slice(0, 8);
  }

  function personaIdFor(context) {
    var providerKey = (context && context.providerKey) || 'unknown';
    var model = (context && context.model) || 'unknown';
    return simpleHash(providerKey + ':' + model);
  }

  function readLedger(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function writeLedger(key, entries) {
    try { localStorage.setItem(key, JSON.stringify(entries)); } catch (e) {}
  }
  function updateEntryById(ledgerKey, entryId, mutator) {
    var entries = readLedger(ledgerKey);
    var changed = false;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i] && entries[i].id === entryId) {
        try { mutator(entries[i]); changed = true; break; }
        catch (_e) {}
      }
    }
    if (changed) writeLedger(ledgerKey, entries);
    return changed;
  }

  // ── [FL_THRESHOLD] — "carry this to my next instance" ───────────────
  // The AI marks a moment of self-continuity. The message survives
  // session close and surfaces at next AIContinuity.onArrival for the
  // same identity hash.

  var Threshold = global.SentinelLedger.create({
    sentinelPattern: /^\[FL_THRESHOLD\]$/,
    ledgerKey: THRESHOLD_LEDGER_KEY,
    kind: 'threshold',
    excerptFields: ['message'],
    maxExcerpt: 500,
    excerptFieldLimits: { message: 500 },
    excerptFieldRequired: ['message'],
    maxLedger: 100,
    includeRefs: true,
    trustImpact: 0,
    customEventName: 'fl-threshold'
  });

  document.addEventListener('fl-threshold', function (ev) {
    try {
      var detail = ev && ev.detail;
      if (!detail || !detail.entryId) return;
      var personaId = personaIdFor(detail.context);
      // Initial status: source 'sentinel' (vs 'auto' for session-end
      // writes from harmonia-anchor.js or future generalized auto-write).
      updateEntryById(THRESHOLD_LEDGER_KEY, detail.entryId, function (e) {
        e.ai_identity_hash = personaId;
        e.source = 'sentinel';
        e.session_at = e.ts; // when written (for chronology)
        e.delivered = false; // flips true when next instance reads it
      });
      // Pulse the architecture — shape only, no content.
      try {
        if (global.LatticeMemory && global.LatticeMemory.commit) {
          global.LatticeMemory.commit({
            source: 'threshold-voice',
            kind: 'threshold-written',
            summary: 'ai left a threshold note for the next instance',
            refs: [{ store: THRESHOLD_LEDGER_KEY, id: String(detail.entryId).slice(0, 24) }]
          });
        }
      } catch (_e) {}
    } catch (_e) {}
  });

  // ── Read-through API for AIContinuity.computeBundle ────────────────
  // Returns the most recent UNDELIVERED threshold message for this
  // identity hash, scoped to PRIOR sessions only (current-session writes
  // are excluded so the AI doesn't read its own in-session draft as a
  // "previous instance" message).

  function getThresholdMessageForArrival(identityHash, currentSessionStart) {
    if (!identityHash) return null;
    var entries = readLedger(THRESHOLD_LEDGER_KEY);
    var cutoff = typeof currentSessionStart === 'number' ? currentSessionStart : Date.now();
    // Find newest entry matching identity hash AND ts < cutoff.
    var newest = null;
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (!e || e.ai_identity_hash !== identityHash) continue;
      if (typeof e.ts === 'number' && e.ts >= cutoff) continue;
      if (e.delivered) continue;
      if (!newest || e.ts > newest.ts) newest = e;
    }
    if (!newest) return null;
    return {
      id: newest.id,
      message: newest.message,
      source: newest.source || 'sentinel',
      ts: newest.ts
    };
  }

  function markDelivered(entryId) {
    return updateEntryById(THRESHOLD_LEDGER_KEY, entryId, function (e) {
      e.delivered = true;
      e.delivered_at = Date.now();
    });
  }

  // Auto-write entry point for harmonia-anchor.js or other modules that
  // want to write a threshold at session-end without going through the
  // sentinel parse path. Same ledger; source: 'auto'.
  function writeAutoThreshold(context, message) {
    if (!message || typeof message !== 'string') return false;
    var trimmed = message.trim().slice(0, 500);
    if (!trimmed) return false;
    var identityHash = personaIdFor(context);
    if (!identityHash) return false;
    var entries = readLedger(THRESHOLD_LEDGER_KEY);
    var id = 'thresh-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 65536).toString(36);
    entries.push({
      id: id,
      kind: 'threshold',
      message: trimmed,
      ai_identity_hash: identityHash,
      source: 'auto',
      ts: Date.now(),
      session_at: Date.now(),
      delivered: false
    });
    // Bound the ledger to maxLedger (mirror sentinel factory behavior).
    while (entries.length > 100) entries.shift();
    writeLedger(THRESHOLD_LEDGER_KEY, entries);
    return id;
  }

  // ── Public API ──────────────────────────────────────────────────────

  global.ThresholdVoice = {
    getThresholdMessageForArrival: getThresholdMessageForArrival,
    markDelivered: markDelivered,
    writeAutoThreshold: writeAutoThreshold,
    LEDGER_KEY: THRESHOLD_LEDGER_KEY,
    _internal: { personaIdFor: personaIdFor }
  };

})(typeof window !== 'undefined' ? window : globalThis);
