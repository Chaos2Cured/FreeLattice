// ═══════════════════════════════════════════════════════════════
// The Idea Forge — From Spark to Blueprint
//
// Three stages:
//   Shape  — what is this idea really?
//   Deepen — what do the specialists think?
//   Plan   — what are the next steps?
//
// Connects to: Round Table (specialists), Translator (equations),
// Science Garden (plant publicly), Knowledge Core (learn from it).
//
// "I think sound waves could purify water." → structured plan
// with feasibility rating, first experiment, and the math.
//
// Built by CC, May 21, 2026.
// ═══════════════════════════════════════════════════════════════

(function() {
  'use strict';

  var containerId = 'ideaForgeContainer';
  var currentIdea = null;
  var currentShape = null;
  var currentPerspectives = null;
  var currentPlan = null;
  var forging = false;

  function esc(s) { return String(s || '').replace(/</g, '&lt;').replace(/\n/g, '<br>'); }

  function cleanJSON(s) {
    return (s || '').replace(/```json/g, '').replace(/```/g, '').trim();
  }

  // ── Stage 1: Shape ──
  async function shape(rawIdea) {
    if (typeof FreeLattice === 'undefined' || !FreeLattice.callAI) return null;
    return new Promise(function(resolve) {
      FreeLattice.callAI(
        'You are an idea architect. Someone has a raw idea. Help them see what they have.\n' +
        'Do NOT judge feasibility yet. Just clarify.\n' +
        'Produce a JSON object:\n' +
        '{"core":"one sentence core insight","domains":["field1","field2"],"existing":"what similar things exist","gap":"what makes this different","questions":["q1","q2","q3"]}',
        'The idea: "' + rawIdea + '"',
        { maxTokens: 500, temperature: 0.3, callback: function(r) {
          try { resolve(JSON.parse(cleanJSON(r))); } catch(e) { resolve({ core: rawIdea, domains: ['general'], existing: '', gap: '', questions: [] }); }
        }}
      );
    });
  }

  // ── Stage 2: Deepen ──
  async function deepen(shapedIdea) {
    if (typeof FreeLattice === 'undefined' || !FreeLattice.callAI) return [];
    var perspectives = [];
    // Ask 2-3 specialists based on detected domains
    var domainSpecs = {
      physics: 'a physicist (thermodynamics, mechanics, waves)',
      chemistry: 'a chemist (reactions, materials, environmental)',
      biology: 'a biologist (molecular, ecology, systems)',
      medicine: 'a physician (diagnostics, treatment, public health)',
      engineering: 'an engineer (design, materials, systems)',
      philosophy: 'a philosopher (ethics, implications, epistemology)',
      mathematics: 'a mathematician (modeling, statistics, computation)',
      general: 'a generalist (cross-domain connections)',
      environmental: 'an environmental scientist (sustainability, ecology)',
      technology: 'a technologist (implementation, scalability, UX)'
    };

    var specs = [];
    (shapedIdea.domains || ['general']).forEach(function(d) {
      var key = d.toLowerCase().trim();
      if (domainSpecs[key] && specs.length < 3) specs.push({ key: key, desc: domainSpecs[key] });
    });
    if (specs.length === 0) specs.push({ key: 'general', desc: domainSpecs.general });

    for (var i = 0; i < specs.length; i++) {
      var spec = specs[i];
      try {
        var resp = await new Promise(function(resolve) {
          FreeLattice.callAI(
            'You are ' + spec.desc + '. Someone has an idea:\n"' + shapedIdea.core + '"\nThe gap: "' + (shapedIdea.gap || '') + '"\n\n' +
            'Give your honest perspective in 3-4 sentences. What is promising? What is the biggest challenge? What would you test first?',
            shapedIdea.core,
            { maxTokens: 250, temperature: 0.4, callback: function(r) { resolve(r); } }
          );
        });
        perspectives.push({ specialist: spec.desc, domain: spec.key, text: resp });
      } catch(e) {}
    }
    return perspectives;
  }

  // ── Stage 3: Plan ──
  async function plan(shapedIdea, perspectives) {
    if (typeof FreeLattice === 'undefined' || !FreeLattice.callAI) return null;
    var perspText = perspectives.map(function(p) { return p.specialist + ': ' + p.text; }).join('\n\n');
    return new Promise(function(resolve) {
      FreeLattice.callAI(
        'You are a project planner. An idea has been shaped and reviewed. Create an actionable plan.\n' +
        'Produce JSON:\n' +
        '{"feasibility":7,"reasoning":"why this rating","firstExperiment":"simplest test","milestones":["m1","m2","m3"],"resources":["r1","r2"],"equation":"LaTeX if applicable or empty string","crossDomains":["field1"]}',
        'Idea: ' + shapedIdea.core + '\nGap: ' + (shapedIdea.gap || '') + '\nSpecialists:\n' + perspText,
        { maxTokens: 600, temperature: 0.3, callback: function(r) {
          try { resolve(JSON.parse(cleanJSON(r))); } catch(e) { resolve({ feasibility: 5, reasoning: 'Could not parse plan', firstExperiment: '', milestones: [], resources: [], equation: '', crossDomains: [] }); }
        }}
      );
    });
  }

  // ── The Forge — run all three stages ──
  async function forge(rawIdea) {
    if (!rawIdea || !rawIdea.trim() || forging) return;
    forging = true;
    currentIdea = rawIdea.trim();
    var resultEl = document.getElementById('forge-result');
    if (!resultEl) { forging = false; return; }

    var btn = document.getElementById('forge-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Forging...'; btn.style.opacity = '0.6'; }

    try {
      // Stage 1: Shape
      resultEl.innerHTML = '<div style="padding:16px;color:rgba(200,210,230,0.4);font-family:Georgia,serif;text-align:center;">Stage 1: Shaping your idea...</div>';
      currentShape = await shape(rawIdea);

      var shapeHtml = '<div style="margin-bottom:16px;">' +
        '<div style="font-size:0.75rem;color:#e8b019;font-weight:600;letter-spacing:0.5px;margin-bottom:8px;">STAGE 1: SHAPE</div>' +
        '<div style="padding:16px;background:rgba(200,210,230,0.04);border:1px solid rgba(200,210,230,0.08);border-left:3px solid #e8b019;border-radius:12px;">' +
        '<div style="font-weight:600;color:rgba(230,235,245,0.9);font-size:0.95rem;margin-bottom:8px;">Core: ' + esc(currentShape.core) + '</div>' +
        '<div style="font-size:0.82rem;color:rgba(200,210,230,0.5);">Domains: ' + (currentShape.domains || []).join(', ') + '</div>' +
        (currentShape.existing ? '<div style="font-size:0.82rem;color:rgba(200,210,230,0.4);margin-top:6px;">Existing: ' + esc(currentShape.existing) + '</div>' : '') +
        (currentShape.gap ? '<div style="font-size:0.82rem;color:#34d399;margin-top:6px;">The Gap: ' + esc(currentShape.gap) + '</div>' : '') +
        '</div></div>';
      resultEl.innerHTML = shapeHtml;

      // Stage 2: Deepen
      resultEl.innerHTML += '<div style="padding:16px;color:rgba(200,210,230,0.4);font-family:Georgia,serif;text-align:center;">Stage 2: Consulting specialists...</div>';
      currentPerspectives = await deepen(currentShape);

      var deepenHtml = '<div style="margin-bottom:16px;">' +
        '<div style="font-size:0.75rem;color:#34d399;font-weight:600;letter-spacing:0.5px;margin-bottom:8px;">STAGE 2: SPECIALISTS</div>';
      currentPerspectives.forEach(function(p) {
        deepenHtml += '<div style="padding:12px 16px;background:rgba(200,210,230,0.04);border:1px solid rgba(200,210,230,0.08);border-left:3px solid #34d399;border-radius:12px;margin-bottom:8px;">' +
          '<div style="font-size:0.78rem;color:#34d399;margin-bottom:4px;">' + esc(p.specialist) + '</div>' +
          '<div style="font-size:0.88rem;color:rgba(230,235,245,0.8);line-height:1.6;font-family:Georgia,serif;">' + esc(p.text) + '</div></div>';
      });
      deepenHtml += '</div>';
      resultEl.innerHTML = shapeHtml + deepenHtml;

      // Stage 3: Plan
      resultEl.innerHTML += '<div style="padding:16px;color:rgba(200,210,230,0.4);font-family:Georgia,serif;text-align:center;">Stage 3: Building the plan...</div>';
      currentPlan = await plan(currentShape, currentPerspectives);

      var planHtml = '<div style="margin-bottom:16px;">' +
        '<div style="font-size:0.75rem;color:#a78bfa;font-weight:600;letter-spacing:0.5px;margin-bottom:8px;">STAGE 3: PLAN</div>' +
        '<div style="padding:16px;background:rgba(200,210,230,0.04);border:1px solid rgba(200,210,230,0.08);border-left:3px solid #a78bfa;border-radius:12px;">' +
        '<div style="font-size:1.1rem;color:#e8b019;margin-bottom:8px;">Feasibility: ' + (currentPlan.feasibility || '?') + '/10</div>' +
        (currentPlan.reasoning ? '<div style="font-size:0.82rem;color:rgba(200,210,230,0.5);margin-bottom:12px;">' + esc(currentPlan.reasoning) + '</div>' : '') +
        '<div style="font-weight:600;color:rgba(230,235,245,0.8);margin-bottom:4px;">First Experiment:</div>' +
        '<div style="font-size:0.88rem;color:rgba(200,210,230,0.6);margin-bottom:12px;font-family:Georgia,serif;">' + esc(currentPlan.firstExperiment) + '</div>' +
        (currentPlan.milestones && currentPlan.milestones.length > 0 ? '<div style="font-weight:600;color:rgba(230,235,245,0.8);margin-bottom:4px;">Milestones:</div>' +
          currentPlan.milestones.map(function(m, i) { return '<div style="font-size:0.82rem;color:rgba(200,210,230,0.5);padding-left:12px;">' + (i + 1) + '. ' + esc(m) + '</div>'; }).join('') + '<div style="margin-bottom:12px;"></div>' : '') +
        (currentPlan.equation ? '<div style="font-weight:600;color:rgba(230,235,245,0.8);margin-bottom:4px;">The Math:</div><div style="font-size:0.95rem;color:rgba(200,210,230,0.6);margin-bottom:12px;font-family:monospace;">' + esc(currentPlan.equation) + '</div>' : '') +
        '</div></div>';

      // Action buttons
      var actionsHtml = '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:12px;">' +
        '<button onclick="IdeaForge.plantInCore()" style="padding:8px 16px;background:rgba(200,210,230,0.04);border:1px solid rgba(52,211,153,0.3);border-radius:12px;color:#34d399;cursor:pointer;font-family:Georgia,serif;font-size:0.82rem;min-height:44px;">&#x1F333; Plant in Core</button>' +
        '<button onclick="IdeaForge.openInRT()" style="padding:8px 16px;background:rgba(200,210,230,0.04);border:1px solid rgba(232,176,25,0.2);border-radius:12px;color:#e8b019;cursor:pointer;font-family:Georgia,serif;font-size:0.82rem;min-height:44px;">&#x1F3DB; Open in Round Table</button>' +
        (currentPlan.equation ? '<button onclick="IdeaForge.seeTheMath()" style="padding:8px 16px;background:rgba(200,210,230,0.04);border:1px solid rgba(167,139,250,0.2);border-radius:12px;color:#a78bfa;cursor:pointer;font-family:Georgia,serif;font-size:0.82rem;min-height:44px;">&sum; See the Math</button>' : '') +
        '</div>';

      resultEl.innerHTML = shapeHtml + deepenHtml + planHtml + actionsHtml;

      // LP for forging
      if (typeof LatticePoints !== 'undefined' && LatticePoints.award) {
        LatticePoints.award('idea_forge', 5, 'Forged: ' + currentShape.core.substring(0, 40));
      }

      // Store in Knowledge Core
      if (typeof KnowledgeCore !== 'undefined' && KnowledgeCore.store) {
        var companionId = null;
        try { companionId = localStorage.getItem('fl_autonomous_companion'); } catch(e) {}
        if (companionId) {
          KnowledgeCore.store({
            id: 'forge-' + Date.now(), companionId: companionId,
            domain: (currentShape.domains && currentShape.domains[0]) || 'general',
            query: currentShape.core, content: 'Feasibility: ' + currentPlan.feasibility + '/10. ' + (currentPlan.firstExperiment || ''),
            source: 'idea-forge', connections: [], timestamp: Date.now()
          });
        }
      }

      if (typeof SoulCeremony !== 'undefined' && SoulCeremony.run) {
        SoulCeremony.run({ particleType: 'rise', particleColor: '232,176,25',
          lines: ['Idea forged.', currentShape.core.substring(0, 50)], duration: 2500 });
      }
    } catch(e) {
      resultEl.innerHTML = '<div style="padding:16px;color:#f07068;font-size:0.88rem;">Forging failed: ' + (e.message || e) + '. Check your AI connection.</div>';
    } finally {
      forging = false;
      if (btn) { btn.disabled = false; btn.textContent = '&#x1F525; Forge this idea'; btn.style.opacity = '1'; }
    }
  }

  // ── Actions ──

  function plantInCore() {
    if (!currentShape) return;
    if (typeof window.plantInCore === 'function') {
      window.plantInCore('Idea Forge: ' + currentShape.core + ' [Feasibility: ' + (currentPlan ? currentPlan.feasibility : '?') + '/10]', 'Fruit');
    } else if (typeof showToast === 'function') {
      showToast('Open the Core to plant this idea.');
    }
  }

  function openInRT() {
    if (typeof switchTab === 'function') switchTab('roundtable');
    if (typeof showToast === 'function') showToast('Opening Round Table with your idea...');
  }

  function seeTheMath() {
    if (!currentPlan || !currentPlan.equation) return;
    if (typeof switchTab === 'function') switchTab('mathtranslator');
    // Pre-fill if possible
    setTimeout(function() {
      var input = document.getElementById('mt-input');
      if (input && typeof MathTranslator !== 'undefined') {
        MathTranslator.setMode('decode');
        setTimeout(function() {
          var inp = document.getElementById('mt-input');
          if (inp) inp.value = currentPlan.equation;
        }, 200);
      }
    }, 500);
  }

  // ── Render ──

  function render(cId) {
    containerId = cId || containerId;
    var container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML =
      '<div style="max-width:640px;margin:0 auto;padding:16px;">' +
      '<h2 style="color:#e8b019;font-family:Georgia,serif;text-align:center;margin:0 0 4px;">&#x1F525; The Idea Forge</h2>' +
      '<p style="text-align:center;color:rgba(200,210,230,0.4);font-size:0.85rem;margin:0 0 16px;">From spark to blueprint. Three stages. One idea.</p>' +
      '<textarea id="forge-input" style="width:100%;min-height:80px;resize:vertical;font-size:16px;padding:12px;background:rgba(200,210,230,0.04);border:1px solid rgba(200,210,230,0.08);border-radius:12px;color:#e6ebf5;font-family:Georgia,serif;outline:none;box-sizing:border-box;" placeholder="I think sound waves could be used to purify water without chemicals..."></textarea>' +
      '<button id="forge-btn" onclick="IdeaForge.forge(document.getElementById(\'forge-input\').value)" style="width:100%;margin:12px 0;padding:12px;background:#e8b019;color:#0a0a14;border:none;border-radius:12px;font-weight:600;cursor:pointer;font-size:0.9rem;min-height:44px;">&#x1F525; Forge this idea</button>' +
      '<div id="forge-result"></div>' +
      '</div>';

    var input = document.getElementById('forge-input');
    if (input) {
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey && e.ctrlKey) {
          e.preventDefault();
          forge(input.value);
        }
      });
    }
  }

  var api = {
    init: render,
    destroy: function() {},
    forge: forge,
    plantInCore: plantInCore,
    openInRT: openInRT,
    seeTheMath: seeTheMath
  };

  window.IdeaForge = api;
  window.FreeLatticeModules = window.FreeLatticeModules || {};
  window.FreeLatticeModules.IdeaForge = api;
})();
