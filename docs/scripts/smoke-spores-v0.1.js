#!/usr/bin/env node
// Smoke: spores v0.1 (docs/modules/spores.js). A spore wakes only at a crack and restores only a
// same-origin copy whose sha256 matches. It never clears or deletes anything.
// Runs a small fixture page in headless Chrome; it does not open app.html in a browser.
//   node docs/scripts/smoke-spores-v0.1.js        (FL_CHROME=/path/to/chrome to choose Chrome)
'use strict';
var fs = require('fs');
var os = require('os');
var path = require('path');
var http = require('http');
var crypto = require('crypto');
var cp = require('child_process');

var repo = path.join(__dirname, '..', '..');
var docs = path.join(repo, 'docs');
var modPath = path.join(docs, 'modules', 'spores.js');
var gen = path.join(repo, 'scripts', 'make-spores-manifest.js');
var passed = 0;
function ok(cond, msg) { if (!cond) { console.error('FAIL ' + msg); process.exit(1); } passed++; console.log('ok ' + msg); }
function md5(f) { return crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex'); }

// ---------- A. what the module may and may not do ----------
var src = fs.readFileSync(modPath, 'utf8');
var code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
['.clear(', 'removeItem', 'caches.delete', 'caches.open', '.put(', 'unregister', 'deleteDatabase', 'indexedDB', 'sessionStorage', 'eval(', 'new Function'].forEach(function (bad) {
  ok(code.indexOf(bad) === -1, 'spores.js never uses ' + bad);
});
ok((code.match(/setItem\(/g) || []).length === 2, 'spores.js writes only two keys (its receipts and its own off switch)');
ok(/RECEIPT_KEY = 'fl_sporeReceipts'/.test(code) && /OFF_KEY = 'fl_spores'/.test(code), 'the two keys are fl_sporeReceipts and fl_spores');
ok(!/fetch\(\s*['"]https?:/.test(code), 'spores.js never fetches a fixed outside address');
var api = require(modPath);
ok(api.version === 'v-spores-v0.1', 'version marker v-spores-v0.1');
ok(api._normalizeSrc('./modules/a.js?v=3#x') === 'modules/a.js', 'src is normalized');
ok(api._isThirdParty('https://unpkg.com/x.js') && api._isThirdParty('//cdn.example/x.js') && !api._isThirdParty('modules/x.js'), 'third-party scripts are told apart');

// ---------- B. the manifest ----------
var chk = cp.spawnSync(process.execPath, [gen, '--check'], { encoding: 'utf8' });
ok(chk.status === 0, 'docs/spores-manifest.json matches the files app.html loads (' + (chk.stdout || chk.stderr).trim() + ')');
var man = JSON.parse(fs.readFileSync(path.join(docs, 'spores-manifest.json'), 'utf8'));
var files = man.pages['app.html'].files;
ok(Object.keys(files).length > 40, 'app.html manifest lists ' + Object.keys(files).length + ' files');
ok(!files['modules/spores.js'], 'spores.js does not list itself');
ok(Object.keys(files).every(function (k) { return !/^(https?:)?\/\//.test(k); }), 'no third-party file is listed');
var k0 = Object.keys(files)[0];
ok(files[k0].sha256 === crypto.createHash('sha256').update(fs.readFileSync(path.join(docs, k0))).digest('hex'), 'a listed fingerprint is the real sha256 of ' + k0);

var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fl-spores-'));
function cleanup() { try { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch (e) {} }
process.on('exit', cleanup);
fs.mkdirSync(path.join(tmp, 'modules'));
fs.writeFileSync(path.join(tmp, 'gone.html'), '<script src="modules/not-here.js"></script>');
var miss = cp.spawnSync(process.execPath, [gen, '--docs', tmp, '--page', 'gone.html', '--out', path.join(tmp, 'm.json')], { encoding: 'utf8' });
ok(miss.status === 2 && /not-here\.js/.test(miss.stderr), 'a page that loads a missing file stops the build and names it (the 5.8.2 kind of crack)');

// ---------- C. the locked page ----------
var app = fs.readFileSync(path.join(docs, 'app.html'), 'utf8');
var tags = app.match(/<script src="modules\/spores\.js"><\/script>/g) || [];
ok(tags.length === 1, 'app.html loads spores.js once');
ok(app.indexOf('<script src="modules/spores.js">') < app.indexOf('<script src="lib/peerjs.min.js"'), 'spores.js loads before the other scripts');
ok(!/<script src="modules\/spores\.js"[^>]*\b(defer|async)\b/.test(app), 'spores.js is not deferred, so it listens first');
ok(md5(path.join(docs, 'app.html')) === md5(path.join(repo, 'index.html')), 'index.html mirrors docs/app.html');
var locks = JSON.parse(fs.readFileSync(path.join(docs, 'library', 'LOCK_MANIFEST_v0.1.json'), 'utf8')).files;
['docs/app.html', 'index.html'].forEach(function (rel) {
  var pins = locks[rel].map(function (r) { return r.md5; });
  ok(pins.indexOf(md5(path.join(repo, rel))) >= 0, rel + ' md5 has a LOCK_MANIFEST row');
});

// ---------- D. real Chrome on a fixture page ----------
var chrome = process.env.FL_CHROME || ['/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(function (p) { return fs.existsSync(p); })[0];
if (!chrome) { console.log('skip: no Chrome found for the browser part (' + passed + ' passed)'); process.exit(0); }

fs.copyFileSync(modPath, path.join(tmp, 'modules', 'spores.js'));
var A = 'window.A_RAN = (window.A_RAN || 0) + 1;\n';
var B = 'window.B_RAN = 1;\n';
fs.writeFileSync(path.join(tmp, 'modules', 'a.js'), A);
fs.writeFileSync(path.join(tmp, 'modules', 'b.js'), B);
fs.writeFileSync(path.join(tmp, 'modules', 'c.js'), 'window.C_RAN = 1;\n');
var page = [
  '<!DOCTYPE html><html><head><meta charset="utf-8">',
  '<script src="modules/spores.js"></script>',
  '<script src="modules/a.js" defer></script>',
  '<script src="modules/b.js" defer></script>',
  '<script src="modules/c.js" defer></script>',
  '</head><body><pre id="out">waiting</pre><script>',
  'var calls = 0, loopCalls = 0;',
  'var calm = document.createElement("i"); document.body.appendChild(calm);',
  'new MutationObserver(function () { calls++; }).observe(calm, { attributes: true });',
  'calm.setAttribute("x", "1");',
  'var hot = document.createElement("b"); document.body.appendChild(hot);',
  'var mo = new MutationObserver(function () { loopCalls++; hot.setAttribute("n", String(loopCalls)); });',
  'mo.observe(hot, { attributes: true });',
  'function kick() { hot.setAttribute("n", "start" + Math.random()); }',
  'if (!/spores=off/.test(location.search)) { setTimeout(kick, 300); setTimeout(kick, 3000); setTimeout(kick, 5700); setTimeout(kick, 8400); }',
  'setTimeout(function () {',
  '  var S = window.FLSpores || {};',
  '  document.getElementById("out").textContent = JSON.stringify({ off: S.off, A: window.A_RAN || 0, B: window.B_RAN || 0, C: window.C_RAN || 0,',
  '    calls: calls, loopCalls: loopCalls, isGuarded: !!MutationObserver.__spores, alive: true,',
  '    receipts: S.receipts ? S.receipts() : [], unsaved: S.unsaved ? S.unsaved() : "" });',
  '}, 11000);',
  '</script></body></html>'
].join('\n');
fs.writeFileSync(path.join(tmp, 'fixture.html'), page);
var g = cp.spawnSync(process.execPath, [gen, '--docs', tmp, '--page', 'fixture.html'], { encoding: 'utf8' });
ok(g.status === 0, 'fixture manifest written');

var hits = [];
var server = http.createServer(function (req, res) {
  var u = decodeURIComponent(req.url || '/');
  hits.push(u);
  var p = u.split('?')[0];
  var busted = /[?&]spore=/.test(u);
  var type = /\.html$/.test(p) ? 'text/html' : /\.json$/.test(p) ? 'application/json' : 'text/javascript';
  if (p === '/modules/a.js' && !busted) { res.writeHead(404); return res.end('gone'); }   // a crack: a.js does not load
  if (p === '/modules/b.js' && !busted) { res.writeHead(404); return res.end('gone'); }   // b.js does not load ...
  if (p === '/modules/b.js' && busted) { res.writeHead(200, { 'Content-Type': type }); return res.end('window.B_RAN = "forged";\n'); } // ... and its copy is wrong
  var f = path.join(tmp, p);
  if (!f.startsWith(tmp) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(fs.readFileSync(f));
});

// Chrome is driven over its DevTools port (Node's built-in WebSocket), one fresh profile per run.
function runChrome(url) {
  return new Promise(function (resolve) {
    var prof = fs.mkdtempSync(path.join(tmp, 'prof-'));
    var proc = cp.spawn(chrome, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--disable-extensions',
      '--user-data-dir=' + prof, '--remote-debugging-port=0', 'about:blank'], { stdio: 'ignore' });
    var done = false, ws = null, id = 0, waiters = {};
    function finish(v) { if (done) return; done = true; try { ws && ws.close(); } catch (e) {} try { proc.kill('SIGKILL'); } catch (e) {} resolve(v); }
    var stop = setTimeout(function () { console.error('chrome run timed out'); finish(null); }, 60000);
    function send(method, params) {
      return new Promise(function (res) { var n = ++id; waiters[n] = res; ws.send(JSON.stringify({ id: n, method: method, params: params || {} })); });
    }
    (function waitPort(tries) {
      var f = path.join(prof, 'DevToolsActivePort');
      if (!fs.existsSync(f)) { if (tries > 100) return finish(null); return setTimeout(function () { waitPort(tries + 1); }, 100); }
      var port = fs.readFileSync(f, 'utf8').split('\n')[0];
      http.get('http://127.0.0.1:' + port + '/json/list', function (r) {
        var body = ''; r.on('data', function (d) { body += d; }); r.on('end', function () {
          var pg = JSON.parse(body).filter(function (t) { return t.type === 'page'; })[0];
          ws = new WebSocket(pg.webSocketDebuggerUrl);
          ws.onmessage = function (ev) { var m = JSON.parse(ev.data); if (m.id && waiters[m.id]) { waiters[m.id](m.result); delete waiters[m.id]; } };
          ws.onopen = function () {
            send('Page.navigate', { url: url }).then(function poll() {
              send('Runtime.evaluate', { expression: 'var o = document.getElementById("out"); o ? o.textContent : "waiting"', returnByValue: true }).then(function (r) {
                var t = r && r.result && r.result.value;
                if (t && t !== 'waiting') { clearTimeout(stop); try { finish(JSON.parse(t)); } catch (e) { finish(null); } }
                else setTimeout(poll, 500);
              });
            });
          };
        });
      }).on('error', function () { finish(null); });
    })(0);
  });
}

server.listen(0, '127.0.0.1', async function () {
  var base = 'http://127.0.0.1:' + server.address().port + '/fixture.html';
  var on = await runChrome(base);
  ok(on && on.alive, 'the page did not freeze (a self-feeding observer would hang it without the watchdog)');
  ok(on.A === 1, 'a.js failed to load and was restored from the same origin after its sha256 matched (ran once)');
  ok(on.B === 0, 'b.js copy had the wrong sha256 and was refused (never ran)');
  ok(on.C === 1, 'c.js loaded normally and was left alone');
  ok(on.calls === 1, 'a calm observer still works as before (1 call)');
  var kinds = on.receipts.map(function (r) { return r.kind + ':' + (r.file || '').replace(/^.*\//, ''); });
  console.log('   receipts: ' + kinds.join(' | '));
  var ra = on.receipts.filter(function (r) { return r.file === 'modules/a.js'; });
  ok(ra.length === 1 && ra[0].kind === 'restored' && ra[0].ok && ra[0].from === 'same-origin', 'one receipt says a.js was restored from same-origin');
  var rb = on.receipts.filter(function (r) { return r.file === 'modules/b.js'; });
  ok(rb.length === 1 && rb[0].kind === 'still-broken' && !rb[0].ok, 'one receipt says b.js is still broken (no matching copy)');
  var loops = on.receipts.filter(function (r) { return /^loop-/.test(r.kind); }).map(function (r) { return r.kind; });
  ok(loops.join(',') === 'loop-paused,loop-paused,loop-left-paused', 'the looping observer was paused, resumed, and left paused on the third trip (' + loops.join(',') + ')');
  ok(on.loopCalls <= 3 * (api._limits.loop + 1), 'the loop never ran past the limit (' + on.loopCalls + ' calls over 4 kicks)');
  ok(on.receipts.every(function (r, i) { return r.n === i + 1; }), 'receipts are numbered in order with no gaps');
  ok(on.receipts.slice(1).every(function (r) { return /^[0-9a-f]{64}$/.test(r.prev); }), 'each receipt carries the sha256 of the one before it');
  ok(!on.unsaved, 'receipts were saved');
  ok(hits.some(function (h) { return /spores-manifest\.json\?spore=/.test(h); }), 'the manifest was fetched only after a crack, from the same origin');

  var off = await runChrome(base + '?spores=off');
  ok(off && off.off === true, '?spores=off turns spores off');
  ok(off.A === 0 && off.receipts.length === 0 && !off.isGuarded, 'with spores off nothing is restored, wrapped or written');
  ok(off.alive && off.calls === 1, 'with spores off the calm observer works the same (the loop is not kicked there: unguarded it would hang the page)');

  server.close();
  console.log('PASS smoke-spores-v0.1 (' + passed + ' checks)');
  setTimeout(function () { process.exit(0); }, 1000);   // let Chrome let go of its profile before cleanup
});
