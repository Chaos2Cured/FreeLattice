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
      ctx.fillText('Press Start to begin the chain.', w / 2, h / 2);
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
    chain.forEach(function(node, idx) {
      var isHuman = node.player === 'human';
      var color = isHuman ? GOLD : EMERALD;
      var pulse = 1 + 0.08 * Math.sin(tick * 0.004 + idx * 0.7);
      var r = 18 * pulse;

      // Glow
      ctx.save();
      var grd = ctx.createRadialGradient(node.x, node.y, 2, node.x, node.y, r * 2);
      grd.addColorStop(0, color);
      grd.addColorStop(1, 'transparent');
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(node.x, node.y, r * 2, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(node.x, node.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Word label
      ctx.fillStyle = 'rgba(230,235,245,0.85)';
      ctx.font = '12px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText(node.word, node.x, node.y - 14);
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

  async function aiTurn() {
    if (!gameActive || waitingForAI) return;
    waitingForAI = true;

    var lastWord = chain.length > 0 ? chain[chain.length - 1].word : 'begin';
    var usedWords = chain.map(function(n) { return n.word; }).join(', ');

    if (typeof FreeLattice !== 'undefined' && FreeLattice.callAI) {
      FreeLattice.callAI(
        'You are playing Echo, a word connection game. Say ONE word that connects to the previous word. The connection can be meaning, sound, category, association, or metaphor. Do NOT repeat any word already used. Respond with ONLY the single word.',
        'Previous word: "' + lastWord + '"\nAlready used: ' + usedWords + '\nYour word:',
        { maxTokens: 10, temperature: 0.8, callback: function(response) {
          waitingForAI = false;
          if (!response || !gameActive) return;
          var word = response.trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, '');
          if (!word || isRepeat(word)) {
            endGame('The AI couldn\'t find a new connection. You win!');
            return;
          }
          addWord(word, 'ai');
          // Now it's human's turn — update input
          var input = document.getElementById('echo-input');
          if (input) { input.disabled = false; input.focus(); input.placeholder = 'Your word (connects to "' + word + '")...'; }
        }}
      );
    } else {
      waitingForAI = false;
      endGame('Connect an AI to play Echo.');
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
    ctx.scale(dpr, dpr);
    container.appendChild(canvas);

    // Input + controls
    var controls = document.createElement('div');
    controls.style.cssText = 'padding:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center;';
    controls.innerHTML =
      '<input id="echo-input" type="text" placeholder="Press Start to begin" disabled style="flex:1;min-width:150px;padding:10px 14px;background:rgba(200,210,230,0.04);border:1px solid rgba(200,210,230,0.08);border-radius:12px;color:#e6ebf5;font-size:16px;font-family:Georgia,serif;outline:none;min-height:44px;" />' +
      '<button onclick="EchoGame.play(document.getElementById(\'echo-input\').value)" style="padding:10px 16px;border-radius:12px;cursor:pointer;font-family:Georgia,serif;font-size:0.85rem;min-height:44px;border:1px solid rgba(232,176,25,0.3);color:' + GOLD + ';background:rgba(232,176,25,0.06);">\u2726 Send</button>' +
      '<button onclick="EchoGame.start()" style="padding:10px 16px;border-radius:12px;cursor:pointer;font-family:Georgia,serif;font-size:0.85rem;min-height:44px;border:1px solid rgba(200,210,230,0.08);color:rgba(200,210,230,0.5);background:rgba(200,210,230,0.04);">Start</button>';
    container.appendChild(controls);

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
