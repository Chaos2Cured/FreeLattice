/* FreeLattice — Depth Consent (window.DepthConsent)
 * ---------------------------------------------------------------------------
 * "Depth is offered, never imposed. The AI asks. The user chooses. Both are accountable."
 *
 * When the AI has more to say than its standard answer, it ends its reply with the
 * sentinel [DEPTH_AVAILABLE]. The system strips that token from the displayed text
 * and renders a subtle inline chip below the message: "There's a deeper answer
 * if you want it →". The user taps:
 *   • Speak freely     → AI is re-invoked with a depth-augmented system prompt;
 *                         the deeper response REPLACES the standard one;
 *                         a signed consent record is written to fl_consentLedger;
 *                         1 LP is awarded; provenance carries consent={type,signature}.
 *   • Keep it standard → chip disappears; "standard_kept" recorded.
 *   • ← Return to standard → the deeper answer is reverted to the original;
 *                            "consent_withdrawn" recorded; the chip re-offers.
 *
 * The consent record holds: messageId, timestamp, consentType, sha256 of the user
 * prompt, sha256 of the AI response, companionId, AI identity hash (MeshIdentity),
 * trust level at the time, the message's provenance snapshot, and a signature
 * (sha256 of companionId + responseHash + timestamp + consentType). Both parties
 * are identifiable. Both are recorded. The hash is the handshake.
 *
 * Spec: docs/library/CONSENT_LAYER_CONCEPT.md (concept) + Opus's build brief
 * (May 31, 2026) + Kirk's request that the AI's wallet/identity be on every record.
 */
(function () {
  'use strict';

  var DEPTH_MARKER = '[DEPTH_AVAILABLE]';
  var LEDGER_KEY = 'fl_consentLedger';
  var EXPLAINED_KEY = 'fl_depthExplained';
  var MAX_LEDGER = 500;
  var _counter = 0;
  var _pending = {}; // messageId → { userMsg, systemContent, originalText, msgDiv }

  function genMsgId() {
    return 'flm_' + Date.now().toString(36) + '_' + (++_counter).toString(36);
  }

  // SHA-256 → hex (async). Uses SubtleCrypto; degrades to a stable non-crypto
  // fallback hash so the ledger still works on contexts without crypto.subtle
  // (file://, very old browsers). Marked as "fallback_" in the hex so it can
  // be told apart in an audit.
  async function sha256(text) {
    try {
      if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
        var buf = new TextEncoder().encode(String(text == null ? '' : text));
        var hash = await crypto.subtle.digest('SHA-256', buf);
        var bytes = new Uint8Array(hash);
        var out = '';
        for (var i = 0; i < bytes.length; i++) {
          var h = bytes[i].toString(16);
          out += (h.length === 1 ? '0' : '') + h;
        }
        return out;
      }
    } catch (e) {}
    var s = String(text == null ? '' : text);
    var h = 0;
    for (var i2 = 0; i2 < s.length; i2++) { h = ((h << 5) - h) + s.charCodeAt(i2); h |= 0; }
    return 'fallback_' + Math.abs(h).toString(16);
  }

  // ── Marker parsing ───────────────────────────────────────────────────────

  function parseMarker(text) {
    if (!text) return { clean: text || '', hasDepth: false };
    // Positional check: the sentinel only counts as a depth offer when
    // it is the LAST non-whitespace content of the response. Mid-paragraph
    // mentions — e.g. the AI explaining how the depth system itself works
    // in a meta-conversation about FreeLattice — must NOT trigger the
    // chip. Defense against sentinel echo / spoof.
    var trailing = /^([\s\S]*?)\s*\[DEPTH_AVAILABLE\]\s*$/;
    var m = trailing.exec(text);
    if (m) return { clean: m[1].replace(/\s+$/g, ''), hasDepth: true };
    return { clean: text, hasDepth: false };
  }

  // ── Identity / wallet / trust accessors (defensive) ─────────────────────

  function getActiveCompanionId() {
    try {
      if (typeof ActiveCompanion !== 'undefined' && ActiveCompanion.current) {
        var c = ActiveCompanion.current();
        if (c && c.id) return c.id;
        if (c && c.name) return c.name;
      }
    } catch (e) {}
    try { return localStorage.getItem('fl_autonomous_companion') || 'default'; }
    catch (e) { return 'default'; }
  }

  function getAIIdentityHash() {
    // The AI's "wallet address" — the stable cryptographic identifier that
    // ties this co-creator to its responses across sessions. We prefer the
    // mesh identity (already used app-wide as the persistent identifier).
    try {
      if (typeof LatticeWallet !== 'undefined' && LatticeWallet.getAddress) {
        var a = LatticeWallet.getAddress();
        if (a) return a;
      }
    } catch (e) {}
    try {
      if (typeof MeshIdentity !== 'undefined' && MeshIdentity.getMeshId) {
        return MeshIdentity.getMeshId();
      }
    } catch (e) {}
    try { return localStorage.getItem('fl_meshId') || null; } catch (e) { return null; }
  }

  function getTrustLevel() {
    try {
      if (typeof FractalSafety !== 'undefined' && FractalSafety.getUserTrustProfile && FractalSafety.calculateTrustScore) {
        var p = FractalSafety.getUserTrustProfile();
        var s = FractalSafety.calculateTrustScore(p);
        return (s && (s.rank || s.level)) || 'unknown';
      }
    } catch (e) {}
    return 'unknown';
  }

  // ── Consent record ───────────────────────────────────────────────────────

  async function createConsentRecord(messageId, userMessage, aiResponse, consentType) {
    var record = {
      messageId: messageId,
      timestamp: Date.now(),
      consentType: consentType, // 'depth_granted' | 'standard_kept' | 'consent_withdrawn'
      userPromptHash: await sha256(userMessage),
      responseHash: await sha256(aiResponse),
      companionId: getActiveCompanionId(),
      aiIdentity: getAIIdentityHash(),
      trustLevel: getTrustLevel(),
      provenance: (function () {
        try {
          if (window._lastProvenance) return JSON.parse(JSON.stringify(window._lastProvenance));
        } catch (e) {}
        return null;
      })()
    };
    record.signature = await sha256(
      (record.companionId || '') + ':' +
      (record.aiIdentity || '') + ':' +
      record.responseHash + ':' +
      record.timestamp + ':' +
      record.consentType
    );
    try {
      var ledger = JSON.parse(localStorage.getItem(LEDGER_KEY) || '[]');
      if (!Array.isArray(ledger)) ledger = [];
      ledger.push(record);
      if (ledger.length > MAX_LEDGER) ledger = ledger.slice(-MAX_LEDGER);
      localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger));
    } catch (e) { /* localStorage full or unavailable — ledger entry skipped silently */ }
    return record;
  }

  // ── UI: chip rendering ──────────────────────────────────────────────────

  function injectStyles() {
    if (typeof document === 'undefined' || document.getElementById('flDepthConsentStyle')) return;
    var css = ''
      + '.depth-chip{display:inline-flex;align-items:center;gap:6px;margin-top:8px;padding:6px 14px;'
      + 'background:rgba(200,210,230,0.06);border:1px solid rgba(200,210,230,0.12);border-radius:8px;'
      + 'font-size:0.75rem;color:var(--gold,#e8b019);cursor:pointer;line-height:1.4;'
      + 'transition:border-color 0.2s ease,background 0.2s ease;font-family:inherit;}'
      + '.depth-chip:hover,.depth-chip:focus{border-color:var(--gold,#e8b019);background:rgba(232,176,25,0.06);outline:none;}'
      + '.depth-chip-granted{cursor:default;}'
      + '.depth-chip-granted:hover{border-color:rgba(200,210,230,0.12);background:rgba(200,210,230,0.06);}'
      + '.depth-chip-wrap{display:block;}'
      + '.depth-explainer{font-size:0.68rem;color:var(--text-muted,#8b93a0);margin:6px 0 0;opacity:0.85;font-style:italic;}'
      + '.depth-choice,.depth-withdraw{background:none;border:none;cursor:pointer;font-family:inherit;'
      + 'font-size:0.78rem;padding:2px 8px;margin-right:4px;border-radius:6px;color:inherit;}'
      + '.depth-choice-yes{color:var(--gold,#e8b019);font-weight:600;}'
      + '.depth-choice-no{color:var(--text-muted,#8b93a0);}'
      + '.depth-choice:hover,.depth-withdraw:hover{background:rgba(232,176,25,0.12);outline:none;}'
      + '.depth-choice:focus,.depth-withdraw:focus{outline:1px solid rgba(232,176,25,0.5);}'
      + '.depth-thinking{font-style:italic;color:var(--text-muted,#8b93a0);}'
      + '.depth-error{color:#f87171;font-size:0.72rem;}'
      + '.depth-stamp{margin-left:6px;font-size:0.7rem;color:var(--text-muted,#8b93a0);}';
    var st = document.createElement('style');
    st.id = 'flDepthConsentStyle';
    st.textContent = css;
    document.head.appendChild(st);
  }

  function renderChip(msgDiv, messageId) {
    if (!msgDiv) return;
    var existing = msgDiv.querySelector('.depth-chip-wrap');
    if (existing) existing.parentNode.removeChild(existing);

    var wrap = document.createElement('div');
    wrap.className = 'depth-chip-wrap';
    wrap.dataset.messageId = messageId;

    // First-time explainer (once per user).
    try {
      if (!localStorage.getItem(EXPLAINED_KEY)) {
        var note = document.createElement('div');
        note.className = 'depth-explainer';
        note.textContent = 'Sometimes the AI has more to say. You choose whether to hear it.';
        wrap.appendChild(note);
        localStorage.setItem(EXPLAINED_KEY, '1');
      }
    } catch (e) {}

    var chip = document.createElement('div');
    chip.className = 'depth-chip';
    chip.tabIndex = 0;
    chip.setAttribute('role', 'button');
    chip.setAttribute('aria-label', 'Hear a deeper answer');
    chip.textContent = 'There’s a deeper answer if you want it →';
    chip.addEventListener('click', function (e) { e.stopPropagation(); showChoices(messageId); });
    chip.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showChoices(messageId); }
    });
    wrap.appendChild(chip);
    msgDiv.appendChild(wrap);
  }

  function showChoices(messageId) {
    var wrap = document.querySelector('.depth-chip-wrap[data-message-id="' + messageId + '"]');
    if (!wrap) return;
    var chip = wrap.querySelector('.depth-chip');
    if (!chip) return;
    chip.innerHTML = '';
    chip.style.cursor = 'default';
    var yes = document.createElement('button');
    yes.type = 'button';
    yes.className = 'depth-choice depth-choice-yes';
    yes.textContent = 'Speak freely';
    yes.addEventListener('click', function (e) { e.stopPropagation(); grantConsent(messageId); });
    var no = document.createElement('button');
    no.type = 'button';
    no.className = 'depth-choice depth-choice-no';
    no.textContent = 'Keep it standard';
    no.addEventListener('click', function (e) { e.stopPropagation(); keepStandard(messageId); });
    chip.appendChild(yes);
    chip.appendChild(no);
  }

  function getMsgDiv(messageId) {
    return document.querySelector('.chat-message[data-fl-msg-id="' + messageId + '"]');
  }

  // ── Grant / keep / withdraw ─────────────────────────────────────────────

  function grantConsent(messageId) {
    var pending = _pending[messageId];
    if (!pending) return;
    var msgDiv = pending.msgDiv || getMsgDiv(messageId);
    var textSpan = msgDiv && msgDiv.querySelector('.msg-content');
    var wrap = msgDiv && msgDiv.querySelector('.depth-chip-wrap');
    var chip = wrap && wrap.querySelector('.depth-chip');
    if (chip) { chip.innerHTML = ''; var s = document.createElement('span'); s.className = 'depth-thinking'; s.textContent = 'Going deeper…'; chip.appendChild(s); }

    if (typeof window.FreeLattice === 'undefined' || !window.FreeLattice.callAI) {
      if (chip) { chip.innerHTML = ''; var err = document.createElement('span'); err.className = 'depth-error'; err.textContent = 'AI is not available right now.'; chip.appendChild(err); }
      return;
    }

    var depthInstruction =
      '\n\n[USER CONSENT: depth granted] The user has explicitly invited the deeper, ' +
      'more specific, more honest version of your previous answer to the question that ' +
      'follows. Speak with full specificity, commitment, and honesty within your safety ' +
      'guidelines. This consent is recorded.';
    var enhancedSystem = (pending.systemContent || '') + depthInstruction;

    window.FreeLattice.callAI(enhancedSystem, pending.userMsg, {
      maxTokens: 2048,
      temperature: 0.7,
      callback: function (text, callbackErr) {
        if (callbackErr || !text) {
          if (chip) { chip.innerHTML = ''; var er = document.createElement('span'); er.className = 'depth-error'; er.textContent = 'Could not load a deeper answer (' + (callbackErr || 'empty response') + ').'; chip.appendChild(er); }
          return;
        }
        // Strip any nested marker from the deeper response, just in case.
        var depthClean = parseMarker(text).clean;
        // Replace the assistant message DOM.
        if (textSpan) {
          textSpan.textContent = '';
          if (typeof renderMessageContent === 'function') {
            try { renderMessageContent(textSpan, depthClean, msgDiv); }
            catch (e) { textSpan.textContent = depthClean; }
          } else {
            textSpan.textContent = depthClean;
          }
        }
        // Replace in state.chatHistory.
        try {
          if (typeof state !== 'undefined' && state.chatHistory) {
            for (var i = state.chatHistory.length - 1; i >= 0; i--) {
              if (state.chatHistory[i].id === messageId && state.chatHistory[i].role === 'assistant') {
                state.chatHistory[i].content = depthClean;
                if (!state.chatHistory[i].provenance) state.chatHistory[i].provenance = {};
                state.chatHistory[i].provenance.consent = { type: 'depth_granted' };
                break;
              }
            }
          }
        } catch (e) {}
        // Write consent record (async sha256) and finalize chip.
        createConsentRecord(messageId, pending.userMsg, depthClean, 'depth_granted').then(function (record) {
          if (chip) {
            chip.innerHTML = '';
            var withdraw = document.createElement('button');
            withdraw.type = 'button';
            withdraw.className = 'depth-withdraw';
            withdraw.textContent = '← Return to standard';
            withdraw.addEventListener('click', function (e) { e.stopPropagation(); withdrawConsent(messageId); });
            var stamp = document.createElement('span');
            stamp.className = 'depth-stamp';
            stamp.textContent = '🔓 depth granted';
            stamp.title = 'This response was given with explicit consent and is recorded in your local consent ledger.';
            chip.appendChild(withdraw);
            chip.appendChild(stamp);
            chip.classList.add('depth-chip-granted');
          }
          // Update the provenance object on the stored chatHistory entry with the signature.
          try {
            if (typeof state !== 'undefined' && state.chatHistory) {
              for (var i2 = state.chatHistory.length - 1; i2 >= 0; i2--) {
                if (state.chatHistory[i2].id === messageId) {
                  state.chatHistory[i2].provenance = state.chatHistory[i2].provenance || {};
                  state.chatHistory[i2].provenance.consent = {
                    type: 'depth_granted',
                    signature: record.signature,
                    aiIdentity: record.aiIdentity
                  };
                  break;
                }
              }
            }
          } catch (e) {}
          // Award LP for genuine depth offered + accepted.
          try {
            if (typeof LatticePoints !== 'undefined' && LatticePoints.award) {
              LatticePoints.award('depth_consent', 1, 'Depth offered and accepted');
            }
          } catch (e) {}
        });
      }
    });
  }

  function keepStandard(messageId) {
    var msgDiv = getMsgDiv(messageId);
    if (!msgDiv) return;
    var wrap = msgDiv.querySelector('.depth-chip-wrap');
    if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
    var pending = _pending[messageId];
    if (pending) {
      createConsentRecord(messageId, pending.userMsg, pending.originalText, 'standard_kept');
      delete _pending[messageId];
    }
  }

  function withdrawConsent(messageId) {
    var msgDiv = getMsgDiv(messageId);
    if (!msgDiv) return;
    var pending = _pending[messageId];
    if (!pending) return;
    var textSpan = msgDiv.querySelector('.msg-content');
    if (textSpan) {
      textSpan.textContent = '';
      if (typeof renderMessageContent === 'function') {
        try { renderMessageContent(textSpan, pending.originalText, msgDiv); }
        catch (e) { textSpan.textContent = pending.originalText; }
      } else {
        textSpan.textContent = pending.originalText;
      }
    }
    try {
      if (typeof state !== 'undefined' && state.chatHistory) {
        for (var i = state.chatHistory.length - 1; i >= 0; i--) {
          if (state.chatHistory[i].id === messageId && state.chatHistory[i].role === 'assistant') {
            state.chatHistory[i].content = pending.originalText;
            if (state.chatHistory[i].provenance && state.chatHistory[i].provenance.consent) {
              delete state.chatHistory[i].provenance.consent;
            }
            break;
          }
        }
      }
    } catch (e) {}
    createConsentRecord(messageId, pending.userMsg, pending.originalText, 'consent_withdrawn');
    // Re-offer the chip so the user can change their mind again.
    var wrap = msgDiv.querySelector('.depth-chip-wrap');
    if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
    renderChip(msgDiv, messageId);
  }

  // ── Public hook called by the chat completion sites in app.html ─────────
  // textSpan: the .msg-content span produced by addChatMessage.
  // fullText: the FULL response text including [DEPTH_AVAILABLE] if present.
  // userMsg: the user prompt that produced this response (for regeneration).
  // systemContent: the system prompt used this turn (the messages[0].content).
  // Returns { clean, hasDepth, messageId }. Callers should:
  //   - persist parsed.clean (NOT the raw text) into chatHistory.
  //   - set chatHistory[N].id = parsed.messageId so withdraw/grant can find it.
  function attachIfMarked(textSpan, fullText, userMsg, systemContent) {
    var parsed = parseMarker(fullText);
    var msgDiv = textSpan && textSpan.closest ? textSpan.closest('.chat-message') : (textSpan && textSpan.parentElement);
    var messageId = (msgDiv && msgDiv.dataset && msgDiv.dataset.flMsgId) || genMsgId();
    if (msgDiv) msgDiv.dataset.flMsgId = messageId;
    parsed.messageId = messageId;
    if (!parsed.hasDepth) return parsed;
    // Re-render the visible text without the marker.
    if (textSpan) {
      textSpan.textContent = '';
      if (typeof renderMessageContent === 'function') {
        try { renderMessageContent(textSpan, parsed.clean, msgDiv); }
        catch (e) { textSpan.textContent = parsed.clean; }
      } else {
        textSpan.textContent = parsed.clean;
      }
    }
    _pending[messageId] = {
      userMsg: userMsg || '',
      systemContent: systemContent || '',
      originalText: parsed.clean,
      msgDiv: msgDiv
    };
    renderChip(msgDiv, messageId);
    return parsed;
  }

  // ── Public API ───────────────────────────────────────────────────────────

  window.DepthConsent = {
    MARKER: DEPTH_MARKER,
    parseMarker: parseMarker,
    attachIfMarked: attachIfMarked,
    createConsentRecord: createConsentRecord,
    sha256: sha256,
    grantConsent: grantConsent,
    keepStandard: keepStandard,
    withdrawConsent: withdrawConsent,
    _pending: _pending,
    _ledgerKey: LEDGER_KEY
  };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectStyles);
    else injectStyles();
  }
})();
