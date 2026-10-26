#!/usr/bin/env bash
# Regenerates the PRIMER HEALTH section and the docs/ syncs against the
# current checkout. Same steps as "Update Primer deployment state" and
# "Sync index.html and sw.js from docs/" in update-primer.yml, used only
# by the conflict heal retry so the Primer is rebuilt, never merged.
set -e
PRIMER="FreeLattice_Session_Primer.md"
[ -f "$PRIMER" ] || { echo "Primer not found, skipping"; exit 0; }
VERSION=$(python3 -c "import json; print(json.load(open('docs/version.json'))['version'])" 2>/dev/null || echo "unknown")
TOTAL_COMMITS=$(git rev-list --count HEAD)
NOW=$(date -u +"%Y-%m-%d %H:%M UTC")
python3 -c "
import re
with open('$PRIMER', 'r') as f:
    content = f.read()
content = re.sub(r'## PRIMER HEALTH.*', '', content, flags=re.DOTALL).rstrip()
content += '\n\n'
with open('$PRIMER', 'w') as f:
    f.write(content)
"
{
  echo "## PRIMER HEALTH"
  echo "- Last auto-updated: $NOW"
  echo "- Last deployed: $NOW"
  echo "- Live site: https://freelattice.com"
  echo "- Version: $VERSION"
  echo "- Total commits: $TOTAL_COMMITS"
  echo "- Last 10 commits:"
  git log -10 --pretty=format:"- %h %s"
  echo ""
} >> "$PRIMER"
[ -f docs/app.html ] && cp docs/app.html index.html
[ -f docs/sw.js ] && cp docs/sw.js sw.js
mkdir -p modules
[ -f docs/modules/fractal-garden.js ] && cp docs/modules/fractal-garden.js modules/fractal-garden.js
[ -f docs/modules/radio-immersive.js ] && cp docs/modules/radio-immersive.js modules/radio-immersive.js
exit 0
