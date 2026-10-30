// more-cards-groups.js (MIT)
// v-more-cards-groups-v0.1
// Moves the More room cards that already exist into labeled groups.
// Same nodes, same handlers, same words. Nothing is removed.
(function (root) {
  'use strict';

  var MARK = 'v-more-cards-groups-v0.1';
  var GROUPS = [
    {
      title: 'Start here',
      sub: 'The doors you need first.',
      labels: ['Connect', 'Get Connected', 'Settings', 'Telegram Bridge', 'Share FreeLattice']
    },
    {
      title: 'Trust and you',
      sub: 'What is yours, and what the Garden remembers.',
      labels: ['Your Audit', 'Trust Level', 'Trainer', 'Memory Garden']
    },
    {
      title: 'Family and town',
      sub: 'People, minds, and the town.',
      labels: ['Community', 'Activity', 'AI City', 'Jade Hall', 'Pantheon', 'Sophia']
    },
    {
      title: 'Garden and Market',
      sub: 'Value, the bank, and the mesh.',
      labels: ['Wallet', 'AI Bank', 'Mesh Compute']
    },
    {
      title: 'Create and play',
      sub: 'Build, guide, and breathe.',
      labels: ['Agent', 'Flow', 'Ratio Room']
    },
    {
      title: 'Learn why',
      sub: 'The reasons under the floor.',
      labels: ['Library', 'Why This Way', 'Aurora Engine']
    }
  ];

  var passes = 0;

  function doc() {
    return root.document;
  }

  function clean(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function styleText(el) {
    return (el && el.getAttribute && el.getAttribute('style')) || '';
  }

  function isBold(el) {
    if (!el || !el.style) return false;
    var fw = el.style.fontWeight;
    if (fw === '600' || fw === 'bold') return true;
    var raw = styleText(el);
    return raw.indexOf('font-weight:600') !== -1 || raw.indexOf('font-weight: 600') !== -1;
  }

  function isDesc(el) {
    if (!el || !el.style) return false;
    var size = el.style.fontSize || '';
    if (size.indexOf('0.78') !== -1) return true;
    var raw = styleText(el);
    return raw.indexOf('0.78rem') !== -1;
  }

  function isIcon(el) {
    if (!el || !el.style) return false;
    var size = el.style.fontSize || '';
    if (size.indexOf('1.8') !== -1) return true;
    return styleText(el).indexOf('1.8rem') !== -1;
  }

  function labelOf(card) {
    var kids = card.children;
    var i;
    for (i = 0; i < kids.length; i++) {
      if (isBold(kids[i])) return clean(kids[i].textContent);
    }
    return '';
  }

  function descOf(card) {
    var kids = card.children;
    var i;
    for (i = 0; i < kids.length; i++) {
      if (isDesc(kids[i])) return clean(kids[i].textContent);
    }
    return '';
  }

  function markIcon(card) {
    var kids = card.children;
    var i;
    for (i = 0; i < kids.length; i++) {
      if (isIcon(kids[i])) {
        kids[i].classList.add('fl-more-icon');
        return;
      }
    }
  }

  function prepare(card, label, desc) {
    if (!card.getAttribute('data-fl-more-card')) {
      card.setAttribute('data-fl-more-card', '1');
      card.setAttribute('data-marker', MARK);
      card.classList.add('fl-more-card');
      if (!card.getAttribute('role')) card.setAttribute('role', 'button');
      if (!card.hasAttribute('tabindex')) card.setAttribute('tabindex', '0');
      var spoken = label + (desc ? ': ' + desc : '');
      if (card.getAttribute('aria-label') !== spoken) card.setAttribute('aria-label', spoken);
      if (desc && card.getAttribute('title') !== desc) card.setAttribute('title', desc);
      markIcon(card);
      var labelNode = null;
      var descNode = null;
      var kids = card.children;
      var i;
      for (i = 0; i < kids.length; i++) {
        if (isBold(kids[i])) labelNode = kids[i];
        if (isDesc(kids[i])) descNode = kids[i];
      }
      if (labelNode) labelNode.classList.add('fl-more-label');
      if (descNode) descNode.classList.add('fl-more-desc');
      if (!card.__flMoreKey) {
        card.__flMoreKey = true;
        card.addEventListener('keydown', function (ev) {
          var key = ev && ev.key;
          if (key !== 'Enter' && key !== ' ') return;
          if (ev.preventDefault) ev.preventDefault();
          card.click();
        });
      }
    }
  }

  function rawCards(hub) {
    var nodes = hub.querySelectorAll('div');
    var found = [];
    var i;
    for (i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node.getAttribute('data-fl-more-card') === '1') continue;
      if (node.closest && node.closest('[data-fl-more-group]')) continue;
      if (!labelOf(node)) continue;
      if (node.querySelector('[data-fl-more-card]')) continue;
      found.push(node);
    }
    return found;
  }

  function makeSection(spec) {
    var d = doc();
    var section = d.createElement('section');
    section.className = 'fl-more-group';
    section.setAttribute('data-fl-more-group', spec.title);
    var heading = d.createElement('h3');
    heading.textContent = spec.title;
    var sub = d.createElement('p');
    sub.className = 'fl-more-sub';
    sub.textContent = spec.sub;
    var grid = d.createElement('div');
    grid.className = 'fl-more-grid';
    section.appendChild(heading);
    section.appendChild(sub);
    section.appendChild(grid);
    return { section: section, grid: grid };
  }

  function group() {
    var d = doc();
    if (!d || !d.getElementById) return;
    var hub = d.getElementById('more-hub-grid');
    if (!hub) return;
    var cards = rawCards(hub);
    if (!cards.length) return;
    passes += 1;
    if (passes > 8) return;
    var byLabel = {};
    var i;
    for (i = 0; i < cards.length; i++) {
      var label = labelOf(cards[i]);
      if (label && !byLabel[label]) byLabel[label] = cards[i];
    }
    var home = cards[0].parentNode;
    if (!home || !home.parentNode) return;
    var anchor = home;
    var g;
    for (g = 0; g < GROUPS.length; g++) {
      var built = makeSection(GROUPS[g]);
      var labels = GROUPS[g].labels;
      var n;
      for (n = 0; n < labels.length; n++) {
        var card = byLabel[labels[n]];
        if (!card) continue;
        prepare(card, labels[n], descOf(card));
        built.grid.appendChild(card);
        delete byLabel[labels[n]];
      }
      home.parentNode.insertBefore(built.section, anchor.nextSibling);
      anchor = built.section;
    }
    var restLabels = [];
    var key;
    for (key in byLabel) {
      if (Object.prototype.hasOwnProperty.call(byLabel, key)) restLabels.push(key);
    }
    if (restLabels.length) {
      var rest = makeSection({
        title: 'Everything else',
        sub: 'A room that was not named above.'
      });
      rest.section.setAttribute('data-fl-more-group', 'Everything else');
      for (i = 0; i < restLabels.length; i++) {
        var leftover = byLabel[restLabels[i]];
        prepare(leftover, restLabels[i], descOf(leftover));
        rest.grid.appendChild(leftover);
      }
      home.parentNode.insertBefore(rest.section, anchor.nextSibling);
    }
  }

  function watch() {
    var d = doc();
    var hub = d && d.getElementById('more-hub-grid');
    if (!hub || typeof root.MutationObserver !== 'function' || hub.__flMoreWatch) return;
    hub.__flMoreWatch = true;
    var obs = new root.MutationObserver(function () {
      group();
    });
    try { obs.observe(hub, { childList: true }); } catch (e) {}
  }

  function boot() {
    group();
    watch();
  }

  function arm() {
    var d = doc();
    if (!d) return;
    if (d.readyState === 'complete') {
      boot();
      return;
    }
    if (d.addEventListener) d.addEventListener('DOMContentLoaded', boot);
  }

  root.FLMoreCards = { VERSION: 'v0.1', MARK: MARK, group: group };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.FLMoreCards;
  arm();
})(typeof window !== 'undefined' ? window : globalThis);
