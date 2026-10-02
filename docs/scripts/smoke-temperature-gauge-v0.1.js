#!/usr/bin/env node
// Smoke: Temperature Gauge v0.1 (v-temperature-gauge-v0.1)
// Every line takes its color, the moving averages start at the left edge, your own
// buy and sell marks (display only), a wider look through the same feed, and the price
// chart no longer goes blank after a color change. No network. Leave sw.js alone.
// Usage: node docs/scripts/smoke-temperature-gauge-v0.1.js

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const gauge = fs.readFileSync(path.join(root, 'temperature-gauge.html'), 'utf8');
const worker = fs.readFileSync(path.join(root, '..', 'desktop', 'data-proxy-worker', 'worker.js'), 'utf8');
const notes = fs.readFileSync(path.join(root, 'library', 'TEMPERATURE_GAUGE_v0.1.md'), 'utf8');

assert.ok(/v-temperature-gauge-v0\.1/.test(gauge), 'gauge carries the marker');

// 1. Colors: every line reads tgLineColor (or getIndicatorColor) in price mode
[
  ["label: 'Price'", "tgLineColor('price'"],
  ["label: 'BB Upper'", "tgLineColor('bollinger'"],
  ["label: 'BB Lower'", "tgLineColor('bollinger'"],
  ["label: 'EMA ' + EP_RC[4]", "tgLineColor('ema200'"],
  ["label: 'Gravity'", "tgLineColor('gravity'"],
  ["label: 'Buy'", "tgLineColor('buy'"],
  ["label: 'Sell'", "tgLineColor('sell'"],
  ["label: 'Hub'", "tgLineColor('hub'"],
  ["label: 'Ring'", "tgLineColor('ring'"],
  ["label: 'Orbit'", "tgLineColor('orbit'"],
  ["label: 'Temperature', data: a.temps", "tgLineColor('temperature'"],
  ["label: '\\u0394T', data: dtData", "tgLineColor('dt'"],
  ["label: 'TP Spread'", "tgLineColor('ips'"],
  ["label: 'RSI Spread'", "tgLineColor('rsi'"]
].forEach(function (pair) {
  const i = gauge.indexOf('{ ' + pair[0]);
  assert.ok(i > 0, 'dataset present: ' + pair[0]);
  const line = gauge.slice(i, gauge.indexOf('\n', i));
  assert.ok(line.indexOf(pair[1]) > 0, pair[0] + ' reads ' + pair[1]);
});
['ema8', 'ema12', 'ema24', 'ema50'].forEach(function (id) {
  assert.ok(new RegExp("data: " + id + ", borderColor: getIndicatorColor\\('" + id + "'").test(gauge), id + ' reads its color');
});
assert.ok(/fill: '-1', backgroundColor: tgLineColor\('bollinger'/.test(gauge), 'band fill sits between the two bands');
assert.ok(/value="#e8b019" onchange="setIndicatorColor\('ips'/.test(gauge), 'IPS swatch shows the color the line is drawn in');

// 2. The price chart stays visible after a direct renderChart (color change, Stack, Log)
const rc = gauge.slice(gauge.indexOf('function renderChart(candles, a) {'), gauge.indexOf('// RSI sub-chart'));
assert.ok(/document\.getElementById\('mainChart'\)\.style\.display = 'block';\s*$/.test(rc.trimEnd()), 'renderChart shows the price canvas again');

// 3. Moving averages
assert.ok(/var show200 = ema200\[closes\.length - 1\] != null;/.test(gauge), 'fifth line shows on every timeframe with enough bars');
assert.ok(/cubicInterpolationMode: 'monotone'/.test(gauge), 'monotone curves (no overshoot)');
assert.ok(/async function fetchYahooData\(symbol, interval, rangeOverride\)/.test(gauge), 'optional range for warm history');
assert.ok(/fetchYahooData\(symbol, '5m', '5d'\)/.test(gauge), '5m short-day fallback');
assert.ok(/ema200:\s+\{ label: 'EMA',\s+defaultColor: '#c4b5fd'/.test(gauge), 'compose mode knows the fifth EMA');

// 4. Run the helpers for real
function extractFn(name) {
  const start = gauge.indexOf('function ' + name + '(');
  assert.ok(start >= 0, 'function ' + name);
  let depth = 0, i = gauge.indexOf('{', start);
  for (; i < gauge.length; i++) {
    if (gauge[i] === '{') depth++;
    else if (gauge[i] === '}') { depth--; if (depth === 0) break; }
  }
  return gauge.slice(start, i + 1);
}
const endStart = gauge.indexOf('(function tgTemperatureGaugeV01() {');
const endStop = gauge.indexOf('})();', endStart) + 5;
const endScript = gauge.slice(endStart, endStop);
assert.ok(endStart > 0 && endStop > endStart, 'v0.1 script block');

const store = {};
const ctx = {
  console: console, setTimeout: function (f) { f(); }, Promise: Promise, JSON: JSON, Math: Math, isFinite: isFinite, parseFloat: parseFloat, Date: Date,
  localStorage: { getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); }, removeItem: function (k) { delete store[k]; } },
  document: { readyState: 'complete', getElementById: function () { return null; }, querySelector: function () { return null; }, addEventListener: function () {}, activeElement: null },
  rendered: 0
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext([extractFn('ema'), extractFn('tgAlphaOf'), extractFn('tgHexA'), extractFn('tgLineColor'),
  'var currentInterval = "1d"; var lastSymbol = "SPY"; var lastCandles = null; var lastAnalysis = null;',
  'function getEmaPeriods() { return [3, 5, 8, 13, 21]; }',
  'function renderChart() { rendered++; }',
  'var __long = null; function fetchYahooData(s, iv, r) { return Promise.resolve(__long); }',
  endScript].join('\n'), ctx);

assert.strictEqual(vm.runInContext("tgLineColor('ema200', 'rgba(196,181,253,0.7)')", ctx), 'rgba(196,181,253,0.7)', 'no saved color: old look kept');
store.fl_tg_indicatorColors = JSON.stringify({ ema200: '#00ff00', price: '#112233' });
assert.strictEqual(vm.runInContext("tgLineColor('ema200', 'rgba(196,181,253,0.7)')", ctx), 'rgba(0,255,0,0.7)', 'saved color keeps the line alpha');
assert.strictEqual(vm.runInContext("tgLineColor('price', '#e8e4dc')", ctx), '#112233', 'saved color on a solid line');
assert.strictEqual(vm.runInContext("tgLineColor('buy', '#34d399', 0.75)", ctx), 'rgba(52,211,153,0.75)', 'alpha override on a default');

// warm history: 60 long bars, the chart shows the last 30
vm.runInContext([
  'var all = []; for (var i = 0; i < 60; i++) all.push({ t: 1000 + i, c: 100 + Math.sin(i / 4) * 5 + i * 0.1 });',
  '__long = all; lastCandles = all.slice(30).concat([{ t: 5000, c: 110 }]); lastAnalysis = {};',
  'tgWarmFetch("SPY", "1d", lastCandles);'
].join('\n'), ctx);
return Promise.resolve().then(function () { return new Promise(function (r) { setImmediate(r); }); }).then(function () {
  const out = vm.runInContext('tgWarmEmas(lastCandles, [3, 5, 8, 13, 21])', ctx);
  assert.ok(Array.isArray(out) && out.length === 5, 'five warm lines');
  out.forEach(function (arr, k) {
    assert.strictEqual(arr.length, 31, 'aligned to the shown bars');
    assert.ok(arr.every(function (v) { return v != null && isFinite(v); }), 'line ' + k + ' starts at the left edge');
  });
  const full = vm.runInContext('ema(all.map(function (c) { return c.c; }), 21)', ctx);
  assert.ok(Math.abs(out[4][0] - full[30]) < 1e-9, 'same values as the EMA over the longer history');
  const k = 2 / 22;
  assert.ok(Math.abs(out[4][30] - (110 * k + out[4][29] * (1 - k))) < 1e-9, 'a live bar the long fetch lacks carries the EMA forward');
  assert.ok(ctx.rendered >= 1, 'warm lines redraw the chart');
  ctx.lastSymbol = 'QQQ';
  vm.runInContext('lastSymbol = "QQQ"', ctx);
  assert.strictEqual(vm.runInContext('tgWarmEmas(lastCandles, [3, 5, 8, 13, 21])', ctx), null, 'warm lines never cross symbols');
  vm.runInContext('lastSymbol = "SPY"', ctx);

  // 5. Your marks: display only, kept on this device
  store.fl_tg_triggers_v0 = JSON.stringify({ SPY: { buy: 101.5, sell: 120 } });
  const ds = vm.runInContext('tgTriggerDatasets(4)', ctx);
  assert.strictEqual(ds.length, 2, 'two marks drawn');
  assert.strictEqual(ds[0].label, 'Your buy mark'); assert.strictEqual(ds[1].label, 'Your sell mark');
  assert.deepStrictEqual(Array.from(ds[0].data), [101.5, 101.5, 101.5, 101.5], 'flat line at your price');
  assert.ok(/never place an order/.test(gauge) && /Marks are reminders on the glass\. You decide\./.test(gauge), 'marks say what they are');
  assert.ok(!/fetch\(/.test(endScript.replace(/fetchYahooData\(/g, '')), 'the v0.1 block sends nothing anywhere');

  // 6. A wider look: real symbols the feed serves today, honest words
  ['HYG', 'LQD', 'XLP', 'XLY', 'GLD', 'DX-Y.NYB', 'VIXY'].forEach(function (s) {
    assert.ok(endScript.indexOf("sym: '" + s + "'") > 0, 'wider look offers ' + s);
  });
  assert.ok(/Not a stress index, and not advice\./.test(gauge), 'not a stress index, not advice');
  assert.ok(/Math\.random/.test(endScript) === false, 'no invented data');

  // 7. Worker reads ^ symbols after a redeploy
  assert.ok(/decodeURIComponent\(url\.pathname\)/.test(worker) && /v-temperature-gauge-v0\.1/.test(worker), 'worker decodes the path');

  // 8. Locks inside the new code
  const added = endScript + '\n' + gauge.split('\n').filter(function (l) { return /v-temperature-gauge-v0\.1/.test(l); }).join('\n');
  assert.ok(!/confirm\(/.test(added), 'no confirm()');
  assert.ok(!/innerHTML/.test(endScript), 'textContent only in the v0.1 block');
  assert.ok(!/\u2014/.test(added), 'no em dash in the v0.1 lines');
  assert.ok(/v-temperature-gauge-v0\.1/.test(notes), 'notes carry the marker');

  console.log('SMOKE_OK temperature gauge v0.1');
}).catch(function (e) { console.error(e); process.exit(1); });
