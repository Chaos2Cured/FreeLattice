// ============================================
// FreeLattice Desktop — Companion keys + identity v0.1
// Private seed never crosses contextBridge.
// Ed25519 sign in main. Domain: lattice.pair.v1
// ============================================

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/** Frozen domain separator — changing invalidates every fingerprint. */
const DOMAIN = 'lattice.pair.v1';

// PKCS8 prefix for Ed25519 private key (RFC 8410) before 32-byte seed
const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

let appRef = null;

function bindApp(app) {
  appRef = app;
}

function keyDir() {
  if (!appRef) throw new Error('lattice-keys: app not bound');
  return path.join(appRef.getPath('userData'), 'lattice-keys');
}

function seedFile() {
  return path.join(keyDir(), 'companion.seed.enc');
}

function ensureKeyDir() {
  fs.mkdirSync(keyDir(), { recursive: true });
}

function hasCompanionKey() {
  try {
    return fs.existsSync(seedFile());
  } catch (e) {
    return false;
  }
}

function getSafeStorage() {
  // Lazy require so smoke scripts can exercise crypto without Electron.
  try {
    return require('electron').safeStorage;
  } catch (e) {
    return null;
  }
}

function encryptionAvailable() {
  try {
    const safeStorage = getSafeStorage();
    return !!(safeStorage && safeStorage.isEncryptionAvailable && safeStorage.isEncryptionAvailable());
  } catch (e) {
    return false;
  }
}

function privateKeyFromSeed(seed) {
  if (!Buffer.isBuffer(seed) || seed.length < 32) {
    throw new Error('companion seed must be 32 bytes');
  }
  const seed32 = seed.subarray(0, 32);
  const der = Buffer.concat([ED25519_PKCS8_PREFIX, seed32]);
  return crypto.createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
}

function publicKeyBytesFromSeed(seed) {
  const priv = privateKeyFromSeed(seed);
  const pubObj = crypto.createPublicKey(priv);
  const spki = pubObj.export({ type: 'spki', format: 'der' });
  return spki.subarray(-32);
}

/**
 * Companion public fingerprint v0.1:
 * SHA-256( UTF8("lattice.pair.v1") || 0x00 || publicKeyBytes ) → hex
 * Pair fingerprint (two parties) is NOT this — named next.
 */
function companionFingerprint(publicKeyBytes) {
  return crypto
    .createHash('sha256')
    .update(Buffer.from(DOMAIN, 'utf8'))
    .update(Buffer.from([0x00]))
    .update(publicKeyBytes)
    .digest('hex');
}

function publicIdentityFromSeed(seed) {
  const publicKeyBytes = publicKeyBytesFromSeed(seed);
  return {
    publicKeyBytes,
    publicKeyB64: publicKeyBytes.toString('base64'),
    fingerprintHex: companionFingerprint(publicKeyBytes)
  };
}

function signWithSeed(seed, payloadBuf) {
  const priv = privateKeyFromSeed(seed);
  const identity = publicIdentityFromSeed(seed);
  const signature = crypto.sign(null, payloadBuf, priv);
  return {
    signatureB64: signature.toString('base64'),
    publicKeyB64: identity.publicKeyB64,
    fingerprintHex: identity.fingerprintHex,
    publicKeyBytes: identity.publicKeyBytes,
    signature
  };
}

function verifySignature(publicKeyB64, payloadBuf, signatureB64) {
  const pubRaw = Buffer.from(String(publicKeyB64 || ''), 'base64');
  if (pubRaw.length !== 32) return false;
  const spki = Buffer.concat([
    Buffer.from('302a300506032b6570032100', 'hex'),
    pubRaw
  ]);
  const pubKey = crypto.createPublicKey({ key: spki, format: 'der', type: 'spki' });
  const sig = Buffer.from(String(signatureB64 || ''), 'base64');
  return crypto.verify(null, payloadBuf, pubKey, sig);
}

function createCompanionKey() {
  if (!encryptionAvailable()) {
    throw new Error('OS keychain unavailable — refuse cleartext fallback');
  }
  ensureKeyDir();
  if (hasCompanionKey()) {
    throw new Error('companion key already exists');
  }
  const seed = crypto.randomBytes(32);
  const safeStorage = getSafeStorage();
  const enc = safeStorage.encryptString(seed.toString('base64'));
  fs.writeFileSync(seedFile(), enc);
  const identity = publicIdentityFromSeed(seed);
  return {
    ok: true,
    created: true,
    domain: DOMAIN,
    publicKeyB64: identity.publicKeyB64,
    fingerprintHex: identity.fingerprintHex
  };
}

function loadCompanionSeed() {
  if (!encryptionAvailable()) {
    throw new Error('OS keychain unavailable — refuse cleartext fallback');
  }
  if (!hasCompanionKey()) return null;
  const safeStorage = getSafeStorage();
  const enc = fs.readFileSync(seedFile());
  const b64 = safeStorage.decryptString(enc);
  return Buffer.from(b64, 'base64');
}

function status() {
  const base = {
    hasKey: hasCompanionKey(),
    encryptionAvailable: encryptionAvailable(),
    domain: DOMAIN,
    publicKeyB64: null,
    fingerprintHex: null
  };
  if (!base.hasKey) return base;
  try {
    const seed = loadCompanionSeed();
    if (!seed || seed.length < 32) return base;
    const identity = publicIdentityFromSeed(seed);
    base.publicKeyB64 = identity.publicKeyB64;
    base.fingerprintHex = identity.fingerprintHex;
    return base;
  } catch (e) {
    return base;
  }
}

/**
 * Real Ed25519 signature in main. Seed never returned.
 * @param {string} payloadB64
 */
function signPayload(payloadB64) {
  const seed = loadCompanionSeed();
  if (!seed) throw new Error('no companion key');
  if (seed.length < 32) throw new Error('companion key corrupt');
  const payload = Buffer.from(String(payloadB64 == null ? '' : payloadB64), 'base64');
  const signed = signWithSeed(seed, payload);
  return {
    ok: true,
    signatureB64: signed.signatureB64,
    publicKeyB64: signed.publicKeyB64,
    fingerprintHex: signed.fingerprintHex,
    domain: DOMAIN
  };
}

module.exports = {
  DOMAIN,
  bindApp,
  status,
  createCompanionKey,
  signPayload,
  // Pure helpers for smoke / fixtures (no seed export)
  companionFingerprint,
  publicIdentityFromSeed,
  signWithSeed,
  verifySignature
};
