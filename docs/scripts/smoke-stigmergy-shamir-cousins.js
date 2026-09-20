#!/usr/bin/env node
// Thin smoke: Stigmergy + Shamir cousins on Pattern Spine — name only, no SSS crypto.
// Usage: node docs/scripts/smoke-stigmergy-shamir-cousins.js
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

const md = read('library/STIGMERGY_SHAMIR_COUSINS_v0.md');
const page = read('stigmergy-cousins.html');
const family = read('library/FRACTAL_FAMILY_LEDGER_v0.md');
const spine = read('library/PATTERN_SPINE_v0.md');
const flint = read('Flint.html');
const swarm = read('library/SWARM_BRIDGE_v0.1.md');
const genRecent = fs.readFileSync(path.join(repo, 'scripts', 'generate-recent.sh'), 'utf8');
const sw = read('sw.js');
const rootSw = fs.readFileSync(path.join(repo, 'sw.js'), 'utf8');

assert.ok(fs.existsSync(path.join(root, 'library', 'STIGMERGY_SHAMIR_COUSINS_v0.md')), 'md exists');
assert.ok(/v-stigmergy-shamir-cousins-v0/.test(md), 'marker in md');
assert.ok(fs.existsSync(path.join(root, 'stigmergy-cousins.html')), 'html exists');
assert.ok(/v-stigmergy-shamir-cousins-v0/.test(page), 'marker in html');
assert.ok(/stigmergy/i.test(md + page) && /Shamir|K-of-N|K−N|K-of-N/i.test(md + page), 'stigmergy + Shamir named');
assert.ok(/Grassé|Grasse|Pierre/.test(md), 'Grassé cited');
assert.ok(/do NOT implement|NAME ONLY|name only|No crypto|no SSS|Do \*\*not\*\* implement/i.test(md + page), 'no implement SSS');
assert.ok(/PATTERN_SPINE|Pattern Spine|79724e9/.test(md), 'Pattern Spine parent');
assert.ok(/SWARM_BRIDGE|hash before trust/i.test(md + swarm), 'Swarm Bridge cousin');
assert.ok(/Stigmergy cousin|STIGMERGY_SHAMIR/.test(swarm), 'swarm one-line pointer');
assert.ok(/2026-09-20 · Kirk Patrick Miller · human chair · Stigmergy \+ Shamir named/.test(family), 'Family Ledger dated entry');
assert.ok(/STIGMERGY_SHAMIR|stigmergy-cousins/.test(spine), 'spine cousin link');
assert.ok(/stigmergy|Shamir/i.test(flint), 'Flint diary');
assert.ok(/STIGMERGY_SHAMIR|stigmergy-cousins/.test(genRecent), 'RECENT generator');
assert.ok(!/stigmergy-cousins|STIGMERGY_SHAMIR|shamir/i.test(sw), 'soft leave sw (docs)');
assert.ok(!/stigmergy-cousins|STIGMERGY_SHAMIR|shamir/i.test(rootSw), 'soft leave sw (root)');
assert.ok(/for-ai\.html/.test(sw) && /for-ai\.html/.test(rootSw), 'sw still caches for-ai');
assert.ok(!/US\s?\d{7,}/.test(md + page), 'no fabricated USPTO');
assert.ok(!/function\s+shamir|sss\.split|require\(['\"]shamir/i.test(md + page), 'no SSS code');
assert.ok(/Secret Sharing|K-of-N/.test(md), 'SSS named in prose');

console.log('SMOKE_OK stigmergy shamir cousins v0');
console.log('cousins named · Pattern Spine parent · Family Ledger · soft leave sw · no SSS');
