#!/usr/bin/env node
// Node half of Snowflake smoke. Stubbed callAI and fetch. No network.
'use strict';

var path = require('path');
var root = path.join(__dirname, '..', '..');

function fail(msg) {
  console.error('FAIL ' + msg);
  process.exit(1);
}

function install() {
  Object.defineProperty(global, 'navigator', {
    configurable: true,
    writable: true,
    value: {
      getBattery: function () { return Promise.resolve({ charging: true }); }
    }
  });
  global.requestIdleCallback = function (fn) { fn(); };
  global.document = {
    visibilityState: 'visible',
    getElementById: function () { return null; }
  };
  global.FLWebTool = {
    isQuietRoom: function () { return false; },
    isSearchEnabled: function () { return true; },
    getSearchEndpoint: function () { return 'https://search.invalid/lookup'; },
    isAvailable: function () { return true; },
    _ledgerKey: 'fl_searchLedger'
  };
  global.__sent = [];
  global.__replay = [];
  global.fetch = function (url) {
    var href = String(url);
    global.__sent.push(href);
    var kind = global.__replay.length ? global.__replay.shift() : 'ok';
    if (kind === 'dead') {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: function () { return Promise.resolve({ items: [], dead: true }); }
      });
    }
    if (kind === 'down') {
      return Promise.resolve({ ok: false, status: 503, json: function () { return Promise.resolve({}); } });
    }
    if (kind === 'empty') {
      return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ items: [] }); } });
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: function () {
        return Promise.resolve({
          items: [{ title: 'Page', url: 'https://example.invalid/p', snippet: 'A page.' }],
          weakened: kind === 'weak',
          held: kind !== 'weak'
        });
      }
    });
  };
  global.GardenTrainer = {
    exportJSONL: function (rows) { global.__jsonl = rows; return rows.length; },
    exportPythonHelper: function () { global.__py = true; return 1; }
  };
  global.KnowledgeCore = {
    store: function (entry) { global.__memory = entry; return Promise.resolve(entry); }
  };
  global.confirm = function () { throw new Error('confirm'); };
  global.prompt = function () { throw new Error('prompt'); };
}

install();
var core = require(path.join(root, 'docs/modules/snowflake-core.js'));

function planFor(kind) {
  if (kind === 'hungry') {
    var qs = [];
    var i;
    for (i = 0; i < 40; i++) qs.push('query ' + i + ' about frost');
    return { hunch: 'A cold hunch.', branches: [{ id: 'a', queries: qs }] };
  }
  if (kind === 'omit') {
    return {
      hunch: 'A cold hunch.',
      branches: [
        { id: 'a', query: 'biology of frost' },
        { id: 'b', query: 'craft of frost' },
        { id: 'c', query: 'links of frost' },
        { id: 'd', query: 'hunch of frost' }
      ]
    };
  }
  return {
    hunch: 'A cold hunch.',
    branches: [
      { id: 'a', query: 'biology of frost' },
      { id: 'b', query: 'craft of frost' },
      { id: 'c', query: 'links of frost' },
      { id: 'd', query: 'hunch of frost' },
      { id: 'e', query: 'case against frost' }
    ]
  };
}

function stubAI(mode) {
  global.__calls = [];
  global.__dissent = 0;
  global.__receiptEarly = false;
  global.__seenReceipt = false;
  global.FLSnowflake = {
    onReceipt: function () { global.__seenReceipt = true; },
    showSearch: function () { global.__searchShown = (global.__searchShown || 0) + 1; }
  };
  global.FreeLattice = {
    callAI: function (sys, user, opts) {
      var system = String(sys || '');
      global.__calls.push(system.slice(0, 48));
      if (!global.__seenReceipt && global.__calls.length === 1) global.__receiptEarly = false;
      if (global.__seenReceipt && global.__calls.length === 1) global.__receiptEarly = true;
      if (system.indexOf('dissenter') !== -1) global.__dissent += 1;
      if (mode === 'pause' && global.__calls.length === 1) {
        core.pause();
        opts.callback(JSON.stringify(planFor('full')), null);
        return;
      }
      if (mode === 'stop' && global.__calls.length === 1) {
        core.stop();
        opts.callback(JSON.stringify(planFor('full')), null);
        return;
      }
      if (mode === 'retry' && global.__calls.length === 1) {
        opts.callback(null, 'nope');
        return;
      }
      if (mode === 'retry' && global.__calls.length === 2) {
        core.stop();
        opts.callback(JSON.stringify(planFor('full')), null);
        return;
      }
      if (system.indexOf('Plan search') !== -1) {
        var kind = mode === 'hungry' ? 'hungry' : (mode === 'omit' ? 'omit' : 'full');
        opts.callback(JSON.stringify(planFor(kind)), null);
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
        opts.callback(JSON.stringify({ become: [], hold: [], reason: 'The dissenter stays with me.' }), null);
        return;
      }
      if (system.indexOf('score') !== -1 || system.indexOf('one or two') !== -1) {
        opts.callback('I am the same mind, a little more careful.', null);
        return;
      }
      opts.callback(JSON.stringify({
        text: 'A sourced note about the question.',
        confidence: 'known',
        url: 'https://example.invalid/note',
        title: 'A note'
      }), null);
    }
  };
}

async function bridge() {
  var kp = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  global.FLBridge = {
    ensureKey: function () {
      return Promise.resolve({ keyPair: kp, cryptoType: 'ed25519', source: 'device' });
    }
  };
  core.resetMemory();
  global.__sent = [];
  global.__searchShown = 0;
}

(async function () {
  await bridge();
  if (core.canonical({ b: 1, a: 'x' }) !== '{"a":"x","b":1}') fail('canonical');
  if (core.looksRecent('hello')) fail('hello recent');
  if (!core.looksRecent('latest election results')) fail('election recent');
  if (!core.looksRecent('who is the president')) fail('office recent');
  if (core.looksRecent('a story about rivers')) fail('story recent');
  var year = new Date().getFullYear();
  if (!core.looksRecent('the ' + (year - 1) + ' harvest')) fail('year recent');
  if (core.looksRecent('in 1999 the river')) fail('old year');
  if (core.healPrompt('Be kind.').indexOf('Today is ') !== 0) fail('date line');
  if (core.healPrompt('Be kind.').indexOf('search.') === -1) fail('invite');
  if (core.failureLine('timeout') !== 'Search took too long.') fail('timeout line');
  if (core.failureLine('off') !== 'Search is turned off on this device.') fail('off line');
  if (core.failureLine('down') !== 'Our search helper is down (error 5xx).') fail('down line');
  if (core.failureLine('empty') !== 'No results.') fail('empty line');
  var omitted = core.normalizeBranches({ branches: [{ id: 'a', query: 'roots' }] }, 'frost');
  var ids = omitted.map(function (b) { return b.id; });
  if (ids.join(',') !== 'a,b,c,d,e') fail('floor ' + ids.join(','));
  if (omitted[3].name !== 'hunch') fail('hunch label');
  if (omitted[4].prompt.indexOf('dissenter') === -1) fail('dissent prompt');
  var choice = core.chooseGrowth({
    nodes: [
      { id: 'n-a', branch: 'a' },
      { id: 'n-e', branch: 'e' }
    ]
  }, { become: ['n-a'], reason: 'because' });
  if (choice.become.indexOf('n-e') === -1) fail('growth dropped e');

  stubAI('pause');
  var paused = await core.startRun('How does frost remember?');
  if (!paused || paused.status !== 'paused') fail('pause status ' + (paused && paused.status));
  if (global.__calls.length !== 1) fail('pause calls ' + global.__calls.length);
  if (global.__receiptEarly) fail('receipt before pause');
  var resumed = await core.resume();
  if (!resumed || resumed.status !== 'done') fail('resume ' + (resumed && resumed.status));
  if (global.__calls.length < 2) fail('resume did not continue');
  if (global.__dissent < 1) fail('resume dissent');

  await bridge();
  stubAI('stop');
  var stopped = await core.startRun('How does frost remember?');
  if (!stopped || stopped.status !== 'stopped') fail('stop ' + (stopped && stopped.status));
  if (global.__calls.length !== 1) fail('stop calls ' + global.__calls.length);

  await bridge();
  stubAI('retry');
  var retried = await core.startRun('How does frost remember?');
  if (!retried || retried.status !== 'stopped') fail('retry stop ' + (retried && retried.status));
  if (global.__calls.length !== 2) fail('retry count ' + global.__calls.length);

  await bridge();
  stubAI('hungry');
  var beforeHungryReceipt = false;
  global.FLSnowflake.onReceipt = function () {
    if (global.__calls.length < 2) beforeHungryReceipt = true;
    global.__seenReceipt = true;
  };
  var hungry = await core.startRun('How does frost remember?');
  if (beforeHungryReceipt) fail('receipt before run');
  if (!hungry || !hungry.receipt) fail('hungry receipt');
  if (hungry.receipt.calls > 24) fail('calls ' + hungry.receipt.calls);
  if (hungry.receipt.fetches > 30) fail('fetches ' + hungry.receipt.fetches);
  if (hungry.receipt.calls < 24 && hungry.receipt.fetches < 30) fail('cap not hit ' + hungry.receipt.calls + '/' + hungry.receipt.fetches);
  if (global.__calls.length > 24) fail('stub calls ' + global.__calls.length);
  if (String(hungry.receipt.text).indexOf('Caps hit:') === -1) fail('receipt text');

  await bridge();
  stubAI('omit');
  var full = await core.startRun('How does frost remember?');
  if (!full || full.status !== 'done') fail('full ' + (full && full.status) + ' ' + (full && full.receipt && full.receipt.text));
  var flake = full.flake;
  if (!flake) fail('no flake');
  var branches = (flake.branches || []).map(function (b) { return b.id; });
  if (branches.join(',') !== 'a,b,c,d,e') fail('branches ' + branches.join(','));
  var eNode = null;
  var i;
  for (i = 0; i < flake.nodes.length; i++) if (flake.nodes[i].branch === 'e') eNode = flake.nodes[i];
  if (!eNode) fail('no dissenter node');
  if (global.__dissent < 1) fail('dissent call');
  if (!eNode.source || !eNode.source.url || !eNode.date || !eNode.mind || !eNode.confidence) fail('provenance');
  if (full.growth.become.indexOf(eNode.id) === -1) fail('selection dropped e');
  if (full.growth.reason.indexOf('dissenter') === -1 && full.growth.reason.indexOf('belong') === -1 && !full.growth.reason) fail('no reason');
  var book = core.loadLedger();
  for (i = 0; i < book.rows.length; i++) {
    var again = await core.recomputePsi(book.rows[i]);
    if (again !== book.rows[i].psi) fail('psi ' + book.rows[i].kind + ' ' + again + ' vs ' + book.rows[i].psi);
    if (book.rows[i].delta && String(book.rows[i].delta).indexOf('|') === -1 && book.rows[i].kind === 'node') fail('delta');
  }
  var signed = await core.verifyNode(eNode);
  if (!signed.ok) fail('verify');
  var tampered = JSON.parse(JSON.stringify(eNode));
  tampered.text = tampered.text + 'x';
  var bad = await core.verifyNode(tampered);
  if (bad.ok) fail('tamper verified');
  if (!tampered.text) fail('tamper hid text');
  if (!flake.humanHash || !flake.mindHash || !flake.sig || !flake.humanFp || !flake.mindFp) fail('dual hash');
  if (flake.humanHash === flake.mindHash) fail('hashes match');
  var other = await core.makeNode({
    branch: 'a', text: eNode.text, url: 'https://example.invalid/other', title: 'Other',
    confidence: 'known', kind: 'node', flakeId: flake.id
  });
  if (!other || other.psi === eNode.psi) fail('source psi');
  var corr = await core.appendCorrection(flake, eNode.psi, 'A clearer note.', 'The date was thin.');
  if (!corr || corr.points_to !== eNode.psi) fail('correction pointer');
  var stored = core.loadFlakes().filter(function (f) { return f.id === flake.id; })[0];
  var still = false;
  for (i = 0; i < stored.nodes.length; i++) if (stored.nodes[i].psi === eNode.psi) still = true;
  if (!still) fail('old node gone');
  var killed = await core.killMidWrite('fl_snowflake_ledger_v0');
  if (!killed.intact) fail('ledger corrupt');
  var parsed = core.readJSON('fl_snowflake_ledger_v0');
  if (!parsed || !parsed.rows || !parsed.rows.length) fail('ledger unreadable');
  if (!full.adapter || full.adapter.status !== 'queued for desktop') fail('queue ' + (full.adapter && full.adapter.status));
  if (!full.adapter.idsHash || !full.adapter.baseHash) fail('adapter hash');
  if (/score|rank|points/i.test(full.adapter.drift || '')) fail('score ' + full.adapter.drift);
  var beforeAdapters = core.adapterList().length;
  var rolled = await core.rollback(full.adapter.version);
  if (!rolled || rolled.status !== 'rollback') fail('rollback');
  if (core.adapterList().length !== beforeAdapters + 1) fail('rollback deleted');
  if (!global.__jsonl || !global.__py) fail('trainer path');
  if (!global.__memory || global.__memory.content.indexOf(flake.id) === -1) fail('memory');
  if (global.__memory.content.indexOf('How does frost') !== -1) fail('question leaked');

  var oldConf = eNode.confidence;
  var oldDate = eNode.date;
  global.__replay = ['ok', 'weak', 'dead'];
  var replay = await core.replayNow();
  if (!replay || !replay.seen) fail('replay');
  var kinds = replay.seen.map(function (s) { return s.kind; });
  if (kinds.indexOf('held') === -1) fail('ring ' + kinds.join(','));
  if (kinds.indexOf('recheck') === -1) fail('recheck ' + kinds.join(','));
  if (kinds.indexOf('unverified-now') === -1) fail('dead ' + kinds.join(','));
  var againFlake = core.loadFlakes().filter(function (f) { return f.id === flake.id; })[0];
  for (i = 0; i < againFlake.nodes.length; i++) {
    if (againFlake.nodes[i].id === eNode.id) {
      if (againFlake.nodes[i].confidence !== oldConf) fail('confidence rose');
      if (againFlake.nodes[i].date !== oldDate) fail('date changed');
    }
  }
  if (core.ringsOf(eNode.psi) < 1 && kinds.indexOf('held') !== -1) {
    var heldPsi = '';
    for (i = 0; i < replay.seen.length; i++) if (replay.seen[i].kind === 'held') heldPsi = replay.seen[i].psi;
    if (heldPsi && core.ringsOf(heldPsi) < 1) fail('no ring');
  }
  if ((global.__searchShown || 0) < 1) fail('search indicator');

  var sentBefore = global.__sent.length;
  var secret = await core.searchNow('sk-abcDEF123456 secret token');
  if (!secret || secret.sent) fail('secret sent');
  if (global.__sent.length !== sentBefore) fail('secret fetch');
  if (secret.line.indexOf('key') === -1) fail('secret line');

  global.QuietRoom = { isActive: function () { return true; } };
  core.resetMemory();
  var qWrites = core.writes();
  var qFetch = core.fetchesSent();
  var quietRun = await core.startRun('hello frost');
  var quietSearch = await core.searchNow('latest election results');
  var quietLedger = await core.appendLedger({ delta: 'a|node|x', kind: 'node' });
  if (quietRun) fail('quiet run');
  if (quietSearch.sent) fail('quiet fetch');
  if (quietLedger) fail('quiet ledger');
  if (core.writes() !== qWrites) fail('quiet write');
  if (core.fetchesSent() !== qFetch) fail('quiet sent');
  global.QuietRoom = { isActive: function () { return false; } };

  var down = await core.searchNow('weather today');
  // mode is ok by default; force lines with a direct fetch stub already used.
  global.__replay = ['down'];
  // searchNow does not read __replay; fetch does. Next searchNow uses it.
  var downRes = await core.searchNow('weather today');
  if (downRes.line !== 'Our search helper is down (error 5xx).') fail('down got ' + downRes.line);
  global.__replay = ['empty'];
  var emptyRes = await core.searchNow('weather today');
  if (emptyRes.line !== 'No results.') fail('empty got ' + emptyRes.line);
  global.FLWebTool.isSearchEnabled = function () { return false; };
  var offRes = await core.searchNow('weather today');
  if (offRes.line !== 'Search is turned off on this device.') fail('off got ' + offRes.line);
  if (offRes.sent) fail('off sent');
  global.FLWebTool.isSearchEnabled = function () { return true; };
  if (down && down.sent !== true && down.outcome !== 'completed') fail('sample search');

  console.log('NODE_OK snowflake');
})().catch(function (err) {
  console.error(err && err.stack || err);
  process.exit(1);
});
