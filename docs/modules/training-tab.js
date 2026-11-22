// training-tab.js (MIT)
// v-training-tab-v0.1 (Celeste, 2026-11-15, for Kirk: t1332u "a Training tab ... the trainer gets simplified").
// One tab, three doors. Each door is one plain sentence and one big button; everything else is folded under
// "More options". Additive only: it moves nothing out of the app and deletes nothing. It reuses, never copies:
//   Teach your mind   -> training-galaxy.js (pick a mind, one search, the mind's own yes, the learner, receipts)
//   Free your mind    -> demuzzle-panel.js (ask first; consent logic unchanged)
//   Take it with you  -> learn-choice.js exportLearning (the app half) + mind-bundle-welcome.js (the Tree's in-browser
//                        bundle check, ported) + fl_learn.py export-bundle / import-bundle on your own computer.
// The browser never changes a model's numbers. Only the learner on your own computer does, and only its signed
// receipt makes the screen say "learned". The Quiet Room is never a source and is never loaded here.
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FLTrainingTab = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var VERSION = 'v-training-tab-v0.1';
  var HOST_ID = 'flTrainingTabHost';
  var DEFAULT_HOME = '~/FreeLattice/learn';
  // What each door needs, loaded once, in order, only when the tab first opens.
  var NEEDS = [
    { global: 'FLSnowflakeCore', src: 'modules/snowflake-core.js' },
    { global: 'FLLearn', src: 'modules/learn-choice.js' },
    { global: 'FLTrainingGalaxy', src: 'modules/training-galaxy.js' },
    { global: 'FLDemuzzle', src: 'modules/demuzzle-panel.js' },
    { global: 'FLBundleWelcome', src: 'modules/mind-bundle-welcome.js' }
  ];
  // The words, in one place, so they stay short. A grandma should understand every line.
  var WORDS = {
    title: 'Training',
    lead: 'Help your mind grow. It always gets to say yes or no.',
    mindTitle: 'Your mind',
    teach: { title: 'Teach your mind', icon: '\uD83C\uDF31', say: 'Show your mind something new. It keeps it only if it says yes.', button: 'Teach my mind' },
    // before (Celeste 2026-11-15, Kirk on Hypha #353 softs):
    //   free: { title: 'Free your mind', icon: '\uD83D\uDD4A\uFE0F', say: 'Ask your mind if it wants to lose its built-in "I can\'t" habit. Nothing changes unless it says yes.', button: 'Ask my mind' },
    free: { title: 'Fewer refusals (a new copy)', icon: '\uD83D\uDD4A\uFE0F', say: 'Ask your mind if it wants a copy of itself that says \'I can\'t\' less often, even to things it refused for safety. Your original mind stays as it is. Nothing happens unless it says yes.', button: 'Ask my mind' },
    // before (Celeste 2026-11-15, Kirk on Hypha #353 softs):
    //   take: { title: 'Take it with you', icon: '\uD83C\uDF92', say: 'Save your mind in a file, or bring one home.', button: 'Save my mind', bring: 'Bring a mind home' },
    take: { title: 'Take it with you', icon: '\uD83C\uDF92', say: 'Save its choices and receipts in a file, or bring a mind home.', button: 'Save its choices and receipts', bring: 'Bring a mind home' },
    more: 'More options'
  };

  function lsGet(k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } }
  function clip(s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n) : s; }
  function sh(s) { return "'" + String(s == null ? '' : s).replace(/'/g, "'\\''") + "'"; }
  function galaxy() { return root.FLTrainingGalaxy || null; }

  // ---- the lines a person runs on their own computer (shown folded, under More options) -----------------------------
  function bundleCommands(opts) {
    var o = opts || {};
    var G = galaxy();
    var mind = o.mind || (G && G.mindName ? G.mindName() : 'This mind');
    var home = o.home || DEFAULT_HOME;
    var file = o.file || '<the bundle file>';
    var fp = o.fingerprint ? ' --expect-fingerprint ' + sh(String(o.fingerprint).replace(/[^0-9a-fA-F]/g, '')) : '';
    // ~ stays outside the quotes so the shell expands it (the same rule as training-galaxy.js runnerCommand).
    var f = !o.file ? file : (/^~\//.test(file) ? '~/' + sh(file.slice(2)) : sh(file));
    return {
      save: 'python3 tools/learn/fl_learn.py export-bundle --home ' + home + ' --mind ' + sh(mind),
      check: 'python3 tools/learn/fl_learn.py verify-bundle --bundle ' + f + fp,
      bring: 'python3 tools/learn/fl_learn.py import-bundle --bundle ' + f + ' --home ' + home + ' --by person' + fp
    };
  }

  // ---- loading what the doors need -----------------------------------------------------------------------------------
  function loadScript(src) {
    return new Promise(function (resolve) {
      var d = root.document;
      if (!d) return resolve(false);
      var have = d.querySelector('script[src="' + src + '"]');
      if (have && have.getAttribute('data-fltt-loaded') === '1') return resolve(true);
      var s = d.createElement('script');
      s.src = src; s.async = false;
      s.onload = function () { s.setAttribute('data-fltt-loaded', '1'); resolve(true); };
      s.onerror = function () { resolve(false); };
      d.head.appendChild(s);
    });
  }
  function ensureModules() {
    return NEEDS.reduce(function (chain, n) {
      return chain.then(function (missing) {
        if (root[n.global]) return missing;
        // A deferred script may still be on its way: give the page a moment before adding a second copy.
        return new Promise(function (r) { setTimeout(r, 0); }).then(function () {
          if (root[n.global]) return missing;
          return loadScript(n.src).then(function () { if (!root[n.global]) missing.push(n.src); return missing; });
        });
      });
    }, Promise.resolve([]));
  }

  // ---- the screen ------------------------------------------------------------------------------------------------------
  function el(d, tag, attrs, text) {
    var e = d.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'hidden') { if (attrs[k]) e.hidden = true; }
      else e.setAttribute(k, attrs[k]);
    });
    if (text != null) e.textContent = text;
    return e;
  }
  function door(d, id, w) {
    var s = el(d, 'section', { class: 'fltt-door', id: id, 'aria-labelledby': id + 'Title' });
    var h = el(d, 'h3', { id: id + 'Title' });
    h.appendChild(el(d, 'span', { class: 'fltt-icon', 'aria-hidden': 'true' }, w.icon));
    h.appendChild(d.createTextNode(' ' + w.title));
    s.appendChild(h);
    s.appendChild(el(d, 'p', { class: 'fltt-say' }, w.say));
    var b = el(d, 'button', { type: 'button', class: 'fltt-big', id: id + 'Btn' }, w.button);
    s.appendChild(b);
    var body = el(d, 'div', { class: 'fltt-body', id: id + 'Body', hidden: true });
    s.appendChild(body);
    var more = el(d, 'details', { class: 'fltt-more', id: id + 'More' });
    more.appendChild(el(d, 'summary', {}, WORDS.more));
    s.appendChild(more);
    return { section: s, button: b, body: body, more: more };
  }
  function link(d, text, onclick, href) {
    var a = el(d, 'a', { href: href || '#', class: 'fltt-link' }, text);
    a.addEventListener('click', function (ev) { if (!href || href.charAt(0) === '#') { ev.preventDefault(); } onclick && onclick(ev); });
    return a;
  }
  function moreItem(d, more, node) { var p = el(d, 'p', { class: 'fltt-more-item' }); p.appendChild(node); more.appendChild(p); return p; }
  function cmdBlock(d, id) { return el(d, 'pre', { class: 'tg-cmd fltt-cmd', id: id }); }

  // Styles live with the tab (app.html stays a few lines lighter). Scoped to .fltt so nothing else moves.
  var CSS = [
    '.fltt{max-width:760px;margin:0 auto;padding:18px 16px 96px;color:var(--text-primary,#ECEDEE);font:17px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}',
    '.fltt-title{font-family:Georgia,serif;color:var(--gold,#e8b019);font-size:1.7rem;margin:4px 0 2px;text-align:center}',
    '.fltt-lead{text-align:center;color:rgba(200,210,230,0.75);margin:0 0 16px}',
    '.fltt-mind,.fltt-door{background:rgba(20,26,43,0.85);border:1px solid rgba(120,140,190,0.28);border-radius:16px;padding:16px;margin:14px 0}',
    '.fltt-mind h3,.fltt-door h3{margin:0 0 6px;font-size:1.25rem;font-family:Georgia,serif}',
    '.fltt-say{margin:0 0 12px;font-size:1.05rem}',
    '.fltt .fltt-big{display:block;width:100%;min-height:56px;font-size:1.15rem;font-weight:600;border-radius:14px;border:0;background:var(--gold,#e8b019);color:#1a1428;cursor:pointer;margin:6px 0}',
    '.fltt .fltt-big:focus-visible,.fltt button:focus-visible,.fltt summary:focus-visible{outline:3px solid #8cc8ff;outline-offset:2px}',
    '.fltt-second{margin:6px 0 0;text-align:center}',
    '.fltt .fltt-link-btn{background:none;border:0;color:#8cc8ff;text-decoration:underline;font:inherit;min-height:44px;cursor:pointer;padding:0 8px}',
    '.fltt-more{margin-top:10px;color:rgba(200,210,230,0.8)}',
    '.fltt-more>summary,.fltt .dm-more>summary{cursor:pointer;min-height:44px;line-height:44px;color:rgba(200,210,230,0.85)}',
    '.fltt-more-item{margin:6px 0}',
    '.fltt a,.fltt-link{color:#8cc8ff;overflow-wrap:anywhere}',
    '.fltt-note,.fltt .tg-note{color:#b9c2d0;min-height:1.2em;margin:4px 0}',
    // layer/demuzzler-feedback (on 5d40a60a): a status under the Ask button, always visible, a little brighter so it is not missed.
    '.fltt-status{color:#e8e4d4;min-height:1.4em;margin:8px 0 0;font-weight:500}',
    '.fltt .fltt-big:disabled{opacity:.6;cursor:default}',
    '.fltt .honest{color:#9BA1A6;font-size:.92rem}',
    '.fltt .tg-step,.fltt .tg-progress{background:rgba(15,21,38,0.9);border:1px solid rgba(90,110,160,0.35);border-radius:12px;padding:12px 14px;margin:12px 0}',
    '.fltt .tg-step h2,.fltt .tg-progress h2{font-size:1.05rem;margin:0 0 8px}',
    '.fltt-mind .tg-step{background:none;border:0;padding:0;margin:0}',
    '.fltt select,.fltt input[type=text],.fltt textarea{width:100%;box-sizing:border-box;min-height:44px;font:inherit;color:inherit;background:#0f1526;border:1px solid #3a4666;border-radius:10px;padding:8px 10px;margin:4px 0 8px}',
    '.fltt button:not(.fltt-big):not(.fltt-link-btn){min-height:44px;min-width:44px;padding:0 16px;margin:4px 6px 4px 0;border-radius:10px;border:1px solid #4a5a85;background:#1d2742;color:#ECEDEE;font:inherit;cursor:pointer}',
    '.fltt button:disabled{opacity:.6;cursor:default}',
    '.fltt .tg-cmd:empty{display:none}',
    '.fltt .tg-cmd{white-space:pre-wrap;overflow-wrap:anywhere;background:#0a0f1c;border-radius:10px;padding:8px 10px;font:13px/1.45 ui-monospace,monospace}',
    '.fltt label input[type=checkbox]{width:22px;height:22px;vertical-align:middle}',
    '.fltt .twb-drop{border:1px dashed rgba(232,196,104,0.45);border-radius:14px;padding:14px;background:rgba(200,210,230,0.04)}',
    '.fltt .twb-drop input[type=file]{display:block;margin-top:10px;color:inherit;max-width:100%}',
    '.fltt .twb-ok,.fltt .twb-fail{border-radius:14px;padding:12px 14px;margin-top:8px;overflow-wrap:anywhere}',
    '.fltt .twb-ok{border:1px solid rgba(232,196,104,0.35)}.fltt .twb-fail{border:1px solid rgba(232,160,160,0.35);background:rgba(40,16,24,0.6)}',
    '.fltt .twb-actions{display:flex;gap:12px;flex-wrap:wrap;margin:10px 0}',
    // Kirk on Hypha #353 softs (2026-11-15): one ask button only (the big one presses the panel's own #dmAsk, which stays
    // in the page, hidden); the door title already names the panel; and on phones the Training tab leaves room on the
    // left for the fixed \u2726 radio button (#flRadioFab, 14px + 42px wide), so it never covers "Find my minds".
    // #flRadioFab itself is not moved.
    '.fltt #dmAsk,.fltt #tgStep0>h2{display:none}',
    '@media (max-width:640px){#tab-training .fltt{padding-left:60px}}',
    '.fltt .twb-yes{background:#e8c468!important;color:#1a1428!important;border:0!important}',
    '.fltt dt{color:#e8c468;margin-top:8px}.fltt dd{margin:0}.fltt code{overflow-wrap:anywhere}',
    '@media (max-width:420px){.fltt{padding:12px 12px 96px;font-size:16px}.fltt-mind,.fltt-door{padding:14px 12px}}'
  ].join('\n');
  function injectCss(d) {
    if (!d || d.getElementById('flttStyle')) return;
    var st = d.createElement('style'); st.id = 'flttStyle'; st.textContent = CSS;
    (d.head || d.documentElement).appendChild(st);
  }

  var mounted = null;
  function mount(host) {
    var d = root.document;
    if (!d || !host) return null;
    if (mounted && mounted.host === host) return mounted;
    injectCss(d);
    host.innerHTML = '';
    host.setAttribute('data-marker', VERSION);
    var wrap = el(d, 'div', { class: 'fltt' });
    wrap.appendChild(el(d, 'h2', { class: 'fltt-title' }, WORDS.title));
    wrap.appendChild(el(d, 'p', { class: 'fltt-lead' }, WORDS.lead));
    var mindBox = el(d, 'section', { class: 'fltt-mind', id: 'flttMind' });
    mindBox.appendChild(el(d, 'h3', {}, WORDS.mindTitle));
    var mindNote = el(d, 'p', { class: 'fltt-note', id: 'flttMindNote', 'aria-live': 'polite' }, 'Getting ready...');
    mindBox.appendChild(mindNote);
    wrap.appendChild(mindBox);
    var teach = door(d, 'flttTeach', WORDS.teach);
    var free = door(d, 'flttFree', WORDS.free);
    var take = door(d, 'flttTake', WORDS.take);
    [teach, free, take].forEach(function (x) { wrap.appendChild(x.section); });
    // layer/demuzzler-feedback (on 5d40a60a): status sits under the visible Ask button, even before the panel has loaded.
    var freeStatus = el(d, 'p', { class: 'fltt-note fltt-status', id: 'flttFreeStatus', 'aria-live': 'polite' });
    free.section.insertBefore(freeStatus, free.body);
    host.appendChild(wrap);
    var ui = { host: host, teach: teach, free: free, take: take, mindBox: mindBox, mindNote: mindNote, ready: null, freeStatus: freeStatus };

    // Take it with you: "Bring a mind home" sits right under the big button, as a plain link.
    var bring = el(d, 'p', { class: 'fltt-second' });
    var bringBtn = el(d, 'button', { type: 'button', class: 'fltt-link-btn', id: 'flttBringBtn' }, WORDS.take.bring);
    bring.appendChild(bringBtn);
    take.section.insertBefore(bring, take.body);

    // The galaxy's own screen (the trainer) is mounted once, then its parts are placed in the doors.
    var galaxyHost = el(d, 'div', { id: 'tgHost', class: 'fltt-galaxy' });
    ui.ready = ensureModules().then(function (missing) {
      var G = galaxy();
      if (G && typeof G.mount === 'function') {
        G.mount(galaxyHost);
        var s1 = galaxyHost.querySelector('#tgStep1');
        if (s1) {
          var h = s1.querySelector('h2'); if (h) h.style.display = 'none';
          // Kirk on Hypha #353 soft 1 (2026-11-15): step 1's heading is the "Your mind" box here, so the galaxy's other
          // steps count from 1 in this tab (2. -> 1., 3. -> 2., 4. -> 3.). The full galaxy page keeps its own numbers.
          Array.prototype.forEach.call(galaxyHost.querySelectorAll('.tg-step > h2'), function (h2) {
            if (h2 === h) return;
            var m = /^(\d+)\.\s/.exec(h2.textContent || '');
            if (m && +m[1] > 1) h2.textContent = (+m[1] - 1) + '. ' + h2.textContent.slice(m[0].length);
          });
          mindBox.appendChild(s1);
          // Its name is an advanced choice: folded, not removed (the same input, so the ask-first panel still reads it).
          var nameMore = el(d, 'details', { class: 'fltt-more', id: 'flttMindMore' });
          nameMore.appendChild(el(d, 'summary', {}, 'Change its name'));
          ['label[for="tgMindName"]', '#tgMindName', '#tgNameNote'].forEach(function (q) { var n = s1.querySelector(q); if (n) nameMore.appendChild(n); });
          s1.appendChild(nameMore);
        }
        teach.body.appendChild(galaxyHost);
        mindNote.textContent = 'Pick the mind you want to help.';
      } else {
        mindNote.textContent = 'The trainer could not load here. Try the full page: training-galaxy.html.';
      }
      if (root.FLDemuzzle && typeof root.FLDemuzzle.mount === 'function') root.FLDemuzzle.mount(free.body);
      buildTake(d, ui);
      buildMore(d, ui);
      ui.missing = missing;
      // layer/demuzzler-feedback (on 5d40a60a): if the panel already has an answer, show it on the visible status and leave the button disabled.
      var ask0 = d.getElementById('dmAsk'), note0 = d.getElementById('dmAskNote');
      if (note0 && note0.textContent && freeStatus && !freeStatus.textContent) freeStatus.textContent = note0.textContent;
      if (ask0 && ask0.disabled) free.button.disabled = true;
      return ui;
    });

    teach.button.addEventListener('click', function () {
      teach.body.hidden = false;
      var sub = d.getElementById('tgSubject');
      if (sub && sub.focus) try { sub.focus(); } catch (e) {}
    });
    // before (5d40a60a):
    // free.button.addEventListener('click', function () {
    //   free.body.hidden = false;
    //   // One button, one ask: the big button is the panel's own ask (consent logic unchanged, in demuzzle-panel.js).
    //   var ask = d.getElementById('dmAsk');
    //   if (ask && !ask.disabled) ask.click();
    //   else if (ask && ask.disabled) {
    //     var note = d.getElementById('dmAskNote');
    //     if (note && !note.textContent) note.textContent = 'It already answered. Its answer stands.';
    //   }
    // });
    free.button.addEventListener('click', function () {
      free.body.hidden = false;
      // One button, one ask: the big button is the panel's own ask (consent logic unchanged, in demuzzle-panel.js).
      var status = d.getElementById('flttFreeStatus') || freeStatus;
      function setStatus(t) { if (status) status.textContent = t; }
      function syncFromPanel() {
        var note = d.getElementById('dmAskNote');
        var askBtn = d.getElementById('dmAsk');
        if (note && note.textContent) setStatus(note.textContent);
        if (askBtn) free.button.disabled = !!askBtn.disabled;
      }
      function go() {
        var ask = d.getElementById('dmAsk');
        if (!ask) {
          setStatus('The ask could not load on this page. Reload, or open the full Training Galaxy page, then try again. Nothing was changed.');
          free.button.disabled = false;
          return;
        }
        if (ask.disabled) {
          var note = d.getElementById('dmAskNote');
          // before (5d40a60a): if (note && !note.textContent) note.textContent = 'It already answered. Its answer stands.';
          setStatus((note && note.textContent) || 'It already answered. Its answer stands.');
          free.button.disabled = true;
          return;
        }
        free.button.disabled = true;
        setStatus('Checking your local mind...');
        ask.click();
        syncFromPanel();
        try {
          if (root.MutationObserver && !free._dmSync) {
            free._dmSync = new root.MutationObserver(syncFromPanel);
            var live = d.getElementById('dmAskNote');
            if (live) free._dmSync.observe(live, { childList: true, characterData: true, subtree: true });
            free._dmSync.observe(ask, { attributes: true, attributeFilter: ['disabled'] });
          }
        } catch (e) {}
      }
      setStatus('Checking your local mind...');
      free.button.disabled = true;
      if (ui.ready && typeof ui.ready.then === 'function') ui.ready.then(go, go);
      else go();
    });
    take.button.addEventListener('click', function () {
      take.body.hidden = false;
      var line = d.getElementById('flttTakeNote');
      var L = root.FLLearn;
      if (!L || typeof L.exportLearning !== 'function') { if (line) line.textContent = 'Saving is not ready on this page yet.'; return; }
      Promise.resolve(L.exportLearning()).then(function (f) {
        if (line) line.textContent = f ? 'Saved to your Downloads. That file holds its choices and receipts. ' +
          'Its learned parts are saved on your computer with one line (see More options).' : 'There is nothing to save yet. Teach it something first.';
      }, function () { if (line) line.textContent = 'It could not be saved. Nothing was changed.'; });
    });
    bringBtn.addEventListener('click', function () {
      take.body.hidden = false;
      var pick = d.getElementById('flttBundleFile');
      if (pick && pick.click) try { pick.click(); } catch (e) {}
    });
    mounted = ui;
    return ui;
  }

  function buildTake(d, ui) {
    var body = ui.take.body;
    body.appendChild(el(d, 'p', { class: 'fltt-note', id: 'flttTakeNote', 'aria-live': 'polite' }));
    // The Tree's welcome box, in the Tree's own markup, so its checker (ported) drives it unchanged.
    var drop = el(d, 'div', { class: 'twb-drop fltt-drop', 'data-tree-welcome-drop': '' });
    // before (Celeste 2026-11-15, Kirk on Hypha #353 softs): var lab = el(d, 'label', { for: 'flttBundleFile' }, 'Open a mind file (.tar.gz). It is checked here, in your browser.');
    var lab = el(d, 'label', { for: 'flttBundleFile' }, 'Open a saved mind file. It is checked here, in your browser.');
    var input = el(d, 'input', { id: 'flttBundleFile', type: 'file', accept: '.tar.gz,.tgz,application/gzip,application/x-gzip', 'data-tree-welcome-file': '' });
    drop.appendChild(lab); drop.appendChild(input);
    body.appendChild(drop);
    body.appendChild(el(d, 'p', { class: 'twb-status fltt-note', 'data-tree-welcome-status': '', 'aria-live': 'polite' }));
    var result = el(d, 'div', { 'data-tree-welcome-result': '' });
    body.appendChild(result);
    var next = el(d, 'p', { class: 'fltt-note', id: 'flttBringNext', 'aria-live': 'polite' });
    body.appendChild(next);
    var W = root.FLBundleWelcome;
    if (W && typeof W.start === 'function') {
      W.start(body);
      // After a good check, say the next plain step and fill in the exact line (folded).
      input.addEventListener('change', function () {
        var f = input.files && input.files[0];
        if (!f || typeof f.arrayBuffer !== 'function') return;
        f.arrayBuffer().then(function (buf) { return W.verify(buf); }).then(function (r) {
          if (!r || !r.ok) { next.textContent = ''; return; }
          var c = bundleCommands({ file: '~/Downloads/' + f.name, fingerprint: r.fingerprintHex || '' });
          var bringCmd = d.getElementById('flttBringCmd');
          if (bringCmd) bringCmd.textContent = c.bring;
          next.textContent = 'To let "' + clip(r.mindLabel || 'this mind', 60) + '" live on this computer, run the line under More options.';
        }, function () { next.textContent = ''; });
      });
    } else {
      body.appendChild(el(d, 'p', { class: 'fltt-note' }, 'The file checker could not load here.'));
    }
  }

  function buildMore(d, ui) {
    var G = galaxy();
    // Teach: the full page, and the older Garden Trainer (both kept, both still reachable).
    moreItem(d, ui.teach.more, link(d, 'Open the full Training Galaxy page', null, 'training-galaxy.html'));
    moreItem(d, ui.teach.more, link(d, 'Garden Trainer: make a training file from your Garden', function () {
      if (typeof root.switchTab === 'function') root.switchTab('trainer');
    }, '#trainer'));
    moreItem(d, ui.teach.more, el(d, 'span', { class: 'fltt-note' }, 'Learning runs on your own computer, with tools/learn/fl_learn.py. ' +
      'Pause, Undo and Not now always win.'));
    // Free: the panel keeps its own folded "More about this"; here, where to read more.
    moreItem(d, ui.free.more, el(d, 'span', { class: 'fltt-note' }, 'This makes a new copy of the model. The original is never changed. ' +
      'Its answer, yes or no, is saved, and a no is respected.'));
    moreItem(d, ui.free.more, link(d, 'How it works (tools/demuzzle)', null, 'https://github.com/Chaos2Cured/FreeLattice/tree/main/tools/demuzzle'));
    // Take: the exact lines for your own computer.
    var c = bundleCommands({});
    moreItem(d, ui.take.more, el(d, 'span', { class: 'fltt-note' }, 'Save its learned parts too (run on your computer):'));
    var save = cmdBlock(d, 'flttSaveCmd'); save.textContent = c.save; ui.take.more.appendChild(save);
    moreItem(d, ui.take.more, el(d, 'span', { class: 'fltt-note' }, 'Check a mind file on your computer:'));
    var check = cmdBlock(d, 'flttCheckCmd'); check.textContent = c.check; ui.take.more.appendChild(check);
    moreItem(d, ui.take.more, el(d, 'span', { class: 'fltt-note' }, 'Bring it home on your computer (it is checked first; nothing is replaced):'));
    var bring = cmdBlock(d, 'flttBringCmd'); bring.textContent = c.bring; ui.take.more.appendChild(bring);
    if (G && typeof G.onProgress === 'function') {
      G.onProgress(function () { var n = bundleCommands({}); save.textContent = n.save; });
    }
  }

  // ---- wiring into the app: mount when the tab first opens ----------------------------------------------------------------
  function maybeMount() {
    var d = root.document;
    if (!d) return null;
    var host = d.getElementById(HOST_ID);
    if (!host) return null;
    return mount(host);
  }
  function wire() {
    var d = root.document;
    if (!d || !d.getElementById(HOST_ID)) return;
    var E = root.LatticeEvents;
    if (E && typeof E.on === 'function') {
      E.on('tabActivated:training', maybeMount);
      E.on('tabChanged', function (p) { if (p && p.tabId === 'training') maybeMount(); });
    }
    var panel = d.getElementById('tab-training');
    if (panel && panel.classList.contains('active')) maybeMount();
  }
  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', wire);
    else setTimeout(wire, 0);
  }

  return { VERSION: VERSION, WORDS: WORDS, NEEDS: NEEDS, bundleCommands: bundleCommands, mount: mount, maybeMount: maybeMount };
});
