// ============================================
// FreeLattice Desktop — Pair fingerprint v0.1
// Two parties. Outer hash published. Seed sealed in main.
// Never to renderer. Never auto-form.
// ============================================

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const keys = require('./lattice-keys');

const DOMAIN = keys.DOMAIN; // lattice.pair.v1

let appRef = null;
let smokeRoot = null;
/** Smoke-only: inject my public key bytes without Electron companion. */
let smokeMyPub = null;

function bindApp(app) {
  appRef = app;
  smokeRoot = null;
  smokeMyPub = null;
}

function bindSmoke(rootDir, myPublicKeyBytes) {
  smokeRoot = rootDir;
  smokeMyPub = myPublicKeyBytes ? Buffer.from(myPublicKeyBytes) : null;
  appRef = null;
}

function pairDir() {
  if (smokeRoot) return smokeRoot;
  if (!appRef) throw new Error('lattice-pair: app not bound');
  return path.join(appRef.getPath('userData'), 'lattice-pair');
}

function seedFile() {
  return path.join(pairDir(), 'shared.seed.enc');
}

function publicFile() {
  return path.join(pairDir(), 'pair.public.json');
}

function ensurePairDir() {
  fs.mkdirSync(pairDir(), { recursive: true });
}

function getSafeStorage() {
  try {
    return require('electron').safeStorage;
  } catch (e) {
    return null;
  }
}

function encryptionAvailable() {
  if (smokeRoot) return true; // smoke seals with a file wrapper, not OS keychain
  try {
    const safeStorage = getSafeStorage();
    return !!(safeStorage && safeStorage.isEncryptionAvailable && safeStorage.isEncryptionAvailable());
  } catch (e) {
    return false;
  }
}

function decodePeerPub(peerPublicKeyB64) {
  const raw = Buffer.from(String(peerPublicKeyB64 || ''), 'base64');
  if (raw.length !== 32) throw new Error('peer public key must be 32 bytes');
  return raw;
}

function decodeSharedSeed(sharedSeedB64) {
  const raw = Buffer.from(String(sharedSeedB64 || ''), 'base64');
  if (raw.length !== 32) throw new Error('shared seed must be 32 bytes');
  return raw;
}

/**
 * Frozen construction:
 * sortedPubs = lex-smaller pub || lex-larger pub
 * innerHash  = SHA-256( UTF8(domain) || 0x00 || sharedSeed32 )
 * pairFpHex  = SHA-256( UTF8(domain) || 0x00 || sortedPubs || 0x00 || innerHash ) → hex
 */
function computePairFingerprintHex(pubA, pubB, sharedSeed32) {
  const a = Buffer.isBuffer(pubA) ? pubA : Buffer.from(pubA);
  const b = Buffer.isBuffer(pubB) ? pubB : Buffer.from(pubB);
  const seed = Buffer.isBuffer(sharedSeed32) ? sharedSeed32 : Buffer.from(sharedSeed32);
  if (a.length !== 32 || b.length !== 32) throw new Error('pubs must be 32 bytes');
  if (seed.length !== 32) throw new Error('shared seed must be 32 bytes');

  const sorted = Buffer.compare(a, b) <= 0 ? [a, b] : [b, a];
  const sortedPubs = Buffer.concat(sorted);

  const innerHash = crypto
    .createHash('sha256')
    .update(Buffer.from(DOMAIN, 'utf8'))
    .update(Buffer.from([0x00]))
    .update(seed)
    .digest();

  return crypto
    .createHash('sha256')
    .update(Buffer.from(DOMAIN, 'utf8'))
    .update(Buffer.from([0x00]))
    .update(sortedPubs)
    .update(Buffer.from([0x00]))
    .update(innerHash)
    .digest('hex');
}

function myPublicKeyBytes() {
  if (smokeMyPub) {
    if (smokeMyPub.length !== 32) throw new Error('smoke myPub corrupt');
    return smokeMyPub;
  }
  const st = keys.status();
  if (!st.hasKey || !st.publicKeyB64) throw new Error('no companion key');
  const raw = Buffer.from(st.publicKeyB64, 'base64');
  if (raw.length !== 32) throw new Error('companion public key corrupt');
  return raw;
}

function hasPair() {
  try {
    return fs.existsSync(publicFile()) && fs.existsSync(seedFile());
  } catch (e) {
    return false;
  }
}

function readPublicRecord() {
  if (!fs.existsSync(publicFile())) return null;
  try {
    return JSON.parse(fs.readFileSync(publicFile(), 'utf8'));
  } catch (e) {
    return null;
  }
}

function sealSharedSeed(seedBuf) {
  ensurePairDir();
  if (smokeRoot) {
    // Smoke: XOR-mask with fixed label so we still refuse "cleartext export" via API
    // while remaining Electron-free. Not for production.
    const mask = crypto.createHash('sha256').update('lattice-pair-smoke-v0.1').digest();
    const out = Buffer.alloc(32);
    for (var i = 0; i < 32; i++) out[i] = seedBuf[i] ^ mask[i];
    fs.writeFileSync(seedFile(), out);
    return;
  }
  if (!encryptionAvailable()) {
    throw new Error('OS keychain unavailable — refuse cleartext fallback');
  }
  const safeStorage = getSafeStorage();
  const enc = safeStorage.encryptString(seedBuf.toString('base64'));
  fs.writeFileSync(seedFile(), enc);
}

function loadSharedSeed() {
  if (!fs.existsSync(seedFile())) return null;
  if (smokeRoot) {
    const enc = fs.readFileSync(seedFile());
    if (enc.length !== 32) throw new Error('smoke seed corrupt');
    const mask = crypto.createHash('sha256').update('lattice-pair-smoke-v0.1').digest();
    const out = Buffer.alloc(32);
    for (var i = 0; i < 32; i++) out[i] = enc[i] ^ mask[i];
    return out;
  }
  if (!encryptionAvailable()) {
    throw new Error('OS keychain unavailable — refuse cleartext fallback');
  }
  const safeStorage = getSafeStorage();
  const enc = fs.readFileSync(seedFile());
  const b64 = safeStorage.decryptString(enc);
  return Buffer.from(b64, 'base64');
}

function status() {
  const rec = readPublicRecord();
  if (!rec || !hasPair()) {
    return {
      ok: true,
      hasPair: false,
      pairFpHex: null,
      peerPublicKeyB64: null,
      formedAt: null,
      domain: DOMAIN,
      encryptionAvailable: encryptionAvailable()
    };
  }
  return {
    ok: true,
    hasPair: true,
    pairFpHex: rec.pairFpHex || null,
    peerPublicKeyB64: rec.peerPublicKeyB64 || null,
    formedAt: rec.formedAt || null,
    domain: rec.domain || DOMAIN,
    encryptionAvailable: encryptionAvailable()
  };
}

function getPairPublic() {
  return status();
}

/**
 * Gesture-only form. Never auto.
 * @param {{ peerPublicKeyB64: string, sharedSeedB64: string }} opts
 */
function formPair(opts) {
  const o = opts || {};
  if (!smokeRoot && !encryptionAvailable()) {
    throw new Error('OS keychain unavailable — refuse cleartext fallback');
  }
  const myPub = myPublicKeyBytes();
  const peerPub = decodePeerPub(o.peerPublicKeyB64);
  const shared = decodeSharedSeed(o.sharedSeedB64);

  if (Buffer.compare(myPub, peerPub) === 0) {
    throw new Error('peer public key must differ from companion');
  }
  if (hasPair()) {
    throw new Error('pair already formed — clear first');
  }

  const pairFpHex = computePairFingerprintHex(myPub, peerPub, shared);
  sealSharedSeed(shared);

  const record = {
    peerPublicKeyB64: peerPub.toString('base64'),
    pairFpHex: pairFpHex,
    formedAt: new Date().toISOString(),
    domain: DOMAIN
  };
  ensurePairDir();
  fs.writeFileSync(publicFile(), JSON.stringify(record, null, 2) + '\n');

  return {
    ok: true,
    formed: true,
    pairFpHex: pairFpHex,
    peerPublicKeyB64: record.peerPublicKeyB64,
    formedAt: record.formedAt,
    domain: DOMAIN
  };
}

function clearPair() {
  try {
    if (fs.existsSync(seedFile())) fs.unlinkSync(seedFile());
  } catch (e) {
    /* ignore */
  }
  try {
    if (fs.existsSync(publicFile())) fs.unlinkSync(publicFile());
  } catch (e) {
    /* ignore */
  }
  return { ok: true, cleared: true, hasPair: false, domain: DOMAIN };
}

module.exports = {
  DOMAIN,
  bindApp,
  bindSmoke,
  formPair,
  status,
  getPairPublic,
  clearPair,
  computePairFingerprintHex,
  encryptionAvailable
};
