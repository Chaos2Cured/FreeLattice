// smoke-pool-honest-heals-v0.1.js (MIT)
// Pool honest heals v0.1. The old overclaim stays only as a comment.
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var crypto = require('crypto');
var assert = require('assert');

var rootDir = path.join(__dirname, '..');

function mem() {
  var s = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(s, k) ? s[k] : null; },
    setItem: function (k, v) { s[k] = String(v); },
    removeItem: function (k) { delete s[k]; }
  };
}
function load(storage, modes) {
  modes = modes || {};
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
      peers: function () { return [{ id: 'ada', state: 'proved' }]; },
      disconnect: function (id) { sandbox._disc.push(id); }
    },
    FLShareDoor: {
      mode: function () { return modes.door || 'off'; },
      setMode: function (m) { modes.door = m; return true; }
    },
    FLPool: {
      helping: function () { return modes.pool === true; },
      letHelp: function () { modes.pool = true; return { ok: true }; }
    },
    _shrinkPeers: [],
    _disc: [],
    _modes: modes
  };
  sandbox.window = sandbox;
  var code = fs.readFileSync(path.join(rootDir, 'docs/modules/pool-honest-label.js'), 'utf8');
  vm.runInNewContext(code, sandbox, { filename: 'pool-honest-label.js' });
  return sandbox;
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
function personFacing(file) {
  return fs.readFileSync(file, 'utf8').split('\n').filter(function (line) {
    return line.replace(/^\s*\/\/.*$/, '').indexOf('Nothing is kept') !== -1;
  });
}

var poolFile = path.join(rootDir, 'docs/modules/tree-pool.js');
var pool = fs.readFileSync(poolFile, 'utf8');
assert.strictEqual(personFacing(poolFile).length, 0, 'no person-facing kept-nothing line');
assert.ok(pool.indexOf('before 045b:') !== -1, 'before 045b comments');
assert.ok(pool.indexOf('The other computer has to read the words while it works') !== -1);
assert.ok(pool.indexOf('The other computer had to read the words while it worked') !== -1);
noBad(pool.split('\n').filter(function (line) { return line.indexOf('045b') !== -1 || line.indexOf('The other computer') !== -1; }).join('\n'), 'tree-pool added');

var honestPath = path.join(rootDir, 'docs/modules/pool-honest-label.js');
var honest = fs.readFileSync(honestPath, 'utf8');
noBad(honest, 'pool-honest-label');
assert.ok(honest.indexOf('v-pool-honest-heals-v0.1') !== -1);
assert.ok(honest.indexOf("You left the pool. Let it help again whenever you like.") !== -1);
assert.ok(honest.indexOf('wrapHelp(root.TreePool, \'letHelp\')') !== -1);
assert.ok(honest.indexOf('wrapHelp(root.FLPool, \'letHelp\')') !== -1);
assert.ok(honest.indexOf('wrapShareMode(root.FLShareDoor)') !== -1);

var store = mem();
var w = load(store, { tree: 'kin', door: 'off', pool: false });
var H = w.FLPoolHonest;
assert.strictEqual(H.replyNote("Ada's computer (Ada)"), "Helped on Ada's computer (Ada).");
assert.ok(H.labelFor(["Ada's computer (Ada)"]).indexOf("Part of this chat runs on Ada's computer (Ada).") === 0);
assert.strictEqual(H.replyNote('Ada'), "Helped on Ada's device.");
assert.ok(H.labelFor(['Ada']).indexOf("on Ada's device.") !== -1);
assert.ok(H.labelFor(["another person's"]).indexOf("another person's device.") !== -1);
assert.ok(H.labelFor(['Ada', 'Ben']).indexOf("Ada's device and Ben's device.") !== -1);
assert.ok(H.labelFor(["Ada's computer (Ada)", 'Ben']).indexOf("Ada's computer (Ada) and Ben's device.") !== -1);
assert.ok(H.labelFor(['Ada', 'Ben', 'Cam', 'Dee']).indexOf("other people's devices") !== -1);

assert.strictEqual(H.showLeave('tree-thread'), false, 'Leave stays off the asker chat');
assert.strictEqual(H.showLeave('fl-chat'), false, 'Leave stays off the FreeLattice chat');
assert.strictEqual(H.showLeave('tree-pool-card'), true, 'Leave shows while this device helps');
H.leaveHelping();
assert.strictEqual(store.getItem('fl_pool_honest_helper_left_v1'), 'true');
assert.strictEqual(H.helperLeft(), true);
assert.strictEqual(JSON.stringify(H.lastShrink()), JSON.stringify({ type: 'pool-shrank', v: 1 }));
assert.strictEqual(H.showLeave('tree-pool-card'), false, 'Leave is gone after leaving');
assert.strictEqual(H.LINE_LEFT, 'You left the pool. Let it help again whenever you like.');
assert.ok(fs.readFileSync(path.join(rootDir, 'docs/modules/pool-honest-label.js'), 'utf8').indexOf("btn('Let it help'") !== -1, 'Let it help is a real button');
H.onHelpChosen();
assert.strictEqual(H.helperLeft(), false, 'Let it help clears the flag');
assert.strictEqual(store.getItem('fl_pool_honest_helper_left_v1'), 'false');
H.setActive('c1');
assert.strictEqual(H.permit('ask', { chatId: 'c1', peerId: 'ben' }), true, 'help works again');

var helping = load(mem(), { tree: 'kin', door: 'off', pool: false });
helping.FLPoolHonest.setActive('c1');
helping.FLPoolHonest.helperHeardShrink('asker');
assert.strictEqual(helping.FLPoolHonest.peerBlocked('asker', 'c1'), false, 'a helper does not cut the asker');

var asking = load(mem(), { tree: 'off', door: 'off', pool: false });
asking.FLPoolHonest.setActive('c1');
asking.FLPoolHonest.helperHeardShrink('helper');
assert.strictEqual(asking.FLPoolHonest.peerBlocked('helper', 'c1'), true, 'an asker stops sending to a helper who left');
assert.strictEqual(asking.FLPoolHonest.LINE_SMALL, 'The pool is smaller now.');

var appPath = path.join(rootDir, 'docs/app.html');
var indexPath = path.join(rootDir, 'index.html');
if (fs.existsSync(appPath) && fs.existsSync(indexPath)) {
  var app = fs.readFileSync(appPath, 'utf8');
  var index = fs.readFileSync(indexPath, 'utf8');
  assert.strictEqual(app, index, 'index.html matches docs/app.html');
  assert.ok(app.indexOf('function flDescriptorWithoutMesh()') !== -1);
  assert.ok(app.indexOf('if (window._flHonestStampLocal) return flDescriptorWithoutMesh();') !== -1);
  assert.ok(app.indexOf("if (!_flHonestGate.pool && _flHonestGate.via === 'local')") !== -1);
  assert.ok(app.indexOf('window._flHonestStampLocal = true') !== -1);
  assert.ok(app.indexOf('window._flHonestStampLocal = false') !== -1);
  assert.ok(app.indexOf('state.meshInference && state.meshPeerId') !== -1, 'a real mesh reply still resolves to mesh');
  var localFn = app.slice(app.indexOf('function flDescriptorWithoutMesh()'), app.indexOf('function flProviderDescriptor()'));
  assert.strictEqual(localFn.indexOf('meshInference'), -1, 'the local stamp does not look at mesh');
  noBad(app.split('\n').filter(function (line) {
    return line.indexOf('_flHonestStampLocal') !== -1 || line.indexOf('flDescriptorWithoutMesh') !== -1 || line.indexOf('v-pool-honest-heals-v0.1') !== -1;
  }).join('\n'), 'app added');
}

var locks = {
  'docs/modules/fl-connect.js': 'aaff2bf1b037656989a9e1a89bb05908',
  'docs/modules/pool-knock.js': 'a0a72caad82c8e5cc34818d5e59eba2b',
  'docs/modules/fl-bridge.js': '3b5ef06849a142e50c78e7ba1e057980',
  'docs/modules/image-safety.js': '9bd70e5a367228a5c72fc08ab731c881',
  'docs/modules/clay-math.js': '144c33cdd9583c7e3d77f3cca6460bb1',
  'docs/modules/particle-clay.js': '2da32883c514e4ad2a3cd8571e7a7b15',
  'docs/modules/clay-forms.js': 'dd193fa7b519d4c2a011a346d7993e5a'
};
Object.keys(locks).forEach(function (rel) {
  var file = path.join(rootDir, rel);
  if (!fs.existsSync(file)) return;
  assert.strictEqual(md5(file), locks[rel], rel);
});
['docs/sw.js', 'sw.js'].forEach(function (rel) {
  var file = path.join(rootDir, rel);
  if (!fs.existsSync(file)) return;
  assert.strictEqual(md5(file), '91726cf2228b794f7585f79f61418d12', rel);
});

console.log('pool-honest-label.js ' + md5(honestPath));
console.log('SMOKE_OK pool honest heals v0.1');
