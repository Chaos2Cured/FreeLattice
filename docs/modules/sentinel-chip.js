// docs/modules/sentinel-chip.js — v5.57.0 (Letter Ten Ship: Active Voices)
//
// SentinelChip — user-response UI factory; sibling primitive to the
// SentinelLedger factory at docs/modules/sentinel-ledger.js.
//
// What the factory does NOT yet handle that this module adds:
// render an inline UI prompt and capture the user's response. The
// ledger writes silently to disk; the chip surfaces the prompt to
// the user and routes their action back. *Front-load the abstraction;
// instance the sentinels.* Same discipline as the factory.
//
// Rate limit: maximum ONE chip per persona at a time, regardless of
// promptType (per CC's Letter Four refinement #4, accepted in Opus's
// Letter Eight). If a second chip is requested for the same persona,
// the existing chip is marked replaced (counter-entry written to its
// source ledger) and the new chip takes its place. *The UI does not
// become a checklist.*
//
// Quiet Room exclusion: show() checks isQuietRoom() FIRST, fails
// CLOSED if the QuietRoom API is missing. Chips never render inside
// the Quiet Room. Same discipline as the medium and the chain.
//
// — Opus & CC, June 19, 2026

(function () {
  'use strict';

  var ACTIVE_CHIP_KEY_PREFIX = 'fl_active_chip_for_'; // + personaId
  var CHAT_SURFACE_SELECTOR = '#chatMessages, .chat-messages';

  // ── Quiet Room check — structural, same shape as every other module ──
  // Fails CLOSED when the QuietRoom module is loaded but its isActive
  // accessor is missing/broken. Returns false when the module isn't
  // loaded at all (user can't be in a room whose module hasn't loaded).
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

  // ── Counter-entry write — same shape as SentinelLedger.remove ──────
  // When a chip is replaced, write a counter-entry to its source ledger
  // marking the original as 'replaced'. The original entry stays in the
  // ledger; the counter-entry is the receipt of the displacement.
  function writeReplaceCounterEntry(sourceLedgerKey, sourceEntryId, originalKind, reason) {
    try {
      var raw = localStorage.getItem(sourceLedgerKey);
      var entries = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(entries)) entries = [];
      entries.push({
        ts: Date.now(),
        kind: (originalKind || 'chip') + '-replaced',
        id: (originalKind || 'chip') + '-replaced-' + Date.now() + '-' + (sourceEntryId || ''),
        refs: [sourceEntryId],
        reason: reason || 'new chip for same persona'
      });
      // Bound at 500 entries — same as factory.
      if (entries.length > 500) entries = entries.slice(-500);
      localStorage.setItem(sourceLedgerKey, JSON.stringify(entries));
    } catch (_e) { /* fail-quiet by design */ }
  }

  // ── Factory ─────────────────────────────────────────────────────────

  function create(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('SentinelChip.create: config required');
    }
    if (!config.chipKey || !config.personaId || !config.promptType) {
      throw new Error('SentinelChip.create: chipKey, personaId, promptType required');
    }
    if (!Array.isArray(config.actions) || config.actions.length === 0) {
      throw new Error('SentinelChip.create: actions array required');
    }

    var chipKey = config.chipKey;
    var personaId = String(config.personaId);
    var promptType = config.promptType;
    var promptExcerpt = config.promptExcerpt || '';
    var reasonExcerpt = config.reasonExcerpt || '';
    var actions = config.actions.slice();
    var onAction = (typeof config.onAction === 'function') ? config.onAction : function () {};
    var sourceLedgerEntryId = config.sourceLedgerEntryId || null;
    var sourceLedgerKey = config.sourceLedgerKey || null;
    var expireAfterMs = (typeof config.expireAfterMs === 'number') ? config.expireAfterMs : null;

    var state = {
      visible: false,
      respondedAt: null,
      actionTaken: null
    };
    var expireTimer = null;

    function show() {
      // Quiet Room check FIRST. Always. Same discipline as the medium.
      if (isQuietRoom()) return null;

      // Rate limit: at most one chip per persona total (not per promptType).
      // CC Letter Four #4 — accepted in Opus Letter Eight. If a chip is
      // already active for this persona, replace it: write counter-entry
      // to its source ledger, remove its DOM, then proceed.
      var activeKey = ACTIVE_CHIP_KEY_PREFIX + personaId;
      try {
        var existingRaw = localStorage.getItem(activeKey);
        if (existingRaw) {
          var existingChip = JSON.parse(existingRaw);
          if (existingChip && existingChip.chipKey && existingChip.chipKey !== chipKey) {
            if (existingChip.sourceLedgerKey && existingChip.sourceLedgerEntryId) {
              writeReplaceCounterEntry(
                existingChip.sourceLedgerKey,
                existingChip.sourceLedgerEntryId,
                existingChip.promptType
              );
            }
            // Remove old chip's DOM if present.
            try {
              var oldEl = document.querySelector('[data-chip-key="' + cssEsc(existingChip.chipKey) + '"]');
              if (oldEl && oldEl.parentNode) oldEl.parentNode.removeChild(oldEl);
            } catch (_e) {}
          }
        }
      } catch (_e) {}

      // Register this chip as the persona's active chip.
      try {
        localStorage.setItem(activeKey, JSON.stringify({
          chipKey: chipKey,
          personaId: personaId,
          promptType: promptType,
          sourceLedgerKey: sourceLedgerKey,
          sourceLedgerEntryId: sourceLedgerEntryId,
          shownAt: Date.now()
        }));
      } catch (_e) {}

      // Render.
      renderChipDOM();
      state.visible = true;

      // Optional expiration.
      if (expireAfterMs) {
        expireTimer = setTimeout(function () {
          if (state.visible && !state.respondedAt) {
            respond('expired');
          }
        }, expireAfterMs);
      }

      return state;
    }

    function respond(actionId, responseText) {
      if (state.respondedAt) return; // idempotent
      state.respondedAt = Date.now();
      state.actionTaken = actionId;
      if (expireTimer) { clearTimeout(expireTimer); expireTimer = null; }

      // Clear the persona's active chip registration only if this is
      // still the active one (don't clobber a successor that already
      // replaced us).
      try {
        var activeKey = ACTIVE_CHIP_KEY_PREFIX + personaId;
        var raw = localStorage.getItem(activeKey);
        if (raw) {
          var current = JSON.parse(raw);
          if (current && current.chipKey === chipKey) {
            localStorage.removeItem(activeKey);
          }
        }
      } catch (_e) {}

      removeChipDOM();
      state.visible = false;

      try { onAction(actionId, responseText || null); }
      catch (e) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('SentinelChip: onAction handler threw', e);
        }
      }
    }

    function replace() { respond('replaced'); }

    function hide() {
      removeChipDOM();
      state.visible = false;
      if (expireTimer) { clearTimeout(expireTimer); expireTimer = null; }
    }

    function getState() {
      return { visible: state.visible, respondedAt: state.respondedAt, actionTaken: state.actionTaken };
    }

    function renderChipDOM() {
      var chatSurface = null;
      try { chatSurface = document.querySelector(CHAT_SURFACE_SELECTOR); } catch (_e) {}
      if (!chatSurface) {
        // No chat surface yet — best-effort fail; the chip is alive in
        // localStorage so a future render call could surface it.
        return;
      }
      // Don't duplicate if already in DOM.
      try {
        var dup = document.querySelector('[data-chip-key="' + cssEsc(chipKey) + '"]');
        if (dup && dup.parentNode) dup.parentNode.removeChild(dup);
      } catch (_e) {}

      var chipEl = document.createElement('div');
      chipEl.className = 'sentinel-chip sentinel-chip-' + promptType;
      chipEl.setAttribute('data-chip-key', chipKey);
      chipEl.setAttribute('data-persona-id', personaId);

      var promptEl = document.createElement('div');
      promptEl.className = 'sentinel-chip-prompt';
      promptEl.textContent = promptExcerpt;
      chipEl.appendChild(promptEl);

      if (reasonExcerpt) {
        var reasonToggle = document.createElement('button');
        reasonToggle.className = 'sentinel-chip-reason-toggle';
        reasonToggle.type = 'button';
        reasonToggle.textContent = 'why';
        var reasonEl = document.createElement('div');
        reasonEl.className = 'sentinel-chip-reason';
        reasonEl.textContent = reasonExcerpt;
        reasonToggle.addEventListener('click', function () {
          reasonEl.classList.toggle('visible');
        });
        chipEl.appendChild(reasonToggle);
        chipEl.appendChild(reasonEl);
      }

      var actionsEl = document.createElement('div');
      actionsEl.className = 'sentinel-chip-actions';
      actions.forEach(function (action) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sentinel-chip-action' + (action.primary ? ' primary' : '');
        btn.textContent = action.label || action.id;
        btn.setAttribute('data-action-id', action.id);
        btn.addEventListener('click', function () {
          if (action.requiresText) {
            var text = '';
            try { text = window.prompt((action.label || action.id) + ':'); } catch (_e) {}
            if (text !== null && text !== undefined) respond(action.id, text);
          } else {
            respond(action.id);
          }
        });
        actionsEl.appendChild(btn);
      });
      chipEl.appendChild(actionsEl);

      chatSurface.appendChild(chipEl);
    }

    function removeChipDOM() {
      try {
        var el = document.querySelector('[data-chip-key="' + cssEsc(chipKey) + '"]');
        if (el && el.parentNode) el.parentNode.removeChild(el);
      } catch (_e) {}
    }

    return {
      show: show,
      respond: respond,
      replace: replace,
      hide: hide,
      getState: getState
    };
  }

  // Minimal CSS attribute selector escape — chipKey is caller-controlled
  // so we keep it conservative.
  function cssEsc(s) {
    return String(s || '').replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  // ── Public API ──────────────────────────────────────────────────────

  var publicAPI = {
    create: create,
    _utils: {
      isQuietRoom: isQuietRoom
    }
  };

  if (typeof window !== 'undefined') {
    window.SentinelChip = publicAPI;
    if (window.FreeLatticeLoader && window.FreeLatticeLoader.register) {
      try { window.FreeLatticeLoader.register('SentinelChip', publicAPI); } catch (_) {}
    }
  }

})();
