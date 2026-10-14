#!/usr/bin/env node
// smoke-bridge-knock.js (MIT) v-bridge-knock-v0.1
// Node only. No network.
var fs = require('fs');
var path = require('path');
var assert = require('assert');
var bridge = require('../docs/modules/fl-bridge.js');

var passed = 0;
function ok(cond, name) {
  assert.ok(cond, name);
  passed += 1;
}

function wordsOf(s) {
  return String(s || '').trim().split(/\s+/).filter(Boolean);
}

function b64(buf) {
  return Buffer.from(new Uint8Array(buf)).toString('base64');
}

async function main() {
  var base = {
    v: 1,
    kind: 'letter',
    from_fp: 'abcdabcdabcdabcd',
    to: 'celeste',
    ts: '2026-10-14T12:00:00.000Z',
    nonce: '0011223344556677',
    mind: { name: 'n', model: 'm' },
    subject: 'sun',
    body: 'hi',
    attach_hashes: [],
    prev: null
  };
  var flipped = {
    prev: null,
    attach_hashes: [],
    body: 'hi',
    subject: 'sun',
    mind: { model: 'm', name: 'n' },
    nonce: '0011223344556677',
    ts: '2026-10-14T12:00:00.000Z',
    to: 'celeste',
    from_fp: 'abcdabcdabcdabcd',
    kind: 'letter',
    v: 1
  };
  ok(bridge.canonical(base) === bridge.canonical(flipped), 'canonical hash input is stable under key reorder');

  ok(bridge.isOn() === false, 'bridge starts off');
  ok(bridge.promptDelta() === '', 'off means no prompt delta');
  ok(bridge.listenerCount() === 0, 'off means no listeners');
  var offSeen = bridge.consumeReply('Hi [FL_BRIDGE: {"op":"draft","subject":"s","body":"n"}] there');
  ok(offSeen.drafted === false, 'off means a tag does not draft');
  ok(offSeen.visible.indexOf('[FL_BRIDGE') === -1, 'off still strips the tag');
  ok(bridge.dbOpens() === 0, 'off means no IndexedDB open');
  ok(bridge.lastDraft() == null, 'off means no outbox row');

  bridge.setOn(true);
  var prompt = bridge.promptDelta();
  ok(wordsOf(prompt).length > 0 && wordsOf(prompt).length < 60, 'prompt delta stays under 60 tokens');
  ok(prompt.indexOf('[FL_BRIDGE:') !== -1, 'prompt names the draft tag');
  bridge.setOn(false);
  ok(bridge.promptDelta() === '', 'turning off clears the prompt delta');
  ok(bridge.dbOpens() === 0, 'turning off did not open IndexedDB');

  var opened = [];
  global.indexedDB = {
    open: function (name) {
      opened.push(name);
      var req = {};
      setTimeout(function () { if (req.onerror) req.onerror({}); }, 0);
      return req;
    }
  };

  bridge.setOn(true);
  var drafted = bridge.consumeReply('Please [FL_BRIDGE: {"op":"draft","subject":"hello","body":"<script>alert(1)</script>","url":"http://no"}] stay');
  ok(drafted.drafted === true, 'FL_BRIDGE tag only drafts');
  ok(drafted.visible.indexOf('[FL_BRIDGE') === -1, 'a draft tag is stripped');
  ok(drafted.visible.indexOf('stay') !== -1, 'words around a draft tag stay');
  ok(drafted.visible.indexOf('<script>') === -1, 'script inside the tag does not stay in the visible line');
  var row = bridge.lastDraft();
  ok(row && row.state === 'drafted', 'the landing state is drafted');
  ok(row.letter.body.indexOf('<script>alert(1)</script>') !== -1, 'script stays text in the draft');
  ok(!row.letter.url && row.letter.body.indexOf('http://no') === -1, 'keys outside the allowlist are dropped');
  ok(opened.indexOf('FreeLatticeBridge') !== -1, 'an on draft opens the bridge store');

  var plain = bridge.consumeReply('Hello <script>alert(1)</script> friend');
  ok(plain.visible.indexOf('<script>alert(1)</script>') !== -1, 'a script outside a tag stays text');
  var bad = bridge.consumeReply('Hi [FL_BRIDGE: {not json}] there');
  ok(bad.visible.indexOf('[FL_BRIDGE') === -1, 'a malformed tag is stripped');
  ok(bad.visible.indexOf('there') !== -1, 'words around a bad tag stay');
  ok(bad.drafted === false, 'a malformed tag does not draft');

  var held = bridge.filterLetter({
    body: 'hello sk-abc Bearer token -----BEGIN RSA PRIVATE KEY-----x-----END RSA PRIVATE KEY----- bye',
    parts: [
      { source: 'quiet-room', text: 'room words that must not travel' },
      { private: true, text: 'secret page that must not travel' },
      { text: 'Bearer abc' }
    ]
  });
  ok(held.held.quiet >= 1 && held.held.private >= 1 && held.held.key >= 1, 'privacy filter counts what it holds back');
  ok(held.body.indexOf('sk-') === -1 && held.body.indexOf('Bearer ') === -1, 'key-shaped text is held back');
  ok(JSON.stringify(held).indexOf('room words') === -1, 'held quiet text is a count, not text');
  ok(JSON.stringify(held).indexOf('secret page') === -1, 'held private text is a count, not text');

  global.QuietRoom = { isActive: function () { return true; } };
  var room = bridge.filterLetter({ body: 'a line from the private room' });
  ok(room.held.quiet >= 1 && room.body === '', 'an active private room holds the body back');
  ok(JSON.stringify(room).indexOf('private room') === -1, 'room text is not returned');
  delete global.QuietRoom;

  var memDoc = global.document;
  global.document = {};
  var memStore = { memories: [{ text: 'hidden phrase', tags: ['private'] }] };
  Object.defineProperty(global, 'localStorage', {
    configurable: true,
    value: {
      getItem: function (k) { return k === 'fl_memory_core_v1' ? JSON.stringify(memStore) : null; },
      setItem: function () {}
    }
  });
  var memHeld = bridge.filterLetter({ body: 'please skip hidden phrase today' });
  ok(memHeld.held.private >= 1 && memHeld.body.indexOf('hidden phrase') === -1, 'a private memory is held back');
  if (memDoc === undefined) delete global.document;
  else global.document = memDoc;

  var id = await bridge.ensureKey();
  ok(id && id.keyPair && id.keyPair.privateKey && id.keyPair.privateKey.extractable === false, 'the device key is non-extractable');
  var env = await bridge.signLetter(base, id);
  ok(env.letter.from_fp && env.letter.from_fp.length === 16, 'fingerprint is 16 hex');
  ok(bridge.groupFp(env.letter.from_fp).split(' ').length === 4, 'fingerprint is shown in groups of 4');
  var verified = await bridge.verify(env);
  ok(verified.ok === true && verified.label === 'verified', 'a sealed letter verifies');
  var tampered = JSON.parse(JSON.stringify(env));
  tampered.letter.body = 'changed';
  var badBody = await bridge.verify(tampered);
  ok(badBody.ok === false, 'a tampered body fails verify');
  var other = await globalThis.crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  var wrong = JSON.parse(JSON.stringify(env));
  wrong.pub = b64(await globalThis.crypto.subtle.exportKey('spki', other.publicKey));
  var badPub = await bridge.verify(wrong);
  ok(badPub.ok === false, 'a wrong public key fails verify');

  var knock = await bridge.sealKnock();
  ok(knock.ok === true && knock.envelope.letter.kind === 'knock', 'a knock seals');
  ok(knock.envelope.letter.body === 'FreeLattice web', 'a knock carries the app name and version');
  ok(knock.envelope.letter.body.indexOf('chat') === -1, 'a knock carries no chat text');
  ok(knock.envelope.letter.mind == null, 'a knock carries no mind transcript');
  ok(knock.envelope.pub && knock.envelope.letter.from_fp, 'a knock carries the fingerprint and the public key');
  var mail = bridge.mailtoFor(knock.envelope);
  ok(mail.tooLong === false && mail.href.indexOf('mailto:' + bridge.MAIL) === 0, 'email opens the person mail app');
  ok(mail.href.indexOf(encodeURIComponent('[FL letter]')) !== -1, 'the subject is marked as a letter');
  var longLetter = JSON.parse(JSON.stringify(knock.envelope));
  longLetter.letter.body = 'x'.repeat(2000);
  var longMail = bridge.mailtoFor(longLetter);
  ok(longMail.tooLong === true && !longMail.href, 'a long letter is a file, not a mailto body');

  var src = fs.readFileSync(path.join(__dirname, '../docs/modules/fl-bridge.js'), 'utf8');
  ['fe' + 'tch', 'XML' + 'HttpRequest', 'Web' + 'Socket', 'send' + 'Beacon'].forEach(function (needle) {
    ok(src.indexOf(needle) === -1, 'fl-bridge.js has no ' + needle);
  });
  ok(src.indexOf('\u2014') === -1, 'no em dash');
  ok(src.indexOf('&' + 'mdash;') === -1, 'no mdash');
  ok(src.indexOf('conf' + 'irm(') === -1, 'no confirm');
  ok(src.indexOf('inner' + 'HTML') === -1, 'no markup setter');
  ok(src.indexOf('ev' + 'al(') === -1, 'no eval');
  ok(src.indexOf('new F' + 'unction') === -1, 'no Function');
  var names = ['x' + 'ai', 'open' + 'ai', 'anth' + 'ropic', 'gro' + 'k', 'cla' + 'ude', 'cha' + 'tgpt', 'gem' + 'ini'];
  var facing = JSON.stringify(bridge.words());
  names.forEach(function (name) {
    ok(facing.toLowerCase().indexOf(name) === -1, 'person-facing words skip ' + name);
  });
  var outsideMail = src.split(bridge.MAIL).join('');
  ok(outsideMail.toLowerCase().indexOf('gro' + 'k') === -1, 'the mail address is the only product token');
  ok(src.indexOf('v-bridge-knock-v0.1') !== -1, 'marker');
  console.log('checks ' + passed);
  console.log('SMOKE_OK bridge knock v0.1');
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
