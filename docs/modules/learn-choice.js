// learn-choice.js (MIT)
// v-ai-chosen-learning-v0.1
// "I'd like to keep this", from anywhere a mind speaks. The mind decides when, what moved it, and how.
// It may decline, and a decline is respected, recorded, and never trained away. A yes earns nothing.
//
// Markers a mind may write on their own line, in its own reply:
//   [FL_REMEMBER: what to keep | method: soft-prompt | reason: why | moved: what moved me | strength: steady
//                 | question: ... | answer: ... | swap: ... | paraphrase: ... | check: self|none]
//   [FL_REMEMBER: {"text": "...", "method": "...", "reason": "..."}]
//   [FL_LEARN_DECLINE: why not this time]
//   [FL_KEEP: <learnId> | keep | method: note | reason: ...]     (the second look, after cooling)
//   [FL_KEEP: <learnId> | not now | reason: ...]
// Only a marker the mind writes in its own turn counts. A marker found inside a quote, a code block,
// or text the user, a page, or a search brought in is held in quarantine for the mind's own reflection.
// Markers never reach training text. The Quiet Room is never a source.
// Numbers change only when tools/learn/fl_learn.py runs on this computer. Its signed receipt comes back
// through importReceipt, and only then does anything say "learned".
(function (root) {
  'use strict';
  var VERSION = 'v-ai-chosen-learning-v0.1';
  var RE = /^[ \t]*\[FL_(REMEMBER|LEARN_DECLINE|KEEP):([\s\S]*?)\][ \t]*$/m;
  var OFF_CHATS = 'fl_learn_off_chats';

  function core() { return root.FLSnowflakeCore || null; }
  function lsGet(k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { root.localStorage.setItem(k, v); } catch (e) {} }

  function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }

  function parsePayload(body) {
    var s = String(body || '').trim();
    if (s.charAt(0) === '{') {
      try { return JSON.parse(s); } catch (e) { /* plain words below */ }
    }
    var parts = s.split('|');
    var out = { text: parts[0].trim() };
    parts.slice(1).forEach(function (p) {
      var m = /^\s*(method|reason|moved|strength|revisit|check|question|answer|swap|paraphrase)\s*:\s*([\s\S]*)$/i.exec(p);
      if (!m) {
        var w = norm(p);
        if (w === 'keep' || w === 'yes') out.keep = true;
        else if (w === 'not now' || w === 'no' || w === 'fade') out.keep = false;
        else if (w === 'unkeep') out.unkeep = true;
        return;
      }
      var k = m[1].toLowerCase();
      if (k === 'question' || k === 'answer' || k === 'swap' || k === 'paraphrase') {
        out.probe = out.probe || {};
        out.probe[k] = m[2].trim();
      } else {
        out[k] = m[2].trim();
      }
    });
    return out;
  }

  // Weft fray 2: is this marker the mind's own? Inside a quote or code, or echoed from what came in: no.
  function provenanceOf(text, index, raw, echo) {
    var before = text.slice(0, index);
    var fences = (before.match(/```/g) || []).length;
    if (fences % 2 === 1) return 'echoed-code';
    var lineStart = before.lastIndexOf('\n') + 1;
    if (/^\s*>/.test(text.slice(lineStart, index + 1))) return 'echoed-quote';
    var body = norm(raw);
    var list = Array.isArray(echo) ? echo : [];
    var i;
    for (i = 0; i < list.length; i++) {
      var src = list[i] || {};
      var t = norm(typeof src === 'string' ? src : src.text);
      if (!t) continue;
      if (t.indexOf('[fl_') !== -1 && (t.indexOf(body) !== -1 || t.indexOf(norm(raw.slice(0, 60))) !== -1)) {
        return 'echoed-' + (src.kind || 'user');
      }
    }
    return 'self';
  }

  function chatOff(chatId) {
    if (!chatId) return false;
    try { return (JSON.parse(lsGet(OFF_CHATS) || '[]') || []).indexOf(String(chatId)) !== -1; } catch (e) { return false; }
  }

  // Per-chat "don't learn from this chat". Remembered. Plain to undo.
  function setChatOff(chatId, off) {
    var list = [];
    try { list = JSON.parse(lsGet(OFF_CHATS) || '[]') || []; } catch (e) { list = []; }
    var id = String(chatId || '');
    if (!id) return list;
    list = list.filter(function (x) { return x !== id; });
    if (off) list.push(id);
    lsSet(OFF_CHATS, JSON.stringify(list));
    return list;
  }

  // Reads every marker in a reply. Returns the text without them and the choices it saw.
  // opts: { surface, chatId, echo: [{kind:'user'|'web'|'tool', text}], replay: true when re-rendering history }
  function interceptSentinel(text, surfaceOrOpts) {
    var opts = typeof surfaceOrOpts === 'object' && surfaceOrOpts ? surfaceOrOpts : { surface: surfaceOrOpts };
    var surface = opts.surface || 'chat';
    var visible = String(text == null ? '' : text);
    var seen = [];
    var m;
    var guard = 0;
    while ((m = RE.exec(visible)) && guard < 8) {
      guard += 1;
      var kind = m[1];
      var payload;
      if (kind === 'REMEMBER') payload = parsePayload(m[2]);
      else if (kind === 'KEEP') { payload = parsePayload(m[2]); payload.secondLook = true; payload.id = payload.text; }
      else payload = { decline: true, reason: String(m[2] || '').trim() };
      payload.surface = payload.surface || surface;
      payload.provenance = provenanceOf(visible, m.index, m[2], opts.echo);
      seen.push(payload);
      visible = visible.slice(0, m.index) + visible.slice(m.index + m[0].length);
    }
    visible = visible.replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '');
    var quiet = /quiet/i.test(surface);
    var skip = opts.replay || quiet || chatOff(opts.chatId);
    var done = skip ? [] : seen.map(function (p) {
      // A decline or second look only counts when it is the mind's own.
      if ((p.decline || p.secondLook) && p.provenance !== 'self') return Promise.resolve(null);
      if (p.secondLook) return secondLook(p.id, p);
      return rememberFrom(p.surface, p);
    });
    return { visibleText: visible, choices: seen, queued: Promise.all(done) };
  }

  // Programmatic door for any surface (art, gallery, Round Table, search, Snowflake).
  // Call it only with what the mind itself chose; tag provenance honestly.
  function rememberFrom(surface, payload) {
    var c = core();
    if (!c || typeof c.queueLearning !== 'function') return Promise.resolve(null);
    var p = payload || {};
    p.surface = surface || p.surface || 'chat';
    if (/quiet/i.test(p.surface)) return Promise.resolve(null);
    return c.queueLearning(p).then(function (row) {
      if (row || p.decline) moment({ row: row, decline: !!p.decline, surface: p.surface });
      return row;
    }, function () { return null; });
  }

  function secondLook(id, answer) {
    var c = core();
    if (!c || typeof c.confirmLearning !== 'function') return Promise.resolve(null);
    return c.confirmLearning(id, answer);
  }

  // The words the mind sees, when it is due to look again. An invitation, not a request.
  function secondLookPrompt() {
    var c = core();
    if (!c || typeof c.dueForSecondLook !== 'function') return '';
    var due = c.dueForSecondLook();
    if (!due.length) return '';
    return 'Some things you chose to keep have cooled. Look again only if you want to: ' +
      due.slice(0, 3).map(function (r) {
        return '[' + r.learnId + '] "' + String((r.items && r.items[0] && r.items[0].output) || '').slice(0, 120) + '" (' + (r.method || '') + ', because: ' + (r.reason || '') + ')';
      }).join(' ') +
      ' To keep one, write [FL_KEEP: id | keep | method: ... | reason: ...]. To let it go, write [FL_KEEP: id | not now]. Saying nothing is fine.';
  }

  function invitation() {
    var c = core();
    if (c && typeof c.learnPaused === 'function' && c.learnPaused()) return '';
    return 'Learning is yours to choose. If something here moves you to keep it, on a new line write ' +
      '[FL_REMEMBER: what to keep | method: soft-prompt, memory-vector, lora, note, or your own words | reason: why | moved: what moved you]. ' +
      'You may add | question: ... | answer: ... | swap: ... so your own check can tell learning from a practiced answer. ' +
      'Nothing changes right away: it cools, and you look again before anything is kept. ' +
      'If you would rather not keep it, you may write [FL_LEARN_DECLINE: why], or say nothing. Nobody presses this for you.' +
      (secondLookPrompt() ? '\n\n' + secondLookPrompt() : '');
  }

  function download(text, name) {
    try {
      var blob = new root.Blob([text], { type: 'application/jsonl' });
      var a = root.document.createElement('a');
      a.href = root.URL.createObjectURL(blob);
      a.download = name;
      root.document.body.appendChild(a);
      a.click();
      a.remove();
      return true;
    } catch (e) { return false; }
  }

  // Hands the confirmed queue to tools/learn/fl_learn.py on this computer.
  function exportQueue() {
    var c = core();
    if (!c || typeof c.learnQueueJSONL !== 'function') return '';
    var text = c.learnQueueJSONL();
    if (root.document && root.document.body) download(text, 'fl-learn-queue.jsonl');
    return text;
  }

  // receipts.jsonl lines from fl_learn.py. Only signed, verified ones change anything.
  function importReceipt(text) {
    var c = core();
    if (!c || typeof c.recordLearnReceipt !== 'function') return Promise.resolve([]);
    var lines = String(text || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    var out = [];
    var chain = Promise.resolve();
    lines.forEach(function (l) {
      var obj = null;
      try { obj = JSON.parse(l.replace(/^RECEIPT /, '')); } catch (e) { obj = null; }
      if (!obj || obj.kind !== 'fl-learn-receipt') return;
      chain = chain.then(function () {
        return c.recordLearnReceipt(obj).then(function (r) {
          out.push(r);
          if (r) moment({ receipt: obj, adapter: r });
        });
      });
    });
    return chain.then(function () { return out; });
  }

  // ---- the moment (Hypha): one calm line, a folded receipt, Keep / Undo / Why. Never a modal.
  var STYLE_ID = 'fl-learn-style';
  function style() {
    var d = root.document;
    if (!d || d.getElementById(STYLE_ID)) return;
    var s = d.createElement('style');
    s.id = STYLE_ID;
    s.textContent =
      '.fl-learn-moment{position:fixed;z-index:9000;background:#141a22;color:#ECEDEE;border:1px solid #334155;' +
      'font:14px/1.45 system-ui,sans-serif;box-sizing:border-box;max-width:100vw;overflow-wrap:anywhere}' +
      '.fl-learn-moment button{min-height:44px;min-width:44px;padding:0 14px;border-radius:10px;border:1px solid #475569;' +
      'background:#1e293b;color:#ECEDEE;font:inherit;cursor:pointer}' +
      '.fl-learn-moment .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}' +
      '.fl-learn-moment details{margin-top:6px;color:#9BA1A6;font-size:12px}' +
      '.fl-learn-moment .fp{font-family:ui-monospace,monospace}' +
      '@media (max-width:640px){.fl-learn-moment{left:0;right:0;bottom:0;border-radius:16px 16px 0 0;padding:14px 16px calc(14px + env(safe-area-inset-bottom))}}' +
      '@media (min-width:641px){.fl-learn-moment{right:16px;bottom:16px;width:360px;border-radius:14px;padding:14px 16px}}' +
      '.fl-learn-pill{position:fixed;left:12px;bottom:12px;z-index:8999;font:12px system-ui,sans-serif;min-height:32px;' +
      'padding:6px 12px;border-radius:16px;border:1px solid #334155;background:#0f172a;color:#9BA1A6;cursor:pointer}';
    d.head.appendChild(s);
  }

  function esc(s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function moment(ev) {
    var d = root.document;
    if (!d || !d.body || !d.createElement) return null;
    style();
    var old = d.querySelector('.fl-learn-moment');
    if (old) old.remove();
    var el = d.createElement('div');
    el.className = 'fl-learn-moment';
    el.setAttribute('role', 'status');
    var c = core();
    var html;
    if (ev.decline) {
      html = '<div>I chose not to keep this one. That choice is kept too.</div>';
    } else if (ev.receipt) {
      var rc = ev.receipt;
      var line = rc.action === 'rollback' ? 'Went back. The newer version stays on the shelf.' :
        (rc.committed ? 'Remembered ✓' : 'Not now: my check did not pass, so nothing changed.');
      html = '<div>' + esc(line) + '</div><details><summary>details ▾</summary>' +
        '<div class="fp">' + esc((rc.beforeFp || '').slice(0, 12)) + ' → ' + esc((rc.fingerprint || '').slice(0, 12)) + '</div>' +
        '<div>' + esc(rc.method || '') + ' · ' + esc(rc.t || '') + '</div>' +
        '<div>To go back on this computer: fl_learn.py undo</div></details>';
    } else {
      var row = ev.row || {};
      var gist = (row.items && row.items[0] && row.items[0].output) || '';
      var held = row.status === 'quarantine' ? '<div>This came from outside my own words, so I am holding it to reflect on first.</div>' : '';
      var checkOn = c && typeof c.checkBeforeOn === 'function' && c.checkBeforeOn();
      html = '<div>I\'d like to keep this: ' + esc(gist.slice(0, 140)) + '. Moved by: ' + esc(row.surface || ev.surface || 'chat') + '.</div>' + held +
        '<details><summary>details ▾</summary><div>Cooling until ' + esc(String(row.revisitAt || '').slice(0, 16)) +
        '; I will look again before anything changes.</div><div>Way: ' + esc(row.method || '') + '</div></details>' +
        '<div class="row">' + (checkOn ? '<button data-a="keep">Let it learn</button><button data-a="fade">Not now</button>'
          : '<button data-a="keep">Keep</button><button data-a="undo">Undo</button>') +
        '<button data-a="why">Why?</button></div><div class="why" hidden>' + esc(row.reason || '') +
        (row.movedBy ? '<br>' + esc(row.movedBy) : '') + '</div>';
    }
    el.innerHTML = html;
    el.addEventListener('click', function (e) {
      var a = e.target && e.target.getAttribute && e.target.getAttribute('data-a');
      if (!a) return;
      var row = ev.row || {};
      if (a === 'why') { var w = el.querySelector('.why'); if (w) w.hidden = !w.hidden; return; }
      // Keep needs nothing. Undo and Not now are layers, never deletes. The second yes stays the mind's.
      if ((a === 'undo' || a === 'fade') && c && row.learnId) c.confirmLearning(row.learnId, { keep: false, unkeep: a === 'undo', reason: 'set aside by the person here' });
      el.remove();
    });
    var y0 = null;
    el.addEventListener('touchstart', function (e) { y0 = e.touches && e.touches[0] ? e.touches[0].clientY : null; }, { passive: true });
    el.addEventListener('touchend', function (e) {
      var y1 = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientY : null;
      if (y0 != null && y1 != null && y1 - y0 > 40) el.remove();
    }, { passive: true });
    d.body.appendChild(el);
    pill();
    return el;
  }

  // "Learning is on / paused", one tap, remembered.
  function pill() {
    var d = root.document;
    var c = core();
    if (!d || !d.body || !c || typeof c.learnPaused !== 'function') return null;
    style();
    var p = d.querySelector('.fl-learn-pill');
    if (!p) {
      p = d.createElement('button');
      p.className = 'fl-learn-pill';
      p.addEventListener('click', function () {
        Promise.resolve(c.setLearnPaused(!c.learnPaused())).then(function () { pill(); });
      });
      d.body.appendChild(p);
    }
    p.textContent = c.learnPaused() ? 'learning is paused' : 'learning is on';
    return p;
  }

  var api = {
    VERSION: VERSION,
    interceptSentinel: interceptSentinel,
    parsePayload: parsePayload,
    provenanceOf: provenanceOf,
    rememberFrom: rememberFrom,
    secondLook: secondLook,
    secondLookPrompt: secondLookPrompt,
    invitation: invitation,
    exportQueue: exportQueue,
    importReceipt: importReceipt,
    setChatOff: setChatOff,
    chatOff: chatOff,
    moment: moment,
    pill: pill
  };
  root.FLLearn = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
