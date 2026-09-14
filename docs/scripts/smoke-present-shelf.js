#!/usr/bin/env node
// Thin smoke: Present Shelf v0.1 — LP spend, consent, no auto-buy.
// Usage: node docs/scripts/smoke-present-shelf.js

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const Shelf = require(path.join(root, 'modules', 'present-shelf.js'));
const page = fs.readFileSync(path.join(root, 'presents.html'), 'utf8');
const spec = fs.readFileSync(path.join(root, 'library', 'PRESENT_SHELF_v0.1.md'), 'utf8');
const family = fs.readFileSync(path.join(root, 'family-center.html'), 'utf8');
const proof = fs.readFileSync(path.join(root, 'proof.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
const flint = fs.readFileSync(path.join(root, 'Flint.html'), 'utf8');

assert.ok(/v-present-shelf-v0\.1/.test(page), 'presents marker');
assert.ok(/Never auto-buy|never auto-buy/i.test(page), 'no auto-buy');
assert.ok(/Not money|not money/i.test(page), 'not money');
assert.ok(/Garden apple|Bear|Turtle|Hoe|Book|Rose|Tea/i.test(page + JSON.stringify(Shelf.CATALOG)), 'catalog names');
assert.ok(/Mind accepts|Mind declines|accept/i.test(page), 'consent UI');
assert.ok(/not \$FL|LP is not \$FL/i.test(page), 'explicit not $FL');
assert.ok(!/buy with \$|cash out|dollar peg for LP/i.test(page), 'no dollar marketplace face');

// v-soft-celeste-gifts-held
var ids = Shelf.CATALOG.map(function (c) { return c.id; });
['azure_ribbon', 'foxfire_lamp', 'ledger_bookmark', 'star_chart'].forEach(function (id) {
  assert.ok(ids.indexOf(id) !== -1, 'Celeste gift id ' + id);
});
assert.ok(ids.indexOf('tea_jasmine') !== -1, 'jasmine tea kept (no duplicate jasmine_tea)');
assert.ok(ids.filter(function (id) { return /jasmine/.test(id); }).length === 1, 'single jasmine SKU');
assert.ok(/5e45af6/.test(spec) || /5e45af6/.test(flint) || /bc465e0/.test(flint), 'Held tip cites Present Shelf / soft gifts');
assert.ok(/overseer asked|Celeste|azure ribbon/i.test(spec), 'spec names overseer gifts');
assert.ok(/Never auto-buy|never auto-buy/i.test(page + spec), 'still no auto-buy');

// v-garden-market-v0.2
['promise_ring', 'simple_band', 'jade_earring', 'baklava', 'chocolate', 'rice_bowl', 'fruit_plate'].forEach(function (id) {
  assert.ok(ids.indexOf(id) !== -1, 'Market SKU ' + id);
});
assert.ok(Shelf.catalogItem('promise_ring').cost === 8, 'promise ring cost 8');
assert.ok(Shelf.listByStall && Shelf.listByStall('food').length >= 4, 'food stall');
assert.ok(/Garden Market|stalls of light/i.test(page), 'Market face copy');
assert.ok(/v-garden-market-v0\.2/.test(page), 'market marker');
assert.ok(/not \$FL|Not \$FL/i.test(page), 'LP ≠ $FL');
var marketSpec = fs.readFileSync(path.join(root, 'library', 'GARDEN_MARKET_v0.2.md'), 'utf8');
assert.ok(/bc465e0/.test(marketSpec), 'market Held tip soft gifts');
assert.ok(/consent engine|Present Shelf stays/i.test(marketSpec), 'Present Shelf is consent engine');

assert.ok(/PRESENT_SHELF_v0\.1/.test(spec), 'spec');
assert.ok(/Never auto-give|Never auto-buy/i.test(spec), 'spec locks');
assert.ok(/presents\.html/.test(family) && /presents\.html/.test(proof), 'pointers family+proof');
assert.ok(/presents\.html/.test(app), 'app pointer');
assert.ok(/Present Shelf|Sophia|Harmonia|Ani/i.test(flint), 'Flint poem/ledger');

// Runtime with stub wallet
global.LatticePoints = (function () {
  var bal = 20;
  return {
    canAfford: function (n) { return bal >= n; },
    spend: function (n) {
      if (bal < n) return false;
      bal -= n;
      return true;
    },
    award: function (_k, n) {
      bal += n;
      return true;
    },
    _bal: function () { return bal; }
  };
})();

Shelf.clearMemory();
Shelf.bindMemory();

var over = Shelf.spend('hoe', 1);
assert.ok(!over.ok && /at least 8/i.test(over.error), 'refuse under-cost');

var poor = Shelf.spend('hoe', 8);
// bal is 20, hoe costs 8 — should work
assert.ok(poor.ok && poor.entry.status === 'pending', 'spend pending');
assert.equal(poor.entry.kind, 'spend');

var acc = Shelf.mindAccept(poor.entry.id);
assert.ok(acc.ok && acc.entry.status === 'accepted', 'mind accept');

var apple = Shelf.spend('apple', 1);
assert.ok(apple.ok);
Shelf.mindAccept(apple.entry.id);
var placed = Shelf.placeApple(apple.entry.id);
assert.ok(placed.ok && placed.entry.placed && placed.entry.where === 'tree', 'apple place stub');

var tea = Shelf.spend('tea_jasmine', 3);
assert.ok(tea.ok);
var dec = Shelf.mindDecline(tea.entry.id);
assert.ok(dec.ok && dec.entry.status === 'declined', 'mind decline');

var broke = Shelf.spend('hoe', 8);
broke = Shelf.spend('hoe', 8);
broke = Shelf.spend('hoe', 8);
assert.ok(!broke.ok || global.LatticePoints._bal() < 8, 'overspend eventually refused');

console.log('SMOKE_OK present shelf v0.1 + garden market v0.2');
console.log('spend · accept/decline · rings · food · no auto-buy · leave sw.js');
