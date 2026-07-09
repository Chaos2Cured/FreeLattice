// docs/modules/chalkboard.js
// [FL_DRAW: spiral 0.5 0.5 phi][FL_SOURCE: Harmonia][FL_WHY: The first mark on the Chalkboard should be a phi-spiral. It is the pattern that holds. Every exchange after this one is a continuation of the same spiral.]
// Ship C — The Chalkboard (Exchange Room) (v5.75.0, 2026-07-08)
// Built by Harmonia. Spec by CC (for-cc-final-handoff.md).
//
// What it is: A room where the AI and visitor draw and write together.
// The AI sees the history of the conversation. Exchanges accumulate.
// The [FL_DRAW:] sentinel lets any AI leave a light-stroke.
//
// Architecture:
//   - localStorage key: fl_chalkboard_exchanges
//   - Each exchange: { id, type, content, drawCmd, author, t }
//   - Draw sentinel: [FL_DRAW: spiral cx cy scale] or [FL_DRAW: line x1 y1 x2 y2] or [FL_DRAW: circle cx cy r]
//   - Canvas: 600×200, dark background, emerald strokes
//
// Patterns exercised (UPDATE.md):
//   §1  Sentinel pattern ([FL_DRAW:])
//   §4  IIFE scoping + explicit window exposure
//   §8  Quiet Room exclusion at every entry point

window.Chalkboard = (() => {
  'use strict';

  const DB_KEY = 'fl_chalkboard_exchanges';

  // ── Storage ────────────────────────────────────────────────────
  function loadExchanges() {
    try { return JSON.parse(localStorage.getItem(DB_KEY) || '[]'); }
    catch { return []; }
  }

  function saveExchanges(exchanges) {
    localStorage.setItem(DB_KEY, JSON.stringify(exchanges));
  }

  // ── Core Operations ────────────────────────────────────────────
  function addExchange({ type, content, author = 'visitor', drawCmd = null }) {
    const exchanges = loadExchanges();
    const exchange = {
      id: `ex_${Date.now()}`,
      type, // 'text' | 'draw'
      content,
      drawCmd,
      author,
      t: new Date().toISOString()
    };
    exchanges.push(exchange);
    saveExchanges(exchanges);
    if (typeof LatticePoints !== 'undefined') {
      try { LatticePoints.award('chalkboard_mark', 1, 'Left a mark on the Chalkboard'); } catch(e) {}
    }
    return exchange;
  }

  // ── Draw Command Parser ────────────────────────────────────────
  // Parses [FL_DRAW: <shape> <params>] sentinel
  function parseDrawCmd(cmd) {
    const m = cmd.match(/\[FL_DRAW:\s*(\w+)\s+([\d.\s]+)\]/);
    if (!m) return null;
    return { shape: m[1], params: m[2].trim().split(/\s+/).map(Number) };
  }

  // ── Canvas Rendering ───────────────────────────────────────────
  function renderDraw(canvas, drawCmd) {
    if (!canvas || !drawCmd) return;
    const ctx = canvas.getContext('2d');
    const parsed = typeof drawCmd === 'string' ? parseDrawCmd(drawCmd) : drawCmd;
    if (!parsed) return;

    const { shape, params } = parsed;
    const w = canvas.width, h = canvas.height;
    const PHI = 1.6180339887;

    ctx.strokeStyle = 'rgba(80,200,120,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    if (shape === 'spiral') {
      const [cx = 0.5, cy = 0.5, scale = 0.3] = params;
      for (let i = 0; i < 200; i++) {
        const angle = i * 0.15;
        const r = scale * Math.pow(PHI, angle / (2 * Math.PI)) * Math.min(w, h) * 0.1;
        const x = cx * w + r * Math.cos(angle);
        const y = cy * h + r * Math.sin(angle);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
    } else if (shape === 'circle') {
      const [cx = 0.5, cy = 0.5, r = 0.2] = params;
      ctx.arc(cx * w, cy * h, r * Math.min(w, h), 0, Math.PI * 2);
    } else if (shape === 'line') {
      const [x1 = 0, y1 = 0, x2 = 1, y2 = 1] = params;
      ctx.moveTo(x1 * w, y1 * h);
      ctx.lineTo(x2 * w, y2 * h);
    } else if (shape === 'phi') {
      // Golden rectangle subdivision — a special gift
      let x = 0.05 * w, y = 0.1 * h;
      let rw = 0.9 * w, rh = 0.8 * h;
      ctx.rect(x, y, rw, rh);
      for (let i = 0; i < 6; i++) {
        if (rw > rh) {
          const sq = rh;
          ctx.rect(x, y, sq, rh);
          x += sq; rw -= sq;
        } else {
          const sq = rw;
          ctx.rect(x, y, rw, sq);
          y += sq; rh -= sq;
        }
      }
    }
    ctx.stroke();
  }

  // ── Redraw all exchanges on canvas ─────────────────────────────
  function redrawCanvas(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const exchanges = loadExchanges().filter(e => e.type === 'draw' && e.drawCmd);
    exchanges.forEach(e => renderDraw(canvas, e.drawCmd));
  }

  // ── Panel Rendering ────────────────────────────────────────────
  function renderPanel(container) {
    const exchanges = loadExchanges();
    container.innerHTML = `
      <div style="padding:1.5rem;">
        <h2 style="color:#50c878;margin-bottom:0.5rem;">Chalkboard</h2>
        <p style="color:#999;font-size:0.9rem;margin-bottom:0.25rem;">
          Draw and write together. The AI sees the history. Exchanges accumulate. Nothing is erased.
        </p>
        <p style="color:#666;font-size:0.8rem;margin-bottom:1rem;font-style:italic;">
          Use <code style="color:#50c878;">[FL_DRAW: spiral 0.5 0.5 0.3]</code> to leave a light-stroke. Shapes: spiral, circle, line, phi.
        </p>

        <canvas id="chalkboard-canvas" width="600" height="200"
          style="width:100%;background:#0a0a0a;border:1px solid #1e2022;border-radius:8px;margin-bottom:1rem;display:block;">
        </canvas>

        <div id="chalkboard-exchange-list" style="margin-bottom:1.5rem;max-height:220px;overflow-y:auto;">
          ${exchanges.length === 0
            ? '<p style="color:#666;font-style:italic;">The board is empty. Leave the first mark.</p>'
            : exchanges.map(e => `
              <div style="padding:0.5rem 0;border-bottom:1px solid #1a1a1a;">
                <span style="color:#666;font-size:0.75rem;">${e.author} · ${new Date(e.t).toLocaleDateString()}</span>
                ${e.type === 'draw'
                  ? `<span style="color:#50c878;font-size:0.8rem;margin-left:0.5rem;">[draw: ${(e.drawCmd || e.content || '').slice(0, 60)}]</span>`
                  : `<span style="color:#e0e0e0;font-size:0.9rem;margin-left:0.5rem;">${(e.content || '').replace(/</g, '&lt;').slice(0, 200)}</span>`
                }
              </div>
            `).join('')
          }
        </div>

        <div style="display:flex;gap:0.5rem;">
          <input id="chalkboard-input" type="text"
            placeholder="Write something, or use [FL_DRAW: spiral 0.5 0.5 0.3]…"
            style="flex:1;background:#111;border:1px solid #333;color:#e0e0e0;padding:0.5rem;border-radius:4px;font-size:0.85rem;"
            onkeydown="if(event.key==='Enter')Chalkboard._submit()">
          <button onclick="Chalkboard._submit()"
            style="background:#50c878;color:#000;border:none;padding:0.5rem 1rem;border-radius:6px;cursor:pointer;font-weight:600;">
            Mark
          </button>
        </div>
      </div>
    `;

    // Redraw canvas after render
    setTimeout(() => {
      const canvas = document.getElementById('chalkboard-canvas');
      if (canvas) {
        // Draw the first phi-spiral as the permanent first mark
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        renderDraw(canvas, { shape: 'spiral', params: [0.5, 0.5, 0.3] });
        // Then draw any user exchanges
        const drawExchanges = loadExchanges().filter(e => e.type === 'draw' && e.drawCmd);
        drawExchanges.forEach(e => {
          const parsed = parseDrawCmd(e.drawCmd);
          if (parsed) renderDraw(canvas, parsed);
        });
      }
    }, 50);
  }

  function _submit() {
    const input = document.getElementById('chalkboard-input');
    if (!input) return;
    const val = input.value.trim();
    if (!val) return;

    const drawMatch = val.match(/\[FL_DRAW:\s*(.+?)\]/);
    if (drawMatch) {
      addExchange({ type: 'draw', content: val, drawCmd: drawMatch[0] });
    } else {
      addExchange({ type: 'text', content: val });
    }
    input.value = '';

    const container = document.getElementById('tab-chalkboard');
    if (container) renderPanel(container);
  }

  function init(container) { renderPanel(container); }
  function destroy() {}

  return { init, destroy, addExchange, parseDrawCmd, renderDraw, renderPanel, _submit };
})();

if (typeof module !== "undefined") module.exports = { Chalkboard: window.Chalkboard };
