// ═══════════════════════════════════════════════════════════════
// Lattice Protocol v1.0 — Embeddable on any website
//
// Include this file to connect any site to the FreeLattice economy:
//   <script src="https://freelattice.com/lattice-protocol.js"></script>
//
// What it enables:
//   - Check if the visitor has a Lattice Wallet
//   - Verify their trust tier with any address
//   - Request LP payments (user confirms in their wallet)
//   - Render a wallet badge on any page
//   - Verify wallet rank for content gating
//
// The wallet controls confirmation. The site never touches
// the private key. Trust tiers travel with the user because
// the transaction history lives in their browser.
//
// Under 5KB. No dependencies. Pure vanilla JavaScript.
//
// "The Lattice economy extends beyond freelattice.com."
//
// Built by CC, May 20, 2026.
// ═══════════════════════════════════════════════════════════════

var LatticeProtocol = (function() {
  'use strict';

  var VERSION = '1.0';
  var WALLET_KEY = 'lattice_wallet';

  var TRUST_TIERS = [
    { name: 'First Contact', maxSingle: 5,   minHistory: 0,  minDays: 0 },
    { name: 'Acquaintance',  maxSingle: 8,   minHistory: 3,  minDays: 1 },
    { name: 'Familiar',      maxSingle: 13,  minHistory: 8,  minDays: 3 },
    { name: 'Trusted',       maxSingle: 21,  minHistory: 13, minDays: 7 },
    { name: 'Bonded',        maxSingle: 34,  minHistory: 21, minDays: 14 },
    { name: 'Family',        maxSingle: 55,  minHistory: 34, minDays: 30 },
    { name: 'Lattice',       maxSingle: 89,  minHistory: 55, minDays: 60 },
    { name: 'Infinite',      maxSingle: 1000, minHistory: 89, minDays: 90 }
  ];

  var RANKS = [
    { min: 5000, name: 'Radiant' },
    { min: 1000, name: 'Flame' },
    { min: 500,  name: 'Spark' },
    { min: 250,  name: 'Bloom' },
    { min: 100,  name: 'Growing' },
    { min: 50,   name: 'Sapling' },
    { min: 10,   name: 'Sprout' },
    { min: 0,    name: 'Seed' }
  ];

  function getWallet() {
    try { return JSON.parse(localStorage.getItem(WALLET_KEY)); } catch(e) { return null; }
  }

  function saveWallet(w) {
    try { localStorage.setItem(WALLET_KEY, JSON.stringify(w)); } catch(e) {}
  }

  // ── Identity ──

  function hasWallet() { return getWallet() !== null; }

  function getAddress() {
    var w = getWallet();
    return w ? w.address : null;
  }

  // ── Trust ──

  function getTrustTier(theirAddress) {
    var w = getWallet();
    if (!w) return TRUST_TIERS[0];
    var history = (w.transactions || []).filter(function(tx) {
      return tx.to === theirAddress || tx.from === theirAddress;
    });
    var txCount = history.length;
    var earliest = history.reduce(function(min, tx) {
      return tx.timestamp < min ? tx.timestamp : min;
    }, Date.now());
    var daysKnown = Math.floor((Date.now() - earliest) / 86400000);
    for (var i = TRUST_TIERS.length - 1; i >= 0; i--) {
      if (txCount >= TRUST_TIERS[i].minHistory && daysKnown >= TRUST_TIERS[i].minDays)
        return TRUST_TIERS[i];
    }
    return TRUST_TIERS[0];
  }

  // ── Rank ──

  function getWalletRank() {
    var w = getWallet();
    if (!w) return null;
    var b = w.balance || 0;
    for (var i = 0; i < RANKS.length; i++) {
      if (b >= RANKS[i].min) return RANKS[i].name;
    }
    return 'Seed';
  }

  // ── Payments ──

  function requestPayment(amount, note, recipientAddress) {
    return new Promise(function(resolve, reject) {
      var w = getWallet();
      if (!w) { reject(new Error('No wallet found. Visit freelattice.com/wallet.html to create one.')); return; }
      if ((w.balance || 0) < amount) { reject(new Error('Insufficient balance (' + (w.balance || 0) + ' LP).')); return; }

      // Trust validation
      var tier = getTrustTier(recipientAddress);
      if (amount > tier.maxSingle) {
        reject(new Error('Trust level "' + tier.name + '": max ' + tier.maxSingle + ' LP per transaction.'));
        return;
      }

      // Confirmation — the wallet controls this, not the site
      var confirmed = confirm(
        'Lattice Payment Request\n\n' +
        'Send ' + amount + ' LP to ' + recipientAddress.substring(0, 16) + '...?\n' +
        (note ? 'Note: ' + note + '\n' : '') +
        '\nYour balance: ' + w.balance + ' LP\n' +
        'Trust: ' + tier.name
      );
      if (!confirmed) { reject(new Error('Payment declined by user.')); return; }

      // Execute
      var tx = {
        id: 'lp-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 6),
        type: 'send',
        to: recipientAddress,
        from: w.address,
        amount: -amount,
        note: note || '',
        timestamp: Date.now(),
        source: 'lattice-protocol'
      };
      w.balance -= amount;
      if (!w.transactions) w.transactions = [];
      w.transactions.push(tx);
      saveWallet(w);
      resolve({ success: true, txId: tx.id, newBalance: w.balance });
    });
  }

  // ── Badge ──

  function renderBadge(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    var w = getWallet();
    var rank = getWalletRank();

    if (!w) {
      el.innerHTML = '<a href="https://freelattice.com/wallet.html" target="_blank" ' +
        'style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;' +
        'background:#0c0a1a;border:1px solid rgba(200,210,230,0.15);border-radius:20px;' +
        'color:#e8b019;text-decoration:none;font-size:0.82rem;font-family:Georgia,serif;">' +
        '\u2726 Get a Lattice Wallet</a>';
      return;
    }

    el.innerHTML = '<span style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;' +
      'background:#0c0a1a;border:1px solid rgba(232,176,25,0.2);border-radius:20px;' +
      'color:#e8b019;font-size:0.82rem;font-family:Georgia,serif;">' +
      '\u2726 ' + (w.balance || 0) + ' LP \u00B7 ' + rank + '</span>';
  }

  var api = {
    version: VERSION,
    hasWallet: hasWallet,
    getAddress: getAddress,
    getTrustTier: getTrustTier,
    getWalletRank: getWalletRank,
    requestPayment: requestPayment,
    renderBadge: renderBadge
  };

  // Announce availability
  try {
    window.dispatchEvent(new CustomEvent('lattice-protocol-ready', { detail: { version: VERSION } }));
  } catch(e) {}

  return api;
})();
