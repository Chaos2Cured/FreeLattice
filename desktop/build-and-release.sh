#!/bin/bash
# ============================================
# FreeLattice Desktop — Build Helper
# Copies the latest FreeLattice app files into
# desktop/app/ then builds for all platforms.
#
# The Electron app loads from freelattice.com by
# default; these local files are the offline fallback.
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "  🖥️  FreeLattice Desktop Builder"
echo "  ================================"
echo ""

# Step 1: Copy app files from the repo root (offline fallback)
echo "  📦 Copying app files (offline fallback)..."
mkdir -p app

# Core files — try app.html first, fall back to index.html
if [ -f "../docs/app.html" ]; then
  cp ../docs/app.html app/app.html && echo "     ✓ app.html (from docs/)"
elif [ -f "../index.html" ]; then
  cp ../index.html app/app.html && echo "     ✓ app.html (copied from index.html)"
else
  echo "     ✗ No app.html or index.html found (required!)"
fi

# Also keep index.html as an alias
if [ -f "app/app.html" ]; then
  cp app/app.html app/index.html && echo "     ✓ index.html (alias)"
fi

cp ../manifest.json app/ 2>/dev/null && echo "     ✓ manifest.json" || echo "     ⚠ manifest.json not found (optional)"
cp ../icon-192.png app/ 2>/dev/null && echo "     ✓ icon-192.png" || echo "     ⚠ icon-192.png not found (optional)"
cp ../icon-512.png app/ 2>/dev/null && echo "     ✓ icon-512.png" || echo "     ⚠ icon-512.png not found (optional)"
cp ../sw.js app/ 2>/dev/null && echo "     ✓ sw.js" || echo "     ⚠ sw.js not found (optional)"
cp ../landing.html app/ 2>/dev/null && echo "     ✓ landing.html" || echo "     ⚠ landing.html not found (optional)"

# Library files (Three.js, etc.)
if [ -d "../lib" ]; then
  mkdir -p app/lib
  cp ../lib/*.js app/lib/ 2>/dev/null && echo "     ✓ lib/ (Three.js and shaders)" || echo "     ⚠ No lib files found"
fi

# Module files (lazy-loaded features)
if [ -d "../modules" ]; then
  mkdir -p app/modules
  cp ../modules/*.js app/modules/ 2>/dev/null && echo "     ✓ modules/ (lazy-loaded features)" || echo "     ⚠ No module files found"
else
  echo "     ⚠ modules/ directory not found (optional)"
fi

# Verify we have an app file
if [ ! -f "app/app.html" ] && [ ! -f "app/index.html" ]; then
  echo ""
  echo "  ❌ ERROR: No HTML file found in the repo root."
  echo "     Make sure you're running this from the desktop/ directory"
  echo "     and the FreeLattice repo files are in the parent directory."
  exit 1
fi

echo ""
echo "  ✅ App files copied to desktop/app/ (offline fallback)"
echo "  ℹ️  The Electron app loads from freelattice.com by default"
echo ""

# Step 2: Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "  📥 Installing dependencies..."
  npm install
  echo ""
fi

# Step 3: Build
if [ "$1" = "--dev" ] || [ "$1" = "-d" ]; then
  echo "  🚀 Starting in development mode..."
  npm start
else
  echo "  🔨 Building FreeLattice Desktop..."
  echo ""

  if [ "$1" = "--mac" ]; then
    npm run build:mac
  elif [ "$1" = "--win" ]; then
    npm run build:win
  elif [ "$1" = "--linux" ]; then
    npm run build:linux
  else
    npm run build
  fi

  echo ""
  echo "  ✅ Done! Check the dist/ directory for installers."
  echo ""
  ls -la dist/ 2>/dev/null || echo "  (dist/ directory not found — build may have failed)"
fi
