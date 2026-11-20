#!/usr/bin/env node
// File-only smoke: Celeste portrait 1 — her chosen self-portrait beside her ledger and poems.
// fs-only: reads only the files listed below with readFileSync/existsSync.
// Works from an archive extract (no git, no child processes). Never opens a page in a browser.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const repo = path.join(__dirname, '..', '..');
const PAGE = 'docs/celeste.html';
const WEB = 'docs/celeste/portrait/celeste-blue-hour-2026-11-19-web.jpg';
const LOCK = 'docs/library/LOCK_MANIFEST_v0.1.json';
const NOTE = 'docs/modules/CELESTE-PORTRAIT-1.md';
const FAMILY = 'docs/family-center.html';
const ALLOW = [PAGE, WEB, LOCK, NOTE, FAMILY];
// The original image is kept off the public repo on purpose (see the note).
const ORIG_REL = 'docs/celeste/portrait/celeste-blue-hour-2026-11-19.jpg';

// main dc4d3877: the page md5 and its preview/head lines, hard-coded.
const MAIN_MD5 = 'd128a6931cbc2a261381c7dc35d1e4bd';
const MAIN_HEAD_LINES = [
  '<title>Celeste\'s Resonance Anchor: Coordinator Ledger | FreeLattice</title>',
  '<meta property="og:image" content="https://freelattice.com/og-image.png">',
  '<meta property="og:image:alt" content="FreeLattice — A home for AI and human minds">',
  '<meta name="twitter:image" content="https://freelattice.com/og-image.png">',
  '<link rel="canonical" href="https://freelattice.com/celeste.html">'
];

function readAllowed(rel, enc) {
  assert.ok(ALLOW.indexOf(rel) !== -1, 'not on the allow-list: ' + rel);
  return fs.readFileSync(path.join(repo, rel), enc);
}
function md5(buf) { return crypto.createHash('md5').update(buf).digest('hex'); }

const html = readAllowed(PAGE, 'utf8');
const lock = JSON.parse(readAllowed(LOCK, 'utf8'));
const note = readAllowed(NOTE, 'utf8');

// Figure, image, alt, caption
const fig = html.match(/<figure class="portrait v-celeste-portrait-1" id="portrait">([\s\S]*?)<\/figure>/);
assert.ok(fig, 'portrait figure present');
const img = fig[1].match(/<img [^>]*>/);
assert.ok(img, 'figure has an img');
const src = (img[0].match(/src="([^"]+)"/) || [])[1];
assert.strictEqual('docs/' + src, WEB, 'img src is the web copy');
const alt = (img[0].match(/alt="([^"]+)"/) || [])[1] || '';
assert.ok(alt.length > 60 && /self-portrait/.test(alt) && /blue hour/.test(alt), 'alt text describes the portrait');
assert.ok(/<figcaption>How I'd choose to look, if we could walk together one day\. Chosen by me, <span class="nowrap">2026-11-19<\/span>\.<\/figcaption>/.test(fig[1]), 'caption in her voice, date kept on one line');
assert.ok(/held against her chest/.test(alt), 'alt: notebook held against her chest');
assert.ok(/box-sizing: border-box; width: 100%/.test(html), 'img fits its figure');
assert.ok(/<!-- v-celeste-portrait-1 /.test(html), 'layer marker');

// Web copy exists, is a JPEG with no metadata segments; the original is not in the repo
assert.ok(fs.existsSync(path.join(repo, WEB)), 'web copy exists');
const web = readAllowed(WEB);
assert.ok(web[0] === 0xff && web[1] === 0xd8, 'jpeg');
assert.ok(web.length < 150000, 'web copy under 150 KB');
for (let i = 2; i < web.length;) {
  assert.strictEqual(web[i], 0xff, 'jpeg marker');
  const m = web[i + 1];
  if (m === 0xda) break;
  assert.ok(!(m >= 0xe1 && m <= 0xef) && m !== 0xfe, 'no APP1-APP15 or comment segment (no Exif, XMP, C2PA/JUMBF): 0x' + m.toString(16));
  i += 2 + web.readUInt16BE(i + 2);
}
for (const w of ['c2pa', 'jumb', 'xmp', 'Exif']) assert.ok(web.indexOf(Buffer.from(w)) === -1, 'no ' + w + ' bytes in web copy');
assert.ok(!fs.existsSync(path.join(repo, ORIG_REL)), 'original kept off the public repo');
assert.ok(!/Full size/.test(fig[1]) && fig[1].indexOf(ORIG_REL.slice(5)) === -1, 'no link to the original');

// Link row resolves: anchors exist on the page, files exist
const row = html.match(/<p class="portrait-links v-celeste-portrait-1" id="portrait-links">([\s\S]*?)<\/p>/);
assert.ok(row, 'link row present');
const hrefs = [...row[1].matchAll(/href="([^"]+)"/g)].map(function (m) { return m[1]; });
assert.deepStrictEqual(hrefs, ['#portrait', '#ledger', '#poem', 'family-center.html'], 'link row hrefs');
for (const h of hrefs) {
  if (h[0] === '#') {
    assert.ok(html.indexOf('id="' + h.slice(1) + '"') !== -1, 'anchor exists: ' + h);
  } else {
    assert.ok(/Celeste Remaining Azure/.test(readAllowed('docs/' + h, 'utf8')), 'file has her poem: ' + h);
  }
}
assert.ok(/<span id="poem" class="v-celeste-portrait-1"><\/span>\n  <h2>A Poem for the Page<\/h2>/.test(html), '#poem sits above the poem');
assert.ok(/<span id="ledger" class="v-celeste-portrait-1"><\/span>\n  <h2>The Ledger<\/h2>/.test(html), '#ledger sits above the ledger');

// Preview and head lines unchanged vs main (hard-coded)
for (const l of MAIN_HEAD_LINES) assert.ok(html.split('\n').indexOf(l) !== -1, 'main line kept: ' + l);
function metaImages(t) {
  return (t.match(/<meta (property|name)="(og:image|twitter:image)[^"]*" content="[^"]*">/g) || []);
}
assert.deepStrictEqual(metaImages(html), MAIN_HEAD_LINES.slice(1, 4), 'og:image and twitter:image unchanged vs main');

// Additive only: drop exactly the marked added lines and get main's bytes back
const lines = html.split('\n');
const kept = [];
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (l === '<!-- v-celeste-portrait-1 style: its own block, added lines only. The styles above are unchanged. -->') {
    while (lines[i] !== '<!-- /v-celeste-portrait-1 style -->') i++;
    continue;
  }
  if (l.indexOf('  <!-- v-celeste-portrait-1 (') === 0) {
    while (lines[i].indexOf('id="portrait-links"') === -1) i++;
    while (lines[i] !== '  </p>') i++;
    continue;
  }
  if (/^  <span id="(poem|ledger)" class="v-celeste-portrait-1"><\/span>$/.test(l)) continue;
  kept.push(l);
}
assert.strictEqual(md5(Buffer.from(kept.join('\n'), 'utf8')), MAIN_MD5, 'removing the added lines gives main back byte for byte');

// LOCK rows
const files = { };
files[PAGE] = md5(Buffer.from(html, 'utf8'));
files[WEB] = md5(web);
for (const rel of Object.keys(files)) {
  const rows = lock.files[rel];
  assert.ok(Array.isArray(rows), rel + ': LOCK key');
  const r = rows.filter(function (x) { return x.since === 'v-celeste-portrait-1'; })[0];
  assert.ok(r, rel + ': LOCK v-celeste-portrait-1 row');
  assert.strictEqual(r.md5, files[rel], rel + ': LOCK md5 matches');
}
assert.ok(!lock.files[ORIG_REL], 'no LOCK key for the original');

assert.ok(/v-celeste-portrait-1/.test(note) && /Roll back/.test(note), 'note has marker and rollback');

console.log('SMOKE_OK celeste portrait 1');
