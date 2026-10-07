#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const repo = path.join(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(repo, f), 'utf8');
const pat = read('docs/patents.html');
const res = read('docs/research.html');
const M = 'v-patents-drive-links-v0';
const ids = [
  '1BOVg7BGiun90kvP5pVaIigWsHRkwk5cu',
  '1sB_QlYKY2TEaSrM9b6yofP2P6X70OcBm',
  '1yOwyvgCEGBLgEunvp583xOg3k0VaZ9tO',
  '1nhPlCNc0uoB48q0lWJgrBxCqM8Y-Dt9U',
  '1XYnChrFbt_lYMsrgn7WtojW1pdn3Sxf_'
];
for (const id of ids) {
  assert.ok(pat.includes('https://drive.google.com/file/d/' + id + '/view'), 'drive link ' + id);
}
assert.ok(pat.includes('drive/folders/1WbchQmFB58dsJaJvv-k2lWgxIZrCQl5y'), 'folder link');
assert.ok(pat.includes('https://www.dropbox.com/scl/fi/34vimxitksskzaaovzo61/Final_FRGPU.pdf'), 'frgpu link');
assert.ok(!/do_not_share/i.test(pat + res), 'do-not-share file never linked');
const markerLines = pat.split('\n').filter((l) => l.includes(M)).concat(res.split('\n').filter((l) => l.includes(M)));
assert.strictEqual(markerLines.length, 7, 'seven layered lines');
for (const l of markerLines) {
  assert.ok(!/\u2014|&mdash;/.test(l), 'no em dash in added line');
  assert.ok(!/innerHTML|<script/i.test(l), 'static link only');
}
// layer, never delete: original shelf text kept
assert.ok(pat.includes('This bay is empty on purpose.'), 'bay text kept');
assert.ok(pat.includes('Filing text is not in this repo.'), 'nexus text kept');
assert.ok(pat.includes('No USPTO serials live in this repository yet.'), 'no-serials line kept');
assert.ok(res.includes('Kirk places filings and PDFs when they are ready.'), 'research card text kept');
assert.ok(!/\b\d{2}\/\d{3},\d{3}\b/.test(markerLines.join('\n')), 'no serial numbers');
const app = read('docs/app.html');
const idx = read('index.html');
assert.strictEqual(app, idx, 'index matches docs/app.html');
console.log('SMOKE_OK patents drive links v0');
