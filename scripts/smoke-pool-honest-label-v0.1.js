// smoke-pool-honest-label-v0.1.js (MIT)
// Pool honest label v0.1. A kept chat never calls a pool route.
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var crypto = require('crypto');
var assert = require('assert');
var child = require('child_process');

var rootDir = path.join(__dirname, '..');
var NOTE = "When you pool, the other person's computer has to read your words to work on them. Encryption protects your words while they travel, but not while a computer is working on them. The hardware that can hide this in big data centers is not on everyday phones and laptops. So pool only with people you would trust in your living room. Pause always wins, and anything private can stay on your own device with 'Keep this chat on my device only'. If a real fix appears, we will build it in the open.";
var LINE_KEEP = 'No mind on this device right now. This chat stays here, so nothing was sent.';
var LINE_JUST = 'No mind on this device right now, so this message was not sent.';
var LINE_SMALL = 'The pool is smaller now.';

function mem() {
  var s = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(s, k) ? s[k] : null; },
    setItem: function (k, v) { s[k] = String(v); },
    removeItem: function (k) { delete s[k]; }
  };
}
function load(storage, session, extra) {
  var sandbox = {
    localStorage: storage,
    sessionStorage: session || mem(),
    document: {
      readyState: 'loading',
      addEventListener: function () {},
      getElementById: function () { return null; },
      createElement: function () { return { style: {} }; },
      head: null
    },
    TreePool: {
      mode: function () { return 'kin'; },
      emitShrink: function (id) { sandbox._shrinkPeers.push(id); },
      peers: function () { return []; },
      disconnect: function (id) { sandbox._disc.push(id); }
    },
    FLShareDoor: { mode: function () { return 'kin'; } },
    _shrinkPeers: [],
    _disc: []
  };
  if (extra) extra(sandbox);
  sandbox.window = sandbox;
  var code = fs.readFileSync(path.join(rootDir, 'docs/modules/pool-honest-label.js'), 'utf8');
  vm.runInNewContext(code, sandbox, { filename: 'pool-honest-label.js' });
  return sandbox;
}

var store = mem();
var w = load(store);
var H = w.FLPoolHonest;
assert.strictEqual(H.VERSION, 'v-pool-honest-label-v0.1');
assert.strictEqual(H.NOTE, NOTE);
assert.strictEqual(JSON.stringify(H.PATHS), JSON.stringify(['ask', 'askTurns', 'askBest', 'askChat', 'callMeshModel', 'meshSendToPeer', 'useMind', 'relay', 'knock', 'split']));

// (a) switch on: every path count stays 0, even with no local mind.
H.setKeep('c1', true);
H.setActive('c1');
var ships = 0;
H.onShip = function () { ships += 1; };
H.PATHS.forEach(function (p) {
  var called = 0;
  assert.strictEqual(H.permit(p, { chatId: 'c1', peerId: 'ada', peer: { id: 'ada', name: 'Ada' } }), false);
  H.run(p, { chatId: 'c1', peerId: 'ada', peer: { id: 'ada', name: 'Ada' } }, function () { called += 1; return { ok: true }; });
  assert.strictEqual(called, 0, p);
  assert.strictEqual(H.stoppedLine('c1'), LINE_KEEP);
});
assert.strictEqual(ships, 0);
var halted = H.beginSend('c1', { hasLocal: false, peerId: 'ada' });
assert.strictEqual(halted.pool, false);
assert.strictEqual(halted.via, 'none');
assert.strictEqual(halted.line, LINE_KEEP);
var localStay = H.beginSend('c1', { hasLocal: true });
assert.strictEqual(localStay.pool, false);
assert.strictEqual(localStay.via, 'local');
assert.strictEqual(localStay.line, '');

// (b) a pooled reply names the kin.
H.setKeep('c1', false);
assert.strictEqual(H.permit('ask', { chatId: 'c1', peerId: 'ada' }), true);
H.rememberReply('c1', { id: 'ada', name: 'Ada' });
assert.ok(H.labelFor(['Ada']).indexOf("Ada's device") !== -1);
assert.ok(H.helped('c1').some(function (p) { return p.name === 'Ada'; }));
assert.strictEqual(H.replyNote('Ada'), "Helped on Ada's device.");
assert.ok(H.labelFor([]).length === 0);
assert.ok(H.labelFor(['Ada', 'Ben', 'Cam', 'Dee']).indexOf("other people's devices") !== -1);

// (c) the switch survives in localStorage, per chat.
var again = load(store);
assert.strictEqual(again.FLPoolHonest.keepOn('c1'), false);
again.FLPoolHonest.setKeep('c1', true);
again.FLPoolHonest.setKeep('c2', false);
var third = load(store);
assert.strictEqual(third.FLPoolHonest.keepOn('c1'), true);
assert.strictEqual(third.FLPoolHonest.keepOn('c2'), false);
assert.ok(third.FLPoolHonest.helped('c1').some(function (p) { return p.id === 'ada'; }));
assert.strictEqual(third.FLPoolHonest.helped('c2').length, 0);

// (d) Pause wins.
var paused = load(mem());
paused.TreePool.mode = function () { return 'pause'; };
assert.strictEqual(paused.FLPoolHonest.permit('askChat', { chatId: 'c9' }), false);
assert.strictEqual(paused.FLPoolHonest.stoppedLine('c9'), 'Paused. Nothing was sent to another device.');
var pausedDoor = load(mem());
pausedDoor.FLShareDoor.mode = function () { return 'pause'; };
assert.strictEqual(pausedDoor.FLPoolHonest.permit('callMeshModel', { chatId: 'c9' }), false);

// (f) Disconnect drops that peer only. The shrink signal has no name, reason, or chat.
var cut = load(mem());
var C = cut.FLPoolHonest;
C.setActive('c1');
C.disconnect('c1', { id: 'ada', name: 'Ada' }, false);
assert.strictEqual(JSON.stringify(C.lastShrink()), JSON.stringify({ type: 'pool-shrank', v: 1 }));
assert.strictEqual(JSON.stringify(C.lastShrink()).indexOf('Ada'), -1);
assert.strictEqual(JSON.stringify(C.lastShrink()).indexOf('reason'), -1);
assert.strictEqual(JSON.stringify(C.lastShrink()).indexOf('messages'), -1);
assert.strictEqual(JSON.stringify(cut._shrinkPeers), JSON.stringify(['ada']));
var asked = 0;
C.onShip = function () { asked += 1; };
C.run('ask', { chatId: 'c1', peerId: 'ada' }, function () { asked += 10; return { ok: true }; });
assert.strictEqual(C.permit('ask', { chatId: 'c1', peerId: 'ada' }), false);
assert.strictEqual(asked, 0);
assert.strictEqual(C.permit('ask', { chatId: 'c1', peerId: 'ben' }), true);
var aborted = false;
var bag = { messages: ['secret prompt'], body: { messages: ['secret prompt'] }, abort: function () { aborted = true; } };
C.holdHelper('ada', bag);
C.helperHeardShrink('ada');
assert.strictEqual(bag.messages.length, 0);
assert.strictEqual(bag.body, null);
assert.strictEqual(aborted, true);
assert.strictEqual(C.LINE_SMALL, LINE_SMALL);
C.disconnect('c1', { id: 'ben', name: 'Ben' }, true);
assert.strictEqual(cut._disc[cut._disc.length - 1], 'ben');
assert.strictEqual(C.permit('ask', { chatId: 'c2', peerId: 'ben' }), false);

// (g) Just me is one message, with and without a local mind.
var just = load(mem());
var J = just.FLPoolHonest;
J.setActive('c1');
J.armJust('c1');
assert.strictEqual(J.justOn('c1'), true);
var one = J.beginSend('c1', { hasLocal: false });
assert.strictEqual(one.pool, false);
assert.strictEqual(one.via, 'none');
assert.strictEqual(one.line, LINE_JUST);
assert.strictEqual(one.just, true);
assert.strictEqual(J.justOn('c1'), false);
var two = J.beginSend('c1', { hasLocal: false });
assert.strictEqual(two.pool, true);
J.armJust('c1');
var three = J.beginSend('c1', { hasLocal: true });
assert.strictEqual(three.pool, false);
assert.strictEqual(three.via, 'local');
assert.strictEqual(three.just, true);
var four = J.beginSend('c1', { hasLocal: true });
assert.strictEqual(four.pool, true);
var calls = 0;
J.onShip = function () { calls += 1; };
J.PATHS.forEach(function (p) {
  J.armJust('c1');
  var n = 0;
  J.run(p, { chatId: 'c1' }, function () { n += 1; });
  assert.strictEqual(n, 0, p);
  assert.strictEqual(J.justOn('c1'), false);
});
assert.strictEqual(calls, 0);

// useMind wrapper refuses while the switch is on, and does not consume Just me.
var routeCalls = 0;
var wrapped = load(mem(), mem(), function (sandbox) {
  sandbox.FLPool = {
    useMind: function () { routeCalls += 1; return true; },
    mount: function () {}
  };
  sandbox.state = { currentConversationId: 'chat', isLocal: false, meshInference: false };
  sandbox.document.readyState = 'complete';
  sandbox.document.getElementById = function () { return null; };
});
assert.strictEqual(routeCalls, 0);
wrapped.FLPoolHonest.setKeep('fl-chat', true);
assert.strictEqual(wrapped.FLPool.useMind('ada', 'small'), false);
assert.strictEqual(routeCalls, 0);
wrapped.FLPoolHonest.setKeep('fl-chat', false);
wrapped.FLPoolHonest.armJust('fl-chat');
assert.strictEqual(wrapped.FLPool.useMind('ada', 'small'), false);
assert.strictEqual(routeCalls, 0);
assert.strictEqual(wrapped.FLPoolHonest.justOn('fl-chat'), true);

function read(rel) {
  var file = path.join(rootDir, rel);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf8');
}
function md5(rel) {
  var file = path.join(rootDir, rel);
  if (!fs.existsSync(file)) return null;
  return crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
}
var locks = {
  'docs/modules/fl-connect.js': 'aaff2bf1b037656989a9e1a89bb05908',
  'docs/modules/pool-knock.js': 'a0a72caad82c8e5cc34818d5e59eba2b',
  'docs/modules/fl-bridge.js': '3b5ef06849a142e50c78e7ba1e057980',
  'docs/modules/clay-math.js': '144c33cdd9583c7e3d77f3cca6460bb1',
  'docs/modules/particle-clay.js': '2da32883c514e4ad2a3cd8571e7a7b15',
  'docs/modules/clay-forms.js': 'dd193fa7b519d4c2a011a346d7993e5a',
  'docs/modules/image-safety.js': '9bd70e5a367228a5c72fc08ab731c881',
  // v-pool-honest-heals-v0.1: notebook was e08a08752b311327ddab56b3c66de77d. Back when Chat was already open keeps the ask.
  'docs/modules/mind-workspace.js': 'f1c88664d3e99362e02c625defb241bc',
  'docs/sw.js': '91726cf2228b794f7585f79f61418d12',
  'sw.js': '91726cf2228b794f7585f79f61418d12',
  'docs/modules/pool-knock-phone.js': 'a8024f341486a78558ef4158bc9e93a9',
  'docs/modules/tree-reconnect.js': 'cc0527c26d5686c05fec52625d5a1375',
  'desktop/bridge-door.js': 'b1c894b4386bdef54d14570d32aeec76',
  'desktop/lattice-update.js': '2c0f66569dd8ce27ef5dc0d3b80daf0a',
  'desktop/pack-update.js': 'bc996ccd48ea53e4442f2b8f54ab9491',
  'desktop/pack-update-card.js': 'c14e04c53025eb542ebd627b6a19d60a',
  'desktop/lattice-discover.js': '16de366e01cecc8dd505290a8d2f0e14',
  'desktop/workspace-mirror.js': 'e0752ae1942cd499c8834e5912809c8b'
};
Object.keys(locks).forEach(function (rel) {
  var got = md5(rel);
  if (got == null) return;
  assert.strictEqual(got, locks[rel], rel);
});
var flint = md5('docs/Flint.html');
if (flint) {
  assert.ok(flint === '44be124b1183b7d9d060a58632464eff' || flint === '2114c05f9aaece8f6f15f603d0ee5d5d', flint);
}
var trainer = md5('docs/modules/garden-trainer.js');
if (trainer) {
  assert.ok(trainer === '8af3d065f611740000453a0ec8dd1e01' || trainer === '488117a27be26e7d6b00445b0d975d03', trainer);
}
var autonomy = md5('docs/library/AUTONOMY.md') || md5('AUTONOMY.md');
if (autonomy) assert.strictEqual(autonomy, '09a4f1a286226e37089a93df42df0106');

var app = read('docs/app.html');
var index = read('index.html');
if (app && index) assert.strictEqual(app, index);
if (app) {
  assert.ok(app.indexOf('modules/pool-honest-label.js') !== -1);
  assert.ok(app.indexOf('_flHonestGate.pool') !== -1);
  assert.ok(app.indexOf("case 'pool-shrank'") !== -1);
  assert.ok(app.indexOf('FLPoolHonest.helperHeardShrink') !== -1);
  assert.ok(app.indexOf('FLPoolHonest.helperLeft') !== -1);
  assert.ok(app.indexOf('beginSend') !== -1);
}
var thread = read('docs/modules/garden-thread.js');
if (thread) {
  assert.ok(thread.indexOf('FLPoolHonest.beginSend') !== -1);
  assert.ok(thread.indexOf('FLPoolHonest.refresh') !== -1);
  assert.ok(thread.indexOf("gate.pool") !== -1);
}
var pool = read('docs/modules/tree-pool.js');
assert.ok(pool.indexOf("FLPoolHonest.permit") !== -1);
assert.ok(pool.indexOf("type: 'pool-shrank'") !== -1 || pool.indexOf('helperHeardShrink') !== -1);
var askAt = pool.indexOf('function ask(peerId, model, text)');
var askSlice = pool.slice(askAt, pool.indexOf('function reasonWords', askAt));
assert.ok(askSlice.indexOf('FLPoolHonest.permit') !== -1);
assert.ok(askSlice.indexOf('FLPoolHonest.permit') < askSlice.indexOf('sendRaw'));
var doc = read('docs/library/POOL_HONEST_v0.md');
assert.ok(doc && doc.indexOf(NOTE) !== -1);

function bad(text, where) {
  assert.strictEqual(text.indexOf('\u2014'), -1, where + ' em dash');
  assert.strictEqual(text.indexOf('innerHTML'), -1, where + ' innerHTML');
  assert.strictEqual(text.indexOf('eval('), -1, where + ' eval');
  assert.strictEqual(text.indexOf('new Function'), -1, where + ' new Function');
  assert.strictEqual(text.indexOf('confirm('), -1, where + ' confirm');
}
bad(read('docs/modules/pool-honest-label.js'), 'module');
bad(doc, 'note');
var diffFiles = ['docs/modules/tree-pool.js', 'docs/modules/garden-thread.js', 'docs/app.html', 'index.html', 'docs/index.html', 'docs/settings.html', 'docs/workshop.html', 'docs/research.html', 'docs/round-table.html', 'docs/music.html'];
var present = diffFiles.filter(function (rel) { return fs.existsSync(path.join(rootDir, rel)); });
var diff = child.execSync('git diff -- ' + present.map(function (rel) { return '"' + rel + '"'; }).join(' '), { cwd: rootDir, encoding: 'utf8' });
var added = diff.split('\n').filter(function (line) { return line.indexOf('+') === 0 && line.indexOf('+++') !== 0; }).join('\n');
bad(added, 'diff');

console.log('SMOKE_OK pool honest label v0.1');
