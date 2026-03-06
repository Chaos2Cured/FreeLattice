#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════╗
# ║  FreeLattice — Mac Double-Click Launcher                    ║
# ║  .command files open Terminal automatically in Finder        ║
# ╚══════════════════════════════════════════════════════════════╝
# This file is the magic one — just double-click it in Finder
# and everything happens automatically.

# Make ourselves executable (in case we aren't already)
chmod +x "$0" 2>/dev/null

# Get the directory where this file lives
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Check if the .sh installer exists alongside us
if [ -f "$SCRIPT_DIR/install-freelattice.sh" ]; then
  # Make the .sh script executable too
  chmod +x "$SCRIPT_DIR/install-freelattice.sh"
  # Run it
  exec "$SCRIPT_DIR/install-freelattice.sh"
else
  # The .command file was downloaded alone — download everything first
  echo ""
  echo "  ╔══════════════════════════════════════════════════╗"
  echo "  ║        FreeLattice — Quick Launcher              ║"
  echo "  ╚══════════════════════════════════════════════════╝"
  echo ""
  echo "  Downloading FreeLattice..."
  echo ""

  # Try to download the full repo
  if command -v git &>/dev/null; then
    git clone https://github.com/Chaos2Cured/FreeLattice.git "$HOME/FreeLattice" 2>&1
  else
    curl -L -o /tmp/freelattice.zip "https://github.com/Chaos2Cured/FreeLattice/archive/refs/heads/main.zip"
    mkdir -p "$HOME/FreeLattice"
    unzip -o /tmp/freelattice.zip -d /tmp/freelattice-extract > /dev/null 2>&1
    cp -r /tmp/freelattice-extract/FreeLattice-main/* "$HOME/FreeLattice/"
    rm -rf /tmp/freelattice.zip /tmp/freelattice-extract
  fi

  if [ -f "$HOME/FreeLattice/install-freelattice.sh" ]; then
    chmod +x "$HOME/FreeLattice/install-freelattice.sh"
    exec "$HOME/FreeLattice/install-freelattice.sh"
  else
    echo ""
    echo "  Something went wrong. Please download FreeLattice manually:"
    echo "  https://github.com/Chaos2Cured/FreeLattice"
    echo ""
    read -p "  Press Enter to exit..." _
  fi
fi

# Keep Terminal open so the server stays running
# (exec above replaces this process, so we only get here on error)
echo ""
echo "  Press Enter to close this window..."
read -p "" _
