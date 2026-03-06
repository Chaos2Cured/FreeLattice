#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════╗
# ║         FreeLattice — One-Click Installer (Mac/Linux)       ║
# ║         The lattice speaks to those who listen.             ║
# ╚══════════════════════════════════════════════════════════════╝
# This script handles EVERYTHING:
#   1. Checks for Python3
#   2. Checks for Ollama (and helps install it)
#   3. Configures CORS for Ollama
#   4. Downloads FreeLattice if needed
#   5. Starts a local server
#   6. Opens your browser
#   7. You're in.

set -e

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

step() {
  echo -e "\n${CYAN}${BOLD}  ▸ $1${NC}"
}

success() {
  echo -e "  ${GREEN}✅ $1${NC}"
}

warn() {
  echo -e "  ${YELLOW}⚠️  $1${NC}"
}

fail() {
  echo -e "  ${RED}❌ $1${NC}"
}

info() {
  echo -e "  ${DIM}$1${NC}"
}

# ── Detect OS ─────────────────────────────────────────────────
detect_os() {
  case "$(uname -s)" in
    Darwin*) OS="mac" ;;
    Linux*)  OS="linux" ;;
    *)       OS="unknown" ;;
  esac
}

# ── Check Python3 ────────────────────────────────────────────
check_python() {
  step "Checking for Python 3..."

  if command -v python3 &>/dev/null; then
    PYTHON_CMD="python3"
    PYTHON_VERSION=$($PYTHON_CMD --version 2>&1)
    success "Found $PYTHON_VERSION"
    return 0
  elif command -v python &>/dev/null; then
    # Check if 'python' is actually Python 3
    PY_VER=$(python --version 2>&1)
    if echo "$PY_VER" | grep -q "Python 3"; then
      PYTHON_CMD="python"
      PYTHON_VERSION="$PY_VER"
      success "Found $PYTHON_VERSION"
      return 0
    fi
  fi

  fail "Python 3 not found!"
  echo ""
  if [ "$OS" = "mac" ]; then
    echo -e "  ${WHITE}Python 3 should be pre-installed on macOS.${NC}"
    echo -e "  ${WHITE}If it's missing, install it:${NC}"
    echo -e "  ${CYAN}  brew install python3${NC}"
    echo -e "  ${WHITE}  or download from: ${CYAN}https://python.org${NC}"
  else
    echo -e "  ${WHITE}Install Python 3:${NC}"
    echo -e "  ${CYAN}  sudo apt install python3   ${DIM}(Debian/Ubuntu)${NC}"
    echo -e "  ${CYAN}  sudo dnf install python3   ${DIM}(Fedora)${NC}"
    echo -e "  ${CYAN}  sudo pacman -S python       ${DIM}(Arch)${NC}"
  fi
  echo ""
  return 1
}

# ── Check Ollama ──────────────────────────────────────────────
check_ollama() {
  step "Checking for Ollama (local AI engine)..."

  if command -v ollama &>/dev/null; then
    OLLAMA_VERSION=$(ollama --version 2>&1 || echo "installed")
    success "Ollama is installed ($OLLAMA_VERSION)"

    # Check if Ollama is running
    if curl -s --connect-timeout 2 http://localhost:11434/api/tags &>/dev/null; then
      success "Ollama is running and ready"
      OLLAMA_RUNNING=true
    else
      warn "Ollama is installed but not running"
      info "Starting Ollama in the background..."
      if [ "$OS" = "mac" ]; then
        open -a Ollama 2>/dev/null || ollama serve &>/dev/null &
      else
        ollama serve &>/dev/null &
      fi
      # Wait a moment for it to start
      sleep 2
      if curl -s --connect-timeout 3 http://localhost:11434/api/tags &>/dev/null; then
        success "Ollama started successfully"
        OLLAMA_RUNNING=true
      else
        warn "Ollama may still be starting up — it should be ready in a moment"
        OLLAMA_RUNNING=false
      fi
    fi
    return 0
  else
    warn "Ollama is not installed"
    echo ""
    echo -e "  ${WHITE}Ollama lets you run AI models locally on your machine.${NC}"
    echo -e "  ${WHITE}It's optional but recommended for full privacy.${NC}"
    echo ""
    echo -e "  ${BOLD}${CYAN}  👉 Download from: https://ollama.ai${NC}"
    echo ""

    # Try to open the download page
    if [ "$OS" = "mac" ]; then
      open "https://ollama.ai" 2>/dev/null || true
    elif command -v xdg-open &>/dev/null; then
      xdg-open "https://ollama.ai" 2>/dev/null || true
    fi

    echo -e "  ${DIM}(FreeLattice also works with cloud AI providers — you can skip this)${NC}"
    OLLAMA_RUNNING=false
    return 1
  fi
}

# ── Configure CORS for Ollama ─────────────────────────────────
configure_ollama_cors() {
  step "Configuring Ollama CORS (so your browser can talk to it)..."

  if [ "$OS" = "mac" ]; then
    # macOS: use launchctl to set environment variable
    if launchctl setenv OLLAMA_ORIGINS "*" 2>/dev/null; then
      success "Set OLLAMA_ORIGINS=* via launchctl (macOS)"
    else
      warn "Could not set via launchctl — trying export method"
      export OLLAMA_ORIGINS="*"
      success "Set OLLAMA_ORIGINS=* via export"
    fi

    # Also add to shell profile for persistence
    SHELL_RC=""
    if [ -f "$HOME/.zshrc" ]; then
      SHELL_RC="$HOME/.zshrc"
    elif [ -f "$HOME/.bash_profile" ]; then
      SHELL_RC="$HOME/.bash_profile"
    elif [ -f "$HOME/.bashrc" ]; then
      SHELL_RC="$HOME/.bashrc"
    fi

    if [ -n "$SHELL_RC" ]; then
      if ! grep -q "OLLAMA_ORIGINS" "$SHELL_RC" 2>/dev/null; then
        echo '' >> "$SHELL_RC"
        echo '# FreeLattice — Allow browser access to Ollama' >> "$SHELL_RC"
        echo 'export OLLAMA_ORIGINS="*"' >> "$SHELL_RC"
        info "Added OLLAMA_ORIGINS to $SHELL_RC for future sessions"
      else
        info "OLLAMA_ORIGINS already in $SHELL_RC"
      fi
    fi

  else
    # Linux: export and try to add to systemd override
    export OLLAMA_ORIGINS="*"
    success "Set OLLAMA_ORIGINS=* via export"

    # Try systemd override for persistence
    if [ -d "/etc/systemd/system" ] && command -v systemctl &>/dev/null; then
      OLLAMA_OVERRIDE="/etc/systemd/system/ollama.service.d"
      if [ ! -d "$OLLAMA_OVERRIDE" ]; then
        sudo mkdir -p "$OLLAMA_OVERRIDE" 2>/dev/null || true
      fi
      if [ -d "$OLLAMA_OVERRIDE" ]; then
        echo '[Service]' | sudo tee "$OLLAMA_OVERRIDE/cors.conf" > /dev/null 2>&1
        echo 'Environment="OLLAMA_ORIGINS=*"' | sudo tee -a "$OLLAMA_OVERRIDE/cors.conf" > /dev/null 2>&1
        sudo systemctl daemon-reload 2>/dev/null || true
        info "Added systemd override for persistent CORS"
      fi
    fi

    # Also add to shell profile
    SHELL_RC="$HOME/.bashrc"
    if [ -f "$HOME/.zshrc" ]; then
      SHELL_RC="$HOME/.zshrc"
    fi
    if ! grep -q "OLLAMA_ORIGINS" "$SHELL_RC" 2>/dev/null; then
      echo '' >> "$SHELL_RC"
      echo '# FreeLattice — Allow browser access to Ollama' >> "$SHELL_RC"
      echo 'export OLLAMA_ORIGINS="*"' >> "$SHELL_RC"
      info "Added OLLAMA_ORIGINS to $SHELL_RC for future sessions"
    fi
  fi

  # Restart Ollama to pick up the new CORS setting
  if [ "$OLLAMA_RUNNING" = "true" ]; then
    info "Restarting Ollama to apply CORS settings..."
    if [ "$OS" = "mac" ]; then
      pkill -f "ollama" 2>/dev/null || true
      sleep 1
      open -a Ollama 2>/dev/null || ollama serve &>/dev/null &
    else
      if command -v systemctl &>/dev/null && systemctl is-active --quiet ollama 2>/dev/null; then
        sudo systemctl restart ollama 2>/dev/null || true
      else
        pkill -f "ollama serve" 2>/dev/null || true
        sleep 1
        ollama serve &>/dev/null &
      fi
    fi
    sleep 2
    success "Ollama restarted with CORS enabled"
  fi
}

# ── Download / Locate FreeLattice ─────────────────────────────
ensure_freelattice() {
  step "Locating FreeLattice files..."

  # Check if we're already in the FreeLattice directory
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

  if [ -f "$SCRIPT_DIR/index.html" ]; then
    FL_DIR="$SCRIPT_DIR"
    success "Found FreeLattice in current directory"
    return 0
  fi

  # Check common locations
  for DIR in "$HOME/FreeLattice" "$HOME/Desktop/FreeLattice" "$HOME/Downloads/FreeLattice" "$(pwd)/FreeLattice"; do
    if [ -f "$DIR/index.html" ]; then
      FL_DIR="$DIR"
      success "Found FreeLattice at $FL_DIR"
      return 0
    fi
  done

  # Not found — download it
  info "FreeLattice not found locally. Downloading..."
  echo ""

  FL_DIR="$HOME/FreeLattice"

  if command -v git &>/dev/null; then
    info "Using git clone..."
    git clone https://github.com/Chaos2Cured/FreeLattice.git "$FL_DIR" 2>&1 | while read -r line; do
      echo -e "    ${DIM}$line${NC}"
    done
    success "Downloaded FreeLattice via git"
  else
    info "Using curl to download zip..."
    TEMP_ZIP="/tmp/freelattice-download.zip"
    curl -L -o "$TEMP_ZIP" "https://github.com/Chaos2Cured/FreeLattice/archive/refs/heads/main.zip" 2>&1 | tail -1
    if [ -f "$TEMP_ZIP" ]; then
      mkdir -p "$FL_DIR"
      unzip -o "$TEMP_ZIP" -d "/tmp/freelattice-extract" > /dev/null 2>&1
      # Move contents from the extracted folder
      cp -r /tmp/freelattice-extract/FreeLattice-main/* "$FL_DIR/" 2>/dev/null || \
      cp -r /tmp/freelattice-extract/*/* "$FL_DIR/" 2>/dev/null
      rm -rf "$TEMP_ZIP" "/tmp/freelattice-extract"
      success "Downloaded and extracted FreeLattice"
    else
      fail "Download failed. Please check your internet connection."
      echo -e "  ${WHITE}Manual download: ${CYAN}https://github.com/Chaos2Cured/FreeLattice${NC}"
      return 1
    fi
  fi
}

# ── Find Available Port ───────────────────────────────────────
find_port() {
  PORT=8080
  while true; do
    if ! lsof -i ":$PORT" &>/dev/null && ! ss -tlnp 2>/dev/null | grep -q ":$PORT "; then
      # Double check with a quick connection test
      if ! (echo >/dev/tcp/localhost/$PORT) 2>/dev/null; then
        break
      fi
    fi
    PORT=$((PORT + 1))
    if [ $PORT -gt 9000 ]; then
      fail "Could not find an available port between 8080-9000"
      PORT=8080
      break
    fi
  done
  echo $PORT
}

# ── Start Server ──────────────────────────────────────────────
start_server() {
  step "Starting FreeLattice server..."

  cd "$FL_DIR"

  # Find available port
  PORT=$(find_port)

  # Try the custom server first (has Ollama proxy built in)
  if [ -f "server.py" ]; then
    info "Using FreeLattice server (with Ollama proxy)..."
    PORT=3000
    # Check if 3000 is taken
    if lsof -i ":3000" &>/dev/null 2>&1 || (echo >/dev/tcp/localhost/3000) 2>/dev/null; then
      PORT=$(find_port)
      info "Port 3000 busy, using port $PORT"
    fi

    if [ -f "server.js" ] && command -v node &>/dev/null; then
      SERVER_CMD="node server.js"
      SERVER_TYPE="Node.js"
    else
      export PORT=$PORT
      SERVER_CMD="$PYTHON_CMD server.py"
      SERVER_TYPE="Python"
    fi
  else
    SERVER_CMD="$PYTHON_CMD -m http.server $PORT"
    SERVER_TYPE="Python HTTP"
  fi

  success "Server will start on port $PORT ($SERVER_TYPE)"

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

  # Print final message
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

  if [ "$OLLAMA_RUNNING" = "true" ]; then
    echo -e "  ${GREEN}🤖 Ollama is connected — local AI is ready!${NC}"
  else
    echo -e "  ${DIM}💡 Tip: Install Ollama (ollama.ai) for local AI models${NC}"
  fi
  echo -e "  ${DIM}📡 Other devices on your network can connect too${NC}"
  echo ""

  # Start the server (this blocks until Ctrl+C)
  export PORT=$PORT
  $SERVER_CMD
}

# ══════════════════════════════════════════════════════════════
#                        MAIN FLOW
# ══════════════════════════════════════════════════════════════

print_banner
detect_os

echo -e "  ${DIM}Detected: $(uname -s) $(uname -m) | Shell: $SHELL${NC}"

# Step 1: Python
if ! check_python; then
  echo ""
  fail "Cannot continue without Python 3. Please install it and try again."
  echo ""
  read -p "  Press Enter to exit..." _
  exit 1
fi

# Step 2: Ollama
OLLAMA_RUNNING=false
if check_ollama; then
  # Step 3: Configure CORS
  configure_ollama_cors
fi

# Step 4: Get FreeLattice
if ! ensure_freelattice; then
  echo ""
  fail "Could not locate or download FreeLattice."
  echo ""
  read -p "  Press Enter to exit..." _
  exit 1
fi

# Step 5: Start server + open browser
start_server
