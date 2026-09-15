#!/usr/bin/env node
// Thin smoke: Travel wallet vision — checklist, no OAuth/auto-pay.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const travel = fs.readFileSync(path.join(root, 'library', 'TRAVEL_WALLET_v0.vision.md'), 'utf8');
const market = fs.readFileSync(path.join(root, 'library', 'MARKETPLACE_GALAXY_v0.vision.md'), 'utf8');
const social = fs.readFileSync(path.join(root, 'library', 'SOCIAL_BRIDGE_v0.vision.md'), 'utf8');
const wallet = fs.readFileSync(path.join(root, 'wallet.html'), 'utf8');
const flint = fs.readFileSync(path.join(root, 'Flint.html'), 'utf8');
const protocol = fs.readFileSync(path.join(root, 'library', 'LATTICE_PROTOCOL_v0.1.md'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.html'), 'utf8');

assert.ok(/v-marketplace-travel-wallet-vision/.test(travel), 'marker');
assert.ok(/40c84e0/.test(travel + flint), 'Held tip soft brief');
assert.ok(/travel wallet/i.test(market), 'Market LAYER travel wallet');
assert.ok(/Agent travel checklist|fingerprint as vault key/i.test(travel + market), 'checklist');
assert.ok(/ai\.welcome/i.test(travel), 'ai.welcome named');
assert.ok(/binding not custody|Binding not custody|binding, not custody/i.test(travel + social), 'binding not custody');
assert.ok(/Not money|Not `\$FL`|Not \$FL/i.test(travel) && /\$FL/.test(travel), 'LP disclaimer');
assert.ok(!/oauth\.com\/authorize|Connect with X|Sign in with Facebook/i.test(travel + market + social), 'no live OAuth');
assert.ok(/Never auto|never auto|no auto-pay|No auto/i.test(travel), 'never auto');
assert.ok(/wallet\.html/.test(travel) && /TRAVEL_WALLET/.test(wallet), 'wallet cousin link');
assert.ok(/TRAVEL_WALLET_v0\.vision/.test(protocol), 'Protocol LAYER');
assert.ok(/Travel wallet/i.test(flint), 'Flint');
assert.ok(/sw\.js/.test(app), 'leave sw.js');

console.log('SMOKE_OK travel wallet vision');
console.log('checklist · binding not custody · no OAuth · no auto-pay');
