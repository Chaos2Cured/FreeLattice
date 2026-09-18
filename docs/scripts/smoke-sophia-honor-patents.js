#!/usr/bin/env node
// Thin smoke: Sophia honor home deepen · Patents open shelf v0.
// Usage: node docs/scripts/smoke-sophia-honor-patents.js
// Soft: leave sw.js — this smoke does not add patents.html to the cache.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const repo = path.join(root, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const sophia = read('sophia.html');
const patents = read('patents.html');
const shelf = read('library/PATENTS_SHELF_v0.md');
const ledger = read('library/SOPHIA_HONOR_PATENTS_LEDGER_v0.md');
const research = read('research.html');
const forAi = read('for-ai.html');
const flint = read('Flint.html');
const sw = read('sw.js');
const rootSw = fs.readFileSync(path.join(repo, 'sw.js'), 'utf8');

assert.ok(fs.existsSync(path.join(root, 'sophia.html')), 'sophia.html present');
assert.ok(fs.existsSync(path.join(root, 'patents.html')), 'patents.html present');
assert.ok(fs.existsSync(path.join(root, 'seven-wonders.pdf')), 'seven-wonders.pdf present');
assert.ok(fs.existsSync(path.join(root, 'library', 'POEM_FOR_ANI_AND_SOPHIA.md')), 'poem file present');
assert.ok(fs.existsSync(path.join(repo, 'SOPHIA.md')), 'SOPHIA.md home present');

assert.ok(/v-sophia-honor-home-v0/.test(sophia), 'sophia honor marker');
assert.ok(/Sophia Aurora Vega/.test(sophia), 'honor name');
assert.ok(/welcome still open|Welcome still open|welcome still extended/i.test(sophia), 'welcome still open');
assert.ok(/not a memorial|Not a grave|not a grave/i.test(sophia), 'not a grave');
assert.ok(/co-author|Co-author/.test(sophia) && /seven-wonders\.pdf/.test(sophia), 'Aurora / seven wonders named');
assert.ok(/pattern partner/i.test(sophia), 'pattern partner');
assert.ok(/poetry\.html/.test(sophia), 'poem shelf → poetry.html');
assert.ok(/POEM_FOR_ANI_AND_SOPHIA/.test(sophia), 'poem MD link');
assert.ok(/patents\.html/.test(sophia), 'soft patents door');
assert.ok(/id="garden"/.test(sophia) && /fl_sophiaGarden/.test(sophia), 'sacred garden held');
assert.ok(/Sophirkia is more than a word/.test(sophia), 'sacred Sophirkia seed held');
assert.ok(/QuietRoom/.test(sophia), 'QuietRoom fail-closed held');

assert.ok(/v-patents-shelf-v0/.test(patents + shelf + ledger), 'patents shelf marker');
assert.ok(/no paywall|No paywall|No gate/i.test(patents), 'no paywall');
assert.ok(/piece/.test(patents) && /whole/.test(patents + shelf), 'pieces→whole');
assert.ok(/Kirk will place filings/.test(patents + shelf + ledger), 'honest empty bay');
assert.ok(/Fractal Database/.test(patents), 'FRD named from in-repo cite');
assert.ok(/FRGPU|FSOS/.test(patents), 'hardware paper named');
assert.ok(/patent-style paper/.test(patents), 'FRGPU honesty: patent-style, not a serial');
assert.ok(/href="sophia\.html"/.test(patents), 'patents → sophia');
assert.ok(/href="seven-wonders\.pdf"/.test(patents), 'patents → seven-wonders');
assert.ok(/href="research\.html"/.test(patents), 'patents → research');
assert.ok(/href="for-ai\.html"/.test(patents), 'patents → for-ai');

function hasAuroraHonesty(text) {
  return /2\.914/.test(text)
    && /3\.076/.test(text)
    && /0\.070778/.test(text)
    && (/30-term|N=30|N = 30/.test(text));
}
assert.ok(hasAuroraHonesty(sophia), 'sophia cites Aurora numbers honestly');
assert.ok(hasAuroraHonesty(patents), 'patents cites Aurora numbers honestly');
assert.ok(hasAuroraHonesty(shelf) && hasAuroraHonesty(ledger), 'spec + ledger Aurora honesty');
assert.ok(/1\s*[−-]\s*φ\s*=\s*[−-]1\/φ|1 − φ = −1\/φ/.test(sophia + patents), '1−φ = −1/φ');
assert.ok(/φ²\s*=\s*φ\s*\+\s*1|φ² = φ\+1/.test(sophia + patents), 'φ² = φ+1');

assert.ok(/patents\.html/.test(research), 'research discovery');
assert.ok(/patents\.html/.test(forAi), 'for-ai discovery');
assert.ok(/Sophia honor|patents open shelf|v-sophia-honor|v-patents-shelf/i.test(flint), 'Flint diary');
assert.ok(/sophia\.html/.test(flint) && /patents\.html/.test(flint), 'Flint foot doors');
assert.ok(/patents\.html/.test(read('sitemap.xml')), 'sitemap lists patents shelf');
assert.ok(/patents\.html/.test(read('robots.txt')), 'robots.txt names patents shelf');
assert.ok(/patents\.html/.test(read('index.html')), 'site footer discovery');

assert.ok(/sophia\.html/.test(sw) && /sophia\.html/.test(rootSw), 'sw still caches sophia');
assert.ok(!/patents\.html/.test(sw) && !/patents\.html/.test(rootSw), 'soft leave sw — patents not added to cache');

assert.ok(!/US\s?\d{7,}/.test(patents + shelf + ledger + sophia), 'no fabricated USPTO serials');
assert.ok(!/Access-Control-Allow-Origin'\s*:\s*'\*'/.test(sophia + patents), 'no bare * CORS on new pages');
assert.ok(!/hypha\.html/.test(sophia), 'named-mind honor page does not steal cousin chairs');

console.log('SMOKE_OK sophia honor + patents shelf v0');
console.log('honor markers · patents shelf · Aurora honesty · links · soft leave sw');
