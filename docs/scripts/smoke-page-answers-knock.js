// smoke-page-answers-knock.js v-page-answers-knock-v0.1 (033b). Node only, no browser.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const D = path.join(__dirname, '..');
let n = 0, bad = 0;
function ok(name, c) { n++; if (!c) { bad++; console.log('FAIL ' + name); } }
const src = fs.readFileSync(path.join(D, 'modules/pool-knock.js'), 'utf8');
const app = fs.readFileSync(path.join(D, 'app.html'), 'utf8');
ok('marker', src.indexOf('v-page-answers-knock-v0.1') !== -1);
ok('no em dash, no dialog call, no raw HTML writes', !new RegExp('\\u2014|conf' + 'irm\\(|inner' + 'HTML').test(src));
ok('app.html loads pool-knock.js once', app.split('src="modules/pool-knock.js"').length === 2);
ok('app.html has the host', app.indexOf('id="pool-knock-host"') !== -1);
ok('app.html does not load tree-pool.js for the web', app.indexOf('src="modules/tree-pool.js"') === -1);
ok('iceServers stay empty in the vendored pool', /iceServers: \[\]/.test(fs.readFileSync(path.join(D, 'modules/tree-pool.js'), 'utf8')));
ok('pool-knock never sets iceServers or opens its own connection', src.indexOf('new RTCPeerConnection') === -1);

function run(opts) {
  const answers = [], calls = [];
  let mode = opts.mode || 'off', cb = null;
  const pool = {
    mode: () => mode, pause: () => { mode = 'pause'; calls.push('pool-pause'); }, letHelp: () => { if (mode === 'pause') return false; mode = 'kin'; calls.push('letHelp'); },
    readInvite: (c) => Promise.resolve(c.indexOf('TREEPOOL1:') === 0 ? { ok: true, sdp: 'v=0', card: opts.card === undefined ? { ok: true, fp: 'abcd' } : opts.card } : { ok: false }),
    trustCarried: () => calls.push('trust'),
    join: () => Promise.resolve(opts.join || { ok: true, code: 'TREEPOOL1:reply', peerId: 'p1' })
  };
  const api = { onLatticeDiscoverKnock: (f) => { cb = f; return () => { cb = null; }; }, latticeDiscoverAnswer: (id, a) => { answers.push([id, a]); return Promise.resolve({ ok: true }); } };
  const ctx = { window: {} }; ctx.window.window = ctx.window;
  vm.runInNewContext(src, ctx);
  const K = ctx.window.PoolKnock;
  K.attach(api, pool);
  return { K, answers, calls, mode: () => mode, cb: () => cb };
}
(async () => {
  let t = run({});
  ok('attached to the knock', typeof t.cb() === 'function');
  let r = await t.K.handle({ joinId: 'j1', offer: 'TREEPOOL1:x', fp: 'abcd', name: 'P', choice: 'help' });
  ok('help Yes answered', r.ok && t.answers[0][0] === 'j1' && t.answers[0][1] === 'TREEPOOL1:reply');
  ok('help Yes opened a closed door and trusted the card', t.mode() === 'kin' && t.calls.indexOf('trust') !== -1);
  t = run({ mode: 'pause' });
  r = await t.K.handle({ joinId: 'j2', offer: 'TREEPOOL1:x', fp: 'abcd', name: 'P', choice: 'help' });
  ok('Pause wins: connect only, still paused', r.ok && r.choice === 'connect' && t.mode() === 'pause' && t.calls.indexOf('letHelp') === -1);
  t = run({});
  r = await t.K.handle({ joinId: 'j3', offer: 'TREEPOOL1:x', fp: 'abcd', name: 'P', choice: 'connect' });
  ok('connect only leaves the door off', r.ok && t.mode() === 'off');
  r = await t.K.handle({ joinId: 'j4', offer: 'TREEPOOL1:x', fp: 'ffff', name: 'P', choice: 'connect' });
  ok('card mismatch: empty answer', !r.ok && r.reason === 'card-mismatch' && t.answers[t.answers.length - 1][1] === '');
  r = await t.K.handle({ joinId: 'j5', offer: 'nope', fp: '', name: 'P', choice: 'connect' });
  ok('not an invite: empty answer', !r.ok && t.answers[t.answers.length - 1][1] === '');
  r = await t.K.handle({ joinId: 'j6', offer: 'TREEPOOL1:x', fp: '', name: 'P', choice: 'evil' });
  ok('unknown choice refused', !r.ok);
  r = await t.K.handle({ joinId: 'j7', offer: 'TREEPOOL1:' + 'a'.repeat(17000), fp: '', name: 'P', choice: 'connect' });
  ok('16 KB cap', !r.ok);
  t = run({ join: { ok: true, code: 'not-a-code' } });
  r = await t.K.handle({ joinId: 'j8', offer: 'TREEPOOL1:x', fp: 'abcd', name: 'P', choice: 'connect' });
  ok('a non-TREEPOOL1 reply is never passed on', !r.ok && t.answers[0][1] === '');
  const t2 = { window: {} }; t2.window.window = t2.window; vm.runInNewContext(src, t2);
  ok('outside the desktop app: not-desktop', t2.window.PoolKnock.attach().reason === 'not-desktop');
  console.log('checks passed: ' + (n - bad));
  if (bad) { console.log('SMOKE_FAIL'); process.exit(1); }
  console.log('SMOKE_OK page answers knock v0.1');
})();
