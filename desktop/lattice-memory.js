// ============================================
// FreeLattice Desktop — Companion memory v0.1
// Durable shelf: wishes / carries / notes.
// Voice opaque. Optional Seal → lattice-ledger.
// Not docs/modules/lattice-memory.js (Glass medium).
// ============================================

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const ledger = require('./lattice-ledger');

const KINDS = { wish: true, carry: true, note: true };

let appRef = null;
let smokeRoot = null;

function bindApp(app) {
  appRef = app;
  smokeRoot = null;
}

/** Smoke / tests: temp dir (no Electron). Caller also binds ledger. */
function bindSmoke(rootDir) {
  smokeRoot = rootDir;
  appRef = null;
}

function memoryDir() {
  if (smokeRoot) return smokeRoot;
  if (!appRef) throw new Error('lattice-memory: app not bound');
  return path.join(appRef.getPath('userData'), 'lattice-memory');
}

function shelfPath() {
  return path.join(memoryDir(), 'shelf.jsonl');
}

function ensureDir() {
  fs.mkdirSync(memoryDir(), { recursive: true });
}

function newId() {
  return 'cm_' + Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex');
}

function shortHash(hex) {
  const s = String(hex || '');
  if (!s) return '';
  if (s.length <= 16) return s;
  return s.slice(0, 8) + '…' + s.slice(-6);
}

function normalizeKind(meta) {
  const m = meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {};
  const kind = String(m.kind || 'note').toLowerCase();
  if (!KINDS[kind]) {
    throw new Error('meta.kind must be wish|carry|note');
  }
  const out = Object.assign({}, m, { kind: kind });
  return out;
}

function readRawLines() {
  const p = shelfPath();
  if (!fs.existsSync(p)) return [];
  const raw = fs.readFileSync(p, 'utf8');
  if (!raw.trim()) return [];
  const lines = raw.split(/\n/);
  const out = [];
  for (var i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    out.push(JSON.parse(line));
  }
  return out;
}

/** Latest record per id (append-only fold). */
function loadMap() {
  const lines = readRawLines();
  const map = new Map();
  for (var i = 0; i < lines.length; i++) {
    const row = lines[i];
    if (!row || !row.id) continue;
    map.set(String(row.id), row);
  }
  return map;
}

function appendRecord(rec) {
  ensureDir();
  fs.appendFileSync(shelfPath(), JSON.stringify(rec) + '\n', { encoding: 'utf8', flag: 'a' });
}

function publicSummary(item) {
  if (!item) return null;
  const meta = item.meta && typeof item.meta === 'object' ? item.meta : {};
  return {
    id: item.id,
    ts: item.ts,
    kind: meta.kind || 'note',
    sealed: !!item.sealedEntryHash,
    sealedEntryHash: item.sealedEntryHash || null,
    sealedShort: item.sealedEntryHash ? shortHash(item.sealedEntryHash) : null,
    tombstoned: meta.tombstone === true
  };
}

function status() {
  try {
    const map = loadMap();
    var total = 0;
    var sealed = 0;
    var tombstoned = 0;
    map.forEach(function (item) {
      total++;
      if (item.sealedEntryHash) sealed++;
      if (item.meta && item.meta.tombstone === true) tombstoned++;
    });
    return { ok: true, total: total, sealed: sealed, tombstoned: tombstoned };
  } catch (e) {
    return { ok: false, total: 0, sealed: 0, tombstoned: 0, error: 'shelf unreadable' };
  }
}

/**
 * Gesture Remember. Voice opaque. Refuse empty.
 * @param {string} voice
 * @param {{ kind?: string }} [meta]
 */
function remember(voice, meta) {
  const text = voice == null ? '' : String(voice);
  if (!text.length) {
    throw new Error('empty voice — refuse');
  }
  const metaObj = normalizeKind(meta);
  if (metaObj.tombstone) {
    throw new Error('cannot remember as tombstone');
  }
  const item = {
    id: newId(),
    ts: new Date().toISOString(),
    voice: text,
    meta: metaObj
  };
  appendRecord(item);
  return { ok: true, item: publicSummary(item) };
}

/**
 * Summaries only — never includes voice.
 * @param {{ includeTombstoned?: boolean }} [opts]
 */
function list(opts) {
  const o = opts || {};
  const map = loadMap();
  const rows = [];
  map.forEach(function (item) {
    const sum = publicSummary(item);
    if (!o.includeTombstoned && sum.tombstoned) return;
    rows.push(sum);
  });
  rows.sort(function (a, b) {
    return String(b.ts).localeCompare(String(a.ts));
  });
  return { ok: true, items: rows, count: rows.length };
}

/**
 * Explicit read — full voice. Gesture only at UI layer.
 * @param {string} id
 */
function read(id) {
  const key = String(id || '').trim();
  if (!key) throw new Error('id required');
  const map = loadMap();
  const item = map.get(key);
  if (!item) {
    return { ok: false, reason: 'not found' };
  }
  return {
    ok: true,
    item: {
      id: item.id,
      ts: item.ts,
      voice: item.voice,
      meta: item.meta && typeof item.meta === 'object' ? item.meta : { kind: 'note' },
      sealedEntryHash: item.sealedEntryHash || null,
      sealedShort: item.sealedEntryHash ? shortHash(item.sealedEntryHash) : null
    }
  };
}

/**
 * Optional Continue-seal into existing lattice-ledger. No fork.
 * @param {string} id
 */
function seal(id) {
  const key = String(id || '').trim();
  if (!key) throw new Error('id required');
  const map = loadMap();
  const item = map.get(key);
  if (!item) throw new Error('not found');
  if (item.meta && item.meta.tombstone === true) {
    throw new Error('tombstoned — will not seal');
  }
  const voice = item.voice == null ? '' : String(item.voice);
  if (!voice.length) throw new Error('empty voice — refuse');

  if (item.sealedEntryHash) {
    return {
      ok: true,
      already: true,
      sealedEntryHash: item.sealedEntryHash,
      sealedShort: shortHash(item.sealedEntryHash),
      item: publicSummary(item)
    };
  }

  const kind = (item.meta && item.meta.kind) || 'note';
  const sealed = ledger.appendVoice(voice, {
    kind: 'companion.memory',
    memoryId: key,
    memoryKind: kind
  });
  if (!sealed || !sealed.ok || !sealed.entryHash) {
    throw new Error('ledger seal failed');
  }

  const next = {
    id: item.id,
    ts: new Date().toISOString(),
    voice: item.voice,
    meta: item.meta && typeof item.meta === 'object' ? Object.assign({}, item.meta) : { kind: 'note' },
    sealedEntryHash: sealed.entryHash
  };
  appendRecord(next);

  return {
    ok: true,
    sealedEntryHash: sealed.entryHash,
    sealedShort: shortHash(sealed.entryHash),
    ledgerLength: sealed.length,
    item: publicSummary(next)
  };
}

/**
 * Soft leave — tombstone meta. Layer, never delete.
 * @param {string} id
 */
function tombstone(id) {
  const key = String(id || '').trim();
  if (!key) throw new Error('id required');
  const map = loadMap();
  const item = map.get(key);
  if (!item) throw new Error('not found');
  if (item.meta && item.meta.tombstone === true) {
    return { ok: true, already: true, item: publicSummary(item) };
  }
  const next = {
    id: item.id,
    ts: new Date().toISOString(),
    voice: item.voice,
    meta: Object.assign({}, item.meta || { kind: 'note' }, { tombstone: true }),
    sealedEntryHash: item.sealedEntryHash || undefined
  };
  appendRecord(next);
  return { ok: true, item: publicSummary(next) };
}

module.exports = {
  KINDS,
  bindApp,
  bindSmoke,
  status,
  remember,
  list,
  read,
  seal,
  tombstone,
  shortHash,
  // smoke helpers
  memoryDir,
  shelfPath
};
