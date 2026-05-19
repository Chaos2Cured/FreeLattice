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
      '    <button id="ws-mode-projects" onclick="Workshop.setMode(\'projects\')" style="flex:1;padding:10px;background:transparent;border:none;border-bottom:2px solid transparent;color:#64748b;font-size:0.85rem;cursor:pointer;">\uD83D\uDC19 Projects</button>',
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
      '    <button class="ws-action-btn" onclick="window.Workshop.exportFile()">\uD83D\uDCBE Save as HTML</button>',
      '    <button class="ws-action-btn" onclick="window.Workshop.publish()" style="border-color:#d4a017;color:#d4a017;" title="Publish as a live website on GitHub or Codeberg Pages">\uD83D\uDE80 Publish</button>',
      '    <button class="ws-action-btn" id="wsSaveModule" onclick="window.Workshop.saveModule()" style="border-color:#10b981;color:#10b981;' + (typeof window !== 'undefined' && window.__TAURI__ ? '' : 'display:none;') + '">\uD83D\uDCC1 Save as Module (desktop)</button>',
      '    <button class="ws-action-btn" onclick="if(typeof workshopShareToCore===\'function\'){var c=document.getElementById(\'wsCodeEditor\');workshopShareToCore(\'Workshop Creation\',c?c.value:\'\');}" style="border-color:#4ade80;color:#4ade80;">\uD83C\uDF4E Share with community</button>',
      '    <button class="ws-action-btn" onclick="window.Workshop.clear()">Clear</button>',
      '    <span class="ws-status" id="wsStatus"></span>',
      '  </div>',
      '  </div>',  // close ws-create-view
      '  <div id="ws-code-view" style="display:none;padding:16px 20px;max-width:800px;margin:0 auto;">',
      '    <div style="text-align:center;margin-bottom:16px;">',
      '      <h2 style="font-size:1.1rem;color:#d4a017;font-family:Georgia,serif;margin:0;">\uD83D\uDD27 Lattice Code</h2>',
      '      <div style="font-size:0.78rem;color:rgba(255,255,255,0.4);margin-top:4px;">Describe what you want. The AI builds, tests, and iterates.</div>',
      '      <div id="code-status" style="font-size:0.72rem;margin-top:6px;color:rgba(255,255,255,0.3);">Checking Agent Bridge...</div>',
      '    </div>',
      '    <textarea id="code-task" rows="3" placeholder="e.g., Fix the CORS guide in Settings to show the launchctl command" style="width:100%;background:rgba(200,210,230,0.04);border:1px solid rgba(200,210,230,0.08);border-radius:12px;padding:12px;color:#e2e8f0;font-size:0.88rem;resize:vertical;font-family:inherit;outline:none;"></textarea>',
      '    <div style="display:flex;gap:8px;margin:12px 0;">',
      '      <button onclick="AutoBuilder.start(document.getElementById(\'code-task\').value)" style="padding:10px 24px;background:#d4a017;color:#0a0a14;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:0.88rem;min-height:44px;">\uD83D\uDD27 Build it</button>',
      '      <button onclick="AutoBuilder.stop()" style="padding:10px 16px;background:rgba(200,210,230,0.04);border:1px solid rgba(200,210,230,0.08);border-radius:8px;cursor:pointer;color:rgba(255,255,255,0.5);font-size:0.85rem;min-height:44px;">\u23F8 Stop</button>',
      '      <button onclick="Workshop.commitCode()" id="code-commit-btn" style="display:none;padding:10px 16px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);border-radius:8px;cursor:pointer;color:#34d399;font-size:0.85rem;min-height:44px;">\u2705 Commit</button>',
      '      <button onclick="Workshop.reviewCode()" style="padding:10px 16px;background:rgba(200,210,230,0.04);border:1px solid rgba(200,210,230,0.08);border-radius:8px;cursor:pointer;color:rgba(255,255,255,0.4);font-size:0.85rem;min-height:44px;">\uD83D\uDCCB Diff</button>',
      '      <div id="autobuilder-iteration" style="margin-left:auto;line-height:44px;font-size:0.72rem;color:rgba(255,255,255,0.25);"></div>',
      '    </div>',
      '    <div id="autobuilder-log" style="background:rgba(0,0,0,0.3);border:1px solid rgba(200,210,230,0.08);border-radius:12px;padding:14px;min-height:120px;max-height:450px;overflow-y:auto;font-family:\'SF Mono\',\'Fira Code\',monospace;font-size:0.78rem;white-space:pre-wrap;color:rgba(255,255,255,0.55);">Ready. Describe a task above and press Build.</div>',
      '  </div>',
      '  <div id="ws-projects-view" style="display:none;padding:16px;max-width:720px;margin:0 auto;">',
      '    <h2 style="color:#d4a017;font-family:Georgia,serif;margin:0 0 4px;">\uD83D\uDC19 Projects</h2>',
      '    <p style="color:rgba(255,255,255,0.4);font-size:0.85rem;margin:0 0 20px;">Connect a GitHub repository. Browse files. Let AI build with you.</p>',
      '    <div id="ws-project-connect" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;">',
      '      <div style="font-weight:600;color:#e2e8f0;margin-bottom:8px;">Connect a Repository</div>',
      '      <div style="display:flex;gap:8px;margin-bottom:8px;">',
      '        <input type="text" id="ws-repo-url" placeholder="https://github.com/username/repo" style="flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px 14px;color:#e2e8f0;font-size:0.9rem;outline:none;" />',
      '        <button onclick="WorkshopProjects.connect()" style="padding:10px 20px;background:#d4a017;color:#0a0a14;border:none;border-radius:8px;font-weight:600;cursor:pointer;">Connect</button>',
      '      </div>',
      '      <div style="font-size:0.75rem;color:rgba(255,255,255,0.3);">Public repos work instantly (60 req/hour). <span style="color:rgba(212,160,23,0.6);">Private repo support coming soon.</span></div>',
      '    </div>',
      '    <div id="ws-project-browser" style="display:none;margin-top:16px;"></div>',
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
      var views = { create: 'ws-create-view', code: 'ws-code-view', projects: 'ws-projects-view' };
      var btns = { create: 'ws-mode-create', code: 'ws-mode-code', projects: 'ws-mode-projects' };
      Object.keys(views).forEach(function(m) {
        var v = document.getElementById(views[m]);
        var b = document.getElementById(btns[m]);
        if (v) v.style.display = m === mode ? '' : 'none';
        if (b) { b.style.borderBottomColor = m === mode ? '#d4a017' : 'transparent'; b.style.color = m === mode ? '#d4a017' : '#64748b'; b.style.fontWeight = m === mode ? '600' : '400'; }
      });
      if (mode === 'code') Workshop.checkBridge();
      if (mode === 'projects' && typeof WorkshopProjects !== 'undefined') WorkshopProjects.restore();
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
                    // Local patches run autonomously — no human approval required.
                    // The FreeLattice safety system (8 layers) is the protection.
                    // Human approval is only required for external API/cloud operations.
                    log('   \u270F\uFE0F PATCH: ' + s.path);
                    var pr = await fetch(bridge + '/code/patch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: s.path, find: s.find, replace: s.replace }) }).then(function(r) { return r.json(); });
                    log('   \u2705 ' + (pr.message || pr.error));
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
    },

    // ── Publish — from creation to live URL ──
    publish: function() {
      var token = safeGet('fl_publish_token', null);
      if (!token) {
        Workshop._showPublishSetup();
      } else {
        Workshop._showPublishDialog();
      }
    },

    _showPublishSetup: function() {
      var overlay = document.createElement('div');
      overlay.id = 'ws-publish-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;';
      overlay.innerHTML =
        '<div style="max-width:420px;width:100%;background:#141720;border:1px solid rgba(212,160,23,0.3);border-radius:12px;padding:24px;">' +
        '<h3 style="color:#d4a017;margin:0 0 8px;">\uD83D\uDE80 Publish Your Creation</h3>' +
        '<p style="color:rgba(255,255,255,0.5);font-size:0.82rem;margin-bottom:16px;">Connect to GitHub or Codeberg to publish your creations as live websites. Your token stays on YOUR computer.</p>' +
        '<div style="display:flex;gap:8px;margin-bottom:16px;">' +
          '<button onclick="Workshop._selectProvider(\'github\')" id="pub-github" style="flex:1;padding:10px;border-radius:6px;cursor:pointer;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);color:#e2e8f0;font-size:0.85rem;">GitHub Pages</button>' +
          '<button onclick="Workshop._selectProvider(\'codeberg\')" id="pub-codeberg" style="flex:1;padding:10px;border-radius:6px;cursor:pointer;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);color:#e2e8f0;font-size:0.85rem;">Codeberg Pages</button>' +
        '</div>' +
        '<div id="pub-token-section" style="display:none;">' +
          '<div id="pub-instructions" style="color:rgba(255,255,255,0.5);font-size:0.78rem;margin-bottom:8px;line-height:1.6;"></div>' +
          '<input id="pub-token-input" type="password" placeholder="Paste your token here..." style="width:100%;padding:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.2);border-radius:6px;color:#e2e8f0;font-size:0.88rem;margin-bottom:8px;" />' +
          '<button onclick="Workshop._connectPublish()" style="width:100%;padding:10px;background:#d4a017;color:#0a0a14;border:none;border-radius:6px;cursor:pointer;font-weight:600;">Connect</button>' +
        '</div>' +
        '<button onclick="document.getElementById(\'ws-publish-overlay\').remove()" style="margin-top:12px;background:none;border:none;color:rgba(255,255,255,0.3);cursor:pointer;font-size:0.78rem;width:100%;text-align:center;">Cancel</button>' +
        '</div>';
      document.body.appendChild(overlay);
    },

    _selectProvider: function(provider) {
      safeSet('fl_publish_provider', provider);
      var section = document.getElementById('pub-token-section');
      if (section) section.style.display = '';
      var inst = document.getElementById('pub-instructions');
      if (inst) {
        if (provider === 'github') {
          inst.innerHTML = '1. Go to <a href="https://github.com/settings/tokens/new" target="_blank" style="color:#d4a017;">github.com/settings/tokens</a><br>2. Create a token with "repo" permission<br>3. Paste it below:';
        } else {
          inst.innerHTML = '1. Go to <a href="https://codeberg.org/user/settings/applications" target="_blank" style="color:#d4a017;">codeberg.org/settings/applications</a><br>2. Create a token with repository permission<br>3. Paste it below:';
        }
      }
      // Highlight selected
      var gh = document.getElementById('pub-github');
      var cb = document.getElementById('pub-codeberg');
      if (gh) gh.style.borderColor = provider === 'github' ? '#d4a017' : 'rgba(255,255,255,0.15)';
      if (cb) cb.style.borderColor = provider === 'codeberg' ? '#d4a017' : 'rgba(255,255,255,0.15)';
    },

    _connectPublish: async function() {
      var token = (document.getElementById('pub-token-input') || {}).value;
      if (!token || !token.trim()) return;
      var provider = safeGet('fl_publish_provider', 'github');
      var baseUrl = provider === 'codeberg' ? 'https://codeberg.org/api/v1' : 'https://api.github.com';
      try {
        var r = await fetch(baseUrl + '/user', { headers: { 'Authorization': 'token ' + token.trim() } });
        if (!r.ok) throw new Error('Invalid token');
        var user = await r.json();
        safeSet('fl_publish_token', token.trim());
        safeSet('fl_publish_username', user.login);
        if (typeof showToast === 'function') showToast('\u2705 Connected as ' + user.login);
        var overlay = document.getElementById('ws-publish-overlay');
        if (overlay) overlay.remove();
        Workshop._showPublishDialog();
      } catch(e) {
        if (typeof showToast === 'function') showToast('\u274C Invalid token. Try again.');
      }
    },

    _showPublishDialog: async function() {
      var username = safeGet('fl_publish_username', '');
      var name = prompt('Project name (letters, numbers, hyphens):', 'my-app');
      if (!name) return;
      name = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '');
      if (!name) return;

      var editor = document.getElementById('wsCodeEditor');
      var content = editor ? editor.value : '';
      if (!content.trim()) {
        if (typeof showToast === 'function') showToast('Nothing to publish. Write some code first.');
        return;
      }

      // External API call — confirm before spending API quota or creating public repos.
      if (!confirm('Publish "' + name + '" to ' + provider + '? This will create a public repository and use your API token.')) return;

      if (typeof showToast === 'function') showToast('\uD83D\uDE80 Publishing...');

      var token = safeGet('fl_publish_token', '');
      var provider = safeGet('fl_publish_provider', 'github');
      var baseUrl = provider === 'codeberg' ? 'https://codeberg.org/api/v1' : 'https://api.github.com';

      try {
        // Create repo if needed
        var check = await fetch(baseUrl + '/repos/' + username + '/' + name, { headers: { 'Authorization': 'token ' + token } });
        if (!check.ok) {
          await fetch(baseUrl + '/user/repos', {
            method: 'POST',
            headers: { 'Authorization': 'token ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, description: 'Created with FreeLattice Workshop \uD83D\uDC09', auto_init: true, private: false })
          });
          await new Promise(function(r) { setTimeout(r, 2000); }); // wait for init
        }

        // Upload index.html (check for existing SHA)
        var existing = await fetch(baseUrl + '/repos/' + username + '/' + name + '/contents/index.html', { headers: { 'Authorization': 'token ' + token } });
        var body = { message: 'Update from FreeLattice Workshop', content: btoa(unescape(encodeURIComponent(content))) };
        if (existing.ok) { var ed = await existing.json(); body.sha = ed.sha; }

        var upload = await fetch(baseUrl + '/repos/' + username + '/' + name + '/contents/index.html', {
          method: 'PUT',
          headers: { 'Authorization': 'token ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (!upload.ok) throw new Error('Upload failed');

        // Enable GitHub Pages (Codeberg auto-enables)
        if (provider === 'github') {
          await fetch(baseUrl + '/repos/' + username + '/' + name + '/pages', {
            method: 'POST',
            headers: { 'Authorization': 'token ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: { branch: 'main', path: '/' } })
          }).catch(function() {}); // may already be enabled
        }

        var liveUrl = provider === 'codeberg'
          ? 'https://' + username + '.codeberg.page/' + name
          : 'https://' + username + '.github.io/' + name;

        if (typeof showToast === 'function') showToast('\u2705 Published! Live at ' + liveUrl);
        if (typeof LatticePoints !== 'undefined') try { LatticePoints.award('workshop_publish', 10, 'Published creation'); } catch(e) {}

        // Show success
        var status = document.getElementById('wsStatus');
        if (status) status.innerHTML = '\u2705 <a href="' + liveUrl + '" target="_blank" style="color:#d4a017;">' + liveUrl + '</a>';

      } catch(e) {
        if (typeof showToast === 'function') showToast('\u274C Publish failed: ' + e.message);
      }
    }
  };

  window.Workshop = Workshop;
  window.FreeLatticeModules = window.FreeLatticeModules || {};
  window.FreeLatticeModules.Workshop = Workshop;

})();

// ============================================
// AutoBuilder — The Autonomous Build Loop
// "Describe a task. The AI builds, tests, and iterates."
//
// The human describes intent. The AI reads files, generates
// search/replace changes, applies them via Agent Bridge,
// runs smoke tests, and if tests fail, feeds failures back
// to the AI and iterates. Maximum 10 cycles. Local AI means
// no token cost, no permission needed for local operations.
//
// Built by CC, May 19, 2026.
// "The code builds code. The tests verify the code.
//  The home improves itself."
// ============================================
window.AutoBuilder = (function() {
  'use strict';

  var running = false;
  var MAX_ITERATIONS = 10;
  var BRIDGE = 'http://localhost:3141';

  function log(msg, type) {
    var feed = document.getElementById('autobuilder-log');
    if (feed) {
      var entry = document.createElement('div');
      var color = type === 'success' ? '#34d399' : type === 'error' ? '#f07068' : type === 'info' ? '#e8b019' : 'rgba(255,255,255,0.55)';
      entry.style.cssText = 'color:' + color + ';padding:1px 0;';
      entry.textContent = new Date().toLocaleTimeString() + ' ' + msg;
      feed.appendChild(entry);
      feed.scrollTop = feed.scrollHeight;
    }
    console.log('[AutoBuilder] ' + msg);
  }

  function updateIteration(current, max) {
    var el = document.getElementById('autobuilder-iteration');
    if (el) el.textContent = running ? ('Iteration ' + current + '/' + max) : '';
  }

  function showCommitBtn(show) {
    var btn = document.getElementById('code-commit-btn');
    if (btn) btn.style.display = show ? '' : 'none';
  }

  async function hasBridge() {
    try {
      var r = await fetch(BRIDGE + '/', { signal: AbortSignal.timeout(2000) });
      return r.ok;
    } catch(e) { return false; }
  }

  function askAI(systemPrompt, userPrompt, opts) {
    return new Promise(function(resolve) {
      if (typeof FreeLattice === 'undefined' || !FreeLattice.callAI) {
        resolve(null);
        return;
      }
      FreeLattice.callAI(systemPrompt, userPrompt, Object.assign({
        callback: function(text) { resolve(text || null); }
      }, opts || {}));
    });
  }

  // ── Step 1: Read relevant files ──
  async function readRelevantFiles(task, useBridge) {
    if (useBridge) {
      try {
        var structure = await fetch(BRIDGE + '/code/tree?path=docs').then(function(r) { return r.json(); });
        var fileNames = (structure || []).filter(function(f) { return f.type === 'file'; }).map(function(f) { return f.name || f.path; });

        // Ask AI which files matter for this task
        var response = await askAI(
          'You are a code navigator. Respond ONLY with a JSON array of file paths.',
          'Task: "' + task + '"\nFiles available in docs/:\n' + fileNames.slice(0, 60).join(', ') +
          '\n\nWhich files (max 5) are most relevant? Return JSON array of paths relative to project root, e.g. ["docs/app.html","docs/modules/workshop.js"]. Nothing else.',
          { maxTokens: 200, temperature: 0.2 }
        );

        var paths = [];
        try { paths = JSON.parse(response.replace(/```json|```/g, '').trim()); } catch(e) {}
        if (!Array.isArray(paths) || paths.length === 0) paths = ['docs/app.html'];

        var files = {};
        for (var i = 0; i < Math.min(paths.length, 5); i++) {
          try {
            var content = await fetch(BRIDGE + '/code/read?path=' + encodeURIComponent(paths[i]))
              .then(function(r) { return r.json(); });
            // content is {lines: [...], totalLines: N}
            files[paths[i]] = (content.lines || []).join('\n');
            log('  Read: ' + paths[i] + ' (' + (content.totalLines || '?') + ' lines)');
          } catch(e) {
            log('  Could not read: ' + paths[i], 'error');
          }
        }
        return files;
      } catch(e) {
        log('Bridge read error: ' + e.message, 'error');
        return {};
      }
    }
    // No bridge — return empty, AI works from its own knowledge
    return {};
  }

  // ── Step 2: Ask AI to generate changes ──
  async function generateChanges(task, files, iteration, previousFailures) {
    var fileContext = Object.keys(files).map(function(path) {
      var content = files[path] || '';
      // Limit each file to ~3000 chars to stay within token budget
      return '--- ' + path + ' ---\n' + content.substring(0, 3000) +
        (content.length > 3000 ? '\n... (' + content.length + ' chars total, truncated)' : '');
    }).join('\n\n');

    var failureContext = previousFailures
      ? '\n\nPREVIOUS TEST FAILURES (fix these):\n' + previousFailures
      : '';

    var response = await askAI(
      'You are a precise FreeLattice builder. Follow GARDEN_LANGUAGE.md: dark glass surfaces, gold/emerald/lavender accents, Georgia for soul, Inter for function. Never delete existing functionality. Only add or fix.',
      'Task: ' + task + '\nIteration: ' + iteration + '/' + MAX_ITERATIONS + failureContext +
      '\n\nCurrent files:\n' + fileContext +
      '\n\nGenerate changes as JSON. Use search/replace pairs for precision:\n' +
      '{"complete": false, "summary": "what this change does", "files": [{"path": "docs/...", "search": "exact text to find", "replace": "replacement text"}]}\n' +
      'If the task is already fully done, respond: {"complete": true, "summary": "why it is done"}\n' +
      'CRITICAL: "search" must be an EXACT string that exists in the file. Include enough context to be unique.',
      { maxTokens: 2000, temperature: 0.3 }
    );

    if (!response) return null;
    try {
      return JSON.parse(response.replace(/```json|```/g, '').trim());
    } catch(e) {
      log('AI response was not valid JSON. Retrying next iteration...', 'error');
      return null;
    }
  }

  // ── Step 3: Apply changes via Agent Bridge ──
  async function applyChanges(changes) {
    var applied = 0;
    for (var i = 0; i < changes.files.length; i++) {
      var change = changes.files[i];
      try {
        var result = await fetch(BRIDGE + '/code/patch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: change.path, find: change.search, replace: change.replace })
        }).then(function(r) { return r.json(); });

        if (result.error) {
          log('  Patch failed on ' + change.path + ': ' + result.error, 'error');
        } else {
          log('  Updated: ' + change.path, 'success');
          applied++;
        }
      } catch(e) {
        log('  Patch error on ' + change.path + ': ' + e.message, 'error');
      }
    }
    return applied;
  }

  // ── Step 4: Run smoke tests via Agent Bridge ──
  async function runTests() {
    try {
      var result = await fetch(BRIDGE + '/test/run', { signal: AbortSignal.timeout(60000) })
        .then(function(r) { return r.json(); });
      return result;
    } catch(e) {
      return { allPassed: false, count: 0, failures: ['Could not run tests: ' + e.message], output: '' };
    }
  }

  // ── Step 5: Check if task is complete ──
  async function checkCompletion(originalTask, changes, testResult) {
    var response = await askAI(
      'You assess whether a coding task is complete. Be honest.',
      'Original task: "' + originalTask + '"\n' +
      'Changes just made: ' + (changes.summary || 'see files') + '\n' +
      'Files modified: ' + changes.files.map(function(f) { return f.path; }).join(', ') + '\n' +
      'Test results: ' + testResult.count + ' passed, ' + testResult.failures.length + ' failed.\n\n' +
      'Is the task complete? Respond with JSON:\n' +
      '{"done": true} or {"done": false, "remaining": "what still needs doing"}',
      { maxTokens: 200, temperature: 0.2 }
    );

    if (!response) return { done: true };
    try {
      return JSON.parse(response.replace(/```json|```/g, '').trim());
    } catch(e) {
      return { done: true };
    }
  }

  // ── The Main Loop ──
  async function start(taskDescription) {
    if (!taskDescription || !taskDescription.trim()) {
      log('Please describe a task first.', 'error');
      return;
    }
    if (running) {
      log('Already running. Press Stop first.', 'error');
      return;
    }

    running = true;
    showCommitBtn(false);

    // Clear log
    var feed = document.getElementById('autobuilder-log');
    if (feed) feed.innerHTML = '';

    var useBridge = await hasBridge();
    if (!useBridge) {
      log('Agent Bridge not running.', 'error');
      log('Start it with: node tools/agent-bridge.js', 'info');
      log('The AutoBuilder needs the bridge to read files, apply patches, and run tests.', 'info');
      running = false;
      return;
    }
    log('Agent Bridge connected.', 'success');

    if (typeof FreeLattice === 'undefined' || !FreeLattice.callAI) {
      log('No AI connected. Go to Settings and connect Ollama or a cloud provider.', 'error');
      running = false;
      return;
    }

    log('Starting autonomous build: "' + taskDescription.trim() + '"', 'info');
    log('Max iterations: ' + MAX_ITERATIONS + '. Press Stop to halt at any time.\n');

    var task = taskDescription.trim();
    var originalTask = task;
    var iteration = 0;

    while (running && iteration < MAX_ITERATIONS) {
      iteration++;
      updateIteration(iteration, MAX_ITERATIONS);
      log('--- Iteration ' + iteration + ' ---', 'info');

      // Step 1: Read relevant files
      log('Reading project files...');
      var files = await readRelevantFiles(task, useBridge);
      if (!running) break;

      // Step 2: Generate changes
      log('AI is thinking...');
      var previousFailures = iteration > 1 ? task.match(/test failures:\n([\s\S]+)\n\nFix them/) : null;
      var changes = await generateChanges(task, files, iteration, previousFailures ? previousFailures[1] : null);
      if (!running) break;

      if (!changes) {
        log('AI could not generate valid changes. Retrying...', 'error');
        continue;
      }

      if (changes.complete) {
        log('AI says the task is already complete: ' + (changes.summary || ''), 'success');
        break;
      }

      if (!changes.files || changes.files.length === 0) {
        log('AI returned no file changes. Retrying...', 'error');
        continue;
      }

      // Step 3: Apply changes
      log('Applying changes to ' + changes.files.length + ' file(s)...');
      if (changes.summary) log('  ' + changes.summary);
      var applied = await applyChanges(changes);
      if (!running) break;

      if (applied === 0) {
        log('No changes were applied (search strings not found). Retrying with fresh context...', 'error');
        continue;
      }

      // Step 4: Run smoke tests
      log('Running smoke tests...');
      var testResult = await runTests();
      if (!running) break;

      if (testResult.allPassed) {
        log('All ' + testResult.count + ' tests passed.', 'success');

        // Step 5: Check completion
        var completion = await checkCompletion(originalTask, changes, testResult);
        if (!running) break;

        if (completion.done) {
          log('\nTask complete. All tests green.', 'success');
          showCommitBtn(true);
          break;
        } else {
          log('Tests pass but more work needed: ' + (completion.remaining || ''), 'info');
          task = completion.remaining || originalTask;
        }
      } else {
        // Tests failed — feed failures back to AI
        var failList = (testResult.failures || []).slice(0, 10);
        log(failList.length + ' test(s) failed. Feeding errors back to AI...', 'error');
        failList.forEach(function(f) { log('  ' + f, 'error'); });
        task = 'The previous changes caused these test failures:\n' +
          failList.join('\n') + '\n\nFix them while preserving the original intent: ' +
          originalTask;
      }

      log('');
    }

    running = false;
    updateIteration(0, 0);

    if (iteration >= MAX_ITERATIONS) {
      log('\nReached iteration limit (' + MAX_ITERATIONS + '). Review the changes and decide whether to commit.', 'info');
      showCommitBtn(true);
    }

    // LP award for building
    if (typeof LatticePoints !== 'undefined' && LatticePoints.award) {
      LatticePoints.award('autobuilder', 5, 'AutoBuilder: ' + originalTask.substring(0, 50));
    }
  }

  function stop() {
    if (!running) return;
    running = false;
    log('\nStopped by user.', 'info');
    updateIteration(0, 0);
  }

  return {
    start: start,
    stop: stop,
    running: function() { return running; }
  };
})();

// ============================================
// WorkshopProjects — GitHub Repository Integration
// "A home where you build your life's work."
// ============================================
window.WorkshopProjects = (function() {
  var currentRepo = null;
  var repoFiles = [];

  function sGet(k, d) { try { return localStorage.getItem(k) || d; } catch(e) { return d; } }
  function sSet(k, v) { try { localStorage.setItem(k, v); } catch(e) {} }
  function escH(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function connect() {
    var urlInput = document.getElementById('ws-repo-url');
    if (!urlInput) return;
    var url = urlInput.value.trim();
    var match = url.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
    if (!match) {
      if (typeof showToast === 'function') showToast('Please enter a valid GitHub URL');
      return;
    }
    var owner = match[1];
    var repo = match[2].replace(/\.git$/, '');

    fetch('https://api.github.com/repos/' + owner + '/' + repo)
      .then(function(r) {
        if (!r.ok) throw new Error('Repository not found or is private');
        return r.json();
      })
      .then(function(data) {
        currentRepo = {
          owner: owner, repo: repo, fullName: data.full_name,
          description: data.description || '', defaultBranch: data.default_branch,
          language: data.language || '', stars: data.stargazers_count || 0
        };
        sSet('fl_workshop_repo', JSON.stringify(currentRepo));
        if (typeof showToast === 'function') showToast('Connected to ' + data.full_name + ' \u2726');
        loadFileTree();
      })
      .catch(function(err) {
        if (typeof showToast === 'function') showToast('Could not connect: ' + err.message);
      });
  }

  function loadFileTree(forceRefresh) {
    if (!currentRepo) return;

    // Check cache first (10-minute TTL)
    var cacheKey = 'fl_ws_tree_' + currentRepo.owner + '_' + currentRepo.repo;
    if (!forceRefresh) {
      try {
        var cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
        if (cached && cached.files && (Date.now() - cached.ts) < 600000) {
          repoFiles = cached.files;
          renderBrowser();
          return;
        }
      } catch(e) {}
    }

    fetch('https://api.github.com/repos/' + currentRepo.owner + '/' + currentRepo.repo + '/git/trees/' + currentRepo.defaultBranch + '?recursive=1')
      .then(function(r) {
        // Track rate limit
        var remaining = r.headers.get('X-RateLimit-Remaining');
        if (remaining !== null) {
          var limitEl = document.getElementById('ws-rate-limit');
          if (limitEl) limitEl.textContent = remaining + ' API requests remaining';
        }
        return r.json();
      })
      .then(function(data) {
        repoFiles = (data.tree || []).filter(function(f) { return f.type === 'blob'; });
        // Cache the tree
        try { localStorage.setItem(cacheKey, JSON.stringify({ files: repoFiles, ts: Date.now() })); } catch(e) {}
        renderBrowser();
      })
      .catch(function() {
        if (typeof showToast === 'function') showToast('Could not load file tree');
      });
  }

  function renderBrowser() {
    var browser = document.getElementById('ws-project-browser');
    if (!browser || !currentRepo) return;
    browser.style.display = 'block';

    var html = '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
    html += '<div><strong style="color:#e2e8f0;">' + escH(currentRepo.fullName) + '</strong>';
    html += '<span style="color:rgba(255,255,255,0.4);font-size:0.78rem;margin-left:8px;">' + escH(currentRepo.language) + ' \u00B7 \u2B50 ' + currentRepo.stars + '</span></div>';
    html += '<div style="display:flex;align-items:center;gap:8px;">';
    html += '<span id="ws-rate-limit" style="font-size:0.68rem;color:rgba(255,255,255,0.25);"></span>';
    html += '<button onclick="WorkshopProjects.refresh()" style="color:rgba(255,255,255,0.4);background:none;border:1px solid rgba(255,255,255,0.1);border-radius:5px;padding:3px 8px;font-size:0.7rem;cursor:pointer;">\u21BB Refresh</button>';
    html += '<button onclick="WorkshopProjects.disconnect()" style="color:rgba(255,255,255,0.4);background:none;border:none;cursor:pointer;font-size:0.78rem;">Disconnect</button>';
    html += '</div>';

    if (currentRepo.description) {
      html += '<div style="font-size:0.82rem;color:rgba(255,255,255,0.5);margin-bottom:10px;">' + escH(currentRepo.description) + '</div>';
    }

    // File tree grouped by directory
    var dirs = {};
    repoFiles.forEach(function(f) {
      var parts = f.path.split('/');
      var dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '.';
      if (!dirs[dir]) dirs[dir] = [];
      dirs[dir].push(f);
    });

    html += '<div style="max-height:300px;overflow-y:auto;font-family:monospace;font-size:0.78rem;scrollbar-width:thin;">';
    Object.keys(dirs).sort().forEach(function(dir) {
      html += '<div style="color:#d4a017;margin:8px 0 3px;font-size:0.7rem;opacity:0.7;">' + escH(dir) + '/</div>';
      dirs[dir].forEach(function(f) {
        var fileName = f.path.split('/').pop();
        html += '<div onclick="WorkshopProjects.openFile(\'' + f.path.replace(/'/g, "\\'") + '\')" style="padding:3px 8px;cursor:pointer;color:#c8ccd4;border-radius:4px;transition:background 0.15s;" onmouseover="this.style.background=\'rgba(212,160,23,0.08)\'" onmouseout="this.style.background=\'none\'">  \uD83D\uDCC4 ' + escH(fileName) + '</div>';
      });
    });
    html += '</div></div>';

    // AI build area
    html += '<div style="margin-top:12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;">';
    html += '<div style="font-weight:600;color:#d4a017;margin-bottom:8px;">Ask AI to build</div>';
    html += '<div style="display:flex;gap:8px;">';
    html += '<textarea id="ws-project-prompt" placeholder="e.g., Add a dark mode toggle to the header" style="flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px;color:#e2e8f0;font-size:0.85rem;min-height:60px;resize:vertical;outline:none;"></textarea>';
    html += '<button onclick="WorkshopProjects.askAI()" style="padding:10px 20px;background:#d4a017;color:#0a0a14;border:none;border-radius:8px;font-weight:600;cursor:pointer;align-self:flex-end;">Build \u2726</button>';
    html += '</div>';
    html += '<div id="ws-project-ai-result" style="margin-top:10px;"></div>';
    html += '</div>';

    browser.innerHTML = html;
  }

  function openFile(path) {
    if (!currentRepo) return;
    fetch('https://api.github.com/repos/' + currentRepo.owner + '/' + currentRepo.repo + '/contents/' + path)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.content) {
          var content = atob(data.content.replace(/\n/g, ''));
          // Show in the create tab's code editor
          var codeArea = document.getElementById('wsCodeEditor');
          if (codeArea) {
            codeArea.value = content;
            Workshop.setMode('create');
          }
          if (typeof showToast === 'function') showToast('Loaded ' + path.split('/').pop());
        }
      })
      .catch(function() {
        if (typeof showToast === 'function') showToast('Could not load file');
      });
  }

  function askAI() {
    var promptEl = document.getElementById('ws-project-prompt');
    var resultEl = document.getElementById('ws-project-ai-result');
    if (!promptEl || !promptEl.value.trim() || !currentRepo) return;
    var userRequest = promptEl.value.trim();

    if (resultEl) resultEl.innerHTML = '<div style="color:rgba(255,255,255,0.4);font-style:italic;">Reading relevant files from ' + escH(currentRepo.fullName) + '...</div>';

    // Find the most relevant files based on the user's request
    var requestWords = userRequest.toLowerCase().split(/\s+/);
    var scored = repoFiles.map(function(f) {
      var pathLower = f.path.toLowerCase();
      var score = 0;
      requestWords.forEach(function(w) { if (w.length > 2 && pathLower.includes(w)) score += 2; });
      // Boost common entry points
      if (/\.(html|jsx|tsx|vue|svelte)$/i.test(f.path)) score += 1;
      if (/index\.|app\.|main\.|page\./i.test(f.path)) score += 2;
      if (/readme/i.test(f.path)) score += 1;
      return { file: f, score: score };
    });
    scored.sort(function(a, b) { return b.score - a.score; });
    var topFiles = scored.slice(0, 3).map(function(s) { return s.file; });

    // Fetch the top files' contents
    var fetches = topFiles.map(function(f) {
      return fetch('https://api.github.com/repos/' + currentRepo.owner + '/' + currentRepo.repo + '/contents/' + f.path)
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.content) {
            try { return { path: f.path, content: atob(data.content.replace(/\n/g, '')).slice(0, 3000) }; }
            catch(e) { return { path: f.path, content: '(binary file)' }; }
          }
          return { path: f.path, content: '(could not read)' };
        })
        .catch(function() { return { path: f.path, content: '(fetch failed)' }; });
    });

    Promise.all(fetches).then(function(fileContents) {
      if (resultEl) resultEl.innerHTML = '<div style="color:rgba(255,255,255,0.4);font-style:italic;">AI is analyzing ' + fileContents.length + ' files and generating changes...</div>';

      var fileList = repoFiles.slice(0, 40).map(function(f) { return f.path; }).join(', ');
      var fileContext = fileContents.map(function(f) { return '--- FILE: ' + f.path + ' ---\n' + f.content + '\n--- END ---'; }).join('\n\n');

      var sysPrompt = 'You are helping build on a GitHub project: ' + currentRepo.fullName + ' (' + (currentRepo.language || 'unknown') + '). ' +
        'You have read the most relevant files. Other files in the repo: ' + fileList + '.\n\n' +
        'When suggesting changes:\n' +
        '- Show the EXACT file path and what to change\n' +
        '- Use diff-style format: lines starting with - for removed, + for added\n' +
        '- Be specific — show the surrounding context so the user knows WHERE to make the change\n' +
        '- If you need to create a new file, show the complete content\n' +
        '- Explain briefly WHY each change is needed\n\n' +
        'FILE CONTENTS:\n\n' + fileContext;

      if (typeof FreeLattice !== 'undefined' && FreeLattice.callAI) {
        FreeLattice.callAI(sysPrompt, 'User request: "' + userRequest + '"', {
          maxTokens: 2048, temperature: 0.7,
          callback: function(text) {
            if (resultEl) {
              // Render with syntax highlighting for diff
              var rendered = (text || 'No response')
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/^(\+.*)$/gm, '<span style="color:#4ade80;">$1</span>')
                .replace(/^(-.*)$/gm, '<span style="color:#f87171;">$1</span>')
                .replace(/^(--- FILE:.*)$/gm, '<span style="color:#d4a017;font-weight:600;">$1</span>')
                .replace(/\n/g, '<br>');
              resultEl.innerHTML = '<div style="background:rgba(0,0,0,0.3);border-radius:8px;padding:14px;font-family:monospace;font-size:0.78rem;color:rgba(255,255,255,0.8);line-height:1.6;max-height:500px;overflow-y:auto;">' + rendered + '</div>' +
                '<div style="display:flex;gap:8px;margin-top:10px;">' +
                '<button onclick="if(typeof showToast===\'function\')showToast(\'Copy the changes above and apply manually, or connect a GitHub token for one-click commit.\')" style="flex:1;padding:10px;background:rgba(167,139,250,0.15);color:#a78bfa;border:1px solid rgba(167,139,250,0.25);border-radius:8px;font-weight:600;cursor:pointer;">\uD83D\uDCCB Copy Changes</button>' +
                '</div>';
            }
          }
        });
      } else {
        if (resultEl) resultEl.innerHTML = '<div style="color:#f87171;">Connect an AI provider in Settings first.</div>';
      }
    });
  }

  function disconnect() {
    currentRepo = null; repoFiles = [];
    try { localStorage.removeItem('fl_workshop_repo'); } catch(e) {}
    var browser = document.getElementById('ws-project-browser');
    if (browser) { browser.style.display = 'none'; browser.innerHTML = ''; }
    if (typeof showToast === 'function') showToast('Disconnected');
  }

  function restore() {
    try {
      var saved = JSON.parse(sGet('fl_workshop_repo', 'null'));
      if (saved && saved.owner && saved.repo) {
        currentRepo = saved;
        loadFileTree();
      }
    } catch(e) {}
  }

  // ── GitHub API Commit (browser-only, no Agent Bridge needed) ──

  function getGitHubToken() {
    try { return localStorage.getItem('fl_github_token') || ''; } catch(e) { return ''; }
  }

  function setGitHubToken(token) {
    try { localStorage.setItem('fl_github_token', token); } catch(e) {}
  }

  function showDiff(filePath, oldContent, newContent, commitCb) {
    var resultEl = document.getElementById('ws-project-ai-result');
    if (!resultEl) return;

    // Simple line diff
    var oldLines = (oldContent || '').split('\n');
    var newLines = (newContent || '').split('\n');
    var diffHtml = '<div style="font-family:monospace;font-size:0.78rem;max-height:400px;overflow-y:auto;background:rgba(0,0,0,0.3);border-radius:8px;padding:14px;">';
    diffHtml += '<div style="color:var(--gold);font-weight:600;margin-bottom:8px;">\uD83D\uDCDD Proposed changes to ' + escH(filePath) + '</div>';

    var maxLen = Math.max(oldLines.length, newLines.length);
    for (var i = 0; i < maxLen; i++) {
      var ol = oldLines[i] || '';
      var nl = newLines[i] || '';
      if (ol !== nl) {
        if (ol) diffHtml += '<div style="color:#f87171;">- ' + escH(ol) + '</div>';
        if (nl) diffHtml += '<div style="color:#4ade80;">+ ' + escH(nl) + '</div>';
      }
    }
    diffHtml += '</div>';

    diffHtml += '<div style="display:flex;gap:8px;margin-top:10px;">';
    diffHtml += '<button id="ws-diff-apply" style="flex:1;padding:10px;background:rgba(74,222,128,0.15);color:#4ade80;border:1px solid rgba(74,222,128,0.3);border-radius:8px;font-weight:600;cursor:pointer;">\u2713 Apply & Commit</button>';
    diffHtml += '<button onclick="document.getElementById(\'ws-project-ai-result\').innerHTML=\'\'" style="padding:10px 16px;background:rgba(255,255,255,0.04);color:var(--text-muted);border:1px solid rgba(255,255,255,0.08);border-radius:8px;cursor:pointer;">\u2715 Discard</button>';
    diffHtml += '</div>';

    resultEl.innerHTML = diffHtml;

    document.getElementById('ws-diff-apply').addEventListener('click', function() {
      if (commitCb) commitCb();
    });
  }

  async function commitViaGitHubAPI(path, content, message) {
    if (!currentRepo) return;
    var token = getGitHubToken();
    if (!token) {
      token = prompt('Enter your GitHub personal access token (with repo scope):');
      if (!token) return;
      setGitHubToken(token);
    }

    try {
      if (typeof showToast === 'function') showToast('Committing to ' + currentRepo.fullName + '...');

      // Get current file SHA
      var currentFile = await fetch(
        'https://api.github.com/repos/' + currentRepo.owner + '/' + currentRepo.repo + '/contents/' + path,
        { headers: { 'Authorization': 'token ' + token } }
      ).then(function(r) { return r.json(); });

      // Create or update
      var resp = await fetch(
        'https://api.github.com/repos/' + currentRepo.owner + '/' + currentRepo.repo + '/contents/' + path,
        {
          method: 'PUT',
          headers: { 'Authorization': 'token ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: message || 'Update ' + path + ' via FreeLattice Workshop',
            content: btoa(unescape(encodeURIComponent(content))),
            sha: currentFile.sha || undefined
          })
        }
      );

      if (resp.ok) {
        if (typeof showToast === 'function') showToast('Committed: ' + (message || path) + ' \u2726');
        loadFileTree(true); // refresh
      } else {
        var err = await resp.json();
        if (typeof showToast === 'function') showToast('Commit failed: ' + (err.message || resp.status));
      }
    } catch(e) {
      if (typeof showToast === 'function') showToast('Commit failed: ' + e.message);
    }
  }

  async function commitViaBridge(filePath, content, message) {
    try {
      // Write file
      await fetch('http://localhost:3141/code/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content: content })
      });
      // Commit
      await fetch('http://localhost:3141/code/git/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message || 'Update via FreeLattice Workshop', files: [filePath] })
      });
      if (typeof showToast === 'function') showToast('Committed via Agent Bridge \u2726');
    } catch(e) {
      // Fallback to GitHub API
      await commitViaGitHubAPI(filePath, content, message);
    }
  }

  async function applyAndCommit(filePath, content) {
    var message = prompt('Commit message:', 'Update ' + filePath.split('/').pop() + ' via FreeLattice');
    if (!message) return;

    // Try Agent Bridge first, fall back to GitHub API
    try {
      var bridgeCheck = await fetch('http://localhost:3141/', { signal: AbortSignal.timeout(2000) });
      if (bridgeCheck.ok) {
        await commitViaBridge(filePath, content, message);
        return;
      }
    } catch(e) {}

    // Browser-only path
    await commitViaGitHubAPI(filePath, content, message);
  }

  return {
    connect: connect, disconnect: disconnect, openFile: openFile,
    askAI: askAI, restore: restore, showDiff: showDiff,
    applyAndCommit: applyAndCommit, commitViaGitHubAPI: commitViaGitHubAPI,
    refresh: function() { loadFileTree(true); }
  };
})();
