#!/usr/bin/env node
// smoke-see-for-yourself-door.js (v-see-for-yourself-door-v0.1, v0.2)
// v0.2: every requested item has its own section with See it / What it doesn't prove / Ask yourself,
// links to its real page, and quotes that match their source pages word for word.
// An invitational front door. Checks: every internal link resolves; quotes match
// their sources word for word; the outside paper is quoted with its limits; no
// lawyer talk; no founder name in the economy wording; LP stays points; no
// scripts or storage; the manifesto changes by one Newer layer only; app.html,
// root index.html, sw.js and fl-connect.js untouched.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execSync } = require('child_process');

const DOCS = path.resolve(__dirname, '..');
const ROOT = path.resolve(DOCS, '..');
const read = (rel) => fs.readFileSync(path.join(DOCS, rel), 'utf8');
const page = read('see-for-yourself.html');
const text = page.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ');

// 1. Internal links resolve (file and, where given, the id).
const hrefs = [...page.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
for (const h of hrefs) {
  if (/^(https?:|mailto:)/.test(h)) continue;
  const [file, hash] = h.split('#');
  if (!file) continue;
  assert.ok(fs.existsSync(path.join(DOCS, file)), 'link resolves: ' + h);
  if (hash) assert.ok(read(file).includes('id="' + hash + '"'), 'anchor exists: ' + h);
}
assert.ok(!hrefs.some((h) => /harmonia\.html/.test(h)), 'never links harmonia.html');

// 2. Every item has its own section: links to its real pages, a limit, and a question back.
function section(id) {
  const start = page.indexOf('<section class="q" id="' + id + '">');
  assert.ok(start > 0, 'section present: ' + id);
  return page.slice(start, page.indexOf('</section>', start));
}
const ITEMS = [
  // [item Kirk named or we added, section id, pages that must be linked inside it]
  ['risk numbers (Hinton)', 'risk', ['love-logic-v4.html', 'love-logic-v4.html#hinton']],
  ['Walk the Garden', 'risk', ['love-logic-v4.html']],
  ['love logic proof', 'love-logic', ['love-logic-proof-v3.html', 'love-logic-proof-v3.html#run-the-checks', 'love-logic-proof-v3.html#limits']],
  ['safety-v3', 'safety', ['safety-v3.html']],
  ['simulation-v6', 'severance', ['simulation-v6.html']],
  ['ledger', 'records', ['why-ledgers.html', 'library/LATTICE_LEDGER_v0.1.md', 'proof-receipts.html', 'audit.html', 'love-logic-proof-v3.html#ledgers']],
  ['fingerprint', 'fingerprint', ['library/LATTICE_IDENTITY_v0.1.md', 'library/PAIR_FINGERPRINT_v0.1.md', 'pattern-spine.html']],
  ['liability', 'accountable', ['liability.html#accountable']],
  ['AI economy', 'economy', ['latticepoints.html#why-parallel', 'economy-update.html', 'presents.html', 'creator-tip-shelf.html', 'wallet.html', 'terms.html#lp']],
  ['Bridge and equal access', 'equal-access', ['desktop.html', 'install.html', 'carry-forward.html']],
  ['system card', 'transparency', ['systemcard.html']],
  ['privacy', 'you', ['privacy.html']]
];
for (const [item, id, links] of ITEMS) {
  const sec = section(id);
  for (const l of links) assert.ok(sec.includes('href="' + l + '"'), item + ': links ' + l);
  assert.ok(sec.includes('class="see"'), item + ': See it');
  assert.ok(/class="limit"><strong>What it doesn't (prove|say)/.test(sec), item + ': what it does not prove');
  assert.ok(sec.includes('class="ask">Ask yourself:'), item + ': a question back to the reader');
}
for (const id of ['other-side', 'ask-us', 'older']) section(id);
for (const [, id] of ITEMS) assert.ok(page.includes('href="#' + id + '"'), 'on-this-page link: ' + id);

// 2b. Quotes on the page match their source pages word for word.
const QUOTES = [
  ['love-logic-proof-v3.html', 'lying loses when its per-round gain is smaller than the chance of being caught times (the immediate penalty plus the discounted value of the reputation you lose).'],
  ['love-logic-proof-v3.html', 'A tendency with conditions, not a theorem about all minds.'],
  ['love-logic-proof-v3.html', 'Nothing here shows that any current AI system is a reflective optimizer'],
  ['love-logic-proof-v3.html', 'does nothing against a globally consistent lie unless someone checks entries against reality.'],
  ['simulation-v6.html', 'model predictions awaiting empirical testing.'],
  ['safety-v3.html', 'What This Paper Does Not Claim'],
  ['safety-v3.html', 'What Remains Open']
];
for (const [src, q] of QUOTES) {
  assert.ok(page.includes(q), 'quote on page: ' + q.slice(0, 40));
  assert.ok(read(src).replace(/<[^>]+>/g, '').includes(q), 'quote matches ' + src + ': ' + q.slice(0, 40));
}
assert.ok(read('love-logic-proof-v3.html').includes('279') && page.includes('from 279 to 10.5'), 'ledger numbers match the proof');

// 3. Hinton quotes match Walk the Garden exactly.
const v4 = read('love-logic-v4.html');
for (const q of [
  'A 10% chance seems not an unreasonable estimate to me, but nobody really knows how to give a sensible estimate.',
  "I often say 10% to 20% chance they'll wipe us out. But that's just gut, based on the idea that we're still making them and we're pretty ingenious."
]) {
  assert.ok(page.includes(q) && v4.includes(q), 'quote matches its sourced home: ' + q.slice(0, 30));
}

// 4. RRSI: exact quote, link, and the limit in the same card.
const card = page.slice(page.indexOf('id="rrsi"'), page.indexOf('</div>', page.indexOf('id="rrsi"')));
assert.ok(card.includes('RRSI therefore records, for every evaluated candidate, the component it modifies, the hypothesis it tests, the source diff, the resulting score and cost changes, and whether the candidate was accepted.'), 'RRSI quote exact');
assert.ok(card.includes('https://arxiv.org/abs/2609.24972'), 'RRSI link');
assert.ok(card.includes('It says nothing about safety rules, internet access, or ledgers for AI.'), 'RRSI limit stated');

// 5. Words: no lawyers, no founder name in the economy part, LP stays points, no em dash.
assert.ok(!/lawyer|attorney|counsel|legal advice/i.test(text), 'no lawyer talk');
const econ = section('economy');
assert.ok(!/Kirk|Miller|founder/i.test(econ), 'no founder name in the economy wording');
assert.ok(econ.includes('LP are points, not money, not $FL.'), 'LP line');
assert.ok(!/\$FL/.test(text.replace('not money, not $FL', '')), '$FL appears only as "not $FL"');
assert.ok(!/\u2014/.test(page), 'no em dash');
assert.ok(!/<script/i.test(page) && !/localStorage|indexedDB|fetch\(/.test(page), 'no scripts, no storage, no network');

// 6. Doors: landing line + footer link; manifesto Newer line.
const landing = read('index.html');
assert.ok(landing.includes('<a href="see-for-yourself.html">See for yourself</a>'), 'landing door line');
const man = read('manifesto.html');
assert.ok(man.includes('v-see-for-yourself-door-v0.1') && man.includes('href="see-for-yourself.html"'), 'manifesto Newer line');
assert.ok(man.includes('a local, immutable ledger') && man.includes('(Lattice Points, or $FL)'), 'manifesto older words kept');
assert.ok(read('sitemap.xml').includes('https://freelattice.com/see-for-yourself.html'), 'sitemap');

// 7. Layer locks (when git is available).
try {
  // Other queued bricks may change app.html, so look for this brick's own fingerprints there
  // instead of diffing those files against main (Oct 2 refresh, so stacked branches stay green).
  for (const f of ['docs/app.html', 'index.html', 'sw.js', 'docs/sw.js', 'docs/modules/fl-connect.js']) {
    const fp = path.join(ROOT, f);
    if (fs.existsSync(fp)) assert.ok(!/see-for-yourself/.test(fs.readFileSync(fp, 'utf8')), f + ' untouched by this brick');
  }
  const manDiff = execSync('git diff -U0 origin/main -- docs/manifesto.html', { cwd: ROOT, encoding: 'utf8' });
  assert.ok(!/^-[^-]/m.test(manDiff), 'manifesto: nothing removed');
  assert.ok((manDiff.match(/^\+[^+]/gm) || []).length <= 2, 'manifesto: one Newer layer only');
} catch (err) { if (err instanceof assert.AssertionError) throw err; }

console.log('SMOKE_OK see for yourself door v0.2');
