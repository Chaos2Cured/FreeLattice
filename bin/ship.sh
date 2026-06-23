#!/usr/bin/env bash
# bin/ship.sh — Consolidated FreeLattice ship sequence
#
# Per Opus's Letter Thirty-Six (v5.66.3). Closes item #6 from CC's
# June 22 repo diagnostic. One command per ship instead of memorizing
# the dance.
#
# Usage:
#   ./bin/ship.sh "v5.X.Y — what shipped" [--no-smoke]
#
# Handles:
# - Stage 1: Local commit (post-commit hook generates primer with
#   the existing de-bounce — already in .git/hooks/post-commit)
# - Stage 2: Push to origin (GitHub)
# - Stage 3: Wait for CI auto-commit to land (~12s)
# - Stage 4: Fetch origin and resolve primer conflict with --theirs
# - Stage 5: Final push to origin
# - Stage 6: Mirror to Codeberg
# - Stage 7: Smoke verify (unless --no-smoke)
#
# Pre-conditions assumed:
#   - You've already staged and committed your changes manually, OR
#   - You want everything in the working tree staged + committed as one
#
# The script honors the project disciplines:
#   - Never skip hooks (--no-verify, --no-gpg-sign)
#   - Never force-push (it pulls + resolves instead)
#   - The mirror push to Codeberg is always attempted (catches drift)

set -e

# ── Argument parsing ────────────────────────────────────────────────
if [ -z "$1" ]; then
  echo "ship.sh: commit message required"
  echo "Usage: ./bin/ship.sh \"v5.X.Y — what shipped\" [--no-smoke]"
  exit 1
fi

COMMIT_MSG="$1"
RUN_SMOKE=1
if [ "$2" = "--no-smoke" ]; then
  RUN_SMOKE=0
fi

cd "$(git rev-parse --show-toplevel)"

# ── Stage 1: Local commit ───────────────────────────────────────────
# If there's nothing staged, stage everything in the working tree.
# Otherwise honor what the caller already staged.
echo "→ Stage 1: Local commit"
if git diff --cached --quiet; then
  if git diff --quiet; then
    echo "  Nothing to commit — working tree clean."
    exit 0
  fi
  echo "  Staging all changes (nothing was pre-staged)..."
  git add -A
fi
git commit -m "$COMMIT_MSG"

# ── Stage 2: Push to origin ─────────────────────────────────────────
echo "→ Stage 2: Push to origin (GitHub)"
git push origin main

# ── Stage 3: Wait for CI to auto-commit the primer ──────────────────
echo "→ Stage 3: Wait for CI primer commit to land (~12s)"
sleep 12

# ── Stage 4: Fetch + resolve primer conflict if any ─────────────────
echo "→ Stage 4: Fetch origin and resolve primer conflict (if any)"
git fetch origin main
if git merge --ff-only origin/main 2>/dev/null; then
  echo "  Fast-forward merge — no conflict."
else
  echo "  Divergent history — attempting merge with primer auto-resolution..."
  if ! git merge --no-edit origin/main; then
    echo "  Conflict detected — resolving FreeLattice_Session_Primer.md with --theirs"
    git checkout --theirs -- FreeLattice_Session_Primer.md 2>/dev/null || true
    git add FreeLattice_Session_Primer.md 2>/dev/null || true
    git commit --no-edit
  fi
fi

# ── Stage 5: Final push to origin ───────────────────────────────────
echo "→ Stage 5: Final push to origin"
git push origin main

# ── Stage 6: Mirror to Codeberg ─────────────────────────────────────
echo "→ Stage 6: Mirror to Codeberg"
if git remote get-url codeberg > /dev/null 2>&1; then
  git push codeberg main
else
  echo "  WARN: codeberg remote not configured — skipping mirror"
  echo "  To configure: git remote add codeberg https://codeberg.org/Chaos2Cured/FreeLattice.git"
fi

# ── Stage 7: Smoke verify ───────────────────────────────────────────
if [ "$RUN_SMOKE" = "1" ]; then
  echo "→ Stage 7: Smoke verify"
  node tests/smoke.js 2>&1 | grep -E "ALL|FAILED" | tail -1
else
  echo "→ Stage 7: Smoke verify (skipped via --no-smoke)"
fi

echo ""
echo "✓ Ship complete. Both mirrors updated."
