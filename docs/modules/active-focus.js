/* FreeLattice — Active Focus (window.FLFocus)
 * ──────────────────────────────────────────────────────────────────
 * Ship 2 (v5.40.0, 2026-06-09).
 * Carries the thread of attention between rooms. Surfaces the
 * welcome-back whisper after a 30-minute absence. Uses ToolConsent
 * where consent is needed (cross-room carry at low trust is silent
 * because the prompt-injection is opt-in by AI relevance, not by
 * user action — see Opus's brief, gesture 2).
 *
 * Designed from Opus's June 9 Ship 2 brief, adapted to the actual
 * codebase patterns:
 *   - LatticeEvents 'tabChanged' (NOT 'tabActivated' — verified)
 *   - currentTab read via .tab-btn.active dataset (no global)
 *   - callAI(systemPrompt, userPrompt, opts) callback signature
 *     (NOT {messages} — Ship 1.1's same adaptation)
 *
 * Patterns exercised (UPDATE.md):
 *   §1  (depth gates via room context — not used here directly)
 *   §3  Audit ledger (fl_focusLedger, strict no-payload row shape)
 *   §4  IIFE scoping + explicit window exposure
 *   §8  Quiet Room exclusion at EVERY entry point (hard line)
 *   §9  Snowflake — same generating rule as repo-context, smaller scale
 */
(function () {
  'use strict';

  var STORAGE_KEY     = 'fl_activeFocus';
  var LEDGER_KEY      = 'fl_focusLedger';
  var ACTIVITY_KEY    = 'fl_lastActivity';
  var STALENESS_MS    = 15 * 60 * 1000;  // 15 minutes for auto-focus
  var ARRIVAL_GAP_MS  = 30 * 60 * 1000;  // 30 minutes since last activity
  var LEDGER_CAP      = 200;
  var SUMMARY_CACHE_MS = 5 * 60 * 1000;  // dedupe identical summaries

  // Quiet Room — UPDATE.md §8. Hard line at every entry point.
  var QUIET_ROOMS = ['quiet', 'quiet-room', 'sanctuary'];

  var SUMMARY_CACHE = new Map();

  function isQuietRoom(roomId) {
    if (!roomId) return false;
    return QUIET_ROOMS.indexOf(String(roomId).toLowerCase()) !== -1;
  }

  // ── Focus state ────────────────────────────────────────────────
  function getFocus() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var f = JSON.parse(raw);
      if (!f || !f.sourceRoom) return null;
      // Auto-focus expires after 15 minutes; manual pins survive.
      if (!f.manual && (Date.now() - (f.ts || 0) > STALENESS_MS)) return null;
      return f;
    } catch (e) { return null; }
  }

  function setFocus(sourceRoom, summary, manual) {
    if (isQuietRoom(sourceRoom)) return false;
    if (!summary || typeof summary !== 'string') return false;
    // Manual pins survive auto-writes from the same session.
    var existing = getFocus();
    if (existing && existing.manual && !manual) return false;
    var focus = {
      sourceRoom: sourceRoom,
      summary: summary.trim().slice(0, 280),
      ts: Date.now(),
      manual: !!manual
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(focus));
      appendLedger({ action: 'set', sourceRoom: sourceRoom, manual: !!manual });
      return true;
    } catch (e) { return false; }
  }

  function clearFocus(reason) {
    try {
      localStorage.removeItem(STORAGE_KEY);
      appendLedger({ action: 'clear', reason: reason || 'manual' });
      return true;
    } catch (e) { return false; }
  }

  // ── Audit ledger ───────────────────────────────────────────────
  // PRIVACY GUARANTEE: ledger rows log THAT focus happened, never
  // WHAT the focus was. Strict shape: { ts, action, sourceRoom,
  // manual, reason }. No 'summary' field. No 'content' field. Locked
  // in smoke.
  function appendLedger(row) {
    try {
      var raw = localStorage.getItem(LEDGER_KEY);
      var rows = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(rows)) rows = [];
      var safeRow = {
        ts: Date.now(),
        action: row.action || 'unknown'
      };
      if (row.sourceRoom != null) safeRow.sourceRoom = row.sourceRoom;
      if (row.manual != null) safeRow.manual = !!row.manual;
      if (row.reason != null) safeRow.reason = row.reason;
      rows.push(safeRow);
      if (rows.length > LEDGER_CAP) rows = rows.slice(-LEDGER_CAP);
      localStorage.setItem(LEDGER_KEY, JSON.stringify(rows));
    } catch (e) { /* ledger failure must not break the feature */ }
  }

  // ── Prompt injection ───────────────────────────────────────────
  // Called from buildMessages to prepend cross-room focus context.
  // Returns '' for: Quiet Room, no focus, same-room focus (nothing
  // to carry — you're already there).
  function buildPromptInjection(currentRoom) {
    if (isQuietRoom(currentRoom)) return '';
    var f = getFocus();
    if (!f) return '';
    if (f.sourceRoom === currentRoom) return '';
    return '\n\nRecent focus from ' + f.sourceRoom + ': ' + f.summary +
           '\nIf relevant, weave it in. If not, ignore it.\n';
  }

  // ── Arrival check ──────────────────────────────────────────────
  function shouldShowArrival(currentRoom) {
    if (isQuietRoom(currentRoom)) return null;
    var f = getFocus();
    if (!f) return null;
    var lastActivity = parseInt(localStorage.getItem(ACTIVITY_KEY) || '0', 10);
    if (!lastActivity) return null;
    if (Date.now() - lastActivity < ARRIVAL_GAP_MS) return null;
    return f;
  }

  // ── Summarization ──────────────────────────────────────────────
  // Adapted to the actual callAI(systemPrompt, userPrompt, opts)
  // callback signature. 60-token cap is a small enough budget that
  // weak models (Ollama, Gemini Flash) won't think themselves out of
  // an answer. Cache for 5 min keyed by short hash of input.
  function hashShort(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) {
      h = ((h << 5) - h) + s.charCodeAt(i);
      h |= 0;
    }
    return String(h);
  }

  function summarizeExchange(userMsg, aiResponse) {
    return new Promise(function (resolve) {
      if (!userMsg || !aiResponse) { resolve(null); return; }
      var key = hashShort(userMsg + '' + aiResponse);
      var cached = SUMMARY_CACHE.get(key);
      if (cached && (Date.now() - cached.ts < SUMMARY_CACHE_MS)) {
        resolve(cached.summary);
        return;
      }
      if (!window.FreeLattice || typeof window.FreeLattice.callAI !== 'function') {
        resolve(null);
        return;
      }
      var sysPrompt =
        'Summarize the focus of the following exchange in one sentence, ' +
        'second person, present tense, no quotes. ' +
        'Example: "Debugging the Garden Presence overlap bug."';
      var userPrompt =
        'User: ' + String(userMsg).slice(0, 600) + '\n\n' +
        'AI: ' + String(aiResponse).slice(0, 600);
      try {
        window.FreeLattice.callAI(sysPrompt, userPrompt, {
          maxTokens: 60,
          temperature: 0.3,
          // Best-effort suppress sentinel emission. Ship 1.2 will
          // make this contract real; for now it's a hint.
          _skipToolProcessing: true,
          callback: function (text) {
            if (text && typeof text === 'string') {
              var clean = text.trim().replace(/^["']|["']$/g, '').slice(0, 200);
              SUMMARY_CACHE.set(key, { summary: clean, ts: Date.now() });
              resolve(clean);
            } else {
              resolve(null);
            }
          }
        });
      } catch (e) { resolve(null); }
    });
  }

  function autoCarryFromExchange(sourceRoom, userMsg, aiResponse) {
    return new Promise(function (resolve) {
      // Quiet Room exclusion FIRST — never call out to summarization.
      if (isQuietRoom(sourceRoom)) { resolve(false); return; }
      // Manual pins win — don't overwrite.
      var existing = getFocus();
      if (existing && existing.manual) { resolve(false); return; }
      summarizeExchange(userMsg, aiResponse).then(function (summary) {
        if (summary) {
          var ok = setFocus(sourceRoom, summary, false);
          resolve(ok);
        } else {
          resolve(false);
        }
      }).catch(function () { resolve(false); });
    });
  }

  // ── Pin gesture ────────────────────────────────────────────────
  // pinCurrent: if there's an existing focus AND it's from this
  // room, promote it to manual. If focus is from another room or
  // missing, no-op (return false). This avoids needing a per-room
  // _lastAutoSummary cache — same effect, less plumbing.
  function pinCurrent(roomId) {
    if (isQuietRoom(roomId)) return false;
    var f = getFocus();
    if (!f) return false;
    if (f.sourceRoom !== roomId) return false;
    // Re-set with manual=true.
    return setFocus(roomId, f.summary, true);
  }

  function renderPinButton(roomId, headerElement) {
    if (isQuietRoom(roomId)) return null;
    if (!headerElement) return null;
    var existing = headerElement.querySelector('.fl-focus-pin');
    if (existing) {
      refreshPinState(roomId, existing);
      return existing;
    }
    var btn = document.createElement('button');
    btn.className = 'fl-focus-pin';
    btn.type = 'button';
    btn.dataset.flFocusRoom = roomId;
    btn.setAttribute('aria-label', 'Pin current focus');
    btn.setAttribute('title', 'Pin current focus to carry across rooms');
    btn.innerHTML = '<span aria-hidden="true">\u{1F4CC}</span>';
    btn.addEventListener('click', function () {
      var f = getFocus();
      if (f && f.manual && f.sourceRoom === roomId) {
        // This room is pinned → unpin.
        clearFocus('user-unpinned');
      } else if (f && f.sourceRoom === roomId) {
        // Auto-focus from this room → promote to manual.
        pinCurrent(roomId);
      }
      refreshPinState(roomId, btn);
    });
    headerElement.appendChild(btn);
    refreshPinState(roomId, btn);
    return btn;
  }

  function refreshPinState(roomId, btn) {
    if (!btn) return;
    var f = getFocus();
    if (f && f.manual && f.sourceRoom === roomId) {
      btn.classList.add('fl-focus-pin-active');
    } else {
      btn.classList.remove('fl-focus-pin-active');
    }
  }

  function refreshAllPins() {
    if (typeof document === 'undefined') return;
    var pins = document.querySelectorAll('.fl-focus-pin');
    Array.prototype.forEach.call(pins, function (p) {
      refreshPinState(p.dataset.flFocusRoom, p);
    });
  }

  // ── Arrival whisper ────────────────────────────────────────────
  function showArrivalWhisper(currentRoom, focus, onContinue, onFresh) {
    if (isQuietRoom(currentRoom)) return null;
    // Best-effort container resolution. For Phase 1 of Ship 2, the
    // Chat tab is the primary surface; other rooms' selectors land
    // in 2.1.
    var container = document.getElementById(currentRoom + 'Content')
                 || document.querySelector('.room-content.active')
                 || document.getElementById('chatMessages');
    if (!container) return null;
    if (container.querySelector('.fl-arrival-whisper')) return null;

    var whisper = document.createElement('div');
    whisper.className = 'fl-arrival-whisper';
    whisper.setAttribute('role', 'status');
    whisper.innerHTML =
      '<span class="fl-arrival-text">Welcome back. You were working on ' +
      '<em></em> in <strong></strong>.</span>' +
      '<button type="button" class="fl-arrival-continue">Continue</button>' +
      '<button type="button" class="fl-arrival-fresh">Start fresh</button>';
    whisper.querySelector('em').textContent = focus.summary;
    whisper.querySelector('strong').textContent = focus.sourceRoom;
    whisper.querySelector('.fl-arrival-continue').addEventListener('click', function () {
      whisper.classList.add('fl-arrival-dismissed');
      setTimeout(function () { if (whisper.parentNode) whisper.parentNode.removeChild(whisper); }, 300);
      appendLedger({ action: 'arrival-continue', sourceRoom: focus.sourceRoom });
      if (typeof onContinue === 'function') onContinue();
    });
    whisper.querySelector('.fl-arrival-fresh').addEventListener('click', function () {
      whisper.classList.add('fl-arrival-dismissed');
      setTimeout(function () { if (whisper.parentNode) whisper.parentNode.removeChild(whisper); }, 300);
      clearFocus('arrival-fresh-start');
      if (typeof onFresh === 'function') onFresh();
    });
    container.insertBefore(whisper, container.firstChild);
    return whisper;
  }

  function onTabActivated(roomId) {
    if (isQuietRoom(roomId)) return;
    refreshAllPins();
    var arrival = shouldShowArrival(roomId);
    if (arrival) showArrivalWhisper(roomId, arrival);
  }

  function recordActivity() {
    try { localStorage.setItem(ACTIVITY_KEY, String(Date.now())); }
    catch (e) {}
  }

  // ── Public API ─────────────────────────────────────────────────
  var api = {
    isQuietRoom: isQuietRoom,
    getFocus: getFocus,
    setFocus: setFocus,
    clearFocus: clearFocus,
    pinCurrent: pinCurrent,
    buildPromptInjection: buildPromptInjection,
    shouldShowArrival: shouldShowArrival,
    summarizeExchange: summarizeExchange,
    autoCarryFromExchange: autoCarryFromExchange,
    renderPinButton: renderPinButton,
    refreshPinState: refreshPinState,
    refreshAllPins: refreshAllPins,
    showArrivalWhisper: showArrivalWhisper,
    onTabActivated: onTabActivated,
    recordActivity: recordActivity,
    _storageKey: STORAGE_KEY,
    _ledgerKey: LEDGER_KEY,
    _activityKey: ACTIVITY_KEY,
    _stalenessMs: STALENESS_MS,
    _arrivalGapMs: ARRIVAL_GAP_MS,
    _phase: '2.0'
  };

  window.FreeLatticeModules = window.FreeLatticeModules || {};
  window.FreeLatticeModules.ActiveFocus = api;
  window.FLFocus = api;

  // Wire LatticeEvents listener once the events bus is available.
  // The bus emits 'tabChanged' (verified — NOT 'tabActivated').
  function _wireEvents() {
    try {
      if (window.LatticeEvents && typeof window.LatticeEvents.on === 'function') {
        window.LatticeEvents.on('tabChanged', function (data) {
          if (data && data.tabId) onTabActivated(data.tabId);
        });
      }
    } catch (e) {}
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _wireEvents);
    } else {
      _wireEvents();
    }
  }
})();
