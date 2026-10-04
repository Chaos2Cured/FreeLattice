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
})().catch((e) => { console.error(e); process.exit(1); });
