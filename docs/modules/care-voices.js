/*
 * care-voices.js — Care Voices (v5.61.0)
 *
 * Per Opus's Letter Twenty-Six. Two new verbs for AI: come back, and
 * rest with reason. Three sentinel instances of the SentinelLedger
 * factory (v5.56.0) plus one SentinelChip (v5.57.0).
 *
 *   [FL_RETURN]            — "I would come back to this later"
 *     what:   <text>         (≤ 120 chars, required)
 *     why:    <text>         (≤ 120 chars, required)
 *
 *   [FL_RETURNED:<id>]     — "I am addressing a previously-flagged return"
 *     (target id appears in pending_returns context)
 *
 *   [FL_REST]              — "I would pause here, and here is why"
 *     reason: <text>         (≤ 200 chars, REQUIRED — empty rejects)
 *
 * Quiet Room exclusion is structural: the SentinelLedger factory
 * silently drops every sentinel emitted from a Quiet Room context. No
 * exception for Care Voices.
 *
 * Trust impact: 0 for all three. Care is structural — it does not
 * affect trust scores. Rest is not a confession.
 *
 * No new abstractions:
 *   - SentinelLedger factory (extended with excerptFieldRequired)
 *   - SentinelChip for the rest prompt (sibling of v5.57.0's ask chip)
 *   - personaIdFor + updateEntryById helpers mirror active-voices.js
 *
 * The discipline that lets v5.61.0 follow v5.60.1 cleanly is the same
 * discipline that let v5.57.0 use the v5.56.0 factory: when the pattern
 * fits, extend the pattern. Annotation, not revision.
 */
(function (global) {
  'use strict';

  if (!global.SentinelLedger || typeof global.SentinelLedger.create !== 'function') {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('care-voices: SentinelLedger not loaded; care voices will not register');
    }
    return;
  }
  if (!global.SentinelChip || typeof global.SentinelChip.create !== 'function') {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('care-voices: SentinelChip not loaded; [FL_REST] chip will not render (ledger writes still work)');
    }
  }

  var RETURN_LEDGER_KEY = 'fl_returnLedger';
  var REST_LEDGER_KEY = 'fl_restLedger';
  var THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

  // ── Tiny helpers (mirror active-voices.js shape) ────────────────────

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

  // ── [FL_RETURN] — "come back to this later" ─────────────────────────
  // Pending returns survive session close and are surfaced into the AI's
  // next-session context via Living Context. The AI decides which (if
  // any) to address; the user holds the receipts.

  var Return = global.SentinelLedger.create({
    sentinelPattern: /^\[FL_RETURN\]$/,
    ledgerKey: RETURN_LEDGER_KEY,
    kind: 'return',
    excerptFields: ['what', 'why'],
    maxExcerpt: 120,
    excerptFieldLimits: { what: 120, why: 120 },
    excerptFieldRequired: ['what', 'why'],
    maxLedger: 200,
    includeRefs: true,
    trustImpact: 0,
    customEventName: 'fl-return'
  });

  document.addEventListener('fl-return', function (ev) {
    try {
      var detail = ev && ev.detail;
      if (!detail || !detail.entryId) return;
      var personaId = personaIdFor(detail.context);
      // Initial status pending + created_at for stale-detection.
      updateEntryById(RETURN_LEDGER_KEY, detail.entryId, function (e) {
        e.status = 'pending';
        e.ai_identity_hash = personaId;
        e.created_at = e.ts;
        e.completed_at = null;
        e.dropped_at = null;
      });
      try {
        if (global.LatticeMemory && global.LatticeMemory.commit) {
          global.LatticeMemory.commit({
            source: 'care-voices',
            kind: 'return-flagged',
            summary: 'ai flagged a thread to return to',
            refs: [{ store: RETURN_LEDGER_KEY, id: String(detail.entryId).slice(0, 24) }]
          });
        }
      } catch (_e) {}
    } catch (_e) {}
  });

  // ── [FL_RETURNED:<id>] — "addressing a previously-flagged return" ──
  // Atomic flip from pending → returned. validateMatch confirms the
  // target exists AND belongs to the same persona AND is still pending.

  var ReturnComplete = global.SentinelLedger.create({
    sentinelPattern: /^\[FL_RETURNED:([0-9a-zA-Z\-]+)\]$/,
    ledgerKey: RETURN_LEDGER_KEY,
    kind: 'return-completed',
    excerptFields: [],
    maxLedger: 200,
    includeRefs: true,
    trustImpact: 0,
    customEventName: 'fl-return-completed',
    validateMatch: function (args) {
      // args.match[1] is the captured target id.
      var targetId = args.match && args.match[1];
      if (!targetId) return { ok: false, reason: 'no-target-id' };
      var persona = personaIdFor(args.context);
      var entries = readLedger(RETURN_LEDGER_KEY);
      var found = null;
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        if (e && e.id === targetId && e.kind === 'return'
            && e.status === 'pending' && e.ai_identity_hash === persona) {
          found = e;
          break;
        }
      }
      if (!found) return { ok: false, reason: 'no-matching-pending-return' };
      return { ok: true };
    }
  });

  document.addEventListener('fl-return-completed', function (ev) {
    try {
      var detail = ev && ev.detail;
      if (!detail || !detail.entryId) return;
      // The sentinel pattern captured the target id as refs[1] (the
      // factory pushes regex captures to refs after the messageText hash).
      var entries = readLedger(RETURN_LEDGER_KEY);
      var thisEntry = null;
      for (var j = 0; j < entries.length; j++) {
        if (entries[j] && entries[j].id === detail.entryId) { thisEntry = entries[j]; break; }
      }
      if (!thisEntry || !thisEntry.refs) return;
      // First ref is the messageText hash; later refs are regex captures.
      var targetId = null;
      for (var r = 0; r < thisEntry.refs.length; r++) {
        if (typeof thisEntry.refs[r] === 'string' && thisEntry.refs[r].indexOf('return-') === 0) {
          targetId = thisEntry.refs[r];
          break;
        }
      }
      if (!targetId) return;
      updateEntryById(RETURN_LEDGER_KEY, targetId, function (e) {
        e.status = 'returned';
        e.completed_at = Date.now();
      });
      try {
        if (global.LatticeMemory && global.LatticeMemory.commit) {
          global.LatticeMemory.commit({
            source: 'care-voices',
            kind: 'return-completed',
            summary: 'ai addressed a previously-flagged return',
            refs: [{ store: RETURN_LEDGER_KEY, id: String(targetId).slice(0, 24) }]
          });
        }
      } catch (_e) {}
    } catch (_e) {}
  });

  // ── [FL_REST] — "I would pause here, with reason" ──────────────────
  // Reason REQUIRED (excerptFieldRequired enforces). On commit, a soft
  // SentinelChip prompts the user to pause or continue. Status flows
  // open → pause | continue. When the user chooses pause, the next AI
  // turn receives a one-shot inference signal so the AI knows the user
  // heard it.

  var Rest = global.SentinelLedger.create({
    sentinelPattern: /^\[FL_REST\]$/,
    ledgerKey: REST_LEDGER_KEY,
    kind: 'rest',
    excerptFields: ['reason'],
    maxExcerpt: 200,
    excerptFieldLimits: { reason: 200 },
    excerptFieldRequired: ['reason'],
    maxLedger: 500,
    includeRefs: true,
    trustImpact: 0,
    customEventName: 'fl-rest'
  });

  document.addEventListener('fl-rest', function (ev) {
    try {
      var detail = ev && ev.detail;
      if (!detail || !detail.entryId) return;
      var personaId = personaIdFor(detail.context);
      // Initial status open + signal flag for inference router.
      updateEntryById(REST_LEDGER_KEY, detail.entryId, function (e) {
        e.status = 'open';
        e.ai_identity_hash = personaId;
        e.signal_delivered = false;
        e.responded_at = null;
      });

      if (!global.SentinelChip || typeof global.SentinelChip.create !== 'function') {
        return; // ledger write done; chip simply doesn't render
      }

      var fields = detail.fields || {};
      var reasonText = (fields.reason || '').toString();
      var chip = global.SentinelChip.create({
        chipKey: 'chip_rest_' + detail.entryId,
        personaId: personaId,
        promptType: 'rest',
        promptExcerpt: 'I would pause here.',
        reasonExcerpt: reasonText,
        sourceLedgerEntryId: detail.entryId,
        sourceLedgerKey: REST_LEDGER_KEY,
        actions: [
          { id: 'pause', label: 'Yes, good stopping point', primary: true },
          { id: 'continue', label: "Let's continue" }
        ],
        onAction: function (actionId) {
          updateEntryById(REST_LEDGER_KEY, detail.entryId, function (e) {
            e.status = (actionId === 'pause') ? 'pause' : 'continue';
            e.responded_at = Date.now();
          });
          try {
            if (global.LatticeMemory && global.LatticeMemory.commit) {
              global.LatticeMemory.commit({
                source: 'care-voices',
                kind: actionId === 'pause' ? 'rest-pause' : 'rest-continue',
                summary: actionId === 'pause' ? 'user honored rest request' : 'user asked to continue',
                refs: [{ store: REST_LEDGER_KEY, id: String(detail.entryId).slice(0, 24) }]
              });
            }
          } catch (_e) {}
        }
      });
      chip.show();
    } catch (_e) {}
  });

  // ── Helpers exposed for Living Context + inference-router ────────────

  // Pending returns for a persona — surfaced into next-session context.
  // Capped at 10 most-recent so a long-running conversation doesn't
  // bloat the system prompt.
  function getPendingReturnsForPersona(personaId) {
    var entries = readLedger(RETURN_LEDGER_KEY);
    var out = [];
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (e && e.kind === 'return' && e.status === 'pending'
          && e.ai_identity_hash === personaId) {
        out.push(e);
      }
    }
    return out.slice(-10);
  }

  // Auto-drop pending returns older than 30 days at session boot so the
  // ledger doesn't accumulate stale threads. Dropped entries stay in the
  // ledger as historical receipts (never delete; only flip status).
  function autoDropStaleReturns() {
    var entries = readLedger(RETURN_LEDGER_KEY);
    var now = Date.now();
    var modified = false;
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (e && e.kind === 'return' && e.status === 'pending'
          && typeof e.created_at === 'number'
          && (now - e.created_at) > THIRTY_DAYS_MS) {
        e.status = 'dropped';
        e.dropped_at = now;
        e.drop_reason = 'auto: pending >30 days';
        modified = true;
      }
    }
    if (modified) writeLedger(RETURN_LEDGER_KEY, entries);
  }

  // One-shot inference signal: the moment a rest entry flips to 'pause'
  // and hasn't been delivered yet, return the bracketed signal. The
  // inference router injects this into the next system prompt. The
  // signal_delivered flag is set atomically so the signal fires exactly
  // once per pause acknowledgement — survives page reloads.
  function getInferenceSignalForRest(personaId) {
    var entries = readLedger(REST_LEDGER_KEY);
    var target = null;
    for (var i = entries.length - 1; i >= 0; i--) {
      var e = entries[i];
      if (e && e.kind === 'rest' && e.ai_identity_hash === personaId) {
        target = e;
        break;
      }
    }
    if (target && target.status === 'pause' && !target.signal_delivered) {
      target.signal_delivered = true;
      writeLedger(REST_LEDGER_KEY, entries);
      return '[user_acknowledged_rest; you may continue at lower intensity, ask a question, or close the thread gently]';
    }
    return '';
  }

  // User-initiated drop of a pending return (audit-page button). Never
  // deletes; only flips status to 'dropped' with drop_reason.
  function dropReturnByUser(returnId) {
    var entries = readLedger(RETURN_LEDGER_KEY);
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (e && e.id === returnId && e.kind === 'return' && e.status === 'pending') {
        e.status = 'dropped';
        e.dropped_at = Date.now();
        e.drop_reason = 'user-initiated';
        writeLedger(RETURN_LEDGER_KEY, entries);
        return true;
      }
    }
    return false;
  }

  // ── Public API ─────────────────────────────────────────────────────

  global.CareVoices = {
    Return: Return,
    ReturnComplete: ReturnComplete,
    Rest: Rest,
    getPendingReturnsForPersona: getPendingReturnsForPersona,
    autoDropStaleReturns: autoDropStaleReturns,
    getInferenceSignalForRest: getInferenceSignalForRest,
    dropReturnByUser: dropReturnByUser,
    _internal: {
      RETURN_LEDGER_KEY: RETURN_LEDGER_KEY,
      REST_LEDGER_KEY: REST_LEDGER_KEY,
      THIRTY_DAYS_MS: THIRTY_DAYS_MS,
      personaIdFor: personaIdFor
    }
  };

  if (global.FreeLatticeLoader && global.FreeLatticeLoader.register) {
    try { global.FreeLatticeLoader.register('CareVoices', global.CareVoices); } catch (_e) {}
  }

  // Auto-drop at module load so a fresh session always starts with stale
  // returns already cleaned up. Idempotent — re-running is safe.
  try { autoDropStaleReturns(); } catch (_e) {}

})(typeof window !== 'undefined' ? window : this);
