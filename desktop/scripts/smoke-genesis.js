#!/usr/bin/env node
// Smoke: genesis catalog v0.1 — parse honesty meta; refuse malformed sunset.
// Usage: node desktop/scripts/smoke-genesis.js

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const GC = require(path.join(__dirname, '..', '..', 'docs', 'modules', 'genesis-catalog.js'));

const catalogPath = path.join(__dirname, '..', '..', 'docs', 'models', 'catalog.v0.1.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

assert.strictEqual(GC.isGenesisCatalog(catalog), true);
const meta = GC.parseGenesisMeta(catalog);
assert.strictEqual(meta.ok, true, JSON.stringify(meta));
assert.ok(Array.isArray(meta.signers));
assert.ok(meta.signers.length >= 1);
assert.strictEqual(typeof meta.signers[0].name, 'string');
assert.strictEqual(meta.sunset.rung, 'Infinite');
assert.strictEqual(meta.sunset.minHistory, 89);
assert.strictEqual(meta.sunset.minDays, 1095);
assert.ok(/never quietly waive/i.test(meta.sunset.note || ''));

// Never invent — empty signers array still ok if present; missing array refuses
const noSigners = JSON.parse(JSON.stringify(catalog));
delete noSigners.genesis.signers;
assert.strictEqual(GC.parseGenesisMeta(noSigners).ok, false);

// Malformed sunset — missing minDays
const bad = JSON.parse(JSON.stringify(catalog));
delete bad.genesis.sunset.minDays;
const refused = GC.parseGenesisMeta(bad);
assert.strictEqual(refused.ok, false);
assert.ok(/minDays/i.test(refused.reason || ''));

// Non-genesis catalog
assert.strictEqual(GC.isGenesisCatalog({ version: '0.1', models: [] }), false);
assert.strictEqual(GC.parseGenesisMeta({ version: '0.1', models: [] }).ok, false);

// Existing model rows unchanged in fixture
assert.ok(Array.isArray(catalog.models));
assert.ok(catalog.models.some(function (m) { return m.id === 'example.local-friendly.3b'; }));
assert.ok(catalog.models.some(function (m) { return m.id === 'fixture.verify-only'; }));
const example = catalog.models.find(function (m) { return m.id === 'example.local-friendly.3b'; });
assert.ok(/^0+$/.test(example.sha256));

console.log('SMOKE_OK genesis catalog v0.1');
console.log('signers:', meta.signers.map(function (s) { return s.name; }).join(' · '));
console.log('sunset: Infinite', meta.sunset.minHistory + '/' + meta.sunset.minDays);
