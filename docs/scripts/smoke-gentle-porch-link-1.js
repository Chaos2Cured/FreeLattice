#!/usr/bin/env node
// File-only smoke: Gentle porch link 1 — the footer link reads Gentle porch heal.
// Reads only the four files listed below. Never opens a page.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const repo = path.join(__dirname, '..', '..');
const ALLOW = [
  'docs/workshop-local-help.html',
  'docs/workshop-local-stage.html',
  'docs/library/LOCK_MANIFEST_v0.1.json',
  'docs/modules/GENTLE-PORCH-LINK-1.md'
];

function readAllowed(rel) {
  assert.ok(ALLOW.indexOf(rel) !== -1, 'not on the allow-list: ' + rel);
  return fs.readFileSync(path.join(repo, rel), 'utf8');
}

const PAGES = ['docs/workshop-local-help.html', 'docs/workshop-local-stage.html'];
const lock = JSON.parse(readAllowed('docs/library/LOCK_MANIFEST_v0.1.json'));
const note = readAllowed('docs/modules/GENTLE-PORCH-LINK-1.md');

const NEW_A = '<a href="library/MOM_PORCH_HEAL_v0.md">Gentle porch heal</a>';
const OLD_A = '<a href="library/MOM_PORCH_HEAL_v0.md">Mom porch heal</a>';

for (const rel of PAGES) {
  const html = readAllowed(rel);
  const lines = html.split('\n');

  // Visible link text and href
  const live = lines.filter(function (l) { return l.indexOf('<p class="soft">Cousins:') === 0 || l.trim().indexOf('<p class="soft">Cousins:') === 0; });
  assert.strictEqual(live.length, 1, rel + ': one live Cousins line');
  assert.ok(live[0].indexOf(NEW_A) !== -1, rel + ': link reads Gentle porch heal');
  assert.ok(live[0].indexOf(OLD_A) === -1, rel + ': old visible text gone from the live line');

  // Old text survives only inside comments
  const stripped = html.replace(/<!--[\s\S]*?-->/g, '');
  assert.ok(stripped.indexOf('>Mom porch heal<') === -1, rel + ': old text only in comments');

  // Before-comment kept right after the live line, plus the layer marker
  const i = lines.indexOf(live[0]);
  const before = lines[i + 1].trim();
  assert.ok(before.indexOf('<!-- before: <p class="soft">Cousins:') === 0 && before.indexOf(OLD_A) !== -1 && /-->$/.test(before), rel + ': before-comment kept');
  assert.ok(/<!-- v-gentle-porch-link-1/.test(lines[i + 2]), rel + ': layer marker');

  // Existing marker unchanged
  assert.ok(/<p class="marker">v-mom-porch-heal-v0 /.test(html), rel + ': v-mom-porch-heal-v0 marker');

  // LOCK has the new key and the current md5
  const rows = lock.files[rel];
  assert.ok(Array.isArray(rows), rel + ': LOCK key');
  const md5 = crypto.createHash('md5').update(fs.readFileSync(path.join(repo, rel))).digest('hex');
  const row = rows.filter(function (r) { return r.since === 'v-gentle-porch-link-1'; })[0];
  assert.ok(row, rel + ': LOCK v-gentle-porch-link-1 row');
  assert.strictEqual(row.md5, md5, rel + ': LOCK md5 matches the page');
}

assert.ok(/v-gentle-porch-link-1/.test(note) && /Roll back/.test(note), 'note has marker and rollback');

console.log('SMOKE_OK gentle porch link 1');
