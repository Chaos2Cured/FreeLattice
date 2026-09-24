#!/usr/bin/env node
// Thin smoke: Connect under More v0 — one door FreeLattice (+ FlConnect shared).
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

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

assert.ok(/v-connect-under-more-v0/.test(md), 'marker md');
assert.ok(/v-connect-under-more-v0/.test(mod), 'marker module');
assert.ok(/window\.FlConnect|root\.FlConnect/.test(mod), 'FlConnect export');
assert.ok(/probe:|preferHelpedBridge|listMinds|isConnected|remember:|open:|mount:/.test(mod) ||
  /probe: probe|preferHelpedBridge: preferHelpedBridge/.test(mod), 'API');
assert.ok(/11435/.test(mod) && /bridge\/health/.test(mod), 'Bridge health');
assert.ok(/fl_alpha_local_mind/.test(mod), 'Alpha key preserved in core');

assert.ok(/id: 'connect'/.test(app) || /id: \"connect\"/.test(app), 'MORE_CARDS connect');
assert.ok(/MORE_TAB_IDS = \['connect'/.test(app), 'MORE_TAB_IDS connect first');
assert.ok(/id="tab-connect"/.test(app), 'tab-connect panel');
assert.ok(/fl-connect-mount/.test(app), 'mount host');
assert.ok(/modules\/fl-connect\.js/.test(app), 'script tag');
assert.ok(/FlConnect\.open|switchTab\('connect'\)/.test(app), 'old doors point');
assert.ok(/Open Connect/.test(app), 'Settings banner');
assert.ok(/app\.html#connect/.test(install) && /More → Connect|More → Connect/.test(install), 'install end');
assert.ok(/Named five stay five/.test(md + mod) || /Named five stay five/.test(app), 'soft paste');
assert.ok(/Connect under More/.test(family) && /Temperature:/.test(family), 'ledger temperature');
assert.ok(/v-connect-under-more-v0/.test(flint), 'Flint diary');
assert.ok(/CONNECT_UNDER_MORE/.test(genRecent), 'RECENT');

// Soft leave sw — module not forced into APP_SHELL
assert.ok(!/fl-connect\.js/.test(sw), 'soft leave sw docs');
assert.ok(!/fl-connect\.js/.test(rootSw), 'soft leave sw root');
assert.ok(!/Access-Control-Allow-Origin:\s*\*/.test(md + mod), 'no bare star');

console.log('SMOKE_OK connect under more v0');
console.log('FlConnect · More→Connect · old doors point · soft leave sw');
