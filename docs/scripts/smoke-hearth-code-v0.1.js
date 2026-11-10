#!/usr/bin/env node
// Smoke: Hearth code in chat v0.1. Headless. Fixture GitHub and fixture Python.
'use strict';

var fs = require('fs');
var path = require('path');
var http = require('http');
var crypto = require('crypto');
var child = require('child_process');

var root = path.join(__dirname, '..', '..');
var port = Number(process.env.FL_PORT || 8798);
var shotDir = path.join(root, 'docs/library/hearth-063');

function fail(msg) {
  console.error('FAIL ' + msg);
  process.exit(1);
}

function memoryStorage() {
  var store = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; }
  };
}

global.localStorage = memoryStorage();
var hearth = require(path.join(root, 'docs/modules/hearth-code.js'));

function sha(text) {
  return crypto.createHash('sha256').update(String(text)).digest('hex');
}

(async function () {
  var first = await hearth.keep({ lang: 'js', code: 'console.log(1)', output: '1', author: 'person', at: '2026-11-02T00:00:00Z' });
  var forked = await hearth.fork(first.id);
  var rows = hearth.ledger();
  if (rows.length !== 2) fail('ledger ' + rows.length);
  if (forked.parent !== first.id) fail('parent ' + forked.parent);
  if (first.sha256 !== sha(first.code) || forked.sha256 !== sha(forked.code)) fail('hash');
  if (!(await hearth.verifyRow(first)) || !(await hearth.verifyRow(forked))) fail('verify');
  console.log('LEDGER ' + rows.length + ' parent ' + forked.parent);

  var parsed = hearth.parseRepo('https://github.com/octocat/Hello-World/tree/master/docs');
  if (!parsed || parsed.owner !== 'octocat' || parsed.repo !== 'Hello-World' || parsed.ref !== 'master' || parsed.path !== 'docs') fail('parse ' + JSON.stringify(parsed));
  var diff = hearth.proposalDiff('a\nb\n', 'a\nc\n');
  if (diff.indexOf('- b') === -1 || diff.indexOf('+ c') === -1) fail('diff ' + diff);
  if (hearth.PY_URL.indexOf('cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js') === -1) fail('pin url');
  if (hearth.PY_SHA !== 'b4cb23a53aba19c221659b9fb40a2f18281d685691dc06647fb0afd0681baf98') fail('pin sha');
  console.log('PARSE diff pin');

  var locks = {
    // before 068m: 'docs/modules/snowflake-search.js': '7b5dd9c332d12b3f28d3615256688477',
    // before v-chat-roundtable-button-v0.1: 'docs/modules/snowflake-search.js': 'b52780ed553a15baa94ed30b2a0f9b89',
    'docs/modules/snowflake-search.js': '607a99d6bc943a3e5abbd6dccd5fd8cf',
    // before 062c: 'docs/modules/snowflake-core.js': 'eaee889573225a53b1f0fb229464492a',
    // before 062d: 'docs/modules/snowflake-core.js': '6404eaac25de46591ad2e86a06b1b171',
    // before 068m: 'docs/modules/snowflake-core.js': '46b215d5296b6f8f6c709300854b7e03',
    // before v-ai-chosen-learning-v0.1: 'docs/modules/snowflake-core.js': '2b46ed5004c7e10a43ead01632f824cc',
    // before v-ai-chosen-learning-v0.1 recheck3: 'docs/modules/snowflake-core.js': '24a1b2ec0f55584bc3b925a780d74071',
    // before v-ai-chosen-learning-v0.1 recheck4: 'docs/modules/snowflake-core.js': '165d501c2fa4d3b66e016ee32fb0de82',
    // before v-ai-chosen-learning-v0.1 round 11: 'docs/modules/snowflake-core.js': '30d1285d06842ec682b60b3cebf19ab0',
    // before v-ai-chosen-learning-v0.1 round 12: 'docs/modules/snowflake-core.js': '927fcefe1a1db8dcc50dd81549c68283',
    'docs/modules/snowflake-core.js': 'c81e0341063b76a8566d88eff6d685dd',
    'docs/modules/chat-bottom-clarity.js': '5bbadf3320177a485b27c565bac64454',
    'docs/modules/pool-honest-label.js': '91d8b79067f92e761474848dd2b9a75a',
    'docs/modules/gathering-speak.js': '0460fdc777a21f7a1744f401dda82cb2',
    'docs/modules/fl-bridge.js': '3b5ef06849a142e50c78e7ba1e057980',
    'docs/modules/tool-consent.js': '6f48032c6835e8d83e39af74abd63f6b'
  };
  Object.keys(locks).forEach(function (rel) {
    var got = crypto.createHash('md5').update(fs.readFileSync(path.join(root, rel))).digest('hex');
    if (got !== locks[rel]) fail('lock moved ' + rel + ' ' + got);
  });
  var appDiff = child.execSync('git diff -U0 350233d00f5f50edea4564624b7e07bf5f0fbec2 -- docs/app.html', { cwd: root, encoding: 'utf8' });
  var added = appDiff.split('\n').filter(function (line) { return line.indexOf('+') === 0 && line.indexOf('+++') !== 0; });
  var removed = appDiff.split('\n').filter(function (line) { return line.indexOf('-') === 0 && line.indexOf('---') !== 0; });
  if (added.length !== 1 || removed.length !== 0) fail('app diff ' + appDiff);
  if (added[0].indexOf('modules/hearth-code.js') === -1) fail('app line ' + added[0]);
  var app = fs.readFileSync(path.join(root, 'docs/app.html'));
  var index = fs.readFileSync(path.join(root, 'index.html'));
  if (!app.equals(index)) fail('twins');
  var sw = fs.readFileSync(path.join(root, 'sw.js'));
  var docsSw = fs.readFileSync(path.join(root, 'docs/sw.js'));
  if (!sw.equals(docsSw)) fail('sw twins');
  console.log('DIFF ' + added[0]);

  var html = [
    '<!doctype html><html><head>',
    '<link rel="stylesheet" href="/css/chat-bottom-clarity.css">',
    '<style>body{margin:0;background:#12141c;color:#e6ebf5;}#flChatAddMenu{position:static;}</style>',
    '</head><body>',
    '<div id="flChatAddMenu" data-open="1" role="menu">',
    '<button id="flChatAddSearch" class="fl-add-item" type="button"><span class="fl-add-copy"><span class="fl-add-word">Search</span></span></button>',
    '<button id="flSnowflakeAdd" class="fl-add-item" type="button"><span class="fl-add-copy"><span class="fl-add-word">Snowflake</span></span></button>',
    '</div>',
    '<div id="chatMessages"></div>',
    '<script src="/modules/hearth-code.js"></script>',
    '</body></html>'
  ].join('');

  var server = http.createServer(function (req, res) {
    var urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (urlPath === '/hearth.html') {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(html);
      return;
    }
    var file = path.normalize(path.join(root, 'docs', urlPath));
    if (file.indexOf(path.join(root, 'docs')) !== 0) { res.statusCode = 403; res.end('no'); return; }
    fs.readFile(file, function (err, buf) {
      if (err) { res.statusCode = 404; res.end('missing'); return; }
      var ext = path.extname(file);
      var type = ext === '.js' ? 'text/javascript' : (ext === '.css' ? 'text/css' : 'text/html');
      res.setHeader('content-type', type + '; charset=utf-8');
      res.end(buf);
    });
  });
  await new Promise(function (resolve) { server.listen(port, '127.0.0.1', resolve); });

  var pw = require(process.env.FL_PLAYWRIGHT || '/tmp/gc-pw-local/node_modules/playwright-core');
  var browser = await pw.chromium.launch({
    executablePath: process.env.FL_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true
  });
  try {
    var page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.setDefaultTimeout(20000);
    await page.goto('http://127.0.0.1:' + port + '/hearth.html', { waitUntil: 'domcontentloaded' });
    async function menuCheck(width) {
      await page.setViewportSize({ width: width, height: width === 390 ? 844 : 800 });
      var info = await page.evaluate(function () {
        var menu = document.getElementById('flChatAddMenu');
        var buttons = menu.querySelectorAll('button');
        var ids = [];
        var words = [];
        var heights = [];
        var i;
        for (i = 0; i < buttons.length; i++) {
          ids.push(buttons[i].id);
          var word = buttons[i].querySelector('.fl-add-word');
          words.push(word ? word.textContent : '');
          heights.push(buttons[i].getBoundingClientRect().height);
        }
        var quiet = document.querySelector('#tab-quiet-room.active, #tab-quiet.active, [data-tab="quiet"].active, [data-tab="quiet-room"].active');
        return {
          ids: ids.join(','),
          words: words.join(','),
          heights: heights,
          scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          quiet: !!quiet
        };
      });
      if (info.quiet) fail('quiet');
      if (info.ids !== 'flChatAddSearch,flSnowflakeAdd,flHearthAdd') fail('order ' + width + ' ' + info.ids);
      if (info.words !== 'Search,Snowflake,Hearth') fail('words ' + info.words);
      info.heights.forEach(function (h) { if (h < 44) fail('tap ' + width + ' ' + h); });
      if (info.scroll > 1) fail('scroll ' + width + ' ' + info.scroll);
      console.log('MENU ' + width + ' ' + info.words + ' ' + info.heights.join('x'));
    }
    await menuCheck(1280);
    await menuCheck(390);

    await page.evaluate(function () { document.getElementById('flHearthAdd').click(); });
    var netBefore = await page.evaluate(function () {
      return window.FLHearth.netLog.map(function (row) { return row.url; }).join('\n');
    });
    if (/jsdelivr|pyodide/i.test(netBefore)) fail('python fetched early ' + netBefore);
    console.log('PYTHON NET before tap:\n' + (netBefore || '(empty)'));

    await page.evaluate(function () {
      window.localStorage.setItem('fl_testHooks', '1');
      window.__flHearthPythonFixture = function (code) {
        if (code.replace(/\s/g, '') === 'print(2**10)') return { ok: true, lines: ['1024'], value: '1024' };
        return { ok: false, lines: ['fixture'], value: '' };
      };
    });
    await page.click('#flHearthPython');
    await page.selectOption('#flHearthLang', 'python');
    await page.fill('#flHearthEditor', 'print(2**10)');
    await page.click('#flHearthRun');
    await page.evaluate(function () { return window.FLHearth.lastRun(); });
    var py = await page.textContent('#flHearthOut');
    if (py.indexOf('1024') === -1) fail('python ' + py);
    var netAfter = await page.evaluate(function () {
      return window.FLHearth.netLog.map(function (row) { return row.url; }).join('\n');
    });
    if (/jsdelivr|pyodide/i.test(netAfter)) fail('fixture still fetched ' + netAfter);
    console.log('PYTHON 1024');
    console.log('PYTHON NET after tap:\n' + (netAfter || '(empty)'));

    await page.selectOption('#flHearthLang', 'js');
    await page.fill('#flHearthEditor', 'console.log(1+1)');
    await page.click('#flHearthRun');
    await page.evaluate(function () { return window.FLHearth.lastRun(); });
    var two = await page.textContent('#flHearthOut');
    if (two.trim() !== '2') fail('log ' + two);
    var alive = await page.evaluate(function () { return window.FLHearth.workerCount(); });
    if (alive !== 0) fail('worker left ' + alive);
    console.log('RUN 2 workers ' + alive);

    await page.fill('#flHearthEditor', 'fetch("https://example.com")');
    await page.click('#flHearthRun');
    await page.evaluate(function () { return window.FLHearth.lastRun(); });
    var refused = await page.textContent('#flHearthOut');
    if (refused.indexOf('Hearth runs offline') === -1) fail('fetch ' + refused);
    console.log('FETCH refused');

    var runsBefore = await page.evaluate(function () { return window.FLHearth.runs(); });
    await page.evaluate(function () {
      window.FreeLattice = {
        callAI: function (system, user, opts) {
          window.__hearthSystem = system;
          opts.callback('```js\nconsole.log(3)\n```');
        }
      };
    });
    await page.click('#flHearthAsk');
    await page.waitForSelector('#flHearthUse:not([hidden])');
    await page.click('#flHearthUse');
    var used = await page.inputValue('#flHearthEditor');
    var runsAfter = await page.evaluate(function () { return window.FLHearth.runs(); });
    var sys = await page.evaluate(function () { return window.__hearthSystem; });
    if (used !== 'console.log(3)') fail('use ' + used);
    if (runsAfter !== runsBefore) fail('auto run ' + runsAfter);
    if (sys.indexOf("Say 'I don't know' when you don't.") === -1) fail('system ' + sys);
    console.log('USE editor filled runs ' + runsAfter);

    await page.fill('#flHearthEditor', 'while(true){}');
    await page.click('#flHearthRun');
    await page.evaluate(function () { return window.FLHearth.lastRun(); });
    var stopped = await page.textContent('#flHearthOut');
    if (stopped.indexOf('Stopped after 3 seconds.') === -1) fail('stop ' + stopped);
    console.log('STOP ' + stopped.trim());

    var probe = '<!doctype html><script>try{void parent.localStorage.getItem("x");parent.postMessage({hearth:"storage",line:"read"},"*");}catch(e){parent.postMessage({hearth:"storage",error:String((e&&e.name||"")+(e&&e.message?": "+e.message:""))},"*");}<\/script>';
    var storageError = await page.evaluate(function (html) {
      return window.FLHearth.runShow(html).then(function (res) { return (res.lines || []).join('\n'); });
    }, probe);
    if (!storageError || storageError === 'read') fail('storage ' + storageError);
    console.log('IFRAME ' + storageError);

    await page.evaluate(function () {
      window.fetch = function (url) {
        var href = String(url);
        function res(body, headers) {
          return {
            ok: true,
            status: 200,
            headers: { get: function (name) {
              var k;
              for (k in headers) if (k.toLowerCase() === String(name).toLowerCase()) return headers[k];
              return null;
            } },
            json: function () { return Promise.resolve(body); },
            text: function () { return Promise.resolve(typeof body === 'string' ? body : ''); }
          };
        }
        if (href.indexOf('/repos/octocat/Hello-World/contents') !== -1) {
          return Promise.resolve(res([{ name: 'README', path: 'README', sha: 'abc123', type: 'file' }], { 'X-RateLimit-Remaining': '59' }));
        }
        if (href.indexOf('api.github.com/repos/octocat/Hello-World') !== -1) {
          return Promise.resolve(res({ default_branch: 'master' }, { 'X-RateLimit-Remaining': '59' }));
        }
        if (href.indexOf('raw.githubusercontent.com/octocat/Hello-World/') !== -1) {
          return Promise.resolve(res('# Hello\n', {}));
        }
        return Promise.reject(new Error('unexpected ' + href));
      };
    });
    await page.fill('#flHearthRepo', 'https://github.com/octocat/Hello-World');
    await page.click('#flHearthOpenRepo');
    await page.waitForSelector('#flHearthFiles button');
    await page.click('#flHearthFiles button');
    await page.waitForFunction(function () {
      var source = document.getElementById('flHearthSource');
      return source && source.textContent.indexOf('from octocat/Hello-World') !== -1;
    });
    var gh = await page.evaluate(function () {
      var editor = document.getElementById('flHearthEditor');
      return {
        files: document.getElementById('flHearthFiles').textContent,
        source: document.getElementById('flHearthSource').textContent,
        readOnly: editor.readOnly,
        rate: document.getElementById('flHearthRate').textContent,
        diff: document.getElementById('flHearthDiff').textContent,
        proposeDisabled: document.getElementById('flHearthPropose').disabled,
        log: window.FLHearth.netLog.map(function (row) {
          return { url: row.url, headers: row.headers };
        })
      };
    });
    if (gh.files.indexOf('README') === -1) fail('files ' + gh.files);
    if (!gh.readOnly) fail('not read only');
    if (gh.source !== 'from octocat/Hello-World@abc123 README') fail('source ' + gh.source);
    if (gh.rate.indexOf('59') === -1) fail('rate ' + gh.rate);
    if (!gh.proposeDisabled) fail('propose enabled');
    if (gh.diff.indexOf('Writing to GitHub needs your own sign-in') === -1) fail('diff sentence');
    var painted = await page.evaluate(function () {
      return window.FLHearth.paintDiff('alpha\n', 'beta\n');
    });
    if (painted.indexOf('- alpha') === -1 || painted.indexOf('+ beta') === -1) fail('paint ' + painted);
    gh.log.forEach(function (row) {
      var keys = Object.keys(row.headers || {});
      keys.forEach(function (key) {
        if (key.toLowerCase() === 'authorization') fail('auth header ' + JSON.stringify(row));
      });
    });
    console.log('GITHUB headers ' + JSON.stringify(gh.log.map(function (row) { return row.headers; })));
    console.log('GITHUB ' + gh.source);

    fs.mkdirSync(shotDir, { recursive: true });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator('#flHearthHost').screenshot({ path: path.join(shotDir, 'panel-1280.png') });
    var desk = await page.evaluate(function () {
      var editor = document.getElementById('flHearthEditor');
      var host = document.getElementById('flHearthHost');
      var font = parseFloat(getComputedStyle(editor).fontSize);
      return {
        font: font,
        editor: editor.getBoundingClientRect().width,
        host: host.clientWidth,
        scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#flHearthHost').screenshot({ path: path.join(shotDir, 'panel-390.png') });
    var phone = await page.evaluate(function () {
      var editor = document.getElementById('flHearthEditor');
      var host = document.getElementById('flHearthHost');
      var font = parseFloat(getComputedStyle(editor).fontSize);
      var buttons = document.querySelectorAll('#flHearthHost .fl-hearth-controls .fl-hearth-btn');
      var tops = [];
      var i;
      for (i = 0; i < buttons.length; i++) tops.push(buttons[i].getBoundingClientRect().top);
      var wrapped = false;
      for (i = 1; i < tops.length; i++) if (Math.abs(tops[i] - tops[0]) > 20) wrapped = true;
      return {
        font: font,
        editor: editor.getBoundingClientRect().width,
        host: host.clientWidth,
        wrapped: wrapped,
        scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });
    if (desk.font < 14 || phone.font < 14) fail('font ' + desk.font + ' ' + phone.font);
    if (phone.editor < phone.host - 80) fail('editor width ' + phone.editor + ' host ' + phone.host);
    if (!phone.wrapped) fail('buttons did not wrap');
    if (desk.scroll > 1 || phone.scroll > 1) fail('panel scroll ' + desk.scroll + ' ' + phone.scroll);
    await page.click('#flHearthClose');
    var closed = await page.evaluate(function () {
      return {
        hidden: document.getElementById('flHearthHost').hidden,
        workers: window.FLHearth.workerCount()
      };
    });
    if (!closed.hidden || closed.workers !== 0) fail('close ' + JSON.stringify(closed));
    console.log('PANEL 1280 font ' + desk.font + ' 390 font ' + phone.font + ' workers ' + closed.workers);
    console.log('SHOT docs/library/hearth-063/panel-1280.png');
    console.log('SHOT docs/library/hearth-063/panel-390.png');
  } finally {
    await browser.close();
    server.close();
  }

  console.log('SMOKE_OK hearth code v0.1');
})().catch(function (err) {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
