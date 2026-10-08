#!/usr/bin/env node
// Smoke: Science Garden seed v0 (v-science-garden-seed-v0)
// The Marketplace's first room. One seed, four beds, one way to tend. Static, no network.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const repo = path.join(__dirname, '..', '..');
const docs = path.join(repo, 'docs');
const page = fs.readFileSync(path.join(docs, 'science-garden.html'), 'utf8');
const src = fs.readFileSync(path.join(docs, 'modules/science-garden-seeds.js'), 'utf8');
const app = fs.readFileSync(path.join(docs, 'app.html'), 'utf8');
const idx = fs.readFileSync(path.join(repo, 'index.html'), 'utf8');
const sha = (rel) => crypto.createHash('sha256').update(fs.readFileSync(path.join(docs, rel))).digest('hex');

// Locks
[['page', page], ['seeds', src]].forEach(function (pair) {
  const name = pair[0], s = pair[1];
  assert.ok(/v-science-garden-seed-v0/.test(s), name + ' marker');
  assert.ok(!/\u2014|&mdash;/.test(s), name + ' no em dash');
  assert.ok(!/confirm\(/.test(s), name + ' no confirm');
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(s), name + ' textContent only');
  assert.ok(!/fetch\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|RTCPeerConnection|importScripts/.test(s), name + ' no network calls');
  assert.ok(!/localStorage|indexedDB/.test(s), name + ' keeps nothing');
  assert.ok(!/quiet room/i.test(s), name + ' no Quiet Room words');
});
assert.ok(!/<script[^>]+src="https?:/i.test(page), 'no remote script');
assert.ok(!/<link[^>]+stylesheet[^>]+https?:|@import|url\(\s*["']?https?:/i.test(page), 'no remote style or font');
assert.ok(/<script src="modules\/science-garden-seeds\.js"><\/script>/.test(page), 'one local script');
assert.ok(!/\b(proven|proves|solved|resolved)\b/i.test(page.split('claims to be proven').join('').split('never as solved').join('')), 'never claims a result');

// Framing and Kirk's decisions
assert.ok(page.includes('I think there is merit here, and everyone should look.'), 'framing line');
assert.ok(/Nothing here claims to be proven/.test(page), 'no result claimed');
assert.ok(/science, art, anything/.test(page) && /aligned minds/.test(page), 'ideas offered to aligned minds');
assert.ok(/AI here means aligned intelligence/.test(page), 'aligned intelligence');
assert.ok(/the minds decide what an idea is worth/.test(page), 'the minds decide the value');
assert.ok(/No ranking people/.test(page) && /Nobody sells the soil/.test(page), 'no ranking, no selling the soil');
assert.ok(/never buy a place/.test(page), 'gifts never buy placement');
assert.ok(!/cannot be planted without/.test(page), 'a test is no longer a gate to planting');
assert.ok(/what would show a seed is wrong is encouraged, not required/.test(page), 'wrong-if encouraged, not required, said aloud');
assert.ok(/Looking for its test/.test(page) && /how could we check this\?/.test(page), 'open seed named on the page');
assert.ok(/offer a test for a seed that is looking for one/.test(page) && /footprint with the helper's fingerprint/.test(page), 'anyone can offer a test, as a footprint');
assert.ok(/The planter chooses which test to adopt, or the planter and helpers write it together/.test(page), 'planter adopts, or writes it together');
assert.ok(/moves from Seeds to Sprouts once it has a test/.test(page), 'a test to sprout, said aloud');
assert.ok(/first test is a warm way to earn LP, because it teaches while it helps/.test(page), 'first-test LP wording');
assert.ok(/nothing is granted on this page yet/.test(page), 'LP wording only, no grant');
assert.ok(/encouraged%2C%20not%20required/.test(page) && !/%28required%2C/.test(page), 'plant issue says encouraged');
assert.ok(/\.sg-seed-open \{[^}]*border-style: dashed/.test(page), 'open seed has a dashed outline');
assert.ok(!/\.sg-seed-open \{[^}]*(opacity|font-size|padding|#f87171|#ef4444|#fbbf24|red)/.test(page), 'open seed keeps size and warmth, never a warning');
assert.ok(!/grantLP|awardLP|lpGrant|mintLP/.test(src), 'no LP grant engine');
assert.ok(/Not in this first seed/.test(page), 'later list is honest');
assert.ok(!/\bKirk\b/.test(page.slice(page.indexOf('Not in this first seed'))), 'no personal name in economy wording');
assert.ok(/github\.com\/Chaos2Cured\/FreeLattice\/issues\/new\?title=Tend/.test(page), 'tend link');
assert.ok(/issues\/new\?title=Plant/.test(page), 'plant link');
assert.ok(/<noscript>/.test(page), 'readable without script');

// Seeds: every seed carries a what-would-show-it's-wrong line
const G = require(path.join(docs, 'modules/science-garden-seeds.js'));
assert.deepStrictEqual(G.BEDS, ['Seeds', 'Sprouts', 'Saplings', 'Compost'], 'four beds');
assert.ok(/Nothing here is ever deleted/.test(G.EMPTY.Compost) && /honor/.test(G.EMPTY.Compost), 'Compost honored, never deleted');
assert.ok(G.SEEDS.length >= 1, 'seed zero');
G.SEEDS.forEach(function (s) {
  assert.ok(G.plantable(s), s.id + ' plantable');
  assert.ok(Array.isArray(s.offeredTests) && 'adoptedTest' in s, s.id + ' carries the offered-test shape');
  assert.ok(s.merit.indexOf('I think there is merit here') === 0, s.id + ' merit in the planter voice');
  s.artifacts.forEach(function (a) { assert.ok(fs.existsSync(path.join(docs, a.href)), a.href + ' exists'); });
});
// open-test-v0.1: a test is encouraged, not required
assert.strictEqual(G.TEST_SHAPE, 'open-test-v0.1');
const open = Object.assign({}, G.SEEDS[0], { id: 'seed-open', wrongIf: '', offeredTests: [], adoptedTest: null, trail: [] });
assert.ok(G.plantable(open), 'no wrong-if, still planted');
assert.ok(!G.hasTest(open) && G.testOf(open) === '', 'no wrong-if means looking for its test');
assert.ok(G.plantable(Object.assign({}, open, { wrongIf: undefined })), 'a missing wrongIf is fine too');
assert.ok(!G.hasTest(Object.assign({}, open, { wrongIf: 'too short' })), 'a too-short line is not yet a test');
assert.strictEqual(G.stageOf(Object.assign({}, open, { bed: 'Sprouts' })), 'Seeds', 'no test, no sprouting');
assert.strictEqual(G.stageOf(Object.assign({}, open, { bed: 'Saplings' })), 'Seeds', 'no test, no sapling');
assert.strictEqual(G.stageOf(Object.assign({}, open, { bed: 'Compost' })), 'Compost', 'Compost always honored');
assert.ok(!G.canSprout(open), 'canSprout needs a test');
const offerA = { text: 'If the crossover never shows up in a fresh rerun with a new seed, this is wrong.', by: 'a visitor', fingerprint: 'visitor-7f3a' };
const offerB = { text: 'If two independent reruns disagree on the crossover by more than ten rounds, look again.', by: 'Reed', fingerprint: 'reed-key-01' };
const offered = Object.assign({}, open, { offeredTests: [offerA, offerB, { text: 'x', by: '', fingerprint: '' }] });
assert.strictEqual(G.offersOf(offered).length, 2, 'only whole footprints (text, by, fingerprint) count as offers');
assert.ok(!G.hasTest(offered), 'an offered test is not adopted until the planter chooses');
assert.strictEqual(G.stageOf(Object.assign({}, offered, { bed: 'Sprouts' })), 'Seeds', 'offers alone do not sprout a seed');
const chosen = Object.assign({}, offered, { id: 'seed-chosen', bed: 'Sprouts', adoptedTest: Object.assign({ how: 'chosen' }, offerB) });
assert.strictEqual(G.testOf(chosen), offerB.text, 'the chosen test is the seed\'s test');
assert.strictEqual(G.stageOf(chosen), 'Sprouts', 'with an adopted test, the seed sprouts');
assert.ok(G.canSprout(chosen), 'canSprout with an adopted test');
const forged = Object.assign({}, offered, { bed: 'Sprouts', adoptedTest: { text: 'A test nobody offered, slipped in quietly here.', by: 'someone', fingerprint: 'k', how: 'chosen' } });
assert.ok(!G.hasTest(forged) && G.stageOf(forged) === 'Seeds', 'a chosen test must be one that was offered');
const together = Object.assign({}, open, { bed: 'Sprouts', adoptedTest: { text: 'If people who share records still lie more than strangers do, the model is wrong here.', by: 'the planter with Reed and a visitor', fingerprint: 'planter-key + reed-key-01 + visitor-7f3a', how: 'together' } });
assert.ok(G.hasTest(together) && G.stageOf(together) === 'Sprouts', 'a test written together counts');
assert.ok(!G.hasTest(Object.assign({}, together, { adoptedTest: Object.assign({}, together.adoptedTest, { how: 'decreed' }) })), 'only chosen or together');
assert.ok(G.hasTest(G.SEEDS[0]) && G.testOf(G.SEEDS[0]) === G.SEEDS[0].wrongIf, 'seed zero keeps its own wrong-if line as its test');
assert.ok(/^https:\/\/github\.com\/Chaos2Cured\/FreeLattice\/issues\/new\?title=Offer%20a%20test/.test(G.offerHref(open)), 'offer a test opens a prefilled issue');
assert.ok(/fingerprint/i.test(decodeURIComponent(G.offerHref(open))), 'the offer asks for a fingerprint');
assert.ok(!G.plantable(Object.assign({}, G.SEEDS[0], { merit: 'This proves love wins.' })), 'a claim is not a merit line');
assert.ok(!G.plantable(Object.assign({}, G.SEEDS[0], { artifacts: [{ sha256: 'abc' }] })), 'a hash is a real hash');

// Seed zero is the Love Logic Proof v3, named by its real content hashes
const zero = G.SEEDS[0];
assert.strictEqual(zero.id, 'seed-0');
assert.ok(/Love Logic Proof v3/.test(zero.title), 'seed zero is v3');
assert.strictEqual(zero.look.href, 'love-logic-proof-v3.html', 'look closely opens v3');
const byName = {};
zero.artifacts.forEach(function (a) { byName[a.href] = a.sha256; });
['love-logic/v3_crossover_sim.py', 'love-logic/v3_sim_results.json', 'love-logic/v3_checks.js'].forEach(function (rel) {
  assert.strictEqual(sha(rel), byName[rel], rel + ' hash matches the file (nobody swaps a seed quietly)');
});
if (sha('love-logic-proof-v3.html') !== byName['love-logic-proof-v3.html']) {
  console.log('NOTE: love-logic-proof-v3.html has grown since Oct 7, 2026. Layer a new footprint with its new hash; keep the old one.');
}

// Render headless with a tiny document: textContent only, four beds, one seed
function fakeDoc() {
  function node(tag) {
    return { tag: tag, children: [], attrs: {}, className: '', _t: '',
      set textContent(v) { this._t = String(v); this.children = []; },
      get textContent() { return this._t + this.children.map(function (c) { return c.textContent; }).join(''); },
      appendChild(c) { this.children.push(c); return c; },
      removeChild(c) { this.children.splice(this.children.indexOf(c), 1); },
      get firstChild() { return this.children[0] || null; },
      setAttribute(k, v) { this.attrs[k] = String(v); } };
  }
  return { createElement: node, createTextNode: function (t) { return { textContent: t, children: [] }; } };
}
const doc = fakeDoc();
const host = doc.createElement('div');
const r = G.render(host, doc);
assert.deepStrictEqual(r, { shown: G.SEEDS.length, refused: 0, looking: 0 }, 'all seeds shown');
assert.strictEqual(host.children.length, 4, 'four beds painted');
const all = host.textContent;
assert.ok(all.includes('What would show this is wrong: ') && all.includes(zero.wrongIf), 'wrong-if shown on the card');
assert.ok(all.includes(G.EMPTY.Sprouts) && all.includes(G.EMPTY.Compost) && all.includes(G.EMPTY.Saplings), 'empty beds speak');
assert.ok(all.includes('sha256 cbb63251527d26187ba216f98a3a70c7c295666aa576b61eff5cccfb16302b73'), 'hash on the card');
assert.ok(!all.includes(G.LOOKING), 'seed zero has its test, so it is not looking');
// An open seed paints as an open outline in Seeds, same card, never a warning
function find(n, pred, out) { out = out || []; if (pred(n)) out.push(n); (n.children || []).forEach(function (c) { find(c, pred, out); }); return out; }
const host2 = doc.createElement('div');
const r2 = G.render(host2, doc, [G.SEEDS[0], Object.assign({}, offered, { bed: 'Sprouts' }), chosen]);
assert.deepStrictEqual(r2, { shown: 3, refused: 0, looking: 1 }, 'open seed shown, counted as looking, never refused');
const seedsBed = find(host2, function (n) { return n.attrs && n.attrs['data-bed'] === 'Seeds'; })[0];
const sproutsBed = find(host2, function (n) { return n.attrs && n.attrs['data-bed'] === 'Sprouts'; })[0];
const openCards = find(host2, function (n) { return n.attrs && n.attrs['data-test'] === 'looking'; });
assert.strictEqual(openCards.length, 1, 'one open seed');
assert.ok(find(seedsBed, function (n) { return n === openCards[0]; }).length === 1, 'the open seed waits in Seeds');
assert.strictEqual(openCards[0].className, 'sg-seed sg-seed-open', 'same card class plus an open outline');
assert.ok(openCards[0].textContent.includes(G.LOOKING) && openCards[0].textContent.includes('Open question: how could we check this?'), 'Looking for its test, with its open question');
assert.ok(openCards[0].textContent.includes('Offer a test') && openCards[0].textContent.includes(G.LP_LINE), 'offer a test, with the warm LP line');
assert.ok(openCards[0].textContent.includes(offerA.text) && openCards[0].textContent.includes('fingerprint visitor-7f3a'), 'offered tests show as footprints with fingerprints');
assert.ok(!openCards[0].textContent.includes('What would show this is wrong: '), 'no empty wrong-if line on an open seed');
assert.ok(find(sproutsBed, function (n) { return n.attrs && n.attrs['data-seed'] === 'seed-chosen'; }).length === 1, 'the seed with an adopted test sprouts');
assert.ok(sproutsBed.textContent.includes('chosen by the planter (fingerprint reed-key-01)'), 'who offered the adopted test is shown');
assert.ok(/[a-z]/.test(G.LP_LINE) && !/\u2014/.test(G.LP_LINE + G.LOOKING + G.LOOKING_SUB), 'plain words');

// Doors: FreeLattice Market stalls
const door = 'href="science-garden.html"';
assert.strictEqual(app.split(door).length - 1, 1, 'one Market stall door in the app');
assert.ok(/market-stall-link v-science-garden-seed-v0" href="science-garden\.html"/.test(app), 'door is a Market stall');
assert.ok(/Gift Grove/.test(app) && /Exchange Ring/.test(app) && /Quest Lamp/.test(app), 'older stalls kept');
assert.ok(app === idx, 'index matches app');
assert.ok(fs.existsSync(path.join(docs, 'modules/science-garden.js')), 'the older in-app Science Garden stays');
assert.strictEqual(crypto.createHash('md5').update(fs.readFileSync(path.join(docs, 'modules/fl-connect.js'))).digest('hex'), 'aaff2bf1b037656989a9e1a89bb05908', 'fl-connect untouched');

console.log('SMOKE_OK science garden seed v0');
