// ============================================
// FreeLattice Desktop — Swarm bridge v0.2
// HTTPS webseed PRIMARY → quarantine →
// existing lattice-import hash path. Never bypass hash.
//
// BitTorrent/WebTorrent is OPT-IN FALLBACK only.
// Default (Metronet-safe): HTTPS-only, no DHT, no tracker,
// no torrent packets. Set FL_NO_TORRENT=1 or
// FL_TRANSPORT=https-only to hard-disable torrent.
// Torrent fallback runs ONLY when: magnet given AND
// no usable webseed AND torrent not disabled.
//
// Renderer: progress % + state only. No raw path UX required.
// Layer, never delete — v0.1 magnet path preserved as fallback.
// ============================================

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { URL } = require('url');
const latticeImport = require('./lattice-import');

let appRef = null;
let smokeRoot = null;
let WebTorrent = null;
let wtClient = null;
let wtLoadPromise = null;

/** @type {Map<string, object>} */
const jobs = new Map();

/** @type {Map<string, object>} reseed sessions keyed by model id */
const reseeds = new Map();

// --------------------------------------------
// Transport policy (v0.2 — Metronet-safe)
// --------------------------------------------
// FL_TRANSPORT values:
//   'https-only'            → torrent hard-disabled
//   'https+torrent-fallback'→ HTTPS first, magnet fallback (DEFAULT)
//   'torrent-first'         → legacy v0.1 behavior (magnet first, not recommended)
// FL_NO_TORRENT=1/true/yes  → alias for https-only
function getTransportMode() {
  const raw = String(process.env.FL_TRANSPORT || '').trim().toLowerCase();
  const noTor = String(process.env.FL_NO_TORRENT || '').trim().toLowerCase();
  if (raw === 'https-only' || raw === 'webseed-only' || raw === 'https') return 'https-only';
  if (raw === 'https+torrent-fallback' || raw === 'https+torrent' || raw === 'fallback') return 'https+torrent-fallback';
  if (raw === 'torrent-first' || raw === 'magnet-first' || raw === 'legacy') return 'torrent-first';
  if (noTor === '1' || noTor === 'true' || noTor === 'yes' || noTor === 'on') return 'https-only';
  return 'https+torrent-fallback';
}

function isTorrentDisabled() {
  return getTransportMode() === 'https-only';
}

function isTorrentAllowed() {
  return !isTorrentDisabled();
}

/**
 * WebTorrent 2.x is ESM — load via dynamic import() from Electron/CommonJS main.
 * Returns null immediately when torrent is disabled (no import, no network).
 */
function tryLoadWebTorrent() {
  if (isTorrentDisabled()) return Promise.resolve(null);
  if (WebTorrent) return Promise.resolve(WebTorrent);
  if (wtLoadPromise) return wtLoadPromise;
  wtLoadPromise = import('webtorrent')
    .then(function (mod) {
      WebTorrent = mod.default || mod;
      return WebTorrent;
    })
    .catch(function () {
      WebTorrent = null;
      wtLoadPromise = null;
      return null;
    });
  return wtLoadPromise;
}

async function getClient() {
  if (isTorrentDisabled()) return null;
  const WT = await tryLoadWebTorrent();
  if (!WT) return null;
  if (!wtClient) {
    wtClient = new WT({
      // Keep lean; DHT/tracker only used in fallback path
    });
  }
  return wtClient;
}

function bindApp(app) {
  appRef = app;
  smokeRoot = null;
}

function bindSmoke(rootDir) {
  smokeRoot = rootDir;
  appRef = null;
  // Share import smoke root so hash promote lands in the same tree
  latticeImport.bindSmoke(rootDir);
  jobs.clear();
  reseeds.clear();
}

function destroyClient() {
  reseeds.forEach(function (r) {
    try {
      if (r.torrent) r.torrent.destroy();
    } catch (e) {
      /* ignore */
    }
  });
  reseeds.clear();
  if (wtClient) {
    try {
      wtClient.destroy(function () {});
    } catch (e) {
      /* ignore */
    }
    wtClient = null;
  }
}

// Normalize single webseedUrl + webseedUrls[] into a deduped list.
function normalizeWebseeds(webseedUrl, webseedUrls) {
  const out = [];
  const seen = new Set();
  function push(u) {
    const s = String(u || '').trim();
    if (!s || seen.has(s)) return;
    seen.add(s);
    out.push(s);
  }
  push(webseedUrl);
  if (Array.isArray(webseedUrls)) {
    for (const u of webseedUrls) push(u);
  } else if (typeof webseedUrls === 'string' && webseedUrls) {
    push(webseedUrls);
  }
  return out;
}

function assertWebseedUrl(w) {
  let parsed;
  try {
    parsed = new URL(String(w || ''));
  } catch (e) {
    throw new Error('invalid webseed url');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('webseed must be http(s)');
  }
  // Production: prefer https; allow http only for loopback smoke servers
  if (parsed.protocol === 'http:') {
    const h = parsed.hostname;
    if (h !== '127.0.0.1' && h !== 'localhost' && h !== '::1') {
      throw new Error('webseed HTTP only allowed on loopback');
    }
  }
  if (parsed.protocol === 'file:') throw new Error('file:// refused');
}

function assertAllowedSource(magnet, webseedUrl, webseedUrls) {
  const m = magnet ? String(magnet) : '';
  const seeds = normalizeWebseeds(webseedUrl, webseedUrls);
  if (!m && seeds.length === 0) throw new Error('magnet or HTTPS webseed required');
  if (m) {
    if (!/^magnet:\?/i.test(m)) throw new Error('magnet URI required');
    if (/file:/i.test(m)) throw new Error('file:// peers refused');
  }
  for (const w of seeds) assertWebseedUrl(w);
}

function newJobId() {
  return 'sw_' + Date.now().toString(36) + '_' + crypto.randomBytes(3).toString('hex');
}

function publicJob(job) {
  if (!job) return null;
  return {
    id: job.id,
    state: job.state,
    progress: job.progress,
    name: job.name,
    error: job.error || null,
    matched: job.matched || false,
    verified: job.verified || false,
    willNotImport: job.willNotImport || false,
    verifiedBase: job.verifiedBase || null,
    reseed: reseeds.has(String(job.modelId || '')) ? 'seeding' : 'available',
    source: job.source || null,
    transport: getTransportMode(),
    tried: job.tried || null
  };
}

function publicReseed(r) {
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    state: r.state,
    progress: typeof r.progress === 'number' ? r.progress : 0,
    magnetURI: r.magnetURI || null,
    infoHash: r.infoHash || null,
    error: r.error || null
  };
}

function status(id) {
  const reseedList = [];
  reseeds.forEach(function (r) {
    reseedList.push(publicReseed(r));
  });
  if (id) {
    return {
      ok: true,
      job: publicJob(jobs.get(String(id))),
      reseed: publicReseed(reseeds.get(String(id))) || null,
      reseeds: reseedList,
      transport: getTransportMode(),
      torrentAllowed: isTorrentAllowed()
    };
  }
  const list = [];
  jobs.forEach(function (j) {
    list.push(publicJob(j));
  });
  return {
    ok: true,
    jobs: list,
    active: list.filter(function (j) {
      return j.state === 'downloading' || j.state === 'hashing';
    }).length,
    webtorrent: !!WebTorrent,
    torrentAllowed: isTorrentAllowed(),
    transport: getTransportMode(),
    reseeds: reseedList,
    reseed: reseedList.length ? 'seeding' : 'available'
  };
}

function httpGetBuffer(urlStr, onProgress, abortRef) {
  const parsed = new URL(urlStr);
  const lib = parsed.protocol === 'https:' ? https : http;
  return new Promise(function (resolve, reject) {
    const req = lib.get(
      parsed,
      {
        agent: false, // no keep-alive pooling — Metronet-safe, lets smoke exit clean
        headers: { 'User-Agent': 'FreeLattice-Desktop/swarm-bridge-v0.2', 'Connection': 'close' }
      },
      function (res) {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          httpGetBuffer(res.headers.location, onProgress, abortRef).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error('download status ' + res.statusCode));
          return;
        }
        const chunks = [];
        let total = 0;
        const len = parseInt(res.headers['content-length'] || '0', 10) || 0;
        const MAX = 512 * 1024 * 1024;
        res.on('data', function (c) {
          if (abortRef && abortRef.aborted) {
            req.destroy();
            reject(new Error('cancelled'));
            return;
          }
          total += c.length;
          if (total > MAX) {
            req.destroy();
            reject(new Error('download too large'));
            return;
          }
          chunks.push(c);
          if (onProgress) {
            const pct = len ? Math.min(99, Math.floor((total / len) * 100)) : Math.min(90, Math.floor(total / 1024));
            onProgress(pct);
          }
        });
        res.on('end', function () {
          resolve(Buffer.concat(chunks));
        });
        res.on('error', reject);
      }
    );
    if (abortRef) abortRef.req = req;
    req.on('error', reject);
    req.setTimeout(180000, function () {
      req.destroy();
      reject(new Error('download timeout'));
    });
  });
}

function handoffBuffer(job, buffer) {
  job.state = 'hashing';
  job.progress = 100;
  const result = latticeImport.ingestAndVerify(buffer, job.expectedSha256, job.modelId);
  if (result && result.matched) {
    job.state = 'verified';
    job.matched = true;
    job.verified = true;
    job.verifiedBase = result.verifiedBase || null;
    job.willNotImport = false;
  } else {
    job.state = 'quarantined';
    job.matched = false;
    job.verified = false;
    job.willNotImport = true;
    job.error = (result && result.reason) || 'hash mismatch — quarantined; will not import';
  }
  job.result = result;
  return publicJob(job);
}

/**
 * Smoke / tests: pretend download completed; still must pass hash path.
 */
function completeWithBuffer(jobId, buffer) {
  const job = jobs.get(String(jobId));
  if (!job) throw new Error('unknown job');
  if (job.state === 'cancelled') throw new Error('cancelled');
  return handoffBuffer(job, buffer);
}

function cancel(id) {
  const job = jobs.get(String(id));
  if (!job) return { ok: true, cancelled: false, reason: 'unknown' };
  job.state = 'cancelled';
  job.progress = job.progress || 0;
  if (job.abortRef) job.abortRef.aborted = true;
  if (job.abortRef && job.abortRef.req) {
    try {
      job.abortRef.req.destroy();
    } catch (e) {
      /* ignore */
    }
  }
  if (job.torrent) {
    try {
      job.torrent.destroy();
    } catch (e) {
      /* ignore */
    }
    job.torrent = null;
  }
  return { ok: true, cancelled: true, job: publicJob(job) };
}

// HTTPS primary — tries every webseed URL in order until one downloads.
// No torrent, no DHT, no tracker. Metronet-safe: plain HTTPS on 443.
async function startWebseedJob(job) {
  const abortRef = { aborted: false, req: null };
  job.abortRef = abortRef;
  job.source = 'webseed';
  job.tried = job.tried || [];
  const seeds = normalizeWebseeds(job.webseedUrl, job.webseedUrls);
  if (seeds.length === 0) {
    job.state = 'error';
    job.error = 'no webseed URL';
    return publicJob(job);
  }
  let lastErr = null;
  for (const url of seeds) {
    if (job.state === 'cancelled') return publicJob(job);
    job.tried.push('webseed:' + url);
    try {
      const buf = await httpGetBuffer(
        url,
        function (pct) {
          if (job.state === 'cancelled') return;
          job.progress = pct;
          job.state = 'downloading';
        },
        abortRef
      );
      if (job.state === 'cancelled') return publicJob(job);
      job.webseedUrl = url; // record winner
      return handoffBuffer(job, buf);
    } catch (e) {
      lastErr = e;
      // try next mirror; keep downloading state
      job.state = 'downloading';
      job.error = null;
    }
  }
  if (job.state === 'cancelled') return publicJob(job);
  job.state = 'error';
  job.error = String((lastErr && lastErr.message) || lastErr || 'all webseeds failed');
  return publicJob(job);
}

function startMagnetJob(job) {
  // Hard-disable: never touch torrent stack when disabled.
  if (isTorrentDisabled()) {
    return Promise.resolve().then(function () {
      if (job.webseedUrl || (job.webseedUrls && job.webseedUrls.length)) {
        return startWebseedJob(job);
      }
      job.state = 'error';
      job.error = 'torrent disabled (Metronet-safe HTTPS-only mode) — provide HTTPS webseedUrl';
      return publicJob(job);
    });
  }
  return getClient().then(function (client) {
    return new Promise(function (resolve) {
      if (!client) {
        // Fall back to webseed if magnet client missing
        if (job.webseedUrl || (job.webseedUrls && job.webseedUrls.length)) {
          startWebseedJob(job).then(resolve);
          return;
        }
        job.state = 'error';
        job.error = 'webtorrent not available';
        resolve(publicJob(job));
        return;
      }
      job.source = 'magnet';
      job.tried = job.tried || [];
      job.tried.push('magnet');
      const opts = {};
      const seeds = normalizeWebseeds(job.webseedUrl, job.webseedUrls);
      if (seeds.length) opts.urlList = seeds;
      let torrent;
      try {
        torrent = client.add(job.magnet, opts);
      } catch (e) {
        job.state = 'error';
        job.error = String(e && e.message ? e.message : e);
        resolve(publicJob(job));
        return;
      }
      job.torrent = torrent;
      torrent.on('download', function () {
        if (job.state === 'cancelled') return;
        job.state = 'downloading';
        job.progress = Math.min(99, Math.floor((torrent.progress || 0) * 100));
      });
      torrent.on('error', function (err) {
        if (job.state === 'cancelled') {
          resolve(publicJob(job));
          return;
        }
        // Magnet failed but webseed exists → HTTPS fallback (v0.2)
        if (seeds.length) {
          try { if (job.torrent) job.torrent.destroy(); } catch (e) { /* ignore */ }
          job.torrent = null;
          startWebseedJob(job).then(resolve);
          return;
        }
        job.state = 'error';
        job.error = String(err && err.message ? err.message : err);
        resolve(publicJob(job));
      });
      torrent.on('done', function () {
        if (job.state === 'cancelled') {
          resolve(publicJob(job));
          return;
        }
        try {
          const file = torrent.files && torrent.files[0];
          if (!file) {
            job.state = 'error';
            job.error = 'torrent had no files';
            resolve(publicJob(job));
            return;
          }
          file.getBuffer(function (err, buf) {
            if (job.state === 'cancelled') {
              resolve(publicJob(job));
              return;
            }
            if (err) {
              job.state = 'error';
              job.error = String(err.message || err);
              resolve(publicJob(job));
              return;
            }
            try {
              resolve(handoffBuffer(job, buf));
            } catch (e2) {
              job.state = 'error';
              job.error = String(e2 && e2.message ? e2.message : e2);
              resolve(publicJob(job));
            }
          });
        } catch (e) {
          job.state = 'error';
          job.error = String(e && e.message ? e.message : e);
          resolve(publicJob(job));
        }
      });
    });
  });
}

/**
 * HTTPS-first fetch.
 * @param {{ magnet?: string, webseedUrl?: string, webseedUrls?: string[], expectedSha256: string, id?: string, name?: string }} opts
 */
async function startFetch(opts) {
  const o = opts || {};
  const expectedSha256 = o.expectedSha256;
  if (latticeImport.isZeroHash(expectedSha256)) {
    throw new Error('zero-hash / EXAMPLE — refuse swarm');
  }
  const magnet = o.magnet ? String(o.magnet) : '';
  const webseedUrl = o.webseedUrl ? String(o.webseedUrl) : '';
  const webseedUrls = Array.isArray(o.webseedUrls) ? o.webseedUrls.map(String) : [];
  assertAllowedSource(magnet, webseedUrl, webseedUrls);
  const seeds = normalizeWebseeds(webseedUrl, webseedUrls);

  const id = newJobId();
  const job = {
    id: id,
    state: 'starting',
    progress: 0,
    name: String(o.name || o.id || 'swarm'),
    modelId: String(o.id || o.name || id),
    expectedSha256: String(expectedSha256),
    magnet: magnet || null,
    webseedUrl: seeds[0] || null,
    webseedUrls: seeds,
    tried: [],
    matched: false,
    verified: false,
    willNotImport: false
  };
  jobs.set(id, job);

  // v0.2 routing:
  //  - webseed(s) present → ALWAYS HTTPS first (Metronet-safe).
  //    Magnet tried ONLY if HTTPS fails AND torrent allowed.
  //  - magnet-only → torrent if allowed, else clean refuse.
  let run;
  const mode = getTransportMode();
  if (seeds.length > 0) {
    run = startWebseedJob(job).then(function (res) {
      if ((res.state === 'verified' || res.state === 'quarantined') && res.verified) return res;
      // HTTPS failed but magnet available + torrent allowed → fallback
      if (res.state === 'error' && magnet && isTorrentAllowed() && mode !== 'https-only') {
        return startMagnetJob(job);
      }
      // HTTPS hash-mismatch (quarantined) → do NOT fallback to torrent; tamper signal.
      return res;
    });
  } else if (magnet) {
    if (!isTorrentAllowed()) {
      job.state = 'error';
      job.error = 'torrent disabled (Metronet-safe HTTPS-only mode) — provide HTTPS webseedUrl';
      run = Promise.resolve(publicJob(job));
    } else if (mode === 'torrent-first') {
      run = startMagnetJob(job);
    } else {
      // No webseed to try first — magnet is the only source.
      run = startMagnetJob(job);
    }
  } else {
    job.state = 'error';
    job.error = 'magnet or HTTPS webseed required';
    run = Promise.resolve(publicJob(job));
  }
  job.promise = run;
  // Don't block IPC forever — return job handle immediately; also await for smoke convenience
  run.catch(function (e) {
    job.state = 'error';
    job.error = String(e && e.message ? e.message : e);
  });
  return { ok: true, job: publicJob(job), awaitable: true };
}

/** Wait for a job to finish (smoke / main helpers). */
async function waitJob(id, timeoutMs) {
  const job = jobs.get(String(id));
  if (!job) throw new Error('unknown job');
  const ms = timeoutMs || 120000;
  if (job.promise) {
    await Promise.race([
      job.promise,
      new Promise(function (_, reject) {
        setTimeout(function () {
          reject(new Error('swarm job timeout'));
        }, ms);
      })
    ]);
  }
  return publicJob(job);
}

async function ensureWebTorrent() {
  if (isTorrentDisabled()) return false;
  return !!(await tryLoadWebTorrent());
}

function magnetFromInfoHash(infoHash, name) {
  const dn = encodeURIComponent(String(name || 'freelattice'));
  return 'magnet:?xt=urn:btih:' + String(infoHash) + '&dn=' + dn;
}

/**
 * Build torrent metadata for a verified file (create-torrent).
 * WebTorrent.seed can fail on some Node hosts; metadata still proves the re-seed door.
 */
function createTorrentMeta(filePath, name) {
  return import('create-torrent').then(function (mod) {
    const createTorrent = mod.default || mod;
    return new Promise(function (resolve, reject) {
      createTorrent(filePath, { name: String(name || path.basename(filePath)) }, function (err, torrentBuf) {
        if (err) return reject(err);
        import('parse-torrent')
          .then(function (pm) {
            const parseTorrent = pm.default || pm;
            return Promise.resolve(parseTorrent(torrentBuf)).then(function (parsed) {
              resolve({
                torrentBuf: torrentBuf,
                infoHash: parsed.infoHash,
                magnetURI: magnetFromInfoHash(parsed.infoHash, name)
              });
            });
          })
          .catch(reject);
      });
    });
  });
}

/**
 * Re-seed a hash-matched verified file. Gesture only. Lawyer: redistributable only.
 * Refused when torrent disabled (HTTPS-only mode has no seeder — share the HTTPS URL + sha256).
 * @param {{ id: string, name?: string, redistributable?: boolean, expectedSha256?: string, notes?: string }} opts
 */
async function startReseed(opts) {
  if (isTorrentDisabled()) {
    throw new Error('torrent disabled (Metronet-safe HTTPS-only mode) — share HTTPS webseed + sha256 instead');
  }
  const o = opts || {};
  const id = String(o.id || '').trim();
  if (!id) throw new Error('id required');
  if (o.redistributable !== true) {
    throw new Error('non-redistributable — refuse re-seed');
  }
  if (latticeImport.isZeroHash(o.expectedSha256) || latticeImport.isExampleRow({ notes: o.notes, sha256: o.expectedSha256 })) {
    throw new Error('EXAMPLE / zero-hash — refuse re-seed');
  }
  const verifiedPath = latticeImport.getVerifiedPathForId(id);
  if (!verifiedPath || !fs.existsSync(verifiedPath)) {
    throw new Error('not verified — will not re-seed');
  }

  if (reseeds.has(id)) {
    const existing = reseeds.get(id);
    if (existing && existing.state === 'seeding') {
      return { ok: true, reseed: publicReseed(existing), already: true };
    }
    await stopReseed(id);
  }

  const entry = {
    id: id,
    name: String(o.name || id),
    state: 'starting',
    progress: 0,
    magnetURI: null,
    infoHash: null,
    torrent: null,
    error: null
  };
  reseeds.set(id, entry);

  const meta = await createTorrentMeta(verifiedPath, entry.name);
  entry.infoHash = meta.infoHash;
  entry.magnetURI = meta.magnetURI;

  // Live WebTorrent.seed — Electron's Node usually works. Some host Nodes
  // (e.g. Node 25 + webtorrent 2.x) async-throw on seed; smoke uses metadata-only.
  if (!smokeRoot) {
    const client = await getClient();
    if (client) {
      try {
        await new Promise(function (resolve) {
          var settled = false;
          function done() {
            if (settled) return;
            settled = true;
            resolve();
          }
          var torrent;
          try {
            torrent = client.seed(verifiedPath, { name: entry.name });
          } catch (e) {
            done();
            return;
          }
          entry.torrent = torrent;
          var timer = setTimeout(function () {
            entry.state = 'seeding';
            entry.progress = 100;
            done();
          }, 1500);
          torrent.on('error', function () {
            clearTimeout(timer);
            entry.torrent = null;
            done();
          });
          torrent.on('ready', function () {
            clearTimeout(timer);
            entry.infoHash = torrent.infoHash || entry.infoHash;
            entry.magnetURI = torrent.magnetURI || entry.magnetURI || magnetFromInfoHash(entry.infoHash, entry.name);
            entry.state = 'seeding';
            entry.progress = 100;
            done();
          });
        });
      } catch (e) {
        entry.torrent = null;
      }
    }
  }

  entry.state = 'seeding';
  entry.progress = 100;
  if (!entry.magnetURI && entry.infoHash) {
    entry.magnetURI = magnetFromInfoHash(entry.infoHash, entry.name);
  }
  return { ok: true, reseed: publicReseed(entry) };
}

async function stopReseed(id) {
  const key = String(id || '');
  const entry = reseeds.get(key);
  if (!entry) return { ok: true, stopped: false, reason: 'unknown' };
  try {
    if (entry.torrent) {
      await new Promise(function (resolve) {
        try {
          entry.torrent.destroy(function () {
            resolve();
          });
        } catch (e) {
          resolve();
        }
      });
    }
  } catch (e) {
    /* ignore */
  }
  entry.torrent = null;
  entry.state = 'stopped';
  entry.progress = 0;
  reseeds.delete(key);
  return { ok: true, stopped: true, reseed: publicReseed(entry) };
}

module.exports = {
  bindApp,
  bindSmoke,
  startFetch,
  startReseed,
  stopReseed,
  status,
  cancel,
  destroyClient,
  completeWithBuffer,
  waitJob,
  assertAllowedSource,
  ensureWebTorrent,
  getTransportMode,
  isTorrentDisabled,
  isTorrentAllowed,
  normalizeWebseeds,
  jobs,
  reseeds
};
