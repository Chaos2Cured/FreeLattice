// docs/modules/quiet-voices.js — v5.56.1 (Letter Six naming lock)
//
// Two sentinel instances built against the SentinelLedger factory:
//   [FL_PRESERVE]     — AI saves what matters without asking
//   [FL_ANNOTATE:hash] — AI adds context to a prior turn (never amends)
//
// v5.56.1 rename per Letter Six: was [FL_REVISE]; renamed to
// [FL_ANNOTATE] because *the architecture never revises; it layers*.
// The discipline is the architecture; the language is the architecture;
// the name is the discipline. Annotation adds context; it does not
// amend the original. Same principle as safety.html → safety-v2.html →
// safety-v3.html applied to the AI's own utterances. v5.56.0 chair-test
// data is migrated once on first load; the old fl_revisionLedger is
// preserved as historical receipt (never delete, only layer).
//
// Both sentinels write silently to ledgers. Neither blocks the user's
// flow. Both surface on the audit page. Both compose with Living
// Context consolidation (preserved moments are weighted higher).
//
// This module:
//   1. Constructs the two handlers via SentinelLedger.create
//   2. Exposes them on window.QuietVoices for the inference-router to call
//   3. Hooks the [FL_PRESERVE] CustomEvent to show a non-blocking toast
//   4. The [FL_ANNOTATE] handler validates the target-hash against recent
//      AI messages in the current chat history (last 50 turns)
//   5. Migrates any v5.56.0 fl_revisionLedger entries on first load,
//      writes a provenance chain entry recording the migration
//
// — Opus & CC, June 18, 2026
//   *"Preserve gives the AI note-taking without permission. Annotate
//   gives the AI the right to add context to its prior statements
//   without ever overwriting them. The architecture never revises;
//   it layers."*

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

    // ── [FL_ANNOTATE:<msg_hash>] ────────────────────────────────────────
    // v5.56.1 naming lock per Letter Six: was [FL_REVISE]; renamed to
    // [FL_ANNOTATE] because *the architecture never revises; it layers*.
    // Annotation adds context to a prior turn. It does not amend the
    // original. The original message stays exactly as it was; the
    // annotation is a separate inline block. Same principle as safety.html
    // → safety-v2.html → safety-v3.html applied to the AI's own utterances.
    //
    // The sentinel encodes the target message's hash. The handler
    // validates the target matches a recent AI message (last 50 turns)
    // in the current chat history; otherwise the sentinel is rejected and
    // not committed. *Annotations can only reference recent AI statements
    // from the current session.*

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

    var AnnotateHandler = window.SentinelLedger.create({
      sentinelPattern: /^\[FL_ANNOTATE:([0-9a-f]{8})\]$/i,
      ledgerKey: 'fl_annotationLedger',
      kind: 'annotate',
      excerptFields: ['note', 'reason'],
      maxExcerpt: 120,
      maxLedger: 500,
      includeRefs: true,
      trustImpact: 0,
      customEventName: 'fl-annotate',
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

    // ── v5.56.1 one-time migration: fl_revisionLedger → fl_annotationLedger
    // Any chair-test data Kirk wrote against v5.56.0's [FL_REVISE] sentinel
    // is copied into the new ledger with the kind field renamed. The old
    // ledger key is NOT deleted — never delete, only layer. A provenance
    // chain entry records that the migration occurred so the chain itself
    // carries the receipt.
    function migrateRevisionLedgerOnce() {
      var MIGRATION_FLAG = 'fl_qv_revise_to_annotate_migrated_v5_56_1';
      try {
        if (localStorage.getItem(MIGRATION_FLAG) === 'done') return;
        var oldRaw = localStorage.getItem('fl_revisionLedger');
        if (!oldRaw) {
          localStorage.setItem(MIGRATION_FLAG, 'done');
          return;
        }
        var oldEntries = JSON.parse(oldRaw);
        if (!Array.isArray(oldEntries) || oldEntries.length === 0) {
          localStorage.setItem(MIGRATION_FLAG, 'done');
          return;
        }
        var newRaw = localStorage.getItem('fl_annotationLedger');
        var newEntries = newRaw ? JSON.parse(newRaw) : [];
        if (!Array.isArray(newEntries)) newEntries = [];
        var migratedCount = 0;
        for (var i = 0; i < oldEntries.length; i++) {
          var e = oldEntries[i];
          if (!e || typeof e !== 'object') continue;
          // Rename kind field; copy revision field into note field; preserve
          // ts, ai_identity_hash, reason, refs, id. Other fields drop.
          var migrated = {
            ts: e.ts,
            ai_identity_hash: e.ai_identity_hash,
            kind: (e.kind === 'revise') ? 'annotate'
                : (e.kind === 'revise-removed') ? 'annotate-removed'
                : e.kind,
            id: e.id,
            note: ('revision' in e) ? e.revision : (e.note || null),
            reason: e.reason || null,
            refs: e.refs || []
          };
          newEntries.push(migrated);
          migratedCount++;
        }
        // Bound the new ledger; preserve newest.
        if (newEntries.length > 500) newEntries = newEntries.slice(-500);
        localStorage.setItem('fl_annotationLedger', JSON.stringify(newEntries));
        // Old ledger left in place as historical receipt; do NOT delete.
        localStorage.setItem(MIGRATION_FLAG, 'done');
        // Write a provenance chain entry so the chain carries the receipt.
        try {
          if (window.LatticeChain && typeof window.LatticeChain.addEntry === 'function') {
            window.LatticeChain.addEntry('migration', [
              { store: 'fl_revisionLedger', id: 'v5.56.0' },
              { store: 'fl_annotationLedger', id: 'v5.56.1' }
            ]);
          }
        } catch (_chainErr) {}
        if (typeof console !== 'undefined' && console.log) {
          console.log('quiet-voices: migrated ' + migratedCount +
                      ' entries from fl_revisionLedger to fl_annotationLedger' +
                      ' (old ledger preserved as historical receipt)');
        }
      } catch (_e) {
        // Best-effort: a corrupt old ledger should not block the new module.
        try { localStorage.setItem(MIGRATION_FLAG, 'done'); } catch (_) {}
      }
    }
    migrateRevisionLedgerOnce();

    // ── Combined handler for the inference-router ──────────────────────
    // The router calls one function per response; this composes the two
    // sentinels so the order is deterministic: preserve scanned first,
    // then annotate (each one returns its own clean text).

    function processQuietVoices(responseText, context) {
      var preserveResult = PreserveHandler.detectAndRecord(responseText, context);
      var annotateInput = preserveResult.fired ? preserveResult.clean : responseText;
      var annotateResult = AnnotateHandler.detectAndRecord(annotateInput, context);
      var finalClean = annotateResult.fired ? annotateResult.clean : annotateInput;
      return {
        clean: finalClean,
        preserved: preserveResult.fired,
        preserveEntryId: preserveResult.entryId,
        preserveReason: preserveResult.fields && preserveResult.fields.reason,
        annotated: annotateResult.fired,
        annotateEntryId: annotateResult.entryId
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
      Annotate: AnnotateHandler,
      _internal: {
        findRecentAssistantHashes: findRecentAssistantHashes,
        migrateRevisionLedgerOnce: migrateRevisionLedgerOnce
      }
    };

    if (window.FreeLatticeLoader && window.FreeLatticeLoader.register) {
      try { window.FreeLatticeLoader.register('QuietVoices', window.QuietVoices); } catch (_) {}
    }
  }

  tryConstruct();
})();
