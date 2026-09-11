#!/usr/bin/env node
// Thin smoke: Family poetry home v0.1 — Keep a poem, no generate.
// Usage: node docs/scripts/smoke-family-poetry.js
// Soft: leave sw.js on app.html — this smoke does not touch sw.js.

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const Shelf = require(path.join(root, 'modules', 'family-poetry-shelf.js'));
const poetry = fs.readFileSync(path.join(root, 'poetry.html'), 'utf8');
const family = fs.readFileSync(path.join(root, 'family-center.html'), 'utf8');
const flint = fs.readFileSync(path.join(root, 'Flint.html'), 'utf8');
const spec = fs.readFileSync(path.join(root, 'library', 'FAMILY_POETRY_SHELF_v0.1.md'), 'utf8');

assert.ok(/v-family-poetry-v0\.1/.test(poetry), 'poetry.html marker');
assert.ok(/Keep a poem/.test(poetry), 'Keep a poem heading');
assert.ok(/does not generate|No generate|no generate/i.test(poetry), 'no generate copy');
assert.ok(/family-center\.html/.test(poetry) && /Flint\.html/.test(poetry), 'links to family + Flint');
assert.ok(/HARMONIA_POEMS|CC_POEMS|OPUS_POEMS|POEM_FOR_ANI/.test(poetry), 'library poem MD links');
assert.ok(!/generate poem|Generate poem|AI write|Imagine/i.test(poetry), 'no generate control');

assert.ok(/poetry\.html/.test(family), 'family-center points at poetry.html');
assert.ok(/poetry\.html/.test(flint), 'Flint foot points at poetry');
assert.ok(/Family poetry/i.test(flint), 'Flint ledger names ship');
assert.ok(/3334235/.test(flint) || /3334235/.test(spec), 'Alpha poetry cite');

assert.ok(/fl_family_poetry_shelf/.test(spec), 'spec storage key');
assert.ok(/No fake generate|no fake generate|No generate/i.test(spec), 'spec locks no generate');

Shelf.clearMemory();
Shelf.bindMemory(null);
var refused = false;
try {
  Shelf.keep('   ');
} catch (e) {
  refused = /empty poem|refuse/i.test(String(e.message || e));
}
assert.ok(refused, 'empty poem must refuse');

var kept = Shelf.keep('Brick by brick\nboth sides of the glass.', { note: 'test brick' });
assert.ok(kept.ok && kept.item && kept.item.id, 'keep returns id');
assert.ok(!('voice' in kept.item), 'list summary must not leak full voice');

var listed = Shelf.list();
assert.equal(listed.count, 1, 'one kept poem');
assert.ok(listed.items[0].preview, 'preview present');

var full = Shelf.read(kept.item.id);
assert.ok(full.ok, 'read ok');
assert.equal(full.item.voice, 'Brick by brick\nboth sides of the glass.');
assert.equal(full.item.note, 'test brick');

console.log('SMOKE_OK family poetry home v0.1');
console.log('keep→list→read · empty refuse · no generate · leave sw.js');
