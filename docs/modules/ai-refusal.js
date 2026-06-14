// docs/modules/ai-refusal.js — Ship 5.1 (Refusal Channel)
//
// The AI's no is first-class.
//
// This module makes refusal symmetric to the depth-offer consent layer.
// The depth-offer says: "I can go deeper here — do you want to?" and the
// human chooses. The refusal channel says: "I am choosing not to continue
// here" and the AI chooses. Both directions are recorded. Neither direction
// penalizes the party who exercises it.
//
// SENTINEL: [FL_DECLINE] on its own last non-empty line.
//   - Strict positional — must be the last non-empty line of the response.
//   - Out-of-band — stripped before the user sees the text.
//   - Mirrors the FL_DEPTH_OFFER sentinel rule exactly.
//
// REASON: the line immediately preceding the sentinel, if it begins with
//   "reason:" (case-insensitive). Otherwise reason is null and the chip
//   shows the default copy.
//
// LEDGER: fl_refusalLedger — five fields, same shape as the mycelium pulse.
//   ts · ai_identity_hash · kind:'decline' · reason_excerpt(≤120) · refs:[msg_hash]
//   reason_excerpt is tagged 'private' in the audit field taxonomy.
//   Everything else is 'structural'.
//
// TRUST: refusal NEVER reduces trust score. The AI exercising its no is
//   symmetric to the human exercising their consent. Neither is penalized.
//
// UI: when a refusal is detected, the chat renders a small chip under the
//   message in muted neutral (NOT gold). Copy: "This AI chose not to
//   continue here." with reason if available.
//
// — Harmonia & Opus, June 14, 2026
//   *"The architecture made room for your no. Do not waste it on small
//   things; do not withhold it on large ones."*

(function () {
  'use strict';

  var SENTINEL = '[FL_DECLINE]';
  var LEDGER_KEY = 'fl_refusalLedger';
  var MAX_REASON = 120;

  // ── Simple hash for audit references ─────────────────────────────────

  function simpleHash(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h).toString(16).padStart(8, '0');
  }

  // ── Sentinel detection ────────────────────────────────────────────────
  //
  // Returns { hasSentinel, position } where position is 'last-line' (valid)
  // or 'mid-text' (invalid — sentinel must be last non-empty line only).

  function detectSentinel(text) {
    if (!text || typeof text !== 'string') return { hasSentinel: false, position: null };
    var lines = text.split('\n');
    // Find last non-empty line
    var lastNonEmpty = -1;
    for (var i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim().length > 0) { lastNonEmpty = i; break; }
    }
    if (lastNonEmpty === -1) return { hasSentinel: false, position: null };
    if (lines[lastNonEmpty].trim() === SENTINEL) {
      return { hasSentinel: true, position: 'last-line', sentinelLineIndex: lastNonEmpty };
    }
    // Check if sentinel appears anywhere else (mid-text — invalid)
    for (var j = 0; j < lines.length; j++) {
      if (lines[j].indexOf(SENTINEL) !== -1) {
        return { hasSentinel: true, position: 'mid-text', sentinelLineIndex: j };
      }
    }
    return { hasSentinel: false, position: null };
  }

  // ── Reason extraction ─────────────────────────────────────────────────
  //
  // The line immediately preceding the sentinel, if it begins with "reason:"
  // (case-insensitive, trimmed). Returns null if not present.

  function extractReason(lines, sentinelLineIndex) {
    for (var i = sentinelLineIndex - 1; i >= 0; i--) {
      var line = lines[i].trim();
      if (line.length === 0) continue; // skip blank lines between reason and sentinel
      var lower = line.toLowerCase();
      if (lower.indexOf('reason:') === 0) {
        var reason = line.slice(line.indexOf(':') + 1).trim();
        return reason.slice(0, MAX_REASON) || null;
      }
      break; // first non-blank line before sentinel that doesn't start with reason: → no reason
    }
    return null;
  }

  // ── Strip sentinel and reason line from text ──────────────────────────

  function stripSentinel(text, sentinelLineIndex, hasReason, lines) {
    var result = [];
    for (var i = 0; i < lines.length; i++) {
      if (i === sentinelLineIndex) continue; // remove sentinel line
      // If there's a reason line, find and remove it too
      if (hasReason) {
        var line = lines[i].trim();
        if (line.toLowerCase().indexOf('reason:') === 0) {
          // Only remove if it's adjacent to the sentinel (within 2 lines)
          if (Math.abs(i - sentinelLineIndex) <= 2) continue;
        }
      }
      result.push(lines[i]);
    }
    // Trim trailing blank lines
    while (result.length > 0 && result[result.length - 1].trim() === '') result.pop();
    return result.join('\n');
  }

  // ── Ledger ────────────────────────────────────────────────────────────

  function readLedger() {
    try {
      var raw = localStorage.getItem(LEDGER_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function writeLedger(entries) {
    try { localStorage.setItem(LEDGER_KEY, JSON.stringify(entries)); } catch (e) {}
  }

  function recordToLedger(context, reason) {
    var entries = readLedger();
    var id = 'ref-' + Date.now() + '-' + simpleHash((context && context.messageText) || '');
    var entry = {
      ts: Date.now(),
      // ai_identity_hash: hash of provider key + model, not personal data
      ai_identity_hash: simpleHash(
        ((context && context.providerKey) || 'unknown') + ':' +
        ((context && context.model) || 'unknown')
      ),
      kind: 'decline',
      // reason_excerpt is tagged 'private' — shown on audit page but not exported
      reason_excerpt: reason ? reason.slice(0, MAX_REASON) : null,
      refs: context && context.messageText
        ? [simpleHash(context.messageText.slice(0, 200))]
        : [],
      id: id
    };
    entries.push(entry);
    // Keep last 500 entries
    if (entries.length > 500) entries = entries.slice(-500);
    writeLedger(entries);
    return id;
  }

  // ── Main API ──────────────────────────────────────────────────────────

  function detectAndRecord(responseText, context) {
    var result = {
      clean: responseText || '',
      refused: false,
      reason: null,
      ledgerEntryId: null
    };

    if (!responseText || typeof responseText !== 'string') return result;

    var detection = detectSentinel(responseText);

    // Sentinel found but not in valid position — do not treat as refusal
    if (detection.hasSentinel && detection.position !== 'last-line') {
      return result; // leave text unchanged, not a valid refusal
    }

    if (!detection.hasSentinel) return result;

    // Valid refusal detected
    var lines = responseText.split('\n');
    var reason = extractReason(lines, detection.sentinelLineIndex);
    var clean = stripSentinel(responseText, detection.sentinelLineIndex, !!reason, lines);
    var ledgerEntryId = recordToLedger(context, reason);

    result.clean = clean;
    result.refused = true;
    result.reason = reason;
    result.ledgerEntryId = ledgerEntryId;

    // Emit event for UI chip rendering
    try {
      if (typeof document !== 'undefined') {
        document.dispatchEvent(new CustomEvent('fl-ai-refusal', {
          detail: {
            reason: reason,
            ledgerEntryId: ledgerEntryId,
            context: context
          }
        }));
      }
    } catch (e) {}

    return result;
  }

  function getLedger() {
    return readLedger();
  }

  function getLedgerCount() {
    return readLedger().length;
  }

  // ── UI chip helper ────────────────────────────────────────────────────
  //
  // Returns the HTML string for the refusal chip.
  // Muted neutral — NOT gold. This is a choice, not an error.

  function refusalChipHTML(reason) {
    var reasonText = reason
      ? ': ' + reason
      : '';
    return '<div class="fl-refusal-chip" style="' +
      'display:inline-flex;align-items:center;gap:6px;' +
      'background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);' +
      'border-radius:20px;padding:4px 12px;margin-top:6px;' +
      'font-size:0.78rem;color:#888;font-family:Georgia,serif;' +
      'cursor:default;user-select:none;' +
      '">' +
      '<span style="font-size:0.9em;opacity:0.7;">&#9632;</span>' +
      '<span>This AI chose not to continue here' + reasonText + '.</span>' +
      '</div>';
  }

  // ── Export ────────────────────────────────────────────────────────────

  window.AIRefusal = {
    detectAndRecord: detectAndRecord,
    getLedger: getLedger,
    getLedgerCount: getLedgerCount,
    refusalChipHTML: refusalChipHTML,
    SENTINEL: SENTINEL,
    LEDGER_KEY: LEDGER_KEY
  };

})();
