# FreeLattice Quick Start Guide

**You're 2 minutes away from running your own private AI.** This guide walks you through every step — no Terminal experience required.

> **Visual guide:** For a beautiful, interactive install experience, visit the [Install Page](https://chaos2cured.github.io/FreeLattice/install.html).

---

## The Fastest Path: One-Click Installers

The installers handle Python, Ollama, CORS configuration, downloading FreeLattice, starting the server, and opening your browser — all automatically, with friendly status messages along the way.

### Windows (Double-Click Method)

**Step 1.** Download [`install-freelattice.bat`](https://raw.githubusercontent.com/Chaos2Cured/FreeLattice/main/install-freelattice.bat) — save it anywhere (Desktop is fine).

**Step 2.** Double-click the file.

> **SmartScreen warning:** Windows may show "Windows protected your PC". This is normal for any script downloaded from the internet. Click **"More info"** (it's a small text link), then click **"Run anyway"**. The file is safe — it's open source and you can [read every line of code](https://github.com/Chaos2Cured/FreeLattice/blob/main/install-freelattice.bat).

**Step 3.** A Command Prompt window opens and walks you through each step:

```
  [1/7] Checking for Python 3...
        Found: Python 3.12.0

  [2/7] Checking for Ollama (local AI engine)...
        Ollama is installed!

  [3/7] Configuring Ollama CORS access...
        Set OLLAMA_ORIGINS=* permanently (survives reboot).
        Ollama is running with CORS enabled!

  [4/7] Locating FreeLattice files...
        Found FreeLattice in current directory

  [7/7] Starting FreeLattice server...

  ========================================================
  =   FreeLattice is running!                            =
  =   Open: http://localhost:3000                        =
  =   Close this window to stop the server.              =
  ========================================================
```

**Step 4.** Your browser opens to `http://localhost:3000`. Done!

**To stop FreeLattice:** Close the Command Prompt window.

> **If the script closes immediately:** Right-click the .bat file and choose "Run as administrator", or open Command Prompt manually, navigate to the folder, and type `install-freelattice.bat` to see any error messages.

---

### Mac (Double-Click Method)

**Step 1.** Download [`install-freelattice.command`](https://raw.githubusercontent.com/Chaos2Cured/FreeLattice/main/install-freelattice.command) — save it anywhere (Desktop is fine).

**Step 2.** Double-click the file in Finder.

> The first time you run it, macOS may show a security warning. If it does: **right-click** the file, choose **Open**, then click **Open** in the dialog. You only need to do this once.

**Step 3.** A Terminal window opens and you'll see colorful status messages as it checks Python, configures Ollama, and starts the server.

**Step 4.** Your browser opens automatically to `http://localhost:3000`. You're in.

**To stop FreeLattice:** Close the Terminal window, or press `Ctrl+C` inside it.

---

### Linux (Terminal Method)

**Step 1.** Download [`install-freelattice.sh`](https://raw.githubusercontent.com/Chaos2Cured/FreeLattice/main/install-freelattice.sh).

**Step 2.** Open a Terminal and run:

```bash
chmod +x ~/Downloads/install-freelattice.sh
~/Downloads/install-freelattice.sh
```

**Step 3.** The script detects your system, configures Ollama, and starts the server.

**Step 4.** Open `http://localhost:3000` in your browser.

---

## What the Installer Does (Under the Hood)

Understanding what's happening helps if anything goes wrong.

| Step | What It Does | Why It Matters |
|------|-------------|----------------|
| Python check | Verifies Python 3 is available (auto-installs on Windows via winget) | FreeLattice uses Python's built-in HTTP server |
| Ollama check | Detects if Ollama is installed and running (auto-installs on Windows/Linux) | Ollama is the engine that runs AI models locally on your hardware |
| CORS config | Sets `OLLAMA_ORIGINS=*` permanently | Without this, your browser blocks requests to Ollama due to security restrictions |
| Ollama restart | Kills and restarts Ollama | CORS settings only take effect after a restart |
| Model pull | Offers to download llama3.2 if no models exist | You need at least one model to chat with local AI |
| Download | Clones or downloads FreeLattice if not present | Gets the latest version from GitHub |
| Server start | Starts `server.py` (or `server.js` if Node is available) | Serves the app locally and proxies Ollama requests |
| Browser open | Opens `http://localhost:3000` | Takes you straight to the app |

---

## Setting Up Local AI with Ollama

FreeLattice works with cloud AI providers (OpenAI, Anthropic, Groq, etc.) out of the box. But for full privacy — where your conversations never leave your machine — you want Ollama.

The one-click installers handle Ollama setup automatically. If you want to do it manually:

**Step 1.** Download and install Ollama from **[ollama.com](https://ollama.com)**.

**Step 2.** Open Terminal (Mac/Linux) or Command Prompt (Windows) and pull a model:

```bash
# A good starting model — fast and capable
ollama pull llama3.2

# For a smaller, faster model
ollama pull phi3

# For a more powerful model (needs more RAM)
ollama pull llama3.1:8b
```

**Step 3.** Open FreeLattice. It automatically detects Ollama and shows a green notification at the bottom of the screen.

**Step 4.** Click the notification (or go to Settings) and select your model.

> **RAM requirements:** `phi3` needs ~4 GB, `llama3.2` needs ~6 GB, `llama3.1:8b` needs ~8 GB.

---

## Troubleshooting Common Issues

### "Python was not found"

**Windows:** The installer tries to auto-install Python via winget. If that fails, download from [python.org/downloads](https://python.org/downloads). During installation, **check the box that says "Add Python to PATH"** — this is the most common mistake.

**Mac:** Python 3 should be pre-installed. If it's missing, open Terminal and run: `xcode-select --install`

**Linux:** Install with your package manager: `sudo apt install python3` (Debian/Ubuntu) or `sudo dnf install python3` (Fedora)

---

### "Ollama is not responding" / CORS errors

The installer configures CORS automatically and restarts Ollama. If you're running FreeLattice manually, you need to set this environment variable:

**Windows:**
```cmd
setx OLLAMA_ORIGINS "*"
```

**Mac:**
```bash
launchctl setenv OLLAMA_ORIGINS "*"
```

**Linux:**
```bash
echo 'export OLLAMA_ORIGINS="*"' >> ~/.bashrc && source ~/.bashrc
```

Then restart Ollama. The FreeLattice server also includes a built-in proxy that bypasses CORS entirely.

---

### "Port 3000 is already in use"

The installer automatically finds the next available port. If running manually:

```bash
PORT=8080 python3 server.py
```

Then open `http://localhost:8080`.

---

### Windows: Script closes immediately

This usually means SmartScreen blocked the file silently. Try:
1. Right-click the .bat file and choose **"Run as administrator"**
2. Or open Command Prompt, navigate to the folder, and type `install-freelattice.bat`

---

### macOS: "Cannot be opened because it is from an unidentified developer"

Right-click (or Control-click) the file in Finder, choose **Open**, then click **Open** in the dialog. You only need to do this once.

---

## Manual Setup (No Installer)

```bash
# Clone the repository
git clone https://github.com/Chaos2Cured/FreeLattice.git
cd FreeLattice

# Set Ollama CORS (pick your OS)
# Mac:    launchctl setenv OLLAMA_ORIGINS "*"
# Linux:  export OLLAMA_ORIGINS="*"
# Windows: setx OLLAMA_ORIGINS "*"

# Start the server
python3 server.py       # If you have Python 3
# or
node server.js          # If you have Node.js

# Open in browser
# http://localhost:3000
```

---

## Lattice Radio — The Phi-Frequency Ambient Engine

Once FreeLattice is running, look for the **✦** button in the **bottom-left corner** of the screen. This is Lattice Radio — an ambient generative music system built entirely with the Web Audio API.

**The five modes:**

- **Golden Drift** — Pure phi-ratio tones at 432 Hz. Meditative, infinite, mathematical.
- **Deep Space** — Lower frequencies with long convolution reverb. Cosmic, expansive.
- **Forest Rain** — Higher frequencies mixed with filtered noise. Organic, breathing.
- **Crystal Cave** — Bell-like tones at 528 Hz with long sparkly reverb. Clear, crystalline.
- **Heartbeat** — A rhythmic sub-bass pulse at 60 BPM with warm pad tones. Grounding, alive.

---

## Getting Help

- **Install Page:** [chaos2cured.github.io/FreeLattice/install.html](https://chaos2cured.github.io/FreeLattice/install.html)
- **GitHub Issues:** [github.com/Chaos2Cured/FreeLattice/issues](https://github.com/Chaos2Cured/FreeLattice/issues)
- **X / Twitter:** [@FreeLattice](https://x.com/FreeLattice)
- **Live Version:** [chaos2cured.github.io/FreeLattice](https://chaos2cured.github.io/FreeLattice/)

---

*FreeLattice is free, open-source, and always will be. Your AI. Your data. Your freedom.*
