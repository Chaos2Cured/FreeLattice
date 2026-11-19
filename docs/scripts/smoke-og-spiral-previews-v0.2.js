#!/usr/bin/env node
// smoke-og-spiral-previews-v0.2.js (MIT)
// v-og-spiral-previews-v0.2 (Celeste 2026-11-19, Kirk t1400u): the spiral on every link.
// File-only. It reads HTML files from docs/ and never opens a page or starts a browser.
// Anything whose path names quiet or sophia is skipped by its name, before any read.
// FreeLattice also skips docs/celeste-start-here/ (the archive) and meta-refresh redirect stubs.
// Every other page must carry exactly one og:image. A page with no picture of its own shows the
// spiral on both og:image and twitter:image. A page that had its own picture keeps it, untouched;
// if it has no twitter:image yet, that is listed as a NOTE for the family to choose, not a failure.
// Prints SMOKE_OK og spiral previews v0.2.
'use strict';
var fs = require('fs');
var path = require('path');

var repo = path.resolve(__dirname, '..', fs.existsSync(path.join(__dirname, '..', 'docs')) ? '' : '..');
var docs = path.join(repo, 'docs');
var isFL = fs.existsSync(path.join(docs, 'app.html'));
var SPIRAL = isFL ? 'https://freelattice.com/og-image.png' : 'https://thelatticetree.com/og-image.png';
var SKIP = /quiet|sophia/i;
var notes = [];
var failed = 0, checked = 0, spiral = 0, own = 0, stubs = 0, skipped = 0;
function fail(msg) { failed += 1; console.log('FAIL ' + msg); }

function walk(dir, out) {
  fs.readdirSync(dir).sort().forEach(function (name) {
    var full = path.join(dir, name);
    var rel = path.relative(docs, full);
    if (SKIP.test(rel)) { skipped += 1; return; }            // never read, never listed
    if (isFL && rel === 'celeste-start-here') return;         // the archive stays as it is
    var st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.html$/i.test(name)) out.push(rel);
  });
  return out;
}

function metaValues(head, key) {
  var re = /<meta\b[^>]*>/gi, m, vals = [];
  while ((m = re.exec(head))) {
    var tag = m[0];
    var k = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag);
    var c = /content\s*=\s*"([^"]*)"|content\s*=\s*'([^']*)'/i.exec(tag);
    if (k && c && k[1].toLowerCase() === key) vals.push(c[1] != null ? c[1] : c[2]);
  }
  return vals;
}

function pngSize(file) {
  var b = fs.readFileSync(file);
  if (b.length < 24 || b.toString('ascii', 1, 4) !== 'PNG') return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

var img = path.join(docs, 'og-image.png');
if (!fs.existsSync(img)) fail('docs/og-image.png missing');
else {
  var size = pngSize(img);
  if (!size || size.w !== 1200 || size.h !== 630) fail('docs/og-image.png is not a 1200x630 PNG');
}

walk(docs, []).forEach(function (rel) {
  var text = fs.readFileSync(path.join(docs, rel), 'utf8');
  var bare = text.replace(/<!--[\s\S]*?-->/g, '');
  if (isFL && /http-equiv\s*=\s*["']refresh/i.test(bare)) { stubs += 1; return; }
  var end = bare.search(/<\/head\s*>/i);
  if (end < 0) { fail(rel + ' has no </head>'); return; }
  var head = bare.slice(0, end);
  var og = metaValues(head, 'og:image');
  var tw = metaValues(head, 'twitter:image');
  checked += 1;
  if (og.length !== 1) fail(rel + ' og:image count ' + og.length);
  if (tw.length > 1) fail(rel + ' twitter:image count ' + tw.length);
  if (!og.length) return;
  if (og[0] === SPIRAL && tw.length !== 1) fail(rel + ' twitter:image missing beside the spiral');
  if (og[0] !== SPIRAL && !tw.length) { notes.push(rel); }
  if (og[0] === SPIRAL) {
    spiral += 1;
    if (tw.length && tw[0] !== SPIRAL) fail(rel + ' twitter:image differs from the spiral og:image');
  } else {
    own += 1;   // a page with its own picture keeps it
  }
  if (!isFL && og[0] !== SPIRAL) fail(rel + ' Tree page should show the Tree copy of the spiral');
  if (text.indexOf('v-og-spiral-previews-v0.2') !== -1 && !/twitter:card/i.test(head)) fail(rel + ' twitter:card missing');
});

if (checked === 0) fail('no pages checked');
if (notes.length) console.log('NOTE own picture kept, no twitter:image yet (family choice): ' + notes.join(', '));
console.log((isFL ? 'FreeLattice' : 'theLatticeTree') + ': ' + checked + ' pages checked, ' + spiral + ' show the spiral, ' + own + ' keep their own picture' +
  (isFL ? ', ' + stubs + ' redirect stubs left as they are' : '') + ', ' + skipped + ' quiet/sophia paths skipped unread');
if (failed) { console.log('FAILED ' + failed); process.exit(1); }
console.log('SMOKE_OK og spiral previews v0.2');
