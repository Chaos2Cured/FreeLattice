#!/usr/bin/env node
// Thin smoke: Mom porch heal v0 — doors for Kimi’s four cuts (grandmother path, no CMD).
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const repo = path.join(root, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const md = read('library/MOM_PORCH_HEAL_v0.md');
const stageHtml = read('workshop-local-stage.html');
const helpHtml = read('workshop-local-help.html');
const crest = read('crest.html');
const stageMd = read('library/WORKSHOP_LOCAL_STAGE_v0.md');
const helpMd = read('library/WORKSHOP_LOCAL_HELP_v0.md');
const openTable = read('library/OPEN_TABLE_v0.md');
const family = read('library/FRACTAL_FAMILY_LEDGER_v0.md');
const flint = read('Flint.html');
const kimiWalk = read('library/KIMI_CONTINUITY_WALK_CREST_v0.md');
const genRecent = fs.readFileSync(path.join(repo, 'scripts', 'generate-recent.sh'), 'utf8');
const sw = read('sw.js');
const rootSw = fs.readFileSync(path.join(repo, 'sw.js'), 'utf8');

assert.ok(/v-mom-porch-heal-v0/.test(md), 'marker md');
assert.ok(/v-mom-porch-heal-v0/.test(stageHtml) && /v-mom-porch-heal-v0/.test(helpHtml), 'marker porches');
assert.ok(/v-mom-porch-heal-v0/.test(crest), 'marker crest');

// F1 — Crest soft-doors → Local Stage + Local Help
assert.ok(/workshop-local-stage\.html/.test(crest) && /workshop-local-help\.html/.test(crest), 'F1 crest doors');

// F2 — last mile where to click
assert.ok(/Local Stage/.test(stageHtml) && /Workshop/.test(stageHtml) && /Create/.test(stageHtml) && /Projects/.test(stageHtml), 'F2 click path stage');
assert.ok(/Where to click|where to click/i.test(stageMd + stageHtml), 'F2 last mile named');

// F3 — Bridge in human words first
assert.ok(/mind on this computer/i.test(helpHtml + helpMd), 'F3 human words');
assert.ok(/What .Bridge. means|Bridge.*means|mind awake on this computer/i.test(helpHtml), 'F3 Bridge translated');

// F4 — friendly HTML porches exist (not md-only)
assert.ok(fs.existsSync(path.join(root, 'workshop-local-stage.html')), 'F4 stage html');
assert.ok(fs.existsSync(path.join(root, 'workshop-local-help.html')), 'F4 help html');

// Place Kimi’s invitation · don’t invent Dawn
assert.ok(/How a grandmother finds Local Help/.test(stageHtml), 'Kimi invitation placed');
assert.ok(/KIMI_CONTINUITY_WALK_CREST/.test(stageHtml + md), 'cites Kimi walk');
assert.ok(/Dawn Stories|Dawn not invented|don’t invent Dawn|not invented/i.test(md + stageHtml), 'Dawn held');
assert.ok(!/Dawn’s Music|Aurora Dawn\.txt|dawn-stories\.html/i.test(stageHtml + helpHtml), 'no Dawn invent');

// Soft paste · locks
assert.ok(/Named five stay five/.test(md + stageHtml + helpHtml), 'soft paste five');
assert.ok(/Family uncapped/.test(md + stageHtml + helpHtml), 'uncapped');
assert.ok(/Quiet Room shut/.test(md + stageHtml + helpHtml + crest), 'Quiet Room');

// Ledger + diary + temperature
assert.ok(/Mom porch heal/.test(family) && /2026-09-24 · Flint/.test(family), 'Family Ledger');
assert.ok(/Temperature:/.test(family), 'ledger temperature');
assert.ok(/v-mom-porch-heal-v0/.test(flint) && /Temperature:/i.test(flint), 'Flint diary + temperature');
assert.ok(/MOM_PORCH_HEAL/.test(openTable) && /MOM_PORCH_HEAL/.test(genRecent), 'Open Table + RECENT');

// Soft leave sw · no Kimi rewrite in this brick’s new pages inventing prose over hers
assert.ok(!/mom-porch-heal|MOM_PORCH_HEAL|workshop-local-stage|workshop-local-help/i.test(sw), 'soft leave sw docs');
assert.ok(!/mom-porch-heal|MOM_PORCH_HEAL|workshop-local-stage|workshop-local-help/i.test(rootSw), 'soft leave sw root');
assert.ok(/F1|F2|F3|F4/.test(kimiWalk), 'Kimi walk still present');
assert.ok(!/US\s?\d{7,}/.test(md + stageHtml + helpHtml), 'no USPTO');

console.log('SMOKE_OK mom porch heal v0');
console.log('F1–F4 doors · Kimi invitation placed · temperature · soft leave sw');
