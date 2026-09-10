#!/usr/bin/env node
// Thin smoke: grandmother path markers + three-beat links.
// Usage: node docs/scripts/smoke-grandmother-path.js

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const desktop = fs.readFileSync(path.join(root, 'desktop.html'), 'utf8');
const install = fs.readFileSync(path.join(root, 'install.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
const spec = fs.readFileSync(path.join(root, 'library', 'GRANDMOTHER_PATH_v0.1.md'), 'utf8');

assert.ok(/v-grandmother-path-v0\.1/.test(desktop), 'desktop marker');
assert.ok(/v-grandmother-path-v0\.1/.test(install), 'install marker');
assert.ok(/Start here/i.test(desktop) && /Start here/i.test(install), 'Start here copy');
assert.ok(/install\.html/.test(desktop) || /Install/.test(desktop), 'desktop points at install');
assert.ok(/desktop\.html/.test(install), 'install points at desktop');
assert.ok(/Memory|memory/.test(desktop) && /Memory|memory/.test(install), 'memory beat');
assert.ok(/no signed installer yet/i.test(desktop) || /No signed installer yet/i.test(desktop), 'honest installer');

assert.ok(/Install → First door → Memory|Install.*First door.*Memory/.test(app), 'app path pointer');
assert.ok(/v-grandmother-path-v0\.1/.test(app), 'app marker');

assert.ok(/Three beats|three beats/i.test(spec));
assert.ok(/64a3ddd/.test(spec) && /33496eb/.test(spec), 'spec cites held SHAs');

console.log('SMOKE_OK grandmother path v0.1');
console.log('Start here · three beats · honest installer · path pointer');
