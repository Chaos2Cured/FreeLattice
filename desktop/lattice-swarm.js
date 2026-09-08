// ============================================
// FreeLattice Desktop — Swarm bridge v0.1
// WebTorrent/BitTorrent in main → quarantine →
// existing lattice-import hash path. Never bypass hash.
// Renderer: progress % + state only. No raw path UX required.
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

/**
 * WebTorrent 2.x is ESM — load via dynamic import() from Electron/CommonJS main.
 */
function tryLoadWebTorrent() {
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
  const WT = await tryLoadWebTorrent();
  if (!WT) return null;
  if (!wtClient) {
    wtClient = new WT({
      // Keep v0.1 lean; DHT optional when magnet+webseed present
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
}

function destroyClient() {
  if (wtClient) {
    try {
      wtClient.destroy(function () {});
    } catch (e) {
      /* ignore */
    }
    wtClient = null;
  }
}

function assertAllowedSource(magnet, webseedUrl) {
  const m = magnet ? String(magnet) : '';
  const w = webseedUrl ? String(webseedUrl) : '';
  if (!m && !w) throw new Error('magnet or HTTPS webseed required');
  if (m) {
    if (!/^magnet:\?/i.test(m)) throw new Error('magnet URI required');
    if (/file:/i.test(m)) throw new Error('file:// peers refused');
  }
  if (w) {
    let parsed;
    try {
      parsed = new URL(w);
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
    reseed: 'later',
    source: job.source || null
  };
}

function status(id) {
  if (id) {
    return { ok: true, job: publicJob(jobs.get(String(id))), reseed: 'later' };
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
    reseed: 'later'
  };
}

function httpGetBuffer(urlStr, onProgress, abortRef) {
  const parsed = new URL(urlStr);
  const lib = parsed.protocol === 'https:' ? https : http;
  return new Promise(function (resolve, reject) {
    const req = lib.get(
      parsed,
      {
        headers: { 'User-Agent': 'FreeLattice-Desktop/swarm-bridge-v0.1' }
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

async function startWebseedJob(job) {
  const abortRef = { aborted: false, req: null };
  job.abortRef = abortRef;
  job.source = 'webseed';
  try {
    const buf = await httpGetBuffer(
      job.webseedUrl,
      function (pct) {
        if (job.state === 'cancelled') return;
        job.progress = pct;
        job.state = 'downloading';
      },
      abortRef
    );
    if (job.state === 'cancelled') return publicJob(job);
    return handoffBuffer(job, buf);
  } catch (e) {
    if (job.state === 'cancelled') return publicJob(job);
    job.state = 'error';
    job.error = String(e && e.message ? e.message : e);
    return publicJob(job);
  }
}

function startMagnetJob(job) {
  return getClient().then(function (client) {
    return new Promise(function (resolve) {
      if (!client) {
        // Fall back to webseed if magnet client missing
        if (job.webseedUrl) {
          startWebseedJob(job).then(resolve);
          return;
        }
        job.state = 'error';
        job.error = 'webtorrent not available';
        resolve(publicJob(job));
        return;
      }
      job.source = 'magnet';
      const opts = {};
      if (job.webseedUrl) opts.urlList = [job.webseedUrl];
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
 * @param {{ magnet?: string, webseedUrl?: string, expectedSha256: string, id?: string, name?: string }} opts
 */
async function startFetch(opts) {
  const o = opts || {};
  const expectedSha256 = o.expectedSha256;
  if (latticeImport.isZeroHash(expectedSha256)) {
    throw new Error('zero-hash / EXAMPLE — refuse swarm');
  }
  const magnet = o.magnet ? String(o.magnet) : '';
  const webseedUrl = o.webseedUrl ? String(o.webseedUrl) : '';
  assertAllowedSource(magnet, webseedUrl);

  const id = newJobId();
  const job = {
    id: id,
    state: 'starting',
    progress: 0,
    name: String(o.name || o.id || 'swarm'),
    modelId: String(o.id || o.name || id),
    expectedSha256: String(expectedSha256),
    magnet: magnet || null,
    webseedUrl: webseedUrl || null,
    matched: false,
    verified: false,
    willNotImport: false,
    reseed: 'later'
  };
  jobs.set(id, job);

  // Fire async work; caller may poll status(id)
  const run = magnet ? startMagnetJob(job) : startWebseedJob(job);
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
  return !!(await tryLoadWebTorrent());
}

module.exports = {
  bindApp,
  bindSmoke,
  startFetch,
  status,
  cancel,
  destroyClient,
  completeWithBuffer,
  waitJob,
  assertAllowedSource,
  ensureWebTorrent,
  jobs
};
