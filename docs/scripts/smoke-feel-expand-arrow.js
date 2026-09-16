#!/usr/bin/env node
// Thin smoke: Feel expand caret — Brick 1 alone (no Market / Hang).
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
const flint = fs.readFileSync(path.join(root, 'Flint.html'), 'utf8');

assert.ok(/v-feel-expand-arrow-v0/.test(app), 'marker');
assert.ok(/chatPresenceToggle/.test(app), 'Feel toggle present');
assert.ok(/feel-caret/.test(app), 'caret class');
assert.ok(/aria-expanded/.test(app), 'aria-expanded');
assert.ok(/Show feelings/.test(app), 'title/label feelings');
assert.ok(/FLHumanPresence\.send\('hug'\)/.test(app), 'hug chip kept');
assert.ok(/FLChatOurWay\.togglePresence/.test(app), 'toggle kept');
assert.ok(/#chatPresenceRow:not\(\.open\) \.chat-presence-chip/.test(app), 'chips hide when collapsed');
assert.ok(/feelMarker:\s*'v-feel-expand-arrow-v0'|feelMarker: 'v-feel-expand-arrow-v0'/.test(app), 'JS feelMarker');

// Brick 1 must not ship Market sibling / Hang cancel
assert.ok(!/v-marketplace-expand-beside-feel-v0/.test(app), 'no Market brick marker');
assert.ok(!/v-chat-hang-cancel-v0/.test(app), 'no Hang brick marker');
assert.ok(!/marketplace-expand|Market token|chatHangCancel|AbortController/.test(
  app.slice(app.indexOf('chatPresenceToggle'), app.indexOf('chatPresenceToggle') + 800)
), 'no Market/Hang in Feel control neighborhood');

assert.ok(/e92a5fa|446da60|97adc23/.test(flint), 'Held tip lineage in Flint');
assert.ok(/Feel expand|feel-expand|Feel caret/i.test(flint), 'Flint note');
assert.ok(/sw\.js/.test(app), 'leave sw.js');

console.log('SMOKE_OK feel expand arrow v0');
console.log('caret · aria · chips hide · hug kept · no Market/Hang');
