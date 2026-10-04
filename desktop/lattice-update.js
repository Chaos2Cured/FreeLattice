// lattice-update.js: "Check for updates" for the FreeLattice desktop shell.
// Soft LAYER marker: v-desktop-update-button-v0.1
//
// What it does: asks GitHub for this repo's releases, picks the newest desktop
// release (tags like v5.8.0; Bridge and pack releases are skipped, drafts and
// pre-releases too), and compares it with the running app version.
// What it does not do: download or install anything. The person opens the
// release page and chooses. The page inside the app already updates itself
// from freelattice.com; this is only for the desktop shell around it.

'use strict';

const https = require('https');

const RELEASES_URL = 'https://api.github.com/repos/Chaos2Cured/FreeLattice/releases?per_page=30';
const RELEASES_PAGE = 'https://github.com/Chaos2Cured/FreeLattice/releases';
const DESKTOP_TAG = /^v(\d+)(?:\.(\d+))?(?:\.(\d+))?$/;
const TIMEOUT_MS = 10000;

function parseVersion(v) {
  const m = String(v || '').trim().replace(/^v/i, '').match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2] || 0), Number(m[3] || 0)];
}

// Returns 1 if a is newer than b, -1 if older, 0 if the same (or unreadable).
function compareVersions(a, b) {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (!x || !y) return 0;
  for (let i = 0; i < 3; i++) {
    if (x[i] > y[i]) return 1;
    if (x[i] < y[i]) return -1;
  }
  return 0;
}

function pickLatestDesktop(releases) {
  let best = null;
  (Array.isArray(releases) ? releases : []).forEach((r) => {
    if (!r || r.draft || r.prerelease) return;
    if (!DESKTOP_TAG.test(String(r.tag_name || ''))) return;
    if (!best || compareVersions(r.tag_name, best.tag_name) > 0) best = r;
  });
  return best;
}

function assetForPlatform(release, platform) {
  const assets = (release && Array.isArray(release.assets)) ? release.assets : [];
  const want = platform === 'darwin' ? /macOS\.(zip|dmg)$|\.dmg$/i
    : platform === 'win32' ? /Windows_Setup\.exe$|Setup.*\.exe$/i
    : /\.AppImage$/i;
  const a = assets.find((x) => x && want.test(String(x.name || '')));
  return a ? { name: String(a.name), url: String(a.browser_download_url || '') } : null;
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'FreeLattice-desktop-update-check', 'Accept': 'application/vnd.github+json' },
      timeout: TIMEOUT_MS
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { body += c; if (body.length > 2000000) req.destroy(new Error('too-large')); });
      res.on('end', () => {
        if (res.statusCode !== 200) { reject(new Error('github-' + res.statusCode)); return; }
        try { resolve(JSON.parse(body)); } catch (e) { reject(new Error('bad-json')); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

// result: { ok, current, latest, newer, pageUrl, asset, reason }
async function checkForUpdates(opts) {
  const o = opts || {};
  const current = String(o.currentVersion || '0.0.0');
  const get = o.fetchJson || fetchJson;
  try {
    const releases = await get(RELEASES_URL);
    const best = pickLatestDesktop(releases);
    if (!best) return { ok: true, current, latest: null, newer: false, pageUrl: RELEASES_PAGE, asset: null, reason: 'no-desktop-release' };
    const latest = String(best.tag_name).replace(/^v/i, '');
    const pageUrl = String(best.html_url || RELEASES_PAGE);
    return {
      ok: true,
      current,
      latest,
      newer: compareVersions(latest, current) > 0,
      pageUrl: pageUrl.indexOf('https://github.com/Chaos2Cured/FreeLattice/') === 0 ? pageUrl : RELEASES_PAGE,
      asset: assetForPlatform(best, o.platform || process.platform),
      reason: ''
    };
  } catch (e) {
    return { ok: false, current, latest: null, newer: false, pageUrl: RELEASES_PAGE, asset: null, reason: String((e && e.message) || 'error') };
  }
}

function describe(result) {
  const r = result || {};
  if (!r.ok) return 'Could not reach GitHub to check (' + (r.reason || 'error') + '). You have FreeLattice ' + r.current + '.';
  if (!r.latest) return 'No desktop release found on GitHub yet. You have FreeLattice ' + r.current + '.';
  if (r.newer) return 'FreeLattice ' + r.latest + ' is out. You have ' + r.current + '. Open the release page to download it.';
  return 'You have the newest FreeLattice desktop app (' + r.current + ').';
}

module.exports = {
  RELEASES_URL, RELEASES_PAGE,
  parseVersion, compareVersions, pickLatestDesktop, assetForPlatform, checkForUpdates, describe
};
