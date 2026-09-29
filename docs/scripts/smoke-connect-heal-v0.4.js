#!/usr/bin/env node
// v-connect-heal-v0.4: Hypha walk 3 heals (FreeLattice side).
// Quiet Bridge interval, cold #connect lands once, manual port asks for
// Yes, help, Use automatic really clears, loopback-only Ollama Address,
// no silent connect or model pick, modal self-heal, remember keeps isLocal.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const repo = path.join(root, '..');
const read = (r) => fs.readFileSync(path.join(root, r), 'utf8');
const app = read('app.html');
const mod = read('modules/fl-connect.js');
const indexHtml = fs.readFileSync(path.join(repo, 'index.html'), 'utf8');
const rootSw = fs.readFileSync(path.join(repo, 'sw.js'), 'utf8');

function fnBody(src, sig) {
  const i = src.indexOf(sig);
  assert.ok(i >= 0, 'missing ' + sig);
  const end = src.indexOf('\n}\n', i);
  return src.slice(i, end + 2);
}

// Markers
assert.ok(/v-connect-heal-v0\.4/.test(mod), 'marker in fl-connect.js');
assert.ok(/v-connect-heal-v0\.4/.test(app), 'marker in app.html');

// Item 2: Bridge interval is quiet
const boot = app.slice(app.indexOf('(function flBridgeDetectBoot()'), app.indexOf('window.flBridgeDetect = flBridgeDetect;'));
assert.ok(!/setInterval\(run,\s*20000\)/.test(boot), 'no forever 11-port scan');
assert.ok(/flBridgeQuietTick/.test(boot) && /document\.hidden/.test(boot) && /flBridgeHealthAt\(saved\)/.test(boot), 'quiet tick: visible, saved port only');

// Item 3: cold #connect
const go = app.slice(app.indexOf('var _flcUserMoved = false;'), app.indexOf("window.addEventListener('hashchange', goConnect)"));
assert.ok(/_flcUserMoved/.test(go) && /pointerdown/.test(app) && /history\.replaceState/.test(go), 'first tap ends retries and clears #connect');
assert.ok(/tab-connect[\s\S]{0,120}classList\.contains\('active'\)\) return;/.test(go), 'no remount when Connect already showing');

// Item 5: manual port wins in getOllamaBaseUrl
const gob = fnBody(app, 'function getOllamaBaseUrl() {');
assert.ok(gob.indexOf('flManualBaseFirst()') > 0 && gob.indexOf('flManualBaseFirst()') < gob.indexOf("fl_ollamaHost"), 'manual before fl_ollamaHost');

// Item 6: loopback-only Settings address, runtime check
assert.ok(!/Change to a remote IP/.test(app), 'no remote IP invite');
assert.ok(/id="ollamaHostRefusal"/.test(app), 'refusal line present');
{
  const store = { fl_ollamaHost: '127.0.0.1:11434' };
  const els = {
    ollamaHostInput: { value: '' },
    ollamaHostRefusal: { hidden: true, textContent: '' }
  };
  const ctx = {
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; }
    },
    document: { getElementById: (id) => els[id] || null },
    URL,
    _ollamaResolvedBase: { base: 'x' },
    updateOllamaProviderUrl() {},
    FLBoxPointer: undefined
  };
  vm.runInNewContext(fnBody(app, 'function flWriteOllamaHostLoopbackOnly(host) {') + fnBody(app, 'function flSaveOllamaHost() {') + '\nthis.save = flSaveOllamaHost;', ctx);
  els.ollamaHostInput.value = '192.168.1.50:11434';
  ctx.save();
  assert.strictEqual(store.fl_ollamaHost, '127.0.0.1:11434', 'LAN refused, saved address unchanged');
  assert.strictEqual(els.ollamaHostRefusal.hidden, false, 'friendly refusal shown');
  assert.ok(/only talks to your own computer/.test(els.ollamaHostRefusal.textContent), 'refusal words');
  els.ollamaHostInput.value = 'localhost:11500';
  ctx.save();
  assert.strictEqual(store.fl_ollamaHost, '127.0.0.1:11500', 'loopback port saved as 127.0.0.1');
  assert.strictEqual(els.ollamaHostRefusal.hidden, true, 'refusal clears');
}

// Item 7: no silent connect or model pick
const co = app.slice(app.indexOf('function connectOllama(models) {'), app.indexOf('// Main app load detection'));
assert.ok(co.indexOf('FlConnect.open()') > 0 && co.indexOf('FlConnect.open()') < co.indexOf('models[0].name'), 'connectOllama opens Connect before any models[0]');
assert.ok(!/Connected to a mind on this computer!/.test(app), 'toast no longer claims connected');
const ac = app.slice(app.indexOf('function flAutoConnect(opts) {'), app.indexOf('var targets = ['));
assert.ok(/FlConnect\.open/.test(ac) && /return;\s*\}/.test(ac), 'Zero-Click returns before probing when FlConnect exists');

const ad = app.slice(app.indexOf('async function autoDiscoverAI() {'), app.indexOf('// Auto-connect to the best ready server'));
assert.ok(/if \(window\.FlConnect && typeof FlConnect\.open === 'function'\) return false;/.test(ad), 'autoDiscoverAI finds but never connects by itself');
assert.ok(/flOllamaToast'\); if \(tt\) tt\.classList\.remove\('fl-toast-show'\)/.test(mod), 'toast stops asking after a mind is chosen');

// Item 8: Settings Local opens Connect; modal self-heals
const ssm = app.slice(app.indexOf("if (mode === 'local') {"), app.indexOf("flOpenConnectWizard('local')"));
assert.ok(/FlConnect\.open\(\)[\s\S]{0,40}return;/.test(ssm), 'Local mode opens Connect first');
assert.ok(/modalOverlayEl && !document\.body\.contains\(modalOverlayEl\)\) modalOverlayEl = null;/.test(app), 'openModal forgets detached overlay');
assert.ok(/data-flc-cloud-key/.test(mod) && /AiSetup\.openModal\(\)/.test(mod), 'Connect has a real cloud key door');
// v0.4.1: the core reads root.AiSetup; const AiSetup is not on window unless exposed
assert.ok(/\nwindow\.AiSetup = AiSetup;\n/.test(app), 'AiSetup visible to the shared core (Add a cloud key renders)');

// fl-connect.js runtime: items 4, 5, 10
function sandbox(store, extra) {
  const sb = Object.assign({
    localStorage: {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; }
    },
    location: { hostname: 'freelattice.com', protocol: 'https:', hash: '', search: '' },
    document: {
      hidden: false,
      documentElement: { getAttribute: () => '', classList: { add() {}, remove() {}, contains() { return false; } } },
      getElementById: () => null,
      head: { appendChild() {} },
      body: { contains: () => false, classList: { add() {}, remove() {} } },
      addEventListener() {}, removeEventListener() {}, querySelectorAll: () => []
    },
    fetch: async () => { throw new Error('offline'); },
    setTimeout: () => 1, clearTimeout() {},
    navigator: { userAgent: 't' },
    console, JSON, String, parseInt, URL, Date, Math,
    AbortSignal: { timeout: () => undefined }
  }, extra || {});
  sb.window = sb;
  vm.runInNewContext(mod, sb);
  return sb;
}

(async () => {
  // Item 4: manual port answered by an un-helped Bridge asks for Yes, help
  {
    const store = { fl_localPort_manual: '11500' };
    const sb = sandbox(store, {
      fetch: async (url) => {
        if (/11500\/bridge\/health/.test(url)) return { ok: true, json: async () => ({ bridge: true, helped: false, port: 11500 }) };
        throw new Error('quiet');
      }
    });
    const r = await sb.FlConnect.probe({});
    assert.strictEqual(r.waitingHelp, true, 'waitingHelp');
    assert.strictEqual(r.manualQuiet, false, 'not Nothing answered');
  }
  // Item 5: refusal keeps previous port and says so; Use automatic clears matching host
  {
    const store = { fl_localPort_manual: '11500', fl_ollamaHost: '127.0.0.1:11500' };
    const sb = sandbox(store);
    const res = sb.FlConnect.setManualHost('192.168.1.5:11434');
    assert.strictEqual(res.ok, false, 'LAN refused');
    assert.ok(/Still using 11500/.test(res.message), 'says which port stays');
    assert.strictEqual(store.fl_localPort_manual, '11500', 'previous port kept, not silently changed');
    sb._ollamaResolvedBase = { base: 'http://127.0.0.1:11500' };
    sb.FlConnect.clearManualHost();
    assert.ok(!('fl_localPort_manual' in store), 'manual cleared');
    assert.ok(!('fl_ollamaHost' in store), 'matching fl_ollamaHost cleared');
    assert.strictEqual(sb._ollamaResolvedBase, null, 'cached base cleared');
    store.fl_localPort_manual = '11500'; store.fl_ollamaHost = '127.0.0.1:11435';
    sb.FlConnect.clearManualHost();
    assert.strictEqual(store.fl_ollamaHost, '127.0.0.1:11435', 'other hosts left alone');
  }
  assert.ok(/\(cur \? '<button type="button" class="flc-btn flc-primary" data-flc-use-auto>Use automatic<\/button>' : ''\)/.test(mod), 'Use automatic beside every picker when a port is set');
  assert.ok(/_manualRejectMsg = ''; \/\/ v-connect-heal-v0\.4/.test(mod), 'refusal shown once');
  // Item 10: remember keeps isLocal true through handleLocalToggle
  {
    const store = {};
    const toggle = { checked: false };
    const sb = sandbox(store);
    sb.state = { isLocal: false };
    sb.document.getElementById = (id) => (id === 'localToggle' ? toggle : null);
    sb.handleLocalToggle = function () { sb.state.isLocal = toggle.checked; };
    sb.FlConnect.remember({ name: 'llama3.2:latest', base: 'http://127.0.0.1:11434' });
    assert.strictEqual(sb.state.isLocal, true, 'isLocal survives handleLocalToggle');
    assert.strictEqual(store.fl_isLocal, 'true', 'fl_isLocal saved');
  }

  // Locks
  assert.strictEqual(indexHtml, app, 'root index.html identical to docs/app.html');
  let mainSw = null;
  try { mainSw = execSync('git show origin/main:sw.js', { cwd: repo, encoding: 'utf8' }); } catch (e) {}
  if (mainSw !== null) {
    assert.strictEqual(rootSw, mainSw, 'root sw.js byte-identical to main');
    const changed = execSync('git diff --name-only origin/main', { cwd: repo, encoding: 'utf8' }).split('\n');
    assert.ok(!changed.includes('docs/sw.js') && !changed.includes('sw.js'), 'sw.js untouched');
    const added = execSync('git diff origin/main -- docs/app.html docs/modules/fl-connect.js', { cwd: repo, encoding: 'utf8' })
      .split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'));
    assert.ok(!added.some((l) => /\bconfirm\(/.test(l)), 'no confirm() added');
    assert.ok(!added.some((l) => /\u2014/.test(l)), 'no em dashes in added lines');
  }
  const markers = execSync("grep -rnE '^(<<<<<<<|=======|>>>>>>>)( |$)' docs index.html tests || true", { cwd: repo, encoding: 'utf8' });
  assert.ok(!markers.trim(), 'no conflict markers: ' + markers);
  // All inline scripts parse (same extractor as smoke-connect-port-picker.js)
  const re = /<script(\s[^>]*)?>/gi; let m; let n = 0;
  while ((m = re.exec(app))) {
    const attrs = m[1] || '';
    if (/\bsrc\s*=/i.test(attrs) || /type\s*=\s*["']application\/(ld\+)?json/i.test(attrs)) continue;
    const start = m.index + m[0].length; const end = app.indexOf('</script>', start);
    if (end < 0) continue;
    const s = app.slice(start, end).trim();
    if (!s || !/^(?:\/[\/*]|function\b|var\b|let\b|const\b|window\.|document\.|\(|\{|if\b)/.test(s)) continue;
    try { new Function(s); n++; } catch (e) { assert.fail('inline script parse fail: ' + e.message + '\n' + s.slice(0, 120)); }
  }
  assert.ok(n > 10, 'inline scripts checked: ' + n);
  new vm.Script(mod);
  console.log('SMOKE_OK connect heal v0.4');
})().catch((e) => { console.error(e); process.exit(1); });
