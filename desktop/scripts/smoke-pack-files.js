#!/usr/bin/env node
// Guard: the packed app can load every local module reached from main.js,
// preload.js, and bridge-preload.js. Walks the transitive require graph
// (require('./x'), require('../x'), and require of a string literal /
// path.join(__dirname, '…')). Simulates the packed layout: build.files
// plus the files prepare-only copies into app/. Then copies that layout
// into a temp dir, stubs electron and node_modules, and requires main.js
// to prove module loading succeeds.
//
// This is the check that would have caught:
//   Error: Cannot find module './lattice-catalog'   (5.8.2)
//   Error: Cannot find module '../docs/modules/fl-bridge.js'  (after catalog was packed)
//
// Usage: node desktop/scripts/smoke-pack-files.js
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const desk = path.join(__dirname, '..');
const repo = path.join(desk, '..');
const ROOTS = ['main.js', 'preload.js', 'bridge-preload.js'];

const BUILTIN = new Set([
  'assert', 'buffer', 'child_process', 'cluster', 'crypto', 'dgram', 'dns',
  'events', 'fs', 'http', 'https', 'net', 'os', 'path', 'querystring',
  'stream', 'string_decoder', 'tls', 'tty', 'url', 'util', 'v8', 'vm',
  'zlib', 'module', 'process', 'timers', 'constants', 'punycode'
]);

function listed(files, name) {
  return files.some((pat) => {
    if (pat === name) return true;
    if (pat.endsWith('/**/*')) {
      const prefix = pat.slice(0, -5); // 'app/**/*' → 'app'
      return name === prefix || name.startsWith(prefix + '/');
    }
    return false;
  });
}

function posix(p) {
  return p.split(path.sep).join('/');
}

function gitLs(paths) {
  try {
    const out = execFileSync('git', ['-C', repo, 'ls-files', '--'].concat(paths), {
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024
    });
    return out.split(/\n/).filter(Boolean);
  } catch (e) {
    return [];
  }
}

// What build-and-release.sh --prepare-only writes under desktop/app/.
// Listed only (no copy of assets/). Matches the committed-bytes copy in that script.
function preparedAppFiles() {
  const map = {}; // packed rel path (posix, under desktop/) → source abs path
  function put(destRel, srcRepoRel) {
    const abs = path.join(repo, srcRepoRel);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) map[destRel] = abs;
  }
  if (gitLs(['docs/app.html']).length) {
    put('app/app.html', 'docs/app.html');
    put('app/index.html', 'docs/app.html');
  } else if (gitLs(['index.html']).length) {
    put('app/app.html', 'index.html');
    put('app/index.html', 'index.html');
  }
  ['manifest.json', 'icon-192.png', 'icon-512.png', 'landing.html'].forEach((f) => {
    if (gitLs([f]).length) put('app/' + f, f);
  });
  if (gitLs(['docs/sw.js']).length) put('app/sw.js', 'docs/sw.js');
  else if (gitLs(['sw.js']).length) put('app/sw.js', 'sw.js');

  gitLs(['lib', 'modules']).forEach((f) => {
    if (!/\.js$/.test(f)) return;
    if (f.startsWith('lib/') || f.startsWith('modules/')) put('app/' + f, f);
  });
  // docs/{modules,css,lib,assets} win over older root copies (script runs this last).
  gitLs(['docs/modules', 'docs/css', 'docs/lib', 'docs/assets']).forEach((f) => {
    if (!f.startsWith('docs/')) return;
    put('app/' + f.slice('docs/'.length), f);
  });
  return map;
}

function packedSet(pkg) {
  const files = (pkg.build && pkg.build.files) || [];
  const set = new Set();
  const sources = {}; // rel → abs
  files.forEach((pat) => {
    if (pat.endsWith('/**/*')) return;
    const abs = path.join(desk, pat);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      set.add(pat);
      sources[pat] = abs;
    }
  });
  const prepared = preparedAppFiles();
  Object.keys(prepared).forEach((rel) => {
    if (listed(files, rel)) {
      set.add(rel);
      sources[rel] = prepared[rel];
    }
  });
  // Anything already sitting in desktop/app/ (rare; usually gitignored empty).
  function walkApp(dir, rel) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach((n) => {
      if (n === '.gitkeep') return;
      const p = path.join(dir, n);
      const r = rel ? rel + '/' + n : 'app/' + n;
      if (fs.statSync(p).isDirectory()) walkApp(p, r);
      else if (listed(files, r)) {
        set.add(r);
        if (!sources[r]) sources[r] = p;
      }
    });
  }
  walkApp(path.join(desk, 'app'), '');
  return { set: set, sources: sources, files: files };
}

function candidatesFor(spec, extHint) {
  if (path.posix.extname(spec)) return [spec];
  return [spec + '.js', spec + '.json', spec + '/index.js'];
}

function resolveInPack(fromRel, spec, pack) {
  if (!spec || (!spec.startsWith('./') && !spec.startsWith('../') && !spec.startsWith('app/'))) {
    return { kind: 'external', spec: spec };
  }
  const fromDir = path.posix.dirname(fromRel);
  const joined = path.posix.normalize((fromDir === '.' ? '' : fromDir + '/') + spec);
  if (joined.startsWith('../') || joined === '..') {
    return { kind: 'outside', spec: spec, resolved: joined };
  }
  const rel = joined.replace(/^\.\//, '');
  for (const c of candidatesFor(rel)) {
    if (pack.set.has(c)) return { kind: 'packed', spec: spec, resolved: c };
  }
  return { kind: 'missing', spec: spec, resolved: rel };
}

function pathJoinDirname(argSrc) {
  // path.join(__dirname, 'a', 'b') → relative posix path, or null if not static.
  const m = argSrc.match(/^path\.join\(\s*__dirname\s*((?:\s*,\s*['"][^'"]*['"])+)\s*\)$/);
  if (!m) return null;
  const parts = [];
  const re = /['"]([^'"]*)['"]/g;
  let x;
  while ((x = re.exec(m[1]))) parts.push(x[1]);
  return path.posix.normalize(parts.join('/'));
}

function stringLiteral(argSrc) {
  const m = argSrc.match(/^['"](\.\.?\/[^'"]+)['"]$/);
  return m ? m[1] : null;
}

function collectRequires(src) {
  // Returns a list of { specs: [relative or path-join-relative], dynamic: bool }
  const sites = [];
  const assign = {}; // ident → list of specs

  // ident = path.join(__dirname, ...) or ident = './x' or const {..} skipped
  const assignRe = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;]+);/g;
  let am;
  while ((am = assignRe.exec(src))) {
    const expr = am[2].trim();
    const lit = stringLiteral(expr) || pathJoinDirname(expr);
    if (lit) assign[am[1]] = [lit];
  }

  // arrays of path.join / literals: const candidates = [ path.join(...), path.join(...) ]
  const arrRe = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\[([^\]]*)\]/g;
  let arm;
  while ((arm = arrRe.exec(src))) {
    const parts = arm[2].split(',').map((s) => s.trim()).filter(Boolean);
    const specs = [];
    parts.forEach((p) => {
      const lit = stringLiteral(p) || pathJoinDirname(p);
      if (lit) specs.push(lit);
    });
    if (specs.length) assign[arm[1]] = specs;
  }

  function addSite(arg, extraSpecs) {
    const specs = extraSpecs ? extraSpecs.slice() : [];
    const lit = stringLiteral(arg);
    const join = pathJoinDirname(arg);
    if (lit) specs.push(lit);
    else if (join) specs.push(join);
    else if (/^[A-Za-z_$][\w$]*$/.test(arg) && assign[arg]) specs.push.apply(specs, assign[arg]);
    if (!specs.length) return;
    sites.push({ specs: specs, raw: arg });
  }

  const reqRe = /require\s*\(\s*([^)]+?)\s*\)/g;
  let m;
  while ((m = reqRe.exec(src))) addSite(m[1].trim());

  // import('literal') — only local relative / path-join
  const impRe = /import\s*\(\s*([^)]+?)\s*\)/g;
  while ((m = impRe.exec(src))) addSite(m[1].trim());

  return sites;
}

function walkGraph(pack) {
  const missing = [];
  const seen = [];
  const visited = new Set();
  const queue = ROOTS.slice();

  while (queue.length) {
    const fromRel = queue.shift();
    if (visited.has(fromRel)) continue;
    visited.add(fromRel);
    const abs = pack.sources[fromRel];
    if (!abs || !fs.existsSync(abs)) {
      missing.push('entry ' + fromRel + ' is not in the packed layout');
      continue;
    }
    const src = fs.readFileSync(abs, 'utf8');
    function resolveSpec(spec) {
      if (!spec) return { kind: 'external', spec: spec };
      if (spec.startsWith('app/')) return resolveInPack(fromRel, './' + spec, pack);
      if (spec.startsWith('./') || spec.startsWith('../')) return resolveInPack(fromRel, spec, pack);
      const root = spec.split('/')[0];
      if (BUILTIN.has(spec) || BUILTIN.has(root) || !spec.includes('/')) return { kind: 'external', spec: spec };
      return resolveInPack(fromRel, './' + spec, pack);
    }
    const resolvedSites = collectRequires(src).map((site) => {
      const results = site.specs.map(resolveSpec);
      const locals = results.filter((r) => r.kind !== 'external');
      locals.forEach((r) => seen.push({ from: fromRel, spec: r.spec, resolved: r.resolved || r.spec, kind: r.kind }));
      return { site: site, locals: locals };
    }).filter((s) => s.locals.length);
    const packedNames = new Set();
    resolvedSites.forEach((s) => {
      s.locals.forEach((r) => {
        if (r.kind === 'packed' && r.resolved) packedNames.add(path.posix.basename(r.resolved));
      });
    });
    resolvedSites.forEach((s) => {
      const packed = s.locals.filter((r) => r.kind === 'packed');
      if (packed.length) {
        packed.forEach((r) => { if (!visited.has(r.resolved)) queue.push(r.resolved); });
        return;
      }
      // Dev fallback: same basename as a packed path.join(__dirname, …) in this file.
      const bases = s.locals.map((r) => path.posix.basename(r.resolved || r.spec));
      if (bases.some((b) => packedNames.has(b))) return;
      const desc = s.locals.map((r) => r.spec + (r.resolved ? ' → ' + r.resolved : '') + ' (' + r.kind + ')').join('; ');
      missing.push(fromRel + ' requires ' + desc + ' — not in the packed layout');
    });
  }
  return { missing: missing, seen: seen, visited: visited };
}

function writeStub(dir, name, body) {
  const d = path.join(dir, 'node_modules', name);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'package.json'), JSON.stringify({ name: name, main: 'index.js' }) + '\n');
  fs.writeFileSync(path.join(d, 'index.js'), body);
}

function stubModules(root) {
  writeStub(root, 'electron', [
    "'use strict';",
    "const { EventEmitter } = require('events');",
    'const app = new EventEmitter();',
    'app.isPackaged = true;',
    'app.isQuitting = false;',
    "app.getPath = function (n) { return require('path').join(require('os').tmpdir(), 'fl-pack-sim-user', String(n)); };",
    'app.getAppPath = function () { return process.cwd(); };',
    'app.whenReady = function () { return new Promise(function () {}); };',
    'app.quit = function () {};',
    'function Fake() {}',
    'Fake.buildFromTemplate = function () { return {}; };',
    'Fake.setApplicationMenu = function () {};',
    "Fake.createFromPath = function () { return {}; };",
    'const ipc = { handle: function () {}, on: function () {}, once: function () {} };',
    'module.exports = {',
    '  app: app,',
    '  BrowserWindow: Fake,',
    '  Menu: Fake,',
    '  Tray: Fake,',
    '  shell: { openExternal: function () {} },',
    '  dialog: { showMessageBox: function () {}, showErrorBox: function () {} },',
    '  Notification: Fake,',
    '  ipcMain: ipc,',
    '  nativeImage: Fake,',
    '  session: { defaultSession: { webRequest: { onBeforeSendHeaders: function () {}, onHeadersReceived: function () {} }, protocol: { interceptBufferProtocol: function () {}, registerFileProtocol: function () {} } } },',
    '  webContents: {},',
    '  safeStorage: { isEncryptionAvailable: function () { return false; }, encryptString: function (s) { return Buffer.from(String(s)); }, decryptString: function () { return ""; } }',
    '};',
    ''
  ].join('\n'));
  writeStub(root, 'electron-store', [
    "'use strict';",
    'function Store() { this._d = {}; }',
    'Store.prototype.get = function (k, f) { return this._d[k] !== undefined ? this._d[k] : f; };',
    'Store.prototype.set = function (k, v) { this._d[k] = v; };',
    'module.exports = Store;',
    ''
  ].join('\n'));
  writeStub(root, 'electron-updater', [
    "'use strict';",
    'const autoUpdater = { on: function () { return autoUpdater; }, checkForUpdates: function () {}, logger: null, autoDownload: false };',
    'module.exports = { autoUpdater: autoUpdater };',
    ''
  ].join('\n'));
  writeStub(root, 'bonjour-service', [
    "'use strict';",
    'function Bonjour() {}',
    'Bonjour.prototype.destroy = function () {};',
    'module.exports = { Bonjour: Bonjour };',
    ''
  ].join('\n'));
}

function simulateLoadAndClean(pack) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fl-pack-sim-'));
  let result;
  try {
    const needed = new Set(ROOTS);
    if (pack.visited) pack.visited.forEach((rel) => needed.add(rel));
    needed.add('app/modules/fl-bridge.js');
    pack.set.forEach((rel) => {
      if (/\.(js|json|html)$/.test(rel) && !rel.startsWith('app/')) needed.add(rel);
    });
    needed.forEach((rel) => {
      const src = pack.sources[rel];
      if (!src) return;
      const dest = path.join(tmp, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    });
    stubModules(tmp);
    const script = 'require(' + JSON.stringify(path.join(tmp, 'main.js')) + ');\nconsole.log("PACK_SIM_LOAD_OK");\n';
    const r = spawnSync(process.execPath, ['-e', script], {
      cwd: tmp,
      encoding: 'utf8',
      timeout: 15000,
      env: Object.assign({}, process.env, { NODE_PATH: path.join(tmp, 'node_modules') })
    });
    const out = (r.stdout || '') + (r.stderr || '');
    result = { ok: r.status === 0 && /PACK_SIM_LOAD_OK/.test(out), status: r.status, out: out.trim() };
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  }
  return result;
}

function check(opts) {
  const pkg = JSON.parse(fs.readFileSync(path.join(desk, 'package.json'), 'utf8'));
  const pack = packedSet(pkg);
  const graph = walkGraph(pack);
  pack.visited = graph.visited;
  const missing = graph.missing.slice();
  // Entry roots must themselves be packed.
  ROOTS.forEach((r) => {
    if (!pack.set.has(r)) missing.push('entry ' + r + ' is not in build.files');
  });
  if (!pack.set.has('app/modules/fl-bridge.js')) {
    missing.push('prepare does not place app/modules/fl-bridge.js in the packed layout');
  }

  const sim = simulateLoadAndClean(pack);
  if (!sim.ok) {
    missing.push('packed main.js failed to load: ' + (sim.out || ('exit ' + sim.status)).slice(0, 500));
  }

  if (opts && opts.assertOk) {
    missing.forEach((msg) => opts.assertOk(false, msg));
    if (!missing.length) {
      opts.assertOk(true, 'packed require graph from main/preload/bridge-preload is complete (' + graph.seen.length + ' local requires, load sim ok)');
    }
    return graph.seen.length;
  }
  missing.forEach((msg) => console.error('FAIL ' + msg));
  assert.strictEqual(missing.length, 0, missing.join('\n') || 'pack files ok');
  console.log('checks passed: ' + graph.seen.length + ' local requires, all packed; ' + pack.set.size + ' packed paths; main.js load sim ok');
  console.log('SMOKE_OK pack files');
  return graph.seen.length;
}

if (require.main === module) check();

module.exports = { check, listed, packedSet, walkGraph, preparedAppFiles };
