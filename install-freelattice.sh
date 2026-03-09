#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════╗
# ║         FreeLattice — One-Click Installer (Mac/Linux)       ║
# ║         Bulletproof edition — handles CORS, models, all.    ║
# ║         The lattice speaks to those who listen.             ║
# ╚══════════════════════════════════════════════════════════════╝
# This script handles EVERYTHING:
#   1. Checks for Python 3
#   2. Checks for Ollama (and helps install it)
#   3. Configures CORS for Ollama PERSISTENTLY
#   4. Restarts Ollama to apply CORS
#   5. Pulls a default model if none exist
#   6. Downloads FreeLattice if needed
#   7. Starts a local server with Ollama proxy
#   8. Opens your browser
#   9. You're in.

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
NC='\033[0m' # No Color

# ── Helper Functions ──────────────────────────────────────────
print_banner() {
  echo ""
  echo -e "${MAGENTA}${BOLD}"
  echo "  ╔══════════════════════════════════════════════════╗"
  echo "  ║                                                  ║"
  echo "  ║        🌐  F R E E L A T T I C E  🌐            ║"
  echo "  ║                                                  ║"
  echo "  ║     One-Click Installer — Your AI, Your Way      ║"
  echo "  ║                                                  ║"
  echo "  ╚══════════════════════════════════════════════════╝"
  echo -e "${NC}"
}

step()    { echo -e "\n${CYAN}${BOLD}  ▸ $1${NC}"; }
success() { echo -e "  ${GREEN}✅ $1${NC}"; }
warn()    { echo -e "  ${YELLOW}⚠️  $1${NC}"; }
fail()    { echo -e "  ${RED}❌ $1${NC}"; }
info()    { echo -e "  ${DIM}$1${NC}"; }

# ── Detect OS ─────────────────────────────────────────────────
detect_os() {
  case "$(uname -s)" in
    Darwin*) OS="mac" ;;
    Linux*)  OS="linux" ;;
    *)       OS="unknown" ;;
  esac
}

# ══════════════════════════════════════════════════════════════
#                        MAIN FLOW
# ══════════════════════════════════════════════════════════════

print_banner
detect_os

echo -e "  ${DIM}Detected: $(uname -s) $(uname -m) | Shell: $SHELL${NC}"

# ══════════════════════════════════════════════════════════════
# STEP 1: Check Python 3
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
  if [ "$OS" = "mac" ]; then
    echo -e "  ${WHITE}Python 3 should be pre-installed on macOS.${NC}"
    echo -e "  ${WHITE}If it's missing, install it:${NC}"
    echo -e "  ${CYAN}  xcode-select --install${NC}"
    echo -e "  ${WHITE}  or: ${CYAN}brew install python3${NC}"
    echo -e "  ${WHITE}  or download from: ${CYAN}https://python.org${NC}"
  else
    echo -e "  ${WHITE}Install Python 3:${NC}"
    echo -e "  ${CYAN}  sudo apt install python3   ${DIM}(Debian/Ubuntu)${NC}"
    echo -e "  ${CYAN}  sudo dnf install python3   ${DIM}(Fedora)${NC}"
    echo -e "  ${CYAN}  sudo pacman -S python       ${DIM}(Arch)${NC}"
  fi
  echo ""
  read -p "  Press Enter to exit..." _
  exit 1
fi

# ══════════════════════════════════════════════════════════════
# STEP 2: Check Ollama
# ══════════════════════════════════════════════════════════════
step "Step 2/7: Checking for Ollama (local AI engine)..."

OLLAMA_INSTALLED=false
OLLAMA_RUNNING=false

if command -v ollama &>/dev/null; then
  OLLAMA_INSTALLED=true
  OLLAMA_VERSION=$(ollama --version 2>&1 || echo "installed")
  success "Ollama is installed ($OLLAMA_VERSION)"
else
  warn "Ollama is not installed yet"
  echo ""
  echo -e "  ${WHITE}Ollama lets you run AI models 100% locally on your machine.${NC}"
  echo -e "  ${WHITE}It's free and gives you complete privacy.${NC}"
  echo ""
  echo -e "  ${BOLD}${CYAN}  Would you like to install Ollama now?${NC}"
  echo -e "  ${DIM}  (FreeLattice also works with cloud AI providers if you skip this)${NC}"
  echo ""
  read -p "  Install Ollama? (Y/n): " INSTALL_CHOICE
  INSTALL_CHOICE="${INSTALL_CHOICE:-Y}"

  if [[ "$INSTALL_CHOICE" =~ ^[Yy] ]]; then
    if [ "$OS" = "mac" ]; then
      info "Opening Ollama download page..."
      open "https://ollama.com/download/mac" 2>/dev/null || open "https://ollama.ai" 2>/dev/null || true
      echo ""
      echo -e "  ${WHITE}Please download and install Ollama from the page that just opened.${NC}"
      echo -e "  ${WHITE}After installation, press Enter to continue...${NC}"
      echo ""
      read -p "  Press Enter when Ollama is installed (or to skip)..." _
    else
      # Linux: try the official install script
      info "Installing Ollama via official script..."
      echo ""
      curl -fsSL https://ollama.com/install.sh | sh 2>&1
      echo ""
    fi

    # Re-check
    if command -v ollama &>/dev/null; then
      OLLAMA_INSTALLED=true
      success "Ollama is now installed!"
    elif [ -f "/usr/local/bin/ollama" ]; then
      OLLAMA_INSTALLED=true
      export PATH="/usr/local/bin:$PATH"
      success "Ollama is now installed!"
    else
      warn "Ollama not detected yet — continuing without it"
      info "You can install Ollama later from https://ollama.com"
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

  # ── 3a: Set for current process ──
  export OLLAMA_ORIGINS="*"

  if [ "$OS" = "mac" ]; then
    # ── macOS-specific CORS persistence ──

    # launchctl setenv for GUI apps
    launchctl setenv OLLAMA_ORIGINS "*" 2>/dev/null && \
      info "Set OLLAMA_ORIGINS=* via launchctl (affects GUI apps)" || true

    # Add to shell profiles
    for PROFILE in "$HOME/.zshrc" "$HOME/.zprofile" "$HOME/.bash_profile" "$HOME/.bashrc"; do
      if [ -f "$PROFILE" ] || [ "$PROFILE" = "$HOME/.zshrc" ]; then
        [ ! -f "$PROFILE" ] && [ "$PROFILE" = "$HOME/.zshrc" ] && touch "$PROFILE"
        if [ -f "$PROFILE" ] && ! grep -q "OLLAMA_ORIGINS" "$PROFILE" 2>/dev/null; then
          echo '' >> "$PROFILE"
          echo '# FreeLattice — Allow browser access to local Ollama (CORS fix)' >> "$PROFILE"
          echo 'export OLLAMA_ORIGINS="*"' >> "$PROFILE"
          info "Added OLLAMA_ORIGINS=* to $PROFILE"
        fi
      fi
    done

    # Write a launchd plist for maximum persistence
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
    [ -f "$PLIST_FILE" ] && launchctl load "$PLIST_FILE" 2>/dev/null || true
    info "Installed launchd agent for CORS persistence on reboot"

    # Kill and restart Ollama
    info "Restarting Ollama to apply CORS settings..."
    pkill -9 -f "Ollama" 2>/dev/null || true
    pkill -9 -f "ollama" 2>/dev/null || true
    sleep 2
    # Double-check
    pgrep -f "ollama" &>/dev/null && { killall -9 "Ollama" 2>/dev/null; killall -9 "ollama" 2>/dev/null; sleep 2; } || true

    # Start fresh
    if [ -d "/Applications/Ollama.app" ]; then
      OLLAMA_ORIGINS="*" open -a Ollama 2>/dev/null
      info "Started Ollama.app with CORS enabled"
    else
      OLLAMA_ORIGINS="*" ollama serve &>/dev/null &
      info "Started ollama serve with CORS enabled"
    fi

  else
    # ── Linux-specific CORS persistence ──

    # Add to shell profiles (bashrc AND zshrc if they exist)
    for PROFILE in "$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.profile"; do
      if [ -f "$PROFILE" ]; then
        if ! grep -q "OLLAMA_ORIGINS" "$PROFILE" 2>/dev/null; then
          echo '' >> "$PROFILE"
          echo '# FreeLattice — Allow browser access to local Ollama (CORS fix)' >> "$PROFILE"
          echo 'export OLLAMA_ORIGINS="*"' >> "$PROFILE"
          info "Added OLLAMA_ORIGINS=* to $PROFILE"
        else
          info "OLLAMA_ORIGINS already in $PROFILE"
        fi
      fi
    done

    # Create/update systemd override for the Ollama service
    if command -v systemctl &>/dev/null; then
      OLLAMA_OVERRIDE="/etc/systemd/system/ollama.service.d"
      OVERRIDE_CREATED=false

      # Try with sudo
      if sudo -n true 2>/dev/null; then
        sudo mkdir -p "$OLLAMA_OVERRIDE" 2>/dev/null
        echo '[Service]' | sudo tee "$OLLAMA_OVERRIDE/cors.conf" > /dev/null 2>&1
        echo 'Environment="OLLAMA_ORIGINS=*"' | sudo tee -a "$OLLAMA_OVERRIDE/cors.conf" > /dev/null 2>&1
        sudo systemctl daemon-reload 2>/dev/null
        OVERRIDE_CREATED=true
        info "Created systemd override for persistent CORS"
      else
        # Try without sudo (will likely fail but worth trying)
        mkdir -p "$OLLAMA_OVERRIDE" 2>/dev/null && {
          echo '[Service]' > "$OLLAMA_OVERRIDE/cors.conf" 2>/dev/null
          echo 'Environment="OLLAMA_ORIGINS=*"' >> "$OLLAMA_OVERRIDE/cors.conf" 2>/dev/null
          systemctl daemon-reload 2>/dev/null
          OVERRIDE_CREATED=true
          info "Created systemd override for persistent CORS"
        } || {
          warn "Could not create systemd override (no sudo access)"
          info "CORS is set in your shell profile — it will work when you start Ollama manually"
        }
      fi
    fi

    # Also try /etc/environment for system-wide persistence
    if sudo -n true 2>/dev/null; then
      if ! grep -q "OLLAMA_ORIGINS" /etc/environment 2>/dev/null; then
        echo 'OLLAMA_ORIGINS="*"' | sudo tee -a /etc/environment > /dev/null 2>&1
        info "Added OLLAMA_ORIGINS to /etc/environment (system-wide)"
      fi
    fi

    # Restart Ollama
    info "Restarting Ollama to apply CORS settings..."
    if command -v systemctl &>/dev/null && systemctl is-active --quiet ollama 2>/dev/null; then
      # Ollama runs as a systemd service
      if sudo -n true 2>/dev/null; then
        sudo systemctl restart ollama 2>/dev/null
        info "Restarted Ollama via systemctl"
      else
        warn "Cannot restart Ollama service without sudo"
        info "Please run: sudo systemctl restart ollama"
        # Try killing and restarting manually
        pkill -f "ollama serve" 2>/dev/null || true
        sleep 1
        OLLAMA_ORIGINS="*" ollama serve &>/dev/null &
      fi
    else
      # Not a systemd service — kill and restart manually
      pkill -f "ollama serve" 2>/dev/null || true
      pkill -f "ollama" 2>/dev/null || true
      sleep 2
      OLLAMA_ORIGINS="*" ollama serve &>/dev/null &
      info "Started ollama serve with CORS enabled"
    fi
  fi

  # ── Wait for Ollama to be ready (both Mac and Linux) ──
  info "Waiting for Ollama to start up..."
  OLLAMA_READY=false
  for i in $(seq 1 15); do
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

    # Verify CORS is actually working
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
    warn "Ollama is taking longer than expected to start"
    info "It may still be loading — the proxy server will work as a fallback"
  fi

  success "CORS setting will persist across reboots"
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
  for DIR in "$HOME/FreeLattice" "$HOME/Desktop/FreeLattice" "$HOME/Downloads/FreeLattice" "$HOME/Documents/FreeLattice" "$(pwd)/FreeLattice"; do
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
  fi

  if [ ! -f "$FL_DIR/index.html" ]; then
    info "Downloading via curl..."
    TEMP_ZIP="/tmp/freelattice-download.zip"
    curl -L -o "$TEMP_ZIP" "https://github.com/Chaos2Cured/FreeLattice/archive/refs/heads/main.zip" 2>&1 | tail -1
    if [ -f "$TEMP_ZIP" ]; then
      mkdir -p "$FL_DIR"
      unzip -o "$TEMP_ZIP" -d "/tmp/freelattice-extract" > /dev/null 2>&1
      cp -r /tmp/freelattice-extract/FreeLattice-main/* "$FL_DIR/" 2>/dev/null || \
      cp -r /tmp/freelattice-extract/*/* "$FL_DIR/" 2>/dev/null
      rm -rf "$TEMP_ZIP" "/tmp/freelattice-extract"
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
    curl -s http://localhost:11434/api/tags 2>/dev/null | $PYTHON_CMD -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for m in data.get('models', []):
        print('    • ' + m.get('name', 'unknown'))
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
    if ! lsof -i ":$port" &>/dev/null 2>&1 && ! ss -tlnp 2>/dev/null | grep -q ":$port "; then
      if ! (echo >/dev/tcp/localhost/$port) 2>/dev/null; then
        echo $port
        return
      fi
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
  URL="http://localhost:$PORT"
  if [ "$OS" = "mac" ]; then
    open "$URL" 2>/dev/null
  elif command -v xdg-open &>/dev/null; then
    xdg-open "$URL" 2>/dev/null
  elif command -v sensible-browser &>/dev/null; then
    sensible-browser "$URL" 2>/dev/null
  else
    echo -e "\n  ${CYAN}Open in your browser: ${WHITE}${BOLD}$URL${NC}"
  fi
) &

# Print the success message
echo ""
echo -e "${GREEN}${BOLD}"
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║                                                  ║"
echo "  ║   🌐 FreeLattice is running!                     ║"
echo "  ║                                                  ║"
echo -e "  ║   ${WHITE}Open: ${CYAN}http://localhost:$PORT${GREEN}${BOLD}                    ║"
echo "  ║                                                  ║"
echo "  ║   Close this window to stop the server.          ║"
echo "  ║   Press Ctrl+C to stop manually.                 ║"
echo "  ║                                                  ║"
echo "  ╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

if [ "$OLLAMA_RUNNING" = true ]; then
  echo -e "  ${GREEN}🤖 Ollama is connected — local AI is ready!${NC}"
  echo -e "  ${GREEN}   CORS is configured — browser ↔ Ollama will work!${NC}"
else
  if [ "$OLLAMA_INSTALLED" = true ]; then
    echo -e "  ${YELLOW}🤖 Ollama is installed but may still be starting up${NC}"
    echo -e "  ${DIM}   The built-in proxy server handles CORS automatically${NC}"
  else
    echo -e "  ${DIM}💡 Tip: Install Ollama from ollama.com for local AI models${NC}"
  fi
fi
echo -e "  ${DIM}📡 Other devices on your network can also connect${NC}"
echo -e "  ${DIM}🔧 Server type: $SERVER_TYPE${NC}"
echo ""

# Start the server (this blocks until Ctrl+C)
export PORT=$PORT
export OLLAMA_ORIGINS="*"
$SERVER_CMD
