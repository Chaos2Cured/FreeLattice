// ============================================
// FreeLattice Desktop — Companion keys (Step 1)
// Private seed never crosses contextBridge.
// Signing stays in main. No BitTorrent here.
// ============================================

const { safeStorage } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

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

function encryptionAvailable() {
  try {
    return !!(safeStorage && safeStorage.isEncryptionAvailable && safeStorage.isEncryptionAvailable());
  } catch (e) {
    return false;
  }
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
  const enc = safeStorage.encryptString(seed.toString('base64'));
  fs.writeFileSync(seedFile(), enc);
  return { ok: true, created: true };
}

function loadCompanionSeed() {
  if (!encryptionAvailable()) {
    throw new Error('OS keychain unavailable — refuse cleartext fallback');
  }
  if (!hasCompanionKey()) return null;
  const enc = fs.readFileSync(seedFile());
  const b64 = safeStorage.decryptString(enc);
  return Buffer.from(b64, 'base64');
}

function status() {
  return {
    hasKey: hasCompanionKey(),
    encryptionAvailable: encryptionAvailable()
  };
}

/**
 * Sign deferred until identity fixture lands.
 * Seed is loaded (proves round-trip) but never returned.
 */
function signPayload(_payloadB64) {
  const seed = loadCompanionSeed();
  if (!seed) throw new Error('no companion key');
  if (seed.length < 32) throw new Error('companion key corrupt');
  return {
    deferred: true,
    reason: 'signing primitive lands with identity fixture'
  };
}

module.exports = {
  bindApp,
  status,
  createCompanionKey,
  signPayload
};
