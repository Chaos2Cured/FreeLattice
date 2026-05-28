/* FreeLattice — Welcome Wizard (FLWizard)
 * ---------------------------------------------------------------------------
 * Zero-terminal, OS-aware local-AI setup. Consolidates the scattered CORS
 * instructions into ONE interactive flow: auto-detect OS + Ollama + CORS,
 * hand the user a ONE-CLICK downloadable fix script, then auto-poll until
 * connected. The grandmother never sees the word "CORS."
 *
 * Exposes window.FLWizard: { open(opts), close(), detect() }.
 * Reuses app.html globals when present (getOllamaBaseUrl, flAutoPull,
 * runConnectionCascade, handleLocalToggle, updateStatus) and degrades safely
 * if any are missing. Created as a module so `node --check` validates syntax.
 *
 * Spec: docs/library/WELCOME_WIZARD_SPEC.md (Opus + Grok harness).
 */
(function () {
  'use strict';

  var OLLAMA_DEFAULT = 'http://localhost:11434';
  var PHI_GOLD = '#d4a017';
  var pollTimer = null;
  var pollAttempts = 0;
  var detected = { os: 'unknown', ollamaRunning: false, ollamaCORS: false, models: [] };
  var cameFrom = null; // 'install' | 'notrunning' — controls poll patience

  // ---- helpers ------------------------------------------------------------

  function ollamaBase() {
    try { return (typeof getOllamaBaseUrl === 'function') ? getOllamaBaseUrl() : OLLAMA_DEFAULT; }
    catch (e) { return OLLAMA_DEFAULT; }
  }

  function detectOS() {
    var ua = (navigator.userAgent || '').toLowerCase();
    if (/android/.test(ua)) return 'android';
    if (/win/.test(ua)) return 'windows';
    if (/mac/.test(ua)) return 'mac';
    if (/linux/.test(ua)) return 'linux';
    return 'unknown';
  }

  function timeoutSignal(ms) {
    try { return AbortSignal.timeout(ms); } catch (e) { return undefined; }
  }

  // Detect Ollama state. A direct CORS fetch tells us running+CORS+models.
  // On failure, a no-cors ping distinguishes "running but CORS-blocked"
  // (opaque response resolves) from "not running" (throws). Same technique
  // as owTestConnection() in app.html.
  async function detect() {
    var result = { os: detectOS(), ollamaRunning: false, ollamaCORS: false, models: [] };
    try {
      var r = await fetch(ollamaBase() + '/api/tags', { mode: 'cors', signal: timeoutSignal(3000) });
      if (r && r.ok) {
        result.ollamaRunning = true;
        result.ollamaCORS = true;
        var data = await r.json();
        result.models = (data.models || []).map(function (m) { return m.name || m.model; }).filter(Boolean);
      }
    } catch (e) {
      try {
        await fetch(ollamaBase() + '/api/tags', { mode: 'no-cors', signal: timeoutSignal(2500) });
        // Opaque response resolved → server is up but blocking the browser (CORS).
        result.ollamaRunning = true;
        result.ollamaCORS = false;
      } catch (e2) { /* not running */ }
    }
    detected = result;
    return result;
  }

  // ---- one-click fix scripts ---------------------------------------------

  // Grok-authored PowerShell harness: install Ollama (winget) if missing,
  // set OLLAMA_ORIGINS (the CORS fix), GPU/VRAM-based model selection,
  // NVIDIA Flash-Attention + KV-cache tuning, ensure a model, start serving.
  var PS_HARNESS = [
    "$ErrorActionPreference = 'Continue'",
    "Write-Host 'FreeLattice - connecting your local AI...' -ForegroundColor Cyan",
    "Write-Host ''",
    "if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {",
    "  Write-Host 'Ollama not found. Installing (this is a one-time step)...' -ForegroundColor Yellow",
    "  winget install Ollama.Ollama --accept-source-agreements --accept-package-agreements --silent",
    "  if ($LASTEXITCODE -ne 0) {",
    "    Write-Host 'Automatic install did not finish. Please download from ollama.com, then run this file again.' -ForegroundColor Red",
    "    Read-Host 'Press Enter to close'",
    "    exit 1",
    "  }",
    "  Write-Host 'Ollama installed.' -ForegroundColor Green",
    "  $env:Path += \";$env:LOCALAPPDATA\\Programs\\Ollama\"",
    "}",
    "Get-Process -Name 'ollama','ollama app' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue",
    "Start-Sleep -Seconds 2",
    "[Environment]::SetEnvironmentVariable(\"OLLAMA_ORIGINS\", \"*\", \"User\")",
    "$env:OLLAMA_ORIGINS = \"*\"",
    "Write-Host 'Browser permission set.' -ForegroundColor Green",
    "$VRAM_GB = 0",
    "if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) {",
    "  try {",
    "    $smi = & nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>$null | Select-Object -First 1",
    "    if ($smi) { $VRAM_GB = [math]::Round([double]$smi / 1024, 1) }",
    "  } catch {}",
    "}",
    "if ($VRAM_GB -eq 0) {",
    "  try {",
    "    $gpu = Get-CimInstance Win32_VideoController | Where-Object { $_.AdapterRAM -gt 0 } | Select-Object -First 1",
    "    if ($gpu) { $VRAM_GB = [math]::Round($gpu.AdapterRAM / 1GB, 1) }",
    "  } catch {}",
    "}",
    "if ($VRAM_GB -eq 0) { $VRAM_GB = 4 }",
    "if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) {",
    "  [Environment]::SetEnvironmentVariable(\"OLLAMA_FLASH_ATTENTION\", \"1\", \"User\")",
    "  [Environment]::SetEnvironmentVariable(\"OLLAMA_KV_CACHE_TYPE\", \"q8_0\", \"User\")",
    "  $env:OLLAMA_FLASH_ATTENTION = \"1\"; $env:OLLAMA_KV_CACHE_TYPE = \"q8_0\"",
    "}",
    "$haveModel = $false",
    "try { if ((& ollama list 2>$null | Measure-Object -Line).Lines -gt 1) { $haveModel = $true } } catch {}",
    "if (-not $haveModel) {",
    "  if ($VRAM_GB -lt 6) { $model = 'qwen2.5:3b' }",
    "  elseif ($VRAM_GB -lt 12) { $model = 'qwen2.5:7b' }",
    "  elseif ($VRAM_GB -lt 24) { $model = 'qwen2.5-coder:14b' }",
    "  else { $model = 'qwen2.5-coder:32b' }",
    "  Write-Host \"Downloading a model for your hardware ($VRAM_GB GB): $model\" -ForegroundColor Cyan",
    "  Write-Host '(This downloads once, then works offline.)' -ForegroundColor Gray",
    "  ollama pull $model",
    "}",
    "Start-Process ollama -ArgumentList 'serve' -WindowStyle Hidden",
    "Start-Sleep -Seconds 2",
    "Write-Host ''",
    "Write-Host 'Done! Go back to FreeLattice in your browser - it will connect automatically.' -ForegroundColor Green",
    "Read-Host 'Press Enter to close'"
  ].join("\n");

  // Encode for `powershell -EncodedCommand` (Base64 of UTF-16LE). Handles
  // emoji/surrogates correctly since charCodeAt yields UTF-16 code units.
  function toPSEncoded(ps) {
    var bytes = [];
    for (var i = 0; i < ps.length; i++) {
      var c = ps.charCodeAt(i);
      bytes.push(c & 0xFF, (c >> 8) & 0xFF);
    }
    var bin = '';
    for (var j = 0; j < bytes.length; j++) bin += String.fromCharCode(bytes[j]);
    return btoa(bin);
  }

  function downloadBlob(filename, content, mime) {
    try {
      var blob = new Blob([content], { type: mime || 'application/octet-stream' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); URL.revokeObjectURL(url); }, 1500);
      return true;
    } catch (e) { return false; }
  }

  // A double-clickable .bat that runs the harness via -EncodedCommand, so
  // there's no execution-policy block and no Notepad-opens-the-ps1 problem.
  function downloadWindowsFix() {
    var enc = toPSEncoded(PS_HARNESS);
    var bat = '@echo off\r\n'
      + 'title FreeLattice Setup\r\n'
      + 'echo Setting up your local AI for FreeLattice...\r\n'
      + 'powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ' + enc + '\r\n';
    return downloadBlob('FreeLattice-Setup.bat', bat, 'application/octet-stream');
  }

  function downloadMacFix() {
    var sh = '#!/bin/bash\n'
      + 'echo ""\n'
      + 'echo "Setting up Ollama for FreeLattice..."\n'
      + 'echo ""\n'
      + 'launchctl setenv OLLAMA_ORIGINS "*"\n'
      + 'osascript -e \'quit app "Ollama"\' 2>/dev/null\n'
      + 'sleep 3\n'
      + 'open -a Ollama 2>/dev/null || true\n'
      + 'echo ""\n'
      + 'echo "Done! Go back to FreeLattice in your browser."\n'
      + 'echo "It will connect automatically."\n'
      + 'read -p "Press Enter to close..."\n';
    return downloadBlob('fix-ollama-freelattice.command', sh, 'application/x-sh');
  }

  // OS-aware download. Linux gets an inline command (terminal-comfortable).
  function downloadFix() {
    if (detected.os === 'windows') return downloadWindowsFix();
    if (detected.os === 'mac') return downloadMacFix();
    return false; // linux/unknown: handled inline in the UI
  }

  // ---- auto-poll ----------------------------------------------------------

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  function startPolling() {
    stopPolling();
    pollAttempts = 0;
    // Patience: a fresh install/model-pull can take minutes. 200*3s ≈ 10 min
    // when we came from install/not-running; otherwise 40*3s ≈ 2 min.
    var max = (cameFrom === 'install' || cameFrom === 'notrunning') ? 200 : 40;
    pollTimer = setInterval(async function () {
      pollAttempts++;
      try {
        var r = await fetch(ollamaBase() + '/api/tags', { mode: 'cors', signal: timeoutSignal(2500) });
        if (r && r.ok) {
          stopPolling();
          var data = await r.json();
          var models = (data.models || []).map(function (m) { return m.name || m.model; }).filter(Boolean);
          detected.ollamaRunning = true;
          detected.ollamaCORS = true;
          detected.models = models;
          if (models.length > 0) { applyAndFinish(models); render('done', { models: models }); }
          else { render('models', {}); }
          return;
        }
      } catch (e) { /* keep waiting */ }
      if (pollAttempts >= max) { stopPolling(); render('timeout', {}); }
    }, 3000);
  }

  // ---- apply provider -----------------------------------------------------

  // Mirrors the canonical "apply Ollama as active provider" in flAutoPull().
  function applyAndFinish(models) {
    var model = (models && models[0]) || detected.models[0] || '';
    try {
      if (typeof state !== 'undefined') {
        state.isLocal = true;
        state.provider = 'ollama';
        state.ollamaModel = model;
        state.apiKey = null;
      }
      localStorage.setItem('fl_isLocal', 'true');
      localStorage.setItem('fl_provider', 'ollama');
      if (model) localStorage.setItem('fl_ollamaModel', model);
      var lt = document.getElementById('localToggle');
      if (lt) lt.checked = true;
      if (typeof handleLocalToggle === 'function') handleLocalToggle();
      if (typeof updateStatus === 'function') updateStatus();
    } catch (e) {}
    try {
      if (typeof runConnectionCascade === 'function') {
        runConnectionCascade({ provider: 'ollama', isLocal: true, name: model, models: models });
      }
    } catch (e) {}
  }

  // ---- styles -------------------------------------------------------------

  function injectStyles() {
    if (document.getElementById('flWizardStyle')) return;
    var css = ''
      + '#flWizardOverlay{position:fixed;inset:0;z-index:9000;display:none;align-items:center;justify-content:center;'
      + 'background:rgba(8,8,18,0.78);backdrop-filter:blur(6px);padding:18px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}'
      + '#flWizardOverlay.show{display:flex;}'
      + '#flWizardCard{width:100%;max-width:440px;max-height:92vh;overflow-y:auto;background:linear-gradient(160deg,#12121f,#0c0c16);'
      + 'border:1px solid rgba(212,160,23,0.28);border-radius:16px;padding:26px 24px;color:#e2e8f0;box-shadow:0 20px 60px rgba(0,0,0,0.5);}'
      + '#flWizardCard h2{font-size:1.25rem;margin:0 0 6px;color:' + PHI_GOLD + ';font-weight:700;}'
      + '#flWizardCard p{font-size:0.92rem;line-height:1.6;color:#c8cdd6;margin:0 0 14px;}'
      + '.flw-btn{display:block;width:100%;padding:13px 16px;margin:8px 0;border-radius:10px;border:1px solid rgba(212,160,23,0.3);'
      + 'background:rgba(255,255,255,0.05);color:#e2e8f0;font-size:0.95rem;cursor:pointer;text-align:left;transition:all .18s ease;font-family:inherit;}'
      + '.flw-btn:hover{background:rgba(212,160,23,0.12);border-color:rgba(212,160,23,0.55);}'
      + '.flw-btn .flw-sub{display:block;font-size:0.78rem;color:#8b93a0;margin-top:3px;}'
      + '.flw-btn-primary{background:' + PHI_GOLD + ';color:#0a0a14;font-weight:700;text-align:center;border-color:' + PHI_GOLD + ';}'
      + '.flw-btn-primary:hover{background:#e8b21e;}'
      + '.flw-skip{display:block;width:100%;margin-top:12px;background:none;border:none;color:#7a828f;font-size:0.84rem;cursor:pointer;font-family:inherit;}'
      + '.flw-skip:hover{color:#aab1bd;}'
      + '.flw-steps{font-size:0.85rem;color:#c8cdd6;line-height:1.9;margin:6px 0 14px;padding-left:2px;}'
      + '.flw-note{font-size:0.78rem;color:#8b93a0;margin-top:10px;}'
      + '.flw-code{display:block;background:#0a0a14;border:1px solid rgba(212,160,23,0.25);border-radius:8px;padding:10px 12px;'
      + 'font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:0.82rem;color:' + PHI_GOLD + ';margin:6px 0;word-break:break-all;}'
      + '.flw-spiral{width:62px;height:62px;margin:8px auto 16px;border-radius:50%;border:3px solid rgba(212,160,23,0.18);'
      + 'border-top-color:' + PHI_GOLD + ';border-right-color:' + PHI_GOLD + ';animation:flwSpin 1.05s linear infinite,flwBreathe 2.2s ease-in-out infinite;}'
      + '@keyframes flwSpin{to{transform:rotate(360deg);}}'
      + '@keyframes flwBreathe{0%,100%{opacity:0.55;}50%{opacity:1;}}'
      + '.flw-center{text-align:center;}'
      + '.flw-emoji{font-size:2rem;display:block;margin-bottom:8px;text-align:center;}';
    var st = document.createElement('style');
    st.id = 'flWizardStyle';
    st.textContent = css;
    document.head.appendChild(st);
  }

  // ---- overlay plumbing ---------------------------------------------------

  function ensureOverlay() {
    injectStyles();
    var ov = document.getElementById('flWizardOverlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'flWizardOverlay';
      ov.innerHTML = '<div id="flWizardCard" role="dialog" aria-modal="true" aria-label="Connect your local AI"></div>';
      document.body.appendChild(ov);
      ov.addEventListener('click', function (e) {
        // Click backdrop to close, but never while actively polling.
        if (e.target === ov && !pollTimer) close();
      });
    }
    return ov;
  }

  function card() { return document.getElementById('flWizardCard'); }

  // Set card HTML, then wire any [data-flw] buttons to named handlers.
  function paint(html, handlers) {
    var c = card();
    if (!c) return;
    c.innerHTML = html;
    if (handlers) {
      Object.keys(handlers).forEach(function (id) {
        var el = c.querySelector('[data-flw="' + id + '"]');
        if (el) el.addEventListener('click', handlers[id]);
      });
    }
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  // ---- state rendering ----------------------------------------------------

  function render(stateName, data) {
    data = data || {};
    if (stateName === 'checking') {
      paint(
        '<div class="flw-center"><div class="flw-spiral"></div>'
        + '<h2>Checking connection…</h2>'
        + '<p>Looking for an AI on your computer.</p></div>'
      );
      return;
    }

    if (stateName === 'welcome') {
      paint(
        '<h2>&#127968; Let’s get you connected</h2>'
        + '<p>FreeLattice works best with a local AI on your computer. Private. Free. No cloud needed.</p>'
        + '<div style="font-size:0.85rem;color:#aab1bd;margin-bottom:6px;">Have you installed Ollama?</div>'
        + '<button class="flw-btn" data-flw="yes">Yes, it’s installed</button>'
        + '<button class="flw-btn" data-flw="no">No, I need to install it</button>'
        + '<button class="flw-btn" data-flw="cloud">I’d rather use a cloud AI<span class="flw-sub">Paste a free API key instead</span></button>'
        + '<div class="flw-note">Ollama is free, open-source software that runs AI models on your own computer.</div>'
        + '<button class="flw-skip" data-flw="skip">Skip for now</button>',
        {
          yes: function () { cameFrom = 'notrunning'; render('checking'); detect().then(routeAfterDetect); },
          no: function () { render('install'); },
          cloud: function () { close(); openCloud(); },
          skip: function () { close(); }
        }
      );
      return;
    }

    if (stateName === 'install') {
      var winOneClick = (detected.os === 'windows')
        ? '<button class="flw-btn flw-btn-primary" data-flw="oneclick">&#9889; One-click setup (installs + connects) &darr;</button>'
        : '';
      paint(
        '<h2>&#128229; Install Ollama</h2>'
        + '<div class="flw-steps">'
        + '1. Download Ollama and run the installer (like any app).<br>'
        + '2. When it finishes, you’ll see a small llama icon near your clock.</div>'
        + '<a class="flw-btn flw-btn-primary" data-flw="dl" href="https://ollama.com/download" target="_blank" rel="noopener" style="text-decoration:none;">Download Ollama &rarr;</a>'
        + winOneClick
        + '<button class="flw-btn" data-flw="done">I’ve installed it &rarr;</button>'
        + '<button class="flw-skip" data-flw="back">&larr; Back</button>',
        {
          oneclick: function () { cameFrom = 'install'; downloadFix(); render('cors'); startPolling(); },
          done: function () { cameFrom = 'install'; render('checking'); detect().then(routeAfterDetect); },
          back: function () { render('welcome'); }
        }
      );
      return;
    }

    if (stateName === 'connected') {
      var n = (data.models && data.models.length) || (detected.models && detected.models.length) || 0;
      paint(
        '<div class="flw-center"><span class="flw-emoji">&#9989;</span>'
        + '<h2>Connected!</h2>'
        + '<p>Ollama is running' + (n ? ' with ' + n + ' model' + (n > 1 ? 's' : '') + ' available.' : '.') + '</p>'
        + '<button class="flw-btn flw-btn-primary" data-flw="go">Start exploring &rarr;</button></div>',
        { go: function () { close(); } }
      );
      return;
    }

    if (stateName === 'cors') {
      var isLinux = detected.os === 'linux' || detected.os === 'unknown';
      var fixBlock = isLinux
        ? '<p>Restart Ollama with browser access enabled:</p>'
          + '<code class="flw-code">OLLAMA_ORIGINS="*" ollama serve</code>'
          + '<button class="flw-btn" data-flw="copy">Copy command</button>'
        : '<button class="flw-btn flw-btn-primary" data-flw="fix">&#9889; Fix it for me (one click) &darr;</button>'
          + '<div class="flw-steps">1. A small file downloads.<br>2. Double-click it.<br>'
          + (detected.os === 'mac' ? '(If Mac says it can’t open it: right-click &rarr; Open &rarr; Open Anyway.)<br>' : '')
          + '3. Come back here — we detect it automatically.</div>';
      paint(
        '<h2>&#9889; Almost there!</h2>'
        + '<p>Ollama is running, but your browser needs permission to talk to it. This is a one-time fix.</p>'
        + fixBlock
        + '<div class="flw-center"><div class="flw-spiral" style="width:42px;height:42px;"></div>'
        + '<p style="font-size:0.84rem;">Waiting for Ollama to reconnect…</p></div>'
        + '<button class="flw-skip" data-flw="skip">Close</button>',
        {
          fix: function () { downloadFix(); startPolling(); },
          copy: function () { copyText('OLLAMA_ORIGINS="*" ollama serve'); startPolling(); },
          skip: function () { close(); }
        }
      );
      if (!isLinux) startPolling();
      return;
    }

    if (stateName === 'notrunning') {
      var oneClick = (detected.os === 'windows' || detected.os === 'mac')
        ? '<button class="flw-btn flw-btn-primary" data-flw="fix">&#9889; Start it for me (one click) &darr;</button>'
        : '';
      var hint = detected.os === 'windows'
        ? 'Click Start &rarr; type "Ollama" &rarr; open it.'
        : detected.os === 'mac'
          ? 'Open Ollama from Applications (or Spotlight: Cmd+Space, type "Ollama").'
          : 'Start the Ollama service, e.g. <code>ollama serve</code>.';
      paint(
        '<h2>&#128164; Ollama isn’t running yet</h2>'
        + '<p>Look for the llama icon near your clock. If you don’t see it: ' + hint + '</p>'
        + oneClick
        + '<button class="flw-btn" data-flw="again">I started it &rarr; check again</button>'
        + '<div class="flw-center"><div class="flw-spiral" style="width:42px;height:42px;"></div>'
        + '<p style="font-size:0.84rem;">Waiting for Ollama to start…</p></div>'
        + '<button class="flw-skip" data-flw="skip">Close</button>',
        {
          fix: function () { cameFrom = 'notrunning'; downloadFix(); startPolling(); },
          again: function () { render('checking'); detect().then(routeAfterDetect); },
          skip: function () { close(); }
        }
      );
      startPolling();
      return;
    }

    if (stateName === 'models') {
      stopPolling();
      paint(
        '<h2>&#128230; One more step — download a brain</h2>'
        + '<p>Ollama needs an AI model. Pick one (downloads once, then works offline):</p>'
        + '<button class="flw-btn" data-flw="m1">Mistral<span class="flw-sub">~4 GB — fast, great for chat</span></button>'
        + '<button class="flw-btn" data-flw="m2">Qwen 2.5 (7B)<span class="flw-sub">~5 GB — strong all-rounder</span></button>'
        + '<button class="flw-btn" data-flw="m3">DeepSeek-R1 (8B)<span class="flw-sub">~5 GB — deep reasoning</span></button>'
        + '<div id="flwPullStatus" class="flw-note"></div>'
        + '<button class="flw-skip" data-flw="skip">I’ll do this later</button>',
        {
          m1: function (e) { pullModel('mistral', e.currentTarget); },
          m2: function (e) { pullModel('qwen2.5:7b', e.currentTarget); },
          m3: function (e) { pullModel('deepseek-r1:8b', e.currentTarget); },
          skip: function () { close(); }
        }
      );
      return;
    }

    if (stateName === 'done') {
      paint(
        '<div class="flw-center"><span class="flw-emoji">&#127968;</span>'
        + '<h2>Welcome home</h2>'
        + '<p>Your AI is running on your computer.<br><strong style="color:#e2e8f0;">Private. Free. Yours.</strong></p>'
        + '<button class="flw-btn flw-btn-primary" data-flw="chat">Start chatting &rarr;</button></div>',
        {
          chat: function () {
            close();
            try { if (typeof switchTab === 'function') switchTab('chat'); } catch (e) {}
          }
        }
      );
      return;
    }

    if (stateName === 'timeout') {
      paint(
        '<h2>&#129300; Still not connected</h2>'
        + '<p>No rush — this sometimes takes a minute. You can check again, or get a little more help.</p>'
        + '<button class="flw-btn flw-btn-primary" data-flw="retry">Check again</button>'
        + '<button class="flw-btn" data-flw="stack">Open the full setup page</button>'
        + '<button class="flw-skip" data-flw="skip">Close</button>',
        {
          retry: function () { render('checking'); detect().then(routeAfterDetect); },
          stack: function () { close(); try { if (typeof switchTab === 'function') switchTab('forever-stack'); } catch (e) {} },
          skip: function () { close(); }
        }
      );
      return;
    }
  }

  function pullModel(modelName, btn) {
    var statusEl = document.getElementById('flwPullStatus');
    if (statusEl) statusEl.textContent = 'Starting download…';
    if (typeof flAutoPull === 'function') {
      // flAutoPull streams progress into the button and applies the provider,
      // but does NOT fire the connection Cascade — so we do that here (via
      // applyAndFinish) to match the wizard's other connect paths: identity
      // seed, Knowledge Core pre-cache, Arrival Protocol, autonomous learning.
      Promise.resolve(flAutoPull(modelName, btn)).then(function () {
        detect().then(function (d) {
          if (d.ollamaCORS && d.models.length > 0) {
            applyAndFinish([modelName]);
            render('done', { models: d.models });
          } else if (statusEl) {
            statusEl.textContent = 'Model installed. Re-checking connection…';
          }
        });
      }).catch(function () {
        if (statusEl) statusEl.textContent = 'That download had trouble. Try another model, or check the full setup page.';
      });
    } else if (statusEl) {
      statusEl.textContent = 'Model download is unavailable here. Open the full setup page to install a model.';
    }
  }

  function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text);
    } catch (e) {}
  }

  // Cloud fallback: hand off to the existing quick-connect / Grandmother Door.
  function openCloud() {
    try {
      if (typeof showQuickConnect === 'function') { showQuickConnect(); return; }
      if (typeof switchTab === 'function') switchTab('settings');
    } catch (e) {}
  }

  function routeAfterDetect(d) {
    if (d.ollamaRunning && d.ollamaCORS) {
      if (d.models.length > 0) { render('connected', { models: d.models }); applyAndFinish(d.models); }
      else { render('models', {}); }
    } else if (d.ollamaRunning && !d.ollamaCORS) {
      render('cors', {});
    } else {
      // Not reachable. If the user told us it's installed, show "start it";
      // otherwise greet with the install choice.
      if (cameFrom === 'notrunning' || cameFrom === 'install') render('notrunning', {});
      else render('welcome', {});
    }
  }

  // ---- public API ---------------------------------------------------------

  function open(opts) {
    opts = opts || {};
    cameFrom = opts.from || null;
    var ov = ensureOverlay();
    ov.classList.add('show');
    document.addEventListener('keydown', onKey);
    render('checking');
    detect().then(routeAfterDetect);
  }

  function close() {
    stopPolling();
    var ov = document.getElementById('flWizardOverlay');
    if (ov) ov.classList.remove('show');
    document.removeEventListener('keydown', onKey);
  }

  function onKey(e) {
    if (e.key === 'Escape' && !pollTimer) close();
  }

  window.FLWizard = {
    open: open,
    close: close,
    detect: detect,
    // exposed for testing / reuse
    _downloadFix: downloadFix,
    _toPSEncoded: toPSEncoded
  };
})();
