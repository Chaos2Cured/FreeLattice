// ============================================
// FreeLattice Desktop — Ledger envelope v0.1
// Append-only chain.jsonl. Voice opaque.
// Hash chain + companion Ed25519 signature.
// ============================================

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const keys = require('./lattice-keys');

const DOMAIN = keys.DOMAIN; // lattice.pair.v1
const GENESIS_PREV_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

/** Frozen unsigned key order for entryHash (v0.1). */
const UNSIGNED_KEY_ORDER = [
  'domain',
  'fingerprintHex',
  'meta',
  'prevHash',
  'publicKeyB64',
  'ts',
  'voice'
];

let appRef = null;
let smokeRoot = null;
let smokeSeed = null;

function bindApp(app) {
  appRef = app;
  smokeRoot = null;
  smokeSeed = null;
}

/** Smoke / tests: temp dir + seed (no Electron). */
function bindSmoke(rootDir, seedBuf) {
  smokeRoot = rootDir;
  smokeSeed = seedBuf;
  appRef = null;
}

function ledgerDir() {
  if (smokeRoot) return smokeRoot;
  if (!appRef) throw new Error('lattice-ledger: app not bound');
  return path.join(appRef.getPath('userData'), 'lattice-ledger');
}

function chainPath() {
  return path.join(ledgerDir(), 'chain.jsonl');
}

function ensureLedgerDir() {
  fs.mkdirSync(ledgerDir(), { recursive: true });
}

function sortKeysDeep(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  const out = {};
  Object.keys(value)
    .sort()
    .forEach(function (k) {
      out[k] = sortKeysDeep(value[k]);
    });
  return out;
}

/**
 * Canonical JSON without entryHash / signatureB64.
 * Key order frozen in UNSIGNED_KEY_ORDER.
 */
function canonicalUnsigned(fields) {
  const meta = sortKeysDeep(
    fields.meta && typeof fields.meta === 'object' && !Array.isArray(fields.meta)
      ? fields.meta
      : {}
  );
  const ordered = {
    domain: fields.domain,
    fingerprintHex: fields.fingerprintHex,
    meta: meta,
    prevHash: fields.prevHash,
    publicKeyB64: fields.publicKeyB64,
    ts: fields.ts,
    voice: fields.voice
  };
  // Build compact JSON in frozen key order (do not rely on engine key enum order).
  const parts = UNSIGNED_KEY_ORDER.map(function (k) {
    return JSON.stringify(k) + ':' + JSON.stringify(ordered[k]);
  });
  return '{' + parts.join(',') + '}';
}

function entryHashOf(fields) {
  const canon = canonicalUnsigned(fields);
  return crypto.createHash('sha256').update(canon, 'utf8').digest('hex');
}

function readEntries() {
  const p = chainPath();
  if (!fs.existsSync(p)) return [];
  const raw = fs.readFileSync(p, 'utf8');
  if (!raw.trim()) return [];
  const lines = raw.split(/\n/);
  const entries = [];
  for (var i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    entries.push(JSON.parse(line));
  }
  return entries;
}

function shortHash(hex) {
  const s = String(hex || '');
  if (!s) return '';
  if (s.length <= 16) return s;
  return s.slice(0, 8) + '…' + s.slice(-6);
}

function getIdentity() {
  if (smokeSeed) {
    return keys.publicIdentityFromSeed(smokeSeed);
  }
  const st = keys.status();
  if (!st.hasKey || !st.publicKeyB64 || !st.fingerprintHex) {
    throw new Error('no companion key');
  }
  return {
    publicKeyB64: st.publicKeyB64,
    fingerprintHex: st.fingerprintHex
  };
}

function signEntryHash(entryHashHex) {
  const hashBuf = Buffer.from(entryHashHex, 'hex');
  if (hashBuf.length !== 32) throw new Error('entryHash corrupt');
  if (smokeSeed) {
    const signed = keys.signWithSeed(smokeSeed, hashBuf);
    return {
      ok: true,
      signatureB64: signed.signatureB64,
      publicKeyB64: signed.publicKeyB64,
      fingerprintHex: signed.fingerprintHex,
      domain: DOMAIN
    };
  }
  return keys.signPayload(hashBuf.toString('base64'));
}

function status() {
  let entries = [];
  try {
    entries = readEntries();
  } catch (e) {
    return {
      ok: false,
      length: 0,
      headHash: null,
      headShort: null,
      domain: DOMAIN,
      error: 'chain unreadable'
    };
  }
  const head = entries.length ? entries[entries.length - 1] : null;
  return {
    ok: true,
    length: entries.length,
    headHash: head ? head.entryHash : null,
    headShort: head ? shortHash(head.entryHash) : null,
    domain: DOMAIN,
    genesisPrev: GENESIS_PREV_HASH
  };
}

/**
 * Continue — explicit append. Voice opaque. Refuse empty.
 * @param {string} voice
 * @param {object} [meta]
 */
function appendVoice(voice, meta) {
  const text = voice == null ? '' : String(voice);
  if (!text.length) {
    throw new Error('empty voice — refuse');
  }
  // Never feature-parse voice. Store verbatim.

  const identity = getIdentity();
  ensureLedgerDir();

  let entries = [];
  try {
    entries = readEntries();
  } catch (e) {
    throw new Error('chain unreadable — refuse append');
  }

  const prevHash = entries.length
    ? String(entries[entries.length - 1].entryHash)
    : GENESIS_PREV_HASH;

  let metaObj =
    meta && typeof meta === 'object' && !Array.isArray(meta) ? Object.assign({}, meta) : {};
  if (!entries.length && metaObj.kind == null) {
    metaObj.kind = 'genesis';
  }

  const unsigned = {
    domain: DOMAIN,
    fingerprintHex: identity.fingerprintHex,
    meta: metaObj,
    prevHash: prevHash,
    publicKeyB64: identity.publicKeyB64,
    ts: new Date().toISOString(),
    voice: text
  };

  const entryHash = entryHashOf(unsigned);
  const signed = signEntryHash(entryHash);
  if (!signed || !signed.ok || !signed.signatureB64) {
    throw new Error('sign failed');
  }

  const entry = {
    prevHash: unsigned.prevHash,
    entryHash: entryHash,
    signatureB64: signed.signatureB64,
    publicKeyB64: unsigned.publicKeyB64,
    fingerprintHex: unsigned.fingerprintHex,
    domain: unsigned.domain,
    ts: unsigned.ts,
    voice: unsigned.voice,
    meta: unsigned.meta
  };

  // Append-only — never rewrite prior lines.
  fs.appendFileSync(chainPath(), JSON.stringify(entry) + '\n', { encoding: 'utf8', flag: 'a' });

  return {
    ok: true,
    entryHash: entry.entryHash,
    entryShort: shortHash(entry.entryHash),
    length: entries.length + 1,
    ts: entry.ts
  };
}

function verifyEntry(entry, prevExpected) {
  if (!entry || typeof entry !== 'object') {
    return { ok: false, reason: 'not an object' };
  }
  if (entry.domain !== DOMAIN) {
    return { ok: false, reason: 'domain' };
  }
  if (String(entry.prevHash) !== String(prevExpected)) {
    return { ok: false, reason: 'prevHash' };
  }

  const unsigned = {
    domain: entry.domain,
    fingerprintHex: entry.fingerprintHex,
    meta: entry.meta,
    prevHash: entry.prevHash,
    publicKeyB64: entry.publicKeyB64,
    ts: entry.ts,
    voice: entry.voice
  };
  const recomputed = entryHashOf(unsigned);
  if (recomputed !== entry.entryHash) {
    return { ok: false, reason: 'entryHash' };
  }

  const hashBuf = Buffer.from(String(entry.entryHash), 'hex');
  if (hashBuf.length !== 32) {
    return { ok: false, reason: 'entryHash length' };
  }
  const sigOk = keys.verifySignature(entry.publicKeyB64, hashBuf, entry.signatureB64);
  if (!sigOk) {
    return { ok: false, reason: 'signature' };
  }
  return { ok: true };
}

function verifyChain() {
  let entries;
  try {
    entries = readEntries();
  } catch (e) {
    return { ok: false, length: 0, checked: 0, reason: 'unreadable' };
  }

  let prev = GENESIS_PREV_HASH;
  for (var i = 0; i < entries.length; i++) {
    const result = verifyEntry(entries[i], prev);
    if (!result.ok) {
      return {
        ok: false,
        length: entries.length,
        checked: i,
        failedAt: i,
        reason: result.reason
      };
    }
    prev = entries[i].entryHash;
  }
  return {
    ok: true,
    length: entries.length,
    checked: entries.length,
    headHash: entries.length ? entries[entries.length - 1].entryHash : null,
    headShort: entries.length ? shortHash(entries[entries.length - 1].entryHash) : null
  };
}

module.exports = {
  DOMAIN,
  GENESIS_PREV_HASH,
  UNSIGNED_KEY_ORDER,
  bindApp,
  bindSmoke,
  status,
  appendVoice,
  verifyChain,
  // Pure helpers for smoke
  canonicalUnsigned,
  entryHashOf,
  verifyEntry,
  shortHash
};
