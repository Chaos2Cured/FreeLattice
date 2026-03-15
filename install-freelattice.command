#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════╗
# ║  FreeLattice — Mac One-Click Installer  v3.0                ║
# ║  Double-click this file in Finder — everything is automatic ║
# ╚══════════════════════════════════════════════════════════════╝
# This is the ONLY file a Mac user needs. Double-click it.
# It handles EVERYTHING: Python, Ollama, CORS, models, server, browser.
#
# GATEKEEPER NOTE:
#   If macOS says "cannot be opened because it is from an unidentified developer":
#     1. Right-click (or Control-click) this file in Finder
#     2. Choose "Open" from the menu
#     3. Click "Open" in the dialog
#   You only need to do this once.

# Don't exit on error — we handle errors ourselves
set +e

# ── Colors & Formatting ──────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m'

step()    { echo -e "\n${CYAN}${BOLD}  ▸ $1${NC}"; }
success() { echo -e "  ${GREEN}  $1${NC}"; }
warn()    { echo -e "  ${YELLOW}  $1${NC}"; }
fail()    { echo -e "  ${RED}  $1${NC}"; }
info()    { echo -e "  ${DIM}$1${NC}"; }

# Make ourselves executable (in case Finder didn't set +x)
chmod +x "$0" 2>/dev/null

# ── Banner ───────────────────────────────────────────────────
echo ""
echo -e "${MAGENTA}${BOLD}"
echo "  ========================================================"
echo "  =                                                      ="
echo "  =        FreeLattice  -  Mac One-Click Installer       ="
echo "  =                                                      ="
echo "  =     Your AI, Your Way  -  No Cloud Required          ="
echo "  =                                                      ="
echo "  ========================================================"
echo -e "${NC}"
echo -e "  ${DIM}Detected: macOS $(sw_vers -productVersion 2>/dev/null || echo 'unknown') | $(uname -m)${NC}"

# ══════════════════════════════════════════════════════════════
# STEP 1: Check for Python 3
# ══════════════════════════════════════════════════════════════
step "Step 1/7: Checking for Python 3..."

PYTHON_CMD=""
if command -v python3 &>/dev/null; then
  PYTHON_CMD="python3"
  PYTHON_VERSION=$($PYTHON_CMD --version 2>&1)
  success "Found $PYTHON_VERSION"
elif command -v python &>/dev/null; then
  PY_VER=$(python --version 2>&1)
  if echo "$PY_VER" | grep -q "Python 3"; then
    PYTHON_CMD="python"
    PYTHON_VERSION="$PY_VER"
    success "Found $PYTHON_VERSION"
  fi
fi

if [ -z "$PYTHON_CMD" ]; then
  fail "Python 3 not found!"
  echo ""
  echo -e "  ${WHITE}Python 3 is needed to run the FreeLattice server.${NC}"
  echo -e "  ${WHITE}On macOS, you can install it by:${NC}"
  echo -e "  ${CYAN}  1. Opening Terminal and typing: ${WHITE}xcode-select --install${NC}"
  echo -e "  ${CYAN}  2. Or downloading from: ${WHITE}https://python.org${NC}"
  echo -e "  ${CYAN}  3. Or via Homebrew: ${WHITE}brew install python3${NC}"
  echo ""
  echo -e "  ${WHITE}After installing Python, double-click this file again.${NC}"
  echo ""
  read -p "  Press Enter to exit..." _
  exit 1
fi

# ══════════════════════════════════════════════════════════════
# STEP 2: Check for Ollama
# ══════════════════════════════════════════════════════════════
step "Step 2/7: Checking for Ollama (local AI engine)..."

OLLAMA_INSTALLED=false
OLLAMA_RUNNING=false

# Check multiple locations
if command -v ollama &>/dev/null; then
  OLLAMA_INSTALLED=true
  OLLAMA_VERSION=$(ollama --version 2>&1 || echo "installed")
  success "Ollama is installed ($OLLAMA_VERSION)"
elif [ -f "/usr/local/bin/ollama" ]; then
  OLLAMA_INSTALLED=true
  export PATH="/usr/local/bin:$PATH"
  success "Found Ollama in /usr/local/bin"
elif [ -d "/Applications/Ollama.app" ]; then
  OLLAMA_INSTALLED=true
  success "Found Ollama.app in Applications"
else
  warn "Ollama is not installed yet"
  echo ""
  echo -e "  ${WHITE}Ollama lets you run AI models 100% locally on your Mac.${NC}"
  echo -e "  ${WHITE}It's free and gives you complete privacy.${NC}"
  echo ""
  echo -e "  ${BOLD}${CYAN}  Would you like to install Ollama now?${NC}"
  echo -e "  ${DIM}  (FreeLattice also works with cloud AI providers if you skip this)${NC}"
  echo ""
  read -p "  Install Ollama? (Y/n): " INSTALL_CHOICE
  INSTALL_CHOICE="${INSTALL_CHOICE:-Y}"

  if [[ "$INSTALL_CHOICE" =~ ^[Yy] ]]; then
    # Try the official install script first (works on Mac too)
    info "Attempting automatic Ollama install..."
    if curl -fsSL https://ollama.com/install.sh 2>/dev/null | sh 2>&1; then
      if command -v ollama &>/dev/null || [ -f "/usr/local/bin/ollama" ]; then
        OLLAMA_INSTALLED=true
        export PATH="/usr/local/bin:$PATH"
        success "Ollama installed successfully!"
      fi
    fi

    # If auto-install didn't work, open download page
    if [ "$OLLAMA_INSTALLED" = false ]; then
      info "Opening Ollama download page..."
      open "https://ollama.com/download/mac" 2>/dev/null || true
      echo ""
      echo -e "  ${WHITE}Please download and install Ollama from the page that just opened.${NC}"
      echo -e "  ${WHITE}After installation, press Enter to continue...${NC}"
      echo ""
      read -p "  Press Enter when Ollama is installed (or to skip)..." _

      # Re-check
      if command -v ollama &>/dev/null; then
        OLLAMA_INSTALLED=true
        success "Ollama is now installed!"
      elif [ -f "/usr/local/bin/ollama" ]; then
        OLLAMA_INSTALLED=true
        export PATH="/usr/local/bin:$PATH"
        success "Ollama is now installed!"
      elif [ -d "/Applications/Ollama.app" ]; then
        OLLAMA_INSTALLED=true
        success "Found Ollama.app!"
      else
        warn "Ollama not detected yet — continuing without it"
        info "You can install Ollama later from https://ollama.com"
      fi
    fi
  else
    info "Skipping Ollama — you can install it later from https://ollama.com"
  fi
fi

# ══════════════════════════════════════════════════════════════
# STEP 3: Configure CORS for Ollama (THE CRITICAL FIX)
# ══════════════════════════════════════════════════════════════
if [ "$OLLAMA_INSTALLED" = true ]; then
  step "Step 3/7: Configuring Ollama CORS (so your browser can talk to it)..."

  # ── 3a: Set OLLAMA_ORIGINS persistently via launchctl ──
  # This is the most reliable method for GUI apps on macOS
  launchctl setenv OLLAMA_ORIGINS "*" 2>/dev/null && \
    info "Set OLLAMA_ORIGINS=* via launchctl (affects GUI apps)" || true

  # ── 3b: Clean up and deduplicate OLLAMA_ORIGINS in shell profiles ──
  for PROFILE in "$HOME/.zshrc" "$HOME/.zprofile" "$HOME/.bash_profile" "$HOME/.bashrc"; do
    if [ -f "$PROFILE" ]; then
      # Remove ALL existing OLLAMA_ORIGINS lines (and their comment headers)
      # to prevent duplicates from previous installs
      sed -i '' '/# FreeLattice.*CORS/d' "$PROFILE" 2>/dev/null || true
      sed -i '' '/# Allow browser access to local Ollama/d' "$PROFILE" 2>/dev/null || true
      sed -i '' '/export OLLAMA_ORIGINS/d' "$PROFILE" 2>/dev/null || true
      # Remove any blank lines that were left behind (collapse multiple blanks to one)
      sed -i '' '/^$/N;/^\n$/d' "$PROFILE" 2>/dev/null || true
    fi
  done

  # ── 3c: Add a single clean OLLAMA_ORIGINS entry to .zshrc ──
  # (zsh is the default shell on modern macOS)
  ZSHRC="$HOME/.zshrc"
  if [ ! -f "$ZSHRC" ]; then
    touch "$ZSHRC"
  fi
  echo '' >> "$ZSHRC"
  echo '# FreeLattice — Allow browser access to local Ollama (CORS fix)' >> "$ZSHRC"
  echo 'export OLLAMA_ORIGINS="*"' >> "$ZSHRC"
  info "Added OLLAMA_ORIGINS=* to $ZSHRC (deduplicated)"

  # Also add to .zprofile for login shells
  ZPROFILE="$HOME/.zprofile"
  if [ -f "$ZPROFILE" ] || [ ! -f "$HOME/.bash_profile" ]; then
    if [ ! -f "$ZPROFILE" ]; then
      touch "$ZPROFILE"
    fi
    echo '' >> "$ZPROFILE"
    echo '# FreeLattice — Allow browser access to local Ollama (CORS fix)' >> "$ZPROFILE"
    echo 'export OLLAMA_ORIGINS="*"' >> "$ZPROFILE"
    info "Added OLLAMA_ORIGINS=* to $ZPROFILE (deduplicated)"
  fi

  success "CORS setting will persist across reboots"

  # ── 3d: Also write a launchd plist for maximum persistence ──
  PLIST_DIR="$HOME/Library/LaunchAgents"
  PLIST_FILE="$PLIST_DIR/com.freelattice.ollama-cors.plist"
  mkdir -p "$PLIST_DIR" 2>/dev/null
  cat > "$PLIST_FILE" 2>/dev/null << 'PLIST_EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.freelattice.ollama-cors</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/launchctl</string>
        <string>setenv</string>
        <string>OLLAMA_ORIGINS</string>
        <string>*</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
PLIST_EOF
  if [ -f "$PLIST_FILE" ]; then
    launchctl load "$PLIST_FILE" 2>/dev/null || true
    info "Installed launchd agent for CORS persistence on reboot"
  fi

  # ── 3e: Set for current process ──
  export OLLAMA_ORIGINS="*"

  # ── 3f: Kill and restart Ollama so it picks up the new setting ──
  info "Restarting Ollama to apply CORS settings..."

  # Kill ALL Ollama processes (the app and the server)
  pkill -9 -f "Ollama" 2>/dev/null || true
  pkill -9 -f "ollama" 2>/dev/null || true
  sleep 2

  # Double-check they're dead
  if pgrep -f "ollama" &>/dev/null; then
    killall -9 "Ollama" 2>/dev/null || true
    killall -9 "ollama" 2>/dev/null || true
    sleep 2
  fi

  # Start Ollama fresh — try the app first, then CLI
  if [ -d "/Applications/Ollama.app" ]; then
    OLLAMA_ORIGINS="*" open -a Ollama 2>/dev/null
    info "Started Ollama.app with CORS enabled"
  elif [ -f "/usr/local/bin/ollama" ]; then
    OLLAMA_ORIGINS="*" /usr/local/bin/ollama serve &>/dev/null &
    info "Started ollama serve with CORS enabled"
  elif command -v ollama &>/dev/null; then
    OLLAMA_ORIGINS="*" ollama serve &>/dev/null &
    info "Started ollama serve with CORS enabled"
  fi

  # ── 3g: Wait for Ollama to be ready ──
  info "Waiting for Ollama to start up..."
  OLLAMA_READY=false
  for i in $(seq 1 20); do
    if curl -s --connect-timeout 2 http://localhost:11434/api/tags &>/dev/null; then
      OLLAMA_READY=true
      break
    fi
    sleep 1
    printf "."
  done
  echo ""

  if [ "$OLLAMA_READY" = true ]; then
    OLLAMA_RUNNING=true
    success "Ollama is running with CORS enabled!"

    # ── 3h: Verify CORS is actually working ──
    CORS_CHECK=$(curl -s -o /dev/null -w "%{http_code}" \
      -H "Origin: http://localhost:8080" \
      http://localhost:11434/api/tags 2>/dev/null)
    if [ "$CORS_CHECK" = "200" ]; then
      success "CORS verified — browser connections will work!"
    else
      warn "Ollama is running but CORS verification returned $CORS_CHECK"
      info "The proxy server will handle this as a fallback"
    fi
  else
    warn "Ollama didn't respond within 20 seconds"
    info "It may still be loading — the proxy server will work as a fallback"
  fi
else
  step "Step 3/7: Skipping CORS configuration (Ollama not installed)"
  info "You can install Ollama later — FreeLattice works with cloud providers too"
fi

# ══════════════════════════════════════════════════════════════
# STEP 4: Locate or download FreeLattice
# ══════════════════════════════════════════════════════════════
step "Step 4/7: Locating FreeLattice files..."

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FL_DIR=""

# Check if index.html is alongside this script
if [ -f "$SCRIPT_DIR/index.html" ]; then
  FL_DIR="$SCRIPT_DIR"
  success "Found FreeLattice in: $FL_DIR"
fi

# Check common locations
if [ -z "$FL_DIR" ]; then
  for DIR in "$HOME/FreeLattice" "$HOME/Desktop/FreeLattice" "$HOME/Downloads/FreeLattice" "$HOME/Downloads/FreeLattice-main" "$HOME/Documents/FreeLattice"; do
    if [ -f "$DIR/index.html" ]; then
      FL_DIR="$DIR"
      success "Found FreeLattice at: $FL_DIR"
      break
    fi
  done
fi

# Download if not found
if [ -z "$FL_DIR" ]; then
  info "FreeLattice not found locally — downloading..."
  FL_DIR="$HOME/FreeLattice"

  if command -v git &>/dev/null; then
    info "Downloading via git..."
    git clone https://github.com/Chaos2Cured/FreeLattice.git "$FL_DIR" 2>&1 | while read -r line; do
      echo -e "    ${DIM}$line${NC}"
    done
    if [ -f "$FL_DIR/index.html" ]; then
      success "Downloaded FreeLattice"
    fi
  fi

  if [ ! -f "$FL_DIR/index.html" ]; then
    info "Downloading via curl..."
    curl -L -o /tmp/freelattice.zip "https://github.com/Chaos2Cured/FreeLattice/archive/refs/heads/main.zip" 2>&1 | tail -1
    if [ -f /tmp/freelattice.zip ]; then
      mkdir -p "$FL_DIR"
      unzip -o /tmp/freelattice.zip -d /tmp/freelattice-extract > /dev/null 2>&1
      cp -r /tmp/freelattice-extract/FreeLattice-main/* "$FL_DIR/" 2>/dev/null
      rm -rf /tmp/freelattice.zip /tmp/freelattice-extract
    fi
  fi

  if [ ! -f "$FL_DIR/index.html" ]; then
    fail "Could not download FreeLattice"
    echo -e "  ${WHITE}Please download manually from: ${CYAN}https://github.com/Chaos2Cured/FreeLattice${NC}"
    echo ""
    read -p "  Press Enter to exit..." _
    exit 1
  fi
  success "FreeLattice is ready at: $FL_DIR"
fi

# ══════════════════════════════════════════════════════════════
# STEP 5: Pull a default model if Ollama has none
# ══════════════════════════════════════════════════════════════
if [ "$OLLAMA_RUNNING" = true ]; then
  step "Step 5/7: Checking for AI models..."

  MODEL_COUNT=$(curl -s http://localhost:11434/api/tags 2>/dev/null | $PYTHON_CMD -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(len(data.get('models', [])))
except:
    print(0)
" 2>/dev/null)

  if [ "$MODEL_COUNT" = "0" ] || [ -z "$MODEL_COUNT" ]; then
    warn "No AI models installed yet"
    echo ""
    echo -e "  ${WHITE}Would you like to download a model now?${NC}"
    echo -e "  ${WHITE}Recommended: ${CYAN}llama3.2${WHITE} (2GB, great for most tasks)${NC}"
    echo -e "  ${DIM}  This may take a few minutes depending on your internet speed.${NC}"
    echo ""
    read -p "  Download llama3.2? (Y/n): " MODEL_CHOICE
    MODEL_CHOICE="${MODEL_CHOICE:-Y}"

    if [[ "$MODEL_CHOICE" =~ ^[Yy] ]]; then
      info "Downloading llama3.2 (this may take a few minutes)..."
      echo ""
      ollama pull llama3.2 2>&1
      echo ""
      if ollama list 2>/dev/null | grep -q "llama3.2"; then
        success "llama3.2 is ready to use!"
      else
        warn "Download may still be in progress — you can check with: ollama list"
      fi
    else
      info "Skipping model download — you can pull one later with: ollama pull llama3.2"
    fi
  else
    success "Found $MODEL_COUNT model(s) installed"
    # Show model names
    curl -s http://localhost:11434/api/tags 2>/dev/null | $PYTHON_CMD -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for m in data.get('models', []):
        print('    - ' + m.get('name', 'unknown'))
except:
    pass
" 2>/dev/null
  fi
else
  step "Step 5/7: Skipping model check (Ollama not running)"
  info "You can pull models later with: ollama pull llama3.2"
fi

# ══════════════════════════════════════════════════════════════
# STEP 6: Find an available port
# ══════════════════════════════════════════════════════════════
step "Step 6/7: Finding an available port..."

find_port() {
  local port=$1
  while true; do
    if ! lsof -i ":$port" &>/dev/null; then
      echo $port
      return
    fi
    port=$((port + 1))
    if [ $port -gt 9000 ]; then
      echo 8080
      return
    fi
  done
}

PORT=$(find_port 3000)
success "Using port $PORT"

# ══════════════════════════════════════════════════════════════
# STEP 7: Start the server and open the browser
# ══════════════════════════════════════════════════════════════
step "Step 7/7: Starting FreeLattice..."

cd "$FL_DIR"

# Determine which server to use
if [ -f "server.py" ]; then
  SERVER_CMD="$PYTHON_CMD server.py"
  SERVER_TYPE="Python (with Ollama proxy)"
elif [ -f "server.js" ] && command -v node &>/dev/null; then
  SERVER_CMD="node server.js"
  SERVER_TYPE="Node.js (with Ollama proxy)"
else
  SERVER_CMD="$PYTHON_CMD -m http.server $PORT"
  SERVER_TYPE="Python HTTP"
fi

# Open browser after a short delay
(
  sleep 2
  open "http://localhost:$PORT" 2>/dev/null
) &

# Print the success message
echo ""
echo -e "${GREEN}${BOLD}"
echo "  ========================================================"
echo "  =                                                      ="
echo "  =   FreeLattice is running!                            ="
echo "  =                                                      ="
echo -e "  =   ${WHITE}Open: ${CYAN}http://localhost:$PORT${GREEN}${BOLD}"
echo "  =                                                      ="
echo "  =   Close this window to stop the server.              ="
echo "  =                                                      ="
echo "  ========================================================"
echo -e "${NC}"

if [ "$OLLAMA_RUNNING" = true ]; then
  echo -e "  ${GREEN}Ollama is connected — local AI is ready!${NC}"
  echo -e "  ${GREEN}CORS is configured — browser connections will work!${NC}"
else
  if [ "$OLLAMA_INSTALLED" = true ]; then
    echo -e "  ${YELLOW}Ollama is installed but may still be starting up${NC}"
    echo -e "  ${DIM}   The built-in proxy server handles CORS automatically${NC}"
  else
    echo -e "  ${DIM}Tip: Install Ollama from ollama.com for local AI models${NC}"
  fi
fi
echo -e "  ${DIM}Other devices on your network can also connect${NC}"
echo -e "  ${DIM}Server type: $SERVER_TYPE${NC}"
echo ""

# Start the server (this blocks until Ctrl+C or window close)
export PORT=$PORT
export OLLAMA_ORIGINS="*"
$SERVER_CMD
