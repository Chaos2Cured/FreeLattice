#!/usr/bin/env node
// smoke-encrypt-chats-locally.js (v-encrypt-chats-locally-v0.1)
// 1. FLChatVault seals and opens chat records with AES-GCM (WebCrypto in Node).
// 2. Migration seals plain records only after a verified round trip, and skips
//    a record the app changed in the meantime (compare-and-swap).
// 3. A missing key never deletes or overwrites: records show as locked, and a
//    locked placeholder written back restores the original sealed blob.
// 4. No WebCrypto: honest passthrough, chats stay plain and readable.
// 5. Locks: root index.html == docs/app.html; fl-connect.js and sw.js untouched;
//    honest note present; status uses textContent; no em dash in the new block.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..', '..');
const app = fs.readFileSync(path.join(ROOT, 'docs', 'app.html'), 'utf8');

const b = app.indexOf('// v-encrypt-chats-locally-v0.1 BEGIN: FLChatVault');
const e = app.indexOf('// v-encrypt-chats-locally-v0.1 END: FLChatVault');
assert.ok(b > 0 && e > b, 'FLChatVault block present');
const block = app.slice(app.lastIndexOf('\n', b), e);
const ph = app.indexOf('async function phiHashData(data) {');
assert.ok(ph > 0, 'phiHashData present');
const phiFn = app.slice(ph, app.indexOf('\n}\n', ph) + 3);

function makeVault(opts) {
  opts = opts || {};
  const ctx = {
    crypto: opts.noCrypto ? {} : globalThis.crypto,
    TextEncoder, TextDecoder, setTimeout, clearTimeout, console,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    Promise, Uint8Array, Array, Object, JSON, Error, String
  };
  vm.createContext(ctx);
  vm.runInContext(phiFn + '\n' + block + '\nthis.FLChatVault = FLChatVault;', ctx);
  const V = ctx.FLChatVault;
  V._setKeyStoreForTest(opts.keyStore || memKeyStore());
  return V;
}
function eq(a, b, msg) { assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), msg); }
function memKeyStore() {
  const m = new Map();
  return { m, getAll: async () => Array.from(m.values()), put: async (r) => { m.set(r.id, r); } };
}
function memAdapter(records, keyPath) {
  return {
    rows: records,
    getAll: async () => records.map((r) => JSON.parse(JSON.stringify(r))),
    cas: async (snap, next) => {
      const i = records.findIndex((r) => r[keyPath] === snap[keyPath]);
      if (i < 0 || JSON.stringify(records[i]) !== JSON.stringify(snap)) return false;
      records[i] = JSON.parse(JSON.stringify(next));
      return true;
    }
  };
}

(async () => {
  // 1. round trip
  const ks = memKeyStore();
  const V = makeVault({ keyStore: ks });
  await V.init();
  assert.strictEqual(V.status().mode, 'ready', 'vault ready');
  assert.ok(/^phi-[0-9a-f]{16}$/.test(V.status().kid), 'phi key ID shape');
  for (const v of ks.m.values()) { if (v.root) assert.ok(!(v.root instanceof Uint8Array), 'root stored as CryptoKey, not raw bytes'); }
  const msg = { conversationId: 'c1', role: 'user', content: 'my secret garden note', timestamp: '2026-09-30T12:00:00.000Z' };
  const sealed = await V.sealFor('FreeLatticeDB/messages', msg);
  assert.ok(sealed.sealed && sealed.sealed.ct, 'message sealed');
  assert.ok(!JSON.stringify(sealed).includes('secret garden'), 'no plaintext in the sealed record');
  assert.strictEqual(msg.content, 'my secret garden note', 'caller object untouched');
  const opened = await V.openFor('FreeLatticeDB/messages', sealed);
  assert.strictEqual(opened.content, msg.content, 'message opens');
  const conv = { id: 'c1', name: 'Talk about bees', title: 'Talk about bees', lastMessage: 'bees', contextNote: '', createdAt: 'x', updatedAt: 'y' };
  const sc = await V.sealFor('FreeLatticeDB/conversations', conv);
  assert.ok(!JSON.stringify(sc).includes('bees') && sc.updatedAt === 'y' && sc.id === 'c1', 'conversation names sealed, ids and dates kept');
  eq(await V.openFor('FreeLatticeDB/conversations', sc), conv, 'conversation opens');
  const mi = { id: 'c1', timestamp: 1, updatedAt: 2, title: 'bees', messages: [{ role: 'user', content: 'bees' }], tags: [], summary: 'bees', keywords: ['bees'] };
  const sm = await V.sealFor('FreeLatticeMemory/conversations', mi);
  assert.ok(!JSON.stringify(sm).includes('bees'), 'memory index copy sealed');
  eq(await V.openFor('FreeLatticeMemory/conversations', sm), mi, 'memory index opens');
  assert.strictEqual(await V.sealFor('FreeLatticeDB/meta', { key: 'k', value: 1 }).then((x) => x.sealed), undefined, 'uncovered stores pass through');

  // 2. tamper / AAD: moved record shows locked, blob kept, write-back restores it
  const moved = Object.assign({}, sealed, { conversationId: 'c2' });
  const lockedView = await V.openFor('FreeLatticeDB/messages', moved);
  assert.strictEqual(lockedView.content, V.LOCKED_TEXT, 'tampered record reads as locked, no throw');
  const back = await V.sealFor('FreeLatticeDB/messages', Object.assign({}, lockedView, { content: 'overwrite attempt' }));
  eq(back.sealed, sealed.sealed, 'locked placeholder never overwrites the sealed blob');
  assert.ok(!('content' in back) && !('_flLocked' in back), 'placeholder text is not stored');

  // 3. migration: mixed records, verify then swap
  const rows = [
    { id: 1, conversationId: 'c1', role: 'user', content: 'one', timestamp: 't1' },
    { id: 2, conversationId: 'c1', role: 'assistant', content: 'two', timestamp: 't2' },
    Object.assign({ id: 3 }, sealed)
  ];
  const ad = memAdapter(rows, 'id');
  const r1 = await V.migrate('FreeLatticeDB/messages', ad);
  assert.strictEqual(r1.sealed, 2, 'two plain records sealed');
  assert.strictEqual(r1.already, 1, 'already-sealed record left alone');
  assert.ok(rows.every((r) => r.sealed), 'every record sealed');
  const all = await V.openAll('FreeLatticeDB/messages', rows);
  eq(all.map((r) => r.content), ['one', 'two', 'my secret garden note'], 'all open to the original text');
  // compare-and-swap skip
  const rows2 = [{ id: 9, conversationId: 'c9', role: 'user', content: 'nine', timestamp: 't9' }];
  const ad2 = memAdapter(rows2, 'id');
  const realCas = ad2.cas;
  ad2.cas = async (snap, next) => { rows2[0].content = 'nine, edited'; return realCas(snap, next); };
  const r2 = await V.migrate('FreeLatticeDB/messages', ad2);
  assert.strictEqual(r2.sealed, 0, 'changed record skipped, not clobbered');
  assert.strictEqual(rows2[0].content, 'nine, edited', 'the newer plain text survives');

  // 4. same key store, new page load: same key ID, still opens
  const V2 = makeVault({ keyStore: ks });
  await V2.init();
  assert.strictEqual(V2.status().kid, V.status().kid, 'key persists across loads');
  assert.strictEqual((await V2.openFor('FreeLatticeDB/messages', sealed)).content, msg.content, 'opens after reload');

  // 5. key missing (fresh key store): old records locked, kept; new key, new ID
  const V3 = makeVault({ keyStore: memKeyStore() });
  await V3.init();
  assert.notStrictEqual(V3.status().kid, V.status().kid, 'a new key gets a new ID');
  const lk = await V3.openFor('FreeLatticeDB/messages', sealed);
  assert.strictEqual(lk.content, V3.LOCKED_TEXT, 'missing key: shown as locked');
  const rows3 = [Object.assign({ id: 5 }, sealed)];
  const before = JSON.stringify(rows3);
  await V3.migrate('FreeLatticeDB/messages', memAdapter(rows3, 'id'));
  assert.strictEqual(JSON.stringify(rows3), before, 'missing key: sealed records never rewritten');

  // 6. no WebCrypto: honest passthrough
  const V4 = makeVault({ noCrypto: true });
  await V4.init();
  assert.strictEqual(V4.status().mode, 'unavailable', 'unavailable without WebCrypto');
  const p = await V4.sealFor('FreeLatticeDB/messages', msg);
  assert.strictEqual(p.content, msg.content, 'stays plain and readable');
  assert.ok(/not sealed/.test(await V4.renderStatus()), 'status says plainly it is not sealed');

  // 7. backup dump opens sealed stores
  const dump = await V.openDump({ name: 'FreeLatticeDB', stores: { messages: [sealed], meta: [{ key: 'a' }] } });
  assert.strictEqual(dump.stores.messages[0].content, msg.content, 'backup file carries readable chats');

  // 8. static locks
  assert.ok(block.includes('stops casual reading') && block.includes('compromised device'), 'honest note in code');
  assert.ok(app.includes("if (el) el.textContent = text;"), 'status uses textContent');
  assert.ok(app.includes('id="flChatSealStatus"'), 'status line in Memory Vault');
  assert.ok(!/\u2014/.test(block), 'no em dash in the new block');
  assert.ok(!/confirm\(/.test(block), 'no confirm()');
  const rootIndex = path.join(ROOT, 'index.html');
  if (fs.existsSync(rootIndex)) assert.strictEqual(fs.readFileSync(rootIndex, 'utf8'), app, 'root index.html == docs/app.html');
  const privacy = fs.readFileSync(path.join(ROOT, 'docs', 'privacy.html'), 'utf8');
  assert.ok(privacy.includes('v-encrypt-chats-locally-v0.1') && privacy.includes('They are not locked with a password by default.'), 'privacy: Newer line layered, older line kept');
  // This brick never needs fl-connect.js or sw.js. (Other queued bricks may change them,
  // so check for this brick's fingerprints rather than diffing against main.)
  for (const rel of ['docs/modules/fl-connect.js', 'docs/sw.js', 'sw.js']) {
    const fp = path.join(ROOT, rel);
    if (fs.existsSync(fp)) assert.ok(!/FLChatVault|encrypt-chats-locally/.test(fs.readFileSync(fp, 'utf8')), rel + ' untouched by this brick');
  }

  // 9. Kirk's defaults (Oct 2): seal automatically, unlock key not in backups, a correction on the
  //    old phi-Salt changelog line, phi as a label only
  assert.ok(/setTimeout\(function \(\) \{ sealExisting\(\)\.then\(renderStatus\); \}, 3000\);/.test(app), 'seals automatically after load, no switch');
  const lsFnStart = app.indexOf("var FL_BACKUP_NEVER_EXPORT = ['fl_device_encryption_key'];");
  assert.ok(lsFnStart > 0, 'backup knows the unlock key never travels');
  const lsFnEnd = app.indexOf('    return data;\n  }', lsFnStart) + '    return data;\n  }'.length;
  const lsSrc = app.slice(lsFnStart, lsFnEnd);
  const lsData = { fl_device_encryption_key: 'a'.repeat(64), fl_apiKey_enc: 'SEALED', latticePoints: '5' };
  const fakeLS = { get length() { return Object.keys(lsData).length; }, key: (i) => Object.keys(lsData)[i], getItem: (k) => (k in lsData ? lsData[k] : null) };
  const exported = vm.runInNewContext(lsSrc + '\ngetAllLocalStorage();', { localStorage: fakeLS });
  assert.ok(!('fl_device_encryption_key' in exported), 'backup file leaves the unlock key out');
  assert.strictEqual(exported.latticePoints, '5', 'other settings still go in');
  assert.strictEqual(exported.fl_apiKey_enc, 'SEALED', 'sealed keys go in (they open only on the device that sealed them)');
  assert.ok(/if \(FL_BACKUP_NEVER_EXPORT\.indexOf\(key\) >= 0\) \{ lsKeptHere\+\+; return; \}/.test(app), 'restore never writes an unlock key back');
  assert.ok(/FL_BACKUP_SEALED_KEYS\.indexOf\(key\) >= 0 && localStorage\.getItem\(key\) != null\) \{ lsKeptHere\+\+; return; \}/.test(app), 'restore never replaces a key this device has');
  assert.ok(app.includes("Saved API keys open only on the device that sealed them; on another device, enter them again."), 'restore says keys must be entered again elsewhere');
  assert.ok(app.includes('A backup never carries the unlock key for chats or API keys.'), 'status line says the key is not in backups');
  assert.ok(privacy.includes('A backup never carries the unlock key, so saved API keys must be entered again after restoring on another device.'), 'privacy says it too');
  assert.ok(!/FreeLatticeVault/.test(app.slice(app.indexOf('const FlBackup = (function() {'), app.indexOf('const FlBackup = (function() {') + 600)), 'the chat key store is not in the backup list');
  const stale = app.indexOf('<p><strong>\u03C6-Salt Encryption</strong>');
  const fix = app.indexOf('<p class="v-encrypt-chats-locally-v0.1"><strong>Newer (October 2026), a correction to the line above:</strong>');
  assert.ok(stale > 0 && fix > stale && fix - stale < 600, 'the old phi-Salt line is kept and a correction sits under it');
  assert.ok(/The golden ratio adds no strength there\./.test(app), 'correction says phi adds no strength');
  assert.ok(block.includes('Phi is never the secret and adds no strength.') && block.includes('Phi is a\n// label here and nothing more'), 'phi is a label only, said in the code');
  assert.ok(!/phi[^\n]{0,40}(stronger|strength comes)/i.test(block), 'no claim that phi adds strength');

  console.log('SMOKE_OK encrypt chats locally v0.1');
})().catch((err) => { console.error('SMOKE_FAIL encrypt chats locally v0.1:', err && err.message); process.exit(1); });
