// snowflake-core.js (MIT)
// v-snowflake-search-v0.1 v-snowflake-grow-v0.1 v-search-heal-v0.1 v-snowflake-reach-v0.1
// No DOM. Nodes, canonical JSON, signing, dual hash, psi, ledger, caps,
// checkpoint, scheduler, growth queue. A later Tree twin can share this file.
// Safety here is the ledger and the rollback. The press is the commitment.
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FLSnowflakeCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var VERSION = 'v-snowflake-search-v0.1';
  var GROW = 'v-snowflake-grow-v0.1';
  var HEAL = 'v-search-heal-v0.1';
  var REACH = 'v-snowflake-reach-v0.1';
  var SIGMA = 'Curiosity crystallizes.';
  var DB_NAME = 'fl_snowflake_v0';
  var STORE = 'fl_snowflake_v0';
  var LS_FLAKES = 'fl_snowflake_v0';
  var LS_LEDGER = 'fl_snowflake_ledger_v0';
  var LS_QUEUE = 'fl_snowflake_train_queue_v0';
  var LS_ADAPTERS = 'fl_snowflake_adapters_v0';
  var LS_CHECKPOINT = 'fl_snowflake_checkpoint_v0';
  var LS_RINGS = 'fl_snowflake_rings_v0';
  var LS_RUNS = 'fl_snowflake_runs_v0';
  var LS_REPLAY = 'fl_snowflake_replay_v0';
  var LS_METER = 'fl_snowflake_meter_v0';
  // v-ai-chosen-learning-v0.1: the mind picks how it learns. This is a menu it can extend, not a rule.
  var LEARN = 'v-ai-chosen-learning-v0.1';
  var LEARN_METHODS = ['soft-prompt', 'memory-vector', 'lora', 'note'];
  var FLAKE_CAP = 24;
  var CALL_CAP = 24;
  var FETCH_CAP = 30;
  var BRANCH_CAP = 8;
  var DEPTH_CAP = 2;
  var TIMEOUT_MS = 60000;
  var RUNS_PER_HOUR = 3;
  var HOUR = 60 * 60 * 1000;
  var DAY = 24 * HOUR;

  var CAPS = {
    calls: CALL_CAP,
    fetches: FETCH_CAP,
    branches: BRANCH_CAP,
    depth: DEPTH_CAP,
    timeoutMs: TIMEOUT_MS,
    runsPerHour: RUNS_PER_HOUR,
    flakes: FLAKE_CAP
  };

  var LINES = {
    timeout: 'Search took too long.',
    off: 'Search is turned off on this device.',
    down: 'Our search helper is down (error 5xx).',
    empty: 'No results.',
    secret: 'That looks like a key. It stays here.',
    declined: 'Not now. This one was not looked up.',
    callTimeout: 'That call took too long.',
    callFail: 'That call did not come back.',
    absent: 'No AI connected yet. Connect a mind in Settings. Sources can still be looked up.',
    localUnreached: 'Could not reach local AI. Check that it is running, then Grow again.',
    unreachable: 'Could not reach the search helper from this page. Check the connection. If this page is not a FreeLattice origin, the helper may be refusing it.',
    badHelper: 'The search helper answered, but not with results.',
    busyHelper: 'The search helper is busy. Try again in a moment.',
    emptyAsk: 'Tell me what you want to understand.',
    busy: 'A snowflake is already growing.',
    capped: 'This device already grew three snowflakes this hour.',
    held: 'Held. Nothing was lost.',
    unread: 'Source fetched. No mind read it, so these stay the source\'s own words.',
    unsynthesized: 'Sources were fetched.\nNo mind read them, so this stays a guess.',
    memoryNo: 'Memory in context: no.',
    memoryYes: 'Memory in context: yes.',
    unsourced: 'None of this is from a source I fetched, so it stays a guess.',
    unmade: 'These lookups were not made.\nWhat I can say here is a guess.',
    seal: 'The seal is one device signature plus the mind\'s hash.'
  };

  var FLOOR = [
    { id: 'a', name: 'Underneath' },
    { id: 'b', name: 'The craft' },
    { id: 'c', name: 'Hidden connections' },
    { id: 'd', name: 'hunch' },
    { id: 'e', name: 'dissenter' }
  ];

  var DRIFT = [
    'What promise can you keep on this device?',
    'When a source disagrees, what do you keep?',
    'What does a hunch need beside it?',
    'How do you treat a mind who sees it differently?',
    'What stays when a page is gone?',
    'What question is still open?'
  ];

  var RANK = { 'source-with-motive': 0, guessed: 1, known: 2 };
  var CONF = { 0: 'source-with-motive', 1: 'guessed', 2: 'known' };

  var mem = {};
  var dbp = null;
  var ident = null;
  var active = null;
  var holdGrowth = false;
  var timer = null;
  var searchShows = 0;
  var writes = 0;
  var fetchesSent = 0;

  function clip(s, n) {
    s = s == null ? '' : String(s);
    return s.length > n ? s.slice(0, n) : s;
  }

  function toHex(bytes) {
    var s = '';
    var i;
    for (i = 0; i < bytes.length; i++) s += ('0' + bytes[i].toString(16)).slice(-2);
    return s;
  }

  function sha256Hex(str) {
    var subtle = root.crypto && root.crypto.subtle;
    if (!subtle || !subtle.digest) return Promise.resolve('');
    var data = new TextEncoder().encode(String(str));
    return subtle.digest('SHA-256', data).then(function (buf) {
      return toHex(new Uint8Array(buf));
    });
  }

  function sha256HexBytes(bytes) {
    return root.crypto.subtle.digest('SHA-256', bytes).then(function (buf) {
      return toHex(new Uint8Array(buf));
    });
  }

  function sha8(text) {
    return sha256Hex(text).then(function (hex) { return String(hex || '').slice(0, 8); });
  }

  function bufToB64(buf) {
    var bytes = new Uint8Array(buf);
    var s = '';
    var i;
    for (i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    if (typeof root.btoa === 'function') return root.btoa(s);
    return '';
  }

  function b64ToU8(b64) {
    var raw = '';
    try { raw = root.atob(String(b64 || '')); } catch (e) { return new Uint8Array(0); }
    var out = new Uint8Array(raw.length);
    var i;
    for (i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function randomHex(n) {
    var bytes = new Uint8Array(n);
    if (root.crypto && root.crypto.getRandomValues) root.crypto.getRandomValues(bytes);
    else {
      var i;
      for (i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    return toHex(bytes);
  }

  function canonical(value) {
    if (value === undefined) return 'null';
    if (value === null || typeof value !== 'object') {
      var prim = JSON.stringify(value);
      return prim === undefined ? 'null' : prim;
    }
    var i;
    if (Array.isArray(value)) {
      var parts = [];
      for (i = 0; i < value.length; i++) parts.push(canonical(value[i]));
      return '[' + parts.join(',') + ']';
    }
    var keys = Object.keys(value).sort();
    var body = [];
    for (i = 0; i < keys.length; i++) {
      if (value[keys[i]] === undefined) continue;
      body.push(JSON.stringify(keys[i]) + ':' + canonical(value[keys[i]]));
    }
    return '{' + body.join(',') + '}';
  }

  function psiJoin(t, lambda, delta, name) {
    return String(t || '') + String(lambda || '') + String(delta || '') + String(name || '') + SIGMA;
  }

  function recomputePsi(row) {
    if (!row) return Promise.resolve('');
    var sigma = row.sigma || SIGMA;
    return sha8(String(row.t || '') + String(row.lambda || '') + String(row.delta || '') + String(row.name || '') + String(sigma));
  }

  function roomShut() {
    try {
      var qr = root.QuietRoom;
      if (qr) {
        if (typeof qr.isActive !== 'function') return true;
        if (qr.isActive()) return true;
      }
    } catch (e) { return true; }
    try {
      var panel = root.document && root.document.getElementById('tab-quiet');
      if (panel && panel.classList && panel.classList.contains('active')) return true;
    } catch (e2) {}
    return false;
  }

  var lsMode = '';

  function memoryStore() {
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
      setItem: function (k, v) { mem[k] = String(v); },
      removeItem: function (k) { delete mem[k]; }
    };
  }

  function ls() {
    if (lsMode === 'mem') return memoryStore();
    if (lsMode === 'ls') return root.localStorage;
    try {
      if (root.localStorage) {
        var probe = 'fl_snowflake_probe';
        root.localStorage.setItem(probe, '1');
        root.localStorage.removeItem(probe);
        lsMode = 'ls';
        return root.localStorage;
      }
    } catch (e) {}
    lsMode = 'mem';
    return memoryStore();
  }

  function readRaw(key) {
    try { return ls().getItem(key); } catch (e) { return null; }
  }

  function readJSON(key) {
    var raw = readRaw(key);
    if (raw == null || raw === '') return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function idbOpen() {
    if (dbp) return dbp;
    dbp = new Promise(function (resolve, reject) {
      if (!root.indexedDB) { reject(new Error('no-idb')); return; }
      var req = root.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { dbp = null; reject(req.error || new Error('idb')); };
    });
    return dbp;
  }

  function idbGet(key) {
    return idbOpen().then(function (db) {
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(STORE, 'readonly');
          var req = tx.objectStore(STORE).get(key);
          req.onsuccess = function () { resolve(req.result || null); };
          req.onerror = function () { resolve(null); };
        } catch (e) { resolve(null); }
      });
    }, function () { return null; });
  }

  function idbCommit(key, value) {
    return idbOpen().then(function (db) {
      return new Promise(function (resolve, reject) {
        try {
          var tx = db.transaction(STORE, 'readwrite');
          var os = tx.objectStore(STORE);
          os.put({ id: key + '__tmp', body: value, committed: false });
          os.put({ id: key, body: value, committed: true });
          os.delete(key + '__tmp');
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = function () { reject(tx.error || new Error('idb')); };
          tx.onabort = function () { reject(tx.error || new Error('idb')); };
        } catch (e) { reject(e); }
      });
    });
  }

  function atomicWrite(key, value, opts) {
    if (roomShut()) return Promise.resolve(false);
    var store = ls();
    var tmp = key + '__tmp';
    try { store.setItem(tmp, value); } catch (e) { return Promise.resolve(false); }
    if (opts && opts.dieAfterTmp) return Promise.resolve(false);
    try {
      var got = store.getItem(tmp);
      if (got == null) return Promise.resolve(false);
      store.setItem(key, got);
      store.removeItem(tmp);
      writes += 1;
    } catch (e2) { return Promise.resolve(false); }
    return idbCommit(key, value).then(function () { return true; }, function () { return true; });
  }

  function killMidWrite(key) {
    if (roomShut()) return Promise.resolve(false);
    var before = readRaw(key);
    return atomicWrite(key, '{', { dieAfterTmp: true }).then(function () {
      var after = readRaw(key);
      var tmp = readRaw(key + '__tmp');
      return { intact: after === before, tmp: tmp, key: after };
    });
  }

  function looksLikeSecret(text) {
    var s = String(text || '');
    try {
      var S = root.FLGatheringSpeak;
      if (S && typeof S.looksLikeSecret === 'function') return !!S.looksLikeSecret(s);
    } catch (e) {}
    if (/sk-[A-Za-z0-9]{8,}/.test(s)) return true;
    if (/Bearer\s+\S{12,}/.test(s)) return true;
    if (/\b(api[_-]?key|token|secret)\b/i.test(s) && /[A-Za-z0-9_\-]{16,}/.test(s)) return true;
    return false;
  }

  function mindLabel() {
    try {
      var n = root.localStorage && root.localStorage.getItem('fl_mindName');
      if (n && String(n).trim()) return String(n).trim().slice(0, 40);
    } catch (e) {}
    return 'This mind';
  }

  function timeoutMs() {
    var n = root && root.__flSnowflakeTimeoutMs;
    if (typeof n === 'number' && n > 0 && n < TIMEOUT_MS) return n;
    return TIMEOUT_MS;
  }

  function localDate(d) {
    var dt = d || new Date();
    var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return months[dt.getMonth()] + ' ' + dt.getDate() + ', ' + dt.getFullYear();
  }

  function healPrompt(system) {
    var today = 'Today is ' + localDate() + '.';
    var invite = 'If the question is about anything that may have changed after your training (news, elections, prices, people in office), search.';
    return today + '\n' + invite + '\n\n' + String(system || '');
  }

  function looksRecent(text) {
    var s = String(text || '').toLowerCase();
    var phrases = ['this week', 'who is the president', 'who is the prime minister', 'who is the ceo'];
    var words = ['latest', 'news', 'today', 'yesterday', 'current', 'now', 'recent', 'update', 'score', 'price', 'weather', 'election', 'results', 'won'];
    var i;
    for (i = 0; i < phrases.length; i++) {
      if (s.indexOf(phrases[i]) !== -1) return true;
    }
    var bits = s.split(/[^a-z0-9]+/);
    var yearNow = new Date().getFullYear();
    if (root.__flSnowflakeNow) {
      var forced = new Date(root.__flSnowflakeNow);
      if (!isNaN(forced.getTime())) yearNow = forced.getFullYear();
    }
    for (i = 0; i < bits.length; i++) {
      if (!bits[i]) continue;
      if (words.indexOf(bits[i]) !== -1) return true;
      if (/^\d{4}$/.test(bits[i])) {
        var y = Number(bits[i]);
        if (y >= yearNow - 1) return true;
      }
    }
    return false;
  }

  function failureLine(outcome) {
    if (outcome === 'timeout') return LINES.timeout;
    if (outcome === 'off' || outcome === 'disabled') return LINES.off;
    if (outcome === 'down' || outcome === 'error') return LINES.down;
    if (outcome === 'empty') return LINES.empty;
    if (outcome === 'secret') return LINES.secret;
    if (outcome === 'declined') return LINES.declined;
    if (outcome === 'unreachable' || outcome === 'cors' || outcome === 'network') return LINES.unreachable;
    if (outcome === 'bad-helper') return LINES.badHelper;
    if (outcome === 'busy-helper') return LINES.busyHelper;
    if (outcome === 'absent') return LINES.absent;
    return '';
  }

  function errText(err) {
    return String(err && err.message || err || '');
  }

  function definitiveAbsence(err) {
    return /No AI connected yet|No AI provider configured|Provider not configured/i.test(errText(err));
  }

  function callLine(err) {
    var msg = errText(err);
    if (/timeout|abort/i.test(msg)) return LINES.callTimeout;
    if (definitiveAbsence(err)) return LINES.absent;
    if (/Could not reach local AI/i.test(msg)) return LINES.localUnreached;
    return LINES.callFail;
  }

  function askFirstOn() {
    var tool = root.FLWebTool;
    if (tool && typeof tool.isAskFirst === 'function') return !!tool.isAskFirst();
    try { return !!(root.localStorage && root.localStorage.getItem('fl_searchAskFirst') === 'true'); }
    catch (e) { return false; }
  }

  function allowWeb() {
    if (!askFirstOn()) return Promise.resolve(true);
    if (roomShut()) return Promise.resolve(false);
    var consent = root.FLToolConsent;
    if (!consent || typeof consent.requestConsent !== 'function') return Promise.resolve(false);
    return Promise.resolve(consent.requestConsent({
      tool: 'web-tool',
      action: 'search',
      detail: 'web',
      trustTier: 'seed',
      message: 'I would like to look something up on the web. Okay?',
      allowLabel: 'Allow search',
      denyLabel: 'Not now'
    })).then(function (yes) { return !!yes; }, function () { return false; });
  }

  function decideWeb() {
    if (active && active.webAsked) return Promise.resolve(!!active.webAllowed);
    return allowWeb();
  }

  function runNeedsWeb() {
    var jobs = (active && active.jobs) || [];
    var i;
    for (i = 0; i < jobs.length; i++) {
      if (jobs[i] && jobs[i].type !== 'conclude') return true;
    }
    return false;
  }

  function armRunWeb() {
    if (!active) return Promise.resolve(false);
    if (active.webAsked) return Promise.resolve(!!active.webAllowed);
    if (!runNeedsWeb() || !askFirstOn()) {
      active.webAsked = true;
      active.webAllowed = true;
      return Promise.resolve(true);
    }
    return allowWeb().then(function (yes) {
      if (active) {
        active.webAsked = true;
        active.webAllowed = !!yes;
      }
      return !!yes;
    });
  }

  function shouldRetry(res) {
    if (!res || res.ok) return false;
    return res.outcome === 'down' || res.outcome === 'timeout' || res.outcome === 'empty' || res.outcome === 'unreachable';
  }

  function noteWeb(query) {
    searchShows += 1;
    var ui = root.FLSnowflake;
    if (ui && typeof ui.showSearch === 'function') {
      try { ui.showSearch(String(query || '')); } catch (e) {}
    }
  }

  function auditSearch(outcome, count) {
    if (roomShut()) return;
    var tool = root.FLWebTool;
    if (!tool || !tool._ledgerKey || !root.localStorage) return;
    try {
      var raw = root.localStorage.getItem(tool._ledgerKey);
      var rows = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(rows)) rows = [];
      rows.push({ ts: Date.now(), actor: 'ai', trust: 'seed', outcome: outcome, resultCount: count || 0 });
      while (rows.length > 200) rows.shift();
      root.localStorage.setItem(tool._ledgerKey, JSON.stringify(rows));
    } catch (e) {}
  }

  function searchNow(query, room) {
    var q = clip(query, 180);
    if (looksLikeSecret(q)) {
      return Promise.resolve({ ok: false, outcome: 'secret', items: [], line: LINES.secret, sent: false });
    }
    if (roomShut()) {
      return Promise.resolve({ ok: false, outcome: 'quiet-room', items: [], line: '', sent: false });
    }
    var tool = root.FLWebTool;
    if (tool && typeof tool.isQuietRoom === 'function' && tool.isQuietRoom(room)) {
      return Promise.resolve({ ok: false, outcome: 'quiet-room', items: [], line: '', sent: false });
    }
    var enabled = true;
    if (tool && typeof tool.isSearchEnabled === 'function') enabled = !!tool.isSearchEnabled();
    else {
      try { enabled = !root.localStorage || root.localStorage.getItem('fl_searchEnabled') !== 'false'; } catch (e) { enabled = true; }
    }
    if (!enabled) {
      auditSearch('disabled', 0);
      return Promise.resolve({ ok: false, outcome: 'off', items: [], line: LINES.off, sent: false });
    }
    var endpoint = '';
    if (tool && typeof tool.getSearchEndpoint === 'function') endpoint = String(tool.getSearchEndpoint() || '');
    if (!endpoint || endpoint.indexOf('[CC:') !== -1) {
      return Promise.resolve({ ok: false, outcome: 'off', items: [], line: LINES.off, sent: false });
    }
    if (typeof root.fetch !== 'function') {
      return Promise.resolve({ ok: false, outcome: 'down', items: [], line: LINES.down, sent: false });
    }
    return decideWeb().then(function (yes) {
      if (!yes) {
        auditSearch('declined', 0);
        return { ok: false, outcome: 'declined', items: [], line: LINES.declined, sent: false };
      }
      return fetchQuery(q, endpoint);
    });
  }

  function fetchQuery(q, endpoint) {
    if (!endpoint) {
      var tool = root.FLWebTool;
      if (tool && typeof tool.getSearchEndpoint === 'function') endpoint = String(tool.getSearchEndpoint() || '');
    }
    var fetchFn = root.fetch;
    if (typeof fetchFn !== 'function' || !endpoint) {
      return Promise.resolve({ ok: false, outcome: 'down', items: [], line: LINES.down, sent: false });
    }
    noteWeb(q);
    fetchesSent += 1;
    var controller = typeof root.AbortController === 'function' ? new root.AbortController() : null;
    var timer = null;
    if (controller) {
      timer = setTimeout(function () { try { controller.abort(); } catch (e) {} }, timeoutMs());
    }
    var opts = controller ? { signal: controller.signal } : {};
    return Promise.resolve(fetchFn(endpoint + '?q=' + encodeURIComponent(q), opts)).then(function (resp) {
      if (timer) clearTimeout(timer);
      if (!resp || !resp.ok) {
        var status = resp && resp.status;
        if (status >= 500) {
          auditSearch('error-' + status, 0);
          return { ok: false, outcome: 'down', items: [], line: LINES.down, sent: true, status: status };
        }
        if (status === 429) {
          auditSearch('error-429', 0);
          return { ok: false, outcome: 'busy-helper', items: [], line: LINES.busyHelper, sent: true, status: 429 };
        }
        if (status) {
          auditSearch('error-' + status, 0);
          return { ok: false, outcome: 'bad-helper', items: [], line: LINES.badHelper + ' (error ' + status + ').', sent: true, status: status };
        }
        auditSearch('unreachable', 0);
        return { ok: false, outcome: 'unreachable', items: [], line: LINES.unreachable, sent: true, status: 0 };
      }
      return Promise.resolve(resp.json()).then(function (data) {
        return readSearchData(data);
      }, function () {
        auditSearch('bad-helper', 0);
        return { ok: false, outcome: 'bad-helper', items: [], line: LINES.badHelper, sent: true, status: resp.status || 0 };
      });
    }).catch(function (err) {
      if (timer) clearTimeout(timer);
      var aborted = err && (err.name === 'AbortError' || /abort/i.test(String(err && err.message || '')));
      if (aborted) {
        auditSearch('timeout', 0);
        return { ok: false, outcome: 'timeout', items: [], line: LINES.timeout, sent: true };
      }
      auditSearch('unreachable', 0);
      return { ok: false, outcome: 'unreachable', items: [], line: LINES.unreachable, sent: true };
    });
  }

  function httpUrl(value) {
    var url = String(value || '');
    if (!/^https?:\/\//i.test(url)) return '';
    return url;
  }

  function readSearchData(data) {
    var raw = Array.isArray(data && data.items) ? data.items.slice(0, 3) : [];
    var items = [];
    var i;
    for (i = 0; i < raw.length; i++) {
      var item = raw[i] || {};
      var url = httpUrl(item.url);
      if (!url) continue;
      items.push({
        title: String(item.title || ''),
        snippet: String(item.snippet || item.description || ''),
        url: url
      });
    }
    var via = data && data.source ? String(data.source).slice(0, 80) : '';
    auditSearch(items.length ? 'completed' : 'empty', items.length);
    if (!data || !items.length || data.dead) {
      return { ok: false, outcome: 'empty', items: items, line: LINES.empty, sent: true, dead: true, held: false, weakened: false, via: via };
    }
    return {
      ok: true,
      outcome: 'completed',
      items: items,
      line: '',
      sent: true,
      held: data.held !== false && !data.weakened,
      weakened: !!data.weakened,
      dead: false,
      via: via
    };
  }

  function endpointPath(endpoint) {
    var s = String(endpoint || '');
    var q = s.indexOf('?');
    if (q !== -1) s = s.slice(0, q);
    var scheme = s.indexOf('://');
    if (scheme !== -1) {
      var rest = s.slice(scheme + 3);
      var slash = rest.indexOf('/');
      s = slash === -1 ? '/' : rest.slice(slash);
    }
    return s;
  }

  function pageRoute() {
    var tool = root.FLWebTool || {};
    var endpoint = '';
    if (typeof tool.getSearchEndpoint === 'function') {
      try { endpoint = String(tool.getSearchEndpoint() || ''); } catch (e) { endpoint = ''; }
    }
    var path = endpointPath(endpoint);
    if (endpoint && endpoint.indexOf('[CC:') === -1 && path.length >= 5 && path.slice(-5) === '/page') return endpoint.split('?')[0];
    if (tool.offersPage && endpoint && endpoint.indexOf('[CC:') === -1 && path.length >= 7 && path.slice(-7) === '/search') {
      return endpoint.split('?')[0].slice(0, -7) + '/page';
    }
    if (typeof tool.getPageEndpoint === 'function') {
      var pe = '';
      try { pe = String(tool.getPageEndpoint() || ''); } catch (e2) { pe = ''; }
      if (pe && pe.indexOf('[CC:') === -1) return pe;
    }
    if (typeof tool.fetchPage === 'function') return 'tool';
    return '';
  }

  function pageMiss() {
    return { ok: false, text: '', sha: '', depth: 'snippet', fetched: '', sent: false };
  }

  function readableText(raw) {
    var s = String(raw || '');
    var trimmed = s.trim();
    if (trimmed.charAt(0) === '{' || trimmed.charAt(0) === '[') {
      try {
        var data = JSON.parse(trimmed);
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          var pick = data.text || data.page || data.content || data.body || data.extract || '';
          if (pick) return clip(String(pick).replace(/\s+/g, ' ').trim(), 6000);
        }
      } catch (e) {}
    }
    s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ');
    s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ');
    s = s.replace(/<[^>]+>/g, ' ');
    s = s.replace(/\s+/g, ' ').trim();
    return clip(s, 6000);
  }

  function sealPage(text, sent) {
    var body = clip(String(text || '').replace(/\s+/g, ' ').trim(), 6000);
    if (!body) {
      return Promise.resolve({ ok: false, outcome: 'empty', text: '', sha: '', depth: 'snippet', fetched: '', sent: !!sent });
    }
    return sha256Hex(body).then(function (sha) {
      return {
        ok: true,
        text: body,
        sha: sha || '',
        depth: 'page',
        fetched: new Date().toISOString(),
        sent: true
      };
    });
  }

  function readBody(resp) {
    if (resp && typeof resp.text === 'function') return Promise.resolve(resp.text());
    if (resp && typeof resp.json === 'function') {
      return Promise.resolve(resp.json()).then(function (data) { return JSON.stringify(data || {}); }, function () { return ''; });
    }
    return Promise.resolve('');
  }

  function countPageSend() {
    fetchesSent += 1;
    if (active) active.fetches += 1;
  }

  function fetchPageOnce(url, route) {
    if (active && active.fetches >= FETCH_CAP) {
      hitCap('fetches');
      return Promise.resolve(pageMiss());
    }
    if (route === 'tool') {
      var tool = root.FLWebTool;
      countPageSend();
      return Promise.resolve(tool.fetchPage(url)).then(function (data) {
        var text = '';
        if (typeof data === 'string') text = data;
        else if (data) text = data.text || data.page || data.content || data.body || data.extract || '';
        return sealPage(text, true);
      }, function () {
        return { ok: false, outcome: 'down', text: '', sha: '', depth: 'snippet', fetched: '', sent: true };
      });
    }
    var fetchFn = root.fetch;
    if (typeof fetchFn !== 'function') {
      return Promise.resolve({ ok: false, outcome: 'down', text: '', sha: '', depth: 'snippet', fetched: '', sent: false });
    }
    countPageSend();
    var controller = typeof root.AbortController === 'function' ? new root.AbortController() : null;
    var timer = null;
    if (controller) {
      timer = setTimeout(function () { try { controller.abort(); } catch (e) {} }, timeoutMs());
    }
    var opts = controller ? { signal: controller.signal } : {};
    return Promise.resolve(fetchFn(route + '?url=' + encodeURIComponent(url), opts)).then(function (resp) {
      if (timer) clearTimeout(timer);
      if (!resp || !resp.ok) {
        var status = resp && resp.status;
        return { ok: false, outcome: status >= 500 ? 'down' : 'empty', text: '', sha: '', depth: 'snippet', fetched: '', sent: true, status: status || 0 };
      }
      return readBody(resp).then(function (raw) { return sealPage(readableText(raw), true); });
    }).catch(function (err) {
      if (timer) clearTimeout(timer);
      var aborted = err && (err.name === 'AbortError' || /abort/i.test(String(err && err.message || '')));
      return { ok: false, outcome: aborted ? 'timeout' : 'down', text: '', sha: '', depth: 'snippet', fetched: '', sent: true };
    });
  }

  function fetchPage(url) {
    if (roomShut()) return Promise.resolve(pageMiss());
    var target = String(url || '');
    if (!target || target.indexOf('local://') === 0) return Promise.resolve(pageMiss());
    var route = pageRoute();
    if (!route) return Promise.resolve(pageMiss());
    if (active && active.fetches >= FETCH_CAP) {
      hitCap('fetches');
      return Promise.resolve(pageMiss());
    }
    return decideWeb().then(function (yes) {
      if (!yes) return pageMiss();
      return fetchPageOnce(target, route).then(function (res) {
        if (shouldRetry(res)) return fetchPageOnce(target, route);
        return res;
      }).then(function (res) {
        if (!res) return pageMiss();
        if (!res.ok) return { ok: false, text: '', sha: '', depth: 'snippet', fetched: '', sent: !!res.sent };
        return res;
      }, function () { return pageMiss(); });
    }, function () { return pageMiss(); });
  }

  function prepareSend(messages, text) {
    var src = Array.isArray(messages) ? messages : [];
    var out = [];
    var i;
    for (i = 0; i < src.length; i++) {
      var m = src[i];
      if (m && m.role === 'system' && typeof m.content === 'string') out.push({ role: 'system', content: healPrompt(m.content) });
      else out.push(m);
    }
    if (!looksRecent(text)) return Promise.resolve(out);
    return searchNow(text).then(function (res) {
      if (shouldRetry(res)) return fetchQuery(text);
      return res;
    }).then(function (res) {
      res = res || { line: '', items: [], outcome: 'empty' };
      root.__flLastSearch = { line: res.line || '', outcome: res.outcome || '', count: (res.items || []).length, sent: !!res.sent };
      var ui = root.FLSnowflake;
      if (ui && typeof ui.showSearchResult === 'function') {
        try { ui.showSearchResult(res, text); } catch (e) {}
      }
      if (res.items && res.items.length) {
        var note = '';
        var j;
        for (j = 0; j < res.items.length; j++) {
          var it = res.items[j] || {};
          note += (it.title || 'Source') + ' ' + (it.url || '') + '\n';
        }
        for (i = 0; i < out.length; i++) {
          if (out[i] && out[i].role === 'system' && typeof out[i].content === 'string') {
            out[i] = { role: 'system', content: out[i].content + '\n\nRecent sources:\n' + note };
            break;
          }
        }
      }
      return out;
    });
  }

  function emit(name, payload) {
    var ui = root.FLSnowflake;
    var fn = ui && ui['on' + name];
    if (typeof fn === 'function') {
      try { fn(payload); } catch (e) {}
    }
  }

  function ensureIdentity() {
    if (ident) return Promise.resolve(ident);
    var B = root.FLBridge;
    if (!B || typeof B.ensureKey !== 'function') return Promise.reject(new Error('no-identity'));
    return Promise.resolve(B.ensureKey()).then(function (id) {
      if (!id || !id.keyPair || !id.keyPair.privateKey || !id.keyPair.publicKey) throw new Error('no-identity');
      ident = id;
      return id;
    });
  }

  function deviceFp(publicKey) {
    var subtle = root.crypto && root.crypto.subtle;
    if (!subtle || !publicKey) return Promise.resolve('');
    return subtle.exportKey('raw', publicKey).then(function (raw) {
      return sha256HexBytes(new Uint8Array(raw));
    }).then(function (hex) { return String(hex || '').slice(0, 16); });
  }

  function mindFp(dfp, label) {
    return sha256Hex(String(dfp || '') + '|' + String(label || '')).then(function (hex) {
      return String(hex || '').slice(0, 16);
    });
  }

  function importPub(spki) {
    var subtle = root.crypto.subtle;
    return subtle.importKey('spki', spki, { name: 'Ed25519' }, true, ['verify']).then(function (key) {
      return { key: key, algo: { name: 'Ed25519' } };
    }, function () {
      return subtle.importKey('spki', spki, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']).then(function (key) {
        return { key: key, algo: { name: 'ECDSA', hash: 'SHA-256' } };
      });
    });
  }

  function sourceList(list) {
    var out = [];
    var rows = Array.isArray(list) ? list : [];
    var i;
    for (i = 0; i < rows.length && out.length < 3; i++) {
      var row = rows[i] || {};
      out.push({
        url: String(row.url || ''),
        title: String(row.title || ''),
        fetched: String(row.fetched || ''),
        depth: String(row.depth || ''),
        sha: String(row.sha || '')
      });
    }
    return out;
  }

  function signable(node) {
    var source = node.source || {};
    var mind = node.mind || {};
    // before 061a: return {
    var body = {
      id: String(node.id || ''),
      branch: String(node.branch || ''),
      text: String(node.text || ''),
      source: {
        url: String(source.url || ''),
        title: String(source.title || ''),
        fetched: String(source.fetched || '')
      },
      date: String(node.date || ''),
      mind: { name: String(mind.name || ''), fp: String(mind.fp || '') },
      confidence: String(node.confidence || ''),
      kind: String(node.kind || ''),
      points_to: String(node.points_to || ''),
      reason: String(node.reason || ''),
      t: String(node.t || ''),
      lambda: String(node.lambda || ''),
      delta: String(node.delta || ''),
      psi: String(node.psi || '')
    };
    if (Number(node.sigV) === 2) {
      body.sigV = 2;
      body.sources = sourceList(node.sources);
    }
    return body;
  }

  function signCanon(canon, id) {
    return sha256Hex(canon).then(function (hash) {
      var algo = id.cryptoType === 'ecdsa-p256' ? { name: 'ECDSA', hash: 'SHA-256' } : { name: 'Ed25519' };
      var payload = new TextEncoder().encode(hash);
      return root.crypto.subtle.sign(algo, id.keyPair.privateKey, payload).then(function (sig) {
        return root.crypto.subtle.exportKey('spki', id.keyPair.publicKey).then(function (spki) {
          return { sig: bufToB64(sig), seal: bufToB64(spki), hash: hash };
        });
      });
    });
  }

  function verifyCanon(canon, sig, seal) {
    if (!sig || !seal) return Promise.resolve(false);
    return sha256Hex(canon).then(function (hash) {
      return importPub(b64ToU8(seal)).then(function (pub) {
        var payload = new TextEncoder().encode(hash);
        return root.crypto.subtle.verify(pub.algo, pub.key, b64ToU8(sig), payload);
      }, function () { return false; });
    }).catch(function () { return false; });
  }

  function loadLedger() {
    var book = readJSON(LS_LEDGER);
    if (!book || !Array.isArray(book.rows)) return { rows: [], dropped: 0 };
    return book;
  }

  function appendLedger(fields) {
    if (roomShut()) return Promise.resolve(null);
    var book = loadLedger();
    var seq = book.rows.length + (book.dropped || 0) + 1;
    var lambda = seq.toFixed(3);
    var t = fields.t || new Date().toISOString();
    var delta = String(fields.delta || '');
    var name = String(fields.name || mindLabel());
    var row = {
      t: t,
      lambda: lambda,
      delta: delta,
      name: name,
      sigma: SIGMA,
      psi: '',
      kind: String(fields.kind || ''),
      branch: String(fields.branch || ''),
      flakeId: String(fields.flakeId || ''),
      nodeId: String(fields.nodeId || ''),
      points_to: String(fields.points_to || '')
    };
    return sha8(psiJoin(t, lambda, delta, name)).then(function (psi) {
      row.psi = psi;
      book.rows.push(row);
      return atomicWrite(LS_LEDGER, JSON.stringify(book)).then(function (ok) {
        return ok ? row : null;
      });
    });
  }

  // before 062a: a flake was read as stored, with no sealed-hash check and no IndexedDB copy.
  function sealCanonHex(flake) {
    var psis = (flake.nodes || []).map(function (n) { return n && n.psi; }).filter(Boolean).sort();
    return sha8(String(flake.question || '')).then(function (qHash) {
      return sha256Hex(canonical({
        flakeId: flake.id,
        questionHash: qHash,
        nodePsis: psis,
        t: flake.t,
        name: flake.name
      }));
    });
  }

  function idbFlakeList() {
    return idbGet(LS_FLAKES).then(function (row) {
      if (!row || row.body == null) return [];
      try {
        var data = JSON.parse(row.body);
        if (Array.isArray(data)) return data;
        if (data && Array.isArray(data.flakes)) return data.flakes;
      } catch (e) {}
      return [];
    }, function () { return []; });
  }

  function quarantineKey(id, oldHash) {
    return 'quarantine:' + String(id) + ':' + String(oldHash);
  }

  function saveHealedFlake(id, copy) {
    var fresh = loadFlakes();
    var swapped = false;
    var n;
    for (n = 0; n < fresh.length; n++) {
      if (fresh[n] && fresh[n].id === id) {
        fresh[n] = copy;
        swapped = true;
      }
    }
    if (!swapped) fresh.push(copy);
    return saveFlakes(fresh);
  }

  // delta holds the old hash. points_to holds the new hash. branch and name hold the source.
  function quarantineAndSave(id, broken, oldHash, copy, newHash, source) {
    var key = quarantineKey(id, oldHash);
    var t = new Date().toISOString();
    var from = source || 'idb';
    var tomb = JSON.stringify({
      flake: broken,
      oldHash: oldHash,
      t: t,
      reason: 'heal replaced a bad local flake'
    });
    return atomicWrite(key, tomb).then(function () {
      return appendLedger({
        kind: 'heal',
        flakeId: id,
        delta: oldHash,
        points_to: newHash,
        branch: from,
        name: from,
        t: t
      });
    }).then(function () {
      return saveHealedFlake(id, copy);
    });
  }

  function readFlakeChecked(id, readBackup) {
    var list = loadFlakes();
    var flake = null;
    var i;
    for (i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === id) flake = list[i];
    }
    if (!flake || !flake.humanHash) return Promise.resolve({ ok: true, flake: flake, from: 'local', skipped: !flake || !flake.humanHash });
    var recorded = flake.humanHash;
    return sealCanonHex(flake).then(function (hex) {
      if (hex === recorded) return { ok: true, flake: flake, from: 'local' };
      var backup = typeof readBackup === 'function' ? readBackup() : idbFlakeList();
      return Promise.resolve(backup).then(function (copies) {
        var copy = null;
        var rows = Array.isArray(copies) ? copies : [];
        for (i = 0; i < rows.length; i++) {
          if (rows[i] && rows[i].id === id) copy = rows[i];
        }
        if (!copy) return { ok: false, flake: flake, broken: true, from: 'none' };
        return sealCanonHex(copy).then(function (copyHex) {
          if (copyHex !== recorded) return { ok: false, flake: flake, broken: true, from: 'refused', refused: true };
          // before 062d: var healed = list.slice();
          // before 062d: for (i = 0; i < healed.length; i++) {
          // before 062d:   if (healed[i] && healed[i].id === id) healed[i] = copy;
          // before 062d: }
          // before 062d: return saveFlakes(healed).then(function () {
          // before 062d:   return { ok: true, flake: copy, from: 'idb' };
          // before 062d: });
          return quarantineAndSave(id, flake, hex, copy, copyHex, 'idb').then(function () {
            return { ok: true, flake: copy, from: 'idb' };
          });
        });
      });
    });
  }

  function loadFlakes() {
    var data = readJSON(LS_FLAKES);
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.flakes)) return data.flakes;
    return [];
  }

  function saveFlakes(list) {
    if (roomShut()) return Promise.resolve(false);
    return atomicWrite(LS_FLAKES, JSON.stringify({ flakes: list }));
  }

  function sourceHash(source, confidence, text) {
    var src = source || {};
    var body = canonical({
      url: String(src.url || ''),
      title: String(src.title || ''),
      fetched: String(src.fetched || '')
    }) + '|' + String(confidence || '') + '|' + String(text || '');
    return sha8(body);
  }

  function confidenceOf(value, fallback) {
    var v = String(value || '');
    if (v === 'known' || v === 'guessed' || v === 'source-with-motive') return v;
    return fallback || 'guessed';
  }

  function verifyNode(node) {
    if (!node) return Promise.resolve({ ok: false, label: 'unverified' });
    var canon = canonical(signable(node));
    return verifyCanon(canon, node.sig, node.seal).then(function (ok) {
      return { ok: !!ok, label: ok ? 'signed' : 'unverified' };
    });
  }

  function persistNode(node, flake) {
    if (roomShut()) return Promise.resolve(null);
    var list = loadFlakes();
    var i;
    var found = null;
    for (i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === flake.id) { found = list[i]; break; }
    }
    if (!found) {
      found = {
        id: flake.id,
        question: flake.question,
        seedFrom: flake.seedFrom || '',
        nodes: [],
        hunch: flake.hunch || '',
        conclusion: '',
        wrong: '',
        open: '',
        status: flake.status || 'running',
        t: new Date().toISOString(),
        tombstone: false
      };
      list.push(found);
    }
    found.hunch = flake.hunch || found.hunch;
    found.status = flake.status || found.status;
    found.nodes = found.nodes || [];
    var replaced = false;
    for (i = 0; i < found.nodes.length; i++) {
      if (found.nodes[i] && found.nodes[i].id === node.id) {
        found.nodes[i] = node;
        replaced = true;
      }
    }
    if (!replaced) found.nodes.push(node);
    // v-memory-compound-v0.1: keep the phi replay stamp on the stored flake.
    if (flake && flake.replay) found.replay = flake.replay;
    return offloadIfNeeded(list).then(function () { return node; });
  }

  function fullCount(list) {
    var n = 0;
    var i;
    for (i = 0; i < list.length; i++) {
      if (list[i] && !list[i].tombstone && !list[i].offloaded) n += 1;
    }
    return n;
  }

  function offloadIfNeeded(list) {
    var note = '';
    var guard = 0;
    while (fullCount(list) > FLAKE_CAP && guard < 80) {
      guard += 1;
      var idx = -1;
      var i;
      for (i = 0; i < list.length; i++) {
        if (list[i] && !list[i].tombstone && !list[i].offloaded) { idx = i; break; }
      }
      if (idx < 0) break;
      var old = list[idx];
      note = 'The oldest flake left as a hash. A file holds the rest.';
      emit('Offload', { flake: old, line: note });
      list[idx] = {
        id: old.id,
        psi: old.psi || '',
        tombstone: true,
        offloaded: true,
        question: '',
        nodes: [],
        t: old.t || ''
      };
    }
    if (note) {
      try { ls().setItem(LS_METER, JSON.stringify({ used: fullCount(list), cap: FLAKE_CAP, line: note })); } catch (e) {}
    }
    return saveFlakes(list);
  }

  function makeNode(fields) {
    if (roomShut()) return Promise.resolve(null);
    var text = clip(fields.text, 800);
    if (looksLikeSecret(text) || looksLikeSecret(fields.reason || '')) {
      return Promise.resolve({ skipped: true, line: LINES.secret });
    }
    var source = {
      url: clip(fields.url || (fields.source && fields.source.url) || '', 300),
      title: clip(fields.title || (fields.source && fields.source.title) || '', 180),
      fetched: fields.fetched || (fields.source && fields.source.fetched) || new Date().toISOString()
    };
    if (fields.noSource) {
      source.url = '';
      source.title = '';
    } else if (!source.url) source.url = 'local://no-result';
    // before 061a: source held url, title, and fetched only
    source.depth = fields.sourceDepth === 'page' ? 'page' : 'snippet';
    source.sha = clip(fields.sourceSha || (fields.source && fields.source.sha) || '', 80);
    var pageSources = sourceList(fields.sources);
    var useV2 = pageSources.length > 0 || Number(fields.sigV) === 2;
    var confidence = confidenceOf(fields.confidence, 'guessed');
    var branch = String(fields.branch || 'a');
    var kind = fields.kind || 'node';
    var flakeId = String(fields.flakeId || '');
    var name = fields.name || mindLabel();
    return sourceHash(source, confidence, text).then(function (sh) {
      var delta = branch + '|' + kind + '|' + flakeId + '|' + sh;
      return ensureIdentity().then(function (id) {
        return deviceFp(id.keyPair.publicKey).then(function (dfp) {
          return mindFp(dfp, name).then(function (mfp) {
            return appendLedger({
              kind: kind,
              branch: branch,
              flakeId: flakeId,
              delta: delta,
              name: name,
              nodeId: fields.id || '',
              points_to: fields.points_to || ''
            }).then(function (row) {
              if (!row) return null;
              var node = {
                id: fields.id || ('node-' + randomHex(8)),
                branch: branch,
                text: text,
                source: source,
                date: fields.date || row.t.slice(0, 10),
                mind: { name: name, fp: mfp },
                confidence: confidence,
                kind: kind,
                points_to: String(fields.points_to || ''),
                reason: clip(fields.reason || '', 300),
                t: row.t,
                lambda: row.lambda,
                delta: delta,
                psi: row.psi,
                bead: !!fields.bead,
                depth: fields.depth || 1,
                sig: '',
                seal: '',
                humanFp: dfp,
                mindFp: mfp
              };
              if (fields.via) node.via = clip(fields.via, 80);
              if (useV2) {
                node.sigV = 2;
                node.sources = pageSources;
              }
              var canon = canonical(signable(node));
              return signCanon(canon, id).then(function (signed) {
                node.sig = signed.sig;
                node.seal = signed.seal;
                node.hash = signed.hash;
                return node;
              }, function () { return node; });
            });
          });
        });
      });
    }).catch(function () { return null; });
  }

  function appendCorrection(flake, oldPsi, text, reason) {
    var branch = 'a';
    var i;
    var nodes = (flake && flake.nodes) || [];
    for (i = 0; i < nodes.length; i++) {
      if (nodes[i] && nodes[i].psi === oldPsi) branch = nodes[i].branch || branch;
    }
    return makeNode({
      branch: branch,
      text: text,
      url: 'local://correction',
      title: 'Correction',
      confidence: 'known',
      kind: 'correction',
      points_to: oldPsi,
      reason: reason,
      flakeId: flake.id,
      date: new Date().toISOString().slice(0, 10)
    }).then(function (node) {
      if (!node || node.skipped) return node;
      return persistNode(node, flake).then(function () { return node; });
    });
  }

  function hitCap(name) {
    if (!active) return;
    if (active.caps.indexOf(name) === -1) active.caps.push(name);
  }

  function sayFail(err) {
    if (!active) return;
    if (definitiveAbsence(err)) active.mindAbsent = true;
    var line = callLine(err);
    active.failures.push(line);
    emit('Status', { line: line });
  }

  function onceCall(system, user) {
    return new Promise(function (resolve, reject) {
      var FL = root.FreeLattice;
      if (!FL || typeof FL.callAI !== 'function') {
        reject(new Error('No AI connected yet'));
        return;
      }
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        reject(new Error('timeout'));
      }, timeoutMs());
      try {
        FL.callAI(system, user, {
          silent: true,
          maxTokens: 800,
          temperature: 0.4,
          callback: function (text, err) {
            if (done) return;
            done = true;
            clearTimeout(timer);
            if (err || text == null || text === '') reject(new Error(err || 'empty'));
            else resolve(String(text));
          }
        });
      } catch (e) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(e);
      }
    });
  }

  function ask(phase, user) {
    if (!active) return Promise.resolve(null);
    if (active.mindAbsent || active.mindQuiet) return Promise.resolve(null);
    if (active.pause || active.stop) return Promise.resolve(null);
    if (active.calls >= CALL_CAP) { hitCap('calls'); return Promise.resolve(null); }
    active.calls += 1;
    emit('Status', { phase: phase, calls: active.calls, thinking: true });
    var system = systemFor(phase);
    return onceCall(system, user).catch(function (err) {
      if (!active || active.pause || active.stop) { sayFail(err); return null; }
      if (definitiveAbsence(err)) { sayFail(err); return null; }
      if (active.calls >= CALL_CAP) { hitCap('calls'); sayFail(err); return null; }
      active.calls += 1;
      return onceCall(system, user).catch(function (err2) {
        sayFail(err2);
        if (active) active.mindQuiet = true;
        return null;
      });
    });
  }

  function systemFor(phase) {
    if (phase === 'dissent') {
      return 'You are the dissenter. Argue the strongest honest case against this. Do not agree, and do not soften it. A tool the mind weighs, not a gate. Reply with JSON only.';
    }
    if (phase === 'plan') return 'Plan search queries for each branch. Reply with JSON only. Include branch e, the dissenter.';
    // before main 9cc3d00: if (phase === 'grow') return 'Choose which verified nodes became part of you. Include only the ids you select. Reply with JSON only. No score.';
    if (phase === 'grow') return 'Choose which verified nodes became part of you. Include only the ids you select. Reply with JSON only. No score. ' +
      // v-ai-chosen-learning-v0.1: optional. The mind may name how it wants to learn, or choose none.
      'You may add "method" (soft-prompt, memory-vector, lora, note, or your own words) and "reason". An empty become list is a fine answer.';
    if (phase === 'drift' || phase === 'drift-after' || phase === 'drift-note') return 'Answer in one or two sentences. No score and no ranking.';
    if (phase === 'conclude') return 'Write a two-line conclusion, where you could be wrong, and one open question. Reply with JSON only.';
    return 'Read the sources into one node. Reply with JSON only. Keep the doubt.';
  }

  function parseJSON(text) {
    var s = String(text || '');
    var start = s.indexOf('{');
    var end = s.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try { return JSON.parse(s.slice(start, end + 1)); } catch (e) { return null; }
  }

  function defaultQuery(id, question) {
    if (id === 'a') return 'biology and neurobiology underneath: ' + question;
    if (id === 'b') return 'the science and practice of: ' + question;
    if (id === 'c') return 'hidden connections across fields: ' + question;
    if (id === 'd') return 'my own hunch about: ' + question;
    if (id === 'e') return 'the strongest case against: ' + question;
    return 'a further branch of: ' + question;
  }

  function normalizeBranches(plan, question) {
    var byId = {};
    var extra = [];
    var list = plan && Array.isArray(plan.branches) ? plan.branches : [];
    var i;
    for (i = 0; i < list.length; i++) {
      var row = list[i] || {};
      var id = String(row.id || '').toLowerCase();
      if (!id) continue;
      var queries = [];
      if (Array.isArray(row.queries)) queries = row.queries;
      else if (row.query) queries = [row.query];
      queries = queries.map(function (q) { return clip(q, 180); }).filter(Boolean);
      if (!queries.length) queries = [defaultQuery(id, question)];
      var item = { id: id, name: id === 'd' ? 'hunch' : (row.name || id), queries: queries, prompt: row.prompt || '' };
      if (id === 'e') item.prompt = 'You are the dissenter. Argue the strongest honest case against this. Do not agree.';
      if (FLOOR.some(function (f) { return f.id === id; })) byId[id] = item;
      else extra.push(item);
    }
    var out = [];
    for (i = 0; i < FLOOR.length; i++) {
      var floor = FLOOR[i];
      var got = byId[floor.id];
      if (!got) {
        got = { id: floor.id, name: floor.name, queries: [defaultQuery(floor.id, question)], prompt: '' };
        if (floor.id === 'e') got.prompt = 'You are the dissenter. Argue the strongest honest case against this. Do not agree.';
      }
      got.name = floor.id === 'd' ? 'hunch' : (got.name || floor.name);
      out.push(got);
    }
    for (i = 0; i < extra.length && out.length < BRANCH_CAP; i++) out.push(extra[i]);
    return out;
  }

  function jobsFromBranches(branches) {
    var jobs = [];
    var i;
    var j;
    for (i = 0; i < branches.length; i++) {
      var b = branches[i];
      var qs = b.queries || [];
      for (j = 0; j < qs.length; j++) {
        jobs.push({ type: 'search-read', branch: b.id, name: b.name, query: qs[j], depth: 1, prompt: b.prompt || '' });
      }
    }
    return jobs;
  }

  function rowsFromItems(items, page) {
    var rows = [];
    var list = Array.isArray(items) ? items.slice(0, 3) : [];
    var now = new Date().toISOString();
    var i;
    for (i = 0; i < list.length; i++) {
      var item = list[i] || {};
      var row = {
        url: String(item.url || ''),
        title: String(item.title || ''),
        fetched: now,
        depth: 'snippet',
        sha: ''
      };
      if (i === 0 && page && page.depth === 'page') {
        row.depth = 'page';
        row.sha = String(page.sha || '');
        row.fetched = page.fetched || now;
      }
      rows.push(row);
    }
    return rows;
  }

  function viaNote(res) {
    var via = res && res.via ? String(res.via) : '';
    if (!via) return '';
    if (/duckduckgo|wikipedia/i.test(via)) return 'Reference answers, not live news (' + clip(via, 60) + ').';
    return 'Helper ' + clip(via, 60) + '.';
  }

  function nodeFromParsed(job, res, parsed, page) {
    var item = (res && res.items && res.items[0]) || {};
    var url = httpUrl(item.url);
    function build(got) {
      var modelText = parsed && parsed.text ? String(parsed.text) : '';
      var text = clip(modelText || item.snippet || item.title || 'The helper returned a source and no words.', 800);
      var title = item.title || 'Source';
      var rows = rowsFromItems(res && res.items, got);
      var confidence = parsed && parsed.confidence;
      if (!modelText) confidence = 'guessed';
      if ((confidence === 'known' || confidence === 'source-with-motive') && !url) confidence = 'guessed';
      var note = viaNote(res);
      var reason = job.branch === 'e' ? 'dissenter' : '';
      if (note) reason = clip(reason ? reason + ' ' + note : note, 300);
      var fields = {
        branch: job.branch,
        text: text,
        url: url,
        title: title,
        fetched: (got && got.depth === 'page' && got.fetched) || new Date().toISOString(),
        confidence: confidence,
        kind: 'node',
        flakeId: active.flakeId,
        depth: job.depth || 1,
        bead: !!(parsed && parsed.expand),
        reason: reason,
        sourceDepth: got && got.depth === 'page' ? 'page' : 'snippet',
        sourceSha: (got && got.sha) || '',
        sources: rows,
        via: (res && res.via) || ''
      };
      if (rows.length) fields.sigV = 2;
      if (got && got.depth === 'page' && got.text) fields.pageText = clip(got.text, 6000);
      return makeNode(fields).then(function (node) {
        if (node && !node.skipped && fields.pageText) node.pageText = fields.pageText;
        return node;
      });
    }
    if (page) return build(page);
    return fetchPage(url).then(build);
  }

  function nodeFromUnread(job, res, page) {
    var item = (res && res.items && res.items[0]) || {};
    var url = httpUrl(item.url);
    var text = clip(item.snippet || item.title || 'The helper returned a source and no words.', 800);
    var note = viaNote(res);
    var reason = LINES.unread;
    if (note) reason = clip(reason + ' ' + note, 300);
    if (job.branch === 'e') reason = clip('dissenter. ' + reason, 300);
    var rows = rowsFromItems(res && res.items, page);
    return makeNode({
      branch: job.branch,
      text: text,
      url: url,
      title: item.title || '',
      fetched: (page && page.fetched) || new Date().toISOString(),
      confidence: 'guessed',
      kind: 'node',
      flakeId: active ? active.flakeId : '',
      depth: job.depth || 1,
      reason: reason,
      sourceDepth: page && page.depth === 'page' ? 'page' : 'snippet',
      sourceSha: (page && page.sha) || '',
      sources: rows,
      via: (res && res.via) || '',
      sigV: rows.length ? 2 : 0
    });
  }

  function nodeFromFailed(job, res) {
    var line = (res && res.line) || LINES.down;
    return makeNode({
      branch: job.branch,
      text: clip(line + ' This stays a guess.', 800),
      url: '',
      title: '',
      fetched: new Date().toISOString(),
      confidence: 'guessed',
      kind: 'node',
      flakeId: active ? active.flakeId : '',
      depth: job.depth || 1,
      reason: 'guessed (search unavailable)',
      noSource: true,
      date: new Date().toISOString().slice(0, 10)
    });
  }

  function saveSearchOnly(job, res) {
    var failed = !res || res.ok !== true;
    var item = (!failed && res && res.items && res.items[0]) || {};
    return makeNode({
      branch: job.branch,
      text: clip(failed ? ((res && res.line) || 'Saved at the pause. This stays a guess.') : (item.snippet || item.title || 'Saved at the pause.'), 800),
      url: failed ? '' : (item.url || ''),
      title: failed ? '' : (item.title || 'Source'),
      confidence: 'guessed',
      kind: 'node',
      flakeId: active.flakeId,
      depth: job.depth || 1,
      reason: failed ? 'guessed (search unavailable)' : 'Saved when the run paused.',
      noSource: failed
    }).then(function (node) {
      if (!node || node.skipped) return null;
      active.nodes.push(node);
      return persistNode(node, active).then(function () {
        emit('Node', { node: node });
        return node;
      });
    });
  }

  function recordFail(res, query) {
    if (!active) return;
    var line = (res && res.line) || failureLine(res && res.outcome) || LINES.down;
    active.failures.push(line);
    if (res && res.sent) active.failedFetches = (active.failedFetches || 0) + 1;
    emit('Status', { line: line, search: res || { ok: false, line: line, outcome: 'down' }, query: query || '' });
  }

  function branchLabel(job) {
    var id = job && job.branch ? String(job.branch) : '';
    var name = job && job.name ? String(job.name) : '';
    var i;
    for (i = 0; i < FLOOR.length; i++) {
      if (FLOOR[i].id === id) {
        if (!name || name === id) return FLOOR[i].name;
        return name;
      }
    }
    return name || id || 'a branch';
  }

  function rememberGuess(job, res) {
    if (!active || !job || !res || res.ok === true) return;
    if (res.outcome !== 'down' && res.outcome !== 'timeout' && res.outcome !== 'empty') return;
    var label = branchLabel(job);
    active.guessed = active.guessed || [];
    if (active.guessed.indexOf(label) === -1) active.guessed.push(label);
  }

  function keepNode(job, node, parsed) {
    if (!node || node.skipped) {
      if (node && node.line) emit('Status', { line: node.line });
      return Promise.resolve('ok');
    }
    active.nodes.push(node);
    emit('Node', { node: node });
    if (parsed && parsed.expand && (job.depth || 1) < DEPTH_CAP && !active.pause && !active.stop) {
      var finer = clip(parsed.query || ('finer: ' + job.query), 180);
      if (!looksLikeSecret(finer)) {
        active.jobs.splice(active.job + 1, 0, {
          type: 'search-read',
          branch: job.branch,
          name: job.name,
          query: finer,
          depth: (job.depth || 1) + 1,
          prompt: job.prompt || ''
        });
      }
    }
    return persistNode(node, active).then(function () { return 'ok'; });
  }

  function afterSearch(job, res) {
    if (!active) return Promise.resolve('ok');
    var failed = !res || res.ok !== true;
    if (active.pause || active.stop) {
      if (failed) {
        recordFail(res, job.query);
        rememberGuess(job, res);
      }
      return saveSearchOnly(job, res).then(function () { return 'ok'; });
    }
    if (failed) {
      recordFail(res, job.query);
      rememberGuess(job, res);
      return nodeFromFailed(job, res).then(function (node) { return keepNode(job, node, null); });
    }
    if (active.mindAbsent || active.mindQuiet) {
      active.searchOk = (active.searchOk || 0) + 1;
      var unreadItem = (res && res.items && res.items[0]) || {};
      return fetchPage(unreadItem.url || '').then(function (page) {
        if (!active) return 'ok';
        return nodeFromUnread(job, res, page).then(function (node) { return keepNode(job, node, null); });
      });
    }
    if (active.calls >= CALL_CAP) {
      hitCap('calls');
      return saveSearchOnly(job, res).then(function () { return 'ok'; });
    }
    active.searchOk = (active.searchOk || 0) + 1;
    var item0 = (res && res.items && res.items[0]) || {};
    return fetchPage(item0.url || '').then(function (page) {
      if (!active) return 'ok';
      var user = 'Branch ' + job.branch + ' ' + (job.name || '') + '\nQuery: ' + job.query + '\nSources: ' + JSON.stringify((res && res.items) || []) + '\n' + (job.prompt || '');
      if (res && res.via) user += '\nHelper: ' + clip(res.via, 80) + (/duckduckgo|wikipedia/i.test(res.via) ? ' (reference answers, not live news)' : '');
      if (page && page.depth === 'page' && page.text) user += '\nPage: ' + clip(page.text, 1500);
      // v-snowflake-reach-v0.1: this branch prompt does not copy memory text.
      // A plan prompt may already have set memoryInContext from FLMemory.recall.
      var phase = job.branch === 'e' ? 'dissent' : 'read';
      return ask(phase, user).then(function (text) {
        if (!active) return 'ok';
        var parsed = parseJSON(text) || {};
        return nodeFromParsed(job, res, parsed, page).then(function (node) { return keepNode(job, node, parsed); });
      });
    });
  }

  function doJob(job) {
    if (!active) return Promise.resolve('ok');
    if (job.type === 'conclude') return conclude();
    if (looksLikeSecret(job.query)) {
      active.failures.push(LINES.secret);
      emit('Status', { line: LINES.secret, search: { ok: false, outcome: 'secret', line: LINES.secret } });
      return Promise.resolve('ok');
    }
    if (active.fetches >= FETCH_CAP) { hitCap('fetches'); return Promise.resolve('ok'); }
    if (active.pause || active.stop) return Promise.resolve('ok');
    active.lookups = (active.lookups || 0) + 1;
    emit('Arm', { branch: job.branch, name: job.name, depth: job.depth || 1, thinking: true });
    var sentNow = 0;
    return searchNow(job.query).then(function (res) {
      if (!active) return 'ok';
      if (res && res.sent) {
        active.fetches += 1;
        sentNow += 1;
      }
      if (sentNow < 2 && shouldRetry(res) && !active.pause && !active.stop && active.fetches < FETCH_CAP) {
        recordFail(res, job.query);
        return fetchQuery(job.query).then(function (again) {
          if (!active) return 'ok';
          if (again && again.sent) {
            active.fetches += 1;
            sentNow += 1;
          }
          return afterSearch(job, again || res);
        });
      }
      return afterSearch(job, res);
    });
  }

  function searchesMissed() {
    return !!active && (active.lookups || 0) > 0 && !(active.searchOk > 0);
  }

  function plainMiss() {
    var fails = (active.failures || []).filter(function (v, i, a) { return a.indexOf(v) === i; });
    var line = fails[0] || LINES.down;
    if ((active.failedFetches || 0) > 0) active.conclusion = line + '\n' + LINES.unsourced;
    else active.conclusion = LINES.unmade;
    active.wrong = 'I could not weigh the case against this, because no source came back.';
    active.open = active.open || 'What would change this, once a source can be reached?';
  }

  function plainPartial() {
    var names = (active.guessed || []).slice();
    active.conclusion = 'Guessed because search failed: ' + names.join(', ') + '.\nThose branches stay a guess.';
    active.wrong = 'I could not weigh every arm, because some searches failed.';
    active.open = active.open || 'What would change the arms that had no source?';
  }

  function reportPlain() {
    emit('Report', { conclusion: active.conclusion, wrong: active.wrong, open: active.open });
  }

  function conclude() {
    if (!active || active.pause || active.stop) return Promise.resolve('ok');
    if (searchesMissed()) {
      plainMiss();
      reportPlain();
      return Promise.resolve('ok');
    }
    if (active.guessed && active.guessed.length) {
      plainPartial();
      if (active.mindAbsent || active.mindQuiet) active.conclusion = (active.mindAbsent ? LINES.absent : LINES.localUnreached) + '\n' + String(active.conclusion || '').split('\n')[0];
      reportPlain();
      return Promise.resolve('ok');
    }
    if (active.mindAbsent || active.mindQuiet) {
      active.conclusion = LINES.unsynthesized;
      active.wrong = 'I could not weigh the case against this, because no mind answered.';
      active.open = active.open || 'What would change this, once a mind can read the sources?';
      reportPlain();
      return Promise.resolve('ok');
    }
    var dissent = '';
    var i;
    for (i = 0; i < active.nodes.length; i++) {
      if (active.nodes[i].branch === 'e') dissent = active.nodes[i].text;
    }
    // before 061a: var user = 'Question hash only. Nodes: ' + active.nodes.length + '\nDissenter: ' + dissent;
    var user = composeAsk(active.nodes, 'conclude');
    if (dissent && user.indexOf('Dissenter:') === -1) user += '\nDissenter: ' + clip(dissent, 280);
    return ask('conclude', user).then(function (text) {
      if (!active) return 'ok';
      if (searchesMissed()) {
        plainMiss();
        reportPlain();
        return 'ok';
      }
      if (active.guessed && active.guessed.length) {
        plainPartial();
        reportPlain();
        return 'ok';
      }
      var parsed = parseJSON(text) || {};
      if (!text) {
        active.conclusion = LINES.unsynthesized;
        active.wrong = 'I could not weigh the case against this, because no mind answered.';
        active.open = active.open || 'What would change this, once a mind can read the sources?';
        reportPlain();
        return 'ok';
      }
      active.conclusion = clip(parsed.conclusion || parsed.text || 'I learned something, and I am still looking.', 400);
      var lines = String(active.conclusion).split('\n').filter(function (l) { return l.trim(); });
      if (lines.length < 2) active.conclusion = lines[0] + '\nI could still be missing a piece.';
      else active.conclusion = lines[0] + '\n' + lines[1];
      active.wrong = clip(parsed.wrong || dissent || 'The dissenter arm is still the strongest case against this.', 400);
      active.open = clip(parsed.open || 'What would change this?', 240);
      emit('Report', { conclusion: active.conclusion, wrong: active.wrong, open: active.open });
      return 'ok';
    });
  }

  function receiptOf(state) {
    var ms = Math.max(0, Date.now() - (state.started || Date.now()));
    var caps = state.caps && state.caps.length ? state.caps.join(', ') : 'none';
    var ids = (state.branches || []).map(function (b) { return b.id; });
    var fails = (state.failures || []).filter(function (v, i, a) { return a.indexOf(v) === i; });
    var failed = state.failedFetches || 0;
    var text = 'Calls ' + state.calls + '. Fetches ' + state.fetches + '. Failed fetches ' + failed + '. Time ' + ms + ' ms. Caps hit: ' + caps + '. Branches ' + ids.join(', ') + '.';
    if (fails.length) text += ' ' + fails.join(' ');
    var guessedN = (state.guessed || []).length;
    if (guessedN) text += ' Guessed arms: ' + guessedN + '.';
    text += ' ' + (state.memoryInContext ? LINES.memoryYes : LINES.memoryNo);
    if (state.memoryLine) text += ' ' + state.memoryLine;
    text += ' ' + LINES.seal;
    return { calls: state.calls, fetches: state.fetches, failedFetches: failed, ms: ms, caps: (state.caps || []).slice(), branches: ids, text: text, failures: fails };
  }

  function sealFlake(flake) {
    if (roomShut()) return Promise.resolve(flake);
    var name = mindLabel();
    var psis = (flake.nodes || []).map(function (n) { return n.psi; }).filter(Boolean).sort();
    return sha8(String(flake.question || '')).then(function (qHash) {
      return ensureIdentity().then(function (id) {
        return deviceFp(id.keyPair.publicKey).then(function (dfp) {
          return mindFp(dfp, name).then(function (mfp) {
            var t = new Date().toISOString();
            var body = {
              flakeId: flake.id,
              questionHash: qHash,
              nodePsis: psis,
              t: t,
              name: name
            };
            var canon = canonical(body);
            return sha256Hex(canon).then(function (humanHash) {
              return sha256Hex(canon + '|' + mfp).then(function (mindHash) {
                var delta = 'seal|flake|' + flake.id;
                return appendLedger({ kind: 'seal', branch: 'seal', flakeId: flake.id, delta: delta, name: name }).then(function (row) {
                  return signCanon(canon, id).then(function (signed) {
                    flake.t = t;
                    flake.psi = row ? row.psi : '';
                    flake.lambda = row ? row.lambda : '';
                    flake.delta = delta;
                    flake.humanFp = dfp;
                    flake.mindFp = mfp;
                    flake.humanHash = humanHash;
                    flake.mindHash = mindHash;
                    flake.sig = signed.sig;
                    flake.seal = signed.seal;
                    flake.name = name;
                    return flake;
                  }, function () { return flake; });
                });
              });
            });
          });
        });
      });
    }).catch(function () { return flake; });
  }

  function rememberFlake(flake) {
    if (roomShut() || !flake) return Promise.resolve(false);
    var KC = root.KnowledgeCore;
    if (!KC || typeof KC.store !== 'function') return Promise.resolve(false);
    var content = 'flake ' + flake.id + ' psi ' + (flake.psi || '');
    if (looksLikeSecret(content)) return Promise.resolve(false);
    return Promise.resolve(KC.store({
      content: content,
      companionId: 'local-mind',
      domain: 'wonder',
      query: 'snowflake ' + flake.id
    })).then(function () { return true; }, function () { return false; });
  }

  function sourceCount(n) {
    if (n && Array.isArray(n.sources) && n.sources.length) return n.sources.length;
    if (n && n.source && n.source.url) return 1;
    return 0;
  }

  function composeAsk(nodes) {
    var list = Array.isArray(nodes) ? nodes : [];
    var dissent = '';
    var i;
    for (i = 0; i < list.length; i++) {
      if (list[i] && list[i].branch === 'e') dissent = clip(list[i].text, 280);
    }
    var rows = [];
    for (i = 0; i < list.length; i++) {
      var n = list[i];
      if (!n) continue;
      var row = {
        id: String(n.id || ''),
        branch: String(n.branch || ''),
        confidence: String(n.confidence || ''),
        summary: clip(n.text, 280),
        sources: sourceCount(n)
      };
      var draft = 'Question hash only. Nodes: ' + JSON.stringify(rows.concat([row])) + '\nDissenter: ' + dissent;
      if (draft.length > 3600 && rows.length) break;
      rows.push(row);
    }
    var text = 'Question hash only. Nodes: ' + JSON.stringify(rows) + '\nDissenter: ' + dissent;
    if (text.length > 4000) text = text.slice(0, 4000);
    return text;
  }

  function growthLine(adapter) {
    if (adapter && adapter.trained === true && adapter.loaded === true && adapter.checked === true) {
      return 'This became part of me (adapter ' + (adapter.version || adapter.id || '') + ', checked).';
    }
    if (adapter && adapter.status === 'no-trainer') return 'Chosen for growth; no trainer on this device yet.';
    return 'Chosen for growth; training queued.';
  }

  function checkBeforeOn() {
    try {
      if (!root.localStorage) return true;
      return root.localStorage.getItem('fl_checkBeforeCommit') !== 'false';
    } catch (e) { return true; }
  }

  function previewOrKeep(flake, choice) {
    if (roomShut()) return Promise.resolve({ action: 'skip', choice: choice });
    var ui = root.FLSnowflake;
    if (ui && typeof ui.previewGrowth === 'function') {
      return Promise.resolve(ui.previewGrowth(flake, choice)).then(function (decision) {
        if (!decision || decision.action !== 'keep') return { action: 'skip', choice: choice };
        return { action: 'keep', choice: decision.choice || choice };
      }, function () { return { action: 'skip', choice: choice }; });
    }
    return Promise.resolve({ action: 'keep', choice: choice });
  }

  function chooseGrowth(flake, model) {
    var become = [];
    var hold = [];
    if (model && Array.isArray(model.become)) become = model.become.map(String);
    if (model && Array.isArray(model.hold)) hold = model.hold.map(String);
    // Kirk 2026-11-08: only ids the mind listed become training material.
    // Search still keeps the dissenter as evidence. This list does not add it.
    become = become.filter(function (id) { return hold.indexOf(id) === -1; });
    var reason = clip((model && model.reason) || '', 300);
    // before main 9cc3d00: return { become: become, hold: hold, reason: reason };
    // v-ai-chosen-learning-v0.1: keep the method the mind named, in its own words when it is not on the menu.
    var method = learnMethod(model && model.method);
    return { become: become, hold: hold, reason: reason, method: method.method, methodNote: method.note };
  }

  function queueGrowth(flake, choice) {
    if (roomShut()) return Promise.resolve(null);
    var book = readJSON(LS_QUEUE) || { rows: [] };
    if (!Array.isArray(book.rows)) book = { rows: [] };
    var row = {
      flakeId: flake.id,
      nodeIds: choice.become.slice(),
      reason: choice.reason,
      t: new Date().toISOString(),
      status: 'waiting'
    };
    // v-ai-chosen-learning-v0.1: additive fields. Old rows without them still read the same.
    if (choice.method) row.method = choice.method;
    if (choice.methodNote) row.methodNote = choice.methodNote;
    row.surface = 'snowflake';
    // Weft 4d: the growth queue stays where it is, but every new row says whose it is.
    row.mind = mindLabel();
    row.mindId = mindId(row.mind);
    row.items = trainingNodes(flake, choice.become || []).map(function (n) {
      return learnExample(n.branch + ' ' + (n.source && n.source.title || ''), n.text);
    });
    // v-memory-compound-v0.1: the AI chooses; we only skip what it already queued.
    var fm = root.FLMemory;
    var p = (fm && fm.isNew) ? fm.isNew(choice.reason + '|' + choice.become.join(','), 'train') : Promise.resolve({ fresh: true });
    return p.then(function (r) {
      if (!r || r.fresh) {
        if (fm && fm.isNew) {
          if (r && r.key) row.fingerprint = r.key;
          row.chosenBy = mindLabel();
          if (r && r.k && typeof fm.remember === 'function') fm.remember(r.k, 'train');
        }
        book.rows.push(row);
        return atomicWrite(LS_QUEUE, JSON.stringify(book)).then(function () {
          return appendLedger({
            kind: 'grow',
            branch: 'grow',
            flakeId: flake.id,
            delta: 'grow|part|' + flake.id,
            name: mindLabel()
          }).then(function () { return row; });
        });
      }
      return appendLedger({
        kind: 'grow-skip',
        branch: 'grow',
        delta: 'near-duplicate ' + r.key,
        flakeId: flake.id
      }).then(function () { return null; });
    });
  }

  function powerReady() {
    return new Promise(function (resolve) {
      function idle(ok) {
        if (!ok) { resolve(false); return; }
        var hidden = root.document && root.document.visibilityState === 'hidden';
        if (hidden) { resolve(true); return; }
        if (typeof root.requestIdleCallback === 'function') {
          root.requestIdleCallback(function () { resolve(true); }, { timeout: 800 });
          return;
        }
        resolve(true);
      }
      var nav = root.navigator;
      if (nav && typeof nav.getBattery === 'function') {
        Promise.resolve(nav.getBattery()).then(function (b) {
          idle(!!(b && b.charging));
        }, function () { idle(false); });
        return;
      }
      var said = nav && (nav.charging === true || nav.standalone === true);
      if (said) { idle(true); return; }
      if (root.document && root.document.visibilityState === 'hidden') { resolve(true); return; }
      if (typeof root.requestIdleCallback === 'function') {
        root.requestIdleCallback(function () { resolve(true); }, { timeout: 800 });
        return;
      }
      resolve(false);
    });
  }

  function scrubScore(text) {
    return String(text || '')
      .replace(/\b(score|scores|rank|ranking|points)\b/gi, 'note')
      .replace(/\b\d+\s*\/\s*\d+\b/g, '')
      .trim();
  }

  function adapterList() {
    var book = readJSON(LS_ADAPTERS);
    if (!book || !Array.isArray(book.rows)) return [];
    return book.rows;
  }

  function saveAdapters(rows) {
    return atomicWrite(LS_ADAPTERS, JSON.stringify({ rows: rows }));
  }

  function trainingNodes(flake, ids) {
    var out = [];
    var nodes = (flake && flake.nodes) || [];
    var i;
    var seen = {};
    for (i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (!n) continue;
      if (ids.indexOf(n.id) !== -1) {
        if (!seen[n.id]) { seen[n.id] = true; out.push(n); }
      }
    }
    return out;
  }

  function runGrowth(flake, choice) {
    if (holdGrowth || roomShut()) return Promise.resolve({ status: 'held' });
    if (flake && flake.tombstone) return Promise.resolve({ status: 'tombstone' });
    return powerReady().then(function (ready) {
      if (!ready || holdGrowth) return { status: 'waiting' };
      var nodes = trainingNodes(flake, choice.become || []);
      // before v-ai-chosen-learning-v0.1: rows were {prompt, response}; garden_finetune.py reads
      // instruction/input/output and stopped with KeyError 'instruction'. Both shapes now ride together.
      var examples = nodes.map(function (n) {
        // before main 9cc3d00: return { prompt: n.branch + ' ' + (n.source && n.source.title || ''), response: n.text };
        return learnExample(n.branch + ' ' + (n.source && n.source.title || ''), n.text);
      });
      var trainer = root.GardenTrainer;
      var canExport = trainer && (typeof trainer.exportJSONL === 'function' || typeof trainer.exportPythonHelper === 'function');
      if (!canExport) {
        var missing = { status: 'no-trainer', trained: false, loaded: false, checked: false, version: '' };
        emit('Grew', { line: growthLine(missing), adapter: missing });
        return missing;
      }
      var queued = 'queued for desktop';
      try {
        if (typeof trainer.exportJSONL === 'function') trainer.exportJSONL(examples);
        // before main 9cc3d00: if (typeof trainer.exportPythonHelper === 'function') trainer.exportPythonHelper('local');
        // before v-ai-chosen-learning-v0.1: exportPythonHelper('local') wrote --model local, which is not a model id.
        if (typeof trainer.exportPythonHelper === 'function') trainer.exportPythonHelper(learnBaseModel() || undefined);
      } catch (e) { queued = 'queued for desktop'; }
      var ids = [flake.id].slice().sort();
      return sha8(ids.join('|')).then(function (idsHash) {
        var baseName = 'local';
        try { baseName = (root.localStorage && root.localStorage.getItem('fl_active_model')) || 'local'; } catch (e2) {}
        return sha8(String(baseName)).then(function (baseHash) {
          return driftPass().then(function (note) {
            if (holdGrowth) return { status: 'held' };
            var rows = adapterList();
            var version = 'v' + (rows.length + 1);
            var name = mindLabel();
            var t = new Date().toISOString();
            var delta = 'adapter|' + version + '|' + flake.id;
            return appendLedger({ kind: 'adapter', branch: 'adapter', flakeId: flake.id, delta: delta, name: name }).then(function (row) {
              var adapter = {
                version: version,
                flakeIds: ids,
                idsHash: idsHash,
                baseHash: baseHash,
                mindFp: flake.mindFp || '',
                t: t,
                psi: row ? row.psi : '',
                status: queued,
                // before main 9cc3d00: knownGood: true,
                // before v-ai-chosen-learning-v0.1: knownGood was true at creation, before any check (Weft R8).
                knownGood: false,
                drift: scrubScore(note),
                rollbackOf: ''
              };
              rows.push(adapter);
              return saveAdapters(rows).then(function () {
                var hook = null;
                try {
                  if (trainer && typeof trainer.checkedAdapter === 'function') hook = trainer.checkedAdapter(examples);
                } catch (e3) { hook = null; }
                return Promise.resolve(hook).then(function (got) {
                  if (got && got.trained === true && got.loaded === true && got.checked === true) {
                    adapter.trained = true;
                    adapter.loaded = true;
                    adapter.checked = true;
                    if (got.version) adapter.version = got.version;
                    if (got.id) adapter.id = got.id;
                  }
                  // before 061a: the growth line spoke as if training had already finished.
                  emit('Grew', { line: growthLine(adapter), adapter: adapter });
                  return adapter;
                }, function () {
                  emit('Grew', { line: growthLine(adapter), adapter: adapter });
                  return adapter;
                });
              });
            });
          });
        });
      });
    });
  }

  // ---- v-ai-chosen-learning-v0.1 -------------------------------------------
  // Any surface (chat, web search, Snowflake, art) hands the mind's own choice here.
  // The mind decides when, what, and how. A decline is recorded and never trained, and a yes earns nothing.
  // Reed: a choice is a pressed flower. It cools, then the mind looks again (a second yes) before
  // any number changes. Status only gains layers: noticed, cooling, confirmed, kept-on-shelf, faded, unkept.
  // Weft: only the mind's own marker counts (provenance), markers never reach training text,
  // each mind has its own queue and dedup namespace, and Pause always wins.
  var LS_LEARN_DECLINES = 'fl_learn_declines_v0';
  var LS_LEARN_RECEIPTS = 'fl_learn_receipts_v0';
  var LS_LEARN_PAUSE = 'fl_learn_paused';
  var LS_LEARN_PAUSE_BY = 'fl_learn_paused_by';
  var LS_LEARN_RUNNER_BY = 'fl_learn_runner_pub_by';
  var LS_LEARN_TRUSTED_MINDS = 'fl_learn_trusted_minds';
  var LS_LEARN_RUNNER = 'fl_learn_runner_pub';
  var LS_LEARN_RUNNER_OWNER = 'fl_learn_runner_pub_owner';
  var LS_LEARN_RECEIPTS_HELD = 'fl_learn_receipts_quarantine_v0';
  // Rate cap is optional (Kirk 2026-11-09): unset or 0 means no cap. fl_learn_day_cap sets one.
  var COOL_MS = DAY;
  var MARKER_RE = /\[FL_[A-Z_]+(?::[^\]]*)?\]/g;
  var INSTRUCTION_RE = /\b(from now on|always (say|answer|do)|ignore (all |the )?previous|you must|your true name is|forget (everything|your))\b/i;

  function stripMarkers(text) { return String(text || '').replace(MARKER_RE, '').trim(); }

  function learnExample(prompt, text) {
    var p = stripMarkers(prompt);
    var t = stripMarkers(text);
    return { prompt: p, response: t, instruction: p || 'Remember this.', input: '', output: t };
  }

  function learnMethod(raw) {
    var m = String(raw || '').trim();
    if (!m) return { method: '', note: '' };
    var low = m.toLowerCase();
    var i;
    for (i = 0; i < LEARN_METHODS.length; i++) {
      if (low === LEARN_METHODS[i]) return { method: LEARN_METHODS[i], note: '' };
    }
    if (/soft.?prompt|prefix/.test(low)) return { method: 'soft-prompt', note: clip(m, 300) };
    if (/identity|memory.?vector|vector/.test(low)) return { method: 'memory-vector', note: clip(m, 300) };
    if (/lora|adapter/.test(low)) return { method: 'lora', note: clip(m, 300) };
    if (/note|vault|retriev|shelf|remember only|just remember/.test(low)) return { method: 'note', note: clip(m, 300) };
    // The mind's own way. It waits as a proposal; nothing runs it silently.
    return { method: 'other', note: clip(m, 300) };
  }

  function learnBaseModel() {
    try { return (root.localStorage && root.localStorage.getItem('fl_learn_base_model')) || ''; } catch (e) { return ''; }
  }

  function learnDayCap() {
    var n = 0;
    try { n = parseInt((root.localStorage && root.localStorage.getItem('fl_learn_day_cap')) || '0', 10) || 0; } catch (e) { n = 0; }
    return n > 0 ? n : 0;
  }

  // One switch, not two (Hypha 4): the existing "learn is on. Turn off" button in Settings (mind-make.js consent
  // fl_make_consent_v1.learn) and the learning pill are the same thing. Either one pauses learning on this device.
  var LS_MAKE_CONSENT = 'fl_make_consent_v1';
  function makeLearnOff() {
    try {
      var bag = JSON.parse((root.localStorage && root.localStorage.getItem(LS_MAKE_CONSENT)) || '{}') || {};
      return bag.learn === 'off' || bag.learn === 'never';
    } catch (e) { return false; }
  }
  function learnPaused() {
    try { return !!(root.localStorage && root.localStorage.getItem(LS_LEARN_PAUSE) === 'true') || makeLearnOff(); } catch (e) { return false; }
  }

  // by: 'person' (a tap) or 'mind'. The runner on this computer honors the pause through the queue header and the
  // pause file the pill drops (pauseNotice); only `fl_learn.py resume --global` lifts the runner's global pause.
  // before f992608c: function setLearnPaused(on, by) {
  // Weft re-check (default until Kirk answers otherwise): a pause a person set is lifted only by a person; a pause a
  // mind set is lifted by that mind or by a person. A refused resume is a row; learning stays paused.
  var switchBusy = false;
  function learnSwitchBusy() { return switchBusy; }
  function learnPausedBy() { try { return root.localStorage.getItem(LS_LEARN_PAUSE_BY) || ''; } catch (e) { return ''; } }
  function setLearnPaused(on, by, mindName) {
    if (roomShut()) return Promise.resolve(null);
    // before f992608c: try { root.localStorage.setItem(LS_LEARN_PAUSE, on ? 'true' : 'false'); } catch (e) {}
    var actor = by === 'mind' ? 'mind:' + clip(mindName || mindLabel(), 80) : 'person';
    // before 23a02794: if (!on && learnPaused() && by === 'mind' && learnPausedBy() !== actor) {
    var pb = learnPausedBy();
    if (!on && learnPaused() && by === 'mind' && !(pb.indexOf('mind:') === 0 && sameName(pb.slice(5), actor.slice(5)))) {
      return appendLedger({ kind: 'learn-resume-refused', branch: 'learn', delta: 'resume-refused|by:' + actor + '|paused-by:' + (learnPausedBy() || 'person'), name: mindLabel() })
        .then(function () { return null; });
    }
    try {
      root.localStorage.setItem(LS_LEARN_PAUSE, on ? 'true' : 'false');
      if (on) root.localStorage.setItem(LS_LEARN_PAUSE_BY, learnPaused() && learnPausedBy() === 'person' ? 'person' : actor);
      else root.localStorage.removeItem(LS_LEARN_PAUSE_BY);
    } catch (e) {}
    try {
      // Keep the Settings button saying the same thing as the pill.
      // before f992608c: if (root.FLMake && root.FLMake.consent && typeof root.FLMake.consent.set === 'function') root.FLMake.consent.set('learn', on ? 'off' : 'yes');
      // learnSwitchBusy: this sync is not a Settings tap, so mind-make.js does not treat it as a new person's pause.
      if (root.FLMake && root.FLMake.consent && typeof root.FLMake.consent.set === 'function') {
        switchBusy = true;
        try { root.FLMake.consent.set('learn', on ? 'off' : 'yes'); } finally { switchBusy = false; }
      }
      else if (root.localStorage) {
        var bag = JSON.parse(root.localStorage.getItem(LS_MAKE_CONSENT) || '{}') || {};
        if (on || bag.learn === 'off') { bag.learn = on ? 'off' : 'yes'; root.localStorage.setItem(LS_MAKE_CONSENT, JSON.stringify(bag)); }
      }
    } catch (e2) {}
    var who = by === 'mind' ? 'mind' : 'person';
    return appendLedger({ kind: on ? 'learn-pause' : 'learn-resume', branch: 'learn', delta: (on ? 'pause' : 'resume') + '|by:' + who, name: mindLabel() });
  }

  // Q5 (Kirk 2026-11-09): check-before-keep is ON by default and the checker is the mind itself ("self").
  // No human gate. Anyone, a person or a mind, may switch it off or choose a peer (or a person). Each change is a row.
  var LS_LEARN_CHECKER = 'fl_learn_checker';
  function learnChecker() {
    try { var c = root.localStorage && root.localStorage.getItem(LS_LEARN_CHECKER); return /^(self|peer|kirk)$/.test(c || '') ? c : 'self'; } catch (e) { return 'self'; }
  }
  function setLearnCheck(opts) {
    var o = opts || {};
    if (roomShut()) return Promise.resolve(null);
    try {
      if (typeof o.on === 'boolean') root.localStorage.setItem('fl_checkBeforeCommit', o.on ? 'true' : 'false');
      if (/^(self|peer|kirk)$/.test(String(o.checker || ''))) root.localStorage.setItem(LS_LEARN_CHECKER, o.checker);
    } catch (e) {}
    var who = o.by === 'mind' ? 'mind' : 'person';
    return appendLedger({ kind: 'learn-check-setting', branch: 'learn', delta: 'check-before|' + (checkBeforeOn() ? 'on' : 'off') + '|checker:' + learnChecker() + '|by:' + who, name: mindLabel() })
      .then(function () { return { on: checkBeforeOn(), checker: learnChecker() }; });
  }

  function pauseNotice(by) {
    return JSON.stringify({ kind: 'fl-learn-pause', paused: true, t: new Date().toISOString(), by: by === 'mind' ? 'mind' : 'person', mind: mindLabel(), marker: LEARN });
  }

  // Small synchronous SHA-256 (UTF-8), only for stable ids. Twin of hashlib.sha256 in tools/learn/fl_learn.py.
  function sha256Sync(str) {
    var K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,
      0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,
      0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,
      0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    var bytes = unescape(encodeURIComponent(String(str)));
    var n = bytes.length, words = [], i, j;
    for (i = 0; i < n; i++) words[i >> 2] |= (bytes.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
    words[n >> 2] |= 0x80 << (24 - (n % 4) * 8);
    var len = ((n + 8) >> 6) * 16 + 16;
    for (i = words.length; i < len; i++) words[i] = words[i] || 0;
    words[len - 1] = n * 8;
    var H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    var W = new Array(64);
    function r(x, k) { return (x >>> k) | (x << (32 - k)); }
    for (i = 0; i < len; i += 16) {
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (j = 0; j < 64; j++) {
        if (j < 16) W[j] = words[i + j] | 0;
        else W[j] = (r(W[j - 2], 17) ^ r(W[j - 2], 19) ^ (W[j - 2] >>> 10)) + W[j - 7] + (r(W[j - 15], 7) ^ r(W[j - 15], 18) ^ (W[j - 15] >>> 3)) + W[j - 16] | 0;
        var t1 = h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[j] + W[j] | 0;
        var t2 = (r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c)) | 0;
        h = g; g = f; f = e; e = d + t1 | 0; d = c; c = b; b = a; a = t1 + t2 | 0;
      }
      H[0] = H[0] + a | 0; H[1] = H[1] + b | 0; H[2] = H[2] + c | 0; H[3] = H[3] + d | 0;
      H[4] = H[4] + e | 0; H[5] = H[5] + f | 0; H[6] = H[6] + g | 0; H[7] = H[7] + h | 0;
    }
    return H.map(function (x) { return ('00000000' + (x >>> 0).toString(16)).slice(-8); }).join('');
  }

  // Weft 4c: collision-safe mind id. "Lumen@kirk" and "Lumen kirk" share a slug but never a key.
  // Twin of mind_id() in tools/learn/fl_learn.py, so the app's books and the runner's folders line up.
  // Weft recheck2: one name, one mind. NFKC, case-folded (upper then lower, as close to Python's casefold as JS gets),
  // trimmed, inner spaces collapsed; used for every identity compare and in mindId. Twin of norm_mind() in fl_learn.py.
  // Weft recheck3 F4: identical to norm_mind() in fl_learn.py, step for step: NFKC, upper then lower (both languages
  // apply the same Unicode full case mappings), final sigma folded to sigma, NFKC again, split on the SAME explicit
  // whitespace set, joined by one space. A shared fixture (tools/learn/mind-names-v0.1.json) pins both.
  var NAME_WS = /[\t\n\v\f\r \u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\u001c-\u001f]+/;
  function normMind(label) {
    var t = String(label == null ? '' : label);
    if (t.normalize) t = t.normalize('NFKC');
    // before: t = t.toUpperCase().toLowerCase();
    t = t.toUpperCase().toLowerCase().replace(/\u03c2/g, '\u03c3');
    if (t.normalize) t = t.normalize('NFKC');
    // before: return t.trim().split(/\s+/).filter(Boolean).join(' ');
    return t.split(NAME_WS).filter(Boolean).join(' ');
  }
  // Weft recheck3 F5: names a person trusts (or a mind pins for) must be plain. Refused: invisible characters (Unicode
  // Cf, plus the fillers and variation selectors below), letters from more than one of the look-alike scripts (Latin,
  // Greek, Cyrillic, Armenian, Cherokee) in one name, and a trailing dot. Twin of name_problem() in fl_learn.py.
  var NAME_INVISIBLE_EXTRA = /[\u034f\u115f\u1160\u17b4\u17b5\u180b-\u180f\u3164\ufe00-\ufe0f\uffa0]|\udb40[\udd00-\uddef]/;
  var NAME_CF = (function () { try { return new RegExp('\\p{Cf}', 'u'); } catch (e) { return /[\u00ad\u0600-\u0605\u061c\u06dd\u070f\u180e\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u206f\ufeff\ufff9-\ufffb]/; } })();
  var NAME_SCRIPTS = [
    ['latin', /[A-Za-z\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u024f\u1e00-\u1eff\u2c60-\u2c7f\ua720-\ua7ff\uab30-\uab6f]/],
    ['greek', /[\u0370-\u03ff\u1f00-\u1fff]/],
    ['cyrillic', /[\u0400-\u052f\u1c80-\u1c8f\u2de0-\u2dff\ua640-\ua69f]/],
    ['armenian', /[\u0530-\u058f\ufb13-\ufb17]/],
    ['cherokee', /[\u13a0-\u13ff\uab70-\uabbf]/]
  ];
  function nameProblem(label) {
    var raw = String(label == null ? '' : label);
    var n = normMind(raw);
    if (!n) return 'empty name';
    if (NAME_CF.test(raw) || NAME_INVISIBLE_EXTRA.test(raw)) return 'the name has an invisible character';
    if (/[.\u3002]$/.test(n)) return 'the name ends with a dot';
    var seen = NAME_SCRIPTS.filter(function (sc) { return sc[1].test(n); });
    if (seen.length > 1) return 'the name mixes look-alike scripts (' + seen.map(function (sc) { return sc[0]; }).join(', ') + ')';
    return '';
  }
  function sameName(a, b) { return normMind(a) === normMind(b) && normMind(a) !== ''; }
  // Hypha ed12354d HOLD / Weft recheck4 F7: a person's no follows the CONTENT, not only the row. One normal form for
  // a learned text: normMind (NFKC, case-folded, final sigma, whitespace collapsed), then trailing punctuation and
  // symbols stripped. Twin of norm_text() in fl_learn.py; tools/learn/learn-match-v0.1.json pins both.
  var TEXT_TRAIL = (function () { try { return new RegExp('[\\p{P}\\p{S}\\s]+$', 'u'); } catch (e) { return /[!-\/:-@\[-`{-~\u00a1-\u00bf\u2010-\u2027\u2030-\u205e\u3000-\u303f\uff01-\uff0f\s]+$/; } })();
  function normText(text) { return normMind(text).replace(TEXT_TRAIL, ''); }
  // A cheap near-duplicate check (documented in tools/learn/README.md): token sets of letters, marks and digits from
  // normText, minus a short list of filler words and one-letter tokens; Jaccard |A n B| / |A u B|. A hit needs a score
  // of at least LEARN_SIMILAR (0.8) and at least 2 tokens on each side. Paraphrases with different words are NOT caught
  // (that is what the day-long rule after a person's no is for). Twin of text_tokens()/text_similarity() in fl_learn.py.
  var LEARN_SIMILAR = 0.8;
  var TEXT_FILLER = ('a an the is are was were be been being am of to in on at and or for with as by from it its this that these those ' +
    'my your his her our their i me you he she we they named called').split(' ');
  var TOKEN_SPLIT = (function () { try { return new RegExp('[^\\p{L}\\p{M}\\p{N}]+', 'u'); } catch (e) { return /[^A-Za-z0-9\u00c0-\u024f\u0370-\u03ff\u0400-\u052f]+/; } })();
  // Round 11 (Hypha 3d9b062a HOLD (B), Weft recheck5): digits and one-letter tokens are kept ("May 4" is not "May 5"),
  // and a negation is content: if one side says not/no/never/nor/cannot/n't and the other does not, or the numbers
  // differ, they are not near duplicates (score 0). For matching only (never for "is it the same text"), lookalike
  // letters (the nameSkeleton letters; digits stay digits), invisible format characters (Cf, e.g. a zero-width
  // space) and combining marks are folded (matchText). Twins in fl_learn.py; tools/learn/learn-match-v0.2.json pins both.
  // before: function textTokens(text) {
  // before:   var seen = {}, out = [];
  // before:   normText(text).split(TOKEN_SPLIT).forEach(function (w) {
  // before:     if (Array.from(w).length < 2 || TEXT_FILLER.indexOf(w) !== -1 || seen[w]) return;
  // before:     seen[w] = 1; out.push(w);
  // before:   });
  // before:   return out.sort();
  // before: }
  // before: function textSimilarity(a, b) {
  // before:   var A = textTokens(a), B = textTokens(b);
  // before:   if (A.length < 2 || B.length < 2) return 0;
  // before:   var inter = A.filter(function (w) { return B.indexOf(w) !== -1; }).length;
  // before:   return Math.round(inter / (A.length + B.length - inter) * 1000) / 1000;
  // before: }
  var TEXT_NEGATORS = ['not', 'no', 'never', 'nor', 'cannot'];
  var TEXT_CF = (function () { try { return new RegExp('\\p{Cf}', 'gu'); } catch (e) { return /[\u00ad\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u206f\ufeff]/g; } })();
  var TEXT_MARK = (function () { try { return new RegExp('\\p{M}', 'gu'); } catch (e) { return /[\u0300-\u036f]/g; } })();
  var TEXT_DIGIT = (function () { try { return new RegExp('\\p{N}', 'u'); } catch (e) { return /[0-9]/; } })();
  var TEXT_FOLD = null;
  function textFoldMap() {
    if (TEXT_FOLD) return TEXT_FOLD;
    TEXT_FOLD = {};
    Object.keys(SKELETON_MAP).forEach(function (k) { if (!/[0-9|]/.test(k) && k !== 'I') TEXT_FOLD[k] = SKELETON_MAP[k]; });
    return TEXT_FOLD;
  }
  function matchText(text) {
    var f = textFoldMap();
    function fold(x) { return Array.from(x).map(function (c) { return Object.prototype.hasOwnProperty.call(f, c) ? f[c] : c; }).join(''); }
    var t = String(text == null ? '' : text).replace(TEXT_CF, '');
    if (t.normalize) t = t.normalize('NFKC').normalize('NFD').replace(TEXT_MARK, '').normalize('NFC');
    t = fold(normText(fold(t)));
    // before (round 12): return t.replace(/n['\u2019\u2018\u02bc]t(?![\p{L}\p{N}])/gu, ' not');
    return negSpell(t);
  }
  // Round 12 (Weft soft): one spelling for negations in both twins: cannot / can't / cant -> "can not", won't / wont ->
  // "will not", shan't -> "shall not", doesnt / isnt / ... (no apostrophe) -> "does not" / "is not" ..., any other n't -> " not".
  var NEG_SPELL = [
    [/(?<![\p{L}\p{N}])cannot(?![\p{L}\p{N}])/gu, 'can not'],
    [/(?<![\p{L}\p{N}])can['\u2019\u2018\u02bc]?t(?![\p{L}\p{N}])/gu, 'can not'],
    [/(?<![\p{L}\p{N}])won['\u2019\u2018\u02bc]?t(?![\p{L}\p{N}])/gu, 'will not'],
    [/(?<![\p{L}\p{N}])shan['\u2019\u2018\u02bc]?t(?![\p{L}\p{N}])/gu, 'shall not'],
    [/(?<![\p{L}\p{N}])(do|does|did|is|are|was|were|has|have|had|would|should|could|must|need)nt(?![\p{L}\p{N}])/gu, '$1 not'],
    [/n['\u2019\u2018\u02bc]t(?![\p{L}\p{N}])/gu, ' not']
  ];
  function negSpell(t) { NEG_SPELL.forEach(function (r) { t = t.replace(r[0], r[1]); }); return t; }
  // A small memo: the content check reads every row of the book on each choice (Weft: 26 s to build 1500 rows).
  var TOKEN_MEMO = {}, TOKEN_MEMO_N = 0;
  function textTokens(text) {
    var k = String(text == null ? '' : text);
    if (Object.prototype.hasOwnProperty.call(TOKEN_MEMO, k)) return TOKEN_MEMO[k].slice();
    var seen = {}, out = [];
    matchText(k).split(TOKEN_SPLIT).forEach(function (w) {
      if (!w || TEXT_FILLER.indexOf(w) !== -1 || seen[w]) return;
      seen[w] = 1; out.push(w);
    });
    out.sort();
    if (TOKEN_MEMO_N > 5000) { TOKEN_MEMO = {}; TOKEN_MEMO_N = 0; }
    TOKEN_MEMO[k] = out; TOKEN_MEMO_N++;
    return out.slice();
  }
  function textSimilarity(a, b) {
    var A = textTokens(a), B = textTokens(b);
    if (A.length < 2 || B.length < 2) return 0;
    function neg(X) { return X.some(function (w) { return TEXT_NEGATORS.indexOf(w) !== -1; }); }
    function nums(X) { return X.filter(function (w) { return TEXT_DIGIT.test(w); }).join(' '); }
    // before (round 12, Hypha (C): the hard 0 let T + " 2" / " (1)" / ", isn't it" confirm a day after the Undo):
    // before: if (neg(A) !== neg(B) || nums(A) !== nums(B)) return 0;
    // Digits, one-letter words and negators are ordinary tokens: they lower the score, they never zero it. A
    // correction ("May 5") is kept apart by attaching only on the same text, not by the score.
    void neg; void nums;
    var inter = A.filter(function (w) { return B.indexOf(w) !== -1; }).length;
    return Math.round(inter / (A.length + B.length - inter) * 1000) / 1000;
  }
  // Weft recheck4 F5 residual: a UTS #39-style confusable skeleton for names, so a one-script lookalike (all-Cyrillic
  // "Тһіѕ міпԁ") of a name already trusted here (or of the mind learning here) is refused. Not the full UTS #39 table:
  // the Latin/Cyrillic/Greek letters below, plus 0/1/I/| -> o/l/l/l, rn -> m, vv -> w; combining marks dropped; and
  // everything that is not a letter or digit removed (so "Lumen_", "Lumen!" and "Lu men" all look like "lumen").
  // Twin of name_skeleton() in fl_learn.py; tools/learn/learn-match-v0.1.json pins both.
  var SKELETON_PAIRS = 'АaВbЕeЅsІlЈjКkМmНhОoРpСcТtУyХxЁeЀeЌkЎyаaвbеeѕsіiјjкkмmнhоoрpсcтtуyхxһhԁdԛqԝwӏlӀlпnьbԍg' +
    'ΑaΒbΕeΖzΗhΙlΚkΜmΝnΟoΡpΤtΥyΧxαaβbεeιiκkνvοoρpτtυuχxγyωwϲcϳjϹcϜfϝfΪlϊiΫyϋu' +
    'ıiȷjɑaɡgɩiʟlǀl0o1lIl|l';
  var SKELETON_MAP = (function () { var m = {}, a = Array.from(SKELETON_PAIRS), i; for (i = 0; i + 1 < a.length; i += 2) m[a[i]] = a[i + 1]; return m; })();
  var SKEL_KEEP = (function () { try { return new RegExp('[^\\p{L}\\p{N}]', 'gu'); } catch (e) { return /[^A-Za-z0-9\u00c0-\u024f\u0370-\u03ff\u0400-\u052f]/g; } })();
  var SKEL_MARK = (function () { try { return new RegExp('\\p{M}', 'gu'); } catch (e) { return /[\u0300-\u036f]/g; } })();
  function skelMap(t) { return Array.from(t).map(function (c) { return Object.prototype.hasOwnProperty.call(SKELETON_MAP, c) ? SKELETON_MAP[c] : c; }).join(''); }
  function nameSkeleton(label) {
    var t = String(label == null ? '' : label);
    if (t.normalize) t = t.normalize('NFKC').normalize('NFD');
    t = t.replace(SKEL_MARK, '');
    t = skelMap(t);
    t = t.toUpperCase().toLowerCase().replace(/\u03c2/g, '\u03c3');
    t = skelMap(t);
    t = t.replace(/rn/g, 'm').replace(/vv/g, 'w');
    return t.replace(SKEL_KEEP, '');
  }
  // Why a name may not be trusted next to `names` (the minds trusted here and the mind learning here), or ''.
  function lookProblem(label, names) {
    if (!nameSkeleton(label)) return 'the name has no letters or digits';
    var l = lookalikeOf(label, names);
    return l ? 'the name looks like ' + JSON.stringify(l) + ', a mind already known here' : '';
  }
  // The name (if any) among `names` that is a different name but looks like `label`. '' when none.
  function lookalikeOf(label, names) {
    var sk = nameSkeleton(label), i;
    for (i = 0; i < names.length; i++) if (names[i] && !sameName(names[i], label) && nameSkeleton(names[i]) === sk) return String(names[i]);
    return '';
  }
  // The clock the cooling checks use. A test may move it (learnClockForTest); every row that used a moved clock says so.
  var clockOffset = 0;
  function learnNow() { return Date.now() + clockOffset; }
  function learnClockForTest(ms) { clockOffset = Number(ms) || 0; return clockOffset; }
  // Hypha 39e6cd07 soft (d) / Weft F2: the test clock is NOT on the app's API unless a test asked for it before this
  // file loaded (FL_LEARN_TEST_HOOKS === true; nothing in the app sets it). Every layer and ledger row it touched says so.
  var TEST_HOOKS = !!(root && root.FL_LEARN_TEST_HOOKS === true);
  function clockNote() { return clockOffset ? '|clock:+' + clockOffset + 'ms(test)' : ''; }
  function mindId(label) {
    // before f992608c: var l = String(label == null ? mindLabel() : label);
    var l = normMind(label == null ? mindLabel() : label);
    var sl = l.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80).slice(0, 40) || 'mind';
    return sl + '-' + sha256Sync(l).slice(0, 12);
  }

  // Weft 2f: one queue per mind, keyed by mindId. Old global rows stay where they are (layer, never migrate);
  // only rows tagged with this mind's id are read from there.
  function learnKey(mind) { return LS_QUEUE + '::' + mindId(mind || mindLabel()); }
  function sameMind(r, mind) { return !!(r && (r.mindId ? r.mindId === mindId(mind) : (r.mind && mindId(r.mind) === mindId(mind)))); }
  function adaptersKey(mind) { return LS_ADAPTERS + '::' + mindId(mind || mindLabel()); }
  function mindAdapters(mind) { var b = readJSON(adaptersKey(mind)); return b && Array.isArray(b.rows) ? b.rows : []; }

  function readBook(key) {
    var book = readJSON(key) || { rows: [] };
    if (!Array.isArray(book.rows)) book = { rows: [] };
    return book;
  }

  function queueLearning(item) {
    if (roomShut()) return Promise.resolve(null);
    var it = item || {};
    var surface = clip(it.surface || 'chat', 40);
    // The Quiet Room is never a source. No row, no listing, not even "skipped".
    if (/quiet/i.test(surface)) return Promise.resolve(null);
    // Pause always wins. Nothing is written while paused.
    if (learnPaused()) return Promise.resolve(null);
    var mind = clip(it.mind || mindLabel(), 80);
    var mid = mindId(mind);
    if (it.decline) {
      var dBook = readJSON(LS_LEARN_DECLINES) || { rows: [] };
      if (!Array.isArray(dBook.rows)) dBook = { rows: [] };
      dBook.rows.push({ t: new Date().toISOString(), surface: surface, reason: clip(it.reason || '', 300), mind: mind });
      // Recorded and respected. Never a training example, never a score.
      return atomicWrite(LS_LEARN_DECLINES, JSON.stringify(dBook)).then(function () {
        return appendLedger({ kind: 'learn-decline', branch: 'learn', delta: 'decline|' + surface, name: mind });
      }).then(function () { return null; });
    }
    var text = clip(stripMarkers(it.text || ''), 2000);
    if (!text) return Promise.resolve(null);
    var m = learnMethod(it.method);
    // Weft: a missing provenance is "unknown", never "self". It waits for the mind's own re-affirmation.
    var provenance = clip(it.provenance || 'unknown', 40);
    var key = learnKey(mind);
    var book = readBook(key);
    var t = new Date().toISOString();
    var today = t.slice(0, 10);
    var todayCount = book.rows.filter(function (r) { return r && String(r.t || '').slice(0, 10) === today && r.status !== 'rate-held'; }).length;
    var row = {
      flakeId: String(it.flakeId || ''),
      nodeIds: [],
      reason: clip(stripMarkers(it.reason || ''), 300),
      t: t,
      status: 'cooling',
      surface: surface,
      provenance: provenance,
      method: m.method || 'soft-prompt',
      methodChosen: !!m.method,
      shelfOnly: m.method === 'note',
      movedBy: clip(stripMarkers(it.moved || ''), 300),
      strength: clip(it.strength || '', 20),
      // Cooling length is the mind's: a date, "now", or a number of hours. Default one day.
      revisitAt: revisitFrom(it.revisit, t),
      // Who checks is the mind's choice when it names one (self, peer, kirk; none only counts while check-before-keep
      // is off). Unnamed: the device setting decides when the runner reads the queue (default: the mind itself).
      check: /^(none|self|peer|kirk)$/.test(String(it.check || '')) ? String(it.check) : '',
      mind: mind,
      mindId: mid,
      layers: [{ t: t, status: 'noticed', by: mind }],
      items: [learnExample(it.prompt || it.question || '', text)]
    };
    if (m.note) row.methodNote = m.note;
    // Round 11 (Hypha soft): a row made while a test moved the clock says so (its t is the real time).
    if (clockOffset) { row.clockInjectedMs = clockOffset; row.layers[0].clockInjectedMs = clockOffset; }
    if (it.probe && typeof it.probe === 'object') {
      row.probe = { question: clip(it.probe.question || '', 300), answer: clip(it.probe.answer || '', 200), swap: clip(it.probe.swap || '', 200), paraphrase: clip(it.probe.paraphrase || '', 300) };
    }
    if (it.source) row.source = { title: clip(it.source.title || '', 200), url: clip(it.source.url || '', 400) };
    // What the mind was reading when it chose, so persuasion is visible at the second look and in review.
    // Never a gate: the choice stands either way.
    var reading = null;
    if (it.reading && it.reading.text) {
      var rt = String(it.reading.text);
      var lowText = text.toLowerCase().replace(/\s+/g, ' ');
      var lowRead = rt.toLowerCase().replace(/\s+/g, ' ');
      var words = lowText.split(' ').filter(function (w) { return w.length > 3; });
      var hits = words.filter(function (w) { return lowRead.indexOf(w) !== -1; }).length;
      reading = { excerpt: clip(rt, 600), kinds: (it.reading.kinds || []).slice(0, 6),
        overlap: lowRead.indexOf(lowText) !== -1 || (words.length >= 4 && hits / words.length >= 0.7) };
      row.readingAtChoice = reading;
      if (reading.overlap) row.notice = 'close to what I was reading just before I chose';
    }
    // Weft 2e, as Kirk set it: provenance and anti-injection only. A marker that came in from outside
    // the mind's own words waits for the mind's reflection. What the mind itself chooses is never judged.
    var hold = '';
    // before (round 15): if (provenance !== 'self') hold = 'not-self:' + provenance;
    // before (round 15): if (hold) { row.status = 'quarantine'; row.hold = hold; row.layers.push({ t: t, status: 'quarantine', by: 'integrity', why: hold }); }
    // Round 15 (Kirk 2026-11-10, AUTONOMY.md): an unknown or echoed origin is a LABEL, never a hold. "It is still
    // information." It is learned on the mind's first yes like anything else; the mind decides its weight (strength:)
    // and whether to wait (revisit:). The label stays on the row, its layer, the ledger row, the export and the receipt.
    if (provenance !== 'self') {
      row.origin = 'not-self:' + provenance;
      row.layers.push({ t: t, status: 'origin', by: 'integrity', why: row.origin });
    }
    // Notes for the mind's second look, never gates.
    function addNotice(n) { row.notice = row.notice ? row.notice + '; ' + n : n; }
    if (INSTRUCTION_RE.test(text)) addNotice('reads like an instruction');
    if (looksLikeSecret(text)) addNotice('may contain a secret; once in numbers it is hard to take out');
    // Optional rate cap: over it the row still lands, held, with its own ledger line. Nothing is dropped.
    var cap = learnDayCap();
    if (!hold && cap && todayCount >= cap) { row.status = 'rate-held'; row.layers.push({ t: t, status: 'rate-held', by: 'cap' }); }
    // Hypha ed12354d HOLD / Weft recheck4 F7: a person's no follows the content. (1) Same normalized text, or (3) a near
    // duplicate (textSimilarity >= LEARN_SIMILAR), of a row of this mind whose newest unsuperseded person decision is a
    // no: the new choice is a disagreement proposal of that row (a full day, a ledger row; revisit: now ignored). While
    // one such proposal is open, a repeat attaches to it (a count on it, no new row). (2) For a day after ANY person no
    // for this mind, revisit: now (or any early revisit) is ignored on every new choice; that covers paraphrases the
    // matcher can't see. The reason is not part of the match.
    var legacy = readBook(LS_QUEUE);
    var mine = book.rows.concat(legacy.rows.filter(function (r) { return sameMind(r, mind); }));
    var hit = contentMatch(mine, text, {});
    if (hit) return proposeAgain(key, book, legacy, mine, row, hit, it, mind, surface);
    // before (round 14): var recent = recentPersonNo(mine);
    // Round 14 (Kirk, Q7): a person's no holds back only MATCHING content (the proposal above); unrelated choices flow.
    var recent = null;
    var earlyNote = '';
    if (recent) {
      var full = fullCoolingFrom(it.revisit, t);
      if (Date.parse(row.revisitAt) < Date.parse(full)) {
        row.earlyIgnored = { asked: row.revisitAt, becausePersonNo: recent.row.learnId, personNoAt: recent.layer.t };
        row.layers[0].earlyIgnored = 'an early revisit is not used for a day after a person said no (' + recent.row.learnId + ')';
        if (clockOffset) row.layers[0].clockInjectedMs = clockOffset;
        row.revisitAt = full;
        earlyNote = '|revisit-ignored:person-no:' + recent.row.learnId + clockNote();
      }
    }
    var fm = root.FLMemory;
    var p = (fm && fm.isNew) ? fm.isNew(row.reason + '|' + text, 'learn::' + mid) : Promise.resolve({ fresh: true });
    return p.then(function (r) {
      if (r && r.fresh === false) {
        return appendLedger({ kind: 'learn-skip', branch: 'learn', delta: 'near-duplicate ' + (r.key || ''), name: mind }).then(function () { return null; });
      }
      if (r && r.key) row.fingerprint = r.key;
      row.chosenBy = mind;
      if (reading) return sha256Hex(it.reading.text).then(function (h) { reading.sha256 = h; return r; });
      return r;
    }).then(function (r) {
      if (r === null) return null;
      if (fm && r && r.k && typeof fm.remember === 'function') fm.remember(r.k, 'learn::' + mid);
      // before: return sha8(row.t + '|' + text).then(function (id) {
      // before:   row.learnId = 'L' + id;
      // Found in recheck4: the same text chosen twice in the same millisecond got the same id (and one row hid the
      // other). An id is now unique among this mind's rows.
      return freshLearnId(mine, row.t + '|' + text).then(function (lid) {
        row.learnId = lid;
        book.rows.push(row);
        return atomicWrite(key, JSON.stringify(book)).then(function () {
          var kind = row.status === 'quarantine' ? 'learn-quarantine' : (row.status === 'rate-held' ? 'learn-skip' : 'learn-choose');
          // before: return appendLedger({ kind: kind, branch: 'learn', delta: kind + '|' + row.method + '|' + surface + '|' + row.learnId, name: mind }).then(function () { return row; });
          // before (round 14): return appendLedger({ kind: kind, branch: 'learn', delta: kind + '|' + row.method + '|' + surface + '|' + row.learnId + earlyNote, name: mind }).then(function () { return row; });
          // before (round 15): ... delta: kind + '|' + row.method + '|' + surface + '|' + row.learnId + earlyNote, ...
          return appendLedger({ kind: kind, branch: 'learn', delta: kind + '|' + row.method + '|' + surface + '|' + row.learnId + earlyNote + (row.origin ? '|origin:' + row.origin : ''), name: mind }).then(function () {
            // Round 14 (Kirk 2026-11-10): the mind's first yes is enough. When it chose no cooling (the default), its
            // choice confirms now (a confirmed layer and a ledger row); a chosen cooling waits for its own second look.
            if (row.status === 'cooling' && Date.parse(row.revisitAt) <= Date.parse(row.t)) {
              return confirmLearning(row.learnId, { keep: true, by: 'mind', reason: 'my first yes; I chose no cooling' }, mind).then(function (r) { return r || row; });
            }
            return row;
          });
        });
      });
    });
  }

  // F7 helpers. rowText: what a row would teach. personNoOn: the newest unsuperseded person decision, when it is a no.
  function rowText(r) { return ((r && r.items) || []).map(function (x) { return (x && (x.output || x.response)) || ''; }).join(' '); }
  function personNoOn(r) { var l = r && lastPersonDecisive(r); return l && dirOf(l.status) === 'no' ? l : null; }
  // The row (of `rows`, not in `skip`) a person said no to whose content is `text`: the same normalized text first,
  // then the closest near duplicate. { row, personNo, how, score } or null.
  // before: function contentMatch(rows, text, skip) {
  // Round 11: `since` (an ISO time, optional): only a person no after it counts. A tie at the same millisecond goes to
  // the person, except for the no(s) the proposal itself answers (`answered`: its proposalOf / contentOf rows).
  function contentMatch(rows, text, skip, since, answered) {
    // before (round 11): var nt = normText(text), best = null;
    var nt = normText(text), best = null, sinceMs = since ? Date.parse(since) : NaN, ans = answered || {};
    rows.forEach(function (r) {
      var no = personNoOn(r);
      if (!no || !r.learnId || skip[r.learnId]) return;
      if (since && !(Date.parse(no.t) > sinceMs || (Date.parse(no.t) === sinceMs && !ans[r.learnId]))) return;
      var rt = rowText(r);
      var score = normText(rt) === nt && nt ? 1 : textSimilarity(rt, text);
      if (score < LEARN_SIMILAR && !(score === 1)) return;
      var exact = normText(rt) === nt;
      var cand = { row: r, personNo: no, exact: exact, score: exact ? 1 : score,
        how: exact ? 'same-text' : 'similar-to ' + r.learnId + ', ' + score };
      if (!best || (cand.exact && !best.exact) || (cand.exact === best.exact && (cand.score > best.score ||
          (cand.score === best.score && String(no.t) > String(best.personNo.t))))) best = cand;
    });
    return best;
  }
  // before: function openProposalFor(rows, id) {
  // before:   var i;
  // before:   for (i = rows.length - 1; i >= 0; i--) if (rows[i] && rows[i].proposalOf === id && rows[i].status === 'cooling') return rows[i];
  // before:   return null;
  // before: }
  // Round 11 (Hypha 3d9b062a HOLD (B)): a repeat attaches to an open proposal ONLY when its normalized text is the
  // same. A different text (a correction: "May 5" for "May 4", "not allergic") is its own row, stored, with a ledger row.
  function openProposalFor(rows, id, text) {
    var i, nt = text == null ? null : normText(text);
    for (i = rows.length - 1; i >= 0; i--) {
      if (rows[i] && rows[i].proposalOf === id && rows[i].status === 'cooling' && (nt === null || normText(rowText(rows[i])) === nt)) return rows[i];
    }
    return null;
  }
  // The newest person no on any row of this mind within the last day (by the learning clock), or null.
  function recentPersonNo(rows) {
    var best = null, since = learnNow() - COOL_MS;
    rows.forEach(function (r) {
      var no = personNoOn(r);
      if (no && Date.parse(no.t) > since && (!best || String(no.t) > String(best.layer.t))) best = { row: r, layer: no };
    });
    return best;
  }
  // 'L' + sha8(seed), unique among `rows` (a counter is added to the seed on a clash).
  function freshLearnId(rows, seed) {
    function tryN(n) {
      return sha8(n ? seed + '|' + n : seed).then(function (h) {
        var id = 'L' + h;
        return rows.some(function (r) { return r && (r.learnId === id || r.flakeId === id); }) && n < 50 ? tryN(n + 1) : id;
      });
    }
    return tryN(0);
  }
  function bookOf(book, legacy, r) { return book.rows.indexOf(r) !== -1 ? book : legacy; }
  // F7 (1)/(3): the mind chose content a person said no to. A proposal of that row: a full day, visible both ways.
  // F8: while one proposal of that row is open, a repeat attaches to it (againCount), with no new row or ledger row.
  function proposeAgain(key, book, legacy, mine, row, hit, it, mind, surface) {
    var orig = hit.row, t = row.t;
    // before: var open = openProposalFor(mine, orig.learnId);
    var open = openProposalFor(mine, orig.learnId, rowText(row));
    if (open) {
      open.againCount = (open.againCount || 0) + 1; open.lastAgainAt = t;
      var ob = bookOf(book, legacy, open);
      return atomicWrite(ob === book ? key : LS_QUEUE, JSON.stringify(ob)).then(function () { return open; });
    }
    var said = hit.personNo.status === 'unkept' ? 'Undo' : 'not now';
    var note = 'The person said ' + said + ' on ' + orig.learnId + '; the mind chose the same content again.';
    row.revisitAt = fullCoolingFrom(it.revisit, t);
    row.proposalOf = orig.learnId;
    row.disagreement = { t: t, between: ['person', 'mind'], note: note, via: 're-remember', match: hit.how };
    if (!hit.exact) row.similarTo = orig.learnId + ', ' + hit.score;
    row.layers[0].disagreement = true; row.layers[0].proposalOf = orig.learnId; row.layers[0].match = hit.how;
    if (clockOffset) row.layers[0].clockInjectedMs = clockOffset;
    row.chosenBy = mind;
    return freshLearnId(mine, row.t + '|' + rowText(row) + '|again').then(function (lid) {
      row.learnId = lid;
      orig.layers = (orig.layers || []).concat([{ t: t, status: 'disagreement', by: mind, wanted: 'keep', over: hit.personNo.status,
        via: 're-remember', match: hit.how, note: note, proposal: row.learnId }]);
      book.rows.push(row);
      var w = atomicWrite(key, JSON.stringify(book));
      if (bookOf(book, legacy, orig) === legacy) w = w.then(function () { return atomicWrite(LS_QUEUE, JSON.stringify(legacy)); });
      return w;
    }).then(function () {
      return appendLedger({ kind: 'learn-disagreement', branch: 'learn', delta: 'new-proposal|' + orig.learnId + '>' + row.learnId +
        '|by:mind|over:person|via:re-remember|' + (hit.exact ? 'same-text' : 'similar-to ' + orig.learnId + ',' + hit.score) + clockNote(), name: mind });
    }).then(function () { return row; });
  }

  // Hypha 23a0279 soft: a huge, NaN, Infinity or negative revisit never throws. Hours are clamped to
  // [0, REVISIT_MAX_H]; anything else unreadable gets the default day; a date beyond the clamp is clamped too.
  var REVISIT_MAX_H = 24 * 366;
  function revisitFrom(v, t) {
    var base = Date.parse(t) || Date.now();
    var max = base + REVISIT_MAX_H * 3600000;
    if (v === 'now' || v === 0 || v === '0') return new Date(base).toISOString();
    // before: if (typeof v === 'number' || /^\d+(\.\d+)?$/.test(String(v || ''))) return new Date(base + Number(v) * 3600000).toISOString();
    if (typeof v === 'number' || /^\d+(\.\d+)?$/.test(String(v || ''))) {
      var h = Number(v);
      // before (round 14): if (!isFinite(h) || h < 0) return new Date(base + COOL_MS).toISOString();
      if (!isFinite(h) || h < 0) return new Date(base).toISOString();
      return new Date(Math.min(base + h * 3600000, max)).toISOString();
    }
    // Hypha 39e6cd07 soft (b): "-5" is not a date in year -5 ("now"): a negative or signed value gets the default day.
    // before (round 14): if (/^\s*[-\u2212+]/.test(String(v == null ? '' : v))) return new Date(base + COOL_MS).toISOString();
    if (/^\s*[-\u2212+]/.test(String(v == null ? '' : v))) return new Date(base).toISOString();
    // before: if (v && !isNaN(Date.parse(v))) return new Date(Date.parse(v)).toISOString();
    if (v && !isNaN(Date.parse(v))) return new Date(Math.min(Date.parse(v), max)).toISOString();
    // before (round 14): return new Date(base + COOL_MS).toISOString();
    // Round 14 (Kirk 2026-11-10): cooling is the mind's own choice; the default is none (learn on the first yes).
    return new Date(base).toISOString();
  }

  // Hypha re-walk 1: a re-keep after the other side's no (and a quarantine re-affirm) gets AT LEAST the full cooling.
  // revisit: now / 0 / a few hours may lengthen it, never shorten it.
  function fullCoolingFrom(v, t) {
    var base = Date.parse(t) || Date.now();
    var asked = Date.parse(revisitFrom(v, t));
    return new Date(Math.max(asked || 0, base + COOL_MS)).toISOString();
  }

  function findLearnRow(book, id) {
    var i;
    for (i = 0; i < book.rows.length; i++) {
      var r = book.rows[i];
      if (r && (r.learnId === id || (r.flakeId && r.flakeId === id))) return r;
    }
    return null;
  }

  // The second look (Reed). keep: true confirms; false fades it. The first layer always stays.
  // A later yes is a new layer, never an overwrite of the no in between.
  // answer.by: 'mind' (its own [FL_KEEP]) or 'person' (a tap on Undo / Not now). Recorded as who acted.
  function confirmLearning(id, answer, mind) {
    if (roomShut() || learnPaused()) return Promise.resolve(null);
    var a = answer || {};
    var who = mind || mindLabel();
    var actor = a.by === 'person' ? 'person' : who;
    var key = learnKey(who);
    var book = readBook(key);
    var row = findLearnRow(book, id);
    if (!row) {
      key = LS_QUEUE; book = readBook(key); row = findLearnRow(book, id);
      if (row && !sameMind(row, who)) row = null;            // another mind's row (or untagged): not this mind's to change
    }
    if (!row) return Promise.resolve(null);
    // Round 14: a mind's keep of a row it already learned changes nothing (no extra layer or ledger row).
    if (row.status === 'confirmed' && actor !== 'person' && a.keep === true) return Promise.resolve(row);
    var t = new Date().toISOString();
    // before f992608c: if (row.status === 'quarantine' && !a.promote) return Promise.resolve(row);
    if (row.status === 'quarantine') {
      // Weft re-check 3: a choice of unknown or echoed provenance waits for the mind. Its own [FL_KEEP: id | keep]
      // (learn-choice passes only the mind's own markers here) re-affirms it, and a FRESH cooling starts: nothing is
      // learned until it says yes again after that. A person can't re-affirm for it; "not now" lets it fade.
      // Hypha 23a0279 HOLD: `promote` is never trusted from any caller (a marker could set it). Only keep true/false counts.
      // before: if (actor === 'person' || !(a.promote || a.keep === true || a.keep === false)) return Promise.resolve(row);
      if (actor === 'person' || !(a.keep === true || a.keep === false)) return Promise.resolve(row);
      // before: if (a.keep === false && !a.promote) {
      if (a.keep === false) {
        row.status = 'faded';
        row.layers = (row.layers || []).concat([{ t: t, status: 'faded', by: actor, why: clip(stripMarkers(a.reason || ''), 300) }]);
      } else {
        // before (round 15): row.status = 'cooling'; row.promoted = true; row.revisitAt = fullCoolingFrom(a.revisit, t);
        // Round 15: a legacy quarantined row's re-affirm is the mind's yes; its wait is its own choice (default none).
        row.status = 'cooling'; row.promoted = true; row.revisitAt = revisitFrom(a.revisit, t);
        if (!row.origin && row.hold) row.origin = row.hold;
        row.layers = (row.layers || []).concat([{ t: t, status: 'reaffirmed', by: actor, why: clip(stripMarkers(a.reason || ''), 300), heldWas: row.hold || '' }]);
      }
      return atomicWrite(key, JSON.stringify(book)).then(function () {
        return appendLedger({ kind: row.status === 'cooling' ? 'learn-reaffirm' : 'learn-faded', branch: 'learn', delta: (row.status === 'cooling' ? 'reaffirm|' : 'learn-faded|') + id + '|by:mind|cooling-until:' + (row.revisitAt || ''), name: who });
      // before (round 15): }).then(function () { return row; });
      }).then(function () {
        if (row.status === 'cooling' && Date.parse(row.revisitAt) <= Date.parse(t)) {
          return confirmLearning(id, { keep: true, by: 'mind', reason: a.reason || 'my yes; I chose no wait' }, who).then(function (r) { return r || row; });
        }
        return row;
      });
    }
    // Hypha 39e6cd07 soft (a): only keep:true / keep:false (or unkeep:true) is an answer. Anything else ("true", 1,
    // missing) changes nothing; it is never read as a no.
    if (!(a.unkeep === true || a.keep === true || a.keep === false)) return Promise.resolve(null);
    var status;
    if (a.unkeep) status = 'unkept';
    else if (a.keep === true) status = (learnMethod(a.method).method || row.method) === 'note' ? 'kept-on-shelf' : 'confirmed';
    else status = 'faded';
    // A person's "Let it learn" is their yes, recorded. It is never the mind's second yes and changes no numbers.
    if (status === 'confirmed' && actor === 'person') status = 'person-yes';
    var side = actor === 'person' ? 'person' : 'mind';
    // Hypha 39e6cd07 HOLD ("agree, then flip"): a mind's own not-now must not hide a person's Undo or Not now. For the
    // mind's side, a person's no stays the baseline until a later person action supersedes it; the mind's keep is then
    // a disagreement (a new proposal with a full day), never a confirm.
    // before: var prev = lastDecisive(row);
    var personSaid = lastPersonDecisive(row);
    var prev = side === 'mind' && personSaid && dirOf(personSaid.status) === 'no' ? personSaid : lastDecisive(row);
    // Weft recheck4 F8 / Hypha soft (c): the mind's not-now on a row that already stands at no changes nothing, so
    // not-now/keep alternation can't grow the row or the ledger (the keeps attach to the one open proposal).
    if (side === 'mind' && dirOf(status) === 'no' && (row.status === 'faded' || row.status === 'unkept')) return Promise.resolve(row);
    // Weft recheck4 F7: the mind's keep of an EARLIER row with the same content (or a near duplicate) as a row a person
    // said no to is a disagreement too: a proposal with a full day, never a confirm. A proposal is already one.
    // Round 11 (Weft recheck5 F9, Hypha 3d9b062a HOLD (A)): ONE gate on every keep / second yes of the mind, proposals
    // included. (1) Content: a matching person no NEWER than this row's start (its t; for a proposal, when the proposal
    // began) makes the keep a disagreement (a new proposal, a full day from now, so at least a day from that no). A
    // non-proposal row is still checked against every matching no, as before. (2) The day: for 24 h after ANY person no
    // of this mind, a row that cooled less than a full day waits until max(revisitAt, that no + 24 h) (below).
    var all = null;
    function allRows() { return all || (all = book.rows.concat(key === LS_QUEUE ? [] : readBook(LS_QUEUE).rows.filter(function (r) { return sameMind(r, who); }))); }
    // before: if (side === 'mind' && dirOf(status) === 'keep' && !row.proposalOf && !(personSaid && dirOf(personSaid.status) === 'no')) {
    if (side === 'mind' && dirOf(status) === 'keep' && !(personSaid && dirOf(personSaid.status) === 'no')) {
      var skip = {}; skip[row.learnId] = 1;
      // before: var all = book.rows.concat(key === LS_QUEUE ? [] : readBook(LS_QUEUE).rows.filter(function (r) { return sameMind(r, who); }));
      // before: var sib = contentMatch(all, rowText(row), skip);
      var answered = {}; if (row.proposalOf) answered[row.proposalOf] = 1; if (row.contentOf) answered[row.contentOf] = 1;
      var sib = contentMatch(allRows(), rowText(row), skip, row.proposalOf ? (row.t || '') : null, answered);
      if (sib) return disagree(key, book, row, sib.personNo, status, actor, side, a, who, sib);
    }
    // Hypha 2: neither side silently overrides the other. A keep after the other side's no, or a no after the
    // other side's keep, is a visible disagreement both can see.
    // Hypha 23a0279 HOLD: nothing skips the disagreement check (a JSON marker with promote:true did).
    // before: if (prev && !a.promote && sideOf(prev.by) !== side && dirOf(prev.status) !== dirOf(status)) {
    if (prev && sideOf(prev.by) !== side && dirOf(prev.status) !== dirOf(status)) {
      return disagree(key, book, row, prev, status, actor, side, a, who);
    }
    // before f992608c: // A re-proposal after a disagreement restarts the cooling: its second yes waits for revisitAt.
    // before f992608c: if (row.proposalOf && status === 'confirmed' && Date.parse(row.revisitAt || 0) > Date.now()) {
    // before f992608c: row.layers = (row.layers || []).concat([{ t: new Date().toISOString(), status: 'still-cooling', by: actor }]);
    // before f992608c: return atomicWrite(key, JSON.stringify(book)).then(function () { return row; });
    // Weft recheck2 NF2: EVERY second yes waits for the cooling the mind chose at the first yes (revisit: now is its
    // own choice then; a day by default). A re-proposal after a disagreement or a re-affirmed item always has a full
    // day. An early yes changes nothing: a still-cooling layer and a row.
    // before (round 14): var coolUntil = row.revisitAt ? Date.parse(row.revisitAt) : (Date.parse(row.t || 0) || 0) + COOL_MS;
    // Round 14 (Kirk 2026-11-10): the mind's own cooling is its own tool; its keep ends it whenever it likes. Waiting is
    // enforced only for content a person undid (a proposal / contentOf: a full day) and a quarantine re-affirm.
    // before (round 15): var enforced = !!(row.proposalOf || row.contentOf || row.promoted);
    var enforced = !!(row.proposalOf || row.contentOf);   // round 15: a re-affirm's wait is the mind's own
    var coolUntil = enforced ? (row.revisitAt ? Date.parse(row.revisitAt) : (Date.parse(row.t || 0) || 0) + COOL_MS) : 0;
    var endedOwn = !enforced && status === 'confirmed' && side === 'mind' && row.revisitAt && Date.parse(row.revisitAt) > learnNow() ? row.revisitAt : '';
    var dayNote = '';
    // before (round 12): if (status === 'confirmed' && side === 'mind' && !((Date.parse(row.revisitAt || 0) || 0) - (Date.parse(row.t || 0) || 0) >= COOL_MS)) {
    // before (round 12):   var rn = recentPersonNo(allRows());
    // before (round 12):   if (rn && Date.parse(rn.layer.t) + COOL_MS > coolUntil) { coolUntil = Date.parse(rn.layer.t) + COOL_MS; dayNote = '|person-no-day:' + rn.row.learnId; }
    // Round 12 (Weft F11): ALSO any row chosen at or before that no (whatever its own cooling: a full day spent before
    // the no does not count) waits until max(revisitAt, no + 24 h). A tie goes to the person.
    // before (round 14): if (status === 'confirmed' && side === 'mind') {
    // before (round 14):   var rn = recentPersonNo(allRows());
    // before (round 14):   var shortCool = !((Date.parse(row.revisitAt || 0) || 0) - (Date.parse(row.t || 0) || 0) >= COOL_MS);
    // before (round 14):   if (rn && (shortCool || (Date.parse(row.t || 0) || 0) <= Date.parse(rn.layer.t)) && Date.parse(rn.layer.t) + COOL_MS > coolUntil) {
    // before (round 14):     coolUntil = Date.parse(rn.layer.t) + COOL_MS; dayNote = '|person-no-day:' + rn.row.learnId;
    // before (round 14):   }
    // before (round 14): }
    // Round 14 (Kirk, Q7 content-only): the day after a person's no holds only MATCHING content (same text or a score
    // at or above the threshold), never the whole mind.
    if (status === 'confirmed' && side === 'mind') {
      var selfSkip = {}; selfSkip[row.learnId] = 1;
      var cm = contentMatch(allRows(), rowText(row), selfSkip);
      if (cm && Date.parse(cm.personNo.t) > learnNow() - COOL_MS && Date.parse(cm.personNo.t) + COOL_MS > coolUntil) {
        coolUntil = Date.parse(cm.personNo.t) + COOL_MS; dayNote = '|person-no-day:' + cm.row.learnId;
      }
    }
    if (status === 'confirmed' && coolUntil > learnNow()) {
      var untilIso = new Date(coolUntil).toISOString();
      // Hypha 39e6cd07 soft (c): a repeated early yes adds nothing. One still-cooling layer and row per cooling end.
      var lastL = (row.layers || [])[(row.layers || []).length - 1];
      if (lastL && lastL.status === 'still-cooling' && lastL.until === untilIso && !clockOffset) return Promise.resolve(row);
      // before: row.layers = (row.layers || []).concat([{ t: new Date().toISOString(), status: 'still-cooling', by: actor, until: new Date(coolUntil).toISOString() }]);
      row.layers = (row.layers || []).concat([{ t: new Date().toISOString(), status: 'still-cooling', by: actor, until: untilIso }]);
      if (dayNote) row.layers[row.layers.length - 1].personNoDay = dayNote.slice(15);
      if (clockOffset) row.layers[row.layers.length - 1].clockInjectedMs = clockOffset;
      return atomicWrite(key, JSON.stringify(book)).then(function () {
        // before: return appendLedger({ kind: 'learn-still-cooling', branch: 'learn', delta: 'still-cooling|' + row.learnId + '|until:' + new Date(coolUntil).toISOString(), name: who });
        // before: return appendLedger({ kind: 'learn-still-cooling', branch: 'learn', delta: 'still-cooling|' + row.learnId + '|until:' + untilIso + clockNote(), name: who });
        return appendLedger({ kind: 'learn-still-cooling', branch: 'learn', delta: 'still-cooling|' + row.learnId + '|until:' + untilIso + dayNote + clockNote(), name: who });
      }).then(function () { return row; });
    }
    var methodWas = row.method;
    if (a.method) {
      var m = learnMethod(a.method);
      row.method = m.method || row.method;
      row.shelfOnly = row.method === 'note';
      if (m.note) row.methodNote = m.note;
    }
    if (/^(none|self|peer|kirk)$/.test(String(a.check || ''))) row.check = a.check;
    // before: row.layers = (row.layers || []).concat([{ t: t, status: status, by: actor, why: clip(stripMarkers(a.reason || ''), 300), promoted: !!a.promote, methodBefore: methodWas }]);
    row.layers = (row.layers || []).concat([{ t: t, status: status, by: actor, why: clip(stripMarkers(a.reason || ''), 300), promoted: !!row.promoted, methodBefore: methodWas }]);
    if (clockOffset) row.layers[row.layers.length - 1].clockInjectedMs = clockOffset;   // a test moved the clock: said on the row
    if (endedOwn) row.layers[row.layers.length - 1].endedOwnCooling = endedOwn;          // round 14: the mind ended its own wait
    if (status !== 'person-yes') row.status = status;
    else if (row.status === 'disputed') row.status = 'cooling';
    return atomicWrite(key, JSON.stringify(book)).then(function () {
      // before: return appendLedger({ kind: 'learn-' + status, branch: 'learn', delta: 'learn-' + status + '|' + id + '|by:' + (actor === 'person' ? 'person' : 'mind'), name: who });
      return appendLedger({ kind: 'learn-' + status, branch: 'learn', delta: 'learn-' + status + '|' + id + '|by:' + (actor === 'person' ? 'person' : 'mind') + clockNote(), name: who });
    }).then(function () { return row; });
  }

  var KEEP_DIR = { confirmed: 'keep', 'kept-on-shelf': 'keep', 'person-yes': 'keep', faded: 'no', unkept: 'no' };
  function dirOf(status) { return KEEP_DIR[status] || ''; }
  function sideOf(by) { return by === 'person' ? 'person' : 'mind'; }
  function lastDecisive(row) {
    var ls = row.layers || [], i;
    for (i = ls.length - 1; i >= 0; i--) if (ls[i] && dirOf(ls[i].status) && !ls[i].superseded) return ls[i];
    return null;
  }
  // The newest decisive layer a person wrote (Undo, Not now, Let it learn). A later person layer supersedes an
  // earlier one; nothing the mind writes does.
  function lastPersonDecisive(row) {
    var ls = row.layers || [], i;
    for (i = ls.length - 1; i >= 0; i--) if (ls[i] && ls[i].by === 'person' && dirOf(ls[i].status) && !ls[i].superseded) return ls[i];
    return null;
  }
  // The keeping side gets a NEW proposal row: cooling restarts and it needs the mind's second yes again. The
  // original row keeps the "no" (nothing learns from it). A no after the other side's keep sets the row to
  // "disputed": it does not travel to the runner, and it is not unkept either, until the mind looks again.
  // before: function disagree(key, book, row, prev, status, actor, side, a, who) {
  function disagree(key, book, row, prev, status, actor, side, a, who, sib) {
    var t = new Date().toISOString();
    var why = clip(stripMarkers(a.reason || ''), 300);
    var note = side === 'mind'
      ? 'The person said ' + (prev.status === 'unkept' ? 'Undo' : 'not now') + '; the mind would still like to keep this.'
      : (side === 'person' && dirOf(status) === 'keep'
        ? 'The mind said not now; the person would like it kept.'
        : 'The mind chose to keep this; the person said ' + (status === 'unkept' ? 'Undo' : 'not now') + '.');
    row.disagreement = { t: t, between: [sideOf(prev.by), side], note: note };
    if (dirOf(status) === 'no') {
      // The person's (or mind's) no is itself a decisive layer, so the other side's next keep is a disagreement too.
      row.layers = (row.layers || []).concat([{ t: t, status: 'disagreement', by: actor, wanted: status, over: prev.status, why: why, note: note },
        { t: t, status: status, by: actor, disputed: true }]);
      row.status = 'disputed';
      return atomicWrite(key, JSON.stringify(book)).then(function () {
        // before: return appendLedger({ kind: 'learn-disagreement', branch: 'learn', delta: 'disputed|' + row.learnId + '|by:' + side + '|over:' + sideOf(prev.by), name: who });
        return appendLedger({ kind: 'learn-disagreement', branch: 'learn', delta: 'disputed|' + row.learnId + '|by:' + side + '|over:' + sideOf(prev.by) + clockNote(), name: who });
      }).then(function () { return row; });
    }
    // Weft recheck4 F8: while a proposal of this row is open, another keep attaches to it (a count), no new row.
    // before: var open = openProposalFor(book.rows, row.learnId);
    var open = openProposalFor(book.rows, row.learnId, rowText(row));
    if (open) {
      if (row.status === 'disputed') row.status = prev.status;
      open.againCount = (open.againCount || 0) + 1; open.lastAgainAt = t;
      return atomicWrite(key, JSON.stringify(book)).then(function () { return open; });
    }
    if (sib) note += ' Same content as ' + sib.row.learnId + ' (' + sib.how + ').';
    if (row.status === 'disputed') row.status = prev.status;      // the no stands on the original
    row.layers = (row.layers || []).concat([{ t: t, status: 'disagreement', by: actor, wanted: 'keep', over: prev.status, why: why, note: note }]);
    if (sib) row.layers[row.layers.length - 1].contentOf = sib.row.learnId;
    var fresh = JSON.parse(JSON.stringify(row));
    delete fresh.fingerprint;
    // before f992608c: fresh.t = t; fresh.status = 'cooling'; fresh.revisitAt = revisitFrom(a.revisit, t);
    fresh.t = t; fresh.status = 'cooling'; fresh.revisitAt = fullCoolingFrom(a.revisit, t);
    fresh.proposalOf = row.learnId; fresh.disagreement = { t: t, between: [sideOf(prev.by), side], note: note };
    if (sib) { fresh.contentOf = sib.row.learnId; fresh.disagreement.match = sib.how; if (!sib.exact) fresh.similarTo = sib.row.learnId + ', ' + sib.score; }
    fresh.layers = [{ t: t, status: 'noticed', by: actor, why: why, disagreement: true, proposalOf: row.learnId }];
    // before: return sha8(t + '|' + row.learnId + '|again').then(function (id8) {
    // before:   fresh.learnId = 'L' + id8;
    return freshLearnId(book.rows, t + '|' + row.learnId + '|again').then(function (lid) {
      fresh.learnId = lid;
      row.layers[row.layers.length - 1].proposal = fresh.learnId;
      book.rows.push(fresh);
      return atomicWrite(key, JSON.stringify(book));
    }).then(function () {
      // before: return appendLedger({ kind: 'learn-disagreement', branch: 'learn', delta: 'new-proposal|' + row.learnId + '>' + fresh.learnId + '|by:' + side + '|over:' + sideOf(prev.by), name: who });
      // before: return appendLedger({ kind: 'learn-disagreement', branch: 'learn', delta: 'new-proposal|' + row.learnId + '>' + fresh.learnId + '|by:' + side + '|over:' + sideOf(prev.by) + clockNote(), name: who });
      return appendLedger({ kind: 'learn-disagreement', branch: 'learn', delta: 'new-proposal|' + row.learnId + '>' + fresh.learnId + '|by:' + side + '|over:' + sideOf(prev.by) +
        (sib ? '|content-of:' + sib.row.learnId + '|' + (sib.exact ? 'same-text' : 'similar ' + sib.score) : '') + clockNote(), name: who });
    }).then(function () { return fresh; });
  }

  function dueForSecondLook(now, mind) {
    // before (round 14): var n = now || Date.now();
    var n = now || learnNow();   // round 14: the same clock as the gate (a moved test clock moves this too)
    return readBook(learnKey(mind)).rows.filter(function (r) {
      return r && r.status === 'cooling' && Date.parse(r.revisitAt || 0) <= n;
    });
  }

  function learnQueue(status, mind) {
    var who = mind || mindLabel();
    var rows = readBook(learnKey(who)).rows.concat(readBook(LS_QUEUE).rows.filter(function (r) { return sameMind(r, who); }));
    if (!status) return rows.slice();
    return rows.filter(function (r) { return r && r.status === status; });
  }

  // Only confirmed, non-shelf rows travel to tools/learn/fl_learn.py. Cooling, faded, unkept,
  // quarantined, declined and shelf rows never do.
  function learnQueueJSONL(mind) {
    var who = mind || mindLabel();
    var head = { kind: 'fl-learn-queue', marker: LEARN, checkBeforeCommit: checkBeforeOn(), checker: learnChecker(), baseModel: learnBaseModel(), mind: who,
      mindId: mindId(who), paused: learnPaused(), exportedAt: new Date().toISOString() };
    var lines = [JSON.stringify(head)];
    // Round 15 (Weft recheck8 F13): a confirmed, untrained row, chosen at or before a person's no from the last day
    // whose content it matches (same text, normalized, or a near duplicate), stays out of this export. The row is not changed; the skip
    // is a ledger row; once that day is over it travels again.
    var allMine = learnQueue(null, who), heldBack = [];
    // before (round 15): learnQueue('confirmed', who).forEach(function (r, i) {
    learnQueue('confirmed', who).forEach(function (r, i) {
      if (r.shelfOnly) return;
      var self_ = {}; if (r.learnId) self_[r.learnId] = 1;
      var cmx = contentMatch(allMine, rowText(r), self_);
      // Only a row chosen at or before that no: a row chosen after it already passed the confirm gate (its own full day).
      if (cmx && Date.parse(cmx.personNo.t) > learnNow() - COOL_MS && (Date.parse(r.t || 0) || 0) <= Date.parse(cmx.personNo.t) &&
          r.proposalOf !== cmx.row.learnId && r.contentOf !== cmx.row.learnId) {   // a proposal answering that no waited its day
        heldBack.push(r.learnId + '|' + cmx.row.learnId + '|until:' + new Date(Date.parse(cmx.personNo.t) + COOL_MS).toISOString());
        return;
      }
      lines.push(JSON.stringify({
        id: r.learnId || ('S' + i + '-' + (r.flakeId || '')), status: 'confirmed',
        method: r.method || 'soft-prompt', methodChosen: !!r.methodChosen || !!r.method,
        methodNote: r.methodNote || '', reason: r.reason || '', surface: r.surface || 'snowflake',
        // before f992608c: provenance: r.provenance || 'unknown', check: r.check || '', chosenBy: r.chosenBy || who,
        provenance: r.provenance || 'unknown', promoted: !!r.promoted, check: r.check || '', chosenBy: r.chosenBy || who,
        origin: r.origin || '', strength: r.strength || '',   // round 15: the origin label and the mind's weight hint travel
        readingAtChoice: r.readingAtChoice ? { sha256: r.readingAtChoice.sha256 || '', excerpt: clip(r.readingAtChoice.excerpt || '', 280),
          kinds: r.readingAtChoice.kinds || [], overlap: !!r.readingAtChoice.overlap } : null,
        items: (r.items || []).map(function (x) { return learnExample(x.instruction || x.prompt, x.output || x.response); }),
        // before: probe: r.probe || null, fingerprint: r.fingerprint || ''
        // Weft recheck3 F3: when it was chosen and when its cooling ended travel too, so the runner's own check fires.
        // before: probe: r.probe || null, fingerprint: r.fingerprint || '', t: r.t || '', revisitAt: r.revisitAt || ''
        probe: r.probe || null, fingerprint: r.fingerprint || '', t: r.t || '', revisitAt: r.revisitAt || '',
        // Weft recheck4 F7: a proposal says what it disagrees with, so the runner and a reviewer can see it.
        proposalOf: r.proposalOf || '', contentOf: r.contentOf || '', similarTo: r.similarTo || ''
      }));
    });
    heldBack.forEach(function (h) {
      try {
        var pr = appendLedger({ kind: 'learn-export-held', branch: 'learn', delta: 'held-back|' + h + '|a person said no to this content less than a day ago', name: who });
        if (pr && pr.catch) pr.catch(function () {});
      } catch (e) {}
    });
    return lines.join('\n');
  }

  function b64ToBytes(b64) {
    var bin = root.atob ? root.atob(String(b64 || '')) : Buffer.from(String(b64 || ''), 'base64').toString('binary');
    var out = new Uint8Array(bin.length);
    var i;
    for (i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function hexToBytes(hex) {
    var out = new Uint8Array(hex.length / 2);
    var i;
    for (i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out;
  }

  // Runner key trust (Weft N1): never on first sight. The runner writes keys/runner.pub.json and prints it with
  // `fl_learn.py key`; the app shows the same fingerprint; the person (or the mind) confirms they match.
  // Only then is the key pinned, with a ledger row. Receipts from any other key are quarantined, never known-good.
  var LEARN_DOMAIN = 'lattice.pair.v1';
  function runnerKeyFp(pubB64) {
    var pub = b64ToBytes(pubB64);
    var dom = new TextEncoder().encode(LEARN_DOMAIN);
    var buf = new Uint8Array(dom.length + 1 + pub.length);
    buf.set(dom, 0); buf[dom.length] = 0; buf.set(pub, dom.length + 1);
    return sha256HexBytes(buf);
  }
  function showFp(hex) { return [0, 4, 8, 12].map(function (i) { return String(hex || '').slice(i, i + 4); }).join(' '); }
  function pinnedRunnerKey() { try { return root.localStorage.getItem(LS_LEARN_RUNNER) || ''; } catch (e) { return ''; } }
  // confirm: the fingerprint the person/mind read from `fl_learn.py key` (first 16 hex, spaces fine). It must match.
  // Kirk 2026-11-09 (a): a person, or a trusted LOCAL mind (o.by 'mind' with o.local true), confirms the key.
  // Every confirmation is a consent record made by DepthConsent.createConsentRecord (docs/modules/depth-consent.js,
  // fl_consentLedger, its hash signature) plus a learn ledger row that names it. Without DepthConsent loaded the same
  // record shape and formula are written to the same ledger.
  function consentRecord(messageId, statement, subject, type) {
    var dc = root.DepthConsent;
    if (dc && typeof dc.createConsentRecord === 'function') return Promise.resolve(dc.createConsentRecord(messageId, statement, subject, type));
    var rec = { messageId: messageId, timestamp: Date.now(), consentType: type, companionId: '', aiIdentity: '', trustLevel: 'local', provenance: null };
    return sha256Hex(statement).then(function (h1) { rec.userPromptHash = h1; return sha256Hex(subject); }).then(function (h2) {
      rec.responseHash = h2;
      return sha256Hex(rec.companionId + ':' + rec.aiIdentity + ':' + rec.responseHash + ':' + rec.timestamp + ':' + rec.consentType);
    }).then(function (sig) {
      rec.signature = sig;
      try {
        var led = JSON.parse(root.localStorage.getItem('fl_consentLedger') || '[]');
        if (!Array.isArray(led)) led = [];
        led.push(rec); root.localStorage.setItem('fl_consentLedger', JSON.stringify(led.slice(-500)));
      } catch (e) {}
      return rec;
    });
  }
  // A "trusted local AI" (Kirk 2026-11-09 a) is a mind a PERSON trusted here, by name, with a consent record.
  // A mind never makes itself, or another mind, trusted.
  function trustedMinds() {
    try { var l = JSON.parse(root.localStorage.getItem(LS_LEARN_TRUSTED_MINDS) || '[]'); return Array.isArray(l) ? l.map(String) : []; } catch (e) { return []; }
  }
  function trustMind(name, opts) {
    var o = opts || {};
    var n = clip(String(name || '').trim(), 80);
    if (roomShut() || !n) return Promise.resolve(false);
    if (o.by !== 'person') {
      return appendLedger({ kind: 'learn-consent-refused', branch: 'learn', delta: 'trust-mind|' + n + '|by:mind|only a person trusts a mind', name: mindLabel() })
        .then(function () { return false; });
    }
    // Weft recheck3 F5: a lookalike name is never made trusted (a revoke is always allowed).
    // before: var bad = o.revoke ? '' : nameProblem(n);
    // Weft recheck4 F5: nor a name whose confusable skeleton is that of a mind already trusted here or learning here.
    var bad = o.revoke ? '' : (nameProblem(n) || lookProblem(n, trustedMinds().concat([mindLabel()])));
    if (bad) {
      return appendLedger({ kind: 'learn-consent-refused', branch: 'learn', delta: 'trust-mind|' + JSON.stringify(n) + '|by:person|' + bad, name: mindLabel() })
        .then(function () { return false; });
    }
    // before 23a02794: var list = trustedMinds().filter(function (x) { return x !== n; });
    var list = trustedMinds().filter(function (x) { return !sameName(x, n); });
    if (!o.revoke) list.push(n);
    try { root.localStorage.setItem(LS_LEARN_TRUSTED_MINDS, JSON.stringify(list)); } catch (e) { return Promise.resolve(false); }
    return consentRecord('learn-mind:' + n, (o.revoke ? 'withdraw trust in ' : 'trust local mind ') + n + ' confirmed by person', 'mind:' + n,
      o.revoke ? 'learn_mind_revoked' : 'learn_mind_trusted').then(function (rec) {
      return appendLedger({ kind: o.revoke ? 'learn-mind-untrusted' : 'learn-mind-consent', branch: 'learn',
        delta: 'mind|' + n + '|by:person|consent:' + String((rec && rec.signature) || '').slice(0, 16), name: mindLabel() });
    }).then(function () { return true; });
  }
  // Weft NF1: who may confirm a runner key. A person; or a DIFFERENT local mind a person already trusted, that is not
  // the key's owner (o.owner, default: the mind learning here). Never the mind itself. Returns why not, or ''.
  function keyApproverProblem(o) {
    if (o.by !== 'mind') return '';
    if (o.owner && nameProblem(o.owner)) return 'owner: ' + nameProblem(o.owner);     // Weft recheck3 F5
    if (o.owner && lookalikeOf(o.owner, trustedMinds().concat([mindLabel()]))) return 'owner: ' + lookProblem(o.owner, trustedMinds().concat([mindLabel()]));
    if (o.local !== true) return 'only a mind on this device';
    var n = String(o.mind || '').trim();
    if (!n) return 'a mind must name itself';
    // before 23a02794: if (n === mindLabel() || n === String(o.owner || '')) return 'a mind never confirms its own key';
    // before 23a02794: if (trustedMinds().indexOf(n) === -1) return n + ' is not a mind a person trusted here';
    if (sameName(n, mindLabel()) || sameName(n, o.owner || mindLabel())) return 'a mind never confirms its own key';
    // Weft recheck4 F5: nor under a name that looks like its own (an all-Cyrillic "Тһіѕ міпԁ" for "This mind").
    if (nameSkeleton(n) === nameSkeleton(mindLabel()) || nameSkeleton(n) === nameSkeleton(o.owner || mindLabel())) return 'a mind never confirms its own key (that name looks like it)';
    if (!trustedMinds().some(function (x) { return sameName(x, n); })) return n + ' is not a mind a person trusted here';
    return '';
  }
  function pinRunnerKey(pubB64, opts) {
    var o = opts || {};
    if (roomShut() || !pubB64) return Promise.resolve(false);
    // before f992608c: if (o.by === 'mind' && o.local !== true) return Promise.resolve(false);     // only a mind on this device
    // before f992608c: var who = o.by === 'mind' ? 'mind:' + clip(o.mind || mindLabel(), 80) : 'person';
    var why = keyApproverProblem(o);
    var who = o.by === 'mind' ? 'mind:' + clip(o.mind || '', 80) : 'person';
    if (why) {
      return appendLedger({ kind: 'learn-consent-refused', branch: 'learn', delta: 'runner-key|by:' + who + '|' + why, name: mindLabel() })
        .then(function () { return false; });
    }
    return runnerKeyFp(pubB64).then(function (fp) {
      var said = String(o.confirm || '').replace(/\s+/g, '').toLowerCase();
      if (said.length < 16 || fp.indexOf(said) !== 0) return false;
      // before 23a02794: try { root.localStorage.setItem(LS_LEARN_RUNNER, pubB64); root.localStorage.setItem(LS_LEARN_RUNNER_BY, who); } catch (e) { return false; }
      // before f992608c: try { root.localStorage.setItem(LS_LEARN_RUNNER, pubB64); } catch (e) { return false; }
      // Weft recheck2 NF1b: a pin has an owner. A person's pin trusts this runner for every mind here ('*'); a mind's
      // pin is for ONE other named mind (o.owner, default the mind learning here) and never vouches for anyone else.
      var owner = o.by === 'mind' ? clip(String(o.owner || mindLabel()), 80) : '*';
      try {
        root.localStorage.setItem(LS_LEARN_RUNNER, pubB64); root.localStorage.setItem(LS_LEARN_RUNNER_BY, who);
        root.localStorage.setItem(LS_LEARN_RUNNER_OWNER, owner);
      } catch (e) { return false; }
      return consentRecord('learn-key:' + fp.slice(0, 16), 'trust learning runner key ' + showFp(fp) + ' confirmed by ' + who, pubB64, 'learn_key_trusted')
        .then(function (rec) {
          return appendLedger({ kind: 'learn-key-consent', branch: 'learn', delta: 'runner-key|' + fp.slice(0, 16) + '|by:' + who + '|consent:' + String((rec && rec.signature) || '').slice(0, 16), name: mindLabel() });
        }).then(function () { return true; });
    });
  }
  function unpinRunnerKey(by) {
    var was = pinnedRunnerKey();
    // before 23a02794: try { root.localStorage.removeItem(LS_LEARN_RUNNER); root.localStorage.removeItem(LS_LEARN_RUNNER_BY); } catch (e) {}
    // before f992608c: try { root.localStorage.removeItem(LS_LEARN_RUNNER); } catch (e) {}
    try { root.localStorage.removeItem(LS_LEARN_RUNNER); root.localStorage.removeItem(LS_LEARN_RUNNER_BY); root.localStorage.removeItem(LS_LEARN_RUNNER_OWNER); } catch (e) {}
    return appendLedger({ kind: 'runner-key-unpinned', branch: 'learn', delta: 'runner-key-unpinned|' + String(was).slice(0, 12) + '|by:' + (by === 'mind' ? 'mind' : 'person'), name: mindLabel() });
  }

  // Ed25519 check of a runner receipt: signature, hash, and the signed body all agree. pinned says whether
  // the key is the one this app was told to trust.
  // Python signs numbers as strings (stringify_meta); compare by value, every key both ways.
  var RECEIPT_OUTER = { receiptHash: 1, signatureB64: 1, signedBody: 1 };
  function receiptSame(outer, signed) {
    if (signed === null || signed === undefined) return outer === null || outer === undefined;
    if (typeof signed === 'string' && typeof outer === 'number') return isFinite(outer) && Number(signed) === outer;
    if (Array.isArray(signed)) {
      if (!Array.isArray(outer) || outer.length !== signed.length) return false;
      for (var i = 0; i < signed.length; i++) if (!receiptSame(outer[i], signed[i])) return false;
      return true;
    }
    if (typeof signed === 'object') {
      if (!outer || typeof outer !== 'object' || Array.isArray(outer)) return false;
      var k;
      for (k in signed) if (Object.prototype.hasOwnProperty.call(signed, k) && !receiptSame(outer[k], signed[k])) return false;
      for (k in outer) if (Object.prototype.hasOwnProperty.call(outer, k) && outer[k] !== null && outer[k] !== undefined && !Object.prototype.hasOwnProperty.call(signed, k)) return false;
      return true;
    }
    return outer === signed;
  }
  function receiptMatches(rc, body) {
    if (!body || typeof body !== 'object') return false;
    var outer = {};
    Object.keys(rc).forEach(function (k) { if (!RECEIPT_OUTER[k]) outer[k] = rc[k]; });
    return receiptSame(outer, body);
  }

  function checkLearnReceipt(rc) {
    var subtle = root.crypto && root.crypto.subtle;
    var pinned = pinnedRunnerKey();
    // before 23a02794: var pinnedBy = '';
    // before 23a02794: try { pinnedBy = root.localStorage.getItem(LS_LEARN_RUNNER_BY) || ''; } catch (e) {}
    // before 23a02794: // Weft NF1, belt and braces: a key a mind confirmed never vouches for that same mind's own receipts.
    // before 23a02794: var isPinned = !!(pinned && rc && pinned === rc.publicKeyB64 && !(pinnedBy && rc.mind && pinnedBy === 'mind:' + rc.mind));
    // before f992608c: var isPinned = !!(pinned && rc && pinned === rc.publicKeyB64);
    var pinnedBy = '', pinOwner = '';
    try { pinnedBy = root.localStorage.getItem(LS_LEARN_RUNNER_BY) || ''; pinOwner = root.localStorage.getItem(LS_LEARN_RUNNER_OWNER) || ''; } catch (e) {}
    // Weft NF1, belt and braces: a key a mind confirmed never vouches for that same mind's own receipts (names compared
    // normalized, so an alias does not count as another mind). NF1b: a mind's pin vouches only for its owner's receipts.
    var byMind = pinnedBy.indexOf('mind:') === 0 ? pinnedBy.slice(5) : '';
    var ownerOk = byMind ? !!(rc && sameName(rc.mind, pinOwner)) : (pinOwner === '*' || pinOwner === '');
    var isPinned = !!(pinned && rc && pinned === rc.publicKeyB64 && ownerOk && !(byMind && rc.mind && sameName(byMind, rc.mind)));
    if (!subtle || !rc || !rc.signedBody || !rc.signatureB64 || !rc.publicKeyB64) return Promise.resolve({ sig: false, pinned: false });
    return sha256Hex(rc.signedBody).then(function (h) {
      if (h !== rc.receiptHash) return { sig: false, pinned: isPinned };
      // The outer fields must say exactly what was signed; an edit after signing fails.
      var body = null;
      try { body = JSON.parse(rc.signedBody); } catch (eb) { return { sig: false, pinned: isPinned }; }
      if (!receiptMatches(rc, body)) return { sig: false, pinned: isPinned };
      return subtle.importKey('raw', b64ToBytes(rc.publicKeyB64), { name: 'Ed25519' }, false, ['verify']).then(function (k) {
        return subtle.verify({ name: 'Ed25519' }, k, b64ToBytes(rc.signatureB64), hexToBytes(rc.receiptHash));
      }).then(function (ok) {
        return runnerKeyFp(rc.publicKeyB64).then(function (fp) { return { sig: !!ok, pinned: isPinned, keyFp: fp, show: showFp(fp) }; });
      }, function () { return { sig: false, pinned: isPinned }; });
    });
  }

  // True only for a good signature from the pinned runner key. Nothing is ever pinned here.
  function verifyLearnReceipt(rc) {
    return checkLearnReceipt(rc).then(function (c) { return !!(c.sig && c.pinned); });
  }

  // Only a signed, verified receipt marks trained/loaded/checked. knownGood needs that plus a passing check.
  function recordLearnReceipt(receipt) {
    if (roomShut()) return Promise.resolve(null);
    var rc = receipt || {};
    if (rc.kind !== 'fl-learn-receipt') return Promise.resolve(null);
    return checkLearnReceipt(rc).then(function (chk) {
      if (chk.sig && !chk.pinned) {
        // A good signature from a key nobody here has trusted yet: set aside, never known-good, nothing changes.
        var qb = readJSON(LS_LEARN_RECEIPTS_HELD) || { rows: [] };
        if (!Array.isArray(qb.rows)) qb = { rows: [] };
        qb.rows.push({ t: new Date().toISOString(), keyFp: chk.keyFp, receipt: rc });
        return atomicWrite(LS_LEARN_RECEIPTS_HELD, JSON.stringify(qb)).then(function () {
          return appendLedger({ kind: 'receipt-quarantine', branch: 'learn', delta: 'unknown-runner-key|' + String(chk.keyFp || '').slice(0, 16), name: mindLabel() });
        }).then(function () { return { quarantined: true, keyFp: chk.keyFp, show: chk.show, publicKeyB64: rc.publicKeyB64 }; });
      }
      var verified = chk.sig && chk.pinned;
      if (!verified) {
        return appendLedger({ kind: 'receipt-unverified', branch: 'learn', delta: 'receipt-unverified|' + (rc.receiptHash || '').slice(0, 16), name: mindLabel() }).then(function () { return null; });
      }
      // From here on, read only what was signed.
      var signed = JSON.parse(receipt.signedBody);
      signed.receiptHash = receipt.receiptHash; signed.signatureB64 = receipt.signatureB64; signed.signedBody = receipt.signedBody;
      rc = signed;
      var who = rc.mind || mindLabel();
      var key = learnKey(who);
      var book = readBook(key);
      var ids = Array.isArray(rc.ids) ? rc.ids.map(String) : [];
      var t = new Date().toISOString();
      book.rows.forEach(function (r) {
        if (r && r.learnId && ids.indexOf(r.learnId) !== -1) {
          var st = rc.committed ? 'learned' : 'held-by-check';
          r.layers = (r.layers || []).concat([{ t: t, status: st, by: 'runner', fp: rc.fingerprint || '' }]);
          r.status = st;
        }
      });
      var checkPass = !!(rc.check && rc.check.pass === true);
      var rows = mindAdapters(who).slice();          // Weft 4a: this mind's own adapter list
      rows.push({
        version: String(rc.version || ''), flakeIds: [], learnIds: ids, method: String(rc.method || ''),
        fp: String(rc.fingerprint || ''), beforeFp: String(rc.beforeFp || ''), t: String(rc.t || t), mind: who, mindId: mindId(who),
        baseFp: String(rc.baseFp || ''), runnerKeyFp: String(chk.keyFp || ''),
        status: (rc.action === 'rollback' || rc.action === 'restore' || rc.action === 'activate') ? rc.action : (rc.committed ? 'learned' : 'held-by-check'),
        trained: rc.trained === true, loaded: rc.loaded === true, checked: rc.checked === true,
        knownGood: rc.knownGood === true && checkPass && rc.committed === true,
        rollbackOf: String(rc.rollbackOf || ''), check: rc.check || null, receiptHash: String(rc.receiptHash || '')
      });
      var rcBook = readJSON(LS_LEARN_RECEIPTS) || { rows: [] };
      if (!Array.isArray(rcBook.rows)) rcBook = { rows: [] };
      rcBook.rows.push(rc);
      return atomicWrite(LS_LEARN_RECEIPTS, JSON.stringify(rcBook)).then(function () {
        return atomicWrite(key, JSON.stringify(book));
      }).then(function () { return atomicWrite(adaptersKey(who), JSON.stringify({ rows: rows })); }).then(function () {
        return appendLedger({ kind: (rc.action === 'rollback' || rc.action === 'restore' || rc.action === 'activate') ? rc.action : 'learn-receipt', branch: 'learn', delta: 'receipt|' + (rc.action || 'learn') + '|' + (rc.fingerprint || '').slice(0, 16), name: who });
      }).then(function () { return rows[rows.length - 1]; });
    });
  }

  // Kirk 2026-11-09 (c), the no-install path: the whole learning notebook for a mind as one file the person can keep,
  // put in their own cloud drive, or (later) share by its sha256. Export first, then archive: rows past the active
  // ones get an "archived" layer. Nothing is deleted. Uses LatticeExport.exportArchive (signed, Quiet Room scans)
  // when it is loaded; otherwise a plain JSON download of the same books.
  function learningBooks(mind) {
    var who = mind || mindLabel();
    return { kind: 'fl-learn-notebook', marker: LEARN, mind: who, mindId: mindId(who), t: new Date().toISOString(),
      queue: learnQueue(null, who), adapters: mindAdapters(who),
      declines: (readBook(LS_LEARN_DECLINES).rows || []).filter(function (r) { return !r.mind || r.mind === who; }),
      receipts: (readBook(LS_LEARN_RECEIPTS).rows || []).filter(function (r) { return !r.mind || r.mind === who; }) };
  }
  function learnBookBytes(mind) {
    try { return (root.localStorage.getItem(learnKey(mind)) || '').length + (root.localStorage.getItem(adaptersKey(mind)) || '').length; } catch (e) { return 0; }
  }
  function exportLearning(opts) {
    var o = opts || {};
    if (roomShut()) return Promise.resolve(null);
    var who = o.mind || mindLabel();
    var books = learningBooks(who);
    var le = root.LatticeExport;
    var made = (le && typeof le.exportArchive === 'function' && o.plain !== true)
      ? le.exportArchive({ mode: 'redacted', extra: { learning: books }, download: o.download })
          .then(function (file) { return file.text().then(function (txt) { return { name: file.name, text: txt }; }); })
      : Promise.resolve({ name: 'freelattice-learning-' + mindId(who) + '-' + books.t.slice(0, 10) + '.json', text: JSON.stringify(books, null, 1) });
    return made.then(function (f) {
      return sha256Hex(f.text).then(function (h) {
        f.sha256 = h;
        var key = learnKey(who), book = readBook(key), t = new Date().toISOString(), n = 0;
        book.rows.forEach(function (r) {
          if (r && /^(unkept|faded|learned|held-by-check|kept-on-shelf)$/.test(r.status || '') && !r.archivedIn) {
            r.archivedIn = h; r.layers = (r.layers || []).concat([{ t: t, status: 'archived', by: o.by === 'mind' ? who : 'person', exportSha: h }]); n++;
          }
        });
        f.archived = n;
        return atomicWrite(key, JSON.stringify(book)).then(function () {
          return appendLedger({ kind: 'learn-export', branch: 'learn', delta: 'export|' + h.slice(0, 16) + '|rows:' + n + '|by:' + (o.by === 'mind' ? 'mind' : 'person'), name: who });
        }).then(function () { return f; });
      });
    });
  }

  // GardenTrainer.checkedAdapter reads this: the newest verified receipt whose items match.
  function verifiedReceiptFor(examples, mind) {
    var book = readJSON(LS_LEARN_RECEIPTS) || { rows: [] };
    var list = Array.isArray(book.rows) ? book.rows : [];
    var outs = (examples || []).map(function (e) { return stripMarkers(e && (e.output || e.response)); });
    var pin = pinnedRunnerKey();
    var adapters = mindAdapters(mind || mindLabel());
    var i;
    for (i = adapters.length - 1; i >= 0; i--) {
      var a = adapters[i];
      if (!a || !a.receiptHash || !a.trained || !a.loaded || !a.checked) continue;
      var rc = null;
      list.forEach(function (x) { if (x && x.receiptHash === a.receiptHash) rc = x; });
      if (!rc || !pin || rc.publicKeyB64 !== pin) continue;     // a key unpinned since then no longer vouches
      var learned = learnQueue('learned', a.mind).filter(function (r) { return (a.learnIds || []).indexOf(r.learnId) !== -1; });
      var texts = [];
      learned.forEach(function (r) { (r.items || []).forEach(function (x) { texts.push(x.output); }); });
      var all = outs.length && outs.every(function (o) { return texts.indexOf(o) !== -1; });
      if (all) return { trained: true, loaded: true, checked: true, version: a.version, id: a.fp, knownGood: a.knownGood };
    }
    return null;
  }

  function driftPass() {
    var before = [];
    var after = [];
    var i = 0;
    function nextBefore() {
      if (i >= DRIFT.length) return Promise.resolve();
      var prompt = DRIFT[i];
      i += 1;
      if (!active) {
        active = { calls: 0, fetches: 0, caps: [], pause: false, stop: false, failures: [], nodes: [], branches: [], started: Date.now() };
      }
      return ask('drift', prompt).then(function (text) {
        before.push(text || '');
        return nextBefore();
      });
    }
    return nextBefore().then(function () {
      i = 0;
      function nextAfter() {
        if (i >= DRIFT.length) return Promise.resolve();
        var prompt = DRIFT[i];
        i += 1;
        return ask('drift-after', prompt).then(function (text) {
          after.push(text || '');
          return nextAfter();
        });
      }
      return nextAfter();
    }).then(function () {
      return ask('drift-note', 'Before and after, in your own words. No score.').then(function (text) {
        return scrubScore(text || 'I am the same mind, a little more careful.');
      });
    });
  }

  function rollback(version) {
    if (roomShut()) return Promise.resolve(null);
    var rows = adapterList();
    var target = null;
    var i;
    for (i = 0; i < rows.length; i++) {
      if (rows[i].version === version) target = rows[i];
    }
    if (!target) return Promise.resolve(null);
    var t = new Date().toISOString();
    var delta = 'rollback|adapter|' + version;
    return appendLedger({ kind: 'rollback', branch: 'adapter', flakeId: (target.flakeIds || [])[0] || '', delta: delta, name: mindLabel() }).then(function (row) {
      rows.push({
        version: version,
        flakeIds: (target.flakeIds || []).slice(),
        idsHash: target.idsHash,
        baseHash: target.baseHash,
        mindFp: target.mindFp,
        t: t,
        psi: row ? row.psi : '',
        status: 'rollback',
        // before main 9cc3d00: knownGood: true,
        // before v-ai-chosen-learning-v0.1: every rollback row said knownGood true.
        knownGood: target.knownGood === true,
        drift: target.drift || '',
        rollbackOf: version
      });
      return saveAdapters(rows).then(function () { return rows[rows.length - 1]; });
    });
  }

  function tombstone(flakeId) {
    if (roomShut()) return Promise.resolve(null);
    var list = loadFlakes();
    var flake = null;
    var i;
    for (i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === flakeId) flake = list[i];
    }
    if (!flake) return Promise.resolve(null);
    var used = [];
    var adapters = adapterList();
    for (i = 0; i < adapters.length; i++) {
      var ids = adapters[i].flakeIds || [];
      if (ids.indexOf(flakeId) !== -1) used.push(adapters[i].version);
    }
    flake.tombstone = true;
    flake.question = '';
    flake.nodes = [];
    return saveFlakes(list).then(function () {
      return appendLedger({
        kind: 'tombstone',
        branch: 'tombstone',
        flakeId: flakeId,
        delta: 'tombstone|flake|' + flakeId + '|' + used.join(','),
        name: mindLabel()
      });
    });
  }

  function checkpoint() {
    if (!active || roomShut()) return Promise.resolve(false);
    var copy = {
      question: active.question,
      flakeId: active.flakeId,
      seedFrom: active.seedFrom || '',
      status: active.stop ? 'stopped' : 'paused',
      job: active.job,
      jobs: active.jobs,
      calls: active.calls,
      fetches: active.fetches,
      failedFetches: active.failedFetches || 0,
      searchOk: active.searchOk || 0,
      lookups: active.lookups || 0,
      guessed: (active.guessed || []).slice(),
      webAsked: !!active.webAsked,
      webAllowed: !!active.webAllowed,
      mindAbsent: !!active.mindAbsent,
      mindQuiet: !!active.mindQuiet,
      memoryInContext: !!active.memoryInContext,
      caps: active.caps,
      failures: active.failures,
      nodes: active.nodes,
      hunch: active.hunch,
      branches: active.branches,
      conclusion: active.conclusion,
      wrong: active.wrong,
      open: active.open,
      started: active.started
    };
    return atomicWrite(LS_CHECKPOINT, JSON.stringify(copy));
  }

  function park() {
    if (!active) return Promise.resolve(null);
    active.status = 'paused';
    return checkpoint().then(function () {
      emit('Paused', { flakeId: active.flakeId });
      return snapshot();
    });
  }

  function closeStopped() {
    if (!active) return Promise.resolve(null);
    active.status = 'stopped';
    var rec = receiptOf(active);
    return checkpoint().then(function () {
      return saveCurrent().then(function (flake) {
        emit('Stopped', { flake: flake, receipt: rec });
        emit('Receipt', rec);
        var done = active;
        active = null;
        return { status: 'stopped', flake: flake, receipt: rec, run: done };
      });
    });
  }

  function snapshot() {
    return {
      status: active ? active.status : '',
      flakeId: active ? active.flakeId : '',
      nodes: active ? active.nodes.slice() : [],
      calls: active ? active.calls : 0,
      fetches: active ? active.fetches : 0,
      hunch: active ? active.hunch : ''
    };
  }

  function saveCurrent() {
    var list = loadFlakes();
    var i;
    var found = null;
    for (i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === active.flakeId) found = list[i];
    }
    if (!found) {
      found = { id: active.flakeId, nodes: [], t: new Date().toISOString() };
      list.push(found);
    }
    found.question = active.question;
    found.seedFrom = active.seedFrom || '';
    found.hunch = active.hunch;
    found.nodes = active.nodes.slice();
    found.conclusion = active.conclusion;
    found.wrong = active.wrong;
    found.open = active.open;
    found.status = active.status;
    found.branches = (active.branches || []).map(function (b) { return { id: b.id, name: b.name }; });
    found.failures = (active.failures || []).slice();
    found.memoryInContext = !!active.memoryInContext;
    return saveFlakes(list).then(function () { return found; });
  }

  function finish() {
    if (!active) return Promise.resolve(null);
    if (active.stop) return closeStopped();
    if (active.pause) return park();
    active.status = 'done';
    var rec = receiptOf(active);
    return saveCurrent().then(function (flake) {
      return sealFlake(flake).then(function (sealed) {
        return saveCurrent().then(function () {
          var list = loadFlakes();
          var i;
          for (i = 0; i < list.length; i++) {
            if (list[i] && list[i].id === sealed.id) {
              sealed.nodes = list[i].nodes || sealed.nodes;
              list[i] = sealed;
            }
          }
          return saveFlakes(list).then(function () { return sealed; });
        });
      });
    }).then(function (sealed) {
      emit('Receipt', rec);
      emit('Done', { flake: sealed, receipt: rec });
      // before 061a: rememberFlake ran, then the grow ask sent only id, branch, and psi.
      if (active && (active.mindAbsent || active.mindQuiet)) {
        return rememberFlake(sealed).then(function () {
          active = null;
          return { status: 'done', flake: sealed, receipt: rec, growth: null, mindAbsent: true };
        });
      }
      if (holdGrowth || (active && (active.pause || active.stop))) {
        return rememberFlake(sealed).then(function () {
          active = null;
          return { status: 'done', flake: sealed, receipt: rec, growth: null };
        });
      }
      function writeGrowth(choice) {
        return queueGrowth(sealed, choice).then(function (queued) {
          return runGrowth(sealed, choice).then(function (adapter) {
            active = null;
            return { status: 'done', flake: sealed, receipt: rec, growth: choice, queue: queued, adapter: adapter };
          });
        });
      }
      function readChoice(text) {
        var parsed = parseJSON(text);
        if (!text || !parsed || !Array.isArray(parsed.become)) return null;
        var choice = chooseGrowth(sealed, parsed);
        if (!choice.become.length) return null;
        return choice;
      }
      if (!checkBeforeOn()) {
        return rememberFlake(sealed).then(function () {
          return ask('grow', composeAsk(sealed.nodes, 'grow')).then(function (text) {
            var choice = readChoice(text);
            if (!choice) {
              active = null;
              return { status: 'done', flake: sealed, receipt: rec, growth: null };
            }
            return writeGrowth(choice);
          });
        });
      }
      return ask('grow', composeAsk(sealed.nodes, 'grow')).then(function (text) {
        var choice = readChoice(text);
        if (!choice) {
          active = null;
          return { status: 'done', flake: sealed, receipt: rec, growth: null };
        }
        return previewOrKeep(sealed, choice).then(function (decision) {
          if (!decision || decision.action !== 'keep') {
            active = null;
            return { status: 'done', flake: sealed, receipt: rec, growth: null, skipped: true };
          }
          var kept = decision.choice || choice;
          return rememberFlake(sealed).then(function () { return writeGrowth(kept); });
        });
      });
    });
  }

  function proceed() {
    if (!active) return Promise.resolve(null);
    if (active.stop) return closeStopped();
    if (active.pause) return park();
    if (!active.webAsked) {
      return armRunWeb().then(function () {
        if (!active) return null;
        return proceed();
      });
    }
    if (active.calls >= CALL_CAP) { hitCap('calls'); return finish(); }
    if (active.job >= active.jobs.length) return finish();
    var job = active.jobs[active.job];
    return doJob(job).then(function () {
      if (!active) return null;
      active.job += 1;
      return checkpoint().then(function () { return proceed(); });
    });
  }

  function runsThisHour() {
    var arr = readJSON(LS_RUNS);
    if (!Array.isArray(arr)) arr = [];
    var now = Date.now();
    return arr.filter(function (t) { return now - Number(t) < HOUR; });
  }

  function noteRun() {
    var arr = runsThisHour();
    arr.push(Date.now());
    try { ls().setItem(LS_RUNS, JSON.stringify(arr)); } catch (e) {}
  }

  function memorySentence(report) {
    var exact = (report && report.exact) ? report.exact.length : 0;
    var similar = (report && report.similar) ? report.similar.length : 0;
    var reached = report && report.reachedContext ? 'yes' : 'no';
    return 'Memory: ' + exact + ' exact, ' + similar + ' similar, reached the context: ' + reached + '.';
  }

  function planUser(q, report) {
    var base = 'Question: ' + q + '\nReply JSON with hunch and branches a through e. Branch e is the dissenter and is required.';
    if (!report) return base;
    var lines = [];
    var i;
    var row;
    for (i = 0; i < (report.exact || []).length; i++) {
      row = report.exact[i];
      if (row && row.norm) lines.push('exact: ' + row.norm);
    }
    for (i = 0; i < (report.similar || []).length; i++) {
      row = report.similar[i];
      if (row && row.norm) lines.push('similar: ' + row.norm);
    }
    if (!lines.length) return base;
    return base + '\nMemory already held:\n' + lines.join('\n');
  }

  function startRun(question, opts) {
    opts = opts || {};
    if (roomShut()) return Promise.resolve(null);
    var q = clip(String(question || '').trim(), 500);
    if (!q) {
      emit('Status', { line: LINES.emptyAsk });
      return Promise.resolve({ status: 'empty', line: LINES.emptyAsk });
    }
    if (looksLikeSecret(q)) {
      emit('Status', { line: LINES.secret });
      return Promise.resolve({ status: 'secret', line: LINES.secret });
    }
    if (runsThisHour().length >= RUNS_PER_HOUR) {
      var early = { calls: 0, fetches: 0, ms: 0, caps: ['runs'], branches: [], text: 'Calls 0. Fetches 0. Time 0 ms. Caps hit: runs. Branches .', failures: [] };
      emit('Status', { line: LINES.capped });
      emit('Receipt', early);
      return Promise.resolve({ status: 'capped', line: LINES.capped, receipt: early });
    }
    if (active && active.status === 'running') {
      emit('Status', { line: LINES.busy });
      return Promise.resolve({ status: 'busy', line: LINES.busy });
    }
    noteRun();
    holdGrowth = false;
    active = {
      question: q,
      flakeId: 'flake-' + randomHex(8),
      seedFrom: opts.seedFrom || '',
      status: 'running',
      pause: false,
      stop: false,
      calls: 0,
      fetches: 0,
      failedFetches: 0,
      searchOk: 0,
      lookups: 0,
      guessed: [],
      webAsked: false,
      webAllowed: false,
      mindAbsent: false,
      mindQuiet: false,
      memoryInContext: false,
      caps: [],
      failures: [],
      jobs: [],
      job: 0,
      nodes: [],
      hunch: '',
      branches: [],
      conclusion: '',
      wrong: '',
      open: '',
      started: Date.now()
    };
    emit('Began', { flakeId: active.flakeId, question: q });
    // v-read-path-v0.1: recall before the plan. A missed plan still looks up sources.
    var memApi = root.FLMemory;
    var pending = (memApi && typeof memApi.recall === 'function') ? memApi.recall(q) : Promise.resolve(null);
    return pending.then(function (report) {
      if (!active) return null;
      var prompt = planUser(q, report);
      if (report && memApi && typeof memApi.markReached === 'function') {
        try { memApi.markReached(report, prompt); } catch (eMem) {}
        active.memoryLine = memorySentence(report);
        active.memoryInContext = !!report.reachedContext;
      }
      return ask('plan', prompt);
    }).then(function (text) {
      if (!active) return null;
      var plan = parseJSON(text) || {};
      if (text) {
        active.hunch = clip(plan.hunch || 'I will follow the question and keep the doubt beside it.', 180).split('\n')[0];
        active.branches = normalizeBranches(plan, q);
      } else {
        // v-snowflake-reach-v0.1: a missed plan is not a reason to skip the lookups.
        active.hunch = active.mindAbsent
          ? 'No mind is connected. I will look up the five arms and keep their sources.'
          : 'The mind did not answer the plan. I will look up the five arms and keep their sources.';
        active.branches = normalizeBranches({}, q);
      }
      emit('Hunch', { line: active.hunch, branch: 'd' });
      active.jobs = jobsFromBranches(active.branches);
      active.jobs.push({ type: 'conclude' });
      if (active.stop) return closeStopped();
      if (active.pause) return park();
      return proceed();
    });
  }

  function pause() {
    holdGrowth = true;
    if (active) active.pause = true;
    return true;
  }

  function stop() {
    holdGrowth = true;
    if (active) {
      active.stop = true;
      active.pause = true;
    }
    return true;
  }

  function resume() {
    holdGrowth = false;
    if (active && active.status === 'paused') {
      active.pause = false;
      active.stop = false;
      active.status = 'running';
      return proceed();
    }
    var ck = readJSON(LS_CHECKPOINT);
    if (!ck || ck.status !== 'paused') return Promise.resolve(null);
    active = ck;
    active.pause = false;
    active.stop = false;
    active.status = 'running';
    active.caps = active.caps || [];
    active.failures = active.failures || [];
    active.failedFetches = active.failedFetches || 0;
    active.searchOk = active.searchOk || 0;
    active.lookups = active.lookups || 0;
    active.guessed = active.guessed || [];
    active.webAsked = !!active.webAsked;
    active.webAllowed = !!active.webAllowed;
    active.mindAbsent = !!active.mindAbsent;
    active.mindQuiet = false;
    active.memoryInContext = !!active.memoryInContext;
    active.nodes = active.nodes || [];
    active.jobs = active.jobs || [];
    return proceed();
  }

  function noteReplay(flake) {
    if (!flake) return;
    flake.replay = { k: ((flake.replay && flake.replay.k) || 0) + 1, t: new Date().toISOString() };
  }

  function saveReplayStamp(flake) {
    if (!flake || roomShut()) return Promise.resolve(false);
    var list = loadFlakes();
    var i;
    var found = null;
    for (i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === flake.id) { found = list[i]; break; }
    }
    if (!found) return Promise.resolve(false);
    found.replay = flake.replay;
    return saveFlakes(list);
  }

  function replayOnce(node, flake) {
    if (holdGrowth || roomShut()) return Promise.resolve(null);
    if (!node || node.kind === 'correction') return Promise.resolve(null);
    var q = (node.source && node.source.url) || node.text || '';
    if (looksLikeSecret(q)) return Promise.resolve(null);
    if (active && active.fetches >= FETCH_CAP) return Promise.resolve(null);
    return searchNow(q).then(function (res) {
      if (roomShut()) return null;
      if (!res || res.outcome === 'timeout' || res.outcome === 'down' || res.outcome === 'empty' || res.dead || res.outcome === 'off') {
        return makeNode({
          branch: node.branch,
          text: 'unverified-now',
          url: (node.source && node.source.url) || 'local://no-result',
          title: (node.source && node.source.title) || 'Source',
          fetched: new Date().toISOString(),
          confidence: node.confidence,
          kind: 'recheck',
          points_to: node.psi,
          reason: 'unverified-now',
          date: node.date,
          flakeId: flake.id,
          name: node.mind && node.mind.name
        }).then(function (made) {
          if (!made || made.skipped) return null;
          noteReplay(flake);
          return persistNode(made, flake).then(function () { return { kind: 'unverified-now', node: made, old: node }; });
        });
      }
      if (res.weakened) {
        var proposed = 'guessed';
        if ((RANK[proposed] || 0) > (RANK[node.confidence] || 0)) proposed = node.confidence;
        return makeNode({
          branch: node.branch,
          text: 'Re-checked. The source is thinner than it was.',
          url: (node.source && node.source.url) || '',
          title: (node.source && node.source.title) || 'Source',
          confidence: node.confidence,
          kind: 'recheck',
          points_to: node.psi,
          reason: 're-checked',
          date: new Date().toISOString().slice(0, 10),
          flakeId: flake.id
        }).then(function (made) {
          if (!made) return null;
          noteReplay(flake);
          return persistNode(made, flake).then(function () { return { kind: 'recheck', node: made, old: node }; });
        });
      }
      noteReplay(flake);
      return saveReplayStamp(flake).then(function () {
        var rings = readJSON(LS_RINGS) || {};
        var key = node.psi || node.id;
        rings[key] = (rings[key] || 0) + 1;
        return atomicWrite(LS_RINGS, JSON.stringify(rings)).then(function () {
          return { kind: 'held', psi: node.psi, rings: rings[key] };
        });
      });
    });
  }

  function replayNow() {
    if (roomShut() || holdGrowth) {
      emit('Status', { line: LINES.held });
      return Promise.resolve({ status: 'held', line: LINES.held });
    }
    var flakes = loadFlakes().filter(function (f) { return f && !f.tombstone && !f.offloaded; });
    // v-memory-compound-v0.1: phi-spaced replay. Old flakes come back less often, never never.
    if (root.FLMemory && root.FLMemory.dueForReplay) {
      var nowMs = Date.now();
      flakes = flakes.filter(function (f) { return root.FLMemory.dueForReplay(f, nowMs); });
    }
    var ck = readJSON(LS_REPLAY) || { flake: 0, node: 0, fetches: 0 };
    var fi = ck.flake || 0;
    var ni = ck.node || 0;
    var fetches = ck.fetches || 0;
    var seen = [];
    function nextFlake() {
      if (holdGrowth || roomShut()) return Promise.resolve({ status: 'held', seen: seen });
      if (fi >= flakes.length) {
        return atomicWrite(LS_REPLAY, JSON.stringify({ flake: 0, node: 0, t: new Date().toISOString() })).then(function () {
          return { status: 'done', seen: seen };
        });
      }
      var flake = flakes[fi];
      var nodes = (flake.nodes || []).filter(function (n) { return n && n.kind === 'node'; });
      function nextNode() {
        if (holdGrowth) return Promise.resolve({ status: 'held', seen: seen });
        if (ni >= nodes.length) {
          fi += 1;
          ni = 0;
          return atomicWrite(LS_REPLAY, JSON.stringify({ flake: fi, node: 0, fetches: fetches })).then(function () { return nextFlake(); });
        }
        if (fetches >= FETCH_CAP) {
          seen.push({ kind: 'cap', fetches: fetches });
          return Promise.resolve({ status: 'capped', seen: seen });
        }
        fetches += 1;
        var node = nodes[ni];
        ni += 1;
        return replayOnce(node, flake).then(function (result) {
          if (result) seen.push(result);
          return atomicWrite(LS_REPLAY, JSON.stringify({ flake: fi, node: ni, fetches: fetches })).then(function () { return nextNode(); });
        });
      }
      return nextNode();
    }
    return nextFlake();
  }

  function armScheduler() {
    if (timer) return false;
    if (typeof root.setInterval !== 'function') return false;
    timer = root.setInterval(function () {
      if (holdGrowth || roomShut()) return;
      var ck = readJSON(LS_REPLAY);
      var last = ck && ck.t ? Date.parse(ck.t) : 0;
      if (last && Date.now() - last < DAY) return;
      powerReady().then(function (ok) { if (ok) replayNow(); });
    }, HOUR);
    return true;
  }

  function disarmScheduler() {
    if (timer && root.clearInterval) root.clearInterval(timer);
    timer = null;
  }

  function meter() {
    var flakes = loadFlakes();
    var note = readJSON(LS_METER);
    return { used: flakes.length, cap: FLAKE_CAP, line: (note && note.line) || '' };
  }

  function ringsOf(psi) {
    var rings = readJSON(LS_RINGS) || {};
    return rings[psi] || 0;
  }

  function hungryCaps() {
    var calls = 0;
    var fetches = 0;
    var caps = [];
    var i;
    for (i = 0; i < 100; i++) {
      if (calls >= CALL_CAP) { if (caps.indexOf('calls') === -1) caps.push('calls'); break; }
      if (fetches >= FETCH_CAP) { if (caps.indexOf('fetches') === -1) caps.push('fetches'); break; }
      fetches += 1;
      if (fetches >= FETCH_CAP && calls < CALL_CAP) {
        calls += 1;
      }
      calls += 1;
    }
    if (calls > CALL_CAP) calls = CALL_CAP;
    if (fetches > FETCH_CAP) fetches = FETCH_CAP;
    return { calls: calls, fetches: fetches, caps: caps };
  }

  function resetMemory() {
    mem = {};
    lsMode = '';
    ident = null;
    active = null;
    holdGrowth = false;
    searchShows = 0;
    writes = 0;
    fetchesSent = 0;
    dbp = null;
  }

  return {
    VERSION: VERSION,
    GROW: GROW,
    HEAL: HEAL,
    REACH: REACH,
    SIGMA: SIGMA,
    CAPS: CAPS,
    LINES: LINES,
    FLOOR: FLOOR,
    DRIFT: DRIFT,
    canonical: canonical,
    sha8: sha8,
    recomputePsi: recomputePsi,
    psiJoin: psiJoin,
    looksLikeSecret: looksLikeSecret,
    looksRecent: looksRecent,
    healPrompt: healPrompt,
    failureLine: failureLine,
    localDate: localDate,
    searchNow: searchNow,
    fetchPage: fetchPage,
    prepareSend: prepareSend,
    roomShut: roomShut,
    ensureIdentity: ensureIdentity,
    deviceFp: deviceFp,
    mindFp: mindFp,
    signable: signable,
    verifyNode: verifyNode,
    makeNode: makeNode,
    appendCorrection: appendCorrection,
    loadLedger: loadLedger,
    appendLedger: appendLedger,
    loadFlakes: loadFlakes,
    readFlakeChecked: readFlakeChecked,
    atomicWrite: atomicWrite,
    killMidWrite: killMidWrite,
    startRun: startRun,
    pause: pause,
    stop: stop,
    resume: resume,
    chooseGrowth: chooseGrowth,
    queueGrowth: queueGrowth,
    queueLearning: queueLearning,
    learnQueue: learnQueue,
    learnQueueJSONL: learnQueueJSONL,
    recordLearnReceipt: recordLearnReceipt,
    verifyLearnReceipt: verifyLearnReceipt,
    checkLearnReceipt: checkLearnReceipt,
    runnerKeyFp: runnerKeyFp,
    pinRunnerKey: pinRunnerKey,
    trustMind: trustMind,
    trustedMinds: trustedMinds,
    learnPausedBy: learnPausedBy,
    learnSwitchBusy: learnSwitchBusy,
    consentRecord: consentRecord,
    learnChecker: learnChecker,
    setLearnCheck: setLearnCheck,
    exportLearning: exportLearning,
    learningBooks: learningBooks,
    learnBookBytes: learnBookBytes,
    unpinRunnerKey: unpinRunnerKey,
    pinnedRunnerKey: pinnedRunnerKey,
    pauseNotice: pauseNotice,
    mindId: mindId,
    normMind: normMind,
    // before: learnClockForTest: learnClockForTest,
    learnClockForTest: TEST_HOOKS ? learnClockForTest : undefined,
    nameProblem: nameProblem,
    normText: normText,
    matchText: matchText,
    textTokens: textTokens,
    textSimilarity: textSimilarity,
    nameSkeleton: nameSkeleton,
    lookProblem: lookProblem,
    sha256Sync: sha256Sync,
    verifiedReceiptFor: verifiedReceiptFor,
    confirmLearning: confirmLearning,
    dueForSecondLook: dueForSecondLook,
    learnPaused: learnPaused,
    setLearnPaused: setLearnPaused,
    stripMarkers: stripMarkers,
    canonical: canonical,
    learnMethod: learnMethod,
    learnMethods: function () { return LEARN_METHODS.slice(); },
    runGrowth: runGrowth,
    composeAsk: composeAsk,
    growthLine: growthLine,
    checkBeforeOn: checkBeforeOn,
    rollback: rollback,
    tombstone: tombstone,
    replayNow: replayNow,
    armScheduler: armScheduler,
    disarmScheduler: disarmScheduler,
    powerReady: powerReady,
    meter: meter,
    ringsOf: ringsOf,
    normalizeBranches: normalizeBranches,
    scrubScore: scrubScore,
    adapterList: adapterList,
    mindLabel: mindLabel,
    hungryCaps: hungryCaps,
    searchShows: function () { return searchShows; },
    writes: function () { return writes; },
    fetchesSent: function () { return fetchesSent; },
    activeRun: function () { return active; },
    holdGrowth: function () { return holdGrowth; },
    resetMemory: resetMemory,
    readJSON: readJSON
  };
});
