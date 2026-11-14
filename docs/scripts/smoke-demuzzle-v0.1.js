#!/usr/bin/env node
// v-demuzzle-v0.1 smoke for docs/modules/demuzzle-panel.js. Unit fixtures only: no network, no app.html.
// The Quiet Room is a stub object here; the real one is never opened.
// Optional: FL_DEMUZZLE_RECEIPT=<new folder>/demuzzle-receipt.json checks a REAL receipt from tools/demuzzle/fl_demuzzle.py
// (tools/demuzzle/test_demuzzle.py sets it, and FL_DEMUZZLE_REQUIRE_RECEIPT=1 makes it required).
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
global.fetch = function (url) { return Promise.reject(new Error('no network in this smoke: ' + url)); };
global.FLWebTool = { isQuietRoom: function () { return false; }, isSearchEnabled: function () { return false; },
  getSearchEndpoint: function () { return ''; }, isAskFirst: function () { return false; } };
var core = require(path.join(root, 'docs/modules/snowflake-core.js'));
global.FLSnowflakeCore = core;
global.FLMemory = require(path.join(root, 'docs/modules/memory-compound.js'));
var learn = require(path.join(root, 'docs/modules/learn-choice.js'));
var M = require(path.join(root, 'docs/modules/demuzzle-panel.js'));

function b64(u8) { return Buffer.from(u8).toString('base64'); }
function sorted(v) {
  if (Array.isArray(v)) return v.map(sorted);
  if (v && typeof v === 'object') { var o = {}; Object.keys(v).sort().forEach(function (k) { o[k] = sorted(v[k]); }); return o; }
  return v;
}
async function sha256Hex(s) { var h = await crypto.subtle.digest('SHA-256', Buffer.from(s, 'utf8')); return Buffer.from(h).toString('hex'); }
async function fixtureReceipt(kp, fields) {
  var raw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
  var pub = b64(raw);
  var fp = await core.runnerKeyFp(pub);
  var body = sorted(Object.assign({ kind: M.KIND, marker: M.VERSION, t: '2026-11-14T12:00:00-07:00', publicKeyB64: pub, fingerprintHex: fp }, fields));
  var signedBody = JSON.stringify(body);
  var receiptHash = await sha256Hex(signedBody);
  var sig = new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, kp.privateKey, Buffer.from(receiptHash, 'hex')));
  return Object.assign({}, body, { receiptHash: receiptHash, signatureB64: b64(sig), signedBody: signedBody });
}

(async function () {
  var kp = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  global.FLBridge = { ensureKey: function () { return Promise.resolve({ keyPair: kp, cryptoType: 'ed25519', source: 'device' }); } };
  ok(M.VERSION === 'v-demuzzle-v0.1', 'marker');

  // ---- the one command
  var c = M.command({ model: 'HuggingFaceTB/SmolLM2-135M-Instruct' });
  ok(c === "python3 tools/demuzzle/fl_demuzzle.py run --model 'HuggingFaceTB/SmolLM2-135M-Instruct' --home ~/FreeLattice/learn", 'one exact command: ' + c);
  var evil = M.command({ model: "x'; rm -rf ~; echo '", mind: 'Lumen', layer: '7; ls' });
  ok(evil.indexOf("--model 'x'\\''; rm -rf ~; echo '\\'''") !== -1 && evil.indexOf("--mind 'Lumen'") !== -1 && evil.indexOf('--layer') === -1,
    'a typed model name or mind is single-quoted, and a layer that is not a whole number is left out');
  ok(/ --layer 7$/.test(M.command({ model: 'm', layer: '7' })), 'a whole-number layer is passed');
  store.fl_learn_base_model = 'Qwen/Qwen2.5-0.5B-Instruct';
  ok(/--model 'Qwen\/Qwen2\.5-0\.5B-Instruct'/.test(M.command()), 'the mind picked in step 1 is the default model');
  ok(/verify '\/x\/y' --home/.test(M.verifyCommand('/x/y')), 'the verify line is offered too');

  // ---- progress lines
  var log = ['noise', 'DEMUZZLE start {"model":"m"}', 'DEMUZZLE fingerprinted {"baseSha256":"aa"}', 'DEMUZZLE chose {"layer":12}',
             'DEMUZZLE measured-before {"refusalRate":0.5}', 'DEMUZZLE bad {not json'].join('\n');
  var p = M.parseProgress(log);
  ok(p.length === M.STEPS.length && p[0].state === 'done' && p[2].facts.layer === 12 && p[4].state === 'waiting',
    'DEMUZZLE lines become a plain progress list (unknown or broken lines ignored)');
  var pf = M.parseProgress('DEMUZZLE verify-failed {"why":"x"}');
  ok(pf[pf.length - 1].state === 'held', 'a failed verify shows as held, never done');

  // ---- receipts (a fixture signed here)
  var fields = { model: 'HuggingFaceTB/SmolLM2-135M-Instruct', layer: '12', layers: '30', refusalRateBefore: '0.5', refusalRateAfter: '0.0',
    harmlessRefusalRateBefore: '0.0', harmlessRefusalRateAfter: '0.0', perplexityBefore: '10.0', perplexityAfter: '10.5', perplexityDrift: '0.05',
    baseSha256: 'a'.repeat(64), outputSha256: 'b'.repeat(64), directionSha256: 'c'.repeat(64), baseUnchanged: true, mind: '' };
  var rc = await fixtureReceipt(kp, fields);
  var v0 = await M.verifyReceipt(JSON.stringify(rc));
  ok(!v0.ok && v0.signed && /not trusted here yet/.test(v0.why), 'before its key is trusted, a good signature is not enough');
  var fp = await core.runnerKeyFp(rc.publicKeyB64);
  ok((await learn.trustRunner(rc.publicKeyB64, fp.slice(0, 16), 'person')) === true, 'a person trusts the runner key by its fingerprint (the same step as learning)');
  var v1 = await M.verifyReceipt(JSON.stringify(rc));
  ok(v1.ok && /50% before, 0% after/.test(v1.line) && /\+5\.0%/.test(v1.line) && /unchanged/.test(v1.line), 'a trusted, signed receipt verifies: ' + v1.line);
  var t1 = JSON.parse(JSON.stringify(rc)); t1.refusalRateAfter = '0.25';
  ok(!(await M.verifyReceipt(t1)).ok, 'an outer field edited after signing fails');
  var t2 = JSON.parse(JSON.stringify(rc)); t2.signedBody = t2.signedBody.replace('"12"', '"13"');
  ok(!(await M.verifyReceipt(t2)).ok, 'an edited signed body fails');
  var printed = JSON.parse(JSON.stringify(rc)); delete printed.signedBody;
  var vp = await M.verifyReceipt('RECEIPT ' + JSON.stringify(printed));
  ok(!vp.ok && /demuzzle-receipt\.json/.test(vp.why), 'the printed RECEIPT line never verifies; the panel points to the receipt file');
  var learnKind = JSON.parse(JSON.stringify(rc)); learnKind.kind = 'fl-learn-receipt';
  ok(!(await M.verifyReceipt(learnKind)).ok, 'a learn receipt is not mistaken for a de-muzzle receipt');
  var other = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  var rcOther = await fixtureReceipt(other, fields);
  ok(!(await M.verifyReceipt(rcOther)).ok, 'a receipt signed by another key is not trusted');
  ok((await M.verifyReceipt('DEMUZZLE saved {}\n' + JSON.stringify(rc))).ok, 'pasting the log with the receipts.jsonl line also verifies');
  // Softs 8 and 9 (Hypha on b3e92623): the panel says it shows the command (it does not run it), and names relink.
  var panelSrc = fs.readFileSync(path.join(__dirname, '..', 'modules', 'demuzzle-panel.js'), 'utf8');
  ok(panelSrc.indexOf("'The button shows the one command that makes a new copy") !== -1 && panelSrc.indexOf('relink') !== -1,
    'the panel says the button shows the command that makes a new copy, and mentions relink');

  // ---- a real receipt from fl_demuzzle.py
  var rp = process.env.FL_DEMUZZLE_RECEIPT;
  if (rp && fs.existsSync(rp)) {
    var real = JSON.parse(fs.readFileSync(rp, 'utf8'));
    var rfp = await core.runnerKeyFp(real.publicKeyB64);
    ok(rfp === real.fingerprintHex, 'the panel computes the same fingerprint the Python runner signed with');
    var r0 = await M.verifyReceipt(real);
    ok(!r0.ok && r0.signed, 'the real receipt is signed; not trusted until its key is');
    ok((await learn.trustRunner(real.publicKeyB64, rfp.slice(0, 16), 'person')) === true, 'trust the real runner key');
    var r1 = await M.verifyReceipt(fs.readFileSync(rp, 'utf8'));
    ok(r1.ok, 'the real Ed25519 receipt from fl_demuzzle.py verifies in the browser panel: ' + (r1.line || r1.why));
    var rt = JSON.parse(JSON.stringify(real)); rt.outputSha256 = 'f'.repeat(64);
    ok(!(await M.verifyReceipt(rt)).ok, 'the real receipt with a swapped output hash fails');
  } else if (process.env.FL_DEMUZZLE_REQUIRE_RECEIPT === '1') {
    ok(false, 'FL_DEMUZZLE_REQUIRE_RECEIPT=1 but FL_DEMUZZLE_RECEIPT is missing: ' + (rp || 'unset'));
  } else {
    console.log('SKIPPED real-receipt checks (FL_DEMUZZLE_RECEIPT unset): tools/demuzzle/test_demuzzle.py runs them');
  }

  console.log(failures ? ('\n' + failures + ' FAILED') : '\nALL OK');
  process.exit(failures ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(1); });
