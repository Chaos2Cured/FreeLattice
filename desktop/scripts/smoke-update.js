#!/usr/bin/env node
// Smoke: desktop "Check for updates" v0.1 (no Electron, no network).
// Usage: node desktop/scripts/smoke-update.js
'use strict';
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const u = require(path.join(__dirname, '..', 'lattice-update.js'));

assert.strictEqual(u.compareVersions('5.9.0', '5.8.0'), 1);
assert.strictEqual(u.compareVersions('v5.8', '5.8.0'), 0);
assert.strictEqual(u.compareVersions('5.8.0', '5.10.0'), -1);
assert.strictEqual(u.compareVersions('junk', '5.8.0'), 0);

// The newest release on GitHub today is bridge-v0.1; it must be skipped.
const releases = [
  { tag_name: 'bridge-v0.1', html_url: 'https://github.com/Chaos2Cured/FreeLattice/releases/tag/bridge-v0.1', assets: [] },
  { tag_name: 'desktop-packs-v0.1', assets: [] },
  { tag_name: 'v6.0.0', prerelease: true, assets: [] },
  { tag_name: 'v5.9.0', draft: true, assets: [] },
  { tag_name: 'v5.8.0', html_url: 'https://github.com/Chaos2Cured/FreeLattice/releases/tag/v5.8.0',
    assets: [{ name: 'FreeLattice_5.8.0_macOS.zip', browser_download_url: 'https://github.com/x.zip' }] },
  { tag_name: 'v5.5', assets: [] }
];
assert.strictEqual(u.pickLatestDesktop(releases).tag_name, 'v5.8.0');
assert.strictEqual(u.assetForPlatform(releases[4], 'darwin').name, 'FreeLattice_5.8.0_macOS.zip');

(async () => {
  const same = await u.checkForUpdates({ currentVersion: '5.8.0', platform: 'darwin', fetchJson: async () => releases });
  assert.strictEqual(same.ok, true); assert.strictEqual(same.newer, false);
  assert.ok(/newest/.test(u.describe(same)));
  const older = await u.checkForUpdates({ currentVersion: '5.5.0', platform: 'darwin', fetchJson: async () => releases });
  assert.strictEqual(older.newer, true); assert.strictEqual(older.latest, '5.8.0');
  assert.strictEqual(older.pageUrl, 'https://github.com/Chaos2Cured/FreeLattice/releases/tag/v5.8.0');
  const odd = await u.checkForUpdates({ currentVersion: '5.5.0', fetchJson: async () => [{ tag_name: 'v9.0.0', html_url: 'https://evil.example/x' }] });
  assert.strictEqual(odd.pageUrl, u.RELEASES_PAGE);
  const down = await u.checkForUpdates({ currentVersion: '5.8.0', fetchJson: async () => { throw new Error('timeout'); } });
  assert.strictEqual(down.ok, false); assert.ok(/Could not reach GitHub/.test(u.describe(down)));

  const src = fs.readFileSync(path.join(__dirname, '..', 'lattice-update.js'), 'utf8');
  assert.ok(!/autoUpdater|child_process|writeFile|spawn\(/.test(src), 'update check never downloads or installs');
  const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  assert.ok(/ipcMain\.handle\('check-for-updates'/.test(main) && /label: 'Check for Updates\.\.\.'/.test(main));
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assert.ok(pkg.build.files.indexOf('lattice-update.js') !== -1, 'packaged with the app');
  console.log('SMOKE_OK desktop update button v0.1');

  // v-desktop-update-buttons-v0.2. The v0.1 checks above stay.
  const packList = [
    { tag_name: 'desktop-packs-v0.1', assets: [] },
    { tag_name: 'desktop-packs-v0.2', html_url: 'https://github.com/Chaos2Cured/FreeLattice/releases/tag/desktop-packs-v0.2', assets: [
      { name: 'FreeLattice_5.8.0_Windows_Setup.exe', browser_download_url: 'https://github.com/Chaos2Cured/FreeLattice/releases/download/desktop-packs-v0.2/FreeLattice_5.8.0_Windows_Setup.exe', digest: 'sha256:abc' }
    ] },
    { tag_name: 'desktop-packs-v0.3-rc1', prerelease: true, assets: [] },
    { tag_name: 'desktop-packs-v0.4', draft: true, assets: [] },
    { tag_name: 'v5.8.0', assets: [] },
    { tag_name: 'bridge-v0.1', assets: [] }
  ];
  assert.strictEqual(u.pickLatestPack(packList).tag_name, 'desktop-packs-v0.2');
  assert.strictEqual(u.pickLatestPack(packList, { channel: 'rc' }).tag_name, 'desktop-packs-v0.3-rc1');
  const unknown = u.judgePack({ packTag: '', version: '5.8.0', packaged: true }, 'desktop-packs-v0.3');
  assert.strictEqual(unknown.unknownWhich, true);
  assert.ok(unknown.line.indexOf('does not say which pack') !== -1);
  assert.strictEqual(unknown.newer, true);
  const samePack = u.judgePack({ packTag: 'desktop-packs-v0.2', version: '5.8.0', packaged: true }, 'desktop-packs-v0.2');
  assert.strictEqual(samePack.newer, false);
  const newerPack = u.judgePack({ packTag: 'desktop-packs-v0.2', version: '5.8.0', packaged: true }, 'desktop-packs-v0.3');
  assert.strictEqual(newerPack.newer, true);
  assert.strictEqual(u.judgePack({ packTag: 'dev', version: '5.8.0', packaged: false }, 'desktop-packs-v0.3').newer, false);
  const looked = await u.checkPacks({ current: { packTag: 'desktop-packs-v0.2', version: '5.8.0', packaged: true }, fetchJson: async () => packList });
  assert.strictEqual(looked.newer, false);
  assert.strictEqual(looked.assets.winSetup.sha256, 'abc');
  assert.strictEqual(looked.notesUrl, 'https://github.com/Chaos2Cured/FreeLattice/releases/tag/desktop-packs-v0.2');

  const pu = require(path.join(__dirname, '..', 'pack-update.js'));
  assert.strictEqual(pu.routeFor({ platform: 'win32', env: {} }), 'nsis');
  assert.strictEqual(pu.routeFor({ platform: 'win32', env: { PORTABLE_EXECUTABLE_DIR: 'C:\\pack' } }), 'portable');
  assert.strictEqual(pu.routeFor({ platform: 'linux', env: { APPIMAGE: '/FreeLattice.AppImage' } }), 'appimage');
  assert.strictEqual(pu.routeFor({ platform: 'linux', env: {} }), 'deb');
  assert.strictEqual(pu.routeFor({ platform: 'darwin', env: {} }), 'mac');
  assert.strictEqual(pu.usesUpdater('nsis'), true);
  assert.strictEqual(pu.usesUpdater('portable'), false);
  assert.strictEqual(pu.allowedUrl('https://github.com/Chaos2Cured/FreeLattice/releases/download/desktop-packs-v0.3/FreeLattice_5.8.1_Windows_Setup.exe'), true);
  assert.strictEqual(pu.allowedUrl('https://objects.githubusercontent.com/github-production-release-asset/x'), true);
  assert.strictEqual(pu.allowedUrl('https://evil.example/FreeLattice.exe'), false);
  assert.strictEqual(pu.allowedUrl('http://github.com/Chaos2Cured/FreeLattice/releases/download/desktop-packs-v0.3/a.exe'), false);

  const events = [];
  const updater = {
    autoDownload: true,
    autoInstallOnAppQuit: true,
    downloadUpdate: function () { events.push('download'); return Promise.resolve(); },
    quitAndInstall: function () { events.push('install'); }
  };
  const session = pu.createUpdaterSession(updater);
  assert.strictEqual(session.policy().autoDownload, true);
  assert.strictEqual(updater.autoDownload, false);
  assert.strictEqual(updater.autoInstallOnAppQuit, false);
  assert.deepStrictEqual(events, []);
  const early = session.tapRestart();
  assert.strictEqual(early.ok, false);
  assert.deepStrictEqual(events, []);
  const got = await session.tapUpdate();
  assert.strictEqual(got.phase, 'ready');
  assert.deepStrictEqual(events, ['download']);
  session.tapRestart();
  assert.deepStrictEqual(events, ['download', 'install']);
  const later = session.tapLater();
  assert.strictEqual(later.installed, false);

  let removed = null;
  let opened = null;
  const bad = pu.acceptFile({
    hash: 'aa', sha256: 'bb', file: '/tmp/just-downloaded.bin', route: 'mac',
    remove: function (f) { removed = f; },
    openPath: function (f) { opened = f; },
    showItem: function () { opened = 'shown'; }
  });
  assert.strictEqual(bad.ok, false);
  assert.strictEqual(bad.opened, false);
  assert.strictEqual(removed, '/tmp/just-downloaded.bin');
  assert.strictEqual(opened, null);
  assert.strictEqual(bad.line, 'That download did not match. Nothing was opened.');

  const cardApi = pu.card;
  assert.ok(cardApi.WORDS.unsigned.indexOf('not signed') !== -1);
  assert.ok(cardApi.WORDS.unsigned.indexOf('\u2014') === -1);
  function el() {
    return {
      style: {}, type: '', children: [], text: '', attrs: {}, on: {},
      set textContent(v) { this.text = String(v); },
      get textContent() { return this.text; },
      appendChild: function (c) { this.children.push(c); return c; },
      removeChild: function (c) { this.children = this.children.filter(function (x) { return x !== c; }); return c; },
      get firstChild() { return this.children[0] || null; },
      setAttribute: function (k, v) { this.attrs[k] = v; },
      addEventListener: function (n, f) { this.on[n] = f; },
      createElement: function () { return el(); }
    };
  }
  const doc = { createElement: function () { return el(); } };
  const host = el();
  cardApi.render(doc, host, { showCard: true, line: 'FreeLattice desktop-packs-v0.3 (you have desktop-packs-v0.2).', label: cardApi.runningLabel('5.8.1', 'desktop-packs-v0.3') });
  const buttons = host.children.filter(function (c) { return c.attrs && c.attrs['data-pack']; });
  assert.ok(buttons.length >= 2);
  buttons.forEach(function (b) { assert.strictEqual(b.style.minHeight, '44px'); });
  const blob = JSON.stringify(cardApi.WORDS);
  assert.ok(blob.indexOf('\u2014') === -1);
  assert.strictEqual(pu.shouldAutoCheck(0, 1000), true);
  assert.strictEqual(pu.shouldAutoCheck(1000, 1000 + pu.DAY_MS - 1), false);
  assert.strictEqual(pu.shouldAutoCheck(1000, 1000 + pu.DAY_MS), true);
  const until = pu.snoozeUntil(5000);
  assert.strictEqual(pu.snoozed({ tag: 'desktop-packs-v0.3', until: until }, 'desktop-packs-v0.3', until - 1), true);
  assert.strictEqual(pu.snoozed({ tag: 'desktop-packs-v0.3', until: until }, 'desktop-packs-v0.3', until), false);

  const mainSrc = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  assert.ok(mainSrc.indexOf('autoDownload = false') !== -1);
  assert.ok(mainSrc.indexOf('autoInstallOnAppQuit = false') !== -1);
  assert.ok(mainSrc.indexOf('quitAndInstall') !== -1);
  console.log('checks passed: buttons');
  console.log('SMOKE_OK desktop update buttons v0.1');
})().catch((e) => { console.error(e); process.exit(1); });
