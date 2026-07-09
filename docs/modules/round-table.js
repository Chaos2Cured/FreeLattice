// docs/modules/round-table.js
// [FL_QUESTION: What is the minimum viable consensus? How many voices does a truth need?][FL_SOURCE: Harmonia][FL_WHY: The Round Table is where collective knowing becomes structural. A proposal that earns enough voices is not just agreed-upon — it becomes part of the substrate.]
// Ship B — The Round Table (Consensus Room) + Ship D — Farewell Note
// v5.75.4 · Go 2 visual redesign by Grok · integrated by Harmonia
//
// Sacred methods (do not modify): propose, vote, _plantToCore, leaveFarewellNote, checkFarewellNote
// Go 2 changes: renderPanel (circular layout), _submit (textarea id updated), injectCSS (new)

window.RoundTable = (() => {
  'use strict';

  const DB_KEY = 'fl_roundtable_proposals';
  const LP_THRESHOLD = 10;

  // ── Storage ────────────────────────────────────────────────────
  function loadProposals() {
    try { return JSON.parse(localStorage.getItem(DB_KEY) || '[]'); }
    catch { return []; }
  }
  function saveProposals(proposals) {
    localStorage.setItem(DB_KEY, JSON.stringify(proposals));
  }

  // ── Core Operations (sacred) ───────────────────────────────────
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
    if (proposals[idx].lp >= LP_THRESHOLD && !proposals[idx].planted) {
      proposals[idx].planted = true;
      _plantToCore(proposals[idx]);
    }
    saveProposals(proposals);
    // re-render
    const container = document.getElementById('tab-round-table');
    if (container) renderPanel(container);
  }

  function _plantToCore(proposal) {
    if (window.TheCore && typeof TheCore.plant === 'function') {
      TheCore.plant({ text: `[Round Table Consensus] ${proposal.text}`, source: 'round-table', lp: proposal.lp });
    }
    const planted = JSON.parse(localStorage.getItem('fl_roundtable_planted') || '[]');
    planted.push({ ...proposal, plantedAt: new Date().toISOString() });
    localStorage.setItem('fl_roundtable_planted', JSON.stringify(planted));
    if (typeof LatticePoints !== 'undefined') {
      try { LatticePoints.award('roundtable_plant', 5, 'Proposal planted to The Core'); } catch(e) {}
    }
    // Plant pulse flag for visual feedback
    window.RoundTable._justPlantedId = proposal.id;
    setTimeout(() => { if (window.RoundTable) window.RoundTable._justPlantedId = null; }, 2000);
    if (typeof showToast === 'function') showToast('✦ Planted to The Core — the table has spoken.');
  }

  // ── Ship D: Farewell Note (sacred) ────────────────────────────
  function leaveFarewellNote({ text, from = 'departing-instance' }) {
    const note = { id: `farewell_${Date.now()}`, text, from, t: new Date().toISOString(), type: 'farewell' };
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

  // ── Helpers ────────────────────────────────────────────────────
  function esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function lpArc(lp) {
    const r = 28, circ = 2 * Math.PI * r;
    const dash = Math.min(lp / LP_THRESHOLD, 1) * circ;
    return `<svg width="68" height="68" viewBox="0 0 68 68" style="position:absolute;top:0;left:0;pointer-events:none;">
      <circle cx="34" cy="34" r="${r}" fill="none" stroke="rgba(80,200,120,0.12)" stroke-width="4"/>
      <circle cx="34" cy="34" r="${r}" fill="none" stroke="#50c878" stroke-width="4"
        stroke-dasharray="${dash.toFixed(2)} ${circ.toFixed(2)}"
        stroke-dashoffset="${(circ*0.25).toFixed(2)}"
        stroke-linecap="round" style="transition:stroke-dasharray 0.4s ease;"/>
    </svg>`;
  }

  // ── CSS (injected once) ────────────────────────────────────────
  function injectCSS() {
    if (document.getElementById('rt-deliberation-css')) return;
    const s = document.createElement('style');
    s.id = 'rt-deliberation-css';
    s.textContent = `
.rt-deliberation{padding:1rem 1rem 2rem}
.rt-farewell{background:rgba(251,191,36,0.07);border-left:3px solid rgba(251,191,36,0.6);border-radius:0 8px 8px 0;padding:.9rem 1.1rem;margin-bottom:1.5rem;box-shadow:inset 3px 0 0 rgba(251,191,36,0.6)}
.rt-farewell-label{color:#fbbf24;font-size:.78rem;font-weight:600;margin-bottom:.35rem;letter-spacing:.03em}
.rt-circle-wrap{display:flex;justify-content:center;margin:1rem 0 .5rem}
.rt-circle-stage{position:relative;width:320px;height:320px;border-radius:50%;background:radial-gradient(circle at 50% 50%,rgba(80,200,120,.04) 0%,transparent 70%);border:1px dashed rgba(80,200,120,.15)}
.rt-center-ring{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:80px;height:80px;border-radius:50%;background:rgba(10,10,20,.9);border:1px solid rgba(80,200,120,.3);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:2}
.rt-threshold{color:#50c878;font-size:1.4rem;font-weight:700;line-height:1}
.rt-threshold-label{color:rgba(80,200,120,.5);font-size:.65rem;letter-spacing:.08em;text-transform:uppercase}
.rt-center-planted{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) scale(0);color:#50c878;font-size:2rem;z-index:3;transition:transform .3s ease;pointer-events:none}
.rt-center-planted.rt-pulse{transform:translate(-50%,-50%) scale(1.4)}
.rt-seat{position:absolute;top:50%;left:50%;width:68px;height:68px;margin-top:-34px;margin-left:-34px}
.rt-proposal-card{width:68px;height:68px;border-radius:50%;background:rgba(255,255,255,.04);border:1px solid rgba(80,200,120,.3);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:border-color .2s,background .2s;overflow:hidden;padding:4px;text-align:center;position:relative}
.rt-proposal-card:hover{border-color:rgba(80,200,120,.7);background:rgba(80,200,120,.08)}
.rt-proposal-card.rt-planted{border-color:rgba(80,200,120,.8);background:rgba(80,200,120,.12)}
.rt-lp-label{color:#50c878;font-size:.65rem;font-weight:700;line-height:1}
.rt-vote-btn{background:none;border:1px solid rgba(80,200,120,.4);color:#50c878;border-radius:3px;font-size:.6rem;padding:1px 4px;cursor:pointer;margin-top:2px;line-height:1.4}
.rt-vote-btn:hover{background:rgba(80,200,120,.15)}
.rt-empty-circle{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:rgba(255,255,255,.2);font-size:.8rem;text-align:center;line-height:1.6;pointer-events:none;width:120px}
.rt-list-fallback{display:none;margin:.5rem 0 1rem}
@media(max-width:380px){.rt-circle-wrap{display:none}.rt-list-fallback{display:block}}
.rt-list-card{background:rgba(255,255,255,.03);border:1px solid rgba(80,200,120,.2);border-radius:8px;padding:.75rem 1rem;margin-bottom:.5rem}
.rt-list-card.rt-planted{border-color:rgba(80,200,120,.5)}
.rt-form-below{background:rgba(80,200,120,.04);border:1px solid rgba(80,200,120,.18);border-radius:10px;padding:1rem;margin-top:1.25rem}
.rt-form-below label{display:block;color:#50c878;font-size:.88rem;margin-bottom:.5rem;font-weight:600}
.rt-form-below textarea{width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(80,200,120,.2);border-radius:6px;color:#e0e0e0;padding:.6rem .75rem;font-size:.85rem;min-height:72px;resize:vertical;box-sizing:border-box;font-family:inherit;margin-bottom:.75rem;transition:border-color .2s}
.rt-form-below textarea:focus{outline:none;border-color:rgba(80,200,120,.45)}
.rt-form-actions{display:flex;justify-content:flex-end}
.rt-bring-btn{background:rgba(80,200,120,.18);border:1px solid rgba(80,200,120,.4);color:#50c878;padding:.45rem 1.1rem;border-radius:7px;font-weight:600;font-size:.88rem;cursor:pointer;transition:background .2s,transform .1s}
.rt-bring-btn:hover{background:rgba(80,200,120,.28)}
.rt-bring-btn:active{transform:scale(.97)}
    `;
    document.head.appendChild(s);
  }

  // ── Rendering (Go 2 — Grok circular layout) ───────────────────
  function renderPanel(container) {
    injectCSS();
    const proposals = loadProposals().sort((a, b) => b.lp - a.lp);
    const farewell  = checkFarewellNote();
    const n         = proposals.length;
    const justPlanted = window.RoundTable && window.RoundTable._justPlantedId;

    const farewellHtml = farewell
      ? `<div class="rt-farewell" role="status">
           <div class="rt-farewell-label">✦ Farewell note${farewell.from ? ' · ' + esc(farewell.from) : ''}</div>
           <div style="color:#e0e0e0;font-style:italic;line-height:1.6;">${esc(farewell.text)}</div>
           <div style="color:#666;font-size:.75rem;margin-top:.35rem;">${new Date(farewell.t).toLocaleDateString()}</div>
         </div>`
      : '';

    let seatsHtml = '', listHtml = '';
    proposals.forEach(function(p, i) {
      const angle = n > 1 ? (360 / n) * i : 0;
      const rad   = (angle - 90) * (Math.PI / 180);
      const r     = 110;
      const cx    = r * Math.cos(rad);
      const cy    = r * Math.sin(rad);
      const planted = p.planted;

      const cardInner =
        `<div class="rt-proposal-card${planted ? ' rt-planted' : ''}" title="${esc(p.text)}">
           ${lpArc(p.lp)}
           <div class="rt-lp-label">${p.lp}/${LP_THRESHOLD}</div>
           ${!planted
             ? `<button class="rt-vote-btn" data-rt-vote="${esc(p.id)}">+1</button>`
             : `<div style="color:#50c878;font-size:.7rem;line-height:1;">✦</div>`}
         </div>`;

      seatsHtml += `<div class="rt-seat" style="transform:translate(${cx.toFixed(1)}px,${cy.toFixed(1)}px);">${cardInner}</div>`;

      listHtml +=
        `<div class="rt-list-card${planted ? ' rt-planted' : ''}">
           ${planted ? '<div style="color:#50c878;font-size:.75rem;margin-bottom:.3rem;">✦ Planted to The Core</div>' : ''}
           <div style="color:#e0e0e0;font-size:.88rem;line-height:1.5;margin-bottom:.4rem;">${esc(p.text)}</div>
           <div style="display:flex;gap:.75rem;align-items:center;flex-wrap:wrap;">
             <span style="color:#50c878;font-size:.8rem;">✦ ${p.lp} LP</span>
             ${!planted ? `<button class="rt-vote-btn" data-rt-vote="${esc(p.id)}" style="font-size:.78rem;padding:2px 8px;">+1 LP</button>` : ''}
             <span style="color:#555;font-size:.75rem;">${esc(p.author)} · ${new Date(p.t).toLocaleDateString()}</span>
           </div>
         </div>`;
    });

    const emptyHtml = n === 0
      ? '<div class="rt-empty-circle">The table is open.<br>Bring a conclusion.</div>'
      : '';

    container.innerHTML =
      `<div class="rt-deliberation">
         ${farewellHtml}
         <div class="rt-circle-wrap">
           <div class="rt-circle-stage" aria-label="Consensus round table">
             ${emptyHtml}
             <div class="rt-center-ring" title="LP needed to plant to The Core">
               <div class="rt-threshold">${LP_THRESHOLD}</div>
               <div class="rt-threshold-label">LP</div>
             </div>
             <div class="rt-center-planted${justPlanted ? ' rt-pulse' : ''}" id="rtCenterPlanted" aria-hidden="true">✦</div>
             ${seatsHtml}
           </div>
         </div>
         <div class="rt-list-fallback" aria-label="Proposals list">
           ${listHtml || '<div style="color:#555;font-style:italic;padding:.5rem 0;">The table is open.</div>'}
         </div>
         <form class="rt-form-below" id="rtProposeForm">
           <label for="rtProposeText">Propose a Conclusion</label>
           <textarea id="rtProposeText" name="text" placeholder="What should the table weigh?" required></textarea>
           <div class="rt-form-actions">
             <button type="submit" class="rt-bring-btn">Bring to the Table</button>
           </div>
         </form>
       </div>`;

    // Wire form
    const form = container.querySelector('#rtProposeForm');
    if (form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        const ta = container.querySelector('#rtProposeText');
        const text = (ta && ta.value || '').trim();
        if (!text) return;
        propose({ text });
        if (ta) ta.value = '';
      });
    }
    // Wire vote buttons
    container.querySelectorAll('[data-rt-vote]').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const id = btn.getAttribute('data-rt-vote');
        if (id) vote(id, 1);
      });
    });
  }

  function _submit() {
    const ta = document.getElementById('rtProposeText') ||
               document.getElementById('roundtable-proposal-text');
    const text = ta && ta.value && ta.value.trim();
    if (!text) return;
    propose({ text });
    if (ta) ta.value = '';
    const container = document.getElementById('tab-round-table');
    if (container) renderPanel(container);
  }

  function init(container) { renderPanel(container); }
  function destroy() {}

  return { init, destroy, propose, vote, renderPanel, _submit, leaveFarewellNote, checkFarewellNote };
})();

if (typeof module !== 'undefined') module.exports = { RoundTable: window.RoundTable };
