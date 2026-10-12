// ============================================
// FreeLattice Desktop: home Wi-Fi discovery v0.1 (v-desktop-pooling-v0.1)
// MIT. Builds 029c-1 and the first half of 029c-2.
//
// One switch, off by default: "Let phones on this Wi-Fi find this computer".
// While it is on, this computer announces _freelattice._tcp on the home network
// (random name, TXT v=1, fp, port, nothing else) and listens on its private LAN
// address only. Never 0.0.0.0, never a public address, never IPv6, never a VPN
// interface. A device knocks with one pool invite and its kin card (TREEKIN1:),
// and one window asks "Pool with <device>?" with the same three choices as 029.
// Pause always wins. Receipts are counts only. Keys stay in main.
// ============================================

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const VERSION = 'v-desktop-pooling-v0.1';
const SERVICE_TYPE = 'freelattice';            // _freelattice._tcp.local
const KIN_DOMAIN = 'fl-kin-card|v1|';           // same as fl-kin.js v0.2 and tree-kin.js
const KIN_PREFIX = 'TREEKIN1:';
const POOL_PREFIX = 'TREEPOOL1:';
const HOMES = ['freelattice-web', 'freelattice-desktop', 'thelatticetree'];
const MAX_BODY = 16 * 1024;                     // same cap as TREEPOOL codes
const RATE_MAX = 4;                             // knocks per minute
const RATE_WINDOW_MS = 60 * 1000;
const AUTO_OFF_MS = 30 * 60 * 1000;             // off after 30 minutes with no join
const ANSWER_WAIT_MS = 60 * 1000;
const MAX_SKEW_MS = 10 * 60 * 1000;
const ALLOWED_ORIGINS = ['https://freelattice.com', 'https://www.freelattice.com',
  'https://thelatticetree.com', 'https://www.thelatticetree.com'];
const VPN_NAME = /^(utun|tun|tap|wg|ppp|ipsec|tailscale|zt|zerotier|nordlynx|proton|mullvad|gpd|vpn)/i;
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

const WORDS = {
  switchLabel: 'Let phones on this Wi-Fi find this computer',
  switchAsk: 'Phones and computers on this same Wi-Fi will see "a FreeLattice device is here". Nothing is shared until you say Yes to a device. It turns itself off when you quit, or after 30 minutes with no join.',
  turnOn: 'Turn on', notNow: 'Not now',
  help: 'Yes, and let my mind answer it',
  connect: 'Yes, connect only',
  connectPaused: 'Yes, connect only (helping stays paused)',
  no: 'No',
  resumeAsk: 'Resume helping trusted kin on this Wi-Fi?',
  resume: 'Resume', stayPaused: 'Stay paused'
};

// ---------- pure helpers (tested headless) ----------

function ipv4Parts(ip) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(ip || ''));
  if (!m) return null;
  const p = m.slice(1).map(Number);
  return p.every((n) => n >= 0 && n <= 255) ? p : null;
}

/** Private home ranges only: 10/8, 172.16/12, 192.168/16. Loopback, CGNAT (100.64/10,
 *  common for VPNs), link-local, public and every IPv6 address are refused. */
function isPrivateLan(ip) {
  const p = ipv4Parts(ip);
  if (!p) return false;
  if (p[0] === 10) return true;
  if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
  if (p[0] === 192 && p[1] === 168) return true;
  return false;
}

/** Pick the one private LAN address to announce and listen on, or null.
 *  ifaces is os.networkInterfaces() shaped. */
function pickLanAddress(ifaces) {
  const names = Object.keys(ifaces || {}).sort();
  for (const name of names) {
    if (VPN_NAME.test(name)) continue;
    for (const a of (ifaces[name] || [])) {
      if (!a || a.internal) continue;
      const fam = a.family === 4 ? 'IPv4' : a.family;
      if (fam !== 'IPv4') continue;
      if (isPrivateLan(a.address)) return { name, address: a.address };
    }
  }
  return null;
}

/** The only bind address this module will ever accept. */
function safeBindAddress(addr, opts) {
  if (opts && opts.smokeLoopback && addr === '127.0.0.1') return true;
  if (!addr || addr === '0.0.0.0' || addr === '::' || addr === '') return false;
  return isPrivateLan(addr);
}

function originAllowed(origin, appOrigin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.indexOf(origin) !== -1) return true;
  return !!appOrigin && origin === appOrigin;
}

function clip(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n); }
function sha256Hex(str) { return crypto.createHash('sha256').update(str, 'utf8').digest('hex'); }
function base58(buf) {
  const bytes = Uint8Array.from(buf); const digits = [0];
  for (let i = 0; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) { carry += digits[j] << 8; digits[j] = carry % 58; carry = (carry / 58) | 0; }
    while (carry > 0) { digits.push(carry % 58); carry = (carry / 58) | 0; }
  }
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) digits.push(0);
  return digits.reverse().map((d) => B58[d]).join('');
}
function b64urlToBuf(s) {
  let t = String(s).replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  return Buffer.from(t, 'base64');
}

// Same body, order and fingerprint as tree-kin.js / fl-kin.js v0.2.
function cardBody(c) {
  return {
    v: 1, kind: 'fl-mind-card',
    name: clip(c.name, 60), model: clip(c.model, 120),
    home: HOMES.indexOf(c.home) !== -1 ? c.home : 'freelattice-web',
    keeperMeshId: clip(c.keeperMeshId, 64), keeperName: clip(c.keeperName, 60),
    issuedAt: Number(c.issuedAt) || 0
  };
}
function keyHash(publicKey) { try { return sha256Hex(JSON.stringify(publicKey)).slice(0, 32); } catch (e) { return ''; } }
function fingerprint(b, publicKey) { return sha256Hex(keyHash(publicKey) + '|' + b.keeperMeshId + '|' + b.name + '|' + b.model).slice(0, 16); }
function meshIdFor(publicKey) {
  const buf = crypto.createHash('sha256').update(JSON.stringify(publicKey), 'utf8').digest();
  return 'mesh:' + base58(buf).slice(0, 16) + base58(buf.slice(-2)).slice(0, 2);
}

function parseKinCode(code) {
  const s = String(code || '').trim();
  if (!s || s.length > 6000 || s.indexOf(KIN_PREFIX) !== 0) return null;
  try { const c = JSON.parse(b64urlToBuf(s.slice(KIN_PREFIX.length)).toString('utf8')); return (c && typeof c === 'object') ? c : null; } catch (e) { return null; }
}

/** Verify a TREEKIN1 card the same way tree-kin.js does, in Node. */
function verifyKinCard(card, now) {
  now = now || Date.now();
  if (!card || typeof card !== 'object' || card.kind !== 'fl-mind-card' || card.v !== 1) return { ok: false, reason: 'not-a-card' };
  const b = cardBody(card);
  if (!b.name || !b.model || !b.keeperMeshId || b.issuedAt > now + MAX_SKEW_MS) return { ok: false, reason: 'malformed' };
  if (card.cryptoType !== 'ed25519' && card.cryptoType !== 'ecdsa-p256') return { ok: false, reason: 'malformed' };
  if (!card.publicKey || typeof card.publicKey !== 'object' || typeof card.signature !== 'string' || card.signature.length > 400) return { ok: false, reason: 'not-signed' };
  let mid = '';
  try { mid = meshIdFor(card.publicKey); } catch (e) { return { ok: false, reason: 'malformed' }; }
  if (mid !== b.keeperMeshId) return { ok: false, reason: 'not-the-cards-key' };
  let ok = false;
  try {
    const key = crypto.createPublicKey({ key: card.publicKey, format: 'jwk' });
    const data = Buffer.from(KIN_DOMAIN + JSON.stringify(b), 'utf8');
    const sig = Buffer.from(card.signature, 'base64');
    ok = card.cryptoType === 'ed25519'
      ? crypto.verify(null, data, key, sig)
      : crypto.verify('sha256', data, { key, dsaEncoding: 'ieee-p1363' }, sig);
  } catch (e) { ok = false; }
  if (!ok) return { ok: false, reason: 'bad-signature' };
  return { ok: true, body: b, fp: fingerprint(b, card.publicKey), keyHash: keyHash(card.publicKey) };
}

/** A pool invite as tree-pool.js writes it: TREEPOOL1: + base64url({v:1,k:'invite',sdp}). */
function looksLikeInvite(code) {
  const s = String(code || '').trim();
  if (!s || s.length > MAX_BODY || s.indexOf(POOL_PREFIX) !== 0) return false;
  try { const c = JSON.parse(b64urlToBuf(s.slice(POOL_PREFIX.length)).toString('utf8')); return !!c && c.v === 1 && typeof c.sdp === 'string'; } catch (e) { return false; }
}

/** Pause always wins: what the window may offer, and what a choice becomes. */
function choicesFor(paused) {
  return paused ? [{ id: 'connect', label: WORDS.connectPaused }, { id: 'no', label: WORDS.no }]
    : [{ id: 'help', label: WORDS.help }, { id: 'connect', label: WORDS.connect }, { id: 'no', label: WORDS.no }];
}
function settleChoice(choice, paused) {
  if (choice === 'help') return paused ? 'connect' : 'help';
  if (choice === 'connect') return 'connect';
  return 'no';
}

// ---------- the door ----------

function createDiscover(deps) {
  deps = deps || {};
  const now = deps.now || (() => Date.now());
  const ask = deps.ask;                       // async ({title, message, choices}) => choice id
  const answerOffer = deps.answerOffer;       // async ({joinId, offer, fp, name, choice}) => 'TREEPOOL1:...' or ''
  const storeDir = deps.storeDir || null;
  const ifaces = deps.networkInterfaces || (() => os.networkInterfaces());
  const mdnsFactory = deps.mdns || null;      // () => { publish(opts) -> service, destroy() }
  const smokeLoopback = !!deps.smokeLoopback;
  const appOrigin = deps.appOrigin || (() => '');

  let state = { on: false, paused: false, address: null, port: 0, instance: '', since: 0 };
  let server = null, mdns = null, service = null, autoOffTimer = null, pending = null;
  let knockTimes = [];
  let counts = { announced: 0, knocks: 0, yes: 0, connectOnly: 0, no: 0, refused: 0, autoOff: 0 };
  let kin = {};                                // fp -> { keyHash, grantedAt } (no names)

  function file(n) { return storeDir ? path.join(storeDir, n) : null; }
  function load(n, fb) { try { const f = file(n); return f ? JSON.parse(fs.readFileSync(f, 'utf8')) : fb; } catch (e) { return fb; } }
  function save(n, v) { try { const f = file(n); if (!f) return; fs.mkdirSync(storeDir, { recursive: true }); fs.writeFileSync(f, JSON.stringify(v)); } catch (e) {} }
  counts = Object.assign(counts, load('counts.json', {}));
  kin = load('kin.json', {}) || {};
  state.paused = !!load('pause.json', { paused: false }).paused;
  function bump(k) { counts[k] = (Number(counts[k]) || 0) + 1; save('counts.json', counts); }

  function armAutoOff() {
    if (autoOffTimer) clearTimeout(autoOffTimer);
    autoOffTimer = setTimeout(() => { bump('autoOff'); off('auto'); }, deps.autoOffMs || AUTO_OFF_MS);
    if (autoOffTimer.unref) autoOffTimer.unref();
  }

  function status() {
    return { version: VERSION, on: state.on, paused: state.paused, port: state.port, address: state.address,
      label: WORDS.switchLabel, counts: Object.assign({}, counts), trustedCount: Object.keys(kin).length };
  }

  function reply(res, code, obj) {
    const h = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
    if (res._flOrigin) { h['Access-Control-Allow-Origin'] = res._flOrigin; h['Vary'] = 'Origin'; }
    res.writeHead(code, h);
    res.end(obj ? JSON.stringify(obj) : '');
  }

  function rateOk() {
    const t = now();
    knockTimes = knockTimes.filter((x) => t - x < RATE_WINDOW_MS);
    if (knockTimes.length >= RATE_MAX) return false;
    knockTimes.push(t);
    return true;
  }

  async function handleKnock(raw) {
    let msg = null;
    try { msg = JSON.parse(raw); } catch (e) { return { code: 400, body: { ok: false, reason: 'not-json' } }; }
    if (!msg || msg.v !== 1 || !looksLikeInvite(msg.offer)) return { code: 400, body: { ok: false, reason: 'not-an-invite' } };
    const card = parseKinCode(msg.card);
    const v = verifyKinCard(card, now());
    if (!v.ok) { bump('refused'); return { code: 403, body: { ok: false, reason: 'card-' + v.reason } }; }
    if (pending) return { code: 409, body: { ok: false, reason: 'busy' } };
    const joinId = crypto.randomBytes(8).toString('hex');
    pending = { joinId };
    bump('knocks');
    try {
      const device = clip(v.body.name, 60) || 'A device';
      const pausedAtAsk = state.paused;
      const picked = await ask({
        title: 'Pool with ' + device + '?',
        message: 'Pool with ' + device + '?',
        detail: device + ' on this Wi-Fi wants to join. Card ' + v.fp + '. Only say Yes to a device you know.',
        choices: choicesFor(pausedAtAsk)
      });
      // Pause always wins, even if it was pressed while the window was open.
      const choice = settleChoice(picked, state.paused || pausedAtAsk);
      if (choice === 'no') { bump('no'); return { code: 204, body: null }; }
      // Yes trusts this one card (never a stranger's card on its own).
      kin[v.fp] = { keyHash: v.keyHash, grantedAt: now() };
      save('kin.json', kin);
      bump(choice === 'help' ? 'yes' : 'connectOnly');
      armAutoOff();
      let answer = '';
      if (typeof answerOffer === 'function') {
        answer = await Promise.race([
          Promise.resolve(answerOffer({ joinId, offer: msg.offer, fp: v.fp, name: device, choice })).catch(() => ''),
          new Promise((r) => { const t = setTimeout(() => r(''), deps.answerWaitMs || ANSWER_WAIT_MS); if (t.unref) t.unref(); })
        ]);
      }
      if (!answer || String(answer).indexOf(POOL_PREFIX) !== 0 || String(answer).length > MAX_BODY) {
        return { code: 504, body: { ok: false, reason: 'no-answer' } };
      }
      return { code: 200, body: { ok: true, v: 1, choice: choice === 'help' && state.paused ? 'connect' : choice, answer: String(answer) } };
    } finally { pending = null; }
  }

  function onRequest(req, res) {
    if (typeof deps.preRequest === 'function' && deps.preRequest(req, res)) return; // v-phone-knocks-v0.1
    const origin = req.headers.origin || '';
    if (!originAllowed(origin, appOrigin())) { bump('refused'); res.writeHead(403, { 'Connection': 'close' }); res.end(); req.resume(); return; }
    res._flOrigin = origin;
    const p = String(req.url || '').split('?')[0];
    if (req.method === 'OPTIONS' && p === '/knock') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Private-Network': 'true', 'Vary': 'Origin' });
      res.end(); return;
    }
    if (req.method !== 'POST' || p !== '/knock') { reply(res, 404, null); return; }
    if (!rateOk()) { bump('refused'); reply(res, 429, { ok: false, reason: 'slow-down' }); return; }
    let size = 0; const chunks = []; let dead = false;
    req.on('data', (c) => {
      if (dead) return;
      size += c.length;
      if (size > MAX_BODY) { dead = true; bump('refused'); res.setHeader('Connection', 'close'); reply(res, 413, { ok: false, reason: 'too-big' }); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (dead) return;
      handleKnock(Buffer.concat(chunks).toString('utf8')).then((r) => reply(res, r.code, r.body), () => reply(res, 500, { ok: false }));
    });
  }

  /** Turn the switch on. Callers must have a human tap behind them (main asks natively). */
  function on(ownFpHex) {
    return new Promise((resolve) => {
      if (state.on) { resolve(status()); return; }
      const pick = smokeLoopback ? { name: 'lo', address: '127.0.0.1' } : pickLanAddress(ifaces());
      if (!pick || !safeBindAddress(pick.address, { smokeLoopback })) { resolve(Object.assign(status(), { ok: false, reason: 'no-private-wifi' })); return; }
      server = http.createServer(onRequest);
      server.headersTimeout = 10000;
      server.requestTimeout = ANSWER_WAIT_MS + 30000;
      server.on('error', () => { off('error'); resolve(Object.assign(status(), { ok: false, reason: 'listen-failed' })); });
      server.listen(0, pick.address, () => {
        const a = server.address();
        if (!a || !safeBindAddress(a.address, { smokeLoopback })) { off('bind'); resolve(Object.assign(status(), { ok: false, reason: 'bad-bind' })); return; }
        state = { on: true, paused: state.paused, address: a.address, port: a.port, instance: 'fl-' + crypto.randomBytes(4).toString('hex'), since: now() };
        if (mdnsFactory) {
          try {
            mdns = mdnsFactory({ interface: pick.address });
            service = mdns.publish({ name: state.instance, type: SERVICE_TYPE, protocol: 'tcp', port: a.port,
              txt: { v: '1', fp: String(ownFpHex || '').slice(0, 16), port: String(a.port) } });
            bump('announced');
          } catch (e) { mdns = null; service = null; }
        }
        armAutoOff();
        resolve(Object.assign(status(), { ok: true }));
      });
    });
  }

  function off(_why) {
    if (autoOffTimer) { clearTimeout(autoOffTimer); autoOffTimer = null; }
    try { if (service && service.stop) service.stop(); } catch (e) {}
    try { if (mdns && mdns.unpublishAll) mdns.unpublishAll(); } catch (e) {}
    try { if (mdns && mdns.destroy) mdns.destroy(); } catch (e) {}
    service = null; mdns = null;
    if (server) { try { server.close(); if (server.closeAllConnections) server.closeAllConnections(); } catch (e) {} server = null; }
    state = { on: false, paused: state.paused, address: null, port: 0, instance: '', since: 0 };
    return status();
  }

  function pause() { state.paused = true; save('pause.json', { paused: true }); return status(); }
  function resume() { state.paused = false; save('pause.json', { paused: false }); return status(); }
  function isTrusted(fp) { return !!kin[fp]; }

  return { on, off, pause, resume, status, isTrusted, _handleKnock: handleKnock };
}

module.exports = {
  VERSION, WORDS, SERVICE_TYPE, MAX_BODY, RATE_MAX, AUTO_OFF_MS, ALLOWED_ORIGINS,
  isPrivateLan, pickLanAddress, safeBindAddress, originAllowed,
  cardBody, keyHash, fingerprint, meshIdFor, parseKinCode, verifyKinCard, looksLikeInvite,
  choicesFor, settleChoice, createDiscover
};

// ---------- v-phone-knocks-v0.1 (033c): the phone knocks over the home Wi-Fi ----------
// A phone browser cannot browse mDNS, and an https page (the Tree) cannot fetch
// http://192.168.x.x on most phones (mixed content; iOS Safari has no exception). So the
// desktop shows a join link (and its picture code): https://thelatticetree.com/settings.html
// #fl-knock=<b64url {v:1, h: LAN address, p: port, t: one-time token}>. The fragment never
// reaches any server. The Tree page, after one human tap, opens a tiny relay page this
// listener serves at http://<LAN address>:<port>/relay. The relay is same-origin with
// /knock, so it posts the knock without mixed content, and hands the answer back to the
// Tree tab with postMessage, to that exact origin only. The token is single use, lives
// 10 minutes, and only works while the switch is on. The card check, the native
// "Pool with <device>?" window and Pause-wins are the same as 033; nothing here skips them.
const RELAY_TOKEN_MS = 10 * 60 * 1000;
const RELAY_MAX_TOKENS = 3;
const JOIN_HOME = 'https://thelatticetree.com/settings.html';
const RELAY_ORIGINS = ['https://thelatticetree.com', 'https://www.thelatticetree.com',
  'https://freelattice.com', 'https://www.freelattice.com'];
const RELAY_SCRIPT = [
  '(function(){',
  'var ALLOWED=' + JSON.stringify(RELAY_ORIGINS) + ';',
  'var s=document.getElementById("s");function say(t){s.textContent=t;}',
  'var done=false;',
  'if(!window.opener){say("Open this from the join link on your phone, with the Tree.");return;}',
  'window.addEventListener("message",function(ev){',
  ' if(done||ev.source!==window.opener||ALLOWED.indexOf(ev.origin)===-1)return;',
  ' var m=ev.data;if(!m||m.type!=="fl-knock"||m.v!==1||typeof m.offer!=="string"||typeof m.card!=="string"||typeof m.t!=="string")return;',
  ' done=true;say("Knocking. The computer asks its person first.");',
  ' function back(b){try{ev.source.postMessage({type:"fl-knock-answer",v:1,ok:!!(b&&b.ok),answer:(b&&typeof b.answer==="string")?b.answer:"",choice:(b&&b.choice)||"",reason:(b&&b.reason)||""},ev.origin);}catch(e){}}',
  ' fetch("/knock",{method:"POST",headers:{"Content-Type":"text/plain"},body:JSON.stringify({v:1,offer:m.offer,card:m.card,t:m.t})})',
  ' .then(function(r){return r.status===204?{ok:false,reason:"no"}:r.json().catch(function(){return {ok:false,reason:"bad-reply"};});})',
  ' .then(function(b){back(b);say(b&&b.ok?"Done. You can close this tab.":"Not joined: "+String((b&&b.reason)||"no"));setTimeout(function(){try{window.close();}catch(e){}},1500);},',
  '  function(){back({ok:false,reason:"no-answer"});say("The computer did not answer.");});',
  '});',
  'window.opener.postMessage({type:"fl-relay-ready",v:1},"*");',
  '})();'
].join('\n');
const RELAY_SCRIPT_HASH = 'sha256-' + crypto.createHash('sha256').update(RELAY_SCRIPT, 'utf8').digest('base64');
function relayHtml() {
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>FreeLattice knock</title></head><body style="font-family:system-ui,sans-serif;padding:24px;background:#0b0f1a;color:#e8ecf5">' +
    '<p id="s">Waiting for the Tree tab.</p><script>' + RELAY_SCRIPT + '</script></body></html>';
}
function relayHeaders() {
  return { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'none'; script-src '" + RELAY_SCRIPT_HASH + "'; connect-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" };
}
function b64url(s) { return Buffer.from(String(s), 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }

const _createDiscover033 = createDiscover;
function createDiscover033c(deps) {
  deps = deps || {};
  const now = deps.now || (() => Date.now());
  let tokens = {};                              // token -> expiresAt (memory only, never on disk)
  let relayTimes = [];
  let d = null;
  function prune() { const t = now(); Object.keys(tokens).forEach((k) => { if (tokens[k] <= t) delete tokens[k]; }); }
  function rateOk() {
    const t = now();
    relayTimes = relayTimes.filter((x) => t - x < RATE_WINDOW_MS);
    if (relayTimes.length >= RATE_MAX) return false;
    relayTimes.push(t);
    return true;
  }
  function json(res, code, obj) {
    res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(obj ? JSON.stringify(obj) : '');
  }
  deps.preRequest = (req, res) => {
    if (!d) return false;
    const st = d.status();
    if (!st.on || !st.address) return false;
    const self = 'http://' + st.address + ':' + st.port;
    const p = String(req.url || '').split('?')[0];
    const hostOk = String(req.headers.host || '') === st.address + ':' + st.port;   // no DNS rebinding
    if (req.method === 'GET' && p === '/relay') {
      if (!hostOk) { res.writeHead(403); res.end(); return true; }
      res.writeHead(200, relayHeaders()); res.end(relayHtml()); return true;
    }
    if (req.method === 'POST' && p === '/knock' && String(req.headers.origin || '') === self) {
      if (!hostOk) { res.writeHead(403); res.end(); req.resume(); return true; }
      if (!rateOk()) { json(res, 429, { ok: false, reason: 'slow-down' }); req.resume(); return true; }
      let size = 0, dead = false; const chunks = [];
      req.on('data', (c) => {
        if (dead) return;
        size += c.length;
        if (size > MAX_BODY + 256) { dead = true; res.setHeader('Connection', 'close'); json(res, 413, { ok: false, reason: 'too-big' }); return; }
        chunks.push(c);
      });
      req.on('end', () => {
        if (dead) return;
        let m = null;
        try { m = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { json(res, 400, { ok: false, reason: 'not-json' }); return; }
        prune();
        const t = m && typeof m.t === 'string' ? m.t : '';
        if (!t || !tokens[t]) { json(res, 403, { ok: false, reason: 'link-used-or-old' }); return; }
        delete tokens[t];                        // single use, even if the knock is refused later
        d._handleKnock(JSON.stringify({ v: m.v, offer: m.offer, card: m.card }))
          .then((r) => json(res, r.code, r.body), () => json(res, 500, { ok: false }));
      });
      return true;
    }
    return false;
  };
  d = _createDiscover033(deps);
  /** A join link for one phone. Callers must have a human tap behind them. */
  d.joinLink = () => {
    const st = d.status();
    if (!st.on || !st.address) return { ok: false, reason: 'off' };
    prune();
    const live = Object.keys(tokens).sort((a, b) => tokens[a] - tokens[b]);
    while (live.length >= RELAY_MAX_TOKENS) delete tokens[live.shift()];
    const t = crypto.randomBytes(16).toString('hex');
    tokens[t] = now() + RELAY_TOKEN_MS;
    const code = b64url(JSON.stringify({ v: 1, h: st.address, p: st.port, t }));
    return { ok: true, url: JOIN_HOME + '#fl-knock=' + code, relay: 'http://' + st.address + ':' + st.port + '/relay', expiresInMs: RELAY_TOKEN_MS };
  };
  const _off = d.off;
  d.off = (why) => { tokens = {}; return _off(why); };   // off forgets every link
  d._liveTokens = () => { prune(); return Object.keys(tokens).length; };
  return d;
}
module.exports.createDiscover = createDiscover033c;
module.exports.relayHtml = relayHtml;
module.exports.relayHeaders = relayHeaders;
module.exports.RELAY_SCRIPT_HASH = RELAY_SCRIPT_HASH;
module.exports.RELAY_TOKEN_MS = RELAY_TOKEN_MS;
module.exports.JOIN_HOME = JOIN_HOME;
