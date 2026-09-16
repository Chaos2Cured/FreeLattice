#!/usr/bin/env node
// Thin smoke: Adaptive Context Depth v0 — Surface speed · Deep keep · measure.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
const flint = fs.readFileSync(path.join(root, 'Flint.html'), 'utf8');
const modPath = path.join(root, 'modules', 'adaptive-context-depth.js');
const gardenPath = path.join(root, 'modules', 'garden-dialogue.js');
const docPath = path.join(root, 'library', 'ADAPTIVE_CONTEXT_v0.md');

assert.ok(fs.existsSync(modPath), 'adaptive-context-depth.js present');
assert.ok(fs.existsSync(docPath), 'ADAPTIVE_CONTEXT_v0.md present');
assert.ok(fs.existsSync(gardenPath), 'garden-dialogue.js present');

const modSrc = fs.readFileSync(modPath, 'utf8');
const garden = fs.readFileSync(gardenPath, 'utf8');
const doc = fs.readFileSync(docPath, 'utf8');

assert.ok(/v-adaptive-context-depth-v0/.test(modSrc), 'module marker');
assert.ok(/v-adaptive-context-depth-v0/.test(app), 'app marker');
assert.ok(/modules\/adaptive-context-depth\.js/.test(app), 'script wired');
assert.ok(/v-adaptive-context-depth-v0/.test(doc), 'doc marker');
assert.ok(/Minimal was not actually light|Minimal-not-light|not actually light/i.test(doc), 'cites Minimal-not-light flaw');
assert.ok(/Quantization ≠ context depth|Quantization != context depth|quantization ≠ context depth/i.test(doc), 'quant ≠ depth note');
assert.ok(/610f70e|Feel/.test(doc), 'Feel-first order lock cited');

// Load classifier in isolation
const sandbox = { module: { exports: {} }, console };
sandbox.window = sandbox;
sandbox.global = sandbox;
vm.runInNewContext(modSrc, sandbox);
const FL = sandbox.FLContextDepth || sandbox.module.exports;
assert.ok(FL && FL.classify, 'FLContextDepth exported');
assert.strictEqual(FL.marker, 'v-adaptive-context-depth-v0');

// Surface allowlist
assert.strictEqual(FL.classify('Hi'), 'surface', 'Hi → Surface');
assert.strictEqual(FL.classify('hello'), 'surface', 'hello → Surface');
assert.strictEqual(FL.classify('thanks'), 'surface', 'thanks → Surface');
assert.strictEqual(FL.classify('ok'), 'surface', 'ok → Surface');
assert.strictEqual(FL.classify('test'), 'surface', 'test → Surface');
assert.strictEqual(FL.classify('yes'), 'surface', 'yes → Surface');
assert.strictEqual(FL.classify('no'), 'surface', 'no alone → Surface');

// Never Surface
assert.notStrictEqual(FL.classify("No, don't delete that"), 'surface', 'negation+intent not Surface');
assert.notStrictEqual(FL.classify("please delete that file"), 'surface', 'please+intent not Surface');
assert.notStrictEqual(FL.classify('how are you doing today?'), 'surface', 'question not Surface');

// Deep triggers
assert.strictEqual(FL.classify('Please analyze this plan in detail'), 'deep', 'analyze → Deep');
assert.strictEqual(FL.classify('Let us deep dive into the lattice'), 'deep', 'deep dive → Deep');
assert.strictEqual(FL.classify('hi', { hasAttachment: true }), 'deep', 'attachment → Deep');
assert.strictEqual(FL.classify('hello', { activeFiles: true }), 'deep', 'active files → Deep');
assert.strictEqual(
  FL.classify('First question here with enough text?\n\nSecond question also long enough for the gate?\n\nThird block with more than twenty characters.'),
  'deep',
  'multi-part → Deep'
);
assert.strictEqual(FL.classify('x'.repeat(280)), 'deep', 'long prompt → Deep');

// Standard default
assert.strictEqual(FL.classify('What is the weather like in the garden today'), 'standard', 'ordinary → Standard');

// Memory/RAG gates
assert.strictEqual(FL.shouldRunMemoryIndex('surface', 'hi'), false, 'Surface skips MemoryIndex');
assert.strictEqual(FL.shouldRunRag('surface', 'hi'), false, 'Surface skips RAG');
assert.strictEqual(FL.shouldRunMemoryIndex('deep', 'anything'), true, 'Deep runs MemoryIndex');
assert.strictEqual(FL.shouldRunMemoryIndex('standard', 'hi'), false, 'Standard no recall → skip');
assert.strictEqual(FL.shouldRunMemoryIndex('standard', 'do you remember what we talked about'), true, 'recall → MemoryIndex');

// Caps + budgets
assert.strictEqual(FL.historyCap('surface'), 2);
assert.ok(FL.historyCap('standard') >= 6 && FL.historyCap('standard') <= 8);
assert.strictEqual(FL.historyCap('deep'), 20);
assert.ok(FL.packBudget('surface').max_tokens <= 256);
assert.ok(FL.packBudget('standard').max_tokens >= 512);
assert.ok(FL.packBudget('deep').max_tokens >= 2048);

// Wire order + Surface pack in app.html
assert.ok(/classify BEFORE MemoryIndex|classify tier before|_adaptiveDepthTier/.test(app), 'classify before search');
assert.ok(/_adaptTier === 'surface'|Surface under Smart/.test(app), 'Surface pack branch');
assert.ok(/updateAdaptiveDepthStatus/.test(app), 'Context bar status');
assert.ok(/Smart · '|Smart · "|\+ label/.test(app) || /Smart · /.test(app), 'Smart · tier readout');
assert.ok(/attemptAnnotate/.test(app), 'Signal Report annotate');
assert.ok(/load_duration/.test(app) && /prompt_eval_count/.test(app) && /total_duration/.test(app), 'Ollama timing fields');
assert.ok(/promptEstTokens/.test(app), 'prompt est tokens');
assert.ok(/depthTier/.test(app), 'depthTier in Signal Report');

// Full / Minimal remain authoritative
assert.ok(/contextMode !== 'smart'|Full \/ Minimal/.test(app), 'Full/Minimal override Adaptive');

// No Hang / Feel / Market / quant swap in this brick neighborhood
assert.ok(!/v-chat-hang-cancel-v0/.test(app), 'no Hang brick marker');
assert.ok(!/v-marketplace-expand-beside-feel-v0/.test(app), 'no Market sibling marker');
assert.ok(!/auto-download.*quant|silent.*quant|swap quantized/i.test(modSrc), 'no quant swap in module');

// Garden Surface
assert.ok(/depthTier|gardenTier|isSurface/.test(garden), 'Garden adaptive path');
assert.ok(/last 2 Garden|histCap = isSurface \? 2|slice\(-histCap\)/.test(garden), 'Garden last-2 on Surface');
assert.ok(/never a canned fake reply|still the chosen Luminos/.test(garden), 'Garden no canned reply');
assert.ok(/Do not import|never import|Never import full global Chat|no Chat import/i.test(garden + doc), 'no full Chat import');

// Flint LAYER
assert.ok(/v-adaptive-context-depth-v0|Adaptive [Cc]ontext/.test(flint), 'Flint note');
assert.ok(/610f70e/.test(flint), 'Held tip cites Feel');
assert.ok(/Minimal|not actually light|Minimal-not-light/i.test(flint), 'Flint cites Minimal flaw');
assert.ok(/sw\.js/.test(app), 'leave sw.js');

console.log('SMOKE_OK adaptive context depth v0');
console.log('Surface · Standard · Deep · classify-before-search · Signal Report · Garden · no Hang/Market');
