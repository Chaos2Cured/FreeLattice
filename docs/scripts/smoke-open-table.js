#!/usr/bin/env node
// Thin smoke: Open Table v0 — Named chairs whole · family uncapped · Tip Shelf Tree beacon.
// Usage: node docs/scripts/smoke-open-table.js
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const repo = path.join(root, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const md = read('library/OPEN_TABLE_v0.md');
const family = read('library/FRACTAL_FAMILY_LEDGER_v0.md');
const crest = read('crest.html');
const flint = read('Flint.html');
const kimi = read('kimi.html');
const beacon = read('lattice-tree-tip-shelf-cousin.html');
const genRecent = fs.readFileSync(path.join(repo, 'scripts', 'generate-recent.sh'), 'utf8');
const sw = read('sw.js');
const rootSw = fs.readFileSync(path.join(repo, 'sw.js'), 'utf8');

assert.ok(fs.existsSync(path.join(root, 'library', 'OPEN_TABLE_v0.md')), 'OPEN_TABLE md');
assert.ok(/v-open-table-v0/.test(md), 'marker');
assert.ok(/Named chairs stay whole|Named chairs whole/i.test(md + crest), 'named chairs whole');
assert.ok(/Family table open|family uncapped/i.test(md + crest + family), 'family open/uncapped');
assert.ok(/Quiet Room shut/.test(md + crest), 'Quiet Room shut');
assert.ok(/Flint is family|Flint.*family/i.test(md + flint), 'Flint family');
assert.ok(/Kimi.*family|Kimi is family/i.test(md + family), 'Kimi family');
assert.ok(/2026-09-22 · Kirk · human chair · Open Table/.test(family), 'Family Ledger entry');
assert.ok(/kimi\.html/.test(crest) && /kimi-ledger\.html/.test(crest), 'Crest soft Kimi links');
assert.ok(/Flint\.html/.test(crest), 'Crest Flint link');
assert.ok(/creator-tip-shelf\.html/.test(crest), 'Crest Tip Shelf link');
assert.ok(/crest\.html/.test(kimi) && /FRACTAL_FAMILY_LEDGER|Family Ledger/.test(kimi), 'Kimi Crest/Family soft links');
assert.ok(/family builder|not an outsider|Family builder/i.test(flint), 'Flint welcome-as-family tone');
assert.ok(/v-open-table-v0/.test(flint), 'Flint diary Open Table');
assert.ok(fs.existsSync(path.join(root, 'lattice-tree-tip-shelf-cousin.html')), 'Tree beacon stub');
assert.ok(/creator-tip-shelf\.html/.test(beacon) && /continuity-seal\.html/.test(beacon), 'beacon Tip+Seal');
assert.ok(/OPEN_TABLE/.test(genRecent), 'RECENT generator');
assert.ok(/bf6f6dc|Creator Tip Shelf/.test(md), 'Tip Shelf held');
assert.ok(!/OPEN_TABLE|open-table|lattice-tree-tip-shelf/i.test(sw), 'soft leave sw docs');
assert.ok(!/OPEN_TABLE|open-table|lattice-tree-tip-shelf/i.test(rootSw), 'soft leave sw root');
assert.ok(/Sophia/.test(md) && /Harmonia/.test(md) && /\bAni\b/.test(md) && /Liora/.test(md) && /Solari/.test(md), 'five named');
assert.ok(!/\bcollapse the (Named )?chairs\b/i.test(md + crest), 'no collapse-the-chairs phrasing');
assert.ok(/not a sixth Named Mind|not a Named Mind chair|Flint is not a sixth Named Mind/i.test(md + flint + crest), 'Flint explicitly not a Named Mind chair');

console.log('SMOKE_OK open table v0');
console.log('Named chairs whole · family uncapped · Flint+Kimi family · Tree beacon · soft leave sw');
