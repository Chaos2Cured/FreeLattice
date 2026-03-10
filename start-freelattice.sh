#!/usr/bin/env bash
# ============================================
# FreeLattice — One-Click Launcher (Mac/Linux)
# ============================================

echo ""
echo "  ========================================================"
echo "    FreeLattice  -  Starting Local Server..."
echo "  ========================================================"
echo ""

# Make this script executable (in case it wasn't already)
chmod +x "$0" 2>/dev/null

# Set CORS for Ollama
export OLLAMA_ORIGINS="*"

# Get the directory where this script lives
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Function to open browser
open_browser() {
    local url="http://localhost:3000"
    sleep 1
    if [ "$(uname -s)" = "Darwin" ]; then
        open "$url" &>/dev/null &
    elif command -v xdg-open &>/dev/null; then
        xdg-open "$url" &>/dev/null &
    elif command -v sensible-browser &>/dev/null; then
        sensible-browser "$url" &>/dev/null &
    else
        echo "  Open $url in your browser."
    fi
}

# Try Python server first (has Ollama proxy)
if command -v python3 &>/dev/null && [ -f "$SCRIPT_DIR/server.py" ]; then
    echo "  Found Python 3 — starting server with Ollama proxy..."
    echo ""
    open_browser
    python3 "$SCRIPT_DIR/server.py"
    exit 0
fi

if command -v python &>/dev/null && [ -f "$SCRIPT_DIR/server.py" ]; then
    PY_VER=$(python --version 2>&1)
    if echo "$PY_VER" | grep -q "Python 3"; then
        echo "  Found Python — starting server with Ollama proxy..."
        echo ""
        open_browser
        python "$SCRIPT_DIR/server.py"
        exit 0
    fi
fi

# Try Node.js
if command -v node &>/dev/null && [ -f "$SCRIPT_DIR/server.js" ]; then
    echo "  Found Node.js — starting server with Ollama proxy..."
    echo ""
    open_browser
    node "$SCRIPT_DIR/server.js"
    exit 0
fi

# Fallback: simple Python HTTP server
if command -v python3 &>/dev/null; then
    echo "  Starting simple Python HTTP server..."
    echo ""
    open_browser
    cd "$SCRIPT_DIR" && python3 -m http.server 3000
    exit 0
fi

# Neither found
echo ""
echo "  Neither Node.js nor Python was found on your system."
echo ""
echo "  To run FreeLattice as a local server, install one of these:"
echo ""
if [ "$(uname -s)" = "Darwin" ]; then
    echo "    Option 1: Python 3"
    echo "      brew install python3  (or it may already be installed)"
    echo ""
    echo "    Option 2: Node.js"
    echo "      brew install node  (or visit https://nodejs.org)"
else
    echo "    Option 1: Python 3"
    echo "      sudo apt install python3  (Debian/Ubuntu)"
    echo "      sudo dnf install python3  (Fedora)"
    echo ""
    echo "    Option 2: Node.js"
    echo "      sudo apt install nodejs  (or visit https://nodejs.org)"
fi
echo ""
echo "  Or just open index.html directly in your browser — it works without a server!"
echo ""
