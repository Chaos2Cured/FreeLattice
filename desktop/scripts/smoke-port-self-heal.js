// smoke-port-self-heal.js (MIT) v-port-self-heal-v0.1
// Node only. The door stays inside 11435..11445. 11434 is never ours.
var fs = require('fs');
var path = require('path');
var os = require('os');
var net = require('net');
var http = require('http');
var vm = require('vm');
var crypto = require('crypto');
var assert = require('assert');

var root = path.join(__dirname, '..', '..');
var heal = require(path.join(__dirname, '..', 'port-heal.js'));
var core = require(path.join(root, 'bridge', 'proxy-core.js'));
var discover = require(path.join(__dirname, '..', 'lattice-discover.js'));

function md5(file) {
  return crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
}
var locks = {
  'docs/modules/fl-connect.js': 'aaff2bf1b037656989a9e1a89bb05908',
  'docs/modules/pool-knock.js': 'a0a72caad82c8e5cc34818d5e59eba2b',
  'docs/modules/fl-bridge.js': '826dc6806c775f0348e5ec4fcd452fb4',
  'docs/Flint.html': '44be124b1183b7d9d060a58632464eff',
  'desktop/lattice-discover.js': '16de366e01cecc8dd505290a8d2f0e14',
  'desktop/lattice-update.js': '2c0f66569dd8ce27ef5dc0d3b80daf0a',
  'desktop/pack-update.js': 'bc996ccd48ea53e4442f2b8f54ab9491',
  'desktop/pack-update-card.js': 'c14e04c53025eb542ebd627b6a19d60a',
  'sw.js': '91726cf2228b794f7585f79f61418d12',
  'docs/sw.js': '91726cf2228b794f7585f79f61418d12'
};
Object.keys(locks).forEach(function (rel) {
  assert.strictEqual(md5(path.join(root, rel)), locks[rel], rel + ' stays locked');
});

var healSrc = fs.readFileSync(path.join(__dirname, '..', 'port-heal.js'), 'utf8');
assert.ok(healSrc.indexOf('v-port-self-heal-v0.1') !== -1, 'marker');
assert.ok(!/setInterval|setTimeout/.test(healSrc), 'no background timer');
assert.ok(healSrc.indexOf('\u2014') === -1, 'no em dash');
assert.ok(healSrc.indexOf('inner' + 'HTML') === -1, 'text only');
assert.ok(healSrc.indexOf('conf' + 'irm(') === -1, 'no confirm');
assert.ok(!/process\.kill|SIGTERM|SIGKILL/.test(healSrc), 'never signals another process');

var mainSrc = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
assert.ok(mainSrc.indexOf('startPort + 1') === -1, 'the app server no longer climbs without a bound');
assert.ok(mainSrc.indexOf('portHeal.appCandidates') !== -1, 'the app server uses the bounded list');
assert.ok(mainSrc.indexOf('portHeal.wrapDiscover') !== -1, 'discover hooks are wrapped after create');
var proxySrc = fs.readFileSync(path.join(root, 'bridge', 'proxy-core.js'), 'utf8');
assert.ok(!/i < 40/.test(proxySrc), 'the bridge no longer climbs forty ports');
assert.ok(proxySrc.indexOf('portHeal.pickFirstFree') !== -1, 'the bridge uses the bounded picker');

var door = heal.doorPorts();
assert.deepStrictEqual(door, [11435, 11436, 11437, 11438, 11439, 11440, 11441, 11442, 11443, 11444, 11445], 'door list');
assert.ok(door.indexOf(11434) === -1, '11434 is not a door');
assert.ok(heal.bridgeCandidates(11434).indexOf(11434) === -1, 'asking for 11434 does not choose it');
assert.ok(Math.max.apply(null, heal.bridgeCandidates(11435)) === 11445, 'the door stops at 11445');
var app = heal.appCandidates(45678);
assert.strictEqual(app[0], 45678, 'the app server keeps its own start');
assert.strictEqual(app[app.length - 1], 45688, 'the app server stops at start+10');
assert.ok(app.indexOf(11434) === -1 && app.indexOf(45689) === -1, 'the app server does not climb past its range');
var near = heal.appCandidates(11430);
assert.ok(near.indexOf(11434) === -1, 'a walk that would cross 11434 skips it');
assert.ok(Math.max.apply(null, near) <= 11440, 'that walk stays inside start..start+10');
assert.ok(heal.appCandidates(11434).indexOf(11434) === -1, 'an app start of 11434 is never chosen');
assert.ok(Math.max.apply(null, heal.appCandidates(11434)) <= 11445, 'an app start inside the band does not leave it');

function listen(port) {
  return new Promise(function (resolve, reject) {
    var server = net.createServer();
    server.once('error', reject);
    server.listen(port, '127.0.0.1', function () { resolve(server); });
  });
}
function close(server) {
  return new Promise(function (resolve) {
    if (!server) { resolve(); return; }
    server.close(function () { resolve(); });
  });
}
function holds() {
  var list = [];
  return {
    add: function (s) { list.push(s); },
    stop: async function () {
      while (list.length) await close(list.pop());
    }
  };
}

(async function () {
  var bag = holds();
  try {
    var seen = [];
    await heal.pickFirstFree([11434, 11436], async function (p) {
      seen.push(p);
      return p === 11436;
    }).then(function (got) {
      assert.strictEqual(got, 11436, '11434 listed first is never chosen');
      assert.ok(seen.indexOf(11434) === -1, '11434 is never asked');
    });

    var heldDefault = null;
    try { heldDefault = await listen(11435); bag.add(heldDefault); }
    catch (e) { heldDefault = null; }
    var moved = await core.findFreePort(11435);
    assert.ok(moved >= 11436 && moved <= 11445, 'with 11435 held, the bridge takes the next door ' + moved);
    assert.notStrictEqual(moved, 11434, 'the bridge never takes 11434');

    var full = holds();
    try {
      for (var i = 0; i < door.length; i++) {
        try { full.add(await listen(door[i])); } catch (e2) {}
      }
      var climbed = [];
      var busy = null;
      try {
        await heal.pickFirstFree(heal.bridgeCandidates(11435), async function (p) {
          climbed.push(p);
          return false;
        });
      } catch (err) { busy = err; }
      assert.ok(busy && busy.message === heal.BUSY_LINE, 'every door busy says so plainly');
      assert.ok(climbed.every(function (p) { return p >= 11435 && p <= 11445; }), 'no bind above 11445');
      assert.ok(climbed.indexOf(11434) === -1, 'the busy walk never touches 11434');
      var bridgeBusy = null;
      try { await core.findFreePort(11435); } catch (err2) { bridgeBusy = err2; }
      assert.ok(bridgeBusy && bridgeBusy.message === heal.BUSY_LINE, 'the bridge says the door is busy');
    } finally {
      await full.stop();
    }

    var tried = [];
    var appBusy = null;
    try {
      await heal.pickFirstFree(heal.appCandidates(45678), async function (p) {
        tried.push(p);
        return false;
      });
    } catch (err3) { appBusy = err3; }
    assert.ok(appBusy && appBusy.message === heal.BUSY_LINE, 'a full app range says the door line');
    assert.deepStrictEqual(tried, heal.appCandidates(45678), 'the app server tries only its range');
    assert.ok(tried.indexOf(45689) === -1 && tried.indexOf(11434) === -1, 'the app server never climbs past the range');

    var freeDoor = [];
    for (var d = 0; d < door.length; d++) {
      var up = true;
      var probe = null;
      try { probe = await listen(door[d]); } catch (e3) { up = false; }
      if (probe) await close(probe);
      if (up) freeDoor.push(door[d]);
    }
    assert.ok(freeDoor.length >= 2, 'the room has two free door ports for the fallback');
    var preferred = freeDoor[0];
    var holder = await listen(preferred);
    bag.add(holder);
    var freeMap = {};
    freeMap[preferred] = false;
    for (var f = 0; f < freeDoor.length; f++) if (freeDoor[f] !== preferred) freeMap[freeDoor[f]] = true;

    var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fl-port-heal-'));
    fs.writeFileSync(path.join(tmp, 'port.json'), JSON.stringify({ port: preferred }));
    var published = [];
    var sent = [];
    var receipts = [];
    var deps = {
      storeDir: tmp,
      smokeLoopback: true,
      appOrigin: function () { return 'http://127.0.0.1:1'; },
      mdns: function () {
        return { publish: function (o) { published.push(o); return { stop: function () {} }; }, destroy: function () {} };
      },
      ask: async function () { return 'no'; },
      answerOffer: async function () { return ''; },
      autoOffMs: 60000
    };
    var doorApi = discover.createDiscover(deps);
    heal.wrapDiscover(deps, {
      isFree: function (p) { return !!freeMap[p]; },
      kin: [
        { fp: 'trustedphone', trusted: true },
        { fp: 'strangerphone', trusted: false }
      ],
      sign: function (payload) {
        assert.ok(String(payload).indexOf(heal.KIN_DOMAIN) === 0, 'the note is signed over the kin domain');
        return 'signed';
      },
      deliver: function (fp, note) { sent.push({ fp: fp, note: note }); },
      receipt: function (row) { receipts.push(row); }
    });
    var beforeTimers = process._getActiveHandles ? process._getActiveHandles().length : 0;
    var st = await doorApi.on('abcdef0123456789');
    assert.ok(st.ok && st.port >= 11435 && st.port <= 11445, 'fallback stays on a door port ' + st.port);
    assert.notStrictEqual(st.port, preferred, 'a busy preferred port is not the one we keep');
    assert.notStrictEqual(st.port, 11434, 'discover never keeps 11434');
    var saved = JSON.parse(fs.readFileSync(path.join(tmp, 'port.json'), 'utf8'));
    assert.strictEqual(saved.port, st.port, 'onBound saves the new port');
    assert.ok(published.length >= 1, 'mDNS announced');
    assert.strictEqual(String(published[0].txt.port), String(st.port), 'mDNS txt port matches');
    assert.strictEqual(sent.length, 1, 'one trusted kin gets the note');
    assert.strictEqual(sent[0].fp, 'trustedphone', 'the note went to the trusted kin');
    assert.strictEqual(sent[0].note.kind, 'fl-mind-card', 'kin card shape');
    assert.strictEqual(sent[0].note.name, 'door', 'the note names the door');
    assert.strictEqual(sent[0].note.model, String(st.port), 'the trusted note carries the port');
    assert.strictEqual(sent[0].note.signature, 'signed', 'the note is signed');
    assert.ok(!sent.some(function (row) { return row.fp === 'strangerphone'; }), 'a stranger gets nothing');
    assert.strictEqual(receipts.length, 1, 'one receipt');
    assert.deepStrictEqual(receipts[0], { event: 'port', count: 1 }, 'the receipt is a count');
    assert.ok(JSON.stringify(receipts[0]).indexOf(String(st.port)) === -1, 'the receipt does not carry the port');
    var afterTimers = process._getActiveHandles ? process._getActiveHandles().length : 0;
    assert.ok(afterTimers >= beforeTimers, 'start did not need a poll timer of ours');
    doorApi.off('smoke');

    var movedPort = st.port;
    var connectSrc = fs.readFileSync(path.join(root, 'docs/modules/fl-connect.js'), 'utf8');
    assert.strictEqual(md5(path.join(root, 'docs/modules/fl-connect.js')), locks['docs/modules/fl-connect.js'], 'fl-connect bytes unchanged');
    var box = { fl_bridgePort: String(preferred) };
    var sandbox = {
      console: console,
      setTimeout: setTimeout,
      clearTimeout: clearTimeout,
      AbortSignal: AbortSignal,
      location: { hostname: '127.0.0.1' },
      localStorage: {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(box, k) ? box[k] : null; },
        setItem: function (k, v) { box[k] = String(v); },
        removeItem: function (k) { delete box[k]; }
      },
      document: {
        getElementById: function () { return null; },
        createElement: function () { return { textContent: '', appendChild: function () {}, setAttribute: function () {} }; },
        documentElement: { getAttribute: function () { return null; } },
        addEventListener: function () {},
        body: { classList: { add: function () {}, remove: function () {} } },
        head: { appendChild: function () {} }
      },
      fetch: async function (url) {
        var u = String(url);
        var m = u.match(/127\.0\.0\.1:(\d+)/);
        var port = m ? Number(m[1]) : 0;
        if (u.indexOf('/bridge/health') !== -1 && port === movedPort) {
          return { ok: true, json: async function () { return { bridge: true, port: movedPort }; } };
        }
        throw new Error('closed');
      }
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.runInNewContext(connectSrc, sandbox, { filename: 'fl-connect.js' });
    var report = await sandbox.FlConnect.probe({ fullScan: true });
    assert.strictEqual(report.port, movedPort, 'reconnect scan finds the moved port');
    assert.strictEqual(md5(path.join(root, 'docs/modules/fl-connect.js')), locks['docs/modules/fl-connect.js'], 'locked md5 still unchanged');
    if (sandbox.FlConnect.stopLoop) sandbox.FlConnect.stopLoop();
  } finally {
    await bag.stop();
  }
  console.log('SMOKE_OK port self heal v0.1');
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
