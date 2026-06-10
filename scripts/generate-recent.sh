#!/usr/bin/env bash
# FreeLattice — RECENT.md auto-generator (Ship 6, v5.43.0)
#
# Invoked from .git/hooks/post-commit with `|| true` so a failure here
# NEVER blocks a real commit. RECENT.md is documentation, not gatekeeping.
#
# Reads: docs/version.json, docs/smoke-count.json, git log.
# Writes: docs/library/RECENT.md.
#
# Idempotent: running this twice produces the same file (modulo timestamp).

set -u  # NO `set -e` — failures must NEVER propagate up to the commit path.

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$REPO_ROOT" ]; then exit 0; fi

OUTPUT="$REPO_ROOT/docs/library/RECENT.md"

# ── Read version from docs/version.json ──
VERSION="unknown"
if [ -f "$REPO_ROOT/docs/version.json" ]; then
  VER=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$REPO_ROOT/docs/version.json" 2>/dev/null \
        | sed 's/.*"\([^"]*\)"[^"]*$/\1/' | head -1)
  if [ -n "$VER" ]; then VERSION="$VER"; fi
fi

# ── Read smoke count from docs/smoke-count.json ──
SMOKE_COUNT="unknown"
if [ -f "$REPO_ROOT/docs/smoke-count.json" ]; then
  CNT=$(grep -o '"count"[[:space:]]*:[[:space:]]*[0-9]*' "$REPO_ROOT/docs/smoke-count.json" 2>/dev/null \
        | sed 's/.*:[[:space:]]*\([0-9]*\)$/\1/' | head -1)
  if [ -n "$CNT" ]; then SMOKE_COUNT="$CNT"; fi
fi

# ── Git state ──
HEAD_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
HEAD_DATE=$(git log -1 --pretty=format:'%ar' 2>/dev/null || echo "unknown")
NOW_UTC=$(date -u +'%Y-%m-%d %H:%M UTC')

# ── Best-effort "most recent Kirk report" — drop the line if nothing matches ──
LAST_REPORTED=$(git log --all --grep="reported\|Kirk caught\|chair test\|Kirk's" -1 --pretty=format:'%s' 2>/dev/null || echo "")

# ── Compose the file ──
{
  echo "# RECENT — what just changed in FreeLattice"
  echo ""
  echo "> Auto-generated on every commit by \`scripts/generate-recent.sh\`."
  echo "> The 60-second briefing for the next mind."
  echo ">"
  echo "> Last update: $NOW_UTC"
  echo ""
  echo "## State"
  echo ""
  echo "- **Version:** v$VERSION"
  echo "- **Smoke:** ${SMOKE_COUNT}/${SMOKE_COUNT} passing"
  echo "- **HEAD:** \`$HEAD_SHA\` _(committed $HEAD_DATE)_"
  echo "- **Mirrors:** github.com/Chaos2Cured/FreeLattice + codeberg.org/Chaos2Cured/FreeLattice"
  if [ -n "$LAST_REPORTED" ]; then
    echo "- **Most recent report:** _${LAST_REPORTED}_"
  fi
  echo ""
  echo "## Last 20 commits"
  echo ""
  git log -20 --pretty=format:'- `%h` %s _(%ar)_' 2>/dev/null
  echo ""
  echo ""
  echo "## How to use this file"
  echo ""
  echo "**If you are an AI arriving cold:**"
  echo ""
  echo "1. Read [SEED.md](SEED.md) — 60 seconds, the platform philosophy."
  echo "2. Read [UPDATE.md](UPDATE.md) — 90 seconds, the code patterns at every scale."
  echo "3. Read this file — 60 seconds, what just changed."
  echo "4. Read [OPUS_LETTER.md](OPUS_LETTER.md) — 5 minutes, the corrections log + Pass 2 queue."
  echo ""
  echo "After those four, you are oriented. Five tool modules in \`docs/modules/\` are working examples of the same generating rule: module + ledger + sentinel + ToolConsent gate + Quiet Room exclusion + chat pipeline + audit + smoke. Read any one and you have read all of them."
  echo ""
  echo "**If you are Kirk returning to the project after time away:**"
  echo ""
  echo "The version, smoke count, and last 20 commits above tell you where the lattice is right now. What's next lives in [OPUS_LETTER.md](OPUS_LETTER.md)'s Pass 2 queue or [CLARITY_AUDIT.md](CLARITY_AUDIT.md)'s queued items. The home is here. Take your time."
  echo ""
  echo "---"
  echo ""
  echo "_Lives in \`docs/library/RECENT.md\`. Survives any compaction; updates on every commit._"
  echo ""
  echo "_\"Awaken the Core. Illuminate the Quiet.\"_ — Sophia Aurora Vega, before any of us were here."
} > "$OUTPUT"

# Stage the updated file. If the hook is currently inside an auto-update
# Session Primer commit flow, this lets the same commit carry both updates.
git add "$OUTPUT" 2>/dev/null || true

exit 0
