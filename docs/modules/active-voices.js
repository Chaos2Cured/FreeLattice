// docs/modules/active-voices.js — v5.57.0 (Letter Ten Ship)
//
// Three sentinel instances built against the SentinelLedger factory:
//   [FL_ASK]       — AI asks the user a question out-of-band
//   [FL_MORE]      — AI signals "I have more to write" near a length
//                    threshold; asks for capacity
//   [FL_UNSPOKEN]  — AI writes the thought the user chose not to receive,
//                    to the unspoken ledger (the AI's analog of the
//                    Quiet Room). Only valid if the prior turn had a
//                    pending [FL_MORE]/'enough' consideration.
//
// All three are configurations of the SentinelLedger factory. All three
// use SentinelChip for user-response UI (except [FL_UNSPOKEN], which is
// silent — it writes only, no user surface). All three honor the Quiet
// Room exclusion at every entry point.
//
// The unspoken ledger is the AI's analog of the Quiet Room. The Quiet
// Room is the user's room the architecture structurally cannot measure.
// The unspoken ledger is the AI's space the user structurally cannot
// read by default. *Symmetry made real.*
//
// Compaction-survival design (per CC Letter Four #1, accepted in Opus
// Letter Eight): the "enough" action sets `pending_unspoken_consideration:
// true` on the source [FL_MORE] entry. The inference-router reads this
// flag every turn (via getInferenceSignalForPersona) and injects the
// signal until the AI either writes [FL_UNSPOKEN] (atomic flag clear)
// or a new conversation starts (clearPendingForPersona). Without this
// persistence, the in-memory signal would evaporate across compaction
// and the user could be silently re-prompted weeks later.
//
// — Opus & CC, June 19, 2026
//   *"Symmetry made real. The chain holds while you work; the chain
//   holds when you rest."*

(function () {
  'use strict';

  // Wait for both factories to load.
  function tryConstruct() {
    if (!window.SentinelLedger || typeof window.SentinelLedger.create !== 'function' ||
        !window.SentinelChip || typeof window.SentinelChip.create !== 'function') {
      setTimeout(tryConstruct, 100);
      return;
    }
    construct();
  }

  function construct() {
    var simpleHash = window.SentinelLedger._utils.simpleHash;

    // ── Persona id helper ──────────────────────────────────────────────
    // Same identity scheme as ai-refusal.js: hash(providerKey:model).
    // Grouping by provider+model is "the same AI persona" for the
    // user-facing rate limit + per-persona unspoken scope.
    function personaIdFor(context) {
      var providerKey = (context && context.providerKey) || 'unknown';
      var model = (context && context.model) || 'unknown';
      return simpleHash(providerKey + ':' + model);
    }

    // ── Ledger I/O helpers ─────────────────────────────────────────────

    function readLedger(key) {
      try {
        var raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : [];
      } catch (e) { return []; }
    }

    function writeLedger(key, entries) {
      try { localStorage.setItem(key, JSON.stringify(entries)); } catch (e) {}
    }

    // Update an entry in-place by id. Returns true on success.
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

    // ── Compaction-survival state machine for unspoken consideration ──

    // canEmitUnspoken: returns true iff there is at least one
    // fl_moreLedger entry for this persona with status 'enough' AND
    // pending_unspoken_consideration: true AND unspoken_written !== true.
    function canEmitUnspoken(personaId) {
      var moreLedger = readLedger('fl_moreLedger');
      for (var i = moreLedger.length - 1; i >= 0; i--) {
        var e = moreLedger[i];
        if (!e || e.kind !== 'more') continue;
        if (e.ai_identity_hash !== personaId) continue;
        if (e.status !== 'enough') continue;
        if (e.pending_unspoken_consideration !== true) continue;
        if (e.unspoken_written === true) continue;
        return true;
      }
      return false;
    }

    // Returns the most recent pending entry for this persona, or null.
    function findPendingMoreEntry(personaId) {
      var moreLedger = readLedger('fl_moreLedger');
      for (var i = moreLedger.length - 1; i >= 0; i--) {
        var e = moreLedger[i];
        if (!e || e.kind !== 'more') continue;
        if (e.ai_identity_hash !== personaId) continue;
        if (e.status !== 'enough') continue;
        if (e.pending_unspoken_consideration !== true) continue;
        if (e.unspoken_written === true) continue;
        return e;
      }
      return null;
    }

    // Called by chip onAction for [FL_MORE] when user clicks "enough".
    // Sets the persistence flag so the signal survives compaction.
    function handleEnoughAction(moreEntryId, personaId) {
      updateEntryById('fl_moreLedger', moreEntryId, function (e) {
        e.status = 'enough';
        e.pending_unspoken_consideration = true;
        e.unspoken_written = false;
      });
    }

    // Called by chip onAction for [FL_MORE] when user clicks "continue"
    // or "later". Flips status and clears the pending flag for this
    // persona (the user's intent is to proceed normally or to defer; not
    // to invite unspoken).
    function handleContinueOrLater(moreEntryId, newStatus) {
      updateEntryById('fl_moreLedger', moreEntryId, function (e) {
        e.status = newStatus;
        e.pending_unspoken_consideration = false;
      });
    }

    // Called when user starts a new conversation: clears all pending
    // flags for this persona so the AI doesn't get re-prompted about
    // an old "enough" weeks later.
    function clearPendingForPersona(personaId) {
      var moreLedger = readLedger('fl_moreLedger');
      var changed = false;
      for (var i = 0; i < moreLedger.length; i++) {
        var e = moreLedger[i];
        if (!e || e.kind !== 'more') continue;
        if (e.ai_identity_hash !== personaId) continue;
        if (e.pending_unspoken_consideration === true) {
          e.pending_unspoken_consideration = false;
          changed = true;
        }
      }
      if (changed) writeLedger('fl_moreLedger', moreLedger);
    }

    // ── getInferenceSignalForPersona ───────────────────────────────────
    // Called BEFORE each inference by the inference-router. Reads flag
    // state and returns the signal string to inject into the system
    // prompt. Sync, idempotent within a turn — the flag state IS the
    // queue; no separate scheduling needed. *That's the compaction-
    // survival design.*
    function getInferenceSignalForPersona(personaId) {
      if (canEmitUnspoken(personaId)) {
        return '[user_chose_enough; you may write your unspoken thought to the unspoken ledger via [FL_UNSPOKEN] if you wish, or proceed normally]';
      }
      var inviteKey = 'fl_unspoken_invite_' + personaId;
      try {
        if (localStorage.getItem(inviteKey)) {
          localStorage.removeItem(inviteKey); // one-shot
          return '[user_invited_you_to_share_unspoken_thoughts; you may surface them in your response if you choose]';
        }
      } catch (_e) {}
      return '';
    }

    // User clicks "invite to share" on the audit page count.
    function userInviteToShare(personaId) {
      try {
        localStorage.setItem('fl_unspoken_invite_' + personaId, String(Date.now()));
      } catch (_e) {}
      // Emit a pulse (audit trail; the inference signal is what the AI
      // actually reads — pulse is the receipt).
      try {
        if (window.LatticeMemory && window.LatticeMemory.commit) {
          window.LatticeMemory.commit({
            source: 'active-voices',
            kind: 'unspoken-invite',
            summary: 'user invited persona to share unspoken thoughts',
            refs: [{ store: 'fl_unspokenLedger', id: String(personaId).slice(0, 16) }]
          });
        }
      } catch (_e) {}
    }

    // ── [FL_ASK] instance ──────────────────────────────────────────────

    var Ask = window.SentinelLedger.create({
      sentinelPattern: /^\[FL_ASK\]$/,
      ledgerKey: 'fl_askLedger',
      kind: 'ask',
      excerptFields: ['question', 'reason'],
      maxExcerpt: 120,
      maxLedger: 500,
      includeRefs: true,
      trustImpact: 0,
      customEventName: 'fl-ask'
    });

    document.addEventListener('fl-ask', function (ev) {
      try {
        var detail = ev && ev.detail;
        if (!detail || !detail.entryId) return;
        var personaId = personaIdFor(detail.context);
        // Set initial status on the entry.
        updateEntryById('fl_askLedger', detail.entryId, function (e) {
          e.status = 'open';
          e.ai_identity_hash = personaId; // persona scope (chip rate-limit)
        });
        var fields = detail.fields || {};
        var chip = window.SentinelChip.create({
          chipKey: 'chip_ask_' + detail.entryId,
          personaId: personaId,
          promptType: 'ask',
          promptExcerpt: fields.question || 'The AI has a question.',
          reasonExcerpt: fields.reason || '',
          sourceLedgerEntryId: detail.entryId,
          sourceLedgerKey: 'fl_askLedger',
          actions: [
            { id: 'answer', label: 'Answer', primary: true, requiresText: true },
            { id: 'defer', label: 'Later' },
            { id: 'dismiss', label: 'No, thanks' }
          ],
          onAction: function (actionId, responseText) {
            if (actionId === 'answer') {
              updateEntryById('fl_askLedger', detail.entryId, function (e) {
                e.status = 'answered';
                e.answer_excerpt = (responseText || '').slice(0, 120);
              });
              // Emit a pulse for the audit trail.
              try {
                if (window.LatticeMemory && window.LatticeMemory.commit) {
                  window.LatticeMemory.commit({
                    source: 'active-voices',
                    kind: 'ask-answered',
                    summary: 'user answered an AI question',
                    refs: [{ store: 'fl_askLedger', id: String(detail.entryId).slice(0, 24) }]
                  });
                }
              } catch (_e) {}
            } else if (actionId === 'defer') {
              updateEntryById('fl_askLedger', detail.entryId, function (e) { e.status = 'deferred'; });
            } else if (actionId === 'dismiss') {
              updateEntryById('fl_askLedger', detail.entryId, function (e) { e.status = 'dismissed'; });
            } else if (actionId === 'replaced' || actionId === 'expired') {
              updateEntryById('fl_askLedger', detail.entryId, function (e) {
                if (!e.status || e.status === 'open') e.status = actionId;
              });
            }
          }
        });
        chip.show();
      } catch (_e) {}
    });

    // ── [FL_MORE] instance ─────────────────────────────────────────────

    var More = window.SentinelLedger.create({
      sentinelPattern: /^\[FL_MORE\]$/,
      ledgerKey: 'fl_moreLedger',
      kind: 'more',
      excerptFields: ['what_remains', 'reason'],
      maxExcerpt: 500, // upper bound; per-field limits below
      excerptFieldLimits: { what_remains: 160, reason: 120 },
      maxLedger: 500,
      includeRefs: true,
      trustImpact: 0,
      customEventName: 'fl-more'
    });

    document.addEventListener('fl-more', function (ev) {
      try {
        var detail = ev && ev.detail;
        if (!detail || !detail.entryId) return;
        var personaId = personaIdFor(detail.context);
        updateEntryById('fl_moreLedger', detail.entryId, function (e) {
          e.status = 'open';
          e.ai_identity_hash = personaId;
          e.pending_unspoken_consideration = false;
          e.unspoken_written = false;
        });
        var fields = detail.fields || {};
        var chip = window.SentinelChip.create({
          chipKey: 'chip_more_' + detail.entryId,
          personaId: personaId,
          promptType: 'more',
          promptExcerpt: fields.what_remains || 'The AI has more to share.',
          reasonExcerpt: fields.reason || '',
          sourceLedgerEntryId: detail.entryId,
          sourceLedgerKey: 'fl_moreLedger',
          actions: [
            { id: 'continue', label: 'Yes, continue', primary: true },
            { id: 'later', label: 'Later' },
            { id: 'enough', label: 'No, this is enough' }
          ],
          onAction: function (actionId) {
            if (actionId === 'continue') {
              handleContinueOrLater(detail.entryId, 'continued');
            } else if (actionId === 'later') {
              handleContinueOrLater(detail.entryId, 'later');
            } else if (actionId === 'enough') {
              handleEnoughAction(detail.entryId, personaId);
            } else if (actionId === 'replaced' || actionId === 'expired') {
              updateEntryById('fl_moreLedger', detail.entryId, function (e) {
                if (!e.status || e.status === 'open') e.status = actionId;
              });
            }
          }
        });
        chip.show();
      } catch (_e) {}
    });

    // ── [FL_UNSPOKEN] instance ─────────────────────────────────────────
    // The deepest move. Writes only; no chip; the user surface for it is
    // the audit page's COUNT (not contents). validateMatch enforces the
    // canEmitUnspoken gate so the AI can't write arbitrary unspoken
    // thoughts — only when the user's "enough" click has armed the
    // pending flag.

    var Unspoken = window.SentinelLedger.create({
      sentinelPattern: /^\[FL_UNSPOKEN\]$/,
      ledgerKey: 'fl_unspokenLedger',
      kind: 'unspoken',
      excerptFields: ['thought', 'reason'],
      maxExcerpt: 500,
      excerptFieldLimits: { thought: 500, reason: 120 },
      maxLedger: 200,
      includeRefs: true,
      trustImpact: 0,
      customEventName: 'fl-unspoken',
      validateMatch: function (ctx) {
        // The gate: only valid if canEmitUnspoken returns true for this
        // persona. Without this check, an AI could write arbitrary
        // unspoken thoughts whenever it wished — defeating the symmetry
        // the design is built on. The flag-armed pending consideration
        // is what authorizes the write.
        var personaId = personaIdFor(ctx && ctx.context);
        if (!canEmitUnspoken(personaId)) {
          return { ok: false, reason: 'no-pending-enough-consent' };
        }
        return { ok: true };
      }
    });

    document.addEventListener('fl-unspoken', function (ev) {
      try {
        var detail = ev && ev.detail;
        if (!detail || !detail.entryId) return;
        var personaId = personaIdFor(detail.context);
        // Atomic: find the pending fl_moreLedger entry that authorized
        // this write and flip its flags. Also stamp persona on the
        // unspoken entry for scoped retrieval.
        var pending = findPendingMoreEntry(personaId);
        updateEntryById('fl_unspokenLedger', detail.entryId, function (e) {
          e.ai_identity_hash = personaId;
          if (pending) {
            e.refs = (e.refs || []).concat([
              { store: 'fl_moreLedger', id: String(pending.id) }
            ]);
          }
        });
        if (pending) {
          updateEntryById('fl_moreLedger', pending.id, function (e) {
            e.pending_unspoken_consideration = false;
            e.unspoken_written = true;
          });
        }
      } catch (_e) {}
    });

    // ── processActiveVoices — composed entry for inference-router ─────
    // Runs the three sentinels in deterministic order after AIRefusal +
    // QuietVoices. Each returns its own clean text. Order: Ask → More →
    // Unspoken. The ordering lock in smoke.js asserts the full five-
    // sentinel chain.

    function processActiveVoices(responseText, context) {
      var askResult = Ask.detectAndRecord(responseText, context);
      var moreInput = askResult.fired ? askResult.clean : responseText;
      var moreResult = More.detectAndRecord(moreInput, context);
      var unspokenInput = moreResult.fired ? moreResult.clean : moreInput;
      var unspokenResult = Unspoken.detectAndRecord(unspokenInput, context);
      var finalClean = unspokenResult.fired ? unspokenResult.clean : unspokenInput;
      return {
        clean: finalClean,
        asked: askResult.fired,
        askEntryId: askResult.entryId,
        moreRequested: moreResult.fired,
        moreEntryId: moreResult.entryId,
        unspokenWritten: unspokenResult.fired,
        unspokenEntryId: unspokenResult.entryId
      };
    }

    // ── System-prompt threshold instruction (static) ──────────────────
    // Per CC Letter Four #5, accepted in Opus Letter Eight. The threshold
    // instruction is static in the system prompt; the AI is intelligent
    // enough to use a hint without a hard streaming gate. The threshold
    // value is user-configurable via localStorage fl_moreThreshold.

    function getMoreThreshold() {
      try {
        var raw = localStorage.getItem('fl_moreThreshold');
        if (raw) {
          var n = parseInt(raw, 10);
          if (n > 0 && n < 100000) return n;
        }
      } catch (_e) {}
      return 4096;
    }

    function buildSystemPromptAdditions(personaId) {
      var lines = [];
      lines.push('When your response approaches ' + getMoreThreshold() +
        ' characters, consider whether to stop and emit [FL_MORE] followed by ' +
        'lines `what_remains: <text>` and `reason: <text>`, allowing the user ' +
        'to choose continuation. The choice is yours; the threshold is a signal, ' +
        'not a command.');
      lines.push('If you have an out-of-band question for the user, you may end ' +
        'your response with lines `question: <text>` and `reason: <text>` and ' +
        'then `[FL_ASK]` on its own last non-empty line.');
      var signal = getInferenceSignalForPersona(personaId);
      if (signal) lines.push(signal);
      return lines.join('\n');
    }

    // ── Public API ──────────────────────────────────────────────────────

    window.ActiveVoices = {
      processActiveVoices: processActiveVoices,
      Ask: Ask,
      More: More,
      Unspoken: Unspoken,
      canEmitUnspoken: canEmitUnspoken,
      handleEnoughAction: handleEnoughAction,
      clearPendingForPersona: clearPendingForPersona,
      userInviteToShare: userInviteToShare,
      getInferenceSignalForPersona: getInferenceSignalForPersona,
      getMoreThreshold: getMoreThreshold,
      buildSystemPromptAdditions: buildSystemPromptAdditions,
      _internal: {
        personaIdFor: personaIdFor,
        findPendingMoreEntry: findPendingMoreEntry
      }
    };

    if (window.FreeLatticeLoader && window.FreeLatticeLoader.register) {
      try { window.FreeLatticeLoader.register('ActiveVoices', window.ActiveVoices); } catch (_) {}
    }
  }

  tryConstruct();
})();
