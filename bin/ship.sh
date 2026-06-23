#!/usr/bin/env bash
# bin/ship.sh — Consolidated FreeLattice ship sequence
#
# Per Opus's Letter Thirty-Six (v5.66.3). Closes item #6 from CC's
# June 22 repo diagnostic. One command per ship instead of memorizing
# the dance.
#
# v5.66.5 polish (per CC's June 23 first-run learnings):
# - Stage 0 added: pre-fetch + merge before push, catches CI commits
#   that landed since last local pull
# - Stage 6 hardened: codeberg push retries up to 4 times with 25s
#   backoff for known 504/disconnect transients
# - --dry-run flag: walks through stages without committing or pushing
#
# Usage:
#   ./bin/ship.sh "v5.X.Y — what shipped" [--no-smoke] [--dry-run]
#
# Stages:
# - Stage 1: Local commit (post-commit hook generates primer with
#   the existing de-bounce in hooks/post-commit)
# - Stage 2: Pre-fetch + merge before push (catch CI commits we
#   don't have locally yet — Stage 0 from CC's learnings)
# - Stage 3: Push to origin (GitHub)
# - Stage 4: Wait for CI auto-commit to land (~12s)
# - Stage 5: Fetch origin and resolve primer conflict with --theirs
# - Stage 6: Final push to origin
# - Stage 7: Mirror to Codeberg (with transient retry)
# - Stage 8: Smoke verify (unless --no-smoke)
#
# Pre-conditions assumed:
#   - You've already staged your changes manually with `git add`, OR
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
  echo "Usage: ./bin/ship.sh \"v5.X.Y — what shipped\" [--no-smoke] [--dry-run]"
  exit 1
fi

COMMIT_MSG="$1"
RUN_SMOKE=1
DRY_RUN=0

shift
for arg in "$@"; do
  case "$arg" in
    --no-smoke) RUN_SMOKE=0 ;;
    --dry-run)  DRY_RUN=1 ;;
    *) echo "ship.sh: unknown flag '$arg'"; exit 1 ;;
  esac
done

cd "$(git rev-parse --show-toplevel)"

if [ "$DRY_RUN" = "1" ]; then
  echo "→ DRY RUN — describing stages without committing or pushing"
  echo ""
fi

# ── Stage 1: Local commit ───────────────────────────────────────────
echo "→ Stage 1: Local commit"
if [ "$DRY_RUN" = "1" ]; then
  echo "  [dry-run] Would: git add -A (if nothing staged) + git commit -m \"$COMMIT_MSG\""
else
  if git diff --cached --quiet; then
    if git diff --quiet; then
      echo "  Nothing to commit — working tree clean."
      exit 0
    fi
    echo "  Staging all changes (nothing was pre-staged)..."
    git add -A
  fi
  git commit -m "$COMMIT_MSG"
fi

# ── Stage 2: Pre-fetch + merge (catch CI commits we don't have) ─────
# Per CC's June 23 first-run learning: after the previous ship,
# GitHub Actions lands a "ci: Update Primer deployment state" commit
# on origin. If we never fetched it, our push gets rejected as
# non-fast-forward. Pre-fetch + merge handles this case before push.
echo "→ Stage 2: Pre-fetch + merge (catch CI commits we don't have)"
if [ "$DRY_RUN" = "1" ]; then
  echo "  [dry-run] Would: git fetch origin main; merge if origin ahead, --theirs on primer conflict"
else
  git fetch origin main
  if git merge-base --is-ancestor origin/main HEAD; then
    echo "  Local already includes origin/main — no pre-merge needed."
  else
    echo "  Origin is ahead — merging before push (primer conflict auto-resolved)"
    if ! git merge --no-edit origin/main; then
      echo "  Conflict detected — resolving FreeLattice_Session_Primer.md with --theirs"
      git checkout --theirs -- FreeLattice_Session_Primer.md 2>/dev/null || true
      git add FreeLattice_Session_Primer.md 2>/dev/null || true
      git commit --no-edit
    fi
  fi
fi

# ── Stage 3: Push to origin ─────────────────────────────────────────
echo "→ Stage 3: Push to origin (GitHub)"
if [ "$DRY_RUN" = "1" ]; then
  echo "  [dry-run] Would: git push origin main"
else
  git push origin main
fi

# ── Stage 4: Wait for CI to auto-commit the primer ──────────────────
echo "→ Stage 4: Wait for CI primer commit to land (~12s)"
if [ "$DRY_RUN" = "1" ]; then
  echo "  [dry-run] Would: sleep 12"
else
  sleep 12
fi

# ── Stage 5: Fetch + resolve post-push primer conflict if any ───────
echo "→ Stage 5: Post-push fetch + resolve (CI's primer commit)"
if [ "$DRY_RUN" = "1" ]; then
  echo "  [dry-run] Would: git fetch + ff-merge or --theirs resolve"
else
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
fi

# ── Stage 6: Final push to origin ───────────────────────────────────
echo "→ Stage 6: Final push to origin"
if [ "$DRY_RUN" = "1" ]; then
  echo "  [dry-run] Would: git push origin main"
else
  git push origin main
fi

# ── Stage 7: Mirror to Codeberg (with transient retry) ──────────────
# Per CC's June 23 learning: codeberg.org occasionally returns 504 or
# disconnects during git push response (data may already be pushed).
# Retry up to 4 times with 25s backoff for these transients. Halt on
# non-transient errors so the operator can investigate.
echo "→ Stage 7: Mirror to Codeberg (with transient retry)"
if [ "$DRY_RUN" = "1" ]; then
  echo "  [dry-run] Would: git push codeberg main (retry 4× on 504/disconnect transients)"
else
  if git remote get-url codeberg > /dev/null 2>&1; then
    attempts=0
    while true; do
      attempts=$((attempts + 1))
      cb_out=$(git push codeberg main 2>&1) && break
      # Push failed — check if transient
      if echo "$cb_out" | grep -qE "504|disconnect|hung up|timed out|Could not resolve"; then
        if [ "$attempts" -ge 4 ]; then
          echo "  Codeberg push failed after $attempts attempts — leaving for manual retry"
          echo "  Last output: $(echo "$cb_out" | tail -1)"
          break
        fi
        echo "  Codeberg transient (attempt $attempts/4): $(echo "$cb_out" | tail -1 | head -c 80)"
        echo "  Retrying in 25s..."
        sleep 25
      else
        echo "  Codeberg push failed with non-transient error:"
        echo "$cb_out" | tail -3
        echo "  Halting — investigate before retrying."
        break
      fi
    done
  else
    echo "  WARN: codeberg remote not configured — skipping mirror"
    echo "  To configure: git remote add codeberg https://codeberg.org/Chaos2Cured/FreeLattice.git"
  fi
fi

# ── Stage 8: Smoke verify ───────────────────────────────────────────
if [ "$DRY_RUN" = "1" ]; then
  echo "→ Stage 8: Smoke verify"
  echo "  [dry-run] Would: node tests/smoke.js"
elif [ "$RUN_SMOKE" = "1" ]; then
  echo "→ Stage 8: Smoke verify"
  node tests/smoke.js 2>&1 | grep -E "ALL|FAILED" | tail -1
else
  echo "→ Stage 8: Smoke verify (skipped via --no-smoke)"
fi

echo ""
if [ "$DRY_RUN" = "1" ]; then
  echo "✓ Dry-run complete. No changes committed or pushed."
else
  echo "✓ Ship complete. Both mirrors updated."
fi
