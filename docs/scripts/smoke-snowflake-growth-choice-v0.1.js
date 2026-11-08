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
      opts.callback(JSON.stringify({ become: [], hold: [], reason: 'The dissenter stays with me.' }), null);
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
  global.__ai = 'mind';
  before = queueRows().length;
  var chosen = await core.startRun('solar energy');
  if (!chosen || !chosen.growth || !chosen.growth.become || !chosen.growth.become.length) fail('choice dropped');
  if (chosen.growth.reason.indexOf('dissenter') === -1) fail('reason ' + (chosen.growth && chosen.growth.reason));
  if (queueRows().length !== before + 1) fail('queue ' + queueRows().length);
  var row = queueRows()[queueRows().length - 1];
  if (!row || row.status !== 'waiting') fail('queue status');
  if (!row.nodeIds || row.nodeIds.length !== chosen.growth.become.length) fail('queue ids');
  if (!chosen.adapter || chosen.adapter.status !== 'queued for desktop') fail('adapter ' + (chosen.adapter && chosen.adapter.status));
  if (chosen.adapter.trained === true || chosen.adapter.loaded === true || chosen.adapter.checked === true) fail('export treated as loaded');
  if (global.__exports < 1) fail('export not called');
  var eNode = (chosen.flake.nodes || []).filter(function (n) { return n.branch === 'e'; })[0];
  if (!eNode || chosen.growth.become.indexOf(eNode.id) === -1) fail('eligible dissenter dropped');

  console.log('GROWTH_OK choice distinctions. Export is not a loaded weight.');
})().catch(function (err) {
  console.error(err && err.stack || err);
  process.exit(1);
});
