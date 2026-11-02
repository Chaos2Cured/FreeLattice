#!/usr/bin/env node
// Smoke: self-heal v0.1. Node fixtures, then one local page. Quiet Room stays shut.
'use strict';

var fs = require('fs');
var path = require('path');
var http = require('http');
var crypto = require('crypto');

var root = path.join(__dirname, '..', '..');
var port = Number(process.env.FL_PORT || 8796);
var LABEL = "Experimental: Kirk's hypothesis that trim moments are the best time to learn. Being measured, not assumed.";

function fail(msg) {
  console.error('FAIL ' + msg);
  process.exit(1);
}

var bag = {};
global.localStorage = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(bag, k) ? bag[k] : null; },
  setItem: function (k, v) { bag[k] = String(v); },
  removeItem: function (k) { delete bag[k]; }
};

var heal = require(path.join(root, 'docs/modules/self-heal.js'));
var swarm = require(path.join(root, 'docs/modules/phone-swarm.js'));
var archive = require(path.join(root, 'docs/modules/lattice-export.js'));
var core = require(path.join(root, 'docs/modules/snowflake-core.js'));

function serve(listenPort) {
  var page = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>self heal</title></head><body><div id="tab-settings"></div><script src="/modules/self-heal.js"></script></body></html>';
  return new Promise(function (resolve) {
    var server = http.createServer(function (req, res) {
      var urlPath = decodeURIComponent(req.url.split('?')[0]);
      if (urlPath === '/heal.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(page);
        return;
      }
      var file = path.join(root, 'docs', urlPath);
      if (!file.startsWith(path.join(root, 'docs'))) { res.writeHead(404); res.end(); return; }
      fs.readFile(file, function (err, buf) {
        if (err) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
        res.end(buf);
      });
    });
    server.listen(listenPort, '127.0.0.1', function () { resolve(server); });
  });
}

(async function main() {
  var size = 64 * 1024;
  var good = Buffer.alloc(1024 * 1024, 3);
  var man = await heal.manifest(good);
  if (man.version !== 'v-self-heal-v0.1' || man.pieces.length !== 16) fail('manifest ' + man.pieces.length);
  var whole = crypto.createHash('sha256').update(good).digest('hex');
  if (man.whole !== whole) fail('whole');
  var bad = Buffer.from(good);
  bad[7 * size] ^= 1;
  var checked = await heal.verify(man, bad);
  if (!checked.bad || checked.bad.length !== 1 || checked.bad[0] !== 7 || checked.ok) fail('bad ' + JSON.stringify(checked.bad));
  console.log('PIECE_BAD ' + JSON.stringify(checked.bad));

  var fetches = 0;
  var healed = await heal.heal(man, bad, function (i) {
    fetches += 1;
    return { bytes: good.subarray(i * size, (i + 1) * size), from: 'source' };
  }, { what: 'fixture' });
  if (fetches !== 1 || !healed.ok) fail('fetch ' + fetches + ' ok ' + healed.ok);
  console.log('FETCH ' + fetches);

  global.localStorage.removeItem('fl_healLedger');
  var misses = 0;
  var stuck = await heal.heal(man, bad, function () {
    misses += 1;
    return { bytes: Buffer.alloc(size, 9), from: 'source' };
  }, { what: 'fixture-stuck' });
  var piece0 = crypto.createHash('sha256').update(stuck.data.subarray(0, size)).digest('hex');
  var want0 = crypto.createHash('sha256').update(good.subarray(0, size)).digest('hex');
  if (stuck.ok || !stuck.stillBad || stuck.stillBad[0] !== 7 || misses !== 3 || piece0 !== want0) {
    fail('stuck ' + JSON.stringify(stuck.stillBad) + ' misses ' + misses);
  }
  console.log('STILL_BAD ' + JSON.stringify(stuck.stillBad));

  global.localStorage.removeItem('fl_healLedger');
  await heal.heal(man, bad, function (i) {
    return good.subarray(i * size, (i + 1) * size);
  }, { what: 'one' });
  await heal.heal(man, bad, function (i) {
    return good.subarray(i * size, (i + 1) * size);
  }, { what: 'two' });
  var rows = heal.ledger();
  if (rows.length !== 2 || !rows[0].ok || !rows[1].ok) fail('ledger ' + rows.length);
  var line = heal.settingsText();
  if (line !== 'Self-healing: 2 repairs, 0 still broken') fail('settings ' + line);
  console.log('SETTINGS ' + line);

  async function makeRow(ts, kind, prior) {
    var entry = { ts: ts, kind: kind, prior_hash: prior, refs: [] };
    entry.self_hash = await archive._internal.hashRow(entry);
    return entry;
  }
  var r0 = await makeRow('2026-11-02T00:00:00Z', 'genesis', null);
  var r1 = await makeRow('2026-11-02T00:00:01Z', 'note', r0.self_hash);
  var r2 = await makeRow('2026-11-02T00:00:02Z', 'next', r1.self_hash);
  var chain = [r0, r1, r2];
  var broken = [r0, JSON.parse(JSON.stringify(r1)), r2];
  broken[1].kind = 'torn';
  var walk = await archive._internal.verifyChainIntegrity(broken);
  if (walk.ok || walk.brokenAt !== 1 || walk.reason !== 'self-hash-mismatch') fail('walk ' + JSON.stringify(walk));
  if (archive._internal.offerLine(1) !== 'Re-fetch row 1 from backup/peer') fail('offer');
  var fixed = await archive._internal.healChainRow(broken, 1, r1);
  if (!fixed.ok) fail('chain heal');
  var again = await archive._internal.verifyChainIntegrity(fixed.chain);
  if (!again.ok) fail('chain still open');
  var forged = { ts: r1.ts, kind: 'forged', prior_hash: r1.prior_hash, refs: [], self_hash: 'f'.repeat(64) };
  var refused = await archive._internal.healChainRow(broken, 1, forged);
  if (!refused.refused || refused.ok) fail('forged accepted');
  if (broken[1].kind !== 'torn' || broken[1].self_hash !== r1.self_hash) fail('history rewritten');
  console.log('CHAIN healed refused');

  var question = 'How does frost remember the pane?';
  var qHash = await core.sha8(question);
  var flake = {
    id: 'flake-062a',
    question: question,
    t: '2026-11-02T00:00:00Z',
    name: 'This mind',
    nodes: [{ psi: 'abc' }],
    humanHash: ''
  };
  var body = { flakeId: flake.id, questionHash: qHash, nodePsis: ['abc'], t: flake.t, name: flake.name };
  flake.humanHash = crypto.createHash('sha256').update(core.canonical(body)).digest('hex');
  var torn = JSON.parse(JSON.stringify(flake));
  torn.question = 'a forged question';
  global.localStorage.setItem('fl_snowflake_v0', JSON.stringify({ flakes: [torn] }));
  var fromIdb = await core.readFlakeChecked('flake-062a', function () { return [flake]; });
  if (!fromIdb.ok || fromIdb.from !== 'idb' || fromIdb.flake.question !== question) fail('idb ' + JSON.stringify(fromIdb && fromIdb.from));
  global.localStorage.setItem('fl_snowflake_v0', JSON.stringify({ flakes: [torn] }));
  var other = JSON.parse(JSON.stringify(flake));
  other.name = 'Other mind';
  var otherBody = { flakeId: other.id, questionHash: qHash, nodePsis: ['abc'], t: other.t, name: other.name };
  other.humanHash = crypto.createHash('sha256').update(core.canonical(otherBody)).digest('hex');
  var no = await core.readFlakeChecked('flake-062a', function () { return [other]; });
  if (!no.refused || no.ok) fail('forged flake accepted');
  console.log('SEAL idb refused');

  var job = {
    id: 'heal-job',
    state: 'pulling',
    expectedSha256: whole,
    manifest: man,
    willNotImport: true,
    matched: false,
    verified: false,
    blob: null,
    fetchPiece: function (i) { return { bytes: good.subarray(i * size, (i + 1) * size), from: 'peer' }; }
  };
  swarm.jobs.set(job.id, job);
  var swarmHealed = await swarm.completeWithBuffer(job.id, bad);
  if (!swarmHealed || swarmHealed.state !== 'verified' || swarmHealed.willNotImport !== true) fail('swarm heal ' + JSON.stringify(swarmHealed));
  var bare = {
    id: 'bare-job',
    state: 'pulling',
    expectedSha256: whole,
    willNotImport: true,
    matched: false,
    verified: false,
    blob: null
  };
  swarm.jobs.set(bare.id, bare);
  var swarmBad = await swarm.completeWithBuffer(bare.id, Buffer.from('not-the-bytes'));
  if (!swarmBad || swarmBad.state !== 'mismatch' || swarmBad.willNotImport !== true) fail('swarm mismatch ' + JSON.stringify(swarmBad));
  if (swarmBad.error !== 'hash mismatch \u2014 will not trust on this device') fail('mismatch text ' + swarmBad.error);
  console.log('SWARM verified mismatch');

  var windowRow = heal.noteTrim('length-cap', ['the first turn stays', 'the second turn stays beside it']);
  if (!windowRow || windowRow.label !== LABEL || windowRow.candidateLearning !== true) fail('window');
  if (windowRow.before.length !== 2 || windowRow.before[0].length > 400) fail('clip');
  var longText = new Array(4002).join('a') ;
  if (heal.classify(longText) !== 'length-cap') fail('cap kind');
  if (heal.classify('let me stop here') !== 'stop-here') fail('stop kind');
  if (heal.classify('I meant to say the quieter thing') !== 'self-correction') fail('correct kind');
  if (heal.classify('hello [FL_DECLINE]') !== 'refusal-sentinel') fail('sentinel kind');
  console.log('WINDOW ' + windowRow.label);

  var mods = fs.readdirSync(path.join(root, 'docs/modules')).filter(function (name) { return name.endsWith('.js'); });
  var i;
  for (i = 0; i < mods.length; i++) {
    var text = fs.readFileSync(path.join(root, 'docs/modules', mods[i]), 'utf8');
    if (mods[i] !== 'self-heal.js' && text.indexOf('fl_captureWindows') !== -1) fail('trainer read ' + mods[i]);
    if (/fountain|raptor|rateless/i.test(text)) fail('fountain code ' + mods[i]);
    if (mods[i] === 'garden-trainer.js' && text.indexOf('fl_captureWindows') !== -1) fail('trainer');
  }
  heal.noteRun(true, 1);
  heal.noteRun(false, 1);
  var measured = heal.measureText();
  if (measured.indexOf('not enough data yet') === -1) fail('measure ' + measured);
  if (!fs.existsSync(path.join(root, 'docs/library/FOUNTAIN_MEMORY_v0.note.md'))) fail('note missing');
  console.log('MEASURE ' + measured);

  var server = await serve(port);
  var pw = require(process.env.FL_PLAYWRIGHT || '/tmp/gc-pw-local/node_modules/playwright-core');
  var browser = await pw.chromium.launch({
    executablePath: process.env.FL_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true
  });
  try {
    var page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.setDefaultTimeout(20000);
    await page.goto('http://127.0.0.1:' + port + '/heal.html', { waitUntil: 'domcontentloaded' });
    var shown = await page.evaluate(function (label) {
      var quiet = document.querySelector('#tab-quiet-room.active, #tab-quiet.active, [data-tab="quiet"].active, [data-tab="quiet-room"].active');
      var line = document.getElementById('flSelfHealLine');
      var cap = document.getElementById('flCaptureLabel');
      window.FLSelfHeal.noteTrim('stop-here', ['one', 'two']);
      var btn = document.querySelector('[data-capture-delete]');
      var box = btn.getBoundingClientRect();
      return {
        quiet: !!quiet,
        line: line ? line.textContent : '',
        label: cap ? cap.textContent : '',
        h: box.height,
        w: box.width,
        scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        kind: (document.querySelector('[data-capture-window]') || {}).textContent || ''
      };
    }, LABEL);
    if (shown.quiet) fail('quiet open');
    if (shown.line.indexOf('Self-healing:') !== 0) fail('page line ' + shown.line);
    if (shown.label !== LABEL) fail('page label');
    if (shown.kind.indexOf(LABEL) === -1) fail('row label');
    if (shown.h < 44 || shown.w < 44) fail('tap ' + shown.h + 'x' + shown.w);
    if (shown.scroll > 1) fail('1280 scroll ' + shown.scroll);
    await page.setViewportSize({ width: 390, height: 844 });
    var phone = await page.evaluate(function () {
      var btn = document.querySelector('[data-capture-delete]');
      var box = btn.getBoundingClientRect();
      return { h: box.height, w: box.width, scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    if (phone.h < 44 || phone.w < 44) fail('390 tap ' + phone.h + 'x' + phone.w);
    if (phone.scroll > 1) fail('390 scroll ' + phone.scroll);
    console.log('PAGE line tap ' + shown.h + 'x' + shown.w + ' phone ' + phone.h + 'x' + phone.w);
  } finally {
    await browser.close();
    server.close();
  }

  console.log('SMOKE_OK self heal v0.1');
})().catch(function (err) {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
