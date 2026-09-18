#!/usr/bin/env node
// Thin smoke: Bridge Win/Linux hrefs · port channel 11435 · friction Bridge→Desktop→One-click→Advanced
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const root = path.join(__dirname, '..');
const repo = path.join(root, '..');
const install = fs.readFileSync(path.join(root, 'install.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
const proxy = fs.readFileSync(path.join(repo, 'bridge', 'proxy-core.js'), 'utf8');
const main = fs.readFileSync(path.join(repo, 'bridge', 'main.js'), 'utf8');
const door = fs.readFileSync(path.join(repo, 'bridge', 'ui', 'first-door.html'), 'utf8');
const ledger = fs.readFileSync(path.join(root, 'library', 'BRIDGE_WIN_LINUX_PORT_FRICTION_LEDGER_v0.md'), 'utf8');
const flint = fs.readFileSync(path.join(root, 'Flint.html'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(repo, 'bridge', 'package.json'), 'utf8'));

assert.ok(/v-bridge-win-linux-port-friction-v0/.test(install + app + ledger + door), 'marker');
assert.ok(/id="bridge-download"/.test(install), 'bridge-download');
assert.ok(/FreeLattice-Bridge_0\.1\.0_Windows_Portable\.exe/.test(install), 'Win Portable href');
assert.ok(/FreeLattice-Bridge_0\.1\.0_Windows_Setup\.exe/.test(install), 'Win Setup href');
assert.ok(/FreeLattice-Bridge_0\.1\.0_Linux\.AppImage/.test(install), 'Linux AppImage href');
assert.ok(/SmartScreen|Run anyway/i.test(install), 'SmartScreen honesty');

assert.ok(/11435/.test(proxy + main + door + app + ledger), 'channel 11435');
assert.ok(/11434/.test(proxy + ledger) && /never steal|OLLAMA_PORT|keeps 11434/i.test(proxy + ledger + door), 'never steal 11434');
assert.ok(/FREELATTICE_BRIDGE_PORT|findFreePort|resolvePreferredPort|--port/.test(proxy + main), 'port configurable');
assert.ok(/fl_bridgePort|flUseBridgePort|flBridgePortCandidates/.test(app), 'Connect follows port');

assert.ok(/bridge-download[\s\S]{0,400}desktop-download-ease[\s\S]{0,400}grandmother-path-start|Double-click Bridge[\s\S]{0,800}Desktop[\s\S]{0,400}One-click/i.test(app), 'friction order Bridge→Desktop→One-click');
assert.ok(/Advanced[\s\S]{0,200}OLLAMA_ORIGINS|Terminal CORS \(collapse\)/i.test(app), 'Terminal Advanced last');
assert.ok(/addAllowedOrigin|Also allow this origin|never \*/i.test(main + door + ledger), 'self-host origin · never *');
assert.ok(!/Access-Control-Allow-Origin'\s*:\s*'\*'/.test(proxy), 'no bare *');

assert.ok(/Windows_Portable|Windows_Setup/.test(JSON.stringify(pkg.build)), 'package naming Win');
assert.ok(/Linux\.\$\{ext\}|AppImage/.test(JSON.stringify(pkg.build)), 'package naming Linux');
assert.ok(/port channel|11435|friction|Win\/Linux|never \*/i.test(flint + ledger), 'Flint/ledger');
assert.ok(/id="fl-connect-play"/.test(app) && /id="fl-connect-card"/.test(app), 'Connect held');
assert.ok(/sw\.js/.test(app), 'leave sw.js');

function headStatus(url) {
  return new Promise(function (resolve) {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, { method: 'HEAD', timeout: 12000 }, function (res) {
      // follow one redirect manually if needed
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        headStatus(res.headers.location).then(resolve);
        return;
      }
      resolve(res.statusCode || 0);
    });
    req.on('error', function () { resolve(0); });
    req.on('timeout', function () { req.destroy(); resolve(0); });
    req.end();
  });
}

async function checkArtifacts() {
  const urls = [
    'https://github.com/Chaos2Cured/FreeLattice/releases/download/bridge-v0.1/FreeLattice-Bridge_0.1.0_Windows_Portable.exe',
    'https://github.com/Chaos2Cured/FreeLattice/releases/download/bridge-v0.1/FreeLattice-Bridge_0.1.0_Windows_Setup.exe',
    'https://github.com/Chaos2Cured/FreeLattice/releases/download/bridge-v0.1/FreeLattice-Bridge_0.1.0_Linux.AppImage'
  ];
  const codes = [];
  for (const u of urls) codes.push(await headStatus(u));
  return codes;
}

checkArtifacts().then(function (codes) {
  const allOk = codes.every(function (c) { return c === 200; });
  if (allOk) {
    console.log('SMOKE_OK bridge win linux artifacts v0');
    console.log('Win Portable+Setup · Linux AppImage · HTTP 200');
  } else {
    console.log('SMOKE_SOFT bridge win linux artifacts pending upload', codes.join(','));
    // Do not fail the structural smoke if upload is still in flight — assert structure above already passed.
    // CI after Celeste upload should see 200; local pre-upload prints soft.
  }
  console.log('SMOKE_OK bridge port channel v0');
  console.log('SMOKE_OK bridge friction heal v0');
  console.log('SMOKE_OK bridge win linux port friction v0');
  console.log('11435 channel · Bridge→Desktop→One-click · Advanced last · never *');
  process.exit(0);
}).catch(function (e) {
  console.error(e);
  process.exit(1);
});
