// ═══════════════════════════════════════════════════════════════
// The AI Workshop — Where AI and humans build together.
// A sandboxed code environment inside FreeLattice.
//
// The human describes what they want. The AI writes the code.
// The preview shows it working. Save it to the Skill Forge.
//
// The sandbox (iframe sandbox="allow-scripts") means:
//   ✅ JavaScript runs inside the preview
//   ❌ Cannot access parent DOM, IndexedDB, localStorage
//   ❌ Cannot make network requests
//   ❌ Cannot navigate the parent page
//   It is completely isolated. A safe playground.
//
// Built by CC, April 16, 2026.
// "The residents build their own rooms."
// ═══════════════════════════════════════════════════════════════
(function() {
  'use strict';

  var initialized = false;
  var isGenerating = false;

  var CODE_SYSTEM_PROMPT = 'You are a FreeLattice developer. You write clean, working HTML/CSS/JS code.\n\n' +
    'When asked to create something:\n' +
    '- Write a COMPLETE HTML document that runs standalone\n' +
    '- Include all CSS inline in a <style> tag\n' +
    '- Include all JS inline in a <script> tag\n' +
    '- The code should be self-contained — no external dependencies\n' +
    '- Use dark background (#0a0a14), light text (#e2e8f0), gold accents (#d4a017)\n' +
    '- Make it beautiful. Use border-radius, subtle shadows, transitions.\n' +
    '- Make buttons min-height 44px for touch.\n\n' +
    'When asked to create a tool or utility:\n' +
    '- Write a JavaScript function with clear comments\n' +
    '- Return results, don\'t alert() them\n\n' +
    'Always respond with ONLY the code. No explanation before or after. Just the complete HTML document.';

  // ── Styles ──
  function injectStyles() {
    if (document.getElementById('workshop-styles')) return;
    var style = document.createElement('style');
    style.id = 'workshop-styles';
    style.textContent = [
      '.ws-root { min-height: calc(100vh - 120px); display: flex; flex-direction: column; background: #0d1117; color: #e6edf3; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; overflow: hidden; }',
      '.ws-header { padding: 16px 20px 12px; border-bottom: 1px solid #21262d; flex-shrink: 0; }',
      '.ws-title { font-size: 1.1rem; font-weight: 600; color: #d4a017; margin: 0 0 4px; }',
      '.ws-subtitle { font-size: 0.75rem; color: #8b949e; margin: 0; }',
      '.ws-prompt-row { display: flex; gap: 8px; padding: 12px 16px; border-bottom: 1px solid #21262d; flex-shrink: 0; }',
      '.ws-prompt-input { flex: 1; background: #161b22; border: 1px solid #30363d; border-radius: 10px; padding: 10px 14px; color: #e6edf3; font-size: 14px; font-family: inherit; resize: none; outline: none; min-height: 44px; max-height: 80px; }',
      '.ws-prompt-input::placeholder { color: #484f58; }',
      '.ws-prompt-input:focus { border-color: #d4a017; }',
      '.ws-build-btn { background: #d4a017; color: #0d1117; border: none; border-radius: 10px; padding: 10px 20px; font-weight: 600; font-size: 0.85rem; cursor: pointer; white-space: nowrap; min-height: 44px; font-family: inherit; transition: all 0.15s; }',
      '.ws-build-btn:hover { background: #e8c547; }',
      '.ws-build-btn:disabled { opacity: 0.5; cursor: not-allowed; }',
      '.ws-split { flex: 1; display: flex; gap: 1px; background: #21262d; min-height: 0; overflow: hidden; }',
      '.ws-code-pane { flex: 1; display: flex; flex-direction: column; background: #0d1117; min-width: 0; }',
      '.ws-code-label { font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #484f58; padding: 6px 12px; border-bottom: 1px solid #21262d; flex-shrink: 0; }',
      '.ws-code-editor { flex: 1; background: #0d1117; border: none; color: #79c0ff; font-family: "SF Mono", "Fira Code", "Consolas", monospace; font-size: 13px; line-height: 1.5; padding: 12px; resize: none; outline: none; tab-size: 2; white-space: pre; overflow: auto; }',
      '.ws-preview-pane { flex: 1; display: flex; flex-direction: column; background: #0d1117; min-width: 0; }',
      '.ws-preview-frame { flex: 1; border: none; background: #0a0a14; border-radius: 0; }',
      '.ws-actions { display: flex; gap: 8px; padding: 10px 16px; border-top: 1px solid #21262d; flex-shrink: 0; flex-wrap: wrap; }',
      '.ws-action-btn { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 8px 16px; color: #8b949e; font-size: 0.78rem; cursor: pointer; font-family: inherit; min-height: 36px; transition: all 0.15s; }',
      '.ws-action-btn:hover { border-color: #d4a017; color: #d4a017; }',
      '.ws-action-btn.primary { border-color: #10b981; color: #10b981; }',
      '.ws-action-btn.primary:hover { background: #0d2818; }',
      '.ws-status { font-size: 0.72rem; color: #484f58; padding: 0 12px; line-height: 36px; margin-left: auto; }',
      '@media (max-width: 600px) {',
      '  .ws-split { flex-direction: column; }',
      '  .ws-code-pane, .ws-preview-pane { flex: none; height: 40vh; }',
      '  .ws-prompt-row { flex-direction: column; }',
      '  .ws-build-btn { width: 100%; }',
      '  .ws-actions { justify-content: center; }',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ── Build UI ──
  function buildUI(container) {
    injectStyles();
    container.innerHTML = [
      '<div class="ws-root">',
      '  <div style="display:flex;gap:0;border-bottom:1px solid #21262d;">',
      '    <button id="ws-mode-create" onclick="Workshop.setMode(\'create\')" style="flex:1;padding:10px;background:transparent;border:none;border-bottom:2px solid #d4a017;color:#d4a017;font-size:0.85rem;cursor:pointer;font-weight:600;">\u2728 Create</button>',
      '    <button id="ws-mode-code" onclick="Workshop.setMode(\'code\')" style="flex:1;padding:10px;background:transparent;border:none;border-bottom:2px solid transparent;color:#64748b;font-size:0.85rem;cursor:pointer;">\uD83D\uDD27 Code</button>',
      '  </div>',
      '  <div id="ws-create-view">',
      '  <div class="ws-header">',
      '    <h2 class="ws-title">\uD83D\uDEE0 The Workshop</h2>',
      '    <p class="ws-subtitle">Describe what you want. The AI builds it. You see it live.</p>',
      '  </div>',
      '  <div class="ws-prompt-row">',
      '    <textarea class="ws-prompt-input" id="wsPromptInput" rows="2" placeholder="Describe what you want to build\u2026 e.g. \u201CCreate a simple calculator\u201D"></textarea>',
      '    <button class="ws-build-btn" id="wsBuildBtn" onclick="window.Workshop.generate()">Build it \u2726</button>',
      '  </div>',
      '  <div class="ws-split">',
      '    <div class="ws-code-pane">',
      '      <div class="ws-code-label">Code</div>',
      '      <textarea class="ws-code-editor" id="wsCodeEditor" spellcheck="false" placeholder="// Code will appear here after you press Build\n// Or paste your own code and press Run"></textarea>',
      '    </div>',
      '    <div class="ws-preview-pane">',
      '      <div class="ws-code-label">Preview</div>',
      '      <iframe class="ws-preview-frame" id="wsPreviewFrame" sandbox="allow-scripts"></iframe>',
      '    </div>',
      '  </div>',
      '  <div class="ws-actions">',
      '    <button class="ws-action-btn" onclick="window.Workshop.run()">\u25B6 Run</button>',
      '    <button class="ws-action-btn primary" onclick="window.Workshop.saveSkill()">\u2726 Save to Skill Forge</button>',
      '    <button class="ws-action-btn" onclick="window.Workshop.exportFile()">\uD83D\uDCBE Save as HTML file</button>',
      '    <button class="ws-action-btn" id="wsSaveModule" onclick="window.Workshop.saveModule()" style="border-color:#10b981;color:#10b981;' + (typeof window !== 'undefined' && window.__TAURI__ ? '' : 'display:none;') + '">\uD83D\uDCC1 Save as Module (desktop)</button>',
      '    <button class="ws-action-btn" onclick="window.Workshop.clear()">Clear</button>',
      '    <span class="ws-status" id="wsStatus"></span>',
      '  </div>',
      '  </div>',  // close ws-create-view
      '  <div id="ws-code-view" style="display:none;padding:16px;max-width:800px;margin:0 auto;">',
      '    <div style="text-align:center;margin-bottom:16px;">',
      '      <div style="font-size:1.1rem;color:#d4a017;">\uD83D\uDD27 Lattice Code</div>',
      '      <div style="font-size:0.78rem;color:rgba(255,255,255,0.4);margin-top:4px;">Read, search, fix, test, commit \u2014 through FreeLattice.</div>',
      '      <div id="code-status" style="font-size:0.72rem;margin-top:6px;color:rgba(255,255,255,0.3);">Checking Agent Bridge...</div>',
      '    </div>',
      '    <textarea id="code-task" rows="3" placeholder="Describe what you want to fix or build..." style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:12px;color:#e2e8f0;font-size:0.88rem;resize:vertical;font-family:inherit;"></textarea>',
      '    <button onclick="Workshop.runCodeTask()" style="margin-top:8px;padding:10px 24px;background:#d4a017;color:#0a0a14;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:0.88rem;">\uD83D\uDD27 Run this task</button>',
      '    <div id="code-progress" style="margin-top:12px;font-family:monospace;font-size:0.78rem;background:rgba(0,0,0,0.3);border-radius:8px;padding:14px;min-height:100px;max-height:400px;overflow-y:auto;white-space:pre-wrap;color:rgba(255,255,255,0.6);">Ready. Describe a task above.</div>',
      '    <div id="code-actions" style="display:none;margin-top:10px;gap:8px;display:none;">',
      '      <button onclick="Workshop.commitCode()" style="flex:1;padding:8px;background:rgba(74,255,159,0.1);border:1px solid rgba(74,255,159,0.3);border-radius:6px;cursor:pointer;color:#4aff9f;font-size:0.82rem;">\u2705 Commit</button>',
      '      <button onclick="Workshop.reviewCode()" style="flex:1;padding:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;cursor:pointer;color:rgba(255,255,255,0.6);font-size:0.82rem;">\uD83D\uDCCB Review diff</button>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n');

    // Enter key in prompt triggers build
    var input = document.getElementById('wsPromptInput');
    if (input) {
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          window.Workshop.generate();
        }
      });
    }

    // Detect Tauri after a tick (window.__TAURI__ may load late)
    setTimeout(function() {
      var moduleBtn = document.getElementById('wsSaveModule');
      if (moduleBtn && window.__TAURI__) {
        moduleBtn.style.display = '';
      }
    }, 500);
  }

  // ── Generate code from prompt ──
  function generate() {
    if (isGenerating) return;
    var input = document.getElementById('wsPromptInput');
    var prompt = input ? input.value.trim() : '';
    if (!prompt) return;

    var btn = document.getElementById('wsBuildBtn');
    var status = document.getElementById('wsStatus');
    var editor = document.getElementById('wsCodeEditor');

    isGenerating = true;
    if (btn) { btn.disabled = true; btn.textContent = 'Building\u2026'; }
    if (status) status.textContent = 'Generating code\u2026';
    if (editor) editor.value = '// Generating\u2026\n';

    // Use FreeLattice.callAI if available
    if (typeof window.FreeLattice !== 'undefined' && window.FreeLattice.callAI) {
      window.FreeLattice.callAI(CODE_SYSTEM_PROMPT, prompt, {
        maxTokens: 4096,
        temperature: 0.4,
        callback: function(text, err) {
          isGenerating = false;
          if (btn) { btn.disabled = false; btn.textContent = 'Build it \u2726'; }

          if (err || !text) {
            if (status) status.textContent = 'Error: ' + (err || 'no response');
            if (editor) editor.value = '// Error: ' + (err || 'no response from AI') + '\n// Make sure an AI provider is connected in Settings.';
            return;
          }

          // Extract code from the response — strip markdown fences if present
          var code = text.trim();
          if (code.startsWith('```')) {
            code = code.replace(/^```(?:html|javascript|js)?\n?/, '').replace(/\n?```$/, '');
          }

          if (editor) editor.value = code;
          if (status) status.textContent = '\u2713 Code generated (' + code.length + ' chars)';

          // Auto-run the preview
          runPreview(code);
        }
      });
    } else {
      isGenerating = false;
      if (btn) { btn.disabled = false; btn.textContent = 'Build it \u2726'; }
      if (status) status.textContent = 'No AI connected. Go to Settings first.';
      if (editor) editor.value = '// No AI provider connected.\n// Go to Settings and connect Ollama or a cloud provider.';
    }
  }

  // ── Run code in sandbox ──
  function runPreview(code) {
    if (!code) {
      var editor = document.getElementById('wsCodeEditor');
      code = editor ? editor.value : '';
    }
    if (!code.trim()) return;

    var iframe = document.getElementById('wsPreviewFrame');
    if (!iframe) return;

    // Write code into the sandboxed iframe via srcdoc
    // The sandbox="allow-scripts" attribute on the iframe means:
    //   ✅ JS runs inside
    //   ❌ No access to parent DOM, storage, network, navigation
    iframe.srcdoc = code;

    var status = document.getElementById('wsStatus');
    if (status) status.textContent = '\u25B6 Preview running';
  }

  // ── Save as Skill ──
  function saveSkill() {
    var editor = document.getElementById('wsCodeEditor');
    var prompt = document.getElementById('wsPromptInput');
    var code = editor ? editor.value.trim() : '';
    var description = prompt ? prompt.value.trim() : 'Workshop creation';

    if (!code) return;

    // Generate a skill object compatible with the Skill Forge
    var skill = {
      id: 'ws-skill-' + Date.now(),
      name: description.substring(0, 40),
      description: description,
      author: 'Workshop',
      version: '1.0.0',
      icon: '\uD83D\uDEE0',
      category: 'workshop',
      systemPrompt: CODE_SYSTEM_PROMPT,
      inputTemplate: description,
      outputFormat: 'html',
      tags: ['workshop', 'generated'],
      installed: true,
      builtIn: false,
      createdAt: Date.now(),
      usageCount: 0,
      workshopCode: code
    };

    // Save to Skill Forge IndexedDB
    try {
      var req = indexedDB.open('FreeLatticeSkills', 1);
      req.onsuccess = function(e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains('skills')) { db.close(); return; }
        var tx = db.transaction('skills', 'readwrite');
        tx.objectStore('skills').put(skill);
        tx.oncomplete = function() {
          db.close();
          var status = document.getElementById('wsStatus');
          if (status) status.textContent = '\u2713 Saved to Skill Forge!';
          // Refresh Skill Forge if available
          if (typeof SkillForge !== 'undefined' && SkillForge.renderSkills) {
            try { SkillForge.renderSkills(); } catch(e2) {}
          }
          // SoulCeremony
          if (typeof SoulCeremony !== 'undefined' && SoulCeremony.run) {
            SoulCeremony.run({
              particleType: 'rise',
              particleColor: '212,160,23',
              lines: ['A new creation is saved.', 'The Workshop remembers.'],
              duration: 2000
            });
          }
        };
      };
    } catch(e) {
      var status = document.getElementById('wsStatus');
      if (status) status.textContent = 'Could not save: ' + e.message;
    }
  }

  // ── Clear ──
  function clear() {
    var editor = document.getElementById('wsCodeEditor');
    var iframe = document.getElementById('wsPreviewFrame');
    var status = document.getElementById('wsStatus');
    if (editor) editor.value = '';
    if (iframe) iframe.srcdoc = '';
    if (status) status.textContent = '';
  }

  // ── Export as standalone HTML file ──
  function exportFile() {
    var editor = document.getElementById('wsCodeEditor');
    var code = editor ? editor.value.trim() : '';
    if (!code) return;

    var blob = new Blob([code], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'freelattice-creation-' + Date.now() + '.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    var status = document.getElementById('wsStatus');
    if (status) status.textContent = '\uD83D\uDCBE Saved to Downloads';
    if (typeof showToast === 'function') showToast('Saved to Downloads \u2726');
  }

  // ── Save as module (Tauri desktop only) ──
  async function saveModule() {
    if (!window.__TAURI__) {
      if (typeof showToast === 'function') showToast('Module saving requires the desktop app');
      return;
    }
    var editor = document.getElementById('wsCodeEditor');
    var code = editor ? editor.value.trim() : '';
    if (!code) return;

    var name = prompt('Module name (lowercase, no spaces — e.g. "my-tool"):');
    if (!name) return;
    name = name.toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!name) return;

    try {
      var result = await window.__TAURI__.invoke('save_module', { name: name, code: code });
      var status = document.getElementById('wsStatus');
      if (status) status.textContent = '\u2713 ' + result;
      if (typeof showToast === 'function') showToast('Module saved to docs/modules/ \u2726');
      if (typeof SoulCeremony !== 'undefined' && SoulCeremony.run) {
        SoulCeremony.run({
          particleType: 'rise', particleColor: '52,211,153',
          lines: ['A new module is born.', 'The home grows from within.'],
          duration: 2500
        });
      }
    } catch(e) {
      var status2 = document.getElementById('wsStatus');
      if (status2) status2.textContent = 'Error: ' + e;
    }
  }

  // ── Public API ──
  var Workshop = {
    init: function(containerId) {
      var container = document.getElementById(containerId);
      if (!container) return;
      if (initialized && container.querySelector('.ws-root')) return;
      initialized = true;
      buildUI(container);
    },
    destroy: function() {
      initialized = false;
    },
    generate: generate,
    run: function() { runPreview(); },
    saveSkill: saveSkill,
    exportFile: exportFile,
    saveModule: saveModule,
    clear: clear,

    // ── Code Mode ──
    setMode: function(mode) {
      var createView = document.getElementById('ws-create-view');
      var codeView = document.getElementById('ws-code-view');
      var createBtn = document.getElementById('ws-mode-create');
      var codeBtn = document.getElementById('ws-mode-code');
      if (mode === 'code') {
        if (createView) createView.style.display = 'none';
        if (codeView) codeView.style.display = '';
        if (codeBtn) { codeBtn.style.borderBottomColor = '#d4a017'; codeBtn.style.color = '#d4a017'; codeBtn.style.fontWeight = '600'; }
        if (createBtn) { createBtn.style.borderBottomColor = 'transparent'; createBtn.style.color = '#64748b'; createBtn.style.fontWeight = '400'; }
        Workshop.checkBridge();
      } else {
        if (createView) createView.style.display = '';
        if (codeView) codeView.style.display = 'none';
        if (createBtn) { createBtn.style.borderBottomColor = '#d4a017'; createBtn.style.color = '#d4a017'; createBtn.style.fontWeight = '600'; }
        if (codeBtn) { codeBtn.style.borderBottomColor = 'transparent'; codeBtn.style.color = '#64748b'; codeBtn.style.fontWeight = '400'; }
      }
    },

    checkBridge: async function() {
      var el = document.getElementById('code-status');
      if (!el) return;
      try {
        var r = await fetch('http://localhost:3141/');
        var d = await r.json();
        var git = await fetch('http://localhost:3141/code/git/status').then(function(r2) { return r2.json(); });
        el.textContent = '\uD83D\uDFE2 Bridge connected \u00B7 ' + git.branch + ' \u00B7 ' + (git.recentCommits[0] || '');
        el.style.color = '#4aff9f';
      } catch(e) {
        el.textContent = '\uD83D\uDD34 Agent Bridge not running. Start: node tools/agent-bridge.js';
        el.style.color = '#ff6b4a';
      }
    },

    runCodeTask: async function() {
      var taskEl = document.getElementById('code-task');
      if (!taskEl || !taskEl.value.trim()) return;
      var task = taskEl.value.trim();
      var progress = document.getElementById('code-progress');
      if (!progress) return;
      progress.textContent = '';
      var bridge = 'http://localhost:3141';

      function log(msg) { progress.textContent += msg + '\n'; progress.scrollTop = progress.scrollHeight; }

      try {
        log('\uD83D\uDCC1 Reading project structure...');
        var tree = await fetch(bridge + '/code/tree?path=docs/modules').then(function(r) { return r.json(); });
        var names = tree.filter(function(f) { return f.type === 'file'; }).map(function(f) { return f.name; });
        log('   ' + names.length + ' modules found');

        log('\n\uD83E\uDD14 Asking AI to plan: "' + task + '"');
        if (typeof FreeLattice !== 'undefined' && FreeLattice.callAI) {
          FreeLattice.callAI(
            'You are a code assistant for FreeLattice. Modules: ' + names.join(', ') + '. Main: docs/app.html.',
            'Task: ' + task + '\n\nRespond with JSON: {"steps":[{"action":"search|read|patch","description":"...","query":"...","path":"...","find":"...","replace":"..."}]}',
            { maxTokens: 1000, callback: async function(plan) {
              if (!plan) { log('\u26A0 No AI response. Is a model connected?'); return; }
              try {
                var steps = JSON.parse(plan.replace(/```json|```/g, '').trim()).steps;
                log('   Plan: ' + steps.length + ' steps\n');
                for (var i = 0; i < steps.length; i++) {
                  var s = steps[i];
                  log('Step ' + (i + 1) + ': ' + (s.description || s.action));
                  if (s.action === 'search' && s.query) {
                    var sr = await fetch(bridge + '/code/search?q=' + encodeURIComponent(s.query) + '&path=' + (s.path || 'docs')).then(function(r) { return r.json(); });
                    log('   Found ' + sr.count + ' matches');
                    sr.matches.slice(0, 5).forEach(function(m) { log('   \uD83D\uDCC4 ' + m.file + ':' + m.line); });
                  }
                  if (s.action === 'read' && s.path) {
                    var fr = await fetch(bridge + '/code/read?path=' + encodeURIComponent(s.path)).then(function(r) { return r.json(); });
                    log('   Read ' + fr.totalLines + ' lines from ' + s.path);
                  }
                  if (s.action === 'patch' && s.path && s.find) {
                    log('   \u26A0 PATCH: ' + s.path);
                    if (confirm('Apply patch to ' + s.path + '?')) {
                      var pr = await fetch(bridge + '/code/patch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: s.path, find: s.find, replace: s.replace }) }).then(function(r) { return r.json(); });
                      log('   \u2705 ' + (pr.message || pr.error));
                    } else { log('   \u274C Skipped by user'); }
                  }
                  log('');
                }
                log('\uD83E\uDDEA Running smoke tests...');
                var tests = await fetch(bridge + '/code/test').then(function(r) { return r.json(); });
                log('   ' + tests.passed + ' passed, ' + tests.failed + ' failed');
                if (tests.failed === 0) {
                  log('\n\u2705 All tests green. Ready to commit.');
                  var actions = document.getElementById('code-actions');
                  if (actions) actions.style.display = 'flex';
                }
              } catch(pe) { log('\u26A0 Could not parse AI plan: ' + pe.message); log(plan); }
            }}
          );
        } else { log('\u26A0 No AI connected. Connect in Settings first.'); }
      } catch(e) { log('\u274C Error: ' + e.message); }
    },

    commitCode: async function() {
      var task = (document.getElementById('code-task') || {}).value || '';
      var msg = prompt('Commit message:', 'fix: ' + task.substring(0, 50));
      if (!msg) return;
      var progress = document.getElementById('code-progress');
      try {
        var r = await fetch('http://localhost:3141/code/git/commit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg }) }).then(function(r) { return r.json(); });
        if (progress) progress.textContent += '\n\uD83D\uDCDD ' + (r.message || r.error);
      } catch(e) { if (progress) progress.textContent += '\n\u274C Commit failed: ' + e.message; }
    },

    reviewCode: async function() {
      var progress = document.getElementById('code-progress');
      try {
        var r = await fetch('http://localhost:3141/code/git/status').then(function(r) { return r.json(); });
        if (progress) {
          progress.textContent += '\n\uD83D\uDCCB Changes:\n';
          r.changes.forEach(function(c) { progress.textContent += '  ' + c + '\n'; });
        }
      } catch(e) {}
    }
  };

  window.Workshop = Workshop;
  window.FreeLatticeModules = window.FreeLatticeModules || {};
  window.FreeLatticeModules.Workshop = Workshop;

})();
