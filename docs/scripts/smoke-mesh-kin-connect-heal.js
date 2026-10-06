#!/usr/bin/env node
// Smoke: Mesh Kin connect heal (v-mesh-kin-connect-heal), from Hypha's walk of v0.1.
// Start and Join show their codes; honest words about two long codes and STUN; 10 minutes,
// not 30 seconds; AI cards in plain view with a signal when one arrives; real-size controls;
// Mom words (no keeper, vouched, Offer/Answer). Real Ed25519 keys, no network.
// Usage: node docs/scripts/smoke-mesh-kin-connect-heal.js

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { webcrypto } = require('crypto');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
const src = fs.readFileSync(path.join(root, 'modules', 'fl-kin.js'), 'utf8');
assert.strictEqual(fs.readFileSync(path.join(root, '..', 'index.html'), 'utf8'), app, 'root index.html equals docs/app.html');
const live = app.split('\n').filter(l => !/before v-mesh-kin-connect-heal/.test(l)).join('\n');

// 1. Start and Join show what they made
assert.ok(/function meshRevealCodeArea\(areaId\)/.test(app), 'reveal helper');
for (const id of ['meshOfferArea', 'meshJoinArea', 'meshAnswerArea']) {
  assert.ok(app.indexOf("meshRevealCodeArea('" + id + "')") !== -1, 'reveals ' + id);
}
assert.ok(/details && !details\.open\) details\.open = true/.test(app), 'opens the collapsed details');
assert.ok(/const MESH_HANDSHAKE_TIMEOUT = 10 \* 60 \* 1000;/.test(app), '10 minutes to answer');
assert.ok(!/^const MESH_HANDSHAKE_TIMEOUT = 30000;/m.test(app), '30 seconds is gone');
assert.ok(/showToast\(MESH_TIMEOUT_WORDS, 9000\);[\s\S]{0,40}meshCancelOffer\(\)/.test(app) && /showToast\(MESH_TIMEOUT_WORDS, 9000\);[\s\S]{0,40}meshCancelJoin\(\)/.test(app), 'timeouts give a reason and a next step');
assert.ok(/if \(!iceCandidates\.length\) showToast\(/.test(app), 'says when the network hid the address');

// 2. Honest words
assert.ok(!/No accounts\. No servers\.<\/div>/.test(app), 'no "No servers" promise on the Community card');
assert.ok(/Google's free STUN helper/.test(live), 'names the helper');
assert.ok(/not used to connect/.test(live), 'the short code is not sold as the way to connect');
assert.ok(!/>\s*Generate Answer\s*</.test(live) && !/<label>Your Offer Code/.test(live) && !/<label>Your Answer Code/.test(live), 'no Offer/Answer jargon on screen');
assert.ok(/invite code/.test(live) && /reply code/.test(live), 'invite and reply codes');

// 3. AI cards in plain view, and a signal
assert.ok(/sharedSection\.parentNode\.insertBefore\(kinSection, sharedSection\)/.test(app), 'Kin moves out of the collapsed details');
assert.ok(/AI cards from people you connected with/.test(live), 'plain heading');
assert.ok(/shared an AI card: /.test(app) && /It is on Community, under AI cards\./.test(app), 'a toast when a card arrives');
assert.ok(/\.then\(function \(r\) \{\s*if \(r && r\.ok && msg\.card\) showToast/.test(app), 'only for cards that passed the checks');

// 4. Sizes and contrast
assert.ok(/min-height:44px;font-size:1rem/.test(src), 'Kin buttons 44px, 16px text');
assert.ok(/\.fl-kin-name::placeholder\{color:rgba\(255,255,255,0\.72\);\}/.test(src), 'placeholder readable');
assert.ok(/\.fl-kin-act\{display:block;margin:8px 0 0 auto;\}/.test(src), 'row button sits right, clear of the floating button');
assert.ok(/<summary style="cursor:pointer;font-size:1rem;color:rgba\(255,255,255,0\.8\);padding:10px 0;min-height:44px;/.test(app), 'Community details summary 16px and clearer');
assert.ok(/padding-bottom:120px;/.test(app) && /scroll-margin-bottom:140px/.test(app), 'room above the bottom bars');
assert.ok(/<span style="font-size:1rem;font-weight:400;color:rgba\(255,255,255,0\.78\);margin-left:6px;">&middot; mesh, debug, developer \(your Mesh ID/.test(app), 'Settings Advanced line 16px, clearer');

// 5. Mom words in the module, with real keys
function store() { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; }
function node(tag) {
  return { tag, children: [], textContent: '', className: '', style: {}, attrs: {}, listeners: {},
    appendChild(c) { this.children.push(c); return c; }, removeChild(c) { this.children = this.children.filter(x => x !== c); },
    get firstChild() { return this.children[0] || null; }, setAttribute(k, v) { this.attrs[k] = v; },
    addEventListener(t, f) { this.listeners[t] = f; } };
}
const head = node('head');
const doc = { head, createElement: node, getElementById: id => (id === 'flKinStyle' ? head.children.find(c => c.id === 'flKinStyle') || null : null), querySelector: () => null };
const win = { crypto: webcrypto, localStorage: store(), TextEncoder, document: doc };
win.window = win;
vm.createContext(win);
vm.runInContext(src, win);
const K = win.FLKin;
assert.strictEqual(K.CONNECT_HEAL, 'v-mesh-kin-connect-heal', 'marker');
assert.ok(/It does not prove what the model is\./.test(K.HONEST) && !/keeper|vouch/i.test(K.HONEST), 'honest line in plain words');
function allText(n) { return (n.textContent || '') + ' ' + (n.placeholder || '') + ' ' + n.children.map(allText).join(' '); }

(async () => {
  const kp = await webcrypto.subtle.generateKey('Ed25519', false, ['sign', 'verify']);
  const jwk = await webcrypto.subtle.exportKey('jwk', kp.publicKey);
  const b64 = buf => Buffer.from(new Uint8Array(buf)).toString('base64');
  const enc = new TextEncoder();
  const meshId = 'mesh:AbCdEfGh1234567890';
  const adapter = { home: 'freelattice-web',
    identity: () => ({ meshId, displayName: 'Mom', publicKey: jwk, cryptoType: 'ed25519', canSign: true }),
    sign: async s => b64(await webcrypto.subtle.sign('Ed25519', kp.privateKey, enc.encode(s))),
    verify: async (j, sig, s) => webcrypto.subtle.verify('Ed25519', await webcrypto.subtle.importKey('jwk', j, 'Ed25519', true, ['verify']), Buffer.from(sig, 'base64'), enc.encode(s)),
    peers: () => [], currentModel: () => 'Ollama llama3' };
  const host = node('div');
  K.mount(host, adapter);
  assert.ok(head.children.some(c => c.id === 'flKinStyle' && /min-height:44px/.test(c.textContent)), 'style added once');
  K.mount(host, adapter);
  assert.strictEqual(head.children.filter(c => c.id === 'flKinStyle').length, 1, 'not twice');
  const made = await K.makeCard(adapter, 'Lumen', 'Ollama llama3');
  await K.receive(made.card, { name: 'Mom', verified: true, badge: { meshId, publicKey: jwk } });
  await K.painted();
  let t = allText(host);
  assert.ok(/From Mom's computer \(ID AbCdEfGh\)\./.test(t), 'who it is from, short ID without "mesh:"');
  assert.ok(/Not trusted yet\. Trusting lets you send this AI questions/.test(t), 'says what Trust does');
  assert.ok(/Trust this AI/.test(t), 'plain button');
  assert.ok(!/keeper|vouch|Vouched|Seen, not trusted|verified peer|Revoke/i.test(t), 'no jargon on screen: ' + t);
  const wrap = host.children[0];
  const list = wrap.children.find(c => c.className === 'fl-kin-list');
  const row = list.children.find(c => c.className === 'fl-kin-row');
  row.children.find(c => c.className === 'fl-kin-act').listeners.click();
  await K.painted();
  t = allText(host);
  assert.ok(/Trusted\. You can send this AI questions below\./.test(t) && /Stop trusting/.test(t), 'trusted words');
  // share with nobody connected, and with no Mesh ID
  const name = wrap.children.find(c => c.className === 'fl-kin-name');
  name.value = 'Lumen';
  const note = wrap.children.find(c => c.className === 'fl-kin-note');
  wrap.children.find(c => c.className === 'fl-kin-share').listeners.click();
  await new Promise(r => setTimeout(r, 50));
  assert.ok(/No one is connected yet\./.test(note.textContent), 'nobody connected, plain');
  adapter.identity = () => null;
  wrap.children.find(c => c.className === 'fl-kin-share').listeners.click();
  await new Promise(r => setTimeout(r, 50));
  assert.strictEqual(note.textContent, 'Make your Mesh ID first: Settings, then Advanced, then Mesh ID.', 'the right path to the Mesh ID');
  assert.ok(!/\u2014/.test(src) && !/innerHTML/.test(src) && !/confirm\(/.test(src), 'module stays gentle');
  console.log('SMOKE_OK mesh kin connect heal');
})().catch(e => { console.error(e); process.exit(1); });
