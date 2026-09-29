#!/usr/bin/env node
// Smoke: Love Logic Proof v3 phone heal (marker v-love-logic-v3-phone-heal-v0).
// Layer on docs/love-logic-proof-v3.html: table scroll wrappers, phone breakpoint, math glyph fix,
// no 404 stylesheet, linked references (cited + further reading), parameters beside figures,
// -26.42 corrected, meaning of the 656 checks, visible result box. The 656 checks stay green.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const docs = path.join(__dirname, '..');
const repo = path.join(docs, '..');
const page = fs.readFileSync(path.join(docs, 'love-logic-proof-v3.html'), 'utf8');

// Marker
assert.ok(/v-love-logic-v3-phone-heal-v0/.test(page), 'phone heal marker');

// 1. Scroll wrappers on the three wide tables
for (const id of ['llv3-results', 'llv3-live', 'crossover-table']) {
  const re = new RegExp('<div class="table-scroll"[^>]*>(?:<!--[^>]*-->)?\\s*<table class="data" id="' + id + '"');
  assert.ok(re.test(page), 'scroll wrapper around #' + id);
}
assert.ok(/\.table-scroll \{ overflow-x: auto;/.test(page), 'table-scroll CSS');

// 2. Phone breakpoint for h1 and box padding
const mq = page.slice(page.indexOf('@media (max-width: 600px)'));
assert.ok(mq.length > 30 && /h1 \{ font-size: 1\.85rem/.test(mq) && /\.mom \{ padding: 16px 16px; \}/.test(mq), 'phone breakpoint: h1 + boxes');

// 3. Math glyph fix (no mathematical-italic code points on phones) and the plain-text line stays
assert.ok(/math mi \{ text-transform: none; font-style: italic; \}/.test(page), 'MathML mi text-transform none');
assert.ok(/Plain text: G &lt; h\(n, m\) &times; \[ L<sub>p<\/sub> \+ &delta;&Delta; \/ \(1 &minus; &delta;\) \]/.test(page), 'plain-text inequality kept');

// 4. No 404 stylesheet link
assert.ok(!/<link[^>]+href="css\/style\.css"/.test(page), 'no css/style.css link');

// 5. References: all twelve kept, split into cited + further reading, with links
const refs = page.slice(page.indexOf('<summary>References</summary>'), page.indexOf('<p class="chain-note">'));
const cited = refs.slice(refs.indexOf('<h4>Cited on this page'), refs.indexOf('<h4>Further reading'));
const further = refs.slice(refs.indexOf('<h4>Further reading'));
for (const name of ['Li and P. Vit', 'Luce and H. Raiffa', 'Selten', 'Kreps', 'Nowak and K. Sigmund', 'Aaronson']) assert.ok(cited.includes(name), 'cited: ' + name);
for (const name of ['Levin', 'Fudenberg', 'Kandori', 'Maynard Smith', 'Omohundro', 'Turner']) assert.ok(further.includes(name), 'further reading: ' + name);
assert.strictEqual((refs.match(/<li>/g) || []).length, 12, 'twelve references, none deleted');
assert.ok((refs.match(/<a href="https:\/\//g) || []).length >= 12, 'references carry links');

// 6. Parameters shown next to the figures, and the corrected -26.42
assert.ok(/about 702 rounds/.test(page) && /about 10\.5 rounds/.test(page), 'plain-words figures kept');
assert.ok(/id="llv3-params"/.test(page) && /n = 2 contacts with m = 0/.test(page) && /n = 5 with m = 1/.test(page) && /n = 10 with m = 1/.test(page), 'parameters behind 702 / 10.5 / never');
assert.ok(/&minus;26\.42<\/strong> by the closed form/.test(page) && /G = 1, c = 0\.001, &kappa; = 20, h = 0\.03/.test(page), '-26.42 with its settings');
assert.ok(!/about &minus;26\.5 in our run/.test(page), 'old "about -26.5" wording corrected');
assert.ok(/id="scarcity-grid-params"/.test(page) && /&delta; = 0\.95<\/strong>/.test(page) && /63 are scarce/.test(page), '68/32 grid parameters');

// 7. Meaning of the checks, visible result box
assert.ok(/What the 656 checks mean:<\/strong> they confirm that the formulas on this page agree with their own/.test(page), 'meaning line');
assert.ok(/id="llv3-result"[^>]*role="status"[^>]*aria-live="polite"/.test(page), 'result box is a live region');

// Safety: textContent only, no network, no confirm, only the local checks script
assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(page), 'textContent only');
assert.ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|document\.cookie|localStorage/.test(page), 'no network, no storage');
assert.ok(!/\bconfirm\s*\(|\balert\s*\(/.test(page), 'no confirm / alert');
const srcs = [...page.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
assert.deepStrictEqual(srcs, ['love-logic/v3_checks.js'], 'only the local checks script');
let inline = 0;
for (const m of page.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/g)) { new vm.Script(m[1]); inline++; }
assert.strictEqual(inline, 2, 'v3 glue + phone heal glue, both parse');

// The 656 checks stay green
const api = require(path.join(docs, 'love-logic', 'v3_checks.js'));
const r = api.runAll();
assert.strictEqual(r.total.passed, 656, '656 passed');
assert.strictEqual(r.total.total, 656, '656 total');
assert.strictEqual(Number(api.Dinf(1, 1e-3, 20, 0.03, 2, 0.5, 0.99).toFixed(2)), -26.42, 'closed form -26.42');

// Layer, never delete: the v3 smoke still passes
execFileSync(process.execPath, [path.join(docs, 'scripts', 'smoke-love-logic-proof-v3.js')], { stdio: 'ignore' });

// sw.js, Kimi, app.html untouched when a git base is available
try {
  const changed = execFileSync('git', ['diff', '--name-only', 'origin/main'], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').filter(Boolean);
  assert.ok(!changed.includes('sw.js') && !changed.includes('docs/sw.js'), 'sw.js untouched');
  assert.ok(!changed.some((f) => /kimi|voice-shelf|VOICE_SHELF/i.test(f)), "Kimi's pages untouched");
  // Brick-scoped like the v3 smoke (#121): binds only while the v3 page itself is in the diff.
  if (changed.includes('docs/love-logic-proof-v3.html')) {
    assert.ok(!changed.includes('docs/app.html') && !changed.includes('index.html'), 'app.html / index.html untouched');
  }
  assert.ok(!changed.includes('docs/love-logic-proof.html') && !changed.includes('docs/love-logic-proof-v2.html'), 'v1 and v2 untouched');
  assert.ok(!changed.includes('docs/love-logic/v3_checks.js'), 'v3_checks.js untouched');
} catch (e) { if (e instanceof assert.AssertionError) throw e; }

console.log('SMOKE_OK love logic v3 phone heal v0.1');
