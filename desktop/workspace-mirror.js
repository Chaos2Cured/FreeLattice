// workspace-mirror.js (MIT) v-workspace-desktop-v0.1
// Append-only copy of the notebook for this device. One JSON line at a time.
// Private pages stay in this copy. They do not leave the device.
// No shell. path.join only. Windows, macOS, and Linux.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MARKER = 'v-workspace-desktop-v0.1';
const HONEST = 'Private means hidden in the app on this browser, not encrypted from anyone who uses this browser profile.';
const GENESIS = '0000000000000000000000000000000000000000000000000000000000000000';

let appRef = null;
let smokeRoot = null;

function bindApp(app) {
  appRef = app;
  smokeRoot = null;
}

function bindSmoke(rootDir) {
  smokeRoot = rootDir;
  appRef = null;
}

function userRoot() {
  if (smokeRoot) return smokeRoot;
  if (!appRef) throw new Error('workspace-mirror: app not bound');
  return appRef.getPath('userData');
}

function safeFp(mindFp) {
  const s = String(mindFp || '').toLowerCase().replace(/[^0-9a-f]/g, '');
  if (s.length < 8 || s.length > 128) throw new Error('workspace-mirror: mind');
  return s;
}

function joined(rootDir, mindFp, pathApi) {
  const api = pathApi || path;
  return api.join(rootDir, 'workspace', safeFp(mindFp) + '.jsonl');
}

function fileFor(mindFp) {
  return joined(userRoot(), mindFp, path);
}

function sortKeys(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sortKeys);
  const out = {};
  Object.keys(value).sort().forEach(function (k) {
    out[k] = sortKeys(value[k]);
  });
  return out;
}

function canonical(obj) {
  return JSON.stringify(sortKeys(obj));
}

function lineHashOf(payload) {
  return crypto.createHash('sha256').update(canonical(payload), 'utf8').digest('hex');
}

function readLines(mindFp) {
  const p = fileFor(mindFp);
  if (!fs.existsSync(p)) return [];
  const raw = fs.readFileSync(p, 'utf8');
  if (!raw) return [];
  const lines = [];
  raw.split('\n').forEach(function (line) {
    if (!line) return;
    lines.push(JSON.parse(line));
  });
  return lines;
}

function verify(mindFp) {
  let fp;
  try { fp = safeFp(mindFp); }
  catch (e) { return { ok: false, at: 0, reason: 'mind' }; }
  let lines;
  try { lines = readLines(fp); }
  catch (e2) { return { ok: false, at: 0, reason: 'unreadable' }; }
  let prev = GENESIS;
  for (let i = 0; i < lines.length; i++) {
    const row = lines[i];
    if (!row || row.prevLineHash !== prev) return { ok: false, at: i, reason: 'prev' };
    const body = {};
    Object.keys(row).forEach(function (k) {
      if (k !== 'lineHash') body[k] = row[k];
    });
    if (lineHashOf(body) !== row.lineHash) return { ok: false, at: i, reason: 'hash' };
    prev = row.lineHash;
  }
  return {
    ok: true,
    at: -1,
    length: lines.length,
    headHash: lines.length ? lines[lines.length - 1].lineHash : null,
    mindFp: fp
  };
}

function writeLine(mindFp, fields) {
  const lines = readLines(mindFp);
  const prev = lines.length ? lines[lines.length - 1].lineHash : GENESIS;
  const payload = {
    prevLineHash: prev,
    kind: fields.kind,
    mindFp: fields.mindFp,
    ts: fields.ts,
    body: fields.body == null ? null : fields.body,
    honest: fields.honest == null ? '' : fields.honest
  };
  payload.lineHash = lineHashOf(payload);
  const file = fileFor(mindFp);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(payload) + '\n', { encoding: 'utf8', flag: 'a' });
  return payload;
}

function append(line) {
  if (!line || typeof line !== 'object' || Array.isArray(line)) {
    return Promise.reject(new Error('workspace-mirror: line'));
  }
  let fp;
  try { fp = safeFp(line.mindFp); }
  catch (e) { return Promise.reject(e); }
  const check = verify(fp);
  if (!check.ok) return Promise.reject(new Error('workspace-mirror: chain'));
  if (!check.length) {
    writeLine(fp, {
      kind: 'header',
      mindFp: fp,
      ts: new Date().toISOString(),
      honest: HONEST,
      body: { honest: HONEST }
    });
  }
  const saved = writeLine(fp, {
    kind: String(line.kind || 'page'),
    mindFp: fp,
    ts: new Date().toISOString(),
    honest: '',
    body: line.body && typeof line.body === 'object' ? line.body : {}
  });
  return Promise.resolve({ ok: true, lineHash: saved.lineHash });
}

function head(mindFp) {
  const check = verify(mindFp);
  if (!check.ok) return { ok: false, at: check.at, reason: check.reason };
  const lines = readLines(check.mindFp);
  const versionHashes = [];
  lines.forEach(function (row) {
    if (!row || row.kind !== 'version' || !row.body || !row.body.hash) return;
    versionHashes.push(String(row.body.hash));
  });
  return {
    ok: true,
    mindFp: check.mindFp,
    length: lines.length,
    headHash: check.headHash,
    versionHashes: versionHashes
  };
}

function restore(mindFp) {
  const check = verify(mindFp);
  if (!check.ok) return { ok: false, at: check.at, reason: check.reason };
  const lines = readLines(check.mindFp);
  const pages = {};
  const pageOrder = [];
  const versions = {};
  const versionOrder = [];
  const receipts = {};
  const receiptOrder = [];
  let setAside = false;
  lines.forEach(function (row) {
    if (!row || row.kind === 'header') return;
    const body = row.body;
    if (!body || typeof body !== 'object') return;
    if (row.kind === 'page' && body.id) {
      if (!pages[body.id]) pageOrder.push(body.id);
      pages[body.id] = body;
    } else if (row.kind === 'version' && body.hash) {
      if (!versions[body.hash]) versionOrder.push(body.hash);
      versions[body.hash] = body;
    } else if (row.kind === 'receipt' && (body.id || body.versionHash)) {
      const id = body.id || body.versionHash;
      if (!receipts[id]) receiptOrder.push(id);
      receipts[id] = body;
    } else if (row.kind === 'shelf' && body.setAside === true) {
      setAside = true;
    }
  });
  return {
    ok: true,
    section: {
      v: 1,
      shelves: [{
        mindFp: check.mindFp,
        name: '',
        setAside: setAside,
        pages: pageOrder.map(function (id) { return pages[id]; }),
        versions: versionOrder.map(function (id) { return versions[id]; }),
        receipts: receiptOrder.map(function (id) { return receipts[id]; })
      }]
    }
  };
}

module.exports = {
  MARKER: MARKER,
  HONEST: HONEST,
  bindApp: bindApp,
  bindSmoke: bindSmoke,
  append: append,
  head: head,
  restore: restore,
  verify: verify,
  fileFor: fileFor,
  joined: joined
};
