// ============================================
// FreeLattice Desktop — Catalog trust-root v0.1
// Ed25519 verify of signed catalog BEFORE honoring any row.
// Separate from companion seed. Fail closed if missing/bad.
// Domain: lattice.catalog.v1
// ============================================

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DOMAIN = 'lattice.catalog.v1';
const PINNED_PUBKEY_REL = path.join('docs', 'models', 'catalog-sign.v0.1.pubkey.json');

/** EXAMPLE = zero-hash or notes marked EXAMPLE ONLY — will not import or re-seed. */
function isExampleRow(model) {
  if (!model) return true;
  const notes = String(model.notes || '');
  if (/EXAMPLE ONLY/i.test(notes)) return true;
  const s = String(model.sha256 || '').trim().toLowerCase();
  if (!s || /^0+$/.test(s)) return true;
  return false;
}

/** withdrawn: { date, reason? } — refuse re-seed; layer never delete. */
function isWithdrawn(model) {
  if (!model || !model.withdrawn) return false;
  if (typeof model.withdrawn === 'object' && model.withdrawn.date) return true;
  if (model.withdrawn === true) return true;
  return false;
}

function loadPinnedPubkey(repoRoot) {
  const root = repoRoot || path.join(__dirname, '..');
  const p = path.join(root, PINNED_PUBKEY_REL);
  const raw = fs.readFileSync(p, 'utf8');
  const doc = JSON.parse(raw);
  if (!doc || doc.alg !== 'Ed25519' || doc.domain !== DOMAIN || !doc.publicKeyB64) {
    throw new Error('catalog trust-root pubkey invalid');
  }
  const pubBytes = Buffer.from(String(doc.publicKeyB64), 'base64');
  if (pubBytes.length !== 32) throw new Error('catalog trust-root pubkey length');
  return { doc: doc, publicKeyBytes: pubBytes };
}

function publicKeyFromBytes(pubBytes) {
  // SPKI for Ed25519: 302a300506032b6570032100 || 32-byte pub
  const spkiPrefix = Buffer.from('302a300506032b6570032100', 'hex');
  const der = Buffer.concat([spkiPrefix, pubBytes]);
  return crypto.createPublicKey({ key: der, format: 'der', type: 'spki' });
}

/**
 * Verify detached signature document against catalog file bytes.
 * Message = UTF8(domain) || 0x00 || SHA-256(catalogBytes)
 */
function verifyCatalogBytes(catalogBytes, sigDoc, publicKeyBytes) {
  if (!Buffer.isBuffer(catalogBytes)) catalogBytes = Buffer.from(catalogBytes);
  if (!sigDoc || sigDoc.alg !== 'Ed25519' || sigDoc.domain !== DOMAIN || !sigDoc.signatureB64) {
    return { ok: false, reason: 'signature document missing or bad' };
  }
  const bodyHash = crypto.createHash('sha256').update(catalogBytes).digest();
  const expectedHex = bodyHash.toString('hex');
  if (sigDoc.catalogSha256 && String(sigDoc.catalogSha256).toLowerCase() !== expectedHex) {
    return { ok: false, reason: 'signature catalogSha256 mismatch' };
  }
  const msg = Buffer.concat([Buffer.from(DOMAIN, 'utf8'), Buffer.from([0x00]), bodyHash]);
  const sig = Buffer.from(String(sigDoc.signatureB64), 'base64');
  const key = publicKeyFromBytes(publicKeyBytes);
  let good = false;
  try {
    good = crypto.verify(null, msg, key, sig);
  } catch (e) {
    return { ok: false, reason: 'verify threw: ' + String(e && e.message ? e.message : e) };
  }
  if (!good) return { ok: false, reason: 'catalog signature invalid' };
  return {
    ok: true,
    catalogSha256: expectedHex,
    fingerprintHex: crypto
      .createHash('sha256')
      .update(Buffer.from(DOMAIN, 'utf8'))
      .update(Buffer.from([0x00]))
      .update(publicKeyBytes)
      .digest('hex'),
    honesty:
      'hash verifies integrity against the published catalog; catalog authenticity = signed manifest'
  };
}

function verifyCatalogFiles(catalogPath, sigPath, repoRoot) {
  const catalogBytes = fs.readFileSync(catalogPath);
  const sigDoc = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
  const pinned = loadPinnedPubkey(repoRoot);
  if (
    sigDoc.publicKeyFingerprintHex &&
    String(sigDoc.publicKeyFingerprintHex).toLowerCase() !== pinned.doc.fingerprintHex.toLowerCase()
  ) {
    return { ok: false, reason: 'signature fingerprint does not match pinned trust-root' };
  }
  return verifyCatalogBytes(catalogBytes, sigDoc, pinned.publicKeyBytes);
}

/**
 * Fail closed: only honor a model row after catalog authenticity is proven.
 */
function assertRowHonorable(model, catalogAuth) {
  if (!catalogAuth || !catalogAuth.ok) {
    throw new Error('catalog not authentic — refuse row (fail closed)');
  }
  if (isExampleRow(model)) {
    throw new Error('EXAMPLE — will not import or re-seed');
  }
  if (isWithdrawn(model)) {
    throw new Error('withdrawn — refuse re-seed (layer never delete)');
  }
  if (model && model.redistributable !== true) {
    throw new Error('not redistributable — refuse');
  }
  return true;
}

module.exports = {
  DOMAIN,
  PINNED_PUBKEY_REL,
  isExampleRow,
  isWithdrawn,
  loadPinnedPubkey,
  verifyCatalogBytes,
  verifyCatalogFiles,
  assertRowHonorable
};
