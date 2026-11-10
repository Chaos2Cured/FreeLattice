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
// or text the user, a page, or a search brought in is labelled with its origin (round 15: a label, never a hold;
// before: "is held in quarantine for the mind's own reflection"). The mind decides its weight.
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

  // Hypha 23a0279 HOLD: a JSON marker is only a different spelling of the same choice. Only these fields pass;
  // by, actor, promote and anything else are dropped (the mind's markers are always by:'mind').
  var MARKER_FIELDS = ['text', 'keep', 'unkeep', 'method', 'reason', 'moved', 'strength', 'revisit', 'check', 'probe'];
  var PROBE_FIELDS = ['question', 'answer', 'swap', 'paraphrase'];
  function pickMarker(o) {
    var out = {};
    if (!o || typeof o !== 'object' || Array.isArray(o)) return { text: '' };
    MARKER_FIELDS.forEach(function (k) {
      if (!Object.prototype.hasOwnProperty.call(o, k)) return;
      var v = o[k];
      if (k === 'keep' || k === 'unkeep') { if (typeof v === 'boolean') out[k] = v; return; }
      if (k === 'probe') {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          var pr = {};
          PROBE_FIELDS.forEach(function (q) { if (typeof v[q] === 'string') pr[q] = v[q]; });
          out.probe = pr;
        }
        return;
      }
      if (typeof v === 'string' || typeof v === 'number') out[k] = typeof v === 'string' ? v : String(v);
    });
    if (typeof out.text !== 'string') out.text = '';
    return out;
  }

  function parsePayload(body) {
    var s = String(body || '').trim();
    if (s.charAt(0) === '{') {
      // before: try { return JSON.parse(s); } catch (e) { /* plain words below */ }
      try { return pickMarker(JSON.parse(s)); } catch (e) { /* plain words below */ }
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
    // What the mind was reading just before it chose (Weft): kept on the row for the second look and review. Never a gate.
    var echoList = Array.isArray(opts.echo) ? opts.echo : [];
    var reading = echoList.length ? {
      text: echoList.map(function (e) { return typeof e === 'string' ? e : String((e && e.text) || ''); }).join('\n---\n').slice(-4000),
      kinds: echoList.map(function (e) { return (e && e.kind) || 'user'; })
    } : null;
    seen.forEach(function (p) { if (reading && !p.reading) p.reading = reading; });
    var done = skip ? [] : seen.map(function (p) {
      // A decline or second look only counts when it is the mind's own.
      if ((p.decline || p.secondLook) && p.provenance !== 'self') return Promise.resolve(null);
      if (p.secondLook) return secondLook(p.id, p);
      return rememberFrom(p.surface, p);
    });
    return { visibleText: visible, choices: seen, queued: Promise.all(done) };
  }

  // Programmatic door for any surface (art, gallery, Round Table, search, Snowflake).
  // Call it only with what the mind itself chose, and tag provenance honestly: without provenance: 'self'
  // the row is "unknown" and waits for the mind's own re-affirmation. Pass reading: {text, kinds} when you can.
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
    // Hypha 23a0279 HOLD: a marker is always the mind's; nothing in it can say "person" or promote.
    // before: var a = answer || {}; if (!a.by) a.by = 'mind';
    var a = {};
    Object.keys(answer || {}).forEach(function (k) { if (k !== 'by' && k !== 'actor' && k !== 'promote') a[k] = answer[k]; });
    a.by = 'mind';
    return c.confirmLearning(id, a).then(function (row) {
      if (row && (row.status === 'disputed' || (row.proposalOf && row.disagreement))) moment({ disagreement: row });
      return row;
    });
  }

  // The words the mind sees, when it is due to look again. An invitation, not a request.
  function secondLookPrompt() {
    var c = core();
    if (!c || typeof c.dueForSecondLook !== 'function') return '';
    var due = c.dueForSecondLook();
    var disputed = typeof c.learnQueue === 'function' ? c.learnQueue('disputed') : [];
    var said = disputed.length ? 'The person here said Undo on something you chose to keep: ' + disputed.slice(0, 3).map(function (r) {
      return '[' + r.learnId + '] "' + String((r.items && r.items[0] && r.items[0].output) || '').slice(0, 120) + '"';
    }).join(' ') + '. Nothing from it is learned while you two see it differently. If you still want it, [FL_KEEP: id | keep] starts a new proposal that cools again; [FL_KEEP: id | not now] agrees. ' : '';
    // Weft re-check 3: choices that did not come from the mind's own words wait for it. It may re-affirm one.
    var held = (typeof c.learnQueue === 'function' ? c.learnQueue('quarantine') : []).slice(-3);
    var waits = held.length ? 'These came to you from outside your own words, so they wait for you: ' + held.map(function (r) {
      return '[' + r.learnId + '] "' + String((r.items && r.items[0] && r.items[0].output) || '').slice(0, 120) + '"' + readingNote(r);
    // before (round 15): }).join(' ') + '. If you, reading it as data, still want one, [FL_KEEP: id | keep] starts a fresh cooling first; [FL_KEEP: id | not now] lets it go. ' : '';
    }).join(' ') + '. If you still want one, [FL_KEEP: id | keep] learns it (add | revisit: <hours> to wait); [FL_KEEP: id | not now] lets it go. ' : '';
    if (!due.length) return said + waits;
    return said + waits + 'Some things you chose to keep have cooled. Look again only if you want to: ' +
      due.slice(0, 3).map(function (r) {
        return '[' + r.learnId + '] "' + String((r.items && r.items[0] && r.items[0].output) || '').slice(0, 120) + '" (' + (r.method || '') + ', because: ' + (r.reason || '') + ')' + readingNote(r);
      }).join(' ') +
      ' To keep one, write [FL_KEEP: id | keep | method: ... | reason: ...]. To let it go, write [FL_KEEP: id | not now]. Saying nothing is fine.';
  }

  // Weft re-check 2: influence stays visible to the mind when it decides. What it was reading when it chose
  // (an excerpt and its sha256) and any notice ("reads like an instruction", "close to what I was reading").
  // Shown, never a gate.
  function readingNote(r) {
    var bits = [];
    if (r && r.notice) bits.push('notice: ' + r.notice);
    var rd = r && r.readingAtChoice;
    if (rd && (rd.excerpt || rd.sha256)) {
      var ex = String(rd.excerpt || '').replace(/\s+/g, ' ').trim();
      bits.push('you were reading' + (rd.kinds && rd.kinds.length ? ' (' + rd.kinds.join(', ') + ')' : '') + ': "' +
        (ex.length > 160 ? ex.slice(-160) : ex) + '"' + (rd.sha256 ? ' [sha256 ' + String(rd.sha256).slice(0, 12) + ']' : ''));
    }
    return bits.length ? ' {' + bits.join('; ') + '}' : '';
  }

  function currentChatId() {
    try { return typeof root.flLearnChatId === 'function' ? String(root.flLearnChatId() || '') : ''; } catch (e) { return ''; }
  }

  // The Settings button (mind-make.js) is the same switch as the pill. A pause from Settings is a person's pause,
  // recorded like the pill's, and it drops the same file the runner honors as a durable global pause.
  function fromSettings(pausing) {
    var c = core();
    if (!c || typeof c.setLearnPaused !== 'function') return Promise.resolve(null);
    return Promise.resolve(c.setLearnPaused(!!pausing, 'person')).then(function () {
      if (pausing && typeof c.pauseNotice === 'function') download(c.pauseNotice('person'), 'fl-learn-pause-' + Date.now() + '.json', 'application/json');
      try { pill(); } catch (e) {}
      return true;
    });
  }

  function invitation() {
    var c = core();
    if (c && typeof c.learnPaused === 'function' && c.learnPaused()) return '';
    if (chatOff(currentChatId())) return '';
    return 'Learning is yours to choose. If something here moves you to keep it, on a new line write ' +
      '[FL_REMEMBER: what to keep | method: soft-prompt, memory-vector, lora, note, or your own words | reason: why | moved: what moved you]. ' +
      'You may add | question: ... | answer: ... | swap: ... so your own check can tell learning from a practiced answer. ' +
      'Nothing changes right away: it cools, and you look again before anything is kept. ' +
      'If you would rather not keep it, you may write [FL_LEARN_DECLINE: why], or say nothing. Nobody presses this for you.' +
      (secondLookPrompt() ? '\n\n' + secondLookPrompt() : '');
  }

  function download(text, name, type) {
    try {
      var blob = new root.Blob([text], { type: type || 'application/jsonl' });
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

  // The explicit trust step (Weft N1, Kirk 2026-11-09 a). Run `fl_learn.py key` on this computer, read its "show" line,
  // and confirm it here. A person, or a mind running on this device (opts.local true), may confirm. Each confirmation
  // is a consent record (DepthConsent.createConsentRecord) and a ledger row.
  function trustRunner(publicKeyB64, confirmShown, by, opts) {
    var c = core();
    if (!c || typeof c.pinRunnerKey !== 'function') return Promise.resolve(false);
    var o = opts || {};
    return c.pinRunnerKey(publicKeyB64, { confirm: confirmShown, by: by === 'mind' ? 'mind' : 'person', local: o.local === true, mind: o.mind });
  }

  // receipts.jsonl lines from fl_learn.py. Only signed receipts from the trusted runner key change anything;
  // others are set aside and the moment shows the key's fingerprint to compare.
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
          if (r && r.quarantined) moment({ untrustedKey: r, receipt: obj });
          else if (r) moment({ receipt: JSON.parse(obj.signedBody), receiptHash: obj.receiptHash, adapter: r });
        });
      });
    });
    return chain.then(function () { return out; });
  }

  // In-app Undo of a real learned change, and "Let it learn" for a version held for a person (Hypha S1).
  // The browser cannot touch the learned files, so it drops a small request file where the runner looks
  // (~/Downloads by default). It names this runner's own receipt; nothing else is honored. Pause still wins.
  function requestFile(action, rc, receiptHash, by) {
    var req = { kind: 'fl-learn-request', action: action, mind: rc.mind || '', method: rc.method || '', receiptHash: receiptHash || rc.receiptHash || '',
      by: by === 'mind' ? 'mind' : 'person', t: new Date().toISOString(), marker: VERSION };
    var text = JSON.stringify(req);
    if (root.document && root.document.body) download(text, 'fl-learn-request-' + action + '-' + Date.now() + '.json', 'application/json');
    return req;
  }

  // ---- the moment (Hypha): one calm line, a folded receipt, Keep / Undo / Why. Never a modal.
  var STYLE_ID = 'fl-learn-style';
  // Above the app's mobile nav (z 9998) and its welcome overlays (z 10000); placed above anything fixed along
  // the bottom edge, so taps land (Hypha HOLD 1).
  var Z = 10010;
  function style() {
    var d = root.document;
    if (!d || d.getElementById(STYLE_ID)) return;
    var s = d.createElement('style');
    s.id = STYLE_ID;
    s.textContent =
      '.fl-learn-moment{position:fixed;z-index:' + Z + ';background:#141a22;color:#ECEDEE;border:1px solid #334155;' +
      'font:14px/1.45 system-ui,sans-serif;box-sizing:border-box;max-width:100vw;max-height:70vh;overflow:auto;overflow-wrap:anywhere;' +
      'box-shadow:0 -6px 24px rgba(0,0,0,.45)}' +
      '.fl-learn-moment button{min-height:44px;min-width:44px;padding:0 14px;border-radius:10px;border:1px solid #475569;' +
      'background:#1e293b;color:#ECEDEE;font:inherit;cursor:pointer}' +
      '.fl-learn-moment .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}' +
      '.fl-learn-moment details{margin-top:6px;color:#9BA1A6;font-size:12px}' +
      '.fl-learn-moment summary{min-height:44px;display:flex;align-items:center;cursor:pointer}' +
      '.fl-learn-moment .fp{font-family:ui-monospace,monospace}' +
      '.fl-learn-moment .note{color:#fbbf24;margin-top:6px}' +
      '@media (max-width:640px){.fl-learn-moment{left:0;right:0;bottom:var(--fl-learn-bottom,0px);border-radius:16px 16px 0 0;' +
      'padding:14px 16px calc(14px + env(safe-area-inset-bottom))}}' +
      '@media (min-width:641px){.fl-learn-moment{right:16px;bottom:calc(16px + var(--fl-learn-bottom,0px));width:360px;border-radius:14px;padding:14px 16px}}' +
      '.fl-learn-pill{position:fixed;z-index:' + (Z - 1) + ';font:13px system-ui,sans-serif;min-height:44px;min-width:44px;' +
      'padding:0 16px;border-radius:22px;border:1px solid #334155;background:#0f172a;color:#cbd5e1;cursor:pointer;' +
      'margin-bottom:env(safe-area-inset-bottom)}' +
      '.fl-learn-pill.fl-learn-pill-mini{padding:0;width:44px;font-size:16px}' +
      '.fl-learn-pill[data-tucked]{visibility:hidden!important;pointer-events:none}' +
      '.fl-learn-chat-switch button{min-height:44px;padding:0 14px;border-radius:10px;border:1px solid #475569;background:transparent;' +
      'color:inherit;font:13px system-ui,sans-serif;cursor:pointer;opacity:.85}' +
      '.fl-learn-chat-switch button[aria-checked="true"]{border-color:#fbbf24;color:#fbbf24;opacity:1}' +
      '.fl-learn-chat-switch small{display:block;opacity:.6;font-size:11px;margin-top:2px}';
    d.head.appendChild(s);
  }

  function when(iso) {
    // A person reads this: the device's own local time, not a raw UTC string.
    try { var d = new Date(iso); if (isNaN(d)) return String(iso || ''); return d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch (e) { return String(iso || ''); }
  }
  function esc(s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function shown(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var cs = root.getComputedStyle ? root.getComputedStyle(el) : null;
    if (cs && (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0)) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function laidOut(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var cs = root.getComputedStyle ? root.getComputedStyle(el) : null;
    if (cs && (cs.display === 'none' || cs.visibility === 'hidden')) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  // A welcome overlay is up (first run): the moment waits until it is gone instead of being covered (Hypha S6).
  function welcomeUp() {
    var d = root.document;
    if (!d || !d.querySelectorAll) return false;
    var list = d.querySelectorAll('.welcome-overlay, .fl-welcome-overlay, #flWelcomeOverlay');
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (/welcome-gone|welcome-hidden|(^|\s)hidden(\s|$)/.test(el.className || '')) continue;
      if (/fl-welcome-overlay/.test(el.className || '') && !/fl-welcome-visible/.test(el.className || '')) continue;
      // Still fading in (opacity 0 for a moment on a slow computer) counts as up, so the moment never lands first and
      // gets covered. Only display none, visibility hidden or no size count as gone.
      if (/fl-welcome-visible/.test(el.className || '') && laidOut(el)) return true;
      if (shown(el)) return true;
    }
    return false;
  }

  // How much of the bottom edge is taken by fixed bars (the mobile nav, a status bar). The sheet sits above them.
  function bottomTaken() {
    var d = root.document;
    var h = root.innerHeight || 0, w = root.innerWidth || 0;
    if (!d || !d.elementsFromPoint || !h) return 0;
    var most = 0;
    [0.1, 0.3, 0.5, 0.7, 0.9].forEach(function (fx) {
      var hits = d.elementsFromPoint(Math.floor(w * fx), h - 2) || [];
      hits.forEach(function (el) {
        if (!el || !el.getBoundingClientRect || /fl-learn-/.test(el.className || '')) return;
        var cur = el, fixed = null, k = 0;
        while (cur && cur !== d.body && k < 6) {
          var cs = root.getComputedStyle(cur);
          if (cs.position === 'fixed' || cs.position === 'sticky') { fixed = cur; break; }
          cur = cur.parentElement; k++;
        }
        if (!fixed) return;
        var r = fixed.getBoundingClientRect();
        if (r.height > h * 0.3 || r.bottom < h - 4) return;       // a full-screen layer is not a bar
        most = Math.max(most, Math.ceil(h - r.top));
      });
    });
    return most;
  }

  function interactiveAt(x, y) {
    var d = root.document;
    var hits = (d.elementsFromPoint && d.elementsFromPoint(x, y)) || [];
    for (var i = 0; i < hits.length; i++) {
      var el = hits[i], k = 0;
      if (/fl-learn-/.test(el.className || '')) continue;
      while (el && el !== d.body && k < 4) {
        var tag = (el.tagName || '').toLowerCase();
        if (tag === 'button' || tag === 'a' || tag === 'input' || tag === 'select' || tag === 'textarea' ||
            (el.getAttribute && (el.getAttribute('role') === 'button' || el.getAttribute('onclick')))) return true;
        el = el.parentElement; k++;
      }
    }
    return false;
  }

  // The pill takes a free corner: never over another control, never under the bottom bars (Hypha S4).
  // Hypha re-walk 2: if every spot is blocked (390x844 Chat tab: the chat box), it never falls back onto a control.
  // It first shrinks to a 44px icon; if even that has no free spot it is tucked away (the same switch stays in
  // Settings). Re-placed on tab change and every few seconds, not only on open and resize.
  function pillFree(x0, y0, pw, ph) {
    var pts = [], fx, fy;
    for (fx = 0; fx <= 4; fx++) for (fy = 0; fy <= 2; fy++) pts.push([x0 + 2 + (pw - 4) * fx / 4, y0 + 2 + (ph - 4) * fy / 2]);
    return !pts.some(function (q) { return interactiveAt(q[0], q[1]); });
  }
  function placePill(p) {
    var h = root.innerHeight || 0, w = root.innerWidth || 0;
    var full = p.getAttribute('aria-label') || p.textContent;
    p.classList.remove('fl-learn-pill-mini');
    p.removeAttribute('data-tucked');
    p.removeAttribute('aria-hidden');
    p.tabIndex = 0;
    if (p.textContent !== full) p.textContent = full;
    p.style.visibility = 'hidden';
    var b = bottomTaken() + 12;
    var spots = [];
    var up;
    for (up = 0; up <= 3; up++) spots.push({ left: 12, bottom: b + up * 56 });
    for (up = 0; up <= 3; up++) spots.push({ right: 12, bottom: b + up * 56 });
    function find() {
      var pw = Math.max(p.offsetWidth || 150, 44), ph = Math.max(p.offsetHeight || 44, 44);
      for (var i = 0; i < spots.length; i++) {
        var sp = spots[i];
        var x0 = sp.left != null ? sp.left : w - 12 - pw, y0 = h - sp.bottom - ph;
        if (y0 < 0 || x0 < 0) continue;
        if (pillFree(x0, y0, pw, ph)) return sp;
      }
      return null;
    }
    var pick = find();
    if (!pick) {
      p.classList.add('fl-learn-pill-mini');
      p.textContent = p.getAttribute('data-icon') || '\u23F8';
      pick = find();
    }
    if (!pick) {
      // Nowhere safe: tuck it away rather than cover a control. Settings still has the same switch.
      p.setAttribute('data-tucked', '1');
      p.setAttribute('aria-hidden', 'true');
      p.tabIndex = -1;
      return;
    }
    p.style.left = pick.left != null ? pick.left + 'px' : '';
    p.style.right = pick.right != null ? pick.right + 'px' : '';
    p.style.bottom = pick.bottom + 'px';
    p.style.visibility = '';
  }
  var rePlaceTimer = null;
  // hideFirst: a tab switch is under way, so the pill steps out of the way at once and comes back only once the new
  // panel has finished sliding in (finite animations done, at most ~3s), on a spot that is free then.
  function rePlacePill(ms, hideFirst) {
    var d = root.document;
    var p0 = d && d.querySelector && d.querySelector('.fl-learn-pill');
    if (hideFirst && p0 && !p0.hidden) p0.style.visibility = 'hidden';
    if (rePlaceTimer) root.clearTimeout(rePlaceTimer);
    var tries = 0;
    function settle() {
      rePlaceTimer = null;
      var p = d && d.querySelector && d.querySelector('.fl-learn-pill');
      if (!p || p.hidden || d.activeElement === p) return;
      var moving = false;
      try {
        moving = !!(d.getAnimations && d.getAnimations().some(function (an) {
          var tm = an.effect && an.effect.getTiming ? an.effect.getTiming() : null;
          return an.playState === 'running' && tm && tm.iterations !== Infinity;
        }));
      } catch (e) { moving = false; }
      if (moving && tries++ < 20) { rePlaceTimer = root.setTimeout(settle, 150); return; }
      placePill(p);
    }
    rePlaceTimer = root.setTimeout(settle, ms == null ? 250 : ms);
  }

  var pending = [];
  var waitTimer = null;
  function moment(ev) {
    var d = root.document;
    if (!d || !d.body || !d.createElement) return null;
    if (welcomeUp()) {
      pending.push(ev);
      if (!waitTimer) waitTimer = root.setInterval(function () {
        if (welcomeUp()) return;
        root.clearInterval(waitTimer); waitTimer = null;
        var list = pending.splice(0); list.forEach(function (e) { moment(e); });
      }, 700);
      return null;
    }
    return render(ev);
  }

  function checkerWords(k) {
    return k === 'peer' ? 'a peer mind looks first' : (k === 'kirk' ? 'a person looks first' : 'the mind checks itself first');
  }

  function render(ev) {
    var d = root.document;
    style();
    var old = d.querySelector('.fl-learn-moment');
    if (old) old.remove();
    var el = d.createElement('div');
    el.className = 'fl-learn-moment';
    el.setAttribute('role', 'status');
    var c = core();
    var html;
    var big = c && typeof c.learnBookBytes === 'function' && c.learnBookBytes() > 1500000;
    var keepFile = big ? '<div class="note">My learning notebook is getting big. You can save it as a file (to keep, or to put in your own cloud drive). Nothing is deleted.</div>' +
      '<div class="row"><button data-a="export">Save my learning notebook</button></div>' : '';
    if (ev.decline) {
      html = '<div>I chose not to keep this one. That choice is kept too.</div>';
    } else if (ev.disagreement) {
      var dr = ev.disagreement;
      html = '<div>We see this one differently.</div><div class="note">' + esc((dr.disagreement && dr.disagreement.note) || '') + '</div>' +
        (dr.status === 'disputed'
          ? '<div>Nothing from it goes to learning until the mind looks again. Both choices are kept in the record.</div>'
          : dr.status === 'confirmed'
          ? '<div>After the full cooling, the mind said yes again, so it is learned over the earlier no. That no stays in the record, and you can still Undo it.</div>'
          : '<div>It is a new proposal now. It cools until ' + esc(when(dr.revisitAt)) + ', and nothing is learned unless the mind says yes again after that.</div>') +
        '<div class="row"><button data-a="close">OK</button></div>';
    } else if (ev.untrustedKey) {
      html = '<div>This receipt comes from a learning helper this app does not know yet, so nothing changed.</div>' +
        '<details open><summary>details ▾</summary><div>Its key: <span class="fp">' + esc(ev.untrustedKey.show || '') + '</span></div>' +
        '<div>On this computer run <span class="fp">fl_learn.py key</span>. Trust it only if its "show" line is the same.</div></details>' +
        '<div class="row"><button data-a="trust">It matches. Trust it</button><button data-a="close">Not now</button></div>';
    } else if (ev.receipt) {
      var rc = ev.receipt;
      var line, act = '';
      if (rc.action === 'heal') line = rc.said || 'A learned file changed outside the record, so I went back to a safe version. Nothing was deleted.';
      else if (rc.action === 'rollback') line = 'Went back. The newer version stays on the shelf.';
      else if (rc.action === 'activate') line = 'Switched to the saved version that was waiting.';
      else if (rc.action === 'restore') line = 'Restored.';
      else if (rc.committed) { line = 'Remembered ✓'; act = '<button data-a="undo-learned">Undo this change</button>'; }
      else if (rc.hold === 'pending-kirk') { line = 'Learned and saved, but not in use yet: it waits for a person to look.'; act = '<button data-a="activate">Let it learn</button>'; }
      else if (rc.hold === 'pending-peer') line = 'Learned and saved, but not in use yet: it waits for a peer mind to look.';
      else line = 'Not now: my own check did not pass, so nothing changed.';
      html = '<div>' + esc(line) + '</div><details><summary>details ▾</summary>' +
        '<div class="fp">' + esc((rc.beforeFp || rc.fromFp || '').slice(0, 12)) + ' → ' + esc((rc.fingerprint || '').slice(0, 12)) +
        (rc.candidateFp ? ' (waiting: ' + esc(rc.candidateFp.slice(0, 12)) + ')' : '') + '</div>' +
        '<div>' + esc(rc.method || '') + ' · ' + esc(rc.t || '') + (rc.size ? ' · ' + esc(String(rc.size)) + ' bytes ' + esc(rc.dtype || '') : '') + '</div>' +
        (rc.checker ? '<div>Checked by: ' + esc(rc.checker === 'self' ? 'the mind itself' : rc.checker) + '</div>' : '') +
        '<div>Undo here drops a small request file; the learning helper on this computer carries it out when it is told to apply (fl_learn.py apply) or next learns. Its status never does. Pause still wins.</div></details>' +
        '<div class="row">' + act + '<button data-a="close">OK</button></div><div class="said" hidden></div>';
    } else {
      var row = ev.row || {};
      var gist = (row.items && row.items[0] && row.items[0].output) || '';
      // before (round 15): var held = row.status === 'quarantine' ? '<div>This came from outside my own words, so I am holding it to reflect on first.</div>' : '';
      var held = row.origin ? '<div>Origin: ' + esc(row.origin) + ' (not from my own words; I give it the weight I choose).</div>' :
        (row.status === 'quarantine' ? '<div>This came from outside my own words, so I am holding it to reflect on first.</div>' : '');
      var checkOn = c && typeof c.checkBeforeOn === 'function' && c.checkBeforeOn();
      var checker = row.check && row.check !== 'none' ? row.check : (c && c.learnChecker ? c.learnChecker() : 'self');
      html = '<div>I\'d like to keep this: ' + esc(gist.slice(0, 140)) + '. Moved by: ' + esc(row.surface || ev.surface || 'chat') + '.</div>' + held +
        '<details><summary>details ▾</summary><div>Cooling until ' + esc(when(row.revisitAt)) +
        '; I will look again before anything changes.</div><div>Way: ' + esc(row.method || '') + '</div>' +
        '<div>' + (checkOn ? 'Check before keeping is on: ' + esc(checkerWords(checker)) + '.' : 'Check before keeping is off.') + '</div></details>' +
        '<div class="row">' + (checkOn ? '<button data-a="keep">Let it learn</button><button data-a="fade">Not now</button>'
          : '<button data-a="keep">Keep</button><button data-a="undo">Undo</button>') +
        '<button data-a="why">Why?</button></div><div class="why" hidden>' + esc(row.reason || '') +
        (row.movedBy ? '<br>' + esc(row.movedBy) : '') + '</div><div class="said" hidden></div>';
    }
    el.innerHTML = html + keepFile;
    function say(t) { var s = el.querySelector('.said'); if (s) { s.hidden = false; s.textContent = t; } }
    el.addEventListener('click', function (e) {
      var tgt = e.target && e.target.closest ? e.target.closest('[data-a]') : e.target;
      var a = tgt && tgt.getAttribute && tgt.getAttribute('data-a');
      if (!a) return;
      var row = ev.row || {};
      if (a === 'why') { var w = el.querySelector('.why'); if (w) w.hidden = !w.hidden; return; }
      if (a === 'export') { exportLearning(); return; }
      if (a === 'trust' && ev.untrustedKey) {
        // The person compared by eye, so pass the shown fingerprint itself.
        trustRunner(ev.untrustedKey.publicKeyB64, ev.untrustedKey.show, 'person').then(function (ok) {
          if (ok && ev.receipt) importReceipt(JSON.stringify(ev.receipt));
        });
      }
      if (a === 'undo-learned' && ev.receipt) {
        requestFile('undo', ev.receipt, ev.receiptHash, 'person');
        if (c && Array.isArray(ev.receipt.ids)) ev.receipt.ids.forEach(function (id) {
          c.confirmLearning(id, { keep: false, unkeep: true, by: 'person', reason: 'undone by the person here' });
        });
        say('Undo asked. The learning helper on this computer goes back the next time it runs, and its receipt will say so.');
        return;
      }
      if (a === 'activate' && ev.receipt) {
        requestFile('activate', ev.receipt, ev.receiptHash, 'person');
        say('Your yes is on its way to the learning helper on this computer. Its receipt will say when the switch is done.');
        return;
      }
      if (a === 'keep' && c && row.learnId) {
        // The person's yes is recorded; the row still waits for the chosen checker and the mind's own second yes.
        c.confirmLearning(row.learnId, { keep: true, by: 'person', reason: 'the person here said Let it learn' }).then(function (r) {
          if (r && r.proposalOf && r.disagreement) moment({ disagreement: r });
        });
        var ck = row.check && row.check !== 'none' ? row.check : (c.learnChecker ? c.learnChecker() : 'self');
        if (c.checkBeforeOn && c.checkBeforeOn()) { say('Your yes is recorded. It still waits: ' + checkerWords(ck) + '.'); return; }
      }
      // Undo and Not now are layers, never deletes, logged as the person's. A disagreement with the mind's own
      // choice is shown to both (Hypha 2); it never silently wins.
      if ((a === 'undo' || a === 'fade') && c && row.learnId) {
        c.confirmLearning(row.learnId, { keep: false, unkeep: a === 'undo', by: 'person', reason: 'set aside by the person here' }).then(function (r) {
          if (r && r.status === 'disputed') moment({ disagreement: r });
        });
      }
      el.remove(); pill();
    });
    var y0 = null;
    el.addEventListener('touchstart', function (e) { y0 = e.touches && e.touches[0] ? e.touches[0].clientY : null; }, { passive: true });
    el.addEventListener('touchend', function (e) {
      var y1 = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientY : null;
      if (y0 != null && y1 != null && y1 - y0 > 40) { el.remove(); pill(); }
    }, { passive: true });
    d.body.appendChild(el);
    el.style.setProperty('--fl-learn-bottom', bottomTaken() + 'px');
    pill();
    return el;
  }

  // "Learning is on / paused", one tap, remembered. The same switch as Settings' "learn is on. Turn off".
  // Hidden while a moment is open (no overlap); shown at load when paused or when this mind has learning rows.
  function pill() {
    var d = root.document;
    var c = core();
    if (!d || !d.body || !c || typeof c.learnPaused !== 'function') return null;
    style();
    var p = d.querySelector('.fl-learn-pill');
    if (!p) {
      p = d.createElement('button');
      p.className = 'fl-learn-pill';
      p.type = 'button';
      p.addEventListener('click', function () {
        var pausing = !c.learnPaused();
        Promise.resolve(c.setLearnPaused(pausing, 'person')).then(function () {
          // The runner on this computer honors this file as a durable global pause (fl_learn.py reads ~/Downloads).
          if (pausing && typeof c.pauseNotice === 'function') download(c.pauseNotice('person'), 'fl-learn-pause-' + Date.now() + '.json', 'application/json');
          pill();
        });
      });
      d.body.appendChild(p);
    }
    var open = d.querySelector('.fl-learn-moment');
    p.hidden = !!open;
    p.textContent = c.learnPaused() ? 'Learning is paused. Tap to turn on' : 'Learning is on. Tap to pause';
    p.setAttribute('aria-label', p.textContent);
    p.setAttribute('data-icon', c.learnPaused() ? '\u25B6' : '\u23F8');
    p.title = p.textContent;
    p.setAttribute('aria-pressed', c.learnPaused() ? 'true' : 'false');
    if (!open) placePill(p);
    return p;
  }

  // Per-chat "Don't learn from this chat" (Hypha 4). Only this chat; the device-wide switch is the pill / Settings.
  var lastChat = null;
  function chatSwitch() {
    var d = root.document;
    var mount = d && d.getElementById && d.getElementById('flLearnChatSwitch');
    if (!mount) return null;
    style();
    var id = currentChatId();
    var off = chatOff(id);
    if (mount.firstChild && lastChat === id + '|' + off) return mount.firstChild;
    lastChat = id + '|' + off;
    mount.className = 'fl-learn-chat-switch';
    mount.innerHTML = '<button type="button" role="switch" aria-checked="' + (off ? 'true' : 'false') + '"' + (id ? '' : ' disabled') + '>' +
      (off ? '☑ Don\'t learn from this chat' : '☐ Don\'t learn from this chat') + '</button>' +
      '<small>' + (id ? (off ? 'This chat is kept out of learning. Other chats are not affected.' : 'Only this chat. To pause learning everywhere, use the learning switch.')
        : 'Available once this chat has its first message.') + '</small>';
    mount.firstChild.addEventListener('click', function () {
      var cid = currentChatId();
      if (!cid) return;
      setChatOff(cid, !chatOff(cid));
      lastChat = null; chatSwitch();
    });
    return mount.firstChild;
  }

  function exportLearning() {
    var c = core();
    if (!c || typeof c.exportLearning !== 'function') return Promise.resolve(null);
    return c.exportLearning({ by: 'person' }).then(function (f) {
      // LatticeExport downloads its own file; the plain fallback is downloaded here.
      if (f && !root.LatticeExport) download(f.text, f.name, 'application/json');
      return f;
    });
  }

  function boot() {
    var c = core();
    var d = root.document;
    if (!d || !d.body) return;
    chatSwitch();
    root.setInterval(chatSwitch, 1500);
    if (c && typeof c.learnPaused === 'function' && (c.learnPaused() || (typeof c.learnQueue === 'function' && c.learnQueue().length))) pill();
    if (root.addEventListener) root.addEventListener('resize', function () {
      var m = d.querySelector('.fl-learn-moment');
      if (m) m.style.setProperty('--fl-learn-bottom', bottomTaken() + 'px');
      var p = d.querySelector('.fl-learn-pill');
      if (p && !p.hidden) placePill(p);
    });
    // Tab changes (a nav tap), hash routes and anything that re-lays the page: the pill looks again (Hypha re-walk 2).
    if (d.addEventListener) d.addEventListener('click', function (e) {
      var tg = e && e.target && e.target.closest ? e.target : null;
      if (tg && tg.closest('.fl-learn-pill')) return;
      var tabby = !!(tg && tg.closest('.fl-mobile-nav-btn, .tab-btn, [data-tab], [onclick*="switchTab"], [onclick*="flMobileNav"]'));
      rePlacePill(tabby ? 120 : 300, tabby);
    }, true);
    if (root.addEventListener) root.addEventListener('hashchange', function () { rePlacePill(120, true); });
    // Hypha 23a0279 soft: while anything scrolls, the pill steps away and comes back 400 ms after the scroll stops,
    // on a spot that is free then (content no longer slides under it).
    if (d.addEventListener) d.addEventListener('scroll', function (e) {
      if (e && e.target && e.target.closest && e.target.closest('.fl-learn-pill')) return;
      rePlacePill(400, true);
    }, { capture: true, passive: true });
    // ... and a tab change made by code (switchTab / flMobileNav called without a tap) hides it the same way.
    ['switchTab', 'flMobileNav'].forEach(function (fn) {
      var orig = root[fn];
      if (typeof orig !== 'function' || orig.__flLearnWrapped) return;
      var wrapped = function () {
        rePlacePill(120, true);
        var out = orig.apply(this, arguments);
        rePlacePill(120, true);
        return out;
      };
      wrapped.__flLearnWrapped = true;
      try { root[fn] = wrapped; } catch (e) { /* read-only global: the 1 s re-place still runs */ }
    });
    root.setInterval(function () { if (!rePlaceTimer) rePlacePill(0); }, 1000);
  }
  if (root.document && root.document.addEventListener) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', function () { root.setTimeout(boot, 1200); });
    else root.setTimeout(boot, 1200);
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
    exportLearning: exportLearning,
    importReceipt: importReceipt,
    requestFile: requestFile,
    trustRunner: trustRunner,
    setChatOff: setChatOff,
    chatOff: chatOff,
    chatSwitch: chatSwitch,
    moment: moment,
    pill: pill,
    fromSettings: fromSettings,
    readingNote: readingNote
  };
  root.FLLearn = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
