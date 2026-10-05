#!/usr/bin/env node
// Smoke: Hook heal v0.1 (v-hook-heal-v0.1)
// The post-commit hook leaves layer branches alone (no sw.js, no Primer, no RECENT.md,
// no extra commit) and never writes root sw.js. On main it still updates the Primer.
// Runs the real hook in a throwaway git repo in the temp folder. No network.
// Usage: node docs/scripts/smoke-hook-heal-v0.1.js

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repo = path.join(__dirname, '..', '..');
const hook = fs.readFileSync(path.join(repo, 'hooks', 'post-commit'), 'utf8');
const ci = fs.readFileSync(path.join(repo, '.github', 'workflows', 'update-primer.yml'), 'utf8');

// 1. Static
assert.ok(/v-hook-heal-v0\.1/.test(hook), 'hook carries the marker');
assert.ok(/Auto-update Session Primer/.test(hook) && /LAST_MSG[\s\S]{0,200}exit 0/.test(hook), 'de-bounce kept');
assert.ok(/"\$BRANCH" != "main"/.test(hook), 'branch guard');
assert.ok(!/^\s*sed [^\n]*> sw\.js/m.test(hook) && !/^\s*git add sw\.js/m.test(hook), 'no live line writes root sw.js');
assert.ok(/# before hook-heal: +sed /.test(hook), 'old sw.js lines kept as before comments');
assert.ok(/cp docs\/sw\.js sw\.js/.test(ci), 'CI still syncs root sw.js on main');
assert.ok(/ci: Update Primer/.test(ci), 'CI still updates the Primer on main');

// 2. Live, in a throwaway repo
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fl-hook-heal-'));
const env = Object.assign({}, process.env, {
  GIT_AUTHOR_NAME: 'smoke', GIT_AUTHOR_EMAIL: 'smoke@127.0.0.1',
  GIT_COMMITTER_NAME: 'smoke', GIT_COMMITTER_EMAIL: 'smoke@127.0.0.1', FL_HOOK_ALL_BRANCHES: ''
});
function sh(cmd) {
  const r = spawnSync('bash', ['-c', cmd], { cwd: tmp, env: env, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(cmd + '\n' + r.stdout + r.stderr);
  return r.stdout;
}
function put(rel, text) { fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true }); fs.writeFileSync(path.join(tmp, rel), text); }
function read(rel) { try { return fs.readFileSync(path.join(tmp, rel), 'utf8'); } catch (e) { return null; } }

try {
  sh('git init -q -b main . && git config commit.gpgsign false');
  put('FreeLattice_Session_Primer.md', '# Primer\n');
  put('docs/sw.js', "const CACHE = 'freelattice-v1.0.0'; const SHELL = ['./app.html'];\n");
  put('sw.js', "const CACHE = 'freelattice-v1.0.0'; const SHELL = ['./app.html'];\n");
  put('docs/app.html', '<!-- FreeLattice v1.0.0 -->\n');
  put('index.html', '<!-- FreeLattice v1.0.0 -->\n');
  put('docs/version.json', '{"version": "1.0.0"}\n');
  put('docs/library/RECENT.md', 'recent\n');
  put('scripts/generate-recent.sh', '#!/bin/bash\necho regenerated > docs/library/RECENT.md\n');
  fs.chmodSync(path.join(tmp, 'scripts', 'generate-recent.sh'), 0o755);
  fs.mkdirSync(path.join(tmp, 'hooks'), { recursive: true });
  fs.copyFileSync(path.join(repo, 'hooks', 'post-commit'), path.join(tmp, 'hooks', 'post-commit'));
  sh('git add -A && git commit -q -m base');

  // On a layer branch: nothing moves
  sh('git checkout -q -b layer/test && echo x > a.txt && git add a.txt && git commit -q -m "layer: a"');
  const out = sh('bash hooks/post-commit');
  assert.ok(/leaving sw\.js, the Primer and RECENT\.md alone/.test(out), 'branch run says so');
  assert.strictEqual(sh('git log -1 --pretty=%s').trim(), 'layer: a', 'no hook commit on a branch');
  assert.strictEqual(sh('git status --porcelain'), '', 'tree clean on a branch');
  assert.strictEqual(read('docs/library/RECENT.md'), 'recent\n', 'RECENT.md untouched on a branch');

  // On main: Primer commit still made, root sw.js not rewritten
  sh('git checkout -q main && echo y > b.txt && git add b.txt && git commit -q -m "ship: b"');
  sh('bash hooks/post-commit');
  assert.ok(/^docs: Auto-update Session Primer/.test(sh('git log -1 --pretty=%s')), 'main still gets the Primer commit');
  assert.ok(/## PRIMER HEALTH/.test(read('FreeLattice_Session_Primer.md')), 'Primer health written on main');
  assert.strictEqual(read('sw.js'), read('docs/sw.js'), 'root sw.js left as the CI copy');
  assert.ok(!/sw\.js/.test(sh('git show --name-only --pretty= HEAD')), 'hook commit holds no sw.js');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log('SMOKE_OK hook heal v0.1');
