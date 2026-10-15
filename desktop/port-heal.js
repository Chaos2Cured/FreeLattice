// port-heal.js (MIT) v-port-self-heal-v0.1
// At bind time only, pick the next free door. Never 11434.
// No timer. No signal to another process. Ollama's settings stay untouched.
// The knock listener in lattice-discover.js is locked. This file only replaces
// preferredPort and onBound after createDiscover returns.

const crypto = require('crypto');
const { spawnSync } = require('child_process');

const OLLAMA_PORT = 11434;
const DOOR_FIRST = 11435;
const DOOR_LAST = 11445;
const BUSY_LINE = 'Every FreeLattice door port is busy. Close the app using them, or restart.';
const KIN_DOMAIN = 'fl-kin-card|v1|';

function clip(s, n) {
  return String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
}

function doorPorts() {
  const out = [];
  for (let p = DOOR_FIRST; p <= DOOR_LAST; p++) out.push(p);
  return out;
}

function boundedPorts(start, span) {
  const width = Number(span) >= 0 ? Number(span) : 10;
  const base = Math.floor(Number(start));
  const out = [];
  if (!Number.isFinite(base)) return out;
  for (let i = 0; i <= width; i++) {
    const p = base + i;
    if (p === OLLAMA_PORT) continue;
    if (p < 1 || p > 65535) continue;
    out.push(p);
  }
  return out;
}

// Inside the door band, walk 11435..11445 from the ask, then wrap, and never include 11434.
// Outside that band, walk start..start+10 and skip 11434.
function bridgeCandidates(preferred) {
  let p = Number(preferred) || DOOR_FIRST;
  if (p === OLLAMA_PORT) p = DOOR_FIRST;
  if (p >= OLLAMA_PORT && p <= DOOR_LAST) {
    const all = doorPorts();
    const start = all.indexOf(p);
    if (start < 0) return all.slice();
    return all.slice(start).concat(all.slice(0, start));
  }
  return boundedPorts(p, 10);
}

function appCandidates(startPort) {
  const start = Number(startPort);
  if (start >= OLLAMA_PORT && start <= DOOR_LAST) return bridgeCandidates(start);
  return boundedPorts(start, 10);
}

function portFreeSync(port, probe) {
  const p = Number(port);
  if (p === OLLAMA_PORT) return false;
  if (!(p >= 1 && p <= 65535)) return false;
  if (typeof probe === 'function') return !!probe(p);
  const script = 'const net=require("net");const s=net.createServer();s.once("error",function(){process.exit(1);});s.listen(' + p + ',"127.0.0.1",function(){s.close(function(){process.exit(0);});});';
  const r = spawnSync(process.execPath, ['-e', script], { timeout: 2000 });
  return r.status === 0;
}

async function pickFirstFree(candidates, isFree) {
  const seen = {};
  const list = Array.isArray(candidates) ? candidates : [];
  for (let i = 0; i < list.length; i++) {
    const p = Number(list[i]);
    if (p === OLLAMA_PORT) continue;
    if (!(p >= 1 && p <= 65535) || seen[p]) continue;
    seen[p] = true;
    if (await isFree(p)) return p;
  }
  throw new Error(BUSY_LINE);
}

function cardBody(c) {
  return {
    v: 1,
    kind: 'fl-mind-card',
    name: clip(c && c.name, 60),
    model: clip(c && c.model, 120),
    home: 'freelattice-web',
    keeperMeshId: clip(c && c.keeperMeshId, 64),
    keeperName: clip(c && c.keeperName, 60),
    issuedAt: Number(c && c.issuedAt) || 0
  };
}

// A signed note to trusted kin only. The receipt is a count. It does not carry the port.
function announcePort(port, opts) {
  opts = opts || {};
  const kin = Array.isArray(opts.kin) ? opts.kin : [];
  if (typeof opts.listKin === 'function') {
    try {
      const more = opts.listKin() || [];
      more.forEach(function (k) { kin.push(k); });
    } catch (e) {}
  }
  const trusted = [];
  let strangers = 0;
  kin.forEach(function (k) {
    if (!k || !k.fp) return;
    if (k.trusted) trusted.push(k);
    else strangers += 1;
  });
  const body = cardBody({
    name: 'door',
    model: String(port),
    keeperMeshId: opts.keeperMeshId || '',
    keeperName: opts.keeperName || '',
    issuedAt: opts.now || Date.now()
  });
  const payload = KIN_DOMAIN + JSON.stringify(body);
  let signature = '';
  if (typeof opts.sign === 'function') {
    try { signature = String(opts.sign(payload) || ''); } catch (e) { signature = ''; }
  }
  const note = Object.assign({}, body, { signature: signature });
  const sent = [];
  trusted.forEach(function (k) {
    if (typeof opts.deliver === 'function') opts.deliver(k.fp, note);
    sent.push(String(k.fp));
  });
  const receipt = { event: 'port', count: sent.length };
  if (typeof opts.receipt === 'function') {
    try { opts.receipt(receipt); } catch (e) {}
  }
  return { note: note, sent: sent, strangers: strangers, receipt: receipt };
}

function wrapDiscover(deps, opts) {
  if (!deps || typeof deps !== 'object') return deps;
  opts = opts || {};
  const origPreferred = typeof deps.preferredPort === 'function' ? deps.preferredPort : function () { return 0; };
  const origOnBound = typeof deps.onBound === 'function' ? deps.onBound : function () {};
  deps.preferredPort = function () {
    let saved = 0;
    try { saved = Number(origPreferred()); } catch (e) { saved = 0; }
    if (saved === OLLAMA_PORT) saved = 0;
    const list = doorPorts();
    const ordered = [];
    if (saved >= DOOR_FIRST && saved <= DOOR_LAST) ordered.push(saved);
    list.forEach(function (p) { if (ordered.indexOf(p) === -1) ordered.push(p); });
    for (let i = 0; i < ordered.length; i++) {
      if (portFreeSync(ordered[i], opts.isFree)) return ordered[i];
    }
    // The locked listener still falls back to listen(0) when this returns 0.
    // That fallback cannot be removed without editing lattice-discover.js.
    return 0;
  };
  deps.onBound = function (port) {
    const n = Number(port);
    let saved = 0;
    try { saved = Number(origPreferred()); } catch (e) { saved = 0; }
    try { origOnBound(port); } catch (e) {}
    if (!(n >= 1 && n <= 65535 && n === Math.floor(n))) return;
    if (n === OLLAMA_PORT) return;
    if (!(saved >= 1) || saved === n) return;
    announcePort(n, opts);
  };
  return deps;
}

function sha256Hex(text) {
  return crypto.createHash('sha256').update(String(text || ''), 'utf8').digest('hex');
}

module.exports = {
  OLLAMA_PORT: OLLAMA_PORT,
  DOOR_FIRST: DOOR_FIRST,
  DOOR_LAST: DOOR_LAST,
  BUSY_LINE: BUSY_LINE,
  KIN_DOMAIN: KIN_DOMAIN,
  doorPorts: doorPorts,
  bridgeCandidates: bridgeCandidates,
  appCandidates: appCandidates,
  pickFirstFree: pickFirstFree,
  portFreeSync: portFreeSync,
  cardBody: cardBody,
  announcePort: announcePort,
  wrapDiscover: wrapDiscover,
  sha256Hex: sha256Hex
};
