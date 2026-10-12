// smoke-phone-knocks.js v-phone-knocks-v0.1 (033c). Node only, loopback listener.
'use strict';
const http = require('http'), crypto = require('crypto'), path = require('path');
const L = require(path.join(__dirname, '..', 'lattice-discover.js'));
let n = 0, bad = 0;
function ok(name, c) { n++; if (!c) { bad++; console.log('FAIL ' + name); } }
function req(port, method, p, headers, body) {
  return new Promise((resolve) => {
    const r = http.request({ host: '127.0.0.1', port, method, path: p, headers: headers || {} }, (res) => {
      const c = []; res.on('data', (d) => c.push(d)); res.on('end', () => resolve({ code: res.statusCode, headers: res.headers, body: Buffer.concat(c).toString('utf8') }));
    });
    r.on('error', () => resolve({ code: 0 }));
    if (body) r.write(body); r.end();
  });
}
function b64url(o) { return Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
// A real TREEKIN1 card and TREEPOOL1 invite, made the way the smoke for 033 makes them.
function card() {
  const kp = crypto.generateKeyPairSync('ed25519');
  const jwk = kp.publicKey.export({ format: 'jwk' });
  const pub = { kty: jwk.kty, crv: jwk.crv, x: jwk.x };
  const body = L.cardBody({ name: 'Phone Mind', model: 'qwen', home: 'thelatticetree', keeperMeshId: L.meshIdFor(pub), keeperName: 'Kid', issuedAt: Date.now() });
  const sig = crypto.sign(null, Buffer.from('fl-kin-card|v1|' + JSON.stringify(body)), kp.privateKey).toString('base64');
  return 'TREEKIN1:' + b64url(Object.assign({}, body, { publicKey: pub, cryptoType: 'ed25519', signature: sig }));
}
const offer = 'TREEPOOL1:' + b64url({ v: 1, k: 'invite', sdp: 'v=0\r\na=fingerprint:sha-256 AA:BB\r\n' });
(async () => {
  let asked = 0, lastChoices = null;
  const d = L.createDiscover({ smokeLoopback: true,
    ask: async (q) => { asked++; lastChoices = q.choices.map((c) => c.id); return q.choices[0].id; },
    answerOffer: async () => 'TREEPOOL1:' + b64url({ v: 1, k: 'reply', sdp: 'v=0' }) });
  ok('joinLink refused while off', d.joinLink().reason === 'off');
  const st = await d.on('');
  ok('on', st.on && st.address === '127.0.0.1');
  const host = '127.0.0.1:' + st.port, self = 'http://' + host;
  const r0 = await req(st.port, 'GET', '/relay', { Host: host });
  ok('GET /relay serves the page', r0.code === 200 && r0.body.indexOf('fl-relay-ready') !== -1);
  const hash = 'sha256-' + crypto.createHash('sha256').update(r0.body.split('<script>')[1].split('</script>')[0]).digest('base64');
  ok('CSP pins the inline script by hash, connect-src self only', r0.headers['content-security-policy'].indexOf(hash) !== -1 && /connect-src 'self'/.test(r0.headers['content-security-policy']) && /frame-ancestors 'none'/.test(r0.headers['content-security-policy']));
  ok('relay posts the answer only to the Tree and FreeLattice origins', r0.body.indexOf('ALLOWED.indexOf(ev.origin)===-1') !== -1 && r0.body.indexOf('ev.source!==window.opener') !== -1);
  ok('no em dash, no dialog call, no raw HTML writes in the relay', !new RegExp('\\u2014|conf' + 'irm\\(|inner' + 'HTML').test(r0.body));
  ok('wrong Host (DNS rebinding) refused', (await req(st.port, 'GET', '/relay', { Host: 'evil.example:' + st.port })).code === 403);
  const link = d.joinLink();
  ok('join link points at the Tree with a fragment', link.ok && link.url.indexOf(L.JOIN_HOME + '#fl-knock=') === 0);
  const c = JSON.parse(Buffer.from(link.url.split('#fl-knock=')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
  ok('link carries address, port and a 32-hex token only', c.v === 1 && c.h === '127.0.0.1' && c.p === st.port && /^[0-9a-f]{32}$/.test(c.t) && Object.keys(c).length === 4);
  const kc = card();
  const noTok = await req(st.port, 'POST', '/knock', { Host: host, Origin: self }, JSON.stringify({ v: 1, offer, card: kc, t: 'f'.repeat(32) }));
  ok('relay knock with a wrong token refused before any window', noTok.code === 403 && asked === 0);
  const good = await req(st.port, 'POST', '/knock', { Host: host, Origin: self }, JSON.stringify({ v: 1, offer, card: kc, t: c.t }));
  const gb = JSON.parse(good.body || '{}');
  ok('relay knock with the token asks the person and returns the answer', good.code === 200 && asked === 1 && gb.ok && gb.answer.indexOf('TREEPOOL1:') === 0);
  const again = await req(st.port, 'POST', '/knock', { Host: host, Origin: self }, JSON.stringify({ v: 1, offer, card: kc, t: c.t }));
  ok('the same token twice: refused (single use)', again.code === 403 && asked === 1);
  d.pause();
  const l2 = d.joinLink(); const t2 = JSON.parse(Buffer.from(l2.url.split('#fl-knock=')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()).t;
  const pz = await req(st.port, 'POST', '/knock', { Host: host, Origin: self }, JSON.stringify({ v: 1, offer, card: kc, t: t2 }));
  ok('Pause wins through the relay: no help choice, answer is connect', pz.code === 200 && lastChoices.indexOf('help') === -1 && JSON.parse(pz.body).choice === 'connect');
  d.resume();
  const strangerOrigin = await req(st.port, 'POST', '/knock', { Host: host, Origin: 'http://192.168.9.9:1' }, '{}');
  ok('other origins still go through the 033 origin check (403)', strangerOrigin.code === 403);
  d.joinLink(); d.joinLink(); d.joinLink(); d.joinLink();
  ok('at most 3 live links', d._liveTokens() === 3);
  d.off('tap');
  ok('off forgets every link', d._liveTokens() === 0);
  ok('off: relay gone', (await req(st.port, 'GET', '/relay', { Host: host })).code === 0);
  console.log('checks passed: ' + (n - bad));
  if (bad) { console.log('SMOKE_FAIL'); process.exit(1); }
  console.log('SMOKE_OK phone knocks v0.1');
  process.exit(0);
})();
