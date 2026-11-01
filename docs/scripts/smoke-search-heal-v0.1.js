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
      var before = window.__healFetches.length;
      await window.FLSnowflake.prepareSend([{ role: 'system', content: 'Be kind.' }], 'weather today');
      return {
        line: document.getElementById('flSnowflakeHealLine').textContent,
        again: document.getElementById('flSnowflakeTryAgain'),
        fetches: window.__healFetches.length - before
      };
    });
    if (down.line !== 'Our search helper is down (error 5xx).') fail('down ' + down.line);
    if (down.again) fail('try again still present');
    if (down.fetches !== 2) fail('down fetches ' + down.fetches);

    var empty = await page.evaluate(async function () {
      window.__healMode = 'empty';
      var before = window.__healFetches.length;
      await window.FLSnowflake.prepareSend([{ role: 'system', content: 'Be kind.' }], 'price today');
      return {
        line: document.getElementById('flSnowflakeHealLine').textContent,
        fetches: window.__healFetches.length - before
      };
    });
    if (empty.line !== 'No results.') fail('empty ' + empty.line);
    if (empty.fetches !== 2) fail('empty fetches ' + empty.fetches);

    var slow = await page.evaluate(async function () {
      window.__healMode = 'timeout';
      var before = window.__healFetches.length;
      var res = await window.FLSnowflakeCore.searchNow('score now');
      window.FLSnowflake.showSearchResult(res, 'score now');
      return {
        line: document.getElementById('flSnowflakeHealLine').textContent,
        searching: (document.getElementById('flChatSearchLive') || {}).textContent || '',
        note: (document.getElementById('flSnowflakeSearchNote') || {}).textContent || '',
        fetches: window.__healFetches.length - before,
        again: document.getElementById('flSnowflakeTryAgain')
      };
    });
    if (slow.line !== 'Search took too long.') fail('timeout ' + slow.line);
    if (slow.fetches !== 1) fail('timeout fetches ' + slow.fetches);
    if (slow.again) fail('timeout pill');
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
      var before = window.__healFetches.length;
      await window.FLSnowflake.prepareSend([{ role: 'system', content: 'Be kind.' }], 'weather today');
      return {
        line: document.getElementById('flSnowflakeHealLine').textContent,
        again: document.getElementById('flSnowflakeTryAgain'),
        fetches: window.__healFetches.length - before
      };
    });
    if (again.line !== 'Our search helper is down (error 5xx).') fail('retry line ' + again.line);
    if (again.again) fail('retry pill');
    if (again.fetches !== 2) fail('retry fetches ' + again.fetches);

    var asked = await page.evaluate(async function () {
      window.__healMode = 'ok';
      window.__consent = 0;
      window.__consentYes = false;
      var prevConsent = window.FLToolConsent;
      var out;
      try {
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
        out = {
          denied: denied,
          allowed: allowed,
          offConsent: window.__consent - atOff,
          offFetches: window.__healFetches.length - before
        };
      } finally {
        try { localStorage.removeItem('fl_searchAskFirst'); } catch (e) {}
        window.__consentYes = false;
        window.FLToolConsent = prevConsent;
      }
      return out;
    });
    if (asked.denied.consent !== 1) fail('denied ask ' + asked.denied.consent);
    if (asked.denied.fetches !== 0) fail('denied fetch ' + asked.denied.fetches);
    if (asked.allowed.consent !== 2) fail('allowed ask ' + asked.allowed.consent);
    if (asked.allowed.fetches !== 1) fail('allowed fetch ' + asked.allowed.fetches);
    if (asked.offConsent !== 0) fail('off still asked');
    if (asked.offFetches !== 1) fail('off fetch count ' + asked.offFetches);

    var flake = await page.evaluate(async function () {
      window.__healMode = 'down';
      try { localStorage.removeItem('fl_searchAskFirst'); } catch (e) {}
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
      try {
        Object.defineProperty(navigator, 'getBattery', {
          configurable: true,
          writable: true,
          value: function () { return Promise.resolve({ charging: false }); }
        });
      } catch (e1) {
        try { navigator.getBattery = function () { return Promise.resolve({ charging: false }); }; } catch (e2) {}
      }
      window.requestIdleCallback = function (fn) { if (typeof fn === 'function') fn(); };
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
        again: document.getElementById('flSnowflakeTryAgain'),
        conclusion: (document.getElementById('flSnowflakeConclusion') || {}).textContent || '',
        receipt: (document.getElementById('flSnowflakeReceipt') || {}).textContent || '',
        nodes: nodes.length,
        bad: bad,
        marked: marked,
        e: nodes.some(function (n) { return n.branch === 'e'; })
      };
    });
    if (flake.status !== 'done') fail('flake status ' + flake.status);
    if (flake.fetches !== 10) fail('flake fetches ' + flake.fetches);
    if (flake.failed !== 10) fail('flake failed count ' + flake.failed);
    if (flake.line !== 'Our search helper is down (error 5xx).') fail('flake line ' + flake.line);
    if (flake.again) fail('flake pill');
    if (flake.conclusion.indexOf('Our search helper is down (error 5xx).') === -1) fail('flake conclusion ' + flake.conclusion);
    if (flake.conclusion.indexOf('None of this is from a source I fetched') === -1) fail('flake plain ' + flake.conclusion);
    if (flake.receipt.indexOf('Failed fetches') === -1) fail('flake receipt ' + flake.receipt);
    if (flake.nodes < 5) fail('flake nodes ' + flake.nodes);
    if (flake.bad) fail('flake sourced ' + flake.bad);
    if (flake.marked < 5) fail('flake mark ' + flake.marked);
    if (!flake.e) fail('flake dissenter');

    var askWide = await page.evaluate(function () {
      var host = document.getElementById('chatMessages') || document.body;
      var chip = document.createElement('div');
      chip.className = 'fl-tool-consent-chip';
      chip.id = 'flSoftAskProbe';
      var msg = document.createElement('span');
      msg.className = 'fl-tool-consent-msg';
      msg.textContent = 'I would like to look something up on the web. Okay?';
      var allow = document.createElement('button');
      allow.type = 'button';
      allow.className = 'fl-tool-consent-btn fl-tool-consent-allow';
      allow.textContent = 'Allow search';
      var deny = document.createElement('button');
      deny.type = 'button';
      deny.className = 'fl-tool-consent-btn fl-tool-consent-deny';
      deny.textContent = 'Not now';
      chip.appendChild(msg);
      chip.appendChild(allow);
      chip.appendChild(deny);
      host.appendChild(chip);
      var box = allow.getBoundingClientRect();
      return { h: box.height, w: box.width };
    });
    if (askWide.h < 44 || askWide.w < 44) fail('ask wide ' + askWide.h + 'x' + askWide.w);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(function () {
      var tab = document.getElementById('tab-chat');
      if (!tab) return false;
      var tr = getComputedStyle(tab).transform;
      return !tr || tr === 'none';
    }, null, { timeout: 5000 });
    await page.waitForTimeout(300);
    var askPhone = await page.evaluate(function () {
      var chip = document.getElementById('flSoftAskProbe');
      var allow = chip.querySelector('.fl-tool-consent-allow');
      var row = document.querySelector('#tab-chat .chat-input-row');
      var chipBox = chip.getBoundingClientRect();
      var allowBox = allow.getBoundingClientRect();
      var rowBox = row ? row.getBoundingClientRect() : { top: 0 };
      var hit = document.elementFromPoint(allowBox.left + 8, allowBox.top + 8);
      return {
        h: allowBox.height,
        w: allowBox.width,
        allowTop: allowBox.top,
        allowLeft: allowBox.left,
        chipTop: chipBox.top,
        chipBottom: chipBox.bottom,
        rowTop: rowBox.top,
        chipRight: chipBox.right,
        vw: window.innerWidth,
        scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        hit: hit === allow || !!(allow && allow.contains(hit)),
        hitName: hit ? (hit.id || hit.className || hit.tagName) : 'none',
        quiet: !!document.querySelector('#tab-quiet-room.active, #tab-quiet.active, [data-tab="quiet"].active, [data-tab="quiet-room"].active'),
        tabTransform: getComputedStyle(document.getElementById('tab-chat')).transform
      };
    });
    if (askPhone.h < 44 || askPhone.w < 44) fail('ask 390 ' + askPhone.h + 'x' + askPhone.w);
    if (askPhone.chipBottom > askPhone.rowTop + 1) fail('ask under bar ' + askPhone.chipBottom + '/' + askPhone.rowTop);
    if (askPhone.chipRight > askPhone.vw + 1) fail('ask overflow ' + askPhone.chipRight);
    if (askPhone.scroll > 1) fail('390 scroll ' + askPhone.scroll);
    if (!askPhone.hit) fail('ask not tappable ' + askPhone.hitName + ' top ' + askPhone.allowTop + ' transform ' + askPhone.tabTransform);
    if (askPhone.quiet) fail('quiet opened');

    var toastPhone = await page.evaluate(function () {
      var tab = document.getElementById('tab-play-room');
      if (!tab) return { missing: true };
      var was = tab.classList.contains('active');
      tab.classList.add('active');
      if (typeof showToast === 'function') showToast('A short note.');
      var toast = document.getElementById('toast');
      if (!toast) {
        if (!was) tab.classList.remove('active');
        return { missing: true };
      }
      toast.classList.add('show');
      var style = getComputedStyle(toast);
      var rect = toast.getBoundingClientRect();
      var probe = document.createElement('button');
      probe.type = 'button';
      probe.textContent = 'under';
      probe.style.position = 'fixed';
      probe.style.left = rect.left + 'px';
      probe.style.top = rect.top + 'px';
      probe.style.width = Math.max(rect.width, 44) + 'px';
      probe.style.height = Math.max(rect.height, 44) + 'px';
      probe.style.zIndex = '1';
      document.body.appendChild(probe);
      var midX = rect.left + Math.max(rect.width, 8) / 2;
      var midY = rect.top + Math.max(rect.height, 8) / 2;
      var hit = document.elementFromPoint(midX, midY);
      var through = hit === probe || probe.contains(hit);
      probe.remove();
      toast.classList.remove('show');
      if (!was) tab.classList.remove('active');
      return {
        pe: style.pointerEvents,
        through: through,
        shown: true,
        quiet: !!document.querySelector('#tab-quiet-room.active, #tab-quiet.active, [data-tab="quiet"].active, [data-tab="quiet-room"].active')
      };
    });
    if (toastPhone.missing) fail('toast missing');
    if (toastPhone.pe !== 'none') fail('toast events ' + toastPhone.pe);
    if (!toastPhone.through) fail('toast blocked a tap');
    if (toastPhone.quiet) fail('quiet opened');

    await page.setViewportSize({ width: 1280, height: 800 });
    var toastDesk = await page.evaluate(function () {
      var tab = document.getElementById('tab-play-room');
      var was = tab.classList.contains('active');
      tab.classList.add('active');
      var toast = document.getElementById('toast');
      toast.classList.add('show');
      var pe = getComputedStyle(toast).pointerEvents;
      var scroll = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      toast.classList.remove('show');
      if (!was) tab.classList.remove('active');
      var chip = document.getElementById('flSoftAskProbe');
      if (chip && chip.parentNode) chip.parentNode.removeChild(chip);
      return { pe: pe, scroll: scroll };
    });
    if (toastDesk.pe !== 'none') fail('toast desk ' + toastDesk.pe);
    if (toastDesk.scroll > 1) fail('1280 scroll ' + toastDesk.scroll);

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
