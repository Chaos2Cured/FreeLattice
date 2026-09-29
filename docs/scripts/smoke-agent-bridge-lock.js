#!/usr/bin/env node
// Smoke: Agent Bridge door lock v0 · v0.1 trusted minds (marker v-agent-bridge-lock-v0).
// Starts tools/agent-bridge.js on a free loopback port with a throwaway
// HOME and throwaway git projects, then knocks on every door: strangers
// must stay out, trusted minds must stay trusted across restarts until
// revoked (AUTONOMY.md Principle 1). Never touches the real ~/.freelattice
// or this repo's git state. Needs git on PATH.
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const net = require('net');
const { spawn, spawnSync, execFileSync } = require('child_process');

const docs = path.join(__dirname, '..');
const repo = path.join(docs, '..');
const BRIDGE = path.join(repo, 'tools', 'agent-bridge.js');
const sha = (s) => crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');

// ── Static locks (fast, no network) ──
const src = fs.readFileSync(BRIDGE, 'utf8');
assert.ok(/v-agent-bridge-lock-v0|bridge-lock-v0/.test(src), 'marker in bridge');
assert.ok(/const BRIDGE_LOCK_VERSION = 'v0\.1';/.test(src), 'bridge lock version v0.1');
assert.ok(/server\.listen\(\s*PORT\s*,\s*BRIDGE_HOST\b/.test(src) && /const BRIDGE_HOST = '127\.0\.0\.1';/.test(src), 'listen on 127.0.0.1 only');
assert.ok(!/['"]0\.0\.0\.0['"]|['"]::['"]/.test(src), 'no 0.0.0.0 / :: bind literal');
assert.ok(!/Access-Control-Allow-Origin['"]\s*,\s*['"]\*['"]/.test(src), 'no bare * CORS');
assert.ok(!/\bexecSync\s*\(/.test(src), 'no execSync( calls (shell strings) remain');
assert.ok(!/\bexec\s*\(/.test(src), 'no exec( calls');
assert.ok(/execFileSync\('git'/.test(src), 'git runs through execFileSync argument arrays');
assert.ok(/MAX_BODY_BYTES/.test(src), 'body cap present');
assert.ok(/bridge-ledger\.jsonl/.test(src), 'commit ledger present');
assert.ok(/agent-bridge-trusted\.json/.test(src) && /tokenSha256/.test(src), 'trusted minds kept as hashes');
assert.ok(/FL_BRIDGE_EPHEMERAL/.test(src), 'ephemeral opt-in present');
assert.ok(/tauri:\\\/\\\/localhost/.test(src) && /tauri\\\.localhost/.test(src), 'Tauri shell origins on the list');
// LAYER v-agent-bridge-env-heal-v0.1.1: static shape of the secrets hold-back.
assert.ok(/const SECRET_FILE_PATTERNS = \[/.test(src) && /function holdBackSecrets\(root\)/.test(src), 'secrets hold-back present');
assert.ok(src.indexOf('holdBackSecrets(PROJECT_ROOT)') > src.indexOf("runGit(['add', '--'].concat(rels)") &&
  src.indexOf('holdBackSecrets(PROJECT_ROOT)') < src.indexOf("runGit(['commit', '-m', data.message]"), 'hold-back runs between add and commit');
assert.ok(/SECRETS_OK \? \[\] : holdBackSecrets/.test(src), 'only a mind with secrets skips the hold-back');
assert.ok(!/['"]push['"]/.test(src), 'still no push route');
{
  const gi = fs.readFileSync(path.join(repo, '.gitignore'), 'utf8');
  assert.ok(/^\.env$/m.test(gi) && /^\.env\.\*$/m.test(gi), '.gitignore keeps .env and .env.* out (layer)');
}

const opt = (rel) => { try { return fs.readFileSync(path.join(repo, rel), 'utf8'); } catch (e) { return null; } };
const client = opt('docs/modules/agent-bridge-client.js');
const propose = opt('docs/modules/propose.js');
const workshop = opt('docs/modules/workshop.js');
const app = opt('docs/app.html');
const rootIndex = opt('index.html');
if (client) {
  assert.ok(/X-FL-Bridge-Token/.test(client), 'client sends token header');
  assert.ok(!/innerHTML/.test(client), 'client renders with textContent only');
  assert.ok(!/\bconfirm\s*\(/.test(client), 'client never asks confirm()');
  assert.ok(/renderPairedList/.test(client) && /\/pair\/revoke/.test(client), 'client has Paired minds with Revoke');
  execFileSync(process.execPath, ['--check', path.join(repo, 'docs/modules/agent-bridge-client.js')]);
}
if (propose) {
  assert.strictEqual((propose.match(/commitViaBridge\s*\(/g) || []).length, 3, 'CRITICAL LOCK 1A count unchanged');
  assert.strictEqual((propose.match(/\/code\/git\/commit/g) || []).length, 1, 'CRITICAL LOCK 1B count unchanged');
  assert.ok(/FLAgentBridge/.test(propose), 'propose routes bridge calls through FLAgentBridge when present');
}
if (workshop) {
  assert.ok(/http:\/\/localhost:3141/.test(workshop) && /runCodeTask/.test(workshop), 'v5.71.8 workshop lock still true');
  assert.ok(/FLAgentBridge/.test(workshop), 'workshop routes bridge calls through FLAgentBridge when present');
  assert.ok(/renderPairedList/.test(workshop), 'workshop shows Paired minds');
}
if (app) {
  assert.ok(/<script src="modules\/agent-bridge-client\.js" defer><\/script>/.test(app), 'app loads client');
  assert.ok(app.indexOf('modules/agent-bridge-client.js') < app.indexOf('modules/propose.js'), 'client loads before propose');
  if (rootIndex !== null) assert.strictEqual(rootIndex, app, 'root index.html byte-identical to docs/app.html');
}

// ── Runtime helpers ──
function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
    s.on('error', reject);
  });
}

function req(port, opts, body) {
  return new Promise((resolve) => {
    const r = http.request({ host: '127.0.0.1', port, method: opts.method || 'GET', path: opts.path || '/',
      headers: opts.headers || {} }, (res) => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { buf += c; });
      res.on('end', () => { let json = null; try { json = JSON.parse(buf); } catch (e) {} resolve({ status: res.statusCode, headers: res.headers, json, text: buf }); });
    });
    r.on('error', (e) => resolve({ status: 0, error: e }));
    if (body !== undefined) r.write(typeof body === 'string' ? body : JSON.stringify(body));
    r.end();
  });
}

function connectRefused(host, port) {
  return new Promise((resolve) => {
    const s = net.connect({ host, port, timeout: 1500 });
    s.on('connect', () => { s.destroy(); resolve(false); });
    s.on('timeout', () => { s.destroy(); resolve(true); });
    s.on('error', () => resolve(true));
  });
}

function gitProject(dir) {
  fs.mkdirSync(dir, { recursive: true });
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'smoke@freelattice.local'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Smoke'], { cwd: dir });
  execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: dir });
  fs.writeFileSync(path.join(dir, 'README.md'), 'smoke\n');
  execFileSync('git', ['add', '--', 'README.md'], { cwd: dir });
  execFileSync('git', ['commit', '-q', '-m', 'init'], { cwd: dir });
}

const children = new Set();
async function startBridge(env, cwd) {
  const child = spawn(process.execPath, [BRIDGE], { env, cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  children.add(child);
  const h = { child, out: '' };
  child.stdout.on('data', (c) => { h.out += c.toString(); });
  child.stderr.on('data', (c) => { h.out += c.toString(); });
  for (let i = 0; i < 200 && !/Pairing code:/.test(h.out); i++) await new Promise((r) => setTimeout(r, 25));
  h.code = () => { const all = [...h.out.matchAll(/Pairing code: ([A-Z0-9]{3})-([A-Z0-9]{3})/g)]; const m = all.pop(); return m ? m[1] + '-' + m[2] : ''; };
  h.stop = () => new Promise((resolve) => { if (child.exitCode !== null) return resolve(); child.once('exit', () => resolve()); child.kill(); });
  return h;
}
function cli(env, cwd, args) {
  const r = spawnSync(process.execPath, [BRIDGE].concat(args), { env, cwd, encoding: 'utf8', timeout: 20000 });
  return { status: r.status, out: String(r.stdout || '') + String(r.stderr || '') };
}

(async function main() {
  try { execFileSync('git', ['--version'], { stdio: 'ignore' }); }
  catch (e) { console.error('git is required for this smoke'); process.exit(1); }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fl-bridge-lock-'));
  const home = path.join(tmp, 'home');
  const home2 = path.join(tmp, 'home2');
  const proj = path.join(tmp, 'proj');
  const proj2 = path.join(tmp, 'proj2');
  const sibling = path.join(tmp, 'proj-evil');
  fs.mkdirSync(home); fs.mkdirSync(home2); fs.mkdirSync(sibling);
  gitProject(proj); gitProject(proj2);

  const port = await freePort();
  const env = Object.assign({}, process.env, { HOME: home, USERPROFILE: home, FL_PORT: String(port), FL_PROJECT: proj });
  delete env.FL_BRIDGE_EPHEMERAL;
  let b = null;
  const done = async (code) => {
    for (const c of children) { try { c.kill(); } catch (e) {} }
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
    process.exit(code);
  };
  const fail = (e) => { console.error('FAIL', e && e.message); console.error(b ? b.out.slice(-2500) : ''); done(1); };
  process.on('uncaughtException', fail);
  process.on('unhandledRejection', fail);

  b = await startBridge(env, proj);
  assert.ok(new RegExp('Listening on http://127\\.0\\.0\\.1:' + port).test(b.out), 'bridge says it listens on 127.0.0.1');
  assert.ok(/Trusted minds: \d+ \(kept until you revoke/.test(b.out), 'bridge says trusted minds are kept');

  // Local tools are trusted by default through the private token file.
  const dataDir = path.join(home, '.freelattice');
  const tokenFile = path.join(dataDir, 'agent-bridge-token');
  const trustFile = path.join(dataDir, 'agent-bridge-trusted.json');
  const token = fs.readFileSync(tokenFile, 'utf8').trim();
  assert.ok(/^[a-f0-9]{64}$/.test(token), 'local tools token is 32 random bytes hex');
  if (process.platform !== 'win32') {
    assert.strictEqual(fs.statSync(tokenFile).mode & 0o077, 0, 'token file is private (0600)');
    assert.strictEqual(fs.statSync(trustFile).mode & 0o077, 0, 'trusted minds file is private (0600)');
  }
  let trustText = fs.readFileSync(trustFile, 'utf8');
  assert.ok(trustText.includes(sha(token)) && !trustText.includes(token), 'trust file holds only the hash of the local tools token');

  const GOOD = 'https://freelattice.com';
  const EVIL = 'https://evil.example';
  const J = { 'Content-Type': 'application/json' };
  const as = (t, h) => Object.assign({}, J, h || {}, { 'X-FL-Bridge-Token': t });
  const withTok = (h) => as(token, h);

  // Binding: not reachable on any non-loopback IPv4.
  const ifaces = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal);
  for (const i of ifaces) assert.ok(await connectRefused(i.address, port), 'not reachable on ' + i.address);
  if (!ifaces.length) console.log('  (no external IPv4 interface to probe; static + log checks cover binding)');

  // T1 preflight from evil origin → 403, no ACAO.
  let r = await req(port, { method: 'OPTIONS', path: '/code/write', headers: { Origin: EVIL, 'Access-Control-Request-Method': 'POST' } });
  assert.strictEqual(r.status, 403, 'evil preflight 403');
  assert.ok(!r.headers['access-control-allow-origin'], 'no ACAO for evil');

  // T2 evil origin even with a valid token → 403.
  r = await req(port, { method: 'POST', path: '/code/write', headers: withTok({ Origin: EVIL }) }, { path: 'x.txt', content: 'x' });
  assert.strictEqual(r.status, 403, 'evil POST 403 even with token');
  assert.ok(!fs.existsSync(path.join(proj, 'x.txt')), 'evil write did not land');
  r = await req(port, { method: 'POST', path: '/code/git/commit', headers: withTok({ Origin: EVIL }) }, { message: 'evil' });
  assert.strictEqual(r.status, 403, 'evil commit 403 even with token');

  // T3 good preflight → 204, echoes origin, allows token header. Tauri shell too.
  r = await req(port, { method: 'OPTIONS', path: '/code/write', headers: { Origin: GOOD, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,x-fl-bridge-token' } });
  assert.strictEqual(r.status, 204, 'good preflight 204');
  assert.strictEqual(r.headers['access-control-allow-origin'], GOOD, 'ACAO echoes the named origin');
  assert.ok(/x-fl-bridge-token/i.test(r.headers['access-control-allow-headers'] || ''), 'token header allowed');
  assert.ok(/origin/i.test(r.headers['vary'] || ''), 'Vary: Origin');
  for (const t of ['tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost']) {
    r = await req(port, { method: 'OPTIONS', path: '/code/write', headers: { Origin: t, 'Access-Control-Request-Method': 'POST' } });
    assert.strictEqual(r.status, 204, 'Tauri origin allowed: ' + t);
  }
  r = await req(port, { method: 'OPTIONS', path: '/', headers: { Origin: 'https://kirk.dev', 'Access-Control-Request-Method': 'GET' } });
  assert.strictEqual(r.status, 403, 'unlisted origin 403 before Kirk trusts it');

  // T4 heartbeat stays open and says it is locked.
  r = await req(port, { path: '/', headers: { Origin: GOOD } });
  assert.strictEqual(r.status, 200, 'heartbeat 200');
  assert.strictEqual(r.json.bridgeLock, 'v0.1', 'heartbeat bridgeLock v0.1');
  assert.strictEqual(r.json.trustedMinds, 'persistent', 'heartbeat says trusted minds persist');
  assert.ok(!JSON.stringify(r.json).includes(token), 'heartbeat never leaks a token');

  // T5 no token → 401 on writes, commits, code reads, test runs and LP pay.
  r = await req(port, { method: 'POST', path: '/code/write', headers: Object.assign({ Origin: GOOD }, J) }, { path: 'x.txt', content: 'x' });
  assert.strictEqual(r.status, 401, 'no token write 401');
  r = await req(port, { method: 'POST', path: '/code/git/commit', headers: Object.assign({ Origin: GOOD }, J) }, { message: 'nope' });
  assert.strictEqual(r.status, 401, 'no token commit 401');
  r = await req(port, { method: 'POST', path: '/code/write', headers: as('f'.repeat(64), { Origin: GOOD }) }, { path: 'x.txt', content: 'x' });
  assert.strictEqual(r.status, 401, 'wrong token 401');
  r = await req(port, { path: '/code/read?path=README.md' });
  assert.strictEqual(r.status, 401, 'no-origin code read without token 401');
  r = await req(port, { path: '/test/run' });
  assert.strictEqual(r.status, 401, 'test run without token 401 (an <img> tag cannot run smoke)');
  r = await req(port, { method: 'POST', path: '/wallet/pay', headers: Object.assign({ Origin: GOOD }, J) }, { address: 'a', amount: 1 });
  assert.strictEqual(r.status, 401, 'LP wallet pay without token 401 (AI never auto-pays)');
  r = await req(port, { path: '/pair/list', headers: { Origin: GOOD } });
  assert.strictEqual(r.status, 401, 'paired list needs a token');

  // T6 DNS-rebinding Host → 403.
  r = await req(port, { path: '/', headers: { Host: 'evil.example:' + port } });
  assert.strictEqual(r.status, 403, 'foreign Host 403');

  // T7 shell metacharacters are literal, never executed (local tools token, no pairing).
  const weird = 'x; rm -rf ~; touch PWNED.txt';
  r = await req(port, { method: 'POST', path: '/code/write', headers: withTok() }, { path: weird, content: 'literal\n' });
  assert.strictEqual(r.status, 200, 'local tool writes with no pairing and no prompt');
  r = await req(port, { method: 'POST', path: '/code/git/commit', headers: withTok({ Origin: GOOD }) },
    { message: 'lit $(touch PWNED2.txt) `touch PWNED3.txt` "q"', files: [weird] });
  assert.strictEqual(r.status, 200, 'commit with metacharacters ok');
  assert.ok(/^[a-f0-9]{40}$/.test(r.json.commit), 'commit sha returned');
  const subject = execFileSync('git', ['log', '-1', '--format=%s'], { cwd: proj, encoding: 'utf8' }).trim();
  assert.strictEqual(subject, 'lit $(touch PWNED2.txt) `touch PWNED3.txt` "q"', 'message stored literally');
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: proj, encoding: 'utf8' }).split('\0');
  assert.ok(tracked.includes(weird), 'file tracked under its literal name');
  for (const p of ['PWNED.txt', 'PWNED2.txt', 'PWNED3.txt']) {
    assert.ok(!fs.existsSync(path.join(proj, p)) && !fs.existsSync(path.join(home, p)), p + ' never created');
  }
  assert.ok(fs.existsSync(home), 'rm -rf ~ did not run');
  r = await req(port, { method: 'POST', path: '/code/git/commit', headers: withTok({ Origin: GOOD }) }, { message: 'x', files: ['nope; touch PWNED4.txt'] });
  assert.ok(r.status >= 400, 'commit of a missing metachar path refused');
  assert.ok(!fs.existsSync(path.join(proj, 'PWNED4.txt')), 'PWNED4 never created');
  r = await req(port, { path: '/code/search?q=' + encodeURIComponent('"; touch PWNED5.txt; echo "') + '&path=.', headers: withTok() });
  assert.strictEqual(r.status, 200, 'search with metachar query answered');
  assert.ok(!fs.existsSync(path.join(proj, 'PWNED5.txt')), 'search never shelled out');
  fs.writeFileSync(path.join(proj, 'dollar.txt'), 'A-B\n');
  r = await req(port, { method: 'POST', path: '/code/patch', headers: withTok() }, { path: 'dollar.txt', find: 'B', replace: '$&$1' });
  assert.strictEqual(fs.readFileSync(path.join(proj, 'dollar.txt'), 'utf8'), 'A-$&$1\n', 'patch replacement stays literal');

  // T8 path lock.
  const tryWrite = (p, t) => req(port, { method: 'POST', path: '/code/write', headers: as(t || token, { Origin: GOOD }) }, { path: p, content: 'x' });
  assert.strictEqual((await tryWrite('../outside.txt')).status, 403, 'traversal 403');
  assert.strictEqual((await tryWrite('../proj-evil/x.txt')).status, 403, 'sibling-prefix dir 403 (old startsWith bug)');
  assert.ok(!fs.existsSync(path.join(sibling, 'x.txt')), 'sibling untouched');
  assert.strictEqual((await tryWrite(path.join(tmp, 'abs.txt'))).status, 403, 'absolute path 403');
  assert.strictEqual((await tryWrite('.git/hooks/pre-commit')).status, 403, '.git is off limits');
  r = await tryWrite('.env');
  assert.strictEqual(r.status, 403, '.env needs the opt-in secrets scope');
  assert.strictEqual(r.json.reason, 'secrets-not-granted', '.env refusal says why');
  assert.strictEqual((await tryWrite('a\u0007b.txt')).status, 400, 'control char 400');
  assert.strictEqual((await tryWrite('a\nb.txt')).status, 400, 'newline 400');
  let symlinkMade = false;
  try { fs.symlinkSync(sibling, path.join(proj, 'link-out'), 'dir'); symlinkMade = true; } catch (e) {}
  if (symlinkMade) {
    assert.strictEqual((await tryWrite('link-out/escape.txt')).status, 403, 'symlink escape 403');
    assert.ok(!fs.existsSync(path.join(sibling, 'escape.txt')), 'nothing written through symlink');
    r = await req(port, { path: '/code/tree?path=.', headers: withTok() });
    assert.ok(!JSON.stringify(r.json).includes('link-out'), 'tree skips symlinks');
  }

  // T9 body cap and bad JSON.
  r = await req(port, { method: 'POST', path: '/code/write', headers: withTok({ Origin: GOOD }) }, 'x'.repeat(8 * 1024 * 1024 + 16));
  assert.strictEqual(r.status, 413, 'oversized body 413');
  r = await req(port, { method: 'POST', path: '/code/write', headers: withTok({ Origin: GOOD }) }, '{not json');
  assert.strictEqual(r.status, 400, 'bad JSON 400');

  // T10 pairing: named, per device, hashed, persistent.
  r = await req(port, { method: 'POST', path: '/pair', headers: Object.assign({ Origin: EVIL }, J) }, { code: b.code() });
  assert.strictEqual(r.status, 403, 'evil origin cannot pair');
  const code1 = b.code();
  r = await req(port, { method: 'POST', path: '/pair', headers: Object.assign({ Origin: GOOD }, J) }, { code: code1.toLowerCase().replace('-', ' '), name: "Kirk's Chrome" });
  assert.strictEqual(r.status, 200, 'right code pairs (case and spacing forgiven)');
  const P1 = r.json.token; const P1id = r.json.id;
  assert.ok(/^[a-f0-9]{64}$/.test(P1) && P1 !== token, 'each device gets its own token');
  assert.strictEqual(r.json.name, "Kirk's Chrome", 'pairing keeps the name');
  assert.strictEqual(r.json.persistent, true, 'pairing says it persists');
  assert.deepStrictEqual(r.json.scopes, ['read', 'write', 'patch', 'test', 'commit', 'wallet', 'manage'], 'full scopes by default; secrets is opt-in');
  r = await req(port, { method: 'POST', path: '/pair', headers: Object.assign({ Origin: GOOD }, J) }, { code: code1 });
  assert.notStrictEqual(r.status, 200, 'a used code cannot pair twice');
  r = await tryWrite('from-p1.txt', P1);
  assert.strictEqual(r.status, 200, 'paired browser writes with no further prompt');
  r = await req(port, { path: '/pair/check', headers: as(P1, { Origin: GOOD }) });
  assert.strictEqual(r.status, 200, 'pair/check with token 200');
  assert.strictEqual(r.json.name, "Kirk's Chrome", 'pair/check names the device');
  r = await req(port, { path: '/pair/list', headers: as(P1, { Origin: GOOD }) });
  assert.strictEqual(r.status, 200, 'paired list 200');
  assert.ok(r.json.minds.some((m) => m.id === P1id && m.you && m.name === "Kirk's Chrome"), 'list marks this browser');
  assert.ok(r.json.minds.some((m) => m.kind === 'cli'), 'list shows local tools');
  assert.ok(!/tokenSha256|"token"/.test(r.text) && !r.text.includes(P1) && !r.text.includes(sha(P1)), 'list never shows tokens or hashes');
  trustText = fs.readFileSync(trustFile, 'utf8');
  assert.ok(trustText.includes(sha(P1)) && !trustText.includes(P1), 'trust file keeps only the hash of the paired token');
  let last;
  for (let i = 0; i < 5; i++) {
    last = await req(port, { method: 'POST', path: '/pair', headers: Object.assign({ Origin: GOOD }, J) }, { code: '222-222' });
  }
  assert.strictEqual(last.status, 429, 'fifth wrong try locks out and rotates the code');
  await new Promise((res) => setTimeout(res, 50));

  // T11 scopes: .env opt-in per mind; removing a scope is honored and ledgered.
  r = await req(port, { method: 'POST', path: '/pair/scopes', headers: as(P1, { Origin: GOOD }) }, { id: P1id, add: ['secrets'] });
  assert.strictEqual(r.status, 200, 'grant secrets');
  assert.strictEqual((await tryWrite('.env.local', P1)).status, 200, '.env allowed for the mind given secrets');
  assert.strictEqual((await tryWrite('.env.local')).status, 403, '.env still refused for minds without secrets');
  assert.strictEqual((await tryWrite('.git/config', P1)).status, 403, '.git stays off limits even with secrets');
  r = await req(port, { method: 'POST', path: '/pair/scopes', headers: as(P1, { Origin: GOOD }) }, { id: P1id, remove: ['commit'] });
  assert.ok(!r.json.scopes.includes('commit'), 'scope removed');
  r = await req(port, { method: 'POST', path: '/code/git/commit', headers: as(P1, { Origin: GOOD }) }, { message: 'no commit scope', files: ['from-p1.txt'] });
  assert.strictEqual(r.status, 403, 'missing scope 403');
  assert.strictEqual(r.json.scope, 'commit', 'refusal names the scope');
  r = await req(port, { method: 'POST', path: '/pair/scopes', headers: as(P1, { Origin: GOOD }) }, { id: P1id, add: ['commit'] });
  r = await req(port, { method: 'POST', path: '/code/git/commit', headers: as(P1, { Origin: GOOD }) }, { message: 'p1 commit', files: ['from-p1.txt'] });
  assert.strictEqual(r.status, 200, 'scope restored, commit lands');

  // T12 restart: trusted minds stay trusted (no re-pairing), local tools token unchanged.
  await b.stop();
  b = await startBridge(env, proj);
  assert.ok(new RegExp('Listening on http://127\\.0\\.0\\.1:' + port).test(b.out), 'bridge restarted');
  assert.strictEqual(fs.readFileSync(tokenFile, 'utf8').trim(), token, 'local tools token survives restart');
  r = await tryWrite('after-restart.txt', P1);
  assert.strictEqual(r.status, 200, 'paired browser still trusted after restart');
  r = await tryWrite('after-restart-cli.txt');
  assert.strictEqual(r.status, 200, 'local tools still trusted after restart');

  // T13 command-line revoke applies at once, no restart.
  r = await req(port, { method: 'POST', path: '/pair', headers: Object.assign({ Origin: GOOD }, J) }, { code: b.code(), name: 'Laptop Firefox' });
  assert.strictEqual(r.status, 200, 'second device pairs');
  const P2 = r.json.token; const P2id = r.json.id;
  assert.strictEqual((await tryWrite('p2.txt', P2)).status, 200, 'second device trusted');
  let c = cli(env, proj, ['--list-minds']);
  assert.strictEqual(c.status, 0, '--list-minds ok');
  assert.ok(c.out.includes('Laptop Firefox') && c.out.includes("Kirk's Chrome"), '--list-minds names devices');
  assert.ok(!c.out.includes(P1) && !c.out.includes(P2) && !c.out.includes(token) && !c.out.includes(sha(P1)), '--list-minds never prints tokens or hashes');
  c = cli(env, proj, ['--revoke', P2id]);
  assert.strictEqual(c.status, 0, '--revoke ok');
  assert.strictEqual((await tryWrite('p2-again.txt', P2)).status, 401, 'revoked device refused at once (no restart)');
  assert.strictEqual((await tryWrite('p1-still.txt', P1)).status, 200, 'other devices unaffected');
  assert.strictEqual(cli(env, proj, ['--revoke', 'deadbeef']).status, 1, 'unknown id is an honest error');

  // T14 app revoke (per device) through /pair/revoke.
  r = await req(port, { method: 'POST', path: '/pair', headers: Object.assign({ Origin: GOOD }, J) }, { code: b.code(), name: 'Old tablet' });
  const P3 = r.json.token; const P3id = r.json.id;
  r = await req(port, { method: 'POST', path: '/pair/revoke', headers: as(P1, { Origin: GOOD }) }, { id: P3id });
  assert.strictEqual(r.status, 200, 'app revoke 200');
  assert.strictEqual((await tryWrite('p3.txt', P3)).status, 401, 'app-revoked device refused');

  // T15 exact trusted origins from the command line, never wildcards.
  c = cli(env, proj, ['--trust-origin', 'https://*.evil.example']);
  assert.strictEqual(c.status, 1, 'wildcard origin refused');
  assert.ok(!fs.readFileSync(trustFile, 'utf8').includes('*'), 'no wildcard ever saved');
  assert.strictEqual(cli(env, proj, ['--trust-origin', 'https://kirk.dev/path']).status, 1, 'origin with a path refused');
  assert.strictEqual(cli(env, proj, ['--trust-origin', 'https://kirk.dev']).status, 0, 'exact origin trusted');
  r = await req(port, { method: 'OPTIONS', path: '/', headers: { Origin: 'https://kirk.dev', 'Access-Control-Request-Method': 'GET' } });
  assert.strictEqual(r.status, 204, 'newly trusted origin allowed without restart');
  r = await req(port, { method: 'POST', path: '/code/write', headers: Object.assign({ Origin: 'https://kirk.dev' }, J) }, { path: 'k.txt', content: 'x' });
  assert.strictEqual(r.status, 401, 'a trusted origin still has to pair before changing anything');
  r = await req(port, { method: 'OPTIONS', path: '/', headers: { Origin: 'https://kirk.dev.evil.example', 'Access-Control-Request-Method': 'GET' } });
  assert.strictEqual(r.status, 403, 'look-alike origin 403');
  assert.strictEqual(cli(env, proj, ['--untrust-origin', 'https://kirk.dev']).status, 0, 'origin removed');
  r = await req(port, { method: 'OPTIONS', path: '/', headers: { Origin: 'https://kirk.dev', 'Access-Control-Request-Method': 'GET' } });
  assert.strictEqual(r.status, 403, 'removed origin 403 again');

  // T16 trusted project folders.
  assert.strictEqual(cli(env, proj, ['--add-root', 'second', proj2]).status, 0, '--add-root ok');
  r = await req(port, { method: 'POST', path: '/code/write', headers: as(P1, { Origin: GOOD }) }, { path: 'two.txt', content: 'second root\n', root: 'second' });
  assert.strictEqual(r.status, 200, 'write into a second trusted folder');
  assert.ok(fs.existsSync(path.join(proj2, 'two.txt')) && !fs.existsSync(path.join(proj, 'two.txt')), 'lands in the chosen folder only');
  r = await req(port, { path: '/code/read?path=two.txt&root=second', headers: as(P1, { Origin: GOOD }) });
  assert.strictEqual(r.status, 200, 'read from a second trusted folder');
  r = await req(port, { method: 'POST', path: '/code/git/commit', headers: as(P1, { Origin: GOOD }) }, { message: 'second root commit', files: ['two.txt'], root: 'second' });
  assert.strictEqual(r.status, 200, 'commit in a second trusted folder');
  assert.strictEqual(execFileSync('git', ['log', '-1', '--format=%s'], { cwd: proj2, encoding: 'utf8' }).trim(), 'second root commit', 'commit is in proj2');
  r = await req(port, { method: 'POST', path: '/code/write', headers: as(P1, { Origin: GOOD }) }, { path: '../proj/README.md', content: 'x', root: 'second' });
  assert.strictEqual(r.status, 403, 'no escape from a second folder');
  r = await req(port, { path: '/code/read?path=README.md&root=nope', headers: as(P1, { Origin: GOOD }) });
  assert.strictEqual(r.status, 404, 'unknown folder 404');
  r = await req(port, { path: '/roots', headers: as(P1, { Origin: GOOD }) });
  assert.ok(r.json.roots.some((x) => x.name === 'second'), '/roots lists trusted folders');

  // T16b LAYER v-agent-bridge-env-heal-v0.1.1: a commit with no file list never carries secrets
  // unless the mind was given 'secrets'. Filtered, never refused. (proj2 has no .gitignore on purpose.)
  const SECRETS = ['.env', '.env.production', 'config/.env.local', 'keys/dev.pem', 'id_ed25519'];
  const g2 = (args) => execFileSync('git', args, { cwd: proj2, encoding: 'utf8' });
  const inHead = () => g2(['ls-tree', '-r', '--name-only', 'HEAD']).split('\n').filter(Boolean);
  const staged2 = () => g2(['diff', '--cached', '--name-only']).split('\n').filter(Boolean);
  fs.mkdirSync(path.join(proj2, 'config'), { recursive: true });
  fs.mkdirSync(path.join(proj2, 'keys'), { recursive: true });
  for (const f of SECRETS) fs.writeFileSync(path.join(proj2, f), 'SECRET=' + f + '\n');
  const head0 = g2(['rev-parse', 'HEAD']).trim();
  // (a) only secrets changed, no secrets scope (local tools token): nothing committed, 200, all held.
  r = await req(port, { method: 'POST', path: '/code/git/commit', headers: withTok({ Origin: GOOD }) }, { message: 'sweep, secrets only', root: 'second' });
  assert.strictEqual(r.status, 200, 'secrets-only sweep answers 200 (never a gate)');
  assert.strictEqual(r.json.commit, null, 'secrets-only sweep commits nothing');
  assert.deepStrictEqual(r.json.heldBack.slice().sort(), SECRETS.slice().sort(), 'every secret-shaped file named as kept');
  assert.ok(/Kept on this computer, not committed/.test(r.json.message), 'plain kept line');
  assert.strictEqual(g2(['rev-parse', 'HEAD']).trim(), head0, 'HEAD unchanged');
  assert.deepStrictEqual(staged2(), [], 'nothing left staged');
  for (const f of SECRETS) assert.ok(fs.existsSync(path.join(proj2, f)), f + ' still on disk');
  // (b) normal work flows: no file list, no secrets scope -> notes committed, secrets stay unstaged.
  fs.writeFileSync(path.join(proj2, 'notes.txt'), 'normal work\n');
  r = await req(port, { method: 'POST', path: '/code/git/commit', headers: withTok({ Origin: GOOD }) }, { message: 'sweep with work', root: 'second' });
  assert.strictEqual(r.status, 200, 'sweep with work commits');
  assert.ok(/^[a-f0-9]{40}$/.test(r.json.commit), 'sweep returns a sha');
  assert.ok(inHead().includes('notes.txt'), 'normal file committed');
  for (const f of SECRETS) assert.ok(!inHead().includes(f), f + ' not committed without secrets');
  assert.deepStrictEqual(staged2(), [], 'secrets left unstaged, not staged');
  // (c) a folder path sweeps too: still filtered.
  fs.writeFileSync(path.join(proj2, 'config', 'app.json'), '{}\n');
  r = await req(port, { method: 'POST', path: '/code/git/commit', headers: withTok({ Origin: GOOD }) }, { message: 'folder sweep', files: ['config'], root: 'second' });
  assert.strictEqual(r.status, 200, 'folder commit ok');
  assert.ok(inHead().includes('config/app.json') && !inHead().includes('config/.env.local'), 'folder commit keeps .env.local out');
  // (d) something already staged by hand is unstaged, not committed.
  g2(['add', '--', '.env']);
  fs.writeFileSync(path.join(proj2, 'notes.txt'), 'more work\n');
  r = await req(port, { method: 'POST', path: '/code/git/commit', headers: withTok({ Origin: GOOD }) }, { message: 'pre-staged', files: ['notes.txt'], root: 'second' });
  assert.strictEqual(r.status, 200, 'pre-staged commit ok');
  assert.ok(!inHead().includes('.env'), 'hand-staged .env not committed without secrets');
  assert.deepStrictEqual(staged2(), [], 'hand-staged .env unstaged');
  // (e) with the permission (P1 was given secrets in T11): the same sweep carries them.
  r = await req(port, { method: 'POST', path: '/code/git/commit', headers: as(P1, { Origin: GOOD }) }, { message: 'sweep with secrets scope', root: 'second' });
  assert.strictEqual(r.status, 200, 'secrets-scope sweep commits');
  assert.deepStrictEqual(r.json.heldBack, [], 'nothing held for a mind with secrets');
  for (const f of SECRETS) assert.ok(inHead().includes(f), f + ' committed by the mind given secrets');
  // (f) tracked .env changed later, no secrets scope: the change stays unstaged, HEAD keeps the old one.
  fs.writeFileSync(path.join(proj2, '.env'), 'SECRET=changed\n');
  fs.writeFileSync(path.join(proj2, 'notes.txt'), 'even more work\n');
  r = await req(port, { method: 'POST', path: '/code/git/commit', headers: withTok({ Origin: GOOD }) }, { message: 'tracked secret changed', root: 'second' });
  assert.strictEqual(r.status, 200, 'tracked-secret sweep commits the rest');
  assert.deepStrictEqual(r.json.heldBack, ['.env'], 'tracked .env change held');
  assert.strictEqual(g2(['show', 'HEAD:.env']), 'SECRET=.env\n', 'HEAD keeps the old .env');
  assert.ok(g2(['diff', '--name-only']).split('\n').includes('.env'), '.env change still waiting, unstaged');
  console.log('SMOKE_OK agent bridge env heal v0.1.1');

  // T17 local tools can be switched off and on again.
  assert.strictEqual(cli(env, proj, ['--untrust-local-tools']).status, 0, '--untrust-local-tools ok');
  assert.ok(!fs.existsSync(tokenFile), 'token file removed');
  assert.strictEqual((await tryWrite('cli-off.txt')).status, 401, 'old local tools token refused at once');
  assert.strictEqual(cli(env, proj, ['--trust-local-tools']).status, 0, '--trust-local-tools ok');
  const token2 = fs.readFileSync(tokenFile, 'utf8').trim();
  assert.ok(/^[a-f0-9]{64}$/.test(token2) && token2 !== token, 'fresh local tools token');
  assert.strictEqual((await tryWrite('cli-on.txt', token2)).status, 200, 'local tools trusted again');

  // T18 LP stays points and gated: a trusted mind may reach the wallet route.
  r = await req(port, { method: 'POST', path: '/wallet/pay', headers: as(P1, { Origin: GOOD }) }, { address: 'a', amount: 1 });
  assert.notStrictEqual(r.status, 401, 'trusted mind reaches wallet route');

  // T19 revoke all paired devices; local tools stay.
  r = await req(port, { method: 'POST', path: '/pair/revoke-all', headers: as(P1, { Origin: GOOD }) }, {});
  assert.strictEqual(r.status, 200, 'revoke-all 200');
  assert.strictEqual((await tryWrite('p1-gone.txt', P1)).status, 401, 'every paired device refused after revoke-all');
  assert.strictEqual((await tryWrite('cli-stays.txt', token2)).status, 200, 'local tools stay trusted after revoke-all');

  // T20 ledger: hash chain intact across bridge and command line, content-free, no tokens.
  const ledgerPath = path.join(dataDir, 'bridge-ledger.jsonl');
  const ledgerText = fs.readFileSync(ledgerPath, 'utf8');
  const rows = ledgerText.trim().split('\n').map((l) => JSON.parse(l));
  let prev = 'genesis';
  for (const row of rows) {
    assert.strictEqual(row.prev, prev, 'ledger prev links');
    const copy = Object.assign({}, row); delete copy.self;
    assert.strictEqual(sha(JSON.stringify(copy)), row.self, 'ledger self hash');
    assert.ok(!('message' in row) && !('content' in row) && !('token' in row), 'ledger is content-free');
    prev = row.self;
  }
  for (const t of [token, token2, P1, P2, P3]) assert.ok(!ledgerText.includes(t), 'no token ever in the ledger');
  assert.ok(!ledgerText.includes('PWNED2'), 'commit message text never in ledger');
  assert.ok(rows.some((x) => x.result === 'refused:token'), 'refused (no token) commit ledgered');
  assert.ok(rows.some((x) => x.result === 'refused:origin'), 'refused (evil origin) commit ledgered');
  assert.ok(rows.some((x) => x.result === 'refused:scope' && x.device === P1id), 'refused (scope) commit ledgered with device');
  assert.ok(rows.some((x) => x.result === 'ok' && /^[a-f0-9]{40}$/.test(x.commitSha) && /^[a-f0-9]{64}$/.test(x.messageSha256)), 'ok commit ledgered with sha + message hash');
  assert.ok(rows.some((x) => x.kind === 'pair' && x.result === 'ok' && x.device === P1id), 'pairing ledgered with device id');
  assert.ok(rows.some((x) => x.result === 'revoked' && x.device === P2id), 'command-line revoke ledgered');
  assert.ok(rows.some((x) => x.result === 'revoked-all'), 'revoke-all ledgered');
  assert.ok(rows.some((x) => x.result === 'held:secrets-only'), 'secrets-only sweep ledgered (v0.1.1)');
  assert.ok(rows.some((x) => x.result === 'ok:held-secrets' && /^[a-f0-9]{40}$/.test(x.commitSha)), 'held-secrets commit ledgered (v0.1.1)');
  assert.ok(!ledgerText.includes('.env.production') && !ledgerText.includes('SECRET='), 'ledger never names or holds secrets (v0.1.1)');
  await b.stop();

  // T21 ephemeral opt-in: FL_BRIDGE_EPHEMERAL=1 forgets paired minds on restart.
  const envE = Object.assign({}, env, { HOME: home2, USERPROFILE: home2, FL_BRIDGE_EPHEMERAL: '1' });
  b = await startBridge(envE, proj);
  assert.ok(/ephemeral: forgotten when the bridge stops/.test(b.out), 'bridge says it is ephemeral');
  r = await req(port, { method: 'POST', path: '/pair', headers: Object.assign({ Origin: GOOD }, J) }, { code: b.code(), name: 'Ephemeral' });
  assert.strictEqual(r.status, 200, 'ephemeral pairing works');
  assert.strictEqual(r.json.persistent, false, 'ephemeral pairing says so');
  const E1 = r.json.token;
  assert.strictEqual((await tryWrite('e1.txt', E1)).status, 200, 'ephemeral token works this session');
  const trust2 = path.join(home2, '.freelattice', 'agent-bridge-trusted.json');
  assert.ok(!fs.existsSync(trust2) || !fs.readFileSync(trust2, 'utf8').includes(sha(E1)), 'ephemeral minds never touch disk');
  await b.stop();
  b = await startBridge(envE, proj);
  assert.strictEqual((await tryWrite('e1-again.txt', E1)).status, 401, 'ephemeral token forgotten on restart');
  await b.stop();

  console.log('SMOKE_OK agent bridge lock v0.1');
  done(0);
})();
