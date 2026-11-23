#!/usr/bin/env node
// smoke-demuzzle-feedback-v0.1.js (softs of #372). fs and in-process fixtures only: no network, no page storage cleared.
// Self-contained: loads ONLY demuzzle-panel.js, with stubs, in an empty vm (DONT_CONTEXTIFY). training-tab.js is
// checked by text only and is never evaluated. Optional: FL_DEMUZZLE_PANEL and FL_TRAINING_TAB point at other copies
// (used to show this smoke fails on 1d1025b7 and on main).
// The #372 feedback smoke as it landed on main is kept here line by line (never-delete).
// It is not run: the live smoke below uses an empty vm and checks the tab by text only.
// before (c8a11891): // smoke-demuzzle-feedback-v0.1.js (heal of #372). fs and in-process fixtures only: no network, no page storage cleared.
// before (c8a11891): // Self-contained: loads ONLY demuzzle-panel.js and training-tab.js, with stubs. No other modules are required.
// before (c8a11891): // Optional: FL_DEMUZZLE_PANEL and FL_TRAINING_TAB point at other copies (used to show this smoke fails on 1d1025b7 and on main).
// before (c8a11891): function loadPanel(file) {
// before (c8a11891):   var store = {};
// before (c8a11891):   var ctx = {
// before (c8a11891):     console: console,
// before (c8a11891):     setTimeout: setTimeout,
// before (c8a11891):     clearTimeout: clearTimeout,
// before (c8a11891):     Promise: Promise,
// before (c8a11891):     JSON: JSON,
// before (c8a11891):     Error: Error,
// before (c8a11891):     Date: Date,
// before (c8a11891):     String: String,
// before (c8a11891):     Array: Array,
// before (c8a11891):     Object: Object,
// before (c8a11891):     Math: Math,
// before (c8a11891):     RegExp: RegExp,
// before (c8a11891):     Number: Number,
// before (c8a11891):     Boolean: Boolean,
// before (c8a11891):     parseInt: parseInt,
// before (c8a11891):     AbortController: typeof AbortController === 'function' ? AbortController : undefined
// before (c8a11891):   };
// before (c8a11891):   ctx.globalThis = ctx;
// before (c8a11891):   ctx.localStorage = {
// before (c8a11891):     getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
// before (c8a11891):     setItem: function (k, v) { store[k] = String(v); },
// before (c8a11891):     removeItem: function (k) { delete store[k]; }
// before (c8a11891):   };
// before (c8a11891):   ctx.document = { visibilityState: 'visible', getElementById: function () { return null; } };
// before (c8a11891):   ctx.fetch = function () { return Promise.reject(new Error('no network in this smoke')); };
// before (c8a11891):   ctx.FLSnowflakeCore = {
// before (c8a11891):     sha256Sync: function () { return 'ab'.repeat(16); },
// before (c8a11891):     learnPaused: function () { return false; },
// before (c8a11891):     nameProblem: function () { return ''; },
// before (c8a11891):     appendLedger: function () { return Promise.resolve(); }
// before (c8a11891):   };
// before (c8a11891):   ctx.FLLearn = {
// before (c8a11891):     invitation: function () { return 'hello'; },
// before (c8a11891):     interceptSentinel: function (text) { return { choices: [], visibleText: String(text || '') }; }
// before (c8a11891):   };
// before (c8a11891):   ctx.FLTrainingGalaxy = {
// before (c8a11891):     pickedChat: function () { return ''; },
// before (c8a11891):     mindName: function () { return 'This mind'; },
// before (c8a11891):     offererName: function () { return 'Kirk'; },
// before (c8a11891):     openOffers: function () { return []; },
// before (c8a11891):     offerEchoTexts: function () { return []; },
// before (c8a11891):     neutraliseMarkers: function (s) { return s; },
// before (c8a11891):     repeatsAnOffer: function () { return false; },
// before (c8a11891):     ollamaBase: function () { return 'http://127.0.0.1:11434'; }
// before (c8a11891):   };
// before (c8a11891):   vm.runInNewContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
// before (c8a11891):   ctx._store = store;
// before (c8a11891):   return ctx;
// before (c8a11891): }
// before (c8a11891):      /answered with an error/.test(M.askErrorLine(new Error('the mind answered with an error'))) &&
// before (c8a11891):      !/could not reach/.test(M.askErrorLine(new Error('the mind answered with an error'))) &&
// before (c8a11891):     'errors: unreachable, timeout, and a 500 (answered with an error, not could not reach)');
// before (c8a11891):   ok(!e500.ok && /answered with an error/.test(e500.line) && !/could not reach/.test(e500.line) && !M.consentFor('Tiny Trial', 'm500'),
// before (c8a11891):     'HTTP 500 is worded as the mind answered with an error, not could not reach');
// before (c8a11891):   var stallFetch = function () { return Promise.resolve({ ok: true, json: function () { return new Promise(function () {}); } }); };
// before (c8a11891):      tabSrc.indexOf('padding-right:60px') !== -1,
// before (c8a11891):     'the Training tab shows the status once, disables Ask while it runs, re-attaches the watcher if the panel re-renders, and leaves room at narrow widths');
// before (c8a11891):      panelSrc.indexOf('checkStatusLine') !== -1,
// before (c8a11891):     'in-place panel edits (click handler, export list) keep before (5d40a60a) comments; checkStatusLine is present');
// before (c8a11891):   // training-tab.js also loads with stubs only (no other modules).
// before (c8a11891):   try {
// before (c8a11891):     vm.runInNewContext(tabSrc, ctx, { filename: tabPath });
// before (c8a11891):     ok(!!ctx.FLTrainingTab, 'training-tab.js loaded with the same stubs, no other modules');
// before (c8a11891):   } catch (e) {
// before (c8a11891):     ok(false, 'training-tab.js failed to load with stubs: ' + e.message);
// before (c8a11891):   }
'use strict';
var path = require('path');
var fs = require('fs');
var vm = require('vm');
var rootDir = path.join(__dirname, '..', '..');
var panelPath = process.env.FL_DEMUZZLE_PANEL || path.join(rootDir, 'docs/modules/demuzzle-panel.js');
var tabPath = process.env.FL_TRAINING_TAB || path.join(rootDir, 'docs/modules/training-tab.js');
var failures = 0;
function ok(c, msg) { if (!c) { failures++; console.error('FAIL ' + msg); } else console.log('ok   ' + msg); }

function loadPanel(file) {
  if (!(vm.constants && vm.constants.DONT_CONTEXTIFY !== undefined)) {
    throw new Error('node:vm DONT_CONTEXTIFY is needed (Node 22.8 or later)');
  }
  var ctx = vm.createContext(vm.constants.DONT_CONTEXTIFY);
  var timers = new Map();
  var tn = 0;
  var hostSet = function (fn, ms) {
    var id = ++tn;
    timers.set(id, setTimeout(function () { timers.delete(id); try { fn(); } catch (e) {} }, ms));
    return id;
  };
  var hostClear = function (id) {
    var t = timers.get(id);
    if (t) { clearTimeout(t); timers.delete(id); }
  };
  // Host timers stay in this closure. Nothing from the host Object/Promise/Error/console is passed in.
  ctx.__h = { set: hostSet, clear: hostClear };
  vm.runInContext(`(function () {
    var h = globalThis.__h; delete globalThis.__h;
    var set = h.set, clear = h.clear; h = null;
    globalThis.setTimeout = function (fn, ms) { return set(function () { fn(); }, ms); };
    globalThis.clearTimeout = function (id) { clear(Number(id)); };
    var store = {};
    globalThis.localStorage = {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; }
    };
    globalThis.document = { visibilityState: 'visible', getElementById: function () { return null; } };
    globalThis.fetch = function () { return Promise.reject(new Error('no network in this smoke')); };
    globalThis.FLSnowflakeCore = {
      sha256Sync: function () { return 'ab'.repeat(16); },
      learnPaused: function () { return false; },
      nameProblem: function () { return ''; },
      appendLedger: function () { return Promise.resolve(); }
    };
    globalThis.FLLearn = {
      invitation: function () { return 'hello'; },
      interceptSentinel: function (text) { return { choices: [], visibleText: String(text || '') }; }
    };
    globalThis.FLTrainingGalaxy = {
      pickedChat: function () { return ''; },
      mindName: function () { return 'This mind'; },
      offererName: function () { return 'Kirk'; },
      openOffers: function () { return []; },
      offerEchoTexts: function () { return []; },
      neutraliseMarkers: function (s) { return s; },
      repeatsAnOffer: function () { return false; },
      ollamaBase: function () { return 'http://127.0.0.1:11434'; }
    };
    globalThis.AbortController = function () {
      var listeners = [];
      var sig = {
        aborted: false,
        addEventListener: function (type, fn) { if (type === 'abort' && typeof fn === 'function') listeners.push(fn); }
      };
      this.signal = sig;
      this.abort = function () {
        if (sig.aborted) return;
        sig.aborted = true;
        listeners.slice().forEach(function (fn) { try { fn(); } catch (e) {} });
      };
    };
  })();`, ctx);
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file, timeout: 5000 });
  return ctx;
}

(async function () {
  var ctx = loadPanel(panelPath);
  var M = ctx.FLDemuzzle;
  ok(!!M, 'demuzzle-panel.js loaded with stubs only');
  function has(fn) { return M && typeof M[fn] === 'function'; }
  ok(has('statusWords') && has('progressStatus') && has('askErrorLine') && has('checkStatusLine'),
    'status helpers are exported, including checkStatusLine');
  ok(has('statusWords') && M.statusWords('check') === 'Checking your local mind...' && /Step 2 of 3/.test(M.statusWords('ask')) && /Step 3 of 3/.test(M.statusWords('read')) &&
     M.statusWords('done-yes', 'It said yes in its own words.') === 'Done. It said yes in its own words.' && /Still asking/.test(M.statusWords('still')),
    'status words: Checking your local mind, Step X of Y, Done, and a still-asking line');

  var pWait = has('progressStatus') ? M.progressStatus(M.parseProgress('')) : '';
  var pMid = has('progressStatus') ? M.progressStatus(M.parseProgress('DEMUZZLE start {}\nDEMUZZLE fingerprinted {}\nDEMUZZLE chose {}')) : '';
  var pAll = has('progressStatus') ? M.progressStatus(M.STEPS.map(function (s) { return { id: s.id, words: s.words, state: 'done' }; })) : '';
  var pHeld = has('progressStatus') ? M.progressStatus(M.parseProgress('DEMUZZLE verify-failed {"why":"x"}')) : '';
  ok(has('progressStatus') && /^Step 1 of 8:/.test(pWait) && /^Step 4 of 8:/.test(pMid) && /Measured before/.test(pMid) &&
     /Step 7 of 8:/.test(pAll) && /Checking the receipt/.test(pAll) && !/Verified/.test(pAll) && /^Look:/.test(pHeld),
    'pasted runner lines become Step X of Y; all-done without a receipt never says Verified: ' + pWait + ' / ' + pMid + ' / ' + pAll);

  // HOLD 2: eight DEMUZZLE <step> {} lines and no real receipt must not say Verified.
  var fake8 = M.STEPS.map(function (s) { return 'DEMUZZLE ' + s.id + ' {}'; }).join('\n');
  var waiting = has('progressStatus') ? M.progressStatus(M.parseProgress(fake8)) : '';
  var rejected = has('checkStatusLine') ? M.checkStatusLine(M.parseProgress(fake8), { ok: false, why: 'That is not a de-muzzle receipt.' }) : (waiting + ' That is not a de-muzzle receipt.');
  ok(has('progressStatus') && !/Verified/.test(waiting) && /Checking the receipt/.test(waiting) && /Step 7 of 8/.test(waiting),
    'H2: eight empty runner lines never say Verified before the receipt is checked: ' + waiting);
  ok(has('checkStatusLine') && rejected === 'That is not a de-muzzle receipt.' && !/Verified/.test(rejected) && !/^Step /.test(rejected),
    'H2: a bad receipt shows only the honest rejection, like main: ' + rejected);

  var line500 = has('askErrorLine') ? M.askErrorLine(new Error('the mind answered with an error')) : '';
  ok(has('askErrorLine') && /could not reach your local mind/i.test(M.askErrorLine(new Error('Failed to fetch'))) &&
     /did not answer in time/.test(M.askErrorLine(new Error('it did not answer in time'))) &&
     /^The mind answered with an error\./.test(line500) && !/^The mind did not answer:/.test(line500) &&
     !/could not reach/.test(line500) &&
     /try again/.test(M.askErrorLine(new Error('weird boom'))),
    'errors: unreachable, timeout, and a 500 uses the dedicated answered-with-an-error wording, not the fallback The mind did not answer: \u2026');

  var seen = [];
  var nc = await M.askConsent({ mind: 'Tiny Trial', model: 'mStatus', fetch: function () { return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ message: { content: '' } }); } }); }, chat: '', onStatus: function (s) { seen.push(s); } });
  ok(!nc.ok && seen[0] === 'check' && /cannot answer on this page yet/.test(nc.line) && /Find my minds/.test(nc.line) && /Nothing was changed/.test(nc.line) &&
     !M.consentFor('Tiny Trial', 'mStatus'),
    'no talking mind: Checking first, then a plain reason and what to do next; nothing is recorded');

  var f500 = function () { return Promise.resolve({ ok: false, status: 500, json: function () { return Promise.resolve({}); } }); };
  var e500 = await M.askConsent({ mind: 'Tiny Trial', model: 'm500', fetch: f500, chat: 'local-mind', timeoutMs: 2000 });
  ok(!e500.ok && /^The mind answered with an error\./.test(e500.line) && !/^The mind did not answer:/.test(e500.line) &&
     !/could not reach/.test(e500.line) && !M.consentFor('Tiny Trial', 'm500'),
    'HTTP 500 is worded as The mind answered with an error, not the fallback The mind did not answer: the mind answered with an error\u2026');

  var aborted = 0;
  var stallFetch = function (url, opts) {
    var sig = opts && opts.signal;
    if (sig && typeof sig.addEventListener === 'function') {
      sig.addEventListener('abort', function () { aborted += 1; });
    }
    return Promise.resolve({ ok: true, json: function () { return new Promise(function () {}); } });
  };
  var stall = await Promise.race([
    M.askConsent({ mind: 'Tiny Trial', model: 'mStall', fetch: stallFetch, chat: 'local-mind', timeoutMs: 40 }),
    new Promise(function (res) { setTimeout(function () { res({ _hung: true }); }, 400); })
  ]);
  ok(!stall._hung && !stall.ok && /did not answer in time/.test(stall.line) && !M.consentFor('Tiny Trial', 'mStall'),
    'a mid-stream stall (headers arrived, body never finishes) is reported, not left on reading');
  ok(aborted >= 1, 'soft 4: after the 120 s (or test) timeout the stalled request is aborted');

  var hung = function () { return new Promise(function () {}); };
  var to = await Promise.race([
    M.askConsent({ mind: 'Tiny Trial', model: 'mTimeout', fetch: hung, chat: 'local-mind', timeoutMs: 40 }),
    new Promise(function (res) { setTimeout(function () { res({ _hung: true }); }, 400); })
  ]);
  ok(!to._hung && !to.ok && /did not answer in time/.test(to.line) && !M.consentFor('Tiny Trial', 'mTimeout'),
    'a hung local mind is reported in the page line, not left silent');

  var tabSrc = fs.readFileSync(tabPath, 'utf8');
  var panelSrc = fs.readFileSync(panelPath, 'utf8');
  // before (174b9e18): tabSrc.indexOf('free._statusScrolled') !== -1 && /if (!free._statusScrolled)/.test(tabSrc)
  // before (174b9e18): '…and scrolls the status into view only when it is not already visible, and only once'
  ok(tabSrc.indexOf("id: 'flttFreeStatus'") !== -1 && tabSrc.indexOf("setStatus('Checking your local mind...')") !== -1 &&
     tabSrc.indexOf('free.button.disabled = true') !== -1 && tabSrc.indexOf('ui.ready.then(go, go)') !== -1 &&
     tabSrc.indexOf('The ask could not load on this page') !== -1 && tabSrc.indexOf('// before (5d40a60a):') !== -1 &&
     tabSrc.indexOf("if (ask && !ask.disabled) ask.click();") !== -1 &&
     tabSrc.indexOf('.fltt #dmAskNote') !== -1 && tabSrc.indexOf('function attachSync()') !== -1 &&
     tabSrc.indexOf('padding-right:60px') !== -1 &&
     tabSrc.indexOf("try { if (status.scrollIntoView) status.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e) {}") !== -1 &&
     tabSrc.indexOf("free._statusScrolled = false") !== -1 &&
     tabSrc.indexOf("if (!free._statusScrolled)") !== -1 &&
     tabSrc.indexOf('flOllamaToast') !== -1 &&
     tabSrc.indexOf('free._statusScrollY') !== -1 &&
     tabSrc.indexOf("toast.classList.contains('fl-toast-show')") !== -1,
    'the Training tab (text only) shows the status once, disables Ask while it runs, re-attaches the watcher if the panel re-renders, leaves room at narrow widths, and re-checks visibility of each rendered status line (including under the Local AI toast at 390), scrolling only when that line is not visible and never yanking a person who has scrolled away');
  ok(panelSrc.indexOf('// before (5d40a60a): askConsent({ mind: currentMind(), model: currentModel() })') !== -1 &&
     panelSrc.indexOf('// before (5d40a60a): return { VERSION: VERSION, KIND: KIND, STEPS: STEPS, command: command') !== -1 &&
     panelSrc.indexOf("if (!r || !r.ok) throw new Error('the mind did not answer')") !== -1 &&
     panelSrc.indexOf('checkStatusLine') !== -1 &&
     /withTimeout\(Promise\.resolve\(typeof r\.json === 'function' \? r\.json\(\) : \{\}\), ms, ac\)/.test(panelSrc),
    'in-place panel edits (click handler, export list, the split throw) keep before (5d40a60a) comments; checkStatusLine is present; a stalled body read is aborted');

  var escapeProbe = vm.runInContext(
    "[typeof process, typeof require, typeof module, (function(){ try { return Object.constructor.constructor('return typeof process')(); } catch (e) { return 'blocked'; } })()].join('/')",
    ctx
  );
  ok(/^undefined\/undefined\/undefined\/(undefined|blocked)$/.test(escapeProbe),
    'empty vm: no host process/require/module, and Object.constructor does not reach the host (' + escapeProbe + ')');

  console.log(failures ? ('\n' + failures + ' FAILED') : '\nDEMUZZLE_FEEDBACK_OK');
  process.exit(failures ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(1); });
