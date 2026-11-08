#!/usr/bin/env node
// v-snowflake-reach-v0.1
// Unit fixtures only. No network. No Quiet Room. Not a Mac or live-provider run.
// Live helper evidence is docs/scripts/smoke-snowflake-search-live.js.
'use strict';

var path = require('path');
var fs = require('fs');
var nodeCrypto = require('crypto');
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
global.requestIdleCallback = function (fn) { fn(); };
global.document = { visibilityState: 'visible', getElementById: function () { return null; } };
global.__sent = [];
global.__mode = 'ok';
global.fetch = function (url, opts) {
  var href = String(url);
  global.__sent.push(href);
  if (global.__mode === 'throw') return Promise.reject(new TypeError('Failed to fetch'));
  if (global.__mode === 'abort') {
    return new Promise(function (resolve, reject) {
      var signal = opts && opts.signal;
      if (signal) {
        signal.addEventListener('abort', function () {
          var err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      }
    });
  }
  if (global.__mode === '503') {
    return Promise.resolve({ ok: false, status: 503, json: function () { return Promise.resolve({}); } });
  }
  if (global.__mode === '404') {
    return Promise.resolve({ ok: false, status: 404, json: function () { return Promise.resolve({ error: 'Usage: /chart/SYMBOL' }); } });
  }
  if (global.__mode === 'empty') {
    return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ items: [], source: 'duckduckgo+wikipedia' }); } });
  }
  if (global.__mode === 'nourl') {
    return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ items: [{ title: 'No address', snippet: 'words' }] }); } });
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    json: function () {
      return Promise.resolve({
        source: 'duckduckgo+wikipedia',
        items: [{
          title: 'Solar energy',
          url: 'https://en.wikipedia.org/wiki/Solar_energy',
          snippet: 'Solar energy is radiant energy from the Sun.'
        }]
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
global.__consent = 0;
global.__askFirst = false;
global.__consentYes = true;
global.FLToolConsent = {
  requestConsent: function () {
    global.__consent += 1;
    return Promise.resolve(!!global.__consentYes);
  }
};
global.__prompts = [];
global.__calls = 0;
global.FreeLattice = {
  callAI: function (sys, user, opts) {
    global.__calls += 1;
    global.__prompts.push(String(user || ''));
    if (global.__ai === 'absent') {
      opts.callback(null, 'No AI connected yet');
      return;
    }
    if (global.__ai === 'local-down') {
      opts.callback(null, 'Could not reach local AI.');
      return;
    }
    if (global.__ai === 'hold') {
      global.__release = opts.callback;
      return;
    }
    var system = String(sys || '');
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
      opts.callback(JSON.stringify({
        conclusion: 'I hold a small piece.\nThe doubt stays beside it.',
        wrong: 'The other case still stands.',
        open: 'What would thaw it?'
      }), null);
      return;
    }
    if (system.indexOf('Choose which') !== -1) {
      opts.callback(JSON.stringify({ become: [], reason: 'The dissenter stays with me.' }), null);
      return;
    }
    opts.callback(JSON.stringify({
      text: 'A sourced note. The model invented https://example.invalid/made-up and it must not become the source.',
      confidence: 'known',
      url: 'https://example.invalid/made-up'
    }), null);
  }
};
global.KnowledgeCore = { store: function (entry) { global.__memory = entry; return Promise.resolve(entry); } };
global.GardenTrainer = { exportJSONL: function () { return 0; }, exportPythonHelper: function () { return 0; } };
global.FLSnowflake = { showSearch: function () {}, onStatus: function (p) { global.__lines.push(p && p.line || ''); } };
global.__lines = [];

var core = require(path.join(root, 'docs/modules/snowflake-core.js'));
var kpPromise = crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);

function fresh() {
  store = {};
  Object.defineProperty(global, 'localStorage', { configurable: true, writable: true, value: storage() });
  global.__sent = [];
  global.__prompts = [];
  global.__calls = 0;
  global.__lines = [];
  global.__consent = 0;
  global.__askFirst = false;
  global.__consentYes = true;
  global.__mode = 'ok';
  global.__ai = 'absent';
  global.__memory = null;
  global.__flSnowflakeTimeoutMs = 0;
  core.resetMemory();
  return kpPromise.then(function (kp) {
    global.FLBridge = {
      ensureKey: function () { return Promise.resolve({ keyPair: kp, cryptoType: 'ed25519', source: 'device' }); }
    };
  });
}

function times(word) {
  var n = 0;
  var blob = global.__sent.join('\n');
  var from = 0;
  while (blob.indexOf(word, from) !== -1) {
    n += 1;
    from = blob.indexOf(word, from) + word.length;
  }
  return n;
}

(async function () {
  if (core.REACH !== 'v-snowflake-reach-v0.1') fail('marker');
  var searchUi = fs.readFileSync(path.join(root, 'docs/modules/snowflake-search.js'), 'utf8');
  if (searchUi.indexOf('Try again') !== -1) fail('retry pill returned');
  var swA = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  var swB = fs.readFileSync(path.join(root, 'docs/sw.js'), 'utf8');
  if (swA !== swB) fail('sw twins');
  if (swA.indexOf('snowflake-(core|search)') === -1) fail('sw network-first');

  await fresh();
  global.__ai = 'absent';
  var none = await core.startRun('solar energy');
  if (!none || none.status !== 'done') fail('absent status ' + (none && none.status));
  if (none.receipt.calls !== 1) fail('absent calls ' + none.receipt.calls);
  if (none.receipt.fetches !== 5) fail('absent fetches ' + none.receipt.fetches);
  if (none.receipt.failedFetches !== 0) fail('absent failed ' + none.receipt.failedFetches);
  if (none.receipt.text.indexOf('No AI connected yet') === -1) fail('absent line ' + none.receipt.text);
  if (none.receipt.text.indexOf('Memory in context: no.') === -1) fail('memory receipt ' + none.receipt.text);
  if (none.receipt.text.indexOf('Memory in context: yes') !== -1) fail('memory claimed');
  if (String(none.flake.conclusion).indexOf('I learned something') !== -1) fail('fake conclusion');
  if (String(none.flake.conclusion).indexOf('No mind read them') === -1) fail('conclusion ' + none.flake.conclusion);
  if (none.growth) fail('absent queued growth');
  if (none.flake.memoryInContext) fail('flake claimed memory');
  var nodes = none.flake.nodes || [];
  if (nodes.length !== 5) fail('absent nodes ' + nodes.length);
  var i;
  for (i = 0; i < nodes.length; i++) {
    var n = nodes[i];
    if (n.confidence === 'known' || n.confidence === 'source-with-motive') fail('absent known');
    if (!n.source || n.source.url !== 'https://en.wikipedia.org/wiki/Solar_energy') fail('absent url ' + (n.source && n.source.url));
    if (n.text.indexOf('made-up') !== -1) fail('absent invented');
    if (n.text.indexOf('radiant energy') === -1) fail('absent not source words');
    if (n.reason.indexOf('No mind read it') === -1) fail('absent reason ' + n.reason);
    if (n.via !== 'duckduckgo+wikipedia') fail('via ' + n.via);
    var signed = await core.verifyNode(n);
    if (!signed.ok) fail('absent unsigned');
    var tampered = JSON.parse(JSON.stringify(n));
    tampered.text += 'x';
    var bad = await core.verifyNode(tampered);
    if (bad.ok || bad.label !== 'unverified') fail('tamper ' + (bad && bad.label));
  }
  if (global.__memory && global.__memory.content.indexOf('solar energy') !== -1) fail('question leaked');
  var again = core.loadFlakes().filter(function (f) { return f.id === none.flake.id; })[0];
  core.resetMemory();
  global.FLBridge = global.FLBridge;
  var reloaded = core.loadFlakes().filter(function (f) { return f.id === none.flake.id; })[0];
  if (!reloaded || !reloaded.nodes || reloaded.nodes.length !== 5) fail('reload');
  if (reloaded.nodes[0].source.url !== again.nodes[0].source.url) fail('reload url');
  if (reloaded.memoryInContext) fail('reload memory flag');

  await fresh();
  global.__ai = 'absent';
  global.__mode = '503';
  var down = await core.startRun('solar energy');
  if (down.receipt.fetches !== 10) fail('503 fetches ' + down.receipt.fetches);
  if (down.receipt.failedFetches !== 10) fail('503 failed');
  if (times('solar') > 10) fail('retry over 2');
  if (down.receipt.text.indexOf('Our search helper is down (error 5xx).') === -1) fail('503 receipt');
  if (down.receipt.text.indexOf('Guessed arms:') === -1) fail('guessed disclosed');
  for (i = 0; i < down.flake.nodes.length; i++) {
    var dn = down.flake.nodes[i];
    if (dn.confidence === 'known') fail('503 known');
    if (dn.source && dn.source.url) fail('503 url ' + dn.source.url);
    if (dn.reason !== 'guessed (search unavailable)') fail('503 reason ' + dn.reason);
    if (dn.text.indexOf('made-up') !== -1 || dn.text.indexOf('wikipedia.org') !== -1) fail('503 invented');
  }

  await fresh();
  global.__mode = 'throw';
  var missedNet = await core.searchNow('solar energy');
  if (!missedNet || missedNet.outcome !== 'unreachable') fail('cors outcome ' + (missedNet && missedNet.outcome));
  if (missedNet.line.indexOf('error 5xx') !== -1) fail('cors labeled 5xx');
  if (missedNet.line.indexOf('FreeLattice origin') === -1) fail('cors line ' + missedNet.line);

  await fresh();
  global.__mode = '404';
  var missing = await core.searchNow('solar energy');
  if (missing.outcome !== 'bad-helper') fail('404 outcome ' + missing.outcome);
  if (missing.line === 'No results.') fail('404 said no results');
  if (missing.line.indexOf('404') === -1) fail('404 line ' + missing.line);

  await fresh();
  global.__mode = 'empty';
  var empty = await core.searchNow('solar energy');
  if (empty.line !== 'No results.') fail('empty ' + empty.line);
  if (empty.ok) fail('empty ok');

  await fresh();
  global.__mode = 'nourl';
  var nourl = await core.searchNow('solar energy');
  if (nourl.ok || nourl.line !== 'No results.') fail('nourl ' + nourl.line);
  if ((nourl.items || []).length) fail('nourl kept a sourceless item');

  await fresh();
  global.__mode = '503';
  var downOne = await core.searchNow('solar energy');
  if (downOne.line !== 'Our search helper is down (error 5xx).') fail('503 line ' + downOne.line);

  await fresh();
  global.__flSnowflakeTimeoutMs = 40;
  global.__mode = 'abort';
  var slow = await core.searchNow('solar energy');
  if (slow.outcome !== 'timeout' || slow.line !== 'Search took too long.') fail('timeout ' + (slow && slow.line));
  global.__flSnowflakeTimeoutMs = 0;

  await fresh();
  var blank = await core.startRun('   ');
  if (!blank || blank.status !== 'empty' || blank.line.indexOf('Tell me what you want') === -1) fail('empty ask');
  global.__ai = 'hold';
  var pending = core.startRun('solar energy');
  var busy = await core.startRun('solar energy again');
  if (!busy || busy.status !== 'busy' || busy.line.indexOf('already growing') === -1) fail('busy ' + (busy && busy.status));
  if (global.__release) global.__release(null, 'No AI connected yet');
  await pending;
  store.fl_snowflake_runs_v0 = JSON.stringify([Date.now(), Date.now(), Date.now()]);
  global.__ai = 'absent';
  var capped = await core.startRun('solar energy');
  if (!capped || capped.status !== 'capped' || capped.line.indexOf('three snowflakes') === -1) fail('capped');
  core.pause();
  var held = await core.replayNow();
  if (!held || held.status !== 'held' || held.line.indexOf('Held.') !== 0) fail('held ' + (held && held.line));
  await core.resume();

  await fresh();
  global.__ai = 'mind';
  global.__askFirst = false;
  var sentBefore = 0;
  var minded = await core.startRun('solar energy');
  if (global.__consent !== 0) fail('ask imposed ' + global.__consent);
  if (!minded || minded.status !== 'done') fail('mind status');
  var sawSource = false;
  for (i = 0; i < global.__prompts.length; i++) {
    if (global.__prompts[i].indexOf('https://en.wikipedia.org/wiki/Solar_energy') !== -1 && global.__prompts[i].indexOf('radiant energy') !== -1) sawSource = true;
  }
  if (!sawSource) fail('sources not in the mind prompt');
  var keptInvented = false;
  for (i = 0; i < minded.flake.nodes.length; i++) {
    var mn = minded.flake.nodes[i];
    if (mn.source && mn.source.url === 'https://example.invalid/made-up') keptInvented = true;
    if (mn.confidence === 'known' && (!mn.source || mn.source.url.indexOf('wikipedia.org') === -1)) fail('known without fetched url');
  }
  if (keptInvented) fail('model url replaced the fetch');
  if (minded.receipt.text.indexOf('Memory in context: no.') === -1) fail('mind memory receipt');
  if (sentBefore && global.__sent.length) fail('sentinel');

  await fresh();
  global.__ai = 'mind';
  global.__askFirst = true;
  global.__consentYes = false;
  var declined = await core.startRun('solar energy');
  if (global.__consent !== 1) fail('decline asks ' + global.__consent);
  if (declined.receipt.fetches !== 0) fail('decline fetched');
  if (String(declined.flake.conclusion).indexOf('These lookups were not made.') === -1) fail('decline conclusion');

  await fresh();
  global.__ai = 'local-down';
  global.__mode = 'ok';
  var localDown = await core.startRun('solar energy');
  if (localDown.receipt.calls !== 2) fail('local retry ' + localDown.receipt.calls);
  if (localDown.receipt.fetches !== 5) fail('local still searched ' + localDown.receipt.fetches);
  if (localDown.receipt.text.indexOf('Could not reach local AI') === -1) fail('local line');
  if (localDown.receipt.text.indexOf('That call did not come back') !== -1) fail('local collapsed');

  var auto = fs.readFileSync(path.join(root, 'docs/library/AUTONOMY.md'));
  var autoNow = nodeCrypto.createHash('md5').update(auto).digest('hex');
  if (autoNow !== '09a4f1a286226e37089a93df42df0106') fail('AUTONOMY changed ' + autoNow);

  console.log('REACH_OK snowflake v0.1 unit');
})().catch(function (err) {
  console.error(err && err.stack || err);
  process.exit(1);
});
