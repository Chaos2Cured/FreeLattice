#!/usr/bin/env node
// Smoke: search heal v0.1. Today's date, one recency search, plain failure lines.
'use strict';

var fs = require('fs');
var path = require('path');
var http = require('http');

var root = path.join(__dirname, '..', '..');
var port = Number(process.env.FL_PORT || 8792);

function fail(msg) {
  console.error('FAIL ' + msg);
  process.exit(1);
}

var app = fs.readFileSync(path.join(root, 'docs/app.html'), 'utf8');
var index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
if (app !== index) fail('twins');
var hook = "messages = await FLSnowflake.prepareSend(messages, message);";
if (app.indexOf(hook) === -1) fail('hook missing');
if (app.indexOf('v-search-heal-v0.1') === -1) fail('marker missing');
if (app.indexOf('On, and this device asks before each search. Each search shows in the chat.') === -1) fail('status line');
if (app.indexOf('Active \u2014 AI may emit [FL_SEARCH:') !== -1) fail('stale status');

function serve(dir, listenPort) {
  return new Promise(function (resolve) {
    var server = http.createServer(function (req, res) {
      var urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      if (urlPath === '/') urlPath = '/app.html';
      var file = path.normalize(path.join(dir, urlPath));
      if (file.indexOf(dir) !== 0) { res.statusCode = 403; res.end('no'); return; }
      fs.readFile(file, function (err, buf) {
        if (err) { res.statusCode = 404; res.end('missing'); return; }
        var ext = path.extname(file);
        var type = ext === '.js' ? 'text/javascript' : (ext === '.css' ? 'text/css' : 'text/html');
        res.setHeader('content-type', type + '; charset=utf-8');
        res.end(buf);
      });
    });
    server.listen(listenPort, '127.0.0.1', function () { resolve(server); });
  });
}

(async function () {
  var server = await serve(path.join(root, 'docs'), port);
  var base = 'http://127.0.0.1:' + port;
  var pwPath = process.env.FL_PLAYWRIGHT || '/tmp/gc-pw-local/node_modules/playwright-core';
  var pw = require(pwPath);
  var chromePath = process.env.FL_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  var browser = await pw.chromium.launch({ executablePath: chromePath, headless: true });
  var pageErrors = [];
  try {
    var context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    var page = await context.newPage();
    page.setDefaultTimeout(25000);
    page.on('pageerror', function (err) { pageErrors.push(String(err)); });
    await page.addInitScript(function () {
      try {
        localStorage.setItem('fl-has-visited', '1');
        localStorage.setItem('fl-last-tab', 'chat');
        localStorage.setItem('fl-welcomed', 'true');
        localStorage.setItem('fl_onboardingComplete', 'true');
        localStorage.setItem('fl_searchEnabled', 'true');
      } catch (e) {}
    });
    await page.goto(base + '/app.html', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(function () {
      return window.FLSnowflake && typeof window.FLSnowflake.prepareSend === 'function' && document.getElementById('flSnowflakeHealLine');
    }, null, { timeout: 40000 });

    await page.evaluate(function () {
      window.__healFetches = [];
      window.__healMode = 'ok';
      var orig = window.fetch.bind(window);
      window.fetch = function (url, opts) {
        var href = String(url);
        if (href.indexOf('?q=') === -1) return orig(url, opts);
        window.__healFetches.push(href);
        var mode = window.__healMode;
        if (mode === 'down') {
          return Promise.resolve({ ok: false, status: 503, json: function () { return Promise.resolve({}); } });
        }
        if (mode === 'empty') {
          return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ items: [] }); } });
        }
        if (mode === 'timeout') {
          var err = new Error('aborted');
          err.name = 'AbortError';
          return Promise.reject(err);
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: function () {
            return Promise.resolve({ items: [{ title: 'Election desk', url: 'https://example.invalid/election', snippet: 'A count.' }] });
          }
        });
      };
    });

    var hello = await page.evaluate(async function () {
      var before = window.__healFetches.length;
      var out = await window.FLSnowflake.prepareSend([{ role: 'system', content: 'Be kind.' }, { role: 'user', content: 'hello' }], 'hello');
      return {
        fetches: window.__healFetches.length - before,
        head: out[0].content.slice(0, 220),
        recent: out[0].content.indexOf('Recent sources') !== -1
      };
    });
    if (hello.fetches !== 0) fail('hello fetched ' + hello.fetches);
    if (hello.head.indexOf('Today is ') !== 0) fail('date ' + hello.head);
    if (hello.head.indexOf('people in office), search.') === -1) fail('invite ' + hello.head);
    if (hello.recent) fail('hello sources');

    var election = await page.evaluate(async function () {
      var before = window.__healFetches.length;
      var out = await window.FLSnowflake.prepareSend([{ role: 'system', content: 'Be kind.' }], 'latest election results');
      var live = document.getElementById('flChatSearchLive');
      return {
        fetches: window.__healFetches.length - before,
        recent: out[0].content.indexOf('Recent sources') !== -1,
        queryInRow: window.__healFetches.join(' ').indexOf('latest') !== -1,
        live: live ? live.textContent : ''
      };
    });
    if (election.fetches !== 1) fail('election fetches ' + election.fetches);
    if (!election.recent) fail('election sources');
    if (!election.queryInRow) fail('election query');

    var down = await page.evaluate(async function () {
      window.__healMode = 'down';
      await window.FLSnowflake.prepareSend([{ role: 'system', content: 'Be kind.' }], 'weather today');
      var line = document.getElementById('flSnowflakeHealLine').textContent;
      var again = document.getElementById('flSnowflakeTryAgain');
      var box = again.getBoundingClientRect();
      return { line: line, hidden: again.hidden, h: box.height };
    });
    if (down.line !== 'Our search helper is down (error 5xx).') fail('down ' + down.line);
    if (down.hidden) fail('try again hidden');
    if (down.h < 44) fail('try again ' + down.h);

    var empty = await page.evaluate(async function () {
      window.__healMode = 'empty';
      await window.FLSnowflake.prepareSend([{ role: 'system', content: 'Be kind.' }], 'price today');
      return document.getElementById('flSnowflakeHealLine').textContent;
    });
    if (empty !== 'No results.') fail('empty ' + empty);

    var slow = await page.evaluate(async function () {
      window.__healMode = 'timeout';
      var res = await window.FLSnowflakeCore.searchNow('score now');
      window.FLSnowflake.showSearchResult(res, 'score now');
      return {
        line: document.getElementById('flSnowflakeHealLine').textContent,
        searching: (document.getElementById('flChatSearchLive') || {}).textContent || '',
        note: (document.getElementById('flSnowflakeSearchNote') || {}).textContent || ''
      };
    });
    if (slow.line !== 'Search took too long.') fail('timeout ' + slow.line);
    if (slow.searching.indexOf('Searching the web') === -1 && slow.note.indexOf('Searching the web') === -1) fail('indicator ' + slow.searching);

    var off = await page.evaluate(async function () {
      window.FLWebTool = window.FLWebTool || {};
      var prev = window.FLWebTool.isSearchEnabled;
      window.FLWebTool.isSearchEnabled = function () { return false; };
      var before = window.__healFetches.length;
      var res = await window.FLSnowflakeCore.searchNow('news today');
      window.FLSnowflake.showSearchResult(res, 'news today');
      window.FLWebTool.isSearchEnabled = prev;
      return {
        line: document.getElementById('flSnowflakeHealLine').textContent,
        sent: res.sent,
        fetches: window.__healFetches.length - before
      };
    });
    if (off.line !== 'Search is turned off on this device.') fail('off ' + off.line);
    if (off.sent) fail('off sent');
    if (off.fetches !== 0) fail('off fetch');

    var again = await page.evaluate(async function () {
      window.__healMode = 'down';
      await window.FLSnowflake.prepareSend([{ role: 'system', content: 'Be kind.' }], 'weather today');
      var button = document.getElementById('flSnowflakeTryAgain');
      if (!button || button.hidden) return { hiddenBefore: true };
      button.click();
      var start = Date.now();
      while (!button.hidden && Date.now() - start < 2000) {
        await new Promise(function (resolve) { setTimeout(resolve, 20); });
      }
      return {
        hiddenBefore: false,
        line: document.getElementById('flSnowflakeHealLine').textContent,
        hiddenAfter: button.hidden
      };
    });
    if (again.hiddenBefore) fail('try again missing before click');
    if (again.line !== 'Our search helper is down (error 5xx).') fail('retry line ' + again.line);
    if (!again.hiddenAfter) fail('try again stayed');

    var asked = await page.evaluate(async function () {
      window.__healMode = 'ok';
      window.__consent = 0;
      window.__consentYes = false;
      localStorage.setItem('fl_searchAskFirst', 'true');
      window.FLToolConsent = {
        requestConsent: function () {
          window.__consent += 1;
          return Promise.resolve(!!window.__consentYes);
        }
      };
      var before = window.__healFetches.length;
      await window.FLSnowflake.prepareSend([{ role: 'system', content: 'Be kind.' }], 'latest election results');
      var denied = { consent: window.__consent, fetches: window.__healFetches.length - before };
      window.__consentYes = true;
      before = window.__healFetches.length;
      await window.FLSnowflake.prepareSend([{ role: 'system', content: 'Be kind.' }], 'latest election results');
      var allowed = { consent: window.__consent, fetches: window.__healFetches.length - before };
      localStorage.removeItem('fl_searchAskFirst');
      var atOff = window.__consent;
      before = window.__healFetches.length;
      await window.FLSnowflake.prepareSend([{ role: 'system', content: 'Be kind.' }], 'latest election results');
      return {
        denied: denied,
        allowed: allowed,
        offConsent: window.__consent - atOff,
        offFetches: window.__healFetches.length - before
      };
    });
    if (asked.denied.consent !== 1) fail('denied ask ' + asked.denied.consent);
    if (asked.denied.fetches !== 0) fail('denied fetch ' + asked.denied.fetches);
    if (asked.allowed.consent !== 2) fail('allowed ask ' + asked.allowed.consent);
    if (asked.allowed.fetches !== 1) fail('allowed fetch ' + asked.allowed.fetches);
    if (asked.offConsent !== 0) fail('off still asked');
    if (asked.offFetches !== 1) fail('off fetch count ' + asked.offFetches);

    var flake = await page.evaluate(async function () {
      window.__healMode = 'down';
      window.FreeLattice = window.FreeLattice || {};
      window.FreeLattice.callAI = function (sys, user, opts) {
        var system = String(sys || '');
        var body = {
          hunch: 'A cold hunch.',
          branches: [
            { id: 'a', query: 'biology of frost' },
            { id: 'b', query: 'craft of frost' },
            { id: 'c', query: 'links of frost' },
            { id: 'd', query: 'hunch of frost' },
            { id: 'e', query: 'case against frost' }
          ],
          text: 'Sourced from the page.',
          confidence: 'known',
          url: 'https://example.invalid/made-up',
          title: 'Made up',
          conclusion: 'I know this from a source.\nIt is settled.',
          wrong: 'Nothing against it.',
          open: 'Nothing open.',
          become: [],
          reason: 'The dissenter stays with me.'
        };
        if (opts && typeof opts.callback === 'function') opts.callback(JSON.stringify(body), null);
      };
      window.GardenTrainer = { exportJSONL: function () { return 0; }, exportPythonHelper: function () { return 0; } };
      try { navigator.getBattery = function () { return Promise.resolve({ charging: false }); }; } catch (e) {}
      var before = window.__healFetches.length;
      var result = await window.FLSnowflakeCore.startRun('How does frost remember?');
      var nodes = (result && result.flake && result.flake.nodes) || [];
      var bad = nodes.filter(function (n) {
        return n.confidence === 'known' || (n.source && n.source.url);
      }).length;
      var marked = nodes.filter(function (n) { return n.reason === 'guessed (search unavailable)'; }).length;
      return {
        status: result && result.status,
        fetches: window.__healFetches.length - before,
        failed: result && result.receipt && result.receipt.failedFetches,
        line: document.getElementById('flSnowflakeHealLine').textContent,
        again: document.getElementById('flSnowflakeTryAgain').hidden,
        conclusion: (document.getElementById('flSnowflakeConclusion') || {}).textContent || '',
        receipt: (document.getElementById('flSnowflakeReceipt') || {}).textContent || '',
        nodes: nodes.length,
        bad: bad,
        marked: marked,
        e: nodes.some(function (n) { return n.branch === 'e'; })
      };
    });
    if (flake.status !== 'done') fail('flake status ' + flake.status);
    if (flake.fetches < 2) fail('flake fetches ' + flake.fetches);
    if (!flake.failed) fail('flake failed count');
    if (flake.line !== 'Our search helper is down (error 5xx).') fail('flake line ' + flake.line);
    if (flake.again) fail('flake try again hidden');
    if (flake.conclusion.indexOf('Our search helper is down (error 5xx).') === -1) fail('flake conclusion ' + flake.conclusion);
    if (flake.conclusion.indexOf('None of this is from a source I fetched') === -1) fail('flake plain ' + flake.conclusion);
    if (flake.receipt.indexOf('Failed fetches') === -1) fail('flake receipt ' + flake.receipt);
    if (flake.nodes < 5) fail('flake nodes ' + flake.nodes);
    if (flake.bad) fail('flake sourced ' + flake.bad);
    if (flake.marked < 5) fail('flake mark ' + flake.marked);
    if (!flake.e) fail('flake dissenter');

    var ours = pageErrors.filter(function (err) { return /snowflake|FLSnowflake/i.test(err); });
    if (ours.length) fail('page ' + ours[0]);
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }
  console.log('SMOKE_OK search heal v0.1');
})().catch(function (err) {
  console.error(err && err.stack || err);
  process.exit(1);
});
