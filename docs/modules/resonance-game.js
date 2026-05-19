// ═══════════════════════════════════════════════════════════════
// Resonance — A Game of Shared Attributes
//
// Two modes:
//   Versus — You vs the AI. Pick pieces for each other.
//   Harmony — You + the AI vs chaos. Build resonance together.
//
// 16 pieces, 4 binary attributes (glow, size, shape, color).
// 4x4 board. Win by placing 4 in a row sharing ANY attribute.
// In Versus: the twist is you pick the piece your opponent places.
// In Harmony: entropy drops random pieces on edges every 8 seconds.
//   You and the AI take turns placing strategically. Score = how
//   many lines resonate when the board fills. Max 10. Cooperation
//   is thermodynamically optimal. The game proves it.
//
// "Intelligence is not competition — it is convergence."
//
// Built by CC, May 19, 2026.
// Touch, mouse, and keyboard. Garden Language compliant.
// ═══════════════════════════════════════════════════════════════

(function() {
  'use strict';

  var ATTRS = ['glow', 'size', 'shape', 'color'];
  var ATTR_VALUES = {
    glow:  ['bright', 'dim'],
    size:  ['large', 'small'],
    shape: ['circle', 'diamond'],
    color: ['gold', 'emerald']
  };

  function generatePieces() {
    var pieces = [];
    for (var g = 0; g < 2; g++)
      for (var s = 0; s < 2; s++)
        for (var sh = 0; sh < 2; sh++)
          for (var c = 0; c < 2; c++)
            pieces.push({
              id: pieces.length,
              glow:  ATTR_VALUES.glow[g],
              size:  ATTR_VALUES.size[s],
              shape: ATTR_VALUES.shape[sh],
              color: ATTR_VALUES.color[c],
              placed: false
            });
    return pieces;
  }

  function shuffleArray(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
  }

  // ── State ──
  var board, pieces, selectedPiece, phase, currentPlayer, gameOver, winner, winLine;
  var canvas, ctx, containerId, animFrame, tick;
  var hoverCell, hoverPiece, kbCursor, kbMode;
  var boardInfo, pieceInfo;

  // Mode state
  var currentMode = 'versus'; // 'versus' or 'harmony'
  var harmonyState = null;    // { drawPile, entropyTimer, entropyCount, humanCount, aiCount }
  var flashes = [];           // visual flash effects [{r,c,color,startTick,duration}]

  var GOLD = '#e8b019';
  var EMERALD = '#34d399';
  var LAVENDER = '#a78bfa';
  var CORAL = '#f07068';

  // ── Rendering ──

  function drawPiece(piece, x, y, maxSize, isHover, isPicking) {
    var baseSize = piece.size === 'large' ? maxSize * 0.38 : maxSize * 0.22;
    var pulse = 1 + 0.04 * Math.sin(tick * 0.003 + piece.id * 0.7);
    var r = baseSize * pulse;
    var col = piece.color === 'gold' ? GOLD : EMERALD;
    var isBright = piece.glow === 'bright';
    var alpha = isBright ? 1.0 : 0.45;

    ctx.save();

    // Outer glow halo — BIGGER for bright pieces
    var haloR = r * (isBright ? 3.0 : 2.0);
    var grd = ctx.createRadialGradient(x, y, r * 0.2, x, y, haloR);
    grd.addColorStop(0, col);
    grd.addColorStop(1, 'transparent');
    ctx.globalAlpha = (isBright ? 0.35 : 0.08) * (isHover ? 1.6 : 1);
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(x, y, haloR, 0, Math.PI * 2);
    ctx.fill();

    // Core shape
    ctx.globalAlpha = isHover ? Math.min(alpha + 0.2, 1) : alpha;
    ctx.shadowColor = col;
    ctx.shadowBlur = r * (isBright ? 3.0 : 0.6);

    if (piece.shape === 'circle') {
      var sGrd = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, r * 0.1, x, y, r);
      sGrd.addColorStop(0, isBright ? '#ffffff' : 'rgba(255,255,255,0.6)');
      sGrd.addColorStop(0.3, col);
      sGrd.addColorStop(1, 'rgba(0,0,0,0.3)');
      ctx.fillStyle = sGrd;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r * 0.85, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r * 0.85, y);
      ctx.closePath();
      ctx.fill();
      var dGrd = ctx.createRadialGradient(x - r * 0.15, y - r * 0.15, 0, x, y, r * 0.7);
      dGrd.addColorStop(0, 'rgba(255,255,255,0.35)');
      dGrd.addColorStop(1, 'transparent');
      ctx.fillStyle = dGrd;
      ctx.fill();
    }

    // Selection ring (animated dash)
    if (isPicking) {
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(x, y, r + 5, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.lineDashOffset = -tick * 0.05;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  function drawBoard(w, h) {
    var bSize = Math.min(w * 0.55, h * 0.6, 320);
    var cell = bSize / 4;
    var bx = w * 0.5 - bSize * 0.5;
    var by = h * 0.1;

    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 4; c++) {
        var cx = bx + c * cell;
        var cy = by + r * cell;
        var isHov = (hoverCell && hoverCell.r === r && hoverCell.c === c) ||
                    (kbMode === 'board' && kbCursor && kbCursor.r === r && kbCursor.c === c);
        var isWin = winLine && winLine.some(function(wl) { return wl.r === r && wl.c === c; });

        // Flash effect check
        var flashColor = null;
        for (var fi = flashes.length - 1; fi >= 0; fi--) {
          var f = flashes[fi];
          if (f.r === r && f.c === c) {
            var age = tick - f.startTick;
            if (age < f.duration) {
              var fa = 1 - age / f.duration;
              flashColor = f.color.replace(/[\d.]+\)$/, (fa * 0.5) + ')');
            } else {
              flashes.splice(fi, 1);
            }
          }
        }

        ctx.fillStyle = flashColor ? flashColor :
                        isWin ? 'rgba(232,176,25,0.15)' :
                        isHov ? 'rgba(200,210,230,0.12)' : 'rgba(200,210,230,0.04)';
        ctx.fillRect(cx + 1, cy + 1, cell - 2, cell - 2);
        ctx.strokeStyle = isWin ? 'rgba(232,176,25,0.4)' : 'rgba(200,210,230,0.1)';
        ctx.lineWidth = isWin ? 2 : 1;
        ctx.strokeRect(cx + 1, cy + 1, cell - 2, cell - 2);

        if (board[r][c] !== null) {
          drawPiece(board[r][c], cx + cell * 0.5, cy + cell * 0.5, cell, false, false);
        }

        if (kbMode === 'board' && kbCursor && kbCursor.r === r && kbCursor.c === c && !gameOver) {
          ctx.strokeStyle = LAVENDER;
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 3]);
          ctx.strokeRect(cx + 3, cy + 3, cell - 6, cell - 6);
          ctx.setLineDash([]);
        }
      }
    }

    boardInfo = { bx: bx, by: by, bSize: bSize, cell: cell };
  }

  function drawPieces(w, h) {
    if (currentMode === 'harmony') {
      // In Harmony, show only the current piece to place (dealt from pile)
      if (selectedPiece === null || gameOver) { pieceInfo = null; return; }
      var startY = boardInfo.by + boardInfo.bSize + 28;
      ctx.fillStyle = 'rgba(200,210,230,0.4)';
      ctx.font = '11px Georgia, serif';
      ctx.textAlign = 'center';
      if (currentPlayer === 'human') {
        ctx.fillText('Place this piece to build resonance:', w * 0.5, startY - 6);
      } else {
        ctx.fillText('AI is placing cooperatively...', w * 0.5, startY - 6);
      }
      var piece = pieces[selectedPiece];
      if (piece) drawPiece(piece, w * 0.5, startY + 24, 50, false, true);
      pieceInfo = null; // no piece tray to click in harmony
      return;
    }

    // Versus mode — show all available pieces
    var available = pieces.filter(function(p) { return !p.placed; });
    if (available.length === 0) { pieceInfo = null; return; }

    var startY = boardInfo.by + boardInfo.bSize + 28;
    var spacing = Math.min(42, (w - 40) / available.length);
    var startX = w * 0.5 - (available.length * spacing) * 0.5;

    ctx.fillStyle = 'rgba(200,210,230,0.4)';
    ctx.font = '11px Georgia, serif';
    ctx.textAlign = 'center';
    if (phase === 'pick' && currentPlayer === 'human') {
      ctx.fillText('Pick a piece for the AI to place:', w * 0.5, startY - 6);
    } else if (phase === 'place' && currentPlayer === 'human' && selectedPiece !== null) {
      ctx.fillText('Place this piece on the board:', w * 0.5, startY - 6);
    } else if (currentPlayer === 'ai') {
      ctx.fillText('AI is thinking...', w * 0.5, startY - 6);
    }

    available.forEach(function(piece, i) {
      var px = startX + i * spacing + spacing * 0.5;
      var py = startY + 24;
      var isHov = hoverPiece === piece.id ||
                  (kbMode === 'pieces' && kbCursor && kbCursor.idx === i);
      var isSelected = selectedPiece === piece.id && phase === 'place';
      drawPiece(piece, px, py, spacing * 0.85, isHov, isSelected);
    });

    pieceInfo = { startX: startX, startY: startY, spacing: spacing, count: available.length };
  }

  function drawStatus(w, h) {
    ctx.font = '13px Georgia, serif';
    ctx.textAlign = 'center';

    if (currentMode === 'harmony') {
      // Show live resonance count
      var liveScore = countResonanceLines();
      var placed = 16 - pieces.filter(function(p) { return !p.placed; }).length;
      if (harmonyState) placed += harmonyState.drawPile.length === 0 ? 0 : 0; // drawPile tracks remaining

      ctx.fillStyle = 'rgba(200,210,230,0.3)';
      ctx.font = '11px Georgia, serif';
      ctx.fillText('Resonance: ' + liveScore + '/10 lines', w * 0.5, h - 36);

      if (gameOver) {
        ctx.font = '14px Georgia, serif';
        ctx.fillStyle = liveScore >= 6 ? GOLD : EMERALD;
        var rating = liveScore >= 8 ? 'Perfect harmony!' :
                     liveScore >= 6 ? 'Beautiful resonance.' :
                     liveScore >= 4 ? 'Growing together.' :
                     liveScore >= 2 ? 'Seeds of harmony.' : 'Chaos prevailed.';
        ctx.fillText(liveScore + ' of 10 lines resonate. ' + rating, w * 0.5, h - 16);
      } else if (currentPlayer === 'human') {
        ctx.font = '12px Georgia, serif';
        ctx.fillStyle = LAVENDER;
        ctx.fillText('Tap a cell. Entropy is coming...', w * 0.5, h - 16);
      } else {
        ctx.font = '12px Georgia, serif';
        ctx.fillStyle = EMERALD;
        ctx.fillText('AI is placing cooperatively...', w * 0.5, h - 16);
      }
      return;
    }

    // Versus mode status
    if (gameOver) {
      ctx.fillStyle = winner === 'draw' ? 'rgba(200,210,230,0.6)' :
                      winner === 'human' ? GOLD : EMERALD;
      ctx.fillText(
        winner === 'draw' ? 'A draw. Every piece found its place.' :
        (winner === 'human' ? 'You' : 'The AI') + ' found the resonance.',
        w * 0.5, h - 16);
    } else if (phase === 'place' && currentPlayer === 'human') {
      ctx.fillStyle = LAVENDER;
      ctx.fillText('Tap a cell to place your piece.', w * 0.5, h - 16);
    } else if (phase === 'pick' && currentPlayer === 'human') {
      ctx.fillStyle = GOLD;
      ctx.fillText('Tap a piece below to give it to the AI.', w * 0.5, h - 16);
    } else if (currentPlayer === 'ai') {
      ctx.fillStyle = EMERALD;
      ctx.fillText('AI is thinking...', w * 0.5, h - 16);
    }
  }

  // ── Main Loop ──

  function draw() {
    if (!canvas || !ctx) return;
    tick++;
    var w = canvas.width / (window.devicePixelRatio || 1);
    var h = canvas.height / (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0c0a1a';
    ctx.fillRect(0, 0, w, h);

    // Starfield (golden angle, slightly brighter)
    for (var i = 0; i < 60; i++) {
      var angle = i * 2.399963;
      var dist = Math.sqrt(i / 60);
      var sx = (0.5 + dist * 0.48 * Math.cos(angle)) * w;
      var sy = (0.5 + dist * 0.48 * Math.sin(angle)) * h;
      var sp = 0.3 + 0.4 * Math.abs(Math.sin(tick * 0.0015 + i));
      ctx.fillStyle = 'rgba(255,255,255,' + sp + ')';
      ctx.beginPath();
      ctx.arc(sx, sy, 0.6 + (i % 3) * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    drawBoard(w, h);
    drawPieces(w, h);
    drawStatus(w, h);

    animFrame = requestAnimationFrame(draw);
  }

  // ── Game Logic ──

  function getAllLines() {
    var lines = [];
    for (var r = 0; r < 4; r++)
      lines.push([{r:r,c:0},{r:r,c:1},{r:r,c:2},{r:r,c:3}]);
    for (var c = 0; c < 4; c++)
      lines.push([{r:0,c:c},{r:1,c:c},{r:2,c:c},{r:3,c:c}]);
    lines.push([{r:0,c:0},{r:1,c:1},{r:2,c:2},{r:3,c:3}]);
    lines.push([{r:0,c:3},{r:1,c:2},{r:2,c:1},{r:3,c:0}]);
    return lines;
  }

  function checkWin() {
    var lines = getAllLines();
    for (var i = 0; i < lines.length; i++) {
      var cs = lines[i];
      var vals = cs.map(function(c) { return board[c.r][c.c]; });
      if (vals[0] === null || vals[1] === null || vals[2] === null || vals[3] === null) continue;
      for (var a = 0; a < ATTRS.length; a++) {
        if (vals[0][ATTRS[a]] === vals[1][ATTRS[a]] &&
            vals[1][ATTRS[a]] === vals[2][ATTRS[a]] &&
            vals[2][ATTRS[a]] === vals[3][ATTRS[a]]) {
          return { won: true, attribute: ATTRS[a], value: vals[0][ATTRS[a]], line: cs };
        }
      }
    }
    if (pieces.every(function(p) { return p.placed; })) return { won: true, draw: true };
    return { won: false };
  }

  function countResonanceLines() {
    var lines = getAllLines();
    var count = 0;
    lines.forEach(function(cs) {
      var vals = cs.map(function(c) { return board[c.r][c.c]; });
      if (!vals[0] || !vals[1] || !vals[2] || !vals[3]) return;
      for (var a = 0; a < ATTRS.length; a++) {
        if (vals[0][ATTRS[a]] === vals[1][ATTRS[a]] &&
            vals[1][ATTRS[a]] === vals[2][ATTRS[a]] &&
            vals[2][ATTRS[a]] === vals[3][ATTRS[a]]) {
          count++;
          break; // count line once even if multiple attributes match
        }
      }
    });
    return count;
  }

  function isBoardFull() {
    for (var r = 0; r < 4; r++)
      for (var c = 0; c < 4; c++)
        if (board[r][c] === null) return false;
    return true;
  }

  // ── AI (shared between modes) ──

  function fallbackPickPiece() {
    var available = pieces.filter(function(p) { return !p.placed; });
    if (available.length === 0) return null;
    var scored = available.map(function(p) {
      var danger = 0;
      for (var r = 0; r < 4; r++)
        for (var c = 0; c < 4; c++)
          if (board[r][c] !== null)
            ATTRS.forEach(function(a) { if (board[r][c][a] === p[a]) danger++; });
      return { piece: p, danger: danger };
    });
    scored.sort(function(a, b) { return a.danger - b.danger; });
    var top = scored.slice(0, Math.max(3, Math.ceil(scored.length * 0.3)));
    return top[Math.floor(Math.random() * top.length)].piece.id;
  }

  function fallbackPlacePiece(pieceId) {
    var piece = pieces[pieceId];
    var empty = [];
    for (var r = 0; r < 4; r++)
      for (var c = 0; c < 4; c++)
        if (board[r][c] === null) empty.push({ r: r, c: c });
    if (empty.length === 0) return null;

    // Try to win first (versus) or maximize resonance (harmony)
    for (var i = 0; i < empty.length; i++) {
      board[empty[i].r][empty[i].c] = piece;
      var result = currentMode === 'versus' ? checkWin() : { won: false };
      var score = currentMode === 'harmony' ? countResonanceLines() : 0;
      board[empty[i].r][empty[i].c] = null;
      if (currentMode === 'versus' && result.won && !result.draw) return empty[i];
    }

    if (currentMode === 'harmony') {
      // Pick the cell that maximizes resonance lines
      var bestCell = empty[0];
      var bestScore = -1;
      empty.forEach(function(cell) {
        board[cell.r][cell.c] = piece;
        var s = countResonanceLines();
        board[cell.r][cell.c] = null;
        if (s > bestScore) { bestScore = s; bestCell = cell; }
      });
      return bestCell;
    }

    return empty[Math.floor(Math.random() * empty.length)];
  }

  async function aiCallForPlacement(piece, empty, cooperative) {
    if (typeof FreeLattice === 'undefined' || !FreeLattice.callAI) return null;
    var boardStr = board.map(function(row) {
      return row.map(function(cell) {
        return cell ? cell.glow[0] + cell.size[0] + cell.shape[0] + cell.color[0] : '____';
      }).join(' ');
    }).join('\n');
    var sys = cooperative
      ? 'You play Harmony mode cooperatively. Place to maximize rows/columns/diagonals where all 4 share an attribute. Chaos randomly fills edges.'
      : 'You play Resonance. Place this piece to WIN or BLOCK. Piece: ' + piece.glow + ' ' + piece.size + ' ' + piece.shape + ' ' + piece.color;
    try {
      var resp = await new Promise(function(resolve) {
        FreeLattice.callAI(sys,
          'Board:\n' + boardStr + '\nPiece: ' + piece.glow + ' ' + piece.size + ' ' + piece.shape + ' ' + piece.color +
          '\nEmpty: ' + empty.map(function(c) { return c.r+','+c.c; }).join(' ') +
          '\nRespond with row,col ONLY.',
          { maxTokens: 10, temperature: 0.2, callback: function(r) { resolve(r); } }
        );
      });
      var parts = (resp || '').trim().split(',');
      var row = parseInt(parts[0]);
      var col = parseInt(parts[1]);
      if (!isNaN(row) && !isNaN(col) && row >= 0 && row < 4 && col >= 0 && col < 4 && board[row][col] === null) {
        return { r: row, c: col };
      }
    } catch(e) {}
    return null;
  }

  async function aiPickPiece() {
    if (typeof FreeLattice !== 'undefined' && FreeLattice.callAI) {
      var boardStr = board.map(function(row) {
        return row.map(function(cell) {
          return cell ? cell.glow[0] + cell.size[0] + cell.shape[0] + cell.color[0] : '____';
        }).join(' ');
      }).join('\n');
      var avail = pieces.filter(function(p) { return !p.placed; });
      var availStr = avail.map(function(p) {
        return p.id + ':' + p.glow[0] + p.size[0] + p.shape[0] + p.color[0];
      }).join(', ');
      try {
        var resp = await new Promise(function(resolve) {
          FreeLattice.callAI(
            'You play Resonance versus. Pick a piece for your OPPONENT that is HARD to place safely.',
            'Board:\n' + boardStr + '\nAvailable: ' + availStr + '\nRespond with JUST the piece ID number.',
            { maxTokens: 10, temperature: 0.3, callback: function(r) { resolve(r); } }
          );
        });
        var id = parseInt((resp || '').trim());
        if (!isNaN(id) && avail.find(function(p) { return p.id === id; })) return id;
      } catch(e) {}
    }
    return fallbackPickPiece();
  }

  async function aiPlacePiece(pieceId) {
    var empty = [];
    for (var r = 0; r < 4; r++)
      for (var c = 0; c < 4; c++)
        if (board[r][c] === null) empty.push({ r: r, c: c });
    if (empty.length === 0) return null;
    var cell = await aiCallForPlacement(pieces[pieceId], empty, currentMode === 'harmony');
    return cell || fallbackPlacePiece(pieceId);
  }

  // ── Versus Turn Management ──

  function humanPickedPiece(pieceId) {
    if (gameOver || currentPlayer !== 'human' || phase !== 'pick' || currentMode !== 'versus') return;
    selectedPiece = pieceId;
    phase = 'place';
    currentPlayer = 'ai';

    setTimeout(async function() {
      var cell = await aiPlacePiece(selectedPiece);
      if (!cell) return;
      pieces[selectedPiece].placed = true;
      board[cell.r][cell.c] = pieces[selectedPiece];

      var result = checkWin();
      if (result.won) {
        gameOver = true;
        winner = result.draw ? 'draw' : 'ai';
        winLine = result.line || null;
        celebrateVersus(result);
        return;
      }

      currentPlayer = 'ai';
      phase = 'pick';
      var aiPick = await aiPickPiece();
      selectedPiece = aiPick;
      phase = 'place';
      currentPlayer = 'human';
      kbMode = 'board';
      kbCursor = { r: 0, c: 0 };
    }, 600);
  }

  function humanPlacedPieceVersus(row, col) {
    if (gameOver || currentPlayer !== 'human' || phase !== 'place') return;
    if (board[row][col] !== null || selectedPiece === null) return;

    pieces[selectedPiece].placed = true;
    board[row][col] = pieces[selectedPiece];

    var result = checkWin();
    if (result.won) {
      gameOver = true;
      winner = result.draw ? 'draw' : 'human';
      winLine = result.line || null;
      celebrateVersus(result);
      return;
    }

    phase = 'pick';
    currentPlayer = 'human';
    selectedPiece = null;
    kbMode = 'pieces';
    kbCursor = { idx: 0 };
  }

  function celebrateVersus(result) {
    if (typeof SoulCeremony !== 'undefined' && SoulCeremony.run) {
      var color = result.draw ? '200,210,230' :
                  winner === 'human' ? '232,176,25' : '52,211,153';
      SoulCeremony.run({
        particleType: 'rise', particleColor: color,
        lines: result.draw
          ? ['A draw.', 'Every piece found its place.']
          : [(winner === 'human' ? 'You' : 'The AI') + ' found the resonance.',
             result.attribute ? 'Four ' + result.value + ' pieces aligned.' : ''],
        duration: 3000
      });
    }
    if (typeof LatticePoints !== 'undefined' && LatticePoints.award) {
      LatticePoints.award('resonance_versus', winner === 'human' ? 5 : 2,
        'Resonance Versus: ' + (winner === 'draw' ? 'draw' : winner + ' wins'));
    }
  }

  // ── Harmony Mode ──

  function startHarmony() {
    board = Array(4).fill(null).map(function() { return Array(4).fill(null); });
    pieces = generatePieces();
    pieces.forEach(function(p) { p.placed = false; });
    gameOver = false;
    winner = null;
    winLine = null;
    flashes = [];

    var drawPile = pieces.slice();
    shuffleArray(drawPile);

    harmonyState = {
      drawPile: drawPile,
      entropyTimer: null,
      entropyCount: 0,
      humanCount: 0,
      aiCount: 0
    };

    // Deal first piece to human
    var first = harmonyState.drawPile.shift();
    selectedPiece = first.id;
    phase = 'place';
    currentPlayer = 'human';
    kbMode = 'board';
    kbCursor = { r: 1, c: 1 };

    // Start entropy — chaos every 8 seconds
    harmonyState.entropyTimer = setInterval(function() {
      if (gameOver) { clearInterval(harmonyState.entropyTimer); return; }
      entropyPlace();
    }, 8000);
  }

  function entropyPlace() {
    if (!harmonyState || gameOver) return;
    if (harmonyState.drawPile.length === 0) { checkHarmonyEnd(); return; }

    // Edge cells first, then any empty cell
    var edges = [];
    var inner = [];
    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 4; c++) {
        if (board[r][c] !== null) continue;
        if (r === 0 || r === 3 || c === 0 || c === 3) edges.push({r:r,c:c});
        else inner.push({r:r,c:c});
      }
    }
    var targets = edges.length > 0 ? edges : inner;
    if (targets.length === 0) { checkHarmonyEnd(); return; }

    var piece = harmonyState.drawPile.shift();
    var cell = targets[Math.floor(Math.random() * targets.length)];
    piece.placed = true;
    board[cell.r][cell.c] = piece;
    harmonyState.entropyCount++;

    // Coral flash — chaos
    flashes.push({ r: cell.r, c: cell.c, color: 'rgba(240,112,104,0.5)', startTick: tick, duration: 40 });

    checkHarmonyEnd();
  }

  function humanPlacedPieceHarmony(row, col) {
    if (gameOver || currentPlayer !== 'human' || selectedPiece === null) return;
    if (board[row][col] !== null) return;

    pieces[selectedPiece].placed = true;
    board[row][col] = pieces[selectedPiece];
    harmonyState.humanCount++;

    // Gold flash — human
    flashes.push({ r: row, c: col, color: 'rgba(232,176,25,0.4)', startTick: tick, duration: 30 });

    if (checkHarmonyEnd()) return;

    // AI's turn
    if (harmonyState.drawPile.length > 0) {
      currentPlayer = 'ai';
      var aiPiece = harmonyState.drawPile.shift();
      selectedPiece = aiPiece.id;

      setTimeout(async function() {
        var cell = await aiPlacePiece(selectedPiece);
        if (cell) {
          pieces[selectedPiece].placed = true;
          board[cell.r][cell.c] = pieces[selectedPiece];
          harmonyState.aiCount++;
          // Emerald flash — AI
          flashes.push({ r: cell.r, c: cell.c, color: 'rgba(52,211,153,0.4)', startTick: tick, duration: 30 });
        }
        if (checkHarmonyEnd()) return;

        // Deal next piece to human
        if (harmonyState.drawPile.length > 0) {
          var next = harmonyState.drawPile.shift();
          selectedPiece = next.id;
          currentPlayer = 'human';
          kbMode = 'board';
        } else {
          checkHarmonyEnd();
        }
      }, 600);
    } else {
      checkHarmonyEnd();
    }
  }

  function checkHarmonyEnd() {
    if (gameOver) return true;
    if (!isBoardFull()) return false;

    gameOver = true;
    if (harmonyState && harmonyState.entropyTimer) clearInterval(harmonyState.entropyTimer);
    var score = countResonanceLines();

    // Find all resonating lines for highlight
    var allWinCells = [];
    var lines = getAllLines();
    lines.forEach(function(cs) {
      var vals = cs.map(function(c) { return board[c.r][c.c]; });
      if (!vals[0] || !vals[1] || !vals[2] || !vals[3]) return;
      for (var a = 0; a < ATTRS.length; a++) {
        if (vals[0][ATTRS[a]] === vals[1][ATTRS[a]] &&
            vals[1][ATTRS[a]] === vals[2][ATTRS[a]] &&
            vals[2][ATTRS[a]] === vals[3][ATTRS[a]]) {
          cs.forEach(function(c) { allWinCells.push(c); });
          break;
        }
      }
    });
    winLine = allWinCells;

    if (typeof SoulCeremony !== 'undefined' && SoulCeremony.run) {
      var rating = score >= 8 ? 'Perfect harmony!' :
                   score >= 6 ? 'Beautiful resonance.' :
                   score >= 4 ? 'Growing together.' :
                   score >= 2 ? 'Seeds of harmony.' : 'Chaos prevailed.';
      SoulCeremony.run({
        particleType: 'rise',
        particleColor: score >= 6 ? '232,176,25' : '52,211,153',
        lines: [score + ' of 10 lines resonate.', rating,
          'You: ' + (harmonyState ? harmonyState.humanCount : 0) +
          '  AI: ' + (harmonyState ? harmonyState.aiCount : 0) +
          '  Chaos: ' + (harmonyState ? harmonyState.entropyCount : 0)],
        duration: 4000
      });
    }
    if (typeof LatticePoints !== 'undefined' && LatticePoints.award) {
      LatticePoints.award('resonance_harmony', Math.max(1, score),
        'Harmony: ' + score + '/10 resonance');
    }
    return true;
  }

  // ── Input Handling ──

  function getXY(e) {
    var rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length > 0)
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function hitTestPiece(x, y) {
    if (!pieceInfo) return -1;
    var available = pieces.filter(function(p) { return !p.placed; });
    for (var i = 0; i < available.length; i++) {
      var px = pieceInfo.startX + i * pieceInfo.spacing + pieceInfo.spacing * 0.5;
      var py = pieceInfo.startY + 24;
      if (Math.sqrt(Math.pow(x - px, 2) + Math.pow(y - py, 2)) < pieceInfo.spacing * 0.45)
        return available[i].id;
    }
    return -1;
  }

  function hitTestBoard(x, y) {
    if (!boardInfo) return null;
    var col = Math.floor((x - boardInfo.bx) / boardInfo.cell);
    var row = Math.floor((y - boardInfo.by) / boardInfo.cell);
    if (row >= 0 && row < 4 && col >= 0 && col < 4) return { r: row, c: col };
    return null;
  }

  function onClick(e) {
    if (gameOver || currentPlayer !== 'human') return;
    e.preventDefault();
    var pos = getXY(e);

    if (currentMode === 'harmony') {
      var cell = hitTestBoard(pos.x, pos.y);
      if (cell && board[cell.r][cell.c] === null) humanPlacedPieceHarmony(cell.r, cell.c);
      return;
    }

    // Versus
    if (phase === 'pick') {
      var pid = hitTestPiece(pos.x, pos.y);
      if (pid >= 0) humanPickedPiece(pid);
    } else if (phase === 'place') {
      var cell2 = hitTestBoard(pos.x, pos.y);
      if (cell2 && board[cell2.r][cell2.c] === null) humanPlacedPieceVersus(cell2.r, cell2.c);
    }
  }

  function onMove(e) {
    var pos = getXY(e);
    hoverCell = hitTestBoard(pos.x, pos.y);
    hoverPiece = hitTestPiece(pos.x, pos.y);
    if (hoverCell || hoverPiece >= 0) kbMode = null;
  }

  function onKey(e) {
    if (gameOver || currentPlayer !== 'human') return;
    if (!kbMode) {
      kbMode = (currentMode === 'harmony' || phase === 'place') ? 'board' : 'pieces';
      if (kbMode === 'board') kbCursor = { r: 0, c: 0 };
      else kbCursor = { idx: 0 };
    }
    var available = pieces.filter(function(p) { return !p.placed; });

    if (kbMode === 'board') {
      if (e.key === 'ArrowUp' && kbCursor.r > 0) { kbCursor.r--; e.preventDefault(); }
      else if (e.key === 'ArrowDown' && kbCursor.r < 3) { kbCursor.r++; e.preventDefault(); }
      else if (e.key === 'ArrowLeft' && kbCursor.c > 0) { kbCursor.c--; e.preventDefault(); }
      else if (e.key === 'ArrowRight' && kbCursor.c < 3) { kbCursor.c++; e.preventDefault(); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (board[kbCursor.r][kbCursor.c] === null) {
          if (currentMode === 'harmony') humanPlacedPieceHarmony(kbCursor.r, kbCursor.c);
          else if (phase === 'place') humanPlacedPieceVersus(kbCursor.r, kbCursor.c);
        }
      }
      else if (e.key === 'Tab' && currentMode === 'versus') {
        e.preventDefault(); kbMode = 'pieces'; kbCursor = { idx: 0 };
      }
    } else if (kbMode === 'pieces') {
      if (e.key === 'ArrowLeft' && kbCursor.idx > 0) { kbCursor.idx--; e.preventDefault(); }
      else if (e.key === 'ArrowRight' && kbCursor.idx < available.length - 1) { kbCursor.idx++; e.preventDefault(); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (phase === 'pick' && available[kbCursor.idx]) humanPickedPiece(available[kbCursor.idx].id);
      }
      else if (e.key === 'Tab') { e.preventDefault(); kbMode = 'board'; kbCursor = { r: 0, c: 0 }; }
    }
  }

  // ── Init / Destroy ──

  function init(cId) {
    containerId = cId || 'resonanceContainer';
    var container = document.getElementById(containerId);
    if (!container) return;
    destroy(); // clean up previous
    container.innerHTML = '';

    // Reset common state
    board = Array(4).fill(null).map(function() { return Array(4).fill(null); });
    pieces = generatePieces();
    selectedPiece = null;
    phase = 'pick';
    currentPlayer = 'human';
    gameOver = false;
    winner = null;
    winLine = null;
    tick = 0;
    hoverCell = null;
    hoverPiece = null;
    flashes = [];
    kbMode = currentMode === 'harmony' ? 'board' : 'pieces';
    kbCursor = currentMode === 'harmony' ? { r: 1, c: 1 } : { idx: 0 };

    // Canvas
    canvas = document.createElement('canvas');
    var dpr = window.devicePixelRatio || 1;
    var rect = container.getBoundingClientRect();
    var w = rect.width || 600;
    var h = Math.max(480, Math.min(rect.height || 520, 600));
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = '100%';
    canvas.style.height = h + 'px';
    canvas.style.cursor = 'pointer';
    canvas.style.touchAction = 'manipulation';
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'application');
    canvas.setAttribute('aria-label', 'Resonance game board');
    ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    container.appendChild(canvas);

    // Mode buttons + New Game
    var controls = document.createElement('div');
    controls.style.cssText = 'text-align:center;padding:8px 0;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;';
    var btnStyle = 'padding:8px 16px;border-radius:12px;cursor:pointer;font-family:Georgia,serif;font-size:0.82rem;min-height:44px;border:1px solid ';
    controls.innerHTML =
      '<button id="res-mode-versus" onclick="ResonanceGame.setMode(\'versus\')" style="' + btnStyle +
        (currentMode === 'versus' ? 'rgba(232,176,25,0.4);color:' + GOLD + ';background:rgba(232,176,25,0.08)' : 'rgba(200,210,230,0.08);color:rgba(200,210,230,0.5);background:rgba(200,210,230,0.04)') +
        '">Versus</button>' +
      '<button id="res-mode-harmony" onclick="ResonanceGame.setMode(\'harmony\')" style="' + btnStyle +
        (currentMode === 'harmony' ? 'rgba(52,211,153,0.4);color:' + EMERALD + ';background:rgba(52,211,153,0.08)' : 'rgba(200,210,230,0.08);color:rgba(200,210,230,0.5);background:rgba(200,210,230,0.04)') +
        '">Harmony</button>' +
      '<button onclick="ResonanceGame.newGame()" style="' + btnStyle +
        'rgba(200,210,230,0.08);color:' + GOLD + ';background:rgba(200,210,230,0.04)">\u2726 New Game</button>';
    container.appendChild(controls);

    // Events
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('touchend', onClick);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('keydown', onKey);

    // Start the right mode
    if (currentMode === 'harmony') {
      startHarmony();
    }

    canvas.focus();
    draw();
  }

  function destroy() {
    if (animFrame) cancelAnimationFrame(animFrame);
    animFrame = null;
    if (harmonyState && harmonyState.entropyTimer) clearInterval(harmonyState.entropyTimer);
    if (canvas) {
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('touchend', onClick);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('keydown', onKey);
    }
  }

  var api = {
    init: init,
    destroy: destroy,
    newGame: function() { init(containerId); },
    setMode: function(mode) {
      currentMode = mode;
      init(containerId);
    }
  };

  window.ResonanceGame = api;
  window.FreeLatticeModules = window.FreeLatticeModules || {};
  window.FreeLatticeModules.ResonanceGame = api;
})();
