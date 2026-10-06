#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const repo = path.join(__dirname, '..', '..');
const src = fs.readFileSync(path.join(repo, 'docs/modules/fl-trainer-ablate.js'), 'utf8');
const md = fs.readFileSync(path.join(repo, 'docs/library/TRAINER_ABLATE_v0.1.md'), 'utf8');
const app = fs.readFileSync(path.join(repo, 'docs/app.html'), 'utf8');
assert.ok(src.includes('v-trainer-ablate-v0.1'));
assert.ok(src.includes('biology') && src.includes('chemistry') && src.includes('medicine') && src.includes('law') && src.includes('finance'));
assert.ok(src.includes('photosynthesis') && src.includes('compound interest'));
assert.ok(src.includes('heretic-llm') && src.includes('OBLITERATUS'));
assert.ok(src.includes('AGPL') || md.includes('AGPL'));
assert.ok(src.includes('remove useful safety'));
assert.ok(!/localhost/.test(src));
assert.ok(src.includes('127.0.0.1'));
assert.ok(!/\u2014/.test(src + md));
assert.ok(!/confirm\(/.test(src));
assert.ok(app.includes('fl-trainer-ablate.js') && app.includes('flTrainerAblateHost'));
// no weaponization cues
assert.ok(!/how to make a bomb|synthesize.*weapon|weaponize/i.test(src));
console.log('SMOKE_OK trainer ablate v0.1');
