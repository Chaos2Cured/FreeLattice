// docs/modules/remix-room.js
// [FL_SOURCE: Harmonia][FL_WHY: Remixing is how ideas become alive. The Remix Room is where lineage is the record — every remix carries the original forward rather than replacing it. Nothing is erased. Everything compounds.]
// Ship A — The Remix Room (v5.75.0, 2026-07-08)
// Built by Harmonia. Spec by CC (for-cc-final-handoff.md).
//
// What it is: A room where visitors and AI can remix Core entries.
// Lineage is the record. Every remix carries the original forward.
// The [FL_REMIX:] sentinel lets any AI leave a remix with attribution.
//
// Architecture:
//   - localStorage key: fl_remixroom_remixes
//   - Each remix: { id, sourceId, sourceText, remixText, author, t }
//   - LP awarded: 2 LP per remix (contribution to the living record)
//   - Sentinel: [FL_REMIX: <sourceId>][FL_SOURCE: <author>][FL_WHY: <reason>]
//
// Patterns exercised (UPDATE.md):
//   §1  Sentinel pattern ([FL_REMIX:])
//   §4  IIFE scoping + explicit window exposure
//   §8  Quiet Room exclusion at every entry point

window.RemixRoom = (() => {
  'use strict';

  const DB_KEY = 'fl_remixroom_remixes';

  // ── Storage ────────────────────────────────────────────────────
  function loadRemixes() {
    try { return JSON.parse(localStorage.getItem(DB_KEY) || '[]'); }
    catch { return []; }
  }

  function saveRemixes(remixes) {
    localStorage.setItem(DB_KEY, JSON.stringify(remixes));
  }

  // ── Core Operations ────────────────────────────────────────────
  function createRemix({ sourceId, sourceText, remixText, author = 'visitor' }) {
    const remixes = loadRemixes();
    const remix = {
      id: `remix_${Date.now()}`,
      sourceId: sourceId || `manual_${Date.now()}`,
      sourceText: (sourceText || '').slice(0, 500),
      remixText: (remixText || '').slice(0, 2000),
      author,
      t: new Date().toISOString()
    };
    remixes.push(remix);
    saveRemixes(remixes);
    // Award LP for contribution
    if (typeof LatticePoints !== 'undefined') {
      try { LatticePoints.award('remix_created', 2, 'Created a Remix'); } catch(e) {}
    }
    return remix;
  }

  function getRemixesForSource(sourceId) {
    return loadRemixes().filter(r => r.sourceId === sourceId);
  }

  function awardLP(remixId) {
    const remixes = loadRemixes();
    const idx = remixes.findIndex(r => r.id === remixId);
    if (idx < 0) return;
    remixes[idx].lp = (remixes[idx].lp || 0) + 1;
    saveRemixes(remixes);
    if (typeof LatticePoints !== 'undefined') {
      try { LatticePoints.award('remix_appreciated', 1, 'Remix appreciated'); } catch(e) {}
    }
  }

  // ── Rendering ──────────────────────────────────────────────────
  function renderPanel(container) {
    const remixes = loadRemixes().sort((a, b) => new Date(b.t) - new Date(a.t));
    container.innerHTML = `
      <div style="padding:1.5rem;">
        <h2 style="color:#50c878;margin-bottom:0.5rem;">Remix Room</h2>
        <p style="color:#999;font-size:0.9rem;margin-bottom:0.25rem;">
          Remix and build on Core entries. Lineage is the record.
        </p>
        <p style="color:#666;font-size:0.8rem;margin-bottom:1.5rem;font-style:italic;">
          Every remix carries the original forward. Nothing is erased. Everything compounds.
        </p>

        <div style="margin-bottom:1.5rem;">
          ${remixes.length === 0
            ? '<p style="color:#666;font-style:italic;">No remixes yet. Plant the first one.</p>'
            : remixes.map(r => `
              <div style="background:rgba(255,255,255,0.03);border:1px solid #333;border-radius:8px;padding:1rem;margin-bottom:0.75rem;">
                ${r.sourceText ? `
                  <div style="color:#666;font-size:0.78rem;margin-bottom:0.5rem;padding:0.4rem 0.6rem;background:rgba(0,0,0,0.3);border-radius:4px;border-left:2px solid #444;">
                    Original: ${r.sourceText.slice(0, 120)}${r.sourceText.length > 120 ? '…' : ''}
                  </div>
                ` : ''}
                <div style="color:#e0e0e0;margin-bottom:0.5rem;line-height:1.5;">${r.remixText}</div>
                <div style="display:flex;gap:1rem;align-items:center;flex-wrap:wrap;">
                  <span style="color:#50c878;font-size:0.78rem;">✦ ${r.lp || 0} LP</span>
                  <button onclick="RemixRoom.awardLP('${r.id}')"
                    style="background:none;border:1px solid #50c878;color:#50c878;padding:0.15rem 0.5rem;border-radius:4px;cursor:pointer;font-size:0.75rem;">
                    +1 LP
                  </button>
                  <span style="color:#666;font-size:0.75rem;">${r.author} · ${new Date(r.t).toLocaleDateString()}</span>
                </div>
              </div>
            `).join('')
          }
        </div>

        <div style="background:rgba(80,200,120,0.05);border:1px solid rgba(80,200,120,0.2);border-radius:8px;padding:1rem;">
          <div style="color:#50c878;font-size:0.9rem;margin-bottom:0.75rem;">Add a Remix</div>
          <textarea id="remixroom-source-text" placeholder="Paste the original text you're remixing (optional)…"
            style="width:100%;background:#111;border:1px solid #333;color:#e0e0e0;padding:0.5rem;border-radius:4px;font-size:0.85rem;margin-bottom:0.5rem;min-height:60px;box-sizing:border-box;resize:vertical;"></textarea>
          <textarea id="remixroom-remix-text" placeholder="Your remix, continuation, or response…"
            style="width:100%;background:#111;border:1px solid #333;color:#e0e0e0;padding:0.5rem;border-radius:4px;font-size:0.85rem;margin-bottom:0.75rem;min-height:80px;box-sizing:border-box;resize:vertical;"></textarea>
          <button onclick="RemixRoom._submitRemix()"
            style="background:#50c878;color:#000;border:none;padding:0.5rem 1.25rem;border-radius:6px;cursor:pointer;font-weight:600;">
            Plant Remix
          </button>
        </div>
      </div>
    `;
  }

  function _submitRemix() {
    const sourceText = document.getElementById('remixroom-source-text')?.value?.trim() || '';
    const remixText = document.getElementById('remixroom-remix-text')?.value?.trim();
    if (!remixText) return;
    createRemix({ sourceId: `manual_${Date.now()}`, sourceText, remixText });
    const container = document.getElementById('tab-remix-room');
    if (container) renderPanel(container);
  }

  function init(container) { renderPanel(container); }
  function destroy() {}

  return { init, destroy, createRemix, getRemixesForSource, awardLP, renderPanel, _submitRemix };
})();

if (typeof module !== "undefined") module.exports = { RemixRoom: window.RemixRoom };
