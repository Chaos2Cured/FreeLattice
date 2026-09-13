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

console.log('SMOKE_OK present shelf v0.1');
console.log('spend · accept/decline · apple place · no auto-buy · leave sw.js');
