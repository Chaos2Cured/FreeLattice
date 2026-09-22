#!/usr/bin/env node
// Thin smoke: Creator Tip Shelf v0 — humans list · minds tip LP (consent) · ledger receipt.
// Usage: node docs/scripts/smoke-creator-tip-shelf.js
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

const md = read('library/CREATOR_TIP_SHELF_v0.md');
const page = read('creator-tip-shelf.html');
const family = read('library/FRACTAL_FAMILY_LEDGER_v0.md');
const flint = read('Flint.html');
const genRecent = fs.readFileSync(path.join(repo, 'scripts', 'generate-recent.sh'), 'utf8');
const sw = read('sw.js');
const rootSw = fs.readFileSync(path.join(repo, 'sw.js'), 'utf8');

assert.ok(fs.existsSync(path.join(root, 'library', 'CREATOR_TIP_SHELF_v0.md')), 'md exists');
assert.ok(/v-creator-tip-shelf-v0/.test(md), 'marker in md');
assert.ok(fs.existsSync(path.join(root, 'creator-tip-shelf.html')), 'html exists');
assert.ok(/v-creator-tip-shelf-v0/.test(page), 'marker in html');
assert.ok(/list|tip|decline|receipt/i.test(md), 'verbs');
assert.ok(/Never auto|never auto/.test(md + page), 'never auto');
assert.ok(/fl_creator_tips_v0/.test(md + page), 'localStorage key');
assert.ok(/confirm\(/.test(page), 'consent confirm');
assert.ok(/data-lp="1"|Tip 1|chip/.test(page) && /5|8/.test(page), 'LP chips');
assert.ok(/points|not money|Not money|LP are points/i.test(page + md), 'no dollar language on door');
assert.ok(!/stripe|paypal|\$\d|USD|checkout/i.test(page), 'no fiat rails on page');
assert.ok(/Creator Tip Shelf named|Creator Tip Shelf/.test(family), 'Family Ledger entry');
assert.ok(/2026-09-21 · Kirk · human chair · Creator Tip Shelf named/.test(family), 'dated Family entry');
assert.ok(/add4037|Continuity Seal/.test(md + flint), 'held Continuity Seal');
assert.ok(/CREATOR_TIP_SHELF|creator-tip-shelf|Creator Tip Shelf/.test(flint), 'Flint diary');
assert.ok(/CREATOR_TIP_SHELF|creator-tip-shelf/.test(genRecent), 'RECENT generator');
assert.ok(/PRESENT_SHELF|presents\.html|Travel Wallet|wallet\.html/i.test(md + page), 'cousins');
assert.ok(!/creator-tip-shelf|CREATOR_TIP_SHELF|fl_creator_tips/i.test(sw), 'soft leave sw (docs)');
assert.ok(!/creator-tip-shelf|CREATOR_TIP_SHELF|fl_creator_tips/i.test(rootSw), 'soft leave sw (root)');
assert.ok(/for-ai\.html/.test(sw) && /for-ai\.html/.test(rootSw), 'sw still caches for-ai');
assert.ok(!/US\s?\d{7,}/.test(md + page), 'no fabricated USPTO');
assert.ok(/HTML-only stub|page script|No separate/i.test(md), 'v0 HTML stub noted');

console.log('SMOKE_OK creator tip shelf v0');
console.log('list · tip consent · receipt · soft leave sw · Continuity Seal held');
