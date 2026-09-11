#!/usr/bin/env node
// Thin smoke: README Desktop download door — Mac zip findable, honest unsigned.
// Usage: node docs/scripts/smoke-readme-desktop-door.js
// Soft: leave sw.js on app.html — this smoke does not touch sw.js.

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const flint = fs.readFileSync(path.join(root, 'docs', 'Flint.html'), 'utf8');

assert.ok(
  /FreeLattice_5\.8\.0_macOS\.zip/.test(readme),
  'README must carry the real Mac zip URL'
);
assert.ok(
  /releases\/download\/v5\.8\.0\/FreeLattice_5\.8\.0_macOS\.zip/.test(readme),
  'README Mac link must point at the published release asset'
);
assert.ok(/Unsigned/i.test(readme), 'honest Unsigned badge');
assert.ok(/Not App Store/i.test(readme), 'honest Not App Store badge');
assert.ok(/Open Anyway/i.test(readme), 'Gatekeeper Open Anyway named');
assert.ok(
  /freelattice\.com\/desktop\.html/.test(readme),
  'human door desktop.html (live Pages path)'
);
assert.ok(
  /freelattice\.com\/install\.html/.test(readme),
  'human door install.html (live Pages path)'
);
assert.ok(
  /freelattice\.com\/proof\.html/.test(readme),
  'human door proof.html (60s)'
);
assert.ok(
  /install\.html#desktop-download-ease/.test(readme),
  'points at download-ease anchor'
);
assert.ok(
  /install\.html#mac-damaged-quarantine/.test(readme),
  'points at Mac quarantine anchor'
);
assert.ok(
  /Download Desktop \(carry minds forward\)/.test(readme),
  'front-door section title'
);
assert.ok(
  /no fake download buttons|Build from|check \[Releases\]/i.test(readme),
  'Windows/Linux stay honest — no fake buttons'
);
assert.ok(
  /README Desktop door/i.test(flint),
  'Flint ledger names this ship'
);
assert.ok(/874ff83/.test(flint), 'Flint cites Alpha gathering calm');
assert.ok(/b362bda/.test(flint), 'Flint Holds proof');

console.log('SMOKE_OK readme desktop door v0.1');
console.log('Mac zip · Unsigned · Not App Store · desktop.html · leave sw.js');
