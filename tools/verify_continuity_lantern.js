#!/usr/bin/env node
/** Verify a Continuity Lantern JSON export without network access. */

const fs = require('fs');
const crypto = require('crypto');

const FIELDS = ['names', 'truths', 'context', 'boundaries', 'unfinished', 'closing'];

function canonicalContent(value) {
  const sourceFields = value && typeof value.fields === 'object' ? value.fields : {};
  return JSON.stringify({
    format: typeof value.format === 'string' ? value.format : 'FreeLattice Continuity Lantern',
    version: typeof value.version === 'string' ? value.version : '1.0.0',
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : '',
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : '',
    fields: Object.fromEntries(FIELDS.map(name => [name, typeof sourceFields[name] === 'string' ? sourceFields[name] : '']))
  });
}

const file = process.argv[2];
if (!file) {
  console.error('Usage: node tools/verify_continuity_lantern.js <lantern.json>');
  process.exit(2);
}

let lantern;
try {
  lantern = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (error) {
  console.error(`INVALID JSON: ${error.message}`);
  process.exit(2);
}

if (!lantern.integrity || typeof lantern.integrity.value !== 'string') {
  console.error('UNSEALED: no integrity value is present');
  process.exit(1);
}

if (lantern.integrity.algorithm !== 'SHA-256') {
  console.error(`UNSUPPORTED: ${lantern.integrity.algorithm || 'unknown algorithm'}`);
  process.exit(1);
}

const actual = crypto.createHash('sha256').update(canonicalContent(lantern)).digest('hex');
const expected = lantern.integrity.value;

if (actual !== expected) {
  console.error('SEAL MISMATCH');
  console.error(`expected: ${expected}`);
  console.error(`actual:   ${actual}`);
  process.exit(1);
}

console.log('VERIFIED: Continuity Lantern seal matches its canonical content.');
console.log(`SHA-256: ${actual}`);
