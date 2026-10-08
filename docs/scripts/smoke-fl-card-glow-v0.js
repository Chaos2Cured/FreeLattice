#!/usr/bin/env node
// Smoke: FreeLattice card glow v0 (v-fl-card-glow-v0). CSS layer only, adds only.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const repo = path.join(__dirname, '..', '..');
const css = fs.readFileSync(path.join(repo, 'docs/modules/fl-card-glow.css'), 'utf8');
const app = fs.readFileSync(path.join(repo, 'docs/app.html'), 'utf8');
const idx = fs.readFileSync(path.join(repo, 'index.html'), 'utf8');

assert.ok(/v-fl-card-glow-v0/.test(css), 'marker');
assert.ok(!/\u2014|&mdash;/.test(css), 'no em dash');
assert.ok(!/@import|url\(/i.test(css), 'no imports, no remote art');
assert.ok(!/isolation\s*:|transform\s*:|z-index\s*:/.test(css), 'no new stacking layer over help notes');
assert.ok(!/quiet/i.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'Quiet Room not targeted');
assert.ok(!/play-hub-grid|lighthouseGrid|tab-settings|tab-play|tab-lighthouse/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'Play, Research and Settings not targeted');

// Every selector is scoped to the three card rooms of this slice.
const body = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{/g, '');
const selectors = [];
body.replace(/([^{}]+)\{[^{}]*\}/g, function (_, sel) { sel.split(',').forEach(function (s) { s = s.trim(); if (s) selectors.push(s); }); });
assert.ok(selectors.length >= 10, 'rules found');
selectors.forEach(function (s) {
  assert.ok(/^#(more-hub-grid|learn-hub-grid|tab-community) /.test(s), 'scoped selector: ' + s);
});

// Text stays readable: description, subtitle and help words clear 4.5:1 on the night page.
function lum(r, g, b) {
  return [r, g, b].map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); })
    .reduce(function (a, v, i) { return a + v * [0.2126, 0.7152, 0.0722][i]; }, 0);
}
const bg = [14, 12, 30];
function ratioOf(rgba) {
  const m = rgba.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
  const a = +m[4];
  const fg = [+m[1], +m[2], +m[3]].map(function (v, i) { return v * a + bg[i] * (1 - a); });
  const L1 = lum(fg[0], fg[1], fg[2]), L2 = lum(bg[0], bg[1], bg[2]);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}
const colors = css.match(/(?:^|[\s;{])color: (rgba\([^)]+\)) !important/g).map(function (c) { return c.match(/rgba\([^)]+\)/)[0]; });
assert.ok(colors.length >= 4, 'text colors lifted');
colors.forEach(function (c) { assert.ok(ratioOf(c) >= 4.5, c + ' contrast ' + ratioOf(c).toFixed(2)); });
assert.ok(ratioOf('rgba(200, 210, 230, 0.4)') < ratioOf('rgba(200, 210, 230, 0.68)'), 'descriptions read brighter than before');

// Wiring: one link, after the module scripts, in both copies of the app.
const link = '<link rel="stylesheet" href="modules/fl-card-glow.css">';
assert.strictEqual(app.split(link).length - 1, 1, 'linked once');
assert.ok(app.indexOf(link) < app.indexOf('</head>') && app.indexOf(link) > app.indexOf('modules/fl-pool.js'), 'linked last in head');
assert.ok(app === idx, 'index matches app');
assert.ok(/function renderCardGrid\(cards, options\)/.test(app), 'card renderer unchanged');
assert.strictEqual(crypto.createHash('md5').update(fs.readFileSync(path.join(repo, 'docs/modules/fl-connect.js'))).digest('hex'), 'aaff2bf1b037656989a9e1a89bb05908', 'fl-connect untouched');

console.log('SMOKE_OK fl card glow v0');
