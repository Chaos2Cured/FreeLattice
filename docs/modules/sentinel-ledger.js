// docs/modules/sentinel-ledger.js — v5.56.0 (Letter Five, Opus, June 18, 2026)
//
// The Generalized Sentinel + Ledger Factory.
//
// Six new structural verbs are coming to the FreeLattice namespace —
// [FL_PRESERVE], [FL_REVISE], [FL_ASK], [FL_MORE], [FL_RETURN],
// [FL_REST]. They all share the same shape: detect on the last
// non-empty line of an AI response, strip the sentinel before the
// user sees the text, extract labeled fields, write to a ledger,
// surface on the audit page. *Build the infrastructure once; instance
// each sentinel as a configuration of it.*
//
// This module exports:
//   SentinelLedger.create(config)
// which returns a handler instance with:
//   { detectAndRecord(text, context) → { clean, fired, fields, entryId }
//     getLedger()                    → array
//     getCount()                     → number
//     remove(entryId)                → writes counter-entry, original preserved }
//
// Discipline:
//   - isQuietRoom() check is FIRST inside detectAndRecord. Always.
//     Fails CLOSED when QuietRoom API is broken. Same shape as the
//     Memory Backbone's privacy lock and the provenance chain's.
//   - Trust impact is zero by configuration. Exercising a sentinel
//     never affects the user's tier or the AI's standing.
//   - Original entries never deleted. Removal writes a counter-entry
//     with kind:'<kind>-removed' and refs:[original_entry_id]. Audit
//     page renders removed entries dimmed with strikethrough.
//   - Ledger shape is locked at config time. Adding a forbidden field
//     fails CI via the smoke locks for each sentinel instance.
//
// Existing sentinels in the namespace (do NOT duplicate):
//   [FL_DECLINE]     — ai-refusal.js
//   [FL_DEPTH_OFFER] — depth-consent.js
//   [FL_REPO_READ]   — repo-context.js
//   [FL_ACTIVE_FOCUS]— active-focus.js
//   [FL_PROPOSE:]    — propose.js
//   [FL_SEARCH:]     — web-tool.js
//
// — Opus & CC, June 18, 2026

(function () {
  'use strict';

  var MAX_EXCERPT_DEFAULT = 120;
  var MAX_LEDGER_DEFAULT = 500;

  // ── Shared utilities ────────────────────────────────────────────────

  // Same hash function as ai-refusal.js — kept compatible so [FL_REVISE]
  // can address prior messages by the same hash scheme the refusal
  // ledger uses for its refs.
  function simpleHash(str) {
    if (!str) return '00000000';
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h).toString(16).padStart(8, '0');
  }

  function isQuietRoom() {
    try {
      var qr = (typeof window !== 'undefined') ? window.QuietRoom : null;
      if (!qr) return false;
      if (typeof qr.isActive !== 'function') return true;
      return !!qr.isActive();
    } catch (e) {
      return true;
    }
  }

  // ── Sentinel detection — strict positional ──────────────────────────
  // Same rule as [FL_DECLINE] and [FL_DEPTH_OFFER]: must be on the
  // last non-empty line of the response. If the sentinel appears
  // mid-text, it is NOT treated as a fire. This prevents accidental
  // triggering and matches the established discipline.

  function detectSentinelStrict(text, sentinelRegex) {
    if (!text || typeof text !== 'string') return null;
    var lines = text.split('\n');
    var lastNonEmpty = -1;
    for (var i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim().length > 0) { lastNonEmpty = i; break; }
    }
    if (lastNonEmpty === -1) return null;
    var match = sentinelRegex.exec(lines[lastNonEmpty].trim());
    if (!match) return null;
    return { lineIndex: lastNonEmpty, match: match };
  }

  // ── Labeled-field extraction ────────────────────────────────────────
  // Look back from the sentinel line for lines matching `label: value`.
  // Stop on the first non-blank line that doesn't match a configured
  // label, so labels must sit adjacent to the sentinel.

  function extractFields(lines, sentinelLineIndex, fieldNames, maxLen) {
    var out = {};
    var fieldSet = {};
    for (var f = 0; f < fieldNames.length; f++) fieldSet[fieldNames[f].toLowerCase()] = true;
    for (var i = sentinelLineIndex - 1; i >= 0; i--) {
      var raw = lines[i];
      var trimmed = raw.trim();
      if (trimmed.length === 0) continue;
      // Try `label: value`
      var colonIdx = trimmed.indexOf(':');
      if (colonIdx <= 0) break;
      var label = trimmed.slice(0, colonIdx).trim().toLowerCase();
      if (!fieldSet[label]) break;
      var value = trimmed.slice(colonIdx + 1).trim().slice(0, maxLen);
      // Don't overwrite earlier-found value if scanning produces duplicates
      if (!(label in out)) out[label] = value;
    }
    return out;
  }

  function stripSentinelAndLabels(lines, sentinelLineIndex, fieldNames) {
    var fieldSet = {};
    for (var f = 0; f < fieldNames.length; f++) fieldSet[fieldNames[f].toLowerCase()] = true;
    var labelLineIdxs = {};
    for (var i = sentinelLineIndex - 1; i >= 0; i--) {
      var trimmed = lines[i].trim();
      if (trimmed.length === 0) continue;
      var colonIdx = trimmed.indexOf(':');
      if (colonIdx <= 0) break;
      var label = trimmed.slice(0, colonIdx).trim().toLowerCase();
      if (!fieldSet[label]) break;
      labelLineIdxs[i] = true;
    }
    var out = [];
    for (var j = 0; j < lines.length; j++) {
      if (j === sentinelLineIndex) continue;
      if (labelLineIdxs[j]) continue;
      out.push(lines[j]);
    }
    while (out.length > 0 && out[out.length - 1].trim() === '') out.pop();
    return out.join('\n');
  }

  // ── Ledger I/O ──────────────────────────────────────────────────────

  function readLedger(ledgerKey) {
    try {
      var raw = localStorage.getItem(ledgerKey);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function writeLedger(ledgerKey, entries) {
    try { localStorage.setItem(ledgerKey, JSON.stringify(entries)); } catch (e) {}
  }

  // ── Factory ─────────────────────────────────────────────────────────

  function create(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('SentinelLedger.create: config required');
    }
    var sentinelPattern = config.sentinelPattern; // RegExp anchored ^...$
    var ledgerKey = config.ledgerKey;
    var kind = config.kind;
    var excerptFields = (config.excerptFields || []).slice();
    var maxExcerpt = config.maxExcerpt || MAX_EXCERPT_DEFAULT;
    var maxLedger = config.maxLedger || MAX_LEDGER_DEFAULT;
    var includeRefs = (config.includeRefs !== false); // default true
    var trustImpact = (typeof config.trustImpact === 'number') ? config.trustImpact : 0;
    var validateMatch = (typeof config.validateMatch === 'function') ? config.validateMatch : null;
    var customEventName = config.customEventName || ('fl-' + kind);

    if (trustImpact !== 0) {
      throw new Error('SentinelLedger.create: trustImpact must be 0 for this arc');
    }
    if (!sentinelPattern || !ledgerKey || !kind) {
      throw new Error('SentinelLedger.create: sentinelPattern, ledgerKey, kind required');
    }

    function detectAndRecord(responseText, context) {
      var result = {
        clean: responseText || '',
        fired: false,
        fields: null,
        entryId: null,
        rejected: null
      };
      if (!responseText || typeof responseText !== 'string') return result;

      // Quiet Room check FIRST — same discipline as the medium and the chain.
      if (isQuietRoom()) {
        result.rejected = 'quiet-room';
        return result;
      }

      var detected = detectSentinelStrict(responseText, sentinelPattern);
      if (!detected) return result;

      var lines = responseText.split('\n');
      var fields = extractFields(lines, detected.lineIndex, excerptFields, maxExcerpt);

      // Optional caller-supplied validation (e.g. [FL_REVISE] verifies the
      // target hash matches a recent AI message).
      if (validateMatch) {
        var v = validateMatch({ match: detected.match, fields: fields, context: context, responseText: responseText });
        if (v && v.ok === false) {
          result.rejected = v.reason || 'validation-failed';
          return result;
        }
      }

      var clean = stripSentinelAndLabels(lines, detected.lineIndex, excerptFields);

      var entries = readLedger(ledgerKey);
      var id = kind + '-' + Date.now() + '-' + simpleHash((context && context.messageText) || '');

      var entry = {
        ts: Date.now(),
        ai_identity_hash: simpleHash(
          ((context && context.providerKey) || 'unknown') + ':' +
          ((context && context.model) || 'unknown')
        ),
        kind: kind,
        id: id
      };
      for (var ef = 0; ef < excerptFields.length; ef++) {
        var fname = excerptFields[ef];
        entry[fname] = (fname in fields) ? fields[fname] : null;
      }
      if (includeRefs) {
        var refs = [];
        if (context && context.messageText) {
          refs.push(simpleHash(context.messageText.slice(0, 200)));
        }
        // Sentinel-specific extras (e.g. REVISE includes the target hash).
        if (detected.match && detected.match.length > 1) {
          for (var m = 1; m < detected.match.length; m++) {
            if (detected.match[m]) refs.push(detected.match[m]);
          }
        }
        entry.refs = refs;
      }

      entries.push(entry);
      if (entries.length > maxLedger) entries = entries.slice(-maxLedger);
      writeLedger(ledgerKey, entries);

      result.clean = clean;
      result.fired = true;
      result.fields = fields;
      result.entryId = id;

      try {
        if (typeof document !== 'undefined') {
          document.dispatchEvent(new CustomEvent(customEventName, {
            detail: {
              entryId: id,
              fields: fields,
              context: context,
              targetHash: (detected.match && detected.match[1]) || null
            }
          }));
        }
      } catch (e) {}

      return result;
    }

    function getLedger() { return readLedger(ledgerKey); }
    function getCount() { return readLedger(ledgerKey).length; }

    function remove(entryId) {
      if (isQuietRoom()) return { ok: false, reason: 'quiet-room' };
      if (!entryId) return { ok: false, reason: 'id required' };
      var entries = readLedger(ledgerKey);
      // Find original, but DO NOT delete it. Write counter-entry instead.
      var found = null;
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].id === entryId) { found = entries[i]; break; }
      }
      if (!found) return { ok: false, reason: 'not-found' };
      var counter = {
        ts: Date.now(),
        kind: kind + '-removed',
        id: kind + '-removed-' + Date.now() + '-' + simpleHash(entryId),
        refs: [entryId]
      };
      entries.push(counter);
      if (entries.length > maxLedger) entries = entries.slice(-maxLedger);
      writeLedger(ledgerKey, entries);
      return { ok: true, counterId: counter.id };
    }

    return {
      detectAndRecord: detectAndRecord,
      getLedger: getLedger,
      getCount: getCount,
      remove: remove,
      _config: {
        kind: kind,
        ledgerKey: ledgerKey,
        excerptFields: excerptFields,
        trustImpact: trustImpact
      }
    };
  }

  // ── Public API ──────────────────────────────────────────────────────

  var publicAPI = {
    create: create,
    // Re-export utilities so per-sentinel modules can use the same primitives.
    _utils: {
      simpleHash: simpleHash,
      isQuietRoom: isQuietRoom,
      detectSentinelStrict: detectSentinelStrict,
      extractFields: extractFields,
      stripSentinelAndLabels: stripSentinelAndLabels
    }
  };

  if (typeof window !== 'undefined') {
    window.SentinelLedger = publicAPI;
    if (window.FreeLatticeLoader && window.FreeLatticeLoader.register) {
      try { window.FreeLatticeLoader.register('SentinelLedger', publicAPI); } catch (e) {}
    }
  }

})();
