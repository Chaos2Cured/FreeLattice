#!/usr/bin/env node
// v-snowflake-reach-v0.1 cache strategy fixture.
// Isolated page and isolated worker. Does not open app.html, docs/sw.js as a
// running worker, or the Quiet Room. This is not an installed-app proof.
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
if (branch < 0) fail('snowflake branch missing');
var slice = swText.slice(branch, branch + 700);
if (slice.indexOf('networkResponse.status === 200') < 0) fail('200-only cache write missing');
if (slice.indexOf('return networkResponse;') < 0) fail('non-200 is not returned');
if (slice.indexOf('caches.match(event.request)') < 0) fail('network-failure fallback missing');
var live = swText.match(/^\s*const CACHE_NAME\s*=\s*'freelattice-v([^']+)'/m);
if (!live || live[1] !== '5.79.46') fail('live cache constant ' + (live && live[1]));

var V1 = [
  "self.addEventListener('install', function (event) { self.skipWaiting(); });",
  "self.addEventListener('activate', function (event) { event.waitUntil(self.clients.claim()); });",
  "self.addEventListener('fetch', function (event) {",
  "  var url = new URL(event.request.url);",
  "  if (url.pathname === '/who') { event.respondWith(new Response('v1')); return; }",
  "  if (url.pathname !== '/asset.js') return;",
  "  event.respondWith(caches.match(event.request).then(function (cached) {",
  "    if (cached) return cached;",
  "    return fetch(event.request).then(function (res) {",
  "      var put = Promise.resolve();",
  "      if (res && res.status === 200) {",
  "        var copy = res.clone();",
  "        put = caches.open('iso').then(function (cache) { return cache.put(event.request, copy); });",
  "      }",
  "      return put.then(function () { return res; });",
  "    });",
  "  }));",
  "});"
].join('\n');

var V2 = [
  "self.addEventListener('install', function (event) { self.skipWaiting(); });",
  "self.addEventListener('activate', function (event) { event.waitUntil(self.clients.claim()); });",
  "self.addEventListener('fetch', function (event) {",
  "  var url = new URL(event.request.url);",
  "  if (url.pathname === '/who') { event.respondWith(new Response('v2')); return; }",
  "  if (url.pathname !== '/asset.js') return;",
  "  event.respondWith(fetch(event.request).then(function (networkResponse) {",
  "    var put = Promise.resolve();",
  "    if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {",
  "      var responseClone = networkResponse.clone();",
  "      put = caches.open('iso').then(function (cache) { return cache.put(event.request, responseClone); });",
  "    }",
  "    return put.then(function () { return networkResponse; });",
  "  }).catch(function () { return caches.match(event.request); }));",
  "});"
].join('\n');

var fixture = [
  '<!doctype html><title>cache strategy</title>',
  '<script>',
  'navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });',
  '</script>'
].join('');

var state = { worker: V1, body: 'OLD', status: 200, drop: false };

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
      if (urlPath === '/asset.js') {
        if (state.drop) { res.destroy(); return; }
        res.statusCode = state.status;
        res.setHeader('content-type', 'text/plain; charset=utf-8');
        res.setHeader('cache-control', 'no-store');
        res.end(state.body);
        return;
      }
      res.statusCode = 404;
      res.end('no');
    });
    server.listen(0, '127.0.0.1', function () { resolve(server); });
  });
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
  var browser = await pw.chromium.launch({ executablePath: chrome, headless: true });
  try {
    var page = await browser.newPage();
    page.setDefaultTimeout(15000);
    await page.goto('http://127.0.0.1:' + port + '/fixture.html');
    await page.waitForFunction(function () { return navigator.serviceWorker.controller; });
    async function who() {
      return page.evaluate(async function () {
        var res = await fetch('/who', { cache: 'no-store' });
        return res.text();
      });
    }
    async function grab() {
      return page.evaluate(async function () {
        var res = await fetch('/asset.js', { cache: 'no-store' });
        return { status: res.status, body: await res.text() };
      });
    }
    var first = await grab();
    if (first.status !== 200 || first.body !== 'OLD') fail('first ' + JSON.stringify(first));
    state.body = 'NEW';
    var stuck = await grab();
    if (stuck.status !== 200 || stuck.body !== 'OLD') fail('old worker did not keep OLD ' + JSON.stringify(stuck));
    state.worker = V2;
    await page.evaluate(function () {
      return navigator.serviceWorker.getRegistration().then(function (reg) { return reg.update(); });
    });
    var sawV2 = false;
    var spins = 0;
    while (!sawV2 && spins < 20) {
      spins += 1;
      var name = await who();
      if (name === 'v2') sawV2 = true;
      else await page.waitForTimeout(200);
    }
    if (!sawV2) fail('controller stayed on v1');
    var updated = await grab();
    if (updated.status !== 200 || updated.body !== 'NEW') fail('updated worker ' + JSON.stringify(updated));
    state.status = 503;
    state.body = 'unavailable';
    var down = await grab();
    if (down.status !== 503 || down.body !== 'unavailable') fail('503 fell back ' + JSON.stringify(down));
    state.drop = true;
    var fell = await grab();
    if (!fell || fell.status !== 200 || fell.body !== 'NEW') fail('network fallback ' + JSON.stringify(fell));
    console.log('STRATEGY_OK isolated worker. Not an installed app. Quiet was not requested.');
  } finally {
    await browser.close();
    server.close();
  }
})().catch(function (err) {
  console.error(err && err.stack || err);
  process.exit(1);
});
