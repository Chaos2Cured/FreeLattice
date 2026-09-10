#!/usr/bin/env node
// Thin smoke: 60s proof page markers + three beats.
// Usage: node docs/scripts/smoke-proof-60s.js

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const proof = fs.readFileSync(path.join(root, 'proof.html'), 'utf8');
const spec = fs.readFileSync(path.join(root, 'library', 'PROOF_60S_v0.1.md'), 'utf8');
const install = fs.readFileSync(path.join(root, 'install.html'), 'utf8');
const support = fs.readFileSync(path.join(root, 'support.html'), 'utf8');
const celeste = fs.readFileSync(path.join(root, 'celestera.html'), 'utf8');

assert.ok(/v-proof-60s-v0\.1/.test(proof), 'proof marker');
assert.ok(/proof-give-1|Give 1 LP/.test(proof), 'give chip');
assert.ok(/Not money|not money/.test(proof), 'not money');
assert.ok(/Never auto-give|never auto-give/.test(proof), 'never auto-give');
assert.ok(/PAIR_FINGERPRINT|pair fingerprint|Pair/.test(proof), 'pair pitch');
assert.ok(/LATTICE_IDENTITY|companion/i.test(proof), 'companion pitch');
assert.ok(/lp-give\.js/.test(proof), 'loads LpGive');
assert.ok(/#fl-lp-give/.test(proof), 'deep-link to garden give');

assert.ok(/PROOF_60S|60s Proof|60 seconds/i.test(spec));
assert.ok(/Never auto-give/i.test(spec));

assert.ok(/proof\.html/.test(install), 'install START HERE points at proof');
assert.ok(/proof\.html/.test(support), 'support footer points at proof');
assert.ok(/proof\.html/.test(celeste), 'celestera points at proof');

console.log('SMOKE_OK 60s proof v0.1');
console.log('three beats · not money · companion pitch · pointers');
