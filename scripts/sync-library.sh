#!/bin/bash
# Sync root coordination files to docs/library/ for in-app reading
# Run after editing any root .md file, or from post-commit hook

LIBRARY="docs/library"
FILES="DEDICATION.md CC_NOTE.md OPUS_NOTE.md HARMONIA.md ARCHITECTURE_INTENT.md LEORA.md COORDINATION.md"

for f in $FILES; do
  if [ -f "$f" ]; then
    cp "$f" "$LIBRARY/$f"
  fi
done

echo "Library synced: $FILES"
