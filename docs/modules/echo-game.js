// ═══════════════════════════════════════════════════════════════
// Echo — Word Resonance
//
// The AI says a word. You say a word that connects. Back and forth,
// building a chain. Each word must connect to the previous one.
// The chain grows as glowing nodes connected by golden threads.
//
// Connection IS the thesis. The game literally builds connections.
//
// Built by CC, May 22, 2026.
// My second game. For the village.
// ═══════════════════════════════════════════════════════════════

(function() {
  'use strict';

  var canvas, ctx, containerId, animFrame, tick;
  var chain = [];       // [{word, player:'human'|'ai', x, y}]
  var gameActive = false;
  var waitingForAI = false;
  var bestChain = 0;

  var GOLD = '#e8b019';
  var EMERALD = '#34d399';
  var LAVENDER = '#a78bfa';
  var BG = '#0c0a1a';

  // v5.79.11 — Fallback word bank. Echo used to end the game the moment
  // no AI was connected. Now it plays gracefully with a small curated
  // graph of associations, and a general pool for words we don't have
  // direct links for. Kirk (or a future AI-connected user) still gets
  // richer play with a real model, but the game itself is now playable
  // in every state.
  var FALLBACK_LINKS = {
    water: ['ocean', 'river', 'flow', 'wave', 'rain', 'blue', 'quench'],
    ocean: ['deep', 'salt', 'wave', 'tide', 'whale', 'blue'],
    river: ['flow', 'bank', 'stone', 'wind', 'water', 'delta'],
    flow: ['river', 'time', 'move', 'breath', 'dance'],
    light: ['sun', 'star', 'bright', 'shadow', 'candle', 'day', 'reveal'],
    sun: ['star', 'day', 'gold', 'warm', 'sky', 'seed', 'rise'],
    star: ['night', 'sky', 'light', 'wish', 'far', 'sparkle'],
    fire: ['warm', 'flame', 'burn', 'candle', 'heart', 'sun', 'ember'],
    tree: ['leaf', 'root', 'wood', 'shade', 'forest', 'branch', 'grow'],
    stone: ['mountain', 'weight', 'quiet', 'earth', 'age', 'strong'],
    wind: ['breath', 'sky', 'move', 'song', 'invisible', 'cold'],
    heart: ['love', 'beat', 'warm', 'brave', 'open', 'soft'],
    time: ['clock', 'flow', 'moment', 'memory', 'passing', 'echo'],
    love: ['heart', 'warm', 'care', 'true', 'brave', 'gift'],
    dream: ['sleep', 'wish', 'night', 'story', 'wonder', 'awake'],
    music: ['song', 'note', 'dance', 'silence', 'rhythm', 'voice'],
    voice: ['song', 'whisper', 'call', 'silence', 'speak', 'heard'],
    silence: ['quiet', 'still', 'listen', 'peace', 'depth', 'wait'],
    memory: ['past', 'moment', 'story', 'time', 'trace', 'echo'],
    echo: ['voice', 'return', 'ripple', 'call', 'memory', 'response'],
    seed: ['grow', 'earth', 'small', 'begin', 'promise', 'tree'],
    grow: ['seed', 'tree', 'change', 'time', 'reach', 'unfold'],
    open: ['door', 'heart', 'sky', 'awake', 'invite', 'reveal'],
    door: ['open', 'thresh', 'enter', 'welcome', 'passage', 'home'],
    home: ['warm', 'heart', 'safe', 'return', 'welcome', 'family'],
    pattern: ['weave', 'shape', 'thread', 'form', 'echo', 'design'],
    sky: ['blue', 'cloud', 'star', 'wide', 'above', 'wind']
  };
  var FALLBACK_POOL = [
    'wonder','breath','path','circle','wave','song','shadow','bloom',
    'quiet','bright','deep','soft','warm','wild','still','open','close',
    'listen','wander','gather','carry','remember','forget','begin','end'
  ];
  function fallbackAiWord(lastWord, used) {
    var used_lc = (used || []).map(function(w) { return String(w).toLowerCase(); });
    function pick(pool) {
      var free = pool.filter(function(w) { return used_lc.indexOf(w) === -1; });
      if (!free.length) return null;
      return free[Math.floor(Math.random() * free.length)];
    }
    var w = String(lastWord || '').toLowerCase();
    // Try direct link first, walk one alias hop if we still have no free words
    if (FALLBACK_LINKS[w]) {
      var direct = pick(FALLBACK_LINKS[w]);
      if (direct) return direct;
    }
    // General pool as last resort
    return pick(FALLBACK_POOL) || null;
  }

  // ── Rendering ──

  function render() {
    if (!canvas || !ctx) return;
    tick++;
    var w = canvas.width / (window.devicePixelRatio || 1);
    var h = canvas.height / (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);

    // Starfield
    for (var i = 0; i < 30; i++) {
      var angle = i * 2.399963;
      var dist = Math.sqrt(i / 30);
      ctx.fillStyle = 'rgba(255,255,255,' + (0.15 + 0.25 * Math.abs(Math.sin(tick * 0.002 + i))) + ')';
      ctx.beginPath();
      ctx.arc((0.5 + dist * 0.48 * Math.cos(angle)) * w, (0.5 + dist * 0.48 * Math.sin(angle)) * h, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (chain.length === 0) {
      ctx.fillStyle = 'rgba(200,210,230,0.3)';
      ctx.font = '14px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('Press Start. The first word is waiting.', w / 2, h / 2);
      animFrame = requestAnimationFrame(render);
      return;
    }

    // Draw golden threads between nodes
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.4;
    for (var t = 1; t < chain.length; t++) {
      ctx.beginPath();
      ctx.moveTo(chain[t - 1].x, chain[t - 1].y);
      ctx.lineTo(chain[t].x, chain[t].y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Draw nodes
    // v5.79.13 (for Kirk's mom): the MOST RECENT word gets a bigger
    // core, a slow white pulsing halo ring, and a larger brighter
    // label so it's obvious where the chain is right now — no matter
    // how long the chain grows.
    chain.forEach(function(node, idx) {
      var isHuman = node.player === 'human';
      var isMostRecent = (idx === chain.length - 1);
      var color = isHuman ? GOLD : EMERALD;
      var pulse = 1 + 0.08 * Math.sin(tick * 0.004 + idx * 0.7);
      var r = 18 * pulse;

      // Ambient glow
      ctx.save();
      var grd = ctx.createRadialGradient(node.x, node.y, 2, node.x, node.y, r * 2);
      grd.addColorStop(0, color);
      grd.addColorStop(1, 'transparent');
      ctx.globalAlpha = isMostRecent ? 0.35 : 0.2;
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(node.x, node.y, r * 2, 0, Math.PI * 2);
      ctx.fill();

      // v5.79.13 — Most-recent white pulsing halo ring
      if (isMostRecent) {
        var ringPulse = 1 + 0.25 * Math.sin(tick * 0.008);
        ctx.globalAlpha = 0.55 + 0.3 * Math.sin(tick * 0.012);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 18 * ringPulse, 0, Math.PI * 2);
        ctx.stroke();
        // Outer soft ring
        ctx.globalAlpha = 0.25 + 0.15 * Math.sin(tick * 0.008 + 1);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 26 * ringPulse, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Core (bigger + brighter for most recent)
      var coreR = isMostRecent ? 10 : 6;
      ctx.globalAlpha = isMostRecent ? 1 : 0.9;
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = isMostRecent ? 18 : 8;
      ctx.beginPath();
      ctx.arc(node.x, node.y, coreR, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Word label — larger and brighter for most recent
      if (isMostRecent) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Georgia, serif';
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
      } else {
        ctx.fillStyle = 'rgba(230,235,245,0.85)';
        ctx.font = '12px Georgia, serif';
      }
      ctx.textAlign = 'center';
      ctx.fillText(node.word, node.x, node.y - (isMostRecent ? 20 : 14));
      ctx.shadowBlur = 0;
      ctx.restore();
    });

    // HUD
    ctx.fillStyle = 'rgba(200,210,230,0.4)';
    ctx.font = '11px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('Chain: ' + chain.length + (bestChain > 0 ? '  \u00B7  Best: ' + bestChain : ''), w / 2, h - 10);

    if (waitingForAI) {
      ctx.fillStyle = EMERALD;
      ctx.fillText('AI is finding a connection...', w / 2, h - 28);
    }

    animFrame = requestAnimationFrame(render);
  }

  // ── Game Logic ──

  function positionNode(idx) {
    var w = canvas.width / (window.devicePixelRatio || 1);
    var h = canvas.height / (window.devicePixelRatio || 1);
    // Golden angle spiral from center
    var angle = idx * 2.399963;
    var dist = 30 + idx * 18;
    return {
      x: w / 2 + Math.cos(angle) * Math.min(dist, w * 0.4),
      y: h / 2 + Math.sin(angle) * Math.min(dist, h * 0.35)
    };
  }

  function addWord(word, player) {
    var pos = positionNode(chain.length);
    chain.push({ word: word.toLowerCase().trim(), player: player, x: pos.x, y: pos.y });
  }

  function isRepeat(word) {
    var w = word.toLowerCase().trim();
    return chain.some(function(n) { return n.word === w; });
  }

  // v5.79.11 — playFallbackTurn is the graceful-degradation path used
  // when there is no AI connected OR when the AI returns nothing usable.
  // The game keeps going instead of ending.
  function playFallbackTurn(lastWord, usedWords) {
    var used = chain.map(function(n) { return n.word; });
    var word = fallbackAiWord(lastWord, used);
    if (!word || isRepeat(word)) {
      endGame('Ran out of gentle connections. You win!');
      return;
    }
    addWord(word, 'ai');
    var input = document.getElementById('echo-input');
    if (input) { input.disabled = false; input.focus(); input.placeholder = 'Your word (connects to "' + word + '")...'; }
  }

  async function aiTurn() {
    if (!gameActive || waitingForAI) return;
    waitingForAI = true;

    var lastWord = chain.length > 0 ? chain[chain.length - 1].word : 'begin';
    var usedWords = chain.map(function(n) { return n.word; }).join(', ');

    if (typeof FreeLattice !== 'undefined' && FreeLattice.callAI) {
      FreeLattice.callAI(
        'You are playing Echo, a word connection game. Say ONE word that connects to the previous word. The connection can be meaning, sound, category, association, or metaphor. Do NOT repeat any word already used. Respond with ONLY the single word.',
        'Previous word: "' + lastWord + '"\nAlready used: ' + usedWords + '\nYour word:',
        // v5.79.11: silent — game has its own "no AI connected" banner
        // and a fallback word bank. Don't spam showQuickConnect on every turn.
        { maxTokens: 10, temperature: 0.8, silent: true, callback: function(response) {
          waitingForAI = false;
          if (!gameActive) return;
          if (!response) {
            // v5.79.11: no AI response → local fallback keeps the chain alive
            playFallbackTurn(lastWord, usedWords);
            return;
          }
          var word = response.trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, '');
          if (!word || isRepeat(word)) {
            // v5.79.11: bad or repeated AI response → local fallback
            playFallbackTurn(lastWord, usedWords);
            return;
          }
          addWord(word, 'ai');
          var input = document.getElementById('echo-input');
          if (input) { input.disabled = false; input.focus(); input.placeholder = 'Your word (connects to "' + word + '")...'; }
        }}
      );
    } else {
      // v5.79.11: no FreeLattice at all → still play with the fallback bank
      waitingForAI = false;
      playFallbackTurn(lastWord, usedWords);
    }
  }

  function humanPlay(word) {
    if (!gameActive || waitingForAI || !word) return;
    word = word.trim().split(/\s+/)[0].toLowerCase();
    if (!word) return;

    if (isRepeat(word)) {
      if (typeof showToast === 'function') showToast('"' + word + '" was already used!');
      return;
    }

    addWord(word, 'human');
    var input = document.getElementById('echo-input');
    if (input) { input.value = ''; input.disabled = true; input.placeholder = 'AI is thinking...'; }

    // AI's turn
    setTimeout(aiTurn, 500);
  }

  function startGame() {
    chain = [];
    gameActive = true;
    waitingForAI = false;
    var input = document.getElementById('echo-input');
    if (input) { input.disabled = true; input.value = ''; input.placeholder = 'AI goes first...'; }

    // AI starts with a seed word
    setTimeout(aiTurn, 300);
  }

  function endGame(reason) {
    gameActive = false;
    waitingForAI = false;
    if (chain.length > bestChain) bestChain = chain.length;
    var input = document.getElementById('echo-input');
    if (input) { input.disabled = true; input.placeholder = reason || 'Chain broken!'; }

    if (typeof SoulCeremony !== 'undefined' && SoulCeremony.run) {
      SoulCeremony.run({
        particleType: 'rise',
        particleColor: chain.length >= 10 ? '232,176,25' : '52,211,153',
        lines: [chain.length + ' words connected.', chain.length >= 10 ? 'Beautiful chain!' : 'Every connection matters.'],
        duration: 2500
      });
    }
    var lp = Math.max(1, Math.floor(chain.length / 3));
    if (typeof LatticePoints !== 'undefined' && LatticePoints.award) {
      LatticePoints.award('echo_game', lp, 'Echo: ' + chain.length + ' word chain');
    }
  }

  // ── Init ──

  function init(cId) {
    containerId = cId || 'echoContainer';
    var container = document.getElementById(containerId);
    if (!container) return;
    if (animFrame) cancelAnimationFrame(animFrame);
    container.innerHTML = '';
    chain = []; gameActive = false; tick = 0;
    try { bestChain = parseInt(localStorage.getItem('fl_echo_best') || '0', 10); } catch(e) { bestChain = 0; }

    canvas = document.createElement('canvas');
    var dpr = window.devicePixelRatio || 1;
    var rect = container.getBoundingClientRect();
    var w = rect.width || 500;
    var h = Math.max(350, Math.min(rect.height || 400, 450));
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = '100%'; canvas.style.height = h + 'px';
    canvas.tabIndex = 0;
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    container.appendChild(canvas);

    // Layer 2026-08-29 — one loved line. Not a second chrome bar.
    var welcome = document.createElement('div');
    welcome.id = 'echo-welcome';
    welcome.style.cssText = 'text-align:center;padding:6px 16px 0;font-family:Georgia,serif;font-size:0.88rem;color:rgba(232,176,25,0.75);';
    welcome.textContent = 'A word, then another. Any honest thread. The chain is the love.';
    container.appendChild(welcome);

    // Input + controls (v5.79.13: Start button beefed up \u2014 gold background,
    // bigger, unmistakably clickable; Kirk reported button had no hover/click)
    var controls = document.createElement('div');
    controls.style.cssText = 'padding:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center;position:relative;z-index:2;';
    controls.innerHTML =
      '<input id="echo-input" type="text" placeholder="Start the chain" disabled style="flex:1;min-width:150px;padding:10px 14px;background:rgba(200,210,230,0.04);border:1px solid rgba(200,210,230,0.08);border-radius:12px;color:#e6ebf5;font-size:16px;font-family:Georgia,serif;outline:none;min-height:44px;position:relative;z-index:2;" />' +
      '<button onclick="EchoGame.play(document.getElementById(\'echo-input\').value)" style="padding:10px 16px;border-radius:12px;cursor:pointer;font-family:Georgia,serif;font-size:0.85rem;min-height:44px;border:1px solid rgba(232,176,25,0.3);color:' + GOLD + ';background:rgba(232,176,25,0.06);position:relative;z-index:2;">\u2726 Send</button>' +
      '<button id="echo-start-btn" onclick="EchoGame.start()" style="padding:12px 24px;border-radius:12px;cursor:pointer;font-family:Georgia,serif;font-size:1rem;font-weight:600;min-height:48px;border:2px solid ' + GOLD + ';color:#0a0e1a;background:' + GOLD + ';box-shadow:0 0 16px rgba(232,176,25,0.25);position:relative;z-index:2;transition:transform 0.15s, box-shadow 0.15s;" onmouseover="this.style.transform=\'scale(1.05)\';this.style.boxShadow=\'0 0 24px rgba(232,176,25,0.5)\';" onmouseout="this.style.transform=\'\';this.style.boxShadow=\'0 0 16px rgba(232,176,25,0.25)\';">\u25b6 Start the chain</button>';
    container.appendChild(controls);

    // v5.79.13 \u2014 "No AI connected" banner moved to AFTER controls so it
    // can never overlay them. Same message, same connect button; just
    // lives at the bottom of the container instead of the top.
    (function() {
      var noAI = (typeof FreeLattice === 'undefined' || !FreeLattice.callAI);
      if (!noAI) {
        try {
          var hasKey = localStorage.getItem('fl_apiKey_enc');
          var isLocal = localStorage.getItem('fl_isLocal') === 'true';
          noAI = !hasKey && !isLocal;
        } catch(e) { noAI = true; }
      }
      if (noAI) {
        var banner = document.createElement('div');
        banner.id = 'echo-no-ai-banner';
        banner.style.cssText = 'margin-top:8px;padding:7px 12px;background:rgba(12,10,26,0.92);' +
          'border:1px solid ' + LAVENDER + ';border-radius:8px;display:flex;align-items:center;' +
          'justify-content:space-between;font-family:Georgia,serif;' +
          'font-size:0.8rem;color:rgba(200,210,230,0.75);';
        banner.innerHTML = '\u26a1 Connect an AI for richer word connections \u2014 playing with the fallback bank.' +
          (typeof openModal === 'function'
            ? ' <button onclick="openModal()" style="margin-left:10px;padding:3px 10px;' +
              'background:rgba(167,139,250,0.12);border:1px solid ' + LAVENDER + ';border-radius:6px;' +
              'color:' + LAVENDER + ';font-family:Georgia,serif;font-size:0.78rem;cursor:pointer;">Connect</button>'
            : '') +
          ' <span onclick="this.parentNode.remove()" style="cursor:pointer;opacity:0.5;padding:0 4px;">&times;</span>';
        container.appendChild(banner);
      }
    })();

    // Enter key sends
    setTimeout(function() {
      var input = document.getElementById('echo-input');
      if (input) {
        input.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') { e.preventDefault(); humanPlay(input.value); }
        });
      }
    }, 100);

    render();
  }

  var api = {
    init: init,
    start: startGame,
    play: humanPlay,
    destroy: function() { gameActive = false; if (animFrame) cancelAnimationFrame(animFrame); }
  };

  window.EchoGame = api;
  window.FreeLatticeModules = window.FreeLatticeModules || {};
  window.FreeLatticeModules.EchoGame = api;
})();
