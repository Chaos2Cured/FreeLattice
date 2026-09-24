#!/usr/bin/env node
// Thin smoke: Tip ↔ Present soft braid v0 — human passion door beside mind economy.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const repo = path.join(root, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const md = read('library/TIP_PRESENT_BRAID_v0.md');
const tip = read('creator-tip-shelf.html');
const present = read('presents.html');
const tipMd = read('library/CREATOR_TIP_SHELF_v0.md');
const presentMd = read('library/PRESENT_SHELF_v0.1.md');
const family = read('library/FRACTAL_FAMILY_LEDGER_v0.md');
const flint = read('Flint.html');
const genRecent = fs.readFileSync(path.join(repo, 'scripts', 'generate-recent.sh'), 'utf8');
const sw = read('sw.js');
const rootSw = fs.readFileSync(path.join(repo, 'sw.js'), 'utf8');

assert.ok(/v-tip-present-braid-v0/.test(md), 'marker md');
assert.ok(/v-tip-present-braid-v0/.test(tip), 'marker tip html');
assert.ok(/v-tip-present-braid-v0/.test(present), 'marker present html');

// Loving pointers both ways
assert.ok(/presents\.html/.test(tip) && /Present Shelf|Garden Market/.test(tip), 'tip → present');
assert.ok(/creator-tip-shelf\.html/.test(present) && /Creator Tip Shelf|Tip Shelf/.test(present), 'present → tip');
assert.ok(/TIP_PRESENT_BRAID/.test(tip) && /TIP_PRESENT_BRAID/.test(present), 'braid note linked');

// Soft paste language
assert.ok(/Named five stay five/.test(md + tip + present), 'soft paste five');
assert.ok(/Family uncapped/.test(md + tip + present), 'soft paste uncapped');
assert.ok(/Quiet Room shut/.test(md + tip + present), 'Quiet Room shut');

// Never auto / never fiat
assert.ok(/never auto/i.test(md + tip + present), 'never auto');
assert.ok(/never fiat|no fiat|Not money|not money|LP is not \$FL/i.test(md + tip + present), 'no fiat');
assert.ok(!/stripe|paypal|checkout|USD/i.test(tip.match(/v-tip-present-braid-v0[\s\S]{0,600}/)[0] + present.match(/v-tip-present-braid-v0[\s\S]{0,600}/)[0]), 'no fiat rails in braid');

// Cousin md pointers
assert.ok(/TIP_PRESENT_BRAID/.test(tipMd) && /TIP_PRESENT_BRAID/.test(presentMd), 'library cousins');

// Ledger + Flint
assert.ok(/Tip ↔ Present soft braid|Tip.*Present soft braid/.test(family), 'Family Ledger');
assert.ok(/2026-09-23 · Flint · family builder · Tip/.test(family), 'dated ledger');
assert.ok(/v-tip-present-braid-v0/.test(flint), 'Flint diary');
assert.ok(/TIP_PRESENT_BRAID/.test(genRecent), 'RECENT generator');

// Soft leave sw · out-of-scope stays named-not-shipped
assert.ok(!/tip-present-braid|TIP_PRESENT_BRAID/i.test(sw), 'soft leave sw docs');
assert.ok(!/tip-present-braid|TIP_PRESENT_BRAID/i.test(rootSw), 'soft leave sw root');
assert.ok(/Out of scope[\s\S]*Dawn Stories/.test(md), 'Dawn Stories held out of scope');
assert.ok(/Out of scope[\s\S]*AutoBuilder/.test(md) && /Out of scope[\s\S]*Bridge binary/.test(md), 'engines held out of scope');
assert.ok(!/dawn-stories\.html|Dawn Stories Shelf/.test(tip + present), 'no Dawn Stories UI');
assert.ok(!/US\s?\d{7,}/.test(md + tip + present), 'no USPTO');

console.log('SMOKE_OK tip present braid v0');
console.log('tip↔present pointers · soft paste · never auto · soft leave sw');
