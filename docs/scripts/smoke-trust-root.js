#!/usr/bin/env node
// Thin smoke: Trust-root / catalog sign v0.1
// Usage: node docs/scripts/smoke-trust-root.js
// Soft: leave sw.js on app.html

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const catalog = require(path.join(root, 'desktop', 'lattice-catalog.js'));
const latticeImport = require(path.join(root, 'desktop', 'lattice-import.js'));

const models = path.join(root, 'docs', 'models');
const pubkey = fs.readFileSync(path.join(models, 'catalog-sign.v0.1.pubkey.json'), 'utf8');
const sig = fs.readFileSync(path.join(models, 'catalog.v0.1.json.sig'), 'utf8');
const catJson = fs.readFileSync(path.join(models, 'catalog.v0.1.json'), 'utf8');
const spec = fs.readFileSync(path.join(root, 'docs', 'library', 'CATALOG_SIGN_v0.1.md'), 'utf8');
const install = fs.readFileSync(path.join(root, 'docs', 'install.html'), 'utf8');
const flint = fs.readFileSync(path.join(root, 'docs', 'Flint.html'), 'utf8');
const appHtml = fs.readFileSync(path.join(root, 'docs', 'app.html'), 'utf8');

assert.ok(/lattice\.catalog\.v1/.test(pubkey), 'domain in pubkey');
assert.ok(/Ed25519/.test(pubkey), 'Ed25519');
assert.ok(/separate from companion/i.test(pubkey), 'separate from companion seed');

const verified = catalog.verifyCatalogFiles(
  path.join(models, 'catalog.v0.1.json'),
  path.join(models, 'catalog.v0.1.json.sig'),
  root
);
assert.ok(verified.ok, 'catalog signature verifies');
assert.ok(/signed manifest/i.test(verified.honesty), 'honesty string');

const bad = catalog.verifyCatalogBytes(Buffer.from('tampered'), JSON.parse(sig), catalog.loadPinnedPubkey(root).publicKeyBytes);
assert.ok(!bad.ok, 'tamper fails');

const auth = latticeImport.verifyCatalogFromDisk(root);
assert.ok(auth.ok, 'import module verifies from disk');

let closed = false;
try {
  latticeImport.honorModelRow({ redistributable: true, sha256: 'abcd', notes: 'x' });
} catch (e) {
  /* should succeed when auth ok */
}
assert.ok(latticeImport.getCatalogAuth() && latticeImport.getCatalogAuth().ok, 'auth cached');

closed = false;
try {
  latticeImport.honorModelRow({ redistributable: true, sha256: '00', notes: 'EXAMPLE ONLY' });
} catch (e) {
  closed = /EXAMPLE/i.test(String(e.message));
}
assert.ok(closed, 'EXAMPLE refuse');

closed = false;
try {
  latticeImport.honorModelRow({
    redistributable: true,
    sha256: 'abcd',
    withdrawn: { date: '2026-09-12', reason: 'test' }
  });
} catch (e) {
  closed = /withdrawn/i.test(String(e.message));
}
assert.ok(closed, 'withdrawn refuse re-seed path');

assert.ok(/221b95ac04763c139a1fb9789fd8897f7c2638a01e572aaa6223a677a4019337/.test(install), 'Mac SHA on install');
assert.ok(/49beed91f6907fde4a2072944a9765281aeebf67c72b6e9933cd61caa3d9a680/.test(install), 'Win Setup SHA');
assert.ok(/shasum -a 256|certutil -hashfile|sha256sum/.test(install), 'verify commands');
assert.ok(/Thank you, Kimi|thank you, Kimi/i.test(flint), 'Kimi thanked in Flint');
assert.ok(/signed manifest/i.test(appHtml), 'app honesty copy');
assert.ok(/Seeding shares your IP/i.test(appHtml), 'reseed IP sentence');
assert.ok(/Fail closed|fail closed/i.test(spec), 'spec fail closed');
assert.ok(/genesis\.signers byline|signers byline/i.test(catJson) || /signers byline/i.test(spec), 'genesis ≠ crypto sig named');

console.log('SMOKE_OK trust-root v0.1');
console.log('signed catalog · EXAMPLE · withdrawn · pack SHAs · leave sw.js');
