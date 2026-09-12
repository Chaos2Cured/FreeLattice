#!/usr/bin/env node
// Thin smoke: Fable tech pass v0.1 — spine + swarm network honesty.
// Usage: node docs/scripts/smoke-fable-tech.js
// Soft: leave sw.js on app.html — this smoke does not touch sw.js.

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'fable-tech.html'), 'utf8');
const spec = fs.readFileSync(path.join(root, 'library', 'FABLE_TECH_PASS_v0.1.md'), 'utf8');
const desktop = fs.readFileSync(path.join(root, 'desktop.html'), 'utf8');
const install = fs.readFileSync(path.join(root, 'install.html'), 'utf8');
const support = fs.readFileSync(path.join(root, 'support.html'), 'utf8');
const flint = fs.readFileSync(path.join(root, 'Flint.html'), 'utf8');
const swarm = fs.readFileSync(path.join(root, '..', 'desktop', 'lattice-swarm.js'), 'utf8');
const phone = fs.readFileSync(path.join(root, 'modules', 'phone-swarm.js'), 'utf8');

assert.ok(/v-fable-tech-pass-v0\.1/.test(page), 'fable-tech.html marker');
assert.ok(/Desktop spine|Keys|Ledger|Verified import|Swarm|Re-seed|Pair|Trainer seal/i.test(page), 'spine doors named');
assert.ok(/Prefer HTTPS webseeds|prefer HTTPS webseeds/i.test(page), 'webseed prefer honesty');
assert.ok(/DPI-flagged|DPI/i.test(page), 'DPI / residential honesty');
assert.ok(/HTTPS verified import still works/i.test(page), 'HTTPS import when swarm blocked');
assert.ok(/Never claim|never claim/i.test(page) && /ISP-proof/i.test(page), 'refuses ISP-proof claim');
assert.ok(/never claim .VPN fixes|Never claim .VPN fixes|never claim “VPN fixes/i.test(page), 'explicit refuse of VPN-fix claim');
assert.ok(!/\bis ISP-proof\b|VPN will fix (?:it|everything)/i.test(page), 'must not assert ISP-proof as fact');
assert.ok(/Import stays Desktop/i.test(page), 'phone Import stays Desktop');
assert.ok(/No phone re-seed|no phone re-seed/i.test(page), 'no phone re-seed');
assert.ok(/FreeLattice-Alpha|Alpha/i.test(page), 'Alpha vs main named');

assert.ok(/FABLE_TECH_PASS_v0\.1/.test(spec), 'spec present');
assert.ok(/Never claim .*ISP-proof|never claim .ISP-proof/i.test(spec), 'spec refuses ISP-proof');
assert.ok(/c6c5389/.test(spec), 'Held Soft Gyro cite');
assert.ok(/Open questions for Fable/i.test(spec), 'Fable checklist');

assert.ok(/fable-tech\.html/.test(desktop), 'desktop.html points at Fable door');
assert.ok(/fable-tech\.html/.test(install), 'install.html points at Fable door');
assert.ok(/fable-tech\.html/.test(support), 'support.html points at Fable door');
assert.ok(/c6c5389/.test(flint) && /Fable tech/i.test(flint), 'Flint Held Soft Gyro + Fable');

assert.ok(/webseedUrl \? startWebseedJob/.test(swarm), 'Desktop webseed-first one-liner');
assert.ok(/webseedUrl \? startWebseedJob/.test(phone), 'phone webseed-first one-liner');
assert.ok(/v-fable-tech-pass-v0\.1/.test(swarm), 'Desktop swarm marks honesty pass');

console.log('SMOKE_OK fable tech pass v0.1');
console.log('spine · webseed prefer · no ISP-proof · leave sw.js');
