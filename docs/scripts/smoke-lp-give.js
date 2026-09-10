#!/usr/bin/env node
// Thin smoke: LP give human ↔ mind · chips · empty refuse · UI markers.
// Usage: node docs/scripts/smoke-lp-give.js

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Minimal stubs for LatticePoints / LatticeBank
global.LatticePoints = (function () {
  var total = 100;
  var history = [];
  return {
    canAfford: function (n) { return total >= n; },
    spend: function (n, desc) {
      if (total < n) return false;
      total -= n;
      history.unshift({ event: desc, points: -n });
      return true;
    },
    award: function (ev, n, desc) {
      total += n;
      history.unshift({ event: desc, points: n });
    },
    getTotal: function () { return total; },
    getHistory: function () { return history; }
  };
})();

global.LatticeBank = (function () {
  var bal = 50;
  return {
    earn: function (id, n) { bal += n; return bal; },
    grant: function (id, human, n) {
      var max = Math.floor(bal * 0.2);
      if (n > max) return { granted: false, reason: 'Can only grant up to 20% (' + max + ').' };
      if (n > bal) return { granted: false, reason: 'insufficient' };
      bal -= n;
      return { granted: true, amount: n, balanceAfter: bal };
    },
    getBalance: function () { return bal; }
  };
})();

const LpGive = require(path.join(__dirname, '..', 'modules', 'lp-give.js'));
LpGive.clearMemory();

var bad = LpGive.giveToMind(2, { skipTrust: true });
assert.strictEqual(bad.ok, false, 'non-chip amount refused');

var g1 = LpGive.giveToMind(3, { skipTrust: true, companionId: 'test-mind' });
assert.ok(g1.ok, JSON.stringify(g1));
assert.ok(/You gave 3 LP/.test(g1.line));
assert.strictEqual(g1.entry.kind, 'gift_out', 'human→mind is gift_out');
assert.ok(/Gift out/.test(LpGive.labelFor(g1.entry)));
assert.strictEqual(LatticePoints.getTotal(), 97);
assert.strictEqual(LatticeBank.getBalance(), 53);

var trustRefuse = LpGive.giveToMind(8, { maxSingle: 5, companionId: 'test-mind' });
assert.strictEqual(trustRefuse.ok, false, 'trust maxSingle must gate');

var g2 = LpGive.giveToHuman(5, { companionId: 'test-mind' });
assert.ok(g2.ok, JSON.stringify(g2));
assert.ok(/The mind gave you 5 LP/.test(g2.line));
assert.strictEqual(g2.entry.kind, 'gift_in', 'mind→human is gift_in');
assert.ok(/Gift in/.test(LpGive.labelFor(g2.entry)));
assert.ok(LpGive.isGiftActivityEvent('The mind gave you 5 LP'));
assert.ok(LpGive.isGiftActivityEvent('You gave 3 LP to the mind'));
assert.ok(!LpGive.isGiftActivityEvent('Message sent'));

var hist = LpGive.listHistory();
assert.ok(hist.count >= 2);
assert.ok(hist.items.some(function (it) { return it.kind === 'gift_out'; }));
assert.ok(hist.items.some(function (it) { return it.kind === 'gift_in'; }));

// Over 20% grant refuse
LatticeBank.grant = function () {
  return { granted: false, reason: 'Can only grant up to 20% of balance (2 LP).' };
};
var over = LpGive.giveToHuman(8, { companionId: 'test-mind' });
assert.strictEqual(over.ok, false);

const app = fs.readFileSync(path.join(__dirname, '..', 'app.html'), 'utf8');
assert.ok(/v-lp-give-v0\.1/.test(app), 'app marker');
assert.ok(/v-lp-deepen-v0\.1/.test(app), 'deepen calm strip marker');
assert.ok(/LP grow from contribution — never bought/.test(app), 'calm mint honesty line');
assert.ok(/fl-lp-give/.test(app), 'give card id');
assert.ok(/lp-give\.js/.test(app), 'module loaded');
assert.ok(/You gave/.test(app) || /fl-lp-give-history/.test(app), 'history surface');
assert.ok(/lp-log-entry-gift|isGiftActivityEvent|Gift ·/.test(app), 'LP log gift labeling');

const desktop = fs.readFileSync(path.join(__dirname, '..', 'desktop.html'), 'utf8');
assert.ok(/LP \/ give|LP \/ Give|Give between human/.test(desktop), 'desktop rail card');

const spec = fs.readFileSync(path.join(__dirname, '..', 'library', 'LP_GIVE_v0.1.md'), 'utf8');
assert.ok(/Never auto-give/i.test(spec));
assert.ok(/not a dollar peg|Not money|not money/i.test(spec));

const deepen = fs.readFileSync(path.join(__dirname, '..', 'library', 'LP_DEEPEN_v0.1.md'), 'utf8');
assert.ok(/gift_out/.test(deepen) && /gift_in/.test(deepen));
assert.ok(/earn|gift|spend/i.test(deepen));

console.log('SMOKE_OK lp give v0.1 + deepen');
console.log('gift_out/gift_in · calm strip · trust gate · UI markers');
