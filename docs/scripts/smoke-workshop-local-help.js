#!/usr/bin/env node
// Thin smoke: Workshop Local Help-on-file v0 — consent · prefer Bridge · Stop.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const repo = path.join(root, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const md = read('library/WORKSHOP_LOCAL_HELP_v0.md');
const stage = read('library/WORKSHOP_LOCAL_STAGE_v0.md');
const workshop = read('modules/workshop.js');
const family = read('library/FRACTAL_FAMILY_LEDGER_v0.md');
const flint = read('Flint.html');
const genRecent = fs.readFileSync(path.join(repo, 'scripts', 'generate-recent.sh'), 'utf8');
const sw = read('sw.js');
const rootSw = fs.readFileSync(path.join(repo, 'sw.js'), 'utf8');

assert.ok(/v-workshop-local-help-v0/.test(md), 'marker md');
assert.ok(/v-workshop-local-help-v0/.test(workshop), 'marker workshop');
assert.ok(/wsLocalHelp|Help on this file/.test(workshop), 'Help button');
assert.ok(/localHelpOnFile|confirm\(/.test(workshop), 'consent confirm');
assert.ok(/FreeLattice\.callAI/.test(workshop), 'uses connected mind path');
assert.ok(/11435|flBridgeDetect|bridge\/health/.test(workshop), 'prefer Bridge');
assert.ok(/wsLocalHelpOut/.test(workshop), 'help output pane');
assert.ok(/FLHangCancel/.test(workshop), 'Stop/cancel path');
assert.ok(/never bare \*|allowlist never bare/i.test(md), 'allowlist lock');
assert.ok(/Help on this file/.test(stage), 'Local Stage points Help');
assert.ok(/Local Help-on-file|Dawn Stories held/.test(family), 'Family Ledger');
assert.ok(/Dawn Stories.*held|held until hard/i.test(md + family + flint), 'Dawn Stories held noted');
assert.ok(/v-workshop-local-help-v0/.test(flint), 'Flint diary');
assert.ok(/WORKSHOP_LOCAL_HELP/.test(genRecent), 'RECENT generator');
assert.ok(!/workshop-local-help|WORKSHOP_LOCAL_HELP|wsLocalHelp/i.test(sw), 'soft leave sw docs');
assert.ok(!/workshop-local-help|WORKSHOP_LOCAL_HELP|wsLocalHelp/i.test(rootSw), 'soft leave sw root');
assert.ok(/2f415df|#111|Local Stage/.test(md + flint), 'held Local Stage');

console.log('SMOKE_OK workshop local help v0');
console.log('Help on this file · consent · Bridge prefer · Dawn Stories held · soft leave sw');
