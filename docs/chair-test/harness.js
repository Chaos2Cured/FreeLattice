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
