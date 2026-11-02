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
  // 063b: four files, each pinned. The loader pin stays PY_SHA.
  var PY_CACHE = 'fl-hearth-python-v0.27.7';
  var PY_NAMES = ['pyodide.js', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json'];
  var PY_PINS = {
    'pyodide.js': 'b4cb23a53aba19c221659b9fb40a2f18281d685691dc06647fb0afd0681baf98',
    'pyodide.asm.wasm': 'a50dd1843f805a0b7c45b61037ee0d7b26dfe85efe0e18ef95a34ad24e401f5f',
    'python_stdlib.zip': '16611534726e5d8ac2bd8f926410b2dcb8d6f49aa24913463533b457a2115c16',
    'pyodide-lock.json': '9c45b916001a750f4102fc287494f3eab215909c7535c626a20db80fd6333e2c'
  };
  var PIN_MISS = 'Python file did not match the pin. Nothing ran.';
  var NOT_ADDED = 'Python is not added yet. Nothing ran.';
  var SYSTEM = "You are helping someone learn to code. Explain plainly. If you change code, show the whole new version. Say 'I don't know' when you don't.";
  var HONEST = 'Runs on this device. Nothing is sent unless you ask the mind or open a repo.';
  var FREE_LINE = 'Free forever, no account.';
  var WRITE_LATER = 'Writing to GitHub needs your own sign-in; coming later, always opt-in.';
  var STOP_LINE = 'Stopped after 3 seconds.';
  var OFFLINE = 'Hearth runs offline';
  var IMPORT_LINE = 'Hearth runs offline, so import() is closed';
  var MAX_MS = 3000;
  var MAX_LINES = 200;
  var MAX_BYTES = 20 * 1024;
  var CAPS_KEY = 'fl_hearthCaps';
  var MIND_CAPS_KEY = 'fl_hearthMindCaps';
  var SANDBOX_CSP = "default-src 'none'; script-src 'unsafe-inline' blob:; worker-src blob:; connect-src 'none'; img-src 'none'; style-src 'unsafe-inline'; frame-src 'none'; form-action 'none'";
  // before 063b: a dropped guard is test-only. The live policy stays connect-src 'none'.
  var SANDBOX_CSP_OPEN = "default-src 'none'; script-src 'unsafe-inline' blob:; worker-src blob:; connect-src http://127.0.0.1:* http://localhost:*; img-src 'none'; style-src 'unsafe-inline'; frame-src 'none'; form-action 'none'";
  // 063b: Python may read only the blob URLs created inside the iframe.
  var SANDBOX_CSP_PY = "default-src 'none'; script-src 'unsafe-inline' blob:; worker-src blob:; connect-src blob:; img-src 'none'; style-src 'unsafe-inline'; frame-src 'none'; form-action 'none'";
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
  var lastSandboxAttr = '';
  var capsBy = 'you';

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

  function sha256Buf(buf) {
    var subtle = root.crypto && root.crypto.subtle;
    if (!subtle || !subtle.digest) return Promise.resolve('');
    // digest can detach the buffer it is given. Hash a copy. The caller still owns buf.
    var copy = buf.slice(0);
    return subtle.digest('SHA-256', copy).then(function (dig) {
      return toHex(new Uint8Array(dig));
    });
  }

  function mbLabel(bytes) {
    var mb = Math.round((Number(bytes) / (1024 * 1024)) * 10) / 10;
    if (mb < 0) mb = 0;
    return mb.toFixed(1);
  }

  function showPyStatus(text) {
    var d = doc();
    var node = d && d.getElementById('flHearthPyStatus');
    if (!node) return;
    var line = text ? String(text) : '';
    node.textContent = line;
    node.hidden = !line;
  }

  var capsPainting = false;

  function paintCapsFooter(caps) {
    var d = doc();
    var node = d && d.getElementById('flHearthCapsUsed');
    if (!node) return;
    var used = caps || readCaps();
    node.hidden = false;
    node.textContent = 'Limits: ' + Math.round(used.ms / 1000) + ' s, ' + used.lines + ' lines, ' + Math.round(used.bytes / 1024) + ' KB';
  }

  function paintWho(caps) {
    var d = doc();
    var node = d && d.getElementById('flHearthCapsBy');
    if (!node) return;
    var mind = caps && caps.by === 'mind';
    node.hidden = !mind;
    node.textContent = mind ? 'set by the mind' : '';
  }

  function paintLimitFields(caps) {
    var d = doc();
    if (!d) return;
    capsPainting = true;
    var time = d.getElementById('flHearthCapTime');
    var lines = d.getElementById('flHearthCapLines');
    var kb = d.getElementById('flHearthCapBytes');
    if (time) time.value = String(Math.round(caps.ms / 1000));
    if (lines) lines.value = String(caps.lines);
    if (kb) kb.value = String(Math.round(caps.bytes / 1024));
    paintWho(caps);
    capsPainting = false;
  }

  function syncCapsFromInputs() {
    if (capsPainting) return;
    var d = doc();
    if (!d) return;
    var time = d.getElementById('flHearthCapTime');
    var lines = d.getElementById('flHearthCapLines');
    var kb = d.getElementById('flHearthCapBytes');
    var ms = clampNum(Number(time && time.value) * 1000, 1000, 60000);
    var lineCap = clampNum(lines && lines.value, 50, 5000);
    var bytes = clampNum(Number(kb && kb.value) * 1024, 5 * 1024, 500 * 1024);
    if (ms == null || lineCap == null || bytes == null) return;
    var caps = { ms: ms, lines: lineCap, bytes: bytes, by: 'you' };
    saveCaps(caps);
    paintWho(caps);
  }

  function proposedCaps(text) {
    var m = String(text || '').match(/Use limits:\s*(\d+)\s*s,\s*(\d+)\s*lines(?:\s*,\s*(\d+)\s*KB)?/i);
    if (!m) return null;
    var ms = clampNum(Number(m[1]) * 1000, 1000, 60000);
    var lines = clampNum(m[2], 50, 5000);
    if (ms == null || lines == null) return null;
    var bytes = null;
    if (m[3]) {
      bytes = clampNum(Number(m[3]) * 1024, 5 * 1024, 500 * 1024);
      if (bytes == null) return null;
    }
    return { ms: ms, lines: lines, bytes: bytes };
  }

  function applyProposed(proposal) {
    var current = readCaps();
    var next = {
      ms: proposal.ms,
      lines: proposal.lines,
      bytes: proposal.bytes == null ? current.bytes : proposal.bytes,
      by: 'mind'
    };
    saveCaps(next);
    paintLimitFields(next);
  }

  function offerMindCaps(text) {
    var d = doc();
    var proposal = proposedCaps(text);
    var chip = d && d.getElementById('flHearthMindChip');
    if (!proposal || !chip) return;
    var label = 'Use limits: ' + Math.round(proposal.ms / 1000) + ' s, ' + proposal.lines + ' lines';
    if (proposal.bytes != null) label += ', ' + Math.round(proposal.bytes / 1024) + ' KB';
    chip.textContent = label;
    chip.hidden = false;
    chip.onclick = function () { applyProposed(proposal); };
    var on = false;
    try { on = storage() && storage().getItem(MIND_CAPS_KEY) === 'true'; } catch (e) {}
    if (on) applyProposed(proposal);
  }

  function clampNum(n, min, max) {
    n = Number(n);
    if (!isFinite(n)) return null;
    if (n < min || n > max) return null;
    return n;
  }

  function readCaps() {
    var caps = { ms: MAX_MS, lines: MAX_LINES, bytes: MAX_BYTES, by: 'you' };
    var ls = storage();
    if (!ls) return caps;
    try {
      var raw = ls.getItem(CAPS_KEY);
      if (!raw) return caps;
      var parsed = JSON.parse(raw);
      var ms = clampNum(parsed.ms, 1000, 60000);
      var lines = clampNum(parsed.lines, 50, 5000);
      var bytes = clampNum(parsed.bytes, 5 * 1024, 500 * 1024);
      if (ms != null) caps.ms = ms;
      if (lines != null) caps.lines = lines;
      if (bytes != null) caps.bytes = bytes;
      if (parsed.by === 'mind') caps.by = 'mind';
    } catch (e) {}
    return caps;
  }

  function saveCaps(caps) {
    var ls = storage();
    if (!ls) return;
    try {
      ls.setItem(CAPS_KEY, JSON.stringify({
        ms: caps.ms,
        lines: caps.lines,
        bytes: caps.bytes,
        by: caps.by === 'mind' ? 'mind' : 'you'
      }));
    } catch (e) {}
  }

  function capText(text) {
    var max = readCaps().bytes;
    var s = String(text || '');
    if (s.length <= max) return s;
    return s.slice(0, max) + '\nOutput stopped at ' + Math.round(max / 1024) + ' KB.';
  }

  function capLines(lines) {
    var caps = readCaps();
    var out = [];
    var bytes = 0;
    var i;
    var list = Array.isArray(lines) ? lines : [];
    for (i = 0; i < list.length; i++) {
      if (out.length >= caps.lines) {
        out.push('Output stopped at ' + caps.lines + ' lines.');
        break;
      }
      var row = String(list[i]);
      if (bytes + row.length > caps.bytes) {
        out.push(row.slice(0, Math.max(0, caps.bytes - bytes)));
        out.push('Output stopped at ' + Math.round(caps.bytes / 1024) + ' KB.');
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

  // before 063b: workerSource built a same-origin worker for the parent page.
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
    var d = doc();
    clearTimers();
    for (i = 0; i < workers.length; i++) {
      try { workers[i].terminate(); } catch (e) {}
    }
    workers = [];
    // before 063b: only the show-it iframe on the stage was removed.
    if (d) {
      var frames = d.querySelectorAll('[data-hearth-sandbox], #flHearthStage iframe');
      for (i = 0; i < frames.length; i++) {
        if (frames[i].parentNode) frames[i].parentNode.removeChild(frames[i]);
      }
    }
  }

  function workerCount() {
    var d = doc();
    var frames = d ? d.querySelectorAll('[data-hearth-sandbox]').length : 0;
    return workers.length + frames;
  }

  function randomNonce() {
    var bytes = new Uint8Array(16);
    var i;
    if (root.crypto && root.crypto.getRandomValues) root.crypto.getRandomValues(bytes);
    else for (i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
    return toHex(bytes);
  }

  function cspForRun(dropFetch, python) {
    if (python) return SANDBOX_CSP_PY;
    return dropFetch ? SANDBOX_CSP_OPEN : SANDBOX_CSP;
  }

  function hostScript() {
    return [
      '(function () {',
      '  var ran = false;',
      '  function refuse() { throw new Error("Hearth runs offline"); }',
      '  function seal(dropFetch) {',
      '    var names = ["importScripts", "XMLHttpRequest", "WebSocket", "EventSource", "WebTransport", "BroadcastChannel", "indexedDB", "caches"];',
      '    if (!dropFetch) names.unshift("fetch");',
      '    var chain = [];',
      '    var obj = self;',
      '    while (obj) { chain.push(obj); try { obj = Object.getPrototypeOf(obj); } catch (e) { break; } }',
      '    var i, j, bag;',
      '    function door() {',
      '      var fn = function () { throw new Error("Hearth runs offline"); };',
      '      fn.open = fn; fn.deleteDatabase = fn; fn.databases = fn; fn.match = fn;',
      '      return fn;',
      '    }',
      '    for (i = 0; i < names.length; i++) {',
      '      bag = (names[i] === "indexedDB" || names[i] === "caches") ? door() : refuse;',
      '      for (j = 0; j < chain.length; j++) {',
      '        try { delete chain[j][names[i]]; } catch (e1) {}',
      '        try { Object.defineProperty(chain[j], names[i], { configurable: true, writable: true, value: bag }); } catch (e2) {}',
      '      }',
      '    }',
      '    try {',
      '      if (self.navigator) Object.defineProperty(self.navigator, "sendBeacon", { configurable: true, writable: true, value: refuse });',
      '    } catch (e3) {}',
      '    for (j = 1; j < chain.length; j++) { try { Object.freeze(chain[j]); } catch (e4) {} }',
      '  }',
      '  function build(code, caps) {',
      '    var drop = !!(caps && caps.dropFetch);',
      '    var maxLines = (caps && caps.lines) || 200;',
      '    var maxBytes = (caps && caps.bytes) || 20480;',
      '    var kbStop = Math.max(1, Math.round(maxBytes / 1024));',
      '    return [',
      '      "\\"use strict\\";",',
      '      "function refuse(){ throw new Error(\\"Hearth runs offline\\"); }",',
      '      "function seal(dropFetch){",',
      '      "  var names=[\\"importScripts\\",\\"XMLHttpRequest\\",\\"WebSocket\\",\\"EventSource\\",\\"WebTransport\\",\\"BroadcastChannel\\",\\"indexedDB\\",\\"caches\\"];",',
      '      "  if(!dropFetch) names.unshift(\\"fetch\\");",',
      '      "  var chain=[], obj=self;",',
      '      "  while(obj){ chain.push(obj); try{ obj=Object.getPrototypeOf(obj);}catch(e){ break; } }",',
      '      "  function door(){ var fn=function(){ throw new Error(\\"Hearth runs offline\\"); }; fn.open=fn; fn.deleteDatabase=fn; fn.databases=fn; fn.match=fn; return fn; }",',
      '      "  var i,j,bag;",',
      '      "  for(i=0;i<names.length;i++){",',
      '      "    bag=(names[i]===\\"indexedDB\\"||names[i]===\\"caches\\")?door():refuse;",',
      '      "    for(j=0;j<chain.length;j++){",',
      '      "      try{ delete chain[j][names[i]]; }catch(e1){}",',
      '      "      try{ Object.defineProperty(chain[j], names[i], {configurable:true, writable:true, value:bag}); }catch(e2){}",',
      '      "    }",',
      '      "  }",',
      '      "  try{ if(self.navigator) Object.defineProperty(self.navigator, \\"sendBeacon\\", {configurable:true, writable:true, value:refuse}); }catch(e3){}",',
      '      "  for(j=1;j<chain.length;j++){ try{ Object.freeze(chain[j]); }catch(e4){} }",',
      '      "}",',
      '      "seal(" + (drop ? "true" : "false") + ");",',
      '      "var __lines=[], __bytes=0, __maxLines=" + maxLines + ", __maxBytes=" + maxBytes + ";",',
      '      "function __show(a){ if(typeof a===\\"string\\") return a; if(a==null||typeof a===\\"number\\"||typeof a===\\"boolean\\") return String(a); try{ return JSON.stringify(a);}catch(e){ return String(a);} }",',
      '      "function __push(args){ if(__lines.length>=__maxLines){ return; } var parts=[], i; for(i=0;i<args.length;i++) parts.push(__show(args[i])); var row=parts.join(\\" \\"); if(__bytes+row.length>__maxBytes){ __lines.push(\\"Output stopped at " + kbStop + " KB.\\"); return; } __lines.push(row); __bytes+=row.length+1; }",',
      '      "self.console={ log:function(){__push(arguments);}, error:function(){__push(arguments);}, warn:function(){__push(arguments);}, info:function(){__push(arguments);} };",',
      '      "var __posted=false;",',
      '      "function __post(value){ if(__posted) return; __posted=true; var shown=(value==null)?\\"\\":__show(value); self.postMessage({ok:true, lines:__lines, value:shown}); }",',
      '      "var __value;",',
      '      "try { __value = (function(){",',
      '      String(code || ""),',
      '      "}).call(self); } catch (e) { __lines.push(String(e && e.message || e)); __post(\\"\\"); }",',
      '      "if (!(__value && typeof __value.then === \\"function\\")) __post(__value);",',
      '      "else __value.then(function (v) { __post(v); }, function (e) { __lines.push(String(e && e.message || e)); __post(\\"\\"); });"',
      '    ].join("\\n");',
      '  }',
      '  window.addEventListener("message", function (ev) {',
      '    if (ev.source !== window.parent || ran) return;',
      '    var data = ev.data;',
      '    if (!data || typeof data !== "object") return;',
      '    var keys = Object.keys(data);',
      '    if (keys.length !== 3 || keys.indexOf("nonce") < 0 || keys.indexOf("code") < 0 || keys.indexOf("caps") < 0) return;',
      '    ran = true;',
      '    var nonce = String(data.nonce);',
      '    var src;',
      '    try { src = build(String(data.code || ""), data.caps || {}); }',
      '    catch (e) { parent.postMessage({ hearth: "result", nonce: nonce, ok: false, lines: ["The sketch stopped."], value: "" }, "*"); return; }',
      '    var blob = new Blob([src], { type: "text/javascript" });',
      '    var url = URL.createObjectURL(blob);',
      '    var worker;',
      '    try { worker = new Worker(url); }',
      '    catch (e2) { parent.postMessage({ hearth: "result", nonce: nonce, ok: false, lines: ["This device has no worker for Hearth."], value: "" }, "*"); return; }',
      '    worker.onmessage = function (msg) {',
      '      var body = msg.data || {};',
      '      parent.postMessage({ hearth: "result", nonce: nonce, ok: body.ok !== false, lines: body.lines || [], value: body.value || "" }, "*");',
      '      try { worker.terminate(); } catch (e3) {}',
      '      try { URL.revokeObjectURL(url); } catch (e4) {}',
      '    };',
      '    worker.onerror = function () {',
      '      parent.postMessage({ hearth: "result", nonce: nonce, ok: false, lines: ["The sketch stopped."], value: "" }, "*");',
      '    };',
      '  });',
      '})();'
    ].join('\n');
  }

  function sandboxSrcdoc(csp) {
    return '<meta http-equiv="Content-Security-Policy" content="' + csp + '"><script>\n' + hostScript() + '\n</scr' + 'ipt>';
  }

  // 063b: the worker source is filled inside the iframe, after that iframe makes the blob URLs.
  function pythonWorkerPrelude() {
    return [
      'var __code = __FL_CODE__;',
      'var __loader = __FL_LOADER__;',
      'var __wasm = __FL_WASM__;',
      'var __stdlib = __FL_STDLIB__;',
      'var __lock = __FL_LOCK__;',
      'function sealPython() {',
      '  function refuse() { throw new Error("Hearth runs offline"); }',
      '  var names = ["XMLHttpRequest", "WebSocket", "EventSource", "WebTransport", "BroadcastChannel", "indexedDB", "caches"];',
      '  var chain = [];',
      '  var obj = self;',
      '  while (obj) { chain.push(obj); try { obj = Object.getPrototypeOf(obj); } catch (e) { break; } }',
      '  function door() {',
      '    var fn = function () { throw new Error("Hearth runs offline"); };',
      '    fn.open = fn; fn.deleteDatabase = fn; fn.databases = fn; fn.match = fn;',
      '    return fn;',
      '  }',
      '  var i, j, bag;',
      '  for (i = 0; i < names.length; i++) {',
      '    bag = (names[i] === "indexedDB" || names[i] === "caches") ? door() : refuse;',
      '    for (j = 0; j < chain.length; j++) {',
      '      try { delete chain[j][names[i]]; } catch (e1) {}',
      '      try { Object.defineProperty(chain[j], names[i], { configurable: true, writable: true, value: bag }); } catch (e2) {}',
      '    }',
      '  }',
      '  var origFetch = self.fetch ? self.fetch.bind(self) : refuse;',
      '  var origImport = self.importScripts ? self.importScripts.bind(self) : refuse;',
      '  function urlOf(input) {',
      '    if (typeof input === "string") return input;',
      '    if (input && input.url) return String(input.url);',
      '    return "";',
      '  }',
      '  function mapped(url) {',
      '    var table = { "pyodide.asm.wasm": __wasm, "python_stdlib.zip": __stdlib, "pyodide-lock.json": __lock, "pyodide.js": __loader };',
      '    var name;',
      '    for (name in table) { if (url.indexOf(name) !== -1) return table[name]; }',
      '    return "";',
      '  }',
      '  function guardFetch(input, init) {',
      '    var url = urlOf(input);',
      '    if (url.indexOf("blob:") === 0) return origFetch(input, init);',
      '    var blob = mapped(url);',
      '    if (blob) return origFetch(blob, init);',
      '    throw new Error("Hearth runs offline");',
      '  }',
      '  function guardImport(url) {',
      '    var one = String(url || "");',
      '    if (one.indexOf("blob:") === 0) return origImport(one);',
      '    throw new Error("Hearth runs offline");',
      '  }',
      '  for (j = 0; j < chain.length; j++) {',
      '    try { Object.defineProperty(chain[j], "fetch", { configurable: true, writable: true, value: guardFetch }); } catch (e3) {}',
      '    try { Object.defineProperty(chain[j], "importScripts", { configurable: true, writable: true, value: guardImport }); } catch (e4) {}',
      '  }',
      '  try { if (self.navigator) Object.defineProperty(self.navigator, "sendBeacon", { configurable: true, writable: true, value: refuse }); } catch (e5) {}',
      '  for (j = 1; j < chain.length; j++) { try { Object.freeze(chain[j]); } catch (e6) {} }',
      '}',
      'try {',
      '  sealPython();',
      '  importScripts(__loader);',
      '  if (typeof loadPyodide !== "function") throw new Error("Python did not load");',
      '  loadPyodide({',
      '    indexURL: "https://fl-hearth.local/pyodide/v0.27.7/",',
      '    lockFileURL: __lock,',
      '    stdLibURL: __stdlib',
      '  }).then(function (py) {',
      '    self.postMessage({ ready: true });',
      '    var lines = [];',
      '    try {',
      '      if (py.setStdout) { py.setStdout({ batched: function (s) { lines.push(String(s).replace(/\\n$/, "")); } }); }',
      '      var value = py.runPython(__code);',
      '      function finish(v) {',
      '        var shown = (v == null) ? "" : String(v);',
      '        if (shown && !lines.length) lines.push(shown);',
      '        self.postMessage({ ok: true, lines: lines, value: shown });',
      '      }',
      '      if (value && typeof value.then === "function") {',
      '        value.then(finish, function (err) { lines.push(String(err && err.message || err)); self.postMessage({ ok: false, lines: lines, value: "" }); });',
      '      } else finish(value);',
      '    } catch (err) {',
      '      lines.push(String(err && err.message || err));',
      '      self.postMessage({ ok: false, lines: lines, value: "" });',
      '    }',
      '  }).catch(function (err) {',
      '    self.postMessage({ ok: false, lines: [String(err && err.message || err)], value: "" });',
      '  });',
      '} catch (err) {',
      '  self.postMessage({ ok: false, lines: [String(err && err.message || err)], value: "" });',
      '}'
    ].join('\n');
  }

  function pythonHostScript() {
    return [
      '(function () {',
      '  var ran = false;',
      '  window.addEventListener("message", function (ev) {',
      '    if (ev.source !== window.parent || ran) return;',
      '    var data = ev.data;',
      '    if (!data || typeof data !== "object") return;',
      '    var keys = Object.keys(data);',
      '    if (keys.length !== 3 || keys.indexOf("nonce") < 0 || keys.indexOf("code") < 0 || keys.indexOf("caps") < 0) return;',
      '    if (!data.caps || data.caps.python !== true) return;',
      '    ran = true;',
      '    var nonce = String(data.nonce);',
      '    var files = data.caps.files || [];',
      '    var urls = {};',
      '    var i;',
      '    for (i = 0; i < files.length; i++) {',
      '      try { urls[String(files[i].name)] = URL.createObjectURL(new Blob([files[i].buf])); }',
      '      catch (e) { parent.postMessage({ hearth: "result", nonce: nonce, ok: false, lines: ["Python did not load"], value: "" }, "*"); return; }',
      '    }',
      '    var src = String(data.caps.prelude || "");',
      '    src = src.split("__FL_CODE__").join(JSON.stringify(String(data.code || "")));',
      '    src = src.split("__FL_LOADER__").join(JSON.stringify(urls["pyodide.js"] || ""));',
      '    src = src.split("__FL_WASM__").join(JSON.stringify(urls["pyodide.asm.wasm"] || ""));',
      '    src = src.split("__FL_STDLIB__").join(JSON.stringify(urls["python_stdlib.zip"] || ""));',
      '    src = src.split("__FL_LOCK__").join(JSON.stringify(urls["pyodide-lock.json"] || ""));',
      '    var blob = new Blob([src], { type: "text/javascript" });',
      '    var url = URL.createObjectURL(blob);',
      '    var worker;',
      '    try { worker = new Worker(url); }',
      '    catch (e2) { parent.postMessage({ hearth: "result", nonce: nonce, ok: false, lines: ["worker ctor " + String(e2 && e2.message || e2)], value: "" }, "*"); return; }',
      '    worker.onmessage = function (msg) {',
      '      var body = msg.data || {};',
      '      if (body.ready) { parent.postMessage({ hearth: "python-ready", nonce: nonce }, "*"); return; }',
      '      parent.postMessage({ hearth: "result", nonce: nonce, ok: body.ok !== false, lines: body.lines || [], value: body.value || "" }, "*");',
      '      try { worker.terminate(); } catch (e3) {}',
      '      try { URL.revokeObjectURL(url); } catch (e4) {}',
      '    };',
      '    worker.onerror = function (ev) {',
      '      parent.postMessage({ hearth: "result", nonce: nonce, ok: false, lines: ["Python stopped. " + String(ev && ev.message || "")], value: "" }, "*");',
      '    };',
      '  });',
      '})();'
    ].join('\n');
  }

  function pythonSrcdoc(csp) {
    return '<meta http-equiv="Content-Security-Policy" content="' + csp + '"><script>\n' + pythonHostScript() + '\n</scr' + 'ipt>';
  }

  function sandboxHost(code, caps) {
    if (roomShut()) return Promise.resolve({ ok: false, lines: ['The Quiet Room stays shut.'], value: '' });
    var d = doc();
    if (!d || typeof d.createElement !== 'function') {
      return Promise.resolve({ ok: false, lines: ['This device has no worker for Hearth.'], value: '' });
    }
    var drop = !!(caps && caps.dropFetch);
    var python = !!(caps && caps.python);
    var policy = cspForRun(drop, python);
    return new Promise(function (resolve) {
      var nonce = randomNonce();
      var frame = d.createElement('iframe');
      frame.setAttribute('sandbox', 'allow-scripts');
      frame.setAttribute('csp', policy);
      frame.setAttribute('title', 'Hearth sandbox');
      frame.setAttribute('data-hearth-sandbox', '1');
      frame.setAttribute('aria-hidden', 'true');
      frame.className = 'fl-hearth-sandbox';
      lastSandboxAttr = frame.getAttribute('sandbox');
      var holder = d.body;
      if (!holder) {
        resolve({ ok: false, lines: ['This device has no worker for Hearth.'], value: '' });
        return;
      }
      var finished = false;
      var timer = null;
      var limit = (caps && caps.ms) || MAX_MS;
      function finish(result) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        root.removeEventListener('message', onMsg);
        if (frame.parentNode) frame.parentNode.removeChild(frame);
        resolve(result);
      }
      function arm(ms) {
        clearTimeout(timer);
        timer = trackTimer(setTimeout(function () {
          finish({ ok: false, stopped: true, lines: [stopLine(ms)], value: '' });
        }, ms));
      }
      function onMsg(ev) {
        if (!frame.contentWindow || ev.source !== frame.contentWindow) return;
        var data = ev.data || {};
        if (data.nonce !== nonce) return;
        if (data.hearth === 'python-ready') {
          showPyStatus('Python ready');
          arm(limit);
          return;
        }
        if (data.hearth !== 'result') return;
        finish({
          ok: data.ok !== false,
          stopped: false,
          lines: capLines(data.lines || []),
          value: data.value || ''
        });
      }
      root.addEventListener('message', onMsg);
      // before 063b: the stop started as soon as the worker was created.
      if (!python) arm(limit);
      var sent = false;
      frame.onload = function () {
        // The blank frame loads once before srcdoc. Sending then would drop the bytes.
        if (sent || !frame.getAttribute('srcdoc')) return;
        sent = true;
        try {
          var payload = {
            ms: limit,
            lines: (caps && caps.lines) || MAX_LINES,
            bytes: (caps && caps.bytes) || MAX_BYTES,
            dropFetch: drop
          };
          var transfers = [];
          if (python) {
            payload.python = true;
            payload.prelude = pythonWorkerPrelude();
            payload.files = [];
            var list = (caps && caps.files) || [];
            var fi;
            for (fi = 0; fi < list.length; fi++) {
              payload.files.push({ name: list[fi].name, buf: list[fi].buf });
              if (list[fi].buf) transfers.push(list[fi].buf);
            }
          }
          frame.contentWindow.postMessage({
            nonce: nonce,
            code: String(code || ''),
            caps: payload
          }, '*', transfers);
        } catch (e) {
          finish({ ok: false, lines: ['This device has no worker for Hearth. ' + String(e && e.message || e)], value: '' });
        }
      };
      holder.appendChild(frame);
      frame.srcdoc = python ? pythonSrcdoc(policy) : sandboxSrcdoc(policy);
    });
  }

  function stopLine(ms) {
    var seconds = Math.round((ms || MAX_MS) / 1000);
    if (seconds === 3) return STOP_LINE;
    return 'Stopped after ' + seconds + ' seconds.';
  }

  function finishWorker(worker, url, done) {
    try { worker.terminate(); } catch (e) {}
    var i = workers.indexOf(worker);
    if (i >= 0) workers.splice(i, 1);
    if (url) {
      try { URL.revokeObjectURL(url); } catch (e2) {}
    }
    if (done) done();
  }

  // before 063b: runJS created the blob worker on the page origin. That path is unused.
  /*
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
  */

  function runJS(code) {
    if (roomShut()) return Promise.resolve({ ok: false, lines: ['The Quiet Room stays shut.'], value: '' });
    if (String(code || '').indexOf('import(') !== -1) {
      return Promise.resolve({ ok: false, lines: [IMPORT_LINE], value: '' });
    }
    // before 063b: caps were the fixed defaults on every run.
    var saved = readCaps();
    var caps = {
      ms: saved.ms,
      lines: saved.lines,
      bytes: saved.bytes,
      dropFetch: root.__flHearthDropGuard === true
    };
    return sandboxHost(code, caps);
  }

  function pythonChoice() {
    var ls = storage();
    if (!ls) return '';
    try { return ls.getItem(PYTHON_KEY) || ''; } catch (e) { return ''; }
  }

  function rememberPython() {
    var ls = storage();
    if (!ls) return;
    // before 063b: try { ls.setItem(PYTHON_KEY, 'on'); } catch (e) {}
    try { ls.setItem(PYTHON_KEY, 'true'); } catch (e2) {}
  }

  function onCellular() {
    var c = root.navigator && root.navigator.connection;
    if (!c) return false;
    if (c.saveData) return true;
    var kind = String(c.type || '');
    if (kind === 'cellular') return true;
    var slow = String(c.effectiveType || '');
    // before 063b: return slow === 'slow-2g' || slow === '2g';
    return slow === 'slow-2g' || slow === '2g' || slow === '3g';
  }

  function pythonBase() {
    var base = (typeof root.__flHearthPythonFixtureCDN === 'string' && root.__flHearthPythonFixtureCDN) ? root.__flHearthPythonFixtureCDN : PY_INDEX;
    if (base.slice(-1) !== '/') base += '/';
    return base;
  }

  function pinsFor() {
    var over = root.__flHearthPythonPins;
    if (over && typeof over === 'object') return over;
    return PY_PINS;
  }

  function pyCacheKey(name) {
    return 'https://fl-hearth.local/pyodide/v0.27.7/' + name;
  }

  function readPythonCache(name) {
    if (!root.caches || !root.caches.open) return Promise.resolve(null);
    return root.caches.open(PY_CACHE).then(function (cache) {
      return cache.match(pyCacheKey(name));
    }).then(function (res) {
      if (!res) return null;
      return res.arrayBuffer();
    }).then(function (buf) {
      if (!buf) return null;
      return sha256Buf(buf).then(function (hex) {
        var expect = pinsFor()[name];
        if (!expect || hex !== expect) return null;
        return buf;
      });
    }).catch(function () { return null; });
  }

  function storePythonCache(name, buf) {
    if (!root.caches || !root.caches.open) return Promise.resolve();
    var copy = buf.slice(0);
    return root.caches.open(PY_CACHE).then(function (cache) {
      return cache.put(pyCacheKey(name), new Response(copy));
    }).catch(function () {});
  }

  function fetchPinned(name, got) {
    var url = pythonBase() + name;
    noteNet(url, { Accept: 'application/octet-stream' });
    return root.fetch(url, { method: 'GET' }).then(function (res) {
      if (!res.ok) throw new Error('Python did not download.');
      return res.arrayBuffer();
    }).then(function (buf) {
      got.n += buf.byteLength;
      showPyStatus('Getting Python ready... ' + mbLabel(got.n) + ' MB');
      return sha256Buf(buf).then(function (hex) {
        var expect = pinsFor()[name];
        if (!expect || hex !== expect) throw new Error(PIN_MISS);
        return storePythonCache(name, buf).then(function () {
          return { name: name, buf: buf };
        });
      });
    });
  }

  function ensurePythonBytes() {
    var got = { n: 0 };
    var files = [];
    showPyStatus('Getting Python ready... 0.0 MB');
    function next(i) {
      if (i >= PY_NAMES.length) {
        showPyStatus('Getting Python ready... ' + mbLabel(got.n) + ' MB');
        return Promise.resolve(files);
      }
      var name = PY_NAMES[i];
      return readPythonCache(name).then(function (buf) {
        if (buf) {
          got.n += buf.byteLength;
          showPyStatus('Getting Python ready... ' + mbLabel(got.n) + ' MB');
          files.push({ name: name, buf: buf });
          return next(i + 1);
        }
        return fetchPinned(name, got).then(function (file) {
          files.push(file);
          return next(i + 1);
        });
      });
    }
    return next(0);
  }

  function offerPython() {
    if (pythonBtn) {
      pythonBtn.hidden = false;
      pythonBtn.textContent = 'about 10 MB, once. Add Python';
    }
    if (onCellular()) {
      if (pythonBtn) pythonBtn.textContent = 'about 10 MB, once. Download Python on cellular';
      showPyStatus('This network looks like a phone network. Tap again to download about 10 MB once.');
    }
  }

  function runPythonSandbox(code, files) {
    var saved = readCaps();
    return sandboxHost(code, {
      ms: saved.ms,
      lines: saved.lines,
      bytes: saved.bytes,
      python: true,
      files: files
    });
  }

  function runPython(code) {
    if (roomShut()) return Promise.resolve({ ok: false, lines: ['The Quiet Room stays shut.'], value: '' });
    // 063b: the gate is before the fixture, so a run before Add never touches the network.
    if (pythonChoice() !== 'true') {
      offerPython();
      return Promise.resolve({ ok: false, lines: [NOT_ADDED], value: '' });
    }
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
    // before 063b: return verifyPythonPin().then(function () { return runPythonWorker(code); }, ...)
    return ensurePythonBytes().then(function (files) {
      return runPythonSandbox(code, files);
    }, function (err) {
      showPyStatus('');
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
      // before 063b: the sketch iframe had sandbox allow-scripts and no content policy.
      frame.setAttribute('sandbox', 'allow-scripts');
      frame.setAttribute('csp', SANDBOX_CSP);
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
      // before 063b: var timer = trackTimer(setTimeout(function () { finish(STOP_LINE); }, MAX_MS));
      var showMs = readCaps().ms;
      var timer = trackTimer(setTimeout(function () { finish(stopLine(showMs)); }, showMs));
      // before 063b: frame.srcdoc = String(html || '');
      frame.srcdoc = '<meta http-equiv="Content-Security-Policy" content="' + SANDBOX_CSP + '">' + String(html || '');
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
        offerMindCaps(lastReply);
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
    var used = readCaps();
    runs += 1;
    var job;
    if (lang === 'html') job = runShow(code);
    else if (lang === 'python') job = runPython(code);
    else job = runJS(code);
    lastRun = job.then(function (result) {
      var text = paintOut(result);
      paintCapsFooter(used);
      return text;
    });
    return lastRun;
  }

  function onPythonTap() {
    // before 063b: if (pythonChoice() !== 'on' && onCellular() && !pythonWarned) { ... remember without a download. }
    if (pythonChoice() !== 'true' && onCellular() && !pythonWarned) {
      pythonWarned = true;
      if (pythonBtn) pythonBtn.textContent = 'about 10 MB, once. Download Python on cellular';
      showPyStatus('This network looks like a phone network. Tap again to download about 10 MB once.');
      if (outEl) outEl.textContent = 'This network looks like a phone network. Tap again to download about 10 MB once.';
      return Promise.resolve({ ok: false, warned: true });
    }
    if (typeof root.__flHearthPythonFixture === 'function') {
      rememberPython();
      if (pythonBtn) pythonBtn.textContent = 'Python is allowed on this device';
      return Promise.resolve({ ok: true, remembered: true });
    }
    return ensurePythonBytes().then(function () {
      rememberPython();
      if (pythonBtn) pythonBtn.textContent = 'Python is allowed on this device';
      return { ok: true, remembered: true };
    }, function (err) {
      showPyStatus('');
      var line = String(err && err.message || err);
      if (outEl) outEl.textContent = line;
      return { ok: false, line: line };
    });
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
      '.fl-hearth-controls,.fl-hearth-files,.fl-hearth-limits{display:flex;flex-wrap:wrap;gap:8px;align-items:center;max-width:100%;}',
      '.fl-hearth-limits label{display:flex;align-items:center;gap:6px;min-height:44px;font-size:14px;}',
      '.fl-hearth-limits input{min-height:44px;min-width:44px;width:4.5em;max-width:100%;font-size:16px;color:inherit;background:transparent;border:1px solid var(--glass-border,rgba(255,255,255,.2));border-radius:8px;padding:8px;}',
      '.fl-hearth-limits input[type="checkbox"]{width:44px;min-width:44px;padding:0;}',
      '.fl-hearth-btn,a.fl-hearth-btn{display:inline-block;min-height:44px;min-width:44px;padding:10px 12px;font:inherit;font-size:14px;color:inherit;background:var(--glass-bg,transparent);border:1px solid var(--glass-border,rgba(255,255,255,.2));border-radius:var(--btn-radius,8px);cursor:pointer;appearance:none;-webkit-appearance:none;text-decoration:none;line-height:22px;}',
      '.fl-hearth-btn:disabled{cursor:default;opacity:.6;}',
      '#flHearthRepo{width:100%;min-height:44px;font-size:14px;color:inherit;background:transparent;border:1px solid var(--glass-border,rgba(255,255,255,.15));border-radius:8px;padding:8px;}',
      '.fl-hearth-frame{width:100%;height:180px;border:0;max-width:100%;}',
      '.fl-hearth-sandbox{position:absolute;left:0;top:0;width:0;height:0;border:0;}',
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
    var how = d.createElement('a');
    how.id = 'flHearthHow';
    how.href = '#flHearthHowNote';
    how.className = 'fl-hearth-btn';
    how.textContent = 'How do we know?';
    var howNote = el('p', 'fl-hearth-note', 'Code runs in a sealed sandbox with no network and no access to your vault.\nChecked by smoke-hearth-sandbox-v0.1.');
    howNote.id = 'flHearthHowNote';
    howNote.hidden = true;
    how.addEventListener('click', function (ev) {
      ev.preventDefault();
      howNote.hidden = false;
    });
    host.appendChild(how);
    host.appendChild(howNote);
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
    // before 063b: pythonBtn = btn('flHearthPython', 'Add Python (about 10 MB, once)', function () { onPythonTap(); });
    pythonBtn = btn('flHearthPython', 'about 10 MB, once. Add Python', function () { lastRun = onPythonTap(); });
    controls.appendChild(pythonBtn);
    controls.appendChild(btn('flHearthClose', 'Close', function () { closePanel(); }));
    host.appendChild(controls);
    var limitsNote = el('p', 'fl-hearth-note', 'Defaults protect your device, not to restrict you (AUTONOMY.md).');
    limitsNote.id = 'flHearthLimitsNote';
    host.appendChild(limitsNote);
    var limits = el('div', 'fl-hearth-limits');
    limits.id = 'flHearthLimits';
    function capField(id, label, min, max, value, suffix) {
      var lab = d.createElement('label');
      lab.appendChild(d.createTextNode(label + ' '));
      var input = d.createElement('input');
      input.id = id;
      input.type = 'number';
      input.min = String(min);
      input.max = String(max);
      input.value = String(value);
      input.addEventListener('change', syncCapsFromInputs);
      input.addEventListener('input', syncCapsFromInputs);
      lab.appendChild(input);
      if (suffix) lab.appendChild(d.createTextNode(' ' + suffix));
      return lab;
    }
    var opening = readCaps();
    limits.appendChild(capField('flHearthCapTime', 'Time', 1, 60, Math.round(opening.ms / 1000), 's'));
    limits.appendChild(capField('flHearthCapLines', 'Lines', 50, 5000, opening.lines, ''));
    limits.appendChild(capField('flHearthCapBytes', 'Output', 5, 500, Math.round(opening.bytes / 1024), 'KB'));
    limits.appendChild(btn('flHearthCapReset', 'Reset to defaults', function () {
      var back = { ms: MAX_MS, lines: MAX_LINES, bytes: MAX_BYTES, by: 'you' };
      saveCaps(back);
      paintLimitFields(back);
    }));
    var mindLab = d.createElement('label');
    var mindBox = d.createElement('input');
    mindBox.id = 'flHearthMindCaps';
    mindBox.type = 'checkbox';
    try { mindBox.checked = storage() && storage().getItem(MIND_CAPS_KEY) === 'true'; } catch (e) {}
    mindBox.addEventListener('change', function () {
      var ls = storage();
      if (!ls) return;
      try {
        if (mindBox.checked) ls.setItem(MIND_CAPS_KEY, 'true');
        else ls.removeItem(MIND_CAPS_KEY);
      } catch (err) {}
    });
    mindLab.appendChild(mindBox);
    mindLab.appendChild(d.createTextNode(' Let the mind set limits'));
    limits.appendChild(mindLab);
    var chip = btn('flHearthMindChip', 'Use limits', function () {});
    chip.hidden = true;
    limits.appendChild(chip);
    var who = el('p', 'fl-hearth-note', '');
    who.id = 'flHearthCapsBy';
    who.hidden = true;
    limits.appendChild(who);
    host.appendChild(limits);
    var pyStatus = el('p', 'fl-hearth-note', '');
    pyStatus.id = 'flHearthPyStatus';
    pyStatus.hidden = true;
    host.appendChild(pyStatus);
    outEl = el('pre', 'fl-hearth-out', '');
    outEl.id = 'flHearthOut';
    var capsUsed = el('p', 'fl-hearth-note', '');
    capsUsed.id = 'flHearthCapsUsed';
    capsUsed.hidden = true;
    mindEl = el('pre', 'fl-hearth-mind', '');
    mindEl.id = 'flHearthMind';
    host.appendChild(outEl);
    host.appendChild(capsUsed);
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
    PY_PINS: PY_PINS,
    PY_CACHE: PY_CACHE,
    PY_WASM_BYTES: PY_WASM_BYTES,
    netLog: netLog,
    runJS: runJS,
    sandboxHost: sandboxHost,
    lastSandbox: function () { return lastSandboxAttr; },
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
