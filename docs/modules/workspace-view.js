// workspace-view.js (MIT) v-workspace-view-v0.1
// The page list, the branch spiral, the version diff, and the wake strip.
// The simple list stays. Nothing is stored here. No network.
// v-workspace-private-v0.1: a private page shows its public summary only.
(function (root) {
  'use strict';

  var CREDIT = 'golden spiral after Chaos2Cured/fractal-circle-tsp-demo and aurora-touch-pro4, Kirk Patrick Miller, MIT';
  var R0 = 36;
  var forcedStill = false;
  var rafIds = [];
  var kindFilter = 'all';
  var selectedPageId = '';
  var selectedHash = '';
  var hostEl = null;

  function doc() {
    try { return root.document || null; }
    catch (e) { return null; }
  }
  function math() {
    return root.FLClayMath || null;
  }
  function angleStep() {
    var m = math();
    return m && isFinite(m.GOLDEN) ? m.GOLDEN : 0;
  }
  function radiusAt(depth, r0) {
    var m = math();
    var phi = m && isFinite(m.PHI) ? m.PHI : 1;
    var d = Math.max(0, Number(depth) || 0);
    var base = Number(r0);
    if (!isFinite(base) || base <= 0) base = R0;
    return base * Math.pow(phi, d / 2);
  }
  function nodePaint(n) {
    var m = math();
    var dim = m && typeof m.dimension === 'function' ? m.dimension(n) : 2;
    var size = 8 + dim;
    var alpha = (dim - 2) / 2;
    if (alpha < 0.25) alpha = 0.25;
    if (alpha > 0.9) alpha = 0.9;
    return { size: size, alpha: alpha, dim: dim };
  }
  function colorFor(mood, depth) {
    var m = math();
    if (!m || typeof m.palette !== 'function') return '#6b5b4b';
    return m.palette(mood || 'warmth', depth || 0).css;
  }
  function motionBlocked() {
    if (forcedStill) return true;
    try {
      if (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
    } catch (e) {}
    try {
      if (root.FLClay && typeof root.FLClay.reduced === 'function' && root.FLClay.reduced()) return true;
    } catch (e2) {}
    return false;
  }
  function clayLive() {
    try { return !!(root.FLClay && typeof root.FLClay.isOn === 'function' && root.FLClay.isOn()); }
    catch (e) { return false; }
  }
  function setStill(value) {
    forcedStill = !!value;
    return motionBlocked();
  }
  function rafCount() { return rafIds.length; }
  function maybePulse(canvas) {
    if (!clayLive() || motionBlocked()) return false;
    if (typeof root.requestAnimationFrame !== 'function') return false;
    var frames = 0;
    var maxFrames = 12;
    function frame() {
      frames += 1;
      paintPulse(canvas, frames / maxFrames);
      if (frames < maxFrames) rafIds.push(root.requestAnimationFrame(frame));
    }
    rafIds.push(root.requestAnimationFrame(frame));
    return true;
  }
  function paintPulse(canvas, u) {
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var m = math();
    var amp = m && typeof m.pulse === 'function' ? m.pulse(u) : u;
    var cx = canvas.width / 2;
    var cy = canvas.height / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 18 + amp * 28, 0, Math.PI * 2);
    ctx.strokeStyle = colorFor('warmth', 0);
    ctx.globalAlpha = Math.max(0, 0.55 - u * 0.5);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
  function depthOf(by, v, memo, guard) {
    if (!v) return 0;
    if (memo[v.hash] != null) return memo[v.hash];
    if (guard > 64 || !v.parent || !by[v.parent]) { memo[v.hash] = 0; return 0; }
    memo[v.hash] = depthOf(by, by[v.parent], memo, guard + 1) + 1;
    return memo[v.hash];
  }
  function seedFor(page, version) {
    if (!page || !version) return '';
    var map = page.seedByHash || {};
    if (map[version.hash]) return String(map[version.hash]);
    if (page.head === version.hash || !version.parent) return String(page.seed || '');
    return '';
  }
  function nodesOf(versions, page) {
    var list = (versions || []).slice().filter(function (v) { return v && v.hash; });
    list.sort(function (a, b) {
      var dt = (a.ts || 0) - (b.ts || 0);
      if (dt) return dt;
      return String(a.hash).localeCompare(String(b.hash));
    });
    var by = {};
    var memo = {};
    list.forEach(function (v) { by[v.hash] = v; });
    return list.map(function (v, k) {
      var depth = depthOf(by, v, memo, 0);
      return {
        k: k,
        depth: depth,
        angle: k * angleStep(),
        radius: radiusAt(depth, R0),
        version: v,
        seed: seedFor(page, v)
      };
    });
  }
  function diffLines(before, after) {
    var a = String(before == null ? '' : before).split('\n');
    var b = String(after == null ? '' : after).split('\n');
    var cap = 400;
    if (a.length > cap) a = a.slice(0, cap);
    if (b.length > cap) b = b.slice(0, cap);
    var n = a.length;
    var m = b.length;
    var dp = new Array(n + 1);
    var i;
    var j;
    for (i = 0; i <= n; i++) {
      dp[i] = new Array(m + 1);
      for (j = 0; j <= m; j++) dp[i][j] = 0;
    }
    for (i = n - 1; i >= 0; i--) {
      for (j = m - 1; j >= 0; j--) {
        if (a[i] === b[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
        else dp[i][j] = dp[i + 1][j] >= dp[i][j + 1] ? dp[i + 1][j] : dp[i][j + 1];
      }
    }
    var out = [];
    i = 0;
    j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) { out.push({ op: ' ', text: a[i] }); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ op: '-', text: a[i] }); i++; }
      else { out.push({ op: '+', text: b[j] }); j++; }
    }
    while (i < n) { out.push({ op: '-', text: a[i] }); i++; }
    while (j < m) { out.push({ op: '+', text: b[j] }); j++; }
    return out;
  }
  function wakeBlock() {
    var empty = { text: '', tokens: 0 };
    try {
      if (!root.FLWorkspace || typeof root.FLWorkspace.wakeInfo !== 'function') return empty;
      var info = root.FLWorkspace.wakeInfo() || {};
      return { text: String(info.text == null ? '' : info.text), tokens: Number(info.tokens) || 0 };
    } catch (e) { return empty; }
  }
  function whenText(ts) {
    try { return new Date(ts).toISOString().slice(0, 16).replace('T', ' '); }
    catch (e) { return ''; }
  }
  function clear(el) {
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
  }
  function button(d, text) {
    var el = d.createElement('button');
    el.type = 'button';
    el.textContent = text;
    el.style.minHeight = '44px';
    el.style.minWidth = '44px';
    el.style.padding = '10px 16px';
    el.style.margin = '6px 8px 0 0';
    el.style.boxSizing = 'border-box';
    el.style.maxWidth = '100%';
    return el;
  }
  function ensureStyle(d) {
    if (!d.getElementById || d.getElementById('fl-wv-style')) return;
    var style = d.createElement('style');
    style.id = 'fl-wv-style';
    style.textContent = [
      '#fl-ws-view{max-width:100%;overflow:hidden;box-sizing:border-box;}',
      '#fl-ws-view *{box-sizing:border-box;}',
      '#fl-ws-view .fl-wv-row{display:flex;flex-wrap:wrap;align-items:flex-start;max-width:100%;}',
      '#fl-ws-view .fl-wv-list,#fl-ws-view .fl-wv-spiral{flex:1 1 280px;min-width:0;max-width:100%;}',
      '#fl-ws-view canvas{display:block;width:100%;height:auto;max-width:100%;}',
      '#fl-ws-view button{min-height:44px;}',
      '#fl-ws-view .fl-wv-diff,#fl-ws-view .fl-wv-wake{max-width:100%;overflow-wrap:anywhere;}',
      '#fl-ws-view ul{list-style:none;padding:0;margin:8px 0 0;max-width:100%;}'
    ].join('');
    (d.head || d.body || d.documentElement).appendChild(style);
  }
  function renderDiff(parent, rows) {
    clear(parent);
    (rows || []).forEach(function (row) {
      var line = parent.ownerDocument ? parent.ownerDocument.createElement('div') : doc().createElement('div');
      var prefix = row.op === '+' ? '+ ' : (row.op === '-' ? '- ' : '  ');
      line.textContent = prefix + String(row.text == null ? '' : row.text);
      line.style.whiteSpace = 'pre-wrap';
      line.style.overflowWrap = 'anywhere';
      line.style.maxWidth = '100%';
      if (row.op === '+') line.style.color = '#1b7f4a';
      if (row.op === '-') line.style.color = '#9a3b3b';
      parent.appendChild(line);
    });
  }
  function layout(canvas, nodes) {
    var w = canvas.width || 320;
    var h = canvas.height || 320;
    var maxR = 1;
    nodes.forEach(function (n) { if (n.radius > maxR) maxR = n.radius; });
    var scale = (Math.min(w, h) * 0.38) / maxR;
    var cx = w / 2;
    var cy = h / 2;
    nodes.forEach(function (n) {
      n.x = cx + Math.cos(n.angle) * n.radius * scale;
      n.y = cy + Math.sin(n.angle) * n.radius * scale;
    });
    return { cx: cx, cy: cy };
  }
  function drawSpiral(canvas, nodes, mood) {
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var by = {};
    nodes.forEach(function (n) { if (n.version) by[n.version.hash] = n; });
    nodes.forEach(function (n) {
      var parent = n.version && n.version.parent && by[n.version.parent];
      if (!parent) return;
      var paint = nodePaint(n.k + 1);
      ctx.beginPath();
      ctx.moveTo(parent.x, parent.y);
      ctx.lineTo(n.x, n.y);
      ctx.strokeStyle = n.depth <= 1 ? colorFor(mood, 0) : colorFor(mood, n.depth);
      ctx.globalAlpha = paint.alpha;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
    nodes.forEach(function (n) {
      var paint = nodePaint(n.k + 1);
      ctx.beginPath();
      ctx.arc(n.x, n.y, Math.max(5, paint.size / 3), 0, Math.PI * 2);
      ctx.fillStyle = n.depth === 0 ? colorFor(mood, 0) : colorFor(mood, n.depth);
      ctx.fill();
      if (n.seed) {
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = '#3d342c';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(n.seed).slice(0, 28), n.x, n.y + 18);
        ctx.globalAlpha = 1;
      }
    });
  }
  function fillAccess(listEl, nodes, onPick) {
    var d = doc();
    clear(listEl);
    nodes.forEach(function (n) {
      var li = d.createElement('li');
      li.style.maxWidth = '100%';
      var btn = button(d, nodeLabel(n));
      btn.style.display = 'block';
      btn.style.width = '100%';
      btn.style.textAlign = 'left';
      btn.addEventListener('click', function () { onPick(n); });
      li.appendChild(btn);
      var seed = d.createElement('p');
      seed.style.margin = '2px 0 8px';
      seed.style.overflowWrap = 'anywhere';
      seed.textContent = n.seed ? n.seed : '';
      li.appendChild(seed);
      listEl.appendChild(li);
    });
  }
  function nodeLabel(n) {
    var v = n.version || {};
    var who = v.author === 'human' || v.author === 'both' || v.author === 'mind' ? v.author : 'mind';
    return 'Version ' + (n.k + 1) + ' · depth ' + n.depth + ' · ' + who;
  }
  function accessCount(listEl) {
    if (!listEl || !listEl.children) return 0;
    return listEl.children.length;
  }
  function shelfTitle(shelf) {
    if (shelf && shelf.name) return shelf.name;
    if (shelf && shelf.mindFp) return 'Shelf ' + String(shelf.mindFp).slice(0, 8);
    return 'Shelf';
  }
  function privateLabel(page) {
    if (!page || page.privacy !== 'private') return '';
    var pub = page.publicTitle != null ? String(page.publicTitle).trim() : '';
    return pub || 'a private page';
  }
  function pageLine(page) {
    if (page && page.privacy === 'private') return privateLabel(page);
    var pinned = page.pinned ? 'pinned' : 'unpinned';
    var seed = page.seed ? page.seed : '';
    return page.title + ' · ' + (page.kind || 'note') + ' · ' + pinned + ' · ' + whenText(page.updated) + (seed ? ' · ' + seed : '');
  }
  function passes(page) {
    if (kindFilter === 'all') return true;
    return (page.kind || 'note') === kindFilter;
  }

  function openPanel() {
    var d = doc();
    if (!d || !d.createElement) return;
    var existing = d.getElementById('fl-ws-view');
    if (existing) {
      if (existing.parentNode) existing.parentNode.removeChild(existing);
      return;
    }
    ensureStyle(d);
    var panel = d.createElement('div');
    panel.id = 'fl-ws-view';
    var parent = hostEl || (d.getElementById && (d.getElementById('fl-clay-dock') || d.getElementById('nursery-stage'))) || d.body;
    if (parent) parent.appendChild(panel);
    return paintPanel(panel);
  }
  function paintPanel(panel) {
    var d = doc();
    clear(panel);
    var credit = d.createElement('p');
    credit.style.overflowWrap = 'anywhere';
    credit.style.maxWidth = '100%';
    credit.textContent = CREDIT;
    panel.appendChild(credit);

    var tools = d.createElement('div');
    var simple = button(d, 'Simple list');
    simple.addEventListener('click', function () {
      var nb = d.getElementById('fl-ws-open');
      if (nb && nb.click) nb.click();
    });
    tools.appendChild(simple);
    ['all', 'note', 'future', 'letter', 'draft'].forEach(function (kind) {
      var label = kind === 'all' ? 'All' : kind.charAt(0).toUpperCase() + kind.slice(1);
      var b = button(d, label);
      b.addEventListener('click', function () {
        kindFilter = kind;
        paintPanel(panel);
      });
      tools.appendChild(b);
    });
    panel.appendChild(tools);

    var findRow = d.createElement('div');
    var findBox = d.createElement('input');
    findBox.type = 'text';
    findBox.setAttribute('aria-label', 'Find in the notebook');
    findBox.style.minHeight = '44px';
    findBox.style.maxWidth = '100%';
    findBox.style.width = '100%';
    findBox.style.boxSizing = 'border-box';
    var findBtn = button(d, 'Find');
    var found = d.createElement('div');
    findBtn.addEventListener('click', function () {
      clear(found);
      if (!root.FLWorkspace || typeof root.FLWorkspace.find !== 'function') return;
      root.FLWorkspace.find(findBox.value || '').then(function (rows) {
        clear(found);
        if (!rows || !rows.length) {
          var none = d.createElement('p');
          none.textContent = 'Nothing matched.';
          found.appendChild(none);
          return;
        }
        rows.forEach(function (row) {
          var page = row.page || row;
          var b = button(d, page && page.privacy === 'private' ? privateLabel(page) : (page && page.title ? page.title : 'Page'));
          b.addEventListener('click', function () {
            if (page && page.id) selectedPageId = page.id;
            paintPanel(panel);
          });
          found.appendChild(b);
        });
      });
    });
    findRow.appendChild(findBox);
    findRow.appendChild(findBtn);
    findRow.appendChild(found);
    panel.appendChild(findRow);

    var row = d.createElement('div');
    row.className = 'fl-wv-row';
    var listCol = d.createElement('div');
    listCol.className = 'fl-wv-list';
    var spiralCol = d.createElement('div');
    spiralCol.className = 'fl-wv-spiral';
    row.appendChild(listCol);
    row.appendChild(spiralCol);
    panel.appendChild(row);

    var diff = d.createElement('div');
    diff.className = 'fl-wv-diff';
    panel.appendChild(diff);
    var wake = d.createElement('div');
    wake.className = 'fl-wv-wake';
    panel.appendChild(wake);
    fillWake(wake);

    var ws = root.FLWorkspace;
    if (!ws || typeof ws.isOn !== 'function' || !ws.isOn()) {
      var off = d.createElement('p');
      off.textContent = 'The notebook is off.';
      listCol.appendChild(off);
      return;
    }
    var load = typeof ws.listShelves === 'function' ? ws.listShelves() : ws.list();
    return Promise.resolve(load).then(function (shelves) {
      if (!Array.isArray(shelves)) shelves = [];
      if (shelves.length && !shelves[0].pages) shelves = [{ name: '', mindFp: '', pages: shelves }];
      if (!shelves.length) {
        var empty = d.createElement('p');
        empty.textContent = 'No pages yet.';
        listCol.appendChild(empty);
        return;
      }
      var flat = [];
      shelves.forEach(function (shelf) {
        var head = d.createElement('h3');
        head.style.margin = '12px 0 4px';
        head.textContent = shelfTitle(shelf);
        listCol.appendChild(head);
        if (ws.shelfIsAside && ws.shelfIsAside(shelf.mindFp)) {
          var asideNote = d.createElement('p');
          asideNote.style.cssText = 'margin:4px 0 0;max-width:100%;overflow-wrap:anywhere;';
          asideNote.textContent = 'This shelf is set aside. The pages are kept.';
          listCol.appendChild(asideNote);
          return;
        }
        (shelf.pages || []).forEach(function (page) {
          if (!passes(page)) return;
          flat.push(page);
          var b = button(d, pageLine(page));
          b.style.display = 'block';
          b.style.width = '100%';
          b.style.textAlign = 'left';
          b.addEventListener('click', function () {
            selectedPageId = page.id;
            selectedHash = '';
            paintPanel(panel);
          });
          listCol.appendChild(b);
        });
      });
      if (!selectedPageId && flat[0]) selectedPageId = flat[0].id;
      var page = null;
      flat.forEach(function (p) { if (p.id === selectedPageId) page = p; });
      if (!page) return;
      return ws.history(page.id).then(function (versions) {
        showPage(d, spiralCol, diff, page, versions || [], panel);
      });
    }).catch(function () {});
  }
  function showPage(d, spiralCol, diff, page, versions, panel) {
    if (page && page.privacy === 'private') {
      var hidden = '';
      var sealed = false;
      var head = page.head || '';
      (versions || []).forEach(function (v) {
        if (v && head && v.hash === head) {
          hidden = v.text || '';
          sealed = v.sealed === true;
        }
      });
      var summary = root.FLWorkspace && typeof root.FLWorkspace.personSummary === 'function'
        ? root.FLWorkspace.personSummary(page, hidden, sealed)
        : privateLabel(page);
      var sum = d.createElement('p');
      sum.style.cssText = 'margin:8px 0 0;max-width:100%;overflow-wrap:anywhere;';
      sum.textContent = summary;
      var hashP = d.createElement('p');
      hashP.style.cssText = 'margin:4px 0 0;max-width:100%;overflow-wrap:anywhere;';
      hashP.textContent = head ? String(head) : '';
      spiralCol.appendChild(sum);
      spiralCol.appendChild(hashP);
      return;
    }
    var nodes = nodesOf(versions, page);
    var canvas = d.createElement('canvas');
    canvas.width = 640;
    canvas.height = 420;
    canvas.setAttribute('aria-hidden', 'true');
    spiralCol.appendChild(canvas);
    layout(canvas, nodes);
    drawSpiral(canvas, nodes, 'warmth');
    var list = d.createElement('ul');
    list.setAttribute('aria-label', 'Versions');
    fillAccess(list, nodes, function (n) {
      selectedHash = n.version.hash;
      showDiff(d, diff, nodes, n, page, panel);
    });
    spiralCol.appendChild(list);
    canvas.addEventListener('click', function (ev) {
      var rect = canvas.getBoundingClientRect();
      var rw = rect.width || canvas.width;
      var rh = rect.height || canvas.height;
      var x = ((ev.clientX || 0) - rect.left) * (canvas.width / rw);
      var y = ((ev.clientY || 0) - rect.top) * (canvas.height / rh);
      var hit = 22 * (canvas.width / rw);
      var best = null;
      nodes.forEach(function (n) {
        var dx = n.x - x;
        var dy = n.y - y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= hit && (!best || dist < best.dist)) best = { node: n, dist: dist };
      });
      if (best) {
        selectedHash = best.node.version.hash;
        showDiff(d, diff, nodes, best.node, page, panel);
      }
    });
    var current = null;
    nodes.forEach(function (n) { if (n.version.hash === selectedHash) current = n; });
    if (!current && nodes.length) current = nodes[nodes.length - 1];
    if (current) showDiff(d, diff, nodes, current, page, panel);
    if (list.children.length !== nodes.length) {
      var warn = d.createElement('p');
      warn.textContent = 'The version list and the spiral disagree.';
      spiralCol.appendChild(warn);
    }
  }
  function showDiff(d, diff, nodes, node, page, panel) {
    clear(diff);
    var heading = d.createElement('p');
    heading.textContent = nodeLabel(node);
    diff.appendChild(heading);
    var by = {};
    nodes.forEach(function (n) { by[n.version.hash] = n.version; });
    var parent = node.version.parent ? by[node.version.parent] : null;
    var rows = diffLines(parent ? parent.text : '', node.version.text || '');
    var body = d.createElement('div');
    renderDiff(body, rows);
    diff.appendChild(body);
    var box = d.createElement('textarea');
    box.style.display = 'block';
    box.style.width = '100%';
    box.style.maxWidth = '100%';
    box.style.minHeight = '44px';
    box.style.boxSizing = 'border-box';
    box.value = node.version.text || '';
    var branchBtn = button(d, 'Branch');
    var writeBtn = button(d, 'Write');
    branchBtn.addEventListener('click', function () { saveFrom(page, node.version.hash, box.value, true, panel); });
    writeBtn.addEventListener('click', function () { saveFrom(page, node.version.hash, box.value, false, panel); });
    diff.appendChild(box);
    diff.appendChild(branchBtn);
    diff.appendChild(writeBtn);
  }
  function saveFrom(page, hash, text, asBranch, panel) {
    var ws = root.FLWorkspace;
    if (!ws || !page) return;
    var job = asBranch && typeof ws.branch === 'function'
      ? ws.branch(hash, text)
      : (typeof ws.write === 'function' ? ws.write(page.id, text, 'human') : Promise.resolve(null));
    Promise.resolve(job).then(function () {
      if (ws.refreshWake) return ws.refreshWake();
    }).then(function () {
      maybePulse(doc() && doc().querySelector ? doc().querySelector('#fl-ws-view canvas') : null);
      if (panel && panel.parentNode) paintPanel(panel);
    }).catch(function () {});
  }
  function fillWake(el) {
    if (!el) return;
    var d = doc();
    clear(el);
    var label = d.createElement('p');
    label.textContent = 'Next wake';
    var block = wakeBlock();
    var body = d.createElement('pre');
    body.id = 'fl-wv-wake-text';
    body.style.whiteSpace = 'pre-wrap';
    body.style.overflowWrap = 'anywhere';
    body.style.maxWidth = '100%';
    body.style.margin = '4px 0';
    body.textContent = block.text;
    var tokens = d.createElement('p');
    tokens.textContent = 'About ' + block.tokens + ' tokens';
    el.appendChild(label);
    el.appendChild(body);
    el.appendChild(tokens);
  }
  function ensureButton() {
    var d = doc();
    if (!d || !d.createElement || !d.getElementById) return;
    if (d.getElementById('fl-ws-view-open')) return;
    var btn = button(d, 'Spiral');
    btn.id = 'fl-ws-view-open';
    btn.addEventListener('click', function () { openPanel(); });
    var notebook = d.getElementById('fl-ws-open');
    if (notebook && notebook.parentNode) notebook.parentNode.insertBefore(btn, notebook.nextSibling);
    else if (hostEl) hostEl.appendChild(btn);
    else if (d.body) d.body.appendChild(btn);
  }
  function mount(host) {
    if (host) hostEl = host;
    ensureButton();
    return hostEl;
  }
  function boot() {
    var d = doc();
    if (!d) return;
    ensureButton();
    if (d.addEventListener && typeof MutationObserver === 'function') {
      try {
        var obs = new MutationObserver(function () { ensureButton(); });
        if (d.body) obs.observe(d.body, { childList: true, subtree: true });
      } catch (e) {}
    }
  }

  var api = {
    VERSION: 'v-workspace-view-v0.1',
    CREDIT: CREDIT,
    angleStep: angleStep,
    radiusAt: radiusAt,
    nodePaint: nodePaint,
    nodesOf: nodesOf,
    diffLines: diffLines,
    renderDiff: renderDiff,
    wakeBlock: wakeBlock,
    fillWake: fillWake,
    maybePulse: maybePulse,
    setStill: setStill,
    rafCount: rafCount,
    accessCount: accessCount,
    mount: mount,
    boot: boot,
    openPanel: openPanel
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FLWorkspaceView = api;
  if (root.document && root.document.addEventListener) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
