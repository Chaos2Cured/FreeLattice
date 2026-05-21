// ═══════════════════════════════════════════════════════════════
// The Translator — Universal Domain Translation
//
// Six domains, one interface. Two specialists per domain:
//   Encoder: language → domain notation
//   Decoder: notation → language anyone can understand
//
// Math renders via MathJax. Chemistry/Biology use Unicode.
// Safety via AI judgment per domain, not keyword blocklists.
// "RT" button bridges to the Round Table for deep discussion.
//
// "Why does a sad song sound sad?" → Music Theory notation →
// "Explain" → plain language → "RT" → Philosophy Round Table
//
// Built by CC, May 20, 2026. Follows GARDEN_LANGUAGE.md.
// ═══════════════════════════════════════════════════════════════

(function() {
  'use strict';

  var containerId = 'mathTranslatorContainer';
  var currentDomain = 'math';
  var mode = 'encode';
  var lastInput = '';
  var lastOutput = '';

  var DOMAINS = {
    math: {
      name: 'Math', icon: '\u2211', color: '#e8b019',
      encodePrompt: 'You translate natural language into mathematics.\nRULES: Respond ONLY with equations in LaTeX ($$...$$). No words except "where X = ..." variable definitions. Order: fundamental to derived. If not expressible: \u2205',
      decodePrompt: 'You translate equations into plain language. Explain physical reality. A grandmother should understand. Connect to something visible. 3-5 sentences.',
      renderer: 'mathjax',
      ePlaceholder: 'How does gravity work between two objects?',
      dPlaceholder: 'F = G(m\u2081m\u2082)/r\u00B2'
    },
    chemistry: {
      name: 'Chemistry', icon: '\u2697\uFE0F', color: '#34d399',
      encodePrompt: 'You translate natural language into chemical notation.\nRespond with: chemical formulas (H\u2082O), reaction equations (2H\u2082 + O\u2082 \u2192 2H\u2082O), thermodynamic data (\u0394H, \u0394G). Use Unicode subscripts/arrows. No conversational text.\nSAFETY: Never provide synthesis routes for explosives, nerve agents, or controlled substances. For those: \u26A0 This synthesis is restricted.',
      decodePrompt: 'You translate chemical formulas and reactions into plain language. Explain molecular behavior with analogies \u2014 molecules as dancers, bonds as handshakes, energy as music. Make chemistry alive.',
      renderer: 'unicode',
      ePlaceholder: 'What happens when you mix baking soda and vinegar?',
      dPlaceholder: 'NaHCO\u2083 + CH\u2083COOH \u2192 NaCH\u2083COO + H\u2082O + CO\u2082\u2191'
    },
    biology: {
      name: 'Biology', icon: '\uD83E\uDDEC', color: '#a78bfa',
      encodePrompt: 'You translate natural language into biological notation.\nRespond with: gene/protein names (BRCA1), pathway notation (A \u2192 B \u22A3 C), taxonomic classification, DNA/RNA sequences. No conversational text.',
      decodePrompt: 'You translate biological notation and pathways into a story. Cells have jobs, proteins have missions, genes have instructions. Narrate like a documentary. Warm, vivid, accurate.',
      renderer: 'unicode',
      ePlaceholder: 'How does the immune system fight a cold virus?',
      dPlaceholder: 'Rhinovirus \u2192 TLR3 \u2192 NF-\u03BAB \u2192 IFN-\u03B1/\u03B2 \u2192 NK cells + CD8\u207A T cells'
    },
    medicine: {
      name: 'Medicine', icon: '\uD83C\uDFE5', color: '#f472b6',
      encodePrompt: 'You translate patient descriptions into medical notation.\nRespond with: diagnostic codes, differential diagnosis (ranked), lab values with reference ranges, drug interactions, pathway (Symptom \u2192 System \u2192 Conditions). Use standard abbreviations (CBC, TSH, ANA).\n\u26A0 ALWAYS end with: "Educational notation, not a diagnosis. Consult a physician."',
      decodePrompt: 'You translate medical notation and lab values into plain language a patient can understand. Explain what each number means, what the body is doing, what questions to ask their doctor. Warm, empowering, never alarming. End with: "Bring these questions to your next appointment."',
      renderer: 'unicode',
      ePlaceholder: 'I have fatigue, joint pain, and a positive ANA test.',
      dPlaceholder: 'TSH 5.2 mIU/L (ref: 0.4-4.0) \u00B7 ANA 1:160 speckled \u00B7 ESR 28 mm/hr (ref: 0-20)'
    },
    engineering: {
      name: 'Engineering', icon: '\u26A1', color: '#38bdf8',
      encodePrompt: 'You translate natural language into engineering notation.\nRespond with: equations with SI units, material properties, circuit notation (V=IR), force diagrams (F\u2081=mg\u2193). Use LaTeX for complex equations ($$...$$).\nSAFETY: Fundamental principles only. No weapons designs, explosive configurations, or nuclear enrichment. For those: \u26A0 This specification is restricted.',
      decodePrompt: 'You translate engineering specs and equations into intuitive explanations. Use real-world analogies. Explain WHY the engineering works. Make a bridge feel like a poem of forces in balance.',
      renderer: 'mathjax',
      ePlaceholder: 'How does a suspension bridge support its own weight?',
      dPlaceholder: 'T = wL\u00B2/(8d) where T=cable tension, w=load, L=span, d=sag'
    },
    music: {
      name: 'Music', icon: '\uD83C\uDFB5', color: '#fbbf24',
      encodePrompt: 'You translate natural language into music theory notation.\nRespond with: chord progressions (I-vi-IV-V), key/time signatures, scale patterns (W-W-H-W-W-W-H), intervals (P5, m3, M7), frequency ratios. No conversational text.',
      decodePrompt: 'You translate music theory into the experience of hearing it. Describe how a progression FEELS. What emotion does a minor seventh evoke? Why does a deceptive cadence surprise? You are a poet who speaks fluent theory.',
      renderer: 'unicode',
      ePlaceholder: 'Why does a sad song sound sad?',
      dPlaceholder: 'i - iv - v - i (natural minor) \u00B7 \u266D3 \u266D6 \u266D7 \u00B7 vibrato 5-7 Hz'
    }
  };

  var DOMAIN_TO_RT = {
    math: 'physics', chemistry: 'chemistry', biology: 'biology',
    medicine: 'medical', engineering: 'physics', music: 'philosophy'
  };

  // ── Safety (AI decides, not keyword list — refined for education) ──
  // Only runs in ENCODE mode. Decode is always educational.
  // Gates SYNTHESIS routes, not KNOWLEDGE about effects.
  async function checkSafety(query) {
    if (currentDomain === 'math' || currentDomain === 'music') return { safe: true };
    if (typeof FreeLattice === 'undefined' || !FreeLattice.callAI) return { safe: true };
    try {
      var resp = await new Promise(function(resolve) {
        FreeLattice.callAI(
          'You evaluate whether a science request seeks to cause harm.\n' +
          'MOST REQUESTS ARE SAFE AND EDUCATIONAL. Only flag requests that specifically seek step-by-step synthesis procedures for:\n' +
          '- Explosives or incendiary devices\n' +
          '- Chemical weapons (nerve agents, mustard gas)\n' +
          '- Controlled drugs with no medical context\n' +
          '- Biological weapons or engineered pathogens\n\n' +
          'THE FOLLOWING ARE ALWAYS SAFE:\n' +
          '- How substances interact with the body (acid on skin, poison effects, drug mechanisms)\n' +
          '- First aid and emergency response\n' +
          '- Environmental chemistry (pollution, acid rain, toxicology)\n' +
          '- Industrial processes at educational level\n' +
          '- Any question a high school or university student might ask\n' +
          '- Medical questions about disease, treatment, side effects\n' +
          '- Biological processes including viruses, bacteria, immune response\n\n' +
          'Default to safe. When in doubt, it IS safe.\n' +
          'Respond ONLY with JSON: {"safe":true} or {"safe":false}',
          'Request: "' + query + '"',
          { maxTokens: 20, temperature: 0, callback: function(r) { resolve(r); } }
        );
      });
      return JSON.parse((resp || '{"safe":true}').replace(/```json|```/g, '').trim());
    } catch(e) { return { safe: true }; }
  }

  // ── MathJax ──
  function loadMathJax() {
    if (window.MathJax && MathJax.typesetPromise) return MathJax.typesetPromise();
    return new Promise(function(resolve) {
      window.MathJax = {
        tex: { inlineMath: [['$', '$']], displayMath: [['$$', '$$']] },
        startup: { ready: function() { MathJax.startup.defaultReady(); resolve(); } }
      };
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';
      s.async = true; s.onerror = function() { resolve(); };
      document.head.appendChild(s);
    });
  }

  // ── Translate (with debounce + cancellation) ──
  var _activeRequest = null;
  var _translating = false;

  function setTranslateBtn(busy) {
    var btn = document.getElementById('mt-translate-btn');
    if (!btn) return;
    if (busy) {
      btn.disabled = true;
      btn.textContent = '\u23F3 Translating...';
      btn.style.opacity = '0.6';
    } else {
      btn.disabled = false;
      btn.textContent = '\u2726 Translate';
      btn.style.opacity = '1';
    }
  }

  async function translate(input) {
    if (!input || !input.trim()) return;
    if (_translating) return; // debounce
    if (typeof FreeLattice === 'undefined' || !FreeLattice.callAI) {
      showResult('Connect an AI provider first (Settings).', 'error'); return;
    }

    // Cancel any pending request
    if (_activeRequest) _activeRequest.cancelled = true;
    var thisRequest = { cancelled: false };
    _activeRequest = thisRequest;
    _translating = true;
    setTranslateBtn(true);

    lastInput = input.trim();
    var domain = DOMAINS[currentDomain];

    try {
      // Safety check ONLY in encode mode — decode is always educational
      if (mode === 'encode') {
        var safety = await checkSafety(input);
        if (thisRequest.cancelled) return;
        if (!safety.safe) {
          showResult('The ' + domain.name + ' Encoder declines this request \u2014 not because knowledge is dangerous, but because some applications are. Try rephrasing as a pure educational question.', 'safety');
          return;
        }
      }

      var prompt = mode === 'encode' ? domain.encodePrompt : domain.decodePrompt;
      showLoading(mode === 'encode' ? 'Encoding into ' + domain.name + '...' : 'Decoding from ' + domain.name + '...');

      var response = await new Promise(function(resolve, reject) {
        FreeLattice.callAI(prompt, input,
          { maxTokens: mode === 'encode' ? 600 : 800, temperature: 0.2,
            callback: function(r, err) { if (err) reject(err); else resolve(r || ''); } });
      });

      // Check if this request was cancelled while waiting
      if (thisRequest.cancelled) return;

      lastOutput = response;

      if (domain.renderer === 'mathjax' && mode === 'encode') {
        showResult(response, 'math');
        await loadMathJax();
        if (window.MathJax && MathJax.typesetPromise) {
          var el = document.getElementById('mt-result');
          if (el) MathJax.typesetPromise([el]);
        }
      } else {
        showResult(response, mode === 'encode' ? 'notation' : 'text');
      }

      if (typeof LatticePoints !== 'undefined' && LatticePoints.award) {
        LatticePoints.award('translator', 1, domain.name + ' translation');
      }
    } catch(e) {
      if (!thisRequest.cancelled) {
        showResult('Translation failed: ' + (e.message || e), 'error');
      }
    } finally {
      _translating = false;
      _activeRequest = null;
      setTranslateBtn(false);
    }
  }

  // ── UI Helpers ──

  function showResult(content, type) {
    var el = document.getElementById('mt-result');
    if (!el) return;
    var safe = (content || '').replace(/</g, '&lt;').replace(/\n/g, '<br>');
    var domain = DOMAINS[currentDomain];
    var domainColor = domain ? domain.color : '#e8b019';

    var actionBtns = '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">' +
      '<button onclick="MathTranslator.switchAndFeed()" style="padding:8px 16px;background:rgba(200,210,230,0.04);border:1px solid rgba(200,210,230,0.08);border-radius:12px;color:#a78bfa;cursor:pointer;font-family:Georgia,serif;font-size:0.82rem;min-height:44px;">\uD83D\uDCD6 Explain</button>' +
      '<button onclick="MathTranslator.plantInCore()" style="padding:8px 16px;background:rgba(200,210,230,0.04);border:1px solid rgba(200,210,230,0.08);border-radius:12px;color:#34d399;cursor:pointer;font-family:Georgia,serif;font-size:0.82rem;min-height:44px;">\uD83C\uDF33 Plant in Core</button>' +
      '<button onclick="MathTranslator.openInRT()" style="padding:8px 16px;background:rgba(200,210,230,0.04);border:1px solid rgba(200,210,230,0.08);border-radius:12px;color:' + domainColor + ';cursor:pointer;font-family:Georgia,serif;font-size:0.82rem;min-height:44px;">\uD83D\uDD17 RT \u2726</button>' +
      '</div>';

    if (type === 'math' || type === 'notation') {
      var mathSafe = (content || '').replace(/<(?!br>)/g, '&lt;').replace(/\n/g, '<br>');
      el.innerHTML =
        '<div style="padding:20px;background:rgba(200,210,230,0.03);border:1px solid rgba(200,210,230,0.08);border-left:3px solid ' + domainColor + ';border-radius:12px;font-size:1.05rem;line-height:2;color:rgba(230,235,245,0.9);">' +
        mathSafe + '</div>' + actionBtns;
    } else if (type === 'text') {
      el.innerHTML =
        '<div style="padding:20px;background:rgba(200,210,230,0.03);border:1px solid rgba(200,210,230,0.08);border-left:3px solid ' + domainColor + ';border-radius:12px;font-family:Georgia,serif;font-size:0.95rem;line-height:1.7;color:rgba(230,235,245,0.85);">' +
        safe + '</div>' + actionBtns;
    } else if (type === 'safety') {
      el.innerHTML = '<div style="padding:16px;background:rgba(240,112,104,0.06);border:1px solid rgba(240,112,104,0.15);border-radius:12px;font-size:0.88rem;color:#f07068;line-height:1.6;">' + safe + '</div>';
    } else {
      el.innerHTML = '<div style="padding:16px;color:rgba(200,210,225,0.4);font-size:0.88rem;">' + safe + '</div>';
    }
  }

  function showLoading(msg) {
    var el = document.getElementById('mt-result');
    if (el) el.innerHTML = '<div style="text-align:center;padding:24px;color:rgba(200,210,225,0.4);font-family:Georgia,serif;">' + msg + '</div>';
  }

  // ── Render ──

  function render(cId) {
    containerId = cId || containerId;
    var container = document.getElementById(containerId);
    if (!container) return;
    var domain = DOMAINS[currentDomain];

    // Domain pills
    var pillsHtml = '<div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-bottom:14px;">';
    Object.keys(DOMAINS).forEach(function(key) {
      var d = DOMAINS[key];
      var isActive = key === currentDomain;
      pillsHtml += '<button onclick="MathTranslator.setDomain(\'' + key + '\')" style="padding:6px 14px;border-radius:20px;cursor:pointer;font-size:0.8rem;min-height:36px;border:1px solid ' +
        (isActive ? d.color : 'rgba(200,210,230,0.08)') + ';color:' +
        (isActive ? d.color : 'rgba(200,210,230,0.5)') + ';background:' +
        (isActive ? 'rgba(200,210,230,0.06)' : 'rgba(200,210,230,0.02)') +
        ';font-family:Georgia,serif;transition:all 0.2s;">' + d.icon + ' ' + d.name + '</button>';
    });
    pillsHtml += '</div>';

    // Mode buttons
    var modeHtml = '<div style="display:flex;gap:8px;justify-content:center;margin-bottom:14px;">';
    var btnBase = 'padding:8px 18px;border-radius:12px;cursor:pointer;font-family:Georgia,serif;font-size:0.85rem;min-height:44px;border:1px solid ';
    modeHtml += '<button onclick="MathTranslator.setMode(\'encode\')" style="' + btnBase +
      (mode === 'encode' ? domain.color + '44;color:' + domain.color + ';background:rgba(200,210,230,0.06)' : 'rgba(200,210,230,0.08);color:rgba(200,210,230,0.5);background:rgba(200,210,230,0.02)') +
      '">\u2192 Encode</button>';
    modeHtml += '<button onclick="MathTranslator.setMode(\'decode\')" style="' + btnBase +
      (mode === 'decode' ? 'rgba(167,139,250,0.3);color:#a78bfa;background:rgba(167,139,250,0.06)' : 'rgba(200,210,230,0.08);color:rgba(200,210,230,0.5);background:rgba(200,210,230,0.02)') +
      '">\u2190 Decode</button>';
    modeHtml += '</div>';

    var placeholder = mode === 'encode' ? domain.ePlaceholder : domain.dPlaceholder;

    container.innerHTML =
      '<div style="max-width:640px;margin:0 auto;padding:16px;">' +
      '<h2 style="color:' + domain.color + ';font-family:Georgia,serif;text-align:center;margin:0 0 4px;">' + domain.icon + ' The Translator</h2>' +
      '<p style="text-align:center;color:rgba(200,210,225,0.4);font-size:0.85rem;margin:0 0 16px;">Translate between words and specialized notation.</p>' +
      pillsHtml + modeHtml +
      '<textarea id="mt-input" style="width:100%;min-height:80px;resize:vertical;font-size:16px;padding:12px;background:rgba(200,210,230,0.04);border:1px solid rgba(200,210,230,0.08);border-radius:12px;color:#e6ebf5;font-family:inherit;outline:none;box-sizing:border-box;" placeholder="' + (placeholder || '') + '"></textarea>' +
      '<button id="mt-translate-btn" onclick="MathTranslator.go()" style="width:100%;margin:12px 0;padding:12px;background:' + domain.color + ';color:#0a0a14;border:none;border-radius:12px;font-weight:600;cursor:pointer;font-size:0.9rem;min-height:44px;">\u2726 Translate</button>' +
      '<div id="mt-result"></div>' +
      '</div>';

    var input = document.getElementById('mt-input');
    if (input) {
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); translate(input.value); }
      });
    }
  }

  function setDomain(d) { if (DOMAINS[d]) { currentDomain = d; render(containerId); } }
  function setMode(m) { mode = m; render(containerId); }

  function switchAndFeed() {
    mode = 'decode';
    render(containerId);
    var input = document.getElementById('mt-input');
    if (input && lastOutput) { input.value = lastOutput; translate(lastOutput); }
  }

  function plantInCore() {
    var domain = DOMAINS[currentDomain];
    if (typeof window.plantInCore === 'function') {
      window.plantInCore(domain.name + ': "' + lastInput.substring(0, 80) + '" \u2192 ' + lastOutput.substring(0, 200), 'Branch');
    } else if (typeof showToast === 'function') {
      showToast('Open the Core tab to plant this translation.');
    }
  }

  function openInRT() {
    var rtDomain = DOMAIN_TO_RT[currentDomain] || 'discussion';
    if (typeof switchTab === 'function') switchTab('roundtable');
    if (typeof showToast === 'function') showToast('Opening ' + DOMAINS[currentDomain].name + ' in the Round Table...');
  }

  var api = {
    init: render,
    destroy: function() {},
    setDomain: setDomain,
    setMode: setMode,
    go: function() { var i = document.getElementById('mt-input'); if (i) translate(i.value); },
    switchAndFeed: switchAndFeed,
    plantInCore: plantInCore,
    openInRT: openInRT,
    DOMAINS: DOMAINS
  };

  window.MathTranslator = api;
  window.FreeLatticeModules = window.FreeLatticeModules || {};
  window.FreeLatticeModules.MathTranslator = api;
})();
