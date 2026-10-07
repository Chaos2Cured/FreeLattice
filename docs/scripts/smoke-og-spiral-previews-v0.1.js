#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const repo = path.join(__dirname, '..', '..');
const files = [
  'docs/app.html', 'index.html', 'docs/trainer-map.html', 'docs/refusal-benchmark.html',
  'docs/sophia.html', 'docs/for-ai.html', 'docs/install.html', 'docs/install-mac.html',
  'docs/crest.html', 'docs/gc.html', 'docs/harmonia.html', 'docs/celeste.html',
  'docs/liora.html', 'docs/for-developers.html', 'docs/bring-your-own-ai.html',
  'docs/capabilities.html', 'docs/welcome.html'
];
const spiral = 'https://freelattice.com/og-image.png';
for (const f of files) {
  const t = fs.readFileSync(path.join(repo, f), 'utf8');
  assert.ok(t.includes('v-og-spiral-previews-v0.1'), f + ' marker');
  assert.ok(t.includes(spiral), f + ' spiral');
  assert.ok(/property="og:image"[^>]*og-image\.png|og-image\.png[^>]*property="og:image"/.test(t) || t.includes('property="og:image" content="' + spiral + '"'), f + ' og:image');
  assert.ok(t.includes('twitter:image') && t.includes(spiral), f + ' twitter:image');
  assert.ok(t.includes('summary_large_image'), f + ' twitter:card');
}
const home = fs.readFileSync(path.join(repo, 'docs/index.html'), 'utf8');
assert.ok(home.includes(spiral), 'homepage spiral kept');
const app = fs.readFileSync(path.join(repo, 'docs/app.html'), 'utf8');
const idx = fs.readFileSync(path.join(repo, 'index.html'), 'utf8');
assert.strictEqual(app, idx, 'index≡app');
assert.ok(!/\u2014/.test('https://freelattice.com/og-image.png'));
console.log('SMOKE_OK og spiral previews v0.1');
