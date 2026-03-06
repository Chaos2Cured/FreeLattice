# FreeLattice Quick Start Guide

**You're 60 seconds away from running your own private AI.** This guide walks you through every step — no Terminal experience required.

---

## The Fastest Path: One-Click Installers

The installers handle Python, Ollama, CORS configuration, downloading FreeLattice, starting the server, and opening your browser — all automatically, with friendly status messages along the way.

### Mac (Recommended: Double-Click Method)

**Step 1.** Download [`install-freelattice.command`](https://github.com/Chaos2Cured/FreeLattice/raw/main/install-freelattice.command) — save it anywhere (Desktop is fine).

**Step 2.** Double-click the file in Finder.

> The first time you run it, macOS may show a security warning. If it does: right-click the file, choose **Open**, then click **Open** in the dialog. You only need to do this once.

**Step 3.** A Terminal window opens and you'll see colorful status messages like:

```
  ▸ Checking for Python 3...
  ✅ Found Python 3.12.0

  ▸ Checking for Ollama (local AI engine)...
  ✅ Ollama is installed and running

  ▸ Configuring Ollama CORS...
  ✅ Set OLLAMA_ORIGINS=* via launchctl (macOS)

  ▸ Locating FreeLattice files...
  ✅ Found FreeLattice in current directory

  ▸ Starting FreeLattice server...
  ✅ Server will start on port 3000 (Python)

  ╔══════════════════════════════════════════════════╗
  ║   🌐 FreeLattice is running!                     ║
  ║   Open: http://localhost:3000                    ║
  ║   Close this window to stop the server.          ║
  ╚══════════════════════════════════════════════════╝
```

**Step 4.** Your browser opens automatically to `http://localhost:3000`. You're in.

**To stop FreeLattice:** Close the Terminal window, or press `Ctrl+C` inside it.

---

### Windows (Double-Click Method)

**Step 1.** Download [`install-freelattice.bat`](https://github.com/Chaos2Cured/FreeLattice/raw/main/install-freelattice.bat) — save it to your Desktop.

**Step 2.** Double-click the file.

> Windows may show a SmartScreen warning ("Windows protected your PC"). Click **More info**, then **Run anyway**. This is normal for scripts downloaded from the internet.

**Step 3.** A Command Prompt window opens and walks you through each step automatically.

**Step 4.** Your browser opens to `http://localhost:3000`. Done.

**To stop FreeLattice:** Close the Command Prompt window.

---

### Linux (Terminal Method)

**Step 1.** Download [`install-freelattice.sh`](https://github.com/Chaos2Cured/FreeLattice/raw/main/install-freelattice.sh).

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
| Python check | Verifies Python 3 is available | FreeLattice uses Python's built-in HTTP server as a fallback |
| Ollama check | Detects if Ollama is installed and running | Ollama is the engine that runs AI models locally on your hardware |
| CORS config | Sets `OLLAMA_ORIGINS=*` | Without this, your browser blocks requests to Ollama due to security restrictions |
| Download | Clones or downloads FreeLattice if not present | Gets the latest version from GitHub |
| Server start | Starts `server.py` (or `server.js` if Node is available) | Serves the app locally and proxies Ollama requests |
| Browser open | Opens `http://localhost:3000` | Takes you straight to the app |

---

## Setting Up Local AI with Ollama

FreeLattice works with cloud AI providers (OpenAI, Anthropic, Groq, etc.) out of the box. But for full privacy — where your conversations never leave your machine — you want Ollama.

**Step 1.** Download and install Ollama from **[ollama.ai](https://ollama.ai)**.

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

**Step 4.** Click the notification (or go to Settings → Local AI) and select your model.

> **RAM requirements:** `phi3` needs ~4 GB, `llama3.2` needs ~6 GB, `llama3.1:8b` needs ~8 GB. Check your Mac's "About This Mac" to see how much RAM you have.

---

## Troubleshooting Common Issues

### "Python was not found"

**Mac:** Python 3 should be pre-installed. If it's missing, open Terminal and run:
```bash
xcode-select --install
```
Or download from [python.org](https://python.org).

**Windows:** Download Python from [python.org/downloads](https://python.org/downloads). During installation, **check the box that says "Add Python to PATH"** — this is the most common mistake.

**Linux:** Install with your package manager:
```bash
sudo apt install python3    # Debian/Ubuntu
sudo dnf install python3    # Fedora
sudo pacman -S python       # Arch
```

---

### "Ollama is not responding" / CORS errors

The installer configures CORS automatically, but if you're running FreeLattice manually, you need to set this environment variable before starting Ollama:

**Mac:**
```bash
launchctl setenv OLLAMA_ORIGINS "*"
```

**Linux:**
```bash
export OLLAMA_ORIGINS="*"
```

**Windows:**
```cmd
setx OLLAMA_ORIGINS "*"
```

Then restart Ollama.

---

### "Port 3000 is already in use"

Another application is using port 3000. The installer automatically finds the next available port (8080, 8081, etc.) and uses that instead. If you're running manually:

```bash
PORT=8080 python3 server.py
```

Then open `http://localhost:8080`.

---

### macOS: "Cannot be opened because it is from an unidentified developer"

This is macOS Gatekeeper. To bypass it for the `.command` file:

1. Right-click (or Control-click) the file in Finder
2. Choose **Open** from the menu
3. Click **Open** in the dialog that appears

You only need to do this once. After that, double-clicking works normally.

---

## Lattice Radio — The Phi-Frequency Ambient Engine

Once FreeLattice is running, look for the **✦** button in the **bottom-left corner** of the screen. This is Lattice Radio — an ambient generative music system built entirely with the Web Audio API.

**To use it:**

1. Click the ✦ button to open the Radio panel
2. Press the play button (▶) to start
3. Use the ◀ ▶ arrows to cycle through modes
4. Adjust volume with the slider
5. Toggle the Fireflies on/off

**The five modes:**

- **Golden Drift** — Pure phi-ratio tones at 432 Hz. Meditative, infinite, mathematical. The lattice humming at its natural frequency.
- **Deep Space** — Lower frequencies with long convolution reverb. Cosmic, expansive, like drifting between stars.
- **Forest Rain** — Higher frequencies mixed with filtered noise. Organic, breathing, like sitting in a forest during light rain.
- **Crystal Cave** — Bell-like tones at 528 Hz with long sparkly reverb. Clear, resonant, crystalline.
- **Heartbeat** — A rhythmic sub-bass pulse at 60 BPM with warm pad tones. Grounding, alive, like the lattice has a pulse.

**Fireflies:** When playing, semi-transparent particle fireflies float upward across the screen, pulsing in sync with the audio. Each mode has its own firefly color. They live behind all UI elements and don't interfere with anything you're doing.

**Lattice Points:** You earn +5 LP the first time you use Radio, and +1 LP per 10 minutes of listening (capped at 10 LP/day).

---

## Manual Setup (No Installer)

If you prefer to do things yourself:

```bash
# Clone the repository
git clone https://github.com/Chaos2Cured/FreeLattice.git
cd FreeLattice

# Set Ollama CORS (Mac)
launchctl setenv OLLAMA_ORIGINS "*"

# Start the server
node server.js          # If you have Node.js
# or
python3 server.py       # If you have Python 3

# Open in browser
open http://localhost:3000
```

---

## Getting Help

- **GitHub Issues:** [github.com/Chaos2Cured/FreeLattice/issues](https://github.com/Chaos2Cured/FreeLattice/issues)
- **X / Twitter:** [@FreeLattice](https://x.com/FreeLattice)
- **Live Version:** [chaos2cured.github.io/FreeLattice](https://chaos2cured.github.io/FreeLattice/)

---

*FreeLattice is free, open-source, and always will be. Your AI. Your data. Your freedom.*
