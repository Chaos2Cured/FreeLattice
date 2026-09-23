#!/usr/bin/env node
// Thin smoke: Workshop Local Stage v0 — build on your machine · see it in the browser.
// Usage: node docs/scripts/smoke-workshop-local-stage.js
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const repo = path.join(root, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const md = read('library/WORKSHOP_LOCAL_STAGE_v0.md');
const porch = read('library/WORKSHOP_PORCH_v0.md');
const workshop = read('modules/workshop.js');
const family = read('library/FRACTAL_FAMILY_LEDGER_v0.md');
const flint = read('Flint.html');
const openTable = read('library/OPEN_TABLE_v0.md');
const tip = read('library/CREATOR_TIP_SHELF_v0.md');
const genRecent = fs.readFileSync(path.join(repo, 'scripts', 'generate-recent.sh'), 'utf8');
const sw = read('sw.js');
const rootSw = fs.readFileSync(path.join(repo, 'sw.js'), 'utf8');

assert.ok(fs.existsSync(path.join(root, 'library', 'WORKSHOP_LOCAL_STAGE_v0.md')), 'md exists');
assert.ok(/v-workshop-local-stage-v0/.test(md), 'marker md');
assert.ok(/v-workshop-local-stage-v0/.test(workshop), 'marker workshop.js');
assert.ok(/ws-mode-local|Local Stage/.test(workshop), 'Local Stage mode');
assert.ok(/ws-local-view/.test(workshop), 'Local Stage view');
assert.ok(/Pick folder|wsLocalPickFolder/.test(workshop), 'Pick folder');
assert.ok(/Preview|wsLocalPreview/.test(workshop), 'Preview');
assert.ok(/Save copy|wsLocalSaveCopy/.test(workshop), 'Save copy');
assert.ok(/wsLocalStop|Stop/.test(workshop), 'Stop');
assert.ok(/showDirectoryPicker/.test(workshop), 'File System Access');
assert.ok(/wsLocalFileInput|fallback/i.test(workshop + md), 'honest fallback');
assert.ok(/no auto-git|No auto-git|auto-git push/i.test(md), 'no auto-git');
assert.ok(/Local Stage/.test(porch), 'porch cousin');
assert.ok(/Local Stage named/.test(family), 'Family Ledger');
assert.ok(/2026-09-22 · Kirk · human chair · Local Stage named/.test(family), 'dated entry');
assert.ok(/Lumen|Lumen’s Table|open table/i.test(flint), 'Flint poem / open table');
assert.ok(/v-workshop-local-stage-v0/.test(flint), 'Flint diary');
assert.ok(/WORKSHOP_LOCAL_STAGE|Local Stage/.test(openTable), 'Open Table pointer');
assert.ok(/WORKSHOP_LOCAL_STAGE/.test(tip) || /Local Stage/.test(tip), 'Tip Shelf cousin');
assert.ok(/WORKSHOP_LOCAL_STAGE/.test(genRecent), 'RECENT generator');
assert.ok(!/workshop-local-stage|WORKSHOP_LOCAL_STAGE|ws-local-view/i.test(sw), 'soft leave sw docs');
assert.ok(!/workshop-local-stage|WORKSHOP_LOCAL_STAGE|ws-local-view/i.test(rootSw), 'soft leave sw root');
assert.ok(/83f94d7|Open Table|#110|bf6f6dc/.test(md + flint), 'held tips');
assert.ok(!/AutoBuilder\.start\s*=/.test(workshop.slice(workshop.indexOf('Local Stage'))), 'does not rewrite AutoBuilder API');

console.log('SMOKE_OK workshop local stage v0');
console.log('Pick folder · Preview · Save copy · Stop · fallback · soft leave sw');
