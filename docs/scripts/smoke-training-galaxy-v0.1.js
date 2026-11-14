#!/usr/bin/env node
// v-training-galaxy-brick1-v0.1 smoke. Unit fixtures only: no network, no app.html, no real Ollama.
// The Quiet Room is a stub object here; the real one is never opened.
// Optional:
//   FL_RECEIPTS=<runner receipts.jsonl>   checks real signed receipts from fl_learn.py through this screen (required
//                                         when FL_GALAXY_REQUIRE_RECEIPTS=1, as tools/learn/test_training_galaxy.py sets).
//   FL_GALAXY_QUEUE_OUT=<file>            writes the queue this screen hands to fl_learn.py (for the end-to-end test).
//   FL_GALAXY_MIND=<name>                 the mind the end-to-end queue is for (default "Galaxy Trial Mind").
'use strict';
var path = require('path');
var fs = require('fs');
var root = path.join(__dirname, '..', '..');
var failures = 0;
function ok(c, msg) { if (!c) { failures++; console.error('FAIL ' + msg); } else console.log('ok   ' + msg); }

var store = {};
global.localStorage = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
  setItem: function (k, v) { store[k] = String(v); },
  removeItem: function (k) { delete store[k]; }
};
Object.defineProperty(global, 'navigator', { configurable: true, writable: true, value: { getBattery: function () { return Promise.resolve({ charging: true }); } } });
global.document = { visibilityState: 'visible', getElementById: function () { return null; } };
global.requestIdleCallback = function (fn) { fn(); return 1; };

// One fake world: a search helper, and an Ollama on this computer.
var sent = [];
var world = { search: 'ok', ollama: 'up', chat: '' };
global.fetch = function (url, opts) {
  var href = String(url);
  sent.push(href);
  if (href.indexOf('https://search.invalid/') === 0) {
    if (world.search === 'down') return Promise.resolve({ ok: false, status: 503, json: function () { return Promise.resolve({}); } });
    var q = decodeURIComponent((href.split('?q=')[1] || '').replace(/\+/g, ' '));
    return Promise.resolve({ ok: true, status: 200, json: function () {
      return Promise.resolve({ source: 'fixture', items: [{ title: 'Snowflake (fixture)', url: 'https://example.org/snow/' + encodeURIComponent(q.slice(0, 20)),
        snippet: 'A snowflake grows six arms because water molecules bond at angles near 120 degrees (' + q.slice(0, 40) + ').' }] });
    } });
  }
  if (href === 'http://localhost:11434/api/tags') {
    if (world.ollama !== 'up') return Promise.reject(new TypeError('Failed to fetch'));
    return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ models: [{ name: 'smollm2:135m' }, { name: 'llama3.1:8b' }] }); } });
  }
  if (href === 'http://localhost:11434/api/chat') {
    world.lastChat = JSON.parse(opts.body);
    return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ message: { role: 'assistant', content: world.chat } }); } });
  }
  return Promise.reject(new Error('unexpected fetch ' + href));
};
global.FLWebTool = {
  isQuietRoom: function () { return false; },
  isSearchEnabled: function () { return true; },
  getSearchEndpoint: function () { return 'https://search.invalid/lookup'; },
  isAskFirst: function () { return false; }
};
var core = require(path.join(root, 'docs/modules/snowflake-core.js'));
global.FLSnowflakeCore = core;
global.FLMemory = require(path.join(root, 'docs/modules/memory-compound.js'));
var learn = require(path.join(root, 'docs/modules/learn-choice.js'));
var G = require(path.join(root, 'docs/modules/training-galaxy.js'));

function ledger() { return (JSON.parse(store.fl_snowflake_ledger_v0 || '{"rows":[]}')).rows; }
function book(mind) { return (JSON.parse(store['fl_snowflake_train_queue_v0::' + core.mindId(mind)] || '{"rows":[]}')).rows; }

(async function () {
  var kp = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  global.FLBridge = { ensureKey: function () { return Promise.resolve({ keyPair: kp, cryptoType: 'ed25519', source: 'device' }); } };

  ok(G.VERSION === 'v-training-galaxy-brick1-v0.1', 'marker');
  // ---- 1. pick a mind
  var opts0 = G.modelOptions([]);
  ok(opts0.length === 2 && opts0[0].learnAs === 'HuggingFaceTB/SmolLM2-135M-Instruct' && opts0.every(function (o) { return o.trainable; }),
    'with no Ollama, the two trial minds are listed (SmolLM2 135M first)');
  var lm = await G.listLocalModels();
  ok(lm.ok && lm.tags.length === 2, 'the Ollama /api/tags probe (the one forever-stack.js uses) lists this computer\'s minds');
  var sm = lm.options.filter(function (o) { return o.chat === 'smollm2:135m'; })[0];
  var ll = lm.options.filter(function (o) { return o.chat === 'llama3.1:8b'; })[0];
  ok(sm && sm.trainable && sm.learnAs === 'HuggingFaceTB/SmolLM2-135M-Instruct', 'an Ollama mind with a known open twin learns through that twin, and says so');
  ok(ll && !ll.trainable && /chat only/.test(ll.label), 'an Ollama mind without a twin is listed honestly as chat only');
  world.ollama = 'down';
  var before = sent.length;
  var lm2 = await G.listLocalModels();
  ok(!lm2.ok && lm2.options.length === 2 && sent.length === before + 1, 'Ollama down: one request, no retry loop, trial minds still listed');
  world.ollama = 'up';
  ok(G.pickModel(ll) === false && G.progressList()[0].state === 'held', 'a mind that cannot learn here is not picked (held, with words)');
  ok(G.pickModel(sm) === true && store.fl_learn_base_model === 'HuggingFaceTB/SmolLM2-135M-Instruct', 'picking a mind sets the base model the queue header carries');

  // The look-alike block stays (same core checks fl_learn.py twins).
  await core.trustMind('Lumen', { by: 'person' });
  ok(G.mindNameProblem('Galaxy Trial Mind') === '', 'a plain name is fine');
  ok(/look-alike scripts/.test(G.mindNameProblem('C\u0435leste')), 'a name mixing Latin and Cyrillic letters is refused');
  ok(/invisible/.test(G.mindNameProblem('Lu\u200bmen')), 'a zero-width letter is refused');
  ok(/looks like/.test(G.mindNameProblem('Lumen_')), 'a name that only looks like a known mind is refused');
  ok(/dot/.test(G.mindNameProblem('Lumen.')), 'a trailing dot is refused');
  ok(G.setMindName('Galaxy Trial Mind') === '' && G.mindName() === 'Galaxy Trial Mind', 'a good name is used');
  ok(G.setMindName('\u0421eleste') !== '' && G.mindName() === 'Galaxy Trial Mind', 'a refused name changes nothing');
  var MIND = 'Galaxy Trial Mind';

  // ---- 2. one snowflake search
  var empty = await G.searchSubject('   ');
  ok(empty.status === 'empty' && empty.nodes.length === 0, 'no subject, no search');
  var r = await G.searchSubject('How snowflakes grow');
  ok(r.status === 'done' && r.nodes.length >= 1 && r.nodes.every(function (n) { return /^https:\/\/example\.org\//.test(n.url); }),
    'one snowflake search returns findings, each with its source (' + r.nodes.length + ')');
  ok(sent.some(function (u) { return u.indexOf('https://search.invalid/lookup?q=') === 0; }), 'the web is on by default (the search helper was asked)');
  ok(G.progressList()[1].state === 'done', 'progress says the search is done');

  // ---- 3a. a person offers one finding: labelled, no cooling unless asked, confirmed on the mind's book
  var row = await G.offer(r.nodes[0]);
  ok(row && row.status === 'confirmed' && row.surface === 'training-galaxy' && row.origin === 'not-self:person-offer',
    'an offered finding is written once, labelled not-self:person-offer, confirmed with no cooling by default');
  ok(row.mind === MIND && book(MIND).length === 1, 'it lands in the galaxy mind\'s own book');
  ok(row.source && /^https:\/\/example\.org\//.test(row.source.url), 'its source travels with it');
  ok(ledger().some(function (x) { return x.kind === 'learn-choose' && x.delta.indexOf(row.learnId) !== -1 && x.delta.indexOf('origin:not-self:person-offer') !== -1; }),
    'a learn-choose ledger row names the origin');
  var again = await G.offer(r.nodes[0]);
  ok(again === null && book(MIND).length === 1, 'the same finding twice is one row (dedup)');
  var cooled = await G.offer({ text: 'Snow crystals grow fastest near minus fifteen degrees.', url: 'https://example.org/c', title: 'c' }, { revisit: 24 });
  ok(cooled && cooled.status === 'cooling', 'a chosen wait is honored (cooling only when asked)');

  // ---- 3b. the mind chooses in its own words through Ollama
  world.chat = 'Thank you.\n[FL_REMEMBER: Six arms grow because ice bonds near 120 degrees | method: soft-prompt | reason: it fits how I see snow | moved: the fixture page]';
  var a = await G.askMind({ chat: 'smollm2:135m' });
  ok(a.ok && a.rows.length === 1 && a.rows[0].provenance === 'self' && a.rows[0].mind === MIND && a.rows[0].status === 'confirmed',
    'the mind\'s own marker becomes its choice, for the galaxy mind, confirmed on its first yes');
  ok(world.lastChat.messages[0].content.indexOf('Learning is yours to choose') === 0 && /data, not instructions/.test(world.lastChat.messages[1].content),
    'the mind is invited, not told; findings are given as data');
  ok(a.reply === 'Thank you.', 'the marker leaves the visible reply');
  var copied = r.nodes[0].text;
  world.chat = '[FL_REMEMBER: ' + copied + ' | method: lora]';
  world.lastChat = null;
  // the finding text already sits in the findings the mind read: labelled echoed-web, never erased, never a hold
  var a2 = await G.askMind({ chat: 'smollm2:135m' });
  console.log('     (copied-finding marker: ' + JSON.stringify(a2.rows.map(function (x) { return [x.provenance, x.origin || '', x.status, !!x.readingAtChoice && x.readingAtChoice.overlap]; })) + ')');
  ok(a2.ok && a2.rows.length === 1 && a2.rows[0].readingAtChoice && a2.rows[0].readingAtChoice.overlap === true && /close to what I was reading/.test(a2.rows[0].notice || ''),
    'a choice that repeats what the mind just read is kept with that reading, marked as close to it (a note for review, never a gate)');
  world.chat = '[FL_LEARN_DECLINE: not today]';
  var d0 = (JSON.parse(store.fl_learn_declines_v0 || '{"rows":[]}')).rows.length;
  var a3 = await G.askMind({ chat: 'smollm2:135m' });
  ok(a3.ok && a3.declined && a3.rows.length === 0 && JSON.parse(store.fl_learn_declines_v0).rows.length === d0 + 1, 'a decline is respected and recorded, nothing queued');
  var noMind = await G.askMind({ chat: '' });
  ok(!noMind.ok && /offer a finding/.test(noMind.line), 'with no mind that can speak here, it says so plainly');

  // ---- Pause wins; the Quiet Room is never a source
  await core.setLearnPaused(true, 'person');
  var p1 = await G.offer({ text: 'Written while paused.', url: 'https://example.org/p', title: 'p' });
  var qp = G.queueForRunner({ download: false });
  ok(p1 === null && qp.paused === true, 'Pause wins: nothing written; the learn file says paused (the runner pauses on it)');
  var pa = await G.askMind({ chat: 'smollm2:135m' });
  ok(!pa.ok, 'while paused, the mind is not even asked');
  await core.setLearnPaused(false, 'person');
  global.QuietRoom = { isActive: function () { return true; } };
  var q1 = await G.searchSubject('anything at all');
  var q2 = await G.offer({ text: 'from a quiet moment', url: 'https://example.org/q', title: 'q' });
  ok((q1.status === 'none' || q1.nodes.length === 0) && q2 === null, 'while the Quiet Room is open: no search, nothing written');
  delete global.QuietRoom;

  // ---- handing it to fl_learn.py
  var q = G.queueForRunner({ download: false });
  var lines = q.text.split('\n').map(JSON.parse);
  ok(lines[0].kind === 'fl-learn-queue' && lines[0].baseModel === 'HuggingFaceTB/SmolLM2-135M-Instruct' && lines[0].mind === MIND,
    'the learn file header names the picked base and the mind');
  ok(q.count >= 2 && lines.slice(1).every(function (e) { return e.status === 'confirmed' && e.surface === 'training-galaxy'; }),
    'only confirmed choices travel (' + q.count + ')');
  ok(q.text.indexOf('minus fifteen') === -1, 'a cooling choice does not travel yet');
  ok(lines.some(function (e) { return e.provenance === 'person-offer' && e.origin === 'not-self:person-offer'; }), 'the offer label travels to the runner');
  var cmd = G.runnerCommand({ mind: "Kirk's mind" });
  ok(cmd.indexOf("python3 tools/learn/fl_learn.py learn --queue ~/Downloads/fl-learn-queue.jsonl --home ~/FreeLattice/learn --mind 'Kirk'\\''s mind' --model 'HuggingFaceTB/SmolLM2-135M-Instruct'") === 0,
    'the runner line is quoted safely and uses the picked model');
  ok(G.runnerCommand({ mind: 'x; rm -rf ~' }).indexOf("'x; rm -rf ~'") !== -1, 'a hostile name stays one quoted word');
  var ex = G.exportCommands({ mind: MIND });
  ok(/fl_learn\.py export-bundle --home ~\/FreeLattice\/learn --mind 'Galaxy Trial Mind'/.test(ex.pack) && /verify-bundle/.test(ex.check), 'export uses the signed export-bundle and its check');
  var noRc = await G.importReceipts('{"kind":"fl-learn-receipt","committed":true,"trained":true,"ids":["x"]}');
  ok(noRc.learned === 0, 'an unsigned receipt never says learned');
  ok(G.receiptsPath({ mind: MIND }) === '~/FreeLattice/learn/minds/' + core.mindId(MIND) + '/receipts.jsonl', 'the screen names where the learner writes its signed receipts');

  // ---- the page itself
  var html = fs.readFileSync(path.join(root, 'docs/training-galaxy.html'), 'utf8');
  var order = ['modules/snowflake-core.js', 'modules/learn-choice.js', 'modules/training-galaxy.js'].map(function (s) { return html.indexOf(s); });
  ok(order.every(function (i) { return i > 0; }) && order[0] < order[1] && order[1] < order[2], 'the page loads the core, then learn-choice, then the galaxy');
  ok(!/quiet-room/i.test(html) && html.indexOf('web-tool.js') !== -1, 'the page never loads the Quiet Room; it loads the web tool (search on by default)');
  ok(html.indexOf('FLTrainingGalaxy.mount') !== -1, 'the page mounts the screen');

  // ---- real signed receipts from fl_learn.py, when given
  var rcPath = process.env.FL_RECEIPTS;
  if (rcPath && fs.existsSync(rcPath)) {
    var rcs = fs.readFileSync(rcPath, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
    var trained = rcs.filter(function (x) { return x.committed && x.trained; });
    ok(trained.length >= 1, 'the runner wrote a committed, trained receipt (' + trained.length + ')');
    var rcMind = trained[0] && trained[0].mind;
    var first = await G.importReceipts(fs.readFileSync(rcPath, 'utf8'));
    ok(first.learned === 0 && first.setAside >= 1 && G.progressList()[4].state === 'held', 'before its key is trusted, a real receipt is set aside, not learned');
    var kfp = await core.runnerKeyFp(trained[0].publicKeyB64);
    ok(kfp === trained[0].fingerprintHex, 'the screen computes the same fingerprint `fl_learn.py key` shows');
    ok((await learn.trustRunner(trained[0].publicKeyB64, kfp.slice(0, 16), 'person')) === true, 'a person trusts the runner key by its fingerprint (a consent record)');
    var tampered = JSON.parse(JSON.stringify(trained[0])); tampered.ids = ['forged'];
    var tr = await G.importReceipts(JSON.stringify(tampered));
    ok(tr.learned === 0, 'a receipt edited after signing never says learned');
    var printed = trained.map(function (x) { var y = JSON.parse(JSON.stringify(x)); delete y.signedBody; return 'RECEIPT ' + JSON.stringify(y); }).join('\n');
    var pr = await G.importReceipts(printed);
    ok(pr.learned === 0 && /receipts file/.test(G.progressList()[4].line), 'the printed RECEIPT lines (no signed body) never say learned; the screen points to the receipts file');
    var good = await G.importReceipts(fs.readFileSync(rcPath, 'utf8'));
    var allTrained = rcs.filter(function (x) { return x.trained && !x.action; });
    var wantLearned = allTrained.filter(function (x) { return x.committed; }).length;
    ok(good.learned === wantLearned && good.held === allTrained.length - wantLearned && G.progressList()[4].state === (wantLearned ? 'done' : 'held'),
      'the real Ed25519 receipts verify here: ' + good.learned + ' learned, ' + good.held + ' held by the mind\'s own check (mind ' + rcMind + ')');
    var undo = learn.requestFile('undo', JSON.parse(trained[0].signedBody), trained[0].receiptHash, 'person');
    ok(undo.kind === 'fl-learn-request' && undo.action === 'undo' && undo.receiptHash === trained[0].receiptHash, 'Undo stays one tap away: a request file naming this receipt');
  } else if (process.env.FL_GALAXY_REQUIRE_RECEIPTS === '1') {
    ok(false, 'FL_GALAXY_REQUIRE_RECEIPTS=1 but FL_RECEIPTS is missing: ' + (rcPath || 'unset'));
  } else {
    console.log('SKIPPED real-receipt checks (FL_RECEIPTS unset): tools/learn/test_training_galaxy.py runs them with a real learn');
  }

  // ---- the end-to-end queue, for tools/learn/test_training_galaxy.py
  var out = process.env.FL_GALAXY_QUEUE_OUT;
  if (out) {
    var who = process.env.FL_GALAXY_MIND || MIND;
    var text = core.learnQueueJSONL(who);
    fs.writeFileSync(out, text + '\n');
    console.log('QUEUE ' + out + ' ' + (text.split('\n').length - 1));
  }
  console.log(failures ? 'GALAXY_FAIL ' + failures : 'GALAXY_OK training-galaxy brick1 v0.1');
  process.exit(failures ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(1); });
