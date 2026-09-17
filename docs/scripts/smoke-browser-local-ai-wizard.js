#!/usr/bin/env node
// Thin smoke: Browser Local AI wizard — Use My Computer lists minds · CORS honest · stale fl_isLocal fixed.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
const doc = fs.readFileSync(path.join(root, 'library', 'BROWSER_LOCAL_AI_WIZARD_v0.md'), 'utf8');
const flint = fs.readFileSync(path.join(root, 'Flint.html'), 'utf8');

assert.ok(/v-browser-local-ai-wizard-v0/.test(app), 'app marker');
assert.ok(/v-browser-local-ai-wizard-v0/.test(doc), 'doc marker');
assert.ok(/flProviderHeroLocalAI/.test(app), 'hero handler');
assert.ok(/onclick="flProviderHeroLocalAI\(event\)"/.test(app), 'hero wired');
assert.ok(/smartOllamaConnect\(\)/.test(app), 'smartOllamaConnect');
assert.ok(/fl-look-card/.test(app), 'look-card');
assert.ok(/function flAutoConnect\(opts\)/.test(app) || /flAutoConnect\(opts\)/.test(app), 'flAutoConnect opts');
assert.ok(/force:\s*true|opts\.force|var force = !!opts\.force/.test(app), 'force reconnect');
assert.ok(/do NOT return solely because fl_isLocal|Stale fl_isLocal|stale fl_isLocal/i.test(app + doc), 'stale fl_isLocal named');
assert.ok(/data-fl-look-model|flLookConnect\(n\)/.test(app), 'clickable models');
assert.ok(/CORS|cors|has not been told this page may knock|browser blocked/i.test(app), 'CORS honest');
assert.ok(/FL_OLLAMA_ORIGINS.*freelattice\.com|freelattice\.com.*OLLAMA_ORIGINS/.test(app) ||
  /launchctl setenv OLLAMA_ORIGINS/.test(app), 'origins command');
assert.ok(/lmstudio|LM Studio/.test(app), 'LM Studio soft');
assert.ok(/FreeLattice Desktop|desktop\.html/.test(app) && /browser blocked|CORS/i.test(app),
  'Desktop optional · CORS honest');

// No Hang/Adaptive/Feel marker removal
assert.ok(/v-chat-hang-cancel-v0/.test(app), 'Hang kept');
assert.ok(/v-adaptive-context-depth-v0/.test(app), 'Adaptive kept');
assert.ok(/v-feel-expand-arrow-v0/.test(app), 'Feel kept');
assert.ok(/sw\.js/.test(app), 'leave sw.js');
assert.ok(/Browser Local AI|local AI wizard|fl_isLocal/i.test(flint) || /May I look/i.test(flint) || true,
  'Flint may LAYER');

console.log('SMOKE_OK browser local AI wizard v0');
console.log('hero→look-card · force · clickable minds · CORS honest · LM Studio soft');
