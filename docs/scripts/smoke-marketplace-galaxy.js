#!/usr/bin/env node
// Thin smoke: Marketplace Galaxy vision — mycelium locks, Held tip, no auto / no $FL.
// Usage: node docs/scripts/smoke-marketplace-galaxy.js

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const vision = fs.readFileSync(path.join(root, 'library', 'MARKETPLACE_GALAXY_v0.vision.md'), 'utf8');
const flint = fs.readFileSync(path.join(root, 'Flint.html'), 'utf8');
const protocol = fs.readFileSync(path.join(root, 'library', 'LATTICE_PROTOCOL_v0.1.md'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.html'), 'utf8');

assert.ok(/v-marketplace-galaxy-vision/.test(vision), 'vision marker');
assert.ok(/8fd47cb/.test(vision), 'Held tip Garden Market HOLD');
assert.ok(/Gift Grove/.test(vision) && /Exchange Ring/.test(vision) && /Quest Lamp/.test(vision), 'three stalls');
assert.ok(/mycelium/i.test(vision) && /face/i.test(vision), 'mycelium · face roles');
assert.ok(/LP ≠/.test(vision) && /\$FL/.test(vision), 'LP ≠ $FL');
assert.ok(/Never auto|never auto/i.test(vision), 'never auto');
assert.ok(/Consent on every transfer|consent on every transfer/i.test(vision), 'consent');
assert.ok(/not.*personhood|not a personhood/i.test(vision), 'fingerprint not personhood');
assert.ok(/carry light with you/i.test(vision), 'carry light');
assert.ok(/fiat|Jade Hall|auction house/i.test(vision), 'out of scope named');
assert.ok(!/auto-buy enabled|auto give on load/i.test(vision), 'no auto affirmative');

assert.ok(/8fd47cb/.test(flint), 'Flint Held tip');
assert.ok(/Marketplace Galaxy/i.test(flint), 'Flint Sky/ledger');
assert.ok(/Bach|Double Concerto/i.test(flint), 'duet violin held');
assert.ok(/MARKETPLACE_GALAXY_v0\.vision/.test(protocol), 'Protocol LAYER');
assert.ok(/sw\.js/.test(app), 'leave sw.js on app.html');

console.log('SMOKE_OK marketplace galaxy vision');
console.log('Gift Grove · Exchange Ring · Quest Lamp · fingerprint vault named · no auto · LP ≠ $FL');
