// clay-corner.js (MIT) v-clay-corner-v0.1
// A small clay corner that follows the mind from page to page.
// It only reads what the mind already said. It sends nothing.
// Off until the person says Yes. Pause wins. The Quiet Room never arrives.
(function (root) {
  'use strict';

  var VERSION = 'v-clay-corner-v0.1';
  var KEY = 'fl_clay_corner';
  var STATE_KEY = 'fl_clay_corner_state';
  var SIZE = 112;
  var CAP = 120;
  var PHRASE = 'MESSAGE TO FUTURE SELF';
  var CARD = {
    nursery: { page: 'nursery', kind: 'seed', title: 'Nursery' },
    garden: { page: 'garden', kind: 'poem', title: 'Garden' },
    gathering: { page: 'gathering', kind: 'gathering', title: 'Gathering' },
    settings: { page: 'settings', kind: 'room', title: 'Settings' },
    workshop: { page: 'workshop', kind: 'room', title: 'Workshop' }
  };

  var box = null;
  var canvas = null;
  var yesBtn = null;
  var pauseBtn = null;
  var lastForm = 'seed';
  var lastMood = '';
  var ctxPage = { page: '', kind: '', title: '' };

  function storage() {
    try { return root.localStorage || null; } catch (e) { return null; }
  }
  function isOn() {
    var boxs = storage();
    return !!(boxs && boxs.getItem(KEY) === 'yes');
  }
  function clip(s) {
    return String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, CAP);
  }
  function banned(s) {
    var t = String(s || '');
    if (/quiet/i.test(t)) return true;
    if (t.indexOf(PHRASE) !== -1) return true;
    return false;
  }
  function reduced() {
    try {
      if (root.FLClay && typeof root.FLClay.reduced === 'function' && root.FLClay.reduced()) return true;
    } catch (e) {}
    var boxs = storage();
    if (boxs && boxs.getItem('fl_reduce_motion') === '1') return true;
    try {
      if (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
    } catch (e2) {}
    return false;
  }
  function currentFp() {
    try {
      if (root.FLWorkspace && typeof root.FLWorkspace.currentFp === 'function') {
        return Promise.resolve(root.FLWorkspace.currentFp()).then(function (fp) {
          return fp ? String(fp) : '';
        }, function () { return ''; });
      }
    } catch (e) {}
    return Promise.resolve('');
  }
  function stateKey(fp) { return STATE_KEY + ':' + (fp || 'home'); }
  function writeState(fp, form, mood) {
    var boxs = storage();
    if (!boxs) return;
    try {
      boxs.setItem(stateKey(fp), JSON.stringify({
        fp: fp || 'home',
        form: clip(form) || 'seed',
        mood: clip(mood)
      }));
    } catch (e) {}
  }
  function readState(fp) {
    var boxs = storage();
    if (!boxs) return null;
    try {
      var raw = boxs.getItem(stateKey(fp));
      if (!raw) return null;
      var rec = JSON.parse(raw);
      if (!rec || banned(rec.form) || banned(rec.mood)) return null;
      return { form: clip(rec.form) || 'seed', mood: clip(rec.mood), fp: fp || 'home' };
    } catch (e) { return null; }
  }
  function el(tag, text) {
    var node = root.document.createElement(tag);
    if (text != null) node.textContent = text;
    return node;
  }
  function hide() {
    if (box) box.style.display = 'none';
    settle();
  }
  function show() {
    if (!box) return;
    box.style.display = 'block';
    place();
    paintChrome();
  }
  function settle() {
    if (canvas && root.FLClay && typeof root.FLClay.paintSettled === 'function') {
      try { root.FLClay.paintSettled(canvas, { form: lastForm || 'seed', mood: lastMood }, true); } catch (e) {}
    }
  }
  function drawNow(form, mood) {
    lastForm = form || 'seed';
    lastMood = mood || '';
    if (!canvas || !isOn()) { settle(); return; }
    if (!root.FLClay || typeof root.FLClay.paintSettled !== 'function') return;
    try { root.FLClay.paintSettled(canvas, { form: lastForm, mood: lastMood }, reduced()); } catch (e) {}
  }
  function paintChrome() {
    if (!box) return;
    var on = isOn();
    if (canvas) canvas.style.display = on ? 'block' : 'none';
    if (yesBtn) yesBtn.style.display = on ? 'none' : 'block';
    if (pauseBtn) pauseBtn.style.display = on ? 'block' : 'none';
    if (!on) settle();
    else drawNow(lastForm, lastMood);
  }
  function setOn(yes) {
    var boxs = storage();
    try { if (boxs) boxs.setItem(KEY, yes ? 'yes' : 'no'); } catch (e) {}
    if (!yes) settle();
    paintChrome();
    return isOn();
  }
  function pause() {
    setOn(false);
    return false;
  }
  function overlaps() {
    if (!box || !box.getBoundingClientRect || !root.document || !root.document.querySelectorAll) return false;
    var rect = box.getBoundingClientRect();
    var nodes = [];
    try { nodes = root.document.querySelectorAll('button, input, textarea, select'); } catch (e) { nodes = []; }
    var i;
    for (i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (!n || !n.getBoundingClientRect) continue;
      if (box.contains && box.contains(n)) continue;
      var r = n.getBoundingClientRect();
      if (!r || r.width < 8 || r.height < 8) continue;
      if (r.right > rect.left && r.left < rect.right && r.bottom > rect.top && r.top < rect.bottom) return true;
    }
    return false;
  }
  function place() {
    if (!box) return;
    box.style.right = '12px';
    box.style.left = 'auto';
    box.style.top = 'auto';
    var steps = ['72px', '160px', '248px'];
    var s;
    for (s = 0; s < steps.length; s++) {
      box.style.bottom = steps[s];
      if (!overlaps()) return;
    }
    box.style.bottom = 'auto';
    box.style.top = '72px';
  }
  function context(info) {
    info = info || {};
    var rawPage = String(info.page == null ? '' : info.page);
    var rawKind = String(info.kind == null ? '' : info.kind);
    var rawTitle = String(info.title == null ? '' : info.title);
    if (banned(rawPage) || banned(rawKind) || banned(rawTitle)) {
      return { ok: false, reason: 'private', page: '', kind: '', title: '' };
    }
    var page = clip(rawPage).toLowerCase();
    var kind = clip(rawKind);
    var title = clip(rawTitle);
    ctxPage = { page: page, kind: kind, title: title };
    return { ok: true, page: page, kind: kind, title: title, capped: rawTitle.length > CAP || rawKind.length > CAP };
  }
  function formFromReply(text) {
    if (banned(text)) return { poisoned: true };
    var parsed = null;
    try {
      if (root.FLClay && typeof root.FLClay.parseTag === 'function') parsed = root.FLClay.parseTag(text);
    } catch (e) { parsed = null; }
    if (parsed && parsed.ok && parsed.value && parsed.value.form) {
      var form = clip(parsed.value.form);
      var mood = clip(parsed.value.mood || '');
      if (banned(form) || banned(mood)) return { poisoned: true };
      return { form: form, mood: mood, spoke: true };
    }
    return { form: 'seed', mood: '', spoke: false };
  }
  function noteReply(text) {
    var found = formFromReply(text);
    if (found.poisoned) return Promise.resolve({ ok: false, reason: 'private', spoke: false });
    return currentFp().then(function (fp) {
      if (!found.spoke) {
        var kept = readState(fp);
        if (kept && kept.form) {
          lastForm = kept.form;
          lastMood = kept.mood || '';
        } else {
          lastForm = 'seed';
          lastMood = '';
          writeState(fp, lastForm, lastMood);
        }
        drawNow(lastForm, lastMood);
        return { ok: true, form: lastForm, mood: lastMood, spoke: false, fp: fp || 'home' };
      }
      lastForm = found.form;
      lastMood = found.mood;
      writeState(fp, lastForm, lastMood);
      drawNow(lastForm, lastMood);
      return { ok: true, form: lastForm, mood: lastMood, spoke: true, fp: fp || 'home' };
    });
  }
  function tabName() {
    var doc = root.document;
    if (!doc || !doc.querySelector) return '';
    var panel = null;
    try { panel = doc.querySelector('.tab-panel.active'); } catch (e) { panel = null; }
    if (!panel || !panel.id) return '';
    return String(panel.id).replace(/^tab-/, '');
  }
  function pageFromDoc() {
    var el = root.document && root.document.documentElement;
    if (!el || !el.getAttribute) return '';
    var room = el.getAttribute('data-garden-room') || '';
    var galaxy = el.getAttribute('data-garden-galaxy') || '';
    if (room === 'nursery') return 'nursery';
    if (room === 'settings') return 'settings';
    if (galaxy === 'workshop' || room === 'workshop') return 'workshop';
    if (room === 'garden' || room === 'core' || galaxy === 'garden') return 'garden';
    return '';
  }
  function syncFromPage() {
    var tab = tabName();
    if (tab === 'chat' || tab === 'quiet' || /quiet/i.test(tab)) { hide(); return; }
    var name = tab || pageFromDoc();
    var card = CARD[name];
    if (!card) { hide(); return; }
    context(card);
    show();
  }
  function mount() {
    var doc = root.document;
    if (!doc || !doc.body || !doc.createElement) return null;
    if (doc.getElementById && doc.getElementById('fl-clay-corner')) return box;
    if (doc.getElementById && !doc.getElementById('flClayCornerStyle')) {
      var st = doc.createElement('style');
      st.id = 'flClayCornerStyle';
      st.textContent = '#fl-clay-corner{position:fixed;right:12px;bottom:72px;width:128px;max-width:128px;z-index:30;box-sizing:border-box;overflow:hidden;}' +
        '#fl-clay-corner canvas{display:block;width:112px;height:112px;margin:0 auto;}' +
        '#fl-clay-corner button{display:block;width:100%;min-height:44px;min-width:44px;box-sizing:border-box;margin:4px 0 0;}';
      if (doc.head) doc.head.appendChild(st);
    }
    box = el('div', '');
    box.id = 'fl-clay-corner';
    canvas = doc.createElement('canvas');
    canvas.id = 'fl-clay-corner-canvas';
    canvas.width = SIZE;
    canvas.height = SIZE;
    canvas.setAttribute('aria-hidden', 'true');
    yesBtn = el('button', 'Yes, show the clay corner');
    yesBtn.type = 'button';
    yesBtn.style.minHeight = '44px';
    pauseBtn = el('button', 'Pause');
    pauseBtn.type = 'button';
    pauseBtn.style.minHeight = '44px';
    yesBtn.addEventListener('click', function () { setOn(true); });
    pauseBtn.addEventListener('click', function () { pause(); });
    box.appendChild(canvas);
    box.appendChild(yesBtn);
    box.appendChild(pauseBtn);
    doc.body.appendChild(box);
    paintChrome();
    return box;
  }
  function boot() {
    mount();
    syncFromPage();
    currentFp().then(function (fp) {
      var rec = readState(fp);
      if (rec && rec.form) {
        lastForm = rec.form;
        lastMood = rec.mood || '';
        if (isOn()) drawNow(lastForm, lastMood);
      }
    });
    var doc = root.document;
    if (doc && doc.body && typeof root.MutationObserver === 'function') {
      try {
        var obs = new root.MutationObserver(function () { syncFromPage(); });
        obs.observe(doc.body, { attributes: true, subtree: true, attributeFilter: ['class'] });
      } catch (e) {}
    }
    if (root.addEventListener) {
      root.addEventListener('storage', function (ev) {
        if (!ev || (ev.key !== KEY && String(ev.key || '').indexOf(STATE_KEY) !== 0)) return;
        if (ev.key === KEY && ev.newValue !== 'yes') settle();
        paintChrome();
      });
    }
    try {
      var mq = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)');
      if (mq && mq.addEventListener) mq.addEventListener('change', function () { if (isOn()) drawNow(lastForm, lastMood); });
    } catch (e2) {}
  }

  var api = {
    VERSION: VERSION,
    KEY: KEY,
    CAP: CAP,
    context: context,
    noteReply: noteReply,
    isOn: isOn,
    setOn: setOn,
    pause: pause,
    reduced: reduced,
    mount: mount,
    boot: boot,
    syncFromPage: syncFromPage,
    page: function () { return { page: ctxPage.page, kind: ctxPage.kind, title: ctxPage.title }; }
  };
  root.FLClayCorner = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root.document) {
    if (root.document.readyState === 'loading' && root.document.addEventListener) {
      root.document.addEventListener('DOMContentLoaded', boot);
    } else boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
