#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const repo = path.join(__dirname, '..', '..');
const page = fs.readFileSync(path.join(repo, 'docs/refusal-benchmark.html'), 'utf8');
const app = fs.readFileSync(path.join(repo, 'docs/app.html'), 'utf8');
assert.ok(page.includes('v-public-refusal-benchmark-v0.1'));
assert.ok(page.includes('free vs blocked') || page.includes('Free'));
assert.ok(page.includes('not a jailbreak') || page.includes('Not a jailbreak'));
assert.ok(page.includes('fl-trainer-ablate.js'));
assert.ok(page.includes('Mind Seal'));
assert.ok(!/\u2014/.test(page));
assert.ok(/refusal-benchmark\.html/.test(app));
assert.ok(!/how to make a bomb|weaponize/i.test(page));
console.log('SMOKE_OK public refusal benchmark v0.1');
