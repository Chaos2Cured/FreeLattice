// pack-update.js v-desktop-update-buttons-v0.2
// Routes a pack update. Nothing downloads or installs until a tap calls it.
'use strict';

const card = require('./pack-update-card');
const { URL } = require('url');

const DAY_MS = 24 * 60 * 60 * 1000;
const DOWNLOAD_PREFIX = '/Chaos2Cured/FreeLattice/releases/download/';
const OBJECT_HOSTS = {
  'objects.githubusercontent.com': true,
  'release-assets.githubusercontent.com': true,
  'github-releases.githubusercontent.com': true
};

function allowedUrl(raw) {
  let u;
  try { u = new URL(String(raw)); } catch (e) { return false; }
  if (u.protocol !== 'https:') return false;
  if (u.hostname === 'github.com') return u.pathname.indexOf(DOWNLOAD_PREFIX) === 0;
  return !!OBJECT_HOSTS[u.hostname];
}

function routeFor(env) {
  const e = (env && env.env) || {};
  const platform = env && env.platform;
  if (platform === 'win32' && e.PORTABLE_EXECUTABLE_DIR) return 'portable';
  if (platform === 'win32') return 'nsis';
  if (platform === 'linux' && e.APPIMAGE) return 'appimage';
  if (platform === 'linux') return 'deb';
  if (platform === 'darwin') return 'mac';
  return 'unknown';
}

function usesUpdater(route) {
  return route === 'nsis' || route === 'appimage';
}

function chooseAsset(route, assets) {
  const a = assets || {};
  if (route === 'nsis') return a.winSetup;
  if (route === 'portable') return a.winPortable;
  if (route === 'appimage') return a.appImage;
  if (route === 'deb') return a.deb;
  if (route === 'mac') return a.macDmg || a.macZip;
  return null;
}

function shouldAutoCheck(lastMs, nowMs) {
  if (!lastMs) return true;
  return (Number(nowMs) - Number(lastMs)) >= DAY_MS;
}

function snoozeUntil(nowMs) {
  return Number(nowMs) + DAY_MS;
}

function snoozed(record, tag, nowMs) {
  if (!record || !tag) return false;
  return record.tag === tag && Number(record.until) > Number(nowMs);
}

function createUpdaterSession(updater) {
  const u = updater || {};
  u.autoDownload = false;
  u.autoInstallOnAppQuit = false;
  let ready = false;
  return {
    policy: function () {
      return { autoDownload: u.autoDownload === false, autoInstallOnAppQuit: u.autoInstallOnAppQuit === false };
    },
    tapUpdate: function () {
      if (typeof u.downloadUpdate !== 'function') return Promise.resolve({ ok: false, reason: 'no-updater' });
      return Promise.resolve(u.downloadUpdate()).then(function () {
        ready = true;
        return { ok: true, phase: 'ready', line: card.WORDS.ready };
      });
    },
    tapRestart: function () {
      if (!ready) return { ok: false, reason: 'not-ready' };
      if (typeof u.quitAndInstall !== 'function') return { ok: false, reason: 'no-updater' };
      u.quitAndInstall();
      return { ok: true };
    },
    tapLater: function () {
      return { ok: true, installed: false };
    }
  };
}

function acceptFile(opts) {
  const o = opts || {};
  const want = String(o.sha256 || '').replace(/^sha256:/i, '').toLowerCase();
  const got = String(o.hash || '').toLowerCase();
  if (!want || got !== want) {
    if (typeof o.remove === 'function') o.remove(o.file);
    return { ok: false, opened: false, line: card.WORDS.mismatch };
  }
  if (o.route === 'mac' && typeof o.openPath === 'function') o.openPath(o.file);
  else if ((o.route === 'portable' || o.route === 'deb') && typeof o.showItem === 'function') o.showItem(o.file);
  const line = o.route === 'portable' ? card.WORDS.portable
    : o.route === 'mac' ? card.WORDS.mac
    : o.route === 'deb' ? card.debLine(o.name)
    : '';
  return { ok: true, opened: o.route === 'mac', line: line };
}

function safeName(name) {
  const base = String(name || 'FreeLattice-pack').split(/[/\\]/).pop();
  if (!base || base === '.' || base === '..') return 'FreeLattice-pack';
  return base;
}

module.exports = {
  VERSION: 'v-desktop-update-buttons-v0.2',
  DAY_MS: DAY_MS,
  card: card,
  allowedUrl: allowedUrl,
  routeFor: routeFor,
  usesUpdater: usesUpdater,
  chooseAsset: chooseAsset,
  shouldAutoCheck: shouldAutoCheck,
  snoozeUntil: snoozeUntil,
  snoozed: snoozed,
  createUpdaterSession: createUpdaterSession,
  acceptFile: acceptFile,
  safeName: safeName
};
