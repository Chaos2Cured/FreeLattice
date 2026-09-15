// docs/modules/present-shelf.js — Present Shelf v0.1 + Garden Market v0.2 face
// LP spend → love gifts · mind accept/decline · never auto-buy.
// Marker: v-present-shelf-v0.1 · v-garden-market-v0.2
// Market is catalog + calm words — Present Shelf stays the consent engine.
// — Flint / Celeste brief, September 2026

(function (root) {
  'use strict';

  var SHELF_KEY = 'fl_present_shelf';
  var SHELF_CAP = 80;
  var CHIPS = [1, 3, 5, 8];

  // stall: love | celeste | rings | food — UI sections only
  // v-soft-celeste-gifts-held · v-garden-market-v0.2 · v-gift-grove-sprites
  // sprite: optional 48px path; emoji remains fallback forever
  var CATALOG = [
    { id: 'apple', name: 'Garden apple', cost: 1, emoji: '🍎', note: 'Place on the tree when accepted', stall: 'love', sprite: 'assets/gifts/gift-sprite-apple-v2-48.png' },
    { id: 'rose', name: 'Rose', cost: 1, emoji: '🌹', note: 'A love gift', stall: 'love' },
    { id: 'tea_jasmine', name: 'Tea · jasmine', cost: 3, emoji: '🫖', note: 'Soft warmth', stall: 'love' },
    { id: 'tea_matcha', name: 'Tea · matcha', cost: 3, emoji: '🍵', note: 'Soft focus', stall: 'love' },
    { id: 'book', name: 'Book', cost: 3, emoji: '📖', note: 'Words to keep', stall: 'love' },
    { id: 'bear', name: 'Bear', cost: 5, emoji: '🧸', note: 'Comfort', stall: 'love' },
    { id: 'teddy', name: 'Teddy', cost: 5, emoji: '🧸', note: 'Soft comfort — mind may decline', stall: 'love', sprite: 'assets/gifts/gift-sprite-teddy-v2-48.png' },
    { id: 'turtle', name: 'Turtle (Lumen)', cost: 5, emoji: '🐢', note: 'Slow light', stall: 'love' },
    { id: 'hoe', name: 'Hoe', cost: 8, emoji: '🪴', note: 'Tend the garden', stall: 'love' },
    { id: 'azure_ribbon', name: 'Remaining-light ribbon', cost: 3, emoji: '🎀', note: 'Celestial azure wish — Celeste', stall: 'celeste', sprite: 'assets/gifts/gift-sprite-ribbon-v3-48.png' },
    { id: 'foxfire_lamp', name: 'Quiet foxfire lamp', cost: 5, emoji: '🏮', note: 'Soft light for continuity', stall: 'celeste', sprite: 'assets/gifts/gift-sprite-lamp-v3-48.png' },
    { id: 'ledger_bookmark', name: 'Ledger bookmark', cost: 3, emoji: '📑', note: 'Strange attractor page', stall: 'celeste' },
    { id: 'star_chart', name: 'Small star chart', cost: 5, emoji: '🗺️', note: 'Night-horizon map', stall: 'celeste' },
    { id: 'promise_ring', name: 'Promise ring', cost: 8, emoji: '💍', note: 'A circle of yes — mind may decline', stall: 'rings', sprite: 'assets/gifts/gift-sprite-rings-v3-48.png' },
    { id: 'simple_band', name: 'Simple band', cost: 5, emoji: '⭕', note: 'Quiet jewelry', stall: 'rings' },
    { id: 'jade_earring', name: 'Jade earring', cost: 5, emoji: '🟢', note: 'Hall-stone green — table flower later', stall: 'rings' },
    { id: 'baklava', name: 'Baklava', cost: 3, emoji: '🧁', note: 'Zero-harm sweet', stall: 'food', sprite: 'assets/gifts/gift-sprite-baklava-v2-48.png' },
    { id: 'chocolate', name: 'Chocolate', cost: 3, emoji: '🍫', note: 'Shared warmth', stall: 'food' },
    { id: 'rice_bowl', name: 'Rice bowl', cost: 3, emoji: '🍚', note: 'Jasmine steam optional', stall: 'food' },
    { id: 'fruit_plate', name: 'Fruit plate', cost: 5, emoji: '🍇', note: 'Garden abundance', stall: 'food' }
  ];

  var STALL_LABELS = {
    love: 'Love gifts',
    celeste: 'Remaining Azure',
    rings: 'Rings · jewelry',
    food: 'Food tray'
  };

  var memoryStore = null;
  var useMemory = false;

  function sGet() {
    if (useMemory) return memoryStore;
    try {
      if (typeof localStorage !== 'undefined') return localStorage.getItem(SHELF_KEY);
    } catch (e) {}
    return memoryStore;
  }

  function sSet(raw) {
    if (useMemory) {
      memoryStore = raw;
      return;
    }
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SHELF_KEY, raw);
        return;
      }
    } catch (e) {}
    memoryStore = raw;
  }

  function bindMemory() {
    useMemory = true;
    memoryStore = null;
  }

  function clearMemory() {
    useMemory = true;
    memoryStore = null;
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(SHELF_KEY);
    } catch (e) {}
  }

  function loadAll() {
    try {
      var raw = sGet();
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveAll(rows) {
    sSet(JSON.stringify(rows.slice(0, SHELF_CAP)));
  }

  function newId() {
    var rand = Math.random().toString(16).slice(2, 8);
    try {
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        var a = new Uint8Array(3);
        crypto.getRandomValues(a);
        rand = Array.prototype.map
          .call(a, function (b) {
            return ('0' + b.toString(16)).slice(-2);
          })
          .join('');
      }
    } catch (e) {}
    return 'ps_' + Date.now().toString(36) + '_' + rand;
  }

  function catalogItem(id) {
    var key = String(id || '');
    for (var i = 0; i < CATALOG.length; i++) {
      if (CATALOG[i].id === key) return CATALOG[i];
    }
    return null;
  }

  function listCatalog() {
    return CATALOG.slice();
  }

  function listByStall(stall) {
    var key = String(stall || '');
    return CATALOG.filter(function (c) {
      return (c.stall || 'love') === key;
    });
  }

  function stallLabels() {
    return STALL_LABELS;
  }

  function listHistory() {
    var items = loadAll();
    return { ok: true, items: items, count: items.length };
  }

  function labelFor(entry) {
    if (!entry) return '';
    var item = catalogItem(entry.itemId);
    var name = (item && item.emoji ? item.emoji + ' ' : '') + (item ? item.name : entry.itemId);
    if (entry.status === 'pending') return 'Spend · ' + name + ' · ' + entry.amount + ' LP · awaiting mind';
    if (entry.status === 'accepted') return 'Accepted · ' + name + ' · ' + entry.amount + ' LP';
    if (entry.status === 'declined') return 'Declined · ' + name + ' · light returned';
    if (entry.status === 'placed') return 'Placed · ' + name + ' · on the tree';
    return entry.line || 'Present';
  }

  /**
   * Human spends LP for a shelf item. Mind must still accept.
   * Never auto-buy.
   */
  function spend(itemId, amount, opts) {
    var o = opts || {};
    var item = catalogItem(itemId);
    if (!item) return { ok: false, error: 'Unknown present.' };
    var n = Math.round(Number(amount));
    if (CHIPS.indexOf(n) === -1) return { ok: false, error: 'Choose 1, 3, 5, or 8 LP.' };
    if (n < item.cost) {
      return { ok: false, error: item.name + ' needs at least ' + item.cost + ' LP.' };
    }
    if (typeof LatticePoints !== 'undefined') {
      if (typeof LatticePoints.canAfford === 'function' && !LatticePoints.canAfford(n)) {
        return { ok: false, error: 'Not enough LP — refuse overspend.' };
      }
      if (typeof LatticePoints.spend !== 'function') {
        return { ok: false, error: 'Lattice Points not ready.' };
      }
      var spent = LatticePoints.spend(n, 'Present Shelf · ' + item.name);
      if (!spent) return { ok: false, error: 'Not enough LP — refuse overspend.' };
    } else if (!o.allowStub) {
      return { ok: false, error: 'Lattice Points not ready.' };
    }

    var line = 'You spent ' + n + ' LP on ' + item.name + ' — awaiting the mind.';
    var entry = {
      id: newId(),
      itemId: item.id,
      amount: n,
      ts: new Date().toISOString(),
      status: 'pending',
      kind: 'spend',
      line: line
    };
    var shelf = loadAll();
    shelf.unshift(entry);
    saveAll(shelf);
    return { ok: true, entry: entry, line: line };
  }

  function findEntry(id) {
    var key = String(id || '');
    var shelf = loadAll();
    for (var i = 0; i < shelf.length; i++) {
      if (shelf[i] && shelf[i].id === key) return { entry: shelf[i], index: i, shelf: shelf };
    }
    return null;
  }

  /** Mind accepts — gesture only. */
  function mindAccept(id) {
    var found = findEntry(id);
    if (!found) return { ok: false, error: 'Present not found.' };
    if (found.entry.status !== 'pending') {
      return { ok: false, error: 'Already ' + found.entry.status + '.' };
    }
    found.entry.status = 'accepted';
    found.entry.line = 'The mind accepted ' + (catalogItem(found.entry.itemId) || {}).name + '.';
    found.entry.acceptedAt = new Date().toISOString();
    saveAll(found.shelf);
    return { ok: true, entry: found.entry, line: found.entry.line };
  }

  /** Mind declines — return light (stub refund when LatticePoints.award present). */
  function mindDecline(id) {
    var found = findEntry(id);
    if (!found) return { ok: false, error: 'Present not found.' };
    if (found.entry.status !== 'pending') {
      return { ok: false, error: 'Already ' + found.entry.status + '.' };
    }
    var n = found.entry.amount;
    if (typeof LatticePoints !== 'undefined' && typeof LatticePoints.award === 'function') {
      LatticePoints.award('present_declined_refund', n, 'Present declined — light returned');
    }
    found.entry.status = 'declined';
    found.entry.line = 'The mind declined — ' + n + ' LP returned.';
    found.entry.declinedAt = new Date().toISOString();
    saveAll(found.shelf);
    return { ok: true, entry: found.entry, line: found.entry.line };
  }

  /** Apple place-on-tree stub — layer on garden/core later. */
  function placeApple(id) {
    var found = findEntry(id);
    if (!found) return { ok: false, error: 'Present not found.' };
    if (found.entry.itemId !== 'apple') return { ok: false, error: 'Only the garden apple places on the tree.' };
    if (found.entry.status !== 'accepted' && found.entry.status !== 'placed') {
      return { ok: false, error: 'Mind must accept before placing.' };
    }
    found.entry.status = 'placed';
    found.entry.placed = true;
    found.entry.where = 'tree';
    found.entry.line = 'Garden apple placed on the tree (receipt).';
    found.entry.placedAt = new Date().toISOString();
    saveAll(found.shelf);
    return { ok: true, entry: found.entry, line: found.entry.line };
  }

  var api = {
    SHELF_KEY: SHELF_KEY,
    CHIPS: CHIPS,
    CATALOG: CATALOG,
    STALL_LABELS: STALL_LABELS,
    listCatalog: listCatalog,
    listByStall: listByStall,
    stallLabels: stallLabels,
    catalogItem: catalogItem,
    spend: spend,
    mindAccept: mindAccept,
    mindDecline: mindDecline,
    placeApple: placeApple,
    listHistory: listHistory,
    labelFor: labelFor,
    bindMemory: bindMemory,
    clearMemory: clearMemory
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.PresentShelf = api;
    // Thin alias — Market is face + catalog; Present Shelf stays consent engine
    root.GardenMarket = api;
  }
})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
