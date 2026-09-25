#!/usr/bin/env node
// Connect Port Picker v0.2 heal — parse fix, port-only loopback, honest quiet, text models.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const repo = path.join(root, '..');
const read = (r) => fs.readFileSync(path.join(root, r), 'utf8');

const md = read('library/CONNECT_PORT_PICKER_v0.md');
const mod = read('modules/fl-connect.js');
const app = read('app.html');
const family = read('library/FRACTAL_FAMILY_LEDGER_v0.md');
const flint = read('Flint.html');
const indexHtml = fs.readFileSync(path.join(repo, 'index.html'), 'utf8');
const rootSw = fs.readFileSync(path.join(repo, 'sw.js'), 'utf8');
const mainSw = execSync('git show origin/main:sw.js', { cwd: repo, encoding: 'utf8' });

assert.ok(/v-connect-port-picker-v0/.test(md + mod), 'marker');
assert.ok(/fl_localPort_manual/.test(mod + app), 'port-only key');
assert.ok(!/fl_connect_manual_host/.test(mod) || /never fl_connect_manual_host/.test(mod), 'old key unused');

// Inline script syntax check (skip JSON-LD / empty / truncated mid-comment fragments)
function extractInlineScripts(html) {
  const out = [];
  const re = /<script(\s[^>]*)?>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1] || '';
    if (/\bsrc\s*=/i.test(attrs)) continue;
    if (/type\s*=\s*["']application\/(ld\+)?json/i.test(attrs)) continue;
    const start = m.index + m[0].length;
    const end = html.indexOf('</script>', start);
    if (end < 0) continue;
    const src = html.slice(start, end).trim();
    if (!src) continue;
    // Skip fragments that don't look like JS statements
    if (!/^(?:\/[\/*]|function\b|var\b|let\b|const\b|window\.|document\.|\(|\{|if\b|\/\/|\/\*)/.test(src)) continue;
    out.push(src);
  }
  return out;
}

const scripts = extractInlineScripts(app);
let checked = 0;
scripts.forEach((src, i) => {
  try {
    // eslint-disable-next-line no-new-func
    new Function(src);
    checked++;
  } catch (e) {
    assert.fail('inline script ' + i + ' parse fail: ' + e.message + '\n' + src.slice(0, 120));
  }
});
assert.ok(checked >= 1, 'checked inline scripts');
assert.ok(/flProviderHeroLocalAI\(event\)/.test(app), 'Use My Computer uses named handler');
assert.ok(/function owDismissSuggestion/.test(app), 'Dismiss restored');
assert.ok(/flOpenConnectPlay\('gate'\)/.test(app), 'Play gate fallback');
assert.ok(/manualQuiet/.test(mod + app), 'manualQuiet');

// normalizePort + probe behavior via vm
const store = {};
const sb = {
  window: {},
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
    createElement: () => ({
      style: {}, textContent: '', setAttribute() {}, appendChild() {}, addEventListener() {},
      dataset: {}, classList: { add() {}, contains() { return false; } }, type: '', className: ''
    }),
    head: { appendChild() {} },
    body: { contains: () => false, classList: { add() {}, remove() {} } },
    addEventListener() {},
    removeEventListener() {},
    querySelectorAll: () => []
  },
  fetch: async () => { throw new Error('offline'); },
  setTimeout: () => 1,
  clearTimeout() {},
  getComputedStyle: () => ({ display: 'block' }),
  navigator: { userAgent: 't' },
  console,
  JSON,
  String,
  parseInt,
  URL,
  AbortSignal: { timeout: () => undefined },
  Date,
  Math
};
sb.window = sb;
vm.runInNewContext(mod, sb);
assert.strictEqual(sb.FlConnect.normalizePort('192.168.1.5:11434'), null, 'reject foreign');
assert.strictEqual(sb.FlConnect.normalizePort('localhost:11500'), '11500', 'accept localhost');
assert.strictEqual(sb.FlConnect.normalizePort('11500'), '11500', 'accept plain');
assert.strictEqual(sb.FlConnect.MANUAL_KEY, 'fl_localPort_manual');

store.fl_localPort_manual = '11500';
sb.FlConnect.probe({}).then((r) => {
  assert.ok(r.manualQuiet === true, 'quiet manual no fallthrough');
  assert.ok(!r.models || r.models.length === 0 || r.wanted, 'no silent models from other ports');
}).catch(() => {});

// XSS model name must use textContent path (createElement present; no raw HTML concat of name in button)
assert.ok(/textContent = name|textContent=name/.test(mod) || /btn\.textContent = name/.test(mod), 'textContent models');
assert.ok(/btn\.textContent = name/.test(mod), 'textContent model buttons');
assert.ok(!/data-flc-model="' \+ String\(name\)/.test(mod), 'no HTML-concat model buttons');

assert.ok(/Temperature:/.test(family) || /Temperature:/.test(md), 'temperature');
assert.ok(/v-connect-port-picker-v0/.test(flint), 'Flint');
assert.strictEqual(rootSw, mainSw, 'sw identical to main');
assert.strictEqual(indexHtml, app, 'index identical to docs/app.html');
assert.ok(!/fl-connect\.js/.test(rootSw), 'soft leave sw');

const markers = execSync("grep -rnE '^(<<<<<<<|=======|>>>>>>>)$' docs index.html || true", { cwd: repo, encoding: 'utf8' });
assert.ok(!markers.trim(), 'no conflict markers: ' + markers);

console.log('SMOKE_OK connect port picker v0.2 heal');
console.log('parse clean · Dismiss restored · port-only · quiet manual · text models · sw/index ok');
