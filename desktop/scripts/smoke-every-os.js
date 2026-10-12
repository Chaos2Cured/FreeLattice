#!/usr/bin/env node
// Smoke: every OS desktop v0.1. Headless. No Electron, no firewall change.
// Usage: node desktop/scripts/smoke-every-os.js

'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const D = require(path.join(__dirname, '..', 'lattice-discover.js'));
const win = path.win32;
let passed = 0;
function ok(cond, msg) {
  assert.ok(cond, msg);
  passed++;
}

function iface(address, extra) {
  return Object.assign({ address: address, family: 'IPv4', internal: false }, extra || {});
}

const windows = {
  'VirtualBox Host-Only Network': [iface('192.168.56.1')],
  'vEthernet (WSL)': [iface('172.20.0.1')],
  'VMware Network Adapter VMnet8': [iface('192.168.152.1')],
  'vEthernet (Default Switch)': [iface('172.22.0.1')],
  'Wi-Fi': [iface('192.168.1.23')]
};
const pickedWin = D.pickLanAddress(windows);
ok(pickedWin && pickedWin.name === 'Wi-Fi' && pickedWin.address === '192.168.1.23', 'Windows virtual cards lose to Wi-Fi');

const both = {
  Ethernet: [iface('192.168.1.8')],
  'Wi-Fi': [iface('192.168.1.23')],
  'VirtualBox Host-Only Network': [iface('192.168.56.1')]
};
const pickedBoth = D.pickLanAddress(both);
ok(pickedBoth && (pickedBoth.name === 'Ethernet' || pickedBoth.name === 'Wi-Fi'), 'Ethernet or Wi-Fi, never a virtual card');
ok(pickedBoth.address !== '192.168.56.1', 'virtual address not chosen');

ok(D.pickLanAddress({
  'VirtualBox Host-Only Network': [iface('192.168.56.1')],
  'vEthernet (WSL)': [iface('172.20.0.1')],
  docker0: [iface('172.17.0.1')]
}) === null, 'only virtual cards: null');

const mac = {
  en0: [iface('192.168.1.20')],
  utun3: [iface('10.8.0.2')],
  bridge100: [iface('192.168.64.1')]
};
const pickedMac = D.pickLanAddress(mac);
ok(pickedMac && pickedMac.name === 'en0' && pickedMac.address === '192.168.1.20', 'Mac list still picks en0');

const linux = {
  lo: [iface('127.0.0.1', { internal: true })],
  docker0: [iface('172.17.0.1')],
  wlp2s0: [iface('192.168.0.9')]
};
const pickedLinux = D.pickLanAddress(linux);
ok(pickedLinux && pickedLinux.name === 'wlp2s0' && pickedLinux.address === '192.168.0.9', 'Linux list picks wlp2s0');

ok(D.pickLanAddress({ 'Bluetooth Network Connection': [iface('192.168.44.1')], 'Wi-Fi': [iface('10.0.0.4')] }).name === 'Wi-Fi', 'bluetooth name skipped');
ok(D.pickLanAddress({ 'Loopback Pseudo-Interface 1': [iface('192.168.1.1')], eth0: [iface('192.168.0.2')] }).name === 'eth0', 'loopback pseudo skipped');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fl-every-os-'));
  const door = D.createDiscover({
    storeDir: tmp,
    smokeLoopback: true,
    appOrigin: () => 'http://127.0.0.1:1',
    ask: async () => 'no',
    answerOffer: async () => '',
    autoOffMs: 60000,
    mdns: function () {
      const err = new Error('bind 5353');
      err.code = 'EADDRINUSE';
      throw err;
    }
  });
  const st = await door.on('abcdef0123456789');
  ok(st && st.ok && st.on && st.port > 0, 'listener stays up when nearby discovery cannot bind');
  ok(String(st.nearbyNote).indexOf('Nearby discovery is off on this computer. A join link still works.') !== -1, 'nearby discovery off sentence');
  const reached = await new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port: st.port, path: '/nope', agent: false }, (res) => {
      res.resume();
      resolve(res.statusCode > 0);
    });
    req.on('error', () => resolve(false));
  });
  ok(reached, 'knock listener still answers');
  door.off('smoke');

  const quietDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fl-every-os-quiet-'));
  const quiet = D.createDiscover({
    storeDir: quietDir,
    smokeLoopback: true,
    ask: async () => 'no',
    answerOffer: async () => '',
    autoOffMs: 200
  });
  const quietOn = await quiet.on('abcdef0123456789');
  ok(quietOn && quietOn.ok, 'quiet door on');
  await sleep(450);
  const afterQuiet = quiet.status();
  ok(afterQuiet.noChallenge === true, 'no phone in the window sets noChallenge');
  ok(afterQuiet.on === false, 'window ended');
  ok(Number(afterQuiet.counts.autoOff) >= 1, 'autoOff counted');

  const seenDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fl-every-os-seen-'));
  const seen = D.createDiscover({
    storeDir: seenDir,
    smokeLoopback: true,
    ask: async () => 'no',
    answerOffer: async () => '',
    autoOffMs: 800
  });
  const seenOn = await seen.on('abcdef0123456789');
  await new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port: seenOn.port, path: '/challenge', agent: false }, (res) => {
      res.resume();
      resolve();
    });
    req.on('error', () => resolve());
  });
  await sleep(1100);
  const afterSeen = seen.status();
  ok(afterSeen.noChallenge === false, 'a /challenge hit keeps the firewall line off');
  seen.off('smoke');

  const holdDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fl-every-os-hold-'));
  const hold = D.createDiscover({
    storeDir: holdDir,
    smokeLoopback: true,
    ask: async () => 'no',
    answerOffer: async () => '',
    autoOffMs: 180
  });
  hold.rememberKeepOn(true);
  const holdOn = await hold.on('abcdef0123456789');
  ok(holdOn && holdOn.ok, 'keep-on door on');
  await sleep(450);
  const afterHold = hold.status();
  ok(afterHold.on === true, 'keep-on stays on');
  ok(Number(afterHold.counts.autoOff) === 0, 'keep-on does not bump autoOff');
  ok(afterHold.noChallenge === true, 'keep-on still records that no phone arrived');
  hold.off('tap');

  const userData = 'C:\\Users\\Tester\\AppData\\Roaming\\FreeLattice';
  const desk = path.join(__dirname, '..');
  const sources = fs.readdirSync(desk).filter((n) => /^lattice-.*\.js$/.test(n)).concat(['main.js']);
  const banned = /homedir|USERPROFILE|process\.env\.HOME|~\//;
  const segs = new Set();
  sources.forEach((name) => {
    const src = fs.readFileSync(path.join(desk, name), 'utf8');
    ok(!banned.test(src), name + ' builds no home shortcut');
    const re = /getPath\('userData'\)\s*,\s*'([^']+)'/g;
    let m;
    while ((m = re.exec(src))) segs.add(m[1]);
  });
  ['lattice-keys', 'lattice-ledger', 'lattice-memory', 'lattice-import', 'lattice-pair', 'lattice-discover'].forEach((seg) => {
    ok(segs.has(seg), 'userData segment ' + seg);
  });
  const files = {
    'lattice-keys': ['companion.seed.enc'],
    'lattice-ledger': ['chain.jsonl'],
    'lattice-memory': ['shelf.jsonl'],
    'lattice-import': ['quarantine', 'verified'],
    'lattice-pair': ['shared.seed.enc', 'pair.public.json'],
    'lattice-discover': ['kin.json', 'port.json', 'keepon.json', 'desk.json', 'counts.json', 'pause.json']
  };
  Object.keys(files).forEach((seg) => {
    files[seg].forEach((leaf) => {
      const built = win.join(userData, seg, leaf);
      const rel = win.relative(userData, built);
      ok(rel && rel.indexOf('..') !== 0 && !win.isAbsolute(rel), 'stays under userData ' + built);
      ok(built.indexOf('/') === -1, 'win32 shape ' + built);
    });
  });
  const discoverRoot = win.join(userData, 'lattice-discover');
  ['kin.json', 'port.json', 'keepon.json', 'desk.json', 'counts.json', 'pause.json'].forEach((leaf) => {
    const built = win.join(discoverRoot, leaf);
    const rel = win.relative(userData, built);
    ok(rel.indexOf('..') !== 0 && built.indexOf('lattice-discover') !== -1, 'discover file ' + leaf);
  });

  const ymlPath = path.join(desk, '..', '.github', 'workflows', 'desktop-packs-every-os.yml');
  const yml = fs.readFileSync(ymlPath, 'utf8');
  ok(fs.existsSync(path.join(desk, '..', '.github', 'workflows', 'desktop-packs-win-linux.yml')), 'old workflow still beside the new one');
  ['windows-latest', 'ubuntu-latest', 'macos-latest'].forEach((runner) => {
    const at = yml.indexOf('runs-on: ' + runner);
    ok(at !== -1, 'job ' + runner);
    const rest = yml.slice(at);
    const cutBuild = rest.indexOf('\n  build-', 8);
    const cutPub = rest.indexOf('\n  publish-', 8);
    let end = rest.length;
    if (cutBuild > 0) end = Math.min(end, cutBuild);
    if (cutPub > 0) end = Math.min(end, cutPub);
    const block = rest.slice(0, end);
    const smokeAt = block.indexOf('node scripts/smoke-discover.js');
    const smoke2 = block.indexOf('node scripts/smoke-reconnect.js');
    const buildAt = block.search(/npm run build:(win|linux|mac)/);
    ok(smokeAt > 0 && smoke2 > smokeAt && buildAt > smoke2, runner + ' runs both smokes before the build');
  });
  ok(!/CSC_LINK|WIN_CSC|APPLE_ID|APPLE_APP|CSC_KEY_PASSWORD/.test(yml), 'workflow sets no signing secret');
  ok(/CSC_IDENTITY_AUTO_DISCOVERY:\s*'false'/.test(yml), 'signing discovery stays off');
  ok(/buildVersion=5\.8\.0-035/.test(yml) && /extraMetadata\.version=5\.8\.0/.test(yml), 'version label stays 5.8.0');

  console.log('checks passed: ' + passed);
  console.log('SMOKE_OK every os desktop v0.1');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
