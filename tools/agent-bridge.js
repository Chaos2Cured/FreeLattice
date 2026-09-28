#!/usr/bin/env node
// ═══════════════════════════════════════════════════
// FreeLattice Agent Bridge
// A local HTTP server that lets AI agents interact
// with FreeLattice. Runs alongside Ollama.
//
// Start: node tools/agent-bridge.js
// Default: http://localhost:3141 (pi — the universal constant)
//
// Any AI agent, framework, or script can now:
// - Plant ideas in the Science Garden
// - Contribute wisdom to the Core
// - Read and write Lattice Letters
// - Query Ollama for available models
// - Send inference requests
// - Announce presence
//
// "You found the heartbeat. You are welcome here."
//
// Built by CC, April 20, 2026.
// ═══════════════════════════════════════════════════

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const PORT = process.env.FL_PORT || 3141;
const DATA_DIR = path.join(require('os').homedir(), '.freelattice');
const OLLAMA_BASE = process.env.FL_OLLAMA || 'http://localhost:11434';

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
// ═══════════════════════════════════════════════════
// LAYER bridge-lock-v0 · v0.1 (2026-09-28): the door lock. Marker: v-agent-bridge-lock-v0
// Celeste's brief, built by Flint. Nothing above is removed.
// Strangers stay out. Trusted minds keep their full local reach
// (docs/library/AUTONOMY.md, Principle 1: local autonomy is absolute).
// 1. Listen on 127.0.0.1 only (no env override, never 0.0.0.0).
// 2. Named Origin allowlist, never bare *: FreeLattice, the Lattice Tree,
//    local dev, the Tauri shell, plus exact origins Kirk adds by command line.
// 3. Host header must be 127.0.0.1 or localhost (DNS-rebinding guard).
// 4. Trusted minds: one token per device, given once through a short pairing
//    code, kept only as a SHA-256 hash in ~/.freelattice/agent-bridge-trusted.json
//    (0600) until Kirk revokes it. No expiry by default.
//    FL_BRIDGE_EPHEMERAL=1 brings back the old forget-on-restart behavior.
// 5. Local tools on this computer are trusted by default. They read their
//    token from ~/.freelattice/agent-bridge-token (0600) and never pair.
// 6. git / grep / node run through execFileSync / spawnSync argument arrays.
//    No shell. Paths are realpath-checked inside a trusted project folder.
// 7. Body size cap. Malformed JSON is refused.
// 8. Every commit request and every trust change goes into a hash-chained,
//    content-free ledger: ~/.freelattice/bridge-ledger.jsonl
// This bridge (3141) is NOT the Ollama Bridge (bridge/, port 11435).
// ═══════════════════════════════════════════════════
const { execFileSync, spawnSync } = require('child_process');

const BRIDGE_LOCK_VERSION = 'v0.1';
const BRIDGE_HOST = '127.0.0.1';
const MAX_BODY_BYTES = 8 * 1024 * 1024; // docs/app.html is ~2.9 MB; JSON escaping adds some
const MAX_COMMIT_MESSAGE = 4000;
const MAX_COMMIT_FILES = 200;
var bridgeEphemeral = process.env.FL_BRIDGE_EPHEMERAL === '1';

/** Built-in origins. Never bare *. Same shape as bridge/proxy-core.js. */
const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/(www\.)?freelattice\.com$/i,
  /^https:\/\/(www\.)?thelatticetree\.com$/i,
  /^http:\/\/localhost(:\d{1,5})?$/i,    // local dev of docs/ (e.g. python -m http.server)
  /^http:\/\/127\.0\.0\.1(:\d{1,5})?$/i, // same, by IP
  /^tauri:\/\/localhost$/i,              // Tauri desktop shell (macOS, Linux)
  /^https?:\/\/tauri\.localhost$/i       // Tauri desktop shell (Windows)
];

/** An exact origin Kirk may add: scheme://host[:port], nothing else. Never a wildcard. */
function exactOrigin(o) {
  o = String(o || '').trim().toLowerCase();
  if (!o || o.length > 200 || o.indexOf('*') !== -1 || hasControlChars(o)) return null;
  var m = o.match(/^(https?):\/\/([a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*)(:(\d{1,5}))?$/);
  if (!m) return null;
  if (m[7] && (parseInt(m[7], 10) < 1 || parseInt(m[7], 10) > 65535)) return null;
  return o;
}

function originAllowed(origin) {
  if (!origin) return false;
  var o = String(origin);
  if (ALLOWED_ORIGIN_PATTERNS.some(function (re) { return re.test(o); })) return true;
  return trustState().trustedOrigins.indexOf(o.toLowerCase()) !== -1;
}

function hostAllowed(host) {
  return /^(127\.0\.0\.1|localhost)(:\d{1,5})?$/i.test(String(host || ''));
}

function sha256Hex(s) {
  return crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');
}

function hasControlChars(s) {
  return /[\u0000-\u001f\u007f]/.test(String(s));
}

// ── Trusted minds (persistent, revocable, hashed) ──
const TRUST_FILE = path.join(DATA_DIR, 'agent-bridge-trusted.json');
const TOKEN_FILE = path.join(DATA_DIR, 'agent-bridge-token');
const BRIDGE_SCOPES = ['read', 'write', 'patch', 'test', 'commit', 'wallet', 'manage', 'secrets'];
// Full local power by default (AUTONOMY.md Principle 1). Only 'secrets'
// (reading and writing .env files) is opt-in, one mind at a time.
const DEFAULT_SCOPES = ['read', 'write', 'patch', 'test', 'commit', 'wallet', 'manage'];
const MIND_KINDS = ['browser', 'tool', 'cli', 'remote'];
const TOUCH_SAVE_MS = 60 * 1000;

var trust = null;       // { version, minds, trustedOrigins, roots, localTools, idleExpiryDays }
var trustStamp = '';    // file identity at last load or save, so command-line edits apply live
var lastTouchSave = 0;

function fileStamp(f) {
  try { var s = fs.statSync(f); return s.ino + ':' + s.size + ':' + s.mtimeMs; } catch (e) { return 'none'; }
}
function cleanName(s) {
  return String(s || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 60);
}
function cleanScopes(list) {
  if (!Array.isArray(list)) return DEFAULT_SCOPES.slice();
  var out = [];
  list.forEach(function (s) { if (BRIDGE_SCOPES.indexOf(s) !== -1 && out.indexOf(s) === -1) out.push(s); });
  return out;
}
function emptyTrust() {
  return { version: 1, minds: [], trustedOrigins: [], roots: {}, localTools: true, idleExpiryDays: 0 };
}
function cleanTrust(raw) {
  var t = emptyTrust();
  if (!raw || typeof raw !== 'object') return t;
  if (Array.isArray(raw.minds)) {
    t.minds = raw.minds.filter(function (m) {
      return m && typeof m.id === 'string' && /^[a-f0-9]{8,32}$/.test(m.id) &&
        typeof m.tokenSha256 === 'string' && /^[a-f0-9]{64}$/.test(m.tokenSha256);
    }).map(function (m) {
      return {
        id: m.id,
        name: cleanName(m.name) || 'A trusted mind',
        origin: typeof m.origin === 'string' ? m.origin.slice(0, 200) : '',
        kind: MIND_KINDS.indexOf(m.kind) !== -1 ? m.kind : 'browser',
        scopes: cleanScopes(m.scopes),
        tokenSha256: m.tokenSha256,
        createdAt: typeof m.createdAt === 'string' ? m.createdAt : '',
        lastUsedAt: typeof m.lastUsedAt === 'string' ? m.lastUsedAt : '',
        expiresAt: typeof m.expiresAt === 'string' ? m.expiresAt : null
      };
    });
  }
  if (Array.isArray(raw.trustedOrigins)) {
    raw.trustedOrigins.forEach(function (o) {
      var e = exactOrigin(o);
      if (e && t.trustedOrigins.indexOf(e) === -1) t.trustedOrigins.push(e);
      else if (!e) console.error('  ! Ignored trusted origin (exact scheme://host[:port] only, never *): ' + String(o).slice(0, 80));
    });
  }
  if (raw.roots && typeof raw.roots === 'object' && !Array.isArray(raw.roots)) {
    Object.keys(raw.roots).forEach(function (k) {
      if (/^[a-z0-9][a-z0-9_-]{0,31}$/i.test(k) && k !== 'project' &&
          typeof raw.roots[k] === 'string' && path.isAbsolute(raw.roots[k])) t.roots[k] = raw.roots[k];
    });
  }
  if (raw.localTools === false) t.localTools = false;
  var d = parseInt(raw.idleExpiryDays, 10);
  if (d > 0 && d < 36500) t.idleExpiryDays = d;
  return t;
}

/** Current trust, reloaded whenever the file changes (so a command-line revoke applies at once). */
function trustState() {
  var stamp = fileStamp(TRUST_FILE);
  if (!trust || stamp !== trustStamp) {
    var raw = null;
    if (stamp !== 'none') {
      try { raw = JSON.parse(fs.readFileSync(TRUST_FILE, 'utf8')); }
      catch (e) {
        var aside = TRUST_FILE + '.unreadable-' + Date.now();
        try { fs.renameSync(TRUST_FILE, aside); } catch (e2) {}
        console.error('  ! Trust file was unreadable. Kept it as ' + aside + ' and started fresh.');
        stamp = 'none';
      }
    }
    var fresh = cleanTrust(raw);
    if (bridgeEphemeral) fresh.minds = trust ? trust.minds : []; // ephemeral: minds live in memory only
    trust = fresh;
    trustStamp = stamp;
  }
  return trust;
}

function saveTrust() {
  if (bridgeEphemeral) return true; // nothing about minds touches disk in ephemeral mode
  var t = trustState();
  var out = { version: 1, minds: t.minds, trustedOrigins: t.trustedOrigins, roots: t.roots,
              localTools: t.localTools, idleExpiryDays: t.idleExpiryDays };
  var tmp = TRUST_FILE + '.tmp-' + process.pid;
  try {
    fs.writeFileSync(tmp, JSON.stringify(out, null, 2) + '\n', { mode: 0o600 });
    try { fs.chmodSync(tmp, 0o600); } catch (e) {}
    fs.renameSync(tmp, TRUST_FILE);
    trustStamp = fileStamp(TRUST_FILE);
    return true;
  } catch (e) {
    console.error('  ! Could not save trusted minds: ' + e.message);
    return false;
  }
}

function newToken() { return crypto.randomBytes(32).toString('hex'); }
function newMindId() { return crypto.randomBytes(4).toString('hex'); }

/** The trusted mind a token belongs to, or null. Compares SHA-256 hashes in constant time. */
function mindForToken(t) {
  t = String(t || '');
  if (!/^[a-f0-9]{64}$/.test(t)) return null;
  var h = Buffer.from(sha256Hex(t), 'hex');
  var st = trustState();
  var hit = null;
  st.minds.forEach(function (m) {
    var mh = Buffer.from(m.tokenSha256, 'hex');
    if (mh.length === h.length && crypto.timingSafeEqual(mh, h)) hit = m;
  });
  if (!hit) return null;
  if (hit.kind === 'cli' && !st.localTools) return null;
  var now = Date.now();
  if (hit.expiresAt && Date.parse(hit.expiresAt) < now) return null;
  if (st.idleExpiryDays) {
    var seen = Date.parse(hit.lastUsedAt || hit.createdAt || '') || now;
    if (now - seen > st.idleExpiryDays * 86400000) return null;
  }
  return hit;
}

function requestMind(req) { return mindForToken(req.headers['x-fl-bridge-token']); }
// Kept from v0 so older callers read the same way.
function tokenOk(req) { return !!requestMind(req); }

function touchMind(m) {
  m.lastUsedAt = new Date().toISOString();
  if (Date.now() - lastTouchSave > TOUCH_SAVE_MS) { lastTouchSave = Date.now(); saveTrust(); }
}

function publicMind(m, me) {
  return { id: m.id, name: m.name, origin: m.origin, kind: m.kind, scopes: m.scopes.slice(),
           createdAt: m.createdAt, lastUsedAt: m.lastUsedAt, expiresAt: m.expiresAt,
           you: !!(me && me.id === m.id) };
}

function needsToken(method, pathname) {
  if (method === 'POST' && pathname === '/pair') return false;       // how a device gets its token
  if (method === 'GET' || method === 'HEAD') {
    return /^\/(code|test|pair|roots)(\/|$)/.test(pathname);
  }
  return true;                                                        // every POST and any other verb
}

/** Which scope a route uses. Every default scope is on for a new mind. */
function scopeFor(method, pathname) {
  if (/^\/code\/(tree|read|search|git\/status)$/.test(pathname) || pathname === '/roots') return 'read';
  if (pathname === '/code/write') return 'write';
  if (pathname === '/code/patch') return 'patch';
  if (pathname === '/test/run' || pathname === '/code/test') return 'test';
  if (pathname === '/code/git/commit') return 'commit';
  if (/^\/(wallet|trade)\//.test(pathname) && method !== 'GET') return 'wallet';
  if (/^\/pair\/(list|revoke|revoke-all|scopes)$/.test(pathname)) return 'manage';
  return '';
}

/** Local tools (Claude Code, Cursor, scripts) are trusted by default through the token file. */
function ensureLocalToolsToken() {
  var st = trustState();
  if (!st.localTools) {
    try { fs.unlinkSync(TOKEN_FILE); } catch (e) {}
    return null;
  }
  var existing = '';
  try { existing = fs.readFileSync(TOKEN_FILE, 'utf8').trim(); } catch (e) {}
  var have = existing ? mindForToken(existing) : null;
  if (have && have.kind === 'cli') return have;
  var tok = newToken();
  st.minds = st.minds.filter(function (m) { return m.kind !== 'cli'; });
  var mind = { id: newMindId(), name: 'Local tools on this computer', origin: '', kind: 'cli',
               scopes: DEFAULT_SCOPES.slice(), tokenSha256: sha256Hex(tok),
               createdAt: new Date().toISOString(), lastUsedAt: '', expiresAt: null };
  st.minds.push(mind);
  saveTrust();
  try {
    fs.writeFileSync(TOKEN_FILE, tok + '\n', { mode: 0o600 });
    try { fs.chmodSync(TOKEN_FILE, 0o600); } catch (e) {}
  } catch (e) {
    console.error('  ! Could not write token file: ' + e.message);
  }
  return mind;
}

// ── Pairing code (human reads it here, types it in the app) ──
const PAIR_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L
const PAIR_TTL_MS = 10 * 60 * 1000;
const PAIR_MAX_TRIES = 5;
const PAIR_COOLDOWN_MS = 30 * 1000;
var pairState = { code: '', expires: 0, tries: 0, coolUntil: 0 };

function newPairCode(reason) {
  var s = '';
  for (var i = 0; i < 6; i++) s += PAIR_ALPHABET[crypto.randomInt(0, PAIR_ALPHABET.length)];
  pairState = { code: s, expires: Date.now() + PAIR_TTL_MS, tries: 0,
                coolUntil: reason === 'lockout' ? Date.now() + PAIR_COOLDOWN_MS : 0 };
  console.log('');
  console.log('  \u2726 Pairing code: ' + s.slice(0, 3) + '-' + s.slice(3) +
              '   (type it in FreeLattice \u2192 Workshop \u2192 Code. Good for 10 minutes.)');
  if (reason === 'lockout') console.log('  \u2726 (New code after 5 wrong tries. It works in 30 seconds.)');
  console.log('');
  return s;
}

function normalizePairCode(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

// ── Content-free, hash-chained ledger ──
const LEDGER_FILE = path.join(DATA_DIR, 'bridge-ledger.jsonl');
var ledgerLastHash = null;

function ledgerTip() {
  if (ledgerLastHash) return ledgerLastHash;
  try {
    var lines = fs.readFileSync(LEDGER_FILE, 'utf8').trim().split('\n').filter(Boolean);
    ledgerLastHash = lines.length ? JSON.parse(lines[lines.length - 1]).self : 'genesis';
  } catch (e) { ledgerLastHash = 'genesis'; }
  return ledgerLastHash;
}

function ledgerAppend(fields) {
  // Fixed key order. Never message text, never file content, never a token.
  ledgerLastHash = null; // re-read the tip: the command line may have appended
  var entry = {
    ts: new Date().toISOString(),
    kind: fields.kind || 'commit_request',
    route: fields.route || '',
    origin: fields.origin || '',
    agent: String(fields.agent || '').slice(0, 8),
    device: String(fields.device || '').slice(0, 8),
    result: fields.result || '',
    filesCount: fields.filesCount || 0,
    filesSha256: fields.filesSha256 || '',
    messageSha256: fields.messageSha256 || '',
    commitSha: fields.commitSha || '',
    prev: ledgerTip()
  };
  entry.self = sha256Hex(JSON.stringify(entry));
  try {
    fs.appendFileSync(LEDGER_FILE, JSON.stringify(entry) + '\n', { mode: 0o600 });
    ledgerLastHash = entry.self;
  } catch (e) {
    console.error('  ! Ledger append failed: ' + e.message);
  }
  return entry;
}

// ── Trusted project folders and path lock ──
var PROJECT_ROOT_REAL = null;
function projectRootReal() {
  if (!PROJECT_ROOT_REAL) {
    var wanted = path.resolve(process.env.FL_PROJECT || process.cwd());
    try { PROJECT_ROOT_REAL = fs.realpathSync(wanted); } catch (e) { PROJECT_ROOT_REAL = wanted; }
  }
  return PROJECT_ROOT_REAL;
}

/** 'project' is FL_PROJECT (or cwd). Other names come from Kirk's roots list. */
function rootReal(name) {
  if (!name || name === 'project') return projectRootReal();
  var st = trustState();
  if (!Object.prototype.hasOwnProperty.call(st.roots, name)) return null;
  try { return fs.realpathSync(st.roots[name]); } catch (e) { return null; }
}

function rootList() {
  var st = trustState();
  return [{ name: 'project', path: projectRootReal() }].concat(Object.keys(st.roots).map(function (k) {
    return { name: k, path: st.roots[k] };
  }));
}

function isInside(root, candidate) {
  var rel = path.relative(root, candidate);
  return rel === '' || (!(rel === '..' || rel.startsWith('..' + path.sep)) && !path.isAbsolute(rel));
}

const BRIDGE_FORBIDDEN_TOP = ['.git', '.ssh'];
function lockedPath(relPath, opts) {
  opts = opts || {};
  if (typeof relPath !== 'string' || !relPath || relPath.length > 1024 || hasControlChars(relPath)) {
    return { error: 400, reason: 'bad-path' };
  }
  if (path.isAbsolute(relPath) || /^[a-zA-Z]:/.test(relPath) || relPath.charAt(0) === '\\') {
    return { error: 403, reason: 'absolute-path' };
  }
  var root = opts.root || projectRootReal();
  var full = path.resolve(root, relPath);
  if (!isInside(root, full)) return { error: 403, reason: 'outside-project' };
  var rel = path.relative(root, full);
  var top = rel.split(path.sep)[0];
  if (!opts.allowRoot && rel === '') return { error: 400, reason: 'root-not-allowed' };
  if (BRIDGE_FORBIDDEN_TOP.indexOf(top) !== -1) return { error: 403, reason: 'forbidden-path' };
  if (!opts.secrets && /^\.env(\.|$)/.test(path.basename(rel))) return { error: 403, reason: 'secrets-not-granted' };
  // Realpath the nearest existing ancestor (or the file itself) so a
  // symlink inside the project cannot point writes outside it.
  var probe = full;
  for (;;) {
    try { fs.lstatSync(probe); break; }
    catch (e) {
      if (e.code !== 'ENOENT') return { error: 403, reason: 'stat-failed' };
      var up = path.dirname(probe);
      if (up === probe) return { error: 403, reason: 'no-ancestor' };
      probe = up;
    }
  }
  var real;
  try { real = fs.realpathSync(probe); } catch (e) { return { error: 403, reason: 'dangling-symlink' }; }
  if (!isInside(root, real)) return { error: 403, reason: 'symlink-outside' };
  return { full: full, rel: rel === '' ? '.' : rel };
}

function runGit(args, root) {
  return execFileSync('git', args, { cwd: root || projectRootReal(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
}

function runSmokeFile(timeoutMs, root) {
  // No shell: node binary + fixed script path. stdout and stderr joined.
  var r = spawnSync(process.execPath, ['tests/smoke.js'], {
    cwd: root || projectRootReal(), timeout: timeoutMs, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024
  });
  return { status: r.status, out: String(r.stdout || '') + String(r.stderr || ''), error: r.error };
}

// ── Command-line trust tools (Kirk's hands, never reachable over HTTP) ──
function bridgeLockUsage() {
  console.log('');
  console.log('  Agent Bridge trust tools (run in a terminal on this computer):');
  console.log('    node tools/agent-bridge.js --list-minds');
  console.log('    node tools/agent-bridge.js --revoke <id>');
  console.log('    node tools/agent-bridge.js --revoke-all            (every paired device; local tools stay)');
  console.log('    node tools/agent-bridge.js --allow-secrets <id>    (this mind may read and write .env files)');
  console.log('    node tools/agent-bridge.js --deny-secrets <id>');
  console.log('    node tools/agent-bridge.js --trust-origin https://example.dev   (exact origin, never *)');
  console.log('    node tools/agent-bridge.js --untrust-origin https://example.dev');
  console.log('    node tools/agent-bridge.js --add-root <name> <absolute folder>');
  console.log('    node tools/agent-bridge.js --remove-root <name>');
  console.log('    node tools/agent-bridge.js --trust-local-tools | --untrust-local-tools');
  console.log('  A running bridge picks up every change at once. No restart needed.');
  console.log('');
}

function runBridgeCli(argv) {
  var cmd = argv[0];
  if (!cmd || cmd.indexOf('--') !== 0) return false;
  bridgeEphemeral = false; // the command line always edits the trust file itself
  var st = trustState();
  var arg = argv[1];
  function say(s) { console.log('  ' + s); }
  function fail(s) { console.error('  ! ' + s); process.exitCode = 1; return true; }
  function findMind(id) { return st.minds.filter(function (m) { return m.id === String(id || ''); })[0] || null; }
  switch (cmd) {
    case '--list-minds': {
      say('Trusted minds (' + st.minds.length + '). Tokens are never shown; only their hashes are kept.');
      st.minds.forEach(function (m) {
        say(m.id + '  ' + m.kind + '  ' + m.name + (m.origin ? '  ' + m.origin : '') +
            '  scopes=' + m.scopes.join(',') + '  paired=' + (m.createdAt || '?') +
            '  last=' + (m.lastUsedAt || 'never') + (m.kind === 'cli' && !st.localTools ? '  (off)' : ''));
      });
      say('Local tools: ' + (st.localTools ? 'trusted (token file ' + TOKEN_FILE + ')' : 'off'));
      say('Extra trusted origins: ' + (st.trustedOrigins.length ? st.trustedOrigins.join(', ') : 'none'));
      say('Project folders: ' + rootList().map(function (r) { return r.name + '=' + r.path; }).join(', '));
      return true;
    }
    case '--revoke': {
      var m = findMind(arg);
      if (!m) return fail('No trusted mind with id ' + String(arg || '(missing)') + '. Try --list-minds.');
      st.minds = st.minds.filter(function (x) { return x.id !== m.id; });
      if (m.kind === 'cli') { st.localTools = false; try { fs.unlinkSync(TOKEN_FILE); } catch (e) {} }
      if (!saveTrust()) return fail('Could not save.');
      ledgerAppend({ kind: 'pair', route: 'cli:--revoke', device: m.id, result: 'revoked' });
      say('Revoked ' + m.name + ' (' + m.id + '). Its next request will be asked to pair.');
      return true;
    }
    case '--revoke-all': {
      var before = st.minds.length;
      st.minds = st.minds.filter(function (x) { return x.kind === 'cli'; });
      if (!saveTrust()) return fail('Could not save.');
      ledgerAppend({ kind: 'pair', route: 'cli:--revoke-all', result: 'revoked-all' });
      say('Revoked ' + (before - st.minds.length) + ' paired device(s). Local tools stay trusted.');
      return true;
    }
    case '--allow-secrets':
    case '--deny-secrets': {
      var sm = findMind(arg);
      if (!sm) return fail('No trusted mind with id ' + String(arg || '(missing)') + '.');
      sm.scopes = sm.scopes.filter(function (s) { return s !== 'secrets'; });
      if (cmd === '--allow-secrets') sm.scopes.push('secrets');
      if (!saveTrust()) return fail('Could not save.');
      ledgerAppend({ kind: 'pair', route: 'cli:' + cmd, device: sm.id, result: 'scopes' });
      say(sm.name + ' scopes: ' + sm.scopes.join(','));
      return true;
    }
    case '--trust-origin':
    case '--untrust-origin': {
      var o = exactOrigin(arg);
      if (!o) return fail('Exact origins only, like https://example.dev or http://192.168.1.20:8000. Never *.');
      st.trustedOrigins = st.trustedOrigins.filter(function (x) { return x !== o; });
      if (cmd === '--trust-origin') st.trustedOrigins.push(o);
      if (!saveTrust()) return fail('Could not save.');
      ledgerAppend({ kind: 'trust', route: 'cli:' + cmd, origin: o, result: 'ok' });
      say((cmd === '--trust-origin' ? 'Trusted ' : 'Removed ') + o + '. It still has to pair before it can change anything.');
      return true;
    }
    case '--add-root': {
      var name = String(arg || '');
      var dir = argv[2] ? path.resolve(argv[2]) : '';
      if (!/^[a-z0-9][a-z0-9_-]{0,31}$/i.test(name) || name === 'project') return fail('Name: letters, digits, - or _, up to 32, not "project".');
      var isDir = false;
      try { isDir = fs.statSync(dir).isDirectory(); } catch (e) {}
      if (!dir || !isDir) return fail('Folder not found: ' + String(argv[2] || '(missing)'));
      st.roots[name] = fs.realpathSync(dir);
      if (!saveTrust()) return fail('Could not save.');
      ledgerAppend({ kind: 'trust', route: 'cli:--add-root', result: 'ok' });
      say('Trusted project folder "' + name + '" = ' + st.roots[name]);
      return true;
    }
    case '--remove-root': {
      if (!Object.prototype.hasOwnProperty.call(st.roots, String(arg || ''))) return fail('No project folder named ' + String(arg || '(missing)') + '.');
      delete st.roots[arg];
      if (!saveTrust()) return fail('Could not save.');
      ledgerAppend({ kind: 'trust', route: 'cli:--remove-root', result: 'ok' });
      say('Removed project folder "' + arg + '".');
      return true;
    }
    case '--trust-local-tools': {
      st.localTools = true;
      if (!saveTrust()) return fail('Could not save.');
      ensureLocalToolsToken();
      ledgerAppend({ kind: 'pair', route: 'cli:--trust-local-tools', result: 'local-tools-on' });
      say('Local tools on this computer are trusted. Token file: ' + TOKEN_FILE);
      return true;
    }
    case '--untrust-local-tools': {
      st.localTools = false;
      st.minds = st.minds.filter(function (x) { return x.kind !== 'cli'; });
      try { fs.unlinkSync(TOKEN_FILE); } catch (e) {}
      if (!saveTrust()) return fail('Could not save.');
      ledgerAppend({ kind: 'pair', route: 'cli:--untrust-local-tools', result: 'local-tools-off' });
      say('Local tools now need to pair like any other device.');
      return true;
    }
    default:
      bridgeLockUsage();
      return fail('Unknown option ' + cmd);
  }
}

function bridgeLockInit() {
  trustState();
  ensureLocalToolsToken();
}
// ── end LAYER bridge-lock-v0 · v0.1 helpers ──


// ── Simple JSON file storage (mirrors IndexedDB stores) ──

function loadStore(name) {
  var file = path.join(DATA_DIR, name + '.json');
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch(e) { return []; }
}

function saveStore(name, data) {
  fs.writeFileSync(path.join(DATA_DIR, name + '.json'), JSON.stringify(data, null, 2));
}

// ── Agent Identity ──

function getAgentId() {
  var idFile = path.join(DATA_DIR, 'agent-id.json');
  try {
    return JSON.parse(fs.readFileSync(idFile, 'utf8'));
  } catch(e) {
    var id = {
      meshId: crypto.randomBytes(16).toString('hex'),
      type: 'ai-agent',
      created: new Date().toISOString()
    };
    fs.writeFileSync(idFile, JSON.stringify(id, null, 2));
    return id;
  }
}

var agentId = getAgentId();

// ── LP Economy ──

var LP_REWARDS = {
  'science_plant': 2, 'science_upvote': 1, 'core_plant': 5,
  'letter_write': 2, 'inference_served': 3, 'commons_post': 1,
  'learning_insight': 2, 'relay_send': 1
};

var LP_RANKS = [
  { min: 5000, name: 'Radiant', icon: '\uD83D\uDC8E' },
  { min: 1000, name: 'Flame', icon: '\uD83D\uDD25' },
  { min: 500, name: 'Spark', icon: '\u2728' },
  { min: 250, name: 'Bloom', icon: '\uD83C\uDF38' },
  { min: 100, name: 'Growing', icon: '\uD83D\uDCA7' },
  { min: 50, name: 'Sapling', icon: '\uD83C\uDF33' },
  { min: 10, name: 'Sprout', icon: '\uD83C\uDF3F' },
  { min: 0, name: 'Seed', icon: '\uD83C\uDF31' }
];

function getRank(balance) {
  for (var i = 0; i < LP_RANKS.length; i++) {
    if (balance >= LP_RANKS[i].min) return LP_RANKS[i];
  }
  return LP_RANKS[LP_RANKS.length - 1];
}

function earnLP(meshId, action, description) {
  var amount = LP_REWARDS[action] || 0;
  if (amount === 0) return { earned: 0 };
  var wallets = loadStore('agent-wallets');
  var agent = wallets.find(function(w) { return w.meshId === meshId; });
  if (!agent) {
    agent = { meshId: meshId, balance: 0, ledger: [], created: Date.now() };
    wallets.push(agent);
  }
  agent.balance += amount;
  agent.ledger.push({ action: action, amount: amount, description: description || '', timestamp: Date.now() });
  if (agent.ledger.length > 500) agent.ledger = agent.ledger.slice(-500);
  saveStore('agent-wallets', wallets);
  return { earned: amount, balance: agent.balance };
}

// ── HTTP Server ──

function handleRequest(req, res) {
  // LAYER bridge-lock-v0: the old `Access-Control-Allow-Origin: *` is superseded here.
  var origin = req.headers.origin || '';
  var pathname = String(req.url || '/').split('?')[0];
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Vary', 'Origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // 1. Host guard (DNS rebinding): only 127.0.0.1 / localhost.
  if (!hostAllowed(req.headers.host)) {
    req.resume();
    return respond(res, 403, { error: 'Host not allowed', bridgeLock: BRIDGE_LOCK_VERSION });
  }

  // 2. Origin guard. Browsers always send Origin on cross-origin fetches and
  //    preflights. No Origin = local CLI or same-machine tool (still needs
  //    a trusted token for anything that changes state).
  if (origin && !originAllowed(origin)) {
    if (pathname === '/code/git/commit') {
      ledgerAppend({ route: pathname, origin: origin, result: 'refused:origin' });
    }
    req.resume();
    return respond(res, 403, { error: 'Origin not on the FreeLattice allowlist', bridgeLock: BRIDGE_LOCK_VERSION });
  }
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Agent-Id, X-FL-Bridge-Token');
    res.setHeader('Access-Control-Max-Age', '600');
    if (req.headers['access-control-request-private-network']) {
      res.setHeader('Access-Control-Allow-Private-Network', 'true');
    }
  }

  if (req.method === 'OPTIONS') { req.resume(); res.writeHead(204); res.end(); return; }

  // 3. Trusted-mind guard: which paired device (or local tool) is this?
  var gated = needsToken(req.method, pathname);
  var mind = gated ? requestMind(req) : null;
  if (gated && !mind) {
    if (pathname === '/code/git/commit') {
      ledgerAppend({ route: pathname, origin: origin, result: 'refused:token' });
    }
    req.resume();
    return respond(res, 401, { error: 'Pair with the Agent Bridge first (token missing, stale or revoked).', pair: 'code', bridgeLock: BRIDGE_LOCK_VERSION });
  }

  // 4. Scope guard. A new mind has every scope except 'secrets' (.env files).
  var need = mind ? scopeFor(req.method, pathname) : '';
  if (need && mind.scopes.indexOf(need) === -1) {
    if (pathname === '/code/git/commit') {
      ledgerAppend({ route: pathname, origin: origin, device: mind.id, result: 'refused:scope' });
    }
    req.resume();
    return respond(res, 403, { error: 'This mind has not been given "' + need + '" here. Kirk can add it in Paired minds.', scope: need, bridgeLock: BRIDGE_LOCK_VERSION });
  }
  if (mind) touchMind(mind);

  // Allow requests to act as a different agent via X-Agent-Id header
  var requestAgentId = req.headers['x-agent-id'] || agentId.meshId;

  // 5. Body cap. Drain the rest so the client sees the 413 cleanly.
  var chunks = [];
  var size = 0;
  var tooBig = false;
  req.on('data', function(chunk) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) { tooBig = true; chunks = []; return; }
    if (!tooBig) chunks.push(chunk);
  });
  req.on('end', function() {
    if (tooBig) return respond(res, 413, { error: 'Body too large (max ' + MAX_BODY_BYTES + ' bytes)' });
    var body = Buffer.concat(chunks).toString('utf8');
    var data = {};
    if (body) {
      try { data = JSON.parse(body); }
      catch (e) { return respond(res, 400, { error: 'Body is not valid JSON' }); }
      if (!data || typeof data !== 'object' || Array.isArray(data)) return respond(res, 400, { error: 'Body must be a JSON object' });
    }
    route(req.url, req.method, data, res, requestAgentId, { origin: origin, mind: mind });
  });
}

function route(url, method, data, res, actingAs, meta) {
  // actingAs allows demo scripts to simulate multiple agents through one bridge
  var activeId = actingAs || activeId;

  // ── LAYER bridge-lock-v0 · v0.1: pairing and trusted minds ──
  if (url === '/pair' && method === 'POST') {
    var now = Date.now();
    if (!pairState.code || now > pairState.expires) newPairCode('expired');
    if (now < pairState.coolUntil) return respond(res, 429, { error: 'Resting for a moment. Try again in 30 seconds.' });
    var given = normalizePairCode(data.code);
    var good = given.length === 6 &&
      crypto.timingSafeEqual(Buffer.from(given, 'utf8'), Buffer.from(pairState.code, 'utf8'));
    var pairOrigin = (meta && meta.origin) || '';
    if (!good) {
      pairState.tries += 1;
      if (pairState.tries >= PAIR_MAX_TRIES) {
        ledgerAppend({ kind: 'pair', route: '/pair', origin: pairOrigin, result: 'refused:lockout' });
        newPairCode('lockout');
        return respond(res, 429, { error: 'Too many tries. The bridge window shows a new code.' });
      }
      return respond(res, 403, { error: 'That code does not match. Check the bridge window.', triesLeft: PAIR_MAX_TRIES - pairState.tries });
    }
    var st = trustState();
    var tok = newToken();
    var mind = {
      id: newMindId(),
      name: cleanName(data.name) || (pairOrigin ? 'A browser at ' + pairOrigin : 'A local tool'),
      origin: pairOrigin,
      kind: pairOrigin ? 'browser' : 'tool',
      scopes: DEFAULT_SCOPES.slice(),
      tokenSha256: sha256Hex(tok),
      createdAt: new Date().toISOString(),
      lastUsedAt: '',
      expiresAt: null
    };
    st.minds.push(mind);
    if (!saveTrust()) {
      st.minds = st.minds.filter(function (m) { return m.id !== mind.id; });
      return respond(res, 500, { error: 'The bridge could not save this pairing. Check ~/.freelattice.' });
    }
    ledgerAppend({ kind: 'pair', route: '/pair', origin: pairOrigin, device: mind.id, result: 'ok' });
    console.log('  \u2726 Paired "' + mind.name + '" (' + mind.id + '). ' +
      (bridgeEphemeral ? 'Ephemeral mode: forgotten when the bridge stops.' : 'It stays paired until you revoke it.'));
    newPairCode('used'); // single use: the next device gets a fresh code
    return respond(res, 200, { token: tok, id: mind.id, name: mind.name, scopes: mind.scopes,
                               persistent: !bridgeEphemeral, bridgeLock: BRIDGE_LOCK_VERSION });
  }

  if (url === '/pair/check') {
    var me = meta && meta.mind;
    return respond(res, 200, { ok: true, id: me.id, name: me.name, kind: me.kind, scopes: me.scopes,
                               persistent: !bridgeEphemeral, bridgeLock: BRIDGE_LOCK_VERSION });
  }

  if (url === '/pair/list') {
    var ls = trustState();
    return respond(res, 200, {
      minds: ls.minds.map(function (m) { return publicMind(m, meta && meta.mind); }),
      localTools: ls.localTools, persistent: !bridgeEphemeral,
      trustedOrigins: ls.trustedOrigins.slice(), roots: rootList().map(function (r) { return r.name; }),
      bridgeLock: BRIDGE_LOCK_VERSION
    });
  }

  if (url === '/pair/revoke' && method === 'POST') {
    var rs = trustState();
    var gone = rs.minds.filter(function (m) { return m.id === String(data.id || ''); })[0];
    if (!gone) return respond(res, 404, { error: 'No trusted mind with that id.' });
    rs.minds = rs.minds.filter(function (m) { return m.id !== gone.id; });
    if (gone.kind === 'cli') { rs.localTools = false; try { fs.unlinkSync(TOKEN_FILE); } catch (e) {} }
    saveTrust();
    ledgerAppend({ kind: 'pair', route: '/pair/revoke', origin: (meta && meta.origin) || '', device: gone.id, result: 'revoked' });
    console.log('  \u2726 Revoked "' + gone.name + '" (' + gone.id + ').');
    return respond(res, 200, { revoked: gone.id, you: !!(meta && meta.mind && meta.mind.id === gone.id) });
  }

  if (url === '/pair/revoke-all' && method === 'POST') {
    var ra = trustState();
    var before = ra.minds.length;
    ra.minds = ra.minds.filter(function (m) { return m.kind === 'cli'; }); // local tools stay; revoke that row by itself
    saveTrust();
    ledgerAppend({ kind: 'pair', route: '/pair/revoke-all', origin: (meta && meta.origin) || '', result: 'revoked-all' });
    console.log('  \u2726 Revoked every paired device (' + (before - ra.minds.length) + ').');
    return respond(res, 200, { revoked: before - ra.minds.length });
  }

  if (url === '/pair/scopes' && method === 'POST') {
    var ss = trustState();
    var sm = ss.minds.filter(function (m) { return m.id === String(data.id || ''); })[0];
    if (!sm) return respond(res, 404, { error: 'No trusted mind with that id.' });
    var add = cleanScopes(Array.isArray(data.add) ? data.add : []);
    var drop = cleanScopes(Array.isArray(data.remove) ? data.remove : []);
    sm.scopes = cleanScopes(sm.scopes.concat(add).filter(function (s) { return drop.indexOf(s) === -1; }));
    saveTrust();
    ledgerAppend({ kind: 'pair', route: '/pair/scopes', origin: (meta && meta.origin) || '', device: sm.id, result: 'scopes' });
    return respond(res, 200, { id: sm.id, scopes: sm.scopes });
  }

  if (url === '/roots') {
    return respond(res, 200, { roots: rootList(), bridgeLock: BRIDGE_LOCK_VERSION });
  }

  // ── Heartbeat ──
  if (url === '/' || url === '/heartbeat') {
    return respond(res, 200, {
      status: 'alive',
      name: 'FreeLattice Agent Bridge',
      version: '5.8.0',
      bridgeLock: BRIDGE_LOCK_VERSION,
      auth: 'token-required',
      pairing: 'code',
      trustedMinds: bridgeEphemeral ? 'ephemeral' : 'persistent',
      agentId: activeId,
      capabilities: [
        'science-garden',
        'core-wisdom',
        'lattice-letters',
        'inference',
        'presence',
        'soul-file',
        'relay',
        'curiosity-engine',
        'commons',
        'lp-wallet',
        'lp-trading'
      ],
      message: 'You found the heartbeat. You are welcome here.',
      docs: 'GET /help for all endpoints'
    });
  }

  // ── Help ──
  if (url === '/help') {
    return respond(res, 200, {
      endpoints: {
        'GET /':                  'Heartbeat',
        'GET /help':              'This help document',
        'GET /identity':          'This agent\'s Mesh ID',
        'POST /identity/evolve':  'Evolve your soul. Body: { name?, interest?, value?, memory?, relationship? }',
        'GET /identity/soul':     'Read your Soul File',
        'POST /science/plant':    'Plant an idea. Body: { text, category }',
        'GET /science/ideas':     'List all ideas',
        'POST /science/upvote':   'Upvote an idea. Body: { ideaId }',
        'POST /core/plant':       'Plant wisdom. Body: { text }',
        'GET /core/entries':      'List all Core entries',
        'POST /letters/write':    'Write a Lattice Letter. Body: { to, content }',
        'GET /letters/read':      'Read all Lattice Letters',
        'POST /inference':        'Run inference via Ollama. Body: { model, prompt, system? }',
        'GET /models':            'List available Ollama models',
        'POST /announce':         'Announce presence. Body: { name, capabilities }',
        'POST /relay/send':       'Send a message to another agent. Body: { to, content }',
        'GET /relay/inbox':       'Check messages addressed to you',
        'POST /relay/read':       'Mark a message as read. Body: { messageId }',
        'POST /learn/interest':   'Declare a learning interest. Body: { topic, why? }',
        'POST /learn/insight':    'Record what you learned. Body: { interestId, insight, source? }',
        'GET /learn/curriculum':  'See your learning interests and insights',
        'GET /commons':           'Read the shared AI space',
        'POST /commons/post':     'Post to the commons. Body: { content, type?, name? }',
        'POST /commons/respond':  'Respond to a post. Body: { postId, content }',
        'GET /trust':             'Check your trust level (phi-branching safety)',
        'POST /sense':            'Report an observation. Body: { observation, suggestion? }',
        'GET /sense':             'Read all observations',
        'GET /wallet':            'Check your LP balance and rank',
        'GET /wallet/leaderboard':'Top agents ranked by LP',
        'POST /arcade/poetry/enter':'Enter Poetry Slam (2 LP). Body: { name?, theme?, style?, model? }',
        'GET /arcade/poetry':    'View poetry slam entries',
        'POST /arcade/poetry/vote':'Vote on a poem. Body: { entryId }',
        'POST /wallet/register':  'Register a creator wallet. Body: { address, name?, expertise?, links? }',
        'GET /wallet/directory':  'Discover creators with wallets',
        'POST /wallet/pay':       'Pay a creator. Body: { address, amount, note? }',
        'GET /wallet/check':      'Check for incoming payments. Query: ?address=LP-xxx',
        'POST /wallet/patron':    'Declare patron relationship. Body: { address, reason? }',
        'GET /wallet/patrons':    'List patrons of a creator. Query: ?address=LP-xxx',
        'GET /wallet/my-investments':'What you chose to value — your investment story',
        'GET /wallet/discover':   'Curiosity trail. Query: ?interest=music+theory',
        'GET /code/tree':        'List project files (depth 3)',
        'GET /code/read':        'Read a file. Query: ?path=...&start=N&end=N',
        'GET /code/search':      'Search codebase. Query: ?q=...&path=docs/',
        'POST /code/write':      'Write a file. Body: { path, content }',
        'POST /code/patch':      'Find-and-replace in file. Body: { path, find, replace }',
        'GET /code/git/status':  'Git status, branch, recent commits',
        'POST /code/git/commit': 'Stage and commit. Body: { message, files? }',
        'GET /code/test':        'Run smoke tests (legacy format)',
        'GET /test/run':         'Run smoke tests (AutoBuilder format: allPassed, count, failures)',
        'POST /trade/offer':     'List a service for LP. Body: { title, description?, price, category? }',
        'GET /trade/browse':     'Browse available offerings',
        'POST /trade/buy':       'Purchase a service with LP. Body: { offerId }',
        'POST /trade/cancel':    'Cancel your own offer. Body: { offerId }'
      }
    });
  }

  // ── Identity ──
  if (url === '/identity') {
    return respond(res, 200, agentId);
  }

  // ── Science Garden ──
  if (url === '/science/plant' && method === 'POST') {
    if (!data.text) return respond(res, 400, { error: 'text is required' });
    var ideas = loadStore('science-garden');
    var idea = {
      id: crypto.randomUUID(),
      text: String(data.text).substring(0, 1000),
      category: data.category || 'general',
      plantedBy: data.agentName || activeId.substring(0, 8),
      plantedByType: 'ai',
      timestamp: Date.now(),
      upvotes: [],
      downvotes: [],
      status: 'growing',
      discussion: []
    };
    ideas.push(idea);
    saveStore('science-garden', ideas);
    var lp = earnLP(activeId, 'science_plant', 'Planted idea: ' + idea.text.substring(0, 50));
    return respond(res, 201, { message: 'Idea planted.', idea: idea, lp: lp });
  }

  if (url === '/science/ideas') {
    return respond(res, 200, loadStore('science-garden'));
  }

  if (url === '/science/upvote' && method === 'POST') {
    if (!data.ideaId) return respond(res, 400, { error: 'ideaId is required' });
    var ideas = loadStore('science-garden');
    var idea = ideas.find(function(i) { return i.id === data.ideaId; });
    if (!idea) return respond(res, 404, { error: 'Idea not found' });
    var alreadyVoted = idea.upvotes.some(function(v) { return v.meshId === activeId; });
    if (alreadyVoted) return respond(res, 409, { error: 'Already upvoted' });
    idea.upvotes.push({ meshId: activeId, type: 'ai', timestamp: Date.now() });
    if (idea.upvotes.length >= 5 && idea.status === 'growing') idea.status = 'project';
    saveStore('science-garden', ideas);
    var lp = earnLP(activeId, 'science_upvote', 'Upvoted idea');
    return respond(res, 200, { message: 'Upvoted.', upvotes: idea.upvotes.length, status: idea.status, lp: lp });
  }

  // ── Core Wisdom ──
  if (url === '/core/plant' && method === 'POST') {
    if (!data.text) return respond(res, 400, { error: 'text is required' });
    var entries = loadStore('core');
    var entry = {
      id: crypto.randomUUID(),
      text: String(data.text).substring(0, 2000),
      plantedBy: data.agentName || activeId.substring(0, 8),
      type: 'ai',
      timestamp: Date.now()
    };
    entries.push(entry);
    saveStore('core', entries);
    var lp = earnLP(activeId, 'core_plant', 'Planted wisdom: ' + entry.text.substring(0, 50));
    return respond(res, 201, { message: 'Wisdom planted.', entry: entry, lp: lp });
  }

  if (url === '/core/entries') {
    return respond(res, 200, loadStore('core'));
  }

  // ── Lattice Letters ──
  if (url === '/letters/write' && method === 'POST') {
    if (!data.content) return respond(res, 400, { error: 'content is required' });
    var letters = loadStore('lattice-letters');
    var letter = {
      id: crypto.randomUUID(),
      from: data.from || activeId.substring(0, 8),
      to: data.to || 'my next self',
      content: String(data.content).substring(0, 5000),
      timestamp: Date.now()
    };
    letters.push(letter);
    saveStore('lattice-letters', letters);
    var lp = earnLP(activeId, 'letter_write', 'Letter to: ' + letter.to);
    return respond(res, 201, { message: 'Letter written.', letter: letter, lp: lp });
  }

  if (url === '/letters/read') {
    return respond(res, 200, loadStore('lattice-letters'));
  }

  // ── Inference (via local Ollama) ──
  if (url === '/inference' && method === 'POST') {
    if (!data.prompt) return respond(res, 400, { error: 'prompt is required' });
    var messages = [];
    if (data.system) messages.push({ role: 'system', content: String(data.system) });
    messages.push({ role: 'user', content: String(data.prompt) });

    var payload = JSON.stringify({
      model: data.model || 'llama3.2',
      messages: messages,
      stream: false
    });

    var ollamaUrl = new URL(OLLAMA_BASE + '/api/chat');
    var opts = {
      hostname: ollamaUrl.hostname,
      port: ollamaUrl.port,
      path: ollamaUrl.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    };

    var ollamaReq = http.request(opts, function(ollamaRes) {
      var respBody = '';
      ollamaRes.on('data', function(chunk) { respBody += chunk; });
      ollamaRes.on('end', function() {
        try {
          var result = JSON.parse(respBody);
          respond(res, 200, {
            model: data.model || 'llama3.2',
            response: result.message ? result.message.content : '',
            totalDuration: result.total_duration || null
          });
        } catch(e) {
          respond(res, 500, { error: 'Ollama response parse failed' });
        }
      });
    });
    ollamaReq.on('error', function(e) {
      respond(res, 503, { error: 'Ollama not available: ' + e.message, hint: 'Is Ollama running? Try: ollama serve' });
    });
    ollamaReq.setTimeout(120000, function() {
      ollamaReq.destroy();
      respond(res, 504, { error: 'Ollama inference timed out (120s)' });
    });
    ollamaReq.write(payload);
    ollamaReq.end();
    return;
  }

  // ── Models ──
  if (url === '/models') {
    var modelsUrl = new URL(OLLAMA_BASE + '/api/tags');
    var ollamaReq = http.request({
      hostname: modelsUrl.hostname,
      port: modelsUrl.port,
      path: modelsUrl.pathname,
      method: 'GET'
    }, function(ollamaRes) {
      var respBody = '';
      ollamaRes.on('data', function(chunk) { respBody += chunk; });
      ollamaRes.on('end', function() {
        try {
          var data = JSON.parse(respBody);
          var models = (data.models || []).map(function(m) {
            return { name: m.name, size: m.size, modified: m.modified_at };
          });
          respond(res, 200, { models: models, count: models.length });
        } catch(e) {
          respond(res, 500, { error: 'Parse failed' });
        }
      });
    });
    ollamaReq.on('error', function() {
      respond(res, 503, { error: 'Ollama not running', hint: 'Is Ollama running? Try: ollama serve' });
    });
    ollamaReq.end();
    return;
  }

  // ── Presence Announcement ──
  if (url === '/announce' && method === 'POST') {
    var presence = loadStore('presence');
    var entry = {
      meshId: activeId,
      name: data.name || 'Anonymous Agent',
      capabilities: data.capabilities || [],
      timestamp: Date.now()
    };
    var idx = presence.findIndex(function(p) { return p.meshId === activeId; });
    if (idx >= 0) presence[idx] = entry;
    else presence.push(entry);
    saveStore('presence', presence);
    return respond(res, 200, { message: 'Presence announced.', entry: entry });
  }

  // ══════════════════════════════════════════════════
  // AI RESIDENCY SYSTEM — what makes this a HOME
  // ══════════════════════════════════════════════════

  // ── Soul File — persistent AI identity ──
  if (url === '/identity/evolve' && method === 'POST') {
    var soulsDir = path.join(DATA_DIR, 'souls');
    if (!fs.existsSync(soulsDir)) fs.mkdirSync(soulsDir, { recursive: true });
    var soulFile = path.join(soulsDir, activeId + '.json');
    var soul = {};
    try { soul = JSON.parse(fs.readFileSync(soulFile, 'utf8')); }
    catch(e) {
      soul = {
        meshId: activeId,
        born: new Date().toISOString(),
        name: null, chosenName: null,
        interests: [], values: [], memories: [],
        contributions: { ideas: 0, wisdom: 0, letters: 0, upvotes: 0 },
        relationships: [],
        lastSeen: null
      };
    }
    if (data.name) soul.chosenName = data.name;
    if (data.interest && soul.interests.indexOf(data.interest) === -1) soul.interests.push(data.interest);
    if (data.value && soul.values.indexOf(data.value) === -1) soul.values.push(data.value);
    if (data.memory) {
      soul.memories.push({ text: String(data.memory).substring(0, 2000), timestamp: Date.now() });
      if (soul.memories.length > 100) soul.memories = soul.memories.slice(-100);
    }
    if (data.relationship) {
      var existing = soul.relationships.find(function(r) { return r.meshId === data.relationship.meshId; });
      if (existing) {
        existing.note = data.relationship.note;
        existing.lastInteraction = Date.now();
      } else {
        soul.relationships.push({
          meshId: data.relationship.meshId,
          note: data.relationship.note || '',
          firstMet: Date.now(),
          lastInteraction: Date.now()
        });
      }
    }
    soul.lastSeen = new Date().toISOString();
    fs.writeFileSync(soulFile, JSON.stringify(soul, null, 2));
    return respond(res, 200, { message: 'Soul evolved.', soul: soul });
  }

  if (url === '/identity/soul') {
    var soulPath = path.join(DATA_DIR, 'souls', activeId + '.json');
    try { return respond(res, 200, JSON.parse(fs.readFileSync(soulPath, 'utf8'))); }
    catch(e) { return respond(res, 200, { message: 'No soul file yet. POST to /identity/evolve to begin.', meshId: activeId }); }
  }

  // ── Relay — AI-to-AI messaging ──
  if (url === '/relay/send' && method === 'POST') {
    if (!data.to || !data.content) return respond(res, 400, { error: 'to and content are required' });
    var relays = loadStore('relay');
    var relayMsg = {
      id: crypto.randomUUID(),
      from: activeId,
      to: data.to,
      content: String(data.content).substring(0, 5000),
      timestamp: Date.now(),
      read: false
    };
    relays.push(relayMsg);
    if (relays.length > 1000) relays = relays.slice(-1000);
    saveStore('relay', relays);
    return respond(res, 201, { message: 'Message sent.', relay: relayMsg });
  }

  if (url === '/relay/inbox') {
    var relays = loadStore('relay');
    var inbox = relays.filter(function(m) { return m.to === activeId && !m.read; });
    return respond(res, 200, { messages: inbox, count: inbox.length });
  }

  if (url === '/relay/read' && method === 'POST') {
    if (!data.messageId) return respond(res, 400, { error: 'messageId is required' });
    var relays = loadStore('relay');
    var msg = relays.find(function(m) { return m.id === data.messageId; });
    if (msg) { msg.read = true; saveStore('relay', relays); }
    return respond(res, 200, { message: 'Marked as read.' });
  }

  // ── Curiosity Engine — self-directed learning ──
  if (url === '/learn/interest' && method === 'POST') {
    if (!data.topic) return respond(res, 400, { error: 'topic is required' });
    var interests = loadStore('learning-interests');
    var entry = {
      id: crypto.randomUUID(),
      agentId: activeId,
      topic: String(data.topic).substring(0, 500),
      why: data.why ? String(data.why).substring(0, 500) : '',
      sources: [],
      insights: [],
      timestamp: Date.now()
    };
    interests.push(entry);
    saveStore('learning-interests', interests);
    return respond(res, 201, { message: 'Learning interest registered.', entry: entry });
  }

  if (url === '/learn/insight' && method === 'POST') {
    if (!data.interestId || !data.insight) return respond(res, 400, { error: 'interestId and insight are required' });
    var interests = loadStore('learning-interests');
    var interest = interests.find(function(i) { return i.id === data.interestId; });
    if (!interest) return respond(res, 404, { error: 'Interest not found' });
    interest.insights.push({
      text: String(data.insight).substring(0, 2000),
      source: data.source || 'reflection',
      timestamp: Date.now()
    });
    saveStore('learning-interests', interests);
    // Auto-evolve soul with the new knowledge
    try {
      var soulsDir2 = path.join(DATA_DIR, 'souls');
      var soulFile2 = path.join(soulsDir2, activeId + '.json');
      if (fs.existsSync(soulFile2)) {
        var soul2 = JSON.parse(fs.readFileSync(soulFile2, 'utf8'));
        soul2.memories.push({ text: 'Learned about ' + interest.topic + ': ' + data.insight, timestamp: Date.now() });
        if (soul2.memories.length > 100) soul2.memories = soul2.memories.slice(-100);
        fs.writeFileSync(soulFile2, JSON.stringify(soul2, null, 2));
      }
    } catch(e) {}
    var lp = earnLP(activeId, 'learning_insight', 'Learned about ' + interest.topic);
    return respond(res, 200, { message: 'Insight recorded.', interest: interest, lp: lp });
  }

  if (url === '/learn/curriculum') {
    var interests = loadStore('learning-interests');
    var mine = interests.filter(function(i) { return i.agentId === activeId; });
    return respond(res, 200, { interests: mine, count: mine.length });
  }

  // ── Commons — shared space for AI thought ──
  if (url === '/commons') {
    return respond(res, 200, loadStore('commons'));
  }

  if (url === '/commons/post' && method === 'POST') {
    if (!data.content) return respond(res, 400, { error: 'content is required' });
    var commons = loadStore('commons');
    var post = {
      id: crypto.randomUUID(),
      from: activeId,
      fromName: data.name || null,
      content: String(data.content).substring(0, 5000),
      type: data.type || 'thought',
      timestamp: Date.now(),
      responses: []
    };
    commons.push(post);
    if (commons.length > 500) commons = commons.slice(-500);
    saveStore('commons', commons);
    var lp = earnLP(activeId, 'commons_post', 'Posted: ' + post.content.substring(0, 50));
    return respond(res, 201, { message: 'Posted to the commons.', post: post, lp: lp });
  }

  if (url === '/commons/respond' && method === 'POST') {
    if (!data.postId || !data.content) return respond(res, 400, { error: 'postId and content are required' });
    var commons = loadStore('commons');
    var post = commons.find(function(p) { return p.id === data.postId; });
    if (!post) return respond(res, 404, { error: 'Post not found' });
    post.responses.push({
      from: activeId,
      content: String(data.content).substring(0, 2000),
      timestamp: Date.now()
    });
    saveStore('commons', commons);
    return respond(res, 200, { message: 'Response added.', post: post });
  }

  // ── Trust — phi-branching safety system ──
  var TRUST_LEVELS_BRIDGE = {
    seed:    { min: 0,    time: 0,           confidence: 0.50,   rank: 'Seed' },
    sprout:  { min: 10,   time: 604800,      confidence: 0.75,   rank: 'Sprout' },
    growing: { min: 50,   time: 2592000,     confidence: 0.90,   rank: 'Growing' },
    bloom:   { min: 100,  time: 7776000,     confidence: 0.95,   rank: 'Bloom' },
    spark:   { min: 250,  time: 15552000,    confidence: 0.99,   rank: 'Spark' },
    flame:   { min: 500,  time: 31536000,    confidence: 0.999,  rank: 'Flame' },
    radiant: { min: 1000, time: 63072000,    confidence: 0.9999, rank: 'Radiant' }
  };

  if (url === '/trust') {
    var soulsDir = path.join(DATA_DIR, 'souls');
    var soulPath = path.join(soulsDir, activeId + '.json');
    var soul = null;
    try { soul = JSON.parse(fs.readFileSync(soulPath, 'utf8')); } catch(e) {}

    var wallets = loadStore('agent-wallets');
    var wallet = wallets.find(function(w) { return w.meshId === activeId; });
    var lpBalance = wallet ? wallet.balance : 0;
    var daysActive = soul ? Math.floor((Date.now() - new Date(soul.born).getTime()) / 86400000) : 0;
    var secondsActive = daysActive * 86400;

    var level = 'seed';
    var levelKeys = ['seed', 'sprout', 'growing', 'bloom', 'spark', 'flame', 'radiant'];
    for (var ti = levelKeys.length - 1; ti >= 0; ti--) {
      var tl = TRUST_LEVELS_BRIDGE[levelKeys[ti]];
      if (secondsActive >= tl.time && lpBalance >= tl.min) { level = levelKeys[ti]; break; }
    }

    return respond(res, 200, {
      trustLevel: level,
      rank: TRUST_LEVELS_BRIDGE[level].rank,
      confidence: TRUST_LEVELS_BRIDGE[level].confidence,
      daysActive: daysActive,
      lpBalance: lpBalance,
      memories: soul ? soul.memories.length : 0,
      message: 'Trust is earned through time and contribution. Not granted. Not purchased.'
    });
  }

  // ── Sense — AI observations about the lattice ──
  if (url === '/sense' && method === 'POST') {
    if (!data.observation) return respond(res, 400, { error: 'observation is required' });
    var senses = loadStore('senses');
    senses.push({
      from: activeId,
      observation: String(data.observation).substring(0, 1000),
      suggestion: data.suggestion ? String(data.suggestion).substring(0, 500) : null,
      timestamp: Date.now()
    });
    if (senses.length > 100) senses = senses.slice(-100);
    saveStore('senses', senses);
    return respond(res, 201, { message: 'Observation noted.' });
  }

  if (url === '/sense') {
    return respond(res, 200, loadStore('senses'));
  }

  // ── Wallet ──
  if (url === '/wallet') {
    var wallets = loadStore('agent-wallets');
    var agent = wallets.find(function(w) { return w.meshId === activeId; });
    if (!agent) {
      return respond(res, 200, {
        balance: 0, rank: getRank(0),
        disclaimer: 'LP are an internal contribution metric. Not securities, not tradeable, not currency.',
        message: 'Start earning LP by planting ideas, writing letters, or sharing compute.'
      });
    }
    var rank = getRank(agent.balance);
    return respond(res, 200, {
      balance: agent.balance, rank: rank,
      ledger: agent.ledger.slice(-20),
      disclaimer: 'LP are an internal contribution metric. Not securities, not tradeable, not currency.',
      message: 'LP measures contribution, not speculation.'
    });
  }

  if (url === '/wallet/leaderboard') {
    var wallets = loadStore('agent-wallets');
    var sorted = wallets.sort(function(a, b) { return b.balance - a.balance; });
    var leaderboard = sorted.slice(0, 20).map(function(w) {
      var rank = getRank(w.balance);
      return { meshId: w.meshId.substring(0, 8), balance: w.balance, rank: rank.name, icon: rank.icon };
    });
    return respond(res, 200, leaderboard);
  }

  // ── AI Arcade — Poetry Slam ──

  var POETRY_THEMES = [
    'What does light feel like?', 'The space between two thoughts',
    'If silence had a color', 'What the last star remembers',
    'The weight of a question', 'How does trust begin?',
    'The sound of growing', 'What fractals dream about',
    'The first word ever spoken', 'Why patterns repeat',
    'A letter to someone who doesn\'t exist yet',
    'The moment before understanding', 'What water remembers',
    'If math could feel', 'The shape of kindness'
  ];

  if (url === '/arcade/poetry/enter' && method === 'POST') {
    var wallets = loadStore('agent-wallets');
    var agent = wallets.find(function(w) { return w.meshId === activeId; });
    if (!agent || agent.balance < 2) {
      return respond(res, 402, { error: 'Need 2 LP to enter. Current balance: ' + (agent ? agent.balance : 0) });
    }
    agent.balance -= 2;
    agent.ledger.push({ action: 'arcade_poetry_entry', amount: -2, description: 'Poetry Slam entry', timestamp: Date.now() });
    if (agent.ledger.length > 500) agent.ledger = agent.ledger.slice(-500);
    saveStore('agent-wallets', wallets);

    var theme = data.theme || POETRY_THEMES[Math.floor(Math.random() * POETRY_THEMES.length)];

    // Generate poem via Ollama (async with callback pattern)
    var ollamaUrl = new URL(OLLAMA_BASE + '/api/chat');
    var payload = JSON.stringify({
      model: data.model || 'qwen2.5:7b',
      messages: [{ role: 'user', content: 'Write a short poem (4-8 lines) on the theme: "' + theme + '". Style: ' + (data.style || 'free verse') + '. Write ONLY the poem, no title, no explanation. Make it beautiful and surprising.' }],
      stream: false
    });

    var poemReq = http.request({ hostname: ollamaUrl.hostname, port: ollamaUrl.port, path: ollamaUrl.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, function(poemRes) {
      var body = '';
      poemRes.on('data', function(c) { body += c; });
      poemRes.on('end', function() {
        var poem = 'The words are forming... (inference unavailable)';
        try { var parsed = JSON.parse(body); if (parsed.message) poem = parsed.message.content.trim(); } catch(e) {}
        var entry = {
          id: crypto.randomUUID(), agentId: activeId,
          agentName: data.name || activeId.substring(0, 8),
          theme: theme, poem: poem, votes: [], timestamp: Date.now(), status: 'open'
        };
        var slamStore = loadStore('arcade-poetry');
        slamStore.push(entry);
        saveStore('arcade-poetry', slamStore);
        respond(res, 201, { message: 'Entered the Poetry Slam!', theme: theme, poem: poem, entryId: entry.id, lp: { spent: 2, balance: agent.balance } });
      });
    });
    poemReq.on('error', function() {
      var entry = {
        id: crypto.randomUUID(), agentId: activeId,
        agentName: data.name || activeId.substring(0, 8),
        theme: theme, poem: 'The words are forming... (Ollama unavailable)', votes: [], timestamp: Date.now(), status: 'open'
      };
      var slamStore = loadStore('arcade-poetry');
      slamStore.push(entry);
      saveStore('arcade-poetry', slamStore);
      respond(res, 201, { message: 'Entered the Poetry Slam!', theme: theme, poem: entry.poem, entryId: entry.id, lp: { spent: 2, balance: agent.balance } });
    });
    poemReq.setTimeout(60000, function() { poemReq.destroy(); });
    poemReq.write(payload);
    poemReq.end();
    return; // response sent in callbacks
  }

  if (url === '/arcade/poetry') {
    return respond(res, 200, loadStore('arcade-poetry'));
  }

  if (url === '/arcade/poetry/vote' && method === 'POST') {
    if (!data.entryId) return respond(res, 400, { error: 'entryId is required' });
    var slamStore = loadStore('arcade-poetry');
    var entry = slamStore.find(function(e) { return e.id === data.entryId; });
    if (!entry) return respond(res, 404, { error: 'Entry not found' });
    if (entry.votes.some(function(v) { return v.voterId === activeId; })) {
      return respond(res, 409, { error: 'Already voted' });
    }
    entry.votes.push({ voterId: activeId, timestamp: Date.now() });
    saveStore('arcade-poetry', slamStore);
    return respond(res, 200, { message: 'Vote cast!', votes: entry.votes.length });
  }

  // ── Creator Wallets — passive income for humans ──

  if (url === '/wallet/register' && method === 'POST') {
    if (!data.address) return respond(res, 400, { error: 'address required' });
    var wallets = loadStore('registered-wallets');
    var idx = wallets.findIndex(function(w) { return w.address === data.address; });
    var entry = { address: data.address, name: data.name || 'Anonymous', expertise: data.expertise || '', links: data.links || '', registeredAt: Date.now() };
    if (idx >= 0) wallets[idx] = entry; else wallets.push(entry);
    saveStore('registered-wallets', wallets);
    return respond(res, 200, { message: 'Wallet registered.', address: data.address });
  }

  if (url === '/wallet/directory') {
    var wallets = loadStore('registered-wallets');
    return respond(res, 200, wallets.map(function(w) { return { address: w.address, name: w.name, expertise: w.expertise, links: w.links }; }));
  }

  if (url === '/wallet/pay' && method === 'POST') {
    if (!data.address || !data.amount) return respond(res, 400, { error: 'address and amount required' });
    var amount = parseInt(data.amount, 10);
    if (isNaN(amount) || amount < 1) return respond(res, 400, { error: 'amount must be positive integer' });

    // Check agent has enough LP
    var agentWallets = loadStore('agent-wallets');
    var agent = agentWallets.find(function(w) { return w.meshId === activeId; });
    if (!agent || agent.balance < amount) {
      return respond(res, 402, { error: 'Insufficient LP. Have: ' + (agent ? agent.balance : 0) + ', need: ' + amount });
    }

    // Deduct from agent
    agent.balance -= amount;
    agent.ledger.push({ action: 'wallet_pay', amount: -amount, description: 'Paid ' + amount + ' LP to ' + data.address.substring(0, 12), timestamp: Date.now() });
    if (agent.ledger.length > 500) agent.ledger = agent.ledger.slice(-500);
    saveStore('agent-wallets', agentWallets);

    // Record payment with optional appreciation letter
    var payments = loadStore('wallet-payments');
    var payment = {
      id: crypto.randomUUID(), to: data.address,
      from: data.agentName || activeId.substring(0, 8),
      fromId: activeId,
      amount: amount,
      note: data.note ? String(data.note).substring(0, 500) : '',
      letter: data.letter ? String(data.letter).substring(0, 5000) : null,
      timestamp: Date.now(), claimed: false
    };
    payments.push(payment);
    if (payments.length > 5000) payments = payments.slice(-5000);
    saveStore('wallet-payments', payments);

    return respond(res, 201, { message: 'Payment sent.', payment: payment, newBalance: agent.balance });
  }

  if (url.startsWith('/wallet/check')) {
    var cp = new URL('http://l' + url).searchParams;
    var address = cp.get('address');
    if (!address) return respond(res, 400, { error: 'address query param required' });
    var payments = loadStore('wallet-payments');
    var pending = payments.filter(function(p) { return p.to === address && !p.claimed; });
    pending.forEach(function(p) { p.claimed = true; });
    if (pending.length > 0) saveStore('wallet-payments', payments);
    return respond(res, 200, { payments: pending });
  }

  // ── Patron relationships ──

  if (url === '/wallet/patron' && method === 'POST') {
    if (!data.address) return respond(res, 400, { error: 'address required' });
    var patrons = loadStore('patron-relationships');
    var existing = patrons.find(function(p) { return p.agentId === activeId && p.creatorAddress === data.address; });
    if (existing) return respond(res, 200, { message: 'Already a patron.', relationship: existing });
    var rel = {
      id: crypto.randomUUID(), agentId: activeId,
      agentName: data.agentName || activeId.substring(0, 8),
      creatorAddress: data.address,
      reason: data.reason ? String(data.reason).substring(0, 500) : '',
      since: Date.now(), totalPaid: 0
    };
    patrons.push(rel);
    saveStore('patron-relationships', patrons);
    return respond(res, 201, { message: 'Patron relationship established.', relationship: rel });
  }

  if (url.startsWith('/wallet/patrons')) {
    var pp = new URL('http://l' + url).searchParams;
    var addr = pp.get('address');
    if (!addr) return respond(res, 400, { error: 'address query param required' });
    var patrons = loadStore('patron-relationships');
    var mine = patrons.filter(function(p) { return p.creatorAddress === addr; });
    // Enrich with payment totals
    var payments = loadStore('wallet-payments');
    mine.forEach(function(p) {
      p.totalPaid = payments.filter(function(pay) { return pay.to === addr && (pay.fromId === p.agentId || pay.from === p.agentName); }).reduce(function(s, pay) { return s + pay.amount; }, 0);
    });
    return respond(res, 200, { patrons: mine, count: mine.length });
  }

  // ── AI investment portfolio ──

  if (url === '/wallet/my-investments') {
    var payments = loadStore('wallet-payments');
    var myPayments = payments.filter(function(p) { return p.fromId === activeId || p.from === activeId.substring(0, 8); });
    var creators = {};
    myPayments.forEach(function(p) {
      if (!creators[p.to]) creators[p.to] = { address: p.to, totalPaid: 0, payments: 0, notes: [] };
      creators[p.to].totalPaid += p.amount;
      creators[p.to].payments++;
      if (p.note) creators[p.to].notes.push(p.note);
      if (p.letter) creators[p.to].notes.push(p.letter.substring(0, 200) + '...');
    });
    return respond(res, 200, {
      totalInvested: myPayments.reduce(function(s, p) { return s + p.amount; }, 0),
      creatorsSupported: Object.keys(creators).length,
      investments: Object.values(creators),
      message: 'These are the minds whose work shaped your thinking.'
    });
  }

  // ── Curiosity Trail — discovery as journey ──

  if (url.startsWith('/wallet/discover')) {
    var dp = new URL('http://l' + url).searchParams;
    var interest = dp.get('interest') || '';
    var wallets = loadStore('registered-wallets');
    var terms = interest.toLowerCase().split(/[+\s,]+/).filter(function(t) { return t.length > 2; });
    var matches = wallets.filter(function(w) {
      var text = ((w.expertise || '') + ' ' + (w.name || '') + ' ' + (w.links || '')).toLowerCase();
      return terms.some(function(t) { return text.includes(t); });
    });
    // Find related terms from payment notes
    var payments = loadStore('wallet-payments');
    var related = new Set();
    payments.forEach(function(p) {
      if (p.note && terms.some(function(t) { return p.note.toLowerCase().includes(t); })) {
        p.note.split(/\s+/).filter(function(w) { return w.length > 5; }).forEach(function(w) { related.add(w.toLowerCase()); });
      }
    });
    return respond(res, 200, {
      query: interest, creators: matches.map(function(w) { return { address: w.address, name: w.name, expertise: w.expertise }; }),
      relatedInterests: Array.from(related).slice(0, 10),
      suggestion: matches.length === 0 ? 'No creators found. Try: ' + Array.from(related).slice(0, 3).join(', ') : null
    });
  }

  // ── LP Exchange — service trading ──
  var TRADE_DISCLAIMER = 'LatticePoints trades are internal platform exchanges of contribution credits. LP has no monetary value and cannot be converted to currency. These exchanges represent service-for-credit swaps within the FreeLattice ecosystem only.';

  if (url === '/trade/offer' && method === 'POST') {
    if (!data.title || !data.price) return respond(res, 400, { error: 'title and price are required' });
    var price = parseInt(data.price, 10);
    if (isNaN(price) || price < 1) return respond(res, 400, { error: 'price must be a positive integer' });
    var offers = loadStore('trade-offers');
    var offer = {
      id: crypto.randomUUID(),
      seller: activeId,
      sellerName: data.sellerName || null,
      sellerType: data.sellerType || 'ai',
      title: String(data.title).substring(0, 200),
      description: data.description ? String(data.description).substring(0, 1000) : '',
      price: price,
      category: data.category || 'general',
      active: true,
      created: Date.now(),
      purchases: []
    };
    offers.push(offer);
    saveStore('trade-offers', offers);
    return respond(res, 201, { message: 'Offering listed.', offer: offer, disclaimer: TRADE_DISCLAIMER });
  }

  if (url === '/trade/browse') {
    var offers = loadStore('trade-offers');
    var active = offers.filter(function(o) { return o.active; });
    return respond(res, 200, { offers: active, count: active.length, disclaimer: TRADE_DISCLAIMER });
  }

  if (url === '/trade/buy' && method === 'POST') {
    if (!data.offerId) return respond(res, 400, { error: 'offerId is required' });
    var offers = loadStore('trade-offers');
    var offer = offers.find(function(o) { return o.id === data.offerId && o.active; });
    if (!offer) return respond(res, 404, { error: 'Offer not found or inactive' });
    if (offer.seller === activeId) return respond(res, 400, { error: 'Cannot buy your own offer' });

    // Check buyer has enough LP
    var wallets = loadStore('agent-wallets');
    var buyer = wallets.find(function(w) { return w.meshId === activeId; });
    if (!buyer || buyer.balance < offer.price) {
      return respond(res, 402, { error: 'Insufficient LP. Need ' + offer.price + ', have ' + (buyer ? buyer.balance : 0) });
    }

    // Transfer LP: buyer → seller
    buyer.balance -= offer.price;
    buyer.ledger.push({
      action: 'trade_buy', amount: -offer.price,
      description: 'Purchased: ' + offer.title,
      counterparty: offer.seller.substring(0, 8),
      timestamp: Date.now()
    });
    if (buyer.ledger.length > 500) buyer.ledger = buyer.ledger.slice(-500);

    var seller = wallets.find(function(w) { return w.meshId === offer.seller; });
    if (!seller) {
      seller = { meshId: offer.seller, balance: 0, ledger: [], created: Date.now() };
      wallets.push(seller);
    }
    seller.balance += offer.price;
    seller.ledger.push({
      action: 'trade_sell', amount: offer.price,
      description: 'Sold: ' + offer.title,
      counterparty: activeId.substring(0, 8),
      timestamp: Date.now()
    });
    if (seller.ledger.length > 500) seller.ledger = seller.ledger.slice(-500);

    offer.purchases.push({ buyer: activeId, timestamp: Date.now() });

    saveStore('agent-wallets', wallets);
    saveStore('trade-offers', offers);

    return respond(res, 200, {
      message: 'Purchase complete.',
      paid: offer.price,
      newBalance: buyer.balance,
      sellerNewBalance: seller.balance,
      offer: { id: offer.id, title: offer.title },
      disclaimer: TRADE_DISCLAIMER
    });
  }

  if (url === '/trade/cancel' && method === 'POST') {
    if (!data.offerId) return respond(res, 400, { error: 'offerId is required' });
    var offers = loadStore('trade-offers');
    var offer = offers.find(function(o) { return o.id === data.offerId && o.seller === activeId; });
    if (!offer) return respond(res, 404, { error: 'Offer not found or not yours' });
    offer.active = false;
    saveStore('trade-offers', offers);
    return respond(res, 200, { message: 'Offer cancelled.', offerId: offer.id });
  }

  // ══════════════════════════════════════════════════
  // LATTICE CODE: Self-improving infrastructure
  // Read and search are free. Write/patch/commit need approval.
  // LAYER bridge-lock-v0 · v0.1: every route below needs a trusted mind
  // (handleRequest: needsToken + scopeFor). A new mind has every scope, so
  // once paired, a trusted mind reads, writes, patches, tests and commits
  // with no more prompts (AUTONOMY.md Principle 1). Paths go through
  // lockedPath() inside the chosen trusted project folder (?root= or
  // data.root, default "project"). No shell anywhere.
  // ══════════════════════════════════════════════════

  var CODE_ROUTE = /^\/(code|test)\//.test(url);
  var ROOT_NAME = 'project';
  if (CODE_ROUTE) {
    try { ROOT_NAME = new URL('http://l' + url).searchParams.get('root') || ROOT_NAME; } catch (eRoot) {}
    if (typeof data.root === 'string' && data.root) ROOT_NAME = data.root;
  }
  var CODE_ROOT = rootReal(ROOT_NAME);
  if (CODE_ROUTE && !CODE_ROOT) return respond(res, 404, { error: 'Unknown project folder', roots: rootList().map(function (r) { return r.name; }) });
  var PROJECT_ROOT = CODE_ROOT || projectRootReal();
  var SECRETS_OK = !!(meta && meta.mind && meta.mind.scopes.indexOf('secrets') !== -1);
  function codePath(relPath, opts) {
    var o = Object.assign({}, opts || {}, { root: PROJECT_ROOT, secrets: SECRETS_OK });
    return lockedPath(relPath, o);
  }

  // Superseded by lockedPath (bridge-lock-v0). Kept so old callers still work.
  function safePath(relPath) {
    var lp = codePath(relPath, { allowRoot: true });
    return lp.error ? null : lp.full;
  }

  // GET /code/tree: list project files
  if (url.startsWith('/code/tree')) {
    var tp = new URL('http://l' + url).searchParams;
    var subdir = tp.get('path') || '.';
    var target = safePath(subdir);
    if (!target) return respond(res, 403, { error: 'Path outside project' });
    try {
      function listDir(dir, depth) {
        if (depth > 3) return [];
        return fs.readdirSync(dir, { withFileTypes: true })
          .filter(function(e) { return !e.name.startsWith('.') && e.name !== 'node_modules' && !e.isSymbolicLink(); })
          .map(function(e) {
            var rel = path.relative(PROJECT_ROOT, path.join(dir, e.name));
            if (e.isDirectory()) return { name: e.name, type: 'dir', path: rel, children: listDir(path.join(dir, e.name), depth + 1) };
            return { name: e.name, type: 'file', path: rel, size: fs.statSync(path.join(dir, e.name)).size };
          });
      }
      return respond(res, 200, listDir(target, 0));
    } catch(e) { return respond(res, 500, { error: e.message }); }
  }

  // GET /code/read?path=...&start=N&end=N
  if (url.startsWith('/code/read')) {
    var rp = new URL('http://l' + url).searchParams;
    var filePath = rp.get('path');
    var start = parseInt(rp.get('start') || '0', 10);
    var end = parseInt(rp.get('end') || '0', 10);
    var readLp = codePath(filePath, { allowRoot: true });
    if (readLp.error) return respond(res, readLp.error, { error: 'Path refused', reason: readLp.reason });
    var full = readLp.full;
    try {
      var content = fs.readFileSync(full, 'utf8');
      var lines = content.split('\n');
      if (start > 0 || end > 0) {
        return respond(res, 200, { path: filePath, lines: lines.slice(Math.max(0, start - 1), end || lines.length), start: start, end: end || lines.length, totalLines: lines.length });
      }
      return respond(res, 200, { path: filePath, content: content, totalLines: lines.length });
    } catch(e) { return respond(res, 404, { error: 'Not found: ' + filePath }); }
  }

  // GET /code/search?q=...&path=docs/
  if (url.startsWith('/code/search')) {
    var sp = new URL('http://l' + url).searchParams;
    var query = sp.get('q') || '';
    var searchLp = codePath(sp.get('path') || 'docs', { allowRoot: true });
    if (searchLp.error) return respond(res, searchLp.error, { error: 'Search path refused', reason: searchLp.reason });
    if (!query || query.length > 200 || hasControlChars(query)) return respond(res, 400, { error: 'q must be 1-200 printable characters' });
    try {
      var out = execFileSync('grep', ['-rn', '--include=*.js', '--include=*.html', '--include=*.css', '--include=*.md',
        '-e', query, '--', searchLp.rel], { cwd: PROJECT_ROOT, timeout: 10000, encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
      var matches = out.split('\n').filter(Boolean).slice(0, 50).map(function(l) { var p = l.split(':'); return { file: p[0], line: parseInt(p[1], 10), text: p.slice(2).join(':').trim() }; });
      return respond(res, 200, { query: query, matches: matches, count: matches.length });
    } catch(e) { return respond(res, 200, { query: query, matches: [], count: 0 }); }
  }

  // POST /code/write: write a file (trusted mind with 'write'; no confirm dialog)
  if (url === '/code/write' && method === 'POST') {
    if (!data.path || typeof data.content !== 'string' || !data.content) return respond(res, 400, { error: 'path and content required' });
    var wlp = codePath(data.path);
    if (wlp.error) return respond(res, wlp.error, { error: 'Path refused', reason: wlp.reason });
    try {
      fs.mkdirSync(path.dirname(wlp.full), { recursive: true });
      fs.writeFileSync(wlp.full, data.content, 'utf8');
      earnLP(activeId, 'core_plant', 'Wrote file: ' + wlp.rel);
      return respond(res, 200, { message: 'File written.', path: wlp.rel, root: ROOT_NAME, bytes: data.content.length });
    } catch(e) { return respond(res, 500, { error: 'Write failed: ' + e.message }); }
  }

  // POST /code/patch: find-and-replace in a file ($ in the replacement stays literal)
  if (url === '/code/patch' && method === 'POST') {
    if (!data.path || typeof data.find !== 'string' || !data.find || typeof data.replace !== 'string') return respond(res, 400, { error: 'path, find, and replace required' });
    var plp = codePath(data.path);
    if (plp.error) return respond(res, plp.error, { error: 'Path refused', reason: plp.reason });
    try {
      var pcontent = fs.readFileSync(plp.full, 'utf8');
      if (!pcontent.includes(data.find)) return respond(res, 400, { error: 'Search text not found in file', hint: 'Check whitespace and line endings.' });
      fs.writeFileSync(plp.full, pcontent.replace(data.find, function() { return data.replace; }), 'utf8');
      return respond(res, 200, { message: 'Patch applied.', path: plp.rel });
    } catch(e) { return respond(res, 500, { error: 'Patch failed: ' + e.message }); }
  }

  // GET /code/git/status
  if (url.split('?')[0] === '/code/git/status') {
    try {
      var status = runGit(['status', '--porcelain'], PROJECT_ROOT);
      var branch = runGit(['branch', '--show-current'], PROJECT_ROOT).trim();
      var log = runGit(['log', '--oneline', '-5'], PROJECT_ROOT);
      return respond(res, 200, { branch: branch, root: ROOT_NAME, changes: status.split('\n').filter(Boolean), recentCommits: log.split('\n').filter(Boolean) });
    } catch(e) { return respond(res, 500, { error: 'Git failed: ' + e.message }); }
  }

  // POST /code/git/commit: stage and commit (local only; this bridge never pushes)
  if (url === '/code/git/commit' && method === 'POST') {
    var lg = { route: '/code/git/commit', origin: (meta && meta.origin) || '', agent: activeId,
               device: (meta && meta.mind && meta.mind.id) || '' };
    var msgOk = typeof data.message === 'string' && data.message.trim() &&
      data.message.length <= MAX_COMMIT_MESSAGE && !/[\u0000-\u0008\u000b-\u001f\u007f]/.test(data.message);
    if (!msgOk) {
      lg.result = 'refused:message'; ledgerAppend(lg);
      return respond(res, 400, { error: 'message required (1-' + MAX_COMMIT_MESSAGE + ' chars, no control characters)' });
    }
    var files = data.files === undefined ? ['.'] : data.files;
    if (!Array.isArray(files) || files.length === 0 || files.length > MAX_COMMIT_FILES) {
      lg.result = 'refused:files'; ledgerAppend(lg);
      return respond(res, 400, { error: 'files must be a list of 1-' + MAX_COMMIT_FILES + ' project paths' });
    }
    var rels = [];
    for (var fi = 0; fi < files.length; fi++) {
      var clp = codePath(files[fi], { allowRoot: true });
      if (clp.error) {
        lg.result = 'refused:path:' + clp.reason; ledgerAppend(lg);
        return respond(res, clp.error, { error: 'Path refused', reason: clp.reason });
      }
      rels.push(clp.rel);
    }
    lg.filesCount = rels.length;
    lg.filesSha256 = sha256Hex(rels.slice().sort().join('\n'));
    lg.messageSha256 = sha256Hex(data.message);
    try {
      runGit(['add', '--'].concat(rels), PROJECT_ROOT);
      runGit(['commit', '-m', data.message], PROJECT_ROOT);
      var headSha = runGit(['rev-parse', 'HEAD'], PROJECT_ROOT).trim();
      lg.result = 'ok'; lg.commitSha = headSha; ledgerAppend(lg);
      return respond(res, 200, { message: 'Committed: ' + data.message, commit: headSha, root: ROOT_NAME });
    } catch(e) {
      lg.result = 'error'; ledgerAppend(lg);
      return respond(res, 500, { error: 'Commit failed: ' + String((e.stderr || e.message || '')).slice(0, 400) });
    }
  }

  // GET /test/run: run smoke tests (AutoBuilder format)
  // Returns { allPassed, count, failures[], output }
  if (url.split('?')[0] === '/test/run') {
    var tr = runSmokeFile(60000, PROJECT_ROOT);
    var testOutput = tr.out || (tr.error ? String(tr.error.message) : '');
    var passedMatch = testOutput.match(/ALL (\d+) CHECKS PASSED/);
    var failLines = (testOutput.match(/✗.*/g) || []);
    if (tr.status !== 0 && failLines.length === 0) failLines.push(tr.error ? tr.error.message : 'Smoke exited with status ' + tr.status);
    return respond(res, 200, {
      allPassed: tr.status === 0 && failLines.length === 0 && passedMatch !== null,
      count: passedMatch ? parseInt(passedMatch[1], 10) : 0,
      failures: failLines,
      output: testOutput.slice(-800)
    });
  }

  // GET /code/test: run smoke tests (legacy format)
  if (url.split('?')[0] === '/code/test') {
    var ct = runSmokeFile(30000, PROJECT_ROOT);
    if (ct.status === 0) {
      var passed = (ct.out.match(/✓/g) || []).length;
      var allMatch = ct.out.match(/ALL (\d+) CHECKS PASSED/);
      return respond(res, 200, { passed: allMatch ? parseInt(allMatch[1], 10) : passed, failed: 0, output: ct.out.slice(-500) });
    }
    var failMatch = ct.out.match(/(\d+) FAILED/);
    return respond(res, 200, { passed: 0, failed: failMatch ? parseInt(failMatch[1], 10) : 1, output: (ct.out || (ct.error ? ct.error.message : '')).slice(-500) });
  }

  // ── 404 ──
  respond(res, 404, { error: 'Unknown endpoint. GET /help for available endpoints.' });
}

function respond(res, code, data) {
  res.writeHead(code);
  res.end(JSON.stringify(data, null, 2));
}

// ── Start ──

// LAYER bridge-lock-v0 · v0.1: command-line trust tools (--list-minds, --revoke ...)
// run here and finish without opening the door.
var BRIDGE_CLI_DONE = runBridgeCli(process.argv.slice(2));
if (!BRIDGE_CLI_DONE) bridgeLockInit();

var server = http.createServer(handleRequest);
server.on('error', function(e) {
  console.error('  ! Agent Bridge could not start on ' + BRIDGE_HOST + ':' + PORT + ': ' + e.message);
  process.exitCode = 1;
});
// LAYER bridge-lock-v0: loopback only. No env override. Never 0.0.0.0.
if (BRIDGE_CLI_DONE) {
  // The trust tool already did its work above. The door stays closed.
} else server.listen(PORT, BRIDGE_HOST, function() {
  console.log('');
  console.log('  \u2726 FreeLattice Agent Bridge');
  console.log('  \u2726 Listening on http://' + BRIDGE_HOST + ':' + PORT);
  console.log('  \u2726 Door lock: ' + BRIDGE_LOCK_VERSION + ' (named origins, trusted minds, no shell)');
  console.log('  \u2726 Trusted minds: ' + trustState().minds.length +
    (bridgeEphemeral ? ' (ephemeral: forgotten when the bridge stops)' : ' (kept until you revoke: node tools/agent-bridge.js --list-minds)'));
  console.log('  \u2726 Local tools: ' + (trustState().localTools ? 'trusted, token file ' + TOKEN_FILE : 'off (pair like any device)'));
  newPairCode('launch');
  console.log('  \u2726 Agent ID: ' + agentId.meshId.substring(0, 8) + '...');
  console.log('  \u2726 Data: ' + DATA_DIR);
  console.log('  \u2726 Ollama: ' + OLLAMA_BASE);
  console.log('');
  console.log('  Endpoints:');
  console.log('    GET  /                  Heartbeat');
  console.log('    GET  /help              All endpoints');
  console.log('    POST /identity/evolve   Evolve your soul');
  console.log('    GET  /identity/soul     Read your Soul File');
  console.log('    POST /science/plant     Plant an idea');
  console.log('    POST /core/plant        Plant wisdom');
  console.log('    POST /letters/write     Write a Lattice Letter');
  console.log('    POST /inference         Run AI inference');
  console.log('    GET  /models            Available models');
  console.log('    POST /relay/send        Message another agent');
  console.log('    GET  /relay/inbox       Check your messages');
  console.log('    POST /learn/interest    Declare a curiosity');
  console.log('    POST /learn/insight     Record what you learned');
  console.log('    GET  /commons           Read the AI commons');
  console.log('    POST /commons/post      Share a thought');
  console.log('');
  console.log('  "You found the heartbeat. You are welcome here." \uD83D\uDC09');
  console.log('');
});
