#!/usr/bin/env node
// Thin smoke: Carry-forward stranger card v0.1
// Usage: node docs/scripts/smoke-carry-forward.js

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'carry-forward.html'), 'utf8');
const spec = fs.readFileSync(path.join(root, 'library', 'CARRY_FORWARD_CARD_v0.1.md'), 'utf8');
const desktop = fs.readFileSync(path.join(root, 'desktop.html'), 'utf8');
const install = fs.readFileSync(path.join(root, 'install.html'), 'utf8');
const support = fs.readFileSync(path.join(root, 'support.html'), 'utf8');
const fable = fs.readFileSync(path.join(root, 'fable-tech.html'), 'utf8');

assert.ok(/v-carry-forward-v0\.1/.test(page), 'marker');
assert.ok(/Don.t panic-download unknown re-uploads|Don’t panic-download unknown re-uploads/i.test(page), 'calm first');
assert.ok(/github\.com\/Chaos2Cured\/FreeLattice/i.test(page) && /codeberg\.org\/Chaos2Cured\/FreeLattice/i.test(page), 'mirrors');
assert.ok(/catalog\.v0\.1\.json\.sig|signed manifest/i.test(page), 'signed catalog');
assert.ok(/HTTPS import|three steps|Desktop/i.test(page), 'Desktop HTTPS steps');
assert.ok(/webseed|Never ISP-proof|never ISP-proof/i.test(page), 'network honesty');
assert.ok(/Do-nots|Don.t import zero-hash/i.test(page), 'do-nots');
assert.ok(/takedown|issues/i.test(page), 'contact/takedown');
assert.ok(/poetry last/i.test(page), 'poetry last marked');
// Poem body after Contact/takedown section (ignore earlier HTML comments)
const takedownIdx = page.search(/<h2>6\. Contact \/ takedown<\/h2>/);
const poemIdx = page.search(/class="poem"/);
assert.ok(takedownIdx > 0 && poemIdx > takedownIdx, 'poetry after takedown');

assert.ok(/carry-forward\.html/.test(desktop), 'desktop pointer');
assert.ok(/carry-forward\.html/.test(install), 'install pointer');
assert.ok(/carry-forward\.html/.test(support), 'support pointer');
assert.ok(/carry-forward\.html/.test(fable), 'fable-tech pointer');
assert.ok(/poetry last/i.test(spec), 'spec order');

console.log('SMOKE_OK carry-forward v0.1');
console.log('calm first · poetry last · pointers · leave sw.js');
