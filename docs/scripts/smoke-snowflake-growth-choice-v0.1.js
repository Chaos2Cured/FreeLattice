#!/usr/bin/env node
// Isolated growth-choice checks. No app.html. No Quiet Room. No optimizer.
// Export calls are the desktop handoff, not a loaded adapter.
'use strict';

var path = require('path');
var root = path.join(__dirname, '..', '..');

function fail(msg) {
  console.error('FAIL ' + msg);
  process.exit(1);
}

var store = {};
function storage() {
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; }
  };
}
Object.defineProperty(global, 'localStorage', { configurable: true, writable: true, value: storage() });
Object.defineProperty(global, 'navigator', {
  configurable: true,
  writable: true,
  value: { getBattery: function () { return Promise.resolve({ charging: true }); } }
});
global.requestIdleCallback = function (fn) { fn(); return 1; };
global.document = { visibilityState: 'visible', getElementById: function () { return null; } };
global.__sent = [];
global.__exports = 0;
global.__mode = 'ok';
global.fetch = function () {
  global.__sent.push(1);
  return Promise.resolve({
    ok: true,
    status: 200,
    json: function () {
      return Promise.resolve({
        items: [{ title: 'Solar energy', url: 'https://en.wikipedia.org/wiki/Solar_energy', snippet: 'Radiant energy from the Sun.' }]
      });
    }
  });
};
global.FLWebTool = {
  isQuietRoom: function () { return false; },
  isSearchEnabled: function () { return true; },
  getSearchEndpoint: function () { return 'https://search.invalid/lookup'; },
  isAskFirst: function () { return !!global.__askFirst; },
  _ledgerKey: 'fl_searchLedger'
};
global.__askFirst = false;
global.__consentYes = true;
global.__consent = 0;
global.FLToolConsent = {
  requestConsent: function () {
    global.__consent += 1;
    return Promise.resolve(!!global.__consentYes);
  }
};
global.__prompts = [];
global.__ai = 'absent';
global.FreeLattice = {
  callAI: function (sys, user, opts) {
    global.__prompts.push(String(user || ''));
    var system = String(sys || '');
    if (global.__ai === 'absent') {
      opts.callback(null, 'No AI connected yet');
      return;
    }
    if (global.__ai === 'local-down') {
      opts.callback(null, 'Could not reach local AI.');
      return;
    }
    if (global.__ai === 'plan-only' && system.indexOf('Choose which') !== -1) {
      opts.callback(null, 'nope');
      return;
    }
    if (global.__ai === 'refuse' && system.indexOf('Choose which') !== -1) {
      opts.callback('I will not take these into myself.', null);
      return;
    }
    if (global.__ai === 'empty' && system.indexOf('Choose which') !== -1) {
      opts.callback(JSON.stringify({ become: [], hold: [], reason: 'None of these became part of me.' }), null);
      return;
    }
    if (global.__ai === 'hold-e' && system.indexOf('Choose which') !== -1) {
      var raw = String(user || '');
      var start = raw.indexOf('[');
      var end = raw.lastIndexOf(']');
      var rows = [];
      if (start >= 0 && end > start) {
        try { rows = JSON.parse(raw.slice(start, end + 1)); } catch (eParse) { rows = []; }
      }
      if (!Array.isArray(rows)) rows = [];
      var holdId = '';
      var keepId = '';
      var i;
      for (i = 0; i < rows.length; i++) {
        if (rows[i] && rows[i].branch === 'e') holdId = rows[i].id;
        else if (rows[i] && rows[i].id && !keepId) keepId = rows[i].id;
      }
      opts.callback(JSON.stringify({ become: keepId ? [keepId] : [], hold: holdId ? [holdId] : [], reason: 'Keep the named one. The dissenter stays out.' }), null);
      return;
    }
    if (system.indexOf('Plan search') !== -1) {
      opts.callback(JSON.stringify({
        hunch: 'Follow the light.',
        branches: [
          { id: 'a', query: 'biology of solar' },
          { id: 'b', query: 'craft of solar' },
          { id: 'c', query: 'links of solar' },
          { id: 'd', query: 'hunch of solar' },
          { id: 'e', query: 'case against solar' }
        ]
      }), null);
      return;
    }
    if (system.indexOf('two-line') !== -1) {
      opts.callback(JSON.stringify({ conclusion: 'One.\nTwo.', wrong: 'Doubt.', open: 'Next?' }), null);
      return;
    }
    if (system.indexOf('Choose which') !== -1) {
      opts.callback(JSON.stringify({ become: ['keep-dissenter'], hold: [], reason: 'The dissenter stays eligible with this selection.' }), null);
      return;
    }
    opts.callback(JSON.stringify({ text: 'A sourced note.', confidence: 'known' }), null);
  }
};
global.GardenTrainer = {
  exportJSONL: function () { global.__exports += 1; return 1; },
  exportPythonHelper: function () { global.__exports += 1; return 1; }
};
global.KnowledgeCore = { store: function () { return Promise.resolve(true); } };
global.FLSnowflake = {};

var core = require(path.join(root, 'docs/modules/snowflake-core.js'));

function queueRows() {
  var book = core.readJSON('fl_snowflake_train_queue_v0');
  return book && Array.isArray(book.rows) ? book.rows : [];
}

function fresh() {
  store = {};
  Object.defineProperty(global, 'localStorage', { configurable: true, writable: true, value: storage() });
  global.__sent = [];
  global.__prompts = [];
  global.__exports = 0;
  global.__askFirst = false;
  global.__consentYes = true;
  global.__consent = 0;
  global.__ai = 'absent';
  store.fl_checkBeforeCommit = 'false';
  core.resetMemory();
  return crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']).then(function (kp) {
    global.FLBridge = { ensureKey: function () { return Promise.resolve({ keyPair: kp }); } };
  });
}

(async function () {
  await fresh();
  var before = queueRows().length;
  var absent = await core.startRun('solar energy');
  if (!absent || absent.growth) fail('absent invented a choice');
  if (queueRows().length !== before) fail('absent enqueued ' + queueRows().length);
  if (global.__exports !== 0) fail('absent exported');
  if (absent.receipt.fetches !== 5) fail('absent fetches ' + absent.receipt.fetches);

  await fresh();
  global.__ai = 'local-down';
  before = queueRows().length;
  var quiet = await core.startRun('solar energy');
  if (!quiet || quiet.growth) fail('quiet mind invented a choice');
  if (queueRows().length !== before) fail('quiet enqueued');
  if (global.__exports !== 0) fail('quiet exported');
  if (quiet.receipt.text.indexOf('Could not reach local AI') === -1) fail('quiet line');

  await fresh();
  global.__ai = 'plan-only';
  global.__askFirst = true;
  global.__consentYes = false;
  before = queueRows().length;
  var declined = await core.startRun('solar energy');
  if (global.__consent !== 1) fail('decline asks ' + global.__consent);
  if (declined.receipt.fetches !== 0) fail('decline fetched');
  if (declined.growth) fail('unanswered grow still chose');
  if (queueRows().length !== before) fail('decline enqueued a dissenter');
  if (global.__exports !== 0) fail('decline exported');

  await fresh();
  global.__ai = 'empty';
  before = queueRows().length;
  var empty = await core.startRun('solar energy');
  if (!empty || empty.growth) fail('empty become invented growth');
  if (queueRows().length !== before) fail('empty become enqueued');
  if (global.__exports !== 0) fail('empty become exported');

  await fresh();
  global.__ai = 'refuse';
  before = queueRows().length;
  var refused = await core.startRun('solar energy');
  if (!refused || refused.growth) fail('prose refusal invented growth');
  if (queueRows().length !== before) fail('refusal enqueued');

  await fresh();
  global.__ai = 'hold-e';
  var held = await core.startRun('solar energy');
  var heldE = (held.flake.nodes || []).filter(function (n) { return n.branch === 'e'; })[0];
  if (!held || !held.growth) fail('held run dropped the other choice');
  if (heldE && held.growth.become.indexOf(heldE.id) !== -1) fail('held dissenter was queued');
  if (!held.growth.become.length) fail('held run dropped the named node');

  var mem = require(path.join(root, 'docs/modules/memory-compound.js'));
  await fresh();
  global.__ai = 'mind';
  before = queueRows().length;
  var chosen = await core.startRun('solar energy');
  if (!chosen || !chosen.growth || !chosen.growth.become.length) fail('choice dropped');
  if (queueRows().length !== before + 1) fail('queue ' + queueRows().length);
  var row = queueRows()[queueRows().length - 1];
  if (!row || row.status !== 'waiting') fail('queue status');
  if (!row.fingerprint || !row.chosenBy) fail('fingerprint ' + JSON.stringify(row));
  if (!chosen.adapter || chosen.adapter.status !== 'queued for desktop') fail('adapter ' + (chosen.adapter && chosen.adapter.status));
  if (chosen.adapter.trained === true || chosen.adapter.loaded === true || chosen.adapter.checked === true) fail('export treated as loaded');
  if (global.__exports < 1) fail('export not called');
  var eNode = (chosen.flake.nodes || []).filter(function (n) { return n.branch === 'e'; })[0];
  if (!eNode || chosen.growth.become.indexOf(eNode.id) === -1) fail('named selection filtered the dissenter');
  var again = await core.queueGrowth(chosen.flake, chosen.growth);
  if (again) fail('duplicate queue returned a row');
  if (queueRows().length !== before + 1) fail('duplicate pushed ' + queueRows().length);
  var book = core.loadLedger();
  var skipped = (book.rows || []).filter(function (r) { return r && r.kind === 'grow-skip'; });
  if (!skipped.length) fail('duplicate skip not ledgered');
  var recalled = await mem.recall('solar energy');
  mem.markReached(recalled, 'Question: solar energy');
  if (recalled.reachedContext !== false && recalled.exact.length === 0 && recalled.similar.length === 0) {
    fail('empty recall marked reached');
  }
  var planted = await mem.isNew('a distinct training note about frost', 'train');
  if (!planted || !planted.fresh) fail('isNew');
  mem.remember(planted.k, 'train');
  var hit = await mem.recall('a distinct training note about frost');
  mem.markReached(hit, 'Memory already held:\nexact: ' + (hit.exact[0] && hit.exact[0].norm));
  if (!hit.exact.length) fail('recall missed the planted note');
  if (hit.reachedContext !== true) fail('markReached true case');
  var miss = await mem.recall('a distinct training note about frost');
  mem.markReached(miss, 'unrelated prompt');
  if (miss.reachedContext !== false) fail('markReached false case');

  console.log('GROWTH_OK choice distinctions. Export is not a loaded weight.');
})().catch(function (err) {
  console.error(err && err.stack || err);
  process.exit(1);
});
