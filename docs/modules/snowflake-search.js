// snowflake-search.js (MIT)
// v-snowflake-search-v0.1 v-snowflake-grow-v0.1 v-search-heal-v0.1
// The door, the crystal, Pause and Stop, and the report.
// chat-bottom-clarity.js stays locked. This file adds its own row.
(function (root) {
  'use strict';

  var core = root.FLSnowflakeCore;
  if (!core) return;

  var NS = 'http://www.w3.org/2000/svg';
  var MARK = 'v-snowflake-search-v0.1';
  var host = null;
  var input = null;
  var hunchEl = null;
  var statusEl = null;
  var crystal = null;
  var conclusionEl = null;
  var wrongEl = null;
  var receiptEl = null;
  var togetherBtn = null;
  var pauseBtn = null;
  var stopBtn = null;
  var resumeBtn = null;
  var growBtn = null;
  var card = null;
  var driftEl = null;
  var meterEl = null;
  var searchNote = null;
  var healHost = null;
  var healLine = null;
  var tryBtn = null;
  var lastQuery = '';
  var lastOpen = '';
  var lastFlakeId = '';
  var seedFrom = '';
  var view = { nodes: [], branches: [], thinking: '', hunch: '', on: false };
  var promptsShown = 0;

  function doc() { return root.document; }

  function el(tag, cls, text) {
    var node = doc().createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function btn(id, word, press) {
    var b = el('button', 'fl-snow-btn', word);
    b.type = 'button';
    b.id = id;
    b.addEventListener('click', press);
    return b;
  }

  function svgEl(tag, attrs) {
    var node = doc().createElementNS(NS, tag);
    var k;
    for (k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) node.setAttribute(k, attrs[k]);
    return node;
  }

  function icon() {
    var svg = svgEl('svg', { viewBox: '0 0 24 24', width: '22', height: '22', 'aria-hidden': 'true' });
    svg.classList.add('fl-snow-icon');
    var i;
    for (i = 0; i < 6; i++) {
      var a = (Math.PI / 3) * i - Math.PI / 2;
      svg.appendChild(svgEl('line', {
        x1: '12', y1: '12',
        x2: String(12 + Math.cos(a) * 9),
        y2: String(12 + Math.sin(a) * 9)
      }));
    }
    svg.appendChild(svgEl('circle', { cx: '12', cy: '12', r: '1.6' }));
    return svg;
  }

  function mountRow(menu) {
    var d = doc();
    if (!menu || !d) return null;
    if (menu.querySelector('#flSnowflakeAdd')) return menu.querySelector('#flSnowflakeAdd');
    var button = d.createElement('button');
    button.type = 'button';
    button.id = 'flSnowflakeAdd';
    button.className = 'fl-add-item';
    button.setAttribute('data-marker', MARK);
    button.setAttribute('aria-label', 'Snowflake');
    var copy = d.createElement('span');
    copy.className = 'fl-add-copy';
    var word = d.createElement('span');
    word.className = 'fl-add-word';
    word.textContent = 'Snowflake';
    copy.appendChild(word);
    button.appendChild(icon());
    button.appendChild(copy);
    var search = menu.querySelector('#flChatAddSearch');
    if (search && search.parentNode === menu) {
      if (search.nextSibling) menu.insertBefore(button, search.nextSibling);
      else menu.appendChild(button);
    } else menu.appendChild(button);
    button.addEventListener('click', function () {
      if (root.FLChatBottom && typeof root.FLChatBottom.close === 'function') {
        try { root.FLChatBottom.close(); } catch (e) {}
      }
      openAsk();
    });
    return button;
  }

  function watchMenu() {
    var d = doc();
    if (!d) return;
    function mount() {
      var menu = d.getElementById('flChatAddMenu');
      if (menu) mountRow(menu);
    }
    mount();
    if (!d.body || typeof root.MutationObserver !== 'function') return;
    var obs = new root.MutationObserver(function () { mount(); });
    try { obs.observe(d.body, { childList: true, subtree: true }); } catch (e) {}
  }

  function ensureHost() {
    var d = doc();
    if (!d || host) return host;
    host = el('section', 'fl-snow');
    host.id = 'flSnowflakeHost';
    host.setAttribute('data-marker', MARK);
    host.hidden = true;
    var title = el('h2', 'fl-snow-title', 'Snowflake');
    hunchEl = el('p', 'fl-snow-hunch', '');
    hunchEl.id = 'flSnowflakeHunch';
    statusEl = el('p', 'fl-snow-status', '');
    statusEl.id = 'flSnowflakeStatus';
    searchNote = el('p', 'fl-snow-search', '');
    searchNote.id = 'flSnowflakeSearchNote';
    searchNote.hidden = true;
    var ask = el('p', 'fl-snow-ask', 'What do you want to understand?');
    ask.id = 'flSnowflakeAsk';
    input = d.createElement('textarea');
    input.id = 'flSnowflakeInput';
    input.className = 'fl-snow-input';
    input.setAttribute('aria-label', 'What do you want to understand?');
    var row = el('div', 'fl-snow-controls');
    growBtn = btn('flSnowflakeGrow', 'Grow a snowflake', onGrow);
    pauseBtn = btn('flSnowflakePause', 'Pause', function () { core.pause(); });
    stopBtn = btn('flSnowflakeStop', 'Stop', function () { core.stop(); });
    resumeBtn = btn('flSnowflakeResume', 'Resume', function () {
      resumeBtn.hidden = true;
      pauseBtn.hidden = false;
      stopBtn.hidden = false;
      core.resume();
    });
    pauseBtn.hidden = true;
    stopBtn.hidden = true;
    resumeBtn.hidden = true;
    row.appendChild(growBtn);
    row.appendChild(pauseBtn);
    row.appendChild(resumeBtn);
    row.appendChild(stopBtn);
    conclusionEl = el('p', 'fl-snow-conclusion', '');
    conclusionEl.id = 'flSnowflakeConclusion';
    crystal = el('div', 'fl-snow-crystal');
    crystal.id = 'flSnowflakeCrystal';
    wrongEl = el('p', 'fl-snow-wrong', '');
    wrongEl.id = 'flSnowflakeWrong';
    receiptEl = el('p', 'fl-snow-receipt', '');
    receiptEl.id = 'flSnowflakeReceipt';
    receiptEl.hidden = true;
    togetherBtn = btn('flSnowflakeTogether', 'Want to grow this one together?', onTogether);
    togetherBtn.hidden = true;
    driftEl = el('p', 'fl-snow-drift', '');
    driftEl.id = 'flSnowflakeDrift';
    meterEl = el('p', 'fl-snow-meter', '');
    meterEl.id = 'flSnowflakeMeter';
    var back = btn('flSnowflakeRollback', 'Roll back to v1', onRollback);
    back.hidden = true;
    var rest = btn('flSnowflakeRest', 'Let this flake rest', onRest);
    rest.hidden = true;
    card = el('div', 'fl-snow-card');
    card.id = 'flSnowflakeCard';
    card.hidden = true;
    host.appendChild(title);
    host.appendChild(hunchEl);
    host.appendChild(statusEl);
    host.appendChild(searchNote);
    host.appendChild(ask);
    host.appendChild(input);
    host.appendChild(row);
    host.appendChild(conclusionEl);
    host.appendChild(crystal);
    host.appendChild(wrongEl);
    host.appendChild(receiptEl);
    host.appendChild(togetherBtn);
    host.appendChild(driftEl);
    host.appendChild(meterEl);
    host.appendChild(back);
    host.appendChild(rest);
    host.appendChild(card);
    var chat = d.getElementById('chatMessages');
    if (chat && chat.parentNode) chat.parentNode.insertBefore(host, chat);
    else d.body.appendChild(host);
    return host;
  }

  function ensureHeal() {
    var d = doc();
    if (!d) return null;
    if (healHost) return healHost;
    healHost = el('div', 'fl-snow-heal');
    healHost.id = 'flSnowflakeHeal';
    healLine = el('p', 'fl-snow-heal-line', '');
    healLine.id = 'flSnowflakeHealLine';
    tryBtn = btn('flSnowflakeTryAgain', 'Try again', function () {
      if (!lastQuery) return;
      showSearch(lastQuery);
      core.searchNow(lastQuery).then(function (res) { showSearchResult(res, lastQuery); });
    });
    tryBtn.hidden = true;
    healHost.appendChild(healLine);
    healHost.appendChild(tryBtn);
    var row = d.getElementById('flChatSearchRow');
    if (row && row.parentNode) row.parentNode.insertBefore(healHost, row.nextSibling);
    else if (host && host.parentNode) host.parentNode.insertBefore(healHost, host);
    else d.body.appendChild(healHost);
    return healHost;
  }

  function openAsk() {
    ensureHost();
    host.hidden = false;
    host.classList.add('is-frost');
    setTimeout(function () { if (host) host.classList.remove('is-frost'); }, 700);
    var box = doc().getElementById('chatInput');
    if (box && !input.value) input.value = box.value || '';
    paintMeter();
    try { input.focus(); } catch (e) {}
  }

  function onGrow() {
    var q = String(input.value || '').trim();
    if (!q) {
      statusEl.textContent = 'Tell me what you want to understand.';
      return;
    }
    promptsShown = 0;
    receiptEl.hidden = true;
    receiptEl.textContent = '';
    togetherBtn.hidden = true;
    conclusionEl.textContent = '';
    wrongEl.textContent = '';
    pauseBtn.hidden = false;
    stopBtn.hidden = false;
    resumeBtn.hidden = true;
    growBtn.hidden = true;
    view = { nodes: [], branches: core.FLOOR.slice(), thinking: 'd', hunch: '', on: true };
    paintFlake();
    core.startRun(q, { seedFrom: seedFrom }).then(function (result) { paintResult(result); });
  }

  function onTogether() {
    input.value = lastOpen || input.value;
    seedFrom = lastFlakeId;
    onGrow();
  }

  function onRollback() {
    var rows = core.adapterList();
    var version = 'v1';
    var i;
    for (i = rows.length - 1; i >= 0; i--) {
      if (rows[i] && rows[i].status !== 'rollback') { version = rows[i].version; break; }
    }
    var button = doc().getElementById('flSnowflakeRollback');
    if (button) button.textContent = 'Roll back to ' + version;
    core.rollback(version).then(function () { paintRollback(); });
  }

  function onRest() {
    if (!lastFlakeId) return;
    core.tombstone(lastFlakeId).then(function () {
      statusEl.textContent = 'This flake rests. Past adapters still name it.';
      paintMeter();
    });
  }

  function showSearch(query) {
    ensureHost();
    ensureHeal();
    if (searchNote) {
      searchNote.hidden = false;
      searchNote.textContent = 'Searching the web';
    }
    var live = doc().getElementById('flChatSearchLive');
    if (live) {
      live.removeAttribute('hidden');
      live.textContent = 'Searching the web';
      live.setAttribute('data-fl-searching', '1');
    }
  }

  function showSearchResult(res, text) {
    ensureHeal();
    lastQuery = text || lastQuery;
    res = res || {};
    if (healLine) healLine.textContent = res.line || '';
    if (tryBtn) tryBtn.hidden = !(res.line && res.outcome !== 'secret' && res.outcome !== 'quiet-room');
    if (!res.line) {
      var live = doc().getElementById('flChatSearchLive');
      if (live && live.getAttribute('data-fl-searching') === '1') {
        live.textContent = 'Search is on';
        live.removeAttribute('data-fl-searching');
      }
      if (searchNote) searchNote.hidden = true;
    }
  }

  function armAngle(index) {
    return (Math.PI / 3) * index - Math.PI / 2;
  }

  function paintFlake() {
    if (!crystal) return;
    while (crystal.firstChild) crystal.removeChild(crystal.firstChild);
    if (!view.on && !view.nodes.length) return;
    var svg = svgEl('svg', { viewBox: '0 0 300 300', role: 'img', 'aria-label': 'Snowflake' });
    svg.id = 'flSnowflakeSvg';
    svg.classList.add('fl-snow-svg');
    var arms = [
      { id: 'a', name: 'Underneath' },
      { id: 'b', name: 'The craft' },
      { id: 'c', name: 'Hidden connections' },
      { id: 'd', name: 'hunch' },
      { id: 'e', name: 'dissenter' },
      { id: 'open', name: 'Looking for its challenge' }
    ];
    var i;
    var extra = (view.branches || []).filter(function (b) { return b && 'abcde'.indexOf(b.id) === -1; });
    for (i = 0; i < arms.length; i++) {
      var angle = armAngle(i);
      var len = 110;
      var x2 = 150 + Math.cos(angle) * len;
      var y2 = 150 + Math.sin(angle) * len;
      var line = svgEl('line', {
        x1: '150', y1: '150',
        x2: String(Math.round(x2)),
        y2: String(Math.round(y2)),
        'data-arm': arms[i].id,
        'data-length': String(len)
      });
      line.classList.add('fl-snow-arm');
      line.classList.add('fl-snow-arm-' + arms[i].id);
      if (arms[i].id === 'open') {
        line.classList.add('is-open');
        var openName = svgEl('title', {});
        openName.textContent = 'Looking for its challenge';
        line.appendChild(openName);
      }
      svg.appendChild(line);
      if (view.thinking === arms[i].id) {
        var tip = svgEl('circle', { cx: String(Math.round(x2)), cy: String(Math.round(y2)), r: '5', 'data-tip': arms[i].id });
        tip.classList.add('fl-snow-tip');
        svg.appendChild(tip);
      }
    }
    for (i = 0; i < extra.length; i++) {
      var ea = armAngle(i) + 0.28;
      var elen = 68;
      svg.appendChild(svgEl('line', {
        x1: '150', y1: '150',
        x2: String(Math.round(150 + Math.cos(ea) * elen)),
        y2: String(Math.round(150 + Math.sin(ea) * elen)),
        'data-arm': extra[i].id,
        'data-length': String(elen),
        class: 'fl-snow-arm fl-snow-arm-fine'
      }));
    }
    svg.appendChild(svgEl('line', {
      x1: '150', y1: '70', x2: '206', y2: '196',
      class: 'fl-snow-thread'
    }));
    svg.appendChild(svgEl('line', {
      x1: '94', y1: '196', x2: '206', y2: '104',
      class: 'fl-snow-thread'
    }));
    var hex = svgEl('polygon', { points: '150,138 160,144 160,156 150,162 140,156 140,144' });
    hex.classList.add('fl-snow-hex');
    svg.appendChild(hex);
    var nodes = view.nodes || [];
    for (i = 0; i < nodes.length; i++) addIce(svg, nodes[i], i);
    crystal.appendChild(svg);
    var list = el('div', 'fl-snow-nodes');
    list.id = 'flSnowflakeNodes';
    for (i = 0; i < nodes.length; i++) list.appendChild(nodeButton(nodes[i]));
    crystal.appendChild(list);
  }

  function addIce(svg, node, index) {
    var map = { a: 0, b: 1, c: 2, d: 3, e: 4 };
    var slot = map[node.branch];
    if (slot == null) slot = 0;
    var angle = armAngle(slot);
    var dist = node.depth > 1 ? 96 : 78;
    var cx = 150 + Math.cos(angle) * dist;
    var cy = 150 + Math.sin(angle) * dist;
    var ice = svgEl('circle', {
      cx: String(Math.round(cx)),
      cy: String(Math.round(cy)),
      r: '7',
      'data-node': node.id,
      'data-confidence': node.confidence || 'guessed'
    });
    ice.classList.add('fl-snow-ice');
    ice.classList.add('is-' + (node.confidence || 'guessed'));
    if (node.kind === 'correction') ice.classList.add('is-struck');
    svg.appendChild(ice);
    if (node.confidence === 'source-with-motive') {
      svg.appendChild(svgEl('circle', {
        cx: String(Math.round(cx + 8)),
        cy: String(Math.round(cy - 8)),
        r: '2',
        class: 'fl-snow-eye'
      }));
    }
  }

  function struck(node) {
    var nodes = view.nodes || [];
    var i;
    for (i = 0; i < nodes.length; i++) {
      if (nodes[i] && nodes[i].kind === 'correction' && nodes[i].points_to === node.psi) return true;
    }
    return false;
  }

  function nodeButton(node) {
    var label = (node.branch === 'd' ? 'hunch' : node.branch) + ' ' + (node.confidence || '');
    var b = el('button', 'fl-snow-node', label);
    b.type = 'button';
    b.setAttribute('data-node', node.id);
    b.setAttribute('data-branch', node.branch || '');
    if (struck(node) || node.kind === 'correction') b.classList.add('is-struck');
    b.addEventListener('click', function () { openCard(node); });
    return b;
  }

  function openCard(node) {
    if (!card) return;
    card.hidden = false;
    while (card.firstChild) card.removeChild(card.firstChild);
    card.appendChild(el('p', 'fl-snow-card-k', 'Source'));
    var link = doc().createElement('a');
    link.id = 'flSnowflakeCardUrl';
    link.href = (node.source && node.source.url) || '#';
    link.textContent = (node.source && (node.source.title || node.source.url)) || 'Source';
    link.rel = 'noopener';
    card.appendChild(link);
    card.appendChild(el('p', '', 'Date ' + (node.date || '')));
    var mind = node.mind || {};
    card.appendChild(el('p', '', 'Mind ' + (mind.name || '') + ' ' + (mind.fp || node.mindFp || '')));
    card.appendChild(el('p', '', 'Confidence ' + (node.confidence || '')));
    var verify = el('p', 'fl-snow-verify', 'unverified');
    verify.id = 'flSnowflakeCardVerify';
    card.appendChild(verify);
    var body = el('p', struck(node) ? 'is-struck' : '', node.text || '');
    body.id = 'flSnowflakeCardText';
    card.appendChild(body);
    card.appendChild(el('p', '', 'psi ' + (node.psi || '')));
    var close = btn('flSnowflakeCardClose', 'Close', function () { card.hidden = true; });
    card.appendChild(close);
    core.verifyNode(node).then(function (res) {
      verify.textContent = res && res.ok ? 'signed' : 'unverified';
      verify.classList.toggle('is-muted', !(res && res.ok));
    });
  }

  function showReceipt(rec) {
    if (!receiptEl || !rec) return;
    receiptEl.hidden = false;
    receiptEl.textContent = rec.text || '';
  }

  function paintResult(result) {
    if (!result) return;
    growBtn.hidden = false;
    pauseBtn.hidden = true;
    stopBtn.hidden = true;
    if (result.status === 'paused') {
      resumeBtn.hidden = false;
      pauseBtn.hidden = true;
      stopBtn.hidden = false;
      growBtn.hidden = true;
      statusEl.textContent = 'Paused. Nothing was lost.';
      return;
    }
    if (result.status === 'stopped') {
      statusEl.textContent = 'Stopped. What it had is saved.';
      if (result.receipt) showReceipt(result.receipt);
      return;
    }
    var flake = result.flake;
    if (!flake) return;
    lastFlakeId = flake.id || '';
    lastOpen = flake.open || '';
    seedFrom = '';
    view.nodes = flake.nodes || view.nodes;
    view.on = true;
    view.thinking = '';
    if (flake.hunch) hunchEl.textContent = flake.hunch;
    conclusionEl.textContent = flake.conclusion || '';
    wrongEl.textContent = 'Where I could be wrong ' + (flake.wrong || '');
    paintFlake();
    if (result.receipt) showReceipt(result.receipt);
    togetherBtn.hidden = false;
    var rest = doc().getElementById('flSnowflakeRest');
    if (rest) rest.hidden = false;
    paintRollback();
    paintMeter();
    deliver(flake, result.receipt);
    if (result.growth) driftEl.textContent = 'This became part of me.';
  }

  function paintRollback() {
    var button = doc().getElementById('flSnowflakeRollback');
    if (!button) return;
    var rows = core.adapterList();
    if (!rows.length) { button.hidden = true; return; }
    var version = rows[rows.length - 1].version || 'v1';
    button.hidden = false;
    button.textContent = 'Roll back to ' + version;
  }

  function deliver(flake, rec) {
    var Doc = root.FLChatDocReturn;
    if (!Doc || typeof Doc.consumeReply !== 'function') return;
    var lines = [];
    lines.push(flake.conclusion || '');
    lines.push('');
    lines.push('Where I could be wrong');
    lines.push(flake.wrong || '');
    lines.push('');
    lines.push(flake.open || '');
    lines.push('');
    var nodes = flake.nodes || [];
    var i;
    for (i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (!n || core.looksLikeSecret(n.text)) continue;
      var src = n.source || {};
      lines.push(n.branch + ' ' + (src.title || '') + ' ' + (src.url || '') + ' ' + (n.date || '') + ' ' + (n.confidence || '') + ' psi ' + (n.psi || ''));
    }
    lines.push('');
    lines.push('Ledger');
    lines.push(flake.psi || '');
    lines.push(flake.humanHash || '');
    lines.push(flake.mindHash || '');
    if (rec && rec.text) lines.push(rec.text);
    var body = lines.join('\n');
    var packed = '[FL_FILE: snowflake.md]\n' + body + '\n[/FL_FILE]\n[FL_FILE: snowflake.txt]\n' + body + '\n[/FL_FILE]';
    var anchor = doc().getElementById('chatMessages') || host;
    try { Doc.consumeReply(packed, anchor); } catch (e) {}
    if (typeof Doc.buildPdf === 'function') {
      var pdf = '';
      try { pdf = Doc.buildPdf(body); } catch (e2) { pdf = ''; }
      var fileBtn = doc().getElementById('flSnowflakePdf');
      if (!fileBtn) {
        fileBtn = btn('flSnowflakePdf', 'snowflake.pdf', function () {
          var saved = fileBtn.getAttribute('data-pdf') || '';
          if (!saved || typeof root.Blob !== 'function') return;
          var blob = new root.Blob([saved], { type: 'application/pdf' });
          var url = root.URL.createObjectURL(blob);
          var a = doc().createElement('a');
          a.href = url;
          a.download = 'snowflake.pdf';
          a.textContent = 'snowflake.pdf';
          doc().body.appendChild(a);
          a.click();
          a.remove();
        });
        host.appendChild(fileBtn);
      }
      fileBtn.setAttribute('data-pdf', pdf);
    }
  }

  function paintMeter() {
    if (!meterEl) return;
    var m = core.meter();
    meterEl.textContent = (m.line ? m.line + ' ' : '') + 'Shelf ' + m.used + ' of ' + m.cap;
  }

  var api = {
    VERSION: core.VERSION,
    GROW: core.GROW,
    HEAL: core.HEAL,
    mountRow: mountRow,
    openAsk: openAsk,
    prepareSend: function (messages, text) { return core.prepareSend(messages, text); },
    healPrompt: core.healPrompt,
    looksRecent: core.looksRecent,
    showSearch: showSearch,
    showSearchResult: showSearchResult,
    promptsShown: function () { return promptsShown; },
    onBegan: function () {
      view.on = true;
      view.thinking = 'd';
      paintFlake();
    },
    onHunch: function (p) {
      view.hunch = p && p.line || '';
      view.thinking = 'd';
      if (hunchEl) hunchEl.textContent = view.hunch;
      paintFlake();
    },
    onArm: function (p) {
      view.thinking = p && p.branch || '';
      paintFlake();
    },
    onNode: function (p) {
      if (p && p.node) view.nodes.push(p.node);
      paintFlake();
    },
    onStatus: function (p) {
      if (statusEl && p && p.line) statusEl.textContent = p.line;
    },
    onReport: function (p) {
      if (!p) return;
      if (conclusionEl) conclusionEl.textContent = p.conclusion || '';
      if (wrongEl) wrongEl.textContent = 'Where I could be wrong ' + (p.wrong || '');
      lastOpen = p.open || lastOpen;
    },
    onReceipt: function (rec) { showReceipt(rec); },
    onPaused: function () {
      if (resumeBtn) resumeBtn.hidden = false;
      if (pauseBtn) pauseBtn.hidden = true;
      if (statusEl) statusEl.textContent = 'Paused. Nothing was lost.';
    },
    onStopped: function (p) {
      if (growBtn) growBtn.hidden = false;
      if (pauseBtn) pauseBtn.hidden = true;
      if (stopBtn) stopBtn.hidden = true;
      if (statusEl) statusEl.textContent = 'Stopped. What it had is saved.';
      if (p && p.receipt) showReceipt(p.receipt);
    },
    onDone: function (p) { paintResult({ status: 'done', flake: p && p.flake, receipt: p && p.receipt }); },
    onGrew: function () {
      if (driftEl) driftEl.textContent = 'This became part of me.';
      paintRollback();
    },
    onOffload: function (p) {
      paintMeter();
      if (statusEl && p && p.line) statusEl.textContent = p.line;
      if (p && p.flake) deliver(p.flake, null);
    }
  };

  root.FLSnowflake = api;

  function boot() {
    watchMenu();
    ensureHost();
    ensureHeal();
    paintMeter();
    try { core.armScheduler(); } catch (e) {}
  }

  var d = doc();
  if (d) {
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
