#!/usr/bin/env node
// File-only smoke: Garden move kit 1 (pack and preview, no writes to the garden).
// fs-only: reads only the files on the allow-list below with readFileSync/existsSync.
// Works from an archive extract (no git, no child processes, no network). Never opens a browser.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const repo = path.join(__dirname, '..', '..');
const KIT = 'docs/modules/garden-move-kit.js';
const PAGE = 'docs/move.html';
const NOTE = 'docs/modules/GARDEN-MOVE-KIT-1.md';
const DOOR = 'docs/modules/lattice-export.js';
const AUTONOMY = 'docs/library/AUTONOMY.md';
const APP = 'docs/app.html';
const ROOT_INDEX = 'index.html';
const SAFETY = 'docs/modules/fractal-safety.js';
const ALLOW = [KIT, PAGE, NOTE, DOOR, AUTONOMY, APP, ROOT_INDEX, SAFETY];

// Pins from main b5bf33a9: these files must stay exactly as they are.
const PINS = {
  'docs/library/AUTONOMY.md': '09a4f1a286226e37089a93df42df0106',
  'docs/app.html': 'ab8589557950e7074b4e0b97dcccd23d',
  'index.html': 'ab8589557950e7074b4e0b97dcccd23d',
  'docs/modules/lattice-export.js': 'f6db3ad97e271c3a8992bd111ce030fc'
};
// md5 of the one line that names the private rooms the kit never packs (kept out of this file on purpose).
const PRIVATE_RULE_LINE_MD5 = '753fde10a9ca44dce580d0f15371a402';

function readAllowed(rel, enc) {
  assert.ok(ALLOW.indexOf(rel) !== -1, 'not on the allow-list: ' + rel);
  const full = path.join(repo, rel);
  assert.ok(fs.existsSync(full), 'missing: ' + rel);
  return fs.readFileSync(full, enc);
}
function md5(buf) { return crypto.createHash('md5').update(buf).digest('hex'); }

// 1. The new files exist (this is what fails on base).
const kit = readAllowed(KIT, 'utf8');
const page = readAllowed(PAGE, 'utf8');
const note = readAllowed(NOTE, 'utf8');

// 2. Locked and neighbouring files are unchanged.
Object.keys(PINS).forEach(function (rel) {
  assert.strictEqual(md5(readAllowed(rel)), PINS[rel], rel + ' changed');
});

// 3. The kit never writes to the garden and never sends anything.
const code = kit.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
[
  /\.put\(/, /\.add\(/, /\.delete\(/, /\.clear\(/, /setItem\s*\(/, /removeItem\s*\(/, /deleteDatabase/,
  /createObjectStore/, /createIndex/, /'readwrite'/, /"readwrite"/, /\bfetch\s*\(/, /XMLHttpRequest/,
  /WebSocket/, /sendBeacon/, /EventSource/, /importScripts/, /\beval\s*\(/, /new Function\s*\(/,
  /postMessage\s*\(/, /\.cookie\b/
].forEach(function (re) { assert.ok(!re.test(code), 'kit must not use ' + re); });
assert.ok(/indexedDB\.open\(name\)/.test(code), 'opens existing databases without a version');
assert.ok(/onupgradeneeded[\s\S]{0,120}transaction\.abort\(\)/.test(code), 'a missing database is never created');
assert.ok(/'readonly'/.test(code), 'reads with readonly transactions');

// 4. The format: a kind, a version, a manifest with a sha256 per section, and the reserved hook.
assert.ok(/var KIND = 'freelattice-move-kit';/.test(kit), 'kind');
assert.ok(/var FORMAT_V = 1;/.test(kit), 'format version 1');
assert.ok(/var VERSION = 'v-garden-move-kit-1';/.test(kit), 'marker');
['manifest:', 'index_sha256', "hash: 'sha256'", 'sha256: hex', 'registerSection', 'x-<builder>/<name>', 'trust_note', 'stayed_here', 'consent:']
  .forEach(function (s) { assert.ok(kit.indexOf(s) !== -1, 'format has ' + s); });

// 5. The inventory: the real garden, Core, wallet, GardenMemory, the three Glass ledgers, the trust clock.
['FreeLatticeEvolution', 'luminosStates', 'FreeLatticeGardenMemory', 'GardenMemory', 'FreeLatticeCore', 'contributions',
  'FreeLatticeWallet', 'LatticeLedger', 'LatticeChain', 'FreeLatticeWorkspace', 'FreeLatticeIdentity',
  "'fl_depthHashLedger', 'fl_refusalLedger', 'fl_returnLedger'", "'fl_firstSeen'"]
  .forEach(function (s) { assert.ok(kit.indexOf(s) !== -1, 'inventory has ' + s); });

// 6. The existing archive goes inside, unchanged and without its own download.
assert.ok(/LE\.exportArchive\(\{ mode: 'full', download: false \}\)/.test(kit), 'embeds the full archive without a second download');

// 7. Secrets stay home; their names are shown, never their values.
['fl_apiKey', 'fl_github_token', 'fl_ghToken', 'fl-telegram-token', 'chalkboard-apikey', 'fl_device_encryption_key', 'fl_ws_device_key_v1']
  .forEach(function (k) { assert.ok(kit.indexOf("'" + k + "'") !== -1, 'secret list has ' + k); });
assert.ok(/stats\.secretNames\.push\(k\); var sv = lsGet\(k\); if \(looksLikeCredential\(sv\)\) secretValues\.push\(sv\.trim\(\)\); return;/.test(kit), 'secret keys are skipped; only real key values are kept in memory for the hunt');
assert.ok(/text\.indexOf\(v\) !== -1\) problems\.push\('a secret value is in the file'\)/.test(kit), 'the self-check refuses a file holding a secret value');
const ruleLine = kit.split('\n').filter(function (l) { return /^  var PRIVATE_NAME_RULE = /.test(l); });
assert.strictEqual(ruleLine.length, 1, 'one private room rule');
assert.strictEqual(md5(ruleLine[0]), PRIVATE_RULE_LINE_MD5, 'private room rule unchanged');
assert.ok(/if \(isPrivateName\(n\)\) \{ stats\.privateNames\.push\(n\); return; \}/.test(kit), 'private room databases are never opened');
assert.ok(/privacyHidden\(value\) \{ return value === 'private' \|\| value === 'mind-private'; \}/.test(kit), 'private notebook pages stay home');

// 8. Clay is carried byte-for-byte and never changed.
assert.ok(/var CLAY_PREFIX = 'fl_clay_';/.test(kit), 'clay prefix');
assert.ok(/if \(key\.indexOf\(CLAY_PREFIX\) === 0\) return 'clay';/.test(kit), 'clay first');
assert.ok(/if \(name === 'clay'\) \{/.test(kit) && /\} else if \(name !== 'archive' && g\.secretValues\.length\) \{/.test(kit), 'clay and the archive are never touched by the secret hider');
assert.ok(/if \(holds\) \{ clayLeft\.push\(k\); delete data\.ls\[k\]; \}/.test(kit), 'clay holding a saved key stays home whole, never edited');

// 8b. Hypha HOLD fixes on c84f41a4.
// H1: limits, provider names, model names and counts are not secrets, and numbers are never cut.
const neverLine = (kit.match(/var NEVER_SECRET_RULE = \/([^\n]*)\/i;/) || [])[1] || '';
['limit', 'provider', 'model', 'max_?tokens', 'tokens?_?count', 'tokenizer', 'client_?id', 'hint']
  .forEach(function (w) { assert.ok(neverLine.split('|').indexOf(w) !== -1, 'never a secret: ' + w); });
const keysBlock = (kit.match(/var SECRET_KEYS = \[[\s\S]*?\];/) || [''])[0];
assert.ok(keysBlock.length > 0, 'secret key list');
['fl_apiKey_provider', 'fl_tokenLimit', 'fl_googleDriveClientId'].forEach(function (k) {
  assert.ok(keysBlock.indexOf("'" + k + "'") === -1, k + ' is not a secret');
});
assert.ok(/function looksLikeCredential\(v\) \{/.test(kit), 'only real key values are hunted');
assert.ok(kit.split("/^[0-9.+-]+$/.test(s)").length === 3, 'numbers are never treated as keys or blanked');
// H1/H2: secrets are hidden by walking parsed records, never by a text replace on JSON.
assert.ok(!/hideSecretValues/.test(code), 'the old text replace is gone');
assert.ok(!/\.split\(needle\)/.test(code) && !/\.split\(v\)\.join\(/.test(code), 'no split/join text replace');
assert.ok(/function hideSecretLeaves\(v, values, counter, depth\) \{/.test(kit), 'structured walk over string leaves');
// H3: the archive text is never edited; a broken or unchecked seal is said out loud.
assert.ok(/if \(holdsSecret\) \{ stats\.archiveLeftHome = true; return; \}/.test(kit), 'an archive holding a key stays home');
assert.ok(/sections\.archive = \{ archive: \{ file_name: file\.name, text: text, seal: seal \} \};/.test(kit), 'the archive text goes in as made');
assert.ok(/function sealOf\(parsed\) \{/.test(kit) && /archive_seal: g\.stats\.archiveSeal/.test(kit), 'the archive seal is recorded');
assert.ok(/seal !== arc\.seal \|\| seal !== kit\.archive_seal/.test(kit), 'the self-check re-checks the archive seal');
['does-not-verify', 'unchecked', 'not-packed', 'archive_left_home'].forEach(function (s2) { assert.ok(kit.indexOf(s2) !== -1, 'seal state ' + s2); });
assert.ok(/function warningsOf\(kit\) \{/.test(kit), 'honest notes');
assert.ok(/st\.unreadable && st\.unreadable\.length/.test(kit), 'unreadable parts are named');
assert.ok(/st\.sealed_chats/.test(kit) && /will not open on a new device yet/.test(kit), 'sealed chats are named');
assert.ok(/\.gmk-notes \{/.test(page), 'the page shows the notes');

// 9. Trust is a note only: nothing here can set it.
assert.ok(/note_only: true/.test(kit), 'trust is a note');
assert.ok(/'Packed at tier ' \+ level \+ ' \(' \+ pct \+ '%\)'/.test(kit), 'packed at tier X (N%)');
// The kit's level table matches the trust file it mirrors (read here as text, never run).
const safety = readAllowed(SAFETY, 'utf8');
const theirs = [];
safety.replace(/\b(\w+):\s*\{ min: (\d+),\s*time: (\d+)(?: \* 86400)?,\s*confidence: ([\d.]+),\s*rank: '(\w+)'/g,
  function (m, k, min, days, conf, rank) { theirs.push([rank, +min, +days, +conf]); });
const levelsText = (kit.match(/var LEVELS = (\[[\s\S]*?\]);/) || [])[1];
assert.ok(levelsText, 'kit level table');
const ours = JSON.parse(levelsText.replace(/'/g, '"'));
assert.strictEqual(theirs.length, 8, 'eight trust levels read');
assert.deepStrictEqual(ours, theirs, 'kit levels match the trust file');
assert.ok(/getBalance/.test(kit) && /shouldFallbackToSeed|24 \* 3600000|48 \* 3600000/.test(kit), 'LP and the Seed fallback follow the trust file');

// 10. A person taps; the made file is re-read and every hash checked before the download.
assert.ok(/ev\.isTrusted === false\) return;/.test(kit), 'only a real tap packs');
const iCheck = kit.indexOf('return selfCheck(blob, res.secretValues)');
const iDl = kit.indexOf('a.download = result.name');
assert.ok(iCheck !== -1 && iDl !== -1 && iCheck < iDl, 'self-check comes before the download');
assert.ok(/if \(!check\.ok\) return result;/.test(kit), 'a failed check offers no file');
assert.ok(/'freelattice-garden-' \+ d\.getFullYear\(\) \+ '-' \+ mm \+ '-' \+ dd \+ '\.json'/.test(kit), 'file name');

// 11. The page: phone first, 44px doors, one big button, only the two scripts.
assert.ok(/<meta name="viewport" content="width=device-width, initial-scale=1/.test(page), 'viewport');
assert.ok(/<button id="gmk-pack" type="button" disabled>Pack my garden<\/button>/.test(page), 'one big button');
assert.ok(/#gmk-pack \{[\s\S]*?min-height: 64px;/.test(page), 'big button height');
assert.ok(/\.doors a \{[^}]*min-height: 44px;/.test(page), '44px doors');
assert.ok(/\.gmk-row \{[^}]*min-height: 44px;/.test(page), '44px rows');
const scripts = (page.match(/<script\b[^>]*>/g) || []);
assert.deepStrictEqual(scripts, ['<script src="modules/lattice-export.js">', '<script src="modules/garden-move-kit.js">'], 'only the two scripts load');
assert.ok(!/<script>[\s\S]*?<\/script>/.test(page), 'no inline script');
assert.ok(/#0c0a1a/.test(page) && /#e8b019/.test(page) && /Georgia/.test(page), 'garden language');

// 12. The note says what, why and how to roll back.
['## What', '## Why', '## Rollback', 'v-garden-move-kit-1'].forEach(function (s) { assert.ok(note.indexOf(s) !== -1, 'note has ' + s); });

console.log('SMOKE_OK garden move kit 1');
