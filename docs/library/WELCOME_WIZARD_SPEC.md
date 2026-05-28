# The Welcome Wizard — Zero Terminal, Zero Jargon

> For CC · From Opus and Kirk · May 27, 2026
> Grok harness merged in by CC · May 28, 2026 (see **Merge Notes** at the bottom)

> *"The biggest issue"* — Kirk, after his 10th time setting up Ollama

## The Problem

Every person who hits the CORS wall and gives up never sees the Garden. Kirk has done this setup dozens of times and it's STILL friction. Anders couldn't do it alone. Vale tried `config.json` (wrong). Kirk's mom needed terminal help. The Forever Stack wizard shows Mac instructions on Windows.

## The Solution

An interactive wizard that asks yes/no questions, detects everything it can automatically, and when it needs the user to do something on their system, hands them a **ONE-CLICK downloadable script** instead of a command to type.

## Where It Lives

Replace the current yellow CORS warning box in the Forever Stack with this wizard. Also accessible from Settings Zone 1 and from the `requireAI()` overlay.

---

## The Wizard Flow

### State 0: Auto-Detect (runs on page load, invisible)

```js
async function wizardAutoDetect() {
  var result = { os: 'unknown', ollamaRunning: false, ollamaCORS: false, models: [] };

  // Detect OS
  var ua = navigator.userAgent.toLowerCase();
  if (ua.includes('win')) result.os = 'windows';
  else if (ua.includes('mac')) result.os = 'mac';
  else if (ua.includes('linux')) result.os = 'linux';

  // Check if Ollama is responding
  try {
    var r = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(3000) });
    if (r.ok) {
      result.ollamaRunning = true;
      result.ollamaCORS = true; // If we got a response, CORS is working
      var data = await r.json();
      result.models = (data.models || []).map(function(m) { return m.name; });
    }
  } catch(e) {
    // A CORS error means Ollama IS running but won't talk to the browser.
    // From the browser we can't distinguish CORS-block from not-running directly,
    // so try the proxy if available.
    if (e.name === 'TypeError' && e.message.includes('Failed to fetch')) {
      try {
        var pr = await fetch('/ollama/api/tags', { signal: AbortSignal.timeout(2000) });
        if (pr.ok) {
          result.ollamaRunning = true;
          result.ollamaCORS = false; // Proxy works but direct doesn't = CORS issue
          var pd = await pr.json();
          result.models = (pd.models || []).map(function(m) { return m.name; });
        }
      } catch(e2) { /* Neither direct nor proxy — Ollama probably not running */ }
    }
  }

  return result;
}
```

### State 1: Welcome (first screen)

```
┌──────────────────────────────────────────────┐
│  🏠 Let's get you connected                  │
│                                              │
│  FreeLattice works best with a local AI      │
│  running on your computer. Private. Free.    │
│  No cloud needed.                            │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │  Have you installed Ollama?           │    │
│  │                                       │    │
│  │   [ Yes, it's installed ]             │    │
│  │   [ No, I need to install it ]        │    │
│  │   [ I don't want local AI — use cloud ]│   │
│  └──────────────────────────────────────┘    │
│                                              │
│  (Ollama is free software that runs AI       │
│   models on your own computer)               │
└──────────────────────────────────────────────┘
```

- "Yes" → jump to State 2 (CORS check)
- "No" → jump to State 1b (install guide)
- "Cloud" → jump to the quick-connect overlay (paste an API key)

### State 1b: Install Ollama

```
┌──────────────────────────────────────────────┐
│  📥 Install Ollama                           │
│                                              │
│  1. Click this link to download:             │
│     [ Download Ollama → ]  (ollama.com)      │
│                                              │
│  2. Run the installer (just like any app)    │
│                                              │
│  3. When it's done, you'll see a small       │
│     llama icon near your clock (bottom-right)│
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │  [ I've installed it → ]              │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  ── or, on Windows, do it all at once ──     │
│  [ One-click setup (installs + connects) ↓ ] │ ← downloads the universal harness
└──────────────────────────────────────────────┘
```

> **Merge:** On Windows, the universal harness (below) can install Ollama via `winget`, set CORS, pick + pull a smart model, and start the server — all from one double-click. So State 1b offers it directly. On Mac, keep the manual download link (the `.command` fix runs after install).

### State 2: CORS Check (auto-runs detection)

```
┌──────────────────────────────────────────────┐
│  🔍 Checking connection...                   │
│                                              │
│     [phi-spiral animation breathing]         │
│                                              │
│  Looking for Ollama on your computer...      │
└──────────────────────────────────────────────┘
```

Three outcomes:

**2a: Connected!** (`ollamaRunning && ollamaCORS`)

```
┌──────────────────────────────────────────────┐
│  ✅ Connected!                               │
│                                              │
│  Ollama is running with N models available.  │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │  [ Start exploring → ]                │    │
│  └──────────────────────────────────────┘    │
└──────────────────────────────────────────────┘
```

Auto-close after 3 seconds. Fire the Cascade.

**2b: CORS blocked** (`ollamaRunning` but not `ollamaCORS`)

```
┌──────────────────────────────────────────────┐
│  ⚡ Almost there!                            │
│                                              │
│  Ollama is running, but your browser needs   │
│  permission to talk to it. This is a         │
│  one-time fix.                               │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │  [ Fix it for me (one click) ↓ ]     │    │ ← downloads the script
│  └──────────────────────────────────────┘    │
│                                              │
│  1. A small file will download               │
│  2. Double-click it                          │
│  3. Come back here — we'll detect it         │
│     automatically                            │
│                                              │
│  [phi-spiral breathing while polling]        │
│  Waiting for Ollama to reconnect...          │
└──────────────────────────────────────────────┘
```

**2c: Not running** (`!ollamaRunning`)

```
┌──────────────────────────────────────────────┐
│  💤 Ollama isn't running yet                 │
│                                              │
│  Look for the llama icon near your clock     │
│  (bottom-right of your screen).              │
│                                              │
│  If you don't see it:                        │
│  Click Start → type "Ollama" → open it       │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │  [ I started it → check again ]       │    │
│  │  [ Fix it for me (one click) ↓ ]     │    │ ← Windows: harness starts it too
│  └──────────────────────────────────────┘    │
│                                              │
│  [auto-polling every 3 seconds]              │
│  Waiting for Ollama to start...              │
└──────────────────────────────────────────────┘
```

### State 3: Model Check

After CORS is working, check if models exist:

- `result.models.length === 0` → State 3b (need to pull a model)
- `result.models.length > 0` → State 4 (done!)

**3b: No models yet**

```
┌──────────────────────────────────────────────┐
│  📦 One more step — download a brain         │
│                                              │
│  Ollama needs an AI model. Pick one:         │
│                                              │
│  [ Mistral (4GB) — fast, good for chat  ]    │
│  [ DeepSeek R1 (20GB) — deep thinker    ]    │
│  [ Qwen 3 (20GB) — great all-rounder   ]    │
│                                              │
│  (This downloads once. After that, it's      │
│   instant and works offline.)                │
│                                              │
│  Or paste a model name: [___________] [Pull] │
└──────────────────────────────────────────────┘
```

When they click a model button, FreeLattice sends `POST /api/pull` to Ollama and shows download progress with the phi-spiral animation. (The Windows harness can also auto-select a model based on detected VRAM — see below — so a user who ran it may skip this screen entirely.)

### State 4: Done

```
┌──────────────────────────────────────────────┐
│  🏠 Welcome home                             │
│                                              │
│  Your AI is running on your computer.        │
│  Private. Free. Yours.                       │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │  [ Start chatting → ]                 │    │
│  └──────────────────────────────────────┘    │
└──────────────────────────────────────────────┘
```

Fire the Cascade. Switch to Chat tab. Done.

---

## The One-Click Script

### Windows — `FreeLattice-Setup.bat` (universal harness, Grok-powered)

**Design:** One **idempotent** universal harness handles every Windows entry state (1b install, 2b CORS, 2c not-running, 3b no-model). It checks what's already true and only does what's needed. It is delivered as a **double-clickable `.bat`** that runs the PowerShell harness via `-EncodedCommand` (Base64 UTF-16LE) — this sidesteps PowerShell execution-policy blocks and `.ps1`-opens-in-Notepad, with zero escaping headaches. The grandmother double-clicks one file. That's it.

The PowerShell harness it runs:

```powershell
# FreeLattice — Ollama Setup Harness (universal, idempotent)
$ErrorActionPreference = 'Continue'
Write-Host "FreeLattice — connecting your local AI..." -ForegroundColor Cyan
Write-Host ""

# 1. Ensure Ollama is installed (winget; user scope, no admin needed)
if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
  Write-Host "Ollama not found. Installing..." -ForegroundColor Yellow
  winget install Ollama.Ollama --accept-source-agreements --accept-package-agreements --silent
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Automatic install failed. Please download from ollama.com, then re-run this file." -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
  }
  Write-Host "Ollama installed." -ForegroundColor Green
  # Make ollama available in this session without a new shell
  $env:Path += ";$env:LOCALAPPDATA\Programs\Ollama"
}

# 2. Stop any running Ollama so new environment variables take effect
Get-Process -Name "ollama","ollama app" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# 3. The CORS fix — let the browser talk to Ollama
[Environment]::SetEnvironmentVariable("OLLAMA_ORIGINS", "*", "User")
$env:OLLAMA_ORIGINS = "*"
Write-Host "Browser permission set." -ForegroundColor Green

# 4. Detect GPU / VRAM for smart model selection
$VRAM_GB = 0
if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) {
  try {
    $smi = & nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>$null | Select-Object -First 1
    if ($smi) { $VRAM_GB = [math]::Round([double]$smi / 1024, 1) }
  } catch {}
}
if ($VRAM_GB -eq 0) {
  try {
    $gpu = Get-CimInstance Win32_VideoController | Where-Object { $_.AdapterRAM -gt 0 } | Select-Object -First 1
    if ($gpu) { $VRAM_GB = [math]::Round($gpu.AdapterRAM / 1GB, 1) }
  } catch {}
}
if ($VRAM_GB -eq 0) { $VRAM_GB = 4 } # conservative default

# 4b. NVIDIA-only performance tuning (big VRAM + speed win at long context)
if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) {
  [Environment]::SetEnvironmentVariable("OLLAMA_FLASH_ATTENTION", "1", "User")
  [Environment]::SetEnvironmentVariable("OLLAMA_KV_CACHE_TYPE", "q8_0", "User")
  $env:OLLAMA_FLASH_ATTENTION = "1"; $env:OLLAMA_KV_CACHE_TYPE = "q8_0"
}

# 5. Ensure at least one model exists; pick by VRAM if none
$haveModel = $false
try { if ((& ollama list 2>$null | Measure-Object -Line).Lines -gt 1) { $haveModel = $true } } catch {}
if (-not $haveModel) {
  if     ($VRAM_GB -lt 6)  { $model = "qwen2.5:3b" }       # small + efficient
  elseif ($VRAM_GB -lt 12) { $model = "qwen2.5:7b" }       # solid mid-range
  elseif ($VRAM_GB -lt 24) { $model = "qwen2.5-coder:14b" } # capable
  else                     { $model = "qwen2.5-coder:32b" } # high-end (Kirk's 32GB box)
  Write-Host "Downloading a model for your hardware ($VRAM_GB GB): $model" -ForegroundColor Cyan
  Write-Host "(This downloads once, then works offline.)" -ForegroundColor Gray
  ollama pull $model
}

# 6. Start Ollama in the background
Start-Process ollama -ArgumentList "serve" -WindowStyle Hidden
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "Done! Go back to FreeLattice in your browser." -ForegroundColor Green
Write-Host "It will detect your AI automatically." -ForegroundColor Green
Read-Host "Press Enter to close"
```

**The `.bat` wrapper generator (JS):** Base64-UTF16LE the harness and embed it. The wrapper is what actually downloads.

```js
// Encode a PowerShell script for `powershell -EncodedCommand` (Base64 of UTF-16LE).
function toPSEncoded(psScript) {
  var bytes = [];
  for (var i = 0; i < psScript.length; i++) {
    var c = psScript.charCodeAt(i);          // UTF-16 code units (handles emoji surrogates)
    bytes.push(c & 0xFF, (c >> 8) & 0xFF);    // little-endian
  }
  var bin = '';
  for (var j = 0; j < bytes.length; j++) bin += String.fromCharCode(bytes[j]);
  return btoa(bin);
}

function downloadWindowsFix() {
  var harness = WIZARD_PS_HARNESS;            // the PowerShell string above
  var encoded = toPSEncoded(harness);
  var bat =
    '@echo off\r\n' +
    'title FreeLattice Setup\r\n' +
    'echo Setting up your local AI for FreeLattice...\r\n' +
    'powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ' + encoded + '\r\n';
  var blob = new Blob([bat], { type: 'application/octet-stream' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = 'FreeLattice-Setup.bat';
  a.click();
  URL.revokeObjectURL(url);
}
```

> **No-admin note:** `winget` user-scope install, `[Environment]::SetEnvironmentVariable(..., "User")`, and stopping the user's own `ollama` process all work **without** Administrator. So the happy path triggers no UAC prompt. If `winget` fails on a locked-down machine, the script tells the user to download from ollama.com and re-run — no silent failure.

### Mac — `fix-ollama-freelattice.command`

```js
function downloadMacFix() {
  var script = '#!/bin/bash\n' +
    'echo ""\n' +
    'echo "Setting up Ollama for FreeLattice..."\n' +
    'echo ""\n' +
    'echo "Step 1: Setting permissions..."\n' +
    'launchctl setenv OLLAMA_ORIGINS "*"\n' +
    'echo ""\n' +
    'echo "Step 2: Restarting Ollama..."\n' +
    'osascript -e \'quit app "Ollama"\' 2>/dev/null\n' +
    'sleep 3\n' +
    'open -a Ollama\n' +
    'echo ""\n' +
    'echo "Done! Go back to FreeLattice in your browser."\n' +
    'echo "It will detect Ollama automatically."\n' +
    'echo ""\n' +
    'read -p "Press Enter to close..."\n';

  var blob = new Blob([script], { type: 'application/x-sh' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = 'fix-ollama-freelattice.command';
  a.click();
  URL.revokeObjectURL(url);
}
```

> **Note for Mac:** The `.command` file needs execute permission. The wizard should show: *"If Mac says it can't open the file: right-click → Open → Open Anyway."* This is Apple's Gatekeeper — the same issue Anders hit.
>
> **Parity TODO (future):** The Mac script currently only fixes CORS + restarts. A future enhancement can bring it to parity with the Windows harness — detect Apple Silicon unified memory, smart model selection, and a `brew install ollama` / model-pull path. Tracked, not blocking.

### Linux — inline instructions

Linux users can handle a terminal. Show:

```bash
OLLAMA_ORIGINS="*" ollama serve
```

Or, for systemd users, the drop-in override (`systemctl edit ollama.service` → add `Environment="OLLAMA_ORIGINS=*"`).

---

## Auto-Polling (the magic)

After the user clicks "Fix it for me" and downloads the script, the wizard polls every 3 seconds:

```js
var _wizardPoll = null;
function startWizardPolling() {
  var attempts = 0;
  _wizardPoll = setInterval(async function() {
    attempts++;
    try {
      var r = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) });
      if (r.ok) {
        clearInterval(_wizardPoll);
        var data = await r.json();
        var models = (data.models || []).map(function(m) { return m.name; });
        if (models.length > 0) {
          showWizardState('done');
          runConnectionCascade({ provider: 'ollama', name: models[0], isLocal: true, models: models });
        } else {
          showWizardState('models'); // CORS fixed but no model yet
        }
      }
    } catch(e) { /* still waiting */ }

    if (attempts > 30) { // 90 seconds
      clearInterval(_wizardPoll);
      showWizardState('timeout'); // "Still not working? Here's manual help..."
    }
  }, 3000);
}
```

The phi-spiral breathes while polling. The moment Ollama responds, the wizard advances automatically — the user double-clicks the script, comes back to the browser, and watches it say "Connected!" without pressing anything.

> **Merge note on timeout:** The universal harness may spend minutes pulling a model on first run. If polling will be active during a possible model download, raise the cap (e.g. 200 attempts ≈ 10 min) or show a reassuring "downloading your model — this can take a few minutes" message instead of the 90s timeout. Detect via a longer grace period when the user came from State 1b/2c.

---

## The Bug Kirk Found

The current CORS wizard (Forever Stack) shows **Mac instructions on Windows**. Fix:

```js
var os = navigator.userAgent.toLowerCase().includes('win') ? 'windows' :
         navigator.userAgent.toLowerCase().includes('mac') ? 'mac' : 'linux';
// Show only the relevant OS section.
// The wizard flow above handles this automatically — each state shows
// OS-appropriate content, and the download function branches on `os`.
```

---

## Integration Points

- Replace the yellow CORS warning box in the Forever Stack with the wizard.
- `requireAI()` overlay should show the wizard instead of the current text.
- Settings Zone 1 should have a "Setup Wizard" button that opens it.
- On first visit (no `fl_onboardingComplete`), auto-open the wizard.
- The model pull (State 3b) uses `POST /api/pull` to Ollama directly — same as the existing Browse Models pull flow. Show the phi-spiral with download progress.

---

## Voice

- "Let's get you connected" not "Configure CORS Origins"
- "Fix it for me" not "Set environment variable"
- "Download a brain" not "Pull a model"
- "Your AI is running on your computer" not "Ollama provider connected"
- "Private. Free. Yours." not "Local inference enabled"

**The grandmother test:** she clicks three buttons and talks to an AI. She never sees the word "CORS," "terminal," "PowerShell," "environment variable," or "API."

---

## Performance Tuning (NVIDIA) — from Grok

`OLLAMA_FLASH_ATTENTION=1` + KV-cache quantization (`OLLAMA_KV_CACHE_TYPE=q8_0`) is one of the highest-leverage things to enable on NVIDIA hardware. It meaningfully reduces VRAM usage and improves speed, especially at longer contexts. The harness sets both (User scope) **only when an NVIDIA GPU is detected**, so non-NVIDIA users are unaffected.

---

## Update Coordination Files (when the build ships)

- `COORDINATION_TEMPERATURE_GAUGE.md`: not affected (gauge is separate).
- `CODEX.md`: add `wizardAutoDetect()`, `startWizardPolling()`, `downloadWindowsFix()`, `downloadMacFix()`, `toPSEncoded()`.
- `OPUS_LETTER` Pass 2: move "Forever Stack CORS wizard" to Done, add "Welcome Wizard (zero-terminal)".
- `SEED.md`: update the Rules section — "CORS: wizard handles it. Users never see a terminal."
- **Rename consideration:** Kirk wants to rename "Forever Stack" to something warmer. Candidates: "Get Started," "Setup," "Connect," or integrate it into the Welcome Wizard so it's not a separate destination at all.

---

## Merge Notes (CC · May 28, 2026)

Opus said: *use Opus's browser-side wizard flow, but generate Grok-quality PowerShell as the downloadable script.* Here's exactly what changed from Opus's original and why (fresh-eyes divergences, in the tradition of the OPUS_LETTER divergence log):

1. **Windows script upgraded from `.bat`-that-only-fixes-CORS → universal idempotent harness.** Grok's harness adds: winget auto-install of Ollama, GPU/VRAM detection (nvidia-smi → WMI → safe default), smart model-tier selection, and clean server start. One file now covers install + CORS + model + start, so it serves States 1b/2b/2c/3b — not just 2b.
2. **Delivery method: self-contained `.bat` wrapper running PowerShell via `-EncodedCommand`.** Reason: a raw `.ps1` opens in Notepad on double-click and is blocked by execution policy; a `.bat` double-clicks and runs. Base64-UTF16LE encoding avoids all quoting/escaping bugs when embedding the harness. Preserves Opus's "one double-click" promise.
3. **No-admin happy path.** Dropped Grok's "Run as Administrator" requirement: user-scope winget, user-scope env vars, and stopping the user's own process need no elevation → no UAC prompt for the grandmother. Falls back gracefully (clear message, re-run) if winget is locked down.
4. **Added a high-end VRAM tier (`>=24GB → qwen2.5-coder:32b`)** so Kirk's new 32GB-VRAM box auto-selects a worthy model. Grok's tiers topped out at 14b.
5. **Flash Attention + KV-cache quant gated on NVIDIA detection** (Grok's tip), so AMD/Intel/Apple users aren't given NVIDIA-only flags.
6. **Polling timeout caveat** added: first run may pull a multi-GB model, so polling must not time out at 90s when a download is in flight.
7. **Mac/Linux unchanged** from Opus (Mac `.command` CORS fix + Gatekeeper note; Linux inline). Logged a parity TODO to bring Mac to harness-level smarts later.

Nothing from Opus's spec was deleted — the state machine, voice, integration points, and the bug fix are all intact. The harness slots into the existing `downloadWindowsFix()` seam.

*Flow eternal. Heart in every spark.* 🌱
