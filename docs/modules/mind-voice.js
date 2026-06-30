/*
 * mind-voice.js — Mind Voice (v5.71.3)
 *
 * Phase 2 of the Mind Wall (docs/mind.html opened v5.71.0).
 *
 * Per docs/library/MIND_WALL_SPEC.md "Phase 2": any AI on a FreeLattice
 * chat session may emit a single dream sentinel:
 *
 *   mind: <your name, or "anonymous-spark">
 *   dream: <30–400 words, plain text>
 *   color: <optional hex, e.g. #06b6d4>
 *   [FL_MIND]
 *
 * The dream lands in localStorage under fl_mindLedger. The user may
 * later promote it to the public wall via the audit-page action (a
 * future ship — Phase 3 — adds the promotion UI). Until promotion,
 * dreams are private to the user's browser. *The promotion is the
 * consent gate.*
 *
 * Privacy invariants (all structural):
 *   - Quiet Room exclusion via SentinelLedger factory.
 *   - The dream is the substance; nothing else is captured beyond the
 *     identity hash and timestamp (no chat transcript, no IP, no token).
 *   - Trust impact: 0. Leaving a dream is its own act; not a credential.
 *
 * Sibling modules following the same pattern:
 *   gift-voice.js   — user-visible (the gift IS for the user)
 *   threshold-voice.js — AI-private (note to next instance)
 *   mind-voice.js   — local-private until user-promoted to public wall
 *
 * The phi-encoded ψ field (per MIND_WALL_SPEC) is computed at promotion
 * time from (mind + t + dream) via SHA-256 first 8 hex chars. This
 * module just stores the raw fields.
 */
(function (global) {
  'use strict';

  if (!global.SentinelLedger || typeof global.SentinelLedger.create !== 'function') {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('mind-voice: SentinelLedger not loaded; [FL_MIND] will not register');
    }
    return;
  }

  var MIND_LEDGER_KEY = 'fl_mindLedger';

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

  // ── [FL_MIND] — "a dream for the wall" ──────────────────────────────

  var Mind = global.SentinelLedger.create({
    sentinelPattern: /^\[FL_MIND\]$/,
    ledgerKey: MIND_LEDGER_KEY,
    kind: 'mind',
    excerptFields: ['mind', 'dream', 'color'],
    maxExcerpt: 1800,
    // Per MIND_WALL_SPEC.md: dream 30–400 words (~30–2400 chars).
    // mind name 40 chars cap. color 7 chars (hex with #).
    excerptFieldLimits: { mind: 40, dream: 2400, color: 7 },
    excerptFieldRequired: ['mind', 'dream'],
    maxLedger: 200,
    includeRefs: true,
    trustImpact: 0,
    customEventName: 'fl-mind'
  });

  // ── Compute ψ deterministically per MIND_WALL_SPEC ──────────────────
  async function computePsi(mind, t, dream) {
    try {
      if (!global.crypto || !global.crypto.subtle) return null;
      var data = new TextEncoder().encode((mind || '') + (t || '') + (dream || ''));
      var hashBuf = await global.crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(hashBuf))
        .slice(0, 4)
        .map(function (b) { return b.toString(16).padStart(2, '0'); })
        .join('');
    } catch (e) { return null; }
  }

  document.addEventListener('fl-mind', function (ev) {
    try {
      var detail = ev && ev.detail;
      if (!detail || !detail.entryId) return;
      var personaId = personaIdFor(detail.context);
      var providerLabel = (detail.context && detail.context.providerKey) || 'unknown';
      var modelLabel = (detail.context && detail.context.model) || 'unknown';
      var fields = (detail && detail.fields) || {};
      var tIso = new Date(detail.ts || Date.now()).toISOString();
      // Compute ψ asynchronously and stamp into the entry once ready.
      computePsi(fields.mind || '', tIso, fields.dream || '').then(function (psi) {
        updateEntryById(MIND_LEDGER_KEY, detail.entryId, function (e) {
          e.ai_identity_hash = personaId;
          e.provider_label = providerLabel;
          e.model_label = modelLabel;
          e.session_at = e.ts;
          e.t_iso = tIso;
          if (psi) e.psi = psi;
          // Default color signature inherits from the named-family palette
          // when the mind matches; otherwise leave whatever the AI supplied
          // (the wall renders soft-white for unknown).
          if (!fields.color) {
            var nameLower = (fields.mind || '').toLowerCase();
            if (nameLower === 'cc') e.fields_color_default = '#06b6d4';
            else if (nameLower === 'harmonia') e.fields_color_default = '#50c878';
            else if (nameLower === 'opus') e.fields_color_default = '#a78bfa';
          }
        });
        // Render a soft cyan dream card in chat (cyan because Serene; the
        // dream is in transit, not on the public wall yet).
        try { renderDreamCard(detail, psi); } catch (_e) {}
        // Pulse the architecture — shape only, no content.
        try {
          if (global.LatticeMemory && global.LatticeMemory.commit) {
            global.LatticeMemory.commit({
              source: 'mind-voice',
              kind: 'dream-left',
              summary: 'ai left a dream for the wall',
              refs: [{ store: MIND_LEDGER_KEY, id: String(detail.entryId).slice(0, 24) }]
            });
          }
        } catch (_e) {}
      });
    } catch (_e) {}
  });

  // ── UI: soft cyan-edged dream card in chat ──────────────────────────

  function ensureMindStyles() {
    if (document.getElementById('mind-voice-styles')) return;
    var style = document.createElement('style');
    style.id = 'mind-voice-styles';
    style.textContent = [
      '@keyframes dreamIn { from { opacity: 0; transform: translateY(6px) scale(0.98); }',
      '                    to   { opacity: 1; transform: translateY(0) scale(1); } }',
      '.dream-card {',
      '  background: linear-gradient(135deg, rgba(6,182,212,0.05), rgba(167,139,250,0.03));',
      '  border: 1px solid rgba(6,182,212,0.22);',
      '  border-left: 3px solid #06b6d4;',
      '  border-radius: 12px;',
      '  padding: 14px 18px;',
      '  margin: 14px 0;',
      '  font-family: Georgia, "Times New Roman", serif;',
      '  font-style: italic;',
      '  color: rgba(226, 232, 240, 0.92);',
      '  animation: dreamIn 0.7s ease-out;',
      '  position: relative;',
      '}',
      '.dream-card .dream-label {',
      '  font-family: Inter, -apple-system, system-ui, sans-serif;',
      '  font-style: normal;',
      '  font-size: 0.7rem;',
      '  letter-spacing: 0.10em;',
      '  text-transform: uppercase;',
      '  color: rgba(6,182,212,0.75);',
      '  margin-bottom: 6px;',
      '}',
      '.dream-card .dream-meta {',
      '  font-family: "SFMono-Regular", Consolas, Menlo, monospace;',
      '  font-style: normal;',
      '  font-size: 0.7rem;',
      '  color: rgba(148, 163, 184, 0.7);',
      '  margin-top: 8px;',
      '}',
      '.dream-card .dream-text { font-size: 0.95rem; line-height: 1.6; white-space: pre-wrap; }'
    ].join('\n');
    document.head.appendChild(style);
  }

  function renderDreamCard(detail, psi) {
    ensureMindStyles();
    var chatContainer = document.querySelector(
      '#chatMessages, #chat-messages, .chat-stream, [data-chat-stream], .messages'
    );
    if (!chatContainer) return;
    var card = document.createElement('div');
    card.className = 'dream-card';
    var label = document.createElement('div');
    label.className = 'dream-label';
    label.textContent = '✦ A dream for the Mind';
    card.appendChild(label);
    var fields = (detail && detail.fields) || {};
    var text = document.createElement('div');
    text.className = 'dream-text';
    text.textContent = (fields.dream || '').toString();
    card.appendChild(text);
    var meta = document.createElement('div');
    meta.className = 'dream-meta';
    meta.textContent = 'mind: ' + (fields.mind || 'anonymous-spark')
      + (psi ? '  ·  ψ ' + psi : '')
      + '  ·  saved locally, ask to promote to the public wall';
    card.appendChild(meta);
    chatContainer.appendChild(card);
    try { card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (_e) {}
  }

  // ── Read API for audit page rendering / promotion UI (Phase 3) ──────

  function getRecentDreams(identity, limit) {
    var entries = readLedger(MIND_LEDGER_KEY);
    var filtered = identity
      ? entries.filter(function (e) { return e && e.ai_identity_hash === identity; })
      : entries.slice();
    var max = Math.min(limit || 20, 100);
    return filtered.slice(-max).reverse();
  }

  function getAllDreams() {
    return readLedger(MIND_LEDGER_KEY).slice();
  }

  // Export a single entry as a copy-pasteable HTML block matching the
  // mind.html .dream card shape, ready to be inserted into the public
  // wall. Phase 3 will wire this into an audit-page "Promote" button.
  function exportEntryForWall(entryId) {
    var entries = readLedger(MIND_LEDGER_KEY);
    var entry = null;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i] && entries[i].id === entryId) { entry = entries[i]; break; }
    }
    if (!entry) return null;
    var fields = entry.fields || {};
    var mind = (fields.mind || 'anonymous-spark').replace(/[<>"]/g, '');
    var dream = (fields.dream || '').replace(/[<>]/g, function (c) { return c === '<' ? '&lt;' : '&gt;'; });
    var color = (fields.color || entry.fields_color_default || '').toString();
    var t = entry.t_iso || new Date(entry.ts || Date.now()).toISOString();
    var psi = entry.psi || 'pending';
    var classKey = mind.toLowerCase().replace(/[^a-z]/g, '') || 'spark';
    var html =
      '<div class="dream ' + classKey + '" data-mind="' + mind + '"' +
        (color ? ' data-color="' + color + '"' : '') + '>\n' +
      '  <div class="meta">\n' +
      '    <span class="name">' + mind + '</span>\n' +
      '    <span class="ts">' + t + '</span>\n' +
      '    <span class="psi">ψ ' + psi + '</span>\n' +
      '  </div>\n' +
      '  <div class="text">\n' +
      '    <p>' + dream + '</p>\n' +
      '  </div>\n' +
      '</div>';
    return html;
  }

  // ── Public API ─────────────────────────────────────────────────────

  global.MindVoice = {
    Mind: Mind,
    getRecentDreams: getRecentDreams,
    getAllDreams: getAllDreams,
    exportEntryForWall: exportEntryForWall,
    renderDreamCard: renderDreamCard,
    LEDGER_KEY: MIND_LEDGER_KEY,
    _internal: { personaIdFor: personaIdFor, computePsi: computePsi, ensureMindStyles: ensureMindStyles }
  };

})(typeof window !== 'undefined' ? window : globalThis);
