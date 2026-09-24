#!/usr/bin/env node
// Thin smoke: Connect Bridge-aware minds v0 — models via helped Bridge, toast heal.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const repo = path.join(root, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const md = read('library/CONNECT_BRIDGE_AWARE_v0.md');
const app = read('app.html');
const family = read('library/FRACTAL_FAMILY_LEDGER_v0.md');
const flint = read('Flint.html');
const genRecent = fs.readFileSync(path.join(repo, 'scripts', 'generate-recent.sh'), 'utf8');
const sw = read('sw.js');
const rootSw = fs.readFileSync(path.join(repo, 'sw.js'), 'utf8');

assert.ok(/v-connect-bridge-aware-v0/.test(md), 'marker md');
assert.ok(/v-connect-bridge-aware-v0/.test(app), 'marker app');
assert.ok(/flRememberHelpedBridge/.test(app), 'remember helped Bridge');
assert.ok(/function resolveOllamaBase/.test(app) && /viaBridge|Bridge-aware|flBridgeHealth/.test(app), 'resolve Bridge-aware');

// A1 — Bridge prefer before bare 11434 in resolve path (helped first)
const resolveIdx = app.indexOf('async function resolveOllamaBase');
const resolveSlice = app.slice(resolveIdx, resolveIdx + 2200);
assert.ok(/flBridgeHealth/.test(resolveSlice), 'resolve calls flBridgeHealth');
assert.ok(resolveSlice.indexOf('flBridgeHealth') < resolveSlice.indexOf('isLikelyProxyOrigin') ||
  resolveSlice.indexOf('helped') < resolveSlice.indexOf('/ollama/api/tags'), 'Bridge before proxy/11434');
assert.ok(/fl_bridgePort/.test(app) && /getOllamaBaseUrl/.test(app), 'getOllamaBaseUrl bridge port');

// A2 — modalConnectOllama does not lead with ungated /ollama
const modalIdx = app.indexOf('function modalConnectOllama');
const modalSlice = app.slice(modalIdx, modalIdx + 1800);
assert.ok(/resolveOllamaBase|v-connect-bridge-aware-v0/.test(modalSlice), 'modal Bridge-aware');
assert.ok(/isLikelyProxyOrigin/.test(modalSlice), 'modal gates proxy');
assert.ok(/no minds yet|Get one/.test(modalSlice), 'Mom empty copy');
assert.ok(!/Run: ollama pull/.test(modalSlice), 'no ollama pull on main path');

// A4 — toast gated when connected
assert.ok(/showOllamaToast/.test(app) && /AiSetup\.isConnected|flHasOneMindConnected/.test(app), 'toast gate');
assert.ok(/fl_ollamaHost/.test(app) && /acceptToast|connectOllama/.test(app), 'toast sets fl_*');

// A5 — overlay id
assert.ok(/providerModalOverlay/.test(app), 'providerModalOverlay present');
assert.ok(/getElementById\('providerModalOverlay'\)|getElementById\(\\?'providerModalOverlay\\?'\)/.test(app) ||
  /providerModalOverlay'\)\|\|document\.getElementById\('pmOverlay'\)/.test(app) ||
  /providerModalOverlay/.test(app) && /flOpenConnectWizard[\s\S]{0,200}providerModalOverlay/.test(app),
  'close paths prefer providerModalOverlay');

// Ledger + temperature + soft leave
assert.ok(/Connect Bridge-aware/.test(family) && /Temperature:/.test(family), 'Family Ledger temperature');
assert.ok(/v-connect-bridge-aware-v0/.test(flint) && /Temperature:/i.test(flint), 'Flint temperature');
assert.ok(/CONNECT_BRIDGE_AWARE/.test(genRecent), 'RECENT');
assert.ok(/Named five stay five/.test(md) && /Quiet Room shut/.test(md), 'soft paste');
assert.ok(!/connect-bridge-aware|CONNECT_BRIDGE_AWARE|flRememberHelpedBridge/i.test(sw), 'soft leave sw docs');
assert.ok(!/connect-bridge-aware|CONNECT_BRIDGE_AWARE|flRememberHelpedBridge/i.test(rootSw), 'soft leave sw root');
assert.ok(!/Access-Control-Allow-Origin:\s*\*/.test(md), 'no bare star');
assert.ok(!/US\s?\d{7,}/.test(md), 'no USPTO');

console.log('SMOKE_OK connect bridge aware v0');
console.log('Bridge prefer · modal · toast gate · overlay · soft leave sw');
