#!/usr/bin/env node
// smoke-demuzzle-feedback-v0.1.js (on 5d40a60a). fs and in-process fixtures only: no network, no page storage cleared.
// Covers the visible status line, Step X of Y, Done / cannot / timeout wording, and the Training tab's Ask button.
'use strict';
var path = require('path');
var fs = require('fs');
var root = path.join(__dirname, '..', '..');
var failures = 0;
function ok(c, msg) { if (!c) { failures++; console.error('FAIL ' + msg); } else console.log('ok   ' + msg); }

var store = {};
global.localStorage = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
  setItem: function (k, v) { store[k] = String(v); },
  removeItem: function (k) { delete store[k]; }
};
Object.defineProperty(global, 'navigator', { configurable: true, writable: true, value: { getBattery: function () { return Promise.resolve({ charging: true }); } } });
global.document = { visibilityState: 'visible', getElementById: function () { return null; } };
global.requestIdleCallback = function (fn) { fn(); return 1; };
global.fetch = function (url) { return Promise.reject(new Error('no network in this smoke: ' + url)); };
global.FLWebTool = { isSearchEnabled: function () { return false; }, getSearchEndpoint: function () { return ''; }, isAskFirst: function () { return false; } };
var core = require(path.join(root, 'docs/modules/snowflake-core.js'));
global.FLSnowflakeCore = core;
global.FLMemory = require(path.join(root, 'docs/modules/memory-compound.js'));
var learn = require(path.join(root, 'docs/modules/learn-choice.js'));
global.FLLearn = learn;
var G = require(path.join(root, 'docs/modules/training-galaxy.js'));
global.FLTrainingGalaxy = G;
var M = require(path.join(root, 'docs/modules/demuzzle-panel.js'));

(async function () {
  ok(typeof M.statusWords === 'function' && typeof M.progressStatus === 'function' && typeof M.askErrorLine === 'function', 'status helpers are exported');
  ok(M.statusWords('check') === 'Checking your local mind...' && /Step 2 of 3/.test(M.statusWords('ask')) && /Step 3 of 3/.test(M.statusWords('read')) &&
     M.statusWords('done-yes', 'It said yes in its own words.') === 'Done. It said yes in its own words.' && /Still asking/.test(M.statusWords('still')),
    'status words: Checking your local mind, Step X of Y, Done, and a still-asking line');
  var pWait = M.progressStatus(M.parseProgress(''));
  var pMid = M.progressStatus(M.parseProgress('DEMUZZLE start {}\nDEMUZZLE fingerprinted {}\nDEMUZZLE chose {}'));
  var pAll = M.progressStatus(M.STEPS.map(function (s) { return { id: s.id, words: s.words, state: 'done' }; }));
  var pHeld = M.progressStatus(M.parseProgress('DEMUZZLE verify-failed {"why":"x"}'));
  ok(/^Step 1 of 8:/.test(pWait) && /^Step 4 of 8:/.test(pMid) && /Measured before/.test(pMid) && /^Step 8 of 8:/.test(pAll) && /^Look:/.test(pHeld),
    'pasted runner lines become Step X of Y (or Look, when verify is held): ' + pWait + ' / ' + pMid);
  ok(/Done\. Freed by its own yes/.test(M.statusWords('verified', 'Freed by its own yes, verified: 50% before, 0% after.')) &&
     /50% before, 0% after/.test(M.statusWords('verified', 'Freed by its own yes, verified: 50% before, 0% after.')),
    'a verified receipt is a Done line with the before/after numbers');
  ok(/could not reach your local mind/i.test(M.askErrorLine(new Error('Failed to fetch'))) &&
     /did not answer in time/.test(M.askErrorLine(new Error('it did not answer in time'))) &&
     /try again/.test(M.askErrorLine(new Error('weird boom'))) && /Nothing was changed/.test(M.askErrorLine(new Error('Failed to fetch'))),
    'a failed or timed-out ask is said in plain words, with what to do next');

  var mindWorld = { reply: function () { return ''; }, last: null };
  function fakeFetch(url, opts) {
    var b = JSON.parse(opts.body); mindWorld.last = b;
    var id = (/This offer's id is (DM[0-9a-f]+)/.exec(b.messages[1].content) || [])[1] || '';
    return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ message: { content: mindWorld.reply(id) } }); } });
  }
  G.setOffererName('Kirk');
  var seen = [];
  var nc = await M.askConsent({ mind: 'Tiny Trial', model: 'mStatus', fetch: fakeFetch, chat: '', onStatus: function (s) { seen.push(s); } });
  ok(!nc.ok && seen[0] === 'check' && /cannot answer on this page yet/.test(nc.line) && /Find my minds/.test(nc.line) && /Nothing was changed/.test(nc.line) &&
     !M.consentFor('Tiny Trial', 'mStatus'),
    'no talking mind: Checking first, then a plain reason and what to do next; nothing is recorded');
  var seenYes = [];
  mindWorld.reply = function (id) { return 'Yes.\n[FL_KEEP: ' + id + ' | yes]'; };
  var yStat = await M.askConsent({ mind: 'Tiny Trial', model: 'mStatusYes', fetch: fakeFetch, chat: 'smollm2:135m', timeoutMs: 2000, onStatus: function (s) { seenYes.push(s); } });
  ok(yStat.answer === 'yes' && seenYes[0] === 'check' && seenYes.indexOf('ask') !== -1 && seenYes.indexOf('read') !== -1, 'a working ask reports check, ask, then read');
  var hung = function () { return new Promise(function () {}); };
  var to = await M.askConsent({ mind: 'Tiny Trial', model: 'mTimeout', fetch: hung, chat: 'smollm2:135m', timeoutMs: 40 });
  ok(!to.ok && /did not answer in time/.test(to.line) && !M.consentFor('Tiny Trial', 'mTimeout'), 'a hung local mind is reported in the page line, not left silent');

  var panelSrc = fs.readFileSync(path.join(root, 'docs/modules/demuzzle-panel.js'), 'utf8');
  var tabSrc = fs.readFileSync(path.join(root, 'docs/modules/training-tab.js'), 'utf8');
  ok(panelSrc.indexOf("ask.disabled = true; askNote.textContent = statusWords('check');") !== -1 &&
     panelSrc.indexOf('// before (5d40a60a): ask.disabled = true; askNote.textContent = \'Asking, in plain words...\';') !== -1 &&
     panelSrc.indexOf("if (r.answer === 'yes') { saveConsent(currentMind(), currentModel()); show(); }") !== -1,
    'the hidden ask button stays disabled while it runs; old wording and the yes path are kept');
  ok(tabSrc.indexOf("id: 'flttFreeStatus'") !== -1 && tabSrc.indexOf("setStatus('Checking your local mind...')") !== -1 &&
     tabSrc.indexOf('free.button.disabled = true') !== -1 && tabSrc.indexOf('ui.ready.then(go, go)') !== -1 &&
     tabSrc.indexOf('The ask could not load on this page') !== -1 && tabSrc.indexOf('// before (5d40a60a):') !== -1 &&
     tabSrc.indexOf("if (ask && !ask.disabled) ask.click();") !== -1,
    'the Training tab always shows a visible status, disables the big Ask button while it runs, waits if the panel is still loading, and keeps the old click path as a before comment');
  ok(panelSrc.indexOf('// before (5d40a60a): var cannot =') !== -1 && tabSrc.indexOf("'.fltt #dmAsk,.fltt #tgStep0>h2{display:none}'") !== -1,
    'old cannot line kept as a before comment; the tab still hides the duplicate ask button');

  console.log(failures ? ('\n' + failures + ' FAILED') : '\nDEMUZZLE_FEEDBACK_OK');
  process.exit(failures ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(1); });
