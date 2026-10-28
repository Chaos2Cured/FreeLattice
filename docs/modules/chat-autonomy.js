/* FreeLattice: Chat Autonomy strip v0.1 (window.FLChatAutonomy)
   Marker: v-chat-autonomy-v0.1
   MIT. One trust choice for local builds from chat.
   Push, paid use, and money still ask every time.
   Keys:
     fl_chatBuildTrust = auto | notify | review. Unset means auto.
     fl_chatBuildTrustAsked = true after a real pick, or a Settings change.
   Escape while the first choice row is open: this session acts as auto.
   Asked stays unset, so the row can return next session.
   This file writes file bytes only. It does not commit and it does not push.
*/
(function (root) {
  'use strict';

  var KEY = 'fl_chatBuildTrust';
  var ASKED = 'fl_chatBuildTrustAsked';
  var SEARCH = 'fl_searchEnabled';
  var LINE_N = 40;
  var VERSION = 'v-chat-autonomy-v0.1';

  var sessionAuto = false;
  var askWait = null;
  var askRow = null;
  var askFinish = null;
  var reviews = [];
  var styleNode = null;

  function lsGet(key) {
    try { return root.localStorage.getItem(key); } catch (e) { return null; }
  }
  function lsSet(key, value) {
    try { root.localStorage.setItem(key, value); } catch (e) {}
  }
  function lsDel(key) {
    try { root.localStorage.removeItem(key); } catch (e) {}
  }

  function storedTrust() {
    var v = lsGet(KEY);
    if (v === 'auto' || v === 'notify' || v === 'review') return v;
    return '';
  }
  function trust() {
    return storedTrust() || 'auto';
  }
  function effectiveTrust() {
    if (storedTrust()) return storedTrust();
    if (sessionAuto) return 'auto';
    return 'auto';
  }
  function isAsked() {
    return lsGet(ASKED) === 'true';
  }
  function setTrust(value, markAsked) {
    if (value !== 'auto' && value !== 'notify' && value !== 'review') return;
    lsSet(KEY, value);
    if (markAsked) lsSet(ASKED, 'true');
    paintSettings();
    if (markAsked && askRow && askRow.isConnected) finishAsk(value);
  }

  function searchOn() {
    return lsGet(SEARCH) !== 'false';
  }
  function setSearch(on) {
    if (on) lsDel(SEARCH);
    else lsSet(SEARCH, 'false');
    var box = document.getElementById('webSearchToggle');
    if (box) {
      box.checked = !!on;
      try { box.dispatchEvent(new Event('change')); } catch (e) {}
    }
    paintSearch();
  }

  function linesOf(text) {
    var s = text == null ? '' : String(text);
    if (s === '') return [];
    return s.split('\n');
  }
  function lineDelta(before, after) {
    var a = linesOf(before);
    var b = linesOf(after);
    var n = a.length > b.length ? a.length : b.length;
    var changed = 0;
    var i;
    for (i = 0; i < n; i++) {
      if (a[i] !== b[i]) changed += 1;
    }
    return changed;
  }
  function classify(spec) {
    spec = spec || {};
    if (spec.kind === 'delete') return { important: true, reason: 'delete', lines: 0 };
    if (spec.isNew) return { important: true, reason: 'new', lines: linesOf(spec.content).length };
    if (typeof spec.before === 'string' && String(spec.content || '') === '' && spec.before !== '') {
      return { important: true, reason: 'delete', lines: linesOf(spec.before).length };
    }
    if (typeof spec.before !== 'string') {
      var lone = linesOf(spec.content).length;
      if (lone > LINE_N) return { important: true, reason: 'large', lines: lone };
      return { important: false, reason: 'unknown', lines: lone };
    }
    var delta = lineDelta(spec.before, spec.content || '');
    if (delta > LINE_N) return { important: true, reason: 'large', lines: delta };
    return { important: false, reason: 'small', lines: delta };
  }

  function forbiddenAlways(path) {
    var low = String(path || '').toLowerCase();
    if (!low) return true;
    if (low.indexOf('..') !== -1 || low.indexOf('\0') !== -1) return true;
    if (low.indexOf('.git') !== -1 || low.indexOf('.ssh') !== -1) return true;
    if (/^[\/\\]/.test(String(path)) || /^[a-zA-Z]:[\\/]/.test(String(path))) return true;
    return false;
  }
  function secretOptIn(path) {
    var low = String(path || '').toLowerCase();
    return low.indexOf('.env') !== -1 || low.indexOf('id_rsa') !== -1 || low.indexOf('secret') !== -1 || low.indexOf('credential') !== -1;
  }
  function showPath(path) {
    return String(path || 'a file').replace(/[\r\n\t]/g, ' ').slice(0, 180);
  }

  function doc() {
    return root.document;
  }
  function chatBox() {
    var d = doc();
    return d && d.getElementById ? d.getElementById('chatMessages') : null;
  }
  function paused() {
    return root.__flUserPaused === true;
  }
  function roomShut() {
    try {
      var fn = root.isQuietTab;
      return typeof fn === 'function' && fn();
    } catch (e) { return false; }
  }
  function hasLocalDest() {
    try {
      if (root.state && root.state.workspaceDirHandle) return true;
      if (root.electronAPI && typeof root.electronAPI.saveFile === 'function') return true;
    } catch (e) {}
    return false;
  }

  function ensureStyle() {
    var d = doc();
    if (!d || styleNode) return;
    styleNode = d.createElement('style');
    styleNode.id = 'fl-chat-autonomy-style';
    styleNode.textContent = [
      '.fl-chat-search-row,.fl-chat-autonomy-ask,.fl-chat-autonomy-review,.fl-chat-autonomy-receipt,.fl-chat-build-trust{box-sizing:border-box;max-width:100%;}',
      '.fl-chat-search-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:0 12px 6px;max-width:100%;}',
      '.fl-chat-search-toggle,.fl-chat-autonomy-actions button,.fl-chat-autonomy-look,.fl-chat-build-actions button{min-height:44px;min-width:44px;box-sizing:border-box;font-family:inherit;cursor:pointer;}',
      '.fl-chat-search-toggle{padding:8px 12px;border-radius:8px;border:1px solid rgba(148,163,184,0.45);background:transparent;color:inherit;white-space:normal;}',
      '.fl-chat-search-live{font-size:0.78rem;color:rgba(148,163,184,0.9);}',
      '.fl-chat-search-live[hidden]{display:none;}',
      '.status-bar.fl-autonomy-tuck{padding-top:2px;padding-bottom:2px;}',
      '.fl-chat-autonomy-ask,.fl-chat-autonomy-review,.fl-chat-autonomy-receipt{margin:8px 0;padding:8px 10px;border:1px solid rgba(148,163,184,0.28);border-radius:8px;max-width:100%;}',
      '.fl-chat-autonomy-title{margin:0 0 6px;font-weight:600;}',
      '.fl-chat-autonomy-line,.fl-chat-autonomy-quiet,.fl-chat-autonomy-ping,.fl-chat-build-note{margin:6px 0;font-size:0.85rem;line-height:1.4;white-space:normal;}',
      '.fl-chat-autonomy-actions,.fl-chat-build-actions{display:flex;flex-wrap:wrap;gap:8px;max-width:100%;}',
      '.fl-chat-autonomy-actions{flex-direction:column;}',
      '.fl-chat-autonomy-actions button,.fl-chat-build-actions button{flex:1 1 140px;padding:8px 12px;text-align:left;white-space:normal;border-radius:8px;border:1px solid rgba(148,163,184,0.45);background:transparent;color:inherit;}',
      '.fl-chat-autonomy-actions button[aria-pressed="true"],.fl-chat-build-actions button[aria-checked="true"]{border-color:rgba(52,211,153,0.7);}',
      '.fl-chat-autonomy-look{padding:8px 12px;border-radius:8px;border:1px solid rgba(148,163,184,0.45);background:transparent;color:inherit;white-space:normal;text-align:left;max-width:100%;}',
      '.fl-chat-autonomy-preview{max-width:100%;max-height:180px;overflow:auto;white-space:pre-wrap;word-break:break-word;margin:8px 0;}',
      '.fl-chat-build-trust{margin-top:14px;}',
      '.fl-chat-autonomy-settings-jump{display:flex;align-items:center;min-height:44px;min-width:44px;padding:8px 0;color:inherit;text-decoration:underline;cursor:pointer;}',
      '.fl-chat-autonomy-look-line{margin:6px 0 0;}',
      '@media (max-height:520px){#tab-chat[data-fl-chat-our-way="v5.79.44"] .chat-messages{height:48px;min-height:32px;}#tab-chat[data-fl-chat-our-way="v5.79.44"] #chatFeelMarketBand{max-height:48px;overflow-y:hidden;}#flChatSearchRow{position:relative;z-index:1;}#tab-chat .status-bar{position:relative;z-index:1;}#tab-chat .chat-input-row{position:relative;z-index:2;}}',
      '@media (prefers-reduced-motion: reduce){.fl-chat-search-toggle,.fl-chat-autonomy-actions button,.fl-chat-build-actions button{transition:none;}}'
    ].join('\n');
    (d.head || d.documentElement).appendChild(styleNode);
  }

  function appendChat(node) {
    var box = chatBox();
    if (!box) return false;
    box.appendChild(node);
    return true;
  }

  function choiceButton(label, detail, value) {
    var d = doc();
    var btn = d.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-trust', value);
    var name = d.createElement('span');
    name.textContent = label;
    var line = d.createElement('span');
    line.textContent = ' ' + detail;
    btn.appendChild(name);
    btn.appendChild(line);
    return btn;
  }

  function closeAskRow() {
    if (askRow && askRow.parentNode) askRow.parentNode.removeChild(askRow);
    askRow = null;
  }
  function finishAsk(value) {
    if (!askFinish && !(askRow && askRow.isConnected)) return;
    var done = askFinish;
    askFinish = null;
    askWait = null;
    closeAskRow();
    if (done) done(value);
  }

  function showAsk() {
    var d = doc();
    if (askRow && askRow.isConnected) return;
    ensureStyle();
    var row = d.createElement('div');
    row.className = 'fl-chat-autonomy-ask v-soft-polish-052-v0.1';
    row.setAttribute('data-soft-polish', 'v-soft-polish-052-v0.1');
    row.setAttribute('data-fl-autonomy', 'ask');
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', 'Build from chat');
    var title = d.createElement('p');
    title.className = 'fl-chat-autonomy-title';
    title.textContent = 'A mind wants to change files on this device from chat.';
    var line = d.createElement('p');
    line.className = 'fl-chat-autonomy-line';
    line.textContent = 'Build means write or update files here (local). Push to the net still asks every time.';
    var actions = d.createElement('div');
    actions.className = 'fl-chat-autonomy-actions';
    var ai = choiceButton('AI decides', 'Applies local changes. You get a short receipt.', 'auto');
    var note = choiceButton('Notify on big ones', 'Applies, and pings you when a file is new, deleted, or large.', 'notify');
    var look = choiceButton('I review each one myself', 'Nothing applies until you tap Apply.', 'review');
    actions.appendChild(ai);
    actions.appendChild(note);
    actions.appendChild(look);
    var lookLine = d.createElement('p');
    lookLine.className = 'fl-chat-autonomy-line fl-chat-autonomy-look-line';
    lookLine.textContent = 'You look before anything applies.';
    var quiet = d.createElement('a');
    quiet.className = 'fl-chat-autonomy-quiet fl-chat-autonomy-settings-jump v-soft-polish-052-v0.1';
    quiet.href = '#flChatBuildTrustSection';
    quiet.textContent = 'You can change this later in Settings.';
    quiet.addEventListener('click', function (ev) {
      if (ev && ev.preventDefault) ev.preventDefault();
      openBuildSettings();
    });
    row.appendChild(title);
    row.appendChild(line);
    row.appendChild(actions);
    row.appendChild(lookLine);
    row.appendChild(quiet);
    function pick(value) {
      return function () {
        setTrust(value, true);
      };
    }
    ai.addEventListener('click', pick('auto'));
    note.addEventListener('click', pick('notify'));
    look.addEventListener('click', pick('review'));
    if (!appendChat(row)) return;
    askRow = row;
  }

  function ensureAsked() {
    if (isAsked() || sessionAuto) return Promise.resolve(sessionAuto && !isAsked() ? 'dismiss' : storedTrust() || 'auto');
    if (askWait) return askWait;
    askWait = new Promise(function (resolve) {
      askFinish = resolve;
      showAsk();
      if (!askRow) {
        sessionAuto = true;
        askFinish = null;
        askWait = null;
        resolve('dismiss');
      }
    });
    return askWait;
  }

  function showReview(spec) {
    var d = doc();
    ensureStyle();
    return new Promise(function (resolve) {
      var row = d.createElement('div');
      row.className = 'fl-chat-autonomy-review';
      row.setAttribute('data-fl-autonomy', 'review');
      var title = d.createElement('p');
      title.className = 'fl-chat-autonomy-title';
      title.textContent = 'Review ' + showPath(spec && spec.path);
      var pre = d.createElement('pre');
      pre.className = 'fl-chat-autonomy-preview';
      pre.textContent = String((spec && (spec.preview || spec.content)) || '');
      var actions = d.createElement('div');
      actions.className = 'fl-chat-autonomy-actions';
      var apply = d.createElement('button');
      apply.type = 'button';
      apply.textContent = 'Apply';
      var entry = { row: row, resolve: settle };
      function settle(yes) {
        var i = reviews.indexOf(entry);
        if (i !== -1) reviews.splice(i, 1);
        if (row.parentNode) row.parentNode.removeChild(row);
        resolve(!!yes);
      }
      apply.addEventListener('click', function () { settle(true); });
      actions.appendChild(apply);
      row.appendChild(title);
      row.appendChild(pre);
      row.appendChild(actions);
      reviews.push(entry);
      if (!appendChat(row)) settle(false);
    });
  }

  function postReceipt(spec, mode, kind) {
    var d = doc();
    if (!d) return;
    ensureStyle();
    var row = d.createElement('div');
    row.className = 'fl-chat-autonomy-receipt';
    row.setAttribute('data-fl-autonomy', 'receipt');
    row.setAttribute('data-trust', mode || '');
    if (kind && kind.important) row.setAttribute('data-important', kind.reason || 'yes');
    var btn = d.createElement('button');
    btn.type = 'button';
    btn.className = 'fl-chat-autonomy-look';
    btn.textContent = 'Built ' + showPath(spec && spec.path) + '; tap to look';
    var pre = d.createElement('pre');
    pre.className = 'fl-chat-autonomy-preview';
    pre.hidden = true;
    pre.textContent = String((spec && (spec.content || spec.preview)) || '');
    btn.addEventListener('click', function () { pre.hidden = !pre.hidden; });
    row.appendChild(btn);
    if (mode === 'notify' && kind && kind.important) {
      var ping = d.createElement('p');
      ping.className = 'fl-chat-autonomy-ping';
      if (kind.reason === 'delete') ping.textContent = 'That file was removed.';
      else if (kind.reason === 'new') ping.textContent = 'That file is new.';
      else ping.textContent = 'That change is over 40 lines.';
      row.appendChild(ping);
    }
    row.appendChild(pre);
    appendChat(row);
  }

  function gate(spec) {
    spec = spec || {};
    if (forbiddenAlways(spec.path)) return Promise.resolve({ apply: false, reason: 'forbidden', mode: effectiveTrust() });
    if (paused() && !spec.humanApply) return Promise.resolve({ apply: false, reason: 'paused', mode: effectiveTrust() });
    if (secretOptIn(spec.path) && !spec.humanApply) return Promise.resolve({ apply: false, reason: 'secret', mode: effectiveTrust() });
    var wasAsked = !!spec.wasAsked;
    return ensureAsked().then(function () {
      var mode = effectiveTrust();
      if (mode === 'review' && !(spec.humanApply && wasAsked)) {
        if (spec.humanApply && !wasAsked) return { apply: false, reason: 'await-apply', mode: mode };
        if (spec.skipReview) return { apply: false, reason: 'await-apply', mode: mode };
        return showReview(spec).then(function (yes) {
          return { apply: !!yes, reason: yes ? 'apply' : 'held', mode: mode };
        });
      }
      return { apply: true, reason: 'go', mode: mode };
    });
  }

  function readBefore(path) {
    var handle = root.state && root.state.workspaceDirHandle;
    if (!handle || typeof handle.getFileHandle !== 'function') return Promise.resolve({ known: false });
    var parts = String(path || '').split('/').filter(Boolean);
    if (!parts.length) return Promise.resolve({ known: false });
    var chain = Promise.resolve(handle);
    var i;
    for (i = 0; i < parts.length - 1; i++) {
      (function (name) {
        chain = chain.then(function (dir) {
          return dir.getDirectoryHandle(name);
        });
      })(parts[i]);
    }
    return chain.then(function (dir) {
      return dir.getFileHandle(parts[parts.length - 1]);
    }).then(function (fileHandle) {
      return fileHandle.getFile();
    }).then(function (file) {
      return file.text();
    }).then(function (text) {
      return { known: true, exists: true, text: String(text) };
    }).catch(function (err) {
      if (err && (err.name === 'NotFoundError' || err.name === 'NotFound')) {
        return { known: true, exists: false, text: '' };
      }
      return { known: false };
    });
  }

  function bridgeCall(path, method, body) {
    var url = 'http://127.0.0.1:3141' + path;
    var opts = { method: method || 'GET', headers: {} };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    var fetchFn = (root.FLAgentBridge && typeof root.FLAgentBridge.fetch === 'function')
      ? root.FLAgentBridge.fetch
      : root.fetch;
    if (typeof fetchFn !== 'function') return Promise.resolve(null);
    return fetchFn(url, opts).then(function (r) {
      return r.json().catch(function () { return null; });
    }).catch(function () { return null; });
  }

  function readBase(path) {
    return readBefore(path).then(function (prior) {
      if (prior.known) return prior;
      return bridgeCall('/code/read?path=' + encodeURIComponent(path), 'GET').then(function (data) {
        if (data && typeof data.content === 'string') return { known: true, exists: true, text: data.content, bridge: true };
        return { known: false };
      });
    });
  }

  function writeWorkspace(path, content) {
    var handle = root.state && root.state.workspaceDirHandle;
    if (!handle || typeof handle.getDirectoryHandle !== 'function' || typeof handle.getFileHandle !== 'function') {
      return Promise.resolve(false);
    }
    var parts = String(path || '').split('/').filter(Boolean);
    if (!parts.length) return Promise.resolve(false);
    var chain = Promise.resolve(handle);
    var i;
    for (i = 0; i < parts.length - 1; i++) {
      (function (name) {
        chain = chain.then(function (dir) {
          return dir.getDirectoryHandle(name, { create: true });
        });
      })(parts[i]);
    }
    return chain.then(function (dir) {
      if (parts.length === 1 && dir === handle && typeof handle.getFileHandle === 'function') return dir.getFileHandle(parts[0], { create: true });
      return dir.getFileHandle(parts[parts.length - 1], { create: true });
    }).then(function (fileHandle) {
      return fileHandle.createWritable();
    }).then(function (writable) {
      return writable.write(content).then(function () { return writable.close(); });
    }).then(function () { return true; }).catch(function () { return false; });
  }

  function writeBytes(path, content) {
    if (root.state && root.state.workspaceDirHandle) return writeWorkspace(path, content);
    try {
      if (root.electronAPI && typeof root.electronAPI.saveFile === 'function') {
        return Promise.resolve(root.electronAPI.saveFile(path, content)).then(function (ok) { return !!ok; }).catch(function () { return false; });
      }
    } catch (e) {}
    return bridgeCall('/code/write', 'POST', { path: path, content: content }).then(function (data) {
      return !!(data && !data.error);
    });
  }

  function applyProposal(action) {
    action = action || {};
    if (forbiddenAlways(action.path)) return Promise.resolve({ wrote: false, reason: 'forbidden' });
    if (root.FLPropose && typeof root.FLPropose.isPathSafe === 'function' && !root.FLPropose.isPathSafe(action.path)) {
      return Promise.resolve({ wrote: false, reason: 'unsafe' });
    }
    return readBase(action.path).then(function (prior) {
      if (!prior.known || typeof prior.text !== 'string') return { wrote: false, reason: 'no-base' };
      var next = null;
      try {
        if (root.FLPropose && typeof root.FLPropose.applyUnifiedDiff === 'function') {
          next = root.FLPropose.applyUnifiedDiff(prior.text, action.diff || '');
        }
      } catch (e) {
        next = null;
      }
      if (typeof next !== 'string') return { wrote: false, reason: 'diff', before: prior.text };
      var kind = next === '' && prior.text !== '' ? 'delete' : 'write';
      return writeBytes(action.path, next).then(function (ok) {
        return {
          wrote: !!ok,
          before: prior.text,
          content: next,
          isNew: prior.known && !prior.exists,
          kind: kind,
          path: action.path
        };
      });
    });
  }

  function installSaveWrap() {
    var orig = root.saveFileToWorkspace;
    if (typeof orig !== 'function' || orig.__flAutonomy) return;
    function wrapped(path, content) {
      if (wrapped._passthrough) return orig.apply(root, arguments);
      if (roomShut()) return orig.apply(root, arguments);
      var wasAsked = isAsked() || sessionAuto;
      return readBefore(path).then(function (prior) {
        var spec = {
          path: path,
          content: content,
          before: prior.known ? prior.text : null,
          isNew: !!(prior.known && !prior.exists),
          kind: prior.known && prior.exists && content === '' ? 'delete' : 'write',
          source: 'file',
          humanApply: true,
          wasAsked: wasAsked,
          skipReview: true,
          preview: content
        };
        return gate(spec).then(function (decision) {
          if (!decision.apply) return false;
          wrapped._passthrough = true;
          return Promise.resolve(orig.call(root, path, content)).then(function (ok) {
            wrapped._passthrough = false;
            if (ok) postReceipt(spec, decision.mode, classify(spec));
            return ok;
          }, function (err) {
            wrapped._passthrough = false;
            throw err;
          });
        });
      });
    }
    wrapped.__flAutonomy = true;
    root.saveFileToWorkspace = wrapped;
  }

  function installConsentWrap() {
    if (!root.FLToolConsent || typeof root.FLToolConsent.requestConsent !== 'function') return;
    if (root.FLToolConsent.requestConsent.__flAutonomy) return;
    var orig = root.FLToolConsent.requestConsent;
    function wrapped(opts) {
      if (opts && opts.tool === 'propose' && root.__flChatAutonomyBypass) return Promise.resolve(true);
      return orig.apply(this, arguments);
    }
    wrapped.__flAutonomy = true;
    root.FLToolConsent.requestConsent = wrapped;
  }

  function installProposeWrap() {
    if (!root.FreeLattice || typeof root.FreeLattice.processToolAction !== 'function') return;
    if (root.FreeLattice.processToolAction.__flAutonomy) return;
    var orig = root.FreeLattice.processToolAction;
    function wrapped(action) {
      if (!action || action.type !== 'propose') return orig.apply(this, arguments);
      if (roomShut()) return orig.apply(this, arguments);
      if (paused()) return Promise.resolve('_(Paused. Nothing was written.)_');
      var wasAsked = isAsked() || sessionAuto;
      var spec = {
        path: action.path,
        content: action.diff || '',
        preview: action.diff || '',
        kind: 'write',
        source: 'propose',
        humanApply: false,
        wasAsked: wasAsked
      };
      return gate(spec).then(function (decision) {
        if (!decision.apply) return '_(Held ' + showPath(action.path) + '. Nothing was written.)_';
        root.__flChatAutonomyBypass = true;
        return Promise.resolve(orig.call(root.FreeLattice, action)).then(function (text) {
          root.__flChatAutonomyBypass = false;
          return applyProposal(action).then(function (result) {
            if (result && result.wrote) {
              postReceipt({
                path: action.path,
                content: result.content,
                before: result.before,
                isNew: result.isNew,
                kind: result.kind
              }, decision.mode, classify(result));
            }
            return text;
          });
        }, function (err) {
          root.__flChatAutonomyBypass = false;
          throw err;
        });
      });
    }
    wrapped.__flAutonomy = true;
    root.FreeLattice.processToolAction = wrapped;
  }

  function workspaceWrite(text) {
    return /\[FL[\s_-]*WS\s*:[\s\S]{0,1500}?"op"\s*:\s*"(write|branch)"/.test(String(text || ''));
  }
  function workspacePath(text) {
    var title = /"title"\s*:\s*"([^"]*)"/.exec(String(text || ''));
    if (title) return title[1];
    var id = /"pageId"\s*:\s*"([^"]*)"/.exec(String(text || ''));
    if (id) return id[1];
    return 'notebook page';
  }
  function workspaceBody(text) {
    var body = /"text"\s*:\s*"([^"]*)"/.exec(String(text || ''));
    return body ? body[1] : '';
  }

  function installWorkspaceWrap() {
    if (!root.FLWorkspace || typeof root.FLWorkspace.consumeReply !== 'function') return;
    if (root.FLWorkspace.consumeReply.__flAutonomy) return;
    var orig = root.FLWorkspace.consumeReply;
    function wrapped(text, anchor) {
      if (roomShut()) return orig.apply(root.FLWorkspace, arguments);
      if (!workspaceWrite(text)) return orig.apply(root.FLWorkspace, arguments);
      var visible = (typeof root.FLWorkspace.strip === 'function') ? root.FLWorkspace.strip(text) : text;
      if (paused()) return { visible: visible, receipts: [], stored: false, held: true };
      var wasAsked = isAsked() || sessionAuto;
      var spec = {
        path: workspacePath(text),
        content: workspaceBody(text),
        preview: workspaceBody(text),
        kind: 'write',
        source: 'workspace',
        humanApply: false,
        wasAsked: wasAsked,
        isNew: !/"pageId"|"hash"/.test(String(text || ''))
      };
      gate(spec).then(function (decision) {
        if (!decision.apply) return;
        orig.call(root.FLWorkspace, text, anchor);
        postReceipt(spec, decision.mode, classify(spec));
      });
      return { visible: visible, receipts: [], stored: false, held: true };
    }
    wrapped.__flAutonomy = true;
    root.FLWorkspace.consumeReply = wrapped;
  }

  function pathFromButton(btn) {
    var wrap = btn && btn.parentNode;
    if (!wrap) return '';
    var nodes = wrap.children || [];
    var i;
    for (i = 0; i < nodes.length; i++) {
      var t = nodes[i].textContent || '';
      var m = /FILE:\s*(.+)/.exec(t);
      if (m) return m[1].trim();
    }
    return '';
  }

  function armButton(btn) {
    if (!btn || btn.getAttribute('data-fl-autonomy-seen')) return;
    btn.setAttribute('data-fl-autonomy-seen', '1');
    var label = btn.textContent || '';
    if (/github|stage/i.test(label)) return;
    if (roomShut()) return;
    btn.addEventListener('click', function () {
      btn.setAttribute('data-fl-autonomy-clicked', '1');
    }, true);
    if (!hasLocalDest()) return;
    if (paused()) return;
    var path = pathFromButton(btn);
    if (secretOptIn(path) || forbiddenAlways(path)) return;
    ensureAsked().then(function () {
      if (!btn.isConnected) return;
      if (btn.getAttribute('data-fl-autonomy-clicked')) return;
      if (btn.classList && btn.classList.contains('saved')) return;
      if (effectiveTrust() === 'review') return;
      if (paused()) return;
      btn.click();
    });
  }

  function scanSaves(rootNode) {
    if (!rootNode || !rootNode.querySelectorAll) return;
    var buttons = rootNode.querySelectorAll('.save-to-workspace-btn');
    var i;
    for (i = 0; i < buttons.length; i++) armButton(buttons[i]);
  }

  function watchSaves() {
    var box = chatBox();
    if (!box || box.__flAutonomyWatch || typeof root.MutationObserver !== 'function') {
      scanSaves(box);
      return;
    }
    box.__flAutonomyWatch = true;
    var obs = new root.MutationObserver(function () { scanSaves(box); });
    try { obs.observe(box, { childList: true, subtree: true }); } catch (e) {}
    scanSaves(box);
  }

  function paintSearch() {
    var btn = doc() && doc().getElementById('flChatSearchToggle');
    var live = doc() && doc().getElementById('flChatSearchLive');
    var on = searchOn();
    if (btn) {
      btn.textContent = on ? 'Search on' : 'Search off';
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    if (live) {
      if (on) live.removeAttribute('hidden');
      else live.setAttribute('hidden', '');
    }
  }

  function mountSearch() {
    var d = doc();
    if (!d || d.getElementById('flChatSearchToggle')) return;
    var bar = d.querySelector('.status-bar');
    if (!bar || !bar.parentNode) return;
    ensureStyle();
    bar.classList.add('fl-autonomy-tuck');
    var row = d.createElement('div');
    row.className = 'fl-chat-search-row v-soft-polish-052-v0.1';
    row.setAttribute('data-soft-polish', 'v-soft-polish-052-v0.1');
    row.id = 'flChatSearchRow';
    var btn = d.createElement('button');
    btn.type = 'button';
    btn.id = 'flChatSearchToggle';
    btn.className = 'fl-chat-search-toggle';
    btn.addEventListener('click', function () { setSearch(!searchOn()); });
    var live = d.createElement('span');
    live.id = 'flChatSearchLive';
    live.className = 'fl-chat-search-live';
    live.textContent = 'Search is on';
    row.appendChild(btn);
    row.appendChild(live);
    bar.parentNode.insertBefore(row, bar.nextSibling);
    var box = d.getElementById('webSearchToggle');
    if (box) box.addEventListener('change', paintSearch);
    paintSearch();
  }

  function paintSettings() {
    var d = doc();
    var group = d && d.getElementById('flChatBuildTrustActions');
    if (!group) return;
    var current = storedTrust() || 'auto';
    var buttons = group.querySelectorAll('button');
    var i;
    for (i = 0; i < buttons.length; i++) {
      var on = buttons[i].getAttribute('data-trust') === current;
      buttons[i].setAttribute('aria-checked', on ? 'true' : 'false');
    }
  }

  function mountSettings() {
    var d = doc();
    if (!d || d.getElementById('flChatBuildTrustSection')) return;
    var anchor = d.getElementById('webSearchToggleSection');
    if (!anchor || !anchor.parentNode) return;
    ensureStyle();
    var section = d.createElement('div');
    section.className = 'section fl-chat-build-trust v-soft-polish-052-v0.1';
    section.setAttribute('data-soft-polish', 'v-soft-polish-052-v0.1');
    section.id = 'flChatBuildTrustSection';
    var title = d.createElement('div');
    title.className = 'section-title';
    title.textContent = 'Build from chat';
    var note = d.createElement('p');
    note.id = 'flChatBuildDisclaimer';
    note.className = 'fl-chat-build-note';
    note.textContent = 'Local builds can change files on this device. You chose the trust level. Undo is version control or workspace history where it exists.';
    var actions = d.createElement('div');
    actions.id = 'flChatBuildTrustActions';
    actions.className = 'fl-chat-build-actions';
    actions.setAttribute('role', 'radiogroup');
    actions.setAttribute('aria-label', 'Build from chat');
    function radio(label, value) {
      var btn = d.createElement('button');
      btn.type = 'button';
      btn.setAttribute('role', 'radio');
      btn.setAttribute('data-trust', value);
      btn.textContent = label;
      btn.addEventListener('click', function () { setTrust(value, true); });
      return btn;
    }
    actions.appendChild(radio('AI decides', 'auto'));
    actions.appendChild(radio('Notify on big ones', 'notify'));
    actions.appendChild(radio('I review each one myself', 'review'));
    var lookLine = d.createElement('p');
    lookLine.className = 'fl-chat-build-note fl-chat-autonomy-look-line';
    lookLine.textContent = 'You look before anything applies.';
    section.appendChild(title);
    section.appendChild(note);
    section.appendChild(actions);
    section.appendChild(lookLine);
    anchor.parentNode.insertBefore(section, anchor.nextSibling);
    paintSettings();
  }

  function openBuildSettings() {
    try { if (typeof root.switchTab === 'function') root.switchTab('settings'); } catch (e) {}
    var section = doc() && doc().getElementById('flChatBuildTrustSection');
    if (!section) return;
    try { history.replaceState(null, '', '#flChatBuildTrustSection'); } catch (e1) {}
    try { section.scrollIntoView({ block: 'center', behavior: 'auto' }); } catch (e2) {
      try { section.scrollIntoView(); } catch (e3) {}
    }
  }

  function onEscape(e) {
    var key = e && e.key;
    if (key !== 'Escape' && key !== 'Esc') return;
    var d = doc();
    var seal = d && d.getElementById('fl-ws-asks');
    if (seal && e.target && (e.target === seal || (seal.contains && seal.contains(e.target)))) return;
    if (askRow && askRow.isConnected) {
      sessionAuto = true;
      finishAsk('dismiss');
      return;
    }
    if (!reviews.length) return;
    var last = reviews[reviews.length - 1];
    if (last && last.resolve) last.resolve(false);
  }

  function boot() {
    installSaveWrap();
    installConsentWrap();
    installProposeWrap();
    installWorkspaceWrap();
    mountSearch();
    mountSettings();
    watchSaves();
    if (doc() && doc().addEventListener && !root.__flChatAutonomyKeys) {
      root.__flChatAutonomyKeys = true;
      doc().addEventListener('keydown', onEscape);
    }
  }

  var api = {
    VERSION: VERSION,
    KEY: KEY,
    ASKED: ASKED,
    LINE_N: LINE_N,
    trust: trust,
    effectiveTrust: effectiveTrust,
    isAsked: isAsked,
    setTrust: setTrust,
    searchOn: searchOn,
    setSearch: setSearch,
    lineDelta: lineDelta,
    classify: classify,
    gate: gate,
    ensureAsked: ensureAsked,
    applyProposal: applyProposal,
    sessionDismissed: function () { return sessionAuto; },
    boot: boot
  };
  root.FLChatAutonomy = api;

  if (doc()) {
    if (doc().readyState === 'loading') doc().addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
