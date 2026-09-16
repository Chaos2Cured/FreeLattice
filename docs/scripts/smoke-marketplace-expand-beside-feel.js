#!/usr/bin/env node
// Thin smoke: Marketplace expand beside Feel — Weft sibling PASS geometry.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
const flint = fs.readFileSync(path.join(root, 'Flint.html'), 'utf8');
const docPath = path.join(root, 'library', 'MARKETPLACE_EXPAND_BESIDE_FEEL_v0.md');
assert.ok(fs.existsSync(docPath), 'doc present');
const doc = fs.readFileSync(docPath, 'utf8');

assert.ok(/v-marketplace-expand-beside-feel-v0/.test(app), 'app marker');
assert.ok(/v-marketplace-expand-beside-feel-v0/.test(doc), 'doc marker');
assert.ok(/Weft|sibling PASS|sibling expand/i.test(doc), 'cites Weft sibling PASS');
assert.ok(/610f70e|Feel/.test(doc), 'Held Feel tip');
assert.ok(/Marketplace Galaxy|travel wallet|446da60|64bd27b/i.test(doc), 'Held Galaxy / travel wallet');

// Band geometry — two controls, Market NOT inside chip wrap
assert.ok(/chatFeelMarketBand/.test(app), 'shared band');
assert.ok(/chatPresenceToggle/.test(app), 'Feel toggle kept');
assert.ok(/chatMarketToggle/.test(app), 'Market toggle');
assert.ok(/chatMarketPanel/.test(app), 'Market panel');
assert.ok(/feel-caret/.test(app), 'Feel caret kept');
assert.ok(/market-caret/.test(app), 'Market own caret');

// Ontology: Market token ≠ second heart
const marketBtnSlice = app.slice(
  app.indexOf('chatMarketToggle'),
  app.indexOf('chatMarketToggle') + 500
);
assert.ok(/Market/.test(marketBtnSlice), 'Market label');
assert.ok(!/&#9825;|♡|Feel/.test(marketBtnSlice.replace(/aria-label="[^"]*"/g, '').replace(/title="[^"]*"/g, '')),
  'Market control is not a second heart (label/title aside)');

// Market not nested inside presence chip list — panel is sibling below band
const panelIdx = app.indexOf('id="chatMarketPanel"');
assert.ok(panelIdx > 0, 'panel id');
assert.ok(/role="region"/.test(app.slice(panelIdx, panelIdx + 120)), 'panel region');
assert.ok(panelIdx > app.indexOf('chatFeelMarketBand'), 'panel after band open');
assert.ok(panelIdx > app.indexOf('</div>', app.indexOf('chatMarketToggle')),
  'panel after Market toggle (below band)');

// Independent aria
assert.ok(/aria-controls="chatMarketPanel"/.test(app), 'Market aria-controls panel');
assert.ok(/aria-controls="chatPresenceRow"/.test(app), 'Feel aria-controls row');
assert.ok(/FLChatMarket\.toggle/.test(app), 'FLChatMarket.toggle');
assert.ok(/marker:\s*'v-marketplace-expand-beside-feel-v0'|marker: "v-marketplace-expand-beside-feel-v0"/.test(app),
  'JS marker');

// Mutual open — Feel toggle must not close Market; Market must not hide chips
assert.ok(/Mutual open|never closes Market|never closes Feel/i.test(app), 'mutual open comments');

// Calm existing doors only
const panelSlice = app.slice(panelIdx, panelIdx + 1200);
assert.ok(/presents\.html/.test(panelSlice), 'Gift Grove / Present Shelf door');
assert.ok(/wallet\.html/.test(panelSlice), 'wallet door');
assert.ok(/MARKETPLACE_GALAXY|Exchange Ring/.test(panelSlice), 'Exchange Ring calm link');
assert.ok(/Presence chips ≠ SKUs|Presence chips != SKUs|chips ≠ SKUs/i.test(app + doc),
  'chips ≠ SKUs');

// Feel still works
assert.ok(/FLHumanPresence\.send\('hug'\)/.test(app), 'hug chip kept');
assert.ok(/#chatPresenceRow:not\(\.open\) \.chat-presence-chip/.test(app), 'chips hide when Feel collapsed');
assert.ok(/v-feel-expand-arrow-v0/.test(app), 'Feel marker kept');

// Hang Cancel may LAYER later — must not live inside Market neighborhood
assert.ok(!/AbortController|FLHangCancel/.test(app.slice(app.indexOf('FLChatMarket'), app.indexOf('FLChatMarket') + 800)),
  'no Abort in Market neighborhood');

assert.ok(/v-marketplace-expand-beside-feel|Marketplace expand|sibling/i.test(flint), 'Flint note');
assert.ok(/610f70e/.test(flint), 'Held Feel in Flint');
assert.ok(/sw\.js/.test(app), 'leave sw.js');

console.log('SMOKE_OK marketplace expand beside feel v0');
console.log('sibling band · own token · panel below · calm doors · Feel kept · no Hang');
