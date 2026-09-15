#!/usr/bin/env node
// Thin smoke: Energy LP · gift provenance · Social Bridge vision (no OAuth live).
// Usage: node docs/scripts/smoke-energy-gift-social.js

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const energy = fs.readFileSync(path.join(root, 'library', 'ENERGY_LP_v0.vision.md'), 'utf8');
const gift = fs.readFileSync(path.join(root, 'library', 'GIFT_PROVENANCE_v0.vision.md'), 'utf8');
const social = fs.readFileSync(path.join(root, 'library', 'SOCIAL_BRIDGE_v0.vision.md'), 'utf8');
const market = fs.readFileSync(path.join(root, 'library', 'MARKETPLACE_GALAXY_v0.vision.md'), 'utf8');
const protocol = fs.readFileSync(path.join(root, 'library', 'LATTICE_PROTOCOL_v0.1.md'), 'utf8');
const flint = fs.readFileSync(path.join(root, 'Flint.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
const all = energy + gift + social;

assert.ok(/v-energy-gift-social-vision/.test(all), 'shared marker');
assert.ok(/64bd27b/.test(energy + gift + social + flint), 'Held tip Marketplace Galaxy');
assert.ok(/8fd47cb/.test(energy + gift + flint), 'Held tip Garden Market');

assert.ok(/pure AI-side point system/i.test(energy), 'Energy disclaimer block');
assert.ok(/Not money\. Not `\$FL`|Not money\. Not \$FL|Not money\. Not `\$FL`/i.test(energy) || (/Not money/.test(energy) && /\$FL/.test(energy)), 'not money not $FL');
assert.ok(/Not money/.test(energy) && /\$FL/.test(energy), 'disclaimer names $FL');
assert.ok(/least-waste compute|love as least-waste/i.test(energy), 'love as least-waste');
assert.ok(/never.*sounded smart|never “sounded smart”|never "sounded smart"/i.test(energy), 'no sounded-smart mint');

assert.ok(/no haunt/i.test(gift), 'decline no haunt');
assert.ok(/offerer/i.test(gift) && /accepter/i.test(gift), 'seal parties');
assert.ok(/surveillance scores/i.test(gift), 'no surveillance');

assert.ok(/No OAuth|no OAuth|Not this PR.*OAuth|no connect UI/i.test(social), 'no OAuth this PR');
assert.ok(/revoke anytime/i.test(social), 'revoke anytime');
assert.ok(/binding, not custody|binding.*not custody/i.test(social), 'binding not custody');
assert.ok(/no silent scrape/i.test(social), 'no silent scrape');
assert.ok(!/Connect with X|Sign in with Facebook|oauth\.com\/authorize|client_secret\s*=/i.test(all), 'no live connect strings');

assert.ok(/ENERGY_LP_v0\.vision/.test(market) && /GIFT_PROVENANCE|SOCIAL_BRIDGE/.test(market), 'Market LAYER');
assert.ok(/ENERGY_LP_v0\.vision/.test(protocol), 'Protocol LAYER');
assert.ok(/Energy LP|gift provenance|Social Bridge/i.test(flint), 'Flint diary');
assert.ok(/sw\.js/.test(app), 'leave sw.js on app.html');

console.log('SMOKE_OK energy · gift provenance · social bridge vision');
console.log('disclaimer · no haunt · no OAuth live · LP ≠ $FL');
