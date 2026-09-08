#!/usr/bin/env node
// Smoke: Glass pulses v0.1 — opaque summaries + helix-break pure + forbidden keys.
// Usage: node desktop/scripts/smoke-glass-pulses.js

const assert = require('assert');
const path = require('path');

const GP = require(path.join(__dirname, '..', '..', 'docs', 'modules', 'glass-pulses.js'));

const required = [
  'ledger.appended',
  'ledger.verified',
  'ledger.broken',
  'transfer.verified',
  'transfer.mismatch'
];

required.forEach(function (kind) {
  const s = GP.opaqueSummaryFor(kind);
  assert.ok(s, 'summary for ' + kind);
  assert.ok(s.length <= 80);
  assert.ok(!/https?:\/\//.test(s), 'no URL in ' + kind);
  assert.ok(!/\n.+\n/.test(s));
  const v = GP.validateEmit({ source: 'ledger', kind: kind, summary: 'VOICE LEAK SHOULD BE IGNORED ' + 'x'.repeat(100) });
  assert.strictEqual(v.ok, true, kind + ' validate: ' + (v.reason || ''));
  assert.strictEqual(v.pulse.summary, s, 'must use fixed opaque summary');
  assert.ok(!/VOICE|LEAK/.test(v.pulse.summary));
});

// Forbidden / quiet
assert.strictEqual(GP.validateEmit({ source: 'quiet-room', kind: 'ledger.appended' }).ok, false);
assert.strictEqual(GP.validateEmit({ source: 'ledger', kind: 'not.a.kind' }).ok, false);

// Helix break pure
assert.strictEqual(GP.helixBreakFromPulse('ledger.broken', false), true);
assert.strictEqual(GP.helixBreakFromPulse('ledger.verified', true), false);
assert.strictEqual(GP.helixBreakFromPulse('ledger.appended', true), false);
assert.strictEqual(GP.helixBreakFromPulse('transfer.verified', true), true);
assert.strictEqual(GP.helixBreakFromPulse('transfer.mismatch', false), false);

// Commit each required kind against a stub LatticeMemory
const committed = [];
global.LatticeMemory = {
  commit: function (p) {
    committed.push(p);
    return { ok: true };
  }
};
// Re-require won't rebind — call emit which reads root.LatticeMemory from module closure.
// glass-pulses bound `root` at load time to global — update global.GlassPulses path:
const emit = GP.emitGlassPulse.bind(GP);
required.forEach(function (kind) {
  const src = kind.indexOf('transfer') === 0 ? 'import' : 'ledger';
  const r = emit({ source: src, kind: kind });
  assert.strictEqual(r.ok, true, 'emit ' + kind + ' ' + JSON.stringify(r));
});
assert.strictEqual(committed.length, required.length);
committed.forEach(function (p) {
  assert.deepStrictEqual(Object.keys(p).sort(), ['kind', 'source', 'summary'].sort());
});

console.log('SMOKE_OK glass-pulses v0.1');
console.log('kinds:', required.join(', '));
console.log('helix break: broken→true; verified/appended→clear');
