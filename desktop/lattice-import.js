// ============================================
// FreeLattice Desktop — Verified HTTPS import v0.1
// HTTPS fetch → quarantine → SHA-256 match → verified/
// → user-gesture Import to Ollama. Never auto-import.
// Renderer: status only. No arbitrary path write. No seed.
// ============================================

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { URL } = require('url');

let appRef = null;
let smokeRoot = null;

/** id → absolute verified path (main memory only; not exposed as writable path API). */
const verifiedById = new Map();

function bindApp(app) {
  appRef = app;
  smokeRoot = null;
}

function bindSmoke(rootDir) {
  smokeRoot = rootDir;
  appRef = null;
  verifiedById.clear();
}

function importRoot() {
  if (smokeRoot) return smokeRoot;
  if (!appRef) throw new Error('lattice-import: app not bound');
  return path.join(appRef.getPath('userData'), 'lattice-import');
}

function quarantineDir() {
  return path.join(importRoot(), 'quarantine');
}

function verifiedDir() {
  return path.join(importRoot(), 'verified');
}

function ensureDirs() {
  fs.mkdirSync(quarantineDir(), { recursive: true });
  fs.mkdirSync(verifiedDir(), { recursive: true });
}

function isZeroHash(sha) {
  const s = String(sha || '').trim().toLowerCase();
  return !s || /^0+$/.test(s);
}

function isExampleRow(model) {
  if (!model) return true;
  const notes = String(model.notes || '');
  if (/EXAMPLE ONLY/i.test(notes)) return true;
  if (isZeroHash(model.sha256)) return true;
  return false;
}

function assertHttpsUrl(urlStr) {
  let parsed;
  try {
    parsed = new URL(String(urlStr || ''));
  } catch (e) {
    throw new Error('invalid url');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('HTTPS only — refuse');
  }
  return parsed;
}

function safeSegment(id) {
  const s = String(id || 'file')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(0, 80);
  return s || 'file';
}

function sha256Buffer(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest('hex');
}

function resolveUnder(root, candidate) {
  const resolved = path.resolve(candidate);
  const rootResolved = path.resolve(root) + path.sep;
  if (resolved !== path.resolve(root) && !resolved.startsWith(rootResolved)) {
    throw new Error('path escapes import root');
  }
  return resolved;
}

function countFiles(dir) {
  try {
    if (!fs.existsSync(dir)) return 0;
    return fs.readdirSync(dir).filter(function (n) {
      try {
        return fs.statSync(path.join(dir, n)).isFile();
      } catch (e) {
        return false;
      }
    }).length;
  } catch (e) {
    return 0;
  }
}

function status() {
  ensureDirs();
  const lastIds = Array.from(verifiedById.keys()).slice(-5);
  return {
    ok: true,
    quarantineCount: countFiles(quarantineDir()),
    verifiedCount: countFiles(verifiedDir()),
    rememberedIds: lastIds,
    autoImport: false
  };
}

function httpsGetBuffer(urlStr) {
  const parsed = assertHttpsUrl(urlStr);
  return new Promise(function (resolve, reject) {
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.get(
      parsed,
      {
        headers: { 'User-Agent': 'FreeLattice-Desktop/verified-import-v0.1' }
      },
      function (res) {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // One redirect hop, still must be https
          res.resume();
          httpsGetBuffer(res.headers.location).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error('download status ' + res.statusCode));
          return;
        }
        const chunks = [];
        let total = 0;
        const MAX = 512 * 1024 * 1024; // 512MB ceiling for v0.1 safety
        res.on('data', function (c) {
          total += c.length;
          if (total > MAX) {
            req.destroy();
            reject(new Error('download too large'));
            return;
          }
          chunks.push(c);
        });
        res.on('end', function () {
          resolve(Buffer.concat(chunks));
        });
        res.on('error', reject);
      }
    );
    req.on('error', reject);
    req.setTimeout(120000, function () {
      req.destroy();
      reject(new Error('download timeout'));
    });
  });
}

/**
 * Core hash path: bytes → quarantine → match? verified/ : stay quarantined.
 * @returns status object (no raw path write API for renderer)
 */
function ingestAndVerify(buffer, expectedSha256, id) {
  if (isZeroHash(expectedSha256)) {
    throw new Error('zero-hash / EXAMPLE — refuse');
  }
  const expected = String(expectedSha256).trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expected)) {
    throw new Error('expected sha256 must be 64 hex chars');
  }
  ensureDirs();
  const seg = safeSegment(id);
  const stamp = Date.now();
  const qName = seg + '.' + stamp + '.bin';
  const qPath = path.join(quarantineDir(), qName);
  fs.writeFileSync(qPath, buffer);

  const actual = sha256Buffer(buffer);
  if (actual !== expected) {
    return {
      ok: false,
      matched: false,
      quarantined: true,
      willNotImport: true,
      id: String(id || ''),
      expectedSha256: expected,
      actualSha256: actual,
      reason: 'hash mismatch — quarantined; will not import'
    };
  }

  const vName = seg + '.' + actual.slice(0, 12) + '.bin';
  const vPath = path.join(verifiedDir(), vName);
  fs.renameSync(qPath, vPath);
  verifiedById.set(String(id || seg), vPath);

  return {
    ok: true,
    matched: true,
    quarantined: false,
    verified: true,
    id: String(id || seg),
    sha256: actual,
    verifiedBase: path.basename(vPath)
  };
}

/**
 * HTTPS download to quarantine, hash, promote on match.
 */
async function fetchAndHash(url, expectedSha256, id) {
  assertHttpsUrl(url);
  if (isZeroHash(expectedSha256)) {
    return {
      ok: false,
      matched: false,
      willNotImport: true,
      reason: 'zero-hash / EXAMPLE — refuse fetch'
    };
  }
  const buf = await httpsGetBuffer(url);
  return ingestAndVerify(buf, expectedSha256, id);
}

function getVerifiedPathForId(id) {
  const p = verifiedById.get(String(id || ''));
  if (!p) return null;
  try {
    return resolveUnder(verifiedDir(), p);
  } catch (e) {
    return null;
  }
}

/**
 * User-gesture Import to Ollama. Never auto.
 * Renderer passes id + name only — path resolved in main from verified map.
 */
async function importToOllama(opts) {
  const options = opts || {};
  const id = String(options.id || '');
  const name = String(options.name || id || '').trim();
  if (!name || !/^[a-zA-Z0-9._:-]+$/.test(name)) {
    throw new Error('invalid model name');
  }
  const verifiedPath = getVerifiedPathForId(id);
  if (!verifiedPath || !fs.existsSync(verifiedPath)) {
    throw new Error('not verified — will not import');
  }
  resolveUnder(verifiedDir(), verifiedPath);

  const modelfile = 'FROM ' + verifiedPath + '\n';
  const body = JSON.stringify({ name: name, modelfile: modelfile, stream: false });

  return new Promise(function (resolve) {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 11434,
        path: '/api/create',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        },
        timeout: 10000
      },
      function (res) {
        const chunks = [];
        res.on('data', function (c) {
          chunks.push(c);
        });
        res.on('end', function () {
          const text = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              ok: true,
              imported: true,
              name: name,
              id: id,
              ollamaStatus: res.statusCode
            });
          } else {
            resolve({
              ok: false,
              imported: false,
              name: name,
              id: id,
              reason: 'ollama refused (' + res.statusCode + ')',
              detail: text.slice(0, 200)
            });
          }
        });
      }
    );
    req.on('error', function (e) {
      resolve({
        ok: false,
        imported: false,
        name: name,
        id: id,
        reason: 'ollama absent or unreachable',
        detail: String(e && e.message ? e.message : e)
      });
    });
    req.on('timeout', function () {
      req.destroy();
      resolve({
        ok: false,
        imported: false,
        name: name,
        id: id,
        reason: 'ollama absent or unreachable',
        detail: 'timeout'
      });
    });
    req.write(body);
    req.end();
  });
}

module.exports = {
  bindApp,
  bindSmoke,
  status,
  fetchAndHash,
  ingestAndVerify,
  importToOllama,
  getVerifiedPathForId,
  isZeroHash,
  isExampleRow,
  assertHttpsUrl,
  sha256Buffer,
  verifiedById,
  verifiedDir
};
