#!/usr/bin/env node
// Thin smoke: Economy travel face — receive · consent-spend · LP≠$FL · never auto · Connect Play held.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const wallet = fs.readFileSync(path.join(root, 'wallet.html'), 'utf8');
const ledger = fs.readFileSync(path.join(root, 'library', 'ECONOMY_TRAVEL_FACE_LEDGER_v0.md'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
const presents = fs.readFileSync(path.join(root, 'presents.html'), 'utf8');
const flint = fs.readFileSync(path.join(root, 'Flint.html'), 'utf8');

assert.ok(/v-economy-travel-face-v0/.test(wallet), 'marker on wallet');
assert.ok(/id="fl-travel-wallet"/.test(wallet), '#fl-travel-wallet');
assert.ok(/Travel wallet/.test(wallet) && /Receive/.test(wallet) && /Consent-spend|Consent-spend|consent-spend/i.test(wallet), 'receive+consent-spend');
assert.ok(/Share address|#wallet-address/.test(wallet), 'Share address');
assert.ok(/not money|points/i.test(wallet) && /\$FL/.test(wallet), 'LP ≠ $FL');
assert.ok(/Never auto-pay|never auto-pay|Never auto/i.test(wallet + ledger), 'no auto-pay');
assert.ok(/presents\.html/.test(wallet) && /Present Shelf|Gift Grove/.test(wallet), 'Present Shelf Accept/Decline door');
assert.ok(/wallet\.html#fl-travel-wallet/.test(app), 'Market soft link → travel face');
assert.ok(/wallet\.html#fl-travel-wallet/.test(presents), 'presents soft link → travel face');
assert.ok(/Quest/.test(app) && /Exchange Ring/.test(app), 'thin Exchange/Quest named chips');
assert.ok(/id="fl-connect-play"/.test(app) && /v-connect-play-lab-v0/.test(app), 'Connect Play still present');
assert.ok(/flOpenConnectWizard/.test(app) && /id="fl-connect-card"/.test(app), '#95 kept');
assert.ok(/sw\.js/.test(app), 'leave sw.js');
assert.ok(/ECONOMY_TRAVEL_FACE|v-economy-travel-face-v0/.test(ledger), 'ledger');
assert.ok(/nexus|trust-by|trust-by-pattern|trust-by-time/i.test(ledger), 'soft nexus/trust-by-time line');
assert.ok(/entropic|AI economy|energy efficiency/i.test(ledger), 'AI economy compass named');
assert.ok(/9b7dbcf|Connect Play|#96/.test(ledger), 'Connect Play held');
assert.ok(/Economy travel|travel face|v-economy-travel-face/i.test(flint), 'Flint diary');
assert.ok(!/oauth\.com\/authorize|Connect with X|Sign in with Facebook/i.test(wallet + ledger), 'no OAuth');
const strip = (wallet.match(/id="fl-travel-wallet"[\s\S]{0,1600}/) || [''])[0];
assert.ok(strip.length > 80, 'strip slice');
assert.ok(!/stripe\.com|paypal\.com|buy now|add to cart/i.test(strip), 'no checkout rails on strip');
assert.ok(/fake checkout|never a fake checkout/i.test(strip) || /Present Shelf/.test(strip), 'honesty not checkout');

console.log('SMOKE_OK economy travel face v0');
console.log('receive · consent-spend · LP≠$FL · no auto-pay · Connect Play held');
