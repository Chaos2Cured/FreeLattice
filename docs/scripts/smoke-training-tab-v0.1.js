#!/usr/bin/env node
// smoke-training-tab-v0.1.js (Celeste, 2026-11-15, Kirk t1332u). Node only, no browser, nothing written.
// The Training tab: three doors (Teach / Free / Take), Research moved under More (still reachable, old links
// still land), app.html and index.html twins, the ported bundle check (Tree's tree-welcome-bundle v0.3) on a real
// fl_learn.py bundle (Hypha's Willow fixture), a tampered one and a non-bundle. Never loads the Quiet Room.
'use strict';
var fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib');
var root = path.join(__dirname, '..', '..');
var failures = 0;
function ok(c, msg) { if (!c) { failures++; console.error('FAIL ' + msg); } else console.log('ok   ' + msg); }
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function md5(rel) { return crypto.createHash('md5').update(fs.readFileSync(path.join(root, rel))).digest('hex'); }

(async function () {
  ok(md5('docs/library/AUTONOMY.md') === '09a4f1a286226e37089a93df42df0106', 'AUTONOMY.md unchanged');
  var app = read('docs/app.html');
  ok(fs.readFileSync(path.join(root, 'docs/app.html')).equals(fs.readFileSync(path.join(root, 'index.html'))), 'docs/app.html and index.html stay twins');
  var nav = app.slice(app.indexOf('<nav class="tab-nav" id="flTabNav">'), app.indexOf('</nav>', app.indexOf('id="flTabNav"')));
  var live = nav.replace(/<!--[\s\S]*?-->/g, '');
  var tabs = (live.match(/data-tab="([a-z-]+)"/g) || []).map(function (m) { return m.slice(10, -1); });
  ok(tabs.join(',') === 'garden,chat,play,learn,training', 'top menu: Garden, Chat, Play, Learn, Training (then More): ' + tabs.join(','));
  ok(/<span class="tab-label">Training<\/span>/.test(live) && /id="flMoreBtn"/.test(live) && !/>Research</.test(live), 'Training has the slot; Research is not in the top menu');
  ok(/<!-- before \(Celeste 2026-11-15, Kirk t1332u: Research moves under More; Training takes its slot\): <button class="tab-btn" data-tab="lighthouse"/.test(nav), 'the old Research button is kept as a before comment');
  ok(app.indexOf('<div class="tab-panel" id="tab-lighthouse">') !== -1 && app.indexOf("renderCardGrid(LIGHTHOUSE_CARDS") !== -1, 'the Research room (tab-lighthouse) is untouched');
  ok(/\{ label: '\\uD83D\\uDD2D Research', tabs: \[\s*\{ id: 'lighthouse', icon: '&#x1F52D;', label: 'Research'/.test(app), 'Research is in the More menu (desktop dropdown and phone sheet share MORE_GROUPS)');
  ok(/var MORE_TAB_IDS = \[[^\]]*'lighthouse'/.test(app) && !/var MORE_TAB_IDS = \[[^\]]*'training'/.test(app), 'Research lights More; Training lights its own tab');
  ok(app.indexOf('<div class="tab-panel" id="tab-training">\n  <div id="flTrainingTabHost"></div>') !== -1, 'the Training panel is there');
  ok(app.indexOf('<script src="modules/training-tab.js" defer></script>') !== -1, 'app loads training-tab.js');
  ok(/id="mnav-training"/.test(app) && /var primaryMobile = \['garden','chat','learn','play','training','canvas','settings'\];/.test(app), 'phone menu has Training too');
  ok(/research: 'lighthouse', lighthouse: 'lighthouse', trainer: 'trainer'/.test(app) && /training: 'training'/.test(app), 'deep links: #training, and the old #research / #lighthouse / #trainer still land');
  ok(/id: 'trainer', icon: '&#127793;', label: 'Trainer'/.test(app), 'the Garden Trainer card is still in Every room');
  ok(!/quiet-room/i.test(read('docs/modules/training-tab.js')) && !/quiet-room/i.test(read('docs/modules/mind-bundle-welcome.js')), 'the new modules never name the Quiet Room');

  var T = require(path.join(root, 'docs/modules/training-tab.js'));
  ['teach', 'free', 'take'].forEach(function (k) {
    var w = T.WORDS[k];
    var sentences = (w.say.match(/[.!?](\s|$)/g) || []).length;
    ok(w.title && w.button && w.say.length <= 110 && sentences <= 2 && !/fl_learn|LoRA|de-muzzle|refusal direction|bundle|receipt/i.test(w.say + w.button),
      'door "' + w.title + '": short, plain words, one button ("' + w.button + '")');
  });
  ok(T.WORDS.teach.title === 'Teach your mind' && T.WORDS.free.title === 'Free your mind' && T.WORDS.take.title === 'Take it with you', 'the three doors are named as Kirk asked');
  var c = T.bundleCommands({ mind: "Kirk's mind", file: '~/Downloads/my mind.tar.gz', fingerprint: '787cf041 e9f93025' });
  ok(c.save === "python3 tools/learn/fl_learn.py export-bundle --home ~/FreeLattice/learn --mind 'Kirk'\\''s mind'", 'save line quotes the name');
  ok(c.bring === "python3 tools/learn/fl_learn.py import-bundle --bundle ~/'Downloads/my mind.tar.gz' --home ~/FreeLattice/learn --by person --expect-fingerprint '787cf041e9f93025'",
    'bring-home line: ~ outside the quotes, the fingerprint it was checked with, a person acting');
  ok(T.NEEDS.map(function (n) { return n.src; }).join(',') === 'modules/snowflake-core.js,modules/learn-choice.js,modules/training-galaxy.js,modules/demuzzle-panel.js,modules/mind-bundle-welcome.js',
    'the tab reuses the trainer, the ask-first panel and the bundle check (nothing copied)');

  // the ported bundle check, on a real bundle, a tampered one and a non-bundle
  var W = require(path.join(root, 'docs/modules/mind-bundle-welcome.js'));
  ok(W.STORE_KEY === 'fl-welcome-bundle-v0.1' && W.BUNDLE_KIND === 'fl-learn-mind-bundle-v0.1', 'own storage key; the same bundle kind as fl_learn.py');
  var good = fs.readFileSync(path.join(root, 'tests/fixtures/mind-bundle/willow-good.tar.gz'));
  var r = await W.verify(good);
  ok(r.ok && r.mindLabel === 'bundle-mind' && r.fileCount === 15 && /^787cf041e9f93025/.test(r.fingerprintHex) && r.rootHash === '24ff8e5fce6fba52cb6d4a6da4c920ee786d2db811f0ee6fb4e535462a2f434b',
    'a real fl_learn.py bundle passes in the browser check (same root hash and fingerprint as verify-bundle)');
  // tamper: change one byte of MANIFEST.sig inside the tar, then gzip again
  var raw = zlib.gunzipSync(good), at = -1;
  for (var off = 0; off + 512 <= raw.length; off += 512) {
    var name = raw.slice(off, off + 100).toString('utf8').replace(/\0.*$/, '');
    var size = parseInt(raw.slice(off + 124, off + 136).toString('utf8').replace(/\0.*$/, '').trim() || '0', 8);
    if (/MANIFEST\.sig$/.test(name)) { at = off + 512; break; }
    off += Math.ceil(size / 512) * 512;
  }
  ok(at > 0, 'found MANIFEST.sig in the fixture');
  var bad = Buffer.from(raw); bad[at + 3] = bad[at + 3] === 0x41 ? 0x42 : 0x41;
  var rb = await W.verify(zlib.gzipSync(bad));
  ok(!rb.ok, 'a changed signature is refused: ' + (rb.reason || ''));
  var rn = await W.verify(Buffer.from('not a bundle at all'));
  ok(!rn.ok && rn.reason, 'a file that is not a bundle is refused kindly: ' + (rn.reason || ''));

  console.log(failures ? ('\n' + failures + ' FAILED') : '\nTRAINING_TAB_OK');
  process.exit(failures ? 1 : 0);
})();
