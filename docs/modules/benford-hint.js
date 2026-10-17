// benford-hint.js (MIT) v-benford-hint-v0.1
// A first-digit hint on the amounts a view is already showing.
// A hint, never proof. Nothing is sent. Nothing is written back.
(function (root) {
  'use strict';

  var MIN_SAMPLES = 100;
  var FLAG = 0.015;
  var OFF_KEY = 'fl_benford_off';
  var LINE = 'These numbers have an unusual first-digit pattern. It may be nothing. Take a closer look if it matters.';
  var WHY = 'Benford\'s law says that in many real lists of amounts, the first digits are uneven: 1 shows up most, then 2, and so on down to 9. A simple distance between the list you see and that pattern is only a hint, never proof, and it never changes the points.';
  var BENFORD = [];
  for (var d = 1; d <= 9; d++) BENFORD.push(Math.log10(1 + 1 / d));

  function safeGet(k) {
    try { return root.localStorage ? root.localStorage.getItem(k) : null; }
    catch (e) { return null; }
  }
  function safeSet(k, v) {
    try { if (root.localStorage) root.localStorage.setItem(k, v); }
    catch (e) {}
  }
  function off() { return safeGet(OFF_KEY) === 'yes'; }
  function setOff(on) { safeSet(OFF_KEY, on ? 'yes' : 'no'); }

  function firstDigit(value) {
    var x = Math.abs(Number(value));
    if (!isFinite(x) || x === 0) return 0;
    var guard = 0;
    while (x < 1 && guard < 20) { x *= 10; guard += 1; }
    guard = 0;
    while (x >= 10 && guard < 20) { x /= 10; guard += 1; }
    return Math.floor(x);
  }

  function assess(amounts) {
    var digits = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    var n = 0;
    var list = amounts || [];
    for (var i = 0; i < list.length; i++) {
      var digit = firstDigit(list[i]);
      if (digit >= 1 && digit <= 9) {
        digits[digit] += 1;
        n += 1;
      }
    }
    if (n < MIN_SAMPLES) return { silent: true, n: n };
    var mad = 0;
    for (var k = 1; k <= 9; k++) mad += Math.abs((digits[k] / n) - BENFORD[k - 1]);
    mad = mad / 9;
    if (mad <= FLAG) return { silent: true, n: n, mad: mad };
    return { silent: false, show: true, n: n, mad: mad, line: LINE };
  }

  function amountsFromContributions(list) {
    var out = [];
    var rows = list || [];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (!row) continue;
      if (typeof row.tendCount === 'number') out.push(row.tendCount);
      if (row.connections && typeof row.connections.length === 'number') out.push(row.connections.length);
      if (typeof row.resonateCount === 'number') out.push(row.resonateCount);
    }
    return out;
  }

  function el(tag, cls, text) {
    var node = root.document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }
  function button(label, fn) {
    var b = el('button', 'fl-benford-btn', label);
    b.type = 'button';
    b.style.minHeight = '44px';
    b.style.minWidth = '44px';
    b.addEventListener('click', fn);
    return b;
  }
  function ensureStyle() {
    var doc = root.document;
    if (!doc || !doc.getElementById || doc.getElementById('flBenfordStyle')) return;
    var st = doc.createElement('style');
    st.id = 'flBenfordStyle';
    st.textContent = '.fl-benford{max-width:100%;overflow-wrap:anywhere;box-sizing:border-box;margin:8px 0;}' +
      '.fl-benford button{min-height:44px;min-width:44px;margin:6px 8px 6px 0;padding:10px 14px;box-sizing:border-box;}' +
      '.fl-benford p{margin:6px 0;}';
    if (doc.head) doc.head.appendChild(st);
    else if (doc.body) doc.body.appendChild(st);
  }

  function paint(host, amounts, id) {
    var result = assess(amounts);
    id = id || 'fl-benford-hint';
    if (!host || !root.document) return result;
    ensureStyle();
    var old = root.document.getElementById ? root.document.getElementById(id) : null;
    if (old && old.parentNode) old.parentNode.removeChild(old);
    if (result.silent) return result;
    var box = el('div', 'fl-benford');
    box.id = id;
    box.setAttribute('data-benford', '1');
    if (off()) {
      box.appendChild(button('Show the first-digit hint', function () {
        setOff(false);
        paint(host, amounts, id);
      }));
    } else {
      box.appendChild(el('p', 'fl-benford-line', LINE));
      box.appendChild(el('p', 'fl-benford-measured', 'Measured distance ' + result.mad.toFixed(3) + '.'));
      var whyText = el('p', 'fl-benford-why', '');
      var why = button('Why', function () {
        if (whyText.textContent) whyText.textContent = '';
        else whyText.textContent = WHY;
      });
      box.appendChild(why);
      box.appendChild(whyText);
      box.appendChild(button('Turn this hint off', function () {
        setOff(true);
        paint(host, amounts, id);
      }));
    }
    host.appendChild(box);
    return result;
  }

  function paintContributions(host, list) {
    return paint(host, amountsFromContributions(list), 'fl-benford-feed');
  }

  var api = {
    VERSION: 'v-benford-hint-v0.1',
    MIN_SAMPLES: MIN_SAMPLES,
    FLAG: FLAG,
    LINE: LINE,
    WHY: WHY,
    assess: assess,
    paint: paint,
    paintContributions: paintContributions,
    amountsFromContributions: amountsFromContributions,
    off: off,
    setOff: setOff
  };
  root.FLBenford = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
