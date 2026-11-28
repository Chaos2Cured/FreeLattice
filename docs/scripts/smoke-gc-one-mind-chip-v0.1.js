#!/usr/bin/env node
// File-only smoke: One Mind chip v0.1.
// The scan lists minds already on this computer. A pick sticks.
// The chip opens the sheet, stays 44px, and does not open Connect.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const repo = path.join(__dirname, '..', '..');

function read(rel) {
  return fs.readFileSync(path.join(repo, rel), 'utf8');
}
function between(src, start, end) {
  const a = src.indexOf(start);
  const b = src.indexOf(end, a + start.length);
  assert.ok(a !== -1 && b !== -1, 'missing slice ' + start);
  return src.slice(a, b);
}

const app = read('docs/app.html');
const index = read('index.html');
assert.strictEqual(app, index, 'twins match');
assert.ok(app.indexOf('id="modelSwitcherDropdown" style="display:none !important;"') !== -1, 'old list stays hidden');
assert.ok(app.indexOf('function flWelcomeChat') !== -1, 'welcome door stays');
assert.ok(app.indexOf('id="lmstudioHostInput"') !== -1, 'custom host field stays');
assert.ok(app.indexOf('function flTestLMStudio') !== -1, 'existing host test stays');

const btn = between(app, '.model-switcher-btn {', '}');
assert.ok(/min-height:\s*44px/.test(btn), 'chip is 44px at the base rule');
const baseAt = app.indexOf('.model-switcher-btn {');
const narrowChip = app.indexOf('.model-switcher-btn { min-height: 44px; }');
assert.ok(baseAt !== -1 && narrowChip > baseAt, '44px is on the base rule, and the narrow query still has it');

const chip = between(app, "var chip = document.getElementById('modelSwitcherBtn');", '// Close on outside click');
assert.ok(/flMindSheetToggle\(\)/.test(chip), 'chip opens the sheet');
assert.ok(chip.indexOf('openProviderModal') === -1, 'chip does not call openProviderModal');
assert.ok(chip.indexOf("switchTab('connect')") === -1, 'chip does not open Connect');
assert.ok(chip.indexOf('flPlayGateProvider') === -1, 'chip does not use the play gate');
assert.ok(chip.indexOf('hasLocalMind') === -1, 'chip opens with no mind connected');

const pick = between(app, 'function flMindPick', 'function flMindSheetFill');
assert.ok(pick.indexOf('FlConnect.remember') !== -1, 'pick calls remember');
assert.ok(pick.indexOf('FlConnect.markUserChoice') !== -1, 'pick calls markUserChoice');
assert.ok(pick.indexOf('removeItem') === -1, 'pick clears no storage');
assert.ok(pick.indexOf('fl_apiKey') === -1, 'pick clears no key');
assert.ok(pick.indexOf('fl_clay') === -1, 'pick does not touch clay');
assert.ok(pick.indexOf('/api/pull') === -1, 'pick does not pull');

const toggle = between(app, 'function flMindSheetToggle', 'window.flMindSheetToggle');
assert.ok(toggle.indexOf('openProviderModal') === -1, 'toggle does not open the provider modal');
assert.ok(toggle.indexOf("switchTab('connect')") === -1, 'toggle does not open Connect');
assert.ok(toggle.indexOf('flPlayGateProvider') === -1, 'toggle does not use the play gate');
assert.ok(app.indexOf('Scan again') !== -1, 'scan again stays');
assert.ok(app.indexOf('This door is on. This site cannot read it yet. Allow this site in that program, then scan again.') !== -1, 'a blocked door keeps a plain line');
assert.ok(app.indexOf('A saved key') !== -1, 'a saved key row stays');
const sheet = between(app, 'function flMindSheetEl', 'window.flMindSheetToggle');
assert.ok(sheet.indexOf('\u2014') === -1, 'new sheet copy has no em dash');
assert.ok(sheet.indexOf('removeItem') === -1 && sheet.indexOf('fl_clay') === -1 && sheet.indexOf('fl_apiKey') === -1, 'sheet clears nothing');

const connect = read('docs/modules/fl-connect.js');
assert.ok(connect.indexOf('scanLocalDoors') !== -1, 'scan is on FlConnect');
assert.ok(connect.indexOf('/api/pull') === -1, 'scan source has no pull');
for (const port of [11434, 11435, 11445, 1234, 8080, 8000, 5001, 5000, 1337, 4891]) {
  assert.ok(connect.indexOf(String(port)) !== -1, 'door ' + port + ' is listed');
}

function loadConnect(extra) {
  const store = {};
  const sb = {
    localStorage: {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; }
    },
    document: { getElementById: function () { return null; } },
    console: console,
    AbortSignal: AbortSignal,
    URL: URL,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    fetch: async function () { throw new Error('no network'); }
  };
  Object.assign(sb, extra || {});
  sb.window = sb;
  vm.runInNewContext(connect, sb, { filename: 'fl-connect.js' });
  sb._store = store;
  return sb;
}

function host(v) {
  return JSON.parse(JSON.stringify(v));
}

(async function () {
  const seen = [];
  const recording = loadConnect({
    fetch: async function (url) {
      seen.push(String(url));
      throw new Error('down');
    }
  });
  const empty = await recording.FlConnect.scanLocalDoors({ timeoutMs: 30, fetch: recording.fetch });
  assert.deepStrictEqual(host(empty.groups), [], 'a quiet computer lists nothing');
  const urls = seen.join('\n');
  assert.ok(urls.indexOf('http://127.0.0.1:11434/api/tags') !== -1, 'asks 11434 for tags');
  assert.ok(urls.indexOf('http://127.0.0.1:11435/bridge/health') !== -1, 'asks Bridge health first');
  assert.ok(urls.indexOf('http://127.0.0.1:11445/bridge/health') !== -1, 'asks the last Bridge port');
  for (const port of [1234, 8080, 8000, 5001, 5000, 1337, 4891]) {
    assert.ok(urls.indexOf('http://127.0.0.1:' + port + '/v1/models') !== -1, 'asks port ' + port);
  }
  assert.ok(urls.indexOf('/api/pull') === -1, 'scan never pulls');
  assert.ok(!/https?:\/\/(?!127\.0\.0\.1)/.test(urls), 'scan stays on this computer');

  function routes(map) {
    return async function (url, opts) {
      const hit = map[String(url)];
      if (!hit) throw new Error('down');
      if (hit.blocked && (!opts || opts.mode !== 'no-cors')) throw new Error('cors');
      if (hit.blocked) return { type: 'opaque', status: 0, ok: false };
      return { ok: true, status: 200, type: 'basic', json: async function () { return hit.json; } };
    };
  }
  const found = loadConnect();
  const listed = await found.FlConnect.scanLocalDoors({
    timeoutMs: 30,
    doors: [
      { port: 11434, shape: 'tags' },
      { port: 11436, shape: 'bridge' },
      { port: 1234, shape: 'v1' },
      { port: 8080, shape: 'v1' },
      { port: 9, shape: 'tags', host: '8.8.8.8' }
    ],
    fetch: routes({
      'http://127.0.0.1:11434/api/tags': { json: { models: [{ name: 'quiet' }, { name: 'quiet' }, { name: 'spark' }] } },
      'http://127.0.0.1:11436/bridge/health': { json: { bridge: true, helped: true } },
      'http://127.0.0.1:11436/api/tags': { json: { models: [{ name: 'bridge-mind' }] } },
      'http://127.0.0.1:1234/v1/models': { json: { data: [{ id: 'local-one' }] } },
      'http://127.0.0.1:8080/v1/models': { blocked: true }
    })
  });
  const groups = host(listed.groups);
  assert.strictEqual(groups.length, 4, 'four doors answered');
  assert.strictEqual(groups[0].label, 'on this computer, port 11434');
  assert.deepStrictEqual(groups[0].models, ['quiet', 'spark']);
  assert.strictEqual(groups[1].label, 'on this computer, port 11436');
  assert.deepStrictEqual(groups[1].models, ['bridge-mind']);
  assert.strictEqual(groups[2].label, 'on this computer, port 1234');
  assert.deepStrictEqual(groups[2].models, ['local-one']);
  assert.strictEqual(groups[3].blocked, true, 'a blocked door stays');
  assert.deepStrictEqual(groups[3].models, []);
  assert.ok(!groups.some(function (g) { return g.port === 9; }), 'a public host is skipped');

  const stick = loadConnect();
  stick.FlConnect.remember({ name: 'quiet', base: 'http://127.0.0.1:11434', port: 11434 });
  stick.FlConnect.markUserChoice('quiet', 'ollama');
  assert.strictEqual(stick._store.fl_ollamaModel, 'quiet', 'the choice sticks');
  assert.strictEqual(stick._store.fl_isLocal, 'true', 'local stays on');
  assert.ok(!Object.prototype.hasOwnProperty.call(stick._store, 'fl_apiKey'), 'no key written');
  assert.ok(!Object.prototype.hasOwnProperty.call(stick._store, 'fl_clay'), 'clay untouched');

  const live = read('sw.js').match(/^\s*const CACHE_NAME\s*=\s*'freelattice-v([^']+)'/m);
  assert.strictEqual(live && live[1], '5.79.49', 'live cache');
  assert.strictEqual(read('sw.js'), read('docs/sw.js'), 'workers match');
  const lock = JSON.parse(read('docs/library/LOCK_MANIFEST_v0.1.json'));
  const twin = crypto.createHash('md5').update(app, 'utf8').digest('hex');
  assert.strictEqual(lock.files['docs/app.html'].slice(-1)[0].md5, twin, 'app lock row');
  assert.strictEqual(lock.files['index.html'].slice(-1)[0].md5, twin, 'index lock row');
  const worker = crypto.createHash('md5').update(read('sw.js'), 'utf8').digest('hex');
  assert.strictEqual(lock.files['sw.js'].slice(-1)[0].md5, worker, 'sw lock row');
  assert.strictEqual(lock.files['docs/sw.js'].slice(-1)[0].md5, worker, 'docs sw lock row');

  console.log('smoke-gc-one-mind-chip-v0.1: PASS');
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
