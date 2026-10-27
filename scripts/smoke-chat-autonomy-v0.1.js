#!/usr/bin/env node
// smoke-chat-autonomy-v0.1.js (MIT)
// Local only. Chrome via FL_CHROME. Playwright via FL_PLAYWRIGHT.
var fs = require('fs');
var path = require('path');
var http = require('http');
var crypto = require('crypto');

var root = path.join(__dirname, '..');
var port = 8927;

function fail(msg) {
  console.error('FAIL ' + msg);
  process.exit(1);
}

function md5(file) {
  return crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
}

function wireHits(hits) {
  return hits.filter(function (url) {
    return url.indexOf('blob:') !== 0 && url.indexOf('data:') !== 0;
  });
}

var locks = {
  'docs/sw.js': '91726cf2228b794f7585f79f61418d12',
  'sw.js': '91726cf2228b794f7585f79f61418d12',
  'docs/modules/fl-connect.js': 'aaff2bf1b037656989a9e1a89bb05908',
  'docs/modules/pool-knock.js': 'a0a72caad82c8e5cc34818d5e59eba2b',
  'docs/modules/fl-bridge.js': '3b5ef06849a142e50c78e7ba1e057980',
  'docs/modules/particle-clay.js': '2da32883c514e4ad2a3cd8571e7a7b15',
  'docs/modules/image-safety.js': '9bd70e5a367228a5c72fc08ab731c881',
  'docs/modules/clay-math.js': '144c33cdd9583c7e3d77f3cca6460bb1',
  'docs/modules/clay-forms.js': 'dd193fa7b519d4c2a011a346d7993e5a',
  'docs/modules/mind-workspace.js': 'f1c88664d3e99362e02c625defb241bc',
  'docs/modules/mind-make.js': 'cfe4da3729e83810791498160e70f823',
  'docs/modules/likeness-line.js': '798c67eef161b17c521228b7244d7376',
  'docs/modules/image-local.js': '6dc0e3dcc793d049a4e0c13455307987',
  'docs/modules/chat-scroll-release.js': '84fed10c603c9e89e9452ada564c8c65',
  'docs/modules/market-attach.js': '014083d3edc36680254f4485354a10a4',
  'docs/modules/garden-trainer.js': '8af3d065f611740000453a0ec8dd1e01',
  'docs/modules/propose.js': '2cb7f00cce74815a5b03c933bc902b18'
};

Object.keys(locks).forEach(function (rel) {
  var got = md5(path.join(root, rel));
  if (got !== locks[rel]) fail(rel + ' md5 ' + got);
});

var indexHtml = fs.readFileSync(path.join(root, 'index.html'));
var appHtml = fs.readFileSync(path.join(root, 'docs/app.html'));
if (!indexHtml.equals(appHtml)) fail('index mismatch');
var appText = appHtml.toString('utf8');
if (appText.indexOf('modules/chat-autonomy.js') === -1) fail('script missing');
if (appText.indexOf('_Searched the web for "') === -1) fail('search line missing');
if (appText.indexOf("localStorage.getItem('fl_searchEnabled')") === -1 && appText.indexOf('localStorage.getItem("fl_searchEnabled")') === -1) {
  fail('search key missing');
}

var modPath = path.join(root, 'docs/modules/chat-autonomy.js');
var mod = fs.readFileSync(modPath, 'utf8');
['innerHTML', 'eval(', 'new Function', 'confirm(', '\u2014', '&mdash;', 'Quiet Room', 'memory recall'].forEach(function (needle) {
  if (mod.indexOf(needle) !== -1) fail('module has ' + needle);
});
if (mod.indexOf('http://127.0.0.1:3141') === -1) fail('bridge host missing');
if (/https?:\/\/(?!127\.0\.0\.1:3141)/.test(mod)) fail('unexpected host');
if (mod.indexOf('/code/git') !== -1 || mod.indexOf('git push') !== -1) fail('module commits or pushes');
if (mod.indexOf('v-chat-autonomy-v0.1') === -1) fail('marker missing');

var pages = {};

function serve() {
  var docs = path.join(root, 'docs');
  var server = http.createServer(function (req, res) {
    var urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (pages[urlPath]) {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(pages[urlPath]);
      return;
    }
    if (urlPath === '/') urlPath = '/app.html';
    var file = path.normalize(path.join(docs, urlPath));
    if (file.indexOf(docs) !== 0) { res.statusCode = 403; res.end('no'); return; }
    fs.readFile(file, function (err, buf) {
      if (err) { res.statusCode = 404; res.end('missing'); return; }
      var type = 'text/html; charset=utf-8';
      if (urlPath.endsWith('.js')) type = 'text/javascript';
      else if (urlPath.endsWith('.css')) type = 'text/css';
      res.setHeader('content-type', type);
      res.end(buf);
    });
  });
  return new Promise(function (resolve) {
    server.listen(port, '127.0.0.1', function () { resolve(server); });
  });
}

function harness(base) {
  pages['/gc049.html'] = '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>html,body{margin:0;padding:0}#chatMessages{max-width:100%;overflow:auto}</style></head><body>' +
    '<div class="section-title chat-section-title"><span class="chat-title-main">Chat</span></div>' +
    '<div id="chatMessages"></div>' +
    '<div class="status-bar"><span id="statusText">Ready. Point at a box below, or Settings</span></div>' +
    '<div class="chat-input-row"><button id="sendBtn" type="button" style="min-height:44px">Send</button></div>' +
    '<button type="button" id="yesBtn" style="min-height:44px">Yes</button>' +
    '<div class="section" id="webSearchToggleSection"><p>Web Search</p>' +
    '<input type="checkbox" id="webSearchToggle"></div>' +
    '<script>' +
    'window.__tree = {};' +
    'window.__writes = [];' +
    'window.__proposals = [];' +
    'window.__consent = 0;' +
    'function memDir(node) {' +
    '  return {' +
    '    getDirectoryHandle: function (name, opts) {' +
    '      if (!node[name] || typeof node[name] === "string") {' +
    '        if (!(opts && opts.create)) { var err = new Error("missing"); err.name = "NotFoundError"; return Promise.reject(err); }' +
    '        node[name] = {};' +
    '      }' +
    '      return Promise.resolve(memDir(node[name]));' +
    '    },' +
    '    getFileHandle: function (name, opts) {' +
    '      if (typeof node[name] !== "string") {' +
    '        if (!(opts && opts.create)) { var err = new Error("missing"); err.name = "NotFoundError"; return Promise.reject(err); }' +
    '        node[name] = "";' +
    '      }' +
    '      return Promise.resolve({' +
    '        getFile: function () { return Promise.resolve({ text: function () { return Promise.resolve(node[name]); } }); },' +
    '        createWritable: function () {' +
    '          return Promise.resolve({' +
    '            write: function (c) { node[name] = String(c); return Promise.resolve(); },' +
    '            close: function () { return Promise.resolve(); }' +
    '          });' +
    '        }' +
    '      });' +
    '    }' +
    '  };' +
    '}' +
    'window.state = { workspaceDirHandle: memDir(window.__tree) };' +
    'window.saveFileToWorkspace = function (filePath, content) {' +
    '  window.__writes.push({ path: filePath, content: content });' +
    '  var parts = String(filePath).split("/").filter(Boolean);' +
    '  var node = window.__tree;' +
    '  var i;' +
    '  for (i = 0; i < parts.length - 1; i++) {' +
    '    if (!node[parts[i]] || typeof node[parts[i]] === "string") node[parts[i]] = {};' +
    '    node = node[parts[i]];' +
    '  }' +
    '  node[parts[parts.length - 1]] = String(content);' +
    '  return Promise.resolve(true);' +
    '};' +
    'window.FreeLattice = window.FreeLattice || {};' +
    'window.FLToolConsent = { requestConsent: function () { window.__consent += 1; return Promise.resolve(false); } };' +
    'window.FreeLattice.processToolAction = function (action) {' +
    '  return window.FLToolConsent.requestConsent({ tool: "propose", detail: action.path }).then(function (ok) {' +
    '    window.__proposals.push({ path: action.path, ok: ok });' +
    '    return ok ? "draft-line" : "denied";' +
    '  });' +
    '};' +
    'window.FLWorkspace = {' +
    '  strip: function (t) { return String(t).replace(/\\[FL[_\\\\s-]*WS\\\\s*:[\\\\s\\\\S]*?\\]/g, "").trim(); },' +
    '  consumeReply: function (t) { window.__ws = (window.__ws || 0) + 1; window.__wsLast = t; return { visible: "kept", stored: true }; }' +
    '};' +
    'window.__addFile = function (filePath, content, label) {' +
    '  var wrap = document.createElement("div");' +
    '  var header = document.createElement("div");' +
    '  header.textContent = "// FILE: " + filePath;' +
    '  var btn = document.createElement("button");' +
    '  btn.className = "save-to-workspace-btn";' +
    '  btn.textContent = label || "Save to Workspace";' +
    '  btn.addEventListener("click", function () { window.saveFileToWorkspace(filePath, content); });' +
    '  wrap.appendChild(header);' +
    '  wrap.appendChild(btn);' +
    '  document.getElementById("chatMessages").appendChild(wrap);' +
    '  return btn;' +
    '};' +
    '</script>' +
    '<script src="' + base + '/modules/propose.js" defer></script>' +
    '<script src="' + base + '/modules/chat-autonomy.js" defer></script>' +
    '</body></html>';
  return base + '/gc049.html';
}

function manyLines(n) {
  var out = [];
  var i;
  for (i = 0; i < n; i++) out.push('line ' + i);
  return out.join('\n');
}

(async function () {
  var server = await serve();
  var base = 'http://127.0.0.1:' + port;
  var pwPath = process.env.FL_PLAYWRIGHT || '/tmp/gc-pw-local/node_modules/playwright-core';
  var pw;
  try { pw = require(pwPath); }
  catch (e) { fail('local playwright-core missing'); }
  var chromePath = process.env.FL_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  var browser = await pw.chromium.launch({ executablePath: chromePath, headless: true });
  var version = browser.version();

  async function openHarness(width, height, scale) {
    var context = await browser.newContext({
      viewport: { width: width, height: height },
      deviceScaleFactor: scale || 1
    });
    var page = await context.newPage();
    var errors = [];
    var hits = [];
    page.on('pageerror', function (err) { errors.push(String(err)); });
    page.on('request', function (req) { hits.push(req.url()); });
    await page.goto(harness(base), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(function () {
      return window.FLChatAutonomy && window.FLPropose && window.FLPropose.applyUnifiedDiff && document.getElementById('flChatSearchToggle');
    }, null, { timeout: 15000 });
    return { page: page, context: context, errors: errors, hits: hits };
  }

  var box = await openHarness(1280, 800, 1);
  var page = box.page;
  var idle = await page.evaluate(function () {
    return {
      trust: window.FLChatAutonomy.trust(),
      asked: window.FLChatAutonomy.isAsked(),
      ask: document.querySelectorAll('[data-fl-autonomy="ask"]').length,
      n: window.FLChatAutonomy.LINE_N,
      small: window.FLChatAutonomy.classify({ before: 'a\n', content: 'a\nb\n' }).important,
      forty: window.FLChatAutonomy.classify({ before: '', content: Array(40).fill('x').join('\n') }).important,
      fortyone: window.FLChatAutonomy.classify({ before: '', content: Array(41).fill('x').join('\n') }).important,
      fresh: window.FLChatAutonomy.classify({ isNew: true, content: 'hi\n' }),
      gone: window.FLChatAutonomy.classify({ kind: 'delete', before: 'hi\n', content: '' })
    };
  });
  if (idle.trust !== 'auto' || idle.asked) fail('default trust ' + JSON.stringify(idle));
  if (idle.ask !== 0) fail('ask before a build');
  if (idle.n !== 40 || idle.small || idle.forty || !idle.fortyone) fail('line rule ' + JSON.stringify(idle));
  if (!idle.fresh.important || idle.fresh.reason !== 'new') fail('new file ' + JSON.stringify(idle.fresh));
  if (!idle.gone.important || idle.gone.reason !== 'delete') fail('delete ' + JSON.stringify(idle.gone));

  await page.evaluate(function () { window.__addFile('notes/hello.txt', 'hi\n'); });
  await page.waitForFunction(function () {
    return document.querySelector('[data-fl-autonomy="ask"]');
  }, null, { timeout: 5000 });
  var askText = await page.evaluate(function () {
    return document.querySelector('[data-fl-autonomy="ask"]').textContent;
  });
  ['A mind wants to change files on this device from chat.',
    'Build means write or update files here (local). Push to the net still asks every time.',
    'AI decides',
    'Applies local changes. You get a short receipt.',
    'Notify on big ones',
    'Applies, and pings you when a file is new, deleted, or large.',
    'I review each one',
    'Nothing applies until you tap Apply.',
    'You can change this later in Settings.'].forEach(function (line) {
    if (askText.indexOf(line) === -1) fail('ask missing ' + line);
  });
  var held = await page.evaluate(function () { return window.__writes.length; });
  if (held !== 0) fail('wrote before the choice');
  var heights = await page.evaluate(function () {
    var nodes = document.querySelectorAll('[data-fl-autonomy="ask"] button');
    var out = [];
    for (var i = 0; i < nodes.length; i++) out.push(Math.round(nodes[i].getBoundingClientRect().height));
    return out;
  });
  if (heights.length !== 3) fail('choice buttons ' + heights.length);
  heights.forEach(function (h) { if (h < 44) fail('choice height ' + h); });

  await page.click('[data-fl-autonomy="ask"] [data-trust="auto"]');
  await page.waitForFunction(function () {
    return window.__writes.length === 1 && document.querySelector('[data-fl-autonomy="receipt"]');
  }, null, { timeout: 5000 });
  var afterAuto = await page.evaluate(function () {
    return {
      asked: localStorage.getItem('fl_chatBuildTrustAsked'),
      trust: localStorage.getItem('fl_chatBuildTrust'),
      receipt: document.querySelector('[data-fl-autonomy="receipt"]').textContent,
      asks: document.querySelectorAll('[data-fl-autonomy="ask"]').length,
      body: window.__tree.notes && window.__tree.notes['hello.txt']
    };
  });
  if (afterAuto.asked !== 'true' || afterAuto.trust !== 'auto') fail('pick stored ' + JSON.stringify(afterAuto));
  if (afterAuto.receipt.indexOf('Built notes/hello.txt; tap to look') === -1) fail('receipt ' + afterAuto.receipt);
  if (afterAuto.asks !== 0) fail('ask stayed up');
  if (afterAuto.body !== 'hi\n') fail('file body ' + afterAuto.body);

  await page.evaluate(function () { window.__addFile('notes/next.txt', 'second\n'); });
  await page.waitForFunction(function () { return window.__writes.length === 2; }, null, { timeout: 5000 });
  var second = await page.evaluate(function () {
    return document.querySelectorAll('[data-fl-autonomy="ask"]').length;
  });
  if (second !== 0) fail('ask returned');

  await page.evaluate(function () {
    window.__ws = 0;
    window.FLWorkspace.consumeReply('[FL_WS: {"op":"write","title":"Today","text":"A note"}]');
  });
  await page.waitForFunction(function () {
    var rows = document.querySelectorAll('[data-fl-autonomy="receipt"]');
    var last = rows[rows.length - 1];
    return window.__ws === 1 && last && last.textContent.indexOf('Built Today; tap to look') !== -1;
  }, null, { timeout: 5000 });

  var beforePause = await page.evaluate(function () { return window.__writes.length; });
  await page.evaluate(function () {
    window.__flUserPaused = true;
    window.__addFile('notes/paused.txt', 'no\n');
  });
  await page.waitForTimeout(300);
  var pausedWrites = await page.evaluate(function () { return window.__writes.length; });
  if (pausedWrites !== beforePause) fail('pause wrote');
  await page.evaluate(function () { window.__flUserPaused = false; });

  await page.evaluate(function () { window.__addFile('notes/remote.txt', 'no\n', 'Stage for GitHub'); });
  await page.waitForTimeout(300);
  var ghWrites = await page.evaluate(function () { return window.__writes.length; });
  if (ghWrites !== beforePause) fail('github staged itself');

  await page.click('#flChatSearchToggle');
  var searchOff = await page.evaluate(function () {
    var live = document.getElementById('flChatSearchLive');
    return {
      key: localStorage.getItem('fl_searchEnabled'),
      text: document.getElementById('flChatSearchToggle').textContent,
      hidden: live.hasAttribute('hidden'),
      box: document.getElementById('webSearchToggle').checked
    };
  });
  if (searchOff.key !== 'false' || searchOff.text !== 'Search off' || !searchOff.hidden || searchOff.box) fail('search off ' + JSON.stringify(searchOff));
  await page.click('#flChatSearchToggle');
  var searchOn = await page.evaluate(function () {
    var live = document.getElementById('flChatSearchLive');
    return {
      key: localStorage.getItem('fl_searchEnabled'),
      text: document.getElementById('flChatSearchToggle').textContent,
      hidden: live.hasAttribute('hidden')
    };
  });
  if (searchOn.key !== null || searchOn.text !== 'Search on' || searchOn.hidden) fail('search on ' + JSON.stringify(searchOn));

  var settings = await page.evaluate(function () {
    var section = document.getElementById('flChatBuildTrustSection');
    var note = document.getElementById('flChatBuildDisclaimer');
    var buttons = section ? section.querySelectorAll('button') : [];
    var heights = [];
    for (var i = 0; i < buttons.length; i++) heights.push(Math.round(buttons[i].getBoundingClientRect().height));
    return {
      text: section ? section.textContent : '',
      note: note ? note.textContent : '',
      shown: !!(note && note.getClientRects().length),
      heights: heights
    };
  });
  if (settings.text.indexOf('AI decides') === -1 || settings.text.indexOf('Notify on big ones') === -1 || settings.text.indexOf('I review each one') === -1) {
    fail('settings labels ' + settings.text);
  }
  if (settings.note.indexOf('Local builds can change files on this device') === -1) fail('disclaimer');
  if (!settings.shown) fail('disclaimer hidden');
  settings.heights.forEach(function (h) { if (h < 44) fail('settings height ' + h); });

  await page.click('#flChatBuildTrustActions [data-trust="notify"]');
  await page.evaluate(function (body) {
    window.__tree.notes = window.__tree.notes || {};
    window.__tree.notes['big.txt'] = 'old\n';
    window.__addFile('notes/big.txt', body);
  }, manyLines(41));
  await page.waitForFunction(function () {
    var rows = document.querySelectorAll('[data-fl-autonomy="receipt"]');
    var last = rows[rows.length - 1];
    return last && last.textContent.indexOf('over 40 lines') !== -1;
  }, null, { timeout: 5000 });

  await page.evaluate(function () { window.__addFile('notes/fresh.txt', 'one\n'); });
  await page.waitForFunction(function () {
    var rows = document.querySelectorAll('[data-fl-autonomy="receipt"]');
    var last = rows[rows.length - 1];
    return last && last.getAttribute('data-important') === 'new';
  }, null, { timeout: 5000 });
  var freshPing = await page.evaluate(function () {
    var rows = document.querySelectorAll('[data-fl-autonomy="receipt"]');
    return rows[rows.length - 1].textContent;
  });
  if (freshPing.indexOf('That file is new.') === -1) fail('new ping ' + freshPing);

  await page.evaluate(function () { window.__addFile('notes/hello.txt', ''); });
  await page.waitForFunction(function () {
    var rows = document.querySelectorAll('[data-fl-autonomy="receipt"]');
    var last = rows[rows.length - 1];
    return last && last.textContent.indexOf('That file was removed.') !== -1;
  }, null, { timeout: 5000 });

  var smallBefore = await page.evaluate(function () { return window.__writes.length; });
  await page.evaluate(function () {
    window.__tree.notes = window.__tree.notes || {};
    window.__tree.notes['tiny.txt'] = 'a\n';
    window.__addFile('notes/tiny.txt', 'a\nb\n');
  });
  await page.waitForFunction(function () { return window.__writes.length > 0; }, null, { timeout: 5000 });
  await page.waitForFunction(function (n) { return window.__writes.length > n; }, smallBefore, { timeout: 5000 });
  var tiny = await page.evaluate(function () {
    var rows = document.querySelectorAll('[data-fl-autonomy="receipt"]');
    return rows[rows.length - 1].textContent;
  });
  if (tiny.indexOf('Built notes/tiny.txt; tap to look') === -1) fail('tiny receipt ' + tiny);
  if (tiny.indexOf('over 40') !== -1 || tiny.indexOf('That file is new') !== -1) fail('tiny ping ' + tiny);

  await page.click('#flChatBuildTrustActions [data-trust="review"]');
  var reviewStored = await page.evaluate(function () {
    return {
      trust: localStorage.getItem('fl_chatBuildTrust'),
      asked: localStorage.getItem('fl_chatBuildTrustAsked'),
      note: document.getElementById('flChatBuildDisclaimer').getClientRects().length
    };
  });
  if (reviewStored.trust !== 'review' || reviewStored.asked !== 'true' || !reviewStored.note) fail('review store ' + JSON.stringify(reviewStored));
  var beforeReview = await page.evaluate(function () { return window.__writes.length; });
  await page.evaluate(function () { window.__addFile('notes/wait.txt', 'hold\n'); });
  await page.waitForFunction(function () {
    var buttons = document.querySelectorAll('.save-to-workspace-btn');
    var last = buttons[buttons.length - 1];
    return last && last.getAttribute('data-fl-autonomy-seen') === '1';
  }, null, { timeout: 5000 });
  await page.waitForTimeout(200);
  var still = await page.evaluate(function () { return window.__writes.length; });
  if (still !== beforeReview) fail('review wrote early');
  await page.evaluate(function () {
    var buttons = document.querySelectorAll('.save-to-workspace-btn');
    buttons[buttons.length - 1].click();
  });
  await page.waitForFunction(function (n) { return window.__writes.length > n; }, beforeReview, { timeout: 5000 });

  await page.evaluate(function () {
    window.__tree['note.txt'] = 'alpha\n';
    window.__job = window.FreeLattice.processToolAction({
      type: 'propose',
      path: 'note.txt',
      diff: '@@ -1,1 +1,2 @@\n alpha\n+beta\n'
    });
  });
  await page.waitForFunction(function () {
    return document.querySelector('[data-fl-autonomy="review"]');
  }, null, { timeout: 5000 });
  var proposedEarly = await page.evaluate(function () {
    return { n: window.__proposals.length, consent: window.__consent, text: window.__tree['note.txt'] };
  });
  if (proposedEarly.n !== 0 || proposedEarly.consent !== 0) fail('propose ran early ' + JSON.stringify(proposedEarly));
  if (proposedEarly.text.indexOf('beta') !== -1) fail('propose wrote early');
  await page.click('[data-fl-autonomy="review"] button');
  await page.waitForFunction(function () {
    return window.__proposals.length === 1 && window.__tree['note.txt'].indexOf('beta') !== -1;
  }, null, { timeout: 5000 });
  var proposed = await page.evaluate(function () {
    return { ok: window.__proposals[0].ok, consent: window.__consent, text: window.__tree['note.txt'] };
  });
  if (!proposed.ok || proposed.consent !== 0) fail('propose consent ' + JSON.stringify(proposed));

  var sideways = await page.evaluate(function () {
    return document.documentElement.scrollWidth > window.innerWidth + 1;
  });
  if (sideways) fail('harness sideways 1280');
  if (box.errors.length) fail('harness error ' + box.errors[0]);
  var badHits = wireHits(box.hits).filter(function (url) { return url.indexOf('127.0.0.1:' + 8927) !== 0 && url.indexOf('127.0.0.1:3141') === 0; });
  if (badHits.length) fail('bridge hit ' + badHits.join(','));
  await box.context.close();

  var narrow = await openHarness(390, 800, 1);
  await narrow.page.evaluate(function () { window.__addFile('notes/narrow.txt', 'hi\n'); });
  await narrow.page.waitForFunction(function () {
    return document.querySelector('[data-fl-autonomy="ask"]');
  }, null, { timeout: 5000 });
  var narrowBox = await narrow.page.evaluate(function () {
    var nodes = document.querySelectorAll('[data-fl-autonomy="ask"] button, #flChatSearchToggle, #sendBtn, #yesBtn');
    var heights = [];
    for (var i = 0; i < nodes.length; i++) heights.push(Math.round(nodes[i].getBoundingClientRect().height));
    return {
      heights: heights,
      sideways: document.documentElement.scrollWidth > window.innerWidth + 1,
      writes: window.__writes.length
    };
  });
  if (narrowBox.writes !== 0) fail('390 wrote early');
  narrowBox.heights.forEach(function (h) { if (h < 44) fail('390 height ' + h); });
  if (narrowBox.sideways) fail('390 sideways');
  await narrow.page.keyboard.press('Escape');
  await narrow.page.waitForFunction(function () {
    return window.__writes.length === 1 && window.FLChatAutonomy.sessionDismissed();
  }, null, { timeout: 5000 });
  var dismissed = await narrow.page.evaluate(function () {
    return {
      asked: localStorage.getItem('fl_chatBuildTrustAsked'),
      trust: localStorage.getItem('fl_chatBuildTrust'),
      ask: document.querySelectorAll('[data-fl-autonomy="ask"]').length
    };
  });
  if (dismissed.asked !== null || dismissed.trust !== null || dismissed.ask !== 0) fail('dismiss stored ' + JSON.stringify(dismissed));
  await narrow.page.reload({ waitUntil: 'domcontentloaded' });
  await narrow.page.waitForFunction(function () {
    return window.FLChatAutonomy && document.getElementById('flChatSearchToggle');
  }, null, { timeout: 15000 });
  await narrow.page.evaluate(function () { window.__addFile('notes/again.txt', 'hi\n'); });
  await narrow.page.waitForFunction(function () {
    return document.querySelector('[data-fl-autonomy="ask"]');
  }, null, { timeout: 5000 });
  if (narrow.errors.length) fail('390 error ' + narrow.errors[0]);
  await narrow.context.close();

  async function openApp(width, height, scale) {
    var context = await browser.newContext({
      viewport: { width: width, height: height },
      deviceScaleFactor: scale || 1
    });
    var page = await context.newPage();
    var errors = [];
    page.on('pageerror', function (err) { errors.push(String(err)); });
    await page.addInitScript(function () {
      try {
        localStorage.setItem('fl-has-visited', '1');
        localStorage.setItem('fl-last-tab', 'chat');
        localStorage.setItem('fl-welcomed', 'true');
        localStorage.setItem('fl_onboardingComplete', 'true');
      } catch (e) {}
    });
    await page.goto(base + '/app.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(function () {
      return window.FLChatAutonomy && document.getElementById('flChatSearchToggle') && document.getElementById('sendBtn');
    }, null, { timeout: 20000 });
    await page.evaluate(function () { if (typeof window.switchTab === 'function') window.switchTab('chat'); });
    return { page: page, context: context, errors: errors };
  }

  async function measure(width, height, scale) {
    var opened = await openApp(width, height, scale);
    var page = opened.page;
    async function seatSend() {
      await page.evaluate(function () {
        var send = document.getElementById('sendBtn');
        var nav = document.getElementById('flMobileNav');
        var navH = 0;
        if (nav) {
          var cs = getComputedStyle(nav);
          if (cs.display !== 'none') navH = Math.round(nav.getBoundingClientRect().height) || 0;
        }
        var sr = send.getBoundingClientRect();
        var goal = Math.max(96, (window.innerHeight - navH - sr.height) / 2);
        document.documentElement.scrollTop += sr.top - goal;
      });
      await page.waitForTimeout(350);
    }
    await page.waitForTimeout(400);
    await seatSend();
    await seatSend();
    var chat = await page.evaluate(function () {
      function box(el) {
        if (!el) return null;
        var r = el.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), t: (el.textContent || '').slice(0, 60) };
      }
      function overlap(a, b) {
        if (!a || !b || a.h < 1 || b.h < 1) return false;
        return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
      }
      var send = document.getElementById('sendBtn');
      var sr = send.getBoundingClientRect();
      var cy = Math.min(window.innerHeight - 2, Math.max(0, sr.top + sr.height / 2));
      var cx = Math.min(window.innerWidth - 2, Math.max(0, sr.left + sr.width / 2));
      var hit = document.elementFromPoint(cx, cy);
      var status = document.getElementById('statusText');
      var search = document.getElementById('flChatSearchToggle');
      var live = document.getElementById('flChatSearchLive');
      var yes = null;
      var seal = null;
      var buttons = document.querySelectorAll('button');
      var i;
      for (i = 0; i < buttons.length; i++) {
        var label = (buttons[i].textContent || '').replace(/\s+/g, ' ').trim();
        if (!yes && label === 'Yes') yes = buttons[i];
        if (!seal && label === 'Seal it') seal = buttons[i];
      }
      var searchBox = box(search);
      var sendBox = box(send);
      return {
        status: status ? status.textContent : '',
        statusShown: !!(status && status.getClientRects().length),
        search: searchBox,
        liveHidden: !!(live && live.hasAttribute('hidden')),
        send: sendBox,
        sendHit: !!(hit && (hit === send || send.contains(hit))),
        hit: hit ? ((hit.id || hit.className || hit.tagName) + '').slice(0, 40) : 'none',
        yes: box(yes),
        seal: box(seal),
        overlapSend: overlap(searchBox, sendBox),
        sideways: document.documentElement.scrollWidth > window.innerWidth + 1
      };
    });
    if (!chat.status || chat.status.indexOf('Ready') !== 0) fail(width + ' status ' + chat.status);
    if (!chat.statusShown) fail(width + ' status hidden');
    if (!chat.search || chat.search.h < 44) fail(width + ' search ' + JSON.stringify(chat.search));
    if (chat.search.t !== 'Search on') fail(width + ' search text ' + chat.search.t);
    if (chat.liveHidden) fail(width + ' search indicator hidden while on');
    if (!chat.send || chat.send.h < 44) fail(width + ' send ' + JSON.stringify(chat.send));
    if (!chat.sendHit) fail(width + ' send covered by ' + chat.hit + ' ' + JSON.stringify(chat.send));
    if (chat.overlapSend) fail(width + ' search overlaps send');
    if (chat.yes && chat.yes.h > 0 && chat.yes.h < 44) fail(width + ' yes short');
    if (chat.seal && chat.seal.h > 0 && chat.seal.h < 44) fail(width + ' seal short');
    if (chat.sideways) fail(width + ' sideways');
    await page.evaluate(function () { if (typeof window.switchTab === 'function') window.switchTab('settings'); });
    await page.waitForFunction(function () {
      var note = document.getElementById('flChatBuildDisclaimer');
      return note && note.getClientRects().length;
    }, null, { timeout: 10000 });
    var set = await page.evaluate(function () {
      var note = document.getElementById('flChatBuildDisclaimer');
      var buttons = document.querySelectorAll('#flChatBuildTrustActions button');
      var heights = [];
      for (var i = 0; i < buttons.length; i++) heights.push(Math.round(buttons[i].getBoundingClientRect().height));
      return {
        note: note.textContent,
        heights: heights,
        sideways: document.documentElement.scrollWidth > window.innerWidth + 1,
        auto: document.querySelector('#flChatBuildTrustActions [data-trust="auto"]').getAttribute('aria-checked')
      };
    });
    if (set.note.indexOf('You chose the trust level') === -1) fail(width + ' disclaimer');
    if (set.auto !== 'true') fail(width + ' default radio');
    if (set.heights.length !== 3) fail(width + ' settings buttons');
    set.heights.forEach(function (h) { if (h < 44) fail(width + ' settings height ' + h); });
    if (set.sideways) fail(width + ' settings sideways');
    if (opened.errors.length) fail(width + ' app error ' + opened.errors[0]);
    await opened.context.close();
    return { chat: chat, settings: set.heights };
  }

  var wide = await measure(1280, 800, 1);
  var phone = await measure(390, 800, 1);
  var dense = await measure(640, 400, 2);

  await browser.close();
  server.close();
  console.log(JSON.stringify({
    chrome: version,
    wide: wide.chat.send,
    phone: phone.chat.send,
    dense: dense.chat.send,
    dismiss: 'escape-session-auto'
  }));
  console.log('SMOKE_OK chat autonomy v0.1');
})().catch(function (err) {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
