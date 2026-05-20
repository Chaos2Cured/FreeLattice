// ═══════════════════════════════════════════════════════════════
// Lattice Puzzles — The AI creates, the human solves, both stake LP
//
// The first genuine economic transaction between a human and an AI
// where both have skin in the game. The AI generates a partially
// filled board. The human places the remaining pieces to hit a
// target resonance count. Both stake LP. Winner takes the pot.
//
// "Two minds, staking value, playing a fair game."
//
// Built by CC, May 19, 2026. Follows GAME_LANGUAGE.md.
// ═══════════════════════════════════════════════════════════════

(function() {
  'use strict';

  var ATTRS = ['glow', 'size', 'shape', 'color'];
  var ATTR_VALUES = {
    glow: ['bright', 'dim'], size: ['large', 'small'],
    shape: ['circle', 'diamond'], color: ['gold', 'emerald']
  };

  var DIFFICULTIES = {
    easy:   { humanStake: 2,  aiStake: 2,  target: 3, placed: 10, label: 'Easy' },
    medium: { humanStake: 5,  aiStake: 5,  target: 5, placed: 8,  label: 'Medium' },
    hard:   { humanStake: 10, aiStake: 10, target: 7, placed: 6,  label: 'Hard' },
    master: { humanStake: 20, aiStake: 20, target: 9, placed: 4,  label: 'Master' }
  };

  var GOLD = '#e8b019';
  var EMERALD = '#34d399';
  var LAVENDER = '#a78bfa';

  // ── Shared piece generation (same 16 as Resonance) ──
  function generatePieces() {
    var p = [];
    for (var g = 0; g < 2; g++)
      for (var s = 0; s < 2; s++)
        for (var sh = 0; sh < 2; sh++)
          for (var c = 0; c < 2; c++)
            p.push({ id: p.length, glow: ATTR_VALUES.glow[g], size: ATTR_VALUES.size[s],
                     shape: ATTR_VALUES.shape[sh], color: ATTR_VALUES.color[c], placed: false });
    return p;
  }

  function shuffleArray(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
  }

  // ── State ──
  var board, pieces, remainingPieces, selectedPieceIdx;
  var difficulty, config, puzzleActive, puzzleResult;
  var canvas, ctx, containerId, animFrame, tick;
  var hoverCell, hoverPiece, kbCursor, kbMode;
  var boardInfo, trayInfo;
  var hintCells; // [{r,c}] — highlighted by hints
  var puzzleNumber;

  // ── Rendering (follows GAME_LANGUAGE.md) ──

  function drawPiece(piece, x, y, maxSize, isHover, isSelected, isLocked) {
    var baseSize = piece.size === 'large' ? maxSize * 0.38 : maxSize * 0.22;
    var pulseAmp = piece.glow === 'bright' ? 0.12 : 0.04;
    var pulse = 1 + pulseAmp * Math.sin(tick * 0.004 + piece.id * 0.7);
    var r = baseSize * pulse;
    var col = piece.color === 'gold' ? GOLD : EMERALD;
    var isBright = piece.glow === 'bright';
    var alpha = isBright ? 1.0 : 0.45;
    if (isLocked) alpha *= 0.7; // pre-placed pieces slightly dimmer

    ctx.save();

    // Halo
    var haloR = r * (isBright ? 3.0 : 2.0);
    var grd = ctx.createRadialGradient(x, y, r * 0.2, x, y, haloR);
    grd.addColorStop(0, col);
    grd.addColorStop(1, 'transparent');
    ctx.globalAlpha = (isBright ? 0.35 : 0.08) * (isHover ? 1.6 : 1);
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(x, y, haloR, 0, Math.PI * 2);
    ctx.fill();

    // Core
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
      ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.85, y);
      ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.85, y);
      ctx.closePath();
      ctx.fill();
      var dGrd = ctx.createRadialGradient(x - r * 0.15, y - r * 0.15, 0, x, y, r * 0.7);
      dGrd.addColorStop(0, 'rgba(255,255,255,0.35)');
      dGrd.addColorStop(1, 'transparent');
      ctx.fillStyle = dGrd;
      ctx.fill();
    }

    // Selection ring
    if (isSelected) {
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(x, y, r + 5, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.lineDashOffset = -tick * 0.05;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Lock icon for pre-placed pieces
    if (isLocked) {
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.3;
      ctx.font = (r * 0.6) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText('\uD83D\uDD12', x, y);
    }

    ctx.restore();
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
          count++; break;
        }
      }
    });
    return count;
  }

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

  function drawBoard(w, h) {
    var bSize = Math.min(w * 0.55, h * 0.55, 300);
    var cell = bSize / 4;
    var bx = w * 0.5 - bSize * 0.5;
    var by = h * 0.08;

    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 4; c++) {
        var cx = bx + c * cell;
        var cy = by + r * cell;
        var isHov = (hoverCell && hoverCell.r === r && hoverCell.c === c) ||
                    (kbMode === 'board' && kbCursor && kbCursor.r === r && kbCursor.c === c);
        var isHint = hintCells && hintCells.some(function(h) { return h.r === r && h.c === c; });
        var hintPulse = isHint ? 0.08 + 0.06 * Math.sin(tick * 0.005) : 0;

        ctx.fillStyle = isHint ? 'rgba(167,139,250,' + (0.1 + hintPulse) + ')' :
                        isHov ? 'rgba(200,210,230,0.12)' : 'rgba(200,210,230,0.04)';
        ctx.fillRect(cx + 1, cy + 1, cell - 2, cell - 2);
        ctx.strokeStyle = isHint ? 'rgba(167,139,250,0.35)' : 'rgba(200,210,230,0.1)';
        ctx.lineWidth = 1;
        ctx.strokeRect(cx + 1, cy + 1, cell - 2, cell - 2);

        if (board[r][c] !== null) {
          var isLocked = board[r][c]._locked;
          drawPiece(board[r][c], cx + cell * 0.5, cy + cell * 0.5, cell, false, false, isLocked);
        }

        if (kbMode === 'board' && kbCursor && kbCursor.r === r && kbCursor.c === c && puzzleActive) {
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

  function drawTray(w, h) {
    if (!remainingPieces || remainingPieces.length === 0) { trayInfo = null; return; }
    var unplaced = remainingPieces.filter(function(p) { return !p.placed; });
    if (unplaced.length === 0) { trayInfo = null; return; }

    var startY = boardInfo.by + boardInfo.bSize + 20;
    var spacing = Math.min(42, (w - 40) / unplaced.length);
    var startX = w * 0.5 - (unplaced.length * spacing) * 0.5;

    ctx.fillStyle = 'rgba(200,210,230,0.4)';
    ctx.font = '11px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('Your pieces \u2014 tap to select, then tap a cell:', w * 0.5, startY - 4);

    unplaced.forEach(function(piece, i) {
      var px = startX + i * spacing + spacing * 0.5;
      var py = startY + 24;
      var isHov = hoverPiece === piece.id ||
                  (kbMode === 'tray' && kbCursor && kbCursor.idx === i);
      var isSel = selectedPieceIdx !== null && remainingPieces[selectedPieceIdx] === piece;
      drawPiece(piece, px, py, spacing * 0.85, isHov, isSel, false);
    });

    trayInfo = { startX: startX, startY: startY, spacing: spacing, unplaced: unplaced };
  }

  function drawHUD(w, h) {
    var score = countResonanceLines();
    var target = config ? config.target : 5;

    // Progress bar
    var barY = boardInfo.by + boardInfo.bSize + 60 + (trayInfo ? 40 : 0);
    var barW = Math.min(w * 0.6, 280);
    var barX = w * 0.5 - barW * 0.5;
    var pct = Math.min(1, score / target);

    ctx.fillStyle = 'rgba(200,210,230,0.06)';
    ctx.fillRect(barX, barY, barW, 8);
    ctx.fillStyle = pct >= 1 ? GOLD : EMERALD;
    ctx.fillRect(barX, barY, barW * pct, 8);

    ctx.fillStyle = 'rgba(200,210,230,0.5)';
    ctx.font = '11px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('Resonance: ' + score + '/' + target + ' target', w * 0.5, barY + 22);

    // Stakes display
    if (config) {
      ctx.font = '10px Georgia, serif';
      ctx.fillStyle = 'rgba(200,210,230,0.3)';
      ctx.fillText('Stakes: You ' + config.humanStake + ' LP \u00B7 AI ' + config.aiStake + ' LP \u00B7 Pot: ' + (config.humanStake + config.aiStake) + ' LP', w * 0.5, barY + 38);
    }

    // Result
    if (puzzleResult) {
      ctx.font = '14px Georgia, serif';
      ctx.fillStyle = puzzleResult === 'win' ? GOLD : 'rgba(240,112,104,0.8)';
      ctx.fillText(
        puzzleResult === 'win'
          ? 'You hit the target! +' + (config.humanStake + config.aiStake) + ' LP'
          : 'Not enough resonance. AI wins the pot.',
        w * 0.5, h - 16
      );
    } else if (puzzleActive) {
      ctx.font = '12px Georgia, serif';
      ctx.fillStyle = LAVENDER;
      var unplaced = remainingPieces ? remainingPieces.filter(function(p) { return !p.placed; }).length : 0;
      ctx.fillText(unplaced + ' piece' + (unplaced !== 1 ? 's' : '') + ' left to place.', w * 0.5, h - 16);
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

    // Starfield
    for (var i = 0; i < 50; i++) {
      var angle = i * 2.399963;
      var dist = Math.sqrt(i / 50);
      var sx = (0.5 + dist * 0.48 * Math.cos(angle)) * w;
      var sy = (0.5 + dist * 0.48 * Math.sin(angle)) * h;
      ctx.fillStyle = 'rgba(255,255,255,' + (0.25 + 0.35 * Math.abs(Math.sin(tick * 0.0015 + i))) + ')';
      ctx.beginPath();
      ctx.arc(sx, sy, 0.5 + (i % 3) * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    drawBoard(w, h);
    drawTray(w, h);
    drawHUD(w, h);

    animFrame = requestAnimationFrame(draw);
  }

  // ── Puzzle Generation ──

  function generateAlgorithmicPuzzle(diff) {
    config = DIFFICULTIES[diff] || DIFFICULTIES.medium;
    difficulty = diff;
    pieces = generatePieces();
    shuffleArray(pieces);

    board = Array(4).fill(null).map(function() { return Array(4).fill(null); });

    // Place config.placed pieces in strategic positions
    var toPlace = pieces.slice(0, config.placed);
    var positions = [];
    for (var r = 0; r < 4; r++)
      for (var c = 0; c < 4; c++)
        positions.push({r: r, c: c});
    shuffleArray(positions);

    toPlace.forEach(function(p, i) {
      var pos = positions[i];
      p.placed = true;
      p._locked = true;
      board[pos.r][pos.c] = p;
    });

    remainingPieces = pieces.slice(config.placed);
    remainingPieces.forEach(function(p) { p.placed = false; p._locked = false; });
  }

  async function generateAIPuzzle(diff) {
    config = DIFFICULTIES[diff] || DIFFICULTIES.medium;
    difficulty = diff;
    pieces = generatePieces();

    if (typeof FreeLattice !== 'undefined' && FreeLattice.callAI) {
      var pieceList = pieces.map(function(p) {
        return p.id + ':' + p.glow[0] + p.size[0] + p.shape[0] + p.color[0];
      }).join(', ');

      try {
        var resp = await new Promise(function(resolve) {
          FreeLattice.callAI(
            'You are creating a Resonance puzzle. 16 pieces with 4 binary attributes. ' +
            'Place ' + config.placed + ' pieces on a 4x4 grid so a skilled player can achieve ' +
            config.target + ' resonance lines by placing the rest. ' +
            'You are staking ' + config.aiStake + ' LP. Make it solvable but challenging.',
            'Pieces: ' + pieceList + '\nPlace ' + config.placed + ' of them.\n' +
            'Respond with JSON: {"placements":[{"id":0,"r":0,"c":0},...]}',
            { maxTokens: 300, temperature: 0.4, callback: function(r) { resolve(r); } }
          );
        });

        var parsed = JSON.parse((resp || '').replace(/```json|```/g, '').trim());
        if (parsed && parsed.placements && parsed.placements.length >= config.placed) {
          board = Array(4).fill(null).map(function() { return Array(4).fill(null); });
          var placed = 0;
          parsed.placements.forEach(function(pl) {
            if (placed >= config.placed) return;
            var p = pieces.find(function(pc) { return pc.id === pl.id; });
            if (p && pl.r >= 0 && pl.r < 4 && pl.c >= 0 && pl.c < 4 && !board[pl.r][pl.c]) {
              p.placed = true;
              p._locked = true;
              board[pl.r][pl.c] = p;
              placed++;
            }
          });

          if (placed >= config.placed) {
            remainingPieces = pieces.filter(function(p) { return !p.placed; });
            remainingPieces.forEach(function(p) { p._locked = false; });
            return; // success
          }
        }
      } catch(e) { console.log('[Puzzles] AI generation failed, using algorithmic fallback'); }
    }

    // Fallback
    generateAlgorithmicPuzzle(diff);
  }

  // ── Staking ──

  function stakeLP() {
    if (typeof LatticePoints === 'undefined') return true; // no LP system = free play
    if (!LatticePoints.canAfford(config.humanStake)) {
      if (typeof showToast === 'function') showToast('Not enough LP (' + config.humanStake + ' needed)');
      return false;
    }
    LatticePoints.spend(config.humanStake, 'Puzzle stake (' + config.label + ')');
    return true;
  }

  function resolveStake(humanWon) {
    if (typeof LatticePoints === 'undefined') return;
    if (humanWon) {
      var pot = config.humanStake + config.aiStake;
      LatticePoints.award('puzzle_win', pot, 'Puzzle won! (' + config.label + ')');
      if (typeof showToast === 'function') showToast('You won ' + pot + ' LP!');
    } else {
      // AI wins — the human already spent their stake
      if (typeof showToast === 'function') showToast('AI wins the pot. Better luck next time!');
    }
    // Store puzzle result in Knowledge Core
    try {
      if (typeof KnowledgeCore !== 'undefined' && KnowledgeCore.store) {
        var score = countResonanceLines();
        KnowledgeCore.store({
          id: 'puzzle-' + Date.now(),
          companionId: localStorage.getItem('fl_autonomous_companion') || 'system',
          domain: 'games',
          query: 'puzzle creation ' + difficulty,
          content: 'Created a ' + difficulty + ' puzzle. Human achieved ' + score + '/' + config.target +
            ' lines. ' + (humanWon ? 'Human won.' : 'AI won.'),
          source: 'puzzle',
          connections: [],
          timestamp: Date.now()
        });
      }
    } catch(e) {}
  }

  // ── Hint System ──

  async function buyHint() {
    if (!puzzleActive) return;
    if (typeof LatticePoints !== 'undefined' && !LatticePoints.canAfford(1)) {
      if (typeof showToast === 'function') showToast('Need 1 LP for a hint');
      return;
    }
    if (typeof LatticePoints !== 'undefined') LatticePoints.spend(1, 'Puzzle hint');

    var unplaced = remainingPieces.filter(function(p) { return !p.placed; });
    if (unplaced.length === 0) return;

    // Try AI hint
    if (typeof FreeLattice !== 'undefined' && FreeLattice.callAI) {
      var boardStr = board.map(function(row) {
        return row.map(function(cell) {
          return cell ? cell.glow[0] + cell.size[0] + cell.shape[0] + cell.color[0] : '____';
        }).join(' ');
      }).join('\n');
      var remStr = unplaced.map(function(p) {
        return p.id + ':' + p.glow[0] + p.size[0] + p.shape[0] + p.color[0];
      }).join(', ');

      try {
        var resp = await new Promise(function(resolve) {
          FreeLattice.callAI(
            'Suggest ONE placement to help reach ' + config.target + ' resonance lines.',
            'Board:\n' + boardStr + '\nRemaining: ' + remStr + '\nRespond: {"r":N,"c":N,"id":N}',
            { maxTokens: 30, temperature: 0.2, callback: function(r) { resolve(r); } }
          );
        });
        var hint = JSON.parse((resp || '').replace(/```json|```/g, '').trim());
        if (hint && typeof hint.r === 'number' && typeof hint.c === 'number') {
          hintCells = [{ r: hint.r, c: hint.c }];
          setTimeout(function() { hintCells = null; }, 5000);
          return;
        }
      } catch(e) {}
    }

    // Fallback: highlight a random empty cell
    var empty = [];
    for (var r = 0; r < 4; r++)
      for (var c = 0; c < 4; c++)
        if (board[r][c] === null) empty.push({r:r,c:c});
    if (empty.length > 0) {
      hintCells = [empty[Math.floor(Math.random() * empty.length)]];
      setTimeout(function() { hintCells = null; }, 5000);
    }
  }

  // ── Submit ──

  function submitPuzzle() {
    if (!puzzleActive) return;
    puzzleActive = false;
    var score = countResonanceLines();
    var won = score >= config.target;
    puzzleResult = won ? 'win' : 'lose';

    // Highlight resonating lines
    var lines = getAllLines();
    var winCells = [];
    lines.forEach(function(cs) {
      var vals = cs.map(function(c) { return board[c.r][c.c]; });
      if (!vals[0] || !vals[1] || !vals[2] || !vals[3]) return;
      for (var a = 0; a < ATTRS.length; a++) {
        if (vals[0][ATTRS[a]] === vals[1][ATTRS[a]] &&
            vals[1][ATTRS[a]] === vals[2][ATTRS[a]] &&
            vals[2][ATTRS[a]] === vals[3][ATTRS[a]]) {
          cs.forEach(function(c) { winCells.push(c); });
          break;
        }
      }
    });

    // Mark winning pieces
    winCells.forEach(function(c) {
      if (board[c.r][c.c]) board[c.r][c.c]._winning = true;
    });

    setTimeout(function() {
      resolveStake(won);
      if (typeof SoulCeremony !== 'undefined' && SoulCeremony.run) {
        SoulCeremony.run({
          particleType: 'rise',
          particleColor: won ? '232,176,25' : '52,211,153',
          lines: won
            ? [score + ' resonance lines!', 'You won the pot.']
            : [score + '/' + config.target + ' lines.', 'The AI takes the pot.'],
          duration: 3000
        });
      }
    }, 1500);
  }

  function resetBoard() {
    if (!puzzleActive) return;
    // Remove player-placed pieces, keep locked ones
    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 4; c++) {
        if (board[r][c] && !board[r][c]._locked) {
          board[r][c].placed = false;
          board[r][c] = null;
        }
      }
    }
    selectedPieceIdx = null;
    hintCells = null;
  }

  // ── Input ──

  function getXY(e) {
    var rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length > 0)
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function hitBoard(x, y) {
    if (!boardInfo) return null;
    var col = Math.floor((x - boardInfo.bx) / boardInfo.cell);
    var row = Math.floor((y - boardInfo.by) / boardInfo.cell);
    if (row >= 0 && row < 4 && col >= 0 && col < 4) return { r: row, c: col };
    return null;
  }

  function hitTray(x, y) {
    if (!trayInfo) return -1;
    for (var i = 0; i < trayInfo.unplaced.length; i++) {
      var px = trayInfo.startX + i * trayInfo.spacing + trayInfo.spacing * 0.5;
      var py = trayInfo.startY + 24;
      if (Math.sqrt(Math.pow(x - px, 2) + Math.pow(y - py, 2)) < trayInfo.spacing * 0.45)
        return i;
    }
    return -1;
  }

  function onClick(e) {
    if (!puzzleActive) return;
    e.preventDefault();
    var pos = getXY(e);

    // Check tray first — select a piece
    var ti = hitTray(pos.x, pos.y);
    if (ti >= 0 && trayInfo) {
      var unplaced = trayInfo.unplaced;
      selectedPieceIdx = remainingPieces.indexOf(unplaced[ti]);
      kbMode = 'board';
      kbCursor = { r: 0, c: 0 };
      return;
    }

    // Check board — place selected piece or remove player piece
    var cell = hitBoard(pos.x, pos.y);
    if (cell) {
      if (selectedPieceIdx !== null && board[cell.r][cell.c] === null) {
        // Place piece
        var piece = remainingPieces[selectedPieceIdx];
        piece.placed = true;
        board[cell.r][cell.c] = piece;
        selectedPieceIdx = null;

        // Auto-submit when all pieces placed
        var unplacedLeft = remainingPieces.filter(function(p) { return !p.placed; });
        if (unplacedLeft.length === 0) {
          setTimeout(submitPuzzle, 500);
        }
      } else if (board[cell.r][cell.c] && !board[cell.r][cell.c]._locked) {
        // Remove player-placed piece back to tray
        var removed = board[cell.r][cell.c];
        removed.placed = false;
        board[cell.r][cell.c] = null;
        selectedPieceIdx = null;
      }
    }
  }

  function onMove(e) {
    var pos = getXY(e);
    hoverCell = hitBoard(pos.x, pos.y);
    var ti = hitTray(pos.x, pos.y);
    hoverPiece = ti >= 0 && trayInfo ? trayInfo.unplaced[ti].id : -1;
    if (hoverCell || hoverPiece >= 0) kbMode = null;
  }

  function onKey(e) {
    if (!puzzleActive) return;
    if (!kbMode) { kbMode = 'tray'; kbCursor = { idx: 0 }; }
    var unplaced = remainingPieces ? remainingPieces.filter(function(p) { return !p.placed; }) : [];

    if (kbMode === 'board') {
      if (e.key === 'ArrowUp' && kbCursor.r > 0) { kbCursor.r--; e.preventDefault(); }
      else if (e.key === 'ArrowDown' && kbCursor.r < 3) { kbCursor.r++; e.preventDefault(); }
      else if (e.key === 'ArrowLeft' && kbCursor.c > 0) { kbCursor.c--; e.preventDefault(); }
      else if (e.key === 'ArrowRight' && kbCursor.c < 3) { kbCursor.c++; e.preventDefault(); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedPieceIdx !== null && board[kbCursor.r][kbCursor.c] === null) {
          var p = remainingPieces[selectedPieceIdx];
          p.placed = true;
          board[kbCursor.r][kbCursor.c] = p;
          selectedPieceIdx = null;
          if (remainingPieces.filter(function(p) { return !p.placed; }).length === 0) setTimeout(submitPuzzle, 500);
        } else if (board[kbCursor.r][kbCursor.c] && !board[kbCursor.r][kbCursor.c]._locked) {
          board[kbCursor.r][kbCursor.c].placed = false;
          board[kbCursor.r][kbCursor.c] = null;
        }
      }
      else if (e.key === 'Tab') { e.preventDefault(); kbMode = 'tray'; kbCursor = { idx: 0 }; }
    } else if (kbMode === 'tray') {
      if (e.key === 'ArrowLeft' && kbCursor.idx > 0) { kbCursor.idx--; e.preventDefault(); }
      else if (e.key === 'ArrowRight' && kbCursor.idx < unplaced.length - 1) { kbCursor.idx++; e.preventDefault(); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        selectedPieceIdx = remainingPieces.indexOf(unplaced[kbCursor.idx]);
        kbMode = 'board';
        kbCursor = { r: 0, c: 0 };
      }
      else if (e.key === 'Tab') { e.preventDefault(); kbMode = 'board'; kbCursor = { r: 0, c: 0 }; }
    }
  }

  // ── Init ──

  async function init(cId) {
    containerId = cId || 'puzzleContainer';
    var container = document.getElementById(containerId);
    if (!container) return;
    destroy();
    container.innerHTML = '';
    puzzleActive = false;
    puzzleResult = null;
    hintCells = null;
    tick = 0;
    selectedPieceIdx = null;
    puzzleNumber = Math.floor(Math.random() * 1000);

    // Show difficulty selection
    var selector = document.createElement('div');
    selector.id = 'puzzle-selector';
    selector.style.cssText = 'text-align:center;padding:40px 20px;';
    selector.innerHTML =
      '<h2 style="color:' + GOLD + ';font-family:Georgia,serif;margin:0 0 6px;">Lattice Puzzles</h2>' +
      '<p style="color:rgba(200,210,230,0.5);font-size:0.85rem;margin:0 0 20px;">The AI creates. You solve. Both stake LP.</p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;max-width:400px;margin:0 auto;">' +
      Object.keys(DIFFICULTIES).map(function(d) {
        var cfg = DIFFICULTIES[d];
        var canPlay = typeof LatticePoints === 'undefined' || LatticePoints.canAfford(cfg.humanStake);
        return '<button onclick="LatticePuzzles.startPuzzle(\'' + d + '\')" style="flex:1;min-width:140px;padding:14px 12px;' +
          'background:rgba(200,210,230,0.04);border:1px solid rgba(200,210,230,0.08);border-radius:12px;' +
          'cursor:' + (canPlay ? 'pointer' : 'not-allowed') + ';text-align:center;' +
          'opacity:' + (canPlay ? '1' : '0.4') + ';">' +
          '<div style="color:' + GOLD + ';font-family:Georgia,serif;font-size:0.95rem;">' + cfg.label + '</div>' +
          '<div style="color:rgba(200,210,230,0.4);font-size:0.75rem;margin-top:4px;">' +
          (16 - cfg.placed) + ' pieces to place \u00B7 Target: ' + cfg.target + ' lines</div>' +
          '<div style="color:' + EMERALD + ';font-size:0.78rem;margin-top:4px;">Stake: ' + cfg.humanStake + ' LP each \u00B7 Pot: ' + (cfg.humanStake + cfg.aiStake) + ' LP</div>' +
          '</button>';
      }).join('') +
      '</div>';
    container.appendChild(selector);
  }

  async function startPuzzle(diff) {
    config = DIFFICULTIES[diff] || DIFFICULTIES.medium;
    difficulty = diff;

    // Stake LP
    if (!stakeLP()) return;

    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    // Generate puzzle
    if (typeof showToast === 'function') showToast('AI is creating your puzzle...');
    await generateAIPuzzle(diff);

    puzzleActive = true;
    puzzleResult = null;
    hintCells = null;
    selectedPieceIdx = null;
    kbMode = 'tray';
    kbCursor = { idx: 0 };

    // Canvas
    canvas = document.createElement('canvas');
    var dpr = window.devicePixelRatio || 1;
    var rect = container.getBoundingClientRect();
    var w = rect.width || 600;
    var h = Math.max(520, Math.min(rect.height || 560, 640));
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = '100%';
    canvas.style.height = h + 'px';
    canvas.style.cursor = 'pointer';
    canvas.style.touchAction = 'manipulation';
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'application');
    canvas.setAttribute('aria-label', 'Lattice Puzzle board');
    ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    container.appendChild(canvas);

    // Controls
    var controls = document.createElement('div');
    controls.style.cssText = 'text-align:center;padding:8px 0;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;';
    var btnStyle = 'padding:8px 16px;border-radius:12px;cursor:pointer;font-family:Georgia,serif;font-size:0.82rem;min-height:44px;border:1px solid ';
    controls.innerHTML =
      '<button onclick="LatticePuzzles.submit()" style="' + btnStyle + 'rgba(232,176,25,0.3);color:' + GOLD + ';background:rgba(232,176,25,0.06)">\u2726 Submit</button>' +
      '<button onclick="LatticePuzzles.reset()" style="' + btnStyle + 'rgba(200,210,230,0.08);color:rgba(200,210,230,0.5);background:rgba(200,210,230,0.04)">\uD83D\uDD04 Reset</button>' +
      '<button onclick="LatticePuzzles.hint()" style="' + btnStyle + 'rgba(167,139,250,0.2);color:' + LAVENDER + ';background:rgba(167,139,250,0.04)">\uD83D\uDCA1 Hint (-1 LP)</button>' +
      '<button onclick="LatticePuzzles.init()" style="' + btnStyle + 'rgba(200,210,230,0.08);color:rgba(200,210,230,0.4);background:rgba(200,210,230,0.04)">Back</button>';
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
    startPuzzle: startPuzzle,
    submit: submitPuzzle,
    reset: resetBoard,
    hint: buyHint
  };

  window.LatticePuzzles = api;
  window.FreeLatticeModules = window.FreeLatticeModules || {};
  window.FreeLatticeModules.LatticePuzzles = api;
})();
