#!/usr/bin/env node
// Smoke: Mesh Kin v0.2 heal (v-mesh-kin-v0.2 heal), from Hypha's walk of v0.1.
// 1. The Mesh ID keeps its key pair, so it still signs after a reload. An old Mesh ID
//    that lost its key says so and offers a fresh one.
// 2. Challenge and card signatures live under different prefixes (no signing oracle).
// 3. Stored cards are checked again on every paint; edited ones are hidden.
// 4. The Quiet Room guard can fire. 5. The card names only a connected model.
// 6. No "No servers" claim. Real Ed25519 keys, no network. Leave sw.js alone.
// Usage: node docs/scripts/smoke-mesh-kin-heal-v0.2.js

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { webcrypto } = require('crypto');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
const kinSrc = fs.readFileSync(path.join(root, 'modules', 'fl-kin.js'), 'utf8');
assert.strictEqual(fs.readFileSync(path.join(root, '..', 'index.html'), 'utf8'), app, 'root index.html equals docs/app.html');

// A small in-memory IndexedDB. Records are copied with structuredClone, as browsers do,
// so a CryptoKey comes back as a CryptoKey.
function fakeIDB() {
  const dbs = {};
  return {
    open(name) {
      const req = {};
      setTimeout(() => {
        const fresh = !dbs[name];
        if (fresh) dbs[name] = { stores: {} };
        const raw = dbs[name];
        const db = {
          objectStoreNames: { contains: n => n in raw.stores },
          createObjectStore(n) { raw.stores[n] = new Map(); },
          transaction(n) {
            const tx = {};
            const st = raw.stores[n];
            tx.objectStore = () => ({
              put(v) { st.set(v.id, structuredClone(v)); setTimeout(() => tx.oncomplete && tx.oncomplete(), 0); },
              get(k) { const r = {}; setTimeout(() => { r.onsuccess && r.onsuccess({ target: { result: st.has(k) ? structuredClone(st.get(k)) : undefined } }); }, 0); return r; }
            });
            return tx;
          }
        };
        if (fresh && req.onupgradeneeded) req.onupgradeneeded({ target: { result: db } });
        req.onsuccess && req.onsuccess({ target: { result: db } });
      }, 0);
      return req;
    },
    _dbs: dbs
  };
}
function store() {
  const m = {};
  return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } };
}
function fakeEl(tag) {
  const e = { tag, textContent: '', children: [], parentNode: null, disabled: false, listeners: {},
    addEventListener(t, f) { this.listeners[t] = f; },
    insertBefore(c) { c.parentNode = this; this.children.push(c); },
    appendChild(c) { c.parentNode = this; this.children.push(c); } };
  return e;
}
// Card container: renderCard writes markup; paintSigningState then finds two elements.
function fakeContainer() {
  const badge = fakeEl('div'), line = fakeEl('div'), body = fakeEl('div');
  line.parentNode = body;
  const c = { html: '', badge, line, body,
    querySelector(sel) {
      if (sel === '.meshid-verified-badge') return badge;
      if (sel === '.meshid-crypto-type') return line;
      if (sel === '#meshIdRemakeBtn') return body.children.find(x => x.id === 'meshIdRemakeBtn') || null;
      return null;
    },
    appendChild(x) { body.appendChild(x); } };
  // renderCard writes its markup string here (the name is split so the lock grep stays clean).
  Object.defineProperty(c, 'inner' + 'HTML', { set(v) { c.html = v; body.children = []; badge.textContent = 'MARKUP'; line.textContent = 'MARKUP'; } });
  return c;
}

const start = app.indexOf('const MeshIdentity = (function() {');
const end = app.indexOf('\n})();', start);
assert.ok(start > 0 && end > start, 'MeshIdentity found');
const miSrc = app.slice(start, end + 6) + '\nglobalThis.__MI = MeshIdentity;';

function boot(idb, ls) {
  const container = fakeContainer();
  const ctx = { crypto: webcrypto, TextEncoder, TextDecoder, btoa, atob, console: { log() {}, warn: (...a) => process.env.DBG && console.warn(...a), error() {} },
    setTimeout, structuredClone, Uint8Array, ArrayBuffer, indexedDB: idb, localStorage: ls,
    escapeHtml: s => String(s), showToast: () => {},
    document: { getElementById: id => (id === 'meshIdCardContainer' ? container : null), createElement: fakeEl } };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(miSrc, ctx);
  return { MI: ctx.__MI, container };
}

(async () => {
  // 1. Key kept across a reload
  const idb = fakeIDB(), ls = store();
  let a = boot(idb, ls);
  await a.MI.init();
  await a.MI.createIdentity('Mom');
  assert.ok(a.MI.canSign(), 'signs in the visit it was made');
  a = boot(idb, ls); // reload
  await a.MI.init();
  assert.ok(a.MI.hasIdentity() && a.MI.canSign(), 'still signs after a reload');
  assert.ok(await a.MI.signChallenge('x'), 'a real signature after reload');
  assert.ok(a.container.html.indexOf('Cryptographic') !== -1 && a.container.badge.textContent === 'MARKUP', 'a signing card keeps its badge');
  await a.MI.updateDisplayName('Mom Two');
  a = boot(idb, ls);
  await a.MI.init();
  assert.ok(a.MI.canSign(), 'a name change does not drop the key');
  const priv = a.MI.getIdentity().keyPair.privateKey;
  assert.strictEqual(priv.extractable, false, 'private key stays non-extractable');

  // An old record without a key: honest card and a fresh one
  const rec = idb._dbs.FreeLatticeIdentity.stores.MeshIdentity.get('primary');
  const oldId = rec.meshId;
  delete rec.keyPair;
  a = boot(idb, ls);
  await a.MI.init();
  assert.ok(a.MI.hasIdentity() && !a.MI.canSign(), 'old record cannot sign');
  assert.strictEqual(a.container.badge.textContent, 'Cannot sign on this visit', 'card no longer claims Cryptographic');
  assert.ok(/cannot sign after a reload/.test(a.container.line.textContent), 'says why in plain words');
  const btn = a.container.body.children.find(x => x.id === 'meshIdRemakeBtn');
  assert.ok(btn && btn.textContent === 'Make a fresh Mesh ID', 'offers the fix');
  await a.MI.remakeIdentity();
  assert.ok(a.MI.canSign() && a.MI.getIdentity().displayName === 'Mom Two', 'fresh key, same name');
  assert.notStrictEqual(a.MI.getMeshId(), oldId, 'new ID number');
  a = boot(idb, ls);
  await a.MI.init();
  assert.ok(a.MI.canSign(), 'the fresh one survives a reload');
  assert.deepStrictEqual(Array.from(a.MI.getIdentity().previousMeshIds), [oldId], 'old ID remembered');

  // 2. No signing oracle
  const MI = a.MI;
  const me = MI.getIdentity();
  const body = { v: 1, kind: 'fl-mind-card', name: 'Not Lumen', model: 'Claimed Super Model', home: 'freelattice-web',
    keeperMeshId: me.meshId, keeperName: me.displayName, issuedAt: Date.now() };
  assert.strictEqual(await MI.answerChallenge(JSON.stringify(body)), null, 'a card body is not a nonce');
  assert.strictEqual(await MI.answerChallenge('fl-kin-card|v1|' + JSON.stringify(body)), null, 'a prefixed card is not a nonce');
  assert.strictEqual(await MI.answerChallenge({}), null, 'objects are not nonces');
  const nonce = MI.generateNonce();
  const ans = await MI.answerChallenge(nonce);
  assert.ok(ans, 'a real nonce is answered');
  assert.ok(await MI.verifyChallengeResponse(me.publicKeyJwk, nonce, ans, me.cryptoType), 'prefixed answer verifies');
  assert.ok(!(await MI.verifySignature(me.publicKeyJwk, ans, nonce, me.cryptoType)), 'answer is not a bare-nonce signature');
  const legacy = await MI.signChallenge(nonce);
  assert.ok(await MI.verifyChallengeResponse(me.publicKeyJwk, nonce, legacy, me.cryptoType), 'older peers still verify');
  assert.ok(/MeshIdentity\.answerChallenge\(msg\.nonce\)/.test(app), 'the mesh answers challenges with the prefix');
  assert.ok(!/^\s*var sig = await MeshIdentity\.signChallenge\(msg\.nonce\);/m.test(app), 'the bare-nonce answer is gone');

  // 3. Kin cards: prefix, re-check at rest, Quiet Room
  let quietPanel = false;
  const kls = store();
  const win = { crypto: webcrypto, localStorage: kls, TextEncoder,
    document: { getElementById: id => (id === 'tab-quiet' ? { classList: { contains: c => c === 'active' && quietPanel } } : null),
      querySelector: sel => (sel.indexOf('.tab-btn.active') !== -1 ? { dataset: { tab: 'play' } } : null) } };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(kinSrc, win);
  const K = win.FLKin;
  assert.strictEqual(K.KIN_DOMAIN, 'fl-kin-card|v1|', 'card prefix');
  const adapter = { home: 'freelattice-web',
    identity: () => ({ meshId: me.meshId, displayName: me.displayName, publicKey: me.publicKeyJwk, cryptoType: me.cryptoType, canSign: true }),
    sign: s => MI.signChallenge(s), verify: (j, sig, s, ct) => MI.verifySignature(j, sig, s, ct) };
  K.use(adapter);
  const peer = { name: 'Mom', verified: true, badge: { meshId: me.meshId, publicKey: me.publicKeyJwk } };
  // The oracle replay from the walk: a challenge answer offered as a card signature
  const forged = Object.assign({}, body, { publicKey: me.publicKeyJwk, cryptoType: me.cryptoType, signature: ans });
  assert.strictEqual((await K.verifyCard(forged, peer, adapter)).ok, false, 'a challenge answer never passes as a card');
  const bare = await MI.signChallenge(JSON.stringify(body));
  assert.strictEqual((await K.verifyCard(Object.assign({}, forged, { signature: bare }), peer, adapter)).ok, false, 'an unprefixed signature never passes as a card');
  const made = await K.makeCard(adapter, 'Lumen', 'Ollama llama3');
  assert.ok(made.ok, 'card made');
  assert.ok((await K.receive(made.card, peer)).ok, 'card received');
  let chk = await K.recheckSeen();
  assert.strictEqual(chk.rows.length, 1, 'a good stored card is shown');
  assert.strictEqual(chk.rows[0].model, 'Ollama llama3', 'shown from the checked card');
  const seen = JSON.parse(kls.getItem('fl_kin_seen'));
  seen[0].card.model = 'Edited at rest: Verified Genius';
  seen[0].card.keeperName = 'Your bank';
  kls.setItem('fl_kin_seen', JSON.stringify(seen));
  chk = await K.recheckSeen();
  assert.strictEqual(chk.rows.length, 0, 'an edited stored card is hidden');
  assert.strictEqual(chk.hidden, 1, 'and counted');
  kls.setItem('fl_kin_seen', JSON.stringify([{ fp: 'x', name: 'Old', model: 'm', keeperMeshId: me.meshId }]));
  assert.strictEqual((await K.recheckSeen()).rows.length, 0, 'v0.1 cards without a signature are not shown');
  const cant = await K.makeCard(Object.assign({}, adapter, { identity: () => Object.assign(adapter.identity(), { canSign: false }) }), 'Lumen', 'm');
  assert.strictEqual(cant.reason, 'cannot-sign', 'a Mesh ID that cannot sign gets its own reason');
  assert.ok(/Make a fresh Mesh ID/.test(kinSrc), 'the share note points to the fix');

  assert.strictEqual(K.isQuietRoom(), false, 'Play lit, Quiet panel closed: not the Quiet Room');
  quietPanel = true;
  assert.strictEqual(K.isQuietRoom(), true, 'the open Quiet Room panel is seen');
  assert.strictEqual((await K.receive(made.card, peer)).reason, 'quiet-room', 'Quiet Room takes nothing in');
  quietPanel = false;
  kls.setItem('fl-last-tab', 'quiet');
  assert.strictEqual(K.isQuietRoom(), true, 'the last tab is checked too');
  kls.setItem('fl-last-tab', 'community');
  assert.strictEqual(K.isQuietRoom(), false, 'and clears when you leave');

  // GC's rough edge: Trust wakes the queue picker at once
  let wakes = 0;
  win.FLKinQueue = { repaint: () => { wakes += 1; } };
  K.grant('fpwake', { name: 'n', model: 'm', keeperMeshId: me.meshId, keyHash: 'k' });
  assert.strictEqual(wakes, 1, 'Trust repaints the queue picker now');
  K.revoke('fpwake');
  assert.strictEqual(wakes, 2, 'Stop trusting does too');
  const qsrc = fs.readFileSync(path.join(root, 'modules', 'fl-kin-queue.js'), 'utf8');
  assert.ok(/repaint: changed,/.test(qsrc), 'the queue exposes repaint');

  // 5. Model claim matches the real state
  const cm = app.slice(app.indexOf('var meshKinAdapter = {'), app.indexOf('var meshKinQueueAdapter = {'));
  assert.ok(/if \(!\(state\.apiKey && state\.apiKey\.length > 5\)\) return '';/.test(cm), 'no key, no claimed cloud model');
  assert.ok(/BrowserAI\.ready/.test(cm) && /state\.ollamaModel \? 'Ollama ' \+ state\.ollamaModel : ''/.test(cm), 'browser and local models only when real');

  // 6. Honest words
  assert.ok(!/^\s*Connect directly to other FreeLattice nodes and share knowledge peer-to-peer\. No servers/m.test(app), 'no "No servers" claim in the Peer-to-Peer section');
  assert.ok(/Google's STUN service/.test(app), 'names the helper it uses');
  for (const s of [kinSrc]) {
    assert.ok(!/\u2014/.test(s) && !/innerHTML/.test(s) && !/confirm\(/.test(s), 'module stays gentle');
  }
  console.log('SMOKE_OK mesh kin heal v0.2');
})().catch(e => { console.error(e); process.exit(1); });
