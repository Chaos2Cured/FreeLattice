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

# Weft re-check 2026-11-09: pack the COMMITTED bytes (git HEAD), never a local edit sitting in the working tree.
# A tracked file with uncommitted edits is packed as committed, and named. Outside a git checkout, plain copies.
IN_GIT=0
git -C .. rev-parse --is-inside-work-tree >/dev/null 2>&1 && IN_GIT=1
# Hypha re-walk 3: everything electron-builder packs must be committed bytes too. A marker (in the temp folder,
# never in app/) lets the build name any file in app/ that this run did not write; such leftovers stop the build.
# Hypha 23a0279 soft: the run keeps a LIST of the files it wrote (an mtime alone let a future-dated leftover through).
# before: BUILD_START=$(mktemp "${TMPDIR:-/tmp}/fl-build-start.XXXXXX")
BUILD_START=$(mktemp "${TMPDIR:-/tmp}/fl-build-start.XXXXXX")
# before: trap 'rm -f "$BUILD_START"' EXIT   # only its own marker
trap 'rm -f "$BUILD_START"' EXIT   # only its own list
wrote() { printf '%s\n' "$1" >> "$BUILD_START"; }
committed_cp() {   # $1 = path from the repo root, $2 = destination file
  if [ "$IN_GIT" = 1 ]; then
    git -C .. cat-file -e "HEAD:$1" 2>/dev/null || return 1
    git -C .. show "HEAD:$1" > "$2" || return 1
    wrote "$2"
    git -C .. diff --quiet HEAD -- "$1" || echo "     ⚠ $1 has local edits; the committed version was packed"
    return 0
  fi
  # before: [ -f "../$1" ] && cp "../$1" "$2"
  [ -f "../$1" ] && cp "../$1" "$2" && wrote "$2"
}
committed_glob() {  # $1 = folder from the repo root, $2 = pattern, $3 = destination folder; prints how many
  local n=0 f
  if [ "$IN_GIT" = 1 ]; then
    while IFS= read -r f; do committed_cp "$f" "$3/$(basename "$f")" && n=$((n + 1)); done < <(git -C .. ls-files -- "$1/$2")
  else
    # before: for f in ../"$1"/$2; do [ -f "$f" ] && cp "$f" "$3/" && n=$((n + 1)); done
    for f in ../"$1"/$2; do [ -f "$f" ] && cp "$f" "$3/" && wrote "$3/$(basename "$f")" && n=$((n + 1)); done
  fi
  echo "$n"
}

# Core files — try app.html first, fall back to index.html
if [ -f "../docs/app.html" ]; then
  committed_cp docs/app.html app/app.html && echo "     ✓ app.html (from docs/)"
elif [ -f "../index.html" ]; then
  committed_cp index.html app/app.html && echo "     ✓ app.html (copied from index.html)"
else
  echo "     ✗ No app.html or index.html found (required!)"
fi

# Also keep index.html as an alias
if [ -f "app/app.html" ]; then
  # before: cp app/app.html app/index.html && echo "     ✓ index.html (alias)"
  cp app/app.html app/index.html && wrote app/index.html && echo "     ✓ index.html (alias)"
fi

committed_cp manifest.json app/manifest.json 2>/dev/null && echo "     ✓ manifest.json" || echo "     ⚠ manifest.json not found (optional)"
committed_cp icon-192.png app/icon-192.png 2>/dev/null && echo "     ✓ icon-192.png" || echo "     ⚠ icon-192.png not found (optional)"
committed_cp icon-512.png app/icon-512.png 2>/dev/null && echo "     ✓ icon-512.png" || echo "     ⚠ icon-512.png not found (optional)"
# before v-desktop-catch-up-v0.1: copied the repo-root sw.js. The site serves docs/sw.js.
committed_cp docs/sw.js app/sw.js 2>/dev/null && echo "     ✓ sw.js (from docs/)" || { committed_cp sw.js app/sw.js 2>/dev/null && echo "     ✓ sw.js"; } || echo "     ⚠ sw.js not found (optional)"
committed_cp landing.html app/landing.html 2>/dev/null && echo "     ✓ landing.html" || echo "     ⚠ landing.html not found (optional)"

# Library files (Three.js, etc.)
if [ -d "../lib" ]; then
  mkdir -p app/lib
  nl=$(committed_glob lib '*.js' app/lib); [ "$nl" != "0" ] && echo "     ✓ lib/ (Three.js and shaders, $nl files)" || echo "     ⚠ No lib files found"
fi

# Module files (lazy-loaded features)
if [ -d "../modules" ]; then
  mkdir -p app/modules
  nm=$(committed_glob modules '*.js' app/modules); [ "$nm" != "0" ] && echo "     ✓ modules/ (lazy-loaded features, $nm files)" || echo "     ⚠ No module files found"
else
  echo "     ⚠ modules/ directory not found (optional)"
fi
# v-every-os-desktop-v0.1 v-tester-fixes-v0.1: these live beside the site copy.
for f in chat-wait.js pool-every-os.js; do
  if [ -f "../docs/modules/$f" ]; then
    mkdir -p app/modules
    committed_cp "docs/modules/$f" "app/modules/$f" && echo "     ✓ $f"
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
        committed_cp "$f" "app/$rel" && n=$((n + 1))
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

# Step 2 (Hypha 23a0279 soft: the guard now runs BEFORE any npm install, so nothing is downloaded or run first).
# before: Step 2 was "npm install if node_modules is missing", and this guard was Step 3.
if [ "$1" != "--dev" ] && [ "$1" != "-d" ]; then
  stop=0
  if [ "$IN_GIT" = 1 ]; then
    # The desktop sources electron-builder packs from this folder (package.json build.files, minus app/**),
    # plus package.json and package-lock.json themselves (they decide what is built and packed).
    # before: srcs=$(node -e "...build.files...")
    srcs=$(node -e "const f=require('./package.json').build.files; console.log(f.filter(x=>!/[*]/.test(x)).concat(['package.json']).join('\n'))")
    git -C .. ls-files --error-unmatch desktop/package-lock.json >/dev/null 2>&1 && srcs="$srcs package-lock.json"
    for f in $srcs; do
      if ! git -C .. ls-files --error-unmatch "desktop/$f" >/dev/null 2>&1; then echo "  ✗ desktop/$f is not committed"; stop=1
      elif ! git -C .. diff --quiet HEAD -- "desktop/$f"; then echo "  ✗ desktop/$f has local edits"; stop=1; fi
    done
  fi
  # before: stale=$(find app -type f ! -name .gitkeep ! -newer "$BUILD_START" 2>/dev/null | sort)
  stale=$(comm -23 <(find app -type f ! -name .gitkeep 2>/dev/null | sort -u) <(sort -u "$BUILD_START"))
  if [ -n "$stale" ]; then echo "  ✗ app/ has files this run did not write (left from an earlier copy):"; echo "$stale" | sed 's/^/       /'; stop=1; fi
  if [ "$stop" = 1 ]; then
    echo "  Nothing was built: only committed bytes are packed. Commit or set those aside, then run this again."
    exit 3
  fi
fi

# Step 3: Install dependencies if needed (after the guard)
if [ ! -d "node_modules" ]; then
  echo "  📥 Installing dependencies..."
  npm install
  echo ""
fi

# Step 4: Build
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
