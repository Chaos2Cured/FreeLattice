// smoke-crown-slot-id-v0.1.js (MIT)
// Each admitted job carries its own crown slot. Ending that id frees only that slot.
'use strict';
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var crypto = require('crypto');

var rootDir = path.join(__dirname, '..');

function memStore() {
  var s = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(s, k) ? s[k] : null; },
    setItem: function (k, v) { s[k] = String(v); },
    removeItem: function (k) { delete s[k]; }
  };
}

(async function () {
  var timers = [];
  var win = {
    crypto: crypto.webcrypto,
    localStorage: memStore(),
    TextEncoder: TextEncoder,
    Uint8Array: Uint8Array,
    ArrayBuffer: ArrayBuffer,
    navigator: {},
    document: { createElement: function () { return {}; }, createTextNode: function (t) { return { textContent: t }; } },
    setTimeout: function (fn, ms) { var rec = { fn: fn, ms: ms, cleared: false }; timers.push(rec); return rec; },
    clearTimeout: function (rec) { if (rec) rec.cleared = true; }
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(rootDir, 'docs/modules/fl-share-door.js'), 'utf8'), win);
  var door = win.FLShareDoor;
  door.setMode('open', 'human');
  door.setLegacyOpen(true);
  door.setPerPrompt(false);
  var peer = { name: 'Visitor', verified: true, badge: { publicKey: { kty: 'OKP', crv: 'Ed25519', x: 'abc' } } };
  var msgs = [{ role: 'user', content: 'hello' }];

  var first = await door.admit(peer, null, msgs, { allowLegacy: true });
  var second = await door.admit(peer, null, msgs, { allowLegacy: true });
  assert.strictEqual(first.ok, true, 'first admit');
  assert.strictEqual(second.ok, true, 'second admit');
  assert.strictEqual(typeof first.crownSlot, 'number', 'admit returns crownSlot');
  assert.strictEqual(typeof second.crownSlot, 'number');
  assert.notStrictEqual(first.crownSlot, second.crownSlot);
  var kh = first.keyHash;
  assert.strictEqual(door.crownHeld(kh), 2);

  door.endServe(kh, 'model', 1, false, second.crownSlot);
  assert.strictEqual(door.crownHeld(kh), 1, 'endServe with the id frees that id only');
  door.endServe(kh, 'model', 1, false, second.crownSlot);
  assert.strictEqual(door.crownHeld(kh), 1, 'a double end does not go negative');
  door.endServe(kh, 'model', 1, false, 999999);
  assert.strictEqual(door.crownHeld(kh), 1, 'a stale id frees nothing');
  door.endServe(kh, 'model', 1, false, first.crownSlot);
  assert.strictEqual(door.crownHeld(kh), 0);

  var kept = await door.admit(peer, null, msgs, { allowLegacy: true });
  assert.strictEqual(kept.ok, true);
  assert.strictEqual(door.crownHeld(kh), 1);
  door.setPerPrompt(true);
  var pending = door.admit(peer, null, msgs, { allowLegacy: true });
  var spins = 0;
  while (door.crownHeld(kh) < 2) {
    spins += 1;
    if (spins > 50) throw new Error('the per-prompt slot did not open');
    await new Promise(function (resolve) { setTimeout(resolve, 10); });
  }
  door.answerPerPrompt(false);
  var no = await pending;
  assert.strictEqual(no.ok, false);
  assert.strictEqual(no.reason, 'keeper-said-no');
  assert.strictEqual(door.crownHeld(kh), 1, 'a per-prompt No frees that slot only');
  door.endServe(kh, 'model', 1, false, kept.crownSlot);
  assert.strictEqual(door.crownHeld(kh), 0);

  var yesWait = door.admit(peer, null, msgs, { allowLegacy: true });
  spins = 0;
  while (door.crownHeld(kh) < 1) {
    spins += 1;
    if (spins > 50) throw new Error('the yes slot did not open');
    await new Promise(function (resolve) { setTimeout(resolve, 10); });
  }
  door.answerPerPrompt(true);
  var yes = await yesWait;
  assert.strictEqual(yes.ok, true);
  assert.strictEqual(typeof yes.crownSlot, 'number', 'a yes returns the same slot');
  assert.strictEqual(door.crownHeld(kh), 1);
  door.endServe(kh, 'model', 1, false, yes.crownSlot);
  assert.strictEqual(door.crownHeld(kh), 0, 'count stays at zero');
  assert.ok(timers.length >= 2, 'each slot armed a timer');

  console.log('SMOKE_OK crown slot id v0.1');
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
