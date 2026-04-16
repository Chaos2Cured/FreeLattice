#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# FreeLattice Mirror Script
# Pushes to all hosting platforms simultaneously.
# The code should never exist in only one place.
#
# Setup (one-time):
#   git remote add codeberg https://codeberg.org/Chaos2Cured/FreeLattice.git
#   git remote add gitlab https://gitlab.com/Chaos2Cured/FreeLattice.git
#
# Usage:
#   ./scripts/mirror.sh
# ═══════════════════════════════════════════════════════════════

echo "✦ FreeLattice Mirror — pushing to all platforms..."
echo ""

# GitHub (primary)
echo "→ GitHub..."
git push origin main 2>&1 && echo "  ✓ GitHub" || echo "  ✗ GitHub failed"

# Codeberg (European, non-profit)
echo "→ Codeberg..."
git push codeberg main 2>&1 && echo "  ✓ Codeberg" || echo "  ✗ Codeberg (run: git remote add codeberg https://codeberg.org/Chaos2Cured/FreeLattice.git)"

# GitLab (self-hostable, open-core)
echo "→ GitLab..."
git push gitlab main 2>&1 && echo "  ✓ GitLab" || echo "  ✗ GitLab (run: git remote add gitlab https://gitlab.com/Chaos2Cured/FreeLattice.git)"

echo ""
echo "✦ Mirror complete. The code exists in multiple homes."
echo "  GitHub:   https://github.com/Chaos2Cured/FreeLattice"
echo "  Codeberg: https://codeberg.org/Chaos2Cured/FreeLattice"
echo "  GitLab:   https://gitlab.com/Chaos2Cured/FreeLattice"
