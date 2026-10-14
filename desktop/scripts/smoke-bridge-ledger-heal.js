#!/usr/bin/env node
// smoke-bridge-ledger-heal.js (MIT) v-bridge-ledger-heal-v0.1
// Node only. A receipt stays out of the voice chain.
var fs = require('fs');
var os = require('os');
var path = require('path');
var crypto = require('crypto');
var assert = require('assert');
var ledger = require('../lattice-ledger');

var passed = 0;
function ok(cond, name) {
  assert.ok(cond, name);
  passed += 1;
}

function main() {
  var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fl-bridge-ledger-heal-'));
  ledger.bindSmoke(tmp, crypto.randomBytes(32));

  var first = ledger.appendVoice('first voice');
  ok(first.ok === true, 'first voice seals');
  var receipt = ledger.appendBridgeSend({
    kind: 'bridge-send',
    hash: 'abc',
    status: 200,
    ts: '2026-10-14T12:00:00.000Z'
  });
  ok(receipt.kind === 'bridge-send' && receipt.hash === 'abc' && receipt.status === 200, 'a receipt keeps hash, status, and time');
  var second = ledger.appendVoice('second voice');
  ok(second.ok === true, 'a voice after a receipt still seals');

  var chain = ledger.verifyChain();
  ok(chain.ok === true && chain.length === 2, 'voice, receipt, voice keeps a chain of two');

  var chainPath = path.join(tmp, 'chain.jsonl');
  var chainText = fs.readFileSync(chainPath, 'utf8');
  ok(chainText.indexOf('bridge-send') === -1, 'the voice chain has no receipt');
  var receiptText = fs.readFileSync(path.join(tmp, 'bridge-receipts.jsonl'), 'utf8');
  ok(receiptText.indexOf('"kind":"bridge-send"') !== -1, 'the receipt lives in its own file');
  ok(receiptText.indexOf('first voice') === -1 && receiptText.indexOf('second voice') === -1, 'a receipt has no voice body');
  var rows = ledger.readBridgeReceipts();
  ok(rows.length === 1 && rows[0].status === 200, 'readBridgeReceipts returns the row');

  var st = ledger.status();
  var lines = chainText.trim().split('\n');
  var lastVoice = JSON.parse(lines[lines.length - 1]);
  ok(/^[0-9a-f]{64}$/.test(st.headHash) && st.headHash === lastVoice.entryHash, 'headHash after a send is the last voice');

  var saved = chainText;
  lastVoice.kind = 'bridge-send';
  lastVoice.voice = 'FORGED';
  lines[lines.length - 1] = JSON.stringify(lastVoice);
  fs.writeFileSync(chainPath, lines.join('\n') + '\n');
  var forged = ledger.verifyChain();
  ok(forged.ok === false && forged.reason === 'entryHash', 'a relabeled voice fails entryHash');

  fs.writeFileSync(chainPath, saved);
  fs.appendFileSync(chainPath, JSON.stringify({
    kind: 'bridge-send',
    hash: 'hand',
    status: 200,
    ts: '2026-10-14T12:00:01.000Z'
  }) + '\n');
  var planted = ledger.verifyChain();
  ok(planted.ok === false, 'a receipt written into the voice chain fails');

  var refused = false;
  var message = '';
  try {
    ledger.appendVoice('after a bad head');
  } catch (e) {
    refused = true;
    message = String(e && e.message || e);
  }
  ok(refused && message === 'chain head unreadable, refuse append', 'a head with no hash refuses the next voice');

  var src = fs.readFileSync(path.join(__dirname, '../lattice-ledger.js'), 'utf8');
  var verifyStart = src.indexOf('function verifyChain()');
  var verifyEnd = src.indexOf('function receiptsPath()');
  var verifySrc = src.slice(verifyStart, verifyEnd);
  ok(verifySrc.indexOf('bridge-send') === -1, 'verifyChain has no kind skip');
  ok(src.indexOf('chain head unreadable, refuse append') !== -1, 'a bad head is refused in those words');
  var freshLines = src.split('\n').filter(function (ln) {
    return ln.indexOf('v-bridge-ledger-heal-v0.1') !== -1 || ln.indexOf('bridge-receipts.jsonl') !== -1 || ln.indexOf('chain head unreadable, refuse append') !== -1;
  });
  ok(freshLines.join('\n').indexOf('\u2014') === -1, 'the heal lines have no em dash');

  console.log('checks ' + passed);
  console.log('SMOKE_OK bridge ledger heal v0.1');
}

main();
