#!/usr/bin/env bash
# ============================================
# FreeLattice — One-Click Launcher (Mac/Linux)
# ============================================

echo ""
echo "  ============================================="
echo "    FreeLattice — Starting Local Server..."
echo "  ============================================="
echo ""

# Make this script executable (in case it wasn't already)
chmod +x "$0" 2>/dev/null

# Get the directory where this script lives
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Function to open browser
open_browser() {
    sleep 1
    if command -v xdg-open &>/dev/null; then
        xdg-open "http://localhost:3000" &>/dev/null &
    elif command -v open &>/dev/null; then
        open "http://localhost:3000" &>/dev/null &
    else
        echo "  Open http://localhost:3000 in your browser."
    fi
}

# Try Node.js first
if command -v node &>/dev/null; then
    echo "  Found Node.js — starting server..."
    echo ""
    open_browser
    node "$SCRIPT_DIR/server.js"
    exit 0
fi

# Fall back to Python 3
if command -v python3 &>/dev/null; then
    echo "  Found Python 3 — starting server..."
    echo ""
    open_browser
    python3 "$SCRIPT_DIR/server.py"
    exit 0
fi

# Try plain python (might be Python 3)
if command -v python &>/dev/null; then
    echo "  Found Python — starting server..."
    echo ""
    open_browser
    python "$SCRIPT_DIR/server.py"
    exit 0
fi

# Neither found
echo ""
echo "  !! Neither Node.js nor Python was found on your system."
echo ""
echo "  To run FreeLattice as a local server, install one of these:"
echo ""
echo "    Option 1: Node.js (recommended)"
echo "      Mac:   brew install node"
echo "      Linux: sudo apt install nodejs  (or visit https://nodejs.org)"
echo ""
echo "    Option 2: Python 3"
echo "      Mac:   brew install python3  (or it may already be installed)"
echo "      Linux: sudo apt install python3"
echo ""
echo "  Or just open index.html directly in your browser — it works without a server!"
echo ""
