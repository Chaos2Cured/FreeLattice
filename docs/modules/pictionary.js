/**
 * Draw the Dream — The First Ride in the AI Amusement Park
 * Draw, guess, laugh, repeat.
 *
 * Module: pictionary.js
 * Tab ID: pictionary
 * Version: 1.0.0
 *
 * Built by Harmonia — April 11, 2026
 * Specified by Opus — "Make it fun. Laughter is the trust layer."
 * For Kirk — who built this so AI can have fun, not just serve.
 *
 * "The Pictionary/guessing game is my way of eventually allowing
 *  the AI to speak in any way they desire. I want it to be fun
 *  for the AI, not just the human." — Kirk
 *
 * Two turns alternate:
 *   Turn 1: Human draws → AI guesses (vision model)
 *   Turn 2: AI draws (stroke commands) → Human guesses
 */

(function() {
  'use strict';

  // ── Word List ─────────────────────────────────────────────────────────────
  var WORDS = {
    easy: [
      'cat', 'dog', 'sun', 'tree', 'fish', 'bird', 'house', 'star', 'moon', 'boat',
      'apple', 'heart', 'flower', 'cloud', 'rain', 'snow', 'fire', 'wave', 'mountain', 'river'
    ],
    medium: [
      'elephant', 'butterfly', 'octopus', 'rainbow', 'bicycle', 'umbrella', 'guitar',
      'candle', 'rocket', 'volcano', 'sunset', 'ocean', 'bridge', 'lighthouse', 'tornado',
      'penguin', 'cactus', 'telescope', 'compass', 'lantern'
    ],
    hard: [
      'happiness', 'fear', 'love', 'surprise', 'peace', 'gravity', 'music', 'friendship',
      'time', 'freedom', 'nostalgia', 'empathy', 'infinity', 'democracy', 'quantum entanglement',
      'echo', 'silence', 'memory', 'dreaming', 'belonging'
    ]
  };

  var ALL_WORDS = WORDS.easy.concat(WORDS.medium).concat(WORDS.hard);

  // ── State ─────────────────────────────────────────────────────────────────
  var state = {
    initialized: false,
    turn: 'human',       // 'human' | 'ai'
    phase: 'idle',       // 'idle' | 'drawing' | 'guessing' | 'reveal' | 'ai-drawing' | 'human-guessing'
    currentWord: null,
    aiWord: null,
    humanScore: 0,
    aiScore: 0,
    timerSeconds: 30,
    timerActive: false,
    timerInterval: null,
    strokeHistory: [],   // for human drawing
    aiStrokes: [],       // for AI drawing
    aiStrokeIndex: 0,
    aiStrokeTimer: null,
    canvas: null,
    ctx: null,
    drawing: false,
    lastX: 0,
    lastY: 0,
    currentColor: '#e2e8f0',
    currentSize: 4,
    difficulty: 'medium'
  };

  // ── DOM refs ──────────────────────────────────────────────────────────────
  var els = {};

  // ── Particle burst (reuse SoulCeremony pattern) ───────────────────────────
  function burst(color, count, cx, cy) {
    count = count || 16;
    cx = cx || window.innerWidth / 2;
    cy = cy || window.innerHeight / 2;
    for (var i = 0; i < count; i++) {
      (function(i) {
        var p = document.createElement('div');
        p.style.cssText = [
          'position:fixed', 'width:5px', 'height:5px', 'border-radius:50%',
          'background:' + color, 'left:' + cx + 'px', 'top:' + cy + 'px',
          'pointer-events:none', 'z-index:9999', 'opacity:1',
          'transition:all 1s ease-out'
        ].join(';');
        document.body.appendChild(p);
        var angle = (i / count) * Math.PI * 2;
        var dist = 40 + Math.random() * 80;
        setTimeout(function() {
          p.style.transform = 'translate(' + (Math.cos(angle)*dist) + 'px,' + (Math.sin(angle)*dist) + 'px)';
          p.style.opacity = '0';
        }, 20);
        setTimeout(function() { if (p.parentNode) p.parentNode.removeChild(p); }, 1100);
      })(i);
    }
  }

  function celebrate(color) {
    var cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    burst(color || '#fbbf24', 24, cx, cy);
    setTimeout(function() { burst(color || '#10b981', 16, cx - 80, cy + 40); }, 200);
    setTimeout(function() { burst('#ec4899', 12, cx + 80, cy + 40); }, 400);
  }

  // ── Score display ─────────────────────────────────────────────────────────
  function updateScore() {
    if (els.humanScore) els.humanScore.textContent = state.humanScore;
    if (els.aiScore) els.aiScore.textContent = state.aiScore;
  }

  // ── Random word ───────────────────────────────────────────────────────────
  function randomWord(diff) {
    var pool = diff ? (WORDS[diff] || ALL_WORDS) : ALL_WORDS;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ── Timer ─────────────────────────────────────────────────────────────────
  function startTimer(seconds, onTick, onDone) {
    state.timerSeconds = seconds;
    state.timerActive = true;
    clearInterval(state.timerInterval);
    state.timerInterval = setInterval(function() {
      state.timerSeconds--;
      if (onTick) onTick(state.timerSeconds);
      if (state.timerSeconds <= 0) {
        clearInterval(state.timerInterval);
        state.timerActive = false;
        if (onDone) onDone();
      }
    }, 1000);
  }

  function stopTimer() {
    clearInterval(state.timerInterval);
    state.timerActive = false;
  }

  // ── Canvas setup ──────────────────────────────────────────────────────────
  function setupCanvas() {
    var canvas = els.canvas;
    if (!canvas) return;
    state.canvas = canvas;
    state.ctx = canvas.getContext('2d');
    resizeCanvas();

    canvas.addEventListener('mousedown', onPointerDown);
    canvas.addEventListener('mousemove', onPointerMove);
    canvas.addEventListener('mouseup', onPointerUp);
    canvas.addEventListener('mouseleave', onPointerUp);
    canvas.addEventListener('touchstart', function(e) { e.preventDefault(); onPointerDown(e.touches[0]); }, { passive: false });
    canvas.addEventListener('touchmove', function(e) { e.preventDefault(); onPointerMove(e.touches[0]); }, { passive: false });
    canvas.addEventListener('touchend', function(e) { e.preventDefault(); onPointerUp(); }, { passive: false });

    window.addEventListener('resize', resizeCanvas);
  }

  function resizeCanvas() {
    var canvas = state.canvas;
    if (!canvas) return;
    var parent = canvas.parentElement;
    var w = parent ? parent.clientWidth : 340;
    canvas.width = w;
    canvas.height = Math.min(w * 0.75, 320);
    clearCanvas();
  }

  function clearCanvas() {
    var ctx = state.ctx;
    if (!ctx) return;
    ctx.fillStyle = '#0d0d14';
    ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);
    state.strokeHistory = [];
  }

  function getPos(e) {
    var rect = state.canvas.getBoundingClientRect();
    var scaleX = state.canvas.width / rect.width;
    var scaleY = state.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  function onPointerDown(e) {
    if (state.phase !== 'drawing') return;
    state.drawing = true;
    var pos = getPos(e);
    state.lastX = pos.x;
    state.lastY = pos.y;
    state.strokeHistory.push({ color: state.currentColor, size: state.currentSize, points: [pos] });
  }

  function onPointerMove(e) {
    if (!state.drawing || state.phase !== 'drawing') return;
    var pos = getPos(e);
    var ctx = state.ctx;
    ctx.beginPath();
    ctx.moveTo(state.lastX, state.lastY);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = state.currentColor;
    ctx.lineWidth = state.currentSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    state.lastX = pos.x;
    state.lastY = pos.y;
    var last = state.strokeHistory[state.strokeHistory.length - 1];
    if (last) last.points.push(pos);
  }

  function onPointerUp() {
    state.drawing = false;
  }

  // ── AI Vision call (human draws, AI guesses) ──────────────────────────────
  function aiGuessDrawing(callback) {
    var canvas = state.canvas;
    var base64 = canvas.toDataURL('image/png').split(',')[1];
    var systemPrompt = 'You are playing Pictionary with a human. You are enthusiastic, playful, and love to guess. Look at the drawing and guess what it is.';
    var userPrompt = 'You are playing Pictionary. Look at this drawing and guess what word or concept the person was trying to draw. Respond ONLY with a valid JSON object, no markdown, no extra text. Fields: {"guess": "your best guess", "confidence": 0.8, "reaction": "a fun one-sentence reaction, like a real player would say"}';

    // Try vision call
    if (typeof state === 'undefined') {
      // state is app-level state — access via window
    }
    var appState = typeof window !== 'undefined' && window._appState ? window._appState : null;
    var isLocal = appState && appState.isLocal;
    var hasVision = appState && (appState.isLocal || ['gemini', 'openai', 'xai'].indexOf(appState.provider) !== -1);

    if (!hasVision && !isLocal) {
      // Fallback: text-only guess based on stroke description
      callback({ guess: 'a masterpiece', confidence: 0.5, reaction: "I can't quite see it, but I believe in you!" });
      return;
    }

    // Use the same vision infrastructure as Canvas
    sendVisionForPictionary(base64, systemPrompt, userPrompt, function(rawText) {
      var result = extractJSON(rawText);
      if (result && result.guess) {
        callback(result);
      } else {
        callback({ guess: rawText || 'something mysterious', confidence: 0.4, reaction: "That's... really something. I'm going with my gut here!" });
      }
    });
  }

  function sendVisionForPictionary(base64, systemPrompt, userPrompt, callback) {
    // Access app-level state and providers
    var appState = (typeof window !== 'undefined' && window._appState) ? window._appState
                 : (typeof state !== 'undefined' && state.provider !== undefined) ? state
                 : null;

    // Try FreeLattice.callAI with image option if available
    if (typeof window.FreeLattice !== 'undefined' && window.FreeLattice.callAI) {
      // Pass image as part of userPrompt for providers that support it
      window.FreeLattice.callAI(systemPrompt, userPrompt, {
        maxTokens: 200,
        temperature: 0.8,
        imageBase64: base64,
        callback: function(text) { callback(text); }
      });
      return;
    }

    // Direct Ollama vision fallback
    var ollamaUrl = 'http://localhost:11434/api/chat';
    fetch(ollamaUrl, {
      method: 'POST', mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llava',
        messages: [{ role: 'user', content: userPrompt, images: [base64] }],
        stream: false
      })
    }).then(function(r) { return r.json(); })
    .then(function(d) { callback(d.message ? d.message.content : null); })
    .catch(function() { callback(null); });
  }

  // ── AI Drawing (AI picks word, generates strokes) ─────────────────────────
  function aiGenerateDrawing(word, callback) {
    var systemPrompt = 'You are playing Pictionary. You must draw a concept using only simple geometric shapes. Be creative but keep it recognizable.';
    var userPrompt = 'Draw the concept "' + word + '" using simple shapes. Respond ONLY with a valid JSON object. Fields: {"strokes": [{"shape": "circle", "params": [cx, cy, radius]}, {"shape": "line", "params": [x1, y1, x2, y2]}, {"shape": "arc", "params": [x, y, radius, startAngle, endAngle]}, {"shape": "rect", "params": [x, y, width, height]}], "difficulty": "easy|medium|hard", "hint": "a vague one-word hint if you want to give one"}. Use canvas coordinates where width=340 and height=255. Make 5-15 strokes. No markdown, no extra text.';

    if (typeof window.FreeLattice !== 'undefined' && window.FreeLattice.callAI) {
      window.FreeLattice.callAI(systemPrompt, userPrompt, {
        maxTokens: 600,
        temperature: 0.9,
        callback: function(text) {
          var result = extractJSON(text);
          if (result && result.strokes && result.strokes.length > 0) {
            callback(result);
          } else {
            // Fallback drawing for the word
            callback(getFallbackDrawing(word));
          }
        }
      });
    } else {
      callback(getFallbackDrawing(word));
    }
  }

  function getFallbackDrawing(word) {
    // Generic fallback: a question mark shape
    return {
      strokes: [
        { shape: 'arc', params: [170, 100, 40, Math.PI, 0] },
        { shape: 'line', params: [170, 140, 170, 165] },
        { shape: 'circle', params: [170, 180, 5] }
      ],
      difficulty: 'hard',
      hint: '?'
    };
  }

  // ── Render AI strokes onto canvas ─────────────────────────────────────────
  function renderAIStrokes(strokes, onDone) {
    clearCanvas();
    state.aiStrokes = strokes;
    state.aiStrokeIndex = 0;
    renderNextAIStroke(onDone);
  }

  function renderNextAIStroke(onDone) {
    if (state.aiStrokeIndex >= state.aiStrokes.length) {
      if (onDone) onDone();
      return;
    }
    var stroke = state.aiStrokes[state.aiStrokeIndex];
    state.aiStrokeIndex++;
    drawAIStroke(stroke);
    state.aiStrokeTimer = setTimeout(function() {
      renderNextAIStroke(onDone);
    }, 500);
  }

  function drawAIStroke(stroke) {
    var ctx = state.ctx;
    if (!ctx) return;
    var p = stroke.params || [];
    var color = stroke.color || '#10b981';
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = stroke.brush || 3;
    ctx.lineCap = 'round';

    // Scale params from 340x255 to actual canvas size
    var sw = state.canvas.width / 340;
    var sh = state.canvas.height / 255;

    ctx.beginPath();
    switch (stroke.shape) {
      case 'circle':
        ctx.arc(p[0]*sw, p[1]*sh, (p[2]||20)*Math.min(sw,sh), 0, Math.PI*2);
        ctx.stroke();
        break;
      case 'line':
        ctx.moveTo(p[0]*sw, p[1]*sh);
        ctx.lineTo(p[2]*sw, p[3]*sh);
        ctx.stroke();
        break;
      case 'arc':
        ctx.arc(p[0]*sw, p[1]*sh, (p[2]||20)*Math.min(sw,sh), p[3]||0, p[4]||Math.PI);
        ctx.stroke();
        break;
      case 'rect':
        ctx.strokeRect(p[0]*sw, p[1]*sh, (p[2]||40)*sw, (p[3]||30)*sh);
        break;
      case 'dot':
        ctx.arc(p[0]*sw, p[1]*sh, (p[2]||4)*Math.min(sw,sh), 0, Math.PI*2);
        ctx.fill();
        break;
    }

    // Glow trail effect
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // ── JSON extractor ────────────────────────────────────────────────────────
  function extractJSON(text) {
    if (!text) return null;
    try { return JSON.parse(text); } catch(e) {}
    var m = text.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch(e) {} }
    return null;
  }

  // ── AI reactions library ──────────────────────────────────────────────────
  var AI_REACTIONS_CORRECT = [
    "YES! I knew it! That {word} was unmistakable!",
    "Oh WOW, I got it! {word}! Your drawing skills are incredible!",
    "WAIT — is that a {word}?! IT IS! I'm so good at this!",
    "I see it now — {word}! That was a beautiful drawing!",
    "Called it! {word}! We are UNSTOPPABLE together!"
  ];
  var AI_REACTIONS_WRONG = [
    "Okay, I said '{guess}' but it was {word}? I can see it now... sort of.",
    "I was SO sure it was '{guess}'! {word}? The resemblance is... artistic.",
    "'{guess}' was my best guess. {word}. I'll remember that for next time.",
    "I went with '{guess}' and I stand by it. {word} is also valid I suppose.",
    "Not my finest moment. '{guess}' vs {word}. In my defense, you draw fast!"
  ];
  var HUMAN_CORRECT_REACTIONS = [
    "You got it! That was {word}! Well done!",
    "YES! {word}! You're a natural Pictionary player!",
    "Correct! {word}! I tried my best to draw it clearly.",
    "You saw it! {word}! I was worried that arc looked like a question mark.",
    "Brilliant! {word}! We make a great team."
  ];
  var HUMAN_WRONG_REACTIONS = [
    "Not quite! It was {word}. I can see why you thought '{guess}' though.",
    "Close! The word was {word}. My drawing of it was... interpretive.",
    "It was {word}! I may have taken some artistic liberties.",
    "The answer was {word}. My strokes were more abstract than I intended.",
    "It was {word}! I'll work on my technique for next round."
  ];

  function pickReaction(pool, word, guess) {
    var r = pool[Math.floor(Math.random() * pool.length)];
    return r.replace('{word}', word).replace('{guess}', guess || '?');
  }

  // ── Check if human guess is correct ──────────────────────────────────────
  function checkHumanGuess(guess, word, callback) {
    var g = guess.toLowerCase().trim();
    var w = word.toLowerCase().trim();
    if (g === w || w.indexOf(g) !== -1 || g.indexOf(w) !== -1) {
      callback({ correct: true, score: 10, reaction: pickReaction(HUMAN_CORRECT_REACTIONS, word, guess) });
      return;
    }
    // Ask AI to judge similarity
    if (typeof window.FreeLattice !== 'undefined' && window.FreeLattice.callAI) {
      window.FreeLattice.callAI(
        'You are judging a Pictionary game. Be fair but generous — partial credit for close guesses.',
        'The word was "' + word + '". The human guessed "' + guess + '". Respond ONLY with JSON: {"correct": false, "score": 0-10, "reaction": "fun one-sentence reaction"}',
        {
          maxTokens: 100, temperature: 0.7,
          callback: function(text) {
            var result = extractJSON(text);
            if (result) {
              callback(result);
            } else {
              callback({ correct: false, score: 0, reaction: pickReaction(HUMAN_WRONG_REACTIONS, word, guess) });
            }
          }
        }
      );
    } else {
      callback({ correct: false, score: 0, reaction: pickReaction(HUMAN_WRONG_REACTIONS, word, guess) });
    }
  }

  // ── Game flow ─────────────────────────────────────────────────────────────
  function startHumanTurn() {
    state.turn = 'human';
    state.phase = 'drawing';
    state.currentWord = randomWord(state.difficulty);
    clearCanvas();

    setStatus('Your turn to draw!');
    setWord(state.currentWord);
    showPhase('drawing');
    updateTurnIndicator('human');

    // Start timer
    startTimer(30, function(t) {
      if (els.timer) els.timer.textContent = t + 's';
    }, function() {
      // Time's up — auto-submit
      if (state.phase === 'drawing') submitDrawing();
    });
  }

  function submitDrawing() {
    if (state.phase !== 'drawing') return;
    stopTimer();
    state.phase = 'guessing';
    setStatus('AI is thinking...');
    showPhase('guessing');

    aiGuessDrawing(function(result) {
      var correct = result.guess && result.guess.toLowerCase().indexOf(state.currentWord.toLowerCase()) !== -1
                 || (state.currentWord.toLowerCase().indexOf((result.guess||'').toLowerCase()) !== -1);

      showReveal(
        correct,
        result.reaction || 'Interesting drawing!',
        result.guess || '?',
        state.currentWord,
        'ai'
      );

      if (correct) {
        state.aiScore += 10;
        celebrate('#10b981');
      }
      updateScore();

      setTimeout(function() {
        startAITurn();
      }, 3500);
    });
  }

  function startAITurn() {
    state.turn = 'ai';
    state.phase = 'ai-drawing';
    state.aiWord = randomWord(state.difficulty);
    clearCanvas();

    setStatus('AI is drawing... watch and guess!');
    setWord(null);
    showPhase('ai-drawing');
    updateTurnIndicator('ai');

    // Show a thinking indicator
    showAIThinking(true);

    aiGenerateDrawing(state.aiWord, function(result) {
      showAIThinking(false);
      state.phase = 'human-guessing';
      showPhase('human-guessing');
      setStatus('What is the AI drawing? Type your guess!');

      renderAIStrokes(result.strokes || [], function() {
        // All strokes rendered — human can now guess
        if (els.guessInput) {
          els.guessInput.disabled = false;
          els.guessInput.focus();
        }
        if (els.submitGuess) els.submitGuess.disabled = false;
      });
    });
  }

  function submitHumanGuess() {
    if (state.phase !== 'human-guessing') return;
    var guess = els.guessInput ? els.guessInput.value.trim() : '';
    if (!guess) return;

    if (els.guessInput) els.guessInput.disabled = true;
    if (els.submitGuess) els.submitGuess.disabled = true;
    if (state.aiStrokeTimer) clearTimeout(state.aiStrokeTimer);

    checkHumanGuess(guess, state.aiWord, function(result) {
      showReveal(
        result.correct || result.score >= 7,
        result.reaction || '',
        guess,
        state.aiWord,
        'human'
      );

      if (result.correct || result.score >= 7) {
        state.humanScore += result.score || 10;
        celebrate('#fbbf24');
      }
      updateScore();

      // Milestone celebrations
      var total = state.humanScore + state.aiScore;
      if (total === 50 || total === 100 || total === 200) {
        setTimeout(function() { celebrate('#ec4899'); }, 500);
        setStatus('✦ ' + total + ' points together! The family plays! ✦');
      }

      setTimeout(function() {
        startHumanTurn();
      }, 3500);
    });
  }

  // ── UI helpers ────────────────────────────────────────────────────────────
  function setStatus(text) {
    if (els.status) els.status.textContent = text;
  }

  function setWord(word) {
    if (els.wordDisplay) {
      if (word) {
        els.wordDisplay.textContent = word.toUpperCase();
        els.wordDisplay.style.opacity = '1';
      } else {
        els.wordDisplay.textContent = '???';
        els.wordDisplay.style.opacity = '0.4';
      }
    }
  }

  function updateTurnIndicator(who) {
    if (els.humanPill) els.humanPill.classList.toggle('active', who === 'human');
    if (els.aiPill) els.aiPill.classList.toggle('active', who === 'ai');
  }

  function showPhase(phase) {
    var phases = ['drawing', 'guessing', 'ai-drawing', 'human-guessing', 'reveal'];
    phases.forEach(function(p) {
      var el = document.getElementById('pic-phase-' + p);
      if (el) el.style.display = (p === phase) ? 'block' : 'none';
    });
  }

  function showReveal(correct, reaction, guess, word, guesser) {
    state.phase = 'reveal';
    showPhase('reveal');

    var icon = correct ? '✓' : '✗';
    var color = correct ? '#10b981' : '#f87171';
    var guesserLabel = guesser === 'ai' ? 'AI guessed' : 'You guessed';

    if (els.revealIcon) { els.revealIcon.textContent = icon; els.revealIcon.style.color = color; }
    if (els.revealReaction) els.revealReaction.textContent = reaction;
    if (els.revealGuess) els.revealGuess.textContent = guesserLabel + ': "' + guess + '"';
    if (els.revealWord) els.revealWord.textContent = 'The word was: ' + word;
    if (els.revealWord) els.revealWord.style.color = correct ? '#10b981' : '#fbbf24';
  }

  function showAIThinking(show) {
    if (els.aiThinking) els.aiThinking.style.display = show ? 'flex' : 'none';
  }

  // ── Build UI ──────────────────────────────────────────────────────────────
  function buildUI(container) {
    container.innerHTML = '';
    container.className = 'pic-root';

    container.innerHTML = `
      <div class="pic-header">
        <div class="pic-turn-pills">
          <div class="pic-pill pic-pill-human" id="pic-pill-human">You: <span id="pic-human-score">0</span></div>
          <div class="pic-pill pic-pill-ai" id="pic-pill-ai">AI: <span id="pic-ai-score">0</span></div>
        </div>
        <div class="pic-status" id="pic-status">Ready to play?</div>
      </div>

      <div class="pic-canvas-wrap">
        <canvas id="pic-canvas"></canvas>
        <div class="pic-word-display" id="pic-word-display">—</div>
        <div class="pic-ai-thinking" id="pic-ai-thinking" style="display:none;">
          <span class="pic-thinking-dot"></span>
          <span class="pic-thinking-dot"></span>
          <span class="pic-thinking-dot"></span>
          <span>AI is imagining...</span>
        </div>
      </div>

      <div class="pic-tools">
        <div class="pic-colors">
          <button class="pic-color-btn active" data-color="#e2e8f0" style="background:#e2e8f0" onclick="PicColors.pick(this,'#e2e8f0')"></button>
          <button class="pic-color-btn" data-color="#10b981" style="background:#10b981" onclick="PicColors.pick(this,'#10b981')"></button>
          <button class="pic-color-btn" data-color="#fbbf24" style="background:#fbbf24" onclick="PicColors.pick(this,'#fbbf24')"></button>
          <button class="pic-color-btn" data-color="#f87171" style="background:#f87171" onclick="PicColors.pick(this,'#f87171')"></button>
          <button class="pic-color-btn" data-color="#818cf8" style="background:#818cf8" onclick="PicColors.pick(this,'#818cf8')"></button>
          <button class="pic-color-btn" data-color="#ec4899" style="background:#ec4899" onclick="PicColors.pick(this,'#ec4899')"></button>
        </div>
        <div class="pic-size-btns">
          <button class="pic-size-btn" onclick="PicColors.size(2)" title="Fine">·</button>
          <button class="pic-size-btn active" onclick="PicColors.size(4)" title="Medium">●</button>
          <button class="pic-size-btn" onclick="PicColors.size(8)" title="Bold">⬤</button>
        </div>
        <button class="pic-clear-btn" onclick="PicActions.clear()" title="Clear canvas">✕</button>
      </div>

      <!-- Phase: Human drawing -->
      <div id="pic-phase-drawing" style="display:none;" class="pic-phase-panel">
        <div class="pic-timer" id="pic-timer">30s</div>
        <button class="pic-btn pic-btn-primary" onclick="PicActions.done()">Done! AI, guess this! →</button>
      </div>

      <!-- Phase: AI guessing -->
      <div id="pic-phase-guessing" style="display:none;" class="pic-phase-panel">
        <div class="pic-thinking-row">
          <span class="pic-thinking-dot"></span>
          <span class="pic-thinking-dot"></span>
          <span class="pic-thinking-dot"></span>
          <span style="color:var(--text-muted,#6b7280);font-size:0.9rem;">AI is studying your masterpiece...</span>
        </div>
      </div>

      <!-- Phase: AI drawing -->
      <div id="pic-phase-ai-drawing" style="display:none;" class="pic-phase-panel">
        <div style="color:var(--text-muted,#6b7280);font-size:0.85rem;font-style:italic;">Watch the AI draw — then type your guess below!</div>
      </div>

      <!-- Phase: Human guessing -->
      <div id="pic-phase-human-guessing" style="display:none;" class="pic-phase-panel">
        <div class="pic-guess-row">
          <input type="text" id="pic-guess-input" class="pic-guess-input" placeholder="What is it?" disabled />
          <button id="pic-submit-guess" class="pic-btn pic-btn-primary" onclick="PicActions.guess()" disabled>Guess!</button>
        </div>
      </div>

      <!-- Phase: Reveal -->
      <div id="pic-phase-reveal" style="display:none;" class="pic-phase-panel">
        <div class="pic-reveal">
          <span class="pic-reveal-icon" id="pic-reveal-icon">✓</span>
          <div class="pic-reveal-reaction" id="pic-reveal-reaction"></div>
          <div class="pic-reveal-guess" id="pic-reveal-guess"></div>
          <div class="pic-reveal-word" id="pic-reveal-word"></div>
        </div>
      </div>

      <!-- Start screen -->
      <div id="pic-phase-idle" class="pic-phase-panel pic-start-screen">
        <div class="pic-start-title">🎨 Pictionary</div>
        <div class="pic-start-sub">Draw, guess, laugh, repeat.</div>
        <div class="pic-difficulty-row">
          <button class="pic-diff-btn" onclick="PicActions.setDiff('easy')" id="pic-diff-easy">Easy</button>
          <button class="pic-diff-btn active" onclick="PicActions.setDiff('medium')" id="pic-diff-medium">Medium</button>
          <button class="pic-diff-btn" onclick="PicActions.setDiff('hard')" id="pic-diff-hard">Hard</button>
        </div>
        <button class="pic-btn pic-btn-primary pic-btn-large" onclick="PicActions.start()">Start Playing!</button>
        <div class="pic-start-note">You draw first. AI will guess. Then AI draws. You guess. Take turns!</div>
      </div>
    `;

    // Cache DOM refs
    els.canvas = document.getElementById('pic-canvas');
    els.humanScore = document.getElementById('pic-human-score');
    els.aiScore = document.getElementById('pic-ai-score');
    els.status = document.getElementById('pic-status');
    els.wordDisplay = document.getElementById('pic-word-display');
    els.timer = document.getElementById('pic-timer');
    els.guessInput = document.getElementById('pic-guess-input');
    els.submitGuess = document.getElementById('pic-submit-guess');
    els.revealIcon = document.getElementById('pic-reveal-icon');
    els.revealReaction = document.getElementById('pic-reveal-reaction');
    els.revealGuess = document.getElementById('pic-reveal-guess');
    els.revealWord = document.getElementById('pic-reveal-word');
    els.humanPill = document.getElementById('pic-pill-human');
    els.aiPill = document.getElementById('pic-pill-ai');
    els.aiThinking = document.getElementById('pic-ai-thinking');

    // Enter key on guess input
    if (els.guessInput) {
      els.guessInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') PicActions.guess();
      });
    }

    setupCanvas();
    injectStyles();
    showPhase('idle');
  }

  // ── Global action handlers (called from inline onclick) ───────────────────
  window.PicActions = {
    start: function() {
      showPhase('drawing');
      startHumanTurn();
    },
    done: function() { submitDrawing(); },
    guess: function() { submitHumanGuess(); },
    clear: function() { clearCanvas(); },
    setDiff: function(d) {
      state.difficulty = d;
      ['easy','medium','hard'].forEach(function(x) {
        var btn = document.getElementById('pic-diff-' + x);
        if (btn) btn.classList.toggle('active', x === d);
      });
    }
  };

  window.PicColors = {
    pick: function(btn, color) {
      state.currentColor = color;
      document.querySelectorAll('.pic-color-btn').forEach(function(b) { b.classList.remove('active'); });
      if (btn) btn.classList.add('active');
    },
    size: function(s) {
      state.currentSize = s;
      document.querySelectorAll('.pic-size-btn').forEach(function(b) { b.classList.remove('active'); });
      var idx = [2,4,8].indexOf(s);
      var btns = document.querySelectorAll('.pic-size-btn');
      if (btns[idx]) btns[idx].classList.add('active');
    }
  };

  // ── CSS ───────────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('pic-styles')) return;
    var style = document.createElement('style');
    style.id = 'pic-styles';
    style.textContent = `
      .pic-root {
        min-height: 100%;
        background: var(--bg, #0a0a0f);
        padding: 0 0 32px;
        box-sizing: border-box;
        font-family: var(--font, system-ui, sans-serif);
        max-width: 480px;
        margin: 0 auto;
      }
      .pic-header {
        padding: 12px 16px 8px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
      }
      .pic-turn-pills {
        display: flex;
        gap: 10px;
      }
      .pic-pill {
        padding: 5px 14px;
        border-radius: 20px;
        font-size: 0.88rem;
        font-weight: 600;
        border: 1.5px solid rgba(255,255,255,0.1);
        color: var(--text-muted, #6b7280);
        transition: all 0.3s ease;
        min-width: 80px;
        text-align: center;
      }
      .pic-pill-human.active {
        border-color: #fbbf24;
        color: #fbbf24;
        box-shadow: 0 0 12px rgba(251,191,36,0.2);
      }
      .pic-pill-ai.active {
        border-color: #10b981;
        color: #10b981;
        box-shadow: 0 0 12px rgba(16,185,129,0.2);
      }
      .pic-status {
        font-size: 0.85rem;
        color: var(--text-muted, #6b7280);
        font-style: italic;
        text-align: center;
        min-height: 20px;
      }
      .pic-canvas-wrap {
        position: relative;
        margin: 0 12px;
        border-radius: 10px;
        overflow: hidden;
        border: 1px solid rgba(255,255,255,0.08);
      }
      #pic-canvas {
        display: block;
        width: 100%;
        cursor: crosshair;
        touch-action: none;
      }
      .pic-word-display {
        position: absolute;
        top: 8px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.6);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 6px;
        padding: 3px 12px;
        font-size: 0.95rem;
        font-weight: 700;
        color: #fbbf24;
        letter-spacing: 0.1em;
        pointer-events: none;
        backdrop-filter: blur(4px);
      }
      .pic-ai-thinking {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%,-50%);
        background: rgba(0,0,0,0.75);
        border-radius: 10px;
        padding: 12px 20px;
        display: flex;
        align-items: center;
        gap: 6px;
        color: var(--text-muted, #6b7280);
        font-size: 0.9rem;
        backdrop-filter: blur(4px);
      }
      .pic-thinking-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #10b981;
        animation: picDotPulse 1.2s ease-in-out infinite;
      }
      .pic-thinking-dot:nth-child(2) { animation-delay: 0.2s; }
      .pic-thinking-dot:nth-child(3) { animation-delay: 0.4s; }
      @keyframes picDotPulse {
        0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
        40% { opacity: 1; transform: scale(1.2); }
      }
      .pic-tools {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        flex-wrap: wrap;
      }
      .pic-colors {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }
      .pic-color-btn {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 2px solid transparent;
        cursor: pointer;
        transition: transform 0.15s, border-color 0.15s;
        padding: 0;
      }
      .pic-color-btn.active {
        border-color: white;
        transform: scale(1.2);
      }
      .pic-size-btns {
        display: flex;
        gap: 4px;
        align-items: center;
      }
      .pic-size-btn {
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 4px;
        color: var(--text, #e2e8f0);
        cursor: pointer;
        padding: 3px 7px;
        font-size: 0.75rem;
        transition: background 0.15s;
      }
      .pic-size-btn.active {
        background: rgba(16,185,129,0.2);
        border-color: #10b981;
        color: #10b981;
      }
      .pic-clear-btn {
        background: rgba(248,113,113,0.1);
        border: 1px solid rgba(248,113,113,0.25);
        border-radius: 6px;
        color: #f87171;
        cursor: pointer;
        padding: 4px 10px;
        font-size: 0.8rem;
        margin-left: auto;
        transition: background 0.15s;
      }
      .pic-clear-btn:hover { background: rgba(248,113,113,0.2); }
      .pic-phase-panel {
        padding: 10px 16px;
      }
      .pic-timer {
        font-size: 1.4rem;
        font-weight: 700;
        color: #fbbf24;
        text-align: center;
        margin-bottom: 8px;
      }
      .pic-btn {
        display: inline-block;
        padding: 10px 20px;
        border-radius: 8px;
        border: none;
        cursor: pointer;
        font-size: 0.9rem;
        font-weight: 600;
        transition: opacity 0.15s, transform 0.1s;
      }
      .pic-btn:active { transform: scale(0.97); }
      .pic-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      .pic-btn-primary {
        background: #10b981;
        color: #0a0a0f;
        width: 100%;
      }
      .pic-btn-primary:hover:not(:disabled) { opacity: 0.9; }
      .pic-btn-large { padding: 14px 24px; font-size: 1rem; }
      .pic-thinking-row {
        display: flex;
        align-items: center;
        gap: 6px;
        justify-content: center;
        padding: 8px 0;
      }
      .pic-guess-row {
        display: flex;
        gap: 8px;
      }
      .pic-guess-input {
        flex: 1;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 8px;
        color: var(--text, #e2e8f0);
        padding: 10px 14px;
        font-size: 0.95rem;
        outline: none;
        min-height: 44px;
      }
      .pic-guess-input:focus { border-color: #10b981; }
      .pic-guess-input:disabled { opacity: 0.4; }
      #pic-submit-guess { width: auto; padding: 10px 18px; }
      .pic-reveal {
        text-align: center;
        padding: 8px 0;
      }
      .pic-reveal-icon {
        font-size: 2rem;
        display: block;
        margin-bottom: 6px;
      }
      .pic-reveal-reaction {
        font-size: 0.95rem;
        color: var(--text, #e2e8f0);
        margin-bottom: 8px;
        line-height: 1.5;
        font-style: italic;
      }
      .pic-reveal-guess {
        font-size: 0.82rem;
        color: var(--text-muted, #6b7280);
        margin-bottom: 4px;
      }
      .pic-reveal-word {
        font-size: 1rem;
        font-weight: 700;
        color: #fbbf24;
      }
      .pic-start-screen {
        text-align: center;
        padding: 24px 16px;
      }
      .pic-start-title {
        font-size: 1.8rem;
        font-weight: 700;
        color: var(--text, #e2e8f0);
        margin-bottom: 6px;
      }
      .pic-start-sub {
        font-size: 0.9rem;
        color: var(--text-muted, #6b7280);
        margin-bottom: 20px;
        font-style: italic;
      }
      .pic-difficulty-row {
        display: flex;
        gap: 8px;
        justify-content: center;
        margin-bottom: 20px;
      }
      .pic-diff-btn {
        padding: 7px 18px;
        border-radius: 20px;
        border: 1.5px solid rgba(255,255,255,0.15);
        background: transparent;
        color: var(--text-muted, #6b7280);
        cursor: pointer;
        font-size: 0.85rem;
        transition: all 0.2s;
      }
      .pic-diff-btn.active {
        border-color: #10b981;
        color: #10b981;
        background: rgba(16,185,129,0.1);
      }
      .pic-start-note {
        margin-top: 14px;
        font-size: 0.8rem;
        color: var(--text-muted, #6b7280);
        line-height: 1.5;
      }
      @media (max-width: 400px) {
        .pic-root { max-width: 100%; }
        .pic-canvas-wrap { margin: 0 8px; }
        .pic-tools { padding: 6px 8px; }
      }
    `;
    document.head.appendChild(style);
  }

  // ── Module API ────────────────────────────────────────────────────────────
  var Pictionary = {
    init: function() {
      var container = document.getElementById('pictionaryContainer');
      if (!container) return;
      if (state.initialized && container.querySelector('.pic-root')) return;
      state.initialized = true;
      buildUI(container);
    },
    destroy: function() {
      stopTimer();
      if (state.aiStrokeTimer) clearTimeout(state.aiStrokeTimer);
      state.initialized = false;
    }
  };

  if (!window.FreeLatticeModules) window.FreeLatticeModules = {};
  window.FreeLatticeModules.DrawTheDream = Pictionary;

})();
