// smoke-reconnect.js (MIT) v-tree-reconnect-v0.1 (034). Headless. No Electron.
// A remembered phone comes back. Pause wins. Keep-on is not a page setter.
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const D = require(path.join(__dirname, '..', 'lattice-discover.js'));

let passed = 0;
function ok(cond, msg) {
  if (!cond) { console.log('FAIL ' + msg); assert.ok(false, msg); }
  passed++;
}
function b64url(s) { return Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function makeCard(name) {
  const kp = crypto.generateKeyPairSync('ed25519');
  const jwk = kp.publicKey.export({ format: 'jwk' });
  const body = D.cardBody({ name: name, model: 'asks-only', home: 'thelatticetree', keeperMeshId: D.meshIdFor(jwk), keeperName: 'Ada', issuedAt: Date.now() });
  const data = Buffer.from('fl-kin-card|v1|' + JSON.stringify(body), 'utf8');
  const sig = crypto.sign(null, data, kp.privateKey);
  const card = Object.assign({}, body, { publicKey: jwk, cryptoType: 'ed25519', signature: sig.toString('base64') });
  const v = D.verifyKinCard(card);
  return { kp: kp, card: card, code: 'TREEKIN1:' + b64url(JSON.stringify(card)), fp: v.fp, keyHash: v.keyHash };
}
function sign(kp, challenge, deskFp, phoneFp) {
  const data = Buffer.from('fl-reconnect|v1|' + challenge + '|' + deskFp + '|' + phoneFp, 'utf8');
  return crypto.sign(null, data, kp.privateKey).toString('base64');
}
const invite = 'TREEPOOL1:' + b64url(JSON.stringify({ v: 1, k: 'invite', sdp: 'v=0\r\n' }));
const answerCode = 'TREEPOOL1:' + b64url(JSON.stringify({ v: 1, k: 'reply', sdp: 'v=0\r\n' }));

function req(port, method, p, headers, body) {
  return new Promise((resolve) => {
    const r = http.request({ hostname: '127.0.0.1', port: port, method: method, path: p, headers: headers || {}, agent: false }, (res) => {
      const c = []; res.on('data', (d) => c.push(d));
      res.on('end', () => resolve({ code: res.statusCode, body: Buffer.concat(c).toString('utf8'), headers: res.headers }));
    });
    r.on('error', () => resolve({ code: 0, body: '' }));
    if (body) r.write(body);
    r.end();
  });
}

(async () => {
  // v-reconnect-hook-heal-v0.1: these stay the originals. The door does not patch the process.
  const origTimeout = global.setTimeout;
  const origListen = http.Server.prototype.listen;

  // ---- 16 and 18 can be read before any listener ----
  const pre = fs.readFileSync(path.join(__dirname, '..', 'preload.js'), 'utf8');
  const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  ok(!/lattice-discover-keep/.test(pre) && !/rememberKeepOn/.test(pre), 'preload has no keep-on setter');
  ok(!/ipcMain\.handle\(\s*'lattice-discover-keep/.test(main), 'main has no keep-on IPC');
  ok(/latticeDiscoverKin/.test(pre) && /latticeDiscoverForgetUndo/.test(pre), 'preload can read kin and undo');
  ok(!D.safeBindAddress('8.8.8.8') && !D.safeBindAddress('::1') && !D.safeBindAddress('0.0.0.0'), 'public, IPv6, wildcard refused');
  ok(D.pickLanAddress({ utun4: [{ address: '10.1.1.1', family: 'IPv4', internal: false }], wg0: [{ address: '10.2.2.2', family: 'IPv4', internal: false }] }) === null, 'VPN names refused');
  const bad = D.createDiscover({ networkInterfaces: () => ({ en0: [{ address: '203.0.113.9', family: 'IPv4', internal: false }] }), ask: async () => 'no' });
  const badOn = await bad.on('aabbccddeeff0011');
  ok(badOn.ok === false && badOn.reason === 'no-private-wifi', 'bind stays private only');

  const deskSrc = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'modules', 'pool-reconnect-desk.js'), 'utf8');
  ok(deskSrc.indexOf(D.WORDS034.keepOnLine) !== -1 && deskSrc.indexOf('On. Turns off at ') !== -1, 'truth lines live in the new module');
  ok(deskSrc.indexOf("minHeight = '44px'") !== -1 && !new RegExp(['inner', 'HTML'].join('') + '|' + ['conf', 'irm\\('].join('') + '|' + '\\u2014' + '|' + ['&md', 'ash;'].join('')).test(deskSrc), 'desk module: 44px, text only');

  // ---- remembered reconnect ----
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fl-reconnect-'));
  let t = Date.now();
  let asks = 0;
  const notes = [];
  const reed = makeCard('Reed phone');
  const stranger = makeCard('Other phone');
  const door = D.createDiscover({
    storeDir: tmp, smokeLoopback: true, now: () => t, reconnectAskDelay: 150, autoOffMs: 3600000,
    ask: async () => { asks++; return 'help'; }, // reconnectAskDelay below is 150 so a pause can land during it
    answerOffer: async () => answerCode,
    notify: (text) => notes.push(text)
  });
  const st = await door.on('0123456789abcdef9999');
  ok(st.ok && st.on, 'on');
  const deskFp = '0123456789abcdef';
  const host = '127.0.0.1:' + st.port;
  const origin = 'http://' + host;
  const H = { Host: host, Origin: origin };

  async function getC(advance) {
    if (advance !== false) t += 61000;
    const r = await req(st.port, 'GET', '/challenge', H);
    ok(r.code === 200, 'challenge ' + r.code);
    const c = JSON.parse(r.body).c;
    ok(/^[0-9a-f]{32}$/.test(c), '32 hex challenge');
    return c;
  }
  function freshC() { return getC(true); }
  async function recon(card, c, sig, extra) {
    const body = JSON.stringify(Object.assign({ v: 1, r: 1, offer: invite, card: card.code, c: c, sig: sig }, extra || {}));
    return req(st.port, 'POST', '/knock?r=1', H, body);
  }
  async function trustByLink(card) {
    const link = door.joinLink();
    const tok = JSON.parse(Buffer.from(link.url.split('#fl-knock=')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()).t;
    const before = asks;
    const r = await req(st.port, 'POST', '/knock', H, JSON.stringify({ v: 1, offer: invite, card: card.code, t: tok }));
    return { r: r, before: before, tok: tok };
  }

  const joined = await trustByLink(reed);
  ok(joined.r.code === 200 && asks === joined.before + 1, '033c link still asks once');
  const kin = JSON.parse(fs.readFileSync(path.join(tmp, 'kin.json'), 'utf8'));
  ok(kin[reed.fp] && kin[reed.fp].keyHash === reed.keyHash && kin[reed.fp].choice === 'help', 'link stores the remembered choice');

  const asksAfterLink = asks;
  const c1 = await freshC();
  const g1 = await recon(reed, c1, sign(reed.kp, c1, deskFp, reed.fp));
  const b1 = JSON.parse(g1.body || '{}');
  ok(g1.code === 200 && b1.ok && b1.choice === 'help' && b1.answer === answerCode, '1 remembered reconnect is 200');
  ok(asks === asksAfterLink, '2 ask() not called');
  ok(notes[0] === 'Reed phone reconnected.', 'note says the device reconnected');

  door.pause();
  const c3 = await freshC();
  const g3 = await recon(reed, c3, sign(reed.kp, c3, deskFp, reed.fp));
  ok(g3.code === 200 && JSON.parse(g3.body).choice === 'connect', '3 paused help comes back as connect');
  ok(asks === asksAfterLink, '3 still no window');
  door.resume();

  const c4 = await freshC();
  const sig4 = sign(reed.kp, c4, deskFp, reed.fp);
  const p4 = recon(reed, c4, sig4);
  await sleep(40);
  door.pause();
  const g4 = await p4;
  ok(g4.code === 200 && JSON.parse(g4.body).choice === 'connect', '4 pause during the reconnect wins');
  ok(asks === asksAfterLink, '4 still no window');
  door.resume();

  const c5 = await freshC();
  const g5 = await recon(stranger, c5, sign(stranger.kp, c5, deskFp, stranger.fp));
  ok(g5.code === 403 && JSON.parse(g5.body).reason === 'not-remembered' && asks === asksAfterLink, '5 unknown card refused');

  const kinPath = path.join(tmp, 'kin.json');
  const kinNow = JSON.parse(fs.readFileSync(kinPath, 'utf8'));
  const realHash = kinNow[reed.fp].keyHash;
  kinNow[reed.fp].keyHash = 'ab'.repeat(16);
  fs.writeFileSync(kinPath, JSON.stringify(kinNow));
  const c6 = await freshC();
  const g6 = await recon(reed, c6, sign(reed.kp, c6, deskFp, reed.fp));
  ok(g6.code === 403 && JSON.parse(g6.body).reason === 'not-remembered', '6 keyHash differs: refused');
  const kinBack = JSON.parse(fs.readFileSync(kinPath, 'utf8'));
  if (kinBack[reed.fp]) kinBack[reed.fp].keyHash = realHash;
  else kinBack[reed.fp] = { keyHash: realHash, grantedAt: t, choice: 'help' };
  fs.writeFileSync(kinPath, JSON.stringify(kinBack));

  const c7 = await freshC();
  const sig7 = sign(reed.kp, c7, deskFp, reed.fp);
  const g7a = await recon(reed, c7, sig7);
  const g7b = await recon(reed, c7, sig7);
  ok(g7a.code === 200 && g7b.code === 403 && JSON.parse(g7b.body).reason === 'not-remembered', '7 replayed challenge refused');

  const c8 = await freshC();
  t += 61000;
  const g8 = await recon(reed, c8, sign(reed.kp, c8, deskFp, reed.fp));
  ok(g8.code === 403 && JSON.parse(g8.body).reason === 'not-remembered', '8 challenge older than 60s refused');

  const c9 = await freshC();
  const otherDesk = sign(reed.kp, c9, 'ffffffffeeeeeeee', reed.fp);
  const otherC = sign(reed.kp, '00'.repeat(16), deskFp, reed.fp);
  const g9a = await recon(reed, c9, otherDesk);
  const c9b = await freshC();
  const g9b = await recon(reed, c9b, otherC);
  ok(g9a.code === 403 && g9b.code === 403, '9 signature over another desk or challenge refused');

  t += 61000;
  const badHost = await req(st.port, 'GET', '/challenge', { Host: 'evil.example:' + st.port, Origin: origin });
  const badOrigin = await req(st.port, 'GET', '/challenge', { Host: host, Origin: 'https://evil.example' });
  ok(badHost.code === 403 && badOrigin.code === 403, '10 bad host and other origin refused');
  let fifth = 0;
  for (let i = 0; i < 5; i++) {
    const rr = await req(st.port, 'GET', '/challenge', H);
    if (i < 4) ok(rr.code === 200, '10 challenge ' + (i + 1));
    else fifth = rr.code;
  }
  ok(fifth === 429, '10 fifth challenge in a minute is 429');

  t += 61000;
  t += 61000;
  const c11 = await getC(false);
  ok(door.forget(reed.fp).ok === true, '11 forget');
  ok(!JSON.parse(fs.readFileSync(kinPath, 'utf8'))[reed.fp], '11 kin.json row gone');
  const g11 = await recon(reed, c11, sign(reed.kp, c11, deskFp, reed.fp));
  ok(g11.code === 403, '11 next reconnect refused');
  t += 5000;
  ok(door.forgetUndo(reed.fp).ok === true, '12 undo within 10s');
  const c12 = await getC(false);
  const g12 = await recon(reed, c12, sign(reed.kp, c12, deskFp, reed.fp));
  ok(g12.code === 200, '12 undo brings the reconnect back');
  ok(door.forget(reed.fp).ok === true, '12 forget again');
  const cLate = await getC(false);
  t += 11000;
  ok(door.forgetUndo(reed.fp).ok === false, '12 after 10s undo cannot');
  const g12b = await recon(reed, cLate, sign(reed.kp, cLate, deskFp, reed.fp));
  ok(g12b.code === 403, '12 late undo stays refused');

  // trust again so the 033c path and counts have a live row for the disk read later
  t += 61000;
  const again = await trustByLink(reed);
  ok(again.r.code === 200, 'link after forget still works');

  const c13 = await freshC();
  ok(door._liveChallenges() >= 1 && door._liveTokens() >= 0, '13 challenges were live');
  const link13 = door.joinLink();
  ok(door._liveTokens() >= 1, '13 a link token is live');
  door.off('tap');
  ok(door._liveChallenges() === 0 && door._liveTokens() === 0, '13 off forgets challenges and link tokens');
  ok((await req(st.port, 'GET', '/challenge', H)).code === 0, '13 listener is down');
  void c13; void link13;

  const disk = fs.readdirSync(tmp).map((f) => fs.readFileSync(path.join(tmp, f), 'utf8')).join('\n');
  ok(!/Reed|Ada|publicKey|signature|192\.168|TREEKIN/.test(disk), '19 counts and kin hold no names, cards, or addresses');
  const counts = JSON.parse(fs.readFileSync(path.join(tmp, 'counts.json'), 'utf8'));
  ok(typeof counts.reconnects === 'number' && typeof counts.reconnectRefused === 'number' && typeof counts.forgotten === 'number', '19 reconnect counts are numbers');
  ok(Object.keys(counts).every((k) => typeof counts[k] === 'number'), '19 counts.json is counts only');

  // ---- 17 the 033c one-time link, on its own door ----
  let t2 = Date.now();
  let asks2 = 0;
  const tmp17 = fs.mkdtempSync(path.join(os.tmpdir(), 'fl-reconnect17-'));
  const door17 = D.createDiscover({
    storeDir: tmp17, smokeLoopback: true, now: () => t2, autoOffMs: 3600000,
    ask: async () => { asks2++; return 'connect'; },
    answerOffer: async () => answerCode
  });
  const st17 = await door17.on(deskFp);
  const host17 = '127.0.0.1:' + st17.port;
  const H17 = { Host: host17, Origin: 'http://' + host17 };
  const link = door17.joinLink();
  const tok = JSON.parse(Buffer.from(link.url.split('#fl-knock=')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()).t;
  const once = await req(st17.port, 'POST', '/knock', H17, JSON.stringify({ v: 1, offer: invite, card: reed.code, t: tok }));
  const twice = await req(st17.port, 'POST', '/knock', H17, JSON.stringify({ v: 1, offer: invite, card: reed.code, t: tok }));
  ok(once.code === 200 && asks2 === 1 && twice.code === 403, '17 token works once');
  const linkOld = door17.joinLink();
  const tokOld = JSON.parse(Buffer.from(linkOld.url.split('#fl-knock=')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()).t;
  t2 += D.RELAY_TOKEN_MS + 1000;
  const old = await req(st17.port, 'POST', '/knock', H17, JSON.stringify({ v: 1, offer: invite, card: reed.code, t: tokOld }));
  ok(old.code === 403 && asks2 === 1, '17 token dies after 10 minutes');
  door17.off('tap');

  // ---- 14 stable port ----
  const tmp14 = fs.mkdtempSync(path.join(os.tmpdir(), 'fl-reconnect14-'));
  const door14 = D.createDiscover({
    storeDir: tmp14, smokeLoopback: true, autoOffMs: 3600000,
    ask: async () => 'no', answerOffer: async () => answerCode
  });
  const a1 = await door14.on(deskFp);
  const p1 = a1.port;
  door14.off('tap');
  await sleep(50);
  const a2 = await door14.on(deskFp);
  ok(a2.port === p1 && a2.on, '14 second on() binds the saved port ' + p1 + ' then ' + a2.port);
  door14.off('tap');
  await sleep(50);
  const blocker = http.createServer((rq, rs) => { rs.writeHead(200); rs.end('busy'); });
  await new Promise((res, rej) => blocker.listen(p1, '127.0.0.1', (e) => e ? rej(e) : res()));
  const a3 = await door14.on(deskFp);
  ok(a3.on && a3.port !== p1, '14 busy port falls back ' + a3.port);
  const saved = JSON.parse(fs.readFileSync(path.join(tmp14, 'port.json'), 'utf8')).port;
  ok(saved === a3.port, '14 fallback port is the one remembered');
  door14.off('tap');
  await new Promise((res) => blocker.close(() => res()));

  // ---- 15 keep-on and the real auto-off timer ----
  const tmp15 = fs.mkdtempSync(path.join(os.tmpdir(), 'fl-reconnect15-'));
  const door15 = D.createDiscover({
    storeDir: tmp15, smokeLoopback: true, autoOffMs: 200,
    ask: async () => 'no', answerOffer: async () => ''
  });
  const s15 = await door15.on(deskFp);
  ok(s15.on && door15.status().keepOn === false, '15 keep-on starts off');
  await sleep(450);
  ok(door15.status().on === false, '15 keep-on off: auto off after autoOffMs');
  door15.rememberKeepOn(true);
  const s15b = await door15.on(deskFp);
  ok(s15b.on && door15.status().keepOn === true, '15 keep-on on');
  await sleep(450);
  ok(door15.status().on === true, '15 keep-on on: still on after 2x');
  door15.off('tap');
  ok(door15.status().on === false && door15.keepOn() === true, '15 Turn off keeps the preference');
  const pref = JSON.parse(fs.readFileSync(path.join(tmp15, 'keepon.json'), 'utf8'));
  ok(pref.keepOn === true && Object.keys(pref).length === 1, '15 keepon.json is only the preference');

  // relay page is the r=1 page, and the plain /relay page is still 033c
  const tmpR = fs.mkdtempSync(path.join(os.tmpdir(), 'fl-reconnectR-'));
  const doorR = D.createDiscover({
    storeDir: tmpR, smokeLoopback: true, autoOffMs: 3600000,
    ask: async () => 'connect', answerOffer: async () => answerCode
  });
  const sR = await doorR.on(deskFp);
  const hostR = '127.0.0.1:' + sR.port;
  const page = await req(sR.port, 'GET', '/relay?r=1', { Host: hostR });
  ok(page.code === 200 && page.body.indexOf('fl-reconnect-hello') !== -1 && page.headers['content-security-policy'].indexOf(D.RECONNECT_SCRIPT_HASH) !== -1, 'reconnect relay is hashed');
  const oldPage = await req(sR.port, 'GET', '/relay', { Host: hostR });
  ok(oldPage.code === 200 && oldPage.body.indexOf('fl-relay-ready') !== -1 && oldPage.body.indexOf('fl-reconnect-hello') === -1, 'plain relay is still the 033c page');
  doorR.off('tap');

  // ---- v-reconnect-hook-heal-v0.1: the hooks stay inside the door ----
  ok(global.setTimeout === origTimeout, 'setTimeout is the original after createDiscover034');
  const tmpH = fs.mkdtempSync(path.join(os.tmpdir(), 'fl-reconnect-hooks-'));
  let asksH = 0;
  const doorH = D.createDiscover({
    storeDir: tmpH, smokeLoopback: true, autoOffMs: 3600000,
    ask: async () => { asksH++; return 'help'; },
    answerOffer: async () => answerCode
  });
  ok(http.Server.prototype.listen === origListen, 'listen is the original before on');
  const pendingH = doorH.on(deskFp);
  ok(http.Server.prototype.listen === origListen, 'listen is the original during on');
  const stH = await pendingH;
  ok(http.Server.prototype.listen === origListen && stH.on, 'listen is the original after on');
  const hostH = '127.0.0.1:' + stH.port;
  const HH = { Host: hostH, Origin: 'http://' + hostH };
  const linkH = doorH.joinLink();
  const tokH = JSON.parse(Buffer.from(linkH.url.split('#fl-knock=')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()).t;
  const asked = await req(stH.port, 'POST', '/knock', HH, JSON.stringify({ v: 1, offer: invite, card: reed.code, t: tokH }));
  ok(asked.code === 200 && asksH === 1, 'no silent choice: the window is asked');
  doorH.pause();
  const chH = await req(stH.port, 'GET', '/challenge', HH);
  const cH = JSON.parse(chH.body).c;
  const pausedH = await req(stH.port, 'POST', '/knock?r=1', HH, JSON.stringify({
    v: 1, r: 1, offer: invite, card: reed.code, c: cH, sig: sign(reed.kp, cH, deskFp, reed.fp)
  }));
  ok(pausedH.code === 200 && JSON.parse(pausedH.body).choice === 'connect' && asksH === 1, 'silent choice help while paused comes back as connect');
  doorH.off('tap');

  const hookMs = 200;
  let outsideFired = false;
  const tmpT = fs.mkdtempSync(path.join(os.tmpdir(), 'fl-reconnect-hooks-time-'));
  const doorT = D.createDiscover({
    storeDir: tmpT, smokeLoopback: true, autoOffMs: hookMs,
    ask: async () => 'no', answerOffer: async () => ''
  });
  doorT.rememberKeepOn(true);
  const stT = await doorT.on(deskFp);
  ok(stT.on && doorT.status().keepOn === true, 'keep-on is set for the outside timer');
  setTimeout(() => { outsideFired = true; }, hookMs);
  await sleep(hookMs * 2 + 80);
  ok(outsideFired, 'outside timer of autoOffMs still fires while keep-on is set');
  ok(doorT.status().on === true && (doorT.status().counts.autoOff || 0) === 0, 'keep-on set: auto-off does not turn the switch off');
  ok(global.setTimeout === origTimeout && http.Server.prototype.listen === origListen, 'setTimeout and listen stay the originals while the door is up');
  doorT.rememberKeepOn(false);
  await sleep(hookMs + 120);
  ok(doorT.status().on === false, 'keep-on cleared: off within one autoOffMs');

  console.log('checks passed: ' + passed);
  console.log('SMOKE_OK tree reconnect v0.1');
  console.log('SMOKE_OK reconnect hooks v0.1');
  process.exit(0);
})().catch((e) => { console.log('FAIL ' + (e && e.stack ? e.stack : e)); process.exit(1); });
