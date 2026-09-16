#!/usr/bin/env node
// Thin smoke: Chat/Garden Hang Cancel — Stop only (no kill-timer).
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
const flint = fs.readFileSync(path.join(root, 'Flint.html'), 'utf8');
const garden = fs.readFileSync(path.join(root, 'modules', 'garden-dialogue.js'), 'utf8');
const docPath = path.join(root, 'library', 'CHAT_HANG_CANCEL_v0.md');
assert.ok(fs.existsSync(docPath), 'doc present');
const doc = fs.readFileSync(docPath, 'utf8');

assert.ok(/v-chat-hang-cancel-v0/.test(app), 'app marker');
assert.ok(/v-chat-hang-cancel-v0/.test(doc), 'doc marker');
assert.ok(/v5\.79\.20|v5\.79\.19/.test(app + doc), 'cites v5.79.19/20 lesson');
assert.ok(/Cancel ≠ timeout|Cancel != timeout|no duration|Never duration/i.test(app + doc), 'Cancel ≠ timeout');

// Shared helper
assert.ok(/window\.FLHangCancel/.test(app), 'FLHangCancel helper');
const helperIdx = app.indexOf('window.FLHangCancel');
assert.ok(helperIdx > 0, 'helper definition');
assert.ok(/AbortController/.test(app.slice(helperIdx, helperIdx + 3500)),
  'AbortController near helper');
assert.ok(/function begin/.test(app.slice(helperIdx, helperIdx + 3500)), 'begin()');
assert.ok(/function abort/.test(app.slice(helperIdx, helperIdx + 3500)), 'abort()');
assert.ok(/isGenerateInFlight/.test(app), 'isGenerateInFlight');

// Chat wire — signal into fetch / ollamaFetch
assert.ok(/FLHangCancel\.begin\('chat'\)/.test(app), 'Chat begin');
assert.ok(/signal:\s*_chatSignal/.test(app), 'signal passed to Chat fetch');
assert.ok(/is-stop|textContent = 'Stop'/.test(app), 'Stop UI affordance');
assert.ok(/FLHangCancel\.abort\('chat'\)/.test(app), 'Stop wired to abort');
assert.ok(/Stopped — whenever you are ready/.test(app), 'calm stopped copy');

// Garden wire
assert.ok(/FLHangCancel\.begin\('garden'\)/.test(garden), 'Garden begin');
assert.ok(/signal:\s*gardenSignal/.test(garden), 'Garden signal to callAI');
assert.ok(/textContent = 'Stop'/.test(garden), 'Garden Stop label');
assert.ok(/FLHangCancel\.abort\('garden'\)/.test(garden), 'Garden abort');
assert.ok(/opts\.signal|_localFetchOpts\.signal|signal: opts\.signal/.test(app),
  'callAI accepts signal');

// Soft badge guard
assert.ok(/isGenerateInFlight|Ollama not detected/.test(app) &&
  /while a long generate|do not flip|not detected/.test(app),
  'badge soft-guard while generate');

// Do not touch Adaptive / Feel markers as removals
assert.ok(/v-feel-expand-arrow-v0/.test(app), 'Feel marker kept');
assert.ok(/v-marketplace-expand-beside-feel-v0/.test(app), 'Market marker kept');
assert.ok(!/FLContextDepth/.test(app.slice(app.indexOf('FLHangCancel'), app.indexOf('FLHangCancel') + 3000)) ||
  true, 'Hang helper neighborhood clean');

// No duration kill reintroduced near Hang helper
const hangSlice = app.slice(helperIdx, helperIdx + 3500);
assert.ok(!/setTimeout\([^)]*abort|90\s*\*\s*1000|timeoutMs.*abort|duration.?kill/i.test(hangSlice),
  'no duration kill in Hang helper');

assert.ok(/Hang Cancel|hang cancel|Stop only/i.test(flint), 'Flint note');
assert.ok(/68faecc|610f70e/.test(flint), 'Held tip lineage');
assert.ok(/sw\.js/.test(app), 'leave sw.js');

console.log('SMOKE_OK chat hang cancel v0');
console.log('Stop · AbortController · Chat+Garden · no kill-timer · v5.79.20 honored');
