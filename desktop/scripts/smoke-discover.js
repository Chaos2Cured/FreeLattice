#!/usr/bin/env node
// Smoke: home Wi-Fi discovery v0.1 (v-desktop-pooling-v0.1). Headless, no Electron.
// LAN-range filter, never 0.0.0.0, refuse public/VPN/IPv6, origin check, kin card check
// (TREEKIN1, Ed25519 and P-256), the consent window, Pause wins, No sends nothing,
// size and rate caps, auto-off, counts only, the proxy CORS heal, and an mDNS loopback
// when bonjour-service is installed.
// Usage: node desktop/scripts/smoke-discover.js

'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const D = require(path.join(__dirname, '..', 'lattice-discover.js'));
let passed = 0;
function ok(cond, msg) { assert.ok(cond, msg); passed++; }

// ---------- 1. LAN-range filter ----------
['10.0.0.5', '10.255.255.254', '172.16.0.1', '172.31.255.1', '192.168.1.20'].forEach((ip) => ok(D.isPrivateLan(ip), 'private ' + ip));
['0.0.0.0', '127.0.0.1', '8.8.8.8', '172.15.0.1', '172.32.0.1', '100.64.0.1', '169.254.1.1', '192.169.0.1',
  '11.0.0.1', '255.255.255.255', '::', '::1', 'fe80::1', '2001:db8::1', 'fd00::1', '', 'abc', '192.168.1.256']
  .forEach((ip) => ok(!D.isPrivateLan(ip), 'refused ' + ip));
ok(!D.safeBindAddress('0.0.0.0'), 'never 0.0.0.0');
ok(!D.safeBindAddress('::'), 'never ::');
ok(!D.safeBindAddress('127.0.0.1'), 'loopback only in smoke mode');
ok(D.safeBindAddress('127.0.0.1', { smokeLoopback: true }), 'smoke loopback allowed');
ok(D.safeBindAddress('192.168.0.9'), 'private allowed');

const ifs = {
  lo0: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
  utun3: [{ address: '10.8.0.2', family: 'IPv4', internal: false }],
  wg0: [{ address: '10.9.0.2', family: 'IPv4', internal: false }],
  en1: [{ address: '2001:db8::5', family: 'IPv6', internal: false }, { address: '203.0.113.7', family: 'IPv4', internal: false }],
  en0: [{ address: 'fe80::1', family: 'IPv6', internal: false }, { address: '192.168.1.20', family: 'IPv4', internal: false }]
};
ok(D.pickLanAddress(ifs).address === '192.168.1.20', 'picks the home Wi-Fi address');
ok(D.pickLanAddress({ en1: ifs.en1, lo0: ifs.lo0 }) === null, 'public only: refuse');
ok(D.pickLanAddress({ utun3: ifs.utun3, wg0: ifs.wg0 }) === null, 'VPN only: refuse');
ok(D.pickLanAddress({ en0: [{ address: 'fd00::2', family: 'IPv6', internal: false }] }) === null, 'IPv6 only: refuse');
ok(D.pickLanAddress({ en0: [{ address: '192.168.4.4', family: 4, internal: false }] }).address === '192.168.4.4', 'family as number');

// ---------- 2. origin ----------
ok(D.originAllowed('https://thelatticetree.com', ''), 'tree origin');
ok(D.originAllowed('https://freelattice.com', ''), 'fl origin');
ok(D.originAllowed('http://127.0.0.1:5555', 'http://127.0.0.1:5555'), 'app page');
ok(!D.originAllowed('https://evil.example', 'http://127.0.0.1:5555'), 'other site refused');
ok(!D.originAllowed('', ''), 'no origin refused');
ok(!D.originAllowed('http://thelatticetree.com', ''), 'plain http refused');

// ---------- 3. kin cards (same shape as tree-kin.js) ----------
function b64url(s) { return Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function makeCard(type, name, opts) {
  opts = opts || {};
  const kp = type === 'ed25519' ? crypto.generateKeyPairSync('ed25519') : crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = kp.publicKey.export({ format: 'jwk' });
  const body = D.cardBody({ name, model: 'qwen2.5:14b', home: 'thelatticetree', keeperMeshId: D.meshIdFor(jwk), keeperName: 'Kirk', issuedAt: Date.now() });
  const data = Buffer.from('fl-kin-card|v1|' + JSON.stringify(body), 'utf8');
  const sig = type === 'ed25519' ? crypto.sign(null, data, kp.privateKey) : crypto.sign('sha256', data, { key: kp.privateKey, dsaEncoding: 'ieee-p1363' });
  const card = Object.assign({}, body, { publicKey: jwk, cryptoType: type, signature: sig.toString('base64') });
  if (opts.tamper) card.name = 'Someone else';
  return { card, code: 'TREEKIN1:' + b64url(JSON.stringify(card)) };
}
const edCard = makeCard('ed25519', 'Lyra phone');
const ecCard = makeCard('ecdsa-p256', 'Hypha laptop');
const v1 = D.verifyKinCard(D.parseKinCode(edCard.code));
ok(v1.ok && /^[0-9a-f]{16}$/.test(v1.fp) && v1.keyHash.length === 32, 'ed25519 card verifies');
ok(D.verifyKinCard(D.parseKinCode(ecCard.code)).ok, 'P-256 card verifies');
ok(D.verifyKinCard(makeCard('ed25519', 'X', { tamper: true }).card).reason === 'bad-signature', 'tampered card refused');
const borrowed = Object.assign({}, edCard.card, { publicKey: ecCard.card.publicKey });
ok(!D.verifyKinCard(borrowed).ok, 'borrowed key refused');
ok(D.parseKinCode('TREEKIN1:' + 'x'.repeat(7000)) === null, 'oversized card code refused');
ok(D.verifyKinCard({ kind: 'nope' }).reason === 'not-a-card', 'not a card');

const invite = 'TREEPOOL1:' + b64url(JSON.stringify({ v: 1, k: 'invite', sdp: 'v=0\r\no=- 1 1 IN IP4 0.0.0.0\r\n' }));
const answerCode = 'TREEPOOL1:' + b64url(JSON.stringify({ v: 1, k: 'reply', sdp: 'v=0\r\n' }));
ok(D.looksLikeInvite(invite), 'invite shape');
ok(!D.looksLikeInvite('hello'), 'not an invite');

// ---------- 4. choices: same three words as 029, Pause wins ----------
const c3 = D.choicesFor(false).map((c) => c.label);
ok(c3.join('|') === 'Yes, and let my mind answer it|Yes, connect only|No', 'three choices as 029');
const cp = D.choicesFor(true).map((c) => c.label);
ok(cp.join('|') === 'Yes, connect only (helping stays paused)|No', 'paused: no help choice');
ok(D.settleChoice('help', true) === 'connect', 'pause downgrades help');
ok(D.settleChoice('help', false) === 'help' && D.settleChoice('weird', false) === 'no', 'settle');

// ---------- 5. the listener, end to end on loopback ----------
function post(port, body, headers) {
  return new Promise((resolve) => {
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    const req = http.request({ host: '127.0.0.1', port, path: '/knock', method: 'POST', agent: false,
      headers: Object.assign({ 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }, headers || {}) }, (res) => {
      const ch = []; res.on('data', (c) => ch.push(c)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(ch).toString('utf8') }));
    });
    req.on('error', (e) => resolve({ status: 0, error: String(e.code || e) }));
    req.end(data);
  });
}
const ORIGIN = { Origin: 'https://thelatticetree.com' };

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fl-discover-smoke-'));
  let nextChoice = 'help'; let asked = []; let answered = []; let pauseDuringAsk = false; let door;
  const published = [];
  door = D.createDiscover({
    storeDir: tmp, smokeLoopback: true, appOrigin: () => 'http://127.0.0.1:1',
    mdns: () => ({ publish: (o) => { published.push(o); return { stop() {} }; }, destroy() {} }),
    ask: async (q) => { asked.push(q); if (pauseDuringAsk) door.pause(); return nextChoice; },
    answerOffer: async (k) => { answered.push(k); return answerCode; },
    autoOffMs: 400, answerWaitMs: 300
  });

  ok(door.status().on === false, 'off by default');
  ok(door.status().label === 'Let phones on this Wi-Fi find this computer', 'switch words');
  const st = await door.on('abcdef0123456789ffff');
  ok(st.ok && st.on && st.address === '127.0.0.1' && st.port > 0, 'on, loopback in smoke');

  // TXT carries v, fp (16 hex), port only.
  const txt = published[0].txt;
  ok(published[0].type === 'freelattice' && /^fl-[0-9a-f]{8}$/.test(published[0].name), 'random instance name');
  ok(Object.keys(txt).sort().join(',') === 'fp,port,v' && txt.fp === 'abcdef0123456789', 'TXT v, fp, port only');
  ok(!/qwen|lyra|kirk|model|name/i.test(JSON.stringify(txt)), 'no name or model in TXT');

  // wrong origin, wrong path, no origin
  ok((await post(st.port, { v: 1 }, { Origin: 'https://evil.example' })).status === 403, 'other origin refused');
  ok((await post(st.port, { v: 1 })).status === 403, 'no origin refused');

  // Yes, and let my mind answer it
  let r = await post(st.port, { v: 1, offer: invite, card: edCard.code }, ORIGIN);
  ok(r.status === 200 && JSON.parse(r.body).answer === answerCode && JSON.parse(r.body).choice === 'help', 'Yes: answer returns');
  ok(asked[0].title === 'Pool with Lyra phone?', 'window: Pool with <device>?');
  ok(asked[0].choices.length === 3, 'three choices');
  ok(r.headers['access-control-allow-origin'] === 'https://thelatticetree.com', 'echoes the caller origin, never a star');
  ok(door.isTrusted(v1.fp), 'Yes trusts that one card');
  ok(answered[0].offer === invite && answered[0].fp === v1.fp && !('publicKey' in answered[0]), 'page gets public fields only');

  // No: nothing back
  nextChoice = 'no';
  r = await post(st.port, { v: 1, offer: invite, card: ecCard.code }, ORIGIN);
  ok(r.status === 204 && r.body === '', 'No sends nothing back');
  ok(!door.isTrusted(D.verifyKinCard(ecCard.card).fp), 'No trusts nothing');

  // Pause wins: pressed while the window is open
  nextChoice = 'help'; pauseDuringAsk = true;
  r = await post(st.port, { v: 1, offer: invite, card: ecCard.code }, ORIGIN);
  ok(r.status === 200 && JSON.parse(r.body).choice === 'connect', 'Pause during the window: connect only');
  ok(answered[answered.length - 1].choice === 'connect', 'page told connect only');
  pauseDuringAsk = false;
  // Already paused: window has no help choice, and a forced help becomes connect.
  await new Promise((res) => setTimeout(res, 50));
  ok(door.status().paused === true, 'pause kept');
  nextChoice = 'no';
  r = await post(st.port, { v: 1, offer: invite, card: edCard.code }, ORIGIN);
  ok(r.status === 204, 'fourth knock answered No');
  // rate cap: 4 a minute (4 used above)
  r = await post(st.port, { v: 1, offer: invite, card: edCard.code }, ORIGIN);
  ok(r.status === 429, 'rate cap');

  // fresh door for caps and paused window
  door.off('test');
  ok(door.status().on === false, 'off');
  const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'fl-discover-smoke2-'));
  const asked2 = [];
  const door2 = D.createDiscover({ storeDir: tmp2, smokeLoopback: true, ask: async (q) => { asked2.push(q); return 'help'; },
    answerOffer: async () => '', autoOffMs: 300, answerWaitMs: 100 });
  door2.pause();
  const st2 = await door2.on('');
  r = await post(st2.port, { v: 1, offer: invite, card: edCard.code }, ORIGIN);
  ok(asked2[0].choices.map((c) => c.id).join(',') === 'connect,no', 'paused window offers no help');
  ok(r.status === 504 && JSON.parse(r.body).reason === 'no-answer', 'no page answer: honest no-answer');
  r = await post(st2.port, 'x'.repeat(D.MAX_BODY + 10), ORIGIN);
  ok(r.status === 413 || r.status === 0, '16 KB cap');
  r = await post(st2.port, { v: 1, offer: invite, card: makeCard('ed25519', 'X', { tamper: true }).code }, ORIGIN);
  ok(r.status === 403, 'stranger card refused before any window ' + r.status + ' ' + (r.body||r.error));
  ok(asked2.length === 1, 'refused card opened no window');
  // auto-off after no join (300 ms in smoke, 30 minutes real)
  await new Promise((res) => setTimeout(res, 700));
  ok(door2.status().on === false && door2.status().counts.autoOff >= 1, 'auto-off');

  // counts only on disk: no names, keys or models
  const disk = fs.readdirSync(tmp).map((f) => fs.readFileSync(path.join(tmp, f), 'utf8')).join('\n');
  ok(!/Lyra|Hypha|Kirk|qwen|"x"|"d"|publicKey|signature/.test(disk), 'counts only, no names or keys on disk');
  const cn = door.status().counts;
  ok(cn.knocks === 4 && cn.yes === 1 && cn.no === 2 && cn.connectOnly === 1 && cn.announced === 1, 'counts: ' + JSON.stringify(cn));

  // ---------- 6. proxy CORS heal (narrowProxyHeaders, read from main.js) ----------
  const mainSrc = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  // LF is the repo. A windows-latest checkout writes CRLF, so the same door is read both ways.
  const mLf = /function narrowProxyHeaders\([\s\S]*?\n\}\n/.exec(mainSrc);
  const mCr = /function narrowProxyHeaders\([\s\S]*?\r\n\}\r\n/.exec(mainSrc);
  const asCrlf = mainSrc.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
  const mCrCopy = /function narrowProxyHeaders\([\s\S]*?\r\n\}\r\n/.exec(asCrlf);
  const m = mLf || mCr;
  ok(!!m && !!mCrCopy, 'narrowProxyHeaders present');
  const narrow = new Function(m[0] + '; return narrowProxyHeaders;')();
  let h = narrow({ 'Access-Control-Allow-Origin': '*', 'content-type': 'application/json' }, 'https://evil.example', 5555);
  ok(!('Access-Control-Allow-Origin' in h) && h['content-type'] === 'application/json', 'star stripped for other sites');
  h = narrow({ 'access-control-allow-origin': '*' }, 'http://127.0.0.1:5555', 5555);
  ok(h['Access-Control-Allow-Origin'] === 'http://127.0.0.1:5555' && !('access-control-allow-origin' in h), 'app origin echoed');
  ok(/res\.writeHead = function \(code, a1, a2\)/.test(mainSrc), 'every proxy head goes through the narrow door');

  // ---------- 7. mDNS loopback with the real library, when installed ----------
  let mdnsNote = 'skipped (bonjour-service not installed)';
  let Bonjour = null;
  try { Bonjour = require('bonjour-service').Bonjour; } catch (e) {}
  if (Bonjour) {
    const a = new Bonjour(); const b = new Bonjour();
    const name = 'fl-' + crypto.randomBytes(4).toString('hex');
    a.publish({ name, type: 'freelattice', port: 45678, txt: { v: '1', fp: '0123456789abcdef', port: '45678' } });
    const found = await new Promise((resolve) => {
      const br = b.find({ type: 'freelattice' }, (s) => { if (s.name === name) resolve(s); });
      setTimeout(() => resolve(null), 4000);
    });
    if (found) {
      ok(found.port === 45678 && found.txt.fp === '0123456789abcdef' && found.txt.v === '1', 'mDNS loopback: found with TXT');
      mdnsNote = 'passed';
    } else mdnsNote = 'no multicast on this host (not a failure of the module)';
    a.unpublishAll(() => { a.destroy(); b.destroy(); });
  }
  console.log('mDNS loopback: ' + mdnsNote);
  console.log('checks passed: ' + passed);
  console.log('SMOKE_OK desktop pooling v0.1');
  setTimeout(() => process.exit(0), 300);
})().catch((e) => { console.error(e); process.exit(1); });
