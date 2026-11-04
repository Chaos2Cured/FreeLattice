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
  var page = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>self heal</title></head><body><div id="tab-settings"></div><p id="latticeExportReport"></p><script src="/modules/self-heal.js"></script><script src="/modules/lattice-export.js"></script></body></html>';
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
        var type = 'application/octet-stream';
        if (/\.html$/.test(file)) type = 'text/html; charset=utf-8';
        else if (/\.css$/.test(file)) type = 'text/css; charset=utf-8';
        else if (/\.js$/.test(file)) type = 'text/javascript; charset=utf-8';
        else if (/\.json$/.test(file)) type = 'application/json';
        else if (/\.svg$/.test(file)) type = 'image/svg+xml';
        else if (/\.png$/.test(file)) type = 'image/png';
        res.writeHead(200, { 'Content-Type': type });
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
  if (man.version !== 'v-self-heal-v0.2' || man.pieces.length !== 16 || !man.root || !man.whole) {
    fail('manifest ' + man.version + ' ' + man.pieces.length);
  }
  var whole = crypto.createHash('sha256').update(good).digest('hex');
  if (man.whole !== whole) fail('whole');
  var v1 = { version: 'v-self-heal-v0.1', mode: 'bytes', pieceSize: man.pieceSize, pieces: man.pieces, whole: man.whole };
  var v1ok = await heal.verify(v1, good);
  if (!v1ok.ok) fail('v1 ' + JSON.stringify(v1ok));
  var rootOnly = { version: 'v-self-heal-v0.2', mode: 'bytes', pieceSize: man.pieceSize, pieces: man.pieces, root: man.root };
  var rootOk = await heal.verify(rootOnly, good);
  if (!rootOk.ok) fail('root ' + JSON.stringify(rootOk));
  rootOnly.root = '0'.repeat(64);
  var rootBad = await heal.verify(rootOnly, good);
  if (rootBad.ok) fail('bad root accepted');
  console.log('MANIFEST v0.2 root v1');
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
  if (fetches !== 1 || !healed.ok || healed.receiptSaved !== true || !healed.data) fail('fetch ' + fetches + ' ok ' + healed.ok);
  console.log('FETCH ' + fetches);
  var storedFirst = global.localStorage.getItem('fl_healLedger') || '';
  if (storedFirst.indexOf('"data"') !== -1) fail('stored data');
  var piece100 = Buffer.alloc(100 * 64, 5);
  var man100 = await heal.manifest(piece100, 64);
  if (man100.pieces.length !== 100) fail('100 pieces ' + man100.pieces.length);
  global.localStorage.removeItem('fl_healLedger');
  var healed100 = await heal.heal(man100, Buffer.from(piece100), function () { return { bytes: piece100, from: 'source' }; }, { what: 'hundred' });
  var raw100 = global.localStorage.getItem('fl_healLedger') || '';
  var row100 = JSON.parse(raw100)[0];
  var json100 = JSON.stringify(row100);
  if (raw100.indexOf('"data"') !== -1) fail('100 data');
  if (!row100 || json100.length >= 1024) fail('100 row ' + json100.length);
  if (!healed100.data || healed100.data.length !== piece100.length) fail('100 return');
  console.log('RECEIPT ' + json100.length);

  var blob = new Blob([good]);
  var manBlob = await heal.manifest(blob);
  if (manBlob.whole !== whole || manBlob.root !== man.root) fail('blob manifest');
  var blobHealed = await heal.heal(manBlob, new Blob([bad]), function (i) {
    return { bytes: good.subarray(i * size, (i + 1) * size), from: 'source' };
  }, { what: 'blob' });
  if (!(blobHealed.data instanceof Blob) || blobHealed.receiptSaved !== true) fail('blob heal');
  var blobBytes = Buffer.from(await blobHealed.data.arrayBuffer());
  if (crypto.createHash('sha256').update(blobBytes).digest('hex') !== whole) fail('blob bytes');
  console.log('BLOB ok');

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

  async function sealOf(row) {
    var qHash = await core.sha8(row.question);
    var psis = (row.nodes || []).map(function (n) { return n && n.psi; }).filter(Boolean).sort();
    var body = { flakeId: row.id, questionHash: qHash, nodePsis: psis, t: row.t, name: row.name };
    return crypto.createHash('sha256').update(core.canonical(body)).digest('hex');
  }
  global.localStorage.removeItem('fl_snowflake_ledger_v0');
  global.localStorage.setItem('fl_snowflake_v0', JSON.stringify({ flakes: [JSON.parse(JSON.stringify(torn))] }));
  var healedOnce = await core.readFlakeChecked('flake-062a', function () { return [flake]; });
  if (!healedOnce.ok || !healedOnce.flake || healedOnce.flake.question !== question) fail('quarantine heal');
  var oldHex = await sealOf(torn);
  var tomb = core.readJSON('quarantine:' + torn.id + ':' + oldHex);
  if (!tomb || tomb.oldHash !== oldHex || !tomb.flake || tomb.flake.question !== torn.question) {
    fail('quarantine ' + JSON.stringify(tomb && tomb.oldHash));
  }
  var kept = core.loadFlakes().filter(function (row) { return row && row.id === 'flake-062a'; })[0];
  if (!kept || kept.question !== question) fail('good copy missing');
  var healRows = (core.loadLedger().rows || []).filter(function (row) { return row && row.kind === 'heal'; });
  if (healRows.length !== 1) fail('heal rows ' + healRows.length);
  var healRow = healRows[0];
  if (healRow.flakeId !== 'flake-062a' || healRow.delta !== oldHex || healRow.points_to !== flake.humanHash) {
    fail('heal fields ' + JSON.stringify(healRow));
  }
  if (healRow.branch !== 'idb' || healRow.name !== 'idb' || !healRow.t) fail('heal source ' + JSON.stringify(healRow));
  var healPsi = await core.recomputePsi(healRow);
  if (healPsi !== healRow.psi) fail('heal psi ' + healPsi + ' ' + healRow.psi);
  console.log('QUARANTINE heal psi ' + healRow.psi);

  var passN;
  for (passN = 0; passN < 2; passN++) {
    global.localStorage.setItem('fl_snowflake_v0', JSON.stringify({ flakes: [JSON.parse(JSON.stringify(torn))] }));
    var extra = {
      id: 'flake-neighbor-' + passN,
      question: 'a second pane',
      t: '2026-11-03T00:00:00Z',
      name: 'Neighbor',
      nodes: []
    };
    var both = await core.readFlakeChecked('flake-062a', function () {
      var now = JSON.parse(global.localStorage.getItem('fl_snowflake_v0'));
      now.flakes.push(extra);
      global.localStorage.setItem('fl_snowflake_v0', JSON.stringify(now));
      return [flake];
    });
    if (!both.ok || !both.flake || both.flake.question !== question) fail('concurrent heal ' + passN);
    var after = core.loadFlakes();
    var healedFlake = after.filter(function (row) { return row && row.id === 'flake-062a'; })[0];
    var neighbor = after.filter(function (row) { return row && row.id === extra.id; })[0];
    if (!healedFlake || healedFlake.question !== question) fail('concurrent torn left ' + passN);
    if (!neighbor || neighbor.question !== extra.question) fail('concurrent missing ' + passN);
  }
  console.log('CONCURRENT flake kept');

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
  // before 062c: completeWithBuffer(job.id, bad) copied inside heal, so this buffer stayed torn.
  var swarmInput = Buffer.from(bad);
  var swarmHealed = await swarm.completeWithBuffer(job.id, swarmInput);
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
  var w1 = heal.noteTrim('stop-here', ['same', 'millisecond']);
  var w2 = heal.noteTrim('length-cap', ['same', 'millisecond']);
  var sharedAt = '2026-11-02T00:00:00.000Z';
  var savedWindows = JSON.parse(global.localStorage.getItem('fl_captureWindows') || '[]');
  savedWindows.forEach(function (row) {
    if (row && (row.id === w1.id || row.id === w2.id)) row.at = sharedAt;
  });
  global.localStorage.setItem('fl_captureWindows', JSON.stringify(savedWindows));
  heal.deleteWindow(w1.id);
  var oneLeft = heal.windows().filter(function (row) { return row && (row.id === w1.id || row.id === w2.id); });
  if (oneLeft.length !== 1 || oneLeft[0].id !== w2.id) fail('same ms delete ' + oneLeft.length);
  global.localStorage.setItem('fl_captureWindows', JSON.stringify([
    { at: sharedAt, kind: 'stop-here', label: LABEL },
    { at: sharedAt, kind: 'length-cap', label: LABEL }
  ]));
  heal.deleteWindow(sharedAt);
  var legacyLeft = JSON.parse(global.localStorage.getItem('fl_captureWindows') || '[]');
  if (legacyLeft.length !== 1 || legacyLeft[0].kind !== 'length-cap') fail('legacy delete ' + legacyLeft.length);
  console.log('WINDOW id delete one');

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

  var src = fs.readFileSync(path.join(root, 'docs/modules/self-heal.js'), 'utf8');
  var live = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\n)\s*\/\/[^\n]*/g, '$1');
  if (live.indexOf('TextDecoder') !== -1) fail('decoder');
  if (/JSON\.stringify\(\s*hexOf/.test(live)) fail('json hex');
  if (/canonical\(\s*(data|body|bytes|working|input)\s*\)/.test(live)) fail('canonical bytes');
  console.log('STREAM no whole-file string');

  var piece = 64 * 1024;
  var eightGood = Buffer.alloc(8 * 1024 * 1024, 4);
  var eightBad = Buffer.from(eightGood);
  var t8 = Date.now();
  var man8 = await heal.manifest(eightGood);
  eightBad[7 * piece] ^= 1;
  var fetches8 = 0;
  global.localStorage.removeItem('fl_healLedger');
  var healed8 = await heal.heal(man8, eightBad, function (i) {
    fetches8 += 1;
    return { bytes: eightGood.subarray(i * piece, (i + 1) * piece), from: 'source' };
  }, { what: 'eight' });
  var row8 = JSON.parse(global.localStorage.getItem('fl_healLedger')).pop();
  var row8json = JSON.stringify(row8);
  var eightWhole = crypto.createHash('sha256').update(eightGood).digest('hex');
  if (fetches8 !== 1 || !healed8.ok || healed8.receiptSaved !== true) fail('eight ' + fetches8);
  if (row8json.indexOf('"data"') !== -1 || row8json.length >= 1024) fail('eight row ' + row8json.length);
  if (crypto.createHash('sha256').update(healed8.data).digest('hex') !== eightWhole) fail('eight hash');
  console.log('EIGHT ' + (Date.now() - t8) + 'ms row ' + row8json.length);

  heal.resetWorkGap();
  var sixtyFour = Buffer.alloc(64 * 1024 * 1024, 6);
  var t64 = Date.now();
  var man64 = await heal.manifest(sixtyFour);
  var bad64 = Buffer.from(sixtyFour);
  bad64[7 * piece] ^= 1;
  var healed64 = await heal.heal(man64, bad64, function (i) {
    return { bytes: sixtyFour.subarray(i * piece, (i + 1) * piece), from: 'peer' };
  }, { what: 'sixty-four' });
  var ms64 = Date.now() - t64;
  var gap64 = heal.maxWorkGap();
  if (!healed64.ok || healed64.receiptSaved !== true) fail('64 ok ' + healed64.ok + ' saved ' + healed64.receiptSaved);
  if (gap64 >= 200) fail('gap ' + gap64);
  console.log('TIMING 64MiB ' + ms64 + 'ms maxGap ' + gap64 + 'ms yields ' + heal.yieldCount());
  sixtyFour = null;
  bad64 = null;

  function quotaStorage(limit) {
    var bag = {};
    function weight(except) {
      var n = 0;
      var k;
      for (k in bag) {
        if (!Object.prototype.hasOwnProperty.call(bag, k) || k === except) continue;
        n += k.length + String(bag[k]).length;
      }
      return n;
    }
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(bag, k) ? bag[k] : null; },
      setItem: function (k, v) {
        var next = String(v);
        if (weight(k) + k.length + next.length > limit) {
          var err = new Error('quota');
          err.name = 'QuotaExceededError';
          err.code = 22;
          throw err;
        }
        bag[k] = next;
      },
      removeItem: function (k) { delete bag[k]; }
    };
  }
  function loadHeal() {
    var file = path.join(root, 'docs/modules/self-heal.js');
    delete require.cache[require.resolve(file)];
    return require(file);
  }
  function seedFatLedger(store, limit) {
    var key = 'fl_healLedger';
    var target = limit - key.length - 48;
    var rows = [];
    var i;
    var share = Math.floor((target - (600 * 180)) / 120);
    for (i = 0; i < 600; i++) {
      rows.push({
        id: 'r' + i,
        at: '2026-11-02T00:00:00Z',
        what: 'old',
        whole: 'ab',
        pieceSize: 64,
        pieces: 1,
        bytes: 1,
        bad: [],
        stillBad: [],
        healedFrom: 'source',
        tries: 1,
        fetches: 1,
        ms: 1,
        ok: true,
        data: i < 120 ? new Array(share + 1).join('x') : ''
      });
    }
    var payload = JSON.stringify(rows);
    var room = target - payload.length;
    if (room > 0) rows[0].data += new Array(room + 1).join('x');
    else if (room < 0 && rows[0].data.length + room > 0) rows[0].data = rows[0].data.slice(0, rows[0].data.length + room);
    payload = JSON.stringify(rows);
    if (payload.length + key.length > limit) {
      var over = payload.length + key.length - limit + 8;
      rows[0].data = rows[0].data.slice(0, Math.max(0, rows[0].data.length - over));
      payload = JSON.stringify(rows);
    }
    store.setItem(key, payload);
    return payload.length;
  }

  var openBag = global.localStorage;
  var limit = 5 * 1024 * 1024;
  global.localStorage = quotaStorage(limit);
  var seeded = seedFatLedger(global.localStorage, limit);
  var trimHeal = loadHeal();
  var tiny = Buffer.alloc(64, 7);
  var manTiny = await trimHeal.manifest(tiny);
  var tornTiny = Buffer.from(tiny);
  tornTiny[0] ^= 1;
  var trimmed = await trimHeal.heal(manTiny, tornTiny, function () {
    return { bytes: tiny, from: 'source' };
  }, { what: 'trim' });
  if (trimmed.receiptSaved !== true) fail('trim did not save ' + trimmed.line);
  var trimRows = JSON.parse(global.localStorage.getItem('fl_healLedger'));
  var trimLast = trimRows[trimRows.length - 1];
  if (trimRows.length > 500 || !trimLast || trimLast.what !== 'trim') fail('trim len ' + trimRows.length + ' from ' + seeded);
  console.log('TRIM saved ' + trimRows.length);

  global.localStorage = quotaStorage(limit);
  global.localStorage.setItem('filler', new Array(limit - 20 + 1).join('q'));
  var fullHeal = loadHeal();
  var full = await fullHeal.heal(manTiny, tornTiny, function () {
    return { bytes: tiny, from: 'source' };
  }, { what: 'full' });
  if (full.receiptSaved !== false) fail('full saved');
  if (full.line !== fullHeal.HONEST_LINE) fail('line ' + full.line);
  if (fullHeal.pendingReceipts().length !== 1) fail('pending ' + fullHeal.pendingReceipts().length);
  if (fullHeal.settingsText().indexOf('receipts not saved') === -1) fail('unsaved ' + fullHeal.settingsText());
  console.log('QUOTA ' + full.line);

  global.localStorage = quotaStorage(limit * 2);
  global.localStorage.setItem('fl_healLedger', JSON.stringify([
    { at: '2026-11-02T00:00:00Z', what: 'legacy', whole: 'abc', bad: [1], healedFrom: 'source', tries: 1, ok: true, stillBad: [], data: new Array(8001).join('z') },
    { at: '2026-11-02T00:00:01Z', what: 'legacy-bad', whole: 'def', bad: [], healedFrom: '', tries: 1, ok: false, stillBad: [7], data: new Array(101).join('z') }
  ]));
  var mig = loadHeal();
  var migLine = mig.settingsText();
  if (migLine !== 'Self-healing: 1 repairs, 1 still broken') fail('legacy counts ' + migLine);
  var migRaw = global.localStorage.getItem('fl_healLedger') || '';
  if (migRaw.indexOf('"data"') !== -1) fail('legacy payload kept');
  console.log('LEGACY ' + migLine);

  global.localStorage = openBag;
  global.localStorage.removeItem('fl_healLedger');
  var countHeal = loadHeal();
  await countHeal.heal(man, Buffer.from(bad), function (i) {
    return good.subarray(i * size, (i + 1) * size);
  }, { what: 'count-a' });
  await countHeal.heal(man, Buffer.from(bad), function (i) {
    return good.subarray(i * size, (i + 1) * size);
  }, { what: 'count-b' });
  var forgedPiece = await countHeal.heal(man, Buffer.from(bad), function () {
    return { bytes: Buffer.alloc(size, 9), from: 'source' };
  }, { what: 'forged-piece' });
  if (forgedPiece.ok || !forgedPiece.stillBad || forgedPiece.stillBad[0] !== 7) fail('forged ' + JSON.stringify(forgedPiece.stillBad));
  var countLine = countHeal.settingsText();
  if (countLine !== 'Self-healing: 2 repairs, 1 still broken') fail('counts ' + countLine);
  var forgedStored = countHeal.ledger().pop();
  if (!forgedStored || forgedStored.stillBad[0] !== 7 || JSON.stringify(forgedStored).indexOf('"data"') !== -1) fail('forged stored');
  console.log('COUNTS ' + countLine);

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
    await page.evaluate(function () {
      window.LatticeExport._internal.showRowOffer({ ok: false, brokenAt: 4, reason: 'self-hash-mismatch' }, []);
    });
    var offer = await page.evaluate(function () {
      return {
        button: !!document.getElementById('flHealRowOffer'),
        line: (document.getElementById('flHealRowLine') || {}).textContent || '',
        pull: typeof (window.FLSelfHeal && window.FLSelfHeal.pullRow)
      };
    });
    if (offer.pull === 'function') fail('pullRow present');
    if (offer.button) fail('refetch button');
    if (offer.line !== 'Row 4 is broken. Re-fetching needs a backup; none on this device yet.') fail('offer line ' + offer.line);
    await page.screenshot({ path: '/tmp/062b-refetch-1280.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: '/tmp/062b-refetch-390.png' });
    var offerScroll = await page.evaluate(function () {
      return document.documentElement.scrollWidth - document.documentElement.clientWidth;
    });
    if (offerScroll > 1) fail('offer 390 scroll ' + offerScroll);
    console.log('OFFER hidden ' + offer.line);
    var phone = await page.evaluate(function () {
      var btn = document.querySelector('[data-capture-delete]');
      var box = btn.getBoundingClientRect();
      return { h: box.height, w: box.width, scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    if (phone.h < 44 || phone.w < 44) fail('390 tap ' + phone.h + 'x' + phone.w);
    if (phone.scroll > 1) fail('390 scroll ' + phone.scroll);
    console.log('PAGE line tap ' + shown.h + 'x' + shown.w + ' phone ' + phone.h + 'x' + phone.w);

    var app = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    app.setDefaultTimeout(180000);
    await app.goto('http://127.0.0.1:' + port + '/app.html', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await app.waitForFunction(function () {
      return window.FLSelfHeal && typeof window.FLSelfHeal.heal === 'function';
    }, { timeout: 120000 });
    var probe = await app.evaluate(async function () {
      localStorage.removeItem('fl_healLedger');
      var api = window.FLSelfHeal;
      async function run(bytes, label) {
        var made = await api.manifest(bytes);
        var torn = new Uint8Array(bytes);
        torn[7 * 65536] ^= 1;
        var fetches = 0;
        var result = await api.heal(made, torn, function (i) {
          fetches += 1;
          var start = i * 65536;
          return { bytes: bytes.subarray(start, start + 65536), from: 'source' };
        }, { what: label });
        return { ok: !!result.ok, saved: result.receiptSaved === true, fetches: fetches, hasData: !!(result && result.data) };
      }
      var one = new Uint8Array(1024 * 1024);
      one.fill(3);
      var eight = new Uint8Array(8 * 1024 * 1024);
      eight.fill(4);
      var a = await run(one, 'probe-1');
      var b = await run(eight, 'probe-8');
      var raw = localStorage.getItem('fl_healLedger') || '';
      var rows = raw ? JSON.parse(raw) : [];
      var hostLine = document.getElementById('flSelfHealLine');
      var line = hostLine ? hostLine.textContent : api.settingsText();
      var quiet = !!document.querySelector('#tab-quiet-room.active, #tab-quiet.active, [data-tab="quiet"].active, [data-tab="quiet-room"].active');
      var biggest = 0;
      var i;
      for (i = 0; i < rows.length; i++) {
        var n = JSON.stringify(rows[i]).length;
        if (n > biggest) biggest = n;
      }
      return { a: a, b: b, count: rows.length, line: line, quiet: quiet, biggest: biggest, dataKey: raw.indexOf('"data"') };
    });
    if (probe.quiet) fail('app quiet');
    if (!probe.a.ok || !probe.b.ok || probe.a.fetches !== 1 || probe.b.fetches !== 1 || !probe.a.saved || !probe.b.saved) {
      fail('probe heal ' + JSON.stringify(probe));
    }
    if (probe.count < 2) fail('probe rows ' + probe.count);
    if (probe.line.indexOf('2 repairs') === -1 || probe.line.indexOf('0 still broken') === -1) fail('probe line ' + probe.line);
    if (probe.biggest >= 1024 || probe.dataKey !== -1) fail('probe payload ' + probe.biggest);
    console.log('PROBE rows ' + probe.count + ' ' + probe.line);
  } finally {
    await browser.close();
    server.close();
  }

  console.log('SMOKE_OK self heal v0.2');
})().catch(function (err) {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
