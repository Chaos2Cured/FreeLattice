#!/usr/bin/env node
// v-model-choice-sticks-v0: a model the person taps in Connect is their own choice.
// It survives a tab change, opening Settings and a reload, and the chat request uses it.
// The automatic picker only fills in when the chosen model is no longer installed, and says so.
// Also: Settings button row comes back after Local; a helped Bridge with no mind behind it is
// named honestly and is not saved as the Ollama door.
// Runs the REAL code: FLActiveModel + FLAutoModel + FreeLattice.callAI from docs/app.html and
// docs/modules/fl-connect.js, in vm sandboxes. Layer, never delete. 127.0.0.1 only.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const repo = path.join(root, '..');
const app = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
const mod = fs.readFileSync(path.join(root, 'modules', 'fl-connect.js'), 'utf8');

function between(src, a, b) {
  const i = src.indexOf(a);
  assert.ok(i >= 0, 'missing anchor: ' + a.slice(0, 70));
  const j = src.indexOf(b, i + a.length);
  assert.ok(j > i, 'missing end anchor: ' + b.slice(0, 70));
  return src.slice(i, j);
}
const safeSrc = between(app, 'function safeGet(key, fallback) {', '// Safe clipboard');
const modelSrc = between(app, 'window.FLActiveModel = (function() {', '// RAG Phase 1');
const callAISrc = between(app, 'window.FreeLattice.callAI = function(systemPrompt, userPrompt, options) {', '\n};\n') + '\n};\n';
const settingsSrc = between(app, '// v-model-choice-sticks-v0: the Settings button row', 'function settingsSetMode(mode) {');

const MODELS = [{ name: 'llama3.2:latest' }, { name: 'qwen2.5:latest' }];
const flush = async (n) => { for (let i = 0; i < (n || 30); i++) await new Promise((r) => setImmediate(r)); };

function store0(init) {
  const s = Object.assign({}, init || {});
  return {
    s,
    ls: {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(s, k) ? s[k] : null),
      setItem: (k, v) => { s[k] = String(v); },
      removeItem: (k) => { delete s[k]; }
    }
  };
}

function fakeEl(tag) {
  const listeners = {};
  return {
    tagName: String(tag || 'div').toUpperCase(), style: {}, dataset: {}, textContent: '', type: '', className: '',
    children: [], firstChild: null, attrs: {},
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k] || null; },
    addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
    click() { (listeners.click || []).forEach((fn) => fn({ currentTarget: this, target: this })); },
    appendChild(c) { this.children.push(c); this.firstChild = this.children[0]; return c; },
    removeChild(c) { this.children = this.children.filter((x) => x !== c); this.firstChild = this.children[0] || null; }
  };
}

// A page-like sandbox: storage, state, fetch spy (127.0.0.1 only), the real model code.
function page(store, extra) {
  const calls = [];
  const posts = [];
  const els = {};
  const ctx = Object.assign({
    localStorage: store.ls,
    location: { hostname: 'freelattice.com', protocol: 'https:', hash: '', search: '' },
    navigator: { userAgent: 't' },
    console: { log() {}, warn() {}, error() {} },
    JSON, String, parseInt, URL, Date, Math, Promise, Object, Array, Set,
    AbortSignal: { timeout: () => undefined },
    setTimeout: () => 1, clearTimeout() {},
    LatticeEvents: { emit() {}, on() {} },
    getOllamaBaseUrl: () => 'http://127.0.0.1:11434',
    toasts: [],
    showToast(msg) { ctx.toasts.push(String(msg)); },
    fetch: async (url, opts) => {
      url = String(url);
      calls.push(url);
      assert.ok(/^http:\/\/127\.0\.0\.1:\d+\//.test(url), 'only 127.0.0.1 is asked: ' + url);
      if (opts && opts.method === 'POST') {
        posts.push({ url, body: JSON.parse(opts.body) });
        return { ok: true, status: 200, json: async () => ({ message: { content: 'ok' } }) };
      }
      if (/127\.0\.0\.1:11434\/api\/tags$/.test(url)) return { ok: true, status: 200, json: async () => ({ models: ctx.installed.slice() }) };
      throw new Error('quiet');
    },
    installed: MODELS.slice(),
    document: {
      hidden: false,
      documentElement: { getAttribute: () => '', classList: { add() {}, remove() {}, contains() { return false; } } },
      getElementById: (id) => els[id] || null,
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: (t) => fakeEl(t),
      head: { appendChild() {} },
      body: { contains: () => true, classList: { add() {}, remove() {} } },
      addEventListener() {}, removeEventListener() {}
    }
  }, extra || {});
  ctx.window = ctx;
  ctx._els = els;
  ctx._calls = calls;
  ctx._posts = posts;
  // Boot, like app.html: state from storage (loadSettings), then FLActiveModel.init()
  ctx.state = {
    isLocal: store.ls.getItem('fl_isLocal') === 'true',
    provider: store.ls.getItem('fl_provider') || 'groq',
    ollamaModel: store.ls.getItem('fl_ollamaModel') || 'llama3.2',
    apiKey: null
  };
  vm.runInNewContext(safeSrc + '\n' + modelSrc + '\nwindow.FreeLattice = window.FreeLattice || {};\n' + callAISrc, ctx);
  ctx.FLActiveModel.init();
  vm.runInNewContext(mod, ctx);
  return ctx;
}

// Connect host whose innerHTML turns .flc-models lists into fake lists (like the browser would).
function connectHost() {
  const host = { hidden: false, lists: [], _html: '', scrollIntoView() {} };
  Object.defineProperty(host, 'innerHTML', {
    get() { return this._html; },
    set(v) {
      this._html = String(v);
      this.lists = [];
      const re = /class="flc-models"[^>]*?data-flc-names="([^"]*)"/g;
      let m;
      while ((m = re.exec(this._html))) {
        const json = m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
        const list = fakeEl('div');
        list.attrs['data-flc-names'] = json;
        this.lists.push(list);
      }
    }
  });
  host.querySelectorAll = (sel) => (sel === '.flc-models' ? host.lists : []);
  return host;
}

(async () => {
  assert.ok(/v-model-choice-sticks-v0/.test(mod), 'marker in fl-connect.js');
  assert.ok(/v-model-choice-sticks-v0/.test(app), 'marker in app.html');

  // ── 1. Connect: tap the SECOND model
  const store = store0();
  let p = page(store);
  const host = connectHost();
  p.FlConnect.mount(host);
  await flush();
  const buttons = [].concat(...host.lists.map((l) => l.children));
  const names = buttons.map((b) => b.textContent);
  assert.deepStrictEqual(names, ['llama3.2:latest', 'qwen2.5:latest'], 'Connect lists both models: ' + JSON.stringify(names));
  buttons[1].click();
  await flush();
  assert.strictEqual(p.state.ollamaModel, 'qwen2.5:latest', 'tap sets qwen2.5');
  assert.strictEqual(p.state.isLocal, true, 'local mode on');
  assert.strictEqual(store.s.fl_modelSource, 'user', 'the tap is recorded as the person\'s own choice');
  assert.strictEqual(p.FLActiveModel.isUserChosen(), true, 'FLActiveModel says user');
  assert.strictEqual(store.s.fl_preferred_text_model, 'qwen2.5:latest', 'preferred text model follows the tap');
  p.FlConnect.unmount();

  // ── 2. Tab change straight to Chat, then Settings (the automatic picker runs on every tab change)
  p.FLAutoModel.onTabChanged('chat');
  await flush();
  assert.strictEqual(p.state.ollamaModel, 'qwen2.5:latest', 'Chat tab: still qwen2.5');
  p.FLAutoModel.onTabChanged('settings');
  await flush();
  assert.strictEqual(p.state.ollamaModel, 'qwen2.5:latest', 'Settings: still qwen2.5');
  assert.strictEqual(store.s.fl_ollamaModel, 'qwen2.5:latest', 'storage still qwen2.5');

  // ── 3. The chat request uses it
  let reply = null;
  p.FreeLattice.callAI('sys', 'hello', { callback: (r) => { reply = r; } });
  await flush();
  assert.strictEqual(p._posts.length, 1, 'one chat request');
  assert.strictEqual(p._posts[0].body.model, 'qwen2.5:latest', 'chat request body uses the chosen model');
  assert.strictEqual(reply, 'ok', 'reply arrives');
  assert.ok(/modelId = state\.ollamaModel \|\| 'llama3\.2';/.test(app), 'main Chat send also reads state.ollamaModel');

  // ── 4. Reload: a fresh page from the same storage, then a tab change and Settings
  p = page(store);
  assert.strictEqual(p.state.ollamaModel, 'qwen2.5:latest', 'reload: state from storage');
  assert.strictEqual(p.FLActiveModel.isUserChosen(), true, 'reload: still the person\'s choice');
  p.FLAutoModel.onTabChanged('chat');
  p.FLAutoModel.onTabChanged('settings');
  await flush();
  assert.strictEqual(p.state.ollamaModel, 'qwen2.5:latest', 'reload + tabs: still qwen2.5');
  p.FreeLattice.callAI('sys', 'again', { callback() {} });
  await flush();
  assert.strictEqual(p._posts[0].body.model, 'qwen2.5:latest', 'after reload the chat request still uses qwen2.5');
  assert.strictEqual(p.toasts.length, 0, 'nothing to say while the choice is installed');

  // ── 5. The chosen model left this computer: fill in, and say so (textContent via showToast)
  p.installed = [{ name: 'llama3.2:latest' }, { name: 'llava:7b' }];
  p.FLAutoModel.invalidateCache();
  p.FLAutoModel.onTabChanged('chat');
  await flush();
  assert.strictEqual(p.state.ollamaModel, 'llama3.2:latest', 'gone: first installed text model fills in');
  assert.strictEqual(p.FLActiveModel.get().source, 'auto', 'fill-in is automatic, not the person\'s choice');
  assert.ok(p.toasts.some((t) => /qwen2\.5:latest, is no longer on this computer\. Using llama3\.2:latest for now\./.test(t)), 'says so plainly: ' + JSON.stringify(p.toasts));
  assert.strictEqual(store.s.fl_modelChoiceGone, 'qwen2.5:latest', 'the gone choice is remembered');

  // ── 6. A quiet Ollama never replaces a choice
  {
    const st = store0({ fl_isLocal: 'true', fl_provider: 'ollama', fl_ollamaModel: 'qwen2.5:latest', fl_modelSource: 'user' });
    const q = page(st);
    q.installed = [];
    q.FLAutoModel.onTabChanged('chat');
    await flush();
    assert.strictEqual(q.state.ollamaModel, 'qwen2.5:latest', 'empty answer: choice kept');
    assert.strictEqual(q.toasts.length, 0, 'empty answer: nothing said');
    // 'qwen2.5' (no tag) still matches 'qwen2.5:latest'
    const st2 = store0({ fl_isLocal: 'true', fl_provider: 'ollama', fl_ollamaModel: 'qwen2.5', fl_modelSource: 'user' });
    const q2 = page(st2);
    q2.FLAutoModel.onTabChanged('chat');
    await flush();
    assert.strictEqual(q2.state.ollamaModel, 'qwen2.5', 'untagged name counts as installed');
  }

  // ── 7. No user choice yet: the automatic picker still fills in (unchanged behavior)
  {
    const st = store0({ fl_isLocal: 'true', fl_provider: 'ollama', fl_ollamaModel: 'qwen2.5:latest' });
    const a = page(st);
    a.FLAutoModel.onTabChanged('chat');
    await flush();
    assert.strictEqual(a.state.ollamaModel, 'llama3.2:latest', 'no choice: auto picks the first text model as before');
  }

  // ── 8. Tree: markUserChoice is a quiet no-op (no FLActiveModel there)
  {
    const st = store0();
    const t = { localStorage: st.ls, location: { hostname: 'thelatticetree.com', protocol: 'https:', hash: '', search: '' },
      document: { documentElement: { getAttribute: () => '' }, getElementById: () => null, addEventListener() {}, body: { classList: { add() {}, remove() {} } } },
      console, JSON, String, parseInt, URL, Date, Math, Promise, setTimeout: () => 1, clearTimeout() {} };
    t.window = t;
    vm.runInNewContext(mod, t);
    assert.strictEqual(t.FlConnect.markUserChoice('qwen2.5:latest'), false, 'Tree: no-op');
  }

  // ── 9. Settings row comes back after Local (createElement/textContent)
  {
    const actions = fakeEl('div');
    const ctx = { document: { createElement: (t) => fakeEl(t) }, window: {} };
    ctx.window = ctx;
    vm.runInNewContext(settingsSrc, ctx);
    ctx.flRefillSettingsActions(actions);
    assert.deepStrictEqual(actions.children.map((b) => b.textContent), ['Change Provider', 'Test Connection', '\uD83C\uDFE0 a mind at home'], 'row refilled');
    ctx.flRefillSettingsActions(actions);
    assert.strictEqual(actions.children.length, 3, 'never doubled');
    const local = between(app, "if (mode === 'local') {", 'v-connect-card-yesno-wizard-v0 — Local mode');
    assert.ok(/actionsDiv\.innerHTML = '';\s*\n\s*\/\/ v-model-choice-sticks-v0[^\n]*\n\s*flRefillSettingsActions\(actionsDiv\);/.test(local), 'Local refills the row right after emptying it');
  }

  // ── 10. Helped Bridge on a typed port, no mind behind it: honest words, nothing saved as the Ollama door
  {
    const st = store0({ fl_localPort_manual: '11500' });
    const b = page(st, {
      fetch: async (url) => {
        url = String(url);
        if (/127\.0\.0\.1:11500\/bridge\/health$/.test(url)) return { ok: true, status: 200, json: async () => ({ bridge: true, helped: true, port: 11500 }) };
        if (/127\.0\.0\.1:11500\/api\/tags$/.test(url)) return { ok: false, status: 502, json: async () => ({}) };
        throw new Error('quiet');
      }
    });
    const rep = await b.FlConnect.probe({ gesture: true });
    assert.strictEqual(rep.manualQuiet, true, 'still quiet');
    assert.strictEqual(rep.bridgeNoMind, true, 'Bridge answered, no mind');
    assert.ok(!('fl_ollamaHost' in st.s), 'not saved as the Ollama host');
    assert.ok(!('fl_bridgePort' in st.s), 'not saved as the Bridge port until a mind answers');
    const h = connectHost();
    b.FlConnect.mount(h);
    await flush();
    assert.ok(/Your Bridge answered on 11500, but no mind is running behind it yet\./.test(h.innerHTML), 'honest words');
    assert.ok(!/Nothing answered on/.test(h.innerHTML), 'no false "Nothing answered"');
    b.FlConnect.unmount();
    // and when the mind is there, it is saved as before
    const st2 = store0({ fl_localPort_manual: '11500' });
    const b2 = page(st2, {
      fetch: async (url) => {
        url = String(url);
        if (/127\.0\.0\.1:11500\/bridge\/health$/.test(url)) return { ok: true, status: 200, json: async () => ({ bridge: true, helped: true, port: 11500 }) };
        if (/127\.0\.0\.1:11500\/api\/tags$/.test(url)) {
          b2._n = (b2._n || 0) + 1;
          if (b2._n === 1) throw new Error('first ask before the Bridge said yes');
          return { ok: true, status: 200, json: async () => ({ models: MODELS }) };
        }
        throw new Error('quiet');
      }
    });
    const rep2 = await b2.FlConnect.probe({ gesture: true });
    assert.strictEqual(rep2.models.length, 2, 'mind behind the Bridge found');
    assert.strictEqual(st2.s.fl_ollamaHost, '127.0.0.1:11500', 'saved once a mind answers');
    assert.strictEqual(st2.s.fl_bridgePort, '11500', 'Bridge port saved once a mind answers');
  }

  // ── Locks
  assert.strictEqual(fs.readFileSync(path.join(repo, 'index.html'), 'utf8'), app, 'index.html identical to docs/app.html');
  let mainSw = null;
  try { mainSw = execSync('git show origin/main:sw.js', { cwd: repo, encoding: 'utf8' }); } catch (e) {}
  if (mainSw !== null) {
    assert.strictEqual(fs.readFileSync(path.join(repo, 'sw.js'), 'utf8'), mainSw, 'root sw.js byte-identical to main');
    const changed = execSync('git diff --name-only origin/main', { cwd: repo, encoding: 'utf8' }).split('\n');
    assert.ok(!changed.includes('docs/sw.js'), 'docs/sw.js untouched');
    const added = execSync('git diff origin/main -- docs/app.html docs/modules/fl-connect.js', { cwd: repo, encoding: 'utf8' })
      .split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'));
    assert.ok(!added.some((l) => /\bconfirm\(/.test(l)), 'no confirm() added');
    assert.ok(!added.some((l) => /\u2014/.test(l)), 'no em dashes added');
    assert.ok(!added.some((l) => /['"]\*['"]/.test(l) && /origin/i.test(l)), 'no bare * origin');
  }
  const markers = execSync("grep -rnE '^(<<<<<<<|=======|>>>>>>>)( |$)' docs index.html tests || true", { cwd: repo, encoding: 'utf8' });
  assert.ok(!markers.trim(), 'no conflict markers');
  const re = /<script(\s[^>]*)?>/gi; let m; let n = 0;
  while ((m = re.exec(app))) {
    const attrs = m[1] || '';
    if (/\bsrc\s*=/i.test(attrs) || /type\s*=\s*["']application\/(ld\+)?json/i.test(attrs)) continue;
    const start = m.index + m[0].length; const end = app.indexOf('</script>', start);
    if (end < 0) continue;
    const s = app.slice(start, end).trim();
    if (!s || !/^(?:\/[\/*]|function\b|var\b|let\b|const\b|window\.|document\.|\(|\{|if\b)/.test(s)) continue;
    try { new Function(s); n++; } catch (e) { assert.fail('inline script parse fail: ' + e.message); }
  }
  assert.ok(n > 10, 'inline scripts parse: ' + n);
  console.log('SMOKE_OK model choice sticks v0.1');
})().catch((e) => { console.error(e); process.exit(1); });
