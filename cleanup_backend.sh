#!/usr/bin/env bash
# ==============================================================================
# OpenShorts Node.js Backend - Safe Unused Files & Temp Storage Cleanup Script
# ==============================================================================

set -e

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$BACKEND_DIR"

echo "🧹 Starting OpenShorts Backend Cleanup..."

# 1. Remove unused remotion directory
echo "🗑️  Removing unused remotion directory..."
rm -rf src/remotion/

# 2. Remove unused middleware placeholder
echo "🗑️  Removing unused middleware placeholder..."
rm -f src/core/middlewares/validate.js

# 3. Clean temporary uploaded video test files
echo "🗑️  Cleaning temporary video test files from uploads/..."
rm -f uploads/*.mp4

echo "✨ Cleanup complete! Testing backend loading..."
node -e "import('./app.js').then(() => console.log('🎉 Backend loaded cleanly with 0 errors!'))"

