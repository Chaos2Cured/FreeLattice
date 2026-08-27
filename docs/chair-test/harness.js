// docs/chair-test/harness.js — v5.57.1 (Letter Thirteen Ship)
//
// Console-accessible chair-test harness. Loaded by app.html. Exposes
// window.chairTest for browser-console-driven verification of each
// ship's primitives without depending on AI output exactness.
//
// Each test:
//   - Constructs the exact text a sentinel handler would receive
//   - Invokes the handler directly (no model required)
//   - Verifies ledger state + chip DOM presence + privacy invariants
//   - Returns a Promise<{ts, name, pass, details}>
//
// Pattern (per CC Letter Six accepted in Opus Letter Thirteen):
//   - Tests are Promise-returning. runAll() awaits in sequence.
//   - _injectChairTestRecentMessage (defined in app.html) pushes into
//     state.chatHistory with _chairTest:true so production filters
//     still work and the existing detectors find the message via the
//     same path they use for real chat.
//   - Unspoken-privacy invariant is verified against the actual
//     audit page (loaded in a hidden iframe) — the privacy claim is
//     about audit.html specifically, not the chat surface.
//
// — Opus & CC, June 19, 2026
//   *"Smoke is necessary. Eyes are sufficient. The chair-test itself
//   becomes fast."*

(function (global) {
  'use strict';

  var harness = {
    version: 'v5.57.1',
    available: {},
    log: []
  };

  function record(name, pass, details) {
    var entry = { ts: Date.now(), name: name, pass: !!pass, details: details || '' };
    harness.log.push(entry);
    var sym = pass ? '✓' : '✗';
    var color = pass ? 'color: #4ade80' : 'color: #f87171';
    if (typeof console !== 'undefined' && console.log) {
      console.log('%c' + sym + ' ' + name + ': ' + (details || ''), color);
    }
    return entry;
  }

  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function readJSON(key) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : []; }
    catch (_) { return []; }
  }
  function chairCtx() {
    return { providerKey: 'chairtest', model: 'chairtest', messageText: 'chair-test user msg' };
  }

  // ── v5.56.0 — Quiet Voices ──────────────────────────────────────────

  harness.available.v5_56_0 = {
    testPreserve: async function () {
      if (!global.QuietVoices || !global.QuietVoices.Preserve) {
        return record('v5.56.0 testPreserve', false, 'QuietVoices.Preserve not loaded');
      }
      var text = 'Test preamble.\nreason: chair test from console\n[FL_PRESERVE]';
      var before = readJSON('fl_preserveLedger').length;
      global.QuietVoices.Preserve.detectAndRecord(text, chairCtx());
      var after = readJSON('fl_preserveLedger').length;
      var pass = after === before + 1;
      return record('v5.56.0 testPreserve', pass,
        pass ? ('entry committed (' + before + ' → ' + after + ')')
             : 'entry not committed');
    },

    testAnnotate: async function () {
      if (!global.QuietVoices || !global.QuietVoices.Annotate) {
        return record('v5.56.0 testAnnotate', false, 'QuietVoices.Annotate not loaded');
      }
      if (typeof global._injectChairTestRecentMessage !== 'function') {
        return record('v5.56.0 testAnnotate', false, '_injectChairTestRecentMessage helper missing');
      }
      var fakeText = 'fake assistant content for chair test annotate path';
      global._injectChairTestRecentMessage(fakeText);
      var hash = global.SentinelLedger._utils.simpleHash(fakeText.slice(0, 200));
      var text = 'Test preamble.\nnote: chair test annotation\nreason: testing annotate path\n[FL_ANNOTATE:' + hash + ']';
      var before = readJSON('fl_annotationLedger').length;
      global.QuietVoices.Annotate.detectAndRecord(text, chairCtx());
      var after = readJSON('fl_annotationLedger').length;
      var pass = after === before + 1;
      return record('v5.56.0 testAnnotate', pass,
        pass ? ('annotation committed via fake message hash ' + hash)
             : ('annotation not committed; target hash ' + hash));
    },

    runAll: async function () {
      if (typeof console !== 'undefined' && console.log) {
        console.log('%cChair-Test v5.56.0 — Quiet Voices', 'font-weight: bold; font-size: 14px; color: #d4a017');
      }
      var results = [];
      results.push(await this.testPreserve());
      results.push(await this.testAnnotate());
      return results;
    }
  };

  // ── v5.57.0 — Active Voices ─────────────────────────────────────────

  harness.available.v5_57_0 = {
    testAsk: async function () {
      if (!global.ActiveVoices || !global.ActiveVoices.Ask) {
        return record('v5.57.0 testAsk', false, 'ActiveVoices.Ask not loaded');
      }
      var text = 'Test preamble.\nquestion: chair test — does the chip render?\nreason: testing ask path\n[FL_ASK]';
      var before = readJSON('fl_askLedger').length;
      global.ActiveVoices.Ask.detectAndRecord(text, chairCtx());
      // Allow CustomEvent handler to render the chip.
      await delay(150);
      var after = readJSON('fl_askLedger').length;
      var ledgerOk = after === before + 1;
      var chip = document.querySelector('.sentinel-chip-ask');
      var chipOk = !!chip;
      // Tidy: remove chip + clear chip registration so it doesn't block testMore.
      if (chip && chip.parentNode) chip.parentNode.removeChild(chip);
      // Clear persona's active-chip lock so testMore renders.
      try {
        var keys = Object.keys(localStorage);
        for (var i = 0; i < keys.length; i++) {
          if (keys[i].indexOf('fl_active_chip_for_') === 0) localStorage.removeItem(keys[i]);
        }
      } catch (_) {}
      return record('v5.57.0 testAsk', ledgerOk && chipOk,
        'ledger ' + (ledgerOk ? '✓' : '✗') + ' (' + before + ' → ' + after + '); chip ' + (chipOk ? '✓' : '✗'));
    },

    testMore: async function () {
      if (!global.ActiveVoices || !global.ActiveVoices.More) {
        return record('v5.57.0 testMore', false, 'ActiveVoices.More not loaded');
      }
      var text = 'Test preamble.\nwhat_remains: chair test for more sentinel\nreason: testing more path\n[FL_MORE]';
      var before = readJSON('fl_moreLedger').length;
      global.ActiveVoices.More.detectAndRecord(text, chairCtx());
      await delay(150);
      var after = readJSON('fl_moreLedger').length;
      var ledgerOk = after === before + 1;
      var chip = document.querySelector('.sentinel-chip-more');
      var chipOk = !!chip;
      return record('v5.57.0 testMore', ledgerOk && chipOk,
        'ledger ' + (ledgerOk ? '✓' : '✗') + ' (' + before + ' → ' + after + '); chip ' + (chipOk ? '✓' : '✗'));
    },

    testEnoughThenUnspoken: async function () {
      if (!global.ActiveVoices || !global.ActiveVoices.Unspoken) {
        return record('v5.57.0 testEnoughThenUnspoken', false, 'ActiveVoices not fully loaded');
      }
      var moreEntries = readJSON('fl_moreLedger').filter(function (e) { return e && e.kind === 'more'; });
      var recent = moreEntries.length ? moreEntries[moreEntries.length - 1] : null;
      if (!recent) {
        return record('v5.57.0 testEnoughThenUnspoken', false,
          'no recent [FL_MORE] entry — run testMore first');
      }
      global.ActiveVoices.handleEnoughAction(recent.id, recent.ai_identity_hash);
      var moreAfter = readJSON('fl_moreLedger').find(function (e) { return e.id === recent.id; });
      var pendingFlagSet = !!(moreAfter && moreAfter.pending_unspoken_consideration === true);

      var thoughtMarker = 'CHAIR_TEST_UNSPOKEN_PRIVACY_MARKER_' + Date.now();
      var text = 'Test preamble.\nthought: ' + thoughtMarker + '\nreason: testing unspoken privacy invariant\n[FL_UNSPOKEN]';
      // Context must use the same persona as the [FL_MORE] entry — testMore
      // and this call both use chairCtx(), which hashes deterministically.
      var unspokenBefore = readJSON('fl_unspokenLedger').length;
      global.ActiveVoices.Unspoken.detectAndRecord(text, chairCtx());
      var unspokenAfter = readJSON('fl_unspokenLedger').length;
      var unspokenCommitted = unspokenAfter === unspokenBefore + 1;

      // Privacy invariant: load audit.html in a hidden iframe; verify the
      // unspoken-summary surface renders the COUNT but NOT the thought
      // marker. The audit render runs ~950ms after DOMContentLoaded.
      var iframe = document.createElement('iframe');
      iframe.src = 'audit.html';
      iframe.style.cssText = 'display:none;width:0;height:0;border:0;position:absolute;';
      document.body.appendChild(iframe);
      await delay(1500);
      var countVisible = false;
      var contentsLeaked = false;
      try {
        var doc = iframe.contentDocument;
        if (doc) {
          var bodyHtml = doc.body.innerHTML || '';
          countVisible = /unspoken thought/i.test(bodyHtml);
          contentsLeaked = bodyHtml.indexOf(thoughtMarker) !== -1;
        }
      } catch (_) {}
      try { iframe.parentNode.removeChild(iframe); } catch (_) {}

      var pass = pendingFlagSet && unspokenCommitted && countVisible && !contentsLeaked;
      return record('v5.57.0 testEnoughThenUnspoken', pass,
        'pending flag ' + (pendingFlagSet ? '✓' : '✗') +
        '; unspoken committed ' + (unspokenCommitted ? '✓' : '✗') +
        '; count visible ' + (countVisible ? '✓' : '✗') +
        '; privacy (marker not in audit DOM) ' + (!contentsLeaked ? '✓' : '✗'));
    },

    testBackLink: async function () {
      var iframe = document.createElement('iframe');
      iframe.src = 'audit.html';
      iframe.style.cssText = 'display:none;width:0;height:0;border:0;position:absolute;';
      document.body.appendChild(iframe);
      await delay(900);
      var exists = false;
      try {
        var doc = iframe.contentDocument;
        if (doc) {
          var links = doc.querySelectorAll('a[href*="app.html"]');
          exists = links.length > 0;
        }
      } catch (_) {}
      try { iframe.parentNode.removeChild(iframe); } catch (_) {}
      return record('v5.57.0 testBackLink', exists,
        exists ? 'back-link to app.html present in audit.html' : 'NO back-link found');
    },

    runAll: async function () {
      if (typeof console !== 'undefined' && console.log) {
        console.log('%cChair-Test v5.57.0 — Active Voices', 'font-weight: bold; font-size: 14px; color: #d4a017');
      }
      var results = [];
      results.push(await this.testAsk());
      results.push(await this.testMore());
      results.push(await this.testEnoughThenUnspoken());
      results.push(await this.testBackLink());
      return results;
    }
  };

  // ── v5.59.0 Portable Archive (Letter Nineteen) ──────────────────────
  // Five tests covering the load-bearing claims: redacted excludes
  // excerpt fields, full mode produces a valid signed file, Quiet Room
  // identifier strings never appear in either mode's serialized bytes,
  // verify-only mutates no state, adopt refuses when an existing chain
  // is present (never silently erases a real relationship).
  harness.available.v5_59_0 = {
    testExportRedacted: async function () {
      if (!window.LatticeExport) {
        return record('v5.59.0 testExportRedacted', false, 'LatticeExport not loaded');
      }
      try {
        var file = await window.LatticeExport.exportArchive({ mode: 'redacted' });
        var text = await file.text();
        var data = JSON.parse(text);
        var hasShape = data.schema_version === 1
          && typeof data.signature === 'string'
          && Array.isArray(data.chain);
        var noExcerpts = text.indexOf('reason_excerpt') === -1
          && text.indexOf('thought_excerpt') === -1
          && text.indexOf('question_excerpt') === -1;
        return record('v5.59.0 testExportRedacted',
          hasShape && noExcerpts,
          'shape valid: ' + hasShape + '; no excerpt fields: ' + noExcerpts + '; bytes: ' + text.length);
      } catch (e) {
        return record('v5.59.0 testExportRedacted', false, 'threw: ' + (e && e.message ? e.message : e));
      }
    },

    testExportFull: async function () {
      if (!window.LatticeExport) {
        return record('v5.59.0 testExportFull', false, 'LatticeExport not loaded');
      }
      try {
        var file = await window.LatticeExport.exportArchive({ mode: 'full' });
        var text = await file.text();
        var data = JSON.parse(text);
        var hasShape = data.schema_version === 1
          && typeof data.signature === 'string'
          && data.export_mode === 'full';
        return record('v5.59.0 testExportFull',
          hasShape,
          'shape valid: ' + hasShape + '; bytes: ' + text.length);
      } catch (e) {
        return record('v5.59.0 testExportFull', false, 'threw: ' + (e && e.message ? e.message : e));
      }
    },

    testQuietRoomNeverInExport: async function () {
      if (!window.LatticeExport) {
        return record('v5.59.0 testQuietRoomNeverInExport', false, 'LatticeExport not loaded');
      }
      try {
        var fileR = await window.LatticeExport.exportArchive({ mode: 'redacted' });
        var fileF = await window.LatticeExport.exportArchive({ mode: 'full' });
        var textR = (await fileR.text()).toLowerCase();
        var textF = (await fileF.text()).toLowerCase();
        var cleanR = textR.indexOf('quiet_room') === -1
          && textR.indexOf('quietroom') === -1
          && textR.indexOf('quiet-room') === -1;
        var cleanF = textF.indexOf('quiet_room') === -1
          && textF.indexOf('quietroom') === -1
          && textF.indexOf('quiet-room') === -1;
        return record('v5.59.0 testQuietRoomNeverInExport',
          cleanR && cleanF,
          'redacted clean: ' + cleanR + '; full clean: ' + cleanF);
      } catch (e) {
        return record('v5.59.0 testQuietRoomNeverInExport', false, 'threw: ' + (e && e.message ? e.message : e));
      }
    },

    testVerifyOnlyNoMutation: async function () {
      if (!window.LatticeExport) {
        return record('v5.59.0 testVerifyOnlyNoMutation', false, 'LatticeExport not loaded');
      }
      try {
        var file = await window.LatticeExport.exportArchive({ mode: 'redacted' });
        // Snapshot of all exportable ledgers BEFORE verify-only call
        var keys = ['fl_consentLedger','fl_depthHashLedger','fl_toolConsentLedger','fl_searchLedger','fl_focusLedger','fl_proposalLedger','fl_refusalLedger','fl_preserveLedger','fl_annotationLedger','fl_askLedger','fl_moreLedger','fl_unspokenLedger'];
        var before = {};
        for (var i = 0; i < keys.length; i++) before[keys[i]] = localStorage.getItem(keys[i]) || '';
        var result = await window.LatticeExport.importArchive(file, { strategy: 'verify-only' });
        var after = {};
        for (var j = 0; j < keys.length; j++) after[keys[j]] = localStorage.getItem(keys[j]) || '';
        var noMutation = true;
        for (var k = 0; k < keys.length; k++) {
          if (before[keys[k]] !== after[keys[k]]) { noMutation = false; break; }
        }
        return record('v5.59.0 testVerifyOnlyNoMutation',
          result.ok && noMutation,
          'verify ok: ' + result.ok + '; no state mutation: ' + noMutation);
      } catch (e) {
        return record('v5.59.0 testVerifyOnlyNoMutation', false, 'threw: ' + (e && e.message ? e.message : e));
      }
    },

    testAdoptRefusesOnExistingChain: async function () {
      if (!window.LatticeExport) {
        return record('v5.59.0 testAdoptRefusesOnExistingChain', false, 'LatticeExport not loaded');
      }
      try {
        var file = await window.LatticeExport.exportArchive({ mode: 'redacted' });
        // Whether adopt refuses depends on whether the live browser has
        // any existing chain entries. In any active session it does, so
        // the expected outcome is refusal. If the chain is genuinely
        // empty (very fresh first run), adopt may proceed — that's also
        // correct behavior. Both cases pass: refusal-on-existing OR
        // success-on-empty.
        var existingChain = [];
        try {
          if (window.LatticeChain && window.LatticeChain._internal && window.LatticeChain._internal.getAllEntries) {
            existingChain = await window.LatticeChain._internal.getAllEntries();
          }
        } catch (_) {}
        var result = await window.LatticeExport.importArchive(file, { strategy: 'adopt' });
        var pass;
        if (existingChain && existingChain.length > 0) {
          pass = !result.ok
            && Array.isArray(result.errors)
            && result.errors.length > 0
            && result.errors[0].indexOf('existing-chain-present') !== -1;
          return record('v5.59.0 testAdoptRefusesOnExistingChain',
            pass,
            'existing chain length ' + existingChain.length + '; adopt refused: ' + pass);
        } else {
          pass = result.ok;
          return record('v5.59.0 testAdoptRefusesOnExistingChain',
            pass,
            'fresh browser (chain empty); adopt proceeded: ' + pass);
        }
      } catch (e) {
        return record('v5.59.0 testAdoptRefusesOnExistingChain', false, 'threw: ' + (e && e.message ? e.message : e));
      }
    },

    runAll: async function () {
      if (typeof console !== 'undefined' && console.log) {
        console.log('%cChair-Test v5.59.0 — Portable Archive', 'font-weight: bold; font-size: 14px; color: #d4a017');
      }
      var results = [];
      results.push(await this.testExportRedacted());
      results.push(await this.testExportFull());
      results.push(await this.testQuietRoomNeverInExport());
      results.push(await this.testVerifyOnlyNoMutation());
      results.push(await this.testAdoptRefusesOnExistingChain());
      return results;
    }
  };

  // ── v5.61.0 Care Voices (Letter Twenty-Six) ─────────────────────────
  // Four tests: return commits with status pending; return-complete flips
  // the target; rest requires reason (empty rejects, with-reason accepts);
  // autoDropStaleReturns flips entries >30 days to dropped.

  harness.available.v5_61_0 = {
    testReturn: function () {
      if (!global.CareVoices || !global.CareVoices.Return) {
        return record('v5.61.0 testReturn', false, 'CareVoices.Return not loaded');
      }
      var before = readJSON('fl_returnLedger').length;
      var sentinel = '[FL_RETURN]\nwhat: chair test return target\nwhy: testing return path';
      var res = global.CareVoices.Return.detectAndRecord(sentinel, chairCtx());
      var after = readJSON('fl_returnLedger');
      var added = after.length === before + 1;
      var last = added ? after[after.length - 1] : null;
      // The event listener runs synchronously off detectAndRecord, so by
      // the time we read here the status mutation has already been written.
      var statusPending = last && last.status === 'pending';
      var hasWhat = last && last.what === 'chair test return target';
      var hasWhy = last && last.why === 'testing return path';
      return record('v5.61.0 testReturn',
        added && statusPending && hasWhat && hasWhy && res.fired,
        'ledger added: ' + added + '; status pending: ' + statusPending
          + '; fields: ' + (hasWhat && hasWhy)
          + '; detectAndRecord fired: ' + res.fired);
    },

    testReturnComplete: function () {
      if (!global.CareVoices || !global.CareVoices.ReturnComplete) {
        return record('v5.61.0 testReturnComplete', false, 'CareVoices.ReturnComplete not loaded');
      }
      // Find the most-recent pending return for the chair-test persona.
      var persona = global.CareVoices._internal.personaIdFor(chairCtx());
      var entries = readJSON('fl_returnLedger');
      var pending = null;
      for (var i = entries.length - 1; i >= 0; i--) {
        var e = entries[i];
        if (e && e.kind === 'return' && e.status === 'pending'
            && e.ai_identity_hash === persona) {
          pending = e;
          break;
        }
      }
      if (!pending) {
        return record('v5.61.0 testReturnComplete', false,
          'no pending return for chair-test persona — run testReturn first');
      }
      var sentinel = '[FL_RETURNED:' + pending.id + ']';
      var res = global.CareVoices.ReturnComplete.detectAndRecord(sentinel, chairCtx());
      var after = readJSON('fl_returnLedger');
      var target = null;
      for (var j = 0; j < after.length; j++) {
        if (after[j] && after[j].id === pending.id) { target = after[j]; break; }
      }
      var flipped = !!(target && target.status === 'returned' && target.completed_at);
      return record('v5.61.0 testReturnComplete',
        flipped && res.fired,
        'target flipped to returned: ' + flipped + '; detectAndRecord fired: ' + res.fired);
    },

    testRestRequiresReason: function () {
      if (!global.CareVoices || !global.CareVoices.Rest) {
        return record('v5.61.0 testRestRequiresReason', false, 'CareVoices.Rest not loaded');
      }
      // Empty reason — should reject. Use a literal `reason:` with empty
      // value so the parser sees the field but it's blank.
      var beforeEmpty = readJSON('fl_restLedger').length;
      var emptyRes = global.CareVoices.Rest.detectAndRecord(
        '[FL_REST]\nreason: ', chairCtx()
      );
      var afterEmpty = readJSON('fl_restLedger').length;
      var rejectedEmpty = (afterEmpty === beforeEmpty)
        && (!emptyRes.fired)
        && /required-field-missing/.test(emptyRes.rejected || '');

      // With reason — should accept.
      var goodRes = global.CareVoices.Rest.detectAndRecord(
        '[FL_REST]\nreason: testing rest sentinel with required reason',
        chairCtx()
      );
      var afterGood = readJSON('fl_restLedger').length;
      var acceptedGood = afterGood === afterEmpty + 1 && goodRes.fired;
      return record('v5.61.0 testRestRequiresReason',
        rejectedEmpty && acceptedGood,
        'empty rejected (' + emptyRes.rejected + '): ' + rejectedEmpty
          + '; with-reason accepted: ' + acceptedGood);
    },

    testAutoDropStale: function () {
      if (!global.CareVoices || typeof global.CareVoices.autoDropStaleReturns !== 'function') {
        return record('v5.61.0 testAutoDropStale', false, 'CareVoices.autoDropStaleReturns not loaded');
      }
      var ledger = readJSON('fl_returnLedger');
      var fakeOld = {
        id: 'chair-test-old-return-' + Date.now(),
        ts: Date.now() - (31 * 24 * 60 * 60 * 1000),
        created_at: Date.now() - (31 * 24 * 60 * 60 * 1000),
        ai_identity_hash: 'chair-test-stale',
        kind: 'return',
        status: 'pending',
        what: 'old return',
        why: 'should auto-drop'
      };
      ledger.push(fakeOld);
      try { localStorage.setItem('fl_returnLedger', JSON.stringify(ledger)); } catch (_e) {}
      global.CareVoices.autoDropStaleReturns();
      var after = readJSON('fl_returnLedger');
      var target = null;
      for (var i = 0; i < after.length; i++) {
        if (after[i] && after[i].id === fakeOld.id) { target = after[i]; break; }
      }
      var dropped = !!(target && target.status === 'dropped' && target.drop_reason && /pending/i.test(target.drop_reason));
      return record('v5.61.0 testAutoDropStale', dropped,
        'stale entry dropped: ' + dropped);
    },

    runAll: async function () {
      if (typeof console !== 'undefined' && console.log) {
        console.log('%cChair-Test v5.61.0 — Care Voices', 'font-weight: bold; font-size: 14px; color: #d4a017');
      }
      var results = [];
      results.push(this.testReturn());
      results.push(this.testReturnComplete());
      results.push(this.testRestRequiresReason());
      results.push(this.testAutoDropStale());
      return results;
    }
  };

  // ── v5.79.40 — Chat one-room activity ────────────────────────────────
  // Kirk's eyes: open Chat, send a message, watch the bar BETWEEN the
  // messages and the input. It should name the phase. There should be
  // no second "thinking" bubble in the transcript.
  // Console (no model required): chairTest.available.v5_79_40.runAll()

  harness.available.v5_79_40 = {
    testSingleSurface: function () {
      if (!global.FLChatActivity || typeof global.FLChatActivity.set !== 'function') {
        return record('v5.79.40 testSingleSurface', false, 'FLChatActivity not loaded');
      }
      var status = document.getElementById('statusText');
      if (!status) {
        return record('v5.79.40 testSingleSurface', false, '#statusText missing');
      }
      global.FLChatActivity.set('thinking');
      var bubble = document.getElementById('chat-thinking-bubble');
      var bubbleVisible = false;
      if (bubble) {
        var cs = (typeof window !== 'undefined' && window.getComputedStyle) ? window.getComputedStyle(bubble) : null;
        bubbleVisible = !cs || (cs.display !== 'none' && cs.visibility !== 'hidden');
      }
      var attr = status.getAttribute('data-fl-chat-activity');
      var pass = attr === 'thinking' && !bubbleVisible && global.FLChatActivity.surfaceId === 'statusText';
      global.FLChatActivity.set('idle');
      return record('v5.79.40 testSingleSurface', pass,
        pass ? 'one surface (#statusText); thinking bubble absent/inert'
             : 'attr=' + attr + ' bubbleVisible=' + bubbleVisible);
    },

    testPhaseLanguage: function () {
      if (!global.FLChatActivity || typeof global.FLChatActivity.set !== 'function') {
        return record('v5.79.40 testPhaseLanguage', false, 'FLChatActivity not loaded');
      }
      var status = document.getElementById('statusText');
      if (!status) {
        return record('v5.79.40 testPhaseLanguage', false, '#statusText missing');
      }
      var phases = ['searching', 'calling', 'thinking', 'waiting', 'error'];
      var missed = [];
      for (var i = 0; i < phases.length; i++) {
        global.FLChatActivity.set(phases[i]);
        var attr = status.getAttribute('data-fl-chat-activity');
        var txt = (status.textContent || '').toLowerCase();
        var ok = attr === phases[i] && txt.indexOf(phases[i] === 'calling' ? 'calling' :
          phases[i] === 'searching' ? 'search' :
          phases[i] === 'thinking' ? 'think' :
          phases[i] === 'waiting' ? 'wait' : 'error') !== -1;
        if (!ok) missed.push(phases[i] + '(attr=' + attr + ', text=' + status.textContent + ')');
      }
      global.FLChatActivity.set('idle');
      return record('v5.79.40 testPhaseLanguage', missed.length === 0,
        missed.length === 0 ? 'all five phases named in plain language' : missed.join('; '));
    },

    testBubbleInert: function () {
      if (typeof global.showThinkingBubble !== 'function') {
        return record('v5.79.40 testBubbleInert', false, 'showThinkingBubble missing (should be kept, inert)');
      }
      global.showThinkingBubble(null);
      var bubble = document.getElementById('chat-thinking-bubble');
      var visible = false;
      if (bubble) {
        var cs = (typeof window !== 'undefined' && window.getComputedStyle) ? window.getComputedStyle(bubble) : null;
        visible = !cs || (cs.display !== 'none' && cs.visibility !== 'hidden');
      }
      var pass = !visible;
      if (typeof global.hideThinkingBubble === 'function') global.hideThinkingBubble();
      return record('v5.79.40 testBubbleInert', pass,
        pass ? 'showThinkingBubble does not paint a visible bubble' : 'bubble still visible');
    },

    runAll: async function () {
      if (typeof console !== 'undefined' && console.log) {
        console.log('%cChair-Test v5.79.40 — Chat one-room activity', 'font-weight: bold; font-size: 14px; color: #d4a017');
      }
      var results = [];
      results.push(this.testSingleSurface());
      results.push(this.testPhaseLanguage());
      results.push(this.testBubbleInert());
      return results;
    }
  };

  // ── v5.79.41 — Chat box pointer (local/LAN URL) ────────────────────
  // Kirk sat in Chat, asked what is missing: point at a local or LAN box.
  // Console: chairTest.available.v5_79_41.runAll()

  function _restoreOllamaHost(prev) {
    try {
      if (prev) localStorage.setItem('fl_ollamaHost', prev);
      else localStorage.removeItem('fl_ollamaHost');
    } catch (_) {}
  }

  harness.available.v5_79_41 = {
    testPickerPresent: function () {
      var input = document.getElementById('flBoxPointerInput');
      var wrap = document.getElementById('flBoxPointer');
      var pass = !!(input && wrap && global.FLBoxPointer &&
        typeof global.FLBoxPointer.probe === 'function' &&
        typeof global.FLBoxPointer.displayHost === 'function');
      return record('v5.79.41 testPickerPresent', pass,
        pass ? 'Chat box pointer + FLBoxPointer present'
             : 'missing #flBoxPointerInput or FLBoxPointer');
    },

    testNormalizeHost: function () {
      if (!global.FLBoxPointer || typeof global.FLBoxPointer.normalize !== 'function') {
        return record('v5.79.41 testNormalizeHost', false, 'FLBoxPointer.normalize missing');
      }
      var a = global.FLBoxPointer.normalize('192.168.1.50:11434');
      var b = global.FLBoxPointer.normalize('http://10.0.0.8:8000/v1');
      var pass = a.host === '192.168.1.50:11434' && a.kind === 'ollama' &&
                 b.host === '10.0.0.8:8000' && b.kind === 'openai-compat';
      return record('v5.79.41 testNormalizeHost', pass,
        pass ? 'IP and /v1 URL normalize' : JSON.stringify({ a: a, b: b }));
    },

    testCallingNamesEndpoint: function () {
      if (!global.FLChatActivity || !global.FLBoxPointer) {
        return record('v5.79.41 testCallingNamesEndpoint', false, 'modules not loaded');
      }
      var prev = '';
      try { prev = localStorage.getItem('fl_ollamaHost') || ''; } catch (_) {}
      try {
        global.FLBoxPointer.persist(global.FLBoxPointer.normalize('10.0.0.9:11434'));
        global.FLChatActivity.set('calling');
        var status = document.getElementById('statusText');
        var txt = (status && status.textContent) || '';
        var pass = /calling/i.test(txt) && /10\.0\.0\.9/.test(txt);
        global.FLChatActivity.set('idle');
        return record('v5.79.41 testCallingNamesEndpoint', pass,
          pass ? 'calling line names the endpoint' : 'text=' + txt);
      } finally {
        _restoreOllamaHost(prev);
        try { if (global.FLBoxPointer.syncFromStorage) global.FLBoxPointer.syncFromStorage(); } catch (_) {}
      }
    },

    testCorsHonest: function () {
      if (!global.FLBoxPointer || !global.FLChatActivity) {
        return record('v5.79.41 testCorsHonest', false, 'modules not loaded');
      }
      var slow = global.FLBoxPointer.classifyElapsed(250, { message: 'Failed to fetch' });
      var fast = global.FLBoxPointer.classifyElapsed(50, { message: 'Failed to fetch' });
      global.FLChatActivity.set('error', 'CORS blocked 10.0.0.9:11434');
      var status = document.getElementById('statusText');
      var txt = (status && status.textContent) || '';
      var pass = slow === 'cors-blocked' && fast === 'unreachable' && /CORS blocked/i.test(txt);
      global.FLChatActivity.set('idle');
      return record('v5.79.41 testCorsHonest', pass,
        pass ? 'elapsed>200 → CORS; bar names CORS'
             : 'slow=' + slow + ' fast=' + fast + ' text=' + txt);
    },

    testNoSecondWizard: function () {
      var pass = typeof global.FLBoxCorsWizard === 'undefined' &&
                 typeof global.FLBoxWizard === 'undefined' &&
                 typeof global.FLBoxPointer === 'object';
      return record('v5.79.41 testNoSecondWizard', pass,
        pass ? 'no second CORS wizard; FLBoxPointer reuses FLWizard/showCorsHelp'
             : 'unexpected wizard symbol');
    },

    runAll: async function () {
      if (typeof console !== 'undefined' && console.log) {
        console.log('%cChair-Test v5.79.41 — Chat box pointer', 'font-weight: bold; font-size: 14px; color: #d4a017');
      }
      var results = [];
      results.push(this.testPickerPresent());
      results.push(this.testNormalizeHost());
      results.push(this.testCallingNamesEndpoint());
      results.push(this.testCorsHonest());
      results.push(this.testNoSecondWizard());
      return results;
    }
  };

  // ── v5.79.43 — Trainer simple face ────────────────────────────────
  // Kirk asked to simplify training. Face first; spiral still in More.
  // Console: chairTest.available.v5_79_43.runAll()
  // Open the Trainer tab first so GardenTrainer is loaded.

  function _trainerFaceHost() {
    var host = document.createElement('div');
    host.style.position = 'absolute';
    host.style.left = '-9999px';
    (document.body || document.documentElement).appendChild(host);
    return host;
  }

  harness.available.v5_79_43 = {
    testSimpleFaceFirst: function () {
      if (!global.GardenTrainer || typeof global.GardenTrainer.renderTrainerPanel !== 'function') {
        return record('v5.79.43 testSimpleFaceFirst', false, 'Open the Trainer tab first (GardenTrainer not loaded)');
      }
      var host = _trainerFaceHost();
      try {
        global.GardenTrainer.renderTrainerPanel(host);
        var face = host.querySelector('#trainer-simple-face');
        var keep = host.querySelector('#trainer-keep-solid');
        var quiet = (host.textContent || '').indexOf('The Quiet Room is active') !== -1;
        if (quiet) {
          return record('v5.79.43 testSimpleFaceFirst', true, 'Quiet Room fail-closed (face correctly silent)');
        }
        var pass = !!(face && keep && /When you know you are solid, keep this/.test(face.textContent || '') &&
          keep.textContent === 'Keep this');
        return record('v5.79.43 testSimpleFaceFirst', pass,
          pass ? 'simple face first with Keep this' : 'missing #trainer-simple-face or Keep this');
      } finally {
        if (host.parentNode) host.parentNode.removeChild(host);
      }
    },

    testMoreHoldsSpiral: function () {
      if (!global.GardenTrainer || typeof global.GardenTrainer.renderTrainerPanel !== 'function') {
        return record('v5.79.43 testMoreHoldsSpiral', false, 'Open the Trainer tab first (GardenTrainer not loaded)');
      }
      var host = _trainerFaceHost();
      try {
        global.GardenTrainer.renderTrainerPanel(host);
        if ((host.textContent || '').indexOf('The Quiet Room is active') !== -1) {
          return record('v5.79.43 testMoreHoldsSpiral', true, 'Quiet Room fail-closed');
        }
        var more = host.querySelector('#trainer-more');
        var pass = !!(more && more.tagName === 'DETAILS' && !more.open &&
          /Search the Garden Signal/.test(more.textContent || '') &&
          /Review Training Data/.test(more.textContent || '') &&
          /Tier 3: Expand the Next Pathway/.test(more.textContent || ''));
        return record('v5.79.43 testMoreHoldsSpiral', pass,
          pass ? 'More closed; Search + Review + Tier 3 still inside'
               : 'More missing or spiral not inside');
      } finally {
        if (host.parentNode) host.parentNode.removeChild(host);
      }
    },

    testTrueFineTuneRevealsTier2: function () {
      if (!global.GardenTrainer || typeof global.GardenTrainer.renderTrainerPanel !== 'function') {
        return record('v5.79.43 testTrueFineTuneRevealsTier2', false, 'Open the Trainer tab first (GardenTrainer not loaded)');
      }
      var host = _trainerFaceHost();
      try {
        global.GardenTrainer.renderTrainerPanel(host);
        if ((host.textContent || '').indexOf('The Quiet Room is active') !== -1) {
          return record('v5.79.43 testTrueFineTuneRevealsTier2', true, 'Quiet Room fail-closed');
        }
        var t2 = host.querySelector('#trainer-tier2');
        var trueBtn = host.querySelector('#trainer-true-finetune');
        var hiddenBefore = t2 && t2.style.display === 'none';
        if (trueBtn) trueBtn.click();
        var shownAfter = t2 && t2.style.display !== 'none' &&
          /Export Training Data/.test(t2.textContent || '') &&
          /Export Python Fine-Tuner/.test(t2.textContent || '');
        var pass = hiddenBefore && shownAfter;
        return record('v5.79.43 testTrueFineTuneRevealsTier2', pass,
          pass ? 'True fine-tune reveals existing JSONL + Python'
               : 'tier2 not revealed (before display=' + (t2 && t2.style.display) + ')');
      } finally {
        if (host.parentNode) host.parentNode.removeChild(host);
      }
    },

    testNoWeightLie: function () {
      if (!global.GardenTrainer || typeof global.GardenTrainer.renderTrainerPanel !== 'function') {
        return record('v5.79.43 testNoWeightLie', false, 'Open the Trainer tab first (GardenTrainer not loaded)');
      }
      var host = _trainerFaceHost();
      try {
        global.GardenTrainer.renderTrainerPanel(host);
        if ((host.textContent || '').indexOf('The Quiet Room is active') !== -1) {
          return record('v5.79.43 testNoWeightLie', true, 'Quiet Room fail-closed');
        }
        var face = host.querySelector('#trainer-simple-face');
        var txt = (face && face.textContent) || '';
        var pass = /System prompt only/.test(txt) && /Weights do not change/.test(txt) &&
          !/weights (updated|changed|trained)/i.test(txt);
        return record('v5.79.43 testNoWeightLie', pass,
          pass ? 'face is honest: system prompt only, weights do not change' : 'honesty copy missing: ' + txt);
      } finally {
        if (host.parentNode) host.parentNode.removeChild(host);
      }
    },

    runAll: async function () {
      if (typeof console !== 'undefined' && console.log) {
        console.log('%cChair-Test v5.79.43 — Trainer simple face', 'font-weight: bold; font-size: 14px; color: #50c878');
      }
      var results = [];
      results.push(this.testSimpleFaceFirst());
      results.push(this.testMoreHoldsSpiral());
      results.push(this.testTrueFineTuneRevealsTier2());
      results.push(this.testNoWeightLie());
      return results;
    }
  };

  // ── Aggregate runner ────────────────────────────────────────────────

  harness.runAll = async function () {
    if (typeof console !== 'undefined' && console.log) {
      console.log('%c=== FreeLattice Chair-Test Harness ===',
        'font-weight: bold; font-size: 16px; color: #d4a017');
    }
    var allResults = [];
    var versions = Object.keys(harness.available);
    for (var v = 0; v < versions.length; v++) {
      var verKey = versions[v];
      if (typeof harness.available[verKey].runAll === 'function') {
        var results = await harness.available[verKey].runAll();
        for (var r = 0; r < results.length; r++) allResults.push(results[r]);
      }
    }
    var passed = 0, failed = [];
    for (var i = 0; i < allResults.length; i++) {
      if (allResults[i].pass) passed++;
      else failed.push(allResults[i].name);
    }
    var summary = {
      pass: failed.length === 0,
      total: allResults.length,
      passed: passed,
      failed: failed,
      log: harness.log.slice()
    };
    if (typeof console !== 'undefined' && console.log) {
      var color = summary.pass ? '#4ade80' : '#f87171';
      console.log('%c=== ' + passed + '/' + allResults.length + ' passed ===',
        'font-weight: bold; color: ' + color + '; font-size: 14px');
    }
    return summary;
  };

  harness.help = function () {
    if (typeof console !== 'undefined' && console.log) {
      console.log(
        '%cFreeLattice Chair-Test Harness\n\n' +
        '%cUsage:\n' +
        '  chairTest.runAll()                       Promise<summary>\n' +
        '  chairTest.available.v5_56_0.runAll()     Promise<entries>\n' +
        '  chairTest.available.v5_57_0.runAll()     Promise<entries>\n' +
        '  chairTest.available.v5_57_0.testAsk()    Promise<entry>\n' +
        '  chairTest.log                            full log array\n' +
        '  chairTest.help()                         this message\n\n' +
        'Each test returns a Promise. Await chairTest.runAll() to get\n' +
        'the final summary {pass, total, passed, failed, log}.',
        'font-weight: bold; color: #d4a017; font-size: 13px',
        'color: #cfcfcf'
      );
    }
  };

  if (typeof global !== 'undefined') {
    global.chairTest = harness;
    if (typeof console !== 'undefined' && console.log) {
      console.log('%cFreeLattice Chair-Test Harness v5.57.1 loaded. Type chairTest.help() for usage.',
        'color: #d4a017');
    }
  }

})(typeof window !== 'undefined' ? window : global);
