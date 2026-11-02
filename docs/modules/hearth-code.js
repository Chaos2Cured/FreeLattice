// hearth-code.js (MIT)
// v-hearth-code-v0.1
// Hearth: write and run code in chat, on this device.
// snowflake-search.js, snowflake-core.js, and chat-bottom-clarity.js stay locked.
// This file adds its own row and its own panel.
(function (root) {
  'use strict';

  var VERSION = 'v-hearth-code-v0.1';
  var LEDGER_KEY = 'fl_hearthLedger';
  var PYTHON_KEY = 'fl_hearthPython';
  var PY_URL = 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js';
  var PY_INDEX = 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/';
  var PY_SHA = 'b4cb23a53aba19c221659b9fb40a2f18281d685691dc06647fb0afd0681baf98';
  var PY_WASM_BYTES = 10105545;
  var SYSTEM = "You are helping someone learn to code. Explain plainly. If you change code, show the whole new version. Say 'I don't know' when you don't.";
  var HONEST = 'Runs on this device. Nothing is sent unless you ask the mind or open a repo.';
  var FREE_LINE = 'Free forever, no account.';
  var WRITE_LATER = 'Writing to GitHub needs your own sign-in; coming later, always opt-in.';
  var STOP_LINE = 'Stopped after 3 seconds.';
  var OFFLINE = 'Hearth runs offline';
  var MAX_MS = 3000;
  var MAX_LINES = 200;
  var MAX_BYTES = 20 * 1024;
  var NS = 'http://www.w3.org/2000/svg';

  var host = null;
  var editor = null;
  var outEl = null;
  var mindEl = null;
  var useBtn = null;
  var filesEl = null;
  var sourceEl = null;
  var diffEl = null;
  var rateEl = null;
  var ledgerEl = null;
  var pythonBtn = null;
  var langSel = null;
  var repoInput = null;
  var stage = null;
  var linesEl = null;
  var workers = [];
  var timers = [];
  var memRows = [];
  var netLog = [];
  var runs = 0;
  var lastOutput = '';
  var lastReply = '';
  var fromMind = false;
  var editedAfterMind = false;
  var githubBase = '';
  var githubOriginal = '';
  var panelOpen = false;
  var pythonWarned = false;
  var lastRun = Promise.resolve();

  function doc() { return root.document; }

  function roomShut() {
    var q = root.QuietRoom;
    if (!q || typeof q.isActive !== 'function') return false;
    try { return q.isActive() === true; } catch (e) { return true; }
  }

  function el(tag, cls, text) {
    var node = doc().createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function btn(id, word, press) {
    var b = el('button', 'fl-hearth-btn', word);
    b.type = 'button';
    if (id) b.id = id;
    if (press) b.addEventListener('click', press);
    return b;
  }

  function storage() {
    try { return root.localStorage || null; } catch (e) { return null; }
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

  function capText(text) {
    var s = String(text || '');
    if (s.length <= MAX_BYTES) return s;
    return s.slice(0, MAX_BYTES) + '\nOutput stopped at 20 KB.';
  }

  function capLines(lines) {
    var out = [];
    var bytes = 0;
    var i;
    var list = Array.isArray(lines) ? lines : [];
    for (i = 0; i < list.length; i++) {
      if (out.length >= MAX_LINES) {
        out.push('Output stopped at 200 lines.');
        break;
      }
      var row = String(list[i]);
      if (bytes + row.length > MAX_BYTES) {
        out.push(row.slice(0, Math.max(0, MAX_BYTES - bytes)));
        out.push('Output stopped at 20 KB.');
        break;
      }
      out.push(row);
      bytes += row.length + 1;
    }
    return out;
  }

  function showLine(value) {
    if (typeof value === 'string') return value;
    if (value == null || typeof value === 'number' || typeof value === 'boolean') return String(value);
    try { return JSON.stringify(value); } catch (e) { return String(value); }
  }

  function workerSource(code) {
    return [
      '"use strict";',
      'function __refuse(){ throw new Error(' + JSON.stringify(OFFLINE) + '); }',
      'self.fetch = __refuse;',
      'self.XMLHttpRequest = __refuse;',
      'self.importScripts = __refuse;',
      'self.WebSocket = __refuse;',
      'var __lines = [];',
      'function __show(a){',
      '  if (typeof a === "string") return a;',
      '  if (a == null || typeof a === "number" || typeof a === "boolean") return String(a);',
      '  try { return JSON.stringify(a); } catch (e) { return String(a); }',
      '}',
      'function __push(args){',
      '  var parts = [];',
      '  var i;',
      '  for (i = 0; i < args.length; i++) parts.push(__show(args[i]));',
      '  __lines.push(parts.join(" "));',
      '}',
      'self.console = {',
      '  log: function () { __push(arguments); },',
      '  error: function () { __push(arguments); },',
      '  warn: function () { __push(arguments); },',
      '  info: function () { __push(arguments); }',
      '};',
      'var __value;',
      'try {',
      '  __value = (function () {',
      String(code || ''),
      '  }).call(self);',
      '} catch (e) {',
      '  __lines.push(String(e && e.message || e));',
      '}',
      'var __shown = (__value == null) ? "" : __show(__value);',
      'self.postMessage({ ok: true, lines: __lines, value: __shown });'
    ].join('\n');
  }

  function trackTimer(id) {
    timers.push(id);
    return id;
  }

  function clearTimers() {
    var i;
    for (i = 0; i < timers.length; i++) {
      try { clearTimeout(timers[i]); } catch (e) {}
    }
    timers = [];
  }

  function terminateAll() {
    var i;
    clearTimers();
    for (i = 0; i < workers.length; i++) {
      try { workers[i].terminate(); } catch (e) {}
    }
    workers = [];
    var frame = stage && stage.querySelector('iframe');
    if (frame && frame.parentNode) frame.parentNode.removeChild(frame);
  }

  function workerCount() { return workers.length; }

  function finishWorker(worker, url, done) {
    try { worker.terminate(); } catch (e) {}
    var i = workers.indexOf(worker);
    if (i >= 0) workers.splice(i, 1);
    if (url) {
      try { URL.revokeObjectURL(url); } catch (e2) {}
    }
    if (done) done();
  }

  function runJS(code) {
    if (roomShut()) return Promise.resolve({ ok: false, lines: ['The Quiet Room stays shut.'], value: '' });
    if (typeof root.Worker !== 'function' || typeof root.Blob !== 'function' || !root.URL || !root.URL.createObjectURL) {
      return Promise.resolve({ ok: false, lines: ['This device has no worker for Hearth.'], value: '' });
    }
    return new Promise(function (resolve) {
      var blob = new Blob([workerSource(code)], { type: 'text/javascript' });
      var url = root.URL.createObjectURL(blob);
      var worker = new root.Worker(url);
      workers.push(worker);
      var finished = false;
      function finish(result) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        finishWorker(worker, url);
        resolve(result);
      }
      var timer = trackTimer(setTimeout(function () {
        finish({ ok: false, stopped: true, lines: [STOP_LINE], value: '' });
      }, MAX_MS));
      worker.onmessage = function (ev) {
        var data = ev.data || {};
        finish({
          ok: data.ok !== false,
          stopped: false,
          lines: capLines(data.lines || []),
          value: data.value || ''
        });
      };
      worker.onerror = function () {
        finish({ ok: false, stopped: false, lines: ['The sketch stopped.'], value: '' });
      };
    });
  }

  function pythonChoice() {
    var ls = storage();
    if (!ls) return '';
    try { return ls.getItem(PYTHON_KEY) || ''; } catch (e) { return ''; }
  }

  function rememberPython() {
    var ls = storage();
    if (!ls) return;
    try { ls.setItem(PYTHON_KEY, 'on'); } catch (e) {}
  }

  function onCellular() {
    var c = root.navigator && root.navigator.connection;
    if (!c) return false;
    if (c.saveData) return true;
    var kind = String(c.type || '');
    if (kind === 'cellular') return true;
    var slow = String(c.effectiveType || '');
    return slow === 'slow-2g' || slow === '2g';
  }

  function runPython(code) {
    if (roomShut()) return Promise.resolve({ ok: false, lines: ['The Quiet Room stays shut.'], value: '' });
    if (typeof root.__flHearthPythonFixture === 'function') {
      try {
        var fixed = root.__flHearthPythonFixture(String(code || ''));
        return Promise.resolve({
          ok: !fixed || fixed.ok !== false,
          lines: capLines((fixed && fixed.lines) || []),
          value: fixed && fixed.value || ''
        });
      } catch (e) {
        return Promise.resolve({ ok: false, lines: [String(e && e.message || e)], value: '' });
      }
    }
    return verifyPythonPin().then(function () {
      return runPythonWorker(code);
    }, function (err) {
      return { ok: false, lines: [String(err && err.message || err)], value: '' };
    });
  }

  function verifyPythonPin() {
    noteNet(PY_URL, { Accept: 'text/javascript' });
    return root.fetch(PY_URL, { method: 'GET' }).then(function (res) {
      if (!res.ok) throw new Error('Python did not download.');
      return res.arrayBuffer();
    }).then(function (buf) {
      return root.crypto.subtle.digest('SHA-256', buf).then(function (dig) {
        var hex = toHex(new Uint8Array(dig));
        if (hex !== PY_SHA) throw new Error('Python file did not match the pin. Nothing ran.');
        return true;
      });
    });
  }

  function pythonWorkerSource() {
    return [
      'self.onmessage = function (ev) {',
      '  var data = ev.data || {};',
      '  try {',
      '    importScripts(data.url);',
      '    if (typeof loadPyodide !== "function") throw new Error("Python did not load");',
      '    var lines = [];',
      '    loadPyodide({ indexURL: data.indexURL }).then(function (py) {',
      '      if (py.setStdout) {',
      '        py.setStdout({ batched: function (s) { lines.push(String(s).replace(/\\n$/, "")); } });',
      '      }',
      '      var value;',
      '      try { value = py.runPython(String(data.code || "")); }',
      '      catch (e) { lines.push(String(e && e.message || e)); }',
      '      var shown = (value == null) ? "" : String(value);',
      '      if (shown && !lines.length) lines.push(shown);',
      '      self.postMessage({ ok: true, lines: lines, value: shown });',
      '    }).catch(function (e) {',
      '      self.postMessage({ ok: false, lines: [String(e && e.message || e)], value: "" });',
      '    });',
      '  } catch (e) {',
      '    self.postMessage({ ok: false, lines: [String(e && e.message || e)], value: "" });',
      '  }',
      '};'
    ].join('\n');
  }

  function runPythonWorker(code) {
    return new Promise(function (resolve) {
      var blob = new Blob([pythonWorkerSource()], { type: 'text/javascript' });
      var url = root.URL.createObjectURL(blob);
      var worker = new root.Worker(url);
      workers.push(worker);
      var finished = false;
      function finish(result) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        finishWorker(worker, url);
        resolve(result);
      }
      var timer = trackTimer(setTimeout(function () {
        finish({ ok: false, stopped: true, lines: [STOP_LINE], value: '' });
      }, MAX_MS));
      worker.onmessage = function (ev) {
        var data = ev.data || {};
        finish({
          ok: data.ok !== false,
          stopped: false,
          lines: capLines(data.lines || []),
          value: data.value || ''
        });
      };
      worker.onerror = function () {
        finish({ ok: false, lines: ['Python stopped.'], value: '' });
      };
      worker.postMessage({ url: PY_URL, indexURL: PY_INDEX, code: String(code || '') });
    });
  }

  function runShow(html) {
    var d = doc();
    if (!d || roomShut()) return Promise.resolve({ ok: false, lines: ['Nothing to show.'], value: '' });
    return new Promise(function (resolve) {
      if (stage) {
        var old = stage.querySelector('iframe');
        if (old && old.parentNode) old.parentNode.removeChild(old);
      }
      var frame = d.createElement('iframe');
      frame.setAttribute('sandbox', 'allow-scripts');
      frame.setAttribute('title', 'Hearth sketch');
      frame.className = 'fl-hearth-frame';
      if (stage) stage.appendChild(frame);
      var finished = false;
      function finish(line) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        root.removeEventListener('message', onMsg);
        if (frame.parentNode) frame.parentNode.removeChild(frame);
        resolve({ ok: !line || line === '', lines: line ? [line] : ['Sketch closed.'], value: '' });
      }
      function onMsg(ev) {
        var data = ev.data || {};
        if (data.hearth !== 'storage' && data.hearth !== 'show') return;
        if (data.error) finish(String(data.error));
        else finish(data.line || '');
      }
      root.addEventListener('message', onMsg);
      var timer = trackTimer(setTimeout(function () { finish(STOP_LINE); }, MAX_MS));
      frame.srcdoc = String(html || '');
    });
  }

  function readLedger() {
    var ls = storage();
    if (!ls) return memRows.slice();
    try {
      var raw = ls.getItem(LEDGER_KEY);
      var rows = raw ? JSON.parse(raw) : [];
      return Array.isArray(rows) ? rows : [];
    } catch (e) { return []; }
  }

  function writeLedger(rows) {
    var ls = storage();
    if (!ls) { memRows = rows.slice(); return; }
    try { ls.setItem(LEDGER_KEY, JSON.stringify(rows)); } catch (e) {}
  }

  function mindName() {
    var ls = storage();
    try {
      var n = ls && ls.getItem('fl_mindName');
      if (n && String(n).trim()) return String(n).trim().slice(0, 40);
    } catch (e) {}
    return 'This mind';
  }

  function fingerprints() {
    var core = root.FLSnowflakeCore;
    var empty = { deviceFp: '', mindFp: '', mindLabel: mindName() };
    if (!core || typeof core.ensureIdentity !== 'function' || typeof core.deviceFp !== 'function' || typeof core.mindFp !== 'function') {
      return Promise.resolve(empty);
    }
    return core.ensureIdentity().then(function (id) {
      if (!id || !id.keyPair) return empty;
      return core.deviceFp(id.keyPair.publicKey).then(function (dfp) {
        return core.mindFp(dfp, empty.mindLabel).then(function (mfp) {
          return { deviceFp: dfp || '', mindFp: mfp || '', mindLabel: empty.mindLabel };
        });
      });
    }).catch(function () { return empty; });
  }

  function keep(fields) {
    if (roomShut()) return Promise.resolve(null);
    var code = String(fields && fields.code || '');
    var at = (fields && fields.at) || new Date().toISOString();
    return sha256Hex(code).then(function (hash) {
      return fingerprints().then(function (fp) {
        return sha256Hex(at + '\n' + hash + '\n' + String(fields && fields.parent || '')).then(function (idHash) {
          var rows = readLedger();
          var id = (idHash || ('row' + rows.length)).slice(0, 12);
          var guard = 0;
          while (rows.some(function (row) { return row.id === id; }) && guard < 5) {
            id = (id + guard).slice(0, 12);
            guard += 1;
          }
          var author = (fields && fields.author) || 'person';
          if (author !== 'person' && author !== 'mind' && author !== 'both') author = 'person';
          var row = {
            id: id,
            lang: String(fields && fields.lang || 'js'),
            code: code,
            output: capText(fields && fields.output || ''),
            at: at,
            author: author,
            mindLabel: (fields && fields.mindLabel) || fp.mindLabel,
            deviceFp: fp.deviceFp,
            mindFp: fp.mindFp,
            sha256: hash,
            parent: (fields && fields.parent) || ''
          };
          rows.push(row);
          writeLedger(rows);
          paintLedger();
          return row;
        });
      });
    });
  }

  function fork(id) {
    var rows = readLedger();
    var found = null;
    var i;
    for (i = 0; i < rows.length; i++) if (rows[i].id === id) found = rows[i];
    if (!found) return Promise.resolve(null);
    return keep({
      lang: found.lang,
      code: found.code,
      output: '',
      author: 'person',
      parent: found.id
    });
  }

  function ledger() { return readLedger(); }

  function exportJSON() {
    return JSON.stringify(readLedger(), null, 2);
  }

  function verifyRow(row) {
    return sha256Hex(row && row.code || '').then(function (hash) {
      return hash === (row && row.sha256);
    });
  }

  function parseRepo(url) {
    var u;
    try { u = new root.URL(String(url || '')); } catch (e) { return null; }
    var hostName = String(u.hostname || '').toLowerCase();
    if (hostName === 'www.github.com') hostName = 'github.com';
    if (hostName !== 'github.com') return null;
    var parts = u.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    var owner = parts[0];
    var repo = String(parts[1] || '').replace(/\.git$/, '');
    if (!owner || !repo) return null;
    var ref = '';
    var path = '';
    var kind = 'repo';
    if (parts[2] === 'tree' || parts[2] === 'blob') {
      kind = parts[2];
      ref = parts[3] || '';
      path = parts.slice(4).map(function (bit) { return decodeURIComponent(bit); }).join('/');
    }
    return { owner: owner, repo: repo, ref: ref, path: path, kind: kind };
  }

  function proposalDiff(before, after) {
    var a = String(before || '').replace(/\r\n/g, '\n').split('\n');
    var b = String(after || '').replace(/\r\n/g, '\n').split('\n');
    var out = [];
    var n = a.length > b.length ? a.length : b.length;
    var i;
    for (i = 0; i < n; i++) {
      if (a[i] === b[i]) continue;
      if (i < a.length) out.push('- ' + a[i]);
      if (i < b.length) out.push('+ ' + b[i]);
    }
    if (!out.length) return 'No local change to propose.';
    return out.join('\n');
  }

  function paintDiff(before, after) {
    if (!diffEl) return proposalDiff(before, after);
    diffEl.textContent = WRITE_LATER + '\n' + proposalDiff(before, after);
    return diffEl.textContent;
  }

  function noteNet(url, headers) {
    var copy = {};
    var k;
    var src = headers || {};
    for (k in src) if (Object.prototype.hasOwnProperty.call(src, k)) copy[k] = src[k];
    netLog.push({ url: String(url), headers: copy });
  }

  function askFirstOn() {
    var tool = root.FLWebTool;
    if (tool && typeof tool.isAskFirst === 'function') return !!tool.isAskFirst();
    try { return !!(storage() && storage().getItem('fl_searchAskFirst') === 'true'); } catch (e) { return false; }
  }

  function allowRepo() {
    if (!askFirstOn()) return Promise.resolve(true);
    if (roomShut()) return Promise.resolve(false);
    var consent = root.FLToolConsent;
    if (!consent || typeof consent.requestConsent !== 'function') return Promise.resolve(false);
    return Promise.resolve(consent.requestConsent({
      tool: 'web-tool',
      action: 'search',
      detail: 'github',
      trustTier: 'seed',
      message: 'I would like to open a public GitHub repo. Okay?',
      allowLabel: 'Open the repo',
      denyLabel: 'Not now'
    })).then(function (yes) { return !!yes; }, function () { return false; });
  }

  function githubHeaders() {
    return { Accept: 'application/vnd.github+json' };
  }

  function githubFetch(url, headers) {
    noteNet(url, headers);
    return root.fetch(url, { method: 'GET', headers: headers });
  }

  function repoMeta(parsed) {
    var url = 'https://api.github.com/repos/' + encodeURIComponent(parsed.owner) + '/' + encodeURIComponent(parsed.repo);
    return githubFetch(url, githubHeaders()).then(function (res) {
      paintRate(res);
      if (!res.ok) throw new Error('GitHub did not open that repo.');
      return res.json();
    });
  }

  function paintRate(res) {
    if (!rateEl || !res || !res.headers || !res.headers.get) return;
    var left = res.headers.get('X-RateLimit-Remaining');
    if (left == null || left === '') rateEl.textContent = 'GitHub did not say how many asks are left.';
    else rateEl.textContent = 'GitHub asks left this hour: ' + left;
  }

  function contentsUrl(parsed, path) {
    var url = 'https://api.github.com/repos/' + encodeURIComponent(parsed.owner) + '/' + encodeURIComponent(parsed.repo) + '/contents';
    if (path) url += '/' + path.split('/').map(encodeURIComponent).join('/');
    if (parsed.ref) url += '?ref=' + encodeURIComponent(parsed.ref);
    return url;
  }

  function rawUrl(parsed, path) {
    var ref = parsed.ref || 'HEAD';
    return 'https://raw.githubusercontent.com/' + encodeURIComponent(parsed.owner) + '/' + encodeURIComponent(parsed.repo) + '/' + encodeURIComponent(ref) + '/' + path.split('/').map(encodeURIComponent).join('/');
  }

  function openRepo(url) {
    var parsed = parseRepo(url);
    if (!parsed) return Promise.resolve({ ok: false, line: 'That is not a public github.com repo URL.' });
    return allowRepo().then(function (yes) {
      if (!yes) return { ok: false, line: 'Not now. The repo was not opened.' };
      var ready = parsed.ref ? Promise.resolve(parsed) : repoMeta(parsed).then(function (meta) {
        parsed.ref = String(meta && meta.default_branch || 'main');
        return parsed;
      });
      return ready.then(function () {
        return githubFetch(contentsUrl(parsed, parsed.kind === 'blob' ? parsed.path : parsed.path), githubHeaders());
      }).then(function (res) {
        paintRate(res);
        if (!res.ok) throw new Error('GitHub did not list that path.');
        return res.json().then(function (body) { return { parsed: parsed, body: body }; });
      });
    }).then(function (result) {
      if (!result || result.ok === false) return result;
      if (Array.isArray(result.body)) {
        paintFiles(result.parsed, result.body);
        return { ok: true, files: result.body.map(function (row) { return row.name; }) };
      }
      return openFile(result.parsed, result.body);
    }).catch(function (err) {
      return { ok: false, line: String(err && err.message || err) };
    });
  }

  function paintFiles(parsed, rows) {
    if (!filesEl) return;
    while (filesEl.firstChild) filesEl.removeChild(filesEl.firstChild);
    var i;
    for (i = 0; i < rows.length; i++) {
      (function (row) {
        var name = String(row.name || row.path || 'file');
        var b = btn('', name, function () {
          openFile(parsed, row);
        });
        b.className = 'fl-hearth-btn';
        filesEl.appendChild(b);
      })(rows[i]);
    }
  }

  function openFile(parsed, row) {
    var path = String(row.path || parsed.path || '');
    var fileUrl = rawUrl(parsed, path);
    return githubFetch(fileUrl, { Accept: 'text/plain' }).then(function (res) {
      if (!res.ok) throw new Error('The file did not open.');
      return res.text();
    }).then(function (text) {
      githubBase = text;
      githubOriginal = text;
      if (editor) {
        editor.value = text;
        editor.readOnly = true;
        paintLines();
      }
      if (sourceEl) sourceEl.textContent = 'from ' + parsed.owner + '/' + parsed.repo + '@' + String(row.sha || parsed.ref || '') + ' ' + path;
      paintDiff(githubOriginal, editor ? editor.value : text);
      var propose = doc() && doc().getElementById('flHearthPropose');
      if (propose) propose.disabled = true;
      return { ok: true, readOnly: true, text: text, sha: row.sha || '' };
    });
  }

  function extractCode(text) {
    var re = /```[a-zA-Z0-9]*\n([\s\S]*?)```/g;
    var last = null;
    var m;
    var src = String(text || '');
    while ((m = re.exec(src))) last = m[1];
    if (last != null) return last.replace(/\n$/, '');
    return src.trim();
  }

  function askMind(kind) {
    var code = editor ? editor.value : '';
    var user = (kind === 'explain' ? 'Explain this code plainly.' : 'Here is the code and the last output. Help me.') +
      '\n\nCode:\n' + code + '\n\nLast output:\n' + (lastOutput || '');
    var FL = root.FreeLattice;
    if (!FL || typeof FL.callAI !== 'function') {
      if (mindEl) mindEl.textContent = 'No mind is connected on this device yet.';
      return Promise.resolve({ ok: false, line: 'No mind is connected on this device yet.' });
    }
    return new Promise(function (resolve) {
      var done = false;
      function finish(text, err) {
        if (done) return;
        done = true;
        if (err || text == null || text === '') {
          if (mindEl) mindEl.textContent = 'The mind did not answer.';
          resolve({ ok: false, line: 'The mind did not answer.' });
          return;
        }
        lastReply = String(text);
        if (mindEl) mindEl.textContent = lastReply;
        if (useBtn) useBtn.hidden = false;
        resolve({ ok: true, text: lastReply, system: SYSTEM });
      }
      try {
        FL.callAI(SYSTEM, user, {
          silent: true,
          maxTokens: 800,
          temperature: 0.4,
          callback: function (text, err) { finish(text, err); }
        });
      } catch (e) {
        finish('', e && e.message || e);
      }
    });
  }

  function useThis() {
    if (!lastReply || !editor) return '';
    editor.readOnly = false;
    editor.value = extractCode(lastReply);
    fromMind = true;
    editedAfterMind = false;
    paintLines();
    if (sourceEl && !githubOriginal) sourceEl.textContent = 'From the mind. Nothing has run.';
    return editor.value;
  }

  function currentAuthor() {
    if (fromMind && editedAfterMind) return 'both';
    if (fromMind) return 'mind';
    return 'person';
  }

  function paintOut(result) {
    var lines = capLines(result && result.lines || []);
    var text = lines.join('\n');
    if (result && result.value && text.indexOf(result.value) === -1) {
      text = text ? (text + '\n' + result.value) : result.value;
    }
    text = capText(text);
    lastOutput = text;
    if (outEl) outEl.textContent = text || 'Done. No output.';
    return text;
  }

  function onRun() {
    var code = editor ? editor.value : '';
    var lang = langSel ? langSel.value : 'js';
    runs += 1;
    var job;
    if (lang === 'html') job = runShow(code);
    else if (lang === 'python') job = runPython(code);
    else job = runJS(code);
    lastRun = job.then(function (result) { return paintOut(result); });
    return lastRun;
  }

  function onPythonTap() {
    if (pythonChoice() !== 'on' && onCellular() && !pythonWarned) {
      pythonWarned = true;
      if (pythonBtn) pythonBtn.textContent = 'Download Python on cellular (about 10 MB)';
      if (outEl) outEl.textContent = 'This network looks like a phone network. Tap again to download about 10 MB once.';
      return Promise.resolve({ ok: false, warned: true });
    }
    rememberPython();
    if (pythonBtn) pythonBtn.textContent = 'Python is allowed on this device';
    return Promise.resolve({ ok: true, remembered: true });
  }

  function paintLines() {
    if (!linesEl || !editor) return;
    var n = String(editor.value || '').split('\n').length;
    var nums = [];
    var i;
    for (i = 1; i <= n; i++) nums.push(String(i));
    linesEl.textContent = nums.join('\n');
  }

  function paintLedger() {
    if (!ledgerEl) return;
    var rows = readLedger();
    var bits = rows.map(function (row) {
      return row.id + ' ' + row.lang + (row.parent ? ' parent ' + row.parent : '') + ' ' + row.author;
    });
    ledgerEl.textContent = bits.length ? bits.join('\n') : 'No snippets kept yet.';
  }

  function ensureStyle() {
    var d = doc();
    if (!d || d.getElementById('flHearthStyle')) return;
    var style = d.createElement('style');
    style.id = 'flHearthStyle';
    style.textContent = [
      '#flHearthHost{box-sizing:border-box;max-width:100%;margin:8px 0;padding:12px;font-size:14px;color:var(--text-primary,#e6ebf5);background:var(--glass-bg,rgba(16,18,36,.88));border:1px solid var(--glass-border,rgba(255,255,255,.15));border-radius:var(--btn-radius,12px);}',
      '#flHearthHost *{box-sizing:border-box;}',
      '.fl-hearth-note,.fl-hearth-out,.fl-hearth-mind,.fl-hearth-source,.fl-hearth-diff,.fl-hearth-ledger{margin:8px 0;max-width:100%;overflow-wrap:anywhere;white-space:pre-wrap;font-size:14px;}',
      '.fl-hearth-editor-row{display:flex;gap:8px;max-width:100%;}',
      '#flHearthLines{margin:0;flex:0 0 auto;font:14px/1.4 ui-monospace,monospace;opacity:.7;}',
      '#flHearthEditor{flex:1 1 auto;width:auto;min-width:0;min-height:160px;font:14px/1.4 ui-monospace,monospace;color:inherit;background:transparent;border:1px solid var(--glass-border,rgba(255,255,255,.15));border-radius:8px;padding:8px;}',
      '.fl-hearth-controls,.fl-hearth-files{display:flex;flex-wrap:wrap;gap:8px;max-width:100%;}',
      '.fl-hearth-btn{min-height:44px;min-width:44px;padding:10px 12px;font:inherit;font-size:14px;color:inherit;background:var(--glass-bg,transparent);border:1px solid var(--glass-border,rgba(255,255,255,.2));border-radius:var(--btn-radius,8px);cursor:pointer;appearance:none;-webkit-appearance:none;}',
      '.fl-hearth-btn:disabled{cursor:default;opacity:.6;}',
      '#flHearthRepo{width:100%;min-height:44px;font-size:14px;color:inherit;background:transparent;border:1px solid var(--glass-border,rgba(255,255,255,.15));border-radius:8px;padding:8px;}',
      '.fl-hearth-frame{width:100%;height:180px;border:0;max-width:100%;}',
      '@media (prefers-reduced-motion: reduce){#flHearthHost{animation:none;}}'
    ].join('');
    d.head.appendChild(style);
  }

  function icon() {
    var svg = doc().createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '22');
    svg.setAttribute('height', '22');
    svg.setAttribute('aria-hidden', 'true');
    var brace = doc().createElementNS(NS, 'path');
    brace.setAttribute('d', 'M8 4H6v16h2M16 4h2v16h-2');
    brace.setAttribute('fill', 'none');
    brace.setAttribute('stroke', 'currentColor');
    brace.setAttribute('stroke-width', '1.6');
    var flame = doc().createElementNS(NS, 'path');
    flame.setAttribute('d', 'M12 19c2 0 4-1.4 4-3.6 0-2.4-2-3.2-2-5.4 0 2-2.2 2.4-3.2 1.2C9.6 13.6 8 14.4 8 16.2 8 17.8 9.6 19 12 19z');
    flame.setAttribute('fill', 'currentColor');
    svg.appendChild(brace);
    svg.appendChild(flame);
    return svg;
  }

  function mountRow(menu) {
    var d = doc();
    if (!menu || !d || roomShut()) return null;
    if (menu.querySelector('#flHearthAdd')) return menu.querySelector('#flHearthAdd');
    var button = d.createElement('button');
    button.type = 'button';
    button.id = 'flHearthAdd';
    button.className = 'fl-add-item';
    button.setAttribute('data-marker', VERSION);
    button.setAttribute('aria-label', 'Hearth: write and run code');
    var copy = d.createElement('span');
    copy.className = 'fl-add-copy';
    var word = d.createElement('span');
    word.className = 'fl-add-word';
    word.textContent = 'Hearth';
    copy.appendChild(word);
    button.appendChild(icon());
    button.appendChild(copy);
    var snow = menu.querySelector('#flSnowflakeAdd');
    var search = menu.querySelector('#flChatAddSearch');
    var after = snow || search;
    if (after && after.parentNode === menu) {
      if (after.nextSibling) menu.insertBefore(button, after.nextSibling);
      else menu.appendChild(button);
    } else menu.appendChild(button);
    button.addEventListener('click', function () {
      if (root.FLChatBottom && typeof root.FLChatBottom.close === 'function') {
        try { root.FLChatBottom.close(); } catch (e) {}
      }
      openPanel();
    });
    return button;
  }

  function watchMenu() {
    var d = doc();
    if (!d || roomShut()) return;
    function mount() {
      var menu = d.getElementById('flChatAddMenu');
      if (menu) mountRow(menu);
    }
    mount();
    if (!d.body || typeof root.MutationObserver !== 'function') return;
    var obs = new root.MutationObserver(function () { mount(); });
    try { obs.observe(d.body, { childList: true, subtree: true }); } catch (e) {}
  }

  function ensureHost() {
    var d = doc();
    if (!d || host || roomShut()) return host;
    ensureStyle();
    host = el('section', 'fl-hearth');
    host.id = 'flHearthHost';
    host.hidden = true;
    host.setAttribute('data-marker', VERSION);
    host.appendChild(el('h2', 'fl-hearth-title', 'Hearth'));
    host.appendChild(el('p', 'fl-hearth-note', HONEST));
    host.appendChild(el('p', 'fl-hearth-note', FREE_LINE));
    var row = el('div', 'fl-hearth-editor-row');
    linesEl = d.createElement('pre');
    linesEl.id = 'flHearthLines';
    editor = d.createElement('textarea');
    editor.id = 'flHearthEditor';
    editor.setAttribute('aria-label', 'Hearth code');
    editor.spellcheck = false;
    editor.addEventListener('input', function () {
      if (fromMind) editedAfterMind = true;
      if (githubOriginal && editor.value !== githubOriginal) paintDiff(githubOriginal, editor.value);
      paintLines();
    });
    row.appendChild(linesEl);
    row.appendChild(editor);
    host.appendChild(row);
    langSel = d.createElement('select');
    langSel.id = 'flHearthLang';
    langSel.setAttribute('aria-label', 'Language');
    [['js', 'JavaScript'], ['python', 'Python'], ['html', 'HTML sketch']].forEach(function (pair) {
      var opt = d.createElement('option');
      opt.value = pair[0];
      opt.textContent = pair[1];
      langSel.appendChild(opt);
    });
    host.appendChild(langSel);
    var controls = el('div', 'fl-hearth-controls');
    controls.appendChild(btn('flHearthRun', 'Run', function () { onRun(); }));
    controls.appendChild(btn('flHearthShow', 'Show it', function () {
      runs += 1;
      lastRun = runShow(editor.value).then(paintOut);
    }));
    controls.appendChild(btn('flHearthExplain', 'Explain', function () { askMind('explain'); }));
    controls.appendChild(btn('flHearthAsk', 'Ask the mind', function () { askMind('ask'); }));
    useBtn = btn('flHearthUse', 'Use this', function () { useThis(); });
    useBtn.hidden = true;
    controls.appendChild(useBtn);
    controls.appendChild(btn('flHearthKeep', 'Keep this', function () {
      keep({ lang: langSel.value, code: editor.value, output: lastOutput, author: currentAuthor() });
    }));
    controls.appendChild(btn('flHearthFork', 'Fork', function () {
      var rows = readLedger();
      var last = rows[rows.length - 1];
      if (last) fork(last.id);
    }));
    controls.appendChild(btn('flHearthExport', 'Export JSON', function () {
      var box = d.getElementById('flHearthExportOut');
      if (box) box.textContent = exportJSON();
    }));
    pythonBtn = btn('flHearthPython', 'Add Python (about 10 MB, once)', function () { onPythonTap(); });
    controls.appendChild(pythonBtn);
    controls.appendChild(btn('flHearthClose', 'Close', function () { closePanel(); }));
    host.appendChild(controls);
    outEl = el('pre', 'fl-hearth-out', '');
    outEl.id = 'flHearthOut';
    mindEl = el('pre', 'fl-hearth-mind', '');
    mindEl.id = 'flHearthMind';
    host.appendChild(outEl);
    host.appendChild(mindEl);
    repoInput = d.createElement('input');
    repoInput.id = 'flHearthRepo';
    repoInput.type = 'text';
    repoInput.setAttribute('aria-label', 'Paste a public repo URL');
    repoInput.placeholder = 'Paste a public repo URL';
    host.appendChild(repoInput);
    var repoRow = el('div', 'fl-hearth-controls');
    repoRow.appendChild(btn('flHearthOpenRepo', 'Open repo', function () { openRepo(repoInput.value); }));
    var propose = btn('flHearthPropose', 'Propose a change', null);
    propose.disabled = true;
    repoRow.appendChild(propose);
    host.appendChild(repoRow);
    rateEl = el('p', 'fl-hearth-note', '');
    rateEl.id = 'flHearthRate';
    sourceEl = el('p', 'fl-hearth-source', '');
    sourceEl.id = 'flHearthSource';
    filesEl = el('div', 'fl-hearth-files');
    filesEl.id = 'flHearthFiles';
    diffEl = el('pre', 'fl-hearth-diff', WRITE_LATER);
    diffEl.id = 'flHearthDiff';
    stage = el('div', 'fl-hearth-stage');
    stage.id = 'flHearthStage';
    ledgerEl = el('pre', 'fl-hearth-ledger', 'No snippets kept yet.');
    ledgerEl.id = 'flHearthLedger';
    var exportOut = el('pre', 'fl-hearth-out', '');
    exportOut.id = 'flHearthExportOut';
    host.appendChild(rateEl);
    host.appendChild(sourceEl);
    host.appendChild(filesEl);
    host.appendChild(diffEl);
    host.appendChild(stage);
    host.appendChild(ledgerEl);
    host.appendChild(exportOut);
    var chat = d.getElementById('chatMessages');
    if (chat && chat.parentNode) chat.parentNode.insertBefore(host, chat);
    else d.body.appendChild(host);
    paintLines();
    return host;
  }

  function openPanel() {
    if (roomShut()) return null;
    ensureHost();
    if (!host) return null;
    host.hidden = false;
    panelOpen = true;
    return host;
  }

  function closePanel() {
    panelOpen = false;
    terminateAll();
    if (host) host.hidden = true;
  }

  function boot() {
    if (roomShut()) return;
    ensureHost();
    watchMenu();
    if (host) host.hidden = true;
    panelOpen = false;
  }

  var api = {
    VERSION: VERSION,
    SYSTEM: SYSTEM,
    HONEST: HONEST,
    FREE_LINE: FREE_LINE,
    WRITE_LATER: WRITE_LATER,
    STOP_LINE: STOP_LINE,
    PY_URL: PY_URL,
    PY_INDEX: PY_INDEX,
    PY_SHA: PY_SHA,
    PY_WASM_BYTES: PY_WASM_BYTES,
    netLog: netLog,
    runJS: runJS,
    runPython: runPython,
    runShow: runShow,
    keep: keep,
    fork: fork,
    ledger: ledger,
    exportJSON: exportJSON,
    verifyRow: verifyRow,
    parseRepo: parseRepo,
    proposalDiff: proposalDiff,
    paintDiff: paintDiff,
    openRepo: openRepo,
    askMind: askMind,
    useThis: useThis,
    extractCode: extractCode,
    openPanel: openPanel,
    closePanel: closePanel,
    mountRow: mountRow,
    workerCount: workerCount,
    runs: function () { return runs; },
    lastRun: function () { return lastRun; },
    allowRepo: allowRepo,
    askFirstOn: askFirstOn
  };

  root.FLHearth = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  if (doc()) {
    if (doc().readyState === 'loading') doc().addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
