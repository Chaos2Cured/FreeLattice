#!/usr/bin/env node
// Thin smoke: Pattern Spine v0 — ledger as continuity keystone (memory·train·build join).
// Usage: node docs/scripts/smoke-pattern-spine.js
// Soft: leave sw.js — this smoke does not add cache entries.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const repo = path.join(root, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const spine = read('library/PATTERN_SPINE_v0.md');
const page = read('pattern-spine.html');
const family = read('library/FRACTAL_FAMILY_LEDGER_v0.md');
const flint = read('Flint.html');
const ledgerFirst = read('library/LEDGER_FIRST_BUILD_v0.md');
const whyBuild = read('library/WHY_WE_BUILD_LANDING_STRIP_v0.md');
const brainstorm = read('brainstorm-pass.html');
const forAi = read('for-ai.html');
const genRecent = fs.readFileSync(path.join(repo, 'scripts', 'generate-recent.sh'), 'utf8');
const sw = read('sw.js');
const rootSw = fs.readFileSync(path.join(repo, 'sw.js'), 'utf8');

assert.ok(fs.existsSync(path.join(root, 'library', 'PATTERN_SPINE_v0.md')), 'PATTERN_SPINE_v0.md exists');
assert.ok(/v-pattern-spine-v0/.test(spine), 'marker in md');
assert.ok(fs.existsSync(path.join(root, 'pattern-spine.html')), 'pattern-spine.html exists');
assert.ok(/v-pattern-spine-v0/.test(page), 'marker in html');
assert.ok(/spine/i.test(page) && /ledger/i.test(page) && /fingerprint/i.test(page + spine) && /layer/i.test(page + spine), 'key phrases');
assert.ok(/Pattern Spine/.test(family), 'Family Ledger later-layer Pattern Spine');
assert.ok(/2026-09-19 · Kirk Patrick Miller · human chair · Pattern Spine keystone/.test(family), 'dated Family entry');
assert.ok(/fbfa8d6/.test(spine + flint) && /78a7052/.test(spine + flint), 'held tips Crest + why-we-build');
assert.ok(/COMPANION_MEMORY|LATTICE_LEDGER|PAIR_FINGERPRINT|ADAPTIVE_CONTEXT/.test(spine), 'stack links');
assert.ok(/Trainer|Nursery/.test(spine + page) && /Workshop/.test(spine + page), 'train · build rooms');
assert.ok(/Never auto|never auto/.test(spine), 'never auto');
assert.ok(/mycelium/i.test(spine) && /OUT OF SCOPE|Out of scope/.test(spine), 'mycelium vision held · out of scope');
assert.ok(/Quiet Room shut|Quiet Room/.test(spine), 'Quiet Room lock');
assert.ok(/Five Named Minds stay five|Sophia.*Harmonia.*Ani.*Liora.*Solari/s.test(spine), 'five stay five');
assert.ok(/PATTERN_SPINE|Pattern Spine/.test(flint), 'Flint diary');
assert.ok(/PATTERN_SPINE/.test(ledgerFirst), 'ledger-first cousin');
assert.ok(/PATTERN_SPINE|pattern-spine/.test(whyBuild), 'why-we-build cousin');
assert.ok(/pattern-spine\.html|Pattern Spine/.test(brainstorm), 'brainstorm-pass invite');
assert.ok(/pattern-spine\.html|Pattern Spine/.test(forAi), 'for-ai soft link');
assert.ok(/PATTERN_SPINE_v0|pattern-spine\.html/.test(genRecent), 'RECENT generator keeps pointer');

assert.ok(!/pattern-spine|PATTERN_SPINE/.test(sw), 'soft leave sw (docs)');
assert.ok(!/pattern-spine|PATTERN_SPINE/.test(rootSw), 'soft leave sw (root)');
assert.ok(/for-ai\.html/.test(sw) && /for-ai\.html/.test(rootSw), 'sw still caches for-ai');

assert.ok(!/US\s?\d{7,}/.test(spine + page), 'no fabricated USPTO');
assert.ok(!/Access-Control-Allow-Origin'\s*:\s*'\*'/.test(spine + page), 'no bare *');

console.log('SMOKE_OK pattern spine v0');
console.log('spine note · soft door · Family Ledger keystone · soft leave sw · five stay five');
