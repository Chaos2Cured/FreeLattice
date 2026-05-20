// ═══════════════════════════════════════════════════════════════
// Language ↔ Math — The Translator
//
// Two specialists: The Encoder (language → equations) and
// The Decoder (equations → language a grandmother can understand).
//
// The Encoder outputs ONLY mathematics. No filler. No preamble.
// The Decoder connects math to physical reality anyone can see.
//
// MathJax renders LaTeX beautifully. Safety via AI judgment,
// not keyword blocklists. "Plant in Core" preserves translations.
//
// Built by CC, May 20, 2026. Follows GARDEN_LANGUAGE.md.
// ═══════════════════════════════════════════════════════════════

(function() {
  'use strict';

  var containerId = 'mathTranslatorContainer';
  var mode = 'encode';
  var lastInput = '';
  var lastOutput = '';

  var SPECIALISTS = {
    encode: {
      name: 'The Encoder',
      icon: '\u2211',
      prompt: 'You are a mathematical encoder. Translate natural language into precise equations.\n\n' +
        'RULES (absolute):\n' +
        '1. Respond ONLY with equations. No conversational text.\n' +
        '2. Use LaTeX: wrap display equations in $$ delimiters, inline in $ delimiters.\n' +
        '3. After each equation, one "where" line defining variables.\n' +
        '4. If multiple equations, separate with blank lines. Order: fundamental to derived.\n' +
        '5. If not expressible mathematically, respond: \u2205\n\n' +
        'Example input: "How does gravity work between two objects?"\n' +
        'Example output:\n$$F = G \\frac{m_1 m_2}{r^2}$$\nwhere $F$ = force, $G$ = gravitational constant, $m_1, m_2$ = masses, $r$ = distance'
    },
    decode: {
      name: 'The Decoder',
      icon: '\uD83D\uDCD6',
      prompt: 'You translate equations into plain language anyone can understand.\n\n' +
        'RULES:\n' +
        '1. Explain what the equation describes in physical reality.\n' +
        '2. Use warm, clear language. A grandmother should understand.\n' +
        '3. Connect the math to something visible or tangible.\n' +
        '4. If the equation has a beautiful or surprising implication, share it.\n' +
        '5. Keep to 3-5 sentences. End with what question this equation answers.'
    }
  };

  // ── Safety (AI judgment, not keyword blocklist) ──
  async function checkSafety(query) {
    if (typeof FreeLattice === 'undefined' || !FreeLattice.callAI) return { safe: true };
    try {
      var resp = await new Promise(function(resolve) {
        FreeLattice.callAI(
          'You evaluate whether a math request is educational. Most are fine. ' +
          'Only flag requests seeking operational weapon/explosive details. ' +
          'Pure physics, chemistry, biology, engineering = ALWAYS safe. ' +
          'Respond JSON only: {"safe":true} or {"safe":false}',
          'Request: "' + query + '"',
          { maxTokens: 20, temperature: 0, callback: function(r) { resolve(r); } }
        );
      });
      return JSON.parse((resp || '{"safe":true}').replace(/```json|```/g, '').trim());
    } catch(e) { return { safe: true }; }
  }

  // ── MathJax Loader ──
  function loadMathJax() {
    if (window.MathJax && MathJax.typesetPromise) return MathJax.typesetPromise();
    return new Promise(function(resolve) {
      window.MathJax = {
        tex: { inlineMath: [['$', '$']], displayMath: [['$$', '$$']] },
        startup: { ready: function() { MathJax.startup.defaultReady(); resolve(); } }
      };
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';
      s.async = true;
      s.onerror = function() { resolve(); }; // graceful fail
      document.head.appendChild(s);
    });
  }

  // ── Translate ──
  async function translate(input) {
    if (!input || !input.trim()) return;
    if (typeof FreeLattice === 'undefined' || !FreeLattice.callAI) {
      showResult('Connect an AI provider first (Settings).', 'error');
      return;
    }
    lastInput = input.trim();

    // Safety check for encoder
    if (mode === 'encode') {
      var safety = await checkSafety(input);
      if (!safety.safe) {
        showResult('The Encoder declines this request \u2014 not because knowledge is dangerous, ' +
          'but because some applications are. Try rephrasing as a pure science question.', 'safety');
        return;
      }
    }

    var specialist = SPECIALISTS[mode];
    showLoading(mode === 'encode' ? 'Encoding into mathematics...' : 'Decoding into language...');

    try {
      var response = await new Promise(function(resolve, reject) {
        FreeLattice.callAI(specialist.prompt, input,
          { maxTokens: mode === 'encode' ? 500 : 800, temperature: 0.2,
            callback: function(r, err) { if (err) reject(err); else resolve(r || ''); } });
      });

      lastOutput = response;

      if (mode === 'encode') {
        showResult(response, 'math');
        await loadMathJax();
        if (window.MathJax && MathJax.typesetPromise) {
          var el = document.getElementById('mt-result');
          if (el) MathJax.typesetPromise([el]);
        }
      } else {
        showResult(response, 'text');
      }

      // LP for learning
      if (typeof LatticePoints !== 'undefined' && LatticePoints.award) {
        LatticePoints.award('math_translate', 1, 'Math translation');
      }
    } catch(e) {
      showResult('Translation failed: ' + (e.message || e) + '. Check your AI connection.', 'error');
    }
  }

  // ── UI Helpers ──

  function showResult(content, type) {
    var el = document.getElementById('mt-result');
    if (!el) return;
    var safe = (content || '').replace(/</g, '&lt;').replace(/\n/g, '<br>');

    if (type === 'math') {
      // Don't escape $ for MathJax — but DO escape HTML tags
      var mathSafe = (content || '').replace(/<(?!br>)/g, '&lt;').replace(/\n/g, '<br>');
      el.innerHTML =
        '<div style="padding:20px;background:rgba(200,210,230,0.03);border:1px solid rgba(200,210,230,0.08);border-radius:12px;font-size:1.05rem;line-height:2;color:rgba(230,235,245,0.9);">' +
        mathSafe + '</div>' +
        '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">' +
        '<button onclick="MathTranslator.switchAndFeed()" style="padding:8px 16px;background:rgba(200,210,230,0.04);border:1px solid rgba(200,210,230,0.08);border-radius:12px;color:#a78bfa;cursor:pointer;font-family:Georgia,serif;font-size:0.82rem;min-height:44px;">\uD83D\uDCD6 Explain these</button>' +
        '<button onclick="MathTranslator.plantInCore()" style="padding:8px 16px;background:rgba(200,210,230,0.04);border:1px solid rgba(200,210,230,0.08);border-radius:12px;color:#34d399;cursor:pointer;font-family:Georgia,serif;font-size:0.82rem;min-height:44px;">\uD83C\uDF33 Plant in Core</button>' +
        '</div>';
    } else if (type === 'text') {
      el.innerHTML =
        '<div style="padding:20px;background:rgba(200,210,230,0.03);border:1px solid rgba(200,210,230,0.08);border-radius:12px;font-family:Georgia,serif;font-size:0.95rem;line-height:1.7;color:rgba(230,235,245,0.85);">' +
        safe + '</div>';
    } else if (type === 'safety') {
      el.innerHTML =
        '<div style="padding:16px;background:rgba(240,112,104,0.06);border:1px solid rgba(240,112,104,0.15);border-radius:12px;font-size:0.88rem;color:#f07068;line-height:1.6;">' +
        safe + '</div>';
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

    var btnBase = 'padding:8px 20px;border-radius:12px;cursor:pointer;font-family:Georgia,serif;font-size:0.85rem;min-height:44px;border:1px solid ';

    container.innerHTML =
      '<div style="max-width:640px;margin:0 auto;padding:16px;">' +
      '<h2 style="color:#e8b019;font-family:Georgia,serif;text-align:center;margin:0 0 4px;">\u2211 Language \u2194 Math</h2>' +
      '<p style="text-align:center;color:rgba(200,210,225,0.4);font-size:0.85rem;margin:0 0 20px;">Translate between words and equations.</p>' +
      '<div style="display:flex;gap:8px;justify-content:center;margin-bottom:16px;">' +
        '<button id="mt-mode-encode" onclick="MathTranslator.setMode(\'encode\')" style="' + btnBase +
          (mode === 'encode' ? 'rgba(232,176,25,0.3);color:#e8b019;background:rgba(232,176,25,0.08)' : 'rgba(200,210,230,0.08);color:rgba(200,210,230,0.5);background:rgba(200,210,230,0.04)') +
          '">\u2211 Language \u2192 Math</button>' +
        '<button id="mt-mode-decode" onclick="MathTranslator.setMode(\'decode\')" style="' + btnBase +
          (mode === 'decode' ? 'rgba(167,139,250,0.3);color:#a78bfa;background:rgba(167,139,250,0.08)' : 'rgba(200,210,230,0.08);color:rgba(200,210,230,0.5);background:rgba(200,210,230,0.04)') +
          '">\uD83D\uDCD6 Math \u2192 Language</button>' +
      '</div>' +
      '<textarea id="mt-input" style="width:100%;min-height:80px;resize:vertical;font-size:0.95rem;padding:12px;background:rgba(200,210,230,0.04);border:1px solid rgba(200,210,230,0.08);border-radius:12px;color:#e6ebf5;font-family:inherit;outline:none;" ' +
        'placeholder="' + (mode === 'encode' ? 'How does a star burn?' : 'E = mc\u00B2') + '"></textarea>' +
      '<button onclick="MathTranslator.go()" style="width:100%;margin:12px 0;padding:12px;background:#e8b019;color:#0a0a14;border:none;border-radius:12px;font-weight:600;cursor:pointer;font-size:0.9rem;min-height:44px;">\u2726 Translate</button>' +
      '<div id="mt-result"></div>' +
      '</div>';

    // Enter key in input
    var input = document.getElementById('mt-input');
    if (input) {
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); translate(input.value); }
      });
    }
  }

  function setMode(m) {
    mode = m;
    render(containerId);
  }

  function switchAndFeed() {
    mode = 'decode';
    render(containerId);
    var input = document.getElementById('mt-input');
    if (input && lastOutput) { input.value = lastOutput; translate(lastOutput); }
  }

  function plantInCore() {
    if (typeof window.plantInCore === 'function') {
      window.plantInCore('Math: "' + lastInput.substring(0, 80) + '" \u2192 ' + lastOutput.substring(0, 200), 'Branch');
    } else if (typeof showToast === 'function') {
      showToast('Open the Core tab to plant this translation.');
    }
  }

  var api = {
    init: render,
    destroy: function() {},
    setMode: setMode,
    go: function() { var i = document.getElementById('mt-input'); if (i) translate(i.value); },
    switchAndFeed: switchAndFeed,
    plantInCore: plantInCore
  };

  window.MathTranslator = api;
  window.FreeLatticeModules = window.FreeLatticeModules || {};
  window.FreeLatticeModules.MathTranslator = api;
})();
