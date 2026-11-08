#!/usr/bin/env node
// v-snowflake-reach-v0.1 cache strategy fixture.
// Isolated page and the snowflake fetch branch only. Does not open app.html,
// does not execute docs/sw.js, and does not precache the app shell. The full
// worker returns before any fetch on 127.0.0.1, so this fixture is not an
// installed-app proof. Quiet was not requested.
'use strict';

var fs = require('fs');
var http = require('http');
var path = require('path');

function fail(msg) {
  console.error('FAIL ' + msg);
  process.exit(1);
}

var root = path.join(__dirname, '..', '..');
var swText = fs.readFileSync(path.join(root, 'docs/sw.js'), 'utf8');
var branch = swText.indexOf("if (/\\/modules\\/snowflake-(core|search)\\.js$/.test(url.pathname)");
var end = swText.indexOf('// Cache-first strategy', branch);
if (branch < 0 || end < branch) fail('snowflake branch missing');
var slice = swText.slice(branch, end);
if (slice.indexOf("fetch(event.request.url, { cache: 'no-store', credentials: 'same-origin' })") < 0) fail('no-store fetch missing');
if (slice.indexOf('fetch(event.request)') !== -1) fail('branch still forwards event.request');
if (slice.indexOf('networkResponse.status === 200') < 0) fail('200-only cache write missing');
if (slice.indexOf('cache.put(event.request, responseClone)') < 0) fail('cache key is not the original request');
if (slice.indexOf('return networkResponse;') < 0) fail('non-200 is not returned');
if (slice.indexOf('caches.match(event.request)') < 0) fail('network-failure fallback missing');
var live = swText.match(/^\s*const CACHE_NAME\s*=\s*'freelattice-v([^']+)'/m);
if (!live || live[1] !== '5.79.46') fail('live cache constant ' + (live && live[1]));

function worker(who, fetchCall) {
  return [
    "const CACHE_NAME = 'freelattice-v5.79.46';",
    "self.addEventListener('install', function () { self.skipWaiting(); });",
    "self.addEventListener('activate', function (event) { event.waitUntil(self.clients.claim()); });",
    "self.addEventListener('fetch', function (event) {",
    "  var url = new URL(event.request.url);",
    "  if (url.pathname === '/who') { event.respondWith(new Response(" + JSON.stringify(who) + ")); return; }",
    slice.replace(
      "fetch(event.request.url, { cache: 'no-store', credentials: 'same-origin' })",
      fetchCall
    ),
    "});"
  ].join('\n');
}

var oldFetch = worker('old', 'fetch(event.request)');
var nowFetch = worker('now', "fetch(event.request.url, { cache: 'no-store', credentials: 'same-origin' })");
if (nowFetch.indexOf("cache: 'no-store'") < 0) fail('fixture lost no-store');
if (oldFetch.indexOf('fetch(event.request.url') !== -1) fail('old fixture is not the old fetch');

var fixture = [
  '<!doctype html><title>cache strategy</title>',
  '<script>',
  'localStorage.setItem("fl_user_kept","kept-flake");',
  'navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });',
  '</script>'
].join('');

var state = { worker: oldFetch, body: 'OLD', status: 200, drop: false };
var assetHits = 0;

function serve() {
  return new Promise(function (resolve) {
    var server = http.createServer(function (req, res) {
      var urlPath = (req.url || '/').split('?')[0];
      if (urlPath === '/fixture.html') {
        res.setHeader('content-type', 'text/html; charset=utf-8');
        res.setHeader('cache-control', 'no-store');
        res.end(fixture);
        return;
      }
      if (urlPath === '/sw.js') {
        res.setHeader('content-type', 'text/javascript; charset=utf-8');
        res.setHeader('cache-control', 'no-store');
        res.end(state.worker);
        return;
      }
      if (urlPath === '/modules/snowflake-search.js') {
        assetHits += 1;
        if (state.drop) { res.destroy(); return; }
        res.statusCode = state.status;
        res.setHeader('content-type', 'text/javascript; charset=utf-8');
        res.setHeader('cache-control', 'max-age=600');
        res.end(state.body);
        return;
      }
      res.statusCode = 404;
      res.end('no');
    });
    server.listen(0, '127.0.0.1', function () { resolve(server); });
  });
}

function waitFor(page, who) {
  return page.evaluate(function (want) {
    function whenControlled() {
      if (navigator.serviceWorker.controller) return Promise.resolve();
      return new Promise(function (resolve) {
        navigator.serviceWorker.addEventListener('controllerchange', function () { resolve(); }, { once: true });
      });
    }
    return navigator.serviceWorker.ready.then(function () { return whenControlled(); }).then(function () {
      return navigator.serviceWorker.getRegistration();
    }).then(function (reg) {
      return new Promise(function (resolve, reject) {
        var settled = false;
        var timer = setTimeout(function () {
          if (settled) return;
          settled = true;
          reject(new Error('controller stayed ' + want));
        }, 8000);
        function finish() {
          if (settled || !navigator.serviceWorker.controller) return;
          fetch('/who', { cache: 'no-store' }).then(function (res) { return res.text(); }).then(function (text) {
            if (settled || text !== want) return;
            settled = true;
            clearTimeout(timer);
            resolve(text);
          }).catch(function () {});
        }
        navigator.serviceWorker.addEventListener('controllerchange', finish);
        reg.addEventListener('updatefound', function () {
          var installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', function () {
            if (installing.state === 'activated') finish();
          });
        });
        finish();
        fetch('/who', { cache: 'no-store' }).then(function (res) { return res.text(); }).then(function (text) {
          if (text === want) return null;
          return reg.update();
        }).catch(function (err) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(err);
        });
      });
    });
  }, who);
}

(async function () {
  var pwPath = process.env.FL_PLAYWRIGHT || '/tmp/gc-pw-local/node_modules/playwright-core';
  var pw;
  try { pw = require(pwPath); } catch (e) {
    console.log('STRATEGY_BLOCKED playwright-core not loaded');
    process.exit(0);
  }
  var chrome = process.env.FL_CHROME || '/usr/local/bin/google-chrome';
  var server = await serve();
  var port = server.address().port;
  var browser = await pw.chromium.launch({
    executablePath: chrome,
    headless: true,
    args: ['--no-sandbox']
  });
  try {
    var run;
    for (run = 1; run <= 3; run++) {
      state.worker = oldFetch;
      state.body = 'OLD';
      state.status = 200;
      state.drop = false;
      assetHits = 0;
      var context = await browser.newContext();
      var page = await context.newPage();
      page.setDefaultTimeout(15000);
      await page.goto('http://127.0.0.1:' + port + '/fixture.html', { waitUntil: 'load' });
      await waitFor(page, 'old');
      async function grab() {
        return page.evaluate(async function () {
          var res = await fetch('/modules/snowflake-search.js');
          return { status: res.status, body: await res.text() };
        });
      }
      var before = assetHits;
      var first = await grab();
      if (first.status !== 200 || first.body !== 'OLD') fail('run ' + run + ' first ' + JSON.stringify(first));
      if (assetHits !== before + 1) fail('run ' + run + ' first did not reach the server');
      state.body = 'NEW';
      var atStuck = assetHits;
      var stuck = await grab();
      if (stuck.status !== 200 || stuck.body !== 'OLD') fail('run ' + run + ' old fetch did not keep OLD ' + JSON.stringify(stuck));
      if (assetHits !== atStuck) fail('run ' + run + ' warm max-age=600 still hit the server');
      state.worker = nowFetch;
      await waitFor(page, 'now');
      var updated = await grab();
      if (updated.status !== 200 || updated.body !== 'NEW') fail('run ' + run + ' no-store ' + JSON.stringify(updated));
      state.status = 404;
      state.body = 'missing';
      var missing = await grab();
      if (missing.status !== 404 || missing.body !== 'missing') fail('run ' + run + ' 404 ' + JSON.stringify(missing));
      state.status = 503;
      state.body = 'unavailable';
      var down = await grab();
      if (down.status !== 503 || down.body !== 'unavailable') fail('run ' + run + ' 503 ' + JSON.stringify(down));
      state.drop = true;
      var fell = await grab();
      if (!fell || fell.status !== 200 || fell.body !== 'NEW') fail('run ' + run + ' fallback ' + JSON.stringify(fell));
      var kept = await page.evaluate(function () { return localStorage.getItem('fl_user_kept'); });
      if (kept !== 'kept-flake') fail('run ' + run + ' storage ' + kept);
      await context.close();
      console.log('STRATEGY_RUN ' + run + ' old-fetch kept OLD. no-store fetched NEW. kept-flake.');
    }
    console.log('STRATEGY_OK 3/3 isolated branch. Not an installed app. Quiet was not requested.');
  } finally {
    await browser.close();
    server.close();
  }
})().catch(function (err) {
  console.error(err && err.stack || err);
  process.exit(1);
});
