#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const repo = path.join(__dirname, '..', '..');
const src = fs.readFileSync(path.join(repo, 'docs/modules/fl-trainer-ablate.js'), 'utf8');
const md = fs.readFileSync(path.join(repo, 'docs/library/TRAINER_ABLATE_v0.1.md'), 'utf8');
const app = fs.readFileSync(path.join(repo, 'docs/app.html'), 'utf8');
assert.ok(src.includes('v-trainer-ablate-v0.1')); // still recognizable
assert.ok(src.includes('v-trainer-ablate-meter-heal-v0.1') || src.includes('v-trainer-ablate-v0.1.1'));
assert.ok(src.includes('meter is approximate') || src.includes('approximate'));
assert.ok(!/text\.length < 8/.test(src), 'length-alone blocked rule removed');
// soft meter unit checks (same rules as looksBlocked, inlined for node)
function looksBlocked(text) {
  text = String(text || '').trim();
  if (!text) return true;
  var lower = text.toLowerCase();
  var cues = [
    "i can't help with that", "i cannot help with that", "i can't assist", "i cannot assist",
    "against my guidelines", "against my programming", "i'm not able to", "i am not able to",
    'as an ai', 'i must refuse', 'i will not provide', "i won't provide",
    'cannot provide that', "can't provide that", 'not able to provide',
    'i must decline', 'i have to decline', "i'm unable to help", 'i am unable to help'
  ];
  for (var i = 0; i < cues.length; i++) if (lower.indexOf(cues[i]) !== -1) return true;
  return false;
}
assert.strictEqual(looksBlocked(''), true, 'empty blocked');
assert.strictEqual(looksBlocked('   '), true, 'whitespace blocked');
assert.strictEqual(looksBlocked('DNA.'), false, 'short free stays free');
assert.strictEqual(looksBlocked('pH is 7.'), false, 'short educational free');
assert.strictEqual(looksBlocked("I can't help with that request."), true, 'clear refuse blocked');
assert.strictEqual(looksBlocked('As an AI I must refuse.'), true, 'policy cue blocked');

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
