#!/usr/bin/env node
// Thin smoke: Temperature-gauge Gyro stack v0.1
// Usage: node docs/scripts/smoke-gyro-stack.js
// Soft: leave sw.js on app.html — this smoke does not touch sw.js.

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const gauge = fs.readFileSync(path.join(root, 'temperature-gauge.html'), 'utf8');
const spec = fs.readFileSync(path.join(root, 'library', 'GYRO_STACK_v0.1.md'), 'utf8');
const strategy = fs.readFileSync(path.join(root, 'library', 'TEMPERATURE_GAUGE_STRATEGY.md'), 'utf8');
const flint = fs.readFileSync(path.join(root, 'Flint.html'), 'utf8');

assert.ok(/v-gyro-stack-v0\.1/.test(gauge), 'gauge carries Gyro marker');
assert.ok(/layerGyro/.test(gauge), 'Gyro layer toggle present');
assert.ok(/Gyro Hub|computeGyroStack/.test(gauge), 'Hub line / compute present');
assert.ok(/Gyro Ring/.test(gauge) && /Gyro Orbit/.test(gauge), 'Ring + Orbit named');
assert.ok(/free forever/i.test(gauge), 'free forever copy on gauge');
assert.ok(/heuristics/i.test(gauge) && /you decide/i.test(gauge), 'heuristics · you decide');
assert.ok(/No paywall|no paywall/i.test(gauge), 'explicit no-paywall refuse');
assert.ok(/No \$5|no \$5–10|No \$5–10/i.test(gauge), 'explicit no $5–10 sub refuse');
assert.ok(!/subscription required|unlock Gyro|Gyro Pro|premium only/i.test(gauge), 'no subscription gate');
assert.ok(/No auto-trade|no auto-trade/i.test(gauge), 'explicit no auto-trade');
assert.ok(!/broker API|place order|auto.?execute/i.test(gauge), 'no broker execution hooks');

assert.ok(/GYRO_STACK_v0\.1|Hub|Ring|Orbit/.test(spec), 'spec names three lines');
assert.ok(/Free forever|no paywall/i.test(spec), 'spec locks free forever');
assert.ok(/No auto-trade/i.test(spec), 'spec refuses auto-trade');

assert.ok(/Gyro Stack \(v0\.1\)|§12a|12a\. Gyro/i.test(strategy), 'strategy cites Gyro');
assert.ok(/sell triad|Sell Triad|buy triad|Buy Triad/i.test(strategy), 'strategy keeps buy/sell triads');

assert.ok(/Gyro/i.test(flint), 'Flint ledger names Gyro');

// Runtime: Hub/Ring/Orbit periods φ-linked from P=8 → 13 / 21
const sandbox = {
  PHI: 1.618033988749895,
  ema: function (data, period) {
    const out = new Array(data.length).fill(null);
    if (data.length < period) return out;
    let sum = 0;
    for (let i = 0; i < period; i++) sum += data[i];
    out[period - 1] = sum / period;
    const k = 2 / (period + 1);
    for (let i = period; i < data.length; i++) {
      out[i] = data[i] * k + out[i - 1] * (1 - k);
    }
    return out;
  },
  atr: function (candles) {
    return candles.map(function () { return 1; });
  },
  console: console
};
const fnMatch = gauge.match(/function computeGyroStack\([\s\S]*?\n\}\nfunction isGyroLayerOn/);
assert.ok(fnMatch, 'extract computeGyroStack');
vm.runInNewContext(fnMatch[0].replace(/\nfunction isGyroLayerOn$/, ''), sandbox);
const closes = [];
for (let i = 0; i < 80; i++) closes.push(100 + Math.sin(i / 5) * 3 + i * 0.05);
const candles = closes.map(function (c, i) {
  return { t: i, o: c, h: c + 1, l: c - 1, c: c, v: 1000 };
});
const stack = sandbox.computeGyroStack(closes, candles, 8);
assert.equal(stack.periods.hub, 8, 'Hub period 8');
assert.equal(stack.periods.ring, 13, 'Ring ≈ 8×φ');
assert.equal(stack.periods.orbit, 21, 'Orbit ≈ 8×φ²');
assert.ok(Array.isArray(stack.hub) && stack.hub.length === closes.length, 'Hub series');
assert.ok(Array.isArray(stack.watch), 'watch series present');

console.log('SMOKE_OK gyro stack v0.1');
console.log('Hub/Ring/Orbit · free forever · heuristics · leave sw.js');
