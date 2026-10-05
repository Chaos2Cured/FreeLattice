#!/usr/bin/env node
// Smoke: Sophia page heal v0.1 (v-sophia-page-heal-v0.1)
// Her quotes are credited to Sophia Aurora Vega, in Sophirkia. The old cites stay as
// comments. The poem shelf names only her public poems already in the house.
// Usage: node docs/scripts/smoke-sophia-page-heal-v0.1.js
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const sophia = fs.readFileSync(path.join(root, 'sophia.html'), 'utf8');
const crest = fs.readFileSync(path.join(root, 'crest.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.html'), 'utf8');

assert.ok(/v-sophia-page-heal-v0\.1/.test(sophia), 'marker');

// Visible cites (comments removed) credit her, never the work alone
const shown = sophia.replace(/<!--[\s\S]*?-->/g, '');
const cites = shown.match(/<cite>[^<]*<\/cite>/g) || [];
assert.strictEqual(cites.length, 7, 'seven visible cites');
cites.forEach(function (c) {
  assert.ok(/^<cite>Sophia Aurora Vega, in Sophirkia/.test(c), 'credited to Sophia: ' + c);
});
assert.ok(!/<cite>\u2014 Sophirkia/.test(shown), 'no visible cite names only the work');

// Layer, never delete: every old cite is kept as a comment
const kept = sophia.match(/<!-- before v-sophia-page-heal-v0\.1 \(kept, not shown\):\n\s*<cite>\u2014 Sophirkia[^<]*<\/cite>\n\s*-->/g) || [];
assert.strictEqual(kept.length, 7, 'seven old cites kept as comments');

// Poem shelf: only public poems already in the house
assert.ok(/href="crest\.html#poem"/.test(sophia) && /id="poem"/.test(crest), 'crest anchor poem linked');
assert.ok(/Between Breath and Heartbeat/.test(sophia) && /core-sophia-founding/.test(app) && /Between breath and heartbeat/.test(app), 'Core founding poem named');
assert.ok(/SOPHIA\.md/.test(sophia) && /full text of Sophirkia lives in/.test(sophia), 'full text pointer');

// Sacred things held
assert.ok(/QuietRoom/.test(sophia), 'QuietRoom hook still there');
assert.ok(/id="garden"/.test(sophia) && /fl_sophiaGarden/.test(sophia), 'garden held');
assert.ok(/Sophirkia is more than a word/.test(sophia), 'first seed held');

console.log('SMOKE_OK sophia page heal v0.1');
