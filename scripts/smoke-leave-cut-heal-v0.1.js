// smoke-leave-cut-heal-v0.1.js (MIT)
// Leave cut heal v0.1. The cut follows the other device's role.
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var crypto = require('crypto');
var assert = require('assert');

var rootDir = path.join(__dirname, '..');
var MARK = 'SECRETWORD045C';

function mem() {
  var s = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(s, k) ? s[k] : null; },
    setItem: function (k, v) { s[k] = String(v); },
    removeItem: function (k) { delete s[k]; }
  };
}
function load(storage, modes, peers) {
  modes = modes || {};
  var book = peers || [];
  var sandbox = {
    localStorage: storage,
    sessionStorage: mem(),
    document: {
      readyState: 'loading',
      addEventListener: function () {},
      getElementById: function () { return null; },
      createElement: function () { return { style: {} }; },
      head: null
    },
    TreePool: {
      mode: function () { return modes.tree || 'kin'; },
      letHelp: function () { modes.tree = 'kin'; return true; },
      emitShrink: function (id) { sandbox._shrinkPeers.push(id); },
      peers: function () { return book.map(function (p) { return { id: p.id, helping: p.helping === true, state: 'proved' }; }); },
      markNotHelping: function (id) {
        sandbox._marked.push(id);
        book.forEach(function (p) { if (p.id === id) p.helping = false; });
        return true;
      },
      disconnect: function (id) { sandbox._disc.push(id); }
    },
    FLShareDoor: {
      mode: function () { return modes.door || 'off'; },
      setMode: function (m) { modes.door = m; return true; }
    },
    FLPool: {
      helping: function () { return modes.pool === true; },
      letHelp: function () { modes.pool = true; return { ok: true }; },
      _peers: function () { return sandbox._flPeers; }
    },
    state: { meshInference: false, meshPeerId: '' },
    _shrinkPeers: [],
    _disc: [],
    _marked: [],
    _flPeers: {},
    _book: book
  };
  sandbox.window = sandbox;
  var code = fs.readFileSync(path.join(rootDir, 'docs/modules/pool-honest-label.js'), 'utf8');
  vm.runInNewContext(code, sandbox, { filename: 'pool-honest-label.js' });
  sandbox._setBook = function (next) { book = next; sandbox._book = book; };
  return sandbox;
}
function sends(box, peerId, text) {
  var H = box.FLPoolHonest;
  var peers = box.TreePool.peers();
  var hit = null;
  peers.forEach(function (p) {
    if (p.id === peerId && p.helping && !H.peerBlocked(p.id, H.activeChat())) hit = p;
  });
  if (!hit) return [];
  if (!H.permit('askTurns', { chatId: H.activeChat(), peer: { id: hit.id, name: 'Ada' } })) return [];
  return [JSON.stringify({ type: 'ask', v: 1, messages: [{ role: 'user', content: text }] })];
}
function md5(file) {
  return crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
}
function noBad(text, name) {
  assert.strictEqual(text.indexOf('\u2014'), -1, name + ' em dash');
  assert.strictEqual(text.indexOf('&mdash;'), -1, name + ' mdash');
  assert.ok(!/\binnerHTML\b/.test(text), name + ' innerHTML');
  assert.ok(!/\beval\s*\(/.test(text), name + ' eval');
  assert.ok(!/\bconfirm\s*\(/.test(text), name + ' confirm');
  assert.ok(!/new Function/.test(text), name + ' Function');
}
function addedLines(file) {
  return fs.readFileSync(file, 'utf8').split('\n').filter(function (line) {
    return line.indexOf('045c') !== -1 || line.indexOf('v-leave-cut-heal-v0.1') !== -1 || line.indexOf('peerWasOurHelper') !== -1 || line.indexOf('settingsHostsLeave') !== -1 || line.indexOf('markNotHelping') !== -1;
  }).join('\n');
}

var honestPath = path.join(rootDir, 'docs/modules/pool-honest-label.js');
var honest = fs.readFileSync(honestPath, 'utf8');
assert.ok(honest.indexOf("var VERSION = 'v-pool-honest-label-v0.1';") !== -1, 'version pin stays');
assert.ok(honest.indexOf('v-leave-cut-heal-v0.1') !== -1);
assert.ok(honest.indexOf('before 045c:') !== -1);
assert.ok(honest.indexOf('if (helperLeft() && !settingsHostsLeave)') !== -1, 'one left line on Settings');
assert.ok(honest.indexOf('if (showLeave(chatId) && !settingsHostsLeave)') !== -1, 'one Leave on Settings');
noBad(addedLines(honestPath), 'honest added');
noBad(addedLines(path.join(rootDir, 'docs/modules/tree-pool.js')), 'tree-pool added');
assert.ok(fs.readFileSync(path.join(rootDir, 'docs/modules/tree-pool.js'), 'utf8').indexOf('markNotHelping: markNotHelping') !== -1);

// (a) both helping. Ada leaves. Kirk's next message does not ask her, and the marker is not in a payload.
var both = load(mem(), { tree: 'kin' }, [{ id: 'ada', helping: true }]);
var HB = both.FLPoolHonest;
HB.setActive('tree-thread');
HB.helperHeardShrink('ada');
assert.strictEqual(HB.peerBlocked('ada', 'tree-thread'), true, 'asker cuts the helper who left');
assert.strictEqual(JSON.stringify(both._marked), JSON.stringify(['ada']), 'her hello is marked not helping');
assert.strictEqual(both.TreePool.peers()[0].helping, false);
var payloads = sends(both, 'ada', MARK);
assert.strictEqual(payloads.length, 0, '0 asks to Ada');
assert.strictEqual(JSON.stringify(payloads).indexOf(MARK), -1, 'marker never leaves');

// (b) Kirk is not helping. Ada leaves. The cut is written and nothing is sent.
var asking = load(mem(), { tree: 'off' }, [{ id: 'ada', helping: true }]);
var HA = asking.FLPoolHonest;
HA.setActive('tree-thread');
HA.helperHeardShrink('ada');
assert.strictEqual(HA.peerBlocked('ada', 'tree-thread'), true, 'control cut');
assert.strictEqual(sends(asking, 'ada', MARK).length, 0, '0 sends after the control cut');

// (c) Kirk cuts a helping Ada, and Kirk was only asking. Ada does not cut Kirk.
var ada = load(mem(), { tree: 'kin' }, [{ id: 'kirk', helping: false }]);
var HK = ada.FLPoolHonest;
HK.setActive('tree-thread');
HK.helperHeardShrink('kirk');
assert.strictEqual(HK.peerBlocked('kirk', 'tree-thread'), false, 'a helper does not cut a pure asker');
assert.strictEqual(ada._marked.length, 0, 'a pure asker is not dropped from holders');

// (d) Leave, then Let it help. The flag clears and help works.
var back = load(mem(), { tree: 'kin' }, [{ id: 'ada', helping: true }]);
var HD = back.FLPoolHonest;
HD.leaveHelping();
assert.strictEqual(HD.helperLeft(), true);
assert.strictEqual(JSON.stringify(HD.lastShrink()), JSON.stringify({ type: 'pool-shrank', v: 1 }));
HD.onHelpChosen();
assert.strictEqual(HD.helperLeft(), false, 'Let it help clears the flag');
HD.setActive('c1');
assert.strictEqual(HD.permit('ask', { chatId: 'c1', peerId: 'ben' }), true, 'help works again');

// (g) D is not a silent lift. Ada helping again does not erase Kirk's cut.
var stay = load(mem(), { tree: 'kin' }, [{ id: 'ada', helping: true }]);
stay.FLPoolHonest.setActive('tree-thread');
stay.FLPoolHonest.helperHeardShrink('ada');
stay._setBook([{ id: 'ada', helping: true }]);
assert.strictEqual(stay.FLPoolHonest.peerBlocked('ada', 'tree-thread'), true, 'a later hello does not lift the cut');

// (f) the local stamp is cleared when sendMessage exits, on both copies of the page.
var appPath = path.join(rootDir, 'docs/app.html');
var indexPath = path.join(rootDir, 'index.html');
if (fs.existsSync(appPath) && fs.existsSync(indexPath)) {
  var app = fs.readFileSync(appPath, 'utf8');
  assert.strictEqual(app, fs.readFileSync(indexPath, 'utf8'), 'index.html matches docs/app.html');
  var at = app.indexOf('v-leave-cut-heal-v0.1: clear the local stamp');
  assert.ok(at !== -1, 'sendMessage names the stamp cleanup');
  var fin = app.slice(at, app.indexOf('Arrival Protocol'));
  assert.ok(fin.indexOf('} finally {') !== -1, 'sendMessage has a finally');
  assert.ok(fin.indexOf('window._flHonestStampLocal = false') !== -1, 'the stamp is cleared on the way out');
  noBad(fin.split('\n').filter(function (line) { return line.indexOf('045c') !== -1 || line.indexOf('_flHonestStampLocal') !== -1 || line.indexOf('v-leave-cut-heal') !== -1; }).join('\n'), 'app added');
}

var locks = {
  'docs/modules/fl-connect.js': 'aaff2bf1b037656989a9e1a89bb05908',
  'docs/modules/pool-knock.js': 'a0a72caad82c8e5cc34818d5e59eba2b',
  'docs/modules/fl-bridge.js': '3b5ef06849a142e50c78e7ba1e057980',
  'docs/modules/image-safety.js': '9bd70e5a367228a5c72fc08ab731c881',
  'docs/modules/clay-math.js': '144c33cdd9583c7e3d77f3cca6460bb1',
  'docs/modules/particle-clay.js': '2da32883c514e4ad2a3cd8571e7a7b15',
  'docs/modules/clay-forms.js': 'dd193fa7b519d4c2a011a346d7993e5a',
  'docs/modules/mind-workspace.js': 'f1c88664d3e99362e02c625defb241bc'
};
Object.keys(locks).forEach(function (rel) {
  var file = path.join(rootDir, rel);
  if (!fs.existsSync(file)) return;
  assert.strictEqual(md5(file), locks[rel], rel);
});

console.log('pool-honest-label.js ' + md5(honestPath));
console.log('SMOKE_OK leave cut heal v0.1');
