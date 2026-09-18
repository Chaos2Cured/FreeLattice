#!/usr/bin/env node
// Thin smoke: Bridge binary www-local — stay in browser · Yes/Not now/Please · allowlist · Mom dual held.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const repo = path.join(root, '..');
const install = fs.readFileSync(path.join(root, 'install.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
const ledger = fs.readFileSync(path.join(root, 'library', 'BRIDGE_BINARY_WWW_LOCAL_LEDGER_v0.md'), 'utf8');
const flint = fs.readFileSync(path.join(root, 'Flint.html'), 'utf8');
const proxy = fs.readFileSync(path.join(repo, 'bridge', 'proxy-core.js'), 'utf8');
const main = fs.readFileSync(path.join(repo, 'bridge', 'main.js'), 'utf8');
const door = fs.readFileSync(path.join(repo, 'bridge', 'ui', 'first-door.html'), 'utf8');
const pkg = fs.readFileSync(path.join(repo, 'bridge', 'package.json'), 'utf8');

assert.ok(/v-bridge-binary-www-local-v0/.test(install + app + ledger + proxy), 'marker');
assert.ok(/id="bridge-download"/.test(install), '#bridge-download');
assert.ok(/Bridge — stay in your browser|stay in your browser/i.test(install), 'stay in browser');
assert.ok(/Yes, help/.test(door + install), 'Yes, help');
assert.ok(/Not now/.test(door), 'Not now');
assert.ok(/Please explain/.test(door), 'Please explain');
assert.ok(/11435/.test(proxy + app + ledger), 'port 11435');
assert.ok(/freelattice/.test(proxy) && /thelatticetree/.test(proxy), 'allowlist origins');
assert.ok(/ALLOWED_ORIGIN_PATTERNS/.test(proxy), 'allowlist table');
assert.ok(!/Access-Control-Allow-Origin'\s*:\s*'\*'/.test(proxy) && !/Allow-Origin['"\s]*:\s*['"]\*/.test(proxy), 'no bare * in Bridge proxy');
assert.ok(/ALLOWED_ORIGIN|originAllowed/.test(proxy), 'allowlist fn');
assert.ok(/flUseBridge|Bridge on · use it|flBridgeDetect/.test(app), 'Connect chip/detect');
assert.ok(/install\.html#bridge-download/.test(app), 'Connect → Bridge download');
assert.ok(/FreeLattice Bridge|freelattice-bridge/.test(pkg), 'package name');
assert.ok(/createBridgeServer|proxyToOllama/.test(proxy + main), 'proxy core');
assert.ok(/Jeffrey|equal.access|Mom dual|points only/i.test(ledger), 'ledger equal access');
assert.ok(/WebLLM|No Install|sibling/i.test(ledger + install), 'No Install sibling named');
assert.ok(/Bridge binary|v-bridge-binary|www.local|11435/i.test(flint), 'Flint diary');
assert.ok(/id="fl-connect-play"/.test(app), 'Connect Play held');
assert.ok(/sw\.js/.test(app), 'leave sw.js');
assert.ok(/CMD|OLLAMA_ORIGINS/.test(ledger) && /Reject|never the primary|without CORS/i.test(ledger + install), 'reject CMD primary');

console.log('SMOKE_OK bridge binary www-local v0');
console.log('bridge-download · Yes/Not now/Please · allowlist · Connect chip · Mom dual held');
