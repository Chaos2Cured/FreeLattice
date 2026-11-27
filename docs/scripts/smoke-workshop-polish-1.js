#!/usr/bin/env node
// File-only smoke: Workshop polish 1 — plain labels, one Learn door, Garden glass.
// Reads only the five files listed below. Never opens a page.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const repo = path.join(__dirname, '..', '..');
const ALLOW = [
  'docs/modules/workshop.js',
  'docs/app.html',
  'index.html',
  'docs/library/LOCK_MANIFEST_v0.1.json',
  'docs/modules/WORKSHOP-POLISH-1.md'
];

function readAllowed(rel) {
  assert.ok(ALLOW.indexOf(rel) !== -1, 'not on the allow-list: ' + rel);
  return fs.readFileSync(path.join(repo, rel), 'utf8');
}

const ws = readAllowed('docs/modules/workshop.js');
const app = readAllowed('docs/app.html');
const index = readAllowed('index.html');
const lock = readAllowed('docs/library/LOCK_MANIFEST_v0.1.json');
const note = readAllowed('docs/modules/WORKSHOP-POLISH-1.md');

assert.strictEqual(app, index, 'docs/app.html and index.html must be byte-identical');

const appMd5 = crypto.createHash('md5').update(app, 'utf8').digest('hex');
// before (199de1b6): assert.strictEqual(appMd5, 'ab8589557950e7074b4e0b97dcccd23d', 'app.html md5 matches LOCK pin');
// before (472de215): assert.strictEqual(appMd5, '5fcc913fc6b5ff3a20f828c1026ff2a0', 'app.html md5 matches LOCK pin');
assert.strictEqual(appMd5, '724394925650cb0abb8aead5ced1f5b7', 'app.html md5 matches LOCK pin');

const lockJson = JSON.parse(lock);
const appRows = lockJson.files['docs/app.html'];
const indexRows = lockJson.files['index.html'];
assert.ok(appRows && appRows.length >= 13, 'LOCK docs/app.html still has prior pins');
assert.ok(indexRows && indexRows.length >= 13, 'LOCK index.html still has prior pins');
assert.strictEqual(appRows[appRows.length - 1].md5, appMd5, 'LOCK last docs/app.html row');
assert.strictEqual(indexRows[indexRows.length - 1].md5, appMd5, 'LOCK last index.html row');
// before (199de1b6): assert.strictEqual(appRows[appRows.length - 1].since, 'v-workshop-polish-1-hold-1');
assert.ok(appRows.some(function (r) { return r.since === 'v-workshop-polish-1-hold-1' && r.md5 === 'ab8589557950e7074b4e0b97dcccd23d'; }), 'workshop-polish-1-hold-1 pin kept');
// before (472de215): assert.strictEqual(appRows[appRows.length - 1].since, 'v-chat-clay-calm-v0.1');
assert.ok(appRows.some(function (r) { return r.since === 'v-chat-clay-calm-v0.1' && r.md5 === '5fcc913fc6b5ff3a20f828c1026ff2a0'; }), 'chat-clay-calm pin kept');
assert.strictEqual(appRows[appRows.length - 1].since, 'v-gc-front-door-v0.1');
assert.ok(appRows.some(function (r) { return r.md5 === 'b0937409c5b8481d007069eeaa458478'; }), 'legacy clay-glass pin kept');
assert.ok(appRows.some(function (r) { return r.md5 === 'f8dc2462a213589bd3c705a545774e48'; }), 'workshop-polish-1 pin kept');

assert.ok(/v-workshop-polish-1/.test(ws), 'workshop polish marker');
assert.ok(/v-workshop-polish-1/.test(app), 'app polish marker');
assert.ok(/v-workshop-polish-1/.test(note), 'doc note');
assert.ok(/#e8b019/.test(ws) && /rgba\(200,210,230,0\.04\)/.test(ws), 'Garden glass tokens');
assert.ok(/For builders/.test(ws), 'For builders fold');
assert.ok(/Gentle path/.test(ws), 'Gentle path visible');
assert.ok(/Add a tip calculator to this page/.test(ws), 'plain Code placeholder');
assert.ok(/Connect a mind first/.test(ws), 'no-AI hint near Build');
assert.ok(/wsAiHint/.test(ws), 'hint element');
assert.ok(/padding-bottom: 96px/.test(ws) && /padding-bottom: 96px/.test(app), 'FAB / No-AI clearance');
assert.ok(/padding-right:\s*148px/.test(app), 'phone header leaves a right band');
assert.ok(/#tab-workshop \{ padding-top: 32px; \}/.test(app), 'phone Workshop tab top spacing');
assert.ok(!/#fl-clay-corner/.test(app) && !/#fl-clay-corner/.test(index) && !/#fl-clay-corner/.test(ws), 'no CSS or JS in this brick targets the corner by id');

function liveLines(src, re) {
  return src.split('\n').filter(function (line) {
    if (!re.test(line)) return false;
    if (/before:/.test(line)) return false;
    if (/^\s*\/\//.test(line) || /^\s*\/\*/.test(line) || /^\s*\*/.test(line)) return false;
    return true;
  });
}

assert.strictEqual(liveLines(ws, /Mom \/ Jeffrey path/).length, 0, 'Mom / Jeffrey not visible');
assert.ok(/before:.*Mom \/ Jeffrey path/.test(ws), 'Mom / Jeffrey kept as before-comment');
assert.strictEqual(liveLines(ws, /Pick files \(fallback\)/).length, 0, 'Pick files (fallback) not visible');
assert.ok(/>Pick files</.test(ws), 'Pick files button kept, plain');
assert.strictEqual(liveLines(ws, /Checking Agent Bridge/).length, 0, 'Agent Bridge status not default-visible');
assert.strictEqual(liveLines(ws, /launchctl command/).length, 0, 'launchctl placeholder not visible');
assert.ok(/node tools\/agent-bridge\.js/.test(ws), 'agent-bridge command kept');
assert.ok(/Prefer Bridge channel 11435/.test(ws), '11435 kept in For builders');
assert.ok(/http:\/\/127\.0\.0\.1:11435\/bridge\/health/.test(ws), 'bridge health logic unchanged');

const learn = app.slice(app.indexOf('var LEARN_CARDS = ['), app.indexOf('var MORE_CARDS = ['));
const firstCard = learn.match(/\{ id: 'workshop'[\s\S]*?\},/);
assert.ok(firstCard, 'Workshop card in LEARN_CARDS');
assert.ok(/featured: true/.test(firstCard[0]), 'Workshop featured');
assert.ok(learn.indexOf("{ id: 'workshop'") < learn.indexOf("label: 'Refusal benchmark'"), 'Workshop is first Learn door');
assert.ok(/before: \{ id: 'workshop'/.test(learn), 'old LEARN Workshop slot kept as before-comment');
assert.ok(/Start here/.test(app), 'Start here eyebrow');
assert.ok(/#tab-learn, #tab-workshop \{ padding-bottom: 96px; \}/.test(app), 'Learn/Workshop tab padding');

assert.ok(/label: 'Workshop', desc: 'The Workshop/.test(app), 'More-grid card says Workshop');
assert.ok(/before: \{ id: 'workshop', icon: '&#x1F916;', label: 'Agent'/.test(app), 'Agent label kept as before-comment');
const moreIdsLine = app.split('\n').filter(function (l) { return l.startsWith('var MORE_TAB_IDS'); })[0] || '';
assert.ok(moreIdsLine && moreIdsLine.indexOf("'workshop'") === -1, 'workshop not in live MORE_TAB_IDS');
assert.ok(/before: var MORE_TAB_IDS = \[[^\]]*?'workshop'/.test(app), 'old MORE_TAB_IDS kept as before-comment');
assert.ok(/\{ id: 'workshop', icon: '&#x1F6E0;', label: 'Workshop', desc: 'Build with AI\.' \}/.test(app),
  'MORE_GROUPS Build → Workshop kept');

console.log('SMOKE_OK workshop polish 1');
console.log('Gentle path · For builders · Learn door · More Workshop card · Garden glass · phone corner room · LOCK pin ' + appMd5);
