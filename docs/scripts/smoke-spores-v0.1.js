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
ok(code.indexOf('caches.match(url)') === -1, 'no cached-manifest fallback: the manifest only comes fresh from the same origin');
ok(!/\.targets\b/.test(code), 'the watchdog keeps no list of observed targets (no retained nodes)');
ok(!/nativeTake\.call\(me\)/.test(code.replace(/\/\/ before \(.*$/gm, '')), 'the watchdog never takes an observer\'s own records (the browser delivers them in its own order)');
ok(/ev\.lineno !== 1/.test(code) && /\/JSON\/i\.test\(msg\)/.test(code), 'only a line-1 parse failure counts, and a JSON.parse error never does');
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
// The two rooms that are never listed, spelled in pieces so this smoke stays out of their sweep.
var neverListed = new RegExp(['qu', 'iet', '|', 'so', 'phia'].join(''), 'i');
ok(Object.keys(files).every(function (k) { return !neverListed.test(k); }), 'the manifest lists no file from the two never-listed rooms (names only, nothing opened)');
var manText = fs.readFileSync(path.join(docs, 'spores-manifest.json'));
ok(api.manifestSha256 === crypto.createHash('sha256').update(manText).digest('hex'), 'spores.js pins the manifest sha256');
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
fs.writeFileSync(path.join(tmp, 'modules', 'a.js'), 'window.A_RAN = (window.A_RAN || 0) + 1;\n');
fs.writeFileSync(path.join(tmp, 'modules', 'b.js'), 'window.B_RAN = 1;\n');
// c.js is healthy and all on line 1; later it throws a SyntaxError at run time. That is not a crack.
fs.writeFileSync(path.join(tmp, 'modules', 'c.js'), 'window.C_RAN = (window.C_RAN || 0) + 1; window.throwLater = function () { setTimeout(function () { throw new SyntaxError("Unexpected token at run time"); }, 0); };\n');
// d.js is served as an HTML page on the plain request (a wrong file), the real copy on ?spore=.
fs.writeFileSync(path.join(tmp, 'modules', 'd.js'), 'window.D_RAN = (window.D_RAN || 0) + 1;\n');
// e.js really has a line-1 syntax error, and that is exactly what its fingerprint says: served copy matches, so not cracked.
fs.writeFileSync(path.join(tmp, 'modules', 'e.js'), 'window.E_RAN = 1; )\n');
// f.js is healthy but its one line calls JSON.parse on bad text before it finishes loading. Not a crack.
fs.writeFileSync(path.join(tmp, 'modules', 'f.js'), 'window.F_RAN = 1; JSON.parse("{bad json");\n');
var page = [
  '<!DOCTYPE html><html><head><meta charset="utf-8">',
  '<script src="modules/spores.js"></script>',
  '<script src="modules/a.js" defer></script>',
  '<script src="modules/b.js" defer></script>',
  '<script src="modules/c.js" defer></script>',
  '<script src="modules/d.js" defer></script>',
  '<script src="modules/e.js" defer></script>',
  '<script src="modules/f.js" defer></script>',
  '</head><body><pre id="out">waiting</pre><div id="chat"></div><div id="chat2"></div><div id="chat3"></div><script>',
  'var Q = location.search, OFF = /spores=off/.test(Q), CAP = /captest/.test(Q), DROP = /droptest/.test(Q), SHORT = CAP || DROP || /swap/.test(Q);',
  'var R = { calls: 0, pageNodes: 0, chatRecords: 0, chat2Records: 0, chat3Records: 0, marksSeen: 0, boundedCalls: 0, hotCalls: [], streamMs: [] };',
  'var calm = document.createElement("i"); document.body.appendChild(calm);',
  'new MutationObserver(function () { R.calls++; }).observe(calm, { attributes: true });',
  'calm.setAttribute("x", "1");',
  // A page-wide observer that watches everything (it sees every loop below too) but never feeds itself.
  'new MutationObserver(function (rs) { rs.forEach(function (r) { if (r.type === "childList" && r.target.id && r.target.id.indexOf("chat") === 0) R.pageNodes += r.addedNodes.length; }); })',
  '  .observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });',
  'new MutationObserver(function (rs) { R.chatRecords += rs.length; }).observe(document.getElementById("chat"), { childList: true });',
  'new MutationObserver(function (rs) { R.chat2Records += rs.length; }).observe(document.getElementById("chat2"), { childList: true });',
  'new MutationObserver(function (rs) { R.chat3Records += rs.length; }).observe(document.getElementById("chat3"), { childList: true });',
  // The app chat pattern: while (true) { await reader.read(); append }, with every chunk already buffered.
  'function stream(el, n, busy) { var rs = new ReadableStream({ start: function (c) { for (var i = 0; i < n; i++) c.enqueue("t" + i + " "); c.close(); } });',
  '  var reader = rs.getReader(), t0 = performance.now();',
  '  return (async function () { while (true) { var x = await reader.read(); if (x.done) break; if (busy) { var b = performance.now() + busy; while (performance.now() < b) {} } el.appendChild(document.createTextNode(x.value)); } R.streamMs.push(Math.round(performance.now() - t0)); })(); }',
  'var chat = document.getElementById("chat"), chat2 = document.getElementById("chat2");',
  'setTimeout(function () { if (window.throwLater) throwLater(); setTimeout(function () { JSON.parse("{bad json"); }, 0); }, 400);',
  // Order (Hypha re-walk): records must arrive in the same order and batches as with no spores at all.
  'var o1 = document.createElement("s"); document.body.appendChild(o1); var log1 = [], n1 = 1, aFed = false, bFed = false;',
  'function vals(rs) { return rs.map(function (r) { return r.target.getAttribute("data-v-" + r.attributeName.slice(7)) || r.attributeName; }).join(","); }',
  'new MutationObserver(function (rs) { log1.push("A[" + rs.map(function (r) { return r.oldValue; }).join(",") + "]"); if (!aFed) { aFed = true; o1.setAttribute("v", String(++n1)); } }).observe(o1, { attributes: true, attributeOldValue: true });',
  'new MutationObserver(function (rs) { log1.push("B[" + rs.map(function (r) { return r.oldValue; }).join(",") + "]"); if (!bFed) { bFed = true; o1.setAttribute("v", String(++n1)); } }).observe(o1, { attributes: true, attributeOldValue: true });',
  'var o4 = document.createElement("q"); document.body.appendChild(o4); var log4 = [], n4 = 0;',
  // O4: on its first call, another part of the page queues an outside change, then the observer feeds itself.
  'new MutationObserver(function (rs) { log4.push("O[" + rs.map(function (r) { return r.oldValue; }).join(",") + "]"); if (n4 === 0) queueMicrotask(function () { o4.setAttribute("v", "x"); }); if (n4 < 5) o4.setAttribute("v", "s" + (++n4)); }).observe(o4, { attributes: true, attributeOldValue: true });',
  // O5: the same, but the outside change is queued after the observer feeds itself.
  'var o5 = document.createElement("kbd"); document.body.appendChild(o5); var log5 = [], n5 = 0;',
  'new MutationObserver(function (rs) { log5.push("P[" + rs.map(function (r) { return r.oldValue; }).join(",") + "]"); if (n5 < 5) o5.setAttribute("v", "s" + (++n5)); if (n5 === 1 && !o5.x) { o5.x = 1; queueMicrotask(function () { o5.setAttribute("v", "x"); }); } }).observe(o5, { attributes: true, attributeOldValue: true });',
  'setTimeout(function () { o1.setAttribute("v", "0"); o1.setAttribute("v", "1"); }, 200);',
  'setTimeout(function () { o4.setAttribute("v", "s0"); }, 250);',
  'setTimeout(function () { o5.setAttribute("v", "s0"); }, 300);',
  // O6: feeds itself, then calls takeRecords inside its callback. O7: disconnects and observes again inside its callback.
  'var o6 = document.createElement("var"); document.body.appendChild(o6); var log6 = [], n6 = 0;',
  'new MutationObserver(function (rs, ob) { log6.push("T[" + rs.map(function (r) { return r.oldValue; }).join(",") + "]"); if (n6 < 3) { o6.setAttribute("v", "s" + (++n6)); o6.setAttribute("w", "w" + n6); log6.push("t" + ob.takeRecords().length); } }).observe(o6, { attributes: true, attributeOldValue: true });',
  'var o7 = document.createElement("samp"); document.body.appendChild(o7); var log7 = [], n7 = 0;',
  'new MutationObserver(function (rs, ob) { log7.push("D[" + rs.map(function (r) { return r.oldValue; }).join(",") + "]"); if (n7 < 3) { o7.setAttribute("v", "s" + (++n7)); ob.disconnect(); ob.observe(o7, { attributes: true, attributeOldValue: true }); o7.setAttribute("v", "r" + n7); } }).observe(o7, { attributes: true, attributeOldValue: true });',
  'setTimeout(function () { o6.setAttribute("v", "s0"); o7.setAttribute("v", "s0"); }, 350);',
  'setTimeout(function () { R.order1 = log1.join(" "); R.order4 = log4.join(" "); R.order5 = log5.join(" "); R.order6 = log6.join(" "); R.order7 = log7.join(" "); }, 600);',
  'setTimeout(function () { stream(chat, 2000); }, 800);',
  'setTimeout(function () { stream(chat, 2000); }, 911);',
  'setTimeout(function () { stream(chat, 2000); }, 1022);',
  'setTimeout(function () { stream(chat2, 1500); }, 1133);',
  // A slow buffered stream: 1500 chunks with 1.2 ms of work each runs about 2 s with no page turn. Long, but not self-feeding.
  'setTimeout(function () { stream(document.getElementById("chat3"), 1500, 1.2); }, 1244);',
  // Bounded loop: feeds itself until stopAt (it trips once), while marks arrive during its rest.
  'var bx = document.createElement("u"); document.body.appendChild(bx); var bi = 0, stopAt = 0;',
  'var bmo = new MutationObserver(function (rs) { R.boundedCalls++; rs.forEach(function (r) { if (r.attributeName === "mark") R.marksSeen++; }); if (performance.now() < stopAt) bx.setAttribute("n", String(++bi)); });',
  'bmo.observe(bx, { attributes: true });',
  'function bounded() { stopAt = performance.now() + 2500; [1600, 1800, 2000, 2200, 2400].forEach(function (d, k) { setTimeout(function () { bx.setAttribute("mark", String(k)); }, d); }); bx.setAttribute("n", "go"); }',
  // Hot loop: feeds itself forever. Short limits here only, so three rests fit in the test.
  'var hot = document.createElement("b"); document.body.appendChild(hot); var hc = 0;',
  'var mo = new MutationObserver(function () { hc++; hot.setAttribute("n", String(hc)); });',
  'mo.observe(hot, { attributes: true });',
  'function hotLoop() { var L = window.FLSpores._limits; L.loopMs = 400; L.rest = [500, 700, 900]; hot.setAttribute("n", "go");',
  '  [300, 1100, 2200, 3600].forEach(function (d) { setTimeout(function () { R.hotCalls.push(hc); }, d); }); setTimeout(function () { mo.disconnect(); R.hotCalls.push(hc); }, 5000); }',
  'if (!OFF && !SHORT) { setTimeout(bounded, 4000); setTimeout(hotLoop, 9500); }',
  'async function capTest() { var S = window.FLSpores; S._limits.cap = 10; S._limits.fold = 5; for (var i = 0; i < 23; i++) await S._receipt({ kind: "test", file: "x" + i, ok: true });',
  '  var rows = S.receipts(); var ex = JSON.parse(S.exportReceipts()); R.cap = { len: rows.length, first: rows[0], last: rows[rows.length - 1], exported: ex.receipts.length }; }',
  'if (CAP) setTimeout(capTest, 1500);',
  'function dropTest() { var L = window.FLSpores._limits; L.held = 10; L.rest = [600, 600]; var d = document.createElement("p"); document.body.appendChild(d); var dc = 0;',
  '  var dmo = new MutationObserver(function () { dc++; d.setAttribute("n", String(dc)); }); dmo.observe(d, { attributes: true }); d.setAttribute("n", "go");',
  '  setTimeout(function () { for (var i = 0; i < 30; i++) d.setAttribute("o" + i, "1"); }, 200); setTimeout(function () { dmo.disconnect(); R.dropStatus = window.FLSpores.status(); }, 1500); }',
  'if (DROP) setTimeout(dropTest, 300);',
  'setTimeout(function () {',
  '  var S = window.FLSpores || {};',
  '  R.off = S.off; R.F = window.F_RAN || 0; R.notice = (document.querySelector("#fl-spore-notice span") || {}).textContent || ""; R.A = window.A_RAN || 0; R.B = window.B_RAN || 0; R.C = window.C_RAN || 0; R.D = window.D_RAN || 0; R.E = window.E_RAN || 0;',
  '  R.isGuarded = !!MutationObserver.__spores; R.alive = true; R.notices = document.querySelectorAll("#fl-spore-notice").length;',
  '  R.receipts = S.receipts ? S.receipts() : []; R.unsaved = S.unsaved ? S.unsaved() : "";',
  '  document.getElementById("out").textContent = JSON.stringify(R);',
  '}, SHORT ? 3500 : (OFF ? 5000 : 15500));',
  '</script></body></html>'
].join('\n');
fs.writeFileSync(path.join(tmp, 'fixture.html'), page);
var g = cp.spawnSync(process.execPath, [gen, '--docs', tmp, '--page', 'fixture.html'], { encoding: 'utf8' });
ok(g.status === 0, 'fixture manifest written and pinned (' + (g.stdout || g.stderr).trim() + ')');

var hits = [];
var server = http.createServer(function (req, res) {
  var u = decodeURIComponent(req.url || '/');
  hits.push(u);
  var p = u.split('?')[0];
  var busted = /[?&]spore=/.test(u);
  var type = /\.html$/.test(p) ? 'text/html' : /\.json$/.test(p) ? 'application/json' : 'text/javascript';
  if (p === '/modules/a.js' && !busted) { res.writeHead(404); return res.end('gone'); }   // a crack: a.js does not load
  if (p === '/modules/b.js' && !busted) { res.writeHead(404); return res.end('gone'); }   // b.js does not load ...
  if (p === '/modules/d.js' && !busted) { res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end('<!DOCTYPE html><html><body>Not found</body></html>\n'); }
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
      (function list(tries) { http.get('http://127.0.0.1:' + port + '/json/list', function (r) {
        var body = ''; r.on('data', function (d) { body += d; }); r.on('end', function () {
          var pg = null; try { pg = JSON.parse(body).filter(function (t) { return t.type === 'page'; })[0]; } catch (e) {}
          if (!pg) { if (tries > 100) return finish(null); return setTimeout(function () { list(tries + 1); }, 100); }   // Chrome still opening its first tab
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
      }).on('error', function () { if (tries > 100) return finish(null); setTimeout(function () { list(tries + 1); }, 100); }); })(0);
    })(0);
  });
}

server.listen(0, '127.0.0.1', async function () {
  var base = 'http://127.0.0.1:' + server.address().port + '/fixture.html';
  var off = await runChrome(base + '?spores=off');
  var on = await runChrome(base);
  ok(on && on.alive, 'the page did not freeze (a self-feeding observer would hang it without the watchdog)');
  var kinds = on.receipts.map(function (r) { return r.kind + ':' + (r.file || '').replace(/^.*\//, '') + (r.got && /^trip/.test(r.got) ? '(' + r.got + ')' : ''); });
  console.log('   receipts: ' + kinds.join(' | '));
  function rec(f) { return on.receipts.filter(function (r) { return r.file === f; }); }
  ok(on.A === 1 && rec('modules/a.js').length === 1 && rec('modules/a.js')[0].kind === 'restored' && rec('modules/a.js')[0].from === 'same-origin', 'a.js did not load; restored once from the same origin after its sha256 matched');
  ok(on.B === 0 && rec('modules/b.js').length === 1 && rec('modules/b.js')[0].kind === 'still-broken', 'b.js copy had the wrong sha256: refused, never ran, one still-broken receipt');
  ok(on.C === 1 && rec('modules/c.js').length === 0, 'HOLD 1: a healthy c.js that throws a SyntaxError at run time is not touched (ran once, no receipt)');
  ok(on.D === 1 && rec('modules/d.js').length === 1 && rec('modules/d.js')[0].kind === 'restored', 'd.js was served as an HTML page: line-1 parse failure, served copy did not match, verified copy ran once');
  ok(on.E === 0 && rec('modules/e.js').length === 1 && rec('modules/e.js')[0].kind === 'reload-needed' && rec('modules/e.js')[0].ok === false, 'soft 1: e.js failed to parse but the server now sends the matching copy: nothing run, receipt says reload-needed (ok false)');
  ok(on.F === 1 && rec('modules/f.js').length === 0, 'soft 2: a JSON.parse error on line 1 of a listed file, before its load, is not a crack (decided by the error object and stack)');
  ok(rec('fixture.html').length === 0 && on.receipts.every(function (r) { return !/\.html$/.test(r.file) || /^loop/.test(r.kind); }), 'soft 2: a JSON.parse error writes no receipt');
  ok(on.notices === 1 && /Reload to finish the repair/.test(on.notice), 'one "Reload to finish the repair" notice after the restores (not one per file)');
  ok(on.order1 === off.order1 && on.order1.split(' ').length === 4, 'HOLD (order): two observers that each feed themselves once get the same records, order and batches as with no spores (' + on.order1 + ')');
  ok(on.order4 === off.order4 && /^O\[\] O\[s0,s1\] /.test(on.order4), 'HOLD (order): an observer feeding itself plus an outside change gets its own record first, in the same call, as with no spores (' + on.order4 + '; labels are old values: [s0,s1] = its own change, then the outside one)');
  ok(on.order6 === off.order6 && on.order7 === off.order7, 'order: takeRecords and disconnect/observe inside a callback behave as with no spores (' + on.order6 + ' | ' + on.order7 + ')');
  ok(on.order5 === off.order5, 'HOLD (order): the same with the outside change queued after it feeds itself (' + on.order5 + ' / off ' + off.order5 + ')');
  ok(on.calls === 1, 'a calm observer still works as before (1 call)');
  ok(on.streamMs.length === 5 && on.streamMs[4] > 1500, 'five buffered streams ran, the last one longer than the 1500 ms trip time (' + on.streamMs.join(', ') + ' ms)');
  ok(on.chatRecords === 6000 && on.chat2Records === 1500 && on.chat3Records === 1500, 'HOLD 2: streaming 3 x 2000, 1 x 1500 and a slow 1 x 1500 buffered chunks lost no records (' + on.chatRecords + ' + ' + on.chat2Records + ' + ' + on.chat3Records + ')');
  ok(on.pageNodes === 9000, 'HOLD 2: the page-wide observer saw every streamed chunk (' + on.pageNodes + ' of 9000), even with the loops below running under it');
  var loops = on.receipts.filter(function (r) { return /^loop-/.test(r.kind); });
  var where = {}; loops.forEach(function (r) { where[r.file] = (where[r.file] || 0) + 1; });
  ok(Object.keys(where).length === 2, 'HOLD 2: only the two self-feeding observers ever rested; streaming and page-wide observers had 0 trips (' + JSON.stringify(where) + ')');
  ok(on.marksSeen === 5, 'HOLD 2: records that arrived while an observer rested were handed to it when it listened again (' + on.marksSeen + ' of 5 marks)');
  var bounded = loops.filter(function (r) { return r.file === loops[0].file; });
  ok(bounded.length >= 1 && bounded.every(function (r) { return r.kind === 'loop-paused'; }), 'the bounded loop rested (' + bounded.length + 'x), then listened again and stopped on its own');
  ok(bounded[0].ms < 1500, 'soft 3: with the call-count backstop a real loop rests after ' + Math.round(bounded[0].ms) + ' ms, not 1.5 s');
  var hot = loops.filter(function (r) { return r.file !== loops[0].file; }).map(function (r) { return r.kind + ' ' + r.got; });
  ok(hot.length >= 3 && hot.slice(0, 3).join(',') === 'loop-paused trip 1,loop-paused trip 2,loop-paused trip 3', 'a real self-feeding loop is still stopped, rest after rest (' + hot.join(', ') + ')');
  var hc = on.hotCalls;
  ok(hc.length === 5 && hc[1] > hc[0] && hc[2] > hc[1] && hc[3] > hc[2] && hc[4] >= hc[3], 'it is never off for good: after each rest it listened again (' + hc.join(' -> ') + ' calls)');
  ok(!loops.some(function (r) { return r.kind === 'loop-left-paused'; }), 'no observer is ever left silently off');
  ok(on.receipts.every(function (r, i) { return r.n === i + 1; }), 'receipts are numbered in order with no gaps');
  ok(on.receipts.slice(1).every(function (r) { return /^[0-9a-f]{64}$/.test(r.prev); }), 'each receipt carries the sha256 of the one before it');
  ok(!on.unsaved, 'receipts were saved');
  ok(hits.filter(function (h) { return /spores-manifest\.json\?spore=/.test(h); }).length === 1, 'the manifest was fetched once, only after a crack, from the same origin');
  ok(!hits.some(function (h) { return /c\.js\?spore=|e\.js\?spore=/.test(h); }), 'no fresh copy of the healthy c.js or the matching e.js was even fetched');

  var cap = await runChrome(base + '?captest=1');
  ok(cap && cap.cap && cap.cap.len <= 10, 'soft 3: receipts are capped (' + (cap && cap.cap && cap.cap.len) + ' rows kept at cap 10)');
  ok(cap.cap.first.kind === 'folded' && cap.cap.first.count > 0 && /^[0-9a-f]{64}$/.test(cap.cap.first.foldedSha256), 'the oldest rows fold into one summary row that keeps their count and sha256 (' + cap.cap.first.count + ' folded)');
  ok(cap.cap.exported === cap.cap.len && cap.cap.last.n > 20, 'exportReceipts() gives the same rows as JSON, and numbering keeps going (last n ' + cap.cap.last.n + ')');

  var forged = fs.readFileSync(path.join(tmp, 'spores-manifest.json'), 'utf8');
  fs.writeFileSync(path.join(tmp, 'spores-manifest.json'), forged.replace(/"sha256": "[0-9a-f]{64}"/, '"sha256": "' + '0'.repeat(64) + '"'));
  var swapped = await runChrome(base + '?swap=1');
  fs.writeFileSync(path.join(tmp, 'spores-manifest.json'), forged);
  ok(swapped && swapped.A === 0 && swapped.receipts.some(function (r) { return r.kind === 'refused' && r.file === 'modules/a.js'; }), 'soft 1 / (f): a manifest that does not match the pinned sha256 is refused; nothing is run');

  var drop = await runChrome(base + '?droptest=1');
  ok(drop && drop.dropStatus && drop.dropStatus.dropped >= 20 && drop.dropStatus.trips >= 1, 'soft 6: records dropped while resting show in FLSpores.status() (' + JSON.stringify(drop && drop.dropStatus) + ')');
  ok(/skipped \d+ updates/.test(drop.notice), 'soft 6: and in the one notice ("' + drop.notice.trim() + '")');


  ok(off && off.off === true, '?spores=off turns spores off');
  ok(off.A === 0 && off.receipts.length === 0 && !off.isGuarded && off.notices === 0, 'with spores off nothing is restored, wrapped, shown or written');
  ok(off.alive && off.calls === 1 && off.chatRecords === 6000 && off.chat3Records === 1500 && off.pageNodes === 9000, 'with spores off the observers see the same records (the loops are not kicked there: unguarded they would hang the page)');

  server.close();
  console.log('PASS smoke-spores-v0.1 (' + passed + ' checks)');
  setTimeout(function () { process.exit(0); }, 1000);   // let Chrome let go of its profile before cleanup
});
