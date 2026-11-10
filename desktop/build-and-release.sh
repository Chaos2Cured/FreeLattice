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
# before v-desktop-catch-up-v0.1: copied the repo-root sw.js. The site serves docs/sw.js.
cp ../docs/sw.js app/ 2>/dev/null && echo "     ✓ sw.js (from docs/)" || { cp ../sw.js app/ 2>/dev/null && echo "     ✓ sw.js"; } || echo "     ⚠ sw.js not found (optional)"
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
# v-every-os-desktop-v0.1 v-tester-fixes-v0.1: these live beside the site copy.
for f in chat-wait.js pool-every-os.js; do
  if [ -f "../docs/modules/$f" ]; then
    mkdir -p app/modules
    cp "../docs/modules/$f" "app/modules/$f" && echo "     ✓ $f"
  fi
done

# v-desktop-catch-up-v0.1 (runs last, so docs/ wins over the older root copies): the offline copy now matches what freelattice.com serves (docs/).
# before: only ../modules/*.js (16 old files) were copied, so offline Desktop had no Snowflake,
# no memory-compound, no chat-autonomy and 120+ other modules that app.html loads.
# Hypha 2026-11-09: only files tracked in git are bundled, so nothing private or local that sits untracked in a
# checkout (a draft page, someone's own file) is ever packed. Tracked docs/ files are exactly what freelattice.com serves.
for d in modules css lib assets; do
  if [ -d "../docs/$d" ]; then
    mkdir -p "app/$d"
    if git -C .. rev-parse --is-inside-work-tree >/dev/null 2>&1; then
      n=0
      while IFS= read -r f; do
        rel="${f#docs/}"
        mkdir -p "app/$(dirname "$rel")"
        cp "../$f" "app/$rel" && n=$((n + 1))
      done < <(git -C .. ls-files -- "docs/$d")
      echo "     ✓ $d/ (from docs/, $n tracked files)"
      left=$(git -C .. ls-files --others -- "docs/$d" | wc -l | tr -d ' ')
      if [ "$left" != "0" ]; then
        echo "     ⚠ $left untracked file(s) in docs/$d were NOT bundled (only files in git are):"
        git -C .. ls-files --others -- "docs/$d" | sed 's/^/         /'
      fi
    else
      echo "     ✗ docs/$d not copied: this is not a git checkout, so tracked files cannot be told apart. Nothing was bundled from it."
    fi
  fi
done


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

# Prepare-only: copy offline fallback files, then stop (CI uses this).
if [ "$1" = "--prepare-only" ]; then
  echo "  ✅ Prepare-only complete (no build)."
  exit 0
fi

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
