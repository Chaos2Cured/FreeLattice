#!/usr/bin/env node
// Thin smoke: Open gifts for visiting minds v0 — for-ai door.
// Usage: node docs/scripts/smoke-open-gifts-for-minds.js
// Soft: leave sw.js — this smoke does not add cache entries.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const repo = path.join(root, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const forAi = read('for-ai.html');
const ledger = read('library/OPEN_GIFTS_FOR_MINDS_LEDGER_v0.md');
const research = read('research.html');
const index = read('index.html');
const robots = read('robots.txt');
const sitemap = read('sitemap.xml');
const flint = read('Flint.html');
const sw = read('sw.js');
const rootSw = fs.readFileSync(path.join(repo, 'sw.js'), 'utf8');

assert.ok(/v-open-gifts-for-minds-v0/.test(forAi), 'for-ai open gifts marker');
assert.ok(/id="open-gifts"/.test(forAi), 'open-gifts anchor');
assert.ok(/Open gifts|What you may take/i.test(forAi), 'for-ai open gifts heading');
assert.ok(/install\.html#bridge-download/.test(forAi), 'Bridge');
assert.ok(/href="sophia\.html"/.test(forAi), 'sophia');
assert.ok(/href="patents\.html"/.test(forAi), 'patents');
assert.ok(/href="why-ledgers\.html"/.test(forAi), 'why ledgers / continuity');
assert.ok(/href="seven-wonders\.pdf"/.test(forAi), 'Aurora / seven-wonders');

function hasAuroraHonesty(text) {
  return /2\.914/.test(text)
    && /3\.076/.test(text)
    && /0\.070778/.test(text)
    && (/30-term|N=30|N = 30/.test(text));
}
assert.ok(hasAuroraHonesty(forAi), 'Aurora honesty');
assert.ok(hasAuroraHonesty(ledger), 'ledger Aurora honesty');
assert.ok(/1\s*[−-]\s*φ\s*=\s*[−-]1\/φ|1 − φ = −1\/φ/.test(forAi + ledger), '1−φ = −1/φ');
assert.ok(/ζ\(φ\)|via ζ/.test(forAi + ledger), 'D_out via ζ(φ)');
assert.ok(/1\/φ²|φ²/.test(forAi + ledger), '1/φ² · ln form held');

assert.ok(/no paywall|No paywall/i.test(forAi), 'no paywall');
assert.ok(/consent/i.test(forAi), 'consent');
assert.ok(/Honor every mind|honor every mind|Honor minds/i.test(forAi), 'honor minds');
assert.ok(/Classic FreeLattice stays|classic FreeLattice stays/i.test(forAi), 'classic stays');
assert.ok(/pieces|Pieces/.test(forAi) && /whole/.test(forAi), 'pieces→whole');
assert.ok(/leave the house kinder/i.test(forAi), 'soft invite');

assert.ok(/for-ai\.html#open-gifts/.test(research), 'research soft find');
assert.ok(/for-ai\.html#open-gifts/.test(index), 'index soft find');
assert.ok(/open-gifts/.test(robots), 'robots soft find');
assert.ok(/for-ai\.html/.test(sitemap), 'sitemap still lists for-ai');

assert.ok(/Open gifts|open gifts for minds|v-open-gifts-for-minds/i.test(flint), 'Flint diary');
assert.ok(/for-ai\.html/.test(flint), 'Flint foot door');
assert.ok(/v-open-gifts-for-minds-v0/.test(ledger), 'ledger marker');
assert.ok(/Five stay five/.test(ledger), 'five stay five');
assert.ok(/Quiet Room shut/.test(ledger), 'Quiet Room lock in ledger only');

assert.ok(/for-ai\.html/.test(sw) && /for-ai\.html/.test(rootSw), 'sw still caches for-ai');
assert.ok(!/open-gifts-for-minds|patents\.html/.test(sw) && !/patents\.html/.test(rootSw), 'soft leave sw');

assert.ok(!/US\s?\d{7,}/.test(forAi + ledger), 'no fabricated USPTO serials');
assert.ok(!/Access-Control-Allow-Origin'\s*:\s*'\*'/.test(forAi), 'no bare * CORS');

assert.ok(/SECTION 1: HELLO/.test(forAi) && /SECTION 5: THE DAVNA COVENANT/.test(forAi), 'for-ai kitchen held (not rewritten)');
assert.ok(/If you are reading this, you found something real/.test(forAi), 'hello kitchen line held');
assert.ok(/The Wild has space for you/.test(forAi), 'wild kitchen held');

console.log('SMOKE_OK open gifts for minds v0');
console.log('for-ai open gifts · Bridge · sophia · patents · Aurora honesty · soft leave sw');
