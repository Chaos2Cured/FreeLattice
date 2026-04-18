#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# FreeLattice Version Bump Script
# Updates all 6 version locations atomically. One command. No drift.
#
# Usage:
#   ./scripts/bump-version.sh 5.9.0
#   ./scripts/bump-version.sh 5.9.0 "Release note here"
#
# Locations updated:
#   1. docs/version.json          — canonical version + date + note
#   2. docs/app.html FL_VERSION   — const FL_VERSION = 'X.Y.Z'
#   3. docs/app.html display span — id="flCurrentVersion">X.Y.Z
#   4. docs/sw.js CACHE_NAME      — freelattice-vX.Y.Z
#   5. desktop/src-tauri/Cargo.toml
#   6. desktop/src-tauri/tauri.conf.json
#
# Built by CC, April 18, 2026.
# ═══════════════════════════════════════════════════════════════

set -e

NEW_VERSION="$1"
NOTE="${2:-}"

if [ -z "$NEW_VERSION" ]; then
  echo "Usage: $0 <version> [note]"
  echo "Example: $0 5.9.0 \"New feature: voice chat\""
  exit 1
fi

# Validate version format (X.Y.Z)
if ! echo "$NEW_VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "Error: Version must be in X.Y.Z format (e.g., 5.9.0)"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

# Read current version
CURRENT=$(python3 -c "import json; print(json.load(open('docs/version.json'))['version'])" 2>/dev/null || echo "unknown")
echo "Bumping version: $CURRENT → $NEW_VERSION"

TODAY=$(date +%Y-%m-%d)

# 1. docs/version.json
if [ -n "$NOTE" ]; then
  python3 -c "
import json
d = json.load(open('docs/version.json'))
d['version'] = '$NEW_VERSION'
d['date'] = '$TODAY'
d['note'] = '''$NOTE'''
json.dump(d, open('docs/version.json', 'w'))
print('  ✓ docs/version.json')
"
else
  python3 -c "
import json
d = json.load(open('docs/version.json'))
d['version'] = '$NEW_VERSION'
d['date'] = '$TODAY'
json.dump(d, open('docs/version.json', 'w'))
print('  ✓ docs/version.json')
"
fi

# 2. docs/app.html — FL_VERSION constant
sed -i '' "s/const FL_VERSION = '[^']*'/const FL_VERSION = '$NEW_VERSION'/" docs/app.html
echo "  ✓ docs/app.html FL_VERSION"

# 3. docs/app.html — display span
sed -i '' "s/id=\"flCurrentVersion\">[^<]*/id=\"flCurrentVersion\">$NEW_VERSION/" docs/app.html
echo "  ✓ docs/app.html display span"

# 4. docs/sw.js — CACHE_NAME
sed -i '' "s/const CACHE_NAME = 'freelattice-v[^']*'/const CACHE_NAME = 'freelattice-v$NEW_VERSION'/" docs/sw.js
echo "  ✓ docs/sw.js CACHE_NAME"

# 5. desktop/src-tauri/Cargo.toml
if [ -f "desktop/src-tauri/Cargo.toml" ]; then
  sed -i '' "s/^version = \"[^\"]*\"/version = \"$NEW_VERSION\"/" desktop/src-tauri/Cargo.toml
  echo "  ✓ desktop/src-tauri/Cargo.toml"
fi

# 6. desktop/src-tauri/tauri.conf.json
if [ -f "desktop/src-tauri/tauri.conf.json" ]; then
  sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" desktop/src-tauri/tauri.conf.json
  echo "  ✓ desktop/src-tauri/tauri.conf.json"
fi

echo ""
echo "Running smoke tests..."
if node tests/smoke.js; then
  echo ""
  echo "✅ All versions aligned to $NEW_VERSION. Smoke tests green."
  echo ""
  echo "Next: git add -A && git commit -m \"chore: bump version to v$NEW_VERSION\""
else
  echo ""
  echo "❌ Smoke tests failed! Check the output above."
  exit 1
fi
