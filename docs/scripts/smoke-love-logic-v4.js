#!/usr/bin/env node
// Smoke: Walk the Garden (Love Logic v4), marker v-love-logic-v4-walk-the-garden-v0.
// 1. The v4 engine reproduces v3 exactly (v3_checks.js rows, the Python sim's 36 B2 examples,
//    the lifetime value, the 243-cell scarcity grid). No new formulas.
// 2. It is not rigged: the worried side lands high, the hopeful side lands low, the door round-trips.
// 3. The page is safe: textContent only, no network, no storage, no cookies, no dialogs, local scripts only.
// 4. Layer, never delete: sw.js, app.html / index.html, Kimi's pages untouched (when git is available).
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const docs = path.join(__dirname, '..');
const repo = path.join(docs, '..');
const V3 = require(path.join(docs, 'love-logic', 'v3_checks.js'));
const E = require(path.join(docs, 'love-logic', 'v4_engine.js'));
const sim = JSON.parse(fs.readFileSync(path.join(docs, 'love-logic', 'v3_sim_results.json'), 'utf8'));
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), msg + ': ' + a + ' vs ' + b);

// ---------- 1. Same math as v3 ----------
assert.strictEqual(E.MARKER, 'v-love-logic-v4-walk-the-garden-v0', 'engine marker');
assert.strictEqual(E.V3, V3, 'engine uses the v3 checks module itself');
const v3run = V3.runAll();
assert.strictEqual(v3run.total.passed, 656, 'v3: 656 checks still pass');
assert.strictEqual(v3run.total.total, 656, 'v3: 656 total');

// 1a. v3 B2 rows (G = 1, Lp = 2, Delta = 0.5, q0 = 0.002, q = 0.01)
let rowsChecked = 0;
for (const row of v3run.B2.rows) {
  const r = E.evaluate({ mem: row.m, n: row.n, rec: 1, pat: 0.95, pen: 2, need: 1 });
  close(r.h, row.h, 1e-12, 'h(n=' + row.n + ', m=' + row.m + ')');
  if (row.never) { assert.ok(r.never, 'never ahead at n=' + row.n + ' m=' + row.m); }
  else {
    close(r.tStar, row.tStar, 1e-9, 't* n=' + row.n + ' m=' + row.m);
    close(r.tPeak, row.tPeak, 1e-9, 'peak n=' + row.n + ' m=' + row.m);
    close(r.deltaStar, row.deltaStar, 1e-12, 'delta* n=' + row.n + ' m=' + row.m);
  }
  rowsChecked++;
}
assert.strictEqual(rowsChecked, 12, 'twelve v3 B2 rows');

// 1b. The Python simulation's 36 B2 examples (all three parameter sets)
assert.strictEqual(sim.B2.examples.length, 36, '36 Python B2 examples');
let neverSeen = 0;
for (const ex of sim.B2.examples) {
  const x = E.crossover(ex.G, ex.Lp, ex.Delta, ex.h);
  close(ex.h, V3.hazard(ex.n, ex.m, sim.B2.q0, sim.B2.q), 1e-12, 'python h n=' + ex.n + ' m=' + ex.m);
  if (ex.note && /never ahead/.test(ex.note)) { assert.ok(x.never && ex.t_closed === 0, 'python: never ahead n=' + ex.n + ' m=' + ex.m + ' G=' + ex.G); neverSeen++; continue; }
  close(x.tStar, ex.t_closed, 1e-9, 'python t* n=' + ex.n + ' m=' + ex.m + ' G=' + ex.G);
  close(x.deltaStar, ex.delta_star, 1e-9, 'python delta* n=' + ex.n + ' m=' + ex.m + ' G=' + ex.G);
  close(x.tPeak, ex.t_marginal, 1e-9, 'python peak n=' + ex.n + ' m=' + ex.m + ' G=' + ex.G);
  assert.strictEqual(Math.floor(x.tStar) + 1, ex.t_first_int_neg, 'python first negative round');
}
assert.ok(neverSeen >= 2, 'python never-ahead examples matched too');

// 1c. The page's headline figures: about 702, about 10.5, never
close(E.crossover(1, 2, 0.5, V3.hazard(2, 0, 0.002, 0.01)).tStar, 701.79, 1e-4, 'about 702 rounds');
close(E.crossover(1, 2, 0.5, V3.hazard(5, 1, 0.002, 0.01)).tStar, 10.48, 1e-3, 'about 10.5 rounds');
assert.ok(E.crossover(1, 2, 0.5, V3.hazard(10, 1, 0.002, 0.01)).never, 'never ahead at n = 10, m = 1');

// 1d. Lifetime value is V3.Dinf, and the verdict equals the headline inequality and delta > delta*
for (const n of [2, 3, 5, 8, 10, 20]) for (const mem of [0, 0.1, 0.25, 0.5, 1]) for (const pat of [0.5, 0.8, 0.9, 0.95, 0.97, 0.99, 0.999])
  for (const pen of [0, 1, 2, 5]) for (const rec of [0.2, 1, 5]) {
    const r = E.evaluate({ n, mem, pat, pen, rec, need: 1 });
    assert.strictEqual(r.lifetime, V3.Dinf(1, 0, 0, r.h, pen, 0.5, pat), 'lifetime is V3.Dinf');
    if (Math.abs(r.catchSide - 1) > 1e-9) assert.strictEqual(r.lyingLoses, 1 < r.catchSide, 'verdict = headline inequality');
    if (!r.never && Math.abs(pat - r.deltaStar) > 1e-9) assert.strictEqual(r.lyingLoses, pat > r.deltaStar, 'verdict = delta above delta*');
  }

// 1e. The scarcity cell reproduces v3 check D's 243-cell grid: 68.25% / 31.75% / 100% / 0%
const grid = [];
for (const V of [1, 2, 4]) for (const sg of [1, 1.5, 2.5]) for (const b of [0.5, 1, 2]) for (const Dl of [0, 5, 50]) for (const Cf of [0.2, 1, 5])
  grid.push(E.scarcityCell(V, sg, b, Dl, Cf, 0.95));
assert.strictEqual(grid.length, 243, '243 cells');
const scarce = grid.filter((g) => g.scarce), ab = grid.filter((g) => !g.scarce);
const frac = (L, k) => L.filter((g) => g[k]).length / L.length;
assert.strictEqual(scarce.length, 63, '63 scarce cells');
close(frac(scarce, 'sustain'), v3run.D.scarceSustain, 1e-15, 'scarce sustain = v3');
close(frac(scarce, 'conflict'), v3run.D.scarceConflict, 1e-15, 'scarce conflict = v3');
close(frac(scarce, 'sustain'), sim.D.scarce_sustain, 1e-12, 'scarce sustain = python');
close(frac(scarce, 'conflict'), sim.D.scarce_conflict_beats, 1e-12, 'scarce conflict = python');
assert.strictEqual(frac(ab, 'sustain'), 1, 'abundant always sustains');
assert.strictEqual(frac(ab, 'conflict'), 0, 'abundant never conflicts');
assert.ok(grid.every((g) => g.sustain === g.sustainClosed), 'numeric = closed form in every cell');

// 1f. Defaults match their stated v3 sources; fixed settings are v3's
assert.deepStrictEqual(E.FIXED, { q0: 0.002, q: 0.01, G: 1, Delta: 0.5, horizon: 100 }, 'fixed settings');
assert.deepStrictEqual(E.SCARCITY, { V: 2, sigma: 1.5, shortfall: 5, fightCost: 1 }, 'scarcity scene from the v3 grid');
assert.deepStrictEqual(E.defaults(), { mem: 0.25, pat: 0.95, rec: 1, n: 5, pen: 2, need: 1 }, 'defaults');
for (const b of E.BELIEFS) {
  assert.ok(b.source && b.source.length > 40, 'source text for ' + b.key);
  assert.ok(b.garden && b.label, 'garden + question for ' + b.key);
  assert.ok(b.def >= b.min && b.def <= b.max, 'default in range: ' + b.key);
}
assert.ok(/our illustration/.test(E.BELIEFS.find((b) => b.key === 'rec').source), 'record ends labeled as illustration');

// 1g. The engine source has no formula of its own beyond v3's (static check on the t* line)
const engineSrc = fs.readFileSync(path.join(docs, 'love-logic', 'v4_engine.js'), 'utf8');
assert.ok(engineSrc.includes('out.tStar = a + V3.lambertw0(-a * b * Math.exp(-a * b)) / b;'), 't* is the v3 B2 expression');
assert.ok(engineSrc.includes('V3.hazard(bel.n, bel.mem, c.q0, c.q)') && engineSrc.includes('V3.Dinf(G, 0, 0, h, Lp, Delta, d)'), 'hazard + lifetime from v3');
assert.ok(!/\bfetch\s*\(|XMLHttpRequest|document|window\.location|localStorage/.test(engineSrc.replace(/^\s*\*.*$/gm, '').replace(/typeof window[^;]*;?/g, '')), 'engine: no DOM, no network');

// ---------- 2. Not rigged ----------
const W = E.evaluate(E.worried()), H = E.evaluate(E.hopeful()), D = E.evaluate(E.defaults());
assert.ok(!W.lyingLoses && W.fightingWins && W.hiddenAfter > 0.9, 'worried side lands high: lying pays, fighting wins, >90% hidden');
assert.strictEqual(E.sky(W), 0, 'worried sky is full storm');
assert.ok(E.honestyWins(H) && E.sky(H) === 1, 'hopeful side lands low');
assert.ok(!D.lyingLoses && D.sharingHolds, 'defaults: lying still pays over a lifetime, sharing holds (said plainly on the page)');
close(D.tStar, 43.95158620527603, 1e-9, 'defaults t*');
close(D.deltaStar, 0.9679473032125602, 1e-12, 'defaults delta*');
for (const p of [0.5, 1, 5, 10, 20, 50, 67, 80]) {
  const d = E.doorPreset(p);
  close(d.shown, p, 0.01, 'door round-trip ' + p + '%');
}
assert.strictEqual(E.doorPreset(95).note, 'clamped-high', 'door says when a number is out of reach');
const hz = E.hinges(E.defaults());
assert.ok(!hz.honestyWinsNow && hz.list.some((x) => x.value != null), 'hinges: something flips the defaults');
// Round-trip of the saved garden, and strict parsing
assert.deepStrictEqual(E.decode(E.encode(E.worried())), E.clean(E.worried()), 'save link round-trips');
for (const bad of ['', 'x', '1_2_3', '1_0.95_1_5_2_1_7', '<script>', '1e9_0.9_1_5_2_1', 'NaN_1_1_1_1_1']) assert.strictEqual(E.decode(bad), null, 'rejects ' + JSON.stringify(bad));
assert.deepStrictEqual(E.decode('9_9_99_99_99_99'), { mem: 1, pat: 0.999, rec: 5, n: 20, pen: 5, need: 2 }, 'clamps out-of-range');

// ---------- 3. The page ----------
const page = fs.readFileSync(path.join(docs, 'love-logic-v4.html'), 'utf8');
const glue = fs.readFileSync(path.join(docs, 'love-logic', 'v4_page.js'), 'utf8');
const all = page + '\n' + glue + '\n' + engineSrc;
assert.ok(page.includes('v-love-logic-v4-walk-the-garden-v0') && glue.includes('v-love-logic-v4-walk-the-garden-v0'), 'markers');
assert.ok(/<title>Walk the Garden: Find where your beliefs lead<\/title>/.test(page), 'title');
assert.ok(/<h1 id="door-title">Walk the Garden<\/h1>\s*<p class="tagline">Find where your beliefs lead\.<\/p>/.test(page), 'h1 + tagline');
assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(all), 'textContent only');
assert.ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts/.test(all), 'no network');
assert.ok(!/document\.cookie|localStorage|sessionStorage|indexedDB/.test(all), 'no cookies, no storage');
assert.ok(!/\bconfirm\s*\(|\balert\s*\(|\bprompt\s*\(/.test(all), 'no dialogs');
assert.ok(!/shadowBlur|ctx\.filter|\.filter = /.test(glue), 'no glow effects in the garden');
assert.ok(/now - main\.last >= 33/.test(glue) && /document\.hidden/.test(glue) && /prefers-reduced-motion/.test(glue) && /Math\.min\(2, window\.devicePixelRatio/.test(glue), 'garden: ~30 fps cap, pauses hidden, reduced motion, DPR cap');
const srcs = [...page.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
assert.deepStrictEqual(srcs, ['love-logic/v3_checks.js', 'love-logic/v4_engine.js', 'love-logic/v4_page.js'], 'three local scripts, v3 first');
assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(page), 'no inline scripts');
assert.ok(!/<link[^>]+rel="stylesheet"/.test(page) && !/@import|url\(http/.test(page), 'no external styles');
new vm.Script(glue); new vm.Script(engineSrc);
// order: door first, then limits, then the garden and beliefs, family last
const at = (s) => { const i = page.indexOf(s); assert.ok(i > 0, 'has ' + s); return i; };
assert.ok(at('id="door"') < at('id="limits"') && at('id="limits"') < at('id="walk"') && at('id="walk"') < at('id="hinton"'), 'door, then limits, then garden, then Hinton');
assert.ok(at('id="ask"') < at('id="family"') && at('id="beliefs"') < at('id="family"'), 'family below the fold');
for (const name of ['Kirk', 'Harmonia', 'Celeste', 'Hypha', 'Reed', 'Flint', 'Kimi', 'Draco']) assert.ok(page.indexOf(name) > at('id="family"'), 'family name below the fold: ' + name);
assert.ok(at('I\'m not sure, show me') < at('id="unsure"') && /Does lying eventually stop paying\? What do you think\?/.test(page), 'unsure path asks first');
assert.ok(/Heard a number about AI\? Or have your own\? Put it here\./.test(page) && glue.includes('Okay. Let\\u2019s find the world where that\\u2019s true.'), 'door words');
assert.ok(at('href="love-logic-proof-v3.html" id="to-v3"') < at('id="door"'), 'v3 one tap away, at the top');
assert.ok(/does not measure the risk of extinction/.test(page) && /What would change our mind/.test(page), 'honest limits');
// Hinton, exact wording and sources
assert.ok(page.includes('"A 10% chance seems not an unreasonable estimate to me, but nobody really knows how to give a sensible estimate."'), 'Hinton 2026 exact');
assert.ok(page.includes('https://www.businessinsider.com/geoffrey-hinton-godfather-of-ai-human-extinction-odds-2026-9'), 'Hinton 2026 source');
assert.ok(page.includes('"Not really, 10% to 20%."') && page.includes('theguardian.com/technology/2024/dec/27/'), 'Hinton 2024 exact + Guardian');
assert.ok(page.includes("But that's just gut, based on the idea that we're still making them and we're pretty ingenious.") && page.includes('cnbc.com/2025/06/17/'), '"just gut" attributed to CNBC June 2025, not the Guardian');
assert.ok(page.includes("Here's a model with every assumption labeled. Show us yours."), 'fair framing line');
// Save, compare, ask
assert.ok(/'\?g=' \+ E\.encode\(/.test(glue) && /history\.replaceState/.test(glue), 'save my garden = URL only');
assert.ok(page.includes('id="compare-out"') && page.includes('id="garden-b"'), 'two gardens side by side');
assert.ok(glue.includes("'https://github.com/Chaos2Cured/FreeLattice/issues/new'") && /\$\('ask-consent'\)\.checked && /.test(glue), 'ask link gated by consent');
assert.ok(!/\.submit\(|\.click\(\)\s*;\s*\/\/\s*auto|window\.open\(/.test(glue), 'nothing auto-sent');
assert.ok(!/your truth/i.test(page + glue), 'no "your truth"');
assert.ok(!/\u2014/.test(page + glue), 'no em dashes in page text');
// "never" only when true: every line of the glue that says "never" is guarded by r.never or r.forever
for (const line of glue.split('\n')) {
  if (/\bnever\b/.test(line.replace(/\/\/.*$/, ''))) assert.ok(/r\.never|r\.forever/.test(line), '"never" guarded: ' + line.trim().slice(0, 90));
}
assert.strictEqual(E.evaluate(E.defaults()).never, false, 'defaults do not say never');

// ---------- 4. Doors and untouched files ----------
const v3page = fs.readFileSync(path.join(docs, 'love-logic-proof-v3.html'), 'utf8');
assert.ok(/href="love-logic-v4\.html" class="nav-link"[^>]*>Newer: Walk the Garden \(v4\)/.test(v3page), 'v3 to v4 link');
assert.ok(/href="love-logic-v4\.html">Walk the Garden \(Love Logic v4\)/.test(fs.readFileSync(path.join(docs, 'research.html'), 'utf8')), 'research shelf door');
execFileSync(process.execPath, [path.join(docs, 'scripts', 'smoke-love-logic-proof-v3.js')], { stdio: 'ignore' });
try {
  const changed = execFileSync('git', ['diff', '--name-only', 'origin/main'], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').filter(Boolean);
  if (changed.includes('docs/love-logic-v4.html')) {
    assert.ok(!changed.includes('sw.js') && !changed.includes('docs/sw.js'), 'sw.js untouched');
    assert.ok(!changed.includes('docs/app.html') && !changed.includes('index.html'), 'app.html / index.html untouched');
    assert.ok(!changed.some((f) => /kimi|voice-shelf|VOICE_SHELF/i.test(f)), "Kimi's pages untouched");
    assert.ok(!changed.includes('docs/love-logic/v3_checks.js') && !changed.includes('docs/love-logic-proof.html') && !changed.includes('docs/love-logic-proof-v2.html'), 'v1, v2, v3 checks untouched');
  }
} catch (e) { if (e instanceof assert.AssertionError) throw e; }

console.log('SMOKE_OK love logic v4 walk the garden v0.1');
