// smoke-workspace-desktop-heals.js (MIT) v-workspace-desktop-heals-v0.1
// Node only. A packed build lists every local require. The knock-first
// line shows the existing bridge card. Nothing is requested.
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var assert = require('assert');

var rootDir = path.join(__dirname, '..');
var LINE = 'Knock first: Celeste has not met this device yet';
var fetches = 0;
global.fetch = function () {
  fetches += 1;
  return Promise.reject(new Error('no request'));
};

function md5(file) {
  return crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
}

assert.strictEqual(md5(path.join(rootDir, 'docs/modules/fl-bridge.js')), '3b5ef06849a142e50c78e7ba1e057980', 'bridge file stays the 041 hash');
assert.strictEqual(md5(path.join(rootDir, 'docs/modules/mind-workspace.js')), 'a0c4596e20952d229d077daa3f397a31', 'notebook file stays');
assert.strictEqual(md5(path.join(rootDir, 'desktop/workspace-mirror.js')), 'ba382400defc98001559c275e13d285d', 'mirror file stays');

var pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'desktop/package.json'), 'utf8'));
var listed = pkg.build && pkg.build.files;
assert.ok(Array.isArray(listed), 'build.files');
assert.ok(listed.indexOf('workspace-mirror.js') !== -1, 'mirror is packed');
assert.ok(listed.indexOf('bridge-door.js') !== -1, 'door stays packed');

function localRequires(rel) {
  var src = fs.readFileSync(path.join(rootDir, 'desktop', rel), 'utf8');
  var re = /require\(\s*['"]\.\/([^'"]+)['"]\s*\)/g;
  var out = [];
  var m;
  while ((m = re.exec(src))) {
    var name = m[1];
    if (name.slice(-3) !== '.js') name += '.js';
    out.push(name);
  }
  return out;
}
['main.js', 'preload.js'].forEach(function (rel) {
  localRequires(rel).forEach(function (name) {
    assert.ok(listed.indexOf(name) !== -1, rel + ' packs ' + name);
    assert.ok(fs.existsSync(path.join(rootDir, 'desktop', name)), name + ' exists');
  });
});

var knockSrc = fs.readFileSync(path.join(rootDir, 'docs/modules/workspace-knock-card.js'), 'utf8');
assert.ok(knockSrc.indexOf('v-workspace-desktop-heals-v0.1') !== -1, 'marker');
assert.ok(knockSrc.indexOf('createElement') === -1, 'no new door');
assert.ok(knockSrc.indexOf('fe' + 'tch(') === -1, 'no request');
assert.ok(knockSrc.indexOf('sealKnock') === -1, 'does not seal');
assert.ok(knockSrc.indexOf('.send(') === -1, 'does not send');
assert.ok(knockSrc.indexOf('\u2014') === -1, 'no em dash');
assert.ok(knockSrc.indexOf('&' + 'mdash;') === -1, 'no mdash');
assert.ok(knockSrc.indexOf('inner' + 'HTML') === -1, 'text only');
assert.ok(knockSrc.indexOf('conf' + 'irm(') === -1, 'no confirm');
assert.ok(knockSrc.indexOf('ev' + 'al(') === -1, 'no eval');
assert.ok(knockSrc.indexOf('new F' + 'unction') === -1, 'no Function');
assert.ok(knockSrc.indexOf('ice' + 'Servers') === -1, 'no ice');
var banned = ['open' + 'ai', 'anthrop' + 'ic', 'cl' + 'aude', 'chat' + 'gpt', 'gem' + 'ini', 'oll' + 'ama', 'gr' + 'ok', 'x' + 'ai', 'hugging' + 'face'];
assert.ok(!new RegExp(banned.join('|'), 'i').test(knockSrc), 'no platform name');

var indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
var appHtml = fs.readFileSync(path.join(rootDir, 'docs/app.html'), 'utf8');
assert.strictEqual(indexHtml, appHtml, 'index.html matches docs/app.html');
assert.ok(indexHtml.indexOf('modules/workspace-knock-card.js') !== -1, 'the page loads the mount');

function memStore() {
  var s = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(s, k) ? s[k] : null; },
    setItem: function (k, v) { s[k] = String(v); },
    removeItem: function (k) { delete s[k]; }
  };
}
function makeIDB() {
  var databases = {};
  function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
  function makeDb() {
    var stores = {};
    return {
      objectStoreNames: {
        contains: function (n) { return !!stores[n]; },
        get length() { return Object.keys(stores).length; }
      },
      createObjectStore: function (n, opts) { stores[n] = { keyPath: opts && opts.keyPath, rows: {} }; },
      close: function () {},
      transaction: function (storeName) {
        var store = stores[storeName];
        var tx = { oncomplete: null, onerror: null, onabort: null };
        var pending = 0;
        var closed = false;
        var finished = false;
        function finish() {
          if (finished || pending > 0 || !closed) return;
          finished = true;
          setTimeout(function () { if (tx.oncomplete) tx.oncomplete(); }, 0);
        }
        function request(fill) {
          pending += 1;
          var r = {};
          setTimeout(function () {
            var failed = false;
            try { fill(r); failed = !!r._fail; } catch (e) { failed = true; }
            if (failed) { if (r.onerror) r.onerror({}); }
            else if (r.onsuccess) r.onsuccess({ target: r });
            pending -= 1;
            finish();
          }, 0);
          return r;
        }
        tx.objectStore = function () {
          return {
            get: function (key) {
              return request(function (r) {
                var row = store && store.rows[key];
                r.result = row ? clone(row) : undefined;
              });
            },
            getAll: function () {
              return request(function (r) {
                r.result = store ? Object.keys(store.rows).map(function (k) { return clone(store.rows[k]); }) : [];
              });
            },
            add: function (record) {
              return request(function (r) {
                var key = store.keyPath ? record[store.keyPath] : 'primary';
                if (Object.prototype.hasOwnProperty.call(store.rows, key)) { r._fail = true; return; }
                store.rows[key] = clone(record);
                r.result = key;
              });
            },
            put: function (record, key) {
              return request(function (r) {
                var id = key != null ? key : (store.keyPath ? record[store.keyPath] : 'primary');
                store.rows[id] = clone(record);
                r.result = id;
              });
            }
          };
        };
        setTimeout(function () { closed = true; finish(); }, 0);
        return tx;
      }
    };
  }
  return {
    open: function (name) {
      var req = {};
      setTimeout(function () {
        if (!databases[name]) {
          var db = makeDb();
          databases[name] = db;
          req.result = db;
          if (req.onupgradeneeded) req.onupgradeneeded({ target: { result: db } });
        } else req.result = databases[name];
        if (req.onsuccess) req.onsuccess({ target: { result: req.result } });
      }, 0);
      return req;
    }
  };
}

function makeElement(tag) {
  var el = {
    tag: tag,
    id: '',
    className: '',
    type: '',
    hidden: false,
    attributes: {},
    children: [],
    parentNode: null,
    style: {},
    _text: ''
  };
  Object.defineProperty(el, 'parentElement', { get: function () { return el.parentNode; } });
  Object.defineProperty(el, 'textContent', {
    get: function () {
      if (el.children.length) return el.children.map(function (c) { return c.textContent; }).join('');
      return el._text;
    },
    set: function (v) {
      el._text = v == null ? '' : String(v);
      el.children.length = 0;
    }
  });
  Object.defineProperty(el, 'firstChild', { get: function () { return el.children[0] || null; } });
  Object.defineProperty(el, 'nextSibling', {
    get: function () {
      if (!el.parentNode) return null;
      var i = el.parentNode.children.indexOf(el);
      return i >= 0 ? (el.parentNode.children[i + 1] || null) : null;
    }
  });
  Object.defineProperty(el, 'previousSibling', {
    get: function () {
      if (!el.parentNode) return null;
      var i = el.parentNode.children.indexOf(el);
      return i > 0 ? el.parentNode.children[i - 1] : null;
    }
  });
  el.setAttribute = function (k, v) {
    el.attributes[k] = String(v);
    if (k === 'id') el.id = String(v);
  };
  el.getAttribute = function (k) { return Object.prototype.hasOwnProperty.call(el.attributes, k) ? el.attributes[k] : null; };
  el.appendChild = function (c) {
    if (!c) return c;
    if (c.parentNode) c.parentNode.removeChild(c);
    c.parentNode = el;
    el.children.push(c);
    return c;
  };
  el.insertBefore = function (c, ref) {
    if (!c) return c;
    if (c.parentNode) c.parentNode.removeChild(c);
    c.parentNode = el;
    var i = ref ? el.children.indexOf(ref) : -1;
    if (i < 0) el.children.push(c);
    else el.children.splice(i, 0, c);
    return c;
  };
  el.removeChild = function (c) {
    var i = el.children.indexOf(c);
    if (i >= 0) el.children.splice(i, 1);
    if (c) c.parentNode = null;
    return c;
  };
  el.addEventListener = function () {};
  el.remove = function () { if (el.parentNode) el.parentNode.removeChild(el); };
  el.click = function () {};
  function match(n, sel) {
    if (!sel) return false;
    if (sel.charAt(0) === '#') return n.id === sel.slice(1);
    if (sel.indexOf('[id="') === 0 && sel.charAt(sel.length - 1) === ']') return n.id === sel.slice(5, -2);
    if (sel.charAt(0) === '.') return String(n.className || '').split(/\s+/).indexOf(sel.slice(1)) !== -1;
    return n.tag === sel;
  }
  function walk(node, fn) {
    if (!node) return;
    fn(node);
    var kids = node.children ? node.children.slice() : [];
    var i;
    for (i = 0; i < kids.length; i++) walk(kids[i], fn);
  }
  el.querySelectorAll = function (sel) {
    var out = [];
    walk(el, function (n) { if (n !== el && match(n, sel)) out.push(n); });
    return out;
  };
  el.querySelector = function (sel) {
    var all = el.querySelectorAll(sel);
    return all[0] || null;
  };
  el._walk = walk;
  el._match = match;
  return el;
}

var body = makeElement('body');
var head = makeElement('head');
global.document = {
  readyState: 'complete',
  body: body,
  head: head,
  addEventListener: function () {},
  createElement: function (tag) { return makeElement(tag); },
  getElementById: function (id) {
    var found = null;
    body._walk(body, function (n) { if (!found && n.id === id) found = n; });
    head._walk(head, function (n) { if (!found && n.id === id) found = n; });
    return found;
  },
  querySelectorAll: function (sel) {
    var out = [];
    body._walk(body, function (n) { if (body._match(n, sel)) out.push(n); });
    head._walk(head, function (n) { if (head._match(n, sel)) out.push(n); });
    return out;
  },
  querySelector: function (sel) {
    var all = this.querySelectorAll(sel);
    return all[0] || null;
  }
};
global.window = global;
global.localStorage = memStore();
global.sessionStorage = memStore();
global.indexedDB = makeIDB();
global.getComputedStyle = function () { return null; };
global.MutationObserver = function (cb) {
  this.observe = function () {};
  this.cb = cb;
};

var connectWrap = document.createElement('div');
var connect = document.createElement('div');
connect.id = 'fl-connect-mount';
connectWrap.appendChild(connect);
document.body.appendChild(connectWrap);

var bridge = require(path.join(rootDir, 'docs/modules/fl-bridge.js'));
var ws = require(path.join(rootDir, 'docs/modules/mind-workspace.js'));
var knock = require(path.join(rootDir, 'docs/modules/workspace-knock-card.js'));
assert.strictEqual(knock.MARKER, 'v-workspace-desktop-heals-v0.1', 'exported marker');
assert.ok(document.getElementById('fl-bridge-card'), 'the bridge paints its own card');
assert.strictEqual(fetches, 0, 'painting the card makes no request');

(async function () {
  await ws.accept();
  await ws.setMind('room-model', 'Lumen');
  var porch = await ws.open('Porch page', { kind: 'note' });
  var wrote = await ws.write(porch.page.id, 'The porch page may be handed to Celeste.', 'mind');
  assert.ok(wrote && wrote.hash, 'shared page');
  var asked = await ws.askHandoff(porch.page.id, 'the porch light');
  assert.strictEqual(asked.ok, true, 'the mind asks');
  var early = await ws.prepareHandoff(porch.page.id);
  assert.strictEqual(early.ok, false, 'no letter before the knock');
  assert.strictEqual(early.line, LINE, 'knock first');
  knock.place();
  var line = null;
  document.querySelectorAll('[id="fl-ws-handoff-line"]').forEach(function (n) {
    if (n.textContent === LINE) line = n;
  });
  assert.ok(line, 'the knock answer is on the page');
  var card = document.getElementById('fl-bridge-card');
  assert.ok(card, 'the knock answer renders the card node');
  assert.strictEqual(card.getAttribute('data-bridge'), 'v-bridge-knock-v0.1', 'it is the existing card');
  var slot = line;
  while (slot && slot.id !== 'fl-ws-asks' && slot.id !== 'fl-ws-panel') slot = slot.parentNode;
  assert.ok(slot, 'the line has a home');
  assert.strictEqual(slot.nextSibling, card, 'the card sits with the line');
  assert.ok(card.textContent.indexOf('Letters to Celeste') !== -1, 'the card keeps its own words');
  assert.strictEqual(document.querySelectorAll('#fl-bridge-card').length, 1, 'one card');
  assert.strictEqual(fetches, 0, 'requests made: 0');
  console.log('SMOKE_OK workspace desktop heals v0.1');
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
