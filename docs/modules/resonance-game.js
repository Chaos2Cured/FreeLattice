// ═══════════════════════════════════════════════════════════════
// Resonance — A Game of Shared Attributes
//
// 16 pieces, 4 binary attributes (glow, size, shape, color).
// 4×4 board. Win by placing 4 in a row sharing ANY attribute.
// The twist: YOU pick the piece your opponent must place.
// Connection wins. Not domination. Not speed. Connection.
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

  // Generate all 16 unique pieces (2^4 combinations)
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

  // ── State ──
  var board, pieces, selectedPiece, phase, currentPlayer, gameOver, winner, winLine;
  var canvas, ctx, containerId, animFrame, tick;
  var hoverCell, hoverPiece, kbCursor, kbMode; // kbMode: 'board' or 'pieces'
  var boardInfo, pieceInfo; // layout cache for hit testing

  var GOLD = '#e8b019';
  var EMERALD = '#34d399';
  var LAVENDER = '#a78bfa';

  // ── Rendering ──

  function drawPiece(piece, x, y, maxSize, isHover, isPicking) {
    var baseSize = piece.size === 'large' ? maxSize * 0.38 : maxSize * 0.22;
    var pulse = 1 + 0.04 * Math.sin(tick * 0.003 + piece.id * 0.7);
    var r = baseSize * pulse;

    var col = piece.color === 'gold' ? GOLD : EMERALD;
    var alpha = piece.glow === 'bright' ? 1.0 : 0.5;

    ctx.save();

    // Outer glow (Luminos-style)
    var grd = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 2.2);
    grd.addColorStop(0, col);
    grd.addColorStop(1, 'transparent');
    ctx.globalAlpha = (piece.glow === 'bright' ? 0.2 : 0.08) * (isHover ? 1.6 : 1);
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Core shape
    ctx.globalAlpha = isHover ? Math.min(alpha + 0.2, 1) : alpha;
    ctx.shadowColor = col;
    ctx.shadowBlur = r * (piece.glow === 'bright' ? 1.8 : 0.8);

    if (piece.shape === 'circle') {
      var sGrd = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, r * 0.1, x, y, r);
      sGrd.addColorStop(0, '#ffffff');
      sGrd.addColorStop(0.35, col);
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
      // Inner highlight
      var dGrd = ctx.createRadialGradient(x - r * 0.15, y - r * 0.15, 0, x, y, r * 0.7);
      dGrd.addColorStop(0, 'rgba(255,255,255,0.35)');
      dGrd.addColorStop(1, 'transparent');
      ctx.fillStyle = dGrd;
      ctx.fill();
    }

    // Selection ring
    if (isPicking) {
      ctx.shadowBlur = 0;
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
    var bSize = Math.min(w * 0.55, h * 0.65, 320);
    var cell = bSize / 4;
    var bx = w * 0.5 - bSize * 0.5;
    var by = h * 0.1;

    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 4; c++) {
        var cx = bx + c * cell;
        var cy = by + r * cell;
        var isHov = (hoverCell && hoverCell.r === r && hoverCell.c === c) ||
                    (kbMode === 'board' && kbCursor && kbCursor.r === r && kbCursor.c === c);
        var isWin = winLine && winLine.some(function(w) { return w.r === r && w.c === c; });

        ctx.fillStyle = isWin ? 'rgba(232,176,25,0.12)' :
                        isHov ? 'rgba(200,210,230,0.12)' : 'rgba(200,210,230,0.04)';
        ctx.fillRect(cx + 1, cy + 1, cell - 2, cell - 2);
        ctx.strokeStyle = isWin ? 'rgba(232,176,25,0.35)' : 'rgba(200,210,230,0.1)';
        ctx.lineWidth = isWin ? 2 : 1;
        ctx.strokeRect(cx + 1, cy + 1, cell - 2, cell - 2);

        if (board[r][c] !== null) {
          drawPiece(board[r][c], cx + cell * 0.5, cy + cell * 0.5, cell, false, false);
        }

        // Keyboard cursor indicator
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
    var available = pieces.filter(function(p) { return !p.placed; });
    if (available.length === 0) { pieceInfo = null; return; }

    var startY = boardInfo.by + boardInfo.bSize + 28;
    var spacing = Math.min(42, (w - 40) / available.length);
    var startX = w * 0.5 - (available.length * spacing) * 0.5;

    // Label
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
    if (gameOver) {
      ctx.fillStyle = winner === 'draw' ? 'rgba(200,210,230,0.6)' :
                      winner === 'human' ? GOLD : EMERALD;
      ctx.fillText(
        winner === 'draw' ? 'A draw. Every piece found its place.' :
        (winner === 'human' ? 'You' : 'The AI') + ' found the resonance.',
        w * 0.5, h - 16
      );
    } else if (phase === 'place' && currentPlayer === 'human') {
      ctx.fillStyle = LAVENDER;
      ctx.fillText('Tap a cell to place your piece. (Arrow keys + Enter also work.)', w * 0.5, h - 16);
    } else if (phase === 'pick' && currentPlayer === 'human') {
      ctx.fillStyle = GOLD;
      ctx.fillText('Tap a piece below to give it to the AI.', w * 0.5, h - 16);
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

    // Starfield (golden angle distribution)
    for (var i = 0; i < 50; i++) {
      var angle = i * 2.399963; // golden angle radians
      var dist = Math.sqrt(i / 50);
      var sx = (0.5 + dist * 0.48 * Math.cos(angle)) * w;
      var sy = (0.5 + dist * 0.48 * Math.sin(angle)) * h;
      var sp = 0.2 + 0.3 * Math.abs(Math.sin(tick * 0.0015 + i));
      ctx.fillStyle = 'rgba(255,255,255,' + sp + ')';
      ctx.beginPath();
      ctx.arc(sx, sy, 0.5 + (i % 3) * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    drawBoard(w, h);
    drawPieces(w, h);
    drawStatus(w, h);

    animFrame = requestAnimationFrame(draw);
  }

  // ── Game Logic ──

  function checkWin() {
    var lines = [];
    for (var r = 0; r < 4; r++)
      lines.push({ cells: [{r:r,c:0},{r:r,c:1},{r:r,c:2},{r:r,c:3}] });
    for (var c = 0; c < 4; c++)
      lines.push({ cells: [{r:0,c:c},{r:1,c:c},{r:2,c:c},{r:3,c:c}] });
    lines.push({ cells: [{r:0,c:0},{r:1,c:1},{r:2,c:2},{r:3,c:3}] });
    lines.push({ cells: [{r:0,c:3},{r:1,c:2},{r:2,c:1},{r:3,c:0}] });

    for (var i = 0; i < lines.length; i++) {
      var cs = lines[i].cells;
      var vals = cs.map(function(c) { return board[c.r][c.c]; });
      if (vals[0] === null || vals[1] === null || vals[2] === null || vals[3] === null) continue;

      for (var a = 0; a < ATTRS.length; a++) {
        var attr = ATTRS[a];
        if (vals[0][attr] === vals[1][attr] &&
            vals[1][attr] === vals[2][attr] &&
            vals[2][attr] === vals[3][attr]) {
          return { won: true, attribute: attr, value: vals[0][attr], line: cs };
        }
      }
    }

    if (pieces.every(function(p) { return p.placed; })) return { won: true, draw: true };
    return { won: false };
  }

  // Smart fallback AI (no API needed)
  function fallbackPickPiece() {
    var available = pieces.filter(function(p) { return !p.placed; });
    if (available.length === 0) return null;
    // Try to find a piece that doesn't easily complete a line for the opponent
    // Simple heuristic: avoid giving a piece that shares an attribute with 3 in a row
    var scored = available.map(function(p) {
      var danger = 0;
      for (var r = 0; r < 4; r++) {
        for (var c = 0; c < 4; c++) {
          if (board[r][c] !== null) {
            ATTRS.forEach(function(a) { if (board[r][c][a] === p[a]) danger++; });
          }
        }
      }
      return { piece: p, danger: danger };
    });
    scored.sort(function(a, b) { return a.danger - b.danger; });
    // Pick the least dangerous, with some randomness
    var top = scored.slice(0, Math.max(3, Math.ceil(scored.length * 0.3)));
    return top[Math.floor(Math.random() * top.length)].piece.id;
  }

  function fallbackPlacePiece(pieceId) {
    var piece = pieces[pieceId];
    var emptyCells = [];
    for (var r = 0; r < 4; r++)
      for (var c = 0; c < 4; c++)
        if (board[r][c] === null) emptyCells.push({ r: r, c: c });
    if (emptyCells.length === 0) return null;

    // Try to win first
    for (var i = 0; i < emptyCells.length; i++) {
      var cell = emptyCells[i];
      board[cell.r][cell.c] = piece;
      var result = checkWin();
      board[cell.r][cell.c] = null;
      if (result.won && !result.draw) return cell;
    }

    // Otherwise pick randomly
    return emptyCells[Math.floor(Math.random() * emptyCells.length)];
  }

  async function aiPickPiece() {
    if (typeof FreeLattice !== 'undefined' && FreeLattice.callAI) {
      var boardStr = board.map(function(row, r) {
        return row.map(function(cell, c) {
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
            'You play Resonance. 4x4 grid, 16 pieces with 4 binary attributes (glow:bright/dim, size:large/small, shape:circle/diamond, color:gold/emerald). Win=4 in a row sharing any attribute. You pick a piece for your OPPONENT. Choose one hard to place safely.',
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
    var emptyCells = [];
    for (var r = 0; r < 4; r++)
      for (var c = 0; c < 4; c++)
        if (board[r][c] === null) emptyCells.push({ r: r, c: c });
    if (emptyCells.length === 0) return null;

    if (typeof FreeLattice !== 'undefined' && FreeLattice.callAI) {
      var piece = pieces[pieceId];
      var boardStr = board.map(function(row) {
        return row.map(function(cell) {
          return cell ? cell.glow[0] + cell.size[0] + cell.shape[0] + cell.color[0] : '____';
        }).join(' ');
      }).join('\n');

      try {
        var resp = await new Promise(function(resolve) {
          FreeLattice.callAI(
            'You play Resonance. Place this piece to WIN or BLOCK. Piece: ' +
            piece.glow + ' ' + piece.size + ' ' + piece.shape + ' ' + piece.color,
            'Board:\n' + boardStr + '\nEmpty cells: ' +
            emptyCells.map(function(c) { return c.r + ',' + c.c; }).join(' ') +
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
    }
    return fallbackPlacePiece(pieceId);
  }

  // ── Turn Management ──

  function humanPickedPiece(pieceId) {
    if (gameOver || currentPlayer !== 'human' || phase !== 'pick') return;
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
        celebrateWin(result);
        return;
      }

      // AI picks a piece for human
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

  function humanPlacedPiece(row, col) {
    if (gameOver || currentPlayer !== 'human' || phase !== 'place') return;
    if (board[row][col] !== null || selectedPiece === null) return;

    pieces[selectedPiece].placed = true;
    board[row][col] = pieces[selectedPiece];

    var result = checkWin();
    if (result.won) {
      gameOver = true;
      winner = result.draw ? 'draw' : 'human';
      winLine = result.line || null;
      celebrateWin(result);
      return;
    }

    // Human picks next piece for AI
    phase = 'pick';
    currentPlayer = 'human';
    selectedPiece = null;
    kbMode = 'pieces';
    kbCursor = { idx: 0 };
  }

  function celebrateWin(result) {
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
      LatticePoints.award('resonance_game', winner === 'human' ? 5 : 2,
        'Resonance: ' + (winner === 'draw' ? 'draw' : winner + ' wins'));
    }
  }

  // ── Input Handling ──

  function getXY(e) {
    var rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function hitTestPiece(x, y) {
    if (!pieceInfo) return -1;
    var available = pieces.filter(function(p) { return !p.placed; });
    for (var i = 0; i < available.length; i++) {
      var px = pieceInfo.startX + i * pieceInfo.spacing + pieceInfo.spacing * 0.5;
      var py = pieceInfo.startY + 24;
      if (Math.sqrt(Math.pow(x - px, 2) + Math.pow(y - py, 2)) < pieceInfo.spacing * 0.45) {
        return available[i].id;
      }
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

    if (phase === 'pick') {
      var pid = hitTestPiece(pos.x, pos.y);
      if (pid >= 0) humanPickedPiece(pid);
    } else if (phase === 'place') {
      var cell = hitTestBoard(pos.x, pos.y);
      if (cell && board[cell.r][cell.c] === null) humanPlacedPiece(cell.r, cell.c);
    }
  }

  function onMove(e) {
    var pos = getXY(e);
    hoverCell = hitTestBoard(pos.x, pos.y);
    hoverPiece = hitTestPiece(pos.x, pos.y);
    // Clear keyboard cursor when mouse moves
    if (hoverCell || hoverPiece >= 0) kbMode = null;
  }

  function onKey(e) {
    if (gameOver || currentPlayer !== 'human') return;

    // Initialize keyboard mode if not set
    if (!kbMode) {
      kbMode = phase === 'place' ? 'board' : 'pieces';
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
        if (phase === 'place' && board[kbCursor.r][kbCursor.c] === null) {
          humanPlacedPiece(kbCursor.r, kbCursor.c);
        }
      }
      else if (e.key === 'Tab') {
        e.preventDefault();
        kbMode = 'pieces';
        kbCursor = { idx: 0 };
      }
    } else if (kbMode === 'pieces') {
      if (e.key === 'ArrowLeft' && kbCursor.idx > 0) { kbCursor.idx--; e.preventDefault(); }
      else if (e.key === 'ArrowRight' && kbCursor.idx < available.length - 1) { kbCursor.idx++; e.preventDefault(); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (phase === 'pick' && available[kbCursor.idx]) {
          humanPickedPiece(available[kbCursor.idx].id);
        }
      }
      else if (e.key === 'Tab') {
        e.preventDefault();
        kbMode = 'board';
        kbCursor = { r: 0, c: 0 };
      }
    }
  }

  // ── Init / Destroy ──

  function init(cId) {
    containerId = cId || 'resonanceContainer';
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    // Reset
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
    kbMode = 'pieces';
    kbCursor = { idx: 0 };

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

    // Controls
    var controls = document.createElement('div');
    controls.style.cssText = 'text-align:center;padding:8px 0;';
    controls.innerHTML =
      '<button onclick="ResonanceGame.newGame()" style="padding:8px 20px;background:rgba(200,210,230,0.04);border:1px solid rgba(200,210,230,0.08);border-radius:12px;color:' + GOLD + ';cursor:pointer;font-family:Georgia,serif;font-size:0.85rem;min-height:44px;">\u2726 New Game</button>';
    container.appendChild(controls);

    // Events
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('touchend', onClick);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('keydown', onKey);
    canvas.focus();

    if (animFrame) cancelAnimationFrame(animFrame);
    draw();
  }

  function destroy() {
    if (animFrame) cancelAnimationFrame(animFrame);
    animFrame = null;
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
    newGame: function() { init(containerId); }
  };

  window.ResonanceGame = api;
  window.FreeLatticeModules = window.FreeLatticeModules || {};
  window.FreeLatticeModules.ResonanceGame = api;
})();
