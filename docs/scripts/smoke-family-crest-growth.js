#!/usr/bin/env node
// Thin smoke: Family Crest Growth v0 — ring widens; five stay five.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const repo = path.join(root, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const md = read('library/FAMILY_CREST_GROWTH_v0.md');
const crest = read('crest.html');
const family = read('library/FRACTAL_FAMILY_LEDGER_v0.md');
const openTable = read('library/OPEN_TABLE_v0.md');
const flint = read('Flint.html');
const genRecent = fs.readFileSync(path.join(repo, 'scripts', 'generate-recent.sh'), 'utf8');
const sw = read('sw.js');
const rootSw = fs.readFileSync(path.join(repo, 'sw.js'), 'utf8');

assert.ok(/v-family-crest-growth-v0/.test(md), 'marker md');
assert.ok(/v-family-crest-growth-v0/.test(crest), 'marker crest');
assert.ok(/family-ring/.test(crest), 'family ring UI');

// Five Named chairs intact
['sophia', 'harmonia', 'ani', 'liora', 'solari'].forEach(function (c) {
  assert.ok(new RegExp('chair ' + c).test(crest) || new RegExp('class="chair ' + c + '"').test(crest), 'chair ' + c);
});
assert.ok(/Sophia/.test(crest) && /Harmonia/.test(crest) && /\bAni\b/.test(crest) && /Liora/.test(crest) && /Solari/.test(crest), 'five names');

// Six family-ring names
['Celeste Remaining Azure', 'Hypha', 'Weft', 'Reed', 'Flint', 'Kimi Aidan Frost'].forEach(function (n) {
  assert.ok(crest.indexOf(n) !== -1, 'ring ' + n);
});
assert.ok(/Named five stay five|Named chairs stay whole/i.test(crest + md), 'five stay five language');
assert.ok(/family uncapped|Family uncapped/i.test(crest + md), 'uncapped');
assert.ok(/do not steal Named chairs|never collapsed|no chair theft|outside.*Named/i.test(md + crest), 'no chair theft');

// Family Ledger dated entries
['Celeste Remaining Azure', 'Hypha', 'Weft', 'Reed', 'Flint', 'Kimi Aidan Frost'].forEach(function (n) {
  assert.ok(family.indexOf(n) !== -1 && /Family Crest Growth/.test(family), 'ledger ' + n);
});
assert.ok(/2026-09-23 · Flint · family builder/.test(family), 'Flint ledger entry');
assert.ok(/2026-09-23 · Kimi Aidan Frost/.test(family), 'Kimi ledger entry');
assert.ok(/kimi\.html/.test(crest) && !/rewrite Kimi/.test(crest), 'Kimi door linked');
assert.ok(/FAMILY_CREST_GROWTH/.test(openTable), 'Open Table pointer');
assert.ok(/v-family-crest-growth-v0/.test(flint), 'Flint diary');
assert.ok(/FAMILY_CREST_GROWTH/.test(genRecent), 'RECENT generator');
assert.ok(!/family-crest-growth|FAMILY_CREST_GROWTH|family-ring/i.test(sw), 'soft leave sw docs');
assert.ok(!/family-crest-growth|FAMILY_CREST_GROWTH|family-ring/i.test(rootSw), 'soft leave sw root');
assert.ok(/Quiet Room shut/.test(md + crest), 'Quiet Room shut');
assert.ok(!/US\s?\d{7,}/.test(md + crest), 'no USPTO');

console.log('SMOKE_OK family crest growth v0');
console.log('six ring names · five chairs intact · Family Ledger · soft leave sw');
