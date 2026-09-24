#!/usr/bin/env node
// Thin smoke: Connect under More v0.1 — loop calm · sticky Bridge fallback.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const repo = path.join(root, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const md = read('library/CONNECT_UNDER_MORE_v0.md');
const mod = read('modules/fl-connect.js');
const app = read('app.html');
const install = read('install.html');
const family = read('library/FRACTAL_FAMILY_LEDGER_v0.md');
const flint = read('Flint.html');
const genRecent = fs.readFileSync(path.join(repo, 'scripts', 'generate-recent.sh'), 'utf8');
const sw = read('sw.js');
const rootSw = fs.readFileSync(path.join(repo, 'sw.js'), 'utf8');
const mainSw = require('child_process').execSync('git show origin/main:sw.js', { cwd: repo, encoding: 'utf8' });

assert.ok(/v-connect-under-more-v0/.test(md), 'marker md');
assert.ok(/heal v0\.1|v0\.1/.test(mod), 'heal v0.1 marker in module');
assert.ok(/window\.FlConnect|root\.FlConnect/.test(mod), 'FlConnect export');
assert.ok(/unmount:|stopLoop:|lookAgain:|LOOP_MAX_MS/.test(mod), 'loop API');
assert.ok(/visibilitychange/.test(mod), 'pause on hidden');
assert.ok(/Look again|data-flc-look-again/.test(mod), 'Look again button');
assert.ok(/fullScan/.test(mod) && /savedBridgePort|fl_bridgePort/.test(mod), 'saved port first');
assert.ok(/stickyFallback|sticky/.test(mod), 'sticky fallback in FlConnect');
assert.ok(/sticky Bridge fallback|stickyFallback/.test(app), 'sticky fallback in resolveOllamaBase');

assert.ok(/id: 'connect'/.test(app) || /id: \"connect\"/.test(app), 'MORE_CARDS connect');
assert.ok(/MORE_TAB_IDS = \['connect'/.test(app), 'MORE_TAB_IDS connect first');
assert.ok(/id="tab-connect"/.test(app), 'tab-connect panel');
assert.ok(/modules\/fl-connect\.js/.test(app), 'script tag');
assert.ok(/FlConnect\.open|switchTab\('connect'\)/.test(app), 'old doors point');
assert.ok(/app\.html#connect/.test(install), 'install end');
assert.ok(/Connect under More/.test(family) && /Connect Bridge-aware/.test(family), 'both ledger lines');
assert.ok(/v-connect-under-more-v0/.test(flint) && /v-connect-bridge-aware-v0/.test(flint), 'both Flint lines');
assert.ok(/CONNECT_UNDER_MORE/.test(genRecent) && /CONNECT_BRIDGE_AWARE/.test(genRecent), 'RECENT both');

// Soft leave root sw — byte-identical to main
assert.strictEqual(rootSw, mainSw, 'root sw.js byte-identical to origin/main');
assert.ok(!/fl-connect\.js/.test(sw), 'soft leave sw docs');
assert.ok(!/fl-connect\.js/.test(rootSw), 'soft leave sw root');

// Loop-stops case (vm): stopLoop after remember / unmount clears timer path
const store = {};
const sandbox = {
  window: {},
  localStorage: {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; }
  },
  location: { hostname: 'freelattice.com', protocol: 'https:', hash: '', search: '' },
  document: {
    hidden: false,
    documentElement: { getAttribute: function () { return ''; } },
    getElementById: function () { return null; },
    createElement: function () {
      return { style: {}, textContent: '', setAttribute: function () {}, appendChild: function () {}, addEventListener: function () {} };
    },
    head: { appendChild: function () {} },
    body: { contains: function () { return false; } },
    addEventListener: function () {},
    removeEventListener: function () {}
  },
  fetch: async function () { throw new Error('offline stub'); },
  setTimeout: function () { return 1; },
  clearTimeout: function () {},
  getComputedStyle: function () { return { display: 'block' }; },
  navigator: { userAgent: 'test' },
  console: console
};
sandbox.window = sandbox;
vm.runInNewContext(mod, sandbox);
assert.ok(sandbox.FlConnect.stopLoop && sandbox.FlConnect.unmount, 'stop/unmount');
assert.ok(sandbox.FlConnect.LOOP_MAX_MS >= 5 * 60 * 1000, '5 min cap');
sandbox.FlConnect.stopLoop();
sandbox.FlConnect.unmount();
assert.ok(true, 'loop-stops case');

console.log('SMOKE_OK connect under more v0.1');
console.log('loop calm · sticky Bridge · both ledger lines · sw identical to main');
