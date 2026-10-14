#!/usr/bin/env node
// smoke-bridge-door.js (MIT) v-bridge-knock-v0.1
// Node only. The request function is a stand-in. Nothing leaves this process.
var fs = require('fs');
var os = require('os');
var path = require('path');
var assert = require('assert');

var passed = 0;
function ok(cond, name) {
  assert.ok(cond, name);
  passed += 1;
}

function fresh() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fl-bridge-door-'));
}

function safeStorage(backend) {
  var mem = {};
  return {
    isEncryptionAvailable: function () { return true; },
    encryptString: function (s) { return Buffer.from('enc:' + s, 'utf8'); },
    decryptString: function (buf) { return Buffer.from(buf).toString('utf8').replace(/^enc:/, ''); },
    getSelectedStorageBackend: function () { return backend || 'keychain'; },
    _mem: mem
  };
}

async function boot(root, ss, request) {
  var door = require('../bridge-door');
  door.bindSmoke({ root: root, safeStorage: ss, request: request });
  return door;
}

async function letter() {
  var bridge = require('../../docs/modules/fl-bridge.js');
  var id = await bridge.ensureKey();
  return bridge.signLetter({
    kind: 'letter',
    subject: 'sun',
    body: 'hi',
    ts: '2026-10-14T12:00:00.000Z',
    nonce: '0011223344556677',
    prev: null,
    attach_hashes: []
  }, id);
}

async function main() {
  var secret = 'door-secret-value';
  var calls = [];
  function request(url, opts) {
    calls.push({ url: url, opts: opts });
    var status = opts && opts._status ? opts._status : 200;
    if (String(url).indexOf('fail') !== -1) status = 500;
    if (String(url).indexOf('hop') !== -1) status = 302;
    return Promise.resolve({ status: status, ok: status >= 200 && status < 300 });
  }

  var logs = [];
  var orig = console.log;
  console.log = function () {
    logs.push(Array.prototype.join.call(arguments, ' '));
    return orig.apply(console, arguments);
  };

  var root = fresh();
  var ss = safeStorage('keychain');
  var door = await boot(root, ss, request);
  var env = await letter();

  var unset = await door.send(env);
  ok(unset.ok === false && unset.reason === 'unset', 'placeholder URL refuses');
  ok(unset.message === door.UNSET_MESSAGE, 'the honest not-set-up line');
  ok(calls.length === 0, 'placeholder URL makes no request');
  ok(JSON.stringify(unset).indexOf(secret) === -1, 'unset result has no key');

  door.saveUrl('https://example.test/hook');
  var noKey = await door.send(env);
  ok(noKey.ok === false && calls.length === 0, 'a missing key makes no request');

  var locked = require('../bridge-door');
  var deniedRoot = fresh();
  locked.bindSmoke({
    root: deniedRoot,
    safeStorage: { isEncryptionAvailable: function () { return false; } },
    request: request
  });
  var refused = locked.saveKey(secret);
  ok(refused.ok === false && !fs.existsSync(path.join(deniedRoot, 'bridge', 'key.bin')), 'no keychain means the key is not stored');

  door.bindSmoke({ root: root, safeStorage: ss, request: request });
  var saved = door.saveKey(secret);
  ok(saved.ok === true && saved.keySet === true, 'a key can be stored when the keychain is here');
  ok(JSON.stringify(saved).indexOf(secret) === -1, 'save does not echo the key');
  var st = door.status();
  ok(st.keySet === true && st.ready === true, 'a url and a key make the door ready');
  ok(st.backend === 'keychain', 'Mac backend name is keychain');
  ok(JSON.stringify(st).indexOf(secret) === -1, 'status has no key');

  door.saveUrl('http://example.test/hook');
  var httpRes = await door.send(env);
  ok(httpRes.ok === false && httpRes.reason === 'http' && calls.length === 0, 'http is refused');

  door.saveUrl('https://example.test/hop');
  var red = await door.send(env);
  ok(calls.length === 1, 'a redirect is one request');
  ok(red.reason === 'redirect' && red.ok === false, 'a redirect is not followed');
  ok(calls[0].opts.redirect === 'manual', 'redirect mode is manual');
  ok(JSON.stringify(red).indexOf(secret) === -1, 'redirect result has no key');

  var beforeFail = calls.length;
  door.saveUrl('https://example.test/fail');
  var fail = await door.send(env);
  ok(calls.length === beforeFail + 1, 'one tap, one request');
  ok(fail.ok === false && fail.reason === 'refused', 'a failure is not retried');

  door.saveUrl('https://example.test/hook');
  var good = await door.send(env);
  ok(good.ok === true && good.status === 200, 'a 2xx is sent');
  ok(JSON.stringify(good).indexOf(secret) === -1, 'send result has no key');

  var ledgerPath = path.join(root, 'chain.jsonl');
  var ledgerText = fs.readFileSync(ledgerPath, 'utf8');
  ok(ledgerText.indexOf(secret) === -1, 'the ledger line has no key');
  ok(ledgerText.indexOf('"kind":"bridge-send"') !== -1, 'the ledger records the send');
  ok(logs.join('\n').indexOf(secret) === -1, 'logs have no key');

  var badEnv = JSON.parse(JSON.stringify(env));
  badEnv.letter.body = 'nope';
  var beforeBad = calls.length;
  var bad = await door.send(badEnv);
  ok(bad.ok === false && bad.reason === 'verify' && calls.length === beforeBad, 'a bad letter makes no request');

  door.forgetKey();
  ok(door.status().keySet === false, 'forget key clears it');
  var afterForget = await door.send(env);
  ok(afterForget.reason === 'unset' && calls.length === beforeBad, 'a forgotten key makes no request');

  var ledger = require('../lattice-ledger');
  ledger.bindSmoke(root, null);
  var chain = ledger.verifyChain();
  ok(chain.ok === true, 'bridge receipts do not break the chain');

  var preload = fs.readFileSync(path.join(__dirname, '../preload.js'), 'utf8');
  ok(preload.indexOf("exposeInMainWorld('flBridge'") !== -1, 'preload exposes flBridge');
  ok(preload.indexOf('saveKey') === -1, 'the app preload cannot save a key');
  var doorSrc = fs.readFileSync(path.join(__dirname, '../bridge-door.js'), 'utf8');
  ok(doorSrc.indexOf('BRIDGE_ENDPOINT_URL_UNSET') !== -1, 'placeholder URL is shipped');
  ok(doorSrc.indexOf('keychain') !== -1 && doorSrc.indexOf('dpapi') !== -1, 'Mac and Windows backends are named');
  ok(doorSrc.indexOf(secret) === -1, 'the secret is not in the source');
  ok(doorSrc.indexOf('\u2014') === -1, 'no em dash');

  console.log = orig;
  console.log('checks ' + passed);
  console.log('SMOKE_OK bridge desktop door v0.1');
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
