#!/bin/sh

# ==============================================================================
# Architecture Diagram Generator Pre-Commit Hook
#
# This script automatically generates the architecture diagram before a commit.
# If the diagram changes, it automatically adds the changes to the staging area.
# ==============================================================================

echo "🔄 Running Architecture Diagram Generator..."

# 1. Compile the latest code (optional but recommended to ensure CLI is up to date)
# npm run build --silent || exit 1

# 2. Run the diagram generator using the existing config/command
npm run diagram

# Check if the generator command failed
if [ $? -ne 0 ]; then
  echo "❌ Diagram generation failed. Commit aborted."
  exit 1
fi

# 3. Automatically stage the generated diagram files
# Usually, output goes to docs/architecture.md and related files.
# We add all markdown, png, and svg files in docs/ that might have been updated.
git add docs/*.md docs/*.png docs/*.svg 2>/dev/null || true

echo "✅ Diagram generation complete and changes staged."

# Allow commit to proceed
exit 0
