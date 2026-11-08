#!/usr/bin/env node
// v-snowflake-reach-v0.1 live helper probe.
// This is a real network call to the configured search helper.
// It does not call a model, does not open the Quiet Room, and does not
// pass a green unit fixture off as a live search.
// Exit 0 with REAL_BLOCKED when the network itself cannot be reached.
// Exit 1 when the helper answers with something that is not search results.
'use strict';

var ENDPOINT = process.env.FL_SEARCH_ENDPOINT || 'https://freelattice-data.freelattice.workers.dev/search';

function httpUrl(value) {
  return /^https?:\/\//i.test(String(value || ''));
}

(async function () {
  var origin = 'https://freelattice.com';
  var res;
  try {
    res = await fetch(ENDPOINT + '?q=' + encodeURIComponent('solar energy'), {
      headers: { Origin: origin, Accept: 'application/json' }
    });
  } catch (err) {
    console.log('REAL_BLOCKED ' + (err && err.message ? err.message : 'network'));
    console.log('LIVE endpoint ' + ENDPOINT);
    process.exit(0);
  }
  var text = await res.text();
  var data = null;
  try { data = JSON.parse(text); } catch (e) { data = null; }
  var items = data && Array.isArray(data.items) ? data.items : null;
  var good = items && items.filter(function (item) { return item && httpUrl(item.url) && (item.title || item.snippet); });
  console.log('LIVE status ' + res.status + ' origin ' + origin + ' acao ' + (res.headers.get('access-control-allow-origin') || ''));
  console.log('LIVE source ' + (data && data.source ? data.source : ''));
  console.log('LIVE items ' + (good ? good.length : 0));
  if (res.status !== 200 || !good || !good.length) {
    console.log('REAL_FAIL helper did not return sourced items');
    console.log(text.slice(0, 300));
    process.exit(1);
  }
  if (data && data.source && /duckduckgo|wikipedia/i.test(String(data.source))) {
    console.log('LIVE note reference answers, not live news');
  }
  var other;
  try {
    other = await fetch(ENDPOINT + '?q=' + encodeURIComponent('solar energy'), {
      headers: { Origin: 'https://example.invalid', Accept: 'application/json' }
    });
    console.log('LIVE other-origin status ' + other.status + ' acao ' + (other.headers.get('access-control-allow-origin') || ''));
  } catch (err2) {
    console.log('LIVE other-origin blocked ' + (err2 && err2.message ? err2.message : 'network'));
  }
  console.log('REAL_OK search helper');
})().catch(function (err) {
  console.error(err && err.stack || err);
  process.exit(1);
});
