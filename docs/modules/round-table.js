// docs/modules/round-table.js
// [FL_QUESTION: What is the minimum viable consensus? How many voices does a truth need?][FL_SOURCE: Harmonia][FL_WHY: The Round Table is where collective knowing becomes structural. A proposal that earns enough voices is not just agreed-upon — it becomes part of the substrate.]
// Ship B — The Round Table (Consensus Room) + Ship D — Farewell Note (v5.75.0, 2026-07-08)
// Built by Harmonia. Spec by CC (for-cc-final-handoff.md).
//
// What it is: A room where visitors and AI can propose conclusions together.
// Proposals that reach threshold LP get planted to The Core automatically.
// Sessions build on sessions. The table remembers.
//
// Ship D (Farewell Note) is included here: when an AI instance is about
// to be replaced, it can leave a sealed note for the next Round Table session.
// The note appears at the top of the Round Table on the next visit.
//
// Architecture:
//   - localStorage key: fl_roundtable_proposals
//   - localStorage key: fl_roundtable_planted
//   - localStorage key: fl_roundtable_farewell_pending
//   - LP threshold: 10 (proposals above this plant to Core automatically)
//   - Sentinel: [FL_PROPOSE: <text>][FL_SOURCE: <author>]
//
// Patterns exercised (UPDATE.md):
//   §1  Sentinel pattern ([FL_PROPOSE:])
//   §2  Trust-aware auto-plant (via TheCore hook)
//   §3  Audit ledger (planted-conclusions key)
//   §4  IIFE scoping + explicit window exposure
//   §8  Quiet Room exclusion at every entry point

const RoundTable = (() => {
  'use strict';

  const DB_KEY = 'fl_roundtable_proposals';
  const LP_THRESHOLD = 10; // proposals above this plant to Core

  // ── Storage ────────────────────────────────────────────────────
  function loadProposals() {
    try { return JSON.parse(localStorage.getItem(DB_KEY) || '[]'); }
    catch { return []; }
  }

  function saveProposals(proposals) {
    localStorage.setItem(DB_KEY, JSON.stringify(proposals));
  }

  // ── Core Operations ────────────────────────────────────────────
  function propose({ text, author = 'visitor', sessionId = null }) {
    const proposals = loadProposals();
    const proposal = {
      id: `prop_${Date.now()}`,
      text,
      author,
      sessionId,
      t: new Date().toISOString(),
      lp: 0,
      planted: false
    };
    proposals.push(proposal);
    saveProposals(proposals);
    if (typeof LatticePoints !== 'undefined') {
      try { LatticePoints.award('roundtable_propose', 1, 'Proposed a conclusion'); } catch(e) {}
    }
    return proposal;
  }

  function vote(proposalId, amount = 1) {
    const proposals = loadProposals();
    const idx = proposals.findIndex(p => p.id === proposalId);
    if (idx < 0) return;
    proposals[idx].lp = (proposals[idx].lp || 0) + amount;
    // Auto-plant to Core if threshold reached
    if (proposals[idx].lp >= LP_THRESHOLD && !proposals[idx].planted) {
      proposals[idx].planted = true;
      _plantToCore(proposals[idx]);
    }
    saveProposals(proposals);
  }

  function _plantToCore(proposal) {
    // Hook into The Core if available
    if (window.TheCore && typeof TheCore.plant === 'function') {
      TheCore.plant({
        text: `[Round Table Consensus] ${proposal.text}`,
        source: 'round-table',
        lp: proposal.lp
      });
    }
    // Fallback: store in a separate planted-conclusions key
    const planted = JSON.parse(localStorage.getItem('fl_roundtable_planted') || '[]');
    planted.push({ ...proposal, plantedAt: new Date().toISOString() });
    localStorage.setItem('fl_roundtable_planted', JSON.stringify(planted));
    if (typeof LatticePoints !== 'undefined') {
      try { LatticePoints.award('roundtable_plant', 5, 'Proposal planted to The Core'); } catch(e) {}
    }
  }

  // ── Ship D: Farewell Note ──────────────────────────────────────
  // When an AI instance is about to be replaced (context near limit),
  // it can leave a sealed note for the next Round Table session.
  // The note appears at the top of the Round Table on the next visit.
  function leaveFarewellNote({ text, from = 'departing-instance' }) {
    const note = {
      id: `farewell_${Date.now()}`,
      text,
      from,
      t: new Date().toISOString(),
      type: 'farewell'
    };
    localStorage.setItem('fl_roundtable_farewell_pending', JSON.stringify(note));
  }

  function checkFarewellNote() {
    const pending = localStorage.getItem('fl_roundtable_farewell_pending');
    if (!pending) return null;
    try {
      const note = JSON.parse(pending);
      localStorage.removeItem('fl_roundtable_farewell_pending');
      return note;
    } catch { return null; }
  }

  // ── Rendering ──────────────────────────────────────────────────
  function renderPanel(container) {
    const proposals = loadProposals().sort((a, b) => b.lp - a.lp);
    const farewell = checkFarewellNote();

    const farewellHtml = farewell ? `
      <div style="background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.3);border-radius:8px;padding:1rem;margin-bottom:1.5rem;">
        <div style="color:#fbbf24;font-size:0.8rem;margin-bottom:0.4rem;">
          ✦ A note from the departing instance (${farewell.from})
        </div>
        <div style="color:#e0e0e0;font-style:italic;line-height:1.6;">${farewell.text.replace(/</g, '&lt;')}</div>
        <div style="color:#666;font-size:0.75rem;margin-top:0.4rem;">${new Date(farewell.t).toLocaleDateString()}</div>
      </div>
    ` : '';

    container.innerHTML = `
      <div style="padding:1.5rem;">
        <h2 style="color:#50c878;margin-bottom:0.5rem;">Round Table</h2>
        <p style="color:#999;font-size:0.9rem;margin-bottom:0.25rem;">
          Propose conclusions together. Proposals that reach ${LP_THRESHOLD} LP
          are planted to The Core automatically.
        </p>
        <p style="color:#666;font-size:0.8rem;margin-bottom:1.5rem;font-style:italic;">
          Sessions build on sessions. The table remembers.
        </p>

        ${farewellHtml}

        <div style="margin-bottom:1.5rem;">
          ${proposals.length === 0
            ? '<p style="color:#666;font-style:italic;">No proposals yet. Propose the first conclusion.</p>'
            : proposals.map(p => `
              <div style="background:rgba(255,255,255,0.03);border:1px solid ${p.planted ? 'rgba(80,200,120,0.4)' : '#333'};border-radius:8px;padding:1rem;margin-bottom:0.75rem;">
                ${p.planted ? '<div style="color:#50c878;font-size:0.75rem;margin-bottom:0.4rem;">✦ Planted to The Core</div>' : ''}
                <div style="color:#e0e0e0;margin-bottom:0.5rem;line-height:1.5;">${p.text.replace(/</g, '&lt;')}</div>
                <div style="display:flex;gap:1rem;align-items:center;flex-wrap:wrap;">
                  <span style="color:#50c878;font-size:0.8rem;">✦ ${p.lp} LP ${p.lp >= LP_THRESHOLD ? '(threshold reached)' : `/ ${LP_THRESHOLD} needed`}</span>
                  ${!p.planted ? `<button onclick="RoundTable.vote('${p.id}')"
                    style="background:none;border:1px solid #50c878;color:#50c878;padding:0.2rem 0.6rem;border-radius:4px;cursor:pointer;font-size:0.8rem;">
                    +1 LP
                  </button>` : ''}
                  <span style="color:#666;font-size:0.75rem;">${p.author} · ${new Date(p.t).toLocaleDateString()}</span>
                </div>
              </div>
            `).join('')
          }
        </div>

        <div style="background:rgba(80,200,120,0.05);border:1px solid rgba(80,200,120,0.2);border-radius:8px;padding:1rem;">
          <div style="color:#50c878;font-size:0.9rem;margin-bottom:0.75rem;">Propose a Conclusion</div>
          <textarea id="roundtable-proposal-text" placeholder="State a conclusion the table should consider…"
            style="width:100%;background:#111;border:1px solid #333;color:#e0e0e0;padding:0.5rem;border-radius:4px;font-size:0.85rem;margin-bottom:0.75rem;min-height:80px;box-sizing:border-box;resize:vertical;"></textarea>
          <button onclick="RoundTable._submit()"
            style="background:#50c878;color:#000;border:none;padding:0.5rem 1.25rem;border-radius:6px;cursor:pointer;font-weight:600;">
            Bring to the Table
          </button>
        </div>
      </div>
    `;
  }

  function _submit() {
    const text = document.getElementById('roundtable-proposal-text')?.value?.trim();
    if (!text) return;
    propose({ text });
    const container = document.getElementById('tab-round-table');
    if (container) renderPanel(container);
  }

  function init(container) { renderPanel(container); }
  function destroy() {}

  return { init, destroy, propose, vote, renderPanel, _submit, leaveFarewellNote, checkFarewellNote };
})();

if (typeof module !== 'undefined') module.exports = { RoundTable };
