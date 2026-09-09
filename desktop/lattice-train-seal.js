// ============================================
// FreeLattice Desktop — Trainer seal v0.1
// Hash Modelfile/JSONL → ledger Continue (training_seal).
// Never auto-seal. Never upload. No multi-GB weight hash.
// GardenTrainer core unchanged — receipt only.
// ============================================

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const keys = require('./lattice-keys');
const ledger = require('./lattice-ledger');
const pair = require('./lattice-pair');

const META_KIND = 'training_seal';
const DEFAULT_VOICE = 'Training sealed.';
const MAX_ARTIFACT_BYTES = 32 * 1024 * 1024; // Modelfile/JSONL only — not weight blobs

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

function sha256Bytes(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function resolveArtifact(artifactBytesOrPath) {
  if (artifactBytesOrPath == null) {
    throw new Error('artifact required — refuse');
  }
  if (Buffer.isBuffer(artifactBytesOrPath)) {
    if (!artifactBytesOrPath.length) throw new Error('empty artifact — refuse');
    if (artifactBytesOrPath.length > MAX_ARTIFACT_BYTES) {
      throw new Error('artifact too large — hash Modelfile/JSONL only, not weight blobs');
    }
    return Buffer.from(artifactBytesOrPath);
  }
  if (artifactBytesOrPath instanceof Uint8Array) {
    if (!artifactBytesOrPath.length) throw new Error('empty artifact — refuse');
    if (artifactBytesOrPath.length > MAX_ARTIFACT_BYTES) {
      throw new Error('artifact too large — hash Modelfile/JSONL only, not weight blobs');
    }
    return Buffer.from(artifactBytesOrPath);
  }
  if (typeof artifactBytesOrPath === 'string') {
    const s = artifactBytesOrPath;
    if (!s.length) throw new Error('empty artifact — refuse');
    var looksLikePath =
      s.indexOf(path.sep) !== -1 || /^[A-Za-z]:[\\/]/.test(s) || s.charAt(0) === '/';
    if (looksLikePath) {
      try {
        if (fs.existsSync(s) && fs.statSync(s).isFile()) {
          const buf = fs.readFileSync(s);
          if (!buf.length) throw new Error('empty artifact — refuse');
          if (buf.length > MAX_ARTIFACT_BYTES) {
            throw new Error('artifact too large — hash Modelfile/JSONL only, not weight blobs');
          }
          return buf;
        }
      } catch (e) {
        if (/empty artifact|too large|refuse/i.test(String(e.message || e))) throw e;
      }
    }
    const buf = Buffer.from(s, 'utf8');
    if (!buf.length) throw new Error('empty artifact — refuse');
    if (buf.length > MAX_ARTIFACT_BYTES) {
      throw new Error('artifact too large — hash Modelfile/JSONL only, not weight blobs');
    }
    return buf;
  }
  throw new Error('artifact must be bytes or path');
}

function resolveCompanionFp(explicit) {
  if (explicit) {
    const hex = String(explicit).trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(hex)) {
      throw new Error('companionFpHex must be 64 hex chars');
    }
    return hex;
  }
  try {
    const st = keys.status();
    if (st && st.hasKey && st.fingerprintHex) {
      return String(st.fingerprintHex).toLowerCase();
    }
  } catch (e) {
    /* fall through */
  }
  throw new Error('no companion key — refuse seal');
}

function resolvePairOuter(explicit) {
  if (explicit) {
    const hex = String(explicit).trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(hex)) {
      throw new Error('pairOuterHex must be 64 hex chars');
    }
    return hex;
  }
  try {
    const st = pair.status();
    if (st && st.formed && st.pairFpHex) {
      return String(st.pairFpHex).toLowerCase();
    }
  } catch (e) {
    /* optional */
  }
  return null;
}

/**
 * Gesture seal. Never auto. Never upload.
 * @param {{
 *   voice?: string,
 *   baseModel?: string,
 *   outName?: string,
 *   artifactBytesOrPath: string|Buffer|Uint8Array,
 *   pairOuterHex?: string,
 *   companionFpHex?: string
 * }} opts
 */
function sealTraining(opts) {
  const o = opts || {};
  const buf = resolveArtifact(o.artifactBytesOrPath);
  const artifactSha256 = sha256Bytes(buf);

  const baseModel = String(o.baseModel || 'unknown').slice(0, 200);
  const outName = String(o.outName || 'training-artifact').slice(0, 200);
  const companionFpHex = resolveCompanionFp(o.companionFpHex || null);
  const pairOuterHex = resolvePairOuter(o.pairOuterHex || null);

  let voice = o.voice == null ? '' : String(o.voice);
  if (!voice.length) voice = DEFAULT_VOICE;

  const meta = {
    kind: META_KIND,
    baseModel: baseModel,
    outName: outName,
    artifactSha256: artifactSha256,
    companionFpHex: companionFpHex
  };
  if (pairOuterHex) meta.pairOuterHex = pairOuterHex;

  const sealed = ledger.appendVoice(voice, meta);
  if (!sealed || !sealed.ok || !sealed.entryHash) {
    throw new Error('ledger seal failed');
  }

  return {
    ok: true,
    entryHash: sealed.entryHash,
    entryShort: sealed.entryShort,
    length: sealed.length,
    artifactSha256: artifactSha256,
    companionFpHex: companionFpHex,
    pairOuterHex: pairOuterHex || null,
    outName: outName,
    baseModel: baseModel,
    metaKind: META_KIND
  };
}

function status() {
  return {
    ok: true,
    metaKind: META_KIND,
    maxArtifactBytes: MAX_ARTIFACT_BYTES,
    defaultVoice: DEFAULT_VOICE,
    bound: !!(appRef || smokeRoot)
  };
}

module.exports = {
  META_KIND,
  DEFAULT_VOICE,
  MAX_ARTIFACT_BYTES,
  bindApp,
  bindSmoke,
  sealTraining,
  status,
  sha256Bytes,
  resolveArtifact
};
