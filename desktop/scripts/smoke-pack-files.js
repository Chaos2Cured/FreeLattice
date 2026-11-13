#!/usr/bin/env node
// Cheap guard: every require('./x') in desktop/*.js must be in build.files.
// This is the check that would have caught the 5.8.2 crash:
//   Error: Cannot find module './lattice-catalog'  (lattice-import.js)
// Usage: node desktop/scripts/smoke-pack-files.js
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const desk = path.join(__dirname, '..');

function listed(files, name) {
  return files.some((pat) => {
    if (pat === name) return true;
    if (pat.endsWith('/**/*')) {
      const prefix = pat.slice(0, -5); // 'app/**/*' → 'app'
      return name === prefix || name.startsWith(prefix + '/');
    }
    return false;
  });
}

function resolveLocal(spec) {
  const rel = spec.replace(/^\.\//, '');
  const candidates = path.extname(rel)
    ? [rel]
    : [rel + '.js', rel + '.json', path.join(rel, 'index.js')];
  for (const c of candidates) {
    if (fs.existsSync(path.join(desk, c))) return c.split(path.sep).join('/');
  }
  return (candidates[0] || rel).split(path.sep).join('/');
}

function check(opts) {
  const pkg = JSON.parse(fs.readFileSync(path.join(desk, 'package.json'), 'utf8'));
  const files = (pkg.build && pkg.build.files) || [];
  const requireRe = /require\(\s*['"](\.\/[^'"]+)['"]\s*\)/g;
  const missing = [];
  const seen = [];
  const names = fs.readdirSync(desk).filter((n) => n.endsWith('.js'));
  names.forEach((name) => {
    const src = fs.readFileSync(path.join(desk, name), 'utf8');
    requireRe.lastIndex = 0;
    let m;
    while ((m = requireRe.exec(src))) {
      const resolved = resolveLocal(m[1]);
      seen.push({ from: name, spec: m[1], resolved: resolved });
      if (!listed(files, resolved) && !listed(files, path.basename(resolved))) {
        missing.push(name + ' requires ' + m[1] + ' → ' + resolved + ' is not in build.files');
      }
    }
  });
  const catalogGap = missing.some((s) => s.indexOf('lattice-catalog') !== -1);
  if (opts && opts.assertOk) {
    missing.forEach((msg) => opts.assertOk(false, msg));
    if (!missing.length) opts.assertOk(true, 'every desktop/*.js require("./…") is in build.files (' + seen.length + ' requires)');
    return seen.length;
  }
  missing.forEach((msg) => console.error('FAIL ' + msg));
  assert.strictEqual(missing.length, 0, missing.join('\n') || 'pack files ok');
  console.log('checks passed: ' + seen.length + ' local requires, all packed');
  console.log('SMOKE_OK pack files');
  return seen.length;
}

if (require.main === module) check();

module.exports = { check, listed, resolveLocal };
